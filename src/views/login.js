// 로그인 화면: 이름 입력 → 입장. 관리자는 설정에서 비밀번호로 전환
import { allTeachers } from "../lib/schedule.js";
import { loginByName } from "../lib/auth.js";
import { isConfigured } from "../lib/firebase.js";
import { icon, refreshIcons } from "../ui/icons.js";
import { toast } from "../ui/feedback.js";
import { APP_NAME } from "../data/config.js";

export function loginView(root) {
  const names = allTeachers();
  root.innerHTML = `
    <div class="mx-auto max-w-md space-y-4 fade-in">
      <section class="card">
        <div class="p-6 sm:p-8">
          <div class="block mission mb-5 flex h-14 w-14 items-center justify-center">${icon("clipboard-check", "w-7 h-7")}</div>
          <h2 class="text-2xl font-bold leading-snug">${APP_NAME}<br><span class="hl">선생님 성함</span>으로 입장</h2>
          <p class="mt-2 text-sm font-medium text-ink-2">띄어쓰기 없이 이름만 입력하세요. 이 기기에 저장되어 다음부터 바로 열립니다.</p>
          <form id="login-form" class="mt-5 space-y-3" autocomplete="off">
            <input id="login-name" class="field text-lg" list="teacher-names" placeholder="예) 우수연" inputmode="text" enterkeyhint="go" required />
            <datalist id="teacher-names">${names.map((n) => `<option value="${n}">`).join("")}</datalist>
            <button class="btn btn-primary w-full text-base" type="submit">${icon("arrow-right")}입장하기</button>
          </form>
          ${isConfigured ? "" : `<p class="mt-3 text-xs font-semibold text-red">DB 미연결 — 시간표 조회만 가능합니다.</p>`}
        </div>
      </section>
      <p class="text-center text-xs font-medium text-muted">관리자 모드는 입장 후 <b>설정</b>에서 비밀번호로 켤 수 있습니다.</p>
    </div>`;
  refreshIcons(root);
  const form = root.querySelector("#login-form");
  const input = root.querySelector("#login-name");
  setTimeout(() => input.focus(), 50);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button"); btn.disabled = true;
    try {
      const name = await loginByName(input.value);
      toast(`${name} 선생님, 환영합니다.`);
      location.hash = "#/today";
    } catch (err) {
      toast(err.message); btn.disabled = false; input.select();
    }
  });
}
