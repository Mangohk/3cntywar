/** Pointer helpers and deploy validation. */

import { SIDE, canDeployAt, laneFromX } from "./board.js";

/**
 * Map a client (CSS pixel) point onto normalized board coords.
 * Returns null when the point is outside the canvas element.
 */
export function clientToBoard(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  if (
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  ) {
    return null;
  }
  return {
    x: (clientX - rect.left) / rect.width,
    y: 1 - (clientY - rect.top) / rect.height,
  };
}

export function validatePlayerDeploy(pos) {
  if (!pos) return { valid: false };
  const valid = canDeployAt(SIDE.PLAYER, pos.x, pos.y);
  return { valid, lane: laneFromX(pos.x), ...pos };
}

/** Keyboard cancel only — deploy is drag-and-drop from the hand. */
export function bindInput(handlers) {
  const onKey = (e) => {
    if (e.key === "Escape") handlers.onCancel?.();
  };
  window.addEventListener("keydown", onKey);
  return {
    destroy() {
      window.removeEventListener("keydown", onKey);
    },
  };
}
