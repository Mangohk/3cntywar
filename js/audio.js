/**
 * Lite procedural SFX via Web Audio (no asset files).
 * Safe no-op under Node / missing AudioContext.
 */

const STORAGE_KEY = "3cntywar-muted";
const HIT_MIN_INTERVAL_MS = 70;

/** @type {AudioContext | null} */
let ctx = null;
let muted = readMuted();
let lastHitAt = 0;
let unlocked = false;

function readMuted() {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMuted(value) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}

function canUseAudio() {
  return typeof globalThis.AudioContext === "function" || typeof globalThis.webkitAudioContext === "function";
}

function getCtx() {
  if (!canUseAudio()) return null;
  if (!ctx) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    ctx = new AC();
  }
  return ctx;
}

/** Call from a user gesture so browsers allow playback. */
export function unlockAudio() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") {
    c.resume().catch(() => {});
  }
  unlocked = true;
}

export function isMuted() {
  return muted;
}

export function setMuted(next) {
  muted = Boolean(next);
  writeMuted(muted);
  if (!muted) unlockAudio();
  return muted;
}

export function toggleMute() {
  return setMuted(!muted);
}

function masterGain(c, level) {
  const g = c.createGain();
  g.gain.value = muted || !unlocked ? 0 : level;
  g.connect(c.destination);
  return g;
}

function tone(c, { freq, dur = 0.12, type = "square", gain = 0.08, slideTo = null, delay = 0 }) {
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(masterGain(c, 1));
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(c, { dur = 0.08, gain = 0.05, delay = 0 }) {
  const t0 = c.currentTime + delay;
  const samples = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, samples, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < samples; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / samples);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const g = c.createGain();
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 900;
  filter.Q.value = 0.7;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(masterGain(c, 1));
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

function playSafe(fn) {
  if (muted) return;
  const c = getCtx();
  if (!c || !unlocked) return;
  if (c.state === "suspended") {
    c.resume().catch(() => {});
  }
  try {
    fn(c);
  } catch {
    /* ignore audio graph errors */
  }
}

/** Successful card deploy. */
export function playDeploy(side = "player") {
  playSafe((c) => {
    const base = side === "player" ? 420 : 320;
    const gain = side === "player" ? 0.07 : 0.045;
    tone(c, { freq: base, slideTo: base * 1.45, dur: 0.1, type: "triangle", gain });
    tone(c, { freq: base * 1.5, dur: 0.06, type: "square", gain: gain * 0.45, delay: 0.04 });
  });
}

/** Soft reject / invalid drop. */
export function playInvalid() {
  playSafe((c) => {
    tone(c, { freq: 180, slideTo: 110, dur: 0.14, type: "sawtooth", gain: 0.045 });
  });
}

/** Throttled melee / projectile hit tick. */
export function playHit() {
  const now = performance.now?.() ?? Date.now();
  if (now - lastHitAt < HIT_MIN_INTERVAL_MS) return;
  lastHitAt = now;
  playSafe((c) => {
    noiseBurst(c, { dur: 0.045, gain: 0.04 });
    tone(c, { freq: 220 + Math.random() * 80, dur: 0.04, type: "square", gain: 0.03 });
  });
}

/** Outpost destroyed. */
export function playOutpostFall(friendlyLost = false) {
  playSafe((c) => {
    const low = friendlyLost ? 140 : 180;
    tone(c, { freq: low, slideTo: low * 0.55, dur: 0.35, type: "sine", gain: 0.09 });
    noiseBurst(c, { dur: 0.22, gain: friendlyLost ? 0.07 : 0.055, delay: 0.02 });
    tone(c, {
      freq: friendlyLost ? 260 : 360,
      slideTo: friendlyLost ? 160 : 240,
      dur: 0.2,
      type: "triangle",
      gain: 0.05,
      delay: 0.08,
    });
  });
}

/** Sudden-death tempo shift. */
export function playSudden() {
  playSafe((c) => {
    tone(c, { freq: 440, dur: 0.12, type: "square", gain: 0.06 });
    tone(c, { freq: 554, dur: 0.12, type: "square", gain: 0.05, delay: 0.1 });
    tone(c, { freq: 659, dur: 0.18, type: "square", gain: 0.055, delay: 0.2 });
  });
}

/** Match end sting. */
export function playOutcome(outcome) {
  playSafe((c) => {
    if (outcome === "win") {
      tone(c, { freq: 392, dur: 0.14, type: "triangle", gain: 0.07 });
      tone(c, { freq: 494, dur: 0.14, type: "triangle", gain: 0.07, delay: 0.12 });
      tone(c, { freq: 587, dur: 0.28, type: "triangle", gain: 0.08, delay: 0.24 });
      return;
    }
    if (outcome === "lose") {
      tone(c, { freq: 330, slideTo: 180, dur: 0.35, type: "sawtooth", gain: 0.06 });
      tone(c, { freq: 220, slideTo: 110, dur: 0.4, type: "triangle", gain: 0.05, delay: 0.12 });
      return;
    }
    // draw / time-up
    tone(c, { freq: 300, dur: 0.16, type: "triangle", gain: 0.05 });
    tone(c, { freq: 300, dur: 0.2, type: "triangle", gain: 0.045, delay: 0.2 });
  });
}
