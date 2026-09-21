/** Card definitions and deck/hand cycle for v0.1. */

export const QI_MAX = 10;
export const QI_START = 5;
export const QI_REGEN_SEC = 2.8;
export const QI_REGEN_SUDDEN_SEC = 1.4;
export const SUDDEN_DEATH_AT = 90;
export const MATCH_TIME_LIMIT = 180;

/** @typedef {'any' | 'buildings' | 'troops'} TargetPreference */

/**
 * @typedef {Object} CardDef
 * @property {string} id
 * @property {string} name
 * @property {string} nameEn
 * @property {number} cost
 * @property {string} role
 * @property {number} count how many units spawn on one deploy (≥ 1)
 * @property {number} hp
 * @property {number} damage
 * @property {number} attackSpeedSec
 * @property {number} range attack reach
 * @property {number} sightRange how far the troop can notice enemies
 * @property {number} moveSpeed
 * @property {TargetPreference} targetPreference
 * @property {number} [splashRadius]
 * @property {string[]} [traits]
 * @property {string} color
 * @property {string} glyph
 */

/** @type {CardDef[]} */
export const CARD_DEFS = [
  {
    id: "militia",
    name: "步兵",
    nameEn: "Militia",
    cost: 2,
    role: "Swarm",
    count: 3,
    hp: 220,
    damage: 42,
    attackSpeedSec: 1.15,
    range: 0.035,
    sightRange: 0.22,
    moveSpeed: 0.085,
    targetPreference: "any",
    color: "#6f9f78",
    glyph: "兵",
  },
  {
    id: "crossbow",
    name: "弓手",
    nameEn: "Crossbowmen",
    cost: 3,
    role: "Ranged",
    count: 2,
    hp: 160,
    damage: 48,
    attackSpeedSec: 0.95,
    range: 0.26,
    sightRange: 0.34,
    moveSpeed: 0.065,
    targetPreference: "any",
    color: "#7aadcf",
    glyph: "弓",
  },
  {
    id: "cavalry",
    name: "骑兵",
    nameEn: "Cavalry",
    cost: 4,
    role: "Fast melee",
    count: 1,
    hp: 340,
    damage: 72,
    attackSpeedSec: 1.05,
    range: 0.035,
    sightRange: 0.28,
    moveSpeed: 0.145,
    targetPreference: "any",
    traits: ["fast"],
    color: "#c9a14a",
    glyph: "骑",
  },
  {
    id: "spearman",
    name: "枪兵",
    nameEn: "Spearman",
    cost: 3,
    role: "Anti-cavalry",
    count: 2,
    hp: 300,
    damage: 58,
    attackSpeedSec: 1.15,
    range: 0.045,
    sightRange: 0.24,
    moveSpeed: 0.07,
    targetPreference: "any",
    traits: ["anti_cavalry"],
    color: "#8fbf6a",
    glyph: "枪",
  },
  {
    id: "zhuge",
    name: "诸葛亮",
    nameEn: "Zhuge Liang",
    cost: 5,
    role: "Support AoE",
    count: 1,
    hp: 240,
    damage: 78,
    attackSpeedSec: 1.45,
    range: 0.24,
    sightRange: 0.38,
    moveSpeed: 0.05,
    targetPreference: "any",
    splashRadius: 0.09,
    color: "#5eb0a8",
    glyph: "亮",
  },
  {
    id: "guan",
    name: "关羽",
    nameEn: "Guan Yu",
    cost: 5,
    role: "Elite melee",
    count: 1,
    hp: 780,
    damage: 125,
    attackSpeedSec: 1.25,
    range: 0.04,
    sightRange: 0.26,
    moveSpeed: 0.072,
    targetPreference: "any",
    color: "#d4543a",
    glyph: "羽",
  },
  {
    id: "zhang",
    name: "张飞",
    nameEn: "Zhang Fei",
    cost: 4,
    role: "Bruiser splash",
    count: 1,
    hp: 560,
    damage: 95,
    attackSpeedSec: 1.35,
    range: 0.04,
    sightRange: 0.25,
    moveSpeed: 0.068,
    targetPreference: "any",
    splashRadius: 0.065,
    color: "#9b5fd4",
    glyph: "飞",
  },
  {
    id: "catapult",
    name: "投石车",
    nameEn: "Catapult",
    cost: 6,
    role: "Siege",
    count: 1,
    hp: 320,
    damage: 165,
    attackSpeedSec: 2.1,
    range: 0.238,
    sightRange: 0.45,
    moveSpeed: 0.035,
    targetPreference: "buildings",
    color: "#a8896a",
    glyph: "石",
  },
];

export function getCardDef(id) {
  const card = CARD_DEFS.find((c) => c.id === id);
  if (!card) throw new Error(`Unknown card: ${id}`);
  return card;
}

export function createStarterDeck() {
  return CARD_DEFS.map((c) => c.id);
}

/**
 * Clash Royale–style cycle: hand of 4, remaining cards form the draw pile order.
 * After play, the played card goes to the end of the cycle.
 */
export function createHandState(deckIds = createStarterDeck()) {
  const shuffled = shuffle([...deckIds]);
  return {
    hand: shuffled.slice(0, 4),
    cycle: shuffled.slice(4),
  };
}

export function playCardFromHand(handState, handIndex) {
  if (handIndex < 0 || handIndex >= handState.hand.length) return null;
  const playedId = handState.hand[handIndex];
  const nextId = handState.cycle.shift();
  handState.hand[handIndex] = nextId;
  handState.cycle.push(playedId);
  return playedId;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
