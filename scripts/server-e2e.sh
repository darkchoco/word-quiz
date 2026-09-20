#!/usr/bin/env bash
# Dev-only end-to-end check of the real server with the real sample word list, on Linux and on
# Windows (node.exe): import the words with the CLI, start the server and play through HTTP the
# way the web app will. Works inside temporary folders (C:\WordQuiz-dev\server-e2e on Windows);
# never touches C:\WordQuiz. Every server start uses --no-open so no browser opens.
set -u

ROOT=$(cd "$(dirname "$0")/.." && pwd)
DIST=$ROOT/dist
SAMPLE=$ROOT/data/latin_wortschatz.xlsx
NODE_WIN=${NODE_WIN:-$(command -v node.exe || echo /mnt/d/tools/nodejs/node.exe)}
WIN_DEV=${WIN_DEV:-/mnt/c/WordQuiz-dev}
NODE_FLAGS=--disable-warning=ExperimentalWarning
export LC_ALL=C.UTF-8

WIN_DEV_REAL=$(readlink -m "$WIN_DEV")
if [ "${WIN_DEV_REAL,,}" = "/mnt/c/wordquiz" ]; then
  echo "Refusing to run: $WIN_DEV is the real install directory (C:\\WordQuiz)." >&2
  exit 2
fi
[ -f "$DIST/server.mjs" ] && [ -f "$DIST/import.mjs" ] || { echo "Run 'npm run build' first." >&2; exit 2; }
if [ ! -f "$SAMPLE" ]; then
  echo "SKIP: sample word list not found ($SAMPLE). This check needs the real file."
  exit 0
fi

TMP=$(mktemp -d)
cleanup() {
  powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*WordQuiz-dev*server-e2e*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" >/dev/null 2>&1
  [ -n "${LPID:-}" ] && kill "$LPID" 2>/dev/null
  sleep 1
  rm -rf "$TMP" "$WIN_DEV/server-e2e" 2>/dev/null
}
trap cleanup EXIT

PASS=0
FAIL=0
ok()   { PASS=$((PASS + 1)); echo "  PASS  $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  FAIL  $1"; }
expect() { if eval "$2"; then ok "$1"; else fail "$1"; fi; }

