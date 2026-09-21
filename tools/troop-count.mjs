/**
 * Verifies CardDef.count multi-spawn on deploy (Qi / hand cycle once).
 * Run: node tools/troop-count.mjs
 */

import { CARD_DEFS, getCardDef } from "../js/cards.js";
import { LANE, LANE_CENTER_X, SIDE } from "../js/board.js";
import { Phase, createGame, startMatch, tryDeploy } from "../js/game.js";

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

for (const card of CARD_DEFS) {
  assert(Number.isInteger(card.count) && card.count >= 1, `${card.id} needs integer count ≥ 1`);
}

assert(getCardDef("militia").count === 3, "militia count should be 3");
assert(getCardDef("crossbow").count === 2, "crossbow count should be 2");
assert(getCardDef("spearman").count === 2, "spearman count should be 2");
assert(getCardDef("guan").count === 1, "guan (elite) should stay solo");

function forceHand(handState, cardId, slot = 0) {
  const idx = handState.hand.indexOf(cardId);
  if (idx === slot) return;
  if (idx >= 0) {
    [handState.hand[slot], handState.hand[idx]] = [handState.hand[idx], handState.hand[slot]];
    return;
  }
  const cyc = handState.cycle.indexOf(cardId);
  assert(cyc >= 0, `card ${cardId} missing from deck`);
  handState.cycle.splice(cyc, 1);
  handState.cycle.push(handState.hand[slot]);
  handState.hand[slot] = cardId;
}

function deployAndAssert(cardId, expectedCount) {
  const game = createGame();
  startMatch(game);
  const match = game.match;
  forceHand(match.playerHand, cardId, 0);

  const cost = getCardDef(cardId).cost;
  match.playerQi = cost;
  const qiBefore = match.playerQi;
  const handBefore = [...match.playerHand.hand];
  const cycleLenBefore = match.playerHand.cycle.length;

  const ok = tryDeploy(game, SIDE.PLAYER, LANE_CENTER_X[LANE.LEFT], 0.32, 0);
  assert(ok, `${cardId} deploy should succeed`);
  assert(game.phase === Phase.MATCH_RUNNING, "match should still be running");

  const spawned = match.units.filter((u) => u.alive && u.cardId === cardId && u.side === SIDE.PLAYER);
  assert(spawned.length === expectedCount, `${cardId} should spawn ${expectedCount}, got ${spawned.length}`);

  assert(match.playerQi === qiBefore - cost, `${cardId}: Qi should drop by cost once`);
  assert(match.playerHand.hand[0] !== cardId, `${cardId}: hand slot 0 should cycle away`);
  assert(match.playerHand.cycle.length === cycleLenBefore, `${cardId}: cycle length unchanged (one play)`);
  assert(match.playerHand.cycle[match.playerHand.cycle.length - 1] === cardId, `${cardId}: played card goes to end of cycle`);
  assert(handBefore.includes(cardId), "sanity: card was in hand before");

  // Offsets: multi-spawns should not all share the exact same x
  if (expectedCount > 1) {
    const xs = new Set(spawned.map((u) => u.x.toFixed(4)));
    assert(xs.size > 1, `${cardId} multi-spawn should have distinct x offsets`);
    for (const u of spawned) {
      assert(u.lane === LANE.LEFT, `${cardId} units stay in drop lane`);
    }
  }
}

deployAndAssert("militia", 3);
deployAndAssert("crossbow", 2);
deployAndAssert("guan", 1);

console.log("OK", {
  militia: getCardDef("militia").count,
  crossbow: getCardDef("crossbow").count,
  spearman: getCardDef("spearman").count,
  elites: ["cavalry", "zhuge", "guan", "zhang", "catapult"].map((id) => ({
    id,
    count: getCardDef(id).count,
  })),
});
