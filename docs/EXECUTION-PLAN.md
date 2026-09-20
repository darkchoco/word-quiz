# Word Quiz 실행 계획

> 상태: v1.1 (초안 · 리뷰 대기) · 작성일: 2026-09-20  
> 기준 문서: `docs/PRD.md` v1.3, `docs/TECH-SPEC.md` v1.1, `docs/word-quiz-mockup.html`  
> 범위: **무엇을 어떤 순서로 만들고 어떻게 확인하는가**. 요구사항은 PRD, 설계는 기술 스펙이 다룬다.

---

## 1. 진행 원칙

1. **마일스톤 하나의 절차**
   ① plan mode로 영향 파일 파악 → ② 구현 → ③ `npm run typecheck` → ④ 관련 **단일 테스트** 실행 → ⑤ 커밋 메시지 초안을 사용자에게 제시 → ⑥ 확인 후 커밋.
2. **커밋 규칙**: 영어 Conventional Commits(`feat, fix, docs, style, refactor, test, chore`), `Co-Authored-By` 금지, 커밋 전 메시지를 먼저 보여주고 확인받는다. 커밋은 주제별로 분리한다.
3. **스펙이 바뀌면 문서를 먼저 고친다.** 구현 중 `docs/TECH-SPEC.md`와 다른 결정이 생기면 스펙을 갱신하고 별도 `docs:` 커밋으로 남긴다. PRD 변경이 필요하면 사용자 승인 후 결정 로그(D번호)에 추가한다.
4. **UI는 목업이 기준**이며 컨펌이 끝난 상태다. 목업과 다르게 바꿔야 하면 구현 전에 다시 컨펌받는다.
5. **테스트는 실제 데이터 파일에 의존하지 않는다.** `data/latin_wortschatz.xlsx`는 개발 편의용 샘플이고 커밋 대상이 아니다(과거에 파일이 사라진 적이 있다). 테스트 픽스처는 `test/fixtures/`에 둔다. 실제 파일은 **종단 검증(M3)에서만** 쓴다.
6. **크기 표기**는 시간 대신 S / M / L을 쓴다. 단일 개발자 기준 **순차 진행**이 기본이고, M1과 M2는 병행할 수 있다.
7. **사용자의 실제 환경(`C:\WordQuiz`, 사용자 데이터)은 자동으로 건드리지 않는다.** 개발 중 Windows 검증은 `C:\WordQuiz-dev`에서 하고, 실제 `C:\WordQuiz` 배포는 M9에서 사용자 확인 후에만 한다.

### 진행 현황

| # | 마일스톤 | 크기 | 상태 |
|---|----------|------|------|
| M0 | 프로젝트 골격 + Windows 스모크 | S | [ ] |
| M1 | 공용 규칙 (`src/shared`) | M | [ ] |
| M2 | DB 계층 | M | [ ] |
| M3 | Import CLI | L | [ ] |
| M4 | 서버 서비스와 API | L | [ ] |
| M5 | 클라이언트 골격 · 시작 · 공통 | M | [ ] |
| M6 | 클라이언트 퀴즈 흐름 | L | [ ] |
| M7 | 클라이언트 오답 · 단어 관리 · 설정 | M | [ ] |
| M8 | 번들 · 패키징 · 배포 | M | [ ] |
| M9 | 최종 검증 · 문서 | M | [ ] |

의존 관계: `M0 → (M1 ∥ M2) → M3, M4 → M5 → M6 → M7 → M8 → M9` (M3과 M4는 둘 다 M1·M2가 끝나야 시작하며 서로는 독립이다).

### 사용자 확인 시점
| 시점 | 확인할 것 |
|------|-----------|
| M0 끝 | Windows 스모크 결과, 의존성 버전 고정 목록 |
| M3 끝 | 실제 샘플로 만든 import 리포트 (형식과 내용이 쓸 만한지) |
| M5 끝 | 시작 화면·공통 틀을 목업과 대조 (브라우저에서 직접 확인) |
| M7 끝 | 전체 UI 컨펌 (PC와 모바일 폭) |
| M9 | 수동 체크리스트 수행, 실제 `C:\WordQuiz` 배포 여부 |

---

## 2. 마일스톤

