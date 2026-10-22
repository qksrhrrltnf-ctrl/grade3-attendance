// 현황: 날짜별 교실×교시 입력 현황, 원적 학급별 결석 학생, CSV 내보내기
import { store } from "../lib/store.js";
import { getDayInfo, fmtISO, fmtShortDate, parseISO, periodsOf, clsLabel } from "../lib/schedule.js";
import { CLASSES, TERM } from "../data/config.js";
import { isConfigured } from "../lib/firebase.js";
import { subscribeDaySessions, getStudents, getSessionsBetween, summarize, STATUS, getTeacher } from "../lib/db.js";
import { isAdmin } from "../lib/auth.js";
import { icon, refreshIcons } from "../ui/icons.js";
import { toast } from "../ui/feedback.js";

const ui = { date: null, mode: "rooms", cls: "3-1" };

export function boardView(root) {
  if (!isConfigured) { root.innerHTML = `<div class="block warn p-4 text-sm font-bold">DB가 연결되지 않아 현황을 볼 수 없습니다.</div>`; return; }
  ui.date ??= fmtISO(new Date());
  let sessions = [], students = [], unsub = null;

  getTeacher(store.get().teacher).then((t) => { if (t?.homeroom && !ui._homeApplied) { ui.cls = t.homeroom; ui._homeApplied = true; draw(); } }).catch(() => {});
  getStudents().then((s) => { students = s; draw(); }).catch((e) => toast(e.message));

  const subscribe = () => { unsub?.(); unsub = subscribeDaySessions(ui.date, (list) => { sessions = list; draw(); }); };
  subscribe();

  function draw() {
    const d = parseISO(ui.date);
    const info = getDayInfo(d);
    const periods = [...new Set(periodsOf(info.assignments).map((p) => p.no))];
    root.innerHTML = `
      <div class="space-y-4 fade-in">
        <div class="flex items-center justify-between gap-2">
          <div class="seg">
            <button data-d="-1">${icon("chevron-right", "w-4 h-4 rotate-180")}</button>
            <button data-d="0" class="min-w-[9rem]">${fmtShortDate(d)}${info.special ? " ★" : ""}</button>
            <button data-d="1">${icon("chevron-right", "w-4 h-4")}</button>
          </div>
          <div class="seg">
            <button data-mode="rooms" aria-pressed="${ui.mode === "rooms"}">교실별</button>
            <button data-mode="class" aria-pressed="${ui.mode === "class"}">담임(원적)</button>
          </div>
        </div>
        ${!info.assignments ? `<div class="card"><div class="p-6 text-center text-sm font-semibold">자습 감독이 없는 날입니다.</div></div>`
          : ui.mode === "rooms" ? rooms(periods) : byClass(periods)}
        ${isAdmin() ? exportBlock() : ""}
      </div>`;
    refreshIcons(root);
    bind();
  }

  function rooms(periods) {
    const find = (room, p) => sessions.find((s) => s.room === room && String(s.period) === String(p));
    const total = sessions.reduce((n, s) => n + summarize(s).absent, 0);
    const submitted = sessions.length, expected = CLASSES.length * periods.length;
    return `
      <section class="card">
        <div class="lhead">${icon("layout-grid")}교실 × 교시 입력 현황<span class="ml-auto text-xs font-semibold opacity-80">입력 ${submitted}/${expected} · 결석 연 ${total}명</span></div>
        <div class="overflow-x-auto">
          <table class="tbl w-full text-center text-sm">
            <thead><tr><th class="px-3 py-2 text-left">교실</th>${periods.map((p) => `<th class="px-2 py-2">${p}교시</th>`).join("")}<th class="px-2 py-2">결석</th></tr></thead>
            <tbody class="divide-y-2 divide-line">
              ${CLASSES.map((room) => {
                const rowAbs = periods.reduce((n, p) => n + (find(room, p) ? summarize(find(room, p)).absent : 0), 0);
                return `<tr>
                  <td class="px-3 py-1.5 text-left font-bold whitespace-nowrap">${clsLabel(room)}</td>
                  ${periods.map((p) => {
                    const s = find(room, p);
                    const a = s ? summarize(s).absent : null;
                    const cls = !s ? "text-muted" : a ? "warn" : "key";
                    return `<td class="p-1"><a href="#/session?date=${ui.date}&room=${room}&period=${p}" class="block ${s ? "block" : ""} ${cls} mx-auto flex h-9 w-11 items-center justify-center font-bold">${!s ? "–" : a || "✓"}</a></td>`;
                  }).join("")}
                  <td class="px-2 py-1.5 font-bold ${rowAbs ? "text-red" : ""}">${rowAbs}</td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
        <div class="flex flex-wrap gap-2 border-t-2 border-line p-3 text-[11px] font-semibold">
          <span class="block key px-2 py-0.5">✓ 전원 출석</span><span class="block warn px-2 py-0.5">N 결석 인원</span><span class="chip chip-muted">– 미입력</span><span class="text-muted self-center">셀을 누르면 열립니다</span>
        </div>
      </section>`;
  }

  function byClass(periods) {
    const list = students.filter((s) => s.origClass === ui.cls).sort((a, b) => a.number - b.number);
    const rowsHtml = list.map((s) => {
      const marks = periods.map((p) => {
        const sess = sessions.find((x) => x.room === s.room && String(x.period) === String(p));
        const r = sess?.records?.[s.sid];
        if (!sess) return `<td class="p-1 text-muted">–</td>`;
        if (!r) return `<td class="p-1 text-muted/60">·</td>`;
        return `<td class="p-1"><span class="block ${STATUS[r.s]?.cls ?? ""} mx-auto flex h-7 w-7 items-center justify-center text-[11px] font-bold" title="${r.note ?? ""}">${STATUS[r.s]?.short ?? "?"}</span></td>`;
      }).join("");
      const abs = periods.filter((p) => sessions.find((x) => x.room === s.room && String(x.period) === String(p))?.records?.[s.sid]?.s === "absent").length;
      const notes = periods.map((p) => sessions.find((x) => x.room === s.room && String(x.period) === String(p))?.records?.[s.sid]?.note).filter(Boolean);
      return `<tr class="${abs ? "bg-[color-mix(in_srgb,var(--red)_10%,var(--paper))]" : ""}">
        <td class="px-2 py-1.5 text-left whitespace-nowrap"><b>${s.number}</b> ${s.name} <span class="text-[11px] text-muted">${s.room}교실</span>${notes.length ? `<div class="text-[11px] text-ink-2">${[...new Set(notes)].join(", ")}</div>` : ""}</td>
        ${marks}<td class="px-2 font-bold ${abs ? "text-red" : ""}">${abs}</td></tr>`;
    }).join("");
    return `
      <section class="card">
        <div class="lhead">${icon("users")}원적 학급별 출결
          <select id="cls-sel" class="ml-auto rounded-[4px] border-2 border-line bg-paper px-2 py-1 text-xs font-bold text-ink">${CLASSES.map((c) => `<option value="${c}" ${c === ui.cls ? "selected" : ""}>${clsLabel(c)}</option>`).join("")}</select>
        </div>
        <div class="overflow-x-auto">
          <table class="tbl w-full text-center text-sm">
            <thead><tr><th class="px-2 py-2 text-left">학생</th>${periods.map((p) => `<th class="px-1 py-2">${p}</th>`).join("")}<th class="px-2 py-2">결석</th></tr></thead>
            <tbody class="divide-y divide-line/30">${rowsHtml || `<tr><td colspan="${periods.length + 2}" class="p-6 text-sm font-semibold">명단이 없습니다.</td></tr>`}</tbody>
          </table>
        </div>
        <div class="flex flex-wrap gap-1.5 border-t-2 border-line p-3 text-[11px] font-semibold">
          ${Object.values(STATUS).filter((v) => v.cls).map((v) => `<span class="block ${v.cls} px-2 py-0.5">${v.short} ${v.label}</span>`).join("")}<span class="chip chip-muted">– 미입력 교시</span>
        </div>
      </section>`;
  }

  function exportBlock() {
    return `
      <section class="card">
        <div class="lhead">${icon("download")}내보내기 (관리자)</div>
        <div class="flex flex-wrap items-end gap-2 p-4">
          <div><div class="label">시작</div><input id="ex-from" type="date" class="field py-2 text-sm" value="${TERM.start}" /></div>
          <div><div class="label">종료</div><input id="ex-to" type="date" class="field py-2 text-sm" value="${ui.date}" /></div>
          <button id="ex-go" class="btn btn-key">${icon("file-spreadsheet")}CSV 다운로드</button>
        </div>
      </section>`;
  }

  function bind() {
    root.querySelectorAll("[data-d]").forEach((b) => b.addEventListener("click", () => {
      const n = Number(b.dataset.d);
      if (n === 0) { ui.date = fmtISO(new Date()); } else { const d = parseISO(ui.date); d.setDate(d.getDate() + n); ui.date = fmtISO(d); }
      subscribe(); draw();
    }));
    root.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { ui.mode = b.dataset.mode; draw(); }));
    root.querySelector("#cls-sel")?.addEventListener("change", (e) => { ui.cls = e.target.value; draw(); });
    root.querySelector("#ex-go")?.addEventListener("click", async () => {
      const from = root.querySelector("#ex-from").value, to = root.querySelector("#ex-to").value;
      try {
        const list = await getSessionsBetween(from, to);
        const byId = Object.fromEntries(students.map((s) => [s.sid, s]));
        const rows = [["날짜", "교실", "교시", "감독", "학번", "이름", "원적", "상태", "사유"]];
        for (const s of list) for (const [sid, r] of Object.entries(s.records ?? {})) {
          const st = byId[sid];
          rows.push([s.date, s.room, s.period, s.teacher ?? "", sid, st?.name ?? "", st?.origClass ?? "", STATUS[r.s]?.label ?? r.s, r.note ?? ""]);
        }
        const csv = "﻿" + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        a.download = `출결_${from}_${to}.csv`; a.click(); URL.revokeObjectURL(a.href);
        toast(`${rows.length - 1}건 내보냈습니다.`);
      } catch (e) { toast(`내보내기 실패: ${e.message}`); }
    });
  }

  return () => unsub?.();
}
