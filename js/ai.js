/** Dumb but playable AI opponent (Wei). */

import { getCardDef } from "./cards.js";
import { LANE, LANE_CENTER_X, SIDE, canDeployAt } from "./board.js";

export function createAIState() {
  return {
    thinkTimer: 3.0,
    reserveQi: 6,
  };
}

/**
 * @param {object} match
 * @param {number} dt
 * @param {(cardId: string, side: string, x: number, y: number) => boolean} deployFn
 */
export function updateAI(match, dt, deployFn) {
  const ai = match.ai;
  ai.thinkTimer -= dt;
  if (ai.thinkTimer > 0) return;
  // Keep the AI as a light punching bag: slow early, modest later.
  ai.thinkTimer = match.time < 40 ? 2.2 + Math.random() * 1.6 : 1.3 + Math.random() * 1.2;

  if (match.enemyQi < ai.reserveQi && match.enemyQi < 7) {
    const cheap = affordableCards(match.enemyHand.hand, match.enemyQi).filter(
      (c) => getCardDef(c).cost <= 3
    );
    if (!cheap.length) return;
  }

  const affordable = affordableCards(match.enemyHand.hand, match.enemyQi).filter((id) => {
    if (match.time < 35 && (id === "guan" || id === "zhuge" || id === "catapult" || id === "zhang")) {
      return false;
    }
    return true;
  });
  if (!affordable.length) return;

  // Cap concurrent enemy pressure.
  const enemyCount = match.units.filter((u) => u.alive && u.side === SIDE.ENEMY).length;
  if (enemyCount >= 4) return;

  const lane = chooseLane(match);
  const cardId = chooseCard(match, affordable, lane);
  if (!cardId) return;

  const handIndex = match.enemyHand.hand.indexOf(cardId);
  const x = LANE_CENTER_X[lane] + (Math.random() - 0.5) * 0.08;
  const y = 0.62 + Math.random() * 0.12;
  if (!canDeployAt(SIDE.ENEMY, x, y)) return;

  deployFn(cardId, SIDE.ENEMY, x, y, handIndex);
}

function affordableCards(hand, qi) {
  return hand.filter((id) => getCardDef(id).cost <= qi);
}

function chooseLane(match) {
  const playerHp = [0, 0];
  for (const u of match.units) {
    if (!u.alive || u.side !== SIDE.PLAYER) continue;
    playerHp[u.lane] += u.hp;
  }

  // Prefer the lane where player has more HP (reactive defense / contest).
  if (playerHp[LANE.LEFT] !== playerHp[LANE.RIGHT]) {
    return playerHp[LANE.LEFT] > playerHp[LANE.RIGHT] ? LANE.LEFT : LANE.RIGHT;
  }

  // If an outpost is under attack, reinforce that lane.
  const threatened = threatenedLane(match);
  if (threatened != null) return threatened;

  return Math.random() < 0.5 ? LANE.LEFT : LANE.RIGHT;
}

function threatenedLane(match) {
  for (const b of match.buildings) {
    if (!b.alive || b.side !== SIDE.ENEMY || b.kind !== "outpost") continue;
    if (b.hp < b.maxHp * 0.55) return b.lane;
  }
  return null;
}

function chooseCard(match, affordable, lane) {
  const threatened = threatenedLane(match) === lane;
  const weights = affordable.map((id) => {
    const def = getCardDef(id);
    let w = 1;
    if (threatened && (id === "catapult" || id === "guan" || id === "zhang" || id === "zhuge")) {
      w += 3;
    }
    if (id === "militia") w += 0.8;
    if (id === "catapult" && match.time > 40) w += 1.2;
    if (def.cost <= match.enemyQi - 1) w += 0.4;
    return w;
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < affordable.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return affordable[i];
  }
  return affordable[0];
}