각 마일스톤은 **산출물 / 완료 기준 / 검증 / 커밋 제안**으로 정리한다. 완료 기준은 모두 확인 가능한 문장이다.

### M0. 프로젝트 골격 + Windows 스모크 (S)
**목적**: 도구 체인을 세우고, 스펙의 가장 큰 가정(T1·T2: `node:sqlite` + 단일 파일 번들이 Windows에서 돈다)을 **가장 먼저** 확인한다.

| 구분 | 내용 |
|------|------|
| 산출물 | `package.json`(`"type":"module"`, `engines.node ">=22.13"`, **의존성 정확한 버전 고정**), `package-lock.json`, `tsconfig.base.json` / `tsconfig.node.json` / `tsconfig.client.json`, `vitest.config.ts`, `.gitignore`, **`.gitattributes`**(`*.bat text eol=crlf`, 소스 `eol=lf`), `scripts/build.mjs`(골격), 스모크용 최소 `src/server/index.ts`(HTTP + `node:sqlite`)와 `src/cli/index.ts`(`read-excel-file`로 xlsx 읽기), `test/smoke.test.ts`, `scripts/win-smoke.sh` |
| `.gitignore` | `node_modules/`, `dist/`, `release/*.zip`, 개발용 `WORDQUIZ_HOME` 디렉터리. **`data/`는 사용자 결정에 따라 untracked로 두고 `.gitignore`에도 넣지 않는다** |
| 완료 기준 | ① `npm run typecheck` 오류 0 ② `npm test` 통과 ③ `npm run build`가 `dist/server.mjs`, `dist/import.mjs`를 만든다 ④ `node_modules` 없는 임시 디렉터리에 번들만 복사해 Linux에서 실행 성공 ⑤ 같은 번들을 `C:\WordQuiz-dev`에 배포해 **`node.exe`로 실행**하면 서버가 응답하고 xlsx를 읽는다 |
| 검증 | `npm run typecheck`, `npm test -- smoke`, `npm run build`, `bash scripts/win-smoke.sh`(배포 → `node.exe` 기동 → `curl.exe` 응답 확인 → 자신이 띄운 프로세스만 종료) |
| 판별할 것 | `read-excel-file` 번들 성공 여부(실패 시 `fflate` + 최소 XML 파서로 대체를 결정), Windows 프로세스에 `WORDQUIZ_HOME`을 넘기는 방법(`WSLENV`), 최종 고정 버전 목록 |
| 커밋 제안 | `chore: Scaffold project with TypeScript and vitest` / `chore: Add bundle build script` / `test: Add Windows bundle smoke check` |

### M1. 공용 규칙 `src/shared` (M)
| 구분 | 내용 |
|------|------|
| 산출물 | `src/shared/grading.ts`(`splitTop`, `normalize`, `variants`, `grade`), `scheduling.ts`(`applyResult`), `meanings.ts`(`formatMeanings`, `parseMeanings`), `api.ts`(요청·응답 타입, 오류 코드 상수), 테스트와 `test/fixtures/tricky-meanings.json` |
| 완료 기준 | ① TECH-SPEC 4.1 예시 표의 **모든 행**이 테스트로 통과 ② 스파이크에서 실패했던 유형(정답을 괄호 그대로 입력, `wie viel(e)?`, 괄호 안 쉼표, 대문자 + 움라우트 입력)을 픽스처로 고정해 통과 ③ 4.2 스케줄링 표의 모든 행 통과(Perfect 3회 이상 `askDone` 포함) ④ `format → parse` 왕복이 픽스처 전체에서 동일 |
| 검증 | `npm test -- grading`, `npm test -- scheduling`, `npm test -- meanings` |
| 회귀 방지 | 픽스처는 실제 샘플에서 **문제가 됐던 행 약 20개**를 발췌해 저장한다(전체 178행 복사 아님). 실제 파일 전체에 대한 검증은 M3 종단 검증에서 한다 |
| 커밋 제안 | `feat: Add grading rules` / `feat: Add scheduling rules` / `feat: Add meanings format helpers` / `feat: Add shared API types` |

