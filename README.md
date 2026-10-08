# 三國誌版皇室戰爭 — POC v1.4

Playable dual-track prototype (**軍令** deploy + **士氣** stratagems) on an **open field**.

**Live:** https://mangohk.github.io/3cntywar/

Open `index.html` or use any static server. Controls: 開戰 → select card → tap own half to deploy → click own unit to cast when 士氣 is ready.

**v1.4:** Shorter troop aggro (`150→90`). Units only lock enemy **buildings** after crossing the mid river / half-field; before mid they only acquire enemy **troops** in range (else advance with no tower lock). Nearby troops still beat buildings whenever in aggro.

**v1.3:** Each side may have at most **2 living units** on the field (deploy blocked at cap; cards dim + toast). Troop 軍令 costs raised; overall pace slowed (move / attack / 軍令·士氣 regen / later 加速 / tougher towers).

**v1.2:** Full open arena (no bridge chokepoints / lane rails). Units acquire nearest enemy troop within aggro; otherwise advance toward the nearest enemy tower (from v1.4: only after mid).

### Targeting levers (v1.4)

- `AGGRO = 90` (was 150); sticky leash `1.75 × AGGRO` (~157.5)
- Building lock gated by `hasCrossedMid` (player `y < MID_Y`, AI `y > MID_Y`)
- §1 troops-in-aggro still outrank towers

### Pacing levers (v1.3, unchanged)

- Field unit cap `2` per side
- Card costs +1 each (甘寧 2 / 黃忠·關羽 3 / 張飛 4)
- Move speeds ~28% slower; `atkCd` ~25–30% longer
- 軍令 regen `1/2.8→1/3.4` (double `1/1.4→1/1.7`); 士氣 `1/9.5→1/11.5`
- Double 軍令 starts later (`DOUBLE_AT` 120→140 → last 40s)
- Tower HP up; unit→tower damage `0.85→0.78`

Files: `index.html`, `style.css`, `game.js`.
