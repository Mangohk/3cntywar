/**
 * 三國誌版皇室戰爭 — POC v1.3
 * Open-field realtime auto-battler with 軍令 (deploy) + 士氣 (stratagem).
 * v1.3: 2-unit field cap + slower pacing (costs / move / atk / regens).
 */
(() => {
  "use strict";

  // ── Tunables (playable band: ~2–4 stratagems / match) ─────────────
  const W = 420;
  const H = 640;
  const MATCH_SEC = 180;
  const OVERTIME_SEC = 60;
  // Double 軍令 when timeLeft <= MATCH_SEC - DOUBLE_AT (last 40s; longer early phase)
  const DOUBLE_AT = 140;

  const JUNLING_CAP = 10;
  const JUNLING_START = 5;
  const JUNLING_REGEN = 1 / 3.4; // per second (~18% slower than v1.2's 1/2.8)
  const JUNLING_REGEN_DBL = 1 / 1.7;

  const SHIQI_CAP = 10;
  const SHIQI_START = 0.5;
  const SHIQI_REGEN = 1 / 11.5; // slower → fewer constant stratagems

  // Max living units per side on the field at once
  const MAX_FIELD_UNITS = 2;

  // Acquisition / aggro radius (world px). Units only lock troops inside this.
  const AGGRO = 150;
  const STICKY_LEASH = AGGRO * 1.75; // drop sticky troop chase beyond this
  const MID_Y = H / 2;
  const RIVER_TOP = MID_Y - 22;
  const RIVER_BOT = MID_Y + 22;

  // Arena geometry — open field; side towers still sit left/right
  const TOWER_X = { L: 105, R: 315 };
  const MID_X = W / 2;
  const FIELD_PAD = 28;

  // Unit→tower damage multiplier (lower = pushes last longer)
  const UNIT_VS_TOWER = 0.78;

  // Tower HP (slightly higher so pushes last longer)
  const TOWER = {
    sideHp: 1550,
    kingHp: 2650,
    sideDps: 55,
    kingDps: 70,
    range: 110,
    radius: 28,
  };

  const TYPE_MUL = {
    // attacker vs defender: 騎剋弓, 弓剋槍, 槍剋騎
    騎: { 弓: 1.45, 槍: 0.7, 騎: 1 },
    槍: { 騎: 1.45, 弓: 0.7, 槍: 1 },
    弓: { 槍: 1.45, 騎: 0.7, 弓: 1 },
  };

  const CARDS = {
    ganning: {
      id: "ganning",
      name: "甘寧",
      type: "騎",
      cost: 2, // was 1 — still cheapest cycle
      stratCost: 3,
      stratName: "錦帆奇襲",
      stratDesc: "加速衝塔・部隊不鎖",
      hp: 280,
      dmg: 48,
      atkCd: 0.72, // was 0.55
      speed: 56, // was 78 (~28% slower)
      range: 22,
      radius: 12,
      color: "#c96a6a",
      splash: 0,
    },
    zhangfei: {
      id: "zhangfei",
      name: "張飛",
      type: "槍",
      cost: 4, // was 3 — still most expensive
      stratCost: 5,
      stratName: "燕人咆哮",
      stratDesc: "錐形擊退＋緩速",
      hp: 980,
      dmg: 72,
      atkCd: 1.15, // was 0.9
      speed: 30, // was 42
      range: 26,
      radius: 16,
      color: "#5a8ec8",
      splash: 38,
    },
    huangzhong: {
      id: "huangzhong",
      name: "黃忠",
      type: "弓",
      cost: 3, // was 2
      stratCost: 4,
      stratName: "百步穿楊",
      stratDesc: "點殺最高威脅",
      hp: 320,
      dmg: 95,
      atkCd: 1.35, // was 1.05
      speed: 27, // was 38
      range: 120,
      radius: 12,
      color: "#7aad4a",
      splash: 0,
      ranged: true,
    },
    guanyu: {
      id: "guanyu",
      name: "關羽",
      type: "騎",
      cost: 3, // was 2
      stratCost: 6,
      stratName: "過關斬將",
      stratDesc: "強化・鎖最高血",
      hp: 620,
      dmg: 88,
      atkCd: 0.95, // was 0.75
      speed: 42, // was 58
      range: 24,
      radius: 14,
      color: "#c85050",
      splash: 0,
    },
  };

  const CARD_ORDER = ["ganning", "zhangfei", "huangzhong", "guanyu"];

  // ── State ─────────────────────────────────────────────────────────
  const canvas = document.getElementById("arena");
  const ctx = canvas.getContext("2d");

  let running = false;
  let ended = false;
  let lastTs = 0;
  let timeLeft = MATCH_SEC;
  let overtime = false;
  let entitySeq = 1;
  let floatTexts = [];
  let fx = [];

  const player = makeSide(true);
  const ai = makeSide(false);

  let selectedCard = null;
  let deployGhost = null;
  let toastTimer = 0;
  let shiqiReadyTipShown = false;
  let animT = 0;
  let audioCtx = null;

  function makeSide(isPlayer) {
    const deck = shuffle([...CARD_ORDER]);
    return {
      isPlayer,
      junling: JUNLING_START,
      shiqi: SHIQI_START,
      hand: deck.slice(0, 4), // all 4 visible (full cycle)
      cycle: deck.slice(), // order for next draw after play — with 4 cards, hand IS the cycle; rotate on play
      crowns: 0,
      towers: null, // filled in resetArena
      units: [],
      nextAiThink: 0,
    };
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function resetArena() {
    player.junling = JUNLING_START;
    ai.junling = JUNLING_START;
    player.shiqi = SHIQI_START;
    ai.shiqi = SHIQI_START;
    player.crowns = 0;
    ai.crowns = 0;
    player.units = [];
    ai.units = [];
    player.hand = shuffle([...CARD_ORDER]);
    ai.hand = shuffle([...CARD_ORDER]);
    clampResources(player);
    clampResources(ai);
    timeLeft = MATCH_SEC;
    overtime = false;
    ended = false;
    floatTexts = [];
    fx = [];
    entitySeq = 1;
    selectedCard = null;
    shiqiReadyTipShown = false;
    animT = 0;

    player.towers = {
      L: mkTower("L", true, false),
      R: mkTower("R", true, false),
      K: mkTower("K", true, true),
    };
    ai.towers = {
      L: mkTower("L", false, false),
      R: mkTower("R", false, false),
      K: mkTower("K", false, true),
    };
  }

  function mkTower(lane, isPlayer, isKing) {
    const y = isKing
      ? isPlayer
        ? H - 48
        : 48
      : isPlayer
        ? H - 130
        : 130;
    const x = isKing ? MID_X : TOWER_X[lane];
    return {
      id: entitySeq++,
      kind: "tower",
      lane: isKing ? "K" : lane,
      isKing,
      isPlayer,
      x,
      y,
      hp: isKing ? TOWER.kingHp : TOWER.sideHp,
      maxHp: isKing ? TOWER.kingHp : TOWER.sideHp,
      alive: true,
      atkCd: 0,
      radius: isKing ? 32 : TOWER.radius,
      target: null,
    };
  }

  // ── Deploy / units ────────────────────────────────────────────────
  function livingCount(side) {
    return side.units.filter((u) => u.alive).length;
  }

  function atUnitCap(side) {
    return livingCount(side) >= MAX_FIELD_UNITS;
  }

  /** Tap any point in own half; x/y clamped to playable bounds. Soft left/right tag from x. */
  function deploy(side, cardId, xHint, yHint) {
    const def = CARDS[cardId];
    if (!def || side.junling < def.cost - 0.001) return false;
    if (!side.hand.includes(cardId)) return false;
    if (atUnitCap(side)) return false;

    // Deploy only on own half (mid river band is the midline)
    const halfOk = side.isPlayer
      ? yHint >= MID_Y - 8
      : yHint <= MID_Y + 8;
    if (!halfOk && side.isPlayer) return false;

    side.junling -= def.cost;
    // rotate hand (cycle)
    const idx = side.hand.indexOf(cardId);
    side.hand.splice(idx, 1);
    side.hand.push(cardId);

    let x = clamp(xHint ?? MID_X, FIELD_PAD, W - FIELD_PAD);
    let y;
    if (side.isPlayer) {
      y = clamp(yHint || H - 200, MID_Y + 8, H - 150);
    } else {
      y = clamp(yHint || 200, 150, MID_Y - 8);
    }
    // Soft region tag for AI pressure / tower labels only — not a movement rail
    const lane = x < MID_X ? "L" : "R";

    const u = {
      id: entitySeq++,
      kind: "unit",
      cardId,
      def,
      name: def.name,
      type: def.type,
      lane,
      isPlayer: side.isPlayer,
      x,
      y,
      hp: def.hp,
      maxHp: def.hp,
      atkCd: 0.15,
      target: null,
      alive: true,
      crossed: false,
      stealth: 0, // ganning strat: troops ignore
      speedMul: 1,
      dmgMul: 1,
      toughMul: 1,
      slow: 0,
      strat: null, // { kind, t }
      spawnT: performance.now(),
      pulse: 0,
    };
    side.units.push(u);
    clampResources(side);
    spawnFloat(x, y - 20, def.name, side.isPlayer ? "#8af" : "#e88");
    if (side.isPlayer) beep(520, 0.04, "square", 0.03);
    return true;
  }

  function tryStratagem(side, unit) {
    if (!unit || !unit.alive || unit.isPlayer !== side.isPlayer) return false;
    const def = unit.def;
    if (side.shiqi < def.stratCost - 0.001) return false;

    side.shiqi -= def.stratCost;
    clampResources(side);
    unit.pulse = 0.85;
    unit.castFlash = 0.55;

    // Clear cast feedback: name + 士氣 cost
    spawnFloat(unit.x, unit.y - 34, def.stratName, "#7dffc0");
    spawnFloat(unit.x, unit.y - 18, `-${def.stratCost} 士氣`, "#ffe08a");
    fx.push({ kind: "castBurst", x: unit.x, y: unit.y, t: 0.55, r: 48, lane: unit.lane });
    if (side.isPlayer) {
      triggerCastFlash(unit.lane);
      beep(880, 0.08, "sine", 0.05);
      beep(1175, 0.1, "sine", 0.035);
      showToast(`${def.stratName}！ −${def.stratCost} 士氣`, "good", 1.4);
    }

    if (def.id === "ganning") {
      unit.strat = { kind: "rush", t: 4.5 };
      unit.stealth = 4.5;
      unit.speedMul = 1.7;
      unit.target = null;
    } else if (def.id === "zhangfei") {
      roar(unit);
      unit.strat = { kind: "roar", t: 0.4 };
    } else if (def.id === "huangzhong") {
      pierce(side, unit);
      unit.strat = { kind: "pierce", t: 0.8 };
    } else if (def.id === "guanyu") {
      unit.strat = { kind: "duel", t: 5 };
      unit.dmgMul = 1.55;
      unit.toughMul = 1.4;
      unit.speedMul = 1.25;
      unit.target = null;
    }
    return true;
  }

  function roar(unit) {
    const foes = enemyUnits(unit).filter((e) => e.alive);
    const facing = unit.isPlayer ? -1 : 1;
    for (const e of foes) {
      const dx = e.x - unit.x;
      const dy = e.y - unit.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 95) continue;
      // cone in forward direction
      const forward = dy * facing;
      if (forward < -10) continue;
      if (Math.abs(dx) > 70 + dist * 0.15) continue;
      e.y += facing * -28; // knock toward enemy side from zhangfei perspective: push away
      // knock away from caster
      const nx = dist > 1 ? dx / dist : 0;
      const ny = dist > 1 ? dy / dist : facing;
      e.x += nx * 36;
      e.y += ny * 36;
      e.slow = Math.max(e.slow, 2.8);
      e.hp -= 40;
      if (e.hp <= 0) killUnit(e);
      fx.push({ kind: "shock", x: unit.x, y: unit.y, t: 0.35, r: 90 });
    }
  }

  function pierce(side, caster) {
    const foes = enemyUnits(caster).filter((e) => e.alive);
    if (!foes.length) {
      spawnFloat(caster.x, caster.y - 40, "無目標", "#aaa");
      return;
    }
    // threat = card cost, then higher hp%, then nearer
    foes.sort((a, b) => {
      const ca = a.def.cost - b.def.cost;
      if (ca) return -ca;
      const ha = a.hp / a.maxHp - b.hp / b.maxHp;
      if (Math.abs(ha) > 0.01) return -ha;
      return dist(caster, a) - dist(caster, b);
    });
    const t = foes[0];
    const dmg = 340 + t.def.cost * 40;
    t.hp -= dmg;
    fx.push({ kind: "arrow", x0: caster.x, y0: caster.y, x1: t.x, y1: t.y, t: 0.35 });
    spawnFloat(t.x, t.y - 24, `穿楊 -${dmg | 0}`, "#ffe08a");
    spawnFloat(t.x, t.y - 40, `鎖 ${t.name}`, "#7dffc0");
    if (t.hp <= 0) killUnit(t);
  }

  function enemyUnits(u) {
    return u.isPlayer ? ai.units : player.units;
  }
  function enemySide(u) {
    return u.isPlayer ? ai : player;
  }
  function ownSide(u) {
    return u.isPlayer ? player : ai;
  }

  function killUnit(u) {
    if (!u.alive) return;
    u.alive = false;
    u.target = null;
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  // ── Targeting (poc-v1-targeting.md — open field + aggroRange) ─────
  function validTroopTarget(self, e) {
    if (!e.alive) return false;
    if (e.stealth > 0) return false; // ganning: troops don't lock
    return true;
  }

  function pickNearest(self, list) {
    let best = null;
    let bestD = Infinity;
    for (const e of list) {
      let d = dist(self, e);
      // stable tie-break: earlier spawn, then id
      if (d < bestD - 0.01 || (Math.abs(d - bestD) < 0.01 && e.id < (best?.id ?? 1e9))) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  function sideTower(side, lane) {
    const t = side.towers[lane];
    return t && t.alive ? t : null;
  }
  function kingTower(side) {
    const t = side.towers.K;
    return t && t.alive ? t : null;
  }

  function aliveTowers(side) {
    const out = [];
    for (const key of ["L", "R", "K"]) {
      const t = side.towers[key];
      if (t?.alive) out.push(t);
    }
    return out;
  }

  function nearestEnemyTower(u) {
    return pickNearest(u, aliveTowers(enemySide(u)));
  }

  function acquireTarget(u) {
    const foes = enemyUnits(u);
    const es = enemySide(u);

    // Stratagem overrides — pause sticky
    if (u.strat?.kind === "rush") {
      // prioritize nearest enemy building (open field — no bridge gate)
      const buildings = aliveTowers(es);
      return pickNearest(u, buildings);
    }
    if (u.strat?.kind === "duel") {
      const troops = foes.filter((e) => e.alive && validTroopTarget(u, e));
      if (troops.length) {
        troops.sort((a, b) => b.hp - a.hp || a.id - b.id);
        return troops[0];
      }
      return nearestEnemyTower(u);
    }

    // §0 sticky current target until dead / invalid / out of reach
    if (u.target && isTargetValid(u, u.target)) return u.target;

    // §1 nearest enemy troop within aggroRange (prefer units over towers)
    const inAggro = foes.filter(
      (e) => validTroopTarget(u, e) && dist(u, e) <= AGGRO
    );
    const nearTroop = pickNearest(u, inAggro);
    if (nearTroop) return nearTroop;

    // §2 no troop in aggro → advance toward nearest enemy tower (open field)
    return nearestEnemyTower(u);
  }

  function isTargetValid(u, t) {
    if (!t || !t.alive) return false;
    if (t.kind === "unit" && t.stealth > 0) return false;
    if (u.strat?.kind === "rush" && t.kind === "unit") return false;
    if (t.kind === "unit" && dist(u, t) > STICKY_LEASH) return false;
    return true;
  }

  // ── Combat / movement ─────────────────────────────────────────────
  function updateUnit(u, dt) {
    if (!u.alive) return;

    // timers
    if (u.stealth > 0) u.stealth = Math.max(0, u.stealth - dt);
    if (u.slow > 0) u.slow = Math.max(0, u.slow - dt);
    if (u.pulse > 0) u.pulse = Math.max(0, u.pulse - dt);
    if (u.castFlash > 0) u.castFlash = Math.max(0, u.castFlash - dt);
    if (u.strat) {
      u.strat.t -= dt;
      if (u.strat.t <= 0) {
        endStrat(u);
      }
    }

    // crossed mid (AI strat heuristic only — not a targeting gate)
    if (u.isPlayer && u.y < RIVER_TOP) u.crossed = true;
    if (!u.isPlayer && u.y > RIVER_BOT) u.crossed = true;

    u.target = acquireTarget(u);
    const t = u.target;
    if (!t) {
      march(u, dt);
      return;
    }

    const d = dist(u, t);
    const range = u.def.range;

    if (d > range) {
      // free path across open field toward target
      moveToward(u, t.x, t.y, dt);
    } else {
      // attack
      u.atkCd -= dt;
      if (u.atkCd <= 0) {
        doAttack(u, t);
        u.atkCd = u.def.atkCd;
      }
    }
  }

  function endStrat(u) {
    const kind = u.strat?.kind;
    u.strat = null;
    u.speedMul = 1;
    u.dmgMul = 1;
    u.toughMul = 1;
    if (kind === "rush") u.stealth = 0;
    u.target = null; // reacquire via §2
  }

  function march(u, dt) {
    // Fallback: push toward enemy side / nearest tower across open field
    const tower = nearestEnemyTower(u);
    if (tower) {
      moveToward(u, tower.x, tower.y, dt);
      return;
    }
    moveToward(u, MID_X, u.isPlayer ? 40 : H - 40, dt);
  }

  function moveToward(u, tx, ty, dt) {
    const dx = tx - u.x;
    const dy = ty - u.y;
    const len = Math.hypot(dx, dy) || 1;
    let spd = u.def.speed * (u.speedMul || 1);
    if (u.slow > 0) spd *= 0.55;
    u.x += (dx / len) * spd * dt;
    u.y += (dy / len) * spd * dt;
    u.x = clamp(u.x, FIELD_PAD, W - FIELD_PAD);
    u.y = clamp(u.y, 20, H - 20);
  }

  function doAttack(u, t) {
    if (!t.alive) return;
    let dmg = u.def.dmg * (u.dmgMul || 1);

    if (t.kind === "unit") {
      const mul = TYPE_MUL[u.type]?.[t.type] || 1;
      dmg *= mul;
      const tough = t.toughMul || 1;
      dmg /= tough;
      t.hp -= dmg;
      if (u.def.splash > 0) {
        for (const e of enemyUnits(u)) {
          if (e === t || !e.alive) continue;
          if (dist(t, e) <= u.def.splash) {
            const sm = TYPE_MUL[u.type]?.[e.type] || 1;
            e.hp -= dmg * 0.45 * sm;
            if (e.hp <= 0) killUnit(e);
          }
        }
      }
      if (t.hp <= 0) killUnit(t);
    } else {
      // tower
      t.hp -= dmg * UNIT_VS_TOWER;
      if (t.hp <= 0) destroyTower(t);
    }
  }

  function destroyTower(t) {
    if (!t.alive) return;
    t.alive = false;
    t.hp = 0;
    const attackerIsPlayer = !t.isPlayer;
    const side = attackerIsPlayer ? player : ai;
    if (t.isKing) {
      side.crowns = Math.max(side.crowns, 3);
      endMatch(attackerIsPlayer ? "主公塔陷落！勝利" : "主公塔陷落…敗北", attackerIsPlayer);
      return;
    }
    side.crowns += 1;
    spawnFloat(t.x, t.y, "破城 +1👑", "#ffe08a");
    if (overtime) {
      endMatch(attackerIsPlayer ? "加時破城！勝利" : "加時破城…敗北", attackerIsPlayer);
    }
  }

  function updateTower(t, dt) {
    if (!t.alive) return;
    t.atkCd -= dt;
    const foes = t.isPlayer ? ai.units : player.units;
    // Towers: nearest in-range enemy unit (finite range — no map-wide vision)
    const cand = foes.filter((e) => e.alive && dist(t, e) <= TOWER.range);
    const target = pickNearest(t, cand);
    t.target = target;
    if (target && t.atkCd <= 0) {
      const dps = t.isKing ? TOWER.kingDps : TOWER.sideDps;
      target.hp -= dps * 0.9;
      t.atkCd = 0.85;
      if (target.hp <= 0) killUnit(target);
    }
  }

  // ── AI (competent trader, not perfect) ────────────────────────────
  function updateAI(dt) {
    ai.nextAiThink -= dt;
    if (ai.nextAiThink > 0) return;
    ai.nextAiThink = 0.45 + Math.random() * 0.55;

    // Stratagem: if shiqi enough and useful unit on field
    if (ai.shiqi >= 3) {
      const mine = ai.units.filter((u) => u.alive);
      // prioritize guanyu duel when fighting, zhangfei when clumped, etc.
      const scored = mine.map((u) => {
        let s = 0;
        const foesNear = player.units.filter((e) => e.alive && dist(u, e) < 100).length;
        if (u.cardId === "guanyu" && ai.shiqi >= 6 && foesNear >= 1) s = 10;
        else if (u.cardId === "zhangfei" && ai.shiqi >= 5 && foesNear >= 2) s = 9;
        else if (u.cardId === "huangzhong" && ai.shiqi >= 4 && player.units.some((e) => e.alive)) s = 7;
        else if (u.cardId === "ganning" && ai.shiqi >= 3 && u.crossed) s = 6;
        else if (ai.shiqi >= u.def.stratCost && foesNear >= 1) s = 3;
        return { u, s };
      });
      scored.sort((a, b) => b.s - a.s);
      if (scored[0]?.s >= 6 && Math.random() < 0.7) {
        tryStratagem(ai, scored[0].u);
        return;
      }
    }

    // Field cap: AI will not deploy past MAX_FIELD_UNITS living units
    if (atUnitCap(ai)) return;

    // Deploy into a left/right region of own half (open field — free x within region)
    const pressureL = regionPressure("L");
    const pressureR = regionPressure("R");
    let region = Math.abs(pressureL) > Math.abs(pressureR) ? "L" : "R";
    if (Math.random() < 0.25) region = region === "L" ? "R" : "L";

    const affordable = ai.hand.filter((id) => CARDS[id].cost <= ai.junling + 0.01);
    if (!affordable.length) return;

    let pick = null;
    const needTank = pressureOn(region) > 0.5; // player pushing that side
    const needCycle = ai.junling >= 7;
    if (needTank && affordable.includes("zhangfei")) pick = "zhangfei";
    else if (needTank && affordable.includes("guanyu")) pick = "guanyu";
    else if (regionHas(player, region, "zhangfei") && affordable.includes("huangzhong")) pick = "huangzhong";
    else if (regionHas(player, region, "huangzhong") && affordable.includes("ganning")) pick = "ganning";
    else if (needCycle && affordable.includes("ganning")) pick = "ganning";
    else pick = affordable.sort((a, b) => CARDS[b].cost - CARDS[a].cost)[0];

    if (!pick) return;
    // don't dump last elixir randomly early — slight hold
    if (ai.junling < CARDS[pick].cost + 0.5 && timeLeft > 140 && Math.random() < 0.4) return;

    const x =
      region === "L"
        ? 60 + Math.random() * 120
        : W - 60 - Math.random() * 120;
    const y = 160 + Math.random() * 70;
    deploy(ai, pick, x, y);

    if (
      pick === "zhangfei" &&
      !atUnitCap(ai) &&
      ai.junling >= CARDS.huangzhong.cost &&
      ai.hand.includes("huangzhong") &&
      Math.random() < 0.45
    ) {
      ai.nextAiThink = 0.55;
    }
  }

  function regionPressure(region) {
    let p = 0;
    for (const u of player.units) if (u.alive && u.lane === region) p += u.def.cost + u.hp / 400;
    for (const u of ai.units) if (u.alive && u.lane === region) p -= u.def.cost + u.hp / 400;
    const pt = player.towers[region];
    const at = ai.towers[region];
    if (pt && at) p += (at.maxHp - at.hp) / 500 - (pt.maxHp - pt.hp) / 500;
    return p;
  }
  function pressureOn(region) {
    return regionPressure(region);
  }
  function regionHas(side, region, cardId) {
    return side.units.some((u) => u.alive && u.lane === region && u.cardId === cardId);
  }

  // ── Resources / match flow ────────────────────────────────────────
  // Double 軍令 in late match (after DOUBLE_AT seconds → timeLeft <= MATCH_SEC - DOUBLE_AT)
  function isDouble() {
    return overtime || timeLeft <= MATCH_SEC - DOUBLE_AT;
  }

  function clampResources(side) {
    side.junling = Math.max(0, Math.min(JUNLING_CAP, side.junling));
    side.shiqi = Math.max(0, Math.min(SHIQI_CAP, side.shiqi));
  }

  function tickResources(side, dt) {
    const rate = isDouble() ? JUNLING_REGEN_DBL : JUNLING_REGEN;
    const prev = side.junling;
    side.junling = Math.min(JUNLING_CAP, side.junling + rate * dt);
    side.shiqi = Math.min(SHIQI_CAP, side.shiqi + SHIQI_REGEN * dt);
    clampResources(side);
    return prev;
  }

  function endMatch(msg, playerWon) {
    if (ended) return;
    ended = true;
    running = false;
    showBanner(msg);
    const ov = document.getElementById("overlay");
    ov.classList.remove("hidden");
    ov.querySelector(".overlay-card").innerHTML = `
      <h1>${playerWon === true ? "勝利" : playerWon === false ? "敗北" : "終局"}</h1>
      <p>${msg}<br />王冠 ${player.crowns} — ${ai.crowns}</p>
      <button id="btn-start" type="button" data-action="start">再戰</button>
    `;
  }

  function resolveTimeUp() {
    if (player.crowns !== ai.crowns) {
      endMatch(
        player.crowns > ai.crowns ? "時間到・王冠較多" : "時間到・王冠較少",
        player.crowns > ai.crowns
      );
      return;
    }
    // tie-break: total tower HP remaining (enemy damage dealt)
    const pDmg = towerDamageDealt(player);
    const aDmg = towerDamageDealt(ai);
    if (Math.abs(pDmg - aDmg) < 30) {
      // sudden death overtime
      if (!overtime) {
        overtime = true;
        timeLeft = OVERTIME_SEC;
        showBanner("加時・突然死亡");
        return;
      }
      endMatch("加時結束・平手", null);
      return;
    }
    endMatch(pDmg > aDmg ? "時間到・推城較多" : "時間到・推城較少", pDmg > aDmg);
  }

  function towerDamageDealt(side) {
    // damage this side dealt to enemy towers
    const es = side.isPlayer ? ai : player;
    let d = 0;
    for (const k of ["L", "R", "K"]) {
      const t = es.towers[k];
      d += t.maxHp - Math.max(0, t.hp);
    }
    return d;
  }

  // ── Loop ──────────────────────────────────────────────────────────
  function frame(ts) {
    if (!running) {
      draw();
      return;
    }
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    animT += dt;

    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      resolveTimeUp();
    }

    tickResources(player, dt);
    tickResources(ai, dt);

    // First-time tip when 士氣 reaches a castable threshold with a unit on field
    if (!shiqiReadyTipShown && running && !ended) {
      const ready = player.units.find((u) => u.alive && player.shiqi >= u.def.stratCost);
      if (ready) {
        shiqiReadyTipShown = true;
        showToast(`士氣足夠！點「${ready.name}」開計略`, "good", 2.4);
        showBanner("可開計略");
      }
    }

    updateAI(dt);

    for (const t of Object.values(player.towers)) updateTower(t, dt);
    for (const t of Object.values(ai.towers)) updateTower(t, dt);

    for (const u of player.units) updateUnit(u, dt);
    for (const u of ai.units) updateUnit(u, dt);

    player.units = player.units.filter((u) => u.alive);
    ai.units = ai.units.filter((u) => u.alive);

    floatTexts = floatTexts.filter((f) => (f.t -= dt) > 0);
    fx = fx.filter((f) => (f.t -= dt) > 0);

    syncUI();
    draw();
    requestAnimationFrame(frame);
  }

  // ── Render ────────────────────────────────────────────────────────
  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawField();
    drawTowers(ai.towers, false);
    drawTowers(player.towers, true);

    // target lines under units
    for (const u of [...ai.units, ...player.units]) {
      if (!u.alive || !u.target || !u.target.alive) continue;
      drawTargetLine(u, u.target);
    }

    for (const u of ai.units) if (u.alive) drawUnit(u);
    for (const u of player.units) if (u.alive) drawUnit(u);

    for (const f of fx) drawFx(f);
    for (const f of floatTexts) {
      ctx.globalAlpha = Math.min(1, f.t * 2);
      ctx.fillStyle = f.color;
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y - (0.6 - f.t) * 28);
      ctx.globalAlpha = 1;
    }

    // Deploy zone: full own half when a card is selected
    if (selectedCard && running && !ended) {
      const pulse = 0.1 + 0.06 * Math.sin(animT * 4);
      const active = !!deployGhost;
      ctx.fillStyle = active
        ? `rgba(255, 220, 120, ${0.14 + pulse})`
        : `rgba(255, 220, 120, ${0.07 + pulse * 0.5})`;
      ctx.fillRect(FIELD_PAD - 8, MID_Y + 4, W - (FIELD_PAD - 8) * 2, H - MID_Y - 28);
      ctx.strokeStyle = active ? "rgba(255, 224, 138, 0.85)" : "rgba(255, 224, 138, 0.4)";
      ctx.lineWidth = active ? 2 : 1;
      ctx.strokeRect(FIELD_PAD - 8, MID_Y + 4, W - (FIELD_PAD - 8) * 2, H - MID_Y - 28);
      ctx.fillStyle = active ? "#ffe08a" : "rgba(255,224,138,0.7)";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("己方半場部署", MID_X, MID_Y + 28);
      if (deployGhost) {
        const def = CARDS[selectedCard];
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(deployGhost.x, deployGhost.y, def.radius + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawField() {
    // open grass field
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, "#3a4a32");
    grd.addColorStop(0.5, "#324028");
    grd.addColorStop(1, "#3a4a32");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // subtle field texture (no lane rails)
    ctx.strokeStyle = "rgba(200,180,120,0.05)";
    ctx.lineWidth = 1;
    for (let y = 40; y < H; y += 36) {
      ctx.beginPath();
      ctx.moveTo(16, y);
      ctx.lineTo(W - 16, y);
      ctx.stroke();
    }

    // enemy / player tint
    ctx.fillStyle = "rgba(180,60,60,0.08)";
    ctx.fillRect(0, 0, W, RIVER_TOP);
    ctx.fillStyle = "rgba(60,100,180,0.08)";
    ctx.fillRect(0, RIVER_BOT, W, H - RIVER_BOT);

    // river band (visual only — no bridges / chokepoints)
    ctx.fillStyle = "#2a4a5c";
    ctx.fillRect(0, RIVER_TOP, W, RIVER_BOT - RIVER_TOP);
    ctx.fillStyle = "rgba(120,180,200,0.15)";
    ctx.fillRect(0, RIVER_TOP + 6, W, 5);

    ctx.fillStyle = "rgba(242,232,213,0.28)";
    ctx.font = "12px serif";
    ctx.textAlign = "center";
    ctx.fillText("開闊戰場", MID_X, MID_Y + 4);
  }

  function drawTowers(towers, isPlayer) {
    for (const key of ["L", "R", "K"]) {
      const t = towers[key];
      if (!t.alive) {
        ctx.fillStyle = "rgba(40,30,20,0.5)";
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.fillStyle = t.isKing ? (isPlayer ? "#3a5a8a" : "#8a3a3a") : isPlayer ? "#4a7ec8" : "#c44b4b";
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1a1208";
      ctx.lineWidth = 2;
      ctx.stroke();
      // crown mark for king
      if (t.isKing) {
        ctx.fillStyle = "#ffe08a";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("王", t.x, t.y + 5);
      } else {
        ctx.fillStyle = "#f2e8d5";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(key === "L" ? "左" : "右", t.x, t.y + 4);
      }
      drawHpBar(t.x, t.y - t.radius - 8, t.hp, t.maxHp, 40);
      if (t.target && t.target.alive) drawTargetLine(t, t.target, true);
    }
  }

  function drawUnit(u) {
    const r = u.def.radius;
    const canCast =
      u.isPlayer && !ended && running && player.shiqi >= u.def.stratCost - 0.001;

    if (u.stealth > 0) ctx.globalAlpha = 0.45;

    // Eligible-unit affordance: pulsing ring + 計 badge
    if (canCast) {
      const pr = r + 12 + Math.sin(animT * 6) * 3;
      ctx.strokeStyle = "rgba(125,255,192,0.95)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(u.x, u.y, pr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(125,255,192,0.12)";
      ctx.beginPath();
      ctx.arc(u.x, u.y, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    if (u.pulse > 0 || u.castFlash > 0) {
      const t = Math.max(u.pulse || 0, u.castFlash || 0);
      ctx.strokeStyle = "#7dffc0";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(u.x, u.y, r + 8 + (0.85 - t) * 28, 0, Math.PI * 2);
      ctx.stroke();
      if (u.castFlash > 0) {
        ctx.fillStyle = `rgba(125,255,192,${u.castFlash * 0.45})`;
        ctx.beginPath();
        ctx.arc(u.x, u.y, r + 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (u.strat?.kind === "duel") {
      ctx.strokeStyle = "#ff6666";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(u.x, u.y, r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (u.strat?.kind === "rush") {
      ctx.strokeStyle = "#ffcc66";
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(u.x, u.y, r + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Body: type-shaped silhouette for stacked readability
    ctx.fillStyle = u.def.color;
    ctx.beginPath();
    if (u.type === "騎") {
      // diamond
      ctx.moveTo(u.x, u.y - r);
      ctx.lineTo(u.x + r, u.y);
      ctx.lineTo(u.x, u.y + r);
      ctx.lineTo(u.x - r, u.y);
      ctx.closePath();
    } else if (u.type === "槍") {
      // square (槍)
      const s = r * 0.85;
      ctx.rect(u.x - s, u.y - s, s * 2, s * 2);
    } else {
      // bow = circle
      ctx.arc(u.x, u.y, r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.strokeStyle = u.isPlayer ? "#8af" : "#e88";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.fillStyle = "#f2e8d5";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(u.name[0], u.x, u.y);

    // Name plate (full name + type)
    const plate = `${u.name}·${u.type}`;
    ctx.font = "bold 10px sans-serif";
    const tw = ctx.measureText(plate).width + 8;
    const py = u.y + r + 12;
    ctx.fillStyle = "rgba(10,12,8,0.72)";
    ctx.fillRect(u.x - tw / 2, py - 8, tw, 14);
    ctx.fillStyle = u.isPlayer ? "#cde4ff" : "#ffd0d0";
    ctx.fillText(plate, u.x, py - 1);

    drawHpBar(u.x, u.y - r - 10, u.hp, u.maxHp, 32);

    if (canCast) {
      ctx.fillStyle = "#0d4a30";
      ctx.beginPath();
      ctx.arc(u.x + r + 2, u.y - r - 2, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#7dffc0";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#7dffc0";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText("計", u.x + r + 2, u.y - r - 2);
    }
    ctx.textBaseline = "alphabetic";
  }

  function drawTargetLine(from, to, thin) {
    ctx.strokeStyle = thin ? "rgba(255,200,100,0.25)" : "rgba(255,230,150,0.45)";
    ctx.lineWidth = thin ? 1 : 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);
    // marker on target
    ctx.fillStyle = thin ? "rgba(255,200,100,0.35)" : "rgba(255,230,150,0.55)";
    ctx.beginPath();
    ctx.arc(to.x, to.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHpBar(x, y, hp, max, w) {
    const h = 4;
    ctx.fillStyle = "#222";
    ctx.fillRect(x - w / 2, y, w, h);
    const pct = clamp(hp / max, 0, 1);
    ctx.fillStyle = pct > 0.35 ? "#5d5" : "#d44";
    ctx.fillRect(x - w / 2, y, w * pct, h);
  }

  function drawFx(f) {
    if (f.kind === "shock") {
      ctx.strokeStyle = `rgba(100,180,255,${Math.min(1, f.t * 2)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * (1.2 - Math.min(1, f.t)), 0, Math.PI * 2);
      ctx.stroke();
    } else if (f.kind === "arrow") {
      const p = 1 - f.t / 0.35;
      const x = f.x0 + (f.x1 - f.x0) * p;
      const y = f.y0 + (f.y1 - f.y0) * p;
      ctx.strokeStyle = "#ffe08a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(f.x0, f.y0);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (f.kind === "castBurst") {
      const a = Math.min(1, f.t * 2);
      ctx.strokeStyle = `rgba(125,255,192,${a})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * (1.6 - f.t), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,224,138,${a * 0.25})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function spawnFloat(x, y, text, color) {
    floatTexts.push({ x, y, text, color, t: 1.25 });
  }

  function showToast(text, kind, sec) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = text;
    el.className = `toast ${kind || ""}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.add("hidden");
    }, (sec || 1.5) * 1000);
  }

  function triggerCastFlash(lane) {
    const el = document.getElementById("cast-flash");
    if (!el) return;
    el.className = `cast-flash lane-${lane || ""}`;
    // restart CSS animation
    void el.offsetWidth;
    setTimeout(() => el.classList.add("hidden"), 450);
  }

  function beep(freq, dur, type, gain) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type || "sine";
      o.frequency.value = freq;
      g.gain.value = gain || 0.04;
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + (dur || 0.06));
      o.stop(audioCtx.currentTime + (dur || 0.06) + 0.02);
    } catch (_) {
      /* audio optional */
    }
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  // ── UI sync ───────────────────────────────────────────────────────
  function syncUI() {
    const m = Math.floor(timeLeft / 60);
    const s = Math.floor(timeLeft % 60);
    document.getElementById("timer").textContent = `${m}:${s.toString().padStart(2, "0")}`;
    const phase = document.getElementById("phase");
    if (overtime) {
      phase.textContent = "加時";
      phase.className = "phase overtime";
    } else if (isDouble()) {
      phase.textContent = "決戰加速";
      phase.className = "phase double";
    } else if (timeLeft > 150) {
      phase.textContent = "前哨";
      phase.className = "phase";
    } else {
      phase.textContent = "指揮";
      phase.className = "phase";
    }
    document.getElementById("crowns").textContent = `👑 ${player.crowns} — ${ai.crowns}`;

    setJunling("pl", player.junling);
    setJunling("ai", ai.junling);
    setShiqi("pl", player.shiqi, player);
    setShiqi("ai", ai.shiqi, ai);

    // Leak warn only when truly at cap (display-clamped)
    const junlingShown = Math.min(JUNLING_CAP, Math.floor(player.junling + 1e-6));
    document.getElementById("leak-warn").classList.toggle(
      "hidden",
      junlingShown < JUNLING_CAP
    );

    const canStrat = player.units.some((u) => u.alive && player.shiqi >= u.def.stratCost);
    document.getElementById("pl-shiqi-orb").classList.toggle("ready", canStrat);
    document.getElementById("shiqi-hint").classList.toggle("flash", canStrat);
    document.getElementById("shiqi-hint").textContent = canStrat
      ? "點發光武將開計略！"
      : player.units.some((u) => u.alive)
        ? "蓄勢中…"
        : "先出兵再蓄勢";

    // Unit-cap indicator under hand hint (don't overwrite active deploy/cast tips)
    const capEl = document.getElementById("unit-cap");
    if (capEl) {
      const n = livingCount(player);
      capEl.textContent = `場上 ${n}/${MAX_FIELD_UNITS}`;
      capEl.classList.toggle("full", n >= MAX_FIELD_UNITS);
    }

    if (atUnitCap(player) && selectedCard) {
      selectedCard = null;
      document.getElementById("hint").textContent =
        `場上已滿（${MAX_FIELD_UNITS}/${MAX_FIELD_UNITS}）— 等部隊倒下再出兵`;
    }

    renderHand();
  }

  function setJunling(prefix, v) {
    // Hard clamp display + fill so UI never shows > cap (playtest saw 11)
    const clamped = Math.max(0, Math.min(JUNLING_CAP, v));
    const shown = Math.min(JUNLING_CAP, Math.floor(clamped + 1e-6));
    const pct = Math.min(100, (clamped / JUNLING_CAP) * 100);
    document.getElementById(`${prefix}-junling-fill`).style.width = `${pct}%`;
    document.getElementById(`${prefix}-junling-num`).textContent = String(shown);
  }

  function setShiqi(prefix, v, side) {
    const clamped = Math.max(0, Math.min(SHIQI_CAP, v));
    // One decimal so charging is visible (floor stayed 0 for ~10s and looked broken)
    document.getElementById(`${prefix}-shiqi-num`).textContent = clamped.toFixed(1);
    const orb = document.getElementById(`${prefix}-shiqi-orb`);
    const ring = document.getElementById(`${prefix}-shiqi-ring`);
    const rateEl = document.getElementById(`${prefix}-shiqi-rate`);
    const minCost = Math.min(...CARD_ORDER.map((id) => CARDS[id].stratCost));
    orb.classList.toggle("dim", clamped < minCost);
    if (ring) {
      const deg = (clamped / SHIQI_CAP) * 100;
      ring.style.background = `conic-gradient(var(--shiqi-glow) ${deg}%, rgba(0,0,0,0.15) 0)`;
    }
    if (rateEl) {
      const rate = SHIQI_REGEN;
      rateEl.textContent =
        prefix === "pl"
          ? `+${rate.toFixed(2)}/秒 · 蓄勢`
          : `+${rate.toFixed(2)}/秒`;
    }
  }

  function renderHand() {
    const el = document.getElementById("hand");
    el.innerHTML = "";
    const capped = atUnitCap(player);
    for (const id of player.hand) {
      const def = CARDS[id];
      const card = document.createElement("button");
      card.type = "button";
      card.className = "card";
      if (selectedCard === id) card.classList.add("selected");
      const noJunling = player.junling < def.cost;
      if (noJunling || capped) card.classList.add("disabled");
      if (capped) card.classList.add("at-cap");
      card.title = capped
        ? `場上最多 ${MAX_FIELD_UNITS} 名武將`
        : noJunling
          ? "軍令不足"
          : `部署 ${def.name}`;
      card.innerHTML = `
        <span class="cost">${def.cost}</span>
        <span class="name">${def.name}</span>
        <span class="meta"><span class="type-${def.type}">${def.type}</span> · 血${def.hp}</span>
        <span class="strat">計${def.stratCost} ${def.stratName}<br />${def.stratDesc}</span>
      `;
      card.onclick = () => {
        if (ended || !running) return;
        if (capped) {
          const msg = `場上最多 ${MAX_FIELD_UNITS} 名武將`;
          document.getElementById("hint").textContent =
            `場上已滿（${MAX_FIELD_UNITS}/${MAX_FIELD_UNITS}）— 等部隊倒下再出兵`;
          showToast(msg, "bad", 1.5);
          beep(160, 0.05, "triangle", 0.03);
          return;
        }
        if (player.junling < def.cost) {
          document.getElementById("hint").textContent = "軍令不足";
          showToast("軍令不足", "bad", 1.2);
          return;
        }
        selectedCard = selectedCard === id ? null : id;
        document.getElementById("hint").textContent = selectedCard
          ? `部署 ${def.name}：點己方半場任意位置`
          : "選牌 → 點己方半場部署｜點己方單位開計略";
        renderHand();
      };
      el.appendChild(card);
    }
  }

  function showBanner(text) {
    const b = document.getElementById("banner");
    b.textContent = text;
    b.classList.remove("hidden");
    setTimeout(() => b.classList.add("hidden"), 1600);
  }

  // ── Input ─────────────────────────────────────────────────────────
  function canvasPos(ev) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const src = ev.touches ? ev.touches[0] : ev;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    };
  }

  function unitAt(side, x, y) {
    let best = null;
    let bestD = 36; // slightly generous for stratagem clicks
    for (const u of side.units) {
      if (!u.alive) continue;
      const d = Math.hypot(u.x - x, u.y - y);
      const reach = Math.max(bestD, (u.def.radius || 12) + 18);
      if (d < reach && d < bestD + 8) {
        best = u;
        bestD = d;
      }
    }
    return best;
  }

  canvas.addEventListener("pointerdown", (ev) => {
    if (!running || ended) return;
    const p = canvasPos(ev);

    // Stratagem first: click own unit
    const own = unitAt(player, p.x, p.y);
    if (own) {
      if (player.shiqi >= own.def.stratCost - 0.001) {
        if (tryStratagem(player, own)) {
          document.getElementById("hint").textContent = `${own.def.stratName}！`;
          selectedCard = null;
          syncUI();
          return;
        }
      } else {
        const need = own.def.stratCost;
        const have = player.shiqi.toFixed(1);
        const msg = `士氣不足：需 ${need}（現 ${have}）`;
        document.getElementById("hint").textContent = msg;
        showToast(msg, "bad", 1.6);
        beep(180, 0.06, "triangle", 0.03);
        if (!selectedCard) return;
        // fall through — maybe deploying
      }
    } else if (!selectedCard) {
      // Clicked empty / enemy: explain if they might have meant stratagem
      const foe = unitAt(ai, p.x, p.y);
      if (foe) {
        showToast("只能點己方場上武將開計略", "bad", 1.4);
        document.getElementById("hint").textContent = "只能點己方武將開計略";
        return;
      }
    }

    if (!selectedCard) {
      if (!own) {
        document.getElementById("hint").textContent = "先選手牌，或點己方武將開計略";
        showToast("先選手牌部署，或點己方武將開計略", "bad", 1.3);
      }
      return;
    }

    if (atUnitCap(player)) {
      const msg = `場上最多 ${MAX_FIELD_UNITS} 名武將`;
      selectedCard = null;
      document.getElementById("hint").textContent =
        `場上已滿（${MAX_FIELD_UNITS}/${MAX_FIELD_UNITS}）— 等部隊倒下再出兵`;
      showToast(msg, "bad", 1.5);
      beep(160, 0.05, "triangle", 0.03);
      syncUI();
      return;
    }

    if (p.y < MID_Y - 4) {
      const msg = "只能部署在己方半場（高亮區）";
      document.getElementById("hint").textContent = msg;
      showToast(msg, "bad", 1.4);
      return;
    }
    if (deploy(player, selectedCard, p.x, p.y)) {
      selectedCard = null;
      const n = livingCount(player);
      document.getElementById("hint").textContent =
        n >= MAX_FIELD_UNITS
          ? `場上已滿（${n}/${MAX_FIELD_UNITS}）— 等部隊倒下再出兵`
          : "選牌 → 點己方半場部署｜點己方單位開計略";
      syncUI();
    } else {
      showToast("軍令不足或無法部署", "bad", 1.3);
    }
  });

  canvas.addEventListener("pointermove", (ev) => {
    if (!selectedCard || !running) {
      deployGhost = null;
      return;
    }
    const p = canvasPos(ev);
    if (p.y < MID_Y - 4) {
      deployGhost = null;
      return;
    }
    deployGhost = {
      x: clamp(p.x, FIELD_PAD, W - FIELD_PAD),
      y: clamp(p.y, MID_Y + 8, H - 150),
    };
  });

  // ── Boot ──────────────────────────────────────────────────────────
  function startMatch() {
    try {
      resetArena();
      document.getElementById("overlay").classList.add("hidden");
      running = true;
      ended = false;
      lastTs = performance.now();
      showBanner("開戰");
      syncUI();
      requestAnimationFrame(frame);
    } catch (err) {
      console.error(err);
      const ov = document.getElementById("overlay");
      ov.classList.remove("hidden");
      ov.querySelector(".overlay-card").innerHTML = `
        <h1>錯誤</h1>
        <p style="color:#f88;font-size:0.8rem">${String(err && err.message || err)}</p>
        <button type="button" data-action="start">重試</button>`;
    }
  }

  // Event delegation so recreated 再戰 buttons keep working
  const overlayEl = document.getElementById("overlay");
  function onStartGesture(ev) {
    if (overlayEl.classList.contains("hidden") || running) return;
    // Whole card is a start target (automation-friendly hit area)
    if (ev.target.closest(".overlay-card") || ev.target === overlayEl) {
      ev.preventDefault();
      startMatch();
    }
  }
  overlayEl.addEventListener("pointerup", onStartGesture);
  overlayEl.addEventListener("click", onStartGesture);
  document.addEventListener("keydown", (ev) => {
    if (overlayEl.classList.contains("hidden")) return;
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      startMatch();
    }
  });
  window.__pocStart = startMatch;

  resetArena();
  syncUI();
  draw();
})();
