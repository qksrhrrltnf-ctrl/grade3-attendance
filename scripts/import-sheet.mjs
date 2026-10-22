// 구글 시트(재배정반 탭 8개)를 CSV로 내려받아 Firestore 시드 JSON으로 변환합니다.
//   node scripts/import-sheet.mjs            → seed/students.json, seed/sessions.json, seed/report.txt
// .env 의 VITE_SHEET_ID 를 사용합니다. 시트는 "링크가 있는 모든 사용자 보기" 상태여야 합니다.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadDotEnv(resolve(root, ".env"));
const { SHEET_ID, SHEET_TABS, CLASSES } = await import("../src/data/config.js");
if (!SHEET_ID) throw new Error(".env 에 VITE_SHEET_ID 가 없습니다.");

const YEAR = 2026;
const outDir = resolve(root, "seed");
mkdirSync(outDir, { recursive: true });

const students = {};   // sid → {sid, name, origClass, number, room}
const sessions = {};   // id → session
const report = [];

for (const room of CLASSES) {
  const gid = SHEET_TABS[room];
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${room} 탭 다운로드 실패: ${res.status}`);
  const rows = parseCSV(await res.text());
  const r = parseRoom(room, rows);
  report.push(`${room}: 학생 ${r.students}명, 세션 ${r.sessions}개, 결석 ${r.absent}건, 사유 ${r.notes}건`);
}

writeFileSync(resolve(outDir, "students.json"), JSON.stringify(Object.values(students), null, 2));
writeFileSync(resolve(outDir, "sessions.json"), JSON.stringify(Object.values(sessions), null, 2));
writeFileSync(resolve(outDir, "report.txt"), report.join("\n") + "\n");
console.log(report.join("\n"));
console.log(`총 학생 ${Object.keys(students).length}명, 세션 ${Object.keys(sessions).length}개 → seed/`);

/** 한 탭(교실) 파싱 */
function parseRoom(room, rows) {
  const dateRow = rows[0], headRow = rows[1];
  // 날짜 블록: row0 에 "10/19(월)" 이 있는 열부터 다음 날짜 열 전까지
  const blocks = [];
  dateRow.forEach((v, i) => {
    const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\(/);
    if (m) blocks.push({ col: i, date: `${YEAR}-${pad(m[1])}-${pad(m[2])}` });
  });
  blocks.forEach((b, i) => { b.end = i + 1 < blocks.length ? blocks[i + 1].col : headRow.length; });

  // 각 블록 안의 열 → 교시 번호 + 감독 교사 ("4\n김정현\n최순영")
  const cols = [];
  for (const b of blocks) {
    for (let c = b.col; c < b.end; c++) {
      const h = (headRow[c] || "").trim();
      const m = h.match(/^(\d)\s*\n?([\s\S]*)$/);
      if (!m) continue;
      const teachers = m[2].split(/\n/).map((s) => s.replace(/\(.*?\)/g, "").trim()).filter(Boolean);
      cols.push({ col: c, date: b.date, period: m[1], teachers });
    }
  }

  let nStudents = 0, nAbsent = 0, nNotes = 0;
  const touched = new Set();
  for (const row of rows.slice(2)) {
    const sid = (row[1] || "").trim();
    if (!/^\d{5}$/.test(sid)) continue;
    const name = (row[2] || "").trim();
    students[sid] = { sid, name, origClass: `3-${parseInt(sid.slice(1, 3), 10)}`, number: parseInt(sid.slice(3, 5), 10), room, active: true };
    nStudents++;
    for (const c of cols) {
      const v = (row[c.col] || "").trim();
      if (!v) continue;
      const id = `${c.date}_${room}_${c.period}`;
      const s = sessions[id] ??= {
        id, date: c.date, room, period: c.period, teacher: c.teachers[0] || "", teachers: c.teachers,
        status: "submitted", source: "sheet", records: {},
      };
      if (v === "1") { s.records[sid] = { s: "absent" }; nAbsent++; }
      else { s.records[sid] = { s: "excused", note: v }; nNotes++; }
      touched.add(id);
    }
  }
  return { students: nStudents, sessions: touched.size, absent: nAbsent, notes: nNotes };
}

function pad(n) { return String(n).padStart(2, "0"); }

/** RFC4180 CSV 파서 (따옴표 안 줄바꿈 지원) */
function parseCSV(text) {
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(field); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
