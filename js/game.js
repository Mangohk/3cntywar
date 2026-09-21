/** Match state machine and simulation. */

import {
  CARD_DEFS,
  MATCH_TIME_LIMIT,
  QI_MAX,
  QI_REGEN_SEC,
  QI_REGEN_SUDDEN_SEC,
  QI_START,
  SUDDEN_DEATH_AT,
  createHandState,
  getCardDef,
  playCardFromHand,
} from "./cards.js";
import { SIDE, canDeployAt } from "./board.js";
import {
  createBuildings,
  resetEntityIds,
  spawnCardUnits,
  updateProjectile,
  updateUnitMovement,
} from "./entities.js";
import { resolveProjectileImpact, tickAttacker } from "./combat.js";
import { createAIState, updateAI } from "./ai.js";
import { formatOutcomeFromCamps } from "./ui.js";

export const Phase = {
  TITLE: "TITLE",
  MATCH_RUNNING: "MATCH_RUNNING",
  MATCH_OVER: "MATCH_OVER",
};

export function createGame() {
  return {
    phase: Phase.TITLE,
    match: null,
    selectedHandIndex: null,
  };
}

export function startMatch(game) {
  resetEntityIds();
  game.phase = Phase.MATCH_RUNNING;
  game.selectedHandIndex = null;
  game.match = {
    time: 0,
    suddenDeath: false,
    playerQi: QI_START,
    enemyQi: QI_START,
    playerHand: createHandState(),
    enemyHand: createHandState(),
    buildings: createBuildings(),
    units: [],
    projectiles: [],
    ai: createAIState(),
    deployPreview: null,
    flashInvalid: null,
    outcome: null,
    // Ensure deck uses all 8 cards (sanity)
    rosterSize: CARD_DEFS.length,
  };
  return game.match;
}

export function returnToTitle(game) {
  game.phase = Phase.TITLE;
  game.match = null;
  game.selectedHandIndex = null;
}

export function selectHandCard(game, index) {
  if (game.phase !== Phase.MATCH_RUNNING) return;
  const match = game.match;
  const cardId = match.playerHand.hand[index];
  const cost = getCardDef(cardId).cost;
  if (cost > match.playerQi) return;
  game.selectedHandIndex = game.selectedHandIndex === index ? null : index;
}

/**
 * Attempt deploy for player or AI.
 * For player, uses selectedHandIndex unless handIndex provided.
 */
export function tryDeploy(game, side, x, y, handIndex = null) {
  const match = game.match;
  if (!match || game.phase !== Phase.MATCH_RUNNING) return false;
  if (!canDeployAt(side, x, y)) {
    if (side === SIDE.PLAYER) {
      match.flashInvalid = { x, y, t: 0.35 };
    }
    return false;
  }

  const handState = side === SIDE.PLAYER ? match.playerHand : match.enemyHand;
  const idx = side === SIDE.PLAYER ? (handIndex ?? game.selectedHandIndex) : handIndex;
  if (idx == null || idx < 0) return false;

  const cardId = handState.hand[idx];
  const def = getCardDef(cardId);
  const qiKey = side === SIDE.PLAYER ? "playerQi" : "enemyQi";
  if (match[qiKey] < def.cost) return false;

  match[qiKey] -= def.cost;
  playCardFromHand(handState, idx);
  match.units.push(...spawnCardUnits(cardId, side, x, y));

  if (side === SIDE.PLAYER) {
    game.selectedHandIndex = null;
    match.deployPreview = null;
  }
  return true;
}

export function updateMatch(game, dt) {
  const match = game.match;
  if (!match || game.phase !== Phase.MATCH_RUNNING) return;

  const clamped = Math.min(dt, 0.05);
  match.time += clamped;

  if (!match.suddenDeath && match.time >= SUDDEN_DEATH_AT) {
    match.suddenDeath = true;
  }

  const regen = match.suddenDeath ? QI_REGEN_SUDDEN_SEC : QI_REGEN_SEC;
  match.playerQi = Math.min(QI_MAX, match.playerQi + clamped / regen);
  match.enemyQi = Math.min(QI_MAX, match.enemyQi + clamped / regen);

  if (match.flashInvalid) {
    match.flashInvalid.t -= clamped;
    if (match.flashInvalid.t <= 0) match.flashInvalid = null;
  }

  updateAI(match, clamped, (cardId, side, x, y, handIndex) => {
    tryDeploy(game, side, x, y, handIndex);
  });

  // Combat ticks (chase when target out of range; otherwise march forward)
  const newProjectiles = [];
  for (const u of match.units) {
    if (!u.alive) continue;
    const shots = tickAttacker(u, clamped, match.units, match.buildings);
    newProjectiles.push(...shots);
    if (!u.attacking && u.targetId == null) {
      updateUnitMovement(u, clamped);
    }
  }
  for (const b of match.buildings) {
    if (!b.alive) continue;
    newProjectiles.push(...tickAttacker(b, clamped, match.units, match.buildings));
  }

  match.projectiles.push(...newProjectiles);

  for (const p of match.projectiles) {
    const hit = updateProjectile(p, clamped);
    if (hit) resolveProjectileImpact(p, match.units, match.buildings);
  }

  match.units = match.units.filter((u) => u.alive);
  match.projectiles = match.projectiles.filter((p) => p.alive);

  const playerMain = match.buildings.find((b) => b.id === "player-main");
  const enemyMain = match.buildings.find((b) => b.id === "enemy-main");

  if (!enemyMain.alive) {
    endMatch(game, "win");
    return;
  }
  if (!playerMain.alive) {
    endMatch(game, "lose");
    return;
  }
  if (match.time >= MATCH_TIME_LIMIT) {
    endMatch(game, formatOutcomeFromCamps(playerMain, enemyMain));
  }
}

function endMatch(game, outcome) {
  game.phase = Phase.MATCH_OVER;
  game.match.outcome = outcome;
  game.selectedHandIndex = null;
}