### M2. DB 계층 `src/server/db` (M)
| 구분 | 내용 |
|------|------|
| 산출물 | `migrations.ts`(v1 = TECH-SPEC 3.3 DDL), `open.ts`(PRAGMA, 버전 가드, 고아 세션 보정), `queries.ts`(pool, 상태 바, 다음 라운드 번호 등), `names.ts`(DB 이름 검증, `data/` 스캔), 테스트 |
| 완료 기준 | ① 빈 DB에서 마이그레이션이 v1 스키마를 만들고 재실행해도 변화 없음 ② 코드보다 높은 `user_version`이면 `DB_TOO_NEW` ③ 고아 세션(`ended_at IS NULL`)이 열 때 `last_seen_at`으로 닫힘 ④ pool 경계: `next_round == n`은 포함, `n-1`(즉 `next_round > n`)은 제외, `done`은 제외, 재시험은 `wrong_mark = 1`만 ⑤ DB 이름 검증이 `latin.db`, `latin_2.db`는 통과시키고 `../x.db`, `a/b.db`, `x.txt`, 빈 문자열, `a b.db`는 거부 ⑥ UNIQUE(`errcode 2067`)·CHECK·FK 위반이 도메인 오류로 변환됨 ⑦ 스캔이 `meta`가 없는 파일을 목록에서 뺌 ⑧ `Latin.db`와 `latin.db`를 **같은 이름으로 판정**(T13)하고, 스캔에서 대소문자만 다른 두 파일이 있으면 경고 |
| 검증 | `npm test -- db`. 임시 디렉터리 DB와 `:memory:` 사용 |
| 커밋 제안 | `feat: Add SQLite migrations and connection` / `feat: Add DB queries and name validation` |

### M3. Import CLI `src/cli` (L)
| 구분 | 내용 |
|------|------|
| 산출물 | `xlsx.ts`(헤더 이름 매핑), `validate.ts`(오류·경고), `plan.ts`(기존 DB 비교), `report.ts`, `index.ts`(인자 파싱, 종료 코드), `apply`(백업 + 한 트랜잭션), `release/import.bat`, 테스트와 소형 xlsx 픽스처 |
| 완료 기준 | ① 검증 모드(기본)는 DB 파일을 **만들지도 바꾸지도 않는다**(수정 시각 불변) ② 오류(빈 표제어, 뜻 없음, 파일 내 중복, `\|` 포함)가 있으면 `--apply`가 종료 코드 1로 **아무것도 쓰지 않는다** ③ merge에서 기존 단어의 진행 상태(`streak`, `wrong_mark`, `next_round`, `done`)가 보존됨 ④ Excel에서 사라진 단어는 삭제되지 않고 리포트에만 나온다 ⑤ 갱신 항목에 이전 → 이후 값이 리포트에 표시됨 ⑥ `--apply`(merge) 직전에 `data/backup/`에 복사본이 생김 ⑦ `--new-db`는 이미 있는 이름이면 오류(**대소문자 무시**, 예: `latin.db`가 있을 때 `Latin`) ⑧ 리포트가 stdout과 파일에 UTF-8로 같은 내용으로 저장됨 |
| **종단 검증** | 임시 `WORDQUIZ_HOME`에서 실제 샘플로: 검증 모드(DB 없음, 178 추가 예정) → `--new-db latin --lang latin --apply`(178단어 적재) → 같은 파일로 검증 재실행(**178 전부 "변경 없음"**) → 한 셀을 바꾼 사본으로 재실행(1건 "갱신", 이전 → 이후 표시) |
| 검증 | `npm test -- cli`, 위 종단 절차, 리포트 육안 확인(사용자 확인 시점) |
| 커밋 제안 | `feat: Add xlsx reader and validation` / `feat: Add import plan and report` / `feat: Add import apply with backup` / `feat: Add import.bat launcher` |

