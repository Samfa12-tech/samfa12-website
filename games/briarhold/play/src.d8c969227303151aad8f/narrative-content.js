/**
 * Data-only production dialogue for the seven-night narrative layer.
 *
 * This module owns stable content IDs and local prose. It has no DOM, camera,
 * storage, simulation, or network dependency. Runtime state carries IDs only.
 */

import {BOSS_ENCOUNTERS, CAMPAIGN_WAVES} from "./campaign-content.js";
import {HUB_NPC_IDS, HUB_NPC_UNLOCK_ORDER} from "./hub.js";
import {NARRATIVE_FAILURE_REASON_CODES} from "./narrative-state.js";
import {RELATIONSHIP_GOALS} from "./relationship-goals.js";
import {bellkeeperBriefingSceneId} from "./progression.js";

export const NARRATIVE_TRIGGERS = Object.freeze([
  "profile_intro", "day_begin", "npc_arrival", "npc_talk", "goal_offer",
  "goal_reminder", "goal_ready", "goal_report", "bell_briefing",
  "wave_cleared", "night_cleared", "run_failed", "campaign_cleared",
]);
export const NARRATIVE_PRESENTATIONS = Object.freeze(["tableau", "dialogue", "bark"]);
export const NARRATIVE_REPLAY_POLICIES = Object.freeze([
  "once_profile", "once_attempt", "once_night", "repeatable",
]);
export const NARRATIVE_RESPONSE_TAGS = Object.freeze([
  "practical", "compassionate", "defiant",
]);
export const NARRATIVE_SHOT_IDS = Object.freeze([
  "first-person", "bell-wide", "speaker-close", "speaker-medium", "two-shot",
  "gate-overlook", "courtyard-wide", "stores-medium", "workbench-medium",
  "grove-medium", "fortress-wide",
]);
export const NARRATIVE_AUDIO_CUE_IDS = Object.freeze([
  "none", "voice-nell", "voice-orin", "voice-tamsin", "voice-fen", "voice-edda",
  "dawn-air", "arrival-step", "bell-toll", "failure-low", "wave-warning",
  "night-clear", "debt-break",
]);

export const NARRATIVE_CAST = deepFreeze({
  [HUB_NPC_IDS.BELLKEEPER]: {name: "Nell Vey", roleId: "bellkeeper", role: "Bellkeeper", cueId: "voice-nell"},
  [HUB_NPC_IDS.MASON]: {name: "Orin Pike", roleId: "mason", role: "Mason", cueId: "voice-orin"},
  [HUB_NPC_IDS.QUARTERMASTER]: {name: "Tamsin Rook", roleId: "quartermaster", role: "Quartermaster", cueId: "voice-tamsin"},
  [HUB_NPC_IDS.TRAPPER]: {name: "Fen Alder", roleId: "trapper", role: "Trapper", cueId: "voice-fen"},
  [HUB_NPC_IDS.GREENWARDEN]: {name: "Edda Rowan", roleId: "greenwarden", role: "Greenwarden", cueId: "voice-edda"},
});

const NELL = HUB_NPC_IDS.BELLKEEPER;
const ORIN = HUB_NPC_IDS.MASON;
const TAMSIN = HUB_NPC_IDS.QUARTERMASTER;
const FEN = HUB_NPC_IDS.TRAPPER;
const EDDA = HUB_NPC_IDS.GREENWARDEN;

