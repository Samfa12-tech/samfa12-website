/** Serializable domain objects only. No Babylon, DOM or AudioNodes in a save. */
export interface Vec {
    x: number;
    y: number;
    z: number;
}
export type SiteId = 'gardens' | 'passage' | 'mangrove' | 'cenote' | 'harbour';
export type Action = 'forward' | 'back' | 'left' | 'right' | 'up' | 'down' | 'boost' | 'steady' | 'interact' | 'spear' | 'scooter' | 'pause' | 'journal' | 'light' | 'watch';
export type PadAxis = 'moveX' | 'moveZ' | 'lookX' | 'lookY';
export type PadAction = 'spear' | 'interact' | 'up' | 'down' | 'scooter' | 'steady' | 'boost' | 'pause' | 'light' | 'journal' | 'watch' | 'menuConfirm' | 'menuBack' | 'menuPrevious' | 'menuNext';
export interface PadAxisBinding { index: number; sign: 1 | -1 }
export interface PadAxisButtonBinding { index: number; value: number }
export interface GamepadProfile {
    key: string;
    id: string;
    mapping: string;
    axisCount: number;
    buttonCount: number;
    axes: Record<PadAxis, PadAxisBinding>;
    centers: number[];
    buttons: Partial<Record<PadAction, number>>;
    axisButtons: Partial<Record<PadAction, PadAxisButtonBinding>>;
    moveDeadzone: number;
    lookDeadzone: number;
}
export interface Settings {
    quality: 'high' | 'balanced' | 'low';
    performancePromptDismissed?: boolean;
    music: number;
    ambience: number;
    effects: number;
    sensitivity: number;
    invertY: boolean;
    reducedMotion: boolean;
    assist: boolean;
    toggleDraw: boolean;
    fov: number;
    touchScale: number;
    /** Optional diegetic dive-watch instruments; old settings enable them by default. */
    instrumentHud?: boolean;
    keys: Record<Action, string>;
    /** Optional device-specific browser mapping. Kept outside schema-1 career saves. */
    gamepads?: Record<string, GamepadProfile>;
}
export interface ReefProgress {
    removed: string[];
    cleaned: string[];
    restored: Record<string, number>;
    visits: number;
    /** Completed visits with at least one lionfish removal. Optional in schema-1 legacy saves. */
    productiveVisits?: number;
    surveys: number;
    /** Stable field stations with at least one recorded survey; supports diminishing repeat pay. */
    surveyedStations?: string[];
    lastDay: number;
}
export interface CampaignState {
    researchInvitationSeen: boolean;
    researchAccepted: boolean;
    researchCompleted: boolean;
    characterFlags: string[];
    milestoneFlags: string[];
    activeOpportunity?: 'recognition-80' | 'recognition-160' | 'recognition-300';
    activeOpportunityDay?: number;
    activeOpportunityPublishedAt?: number;
    activeOpportunityCleanedAt?: number;
}
export interface Profile {
    version: 1;
    slot: number;
    day: number;
    cash: number;
    debt: number;
    reputation: number;
    audience: number;
    totalRemoved: number;
    totalCleaned: number;
    totalRestored: number;
    upgrades: string[];
    upgradeLevels?: Record<string, number>;
    reefs: Record<SiteId, ReefProgress>;
    records: {
        day: number;
        site: SiteId;
        score: number;
        catch: number;
        clean: number;
    }[];
    published: string[];
    discoveries: string[];
    charms?: string[];
    equippedCharm?: string;
    tutorial: number;
    sponsorPaidDay: number;
    lastReport: string;
    active: Run | null;
    pending: Run | null;
    /** Optional schema-1 campaign extension; omitted by older saves. */
    campaign?: CampaignState;
    /** Day on which the player registered for the current local event. */
    eventRegistrationDay?: number;
}
export interface Rock {
    id: string;
    p: Vec;
    s: Vec;
    tint: number;
    hidden?: boolean;
    form?: 'rock' | 'root' | 'limestone' | 'piling' | 'container';
}
export interface Fish {
    id: string;
    p: Vec;
    home: Vec;
    size: number;
    weight: number;
    alive: boolean;
    phase: number;
    flee: number;
}
export interface Job {
    id: string;
    kind: 'debris' | 'coral' | 'survey' | 'charm' | 'outbreak';
    p: Vec;
    done: boolean;
    progress: number;
    stage: number;
}
export interface Animal {
    id: 'marlow' | 'moray' | 'turtle' | 'ray' | 'shark';
    p: Vec;
    home: Vec;
    heading: number;
    state: 'roam' | 'watch' | 'approach' | 'warn' | 'lunge' | 'retreat';
    timer: number;
    cooldown: number;
    phase: number;
}
export interface Catch {
    size?: number;
    phase?: number;
    struckAt?: number;
    struckPosition?: Vec;
    id: string;
    weight: number;
    value: number;
}
export interface Highlight {
    id: string;
    kind: string;
    title: string;
    detail: string;
    quality: number;
    image?: string;
    chosen: boolean;
}
export interface Run {
    id: string;
    site: SiteId;
    /** Optional authored-geometry revision; omitted legacy Passage runs retain revision 1. */
    siteRevision?: number;
    /** Ecology captured at outing start; stays fixed while this outing is in progress. */
    recoveryStage?: number;
    seed: number;
    day: number;
    time: number;
    p: Vec;
    velocity: Vec;
    yaw: number;
    pitch: number;
    air: number;
    health: number;
    battery: number;
    cargo: Catch[];
    exposed: Catch | null;
    skewered?: Catch[];
    transfer?: { catches: Catch[]; started: number };
    expedition?: boolean;
    boatDistance?: number;
    maskFlood?: number;
    droplets?: number;
    scalingPasses?: number[];
    cooking?: {recipe: string; quality: number; complete: boolean};
    treated?: number;
    fish: Fish[];
    jobs: Job[];
    animals: Animal[];
    clips: Highlight[];
    removed: number;
    cleaned: number;
    restored: number;
    surveyed: number;
    nativeHits: number;
    coralHits: number;
    stolen: number;
    distance: number;
    fragments: number;
    charge: number;
    strikeCooldown: number;
    hurtCooldown: number;
    interaction: number;
    interactionId: string;
    scooter: boolean;
    light: boolean;
    returnWarn: boolean;
    lowWarn: boolean;
    finished: boolean;
    rescued: boolean;
    order: 'catch' | 'cleanup' | 'restore' | 'research' | 'none';
    night?: boolean;
    filletQuality?: number;
    event: boolean;
    notices: string[];
    seen: string[];
    cooldowns: Record<string, number>;
    practice?: boolean;
    lesson?: { step: number; look: number; move: number; drawn: boolean; skipped?: boolean };
    eventTheme?: 'catch' | 'cleanup' | 'research';
    eventRegistrationDay?: number;
    contractReadyNotified?: boolean;
    encounter?: {
        kind: 'rubbish' | 'fishing';
        phase: 'warning' | 'active' | 'abandoned' | 'cleared' | 'passed';
        start: number;
        p: Vec;
        cleanProgress: number;
        rewarded: boolean;
    };
    researchEligible?: boolean;
    /** True for the first funded assignment; false for repeat monitoring contracts. */
    researchFunded?: boolean;
    /** Stations recorded this outing; prevents repeat work from stacking within one dive. */
    surveyStations?: string[];
    surveyFirstVisits?: string[];
    filletCuts?: number[];
}
export interface Site {
    id: SiteId;
    name: string;
    /** Short selector-facing name. Legacy sites may omit this and use `name`. */
    label?: string;
    eyebrow: string;
    description: string;
    /** One-line selector copy. */
    shortDescription?: string;
    biome?: 'mangrove' | 'cenote' | 'harbour';
    waterColor?: number;
    sandColor?: number;
    /** X position of the strongest local channel current. */
    channelX?: number;
    surface: number;
    radius: number;
    seed: number;
    entry: Vec;
    current: number;
    rocks: Rock[];
    landmarks: {
        name: string;
        p: Vec;
        kind: string;
    }[];
    /** Authored work positions. IDs are stable within this reef's save record. */
    worksites?: {
        debris: Vec[];
        coral: Vec[];
        surveys: Vec[];
    };
    /** Site-specific deep survey structure locations; y is recomputed from terrain. */
    deepFeatures?: { wreck: Vec; outfall: Vec };
}
export interface InputFrame {
    moveX: number;
    moveZ: number;
    vertical: number;
    lookX: number;
    lookY: number;
    boost: boolean;
    steady: boolean;
    draw: boolean;
    release: boolean;
    cancelDraw: boolean;
    interact: boolean;
}
export interface GameEvent {
    type: 'notice' | 'sound' | 'highlight' | 'finish' | 'work' | 'hit' | 'save';
    text?: string;
    value?: string;
    id?: string;
}
export interface Aim {
    kind: 'fish' | 'job' | 'animal' | 'boat' | 'none';
    id: string;
    distance: number;
    label: string;
    hint: string;
    valid: boolean;
}
