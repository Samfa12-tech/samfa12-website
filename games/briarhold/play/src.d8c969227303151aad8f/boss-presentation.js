import {BOSS_ENCOUNTER_DEFINITIONS} from "./boss-director.js";
import {createBossRuntimeAssetAdapter} from "./boss-assets.js";
import {selectTouchAimAssistTarget} from "./aim-assist.js";

const PRESENTATION = Object.freeze({
  "moss-crowned-matron": {kind: "matron", color: "#73945f", scale: {x: 1.1, y: 1.45, z: 1.1}, counter: "Runebolt the exposed core between rotating shield arcs."},
  "root-sapper-prime": {kind: "sapper", color: "#b56b3f", scale: {x: 1.35, y: 0.8, z: 1.7}, counter: "Interrupt the visible plant before the occupied socket is disabled."},
  "ashwing-matriarch": {kind: "ashwing", color: "#a65346", scale: {x: 1.5, y: 0.65, z: 1.1}, wingSpan: 9, counter: "Move clear of the dive lane before the ash zone ignites."},
  "moonless-herald": {kind: "herald", color: "#7972a8", scale: {x: 0.8, y: 1.7, z: 0.8}, counter: "Ward light reveals the heart-lantern; phased attacks deal no damage."},
  "caravan-eater": {kind: "caravan-beast", color: "#8b6849", scale: {x: 1.25, y: 0.7, z: 2.2}, counter: "Build stagger to drive it away from the evacuation lane."},
  "hollow-hart": {kind: "hart", color: "#525f45", scale: {x: 1.35, y: 1.5, z: 1.25}, counter: "Read the roots while the grounded sovereign changes lane pressure."},
  cinderwing: {kind: "dragon", color: "#6d3033", scale: {x: 1.4, y: 0.7, z: 0.7}, wingSpan: 14, counter: "Read the fire strafe, then fire during the exposed flight window."},
});

export function buildBossPresentationSnapshot(director, interpolation = 1, {afterEventSequence = 0} = {}) {
  if (!director || director.mode !== "authored-director") throw new TypeError("an authored boss director snapshot is required");
  const alpha = clamp(Number(interpolation) || 0, 0, 1);
  const newEvents = director.events.filter(event => event.sequence > afterEventSequence);
  const actors = director.actors.map(actor => {
    const style = PRESENTATION[actor.id];
    const matron = actor.id === "moss-crowned-matron" ? matronPresentation(actor, director.timeMs, newEvents) : undefined;
    const defeatDuration = Math.max(1, actor.presentationUntilMs - actor.defeatedAtMs);
    const defeatProgress = actor.defeated
      ? clamp((director.timeMs - actor.defeatedAtMs) / defeatDuration, 0, 1)
      : 0;
    const interpolatedY = lerp(actor.previousPosition.y, actor.position.y, alpha);
    return {
      id: actor.id,
      title: actor.title,
      position: {
        x: lerp(actor.previousPosition.x, actor.position.x, alpha),
        y: actor.id === "cinderwing" && actor.defeated ? lerp(interpolatedY, 0, defeatProgress) : interpolatedY,
        z: lerp(actor.previousPosition.z, actor.position.z, alpha),
      },
      heading: actor.id === "moss-crowned-matron" ? 0 : actor.heading,
      hp: actor.hp,
      maxHp: actor.maxHp,
      phase: actor.phase,
      state: actor.state,
      defeated: actor.defeated,
      animationState: actor.animationState,
      silhouette: {...style},
      color: style.color,
      authoritative: false,
      hitFlash: !actor.defeated && director.timeMs < actor.hitUntilMs,
      defeatProgress,
      opacity: actor.defeated ? 1 - defeatProgress : 1,
      presentationVisible: !actor.defeated || director.timeMs < actor.presentationUntilMs,
      ...(matron ? {matron} : {}),
    };
  });
  const hp = actors.reduce((sum, actor) => sum + actor.hp, 0);
  const maxHp = actors.reduce((sum, actor) => sum + actor.maxHp, 0);
  const living = actors.filter(actor => !actor.defeated);
  const primary = living[0] ?? actors[0];
  return {
    encounterId: director.encounterId,
    status: director.status,
    actors,
    telegraphs: director.hitVolumes.map(volume => presentationVolume(volume, actors, volume.active)),
    zones: director.zones.map(zone => presentationVolume(zone, actors, director.timeMs >= zone.activeAtMs)),
    hud: {
      name: director.label,
      hp,
      maxHp,
      individualHp: actors.map(actor => ({id: actor.id, title: actor.title, hp: actor.hp, maxHp: actor.maxHp, phase: actor.phase})),
      phase: primary?.phase ?? 1,
      counterText: living.map(actor => counterText(actor)).join(" "),
    },
    announcements: newEvents
      .map(event => ({sequence: event.sequence, text: announcementText(event, director.label)}))
      .filter(item => item.text),
    eventSequence: director.eventSequence,
  };
}

