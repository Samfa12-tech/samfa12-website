export const BRIARBOUND = 0;
export const BARKHIDE_BRUTE = 1;
export const MOSSGUARD_SHIELD = 2;
export const SPOREWING = 3;
export const ROOT_SAPPER = 4;
export const WICKER_COLOSSUS = 5;
export const HOLLOW_HART = 6;
// Moonwraiths are ordinary spectral crowd actors. New campaign bosses stay in
// the fixed-actor director and therefore deliberately have no crowd type ID.
export const MOONWRAITH = 7;

export const ENEMY_TYPE_COUNT = 8;

const ARCHETYPES = Object.freeze([
  Object.freeze({
    id: BRIARBOUND,
    key: "briarbound",
    name: "Briarbound",
    maxHp: 45,
    speed: 8,
    radius: 0.66,
    mass: 1,
    attackDamage: 4,
    attackInterval: 0.9,
    armour: "infantry",
    breachEligible: true,
    specialized: false
  }),
  Object.freeze({
    id: BARKHIDE_BRUTE,
    key: "barkhide-brute",
    name: "Barkhide Brute",
    maxHp: 150,
    speed: 5.2,
    radius: 0.98,
    mass: 4,
    attackDamage: 11,
    attackInterval: 1.25,
    armour: "siege",
    breachEligible: true,
    specialized: false
  }),
  Object.freeze({
    id: MOSSGUARD_SHIELD,
    key: "mossguard-shield",
    name: "Mossguard Shield",
    maxHp: 95,
    speed: 6.2,
    radius: 0.76,
    mass: 1.45,
    attackDamage: 6,
    attackInterval: 1,
    armour: "shield",
    breachEligible: true,
    specialized: false
  }),
  Object.freeze({
    id: SPOREWING,
    key: "sporewing",
    name: "Sporewing",
    maxHp: 35,
    speed: 11,
    radius: 0.55,
    mass: 0.6,
    attackDamage: 3,
    attackInterval: 0.55,
    armour: "swarm",
    breachEligible: false,
    specialized: true,
    flying: true
  }),
  Object.freeze({
    id: ROOT_SAPPER,
    key: "root-sapper",
    name: "Root-Sapper",
    maxHp: 65,
    speed: 7,
    radius: 0.63,
    mass: 0.9,
    attackDamage: 24,
    attackInterval: 1.5,
    armour: "siege",
    breachEligible: false,
    specialized: true
  }),
  Object.freeze({
    id: WICKER_COLOSSUS,
    key: "wicker-colossus",
    name: "Wicker Colossus",
    maxHp: 700,
    speed: 2.8,
    radius: 1.8,
    mass: 14,
    attackDamage: 38,
    attackInterval: 1.8,
    armour: "siege",
    breachEligible: false,
    specialized: true
  }),
  Object.freeze({
    id: HOLLOW_HART,
    key: "hollow-hart",
    name: "The Hollow Hart",
    maxHp: 2400,
    speed: 3.5,
    radius: 2.1,
    mass: 20,
    attackDamage: 55,
    attackInterval: 1.6,
    armour: "siege",
    breachEligible: false,
    specialized: true,
    boss: true
  }),
  Object.freeze({
    id: MOONWRAITH,
    key: "moonwraith",
    name: "Moonwraith",
    maxHp: 58,
    speed: 7.4,
    radius: 0.62,
    mass: 0.85,
    attackDamage: 7,
    attackInterval: 1.1,
    armour: "spectral",
    breachEligible: true,
    specialized: false,
    spectral: true
  })
]);

const TYPE_BY_KEY = new Map(ARCHETYPES.map((archetype) => [archetype.key, archetype.id]));

export function isEnemyType(type) {
  return Number.isInteger(type) && type >= 0 && type < ENEMY_TYPE_COUNT;
}

export function enemyTypeFrom(value, fallback = BRIARBOUND) {
  if (isEnemyType(value)) return value;
  if (typeof value === "string" && TYPE_BY_KEY.has(value)) return TYPE_BY_KEY.get(value);
  return isEnemyType(fallback) ? fallback : BRIARBOUND;
}

export function enemyArchetype(type) {
  return ARCHETYPES[enemyTypeFrom(type)];
}

export function enemyArmour(type) {
  return enemyArchetype(type).armour;
}

export function isBreachEligible(type) {
  return enemyArchetype(type).breachEligible;
}

export function isSpecializedEnemy(type) {
  return enemyArchetype(type).specialized;
}

export function enemyArchetypes() {
  return ARCHETYPES;
}
