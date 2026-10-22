// 해시 기반 라우터 (#/today, #/timetable, ...)
const routes = new Map();
let current = null;
let cleanup = null;

export function route(path, view) { routes.set(path, view); }

export function currentPath() {
  const h = location.hash.replace(/^#\/?/, "").split("?")[0];
  return h || "today";
}

export function navigate(path) { location.hash = `#/${path}`; }

export function render(root) {
  const path = currentPath();
  const view = routes.get(path) ?? routes.get("today");
  if (typeof cleanup === "function") cleanup();
  root.innerHTML = "";
  cleanup = view(root) ?? null;
  current = path;
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.setAttribute("aria-current", el.dataset.nav === path ? "page" : "false");
  });
  window.scrollTo({ top: 0 });
}

export function rerender(root) {
  const y = window.scrollY;
  render(root);
  window.scrollTo({ top: y });
}

export const activePath = () => current;
