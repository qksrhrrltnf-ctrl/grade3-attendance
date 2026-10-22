import "./styles.css";
import { registerSW } from "virtual:pwa-register";
import { store, applyTheme } from "./lib/store.js";
import { route, render, rerender } from "./lib/router.js";
import { mountShell } from "./ui/shell.js";
import { refreshIcons } from "./ui/icons.js";
import { toast } from "./ui/feedback.js";
import { startAlerts } from "./lib/alerts.js";
import { todayView } from "./views/today.js";
import { timetableView } from "./views/timetable.js";
import { attendanceView } from "./views/attendance.js";
import { settingsView } from "./views/settings.js";

applyTheme();
const { main } = mountShell(document.getElementById("app"));

route("today", todayView);
route("timetable", timetableView);
route("attendance", attendanceView);
route("settings", settingsView);

const draw = () => { render(main); refreshIcons(main); };
window.addEventListener("hashchange", draw);
store.subscribe((_, patch) => {
  if ("theme" in patch) applyTheme();
  if ("teacher" in patch || "theme" in patch) { rerender(main); refreshIcons(main); }
});
draw();
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
