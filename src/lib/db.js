// Firestore 데이터 접근 계층
//   students/{sid}            { sid, name, origClass, number, room, active }
//   teachers/{name}           { name, role, homeroom }
//   sessions/{date_room_p}    { date, room, period, teacher, teachers[], status, records{sid:{s,note}}, updatedAt, updatedBy }
//   penalties/{auto}          { sid, room, date, period, points, reason, teacher, createdAt }
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, addDoc, serverTimestamp, orderBy,
} from "firebase/firestore";
import { db, isConfigured } from "./firebase.js";

const notConnected = () => new Error("DB가 연결되지 않았습니다. (.env 의 VITE_FIREBASE_* 설정 필요)");
const guard = () => { if (!isConfigured) throw notConnected(); };

export const sessionId = (date, room, period) => `${date}_${room}_${period}`;

/* ── 학생 ───────────────────────────────── */
let studentCache = null;
export async function getStudents() {
  guard();
  if (studentCache) return studentCache;
  const snap = await getDocs(collection(db, "students"));
  studentCache = snap.docs.map((d) => d.data()).sort((a, b) => a.sid.localeCompare(b.sid));
  return studentCache;
}
export const invalidateStudents = () => { studentCache = null; };
export async function studentsOfRoom(room) { return (await getStudents()).filter((s) => s.room === room && s.active !== false); }
export async function studentsOfClass(origClass) { return (await getStudents()).filter((s) => s.origClass === origClass); }
export async function updateStudent(sid, patch) { guard(); await updateDoc(doc(db, "students", sid), patch); invalidateStudents(); }

/* ── 교사 ───────────────────────────────── */
export async function getTeachers() {
  guard();
  const snap = await getDocs(collection(db, "teachers"));
  return snap.docs.map((d) => d.data()).sort((a, b) => a.name.localeCompare(b.name, "ko"));
}
export async function getTeacher(name) { guard(); const s = await getDoc(doc(db, "teachers", name)); return s.exists() ? s.data() : null; }
export async function setTeacher(name, data) { guard(); await setDoc(doc(db, "teachers", name), { name, ...data }, { merge: true }); }
export async function deleteTeacher(name) { guard(); await deleteDoc(doc(db, "teachers", name)); }

/* ── 세션(교시별 출결) ───────────────────── */
export function subscribeSession(id, cb) {
  guard();
  return onSnapshot(doc(db, "sessions", id), (s) => cb(s.exists() ? s.data() : null), (e) => console.warn("session", e));
}
export async function getSession(id) { guard(); const s = await getDoc(doc(db, "sessions", id)); return s.exists() ? s.data() : null; }
export async function saveSession(id, data, by) {
  guard();
  await setDoc(doc(db, "sessions", id), { ...data, id, updatedAt: serverTimestamp(), updatedBy: by }, { merge: true });
}
export async function deleteSession(id) { guard(); await deleteDoc(doc(db, "sessions", id)); }

/** 특정 날짜의 모든 세션 실시간 구독 */
export function subscribeDaySessions(date, cb) {
  guard();
  const q = query(collection(db, "sessions"), where("date", "==", date));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data())), (e) => console.warn("day", e));
}
export async function getDaySessions(date) {
  guard();
  const snap = await getDocs(query(collection(db, "sessions"), where("date", "==", date)));
  return snap.docs.map((d) => d.data());
}
/** 기간 내 세션 (통계·내보내기) */
export async function getSessionsBetween(from, to) {
  guard();
  const snap = await getDocs(query(collection(db, "sessions"), where("date", ">=", from), where("date", "<=", to), orderBy("date")));
  return snap.docs.map((d) => d.data());
}

/* ── 벌점 ───────────────────────────────── */
export async function addPenalty(p) { guard(); return addDoc(collection(db, "penalties"), { ...p, createdAt: serverTimestamp() }); }
export async function getPenaltiesOf(sid) {
  guard();
  const snap = await getDocs(query(collection(db, "penalties"), where("sid", "==", sid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function getPenaltiesOn(date) {
  guard();
  const snap = await getDocs(query(collection(db, "penalties"), where("date", "==", date)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ── 출결 상태 정의 ──────────────────────── */
export const STATUS = {
  present: { label: "출석", short: "출", cls: "" },
  absent:  { label: "결석", short: "결", cls: "warn" },
  late:    { label: "지각", short: "지", cls: "key" },
  leave:   { label: "조퇴", short: "조", cls: "mini-3" },
  excused: { label: "사유", short: "사", cls: "mission" },
};
export const STATUS_CYCLE = ["present", "absent", "late", "leave"];
export const NOTE_PRESETS = ["생윤특강", "정독실", "보건실", "상담", "등교 지연"];

/** 세션 요약: 결석·지각·조퇴·사유 수 */
export function summarize(session) {
  const out = { absent: 0, late: 0, leave: 0, excused: 0 };
  Object.values(session?.records ?? {}).forEach((r) => { if (out[r.s] !== undefined) out[r.s]++; });
  return out;
}
