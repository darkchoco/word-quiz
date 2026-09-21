# Session State — Word Quiz

## 1. 날짜 / 주제
- 저장일: 2026-09-22 (작업 진행: 2026-09-18 ~ 09-22)
- 주제: 문서 v1.8(PRD v1.4, TECH-SPEC v1.8, EXECUTION-PLAN v1.8). **M0~M7 완료·UI 컨펌 완료. M8(번들·패키징·배포) 진행 중: 커밋 3개 완료(HEAD `41afc79` + 이 파일 커밋), 남은 것은 종단 검증 `smoke:package`와 문서** (브랜치 `main`)

## 2. 완료한 작업
- [x] `docs/PRD.md` v1.2 확정 (결정 로그 D1~D36, 미결 사항 없음)
- [x] UI 목업 컨펌 완료. 로컬 파일 `docs/word-quiz-mockup.html`(앱 UI 영어, 컨트롤·설명 패널만 한국어)로 저장. Artifact 링크는 사용자가 못 열어서 로컬 파일이 기준
- [x] PRD 5장 와이어프레임을 목업 기준 영어 UI로 갱신, D33(UI 영어)·D34(목업 컨펌 사항) 추가
- [x] `docs/TECH-SPEC.md` v1.0 작성 (한글, 14개 장, 결정 T1~T12, DDL, API, CLI, 보안, 테스트, 스파이크 결과)
- [x] 스파이크 3종 검증 (WSL Node 24.14): 채점 178단어 194묶음 실패 0건 / `node:sqlite` 동작 / esbuild 번들 216KB가 `node_modules` 없이 실행
- [x] 문서 커밋 완료 (`git log --oneline`으로 확인): handoff, PRD v1.0~v1.2, 목업(한국어 → 영어 UI), 기술 스펙, 실행 계획
- [x] 메모리 저장: `feedback_docs_in_korean`, `project_word_quiz_workflow`
- [x] **실행 계획 문서** `docs/EXECUTION-PLAN.md` v1.0 작성·커밋 (M0~M9, 요구사항 추적표, Windows 검증 계획). 사용자 리뷰는 아직
- [x] Windows 검증 환경 확인: WSL에서 `/mnt/d/tools/nodejs/node.exe`(v24.14.0) 실행 가능, win32 `node:sqlite` 동작
- [x] WSL 개발 차이 4가지(.bat CRLF, DB 이름 대소문자, 실행 중 서버와 deploy 불일치, OS 간 DB 접근)를 TECH-SPEC 8.5·T13~T16, EXECUTION-PLAN에 반영 (커밋 여부는 `git log`로 확인)
- [x] `data/`는 **untracked 유지로 결정** (`.gitignore`에도 넣지 않음)
- [x] **M0 완료**: 도구 체인(TS 7.0.2, vitest 5.0.1, esbuild 0.28.2, @types/node 22.20.4, read-excel-file 9.3.10 정확 고정), `.gitattributes`(CRLF), `src/server/paths.ts`(`appHome`), 스모크 서버·CLI, `scripts/build.mjs`, `scripts/win-smoke.sh`. `npm run smoke:win` 20/20 통과 (Windows node.exe 24.14.0, `C:\WordQuiz-dev`)
- [x] **M1 완료**: `src/shared/{api,grading,scheduling,meanings}.ts`, 테스트 228개(api 3 / grading 173 / scheduling 17 / meanings 35), 픽스처 `test/fixtures/tricky-meanings.json`(실제 단어장 19행 발췌, 기대값은 손으로 작성). 결함 주입(mutation) 검증으로 테스트가 스파이크 결함을 실제로 잡는 것을 확인
- [x] **M2 완료**: `src/server/{errors.ts,db/{migrations,transaction,open,names,catalog,sessions,queries}.ts}`, 테스트 136개(전체 369개/13파일), `npm run smoke:win-db`(같은 검사를 Linux와 Windows node.exe에서 실행) 양쪽 통과. 결함 주입 20가지 모두 검출
- [x] **M3 완료**: `src/cli/{xlsx,validate,plan,report,apply,args,run,errors,index}.ts`, `release/import.bat`(CRLF), 테스트 154개 추가(전체 524개/21파일), `npm run smoke:import` Linux·Windows 63/63(실제 샘플 178단어). 결함 주입 20여 가지 검출
- [x] **M4 완료**: `src/server/{context,routes,app,middleware,hosts,options,lock,browser,network,start,index}.ts`, `services/{session,round,words,settings}.ts`, `db/{rounds,words}.ts`. 테스트 329개 추가(전체 853개/33파일), `npm run smoke:server` Linux·Windows 47/47, 결함 주입 26가지 중 25가지 즉시 검출. **PRD D38 신설**(pool이 비면 라운드 번호를 건너뜀, 교착 방지)
- [x] M4 커밋 완료(9개, 각각 격리 작업 트리에서 typecheck·테스트 통과 확인). HEAD = `6a7e9d7`
- [x] **M5 구현 완료 (미커밋, HEAD `6a7e9d7`)**: `src/client/`(theme, fonts, api, app-context(`classifyApiError`), hooks, components 11개, App, ErrorBoundary, main, index.html, dev/Gallery), `vite.config.ts`, `scripts/{dev.mjs,shots.sh}`, `build.mjs`(vite build 추가), `server-e2e.sh`(클라이언트 서빙 검사), `test/client/`(71개), `docs/ui-checks/`(스크린샷 14장). 전체 926개 통과, 결함 주입 14가지 모두 검출, `smoke:win` 24/24·`smoke:win-db`·`smoke:import` 63/63·`smoke:server` 51/51, 브라우저 콘솔 오류 0건, 390px 가로 스크롤 없음. 문서(TECH-SPEC 2.1·2.3·7.2·14.8, EXECUTION-PLAN M5 결과 + UI 컨펌 요청) 갱신 완료
- [x] M5 커밋 완료(8개 + dev 프록시 수정 2개), 브랜치를 `main`으로 바꿈. `npm run dev` 빈 화면 원인은 Vite 프록시 `/api`가 `/api.ts`를 가로챈 것(`/api/`로 수정, `test/vite-config.test.ts`). 사용자의 M5 UI 컨펌은 "오케이"로 받음
- [x] **M6 구현·커밋 완료 (커밋 5개 `0333459`~`ca18eee` + 세션 상태 커밋)**: `src/client/hooks/useQuiz.ts`(상태 기계), `components/{IdlePanel,QuestionPanel,FeedbackPanel,Done3Dialog,ResultPanel,EmptyPoolNotice,AllDoneNotice,QuizPage}.tsx`, 앱 컨텍스트에 `updateStats`·`retestRequested/requestRetest/clearRetest`, `Shell`의 quiz 탭 연결·본문 흰 바탕, 갤러리·`shots.sh` 확장, `test/client/{quiz-panels,quiz-page,quiz-data}`. 전체 969개 통과, 결함 주입 24가지 검출, `smoke:server` 51/51, 콘솔 오류 0건. **발견**: `lang="la"`가 EB Garamond에서 u→v로 그려짐 → `"locl" 0`. 문서(TECH-SPEC 7.2·14.9, EXECUTION-PLAN M6 결과) 갱신 완료
- [x] **M6 사용자 UI 컨펌 완료**(2026-09-21, "확인했고 괜찮아")
- [x] **UI 글꼴을 Noto Sans KR로 변경**(사용자 요청, 커밋 `219efc1`): `@fontsource/noto-sans-kr@5.3.0`(정확 고정), `fonts.ts`에 latin·korean 400/500, `theme.ts`의 `UI_FONT`. 단어·로고는 EB Garamond, 숫자·코드는 IBM Plex Mono 그대로. 한글 서브셋이 굵기당 약 530KB라 `dist`가 2.4MB → 5.1MB
- [x] **M7 구현·커밋 완료** (커밋 6개: `d9742e7` 오답 화면 / `ba6e938` 단어 관리 / `2ae3192` 설정 / `b86be32` 휴대폰 표 수정 / `1374319` 갤러리·스크린샷 / `24d98fd` 문서). `src/client/components/{WrongPage,WrongPanel,WordsPage,WordsPanel,SettingsPage,SettingsPanel,TableFrame,MeaningCell}.tsx`, `Placeholder.tsx` 삭제, `Shell`이 세 탭 연결(`Retest wrong only` → `requestRetest()` + `#/quiz`). 테스트 37개 추가(전체 **1006개/45파일**), 결함 주입 22가지 모두 검출, `smoke:server` 51/51, 콘솔 오류 0건. 서버·shared 변경 없음. 실제 서버로 확인: 뜻 수정 직후 새 뜻으로 Perfect, 재시작 후 뜻·문제 수 유지. 문서(TECH-SPEC 7.1·7.2·14.10, EXECUTION-PLAN 진행표·M7 결과) 갱신 완료
- [x] **M7 사용자 전체 UI 컨펌 완료**(2026-09-21, "UI 컨펌 오케이")
- [x] **M8 계획 승인**(plan mode, 사용자 승인). 계획서 원문은 `~/.claude/plans/calm-leaping-firefly.md`(저장소 밖이라 사라질 수 있음 — 요점은 아래와 5장에 있음)
- [x] **M8 커밋 3개 완료** (전부 typecheck·테스트 통과, 전체 **1063개/49파일**):
  - `52f0f3a feat: Add start.bat launcher`: `release/start.bat`(TECH-SPEC 8.2 + `%*` 전달, CRLF·BOM 없음), `test/release/start-bat.test.ts`(20개, 버전 검사 조각을 `vm`+가짜 `process`로 실행해 22.12.0 거부·22.13.0 통과 확인), `vitest.config.ts` include에 `test/release/**`. 결함 주입 8가지 검출
  - `eb69c98 feat: Add production build`: `scripts/lib/release.mjs`(`toCrlf`, `BATCH_FILES`·`BUNDLE_FILES`·`PROGRAM_FILES`), `build.mjs`가 `release/*.bat`을 CRLF·BOM 없음으로 **`dist/`에 기록**(소스가 LF+BOM이어도 결과 정상), `release-lib.test.ts`(11개). 결함 주입 5가지 검출
  - `41afc79 feat: Add package and deploy scripts`: `scripts/package.mjs`(→ `release/WordQuiz.zip`, 실제 3.68MB·27파일), `scripts/deploy.mjs`, `lib/release.mjs`에 `collectRelease`·`entryData`·`readLock`·`isInside`·`ReleaseError`, `package.json`의 `package`·`deploy` 스크립트, `test/release/{package,deploy}.test.ts`(26개), `test/support/release.ts`. 결함 주입 12가지 중 11가지 검출(1건은 죽은 코드라 삭제)
