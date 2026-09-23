/**
 * Verifies Wei enemy palette wash helpers in render.js.
 * Run: node tools/wei-wash.mjs
 */

import assert from "node:assert/strict";
import { createGame, startMatch, tryDeploy } from "../js/game.js";
import { SIDE, LANE_CENTER_X, LANE } from "../js/board.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, "../js/render.js"), "utf8");

assert.match(src, /unitBodyColor/, "unitBodyColor helper present");
assert.match(src, /mixHex/, "mixHex helper present");
assert.match(src, /weiWash/, "weiWash color present");
assert.match(src, /weiStroke/, "weiStroke color present");
assert.match(src, /rgba\(74, 98, 128/, "soft wash halo present");
assert.doesNotMatch(src, /#ffd4cc/, "old pink enemy stroke removed");

const game = createGame();
startMatch(game);
tryDeploy(game, SIDE.PLAYER, LANE_CENTER_X[LANE.LEFT], 0.3, 0);
tryDeploy(game, SIDE.ENEMY, LANE_CENTER_X[LANE.RIGHT], 0.7, 0);

const player = game.match.units.find((u) => u.side === SIDE.PLAYER);
const enemy = game.match.units.find((u) => u.side === SIDE.ENEMY);
assert.ok(player && enemy, "both sides spawned");
assert.ok(player.color && enemy.color, "card colors still assigned on entities");
assert.equal(player.side, SIDE.PLAYER);
assert.equal(enemy.side, SIDE.ENEMY);

console.log("PASS: wei enemy palette wash hooks");
