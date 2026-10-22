// 앱 전역 설정 — 교시 시간, 반, 기간, 외부 링크

export const APP_NAME = "3학년 감독·출결";

// periodKey 순서가 곧 표시 순서. 4교시는 점심 전(4a)/후(4b)로 나뉨.
export const PERIODS = [
  { key: "1",  no: 1, label: "1교시", start: "08:40", end: "09:30" },
  { key: "2",  no: 2, label: "2교시", start: "09:30", end: "10:40", note: "09:30~10:00, 10:20~10:40" },
  { key: "3",  no: 3, label: "3교시", start: "10:40", end: "11:35" },
  { key: "4a", no: 4, label: "4교시", sub: "점심 전", start: "11:35", end: "12:10" },
  { key: "4b", no: 4, label: "4교시", sub: "점심 후", start: "13:10", end: "13:30" },
  { key: "5",  no: 5, label: "5교시", start: "13:30", end: "14:20" },
  { key: "6",  no: 6, label: "6교시", start: "14:40", end: "15:30" },
  { key: "7",  no: 7, label: "7교시", start: "15:40", end: "16:30" },
];

export const CLASSES = ["3-1", "3-2", "3-3", "3-4", "3-5", "3-6", "3-7", "3-8"];

// Date.getDay() → 요일 키
export const DAY_KEYS = { 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri" };
export const DAY_LABELS = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금" };
export const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri"];

// 자습 감독 운영 기간 (구글 시트 기준 10/19 ~ 11/17)
export const TERM = { start: "2026-10-19", end: "2026-11-17" };
export const SUNEUNG_DATE = "2026-11-19";

// 감독 시작 몇 분 전에 알릴지
export const ALERT_BEFORE_MIN = 5;

// 구글 시트 (출결 입력) — 학생 명단이 있으므로 ID는 소스에 넣지 않고 .env / GitHub Secret(VITE_SHEET_ID)로 주입
export const SHEET_ID = (typeof import.meta.env !== "undefined" && import.meta.env.VITE_SHEET_ID) || process?.env?.VITE_SHEET_ID || "";
// 탭(gid)은 재배정반 교실 기준
export const SHEET_TABS = {
  "3-1": 0,
  "3-2": 1802778790,
  "3-3": 346121728,
  "3-4": 811182117,
  "3-5": 1134373320,
  "3-6": 1826609897,
  "3-7": 162623653,
  "3-8": 2032873102,
};
export const SHEET_DASHBOARD_GID = 1985341183; // 담임 출결 종합 관리 탭

export function sheetUrl(cls) {
  if (!SHEET_ID) return "#";
  const gid = cls && SHEET_TABS[cls] !== undefined ? SHEET_TABS[cls] : 0;
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${gid}#gid=${gid}`;
}

// 전자기기 벌점 안내 대상 반
export const PENALTY_NOTICE = "3~6반 학생이 학습 외 용도로 전자기기 사용 시 벌점 7점";
