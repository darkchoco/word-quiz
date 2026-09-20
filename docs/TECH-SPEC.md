# Word Quiz 기술 스펙

> 상태: v1.4 (확정) · 작성일: 2026-09-20 · 최종 수정: 2026-09-20  
> 기준 문서: `docs/PRD.md` v1.3, `docs/word-quiz-mockup.html`(영어 UI, 컨펌 완료)  
> 범위: **어떻게 만드는가**. 제품 요구사항은 PRD가, 작업 순서는 별도 실행 계획 문서가 다룬다.

---

## 1. 결정 요약

| # | 결정 | 이유 |
|---|------|------|
| T1 | 런타임은 **Node 22.13 이상**, DB는 내장 **`node:sqlite`** | 사용자가 Windows Node가 22.13 이상임을 확인. 네이티브 모듈이 없어 WSL 개발본이 Windows에서 그대로 동작한다 |
| T2 | 서버와 CLI를 esbuild로 **각각 단일 `.mjs` 파일로 번들**, `node_modules`는 배포하지 않는다 | PRD 6장의 "한두 개 파일로 압축" 요구를 자연스럽게 충족. 스파이크로 검증(14장) |
| T3 | 서버 Express 5, 클라이언트 Vite + React + MUI, 라우터 라이브러리 없이 `location.hash` 사용 | 화면이 5개뿐이라 라우터 의존성이 과하다 |
| T4 | **채점은 서버가 한다.** 규칙 코드는 `src/shared`에 두고 클라이언트는 표시만 한다 | 결과 저장·출제 규칙 적용과 한 트랜잭션으로 묶기 위해 |
| T5 | 뜻은 `word.meanings`에 **JSON `string[][]`** 로 저장 | 묶음 단위 채점·수정이 단순하고, 묶음 수가 최대 4개로 작다 |
| T6 | 라운드 시작 시 **문제 목록을 미리 확정**해 저장 | 새로고침해도 라운드를 이어갈 수 있다 |
| T7 | Perfect 3회 이상의 "No" 결과(N+3)를 **제출 시점에 즉시 적용** | "Yes"는 완료 표시 호출 하나로 끝나서 서버가 확인창 상태를 기억할 필요가 없다 |
| T8 | DB 파일은 롤백 저널(기본) 모드, WAL 미사용 | `-wal`/`-shm` 부속 파일이 없어 `.db` 하나를 복사하면 곧 백업이다 |
| T9 | 클라이언트는 DB **이름**만 보내고 서버가 목록과 대조해 검증 | 경로 조작(path traversal) 원천 차단 |
| T10 | 정규화에서 `? ! .`를 무시하고, 정답 변형에 **괄호를 그대로 둔 원형**을 포함 | 스파이크에서 발견한 결함 수정(14장). PRD D36 |
| T11 | 괄호 밖의 쉼표만 구분자 | 실제 데이터에 괄호 안 쉼표가 있음. PRD D35 |
| T12 | `--apply` 전에 DB를 `data/backup/`으로 자동 복사 | merge가 뜻·노트를 덮어쓰므로 되돌릴 수 있게 한다 |
| T13 | DB 이름은 **대소문자를 무시하고 중복 판정** | Windows는 `Latin.db`와 `latin.db`를 같은 파일로 본다. Linux(WSL) 개발본에서만 통과하는 코드를 막는다 |
| T14 | `.bat`은 **CRLF, BOM 없는 UTF-8**로 저장 (`.gitattributes`로 강제) | WSL에서 만든 LF 파일은 `cmd.exe`에서 오작동할 수 있다 |
| T15 | 허용 `Host`를 **설정으로 추가**할 수 있게 한다 (`WORDQUIZ_ALLOWED_HOSTS`, `--allow-host`) | 향후 홈 네트워크 서버의 `nas.local` 같은 점 포함 이름을 허용하기 위해 (15장) |
| T16 | 서버가 `APP_HOME/server.lock`을 만들고 종료 시 지운다. `deploy`는 lock이 있으면 중단한다 | 실행 중 서버는 옛 코드를 메모리에 두므로 새 `public/`과 어긋난다. 파일 기반이라 WSL ↔ Windows에서 그대로 동작한다 |

---

## 2. 스택과 빌드

### 2.1 사용 기술
| 영역 | 선택 | 비고 |
|------|------|------|
| 언어 | TypeScript (strict), ESM | |
| 서버 | Express 5 | `express.static`으로 클라이언트 정적 파일도 서빙 |
| DB | `node:sqlite` (`DatabaseSync`) | 동기 API. 단일 사용자라 동시성 문제가 없고 코드가 단순하다 |
| xlsx 파서 | `read-excel-file` (버전 **정확히 고정**) | 순수 JS. 메이저 버전마다 API가 바뀌었으므로 lockfile과 함께 고정한다 |
| 클라이언트 | React + MUI + Vite | 폰트는 `@fontsource`(EB Garamond, IBM Plex Mono)로 번들해 CDN을 쓰지 않는다 |
| 번들 | esbuild(서버·CLI), Vite(클라이언트) | |
| 테스트 | vitest | 단일 파일 실행 위주 |

**고정 버전 (M0에서 확정, `package-lock.json`으로 재현)**: 전부 `devDependencies`이며 번들에 포함되므로 배포본에는 `node_modules`가 없다. `.npmrc`의 `save-exact=true`로 범위 없이 고정한다.

| 패키지 | 버전 | 비고 |
|--------|------|------|
| `typescript` | 7.0.2 | `tsc -b` 프로젝트 참조와 타입 오류 시 비정상 종료 동작을 확인함 |
| `@types/node` | 22.20.4 | **최신(26)이 아니라 22.x**. 최소 런타임(Node 22.13)보다 새 API를 타입이 허용하는 것을 줄이기 위함 |
| `vitest` | 5.0.1 | `node:sqlite` 로드 확인. `ExperimentalWarning`은 `execArgv`로 억제 |
| `esbuild` | 0.28.2 | |
| `read-excel-file` | 9.3.10 | 번들 성공, 빈 셀은 `null` |

**tsconfig 규칙**: `module: ESNext` + `moduleResolution: Bundler`, `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`. 서버·CLI·클라이언트가 모두 번들되므로 확장자 없는 import를 쓴다(`NodeNext`는 `.ts` 확장자를 강제해 부적합). `package.json`에는 `"type":"module"`이 필수다(없으면 TS1295 오류). `tsconfig.client.json`은 React 도입 시점인 M5에 추가한다.

### 2.2 저장소 구조
```
word-quiz/
├─ docs/                     PRD, 기술 스펙, 목업, 실행 계획
├─ data/                     샘플 Excel (개발용, 커밋 대상 아님)
├─ src/
│  ├─ shared/                서버·클라이언트·CLI 공용 순수 코드
│  │  ├─ grading.ts          splitTop, normalize, variants, grade
│  │  ├─ scheduling.ts       applyResult (streak / next_round 계산)
│  │  ├─ meanings.ts         formatMeanings / parseMeanings (수정 화면용)
│  │  └─ api.ts              요청·응답 타입, 오류 코드
│  ├─ server/
│  │  ├─ index.ts            진입점(포트, 브라우저 열기, 종료 처리)
│  │  ├─ app.ts              Express 앱 조립, 미들웨어
│  │  ├─ routes/             databases, session, rounds, words, settings
│  │  ├─ services/           session, round, words (트랜잭션 단위 로직)
│  │  ├─ errors.ts           AppError, SQLite 제약 오류 변환
│  │  └─ db/                 open, migrations, transaction, names, catalog, sessions, queries
│  ├─ cli/
│  │  ├─ index.ts            인자 파싱, 종료 코드
│  │  ├─ xlsx.ts             시트 읽기, 헤더 매핑
│  │  ├─ validate.ts         행 검증, 오류·경고 수집
│  │  ├─ plan.ts             기존 DB와 비교해 추가·갱신·변경 없음·누락 계산
│  │  └─ report.ts           리포트 문자열 생성
│  └─ client/                main.tsx, api.ts, theme.ts, pages/, components/
├─ test/                     shared / server / cli 테스트, fixtures/
├─ scripts/build.mjs         esbuild + vite + zip
├─ release/                  start.bat, import.bat
└─ package.json, tsconfig.base.json, tsconfig.node.json, tsconfig.client.json
```

