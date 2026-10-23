// 작은 인터랙션 효과: 컨페티, 숫자 카운트업, 스와이프 감지
const COLORS = ["#ff90e8", "#f1f333", "#ffc900"];

/** el 위치에서 조각을 터뜨림 */
export function confetti(el, count = 22) {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "confetti";
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 70 + Math.random() * 90;
    p.style.cssText = `left:${cx}px;top:${cy}px;background:${COLORS[i % 3]};--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist - 60}px;--rot:${(Math.random() * 540 - 270).toFixed(0)}deg;`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1200);
  }
}

/** 숫자 카운트업 (data-count 속성 요소) */
export function countUp(root, duration = 600) {
  root.querySelectorAll("[data-count]").forEach((el) => {
    const target = Number(el.dataset.count); if (!Number.isFinite(target)) return;
    const suffix = el.dataset.suffix ?? "";
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / duration);
      const v = Math.round(target * (1 - Math.pow(1 - k, 3)));
      el.textContent = `${v}${suffix}`;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/** 가로 스와이프: onSwipe(-1|1) */
export function onSwipe(el, cb, threshold = 60) {
  let x0 = 0, y0 = 0, active = false;
  el.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; active = true; }, { passive: true });
  el.addEventListener("touchend", (e) => {
    if (!active) return; active = false;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > threshold && Math.abs(dy) < Math.abs(dx) * 0.6) cb(dx < 0 ? 1 : -1);
  }, { passive: true });
}

export const haptic = (pattern = 10) => { try { navigator.vibrate?.(pattern); } catch { /* ignore */ } };
