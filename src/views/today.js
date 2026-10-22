// 오늘 화면: 지금 교시 · 다음 감독 · 오늘 타임라인
import { store } from "../lib/store.js";
import {
  getDayInfo, teacherSlots, statusOf, nextDutyDay, fmtKoDate, fmtShortDate, clsLabel, timeLabel, parseISO, maxPeriodNo,
} from "../lib/schedule.js";
import { TERM, PENALTY_NOTICE, sheetUrl } from "../data/config.js";
import { icon, refreshIcons } from "../ui/icons.js";
import { teacherPrompt, bindTeacherSelect, slotRow, emptyState } from "../ui/parts.js";

export function todayView(root) {
  let last = "";
  const draw = () => {
    const html = build();
    if (html === last) return;
    last = html;
    root.innerHTML = html;
    bindTeacherSelect(root);
    refreshIcons(root);
  };
  draw();
  const timer = setInterval(draw, 15_000);
  return () => clearInterval(timer);
}

function build() {
  const { teacher } = store.get();
  if (!teacher) return teacherPrompt();

  const now = new Date();
  const info = getDayInfo(now);
  const slots = teacherSlots(info.assignments, teacher);
  const st = statusOf(slots);

  return `
    <div class="space-y-4 fade-in">
      ${hero(teacher, info, now, st)}
      ${mainCard(teacher, info, now, st)}
      ${slots.length ? timeline(st) : ""}
      ${notice()}
    </div>`;
}

function hero(teacher, info, now, st) {
  const total = st.list.length;
  const remain = total - st.done;
  const sub = info.special
    ? `<span class="chip bg-amber-400/90 text-amber-950">${icon("star", "w-3 h-3")}${info.label}</span>`
    : info.assignments
      ? `<span class="chip bg-white/20 text-white">${info.label} · ${maxPeriodNo(info.assignments)}교시</span>`
      : `<span class="chip bg-white/20 text-white">${info.label}</span>`;
  return `
    <section class="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white shadow-md dark:from-brand-700 dark:to-brand-950">
      <div class="flex items-center gap-2 text-xs text-brand-100">${fmtKoDate(now)} ${sub}</div>
      <h2 class="mt-2 text-2xl font-bold tracking-tight">${teacher} <span class="text-base font-normal text-brand-100">선생님</span></h2>
      <div class="mt-4 grid grid-cols-3 gap-2 text-center">
        ${stat("오늘 감독", total ? `${total}교시` : "없음")}
        ${stat("완료", `${st.done}`)}
        ${stat("남음", `${remain}`)}
      </div>
    </section>`;
}

const stat = (k, v) => `
  <div class="rounded-xl border border-white/15 bg-white/10 px-2 py-2 backdrop-blur-sm">
    <div class="text-[11px] text-brand-100">${k}</div>
    <div class="text-lg font-black leading-tight">${v}</div>
  </div>`;