function buildCoreScenes() {
  return [
  scene("profile-intro-nell", "profile_intro", 1200, "tableau", {}, "once_profile", [
    line(NELL, "I'm Nell Vey, the Bellkeeper. Check the Heart Gate and both approaches before you come back to me.", "bell-wide"),
    line(NELL, "When you're ready, I'll give you the night's warning. You decide when I ring.", "speaker-close", {
      responses: responses(
        ["check-first", "I'll check the gates first.", "practical"],
        ["we-hold", "Then we hold Briarhold.", "defiant"],
      ),
    }),
  ], {kind: "profile_intro"}),

  ...[
    [0, {exact: 1}, "The morning has returned once. Prepare, then speak with me at the bell."],
    [1, {exact: 2}, "The morning has returned again. We know one mistake we don't need to repeat."],
    [2, {exact: 3}, "We're back at first light. Compare what you remember before you prepare."],
    [3, {min: 4}, "We all know this morning now. Use that knowledge and keep the plan simple."],
  ].map(([stage, failedRuns, text]) => scene(
    `attempt-opening-awareness-${stage}`, "day_begin", 760, "tableau",
    {failedRuns, mode: "canonical"}, "once_attempt",
    [line(NELL, text, "courtyard-wide")], {kind: "attempt_opening", awarenessStage: stage},
  )),

  scene("echo-attempt-opening", "day_begin", 770, "tableau", {mode: "echo"}, "once_attempt", [
    line(NELL, "This is an echo of the completed watch. Check your loadout, then speak with me at the bell.", "courtyard-wide"),
  ], {kind: "echo_attempt_opening"}),
  scene("echo-failure-return", "run_failed", 900, "dialogue", {mode: "echo"}, "once_attempt", [
    line(NELL, "The echo ends here. You can return to the title or begin another echo.", "speaker-close"),
  ], {kind: "echo_failure_return"}),
  scene("echo-campaign-ending", "campaign_cleared", 1100, "tableau", {mode: "echo"}, "once_attempt", [
    line(NELL, "This watch was an echo, but the dawn is still yours. Begin another when you are ready.", "courtyard-wide"),
  ], {kind: "campaign_ending", variant: "echo"}),

  scene("arrival-mason", "npc_arrival", 1100, "tableau", {queuedSceneId: "arrival-mason", activeNpcIds: [ORIN], mode: "canonical"}, "once_profile", [
    line(NELL, "You remember dying, and so do I. The bell returned us to this morning. I asked Orin to come because the gates will not last without him.", "two-shot"),
    line(ORIN, "Show me where they broke through. I can repair the gates and put barricades in front of them.", "speaker-close"),
  ], {kind: "canonical_arrival", npcId: ORIN}),
  scene("arrival-quartermaster", "npc_arrival", 1100, "tableau", {queuedSceneId: "arrival-quartermaster", activeNpcIds: [TAMSIN], mode: "canonical"}, "once_profile", [
    line(ORIN, "I knew where that joint would crack before I touched it. I don't know how.", "two-shot"),
    line(TAMSIN, "Nell gave me the count from your last attempt. I'll handle supplies and weapon commissions now.", "stores-medium"),
  ], {kind: "canonical_arrival", npcId: TAMSIN}),
  scene("arrival-trapper", "npc_arrival", 1100, "tableau", {queuedSceneId: "arrival-trapper", activeNpcIds: [FEN], mode: "canonical"}, "once_profile", [
    line(TAMSIN, "I knew which shelves would be empty before I opened the store.", "two-shot"),
    line(FEN, "Tamsin believed my warnings when the council did not. Nell told me which route the Host took. I'll place traps where that route narrows.", "workbench-medium"),
  ], {kind: "canonical_arrival", npcId: FEN}),
  scene("arrival-greenwarden", "npc_arrival", 1100, "tableau", {queuedSceneId: "arrival-greenwarden", activeNpcIds: [EDDA], mode: "canonical"}, "once_profile", [
    line(FEN, "I knew where the first group would turn before they came. I don't know how.", "two-shot"),
    line(EDDA, "I warned Nell what the old bell could do. Failure sends us back to this morning. Hold all seven nights and the binding will end.", "grove-medium"),
  ], {kind: "canonical_arrival", npcId: EDDA}),

  ...[
    [ORIN, "Nell asked me to help rebuild. I don't remember your watch, but I know these gates and I know where the old work failed."],
    [TAMSIN, "Nell says the siege is over. Good. Rebuilding still needs an honest stores count, so that's where I'll start."],
    [FEN, "The Host has gone, but its routes remain. I'll clear the dangerous ones and leave the safe tracks marked."],
    [EDDA, "The bell's binding is gone. The boundary grove still needs care, and I can help keep the new growth away from the walls."],
  ].map(([npcId, text]) => scene(
    `post-debt-arrival-${npcId}`, "npc_arrival", 1090, "tableau",
    {queuedSceneId: `arrival-${npcId}`, activeNpcIds: [npcId], mode: "echo"}, "once_profile",
    [line(npcId, text, shotFor(npcId))], {kind: "post_debt_arrival", npcId},
  )),

  ...[
    [1, NELL, "The bell returned us to this morning. Tell me where the defence failed, then we'll change that part first."],
    [2, ORIN, "That fracture is the same one I repaired before. Give me the last gate readings. I trust the numbers even if I don't trust my memory."],
    [3, TAMSIN, "My clean ledger has the same shortage I wrote down before. Tell me what ran out during the fight."],
    [4, FEN, "The Host used the same turn again. Mark the point where the line opened and I'll adjust the traps."],
  ].map(([failure, speakerId, text]) => scene(
    `failure-chapter-${failure}`, "day_begin", 950, "tableau", {failedRuns: {exact: failure}, mode: "canonical"}, "once_attempt",
    [line(speakerId, text, shotFor(speakerId))], {kind: "first_failure_chapter", failure},
  )),

  scene("failure-chapter-5", "day_begin", 950, "tableau", {failedRuns: {exact: 5}, mode: "canonical"}, "once_attempt", [
    line(NELL, "No one else is coming. This is everyone we have.", "courtyard-wide"),
    line(EDDA, "The grove changed in the same way again. Tell us where it ended so we can plan around it.", "grove-medium"),
    ...failureFiveFactBeats,
  ], {kind: "first_failure_chapter", failure: 5}),

  ...Array.from({length: 7}, (_, index) => {
    const night = index + 1;
    return scene(
      `later-failure-night-${night}`, "run_failed", 820, "dialogue",
      {failedRuns: {min: 6}, lastFailureNight: night, mode: "canonical"}, "once_attempt",
      [line(NELL, laterFailureNightLines[index], "speaker-close")],
      {kind: "later_failure_night", night},
    );
  }),
  ...[
    "The last defence ended in Wave 1. Protect the gates from the opening pressure before you spend on later threats.",
    "The last defence ended in Wave 2. Carry more gate integrity and health into the middle assault.",
    "The last defence ended in Wave 3. Keep enough health and gate integrity for the final encounter.",
  ].map((text, index) => scene(
    `later-failure-wave-${index + 1}`, "run_failed", 810, "dialogue",
    {failedRuns: {min: 6}, lastFailureWave: index + 1, mode: "canonical"}, "once_attempt",
    [line(NELL, text, "speaker-close")],
    {kind: "later_failure_wave", wave: index + 1},
  )),
  ...Object.values(BOSS_ENCOUNTERS).map((boss) => scene(
    `later-failure-boss-${boss.id}`, "run_failed", 850, "dialogue",
    {failedRuns: {min: 6}, lastFailureBossId: boss.id, mode: "canonical"}, "once_attempt",
    [line(NELL, bossFailureLines[boss.id], "speaker-close")],
    {kind: "later_failure_boss", bossId: boss.id},
  )),
  scene("later-failure-warden", "run_failed", 840, "dialogue", {failedRuns: {min: 6}, lastFailureReasonCode: "warden_fallen", mode: "canonical"}, "once_attempt", [
    line(NELL, "You fell before the hold did. Keep one clear retreat to the courtyard and use it before your health is gone.", "speaker-close"),
  ], {kind: "later_failure_reason", reasonCode: "warden_fallen"}),
  scene("later-failure-player", "run_failed", 840, "dialogue", {failedRuns: {min: 6}, lastFailureReasonCode: "player_died", mode: "canonical"}, "once_attempt", [
    line(NELL, "You were killed before the hold fell. Leave room to retreat, and use field medicine before the next hit can finish you when it is available.", "speaker-close"),
  ], {kind: "later_failure_reason", reasonCode: "player_died"}),
  scene("later-failure-heart-gate", "run_failed", 840, "dialogue", {failedRuns: {min: 6}, lastFailureReasonCode: "heart_gate_fallen", mode: "canonical"}, "once_attempt", [
    line(ORIN, "The Heart Gate failed. Leave enough time to fall back and clear anything already inside the hold.", "speaker-close"),
  ], {kind: "later_failure_reason", reasonCode: "heart_gate_fallen"}),
  scene("later-failure-bellkeeper", "run_failed", 840, "dialogue", {failedRuns: {min: 6}, lastFailureReasonCode: "bellkeeper_fallen", mode: "canonical"}, "once_attempt", [
    line(NELL, "I fell and the bell ended the attempt. Keep enemies off the platform when they break through an outer gate.", "speaker-close"),
  ], {kind: "later_failure_reason", reasonCode: "bellkeeper_fallen"}),
  ...[
    ["west-outer-gate", ORIN, "The west gate was the breach. Repair that side first and keep a path open behind it."],
    ["east-outer-gate", FEN, "The east gate was the breach. Fight from the inner angle so the next group stays in your line of fire."],
  ].map(([gateId, speakerId, text]) => scene(
    `later-failure-gate-${gateId}`, "run_failed", 845, "dialogue",
    {failedRuns: {min: 6}, lastBreachedGateId: gateId, mode: "canonical"}, "once_attempt",
    [line(speakerId, text, shotFor(speakerId))], {kind: "later_failure_gate", gateId},
  )),
  ...[
    [NELL, "I died before the night ended. If the platform is exposed, pull the fight away from the bell."],
    [ORIN, "Orin fell. We keep his repairs and barricades, but further gate repair and Mason work wait until the next attempt."],
    [TAMSIN, "Tamsin fell. Any prepared medicine still works, but the stores stay closed for the rest of this attempt."],
    [FEN, "Fen fell. Placed defences keep working, but damaged mechanisms wait until the next attempt."],
    [EDDA, "Edda fell. Her chosen boons remain, but there will be no new boon after this night."],
  ].map(([npcId, text]) => scene(
    `later-failure-npc-${npcId}`, "run_failed", 848, "dialogue",
    {failedRuns: {min: 6}, lastFallenNpcIds: [npcId], mode: "canonical"}, "once_attempt",
    [line(NELL, text, "speaker-close")], {kind: "later_failure_npc_death", npcId},
  )),

  ...[
    [NELL, "I remember where the last attempt ended. Tell me what you need from the warning before we discuss the bell."],
    [ORIN, "Nell gave me the damage pattern. I'll use it to decide which gate repair comes first."],
    [TAMSIN, "The last attempt changed the stock plan. Check your medicine and weapon costs before you spend."],
    [FEN, "The last attempt showed one route clearly. I'll put today's advice on that approach."],
    [EDDA, "The last attempt changed the grove where the defence failed. I can compare that with Nell's account."],
  ].map(([npcId, text]) => scene(
    `recent-failure-${npcId}`, "npc_talk", 800, "dialogue",
    {failedRuns: {min: 1}, activeNpcIds: [npcId], mode: "canonical"}, "once_attempt",
    [line(npcId, text, shotFor(npcId))], {kind: "recent_failure_conversation", npcId},
  )),

  ...dawnLines.map((text, index) => scene(
    `dawn-opening-night-${index + 1}`, "day_begin", 400, "tableau", {night: index + 1}, "once_night",
    [line(NELL, text, "fortress-wide", {cueId: "dawn-air"})], {kind: "dawn_opening", night: index + 1},
  )),

  ...briefingLines.map((text, index) => scene(
    bellkeeperBriefingSceneId(index + 1), "bell_briefing", 780, "dialogue",
    {night: index + 1, activeNpcIds: [NELL]}, "once_night",
    [line(NELL, text, "bell-wide", {
      responses: responses(
        ["understood", "I understand the warning.", "practical"],
        ["ring-soon", "We'll be ready.", "defiant"],
      ),
    })], {kind: "night_briefing", night: index + 1},
  )),

  ...waveRecords.map((record) => scene(
    `wave-record-${record.night}-${record.wave}`, "wave_cleared", 300, "bark",
    {night: record.night, wave: record.wave}, "once_night",
    [line(NELL, record.recoveryWarning, "first-person", {cueId: "wave-warning"})],
    {kind: "wave_record", night: record.night, wave: record.wave}, {waveRecord: record},
  )),

  ...nightClearLines.map((text, index) => scene(
    `night-clear-${index + 1}`, "night_cleared", 700, "tableau", {night: index + 1}, "once_night",
    [line(NELL, text, "courtyard-wide", {cueId: "night-clear"})], {kind: "night_clear", night: index + 1},
  )),

  scene("campaign-ending-zero-failures", "campaign_cleared", 1000, "tableau", {failedRuns: {max: 0}}, "once_profile", [
    line(NELL, "I did not tell you that the bell would have returned us to the first morning if we fell. You held all seven nights, so it never had to. The bell is broken now.", "bell-wide", {cueId: "debt-break"}),
  ], {kind: "campaign_ending", variant: "zero"}),
  scene("campaign-ending-one-to-four", "campaign_cleared", 1000, "tableau", {failedRuns: {min: 1, max: 4}}, "once_profile", [
    line(NELL, "The bell is broken. It cannot send us back again.", "bell-wide", {cueId: "debt-break"}),
    line(ORIN, "Then this repair gets to stay repaired.", "speaker-medium", {beatId: "ending-mid-orin", exclusiveGroup: "ending-cast", priority: 400, conditions: {livingNpcIds: [ORIN], awareness: {npcId: ORIN, min: 1}}}),
    line(TAMSIN, "The next stores count will be the first one I close for good.", "stores-medium", {beatId: "ending-mid-tamsin", exclusiveGroup: "ending-cast", priority: 300, conditions: {livingNpcIds: [TAMSIN], awareness: {npcId: TAMSIN, min: 1}}}),
    line(FEN, "I'll mark safe routes for the rebuilding crews.", "workbench-medium", {beatId: "ending-mid-fen", exclusiveGroup: "ending-cast", priority: 200, conditions: {livingNpcIds: [FEN], awareness: {npcId: FEN, min: 1}}}),
    line(EDDA, "The binding has ended. This morning will continue.", "grove-medium", {beatId: "ending-mid-edda", exclusiveGroup: "ending-cast", priority: 100, conditions: {livingNpcIds: [EDDA]}}),
  ], {kind: "campaign_ending", variant: "mid"}),
  scene("campaign-ending-five-plus", "campaign_cleared", 1000, "tableau", {failedRuns: {min: 5}}, "once_profile", [
    line(NELL, "It is morning. The bell did not pull us back.", "bell-wide", {cueId: "debt-break"}),
    line(EDDA, "The binding is gone.", "grove-medium", {beatId: "ending-binding-edda", exclusiveGroup: "ending-binding", priority: 200, conditions: {livingNpcIds: [EDDA]}}),
    line(NELL, "The binding is gone. The bell cannot pull us back again.", "speaker-close", {beatId: "ending-binding-nell", exclusiveGroup: "ending-binding", priority: 100}),
    line(ORIN, "I'll start with the west gate. The work can continue tomorrow.", "speaker-medium", {beatId: "ending-full-orin", exclusiveGroup: "ending-cast", priority: 400, conditions: {livingNpcIds: [ORIN]}}),
    line(TAMSIN, "I'll close the final stores count once.", "stores-medium", {beatId: "ending-full-tamsin", exclusiveGroup: "ending-cast", priority: 300, conditions: {livingNpcIds: [TAMSIN]}}),
    line(FEN, "I'll check the roads for rebuilding crews at first light.", "workbench-medium", {beatId: "ending-full-fen", exclusiveGroup: "ending-cast", priority: 200, conditions: {livingNpcIds: [FEN]}}),
    ...endingRelationshipBeats,
  ], {kind: "campaign_ending", variant: "full"}),
  ];
}

