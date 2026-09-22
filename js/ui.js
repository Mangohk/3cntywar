/** HUD updates: hand, Qi, timer, overlays + card drag-and-drop. */

import { getCardDef, QI_MAX } from "./cards.js";

export function createUI(root) {
  const els = {
    title: root.querySelector("#title-screen"),
    result: root.querySelector("#result-screen"),
    resultTitle: root.querySelector("#result-title"),
    resultDetail: root.querySelector("#result-detail"),
    resultEyebrow: root.querySelector("#result-eyebrow"),
    hud: root.querySelector("#hud"),
    hand: root.querySelector("#hand"),
    qiValue: root.querySelector("#qi-value"),
    qiFill: root.querySelector("#qi-fill"),
    timer: root.querySelector("#match-timer"),
    matchMeta: root.querySelector("#match-meta"),
    sudden: root.querySelector("#sudden-death"),
    hint: root.querySelector("#deploy-hint"),
    banner: root.querySelector("#match-banner"),
    bannerTitle: root.querySelector("#match-banner-title"),
    bannerSub: root.querySelector("#match-banner-sub"),
    btnStart: root.querySelector("#btn-start"),
    btnRetry: root.querySelector("#btn-retry"),
    btnTitle: root.querySelector("#btn-title"),
    btnMute: root.querySelector("#btn-mute"),
  };

  let lastHandKey = "";
  /** @type {null | { index: number, pointerId: number, ghost: HTMLElement }} */
  let dragState = null;
  let lastQi = 0;
  let lastHandIds = [];

  const api = {
    els,
    /** Set by main: (clientX, clientY) => board pos | null */
    pointToBoard: null,
    /** Set by main */
    isMatchRunning: null,
    onDragStart: null,
    onDragMove: null,
    onDragEnd: null,
    onDragCancel: null,
    /** @deprecated click-select — drag is primary */
    onSelectCard: null,

    isDragging() {
      return dragState != null;
    },

    showTitle() {
      cancelDrag(false);
      els.title.hidden = false;
      els.result.hidden = true;
      els.hud.hidden = true;
      els.matchMeta.hidden = true;
      clearBanner();
      lastHandKey = "";
    },
    showMatch() {
      els.title.hidden = true;
      els.result.hidden = true;
      els.hud.hidden = false;
      els.matchMeta.hidden = false;
    },
    showResult(outcome) {
      cancelDrag(false);
      clearBanner();
      els.result.hidden = false;
      els.hud.hidden = false;
      if (outcome === "win") {
        els.resultEyebrow.textContent = "蜀军大捷";
        els.resultTitle.textContent = "Victory";
        els.resultDetail.textContent = "The Wei Main Camp has fallen. Shu holds the field.";
      } else if (outcome === "lose") {
        els.resultEyebrow.textContent = "大营失守";
        els.resultTitle.textContent = "Defeat";
        els.resultDetail.textContent = "Your Main Camp was destroyed. Rally and try again.";
      } else {
        els.resultEyebrow.textContent = "时间到";
        els.resultTitle.textContent = outcome === "draw" ? "Draw" : "Time Up";
        els.resultDetail.textContent =
          outcome === "draw"
            ? "Both Main Camps stand equally wounded."
            : "The side with more Main Camp HP prevails.";
      }
    },
    updateQi(qi) {
      const shown = Math.floor(qi * 10) / 10;
      els.qiValue.textContent = Number.isInteger(shown) ? String(shown) : shown.toFixed(1);
      els.qiFill.style.width = `${(qi / QI_MAX) * 100}%`;
    },
    /**
     * @param {number} seconds
     * @param {boolean} sudden
     * @param {number | null} suddenIn whole seconds until sudden death, or null
     */
    updateTimer(seconds, sudden, suddenIn = null) {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      els.timer.textContent = `${m}:${s.toString().padStart(2, "0")}`;
      els.timer.classList.toggle("timer-warn", !sudden && suddenIn != null);

      if (sudden) {
        els.sudden.hidden = false;
        els.sudden.textContent = "Sudden Death";
        els.sudden.classList.remove("countdown");
      } else if (suddenIn != null) {
        els.sudden.hidden = false;
        els.sudden.textContent = `Sudden Death in ${suddenIn}`;
        els.sudden.classList.add("countdown");
      } else {
        els.sudden.hidden = true;
        els.sudden.classList.remove("countdown");
      }
    },
    /**
     * @param {null | { kind: string, text: string, sub?: string, t: number }} banner
     */
    updateBanner(banner) {
      if (!els.banner) return;
      if (!banner || banner.t <= 0) {
        clearBanner();
        return;
      }
      els.banner.hidden = false;
      els.banner.dataset.kind = banner.kind;
      els.bannerTitle.textContent = banner.text;
      els.bannerSub.textContent = banner.sub || "";
      els.bannerSub.hidden = !banner.sub;
      // Fade out in the last third of a second.
      const fade = Math.min(1, banner.t / 0.35);
      els.banner.style.opacity = String(fade);
    },
    updateHand(handIds, selectedIndex, qi) {
      lastQi = qi;
      lastHandIds = handIds;

      // Never rebuild the hand DOM mid-drag — that would break pointer capture / listeners.
      if (dragState) {
        syncHandAffordability(qi);
        return;
      }

      const key = `${handIds.join(",")}|${selectedIndex}|${Math.floor(qi)}`;
      if (key === lastHandKey && els.hand.children.length === handIds.length) {
        syncHandAffordability(qi);
        handIds.forEach((_, index) => {
          const btn = els.hand.children[index];
          if (!btn) return;
          btn.classList.toggle("selected", selectedIndex === index);
          btn.setAttribute("aria-selected", selectedIndex === index ? "true" : "false");
        });
        return;
      }
      lastHandKey = key;
      els.hand.innerHTML = "";
      handIds.forEach((id, index) => {
        const def = getCardDef(id);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "card-btn";
        btn.dataset.index = String(index);
        btn.dataset.cardId = id;
        btn.setAttribute("role", "option");
        btn.setAttribute("aria-selected", selectedIndex === index ? "true" : "false");
        btn.setAttribute("aria-label", `Drag ${def.nameEn} to deploy`);
        if (selectedIndex === index) btn.classList.add("selected");
        if (def.cost > qi) btn.classList.add("unaffordable");
        btn.innerHTML = `
          <span class="card-cost">${def.cost}</span>
          <span class="card-name">${def.name}</span>
          <span class="card-role">${def.nameEn} · ${def.role}</span>
        `;
        btn.addEventListener("pointerdown", (evt) => beginDrag(evt, index));
        els.hand.appendChild(btn);
      });
    },
    setHint(text, bad = false) {
      els.hint.textContent = text;
      els.hint.classList.toggle("flash-bad", bad);
    },
    /**
     * Reflect mute state on the Sound / Muted control.
     * @param {boolean} muted
     */
    syncMute(muted) {
      if (!els.btnMute) return;
      els.btnMute.setAttribute("aria-pressed", muted ? "true" : "false");
      els.btnMute.classList.toggle("is-muted", muted);
      els.btnMute.textContent = muted ? "Muted" : "Sound";
      els.btnMute.title = muted ? "Unmute sound" : "Mute sound";
    },
    cancelDrag() {
      cancelDrag(true);
    },
  };

  function syncHandAffordability(qi) {
    for (const btn of els.hand.children) {
      const id = btn.dataset.cardId;
      if (!id) continue;
      const def = getCardDef(id);
      btn.classList.toggle("unaffordable", def.cost > qi);
    }
  }

  function beginDrag(evt, index) {
    if (evt.button != null && evt.button !== 0) return;
    if (!api.isMatchRunning?.()) return;
    if (dragState) return;

    const cardId = lastHandIds[index];
    if (!cardId) return;
    const def = getCardDef(cardId);
    if (def.cost > lastQi) {
      api.setHint("Not enough Qi for that card.", true);
      return;
    }

    evt.preventDefault();
    evt.stopPropagation();

    const ghost = document.createElement("div");
    ghost.className = "drag-ghost";
    ghost.setAttribute("aria-hidden", "true");
    ghost.innerHTML = `
      <span class="card-cost">${def.cost}</span>
      <span class="card-name">${def.name}</span>
      <span class="card-role">${def.nameEn}</span>
    `;
    document.body.appendChild(ghost);
    positionGhost(ghost, evt.clientX, evt.clientY);

    dragState = { index, pointerId: evt.pointerId, ghost };
    const btn = els.hand.children[index];
    if (btn) btn.classList.add("dragging", "selected");

    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragUp);
    window.addEventListener("pointercancel", onDragUp);

    api.onDragStart?.(index);
    emitDragMove(evt.clientX, evt.clientY);
  }

  function onDragMove(evt) {
    if (!dragState || evt.pointerId !== dragState.pointerId) return;
    evt.preventDefault();
    positionGhost(dragState.ghost, evt.clientX, evt.clientY);
    emitDragMove(evt.clientX, evt.clientY);
  }

  function onDragUp(evt) {
    if (!dragState || evt.pointerId !== dragState.pointerId) return;
    evt.preventDefault();
    const { index } = dragState;
    const pos = api.pointToBoard?.(evt.clientX, evt.clientY) ?? null;
    cleanupDragDom();
    dragState = null;
    removeDragListeners();
    api.onDragEnd?.(index, pos);
  }

  function emitDragMove(clientX, clientY) {
    const pos = api.pointToBoard?.(clientX, clientY) ?? null;
    api.onDragMove?.(pos);
  }

  function positionGhost(ghost, clientX, clientY) {
    ghost.style.transform = `translate(${clientX}px, ${clientY}px) translate(-50%, -60%)`;
  }

  function removeDragListeners() {
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragUp);
    window.removeEventListener("pointercancel", onDragUp);
  }

  function cleanupDragDom() {
    if (!dragState) return;
    dragState.ghost.remove();
    for (const btn of els.hand.children) {
      btn.classList.remove("dragging");
    }
  }

  function cancelDrag(notify) {
    if (!dragState) return;
    cleanupDragDom();
    dragState = null;
    removeDragListeners();
    if (notify) api.onDragCancel?.();
  }

  function clearBanner() {
    if (!els.banner) return;
    els.banner.hidden = true;
    els.banner.removeAttribute("data-kind");
    els.banner.style.opacity = "";
    if (els.bannerTitle) els.bannerTitle.textContent = "";
    if (els.bannerSub) {
      els.bannerSub.textContent = "";
      els.bannerSub.hidden = true;
    }
  }

  return api;
}

export function formatOutcomeFromCamps(playerMain, enemyMain) {
  if (!enemyMain.alive) return "win";
  if (!playerMain.alive) return "lose";
  if (playerMain.hp === enemyMain.hp) return "draw";
  return playerMain.hp > enemyMain.hp ? "win" : "lose";
}
