// 오늘 화면: 지금 교시(초 단위 카운트다운) · 다음 감독 · 오늘 타임라인
import { store } from "../lib/store.js";
import {
  getDayInfo, teacherSlots, statusOf, nextDutyDay, fmtKoDate, fmtShortDate, clsLabel, timeLabel, parseISO, maxPeriodNo, nowMin,
} from "../lib/schedule.js";
import { TERM, PENALTY_NOTICE } from "../data/config.js";
import { icon, refreshIcons } from "../ui/icons.js";
import { teacherPrompt, bindTeacherSelect, slotRow, emptyState } from "../ui/parts.js";
import { countUp } from "../ui/effects.js";

export function todayView(root) {
  let sig = "";
  const draw = () => {
    const { teacher } = store.get();
    if (!teacher) { root.innerHTML = teacherPrompt(); bindTeacherSelect(root); refreshIcons(root); return; }
    const now = new Date();
    const info = getDayInfo(now);
    const st = statusOf(teacherSlots(info.assignments, teacher));
    // 상태(현재/다음 슬롯·완료 수)가 바뀔 때만 전체를 다시 그리고, 그 사이엔 숫자만 갱신
    const s = `${info.iso}|${st.current?.period.key ?? ""}|${st.next?.period.key ?? ""}|${st.done}|${st.list.length}`;
    if (s !== sig) {
      sig = s;
      root.innerHTML = build(teacher, info, now, st);
      refreshIcons(root);
      countUp(root);
    }
    tick(root, st);
  };
  draw();
  const timer = setInterval(draw, 1000);
  return () => clearInterval(timer);
}

function build(teacher, info, now, st) {
  return `
    <div class="space-y-4 fade-in">
      ${hero(teacher, info, now, st)}
      ${mainCard(teacher, info, now, st)}
      ${st.list.length ? timeline(st, info) : ""}
      ${notice()}
    </div>`;
}

/** 초 단위 갱신: 종료까지 mm:ss, 진행 바, 시작까지 */
function tick(root, st) {
  const now = nowMin();
  const { current, next } = st;
  if (current) {
    const secs = Math.max(0, Math.round((current.endMin - now) * 60));
    const el = root.querySelector("[data-left]");
    if (el) { const t = fmtClock(secs); if (el.textContent !== t) { el.textContent = t; el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick"); } }
    const total = current.endMin - current.startMin;
    const bar = root.querySelector("[data-bar]");
    if (bar) bar.style.width = `${Math.min(100, Math.max(0, ((now - current.startMin) / total) * 100)).toFixed(1)}%`;
  } else if (next) {
    const secs = Math.max(0, Math.round((next.startMin - now) * 60));
    const el = root.querySelector("[data-until]");
    if (el) el.textContent = secs < 3600 ? fmtClock(secs) : fmtDuration(Math.ceil(secs / 60));
  }
}

function hero(teacher, info, now, st) {
  const total = st.list.length;
  const remain = total - st.done;
  const tag = info.special
    ? `<span class="chip chip-yellow">${icon("star", "w-3 h-3")}${info.label}</span>`
    : info.assignments
      ? `<span class="kicker">${info.label} · ${maxPeriodNo(info.assignments)}교시</span>`
      : `<span class="kicker">${info.label}</span>`;
  return `
    <section class="card">
      <div class="p-5">
        <div class="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-2">${fmtKoDate(now)} ${tag}</div>
        <h2 class="mt-3 text-3xl font-bold tracking-tight"><span class="hl">${teacher}</span> <span class="text-lg font-medium">선생님</span></h2>
        <div class="mt-4 grid grid-cols-3 gap-2 text-center">
          ${stat("오늘 감독", total, "교시", "mini-1")}
          ${stat("완료", st.done, "", "mini-2")}
          ${stat("남음", remain, "", "mini-3")}
        </div>
      </div>
    </section>`;
}

const stat = (k, v, suffix, fill) => `
  <div class="block ${fill} px-2 py-2.5">
    <div class="text-[11px] font-semibold">${k}</div>
    <div class="text-xl font-bold leading-tight" data-count="${v}" data-suffix="${suffix}">0${suffix}</div>
  </div>`;

function mainCard(teacher, info, now, st) {
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
    return `
      <section class="card">
        <div class="lhead"><span class="h-2.5 w-2.5 rounded-full bg-yellow pulse-dot"></span>지금 감독 중</div>
        <div class="p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-3xl font-bold tracking-tight">${clsLabel(current.cls)}</div>
              <div class="mt-1 text-sm font-semibold text-ink-2">${current.period.label}${current.period.sub ? ` (${current.period.sub})` : ""} · ${timeLabel(current.period)}</div>
            </div>
            <div class="block key px-3 py-2 text-center">
              <div class="text-[11px] font-semibold">종료까지</div>
              <div class="text-2xl font-bold leading-tight tabular-nums" data-left>--:--</div>
            </div>
          </div>
          <div class="block mt-4 h-3 w-full overflow-hidden bg-paper">
            <div class="bar h-full bg-ink" data-bar style="width:0%"></div>
          </div>
          <a href="#/session?date=${info.iso}&room=${current.cls}&period=${current.period.no}" class="btn btn-primary mt-4 w-full">${icon("clipboard-check")}출결 입력하기</a>
        </div>
      </section>`;
  }
  if (next) {
    const soon = next.state === "soon";
    return `
      <section class="card">
        <div class="lhead">${icon("timer")}다음 감독</div>
        <div class="flex items-end justify-between gap-3 p-5">
          <div>
            <div class="text-2xl font-bold tracking-tight">${clsLabel(next.cls)}</div>
            <div class="mt-1 text-sm font-semibold text-ink-2">${next.period.label}${next.period.sub ? ` (${next.period.sub})` : ""} · ${timeLabel(next.period)}</div>
          </div>
          <div class="block ${soon ? "warn" : "mission"} px-3 py-2 text-center">
            <div class="text-[11px] font-semibold">시작까지</div>
            <div class="text-2xl font-bold leading-tight tabular-nums" data-until>${fmtDuration(next.minutesUntil)}</div>
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
    <div class="border-t-2 border-line p-4">
      <div class="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-bold">${icon("calendar-clock", "w-3.5 h-3.5")}다음 감독일 · ${fmtShortDate(n.date)}${n.info.special ? ` <span class="chip chip-yellow">${n.info.label}</span>` : ""}</div>
      <div class="flex flex-wrap gap-1.5">
        ${n.slots.map((s) => `<span class="chip">${s.period.label} ${clsLabel(s.cls)}</span>`).join("")}
      </div>
    </div>`;
}

function timeline(st, info) {
  return `
    <section class="card">
      <div class="lhead">${icon("clock")}오늘 감독 타임라인<span class="ml-auto text-xs font-semibold opacity-80">${st.done}/${st.list.length} 완료</span></div>
      <div class="divide-y-2 divide-line">
        ${st.list.map((s) => slotRow(s, { withState: true, date: info.iso })).join("")}
      </div>
    </section>`;
}

function notice() {
  return `
    <div class="block key flex items-start gap-2 p-3 text-xs font-semibold">
      ${icon("triangle-alert", "mt-0.5 h-4 w-4 shrink-0")}<span>${PENALTY_NOTICE}을 부과해 주세요.</span>
    </div>`;
}

const fmtClock = (secs) => `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
function fmtDuration(min) {
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}
