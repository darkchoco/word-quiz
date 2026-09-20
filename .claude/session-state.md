# Session State — Word Quiz

## 1. 날짜 / 주제
- 저장일: 2026-09-20 (작업 진행: 2026-09-18 ~ 09-20)
- 주제: PRD v1.3 · UI 목업(영어 UI) · 기술 스펙 v1.1 · 실행 계획 v1.1(리뷰 대기). 문서 단계 완료 → 다음은 **M0(프로젝트 골격 + Windows 스모크) 시작**

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
- [ ] 구현은 시작하지 않음. 저장소에 코드가 아직 없음

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
- **WSL `curl`로 Windows 서버 접속**: `localhost`로는 안 됨. `curl.exe` 사용
- **WSL에 `python3` 없음**: xlsx 분석은 `unzip` + node로 함
- **`data/latin_wortschatz.xlsx`가 한 번 사라졌었음**(원인 불명, 사용자가 다시 복사). 구현·테스트가 이 파일에 의존하면 안 됨. 테스트 픽스처는 저장소 안에 별도로 둘 것 (TECH-SPEC 10장)

## 5. 다음 세션 시작 시 할 일
1. `docs/EXECUTION-PLAN.md`를 읽고 사용자 리뷰 결과를 확인한다. 수정 요청이 있으면 반영 후 커밋(문서는 **한글**)
2. 리뷰가 끝나면 **M0**부터 구현한다. 마일스톤마다 plan mode → 구현 → `npm run typecheck` → 단일 테스트 → 커밋 메시지 사전 확인 → 커밋 순서(EXECUTION-PLAN 1장). 개발 중 Windows 검증은 `C:\WordQuiz-dev`에서 한다(사용자 승인 완료, 실제 `C:\WordQuiz`는 M9에서 승인 후에만). **구현 시작 시 UI는 이미 컨펌됨**(목업 기준), 단 구현 중 화면 변경이 생기면 다시 컨펌
3. **Windows 자동 검증 시 주의**: WSL의 `curl`은 Windows `localhost`에 닿지 않으므로 `curl.exe`를 쓴다. `Stop-Process -Force`는 시그널 핸들러를 실행하지 않아 `SIGTERM` 정상 종료는 자동 검증 불가(대신 강제 종료 후 재기동 시 `last_seen_at` 보정을 검증). 테스트로 띄운 `node.exe`는 `CommandLine`으로 **자기가 띄운 것만** 종료할 것. `cmd.exe`는 UNC 경로에서 실행 불가라 `/mnt/c/...`에서 실행. 이 PC는 Node 24.14라 최소 버전 22.13은 검증 불가
4. 알아둘 것: xlsx 라이브러리 `read-excel-file`은 9.3.10으로 스파이크했음. 버전 고정할 것. 스파이크 코드는 스크래치패드에만 있어 사라졌음(TECH-SPEC 14장에 결과만 있음)

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
- (참고) Artifact 링크 https://claude.ai/artifact/Gqn1G2DA4wXmBB4dsMrf6E — 옛 한국어 UI 버전, 사용자가 열지 못함. 기준 아님