export function bossRayHit(director, {origin, direction, maxDistance = 160} = {}) {
  let best = null;
  for (const actor of damageableActors(director)) {
    const center = {x: actor.position.x, y: actor.position.y + actor.radius * 0.45, z: actor.position.z};
    const distance = raySphereDistance(origin, direction, center, actor.radius);
    if (distance === null || distance > maxDistance || (best && distance >= best.distance)) continue;
    best = {actorId: actor.id, distance, point: {x: origin.x + direction.x * distance, y: origin.y + direction.y * distance, z: origin.z + direction.z * distance}};
  }
  return best;
}

export function bossesInRadius(director, {x, z, radius}) {
  return damageableActors(director)
    .filter(actor => Math.hypot(actor.position.x - x, actor.position.z - z) <= radius + actor.radius)
    .map(actor => actor.id);
}

export function bossesInViewCone(director, {origin, direction, range, halfAngle}) {
  const length = Math.hypot(direction.x, direction.z) || 1;
  const dx = direction.x / length;
  const dz = direction.z / length;
  return damageableActors(director).filter(actor => {
    const tx = actor.position.x - origin.x;
    const tz = actor.position.z - origin.z;
    const distance = Math.hypot(tx, tz);
    if (distance > range + actor.radius) return false;
    const dot = distance > 0 ? (tx * dx + tz * dz) / distance : 1;
    return Math.acos(clamp(dot, -1, 1)) <= halfAngle;
  }).map(actor => actor.id);
}

export function selectBossTouchAimAssistTarget(director, {
  origin,
  aimDirection,
  coneDegrees = 4,
  maxDistance = 120,
  isOccluded = () => false,
} = {}) {
  const targets = damageableActors(director).map(actor => ({
    id: actor.id,
    active: true,
    aimPoint: {
      x: actor.position.x,
      y: actor.position.y + actor.radius * 0.45,
      z: actor.position.z,
    },
  }));
  const selected = selectTouchAimAssistTarget({origin, aimDirection, targets, coneDegrees, maxDistance});
  if (!selected || isOccluded(selected.target, selected.target.aimPoint)) return null;
  return selected.target;
}