### 2.3 npm 스크립트
| 스크립트 | 동작 |
|----------|------|
| `typecheck` | `tsc -b` (node용과 client용 tsconfig를 함께 검사) |
| `test` | `vitest run`. 단일 파일은 `npm test -- grading` 식으로 |
| `dev` | 서버(`tsx watch`)와 Vite dev 서버 동시 실행. Vite가 `/api`를 서버로 프록시 |
| `build` | Vite → `dist/public/`, esbuild → `dist/server.mjs`, `dist/import.mjs` |
| `package` | `dist/`와 `release/*.bat`을 `release/WordQuiz.zip`으로 묶는다 (`fflate`, 별도 `zip` 명령 불필요) |
| `deploy` | `dist/`와 `release/*.bat`을 `/mnt/c/WordQuiz`로 복사. **`data/`, `reports/`는 절대 덮어쓰거나 지우지 않는다.** `server.lock`이 있으면 중단(`--force`로 무시, 8.5) |

### 2.4 번들 규칙
- 서버와 CLI는 `--platform=node --format=esm --target=node22`로 번들한다. `node:sqlite`는 내장 모듈이라 자동으로 external이다.
- 의존성 중 CJS 코드(`graceful-fs`)가 `require`를 쓰므로 **배너로 `createRequire`를 주입**해야 한다. 없으면 실행 시 `Dynamic require of "fs" is not supported` 오류가 난다 (스파이크로 확인).
  ```
  --banner:js="import {createRequire as __cr} from 'node:module'; const require = __cr(import.meta.url);"
  ```
- 실행은 항상 `node --disable-warning=ExperimentalWarning`으로 한다 (`node:sqlite` 경고 억제).

---

## 3. DB 설계

### 3.1 파일과 위치
- 앱 홈 `APP_HOME` = 환경변수 `WORDQUIZ_HOME`, 없으면 번들 파일이 있는 디렉터리. 배포 시 `C:\WordQuiz`.
- DB 파일: `APP_HOME/data/*.db`. 리포트: `APP_HOME/reports/`. 백업: `APP_HOME/data/backup/`.
- 언어는 파일명이 아니라 `meta` 테이블의 `language` 값이 기준이다.
- `GET /api/databases`는 `data/`를 스캔해 각 파일을 **읽기 전용**으로 열고 `meta.language`와 단어 수를 읽는다. `meta`가 없거나 열리지 않는 파일은 목록에서 빼고 서버 콘솔에 경고를 남긴다.
- DB 이름 규칙: `^[A-Za-z0-9_-]{1,64}\.db$`이고 **Windows 예약 장치 이름**(`CON PRN AUX NUL COM1-9 LPT1-9`, 대소문자 무시)이 아니어야 한다(`con.db`는 파일이 아니라 장치로 취급된다). 이 규칙에 맞고 **목록에 있는 이름**만 열 수 있다 (T9).
- 이름 중복은 **대소문자를 무시하고** 판정한다 (T13). **Windows에서 `Latin.db` 뒤에 `latin.db`를 쓰면 같은 파일을 덮어쓴다는 것을 실측으로 확인했다.** 그래서 `createDatabase`가 **모든 OS에서** 대소문자만 다른 이름을 거부한다(WSL에서만 통과하는 코드를 막기 위함). 배타적 생성(`wx`)은 경합에 대한 2차 방어선이다. 스캔 결과에 대소문자만 다른 두 파일이 있으면(예: Linux에서 만든 폴더를 복사해 온 경우) 둘 다 목록에 넣고 경고를 남긴다.
- 모듈 구성: `names.ts`(이름 규칙, `dbNameExists`), `catalog.ts`(`listDatabases`, `resolveDatabase`: 각 DB를 **읽기 전용**으로 열어 `meta.language`와 단어 수를 읽고, 열리지 않거나 지원하지 않는 언어는 목록에서 빼고 경고), `open.ts`가 `names.ts`를 쓰고 `catalog.ts`가 `open.ts`를 쓰는 단방향 구조다.

### 3.2 연결 설정 (`db/open.ts`)
```
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;      -- import CLI와 서버가 같은 파일을 잠깐 함께 쓸 수 있으므로
-- journal_mode는 기본(DELETE) 유지
```
- 열 때 `PRAGMA user_version`을 읽어 마이그레이션한다. 현재 스키마 버전은 **1**. DB 버전이 코드보다 크면 `DB_TOO_NEW`로 거부한다(읽기 전용으로 열 때도 같다).
- `openDatabase(file, { readOnly?, recoverSessions? })`: `node:sqlite`는 **없는 경로를 열면 파일을 새로 만들므로** 존재 여부를 먼저 확인하고(`DB_NOT_FOUND`, 파일 미생성), SQLite 파일이 아니거나 `meta`가 없는 파일도 `DB_NOT_FOUND`로 거부한다. **`recoverSessions`는 옵트인**이며 서버만 켠다. Import CLI가 서버 실행 중인 DB를 열 때 살아 있는 세션을 잘못 닫지 않게 하기 위함이다(읽기 전용에서는 무시).
- `createDatabase`는 마이그레이션, `meta`(`language`, `created_at`), 기본 설정을 한 트랜잭션으로 만들고 실패하면 만든 파일을 지운다.
- **트랜잭션**: `transaction(db, fn)`은 `BEGIN IMMEDIATE` → `COMMIT`, 예외 시 `ROLLBACK` 후 재던지며 SQLite 제약 오류를 `AppError`로 변환한다. **중첩되지 않는다**(`DatabaseSync.isTransaction`은 Node 22.16 이후라 쓰지 않는다). 트랜잭션 안팎 모두에서 호출될 수 있는 코드(`insertWord` 등)는 `savepoint`를 쓴다.
- **오류 변환**은 `errcode`가 아니라 **메시지 패턴** 기준이다(`errcode`가 최소 버전 22.13에도 있는지 확인할 수 없기 때문). `UNIQUE … word.headword` → `HEADWORD_EXISTS`, 그 밖의 `UNIQUE`/`PRIMARY KEY` → `INTERNAL`, `CHECK`/`NOT NULL`/`FOREIGN KEY` → `INVALID_REQUEST`.
- 이 계층이 쓰는 `node:sqlite` API는 `DatabaseSync`(`readOnly` 옵션), `exec`, `prepare`, `run`(`changes`, `lastInsertRowid`), `get`, `all`, `close`로 한정한다. 최신 Node에만 있는 `isTransaction`, `location()`, `errcode`, `timeout` 옵션은 쓰지 않는다.
- 마이그레이션은 `db/migrations.ts`의 배열(버전 → SQL)을 트랜잭션 안에서 순서대로 적용한다. 새 DB 생성(CLI `--new-db`)도 같은 코드를 쓴다.

### 3.3 스키마 (v1)
```sql
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL              -- language='latin', created_at
);

CREATE TABLE setting (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL              -- questions_per_round='20'
);

CREATE TABLE word (
  id         INTEGER PRIMARY KEY,
  headword   TEXT NOT NULL UNIQUE,                       -- 셀 전체 (trim + NFC)
  meanings   TEXT NOT NULL CHECK (json_valid(meanings)), -- string[][]  (묶음 → 동의어)
  note       TEXT,                                       -- 저장만, 퀴즈 미사용
  created_at INTEGER NOT NULL,                           -- epoch ms (UTC)
  updated_at INTEGER NOT NULL
);

CREATE TABLE word_progress (
  word_id    INTEGER PRIMARY KEY REFERENCES word(id) ON DELETE CASCADE,
  streak     INTEGER NOT NULL DEFAULT 0 CHECK (streak >= 0),
  wrong_mark INTEGER NOT NULL DEFAULT 0 CHECK (wrong_mark IN (0,1)),
  next_round INTEGER NOT NULL DEFAULT 1 CHECK (next_round >= 1),
  done       INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0,1))
);
CREATE INDEX idx_progress_pool ON word_progress(done, next_round);

CREATE TABLE session (
  id           INTEGER PRIMARY KEY,
  started_at   INTEGER NOT NULL,
  ended_at     INTEGER,                  -- NULL이면 진행 중이거나 비정상 종료
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE round (
  id         INTEGER PRIMARY KEY,
  number     INTEGER NOT NULL UNIQUE,    -- DB 단위로 이어지는 라운드 번호
  session_id INTEGER NOT NULL REFERENCES session(id),
  mode       TEXT NOT NULL CHECK (mode IN ('normal','retest')),
  direction  TEXT NOT NULL CHECK (direction IN ('word_to_meaning','meaning_to_word','mix')),
  total      INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at   INTEGER                     -- NULL이면 진행 중이거나 중도 포기
);

CREATE TABLE round_question (
  round_id     INTEGER NOT NULL REFERENCES round(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,         -- 1부터
  word_id      INTEGER NOT NULL REFERENCES word(id),
  direction    TEXT NOT NULL CHECK (direction IN ('word_to_meaning','meaning_to_word')),  -- 문제별 실제 방향 (mix 대비)
  answer_input TEXT,                     -- 제출 전에는 NULL
  verdict      TEXT CHECK (verdict IN ('perfect','partial','wrong')),
  hits         TEXT CHECK (hits IS NULL OR json_valid(hits)),   -- boolean[] (묶음별 충족 여부)
  answered_at  INTEGER,
  PRIMARY KEY (round_id, position),
  UNIQUE (round_id, word_id)             -- 한 라운드에서 같은 단어는 한 번만
);
CREATE INDEX idx_rq_answered ON round_question(answered_at) WHERE answered_at IS NOT NULL;
```
- 기본 설정값은 DB 생성 시 `setting`에 넣는다 (`questions_per_round = 20`).
- `word_progress` 행은 단어를 INSERT할 때 함께 만든다(`next_round = 1`). 나중에 merge로 추가된 단어도 `next_round = 1 ≤ 현재 라운드`이므로 즉시 출제 대상이 된다.
- 이력 화면은 이번 범위에 없지만 데이터는 저장한다. 제출 후 단어의 뜻을 수정하면 과거 `hits` 배열과 묶음 수가 어긋날 수 있다. 이번에는 스냅샷을 따로 저장하지 않고 한계로 인정한다.

