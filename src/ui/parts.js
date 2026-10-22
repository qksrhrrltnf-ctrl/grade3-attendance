// 여러 화면에서 공유하는 조각들
import { allTeachers, clsLabel, timeLabel } from "../lib/schedule.js";
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
      ${icon("chevron-down", "pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2")}
    </div>`;
}

export function bindTeacherSelect(root, id = "teacher-select") {
  root.querySelector(`#${id}`)?.addEventListener("change", (e) => store.set({ teacher: e.target.value }));
}

/** 교사 미선택 안내 카드 */
export function teacherPrompt() {
  return `
    <section class="card fade-in">
      <div class="p-6 sm:p-10 text-center space-y-4">
        <div class="block mission mx-auto flex h-16 w-16 items-center justify-center">${icon("user-round", "w-8 h-8")}</div>
        <div>
          <h3 class="text-xl font-bold">담당 <span class="hl">선생님</span>을 선택해 주세요</h3>
          <p class="mt-2 text-sm text-ink-2">한 번 선택하면 이 기기에 저장되어 다음부터 바로 내 일정이 열립니다.</p>
        </div>
        <div class="mx-auto max-w-sm text-left">${teacherSelect()}</div>
      </div>
    </section>`;
}

export const STATE_CHIP = {
  done: `<span class="chip chip-muted">${icon("check", "w-3 h-3")}완료</span>`,
  now: `<span class="chip chip-yellow"><span class="h-2 w-2 rounded-full bg-black pulse-dot"></span>진행 중</span>`,
  soon: `<span class="chip chip-red">${icon("bell-ring", "w-3 h-3")}곧 시작</span>`,
  upcoming: `<span class="chip chip-pink">예정</span>`,
};

/** 교시 번호 박스 — 핑크/옐로/골드 순환 */
export const periodBox = (no, size = "h-12 w-12") => `
  <div class="block mini-${((no - 1) % 3) + 1} flex ${size} shrink-0 flex-col items-center justify-center font-bold">
    <span class="text-[10px] font-semibold leading-none">교시</span>
    <span class="text-lg leading-tight">${no}</span>
  </div>`;

/** 감독 슬롯 한 줄 (타임라인·시간표 공용). date 를 주면 출결 입력 링크가 붙음 */
export function slotRow(s, { withState = false, date = null } = {}) {
  const state = withState && s.state ? s.state : null;
  const dim = state === "done" ? "opacity-55" : "";
  const live = state === "now" ? "bg-[color-mix(in_srgb,var(--yellow)_22%,var(--paper))]" : "";
  return `
    <div class="flex items-center gap-3 p-4 ${dim} ${live}">
      ${periodBox(s.period.no)}
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span class="text-base font-bold">${clsLabel(s.cls)}</span>
          ${s.period.sub ? `<span class="chip">${s.period.sub}</span>` : ""}
          ${state ? STATE_CHIP[state] : ""}
        </div>
        <div class="mt-0.5 text-xs font-medium text-ink-2">${s.period.label} · ${timeLabel(s.period)}</div>
      </div>
      ${date ? `<a href="#/session?date=${date}&room=${s.cls}&period=${s.period.no}" class="btn btn-sm shrink-0 ${state === "now" || state === "soon" ? "btn-primary" : ""}" title="출결 입력">${icon("clipboard-check", "w-4 h-4")}<span class="hidden sm:inline">출결</span></a>` : ""}
    </div>`;
}

export function emptyState(iconName, title, desc = "") {
  return `
    <div class="p-8 text-center">
      <div class="block key mx-auto mb-3 flex h-12 w-12 items-center justify-center">${icon(iconName, "h-6 w-6")}</div>
      <p class="font-bold">${title}</p>
      ${desc ? `<p class="mt-1 text-xs text-ink-2">${desc}</p>` : ""}
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
