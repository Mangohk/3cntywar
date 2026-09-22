/**
 * Headless checks for mute state + that combat/deploy still run with audio hooked.
 * Run: node tools/sfx.mjs
 */

import assert from "node:assert/strict";
import {
  isMuted,
  playDeploy,
  playHit,
  playInvalid,
  playOutcome,
  playOutpostFall,
  playSudden,
  setMuted,
  toggleMute,
  unlockAudio,
} from "../js/audio.js";
import {
  Phase,
  createGame,
  startMatch,
  tryDeploy,
  updateMatch,
} from "../js/game.js";
import { SIDE, LANE_CENTER_X, LANE } from "../js/board.js";

// No AudioContext in Node — calls must no-op without throwing.
unlockAudio();
playDeploy("player");
playDeploy("enemy");
playHit();
playInvalid();
playOutpostFall(false);
playOutpostFall(true);
playSudden();
playOutcome("win");
playOutcome("lose");
playOutcome("draw");

const original = isMuted();
setMuted(true);
assert.equal(isMuted(), true);
assert.equal(toggleMute(), false);
assert.equal(isMuted(), false);
setMuted(original);

const game = createGame();
startMatch(game);
tryDeploy(game, SIDE.PLAYER, LANE_CENTER_X[LANE.LEFT], 0.3, 0);
tryDeploy(game, SIDE.ENEMY, LANE_CENTER_X[LANE.LEFT], 0.7, 0);

for (let i = 0; i < 90; i += 1) updateMatch(game, 1 / 30);
assert.ok(
  game.phase === Phase.MATCH_RUNNING || game.phase === Phase.MATCH_OVER,
  "match advances with sfx hooks"
);

console.log("PASS: sfx mute API + hooked match tick");