### M4. 서버 서비스와 API (L)
| 구분 | 내용 |
|------|------|
| 산출물 | `src/server/services/`(session, round, words, settings), `routes/`, `app.ts`(미들웨어), `index.ts`(진입점), 정적 파일 서빙, 종료 처리, 테스트 |
| 미들웨어 | `Host` 헤더 검사(단일 이름·사설 IPv4·`127.0.0.1`·`[::1]`만 허용), 쓰기 요청 `Content-Type: application/json` 요구, CORS 헤더 미전송, JSON 100KB 제한, 오류 응답 규약(`{error:{code,message}}`), **허용 Host 추가 설정**(`WORDQUIZ_ALLOWED_HOSTS`, `--allow-host`, T15) |
| 서버 동작 | `listen` 성공 후 브라우저 열기(`--no-open`으로 끔), `--local-only`, `PORT`, `EADDRINUSE` 시 안내 후 브라우저만 열고 종료, `last_seen_at` 30초 스로틀 갱신, **`server.lock` 생성·종료 시 삭제**(T16), 종료 시그널(`SIGINT`, `SIGTERM`, `SIGHUP`, `SIGBREAK`)에서 세션 `ended_at` 기록 |
| 완료 기준 | ① TECH-SPEC 5.1의 모든 엔드포인트가 명시된 오류 코드를 반환 ② **다중 라운드 시나리오 테스트** 통과: 라운드 N에서 Perfect → N+1 pool에 없고 N+2에 있음, 두 번째 Perfect → N+3, 세 번째 Perfect에서 `askDone`, 오답 → N+1에 재출제, 부분 정답이 상태 바 정답에 안 들어감, 완료 표시와 해제, 재시험은 오답 마크만 ③ 제출이 한 트랜잭션(도중 실패 시 `word_progress` 불변) ④ 새로고침(`GET /rounds/current`)으로 이어서 풀기 ⑤ 잘못된 `Host`·잘못된 `Content-Type`이 거부됨 ⑥ 종료 처리 함수를 호출하면 `ended_at`이 기록됨, **Linux에서 실제 `SIGTERM`을 보내는 통합 테스트**도 통과 ⑦ DB 파일이 사라진 상태에서 `DB_NOT_FOUND` ⑧ `nas.local` 같은 점 포함 Host가 기본 설정에서는 403이고 `--allow-host nas.local`을 주면 200 ⑨ 서버 기동 시 `server.lock`이 생기고 정상 종료 시 사라지며, 남아 있어도 다음 기동이 덮어씀 |
| 검증 | `npm test -- server`(가능하면 파일별로 `npm test -- rounds`), `app.listen(0)` + `fetch` |
| 커밋 제안 | `feat: Add session and settings API` / `feat: Add round and answer API` / `feat: Add words API` / `feat: Add request guards and graceful shutdown` |

### M5. 클라이언트 골격 · 시작 · 공통 (M)
| 구분 | 내용 |
|------|------|
| 산출물 | Vite 설정(`/api` 프록시), `theme.ts`(목업 토큰, 다크 모드, `@fontsource` 폰트), `api.ts`(fetch 래퍼, `ApiError`), hash 훅, `App`, `StartScreen`, `Shell`, `TopBar`, `Tabs`, `StatusBar`, `NoDbDialog`, `SwitchDbDialog` |
| 완료 기준 | ① 시작 화면에서 언어(English는 "Coming soon"으로 비활성)와 DB를 골라 시작하면 `Shell`이 뜬다 ② 없는 DB → "The selected DB does not exist." 알림 후 시작 화면 복귀 ③ Switch DB → 확인 후 새 세션, 상태 바 0으로 초기화 ④ 상단 DB 표시·탭·하단 상태 바가 목업 5.1~5.2 구조와 일치 ⑤ 390px 폭에서 가로 스크롤 없음 ⑥ 콘솔 오류 없음 |
| 검증 | 서버 + Vite dev 서버를 띄워 브라우저로 확인, 목업과 나란히 비교. `npm run typecheck` |
| 커밋 제안 | `feat: Add client scaffold and theme` / `feat: Add start screen and app shell` |

