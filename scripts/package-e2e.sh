#!/usr/bin/env bash
# Dev-only end-to-end check of `npm run package` and `npm run deploy` (M8 completion criteria
# ②③⑥⑦): zips the real dist/, unpacks it into a node_modules-less folder and starts the server
# from there, deploys twice into a scratch folder and checks data/ and reports/ survive untouched
# and the deployed .bat files are CRLF with no BOM, and on Windows checks that deploy is stopped by
# a running server's server.lock and proceeds with --force. Works inside temporary folders
# (C:\WordQuiz-dev\package-e2e on Windows); never touches C:\WordQuiz. Every server start uses
# --no-open so no browser opens.
set -u

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SAMPLE=$ROOT/data/latin_wortschatz.xlsx
NODE_WIN=${NODE_WIN:-$(command -v node.exe || echo /mnt/d/tools/nodejs/node.exe)}
WIN_DEV=${WIN_DEV:-/mnt/c/WordQuiz-dev}
NODE_FLAGS=--disable-warning=ExperimentalWarning
LINUX_PORT=35992
WIN_PORT=35991
export LC_ALL=C.UTF-8

WIN_DEV_REAL=$(readlink -m "$WIN_DEV")
if [ "${WIN_DEV_REAL,,}" = "/mnt/c/wordquiz" ]; then
  echo "Refusing to run: $WIN_DEV is the real install directory (C:\\WordQuiz)." >&2
  exit 2
fi

TMP=$(mktemp -d)
LPID=""
WINPID=""

cleanup() {
  [ -n "$LPID" ] && kill "$LPID" 2>/dev/null
  [ -n "$WINPID" ] && powershell.exe -NoProfile -Command "Stop-Process -Id $WINPID -Force" >/dev/null 2>&1
  sleep 1
  wait "$LPID" 2>/dev/null
  rm -rf "$TMP" "$WIN_DEV/package-e2e" 2>/dev/null
}
trap cleanup EXIT

PASS=0
FAIL=0
ok()   { PASS=$((PASS + 1)); echo "  PASS  $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  FAIL  $1"; }
expect() { if eval "$2"; then ok "$1"; else fail "$1"; fi; }

wait_health() { # $1 = command that fetches the URL, $2 = seconds
  local i
  for i in $(seq 1 $(($2 * 2))); do
    if out=$($1 2>/dev/null) && [ -n "$out" ]; then echo "$out"; return 0; fi
    sleep 0.5
  done
  return 1
}

# A file that is CRLF end to end and has no byte order mark.
crlf_ok() {
  node --input-type=module -e "
    import fs from 'node:fs';
    const buf = fs.readFileSync(process.argv[1]);
    const bom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
    const text = buf.toString('utf8');
    const bad = /\r(?!\n)/.test(text) || /(?<!\r)\n/.test(text);
    process.exit(bom || bad ? 1 : 0);
  " "$1"
}

echo "== 1. npm run package"
( cd "$ROOT" && npm run package ) >"$TMP/package.out" 2>&1
RC=$?
expect "npm run package exits 0" "[ $RC -eq 0 ]"
[ $RC -ne 0 ] && cat "$TMP/package.out"
ZIP="$ROOT/release/WordQuiz.zip"
expect "zip file was written" "[ -f '$ZIP' ]"
NAMES=$(unzip -Z1 "$ZIP" 2>/dev/null)
for name in start.bat import.bat server.mjs import.mjs public/index.html; do
  expect "zip contains $name" "echo \"\$NAMES\" | grep -qx '$name'"
done
expect "zip carries no data/reports/node_modules/lock" "! echo \"\$NAMES\" | grep -Eq '^(data|reports|node_modules)/|^server\\.lock\$'"

echo "== 2. Linux: unpack into a node_modules-less folder and start the server (criterion (2))"
UNZIP_DIR=$TMP/unpacked
mkdir -p "$UNZIP_DIR" && unzip -q "$ZIP" -d "$UNZIP_DIR"
expect "no node_modules travelled with the zip" "[ ! -e '$UNZIP_DIR/node_modules' ]"
node $NODE_FLAGS "$UNZIP_DIR/server.mjs" --port $LINUX_PORT --no-open >"$TMP/linux-server.log" 2>&1 &
LPID=$!
if H=$(wait_health "curl -s http://127.0.0.1:$LINUX_PORT/api/databases" 8); then
  expect "server answers /api/databases" "echo '$H' | grep -q '\"databases\":\[\]'"
  expect "the web app page is served at /" "curl -s http://127.0.0.1:$LINUX_PORT/ | grep -q '<div id=\"root\">'"
  expect "server.lock was written next to the bundle" "[ -f '$UNZIP_DIR/server.lock' ]"
else
  fail "server did not answer /api/databases"; cat "$TMP/linux-server.log"
fi
kill -TERM "$LPID" 2>/dev/null; wait "$LPID" 2>/dev/null; LPID=""

