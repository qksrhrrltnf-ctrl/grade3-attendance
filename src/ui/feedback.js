// 토스트 · 모달
import { icon, refreshIcons } from "./icons.js";

export function toast(msg, { duration = 2500, action, actionLabel = "업데이트" } = {}) {
  const host = document.getElementById("toasts");
  const el = document.createElement("div");
  el.className = "pointer-events-auto block prompt flex items-center gap-2 px-4 py-3 text-xs font-bold fade-in max-w-[calc(100vw-2rem)]";
  el.innerHTML = `${icon("circle-check", "w-4 h-4 shrink-0")}<span class="text-bg">${msg}</span>` +
    (action ? `<button class="ml-2 rounded-[3px] bg-pink px-2 py-0.5 text-black">${actionLabel}</button>` : "");
  if (action) el.querySelector("button").addEventListener("click", () => { action(); el.remove(); });
  host.appendChild(el);
  refreshIcons(el);
  setTimeout(() => { el.classList.add("opacity-0", "transition-opacity"); setTimeout(() => el.remove(), 400); }, duration);
}

/** 모달. 반환값으로 닫기 함수를 돌려줌 */
export function modal({ title, body = "", detail = "", iconName = "info", tone = "key", confirmText = "확인했습니다", onConfirm }) {
  const host = document.getElementById("modal-root");
  const wrap = document.createElement("div");
  wrap.className = "fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]";
  wrap.innerHTML = `
    <div role="dialog" aria-modal="true" class="card w-full max-w-sm fade-in">
      <div class="p-6 space-y-4">
        <div class="block ${tone} mx-auto flex h-12 w-12 items-center justify-center">${icon(iconName, "w-6 h-6")}</div>
        <div class="text-center space-y-1">
          <h4 class="text-lg font-bold">${title}</h4>
          ${body ? `<p class="text-sm text-ink-2">${body}</p>` : ""}
        </div>
        ${detail ? `<div class="block key p-3 text-center text-sm font-bold">${detail}</div>` : ""}
        <button class="btn btn-primary w-full" data-confirm>${confirmText}</button>
      </div>
    </div>`;
  const close = () => { wrap.remove(); };
  wrap.querySelector("[data-confirm]").addEventListener("click", () => { onConfirm?.(); close(); });
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  host.appendChild(wrap);
  refreshIcons(wrap);
  return close;
}
