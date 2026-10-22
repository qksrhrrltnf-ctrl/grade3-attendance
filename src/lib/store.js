// 기기 로컬 설정 (localStorage) + 변경 구독
const KEY = "g3att:v1";
const listeners = new Set();

const defaults = { teacher: "", theme: "system", alerts: true, homeroom: "" };

function read() {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
  catch { return { ...defaults }; }
}

let state = read();

// 구버전(단일 HTML)에서 저장한 기본 교사 이어받기
try {
  const legacy = localStorage.getItem("defaultTeacher");
  if (legacy && !state.teacher) { state.teacher = legacy; persist(); }
} catch { /* ignore */ }

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode 등 */ }
}

export const store = {
  get: () => state,
  set(patch) {
    state = { ...state, ...patch };
    persist();
    listeners.forEach((fn) => fn(state, patch));
  },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

export function applyTheme() {
  const t = state.theme;
  const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  try { localStorage.setItem("theme", t); } catch { /* ignore */ }
}

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => state.theme === "system" && applyTheme());
