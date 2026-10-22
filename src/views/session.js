// 교시별 출결 입력 화면: 학생 격자 탭 → 출석/결석/지각/조퇴, 길게 눌러 사유·벌점
import { store } from "../lib/store.js";
import { clsLabel, fmtShortDate, parseISO, getDayInfo } from "../lib/schedule.js";
import { PERIODS } from "../data/config.js";
import { isConfigured } from "../lib/firebase.js";
import {
  sessionId, subscribeSession, saveSession, studentsOfRoom, getDaySessions, addPenalty, STATUS, STATUS_CYCLE, NOTE_PRESETS, summarize,
} from "../lib/db.js";
import { isAdmin } from "../lib/auth.js";
import { icon, refreshIcons } from "../ui/icons.js";
import { toast, modal } from "../ui/feedback.js";

export function sessionView(root, params) {
  const { date, room, period } = params;
  if (!date || !room || !period) { location.hash = "#/attendance"; return; }
  const me = store.get().teacher;
  const id = sessionId(date, room, period);
  const pInfo = PERIODS.find((p) => String(p.no) === String(period) && !p.key.endsWith("b"));
  const dayInfo = getDayInfo(parseISO(date));
  const assigned = [...new Set(
    PERIODS.filter((p) => String(p.no) === String(period)).map((p) => dayInfo.assignments?.[p.key]?.[room]).filter(Boolean),
  )];

  let students = [];
  let session = null;          // DB 원본
  let records = {};            // 편집 중 상태 {sid:{s,note}}
  let prevAbsent = new Set();  // 직전 교시 결석자
  let dirty = false, saving = false, loaded = false;
  let unsub = null;

  root.innerHTML = `<div class="p-8 text-center text-sm font-semibold text-muted">불러오는 중…</div>`;

  if (!isConfigured) {
    root.innerHTML = `<div class="block warn p-4 text-sm font-bold">DB가 연결되지 않아 출결 입력을 사용할 수 없습니다.</div>`;
    return;
  }

  (async () => {
    try {
      students = await studentsOfRoom(room);
      const day = await getDaySessions(date);
      const prev = day.filter((s) => s.room === room && Number(s.period) < Number(period)).sort((a, b) => Number(b.period) - Number(a.period))[0];
      if (prev) prevAbsent = new Set(Object.entries(prev.records ?? {}).filter(([, r]) => r.s === "absent").map(([sid]) => sid));
      unsub = subscribeSession(id, (s) => {
        session = s;
        if (!dirty) records = structuredClone(s?.records ?? {});
        loaded = true;
        draw();
      });
    } catch (e) {
      root.innerHTML = `<div class="block warn p-4 text-sm font-bold">불러오기 실패: ${e.message}</div>`;
    }
  })();

  function draw() {
    const sum = summarize({ records });
    const label = pInfo ? pInfo.label : `${period}교시`;
    const time = PERIODS.filter((p) => String(p.no) === String(period)).map((p) => `${p.start}~${p.end}`).join(", ");
    const tiles = students.map((s) => {
      const r = records[s.sid];
      const st = r?.s ?? "present";
      const meta = STATUS[st];
      return `
        <button type="button" data-sid="${s.sid}" class="block ${meta.cls} relative flex min-h-[4.5rem] flex-col items-start justify-between p-2 text-left transition-colors select-none"
          aria-label="${s.name} ${meta.label}">
          <span class="flex w-full items-center justify-between text-[11px] font-semibold opacity-80"><span>${s.origClass.replace("3-", "")}반 ${s.number}번</span>${prevAbsent.has(s.sid) ? `<span class="rounded-[3px] bg-black px-1 text-[9px] text-white">전교시 결석</span>` : ""}</span>
          <span class="text-base font-bold leading-tight">${s.name}</span>
          <span class="text-[11px] font-bold">${st === "present" ? "" : meta.label}${r?.note ? ` · ${r.note}` : ""}</span>
        </button>`;
    }).join("");

    root.innerHTML = `
      <div class="space-y-3 fade-in pb-24">
        <div class="flex items-center gap-2">
          <a href="#/attendance" class="btn btn-sm">${icon("chevron-right", "w-4 h-4 rotate-180")}목록</a>
          <div class="lhead lhead-standalone flex-1 min-w-0">
            <span class="truncate">${clsLabel(room)} 교실 · ${label}</span>
            <span class="ml-auto shrink-0 text-xs font-semibold opacity-80">${fmtShortDate(parseISO(date))}</span>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span class="chip">${time}</span>
          <span class="chip">감독 ${assigned.length ? assigned.join("·") : "-"}</span>
          ${session ? `<span class="chip chip-yellow">${icon("check", "w-3 h-3")}입력됨${session.updatedBy ? ` · ${session.updatedBy}` : ""}</span>` : `<span class="chip chip-muted">미입력</span>`}
          ${session?.source === "sheet" ? `<span class="chip">시트에서 가져옴</span>` : ""}
          ${prevAbsent.size ? `<span class="chip chip-red">전 교시 결석 ${prevAbsent.size}명</span>` : ""}
        </div>

        <div class="flex flex-wrap gap-1.5 text-[11px] font-semibold">
          ${Object.entries(STATUS).map(([k, v]) => `<span class="block ${v.cls} px-2 py-0.5">${v.label}</span>`).join("")}
          <span class="text-muted self-center">· 탭하면 순서대로 바뀌고, 길게 누르면 사유·벌점</span>
        </div>

        ${students.length ? `<div class="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6" id="grid">${tiles}</div>`
          : `<div class="card"><div class="p-6 text-center text-sm font-semibold">이 교실의 학생 명단이 없습니다.</div></div>`}

        <div class="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 md:bottom-0 md:left-[15rem]">
          <div class="mx-auto flex max-w-5xl items-center gap-2 border-t-2 border-line bg-paper p-3">
            <button id="all-present" class="btn btn-sm">${icon("users", "w-4 h-4")}전원 출석</button>
            <div class="ml-auto flex items-center gap-1.5 text-xs font-bold">
              ${sum.absent ? `<span class="chip chip-red">결석 ${sum.absent}</span>` : ""}${sum.late ? `<span class="chip chip-yellow">지각 ${sum.late}</span>` : ""}${sum.leave ? `<span class="chip chip-gold">조퇴 ${sum.leave}</span>` : ""}${sum.excused ? `<span class="chip chip-pink">사유 ${sum.excused}</span>` : ""}
            </div>
            <button id="submit" class="btn btn-primary" ${saving ? "disabled" : ""}>${icon("check")}${session ? (dirty ? "수정 저장" : "저장됨") : "제출"}</button>
          </div>
        </div>
      </div>`;
    refreshIcons(root);
    bind();
  }

  function bind() {
    const grid = root.querySelector("#grid");
    if (grid) {
      let timer = null, longPressed = false;
      const start = (e) => {
        const b = e.target.closest("[data-sid]"); if (!b) return;
        longPressed = false;
        timer = setTimeout(() => { longPressed = true; openDetail(b.dataset.sid); }, 500);
      };
      const cancel = () => { clearTimeout(timer); timer = null; };
      grid.addEventListener("pointerdown", start);
      grid.addEventListener("pointerup", cancel);
      grid.addEventListener("pointerleave", cancel, true);
      grid.addEventListener("pointercancel", cancel);
      grid.addEventListener("contextmenu", (e) => e.preventDefault());
      grid.addEventListener("click", (e) => {
        const b = e.target.closest("[data-sid]"); if (!b || longPressed) return;
        cycle(b.dataset.sid);
      });
    }
    root.querySelector("#all-present")?.addEventListener("click", () => {
      records = {}; dirty = true; draw();
    });
    root.querySelector("#submit")?.addEventListener("click", submit);
  }

  function cycle(sid) {
    const cur = records[sid]?.s ?? "present";
    const idx = STATUS_CYCLE.indexOf(cur);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    if (next === "present") delete records[sid]; else records[sid] = { ...(records[sid] ?? {}), s: next };
    if (records[sid] && !records[sid].note) delete records[sid].note;
    dirty = true;
    try { navigator.vibrate?.(10); } catch { /* ignore */ }
    draw();
  }

  function openDetail(sid) {
    const s = students.find((x) => x.sid === sid);
    const r = records[sid] ?? {};
    const host = document.getElementById("modal-root");
    const wrap = document.createElement("div");
    wrap.className = "fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]";
    wrap.innerHTML = `
      <div role="dialog" class="card w-full max-w-md fade-in">
        <div class="lhead">${s.name} <span class="text-xs font-semibold opacity-80">${s.origClass.replace("3-", "")}반 ${s.number}번 · ${s.sid}</span><button data-x class="ml-auto">${icon("x", "w-5 h-5")}</button></div>
        <div class="p-4 space-y-4">
          <div>
            <div class="label">상태</div>
            <div class="grid grid-cols-5 gap-1.5">
              ${Object.entries(STATUS).map(([k, v]) => `<button data-st="${k}" class="block ${v.cls} py-2 text-sm font-bold ${(r.s ?? "present") === k ? "ring-4 ring-ink/30" : ""}">${v.label}</button>`).join("")}
            </div>
          </div>
          <div>
            <div class="label">사유 / 메모</div>
            <div class="mb-2 flex flex-wrap gap-1.5">${NOTE_PRESETS.map((n) => `<button data-note="${n}" class="chip">${n}</button>`).join("")}</div>
            <input data-note-input class="field text-sm" placeholder="예) 생윤특강, 1:57 등교" value="${r.note ?? ""}" />
          </div>
          <div class="flex items-center justify-between gap-2 border-t-2 border-line pt-3">
            <button data-penalty class="btn btn-warn btn-sm">${icon("triangle-alert", "w-4 h-4")}전자기기 벌점 7점</button>
            <button data-ok class="btn btn-primary btn-sm">적용</button>
          </div>
        </div>
      </div>`;
    const close = () => wrap.remove();
    const noteInput = wrap.querySelector("[data-note-input]");
    let st = r.s ?? "present";
    wrap.querySelector("[data-x]").addEventListener("click", close);
    wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
    wrap.querySelectorAll("[data-st]").forEach((b) => b.addEventListener("click", () => {
      st = b.dataset.st;
      wrap.querySelectorAll("[data-st]").forEach((x) => x.classList.toggle("ring-4", x === b));
      wrap.querySelectorAll("[data-st]").forEach((x) => x.classList.toggle("ring-ink/30", x === b));
    }));
    wrap.querySelectorAll("[data-note]").forEach((b) => b.addEventListener("click", () => { noteInput.value = b.dataset.note; if (st === "present") { st = "excused"; wrap.querySelector('[data-st="excused"]').click(); } }));
    wrap.querySelector("[data-ok]").addEventListener("click", () => {
      const note = noteInput.value.trim();
      if (st === "present" && !note) delete records[sid];
      else records[sid] = note ? { s: st === "present" ? "excused" : st, note } : { s: st };
      dirty = true; close(); draw();
    });
    wrap.querySelector("[data-penalty]").addEventListener("click", async () => {
      try {
        await addPenalty({ sid, name: s.name, origClass: s.origClass, room, date, period: String(period), points: 7, reason: "학습 외 전자기기 사용", teacher: me });
        toast(`${s.name} 벌점 7점이 기록되었습니다.`);
      } catch (e) { toast(`벌점 기록 실패: ${e.message}`); }
    });
    host.appendChild(wrap);
    refreshIcons(wrap);
  }

  async function submit() {
    if (saving) return;
    if (session && !dirty) return toast("변경 사항이 없습니다.");
    saving = true; draw();
    try {
      await saveSession(id, {
        date, room, period: String(period), teacher: me, teachers: assigned, status: "submitted", source: "app", records,
        submittedAt: session?.submittedAt ?? new Date().toISOString(),
      }, me);
      dirty = false;
      const sum = summarize({ records });
      toast(sum.absent ? `제출 완료 · 결석 ${sum.absent}명` : "제출 완료 · 전원 출석");
      try { navigator.vibrate?.([30, 40, 30]); } catch { /* ignore */ }
    } catch (e) {
      toast(`저장 실패: ${e.message}`);
    } finally { saving = false; draw(); }
  }

  return () => { unsub?.(); };
}
