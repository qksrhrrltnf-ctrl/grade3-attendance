// 교체(대강) 요청·수락 — swaps/{id}
//   { id, date, room, period, from, to(null=누구나), status: open|accepted|declined|cancelled, note, createdAt, acceptedBy, acceptedAt, byAdmin }
import { collection, doc, addDoc, updateDoc, onSnapshot, query, where, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db, isConfigured } from "./firebase.js";
import { setOverrides } from "./schedule.js";

export const swaps = { list: [] };
const listeners = new Set();
export function onSwapsChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

let started = false;
/** 앱 시작 시 1회: 열린/수락된 요청 실시간 구독 → 덮어쓰기 맵 갱신 */
export function startSwaps() {
  if (!isConfigured || started) return;
  started = true;
  const q = query(collection(db, "swaps"), where("status", "in", ["open", "accepted"]));
  onSnapshot(q, (snap) => {
    swaps.list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.date + a.period).localeCompare(b.date + b.period));
    const map = {};
    for (const s of swaps.list) if (s.status === "accepted" && s.acceptedBy) {
      map[`${s.date}_${s.room}_${s.period}`] = { teacher: s.acceptedBy, original: s.from, swapId: s.id };
    }
    setOverrides(map);
    listeners.forEach((fn) => fn(swaps.list));
  }, (e) => console.warn("swaps", e));
}

const guard = () => { if (!isConfigured) throw new Error("DB가 연결되지 않았습니다."); };

export async function requestSwap({ date, room, period, from, to = null, note = "" }) {
  guard();
  const dup = swaps.list.find((s) => s.date === date && s.room === room && String(s.period) === String(period) && s.status === "open");
  if (dup) throw new Error("이미 같은 교시에 요청이 있습니다.");
  return addDoc(collection(db, "swaps"), { date, room, period: String(period), from, to, note, status: "open", createdAt: serverTimestamp() });
}

export async function acceptSwap(id, me) {
  guard();
  const s = swaps.list.find((x) => x.id === id);
  if (!s || s.status !== "open") throw new Error("이미 처리된 요청입니다.");
  if (s.to && s.to !== me) throw new Error("다른 선생님께 지정된 요청입니다.");
  if (s.from === me) throw new Error("본인 요청은 수락할 수 없습니다.");
  await updateDoc(doc(db, "swaps", id), { status: "accepted", acceptedBy: me, acceptedAt: serverTimestamp() });
}

export async function declineSwap(id) { guard(); await updateDoc(doc(db, "swaps", id), { status: "declined" }); }
export async function cancelSwap(id) { guard(); await updateDoc(doc(db, "swaps", id), { status: "cancelled" }); }
export async function deleteSwap(id) { guard(); await deleteDoc(doc(db, "swaps", id)); }

/** 관리자: 요청 없이 바로 대강 지정 */
export async function assignSubstitute({ date, room, period, from, to, by }) {
  guard();
  const existing = swaps.list.find((s) => s.date === date && s.room === room && String(s.period) === String(period) && s.status === "accepted");
  if (existing) await updateDoc(doc(db, "swaps", existing.id), { status: "cancelled" });
  return addDoc(collection(db, "swaps"), {
    date, room, period: String(period), from, to, note: "관리자 지정", status: "accepted", acceptedBy: to, byAdmin: by,
    createdAt: serverTimestamp(), acceptedAt: serverTimestamp(),
  });
}

/** 나와 관련된 요청 분류 */
export function mySwaps(me, todayIso) {
  const live = swaps.list.filter((s) => s.date >= todayIso);
  return {
    incoming: live.filter((s) => s.status === "open" && s.to === me),
    open: live.filter((s) => s.status === "open" && !s.to && s.from !== me),
    mine: live.filter((s) => s.from === me && (s.status === "open" || s.status === "accepted")),
    taken: live.filter((s) => s.status === "accepted" && s.acceptedBy === me),
  };
}