- [ ] **M8 남은 일**: ① `scripts/package-e2e.sh` + `npm run smoke:package`(5장 참고) ② 회귀 `smoke:server`·`smoke:win`·`smoke:win-db`·`smoke:import` ③ 문서 갱신 + `docs: Record M8 results` 커밋 ④ (사용자 확인 없이 끝나는 마일스톤이지만 결과를 보고)
- [ ] M9 미구현 (Windows 자동 검증 전 항목, 사용자 수동 체크리스트, 추적표 확정, `README.md`, 승인 후 실제 `C:\WordQuiz` 배포)

## 3. 결정과 이유 (상세는 PRD 8.1 D1~D36, TECH-SPEC 1장 T1~T12)
| 결정 | 이유 |
|------|------|
| 앱 UI 텍스트는 영어, 데이터(단어·뜻)는 원본 그대로 (D33) | 사용자 "사용언어는 영어". UI 언어를 뜻하는 것이었음 |
| **문서 본문은 한글**, 식별자·코드·API 경로만 영어 | 영어 계획서를 제출했다가 반려됨 |
| Windows Node 22.13 이상 → `node:sqlite` 사용 (T1) | 사용자 확인. 네이티브 모듈 없이 WSL 개발본이 그대로 Windows에서 동작 |
| 서버·CLI를 esbuild 단일 `.mjs`로 번들, `node_modules` 미배포 (T2) | PRD의 "한두 개 파일 압축" 요구 충족 |
| 채점은 서버, 규칙 코드는 `src/shared` (T4) | 채점·출제 규칙 반영을 한 트랜잭션으로 묶기 위해 |
| Perfect 3회 이상은 "No" 결과(N+3)를 제출 시 즉시 적용, "Yes"는 완료 표시 호출 (T7) | 서버가 확인창 상태를 기억할 필요 없음 |
| 뜻 구분자는 **괄호 밖 쉼표만** (D35) | 실제 데이터에 `der (die, das) zweite` 등 괄호 안 쉼표가 있음. 사용자 승인 |
| 채점 시 `? ! .` 무시 (D36) | `wie viel(e)?` 같은 뜻. 사용자 승인 |
| 정답 변형에 **괄호 원형**을 포함 (T10) | 화면 표기 그대로 입력해도 정답이어야 함 (스파이크에서 발견) |
| merge 전 `--apply` 시 DB 자동 백업 `data/backup/` (T12) | 앱에서 고친 뜻을 재 import가 덮어쓸 수 있음. 사용자 승인 |
| 상태 바 정답 수는 Perfect만 집계, 목업 제안 3개 유지 (D34) | "그 외에는 모두 오케이" |
| `splitTop`은 **짝이 맞는 괄호만** 보호하고 짝 없는 괄호는 일반 문자. `grade([])`는 RangeError. `validateMeanings`는 `parse(format(g))` 왕복 불변을 핵심 기준으로 검증 (M1) | 짝 없는 `(`가 뒤의 쉼표를 삼키는 것을 막고, 저장한 뜻이 편집 화면에서 그대로 보이게 하기 위해 |
| `createDatabase`는 **모든 OS에서** 대소문자만 다른 이름을 거부. `openDatabase`의 세션 복구는 옵트인(서버만). 오류 변환은 `errcode`가 아니라 메시지 패턴. 트랜잭션은 중첩 불가(`savepoint` 사용) (M2) | Windows는 `Latin.db` 뒤에 `latin.db`를 쓰면 같은 파일을 덮어씀(실측). 최소 Node 22.13에 없을 수 있는 API(`errcode`, `isTransaction`)를 피함 |
| 백업은 파일 복사가 아니라 **`VACUUM INTO`**(대상이 있으면 실패, 트랜잭션 밖에서). import는 변경 0건이면 DB를 열지도 백업하지도 않음. import는 `recoverSessions`를 켜지 않음. 종료 코드 0 정상(경고만 있어도) / 1 파일 오류 / 2 사용법·파일·DB 문제. 리포트는 콘솔과 파일이 같은 내용, `Missing in Excel`은 30개까지만 나열 (M3) | 서버가 쓰는 중에도 일관된 스냅샷, 서버 실행 중에도 안전한 import, 여러 파일 merge 시 리포트 폭주 방지 |
| `write-excel-file`은 쓰지 않고 이미 설치된 `fflate`(0.8.3, devDependency로 고정)로 테스트 xlsx를 만든다 (M3) | 새 패키지 없이 충분함, M8 패키징에서도 사용 |
| **pool이 비고 완료되지 않은 단어가 남아 있으면 라운드 번호를 그 단어들의 가장 이른 `next_round`로 건너뛴다 (D38)**. `PoolInfo`에 `retestRoundNumber` 추가 | 라운드 번호는 Start해야만 올라가서, 모든 단어가 N+2·N+3으로 밀리면 영원히 시작 못 하는 교착이 생김(작은 DB는 즉시). 사용자 승인 |
| 서버 시그널 핸들러는 **서버 시작 전에** 등록, 세션 종료 기록·잠금 삭제를 **동기로 먼저** 한 뒤 연결을 닫음. `server.lock`은 `listen` 성공 후에만 쓰고 자기 pid의 것만 지움 | "running" 메시지 직후의 SIGTERM이 기본 동작으로 처리되는 경합(프로세스 테스트가 발견), Windows는 콘솔 창을 닫고 약 10초 뒤 종료 |
| Origin 검사는 하지 않음(Content-Type=JSON 필수 + CORS 미전송 + Host 검사로 충분). 마지막 문제의 "완료 표시"는 세션의 **가장 최근 라운드**로 확인 | 라운드는 마지막 답 직후 이미 끝나지만 그 문제의 done 확인창은 그 뒤에 뜸 |
| **화면은 Windows Chrome 헤드리스로 직접 확인**: `"/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --hide-scrollbars --window-size=900,700 --screenshot=C:\\Users\\ikhoon\\AppData\\Local\\Temp\\x.png http://localhost:<port>/` 후 `/mnt/c/Users/ikhoon/AppData/Local/Temp/x.png`를 스크래치패드로 복사해 Read로 봄(검증됨: EB Garamond·장음 기호 정상). 서버는 `--host 0.0.0.0`, Windows→WSL `localhost`는 접속됨. 상호작용 상태(대화상자)는 개발용 갤러리(`#/dev`)와 jsdom 테스트로 보완 | 사용자가 UI 컨펌을 해야 하고 정적 스크린샷을 목업과 나란히 대조할 수 있음 |
| MUI 버튼은 기본 대문자(`START`) → 테마에서 `textTransform: none`. 폰트는 `latin`·`latin-ext` 조각만 import(전체 import 시 키릴·그리스어까지 딸려 옴). 표시 컴포넌트와 컨테이너 분리, 클라이언트 테스트는 `console.error` 호출 시 실패 | 목업의 `Start` 표기, 배포물 크기, React 경고를 놓치지 않기 위함 |
| 서버 `0.0.0.0` 바인딩 + Content-Type/Host 검사, `--local-only` 옵션 (T·9장) | 모바일 접속 요구 + 무인증 LAN 위험 완화 |
| **UI 글꼴: Noto Sans KR**(latin·korean 400/500만 번들), 단어·로고는 EB Garamond 유지 (M7) | 사용자 요청("질문의 폰트는 좋은데 메뉴나 사이트 전반은 Noto Sans KR"). 한글 서브셋이 굵기당 한 파일(약 530KB)이라 굵기를 2개로 제한 |
| 오답·단어·설정 화면은 **컨테이너(`…Page`) + 표시(`…Panel`)** 로 분리, **탭에 들어올 때마다 서버에서 새로 읽음**(클라이언트 캐시 없음) (M7) | 서버가 매번 DB를 읽으므로 수정한 뜻이 다음 채점에 즉시 반영되고 설정 문제 수가 퀴즈 탭에 반영됨. 표시 컴포넌트는 서버 없이 테스트·갤러리 가능 |
| 뜻 편집은 **저장 전에 클라이언트에서 `validateMeanings`** 로 검사, 서버의 `HEADWORD_EXISTS`·`INVALID_MEANINGS`·`WORD_NOT_FOUND`는 **편집 행 안에 인라인 표시하고 입력 유지**, 그 밖의 오류만 `handleApiError` (M7) | 잘못된 입력을 서버에 보내지 않고, 사용자가 타이핑한 내용을 잃지 않게 함 |
| **편집 중인 행은 `colSpan={4}` 셀 하나**에 입력창을 줄바꿈해 놓음(목업의 열 정렬과 다름) (M7) | 휴대폰에서 입력창이 좁아 쓸 수 없었음. 데스크톱은 한 줄 |
| 좁은 화면(600px 미만)에서 표의 여백·글자·버튼·체크박스를 줄여 **Done·Edit 열이 화면 안에** 들어오게 함 (M7) | 390px에서 옆으로 스크롤해야 Edit이 보였음 |
| 저장 성공 **토스트는 넣지 않음**(설정만 "Saved" 문구), 설정은 정수 정규식 + 1~200 검사 (M7) | 저장하면 표가 바로 바뀜. 필요하다고 하면 `App`의 Snackbar를 `severity` 지원하도록 확장(작음) |
| **`dist/`가 곧 배포 폴더**: `build.mjs`가 `.bat`도 `dist/`에 쓰고, `package`·`deploy`는 `dist/`만 읽음 (M8) | 두 스크립트가 같은 파일 목록을 쓰게 하고 `.bat`의 CRLF 변환을 한 곳(`toCrlf`)에 둠. 기존 스모크는 `dist/*.mjs`만 복사해 영향 없음 |
| `start.bat`은 TECH-SPEC 8.2에 **`%*`(인자 전달)** 를 추가 (M8) | `start.bat --local-only`·`--port`를 쓸 수 있고, Windows 자동 검증이 `--no-open`을 넘겨야 함 |
| zip은 **루트에 평평하게**(`start.bat`, `import.bat`, `server.mjs`, `import.mjs`, `public/…`), `data`·`reports`·`server.lock`·`node_modules` 제외 (M8) | TECH-SPEC 8.1 |
| `deploy`는 프로그램 파일 4개 + `public/`만 교체(`public/`은 통째로 삭제 후 복사), **`server.lock`이 있으면 종료 코드 1로 중단**(`--force`로만 진행, lock은 그대로), 빌드 불완전·대상과 원본이 서로 포함되면 종료 코드 2. 읽을 수 없는 lock도 중단 (M8) | T16, 옛 해시 파일 잔류·소스 폴더 삭제·실행 중 서버와 새 `public/` 불일치 방지 |
| M8 커밋 순서를 **start.bat → build → package/deploy**로 바꿈 (EXECUTION-PLAN은 build가 먼저) | build가 `start.bat`을 복사하므로 의존 순서 |
| 이번 마일스톤의 모든 검증은 **임시 폴더 또는 `C:\WordQuiz-dev`** 에서만. 실제 `C:\WordQuiz` 배포는 **M9에서 사용자 승인 후** | 사용자 `data\` 보호 |
| 커밋은 주제별 분리, 메시지를 먼저 보여주고 확인 | 사용자 요청 + 프로젝트 규칙 |
| 이번 범위는 PC 서버 + 같은 네트워크 휴대폰 접속. 휴대폰 단독 실행은 나중에 필요하면 (D37). **향후 홈 네트워크 별도 서버로 이전 계획** | 사용자 결정. 그래서 허용 Host를 설정으로 추가 가능하게 함(T15, `nas.local` 등), 인증은 그때 검토 (TECH-SPEC 15장) |
| DB 이름 대소문자 무시 중복 판정(T13), `.bat` CRLF·BOM 없음(T14), `server.lock`으로 실행 중 deploy 차단(T16) | Windows/WSL 차이 |

## 4. 실패/포기한 접근법 (같은 실수 반복 금지)
- **채점 변형에 원형 누락**: 처음엔 괄호를 제거한 형태만 허용해서, 화면에 보이는 정답(`(zusammen)werfen`)을 그대로 입력하면 오답이 되었음(1차 스파이크 38건 실패). 반드시 원형·괄호제거·괄호문자만제거 3가지 모두 허용. 채점 구현 시 실제 데이터로 회귀 테스트할 것
- **쉼표 단순 분리**: 괄호 안 쉼표를 깨뜨림. `splitTop`(괄호 깊이 0에서만 분리) 사용
- **esbuild ESM 번들을 그냥 실행**: `Dynamic require of "fs" is not supported` 오류. `createRequire` 배너 필수
- **`start.bat`에서 브라우저를 먼저 여는 방식**: 서버 준비 전 접속하는 경합. 서버가 `listen` 성공 후 여는 방식으로 결정
- **WAL 모드**: 부속 파일(-wal, -shm) 때문에 `.db` 복사 백업이 불완전해져서 채택하지 않음
- **영어로 계획서 작성**: 사용자가 반려. 문서는 한글로
- **Artifact 링크로 목업 공유**: 비공개 링크라 사용자가 열지 못함. 로컬 HTML 파일로 해결
- **앱 내 OCR/사진 입력, 같은 라운드 내 재출제, 세션 단위 출제 제외, 방향별 진행 상태 분리, 뜻1~4를 개별 뜻으로 해석, 스페이스+쉼표 이중 구분자**: 이전 세션에서 기각됨. PRD에 다시 넣지 말 것
- **사용자가 PRD 파일 안에 답변을 인라인으로 붙이는 방식**: 반영 후 삭제해 달라고 요청받았음. 리뷰·질문은 채팅으로, PRD에는 확정 내용만
- **Windows에서 `SIGTERM` 종료를 자동 검증하는 계획**: Windows는 강제 종료만 가능해 핸들러가 안 돌아서 폐기. 강제 종료 후 복구 검증으로 대체
- **`String.replace(a, b)`에 `$` 포함 문자열 사용**: 치환 문자열의 `` $` ``가 특수 패턴으로 해석되어 문서 앞부분이 통째로 중복 삽입됨(TECH-SPEC 정규식 `...\.db$` 때문). 문서 일괄 치환은 `s.replace(a, () => b)` 함수 형태로 하고, 편집 후 **제목 중복(`uniq -d`)** 을 확인할 것
- **"실행 중 서버는 `server.mjs`를 덮어쓸 수 없다(EBUSY)" 가정**: 실제로 확인하니 틀림. 스크립트는 안 잠기고(덮어쓰기 허용, 옛 코드가 메모리에 남음), 열린 SQLite DB만 삭제·이름 변경이 차단되고 복사는 허용됨. 가정은 실제 실험으로 검증할 것
- **vitest `projects`의 `include` 패턴이 기존 테스트 일부를 놓침**: 분리 후 전체 테스트 수가 줄어든 것(853→850)을 보고 발견. 설정 변경 뒤에는 **테스트 파일 수·개수를 이전과 비교**할 것(`find test -name '*.test.ts*' | wc -l` vs vitest 결과)
- **시그널 핸들러를 서버 시작 뒤에 등록**: 프로세스 테스트가 "running" 직후 SIGTERM에서 종료 코드 `null`(기본 동작)을 잡음. 핸들러는 시작 전에 등록할 것
- **`smoke` 스크립트에서 서버를 `--no-open` 없이 시작**: 실제 서버는 사용자의 브라우저를 연다. 검증 스크립트의 **모든 서버 시작에 `--no-open`**
- **검증 스크립트의 검사식이 JSON 필드 순서를 잘못 가정**(`answered` 뒤에 `total`): 서버 결함이 아님. 실패하면 실제 응답을 출력해 서버와 검사식 중 어느 쪽이 틀렸는지 먼저 확인할 것
- **`DB_TOO_NEW`를 API로 재현하려 함**: 목록 스캔에서 이미 걸러져 `POST /session`은 `DB_NOT_FOUND`. 느슨한 테스트(404·409 아무거나)를 정확한 동작으로 고침
- **아무것도 검증하지 않는 테스트**: `expect(x).toBeDefined;`처럼 호출을 빼먹음. 테스트를 쓴 뒤 일부러 깨 보는 결함 주입이 이런 것을 잡는다
- **테스트가 `word` 테이블만 확인**: "사라진 단어를 삭제하지 않는다" 테스트가 진행 상태(`word_progress`) 행 삭제를 못 잡음(그 단어는 pool 조회에서 조용히 빠짐). **결함 주입에서 안 잡힌 항목이 있으면 테스트 공백이라는 신호** — 진행 상태·내용까지 확인하도록 보강
- **결함 주입 SQL을 두 문장으로 넣음**: `prepare`가 두 번째 문장을 무시해 결함이 주입되지 않았는데 "테스트가 통과"로 오해할 뻔함. 주입 후 **파일이 실제로 바뀌었는지, 동작이 바뀌었는지** 확인할 것
- **이름 충돌 안내에 사용자가 입력한 이름 사용**: `--new-db Latin`이 `latin.db`와 충돌할 때 `--db Latin.db`를 안내(대소문자 환경에서 틀림). 디스크의 실제 이름(`findExistingDbName`)을 쓸 것
- **stdout을 `| head`로 닫으면 EPIPE 크래시**: 진입점에서 stdout의 EPIPE를 무시. WSL에서 `node.exe ... | head`의 종료 코드 141은 WSL 중계 프로세스의 SIGPIPE이므로 프로그램의 종료 코드로 해석하지 말 것
- **스모크 스크립트가 서버 스모크의 `smoke.db`와 같은 이름을 `--new-db`로 사용**: CLI가 충돌을 정확히 거부한 것(스크립트의 실수). 검증 스크립트끼리 리소스 이름이 겹치지 않게 할 것
- **`smoke:win`의 "포트 사용 중" 검사가 한 번 일시 실패**(재실행 2회 통과). 원인 미확정. 또 나오면 조사할 것
- **`createDatabase`의 대소문자 검사를 파일시스템(`wx`)에만 맡김**: Windows에서는 막히지만 Linux/WSL에서는 `latin.db`를 `Latin.db`와 다른 파일로 만들어 버림. `smoke:win-db`를 **Linux에서도 돌려서** 발견. 검사를 `createDatabase` 안(`dbNameExists`)으로 이동. **플랫폼 의존 동작은 양쪽 OS에서 같은 검사를 돌려 확인할 것**
- **테스트 기대값 산수 실수**: pool 재시험 테스트에서 기대값을 잘못 셈(구현은 옳았음). 실패하면 구현과 기대값 중 어느 쪽이 틀렸는지 먼저 따져볼 것
- **WSL `curl`로 Windows 서버 접속**: `localhost`로는 안 됨. `curl.exe` 사용
- **WSL에 `python3` 없음**: xlsx 분석은 `unzip` + node로 함
- **편집 행을 CSS(`tr { display: block }`)로 세로 배치**: 표 안에서 블록 행이 첫 열 너비 익명 셀에 갇혀 입력창이 좁아짐. `colSpan` 셀 하나 + flex-wrap으로 해결
- **갤러리에서 휴대폰 폭 표를 잰 것**: 갤러리는 Section 테두리 + 패딩이 겹쳐 실제 페이지보다 표가 좁게 나옴(Edit이 잘려 보임). 실제 페이지와 같은 여백(`words-edit` 경로는 `p: 0`)으로 찍을 것
- **표제어 입력창에 `"locl" 0`을 빼먹음**: `taurus`가 `tavrvs`로 보임(EB Garamond `lang="la"`). 표제어를 그리는 **모든 곳**(입력창 포함)에 `fontFeatureSettings: '"locl" 0'`
- **jsdom `type=number`에 `1e2` 입력**: `"100"`으로 바뀌어 검증이 통과해 버림(실제 브라우저는 `"1e2"`). 자동 테스트에서 뺌
- **설정 API를 세션 없이 조회**(재시작 직후 `GET /settings` → `NO_SESSION`): 서버 결함이 아니라 검증 스크립트 실수. 설정·단어 API는 `POST /session` 뒤에만
- **`node -e '…'`에 따옴표가 많은 한글 문서 치환 스크립트를 인라인으로 넣음**: 따옴표 충돌로 문법 오류(수정은 하나도 안 됨). 긴 치환은 **스크래치패드 `.cjs` 파일**로 쓰고, 치환 문자열은 함수 형태(`() => b`)로
- **스크린샷 자르기 도구 없음**(ImageMagick·sharp 없음, `file`도 없음): 긴 갤러리를 읽으면 축소되어 안 보임 → 상태별 **갤러리 경로를 따로**(`#/dev/m7`, `#/dev/words-edit`) 만들어 작은 크기로 찍음
- **`npx prettier --check`**: 저장소에 prettier 설정이 없어 기존 파일도 경고. `--write`로 서식을 바꾸지 말 것
- **셸 명령에 `>nul`을 넣으면 `/dev/null`로 바뀌어 파일에 들어감**: `node -e '...'` 안의 `where node >nul 2>nul`이 `start.bat`에 `>/dev/null`로 기록됨(`od -c`로 발견). **`nul`이 들어가는 파일은 셸을 거치지 않는 Write 도구로 쓰거나**, `"n"+"ul"`처럼 조합해서 쓰고 바이트로 확인할 것
- **`deploy`의 `mkdirSync(target)`가 죽은 코드**: 지워도 결과가 같았음(파일 쓸 때 상위 폴더를 만들기 때문). **결함 주입에서 살아남은 항목은 테스트 공백이거나 죽은 코드** — 어느 쪽인지 먼저 판단
- **`process.env.DEPLOY_DIR ?? 기본값`**: 빈 문자열이면 `path.resolve('')` = 현재 폴더가 됨. 빈 값도 "없음"으로 보려면 `||`
- **fflate `zipSync`에 `mtime: 0`**: 1980년 이전 날짜라 오류. 날짜는 지정하지 말 것(현재 시각 기본값)
- **`.mjs` 스크립트를 테스트에서 정적 import**: 타입 설정이 없어 문제가 됨 → `await import(pathToFileURL(...).href)`(동적)와 `spawnSync(process.execPath, [script, ...])`(블랙박스)를 사용
- **테스트가 `--dir` 없이 `deploy`를 실행하면 기본값 `/mnt/c/WordQuiz`(실제 설치 폴더)가 대상이 될 수 있음**: 테스트는 항상 `--dir`/`DEPLOY_DIR`을 지정하고 `runScript`가 `DEPLOY_DIR`을 비움
- **`data/latin_wortschatz.xlsx`가 한 번 사라졌었음**(원인 불명, 사용자가 다시 복사). 구현·테스트가 이 파일에 의존하면 안 됨. 테스트 픽스처는 저장소 안에 별도로 둘 것 (TECH-SPEC 10장)