# --- one platform: $1 = linux | win
scenario() {
  local mode=$1 dir dirw port
  if [ "$mode" = linux ]; then
    dir=$TMP/linux; dirw=$dir; port=35994
  else
    dir=$WIN_DEV/server-e2e; dirw=$(wslpath -w "$dir"); port=35993
  fi
  rm -rf "$dir"; mkdir -p "$dir" && cp "$DIST/server.mjs" "$DIST/import.mjs" "$dir/" && cp -r "$DIST/public" "$dir/public" || { fail "cannot prepare $dir"; return; }
  cp "$SAMPLE" "$dir/words.xlsx"

  local NODE_RUN CURL
  if [ "$mode" = linux ]; then NODE_RUN=(node $NODE_FLAGS); CURL=(curl -s); else NODE_RUN=("$NODE_WIN" $NODE_FLAGS); CURL=(curl.exe -s); fi
  native() { if [ "$mode" = linux ]; then echo "$1"; else wslpath -w "$1"; fi; }
  # a small helper that reads the database with the platform's own node, after the server stopped
  dbquery() {
    "${NODE_RUN[@]}" --input-type=module -e "
      import { DatabaseSync } from 'node:sqlite';
      const db = new DatabaseSync(process.argv[1], { readOnly: true });
      console.log(JSON.stringify(db.prepare(process.argv[2]).all()));
    " "$(native "$dir/data/latin.db")" "$1" 2>/dev/null | tr -d '\r'
  }
  api() { # method path [json]
    if [ -n "${3:-}" ]; then "${CURL[@]}" -X "$1" -H 'Content-Type: application/json' -d "$3" "http://localhost:$port$2"
    else "${CURL[@]}" -X "$1" "http://localhost:$port$2"; fi
  }
  start_server() {
    if [ "$mode" = linux ]; then
      "${NODE_RUN[@]}" "$dir/server.mjs" --port $port --no-open >"$TMP/$mode-server.log" 2>&1 &
      LPID=$!
    else
      "${NODE_RUN[@]}" "$dirw\\server.mjs" --port $port --no-open >"$TMP/$mode-server.log" 2>&1 &
      LPID=$!
    fi
    local i; for i in $(seq 1 30); do api GET /api/databases >/dev/null 2>&1 && return 0; sleep 0.5; done; return 1
  }

  echo "-- $mode: 1. import the sample and start the server"
  "${NODE_RUN[@]}" "$(native "$dir/import.mjs")" "$(native "$dir/words.xlsx")" --new-db latin --lang latin --apply >"$TMP/imp.out" 2>&1
  expect "178 words imported" "grep -q 'Added 178' '$TMP/imp.out'"
  start_server && ok "server started" || { fail "server did not start"; cat "$TMP/$mode-server.log"; return; }
  expect "server wrote its lock file" "[ -f '$dir/server.lock' ]"

  echo "-- $mode: 2. play through the API"
  DBS=$(api GET /api/databases)
  expect "the database is listed with 178 words" "echo '$DBS' | grep -q '\"name\":\"latin.db\",\"language\":\"latin\",\"wordCount\":178'"
  expect "no session yet: 404 NO_SESSION" "api GET /api/session | grep -q NO_SESSION"
  SESSION=$(api POST /api/session '{"db":"latin.db"}')
  expect "session started" "echo '$SESSION' | grep -q '\"db\":\"latin.db\"'"
  POOL=$(api GET /api/pool)
  expect "pool: round 1, 178 available" "echo '$POOL' | grep -q '\"nextRoundNumber\":1,\"available\":178'"
  ROUND=$(api POST /api/rounds '{"mode":"normal","direction":"word_to_meaning"}')
  expect "round started with 20 questions" "echo '$ROUND' | grep -q '\"total\":20'"
  RID=$(echo "$ROUND" | grep -o '"roundId":[0-9]*' | head -1 | cut -d: -f2)
  HEAD=$(echo "$ROUND" | sed 's/.*"headword":"\([^"]*\)".*/\1/')
  WORDS=$(api GET /api/words)
  # the first synonym of every group of the asked word, from the words list
  ANSWER=$(echo "$WORDS" | node -e '
    let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
      const head=process.argv[1]; const w=JSON.parse(s).words.find(x=>x.headword===head);
      process.stdout.write(w ? w.meanings.map(g=>g[0]).join(", ") : "");
    })' "$HEAD")
  ANSWER_JSON=$(node -e 'process.stdout.write(JSON.stringify({position:1,input:process.argv[1]}))' "$ANSWER")
  RES=$(api POST "/api/rounds/$RID/answers" "$ANSWER_JSON")
  expect "the right answer is Perfect ($HEAD)" "echo '$RES' | grep -q '\"verdict\":\"perfect\"'"
  expect "status bar counts it" "echo '$RES' | grep -q '\"tested\":1,\"correct\":1'"
  RES2=$(api POST "/api/rounds/$RID/answers" '{"position":2,"input":"xyzzy"}')
  expect "a wrong answer is Wrong and cannot be marked done" "echo '$RES2' | grep -q '\"verdict\":\"wrong\"' && echo '$RES2' | grep -q '\"canMarkDone\":false'"
  expect "the wrong word is in the wrong list" "[ \"\$(api GET /api/wrong | grep -o '\"wrongMark\":true' | wc -l)\" -eq 1 ]"
  expect "a reload continues the round at question 3" "api GET /api/rounds/current | grep -q '\"total\":20,\"answered\":2'"

  echo "-- $mode: 3. protection"
  expect "another host name is refused (403)" "\"\${CURL[@]}\" -w '%{http_code}' -H 'Host: evil.example.com' http://localhost:$port/api/session | grep -q '403\$'"
  expect "a write that is not JSON is refused (415)" "\"\${CURL[@]}\" -w '%{http_code}' -X POST -H 'Content-Type: text/plain' -d '{}' http://localhost:$port/api/rounds | grep -q '415\$'"
  expect "the web app page is served at /" "\"\${CURL[@]}\" http://localhost:$port/ | grep -q '<div id=\"root\">'"
  ASSET=$("${CURL[@]}" http://localhost:$port/ | grep -o '/assets/[^"]*\.js' | head -1)
  expect "the script of the page is served ($ASSET)" "[ \"\$(\"\${CURL[@]}\" -o /dev/null -w '%{http_code}' http://localhost:$port${ASSET})\" = 200 ]"
  expect "the development gallery is not in the served script" "! \"\${CURL[@]}\" http://localhost:$port${ASSET} | grep -q 'Page content'"

  echo "-- $mode: 4. a second server on the same port"
  if [ "$mode" = linux ]; then
    timeout 20 "${NODE_RUN[@]}" "$dir/server.mjs" --port $port --no-open >"$TMP/dup.log" 2>&1; DUP=$?
  else
    timeout 20 "${NODE_RUN[@]}" "$dirw\\server.mjs" --port $port --no-open >"$TMP/dup.log" 2>&1; DUP=$?
  fi
  expect "exit code 1" "[ $DUP -eq 1 ]"
  expect "says the port is in use" "grep -q 'already in use' '$TMP/dup.log'"
  expect "the first server still answers" "api GET /api/session | grep -q '\"db\":\"latin.db\"'"

  echo "-- $mode: 5. stopping the server"
  if [ "$mode" = linux ]; then
    kill -TERM "$LPID"; wait "$LPID" 2>/dev/null; RC=$?; LPID=""
    expect "SIGTERM: exit code 0" "[ $RC -eq 0 ]"
    expect "SIGTERM: lock file removed" "[ ! -e '$dir/server.lock' ]"
    ENDED=$(dbquery "SELECT ended_at IS NOT NULL AS ended FROM session")
    expect "SIGTERM: the session got an end time" "[ '$ENDED' = '[{\"ended\":1}]' ]"
  else
    # Windows offers no signal from here: stop it hard, then check that the next start repairs it
    powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*WordQuiz-dev*server-e2e*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" >/dev/null 2>&1
    wait "$LPID" 2>/dev/null; LPID=""; sleep 1
    expect "killed: the lock file is left behind" "[ -f '$dir/server.lock' ]"
    OPEN=$(dbquery "SELECT ended_at IS NULL AS open FROM session")
    expect "killed: the session was never ended" "[ '$OPEN' = '[{\"open\":1}]' ]"
    start_server && ok "restart works over the stale lock" || fail "restart failed"
    SESSION2=$(api POST /api/session '{"db":"latin.db"}')
    expect "new session started" "echo '$SESSION2' | grep -q '\"sessionId\":2'"
    powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*WordQuiz-dev*server-e2e*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" >/dev/null 2>&1
    wait "$LPID" 2>/dev/null; LPID=""; sleep 1
    REP=$(dbquery "SELECT id, ended_at = last_seen_at AS repaired FROM session ORDER BY id")
    expect "the crashed session was closed at its last sign of life" "echo '$REP' | grep -q '\"id\":1,\"repaired\":1'"
  fi
}

echo "== Linux"
scenario linux

echo "== Windows ($WIN_DEV)"
if [ ! -x "$NODE_WIN" ]; then
  echo "  SKIP  node.exe not found ($NODE_WIN)"
else
  mkdir -p "$WIN_DEV" && scenario win
  expect "real install directory untouched" "[ ! -e /mnt/c/WordQuiz ]"
fi

echo
echo "Result: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
