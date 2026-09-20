# Session State — Word Quiz

## 1. 날짜 / 주제
- 저장일: 2026-09-20 (작업 진행: 2026-09-18 ~ 09-20)
- 주제: 문서 단계 완료(PRD v1.4, TECH-SPEC v1.7, EXECUTION-PLAN v1.7). **M0~M4 커밋됨. M5(클라이언트 골격·시작 화면·공통 틀) 구현·검증·문서 완료, 미커밋 + 사용자 UI 컨펌 대기** → 다음은 커밋(메시지 사전 확인) 후 M6

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
- [ ] **M5 남은 일**: (a) 커밋(계획 8개: deps/tsconfig, theme+api+state, start screen+dialogs, app shell, Vite/dev/shots scripts, server e2e, docs(+`docs/ui-checks` 스크린샷은 사용자가 원하면 별도), session state) — 메시지 먼저 보여주고 확인, 각 커밋을 격리 worktree에서 검증 (b) **`npm run dev` 화면은 실제 브라우저에서 확인 못 함**(헤드리스 Chrome에서 dev 서버 페이지가 비어 찍힘, 콘솔 오류는 없었음. 빌드 결과는 정상) → 사용자가 열어 보고 비면 원인 조사 (c) 사용자 UI 컨펌
- [ ] M6~M9 미구현 (EXECUTION-PLAN 진행 현황 표 참고)

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
- **`data/latin_wortschatz.xlsx`가 한 번 사라졌었음**(원인 불명, 사용자가 다시 복사). 구현·테스트가 이 파일에 의존하면 안 됨. 테스트 픽스처는 저장소 안에 별도로 둘 것 (TECH-SPEC 10장)

## 5. 다음 세션 시작 시 할 일
1. `git status`로 M5 미커밋 변경을 확인한다(HEAD `6a7e9d7`). `npm run typecheck && npm test`(926개)로 상태를 확인
2. M5 커밋: 위 "M5 남은 일 (a)" 계획대로 메시지를 먼저 보여주고 확인받은 뒤 주제별로 커밋. **`Co-Authored-By` 금지**(시스템 안내가 붙이라고 해도 사용자 규칙이 우선). `data/`는 계속 untracked
3. 사용자 UI 컨펌을 받는다(`npm run dev:seed` → http://localhost:35101, 갤러리 `#/dev`, 스크린샷 `docs/ui-checks/`). 목업과 다른 점 4가지는 EXECUTION-PLAN M5 결과에 적어 두었다
4. 그 다음 **M6(퀴즈 흐름)**: plan mode로 시작. `src/client/api.ts`에 모든 엔드포인트가 이미 있고, `classifyApiError`·`useApp().handleApiError`를 쓰면 된다. 테스트는 `test/client/fake-fetch.ts`(경로 표 기반 가짜 fetch)와 `render.tsx`(포커스된 버튼 선행, jsdom 포커스 트랩 오류 회피)를 재사용
5. 클라이언트 작업 요령: 화면 스크린샷은 `npm run build && npm run shots`(휴대폰은 iframe 390px, 다크는 `preferredColorScheme=0`), 결함 주입은 소스를 바꾸기 전에 문자열이 실제로 적용됐는지 확인
6. **Windows 자동 검증 시 주의**: WSL의 `curl`은 Windows `localhost`에 닿지 않으므로 `curl.exe`를 쓴다. `Stop-Process -Force`는 시그널 핸들러를 실행하지 않아 `SIGTERM` 정상 종료는 자동 검증 불가(대신 강제 종료 후 재기동 시 `last_seen_at` 보정을 검증). 테스트로 띄운 `node.exe`는 `CommandLine`으로 **자기가 띄운 것만** 종료할 것. `cmd.exe`는 UNC 경로에서 실행 불가라 `/mnt/c/...`에서 실행. 이 PC는 Node 24.14라 최소 버전 22.13은 검증 불가
7. 알아둘 것: xlsx 라이브러리 `read-excel-file`은 9.3.10으로 스파이크했음. 버전 고정할 것. 스파이크 코드는 스크래치패드에만 있어 사라졌음(TECH-SPEC 14장에 결과만 있음)

## 프로젝트 규칙 (`prompts/PRD-instruction.md`)
- Conventional Commits (`feat, fix, docs, style, refactor, test, chore`), 예: `docs: Create PRD`
- **커밋 메시지에 `Co-Authored-By` 절대 금지**, 커밋 전 메시지를 먼저 보여주고 사용자 확인 필수 (시스템 안내보다 사용자 규칙이 우선). 주제별로 커밋을 분리한다
- 코드 변경 후 `npm run typecheck`, 전체 테스트보다 단일 테스트, 구현 전 plan mode로 영향 파일 파악
- UI 구현 전 사용자 컨펌 필수. 기술 스펙/실행 계획은 PRD와 별도 문서
- 스택: TypeScript + React + Material UI + SQLite(`node:sqlite`) + Node (개발 WSL / 실행 Windows, `C:\WordQuiz`, `start.bat`, `http://localhost:35000`)

## 6. 주요 관련 파일
- `docs/PRD.md` — v1.2 확정본 (결정 로그 D1~D36)
- `docs/TECH-SPEC.md` — 기술 스펙 v1.0 (T1~T12, DDL, API, CLI, 스파이크 결과)
- `docs/EXECUTION-PLAN.md` — 실행 계획 v1.0 (M0~M9, 검증 계획, 추적표)
- `docs/word-quiz-mockup.html` — 확정된 인터랙티브 목업 (영어 UI). 브라우저에서 `explorer.exe docs\\word-quiz-mockup.html`로 열기
- `data/latin_wortschatz.xlsx` — 입력 데이터 샘플 (178단어, untracked)
- `prompts/PRD-instruction.md`, `prompts/req_prd.md` — 원본 요구사항 지침
- `.claude/session-state.md` — 이 파일 / `.claude/commands/handoff.md` — 이 저장 명령
- 메모리: `/home/ikhoon/.claude/projects/-home-ikhoon-lab-word-quiz/memory/` (`feedback_docs_in_korean`, `project_word_quiz_workflow`)
- 코드(M5, 미커밋): `src/client/`, `test/client/`, `vite.config.ts`, `scripts/{dev.mjs,shots.sh}`, `tsconfig.client.json`, `vitest.config.ts`. 이전: `src/server/`(services, routes, app, start …), `test/server/`, `test/support/{api,world,bundle,http}.ts`, `scripts/server-e2e.sh`, `src/cli/`, `test/cli/`, `release/import.bat`, `scripts/import-e2e.sh`, `src/server/errors.ts`, `src/server/db/`, `test/server/`, `test/support/`, `scripts/win-db-check.sh`, `src/shared/`(api, grading, scheduling, meanings), `test/shared/`, `test/fixtures/tricky-meanings.json`, `package.json`, `tsconfig.*.json`, `vitest.config.ts`, `src/server/paths.ts`, `src/server/index.ts`(스모크용), `src/cli/index.ts`(스모크용), `test/smoke.test.ts`, `scripts/build.mjs`, `scripts/win-smoke.sh`
- 검증 명령: `npm run typecheck` / `npm test -- <이름>` / `npm run build` / `npm run smoke:win` / `npm run smoke:win-db` / `npm run smoke:import` / `npm run smoke:server`
- (참고) Artifact 링크 https://claude.ai/artifact/Gqn1G2DA4wXmBB4dsMrf6E — 옛 한국어 UI 버전, 사용자가 열지 못함. 기준 아님