## 5. 다음 세션 시작 시 할 일
1. `git status`/`git log --oneline -8`로 상태를 확인하고 `npm run typecheck && npm test`(**1063개/49파일**)를 돌린다. 브랜치는 `main`(origin push는 아직 안 함, 사용자에게 물어볼 것). `data/`·`docs/ui-checks/`만 untracked면 정상. `release/WordQuiz.zip`은 `.gitignore`에 있어 안 보인다
2. **M8 남은 일 — `scripts/package-e2e.sh`(`npm run smoke:package`)** 를 기존 스모크 스크립트(`server-e2e.sh`, `win-smoke.sh`)의 관례(`WIN_DEV` 가드로 실제 `C:\WordQuiz` 거부, 모든 서버 시작에 `--no-open`, `CommandLine`으로 **자기가 띄운 프로세스만** 종료, PASS/FAIL 집계)로 만든다:
   - **Linux**: `npm run package` → `unzip -l`로 항목 확인 → **`node_modules` 없는 임시 폴더에 풀어** 서버 기동 → `GET /api/databases`(`{"databases":[]}`)와 `/`(HTML), `server.lock` 생성(완료 기준 ②)
   - **Linux 배포**: 임시 `DEPLOY_DIR`에 `deploy` 두 번 + `data`·`reports` 체크섬 비교(③), 배포된 `.bat`의 모든 줄 CRLF·BOM 없음(⑥)
   - **Windows**: `$WIN_DEV/package-e2e`(`C:\WordQuiz-dev\package-e2e`)에 deploy → `cmd.exe /c start.bat --no-open --port <n> < NUL`(`pause`가 막히지 않게)을 백그라운드로 실행 → `curl.exe`로 `/api/databases` → 서버가 떠 있는 동안 `deploy`가 lock으로 **중단**되는지, `--force`는 진행하는지(⑦) → `CommandLine`에 `package-e2e`가 든 `node.exe`만 종료하고 남은 `server.lock` 삭제. 샘플 xlsx가 있으면 `cmd.exe /c import.bat <샘플> --new-db … --report …`(검증만)이 종료 코드 0·178단어를 내는지도 확인
   - 위험: `cmd.exe`를 WSL에서 실행하면 `where node`가 Windows PATH에 의존한다. 실패하면 그 줄만 조사해 `node.exe` 위치를 PATH에 넣도록 스크립트를 조정. 이 PC의 Node는 24.14라 22.13 경계는 `vm` 단위 테스트로만 검증됨
   - 커밋 제안: `test: Add package smoke check`
