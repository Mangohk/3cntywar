/**
 * Headless check that audio module imports and mute API works without AudioContext.
 * Run: node tools/audio.mjs
 */

import { isMuted, setMuted, sfx, toggleMute, unlockAudio } from "../js/audio.js";

unlockAudio();
sfx.ui();
sfx.deploy();
sfx.deny();
sfx.hit();
sfx.death();
sfx.buildingHit();
sfx.buildingDestroy();
sfx.suddenDeath();
sfx.win();
sfx.lose();

const before = isMuted();
setMuted(true);
if (!isMuted()) {
  console.error("FAIL: setMuted(true) did not mute");
  process.exit(1);
}
sfx.hit(); // should no-op while muted
toggleMute();
if (isMuted() === true && before === false) {
  console.error("FAIL: toggleMute did not unmute");
  process.exit(1);
}
setMuted(before);

console.log("OK", { muted: isMuted() });
