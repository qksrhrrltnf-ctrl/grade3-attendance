// 앱 셸: 헤더 + 하단 탭(모바일) / 사이드바(데스크톱) + 본문 컨테이너
import { APP_NAME } from "../data/config.js";
import { dday, fmtKoDate } from "../lib/schedule.js";
import { icon, refreshIcons } from "./icons.js";

const NAV = [
  { path: "today", label: "오늘", icon: "house" },
  { path: "timetable", label: "시간표", icon: "calendar-days" },
  { path: "attendance", label: "출결", icon: "clipboard-check" },
  { path: "settings", label: "설정", icon: "settings" },
];

export function mountShell(app) {
  app.innerHTML = `
    <div class="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <nav class="fixed inset-x-0 bottom-0 z-40 border-t-2 border-line bg-paper pb-[env(safe-area-inset-bottom)]
                  md:static md:min-h-dvh md:border-t-0 md:border-r-2 md:bg-bg md:pb-0" aria-label="주 메뉴">
        <div class="hidden md:flex h-16 items-center gap-3 border-b-2 border-line px-5">
          <div class="block mission flex h-9 w-9 items-center justify-center">${icon("clipboard-check", "w-5 h-5")}</div>
          <div class="leading-tight">
            <div class="font-bold">${APP_NAME}</div>
            <div class="text-[11px] text-muted">수능 전 자습 감독</div>
          </div>
        </div>
        <ul class="flex gap-1 p-1.5 md:flex-col md:p-3">
          ${NAV.map((n) => `
            <li class="flex-1 md:flex-none">
              <a href="#/${n.path}" data-nav="${n.path}" class="nav-item" aria-current="false">
                ${icon(n.icon, "w-6 h-6 md:w-5 md:h-5")}<span>${n.label}</span>
              </a>
            </li>`).join("")}
        </ul>
      </nav>

      <div class="flex min-h-dvh flex-col">
        <header class="sticky top-0 z-30 border-b-2 border-line bg-paper pt-[env(safe-area-inset-top)]">
          <div class="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
            <div class="flex items-center gap-2.5 md:hidden">
              <div class="block mission flex h-8 w-8 items-center justify-center">${icon("clipboard-check", "w-4 h-4")}</div>
              <div class="font-bold">${APP_NAME}</div>
            </div>
            <div id="hdr-date" class="hidden md:block text-sm font-semibold text-ink-2"></div>
            <div class="flex items-center gap-2">
              <span id="dday-pill" class="chip chip-gold hidden"></span>
              <span id="clock" class="block prompt px-2.5 py-1 text-sm font-bold tracking-wider">--:--</span>
            </div>
          </div>
          <div id="offline-banner" class="warn hidden px-4 py-1.5 text-center text-xs font-bold">
            오프라인 상태입니다 — 저장된 시간표를 표시 중
          </div>
        </header>
        <main id="main" class="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-28 md:pb-10"></main>
      </div>
    </div>
    <div id="toasts" class="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:inset-x-auto md:bottom-6 md:right-6 md:items-end"></div>
    <div id="modal-root"></div>`;

  refreshIcons(app);
  startClock();
  watchNetwork();
  return { main: app.querySelector("#main") };
}

function startClock() {
  const clock = document.getElementById("clock");
  const date = document.getElementById("hdr-date");
  const pill = document.getElementById("dday-pill");
  const tick = () => {
    const now = new Date();
    clock.textContent = now.toTimeString().slice(0, 8);
    date.textContent = fmtKoDate(now);
    const d = dday(undefined, now);
    if (d >= 0) {
      pill.textContent = d === 0 ? "수능 D-DAY" : `수능 D-${d}`;
      pill.classList.remove("hidden");
    } else pill.classList.add("hidden");
  };
  tick();
  setInterval(tick, 1000);
}

function watchNetwork() {
  const banner = document.getElementById("offline-banner");
  const sync = () => banner.classList.toggle("hidden", navigator.onLine);
  window.addEventListener("online", sync);
  window.addEventListener("offline", sync);
  sync();
}
