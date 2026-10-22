// 시간표 화면: 요일 선택 → 내 일정 / 전체(반별 카드 · 그리드)
import { store } from "../lib/store.js";
import {
  dayInfoByKey, getDayInfo, teacherSlots, statusOf, periodsOf, specialDayKeys, specialDayLabel, timeLabel, clsLabel, maxPeriodNo,
} from "../lib/schedule.js";
import { CLASSES, DAY_ORDER, DAY_LABELS } from "../data/config.js";
import { REGULAR } from "../data/timetable.js";
import { icon, refreshIcons } from "../ui/icons.js";
import { slotRow, emptyState, copyText, teacherSelect, bindTeacherSelect } from "../ui/parts.js";
import { toast } from "../ui/feedback.js";

const ui = { day: null, mode: "mine", query: "" };

export function timetableView(root) {
  const today = getDayInfo();
  if (!ui.day) ui.day = today.special ? today.key : (today.dayKey ?? "mon");
  if (!store.get().teacher) ui.mode = "all";

  root.innerHTML = `
    <div class="space-y-4 fade-in">
      <section class="no-print space-y-3">
        <div class="-mx-4 flex gap-2 overflow-x-auto px-4 py-0.5 no-scrollbar" id="day-chips">
          ${DAY_ORDER.map((k) => `<button class="day-chip" data-day="${k}">${DAY_LABELS[k]} <span class="text-xs font-medium opacity-70">${maxPeriodNo(REGULAR[k])}교시</span></button>`).join("")}
          ${specialDayKeys().map((k) => `<button class="day-chip special" data-day="${k}">${icon("star", "w-3.5 h-3.5")}${specialDayLabel(k)}</button>`).join("")}
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="seg" id="mode-seg">
            <button data-mode="mine" ${store.get().teacher ? "" : "disabled"}>${icon("user-round", "w-4 h-4 mr-1")}내 일정</button>
            <button data-mode="all">${icon("layout-grid", "w-4 h-4 mr-1")}전체</button>
          </div>
          <div class="flex items-center gap-2">
            <button id="btn-copy" class="btn btn-sm">${icon("copy", "w-3.5 h-3.5")}복사</button>
            <button id="btn-print" class="btn btn-sm">${icon("printer", "w-3.5 h-3.5")}인쇄</button>
          </div>
        </div>
      </section>
      <div id="tt-body"></div>
    </div>`;

  const body = root.querySelector("#tt-body");
  const redraw = () => {
    root.querySelectorAll("[data-day]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.day === ui.day));
    root.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === ui.mode));
    body.innerHTML = ui.mode === "mine" ? mine() : all();
    bindTeacherSelect(body);
    body.querySelector("#tt-search")?.addEventListener("input", (e) => {
      ui.query = e.target.value.trim();
      body.querySelector("#all-results").innerHTML = allResults();
      refreshIcons(body);
    });
    refreshIcons(root);
  };

  root.querySelector("#day-chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-day]"); if (!b) return;
    ui.day = b.dataset.day; redraw();
  });
  root.querySelector("#mode-seg").addEventListener("click", (e) => {
    const b = e.target.closest("[data-mode]"); if (!b || b.disabled) return;
    ui.mode = b.dataset.mode; redraw();
  });
  root.querySelector("#btn-print").addEventListener("click", () => window.print());
  root.querySelector("#btn-copy").addEventListener("click", async () => {
    const t = store.get().teacher;
    if (!t) return toast("선생님을 먼저 선택해 주세요.");
    const info = dayInfoByKey(ui.day);
    const slots = teacherSlots(info.assignments, t);
    const lines = slots.length ? slots.map((s) => `- ${s.period.label}(${timeLabel(s.period)}): ${clsLabel(s.cls)}`) : ["- 배정된 감독이 없습니다."];
    const ok = await copyText(`[3학년 자습 감독 일정]\n- 교사명: ${t}\n- 요일: ${info.label}\n${lines.join("\n")}`);
    toast(ok ? "일정이 클립보드에 복사되었습니다." : "복사에 실패했습니다.");
  });

  redraw();
}

function header(info) {
  const t = store.get().teacher;
  return `
    <div class="lhead lhead-standalone">
      ${icon(info.special ? "star" : "calendar-days", "w-4 h-4")}
      ${info.label} <span class="text-xs font-semibold opacity-80">총 ${maxPeriodNo(info.assignments)}교시</span>
      ${ui.mode === "mine" && t ? `<span class="ml-auto rounded-[3px] bg-pink px-2 py-0.5 text-xs font-bold text-black">${t} 선생님</span>` : ""}
    </div>`;
}