echo "== 3. Linux: deploy twice; data/reports survive (criterion (3)), .bat files stay CRLF/no BOM (criterion (6))"
DEPLOY_DIR=$TMP/deploy
mkdir -p "$DEPLOY_DIR/data" "$DEPLOY_DIR/reports"
echo "keep-me" > "$DEPLOY_DIR/data/latin.db"
echo "keep-me-too" > "$DEPLOY_DIR/reports/r.txt"
SUM_DATA=$(sha256sum "$DEPLOY_DIR/data/latin.db")
SUM_REPORT=$(sha256sum "$DEPLOY_DIR/reports/r.txt")
node "$ROOT/scripts/deploy.mjs" --dir "$DEPLOY_DIR" >"$TMP/deploy1.out" 2>&1; RC1=$?
expect "first deploy exits 0" "[ $RC1 -eq 0 ]"
[ $RC1 -ne 0 ] && cat "$TMP/deploy1.out"
expect "program files were deployed" "[ -f '$DEPLOY_DIR/start.bat' ] && [ -f '$DEPLOY_DIR/import.bat' ] && [ -f '$DEPLOY_DIR/server.mjs' ] && [ -f '$DEPLOY_DIR/import.mjs' ] && [ -f '$DEPLOY_DIR/public/index.html' ]"
expect "data/ survives the first deploy" "[ \"\$(sha256sum '$DEPLOY_DIR/data/latin.db')\" = \"$SUM_DATA\" ]"
expect "reports/ survives the first deploy" "[ \"\$(sha256sum '$DEPLOY_DIR/reports/r.txt')\" = \"$SUM_REPORT\" ]"
node "$ROOT/scripts/deploy.mjs" --dir "$DEPLOY_DIR" >"$TMP/deploy2.out" 2>&1; RC2=$?
expect "second deploy also exits 0" "[ $RC2 -eq 0 ]"
expect "data/ survives the second deploy" "[ \"\$(sha256sum '$DEPLOY_DIR/data/latin.db')\" = \"$SUM_DATA\" ]"
expect "reports/ survives the second deploy" "[ \"\$(sha256sum '$DEPLOY_DIR/reports/r.txt')\" = \"$SUM_REPORT\" ]"
expect "deployed start.bat is CRLF with no BOM" "crlf_ok '$DEPLOY_DIR/start.bat'"
expect "deployed import.bat is CRLF with no BOM" "crlf_ok '$DEPLOY_DIR/import.bat'"

echo "== 4. Windows ($WIN_DEV)"
if [ ! -x "$NODE_WIN" ]; then
  echo "  SKIP  node.exe not found ($NODE_WIN)"
else
  WIN_TARGET=$WIN_DEV/package-e2e
  mkdir -p "$WIN_TARGET"
  node "$ROOT/scripts/deploy.mjs" --dir "$WIN_TARGET" >"$TMP/win-deploy.out" 2>&1
  expect "deployed to the Windows folder" "[ -f '$WIN_TARGET/start.bat' ] && [ -f '$WIN_TARGET/server.mjs' ]"
  expect "deployed start.bat is CRLF with no BOM on Windows" "crlf_ok '$WIN_TARGET/start.bat'"
  expect "deployed import.bat is CRLF with no BOM on Windows" "crlf_ok '$WIN_TARGET/import.bat'"

  # cmd.exe cannot use a UNC path as its working directory, so it is launched from /mnt/c/...;
  # redirecting NUL to stdin keeps start.bat's closing `pause` from blocking.
  ( cd "$WIN_TARGET" && cmd.exe /c "start.bat --no-open --port $WIN_PORT < NUL" ) >"$TMP/win-server.log" 2>&1 &
  LPID=$!
  if H=$(wait_health "curl.exe -s http://localhost:$WIN_PORT/api/databases" 15); then
    expect "server answers /api/databases on Windows" "echo '$H' | grep -q '\"databases\"'"
    expect "server.lock was written on Windows" "[ -f '$WIN_TARGET/server.lock' ]"
    # start.bat runs server.mjs by its relative name, so the process cannot be told apart by
    # command line; server.lock names the exact pid to kill instead (T16, src/server/lock.ts).
    WINPID=$(grep -o '"pid":[0-9]*' "$WIN_TARGET/server.lock" 2>/dev/null | head -1 | cut -d: -f2)
    expect "server.lock names a pid" "[ -n \"\$WINPID\" ]"

    echo "-- deploy while the server runs is stopped by the lock (criterion (7))"
    node "$ROOT/scripts/deploy.mjs" --dir "$WIN_TARGET" >"$TMP/win-deploy-locked.out" 2>&1; RC=$?
    expect "deploy without --force exits 1" "[ $RC -eq 1 ]"
    expect "deploy explains the lock" "grep -q 'server.lock' '$TMP/win-deploy-locked.out'"
    node "$ROOT/scripts/deploy.mjs" --dir "$WIN_TARGET" --force >"$TMP/win-deploy-forced.out" 2>&1; RC=$?
    expect "deploy --force exits 0" "[ $RC -eq 0 ]"
    expect "server still answers after a forced deploy" "curl.exe -s http://localhost:$WIN_PORT/api/databases | grep -q '\"databases\"'"

    if [ -f "$SAMPLE" ]; then
      echo "-- import.bat check mode with the real sample word list"
      cp "$SAMPLE" "$WIN_TARGET/words.xlsx"
      ( cd "$WIN_TARGET" && cmd.exe /c "import.bat words.xlsx --new-db packagecheck --lang latin --report report.txt" ) >"$TMP/win-import.out" 2>&1; RC=$?
      expect "import.bat exits 0" "[ $RC -eq 0 ]"
      expect "import.bat finds 178 words" "grep -q 'Added             : 178' '$TMP/win-import.out'"
    else
      echo "  SKIP  sample xlsx not found"
    fi
  else
    fail "Windows server did not answer /api/databases"; cat "$TMP/win-server.log"
  fi

  [ -n "$WINPID" ] && powershell.exe -NoProfile -Command "Stop-Process -Id $WINPID -Force" >/dev/null 2>&1
  wait "$LPID" 2>/dev/null; LPID=""; WINPID=""; sleep 1
  rm -f "$WIN_TARGET/server.lock" 2>/dev/null  # a force-killed server leaves its lock behind
  expect "port $WIN_PORT closed after cleanup" "! curl.exe -s -m 2 http://localhost:$WIN_PORT/api/databases >/dev/null 2>&1"
  expect "real install directory untouched" "[ ! -e /mnt/c/WordQuiz ]"
fi

echo
echo "Result: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
