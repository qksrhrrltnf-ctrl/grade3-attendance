// 출결 탭: 오늘 본인에게 배정된 교시만 표시 → 탭하면 바로 그 교실의 출결 입력 화면
import { store } from "../lib/store.js";
import { getDayInfo, teacherSlots, statusOf, clsLabel, timeLabel, fmtShortDate } from "../lib/schedule.js";
import { isConfigured } from "../lib/firebase.js";
import { subscribeDaySessions, summarize, sessionId } from "../lib/db.js";
import { ensureAuth, isAdmin } from "../lib/auth.js";
import { icon, refreshIcons } from "../ui/icons.js";
import { emptyState, STATE_CHIP, periodBox } from "../ui/parts.js";

export function attendanceView(root) {
  const { teacher } = store.get();
  const now = new Date();
  const info = getDayInfo(now);
  const st = statusOf(teacherSlots(info.assignments, teacher));
  let sessions = {};

  const draw = () => {
    root.innerHTML = `
      <div class="space-y-4 fade-in">
        ${isConfigured ? "" : noDb()}
        <section class="card">
          <div class="lhead">${icon("clipboard-check")}오늘 내 출결 입력<span class="ml-auto text-xs font-semibold opacity-80">${fmtShortDate(now)}</span></div>
          ${st.list.length ? `<div class="divide-y-2 divide-line">${st.list.map(row).join("")}</div>`
            : emptyState("coffee", info.assignments ? "오늘은 배정된 감독이 없습니다" : "오늘은 자습 감독이 없는 날입니다")}
        </section>
        <p class="px-1 text-xs font-medium text-muted">본인에게 배정된 교시·교실만 입력할 수 있습니다.${isAdmin() ? ` 다른 교실은 <a href="#/admin" class="underline font-bold text-ink">관리 화면</a>에서 열 수 있습니다.` : " 대강·변경은 관리자에게 요청하세요."}</p>
      </div>`;
    refreshIcons(root);
  };

  const row = (s) => {
    const sid = sessionId(info.iso, s.cls, String(s.period.no));
    const sess = sessions[sid];
    const sum = sess ? summarize(sess) : null;
    const primary = s.state === "now" || s.state === "soon" || (s.state === "done" && !sess);
    return `
      <a href="#/session?date=${info.iso}&room=${s.cls}&period=${s.period.no}" class="row-tap flex items-center gap-3 p-4 ${s.state === "done" && sess ? "opacity-70" : ""}">
        ${periodBox(s.period.no, "h-11 w-11")}
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-bold">${clsLabel(s.cls)}</span>${STATE_CHIP[s.state]}
            ${sess ? `<span class="chip ${sum.absent ? "chip-red" : "chip-yellow"}">${sum.absent ? `결석 ${sum.absent}` : "전원 출석"}</span>` : `<span class="chip chip-muted">미입력</span>`}
          </div>
          <div class="mt-0.5 text-xs font-medium text-ink-2">${s.period.label} · ${timeLabel(s.period)}</div>
        </div>
        <span class="btn btn-sm shrink-0 ${primary ? "btn-primary" : ""}">${sess ? "수정" : "입력"}${icon("chevron-right", "w-4 h-4")}</span>
      </a>`;
  };

  draw();

  let unsub = null, gone = false;
  if (isConfigured) {
    ensureAuth().then(() => {
      if (gone) return;
      try { unsub = subscribeDaySessions(info.iso, (list) => { sessions = Object.fromEntries(list.map((s) => [s.id, s])); draw(); }); }
      catch (e) { console.warn(e); }
    });
  }
  return () => { gone = true; unsub?.(); };
}

const noDb = () => `
  <div class="block warn p-3 text-xs font-bold">DB가 연결되지 않아 출결을 저장할 수 없습니다. 관리자에게 문의하세요.</div>`;