### 3.4 주요 조회
```sql
-- 다음 라운드 번호
SELECT COALESCE(MAX(number), 0) + 1 FROM round;

-- 출제 pool (n = 다음 라운드 번호). 재시험은 AND p.wrong_mark = 1 추가
SELECT w.id FROM word w JOIN word_progress p ON p.word_id = w.id
 WHERE p.done = 0 AND p.next_round <= :n
 ORDER BY RANDOM() LIMIT :k;

-- 상태 바: 이번 세션의 테스트 수 / 정답(Perfect) 수
SELECT COUNT(*) AS tested, COALESCE(SUM(rq.verdict = 'perfect'), 0) AS correct
  FROM round_question rq JOIN round r ON r.id = rq.round_id
 WHERE r.session_id = :sid AND rq.answered_at IS NOT NULL;

-- 일자별 결과 (로컬 날짜)
SELECT date(answered_at/1000, 'unixepoch', 'localtime') AS day, COUNT(*), SUM(verdict='perfect')
  FROM round_question WHERE answered_at IS NOT NULL GROUP BY day;
```

### 3.5 세션 생명주기
- **시작**: `POST /api/session`이 `session` 행을 만든다. 이미 활성 세션이 있으면 먼저 종료한다(DB 전환 = 종료 후 새 시작, PRD 4.9).
- **활성 세션은 서버 전체에서 하나**다(단일 사용자). PC와 휴대폰이 동시에 접속하면 같은 세션을 함께 본다.
- **`last_seen_at`**: API 호출마다 갱신하되 30초 이내 중복 갱신은 건너뛴다.
- **정상 종료**: 서버가 `SIGINT`, `SIGTERM`, `SIGHUP`, `SIGBREAK`를 받으면 활성 세션의 `ended_at = now`를 기록하고 종료한다. Windows에서 콘솔 창을 닫으면 Node에 `SIGHUP`이 전달된다 (약 10초 뒤 강제 종료되므로 동기 API로 즉시 기록).
- **비정상 종료 보정**: 서버가 DB를 `recoverSessions: true`로 열 때 `ended_at IS NULL`인 이전 세션을 `ended_at = last_seen_at`으로 채운다. **서버만** 이 옵션을 켠다(3.2).
- 진행 중이던 라운드가 남아 있으면(`ended_at IS NULL`) 같은 세션 안에서만 이어서 진행할 수 있다. 세션이 끝나면 그 라운드는 **중도 포기**로 두고 `ended_at`을 채우지 않는다. 라운드 번호는 이미 소비된 것으로 본다.

---

## 4. 도메인 규칙 (`src/shared`)

### 4.1 채점 (`grading.ts`)
```ts
// 짝이 맞는 괄호 밖의 쉼표로만 분리, 앞뒤 공백 제거, 빈 항목 제거   (T11)
splitTop(s: string): string[]

// NFC → 소문자 → ? ! . 제거 → ä→ae ö→oe ü→ue ß→ss → 공백 축약 → trim   (T10)
normalize(s: string): string

// 정답 동의어 하나의 허용 형태 (중복 제거).
//  ① 원형(괄호 그대로)  ② 괄호와 그 안의 내용 제거  ③ 괄호 문자만 제거
variants(synonym: string): string[]

grade(groups: string[][], input: string):
  { hits: boolean[]; verdict: 'perfect' | 'partial' | 'wrong' }
```
- 입력을 `splitTop` → `normalize`해서 항목 목록을 만든다. 묶음의 어떤 동의어든 `variants` 중 하나가 입력 항목 중 하나와 같으면 그 묶음은 충족이다.
- 충족한 묶음 수가 전체와 같으면 `perfect`, 1개 이상이면 `partial`, 0이면 `wrong`.
- D32: 정답 묶음에 없는 입력 항목은 감점하지 않는다 (예: `fassen, nehmen, erobern`도 Perfect).
- 스페이스는 구분자가 아니다. `sich setzen`은 `sich setzen`으로만 맞는다 (`setzen`만 입력하면 오답).
- **짝이 없는 괄호는 일반 문자**로 취급한다(M1 결정). 먼저 `(`–`)` 쌍을 스택으로 찾고, 쌍이 맞는 괄호 안의 쉼표만 보호한다. `"a (b, c"`는 `["a (b", "c"]`로 나뉜다. 단순히 깊이만 세면 짝 없는 `(` 뒤의 쉼표가 모두 삼켜진다. 실제 데이터에는 짝이 안 맞는 괄호가 없어 결과는 같다.
- `variants`의 "괄호와 그 안의 내용 제거"도 **짝이 맞는 괄호**만 대상으로 하며 중첩은 바깥쪽 전체를 제거한다.
- `grade()`는 `groups`가 비어 있으면 `RangeError`를 던진다(뜻 없는 단어가 조용히 Perfect가 되는 것을 막는다). 빈 입력이나 무시되는 문자(`? ! .`)뿐인 입력은 Wrong이다.
- **데이터 참고**: 실제 목록의 `quō?` 행은 원래 뜻이 `wohin? wo?`(쉼표 없음)라 **동의어 하나**로 파싱되었다. 두 단어를 각각 동의어로 의도한 것이라 사용자가 확인했고, 샘플 Excel을 `wohin?, wo?`로 고쳤다(M2 이후). 스페이스가 구분자가 아니라는 동작 자체는 합성 사례 테스트로 계속 고정되어 있다. 사용자 본인의 실제 단어장은 사용자가 직접 같은 수정을 한다.

동작 예 (스파이크에서 확인한 결과):

| 정답 | 입력 | 판정 |
|------|------|------|
| `(zusammen)werfen` | `werfen` / `zusammenwerfen` / `(zusammen)werfen` | Perfect |
| `(zusammen)werfen` | `zusammen werfen` | Wrong (공백이 다르다) |
| `der (die, das) zweite` | `der zweite` / `der (die, das) zweite` | Perfect |
| `wie viel(e)?` | `wie viel` / `wie viele` | Perfect |
| `Prometheus (Göttersohn, Schöpfer der Menschen)` | `Prometheus` | Perfect |
| `[fassen, nehmen] [erobern]` | `nehmen, erobern` | Perfect |
| `[fassen, nehmen] [erobern]` | `nehmen` | Partial (1/2) |

### 4.2 출제 규칙 (`scheduling.ts`)
라운드 번호 `N`은 그 라운드에 부여된 번호다.

```ts
applyResult(p: Progress, verdict: Verdict, n: number): { progress: Progress; askDone: boolean }
```
| 결과 | streak | wrong_mark | next_round | askDone |
|------|--------|------------|------------|---------|
| 오답 / 부분 정답 | 0 | 1 | `n + 1` | false |
| Perfect (streak → 1) | 1 | 유지 | `n + 2` | false |
| Perfect (streak → 2) | 2 | 유지 | `n + 3` | false |
| Perfect (streak → 3 이상) | 3+ | 유지 | `n + 3` **(No 결과를 즉시 적용, T7)** | **true** |

