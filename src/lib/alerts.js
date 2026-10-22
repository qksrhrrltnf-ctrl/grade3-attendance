// 감독 시작 N분 전 알림 (앱이 열려 있거나 백그라운드 탭일 때)
import { store } from "./store.js";
import { getDayInfo, teacherSlots, statusOf, clsLabel, timeLabel } from "./schedule.js";
import { modal } from "../ui/feedback.js";
import { ALERT_BEFORE_MIN } from "../data/config.js";

const FIRED_KEY = "g3att:fired";
let fired = new Set();
try { fired = new Set(JSON.parse(sessionStorage.getItem(FIRED_KEY) || "[]")); } catch { /* ignore */ }

export function startAlerts() {
  check();
  setInterval(check, 20_000);
  document.addEventListener("visibilitychange", () => !document.hidden && check());
}

function check() {
  const { teacher, alerts } = store.get();
  if (!teacher || !alerts) return;
  const info = getDayInfo();
  const { list } = statusOf(teacherSlots(info.assignments, teacher));
  for (const s of list) {
    if (s.state !== "soon") continue;
    const id = `${info.iso}:${s.period.key}:${s.cls}`;
    if (fired.has(id)) continue;
    fired.add(id);
    try { sessionStorage.setItem(FIRED_KEY, JSON.stringify([...fired])); } catch { /* ignore */ }
    notify(teacher, s);
  }
}

export function notify(teacher, s, { test = false } = {}) {
  const title = test ? "알림 테스트" : `자습 감독 ${Math.max(1, s.minutesUntil ?? ALERT_BEFORE_MIN)}분 전!`;
  const detail = `${s.period.label} (${timeLabel(s.period)}) · ${clsLabel(s.cls)}`;
  modal({
    iconName: "bell-ring", tone: "amber", title,
    body: `${teacher} 선생님, 잠시 후 자습 감독 시간이 시작됩니다. 감독 교실로 이동해 주세요.`,
    detail,
  });
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* ignore */ }
  pushNotification(title, detail);
}

async function pushNotification(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const opts = { body, tag: "duty-alert", icon: `${import.meta.env.BASE_URL}icons/icon-192.png`, badge: `${import.meta.env.BASE_URL}icons/icon-192.png` };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.showNotification) return reg.showNotification(title, opts); // Android Chrome 은 SW 경유만 허용
    new Notification(title, opts);
  } catch { /* 지원 안 함 */ }
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try { return await Notification.requestPermission(); } catch { return "denied"; }
}

export const notificationState = () => ("Notification" in window ? Notification.permission : "unsupported");