export function bossVolumeContainsPoint(volume, point) {
  if (!volume || !point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return false;
  const x = Number(volume.x) || 0;
  const z = Number(volume.z) || 0;
  const dx = point.x - x;
  const dz = point.z - z;
  if (Number.isFinite(volume.width) && Number.isFinite(volume.length)) {
    const heading = Number(volume.heading) || 0;
    const sin = Math.sin(-heading);
    const cos = Math.cos(-heading);
    const localX = dx * cos - dz * sin;
    const localZ = dx * sin + dz * cos;
    return Math.abs(localX) <= volume.width / 2 && Math.abs(localZ) <= volume.length / 2;
  }
  return Math.hypot(dx, dz) <= Math.max(0, Number(volume.radius) || 0);
}

export function collectBossDamageContacts(snapshot, point, nowMs, nextDamageAtById) {
  const contacts = [];
  const seen = new Set();
  for (const volume of [...(snapshot?.telegraphs ?? []), ...(snapshot?.zones ?? [])]) {
    if (!volume?.id || seen.has(volume.id) || volume.damaging !== true || !volume.visible || !volume.active || !bossVolumeContainsPoint(volume, point)) continue;
    seen.add(volume.id);
    if (nowMs + 1e-9 < (nextDamageAtById.get(volume.id) ?? 0)) continue;
    nextDamageAtById.set(volume.id, nowMs + Math.max(1, Number(volume.damageCadenceMs) || 750));
    contacts.push(volume);
  }
  return contacts;
}

/** Low-allocation Babylon adapter. It owns only presentation meshes. */
export function createBossProceduralAdapter({BABYLON, scene, runtimeAssets = null}) {
  const actorRecords = new Map();
  const telegraphRecords = [];
  let lastVolumes = [];
  const materials = new Map();
  const ownsRuntimeAssets = Boolean(runtimeAssets && !runtimeAssets.load);
  const assetAdapter = runtimeAssets?.load
    ? runtimeAssets
    : runtimeAssets
      ? createBossRuntimeAssetAdapter({BABYLON, scene, ...runtimeAssets})
      : null;
  const materialFor = (color, alpha = 1) => {
    const key = `${color}:${alpha}`;
    if (materials.has(key)) return materials.get(key);
    const material = new BABYLON.StandardMaterial(`boss-material:${key}`, scene);
    material.diffuseColor = BABYLON.Color3.FromHexString(color);
    material.emissiveColor = BABYLON.Color3.FromHexString(color).scale(alpha < 1 ? 0.35 : 0.12);
    material.alpha = alpha;
    material.disableLighting = alpha < 1;
    materials.set(key, material);
    return material;
  };
  const ensureActor = actor => {
    if (actorRecords.has(actor.id)) return actorRecords.get(actor.id);
    const root = new BABYLON.TransformNode(`boss:${actor.id}`, scene);
    // Authored GLBs are exported in a centred 2.8-unit runtime envelope. Keep
    // the procedural lift and silhouette scale on their own child so those
    // presentation-only transforms never distort or displace an imported rig.
    const proceduralRoot = new BABYLON.TransformNode(`boss:${actor.id}:procedural`, scene);
    proceduralRoot.parent = root;
    const body = BABYLON.MeshBuilder.CreateSphere(`boss:${actor.id}:body`, {diameter: 2.8, segments: 10}, scene);
    body.parent = proceduralRoot;
    body.material = materialFor(actor.color);
    const parts = [body];
    const style = actor.silhouette;
    if (style.kind === "dragon" || style.kind === "ashwing") {
      for (const side of [-1, 1]) {
        const wing = BABYLON.MeshBuilder.CreateBox(`boss:${actor.id}:wing:${side}`, {width: style.wingSpan / 2, height: 0.18, depth: 2.1}, scene);
        wing.parent = proceduralRoot;
        wing.position.x = side * style.wingSpan / 4;
        wing.rotation.z = side * 0.18;
        wing.material = materialFor(actor.color);
        parts.push(wing);
      }
    } else if (style.kind === "hart" || style.kind === "matron") {
      for (const side of [-1, 1]) {
        const crown = BABYLON.MeshBuilder.CreateCylinder(`boss:${actor.id}:crown:${side}`, {height: 3.5, diameter: 0.22, tessellation: 6}, scene);
        crown.parent = proceduralRoot;
        crown.position.x = side * 0.8;
        crown.position.y = 2;
        crown.rotation.z = side * -0.32;
        crown.material = materialFor(actor.color);
        parts.push(crown);
      }
      if (style.kind === "matron") {
        const core = BABYLON.MeshBuilder.CreateSphere(`boss:${actor.id}:core`, {diameter: 0.32, segments: 10}, scene);
        core.parent = proceduralRoot;
        core.position.x = -0.95;
        core.position.y = 1.4;
        core.position.z = -0.35;
        core.material = materialFor("#d9f29f");
        parts.push(core);
        const shields = [];
        for (let index = 0; index < 3; index += 1) {
          const shield = BABYLON.MeshBuilder.CreateTorus(`boss:${actor.id}:shield:${index}`, {
            diameter: 7.5,
            thickness: 0.32,
            tessellation: 24,
            arc: BOSS_ENCOUNTER_DEFINITIONS["moss-crowned-matron"].mechanics.shieldArcDegrees / 360,
          }, scene);
          shield.parent = proceduralRoot;
          shield.position.y = 0.45;
          shield.rotation.x = Math.PI / 2;
          shield.scaling.set(1, 4, 1);
          shield.material = materialFor("#9bc98a", 0.72);
          parts.push(shield);
          shields.push(shield);
        }
        actorRecords.set(actor.id, {root, proceduralRoot, body, parts, matron: {core, shields}, asset: null, assetAttempted: false, assetRequest: null});
        return actorRecords.get(actor.id);
      }
    } else if (style.kind === "sapper") {
      for (const side of [-1, 1]) {
        const limb = BABYLON.MeshBuilder.CreateBox(`boss:${actor.id}:limb:${side}`, {width: 0.4, height: 0.5, depth: 4}, scene);
        limb.parent = proceduralRoot;
        limb.position.x = side * 1.4;
        limb.material = materialFor(actor.color);
        parts.push(limb);
      }
    } else if (style.kind === "herald") {
      const lantern = BABYLON.MeshBuilder.CreateSphere(`boss:${actor.id}:lantern`, {diameter: 0.8, segments: 8}, scene);
      lantern.parent = proceduralRoot;
      lantern.position.y = 1.3;
      lantern.material = materialFor("#b9f0cc");
      parts.push(lantern);
    }
    const record = {root, proceduralRoot, body, parts, asset: null, assetAttempted: false, assetRequest: null};
    actorRecords.set(actor.id, record);
    return record;
  };
  const updateRuntimeAsset = (record, actor, visible) => {
    if (!assetAdapter) return;
    record.latestAnimationState = actor.animationState;
    record.latestVisible = visible;
    if (!record.asset && !record.assetAttempted && !record.assetRequest) {
      record.assetAttempted = true;
      record.assetRequest = Promise.resolve(assetAdapter.load?.(actor.id)).then(asset => {
        record.asset = asset ?? null;
        record.assetRequest = null;
        if (record.asset?.root) {
          record.asset.root.parent = record.root;
          record.asset.root.setEnabled?.(record.latestVisible === true);
          record.asset.play?.(record.latestAnimationState);
        }
      }).catch(() => {
        record.asset = null;
        record.assetRequest = null;
      });
    }
    const assetRoot = record.asset?.root;
    if (assetRoot) {
      const authoredScale = Math.max(1, Number(actor.silhouette?.scale?.y) || 1);
      assetRoot.scaling?.set?.(authoredScale, authoredScale, authoredScale);
      if (assetRoot.position) assetRoot.position.y = (Number(record.asset.groundOffset) || 0) * authoredScale;
      assetRoot.setEnabled?.(visible);
      record.asset.play?.(actor.animationState);
      const effectParts = new Set([
        ...(record.matron?.shields ?? []),
        record.matron?.core,
      ].filter(Boolean));
      for (const part of record.parts) {
        if (!effectParts.has(part)) part.setEnabled?.(!visible);
      }
    }
  };
  const ensureTelegraph = index => {
    if (telegraphRecords[index]) return telegraphRecords[index];
    const mesh = BABYLON.MeshBuilder.CreateCylinder(`boss-telegraph:${index}`, {diameter: 2, height: 0.08, tessellation: 24}, scene);
    mesh.material = materialFor("#ef7048", 0.42);
    mesh.setEnabled(false);
    telegraphRecords[index] = mesh;
    return mesh;
  };
  return {
    update(snapshot) {
      const activeIds = new Set(snapshot?.actors?.map(actor => actor.id) ?? []);
      for (const actor of snapshot?.actors ?? []) {
        const record = ensureActor(actor);
        record.root.position.set(actor.position.x, actor.position.y, actor.position.z);
        record.root.rotation.y = actor.heading;
        record.root.scaling.set(1, 1, 1);
        record.proceduralRoot.position.set(0, 1.4, 0);
        record.proceduralRoot.scaling.set(actor.silhouette.scale.x, actor.silhouette.scale.y, actor.silhouette.scale.z);
        const visible = actor.presentationVisible && (snapshot.status === "active" || snapshot.status === "defeated");
        record.root.setEnabled(visible);
        updateRuntimeAsset(record, actor, visible);
        record.root.rotation.x = actor.animationState === "fall" ? actor.defeatProgress * 1.15 : actor.hitFlash ? -0.12 : 0;
        for (const part of record.parts) part.visibility = actor.opacity;
        if (record.matron && actor.matron) {
          const visible = snapshot.status === "active" && actor.presentationVisible;
          for (let index = 0; index < record.matron.shields.length; index += 1) {
            const shield = record.matron.shields[index];
            const arc = actor.matron.shieldArcs[index];
            shield.rotation.y = normaliseAngle(arc.heading - actor.heading);
            shield.setEnabled(visible && arc.active);
            shield.material = materialFor(actor.matron.blockedHit ? "#fff0a8" : "#9bc98a", actor.matron.blockedHit ? 0.9 : 0.72);
          }
          record.matron.core.setEnabled(visible);
          record.matron.core.material = materialFor(
            actor.matron.core.regenerationInterrupted ? "#68d9ff" : actor.matron.core.exposed ? "#f5e27a" : "#d9f29f",
          );
        }
        if (actor.id === "cinderwing" || actor.id === "ashwing-matriarch") {
          const flap = actor.animationState === "flap" ? 0.38 : actor.animationState === "hit" ? 0.55 : 0.12;
          const responseMaterial = actor.id === "cinderwing"
            ? actor.defeated
              ? materialFor("#e76d45", 0.99)
              : actor.hitFlash || actor.animationState === "hit"
                ? materialFor("#ffbf78", 0.99)
                : materialFor(actor.color)
            : null;
          for (const [index, part] of record.parts.entries()) {
            if (responseMaterial) part.material = responseMaterial;
            if (index > 0) part.rotation.z = (index === 1 ? -1 : 1) * flap;
          }
        }
      }
      for (const [id, record] of actorRecords) if (!activeIds.has(id)) record.root.setEnabled(false);
      const volumes = [...(snapshot?.telegraphs ?? []), ...(snapshot?.zones ?? [])].slice(0, 16);
      lastVolumes = volumes.map(volume => ({
        id: volume.id,
        visible: volume.visible === true,
        active: volume.active === true,
        damaging: volume.damaging === true,
      }));
      for (let index = 0; index < 16; index += 1) {
        const mesh = ensureTelegraph(index);
        const volume = volumes[index];
        mesh.setEnabled(Boolean(volume?.visible));
        if (!volume) continue;
        mesh.position.set(volume.x ?? snapshot.actors.find(actor => actor.id === volume.actorId)?.position.x ?? 0, 0.08, volume.z ?? snapshot.actors.find(actor => actor.id === volume.actorId)?.position.z ?? 0);
        const radius = volume.radius ?? (volume.width ?? 4) / 2;
        mesh.scaling.set(radius, 1, (volume.length ?? radius * 2) / 2);
        mesh.rotation.y = Number(volume.heading) || 0;
        mesh.material = materialFor(volume.active ? "#d6422f" : "#efb44c", volume.active ? 0.5 : 0.35);
      }
    },
    diagnostics() {
      return Object.freeze({
        actors: Object.freeze([...actorRecords.entries()].map(([id, record]) => Object.freeze({
          id,
          enabled: typeof record.root.isEnabled === "function" && record.root.isEnabled() === true,
          parts: record.parts.length,
          rotationY: record.root.rotation.y,
          position: Object.freeze({
            x: record.root.position.x,
            y: record.root.position.y,
            z: record.root.position.z,
          }),
          procedural: Object.freeze({
            lift: record.proceduralRoot.position.y,
            scale: Object.freeze({
              x: record.proceduralRoot.scaling.x,
              y: record.proceduralRoot.scaling.y,
              z: record.proceduralRoot.scaling.z,
            }),
          }),
        }))),
        telegraphs: Object.freeze({
          total: lastVolumes.length,
          visible: lastVolumes.filter(volume => volume.visible).length,
          active: lastVolumes.filter(volume => volume.active).length,
          damaging: lastVolumes.filter(volume => volume.damaging).length,
        }),
        runtimeAssets: assetAdapter?.diagnostics?.() ?? null,
      });
    },
    dispose() {
      for (const record of actorRecords.values()) record.root.dispose(false, true);
      for (const mesh of telegraphRecords) mesh?.dispose();
      for (const material of materials.values()) material.dispose();
      if (ownsRuntimeAssets) assetAdapter?.dispose?.();
      actorRecords.clear();
      lastVolumes = [];
    },
  };
}

function presentationVolume(volume, actors, active) {
  const actor = actors.find(item => item.id === volume.actorId);
  return {
    ...volume,
    x: Number.isFinite(volume.x) ? volume.x : actor?.position.x ?? 0,
    z: Number.isFinite(volume.z) ? volume.z : actor?.position.z ?? 0,
    heading: Number.isFinite(volume.heading) ? volume.heading : actor?.heading ?? 0,
    active: Boolean(active),
    damaging: volume.damaging === true,
    authoritative: false,
  };
}

function damageableActors(director) {
  if (!director || director.mode !== "authored-director" || director.status !== "active") return [];
  return director.actors.filter(actor => !actor.defeated && actor.hitVolumes.some(volume => volume.active));
}

function raySphereDistance(origin, direction, center, radius) {
  const ox = origin.x - center.x;
  const oy = origin.y - center.y;
  const oz = origin.z - center.z;
  const a = direction.x ** 2 + direction.y ** 2 + direction.z ** 2;
  const b = 2 * (ox * direction.x + oy * direction.y + oz * direction.z);
  const c = ox ** 2 + oy ** 2 + oz ** 2 - radius ** 2;
  const discriminant = b ** 2 - 4 * a * c;
  if (discriminant < 0 || a <= 0) return null;
  const root = Math.sqrt(discriminant);
  const near = (-b - root) / (2 * a);
  const far = (-b + root) / (2 * a);
  return near >= 0 ? near : far >= 0 ? far : null;
}

function announcementText(event, label) {
  if (event.type === "boss_intro") return `${label} enters the field.`;
  if (event.type === "boss_phase") return `${title(event.actorId)} · Phase ${event.phase}.`;
  if (event.type === "attack_telegraph") return `${title(event.actorId)} telegraphs ${String(event.attack).replaceAll("_", " ")}.`;
  if (event.type === "dragon_breath") return "Cinderwing breathes fire across the marked lane.";
  if (event.type === "boss_stagger") return `${title(event.actorId)} staggered.`;
  if (event.type === "hit_blocked" && event.reason === "rotating_shield_arc") return "Shield arc blocked the shot — circle to the exposed core.";
  if (event.type === "shield_feed_broken") return `Mossguard shield feed broken · ${event.livingMossguards} remain.`;
  if (event.type === "socket_disabled") return `${event.socketId} visibly disabled for this wave.`;
  if (event.type === "objective_damage") return `${title(event.actorId)} damages ${event.targetId}.`;
  if (event.type === "boss_defeat") return `${title(event.actorId)} defeated.`;
  if (event.type === "encounter_defeat") return `${label} defeated.`;
  return null;
}

function matronPresentation(actor, timeMs, newEvents) {
  const mechanics = BOSS_ENCOUNTER_DEFINITIONS["moss-crowned-matron"].mechanics;
  const regenerationInterruptRemainingMs = Math.max(0, actor.regenerationInterruptedUntilMs - timeMs);
  return {
    shieldArcs: Array.from({length: mechanics.mossguardFeeds}, (_, index) => ({
      id: `${actor.id}:shield:${index}`,
      heading: normaliseAngle(actor.heading + index * Math.PI * 2 / mechanics.mossguardFeeds),
      arcDegrees: mechanics.shieldArcDegrees,
      active: index < actor.livingMossguards,
    })),
    core: {
      exposed: actor.livingMossguards === 0,
      exposedBetweenArcs: actor.livingMossguards > 0,
      regenerationInterrupted: regenerationInterruptRemainingMs > 0,
      regenerationInterruptRemainingMs,
    },
    blockedHit: newEvents.some(event => event.type === "hit_blocked" && event.actorId === actor.id && event.reason === "rotating_shield_arc"),
  };
}

function counterText(actor) {
  if (!actor.matron) return PRESENTATION[actor.id].counter;
  if (actor.matron.core.exposed) return "Mossguards broken — core fully exposed; Runebolt prevents regeneration.";
  if (actor.matron.core.regenerationInterrupted) return `Runebolt struck the exposed core — regeneration interrupted for ${(actor.matron.core.regenerationInterruptRemainingMs / 1000).toFixed(1)}s.`;
  return "Runebolt the bright core between rotating shield arcs to interrupt regeneration.";
}

function title(value) {
  return String(value ?? "Boss").split("-").map(part => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

function lerp(from, to, alpha) {
  return from + (to - from) * alpha;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normaliseAngle(value) {
  const turn = Math.PI * 2;
  return ((value % turn) + turn) % turn;
}
