// 관리자: 교사 명단·담임 배정, 학생 교실 이동, 세션 삭제
import { CLASSES } from "../data/config.js";
import { allTeachers, clsLabel, getDayInfo, periodsOf, originalTeacher } from "../lib/schedule.js";
import { swaps, assignSubstitute, cancelSwap } from "../lib/swaps.js";
import { store } from "../lib/store.js";
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
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <input id="o-date" type="date" class="field col-span-2 py-2 text-sm sm:col-span-1" value="${today.iso}" />
              <select id="o-room" class="field py-2 text-sm">${CLASSES.map((c) => `<option value="${c}">${c} 교실</option>`).join("")}</select>
              <select id="o-period" class="field py-2 text-sm">${periods.map((p) => `<option value="${p}">${p}교시</option>`).join("")}</select>
              <button id="o-go" class="btn btn-key col-span-2 sm:col-span-1">${icon("arrow-right", "w-4 h-4")}열기</button>
            </div>` : `<p class="text-sm font-semibold">오늘은 자습 감독이 없는 날입니다. 현황 탭에서 날짜를 골라 셀을 눌러 여세요.</p>`}
          </div>
        </section>

        <section class="card">
          <div class="lhead">${icon("arrow-left-right")}대강 지정<span class="ml-auto text-xs font-semibold opacity-80">요청 없이 바로 교체</span></div>
          <div class="p-4">
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <input id="s-date" type="date" class="field col-span-2 py-2 text-sm sm:col-span-1" value="${today.iso}" />
              <select id="s-room" class="field py-2 text-sm">${CLASSES.map((c) => `<option value="${c}">${c} 교실</option>`).join("")}</select>
              <select id="s-period" class="field py-2 text-sm">${[1, 2, 3, 4, 5, 6, 7].map((p) => `<option value="${p}">${p}교시</option>`).join("")}</select>
              <select id="s-to" class="field col-span-2 py-2 text-sm sm:col-span-1">${allTeachers().map((t) => `<option value="${t}">${t}</option>`).join("")}</select>
              <button id="s-go" class="btn btn-primary col-span-2 sm:col-span-1">${icon("check", "w-4 h-4")}지정</button>
            </div>
            <p class="mt-2 text-xs font-medium text-ink-2">그 교시의 입력 권한·오늘 화면·알림이 지정한 선생님께 넘어갑니다.</p>
          </div>
          ${swaps.list.length ? `
          <div class="border-t-2 border-line">
            <div class="px-4 pt-3 text-[11px] font-bold uppercase tracking-wider text-ink-2">진행 중·수락된 교체 ${swaps.list.length}</div>
            <div class="divide-y divide-line/30">
              ${swaps.list.map((s) => `
                <div class="flex items-center gap-2 px-4 py-2 text-sm">
                  <span class="font-bold">${s.date.slice(5).replace("-", "/")} ${s.period}교시 ${s.room}</span>
                  <span class="text-xs text-ink-2">${s.from} → ${s.status === "accepted" ? `<b>${s.acceptedBy}</b>` : s.to ?? "누구나"}</span>
                  <span class="chip ${s.status === "accepted" ? "chip-yellow" : "chip-muted"} ml-auto">${s.status === "accepted" ? "수락됨" : "대기"}</span>
                  <button data-swap-cancel="${s.id}" class="btn btn-sm px-2 text-red" title="취소">${icon("circle-x", "w-4 h-4")}</button>
                </div>`).join("")}
            </div>
          </div>` : ""}
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
    root.querySelector("#s-go")?.addEventListener("click", async () => {
      const date = root.querySelector("#s-date").value, room = root.querySelector("#s-room").value, period = root.querySelector("#s-period").value, to = root.querySelector("#s-to").value;
      const info = getDayInfo(new Date(date + "T00:00:00"));
      const from = originalTeacher(info, room, period);
      if (!from) return toast("그 날짜·교시·교실에는 배정이 없습니다.");
      if (from === to) return toast("원래 담당 선생님과 같습니다.");
      try { await assignSubstitute({ date, room, period, from, to, by: store.get().teacher }); toast(`${to} 선생님으로 대강 지정했습니다.`); setTimeout(draw, 400); }
      catch (e) { toast(e.message); }
    });
    root.querySelectorAll("[data-swap-cancel]").forEach((b) => b.addEventListener("click", async () => {
      try { await cancelSwap(b.dataset.swapCancel); toast("교체를 취소했습니다."); setTimeout(draw, 400); } catch (e) { toast(e.message); }
    }));
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
