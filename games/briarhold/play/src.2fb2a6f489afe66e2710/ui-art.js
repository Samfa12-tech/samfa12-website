/** Authored image-atlas positions are presentation only; gameplay IDs stay unchanged. */
export const UI_ICON_IDS = Object.freeze([
  "thornheart-vigor", "tempered-briar", "menders-knot", "heartwood-bracing",
  "briarholds-breath", "wardlight-covenant", "ashskin-binding", "hunters-patience",
  "rootway-stride", "caravan-oath", "twin-thorns", "bellglass-foresight",
  "wardens-vigor", "armory-temper", "quartermaster", "masons-oath",
  "field-craft", "bellkeepers-watch", "commission:warden-focus", "sunfire-prism",
  "split-runebolt", "resin-snare", "warded-barricade", "quartermaster-oath",
  "warden-focus", "field-step", "steady-breath", "quick-hands",
  "last-oath", "courtyard-rally", "arbalest-faster-bolt-cycle", "arbalest-heavy-stagger",
  "arbalest-charged-precision", "arbalest-quick-hip-fire-follow-up",
  "arbalest-armour-pin", "arbalest-kill-confirm-heat-refund",
  "sunfire-reduced-heat-gain", "sunfire-faster-cooldown",
  "sunfire-narrow-long-range-beam", "sunfire-wide-close-range-sweep",
  "sunfire-manual-vent-burst", "sunfire-controlled-overheat-window",
  "runebolt-faster-tighter-projectile", "runebolt-larger-weaker-splash",
  "runebolt-direct-hit-armour-crack", "runebolt-terrain-ricochet",
  "runebolt-delayed-cluster-split", "runebolt-controlled-gravity-pulse",
]);

const atlasUrl = new URL("../assets/ui/briarhold-icon-atlas.webp", import.meta.url).href;

export function iconArt(id) {
  const index = UI_ICON_IDS.indexOf(id);
  if (index < 0) return null;
  return {
    url: atlasUrl,
    position: `${(index % 8) * 100 / 7}% ${Math.floor(index / 8) * 100 / 5}%`,
    size: "800% 600%",
  };
}

export function applyUiIcon(element, id) {
  const art = iconArt(id);
  element.classList.add("ui-art-icon");
  element.setAttribute("aria-hidden", "true");
  if (!art) {
    element.textContent = "✦";
    return false;
  }
  element.dataset.artId = id;
  element.style.backgroundImage = `url("${art.url}")`;
  element.style.backgroundPosition = art.position;
  element.style.backgroundSize = art.size;
  return true;
}