function buildPrimaryScenes() {
  return Object.entries(primaryConversationLines).flatMap(([npcId, lines]) =>
    lines.map((text, index) => scene(
    `primary-${npcId}-night-${index + 1}`, "npc_talk", 600, "dialogue",
    {night: index + 1, activeNpcIds: [npcId]}, "once_night",
    [line(npcId, text, shotFor(npcId))],
    {kind: "night_primary", npcId, night: index + 1},
    )),
  );
}

function buildAwarenessScenes() {
  return Object.entries(awarenessLines).flatMap(([npcId, lines]) =>
    lines.map((text, index) => {
      const stage = npcId === NELL ? 3 : index;
      return scene(
      `awareness-${npcId}-${stage}`, "npc_talk", 500, "dialogue",
      {activeNpcIds: [npcId], awareness: {npcId, exact: stage}}, "once_attempt",
      [line(npcId, text, shotFor(npcId))], {kind: "awareness", npcId, stage},
      );
    }),
  );
}

function buildServiceScenes() {
  return Object.entries(serviceRepeatLines).map(([npcId, text]) => scene(
    `service-repeat-${npcId}`, "npc_talk", 100, "dialogue", {activeNpcIds: [npcId]}, "repeatable",
    [line(npcId, text, shotFor(npcId))], {kind: "service_repeat", npcId},
  ));
}

function buildGoalScenes() {
  return RELATIONSHIP_GOALS.flatMap((goal) => {
    const copy = goalDialogue[goal.id];
    const goalOrder = RELATIONSHIP_GOALS.filter(({npcId}) => npcId === goal.npcId).findIndex(({id}) => id === goal.id) + 1;
    return [
      goalScene(goal, "offer", "goal_offer", 720, {nextGoalId: goal.id}, copy.offer),
      goalScene(goal, "reminder", "goal_reminder", 700, {activeGoalId: goal.id}, copy.reminder),
      goalScene(goal, "progress", "goal_reminder", 710, {activeGoalId: goal.id, goalHasProgress: true}, copy.progress),
      goalScene(goal, "ready", "goal_ready", 880, {readyGoalId: goal.id}, copy.ready),
      goalScene(goal, "report", "goal_report", 900, {readyGoalId: goal.id}, copy.report),
      goalScene(goal, "repeat", "npc_talk", 130 + goalOrder, {completedGoalIds: [goal.id]}, copy.repeat),
    ];
  });
}

/** Validate the complete bank without executing or presenting its prose. */
export function validateNarrativeCatalogue(catalogue = NARRATIVE_CATALOGUE) {
  const errors = [];
  const ids = new Set();
  const entries = Array.isArray(catalogue) ? catalogue : [];
  if (!Array.isArray(catalogue)) errors.push("catalogue must be an array");
  for (const entry of entries) validateScene(entry, ids, errors);
  for (const npcId of HUB_NPC_UNLOCK_ORDER) {
    const cast = NARRATIVE_CAST[npcId];
    if (!cast || cast.roleId !== npcId || typeof cast.name !== "string" || typeof cast.role !== "string") {
      errors.push(`${npcId}: cast name and role ID are required`);
    }
  }

  const covered = (kind) => entries.filter((entry) => entry.coverage?.kind === kind);
  const goalStates = new Map();
  for (const entry of covered("goal_dialogue")) {
    const key = entry.coverage.goalId;
    if (!goalStates.has(key)) goalStates.set(key, new Set());
    goalStates.get(key).add(entry.coverage.goalState);
  }
  const requiredGoalStates = ["offer", "reminder", "progress", "ready", "report", "repeat"];
  const goalDialogueSets = RELATIONSHIP_GOALS.filter(({id}) =>
    requiredGoalStates.every((state) => goalStates.get(id)?.has(state)),
  ).length;
  if (goalDialogueSets !== RELATIONSHIP_GOALS.length) errors.push("relationship goal dialogue coverage is incomplete");

  const briefingIds = entries.filter(({trigger}) => trigger === "bell_briefing").map(({id}) => id).sort();
  const expectedBriefings = Array.from({length: 7}, (_, index) => bellkeeperBriefingSceneId(index + 1)).sort();
  if (JSON.stringify(briefingIds) !== JSON.stringify(expectedBriefings)) errors.push("Bellkeeper briefing IDs do not match bell authority");

  const zero = entries.find(({id}) => id === "campaign-ending-zero-failures");
  if (!zero || zero.beats.some(({speakerId}) => speakerId !== NELL)) errors.push("zero-failure ending names absent cast");

  const waveEntries = covered("wave_record");
  for (const field of ["title", "objective", "spokenBriefing", "recoveryWarning", "tacticalHint"]) {
    const values = waveEntries.map(({waveRecord}) => waveRecord?.[field]);
    if (values.length !== CAMPAIGN_WAVES.length || values.some((value) => typeof value !== "string" || value.trim().length === 0)) {
      errors.push(`wave records are missing ${field}`);
    } else if (new Set(values).size !== values.length) {
      errors.push(`wave record ${field} values must be unique`);
    }
  }

  return {
    errors,
    scenes: entries.length,
    profileIntros: covered("profile_intro").length,
    canonicalArrivals: covered("canonical_arrival").length,
    postDebtArrivals: covered("post_debt_arrival").length,
    firstFailureChapters: covered("first_failure_chapter").length,
    laterFailureNights: covered("later_failure_night").length,
    laterFailureBosses: covered("later_failure_boss").length,
    laterFailureGates: covered("later_failure_gate").length,
    laterFailureNpcDeaths: covered("later_failure_npc_death").length,
    dawnOpenings: covered("dawn_opening").length,
    nightBriefings: covered("night_briefing").length,
    waveWarnings: waveEntries.length,
    nightClears: covered("night_clear").length,
    endingVariants: covered("campaign_ending").length,
    nightPrimaryConversations: covered("night_primary").length,
    goalDialogueSets,
  };
}

function goalScene(goal, goalState, trigger, priority, conditions, text) {
  return scene(
    `goal-${goal.id}-${goalState}`, trigger, priority, "dialogue",
    {activeNpcIds: [goal.npcId], ...conditions},
    goalState === "repeat" ? "repeatable" : "once_attempt",
    [line(goal.npcId, text, shotFor(goal.npcId), goalState === "offer" ? {
      responses: responses(
        [`detail-${goal.id}`, "Explain the requirement.", "practical"],
        [`understood-${goal.id}`, "I understand what you need.", "compassionate"],
      ),
    } : {})],
    {kind: "goal_dialogue", goalId: goal.id, goalState},
  );
}