### M6. 클라이언트 퀴즈 흐름 (L)
| 구분 | 내용 |
|------|------|
| 산출물 | `IdlePanel`, `QuestionPanel`, `FeedbackPanel`, `Done3Dialog`, `ResultPanel`, `EmptyPoolNotice`, `AllDoneNotice`, 퀴즈 상태 훅 |
| 완료 기준 | ① Latin은 "Word → Meaning"만 활성, 나머지 라디오 비활성 ② 라운드 번호·출제 가능 수 표시 ③ Enter/Submit 제출 → 입력창 아래 정답과 판정 배지(Perfect / Partial / Wrong) 표시 ④ 정답 줄은 묶음마다 색 + ✓/✗ ⑤ Mark done은 Wrong이면 비활성 ⑥ 제출 후 Next 버튼에 포커스가 가서 Enter로 다음 문제 ⑦ 3회 연속 Perfect에서 확인창, Yes면 완료·No면 유지 ⑧ 라운드 종료 화면(`N of M correct`, 정답률) ⑨ 새로고침해도 진행 중이던 라운드가 이어짐 ⑩ pool 없음·전 단어 완료 안내 ⑪ 입력창에 `autoCapitalize`·`autoCorrect` 끔, 표제어 `lang="la"` ⑫ 상태 바가 제출마다 갱신 |
| 검증 | 브라우저 수동 시나리오(실제 샘플 import 후): 부분 정답, 오답, 괄호 정답, 3회 연속 Perfect, 새로고침. 390px 폭 확인. `npm run typecheck` |
| 커밋 제안 | `feat: Add quiz start and question panels` / `feat: Add answer feedback and done confirmation` / `feat: Add round result and empty states` |

### M7. 클라이언트 오답 · 단어 관리 · 설정 (M)
| 구분 | 내용 |
|------|------|
| 산출물 | `WrongPage`, `WordsPage`(+ `WordTable`, 행 편집), `SettingsPage` |
| 완료 기준 | ① 오답 목록은 완료 단어를 제외하고, Retest wrong only가 재시험 라운드를 시작(배너 표시) ② 단어 관리: 검색(대소문자·움라우트 무시), 뜻 수정(`\|`로 묶음, 쉼표로 동의어), 중복 표제어는 오류 메시지, 완료 체크 변경이 즉시 반영, 오답 배지 표시 ③ 수정한 뜻이 다음 채점에 즉시 반영 ④ 설정: 라운드당 문제 수 1~200 저장, 재시작 후 유지 ⑤ 노트는 화면에 나오지 않음 |
| 검증 | 브라우저 수동 확인, **목업 5.5~5.7과 대조**, PC·390px. 끝나면 **전체 UI 컨펌**을 받는다 |
| 커밋 제안 | `feat: Add wrong words page` / `feat: Add words management page` / `feat: Add settings page` |

### M8. 번들 · 패키징 · 배포 (M)
| 구분 | 내용 |
|------|------|
| 산출물 | `scripts/build.mjs` 완성(Vite + esbuild + `createRequire` 배너), `package`(zip, `fflate`), `deploy`(`DEPLOY_DIR`, 기본 `/mnt/c/WordQuiz`; **`data/`·`reports/` 보존**, **`server.lock`이 있으면 중단·`--force`로 진행**), `release/start.bat`, `release/import.bat`(**CRLF, BOM 없는 UTF-8**로 기록) |
| 완료 기준 | ① `npm run build` 후 `dist/`에 `server.mjs`, `import.mjs`, `public/` ② `npm run package`가 zip을 만들고 **`node_modules` 없는 임시 디렉터리에 풀어 서버 기동·`GET /api/databases` 응답까지 확인하는 스모크**를 통과 ③ `deploy`를 두 번 실행해도 `data/`의 DB와 `reports/`가 그대로 ④ `start.bat`에 `chcp 65001`, Node 버전 검사(22.13 미만이면 안내 후 종료), 마지막 `pause` ⑤ 버전 검사 스니펫이 `22.12.0`은 거부하고 `22.13.0`, `24.14.0`은 통과(스니펫만 단위 실행) ⑥ 배포된 `start.bat`, `import.bat`의 **모든 줄이 CRLF**이고 BOM이 없다(`grep -c` 등으로 확인) ⑦ `server.lock`이 있으면 `deploy`가 중단되고 `--force`를 주면 진행 |
| 검증 | `npm run build && npm run package`, 스모크 스크립트, `deploy` 후 파일 목록 비교 |
| 커밋 제안 | `feat: Add production build` / `feat: Add package and deploy scripts` / `feat: Add start.bat launcher` |

