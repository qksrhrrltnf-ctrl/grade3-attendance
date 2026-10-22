// 원본 "수능 전 감독 시간.html"의 TIMETABLE_DATA를 읽어 src/data/timetable.js 로 정규화합니다.
// 4교시가 점심 전/후로 나뉘는 날(월·금)은 "4a"/"4b"로 분리하고, 한 행으로 합쳐진 날은 두 키에 같은 교사를 넣습니다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(resolve(root, "수능 전 감독 시간.html"), "utf8");
const m = html.match(/const TIMETABLE_DATA = (\{[\s\S]*?\n\s{8}\});/);
if (!m) throw new Error("TIMETABLE_DATA 블록을 찾지 못했습니다.");
const raw = new Function(`return ${m[1]}`)();

const DAY_KEYS = { "월": "mon", "화": "tue", "수": "wed", "목": "thu", "금": "fri" };

function periodKey(slot) {
  const no = slot.period.replace("교시", "");
  if (no !== "4") return [no];
  const t = slot.time.replace(/\s/g, "");
  if (t.includes("11:35") && t.includes("13:10")) return ["4a", "4b"];
  if (t.startsWith("11:35")) return ["4a"];
  if (t.startsWith("13:10")) return ["4b"];
  throw new Error(`알 수 없는 4교시 시간: ${slot.time}`);
}

function normalizeDay(day) {
  const out = {};
  for (const slot of day.times) {
    for (const key of periodKey(slot)) {
      out[key] = { ...slot.classes };
    }
  }
  return out;
}

const regular = {};
const special = {};
for (const [label, day] of Object.entries(raw)) {
  if (DAY_KEYS[label]) regular[DAY_KEYS[label]] = normalizeDay(day);
  else if (label === "11/16(월)") special["2026-11-16"] = { label: "11/16(월) 특별", periods: normalizeDay(day) };
  else throw new Error(`알 수 없는 요일 키: ${label}`);
}

const body = `// 자동 생성 파일 — 수정하려면 원본 HTML 또는 scripts/extract-timetable.mjs 를 고친 뒤 \`npm run sync:timetable\`
// 구조: assignments[dayKey][periodKey][classKey] = 교사명
// periodKey: "1","2","3","4a"(11:35~12:10),"4b"(13:10~13:30),"5","6","7"

export const REGULAR = ${JSON.stringify(regular, null, 2)};

export const SPECIAL_DAYS = ${JSON.stringify(special, null, 2)};
`;

mkdirSync(resolve(root, "src/data"), { recursive: true });
writeFileSync(resolve(root, "src/data/timetable.js"), body, "utf8");
console.log("src/data/timetable.js 생성 완료", Object.keys(regular), Object.keys(special));
