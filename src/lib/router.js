// 해시 기반 라우터 (#/today, #/session?date=..&room=..&period=..)
const routes = new Map();
let current = null;
let cleanup = null;
let guardFn = null;

export function route(path, view) { routes.set(path, view); }
/** 로그인 가드: (path) => 대체 view | null */
export function setGuard(fn) { guardFn = fn; }

export function currentPath() {
  const h = location.hash.replace(/^#\/?/, "").split("?")[0];
  return h || "today";
}
export function currentParams() {
  const q = location.hash.split("?")[1] || "";
  return Object.fromEntries(new URLSearchParams(q));
}

export function navigate(path, params) {
  const q = params ? "?" + new URLSearchParams(params).toString() : "";
  location.hash = `#/${path}${q}`;
}

export function render(root) {
  const path = currentPath();
  let view = routes.get(path) ?? routes.get("today");
  const alt = guardFn?.(path);
  if (alt) view = alt;
  if (typeof cleanup === "function") cleanup();
  root.innerHTML = "";
  cleanup = view(root, currentParams()) ?? null;
  current = path;
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.setAttribute("aria-current", el.dataset.nav === path || (path === "session" && el.dataset.nav === "attendance") ? "page" : "false");
  });
  window.scrollTo({ top: 0 });
}

export function rerender(root) {
  const y = window.scrollY;
  render(root);
  window.scrollTo({ top: y });
}

export const activePath = () => current;
