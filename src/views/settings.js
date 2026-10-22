// 설정: 담당 교사 · 테마 · 알림 · 앱 설치 · 정보
import { store } from "../lib/store.js";
import { getDayInfo, teacherSlots, nextDutyDay } from "../lib/schedule.js";
import { ALERT_BEFORE_MIN, TERM, sheetUrl } from "../data/config.js";
import { notify, requestNotificationPermission, notificationState } from "../lib/alerts.js";
import { icon, refreshIcons } from "../ui/icons.js";
import { toast, modal } from "../ui/feedback.js";
import { isAdmin, loginAdmin, logoutAdmin, logout } from "../lib/auth.js";

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

export function settingsView(root) {
  const s = store.get();
  const perm = notificationState();
  const permLabel = { granted: "허용됨", denied: "차단됨 (브라우저 설정에서 변경)", default: "아직 허용 안 함", unsupported: "이 브라우저는 지원하지 않음" }[perm];

  root.innerHTML = `
    <div class="space-y-4 fade-in">
      ${section("user-round", "로그인 정보", `
        <div class="flex items-center justify-between gap-3">
          <div><div class="text-xl font-bold"><span class="hl">${s.teacher || "-"}</span> 선생님</div>
            <div class="mt-1 text-xs font-medium text-ink-2">${isAdmin() ? "관리자 모드 켜짐" : "교사 모드"} · 이 기기에 저장됨</div></div>
          <button id="btn-logout" class="btn btn-sm">${icon("log-out", "w-3.5 h-3.5")}다른 이름으로</button>
        </div>`)}

      ${section("shield", "관리자 모드", isAdmin() ? `
        <div class="flex flex-wrap items-center gap-2">
          <span class="chip chip-pink">${icon("check", "w-3 h-3")}관리자 로그인됨</span>
          <a href="#/admin" class="btn btn-primary btn-sm">${icon("users", "w-3.5 h-3.5")}교사·학생 관리</a>
          <a href="#/board" class="btn btn-sm">${icon("layout-grid", "w-3.5 h-3.5")}현황·내보내기</a>
          <button id="btn-admin-off" class="btn btn-sm ml-auto">끄기</button>
        </div>` : `
        <form id="admin-form" class="flex gap-2">
          <input type="password" class="field py-2 text-sm" placeholder="관리자 비밀번호" autocomplete="current-password" required />
          <button class="btn btn-key shrink-0" type="submit">${icon("shield", "w-4 h-4")}켜기</button>
        </form>
        <p class="mt-2 text-xs font-medium text-ink-2">담임 배정, 학생 교실 이동, 출결 삭제·내보내기를 할 수 있습니다.</p>`)}

      ${section("monitor", "화면 테마", `
        <div class="seg w-full" id="theme-seg">
          ${[["system", "monitor", "시스템"], ["light", "sun", "라이트"], ["dark", "moon", "다크"]]
            .map(([v, ic, l]) => `<button class="flex-1" data-theme="${v}" aria-pressed="${s.theme === v}">${icon(ic, "w-4 h-4 mr-1")}${l}</button>`).join("")}
        </div>`)}

      ${section("bell", "감독 알림", `
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-sm font-bold">감독 시작 ${ALERT_BEFORE_MIN}분 전 알림</div>
            <div class="text-xs font-medium text-ink-2">앱이 열려 있을 때 팝업 + 진동으로 알립니다.</div>
          </div>
          <button class="toggle" role="switch" aria-checked="${s.alerts}" id="alerts-toggle"></button>
        </div>
        <div class="mt-3 flex items-center justify-between gap-3 border-t-2 border-line pt-3">
          <div>
            <div class="text-sm font-bold">브라우저 푸시 알림</div>
            <div class="text-xs font-medium text-ink-2">상태: ${permLabel}</div>
          </div>
          ${perm === "default" ? `<button id="btn-perm" class="btn btn-primary btn-sm">허용하기</button>` : ""}
        </div>
        <button id="btn-test" class="btn btn-key btn-sm mt-3">${icon("bell-ring", "w-3.5 h-3.5")}알림 테스트</button>
        ${isIOS() && !isStandalone() ? `<p class="mt-2 text-xs font-semibold text-red">iPhone은 홈 화면에 추가한 뒤 실행해야 푸시 알림이 동작합니다.</p>` : ""}`)}

      ${section("smartphone", "앱으로 설치", installBlock())}

      ${section("info", "정보", `
        <dl class="space-y-1.5 text-sm">
          <div class="flex justify-between"><dt class="text-ink-2">버전</dt><dd class="font-bold">${__APP_VERSION__}</dd></div>
          <div class="flex justify-between"><dt class="text-ink-2">자습 기간</dt><dd class="font-bold">${TERM.start.slice(5).replace("-", "/")} ~ ${TERM.end.slice(5).replace("-", "/")}</dd></div>
          <div class="flex justify-between"><dt class="text-ink-2">데이터 출처</dt><dd class="font-bold">수능 전 감독 시간.xlsx</dd></div>
        </dl>
        <div class="mt-3 flex flex-wrap gap-2">
          <a href="${sheetUrl()}" target="_blank" rel="noopener" class="btn btn-sm">${icon("file-spreadsheet", "w-3.5 h-3.5")}출결 시트</a>
          <button id="btn-reset" class="btn btn-sm text-red">${icon("trash-2", "w-3.5 h-3.5")}설정 초기화</button>
        </div>`)}
    </div>`;

  root.querySelector("#btn-logout").addEventListener("click", async () => { await logout(); location.hash = "#/login"; });
  root.querySelector("#admin-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = e.target.querySelector("input").value;
    try { await loginAdmin(pw); toast("관리자 모드가 켜졌습니다."); }
    catch (err) { toast(err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" ? "비밀번호가 올바르지 않습니다." : `실패: ${err.message}`); }
  });
  root.querySelector("#btn-admin-off")?.addEventListener("click", async () => { await logoutAdmin(); toast("관리자 모드를 껐습니다."); });
  root.querySelector("#theme-seg").addEventListener("click", (e) => {
    const b = e.target.closest("[data-theme]"); if (!b) return;
    store.set({ theme: b.dataset.theme });
  });
  root.querySelector("#alerts-toggle").addEventListener("click", (e) => {
    const on = e.currentTarget.getAttribute("aria-checked") !== "true";
    e.currentTarget.setAttribute("aria-checked", on);
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
    modal({ iconName: "trash-2", tone: "warn", title: "설정을 초기화할까요?", body: "선택한 선생님·테마·알림 설정이 지워집니다.", confirmText: "초기화",
      onConfirm: async () => { await logout(); store.set({ theme: "system", alerts: true }); toast("초기화되었습니다."); location.hash = "#/login"; } });
  });
  refreshIcons(root);
}

function section(ic, title, body) {
  return `
    <section class="card">
      <div class="lhead">${icon(ic)}${title}</div>
      <div class="p-4 sm:p-5">${body}</div>
    </section>`;
}

function installBlock() {
  if (isStandalone()) return `<div class="flex items-center gap-2 text-sm font-bold">${icon("circle-check", "w-5 h-5")}앱으로 실행 중입니다</div>`;
  if (window.__installPrompt) return `
    <p class="mb-3 text-sm font-medium text-ink-2">홈 화면에 설치하면 앱처럼 바로 열리고, 오프라인에서도 시간표를 볼 수 있습니다.</p>
    <button id="btn-install" class="btn btn-primary">${icon("download")}홈 화면에 설치</button>`;
  const steps = isIOS()
    ? [["share", "Safari 하단 <b>공유</b> 버튼 탭"], ["square-plus", "<b>홈 화면에 추가</b> 선택"], ["check", "오른쪽 위 <b>추가</b>"]]
    : [["smartphone", "Chrome 메뉴(⋮) 열기"], ["square-plus", "<b>홈 화면에 추가</b> 또는 <b>앱 설치</b>"], ["check", "<b>설치</b> 확인"]];
  return `
    <ol class="space-y-2 text-sm">
      ${steps.map(([ic, t], i) => `<li class="flex items-center gap-3"><span class="block mini-${i + 1} flex h-7 w-7 shrink-0 items-center justify-center">${icon(ic, "w-4 h-4")}</span><span>${t}</span></li>`).join("")}
    </ol>`;
}