- `askDone`이 true이면 클라이언트가 "Mark this word as done?" 확인창을 띄운다. **Yes**는 `POST /api/words/:id/done {done:true}`를 호출한다. **No**는 아무것도 하지 않는다.
- **완료 표시** (`done = true`): `done = 1`, `wrong_mark = 0`. 오답 직후에는 UI에서 버튼을 비활성화하고, 서버도 그 문항이 `wrong`이면 거부한다(`MARK_DONE_NOT_ALLOWED`). 단어 관리의 체크박스는 이 제한을 받지 않는다.
- **완료 해제** (`done = false`): `done = 0`, `streak = 0`, `next_round = min(next_round, 다음 라운드 번호)`. 해제한 단어가 다음 라운드에 바로 나온다. `wrong_mark`는 그대로 둔다(완료 시 이미 0).
- 재시험 라운드도 같은 규칙을 적용하고, 라운드 번호를 소비한다.

### 4.3 pool과 라운드 구성
- `pool` = `done = 0 AND next_round <= 다음 라운드 번호`. 재시험은 `wrong_mark = 1`을 추가한다.
- 문제 수 = `min(설정값, pool 크기)`. 무작위 추출은 SQLite `ORDER BY RANDOM()`.
- pool이 비면 `POOL_EMPTY`, 전 단어가 완료면 `ALL_DONE`(전용 안내 화면)로 구분한다. 재시험에서 오답 마크된 단어가 없으면 `POOL_EMPTY`.
- 방향: Latin은 `word_to_meaning`만 허용하고 다른 값은 `DIRECTION_UNSUPPORTED`. `meaning_to_word`·`mix`는 English 지원 시 구현한다(타입과 컬럼은 미리 둔다).

### 4.4 뜻 수정 형식 (`meanings.ts`)
```ts
formatMeanings(groups: string[][]): string   // 묶음은 ' | ', 동의어는 ', '
parseMeanings(text: string): string[][]      // '|'로 묶음, splitTop(',')로 동의어. 빈 묶음은 [] 로 유지
validateMeanings(groups): MeaningsError | null
```
- `parseMeanings`는 순수 파싱만 하고, 검증은 `validateMeanings`가 한다. 처음 발견한 문제의 코드를 돌려주고(문제 없으면 `null`), API는 이를 `INVALID_MEANINGS`로 변환한다.

| 코드 | 조건 |
|------|------|
| `EMPTY` | 묶음이 0개 |
| `TOO_MANY_GROUPS` | 묶음이 5개 이상 (`MAX_GROUPS = 4`) |
| `EMPTY_GROUP` | 동의어가 없는 묶음 (예: `a \| \| b`, 끝에 `\|`) |
| `INVALID_SYNONYM` | 빈 문자열, 앞뒤 공백, `\|` 포함 |
| `NOT_ROUNDTRIP_SAFE` | `parse(format(groups))`가 원본과 다름. 예: 동의어에 괄호 밖 쉼표(`a, b`), 두 동의어에 걸쳐 괄호가 짝지어지는 경우(`x (y` + `z) w`) |

- 마지막 항목이 핵심 기준이다. **저장된 뜻은 편집 화면을 다시 열어도 같은 모습**이어야 한다.
- `format → parse` 왕복이 항상 같은 결과여야 한다(괄호 안 쉼표 포함). 단위 테스트로 보장한다.

---

## 5. HTTP API

REST, JSON, 경로는 `/api` 아래. 오류 응답은 항상 `{ "error": { "code": string, "message": string } }`.

### 5.1 엔드포인트
| 메서드 | 경로 | 요청 | 성공 응답 | 오류 코드 |
|--------|------|------|-----------|-----------|
| GET | `/databases` | | `{ databases: [{name, language, wordCount}] }` | |
| POST | `/session` | `{ db }` | `SessionState` (201) | `INVALID_DB_NAME` 400, `DB_NOT_FOUND` 404, `DB_TOO_NEW` 409 |
| GET | `/session` | | `SessionState` | `NO_SESSION` 404 |
| DELETE | `/session` | | 204 | |
| GET | `/pool` | | `PoolInfo` | `NO_SESSION` |
| POST | `/rounds` | `{ mode, direction }` | `RoundState` (201) | `ROUND_IN_PROGRESS`, `POOL_EMPTY`, `ALL_DONE` (409), `DIRECTION_UNSUPPORTED` 422 |
| GET | `/rounds/current` | | `RoundState` | `NO_ACTIVE_ROUND` 404 |
| POST | `/rounds/:id/answers` | `{ position, input }` | `AnswerResult` | `EMPTY_INPUT` 400, `ALREADY_ANSWERED`, `OUT_OF_ORDER` 409 |
| GET | `/wrong` | | `{ words: WordRow[] }` (완료 제외) | |
| GET | `/words` | | `{ words: WordRow[] }` | |
| PATCH | `/words/:id` | `{ headword?, meanings? }` | `WordRow` | `INVALID_MEANINGS` 400, `HEADWORD_EXISTS` 409, `WORD_NOT_FOUND` 404 |
| POST | `/words/:id/done` | `{ done, questionPosition? }` | `WordRow` | `MARK_DONE_NOT_ALLOWED` 409 |
| GET | `/settings` | | `{ questionsPerRound }` | |
| PUT | `/settings` | `{ questionsPerRound }` (1~200 정수) | `{ questionsPerRound }` | `INVALID_SETTING` 400 |

**공통 오류 코드** (5.1 표의 엔드포인트별 코드 외에 모든 엔드포인트에 나올 수 있다): `INVALID_REQUEST` 400(본문·파라미터 형식 오류), `FORBIDDEN_HOST` 403(Host 검사 실패, 9장), `UNSUPPORTED_MEDIA_TYPE` 415(쓰기 요청의 Content-Type이 JSON이 아님), `INTERNAL` 500. 코드별 HTTP 상태는 `ERROR_STATUS`(`src/shared/api.ts`)가 서버와 클라이언트의 단일 출처다.

### 5.2 응답 타입 (`src/shared/api.ts`)
```ts
type Verdict = 'perfect' | 'partial' | 'wrong';
type Direction = 'word_to_meaning' | 'meaning_to_word' | 'mix';

interface Stats { totalWords: number; tested: number; correct: number }   // correct = Perfect만

interface SessionState {
  db: string; language: 'latin'; sessionId: number; startedAt: number;
  questionsPerRound: number; stats: Stats; activeRound: RoundState | null;
}
interface PoolInfo {
  nextRoundNumber: number; available: number; wrongAvailable: number;
  questionsPerRound: number; allDone: boolean;
}
interface Question { position: number; headword: string; direction: 'word_to_meaning' | 'meaning_to_word' }
interface RoundState {
  roundId: number; number: number; mode: 'normal' | 'retest'; direction: Direction;
  total: number; answered: number; question: Question | null;   // 다음 미제출 문제, 끝났으면 null
}
interface AnswerResult {
  verdict: Verdict;
  groups: { synonyms: string[]; hit: boolean }[];   // 정답 줄 표시용 (묶음별 ✓/✗)
  wordId: number;
  askDone: boolean;          // 3회 이상 연속 Perfect
  canMarkDone: boolean;      // verdict !== 'wrong'
  stats: Stats;
  round: RoundState;         // 다음 문제 포함
  summary: { total: number; correct: number; percent: number } | null;   // 라운드가 끝났을 때만
}
interface WordRow { id: number; headword: string; meanings: string[][]; done: boolean; wrongMark: boolean }
```

### 5.3 동작 규칙
- `POST /rounds/:id/answers`는 **하나의 트랜잭션**에서 채점 → `round_question` 갱신 → `word_progress` 갱신 → (마지막 문제면) `round.ended_at` 기록까지 수행한다. `position`은 첫 번째 미제출 문제와 같아야 한다.
- 클라이언트는 제출 후 결과 화면을 보여주고, 사용자가 Next(Enter)를 누르면 응답에 담긴 `round.question`을 화면에 올린다. 결과 화면에서 새로고침하면 다음 미제출 문제로 이동한다 (허용).
- `DB_NOT_FOUND`는 클라이언트가 "The selected DB does not exist." 알림을 띄우고 시작 화면으로 돌아가는 신호다. 세션 도중 DB 파일이 사라져도 같은 코드로 처리한다.
- `PATCH /words/:id`는 `note`를 다루지 않는다(화면에 없다). `headword`를 바꿀 때는 trim + NFC를 적용하고 UNIQUE 위반(`errcode 2067`)을 `HEADWORD_EXISTS`로 변환한다.
- `GET /wrong`과 `GET /words`는 전체를 한 번에 돌려준다(수백 개 규모). 검색은 클라이언트에서 `normalize`로 필터링한다.

