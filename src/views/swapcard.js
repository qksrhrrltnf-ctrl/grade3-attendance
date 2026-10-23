// 교체·대강 카드 (출결 탭) + 요청 모달
import { store } from "../lib/store.js";
import { getDayInfo, teacherSlots, clsLabel, fmtShortDate, parseISO, fmtISO, allTeachers } from "../lib/schedule.js";
import { TERM } from "../data/config.js";
import { mySwaps, requestSwap, acceptSwap, declineSwap, cancelSwap } from "../lib/swaps.js";
import { icon, refreshIcons } from "../ui/icons.js";
import { toast } from "../ui/feedback.js";
import { haptic, confetti } from "../ui/effects.js";

const label = (s) => `${fmtShortDate(parseISO(s.date))} ${s.period}교시 · ${clsLabel(s.room)} 교실`;

export function swapCard(me, todayIso) {
  const { incoming, open, mine, taken } = mySwaps(me, todayIso);
  const item = (s, actions, tone = "") => `
    <div class="flex items-center gap-3 px-4 py-3 ${tone}">
      <div class="min-w-0 flex-1">
        <div class="text-sm font-bold">${label(s)}</div>
        <div class="mt-0.5 text-xs font-medium text-ink-2">
          ${s.from} → ${s.status === "accepted" ? `<b>${s.acceptedBy}</b> (수락됨)` : s.to ? `${s.to} (대기 중)` : "누구나 (대기 중)"}${s.note ? ` · ${s.note}` : ""}
        </div>
      </div>
      <div class="flex shrink-0 gap-1.5">${actions}</div>
    </div>`;
  const section = (title, list, render) => list.length ? `
    <div class="border-t-2 border-line">
      <div class="px-4 pt-3 text-[11px] font-bold uppercase tracking-wider text-ink-2">${title} ${list.length}</div>
      <div class="divide-y divide-line/30">${list.map(render).join("")}</div>
    </div>` : "";

  return `
    <section class="card" id="swap-card">
      <div class="lhead">${icon("arrow-left-right")}교체·대강
        ${incoming.length + open.length ? `<span class="ml-1 rounded-[3px] bg-pink px-1.5 text-xs text-black">${incoming.length + open.length}</span>` : ""}
        <button id="swap-new" class="ml-auto rounded-[4px] bg-pink px-2.5 py-1 text-xs font-bold text-black">${icon("user-round-plus", "w-3.5 h-3.5 inline mr-1")}교체 요청</button>
      </div>
      ${section("나에게 온 요청", incoming, (s) => item(s, `
          <button data-accept="${s.id}" class="btn btn-primary btn-sm">수락</button>
          <button data-decline="${s.id}" class="btn btn-sm px-2" title="거절">${icon("circle-x", "w-4 h-4")}</button>`, "bg-[color-mix(in_srgb,var(--pink)_18%,var(--paper))]"))}
      ${section("도움 요청 (누구나)", open, (s) => item(s, `<button data-accept="${s.id}" class="btn btn-key btn-sm">내가 맡기</button>`))}
      ${section("내 요청", mine, (s) => item(s, s.status === "open" ? `<button data-cancel="${s.id}" class="btn btn-sm">취소</button>` : `<span class="chip chip-yellow">${icon("check", "w-3 h-3")}교체됨</span>`))}
      ${section("내가 맡은 대강", taken, (s) => item(s, `<a href="#/session?date=${s.date}&room=${s.room}&period=${s.period}" class="btn btn-sm">열기</a>`))}
      ${!incoming.length && !open.length && !mine.length && !taken.length
        ? `<div class="p-4 text-center text-sm font-semibold text-ink-2">진행 중인 교체가 없습니다. 상황이 생기면 <b>교체 요청</b>으로 다른 선생님께 부탁하세요.</div>` : ""}
    </section>`;
}

