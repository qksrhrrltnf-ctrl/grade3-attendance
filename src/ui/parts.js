// 여러 화면에서 공유하는 조각들
import { allTeachers, clsLabel, timeLabel } from "../lib/schedule.js";
import { sheetUrl } from "../data/config.js";
import { store } from "../lib/store.js";
import { icon } from "./icons.js";

export function teacherSelect(id = "teacher-select") {
  const cur = store.get().teacher;
  return `
    <div class="relative">
      <select id="${id}" class="field appearance-none pr-10">
        <option value="">선생님 이름을 선택하세요</option>
        ${allTeachers().map((t) => `<option value="${t}" ${t === cur ? "selected" : ""}>${t}</option>`).join("")}
      </select>
      ${icon("chevron-down", "pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400")}
    </div>`;
}

export function bindTeacherSelect(root, id = "teacher-select") {
  root.querySelector(`#${id}`)?.addEventListener("change", (e) => store.set({ teacher: e.target.value }));
}

/** 교사 미선택 안내 카드 */
export function teacherPrompt() {
  return `
    <section class="card p-6 sm:p-10 text-center space-y-4 fade-in">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-slate-800 dark:text-brand-400">${icon("user-round", "w-8 h-8")}</div>
      <div>
        <h3 class="text-lg font-bold text-slate-900 dark:text-white">담당 선생님을 선택해 주세요</h3>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">한 번 선택하면 이 기기에 저장되어 다음부터 바로 내 일정이 열립니다.</p>
      </div>
      <div class="mx-auto max-w-sm text-left">${teacherSelect()}</div>
    </section>`;
}

export const STATE_CHIP = {
  done: `<span class="chip bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">${icon("check", "w-3 h-3")}완료</span>`,
  now: `<span class="chip bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-dot"></span>진행 중</span>`,
  soon: `<span class="chip bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">${icon("bell-ring", "w-3 h-3")}곧 시작</span>`,
  upcoming: `<span class="chip bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">예정</span>`,
};

/** 감독 슬롯 한 줄 (타임라인·시간표 공용) */
export function slotRow(s, { withState = false, withLink = true } = {}) {
  const state = withState && s.state ? s.state : null;
  const dim = state === "done" ? "opacity-60" : "";
  const live = state === "now" ? "bg-emerald-50/60 dark:bg-emerald-950/20" : "";
  return `
    <div class="flex items-center gap-3 p-4 ${dim} ${live}">
      <div class="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-brand-100 bg-brand-50 font-bold text-brand-700 dark:border-brand-800 dark:bg-brand-950/50 dark:text-brand-300">
        <span class="text-[10px] font-medium text-brand-500 dark:text-brand-400">교시</span>
        <span class="text-base leading-none">${s.period.no}</span>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span class="text-base font-bold text-slate-900 dark:text-white">${clsLabel(s.cls)}</span>
          ${s.period.sub ? `<span class="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">${s.period.sub}</span>` : ""}
          ${state ? STATE_CHIP[state] : ""}
        </div>
        <div class="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">${s.period.label} · ${timeLabel(s.period)}</div>
      </div>
      ${withLink ? `<a href="${sheetUrl(s.cls)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm shrink-0" title="구글 시트에서 출결 입력">${icon("file-spreadsheet", "w-4 h-4")}<span class="hidden sm:inline">시트</span></a>` : ""}
    </div>`;
}

export function emptyState(iconName, title, desc = "") {
  return `
    <div class="p-8 text-center text-slate-500 dark:text-slate-400">
      ${icon(iconName, "mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-600")}
      <p class="font-semibold text-slate-700 dark:text-slate-300">${title}</p>
      ${desc ? `<p class="mt-1 text-xs">${desc}</p>` : ""}
    </div>`;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}
