// 출결 화면 (P0: 오늘 내 감독 반의 구글 시트 탭으로 바로 이동. P2에서 앱 내 출결 입력으로 교체)
import { store } from "../lib/store.js";
import { getDayInfo, teacherSlots, statusOf, clsLabel, timeLabel, fmtShortDate } from "../lib/schedule.js";
import { SHEET_ID, SHEET_DASHBOARD_GID, sheetUrl } from "../data/config.js";
import { icon, refreshIcons } from "../ui/icons.js";
import { teacherPrompt, bindTeacherSelect, emptyState, STATE_CHIP, periodBox } from "../ui/parts.js";

export function attendanceView(root) {
  const { teacher } = store.get();
  root.innerHTML = teacher ? page(teacher) : teacherPrompt();
  bindTeacherSelect(root);
  refreshIcons(root);
}

function page(teacher) {
  const now = new Date();
  const info = getDayInfo(now);
  const st = statusOf(teacherSlots(info.assignments, teacher));
  const dashUrl = SHEET_ID ? `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${SHEET_DASHBOARD_GID}#gid=${SHEET_DASHBOARD_GID}` : "#";

  return `
    <div class="space-y-4 fade-in">
      <section class="card">
        <div class="lhead">${icon("clipboard-check")}오늘 출결 입력<span class="ml-auto text-xs font-semibold opacity-80">${fmtShortDate(now)}</span></div>
        ${st.list.length ? `
          <div class="divide-y-2 divide-line">
            ${st.list.map((s) => `
              <div class="flex items-center gap-3 p-4 ${s.state === "done" ? "opacity-55" : ""}">
                ${periodBox(s.period.no, "h-11 w-11")}
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-bold">${clsLabel(s.cls)}</span>${STATE_CHIP[s.state]}
                  </div>
                  <div class="mt-0.5 text-xs font-medium text-ink-2">${s.period.label} · ${timeLabel(s.period)}</div>
                </div>
                <a href="${sheetUrl(s.cls)}" target="_blank" rel="noopener" class="btn btn-sm shrink-0 ${s.state === "now" || s.state === "soon" ? "btn-primary" : ""}">
                  ${icon("file-spreadsheet", "w-4 h-4")}시트</a>
              </div>`).join("")}
          </div>`
          : emptyState("coffee", info.assignments ? "오늘은 배정된 감독이 없습니다" : "오늘은 자습 감독이 없는 날입니다")}
      </section>

      <section class="card">
        <div class="lhead">${icon("info")}시트 입력 방법</div>
        <div class="p-4 space-y-3">
          <ol class="space-y-2 text-sm">
            ${["감독 교실(재배정반) 탭에서 오늘 날짜·교시 열을 찾습니다.",
               "결석 학생 행에 <b>1</b>을 입력합니다. (지도교사 책상의 배치표 참고)",
               "특강·정독실 등 사유가 있으면 <b>생윤특강</b>, <b>정독실</b>처럼 적습니다. 전자기기 벌점은 <b>벌점 7점</b>."]
              .map((t, i) => `<li class="flex gap-3"><span class="block mini-${i + 1} flex h-6 w-6 shrink-0 items-center justify-center text-xs font-bold">${i + 1}</span><span>${t}</span></li>`).join("")}
          </ol>
          <div class="flex flex-wrap gap-2 pt-1">
            <a href="${sheetUrl()}" target="_blank" rel="noopener" class="btn btn-sm">${icon("external-link", "w-3.5 h-3.5")}전체 시트 열기</a>
            <a href="${dashUrl}" target="_blank" rel="noopener" class="btn btn-sm">${icon("users", "w-3.5 h-3.5")}담임 종합 현황</a>
          </div>
        </div>
      </section>

      <section class="block mission p-4 text-sm">
        <div class="flex items-center gap-2 font-bold">${icon("sparkles", "w-4 h-4")}곧 추가되는 기능</div>
        <ul class="mt-2 list-disc space-y-0.5 pl-5 text-xs font-medium">
          <li>앱 안에서 학생 명단을 탭해 출결 입력 → 시트에 자동 기록</li>
          <li>이전 교시 결석 학생 자동 표시, 벌점 원터치 기록</li>
          <li>담임용 실시간 반별 출결 현황 · 통계</li>
        </ul>
      </section>
    </div>`;
}
