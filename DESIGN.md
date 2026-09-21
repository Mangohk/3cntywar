# 3cntywar — Design Document (v0.1)

**Working title:** 3cntywar (Three Countries War)  
**Genre:** Real-time lane skirmish (Clash Royale–inspired)  
**Theme:** Romance of the Three Kingdoms (三国演义)  
**Platform:** Single HTML page + vanilla JavaScript (2D canvas)  
**Mode:** Player vs Computer only（玩家 vs 電腦）  
**Audience:** Prototype / playable proof of concept

---

## 1. Goal of v0.1

Ship the smallest fun loop that proves the fantasy:

> Deploy Three Kingdoms heroes onto a simple 2D battlefield, spend a regenerating resource, fight automatic battles in lanes against a computer opponent, and destroy the enemy main camp.

This version is intentionally **not** a full Clash Royale clone. It is a vertical slice with **one local PvE mode** (human vs AI), one map, and a tiny roster.

**Confirmed for v0.1:** 唔需要網上對戰 / matchmaking / 真人對戰。只要玩家可以同電腦打一場即可。

---

## 2. Non-goals (explicitly out of v0.1)

| Out of scope | Why |
|---|---|
| Online multiplayer / matchmaking / PvP | v0.1 只做玩家 vs 電腦 |
| Local hot-seat two-player | Can wait until a later version |
| Card collection, levels, upgrades, shop | Meta systems come later |
| Full 3D or isometric art | Keep rendering simple |
| Complex pathfinding / free movement | Use fixed lanes |
| Spells with targeting UI beyond tap-to-deploy | Reduce input complexity |
| Clan / chat / progression | Not needed to validate combat |
| Authentic historical accuracy | Prioritize readable game fantasy |

---

## 3. Player fantasy

Players are warlords commanding Wei, Shu, or Wu. Instead of fantasy troops, they deploy famous generals and soldiers from the Three Kingdoms era. Battles feel like short river-crossing skirmishes on a narrow front.

**Tone:** bold, readable, slightly theatrical — not dense strategy-sim.

---

## 4. Core loop (30–90 second matches)

1. Match starts with both sides having a **Main Camp** and two **Outposts**.
2. **Qi** (气, the elixir analog) regenerates over time.
3. Player chooses a card from a hand of 4 and deploys it on their half of a lane.
4. Units auto-walk toward the enemy, auto-target, and fight.
5. Destroying an enemy Outpost opens pressure; destroying the **Main Camp** wins.
6. Soft timer: after ~90s, Qi regenerates faster (sudden death pressure). Hard timeout optional.

---

## 5. Simplified game board

### 5.1 Layout

A top-down 2D rectangle (portrait orientation, Clash Royale–like):

```
┌────────────────────────────┐
│        ENEMY MAIN CAMP     │
│   [Outpost L]  [Outpost R] │
│                            │
│      LEFT LANE | RIGHT     │
│         ░░░░░  |  ░░░░░    │  ← river / bridge band
│      LEFT LANE | RIGHT     │
│                            │
│   [Outpost L]  [Outpost R] │
│        PLAYER MAIN CAMP    │
│                            │
│   [Hand: 4 cards]  Qi bar  │
└────────────────────────────┘
```

### 5.2 Spatial rules (v0.1)

- **2 lanes** only (left / right).
- Each lane has a **bridge band** in the middle. Ground units must cross the bridge to enter the enemy half.
- Units cannot freely change lanes after deploy (no lane-switching AI in v0.1).
- Deploy zone: player may place units only on **their half** of either lane (including just behind the bridge).
- Buildings (camps / outposts) are fixed rectangles with hitboxes; they do not move.

### 5.3 Visual style (prototype)

- Flat colored shapes + simple sprites or emoji/placeholders are fine.
- Distinct faction colors: Wei blue-gray, Shu green, Wu crimson-gold (choose one player faction for v0.1; enemy uses a contrasting faction).
- Clear HP bars on units and buildings.
- No particle-heavy VFX required.

---

## 6. Factions & cards (troops)

### 6.1 Faction framing

For v0.1, the player always plays as **Shu**, the AI as **Wei**. (Faction select can come later.)