function scene(id, trigger, priority, presentation, conditions, replay, beats, coverage, extra = {}) {
  const primaryKinds = new Set([
    "canonical_arrival", "post_debt_arrival", "recent_failure_conversation",
    "night_primary", "awareness",
  ]);
  const primaryNpcId = primaryKinds.has(coverage?.kind)
    ? coverage.npcId
    : coverage?.kind === "goal_dialogue" && coverage.goalState !== "repeat"
      ? NARRATIVE_CAST[beats[0]?.speakerId] ? beats[0].speakerId : undefined
      : undefined;
  return {
    id, trigger, priority, presentation, conditions, replay, beats, coverage,
    ...(primaryNpcId ? {primaryNpcId} : {}),
    ...extra,
  };
}

function line(speakerId, text, shotId = "speaker-close", options = {}) {
  return {
    speakerId,
    text,
    shotId,
    cueId: options.cueId ?? NARRATIVE_CAST[speakerId]?.cueId ?? "none",
    ...(options.responses ? {responses: options.responses} : {}),
    ...(options.conditions ? {conditions: options.conditions} : {}),
    ...(options.beatId ? {beatId: options.beatId} : {}),
    ...(options.exclusiveGroup ? {exclusiveGroup: options.exclusiveGroup} : {}),
    ...(Number.isSafeInteger(options.priority) ? {priority: options.priority} : {}),
    ...(typeof options.available === "boolean" ? {available: options.available} : {}),
  };
}

function responses(...values) {
  return values.map(([id, text, tag]) => ({id, text, tag}));
}

function shotFor(npcId) {
  if (npcId === TAMSIN) return "stores-medium";
  if (npcId === FEN) return "workbench-medium";
  if (npcId === EDDA) return "grove-medium";
  return "speaker-medium";
}

/** Return schema errors for one candidate scene. */
export function validateNarrativeScene(entry) {
  const errors = [];
  validateScene(entry, new Set(), errors);
  return errors;
}

function validateScene(entry, ids, errors) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    errors.push("scene must be an object");
    return;
  }
  const sceneKeys = new Set([
    "id", "trigger", "priority", "presentation", "conditions", "replay", "beats",
    "coverage", "primaryNpcId", "waveRecord", "fallback",
  ]);
  for (const key of Object.keys(entry)) if (!sceneKeys.has(key)) errors.push(`${entry.id ?? "scene"}: unknown scene field ${key}`);
  if (!stableId(entry.id)) errors.push(`invalid scene ID: ${String(entry.id)}`);
  if (ids.has(entry.id)) errors.push(`duplicate scene ID: ${entry.id}`);
  ids.add(entry.id);
  if (!NARRATIVE_TRIGGERS.includes(entry.trigger)) errors.push(`${entry.id}: unknown trigger`);
  if (!Number.isSafeInteger(entry.priority)) errors.push(`${entry.id}: priority must be an integer`);
  if (!NARRATIVE_PRESENTATIONS.includes(entry.presentation)) errors.push(`${entry.id}: unknown presentation`);
  if (!NARRATIVE_REPLAY_POLICIES.includes(entry.replay)) errors.push(`${entry.id}: unknown replay policy`);
  if (entry.primaryNpcId !== undefined && !HUB_NPC_UNLOCK_ORDER.includes(entry.primaryNpcId)) errors.push(`${entry.id}: unknown primary NPC`);
  if (entry.fallback !== undefined && typeof entry.fallback !== "boolean") errors.push(`${entry.id}: fallback must be boolean`);
  if (entry.coverage !== undefined && (!entry.coverage || typeof entry.coverage !== "object" || Array.isArray(entry.coverage))) {
    errors.push(`${entry.id}: coverage must be an object`);
  }
  if (entry.waveRecord !== undefined && (!entry.waveRecord || typeof entry.waveRecord !== "object" || Array.isArray(entry.waveRecord))) {
    errors.push(`${entry.id}: wave record must be an object`);
  }
  validateConditions(entry.conditions, `${entry.id}.conditions`, errors);
  if (!Array.isArray(entry.beats) || entry.beats.length === 0) {
    errors.push(`${entry.id}: at least one beat is required`);
    return;
  }
  for (const [index, beat] of entry.beats.entries()) {
    const path = `${entry.id}.beats.${index}`;
    if (!beat || typeof beat !== "object" || Array.isArray(beat)) {
      errors.push(`${path}: beat must be an object`);
      continue;
    }
    const beatKeys = new Set(["speakerId", "text", "shotId", "cueId", "responses", "conditions", "beatId", "exclusiveGroup", "priority", "available"]);
    for (const key of Object.keys(beat)) if (!beatKeys.has(key)) errors.push(`${path}: unknown beat field ${key}`);
    const unavailableFallback = entry.fallback === true
      && beat.speakerId === null
      && beat.available === false
      && beat.shotId === "first-person"
      && beat.cueId === "none";
    if (!HUB_NPC_UNLOCK_ORDER.includes(beat?.speakerId) && !unavailableFallback) errors.push(`${path}: unknown speaker`);
    if (typeof beat?.text !== "string" || beat.text.trim().length === 0) errors.push(`${path}: text is required`);
    if (!NARRATIVE_SHOT_IDS.includes(beat?.shotId)) errors.push(`${path}: unknown shot ID`);
    if (!NARRATIVE_AUDIO_CUE_IDS.includes(beat?.cueId)) errors.push(`${path}: unknown cue ID`);
    if (beat?.conditions !== undefined) validateConditions(beat.conditions, `${path}.conditions`, errors);
    if (beat?.beatId !== undefined && !stableId(beat.beatId)) errors.push(`${path}: invalid beat ID`);
    if (beat?.exclusiveGroup !== undefined && !stableId(beat.exclusiveGroup)) errors.push(`${path}: invalid exclusive group`);
    if (beat?.priority !== undefined && !Number.isSafeInteger(beat.priority)) errors.push(`${path}: beat priority must be an integer`);
    if (beat?.available !== undefined && typeof beat.available !== "boolean") errors.push(`${path}: available must be boolean`);
    if (beat?.responses !== undefined) {
      if (!Array.isArray(beat.responses) || beat.responses.length === 0 || beat.responses.length > 2) errors.push(`${path}: responses must contain one or two choices`);
      const responseIds = new Set();
      for (const response of beat.responses ?? []) {
        const responseKeys = response && typeof response === "object" && !Array.isArray(response)
          ? Object.keys(response)
          : [];
        if (responseKeys.some((key) => !["id", "text", "tag"].includes(key))
          || responseKeys.length !== 3
          || !stableId(response?.id)
          || typeof response?.text !== "string"
          || response.text.trim().length === 0
          || !NARRATIVE_RESPONSE_TAGS.includes(response?.tag)) {
          errors.push(`${path}: malformed response`);
        }
        if (responseIds.has(response?.id)) errors.push(`${path}: duplicate response ID`);
        responseIds.add(response?.id);
      }
    }
    if (entry.presentation === "bark" && beat?.responses?.length) errors.push(`${path}: bark cannot offer responses`);
  }
}

const CONDITION_KEYS = new Set([
  "night", "wave", "failedRuns", "activeNpcIds", "livingNpcIds", "lastFallenNpcIds", "queuedSceneId",
  "readyGoalId", "activeGoalId", "nextGoalId", "completedGoalIds", "goalHasProgress",
  "awareness", "lastFailureNight", "lastFailureBossId", "lastFailureReasonCode",
  "lastFailureWave", "deepestNight", "lastBreachedGateId", "relationshipStatus", "responseTags", "mode",
]);

const NPC_LIST_CONDITIONS = new Set(["activeNpcIds", "livingNpcIds", "lastFallenNpcIds"]);
const GOAL_ID_CONDITIONS = new Set(["readyGoalId", "activeGoalId", "nextGoalId"]);
const INTEGER_CONDITIONS = new Map([
  ["night", [1, 7]], ["wave", [1, 3]], ["lastFailureNight", [1, 7]],
  ["lastFailureWave", [1, 3]], ["deepestNight", [0, 7]],
]);
const GOAL_IDS = new Set(RELATIONSHIP_GOALS.map(({id}) => id));
const BOSS_IDS = new Set(Object.keys(BOSS_ENCOUNTERS));
const GATE_IDS = new Set(["west-outer-gate", "east-outer-gate"]);
const RELATIONSHIP_STATUS_IDS = new Set(["new", "known", "trusted", "bonded"]);

