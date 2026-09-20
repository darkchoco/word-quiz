#!/usr/bin/env bash
# Dev-only smoke check for the single-file bundles.
#   1. Linux:   bundles copied to a temp dir WITHOUT node_modules, run with node
#   2. Windows: bundles deployed to C:\WordQuiz-dev, run with node.exe from WSL
# Never touches C:\WordQuiz (the real install) and only kills processes it started itself.
set -u

ROOT=$(cd "$(dirname "$0")/.." && pwd)
DIST=$ROOT/dist
SAMPLE=$ROOT/data/latin_wortschatz.xlsx
NODE_WIN=${NODE_WIN:-$(command -v node.exe || echo /mnt/d/tools/nodejs/node.exe)}
WIN_DEV=${WIN_DEV:-/mnt/c/WordQuiz-dev}
LINUX_PORT=35997
WIN_PORT=35996
ENV_PORT=35995
NODE_FLAGS=--disable-warning=ExperimentalWarning
export LC_ALL=C.UTF-8

PASS=0
FAIL=0
ok()   { PASS=$((PASS + 1)); echo "  PASS  $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  FAIL  $1"; }
check() { if eval "$2"; then ok "$1"; else fail "$1"; fi; }

# --- guard: never operate on the real install directory -----------------------------------
WIN_DEV_REAL=$(readlink -m "$WIN_DEV")
if [ "${WIN_DEV_REAL,,}" = "/mnt/c/wordquiz" ]; then
  echo "Refusing to run: $WIN_DEV is the real install directory (C:\\WordQuiz)." >&2
  exit 2
fi

[ -f "$DIST/server.mjs" ] && [ -f "$DIST/import.mjs" ] || { echo "Run 'npm run build' first." >&2; exit 2; }

TMP=$(mktemp -d)
LPID=""

kill_windows_servers() {
  # Only processes started from C:\WordQuiz-dev (path marker), never the real install.
  powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*WordQuiz-dev*server.mjs*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" >/dev/null 2>&1
}

cleanup() {
  [ -n "$LPID" ] && kill "$LPID" 2>/dev/null
  kill_windows_servers
  sleep 1
  rm -rf "$TMP"
  # A force-killed Windows process leaves its lock file behind; remove it once the process is gone.
  rm -rf "$WIN_DEV/server.lock" "$WIN_DEV/data/smoke.db" "$WIN_DEV/envtest" "$WIN_DEV/sample.xlsx" "$WIN_DEV/sample-report.txt" 2>/dev/null
}
trap cleanup EXIT

wait_health() { # $1 = command that fetches the URL, $2 = seconds
  local i
  for i in $(seq 1 $(($2 * 2))); do
    if out=$($1 2>/dev/null) && [ -n "$out" ]; then echo "$out"; return 0; fi
    sleep 0.5
  done
  return 1
}