---

## 6. Import CLI

### 6.1 사용법
```
import.bat <file.xlsx> [옵션]              (배포본. chcp 65001 설정 포함)
node import.mjs <file.xlsx> [옵션]         (개발)

대상 선택 (둘 중 하나 필수)
  --db <name>          기존 DB에 merge          예: --db latin.db
  --new-db <name>      새 DB 생성               예: --new-db latin_2   (.db 자동 부여)
  --lang <language>    --new-db와 함께 필수. 현재 latin만 지원

동작
  (기본)               검증 모드 — DB를 변경하지 않고 리포트만 출력
  --apply              반영 모드 — 오류가 없을 때만 DB를 변경

기타
  --sheet <name>       읽을 시트 (기본: 첫 번째 시트)
  --report <path>      리포트 파일 경로 (기본: reports/<xlsx이름>_<yyyyMMdd-HHmmss>.txt)
```
- 검증 모드에서 `--db`를 주면 기존 DB를 **읽기 전용**으로 열어 비교한다. `--new-db`는 파일을 만들지 않고 이름이 이미 쓰이고 있는지만 검사한다(있으면 오류, **대소문자 무시**, T13).
- 종료 코드: `0` 정상, `1` 검증 오류가 있어 반영하지 않음, `2` 사용법·파일 입출력 오류.

### 6.2 Excel 읽기와 검증
1. 시트의 첫 행을 헤더로 본다. **헤더 이름으로 열을 매핑**한다: `단어`(필수), `뜻1`~`뜻4`(`뜻1` 필수), `노트`(선택). 열 순서는 자유이고, 알 수 없는 열은 경고 후 무시한다.
2. 데이터 행마다 다음을 처리한다.

| 구분 | 조건 | 처리 |
|------|------|------|
| **오류** | 표제어가 비었음 | 반영 차단 |
| **오류** | 뜻 열이 모두 비었음 | 반영 차단 |
| **오류** | 파일 안에서 표제어가 중복됨 (trim + NFC 후 일치) | 반영 차단, 두 행 번호를 함께 표시 |
| **오류** | 셀에 `\|` 문자가 있음 | 반영 차단 (수정 화면의 묶음 구분자와 충돌) |
| 경고 | 앞뒤 공백을 제거함 | 제거한 값으로 진행 |
| 경고 | 뜻 열 사이에 빈칸이 있음 (예: 뜻1, 뜻3만 채움) | 빈 열을 건너뛰고 진행 |
| 경고 | 뜻 셀의 괄호 짝이 맞지 않음 | 그대로 진행 (채점은 짝 없는 괄호를 무시) |
| 경고 | 뜻 셀에서 분리한 동의어가 비었음 (예: `a,,b`) | 빈 항목 제거 |

3. 표제어의 동일성 기준은 **trim + NFC 후 완전 일치**다. 대소문자와 장음 기호는 구분한다.
4. 뜻은 각 열을 `splitTop`(괄호 밖 쉼표)으로 나눠 묶음 하나로 만든다. 노트는 그대로 저장한다.

### 6.3 merge 동작 (`--db`)
| 분류 | 조건 | 반영 |
|------|------|------|
| 추가 | DB에 없는 표제어 | `word` + `word_progress`(기본값) 삽입 |
| 갱신 | 있으나 뜻 또는 노트가 다름 | `meanings`, `note`, `updated_at`만 변경. **진행 상태는 보존** |
| 변경 없음 | 뜻·노트가 같음 | 아무것도 하지 않음 |
| Excel에서 사라짐 | DB에는 있으나 Excel에 없음 | **삭제하지 않고** 리포트에만 표시 (D31) |

- `--new-db`는 위 규칙에서 전부 "추가"가 된다.
- 반영 순서: 검증 → 오류 있으면 종료 코드 1 → (merge인 경우) `data/backup/<name>.<yyyyMMdd-HHmmss>.db`로 파일 복사 → `BEGIN IMMEDIATE` → 삽입·갱신 → `COMMIT` → 리포트 저장. 실패하면 `ROLLBACK`.
- 사용자가 앱에서 고친 뜻을 Excel이 다시 덮어쓸 수 있으므로, **갱신 항목은 리포트에 이전 → 이후 값을 함께 표시**한다.
- 서버가 실행 중이어도 `busy_timeout` 덕분에 동작하지만, 반영은 서버를 종료한 상태에서 하는 것을 권장한다고 리포트 끝에 안내한다.

### 6.4 리포트 형식
stdout과 파일에 같은 내용을 쓴다. 인코딩은 **UTF-8**(BOM 없음).
```
Word Quiz Import Report
=======================
File     : data/latin_wortschatz.xlsx  (sheet: Wortschatz)
Target   : latin.db (merge)            Mode: VALIDATE (no changes made)
Time     : 2026-09-20 15:20:31

Summary
  Rows read         : 178
  Added             : 12
  Updated           : 3
  Unchanged         : 163
  Missing in Excel  : 0     (kept in DB, not deleted)
  Warnings          : 2
  Errors            : 0

Updated
  row 31  plēnus, a, um (m. Gen.)
          meanings : [voll (von / mit)]  ->  [voll (von / mit), erfüllt]
  ...

Warnings
  row 58  meanings: unbalanced parenthesis in "..."
  ...

Errors
  (none)

Result: OK to apply. Re-run with --apply to write these changes.
```
- 오류가 있으면 마지막 줄이 `Result: NOT applied. Fix the errors in the Excel file and run again.`으로 바뀐다.
- 콘솔 UTF-8은 `import.bat`의 `chcp 65001`이 맡는다. 파일 리포트는 코드 페이지와 무관하게 UTF-8로 쓴다.

---

## 7. 프런트엔드

### 7.1 화면 · 컴포넌트 (목업 5.1~5.7 기준)
| 화면 | 컴포넌트 | 데이터 |
|------|----------|--------|
| 앱 진입 | `App` → `GET /session` 성공이면 `Shell`, `NO_SESSION`이면 `StartScreen` | |
| 5.1 시작 | `StartScreen`(언어 라디오, DB `Select`, Start), `NoDbDialog` | `GET /databases`, `POST /session` |
| 공통 | `TopBar`(DB 표시, Switch DB → `SwitchDbDialog`), `Tabs`, `StatusBar` | `SessionState.stats` |
| 5.2 라운드 전 | `IdlePanel`(방향 라디오, 라운드 번호·출제 가능 수, Start), 재시험 배너 | `GET /pool` |
| 5.3 진행 | `QuestionPanel`(진행 막대, 표제어, 입력 폼), `FeedbackPanel`(판정 칩, 묶음 ✓/✗, Mark done, Next), `Done3Dialog` | `POST /rounds/:id/answers` |
| 5.4 결과 | `ResultPanel`, `EmptyPoolNotice`, `AllDoneNotice` | `AnswerResult.summary` |
| 5.5 오답 | `WrongPage`(표, Retest wrong only) | `GET /wrong` |
| 5.6 단어 관리 | `WordsPage`(검색창, `WordTable`, 행 편집) | `GET/PATCH /words`, `POST /words/:id/done` |
| 5.7 설정 | `SettingsPage` | `GET/PUT /settings` |