function validateConditions(value, path, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${path}: conditions must be an object`);
    return;
  }
  for (const [key, condition] of Object.entries(value)) {
    if (!CONDITION_KEYS.has(key)) {
      errors.push(`${path}: unknown condition ${key}`);
      continue;
    }
    if (INTEGER_CONDITIONS.has(key)) {
      const [min, max] = INTEGER_CONDITIONS.get(key);
      if (!Number.isSafeInteger(condition) || condition < min || condition > max) errors.push(`${path}.${key}: invalid integer condition`);
    } else if (key === "failedRuns") {
      validateNumberCondition(condition, `${path}.${key}`, errors);
    } else if (NPC_LIST_CONDITIONS.has(key)) {
      if (!Array.isArray(condition) || condition.length === 0 || condition.some((id) => !HUB_NPC_UNLOCK_ORDER.includes(id))) {
        errors.push(`${path}.${key}: condition list must contain known NPC IDs`);
      }
    } else if (key === "completedGoalIds") {
      if (!Array.isArray(condition) || condition.length === 0 || condition.some((id) => !GOAL_IDS.has(id))) errors.push(`${path}.${key}: unknown goal ID`);
    } else if (key === "responseTags") {
      if (!Array.isArray(condition) || condition.length === 0 || condition.some((tag) => !NARRATIVE_RESPONSE_TAGS.includes(tag))) errors.push(`${path}.${key}: unknown response tag`);
    } else if (key === "queuedSceneId") {
      if (!stableId(condition)) errors.push(`${path}.${key}: invalid scene ID`);
    } else if (GOAL_ID_CONDITIONS.has(key)) {
      if (!GOAL_IDS.has(condition)) errors.push(`${path}.${key}: unknown goal ID`);
    } else if (key === "goalHasProgress") {
      if (typeof condition !== "boolean") errors.push(`${path}.${key}: must be boolean`);
    } else if (key === "awareness") {
      if (!condition || typeof condition !== "object" || Array.isArray(condition)
        || !HUB_NPC_UNLOCK_ORDER.includes(condition.npcId)) {
        errors.push(`${path}.${key}: invalid awareness condition`);
      } else {
        const numeric = Object.fromEntries(Object.entries(condition).filter(([name]) => name !== "npcId"));
        if (Object.keys(condition).some((name) => !["npcId", "exact", "min", "max"].includes(name))) errors.push(`${path}.${key}: unknown awareness field`);
        validateNumberCondition(numeric, `${path}.${key}`, errors, 0, 3);
      }
    } else if (key === "lastFailureBossId") {
      if (!BOSS_IDS.has(condition)) errors.push(`${path}.${key}: unknown boss ID`);
    } else if (key === "lastFailureReasonCode") {
      if (!NARRATIVE_FAILURE_REASON_CODES.includes(condition)) errors.push(`${path}.${key}: unknown failure reason`);
    } else if (key === "lastBreachedGateId") {
      if (!GATE_IDS.has(condition)) errors.push(`${path}.${key}: unknown gate ID`);
    } else if (key === "relationshipStatus") {
      if (!RELATIONSHIP_STATUS_IDS.has(condition)) errors.push(`${path}.${key}: unknown relationship status`);
    } else if (key === "mode") {
      if (!["canonical", "echo"].includes(condition)) errors.push(`${path}.${key}: unknown mode`);
    }
  }
}

function validateNumberCondition(condition, path, errors, minValue = 0, maxValue = Number.MAX_SAFE_INTEGER) {
  if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
    errors.push(`${path}: number condition must be an object`);
    return;
  }
  const keys = Object.keys(condition);
  if (keys.length === 0 || keys.some((key) => !["exact", "min", "max"].includes(key))) {
    errors.push(`${path}: invalid number condition shape`);
    return;
  }
  for (const key of keys) {
    const number = condition[key];
    if (!Number.isSafeInteger(number) || number < minValue || number > maxValue) errors.push(`${path}.${key}: invalid number bound`);
  }
  if (Number.isSafeInteger(condition.min) && Number.isSafeInteger(condition.max) && condition.min > condition.max) {
    errors.push(`${path}: minimum exceeds maximum`);
  }
}

function stableId(value) {
  return typeof value === "string" && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

const laterFailureNightLines = [
  "Night 1 ended the attempt. Keep the first wave away from the gates so the later waves inherit less damage.",
  "Night 2 ended the attempt. Watch both approaches and move before one gate is left alone.",
  "Night 3 ended the attempt. Root-sappers need a clear shot before they settle against the wall.",
  "Night 4 ended the attempt. Kill the Sporewings when they peel away from the main line.",
  "Night 5 ended the attempt. Use sound and target markers when the Moonwraiths hide the crowd.",
  "Night 6 ended the attempt. Keep the road lanes open so the Caravan Eater cannot cover another push.",
  "You reached Night 7. Save movement space for the Hollow Hart and keep the Arbalest ready for Cinderwing.",
];

const bossFailureLines = {
  "wicker-colossus": "The Wicker Colossus reached the gate. Break its armour with steady Arbalest shots, then close with the knife only when its swing is spent.",
  "moss-crowned-matron": "The Moss-Crowned Matron ended the defence. Clear her escorts before you commit to the opening in her guard.",
  "root-sapper-prime": "Root-Sapper Prime was left to work. Interrupt the planted charges and keep shooting while it moves to the wall.",
  "ashwing-matriarch": "The Ashwing Matriarch stayed above your fire. Track her approach and shoot after the dive, when her path is straight.",
  "moonless-herald": "The Moonless Herald split your attention. Follow the marked target and clear nearby Moonwraiths before its next attack.",
  "caravan-eater": "The Caravan Eater controlled the road. Move across its path after the charge, then fire into the exposed side.",
  "hollow-hart": "The Hollow Hart held the courtyard. Avoid the planted zones and damage it during the pause after each advance.",
  cinderwing: "Cinderwing kept the air. Keep moving through the breath warning and use the Arbalest when it levels out.",
};

const dawnLines = [
  "First light. Walk both approaches and check the Heart Gate before you speak with me.",
  "Night 2 begins here. Check both outer gates and decide which approach gets your first attention.",
  "Night 3 will bring root-sappers. Leave yourself a firing lane to both outer gates.",
  "Night 4 adds heavier air attacks. Keep enough open ground to track targets above the wall.",
  "Night 5 will cut visibility. Set your route through the courtyard before the bell rings.",
  "Night 6 presses the road and both gates. Check their state and settle your loadout before you commit to the bell.",
  "This is the seventh day. Check every charge and supply now; there is no preparation break once the bell rings.",
];

const briefingLines = [
  "Three waves are coming from the west treeline. Use the Arbalest to thin the line, and use the knife when one gets inside your shot. The last wave brings Sporewings and a Wicker Colossus.",
  "Night 2 splits between the west and east approaches. The Arbalest and knife can hold either side. Move when one gate's pressure rises; the Moss-Crowned Matron comes with the third wave.",
  "Root-sappers join on Night 3. Shoot them before they plant charges. The Arbalest and knife remain enough if you keep a clear lane to each wall.",
  "Sporewings lead the pressure on Night 4. Track them with the Arbalest, then use the knife on enemies that reach the ground near you. The Ashwing Matriarch arrives last.",
  "Moonwraiths will hide parts of the Host tonight. Follow target markers and listen for attack cues. Keep the Arbalest working at range and the knife ready for anything that appears close.",
  "Night 6 brings the Caravan Eater down the road. Clear ordinary enemies with the Arbalest and knife before the boss controls the courtyard. Move across its charge after it passes.",
  "Every enemy type returns on Night 7. The Arbalest and knife still give you a complete route. The Hollow Hart controls the ground while Cinderwing attacks from above, so deal with the immediate attack before changing targets.",
];

const nightClearLines = [
  "Night 1 is clear. Check the gates in daylight before you decide what needs attention next.",
  "Night 2 is clear. Both approaches held, and we have time to prepare for root-sappers.",
  "Night 3 is clear. The planted charges are gone; the next attack will put more pressure in the air.",
  "Night 4 is clear. We held through the flyers, but Night 5 will make targets harder to see.",
  "Night 5 is clear. The Moonless Herald is down. The road becomes the main danger tomorrow.",
  "Night 6 is clear. One day remains. Check both gate states and choose your loadout before the final bell.",
  "Night 7 is clear. The bell has cracked, and the Briar Host is no longer advancing.",
];

const waveRecords = [
  waveRecord(1, 1, "Thorns at the Treeline", "Thin the first Briarbound surge before the West Gate.", "Briarbound are massing at the west treeline.", "First wave clear. Mixed armour is already moving in.", "Fire the Arbalest into the front rank before closing with the knife."),
  waveRecord(1, 2, "Roots Against the Wall", "Break the mixed shield line before it settles at the wall.", "Mossguards and Barkhides are joining the west push.", "Second wave clear. Sporewings and the Wicker Colossus are next.", "Move around shields and keep your shots on exposed targets."),
  waveRecord(1, 3, "Wings Over the Gate", "Bring down the Sporewings, then stop the Wicker Colossus.", "The final west assault has flyers above a Wicker Colossus.", "Third wave clear. The first night belongs to Briarhold.", "Shoot the flyers first, then use the Colossus recovery after each swing."),
  waveRecord(2, 1, "The Eastern Stirring", "Hold the first split attack at both outer gates.", "The Host is testing both approaches now.", "First wave clear. Shielded bodies are closing on both gates.", "Change sides before either gate is left without a clear firing lane."),
  waveRecord(2, 2, "Shields in the Rain", "Strip the shield line before it pins both gates.", "Mossguards and Barkhides are covering the second push.", "Second wave clear. The Moss-Crowned Matron is entering with escorts.", "Take exposed Briarbound first so the shield line loses its cover."),
  waveRecord(2, 3, "Crown Beneath the Moss", "Defeat the Moss-Crowned Matron after clearing her escorts.", "The Matron is advancing behind the last split company.", "Third wave clear. The Matron is down and Night 2 is secure.", "Wait for the Matron's guard to open instead of trading damage into it."),
  waveRecord(3, 1, "Charges in the Loam", "Kill the first root-sappers before they plant at a gate.", "Root-sappers are moving inside the ordinary line.", "First wave clear. More sappers are using the shield push.", "Keep one Arbalest shot ready when a sapper leaves the crowd."),
  waveRecord(3, 2, "The Wall Has Roots", "Protect the outer walls from planted charges.", "Barkhides are giving the sappers time to set charges.", "Second wave clear. Root-Sapper Prime is preparing the final assault.", "Step past the brute only when that gives you a clean sapper shot."),
  waveRecord(3, 3, "The Deep Fuse", "Interrupt Root-Sapper Prime and clear the remaining Host.", "Root-Sapper Prime is leading the final companies.", "Third wave clear. The walls are free of live charges.", "Damage the Prime while it travels, then interrupt any planted device."),
  waveRecord(4, 1, "Cinders on the Wind", "Remove the first Sporewing groups before the gates take pressure.", "Sporewings are crossing above a split ground attack.", "First wave clear. The next flyers have heavier ground cover.", "Track one flying target until it falls instead of spreading damage."),
  waveRecord(4, 2, "Burning Clearings", "Keep the air clear while root-sappers approach the walls.", "The second attack mixes flyers with shielded sappers.", "Second wave clear. The Ashwing Matriarch is circling for the last push.", "Shoot the sapper when it plants; return to the flyers once the charge is stopped."),
  waveRecord(4, 3, "Black Wings, Red Sky", "Defeat the Ashwing Matriarch and finish the split assault.", "The Matriarch is diving above the final companies.", "Third wave clear. The sky is empty and Night 4 is won.", "Dodge the dive first, then fire while the Matriarch climbs in a straight line."),
  waveRecord(5, 1, "No Moon Above", "Hold both gates while Moonwraiths obscure the first attack.", "Moonwraiths are hiding movement inside the split line.", "First wave clear. The next hidden group carries sappers.", "Use target markers and sound; do not chase a shape after it vanishes."),
  waveRecord(5, 2, "The Unseen Host", "Find the root-sappers inside the concealed assault.", "The hidden second push has sappers on both approaches.", "Second wave clear. The Moonless Herald is close enough to mark.", "Hold a central position until a sapper or gate warning gives you a side."),
  waveRecord(5, 3, "A Voice Without Shadow", "Defeat the Moonless Herald and its Moonwraith screen.", "The Herald is directing the final concealed companies.", "Third wave clear. The Herald's markers have gone quiet.", "Clear nearby Moonwraiths before committing to the Herald's exposed phase."),
  waveRecord(6, 1, "Wheels in the Dark", "Keep the road lanes open through the first heavy advance.", "Barkhides and sappers are pressing both road approaches.", "First wave clear. The second push is denser and closer to the gates.", "Move across the courtyard early instead of waiting for a gate alarm."),
  waveRecord(6, 2, "Hold the Road Open", "Break the mixed line before it closes the road exits.", "Every ordinary threat is joining the second road assault.", "Second wave clear. The Caravan Eater is coming behind the last companies.", "Create space with ranged kills before the boss takes the centre lane."),
  waveRecord(6, 3, "Hunger at the Axles", "Defeat the Caravan Eater without losing the gate lanes.", "The Caravan Eater is charging through the final road attack.", "Third wave clear. The road is open and the sixth night is over.", "Cross behind the charge, then shoot the boss's exposed side."),
  waveRecord(7, 1, "Every Root Advances", "Hold both approaches against the full ordinary Host.", "The whole ground line is advancing at once.", "First wave clear. Wicker bodies are joining the next assault.", "Protect movement space in the courtyard; do not let the line surround you."),
  waveRecord(7, 2, "The Forest Walks", "Stop the Wicker-backed assault before the final bosses arrive.", "Wicker Colossi are moving with pressure on both gates.", "Second wave clear. The Hollow Hart and Cinderwing are entering together.", "Finish isolated Wicker targets before their swings overlap at a gate."),
  waveRecord(7, 3, "Fire Over Briarhold", "Defeat the Hollow Hart and Cinderwing to end the siege.", "The Hollow Hart controls the ground while Cinderwing takes the air.", "Third wave clear. The seventh night is over and the bell has broken.", "Answer the boss currently attacking; use the safe pause to reacquire the other."),
];

function waveRecord(night, wave, title, objective, spokenBriefing, recoveryWarning, tacticalHint) {
  return {night, wave, title, objective, spokenBriefing, recoveryWarning, tacticalHint};
}

const primaryConversationLines = {
  [NELL]: [
    "I grew up in the bellhouse and inherited this post from my mother. I called the first defence too late, so now I give the warning before you commit.",
    "Both approaches are active tonight. Check the gate state before you cross the courtyard.",
    "Root-sappers punish late attention. If one plants, stop that charge before you return to the crowd.",
    "Flyers will pull your aim away from the walls. Use the gate warning to decide when to look down.",
    "When visibility drops, trust the target marker and attack cue. They report the same threat the host is using.",
    "The road attack builds quickly. Move before a second warning confirms what the first already told you.",
    "There is no separate plan for the last night. Keep each decision small and finish the threat in front of you.",
  ],
  [ORIN]: [
    "I built part of the west gate and left when the hold delayed the repairs. I won't pretend that was the wrong call.",
    "A brace saves supplies only if you use it on the next repair today. Once the bell rings, the chance is gone.",
    "Sapper damage spreads fast when a gate is already low. Repair the weaker outer gate before you add new work.",
    "Flying enemies don't change the masonry. Ground pressure still decides whether a gate stands.",
    "If you lose sight of the Host, use the gate numbers. Stone does not need to see what struck it.",
    "The road side will take repeated hits. Keep both outer gates above the point where one bad company can finish them.",
    "I can repair after daylight returns. During the last night, protect the integrity you start with.",
  ],
  [TAMSIN]: [
    "The council blamed me for missing stock. Fen knew the caravans had been diverted before they reached my stores.",
    "Count the stores before you spend. My daywork count adds eight Supplies once, and only for this night.",
    "Field medicine costs thirty Supplies and restores fifty Health once. Prepare it now if you expect to need it.",
    "The Sunfire is useful against groups, but an overheat costs you time. The Arbalest has no such reset to manage.",
    "Low visibility makes ammunition habits worse. Finish one target before you search for another marker.",
    "Do not save every resource for a cleaner fight that never comes. Use medicine before the next hit can finish you.",
    "This is the final stock count. Spend for the fight you have; nothing carries value if the Heart Gate falls.",
  ],
  [FEN]: [
    "I warned the hold about these routes before the siege. Tamsin paid attention, which kept more than one caravan alive.",
    "Place a trap on a route the line will cross. An enemy's current position may be beyond that path.",
    "Sappers choose a wall and commit. Put a snare on the approach, then keep your shot for the one that gets through.",
    "Flyers won't touch a ground trap. Place for the Host below and handle the air yourself.",
    "Moonwraiths hide bodies. Their approach still tells you where the next group is going.",
    "Prime the Line restores one depleted installed defence. Choose the one covering the route you cannot watch yourself.",
    "On the last night, traps buy attention. Use that time to answer whichever boss is attacking.",
  ],
  [EDDA]: [
    "I told Nell never to use the old bell. I stayed away because the boundary grove was already carrying its strain.",
    "A boon changes what you can endure. The enemy's behaviour stays the same, so keep your ordinary plan intact.",
    "The planted charges disturb the grove before they break stone. That warning still leaves you time to shoot the sapper.",
    "The flyers cross the old boundary at speed. Watch their attack path instead of the place where you first saw them.",
    "The Moonwraiths affect sight. They do not change which gate they are approaching.",
    "The root can preview the one boon offered after this night.",
    "There is no boon after Night 7. Reading the root today gives the counter hints for both final bosses instead.",
  ],
};

const awarenessLines = {
  [NELL]: [
    "I remember the first ringing and every return. Ask me about the last attempt, and I'll give you the facts I kept.",
  ],
  [ORIN]: [
    "I'm here because Nell asked and because these gates still carry my work. This is my first defence here.",
    "My hands keep finding old repairs before I inspect them. I cannot explain it, so I won't ignore it.",
    "I remember the sound of the last breach now. It matches what Nell described.",
    "I know the returns are real. Give me the last damage pattern and I'll compare it with the attempts I remember.",
  ],
  [TAMSIN]: [
    "Nell gave me figures from an attempt I did not witness. I'll treat them as a useful forecast, nothing more.",
    "I wrote a stock total before counting. The total was right, and I don't know where I learned it.",
    "I remember closing the stores during the last breach. This morning they were still locked from my own habit.",
    "I remember the attempts now. My ledger can separate what changed from what merely happened again.",
  ],
  [FEN]: [
    "The tracks outside point toward a battle that has not happened. I can read the route without claiming I remember it.",
    "I knew where the first line would turn before I found the track. That has never happened to me before.",
    "I remember setting the last trap on this route even though the ground carries no sign of it.",
    "The loop is real. I can compare the Host's route across attempts and tell you what stayed the same.",
  ],
  [EDDA]: [
    "I know what the bell can do because I studied the binding. I have no memory of an attempt before I arrived.",
    "The grove repeated a change I only saw yesterday. I recognize it now, though the battle itself is unclear.",
    "I remember where the roots tightened during the last failure. Nell's account matches the part I saw.",
    "I remember the attempts I have lived through. The binding ends only when one watch holds all seven nights.",
  ],
};

const serviceRepeatLines = {
  [NELL]: "I can repeat the current warning or take your bell confirmation when you're ready.",
  [ORIN]: "Show me the gate you want repaired. If you set the brace today, the next repair costs six Supplies instead of twelve.",
  [TAMSIN]: "The stores are open. Field medicine costs thirty Supplies and gives one fifty-Health use for this night.",
  [FEN]: "I can help with installed defences. Prime the Line needs one depleted target and works once today.",
  [EDDA]: "I can show the next boon when one follows this night. On Night 7, I can give you the final boss hints instead.",
};

const goalDialogue = {
  "nell-briefing": goalCopy(
    "Listen to the full briefing, then clear all three waves tonight. Progress resets at the next night. Report back to open Bellkeeper's Watch rank 1.",
    "The briefing must be completed before the bell. Then clear the night's three waves.",
    "Briefing progress: {{current}} of {{target}} qualifying night. Finish all three waves before this night ends.",
    "You used the warning and cleared the night. Come back to me in daylight.",
    "The warnings helped you make decisions. Bellkeeper's Watch rank 1 is now available at its Oathmark cost.",
    "Use the briefing before the bell; it can reveal threats without deciding your loadout.",
  ),
  "nell-outer-gates": goalCopy(
    "Complete one night without either outer gate breaching. The check resets each night. Report it to open Bellkeeper's Watch rank 2.",
    "Keep both outer gates from breaching for one complete night.",
    "Gate progress: {{current}} of {{target}} qualifying night. Keep both outer gates intact through the third wave.",
    "Neither outer gate breached. Report the result in daylight.",
    "You kept both approaches sealed. Bellkeeper's Watch rank 2 is now available at its Oathmark cost.",
    "A night counts only if both outer gates remain unbreached through Wave 3.",
  ),
  "nell-all-survive": goalCopy(
    "On Night 5 or later, finish the night with every NPC who began it still alive. The check resets each night. Report it to open Bellkeeper's Watch rank 3.",
    "Reach the end of Night 5 or later without losing anyone who started that night.",
    "Survival progress: {{current}} of {{target}} qualifying night. Keep every NPC who began it alive through the remaining waves.",
    "You brought the starting cast through a late night. Report it in daylight.",
    "Everyone came through. Bellkeeper's Watch rank 3 is now available at its Oathmark cost.",
    "Night 5 or later qualifies when every NPC present at the bell survives.",
  ),
  "orin-repair-600": goalCopy(
    "Restore six hundred total gate integrity after accepting this. Progress carries across attempts. Report it to open Mason's Oath rank 1.",
    "Keep repairing until the total restored integrity reaches six hundred.",
    "You've restored {{current}} of {{target}} total gate integrity. This progress carries across attempts.",
    "You've restored six hundred integrity. Bring me the final repair count.",
    "The work held. Mason's Oath rank 1 is now available at its Oathmark cost.",
    "Repairs after acceptance add to the six-hundred total across attempts.",
  ),
  "orin-gates-half": goalCopy(
    "Finish one night with both outer gates above half integrity. The check resets each night. Report it to open Mason's Oath ranks 2 and 3.",
    "Both outer gates must be above fifty percent when the third wave ends.",
    "Gate condition: {{current}} of {{target}} qualifying night. Both outer gates must finish above half integrity.",
    "Both outer gates finished above half integrity. Report the night to me.",
    "You left no weak side. Mason's Oath ranks 2 and 3 are now available at their Oathmark costs.",
    "The goal checks both outer gates after Wave 3 and resets on a new night.",
  ),
  "orin-heart-strong": goalCopy(
    "On Night 4 or later, finish with the Heart Gate at seventy-five percent or more and neither outer gate destroyed. The check resets each night.",
    "Protect the Heart Gate above seventy-five percent and keep both outer gates standing on Night 4 or later.",
    "Heart Gate condition: {{current}} of {{target}} qualifying night. Keep it at seventy-five percent or more and both outer gates standing.",
    "The Heart Gate stayed strong and both outer gates stand. Report the result.",
    "You protected the whole structure. Mason's Oath ranks 4 and 5 are now available at their Oathmark costs.",
    "A qualifying late night needs seventy-five percent Heart Gate integrity and no destroyed outer gate.",
  ),
  "tamsin-knife-21": goalCopy(
    "One Warden must make twenty-one knife kills in a row without taking damage. A damage hit, a non-knife kill by that Warden, or the run ending resets their streak. Co-op streaks do not combine. Report it to open our first ranks and the Sunfire commission.",
    "Keep one Warden's knife streak going. Damage, another weapon's kill, or the run ending resets that Warden to zero.",
    "Knife streak: {{current}} of {{target}} for one Warden. Damage, another weapon's kill, or the run ending resets it.",
    "One Warden completed all twenty-one knife kills without damage. Report the streak to me.",
    "Close work, cleanly done. Armory Temper and Quartermaster rank 1 are open, and the Sunfire commission is available at its existing Oathmark cost.",
    "Twenty-one same-Warden knife kills qualify. Damage, a non-knife kill, or the run ending resets that actor's streak.",
  ),
  "tamsin-sunfire-40": goalCopy(
    "Make forty Sunfire kills in one night without overheating it. An overheat resets that night's count. Report it to open ranks 2 and 3 and the Runebolt commission.",
    "Forty Sunfire kills must fit inside one night, and overheating resets the count to zero.",
    "Sunfire count: {{current}} of {{target}} this night. An overheat resets the count.",
    "You reached forty Sunfire kills without an overheat. Bring me the weapon record.",
    "The heat control is proven. Armory Temper and Quartermaster ranks 2 and 3 are open, and the Runebolt commission is available at its existing prerequisite and Oathmark cost.",
    "The count is forty Sunfire kills in one night with no overheat reset.",
  ),
  "tamsin-full-rack": goalCopy(
    "In one night, make fifteen kills each with the Arbalest, Sunfire, and Runebolt, plus one knife kill. Both commissioned weapons must already be owned. The counts reset next night.",
    "Use every owned weapon in one night: fifteen kills for each ranged weapon and at least one with the knife.",
    "Full-rack count: {{current}} of {{target}} required kills this night. Each ranged weapon needs fifteen and the knife needs one.",
    "The full rack met its counts in one night. Report the record to me.",
    "You proved the full loadout. Armory Temper and Quartermaster ranks 4 and 5 are now available at their Oathmark costs.",
    "The goal needs fifteen kills with each ranged weapon and one knife kill in the same night.",
  ),
  "fen-snare-21": goalCopy(
    "Catch twenty-one different enemies in Thorn snares during one night. Repeat catches on the same enemy do not add. Report it to open Field Craft rank 1 and the Sunfire pot recipe.",
    "Place snares across the route until twenty-one distinct enemies have been caught this night.",
    "Distinct snare targets: {{current}} of {{target}} this night. Repeat catches on one enemy do not add.",
    "Twenty-one different enemies crossed your snares. Report the placements to me.",
    "The first line worked. Field Craft rank 1 is open, and you now know the Sunfire pot recipe.",
    "Only distinct snare targets count, and the total resets on a new night.",
  ),
  "fen-firepot-12": goalCopy(
    "Kill at least twelve enemies with one Sunfire pot detonation. Separate pots do not combine. Report it to open Field Craft ranks 2 and 3 and the ballista recipe.",
    "One Sunfire pot blast must account for twelve kills by itself.",
    "Best single Sunfire pot detonation: {{current}} of {{target}} kills. Separate blasts do not combine.",
    "One pot took twelve enemies. Bring me the detonation count.",
    "That placement did enough work. Field Craft ranks 2 and 3 are open, and you now know the ballista recipe.",
    "Twelve kills from one Sunfire pot detonation qualify; combined blasts do not.",
  ),
  "fen-defence-50": goalCopy(
    "Finish one night with fifty kills credited to installed fortifications. The count resets next night. Report it to open Field Craft ranks 4 and 5.",
    "Installed fortifications need fifty credited kills before this night ends.",
    "Installed-fortification kills: {{current}} of {{target}} this night. The count resets next night.",
    "Installed defences reached fifty kills this night. Report the result.",
    "The line worked without constant handling. Field Craft ranks 4 and 5 are now available at their Oathmark costs.",
    "The goal counts fifty fortification-attributed kills in one night.",
  ),
  "edda-boon-night": goalCopy(
    "Complete a night while at least one boon is active. The check resets each night. Report it to open Warden's Vigor rank 1.",
    "Carry an active boon through all three waves and finish the night.",
    "Boon-night progress: {{current}} of {{target}} qualifying night. Complete all three waves with a boon active.",
    "You completed the night with a boon active. Report what it changed for you.",
    "The boon carried through. Warden's Vigor rank 1 is now available at its Oathmark cost.",
    "Any active boon qualifies when the night is completed.",
  ),
  "edda-all-survive": goalCopy(
    "Complete one night with a boon active and every NPC who began it still alive. The check resets each night. Report it to open Warden's Vigor ranks 2 and 3.",
    "Keep the boon active and bring every NPC present at the bell through the night.",
    "Boon survival progress: {{current}} of {{target}} qualifying night. Keep every NPC who began it alive through the remaining waves.",
    "The whole starting cast survived with a boon active. Report the night to me.",
    "The protection held across the group. Warden's Vigor ranks 2 and 3 are now available at their Oathmark costs.",
    "A qualifying night needs an active boon and every NPC who started it alive at the end.",
  ),
  "edda-end-debt": goalCopy(
    "Reach the seventh dawn with me active and alive. A qualifying Echo Night 7 also counts after the debt is broken. The result stays latched until earlier goals are reported.",
    "Hold through Night 7 while I remain active and alive. The ending records the result automatically.",
    "Seventh-dawn progress: {{current}} of {{target}} qualifying ending. Earlier goal reports do not erase a latched result.",
    "The debt ended while I was present. If the earlier reports are complete, this is ready now.",
    "The binding is gone and the result is recorded. Warden's Vigor ranks 4 and 5 are now available at their Oathmark costs.",
    "Canonical or Echo Night 7 qualifies when I am active and alive at the seventh dawn.",
  ),
};

const failureFiveFactBeats = [
  ...Object.values(BOSS_ENCOUNTERS).map((boss) => line(
    NELL,
    `${boss.title} ended the last defence. We plan around that encounter first.`,
    "speaker-close",
    {beatId: `failure-five-boss-${boss.id}`, exclusiveGroup: "failure-five-fact", priority: 500, conditions: {lastFailureBossId: boss.id}},
  )),
  ...HUB_NPC_UNLOCK_ORDER.map((npcId) => line(
    NELL,
    `${NARRATIVE_CAST[npcId].name} fell during the last defence. We account for that loss in today's plan.`,
    "speaker-close",
    {beatId: `failure-five-fallen-${npcId}`, exclusiveGroup: "failure-five-fact", priority: 450, conditions: {lastFallenNpcIds: [npcId]}},
  )),
  line(NELL, "The west outer gate was breached in the last defence. We reinforce that approach first.", "speaker-close", {
    beatId: "failure-five-gate-west", exclusiveGroup: "failure-five-fact", priority: 400, conditions: {lastBreachedGateId: "west-outer-gate"},
  }),
  line(NELL, "The east outer gate was breached in the last defence. We reinforce that approach first.", "speaker-close", {
    beatId: "failure-five-gate-east", exclusiveGroup: "failure-five-fact", priority: 400, conditions: {lastBreachedGateId: "east-outer-gate"},
  }),
  ...[
    ["warden_fallen", "You fell before the defence ended. Keep a clear retreat to the courtyard."],
    ["player_died", "You were killed before the defence ended. Leave room to retreat and use medicine while it is available."],
    ["heart_gate_fallen", "The Heart Gate fell in the last defence. We need an earlier retreat from the outer line."],
    ["bellkeeper_fallen", "I fell at the bell platform. Keep enemies away from it after an outer breach."],
  ].map(([reasonCode, text]) => line(NELL, text, "speaker-close", {
    beatId: `failure-five-reason-${reasonCode.replaceAll("_", "-")}`,
    exclusiveGroup: "failure-five-fact",
    priority: 300,
    conditions: {lastFailureReasonCode: reasonCode},
  })),
  ...Array.from({length: 7}, (_, index) => line(
    NELL,
    `The last defence reached Night ${index + 1}. We prepare for that night again.`,
    "speaker-close",
    {beatId: `failure-five-night-${index + 1}`, exclusiveGroup: "failure-five-fact", priority: 200, conditions: {lastFailureNight: index + 1}},
  )),
  ...Array.from({length: 3}, (_, index) => line(
    NELL,
    `The last defence ended in Wave ${index + 1}. We adjust the plan before that point.`,
    "speaker-close",
    {beatId: `failure-five-wave-${index + 1}`, exclusiveGroup: "failure-five-fact", priority: 100, conditions: {lastFailureWave: index + 1}},
  )),
];

