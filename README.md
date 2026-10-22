# 3학년 감독·출결 (PWA)

수능 전 3학년 자습 감독 일정 확인과 출결 입력을 위한 모바일 우선 웹앱입니다.
홈 화면에 설치하면 앱처럼 실행되고, 오프라인에서도 시간표를 볼 수 있습니다.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ 생성
npm run preview    # 빌드 결과 미리보기
```

## 구조

```
index.html                 앱 셸 진입점 (PWA 메타, 테마 초기화)
src/main.js                라우팅·스토어·알림·서비스워커 등록
src/data/config.js         교시 시간, 반, 운영 기간, 구글 시트 탭(gid) 매핑
src/data/timetable.js      시간표 데이터 (자동 생성 — 아래 참고)
src/lib/schedule.js        시간표 조회·현재 교시·다음 감독 계산 (순수 함수)
src/lib/store.js           기기 로컬 설정 (교사, 테마, 알림)
src/lib/alerts.js          감독 시작 5분 전 알림
src/ui/                    셸(헤더·탭바), 아이콘, 토스트/모달, 공용 조각
src/views/                 오늘 · 시간표 · 출결 · 설정 화면
scripts/extract-timetable.mjs  원본 HTML의 시간표 → src/data/timetable.js 변환
scripts/make-icons.mjs     앱 아이콘 PNG/SVG 생성
.github/workflows/deploy.yml   main 브랜치 push 시 GitHub Pages 자동 배포
```

## 시간표 수정

현재(P0)는 `수능 전 감독 시간.html`의 `TIMETABLE_DATA`가 원본입니다. 수정 후:

```bash
npm run sync:timetable
```

4교시는 점심 전(`4a`, 11:35~12:10)·후(`4b`, 13:10~13:30)로 나뉘어 저장됩니다.
특별일(11/16)은 `SPECIAL_DAYS`에 날짜(ISO) 키로 들어갑니다.

## 배포

GitHub 저장소의 **Settings → Pages → Source**를 *GitHub Actions*로 설정하면
`main`에 push할 때마다 자동 배포됩니다. 주소: `https://<계정>.github.io/<저장소>/`

## 로드맵

| 단계 | 내용 |
|---|---|
| P0 ✅ | PWA, 모바일 레이아웃, 오늘/시간표/출결(시트 연결)/설정, 5분 전 알림 |
| P1 | Firebase 연동 — 이름+PIN 로그인, 시간표·교사·학생 명단 Firestore 이관 |
| P2 | 앱 내 출결 체크(학생 격자), 이전 교시 결석 표시, 벌점, 구글 시트 자동 동기화, 담임 대시보드 |
| P3 | 관리자 시간표 편집·대강 교체, 통계·Excel 내보내기, .ics 캘린더 구독 |
| P4 | FCM 푸시, App Check, 마감 점검 |
