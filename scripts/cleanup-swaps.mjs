// 메모가 특정 값인 교체 요청을 삭제합니다 (테스트 정리용). 관리자 계정 사용.
//   node scripts/cleanup-swaps.mjs e2e
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs, query, where, deleteDoc } from "firebase/firestore";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
if (existsSync(resolve(root, ".env"))) for (const l of readFileSync(resolve(root, ".env"), "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim(); }
const note = process.argv[2];
if (!note) throw new Error("삭제할 메모 값을 주세요. 예: e2e");
const app = initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY, projectId: env.VITE_FIREBASE_PROJECT_ID });
await signInWithEmailAndPassword(getAuth(app), env.VITE_ADMIN_EMAIL, env.ADMIN_PASSWORD);
const snap = await getDocs(query(collection(getFirestore(app), "swaps"), where("note", "==", note)));
for (const d of snap.docs) await deleteDoc(d.ref);
console.log(`삭제 ${snap.size}건 (note=${note})`);
process.exit(0);