### M9. 최종 검증 · 문서 (M)
| 구분 | 내용 |
|------|------|
| 산출물 | Windows 자동 검증 스크립트 실행 결과, 수동 체크리스트 결과 기록, **PRD 요구사항 추적표 확정**(4장), `README.md` |
| 완료 기준 | ① 3장의 **자동 검증** 전 항목 통과 ② 3장의 **수동 체크리스트**를 사용자가 수행하고 결과를 기록 ③ 추적표에 미구현·미검증 항목 없음 ④ `README.md`에 설치(zip 풀기), 첫 실행, import 흐름(검증 → 수정 → `--apply`), 백업 위치, 방화벽 안내, 문제 해결이 있다 |
| 배포 | 사용자가 승인하면 실제 `C:\WordQuiz`에 배포한다. 이때도 기존 `data\`는 보존한다 |
| 커밋 제안 | `docs: Add README` / `docs: Add requirements traceability` |

---

## 3. Windows 검증 계획

### 3.1 환경 사실 (2026-09-20 확인)
| 항목 | 값 |
|------|----|
| WSL에서 실행 가능한 Windows Node | `/mnt/d/tools/nodejs/node.exe`, **v24.14.0**, `node:sqlite` 동작(win32, SQLite 3.51.2) |
| Windows 쪽 `curl` | `curl.exe` 사용 가능 |
| WSL의 `curl`로 `localhost` 접속 | **실패**(응답 없음). Windows 호스트 IP(`ip route`의 default 게이트웨이)로는 성공 |
| Windows 프로세스 종료 | `Stop-Process -Force`/`taskkill /F`는 강제 종료라 **Node의 시그널 핸들러가 실행되지 않는다** |
| 경로 변환 | `wslpath -w /mnt/c/WordQuiz-dev` → `C:\WordQuiz-dev` |
| 실행 중인 스크립트 파일 | Windows에서 실행 중인 `.mjs`는 **잠기지 않아 WSL에서 덮어쓰기가 허용**된다 (실행 중 서버는 옛 코드를 메모리에 유지) |
| 열린 SQLite DB 파일 | 삭제·이름 변경은 `Permission denied`로 **차단**, 복사는 **허용** |
| Windows에서 WSL 서버 접속 | `curl.exe http://localhost:<port>`로 WSL 서버에 접속됨 (Windows 브라우저로 Vite dev 서버 확인 가능) |
| Git 줄바꿈 설정 | `.gitattributes`, `core.autocrlf` 모두 없음 → M0에서 `.gitattributes` 추가 |
| `cmd.exe` | UNC 경로(`\\wsl.localhost\...`)를 작업 디렉터리로 쓸 수 없다. `/mnt/c/...`에서 실행해야 한다 |

**한계**: 이 PC의 Windows Node는 24.14이므로 **스펙의 최소 버전 22.13은 여기서 검증할 수 없다.** 사용자 PC의 Node 버전 확인은 수동 항목이다.

### 3.2 자동 검증 (WSL → `node.exe`)
```bash
NODE_WIN=/mnt/d/tools/nodejs/node.exe
DEV=/mnt/c/WordQuiz-dev
DEPLOY_DIR=$DEV npm run deploy
"$NODE_WIN" --disable-warning=ExperimentalWarning "$(wslpath -w $DEV/server.mjs)" --no-open &
curl.exe -s http://localhost:35000/api/databases      # WSL curl 대신 curl.exe
# 정리: 이 스크립트가 띄운 프로세스만 CommandLine으로 찾아 종료한다 (다른 node.exe는 건드리지 않는다)
```

| 항목 | 방법 | 통과 기준 |
|------|------|-----------|
| `node:sqlite` + 번들 실행 | M0, M8에서 배포본을 `node.exe`로 실행 | 서버 응답, xlsx 읽기 성공 |
| 서버 기동·API | `curl.exe`로 세션 시작 → 라운드 → 답 제출 | 200 응답, 판정 일치 |
| 포트 중복 | 같은 포트로 두 번째 `node.exe` 기동 | 안내 메시지 출력 후 종료 코드 확인 |
| 강제 종료 후 복구 | 세션 시작 → `Stop-Process -Force` → 재기동 후 같은 DB 시작 | 이전 세션 `ended_at`이 `last_seen_at`으로 채워짐 |
| UTF-8 | `import.bat`(또는 `cmd.exe /c chcp 65001 ...`)의 출력을 **파일로 리다이렉트**해 바이트 확인 | 장음 기호(`ā ē ī ō ū`)·움라우트가 깨지지 않음 |
| 배포 스크립트 | `deploy` 두 번 실행 | `data/`·`reports/` 보존 |
| 파일 호환 | Windows에서 만든 DB를 WSL에서 **읽기 전용·순차**로 열고, 그 반대도 확인. **같은 DB를 동시에 열지 않는다**(`/mnt/c` 잠금 불안정, TECH-SPEC 8.5) | 양쪽에서 읽힘 |
| 배포 잠금 | 서버 기동(`server.lock` 생성) 후 `deploy` 실행 | 중단 메시지 출력, `--force`로만 진행 |
| 줄바꿈 | 배포된 `.bat` 검사 | 모든 줄 CRLF, BOM 없음 |

