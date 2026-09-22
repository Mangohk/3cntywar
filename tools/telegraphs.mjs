/**
 * Verifies outpost-fall banners + sudden-death countdown telegraphs.
 * Run: node tools/telegraphs.mjs
 */

import assert from "node:assert/strict";
import {
  Phase,
  createGame,
  startMatch,
  suddenDeathCountdown,
  updateMatch,
} from "../js/game.js";
import { SUDDEN_DEATH_AT } from "../js/cards.js";

const game = createGame();
startMatch(game);
const match = game.match;

assert.equal(suddenDeathCountdown(match), null, "no countdown at match start");

match.time = SUDDEN_DEATH_AT - 10.2;
assert.equal(suddenDeathCountdown(match), null, "still outside warn window");

match.time = SUDDEN_DEATH_AT - 9.4;
assert.equal(suddenDeathCountdown(match), 10, "countdown starts ~10s out");

match.time = SUDDEN_DEATH_AT - 0.02;
updateMatch(game, 0.05);
assert.equal(game.phase, Phase.MATCH_RUNNING);
assert.equal(match.suddenDeath, true, "sudden death flips at 90s");
assert.equal(suddenDeathCountdown(match), null, "countdown clears once sudden");
assert.ok(match.banner, "sudden-death banner fires");
assert.equal(match.banner.kind, "sudden");
assert.match(match.banner.text, /Sudden Death/i);

const outpost = match.buildings.find((b) => b.id === "enemy-outpost-l");
assert.ok(outpost);
outpost.alive = false;
outpost.hp = 0;
updateMatch(game, 0.05);
assert.ok(match.banner, "outpost banner fires");
assert.equal(match.banner.kind, "outpost-win");
assert.match(match.banner.text, /Left Outpost Fallen/);
assert.deepEqual(match.fallenOutpostIds, ["enemy-outpost-l"]);

// Second tick should not re-announce the same outpost.
const firstText = match.banner.text;
updateMatch(game, 0.05);
assert.equal(match.fallenOutpostIds.length, 1);
assert.equal(match.banner.text, firstText);

const playerPost = match.buildings.find((b) => b.id === "player-outpost-r");
playerPost.alive = false;
playerPost.hp = 0;
updateMatch(game, 0.05);
assert.equal(match.banner.kind, "outpost-lose");
assert.match(match.banner.text, /Right Outpost Lost/);

console.log("PASS: telegraphs (sudden countdown + outpost banners)");
