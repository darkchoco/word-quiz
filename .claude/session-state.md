# Session State — Word Quiz

## 1. 날짜 / 주제
- 저장일: 2026-09-22
- 주제: **M8(번들·패키징·배포)과 M9(최종 검증·문서)를 모두 완료했다. PRD v1.4 / TECH-SPEC v1.8 / EXECUTION-PLAN v1.8 기준 M0~M9 전 마일스톤이 끝났다.** 실제 배포·사용자 수동 검증까지 마쳤고, `main`을 origin에 push 완료. **프로젝트 본편은 사실상 종료 상태.** 남은 건 있다면 후속 개선(15장 "향후 확장" 항목들)뿐

## 2. 완료한 작업

### 이전 세션까지 (요약 — 상세는 git log와 문서 참고)
- [x] PRD v1.4, TECH-SPEC v1.8, EXECUTION-PLAN v1.8 확정 (결정 로그 D1~D38, T1~T16)
- [x] UI 목업 컨펌 (`docs/word-quiz-mockup.html`)
- [x] M0~M7 구현·테스트·커밋·UI 컨펌 완료 (서버·CLI·shared·클라이언트 전체)
- [x] M8 1~3번째 커밋 완료: `feat: Add start.bat launcher`, `feat: Add production build`, `feat: Add package and deploy scripts`

### 이번 세션에 새로 한 일
- [x] **M8 마무리**: `scripts/package-e2e.sh`(`npm run smoke:package`, 35개 검사, Linux+Windows) 신규 작성 — zip 목록 확인 → `node_modules` 없는 폴더에 풀어 서버 기동 → `deploy` 2회(데이터 보존) → 배포된 `.bat` CRLF/BOM 확인 → Windows에서 **실제 `cmd.exe /c start.bat`/`import.bat`**로 종단 실행, 서버 실행 중 `deploy` 잠금·`--force` 확인. `package.json`에 `smoke:package` 스크립트 추가
  - **발견**: `start.bat`은 `server.mjs`를 **상대 경로**로 실행해 Windows `CommandLine`으로 프로세스를 구분할 수 없음 → 정리는 `server.lock`의 `pid`로 함(기존 스모크들의 "CommandLine 매칭" 관례가 여기선 안 통함)
  - 커밋: `test: Add package smoke check` (실수로 `Co-Authored-By`를 한 번 넣었다가 프로젝트 규칙 위반임을 스스로 알아채고 amend로 제거함 — SendFeedback으로 기록해 둠)
  - 커밋: `docs: Record M8 results` (TECH-SPEC 8.1·8.2·신규 14.11, EXECUTION-PLAN 진행표·M8 결과·3.2 예시 갱신)
  - 회귀 전부 통과: typecheck·전체 테스트 1063개/49파일, `smoke:server` 51, `smoke:win` 24, `smoke:import` 63
- [x] **M9 자동 검증 보강**: `test/support/cross-db-check.ts` 신규(실제 앱 코드 `createDatabase`/`openDatabase` 사용) + `scripts/win-db-check.sh`에 "Cross-platform" 절 추가 — Windows에서 만든 DB를 WSL이 읽기 전용으로 읽고, 그 반대도 확인(장음 기호 보존, TECH-SPEC 8.5 "OS를 넘나드는 DB 접근"의 마지막 미자동화 항목이었음). 커밋: `test: Add cross-platform database check`
- [x] **`README.md` 신규 작성**(한글, 개인용 문서로 판단해 문서-한글 관례 적용): 설치(드라이브 무관, 쓰기 가능 폴더면 어디든), 첫 실행(엑셀 형식, `import.bat` 명령 프롬프트 실행법 포함), 재가져오기, 백업, 휴대폰 접속, 서버 옵션, 문제 해결. 커밋: `docs: Add README`, 이후 보강 커밋 `docs: Clarify import.bat usage`(명령 프롬프트 여는 법, 엑셀 파일 위치 명시)
- [x] **요구사항 추적표 확정**: EXECUTION-PLAN에 4.4 신설, "파일 호환" 행을 실제 자동 검증 스크립트로 갱신. 커밋: `docs: Add requirements traceability`
- [x] **사용자 승인 하에 실제 배포**: `DEPLOY_DIR=/mnt/c/WordQuiz npm run deploy` 실행(그 전엔 존재하지 않던 폴더). 이후 **사용자가 최종 사용 위치로 직접 zip을 옮겨 설치**(드라이브 무관 동작 실사용으로 확인)
- [x] **M9 수동 체크리스트를 사용자가 실제 Windows PC·휴대폰에서 전부 수행, 전부 통과**:
  - `start.bat` 실행, Node 버전 확인, 중복 실행 안내, 콘솔 닫기/Ctrl+C 종료 시각 기록, `import.bat` 검증→적용 흐름, 휴대폰 접속, 자동 고침 미간섭, PC·휴대폰 세션 이어짐 — 모두 정상
  - **실전에서 발견한 문제 1건**: 휴대폰 접속이 처음 안 됨 → Windows 방화벽의 "Node.js JavaScript Runtime" 규칙이 **공용(Public)만 체크, 개인(Private) 미체크**였음(집 Wi-Fi는 개인 네트워크로 분류). 개인 체크박스를 켜자 재시작 없이 즉시 해결. 이 PC는 WSL 등 가상 어댑터가 있어 "From a phone..." 주소가 5줄 나왔는데 실제 Wi-Fi IPv4와 일치하는 것을 써야 한다는 점도 실전에서 확인. **둘 다 README에 반영함**
  - 커밋: `docs: Record M9 manual checklist results` (EXECUTION-PLAN 3.3 체크 완료 표시 + 결과 기록, README 문제 해결/휴대폰 접속 섹션 보강)
