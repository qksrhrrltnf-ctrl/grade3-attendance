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
        <div class="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar" id="day-chips">
          ${DAY_ORDER.map((k) => `<button class="day-chip" data-day="${k}">${DAY_LABELS[k]} <span class="opacity-70">${maxPeriodNo(REGULAR[k])}교시</span></button>`).join("")}
          ${specialDayKeys().map((k) => `<button class="day-chip special" data-day="${k}">${icon("star", "w-3 h-3 mr-1 inline")}${specialDayLabel(k)}</button>`).join("")}
        </div>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="seg" id="mode-seg">
            <button data-mode="mine" ${store.get().teacher ? "" : "disabled"}>${icon("user-round", "w-4 h-4 mr-1 inline")}내 일정</button>
            <button data-mode="all">${icon("layout-grid", "w-4 h-4 mr-1 inline")}전체</button>
          </div>
          <div class="flex items-center gap-2">
            <button id="btn-copy" class="btn btn-ghost btn-sm">${icon("copy", "w-3.5 h-3.5")}복사</button>
            <button id="btn-print" class="btn btn-ghost btn-sm">${icon("printer", "w-3.5 h-3.5")}인쇄</button>
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
    <div class="flex items-center justify-between gap-2 px-1">
      <h3 class="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-200">
        ${icon(info.special ? "star" : "calendar-days", `w-4 h-4 ${info.special ? "text-amber-500" : "text-brand-600"}`)}
        ${info.label} <span class="text-xs font-semibold text-slate-500">총 ${maxPeriodNo(info.assignments)}교시</span>
      </h3>
      ${ui.mode === "mine" && t ? `<span class="text-xs font-semibold text-brand-600 dark:text-brand-400">${t} 선생님</span>` : ""}
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
      <section class="card overflow-hidden">
        ${list.length
          ? `<div class="divide-y divide-slate-100 dark:divide-slate-800">${list.map((s) => slotRow(s, { withState: isToday })).join("")}</div>`
          : emptyState("coffee", `${info.label}에는 배정된 감독이 없습니다.`)}
      </section>
    </div>`;
}

function all() {
  const info = dayInfoByKey(ui.day);
  return `
    <div class="space-y-3">
      ${header(info)}
      ${store.get().teacher ? "" : `<div class="card p-4 no-print">${teacherSelect()}</div>`}
      <div class="relative no-print">
        <input id="tt-search" type="search" value="${ui.query}" placeholder="교사명 또는 반 검색 (예: 김영웅, 3-4)" class="field pl-10 py-2.5 text-sm" autocomplete="off" />
        ${icon("search", "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400")}
      </div>
      <div id="all-results">${allResults()}</div>
    </div>`;
}

function allResults() {
  const info = dayInfoByKey(ui.day);
  const me = store.get().teacher;
  const q = ui.query.toLowerCase();
  const periods = periodsOf(info.assignments);
  const cell = (teacher, cls) => {
    const isMe = me && teacher === me;
    const hit = q && (teacher.toLowerCase().includes(q) || cls.includes(q));
    const cls_ = isMe ? "bg-brand-50 text-brand-700 font-bold ring-1 ring-brand-400 dark:bg-brand-950/60 dark:text-brand-300"
      : hit ? "bg-amber-100 text-amber-900 font-bold dark:bg-amber-900/50 dark:text-amber-200" : "";
    return { isMe, hit, cls_ };
  };

  // 모바일: 반별 카드 (4교시 점심 전/후 교사가 같으면 한 줄로)
  const cards = CLASSES.map((cls) => {
    const merged = [];
    for (const p of periods) {
      const t = info.assignments[p.key][cls] || "-";
      const prev = merged[merged.length - 1];
      if (prev && prev.p.key === "4a" && p.key === "4b" && prev.t === t) {
        merged[merged.length - 1] = { p: { ...prev.p, key: "4", sub: undefined, segments: [prev.p, p] }, t };
      } else merged.push({ p, t });
    }
    const rows = merged.map(({ p, t }) => {
      const c = cell(t, cls);
      return `<li class="flex items-center justify-between px-3 py-2 text-sm rounded-lg ${c.cls_}">
        <span class="text-slate-500 dark:text-slate-400"><b class="text-slate-700 dark:text-slate-200">${p.label}</b>${p.sub ? ` <span class="text-[11px]">${p.sub}</span>` : ""} <span class="text-[11px]">${timeLabel(p)}</span></span>
        <span class="font-semibold">${t}</span></li>`;
    });
    const mineCount = periods.filter((p) => me && info.assignments[p.key][cls] === me).length;
    return `
      <section class="card overflow-hidden">
        <div class="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
          <span class="font-bold text-slate-900 dark:text-white">${clsLabel(cls)}</span>
          ${mineCount ? `<span class="chip bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">내 감독 ${mineCount}</span>` : ""}
        </div>
        <ul class="p-1.5">${rows.join("")}</ul>
      </section>`;
  });

  // 데스크톱: 그리드
  const table = `
    <section class="card overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-slate-100 text-xs font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <tr><th class="px-3 py-3 text-center">교시</th><th class="px-3 py-3 text-center">시간</th>
            ${CLASSES.map((c) => `<th class="px-2 py-3 text-center">${c}</th>`).join("")}</tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          ${periods.map((p) => `
            <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
              <td class="px-3 py-2.5 text-center font-bold text-brand-700 dark:text-brand-400">${p.label}${p.sub ? `<div class="text-[10px] font-medium text-slate-500">${p.sub}</div>` : ""}</td>
              <td class="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">${timeLabel(p)}</td>
              ${CLASSES.map((cls) => { const t = info.assignments[p.key][cls] || "-"; const c = cell(t, cls);
                return `<td class="px-1 py-1.5 text-center"><span class="inline-block w-full rounded-lg px-2 py-1.5 font-medium ${c.cls_}">${t}</span></td>`; }).join("")}
            </tr>`).join("")}
        </tbody>
      </table>
    </section>`;

  return `<div class="grid gap-3 sm:grid-cols-2 md:hidden">${cards.join("")}</div><div class="hidden md:block">${table}</div>`;
}
