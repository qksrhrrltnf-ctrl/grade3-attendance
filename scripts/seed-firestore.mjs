// seed/ 의 학생·세션 + 시간표 교사 명단을 Firestore 에 업로드합니다. (관리자 계정으로 로그인해 클라이언트 SDK로 기록)
//   node scripts/seed-firestore.mjs                → 실제 프로젝트 (.env 의 VITE_FIREBASE_* + ADMIN_PASSWORD)
//   USE_EMULATOR=1 node scripts/seed-firestore.mjs → 로컬 에뮬레이터 (관리자 계정 자동 생성)
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, connectAuthEmulator } from "firebase/auth";
import { getFirestore, doc, writeBatch, connectFirestoreEmulator, getDocs, collection } from "firebase/firestore";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadDotEnv(resolve(root, ".env"));
const E = process.env;
const useEmu = E.USE_EMULATOR === "1";
const ADMIN_EMAIL = E.VITE_ADMIN_EMAIL || "admin@g3-attendance.app";
const ADMIN_PASSWORD = E.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) throw new Error(".env 에 ADMIN_PASSWORD 를 설정하세요.");

const app = initializeApp({
  apiKey: E.VITE_FIREBASE_API_KEY || "demo", authDomain: E.VITE_FIREBASE_AUTH_DOMAIN, projectId: E.VITE_FIREBASE_PROJECT_ID || "demo-g3",
  appId: E.VITE_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);
if (useEmu) { connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }); connectFirestoreEmulator(db, "127.0.0.1", 8080); }

// 관리자 로그인 (에뮬레이터면 없을 때 생성)
try { await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD); }
catch (e) {
  if (useEmu || e.code === "auth/user-not-found" || e.code === "auth/invalid-credential") {
    if (!useEmu && !E.CREATE_ADMIN) throw new Error(`관리자 로그인 실패(${e.code}). 최초 생성이면 CREATE_ADMIN=1 로 다시 실행하세요.`);
    await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log("관리자 계정 생성:", ADMIN_EMAIL);
  } else throw e;
}

const { REGULAR, SPECIAL_DAYS } = await import("../src/data/timetable.js");
const students = JSON.parse(readFileSync(resolve(root, "seed/students.json"), "utf8"));
const sessions = JSON.parse(readFileSync(resolve(root, "seed/sessions.json"), "utf8"));

// 교사 명단 = 시간표에 등장하는 이름 (이미 있으면 유지)
const existing = new Set((await getDocs(collection(db, "teachers"))).docs.map((d) => d.id));
const names = new Set();
const collect = (a) => Object.values(a).forEach((byRoom) => Object.values(byRoom).forEach((t) => t && names.add(t.trim())));
Object.values(REGULAR).forEach(collect); Object.values(SPECIAL_DAYS).forEach((s) => collect(s.periods));

let batch = writeBatch(db), n = 0;
const commit = async () => { if (n) { await batch.commit(); batch = writeBatch(db); n = 0; } };
const put = async (ref, data) => { batch.set(ref, data, { merge: true }); if (++n >= 400) await commit(); };

for (const name of names) if (!existing.has(name)) await put(doc(db, "teachers", name), { name, role: "teacher", homeroom: null });
for (const s of students) await put(doc(db, "students", s.sid), s);
for (const s of sessions) await put(doc(db, "sessions", s.id), s);
await put(doc(db, "timetable", "regular"), REGULAR);
await put(doc(db, "timetable", "special"), SPECIAL_DAYS);
await put(doc(db, "config", "app"), { adminEmail: ADMIN_EMAIL, seededAt: new Date().toISOString() });
await commit();

console.log(`업로드 완료: 교사 ${names.size}명, 학생 ${students.length}명, 세션 ${sessions.length}개`);
process.exit(0);

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
