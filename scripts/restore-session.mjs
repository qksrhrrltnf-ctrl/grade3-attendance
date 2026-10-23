// 세션 하나를 seed/sessions.json 원본으로 되돌립니다 (시드에 없으면 삭제). 관리자 계정 사용.
//   node scripts/restore-session.mjs 2026-10-21_3-3_2
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, deleteDoc } from "firebase/firestore";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
if (existsSync(resolve(root, ".env"))) for (const l of readFileSync(resolve(root, ".env"), "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim(); }
const id = process.argv[2];
if (!id) throw new Error("세션 ID를 주세요. 예: 2026-10-21_3-3_2");

const app = initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY, projectId: env.VITE_FIREBASE_PROJECT_ID });
await signInWithEmailAndPassword(getAuth(app), env.VITE_ADMIN_EMAIL, env.ADMIN_PASSWORD);
const db = getFirestore(app);
const orig = JSON.parse(readFileSync(resolve(root, "seed/sessions.json"), "utf8")).find((s) => s.id === id);
if (orig) { await setDoc(doc(db, "sessions", id), orig); console.log("원복:", id, Object.keys(orig.records).length, "건"); }
else { await deleteDoc(doc(db, "sessions", id)); console.log("삭제(시드에 없음):", id); }
process.exit(0);