const endingGoalLines = {
  "nell-briefing": "You used my warning and made your own decisions from it.",
  "nell-outer-gates": "You proved both approaches could hold through a complete night.",
  "nell-all-survive": "You showed me how to bring a full starting watch through a late night.",
  "orin-repair-600": "Your record shows six hundred points restored across the attempts. You learned where the work mattered.",
  "orin-gates-half": "You proved you could finish a night with both outer gates above half integrity.",
  "orin-heart-strong": "You completed Night 4 or later with the Heart Gate at seventy-five percent or more and neither outer gate destroyed.",
  "tamsin-knife-21": "That knife record will stay in the final ledger.",
  "tamsin-sunfire-40": "You proved the Sunfire could be managed through a full count.",
  "tamsin-full-rack": "You gave every weapon on the rack a place in the defence.",
  "fen-snare-21": "Your snare line caught twenty-one distinct enemies in one night.",
  "fen-firepot-12": "That twelve-kill detonation showed exactly where one pot could matter.",
  "fen-defence-50": "The installed defences earned fifty kills while the watch held elsewhere.",
  "edda-boon-night": "You completed a night with a boon active. We have that result recorded.",
  "edda-all-survive": "A boon was active when every NPC who began that night survived.",
  "edda-end-debt": "You reached the seventh dawn while I was here to see the binding end.",
};

const endingRelationshipBeats = RELATIONSHIP_GOALS.map((goal, index) => line(
  goal.npcId,
  endingGoalLines[goal.id],
  shotFor(goal.npcId),
  {
    beatId: `ending-goal-${goal.id}`,
    exclusiveGroup: "ending-relationship",
    priority: ((index % 3) + 1) * 100,
    conditions: {completedGoalIds: [goal.id], livingNpcIds: [goal.npcId]},
  },
));

function goalCopy(offer, reminder, progress, ready, report, repeat) {
  return {offer, reminder, progress, ready, report, repeat};
}

export const NARRATIVE_CATALOGUE = deepFreeze([
  ...buildCoreScenes(),
  ...buildPrimaryScenes(),
  ...buildAwarenessScenes(),
  ...buildServiceScenes(),
  ...buildGoalScenes(),
]);
