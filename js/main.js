/** Boot, loop, wire UI/input/render. */

import {
  Phase,
  createGame,
  returnToTitle,
  startMatch,
  suddenDeathCountdown,
  tryDeploy,
  updateMatch,
} from "./game.js";
import { render } from "./render.js";
import { bindInput, clientToBoard, validatePlayerDeploy } from "./input.js";
import { createUI } from "./ui.js";
import { SIDE } from "./board.js";

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const root = document.getElementById("app");
const ui = createUI(root);
const game = createGame();

const BOARD_W = 420;
const BOARD_H = 966; // width:height = 1:2.3
const BOARD_ASPECT = BOARD_W / BOARD_H;
const HINT_IDLE = "Drag a card onto your half of a lane to deploy.";

function resizeCanvas() {
  // Fit the fixed board aspect into whatever space the stage has left
  // after header/HUD on short phone viewports (iPhone SE, browser chrome, etc.).
  const stage = canvas.parentElement;
  const rect = stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const availW = Math.max(1, rect.width);
  const availH = Math.max(1, rect.height);

  let cssW = availW;
  let cssH = cssW / BOARD_ASPECT;
  if (cssH > availH) {
    cssH = availH;
    cssW = cssH * BOARD_ASPECT;
  }

  canvas.width = Math.round(BOARD_W * dpr);
  canvas.height = Math.round(BOARD_H * dpr);
  canvas.style.width = `${Math.round(cssW)}px`;
  canvas.style.height = `${Math.round(cssH)}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", resizeCanvas);
}
if (typeof ResizeObserver !== "undefined") {
  const stageObserver = new ResizeObserver(() => resizeCanvas());
  stageObserver.observe(canvas.parentElement);
}

ui.els.btnStart.addEventListener("click", () => {
  beginMatch();
});
ui.els.btnRetry.addEventListener("click", () => {
  beginMatch();
});
ui.els.btnTitle.addEventListener("click", () => {
  returnToTitle(game);
  syncChrome();
  draw();
});

ui.isMatchRunning = () => game.phase === Phase.MATCH_RUNNING;
ui.pointToBoard = (clientX, clientY) => clientToBoard(canvas, clientX, clientY);

ui.onDragStart = (index) => {
  // Lock the dragged card; do not toggle.
  game.selectedHandIndex = index;
  if (game.match) game.match.deployPreview = null;
  ui.setHint("Drop on your half of a lane.");
  syncChrome();
};

ui.onDragMove = (pos) => {
  if (!game.match || game.phase !== Phase.MATCH_RUNNING) return;
  if (!pos) {
    game.match.deployPreview = null;
    return;
  }
  const check = validatePlayerDeploy(pos);
  game.match.deployPreview = { x: pos.x, y: pos.y, valid: check.valid };
};

ui.onDragEnd = (index, pos) => {
  game.selectedHandIndex = index;
  if (!pos) {
    clearDeploySelection("Drop on the battlefield to deploy.");
    return;
  }
  const check = validatePlayerDeploy(pos);
  const ok = tryDeploy(game, SIDE.PLAYER, pos.x, pos.y, index);
  if (!ok) {
    if (game.match) game.match.flashInvalid = { x: pos.x, y: pos.y, t: 0.35 };
    ui.setHint(
      check.valid ? "Cannot deploy there." : "Invalid deploy — drop on your half of a lane.",
      true
    );
    game.selectedHandIndex = null;
    if (game.match) game.match.deployPreview = null;
  } else {
    ui.setHint(HINT_IDLE);
  }
  syncChrome();
};

ui.onDragCancel = () => {
  clearDeploySelection(HINT_IDLE);
};

function clearDeploySelection(hint) {
  game.selectedHandIndex = null;
  if (game.match) game.match.deployPreview = null;
  ui.setHint(hint || HINT_IDLE);
  syncChrome();
}

bindInput({
  onCancel: () => {
    if (ui.isDragging()) {
      ui.cancelDrag();
      return;
    }
    clearDeploySelection(HINT_IDLE);
  },
});

function beginMatch() {
  startMatch(game);
  ui.showMatch();
  ui.setHint(HINT_IDLE);
  syncChrome();
}

function syncChrome() {
  if (game.phase === Phase.TITLE) {
    ui.showTitle();
    return;
  }
  const m = game.match;
  if (!m) return;
  ui.updateQi(m.playerQi);
  ui.updateTimer(m.time, m.suddenDeath, suddenDeathCountdown(m));
  ui.updateBanner(m.banner);
  ui.updateHand(m.playerHand.hand, game.selectedHandIndex, m.playerQi);
  if (game.phase === Phase.MATCH_OVER) {
    ui.showResult(m.outcome);
  } else if (ui.els.title.hidden === false || ui.els.hud.hidden) {
    ui.showMatch();
  }
}

function draw() {
  const view = { width: BOARD_W, height: BOARD_H };
  if (game.match) {
    render(ctx, game.match, view);
  } else {
    // Idle title backdrop
    render(
      ctx,
      {
        buildings: [],
        units: [],
        projectiles: [],
        deployPreview: null,
        flashInvalid: null,
      },
      view
    );
  }
}

let last = performance.now();
function frame(now) {
  const dt = (now - last) / 1000;
  last = now;

  if (game.phase === Phase.MATCH_RUNNING) {
    updateMatch(game, dt);
    syncChrome();
  } else if (game.match) {
    // Keep drawing end state with light decay on flashes / banners
    if (game.match.flashInvalid) {
      game.match.flashInvalid.t -= Math.min(dt, 0.05);
      if (game.match.flashInvalid.t <= 0) game.match.flashInvalid = null;
    }
    if (game.match.banner) {
      game.match.banner.t -= Math.min(dt, 0.05);
      if (game.match.banner.t <= 0) game.match.banner = null;
    }
    ui.updateBanner(game.match.banner);
  }

  draw();
  requestAnimationFrame(frame);
}

ui.showTitle();
draw();
requestAnimationFrame(frame);

// Debug/testing hook
window.__game = game;
window.__ui = ui;