### 6.2 Starter roster (8 cards total; deck = 8, hand = 4)

Keep costs in a Clash Royale–like 1–6 range. **Qi** replaces elixir.

| Card | Cost | Role | Notes |
|---|---:|---|---|
| Militia (步兵) | 2 | Swarm / cheap tanklet | Melee, low HP, low damage |
| Crossbowmen (弓手) | 3 | Ranged DPS | Targets nearest enemy in lane |
| Cavalry (骑兵) | 4 | Fast melee | High speed, medium HP |
| Spearman (枪兵) | 3 | Anti-cavalry melee | Bonus damage vs Cavalry |
| Zhuge Liang (诸葛亮) | 5 | Support / area | Slow projectile or small AoE “fire attack” |
| Guan Yu (关羽) | 5 | Elite melee | High HP / high damage single target |
| Zhang Fei (张飞) | 4 | Bruiser | Splash melee (small radius) |
| Catapult (投石车) | 6 | Siege | Prefer buildings; slow, long range |

**Deck rule (v0.1):** fixed starter deck of these 8. No customization UI yet.

**Hand / cycle:**
- Start with 4 random cards from the deck.
- After playing a card, draw the next from the remaining cycle (classic Clash Royale cycle).
- No card levels.

### 6.3 Unit stats (illustrative baseline)

Use a shared schema; tune in playtests:

```
{
  id, name, cost, role,
  hp, damage, attackSpeedSec,
  range, sightRange, moveSpeed,
  targetPreference: "any" | "buildings" | "troops",
  splashRadius?: number,
  traits?: ["anti_cavalry", "fast", ...]
}
```

Exact numbers live in `data/cards.js` and are expected to change often.

---

## 7. Resource: Qi (气)

- Starts at **5 / 10**.
- Regenerates at **1 Qi / 2.8s** (tuneable).
- After sudden-death mark (~90s), regenerates at **1 Qi / 1.4s**.
- Cannot play a card if cost > current Qi.
- No double-Qi potions or other economy cards in v0.1.

---

## 8. Combat model (simplified)

### 8.1 Targeting

1. Each troop has a **sight range** (varies by type; always ≥ attack range).
2. Unit looks for the **nearest** valid enemy **in the same lane** that is currently inside its sight range.
3. If none are in sight, walk forward toward the enemy end of the lane.
4. Once a target is acquired, approach it and fight until it dies (sticky chase).
5. Buildings are valid targets when they enter sight.
6. Ranged units stop at max attack range; melee close to contact.

### 8.2 Damage

- Attacks are discrete ticks (`damage` every `attackSpeedSec`).
- Armor / shields: none in v0.1.
- Death: remove unit; no death skills.

### 8.3 Buildings

| Building | HP (example) | Attack |
|---|---:|---|
| Outpost | 2000 | Slow ranged shot at nearest enemy in its lane half |
| Main Camp | 3000 | Same, slightly stronger |

When both Outposts on one side are destroyed, Main Camp becomes more exposed (no special mechanic beyond open pathing already present).

### 8.4 Win / lose

- Destroy enemy **Main Camp** → win.
- Own Main Camp destroyed → lose.
- Optional: if timer hits 3:00 with both camps alive, higher remaining Main Camp HP wins (tie if equal).

---

## 9. Controls & UX

### Desktop (primary for prototype)

- Click a card in the hand → selected.
- Click / drag on valid deploy cell in a lane → spawn unit, spend Qi, cycle card.
- Invalid deploy flashes red briefly.
- Esc / click elsewhere cancels selection.

### Mobile (nice-to-have)

- Tap card, tap lane position. Same rules.

### HUD

- Top: enemy Qi not shown (or shown only in debug).
- Bottom: hand (4 cards with cost badges), Qi bar, match timer.
- Minimal menus: Start / Retry / Back to title.

---

## 10. AI opponent (v0.1) — the only opponent

v0.1 只有呢一種對戰方式：**玩家（人手） vs 電腦 AI**。冇伺服器、冇房間碼、冇網路同步。

Very dumb but playable:

