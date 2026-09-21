/** Boot, loop, wire UI/input/render. */

import {
  Phase,
  createGame,
  returnToTitle,
  selectHandCard,
  startMatch,
  tryDeploy,
  updateMatch,
} from "./game.js";
import { render } from "./render.js";
import { bindInput, validatePlayerDeploy } from "./input.js";
import { createUI } from "./ui.js";
import { SIDE } from "./board.js";

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const root = document.getElementById("app");
const ui = createUI(root);
const game = createGame();

const BOARD_W = 420;
const BOARD_H = 720;
const BOARD_ASPECT = BOARD_W / BOARD_H;

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

ui.onSelectCard = (index) => {
  selectHandCard(game, index);
  syncChrome();
};

bindInput(canvas, {
  isRunning: () => game.phase === Phase.MATCH_RUNNING,
  hasSelection: () => game.selectedHandIndex != null,
  onHover: (pos) => {
    if (!game.match) return;
    if (game.selectedHandIndex == null) {
      game.match.deployPreview = null;
      return;
    }
    if (!pos) {
      game.match.deployPreview = null;
      return;
    }
    const check = validatePlayerDeploy(pos);
    game.match.deployPreview = { x: pos.x, y: pos.y, valid: check.valid };
  },
  onDeploy: (pos) => {
    if (game.selectedHandIndex == null) {
      ui.setHint("Select a card first, then tap your half of a lane.", true);
      return;
    }
    const check = validatePlayerDeploy(pos);
    const ok = tryDeploy(game, SIDE.PLAYER, pos.x, pos.y);
    if (!ok) {
      ui.setHint("Invalid deploy — place on your half of a lane.", true);
      if (game.match) game.match.flashInvalid = { x: pos.x, y: pos.y, t: 0.35 };
    } else {
      ui.setHint("Select a card, then tap your half of a lane.");
    }
    void check;
    syncChrome();
  },
  onCancel: () => {
    game.selectedHandIndex = null;
    if (game.match) game.match.deployPreview = null;
    syncChrome();
  },
});

function beginMatch() {
  startMatch(game);
  ui.showMatch();
  ui.setHint("Select a card, then tap your half of a lane.");
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
  ui.updateTimer(m.time, m.suddenDeath);
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
    // Keep drawing end state with light decay on flashes
    if (game.match.flashInvalid) {
      game.match.flashInvalid.t -= Math.min(dt, 0.05);
      if (game.match.flashInvalid.t <= 0) game.match.flashInvalid = null;
    }
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
