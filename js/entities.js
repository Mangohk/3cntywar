/** Units, buildings, projectiles. */

import { getCardDef } from "./cards.js";
import {
  LANE_CENTER_X,
  SIDE,
  constrainCrossingX,
  createBuildingBlueprints,
  laneFromX,
} from "./board.js";

let nextEntityId = 1;

export function resetEntityIds() {
  nextEntityId = 1;
}

export function createBuildings() {
  return createBuildingBlueprints().map((bp) => ({
    ...bp,
    entityType: "building",
    maxHp: bp.hp,
    alive: true,
    attackCooldown: Math.random() * 0.4,
    targetId: null,
  }));
}

/**
 * @param {string} cardId
 * @param {'player'|'enemy'} side
 * @param {number} x
 * @param {number} y
 */
export function spawnUnit(cardId, side, x, y) {
  const def = getCardDef(cardId);
  const lane = laneFromX(x);
  return {
    id: nextEntityId++,
    entityType: "unit",
    cardId,
    name: def.name,
    glyph: def.glyph,
    color: def.color,
    side,
    lane,
    x: LANE_CENTER_X[lane] + (x - LANE_CENTER_X[lane]) * 0.35,
    y,
    radius: 0.028,
    hp: def.hp,
    maxHp: def.hp,
    damage: def.damage,
    attackSpeedSec: def.attackSpeedSec,
    range: def.range,
    sightRange: def.sightRange,
    moveSpeed: def.moveSpeed,
    targetPreference: def.targetPreference,
    splashRadius: def.splashRadius || 0,
    traits: def.traits || [],
    alive: true,
    attackCooldown: 0,
    targetId: null,
    facing: side === SIDE.PLAYER ? 1 : -1,
  };
}

export function spawnProjectile(from, to, damage, splashRadius = 0, color = "#ffe08a") {
  return {
    id: nextEntityId++,
    entityType: "projectile",
    side: from.side,
    x: from.x,
    y: from.y,
    tx: to.x,
    ty: to.y,
    targetId: to.id,
    damage,
    splashRadius,
    speed: 0.9,
    color,
    alive: true,
    lane: from.lane ?? to.lane ?? null,
  };
}

export function updateUnitMovement(unit, dt) {
  if (!unit.alive || unit.attacking) return;

  const dir = unit.side === SIDE.PLAYER ? 1 : -1;
  let nextY = unit.y + dir * unit.moveSpeed * dt;
  nextY = Math.max(0.04, Math.min(0.96, nextY));
  unit.y = nextY;
  unit.x = constrainCrossingX(unit.x, unit.lane, unit.y);
}

export function updateProjectile(p, dt) {
  if (!p.alive) return false;
  const dx = p.tx - p.x;
  const dy = p.ty - p.y;
  const d = Math.hypot(dx, dy) || 1;
  const step = p.speed * dt;
  if (step >= d) {
    p.x = p.tx;
    p.y = p.ty;
    p.alive = false;
    return true; // impact
  }
  p.x += (dx / d) * step;
  p.y += (dy / d) * step;
  return false;
}
