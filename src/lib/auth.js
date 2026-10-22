// 로그인: 교사는 이름만 입력(익명 인증으로 DB 접근), 관리자는 이메일+비밀번호
import { signInAnonymously, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { auth, isConfigured, ADMIN_EMAIL } from "./firebase.js";
import { store } from "./store.js";
import { allTeachers } from "./schedule.js";
import { getTeachers } from "./db.js";

let authReady = null;

/** Firebase 사용자 세션 보장 (익명). 설정이 없으면 즉시 resolve */
export function ensureAuth() {
  if (!isConfigured) return Promise.resolve(null);
  if (authReady) return authReady;
  authReady = new Promise((resolve) => {
    const off = onAuthStateChanged(auth, async (user) => {
      off();
      if (user) return resolve(user);
      try { resolve((await signInAnonymously(auth)).user); } catch (e) { console.warn("익명 로그인 실패", e); resolve(null); }
    });
  });
  return authReady;
}

export const isLoggedIn = () => Boolean(store.get().teacher);
export const isAdmin = () => store.get().role === "admin";

/** 교사 명단에 있는 이름인지 확인 후 로그인 */
export async function loginByName(name) {
  name = name.trim();
  if (!name) throw new Error("이름을 입력해 주세요.");
  let known = allTeachers();
  try {
    const list = await getTeachers();
    if (list.length) known = list.map((t) => t.name);
  } catch { /* DB 미연결이면 시간표 명단으로 */ }
  if (!known.includes(name)) throw new Error("명단에 없는 이름입니다. 띄어쓰기 없이 성함을 정확히 입력해 주세요.");
  await ensureAuth();
  store.set({ teacher: name, role: store.get().role === "admin" ? "admin" : "teacher" });
  return name;
}

export async function loginAdmin(password) {
  if (!isConfigured) throw new Error("DB가 연결되지 않아 관리자 로그인을 할 수 없습니다.");
  await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
  store.set({ role: "admin" });
}

export async function logoutAdmin() {
  if (isConfigured && auth.currentUser && !auth.currentUser.isAnonymous) {
    await signOut(auth);
    authReady = null;
    await ensureAuth();
  }
  store.set({ role: "teacher" });
}

export async function logout() {
  if (isConfigured && auth.currentUser && !auth.currentUser.isAnonymous) { await signOut(auth); authReady = null; }
  store.set({ teacher: "", role: "teacher" });
}