# ------------------------------------------------------------------------------------------
# Every server start uses --no-open: the real server would otherwise open the user's browser.
echo "== 1. Linux: bundle only, no node_modules"
mkdir -p "$TMP/linux" && cp "$DIST"/*.mjs "$TMP/linux/"
check "no node_modules next to the bundle" "[ ! -e '$TMP/linux/node_modules' ]"
WORDQUIZ_HOME="$TMP/linux" node $NODE_FLAGS "$TMP/linux/server.mjs" --port $LINUX_PORT --no-open >"$TMP/linux.log" 2>&1 &
LPID=$!
if H=$(wait_health "curl -s http://127.0.0.1:$LINUX_PORT/api/databases" 6); then
  check "server answers /api/databases"          "echo '$H' | grep -q '\"databases\":\[\]'"
  check "lock file is in WORDQUIZ_HOME"          "[ -f '$TMP/linux/server.lock' ]"
  check "another host name is refused (403)"     "[ \"\$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: evil.example.com' http://127.0.0.1:$LINUX_PORT/api/databases)\" = 403 ]"
else
  fail "server did not answer /api/databases"; cat "$TMP/linux.log"
fi
if [ -f "$SAMPLE" ]; then
  # Check mode only: nothing is written except the report file that is named here.
  node $NODE_FLAGS "$TMP/linux/import.mjs" "$SAMPLE" --new-db importcheck --lang latin --report "$TMP/linux-report.txt" >"$TMP/linux-cli.out" 2>&1
  check "cli exits 0"                  "[ $? -eq 0 ]"
  check "cli finds 178 words"          "grep -q 'Added             : 178' '$TMP/linux-cli.out'"
  check "cli finds no errors"          "grep -q 'Errors            : 0' '$TMP/linux-cli.out'"
  check "cli prints macron (ī)"        "grep -q 'Prōmētheus' '$TMP/linux-cli.out'"
else
  echo "  SKIP  sample xlsx not found ($SAMPLE)"
fi
kill -TERM "$LPID" 2>/dev/null; wait "$LPID" 2>/dev/null; RC=$?; LPID=""
check "SIGTERM stops the server with exit code 0" "[ $RC -eq 0 ]"
check "SIGTERM removes the lock file"             "[ ! -e '$TMP/linux/server.lock' ]"

# ------------------------------------------------------------------------------------------
echo "== 2. Windows: node.exe via WSL, deployed to $WIN_DEV"
if [ ! -x "$NODE_WIN" ]; then
  echo "  SKIP  node.exe not found ($NODE_WIN)"
else
  WIN_DEV_W=$(wslpath -w "$WIN_DEV")
  mkdir -p "$WIN_DEV" && cp "$DIST"/*.mjs "$WIN_DEV/" || { fail "cannot write to $WIN_DEV"; }
  [ -f "$SAMPLE" ] && cp "$SAMPLE" "$WIN_DEV/sample.xlsx"

  "$NODE_WIN" $NODE_FLAGS "$WIN_DEV_W\\server.mjs" --port $WIN_PORT --no-open >"$TMP/win-server.log" 2>&1 &
  if H=$(wait_health "curl.exe -s http://localhost:$WIN_PORT/api/databases" 8); then
    check "server answers /api/databases on Windows"   "echo '$H' | grep -q '\"databases\"'"
    check "lock file is next to the bundle"            "[ -f '$WIN_DEV/server.lock' ]"
    check "lock file names a Windows process"          "grep -q '\"port\":$WIN_PORT' '$WIN_DEV/server.lock'"
    check "another host name is refused (403)"         "curl.exe -s -w '%{http_code}' -H 'Host: evil.example.com' http://localhost:$WIN_PORT/api/databases | grep -q '403$'"
  else
    fail "Windows server did not answer /api/databases"; cat "$TMP/win-server.log"
  fi

  if [ -f "$WIN_DEV/sample.xlsx" ]; then
    "$NODE_WIN" $NODE_FLAGS "$WIN_DEV_W\\import.mjs" "$WIN_DEV_W\\sample.xlsx" --new-db importcheck --lang latin --report "$WIN_DEV_W\\sample-report.txt" >"$TMP/win-cli.out" 2>&1
    check "cli exits 0 on Windows"             "[ $? -eq 0 ]"
    check "cli finds 178 words on Windows"     "grep -q 'Added             : 178' '$TMP/win-cli.out'"
    check "cli reads the Korean header (no errors)" "grep -q 'Errors            : 0' '$TMP/win-cli.out'"
    check "UTF-8 macron (ī) survives"          "grep -q 'Prōmētheus' '$TMP/win-cli.out'"
  else
    echo "  SKIP  sample xlsx not found"
  fi

  # A second instance on the same port must refuse with a clear message and exit code 1.
  timeout 20 "$NODE_WIN" $NODE_FLAGS "$WIN_DEV_W\\server.mjs" --port $WIN_PORT --no-open >"$TMP/win-dup.log" 2>&1
  DUP=$?
  check "port in use -> exit code 1"        "[ $DUP -eq 1 ]"
  check "port in use -> clear message"      "grep -q 'already in use' '$TMP/win-dup.log'"

  # Can WORDQUIZ_HOME reach a Windows process? (WSLENV path translation) The lock file shows where it went.
  mkdir -p "$WIN_DEV/envtest"
  WSLENV=WORDQUIZ_HOME/p WORDQUIZ_HOME="$WIN_DEV/envtest" "$NODE_WIN" $NODE_FLAGS "$WIN_DEV_W\\server.mjs" --port $ENV_PORT --no-open >"$TMP/win-env.log" 2>&1 &
  if wait_health "curl.exe -s http://localhost:$ENV_PORT/api/databases" 8 >/dev/null; then
    check "WSLENV passes WORDQUIZ_HOME (the lock file is in that folder)" "[ -f '$WIN_DEV/envtest/server.lock' ]"
  else
    fail "server with WORDQUIZ_HOME did not answer"; cat "$TMP/win-env.log"
  fi

  kill_windows_servers; sleep 1
  check "port $WIN_PORT closed after cleanup" "! curl.exe -s -m 2 http://localhost:$WIN_PORT/api/databases >/dev/null 2>&1"
  check "port $ENV_PORT closed after cleanup" "! curl.exe -s -m 2 http://localhost:$ENV_PORT/api/databases >/dev/null 2>&1"
  check "real install directory untouched"    "[ ! -e /mnt/c/WordQuiz ]"
fi

echo
echo "Result: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