### 7.2 구현 규칙
- 라우팅은 `location.hash`(`#/quiz`, `#/wrong`, `#/words`, `#/settings`)를 읽는 작은 훅 하나로 처리한다.
- 서버 상태는 `api.ts`의 fetch 래퍼와 화면별 훅으로 관리한다(별도 상태 관리·쿼리 라이브러리 없음). 오류 코드는 `ApiError`로 던지고 화면에서 코드별로 분기한다.
- 테마: 목업의 색 토큰(`--accent #2F55B5` 등)을 MUI 테마로 옮기고 `prefers-color-scheme`으로 다크 모드를 지원한다. 표제어는 `EB Garamond`(장음 기호 지원), 숫자·코드는 `IBM Plex Mono`.
- 표제어 요소에 `lang="la"`, 줄바꿈은 `overflow-wrap: anywhere`.
- 입력창: `autoCapitalize="off"`, `autoCorrect="off"`, `spellCheck={false}`, `enterKeyHint="send"`. 모바일 키보드의 자동 고침이 독일어 답을 망가뜨리지 않게 한다.
- 제출 후 **Next 버튼에 포커스**를 옮겨 Enter가 다음 문제로 이동시키게 한다(전역 키 핸들러 없이 접근성 유지). `Done3Dialog`가 열려 있는 동안은 MUI 포커스 트랩이 Enter를 가로챈다.
- 정답 줄의 묶음은 색과 기호(✓/✗)를 함께 쓴다(색만으로 구분하지 않음).
- **Mark done**은 판정이 `wrong`이면 비활성. 상태 바 수치는 `AnswerResult.stats`로 갱신한다.
- 반응형: MUI 브레이크포인트 `sm`(600px) 미만에서 입력 폼을 세로 배치, 하단 상태 바는 줄바꿈 허용. 표는 가로 스크롤.
- 검색: `shared/grading.ts`의 `normalize`로 단어와 뜻을 비교한다(대소문자·움라우트 무시).

---

## 8. 실행과 배포

### 8.1 배포 구조 (`C:\WordQuiz`)
```
C:\WordQuiz\
├─ start.bat
├─ import.bat
├─ server.mjs
├─ import.mjs
├─ public\            클라이언트 정적 파일
├─ data\              *.db, backup\      ← 사용자 데이터. 배포 시 덮어쓰지 않는다
└─ reports\           import 리포트
```
- `WordQuiz.zip`에는 `start.bat`, `import.bat`, `server.mjs`, `import.mjs`, `public\`만 넣는다. `data\`와 `reports\`는 첫 실행 때 만든다.

### 8.2 `start.bat`
```bat
@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js was not found. Please install Node.js 22.13 or later. & pause & exit /b 1)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)" || (echo Node.js 22.13 or later is required. Current: & node -v & pause & exit /b 1)
node --disable-warning=ExperimentalWarning server.mjs
pause
```
- 서버가 **`listen`에 성공한 뒤** 기본 브라우저를 연다(`cmd /c start "" http://localhost:35000`). 배치 파일에서 미리 여는 방식은 서버 준비 전에 접속하는 경합이 생겨 쓰지 않는다. 개발 중에는 `--no-open`으로 끈다.
- 포트는 `35000`, 환경변수 `PORT`로 변경할 수 있다.
- **포트 사용 중**(`EADDRINUSE`)이면 "이미 실행 중일 수 있습니다" 메시지를 출력하고 브라우저만 열고 종료한다.
- 마지막 `pause`는 오류 메시지가 창과 함께 사라지지 않게 한다.
- 콘솔 창을 닫거나 Ctrl+C로 종료하면 세션 종료 시각이 기록된다 (3.5).

### 8.3 `import.bat`
```bat
@echo off
chcp 65001 >nul
node --disable-warning=ExperimentalWarning "%~dp0import.mjs" %*
```

### 8.4 개발 환경 (WSL)
- `npm run dev`로 서버와 Vite를 함께 띄운다. `WORDQUIZ_HOME`을 프로젝트 안의 임시 디렉터리로 지정해 개발 데이터가 `data/` 샘플과 섞이지 않게 한다.
- 배포 확인은 `npm run deploy` 후 Windows에서 `C:\WordQuiz\start.bat`을 실행한다.

### 8.5 개발(WSL)과 실행(Windows)의 차이

개발은 WSL, 실행은 Windows이므로 아래 차이를 코드와 스크립트에서 지킨다. 2026-09-20에 이 PC에서 확인한 사실을 근거로 한다.

| 차이 | 확인한 사실 | 규칙 |
|------|-------------|------|
| **줄바꿈** | `cmd.exe`는 CRLF가 아닌 배치 파일에서 오작동할 수 있다. 저장소에는 `.gitattributes`와 `core.autocrlf` 설정이 없었다 | `.gitattributes`에 `*.bat text eol=crlf`, 소스는 `eol=lf`. `build`/`package`/`deploy`가 `.bat`을 CRLF, **BOM 없는 UTF-8**로 기록한다 (T14). 검증: 배포된 `.bat`의 모든 줄이 CRLF |
| **파일명 대소문자** | Windows는 대소문자를 구분하지 않고 Linux는 구분한다. **실측: Windows에서 `Latin.db` 뒤에 `latin.db`를 쓰면 같은 파일이 덮어써진다** | DB 이름 중복 검사는 대소문자 무시 (T13). 경로는 `path.join`과 `fileURLToPath`를 쓰고 `/`나 `\\`를 하드코딩하지 않는다 |
| **실행 중인 스크립트** | 실행 중인 `server.mjs`는 **잠기지 않아 덮어쓰기가 허용**된다. 다만 실행 중인 서버는 **옛 코드를 메모리에** 두고 있어 새 `public/`과 어긋난다 | 서버가 `server.lock`을 만들고 종료 시 지운다. `deploy`는 lock이 있으면 "서버를 먼저 종료하세요"로 중단하고 `--force`로만 진행한다 (T16). 비정상 종료로 남은 lock은 서버가 다음 기동 때 덮어쓴다 |
| **열린 DB 파일** | 서버가 연 SQLite 파일은 **삭제·이름 변경이 차단**된다(`Permission denied`). **복사는 허용**된다 | 자동 백업(T12)은 파일 복사라 서버 실행 중에도 동작한다. 테스트와 스크립트는 DB를 `close()`한 뒤에 지운다. `deploy`는 `data/`를 건드리지 않는다 |
| **OS를 넘나드는 DB 접근** | `/mnt/c`(WSL에서 본 Windows 파일)는 SQLite 잠금이 불안정할 수 있다 | WSL에서 Windows 쪽 DB를 열 때는 **읽기 전용, 순차 접근**만 한다. 같은 DB를 WSL과 Windows가 **동시에** 열지 않는다. 자동 검증은 이 규칙을 따른다 |
| **휴대폰 접속 검증** | WSL은 NAT라 휴대폰에서 직접 닿지 않는다. Windows의 `curl.exe`는 WSL 서버의 `localhost`에 접속된다 | 휴대폰 접속은 **Windows에 배포한 서버**로만 확인한다. Windows 브라우저에서 WSL의 Vite dev 서버를 보는 것은 가능하다 |

---

## 9. 보안

로컬 전용 단일 사용자 앱이지만 **휴대폰 접속을 위해 LAN에 열려 있고 인증이 없다.** 다음을 적용한다.

| 위험 | 대책 |
|------|------|
| 외부 웹페이지가 브라우저를 통해 `localhost:35000`에 요청을 보냄 (CSRF) | 쓰기 요청은 `Content-Type: application/json`을 요구하고 **CORS 헤더를 보내지 않는다**. 교차 출처 JSON 요청은 사전 요청(preflight)에서 막힌다 |
| DNS 리바인딩 | `Host` 헤더 검사: 점이 없는 단일 이름(`localhost`, PC 이름), `127.0.0.1`, `[::1]`, 사설 IPv4(`10/8`, `172.16/12`, `192.168/16`)만 허용한다. 그 외는 403. 점이 있는 이름(예: `nas.local`)은 `WORDQUIZ_ALLOWED_HOSTS`(쉼표 구분) 또는 `--allow-host`로 **명시적으로 추가**해야 한다 (T15) |
| 경로 조작 | DB 이름은 정규식 + 서버 목록 대조 (T9). 사용자 입력이 파일 경로에 직접 쓰이지 않는다 |
| SQL 주입 | 모든 쿼리는 파라미터 바인딩(`prepare().run/get/all`)만 사용한다 |
| HTML 주입 | React 기본 이스케이프 사용, `dangerouslySetInnerHTML` 금지 |
| LAN 내 무인증 접근 | 알려진 위험으로 문서화한다. 공용 Wi-Fi에서는 `--local-only`(`127.0.0.1`에만 바인딩)로 실행한다. 기본값은 `0.0.0.0`(PRD 모바일 요구). 최초 실행 시 Windows 방화벽 허용 창이 뜬다는 점을 사용자 안내에 넣는다 |
| 요청 크기 | JSON 본문 제한 100KB |

---

## 10. 테스트 전략

프로젝트 규칙: 코드 변경 후 `npm run typecheck`, 테스트는 전체보다 **단일 파일** 실행을 우선한다.

