import "./styles.css";
import { registerSW } from "virtual:pwa-register";
import { store, applyTheme } from "./lib/store.js";
import { route, render, rerender, setGuard } from "./lib/router.js";
import { ensureAuth, isLoggedIn, isAdmin } from "./lib/auth.js";
import { mountShell } from "./ui/shell.js";
import { refreshIcons } from "./ui/icons.js";
import { toast } from "./ui/feedback.js";
import { startAlerts } from "./lib/alerts.js";
import { startSwaps, onSwapsChange } from "./lib/swaps.js";
import { loginView } from "./views/login.js";
import { todayView } from "./views/today.js";
import { timetableView } from "./views/timetable.js";
import { attendanceView } from "./views/attendance.js";
import { sessionView } from "./views/session.js";
import { boardView } from "./views/board.js";
import { adminView } from "./views/admin.js";
import { settingsView } from "./views/settings.js";

applyTheme();
const { main } = mountShell(document.getElementById("app"));

route("login", loginView);
route("today", todayView);
route("timetable", timetableView);
route("attendance", attendanceView);
route("session", sessionView);
route("board", boardView);
route("admin", adminView);
route("settings", settingsView);

// 로그인 전에는 시간표만 열람 가능, 나머지는 로그인 화면
setGuard((path) => {
  if (!isLoggedIn() && !["login", "timetable"].includes(path)) return loginView;
  if (path === "admin" && !isAdmin()) return settingsView;
  return null;
});

const draw = () => { render(main); refreshIcons(main); document.body.classList.toggle("is-admin", isAdmin()); };
window.addEventListener("hashchange", draw);
store.subscribe((_, patch) => {
  if ("theme" in patch) applyTheme();
  if ("teacher" in patch || "theme" in patch || "role" in patch) { rerender(main); refreshIcons(main); document.body.classList.toggle("is-admin", isAdmin()); }
});
draw();
if (isLoggedIn()) ensureAuth().then(startSwaps);
store.subscribe((_, patch) => { if ("teacher" in patch && patch.teacher) ensureAuth().then(startSwaps); });
onSwapsChange(() => { rerender(main); refreshIcons(main); }); // 교체가 바뀌면 현재 화면 갱신
startAlerts();

// 설치 프롬프트 (Android/데스크톱 Chrome)
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__installPrompt = e;
  if (location.hash.includes("settings")) draw();
});

// 서비스워커: 새 버전이 있으면 안내
const updateSW = registerSW({
  onNeedRefresh() { toast("새 버전이 있습니다.", { duration: 10000, action: () => updateSW(true), actionLabel: "업데이트" }); },
  onOfflineReady() { toast("오프라인에서도 사용할 수 있어요."); },
});
