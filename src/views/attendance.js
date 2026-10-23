// 출결 탭: 오늘 본인 배정 교시 → 바로 입력. 하단 캘린더로 지난 날짜의 내 교시도 입력·수정
import { store } from "../lib/store.js";
import { getDayInfo, teacherSlots, statusOf, clsLabel, timeLabel, fmtShortDate, fmtISO, parseISO } from "../lib/schedule.js";
import { TERM } from "../data/config.js";
import { isConfigured } from "../lib/firebase.js";
import { subscribeDaySessions, getSessionsBetween, summarize, sessionId } from "../lib/db.js";
import { ensureAuth, isAdmin } from "../lib/auth.js";
import { icon, refreshIcons } from "../ui/icons.js";
import { emptyState, STATE_CHIP, periodBox } from "../ui/parts.js";
import { haptic } from "../ui/effects.js";
import { swapCard, bindSwapCard } from "./swapcard.js";

const KO = ["일", "월", "화", "수", "목", "금", "토"];
const cal = { month: null, selected: null }; // 탭을 오가도 유지

export function attendanceView(root) {
  const { teacher } = store.get();
  const now = new Date();
  const today = getDayInfo(now);
  const todayIso = today.iso;
  cal.month ??= todayIso.slice(0, 7);
  const st = statusOf(teacherSlots(today.assignments, teacher));

  let todaySessions = {};   // 오늘 세션 (실시간)
  let termSessions = [];    // 기간 전체 세션 (캘린더 표시용, 1회 로드)
  let selSessions = {};     // 선택한 날짜 세션 (실시간)
  let unsubToday = null, unsubSel = null, gone = false;

  /** 날짜별 내 교시 요약: {total, done} */
  const dayStat = (iso) => {
    const slots = teacherSlots(getDayInfo(parseISO(iso)).assignments, teacher);
    const done = slots.filter((s) => termSessions.some((x) => x.id === sessionId(iso, s.cls, String(s.period.no)))).length;
    return { total: slots.length, done };
  };

  const draw = () => {
    root.innerHTML = `
      <div class="space-y-4 fade-in">
        ${isConfigured ? "" : noDb()}
        <section class="card">
          <div class="lhead">${icon("clipboard-check")}오늘 내 출결 입력<span class="ml-auto text-xs font-semibold opacity-80">${fmtShortDate(now)}</span></div>
          ${st.list.length ? `<div class="divide-y-2 divide-line">${st.list.map((s) => row(s, todayIso, todaySessions, true)).join("")}</div>`
            : emptyState("coffee", today.assignments ? "오늘은 배정된 감독이 없습니다" : "오늘은 자습 감독이 없는 날입니다")}
        </section>

        ${swapCard(teacher, todayIso)}

        <section class="card">
          <div class="lhead">${icon("calendar-days")}지난 출결 입력·수정<span class="ml-auto text-xs font-semibold opacity-80">날짜를 탭하세요</span></div>
          ${calendar()}
          ${selectedPanel()}
        </section>

        <p class="px-1 text-xs font-medium text-muted">본인에게 배정된 교시·교실만 입력할 수 있습니다.${isAdmin() ? ` 다른 교실은 <a href="#/admin" class="underline font-bold text-ink">관리 화면</a>에서 열 수 있습니다.` : " 대강·변경은 관리자에게 요청하세요."}</p>
      </div>`;
    refreshIcons(root);
    bind();
  };

  const row = (s, iso, sessions, withState) => {
    const sess = sessions[sessionId(iso, s.cls, String(s.period.no))];
    const sum = sess ? summarize(sess) : null;
    const primary = withState ? (s.state === "now" || s.state === "soon" || (s.state === "done" && !sess)) : !sess;
    return `
      <a href="#/session?date=${iso}&room=${s.cls}&period=${s.period.no}" class="row-tap flex items-center gap-3 p-4 ${withState && s.state === "done" && sess ? "opacity-70" : ""}">
        ${periodBox(s.period.no, "h-11 w-11")}
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-bold">${clsLabel(s.cls)}</span>${withState ? STATE_CHIP[s.state] : ""}
            ${sess ? `<span class="chip ${sum.absent ? "chip-red" : "chip-yellow"}">${sum.absent ? `결석 ${sum.absent}` : "전원 출석"}</span>` : `<span class="chip chip-muted">미입력</span>`}
          </div>
          <div class="mt-0.5 text-xs font-medium text-ink-2">${s.period.label} · ${timeLabel(s.period)}</div>
        </div>
        <span class="btn btn-sm shrink-0 ${primary ? "btn-primary" : ""}">${sess ? "수정" : "입력"}${icon("chevron-right", "w-4 h-4")}</span>
      </a>`;
  };

  /** 월간 캘린더 — 자습 기간(TERM) 안의 날짜만 활성, 오늘 이후는 비활성 */
  const calendar = () => {
    const [y, m] = cal.month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const lead = first.getDay();
    const minMonth = TERM.start.slice(0, 7), maxMonth = todayIso.slice(0, 7);
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(`<div></div>`);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const info = getDayInfo(parseISO(iso));
      const inTerm = iso >= TERM.start && iso <= todayIso && info.assignments;
      const stat = inTerm ? dayStat(iso) : { total: 0, done: 0 };
      const isToday = iso === todayIso, isSel = iso === cal.selected;
      const disabled = !inTerm || stat.total === 0;
      let fill = "";
      if (isSel) fill = "mission";
      else if (stat.total && stat.done === stat.total) fill = "key";
      else if (stat.total && stat.done) fill = "mini-3";
      const dots = stat.total ? `<span class="mt-0.5 flex gap-0.5">${Array.from({ length: Math.min(stat.total, 4) }, (_, i) => `<i class="h-1.5 w-1.5 rounded-full ${i < stat.done ? "bg-black" : "border border-black bg-transparent"}"></i>`).join("")}</span>` : "";
      cells.push(`
        <button type="button" ${disabled ? "disabled" : `data-cal="${iso}"`}
          class="chip-tap flex h-12 flex-col items-center justify-center rounded-[4px] text-sm font-bold
                 ${fill ? `block ${fill}` : ""} ${isToday && !isSel ? "ring-2 ring-ink ring-inset" : ""}
                 ${disabled ? "text-muted/50" : ""} ${info.special && !disabled ? "underline decoration-2 decoration-gold" : ""}">
          <span>${d}</span>${dots}
        </button>`);
    }
    return `
      <div class="p-3">
        <div class="mb-2 flex items-center justify-between">
          <button type="button" class="btn btn-sm px-2" data-month="-1" ${cal.month <= minMonth ? "disabled" : ""}>${icon("chevron-right", "w-4 h-4 rotate-180")}</button>
          <div class="font-bold">${y}년 ${m}월</div>
          <button type="button" class="btn btn-sm px-2" data-month="1" ${cal.month >= maxMonth ? "disabled" : ""}>${icon("chevron-right", "w-4 h-4")}</button>
        </div>
        <div class="grid grid-cols-7 text-center text-[11px] font-bold text-ink-2">${KO.map((k, i) => `<div class="py-1 ${i === 0 ? "text-red" : ""}">${k}</div>`).join("")}</div>
        <div class="grid grid-cols-7 gap-1">${cells.join("")}</div>
        <div class="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
          <span class="block key px-2 py-0.5">모두 입력</span><span class="block mini-3 px-2 py-0.5">일부 입력</span><span class="block mission px-2 py-0.5">선택</span>
          <span class="chip chip-muted">● 교시 수 · 검은 점 = 입력됨</span>
        </div>
      </div>`;
  };

  const selectedPanel = () => {
    if (!cal.selected) return `<div class="border-t-2 border-line p-4 text-center text-sm font-semibold text-ink-2">날짜를 선택하면 그날 내 감독 교시가 여기에 표시됩니다.</div>`;
    const d = parseISO(cal.selected);
    const info = getDayInfo(d);
    const slots = teacherSlots(info.assignments, teacher);
    return `
      <div class="border-t-2 border-line">
        <div class="flex items-center gap-2 px-4 py-2.5 text-sm font-bold">
          ${icon("calendar-clock", "w-4 h-4")}${fmtShortDate(d)}${info.special ? ` <span class="chip chip-yellow">${info.label}</span>` : ""} 내 감독
          <span class="ml-auto text-xs font-semibold text-ink-2">${slots.length}교시</span>
        </div>
        ${slots.length ? `<div class="divide-y-2 divide-line border-t-2 border-line">${slots.map((s) => row(s, cal.selected, selSessions, false)).join("")}</div>`
          : `<div class="p-4 text-center text-sm font-semibold text-ink-2">이 날은 배정된 감독이 없습니다.</div>`}
      </div>`;
  };

  const subscribeSelected = () => {
    unsubSel?.(); unsubSel = null; selSessions = {};
    if (!cal.selected || !isConfigured) return;
    unsubSel = subscribeDaySessions(cal.selected, (list) => { selSessions = Object.fromEntries(list.map((s) => [s.id, s])); draw(); });
  };

  function bind() {
    bindSwapCard(root, teacher, draw);
    root.querySelectorAll("[data-month]").forEach((b) => b.addEventListener("click", () => {
      const [y, m] = cal.month.split("-").map(Number);
      const d = new Date(y, m - 1 + Number(b.dataset.month), 1);
      cal.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      draw();
    }));
    root.querySelectorAll("[data-cal]").forEach((b) => b.addEventListener("click", () => {
      cal.selected = cal.selected === b.dataset.cal ? null : b.dataset.cal;
      haptic(8);
      subscribeSelected(); draw();
      root.querySelector("#sel-anchor")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }));
  }

  draw();

  if (isConfigured) {
    ensureAuth().then(async () => {
      if (gone) return;
      unsubToday = subscribeDaySessions(todayIso, (list) => { todaySessions = Object.fromEntries(list.map((s) => [s.id, s])); draw(); });
      subscribeSelected();
      try { termSessions = await getSessionsBetween(TERM.start, todayIso); if (!gone) draw(); } catch (e) { console.warn(e); }
    });
  }
  return () => { gone = true; unsubToday?.(); unsubSel?.(); };
}

const noDb = () => `
  <div class="block warn p-3 text-xs font-bold">DB가 연결되지 않아 출결을 저장할 수 없습니다. 관리자에게 문의하세요.</div>`;
