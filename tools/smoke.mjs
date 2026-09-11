/**
 * Headless smoke simulation (Node ESM) — verifies a match can run to completion.
 * Run: node --experimental-vm-modules tools/smoke.mjs
 * Or simply: node tools/smoke.mjs (Node 18+)
 */

import {
  Phase,
  createGame,
  startMatch,
  tryDeploy,
  updateMatch,
} from "../js/game.js";
import { SIDE, LANE_CENTER_X, LANE } from "../js/board.js";

const game = createGame();
startMatch(game);

// Force some early deploys so combat happens
tryDeploy(game, SIDE.PLAYER, LANE_CENTER_X[LANE.LEFT], 0.35, 0);
tryDeploy(game, SIDE.ENEMY, LANE_CENTER_X[LANE.LEFT], 0.65, 0);
tryDeploy(game, SIDE.PLAYER, LANE_CENTER_X[LANE.RIGHT], 0.32, 1);
tryDeploy(game, SIDE.ENEMY, LANE_CENTER_X[LANE.RIGHT], 0.68, 1);

let frames = 0;
const DT = 1 / 30;
while (game.phase === Phase.MATCH_RUNNING && frames < 30 * 200) {
  // Periodically dump Qi into catapults by deploying whatever is in hand slot 0
  if (frames % 45 === 0) {
    const m = game.match;
    if (m.playerQi >= 2) tryDeploy(game, SIDE.PLAYER, LANE_CENTER_X[LANE.LEFT], 0.3, 0);
    if (m.enemyQi >= 2) tryDeploy(game, SIDE.ENEMY, LANE_CENTER_X[LANE.RIGHT], 0.7, 0);
  }
  updateMatch(game, DT);
  frames += 1;
}

if (game.phase !== Phase.MATCH_OVER) {
  console.error("FAIL: match did not end", {
    frames,
    time: game.match.time,
    units: game.match.units.length,
    playerMain: game.match.buildings.find((b) => b.id === "player-main").hp,
    enemyMain: game.match.buildings.find((b) => b.id === "enemy-main").hp,
  });
  process.exit(1);
}

console.log("OK", {
  frames,
  time: Number(game.match.time.toFixed(1)),
  outcome: game.match.outcome,
  playerMainHp: game.match.buildings.find((b) => b.id === "player-main").hp,
  enemyMainHp: game.match.buildings.find((b) => b.id === "enemy-main").hp,
});