| 대상 | 방법 | 핵심 케이스 |
|------|------|-------------|
| `grading.ts` | vitest 단위 | 4.1의 예시 표 전부, 데이터에서 실패했던 행 유형(괄호 단어, 물음표, 괄호 안 쉼표, 대문자 + 움라우트) 픽스처 |
| `scheduling.ts` | vitest 단위 | 4.2 표의 모든 행, 연속 Perfect 3회 이상, 완료 해제 |
| `meanings.ts` | vitest 단위 | `format → parse` 왕복(괄호 안 쉼표 포함), 잘못된 입력 거부 |
| DB 계층 | `:memory:` DB | 마이그레이션, pool 쿼리(`next_round` 경계), 세션 보정, UNIQUE·CHECK·FK 오류 변환 |
| API | `app.listen(0)` + `fetch` | 라운드 전체 흐름, 오류 코드, 쓰기 요청의 Content-Type·Host 검사 |
| Import CLI | 임시 디렉터리 + 소형 xlsx 픽스처 | 검증 모드가 DB를 바꾸지 않음, 오류 시 반영 차단(종료 코드 1), merge가 진행 상태를 보존, 사라진 단어 미삭제, 백업 생성 |
| 클라이언트 | 수동 + 목업과 비교 | 목업 5.1~5.7 화면별 확인, 모바일 폭(390px) |
| Windows 전용 | **수동 체크리스트** | `start.bat` 실행·브라우저 열림, 버전 검사 메시지, 포트 중복, 콘솔 창 닫기 → `session.ended_at` 기록, `chcp 65001`에서 장음 기호·움라우트 출력 |

- 테스트 픽스처는 저장소 안에 두고 **`data/`의 실제 Excel에 의존하지 않는다** (`data/`는 커밋 대상이 아님).
- xlsx 픽스처는 개발 의존성 `write-excel-file`로 테스트 안에서 생성하거나, 작은 `.xlsx`를 `test/fixtures/`에 커밋한다.

---

## 11. 위험 요소와 대응

| 위험 | 영향 | 대응 |
|------|------|------|
| `node:sqlite`가 아직 experimental | 마이너 버전에서 동작이 바뀔 수 있다 | 최소 버전 22.13을 `start.bat`이 검사한다. 모든 접근을 `src/server/db/` 한 모듈에 격리하여 필요 시 교체가 한 곳에서 끝나게 한다 |
| `read-excel-file`의 메이저 버전별 API 변경 | 업그레이드 때 CLI가 깨질 수 있다 | 정확한 버전 고정. 접근을 `cli/xlsx.ts` 하나로 격리. 번들 실패 시 `fflate` + 최소 XML 파싱으로 대체(샘플 구조가 단순함을 확인) |
| ESM 번들에서 CJS 의존성 `require` 오류 | 배포본 실행 실패 | `createRequire` 배너(2.4). 빌드 후 `node_modules` 없는 디렉터리에서 스모크 실행을 `package` 스크립트에 포함 |
| Windows 콘솔 종료 시그널 | 종료 시각 누락 | `SIGHUP` 핸들러 + `last_seen_at` 보정(3.5). 수동 체크리스트로 확인 |
| 사용자가 고친 뜻을 재 import가 덮어씀 | 수정 내용 손실 | 갱신 항목의 이전 → 이후 값을 리포트에 표시하고 반영 전에 자동 백업 |
| 제출 후 뜻 수정으로 과거 `hits`가 어긋남 | 이력 표시 오류 | 이번 범위에 이력 화면이 없어 영향 없음. 이력 화면을 만들 때 스냅샷 컬럼을 추가한다 |
| 두 기기에서 동시 접속 | 같은 세션을 함께 조작 | 단일 사용자 전제. 두 번째 기기는 같은 세션 상태를 그대로 본다 |
| 최신 Node에만 있는 `node:sqlite` API(`isTransaction`, `location()`, `errcode`, `timeout` 옵션)를 무심코 사용 | 이 PC(Node 24.14)에서는 통과하지만 최소 버전 22.13에서 실행 시 오류 | 사용 API를 3.2의 목록으로 한정하고 오류는 메시지로 판별한다. 22.13 실제 동작은 M9 수동 체크리스트로 확인한다 |
| `@types/node` 22.20이 Node 22.13에 없는 API를 허용 | 타입 검사는 통과하지만 최소 버전에서 실행 시 오류 | 완전히 막을 수 없는 잔여 위험. 새 Node API를 쓸 때 도입 버전을 확인하고, 사용자 PC의 Node 버전을 M9 수동 체크리스트로 확인한다 |
| TypeScript 7·vitest 5 등 최신 메이저가 이후 도입 라이브러리(Vite, MUI)와 어긋남 | 설치·빌드 실패 | 라이브러리 도입 시(M5) 즉시 `tsc -b`와 테스트를 돌려 확인하고, 문제가 있으면 TypeScript 6.x로 내린다(lockfile로 복원 가능) |
| `.bat`이 LF로 저장됨 | `cmd.exe`에서 오작동 | `.gitattributes` + 빌드 시 CRLF 변환 + 배포본 줄바꿈 검증 (T14) |
| 대소문자만 다른 DB 이름 | Windows에서 충돌, 다른 파일을 덮어씀 | 이름 중복 검사를 대소문자 무시로 (T13) |
| 실행 중인 서버를 두고 `deploy` | 옛 서버와 새 `public/` 불일치 | `server.lock` 검사 (T16) |
| 열린 DB를 지우거나 이름 변경하는 스크립트·테스트 | Windows에서 `Permission denied` | 항상 `close()` 후 조작. 백업은 복사 방식 (8.5) |
| 향후 홈 서버에서 점 포함 호스트 이름으로 접속 | `Host` 검사가 403 | 허용 Host 추가 설정 (T15) |
| 채점 규칙 이해 차이 | 정답인데 오답 처리 | 4.1 예시 표를 테스트로 고정하고, 정답 줄에 묶음별 ✓/✗를 보여 원인을 알 수 있게 한다 |

---

## 12. PRD 대비 확정·변경 사항

기술 스펙 작성 중 확정하거나 발견한 내용 중 PRD에 반영이 필요한 항목이다.

| # | 내용 | PRD 반영 |
|---|------|----------|
| D35 | 뜻 구분자는 **괄호 밖의 쉼표만**이다. (`der (die, das) zweite`는 동의어 하나) 사용자 승인 | 4.2 채점 규칙 수정, 결정 로그 추가 |
| D36 | 채점 정규화는 `? ! .`를 무시한다. (`wie viel(e)?`에 `wie viel` 입력 허용) 사용자 승인 | 4.2 공통 규칙 수정, 결정 로그 추가 |
| - | "정답 그대로(괄호 포함) 입력해도 정답" — D19(괄호 생략 허용)의 자연스러운 귀결이라 별도 결정 없이 4.2 표의 예시로만 보강 | 4.2 예시 추가 |

---

## 13. PRD가 기술 스펙에 위임한 항목 점검

| PRD 위임 항목 | 결정 위치 |
|---------------|-----------|
| DB 라이브러리 선정 | T1, 2.1 |
| 스키마 | 3.3 |
| 정규화·괄호 처리 구현 | 4.1 |
| import CLI: 헤더 행, 빈 뜻 열, 파일 경로 인자, 리포트 형식, `--apply`/새 DB/merge | 6장 |
| UTF-8(`chcp 65001`) | 8.2, 8.3 |
| DB 파일 위치 | 3.1 |
| 콘솔 종료 시 종료 시각 기록 | 3.5, 8.2 |
| 장음 기호 | NFC 정규화(4.1, 6.2), 폰트 번들(7.2) |

---

## 14. 스파이크 검증 결과 (2026-09-20)

설계를 확정하기 전에 세션 스크래치패드에서 임시 코드로 확인했다. 코드는 저장소에 넣지 않았다.

### 14.1 채점 알고리즘 — 실제 데이터 178개 단어
| 검증 | 결과 |
|------|------|
| 모든 뜻 셀이 빈 값 없는 묶음으로 분해되는가 | 178개 단어, 194개 묶음 (다중 묶음 단어 15개) 전부 성공 |
| 각 묶음의 첫 동의어를 화면 표기 그대로 입력하면 Perfect인가 | 통과 |
| 괄호 부분을 생략한 입력, 대문자 + `ä ö ü` → `ae oe ue` 입력이 Perfect인가 | 통과 |
| 엉뚱한 입력이 Wrong인가 | 통과 (오탐 없음) |
| PRD 4.2의 `capere` 예시 표 | 6개 케이스 전부 일치 |

