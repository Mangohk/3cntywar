/** Targeting and damage resolution. */

import { SIDE, constrainCrossingX, dist } from "./board.js";
import { spawnProjectile } from "./entities.js";

export function sameLaneOrBuilding(attacker, target) {
  if (!target || !target.alive) return false;
  if (target.entityType === "building") {
    // Main camps can be hit from either lane; outposts only from their lane.
    if (target.kind === "main") return true;
    return target.lane === attacker.lane;
  }
  return target.lane === attacker.lane;
}

export function isValidTarget(attacker, target) {
  if (!target || !target.alive) return false;
  if (target.side === attacker.side) return false;
  if (!sameLaneOrBuilding(attacker, target)) return false;

  const pref = attacker.targetPreference || "any";
  if (pref === "buildings" && target.entityType !== "building") {
    // Still allow troops if no building in range later; preference handled in scoring.
  }
  if (pref === "troops" && target.entityType === "building") return false;
  return true;
}

function targetScore(attacker, target) {
  const d = dist(attacker.x, attacker.y, target.x, target.y);
  let score = d;
  const pref = attacker.targetPreference || "any";
  if (pref === "buildings" && target.entityType === "building") score -= 0.35;
  if (pref === "buildings" && target.entityType === "unit") score += 0.25;
  return score;
}

export function findNearestTarget(attacker, units, buildings) {
  let best = null;
  let bestScore = Infinity;
  for (const u of units) {
    if (!isValidTarget(attacker, u)) continue;
    const s = targetScore(attacker, u);
    if (s < bestScore) {
      bestScore = s;
      best = u;
    }
  }
  for (const b of buildings) {
    if (!isValidTarget(attacker, b)) continue;
    const s = targetScore(attacker, b);
    if (s < bestScore) {
      bestScore = s;
      best = b;
    }
  }
  return best;
}

export function computeDamage(attacker, target) {
  let dmg = attacker.damage;
  if (
    attacker.traits?.includes("anti_cavalry") &&
    target.entityType === "unit" &&
    target.traits?.includes("fast")
  ) {
    dmg *= 1.6;
  }
  return dmg;
}

export function applyDamage(target, amount) {
  if (!target.alive) return;
  target.hp -= amount;
  target.hitFlash = 0.15;
  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
  }
}

export function applySplash(center, amount, splashRadius, units, buildings, attackerSide) {
  if (!splashRadius) return;
  const victims = [...units, ...buildings];
  for (const v of victims) {
    if (!v.alive || v.side === attackerSide) continue;
    if (dist(center.x, center.y, v.x, v.y) <= splashRadius + (v.radius || 0.04)) {
      applyDamage(v, amount * 0.65);
    }
  }
}

/**
 * Resolve combat for one unit or building for this frame.
 * Returns new projectiles to spawn.
 */
export function tickAttacker(attacker, dt, units, buildings) {
  const projectiles = [];
  if (!attacker.alive) return projectiles;

  attacker.attackCooldown = Math.max(0, (attacker.attackCooldown || 0) - dt);
  if (attacker.hitFlash) attacker.hitFlash = Math.max(0, attacker.hitFlash - dt);

  let target = null;
  if (attacker.targetId != null) {
    target =
      units.find((u) => u.id === attacker.targetId) ||
      buildings.find((b) => b.id === attacker.targetId) ||
      null;
    if (!target || !target.alive || !isValidTarget(attacker, target)) {
      attacker.targetId = null;
      target = null;
    }
  }
  if (!target) {
    target = findNearestTarget(attacker, units, buildings);
    attacker.targetId = target ? target.id : null;
  }

  attacker.attacking = false;
  if (!target) return projectiles;

  const reach =
    attacker.range +
    (target.entityType === "building" ? Math.max(target.w, target.h) * 0.35 : target.radius || 0.03);
  const d = dist(attacker.x, attacker.y, target.x, target.y);

  if (d > reach) {
    // Move toward target if unit; buildings stay put.
    if (attacker.entityType === "unit") {
      const step = attacker.moveSpeed * dt;
      const nx = attacker.x + ((target.x - attacker.x) / d) * step;
      const ny = attacker.y + ((target.y - attacker.y) / d) * step;
      attacker.y = Math.max(0.04, Math.min(0.96, ny));
      attacker.x = constrainCrossingX(nx, attacker.lane, attacker.y);
    }
    return projectiles;
  }

  attacker.attacking = true;
  if (attacker.attackCooldown > 0) return projectiles;

  attacker.attackCooldown = attacker.attackSpeedSec;
  const dmg = computeDamage(attacker, target);

  const isRanged = attacker.range > 0.08 || attacker.entityType === "building";
  if (isRanged) {
    projectiles.push(
      spawnProjectile(
        attacker,
        target,
        dmg,
        attacker.splashRadius || 0,
        attacker.side === SIDE.PLAYER ? "#9dffb0" : "#ffb0a0"
      )
    );
  } else {
    applyDamage(target, dmg);
    if (attacker.splashRadius) {
      applySplash(target, dmg, attacker.splashRadius, units, buildings, attacker.side);
    }
  }

  return projectiles;
}

export function resolveProjectileImpact(p, units, buildings) {
  const target =
    units.find((u) => u.id === p.targetId) ||
    buildings.find((b) => b.id === p.targetId) ||
    null;

  if (target && target.alive) {
    applyDamage(target, p.damage);
    if (p.splashRadius) {
      applySplash(target, p.damage, p.splashRadius, units, buildings, p.side);
    }
  } else if (p.splashRadius) {
    applySplash({ x: p.x, y: p.y }, p.damage, p.splashRadius, units, buildings, p.side);
  }
}
