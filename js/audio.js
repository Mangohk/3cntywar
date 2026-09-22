/**
 * Lightweight procedural SFX via Web Audio API (no asset files).
 * Safe no-op in Node / when AudioContext is unavailable.
 */

const STORAGE_KEY = "3cntywar-muted";

/** @type {AudioContext | null} */
let ctx = null;
let muted = false;
let lastHitAt = 0;
let lastDeathAt = 0;

try {
  muted = globalThis.localStorage?.getItem(STORAGE_KEY) === "1";
} catch {
  muted = false;
}

function hasAudio() {
  return typeof globalThis.AudioContext === "function" || typeof globalThis.webkitAudioContext === "function";
}

function getCtx() {
  if (!hasAudio()) return null;
  if (!ctx) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

/** Unlock audio on first user gesture (autoplay policies). */
export function unlockAudio() {
  getCtx();
}

export function isMuted() {
  return muted;
}

export function setMuted(next) {
  muted = Boolean(next);
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (!muted) unlockAudio();
  return muted;
}

export function toggleMute() {
  return setMuted(!muted);
}

/**
 * @param {number} freq
 * @param {number} duration
 * @param {{ type?: OscillatorType, gain?: number, delay?: number, slideTo?: number }} [opts]
 */
function beep(freq, duration, opts = {}) {
  if (muted) return;
  const ac = getCtx();
  if (!ac) return;

  const type = opts.type || "square";
  const gain = opts.gain ?? 0.05;
  const delay = opts.delay ?? 0;
  const t0 = ac.currentTime + delay;

  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), t0 + duration);
  }

  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Soft noise burst (deploy / impact thud). */
function thud(duration = 0.08, gain = 0.06) {
  if (muted) return;
  const ac = getCtx();
  if (!ac) return;

  const n = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, n, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  }

  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420;
  const g = ac.createGain();
  const t0 = ac.currentTime;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  src.connect(filter);
  filter.connect(g);
  g.connect(ac.destination);
  src.start(t0);
}

export const sfx = {
  ui() {
    beep(660, 0.05, { type: "triangle", gain: 0.035 });
  },
  deploy() {
    thud(0.09, 0.07);
    beep(180, 0.07, { type: "triangle", gain: 0.04, slideTo: 90 });
  },
  deny() {
    beep(140, 0.1, { type: "sawtooth", gain: 0.03, slideTo: 90 });
  },
  hit() {
    const now = performance.now?.() ?? Date.now();
    if (now - lastHitAt < 55) return;
    lastHitAt = now;
    beep(320 + Math.random() * 80, 0.035, { type: "square", gain: 0.028 });
  },
  death() {
    const now = performance.now?.() ?? Date.now();
    if (now - lastDeathAt < 90) return;
    lastDeathAt = now;
    beep(220, 0.1, { type: "triangle", gain: 0.04, slideTo: 80 });
  },
  buildingHit() {
    thud(0.06, 0.05);
    beep(110, 0.08, { type: "square", gain: 0.03 });
  },
  buildingDestroy() {
    thud(0.18, 0.1);
    beep(160, 0.22, { type: "sawtooth", gain: 0.045, slideTo: 55 });
  },
  suddenDeath() {
    beep(440, 0.12, { type: "triangle", gain: 0.05 });
    beep(554, 0.14, { type: "triangle", gain: 0.045, delay: 0.1 });
    beep(659, 0.18, { type: "triangle", gain: 0.04, delay: 0.2 });
  },
  win() {
    beep(523, 0.12, { type: "triangle", gain: 0.05 });
    beep(659, 0.12, { type: "triangle", gain: 0.05, delay: 0.1 });
    beep(784, 0.22, { type: "triangle", gain: 0.055, delay: 0.2 });
  },
  lose() {
    beep(392, 0.16, { type: "triangle", gain: 0.05 });
    beep(311, 0.18, { type: "triangle", gain: 0.045, delay: 0.14 });
    beep(233, 0.28, { type: "triangle", gain: 0.05, delay: 0.28 });
  },
};
