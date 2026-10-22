// 설정: 담당 교사 · 테마 · 알림 · 앱 설치 · 정보
import { store } from "../lib/store.js";
import { getDayInfo, teacherSlots, nextDutyDay } from "../lib/schedule.js";
import { ALERT_BEFORE_MIN, TERM, sheetUrl } from "../data/config.js";
import { notify, requestNotificationPermission, notificationState } from "../lib/alerts.js";
import { icon, refreshIcons } from "../ui/icons.js";
import { teacherSelect, bindTeacherSelect } from "../ui/parts.js";
import { toast, modal } from "../ui/feedback.js";

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

export function settingsView(root) {
  const s = store.get();
  const perm = notificationState();
  const permLabel = { granted: "허용됨", denied: "차단됨 (브라우저 설정에서 변경)", default: "아직 허용 안 함", unsupported: "이 브라우저는 지원하지 않음" }[perm];

  root.innerHTML = `
    <div class="space-y-4 fade-in">
      ${section("user-round", "담당 교사", `
        ${teacherSelect()}
        <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">이 기기에만 저장됩니다. 다른 기기에서는 다시 선택해 주세요.</p>`)}

      ${section("monitor", "화면 테마", `
        <div class="seg w-full" id="theme-seg">
          ${[["system", "monitor", "시스템"], ["light", "sun", "라이트"], ["dark", "moon", "다크"]]
            .map(([v, ic, l]) => `<button class="flex-1" data-theme="${v}" aria-pressed="${s.theme === v}">${icon(ic, "w-4 h-4 mr-1 inline")}${l}</button>`).join("")}
        </div>`)}

      ${section("bell", "감독 알림", `
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-sm font-semibold text-slate-800 dark:text-slate-200">감독 시작 ${ALERT_BEFORE_MIN}분 전 알림</div>
            <div class="text-xs text-slate-500 dark:text-slate-400">앱이 열려 있을 때 팝업 + 진동으로 알립니다.</div>
          </div>
          <button class="toggle" role="switch" aria-checked="${s.alerts}" id="alerts-toggle"></button>
        </div>
        <div class="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div>
            <div class="text-sm font-semibold text-slate-800 dark:text-slate-200">브라우저 푸시 알림</div>
            <div class="text-xs text-slate-500 dark:text-slate-400">상태: ${permLabel}</div>
          </div>
          ${perm === "default" ? `<button id="btn-perm" class="btn btn-primary btn-sm">허용하기</button>` : ""}
        </div>
        <button id="btn-test" class="btn btn-amber btn-sm mt-3">${icon("bell-ring", "w-3.5 h-3.5")}알림 테스트</button>
        ${isIOS() && !isStandalone() ? `<p class="mt-2 text-xs text-amber-700 dark:text-amber-400">iPhone은 홈 화면에 추가한 뒤 실행해야 푸시 알림이 동작합니다.</p>` : ""}`)}

      ${section("smartphone", "앱으로 설치", installBlock())}

      ${section("info", "정보", `
        <dl class="space-y-1.5 text-sm">
          <div class="flex justify-between"><dt class="text-slate-500">버전</dt><dd class="font-semibold">${__APP_VERSION__}</dd></div>
          <div class="flex justify-between"><dt class="text-slate-500">자습 기간</dt><dd class="font-semibold">${TERM.start.slice(5).replace("-", "/")} ~ ${TERM.end.slice(5).replace("-", "/")}</dd></div>
          <div class="flex justify-between"><dt class="text-slate-500">데이터 출처</dt><dd class="font-semibold">수능 전 감독 시간.xlsx</dd></div>
        </dl>
        <div class="mt-3 flex flex-wrap gap-2">
          <a href="${sheetUrl()}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">${icon("file-spreadsheet", "w-3.5 h-3.5")}출결 시트</a>
          <button id="btn-reset" class="btn btn-ghost btn-sm text-rose-600 dark:text-rose-400">${icon("trash-2", "w-3.5 h-3.5")}설정 초기화</button>
        </div>`)}
    </div>`;

  bindTeacherSelect(root);
  root.querySelector("#theme-seg").addEventListener("click", (e) => {
    const b = e.target.closest("[data-theme]"); if (!b) return;
    store.set({ theme: b.dataset.theme });
  });
  root.querySelector("#alerts-toggle").addEventListener("click", (e) => {
    const on = e.currentTarget.getAttribute("aria-checked") !== "true";
    e.currentTarget.setAttribute("aria-checked", on);
    store.get().alerts = on; // 즉시 반영
    store.set({ alerts: on });
  });
  root.querySelector("#btn-perm")?.addEventListener("click", async () => {
    const r = await requestNotificationPermission();
    toast(r === "granted" ? "푸시 알림이 허용되었습니다." : "알림이 허용되지 않았습니다.");
    settingsView(root);
  });
  root.querySelector("#btn-test").addEventListener("click", () => {
    const t = store.get().teacher;
    if (!t) return toast("선생님을 먼저 선택해 주세요.");
    const info = getDayInfo();
    const slot = teacherSlots(info.assignments, t)[0] ?? nextDutyDay(t)?.slots[0];
    if (!slot) return toast("표시할 감독 일정이 없습니다.");
    notify(t, { ...slot, minutesUntil: ALERT_BEFORE_MIN }, { test: true });
  });
  root.querySelector("#btn-install")?.addEventListener("click", async () => {
    const p = window.__installPrompt; if (!p) return;
    p.prompt();
    const { outcome } = await p.userChoice;
    if (outcome === "accepted") { window.__installPrompt = null; toast("홈 화면에 설치되었습니다."); settingsView(root); }
  });
  root.querySelector("#btn-reset").addEventListener("click", () => {
    modal({ iconName: "trash-2", tone: "amber", title: "설정을 초기화할까요?", body: "선택한 선생님·테마·알림 설정이 지워집니다.", confirmText: "초기화",
      onConfirm: () => { store.set({ teacher: "", theme: "system", alerts: true }); toast("초기화되었습니다."); } });
  });
  refreshIcons(root);
}

function section(ic, title, body) {
  return `
    <section class="card p-4 sm:p-5">
      <h3 class="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">${icon(ic, "w-4 h-4 text-brand-600")}${title}</h3>
      ${body}
    </section>`;
}

function installBlock() {
  if (isStandalone()) return `<div class="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">${icon("circle-check")}앱으로 실행 중입니다</div>`;
  if (window.__installPrompt) return `
    <p class="mb-3 text-sm text-slate-600 dark:text-slate-300">홈 화면에 설치하면 앱처럼 바로 열리고, 오프라인에서도 시간표를 볼 수 있습니다.</p>
    <button id="btn-install" class="btn btn-primary">${icon("download")}홈 화면에 설치</button>`;
  if (isIOS()) return `
    <p class="mb-2 text-sm text-slate-600 dark:text-slate-300">Safari에서 아래 순서로 추가하세요.</p>
    <ol class="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
      <li class="flex items-center gap-2">${icon("share", "w-4 h-4 text-brand-600")}하단 <b>공유</b> 버튼 탭</li>
      <li class="flex items-center gap-2">${icon("square-plus", "w-4 h-4 text-brand-600")}<b>홈 화면에 추가</b> 선택</li>
      <li class="flex items-center gap-2">${icon("check", "w-4 h-4 text-brand-600")}오른쪽 위 <b>추가</b></li>
    </ol>`;
  return `
    <p class="text-sm text-slate-600 dark:text-slate-300">Chrome 메뉴(⋮) → <b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 누르면 앱처럼 쓸 수 있습니다.</p>`;
}
