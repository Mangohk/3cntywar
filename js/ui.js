/** HUD updates: hand, Qi, timer, overlays. */

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
    btnStart: root.querySelector("#btn-start"),
    btnRetry: root.querySelector("#btn-retry"),
    btnTitle: root.querySelector("#btn-title"),
  };

  return {
    els,
    showTitle() {
      els.title.hidden = false;
      els.result.hidden = true;
      els.hud.hidden = true;
      els.matchMeta.hidden = true;
    },
    showMatch() {
      els.title.hidden = true;
      els.result.hidden = true;
      els.hud.hidden = false;
      els.matchMeta.hidden = false;
    },
    showResult(outcome) {
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
    updateTimer(seconds, sudden) {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      els.timer.textContent = `${m}:${s.toString().padStart(2, "0")}`;
      els.sudden.hidden = !sudden;
    },
    updateHand(handIds, selectedIndex, qi) {
      els.hand.innerHTML = "";
      handIds.forEach((id, index) => {
        const def = getCardDef(id);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "card-btn";
        btn.dataset.index = String(index);
        btn.setAttribute("role", "option");
        btn.setAttribute("aria-selected", selectedIndex === index ? "true" : "false");
        if (selectedIndex === index) btn.classList.add("selected");
        if (def.cost > qi) btn.classList.add("unaffordable");
        btn.innerHTML = `
          <span class="card-cost">${def.cost}</span>
          <span class="card-name">${def.name}</span>
          <span class="card-role">${def.nameEn} · ${def.role}</span>
        `;
        btn.addEventListener("click", () => {
          els.onSelectCard?.(index);
        });
        els.hand.appendChild(btn);
      });
    },
    setHint(text, bad = false) {
      els.hint.textContent = text;
      els.hint.classList.toggle("flash-bad", bad);
    },
    onSelectCard: null,
  };
}

export function formatOutcomeFromCamps(playerMain, enemyMain) {
  if (!enemyMain.alive) return "win";
  if (!playerMain.alive) return "lose";
  if (playerMain.hp === enemyMain.hp) return "draw";
  return playerMain.hp > enemyMain.hp ? "win" : "lose";
}
