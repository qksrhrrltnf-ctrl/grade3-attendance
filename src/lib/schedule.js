// 시간표 조회·현재 상태 계산 (순수 함수)
import { REGULAR, SPECIAL_DAYS } from "../data/timetable.js";
import { PERIODS, CLASSES, DAY_KEYS, DAY_LABELS, TERM, SUNEUNG_DATE, ALERT_BEFORE_MIN } from "../data/config.js";

const pad = (n) => String(n).padStart(2, "0");
export const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
export const fmtISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const nowMin = (d = new Date()) => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
export const parseISO = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };

const KO_DAYS = ["일", "월", "화", "수", "목", "금", "토"];
export const fmtKoDate = (d) => `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())} (${KO_DAYS[d.getDay()]})`;
export const fmtShortDate = (d) => `${d.getMonth() + 1}/${d.getDate()}(${KO_DAYS[d.getDay()]})`;

/* ── 교체(대강) 덮어쓰기: key `${iso}_${room}_${periodNo}` → { teacher, original, swapId } ── */
let overrides = {};
export function setOverrides(map) { overrides = map || {}; }
export function getOverride(iso, room, periodNo) { return overrides[`${iso}_${room}_${periodNo}`] ?? null; }
export function overridesOn(iso) { return Object.entries(overrides).filter(([k]) => k.startsWith(`${iso}_`)).map(([, v]) => v); }

/** 날짜의 원본 배정에 그날의 교체를 적용한 사본 */
function withOverrides(assignments, iso) {
  if (!assignments) return assignments;
  const todays = Object.entries(overrides).filter(([k]) => k.startsWith(`${iso}_`));
  if (!todays.length) return assignments;
  const out = Object.fromEntries(Object.entries(assignments).map(([k, v]) => [k, { ...v }]));
  for (const [key, o] of todays) {
    const [, room, periodNo] = key.split("_");
    for (const p of PERIODS) if (String(p.no) === periodNo && out[p.key]) out[p.key][room] = o.teacher;
  }
  return out;
}

/** 특정 날짜의 시간표 정보(교체 반영). 주말·기간 외는 assignments = null */
export function getDayInfo(date = new Date()) {
  const iso = fmtISO(date);
  const special = SPECIAL_DAYS[iso];
  if (special) return { iso, key: iso, label: special.label, special: true, assignments: withOverrides(special.periods, iso), base: special.periods, inTerm: true };
  const key = DAY_KEYS[date.getDay()];
  const inTerm = iso >= TERM.start && iso <= TERM.end;
  if (!key) return { iso, key: null, label: "주말", special: false, assignments: null, inTerm };
  const base = inTerm ? REGULAR[key] : null;
  return { iso, key, label: `${DAY_LABELS[key]}요일`, special: false, assignments: withOverrides(base, iso), base, inTerm, dayKey: key };
}

/** 교체 적용 전 원본 배정 교사 */
export function originalTeacher(info, room, periodNo) {
  const p = PERIODS.find((x) => String(x.no) === String(periodNo));
  return p && info.base ? info.base[p.key]?.[room] ?? null : null;
}

/** 시간표 화면용: "mon".."fri" 또는 특별일 ISO 키로 조회 */
export function dayInfoByKey(key) {
  if (SPECIAL_DAYS[key]) return { iso: key, key, label: SPECIAL_DAYS[key].label, special: true, assignments: SPECIAL_DAYS[key].periods };
  return { iso: null, key, label: `${DAY_LABELS[key]}요일`, special: false, assignments: REGULAR[key], dayKey: key };
}

export const specialDayKeys = () => Object.keys(SPECIAL_DAYS);
export const specialDayLabel = (key) => SPECIAL_DAYS[key]?.label ?? key;

/** 해당 날짜에 존재하는 교시 목록 (PERIODS 순서) */
export function periodsOf(assignments) {
  if (!assignments) return [];
  return PERIODS.filter((p) => assignments[p.key]);
}

/** 그 날의 최대 교시 번호 */
export function maxPeriodNo(assignments) {
  return periodsOf(assignments).reduce((m, p) => Math.max(m, p.no), 0);
}

/** 교사의 감독 슬롯 [{period, cls}] — 4a/4b가 같은 반이면 하나로 병합 */
export function teacherSlots(assignments, teacher) {
  if (!assignments || !teacher) return [];
  const raw = [];
  for (const p of periodsOf(assignments)) {
    for (const cls of CLASSES) {
      if (assignments[p.key][cls] === teacher) raw.push({ period: p, cls });
    }
  }
  return mergeSplit(raw);
}

/** 4a·4b 같은 반 → "4교시 11:35~12:10, 13:10~13:30" 로 병합 */
export function mergeSplit(slots) {
  const out = [];
  for (const s of slots) {
    const prev = out[out.length - 1];
    if (prev && prev.period.key === "4a" && s.period.key === "4b" && prev.cls === s.cls) {
      out[out.length - 1] = {
        cls: s.cls,
        period: { ...prev.period, key: "4", sub: undefined, end: s.period.end, segments: [prev.period, s.period] },
      };
    } else {
      out.push({ ...s, period: { ...s.period, segments: [s.period] } });
    }
  }
  return out;
}

export function timeLabel(period) {
  const segs = period.segments ?? [period];
  if (period.note) return period.note;
  return segs.map((s) => `${s.start}~${s.end}`).join(", ");
}

/** 슬롯별 상태와 현재/다음 슬롯 */
export function statusOf(slots, now = nowMin()) {
  let current = null, next = null;
  const list = slots.map((s) => {
    const segs = s.period.segments ?? [s.period];
    const start = toMin(segs[0].start), end = toMin(segs[segs.length - 1].end);
    let state;
    if (now >= end) state = "done";
    else if (now >= start) state = "now";
    else if (start - now <= ALERT_BEFORE_MIN) state = "soon";
    else state = "upcoming";
    const item = { ...s, state, startMin: start, endMin: end, minutesLeft: Math.ceil(end - now), minutesUntil: Math.ceil(start - now) };
    if (state === "now" && !current) current = item;
    if ((state === "soon" || state === "upcoming") && !next) next = item;
    return item;
  });
  return { list, current, next, done: list.filter((s) => s.state === "done").length };
}

/** 전체 교사 목록 (가나다순) */
export function allTeachers() {
  const set = new Set();
  const collect = (assign) => Object.values(assign).forEach((byClass) => Object.values(byClass).forEach((t) => t && t !== "-" && set.add(t.trim())));
  Object.values(REGULAR).forEach(collect);
  Object.values(SPECIAL_DAYS).forEach((s) => collect(s.periods));
  return [...set].sort((a, b) => a.localeCompare(b, "ko"));
}

/** from 이후(당일 제외) 교사의 다음 감독일 — 기간 내에서만 탐색 */
export function nextDutyDay(teacher, from = new Date(), maxDays = 40) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 1; i <= maxDays; i++) {
    d.setDate(d.getDate() + 1);
    if (fmtISO(d) > TERM.end) return null;
    const info = getDayInfo(d);
    const slots = teacherSlots(info.assignments, teacher);
    if (slots.length) return { date: new Date(d), info, slots };
  }
  return null;
}

export function dday(targetISO = SUNEUNG_DATE, from = new Date()) {
  const t = parseISO(targetISO);
  const f = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((t - f) / 86400000);
}

export const clsLabel = (cls) => cls.replace("3-", "3학년 ") + "반";
export const clsShort = (cls) => cls.replace("3-", "") + "반";