### 3.3 수동 체크리스트 (사용자, Windows)
- [ ] `start.bat` 더블클릭 → 콘솔이 뜨고 기본 브라우저에 시작 화면이 열린다
- [ ] 콘솔에서 `node -v`가 22.13 이상인지 확인, 미만이면 `start.bat`이 안내 메시지를 낸다
- [ ] 이미 실행 중일 때 `start.bat`을 다시 실행하면 "이미 실행 중" 안내가 나온다
- [ ] **콘솔 창을 X로 닫은 뒤** 다시 실행하면 이전 세션의 종료 시각이 기록되어 있다(`SIGHUP` 경로)
- [ ] Ctrl+C로 종료해도 종료 시각이 기록된다
- [ ] `import.bat`으로 실제 Excel을 검증 → 수정 → `--apply` 흐름이 되고 리포트가 메모장에서 깨지지 않는다
- [ ] 같은 Wi-Fi의 휴대폰에서 `http://<PC 이름 또는 IP>:35000`으로 접속되고, 최초 방화벽 창에서 허용하면 동작한다
- [ ] 휴대폰에서 입력 시 자동 고침·자동 대문자가 답을 바꾸지 않는다
- [ ] PC와 휴대폰을 번갈아 써도 같은 세션이 이어진다

---

## 4. 요구사항 추적표

### 4.1 PRD 목표
| 목표 | 구현 | 검증 |
|------|------|------|
| G1 Excel → DB 최소 수작업 | M3, M7(단어 관리 확인) | M3 종단 검증 |
| G2 더블클릭 한 번으로 시작 | M8 (`start.bat`) | M9 수동 체크리스트 |
| G3 오답 집중 반복, 완료 단어 제외 | M1(규칙), M4, M6, M7 | M4 다중 라운드 시나리오, M6·M7 수동 |
| G4 학습 이력 저장 | M2(스키마), M4(저장) | M2·M4 테스트 (`round_question`, 일자별 조회) |

### 4.2 PRD 기능 요구사항
| PRD | 내용 | 구현 마일스톤 | 검증 |
|-----|------|---------------|------|
| 3.1 / 4.10 | Excel → DB, 검증 모드, merge, 리포트 | M3 | M3 테스트·종단 검증 |
| 3.2 / 4.9 | 언어·DB 선택, 없는 DB 알림, DB 전환 | M2, M4, M5 | M2·M4 테스트, M5 수동 |
| 3.3 / 4.1 | 라운드 구성, 방향, 종료 화면, pool 안내 | M2, M4, M6 | M4 시나리오, M6 수동 |
| 4.2 | 채점(정규화, 묶음, 괄호, 판정, 색 표시) | M1, M6 | M1 테스트, M6 수동 |
| 4.3 | 단어 상태와 출제 규칙(N+1 / N+2 / N+3, 3회 확인) | M1, M4, M6 | M1·M4 테스트 |
| 3.4 / 4.4 | 오답 목록·재시험, 완료 시 마크 해제 | M4, M7 | M4 시나리오, M7 수동 |
| 4.5 | 완료 표시 버튼 (Wrong이면 비활성) | M4, M6 | M4 테스트, M6 수동 |
| 3.5 / 4.6 | 단어 관리(수정, 완료 체크), 추가·삭제 없음 | M4, M7 | M4 테스트, M7 수동 |
| 3.6 / 4.7 | 설정(라운드당 문제 수, 재시작 후 유지) | M4, M7 | M4 테스트, M7 수동 |
| 4.8 | 상태 바(전체 단어 수, 세션 테스트 / Perfect 정답) | M4, M5 | M4 테스트, M5·M6 수동 |
| 4.11 | 저장 데이터(단어, 진행, 설정, 접속 로그, 라운드, 결과) | M2, M4 | M2·M4 테스트 |
| 5.1~5.7 | 화면 구성(영어 UI) | M5, M6, M7 | 목업 대조, 사용자 컨펌 |
| 5.8 | 모바일 | M5~M7 | 390px 확인, M9 수동(휴대폰) |
| 6 | 배포·실행(`C:\WordQuiz`, `start.bat`, 35000, 압축, UTF-8, 콘솔 종료 기록) | M0, M4, M8, M9 | 3장 자동·수동 검증 |
| 7 | 간편성, 로컬 전용, 반응형, 데이터 보존, 언어 확장성 | M8 / M4(Host 검사) / M5~M7 / M2 / M2(`meta.language`, 방향 컬럼) | 각 마일스톤 |

