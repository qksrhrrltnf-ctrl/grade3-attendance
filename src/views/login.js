// 로그인 화면: 이름 칩을 탭하거나 입력 → 입장. 관리자는 설정에서 비밀번호로 전환
import { allTeachers } from "../lib/schedule.js";
import { loginByName } from "../lib/auth.js";
import { isConfigured } from "../lib/firebase.js";
import { icon, refreshIcons } from "../ui/icons.js";
import { toast } from "../ui/feedback.js";
import { APP_NAME } from "../data/config.js";

const FILLS = ["mini-1", "mini-2", "mini-3"];

export function loginView(root) {
  const names = allTeachers();
  root.innerHTML = `
    <div class="mx-auto max-w-md space-y-4 fade-in">
      <section class="card">
        <div class="p-6 sm:p-8">
          <div class="block mission mb-5 flex h-14 w-14 items-center justify-center">${icon("clipboard-check", "w-7 h-7")}</div>
          <h2 class="text-2xl font-bold leading-snug">${APP_NAME}<br><span class="hl">선생님 성함</span>으로 입장</h2>
          <p class="mt-2 text-sm font-medium text-ink-2">아래에서 이름을 탭하거나 직접 입력하세요. 이 기기에 저장되어 다음부터 바로 열립니다.</p>
          <form id="login-form" class="mt-5 space-y-3" autocomplete="off">
            <div class="relative">
              <input id="login-name" class="field pr-10 text-lg" placeholder="이름 검색 (예: 우수연)" inputmode="text" enterkeyhint="go" required />
              ${icon("search", "pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2")}
            </div>
            <div id="name-chips" class="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto py-0.5" role="listbox" aria-label="선생님 목록"></div>
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
  const chips = root.querySelector("#name-chips");

  const renderChips = () => {
    const q = input.value.trim();
    const list = names.filter((n) => !q || n.includes(q));
    chips.innerHTML = list.length
      ? list.map((n, i) => `<button type="button" data-name="${n}" role="option" class="block ${FILLS[i % 3]} chip-tap px-3 py-1.5 text-sm font-bold">${n}</button>`).join("")
      : `<span class="text-xs font-semibold text-muted">일치하는 이름이 없습니다</span>`;
  };
  renderChips();
  input.addEventListener("input", renderChips);
  chips.addEventListener("click", (e) => {
    const b = e.target.closest("[data-name]"); if (!b) return;
    input.value = b.dataset.name;
    try { navigator.vibrate?.(10); } catch { /* ignore */ }
    form.requestSubmit();
  });
  setTimeout(() => input.focus({ preventScroll: true }), 50);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]"); btn.disabled = true;
    try {
      const name = await loginByName(input.value);
      toast(`${name} 선생님, 환영합니다.`);
      location.hash = "#/today";
    } catch (err) {
      toast(err.message); btn.disabled = false; input.select();
    }
  });
}
