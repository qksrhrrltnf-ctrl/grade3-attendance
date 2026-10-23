// 관리자: 교사 명단·담임 배정, 학생 교실 이동, 세션 삭제
import { CLASSES } from "../data/config.js";
import { allTeachers, clsLabel, getDayInfo, periodsOf } from "../lib/schedule.js";
import { isConfigured } from "../lib/firebase.js";
import { getTeachers, setTeacher, deleteTeacher, getStudents, updateStudent, invalidateStudents } from "../lib/db.js";
import { isAdmin, ensureAuth } from "../lib/auth.js";
import { icon, refreshIcons } from "../ui/icons.js";
import { toast, modal } from "../ui/feedback.js";

export function adminView(root) {
  if (!isAdmin()) { location.hash = "#/settings"; return; }
  if (!isConfigured) { root.innerHTML = `<div class="block warn p-4 text-sm font-bold">DB 미연결</div>`; return; }
  let teachers = [], students = [], q = "";

  const load = async () => {
    try { await ensureAuth(); [teachers, students] = await Promise.all([getTeachers(), getStudents()]); draw(); }
    catch (e) { toast(e.message); }
  };
  load();

  function draw() {
    const missing = allTeachers().filter((n) => !teachers.some((t) => t.name === n));
    const hits = q ? students.filter((s) => s.name.includes(q) || s.sid.includes(q)).slice(0, 30) : [];
    const today = getDayInfo();
    const periods = [...new Set(periodsOf(today.assignments).map((p) => p.no))];
    root.innerHTML = `
      <div class="space-y-4 fade-in">
        <section class="card">
          <div class="lhead">${icon("clipboard-check")}다른 교실 출결 열기<span class="ml-auto text-xs font-semibold opacity-80">관리자 전용 · 대강·보강</span></div>
          <div class="p-4">
            ${periods.length ? `
            <div class="flex gap-2">
              <input id="o-date" type="date" class="field py-2 text-sm" value="${today.iso}" />
              <select id="o-room" class="field py-2 text-sm">${CLASSES.map((c) => `<option value="${c}">${c} 교실</option>`).join("")}</select>
              <select id="o-period" class="field py-2 text-sm">${periods.map((p) => `<option value="${p}">${p}교시</option>`).join("")}</select>
              <button id="o-go" class="btn btn-key shrink-0">열기</button>
            </div>` : `<p class="text-sm font-semibold">오늘은 자습 감독이 없는 날입니다. 현황 탭에서 날짜를 골라 셀을 눌러 여세요.</p>`}
          </div>
        </section>

        <section class="card">
          <div class="lhead">${icon("users")}교사 명단 · 담임 배정<span class="ml-auto text-xs font-semibold opacity-80">${teachers.length}명</span></div>
          ${missing.length ? `<div class="flex flex-wrap items-center gap-2 border-b-2 border-line p-3 text-xs font-semibold">
            시간표에는 있으나 명단에 없음: ${missing.map((n) => `<span class="chip">${n}</span>`).join("")}
            <button id="add-missing" class="btn btn-key btn-sm ml-auto">모두 추가</button></div>` : ""}
          <div class="divide-y divide-line/30">
            ${teachers.map((t) => `
              <div class="flex items-center gap-2 px-4 py-2 text-sm">
                <span class="font-bold">${t.name}</span>
                ${t.role === "admin" ? `<span class="chip chip-pink">관리자</span>` : ""}
                <select data-home="${t.name}" class="ml-auto rounded-[4px] border-2 border-line bg-paper px-2 py-1 text-xs font-semibold text-ink">
                  <option value="">담임 아님</option>${CLASSES.map((c) => `<option value="${c}" ${t.homeroom === c ? "selected" : ""}>${clsLabel(c)} 담임</option>`).join("")}
                </select>
                <button data-del="${t.name}" class="btn btn-sm text-red" title="삭제">${icon("trash-2", "w-3.5 h-3.5")}</button>
              </div>`).join("")}
          </div>
          <form id="add-teacher" class="flex gap-2 border-t-2 border-line p-3">
            <input class="field py-2 text-sm" placeholder="교사 이름 추가 (대강·신규)" required />
            <button class="btn btn-sm shrink-0" type="submit">${icon("square-plus", "w-4 h-4")}추가</button>
          </form>
        </section>

        <section class="card">
          <div class="lhead">${icon("search")}학생 검색 · 교실 이동<span class="ml-auto text-xs font-semibold opacity-80">${students.length}명</span></div>
          <div class="p-3">
            <input id="stu-q" class="field py-2 text-sm" placeholder="이름 또는 학번" value="${q}" />
          </div>
          ${hits.length ? `<div class="divide-y divide-line/30 border-t-2 border-line">
            ${hits.map((s) => `
              <div class="flex items-center gap-2 px-4 py-2 text-sm">
                <span class="font-bold">${s.name}</span><span class="text-xs text-muted">${s.sid} · 원적 ${s.origClass}</span>
                <select data-room="${s.sid}" class="ml-auto rounded-[4px] border-2 border-line bg-paper px-2 py-1 text-xs font-semibold text-ink">
                  ${CLASSES.map((c) => `<option value="${c}" ${s.room === c ? "selected" : ""}>${c} 교실</option>`).join("")}
                </select>
                <button data-active="${s.sid}" class="btn btn-sm ${s.active === false ? "btn-warn" : ""}">${s.active === false ? "제외됨" : "재학"}</button>
              </div>`).join("")}
          </div>` : ""}
        </section>
      </div>`;
    refreshIcons(root);
    bind();
  }

  function bind() {
    root.querySelector("#o-go")?.addEventListener("click", () => {
      const date = root.querySelector("#o-date").value, room = root.querySelector("#o-room").value, period = root.querySelector("#o-period").value;
      location.hash = `#/session?date=${date}&room=${room}&period=${period}`;
    });
    root.querySelector("#add-missing")?.addEventListener("click", async () => {
      const missing = allTeachers().filter((n) => !teachers.some((t) => t.name === n));
      await Promise.all(missing.map((n) => setTeacher(n, { role: "teacher" })));
      toast(`${missing.length}명 추가`); load();
    });
    root.querySelector("#add-teacher").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = e.target.querySelector("input").value.trim();
      if (!name) return;
      await setTeacher(name, { role: "teacher" }); toast(`${name} 추가됨`); load();
    });
    root.querySelectorAll("[data-home]").forEach((el) => el.addEventListener("change", async () => {
      await setTeacher(el.dataset.home, { homeroom: el.value || null }); toast("담임 배정 저장");
    }));
    root.querySelectorAll("[data-del]").forEach((el) => el.addEventListener("click", () => {
      modal({ iconName: "trash-2", tone: "warn", title: `${el.dataset.del} 선생님을 명단에서 뺄까요?`, body: "로그인이 막힙니다. 시간표에는 남아 있습니다.", confirmText: "삭제",
        onConfirm: async () => { await deleteTeacher(el.dataset.del); load(); } });
    }));
    const qi = root.querySelector("#stu-q");
    qi.addEventListener("input", () => { q = qi.value.trim(); draw(); root.querySelector("#stu-q").focus(); });
    root.querySelectorAll("[data-room]").forEach((el) => el.addEventListener("change", async () => {
      await updateStudent(el.dataset.room, { room: el.value }); invalidateStudents(); toast("교실 변경 저장"); load();
    }));
    root.querySelectorAll("[data-active]").forEach((el) => el.addEventListener("click", async () => {
      const s = students.find((x) => x.sid === el.dataset.active);
      await updateStudent(s.sid, { active: s.active === false }); invalidateStudents(); load();
    }));
  }
}
