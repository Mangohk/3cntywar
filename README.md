# 三國誌版皇室戰爭 — POC v1.2

Playable dual-track prototype (**軍令** deploy + **士氣** stratagems) on an **open field**.

**Live:** https://mangohk.github.io/3cntywar/

Open `index.html` or use any static server. Controls: 開戰 → select card → tap own half to deploy → click own unit to cast when 士氣 is ready.

**v1.2:** Full open arena (no bridge chokepoints / lane rails). Units acquire nearest enemy troop within `aggroRange = 150` world px; otherwise advance toward the nearest enemy tower.

Files: `index.html`, `style.css`, `game.js`.
