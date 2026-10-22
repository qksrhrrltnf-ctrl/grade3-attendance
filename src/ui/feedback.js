// 토스트 · 모달
import { icon, refreshIcons } from "./icons.js";

export function toast(msg, { duration = 2500, action, actionLabel = "업데이트" } = {}) {
  const host = document.getElementById("toasts");
  const el = document.createElement("div");
  el.className =
    "pointer-events-auto flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-lg " +
    "dark:bg-slate-100 dark:text-slate-900 fade-in max-w-[calc(100vw-2rem)]";
  el.innerHTML = `${icon("circle-check", "w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0")}<span>${msg}</span>` +
    (action ? `<button class="ml-2 underline underline-offset-2 text-brand-300 dark:text-brand-700">${actionLabel}</button>` : "");
  if (action) el.querySelector("button").addEventListener("click", () => { action(); el.remove(); });
  host.appendChild(el);
  refreshIcons(el);
  setTimeout(() => { el.classList.add("opacity-0", "transition-opacity"); setTimeout(() => el.remove(), 300); }, duration);
}

/** 모달. 반환값으로 닫기 함수를 돌려줌 */
export function modal({ title, body = "", detail = "", iconName = "info", tone = "brand", confirmText = "확인했습니다", onConfirm }) {
  const host = document.getElementById("modal-root");
  const tones = {
    brand: "bg-brand-100 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400",
  };
  const wrap = document.createElement("div");
  wrap.className = "fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 pb-[max(1rem,env(safe-area-inset-bottom))]";
  wrap.innerHTML = `
    <div role="dialog" aria-modal="true" class="card w-full max-w-sm p-6 space-y-4 fade-in">
      <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full ${tones[tone] ?? tones.brand}">${icon(iconName, "w-6 h-6")}</div>
      <div class="text-center space-y-1">
        <h4 class="text-lg font-bold text-slate-900 dark:text-white">${title}</h4>
        ${body ? `<p class="text-sm text-slate-500 dark:text-slate-400">${body}</p>` : ""}
      </div>
      ${detail ? `<div class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-sm font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">${detail}</div>` : ""}
      <button class="btn btn-primary w-full" data-confirm>${confirmText}</button>
    </div>`;
  const close = () => { wrap.remove(); };
  wrap.querySelector("[data-confirm]").addEventListener("click", () => { onConfirm?.(); close(); });
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  host.appendChild(wrap);
  refreshIcons(wrap);
  return close;
}
