/** Pointer input for card deploy. */

import { SIDE, canDeployAt, fromScreen, laneFromX } from "./board.js";

export function bindInput(canvas, handlers) {
  let dragging = false;

  const getNorm = (evt) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = evt.clientX ?? evt.touches?.[0]?.clientX;
    const clientY = evt.clientY ?? evt.touches?.[0]?.clientY;
    if (clientX == null || clientY == null) return null;
    const px = ((clientX - rect.left) / rect.width) * canvas.width;
    const py = ((clientY - rect.top) / rect.height) * canvas.height;
    return fromScreen(px, py, canvas.width, canvas.height);
  };

  const onDown = (evt) => {
    if (!handlers.isRunning()) return;
    dragging = true;
    const pos = getNorm(evt);
    if (!pos) return;
    handlers.onHover(pos);
    evt.preventDefault();
  };

  const onMove = (evt) => {
    if (!handlers.isRunning()) return;
    const pos = getNorm(evt);
    if (!pos) return;
    if (dragging || handlers.hasSelection()) handlers.onHover(pos);
  };

  const onUp = (evt) => {
    if (!handlers.isRunning()) return;
    const pos = getNorm(evt);
    dragging = false;
    if (!pos) return;
    handlers.onDeploy(pos);
    evt.preventDefault();
  };

  const onLeave = () => {
    dragging = false;
    handlers.onHover(null);
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") handlers.onCancel();
  });

  return {
    destroy() {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
    },
  };
}

export function validatePlayerDeploy(pos) {
  if (!pos) return { valid: false };
  const valid = canDeployAt(SIDE.PLAYER, pos.x, pos.y);
  return { valid, lane: laneFromX(pos.x), ...pos };
}
