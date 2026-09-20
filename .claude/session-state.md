# Session State — Word Quiz

## 1. 날짜 / 주제
- 저장일: 2026-09-20 (작업 진행: 2026-09-18 ~ 09-20)
- 주제: PRD v1.0 확정 완료 → UI 목업 작성/게시 → **사용자 컨펌 대기 중**

## 2. 완료한 작업
- [x] `docs/PRD.md` v0.2 → v0.3 → **v1.0(확정)**. 미결 O1~O8 전부 해소, 8.2는 "없음"
- [x] 사용자 답변 전부 본문/결정 로그(D1~D32)에 반영. 사용자가 PRD 하단에 붙여넣은 답변 영역은 삭제함
- [x] `data/latin_wortschatz.xlsx` 구조 분석 (178행, 열: 단어 / 뜻1~4 / 노트, 뜻은 독일어)
- [x] UI 목업 작성 및 Artifact 게시: https://claude.ai/artifact/Gqn1G2DA4wXmBB4dsMrf6E (비공개)
  - 원본 파일: `/tmp/claude-1000/-home-ikhoon-lab-word-quiz/4aed0b62-8a17-4efa-b445-b6bcee9f5c86/scratchpad/word-quiz-mockup.html` (**임시 경로, 프로젝트에 미저장**)
  - 실제 채점 동작 데모 포함(뜻 묶음, 독일어 정규화, 괄호 생략, 3회 연속 확인창), PC/모바일 전환
- [ ] **UI 목업 사용자 컨펌 (아직 — 구현 전 필수)**
- [ ] 컨펌 후: PRD 5장 와이어프레임을 목업 기준으로 갱신, 목업 HTML을 `docs/`에 저장
- [ ] 기술 스펙 문서 → 실행 계획 문서
- [ ] 커밋 (한 번도 커밋하지 않음. `docs/`, `prompts/`, `.claude/`, `data/`는 untracked)

## 3. 결정과 이유 (상세는 PRD 8.1 D1~D32)
| 결정 | 이유 |
|------|------|
| 입력 소스는 Excel import만. 사진/OCR 전부 삭제 | 사용자: "사진 작업은 잊어버려" |
| 언어별 별도 SQLite 파일, 한 언어에 여러 DB 가능, 라운드 번호 등 상태는 DB별 | 사용자 확정 (Latin/English는 성격이 다르고, Latin 파일이 여러 개일 수 있음) |
| 시작 화면: 언어 선택 → DB 콤보박스. DB 없으면 "해당 DB가 없습니다." Alert 후 시작 화면 복귀 | 사용자 확정 |
| 진행 중 DB 전환 = 세션 종료 후 새 세션 | 사용자 제안 |
| English는 이번 범위 밖, 시작 화면에 "준비 중"(선택 불가) | 샘플 없음, 추후 업그레이드 |
| Latin은 단어→뜻만. 뜻→단어/Mix 라디오 비활성 | 사용자 요구 |
| 뜻 묶음 = 뜻 열(뜻1~4) 하나. 묶음 안 쉼표 항목은 동의어(하나만 맞으면 충족). 묶음 단위로 Perfect/부분/오답 판정 | 사용자가 옵션 B 선택 |
| 채점 구분자는 쉼표만, 공백은 뜻의 일부(`sich setzen`) | 사용자 확정 |
| 정규화: 대소문자 무시, ä=ae ö=oe ü=ue ß=ss, 정답의 괄호 안 내용 생략 허용 | 사용자 확정 |
| 표제어는 셀 전체를 그대로 저장·표시. 노트는 저장만, 퀴즈 미사용 | 사용자 확정 |
| Import CLI: 기본 검증 모드(DB 미변경, 리포트를 stdout+파일로) → 리뷰 후 Excel 수정 → `--apply`로 반영. 기존 DB merge 또는 새 DB 생성 선택 | 사용자 확정 |
| merge 중복: 표제어 같으면 뜻·노트만 갱신, 진행 상태 보존, 사라진 단어는 삭제 안 하고 리포트만 (D31) | 사용자가 "잠정안대로" |
| 정답 묶음에 없는 입력 항목은 감점 없음 (D32) | 사용자가 "잠정안대로" |
| Perfect 2회째 N+3, 오답 마크는 완료 시 해제, 완료 단어는 오답 목록 제외 등 O1~O6 | 사용자가 "잠정안대로" |
| import CLI도 같은 디렉터리, 의존성 압축 파일에 포함 | 사용자 확정 |