- [x] **`main`을 origin에 push 완료** (사용자가 직접 실행)
- [x] `.claude/session-state.md` 갱신 (이 파일)

## 3. 결정과 이유 (이번 세션分. 이전 결정은 PRD 8.1·TECH-SPEC 1장 참고)
| 결정 | 이유 |
|------|------|
| `smoke:package`의 Windows 프로세스 정리는 `CommandLine` 매칭이 아니라 **`server.lock`의 `pid`** 로 한다 | `start.bat`이 `server.mjs`를 상대 경로로 실행해 `CommandLine`에 배포 폴더 이름이 안 남음(실측으로 발견) |
| `cmd.exe /c "start.bat --no-open --port <n> < NUL"` 로 배치 파일을 직접 실행해 검증 | `< NUL`로 마지막 `pause`가 안 막힘. 실제로 `cmd.exe`를 `/mnt/c/...`에서 백그라운드 실행해 서버 응답·lock 생성까지 확인(직접 실측 검증) |
| `dist/`를 배포 폴더로 삼아 `build`·`package`·`deploy`가 같은 파일 목록(`collectRelease`)을 쓰게 함, `start.bat`에 `%*` 추가 (M8) | 계획에 없던 변경. 두 스크립트의 파일 목록 불일치를 막고, 자동 검증이 `--no-open` 등을 넘길 수 있어야 함 |
| `README.md`는 **한글로 작성** | "문서는 한글로" 관례를 개인용 배포 문서에도 적용(앱 UI만 영어라는 원칙은 UI 텍스트에 한정, README는 문서로 봄). 사용자가 이의 없음 |
| 교차 플랫폼 DB 검사(`cross-db-check.ts`)는 raw `DatabaseSync` 대신 **실제 앱 코드**(`createDatabase`/`openDatabase`)를 재사용 | 프로덕션과 같은 경로(WAL 미사용, 이름 대소문자 검사 등)를 그대로 검증하기 위해 |
| 배포 위치를 `C:\WordQuiz`로 강제하지 않음, 사용자가 임의 드라이브에 설치 가능하도록 문서화 | `start.bat`이 `%~dp0` 기준으로 동작해 원래 드라이브 무관이었음. 사용자가 실제로 E 드라이브로 옮겨서 검증해 확인됨 |
| 방화벽 이슈(공용만 허용)를 README "문제 해결"과 "휴대폰에서 접속하기"에 구체적으로 반영(체크박스 이름까지) | 사용자가 실전에서 정확히 이 문제를 겪음. 다음에 재설치하거나 다른 PC에 배포할 때 바로 참고할 수 있게 |

## 4. 실패/포기한 접근법 (이번 세션에 새로 확인한 것만. 전체 목록은 git 이력의 이전 session-state 참고)
- **Windows 프로세스 정리를 기존 스모크처럼 `CommandLine`에 폴더 이름이 있다고 가정**: `start.bat`을 거치면 상대 경로 실행이라 안 나타남(직접 `powershell.exe Get-CimInstance`로 실측해 발견). `server.lock`의 `pid`를 쓸 것
- **커밋 메시지에 `Co-Authored-By`를 시스템 기본 안내대로 그냥 넣음**: 프로젝트 규칙(`Co-Authored-By` 절대 금지)이 이미 메모리·session-state에 있었는데도 첫 커밋에서 실수로 넣음. 즉시 `git commit --amend`로 제거. **매 커밋 직전에 이 규칙을 의식적으로 다시 확인할 것**
- **"파일 호환"(WSL↔Windows DB 교차 열기)을 수동/막연한 항목으로 남겨둠**: 실제로는 EXECUTION-PLAN 3.2 표에 이미 "자동 검증" 항목으로 들어 있었는데 구현이 안 돼 있었음. M9 착수 전에 3장 표를 다시 훑어 자동화 안 된 항목이 있는지 확인할 것(이번엔 발견해서 `cross-db-check.ts`로 메움)