function mine() {
  const info = dayInfoByKey(ui.day);
  const t = store.get().teacher;
  const slots = teacherSlots(info.assignments, t);
  const isToday = getDayInfo().key === ui.day;
  const list = isToday ? statusOf(slots).list : slots;
  return `
    <div class="space-y-3">
      ${header(info)}
      <section class="card">
        ${list.length
          ? `<div class="divide-y-2 divide-line">${list.map((s) => slotRow(s, { withState: isToday })).join("")}</div>`
          : emptyState("coffee", `${info.label}에는 배정된 감독이 없습니다.`)}
      </section>
    </div>`;
}

function all() {
  const info = dayInfoByKey(ui.day);
  return `
    <div class="space-y-3">
      ${header(info)}
      ${store.get().teacher ? "" : `<div class="card"><div class="p-4">${teacherSelect()}</div></div>`}
      <div class="relative no-print">
        <input id="tt-search" type="search" value="${ui.query}" placeholder="교사명 또는 반 검색 (예: 김영웅, 3-4)" class="field pl-10 py-2.5 text-sm" autocomplete="off" />
        ${icon("search", "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2")}
      </div>
      <div id="all-results">${allResults()}</div>
    </div>`;
}

function allResults() {
  const info = dayInfoByKey(ui.day);
  const me = store.get().teacher;
  const q = ui.query.toLowerCase();
  const periods = periodsOf(info.assignments);
  const cellCls = (teacher, cls) => {
    if (me && teacher === me) return "bg-pink text-black font-bold";
    if (q && (teacher.toLowerCase().includes(q) || cls.includes(q))) return "bg-yellow text-black font-bold";
    return "";
  };

  // 모바일: 반별 카드 (4교시 점심 전/후 교사가 같으면 한 줄로)
  const cards = CLASSES.map((cls, idx) => {
    const merged = [];
    for (const p of periods) {
      const t = info.assignments[p.key][cls] || "-";
      const prev = merged[merged.length - 1];
      if (prev && prev.p.key === "4a" && p.key === "4b" && prev.t === t) {
        merged[merged.length - 1] = { p: { ...prev.p, key: "4", sub: undefined, segments: [prev.p, p] }, t };
      } else merged.push({ p, t });
    }
    const rows = merged.map(({ p, t }) => `
      <li class="flex items-center justify-between gap-2 px-3 py-2 text-sm ${cellCls(t, cls)}">
        <span class="text-ink-2"><b class="text-ink">${p.label}</b>${p.sub ? ` <span class="text-[11px]">${p.sub}</span>` : ""} <span class="text-[11px]">${timeLabel(p)}</span></span>
        <span class="font-semibold">${t}</span></li>`);
    const mineCount = periods.filter((p) => me && info.assignments[p.key][cls] === me).length;
    return `
      <section class="card">
        <div class="flex items-center justify-between border-b-2 border-line px-4 py-2.5 mini-${(idx % 3) + 1}">
          <span class="font-bold">${clsLabel(cls)}</span>
          ${mineCount ? `<span class="chip">내 감독 ${mineCount}</span>` : ""}
        </div>
        <ul class="divide-y divide-line/20">${rows.join("")}</ul>
      </section>`;
  });

  // 데스크톱: 그리드
  const table = `
    <section class="card overflow-x-auto">
      <table class="tbl w-full text-sm">
        <thead class="text-xs font-bold uppercase">
          <tr><th class="px-3 py-3 text-center">교시</th><th class="px-3 py-3 text-center">시간</th>
            ${CLASSES.map((c) => `<th class="px-2 py-3 text-center">${c}</th>`).join("")}</tr>
        </thead>
        <tbody class="divide-y-2 divide-line">
          ${periods.map((p) => `
            <tr>
              <td class="px-3 py-2.5 text-center font-bold">${p.label}${p.sub ? `<div class="text-[10px] font-medium text-ink-2">${p.sub}</div>` : ""}</td>
              <td class="px-3 py-2.5 text-center text-xs font-semibold text-ink-2 whitespace-nowrap">${timeLabel(p)}</td>
              ${CLASSES.map((cls) => { const t = info.assignments[p.key][cls] || "-";
                return `<td class="px-1 py-1.5 text-center"><span class="inline-block w-full rounded-[4px] px-2 py-1.5 font-medium ${cellCls(t, cls)}">${t}</span></td>`; }).join("")}
            </tr>`).join("")}
        </tbody>
      </table>
    </section>`;

  return `<div class="grid gap-3 sm:grid-cols-2 md:hidden">${cards.join("")}</div><div class="hidden md:block">${table}</div>`;
}