- **1차 실행에서 38건이 실패했다.** 원인은 두 가지였다.
  1. 화면에 보이는 정답을 그대로 입력해도(`(zusammen)werfen`) 오답이 됐다. 변형 목록에 원형이 빠져 있었다 → **원형 추가** (T10).
  2. `wie viel(e)?`, `quot?`처럼 물음표가 붙은 뜻이 `wie viel`로는 맞지 않았다 → **`? ! .` 무시** (T10, D36).
- 수정 후 재실행 결과 실패 0건.
- 데이터 사실: 괄호 안 쉼표가 있는 뜻 셀이 있다(`Prometheus (Göttersohn, Schöpfer der Menschen)`, `der (die, das) zweite` 등). 그래서 T11이 필요하다. 뜻 열 채움 수는 뜻1=178, 뜻2=15, 뜻3=1, 뜻4=0, 노트=13이고, 표제어 중복·빈 행·뜻 열 사이 빈칸·NFD 표기는 없다.

### 14.2 `node:sqlite` (WSL Node 24.14)
| 검증 | 결과 |
|------|------|
| 기본 저널 모드 | `delete` (WAL 아님), 닫은 뒤 `t.db` 하나만 남음 |
| `user_version` 설정·조회 | 정상 |
| 트랜잭션 `COMMIT` / `ROLLBACK` | 정상 |
| UNIQUE 위반 | `errcode 2067`, 메시지 `UNIQUE constraint failed: word.headword` → `HEADWORD_EXISTS` 변환 가능 |
| `CHECK (json_valid(...))`, 외래 키 위반 | 각각 오류 발생 |
| 한글·장음 기호·JSON 왕복 | 정상 |
| `date(..., 'localtime')` 그룹핑 | 정상 |
| 읽기 전용 오픈, 쓰기 시도 | `attempt to write a readonly database`로 차단 |

- Windows Node에서는 사용자가 22.13 이상임을 확인했다. **Windows에서의 실제 실행은 아직 검증하지 않았다** — 수동 체크리스트(10장)의 첫 항목이다.

### 14.3 esbuild 번들 + `read-excel-file` 9.3.10
| 검증 | 결과 |
|------|------|
| 번들 크기 | `import.mjs` 약 216KB (xlsx 파서 포함) |
| `node_modules` 없는 디렉터리에서 실행 | 성공 (`createRequire` 배너 필요, 없으면 `Dynamic require of "fs"` 오류) |
| 샘플 xlsx 읽기 | 시트 `Wortschatz` 179행(헤더 포함), 빈 셀은 `null`, 헤더 `["단어","뜻1","뜻2","뜻3","뜻4","노트"]` |
| 번들 안에서 `node:sqlite` import | 정상 (external) |

### 14.4 M0 Windows 스모크 (2026-09-20, `npm run smoke:win`)
전 항목 통과(20/20). 스모크용 최소 서버·CLI를 번들해 확인했다.

| 검증 | 결과 |
|------|------|
| Linux: `node_modules` 없이 번들 실행 | 성공. 서버 `/health`, CLI가 178행·한글 헤더·장음 기호를 읽음. `SIGTERM` 시 DB를 닫고 파일 삭제 |
| Windows: `C:\WordQuiz-dev`에 배포한 번들을 `node.exe`(v24.14.0)로 실행 | 성공. `platform: win32`, SQLite 3.51.2, 파일 DB 생성·조회 |
| Windows: xlsx를 읽어 UTF-8로 출력(파일로 리다이렉트해 바이트 확인) | 한글 `단어`, 장음 기호 `ī`가 깨지지 않음 |
| Windows: 같은 포트로 두 번째 기동 | 안내 메시지와 종료 코드 1 |
| `WSLENV=WORDQUIZ_HOME/p`로 환경변수 전달 | **성공.** `/mnt/c/...` 경로가 `C:\...`로 변환되어 `appHome`에 반영됨 |
| 정리 | 스크립트가 띄운 `node.exe`만 종료, 남은 프로세스 0, 포트 닫힘, 실제 `C:\WordQuiz` 미생성 |
| 번들 크기 | `server.mjs` 2KB(스모크용), `import.mjs` 210KB |

- 이 PC의 Windows Node는 24.14이므로 **최소 버전 22.13은 검증되지 않았다**(M9 수동 체크리스트).
- `read-excel-file`은 TS 소스에서 esbuild 번들로 성공했다. `fflate` 대체안은 필요하지 않다.
- `createRequire` 배너를 `scripts/build.mjs`에 넣었다(없으면 Windows·Linux 모두 `Dynamic require` 오류).

### 14.5 M2 데이터베이스 계층 확인 (2026-09-20, `npm run smoke:win-db`)
같은 검사(`test/support/db-check.ts`)를 **Linux와 Windows(`node.exe`) 양쪽에서** 실행했고 둘 다 전부 통과했다. 이 검사는 vitest를 쓸 수 없는 Windows에서 돌리려고 esbuild로 번들한 뒤 `node:assert`만 쓴다.

| 검증 | 결과 |
|------|------|
| DB 생성, 스캔에 나타남, 한글·장음 기호 왕복, pool 조회 | Windows·Linux 모두 통과 |
| 닫은 뒤 폴더에 `-journal`·`-wal` 등 부속 파일이 없음 | 통과 (T8 실증) |
| `Latin.db`가 있을 때 `latin.db` 생성 | **양쪽 모두 거부**, 원본 무손상 |
| **열려 있는 DB 파일의 삭제·이름 변경** | Windows에서 실패, `close()` 후 성공 (8.5 실증) |
| 읽기 전용 열기 쓰기 차단, 세션 복구 옵트인, 예약 장치 이름 거부 | 통과 |

- **이 검사로 발견해 고친 결함**: 처음에는 `createDatabase`가 OS 파일시스템의 대소문자 규칙에 의존했다. Windows에서는 거부되지만 Linux(WSL)에서는 `latin.db`를 `Latin.db`와 **다른 파일로** 만들어 버렸다. 그래서 `dbNameExists` 검사를 `createDatabase` 안으로 옮겨 모든 OS에서 같게 동작하도록 했다(3.1).
- 자동 테스트 136개(errors 6, migrations 21, transaction 7, open 16, names 30, catalog 17, sessions 6, queries 33)는 임시 디렉터리의 실제 파일 DB를 쓴다.

---

## 15. 향후 확장: 홈 네트워크 별도 서버

이번 범위는 **PC에서 서버를 실행하고 같은 네트워크의 휴대폰 브라우저로 접속**하는 것이다. 휴대폰 단독 실행은 지원하지 않는다(PRD D37). 향후에는 홈 네트워크에 별도 서버를 두고 PC와 휴대폰 모두 거기에 접속하는 방식으로 옮길 계획이다. 그때를 위해 현재 설계에서 유지하는 것과 그때 바꿀 것을 정리한다.

| 구분 | 내용 |
|------|------|
| **이미 대비된 것** | 네이티브 모듈이 없고 `node_modules` 없이 단일 번들로 동작하므로, Node 22.13 이상만 있으면 Linux 서버나 NAS에서도 그대로 실행된다. 데이터는 `.db` 파일 하나라 서버 이전은 파일 복사다. 서버 바인딩(`0.0.0.0` / `--local-only`), 포트(`PORT`), 데이터 위치(`WORDQUIZ_HOME`)가 이미 설정 가능하다. 채점·출제 규칙이 `src/shared`에 분리되어 있다 |
| **지금 넣는 것** | 허용 `Host` 추가 설정 (T15). 점이 있는 이름(`nas.local`)으로 접속해도 막히지 않게 한다 |
| **그때 결정할 것** | ① **인증**: 지금은 LAN 내 무인증이다. 홈 서버가 상시 켜져 있고 다른 기기도 접근할 수 있게 되면 접근 코드(PIN)나 기본 인증을 검토한다 ② 상시 실행 방식(systemd, Docker, NAS 앱 등)과 자동 시작 ③ 백업 주기(`data/backup/`는 merge 직전 백업뿐이다) ④ 리버스 프록시나 HTTPS가 필요한지 ⑤ 파일 이름 대소문자(Linux는 구분, T13) ⑥ 서버 시간대(일자별 통계가 로컬 날짜 기준) |
| **바꾸지 않을 것** | API 계약, DB 스키마, 클라이언트. 서버 위치만 바뀌고 앱 구조는 그대로다 |
