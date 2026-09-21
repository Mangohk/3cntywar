/**
 * Verifies per-troop sight ranges and nearest-enemy chase.
 * Run: node tools/sight-range.mjs
 */

import { CARD_DEFS, getCardDef } from "../js/cards.js";
import { LANE, LANE_CENTER_X, SIDE } from "../js/board.js";
import { spawnUnit, updateUnitMovement } from "../js/entities.js";
import {
  findNearestTarget,
  inSight,
  resolveProjectileImpact,
  tickAttacker,
} from "../js/combat.js";
import { updateProjectile } from "../js/entities.js";

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

// Every card must define sightRange >= attack range, and values must differ by role.
for (const card of CARD_DEFS) {
  assert(typeof card.sightRange === "number", `${card.id} missing sightRange`);
  assert(card.sightRange >= card.range, `${card.id} sightRange < range`);
}

const militiaSight = getCardDef("militia").sightRange;
const crossbowSight = getCardDef("crossbow").sightRange;
const catapultSight = getCardDef("catapult").sightRange;
assert(crossbowSight > militiaSight, "ranged should see farther than militia");
assert(catapultSight > crossbowSight, "siege should see farther than crossbow");

const attacker = spawnUnit("militia", SIDE.PLAYER, LANE_CENTER_X[LANE.LEFT], 0.3);
const farEnemy = spawnUnit("militia", SIDE.ENEMY, LANE_CENTER_X[LANE.LEFT], 0.7);
const nearEnemy = spawnUnit("militia", SIDE.ENEMY, LANE_CENTER_X[LANE.LEFT], 0.42);
const fartherNear = spawnUnit("cavalry", SIDE.ENEMY, LANE_CENTER_X[LANE.LEFT], 0.48);

assert(!inSight(attacker, farEnemy), "far enemy should be outside militia sight");
assert(inSight(attacker, nearEnemy), "near enemy should be inside militia sight");

let chosen = findNearestTarget(attacker, [farEnemy, nearEnemy, fartherNear], []);
assert(chosen && chosen.id === nearEnemy.id, "should lock the nearest visible enemy");

chosen = findNearestTarget(attacker, [farEnemy], []);
assert(chosen == null, "should not acquire enemies outside sight");

// Direct tick: out-of-sight does not set targetId; unit can keep marching.
const scout = spawnUnit("militia", SIDE.PLAYER, LANE_CENTER_X[LANE.RIGHT], 0.25);
const distant = spawnUnit("guan", SIDE.ENEMY, LANE_CENTER_X[LANE.RIGHT], 0.8);
tickAttacker(scout, 0.05, [distant], []);
assert(scout.targetId == null, "tick should not lock a target outside sight");
assert(!scout.attacking, "should not be attacking when nothing is in sight");
const yBefore = scout.y;
updateUnitMovement(scout, 0.2);
assert(scout.y > yBefore, "with no sighted enemy, troop should march forward");

// Approach + destroy: hunter sees prey, locks nearest, closes, kills.
const hunter = spawnUnit("cavalry", SIDE.PLAYER, LANE_CENTER_X[LANE.LEFT], 0.35);
const prey = spawnUnit("militia", SIDE.ENEMY, LANE_CENTER_X[LANE.LEFT], 0.5);
const decoy = spawnUnit("militia", SIDE.ENEMY, LANE_CENTER_X[LANE.LEFT], 0.58);
hunter.sightRange = 0.3;
const startY = hunter.y;
const projectiles = [];
let frames = 0;
while (prey.alive && frames < 30 * 25) {
  const dt = 1 / 30;
  const units = [hunter, prey, decoy].filter((u) => u.alive);
  for (const u of units) {
    const shots = tickAttacker(u, dt, units, []);
    projectiles.push(...shots);
    if (!u.attacking && u.targetId == null) updateUnitMovement(u, dt);
  }
  for (const p of projectiles) {
    if (!p.alive) continue;
    const hit = updateProjectile(p, dt);
    if (hit) resolveProjectileImpact(p, units, []);
  }
  frames += 1;
}

assert(hunter.targetId === prey.id || !prey.alive, "should prioritize the nearer prey over decoy");
assert(!prey.alive, "hunter should destroy the nearest enemy in sight");
assert(hunter.y > startY, "hunter should have approached the enemy");

console.log("OK sight-range", {
  militiaSight,
  crossbowSight,
  catapultSight,
  chaseFrames: frames,
});