### 4.3 기술 스펙 장별
| TECH-SPEC | 내용 | 마일스톤 |
|-----------|------|----------|
| 2 | 스택·빌드 | M0, M8 |
| 3 | DB 설계 | M2 (세션 생명주기는 M4) |
| 4 | 도메인 규칙 | M1 |
| 5 | HTTP API | M4 |
| 6 | Import CLI | M3 |
| 7 | 프런트엔드 | M5, M6, M7 |
| 8 | 실행·배포 | M4(진입점), M8, M9 |
| 9 | 보안 | M4 |
| 10 | 테스트 전략 | 전 마일스톤, Windows 항목은 3장 |
| 11 | 위험 요소 | 5장 |

---

## 5. 위험과 롤백

| 위험 | 조기 발견 | 대응 |
|------|-----------|------|
| `read-excel-file`이 esbuild 번들에서 실패하거나 버전에 따라 API가 다름 | M0 | 버전 고정. 실패 시 `fflate` + 최소 XML 파서로 교체(접근이 `cli/xlsx.ts` 한 곳) |
| Windows에서 `node:sqlite` 또는 번들 실행 실패 | M0 | `db/` 모듈만 교체 가능하게 격리(스펙 11장). 판단이 서기 전에는 M1 이후로 진행하지 않는다 |
| 최소 버전 22.13에서 동작이 다름 | M9 수동 | 버전 검사가 안내 메시지를 내므로 사용자 PC에서 확인. 문제가 있으면 최소 버전을 올려 스펙에 반영 |
| 구현 화면이 목업과 달라짐 | M5, M7 | 목업 대조 후 컨펌. 의도한 변경은 PRD 5장과 목업을 함께 갱신 |
| 채점 결과가 실제 데이터에서 예상과 다름 | M1, M3 | 문제 행을 픽스처로 추가하고 M3 종단 검증에서 전체 178행으로 재확인 |
| Windows 콘솔 창 닫기 시 종료 시각이 남지 않음 | M9 수동 | `last_seen_at` 보정이 안전망(자동 검증됨). 핸들러가 안 도는 경우 스펙 3.5를 보완 |
| 테스트가 종료되지 않은 `node.exe`를 남김 | M0 | 자동 검증 스크립트가 **자신이 띄운 프로세스만** `CommandLine`으로 찾아 종료하고, 종료 후 포트가 닫혔는지 확인 |
| `.bat` 줄바꿈·대소문자 이름·열린 DB 삭제 불가 등 OS 차이 | M0, M8 | TECH-SPEC 8.5의 규칙을 완료 기준에 넣어 자동 검증한다(줄바꿈, 이름 판정, deploy 잠금) |
| 샘플 xlsx가 사라짐 | 상시 | 테스트가 의존하지 않도록 원칙 5 적용. 종단 검증 전에만 존재 확인 |

---

## 6. 열려 있는 항목

구현 시작 전에 사용자가 정해 주면 좋은 것들이다. 기본값이 있어 정하지 않아도 진행할 수 있다.

| 항목 | 기본값 | 정할 시점 |
|------|--------|-----------|
| `data/` 폴더 정책 | **결정됨: untracked 유지**, `.gitignore`에도 넣지 않는다 | 완료 |
| 개발 중 Windows 검증 위치 | `C:\WordQuiz-dev` (사용자 데이터와 분리) | M0 |
| 실제 `C:\WordQuiz` 배포 시점 | M9에서 사용자 승인 후 | M9 |
| 사용자 PC의 Node 버전 | 22.13 이상으로 가정(사용자 확인) | M9 |
