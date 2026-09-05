import {
  TOUCH_AIM_ASSIST_OCCLUSION_BUDGET,
  TOUCH_AUTO_FIRE_CONE_DEGREES,
  TOUCH_AUTO_FIRE_SCAN_INTERVAL,
  applyTouchAimAssist,
  rankTouchAimAssistCandidateIds,
  reticleClampedTargetHeight,
  resolveTouchAutomaticFire,
  selectFirstVisibleTouchAimAssistTarget,
  touchAutomaticFireAvailable,
  touchAutomaticFireDirection,
} from "./aim-assist.js";
import {installTouchDragScroll} from "./touch-scroll.js";
import {createAudioSystem} from "./audio.js";
import {CoopMovementPreview} from "./coop-preview.js";
import {createCoopBoundaryPauseScopes, startWithCoopBoundaryPause} from "./coop-boundary-pause.js";
import {coerceCoopActionRejectionCode} from "./coop-world-wire.js";
import {
  CoopSemanticEventCursor,
  advanceCoopCampaignRecovery,
  canAdvanceCampaignRecoveryLocally,
  applyCoopNarrativeSessionAction,
  commitStagedCoopCheckpoint,
  coopNarrativeBeatKey,
  createCoopPersistenceBoundary,
  createCoopBossSnapshot,
  createCoopCampaignCheckpoint,
  createCoopCampaignRestart,
  createCoopCampaignRun,
  createCoopCrowdPresentation,
  createCoopNarrativeAuthorityState,
  projectCoopNarrativeGuestState,
  projectCoopCheckpointRun,
  hideCoopGuestNarrative,
  resolveCoopGuestNarrativePresentation,
  resolveCoopContextIntent,
  resolveGuestCoopContextIntent,
  resolveCoopTerminalResultAction,
  resolveCoopWardenDownState,
  shouldPublishCoopAuthorityPhase,
  stageCoopCheckpointApplication,
  validateCoopNpcActionContext,
  validateCoopNpcInteractionAuthority,
  validateCoopNarrativeMutation,
  validateCoopWardLightContext,
} from "./coop-campaign-authority.js";
import {createCombatGoalEvents, resolveAuthoritativeCombatEvent} from "./authoritative-combat.js";
import {
  applyAuthoritativeDelayedKillProgression,
  applyAuthoritativeDelayedBossKillProgression,
  createAuthoritativeDelayedEffectQueue,
  delayedArmourMultiplierForTarget,
  resolveDueAuthoritativeDelayedEffects,
  restoreAuthoritativeDelayedEffects,
  scheduleAuthoritativeDelayedEffect,
  snapshotAuthoritativeDelayedEffects,
} from "./authoritative-delayed-effects.js";
import {applySessionManualVent, applySessionWeaponHeatRefund} from "./multiplayer-session-core.js";
import {firstMapRayHit} from "./map-raycast.js";
import {
  BRIARHOLD_SIGNALING_URL,
  SignalingConnection,
  createSignalingRoom,
  formatRoomCode,
  fetchOptionalSignalingIceConfig,
  normalizeRoomCode,
} from "./signaling-client.js";
import {
  ACTIVE,
  DEAD,
  DYING,
  EAST,
  WEST,
  createBattlefield,
  isPlayerExposedToApproachHorde,
} from "./battlefield.js";
import {calculateRunBoonEffects, createBoonOffer} from "./boons.js";
import {applyUiIcon} from "./ui-art.js";
import {renderProgressionAtlas, selectProgressionNode} from "./progression-atlas.js";
import {
  beginSoloCampaignWave,
  advanceInterwaveRecovery,
  bellkeeperBriefingSceneId,
  chooseSoloCampaignBoon,
  completeSoloCampaignWave,
  confirmSoloBell,
  describeBuildSocketContext,
  prepareSoloCampaignDaytime,
  resolveGuestBuildContextIntent,
  updateSoloBossEncounter,
} from "./campaign-runtime.js";
import {
  createCutscenePresentation,
  createGoalsPresentation,
  createRecoveryPresentation,
} from "./cutscene-presentation.js";
import {
  applyDayworkAction,
  consumeDayworkBenefit,
  consumeFieldMedicine,
  prepareFieldMedicine,
} from "./daywork.js";
import {
  bossRayHit,
  bossesInRadius,
  bossesInViewCone,
  buildBossPresentationSnapshot,
  collectBossDamageContacts,
  createBossProceduralAdapter,
  selectBossTouchAimAssistTarget,
} from "./boss-presentation.js";
import {
  HIT_FEEDBACK,
  createShotFeedbackSummary,
  playerDamagePresentation,
  recordShotFeedback,
  resolveProjectileRayHit,
  shotFeedbackPresentation,
} from "./combat-feedback.js";
import {
  appendCombatAttribution,
  recentCombatAttribution,
} from "./combat-attribution.js";
import {BRIARHOLD_VERSION, GAME_PHASES, INPUT_SOURCES, PLAYER_DEFAULTS} from "./contracts.js";
import {
  OATHMARK_UNLOCKS,
  missingOathmarkUnlockRequirement,
} from "./economy.js";
import {
  renderPixelBudgetForDevice,
  resolveRenderPixelBudget,
} from "./core/render-pixel-budget.js";
import {
  CONTROLLER_MAPPING_STORAGE_KEY,
  builtInControllerMapping,
  controllerActionLabel,
  controllerMappingForPad,
  controllerMappingKey,
  controllerReportMappingKey,
  controllerMappingStep,
  createControllerMappingSession,
  createControllerMappingStore,
  removeControllerMapping,
  saveControllerMapping,
  serialiseControllerMappings,
  updateControllerMappingSession,
} from "./controller-mapping.js";
import {
  createControllerProfileCapture,
  submitControllerProfileCapture,
} from "./controller-profile-capture.js";
import {
  CONTROLLER_UI_SCOPES,
  controllerBackNavigates,
  controllerInputSourceForPresence,
  spatialControllerIndex,
  resolveControllerUiScope,
} from "./controller-ui.js";
import {resolveDensityProfile} from "./density-profile.js";
import {
  enemy3dFastHardware,
  enemyPresentationAvailability,
  normaliseEnemyPresentation,
  resolveEnemyPresentation,
  sporewingTargetProfileAtGate,
} from "./enemy-presentation.js";
import {MOSSGUARD_SHIELD, SPOREWING, WICKER_COLOSSUS, enemyArchetype, enemyArmour, enemyTypeFrom} from "./enemies.js";
import {
  FORTIFICATION_DEFINITIONS,
  createFortificationGoalEvents,
  consumeRunFortificationCharge,
  nearestFirePotRayHit,
  routeShiftAwayFromSocket,
} from "./fortifications.js";
import {createGamepadCalibration, readGamepadInput, selectConnectedGamepad} from "./gamepad-input.js";
import {
  FRAME_RATE_LIMIT,
  GRAPHICS_QUALITY,
  graphicsQualityUsesGovernor,
  graphicsResolutionLabel,
  graphicsScaleForQuality,
  normaliseFrameRateLimit,
  normaliseGraphicsQuality,
} from "./graphics-quality.js";
import {
  EMPTY_INPUT_FRAME,
  createInputFrame,
  keyboardCodeClaimsDesktopInput,
  resolveFrameInputSource,
} from "./input-frame.js";
import {lookSensitivityMultiplier, normaliseLookSensitivity} from "./look-settings.js";
import {freshProfileAfterSaveDeletion} from "./new-game.js";
import {
  HUB_FEATURE_IDS,
  HUB_NPC_IDS,
  applyHubArrivals,
  isHubServiceAvailable,
  markHubNpcFallen,
  setHubFeatureState,
} from "./hub.js";
import {
  applyHubCombatAttacks,
  courtyardEnemiesFromBattlefield,
  createHubCombatState,
  damageHubDefender,
  hubDefenderAggroTargets,
  serialiseHubCombatState,
  updateHubCombat,
} from "./hub-combat.js";
import {createHubNpcPresentation, hubNpcVisibilityForPhase} from "./hub-npc-presentation.js";
import {clearBossHudPresentation} from "./boss-hud.js";
import {
  isDesktopMouseCaptureGesture,
  requestGameplayPointerLock,
  shouldCaptureGameplayMouse,
} from "./mouse-capture.js";
import {
  BRIARHOLD_ENEMY_GROUND_OBSTACLES,
  BRIARHOLD_FIRST_PERSON_MAP,
  HOST_EMERGENCE_PROFILE,
  sampleWalkableGround,
} from "./map-definition.js";
import {buildCampaignWaveRoster, getCampaignWave} from "./campaign-content.js";
import {CAMPAIGN_COOP_MODIFIERS} from "./campaign-content.js";
import {WEAPON_HEAT_SCALE, createNetworkPlayerState} from "./multiplayer-contracts.js";
import {
  GAME_BACK_ACTIONS,
  installNativeLifecycle,
  resolveGameBackAction,
} from "./native-lifecycle.js";
import {
  advanceNarrativeScene,
  chooseNarrativeResponse,
  resolveQueuedArrivalScene,
  resumeNarrativeScene,
  selectNarrativeScene,
  skipNarrativeScene,
  startNarrativeScene,
} from "./narrative-director.js";
import {NARRATIVE_CAST} from "./narrative-content.js";
import {
  checkForAndroidUpdate,
  isUpdateSnoozed,
  openTrustedUpdateUrl,
  snoozeUpdate,
} from "./android-update-check.js";
import {
  createPlayerState,
  damagePlayer,
  isPlayerBelowNavigationBounds,
  resolvePlayerCrowdContact,
  updatePlayerController,
} from "./player-controller.js";
import {applyOathHallAction, createOathHallModel} from "./oath-hall.js";
import {
  activateNightCombatTriggers,
  advanceNightRuntimeTimers,
  applyCampaignBossWeaponKillEffects,
  applyCampaignWeaponKillEffects,
  campaignBossWeaponEnemyId,
  consumeTwinThornsSoloRevive,
  prepareNightRuntimeState,
  runtimeProgressionTuning,
  waveProgressionIntel,
} from "./runtime-progression.js";
import {
  capturePlaytestScreenshot,
  createPlaytestReporter,
  createPlaytestTurnstileTokenProvider,
  nearestCollisionVolumes,
  nearestHubPoints,
} from "./playtest-reporter.js";
import {
  GAME_PHASES as PROGRESSION_PHASES,
  PERMANENT_RANK_TRACKS,
  RANK_TRACK_IDS,
  applyProgressionEvent,
  baseRunGates,
  calculatePermanentBonuses,
  calculateProgressionEffects,
  createProfileState,
  createEchoRun,
  createRunState,
  grantWeaponXp,
  purchasePermanentRank,
  resolveRunLoadoutCacheKey,
  resolveRunLoadout,
  settleTerminalRun,
  transferPendingNarrativeSequence,
} from "./progression.js";
import {
  acceptRelationshipGoal,
  applyRelationshipGoalEvent,
  createRelationshipGoalModel,
  reportRelationshipGoal,
} from "./relationship-goals.js";
import {
  createFramePacer,
  createRenderGovernor,
  graphicsInfoForEngine,
  isSoftwareGraphics,
  maximumRenderScale,
  resetFramePacer,
  setFramePacerTarget,
  shouldPresentFrame,
  updateRenderGovernor,
} from "./render-governor.js";
import {createEnemyRenderer, resolveRendererProfile} from "./renderer.js";
import {createSaveAdapter} from "./save.js";
import {installDebugDiagnostics} from "./debug-diagnostics.js";
import {
  KNIFE_MELEE,
  RUNEBOLT_SPLASH_DAMAGE_MULTIPLIER,
  WEAPON_DEFINITIONS,
  WEAPON_IDS,
  consumeKnifeMeleeContact,
  createKnifeMeleeState,
  createWeaponState,
  knifeDamageAgainst,
  knifeMeleeActionActive,
  knifeMeleeScanDue,
  rankKnifeMeleeCandidateIds,
  selectWeapon,
  tryKnifeMelee,
  tryManualVent,
  tryFireWeapon,
  updateWeaponHeat,
  weaponDamageAgainst,
} from "./weapons.js";
import {createWorld, resolveRenderedViewmodelMuzzle, VIEWMODEL_MUZZLES} from "./world.js";

function activateFirePot(socketId, source = "manual") {
  const socket = world?.sockets?.find(item => item.id === socketId);
  const placement = run?.fortifications?.find(item => item.socketId === socketId && item.type === "firePot");
  if (!socket || !placement || !battlefield) return false;
  const charge = consumeRunFortificationCharge(run.fortifications, socketId);
  if (!charge.consumed) return false;

  run = {...run, fortifications: charge.placements};
  world.triggerFortification(socketId, {active: false});
  const definition = FORTIFICATION_DEFINITIONS.firePot;
  const hits = battlefield.damageInRadius({
    x: socket.x,
    z: socket.z,
    radius: definition.radius,
    maxResults: 80,
  }, definition.damage);
  for (const result of hits) recordEnemyDamage(`fortification:${socketId}`, result.id, result);
  for (const event of createFortificationGoalEvents({
    eventId: fortificationActivationId("firepot", socketId),
    fortificationId: "firePot",
    socketId,
    targets: hits.map(result => ({enemyId: result.id, killed: result.killed})),
  })) applyGoalFact(event);
  killsThisRun += hits.filter(item => item.killed).length;
  for (const actorId of bossesInRadius(run?.bossEncounter, {
    x: socket.x,
    z: socket.z,
    radius: definition.radius,
  })) {
    damageBossActor(actorId, definition.damage, "fortification", {armourMultiplier: 1, stagger: 90});
    applyBossDirectorUpdate({commands: [{
      id: nextBossCommandId("fortification-interrupt", actorId),
      type: "fortification_interrupt",
      actorId,
      socketId,
      stagger: 90,
    }]});
  }
  audio.impact(true);
  if (source === "manual") announce("Sunfire pot released");
  persistRun();
  return true;
}

const BABYLON = globalThis.BABYLON;
if (!BABYLON) throw new Error("Babylon.js failed to load");

const byId = (id) => document.getElementById(id);
const canvas = byId("renderCanvas");
const ui = {
  loading: byId("loading"), rotate: byId("rotateDevice"), combatHud: byId("combatHud"),
  menu: byId("mainMenu"), continueButton: byId("continueButton"), continueSummary: byId("continueSummary"),
  continueRunText: byId("continueRunText"), newRunButton: byId("newRunButton"),
  newRunWarning: byId("newRunWarning"),
  oathHallButton: byId("oathHallButton"), oathHallPanel: byId("oathHallPanel"),
  oathHallClose: byId("oathHallCloseButton"), oathHallStatus: byId("oathHallStatus"),
  oathHallSections: byId("oathHallSections"), oathHallTabs: byId("oathHallTabs"),
  ledgerOathmarks: byId("ledgerOathmarks"), ledgerRuns: byId("ledgerRuns"),
  ledgerRoster: byId("ledgerRoster"), ledgerNext: byId("ledgerNext"),
  coopButton: byId("coopButton"), coopPanel: byId("coopPanel"), coopHost: byId("coopHostButton"),
  coopJoin: byId("coopJoinButton"), coopRoomCode: byId("coopRoomCode"), coopRoomCopy: byId("coopRoomCopyButton"),
  coopManualHost: byId("coopManualHostButton"), coopManualJoin: byId("coopManualJoinButton"),
  coopSignalText: byId("coopSignalText"), coopSignal: byId("coopSignalButton"),
  coopCopy: byId("coopCopyButton"), coopStatus: byId("coopStatus"), coopClose: byId("coopCloseButton"),
  coopManualToggle: document.querySelector("#coopPanel summary"),
  howButton: byId("howToPlayButton"), howPanel: byId("howToPlayPanel"), howClose: byId("howToPlayCloseButton"),
  settingsButton: byId("settingsButton"), settingsPanel: byId("settingsPanel"), settingsClose: byId("settingsCloseButton"),
  menuSecondary: byId("menuSecondary"), pauseSettingsButton: byId("pauseSettingsButton"), pauseSettingsMount: byId("pauseSettingsMount"),
  volume: byId("volumeControl"), lookSensitivity: byId("lookSensitivityControl"),
  invertVerticalLook: byId("invertVerticalLookToggle"),
  aimAssist: byId("aimAssistControl"), reducedMotion: byId("reducedMotionToggle"), autoMelee: byId("autoMeleeToggle"),
  autoFire: byId("autoFireToggle"), frameRateLimit: byId("frameRateLimitControl"),
  graphicsQuality: byId("graphicsQualityControl"), graphicsResolutionStatus: byId("graphicsResolutionStatus"),
  enemyPresentation: byId("enemyPresentationControl"), enemyPresentationStatus: byId("enemyPresentationStatus"),
  controllerMappingStart: byId("controllerMappingStartButton"), controllerMappingReset: byId("controllerMappingResetButton"),
  controllerMappingStatus: byId("controllerMappingStatus"), controllerMappingOverlay: byId("controllerMappingOverlay"),
  controllerMappingPrompt: byId("controllerMappingPrompt"), controllerMappingProgress: byId("controllerMappingProgress"),
  controllerMappingCancel: byId("controllerMappingCancelButton"),
  pauseButton: byId("pauseButton"), leaveCoopButton: byId("leaveCoopButton"), pauseOverlay: byId("pauseOverlay"), resumeButton: byId("resumeButton"),
  playtestReportOpen: byId("playtestReportButton"), playtestReportOverlay: byId("playtestReportOverlay"),
  playtestReportPreview: byId("playtestReportPreview"), playtestReportStatus: byId("playtestReportStatus"),
  playtestReportNote: byId("playtestReportNote"), playtestReportCategory: byId("playtestReportCategory"),
  playtestReportImpact: byId("playtestReportImpact"), playtestReportCancel: byId("playtestReportCancel"),
  playtestReportRetake: byId("playtestReportRetake"), playtestReportSave: byId("playtestReportSave"),
  playtestReportRemoteOptions: byId("playtestReportRemoteOptions"),
  playtestReportScreenshotConsent: byId("playtestReportScreenshotConsent"),
  playtestReportDiagnosticsConsent: byId("playtestReportDiagnosticsConsent"),
  playtestReportTurnstile: byId("playtestReportTurnstile"),
  quitConfirmOverlay: byId("quitConfirmOverlay"), quitCancel: byId("quitCancelButton"), quitConfirm: byId("quitConfirmButton"),
  deleteSave: byId("deleteSaveButton"), deleteSaveOverlay: byId("deleteSaveConfirmOverlay"),
  deleteSaveCancel: byId("deleteSaveCancelButton"), deleteSaveConfirm: byId("deleteSaveConfirmButton"),
  deleteSaveStatus: byId("deleteSaveStatus"),
  updateOverlay: byId("updateOverlay"), updateTitle: byId("updateTitle"), updateVersion: byId("updateVersion"),
  updateNotes: byId("updateNotes"), updateLater: byId("updateLaterButton"), updateNow: byId("updateNowButton"),
  quitButton: byId("quitToMenuButton"), buildPanel: byId("buildPanel"), buildTitle: byId("buildTitle"),
  buildPanelToggle: byId("buildPanelToggle"), buildPanelDetails: byId("buildPanelDetails"),
  buildBriefing: byId("buildBriefing"), wardenOrder: byId("wardenOrder"), buildChoices: byId("buildChoices"), buildChoiceButtons: [...document.querySelectorAll("[data-fortification]")],
  socketName: byId("socketName"), goalsOpen: byId("goalsOpenButton"), supplies: byId("suppliesText"),
  hubServicePanel: byId("hubServicePanel"), hubServiceTitle: byId("hubServiceTitle"),
  hubServiceLine: byId("hubServiceLine"), hubServiceStatus: byId("hubServiceStatus"),
  hubServiceCost: byId("hubServiceCost"), hubServiceClose: byId("hubServiceCloseButton"),
  hubServiceActions: [...document.querySelectorAll("#hubServiceActions [data-hub-action]")],
  playerHealthText: byId("playerHealthText"), playerHealthBar: byId("playerHealthBar"),
  heartHealthText: byId("heartHealthText"), heartHealthBar: byId("heartHealthBar"), outerHealthText: byId("outerHealthText"), outerHealthBar: byId("outerHealthBar"), eastOuterHealthText: byId("eastOuterHealthText"), eastOuterHealthBar: byId("eastOuterHealthBar"),
  nightText: byId("nightText"), waveText: byId("waveText"), objectiveText: byId("objectiveText"), enemyCountText: byId("enemyCountText"),
  bossStatus: byId("bossStatus"), bossName: byId("bossName"), bossHealthText: byId("bossHealthText"), bossHealthBar: byId("bossHealthBar"),
  bossIndividuals: byId("bossIndividuals"), bossCounterText: byId("bossCounterText"),
  weaponButtons: [...document.querySelectorAll("[data-weapon]")], weaponCue: byId("weaponCue"), weaponName: byId("weaponName"),
  heatText: byId("heatText"), heatBar: byId("heatBar"), viewmodel: byId("viewmodel"), viewmodelArt: byId("viewmodelArt"), knifeViewmodel: byId("knifeViewmodel"),
  contextPrompt: byId("contextPrompt"), contextPromptText: byId("contextPromptText"),
  contextKey: byId("contextPrompt")?.querySelector("kbd"), controlsHelp: byId("controlsHelp"),
  announcement: byId("announcement"), hitMarker: byId("hitMarker"), damageFlash: byId("damageFlash"),
  movePad: byId("movePad"), moveKnob: byId("moveKnob"), lookSurface: byId("lookSurface"),
  fireButton: byId("fireButton"), aimButton: byId("aimButton"), contextButton: byId("contextButton"),
  jumpButton: byId("jumpButton"), slideButton: byId("slideButton"), meleeButton: byId("meleeButton"),
  boonOverlay: byId("boonOverlay"), boonChoices: byId("boonChoices"),
  narrativeContinue: byId("narrativeContinue"), narrativeSkip: byId("narrativeSkip"), narrativePortrait: byId("narrativePortrait"),
  narrativeResponses: [byId("narrativeResponsePrimary"), byId("narrativeResponseSecondary")],
  goalsClose: byId("goalsClose"),
  resultOverlay: byId("resultOverlay"), resultKicker: byId("resultKicker"), resultTitle: byId("resultTitle"),
  resultMessage: byId("resultMessage"), resultKills: byId("resultKillsText"), resultOathmarks: byId("resultOathmarksText"),
  resultHeart: byId("resultHeartText"), resultContinue: byId("resultContinueButton"),
};

installTouchDragScroll(ui.settingsPanel);

const search = new URLSearchParams(location.search);
const TEST_MODE = search.has("test");
const MULTIPLAYER_PREVIEW = search.has("multiplayerPreview");
const TEST_BODY_CAP = Math.max(8, Math.min(6000, Number(search.get("bodies")) || 180));
const coarsePointer = search.has("touch") || matchMedia("(pointer: coarse)").matches;
const reducedMotionMedia = matchMedia("(prefers-reduced-motion: reduce)");
const compactBuildPanelMedia = matchMedia("(pointer: coarse) and (orientation: landscape), (orientation: landscape) and (max-width: 900px)");
const PREVIEW_MODE = search.get("crowd") === "preview";
const PREVIEW_BODY_CAP = coarsePointer ? 80 : 120;
const ANDROID_UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
let pendingAndroidUpdate = null;
let pendingUpdateRestoreFocus = null;
let androidUpdateCheckPromise = null;
let lastAndroidUpdateCheckAt = Number.NEGATIVE_INFINITY;
const rendererProfile = resolveRendererProfile({
  coarse: coarsePointer,
  width: innerWidth,
  query: search.get("density") || "",
});
const densityProfile = resolveDensityProfile(rendererProfile.key);
const CLOSED_PLAYER_COLLISION_OPTIONS = Object.freeze({});
const WEST_GATE_PLAYER_COLLISIONS = new Set(["west-portcullis"]);
const EAST_GATE_PLAYER_COLLISIONS = new Set(["east-gate"]);
const BOTH_OUTER_GATE_PLAYER_COLLISIONS = new Set(["west-portcullis", "east-gate"]);
const WEST_GATE_OPEN_COLLISION_OPTIONS = Object.freeze({disabledCollisionIds: WEST_GATE_PLAYER_COLLISIONS});
const EAST_GATE_OPEN_COLLISION_OPTIONS = Object.freeze({disabledCollisionIds: EAST_GATE_PLAYER_COLLISIONS});
const BOTH_OUTER_GATES_OPEN_COLLISION_OPTIONS = Object.freeze({disabledCollisionIds: BOTH_OUTER_GATE_PLAYER_COLLISIONS});

function playerGateCollisionOptions(currentBattlefield) {
  const westOpen = Boolean(currentBattlefield?.outerGateBreached?.[WEST]);
  const eastOpen = Boolean(currentBattlefield?.outerGateBreached?.[EAST]);
  if (westOpen && eastOpen) return BOTH_OUTER_GATES_OPEN_COLLISION_OPTIONS;
  if (westOpen) return WEST_GATE_OPEN_COLLISION_OPTIONS;
  if (eastOpen) return EAST_GATE_OPEN_COLLISION_OPTIONS;
  return CLOSED_PLAYER_COLLISION_OPTIONS;
}

function budgetedGraphicsScale(requestedScale, graphicsQuality) {
  const maxCanvasPixels = renderPixelBudgetForDevice({
    coarse: coarsePointer,
    graphicsQuality,
  });
  return resolveRenderPixelBudget({
    cssWidth: innerWidth,
    cssHeight: innerHeight,
    requestedDownscale: requestedScale,
    maxCanvasPixels,
  }).hardwareScalingLevel;
}

const antialias = !PREVIEW_MODE && !coarsePointer;
const engine = new BABYLON.Engine(canvas, antialias, {
  preserveDrawingBuffer: false,
  stencil: true,
  adaptToDeviceRatio: true,
  powerPreference: "high-performance",
}, true);
const requestedBaseHardwareScale = graphicsScaleForQuality(GRAPHICS_QUALITY.AUTO, {
  coarse: coarsePointer,
  devicePixelRatio,
});
const baseHardwareScale = budgetedGraphicsScale(requestedBaseHardwareScale, GRAPHICS_QUALITY.AUTO);
const graphicsInfo = graphicsInfoForEngine(engine);
const softwareGraphics = isSoftwareGraphics(graphicsInfo);
const fastEnemy3dHardware = enemy3dFastHardware(graphicsInfo.renderer);
const renderGovernor = createRenderGovernor({
  baseScale: baseHardwareScale,
  maxScale: maximumRenderScale({coarse: coarsePointer, software: softwareGraphics}),
  software: softwareGraphics,
  enabled: !search.has("noAdaptiveResolution"),
  targetFps: 60,
});
engine.setHardwareScalingLevel(renderGovernor.scale);
// Automated smoke pages still exercise the exact 2K/6K sprite and simulation
// paths, but use the mobile world dressing so software WebGL does not spend
// minutes rasterising decorative forest geometry.
const world = createWorld(BABYLON, engine, canvas, {
  lowSpec: PREVIEW_MODE || (TEST_MODE && !search.has("fullWorld")) || softwareGraphics,
  mobileTextures: coarsePointer,
});
const bossPresentationAdapter = createBossProceduralAdapter({
  BABYLON,
  scene: world.scene,
  runtimeAssets: {enabled: true},
});
const audio = createAudioSystem(window);
installDebugDiagnostics();
const save = createSaveAdapter();

let profile = createProfileState();
let run = null;
let player = createPlayerState();
let battlefield = null;
let enemyRenderer = null;
let currentRoster = null;
let phase = GAME_PHASES.MENU;
let paused = false;
let resumePhase = null;
let playtestReporter = null;
let weapon = createWeaponState();
let knife = createKnifeMeleeState();
let multiplayerPreview = null;
let multiplayerPreviewError = null;
let coopPreview = null;
let lastCoopEndedReason = null;
let lastCoopDropBudget = null;
const coopAuthorityPauseScopes = createCoopBoundaryPauseScopes();
let lifecycleCoopPauseToken = null;
let coopSignaling = null;
let coopSignalingEventChain = Promise.resolve();
const pendingCoopIceCandidates = new Map();
let coopSignalStep = null;
let coopPersistenceBoundary = null;
let coopIssueCaptureOpen = false;
let coopPresentationEnemyIds = new Map();
let coopPresentationRendererPromise = null;
let lastCoopCombatResolution = null;
let coopSemanticEventSequence = 0;
let coopSemanticEvents = [];
let coopGuestEventCursor = new CoopSemanticEventCursor();
let coopSettlementState = null;
let coopTerminalRun = null;
let hubNpcPresentation = null;
let hubNpcPresentationPromise = null;
let hubNpcPresentationError = null;
let hubNpcPresentationGeneration = 0;
let hubCombatState = null;
let nextHubPressureAt = 0;
let activeHubStation = null;
let activeHubActions = [];
let wavePreparationPending = false;
let narrativeSession = null;
let narrativeServiceStation = null;
let narrativeSpeakerId = HUB_NPC_IDS.BELLKEEPER;
let narrativeAuthorityRun = null;
let narrativeContinuation = null;
let narrativeAutomatic = false;
let guestHiddenNarrativeBeat = null;
const narrativeArrivalAttempts = new Set();
const CAMPAIGN_ENDING_SCENE_IDS = new Set([
  "campaign-ending-zero-failures",
  "campaign-ending-one-to-four",
  "campaign-ending-five-plus",
  "echo-campaign-ending",
]);
let pendingTerminalTransition = null;
let lastFrameAt = performance.now() / 1000;
const framePacer = createFramePacer({targetFps: coarsePointer ? 60 : 0, startAt: lastFrameAt});
let presentedFrame = 0;
let currentInputSource = coarsePointer ? INPUT_SOURCES.TOUCH : INPUT_SOURCES.MOUSE;
let graphicsQuality = GRAPHICS_QUALITY.AUTO;
let frameRateLimit = normaliseFrameRateLimit(null, {coarse: coarsePointer});
let enemyPresentation = 'auto';
let enemyPresentationResolution = resolveEnemyPresentation(enemyPresentation, {
  coarse: coarsePointer,
  software: softwareGraphics,
  graphicsQuality,
  fastHardware: fastEnemy3dHardware,
});
let selectedSocket = null;
let touchBuildSheetSocketId = null;
let interactPressed = false;
let pausePressed = false;
let weaponPressed = null;
let meleePressed = false;
let mouseFire = false;
let mouseAim = false;
let touchFire = false;
let touchAim = false;
let adsActive = false;
let touchJumpPressed = false;
let touchSlidePressed = false;
let nextTouchAutoFireScanAt = 0;
let cachedTouchAutoFireTarget = null;
let lookYaw = 0;
let lookPitch = 0;
let lookSensitivityScale = 1;
let invertVerticalLook = false;
let nextFootstepAt = 0;
let activeGamepadIndex = null;
let controllerPresent = false;
let previousGamepadButtons = {interact: false, pause: false};
let gamepadCalibration = createGamepadCalibration();
let latestGamepadInput = null;
let controllerMappings = (() => {
  try { return createControllerMappingStore(localStorage.getItem(CONTROLLER_MAPPING_STORAGE_KEY)); }
  catch { return createControllerMappingStore(); }
})();
let controllerMappingSession = null;
let controllerMappingPadIndex = null;
let controllerMappingReleaseGate = false;
let reportControllerReleaseGate = false;
let cachedControllerMappingKey = null;
let cachedControllerMapping = null;
let lastControllerAction = null;
const submittedControllerProfileKeys = new Set();
let fallbackLookPointer = null;
let fallbackLookLast = null;
let hadPointerLock = false;
let pointerLockFallbackAnnounced = false;
let mouseHoverFallback = false;
const mouseCaptureDiagnostics = {requests: 0, locks: 0, errors: 0, dragFallbacks: 0};
let killsThisRun = 0;
let combatAttribution = [];
let newRunArmed = false;
const frameMonitor = {
  samples: [],
  medianFps: 0,
  onePercentLowFps: 0,
  hitchCount: 0,
  lastFrameMs: 0,
  simulationMs: 0,
  rendererUpdateMs: 0,
  sceneRenderMs: 0,
};

const narrativePresentation = createCutscenePresentation({
  capturePose: () => ({
    position: {x: world.camera.position.x, y: world.camera.position.y, z: world.camera.position.z},
    rotation: {x: world.camera.rotation.x, y: world.camera.rotation.y, z: world.camera.rotation.z},
    fov: world.camera.fov,
  }),
  applyView: (view) => {
    const station = BRIARHOLD_FIRST_PERSON_MAP.hubStations.find(item => item.kind === narrativeSpeakerId)
      ?? BRIARHOLD_FIRST_PERSON_MAP.hubStations.find(item => item.kind === HUB_NPC_IDS.BELLKEEPER);
    if (!station || !view?.movesCamera) return;
    const [offsetX, offsetY, offsetZ] = view.offset ?? [0, 0, 0];
    world.camera.position.set(
      station.position.x + offsetX,
      station.position.y + offsetY,
      station.position.z + offsetZ,
    );
    world.camera.setTarget(new BABYLON.Vector3(
      station.position.x,
      station.position.y + 1.45,
      station.position.z,
    ));
    world.camera.computeWorldMatrix(true);
  },
  restorePose: (pose) => {
    if (!pose) return;
    world.camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    world.camera.rotation.set(pose.rotation.x, pose.rotation.y, pose.rotation.z);
    world.camera.fov = pose.fov;
    world.camera.computeWorldMatrix(true);
  },
  captureLocalState: () => ({adsActive, mouseAim, touchAim}),
  restoreLocalState: (state) => {
    adsActive = state?.adsActive === true;
    mouseAim = state?.mouseAim === true;
    touchAim = state?.touchAim === true;
  },
  playCue: cueId => audio.narrativeCue(cueId),
  onResult: handleNarrativePresentationResult,
});
const goalsPresentation = createGoalsPresentation({documentTarget: document});
const recoveryPresentation = createRecoveryPresentation({documentTarget: document});

function goalAuthorityState() {
  return {
    relationships: profile.relationships,
    profileNarrative: profile.narrative,
    runNarrative: run?.narrative,
  };
}

function commitGoalAuthority(state) {
  profile = {...profile, relationships: state.relationships, narrative: state.profileNarrative};
  if (run) run = {...run, narrative: state.runNarrative};
  invalidateRunLoadoutCache();
  return state;
}

function applyGoalFact(event, {
  saveNow = false,
  autoReportEnding = false,
  relationshipPhase = phase,
} = {}) {
  if (!run || coopPreview?.role === "guest") return false;
  commitGoalAuthority(applyRelationshipGoalEvent(goalAuthorityState(), event, {
    role: "host",
    autoReportEnding,
    phase: relationshipPhase,
  }));
  if (saveNow) persistRun();
  return true;
}

function goalEventId(kind, suffix = "event") {
  return `run-${run?.runOrdinal ?? 1}-night-${run?.night ?? 1}-wave-${(run?.wave ?? 0) + 1}-${kind}-${suffix}`
    .toLowerCase().replace(/[^a-z0-9-]+/gu, "-").slice(0, 128).replace(/-+$/u, "");
}

function fortificationActivationId(kind, socketId) {
  return goalEventId(kind, socketId);
}

function relationshipModelFor(npcId) {
  return createRelationshipGoalModel(goalAuthorityState(), npcId, {profile});
}

function narrativeContextFor(npcId, {trigger, serviceRequested = false} = {}) {
  const goal = relationshipModelFor(npcId);
  return {
    ...(trigger ? {trigger} : {}),
    npcId,
    serviceRequested,
    night: run.night,
    wave: run.wave,
    run,
    profile,
    profileNarrative: profile.narrative,
    runNarrative: run.narrative,
    relationships: profile.relationships,
    readyGoalId: goal.ready?.id ?? null,
    activeGoalId: goal.active?.id ?? null,
    nextGoalId: goal.offer?.id ?? null,
    relationshipStatus: goal.status,
    goalHasProgress: Number(goal.active?.progress?.current ?? 0) > 0,
    goalProgressById: Object.fromEntries([goal.active, goal.ready, goal.offer]
      .filter(Boolean).map(item => [item.id, item.progress])),
  };
}

function persistNarrativeSession(session) {
  const sourceRun = run ?? narrativeAuthorityRun;
  if (!sourceRun) return;
  const nextRun = {...sourceRun, narrative: {
    ...sourceRun.narrative,
    activeScene: session?.completed ? null : {sceneId: session.sceneId, beatIndex: session.beatIndex},
  }};
  if (run) {
    run = nextRun;
    persistRun();
  } else {
    narrativeAuthorityRun = nextRun;
    if (coopTerminalRun?.runOrdinal === nextRun.runOrdinal) {
      coopTerminalRun = {...coopTerminalRun, narrative: structuredClone(nextRun.narrative)};
    }
  }
}

function automaticNarrativeContext(trigger, sourceRun = run, sourceProfile = profile) {
  return {
    trigger,
    night: sourceRun?.night ?? 1,
    wave: sourceRun?.wave ?? 0,
    run: sourceRun,
    profile: sourceProfile,
    profileNarrative: sourceProfile.narrative,
    runNarrative: sourceRun?.narrative ?? {mode: "canonical", completedSceneIds: [], pendingSceneIds: []},
    relationships: sourceProfile.relationships,
  };
}

function runNarrativeContinuation() {
  const continuation = narrativeContinuation;
  narrativeContinuation = null;
  narrativeAuthorityRun = null;
  narrativeAutomatic = false;
  continuation?.();
}

function startAutomaticNarrative(trigger, sourceRun, sourceProfile, continuation, selectedScene = null) {
  const context = automaticNarrativeContext(trigger, sourceRun, sourceProfile);
  try {
    const scene = selectedScene ?? selectNarrativeScene(context);
    if (!scene) {
      continuation?.();
      return false;
    }
    narrativeAuthorityRun = sourceRun;
    narrativeContinuation = continuation;
    narrativeAutomatic = true;
    narrativeSession = startNarrativeScene(scene, context);
    narrativeServiceStation = null;
    return presentNarrativeBeat();
  } catch (error) {
    console.warn(`[Briarhold] Automatic ${trigger} narrative fell back safely`, error);
    continuation?.();
    return false;
  }
}

function finishNarrativeSession(session) {
  const effects = session.effects ?? {seenSceneIds: [], completedSceneIds: [], responseTags: []};
  profile = {...profile, narrative: {
    ...profile.narrative,
    seenSceneIds: [...new Set([...profile.narrative.seenSceneIds, ...effects.seenSceneIds])],
    responseTags: [...new Set([...profile.narrative.responseTags, ...effects.responseTags])],
  }};
  const effectsRun = run ?? narrativeAuthorityRun;
  const pendingSceneId = session.sceneId.startsWith("post-debt-arrival-")
    ? `arrival-${session.sceneId.slice("post-debt-arrival-".length)}`
    : session.sceneId.startsWith("arrival-") ? session.sceneId : null;
  const nextNarrative = effectsRun ? {
    ...effectsRun.narrative,
    completedSceneIds: [...new Set([...effectsRun.narrative.completedSceneIds, ...effects.completedSceneIds])],
    pendingSceneIds: (effectsRun.narrative.pendingSceneIds ?? []).filter(id => (
      id !== pendingSceneId && !(session.trigger === "day_begin" && id.startsWith("failure-"))
    )),
    activeScene: null,
  } : null;
  if (run && nextNarrative) run = {...run, narrative: nextNarrative};
  else if (effectsRun && nextNarrative) {
    narrativeAuthorityRun = {...effectsRun, narrative: nextNarrative};
    if (coopTerminalRun?.runOrdinal === effectsRun.runOrdinal) {
      coopTerminalRun = {...coopTerminalRun, narrative: structuredClone(nextNarrative)};
    }
  }
  if (run && session.sceneId === bellkeeperBriefingSceneId(run.night)) {
    applyGoalFact({
      type: "briefing-reviewed",
      eventId: `run-${run.runOrdinal}-night-${run.night}-briefing-reviewed`,
      complete: true,
    });
  }
  const station = narrativeServiceStation;
  narrativeSession = null;
  narrativeServiceStation = null;
  if (run) persistRun();
  else reportSaveResult(save.saveState(profile, null));
  if (station && phase === GAME_PHASES.DAYTIME) openHubService(station, {narrativeChecked: true});
  runNarrativeContinuation();
}

function presentNarrativeBeat() {
  const beat = narrativeSession?.beat;
  if (!beat || narrativeSession.completed) {
    if (narrativeSession) finishNarrativeSession(narrativeSession);
    return false;
  }
  narrativeSpeakerId = beat.speakerId ?? HUB_NPC_IDS.BELLKEEPER;
  const cast = NARRATIVE_CAST[narrativeSpeakerId] ?? NARRATIVE_CAST[HUB_NPC_IDS.BELLKEEPER];
  persistNarrativeSession(narrativeSession);
  narrativePresentation.begin({
    sceneId: narrativeSession.sceneId,
    beatId: beat.beatId ?? `${narrativeSession.sceneId}-beat-${narrativeSession.beatIndex}`,
    shotId: beat.shotId,
    cueId: beat.cueId,
    speaker: cast.name,
    role: cast.role,
    portraitId: cast.roleId,
    text: beat.text,
    responses: coopPreview?.role === "guest" && coopPreview.connected ? [] : beat.responses ?? [],
    waitingForHost: coopPreview?.role === "guest" && coopPreview.connected,
    continueLabel: coopPreview?.role === "guest" && coopPreview.connected ? "Hide" : "Continue",
    skipLabel: coopPreview?.role === "guest" && coopPreview.connected ? "Hide" : "Skip",
    reducedMotion: Boolean(ui.reducedMotion?.checked || reducedMotionMedia.matches),
  });
  return true;
}

function handleNarrativePresentationResult(result) {
  if (!narrativeSession) return;
  if (coopPreview?.role === "guest" && coopPreview.connected) {
    guestHiddenNarrativeBeat = hideCoopGuestNarrative(narrativeSession).hiddenBeatKey;
    narrativeSession = null;
    narrativeServiceStation = null;
    announce("Waiting for host · use Context to reopen the shared scene");
    return;
  }
  try {
    if (coopPreview?.role === "host" && coopPreview.connected) {
      const action = result.kind === "response" ? "scene_response"
        : result.kind === "complete" ? "scene_advance" : "scene_skip";
      narrativeSession = applyCoopNarrativeSessionAction({
        request: {action, payload: {
          sceneId: narrativeSession.sceneId,
          beatIndex: narrativeSession.beatIndex,
          ...(action === "scene_response" ? {responseId: result.responseId} : {}),
          runOrdinal: run.runOrdinal,
          night: run.night,
        }},
        requesterRole: "host",
        run,
        session: narrativeSession,
      });
    } else if (result.kind === "response") {
      narrativeSession = chooseNarrativeResponse(narrativeSession, result.responseId);
      narrativeSession = advanceNarrativeScene(narrativeSession);
    } else if (result.kind === "complete") {
      narrativeSession = advanceNarrativeScene(narrativeSession);
    } else if (result.kind === "skip" || (coopPreview?.role === "host" && coopPreview.connected)) {
      narrativeSession = skipNarrativeScene(narrativeSession);
    } else if (narrativeAutomatic) {
      narrativeSession = skipNarrativeScene(narrativeSession);
    } else {
      if (run) run = {...run, narrative: {...run.narrative, activeScene: null}};
      narrativeSession = null;
      narrativeServiceStation = null;
      persistRun();
      return;
    }
    presentNarrativeBeat();
  } catch (error) {
    console.warn("[Briarhold] Narrative scene fell back safely", error);
    if (run) run = {...run, narrative: {...run.narrative, activeScene: null}};
    else if (narrativeAuthorityRun) {
      narrativeAuthorityRun = {
        ...narrativeAuthorityRun,
        narrative: {...narrativeAuthorityRun.narrative, activeScene: null},
      };
      if (coopTerminalRun?.runOrdinal === narrativeAuthorityRun.runOrdinal) {
        coopTerminalRun = {...coopTerminalRun, narrative: structuredClone(narrativeAuthorityRun.narrative)};
      }
    }
    narrativeSession = null;
    narrativeServiceStation = null;
    if (run) persistRun();
    else reportSaveResult(save.saveState(profile, null));
    runNarrativeContinuation();
  }
}

function continueQueuedArrivalNarrative() {
  queueMicrotask(startQueuedArrivalNarrative);
}

function startQueuedArrivalNarrative() {
  while (run?.narrative?.pendingSceneIds?.some(id => id.startsWith("arrival-"))) {
    const resolution = resolveQueuedArrivalScene(automaticNarrativeContext("npc_arrival", run, profile));
    if (!resolution.pendingSceneId || resolution.status === "empty") return false;
    const attemptKey = `${run.runOrdinal}:${run.narrative.mode}:${resolution.pendingSceneId}`;
    if (narrativeArrivalAttempts.has(attemptKey)) return false;
    narrativeArrivalAttempts.add(attemptKey);
    if (resolution.status === "blocked") return false;
    if (resolution.status === "consume") {
      run = {...run, narrative: {...run.narrative,
        pendingSceneIds: run.narrative.pendingSceneIds.filter(id => id !== resolution.pendingSceneId),
      }};
      persistRun();
      continue;
    }
    return startAutomaticNarrative(
      "npc_arrival", run, profile, continueQueuedArrivalNarrative, resolution.scene,
    );
  }
  return false;
}

function startDawnNarrativeFlow() {
  if (!run || phase !== GAME_PHASES.DAYTIME) return false;
  return startAutomaticNarrative("day_begin", run, profile, continueQueuedArrivalNarrative);
}

function startDaytimeNarrativeFlow() {
  if (!run || phase !== GAME_PHASES.DAYTIME) return false;
  return startAutomaticNarrative("profile_intro", run, profile, startDawnNarrativeFlow);
}

function interactWithNpc(station) {
  if (phase !== GAME_PHASES.DAYTIME || !station || !run) return false;
  const briefingId = bellkeeperBriefingSceneId(run.night);
  const briefingRequired = station.kind === HUB_NPC_IDS.BELLKEEPER
    && !run.narrative.completedSceneIds.includes(briefingId);
  const context = narrativeContextFor(station.kind, {
    trigger: briefingRequired ? "bell_briefing" : undefined,
    serviceRequested: true,
  });
  const scene = selectNarrativeScene(context);
  if (!scene) return openHubService(station, {narrativeChecked: true});
  try {
    narrativeSession = startNarrativeScene(scene, context);
    narrativeServiceStation = station;
    return presentNarrativeBeat();
  } catch (error) {
    console.warn("[Briarhold] Narrative selection failed safely", error);
    return openHubService(station, {narrativeChecked: true});
  }
}

function goalsDisplayModels() {
  return (run?.hub?.activeNpcs ?? []).map(npcId => {
    const model = relationshipModelFor(npcId);
    const goal = model.ready ?? model.active;
    if (!goal) return null;
    const reward = Object.entries(goal.reward?.rankCeilings ?? {})
      .map(([track, rank]) => `${track} ${rank}`).join(", ") || "Relationship access";
    return {
      npcId,
      npcName: NARRATIVE_CAST[npcId]?.name ?? npcId,
      title: goal.title,
      current: goal.progress.current,
      target: goal.progress.target,
      reset: goal.resetRule,
      reward,
      ready: Boolean(model.ready),
    };
  }).filter(Boolean);
}

function previewRemoteWardenState(tick) {
  const seconds = tick / 30;
  const angularSpeed = 0.46;
  const angle = seconds * angularSpeed;
  const x = -16 + Math.sin(angle) * 1.6;
  // Keep the avatar three metres beyond the first-person camera at start,
  // inside the overlook's collision-backed central firing gap.
  const z = 20.35 + Math.cos(angle) * 0.45;
  const vx = Math.cos(angle) * 1.6 * angularSpeed;
  const vz = -Math.sin(angle) * 0.45 * angularSpeed;
  return Object.freeze({
    playerId: "preview-warden",
    position: Object.freeze({x, y: 3.5, z}),
    velocity: Object.freeze({x: vx, y: 0, z: vz}),
    facing: Object.freeze({yaw: Math.atan2(vx, vz), pitch: 0}),
    traversal: "grounded",
    grounded: true,
    eyeHeight: PLAYER_DEFAULTS.eyeHeight,
    hp: 100,
    maxHp: 100,
    activeWeapon: 0,
    heat: Object.freeze([0, 0, 0]),
    healAvailable: true,
    damageCooldown: 0,
    sprinting: false,
    animationState: "walk",
    animationStartedTick: 0,
    lastProcessedCommand: tick,
  });
}

async function initializeMultiplayerPreview() {
  if (!MULTIPLAYER_PREVIEW || multiplayerPreview) return;
  try {
    const {createRemoteWardenAvatar, loadRemoteWardenTemplate} = await import("./remote-warden.js");
    const template = await loadRemoteWardenTemplate({BABYLON, scene: world.scene});
    const avatar = createRemoteWardenAvatar({template, playerId: "preview-warden", useTemplateInstance: true});
    avatar.push(0, previewRemoteWardenState(0));
    multiplayerPreview = {avatar, serverTick: 0, nextSnapshotTick: 3};
  } catch (error) {
    multiplayerPreviewError = String(error?.message || error);
    console.error("Remote Warden preview failed", error);
  }
}

function updateMultiplayerPreview(dt) {
  if (!multiplayerPreview) return;
  multiplayerPreview.serverTick += Math.max(0, dt) * 30;
  const currentTick = Math.floor(multiplayerPreview.serverTick);
  while (multiplayerPreview.nextSnapshotTick <= currentTick) {
    const tick = multiplayerPreview.nextSnapshotTick;
    multiplayerPreview.avatar.push(tick, previewRemoteWardenState(tick));
    multiplayerPreview.nextSnapshotTick += 3;
  }
  multiplayerPreview.avatar.update(multiplayerPreview.serverTick);
}

function syncHubNpcPresentation() {
  if (!hubNpcPresentation) return null;
  const fallen = new Set(run?.hub?.fallenNpcs ?? []);
  const survivors = (run?.hub?.activeNpcs ?? []).filter((npcId) => !fallen.has(npcId));
  const visibility = hubNpcVisibilityForPhase({phase, active: survivors.length > 0});
  return hubNpcPresentation.sync({
    activeNpcs: survivors,
    show: visibility.visible,
    showServiceIcons: visibility.serviceIconsVisible,
  });
}

function syncHubWorldPresentation() {
  return world.setHubPresentation?.({
    phase,
    activeNpcs: (run?.hub?.activeNpcs ?? []).filter((npcId) => !(run?.hub?.fallenNpcs ?? []).includes(npcId)),
    features: run?.hub?.features ?? {},
    gates: run?.gates ?? {},
    emergencyHealUsed: run?.emergencyHealUsed === true,
  }) ?? null;
}

async function ensureHubNpcPresentation() {
  if (hubNpcPresentation) return hubNpcPresentation;
  if (hubNpcPresentationPromise) return hubNpcPresentationPromise;
  const generation = hubNpcPresentationGeneration;
  const pending = createHubNpcPresentation({
    BABYLON,
    scene: world.scene,
    stations: BRIARHOLD_FIRST_PERSON_MAP.npcSpawnPoints.filter((station) => (
      (run?.hub?.activeNpcs ?? []).includes(station.npcId)
      && !(run?.hub?.fallenNpcs ?? []).includes(station.npcId)
    )),
    mobileTextures: coarsePointer,
  }).then((presentation) => {
    const presentationPhase = hubNpcVisibilityForPhase({phase, active: true}).visible;
    if (generation !== hubNpcPresentationGeneration || !presentationPhase) {
      presentation.dispose();
      return null;
    }
    hubNpcPresentation = presentation;
    hubNpcPresentationError = null;
    syncHubNpcPresentation();
    return presentation;
  }).catch((error) => {
    hubNpcPresentationError = String(error?.message || error);
    console.error("Hub NPC presentation failed", error);
    return null;
  }).finally(() => {
    if (hubNpcPresentationPromise === pending) hubNpcPresentationPromise = null;
  });
  hubNpcPresentationPromise = pending;
  return pending;
}

function releaseHubNpcPresentation() {
  hubNpcPresentationGeneration += 1;
  hubNpcPresentation?.dispose();
  hubNpcPresentation = null;
  hubNpcPresentationPromise = null;
}

function ensureHubCombatState() {
  if (!run) return null;
  const activeNpcIds = (run.hub?.activeNpcs ?? []).filter((npcId) => !(run.fallenNpcs ?? []).includes(npcId));
  hubCombatState = createHubCombatState({
    activeNpcIds,
    persisted: run.hubCombat ?? null,
  });
  nextHubPressureAt = hubCombatState.elapsed;
  return hubCombatState;
}

function updateHubDefence(dt) {
  if (!battlefield || !run || (!battlefield.outerGateBreached[WEST] && !battlefield.outerGateBreached[EAST])) return;
  const state = hubCombatState ?? ensureHubCombatState();
  if (!state) return;
  const courtyardEnemies = courtyardEnemiesFromBattlefield(battlefield);
  const attacks = updateHubCombat(state, {
    deltaSeconds: dt,
    westPortcullisBreached: true,
    enemies: courtyardEnemies,
  });
  for (const {attack, result} of applyHubCombatAttacks(battlefield, attacks)) {
    recordEnemyDamage(`npc:${attack.defenderId}`, attack.enemyId, result);
    hubNpcPresentation?.signalAttack?.(attack.defenderId, attack.target);
    world.tracer(
      new BABYLON.Vector3(attack.origin.x, attack.origin.y, attack.origin.z),
      new BABYLON.Vector3(attack.target.x, attack.target.y, attack.target.z),
      "#e9bd68",
      {cameraRelative: false, radius: .012},
    );
    if (result.killed) killsThisRun++;
  }

  if (state.elapsed + 1e-9 < nextHubPressureAt) return;
  nextHubPressureAt = state.elapsed + .72;
  for (const defender of Object.values(state.defenders)) {
    if (defender.fallen) continue;
    const attackers = courtyardEnemies.filter((enemy) => Math.hypot(
      enemy.x - defender.position.x,
      enemy.z - defender.position.z,
    ) <= 2.4);
    if (!attackers.length) continue;
    const resistance = Math.max(1, currentCombatTuning?.npcStaggerResistanceMultiplier ?? 1);
    const pressure = damageHubDefender(state, defender.id, (5 + Math.min(18, attackers.length * 2.5)) / resistance, {
      enemyId: attackers[0].id,
    });
    if (!pressure) continue;
    hubNpcPresentation?.signalHit?.(defender.id);
    if (!pressure.fell) continue;
    run = markHubNpcFallen(run, defender.id);
    run = {...run, hubCombat: serialiseHubCombatState(state)};
    syncHubNpcPresentation();
    syncHubWorldPresentation();
    announce(`${HUB_NPC_LABELS[defender.id] || defender.id} has fallen—lost for this run`);
    persistRun();
    if (defender.id === HUB_NPC_IDS.BELLKEEPER) {
      failCurrentRun("bellkeeper_fallen");
      return;
    }
  }
}

function recordFrameTiming(dt) {
  const frameMs = Math.max(0, dt * 1000);
  frameMonitor.lastFrameMs = frameMs;
  if (frameMs > 50) frameMonitor.hitchCount++;
  frameMonitor.samples.push(frameMs);
  if (frameMonitor.samples.length > 600) frameMonitor.samples.shift();
  if (frameMonitor.samples.length < 30 || frameMonitor.samples.length % 30 !== 0) return;
  const ordered = [...frameMonitor.samples].sort((a, b) => a - b);
  const medianMs = ordered[Math.floor((ordered.length - 1) * 0.5)] || 0;
  const p99Ms = ordered[Math.floor((ordered.length - 1) * 0.99)] || 0;
  frameMonitor.medianFps = medianMs > 0 ? 1000 / medianMs : 0;
  frameMonitor.onePercentLowFps = p99Ms > 0 ? 1000 / p99Ms : 0;
}

function resetFrameTiming() {
  lastFrameAt = performance.now() / 1000;
  resetFramePacer(framePacer, lastFrameAt);
  frameMonitor.samples.length = 0;
  frameMonitor.medianFps = 0;
  frameMonitor.onePercentLowFps = 0;
  frameMonitor.hitchCount = 0;
  frameMonitor.lastFrameMs = 0;
  frameMonitor.simulationMs = 0;
  frameMonitor.rendererUpdateMs = 0;
  frameMonitor.sceneRenderMs = 0;
}
let lastOuterBreached = false;
let lastContextAt = -Infinity;
let lastTrapTick = 0;
const thornSnareOccupants = new Map();
let wickerBossId = -1;
let wickerBossAnnounced = false;
let wickerBossDefeated = false;
let firstHunterAnnounced = false;
let prepareToken = 0;
let runFailureReason = "";
let currentCombatTuning = null;
let releaseTelegraphs = [];
let nextProgressionSaveAt = 0;
const armourCrackUntil = new Map();
let pendingMasteryImpacts = [];
let coopDelayedEffects = createAuthoritativeDelayedEffectQueue();
let bossCommandSequence = 0;
let bossEventCursor = 0;
let bossFrameRemainderMs = 0;
let testBossHpMultiplier = 1;
const bossZoneDamageAt = new Map();

const keys = new Set();
const touch = {
  movePointer: null,
  move: {x: 0, y: 0},
  sprint: false,
  lookPointer: null,
  lookLast: null,
  firePointers: new Set(),
  fireLookLast: new Map(),
  aimLookLast: new Map(),
  meleeLookLast: new Map(),
};

function clamp(value, min = 0, max = 1) { return Math.max(min, Math.min(max, Number(value) || 0)); }
function ratio(value, max) { return max > 0 ? clamp(value / max) : 0; }

/* TESTABLE_PRESENTATION_BEGIN */
const HUD_DIAGNOSTICS_INTERVAL_SECONDS = 0.25;
const ARBALEST_HIT_MARKER_INTERVAL_SECONDS = 0.12;
const VIEWMODEL_RECOIL_KEYFRAMES = Object.freeze([
  Object.freeze({transform: "translate3d(0, 0, 0) rotate(0deg)", offset: 0}),
  Object.freeze({transform: "translate3d(8px, 10px, 0) rotate(1.3deg)", offset: 0.3}),
  Object.freeze({transform: "translate3d(0, 0, 0) rotate(0deg)", offset: 1}),
]);
const VIEWMODEL_RECOIL_TIMING = Object.freeze({duration: 120, easing: "ease-out"});

function createChangedValueWriter() {
  const values = new Map();
  function changed(key, value) {
    if (values.has(key) && Object.is(values.get(key), value)) return false;
    values.set(key, value);
    return true;
  }
  return Object.freeze({
    write(key, value, apply) {
      if (!changed(key, value)) return false;
      apply(value);
      return true;
    },
    text(key, element, value) {
      const next = String(value);
      if (!changed(key, next)) return false;
      element.textContent = next;
      return true;
    },
    property(key, element, property, value) {
      if (!changed(key, value)) return false;
      element[property] = value;
      return true;
    },
    attribute(key, element, attribute, value) {
      const next = String(value);
      if (!changed(key, next)) return false;
      element.setAttribute(attribute, next);
      return true;
    },
    dataset(key, element, property, value) {
      const next = String(value);
      if (!changed(key, next)) return false;
      element.dataset[property] = next;
      return true;
    },
    style(key, element, property, value) {
      const next = String(value);
      if (!changed(key, next)) return false;
      element.style.setProperty(property, next);
      return true;
    },
    classToggle(key, element, className, force) {
      const next = Boolean(force);
      if (!changed(key, next)) return false;
      element.classList.toggle(className, next);
      return true;
    },
    clear() { values.clear(); },
    get size() { return values.size; },
  });
}

function createIntervalGate(intervalSeconds) {
  const interval = Math.max(0, Number(intervalSeconds) || 0);
  let nextAt = Number.NEGATIVE_INFINITY;
  return Object.freeze({
    shouldRun(nowSeconds) {
      const now = Number(nowSeconds) || 0;
      if (now + 1e-9 < nextAt) return false;
      nextAt = now + interval;
      return true;
    },
    reset() { nextAt = Number.NEGATIVE_INFINITY; },
    get nextAt() { return nextAt; },
  });
}

function shouldRefreshHitMarker(presentation, nowSeconds, lastArbalestAt) {
  if (!presentation || presentation.weaponId !== "arbalest" || presentation.kind === "kill") return true;
  const now = Number(nowSeconds) || 0;
  return now - lastArbalestAt + 1e-9 >= ARBALEST_HIT_MARKER_INTERVAL_SECONDS;
}

function createViewmodelRecoilPresenter(element, shouldReduceMotion = () => false) {
  let animation = null;
  let lastMultiplier = null;
  return Object.freeze({
    fire(multiplier = 1) {
      if (shouldReduceMotion()) {
        animation?.cancel?.();
        animation = null;
        return false;
      }
      const amount = Math.max(0.25, Math.min(1, Number(multiplier) || 1));
      if (animation && amount !== lastMultiplier) {
        animation.cancel?.();
        animation = null;
      }
      if (!animation && typeof element?.animate === "function") {
        animation = element.animate([
          VIEWMODEL_RECOIL_KEYFRAMES[0],
          {transform: `translate3d(${8 * amount}px, ${10 * amount}px, 0) rotate(${1.3 * amount}deg)`, offset: 0.3},
          VIEWMODEL_RECOIL_KEYFRAMES[2],
        ], VIEWMODEL_RECOIL_TIMING);
        animation.pause?.();
        lastMultiplier = amount;
      }
      if (!animation) return false;
      animation.currentTime = 0;
      animation.play?.();
      return true;
    },
    cancel() {
      animation?.cancel?.();
      animation = null;
    },
    get animation() { return animation; },
  });
}
/* TESTABLE_PRESENTATION_END */

const hudWrites = createChangedValueWriter();
const hudMeterSpans = new WeakMap();
const hudPriceSpans = new WeakMap();
const viewmodelRecoil = createViewmodelRecoilPresenter(
  ui.viewmodelArt,
  () => Boolean(ui.reducedMotion?.checked || reducedMotionMedia.matches),
);
const hudDiagnosticsGate = createIntervalGate(HUD_DIAGNOSTICS_INTERVAL_SECONDS);
let cachedRunLoadoutKey = null;
let cachedRunLoadout = null;
let lastArbalestHitMarkerAt = Number.NEGATIVE_INFINITY;

function writeHudValue(key, value, apply) {
  return hudWrites.write(key, value, apply);
}

function writeHudText(key, element, value) {
  return hudWrites.text(key, element, value);
}

function currentRunLoadout() {
  const key = resolveRunLoadoutCacheKey(profile, run);
  if (cachedRunLoadoutKey !== key) {
    cachedRunLoadoutKey = key;
    cachedRunLoadout = resolveRunLoadout(run, profile);
  }
  return cachedRunLoadout;
}

function invalidateRunLoadoutCache() {
  cachedRunLoadoutKey = null;
  cachedRunLoadout = null;
}

function setMeter(element, value, max) {
  const amount = ratio(value, max);
  const key = element.id || element.getAttribute("aria-label") || "meter";
  hudWrites.attribute(`meter:${key}:aria`, element, "aria-valuenow", Math.round(amount * 100));
  let span = hudMeterSpans.get(element);
  if (!span) {
    span = element.querySelector("span");
    hudMeterSpans.set(element, span);
  }
  hudWrites.property(`meter:${key}:scale`, span.style, "transform", `scaleX(${amount})`);
}
function setInputSource(source) {
  currentInputSource = source;
  document.body.dataset.input = source;
  const interactLabel = controllerActionLabel(cachedControllerMapping, "interact");
  if (ui.contextKey) ui.contextKey.textContent = source === INPUT_SOURCES.GAMEPAD ? interactLabel : source === INPUT_SOURCES.TOUCH ? "USE" : "E";
  if (ui.controlsHelp) {
    ui.controlsHelp.textContent = source === INPUT_SOURCES.GAMEPAD
      ? `Left stick move · Right stick look · LT focus · RT fire · A jump/mantle · B slide · ${interactLabel} use · LS sprint · LB/RB weapons · Menu pause`
      : "WASD move · Shift sprint · Space jump/mantle · C slide · Right mouse/Q focus · Mouse fire · E use · 1–3 weapons";
  }
}

function resetTouchInput() {
  touch.movePointer = null;
  touch.move.x = 0;
  touch.move.y = 0;
  touch.sprint = false;
  touch.lookPointer = null;
  touch.lookLast = null;
  touch.firePointers.clear();
  touch.fireLookLast.clear();
  touch.aimLookLast.clear();
  touch.meleeLookLast.clear();
  touchFire = false;
  touchAim = false;
  adsActive = false;
  touchJumpPressed = false;
  touchSlidePressed = false;
  ui.moveKnob.style.transform = "";
}

function setControllerPresence(connected, {focus = true} = {}) {
  const next = Boolean(connected);
  if (controllerPresent === next && document.body.dataset.controller) return false;
  controllerPresent = next;
  document.body.dataset.controller = next ? "connected" : "disconnected";
  if (next) resetTouchInput();
  setInputSource(controllerInputSourceForPresence(next, coarsePointer));
  if (next && focus) queueMicrotask(() => focusControllerChoice(controllerOverlayElements()));
  return true;
}
function announce(message) {
  ui.announcement.textContent = message;
  ui.announcement.classList.remove("is-visible");
  void ui.announcement.offsetWidth;
  ui.announcement.classList.add("is-visible");
}

function refreshGraphicsResolutionStatus() {
  if (!ui.graphicsResolutionStatus) return;
  const resolution = graphicsResolutionLabel({
    quality: graphicsQuality,
    width: engine.getRenderWidth(),
    height: engine.getRenderHeight(),
    scale: engine.getHardwareScalingLevel(),
    renderer: graphicsInfo.renderer,
  });
  ui.graphicsResolutionStatus.textContent = `${resolution} · ${frameRateLimit === FRAME_RATE_LIMIT.FPS_60 ? "60 FPS cap" : "Uncapped"}`;
}

function saveProfileSettings(settings) {
  profile = {...profile, settings: {...profile.settings, ...settings}};
  persistRun();
}

function requestedEnemyPresentation() {
  return search.has('enemyPresentation')
    ? normaliseEnemyPresentation(search.get('enemyPresentation'))
    : enemyPresentation;
}

function refreshEnemyPresentationResolution() {
  enemyPresentationResolution = resolveEnemyPresentation(requestedEnemyPresentation(), {
    coarse: coarsePointer,
    software: softwareGraphics,
    graphicsQuality,
    fastHardware: fastEnemy3dHardware,
  });
  document.body.dataset.enemyPresentation = enemyPresentationResolution.mode;
  document.body.dataset.enemyPresentationReason = enemyPresentationResolution.reason;
  return enemyPresentationResolution;
}

function applyEnemyPresentation(value, {persist = true, announceChange = false} = {}) {
  enemyPresentation = normaliseEnemyPresentation(value);
  if (ui.enemyPresentation) ui.enemyPresentation.value = enemyPresentation;
  const resolution = refreshEnemyPresentationResolution();
  if (persist) saveProfileSettings({enemyPresentation});
  if (announceChange) {
    const suffix = phase === GAME_PHASES.COMBAT ? ' · applies next wave' : '';
    const fallback = resolution.fallback ? ' · sprites used on this renderer' : '';
    announce(`${ui.enemyPresentation?.selectedOptions?.[0]?.textContent || 'Enemy style'}${fallback}${suffix}`);
  }
}

function syncEnemyPresentationControl() {
  const availability = enemyPresentationAvailability(phase);
  if (ui.enemyPresentation) {
    ui.enemyPresentation.disabled = !availability.enabled;
    ui.enemyPresentation.setAttribute("aria-disabled", String(!availability.enabled));
  }
  if (ui.enemyPresentationStatus) {
    ui.enemyPresentationStatus.textContent = availability.message;
    ui.enemyPresentationStatus.hidden = !availability.message;
  }
}

function applyGraphicsQuality(value, {persist = true, announceChange = false} = {}) {
  graphicsQuality = normaliseGraphicsQuality(value);
  refreshEnemyPresentationResolution();
  world.setLightingQuality?.(graphicsQuality, {coarse: coarsePointer, software: softwareGraphics});
  const requestedScale = graphicsScaleForQuality(graphicsQuality, {
    coarse: coarsePointer,
    devicePixelRatio,
    software: softwareGraphics,
  });
  const scale = budgetedGraphicsScale(requestedScale, graphicsQuality);
  renderGovernor.enabled = graphicsQualityUsesGovernor(graphicsQuality)
    && !search.has("noAdaptiveResolution");
  renderGovernor.baseScale = scale;
  renderGovernor.maxScale = Math.max(
    scale,
    maximumRenderScale({coarse: coarsePointer, software: softwareGraphics}),
  );
  const learnedAutoScale = Number(profile.settings?.autoHardwareScale);
  renderGovernor.scale = renderGovernor.enabled && Number.isFinite(learnedAutoScale)
    ? clamp(learnedAutoScale, scale, renderGovernor.maxScale)
    : scale;
  renderGovernor.slowScore = 0;
  renderGovernor.fastScore = 0;
  renderGovernor.slowSeconds = 0;
  renderGovernor.fastSeconds = 0;
  renderGovernor.cooldownSeconds = 0;
  engine.setHardwareScalingLevel(renderGovernor.scale);
  engine.resize();
  ui.graphicsQuality.value = graphicsQuality;
  refreshGraphicsResolutionStatus();
  if (persist) saveProfileSettings({graphicsQuality});
  if (announceChange) announce(`${ui.graphicsQuality.selectedOptions[0]?.textContent || "Graphics quality"} applied`);
}

function applyFrameRateLimit(value, {persist = true, announceChange = false} = {}) {
  frameRateLimit = normaliseFrameRateLimit(value, {coarse: coarsePointer});
  setFramePacerTarget(
    framePacer,
    frameRateLimit === FRAME_RATE_LIMIT.FPS_60 ? 60 : 0,
    performance.now() / 1000,
  );
  ui.frameRateLimit.value = frameRateLimit;
  refreshGraphicsResolutionStatus();
  if (persist) saveProfileSettings({frameRateLimit});
  if (announceChange) announce(frameRateLimit === FRAME_RATE_LIMIT.FPS_60 ? "Frame rate limited to 60 FPS" : "Frame rate uncapped");
}

function persistControllerMappings() {
  try { localStorage.setItem(CONTROLLER_MAPPING_STORAGE_KEY, serialiseControllerMappings(controllerMappings)); }
  catch { /* Gameplay remains available with the in-memory map. */ }
}

function queueBackboneControllerProfileCapture(profile) {
  if (!playtestReporter?.receiver) return;
  const payload = createControllerProfileCapture(profile, {coarsePointer});
  if (!payload || submittedControllerProfileKeys.has(profile.key)) return;
  submittedControllerProfileKeys.add(profile.key);
  void submitControllerProfileCapture(payload).then((result) => {
    if (result?.id) announce("Backbone mapping captured for built-in profile review");
  }).catch(() => {
    // Production builds have no local receiver. The custom mapping remains
    // safely persisted in the browser and gameplay must never depend on this.
  });
}

function connectedController() {
  return selectConnectedGamepad(navigator.getGamepads?.(), activeGamepadIndex);
}

function refreshControllerMappingStatus() {
  const pad = connectedController();
  if (!ui.controllerMappingStatus) return;
  if (!pad) { ui.controllerMappingStatus.textContent = "No controller connected"; return; }
  const saved = controllerMappingForPad(controllerMappings, pad);
  const builtIn = builtInControllerMapping(pad);
  if (saved) queueBackboneControllerProfileCapture(saved);
  ui.controllerMappingStatus.textContent = saved
    ? `${pad.id || "Controller"} · custom mapping saved`
    : builtIn
      ? `${pad.id || "Controller"} · built-in Backbone mapping`
      : `${pad.id || "Controller"} · using automatic mapping`;
}

function mappingProgress(session) {
  if (!session || session.phase === "neutral") return 1;
  if (session.phase === "axis") return 2 + session.axisStep;
  if (session.phase === "button") return 6 + session.buttonStep;
  return 18;
}

function updateControllerMappingOverlay() {
  if (!controllerMappingSession) return;
  const step = controllerMappingStep(controllerMappingSession);
  ui.controllerMappingPrompt.textContent = step.prompt;
  ui.controllerMappingProgress.value = mappingProgress(controllerMappingSession);
  ui.controllerMappingProgress.setAttribute("aria-valuenow", String(ui.controllerMappingProgress.value));
}

function cancelControllerMapping(message = "Controller mapping cancelled") {
  controllerMappingSession = null;
  controllerMappingPadIndex = null;
  controllerMappingReleaseGate = true;
  show(ui.controllerMappingOverlay, false);
  announce(message);
  refreshControllerMappingStatus();
}

function finishControllerMapping(profile) {
  controllerMappings = saveControllerMapping(controllerMappings, profile);
  persistControllerMappings();
  queueBackboneControllerProfileCapture(profile);
  cachedControllerMappingKey = null;
  cachedControllerMapping = null;
  gamepadCalibration = createGamepadCalibration();
  previousGamepadButtons = {};
  cancelControllerMapping("Controller mapping saved · right stick calibrated");
}

function beginControllerMapping() {
  const pad = connectedController();
  if (!pad) { announce("Connect a controller before mapping"); refreshControllerMappingStatus(); return; }
  controllerMappingSession = createControllerMappingSession(pad);
  controllerMappingPadIndex = pad.index;
  controllerMappingReleaseGate = false;
  updateControllerMappingOverlay();
  show(ui.controllerMappingOverlay, true);
  ui.controllerMappingCancel.focus();
}

function resetControllerMapping() {
  const pad = connectedController();
  if (!pad) { announce("No connected controller to reset"); return; }
  controllerMappings = removeControllerMapping(controllerMappings, pad);
  persistControllerMappings();
  cachedControllerMappingKey = null;
  cachedControllerMapping = null;
  gamepadCalibration = createGamepadCalibration();
  previousGamepadButtons = {};
  announce("Controller mapping reset to automatic detection");
  refreshControllerMappingStatus();
}
const pendingPulses = new WeakMap();
function pulse(element, className) {
  if (element === ui.hitMarker) element.classList.remove("is-hit", "is-armour", "is-kill");
  const pending = pendingPulses.get(element);
  if (pending) cancelAnimationFrame(pending);
  element.classList.remove(className);
  pendingPulses.set(element, requestAnimationFrame(() => {
    element.classList.add(className);
    pendingPulses.delete(element);
  }));
}

function addLookInput(yaw, pitch) {
  const focusScale = adsActive ? 0.7 : 1;
  lookYaw += (Number(yaw) || 0) * lookSensitivityScale * focusScale;
  lookPitch += (Number(pitch) || 0) * lookSensitivityScale * focusScale * (invertVerticalLook ? -1 : 1);
}
function rumbleHit(kind) {
  if (currentInputSource !== INPUT_SOURCES.GAMEPAD) return;
  const pad = selectConnectedGamepad(navigator.getGamepads?.(), activeGamepadIndex);
  const actuator = pad?.vibrationActuator;
  if (!actuator?.playEffect) return;
  const killed = kind === "kill";
  actuator.playEffect("dual-rumble", {
    startDelay: 0,
    duration: killed ? 85 : 38,
    weakMagnitude: killed ? 0.7 : kind === "armour" ? 0.24 : 0.4,
    strongMagnitude: killed ? 0.42 : kind === "armour" ? 0.14 : 0.2,
  }).catch?.(() => {});
}
function rumblePlayerDamage(hunter = false) {
  if (currentInputSource !== INPUT_SOURCES.GAMEPAD) return;
  const pad = selectConnectedGamepad(navigator.getGamepads?.(), activeGamepadIndex);
  const actuator = pad?.vibrationActuator;
  if (!actuator?.playEffect) return;
  actuator.playEffect("dual-rumble", {
    startDelay: 0,
    duration: hunter ? 145 : 95,
    weakMagnitude: hunter ? 0.82 : 0.58,
    strongMagnitude: hunter ? 0.62 : 0.36,
  }).catch?.(() => {});
}
function show(element, visible = true) { element.hidden = !visible; }

function setBuildPanelExpanded(expanded) {
  const isExpanded = Boolean(expanded);
  ui.buildPanelDetails.hidden = !isExpanded;
  ui.buildPanel.dataset.collapsed = String(!isExpanded);
  ui.buildPanelToggle.setAttribute("aria-expanded", String(isExpanded));
  ui.buildPanelToggle.setAttribute(
    "aria-label",
    isExpanded ? "Collapse wave preparation details" : "Expand wave preparation details",
  );
  ui.buildPanelToggle.textContent = isExpanded ? "Hide" : "Details";
}

function syncBuildPanelForViewport(event = compactBuildPanelMedia) {
  if (phase === GAME_PHASES.DAYTIME) setBuildPanelExpanded(!event.matches);
  else if (!event.matches) setBuildPanelExpanded(true);
}

function serializePlayer() {
  return {
    hp: player.hp,
    maxHp: player.maxHp,
    position: {...player.position},
    facing: {...player.facing},
    activeWeapon: player.activeWeapon,
  };
}

function syncRunState() {
  if (!run) return;
  run = {
    ...run,
    // The pure run transition may move ahead of the rendered presentation
    // while a recovery swap or narrative scene is still on screen. The run's
    // phase is authoritative; copying the temporary UI phase here can create
    // impossible cadence states such as combat without a Bell receipt.
    phase: run.phase,
    player: serializePlayer(),
    fortifications: run.fortifications || [],
    hubCombat: hubCombatState ? serialiseHubCombatState(hubCombatState) : run.hubCombat,
  };
  if (battlefield) {
    const gates = run.gates || {};
    run.gates = {
      ...gates,
      outer: {
        ...(gates.outer || {}), kind: "outer", integrity: battlefield.outerGateHp[WEST],
        maxIntegrity: battlefield.outerGateMaxHp, destroyed: Boolean(battlefield.outerGateBreached[WEST]),
      },
      east: {
        ...(gates.east || {}), kind: "outer", integrity: battlefield.outerGateHp[EAST],
        maxIntegrity: battlefield.outerGateMaxHp, destroyed: Boolean(battlefield.outerGateBreached[EAST]),
      },
      heart: {
        ...(gates.heart || {}), kind: "heart", integrity: battlefield.heartGateHp,
        maxIntegrity: battlefield.heartGateMaxHp, destroyed: battlefield.heartGateHp <= 0,
      },
    };
  }
}

function persistRun() {
  if (coopPreview) return;
  if (pendingTerminalTransition) return;
  if (run) syncRunState();
  reportSaveResult(save.saveState(profile, run));
}

function reportSaveResult(result) {
  if (result?.pending) show(byId("persistenceWarning"), true);
  else if (result?.ok) show(byId("persistenceWarning"), false);
  if (result?.pending) {
    announce(result.inMemory
      ? "Storage is unavailable. This session is continuing in memory; progress may not persist."
      : "Save is pending. Briarhold will retry when storage is available.");
  }
  return result;
}

function commitTerminalTransition(nextProfile) {
  if (coopPreview?.role === "guest") return false;
  const result = reportSaveResult(save.saveState(nextProfile, null));
  if (!result?.ok) {
    pendingTerminalTransition = {profile: nextProfile};
    return false;
  }
  profile = nextProfile;
  if (coopPreview?.role === "host" && !result.inMemory) coopPersistenceBoundary?.persist(nextProfile, null);
  invalidateRunLoadoutCache();
  run = null;
  hubCombatState = null;
  pendingTerminalTransition = null;
  return true;
}

function retryPendingPersistence() {
  const result = reportSaveResult(save.retryPendingSave());
  if (!result?.ok) return false;
  if (pendingTerminalTransition) {
    if (coopPreview?.role === "host") coopPersistenceBoundary?.persist(pendingTerminalTransition.profile, null);
    profile = pendingTerminalTransition.profile;
    invalidateRunLoadoutCache();
    run = null;
    hubCombatState = null;
    pendingTerminalTransition = null;
    announce("Save completed. It is safe to return to the oath hall.");
  }
  return true;
}

function readSavedState() {
  try {
    const loaded = save.loadState();
    if (loaded) {
      profile = loaded.profile;
      run = loaded.run;
      invalidateRunLoadoutCache();
    }
  } catch (error) {
    console.warn("[Briarhold] Save could not be loaded", error);
    const quarantined = save.quarantineSave(error);
    if (quarantined.ok) {
      announce(/unsupported .*version/i.test(String(error?.message))
        ? "This save belongs to a newer Briarhold version and was preserved for recovery."
        : "This save could not be read and was preserved for recovery.");
    } else {
      announce("This save could not be read. It was not deleted; storage recovery is still pending.");
    }
  }
  if (save.persistenceWarning) {
    show(byId("persistenceWarning"), true);
    announce("Save storage is unavailable. This session will continue in memory; progress may not persist.");
  }
  const hasRun = Boolean(run);
  show(ui.continueButton, hasRun);
  show(ui.continueSummary, hasRun);
  newRunArmed = false;
  show(ui.newRunWarning, false);
  ui.newRunButton.textContent = hasRun ? "Start a new run" : "Take the Warden's oath";
  ui.newRunButton.classList.toggle("primary-button", !hasRun);
  ui.newRunButton.classList.toggle("secondary-button", hasRun);
  if (hasRun) ui.continueRunText.textContent = `Night ${run.night} · Wave ${Math.min(3, run.wave + 1)}`;
  const rosterOrder = [HUB_NPC_IDS.BELLKEEPER, HUB_NPC_IDS.MASON, HUB_NPC_IDS.QUARTERMASTER, HUB_NPC_IDS.TRAPPER, HUB_NPC_IDS.GREENWARDEN];
  const knownRoster = new Set(profile.hubUnlocks ?? []);
  const nextNpc = rosterOrder.find((npcId) => !knownRoster.has(npcId));
  ui.ledgerOathmarks.textContent = profile.oathmarks.toLocaleString();
  ui.ledgerRuns.textContent = String(profile.terminalRuns ?? 0);
  ui.ledgerRoster.textContent = `${rosterOrder.filter((npcId) => knownRoster.has(npcId)).length} / ${rosterOrder.length}`;
  ui.ledgerNext.textContent = nextNpc
    ? `Next arrival: ${HUB_NPC_LABELS[nextNpc]} after this run ends.`
    : "Every holdfolk defender is permanently available.";
}

function applyLoadedPlayer() {
  const bonuses = calculatePermanentBonuses(profile);
  const maxHp = run?.player?.maxHp || Math.round(100 * bonuses.maxHpMultiplier);
  const savedPosition = run?.player?.position;
  const atLegacyHiddenSpawn = run?.phase === GAME_PHASES.DAYTIME
    && run?.wave === 0
    && savedPosition?.x === -16
    && savedPosition?.y === 0
    && savedPosition?.z === -13;
  const loadedPosition = atLegacyHiddenSpawn
    ? BRIARHOLD_FIRST_PERSON_MAP.playerSpawn
    : savedPosition || BRIARHOLD_FIRST_PERSON_MAP.playerSpawn;
  const loadedFacing = atLegacyHiddenSpawn
    ? BRIARHOLD_FIRST_PERSON_MAP.playerSpawn
    : run?.player?.facing || BRIARHOLD_FIRST_PERSON_MAP.playerSpawn;
  const availableWeapons = resolveRunLoadout(run, profile).weapons;
  const savedWeaponId = WEAPON_IDS[run?.player?.activeWeapon ?? 0];
  const activeWeapon = availableWeapons.includes(savedWeaponId)
    ? WEAPON_IDS.indexOf(savedWeaponId)
    : 0;
  player = createPlayerState({
    position: loadedPosition,
    facing: loadedFacing,
    maxHp,
    hp: run?.player?.hp ?? maxHp,
    activeWeapon,
  });
  player.healAvailable = !run?.emergencyHealUsed;
  weapon = createWeaponState();
  knife = createKnifeMeleeState();
  selectWeapon(weapon, WEAPON_IDS[player.activeWeapon] || "arbalest");
  audio.setWeapon(weapon.selected);
}

function setPhase(next) {
  if (!Object.values(GAME_PHASES).includes(next)) throw new RangeError(`Unknown phase ${next}`);
  const previousPhase = phase;
  if (next !== GAME_PHASES.DAYTIME && narrativePresentation.isOpen) narrativePresentation.interrupt("phase-transition");
  if (next !== GAME_PHASES.DAYTIME && goalsPresentation.isOpen) goalsPresentation.close();
  if (phase === GAME_PHASES.DAYTIME && next !== GAME_PHASES.DAYTIME && next !== GAME_PHASES.COMBAT) releaseHubNpcPresentation();
  if (phase === GAME_PHASES.COMBAT && next !== GAME_PHASES.COMBAT && next !== GAME_PHASES.DAYTIME) releaseHubNpcPresentation();
  if (next !== GAME_PHASES.COMBAT) audio.stopSunfire();
  if (next !== GAME_PHASES.DAYTIME) closeHubService();
  phase = next;
  coopPreview?.setAuthorityPhase(next);
  syncEnemyPresentationControl();
  if (next !== GAME_PHASES.COMBAT) {
    wickerBossId = -1;
    wickerBossAnnounced = false;
    wickerBossDefeated = false;
    clearBossHudPresentation({
      status: ui.bossStatus,
      name: ui.bossName,
      healthText: ui.bossHealthText,
      healthBar: ui.bossHealthBar,
      individuals: ui.bossIndividuals,
      counter: ui.bossCounterText,
    });
    adsActive = false;
    mouseAim = false;
    touchAim = false;
    ui.viewmodel.classList.remove("is-holstered");
    ui.viewmodel.classList.remove("is-aiming");
    ui.fireButton.classList.remove("is-auto-locked");
  }
  // Combat owns relative mouse capture. Build/boon/result phases restore the
  // cursor so their real buttons cannot be hidden behind the locked canvas.
  if (next !== GAME_PHASES.COMBAT && document.pointerLockElement === canvas) {
    document.exitPointerLock?.();
  }
  document.body.dataset.phase = next;
  show(ui.menu, next === GAME_PHASES.MENU);
  show(ui.combatHud, next !== GAME_PHASES.MENU && next !== GAME_PHASES.BOON_CHOICE && next !== GAME_PHASES.RUN_FAILED && next !== GAME_PHASES.NIGHT_COMPLETE && next !== GAME_PHASES.CAMPAIGN_COMPLETE);
  show(ui.buildPanel, next === GAME_PHASES.DAYTIME);
  show(ui.boonOverlay, next === GAME_PHASES.BOON_CHOICE);
  if (next !== GAME_PHASES.RUN_FAILED && next !== GAME_PHASES.NIGHT_COMPLETE && next !== GAME_PHASES.CAMPAIGN_COMPLETE) show(ui.resultOverlay, false);
  world.setPlanningMode(next === GAME_PHASES.DAYTIME);
  syncHubNpcPresentation();
  syncHubWorldPresentation();
  if (next === GAME_PHASES.DAYTIME) audio.setMode("build_break");
  else if (next === GAME_PHASES.COMBAT) audio.setMode("combat");
  else if (next === GAME_PHASES.BOON_CHOICE) audio.setMode("boon");
  else if (next === GAME_PHASES.NIGHT_COMPLETE) audio.setMode("night_clear");
  else if (next === GAME_PHASES.CAMPAIGN_COMPLETE) audio.setMode("campaign_clear");
  else if (next === GAME_PHASES.RUN_FAILED) audio.setMode("run_fail");
  else if (next === GAME_PHASES.MENU) audio.setMode("menu", {immediate: true});
  const presentationProfile = next === GAME_PHASES.DAYTIME ? "day" : "night";
  document.body.dataset.worldPresentation = presentationProfile;
  world.setWorldPresentationProfile(presentationProfile);
  audio.setWorldPresentationProfile(presentationProfile);
  if (next === GAME_PHASES.INTERWAVE_RECOVERY) {
    recoveryPresentation.show({warning: "The next wave begins automatically", remainingMs: run?.recovery?.remainingMs});
  } else recoveryPresentation.hide();
  if (next === GAME_PHASES.MENU) queueMicrotask(showPendingAndroidUpdate);
  if (controllerPresent) queueMicrotask(() => focusControllerChoice(controllerOverlayElements()));
  const awaitingCoopCampaignSettlement = next === GAME_PHASES.CAMPAIGN_COMPLETE
    && coopSettlementState?.status !== 'settled';
  if (previousPhase !== next && coopPreview?.role === 'host' && coopPreview.connected
    && !awaitingCoopCampaignSettlement) {
    queueMicrotask(() => coopPreview?.sendCheckpoint?.('phase_transition'));
  }
}

function newRunState() {
  lastControllerAction = null;
  if (profile.narrative?.debtBroken) {
    const echo = createEchoRun(profile);
    profile = echo.profile;
    return prepareSoloCampaignDaytime(profile, echo.run);
  }
  const created = createRunState({
    profile,
    player: {maxHp: 100, hp: 100},
    gates: baseRunGates(),
    fortifications: [],
    wave: 0,
    phase: PROGRESSION_PHASES.DAYTIME,
  });
  const transferred = transferPendingNarrativeSequence(profile, created);
  profile = transferred.profile;
  return prepareSoloCampaignDaytime(profile, transferred.run);
}

async function startNewRun() {
  await audio.unlock();
  run = newRunState();
  invalidateRunLoadoutCache();
  hubCombatState = null;
  nextHubPressureAt = 0;
  killsThisRun = 0;
  applyLoadedPlayer();
  enterDaytime(true);
}

function requestNewRun() {
  if (!run || newRunArmed) return startNewRun();
  newRunArmed = true;
  ui.newRunButton.textContent = "Confirm restart";
  show(ui.newRunWarning, true);
  ui.newRunButton.focus();
}

function resumedNarrativeContinuation(session) {
  if (session.trigger === "profile_intro") return startDawnNarrativeFlow;
  if (session.trigger === "day_begin" || session.trigger === "npc_arrival") {
    return continueQueuedArrivalNarrative;
  }
  if (session.trigger === "night_cleared") {
    if (run?.phase === GAME_PHASES.CAMPAIGN_COMPLETE) return startCampaignEnding;
    if (run?.phase === GAME_PHASES.BOON_CHOICE) return () => showNightComplete(session.contextNight);
    if (run?.phase === GAME_PHASES.DAYTIME) return () => enterDaytime(true);
  }
  if (session.trigger === "campaign_cleared" && run?.phase === GAME_PHASES.CAMPAIGN_COMPLETE) {
    return settleCampaignAfterEnding;
  }
  return null;
}

function narrativeResumeAllowed(session) {
  if (!session) return false;
  if (run?.phase === GAME_PHASES.DAYTIME) {
    return [
      "day_begin", "npc_arrival", "npc_talk", "goal_offer", "goal_reminder",
      "goal_ready", "goal_report", "bell_briefing", "night_cleared", "profile_intro",
    ].includes(session.trigger);
  }
  if (session.trigger === "night_cleared") {
    return run?.phase === GAME_PHASES.BOON_CHOICE || run?.phase === GAME_PHASES.CAMPAIGN_COMPLETE;
  }
  return session.trigger === "campaign_cleared" && run?.phase === GAME_PHASES.CAMPAIGN_COMPLETE;
}

function clearPersistedNarrative() {
  if (!run?.narrative?.activeScene) return;
  run = {...run, narrative: {...run.narrative, activeScene: null}};
  persistRun();
}

function resumePersistedNarrative() {
  if (!run?.narrative?.activeScene) return false;
  let session = resumeNarrativeScene(
    run.narrative.activeScene,
    automaticNarrativeContext(undefined, run, profile),
  );
  if (!session && run.phase === GAME_PHASES.DAYTIME) {
    for (const npcId of run.hub?.activeNpcs ?? []) {
      session = resumeNarrativeScene(run.narrative.activeScene, narrativeContextFor(npcId));
      if (session) break;
    }
  }
  if (!narrativeResumeAllowed(session)) {
    clearPersistedNarrative();
    return false;
  }
  narrativeSession = session;
  narrativeSpeakerId = session.beat?.speakerId ?? HUB_NPC_IDS.BELLKEEPER;
  narrativeAuthorityRun = run;
  narrativeContinuation = resumedNarrativeContinuation(session);
  narrativeAutomatic = [
    "profile_intro", "day_begin", "npc_arrival", "night_cleared", "run_failed", "campaign_cleared",
  ].includes(session.trigger);
  narrativeServiceStation = narrativeAutomatic || !session.serviceNpcId
    ? null
    : BRIARHOLD_FIRST_PERSON_MAP.hubStations.find(({kind}) => kind === session.serviceNpcId) ?? null;
  return presentNarrativeBeat();
}

async function continueRun() {
  await audio.unlock();
  if (!run) return startNewRun();
  run = prepareNightRuntimeState(profile, run);
  applyLoadedPlayer();
  killsThisRun = 0;
  if (run.narrative.activeScene
    && (run.phase === GAME_PHASES.COMBAT || run.phase === GAME_PHASES.INTERWAVE_RECOVERY)) {
    clearPersistedNarrative();
  }
  if (run.phase === GAME_PHASES.COMBAT) await startPreparedWave(run.wave, {restored: true});
  else if (run.phase === GAME_PHASES.INTERWAVE_RECOVERY) enterRecovery(true);
  else if (run.phase === GAME_PHASES.DAYTIME) {
    enterDaytime(true, {queueNarrative: !run.narrative.activeScene});
    if (run.narrative.activeScene) resumePersistedNarrative();
  } else if (run.phase === GAME_PHASES.BOON_CHOICE) {
    enterBoonChoice();
    if (run.narrative.activeScene) resumePersistedNarrative();
  } else if (run.phase === GAME_PHASES.NIGHT_COMPLETE) {
    showNightComplete();
    if (run.narrative.activeScene) resumePersistedNarrative();
  } else if (run.phase === GAME_PHASES.CAMPAIGN_COMPLETE) {
    setPhase(GAME_PHASES.CAMPAIGN_COMPLETE);
    show(ui.resultOverlay, false);
    if (!resumePersistedNarrative()) {
      if (campaignEndingCompleted(run)) settleCampaignAfterEnding();
      else startCampaignEnding();
    }
  }
  else enterDaytime(true);
}

function socketLabel(socket) {
  return socket.id.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}

function nearestBuildSocket(maxDistance = 4.2, actor = player) {
  let nearest = null;
  for (const socket of world.sockets) {
    const distance = Math.hypot(
      socket.x - actor.position.x,
      (socket.y || 0) - actor.position.y,
      socket.z - actor.position.z,
    );
    if (distance <= maxDistance && (!nearest || distance < nearest.distance)) nearest = {socket, distance};
  }
  return nearest;
}

function nearestAuthoredInteraction(maxDistance = Infinity, actor = player) {
  let nearest = null;
  for (const interaction of BRIARHOLD_FIRST_PERSON_MAP.interactions) {
    const distance = Math.hypot(
      interaction.position.x - actor.position.x,
      interaction.position.y - actor.position.y,
      interaction.position.z - actor.position.z,
    );
    if (distance <= Math.min(maxDistance, interaction.radius) && (!nearest || distance < nearest.distance)) {
      nearest = {interaction, distance};
    }
  }
  return nearest;
}

function hubStationById(stationId) {
  return BRIARHOLD_FIRST_PERSON_MAP.hubStations.find(station => station.id === stationId) ?? null;
}

function nearestHubStation(maxDistance = Infinity, actor = player, {allowCombat = false} = {}) {
  if ((!allowCombat && phase !== GAME_PHASES.DAYTIME)
    || (allowCombat && ![GAME_PHASES.DAYTIME, GAME_PHASES.COMBAT].includes(phase))
    || !run?.hub) return null;
  const active = new Set(run.hub.activeNpcs ?? []);
  let nearest = null;
  for (const station of BRIARHOLD_FIRST_PERSON_MAP.hubStations) {
    if (!active.has(station.kind)) continue;
    const distance = Math.hypot(
      station.position.x - actor.position.x,
      station.position.y - actor.position.y,
      station.position.z - actor.position.z,
    );
    const radius = Math.min(maxDistance, station.interactionRadius);
    if (distance <= radius && (!nearest || distance < nearest.distance)) nearest = {station, distance};
  }
  return nearest;
}

function setHubFeature(featureId, value) {
  run = {...run, hub: setHubFeatureState(run.hub, featureId, value)};
  syncHubWorldPresentation();
}

function hubStationTitle(station) {
  return {
    [HUB_NPC_IDS.BELLKEEPER]: "Bell Platform",
    [HUB_NPC_IDS.MASON]: "Mason's Bench",
    [HUB_NPC_IDS.QUARTERMASTER]: "Quartermaster Stores",
    [HUB_NPC_IDS.TRAPPER]: "Trapper's Workshop",
    [HUB_NPC_IDS.GREENWARDEN]: "Greenwarden's Shrine",
  }[station?.kind] || "Briarhold Service";
}

function closeHubService() {
  activeHubStation = null;
  activeHubActions = [];
  if (!ui.hubServicePanel) return;
  document.body.classList.remove("hub-service-open");
  show(ui.hubServicePanel, false);
  ui.hubServiceClose.disabled = true;
  for (const button of ui.hubServiceActions) button.disabled = true;
}

let oathHallAtlasState = {activeTab: "foundations", activeWeapon: "arbalest", selectedId: null};
let oathHallTestRole = null;

function oathHallRole() {
  if (TEST_MODE && oathHallTestRole) return oathHallTestRole;
  return coopPreview?.role === "guest" ? "guest" : "host";
}

function configureHubService(station, {line, status, cost, actions = []}) {
  activeHubStation = station;
  activeHubActions = actions;
  ui.hubServiceTitle.textContent = hubStationTitle(station);
  ui.hubServiceLine.textContent = line;
  ui.hubServiceStatus.textContent = status;
  ui.hubServiceCost.textContent = cost;
  for (let index = 0; index < ui.hubServiceActions.length; index += 1) {
    const button = ui.hubServiceActions[index];
    const action = actions[index];
    button.hidden = !action;
    button.disabled = !action || action.disabled === true;
    button.dataset.hubAction = action?.id || "";
    if (action) button.textContent = action.label;
  }
  ui.hubServiceClose.disabled = false;
  document.body.classList.add("hub-service-open");
  show(ui.hubServicePanel, true);
  const first = ui.hubServiceActions.find(button => !button.hidden && !button.disabled);
  first?.focus();
}

function closeOathHall() {
  show(ui.oathHallPanel, false);
  ui.oathHallButton.setAttribute("aria-expanded", "false");
}

function renderOathHall() {
  const role = oathHallRole();
  const model = createOathHallModel(profile, {role, run, terminalBoundary: !run});
  ui.oathHallStatus.textContent = model.readOnly
    ? `${model.oathmarks} banked Oathmarks · guest view is read-only`
    : `${model.oathmarks} banked Oathmarks${run ? " · Warden rebinding unlocks after this run ends" : " · terminal rebinding available"}`;
  oathHallAtlasState = renderProgressionAtlas({
    model, state: oathHallAtlasState, tabs: ui.oathHallTabs,
    content: ui.oathHallSections, applyIcon: applyUiIcon,
  });
}

function openOathHall() {
  if (run && phase !== GAME_PHASES.DAYTIME) return false;
  closeHubService();
  renderOathHall();
  show(ui.oathHallPanel, true);
  ui.oathHallButton.setAttribute("aria-expanded", "true");
  ui.oathHallSections.querySelector("[data-oath-node]")?.focus();
  return true;
}

function activateOathHallAction(actionId) {
  try {
    profile = applyOathHallAction(profile, actionId, {
      role: oathHallRole(),
      run,
      terminalBoundary: !run,
    });
    invalidateRunLoadoutCache();
    persistRun();
    renderOathHall();
    announce("The Oath Hall records the binding");
  } catch (error) {
    ui.oathHallStatus.textContent = error.message;
    announce(error.message);
  }
  return true;
}

const HUB_PERMANENT_RANKS = Object.freeze({
  [HUB_NPC_IDS.MASON]: Object.freeze([RANK_TRACK_IDS.MASONS_OATH]),
  [HUB_NPC_IDS.QUARTERMASTER]: Object.freeze([
    RANK_TRACK_IDS.ARMORY_TEMPER,
    RANK_TRACK_IDS.QUARTERMASTER,
  ]),
  [HUB_NPC_IDS.TRAPPER]: Object.freeze([RANK_TRACK_IDS.FIELD_CRAFT]),
  [HUB_NPC_IDS.GREENWARDEN]: Object.freeze([RANK_TRACK_IDS.WARDENS_VIGOR]),
});

const PERMANENT_RANK_BY_ID = new Map(PERMANENT_RANK_TRACKS.map((track) => [track.id, track]));

function permanentProgressionActions(station) {
  const actions = [];
  if (station.kind === HUB_NPC_IDS.QUARTERMASTER) {
    for (const unlock of OATHMARK_UNLOCKS.filter((entry) => ["weapon-unlock", "character-unlock"].includes(entry.kind))) {
      if (profile.unlocks.includes(unlock.id)) continue;
      const missingRequirement = missingOathmarkUnlockRequirement(unlock, profile.unlocks);
      actions.push({
        id: `buy-unlock:${unlock.id}`,
        label: missingRequirement
          ? `${unlock.name} · commission Sunfire first`
          : `${unlock.name} · ${unlock.cost}`,
        disabled: Boolean(missingRequirement) || profile.oathmarks < unlock.cost,
      });
    }
  }
  for (const trackId of HUB_PERMANENT_RANKS[station.kind] ?? []) {
    const track = PERMANENT_RANK_BY_ID.get(trackId);
    const rank = profile.ranks[trackId] ?? 0;
    const atMaximum = rank >= track.maxRank;
    const cost = atMaximum ? null : track.costs[rank];
    actions.push({
      id: `buy-rank:${trackId}`,
      label: atMaximum ? `${track.name} · MAX` : `${track.name} ${rank + 1} · ${cost}`,
      disabled: atMaximum || profile.oathmarks < cost,
    });
  }
  return actions.slice(0, ui.hubServiceActions.length);
}

function openPermanentProgression(station) {
  return openOathHall(station);
}

function previewGateRepair(gateKey) {
  const gate = run?.gates?.[gateKey];
  if (!gate) return {repairCost: 12, request: null};
  const bonus = calculatePermanentBonuses(profile).repairEfficiencyMultiplier
    * calculateRunBoonEffects(run).repairEfficiencyMultiplier;
  const nextIntegrity = Math.min(gate.maxIntegrity, gate.integrity + Math.round(180 * bonus));
  const request = {
    benefitId: "gate-repair-discount",
    successful: false,
    night: run.night,
    runOrdinal: run.runOrdinal,
    eventId: goalEventId("repair", `${gateKey}-${nextIntegrity}`),
  };
  return {...consumeDayworkBenefit(run, request), request, nextIntegrity};
}

function openHubService(stationOrId, {narrativeChecked = false} = {}) {
  if (phase !== GAME_PHASES.DAYTIME || !run || narrativePresentation.isOpen) return false;
  const station = typeof stationOrId === "string" ? hubStationById(stationOrId) : stationOrId;
  if (!station || !run.hub.activeNpcs.includes(station.kind)) return false;
  if (!narrativeChecked) return interactWithNpc(station);
  const available = isHubServiceAvailable(station.kind, run, {profile});
  const supplies = run.supplies;
  const actions = [];
  let line = "The hold is listening.";
  let status = `${supplies} Supplies`;
  let cost = "No service selected";

  if (!available) {
    line = `${HUB_NPC_LABELS[station.kind]} cannot help in this run. Recruit them and keep them alive; the Arbalest and knife remain a valid plan.`;
    status = "Service not ready";
  } else if (station.kind === HUB_NPC_IDS.BELLKEEPER) {
    line = `Night ${run.night} begins only when you confirm Nell's bell.`;
    status = "Wave 1 ready";
    cost = "Explicit confirmation required";
    actions.push(
      {id: "bell-confirm", label: "Confirm the bell"},
      {id: "daywork:read-the-watch", label: "Read the Watch"},
    );
  } else if (station.kind === HUB_NPC_IDS.MASON) {
    const outer = run.gates.outer;
    const east = run.gates.east ?? outer;
    const heart = run.gates.heart;
    line = "Stone can be reset between assaults—even a breached outer gate.";
    status = `West ${Math.round(ratio(outer.integrity, outer.maxIntegrity) * 100)}% · East ${Math.round(ratio(east.integrity, east.maxIntegrity) * 100)}% · Heart ${Math.round(ratio(heart.integrity, heart.maxIntegrity) * 100)}%`;
    const outerRepair = previewGateRepair("outer");
    const eastRepair = previewGateRepair("east");
    const heartRepair = previewGateRepair("heart");
    cost = `${Math.min(outerRepair.repairCost, eastRepair.repairCost, heartRepair.repairCost)} Supplies per repair`;
    actions.push(
      {id: "repair-outer", label: `Repair West · ${outerRepair.repairCost}`, disabled: supplies < outerRepair.repairCost || outer.integrity >= outer.maxIntegrity},
      {id: "repair-east", label: `Repair East · ${eastRepair.repairCost}`, disabled: supplies < eastRepair.repairCost || east.integrity >= east.maxIntegrity},
      {id: "repair-heart", label: `Repair Heart · ${heartRepair.repairCost}`, disabled: supplies < heartRepair.repairCost || heart.integrity >= heart.maxIntegrity},
      {id: "oath-upgrades", label: "Strengthen the Hold"},
      {id: "daywork:set-the-brace", label: "Set the Brace"},
    );
  } else if (station.kind === HUB_NPC_IDS.QUARTERMASTER) {
    line = "Medicine, ammunition and the night's remaining stores are accounted for here.";
    status = `${Math.ceil(player.hp)}/${player.maxHp} Health · ${supplies} Supplies`;
    cost = run.playerMedicine?.prepared ? "Field medicine prepared" : "Preparation costs 30 Supplies";
    actions.push(
      {id: "prepare-medicine", label: "Prepare Field Medicine", disabled: run.playerMedicine?.prepared || supplies < 30},
      {id: "ready-weapons", label: "Ready Weapons"},
      {id: "oath-upgrades", label: "Open Oath Armory"},
      {id: "daywork:count-stores", label: "Count Stores"},
    );
  } else if (station.kind === HUB_NPC_IDS.TRAPPER) {
    const damaged = run.fortifications.filter(item => Number.isFinite(item.charges)
      && item.charges < FORTIFICATION_DEFINITIONS[item.type]?.charges).length;
    line = "The sockets remain in the world. The workshop restores their mechanisms.";
    status = `${run.fortifications.length} installed · ${damaged} depleted`;
    cost = damaged ? "10 Supplies restores all" : "Walk to a socket to build";
    const selectedDepleted = selectedSocket && run.fortifications.some(item => item.socketId === selectedSocket.id
      && Number.isFinite(item.charges) && item.charges <= 0);
    actions.push(
      {id: "daywork:prime-the-line", label: "Prime Selected Defence", disabled: !selectedDepleted},
      {id: "restore-defences", label: "Restore All Defences · 10", disabled: damaged === 0 || supplies < 10},
      {id: "show-sockets", label: "Mark Sockets"},
      {id: "oath-upgrades", label: "Hone Fieldcraft"},
    );
  } else if (station.kind === HUB_NPC_IDS.GREENWARDEN) {
    line = "One memory may root itself in this run before dawn.";
    status = run.wave >= 3 ? "Three boons are waiting" : "The shrine is sleeping";
    cost = "One run-only choice";
    actions.push(
      {id: "daywork:read-the-root", label: "Read the Root"},
      {id: "oath-upgrades", label: "Deepen Warden's Vigor"},
    );
  }
  const relationship = relationshipModelFor(station.kind);
  if (relationship.ready) {
    actions.unshift({id: `goal-report:${relationship.ready.id}`, label: `Report: ${relationship.ready.title}`});
  } else if (relationship.offer) {
    actions.unshift({id: `goal-accept:${relationship.offer.id}`, label: `Accept: ${relationship.offer.title}`});
  }
  configureHubService(station, {line, status, cost, actions});
  return true;
}

function repairHubGate(gateKey) {
  const gate = run.gates[gateKey];
  if (phase !== GAME_PHASES.DAYTIME || !gate || gate.integrity >= gate.maxIntegrity) return false;
  const bonus = calculatePermanentBonuses(profile).repairEfficiencyMultiplier
    * calculateRunBoonEffects(run).repairEfficiencyMultiplier;
  const restored = Math.round(180 * bonus);
  const preview = previewGateRepair(gateKey);
  const nextIntegrity = preview.nextIntegrity;
  const repairEventId = preview.request.eventId;
  if (run.supplies < preview.repairCost) return false;
  const consumed = consumeDayworkBenefit(run, {...preview.request, successful: true});
  run = {
    ...consumed.run,
    supplies: consumed.run.supplies - consumed.repairCost,
    gates: {...consumed.run.gates, [gateKey]: {...gate, integrity: nextIntegrity, destroyed: false}},
  };
  // Battlefield remains the live gate authority between waves. Keep it in
  // lockstep before persistRun() calls syncRunState(), otherwise the stale
  // combat value silently overwrites the Mason's repair.
  if (battlefield) {
    if (gateKey === "heart") battlefield.heartGateHp = nextIntegrity;
    else {
      const lane = gateKey === "east" ? EAST : WEST;
      battlefield.outerGateHp[lane] = nextIntegrity;
      battlefield.outerGateBreached[lane] = 0;
    }
  }
  const featureId = gateKey === "heart" ? HUB_FEATURE_IDS.HEART_GATE_MASONRY : HUB_FEATURE_IDS.OUTER_GATE_BRACING;
  setHubFeature(featureId, {integrity: nextIntegrity, repaired: true, tier: run.hub.features[featureId]?.tier ?? 0});
  world.updateGateVisual(gateKey === "heart" ? "heart" : gateKey === "east" ? "east" : "west", ratio(nextIntegrity, gate.maxIntegrity), false);
  audio.hubService(HUB_NPC_IDS.MASON);
  announce(`${gateKey === "heart" ? "Heart" : gateKey === "east" ? "East" : "West"} Gate restored by ${restored} for ${consumed.repairCost} Supplies`);
  applyGoalFact({type: "repair", eventId: repairEventId, gateId: gateKey, amount: nextIntegrity - gate.integrity});
  persistRun();
  openHubService(activeHubStation, {narrativeChecked: true});
  return true;
}

function validateHostCoopNarrativeAction(action, payload) {
  if (coopPreview?.role !== "host" || !coopPreview.connected) return payload;
  return validateCoopNarrativeMutation({
    request: {action, payload},
    executorRole: "host",
    requesterRole: "host",
    run,
  });
}

function handleHubServiceAction(actionId) {
  if (phase !== GAME_PHASES.DAYTIME || !activeHubStation || narrativePresentation.isOpen) return false;
  if (coopPreview?.role === "guest" && coopPreview.connected) return false;
  if (!activeHubActions.some(action => action.id === actionId && action.disabled !== true)) return false;
  if (actionId === "bell-confirm") {
    const station = activeHubStation;
    const request = {
      confirmationId: `run-${run.runOrdinal}-night-${run.night}-bell-confirmation`,
      briefingSceneId: bellkeeperBriefingSceneId(run.night),
      npcId: HUB_NPC_IDS.BELLKEEPER,
      inRange: nearestHubStation()?.station?.kind === HUB_NPC_IDS.BELLKEEPER,
      night: run.night,
      runOrdinal: run.runOrdinal,
    };
    try {
      validateHostCoopNarrativeAction("bell_confirm", {
        briefingSceneId: request.briefingSceneId,
        confirmationId: request.confirmationId,
        runOrdinal: request.runOrdinal,
        night: request.night,
      });
      run = confirmSoloBell({...run, player: serializePlayer()}, request, {
        hpMultiplier: coopPreview?.role === "host" && coopPreview.connected
          ? CAMPAIGN_COOP_MODIFIERS.bossHpMultiplier
          : TEST_MODE ? testBossHpMultiplier : 1,
        occupiedSockets: world.sockets.map(socket => ({id: socket.id, x: socket.x, z: socket.z})),
        objectiveLanePosition: {x: -16, z: 20},
      });
    } catch (error) {
      announce(error.message);
      openHubService(station, {narrativeChecked: true});
      return true;
    }
    applyGoalFact({
      type: "night-begin",
      eventId: `run-${run.runOrdinal}-night-${run.night}-begin`,
      night: run.night,
      runOrdinal: run.runOrdinal,
    });
    audio.hubService(HUB_NPC_IDS.BELLKEEPER);
    closeHubService();
    void startPreparedWaveAtCoopBoundary(run.wave, {reason: "bell_boundary"});
    return true;
  }
  if (actionId.startsWith("goal-accept:")) {
    const goalId = actionId.slice("goal-accept:".length);
    const station = activeHubStation;
    try {
      validateHostCoopNarrativeAction("goal_accept", {
        npcId: station.kind,
        goalId,
        eventId: `run-${run.runOrdinal}-night-${run.night}-accept-${goalId}`,
        runOrdinal: run.runOrdinal,
        night: run.night,
      });
      commitGoalAuthority(acceptRelationshipGoal(goalAuthorityState(), station.kind, goalId, {
        role: "host",
        profile,
      }));
      persistRun();
      announce("Relationship goal accepted");
      openHubService(station, {narrativeChecked: true});
    } catch (error) { announce(error.message); }
    return true;
  }
  if (actionId.startsWith("goal-report:")) {
    const goalId = actionId.slice("goal-report:".length);
    const station = activeHubStation;
    try {
      const eventId = `run-${run.runOrdinal}-night-${run.night}-report-${goalId}`;
      validateHostCoopNarrativeAction("goal_report", {
        npcId: station.kind,
        goalId,
        eventId,
        runOrdinal: run.runOrdinal,
        night: run.night,
      });
      commitGoalAuthority(reportRelationshipGoal(goalAuthorityState(), station.kind, {
        role: "host",
        eventId,
        goalId,
        phase,
        run,
      }));
      persistRun();
      announce("Relationship goal reported");
      openHubService(station, {narrativeChecked: true});
    } catch (error) { announce(error.message); }
    return true;
  }
  if (actionId.startsWith("daywork:")) {
    const dayworkActionId = actionId.slice("daywork:".length);
    const station = activeHubStation;
    const targetId = dayworkActionId === "prime-the-line" ? selectedSocket?.id ?? null : null;
    try {
      const dayworkRequest = {
        npcId: station.kind,
        actionId: dayworkActionId,
        targetId,
        night: run.night,
        runOrdinal: run.runOrdinal,
        requestId: `run-${run.runOrdinal}-night-${run.night}-daywork-${dayworkActionId}${targetId ? `-${targetId}` : ""}`,
      };
      validateHostCoopNarrativeAction("daywork", dayworkRequest);
      const result = applyDayworkAction(run, dayworkRequest);
      run = result.run;
      persistRun();
      restoreFortificationVisuals();
      announce(result.idempotent ? "That daytime work is already complete" : "Daytime work complete");
      openHubService(station, {narrativeChecked: true});
    } catch (error) { announce(error.message); }
    return true;
  }
  if (actionId === "prepare-medicine") {
    const station = activeHubStation;
    try {
      const medicineRequest = {
        night: run.night,
        runOrdinal: run.runOrdinal,
        requestId: `run-${run.runOrdinal}-night-${run.night}-prepare-medicine`,
      };
      validateHostCoopNarrativeAction("medicine_prepare", {
        npcId: station.kind,
        ...medicineRequest,
      });
      const result = prepareFieldMedicine(run, medicineRequest);
      run = result.run;
      persistRun();
      announce("Field medicine prepared for combat");
      openHubService(station, {narrativeChecked: true});
    } catch (error) { announce(error.message); }
    return true;
  }
  if (actionId === "oath-upgrades") return openPermanentProgression(activeHubStation);
  if (actionId.startsWith("buy-unlock:")) {
    const unlockId = actionId.slice("buy-unlock:".length);
    const station = activeHubStation;
    try {
      profile = applyOathHallAction(profile, `commission:${unlockId}`, {run});
      invalidateRunLoadoutCache();
      persistRun();
      const unlock = OATHMARK_UNLOCKS.find((entry) => entry.id === unlockId);
      announce(`${unlock?.name ?? "Weapon"} commissioned for every future run`);
      openPermanentProgression(station);
    } catch (error) { announce(error.message); }
    return true;
  }
  if (actionId.startsWith("buy-rank:")) {
    const trackId = actionId.slice("buy-rank:".length);
    const station = activeHubStation;
    try {
      profile = purchasePermanentRank(profile, trackId, {run});
      persistRun();
      const track = PERMANENT_RANK_BY_ID.get(trackId);
      announce(`${track?.name ?? "Permanent oath"} raised to rank ${profile.ranks[trackId]}`);
      openPermanentProgression(station);
    } catch (error) { announce(error.message); }
    return true;
  }
  if (actionId === "repair-outer") return repairHubGate("outer");
  if (actionId === "repair-east") return repairHubGate("east");
  if (actionId === "repair-heart") return repairHubGate("heart");
  if (actionId === "ready-weapons") {
    weapon.heat = 0;
    weapon.overheated = false;
    weapon.nextShotAt = 0;
    setHubFeature(HUB_FEATURE_IDS.QUARTERMASTER_STORES, {integrity: 1, repaired: true, tier: 0});
    audio.hubService(HUB_NPC_IDS.QUARTERMASTER);
    announce("Weapons cooled and checked");
    openHubService(activeHubStation, {narrativeChecked: true});
    return true;
  }
  if (actionId === "restore-defences") {
    run = {
      ...run,
      supplies: run.supplies - 10,
      fortifications: run.fortifications.map(item => ({
        ...item,
        charges: FORTIFICATION_DEFINITIONS[item.type]?.charges ?? item.charges,
      })),
    };
    setHubFeature(HUB_FEATURE_IDS.TRAPPER_WORKSHOP, {integrity: 1, repaired: true, tier: 0});
    setHubFeature(HUB_FEATURE_IDS.BALLISTA_LOFT, {integrity: 1, repaired: true, tier: 0});
    restoreFortificationVisuals();
    audio.hubService(HUB_NPC_IDS.TRAPPER);
    announce("Installed defences restored");
    persistRun();
    openHubService(activeHubStation, {narrativeChecked: true});
    return true;
  }
  if (actionId === "show-sockets") {
    audio.hubService(HUB_NPC_IDS.TRAPPER);
    closeHubService();
    announce("Defence sockets are marked in brass—walk to one and use Context");
    return true;
  }
  if (actionId === "choose-boon") {
    setHubFeature(HUB_FEATURE_IDS.WARD_LANTERN_NETWORK, {integrity: 1, repaired: true, tier: 0});
    audio.hubService(HUB_NPC_IDS.GREENWARDEN);
    closeHubService();
    enterBoonChoice();
    return true;
  }
  return false;
}

function refreshBuildChoices() {
  const near = nearestBuildSocket();
  selectedSocket = near?.socket || null;
  if (!selectedSocket) touchBuildSheetSocketId = null;
  const showChoices = Boolean(selectedSocket)
    && (currentInputSource !== INPUT_SOURCES.TOUCH || touchBuildSheetSocketId === selectedSocket.id);
  hudWrites.property("build:hidden", ui.buildChoices, "hidden", !showChoices);
  if (!selectedSocket) return;
  const installed = run.fortifications.find((item) => item.socketId === selectedSocket.id);
  writeHudText(
    "build:socket-name",
    ui.socketName,
    installed ? `${socketLabel(selectedSocket)} · ${FORTIFICATION_DEFINITIONS[installed.type]?.name || installed.type}` : socketLabel(selectedSocket),
  );
  const allowed = selectedSocket.allowedTypes || [];
  const unlocked = currentRunLoadout().fortifications;
  const alias = {thornSnare: "thorn-snare", firePot: "fire-pot", wardLantern: "ward-lantern"};
  for (const button of ui.buildChoiceButtons) {
    const type = button.dataset.fortification;
    const isAllowed = allowed.length === 0 || allowed.includes(type) || allowed.includes(alias[type] || type);
    const isUnlocked = unlocked.includes(type);
    const definition = FORTIFICATION_DEFINITIONS[type];
    const buttonKey = `build:${type}`;
    hudWrites.property(`${buttonKey}:hidden`, button, "hidden", !isAllowed);
    hudWrites.property(`${buttonKey}:disabled`, button, "disabled", !isUnlocked || Boolean(installed) || run.supplies < (definition?.cost || Infinity));
    hudWrites.dataset(`${buttonKey}:locked`, button, "locked", !isUnlocked);
    const descriptionText = isUnlocked
      ? definition?.description || ""
      : "Recruit the specialist and build their relationship; the Arbalest and knife remain ready.";
    hudWrites.property(`${buttonKey}:title`, button, "title", descriptionText);
    const description = button.querySelector("[data-fortification-description]");
    if (description) writeHudText(`${buttonKey}:description`, description, descriptionText);
    let price = hudPriceSpans.get(button);
    if (!price) {
      price = button.querySelector(".build-choice-price");
      hudPriceSpans.set(button, price);
    }
    if (price) writeHudText(`${buttonKey}:price`, price, isUnlocked ? String(definition?.cost ?? "") : "LOCKED");
  }
}

function enabledBuildChoices() {
  return ui.buildChoiceButtons.filter((button) => !button.hidden && !button.disabled);
}

const HUB_NPC_LABELS = Object.freeze({
  [HUB_NPC_IDS.BELLKEEPER]: "Bellkeeper",
  [HUB_NPC_IDS.MASON]: "Mason",
  [HUB_NPC_IDS.QUARTERMASTER]: "Quartermaster",
  [HUB_NPC_IDS.TRAPPER]: "Trapper",
  [HUB_NPC_IDS.GREENWARDEN]: "Greenwarden",
});

function applyDaytimeArrivals() {
  const arrivals = applyHubArrivals(profile, run);
  profile = {...profile, hubUnlocks: arrivals.hubUnlocks};
  invalidateRunLoadoutCache();
  run = {...run, hub: arrivals.hub};
  syncHubWorldPresentation();
  void ensureHubNpcPresentation();
  return [...(run.hub.introductionQueue ?? [])];
}

function enterDaytime(restored = false, {queueNarrative = true} = {}) {
  if (run.phase !== GAME_PHASES.DAYTIME) run = prepareSoloCampaignDaytime(profile, run, {night: run.night});
  bossPresentationAdapter.update({actors: [], telegraphs: [], zones: []});
  const introductions = applyDaytimeArrivals();
  setPhase(GAME_PHASES.DAYTIME);
  setBuildPanelExpanded(!compactBuildPanelMedia.matches);
  currentRoster = null;
  if (enemyRenderer) { enemyRenderer.dispose(); enemyRenderer = null; }
  battlefield = null;
  selectedSocket = null;
  touchBuildSheetSocketId = null;
  ui.buildTitle.textContent = `Daytime · Prepare Night ${run.night}`;
  const definition = getCampaignWave(run.night, 0);
  const intel = waveProgressionIntel(profile, definition, run);
  const intelCopy = intel.revealComposition
    ? ` Bellkeeper intel: ${intel.compositionLabel}.${intel.telegraphSeconds > 0 ? ` Elite and fixed-actor release cues sound ${intel.telegraphSeconds} seconds early.` : ""}`
    : "";
  ui.buildBriefing.textContent = `${currentRunLoadout().message} ${definition.objective} ${intel.briefingHint}${intelCopy}`;
  ui.wardenOrder.textContent = "Warden's order: prepare the hold, speak with Nell, then confirm the bell.";
  ui.waveText.textContent = `Daytime · Night ${run.night}`;
  ui.objectiveText.textContent = "Speak with Nell at the bell";
  ui.enemyCountText.textContent = "0";
  ui.buildChoices.hidden = true;
  ui.supplies.textContent = run.supplies;
  restoreFortificationVisuals();
  persistRun();
  if (!introductions.length) {
    announce(restored ? "Daylight restored at the hold" : "The path is quiet—for now");
  }
  if (queueNarrative) queueMicrotask(startDaytimeNarrativeFlow);
}

function enterRecovery(restored = false) {
  if (!run || run.phase !== GAME_PHASES.INTERWAVE_RECOVERY) return false;
  setPhase(GAME_PHASES.INTERWAVE_RECOVERY);
  currentRoster = null;
  enemyRenderer?.dispose();
  enemyRenderer = null;
  battlefield = null;
  ui.waveText.textContent = `Recovery · Wave ${run.wave + 1} incoming`;
  ui.objectiveText.textContent = "Move, reload and cool weapons";
  recoveryPresentation.show({warning: "The next wave begins automatically", remainingMs: run.recovery.remainingMs});
  if (!restored) persistRun();
  return true;
}

function restoreFortificationVisuals() {
  world.clearFortificationVisuals();
  for (const placement of run?.fortifications || []) {
    const active = !Number.isFinite(placement.charges) || placement.charges > 0;
    try { world.placeFortificationVisual(placement.socketId, placement.type, {active}); }
    catch (error) { console.warn("[Briarhold] Fortification visual skipped", error); }
  }
}

function fortificationStateKey(fortifications = []) {
  return fortifications
    .map(item => `${item.socketId}:${item.type}:${Number.isFinite(item.charges) ? item.charges : 'inf'}`)
    .sort()
    .join('|');
}

function installSelectedFortification(type) {
  if (phase !== GAME_PHASES.DAYTIME || !selectedSocket) return false;
  if (coopPreview?.role === "guest" && coopPreview.connected) {
    const requestId = coopPreview.sendAction("build", {
      fortificationType: type,
      socketId: selectedSocket.id,
    });
    if (requestId) announce("Build request sent to the host");
    return Boolean(requestId);
  }
  const definition = FORTIFICATION_DEFINITIONS[type];
  if (!currentRunLoadout().fortifications.includes(type)) { announce("That defence recipe is still locked"); return false; }
  if (!definition || run.supplies < definition.cost) { announce("Not enough Supplies"); return false; }
  if (run.fortifications.some((item) => item.socketId === selectedSocket.id)) { announce("That socket is occupied"); return false; }
  const alias = {thornSnare: "thorn-snare", firePot: "fire-pot", wardLantern: "ward-lantern"};
  const allowed = selectedSocket.allowedTypes || [];
  if (allowed.length && !allowed.includes(type) && !allowed.includes(alias[type] || type)) { announce("That defence does not fit this socket"); return false; }
  run = {
    ...run,
    supplies: run.supplies - definition.cost,
    fortifications: [...run.fortifications, {socketId: selectedSocket.id, type, charges: definition.charges}],
  };
  world.placeFortificationVisual(selectedSocket.id, type, {active: true});
  audio.fortify();
  announce(`${definition.name} installed`);
  ui.supplies.textContent = run.supplies;
  if (currentInputSource === INPUT_SOURCES.TOUCH) touchBuildSheetSocketId = null;
  refreshBuildChoices();
  if (currentInputSource === INPUT_SOURCES.TOUCH && compactBuildPanelMedia.matches) setBuildPanelExpanded(false);
  persistRun();
  return true;
}

function applyFortificationsToBattlefield() {
  if (!battlefield) return;
  battlefield.clearBarricades();
  battlefield.clearEnemyObstacles();
  for (const obstacle of BRIARHOLD_ENEMY_GROUND_OBSTACLES) {
    battlefield.setEnemyObstacle(obstacle);
  }
  const enemyFootprints = {
    barricade: {halfWidth: 2.9, halfDepth: 1.1, solid: true},
    thornSnare: {halfWidth: 2.6, halfDepth: 2.6, solid: false, slowScale: FORTIFICATION_DEFINITIONS.thornSnare.slow},
    firePot: {halfWidth: 0.8, halfDepth: 0.8, solid: true},
    wardLantern: {halfWidth: 0.5, halfDepth: 0.5, solid: true},
    ballista: {halfWidth: 1.35, halfDepth: 2.3, solid: true},
  };
  for (const placement of run.fortifications) {
    const socket = world.sockets.find((item) => item.id === placement.socketId);
    if (!socket) continue;
    if (placement.type === "barricade") {
      const approach = socket.approach === "east" ? "east" : "west";
      const laneCenter = approach === "east" ? 16 : -16;
      battlefield.setBarricade(approach, {
        id: placement.socketId,
        z: socket.z,
        shiftX: routeShiftAwayFromSocket(socket.x, laneCenter),
        influence: 24,
      });
    }
    const hasCharge = !Number.isFinite(placement.charges) || placement.charges > 0;
    const footprint = placement.type === "thornSnare" && !hasCharge
      ? null
      : enemyFootprints[placement.type];
    // Enemy movement is a ground-plane simulation. Rampart weapons remain
    // visible and player-solid without creating an invisible obstacle below.
    if (footprint && socket.y <= 1.6) {
      battlefield.setEnemyObstacle({
        id: placement.socketId,
        x: socket.x,
        z: socket.z,
        yaw: socket.facing,
        ...footprint,
      });
    }
  }
}

function syncCoopMovementGateState() {
  if (coopPreview?.role !== 'host' || !coopPreview.authority?.battlefield || !battlefield) return;
  const movementBattlefield = coopPreview.authority.battlefield;
  movementBattlefield.outerGateHp[WEST] = battlefield.outerGateHp[WEST];
  movementBattlefield.outerGateHp[EAST] = battlefield.outerGateHp[EAST];
  movementBattlefield.outerGateBreached[WEST] = battlefield.outerGateBreached[WEST];
  movementBattlefield.outerGateBreached[EAST] = battlefield.outerGateBreached[EAST];
  movementBattlefield.heartGateHp = battlefield.heartGateHp;
}

function setBossMeterLabel(name) {
  const label = `${name || "Boss"} health`;
  ui.bossStatus.setAttribute("aria-label", label);
  ui.bossHealthBar.setAttribute("aria-label", label);
}

async function prepareBattlefield(waveIndex) {
  const token = ++prepareToken;
  const roster = buildCampaignWaveRoster(
    run.night,
    waveIndex,
    densityProfile,
    {
      ...(TEST_MODE
        ? {targetBodies: TEST_BODY_CAP, maxBodies: TEST_BODY_CAP}
        : PREVIEW_MODE ? {maxBodies: PREVIEW_BODY_CAP} : {}),
      session: coopPreview?.role === "host" && coopPreview.connected ? "coop" : "solo",
    },
  );
  const gates = run.gates;
  const nextBattlefield = createBattlefield({
    capacity: roster.bodyCount,
    outerGateHp: gates.outer?.maxIntegrity || 1200,
    heartGateHp: gates.heart?.maxIntegrity || 2200,
    outerGatePressureScale: roster.outerGatePressureScale,
    outerGateContactPressureScale: roster.outerGateContactPressureScale,
    world: {
      spawnZ: HOST_EMERGENCE_PROFILE.spawnNearZ,
      ...HOST_EMERGENCE_PROFILE,
    },
  }).initialize(roster.enemies);
  let spawnMinX = Number.POSITIVE_INFINITY;
  let spawnMaxX = Number.NEGATIVE_INFINITY;
  let spawnMinZ = Number.POSITIVE_INFINITY;
  let spawnMaxZ = Number.NEGATIVE_INFINITY;
  for (let id = 0; id < nextBattlefield.slotCount; id += 1) {
    spawnMinX = Math.min(spawnMinX, nextBattlefield.x[id]);
    spawnMaxX = Math.max(spawnMaxX, nextBattlefield.x[id]);
    spawnMinZ = Math.min(spawnMinZ, nextBattlefield.z[id]);
    spawnMaxZ = Math.max(spawnMaxZ, nextBattlefield.z[id]);
  }
  document.body.dataset.enemySpawnBounds = [spawnMinX, spawnMaxX, spawnMinZ, spawnMaxZ]
    .map(value => value.toFixed(1))
    .join(',');
  nextBattlefield.outerGateHp[WEST] = Math.max(0, gates.outer?.integrity ?? nextBattlefield.outerGateMaxHp);
  nextBattlefield.outerGateHp[EAST] = Math.max(0, gates.east?.integrity ?? gates.outer?.integrity ?? nextBattlefield.outerGateMaxHp);
  nextBattlefield.heartGateHp = Math.max(0, gates.heart?.integrity ?? nextBattlefield.heartGateMaxHp);
  if (gates.outer?.destroyed || nextBattlefield.outerGateHp[WEST] <= 0) nextBattlefield.outerGateBreached[WEST] = 1;
  if (gates.east?.destroyed || nextBattlefield.outerGateHp[EAST] <= 0) nextBattlefield.outerGateBreached[EAST] = 1;
  const presentation = refreshEnemyPresentationResolution();
  const nextRenderer = await createEnemyRenderer({
    BABYLON, scene: world.scene, camera: world.camera, battlefield: nextBattlefield,
    profile: rendererProfile,
    forceLegacy: search.has("legacySprites"),
    animated3dLimit: presentation.maxAnimatedEnemies,
  });
  if (token !== prepareToken) { nextRenderer.dispose(); return false; }
  enemyRenderer?.dispose();
  battlefield = nextBattlefield;
  syncCoopMovementGateState();
  enemyRenderer = nextRenderer;
  currentRoster = roster;
  knife = createKnifeMeleeState();
  applyFortificationsToBattlefield();
  return true;
}

async function startPreparedWave(waveIndex = run?.wave || 0, {restored = false} = {}) {
  if (!run || waveIndex < 0 || waveIndex > 2 || wavePreparationPending) return false;
  if (run.phase !== GAME_PHASES.COMBAT || !run.bellConfirmation || !run.waveStartSnapshot) return false;
  wavePreparationPending = true;
  try {
    let prepared = false;
    try {
      await audio.unlock();
      prepared = await prepareBattlefield(waveIndex);
    } catch (error) {
      console.error("[Briarhold] Wave preparation failed", error);
    }
    if (!prepared) {
      announce("The host could not be gathered");
      void ensureHubNpcPresentation();
      return false;
    }
    run = {...run, wave: waveIndex, phase: GAME_PHASES.COMBAT};
    ensureHubCombatState();
    resetFrameTiming();
    setPhase(GAME_PHASES.COMBAT);
    void ensureHubNpcPresentation();
    publishAuthoritativeMusicCue("wave_start", null, {
      ...(run.bossEncounter?.encounterId ? {encounterId: run.bossEncounter.encounterId} : {}),
    });
    setTimeout(() => {
      if (phase === GAME_PHASES.COMBAT && run?.wave === waveIndex && !wickerBossAnnounced) audio.setMode("combat");
    }, 1200);
    applyFortificationsToBattlefield();
    lastOuterBreached = Boolean(battlefield.outerGateBreached[WEST] || battlefield.outerGateBreached[EAST]);
    lastTrapTick = 0;
    combatAttribution = [];
    nextProgressionSaveAt = 0;
    thornSnareOccupants.clear();
    armourCrackUntil.clear();
    pendingMasteryImpacts = [];
    coopDelayedEffects = createAuthoritativeDelayedEffectQueue();
    bossCommandSequence = 0;
    bossEventCursor = 0;
    bossFrameRemainderMs = 0;
    bossZoneDamageAt.clear();
    wickerBossId = run.bossEncounter?.mode === "crowd-authored"
      ? currentRoster.enemies.findIndex(enemy => enemy.type === WICKER_COLOSSUS)
      : -1;
    wickerBossAnnounced = false;
    wickerBossDefeated = false;
    firstHunterAnnounced = false;
    currentCombatTuning = runtimeProgressionTuning(profile, run, weapon.selected, {ads: adsActive});
    const waveIntel = waveProgressionIntel(profile, currentRoster, run);
    releaseTelegraphs = waveIntel.releaseTelegraphs.map((cue) => ({...cue, announced: false}));
    const authoredBoss = run.bossEncounter?.mode === "authored-director";
    show(ui.bossStatus, false);
    if (authoredBoss) applyBossDirectorUpdate();
    persistRun();
    audio.nightStart(run.night);
    ui.waveText.textContent = currentRoster.title;
    ui.objectiveText.textContent = currentRoster.objective;
    announce(restored ? `Wave ${waveIndex + 1} restored at its beginning` : currentRoster.title);
    if (document.pointerLockElement !== canvas && currentInputSource === INPUT_SOURCES.MOUSE) canvas.focus();
    return true;
  } finally {
    wavePreparationPending = false;
  }
}

async function startPreparedWaveAtCoopBoundary(waveIndex, {reason = "wave_boundary", restored = false} = {}) {
  return startWithCoopBoundaryPause(
    coopAuthorityPauseScopes,
    coopPreview,
    () => startPreparedWave(waveIndex, {restored}),
    reason,
  );
}

function sporewingTargetProfile(id = null) {
  const z = Number.isInteger(id) && battlefield ? battlefield.z[id] : 20;
  return sporewingTargetProfileAtGate(z, battlefield?.world?.gateZ ?? 0);
}

function enemyAimHeight(type, id = null) {
  if (type === SPOREWING) return sporewingTargetProfile(id).centerY;
  if (type >= 5) return 3.1;
  if (type === 1) return 1.75;
  return 1.25;
}

function enemyTargetHalfHeight(type, id = null) {
  return type === SPOREWING
    ? sporewingTargetProfile(id).halfHeight
    : enemyArchetype(type).radius;
}

function touchEnemyAimHeight(type, id, ray) {
  if (type !== SPOREWING) return enemyAimHeight(type);
  return reticleClampedTargetHeight({
    origin: ray.origin,
    aimDirection: ray.direction,
    targetX: battlefield.x[id],
    targetZ: battlefield.z[id],
    centerY: sporewingTargetProfile(id).centerY,
    halfHeight: sporewingTargetProfile(id).halfHeight,
  });
}

function touchAimAssistTarget(frame, ray, {coneDegrees, requireAimAssist = true} = {}) {
  if (frame.source !== INPUT_SOURCES.TOUCH || !battlefield) return null;
  const strength = Number(ui.aimAssist.value) / 100;
  if (requireAimAssist && (!Number.isFinite(strength) || strength <= 0)) return null;
  const targetHeight = (type, id) => touchEnemyAimHeight(type, id, ray);
  const candidateIds = rankTouchAimAssistCandidateIds({
    origin: ray.origin,
    aimDirection: ray.direction,
    x: battlefield.x,
    z: battlefield.z,
    type: battlefield.type,
    status: battlefield.status,
    slotCount: battlefield.slotCount,
    activeStatus: ACTIVE,
    aimHeight: targetHeight,
    coneDegrees,
    maxCandidates: TOUCH_AIM_ASSIST_OCCLUSION_BUDGET,
  });
  const crowdTarget = selectFirstVisibleTouchAimAssistTarget({
    candidateIds,
    targetForId: (id) => ({
      id,
      aimPoint: {x: battlefield.x[id], y: targetHeight(battlefield.type[id], id), z: battlefield.z[id]},
      active: true,
    }),
    isOccluded: (_target, aimPoint) => world.isWorldOccluded(ray.origin, aimPoint),
  });
  if (crowdTarget) return crowdTarget;
  return selectBossTouchAimAssistTarget(run?.bossEncounter, {
    origin: ray.origin,
    aimDirection: ray.direction,
    coneDegrees,
    isOccluded: (_target, aimPoint) => world.isWorldOccluded(ray.origin, aimPoint),
  });
}

function aimDirectionForFrame(frame, ray, knownTarget = undefined, {automatic = false} = {}) {
  if (frame.source !== INPUT_SOURCES.TOUCH || !battlefield) return ray.direction;
  if (automatic) return touchAutomaticFireDirection({
    inputFrame: frame,
    origin: ray.origin,
    aimDirection: ray.direction,
    target: knownTarget,
  });
  const strength = Number(ui.aimAssist.value) / 100;
  if (!Number.isFinite(strength) || strength <= 0) return ray.direction;
  const target = knownTarget === undefined ? touchAimAssistTarget(frame, ray) : knownTarget;
  if (!target) return ray.direction;
  return applyTouchAimAssist({
    inputFrame: frame,
    origin: ray.origin,
    aimDirection: ray.direction,
    targets: [target],
    strength,
  }).direction;
}

function recordEnemyDamage(source, id, result) {
  if (!result?.hit || !battlefield) return result;
  combatAttribution = appendCombatAttribution(combatAttribution, {
    at: battlefield.elapsed,
    source,
    enemyId: id,
    killed: result.killed,
  });
  if (!coopPreview?.connected && source.startsWith("player:") && Number.isFinite(result.damage) && result.damage > 0) {
    const weaponId = source.slice("player:".length);
    const baseId = goalEventId("combat", `${weaponId}-${id}`);
    for (const event of createCombatGoalEvents({
      actorId: "warden-local",
      weaponId,
      hits: [{enemyId: id, damage: result.damage, killed: result.killed}],
    }, {eventId: baseId})) applyGoalFact(event);
  }
  return result;
}

function damageEnemy(id, baseDamage, feedbackSummary = null, explicitArmourMultiplier = null, source = null) {
  const armour = enemyArmour(battlefield.type[id]);
  const permanent = calculatePermanentBonuses(profile).weaponDamageMultiplier;
  const boon = calculateRunBoonEffects(run).weaponDamageMultiplier;
  const resolvedSource = source ?? `player:${weapon.selected}`;
  const sourceWeaponId = resolvedSource.startsWith("player:")
    ? resolvedSource.slice("player:".length)
    : weapon.selected;
  const damageWeaponId = WEAPON_IDS.includes(sourceWeaponId) ? sourceWeaponId : weapon.selected;
  const weaponDamage = weaponDamageAgainst(damageWeaponId, armour);
  const definitionDamage = WEAPON_DEFINITIONS[damageWeaponId].damage;
  const armourMultiplier = Number.isFinite(explicitArmourMultiplier)
    ? Math.max(0, explicitArmourMultiplier)
    : weaponDamage / definitionDamage;
  const crack = armourCrackUntil.get(id);
  const crackMultiplier = crack?.until > battlefield.elapsed ? crack.damageMultiplier : 1;
  const appliedDamage = baseDamage * armourMultiplier * permanent * boon * crackMultiplier;
  const result = battlefield.damageEnemy(id, appliedDamage);
  recordEnemyDamage(resolvedSource, id, {...result, damage: appliedDamage});
  if (result.hit) {
    const feedback = result.killed
      ? HIT_FEEDBACK.KILL
      : armourMultiplier < 0.75 ? HIT_FEEDBACK.ARMOUR : HIT_FEEDBACK.HIT;
    recordShotFeedback(feedbackSummary, result, feedback);
    result.feedback = feedback;
  }
  if (result.killed) {
    killsThisRun++;
    if (battlefield.type[id] === MOSSGUARD_SHIELD
      && run?.bossEncounter?.encounterId === "moss-crowned-matron"
      && run.bossEncounter.status === "active") {
      const matron = run.bossEncounter.actors.find(actor => actor.id === "moss-crowned-matron" && !actor.defeated);
      if (matron?.livingMossguards > 0) {
        const rosterEnemy = currentRoster?.enemies?.[id];
        applyBossDirectorUpdate({commands: [{
          id: `mossguard-feed:${rosterEnemy?.groupId ?? "crowd"}:${rosterEnemy?.groupBodyIndex ?? id}`,
          type: "objective_interaction",
          actorId: matron.id,
          targetId: `mossguard-feed:${3 - matron.livingMossguards}`,
        }]});
      }
    }
    const xpWeaponId = resolvedSource.startsWith("player:")
      ? resolvedSource.slice("player:".length)
      : null;
    if (currentRoster && WEAPON_IDS.includes(xpWeaponId)) {
      const killEffects = applyCampaignWeaponKillEffects(profile, run, currentRoster, id, xpWeaponId, {
        killed: result.killed,
        heat: weapon.heat,
        killHeatRefund: currentCombatTuning?.killHeatRefund ?? 0,
      });
      profile = killEffects.profile;
      run = killEffects.run;
      weapon.heat = killEffects.heat;
      if (killEffects.granted && battlefield.elapsed + 1e-9 >= nextProgressionSaveAt) {
        nextProgressionSaveAt = battlefield.elapsed + 0.5;
        persistRun();
      }
    }
  }
  return result;
}

function authoredBossActive() {
  return run?.bossEncounter?.mode === "authored-director" && run.bossEncounter.status === "active";
}

function authoredBossNeedsPresentationStep() {
  return run?.bossEncounter?.mode === "authored-director"
    && (run.bossEncounter.status === "active"
      || run.bossEncounter.actors.some(actor => actor.defeated && run.bossEncounter.timeMs < actor.presentationUntilMs));
}

function nextBossCommandId(kind, actorId = "encounter") {
  bossCommandSequence += 1;
  return `boss:${run?.night ?? 0}:${run?.wave ?? 0}:${kind}:${actorId}:${bossCommandSequence}`;
}

function applyBossDirectorUpdate({elapsedMs = 0, commands = [], crowdCleared = false} = {}) {
  if (run?.bossEncounter?.mode !== "authored-director") return null;
  const previousSequence = run.bossEncounter.eventSequence;
  run = updateSoloBossEncounter(run, {elapsedMs, commands, crowdCleared});
  const snapshot = buildBossPresentationSnapshot(run.bossEncounter, run.bossEncounter.accumulatorMs / 50, {afterEventSequence: bossEventCursor});
  bossPresentationAdapter.update(snapshot);
  for (const announcement of snapshot.announcements) announce(announcement.text);
  bossEventCursor = snapshot.eventSequence;
  const newEvents = run.bossEncounter.events.filter(event => event.sequence > previousSequence);
  for (const event of newEvents) {
    appendCoopSemanticEvent("boss", event.type, event.actorId ?? null, event);
    if (event.type === "boss_intro") publishAuthoritativeMusicCue("boss_intro", event.actorId ?? null,
      {encounterId: run.bossEncounter.encounterId});
    if (event.type === "boss_phase") {
      const cue = event.phase >= 4 ? "boss_final" : event.phase >= 3 ? "boss_enraged" : `boss_phase_${event.phase}`;
      publishAuthoritativeMusicCue(cue, event.actorId ?? null,
        {encounterId: run.bossEncounter.encounterId, phase: event.phase});
    }
    if (event.type === "attack_telegraph" && event.actorId === "cinderwing" && event.attack === "lane_strafe") {
      publishAuthoritativeMusicCue("dragon_breath_warning", event.actorId,
        {encounterId: run.bossEncounter.encounterId, attack: event.attack});
    }
    if (event.type === "dragon_breath") publishAuthoritativeMusicCue("dragon_breath", event.actorId ?? null,
      {encounterId: run.bossEncounter.encounterId, zoneId: event.zoneId});
    if (event.type === "encounter_defeat") publishAuthoritativeMusicCue("boss_defeat", event.actorId ?? null,
      {encounterId: run.bossEncounter.encounterId});
    if (event.type === "socket_disabled") world.updateFortificationStatus(event.socketId, {active: false});
    if (event.type === "gate_damage" && battlefield) {
      if (event.targetId === "heart") battlefield.heartGateHp = Math.max(0, battlefield.heartGateHp - event.amount);
      else if (event.targetId === "east") battlefield.outerGateHp[EAST] = Math.max(0, battlefield.outerGateHp[EAST] - event.amount);
      else battlefield.outerGateHp[WEST] = Math.max(0, battlefield.outerGateHp[WEST] - event.amount);
    }
    if (event.type === "boss_defeat") {
      killsThisRun += 1;
      const weaponId = event.weaponId;
      const coopOwnsDefeatProgression = coopPreview?.role === 'host' && coopPreview.connected;
      if (WEAPON_IDS.includes(weaponId) && !coopOwnsDefeatProgression) {
        const xp = grantWeaponXp(profile, run, {
          enemyId: campaignBossWeaponEnemyId(run, event.actorId),
          enemyKind: "boss",
          weaponId,
        });
        profile = xp.profile;
        run = xp.run;
        if (weaponId === "arbalest") {
          const tuning = weapon.selected === weaponId
            ? currentCombatTuning
            : runtimeProgressionTuning(profile, run, weaponId);
          weapon.heat = Math.max(0, weapon.heat - (tuning?.killHeatRefund ?? 0));
        }
      }
    }
  }
  writeHudText("boss:name", ui.bossName, snapshot.hud.name);
  setBossMeterLabel(snapshot.hud.name);
  writeHudText("boss:hp", ui.bossHealthText, `${Math.ceil(snapshot.hud.hp).toLocaleString()} · Phase ${snapshot.hud.phase}`);
  writeHudText("boss:individuals", ui.bossIndividuals, snapshot.hud.individualHp.map(actor => `${actor.title} ${Math.ceil(actor.hp).toLocaleString()}/${actor.maxHp.toLocaleString()}`).join(" · "));
  writeHudText("boss:counter", ui.bossCounterText, snapshot.hud.counterText);
  setMeter(ui.bossHealthBar, snapshot.hud.hp, snapshot.hud.maxHp);
  show(ui.bossStatus, run.bossEncounter.status !== "waiting" && run.bossEncounter.status !== "defeated");
  return {snapshot, newEvents};
}

function damageBossActor(actorId, baseDamage, weaponId, {armourMultiplier = 1, stagger = 0, sourcePosition = player.position} = {}) {
  if (!authoredBossActive()) return false;
  const actor = run.bossEncounter.actors.find(item => item.id === actorId && !item.defeated);
  if (!actor) return false;
  const permanent = calculatePermanentBonuses(profile).weaponDamageMultiplier;
  const boonEffects = calculateRunBoonEffects(run);
  const beforeHp = actor.hp;
  applyBossDirectorUpdate({commands: [{
    id: nextBossCommandId("hit", actorId),
    type: "warden_hit",
    actorId,
    weaponId,
    damage: Math.max(0, baseDamage) * permanent * boonEffects.weaponDamageMultiplier,
    stagger,
    staggerMultiplier: 1,
    armourMultiplier,
    heading: Math.atan2(sourcePosition.x - actor.position.x, sourcePosition.z - actor.position.z),
  }]});
  const after = run.bossEncounter.actors.find(item => item.id === actorId);
  return after.hp < beforeHp || after.stagger > actor.stagger;
}

function updateBossDamageVolumes(now, {coopAuthority = false} = {}) {
  if (!authoredBossActive()) return;
  const snapshot = buildBossPresentationSnapshot(run.bossEncounter, 1);
  const damageMultiplier = calculateRunBoonEffects(run).fireZoneDamageMultiplier;
  const targets = coopAuthority
    ? [...coopPreview.authority.players.values()]
    : [{playerId: "warden-host", position: player.position}];
  for (const target of targets) {
    const cadence = {
      get: id => bossZoneDamageAt.get(`${target.playerId}:${id}`),
      set: (id, value) => bossZoneDamageAt.set(`${target.playerId}:${id}`, value),
    };
    for (const volume of collectBossDamageContacts(
      snapshot,
      {x: target.position.x, z: target.position.z},
      now * 1000,
      cadence,
    )) {
      const fire = volume.kind === "ash" || volume.kind === "fire_breath";
      const amount = fire ? 12 * damageMultiplier : 8;
      if (coopAuthority) coopPreview.applyPlayerDamage(target.playerId, amount);
      else damagePlayer(player, amount);
    }
  }
}

function aimedHeraldForWardPulse() {
  const boss = coopPreview?.role === "guest" ? coopPreview.latestFrame?.boss : run?.bossEncounter;
  if (boss?.mode !== "authored-director" || boss.status !== "active") return null;
  const actor = boss.actors.find(item => item.id === "moonless-herald" && !item.defeated && item.state === "phased");
  if (!actor) return null;
  const dx = actor.position.x - player.position.x;
  const dz = actor.position.z - player.position.z;
  const distance = Math.hypot(dx, dz);
  const direction = {x: Math.sin(player.facing.yaw), z: Math.cos(player.facing.yaw)};
  const dot = distance > 0 ? (dx * direction.x + dz * direction.z) / distance : -1;
  if (distance > 24 || dot < Math.cos(Math.PI / 4)) return null;
  const origin = {x: player.position.x, y: player.position.y + PLAYER_DEFAULTS.eyeHeight, z: player.position.z};
  if (world.isWorldOccluded(origin, {x: actor.position.x, y: actor.position.y + 1, z: actor.position.z})) return null;
  return {actor, direction};
}

function staggerEnemy(id, seconds) {
  if (!Number.isInteger(id) || battlefield.status[id] !== ACTIVE || !(seconds > 0)) return false;
  battlefield.attackCooldown[id] = Math.max(battlefield.attackCooldown[id], seconds);
  battlefield.vx[id] *= 0.2;
  battlefield.vz[id] *= 0.2;
  return true;
}

function scheduleMasteryImpact(point, shot, now) {
  const delay = currentCombatTuning?.clusterSplitDelaySeconds ?? 0;
  const damageMultiplier = currentCombatTuning?.clusterSplitDamageMultiplier ?? 0;
  const radius = currentCombatTuning?.clusterSplitRadius ?? 0;
  if (!(delay > 0 && damageMultiplier > 0 && radius > 0)) return;
  pendingMasteryImpacts.push({
    at: now + delay,
    point: {...point},
    damage: shot.damage * damageMultiplier,
    radius,
  });
}

function resolvePendingMasteryImpacts() {
  if (!battlefield) return;
  const remaining = [];
  for (const impact of pendingMasteryImpacts) {
    if (battlefield.elapsed + 1e-9 < impact.at) {
      remaining.push(impact);
      continue;
    }
    const hits = battlefield.queryHits({...impact.point, radius: impact.radius, maxResults: 48});
    for (const id of hits) damageEnemy(id, impact.damage, null, null, "player:runebolt");
    for (const actorId of bossesInRadius(run?.bossEncounter, {...impact.point, radius: impact.radius})) {
      damageBossActor(actorId, impact.damage, "runebolt", {
        armourMultiplier: currentCombatTuning?.armourCrackDamageMultiplier ?? 1,
        stagger: (currentCombatTuning?.gravityPulseSeconds ?? 0) * 20,
      });
    }
    world.impact(new BABYLON.Vector3(impact.point.x, Math.max(0.3, impact.point.y), impact.point.z), "#b6e7c8", 2.8);
  }
  pendingMasteryImpacts = remaining;
  if (coopPreview?.role !== "host") return;
  resolveDueAuthoritativeDelayedEffects(coopDelayedEffects, battlefield.elapsed, impact => {
    const hitResults = [];
    for (const id of battlefield.queryHits({...impact.point, radius: impact.radius, maxResults: 48})) {
      const armour = enemyArmour(battlefield.type[id]);
      const definitionDamage = WEAPON_DEFINITIONS[impact.weaponId].damage;
      const naturalArmourMultiplier = weaponDamageAgainst(impact.weaponId, armour) / definitionDamage;
      const crackMultiplier = delayedArmourMultiplierForTarget(impact, `enemy:${id}`);
      const permanent = calculatePermanentBonuses(profile).weaponDamageMultiplier;
      const boon = calculateRunBoonEffects(run).weaponDamageMultiplier;
      const result = battlefield.damageEnemy(id, impact.damage * naturalArmourMultiplier * permanent * boon * crackMultiplier);
      recordEnemyDamage(`player:${impact.weaponId}`, id, result);
      hitResults.push({enemyId: id, killed: result.killed});
      if (result.killed) killsThisRun += 1;
    }
    if (currentRoster && hitResults.some(hit => hit.killed)) {
      const progression = applyAuthoritativeDelayedKillProgression({
        profile, run, roster: currentRoster, session: coopPreview.authority, effect: impact, hits: hitResults,
      });
      profile = progression.profile;
      run = progression.run;
    }
    for (const actorId of bossesInRadius(run?.bossEncounter, {...impact.point, radius: impact.radius})) {
      const before = run.bossEncounter?.actors.find(actor => actor.id === actorId);
      const applied = damageBossActor(actorId, impact.damage, impact.weaponId, {
        armourMultiplier: delayedArmourMultiplierForTarget(impact, `boss:${actorId}`),
        stagger: impact.stagger,
      });
      const after = run.bossEncounter?.actors.find(actor => actor.id === actorId);
      if (!applied || !before || before.defeated || after?.defeated !== true) continue;
      const progression = applyAuthoritativeDelayedBossKillProgression({profile, run,
        session: coopPreview.authority, effect: impact, actorId, killed: true,
        directorDefeatCounted: true});
      profile = progression.profile;
      run = progression.run;
      if (impact.actorId === coopPreview.localId && weapon.selected === impact.weaponId) weapon.heat = progression.heat;
    }
    world.impact(new BABYLON.Vector3(impact.point.x, Math.max(0.3, impact.point.y), impact.point.z), "#b6e7c8", 2.8);
    return true;
  });
}

function meleeCandidateIds(halfAngle) {
  return rankKnifeMeleeCandidateIds({
    playerX: player.position.x,
    playerY: player.position.y,
    playerZ: player.position.z,
    facingYaw: player.facing.yaw,
    x: battlefield.x,
    z: battlefield.z,
    type: battlefield.type,
    status: battlefield.status,
    slotCount: battlefield.slotCount,
    activeStatus: ACTIVE,
    radiusForType: type => enemyArchetype(type).radius,
    halfHeightForType: enemyTargetHalfHeight,
    aimHeightForType: enemyAimHeight,
    halfAngle,
  });
}

function visibleMeleeTarget(halfAngle, requiredId = null) {
  const bossCandidates = authoredBossActive()
    ? bossesInViewCone(run.bossEncounter, {
      origin: {x: player.position.x, z: player.position.z},
      direction: {x: Math.sin(player.yaw), z: Math.cos(player.yaw)},
      range: 3.4,
      halfAngle,
    })
    : [];
  if (typeof requiredId === "string") return bossCandidates.includes(requiredId) ? requiredId : null;
  const candidates = meleeCandidateIds(halfAngle);
  const origin = {x: player.position.x, y: player.position.y + 1.15, z: player.position.z};
  for (const id of candidates) {
    if (requiredId !== null && id !== requiredId) continue;
    const slashLow = player.position.y + KNIFE_MELEE.slashLowOffset;
    const slashHigh = player.position.y + KNIFE_MELEE.slashHighOffset;
    const target = {
      x: battlefield.x[id],
      y: clamp(enemyAimHeight(battlefield.type[id], id), slashLow, slashHigh),
      z: battlefield.z[id],
    };
    if (!world.isWorldOccluded(origin, target)) return id;
  }
  return requiredId === null ? bossCandidates[0] ?? null : null;
}

function updateKnifeMelee(frame) {
  if (!battlefield || player.hp <= 0 || player.mantleState) {
    ui.viewmodel.classList.remove("is-holstered");
    return false;
  }
  const now = battlefield.elapsed;
  const automatic = ui.autoMelee.checked;
  const manual = Boolean(frame.melee);
  if (knifeMeleeScanDue(knife, now, {manual, automatic})) {
    const halfAngle = manual ? KNIFE_MELEE.manualHalfAngle : Math.PI;
    const targetId = visibleMeleeTarget(halfAngle);
    const strike = tryKnifeMelee(knife, now, {manual, automatic, targetId});
    if (strike) {
      viewmodelRecoil.cancel();
      pulse(ui.knifeViewmodel, "is-swinging");
      audio.melee();
    }
  }
  const actionActive = knifeMeleeActionActive(knife, now);
  ui.viewmodel.classList.toggle("is-holstered", actionActive);
  const contact = consumeKnifeMeleeContact(knife, now);
  if (!contact || contact.targetId === null) return actionActive;
  const halfAngle = contact.manual ? KNIFE_MELEE.manualHalfAngle : Math.PI;
  const targetId = visibleMeleeTarget(halfAngle, contact.targetId);
  if (targetId === null) return actionActive;
  const feedback = createShotFeedbackSummary(KNIFE_MELEE.id);
  if (typeof targetId === "string") {
    damageBossActor(targetId, KNIFE_MELEE.damage, "knife", {armourMultiplier: 0.9, stagger: 45});
  } else {
    const armour = enemyArmour(battlefield.type[targetId]);
    damageEnemy(targetId, KNIFE_MELEE.damage, feedback, knifeDamageAgainst(armour) / KNIFE_MELEE.damage, "player:knife");
  }
  emitShotFeedback(feedback, now);
  return actionActive;
}

function emitShotFeedback(summary, now) {
  const presentation = shotFeedbackPresentation(summary);
  if (!presentation) return;
  audio.hit(presentation.kind, presentation);
  if (shouldRefreshHitMarker(presentation, now, lastArbalestHitMarkerAt)) {
    pulse(ui.hitMarker, `is-${presentation.kind}`);
    if (presentation.weaponId === "arbalest") lastArbalestHitMarkerAt = now;
  }
  rumbleHit(presentation.kind);
}

function fireWeapon(frame, now, {ray: knownRay = null, touchTarget = undefined, automaticTouchAim = false} = {}) {
  if (!battlefield || !frame.fire) return false;
  const shot = tryFireWeapon(weapon, now, currentCombatTuning ?? {});
  if (!shot) return false;
  audio.shot(shot.id, {shot: shot.shot});
  viewmodelRecoil.fire(currentCombatTuning?.adsRecoilMultiplier ?? 1);
  const feedbackSummary = createShotFeedbackSummary(shot.id);
  const ray = knownRay || world.firstPersonRay(160);
  const direction = aimDirectionForFrame(frame, ray, touchTarget, {automatic: automaticTouchAim});
  const originVector = new BABYLON.Vector3(ray.origin.x, ray.origin.y, ray.origin.z);
  const muzzle = resolveRenderedViewmodelMuzzle(ui.viewmodelArt.getBoundingClientRect(), VIEWMODEL_MUZZLES[shot.id], {
    viewportWidth: canvas.clientWidth || innerWidth,
    viewportHeight: canvas.clientHeight || innerHeight,
  });
  const weaponRange = shot.id === "runebolt"
    ? 130
    : shot.id === "sunfire" ? 16 * (currentCombatTuning?.beamRangeMultiplier ?? 1) : 160;
  const potHit = nearestFirePotRayHit(
    run?.fortifications,
    world?.sockets,
    ray.origin,
    direction,
    weaponRange,
  );
  const activateAimedFirePot = () => {
    if (!potHit || !activateFirePot(potHit.socketId, "shot")) return false;
    const point = new BABYLON.Vector3(potHit.point.x, potHit.point.y, potHit.point.z);
    world.tracer(originVector, point, "#f39a45", {muzzle, radius: 0.02});
    world.impact(point, "#f39a45", 2.4);
    return true;
  };
  let impactPoint = {
    x: ray.origin.x + direction.x * 80,
    y: ray.origin.y + direction.y * 80,
    z: ray.origin.z + direction.z * 80,
  };
  const hitPadding = shot.id === "runebolt"
    ? 0.08 * (currentCombatTuning?.runeboltHitPaddingMultiplier ?? 1)
    : 0.08;
  const worldHit = world.firstWorldRayHit(ray.origin, direction, weaponRange);
  const potCrowdHit = potHit ? battlefield.queryRayHits({
    origin: ray.origin,
    direction,
    maxDistance: weaponRange,
    maxResults: 1,
    padding: hitPadding,
  })[0] : null;
  const fixedHit = bossRayHit(run?.bossEncounter, {origin: ray.origin, direction, maxDistance: weaponRange});
  const potIsFirst = potHit && potHit.distance + hitPadding < Math.min(
    potCrowdHit?.distance ?? Infinity,
    fixedHit?.distance ?? Infinity,
    worldHit?.distance ?? Infinity,
  );
  if (shot.id === "sunfire") {
    const beamRange = weaponRange;
    const beamHalfAngle = Math.PI / 10 * (currentCombatTuning?.beamHalfAngleMultiplier ?? 1);
    if (potIsFirst && activateAimedFirePot()) return true;
    const hits = battlefield.queryConeHits({
      x: ray.origin.x, z: ray.origin.z, directionX: direction.x, directionZ: direction.z,
      range: beamRange, halfAngle: beamHalfAngle, maxResults: 48,
    });
    for (const id of hits) {
      const target = {x: battlefield.x[id], y: enemyAimHeight(battlefield.type[id], id), z: battlefield.z[id]};
      if (!world.isWorldOccluded(ray.origin, target)) damageEnemy(
        id,
        shot.damage * (shot.overheatWindow ? currentCombatTuning?.overheatDamageMultiplier ?? 1 : 1),
        feedbackSummary,
      );
    }
    for (const actorId of bossesInViewCone(run?.bossEncounter, {
      origin: ray.origin,
      direction,
      range: beamRange,
      halfAngle: beamHalfAngle,
    })) {
      const actor = run.bossEncounter.actors.find(item => item.id === actorId);
      if (actor && !world.isWorldOccluded(ray.origin, actor.position)) {
        damageBossActor(
          actorId,
          shot.damage * (shot.overheatWindow ? currentCombatTuning?.overheatDamageMultiplier ?? 1 : 1),
          "sunfire",
          {armourMultiplier: 0.9, stagger: 6},
        );
      }
    }
    impactPoint = {x: ray.origin.x + direction.x * 10, y: Math.max(.4, ray.origin.y + direction.y * 10), z: ray.origin.z + direction.z * 10};
    world.impact(new BABYLON.Vector3(impactPoint.x, impactPoint.y, impactPoint.z), "#f39a45", 1.6);
  } else {
    const maxDistance = weaponRange;
    const hitPadding = shot.id === "runebolt"
      ? 0.08 * (currentCombatTuning?.runeboltHitPaddingMultiplier ?? 1)
      : 0.08;
    const candidates = battlefield.queryRayHits({
      origin: ray.origin,
      direction,
      maxDistance,
      maxResults: 8,
      padding: hitPadding,
    });
    const worldHit = world.firstWorldRayHit(ray.origin, direction, maxDistance);
    const resolution = resolveProjectileRayHit(candidates, worldHit, {maxDistance, blockerPadding: hitPadding});
    const fixedHit = bossRayHit(run?.bossEncounter, {origin: ray.origin, direction, maxDistance});
    const potIsFirst = potHit && potHit.distance + hitPadding < Math.min(
      candidates[0]?.distance ?? Infinity,
      fixedHit?.distance ?? Infinity,
      worldHit?.distance ?? Infinity,
    );
    if (potIsFirst && activateAimedFirePot()) return true;
    if (fixedHit && (!worldHit || fixedHit.distance + hitPadding < worldHit.distance)) {
      impactPoint = fixedHit.point;
      if (shot.id === "runebolt") {
        damageBossActor(fixedHit.actorId, shot.damage, "runebolt", {
          armourMultiplier: (currentCombatTuning?.armourCrackSeconds ?? 0) > 0
            ? currentCombatTuning?.armourCrackDamageMultiplier ?? 1
            : 1,
          stagger: 30 + (currentCombatTuning?.gravityPulseSeconds ?? 0) * 20,
        });
        const splashRadius = shot.radius * (currentCombatTuning?.splashRadiusMultiplier ?? 1);
        for (const actorId of bossesInRadius(run?.bossEncounter, {...impactPoint, radius: splashRadius})) {
          if (actorId === fixedHit.actorId) continue;
          damageBossActor(
            actorId,
            shot.damage * RUNEBOLT_SPLASH_DAMAGE_MULTIPLIER * (currentCombatTuning?.splashDamageMultiplier ?? 1),
            "runebolt",
            {stagger: (currentCombatTuning?.gravityPulseSeconds ?? 0) * 20},
          );
        }
        scheduleMasteryImpact(impactPoint, shot, now);
        world.impact(new BABYLON.Vector3(impactPoint.x, impactPoint.y, impactPoint.z), "#92d4a5", 2.4);
      } else {
        damageBossActor(
          fixedHit.actorId,
          shot.damage * (adsActive ? currentCombatTuning?.adsDamageMultiplier ?? 1 : 1),
          "arbalest",
          {
            armourMultiplier: Math.max(0.72, currentCombatTuning?.minimumArmourMultiplier ?? 0),
            stagger: 18 + (currentCombatTuning?.directStaggerSeconds ?? 0) * 20,
          },
        );
        world.impact(new BABYLON.Vector3(impactPoint.x, impactPoint.y, impactPoint.z), "#e8d29a", .65);
      }
      world.tracer(
        originVector,
        new BABYLON.Vector3(impactPoint.x, impactPoint.y, impactPoint.z),
        shot.id === "runebolt" ? "#91d8b3" : "#efdca8",
        {muzzle, radius: shot.id === "runebolt" ? 0.026 : 0.016},
      );
      emitShotFeedback(feedbackSummary, now);
      return true;
    }
    if (resolution.kind === "enemy") {
      const id = resolution.enemyHit.id;
      impactPoint = {x: battlefield.x[id], y: enemyAimHeight(battlefield.type[id], id), z: battlefield.z[id]};
      if (shot.id === "runebolt") {
        const splash = battlefield.queryHits({
          x: impactPoint.x,
          z: impactPoint.z,
          radius: shot.radius * (currentCombatTuning?.splashRadiusMultiplier ?? 1),
          maxResults: 96,
        });
        for (const splashId of splash) damageEnemy(
          splashId,
          shot.damage * (splashId === id ? 1 : RUNEBOLT_SPLASH_DAMAGE_MULTIPLIER)
            * (splashId === id ? 1 : currentCombatTuning?.splashDamageMultiplier ?? 1),
          feedbackSummary,
          null,
          "player:runebolt",
        );
        for (const actorId of bossesInRadius(run?.bossEncounter, {
          ...impactPoint,
          radius: shot.radius * (currentCombatTuning?.splashRadiusMultiplier ?? 1),
        })) damageBossActor(
          actorId,
          shot.damage * RUNEBOLT_SPLASH_DAMAGE_MULTIPLIER * (currentCombatTuning?.splashDamageMultiplier ?? 1),
          "runebolt",
          {stagger: (currentCombatTuning?.gravityPulseSeconds ?? 0) * 20},
        );
        if ((currentCombatTuning?.armourCrackSeconds ?? 0) > 0) {
          armourCrackUntil.set(id, {
            until: battlefield.elapsed + currentCombatTuning.armourCrackSeconds,
            damageMultiplier: currentCombatTuning.armourCrackDamageMultiplier,
          });
        }
        if ((currentCombatTuning?.gravityPulseSeconds ?? 0) > 0) {
          const controlled = battlefield.queryHits({
            x: impactPoint.x,
            z: impactPoint.z,
            radius: currentCombatTuning.gravityPulseRadius,
            maxResults: 48,
          });
          for (const controlledId of controlled) staggerEnemy(controlledId, currentCombatTuning.gravityPulseSeconds);
        }
        scheduleMasteryImpact(impactPoint, shot, now);
        world.impact(new BABYLON.Vector3(impactPoint.x, impactPoint.y, impactPoint.z), "#92d4a5", 2.4);
      } else {
        const armour = enemyArmour(battlefield.type[id]);
        const naturalMultiplier = weaponDamageAgainst("arbalest", armour) / WEAPON_DEFINITIONS.arbalest.damage;
        const pinnedMultiplier = Math.max(naturalMultiplier, currentCombatTuning?.minimumArmourMultiplier ?? 0);
        damageEnemy(
          id,
          shot.damage * (adsActive ? currentCombatTuning?.adsDamageMultiplier ?? 1 : 1),
          feedbackSummary,
          pinnedMultiplier,
          "player:arbalest",
        );
        staggerEnemy(id, currentCombatTuning?.directStaggerSeconds ?? 0);
        world.impact(new BABYLON.Vector3(impactPoint.x, impactPoint.y, impactPoint.z), "#e8d29a", .65);
      }
    } else if (resolution.kind === "world") {
      impactPoint = resolution.worldHit.point;
      if (shot.id === "runebolt") {
        const ricochet = battlefield.queryHits({
          x: impactPoint.x,
          z: impactPoint.z,
          radius: currentCombatTuning?.terrainRicochetRadius ?? 0,
          maxResults: 1,
        });
        const ricochetBosses = bossesInRadius(run?.bossEncounter, {
          ...impactPoint,
          radius: currentCombatTuning?.terrainRicochetRadius ?? 0,
        });
        if (ricochet.length && (currentCombatTuning?.terrainRicochetDamageMultiplier ?? 0) > 0) {
          damageEnemy(
            ricochet[0],
            shot.damage * currentCombatTuning.terrainRicochetDamageMultiplier,
            feedbackSummary,
            null,
            "player:runebolt",
          );
        } else if (ricochetBosses.length && (currentCombatTuning?.terrainRicochetDamageMultiplier ?? 0) > 0) {
          damageBossActor(
            ricochetBosses[0],
            shot.damage * currentCombatTuning.terrainRicochetDamageMultiplier,
            "runebolt",
            {stagger: (currentCombatTuning?.gravityPulseSeconds ?? 0) * 20},
          );
        }
        scheduleMasteryImpact(impactPoint, shot, now);
      }
      world.impact(new BABYLON.Vector3(impactPoint.x, impactPoint.y, impactPoint.z), "#d6c9a3", .42);
    }
    world.tracer(
      originVector,
      new BABYLON.Vector3(impactPoint.x, impactPoint.y, impactPoint.z),
      shot.id === "runebolt" ? "#91d8b3" : "#efdca8",
      {muzzle, radius: shot.id === "runebolt" ? 0.026 : 0.016}
    );
  }
  emitShotFeedback(feedbackSummary, now);
  return true;
}

function updateFortifications(now) {
  if (!battlefield || now - lastTrapTick < .25) return;
  lastTrapTick = now;
  for (const placement of run.fortifications) {
    if (placement.disabledForWave) continue;
    const socket = world.sockets.find((item) => item.id === placement.socketId);
    if (!socket) continue;
    if (placement.type === "thornSnare") {
      if (Number.isFinite(placement.charges) && placement.charges <= 0) continue;
      const hits = battlefield.queryHits({x: socket.x, z: socket.z, radius: 4.2, maxResults: 18});
      const previous = thornSnareOccupants.get(placement.socketId) || new Set();
      const current = new Set(hits);
      const entrants = hits.filter(id => !previous.has(id));
      thornSnareOccupants.set(placement.socketId, current);
      if (entrants.length) {
        const charge = consumeRunFortificationCharge(run.fortifications, placement.socketId);
        if (charge.consumed) {
          run = {...run, fortifications: charge.placements};
          const targetFacts = [];
          for (const id of entrants) {
            const result = battlefield.damageEnemy(id, 22);
            recordEnemyDamage(`fortification:${placement.socketId}`, id, {...result, damage: 22});
            targetFacts.push({enemyId: id, killed: result.killed});
            if (result.killed) killsThisRun++;
          }
          for (const event of createFortificationGoalEvents({
            eventId: fortificationActivationId("snare", placement.socketId),
            fortificationId: "thornSnare",
            socketId: placement.socketId,
            targets: targetFacts,
          })) applyGoalFact(event);
          world.triggerFortification(placement.socketId);
          if (charge.depleted) {
            world.updateFortificationStatus(placement.socketId, {active: false});
            battlefield.removeEnemyObstacle(placement.socketId);
          }
          persistRun();
        }
      }
      for (const actorId of bossesInRadius(run?.bossEncounter, {x: socket.x, z: socket.z, radius: 4.2})) {
        damageBossActor(actorId, 22, "fortification", {stagger: 24});
        applyBossDirectorUpdate({commands: [{
          id: `fortification:${placement.socketId}:interrupt:${Math.floor(now * 4)}`,
          type: "fortification_interrupt",
          actorId,
          socketId: placement.socketId,
          stagger: 80,
        }]});
      }
    } else if (placement.type === "ballista" && Math.floor(now * .8) !== Math.floor((now - .25) * .8)) {
      const hits = battlefield.queryHits({x: socket.x, z: socket.z, radius: 46, maxResults: 1});
      if (hits.length) {
        const id = hits[0];
        const result = battlefield.damageEnemy(id, 130);
        recordEnemyDamage(`fortification:${placement.socketId}`, id, {...result, damage: 130});
        for (const event of createFortificationGoalEvents({
          eventId: fortificationActivationId("ballista", placement.socketId),
          fortificationId: "ballista",
          socketId: placement.socketId,
          targets: [{enemyId: id, killed: result.killed}],
        })) applyGoalFact(event);
        if (result.killed) killsThisRun++;
        world.triggerFortification(placement.socketId);
        const target = new BABYLON.Vector3(
          battlefield.x[id],
          enemyAimHeight(battlefield.type[id], id),
          battlefield.z[id],
        );
        world.tracer(
          new BABYLON.Vector3(socket.x, (socket.y ?? 0) + 1.25, socket.z),
          target,
          "#e9bd68",
          {cameraRelative: false, radius: .018},
        );
        world.impact(target, "#e9bd68", .7);
      } else {
        const actorId = bossesInRadius(run?.bossEncounter, {x: socket.x, z: socket.z, radius: 46})[0];
        if (actorId) {
          damageBossActor(actorId, 130, "fortification", {armourMultiplier: 0.85, stagger: 35});
          world.triggerFortification(placement.socketId);
        }
      }
    } else if (placement.type === "wardLantern" && authoredBossActive()) {
      const herald = run.bossEncounter.actors.find(actor => actor.id === "moonless-herald" && !actor.defeated);
      if (herald && Math.hypot(herald.position.x - socket.x, herald.position.z - socket.z) <= 18) {
        applyBossDirectorUpdate({commands: [{
          id: `ward:${placement.socketId}:${Math.floor(now)}`,
          type: "ward_light",
          actorId: herald.id,
          source: {x: socket.x, z: socket.z},
          direction: {x: herald.position.x - socket.x, z: herald.position.z - socket.z},
        }]});
      }
    }
  }
}

function useContext(now) {
  if (now - lastContextAt < .18) return false;
  lastContextAt = now;
  if (coopPreview?.role === 'host' && coopPreview.connected && phase === GAME_PHASES.COMBAT) {
    const reviveIntent = resolveCoopContextIntent({
      phase,
      localPlayerId: coopPreview.localId,
      players: [...coopPreview.authority.players.values()],
      sharedRevive: run?.nightRuntime?.twinThorns ?? null,
    });
    if (reviveIntent?.action === 'revive') {
      const resolved = applyHostCoopSharedRevive(reviveIntent.payload.targetPlayerId);
      if (resolved) {
        announce('Twin Thorns restores the other Warden to 30 Health');
        return true;
      }
    }
  }
  const wardTarget = aimedHeraldForWardPulse();
  if (phase === GAME_PHASES.COMBAT && wardTarget) {
    applyBossDirectorUpdate({commands: [{
      id: nextBossCommandId("ward-light", wardTarget.actor.id),
      type: "ward_light",
      actorId: wardTarget.actor.id,
      source: {x: player.position.x, z: player.position.z},
      direction: wardTarget.direction,
    }]});
    announce("Ward light raised · hold aim through the reveal");
    return true;
  }
  if (phase === GAME_PHASES.DAYTIME) {
    const hub = nearestHubStation();
    if (hub) return interactWithNpc(hub.station);
    const near = nearestBuildSocket();
    if (near) {
      selectedSocket = near.socket;
      if (currentInputSource === INPUT_SOURCES.TOUCH
        && touchBuildSheetSocketId !== selectedSocket.id) {
        touchBuildSheetSocketId = selectedSocket.id;
        setBuildPanelExpanded(true);
        refreshBuildChoices();
        announce(`Choose a defence for ${socketLabel(selectedSocket)}`);
        return true;
      }
      refreshBuildChoices();
      const installed = run.fortifications.some((item) => item.socketId === selectedSocket.id);
      if (installed) { announce("That defence is already installed"); return true; }
      const choices = enabledBuildChoices();
      const focused = choices.includes(document.activeElement) ? document.activeElement : choices[0];
      if (!focused) { announce("No affordable defence fits this socket"); return true; }
      installSelectedFortification(focused.dataset.fortification);
      return true;
    }
  }
  const authored = nearestAuthoredInteraction();
  if (phase === GAME_PHASES.COMBAT && authored?.interaction.kind === "emergency-heal") {
    try {
      const result = consumeFieldMedicine({...run, player: serializePlayer()}, {
        night: run.night,
        runOrdinal: run.runOrdinal,
        requestId: `run-${run.runOrdinal}-night-${run.night}-medicine-warden-local`,
      }, {
        actorId: "warden-local",
        localActorId: "warden-local",
        hp: player.hp,
        maxHp: player.maxHp,
      });
      run = result.run;
      player.hp = result.actor.hp;
      player.healAvailable = false;
      audio.repair();
      announce("Field medicine restores 50 Health");
      persistRun();
    } catch (error) { announce(error.message); }
    return true;
  }
  const nearSocket = nearestBuildSocket(2.7);
  const placement = nearSocket && run.fortifications.find((item) => item.socketId === nearSocket.socket.id);
  if (phase === GAME_PHASES.COMBAT && placement) {
    if (placement.type === "firePot") {
      if (!activateFirePot(placement.socketId)) {
        announce("Sunfire pot is spent · the Trapper can restore it");
      }
    } else {
      world.triggerFortification(placement.socketId);
      announce(`${FORTIFICATION_DEFINITIONS[placement.type]?.name || "Defence"} activated`);
    }
    return true;
  }
  if (phase === GAME_PHASES.COMBAT && weapon.selected === "sunfire") {
    if (coopPreview?.role === 'host' && coopPreview.connected) {
      if (applyHostCoopManualVent(coopPreview.localId)) {
        announce("Sunfire mastery vent released");
        return true;
      }
      return false;
    }
    const tuning = runtimeProgressionTuning(profile, run, "sunfire", {ads: adsActive});
    const vent = tryManualVent(weapon, battlefield?.elapsed ?? now, tuning);
    if (vent) {
      const hits = battlefield.queryHits({
        x: player.position.x,
        z: player.position.z,
        radius: vent.radius,
        maxResults: 48,
      });
      for (const id of hits) damageEnemy(id, vent.damage, null, null, "player:sunfire");
      for (const actorId of bossesInRadius(run?.bossEncounter, {x: player.position.x, z: player.position.z, radius: vent.radius})) {
        damageBossActor(actorId, vent.damage, "sunfire", {armourMultiplier: 1, stagger: 30});
      }
      world.impact(new BABYLON.Vector3(player.position.x, Math.max(0.4, player.position.y), player.position.z), "#f39a45", 3.2);
      announce("Sunfire mastery vent released");
      return true;
    }
  }
  return false;
}

function applyHostCoopSharedRevive(targetPlayerId) {
  if (coopPreview?.role !== 'host' || phase !== GAME_PHASES.COMBAT || !run) return false;
  const resolved = resolveCoopWardenDownState({
    run,
    players: [...coopPreview.authority.players.values()],
    targetPlayerId,
  });
  if (!resolved.revivedPlayerId) return false;
  run = resolved.run;
  for (const state of resolved.players) coopPreview.authority.players.set(state.playerId, state);
  const local = resolved.players.find(state => state.playerId === coopPreview.localId);
  if (local) player.hp = local.hp;
  coopPreview.applyFrame({authorityTick: coopPreview.authority.tick, players: resolved.players});
  appendCoopSemanticEvent('campaign', 'shared_revive', resolved.revivedPlayerId, {amount: 30});
  persistRun();
  queueMicrotask(() => coopPreview?.sendCheckpoint('shared_revive'));
  return true;
}

function applyHostCoopManualVent(playerId) {
  if (coopPreview?.role !== 'host' || phase !== GAME_PHASES.COMBAT || !run) return false;
  const tuning = runtimeProgressionTuning(profile, run, 'sunfire', {ads: false});
  const event = applySessionManualVent(coopPreview.authority, playerId, tuning, coopPreview.authority.tick);
  if (!event) return false;
  resolveCoopAuthorityEvents([event]);
  return true;
}

function requestGuestCoopContext() {
  if (coopPreview?.role !== 'guest' || !coopPreview.connected || !run) return false;
  if (phase === GAME_PHASES.DAYTIME) {
    if (coopPreview.latestFrame?.narrative?.activeScene) {
      return syncGuestNarrativePresentation(coopPreview.latestFrame.narrative.activeScene, {forceOpen: true});
    }
    const hub = nearestHubStation();
    if (hub) {
      return Boolean(coopPreview.sendAction("npc_interaction", {
        npcId: hub.station.kind,
        runOrdinal: run.runOrdinal,
        night: run.night,
      }));
    }
    const near = hub ? null : nearestBuildSocket();
    let choice = null;
    if (near) {
      selectedSocket = near.socket;
      refreshBuildChoices();
      choice = enabledBuildChoices()[0] ?? null;
    }
    const intent = resolveGuestBuildContextIntent({
      hubKind: hub?.station?.kind ?? null,
      wave: run.wave,
      gates: run.gates,
      nearSocket: near?.socket ?? null,
      fortificationType: choice?.dataset?.fortification ?? null,
    });
    if (!intent) return false;
    return Boolean(coopPreview.sendAction(intent.action, intent.payload));
  }
  if (phase === GAME_PHASES.COMBAT) {
    const medicine = coopPreview.latestFrame?.narrative?.medicine;
    const healInteraction = nearestAuthoredInteraction(2.5);
    if (healInteraction?.interaction?.kind === "emergency-heal" && medicine?.available === true) {
      return Boolean(coopPreview.sendAction("medicine_consume", {
        actorId: coopPreview.localId,
        requestId: `run-${run.runOrdinal}-night-${run.night}-medicine-${coopPreview.localId}`,
        runOrdinal: run.runOrdinal,
        night: run.night,
      }));
    }
    const ward = aimedHeraldForWardPulse();
    const bellkeeper = nearestHubStation(2.5, player, {allowCombat: true})?.station?.kind === HUB_NPC_IDS.BELLKEEPER;
    const rally = run.nightRuntime?.bellkeeperRally;
    const intent = resolveGuestCoopContextIntent({
      phase,
      localPlayerId: coopPreview.localId,
      players: coopPreview.latestFrame?.players ?? [],
      sharedRevive: coopPreview.latestFrame?.resources?.sharedRevive ?? null,
      wardActorId: ward?.actor?.id ?? null,
      manualVentAvailable: weapon.selected === 'sunfire'
        && (runtimeProgressionTuning(profile, run, 'sunfire').manualVentBurstDamage ?? 0) > 0,
      bellkeeperRallyAvailable: bellkeeper && rally?.available === true && !rally.used,
    });
    return intent ? Boolean(coopPreview.sendAction(intent.action, intent.payload)) : false;
  }
  return false;
}

function contextDescription() {
  if (coopPreview?.connected && phase === GAME_PHASES.COMBAT) {
    const players = coopPreview.role === 'host'
      ? [...coopPreview.authority.players.values()]
      : coopPreview.latestFrame?.players ?? [];
    const sharedRevive = coopPreview.role === 'host'
      ? run?.nightRuntime?.twinThorns ?? null
      : coopPreview.latestFrame?.resources?.sharedRevive ?? null;
    if (resolveCoopContextIntent({phase, localPlayerId: coopPreview.localId, players, sharedRevive})?.action === 'revive') {
      return 'Revive the other Warden · Twin Thorns';
    }
  }
  if (phase === GAME_PHASES.COMBAT && aimedHeraldForWardPulse()) return "Raise carried Ward light";
  const hub = nearestHubStation();
  if (hub) {
    const available = isHubServiceAvailable(hub.station.kind, run, {profile});
    return available
      ? `Speak with the ${HUB_NPC_LABELS[hub.station.kind] || "defender"}`
      : `${HUB_NPC_LABELS[hub.station.kind] || "Defender"} · service not ready`;
  }
  const authored = nearestAuthoredInteraction();
  if (phase === GAME_PHASES.COMBAT && authored) {
    if (authored.interaction.kind === "emergency-heal") {
      if (!run?.playerMedicine?.prepared) return "Field medicine was not prepared at daytime";
      return run.playerMedicine.available ? "Use prepared field medicine" : "Field medicine already used";
    }
    return null;
  }
  const near = nearestBuildSocket(4.2);
  const placement = near && run?.fortifications?.find((item) => item.socketId === near.socket.id);
  if (phase === GAME_PHASES.DAYTIME) {
    const choice = enabledBuildChoices()[0];
    const definition = choice && FORTIFICATION_DEFINITIONS[choice.dataset.fortification];
    return describeBuildSocketContext({
      nearSocket: near ? {label: socketLabel(near.socket)} : null,
      placementName: placement ? FORTIFICATION_DEFINITIONS[placement.type]?.name || "Defence" : null,
      choiceDefinition: definition,
    });
  }
  if (placement) {
    if (Number.isFinite(placement.charges) && placement.charges <= 0) {
      return `${FORTIFICATION_DEFINITIONS[placement.type]?.name || "Defence"} depleted`;
    }
    return `Activate ${FORTIFICATION_DEFINITIONS[placement.type]?.name || "defence"}`;
  }
  if (phase === GAME_PHASES.COMBAT && weapon.selected === "sunfire"
    && (runtimeProgressionTuning(profile, run, "sunfire").manualVentBurstDamage ?? 0) > 0) {
    return "Release Sunfire mastery vent";
  }
  return null;
}

function completeWave() {
  if (phase !== GAME_PHASES.COMBAT || !run) return;
  syncRunState();
  if (run.bossEncounter?.mode === "authored-director" && run.bossEncounter.status !== "defeated") return;
  const completedNight = run.night;
  const clearedWave = run.wave;
  const completedCombatRun = structuredClone(run);
  const activeEscortCount = (run.hub?.activeNpcs ?? [])
    .filter((npcId) => !(run.fallenNpcs ?? []).includes(npcId)).length;
  const objectiveEvidence = run.night === 2
    ? {
      eastApproachWardHeld: !run.gates.east.destroyed
        && currentRoster?.enemies?.some((enemy) => enemy.approach === "east"),
    }
    : run.night === 6
      ? {
        // The caravan is not yet a world actor. Its named passage proxy is the
        // surviving Heart route plus at least one living holdfolk escort.
        caravanPassageHeld: !run.gates.heart.destroyed,
        livingEscortCount: activeEscortCount,
      }
      : undefined;
  const campaignEnding = completedNight === 7 && clearedWave === 2;
  if (campaignEnding) {
    emitNightGoalFacts(completedNight, null, {campaignComplete: true, sourceRun: completedCombatRun});
    applyGoalFact({
      type: "terminal-settlement",
      eventId: `run-${run.runOrdinal}-campaign-terminal-settlement`,
      runOrdinal: run.runOrdinal,
    });
  }
  const transition = completeSoloCampaignWave(profile, run, {
    objectiveEvidence,
  });
  profile = transition.profile;
  run = transition.run;
  invalidateRunLoadoutCache();
  if (transition.type === "recovery") {
    announce(`Night ${completedNight} · Wave ${clearedWave + 1} held · 24 Supplies recovered`);
    enterRecovery();
  } else if (transition.type === "boon") {
    emitNightGoalFacts(completedNight, null, {sourceRun: completedCombatRun});
    announce(`Night ${completedNight} held · choose one boon before the next dawn`);
    startAutomaticNarrative("night_cleared", completedCombatRun, profile,
      () => showNightComplete(completedNight));
  } else if (transition.type === "daytime") {
    emitNightGoalFacts(completedNight, transition.nightResult, {sourceRun: completedCombatRun});
    announce(`Night ${completedNight} held · daylight returns`);
    startAutomaticNarrative("night_cleared", completedCombatRun, profile, enterDaytime);
  } else if (transition.type === "campaign_complete") {
    announce("Night 7 held · the binding breaks at dawn");
    startAutomaticNarrative("night_cleared", completedCombatRun, profile, startCampaignEnding);
  }
}

function emitNightGoalFacts(completedNight, nightResult = null, {campaignComplete = false, sourceRun = run} = {}) {
  const startingNpcIds = [...(sourceRun?.nightStartingNpcIds ?? [])];
  const survivingNpcIds = startingNpcIds.filter(npcId => !(sourceRun?.fallenNpcs ?? []).includes(npcId));
  const gates = structuredClone(sourceRun?.gates ?? nightResult?.gates ?? {});
  for (const gateId of ["outer", "east", "heart"]) {
    const gate = gates[gateId];
    if (!gate) continue;
    applyGoalFact({
      type: "gate",
      eventId: `run-${sourceRun.runOrdinal}-night-${completedNight}-gate-${gateId}`,
      gateId,
      integrity: gate.integrity,
      maxIntegrity: gate.maxIntegrity,
      destroyed: gate.destroyed === true,
      breached: gate.destroyed === true,
    });
  }
  applyGoalFact({
    type: "npc-survival",
    eventId: `run-${sourceRun.runOrdinal}-night-${completedNight}-npc-survival`,
    startingNpcIds,
    survivingNpcIds,
  });
  applyGoalFact({
    type: "night-complete",
    eventId: `run-${sourceRun.runOrdinal}-night-${completedNight}-complete`,
    night: completedNight,
    gates,
    startingNpcIds,
    survivingNpcIds,
    activeBoonIds: [...(sourceRun?.boons ?? [])],
    boonActive: (sourceRun?.boons?.length ?? 0) > 0,
  });
  if (campaignComplete) {
    applyGoalFact({
      type: "campaign-complete",
      eventId: `run-${sourceRun.runOrdinal}-campaign-complete`,
      night: 7,
      mode: sourceRun.narrative.mode,
      activeNpcIds: startingNpcIds,
      survivingNpcIds,
    }, {autoReportEnding: true, relationshipPhase: GAME_PHASES.CAMPAIGN_COMPLETE});
  }
  persistRun();
}

function enterBoonChoice() {
  if (!run) return;
  setPhase(GAME_PHASES.BOON_CHOICE);
  run = {...run, phase: GAME_PHASES.BOON_CHOICE};
  persistRun();
  publishAuthoritativeMusicCue("boon_choice");
  audio.nightEnd();
  renderBoonChoices();
}

function renderBoonChoices() {
  ui.boonChoices.replaceChildren();
  for (const boon of createBoonOffer(run, run.night)) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.boonType = boon.type;
    const typeIcon = document.createElement("span");
    typeIcon.className = "boon-type-icon";
    typeIcon.setAttribute("aria-hidden", "true");
    applyUiIcon(typeIcon, boon.id);
    const typeLabel = document.createElement("span");
    typeLabel.className = "boon-type-label";
    typeLabel.textContent = boon.type;
    const title = document.createElement("strong");
    title.textContent = boon.name;
    const description = document.createElement("span");
    description.textContent = boon.description;
    button.append(typeIcon, typeLabel, title, description);
    button.addEventListener("click", () => chooseBoon(boon.id), {once: true});
    ui.boonChoices.append(button);
  }
}

function chooseBoon(id) {
  if (coopPreview?.role === "guest" && coopPreview.connected) {
    coopPreview.sendAction("choose_boon", {boonId: id});
    announce("Boon choice sent to the host");
    return;
  }
  ({profile, run} = chooseSoloCampaignBoon(profile, run, id));
  player.hp = run.player.hp;
  player.maxHp = run.player.maxHp;
  enterDaytime(true);
}

function showNightComplete(completedNight = run?.night) {
  syncRunState();
  setPhase(GAME_PHASES.NIGHT_COMPLETE);
  run = {...run, phase: GAME_PHASES.NIGHT_COMPLETE};
  publishAuthoritativeMusicCue("night_clear");
  persistRun();
  show(ui.resultOverlay, true);
  ui.resultKicker.textContent = "The eastern sky pales";
  ui.resultTitle.textContent = `Night ${completedNight} held`;
  const objectiveCopy = run.objectiveState
    ? ` Optional objective ${run.objectiveState.status}.`
    : "";
  ui.resultMessage.textContent = `Night ${completedNight} is held.${objectiveCopy} Earned rewards remain carried until failure or Night 7 victory.`;
  ui.resultKills.textContent = killsThisRun.toLocaleString();
  ui.resultOathmarks.textContent = run.earnedOathmarks;
  ui.resultHeart.textContent = `${Math.round(ratio(run.gates.heart.integrity, run.gates.heart.maxIntegrity) * 100)}%`;
  ui.resultContinue.textContent = "Choose the night's boon";
}

function campaignEndingCompleted(sourceRun = run) {
  return (sourceRun?.narrative?.completedSceneIds ?? [])
    .some(sceneId => CAMPAIGN_ENDING_SCENE_IDS.has(sceneId));
}

function startCampaignEnding() {
  if (!run || run.phase !== GAME_PHASES.CAMPAIGN_COMPLETE) return false;
  setPhase(GAME_PHASES.CAMPAIGN_COMPLETE);
  show(ui.resultOverlay, false);
  persistRun();
  if (campaignEndingCompleted(run)) return settleCampaignAfterEnding();
  return startAutomaticNarrative("campaign_cleared", run, profile, settleCampaignAfterEnding);
}

function settleCampaignAfterEnding() {
  if (!run || run.phase !== GAME_PHASES.CAMPAIGN_COMPLETE) return false;
  const victoryRun = run;
  const settlement = settleTerminalRun(profile, victoryRun, {outcome: "campaign_complete"});
  showCampaignComplete(victoryRun, settlement);
  return true;
}

function showCampaignComplete(victoryRun, settlement) {
  if (coopPreview?.role === 'host' && coopPreview.connected) {
    coopTerminalRun = structuredClone(victoryRun);
    coopSettlementState = {status: 'settled', runOrdinal: victoryRun.runOrdinal, outcome: 'campaign_complete'};
    appendCoopSemanticEvent('campaign', 'campaign_complete', null, {state: 'settled'});
  }
  const saved = commitTerminalTransition(settlement.profile);
  setPhase(GAME_PHASES.CAMPAIGN_COMPLETE);
  audio.applyMusicEvent({kind: 'campaign_complete', actorId: null,
    payload: {night: 7, wave: 3, encounterId: 'hollow-hart+cinderwing'}});
  audio.gameOver();
  show(ui.resultOverlay, true);
  ui.resultKicker.textContent = "Fire fades over the old stone";
  ui.resultTitle.textContent = "Campaign complete";
  ui.resultMessage.textContent = saved
    ? `All seven nights are held. ${settlement.bankedOathmarks} carried Oathmarks have been banked.`
    : "All seven nights are held. Rewards are ready, but storage must succeed before leaving.";
  ui.resultKills.textContent = killsThisRun.toLocaleString();
  ui.resultOathmarks.textContent = settlement.bankedOathmarks;
  ui.resultHeart.textContent = `${Math.round(ratio(victoryRun.gates.heart.integrity, victoryRun.gates.heart.maxIntegrity) * 100)}%`;
  ui.resultContinue.textContent = saved ? "Begin Again" : "Retry save, then Begin Again";
  if (coopPreview?.role === 'host' && coopPreview.connected) coopPreview.queueCheckpoint('campaign_complete');
}

function failCurrentRun(reason) {
  if (!run || phase === GAME_PHASES.RUN_FAILED) return;
  syncRunState();
  const reasonCode = reason === "bellkeeper_fallen"
    ? reason
    : reason.includes("Heart") ? "heart_gate_fallen"
      : "warden_fallen";
  const displayReason = reasonCode === "bellkeeper_fallen" ? "The Bellkeeper fell" : reason;
  runFailureReason = reasonCode;
  applyGoalFact({
    type: "terminal-settlement",
    eventId: `run-${run.runOrdinal}-failure-terminal-settlement`,
    runOrdinal: run.runOrdinal,
  });
  const failedRun = {...run, phase: GAME_PHASES.RUN_FAILED};
  const bossId = run.bossEncounter?.actors?.find(actor => actor.defeated !== true)?.id ?? null;
  const breachedGateId = reasonCode === "heart_gate_fallen" ? "heart" : null;
  const result = settleTerminalRun(profile, run, {outcome: "failure", reasonCode, bossId, breachedGateId});
  if (coopPreview?.role === 'host' && coopPreview.connected) {
    coopTerminalRun = structuredClone(failedRun);
    coopSettlementState = {status: 'settled', runOrdinal: run.runOrdinal, outcome: 'failure'};
    appendCoopSemanticEvent('campaign', 'run_failed', null, {state: reasonCode});
  }
  const saved = commitTerminalTransition(result.profile);
  setPhase(GAME_PHASES.RUN_FAILED);
  audio.applyMusicEvent({kind: 'run_failed', actorId: null,
    payload: {night: failedRun.night, wave: Math.min(3, failedRun.wave + 1)}});
  audio.gameOver();
  show(ui.resultOverlay, true);
  ui.resultKicker.textContent = "The green closes over the stones";
  ui.resultTitle.textContent = "Briarhold falls";
  const joined = result.unlockedNpcId ? ` ${HUB_NPC_LABELS[result.unlockedNpcId]} will join the next run.` : "";
  ui.resultMessage.textContent = saved
    ? `${displayReason}. ${result.bankedOathmarks} earned Oathmarks have been banked.${joined}`
    : `${displayReason}. Rewards are ready, but storage is unavailable. Retry the save before leaving.${joined}`;
  ui.resultKills.textContent = killsThisRun.toLocaleString();
  ui.resultOathmarks.textContent = result.bankedOathmarks;
  ui.resultHeart.textContent = reasonCode === "heart_gate_fallen" ? "Destroyed" : "Standing";
  ui.resultContinue.textContent = saved ? "Begin Again" : "Retry save, then Begin Again";
  show(ui.resultOverlay, false);
  startAutomaticNarrative("run_failed", failedRun, profile, () => show(ui.resultOverlay, true));
  if (coopPreview?.role === 'host' && coopPreview.connected) coopPreview.queueCheckpoint('run_failed');
}

function setCoopStatus(message) {
  ui.coopStatus.textContent = String(message);
}

function openCoopPanel() {
  closeSettingsPanel();
  show(ui.howPanel, false);
  ui.howButton.setAttribute("aria-expanded", "false");
  show(ui.coopPanel, true);
  ui.coopButton.setAttribute("aria-expanded", "true");
  ui.coopSignalText.value = "";
  ui.coopRoomCode.value = "";
  ui.coopRoomCopy.disabled = true;
  ui.coopHost.disabled = false;
  ui.coopJoin.disabled = false;
  ui.coopSignal.disabled = true;
  ui.coopCopy.disabled = true;
  coopSignalStep = null;
  setCoopStatus("Choose Host or Join. No account or paid server is required.");
  if (controllerPresent) queueMicrotask(() => ui.coopHost.focus());
}

function disposeCoopPreview({restoreSolo = true, discardPersistence = false} = {}) {
  document.body.classList.remove("coop-active");
  coopSignaling?.close();
  coopSignaling = null;
  coopSignalingEventChain = Promise.resolve();
  pendingCoopIceCandidates.clear();
  coopPreview?.close();
  coopPreview = null;
  lastCoopCombatResolution = null;
  coopSemanticEventSequence = 0;
  coopSemanticEvents = [];
  coopGuestEventCursor = new CoopSemanticEventCursor();
  coopSettlementState = null;
  coopTerminalRun = null;
  coopSignalStep = null;
  audio.resetMusicEventCursor?.();
  if (discardPersistence) {
    coopPersistenceBoundary?.discard();
    coopPersistenceBoundary = null;
  } else if (restoreSolo) {
    if (coopPersistenceBoundary) {
      const restored = coopPersistenceBoundary.restore();
      profile = restored.profile;
      run = restored.run;
    }
    coopPersistenceBoundary = null;
  }
}

function closeCoopPanel() {
  if (coopPreview?.connected) {
    disposeCoopPreview();
    returnToMenu();
    return;
  }
  disposeCoopPreview();
  show(ui.coopPanel, false);
  ui.coopButton.setAttribute("aria-expanded", "false");
  if (controllerPresent) ui.coopButton.focus();
}

function appendCoopSemanticEvent(category, kind, actorId = null, payload = {}, authorityTick = null) {
  if (coopPreview?.role !== "host") return null;
  coopSemanticEventSequence += 1;
  const allowedPayload = Object.fromEntries(Object.entries(payload).filter(([key, value]) => (
    ["encounterId", "phase", "attack", "zoneId", "targetId", "amount", "night", "wave", "state", "cue"].includes(key)
      && (typeof value === "string" || Number.isFinite(value))
  )));
  const event = {
    sequence: coopSemanticEventSequence,
    authorityTick: authorityTick ?? coopPreview.authority?.tick ?? 0,
    category,
    kind,
    actorId,
    payload: allowedPayload,
  };
  coopSemanticEvents.push(event);
  if (coopSemanticEvents.length > 256) coopSemanticEvents = coopSemanticEvents.slice(-256);
  return event;
}

function publishAuthoritativeMusicCue(kind, actorId = null, payload = {}) {
  const contextual = {...payload};
  if (run?.night >= 1 && run.night <= 7) contextual.night = run.night;
  if (run?.wave >= 0 && run.wave <= 2) contextual.wave = run.wave + 1;
  const localEvent = {kind, actorId, payload: contextual};
  audio.applyMusicEvent(localEvent);
  appendCoopSemanticEvent("music", kind, actorId, contextual);
  return localEvent;
}

function coopWorldStateHash(tick) {
  const sharedRun = run ?? coopTerminalRun;
  const stats = battlefield?.stats?.();
  const text = [tick, sharedRun?.phase ?? phase, sharedRun?.night ?? 0, sharedRun?.wave ?? 0, sharedRun?.supplies ?? 0,
    stats?.activeCount ?? 0, stats?.dyingCount ?? 0,
    Math.round(stats?.outerGateHp?.[WEST] ?? run?.gates?.outer?.integrity ?? 0),
    Math.round(stats?.heartGateHp ?? run?.gates?.heart?.integrity ?? 0),
    sharedRun?.bossEncounter?.hash ?? "no-boss",
    JSON.stringify(sharedRun?.objectiveState ?? null),
    JSON.stringify(sharedRun?.rewardLedger ?? null),
    JSON.stringify(sharedRun?.pendingWeaponXp ?? null),
    coopSemanticEventSequence,
    ...(coopPreview?.authority ? [...coopPreview.authority.players.values()].map(item => Math.round(item.hp * 10)) : []),
  ].join('|');
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193) >>> 0;
  return `nw-${hash.toString(16).padStart(8, '0')}`;
}

function coopSubphase(authorityPhase = phase, sourceRun = run) {
  if (authorityPhase === GAME_PHASES.COMBAT) {
    if (sourceRun?.bossEncounter?.status === "active") return "boss_active";
    if (sourceRun?.bossEncounter?.status === "waiting") return "boss_waiting";
    return "crowd_combat";
  }
  if (authorityPhase === GAME_PHASES.BOON_CHOICE) return "boon_choice";
  if (authorityPhase === GAME_PHASES.CAMPAIGN_COMPLETE) return "campaign_result";
  if (authorityPhase === GAME_PHASES.RUN_FAILED) return "failure_result";
  if (authorityPhase === GAME_PHASES.NIGHT_COMPLETE) return "night_result";
  if (authorityPhase === GAME_PHASES.DAYTIME) return "daytime";
  if (authorityPhase === GAME_PHASES.INTERWAVE_RECOVERY) return "recovery";
  return "build";
}

function coopObjectiveFrame() {
  const objective = (run ?? coopTerminalRun)?.objectiveState;
  if (!objective) return null;
  const evidence = objective.evidence ?? {};
  const maxDurability = Math.max(0, Number(evidence.bossObjectiveMaxDurability) || 1);
  const durability = Math.max(0, Math.min(maxDurability,
    Number.isFinite(evidence.bossObjectiveDurability) ? evidence.bossObjectiveDurability : maxDurability));
  const text = JSON.stringify(evidence);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193) >>> 0;
  return {
    night: objective.night,
    id: objective.id,
    label: objective.label,
    status: objective.status,
    durability,
    maxDurability,
    evidenceHash: `objective-${hash.toString(16).padStart(8, "0")}`,
  };
}

function coopEnemyTuples(limit = 180) {
  if (!battlefield) return [];
  const ids = [];
  const seen = new Set();
  const add = id => {
    if (!Number.isInteger(id) || seen.has(id) || battlefield.status[id] === DEAD || ids.length >= limit) return;
    seen.add(id); ids.push(id);
  };
  const wardens = coopPreview?.authority ? [...coopPreview.authority.players.values()] : [];
  for (const warden of wardens) {
    for (const id of battlefield.queryHits({x: warden.position.x, z: warden.position.z, radius: 72, maxResults: 72})) add(id);
  }
  for (const id of battlefield.queryHits({x: -16, z: 30, radius: 70, maxResults: limit})) add(id);
  if (wickerBossId >= 0) add(wickerBossId);
  return ids.map(id => {
    const desiredX = battlefield.desiredVx[id];
    const desiredZ = battlefield.desiredVz[id];
    const moving = Math.hypot(desiredX, desiredZ) > 0.001;
    const directionX = moving ? desiredX : battlefield.vx[id];
    const directionZ = moving ? desiredZ : battlefield.vz[id];
    return [
      id,
      enemyArchetype(battlefield.type[id]).key,
      battlefield.x[id],
      battlefield.z[id],
      Math.hypot(directionX, directionZ) > 0.001 ? Math.atan2(directionX, directionZ) : 0,
      battlefield.status[id] === DYING ? 'dying' : battlefield.status[id] === ACTIVE ? 'active' : 'dead',
      Math.max(0, battlefield.hp[id]),
    ];
  });
}

function createCoopWorldFrameState({tick, players, events}) {
  const sharedRun = run ?? coopTerminalRun;
  const authorityPhase = sharedRun?.phase ?? phase;
  const gates = battlefield ? [
    {id: 'outer', integrity: battlefield.outerGateHp[WEST], maxIntegrity: battlefield.outerGateMaxHp, destroyed: Boolean(battlefield.outerGateBreached[WEST])},
    {id: 'east', integrity: battlefield.outerGateHp[EAST], maxIntegrity: battlefield.outerGateMaxHp, destroyed: Boolean(battlefield.outerGateBreached[EAST])},
    {id: 'heart', integrity: battlefield.heartGateHp, maxIntegrity: battlefield.heartGateMaxHp, destroyed: battlefield.heartGateHp <= 0},
  ] : Object.entries(sharedRun?.gates ?? {}).filter(([id]) => id === 'outer' || id === 'east' || id === 'heart').map(([id, gate]) => ({
    id,
    integrity: gate.integrity,
    maxIntegrity: gate.maxIntegrity,
    destroyed: gate.destroyed,
  }));
  const fortifications = (sharedRun?.fortifications ?? []).map(placement => {
    const definition = FORTIFICATION_DEFINITIONS[placement.type];
    const maximum = Number.isFinite(definition?.charges) ? Math.max(1, definition.charges) : 1;
    return {
      id: placement.socketId,
      type: placement.type,
      integrity: Number.isFinite(placement.charges) ? Math.max(0, placement.charges) : 1,
      maxIntegrity: maximum,
    };
  });
  const activeNpcs = new Set(sharedRun?.hub?.activeNpcs ?? []);
  const fallen = new Set(sharedRun?.fallenNpcs ?? []);
  const npcs = [...activeNpcs, ...fallen].sort().map(id => ({
    id,
    state: fallen.has(id) ? 'fallen' : 'active',
    serviceId: id,
  }));
  const crowd = battlefield
    ? createCoopCrowdPresentation(battlefield)
    : {total: 0, active: 0, dying: 0, dead: 0, released: 0, unreleased: 0, cohort: []};
  const revive = sharedRun?.nightRuntime?.twinThorns ?? {available: false, consumed: false, reviveHp: 0};
  return {
    authorityTick: tick,
    night: sharedRun?.night ?? 1,
    phase: authorityPhase,
    subphase: coopSubphase(authorityPhase, sharedRun),
    wave: sharedRun?.wave ?? 0,
    players,
    crowd,
    boss: sharedRun?.bossEncounter?.mode === "authored-director" ? createCoopBossSnapshot(sharedRun.bossEncounter) : null,
    objective: coopObjectiveFrame(),
    resources: {
      supplies: sharedRun?.supplies ?? 0,
      earnedOathmarks: sharedRun?.earnedOathmarks ?? 0,
      pendingWeaponXp: {...(sharedRun?.pendingWeaponXp ?? {arbalest: 0, sunfire: 0, runebolt: 0})},
      sharedRevive: {available: revive.available === true, consumed: revive.consumed === true, reviveHp: Math.max(0, Number(revive.reviveHp) || 0)},
    },
    gates,
    fortifications,
    hub: {phase, npcs},
    narrative: createCoopNarrativeAuthorityState({
      profile,
      run: sharedRun,
      authorityTick: tick,
      responseId: narrativeSession?.chosenResponseId ?? null,
      responseTagId: narrativeSession?.appliedResponseTag ?? null,
    }),
    events: coopSemanticEvents.slice(-128),
    eventCursor: coopSemanticEventSequence,
    stateHash: coopWorldStateHash(tick),
  };
}

function createCoopCheckpointState() {
  syncRunState();
  const sharedRun = run ?? coopTerminalRun;
  if (!sharedRun || !coopPreview?.authority) return null;
  const checkpoint = createCoopCampaignCheckpoint({
    authorityTick: coopPreview.authority.tick,
    eventCursor: coopSemanticEventSequence,
    profile,
    run: projectCoopCheckpointRun(sharedRun),
    players: [...coopPreview.authority.players.values()],
    battlefield: battlefield ?? coopPreview.authority.battlefield,
    boss: sharedRun.bossEncounter?.mode === "authored-director" ? sharedRun.bossEncounter : null,
    objective: sharedRun.objectiveState ?? null,
    actionLedger: coopPreview.actionLedger?.snapshot?.() ?? {version: 1, streams: []},
    delayedEffects: snapshotAuthoritativeDelayedEffects(coopDelayedEffects),
    semanticEvents: coopSemanticEvents,
    settlement: coopSettlementState ?? {status: "open", runOrdinal: sharedRun.runOrdinal, outcome: null},
  });
  return {
    checkpoint,
    stateHash: checkpoint.hash,
  };
}

function musicEventFromCoopCheckpoint(state) {
  const boss = state?.boss;
  if (boss?.status === "active" && Array.isArray(boss.actors)) {
    const actor = [...boss.actors].filter(item => !item.defeated)
      .sort((left, right) => right.phase - left.phase || left.id.localeCompare(right.id, "en-US"))[0] ?? null;
    const phaseIndex = actor?.phase ?? 1;
    const kind = phaseIndex >= 4 ? "boss_final" : phaseIndex >= 3 ? "boss_enraged"
      : phaseIndex >= 2 ? "boss_phase_2" : "boss_phase_1";
    return {
      ...(state.eventCursor > 0 ? {sequence: state.eventCursor} : {}),
      kind,
      actorId: actor?.id ?? null,
      payload: {encounterId: boss.encounterId, phase: phaseIndex, night: state.run.night, wave: state.run.wave + 1},
    };
  }
  const latest = [...(state?.semanticEvents ?? [])].reverse().find(event => (
    event.category === "music"
      || (event.category === "campaign" && ["campaign_complete", "run_failed"].includes(event.kind))
  ));
  return latest ?? null;
}

function applyCoopCheckpointState(checkpoint) {
  if (coopPreview?.role !== 'guest') return false;
  let staged;
  try {
    staged = stageCoopCheckpointApplication(checkpoint, {
      createBattlefield: battlefieldCheckpoint => createBattlefield({
        capacity: battlefieldCheckpoint.capacity,
        fixedStep: battlefieldCheckpoint.fixedStep,
        maxSubSteps: battlefieldCheckpoint.maxSubSteps,
        playerSwarmCap: battlefieldCheckpoint.playerSwarmCap,
        outerGatePressureScale: battlefieldCheckpoint.outerGatePressureScale,
        outerGateContactPressureScale: battlefieldCheckpoint.outerGateContactPressureScale ?? 1,
      }),
      restoreActionLedger: snapshot => coopPreview.stageActionLedger(snapshot),
    });
    if (staged.boss) buildBossPresentationSnapshot(staged.boss, 1, {afterEventSequence: staged.eventCursor});
  } catch (error) {
    console.error('[Briarhold co-op] Checkpoint staging failed', error);
    return false;
  }
  try {
    return commitStagedCoopCheckpoint(staged, {
      capture: () => ({
        profile, run, battlefield, boss: run?.bossEncounter ?? null, players: coopPreview.latestFrame?.players ?? [],
        phase, settlement: coopSettlementState, semanticEvents: coopSemanticEvents,
        eventCursor: coopGuestEventCursor.sequence, previewCursor: coopPreview.lastAppliedEventSequence,
        actionLedger: coopPreview.checkpointActionLedger ?? null, authorityTick: coopPreview.latestFrame?.authorityTick ?? 0,
        delayedEffects: restoreAuthoritativeDelayedEffects(snapshotAuthoritativeDelayedEffects(coopDelayedEffects)),
      }),
      install: state => {
        profile = state.profile;
        run = state.run;
        battlefield = state.battlefield;
        coopSettlementState = state.settlement;
        coopSemanticEvents = state.semanticEvents;
        coopGuestEventCursor.restore(state.eventCursor);
        coopPreview.lastAppliedEventSequence = state.previewCursor ?? state.eventCursor;
        coopPreview.checkpointActionLedger = state.actionLedger;
        coopDelayedEffects = state.delayedEffects;
        if (state.players.length === 2) coopPreview.applyCheckpointFrame({authorityTick: state.authorityTick, players: state.players});
        setPhase(state.phase ?? state.run.phase);
      },
      present: state => {
        restoreFortificationVisuals();
        syncHubWorldPresentation();
        applyCoopBossPresentation(state.boss);
        const checkpointMusicEvent = musicEventFromCoopCheckpoint(state);
        if (checkpointMusicEvent) audio.applyMusicEvent(checkpointMusicEvent);
        syncGuestNarrativePresentation(state.run.narrative.activeScene);
        if (state.run.phase === GAME_PHASES.INTERWAVE_RECOVERY) {
          recoveryPresentation.show({
            warning: "The next wave begins automatically",
            remainingMs: state.run.recovery?.remainingMs ?? 0,
          });
        }
        if (phase === GAME_PHASES.BOON_CHOICE) renderBoonChoices();
        else if (phase === GAME_PHASES.NIGHT_COMPLETE) presentCoopNightComplete();
        else if (phase === GAME_PHASES.RUN_FAILED) presentCoopRunFailed();
        else if (phase === GAME_PHASES.CAMPAIGN_COMPLETE) presentCoopCampaignComplete();
      },
    });
  } catch (error) {
    console.error('[Briarhold co-op] Checkpoint presentation failed', error);
    return false;
  }
}

function presentCoopNightComplete() {
  show(ui.resultOverlay, true);
  ui.resultKicker.textContent = 'The eastern sky pales';
  ui.resultTitle.textContent = `Night ${run?.night ?? 1} held together`;
  ui.resultMessage.textContent = `The host confirmed the shared Night ${run?.night ?? 1} result.`;
  ui.resultKills.textContent = killsThisRun.toLocaleString();
  ui.resultOathmarks.textContent = run.earnedOathmarks;
  ui.resultHeart.textContent = `${Math.round(ratio(run.gates.heart.integrity, run.gates.heart.maxIntegrity) * 100)}%`;
  ui.resultContinue.textContent = 'Waiting for host';
}

function presentCoopCampaignComplete() {
  show(ui.resultOverlay, true);
  ui.resultKicker.textContent = 'Fire fades over the old stone';
  ui.resultTitle.textContent = 'Campaign complete together';
  ui.resultMessage.textContent = 'The host settled the seven-night campaign. Guest progress remains a session summary only.';
  ui.resultKills.textContent = killsThisRun.toLocaleString();
  ui.resultOathmarks.textContent = run?.earnedOathmarks ?? 0;
  ui.resultHeart.textContent = `${Math.round(ratio(run.gates.heart.integrity, run.gates.heart.maxIntegrity) * 100)}%`;
  ui.resultContinue.textContent = 'Leave co-op';
}

function presentCoopRunFailed() {
  show(ui.resultOverlay, true);
  ui.resultKicker.textContent = 'The green closes over the stones';
  ui.resultTitle.textContent = 'Briarhold falls';
  ui.resultMessage.textContent = 'The host ended the shared defence.';
  ui.resultContinue.textContent = 'Leave co-op';
}

async function ensureCoopPresentationBattlefield(frame) {
  const cohort = frame.crowd?.cohort ?? [];
  if (coopPreview?.role !== 'guest' || phase !== GAME_PHASES.COMBAT || !cohort.length) return;
  if (battlefield && battlefield.slotCount >= cohort.length) return;
  if (coopPresentationRendererPromise) return coopPresentationRendererPromise;
  coopPresentationRendererPromise = (async () => {
    const roster = cohort.map(tuple => ({type: tuple[1], x: tuple[2], z: tuple[3]}));
    const next = createBattlefield({capacity: Math.max(1, roster.length)}).initialize(roster);
    const presentation = refreshEnemyPresentationResolution();
    const renderer = await createEnemyRenderer({
      BABYLON, scene: world.scene, camera: world.camera, battlefield: next,
      profile: rendererProfile, forceLegacy: search.has('legacySprites'),
      animated3dLimit: presentation.maxAnimatedEnemies,
    });
    enemyRenderer?.dispose();
    battlefield = next;
    enemyRenderer = renderer;
    coopPresentationEnemyIds = new Map(cohort.map((tuple, index) => [tuple[0], index]));
  })().finally(() => { coopPresentationRendererPromise = null; });
  return coopPresentationRendererPromise;
}

function applyCoopSemanticPresentationEvent(event) {
  if (event.category === "music") {
    audio.applyMusicEvent(event);
  }
  if (event.category === "campaign" && ["campaign_complete", "run_failed"].includes(event.kind)) {
    audio.applyMusicEvent(event);
  }
  if (event.category === "boss" && event.kind === "dragon_breath") announce("Cinderwing breathes fire across the lane");
  if (event.category === "campaign" && event.kind === "campaign_complete") announce("All seven nights are held");
}

function presentationDirectorFromCoopBoss(snapshot) {
  if (!snapshot) return null;
  return {
    mode: 'authored-director',
    encounterId: snapshot.encounterId,
    label: snapshot.label,
    status: snapshot.status,
    timeMs: snapshot.timeMs,
    eventSequence: snapshot.eventSequence,
    actors: snapshot.actors.map(actor => structuredClone(actor)),
    hitVolumes: snapshot.hitVolumes.map(volume => structuredClone(volume)),
    zones: snapshot.zones.map(volume => structuredClone(volume)),
    events: [],
  };
}

function applyCoopBossPresentation(snapshot) {
  if (!snapshot) {
    show(ui.bossStatus, false);
    return;
  }
  const living = snapshot.actors.filter(actor => !actor.defeated);
  const hp = living.reduce((total, actor) => total + actor.hp, 0);
  const maxHp = snapshot.actors.reduce((total, actor) => total + actor.maxHp, 0);
  const name = snapshot.actors.map(actor => actor.title).join(" and ");
  writeHudText("boss:name", ui.bossName, name);
  writeHudText("boss:hp", ui.bossHealthText, `${Math.ceil(hp).toLocaleString()} · Phase ${Math.max(...snapshot.actors.map(actor => actor.phase))}`);
  writeHudText("boss:individuals", ui.bossIndividuals, snapshot.actors.map(actor => `${actor.title} ${Math.ceil(actor.hp).toLocaleString()}/${actor.maxHp.toLocaleString()}`).join(" · "));
  setBossMeterLabel(name);
  setMeter(ui.bossHealthBar, hp, maxHp);
  show(ui.bossStatus, snapshot.status === "active");

  const presentationState = presentationDirectorFromCoopBoss(snapshot);
  const presentation = buildBossPresentationSnapshot(presentationState, 1, {afterEventSequence: coopGuestEventCursor.sequence});
  writeHudText("boss:counter", ui.bossCounterText, presentation.hud.counterText);
  bossPresentationAdapter.update(presentation);
}

function guestNarrativeSession(activeScene) {
  if (!activeScene || !run) return null;
  let session = resumeNarrativeScene(activeScene, automaticNarrativeContext(undefined, run, profile));
  if (!session) {
    for (const npcId of run.hub?.activeNpcs ?? []) {
      session = resumeNarrativeScene(activeScene, narrativeContextFor(npcId));
      if (session) break;
    }
  }
  return session;
}

function syncGuestNarrativePresentation(activeScene, {forceOpen = false} = {}) {
  if (coopPreview?.role !== "guest") return false;
  const presentation = resolveCoopGuestNarrativePresentation({
    activeScene,
    hiddenBeatKey: guestHiddenNarrativeBeat,
    forceOpen,
  });
  const key = presentation.beatKey;
  if (!key) {
    guestHiddenNarrativeBeat = null;
    narrativeSession = null;
    narrativeServiceStation = null;
    if (narrativePresentation.isOpen) narrativePresentation.interrupt("host-complete");
    return false;
  }
  const currentKey = narrativeSession ? coopNarrativeBeatKey(narrativeSession) : null;
  if (!presentation.shouldOpen) return false;
  if (currentKey === key && narrativePresentation.isOpen) return true;
  guestHiddenNarrativeBeat = presentation.hiddenBeatKey;
  if (narrativePresentation.isOpen) {
    narrativeSession = null;
    narrativePresentation.interrupt("host-advanced");
  }
  narrativeSession = guestNarrativeSession(activeScene);
  narrativeServiceStation = null;
  narrativeAutomatic = false;
  if (!narrativeSession) {
    announce("Waiting for host · shared scene catalogue could not be resolved");
    coopPreview.requestResume();
    return false;
  }
  return presentNarrativeBeat();
}

function applyCoopWorldFrame(frame) {
  if (coopPreview?.role !== 'guest') return;
  const previousPhase = phase;
  if (!run) run = newRunState();
  const crossedRunBoundary = run.runOrdinal !== frame.narrative.runOrdinal || run.night !== frame.night;
  const priorRun = crossedRunBoundary ? {...run} : run;
  if (crossedRunBoundary) {
    delete priorRun.recovery;
    delete priorRun.bellConfirmation;
    priorRun.bossEncounter = null;
    priorRun.waveStartSnapshot = null;
  }
  const nextFortifications = frame.fortifications.map(item => ({socketId: item.id, type: item.type, charges: item.integrity}));
  const fortificationsChanged = fortificationStateKey(run?.fortifications) !== fortificationStateKey(nextFortifications);
  const nextGates = Object.fromEntries(frame.gates.map(gate => [gate.id, {kind: gate.id === 'heart' ? 'heart' : 'outer', integrity: gate.integrity, maxIntegrity: gate.maxIntegrity, destroyed: gate.destroyed}]));
  if (!nextGates.east && nextGates.outer) nextGates.east = {...nextGates.outer};
  const frameRun = {
    ...priorRun,
    runOrdinal: frame.narrative.runOrdinal,
    phase: frame.phase,
    night: frame.night,
    wave: frame.wave,
    supplies: frame.resources.supplies,
    earnedOathmarks: frame.resources.earnedOathmarks,
    pendingWeaponXp: {...frame.resources.pendingWeaponXp},
    objectiveState: frame.objective ? {
      night: frame.objective.night,
      id: frame.objective.id,
      label: frame.objective.label,
      status: frame.objective.status,
      evidence: {...(run.objectiveState?.evidence ?? {}), networkEvidenceHash: frame.objective.evidenceHash,
        bossObjectiveDurability: frame.objective.durability, bossObjectiveMaxDurability: frame.objective.maxDurability},
    } : null,
    nightRuntime: {...(run.nightRuntime ?? {}), twinThorns: {...frame.resources.sharedRevive}},
    gates: nextGates,
    fortifications: nextFortifications,
    hub: {...run.hub, activeNpcs: frame.hub.npcs.filter(item => item.state !== 'fallen').map(item => item.id)},
    fallenNpcs: frame.hub.npcs.filter(item => item.state === 'fallen').map(item => item.id),
  };
  const projected = projectCoopNarrativeGuestState({
    profile,
    run: frameRun,
    narrative: frame.narrative,
    authorityTick: frame.authorityTick,
  });
  profile = projected.profile;
  run = projected.run;
  if (phase !== frame.phase) setPhase(frame.phase);
  if (frame.phase === GAME_PHASES.INTERWAVE_RECOVERY) {
    recoveryPresentation.show({warning: "The next wave begins automatically", remainingMs: projected.remainingRecoveryMs});
  }
  syncGuestNarrativePresentation(frame.narrative.activeScene);
  if (previousPhase !== frame.phase && frame.phase === GAME_PHASES.BOON_CHOICE) renderBoonChoices();
  if (frame.phase === GAME_PHASES.NIGHT_COMPLETE) presentCoopNightComplete();
  if (frame.phase === GAME_PHASES.RUN_FAILED) presentCoopRunFailed();
  if (frame.phase === GAME_PHASES.CAMPAIGN_COMPLETE) presentCoopCampaignComplete();
  writeHudText("wave:title", ui.waveText, frame.phase === GAME_PHASES.COMBAT
    ? `Night ${frame.night} · Wave ${frame.wave + 1}`
    : `Night ${frame.night} · ${String(frame.phase).replaceAll('_', ' ')}`);
  writeHudText("wave:objective", ui.objectiveText, frame.objective
    ? `${frame.objective.label} · ${frame.objective.status}`
    : frame.phase === GAME_PHASES.COMBAT ? 'Hold Briarhold together' : 'Follow the host campaign authority');
  try {
    coopGuestEventCursor.apply(frame.events, applyCoopSemanticPresentationEvent);
    coopPreview.lastAppliedEventSequence = coopGuestEventCursor.sequence;
  } catch (error) {
    console.warn('[Briarhold] Co-op semantic event gap; requesting checkpoint correction', error);
    coopPreview.requestResume();
    return;
  }
  applyCoopBossPresentation(frame.boss);
  writeHudText("enemy:count", ui.enemyCountText, frame.crowd.active.toLocaleString());
  for (const gate of frame.gates) world.updateGateVisual(gate.id === 'outer' ? 'west' : gate.id === 'east' ? 'east' : 'heart', gate.integrity / gate.maxIntegrity, gate.destroyed);
  if (fortificationsChanged) restoreFortificationVisuals();
  void ensureCoopPresentationBattlefield(frame).then(() => {
    if (!battlefield || coopPreview?.role !== 'guest') return;
    for (let slot = 0; slot < battlefield.slotCount; slot += 1) battlefield.status[slot] = DEAD;
    const cohort = frame.crowd.cohort;
    coopPresentationEnemyIds = new Map(cohort.map((tuple, index) => [tuple[0], index]));
    for (let slot = 0; slot < cohort.length; slot += 1) {
      const tuple = cohort[slot];
      if (slot >= battlefield.slotCount) continue;
      battlefield.type[slot] = enemyTypeFrom(tuple[1]);
      battlefield.x[slot] = tuple[2]; battlefield.z[slot] = tuple[3]; battlefield.hp[slot] = tuple[6];
      battlefield.desiredVx[slot] = Math.sin(tuple[4]);
      battlefield.desiredVz[slot] = Math.cos(tuple[4]);
      battlefield.vx[slot] = battlefield.desiredVx[slot];
      battlefield.vz[slot] = battlefield.desiredVz[slot];
      battlefield.status[slot] = tuple[5] === 'dying' ? DYING : tuple[5] === 'active' ? ACTIVE : DEAD;
    }
  }).catch(error => console.warn('[Briarhold] Co-op enemy presentation could not be prepared', error));
}

function resolveCoopAuthorityEvents(events) {
  if (coopPreview?.role !== 'host' || phase !== GAME_PHASES.COMBAT || !battlefield) return;
  const disabledCollisionIds = playerGateCollisionOptions(battlefield).disabledCollisionIds ?? null;
  for (const event of events) {
    appendCoopSemanticEvent('combat', event.kind, event.actorId, {}, event.tick);
    const weaponId = event.kind === 'melee_strike' ? 'knife' : WEAPON_IDS[event.weaponSlot];
    const tuning = weaponId === 'knife' ? {} : runtimeProgressionTuning(profile, run, weaponId, {ads: event.mode?.ads === true});
    const bossKills = [];
    const result = resolveAuthoritativeCombatEvent({
      battlefield, event, mapDefinition: BRIARHOLD_FIRST_PERSON_MAP, disabledCollisionIds,
      damageMultiplier: calculatePermanentBonuses(profile).weaponDamageMultiplier * calculateRunBoonEffects(run).weaponDamageMultiplier,
      // damageBossActor consumes the shared permanent/boon multiplier after
      // applying authored boss armour and encounter-specific modifiers.
      bossDamageMultiplier: 1,
      tuning,
      bossEncounter: authoredBossActive() ? run.bossEncounter : null,
      firePotPlacements: run.fortifications,
      firePotSockets: world.sockets,
      applyFirePot: socketId => activateFirePot(socketId, 'shot'),
      applyBossHit: hit => {
        const before = run.bossEncounter?.actors.find(actor => actor.id === hit.actorId);
        const applied = damageBossActor(hit.actorId, hit.damage, hit.weaponId, {
          armourMultiplier: hit.armourMultiplier ?? 1,
          stagger: hit.stagger ?? 0,
          sourcePosition: {x: event.origin.x, z: event.origin.z},
        });
        const after = run.bossEncounter?.actors.find(actor => actor.id === hit.actorId);
        if (applied && before && !before.defeated && after?.defeated) bossKills.push(hit.actorId);
        return applied;
      },
    });
    lastCoopCombatResolution = structuredClone(result);
    for (const fact of createCombatGoalEvents(result, {
      eventId: `run-${run.runOrdinal}-night-${run.night}-wave-${run.wave}-combat-${event.actorId}-${event.sequence}`,
    })) applyGoalFact(fact);
    for (const effect of result.effects?.staggers ?? []) staggerEnemy(effect.enemyId, effect.seconds);
    for (const effect of result.effects?.armourCracks ?? []) if (Number.isInteger(effect.enemyId)) {
      armourCrackUntil.set(effect.enemyId, {
        until: battlefield.elapsed + effect.seconds, damageMultiplier: effect.damageMultiplier,
      });
    }
    for (const effect of result.effects?.gravityPulses ?? []) {
      for (const id of battlefield.queryHits({x: effect.x, z: effect.z, radius: effect.radius, maxResults: 48})) {
        staggerEnemy(id, effect.seconds);
      }
    }
    for (const [index, effect] of (result.effects?.clusterImpacts ?? []).entries()) scheduleAuthoritativeDelayedEffect(coopDelayedEffects, {
      id: `${event.actorId}:event-${event.sequence}:cluster-${index}`,
      sourceEventId: `event-${event.sequence}`,
      streamId: `${event.actorId}:${result.weaponId}`,
      sequence: event.sequence * 128 + index + 1,
      actorId: event.actorId,
      weaponId: result.weaponId,
      weaponSlot: event.weaponSlot,
      dueAt: battlefield.elapsed + effect.delaySeconds,
      point: {x: effect.x, y: effect.y, z: effect.z},
      damage: WEAPON_DEFINITIONS.runebolt.damage * effect.damageMultiplier,
      radius: effect.radius,
      armourMultiplier: tuning.armourCrackDamageMultiplier ?? 1,
      directTargetId: effect.directTargetId,
      directTargetArmourMultiplier: effect.directTargetArmourMultiplier,
      stagger: (tuning.gravityPulseSeconds ?? 0) * 20,
      killHeatRefund: tuning.killHeatRefund ?? 0,
    });
    for (const hit of result.hits) {
      const source = `player:${result.weaponId}`;
      recordEnemyDamage(source, hit.enemyId, {...hit, hit: true});
      if (hit.killed) {
        killsThisRun += 1;
        if (currentRoster && WEAPON_IDS.includes(result.weaponId)) {
          const weaponState = coopPreview.authority.weaponStates.get(event.actorId);
          const actorHeat = (weaponState?.heatByWeapon?.[event.weaponSlot] ?? 0) / WEAPON_HEAT_SCALE;
          const killEffects = applyCampaignWeaponKillEffects(profile, run, currentRoster, hit.enemyId, result.weaponId, {
            killed: true,
            heat: actorHeat,
            killHeatRefund: tuning.killHeatRefund ?? 0,
          });
          profile = killEffects.profile;
          run = killEffects.run;
          if (killEffects.refunded) applySessionWeaponHeatRefund(coopPreview.authority, event.actorId,
            event.weaponSlot, tuning.killHeatRefund);
          if (event.actorId === coopPreview.localId) weapon.heat = killEffects.heat;
        }
      }
    }
    for (const actorId of bossKills) {
      const weaponState = coopPreview.authority.weaponStates.get(event.actorId);
      const actorHeat = (weaponState?.heatByWeapon?.[event.weaponSlot] ?? 0) / WEAPON_HEAT_SCALE;
      const killEffects = applyCampaignBossWeaponKillEffects(profile, run, actorId, result.weaponId, {
        killed: true, heat: actorHeat, killHeatRefund: tuning.killHeatRefund ?? 0,
      });
      profile = killEffects.profile;
      run = killEffects.run;
      if (killEffects.refunded) applySessionWeaponHeatRefund(coopPreview.authority, event.actorId,
        event.weaponSlot, tuning.killHeatRefund);
      if (event.actorId === coopPreview.localId) weapon.heat = killEffects.heat;
    }
    if (result.weaponId === 'knife') audio.melee();
    else audio.shot(result.weaponId, {shot: event.shotSequence});
    if (event.actorId === coopPreview.localId && result.weaponId !== 'knife') viewmodelRecoil.fire();
    if (result.impact?.point) {
      const colour = result.weaponId === 'sunfire' ? '#f39a45' : result.weaponId === 'runebolt' ? '#92d4a5' : '#e8d29a';
      world.impact(new BABYLON.Vector3(result.impact.point.x, result.impact.point.y, result.impact.point.z), colour, result.weaponId === 'runebolt' ? 2.4 : .65);
    }
  }
}

function handleCoopActionRequest(request) {
  if (coopPreview?.role !== 'host' || !run) return {status: 'rejected', reason: 'host_not_ready'};
  const actor = coopPreview.playerState(coopPreview.remoteId);
  if (!actor) return {status: 'rejected', reason: 'unknown_actor'};
  try {
    if (request.action === 'build') {
      const socket = world.sockets.find(item => item.id === request.payload.socketId);
      const near = nearestBuildSocket(4.2, actor);
      if (!socket || near?.socket?.id !== socket.id) throw new Error('build_socket_out_of_range');
      const previous = selectedSocket; selectedSocket = socket;
      const accepted = installSelectedFortification(request.payload.fortificationType);
      selectedSocket = previous;
      if (!accepted) throw new Error('build_rejected');
    } else if (request.action === 'choose_boon') {
      if (phase !== GAME_PHASES.BOON_CHOICE) throw new Error('boon_not_available');
      chooseBoon(request.payload.boonId);
    } else if (request.action === 'npc_interaction') {
      const station = BRIARHOLD_FIRST_PERSON_MAP.hubStations.find(item => item.kind === request.payload.npcId) ?? null;
      validateCoopNpcInteractionAuthority({request, requesterRole: 'guest', run, profile, actor, station,
        serviceAvailable: station ? isHubServiceAvailable(station.kind, run, {profile}) : false});
      if (!interactWithNpc(station) || !run.narrative.activeScene) {
        closeHubService();
        throw new Error('shared_scene_not_available');
      }
      coopPreview.queueCheckpoint('shared_scene_started');
    } else if (request.action === 'medicine_consume') {
      validateCoopNarrativeMutation({request, executorRole: 'host', requesterRole: 'guest', run});
      if (request.payload.actorId !== actor.playerId) throw new Error('medicine_actor_mismatch');
      const interaction = nearestAuthoredInteraction(2.5, actor)?.interaction;
      if (interaction?.kind !== 'emergency-heal') throw new Error('medicine_out_of_range');
      const result = consumeFieldMedicine(run, request.payload, {
        actorId: actor.playerId,
        localActorId: coopPreview.localId,
        hp: actor.hp,
        maxHp: actor.maxHp,
      });
      run = result.run;
      coopPreview.authority.players.set(actor.playerId, createNetworkPlayerState({
        ...actor,
        hp: result.actor.hp,
        healAvailable: false,
      }));
      appendCoopSemanticEvent('campaign', 'medicine_consumed', actor.playerId, {amount: result.effect.amount});
      persistRun();
      coopPreview.queueCheckpoint('medicine_consumed');
    } else if (request.action === 'repair_gate') {
      const hub = nearestHubStation(2.5, actor);
      if (phase !== GAME_PHASES.DAYTIME || hub?.station?.kind !== HUB_NPC_IDS.MASON) throw new Error('mason_out_of_range');
      if (!isHubServiceAvailable(HUB_NPC_IDS.MASON, run, {profile})) throw new Error('mason_unavailable');
      const gateId = request.payload.gateId === 'heart' ? 'heart' : request.payload.gateId === 'east' ? 'east' : 'outer';
      if (!repairHubGate(gateId)) throw new Error('repair_rejected');
    } else if (request.action === 'restore_defences') {
      const hub = nearestHubStation(2.5, actor);
      if (phase !== GAME_PHASES.DAYTIME || hub?.station?.kind !== HUB_NPC_IDS.TRAPPER || run.supplies < 10) throw new Error('trapper_out_of_range');
      if (!isHubServiceAvailable(HUB_NPC_IDS.TRAPPER, run, {profile})) throw new Error('trapper_unavailable');
      run = {...run, supplies: run.supplies - 10, fortifications: run.fortifications.map(item => ({...item, charges: FORTIFICATION_DEFINITIONS[item.type]?.charges ?? item.charges}))};
      restoreFortificationVisuals(); persistRun();
    } else if (request.action === 'ward_light') {
      if (phase !== GAME_PHASES.COMBAT) throw new Error('ward_light_wrong_phase');
      if (!authoredBossActive()) throw new Error('ward_light_not_available');
      const target = run.bossEncounter.actors.find(item => item.id === request.payload.actorId && !item.defeated);
      if (!target) throw new Error('ward_light_target_missing');
      const origin = {x: actor.position.x, y: actor.position.y + actor.eyeHeight, z: actor.position.z};
      const targetPoint = {x: target.position.x, y: target.position.y + 1, z: target.position.z};
      const dx = targetPoint.x - origin.x; const dy = targetPoint.y - origin.y; const dz = targetPoint.z - origin.z;
      const distance = Math.hypot(dx, dy, dz);
      const blocker = firstMapRayHit(origin, {x: dx, y: dy, z: dz}, distance, {
        mapDefinition: BRIARHOLD_FIRST_PERSON_MAP,
        disabledCollisionIds: playerGateCollisionOptions(battlefield).disabledCollisionIds ?? null,
      });
      const ward = validateCoopWardLightContext({
        phase, authoredBossActive: authoredBossActive(), actor, target,
        occluded: Boolean(blocker && blocker.distance + 0.08 < distance),
      });
      const before = target.state;
      applyBossDirectorUpdate({commands: [{
        id: `coop:${request.requestId}:ward-light`,
        type: 'ward_light',
        actorId: target.id,
        source: ward.source,
        direction: ward.direction,
      }]});
      if (run.bossEncounter.actors.find(item => item.id === target.id)?.state === before) throw new Error('ward_light_rejected');
      persistRun();
    } else if (request.action === 'revive') {
      if (phase !== GAME_PHASES.COMBAT) throw new Error('revive_not_available');
      const target = coopPreview.authority.players.get(request.payload.targetPlayerId);
      if (actor.hp <= 0 || target?.playerId === actor.playerId || !target || target.hp > 0
        || Math.hypot(target.position.x - actor.position.x, target.position.z - actor.position.z) > 3.2) {
        throw new Error('revive_target_out_of_range');
      }
      if (!applyHostCoopSharedRevive(request.payload.targetPlayerId)) throw new Error('revive_rejected');
    } else if (request.action === 'npc_action') {
      const station = nearestHubStation(2.5, actor, {allowCombat: true});
      const rally = run.nightRuntime?.bellkeeperRally;
      validateCoopNpcActionContext({phase, npcId: request.payload.npcId, actionId: request.payload.actionId,
        nearestNpcId: station?.station?.kind ?? null, rally});
      run = {...run, nightRuntime: {...run.nightRuntime, bellkeeperRally: {...rally, used: true, remaining: rally.duration}}};
      appendCoopSemanticEvent('campaign', 'bellkeeper_rally', actor.playerId, {amount: rally.duration});
      persistRun();
    } else if (request.action === 'manual_vent') {
      if (!applyHostCoopManualVent(actor.playerId)) throw new Error('manual_vent_rejected');
    } else if ([
      'scene_advance', 'scene_response', 'scene_skip', 'goal_accept', 'goal_report',
      'daywork', 'medicine_prepare', 'bell_confirm', 'goals_panel', 'service_request',
    ].includes(request.action)) {
      validateCoopNarrativeMutation({request, executorRole: 'host', requesterRole: 'guest', run});
      throw new Error('host_only_action');
    } else throw new Error('unsupported_action');
    return {status: 'accepted', result: null, authoritativeTick: coopPreview.authority?.tick ?? 0};
  } catch (error) {
    return {status: 'rejected', reason: coerceCoopActionRejectionCode(error), result: null,
      authoritativeTick: coopPreview.authority?.tick ?? 0};
  }
}

function activateCoopWorld({checkpointReason = null} = {}) {
  if (!coopPreview) return;
  document.body.classList.add("coop-active");
  if (coopPreview.role === "host") {
    const restart = createCoopCampaignRestart({
      profile,
      players: [...coopPreview.authority.players.values()],
      runSeed: (Date.now() >>> 0) || 1,
    });
    profile = restart.profile;
    run = restart.run;
    coopSettlementState = {status: "open", runOrdinal: run.runOrdinal, outcome: null};
    coopTerminalRun = null;
    killsThisRun = 0;
    coopPreview.authority.players = new Map(restart.players.map(state => [state.playerId, state]));
    coopPreview.authority.weaponStates = new Map(restart.weaponStates.map(state => [state.playerId, state]));
    coopPreview.applyCheckpointFrame({authorityTick: coopPreview.authority.tick, players: restart.players});
  } else if (!run) run = createCoopCampaignRun(profile);
  battlefield = null;
  enemyRenderer?.dispose();
  enemyRenderer = null;
  enterDaytime(true, {queueNarrative: coopPreview.role === "host"});
  canvas.focus({preventScroll: true});
  show(ui.leaveCoopButton, true);
  ui.waveText.textContent = "Two-Warden seven-night campaign";
  ui.objectiveText.textContent = coopPreview.role === "host" ? "Host authority active · prepare Night 1 together" : "Receiving the host's campaign authority";
  ui.controlsHelp.textContent = "Host owns enemies, NPCs, gates, supplies, combat, waves, boons and saves";
  world.setFirstPersonPose(player, 0);
  if (checkpointReason && coopPreview.role === "host") coopPreview.queueCheckpoint(checkpointReason);
}

const COOP_ACTION_REJECTION_COPY = Object.freeze({
  action_not_available: "That shared action is not available",
  actor_unavailable: "Your Warden cannot use that action now",
  host_only_action: "Only the host can change that shared state",
  npc_fallen: "That NPC has fallen",
  npc_out_of_range: "Move closer to the NPC",
  npc_service_unavailable: "That service is not available yet",
  npc_unavailable: "That NPC is not available",
  stale_request: "The shared state changed; try again",
  stale_scene: "The host has already moved to another scene beat",
  wrong_phase: "That action is not available in this phase",
});

function coopActionRejectionCopy(reason) {
  return COOP_ACTION_REJECTION_COPY[reason] ?? "The host could not apply that shared action";
}

async function createCoopForRole(role, {turnServers = []} = {}) {
  disposeCoopPreview();
  lastCoopEndedReason = null;
  coopPersistenceBoundary = createCoopPersistenceBoundary({
    role,
    profile,
    run,
    storage: save.storage,
    storageKey: save.key,
  });
  player = createPlayerState({position: {x: role === "host" ? -17.5 : -14.5, y: 3.5, z: 17}});
  coopPreview = new CoopMovementPreview({
    role,
    BABYLON,
    scene: world.scene,
    localPlayer: player,
    turnServers,
    resolveWeaponTuning: (_playerId, weaponSlot, mode) => runtimeProgressionTuning(
      profile, run, WEAPON_IDS[weaponSlot], {ads: mode.ads},
    ),
    onStatus: setCoopStatus,
    onAuthorityEvents: resolveCoopAuthorityEvents,
    onActionRequest: handleCoopActionRequest,
    onActionAck: message => announce(message.status === 'accepted'
      ? 'Host accepted the shared action'
      : coopActionRejectionCopy(message.reason)),
    createWorldFrame: createCoopWorldFrameState,
    onWorldFrame: applyCoopWorldFrame,
    createCheckpoint: createCoopCheckpointState,
    applyCheckpoint: applyCoopCheckpointState,
    onAuthorityPaused: () => { paused = true; announce('Host authority paused'); },
    onAuthorityResumed: () => { paused = false; announce('Host authority resumed'); },
    onIceCandidate: event => {
      if (!coopSignaling || !event?.peerId) return;
      try { coopSignaling.sendSignal(event.peerId, {type: 'candidate', candidate: event.candidate ?? null}); }
      catch { /* candidate can arrive before the signaling socket welcome; negotiation will continue */ }
    },
    onConnected: () => {
      activateCoopWorld();
    },
    onEnded: reason => {
      lastCoopDropBudget = coopPreview?.diagnostics?.().lastDropBudget ?? null;
      lastCoopEndedReason = reason;
      returnToMenu();
      announce(`Co-op ended · ${reason}`);
    },
  });
  await audio.unlock();
  return coopPreview;
}

function setCoopOnlineBusy(busy) {
  ui.coopHost.disabled = busy;
  ui.coopJoin.disabled = busy;
  ui.coopRoomCode.disabled = busy;
}

function relayIceServers(iceConfig) {
  return iceConfig.iceServers.filter(server => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.some(url => typeof url === "string" && /^turns?:/u.test(url));
  });
}

async function handleSignalingEvent(message) {
  if (!coopPreview) return;
  try {
    if (message.type === "socket-closed" && !coopPreview.connected) {
      disposeCoopPreview();
      setCoopStatus("Room service disconnected before the direct game channel opened. Create or join a new room.");
      return;
    }
    if (message.type === "peer-joined" && coopPreview.role === "host") {
      setCoopStatus("Guest found. Opening the direct game channel…");
      const offer = await coopPreview.createOfferForPeer(message.peerId, {trickle: true});
      coopSignaling?.sendSignal(message.peerId, offer);
    } else if (message.type === "signal" && message.signal?.type === "offer" && coopPreview.role === "guest") {
      const answer = await coopPreview.acceptOfferFromPeer(message.from, message.signal, {trickle: true});
      coopSignaling?.sendSignal(message.from, answer);
      await flushCoopIceCandidates(message.from);
      setCoopStatus("Host answered. Opening the direct game channel…");
    } else if (message.type === "signal" && message.signal?.type === "answer" && coopPreview.role === "host") {
      await coopPreview.acceptAnswerFromPeer(message.from, message.signal);
      await flushCoopIceCandidates(message.from);
    } else if (message.type === "signal" && message.signal?.type === "candidate") {
      const queue = pendingCoopIceCandidates.get(message.from) ?? [];
      queue.push(message.signal.candidate);
      pendingCoopIceCandidates.set(message.from, queue);
      try { await flushCoopIceCandidates(message.from); }
      catch { /* remote description may not be installed yet; retry after offer/answer */ }
    } else if (message.type === "peer-left" && !coopPreview.connected) {
      setCoopStatus("The guest left before the game channel opened.");
    } else if (message.type === "room-closed" && !coopPreview.connected) {
      setCoopStatus("The room closed before the game channel opened.");
    } else if (message.type === "client-error" && !coopPreview.connected) {
      setCoopStatus(`Room service error: ${message.error?.message ?? "unknown"}`);
    }
  } catch (error) {
    setCoopStatus(`Could not negotiate the game channel: ${error.message}`);
  }
}

async function flushCoopIceCandidates(peerId) {
  const queue = pendingCoopIceCandidates.get(peerId);
  if (!queue || !coopPreview) return;
  while (queue.length) {
    const candidate = queue[0];
    await coopPreview.addIceCandidateFromPeer(peerId, candidate);
    queue.shift();
  }
  pendingCoopIceCandidates.delete(peerId);
}

async function beginCoopHost() {
  try {
    setCoopOnlineBusy(true);
    setCoopStatus("Creating a private room…");
    const [room, ice] = await Promise.all([
      createSignalingRoom({baseUrl: BRIARHOLD_SIGNALING_URL}),
      fetchOptionalSignalingIceConfig({baseUrl: BRIARHOLD_SIGNALING_URL}),
    ]);
    await createCoopForRole("host", {turnServers: relayIceServers(ice)});
    coopSignaling = new SignalingConnection({
      baseUrl: BRIARHOLD_SIGNALING_URL,
      roomId: room.roomId,
      role: "host",
      hostToken: room.hostToken,
      onEvent: message => { coopSignalingEventChain = coopSignalingEventChain.then(() => handleSignalingEvent(message)); },
    });
    await coopSignaling.connect();
    ui.coopRoomCode.value = formatRoomCode(room.roomId);
    ui.coopRoomCopy.disabled = false;
    setCoopStatus(`Room ready${ice.relayAvailable ? " with relay fallback" : " for direct connections"}. Send the code to the other Warden.`);
  } catch (error) {
    disposeCoopPreview();
    setCoopStatus(`Could not create online room: ${error.message}. Manual fallback remains available.`);
  } finally {
    setCoopOnlineBusy(false);
  }
}

async function beginCoopJoin() {
  let roomId;
  try {
    roomId = normalizeRoomCode(ui.coopRoomCode.value);
  } catch (error) {
    setCoopStatus(error.message);
    ui.coopRoomCode.focus();
    return;
  }
  try {
    setCoopOnlineBusy(true);
    setCoopStatus("Finding the host…");
    const ice = await fetchOptionalSignalingIceConfig({baseUrl: BRIARHOLD_SIGNALING_URL});
    await createCoopForRole("guest", {turnServers: relayIceServers(ice)});
    coopSignaling = new SignalingConnection({
      baseUrl: BRIARHOLD_SIGNALING_URL,
      roomId,
      role: "guest",
      onEvent: message => { coopSignalingEventChain = coopSignalingEventChain.then(() => handleSignalingEvent(message)); },
    });
    await coopSignaling.connect();
    setCoopStatus("Host found. Waiting for the direct game channel…");
  } catch (error) {
    disposeCoopPreview();
    setCoopStatus(`Could not join online room: ${error.message}. Check the code or use manual fallback.`);
  } finally {
    setCoopOnlineBusy(false);
  }
}

async function beginManualCoopHost() {
  try {
    const preview = await createCoopForRole("host");
    setCoopStatus("Creating a direct invite…");
    ui.coopSignalText.value = await preview.createHostInvite();
    coopSignalStep = "host-reply";
    ui.coopSignal.textContent = "Accept guest reply";
    ui.coopSignal.disabled = false;
    ui.coopCopy.disabled = false;
  } catch (error) {
    setCoopStatus(`Could not create invite: ${error.message}`);
  }
}

async function beginManualCoopJoin() {
  try {
    const preview = await createCoopForRole("guest");
    coopSignalStep = "guest-offer";
    ui.coopSignal.textContent = "Create reply from invite";
    ui.coopSignal.disabled = false;
    ui.coopCopy.disabled = true;
    ui.coopSignalText.value = "";
    ui.coopSignalText.focus();
    setCoopStatus("Paste the host invite, then create your reply.");
    return preview;
  } catch (error) {
    setCoopStatus(`Could not prepare joining: ${error.message}`);
    return null;
  }
}

async function advanceCoopSignal() {
  if (!coopPreview) return;
  try {
    if (coopSignalStep === "guest-offer") {
      ui.coopSignalText.value = await coopPreview.acceptHostInvite(ui.coopSignalText.value);
      coopSignalStep = "guest-wait";
      ui.coopSignal.textContent = "Waiting for host";
      ui.coopSignal.disabled = true;
      ui.coopCopy.disabled = false;
    } else if (coopSignalStep === "host-reply") {
      await coopPreview.acceptGuestReply(ui.coopSignalText.value);
      coopSignalStep = "host-wait";
      ui.coopSignal.textContent = "Opening channel";
      ui.coopSignal.disabled = true;
    }
  } catch (error) {
    setCoopStatus(`Connection step failed: ${error.message}`);
  }
}

async function copyCoopSignal() {
  try {
    await navigator.clipboard.writeText(ui.coopSignalText.value);
    setCoopStatus("Copied. Send this text to the other Warden.");
  } catch {
    ui.coopSignalText.select();
    setCoopStatus("Copy was blocked; the invite text is selected for manual copying.");
  }
}

async function copyCoopRoomCode() {
  try {
    await navigator.clipboard.writeText(normalizeRoomCode(ui.coopRoomCode.value));
    setCoopStatus("Room code copied. Send it to the other Warden.");
  } catch {
    ui.coopRoomCode.select();
    setCoopStatus("Copy was blocked; the room code is selected.");
  }
}

function closeSettingsPanel() {
  const trigger = ui.settingsPanel.parentElement === ui.pauseSettingsMount
    ? ui.pauseSettingsButton
    : ui.settingsButton;
  show(ui.settingsPanel, false);
  ui.menuSecondary.append(ui.settingsPanel);
  ui.settingsButton.setAttribute("aria-expanded", "false");
  ui.pauseSettingsButton.setAttribute("aria-expanded", "false");
  if (controllerPresent && trigger && !trigger.closest("[hidden]")) trigger.focus();
}

function openSettingsPanel(mount, trigger) {
  if (!ui.coopPanel.hidden) closeCoopPanel();
  mount.append(ui.settingsPanel);
  show(ui.settingsPanel, true);
  show(ui.howPanel, false);
  show(ui.coopPanel, false);
  ui.coopButton.setAttribute("aria-expanded", "false");
  ui.howButton.setAttribute("aria-expanded", "false");
  ui.settingsButton.setAttribute("aria-expanded", String(trigger === ui.settingsButton));
  ui.pauseSettingsButton.setAttribute("aria-expanded", String(trigger === ui.pauseSettingsButton));
  refreshControllerMappingStatus();
  ui.settingsPanel.scrollTop = 0;
  if (controllerPresent) queueMicrotask(() => ui.volume.focus());
}

function closeHowPanel() {
  show(ui.howPanel, false);
  ui.howButton.setAttribute("aria-expanded", "false");
  if (controllerPresent) ui.howButton.focus();
}

function requestQuitGame() {
  show(ui.quitConfirmOverlay, true);
  ui.quitCancel.focus();
}

function closeQuitPrompt() {
  show(ui.quitConfirmOverlay, false);
}

function requestDeleteSave() {
  ui.deleteSaveStatus.textContent = "This cannot be undone.";
  show(ui.deleteSaveOverlay, true);
  ui.deleteSaveCancel.focus();
}

function closeDeleteSavePrompt() {
  show(ui.deleteSaveOverlay, false);
  if (!ui.settingsPanel.hidden) ui.deleteSave.focus();
}

async function confirmDeleteSave() {
  const cleared = save.clear();
  if (!cleared.ok) {
    ui.deleteSaveStatus.textContent = "Briarhold could not delete the save. Nothing in this session was reset.";
    announce("Save deletion failed. Your current progress is still loaded.");
    return false;
  }
  disposeCoopPreview({restoreSolo: false, discardPersistence: true});
  profile = freshProfileAfterSaveDeletion(profile);
  run = null;
  pendingTerminalTransition = null;
  enemyRenderer?.dispose();
  enemyRenderer = null;
  battlefield = null;
  currentRoster = null;
  hubCombatState = null;
  paused = false;
  show(ui.pauseOverlay, false);
  show(ui.leaveCoopButton, false);
  closeDeleteSavePrompt();
  closeSettingsPanel();
  await startNewRun();
  announce("Save deleted · a new oath begins");
  return true;
}

function updateStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function showPendingAndroidUpdate() {
  if (!pendingAndroidUpdate || phase !== GAME_PHASES.MENU) return false;
  if (isUpdateSnoozed(updateStorage(), pendingAndroidUpdate.versionCode)) {
    pendingAndroidUpdate = null;
    return false;
  }
  ui.updateTitle.textContent = pendingAndroidUpdate.title;
  ui.updateVersion.textContent = `Version ${pendingAndroidUpdate.versionName}`;
  ui.updateNotes.textContent = pendingAndroidUpdate.notes || "A newer Briarhold alpha is ready to install.";
  pendingUpdateRestoreFocus = document.activeElement;
  show(ui.updateOverlay, true);
  queueMicrotask(() => ui.updateNow.focus());
  return true;
}

function closeAndroidUpdate({snooze = false} = {}) {
  if (snooze && pendingAndroidUpdate) {
    snoozeUpdate(updateStorage(), pendingAndroidUpdate.versionCode);
    pendingAndroidUpdate = null;
  }
  show(ui.updateOverlay, false);
  const restore = pendingUpdateRestoreFocus;
  pendingUpdateRestoreFocus = null;
  if (restore?.focus) queueMicrotask(() => restore.focus());
}

async function refreshAndroidUpdate() {
  const now = Date.now();
  if (now - lastAndroidUpdateCheckAt < ANDROID_UPDATE_CHECK_INTERVAL_MS) {
    showPendingAndroidUpdate();
    return androidUpdateCheckPromise;
  }
  if (androidUpdateCheckPromise) return androidUpdateCheckPromise;
  lastAndroidUpdateCheckAt = now;
  androidUpdateCheckPromise = checkForAndroidUpdate()
    .then((result) => {
      if (result.status === "available") pendingAndroidUpdate = result.manifest;
      else if (result.status === "current") pendingAndroidUpdate = null;
      showPendingAndroidUpdate();
      return result;
    })
    .finally(() => { androidUpdateCheckPromise = null; });
  return androidUpdateCheckPromise;
}

async function openAndroidUpdate() {
  const update = pendingAndroidUpdate;
  if (!update) return;
  closeAndroidUpdate();
  const opened = await openTrustedUpdateUrl(update.updateUrl);
  if (opened) pendingAndroidUpdate = null;
  else {
    pendingAndroidUpdate = update;
    showPendingAndroidUpdate();
    announce("Could not open the trusted update page");
  }
}

function confirmQuitGame() {
  persistRun();
  const nativeApp = window.Capacitor?.Plugins?.App;
  if (typeof nativeApp?.exitApp === "function") nativeApp.exitApp();
  else window.close?.();
}

function handleBackAction() {
  if (playtestReporter?.isOpen) {
    playtestReporter.close();
    return true;
  }
  if (!ui.updateOverlay.hidden) {
    closeAndroidUpdate({snooze: true});
    return true;
  }
  if (narrativePresentation.isOpen) {
    const action = resolveGameBackAction({dialogueOpen: narrativePresentation.isOpen, goalsOpen: goalsPresentation.isOpen, phase, paused});
    if (action === GAME_BACK_ACTIONS.CLOSE_DIALOGUE) narrativePresentation.interrupt("back");
    return true;
  }
  if (goalsPresentation.isOpen) {
    const action = resolveGameBackAction({dialogueOpen: narrativePresentation.isOpen, goalsOpen: goalsPresentation.isOpen, phase, paused});
    if (action === GAME_BACK_ACTIONS.CLOSE_GOALS) goalsPresentation.close();
    return true;
  }
  if (!ui.oathHallPanel.hidden) {
    if (oathHallAtlasState.detailsOpen !== false) {
      oathHallAtlasState = {...oathHallAtlasState, detailsOpen: false};
      renderOathHall();
      ui.oathHallSections.querySelector(`[data-oath-node="${oathHallAtlasState.selectedId}"]`)?.focus();
      return true;
    }
    closeOathHall();
    ui.oathHallButton.focus();
    return true;
  }
  if (!ui.coopPanel.hidden) {
    closeCoopPanel();
    return true;
  }
  if (!ui.hubServicePanel.hidden) {
    closeHubService();
    return true;
  }
  if (phase === GAME_PHASES.DAYTIME
    && compactBuildPanelMedia.matches
    && !ui.buildPanelDetails.hidden
    && !touchBuildSheetSocketId) {
    setBuildPanelExpanded(false);
    return true;
  }
  const action = resolveGameBackAction({
    dialogueOpen: narrativePresentation.isOpen,
    reportOpen: Boolean(playtestReporter?.isOpen),
    goalsOpen: goalsPresentation.isOpen,
    updateOpen: !ui.updateOverlay.hidden,
    quitOpen: !ui.quitConfirmOverlay.hidden || !ui.deleteSaveOverlay.hidden,
    mappingOpen: Boolean(controllerMappingSession),
    buildSheetOpen: Boolean(touchBuildSheetSocketId),
    settingsOpen: !ui.settingsPanel.hidden,
    howOpen: !ui.howPanel.hidden,
    paused,
    phase,
  });
  if (action === GAME_BACK_ACTIONS.CLOSE_DIALOGUE) narrativePresentation.interrupt("back");
  else if (action === GAME_BACK_ACTIONS.CLOSE_GOALS) goalsPresentation.close();
  else if (action === GAME_BACK_ACTIONS.CLOSE_UPDATE) closeAndroidUpdate({snooze: true});
  else if (action === GAME_BACK_ACTIONS.CLOSE_QUIT) {
    if (!ui.deleteSaveOverlay.hidden) closeDeleteSavePrompt();
    else closeQuitPrompt();
  }
  else if (action === GAME_BACK_ACTIONS.CANCEL_MAPPING) cancelControllerMapping();
  else if (action === GAME_BACK_ACTIONS.CLOSE_BUILD_SHEET) {
    touchBuildSheetSocketId = null;
    hudWrites.property("build:hidden", ui.buildChoices, "hidden", true);
    if (compactBuildPanelMedia.matches) setBuildPanelExpanded(false);
  } else if (action === GAME_BACK_ACTIONS.CLOSE_SETTINGS) closeSettingsPanel();
  else if (action === GAME_BACK_ACTIONS.CLOSE_HOW) closeHowPanel();
  else if (action === GAME_BACK_ACTIONS.PAUSE) togglePause(true);
  else requestQuitGame();
  return true;
}

function returnToMenu() {
  if (pendingTerminalTransition) {
    announce("Finish the pending reward save before returning to the oath hall.");
    return false;
  }
  disposeCoopPreview();
  show(ui.leaveCoopButton, false);
  if (document.pointerLockElement === canvas) document.exitPointerLock?.();
  enemyRenderer?.dispose(); enemyRenderer = null;
  battlefield = null; currentRoster = null;
  paused = false;
  closeSettingsPanel();
  show(ui.coopPanel, false);
  ui.coopButton.setAttribute("aria-expanded", "false");
  closeOathHall();
  closeHubService();
  closeQuitPrompt();
  show(ui.pauseOverlay, false);
  show(ui.resultOverlay, false);
  setPhase(GAME_PHASES.MENU);
  readSavedState();
  return true;
}

function togglePause(force) {
  if (coopPreview?.connected) {
    announce("Online rooms cannot be paused");
    return;
  }
  if (phase === GAME_PHASES.MENU || phase === GAME_PHASES.BOON_CHOICE || phase === GAME_PHASES.RUN_FAILED || phase === GAME_PHASES.NIGHT_COMPLETE || phase === GAME_PHASES.CAMPAIGN_COMPLETE) return;
  const next = typeof force === "boolean" ? force : !paused;
  if (next === paused) return;
  paused = next;
  if (paused) {
    closeHubService();
    resumePhase = phase;
    show(ui.pauseOverlay, true);
    audio.setPaused(true);
    persistRun();
    if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    if (controllerPresent) queueMicrotask(() => ui.resumeButton.focus());
  } else {
    closeSettingsPanel();
    show(ui.pauseOverlay, false);
    audio.setPaused(false);
    phase = resumePhase || phase;
  }
}

function pauseForLifecycle(reason) {
  if (!coopPreview?.connected) {
    togglePause(true);
    return;
  }
  paused = true;
  audio.setPaused(true);
  if (coopPreview.role === 'host') lifecycleCoopPauseToken = coopAuthorityPauseScopes.pause(coopPreview, reason);
  else coopPreview.authorityPaused = true;
  announce(coopPreview.role === 'host' ? 'Shared authority paused while the host is away' : 'Co-op presentation paused in the background');
}

function resumeFromLifecycle() {
  retryPendingPersistence();
  if (!coopPreview || coopPreview.closed) return;
  paused = false;
  audio.setPaused(false);
  if (coopPreview.role === 'host') {
    coopAuthorityPauseScopes.release(coopPreview, lifecycleCoopPauseToken);
    lifecycleCoopPauseToken = null;
  }
  else {
    coopPreview.authorityPaused = false;
    coopPreview.requestResume();
  }
}

const reportNumber = (value, places = 3) => Number((Number(value) || 0).toFixed(places));

function playtestRuntimeCacheKey() {
  return import.meta.url.match(/\/src\.([^/]+)\/game\.js(?:[?#]|$)/u)?.[1] ?? "source";
}

function capturePlaytestContext() {
  const position = {
    x: reportNumber(player.position.x),
    y: reportNumber(player.position.y),
    z: reportNumber(player.position.z),
  };
  const walkableSurface = sampleWalkableGround(
    BRIARHOLD_FIRST_PERSON_MAP,
    player.position.x,
    player.position.z,
    {currentY: player.position.y, maxStepHeight: Infinity, maxDropHeight: Infinity},
  );
  const coopDiagnostics = coopPreview?.diagnostics?.() ?? null;
  return {
    build: {version: BRIARHOLD_VERSION, cacheKey: playtestRuntimeCacheKey()},
    game: {
      phase,
      paused,
      night: run?.night ?? null,
      wave: run ? getCampaignWave(run.night, Math.min(2, run.wave)).waveNumber : null,
      inputSource: currentInputSource,
      map: BRIARHOLD_FIRST_PERSON_MAP.id,
    },
    player: {
      position,
      facing: {
        yaw: reportNumber(player.facing.yaw),
        pitch: reportNumber(player.facing.pitch),
      },
      grounded: Boolean(player.grounded),
    },
    location: {
      walkableSurface: walkableSurface ? {
        surfaceId: walkableSurface.surfaceId,
        y: reportNumber(walkableSurface.y),
        distance: reportNumber(walkableSurface.distance),
      } : null,
      nearbyCollisions: nearestCollisionVolumes(BRIARHOLD_FIRST_PERSON_MAP, position),
      nearbyNpcs: nearestHubPoints(BRIARHOLD_FIRST_PERSON_MAP, position),
    },
    presentation: {
      viewport: {width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio},
      render: {width: engine.getRenderWidth(), height: engine.getRenderHeight()},
      graphicsQuality,
      enemyPresentation: {...enemyPresentationResolution},
      enemyRenderer: {
        mode: enemyRenderer?.mode ?? enemyRenderer?.diagnostics?.mode ?? null,
        animated3dBodies: enemyRenderer?.diagnostics?.animated3dBodies ?? 0,
        spriteBodies: enemyRenderer?.diagnostics?.spriteBodies ?? enemyRenderer?.diagnostics?.activeSprites ?? 0,
      },
      npcModels: (hubNpcPresentation?.diagnostics ?? []).map((npc) => ({
        npcId: npc.npcId,
        active: npc.active,
        animation: npc.animation,
        animationPlaying: npc.animationPlaying,
        rotationY: reportNumber(npc.rotationY),
      })),
    },
    controller: {
      mappingKey: controllerReportMappingKey(cachedControllerMapping),
      interactButtons: [...(cachedControllerMapping?.buttons?.interact ?? [])],
      interactLabel: controllerActionLabel(cachedControllerMapping, "interact"),
      lastAction: lastControllerAction,
    },
    combat: {
      outerGateBreached: Boolean(battlefield?.outerGateBreached?.[WEST]),
      recent: recentCombatAttribution(
        combatAttribution,
        battlefield?.elapsed ?? 0,
      ),
    },
    network: coopDiagnostics ? {
      mode: "co-op",
      role: coopDiagnostics.role,
      connected: coopDiagnostics.connected,
      compatibilityVerified: coopDiagnostics.compatibilityVerified,
      authorityTick: coopDiagnostics.authorityTick,
      controlState: coopDiagnostics.controlState,
      realtimeState: coopDiagnostics.realtimeState,
      relayConfigured: coopDiagnostics.relayConfigured,
      drops: {...coopDiagnostics.drops},
    } : null,
  };
}

function canOpenPlaytestReporter() {
  if (phase === GAME_PHASES.MENU) {
    announce("Start or continue a run before capturing an issue");
    return false;
  }
  return true;
}

function suspendForPlaytestReport() {
  keys.clear();
  resetTouchInput();
  mouseFire = false; mouseAim = false;
  fallbackLookPointer = null;
  fallbackLookLast = null;
  mouseHoverFallback = false;
  if (document.pointerLockElement === canvas) document.exitPointerLock?.();
  interactPressed = false; pausePressed = false; weaponPressed = null; meleePressed = false;
  if (coopPreview?.connected) {
    coopIssueCaptureOpen = true;
    return () => {
      coopIssueCaptureOpen = false;
      keys.clear();
      resetTouchInput(); mouseFire = false; mouseAim = false;
      reportControllerReleaseGate = true;
      canvas.focus();
    };
  }
  const wasPaused = paused;
  const pauseWasVisible = !ui.pauseOverlay.hidden;
  if (!wasPaused) togglePause(true);
  show(ui.pauseOverlay, false);
  return () => {
    keys.clear();
    resetTouchInput(); mouseFire = false; mouseAim = false;
    interactPressed = false; pausePressed = false; weaponPressed = null; meleePressed = false;
    reportControllerReleaseGate = true;
    if (wasPaused) {
      show(ui.pauseOverlay, pauseWasVisible);
      if (pauseWasVisible) queueMicrotask(() => ui.resumeButton.focus());
    } else {
      togglePause(false);
      canvas.focus();
    }
  };
}

function keyboardInput() {
  const x = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  const y = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
  return {
    x,
    y,
    sprint: keys.has("ShiftLeft") || keys.has("ShiftRight"),
    jump: keys.has("Space"),
    slide: keys.has("KeyC") || keys.has("ControlLeft") || keys.has("ControlRight"),
  };
}

function gamepadInput(dt) {
  const pad = selectConnectedGamepad(navigator.getGamepads?.(), activeGamepadIndex);
  if (!pad) {
    if (controllerMappingSession) cancelControllerMapping("Controller disconnected · mapping cancelled");
    activeGamepadIndex = null;
    previousGamepadButtons = {interact: false, pause: false};
    latestGamepadInput = null;
    lastControllerAction = null;
    setControllerPresence(false);
    return null;
  }
  activeGamepadIndex = pad.index;
  setControllerPresence(true);
  if (controllerMappingSession) {
    if (pad.index !== controllerMappingPadIndex) {
      cancelControllerMapping("Mapped controller changed · mapping cancelled");
      return null;
    }
    updateControllerMappingSession(controllerMappingSession, pad, dt);
    if (controllerMappingSession.cancelRequested) {
      cancelControllerMapping("Controller mapping cancelled");
      latestGamepadInput = null;
      previousGamepadButtons = {};
      return null;
    }
    updateControllerMappingOverlay();
    if (controllerMappingSession.phase === "complete") finishControllerMapping(controllerMappingSession.profile);
    latestGamepadInput = null;
    previousGamepadButtons = {};
    return null;
  }
  if (controllerMappingReleaseGate || (reportControllerReleaseGate && !playtestReporter?.isOpen && !coopIssueCaptureOpen)) {
    const anyPressed = Array.from(pad.buttons || []).some((button) => button?.pressed || Number(button?.value) >= .5)
      || Array.from(pad.axes || []).some((axis) => Math.abs(Number(axis) || 0) > 0.2);
    if (anyPressed) {
      latestGamepadInput = null;
      return null;
    }
    controllerMappingReleaseGate = false;
    reportControllerReleaseGate = false;
  }
  const key = controllerMappingKey(pad);
  if (cachedControllerMappingKey !== key) {
    cachedControllerMappingKey = key;
    cachedControllerMapping = controllerMappingForPad(controllerMappings, pad) ?? builtInControllerMapping(pad);
    lastControllerAction = null;
    if (currentInputSource === INPUT_SOURCES.GAMEPAD) setInputSource(INPUT_SOURCES.GAMEPAD);
  }
  const reading = readGamepadInput(pad, previousGamepadButtons, dt, gamepadCalibration, cachedControllerMapping);
  previousGamepadButtons = reading.buttons;
  latestGamepadInput = reading.input;
  if (reading.input?.interact) lastControllerAction = "interact";
  if (!reading.active) return null;
  setInputSource(INPUT_SOURCES.GAMEPAD);
  return reading.input;
}

function consumeInputFrame(dt) {
  const gamepad = gamepadInput(dt);
  const keyboard = keyboardInput();
  const resolvedSource = resolveFrameInputSource(currentInputSource, {
    gamepadActive: Boolean(gamepad),
    keyboard,
  });
  if (resolvedSource !== currentInputSource) setInputSource(resolvedSource);
  let move = touch.move;
  let sprint = touch.sprint;
  let jump = touchJumpPressed;
  let slide = touchSlidePressed;
  let melee = meleePressed;
  const aimRequested = Boolean(gamepad?.aim || mouseAim || touchAim || keys.has("KeyQ"));
  const progressionEffects = calculateProgressionEffects(profile);
  adsActive = phase === GAME_PHASES.COMBAT
    && profile.unlocks.includes("warden-focus")
    && progressionEffects.warden.ads === true
    && aimRequested;
  if (currentInputSource === INPUT_SOURCES.MOUSE) {
    move = {x: keyboard.x, y: keyboard.y};
    sprint = keyboard.sprint;
    jump = keyboard.jump;
    slide = keyboard.slide;
  }
  let selectedWeapon = gamepad?.selectedWeapon ?? weaponPressed;
  if (gamepad) {
    move = gamepad.move;
    sprint = gamepad.sprint;
    jump = gamepad.jump;
    slide = gamepad.slide;
    melee ||= gamepad.melee;
    addLookInput(gamepad.look.yaw, gamepad.look.pitch);
    const choosingDefence = phase === GAME_PHASES.DAYTIME && Boolean(nearestBuildSocket());
    if (!choosingDefence && selectedWeapon === null && (gamepad.weaponPrevious || gamepad.weaponNext)) {
      const availableWeapons = currentRunLoadout().weapons;
      const current = Math.max(0, availableWeapons.indexOf(weapon.selected));
      const next = (current + (gamepad.weaponNext ? 1 : -1) + availableWeapons.length) % availableWeapons.length;
      selectedWeapon = WEAPON_IDS.indexOf(availableWeapons[next]);
    }
  }
  const adsLookMultiplier = adsActive && progressionEffects.warden.look === "slower" ? 0.72 : 1;
  const frame = createInputFrame({
    move,
    look: {yaw: lookYaw * adsLookMultiplier, pitch: lookPitch * adsLookMultiplier},
    fire: gamepad?.fire || mouseFire || touchFire,
    aim: aimRequested,
    selectedWeapon,
    interact: gamepad?.interact || interactPressed,
    sprint,
    jump,
    slide,
    melee,
    pause: gamepad?.pause || pausePressed,
    source: gamepad ? INPUT_SOURCES.GAMEPAD : currentInputSource,
  });
  lookYaw = 0; lookPitch = 0; interactPressed = false; pausePressed = false; weaponPressed = null; meleePressed = false;
  touchJumpPressed = false; touchSlidePressed = false;
  if (playtestReporter?.isOpen || coopIssueCaptureOpen) return createInputFrame({source: frame.source});
  return frame;
}

function controllerElementIsAvailable(element) {
  if (!element || element.hidden || element.disabled || element.closest("[hidden]")) return false;
  const style = element.ownerDocument?.defaultView?.getComputedStyle?.(element);
  if (style?.display === "none" || style?.visibility === "hidden") return false;
  return typeof element.getClientRects !== "function" || element.getClientRects().length > 0;
}

function controllerOverlayElements() {
  const scope = resolveControllerUiScope({
    dialogueOpen: narrativePresentation.isOpen,
    goalsOpen: goalsPresentation.isOpen,
    mappingOpen: Boolean(controllerMappingSession),
    quitOpen: !ui.quitConfirmOverlay.hidden || !ui.deleteSaveOverlay.hidden,
    oathHallOpen: !ui.oathHallPanel.hidden,
    serviceOpen: !ui.hubServicePanel.hidden,
    settingsOpen: !ui.settingsPanel.hidden,
    coopOpen: !ui.coopPanel.hidden,
    howOpen: !ui.howPanel.hidden,
    reportOpen: Boolean(playtestReporter?.isOpen),
    updateOpen: !ui.updateOverlay.hidden,
    paused,
    phase,
  });
  let elements = [];
  if (scope === CONTROLLER_UI_SCOPES.REPORT) elements = [ui.playtestReportNote, ui.playtestReportCategory, ui.playtestReportImpact, ui.playtestReportScreenshotConsent, ui.playtestReportDiagnosticsConsent, ui.playtestReportRetake, ui.playtestReportSave, ui.playtestReportCancel];
  else if (scope === CONTROLLER_UI_SCOPES.OATH_HALL) elements = [
    ...ui.oathHallTabs.querySelectorAll("[data-oath-tab]"),
    ...ui.oathHallSections.querySelectorAll("[data-weapon-tab], [data-oath-node], [data-oath-action]"),
    ui.oathHallClose,
  ];
  else if (scope === CONTROLLER_UI_SCOPES.UPDATE) elements = [ui.updateNow, ui.updateLater];
  else if (scope === CONTROLLER_UI_SCOPES.DIALOGUE) elements = [...ui.narrativeResponses, ui.narrativeContinue, ui.narrativeSkip];
  else if (scope === CONTROLLER_UI_SCOPES.GOALS) elements = [ui.goalsClose];
  else if (scope === CONTROLLER_UI_SCOPES.MAPPING) elements = [ui.controllerMappingCancel];
  else if (scope === CONTROLLER_UI_SCOPES.QUIT) elements = ui.deleteSaveOverlay.hidden
    ? [ui.quitCancel, ui.quitConfirm]
    : [ui.deleteSaveCancel, ui.deleteSaveConfirm];
  else if (scope === CONTROLLER_UI_SCOPES.SERVICE) elements = [...ui.hubServiceActions, ui.hubServiceClose];
  else if (scope === CONTROLLER_UI_SCOPES.PAUSE) {
    elements = [ui.resumeButton, ui.pauseSettingsButton, ui.quitButton];
  } else if (scope === CONTROLLER_UI_SCOPES.SETTINGS) {
    elements = [
      ui.volume, ui.lookSensitivity, ui.invertVerticalLook,
      ui.aimAssist, ui.graphicsQuality, ui.frameRateLimit, ui.reducedMotion, ui.autoMelee, ui.autoFire,
      ui.controllerMappingStart, ui.controllerMappingReset, ui.deleteSave, ui.settingsClose,
    ];
  } else if (scope === CONTROLLER_UI_SCOPES.COOP) {
    elements = [
      ui.coopRoomCode, ui.coopHost, ui.coopJoin, ui.coopRoomCopy, ui.coopManualToggle,
      ui.coopManualHost, ui.coopManualJoin, ui.coopSignalText, ui.coopSignal, ui.coopCopy, ui.coopClose,
    ];
  } else if (scope === CONTROLLER_UI_SCOPES.HOW) elements = [ui.howClose];
  else if (scope === CONTROLLER_UI_SCOPES.MENU) {
    elements = [ui.continueButton, ui.newRunButton, ui.oathHallButton, ui.coopButton, ui.howButton, ui.settingsButton];
  } else if (scope === CONTROLLER_UI_SCOPES.BUILD) {
    elements = [ui.goalsOpen, ui.buildPanelToggle, ...enabledBuildChoices()];
  } else if (scope === CONTROLLER_UI_SCOPES.BOON) {
    elements = [...ui.boonChoices.querySelectorAll("button")];
  } else if (scope === CONTROLLER_UI_SCOPES.RESULT) elements = [ui.resultContinue];
  return elements.filter(controllerElementIsAvailable);
}

function focusControllerChoice(elements, direction = 0, axis = "vertical") {
  if (!elements.length) return null;
  const current = elements.indexOf(document.activeElement);
  const index = spatialControllerIndex(elements, current, direction, axis);
  elements[index].focus();
  return elements[index];
}

function adjustControllerChoice(element, direction) {
  if (!element || !direction) return false;
  if (element instanceof HTMLSelectElement) {
    const next = (element.selectedIndex + direction + element.options.length) % element.options.length;
    element.selectedIndex = next;
    element.dispatchEvent(new Event("change", {bubbles: true}));
    return true;
  }
  if (element instanceof HTMLInputElement && element.type === "range") {
    const minimum = Number(element.min);
    const maximum = Number(element.max);
    const increment = Number(element.step) || 1;
    element.value = String(clamp(Number(element.value) + direction * increment, minimum, maximum));
    element.dispatchEvent(new Event("input", {bubbles: true}));
    return true;
  }
  return false;
}

function activateControllerChoice(element) {
  if (!element) return false;
  // Browsers do not treat a polled Gamepad button as a trusted activation, so
  // synthetic clicks cannot reliably open a native select popup. Advancing the
  // selected option keeps every setting operable with the controller alone.
  if (element instanceof HTMLSelectElement) return adjustControllerChoice(element, 1);
  if (element instanceof HTMLInputElement && element.type === "range") {
    announce("Use left or right to adjust this setting");
    return true;
  }
  element.click();
  return true;
}

function handleControllerUi(input) {
  if (!input) return false;
  if ((playtestReporter?.isOpen || !ui.updateOverlay.hidden) && input.back) {
    return handleBackAction();
  }
  if (controllerBackNavigates(input, {phase, paused})) return handleBackAction();

  const overlayElements = controllerOverlayElements();
  if (overlayElements.length) {
    if (input.adjustPrevious || input.adjustNext) {
      const target = overlayElements.includes(document.activeElement)
        ? document.activeElement
        : focusControllerChoice(overlayElements);
      if (adjustControllerChoice(target, input.adjustNext ? 1 : -1)) return true;
      focusControllerChoice(overlayElements, input.adjustNext ? 1 : -1, "horizontal");
      return true;
    }
    if (input.navigatePrevious || input.navigateNext) {
      focusControllerChoice(overlayElements, input.navigateNext ? 1 : -1);
      return true;
    }
    if (input.confirm) {
      const target = overlayElements.includes(document.activeElement)
        ? document.activeElement
        : focusControllerChoice(overlayElements);
      return activateControllerChoice(target);
    }
    return false;
  }

  if (phase === GAME_PHASES.DAYTIME) {
    const near = nearestBuildSocket();
    if (near) {
      selectedSocket = near.socket;
      refreshBuildChoices();
      const choices = enabledBuildChoices();
      if (choices.length && (input.navigatePrevious || input.navigateNext)) {
        focusControllerChoice(choices, input.navigateNext ? 1 : -1);
        const focused = document.activeElement;
        if (focused?.dataset?.fortification) {
          const definition = FORTIFICATION_DEFINITIONS[focused.dataset.fortification];
          announce(`${definition?.name || "Defence"} selected · press A or X to build`);
        }
        return true;
      }
    }
  }
  return false;
}

function updateHudDiagnostics(now) {
  if (!hudDiagnosticsGate.shouldRun(now)) return false;
  const values = {
    playerX: player.position.x.toFixed(2),
    playerY: player.position.y.toFixed(2),
    playerZ: player.position.z.toFixed(2),
    playerYaw: player.facing.yaw.toFixed(3),
    playerPitch: player.facing.pitch.toFixed(3),
    mapSpawnZ: String(BRIARHOLD_FIRST_PERSON_MAP.playerSpawn.z),
    runSpawnZ: String(run?.player?.position?.z ?? "unset"),
    medianFps: frameMonitor.medianFps.toFixed(1),
    onePercentLowFps: frameMonitor.onePercentLowFps.toFixed(1),
    activeBodies: String(battlefield?.activeCount || 0),
    visibleSprites: String(enemyRenderer?.diagnostics?.activeSprites || 0),
    enemyRenderer: String(enemyRenderer?.mode || "none"),
    rendererUpdateMs: Number(enemyRenderer?.diagnostics?.lastUpdateMs || 0).toFixed(2),
    simulationMs: frameMonitor.simulationMs.toFixed(2),
    sceneRenderMs: frameMonitor.sceneRenderMs.toFixed(2),
    hardwareScale: renderGovernor.scale.toFixed(1),
    graphicsRenderer: graphicsInfo.renderer,
    adaptiveAdjustments: String(renderGovernor.adjustments),
    meshyForest: world.assetState?.meshyForest?.status || "unknown",
    meshyBattlefieldVerge: world.assetState?.meshyBattlefieldVerge?.status || "unknown",
    meshyBraziers: world.assetState?.meshyBraziers?.status || "unknown",
  };
  for (const [key, value] of Object.entries(values)) {
    hudWrites.dataset(`diagnostic:${key}`, document.body, key, value);
  }
  return true;
}

function updateHud(now = performance.now() / 1000) {
  updateHudDiagnostics(now);
  const playerRatio = ratio(player.hp, player.maxHp);
  writeHudText("player:health", ui.playerHealthText, `${Math.ceil(player.hp)} / ${player.maxHp}`);
  setMeter(ui.playerHealthBar, player.hp, player.maxHp);
  const heart = battlefield ? battlefield.heartGateHp : run?.gates?.heart?.integrity || 0;
  const heartMax = battlefield ? battlefield.heartGateMaxHp : run?.gates?.heart?.maxIntegrity || 1;
  const outer = battlefield ? battlefield.outerGateHp[WEST] : run?.gates?.outer?.integrity || 0;
  const outerMax = battlefield ? battlefield.outerGateMaxHp : run?.gates?.outer?.maxIntegrity || 1;
  const eastOuter = battlefield ? battlefield.outerGateHp[EAST] : run?.gates?.east?.integrity ?? run?.gates?.outer?.integrity ?? 0;
  const eastOuterMax = battlefield ? battlefield.outerGateMaxHp : run?.gates?.east?.maxIntegrity ?? run?.gates?.outer?.maxIntegrity ?? 1;
  writeHudText("gate:heart", ui.heartHealthText, `${Math.round(ratio(heart, heartMax) * 100)}%`);
  writeHudText("gate:outer", ui.outerHealthText, battlefield?.outerGateBreached[WEST] ? "Breached" : `${Math.round(ratio(outer, outerMax) * 100)}%`);
  writeHudText("gate:east", ui.eastOuterHealthText, battlefield?.outerGateBreached[EAST] ? "Breached" : `${Math.round(ratio(eastOuter, eastOuterMax) * 100)}%`);
  setMeter(ui.heartHealthBar, heart, heartMax);
  setMeter(ui.outerHealthBar, outer, outerMax);
  setMeter(ui.eastOuterHealthBar, eastOuter, eastOuterMax);
  writeHudText(
    "night",
    ui.nightText,
    phase === GAME_PHASES.COMBAT
      ? `Night ${run?.night ?? 1}/7 · Wave ${Math.min(3, (run?.wave ?? 0) + 1)}/3`
      : `Night ${run?.night ?? 1} of 7`,
  );
  writeHudText("enemy-count", ui.enemyCountText, battlefield?.activeCount?.toLocaleString() || "0");
  writeHudText("supplies", ui.supplies, run?.supplies ?? 0);
  const definition = WEAPON_DEFINITIONS[weapon.selected];
  writeHudText("weapon:cue", ui.weaponCue, definition.cue);
  writeHudText("weapon:name", ui.weaponName, {
    arbalest: "Arbalest",
    sunfire: "Sunfire",
    runebolt: "Runebolt",
  }[definition.id]);
  writeHudText("weapon:heat-label", ui.heatText, weapon.overheated ? "Overheated" : weapon.heat > .7 ? "Hot" : weapon.heat > .3 ? "Warm" : "Cool");
  setMeter(ui.heatBar, weapon.heat, 1);
  const focusUnlocked = profile.unlocks.includes("warden-focus");
  hudWrites.dataset("ads:unlocked", document.body, "adsUnlocked", focusUnlocked ? "true" : "false");
  hudWrites.dataset("ads:active", document.body, "ads", adsActive ? "true" : "false");
  hudWrites.dataset("weapon:overheated", document.body, "overheated", weapon.overheated ? "true" : "false");
  hudWrites.classToggle("viewmodel:aiming", ui.viewmodel, "is-aiming", adsActive);
  hudWrites.classToggle("viewmodel:overheated", ui.viewmodel, "is-overheated", weapon.overheated);
  hudWrites.classToggle("viewmodel:venting", ui.viewmodel, "is-venting", weapon.overheated || weapon.heat > .72);
  hudWrites.classToggle("touch:aiming", ui.aimButton, "is-active", adsActive);
  hudWrites.attribute("touch:aim-pressed", ui.aimButton, "aria-pressed", adsActive);
  hudWrites.property("touch:aim-disabled", ui.aimButton, "disabled", !focusUnlocked);
  hudWrites.style("viewmodel:heat", ui.viewmodel, "--weapon-heat", weapon.heat.toFixed(3));
  const loadout = currentRunLoadout();
  for (const button of ui.weaponButtons) {
    const buttonWeapon = button.dataset.weapon;
    const unlocked = loadout.weapons.includes(buttonWeapon);
    const selected = button.dataset.weapon === weapon.selected;
    const buttonKey = `weapon:${buttonWeapon}`;
    hudWrites.classToggle(`${buttonKey}:selected`, button, "is-selected", selected);
    hudWrites.attribute(`${buttonKey}:aria`, button, "aria-pressed", selected);
    hudWrites.property(`${buttonKey}:disabled`, button, "disabled", !unlocked);
    hudWrites.dataset(`${buttonKey}:locked`, button, "locked", !unlocked);
    hudWrites.property(`${buttonKey}:title`, button, "title", unlocked ? "" : "Commission permanently from the Quartermaster with banked Oathmarks");
  }
  hudWrites.dataset("viewmodel:weapon", ui.viewmodel, "weapon", weapon.selected);
  const context = run ? contextDescription() : null;
  hudWrites.property("context:hidden", ui.contextPrompt, "hidden", !context);
  if (context) writeHudText("context:text", ui.contextPromptText, context);
  if (phase === GAME_PHASES.DAYTIME) refreshBuildChoices();
  hudWrites.style("player:danger", document.body, "--player-danger", 1 - playerRatio);
}

function updateCombat(frame, dt, now, {coopAuthority = false} = {}) {
  const authorityPlayers = coopAuthority ? [...coopPreview.authority.players.values()] : null;
  const wardenTargets = authorityPlayers
    ? authorityPlayers.map(item => ({
      playerId: item.playerId,
      x: item.position.x, y: item.position.y, z: item.position.z,
      radius: PLAYER_DEFAULTS.capsuleRadius,
      exposed: item.hp > 0 && isPlayerExposedToApproachHorde(item.position, battlefield.world),
      enabled: item.hp > 0,
    }))
    : [{
      playerId: "player-0",
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      radius: PLAYER_DEFAULTS.capsuleRadius,
      exposed: isPlayerExposedToApproachHorde(player.position, battlefield.world),
      enabled: player.hp > 0,
    }];
  const defenderTargets = hubDefenderAggroTargets(hubCombatState, {
    breached: Boolean(battlefield.outerGateBreached[WEST] || battlefield.outerGateBreached[EAST]),
  });
  battlefield.setPlayerTargets([...wardenTargets, ...defenderTargets]);
  const outerGateBefore = [...battlefield.outerGateHp];
  const heartGateBefore = battlefield.heartGateHp;
  battlefield.update(dt);
  if (authoredBossNeedsPresentationStep()) {
    const bossElapsed = dt * 1000 + bossFrameRemainderMs;
    const wholeBossMs = Math.floor(bossElapsed);
    bossFrameRemainderMs = bossElapsed - wholeBossMs;
    if (wholeBossMs > 0) applyBossDirectorUpdate({elapsedMs: wholeBossMs});
    if (authoredBossActive()) updateBossDamageVolumes(now, {coopAuthority});
  }
  resolvePendingMasteryImpacts();
  if (coopAuthority) syncCoopMovementGateState();
  run = advanceNightRuntimeTimers({...run, player: serializePlayer()}, dt);
  const sharedPlayerHp = coopAuthority
    ? Math.min(...authorityPlayers.map(state => state.hp))
    : player.hp;
  const triggered = activateNightCombatTriggers(profile, run, {
    outerBreached: Boolean(battlefield.outerGateBreached[WEST] || battlefield.outerGateBreached[EAST]),
    playerHp: sharedPlayerHp,
  });
  run = triggered.run;
  if (triggered.activated.includes("bellkeeperRally")) announce("Bellkeeper rally · holdfolk resist stagger for 12 seconds");
  if (triggered.activated.includes("courtyardRally")) announce("Courtyard Rally · holdfolk brace the breach");
  if (triggered.activated.includes("lastOath")) announce("Last Oath · handling surges for 4 seconds");
  if (triggered.activated.length) persistRun();
  currentCombatTuning = runtimeProgressionTuning(profile, run, weapon.selected, {ads: adsActive});
  updateHubDefence(dt);
  if (!run || phase !== GAME_PHASES.COMBAT) return;
  for (const telegraph of releaseTelegraphs) {
    if (telegraph.announced || battlefield.elapsed + 1e-6 < telegraph.cueAt) continue;
    telegraph.announced = true;
    announce(telegraph.kind === "fixed-director"
      ? `Advance warning · ${telegraph.label} follows this assault`
      : `${telegraph.label} arrive in ${telegraph.warningSeconds} seconds`);
  }
  if (!firstHunterAnnounced) {
    for (let id = 0; id < battlefield.slotCount; id++) {
      if (battlefield.status[id] !== ACTIVE || battlefield.type[id] !== SPOREWING
        || battlefield.elapsed + 1e-6 < battlefield.companyReleaseAt[id]
        || battlefield.z[id] > HOST_EMERGENCE_PROFILE.treeLineZ) continue;
      firstHunterAnnounced = true;
      announce("Sporewings break the treeline—watch the sky");
      break;
    }
  }
  if (wickerBossId >= 0) {
    const status = battlefield.status[wickerBossId];
    const alive = status === ACTIVE;
    const dying = status === DYING;
    const dead = status === DEAD;
    const released = battlefield.elapsed + 1e-6 >= battlefield.companyReleaseAt[wickerBossId];
    const emerged = battlefield.z[wickerBossId] <= HOST_EMERGENCE_PROFILE.treeLineZ;
    const present = released && emerged && (alive || dying);
    if (present && !wickerBossAnnounced) {
      wickerBossAnnounced = true;
      ui.bossName.textContent = "Wicker Colossus";
      setBossMeterLabel("Wicker Colossus");
      publishAuthoritativeMusicCue("boss_intro", "wicker-colossus", {encounterId: "wicker-colossus"});
      announce("The Wicker Colossus enters the road");
    }
    show(ui.bossStatus, present);
    if (present) {
      const hp = Math.max(0, battlefield.hp[wickerBossId]);
      const maxHp = Math.max(1, battlefield.maxHp[wickerBossId]);
      writeHudText("boss:hp", ui.bossHealthText, Math.ceil(hp).toLocaleString());
      setMeter(ui.bossHealthBar, hp, maxHp);
    } else if (wickerBossAnnounced && dead && !wickerBossDefeated) {
      wickerBossDefeated = true;
      publishAuthoritativeMusicCue("boss_defeat", "wicker-colossus", {encounterId: "wicker-colossus"});
    }
  }
  audio.enemyAttackTelemetry(battlefield.consumeAttackTelemetry());
  resolvePlayerCrowdContact(
    player,
    battlefield,
    dt,
    playerGateCollisionOptions(battlefield),
  );
  world.setFirstPersonPose(player, dt, {aiming: adsActive});
  updateFortifications(now);
  const knifeActionActive = coopAuthority ? false : updateKnifeMelee(frame);
  if (knifeActionActive) adsActive = false;
  const wasOverheated = weapon.overheated;
  const automaticTouchAvailable = touchAutomaticFireAvailable(frame, {coarse: coarsePointer});
  const automaticTouchFrame = automaticTouchAvailable && frame.source !== INPUT_SOURCES.TOUCH
    ? createInputFrame({...frame, source: INPUT_SOURCES.TOUCH})
    : frame;
  const automaticFireEligible = !knifeActionActive
    && ui.autoFire.checked
    && automaticTouchAvailable
    && !frame.fire
    && !weapon.overheated;
  let automaticFireRay = null;
  if (!automaticFireEligible) {
    cachedTouchAutoFireTarget = null;
    nextTouchAutoFireScanAt = now;
  } else if (now + 1e-9 >= nextTouchAutoFireScanAt) {
    automaticFireRay = world.firstPersonRay(160);
    cachedTouchAutoFireTarget = touchAimAssistTarget(automaticTouchFrame, automaticFireRay, {
      coneDegrees: TOUCH_AUTO_FIRE_CONE_DEGREES,
      requireAimAssist: false,
    });
    nextTouchAutoFireScanAt = now + TOUCH_AUTO_FIRE_SCAN_INTERVAL;
  }
  if (cachedTouchAutoFireTarget) {
    const targetId = cachedTouchAutoFireTarget.id;
    if (typeof targetId === "string") {
      const actor = run?.bossEncounter?.actors.find(item => item.id === targetId && !item.defeated);
      if (!authoredBossActive() || !actor) cachedTouchAutoFireTarget = null;
      else {
        cachedTouchAutoFireTarget.aimPoint.x = actor.position.x;
        cachedTouchAutoFireTarget.aimPoint.y = actor.position.y + actor.radius * 0.45;
        cachedTouchAutoFireTarget.aimPoint.z = actor.position.z;
      }
    } else if (!Number.isInteger(targetId) || battlefield.status[targetId] !== ACTIVE) {
      cachedTouchAutoFireTarget = null;
    } else {
      cachedTouchAutoFireTarget.aimPoint.x = battlefield.x[targetId];
      cachedTouchAutoFireTarget.aimPoint.z = battlefield.z[targetId];
    }
  }
  const firing = resolveTouchAutomaticFire({
    inputFrame: automaticTouchFrame,
    enabled: ui.autoFire.checked,
    target: cachedTouchAutoFireTarget,
    overheated: weapon.overheated,
  });
  const firingFrame = knifeActionActive
    ? createInputFrame({...frame, fire: false})
    : firing === frame.fire
      ? frame
      : createInputFrame({...automaticTouchFrame, fire: firing});
  ui.fireButton.classList.toggle("is-auto-locked", automaticFireEligible && Boolean(cachedTouchAutoFireTarget));
  if (!coopAuthority) {
    if (automaticFireEligible) {
      fireWeapon(firingFrame, now, {
        ray: automaticFireRay,
        touchTarget: cachedTouchAutoFireTarget,
        automaticTouchAim: true,
      });
    } else fireWeapon(firingFrame, now);
  }
  // Cooling follows trigger intent rather than the render frame that happened
  // to contain a shot, so cadence and heat remain stable across frame rates.
  if (!coopAuthority) updateWeaponHeat(weapon, dt, firingFrame.fire, currentCombatTuning ?? {});
  if (!wasOverheated && weapon.overheated) {
    audio.overheat();
    if (!coopAuthority && weapon.selected === "sunfire") applyGoalFact({
      type: "weapon-overheat",
      eventId: goalEventId("overheat", `warden-local-sunfire-shot-${weapon.shots}`),
      actorId: "warden-local",
      weaponId: "sunfire",
    });
  }
  else if (wasOverheated && !weapon.overheated) audio.cool();
  if (!coopAuthority && (!firingFrame.fire || weapon.selected !== "sunfire" || weapon.overheated)) audio.stopSunfire();
  const incoming = battlefield.consumePlayerDamage();
  const wardenIncoming = Object.fromEntries(
    Object.entries(incoming.byPlayer).filter(([targetId]) => !targetId.startsWith("npc:")),
  );
  const wardenIncomingAmount = Object.values(wardenIncoming).reduce((total, amount) => total + amount, 0);
  if (wardenIncomingAmount > 0) {
    let applied = 0;
    let localEvents = incoming.events.filter(event => !String(event.targetPlayerId).startsWith("npc:"));
    if (coopAuthority) {
      for (const [playerId, amount] of Object.entries(wardenIncoming)) {
        const resolved = coopPreview.applyPlayerDamage(playerId, amount);
        if (playerId === coopPreview.localId) applied += resolved;
        if (resolved > 0) applyGoalFact({
          type: "damage",
          eventId: goalEventId("damage", `${playerId}-tick-${coopPreview.authority.tick}`),
          actorId: playerId,
          amount: resolved,
        });
      }
      localEvents = incoming.events.filter(event => event.targetPlayerId === coopPreview.localId);
    } else applied = damagePlayer(player, wardenIncomingAmount);
    if (applied > 0) {
      if (!coopAuthority) applyGoalFact({
        type: "damage",
        eventId: goalEventId("damage", `warden-local-${localEvents.map(event => event.id).sort((a, b) => a - b).join("-")}-at-${Math.round(battlefield.elapsed * 1000)}`),
        actorId: "warden-local",
        amount: applied,
      });
      const hunter = localEvents.some(event => event.dedicatedHunter);
      const damagePresentation = playerDamagePresentation(localEvents.map(event => ({
        ...event,
        x: battlefield.x[event.id],
        z: battlefield.z[event.id],
      })), player);
      if (damagePresentation) {
        ui.damageFlash.style.setProperty("--damage-angle", `${damagePresentation.angleDegrees.toFixed(1)}deg`);
      }
      pulse(ui.damageFlash, "is-damaged");
      audio.playerHurt({hunter, pan: damagePresentation?.pan ?? 0});
      rumblePlayerDamage(hunter);
    }
  }
  if (!coopAuthority && player.hp <= 0) {
    const revival = consumeTwinThornsSoloRevive({...run, player: serializePlayer()});
    run = revival.run;
    if (revival.revived) {
      player.hp = run.player.hp;
      announce("Twin Thorns kindle · revived at 30 Health");
      persistRun();
    }
  }
  let coopDownState = null;
  if (coopAuthority) {
    coopDownState = resolveCoopWardenDownState({
      run,
      players: [...coopPreview.authority.players.values()],
    });
    run = coopDownState.run;
    for (const state of coopDownState.players) coopPreview.authority.players.set(state.playerId, state);
    if (coopDownState.revivedPlayerId) {
      coopPreview.applyFrame({authorityTick: coopPreview.authority.tick, players: coopDownState.players});
      appendCoopSemanticEvent('campaign', 'shared_revive', coopDownState.revivedPlayerId, {amount: 30});
      announce(`Twin Thorns kindle · ${coopDownState.revivedPlayerId === coopPreview.localId ? 'you revive' : 'the other Warden revives'} at 30 Health`);
      persistRun();
      coopPreview.sendCheckpoint('shared_revive');
    }
  }
  const stats = battlefield.stats();
  const weakestOuterGateIntegrity = Math.min(
    ratio(stats.outerGateHp[WEST], battlefield.outerGateMaxHp),
    ratio(stats.outerGateHp[EAST], battlefield.outerGateMaxHp),
  );
  const threat = clamp((stats.activeCount / Math.max(1, stats.slotCount)) * .72 + (1 - weakestOuterGateIntegrity) * .42);
  audio.setThreat(threat);
  if ((battlefield.outerGateHp[WEST] < outerGateBefore[WEST]
    || battlefield.outerGateHp[EAST] < outerGateBefore[EAST]
    || battlefield.heartGateHp < heartGateBefore)
    && (!battlefield.outerGateBreached[WEST] || !battlefield.outerGateBreached[EAST])
    && battlefield.heartGateHp > 0) audio.gatePressure();
  world.setThreat(threat);
  if (!lastOuterBreached && (stats.outerGateBreached[WEST] || stats.outerGateBreached[EAST])) {
    lastOuterBreached = true;
    audio.gate();
    announce("The outer gate is breached—fall back to the courtyard; the holdfolk join the defence");
    void ensureHubNpcPresentation();
    syncHubNpcPresentation();
  }
  world.updateGateVisual("west", ratio(stats.outerGateHp[WEST], battlefield.outerGateMaxHp), stats.outerGateBreached[WEST]);
  world.updateGateVisual("east", ratio(stats.outerGateHp[EAST], battlefield.outerGateMaxHp), stats.outerGateBreached[EAST]);
  world.updateGateVisual("heart", ratio(stats.heartGateHp, battlefield.heartGateMaxHp), stats.heartGateDestroyed);
  const allWardensDown = coopAuthority
    ? coopDownState?.failed === true
    : player.hp <= 0;
  if (allWardensDown) failCurrentRun(coopAuthority ? "Both Wardens fell" : "The Warden fell");
  else if (stats.heartGateDestroyed) failCurrentRun("The Heart Gate was destroyed");
  else if (stats.activeCount === 0) {
    if (run?.bossEncounter?.mode === "authored-director") {
      if (run.bossEncounter.status === "waiting") {
        applyBossDirectorUpdate({
          crowdCleared: true,
          commands: [{id: nextBossCommandId("release"), type: "encounter_release"}],
        });
        persistRun();
      } else if (run.bossEncounter.status === "defeated" && !authoredBossNeedsPresentationStep()) completeWave();
    } else completeWave();
  }
}

function updateRecovery(dt) {
  if (!canAdvanceCampaignRecoveryLocally({
    connected: coopPreview?.connected === true,
    role: coopPreview?.role ?? null,
  })) return;
  const coopAuthority = coopPreview?.role === "host" && coopPreview.connected;
  if (phase !== GAME_PHASES.INTERWAVE_RECOVERY || !run || (coopAuthority ? coopPreview.authorityPaused : paused) || wavePreparationPending) return;
  const waveOptions = {
      hpMultiplier: TEST_MODE ? testBossHpMultiplier : 1,
      occupiedSockets: world.sockets.map(socket => ({id: socket.id, x: socket.x, z: socket.z})),
      objectiveLanePosition: {x: -16, z: 20},
  };
  const transition = coopAuthority
    ? advanceCoopCampaignRecovery(run, dt * 1000, waveOptions)
    : advanceInterwaveRecovery(run, dt * 1000, {
      mode: "solo", paused, authoritativeHostTick: false, waveOptions,
    });
  run = transition.run;
  if (transition.type === "recovery") {
    recoveryPresentation.show({warning: "The next wave begins automatically", remainingMs: run.recovery.remainingMs});
    return;
  }
  recoveryPresentation.hide();
  persistRun();
  void startPreparedWaveAtCoopBoundary(run.wave, {reason: "wave_boundary"});
}

function tick(nowMs) {
  const now = nowMs / 1000;
  // Embedded browser panes do not always share normal tab visibility
  // semantics. Never suppress canvas presentation solely because the host
  // reports this document as hidden; native lifecycle handling still pauses
  // combat and audio when the app genuinely backgrounds.
  if (!shouldPresentFrame(framePacer, now)) {
    requestAnimationFrame(tick);
    return;
  }
  const rawDt = Math.max(0, now - lastFrameAt);
  const dt = clamp(rawDt, 0, .1);
  lastFrameAt = now;
  recordFrameTiming(rawDt);
  const simulationStartedAt = performance.now();
  const frame = consumeInputFrame(dt);
  const controllerUiHandled = handleControllerUi(latestGamepadInput);
  if (frame.pause && !controllerUiHandled) togglePause();
  updateRecovery(dt);
  if (!paused && coopPreview?.connected
    && shouldPublishCoopAuthorityPhase(phase)
    && phase !== GAME_PHASES.DAYTIME
    && phase !== GAME_PHASES.COMBAT) {
    coopPreview.update(dt, EMPTY_INPUT_FRAME);
  }
  if (!paused && [GAME_PHASES.DAYTIME, GAME_PHASES.INTERWAVE_RECOVERY, GAME_PHASES.COMBAT].includes(phase)) {
    const outerBreached = Boolean(
      run?.gates?.outer?.destroyed
      || run?.gates?.east?.destroyed
      || battlefield?.outerGateBreached?.[WEST]
      || battlefield?.outerGateBreached?.[EAST],
    );
    if (coopPreview?.connected) coopPreview.update(dt, coopIssueCaptureOpen ? {
      ...frame,
      move: {x: 0, y: 0},
      look: {yaw: 0, pitch: 0},
      fire: false,
      interact: false,
      sprint: false,
      jump: false,
      slide: false,
      selectedWeapon: null,
      aiming: false,
      manualVent: false,
    } : {...frame, aiming: adsActive, manualVent: false});
    else {
      const collisionOptions = outerBreached ? playerGateCollisionOptions(battlefield) : CLOSED_PLAYER_COLLISION_OPTIONS;
      const recovery = currentCombatTuning?.movementRecoveryMultiplier ?? 1;
      updatePlayerController(player, frame, dt, {
        ...collisionOptions,
        mantleDuration: PLAYER_DEFAULTS.mantleDuration * recovery,
        slideDuration: PLAYER_DEFAULTS.slideDuration * recovery,
      });
    }
    const horizontalSpeed = Math.hypot(player.velocity.x, player.velocity.z);
    if (player.grounded && !player.sliding && horizontalSpeed > 0.65) {
      if (now >= nextFootstepAt) {
        audio.footstep(player.position.y > 1.25 ? 'stone' : 'dirt', {sprint: frame.sprint});
        nextFootstepAt = now + (frame.sprint ? 0.31 : 0.44);
      }
    } else {
      nextFootstepAt = Math.min(nextFootstepAt, now + 0.08);
    }
    if (isPlayerBelowNavigationBounds(player, BRIARHOLD_FIRST_PERSON_MAP)) {
      failCurrentRun("The Warden fell beyond the hold");
    } else {
      // Combat rays and muzzle tracers must use this frame's facing, not the
      // previous rendered camera pose.
      if ((!coopPreview?.connected || coopPreview.role === 'host') && frame.selectedWeapon !== null) {
        const requestedWeapon = WEAPON_IDS[frame.selectedWeapon];
        if (currentRunLoadout().weapons.includes(requestedWeapon)) {
          player.activeWeapon = frame.selectedWeapon;
          selectWeapon(weapon, requestedWeapon);
          audio.setWeapon(weapon.selected);
        } else {
          announce(`${WEAPON_DEFINITIONS[requestedWeapon]?.name || "That weapon"} is still locked`);
        }
      }
      if (frame.interact) {
        if (coopPreview?.role === 'guest' && coopPreview.connected) requestGuestCoopContext();
        else useContext(now);
      }
      if (phase === GAME_PHASES.INTERWAVE_RECOVERY) updateWeaponHeat(weapon, dt, false, currentCombatTuning ?? {});
      if (phase === GAME_PHASES.COMBAT && run?.phase === GAME_PHASES.COMBAT
        && (!coopPreview?.connected || coopPreview.role === 'host')) {
        updateCombat(frame, dt, now, {coopAuthority: coopPreview?.role === 'host' && coopPreview.connected});
      }
      else world.setFirstPersonPose(player, dt, {aiming: adsActive});
    }
  }
  frameMonitor.simulationMs = performance.now() - simulationStartedAt;
  const rendererStartedAt = performance.now();
  enemyRenderer?.setPaused?.(paused);
  enemyRenderer?.update(now);
  updateMultiplayerPreview(dt);
  hubNpcPresentation?.update(dt, {
    playerPosition: {
      x: player.position.x,
      y: player.position.y + (Number(player.eyeHeight) || PLAYER_DEFAULTS.eyeHeight),
      z: player.position.z,
    },
    reducedMotion: Boolean(ui.reducedMotion?.checked || reducedMotionMedia.matches),
    isOccluded: (origin, target) => world.isWorldOccluded(origin, target),
  });
  world.updateEffects(now);
  updateHud(now);
  frameMonitor.rendererUpdateMs = performance.now() - rendererStartedAt;
  const sceneStartedAt = performance.now();
  world.scene.render();
  presentedFrame++;
  frameMonitor.sceneRenderMs = performance.now() - sceneStartedAt;
  const canAdaptResolution = (phase === GAME_PHASES.DAYTIME || phase === GAME_PHASES.COMBAT)
    && frameMonitor.samples.length >= 180;
  const frameWorkSeconds = (performance.now() - simulationStartedAt) / 1000;
  const renderAdjustment = canAdaptResolution
    ? updateRenderGovernor(renderGovernor, frameWorkSeconds)
    : {changed: false, scale: renderGovernor.scale};
  if (renderAdjustment.changed) {
    engine.setHardwareScalingLevel(renderAdjustment.scale);
    engine.resize();
    refreshGraphicsResolutionStatus();
    saveProfileSettings({autoHardwareScale: renderAdjustment.scale});
  }
  requestAnimationFrame(tick);
}

function updateMovePointer(event) {
  const rect = ui.movePad.getBoundingClientRect();
  const radius = Math.min(rect.width, rect.height) * .5;
  let x = (event.clientX - (rect.left + rect.width / 2)) / radius;
  let y = ((rect.top + rect.height / 2) - event.clientY) / radius;
  const length = Math.hypot(x, y);
  if (length > 1) { x /= length; y /= length; }
  touch.move.x = x; touch.move.y = y;
  touch.sprint = length > .84;
  const travel = radius * .45;
  ui.moveKnob.style.transform = `translate(${x * travel}px, ${-y * travel}px)`;
}

ui.movePad.addEventListener("pointerdown", (event) => {
  if (touch.movePointer !== null) return;
  setInputSource(INPUT_SOURCES.TOUCH);
  touch.movePointer = event.pointerId;
  ui.movePad.setPointerCapture(event.pointerId);
  updateMovePointer(event);
});
ui.movePad.addEventListener("pointermove", (event) => { if (event.pointerId === touch.movePointer) updateMovePointer(event); });
function releaseMove(event) {
  if (event.pointerId !== touch.movePointer) return;
  touch.movePointer = null; touch.move.x = 0; touch.move.y = 0; touch.sprint = false;
  ui.moveKnob.style.transform = "";
}
ui.movePad.addEventListener("pointerup", releaseMove); ui.movePad.addEventListener("pointercancel", releaseMove);

ui.lookSurface.addEventListener("pointerdown", (event) => {
  if (touch.lookPointer !== null) return;
  setInputSource(INPUT_SOURCES.TOUCH);
  touch.lookPointer = event.pointerId; touch.lookLast = {x: event.clientX, y: event.clientY};
  ui.lookSurface.setPointerCapture(event.pointerId);
});
function applyTouchLook(event, previous) {
  if (!previous) return {x: event.clientX, y: event.clientY};
  addLookInput((event.clientX - previous.x) * .0042, (event.clientY - previous.y) * .0037);
  return {x: event.clientX, y: event.clientY};
}
ui.lookSurface.addEventListener("pointermove", (event) => {
  if (event.pointerId !== touch.lookPointer) return;
  touch.lookLast = applyTouchLook(event, touch.lookLast);
});
function releaseLook(event) { if (event.pointerId === touch.lookPointer) { touch.lookPointer = null; touch.lookLast = null; } }
ui.lookSurface.addEventListener("pointerup", releaseLook); ui.lookSurface.addEventListener("pointercancel", releaseLook);

function pressFire(event) {
  event.preventDefault();
  setInputSource(INPUT_SOURCES.TOUCH);
  touch.firePointers.add(event.pointerId);
  touch.fireLookLast.set(event.pointerId, {x: event.clientX, y: event.clientY});
  touchFire = true;
  ui.fireButton.setPointerCapture?.(event.pointerId);
}
function moveFire(event) {
  if (!touch.firePointers.has(event.pointerId)) return;
  touch.fireLookLast.set(event.pointerId, applyTouchLook(event, touch.fireLookLast.get(event.pointerId)));
}
function releaseFire(event) {
  touch.firePointers.delete(event.pointerId);
  touch.fireLookLast.delete(event.pointerId);
  touchFire = touch.firePointers.size > 0;
}
ui.fireButton.addEventListener("pointerdown", pressFire); ui.fireButton.addEventListener("pointermove", moveFire); ui.fireButton.addEventListener("pointerup", releaseFire); ui.fireButton.addEventListener("pointercancel", releaseFire);
ui.aimButton?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  if (!profile.unlocks.includes("warden-focus")) {
    announce("Warden Focus is still locked");
    return;
  }
  setInputSource(INPUT_SOURCES.TOUCH);
  touchAim = true;
  touch.aimLookLast.set(event.pointerId, {x: event.clientX, y: event.clientY});
  ui.aimButton.setPointerCapture?.(event.pointerId);
});
function moveTouchAim(event) {
  if (!touch.aimLookLast.has(event.pointerId)) return;
  touch.aimLookLast.set(event.pointerId, applyTouchLook(event, touch.aimLookLast.get(event.pointerId)));
}
function releaseTouchAim(event) {
  touch.aimLookLast.delete(event.pointerId);
  touchAim = touch.aimLookLast.size > 0;
}
ui.aimButton?.addEventListener("pointermove", moveTouchAim);
ui.aimButton?.addEventListener("pointerup", releaseTouchAim);
ui.aimButton?.addEventListener("pointercancel", releaseTouchAim);
ui.contextButton.addEventListener("pointerdown", () => { setInputSource(INPUT_SOURCES.TOUCH); interactPressed = true; });
ui.jumpButton?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  setInputSource(INPUT_SOURCES.TOUCH);
  touchJumpPressed = true;
});
ui.slideButton?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  setInputSource(INPUT_SOURCES.TOUCH);
  touchSlidePressed = true;
});
ui.meleeButton?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  if (phase !== GAME_PHASES.COMBAT || paused) return;
  setInputSource(INPUT_SOURCES.TOUCH);
  meleePressed = true;
  touch.meleeLookLast.set(event.pointerId, {x: event.clientX, y: event.clientY});
  ui.meleeButton.setPointerCapture?.(event.pointerId);
});
ui.meleeButton?.addEventListener("pointermove", (event) => {
  if (!touch.meleeLookLast.has(event.pointerId)) return;
  touch.meleeLookLast.set(event.pointerId, applyTouchLook(event, touch.meleeLookLast.get(event.pointerId)));
});
function releaseMelee(event) { touch.meleeLookLast.delete(event.pointerId); }
ui.meleeButton?.addEventListener("pointerup", releaseMelee);
ui.meleeButton?.addEventListener("pointercancel", releaseMelee);

function enableMouseDragFallback() {
  if (mouseHoverFallback) return;
  mouseCaptureDiagnostics.dragFallbacks++;
  mouseHoverFallback = true;
  fallbackLookLast = null;
  if (!pointerLockFallbackAnnounced) announce("Pointer lock unavailable · move or drag to look · WASD to move");
  pointerLockFallbackAnnounced = true;
}

function requestMouseCaptureFromGesture(event) {
  if (!isDesktopMouseCaptureGesture(event)) return false;
  setInputSource(INPUT_SOURCES.MOUSE);
  canvas.focus();
  if (document.pointerLockElement === canvas) return true;
  mouseCaptureDiagnostics.requests++;
  return requestGameplayPointerLock(canvas, enableMouseDragFallback, {
    isLocked: () => document.pointerLockElement === canvas,
  });
}

document.addEventListener("pointerdown", (event) => {
  const portrait = innerHeight > innerWidth && innerWidth < 900;
  if (!shouldCaptureGameplayMouse(event, {phase, paused, portrait})) return;
  setInputSource(INPUT_SOURCES.MOUSE);
  canvas.focus();
  fallbackLookPointer = event.pointerId;
  fallbackLookLast = {x: event.clientX, y: event.clientY};
  try { event.target?.setPointerCapture?.(event.pointerId); } catch { /* Global move/up listeners retain drag fallback. */ }
  requestMouseCaptureFromGesture(event);
  mouseFire = true;
}, {capture: true});
document.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "mouse" || event.button !== 2 || phase !== GAME_PHASES.COMBAT || paused) return;
  event.preventDefault();
  setInputSource(INPUT_SOURCES.MOUSE);
  mouseAim = true;
  canvas.focus();
}, {capture: true});
canvas.addEventListener("contextmenu", (event) => {
  if (phase === GAME_PHASES.COMBAT) event.preventDefault();
});
addEventListener("pointerup", (event) => {
  if (event.pointerType !== "mouse") return;
  if (event.button === 0) mouseFire = false;
  if (event.button === 2) mouseAim = false;
  if (event.pointerId === fallbackLookPointer) {
    fallbackLookPointer = null;
    fallbackLookLast = null;
  }
});
addEventListener("pointercancel", (event) => {
  if (event.pointerType === "mouse") mouseAim = false;
  if (event.pointerId === fallbackLookPointer) {
    fallbackLookPointer = null;
    fallbackLookLast = null;
    mouseFire = false;
  }
});
addEventListener("mousemove", (event) => {
  if (paused || (phase !== GAME_PHASES.COMBAT && phase !== GAME_PHASES.DAYTIME && phase !== GAME_PHASES.INTERWAVE_RECOVERY)) return;
  const locked = document.pointerLockElement === canvas;
  const dragging = fallbackLookPointer !== null && fallbackLookLast;
  const hovering = mouseHoverFallback && event.target === canvas && document.activeElement === canvas;
  if (!locked && !dragging && !hovering) return;
  setInputSource(INPUT_SOURCES.MOUSE);
  if (!locked && !fallbackLookLast) {
    fallbackLookLast = {x: event.clientX, y: event.clientY};
    return;
  }
  const deltaX = locked ? event.movementX : event.clientX - fallbackLookLast.x;
  const deltaY = locked ? event.movementY : event.clientY - fallbackLookLast.y;
  addLookInput(deltaX * .0021, deltaY * .00185);
  if (!locked) fallbackLookLast = {x: event.clientX, y: event.clientY};
});
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === canvas) {
    mouseCaptureDiagnostics.locks++;
    hadPointerLock = true;
    mouseHoverFallback = false;
    fallbackLookPointer = null;
    fallbackLookLast = null;
    announce("Mouse captured · Esc pauses");
    return;
  }
  if (hadPointerLock && currentInputSource === INPUT_SOURCES.MOUSE && phase === GAME_PHASES.COMBAT && !paused) togglePause(true);
  hadPointerLock = false;
});
document.addEventListener("pointerlockerror", () => {
  mouseCaptureDiagnostics.errors++;
  enableMouseDragFallback();
});

addEventListener("gamepadconnected", (event) => {
  activeGamepadIndex = event.gamepad.index;
  gamepadCalibration = createGamepadCalibration();
  cachedControllerMappingKey = null;
  cachedControllerMapping = null;
  setControllerPresence(true);
  refreshControllerMappingStatus();
  announce(`${event.gamepad.id || "Controller"} connected`);
});
addEventListener("gamepaddisconnected", (event) => {
  if (event.gamepad.index === activeGamepadIndex) {
    const replacement = selectConnectedGamepad(navigator.getGamepads?.(), null);
    activeGamepadIndex = replacement?.index ?? null;
    gamepadCalibration = createGamepadCalibration();
    cachedControllerMappingKey = null;
    cachedControllerMapping = null;
    lastControllerAction = null;
    if (controllerMappingSession) cancelControllerMapping("Controller disconnected · mapping cancelled");
    setControllerPresence(Boolean(replacement));
    refreshControllerMappingStatus();
  }
});

addEventListener("keydown", (event) => {
  if (!ui.updateOverlay.hidden && event.key === "Tab") {
    const focusables = [ui.updateNow, ui.updateLater].filter(controllerElementIsAvailable);
    const current = focusables.indexOf(document.activeElement);
    if (focusables.length) {
      event.preventDefault();
      focusables[(current + (event.shiftKey ? -1 : 1) + focusables.length) % focusables.length].focus();
    }
    return;
  }
  const editableTarget = event.target?.closest?.("input,textarea,select,[contenteditable=\"true\"]");
  if (editableTarget) return;
  if (["KeyW","KeyA","KeyS","KeyD","ShiftLeft","ShiftRight","ControlLeft","ControlRight","KeyC","KeyF","KeyQ","Digit1","Digit2","Digit3","KeyE","Escape","Space"].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.repeat) return;
  if (keyboardCodeClaimsDesktopInput(event.code)) setInputSource(INPUT_SOURCES.MOUSE);
  if (event.code === "Escape" && controllerMappingSession) { cancelControllerMapping(); return; }
  if (event.code === "KeyE") interactPressed = true;
  if (event.code === "KeyF" && phase === GAME_PHASES.COMBAT && !paused) meleePressed = true;
  if (event.code === "Escape") { handleBackAction(); return; }
  if (event.code === "Digit1") weaponPressed = 0;
  if (event.code === "Digit2") weaponPressed = 1;
  if (event.code === "Digit3") weaponPressed = 2;
});
addEventListener("keyup", (event) => {
  if (playtestReporter?.isOpen || coopIssueCaptureOpen) {
    keys.delete(event.code);
    return;
  }
  const editableTarget = event.target?.closest?.("input,textarea,select,[contenteditable=\"true\"]");
  if (editableTarget) return;
  keys.delete(event.code);
});

for (const button of ui.weaponButtons) button.addEventListener("click", () => { weaponPressed = WEAPON_IDS.indexOf(button.dataset.weapon); });
for (const button of ui.buildChoiceButtons) button.addEventListener("click", () => installSelectedFortification(button.dataset.fortification));
for (const button of ui.hubServiceActions) button.addEventListener("click", (event) => {
  handleHubServiceAction(button.dataset.hubAction);
});
ui.hubServiceClose.addEventListener("click", closeHubService);
ui.buildPanelToggle.addEventListener("click", () => {
  setBuildPanelExpanded(ui.buildPanelDetails.hidden);
});
ui.goalsOpen.addEventListener("click", () => goalsPresentation.open(goalsDisplayModels()));
ui.newRunButton.addEventListener("click", () => {
  requestNewRun();
});
ui.oathHallButton.addEventListener("click", () => ui.oathHallPanel.hidden ? openOathHall() : closeOathHall());
ui.oathHallClose.addEventListener("click", closeOathHall);
ui.oathHallPanel.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  const focusable = [...ui.oathHallPanel.querySelectorAll("button:not(:disabled)")]
    .filter(button => !button.hidden && button.getClientRects().length > 0);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
ui.oathHallTabs.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-oath-tab]");
  if (!tab) return;
  oathHallAtlasState = {...oathHallAtlasState, activeTab: tab.dataset.oathTab || "foundations", selectedId: null};
  renderOathHall();
  ui.oathHallTabs.querySelector(`[data-oath-tab="${oathHallAtlasState.activeTab}"]`)?.focus();
});
ui.oathHallSections.addEventListener("click", (event) => {
  const weaponTab = event.target.closest("[data-weapon-tab]");
  if (weaponTab) {
    oathHallAtlasState = {...oathHallAtlasState, activeWeapon: weaponTab.dataset.weaponTab, selectedId: null};
    renderOathHall();
    ui.oathHallSections.querySelector(`[data-weapon-tab="${oathHallAtlasState.activeWeapon}"]`)?.focus();
    return;
  }
  const node = event.target.closest("[data-oath-node]");
  if (node) {
    const model = createOathHallModel(profile, {role: oathHallRole(), run, terminalBoundary: !run});
    oathHallAtlasState = selectProgressionNode(model, oathHallAtlasState, node.dataset.oathNode);
    renderOathHall();
    ui.oathHallSections.querySelector(`[data-oath-node="${node.dataset.oathNode}"]`)?.focus();
    return;
  }
  const button = event.target.closest("[data-oath-action]");
  if (button && !button.disabled) activateOathHallAction(button.dataset.oathAction);
});
ui.coopButton.addEventListener("click", () => ui.coopPanel.hidden ? openCoopPanel() : closeCoopPanel());
ui.coopHost.addEventListener("click", () => void beginCoopHost());
ui.coopJoin.addEventListener("click", () => void beginCoopJoin());
ui.coopRoomCopy.addEventListener("click", () => void copyCoopRoomCode());
ui.coopManualHost.addEventListener("click", () => void beginManualCoopHost());
ui.coopManualJoin.addEventListener("click", () => void beginManualCoopJoin());
ui.coopSignal.addEventListener("click", () => void advanceCoopSignal());
ui.coopCopy.addEventListener("click", () => void copyCoopSignal());
ui.coopClose.addEventListener("click", closeCoopPanel);
ui.continueButton.addEventListener("click", (event) => {
  if (run?.phase === GAME_PHASES.COMBAT) requestMouseCaptureFromGesture(event);
  void continueRun();
});
ui.pauseButton.addEventListener("click", () => togglePause(true));
ui.leaveCoopButton.addEventListener("click", () => {
  returnToMenu();
  announce("Left the co-op preview");
});
ui.resumeButton.addEventListener("click", (event) => {
  togglePause(false);
  requestMouseCaptureFromGesture(event);
});
ui.pauseSettingsButton.addEventListener("click", () => {
  if (ui.settingsPanel.hidden || ui.settingsPanel.parentElement !== ui.pauseSettingsMount) {
    openSettingsPanel(ui.pauseSettingsMount, ui.pauseSettingsButton);
  } else closeSettingsPanel();
});
ui.quitButton.addEventListener("click", () => { persistRun(); returnToMenu(); });
ui.quitCancel.addEventListener("click", closeQuitPrompt);
ui.quitConfirm.addEventListener("click", confirmQuitGame);
ui.deleteSave.addEventListener("click", requestDeleteSave);
ui.deleteSaveCancel.addEventListener("click", closeDeleteSavePrompt);
ui.deleteSaveConfirm.addEventListener("click", () => void confirmDeleteSave());
ui.updateLater.addEventListener("click", () => closeAndroidUpdate({snooze: true}));
ui.updateNow.addEventListener("click", () => void openAndroidUpdate());
ui.resultContinue.addEventListener("click", () => {
  const coopTerminalAction = resolveCoopTerminalResultAction({
    connected: coopPreview?.connected === true,
    role: coopPreview?.role ?? null,
    phase,
  });
  if (coopTerminalAction === "wait") {
    announce('Waiting for the host to open the boon choice');
    return;
  }
  if (coopTerminalAction === "leave") {
    returnToMenu();
    announce("Left the co-op campaign");
    return;
  }
  if (pendingTerminalTransition) {
    if (retryPendingPersistence()) {
      if (coopTerminalAction === "begin_again") activateCoopWorld({checkpointReason: "new_run"});
      else void startNewRun();
    }
    else announce("Storage is still unavailable. Rewards remain pending in this session.");
    return;
  }
  if (coopTerminalAction === "begin_again") {
    activateCoopWorld({checkpointReason: "new_run"});
    return;
  }
  if (phase === GAME_PHASES.NIGHT_COMPLETE) enterBoonChoice();
  else if (phase === GAME_PHASES.RUN_FAILED || phase === GAME_PHASES.CAMPAIGN_COMPLETE) void startNewRun();
  else returnToMenu();
});
ui.howButton.addEventListener("click", () => {
  const open = ui.howPanel.hidden;
  if (!ui.coopPanel.hidden) closeCoopPanel();
  if (!open) return closeHowPanel();
  closeSettingsPanel();
  show(ui.howPanel, true);
  ui.howButton.setAttribute("aria-expanded", "true");
  if (controllerPresent) queueMicrotask(() => ui.howClose.focus());
});
ui.howClose.addEventListener("click", closeHowPanel);
ui.settingsButton.addEventListener("click", () => {
  const open = ui.settingsPanel.hidden || ui.settingsPanel.parentElement !== ui.menuSecondary;
  if (open) openSettingsPanel(ui.menuSecondary, ui.settingsButton);
  else closeSettingsPanel();
});
ui.settingsClose.addEventListener("click", closeSettingsPanel);
ui.controllerMappingStart.addEventListener("click", beginControllerMapping);
ui.controllerMappingReset.addEventListener("click", resetControllerMapping);
ui.controllerMappingCancel.addEventListener("click", () => cancelControllerMapping());
ui.volume.addEventListener("input", () => {
  const volume = Number(ui.volume.value);
  audio.setVolume(volume / 100);
  saveProfileSettings({volume});
});
ui.lookSensitivity.addEventListener("input", () => {
  const sensitivity = normaliseLookSensitivity(ui.lookSensitivity.value);
  ui.lookSensitivity.value = String(sensitivity);
  lookSensitivityScale = lookSensitivityMultiplier(sensitivity);
  saveProfileSettings({lookSensitivity: sensitivity});
});
ui.invertVerticalLook.addEventListener("change", () => {
  invertVerticalLook = ui.invertVerticalLook.checked;
  saveProfileSettings({invertVerticalLook});
});
ui.aimAssist.addEventListener("input", () => saveProfileSettings({aimAssist: Number(ui.aimAssist.value)}));
ui.graphicsQuality.addEventListener("change", () => applyGraphicsQuality(ui.graphicsQuality.value, {announceChange: true}));
ui.enemyPresentation?.addEventListener("change", () => applyEnemyPresentation(
  ui.enemyPresentation.value,
  {announceChange: true},
));
ui.frameRateLimit.addEventListener("change", () => applyFrameRateLimit(ui.frameRateLimit.value, {announceChange: true}));
ui.reducedMotion.addEventListener("change", () => {
  document.body.classList.toggle("reduced-motion", ui.reducedMotion.checked);
  world.setReducedMotion?.(ui.reducedMotion.checked);
  if (ui.reducedMotion.checked) viewmodelRecoil.cancel();
  saveProfileSettings({reducedMotion: ui.reducedMotion.checked});
});
ui.autoMelee.addEventListener("change", () => saveProfileSettings({autoMelee: ui.autoMelee.checked}));
ui.autoFire.addEventListener("change", () => saveProfileSettings({autoFire: ui.autoFire.checked}));

function updateOrientation() {
  const portrait = innerHeight > innerWidth && innerWidth < 900;
  show(ui.rotate, portrait);
  if (portrait && document.pointerLockElement === canvas) document.exitPointerLock?.();
}
function resizeRenderer() {
  const requestedScale = graphicsScaleForQuality(graphicsQuality, {
    coarse: coarsePointer,
    devicePixelRatio,
    software: softwareGraphics,
  });
  const safeBaseScale = budgetedGraphicsScale(requestedScale, graphicsQuality);
  renderGovernor.baseScale = safeBaseScale;
  renderGovernor.maxScale = Math.max(
    safeBaseScale,
    maximumRenderScale({coarse: coarsePointer, software: softwareGraphics}),
  );
  renderGovernor.scale = renderGovernor.enabled
    ? clamp(renderGovernor.scale, safeBaseScale, renderGovernor.maxScale)
    : safeBaseScale;
  engine.setHardwareScalingLevel(renderGovernor.scale);
  engine.resize();
  refreshGraphicsResolutionStatus();
  updateOrientation();
}
addEventListener("resize", resizeRenderer);
addEventListener("orientationchange", updateOrientation);
if (typeof compactBuildPanelMedia.addEventListener === "function") {
  compactBuildPanelMedia.addEventListener("change", syncBuildPanelForViewport);
} else {
  compactBuildPanelMedia.addListener?.(syncBuildPanelForViewport);
}
installNativeLifecycle({
  shouldPause: () => phase === GAME_PHASES.COMBAT || phase === GAME_PHASES.DAYTIME || phase === GAME_PHASES.INTERWAVE_RECOVERY,
  pause: pauseForLifecycle,
  resume: resumeFromLifecycle,
  foreground: () => void refreshAndroidUpdate(),
  back: handleBackAction,
});
addEventListener("focus", retryPendingPersistence);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") retryPendingPersistence();
});
addEventListener("beforeunload", () => {
  coopSignaling?.close();
  coopPreview?.close();
  if (pendingTerminalTransition) retryPendingPersistence();
  else persistRun();
});

playtestReporter = createPlaytestReporter({
  elements: {
    open: ui.playtestReportOpen,
    overlay: ui.playtestReportOverlay,
    preview: ui.playtestReportPreview,
    status: ui.playtestReportStatus,
    note: ui.playtestReportNote,
    category: ui.playtestReportCategory,
    impact: ui.playtestReportImpact,
    cancel: ui.playtestReportCancel,
    retake: ui.playtestReportRetake,
    save: ui.playtestReportSave,
    remoteOptions: ui.playtestReportRemoteOptions,
    screenshotConsent: ui.playtestReportScreenshotConsent,
    diagnosticsConsent: ui.playtestReportDiagnosticsConsent,
  },
  captureScreenshot: () => capturePlaytestScreenshot({engine, scene: world.scene}),
  captureContext: capturePlaytestContext,
  suspendGame: suspendForPlaytestReport,
  canOpen: canOpenPlaytestReporter,
  announce,
  getTurnstileToken: createPlaytestTurnstileTokenProvider({
    siteKey: document.querySelector('meta[name="briarhold-turnstile-site-key"]')?.content ?? "",
    container: ui.playtestReportTurnstile,
  }),
});
void playtestReporter.ready.then(() => refreshControllerMappingStatus());

readSavedState();
refreshControllerMappingStatus();
if (profile.settings?.volume != null) ui.volume.value = String(clamp(Number(profile.settings.volume), 0, 100));
audio.setVolume(Number(ui.volume.value) / 100);
ui.lookSensitivity.value = String(normaliseLookSensitivity(profile.settings?.lookSensitivity));
lookSensitivityScale = lookSensitivityMultiplier(ui.lookSensitivity.value);
ui.invertVerticalLook.checked = Boolean(profile.settings?.invertVerticalLook);
invertVerticalLook = ui.invertVerticalLook.checked;
if (profile.settings?.aimAssist != null) ui.aimAssist.value = String(clamp(Number(profile.settings.aimAssist), 0, 100));
ui.reducedMotion.checked = Boolean(profile.settings?.reducedMotion);
ui.autoMelee.checked = profile.settings?.autoMelee !== false;
ui.autoFire.checked = Boolean(profile.settings?.autoFire);
document.body.classList.toggle("reduced-motion", ui.reducedMotion.checked);
applyGraphicsQuality(profile.settings?.graphicsQuality, {persist: false});
applyEnemyPresentation(profile.settings?.enemyPresentation, {persist: false});
applyFrameRateLimit(profile.settings?.frameRateLimit, {persist: false});
world.setReducedMotion?.(ui.reducedMotion.checked);
const initialGamepad = selectConnectedGamepad(navigator.getGamepads?.(), null);
activeGamepadIndex = initialGamepad?.index ?? null;
setInputSource(currentInputSource);
setControllerPresence(Boolean(initialGamepad), {focus: false});
setPhase(GAME_PHASES.MENU);
world.setFirstPersonPose(player);
updateOrientation();
Promise.resolve(world.environmentReady).finally(() => {
  show(ui.loading, false);
  void refreshAndroidUpdate();
});
void initializeMultiplayerPreview();
requestAnimationFrame(tick);

globalThis.__BRIARHOLD__ = {
  version: BRIARHOLD_VERSION,
  get phase() { return phase; },
  get player() { return structuredClone(player); },
  get run() {
    const currentRun = run ?? coopTerminalRun;
    return currentRun ? structuredClone(currentRun) : null;
  },
  get progressionProfile() { return structuredClone(profile); },
  get battlefield() { return battlefield; },
  get profile() { return rendererProfile; },
  get diagnostics() {
    return {
      phase, inputSource: currentInputSource, paused, testMode: TEST_MODE, lastCoopEndedReason, lastCoopDropBudget,
      mouseCapture: {...mouseCaptureDiagnostics, locked: document.pointerLockElement === canvas},
      playtestReporter: {
        available: Boolean(playtestReporter?.receiver),
        open: Boolean(playtestReporter?.isOpen),
        folder: playtestReporter?.receiver?.folder ?? null,
      },
      map: BRIARHOLD_FIRST_PERSON_MAP.id,
      battlefield: battlefield?.stats() || null,
      renderer: enemyRenderer?.diagnostics || null,
      enemyPresentation: {...enemyPresentationResolution},
      world: world.diagnostics(),
      audio: audio.diagnostics(),
      multiplayerPreview: MULTIPLAYER_PREVIEW ? {
        loaded: Boolean(multiplayerPreview),
        error: multiplayerPreviewError,
        snapshotCount: multiplayerPreview?.avatar.interpolation.size ?? 0,
        serverTick: multiplayerPreview?.serverTick ?? 0,
      } : null,
      coop: coopPreview?.diagnostics?.() ?? null,
      coopWorld: coopPreview ? {
        stateHash: coopPreview.latestFrame?.stateHash ?? null,
        worldFrameEnemies: coopPreview.latestFrame?.crowd?.total ?? 0,
        worldFrameCohort: coopPreview.latestFrame?.crowd?.cohort?.length ?? 0,
        enemySample: structuredClone(coopPreview.latestFrame?.crowd?.cohort?.slice(0, 8) ?? []),
        night: (run ?? coopTerminalRun)?.night ?? null,
        phase: coopPreview.latestFrame?.phase ?? phase,
        subphase: coopPreview.latestFrame?.subphase ?? coopSubphase(),
        eventCursor: coopPreview.latestFrame?.eventCursor ?? coopSemanticEventSequence,
        boss: structuredClone(coopPreview.latestFrame?.boss ?? null),
        objective: structuredClone(coopPreview.latestFrame?.objective ?? null),
        lastCombatResolution: structuredClone(lastCoopCombatResolution),
        wave: coopPreview.latestFrame?.wave ?? (run ?? coopTerminalRun)?.wave ?? null,
        supplies: run?.supplies ?? null,
        gates: run?.gates ? structuredClone(run.gates) : null,
        fortifications: structuredClone(run?.fortifications ?? []),
        activeNpcs: [...(run?.hub?.activeNpcs ?? [])],
        fallenNpcs: [...(run?.fallenNpcs ?? [])],
        settlement: coopSettlementState ? structuredClone(coopSettlementState) : null,
        bossPresentation: bossPresentationAdapter.diagnostics?.() ?? null,
      } : null,
      hub: {
        loaded: Boolean(hubNpcPresentation),
        npcModels: hubNpcPresentation?.count ?? 0,
        presentation: hubNpcPresentation?.diagnostics ?? [],
        error: hubNpcPresentationError,
        activeStationId: activeHubStation?.id ?? null,
        activeNpcs: [...(run?.hub?.activeNpcs ?? [])],
        fallenNpcs: [...(run?.fallenNpcs ?? [])],
        combat: hubCombatState ? serialiseHubCombatState(hubCombatState) : null,
        serviceOpen: !ui.hubServicePanel.hidden,
      },
      aiming: {
        unlocked: profile.unlocks.includes("warden-focus"),
        active: adsActive,
        overheated: weapon.overheated,
        heat: weapon.heat,
      },
      boss: run?.bossEncounter?.mode === "authored-director" ? {
        encounterId: run.bossEncounter.encounterId,
        status: run.bossEncounter.status,
        hash: run.bossEncounter.hash,
        eventSequence: run.bossEncounter.eventSequence,
        actors: run.bossEncounter.actors.map(actor => ({id: actor.id, hp: actor.hp, maxHp: actor.maxHp, phase: actor.phase, state: actor.state, x: actor.position.x, y: actor.position.y, z: actor.position.z, animationState: actor.animationState, defeated: actor.defeated})),
        zones: run.bossEncounter.zones.map(zone => ({id: zone.id, kind: zone.kind, visible: zone.visible, activeAtMs: zone.activeAtMs, expiresAtMs: zone.expiresAtMs})),
        recentEvents: run.bossEncounter.events.slice(-12).map(event => ({sequence: event.sequence, type: event.type, actorId: event.actorId ?? null, attack: event.attack ?? null})),
      } : null,
      bossPresentation: bossPresentationAdapter.diagnostics?.() ?? null,
      performance: {
        medianFps: frameMonitor.medianFps,
        onePercentLowFps: frameMonitor.onePercentLowFps,
        lastFrameMs: frameMonitor.lastFrameMs,
        simulationMs: frameMonitor.simulationMs,
        rendererUpdateMs: frameMonitor.rendererUpdateMs,
        sceneRenderMs: frameMonitor.sceneRenderMs,
        presentedFrame,
        hitchCount: frameMonitor.hitchCount,
        sampleCount: frameMonitor.samples.length,
        memoryBytes: performance.memory?.usedJSHeapSize || null,
        graphicsInfo,
        antialias: engine.getRenderingCanvas()?.getContext?.("webgl2")?.getContextAttributes?.()?.antialias
          ?? engine.getRenderingCanvas()?.getContext?.("webgl")?.getContextAttributes?.()?.antialias
          ?? antialias,
        hardwareScale: renderGovernor.scale,
        adaptiveAdjustments: renderGovernor.adjustments,
        visibilityState: document.visibilityState,
        documentHasFocus: document.hasFocus(),
      },
    };
  },
  actions: {
    startNewRun,
    openOathHallForTest({guest = false} = {}) {
      if (!TEST_MODE) return false;
      profile = createProfileState({
        oathmarks: 100,
        hubUnlocks: Object.values(HUB_NPC_IDS),
        relationships: Object.fromEntries(Object.values(HUB_NPC_IDS).map(id => [id, {status: "trusted"}])),
        weaponMastery: Object.fromEntries(WEAPON_IDS.map(id => [id, {xp: 300}])),
      });
      run = null;
      oathHallTestRole = guest ? "guest" : "host";
      oathHallAtlasState = {activeTab: "foundations", activeWeapon: "arbalest", selectedId: null};
      return openOathHall();
    },
    openBoonChoiceForTest() {
      if (!TEST_MODE) return false;
      oathHallTestRole = null;
      run = createRunState({profile, phase: PROGRESSION_PHASES.DAYTIME});
      enterBoonChoice();
      return phase === GAME_PHASES.BOON_CHOICE;
    },
    openPortraitForTest(roleId) {
      if (!TEST_MODE || !NARRATIVE_CAST[roleId]) return false;
      const cast = NARRATIVE_CAST[roleId];
      show(ui.boonOverlay, false);
      narrativePresentation.begin({
        sceneId: `presentation-${roleId}`,
        beatId: `presentation-${roleId}`,
        speaker: cast.name,
        role: cast.role,
        portraitId: cast.roleId,
        text: `${cast.name} stands with Briarhold as the next assault gathers beyond the walls.`,
        reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      });
      return true;
    },
    setLightingQualityForTest(value) {
      if (!TEST_MODE) return null;
      applyGraphicsQuality(value, {persist: false});
      return world.diagnostics().lighting;
    },
    openHubStation(stationId) { return openHubService(stationId); },
    activateHubAction(actionId) { return handleHubServiceAction(actionId); },
    setOathmarksForTest(amount) {
      if (!TEST_MODE || !Number.isInteger(amount) || amount < 0) return false;
      profile = {...profile, oathmarks: amount};
      persistRun();
      return true;
    },
    recordQuartermasterKnifeStreakForTest(count = 21) {
      if (!TEST_MODE || !run || !Number.isInteger(count) || count < 1 || count > 21) return false;
      if (relationshipModelFor(HUB_NPC_IDS.QUARTERMASTER).active?.id !== "tamsin-knife-21") return false;
      for (let index = 0; index < count; index += 1) {
        commitGoalAuthority(applyRelationshipGoalEvent(goalAuthorityState(), {
          type: "kill",
          eventId: `acceptance-quartermaster-knife-${run.runOrdinal}-${run.night}-${index}`,
          actorId: "acceptance-warden",
          weaponId: "knife",
          enemyId: `acceptance-knife-target-${index}`,
        }, {role: "host"}));
      }
      persistRun();
      return relationshipModelFor(HUB_NPC_IDS.QUARTERMASTER).ready?.id === "tamsin-knife-21";
    },
    unlockAdsForTest() {
      if (!TEST_MODE) return false;
      profile = {...profile, unlocks: [...new Set([...profile.unlocks, "warden-focus"])].sort()};
      invalidateRunLoadoutCache();
      persistRun();
      return true;
    },
    unlockNpcRosterForTest() {
      if (!TEST_MODE || !run) return false;
      profile = {...profile, hubUnlocks: Object.values(HUB_NPC_IDS)};
      invalidateRunLoadoutCache();
      const arrivals = applyHubArrivals(profile, run);
      run = {...run, hub: arrivals.hub};
      hubCombatState = null;
      syncHubWorldPresentation();
      releaseHubNpcPresentation();
      if (phase === GAME_PHASES.DAYTIME) void ensureHubNpcPresentation();
      persistRun();
      return true;
    },
    prepareNightOneReloadBoundaryForTest() {
      if (!TEST_MODE || coopPreview) return false;
      let seededRun = newRunState();
      let seededProfile = profile;
      for (let wave = 0; wave < 3; wave += 1) {
        seededRun = beginSoloCampaignWave(seededRun);
        const transition = completeSoloCampaignWave(seededProfile, seededRun);
        seededProfile = transition.profile;
        seededRun = transition.run;
      }
      profile = seededProfile;
      run = seededRun;
      killsThisRun = 0;
      applyLoadedPlayer();
      showNightComplete(1);
      return run.phase === GAME_PHASES.NIGHT_COMPLETE;
    },
    prepareBossWaveForTest(night, hpMultiplier = 0.05) {
      if (!TEST_MODE || !Number.isInteger(night) || night < 2 || night > 7) return false;
      if (!Number.isFinite(hpMultiplier) || hpMultiplier <= 0 || hpMultiplier > 1) return false;
      const testCoopPlayers = coopPreview?.role === "host"
        ? [...coopPreview.authority.players.values()]
        : [];
      testBossHpMultiplier = hpMultiplier;
      profile = {
        ...profile,
        unlocks: [...new Set([...profile.unlocks, "sunfire-prism", "split-runebolt"])],
        // The guarded boss-jump authors completed-night boon history below.
        // Keep that synthetic history consistent with checkpoint provenance.
        hubUnlocks: coopPreview?.role === "host"
          ? [...new Set([...profile.hubUnlocks, HUB_NPC_IDS.GREENWARDEN])]
          : profile.hubUnlocks,
      };
      let testProfile = profile;
      let testRun = coopPreview?.role === "host"
        ? createCoopCampaignRun(profile, {
          night,
          wave: 2,
          runSeed: 0x4b1a4b05,
          player: {maxHp: 100000, hp: 100000},
          gates: baseRunGates(),
          fortifications: [],
          phase: PROGRESSION_PHASES.DAYTIME,
        })
        : createRunState({
        profile,
        night,
        wave: 2,
        runSeed: 0x4b1a4b05,
        player: {maxHp: 100000, hp: 100000},
        gates: baseRunGates(),
        fortifications: [],
        phase: PROGRESSION_PHASES.DAYTIME,
      });
      if (coopPreview?.role === "host") {
        for (let completedNight = 1; completedNight < night; completedNight += 1) {
          const boonId = createBoonOffer(testRun, completedNight)[0].id;
          testRun = {...testRun, boons: [...testRun.boons, boonId],
            boonChoices: {...testRun.boonChoices, [completedNight]: boonId}};
          for (let completedWave = 1; completedWave <= 3; completedWave += 1) {
            ({profile: testProfile, run: testRun} = applyProgressionEvent(testProfile, testRun,
              {type: "wave", night: completedNight, wave: completedWave}));
          }
          ({profile: testProfile, run: testRun} = applyProgressionEvent(testProfile, testRun, {
            type: "boss", encounterId: `night-${completedNight}-wave-3`,
            stableId: getCampaignWave(completedNight, 2).bossEncounterIds.join("+"),
          }));
          ({profile: testProfile, run: testRun} = applyProgressionEvent(testProfile, testRun,
            {type: "night", night: completedNight}));
          if (completedNight === 1) {
            ({profile: testProfile, run: testRun} = applyProgressionEvent(testProfile, testRun,
              {type: "first-night-one-hold", qualifyingNightOneHold: true}));
          }
        }
        // This guarded smoke route enters the third-wave build directly. Its
        // checkpoint must therefore carry the two current-night wave rewards
        // that normal play would already have earned at this boundary.
        for (let completedWave = 1; completedWave <= 2; completedWave += 1) {
          ({profile: testProfile, run: testRun} = applyProgressionEvent(testProfile, testRun,
            {type: "wave", night, wave: completedWave}));
        }
        profile = testProfile;
      }
      run = {
        ...prepareSoloCampaignDaytime(profile, prepareNightRuntimeState(profile, testRun, {newNight: true})),
        // This guarded boundary rings directly into the third wave after the
        // two synthetic current-night rewards authored above.
        wave: 2,
      };
      if (coopPreview?.role === "host") {
        const slots = resolveRunLoadout(run, profile).weapons.map(weaponId => WEAPON_IDS.indexOf(weaponId));
        if (!coopPreview.setAllowedWeapons(slots)) return false;
      }
      hubCombatState = null;
      killsThisRun = 0;
      applyLoadedPlayer();
      enterDaytime(true);
      if (coopPreview?.role === "host") {
        const revivedPlayers = testCoopPlayers.map(state => createNetworkPlayerState({
          ...state,
          hp: state.maxHp,
          velocity: {x: 0, y: 0, z: 0},
        }));
        coopPreview.authority.players = new Map(revivedPlayers.map(state => [state.playerId, state]));
        coopPreview.applyCheckpointFrame({authorityTick: coopPreview.authority.tick, players: revivedPlayers});
      }
      if (coopPreview?.role === "host" && coopPreview.connected
        && !coopPreview.sendCheckpoint("test-campaign-boundary")) return false;
      return true;
    },
    frameBossForTest(actorId, distance = 18) {
      if (!TEST_MODE || phase !== GAME_PHASES.COMBAT || !authoredBossActive()) return false;
      const actor = run.bossEncounter.actors.find(item => item.id === actorId && !item.defeated);
      if (!actor || !Number.isFinite(distance) || distance < 5 || distance > 40) return false;
      // The Herald's straight southern sightline crosses the defender-cache
      // gatehouse. Frame its documented western-overlook counter position so
      // the normal range, view-cone and world-occlusion checks are exercised.
      const heraldOverlook = actorId === "moonless-herald";
      player.position.x = actor.position.x - (heraldOverlook ? 10 : 0);
      player.position.y = 0;
      player.position.z = actor.position.z - (heraldOverlook ? 18 : distance);
      player.velocity.x = 0;
      player.velocity.y = 0;
      player.velocity.z = 0;
      player.grounded = true;
      const targetY = actor.position.y + actor.radius * 0.45;
      const offsetX = actor.position.x - player.position.x;
      const offsetZ = actor.position.z - player.position.z;
      const planarDistance = Math.hypot(offsetX, offsetZ);
      player.facing.yaw = Math.atan2(offsetX, offsetZ);
      player.facing.pitch = -Math.atan2(targetY - (player.position.y + PLAYER_DEFAULTS.eyeHeight), planarDistance);
      world.setFirstPersonPose(player, 0, {aiming: false});
      return true;
    },
    frameBossLaneForTest(actorId, distance = 30) {
      if (!TEST_MODE || phase !== GAME_PHASES.COMBAT || !authoredBossActive()) return false;
      const actor = run.bossEncounter.actors.find(item => item.id === actorId && !item.defeated);
      if (!actor || !Number.isFinite(distance) || distance < 20 || distance > 40) return false;
      player.position.x = actor.position.x;
      player.position.y = 0;
      player.position.z = actor.position.z - distance;
      player.velocity.x = 0;
      player.velocity.y = 0;
      player.velocity.z = 0;
      player.grounded = true;
      player.facing.yaw = 0;
      player.facing.pitch = 0;
      world.setFirstPersonPose(player, 0, {aiming: false});
      return true;
    },
    defeatBossesForTest() {
      if (!TEST_MODE || coopPreview?.role === "guest" || phase !== GAME_PHASES.COMBAT
        || run?.bossEncounter?.mode !== "authored-director") return false;
      for (let step = 0; step < 40 && run.bossEncounter.status !== "defeated"; step += 1) {
        const commands = [];
        if (run.bossEncounter.status === "waiting") commands.push({id: `test-release:${run.night}`, type: "encounter_release"});
        for (const actor of run.bossEncounter.actors) {
          if (actor.id === "moonless-herald" && !actor.defeated && actor.state === "phased") commands.push({
            id: `test-ward:${run.night}:${step}`,
            type: "ward_light",
            actorId: actor.id,
            source: {x: actor.position.x, z: actor.position.z - 18},
            direction: {x: 0, z: 1},
          });
          if (!actor.defeated) commands.push({
            id: `test-hit:${run.night}:${actor.id}:${step}`,
            type: "warden_hit",
            actorId: actor.id,
            weaponId: "runebolt",
            damage: 999999,
            stagger: 999,
            heading: Math.PI,
          });
        }
        applyBossDirectorUpdate({elapsedMs: 250, commands});
      }
      if (run.bossEncounter.status === "defeated") {
        persistRun();
        return true;
      }
      return false;
    },
    clearWave() { if (!TEST_MODE || !battlefield || coopPreview?.role === 'guest') return false; for (let id = 0; id < battlefield.slotCount; id++) if (battlefield.status[id] === ACTIVE) battlefield.damageEnemy(id, battlefield.maxHp[id] * 2); return true; },
    setCoopPlayerPoseForTest(playerId, position, facing = {yaw: 0, pitch: 0}) {
      if (!TEST_MODE || !coopPreview) return false;
      if (coopPreview.role === 'guest') {
        if (playerId !== coopPreview.localId) return false;
        player.position = {...position}; player.velocity = {x: 0, y: 0, z: 0}; player.facing = {...facing};
        return true;
      }
      if (coopPreview.role !== 'host' || !coopPreview.authority?.players?.has(playerId)) return false;
      const current = coopPreview.authority.players.get(playerId);
      const next = {...current, position: {...position}, velocity: {x: 0, y: 0, z: 0}, facing: {...facing}};
      coopPreview.authority.players.set(playerId, next);
      if (playerId === coopPreview.localId) {
        player.position = {...position}; player.velocity = {x: 0, y: 0, z: 0}; player.facing = {...facing};
      }
      return true;
    },
    sendCoopActionForTest(action, payload = {}) {
      if (!TEST_MODE || coopPreview?.role !== 'guest') return null;
      return coopPreview.sendAction(action, payload);
    },
    setFireForTest(value) {
      if (!TEST_MODE || phase !== GAME_PHASES.COMBAT) return false;
      mouseFire = Boolean(value);
      return true;
    },
    sendCoopFireForTest(selectedWeapon = null) {
      if (!TEST_MODE || coopPreview?.role !== 'guest' || phase !== GAME_PHASES.COMBAT) return false;
      return coopPreview.update(1 / 30, createInputFrame({...EMPTY_INPUT_FRAME, fire: true, selectedWeapon}));
    },
    damageCoopPlayerForTest(playerId, amount) {
      if (!TEST_MODE || coopPreview?.role !== 'host') return 0;
      return coopPreview.applyPlayerDamage(playerId, amount, 0);
    },
    setEnemyPoseForTest(enemyId, position) {
      if (!TEST_MODE || coopPreview?.role === 'guest' || !battlefield || battlefield.status[enemyId] !== ACTIVE) return false;
      if (!Number.isFinite(position?.x) || !Number.isFinite(position?.z)) return false;
      battlefield.x[enemyId] = position.x;
      battlefield.z[enemyId] = position.z;
      battlefield.companyReleaseAt[enemyId] = 0;
      return true;
    },
    pauseCoopAuthorityForTest() {
      if (!TEST_MODE || coopPreview?.role !== 'host') return false;
      paused = true;
      return coopPreview.setAuthorityPaused(true, 'test_background');
    },
    resumeCoopAuthorityForTest() {
      if (!TEST_MODE || coopPreview?.role !== 'host') return false;
      paused = false;
      return coopPreview.setAuthorityPaused(false);
    },
    damageOuterGateForTest(amount = 240) {
      if (!TEST_MODE || phase !== GAME_PHASES.DAYTIME || !run?.gates?.outer) return false;
      const gate = run.gates.outer;
      const integrity = Math.max(1, gate.integrity - Math.max(1, Number(amount) || 0));
      run = {...run, gates: {...run.gates, outer: {...gate, integrity}}};
      if (battlefield) battlefield.outerGateHp[WEST] = integrity;
      setHubFeature(HUB_FEATURE_IDS.OUTER_GATE_BRACING, {integrity, repaired: false, tier: 0});
      world.updateGateVisual('west', ratio(integrity, gate.maxIntegrity), false);
      return true;
    },
    damageHeartGateForTest(amount = 320) {
      if (!TEST_MODE || phase !== GAME_PHASES.DAYTIME || !run?.gates?.heart) return false;
      const gate = run.gates.heart;
      const integrity = Math.max(1, gate.integrity - Math.max(1, Number(amount) || 0));
      run = {...run, gates: {...run.gates, heart: {...gate, integrity}}};
      if (battlefield) battlefield.heartGateHp = integrity;
      setHubFeature(HUB_FEATURE_IDS.HEART_GATE_MASONRY, {integrity, repaired: false, tier: 0});
      world.updateGateVisual('heart', ratio(integrity, gate.maxIntegrity), false);
      return true;
    },
    frameHubForTest() {
      if (!TEST_MODE || phase !== GAME_PHASES.DAYTIME) return false;
      player.position.x = -13.8;
      player.position.y = 0;
      player.position.z = -7.2;
      player.facing.yaw = -2.64;
      player.facing.pitch = -0.045;
      return true;
    },
    frameNpcForTest(npcId) {
      if (!TEST_MODE || phase !== GAME_PHASES.DAYTIME) return false;
      const station = BRIARHOLD_FIRST_PERSON_MAP.npcSpawnPoints.find(point => point.npcId === npcId);
      if (!station) return false;
      const distance = 2.8;
      player.position.x = station.position.x + Math.sin(station.facing) * distance;
      player.position.y = station.position.y;
      player.position.z = station.position.z + Math.cos(station.facing) * distance;
      player.velocity.x = 0;
      player.velocity.y = 0;
      player.velocity.z = 0;
      player.facing.yaw = station.facing + Math.PI;
      player.facing.pitch = -0.045;
      return true;
    },
    frameHubStationForTest(stationId) {
      if (!TEST_MODE || phase !== GAME_PHASES.DAYTIME) return false;
      const station = hubStationById(stationId);
      if (!station) return false;
      const distance = Math.min(1.5, station.interactionRadius * 0.6);
      player.position.x = station.position.x + Math.sin(station.facing) * distance;
      player.position.y = station.position.y;
      player.position.z = station.position.z + Math.cos(station.facing) * distance;
      player.velocity.x = 0;
      player.velocity.y = 0;
      player.velocity.z = 0;
      player.facing.yaw = station.facing + Math.PI;
      player.facing.pitch = -0.045;
      return nearestHubStation()?.station?.id === stationId;
    },
    framePoseForTest({position: nextPosition, facing: nextFacing} = {}) {
      if (!TEST_MODE || phase === GAME_PHASES.MENU) return false;
      const values = [nextPosition?.x, nextPosition?.y, nextPosition?.z, nextFacing?.yaw, nextFacing?.pitch];
      if (!values.every(Number.isFinite)) return false;
      player.position.x = nextPosition.x;
      player.position.y = nextPosition.y;
      player.position.z = nextPosition.z;
      player.velocity.x = 0;
      player.velocity.y = 0;
      player.velocity.z = 0;
      player.facing.yaw = nextFacing.yaw;
      player.facing.pitch = nextFacing.pitch;
      return true;
    },
    frameCourtyardDefenceForTest() {
      if (!TEST_MODE || phase !== GAME_PHASES.COMBAT) return false;
      player.position.x = -13.8;
      player.position.y = 0;
      player.position.z = -7.2;
      player.velocity.x = 0;
      player.velocity.y = 0;
      player.velocity.z = 0;
      player.facing.yaw = -2.64;
      player.facing.pitch = -0.045;
      return true;
    },
    frameGateForTest() {
      if (!TEST_MODE || phase !== GAME_PHASES.DAYTIME) return false;
      player.position.x = -16;
      player.position.y = 0;
      player.position.z = -13;
      player.facing.yaw = 0;
      player.facing.pitch = 0;
      return true;
    },
    frameFieldForTest() {
      if (!TEST_MODE || phase === GAME_PHASES.MENU) return false;
      player.position.x = -16;
      player.position.y = 0;
      player.position.z = 13.5;
      player.velocity.x = 0;
      player.velocity.y = 0;
      player.velocity.z = 0;
      player.grounded = true;
      player.facing.yaw = 0;
      player.facing.pitch = -0.045;
      return true;
    },
    frameRampartForTest() {
      if (!TEST_MODE || phase !== GAME_PHASES.COMBAT) return false;
      player.position.x = -16;
      // The lower West Gate overlook is the authored first-person firing
      // vista. The previous acceptance pose sat on the upper roof behind the
      // gatehouse arch, making a healthy advancing company look like distant
      // black pins instead of readable individual enemies.
      player.position.y = 3.5;
      player.position.z = 20.6;
      player.velocity.x = 0;
      player.velocity.y = 0;
      player.velocity.z = 0;
      player.grounded = true;
      player.facing.yaw = 0;
      player.facing.pitch = -0.08;
      return true;
    },
    fortifyPlayerForTest() {
      if (!TEST_MODE || phase !== GAME_PHASES.COMBAT) return false;
      player.maxHp = Math.max(player.maxHp, 100_000);
      player.hp = player.maxHp;
      return true;
    },
    advanceCombatForTest(seconds = 1) {
      if (!TEST_MODE || phase !== GAME_PHASES.COMBAT || !battlefield) return false;
      const ticks = Math.max(0, Math.min(30 * 90, Math.round((Number(seconds) || 0) * 30)));
      for (let tick = 0; tick < ticks
        && phase === GAME_PHASES.COMBAT
        && run?.phase === GAME_PHASES.COMBAT; tick += 1) {
        updateCombat(EMPTY_INPUT_FRAME, 1 / 30, performance.now() / 1000, {coopAuthority: coopPreview?.role === 'host' && coopPreview.connected});
      }
      return true;
    },
    advanceRecoveryForTest(seconds = 1) {
      if (!TEST_MODE || phase !== GAME_PHASES.INTERWAVE_RECOVERY || !run) return false;
      const requestedTicks = Math.max(0, Math.min(30 * 15, Math.round((Number(seconds) || 0) * 30)));
      const ticksBeforeLiveBoundary = Math.max(0, Math.floor(
        ((run.recovery?.remainingMs ?? 0) - 500) / (1000 / 30),
      ));
      const ticks = Math.min(requestedTicks, ticksBeforeLiveBoundary);
      for (let tick = 0; tick < ticks
        && phase === GAME_PHASES.INTERWAVE_RECOVERY
        && run?.phase === GAME_PHASES.INTERWAVE_RECOVERY
        && !wavePreparationPending; tick += 1) {
        updateRecovery(1 / 30);
      }
      return true;
    },
    frameHubFeatureForTest(featureId) {
      if (!TEST_MODE || phase !== GAME_PHASES.DAYTIME) return false;
      const profile = {
        // Keep acceptance evidence in the open courtyard instead of placing
        // the camera directly under the gatehouse walk. The oblique views
        // retain the repaired feature and its station landmark in frame while
        // avoiding misleading underside/interior geometry.
        heart: {x: -15.5, z: -10.8, yaw: 1.92, pitch: -0.04},
        quartermaster: {x: -8.5, z: -8.8, yaw: 1.46, pitch: -0.05},
        greenwarden: {x: -14, z: -18.5, yaw: -2.42, pitch: -0.04},
      }[featureId];
      if (!profile) return false;
      player.position.x = profile.x;
      player.position.y = 0;
      player.position.z = profile.z;
      player.facing.yaw = profile.yaw;
      player.facing.pitch = profile.pitch;
      return true;
    },
    advanceHubMilestoneForTest(clearedWaves) {
      if (!TEST_MODE || phase !== GAME_PHASES.DAYTIME) return false;
      const milestone = Math.max(0, Math.min(3, Math.trunc(Number(clearedWaves) || 0)));
      enterDaytime(true);
      return true;
    },
    failRun: failCurrentRun,
    togglePause,
    openPlaytestReporter() { return playtestReporter?.open() ?? false; },
  },
};