1. Maintain a target Qi reserve (e.g. try to spend when Qi ≥ 4).
2. Weighted random card from hand that is affordable.
3. Deploy in the lane where the player currently has more unit HP (reactive), else random.
4. Prefer Catapult / elite when an outpost is under attack and Qi allows.

No perfect defense. Goal is a punching bag with occasional pressure.

---

## 11. Technical design

### 11.1 Stack

- `index.html` — structure + HUD markup
- `styles.css` — layout, HUD, board chrome
- `js/main.js` — boot, loop
- `js/game.js` — match state machine
- `js/board.js` — lanes, positions, deploy validation
- `js/entities.js` — units, buildings, projectiles
- `js/combat.js` — targeting & damage
- `js/cards.js` — card definitions + deck/hand cycle
- `js/ai.js` — opponent brain
- `js/render.js` — canvas draw
- `js/input.js` — pointer handling
- `js/ui.js` — HUD updates

No build step required for v0.1. Open `index.html` locally or serve with any static server.

### 11.2 Game loop

```
requestAnimationFrame(dt):
  updateQi(dt)
  updateAI(dt)
  updateUnits(dt)      // move
  resolveCombat(dt)    // attack ticks
  cleanupDead()
  checkWinLose()
  render()
```

Fixed logic step optional later; variable `dt` clamped (e.g. max 50ms) is enough for prototype.

### 11.3 Coordinate system

- Board in normalized units: `x` in lane slots, `y` from 0 (player side) to 1 (enemy side).
- Bridge band: `y ∈ [0.45, 0.55]`.
- Render maps normalized coords → canvas pixels.

### 11.4 State machine

`TITLE → MATCH_RUNNING → MATCH_OVER`

---

## 12. Content presentation (theme skin)

Replace Clash Royale vocabulary:

| Clash-like term | 3cntywar term |
|---|---|
| Elixir | Qi (气) |
| Towers | Outposts (营寨) |
| King Tower | Main Camp (大营) |
| Cards / Troops | Generals & Companies (将 / 部曲) |
| Arena | Battlefield (战场) |

Flavor text on cards can be one short line (optional in v0.1 UI).

---

## 13. Acceptance criteria for v0.1

v0.1 is done when a player can:

1. Start a match from a title screen.
2. See a 2-lane board with camps and outposts.
3. Spend regenerating Qi to deploy at least the 8 starter cards.
4. Watch units path across the bridge and fight automatically.
5. Destroy structures and win/lose against the basic AI (no online play required).
6. Restart the match without refreshing the page.

Bonus (stretch, not required):

- Sudden-death Qi speed-up
- Simple win/lose banner with faction art placeholder
- Mute toggle / basic SFX

---

## 14. Suggested implementation order

1. **Board shell** — canvas, lanes, buildings drawn, HUD chrome  
2. **Qi + hand UI** — spend/regen, cycle 4-from-8  
3. **Deploy + move** — spawn, walk in lane, bridge gate  
4. **Combat** — target, damage, death, building attacks  
5. **Win conditions** — Main Camp HP → match over  
6. **AI** — affordable random deploys with light lane reaction  
7. **Polish** — timers, feedback flashes, restart  

---

## 15. Risks & tuning notes

- **Lane boredom:** with only 2 lanes, matches can stalemate — mitigate with siege card and sudden-death Qi.
- **Hero power creep:** keep Guan Yu / Zhuge Liang strong but expensive; cheap swarm must still matter.
- **Click precision:** use generous deploy hit areas, not tiny pixels.
- **Balance:** ship numbers that feel readable first; balance second.

---

## 16. Next versions (preview only)

- **v0.2:** faction select (Wei / Shu / Wu), unique starter decks  
- **v0.3:** 1–2 spell cards (e.g. Fire Attack, Ambush)  
- **v0.4:** optional local hot-seat or simple P2P (still not required for the prototype)  
- **v1.0:** progression / card levels / more authentic map skins  

These are placeholders and do not expand v0.1 scope. Online multiplayer remains out of scope unless explicitly requested later.

---

## 17. One-line summary

**v0.1 is a single-page, offline, player-vs-computer, 2-lane Qi-driven Three Kingdoms skirmish where a fixed 8-card deck fights a dumb AI to destroy the enemy Main Camp.**
