/** Canvas renderer. */

import { BRIDGE, LANE_CENTER_X, SIDE, toScreen } from "./board.js";

const COLORS = {
  grassPlayer: "#3d6b48",
  grassEnemy: "#3a5368",
  river: "#4d7590",
  bridge: "#8b7355",
  laneLine: "rgba(255,255,255,0.12)",
  shu: "#3f8f5c",
  wei: "#5a7394",
  hpOk: "#6dce6a",
  hpMid: "#e2b14a",
  hpLow: "#e05a4a",
};

export function render(ctx, match, view) {
  const { width, height } = view;
  ctx.clearRect(0, 0, width, height);

  drawArena(ctx, width, height);
  drawBuildings(ctx, match.buildings, width, height);
  drawUnits(ctx, match.units, width, height);
  drawProjectiles(ctx, match.projectiles, width, height);

  if (match.deployPreview) {
    drawDeployPreview(ctx, match.deployPreview, width, height);
  }

  if (match.flashInvalid && match.flashInvalid.t > 0) {
    drawInvalidFlash(ctx, match.flashInvalid, width, height);
  }
}

function drawArena(ctx, w, h) {
  // Enemy half
  const mid = toScreen(0, 0.5, w, h).y;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#2c3c52");
  g.addColorStop(0.45, "#35506a");
  g.addColorStop(0.55, "#355a45");
  g.addColorStop(1, "#2f523c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Lane columns
  for (const lane of [0, 1]) {
    const cx = LANE_CENTER_X[lane] * w;
    const laneW = 0.34 * w;
    ctx.fillStyle = lane === 0 ? "rgba(63,143,92,0.12)" : "rgba(90,115,148,0.12)";
    ctx.fillRect(cx - laneW / 2, 0, laneW, h);
  }

  // River band
  const y0 = toScreen(0, BRIDGE.y1, w, h).y;
  const y1 = toScreen(0, BRIDGE.y0, w, h).y;
  const riverGrad = ctx.createLinearGradient(0, y0, 0, y1);
  riverGrad.addColorStop(0, "rgba(77,117,144,0.95)");
  riverGrad.addColorStop(0.5, "rgba(110,160,190,0.9)");
  riverGrad.addColorStop(1, "rgba(77,117,144,0.95)");
  ctx.fillStyle = riverGrad;
  ctx.fillRect(0, y0, w, y1 - y0);

  // Bridges
  for (const lane of [0, 1]) {
    const cx = LANE_CENTER_X[lane] * w;
    const bw = 0.16 * w;
    ctx.fillStyle = COLORS.bridge;
    ctx.fillRect(cx - bw / 2, y0 - 2, bw, y1 - y0 + 4);
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - bw / 2, y0 - 2, bw, y1 - y0 + 4);
    // planks
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    for (let i = 1; i < 4; i += 1) {
      const py = y0 + ((y1 - y0) * i) / 4;
      ctx.beginPath();
      ctx.moveTo(cx - bw / 2, py);
      ctx.lineTo(cx + bw / 2, py);
      ctx.stroke();
    }
  }

  // Center divider
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = COLORS.laneLine;
  ctx.beginPath();
  ctx.moveTo(w / 2, 16);
  ctx.lineTo(w / 2, h - 16);
  ctx.stroke();
  ctx.setLineDash([]);

  // Faction labels
  ctx.font = "600 13px 'Songti SC', serif";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.textAlign = "center";
  ctx.fillText("魏 Wei", w / 2, 18);
  ctx.fillText("蜀 Shu", w / 2, h - 10);

  void mid;
}

function drawBuildings(ctx, buildings, w, h) {
  for (const b of buildings) {
    if (!b.alive) {
      drawRubble(ctx, b, w, h);
      continue;
    }
    const p = toScreen(b.x, b.y, w, h);
    const bw = b.w * w;
    const bh = b.h * h;
    const x = p.x - bw / 2;
    const y = p.y - bh / 2;

    const base = b.side === SIDE.PLAYER ? "#2f6b45" : "#3a4f6a";
    const accent = b.side === SIDE.PLAYER ? "#6dce8a" : "#8ab0d8";

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(x + 3, y + 4, bw, bh);

    ctx.fillStyle = b.hitFlash > 0 ? "#fff2d0" : base;
    roundRect(ctx, x, y, bw, bh, 8);
    ctx.fill();

    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#f4ead4";
    ctx.font = b.kind === "main" ? "700 16px 'Songti SC', serif" : "700 13px 'Songti SC', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = b.kind === "main" ? "大营" : "营寨";
    ctx.fillText(label, p.x, p.y);

    drawHpBar(ctx, p.x, y - 8, bw * 0.9, b.hp / b.maxHp);
  }
}

function drawRubble(ctx, b, w, h) {
  const p = toScreen(b.x, b.y, w, h);
  const bw = b.w * w * 0.85;
  const bh = b.h * h * 0.55;
  ctx.fillStyle = "rgba(40,35,30,0.55)";
  roundRect(ctx, p.x - bw / 2, p.y - bh / 2, bw, bh, 6);
  ctx.fill();
}

function drawUnits(ctx, units, w, h) {
  for (const u of units) {
    if (!u.alive) continue;
    const p = toScreen(u.x, u.y, w, h);
    const r = Math.max(12, u.radius * w * 1.15);

    ctx.beginPath();
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.ellipse(p.x + 2, p.y + r * 0.55, r * 0.7, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = u.hitFlash > 0 ? "#fff7df" : u.color;
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = u.side === SIDE.PLAYER ? "#d8ffe0" : "#ffd4cc";
    ctx.stroke();

    ctx.fillStyle = "#1a1714";
    ctx.font = `700 ${Math.round(r)}px 'Songti SC', serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(u.glyph || "兵", p.x, p.y + 1);

    drawHpBar(ctx, p.x, p.y - r - 8, r * 2, u.hp / u.maxHp);
  }
}

function drawProjectiles(ctx, projectiles, w, h) {
  for (const p of projectiles) {
    if (!p.alive) continue;
    const s = toScreen(p.x, p.y, w, h);
    ctx.beginPath();
    ctx.fillStyle = p.color;
    ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDeployPreview(ctx, preview, w, h) {
  const p = toScreen(preview.x, preview.y, w, h);
  ctx.beginPath();
  ctx.strokeStyle = preview.valid ? "rgba(109,206,106,0.9)" : "rgba(224,90,74,0.9)";
  ctx.fillStyle = preview.valid ? "rgba(109,206,106,0.2)" : "rgba(224,90,74,0.18)";
  ctx.lineWidth = 2;
  ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawInvalidFlash(ctx, flash, w, h) {
  const p = toScreen(flash.x, flash.y, w, h);
  ctx.beginPath();
  ctx.strokeStyle = `rgba(224,90,74,${Math.min(1, flash.t * 4)})`;
  ctx.lineWidth = 3;
  ctx.arc(p.x, p.y, 20 + (0.2 - flash.t) * 40, 0, Math.PI * 2);
  ctx.stroke();
}

function drawHpBar(ctx, cx, cy, width, ratio) {
  const h = 5;
  const x = cx - width / 2;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(ctx, x, cy, width, h, 2);
  ctx.fill();
  const color = ratio > 0.55 ? COLORS.hpOk : ratio > 0.25 ? COLORS.hpMid : COLORS.hpLow;
  ctx.fillStyle = color;
  roundRect(ctx, x, cy, Math.max(0, width * ratio), h, 2);
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