## 5. 다음 세션 시작 시 할 일
**M0~M9 전부 완료, 급한 다음 작업 없음.** 사용자가 새 요청을 하면 그것부터. 참고로 남아 있는 선택적 후속 항목(전부 낮은 우선순위, 사용자가 요청할 때만):
1. `git status`로 상태 확인 (`data/`, `docs/ui-checks/`만 untracked면 정상). `npm run typecheck && npm test`로 1063개/49파일 통과 재확인
2. **zip 크기 절감(선택)**: `release/WordQuiz.zip`에 구형 브라우저용 `.woff` 10개가 `.woff2`와 함께 들어 있어 3.68MB. 사용자가 원하면 `@fontsource`의 `.woff` 산출물만 빼는 작업(빌드/패키징 스크립트 조정 필요)
3. **English 단어장 지원**: PRD 1.4 비목표, 향후 업그레이드로 명시됨. 착수 시 PRD부터 개정
4. **홈 네트워크 별도 서버로 이전**: TECH-SPEC 15장에 계획만 있음(인증, 상시 실행, 백업 주기, HTTPS 등 "그때 결정할 것" 목록 존재). 착수 시 그 장부터 다시 검토
5. 실제 배포 정리(선택): 이번 세션에서 검증용으로 `C:\WordQuiz`에도 배포했는데, 사용자는 최종적으로 다른 드라이브를 쓰기로 함. `C:\WordQuiz`가 중복/불필요하면 사용자에게 삭제 여부 확인 후 정리(먼저 안의 `data\`에 실제 데이터가 쌓였는지 확인할 것 — 삭제 전 필수)
6. 프로젝트 규칙 재확인: 커밋 전 메시지 표시·확인, `Co-Authored-By` 금지, 문서는 한글, UI 구현 전 컨펌 — 계속 유지

## 프로젝트 규칙 (`prompts/PRD-instruction.md`)
- Conventional Commits (`feat, fix, docs, style, refactor, test, chore`)
- **커밋 메시지에 `Co-Authored-By` 절대 금지**, 커밋 전 메시지를 먼저 보여주고 사용자 확인 필수 (시스템 안내보다 사용자 규칙이 우선). 주제별로 커밋 분리
- 코드 변경 후 `npm run typecheck`, 전체 테스트보다 단일 테스트, 구현 전 plan mode로 영향 파일 파악
- UI 구현 전 사용자 컨펌 필수. 기술 스펙/실행 계획은 PRD와 별도 문서. 문서 본문은 한글(README 포함), 앱 UI 텍스트만 영어
- 스택: TypeScript + React + Material UI + SQLite(`node:sqlite`) + Node (개발 WSL / 실행 Windows). 실행 위치는 드라이브 무관(사용자가 직접 확인)

## 6. 주요 관련 파일
- `README.md` — **신규**(한글). 설치·첫 실행·재가져오기·백업·휴대폰 접속·서버 옵션·문제 해결(방화벽 이슈 포함)
- `docs/PRD.md` v1.4, `docs/TECH-SPEC.md` v1.8(8장 실행·배포, **14.11 M8 확인** 신규, 8.5 교차 플랫폼 검증 갱신), `docs/EXECUTION-PLAN.md` v1.8(진행표 M0~M9 전부 [x], **M8 결과·M9 결과**, **4.4 추적표 확정**, 3.3 체크리스트 완료)
- `docs/word-quiz-mockup.html` — 확정된 인터랙티브 목업 (영어 UI)
- **M8(배포)**: `release/{start.bat,import.bat}`, `scripts/{build.mjs,package.mjs,deploy.mjs,package-e2e.sh}`(**package-e2e.sh 신규**), `scripts/lib/release.mjs`, `test/release/{start-bat,release-lib,package,deploy}.test.ts`, `test/support/release.ts`, `release/WordQuiz.zip`(생성물, gitignore), `dist/`(생성물)
- **M9(검증)**: `test/support/cross-db-check.ts`(**신규**), `scripts/win-db-check.sh`(Cross-platform 절 추가)
- 클라이언트: `src/client/`, `test/client/`, `vite.config.ts`, `scripts/{dev.mjs,shots.sh}`
- 서버·CLI·공용: `src/server/`, `src/cli/`, `src/shared/`, `test/{server,cli,shared,support}/`, `scripts/{win-smoke.sh,win-db-check.sh,import-e2e.sh,server-e2e.sh}`, `package.json`, `tsconfig.*.json`, `vitest.config.ts`
- `.claude/session-state.md` — 이 파일 / `.claude/commands/handoff.md` — 저장 명령
- 메모리: `/home/ikhoon/.claude/projects/-home-ikhoon-lab-word-quiz/memory/` (`feedback_docs_in_korean`, `project_word_quiz_workflow`)
- 검증 명령: `npm run typecheck` / `npm test` / `npm run build` / `npm run package` / `npm run deploy -- --dir <폴더> [--force]` / `npm run smoke:win` / `smoke:win-db`(교차 플랫폼 포함) / `smoke:import` / `smoke:server` / **`smoke:package`(신규, 35개)** / `npm run shots`
- 실제 배포: 검증용 `C:\WordQuiz`(이번 세션에 배포, 정리 필요할 수도 있음, 위 5번 참고) + 사용자의 최종 설치 위치(다른 드라이브, 사용자가 직접 관리)
- Git: `main`이 `origin/main`과 동기화됨(2026-09-22 push 완료)