function mainCard(teacher, info, now, st) {
  // 자습 기간 밖·주말
  if (!info.assignments) {
    let title, desc;
    if (info.iso > TERM.end) { title = "자습 감독 기간이 끝났습니다"; desc = "수고 많으셨습니다."; }
    else if (info.iso < TERM.start) { title = "자습 감독은 아직 시작 전입니다"; desc = `${fmtShortDate(parseISO(TERM.start))}부터 시작됩니다.`; }
    else { title = "오늘은 주말입니다"; desc = "편히 쉬세요 ☕"; }
    return `<section class="card">${emptyState("coffee", title, desc)}${nextDuty(teacher, now)}</section>`;
  }
  if (!st.list.length) {
    return `<section class="card">${emptyState("coffee", "오늘은 배정된 감독이 없습니다", "다른 선생님의 일정은 시간표 탭에서 볼 수 있어요.")}${nextDuty(teacher, now)}</section>`;
  }

  const { current, next } = st;
  if (current) {
    const total = current.endMin - current.startMin;
    const pct = Math.min(100, Math.max(0, ((total - current.minutesLeft) / total) * 100));
    return `
      <section class="card overflow-hidden border-emerald-200 dark:border-emerald-900">
        <div class="flex items-center gap-2 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <span class="h-2 w-2 rounded-full bg-emerald-500 pulse-dot"></span>지금 감독 중
        </div>
        <div class="p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-3xl font-black tracking-tight text-slate-900 dark:text-white">${clsLabel(current.cls)}</div>
              <div class="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">${current.period.label}${current.period.sub ? ` (${current.period.sub})` : ""} · ${timeLabel(current.period)}</div>
            </div>
            <div class="rounded-xl bg-slate-100 px-3 py-2 text-center dark:bg-slate-800">
              <div class="text-[11px] text-slate-500 dark:text-slate-400">종료까지</div>
              <div class="text-xl font-black text-emerald-600 dark:text-emerald-400">${current.minutesLeft}분</div>
            </div>
          </div>
          <div class="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div class="h-full rounded-full bg-emerald-500 transition-all" style="width:${pct.toFixed(0)}%"></div>
          </div>
          <div class="mt-4 flex gap-2">
            <a href="${sheetUrl(current.cls)}" target="_blank" rel="noopener" class="btn btn-primary flex-1">${icon("clipboard-check")}출결 입력 (시트)</a>
          </div>
        </div>
      </section>`;
  }
  if (next) {
    return `
      <section class="card p-5">
        <div class="flex items-center gap-2 text-xs font-bold text-brand-600 dark:text-brand-400">${icon("timer")}다음 감독</div>
        <div class="mt-2 flex items-end justify-between gap-3">
          <div>
            <div class="text-2xl font-black tracking-tight text-slate-900 dark:text-white">${clsLabel(next.cls)}</div>
            <div class="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">${next.period.label}${next.period.sub ? ` (${next.period.sub})` : ""} · ${timeLabel(next.period)}</div>
          </div>
          <div class="text-right">
            <div class="text-[11px] text-slate-500 dark:text-slate-400">시작까지</div>
            <div class="text-2xl font-black ${next.state === "soon" ? "text-amber-600 dark:text-amber-400" : "text-brand-600 dark:text-brand-400"}">${fmtDuration(next.minutesUntil)}</div>
          </div>
        </div>
      </section>`;
  }
  return `
    <section class="card">
      ${emptyState("circle-check", "오늘 감독을 모두 마쳤습니다", "수고하셨습니다!")}
      ${nextDuty(teacher, now)}
    </section>`;
}

function nextDuty(teacher, now) {
  const n = nextDutyDay(teacher, now);
  if (!n) return "";
  return `
    <div class="border-t border-slate-100 p-4 dark:border-slate-800">
      <div class="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">${icon("calendar-clock", "w-3.5 h-3.5")}다음 감독일 · ${fmtShortDate(n.date)}${n.info.special ? ` <span class="chip bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">${n.info.label}</span>` : ""}</div>
      <div class="flex flex-wrap gap-1.5">
        ${n.slots.map((s) => `<span class="chip bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">${s.period.label} ${clsLabel(s.cls)}</span>`).join("")}
      </div>
    </div>`;
}

function timeline(st) {
  return `
    <section class="card overflow-hidden">
      <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <h3 class="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">${icon("clock", "w-4 h-4 text-brand-600")}오늘 감독 타임라인</h3>
        <span class="text-xs text-slate-500 dark:text-slate-400">${st.done}/${st.list.length} 완료</span>
      </div>
      <div class="divide-y divide-slate-100 dark:divide-slate-800">
        ${st.list.map((s) => slotRow(s, { withState: true })).join("")}
      </div>
    </section>`;
}

function notice() {
  return `
    <div class="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      ${icon("triangle-alert", "mt-0.5 h-4 w-4 shrink-0")}<span>${PENALTY_NOTICE}을 부과해 주세요.</span>
    </div>`;
}

function fmtDuration(min) {
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}
