/** Board geometry, lanes, deploy validation, normalized coords. */

export const LANE = {
  LEFT: 0,
  RIGHT: 1,
};

export const SIDE = {
  PLAYER: "player",
  ENEMY: "enemy",
};

/** Bridge band in normalized y (0 player → 1 enemy). */
export const BRIDGE = { y0: 0.45, y1: 0.55 };

export const LANE_CENTER_X = {
  [LANE.LEFT]: 0.27,
  [LANE.RIGHT]: 0.73,
};

export const BOARD = {
  /** Player may deploy on their half, including just behind the bridge. */
  playerDeployMaxY: 0.52,
  enemyDeployMinY: 0.48,
  laneHalfWidth: 0.16,
};

/**
 * Building blueprint positions (normalized).
 * Outposts sit ahead of each Main Camp, one per lane.
 */
export function createBuildingBlueprints() {
  return [
    {
      id: "enemy-main",
      kind: "main",
      side: SIDE.ENEMY,
      lane: null,
      x: 0.5,
      y: 0.93,
      w: 0.28,
      h: 0.08,
      hp: 3000,
      damage: 90,
      attackSpeedSec: 1.6,
      range: 0.28,
    },
    {
      id: "enemy-outpost-l",
      kind: "outpost",
      side: SIDE.ENEMY,
      lane: LANE.LEFT,
      x: LANE_CENTER_X[LANE.LEFT],
      y: 0.78,
      w: 0.18,
      h: 0.07,
      hp: 2000,
      damage: 70,
      attackSpeedSec: 1.5,
      range: 0.26,
    },
    {
      id: "enemy-outpost-r",
      kind: "outpost",
      side: SIDE.ENEMY,
      lane: LANE.RIGHT,
      x: LANE_CENTER_X[LANE.RIGHT],
      y: 0.78,
      w: 0.18,
      h: 0.07,
      hp: 2000,
      damage: 70,
      attackSpeedSec: 1.5,
      range: 0.26,
    },
    {
      id: "player-outpost-l",
      kind: "outpost",
      side: SIDE.PLAYER,
      lane: LANE.LEFT,
      x: LANE_CENTER_X[LANE.LEFT],
      y: 0.22,
      w: 0.18,
      h: 0.07,
      hp: 2000,
      damage: 70,
      attackSpeedSec: 1.5,
      range: 0.26,
    },
    {
      id: "player-outpost-r",
      kind: "outpost",
      side: SIDE.PLAYER,
      lane: LANE.RIGHT,
      x: LANE_CENTER_X[LANE.RIGHT],
      y: 0.22,
      w: 0.18,
      h: 0.07,
      hp: 2000,
      damage: 70,
      attackSpeedSec: 1.5,
      range: 0.26,
    },
    {
      id: "player-main",
      kind: "main",
      side: SIDE.PLAYER,
      lane: null,
      x: 0.5,
      y: 0.07,
      w: 0.28,
      h: 0.08,
      hp: 3000,
      damage: 90,
      attackSpeedSec: 1.6,
      range: 0.28,
    },
  ];
}

export function laneFromX(x) {
  return x < 0.5 ? LANE.LEFT : LANE.RIGHT;
}

export function clampToLane(x, lane) {
  const cx = LANE_CENTER_X[lane];
  const half = BOARD.laneHalfWidth;
  return clamp(x, cx - half, cx + half);
}

export function isInBridgeBand(y) {
  return y >= BRIDGE.y0 && y <= BRIDGE.y1;
}

/**
 * Ground units must stay on the bridge x-corridor while crossing the river band.
 */
export function constrainCrossingX(x, lane, y) {
  if (!isInBridgeBand(y)) return clampToLane(x, lane);
  const cx = LANE_CENTER_X[lane];
  return clamp(x, cx - 0.07, cx + 0.07);
}

export function canDeployAt(side, x, y) {
  if (x < 0.05 || x > 0.95 || y < 0.02 || y > 0.98) return false;
  if (side === SIDE.PLAYER) {
    return y <= BOARD.playerDeployMaxY;
  }
  return y >= BOARD.enemyDeployMinY;
}

export function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.hypot(dx, dy);
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** Map normalized board coords to canvas pixels (y flipped: 0 at bottom visually... wait)
 * Design says y=0 player side (bottom of screen), y=1 enemy (top).
 * Canvas y grows downward, so pixelY = (1 - y) * height.
 */
export function toScreen(nx, ny, width, height) {
  return {
    x: nx * width,
    y: (1 - ny) * height,
  };
}

export function fromScreen(px, py, width, height) {
  return {
    x: px / width,
    y: 1 - py / height,
  };
}
