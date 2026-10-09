# 三國誌版皇室戰爭 — POC v1.6

Playable dual-track prototype (**軍令** deploy + **士氣** stratagems) on an **open field**.

**Live:** https://mangohk.github.io/3cntywar/

Open `index.html` or use any static server. Controls: 開戰 → select card → tap own half to deploy → click own unit to cast when 士氣 is ready.

**v1.6:** Per-unit troop aggro = **attack range × 1.1** (replaces v1.5 `range + 10`). Sticky leash stays `1.75 × aggroRange`. Towers keep their own range. Half-field building lock + 2-unit cap / pacing unchanged.

**v1.5:** Per-unit troop aggro = **attack range + 10** (no global `AGGRO = 90`). Sticky leash stays `1.75 × aggroRange` so melee does not leash across the map. Towers keep their own range. Half-field building lock + 2-unit cap / pacing unchanged.

**v1.4:** Shorter troop aggro (`150→90`). Units only lock enemy **buildings** after crossing the mid river / half-field; before mid they only acquire enemy **troops** in range (else advance with no tower lock). Nearby troops still beat buildings whenever in aggro.

**v1.3:** Each side may have at most **2 living units** on the field (deploy blocked at cap; cards dim + toast). Troop 軍令 costs raised; overall pace slowed (move / attack / 軍令·士氣 regen / later 加速 / tougher towers).

**v1.2:** Full open arena (no bridge chokepoints / lane rails). Units acquire nearest enemy troop within aggro; otherwise advance toward the nearest enemy tower (from v1.4: only after mid).

### Targeting levers (v1.6)

- `aggroRange(u) = u.def.range × 1.1` (甘寧 24.2 / 張飛 28.6 / 黃忠 132 / 關羽 26.4)
- Sticky leash `1.75 × aggroRange(u)` (melee ~42–50; 黃忠 231)
- Building lock gated by `hasCrossedMid` (player `y < MID_Y`, AI `y > MID_Y`)
- §1 troops-in-aggro still outrank towers; towers use `TOWER.range` only

### Pacing levers (v1.3, unchanged)

- Field unit cap `2` per side
- Card costs +1 each (甘寧 2 / 黃忠·關羽 3 / 張飛 4)
- Move speeds ~28% slower; `atkCd` ~25–30% longer
- 軍令 regen `1/2.8→1/3.4` (double `1/1.4→1/1.7`); 士氣 `1/9.5→1/11.5`
- Double 軍令 starts later (`DOUBLE_AT` 120→140 → last 40s)
- Tower HP up; unit→tower damage `0.85→0.78`

Files: `index.html`, `style.css`, `game.js`.