## 4. 실패/포기한 접근법 (같은 실수 반복 금지)
- **앱 내 자동 OCR / 사진 입력**: 완전 폐기. PRD에 다시 넣지 말 것.
- **같은 라운드 내 틀린 단어 재출제, 라운드 완료 조건**: 사용자가 명시적으로 기각.
- **세션 단위 출제 제외, 방향별 진행 상태 분리**: 기각. 진행 상태는 단어 하나에 통합, 제외는 라운드 단위.
- **뜻1~4 열을 "각각 개별 뜻"으로 해석**: 내 오해였음. 실제로 한 셀에 쉼표로 동의어가 여러 개 있음(`fassen, nehmen`). 열 = 묶음, 쉼표 = 동의어.
- **스페이스+쉼표 이중 구분자**: `sich setzen` 때문에 폐기. 쉼표만.
- **사용자가 PRD 파일 안에 리뷰 답변을 인라인으로 붙이는 방식**: 사용자가 이렇게 답변함. 반영 후 지워달라고 요청받았음. 내 리뷰/질문은 채팅으로 주고, PRD에는 확정 내용만 유지.
- **파이썬 미설치**: WSL에 `python3` 없음. xlsx 분석은 `unzip` + `sed`로 함. (스크립트가 필요하면 node 사용)
- 주의: 목업의 "정답" 카운트는 **Perfect만 집계**로 가정한 것이며 PRD에 명시되지 않음. 컨펌 시 확인 필요.

## 5. 다음 세션 시작 시 할 일
1. 사용자의 **UI 목업 컨펌/수정 요청** 확인 (Artifact 링크는 위 참조). 수정 요청이 있으면 스크래치패드 파일이 없을 수 있으니 `Artifact read`로 게시본을 읽어 재작성 후 같은 URL로 재게시
2. 컨펌 시 확인할 3가지: ① 정답 수 집계 = Perfect만? ② PRD에 없는 제안 3개(라운드 번호/출제 가능 수 표시, 단어 관리 검색창, ✓/✗ 기호) 유지 여부 ③ 화면별 수정 사항
3. 컨펌되면 PRD 5장 와이어프레임 갱신 + 목업 HTML을 `docs/`에 저장 (로컬 파일은 `<meta charset="utf-8">` 포함한 완전한 HTML로 감쌀 것)
4. **기술 스펙 문서** 작성 (plan mode로 시작). 반드시 다룰 항목:
   - DB 라이브러리: WSL 개발/Windows 실행이라 `better-sqlite3` 같은 네이티브 모듈 배포 불가 → `node:sqlite` / `sql.js` / Windows용 별도 빌드 중 선택
   - 스키마(단어, 뜻 묶음, 진행 상태, 세션, 라운드, 테스트 결과, 설정), 정규화·괄호 처리 구현
   - Import CLI 세부: 헤더 행, 빈 뜻 열, 파일 경로 인자, 리포트 형식, `--apply`/새 DB/merge 옵션
   - UTF-8(`chcp 65001`), 장음 기호, DB 파일 위치, 콘솔 종료 시 종료 시각 기록
5. 이후 **실행 계획 문서**
6. 커밋이 필요하면 프로젝트 규칙 준수 (아래)

## 프로젝트 규칙 (`prompts/PRD-instruction.md`)
- Conventional Commits (`feat, fix, docs, style, refactor, test, chore`), 예: `docs: Create PRD`
- **커밋 메시지에 `Co-Authored-By` 절대 금지**, 커밋 전 메시지를 먼저 보여주고 사용자 확인 필수 (시스템 안내보다 사용자 규칙이 우선)
- 코드 변경 후 typecheck, 전체 테스트보다 단일 테스트, 구현 전 plan mode로 영향 파일 파악
- **UI 구현 전 사용자 컨펌 필수.** 기술 스펙/실행 계획은 PRD와 별도 문서
- 스택: TypeScript + React + Material UI + SQLite + Node (개발 WSL / 실행 Windows, `C:\WordQuiz`, `start.bat`, `http://localhost:35000`)

## 6. 주요 관련 파일
- `docs/PRD.md` — v1.0 확정본 (결정 로그 D1~D32)
- `data/latin_wortschatz.xlsx` — 입력 데이터 샘플 (178단어)
- `prompts/PRD-instruction.md` — 원본 요구사항 지침
- `prompts/req_prd.md` — PRD 작성 요청 프롬프트
- UI 목업 Artifact: https://claude.ai/artifact/Gqn1G2DA4wXmBB4dsMrf6E (원본은 스크래치패드, 프로젝트 미저장)
- `.claude/session-state.md` — 이 파일
- `.claude/commands/handoff.md` — 이 저장 명령