export function bindSwapCard(root, me, redraw) {
  const act = async (fn, msg) => { try { await fn(); haptic(15); toast(msg); redraw?.(); } catch (e) { toast(e.message); } };
  root.querySelectorAll("[data-accept]").forEach((b) => b.addEventListener("click", () => act(async () => { await acceptSwap(b.dataset.accept, me); confetti(b, 16); }, "교체를 수락했습니다. 내 일정에 반영됩니다.")));
  root.querySelectorAll("[data-decline]").forEach((b) => b.addEventListener("click", () => act(() => declineSwap(b.dataset.decline), "요청을 거절했습니다.")));
  root.querySelectorAll("[data-cancel]").forEach((b) => b.addEventListener("click", () => act(() => cancelSwap(b.dataset.cancel), "요청을 취소했습니다.")));
  root.querySelector("#swap-new")?.addEventListener("click", () => openRequestModal(me, redraw));
}

/** 요청 모달: 날짜 → 그날 내 교시 선택 → 대상(지정/누구나) → 메모 */
export function openRequestModal(me, redraw, preset = {}) {
  const host = document.getElementById("modal-root");
  const wrap = document.createElement("div");
  const todayIso = fmtISO(new Date());
  let date = preset.date ?? todayIso;
  const teachers = allTeachers().filter((t) => t !== me);
  wrap.className = "fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]";
  const body = () => {
    const info = getDayInfo(parseISO(date));
    const slots = teacherSlots(info.assignments, me);
    return `
      <div class="p-4 space-y-4">
        <div>
          <div class="label">날짜</div>
          <input data-date type="date" class="field py-2 text-sm" value="${date}" min="${todayIso}" max="${TERM.end}" />
        </div>
        <div>
          <div class="label">교체할 내 교시 ${info.special ? `<span class="chip chip-yellow ml-1">${info.label}</span>` : ""}</div>
          ${slots.length ? `<div class="grid grid-cols-2 gap-1.5">${slots.map((s) => `
            <label class="block flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-semibold has-[:checked]:mission">
              <input type="checkbox" data-slot value="${s.cls}|${s.period.no}" class="h-4 w-4 accent-black" ${preset.room === s.cls && String(preset.period) === String(s.period.no) ? "checked" : ""}/>
              ${s.period.label} · ${clsLabel(s.cls)}
            </label>`).join("")}</div>`
            : `<div class="block p-3 text-sm font-semibold text-ink-2">이 날은 내 감독이 없습니다.</div>`}
        </div>
        <div>
          <div class="label">부탁할 선생님</div>
          <select data-to class="field py-2 text-sm">
            <option value="">누구나 (전체 선생님께 도움 요청)</option>
            ${teachers.map((t) => `<option value="${t}">${t}</option>`).join("")}
          </select>
        </div>
        <div>
          <div class="label">메모 (선택)</div>
          <input data-note class="field py-2 text-sm" placeholder="예) 출장, 병원" />
        </div>
        <button data-send class="btn btn-primary w-full" ${slots.length ? "" : "disabled"}>${icon("arrow-left-right")}교체 요청 보내기</button>
      </div>`;
  };
  wrap.innerHTML = `
    <div role="dialog" class="card w-full max-w-md fade-in">
      <div class="lhead">${icon("arrow-left-right")}교체 요청<button data-x class="ml-auto">${icon("x", "w-5 h-5")}</button></div>
      <div data-body>${body()}</div>
    </div>`;
  const close = () => wrap.remove();
  const bind = () => {
    wrap.querySelector("[data-date]").addEventListener("change", (e) => { date = e.target.value; wrap.querySelector("[data-body]").innerHTML = body(); refreshIcons(wrap); bind(); });
    wrap.querySelector("[data-send]")?.addEventListener("click", async () => {
      const picked = [...wrap.querySelectorAll("[data-slot]:checked")].map((c) => c.value.split("|"));
      if (!picked.length) return toast("교체할 교시를 선택해 주세요.");
      const to = wrap.querySelector("[data-to]").value || null;
      const note = wrap.querySelector("[data-note]").value.trim();
      try {
        for (const [room, period] of picked) await requestSwap({ date, room, period, from: me, to, note });
        haptic([20, 30, 20]);
        toast(to ? `${to} 선생님께 교체 요청을 보냈습니다.` : "전체 선생님께 도움 요청을 올렸습니다.");
        close(); redraw?.();
      } catch (e) { toast(e.message); }
    });
  };
  wrap.querySelector("[data-x]").addEventListener("click", close);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  host.appendChild(wrap);
  refreshIcons(wrap);
  bind();
}