3. 회귀: `npm run smoke:server`(51), `smoke:win`, `smoke:win-db`, `smoke:import`(63)
4. **문서(한글)**: EXECUTION-PLAN 진행표 M8과 **M8 결과**(완료 기준 ①~⑦ 대응, 계획 대비 변경: `%*`, 커밋 순서, `dist/`=배포 폴더), TECH-SPEC 8.1(zip 구조, `dist/`가 배포 폴더)·8.2(`%*`)·3.2 배포 명령 예시를 실제 스크립트에 맞춤·새 **14.11 M8 확인**. 편집 후 **제목 중복(`uniq -d`)** 확인. 커밋 제안: `docs: Record M8 results`
5. 사용자에게 알릴 것: zip에 구형 브라우저용 `.woff` 10개가 함께 들어 있다(`.woff2`만으로 최신 브라우저는 충분). 빼면 zip이 작아지지만 필수는 아님 — 원하면 별도 작업
6. **M9**: Windows 자동 검증 전 항목, 사용자 수동 체크리스트(EXECUTION-PLAN 3.3), 추적표 확정, `README.md`(설치·첫 실행·import 흐름·백업 위치·방화벽·문제 해결). 실제 `C:\WordQuiz` 배포는 **사용자가 승인하면** 한다(기존 `data\` 보존). 실제 폰의 Enter 제출·자동 고침도 수동 체크리스트
7. 클라이언트 작업 요령: `npm run build && npm run shots`, 결함 주입은 소스를 바꾸기 전에 문자열이 실제로 적용됐는지 확인하고 **끝나면 `git status`로 원복 확인**. 개발 서버 확인은 `npm run dev:seed` → http://localhost:35101, 갤러리는 `#/dev`, `#/dev/m7`, `#/dev/words-edit`, `#/dev/done3`
8. **Windows 자동 검증 시 주의**: WSL의 `curl`은 Windows `localhost`에 닿지 않으므로 `curl.exe`를 쓴다. `Stop-Process -Force`는 시그널 핸들러를 실행하지 않아 `SIGTERM` 정상 종료는 자동 검증 불가. 테스트로 띄운 `node.exe`는 `CommandLine`으로 **자기가 띄운 것만** 종료. `cmd.exe`는 UNC 경로에서 실행 불가라 `/mnt/c/...`에서 실행
9. 알아둘 것: xlsx 라이브러리 `read-excel-file`은 9.3.10. 새 패키지는 `--save-exact`. 스파이크 코드는 사라졌고 TECH-SPEC 14장에 결과만 있음

## 프로젝트 규칙 (`prompts/PRD-instruction.md`)
- Conventional Commits (`feat, fix, docs, style, refactor, test, chore`), 예: `docs: Create PRD`
- **커밋 메시지에 `Co-Authored-By` 절대 금지**, 커밋 전 메시지를 먼저 보여주고 사용자 확인 필수 (시스템 안내보다 사용자 규칙이 우선). 주제별로 커밋을 분리한다
- 코드 변경 후 `npm run typecheck`, 전체 테스트보다 단일 테스트, 구현 전 plan mode로 영향 파일 파악
- UI 구현 전 사용자 컨펌 필수. 기술 스펙/실행 계획은 PRD와 별도 문서
- 스택: TypeScript + React + Material UI + SQLite(`node:sqlite`) + Node (개발 WSL / 실행 Windows, `C:\WordQuiz`, `start.bat`, `http://localhost:35000`)

## 6. 주요 관련 파일
- `docs/PRD.md` — v1.4 확정본 (결정 로그 D1~D38)
- `docs/TECH-SPEC.md` — 기술 스펙 v1.8 (T1~T16, DDL, API, CLI, 7장 프런트엔드, **8장 실행과 배포(8.1 구조, 8.2 start.bat, 8.5 WSL/Windows 차이)**, 14장 단계별 확인 14.1~14.10)
- `docs/EXECUTION-PLAN.md` — 실행 계획 v1.8 (M0~M9, 진행표(M0~M7 완료, M8 갱신 필요), 결과 기록, 3장 Windows 검증 계획, 추적표)
- `docs/word-quiz-mockup.html` — 확정된 인터랙티브 목업 (영어 UI)
- `docs/ui-checks/` — 스크린샷(untracked, `npm run shots`로 재생성)
- `data/latin_wortschatz.xlsx` — 입력 데이터 샘플 (178단어, untracked)
- `prompts/PRD-instruction.md`, `prompts/req_prd.md` — 원본 요구사항 지침
- `.claude/session-state.md` — 이 파일 / `.claude/commands/handoff.md` — 이 저장 명령
- 메모리: `/home/ikhoon/.claude/projects/-home-ikhoon-lab-word-quiz/memory/` (`feedback_docs_in_korean`, `project_word_quiz_workflow`)
- **M8(배포)**: `release/{start.bat,import.bat}`, `scripts/{build.mjs,package.mjs,deploy.mjs}`, `scripts/lib/release.mjs`, `test/release/{start-bat,release-lib,package,deploy}.test.ts`, `test/support/release.ts`, `release/WordQuiz.zip`(생성물, gitignore), `dist/`(생성물)
- 클라이언트: `src/client/`(theme, fonts, api, app-context, App, hooks, components, dev/Gallery.tsx), `test/client/`, `vite.config.ts`, `scripts/{dev.mjs,shots.sh}`
- 서버·CLI·공용: `src/server/`, `src/cli/`, `src/shared/`, `test/{server,cli,shared,support}/`, `test/fixtures/tricky-meanings.json`, `scripts/{win-smoke.sh,win-db-check.sh,import-e2e.sh,server-e2e.sh}`, `package.json`, `tsconfig.*.json`, `vitest.config.ts`
- 검증 명령: `npm run typecheck` / `npm test -- <이름>` / `npm run build` / `npm run package` / `npm run deploy -- --dir <폴더> [--force]` / `npm run smoke:win` / `smoke:win-db` / `smoke:import` / `smoke:server` / `npm run shots` (`smoke:package`는 아직 없음)
- (참고) Artifact 링크 https://claude.ai/artifact/Gqn1G2DA4wXmBB4dsMrf6E — 옛 한국어 UI 버전, 사용자가 열지 못함. 기준 아님
