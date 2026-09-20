#!/usr/bin/env bash
# Dev-only end-to-end check of the import CLI with the real sample word list, on Linux and on
# Windows (node.exe). Runs the bundled dist/import.mjs the way a user would.
# Works inside temporary folders (C:\WordQuiz-dev\import-e2e on Windows); never touches C:\WordQuiz.
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
[ -f "$DIST/import.mjs" ] || { echo "Run 'npm run build' first." >&2; exit 2; }
if [ ! -f "$SAMPLE" ]; then
  echo "SKIP: sample word list not found ($SAMPLE). This check needs the real file."
  exit 0
fi

TMP=$(mktemp -d)
cleanup() { rm -rf "$TMP" "$WIN_DEV/import-e2e" 2>/dev/null; }
trap cleanup EXIT

PASS=0
FAIL=0
ok()   { PASS=$((PASS + 1)); echo "  PASS  $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  FAIL  $1"; }
has()  { if grep -qF -- "$2" "$1"; then ok "$3"; else fail "$3   (missing: $2)"; fi; }
lacks() { if grep -qF -- "$2" "$1"; then fail "$3   (found: $2)"; else ok "$3"; fi; }

# --- run one scenario on one platform: $1 = linux | win
scenario() {
  local mode=$1 dir dirw native
  if [ "$mode" = linux ]; then
    dir=$TMP/linux
    dirw=$dir
    native() { echo "$1"; }
  else
    dir=$WIN_DEV/import-e2e
    dirw=$(wslpath -w "$dir")
    native() { wslpath -w "$1"; }
  fi
  rm -rf "$dir"; mkdir -p "$dir" && cp "$DIST/import.mjs" "$dir/import.mjs" || { fail "cannot prepare $dir"; return; }
  cp "$SAMPLE" "$dir/words.xlsx"

  imp() {
    if [ "$mode" = linux ]; then
      timeout 60 node $NODE_FLAGS "$dir/import.mjs" "$@" >"$TMP/out.txt" 2>"$TMP/err.txt"
    else
      timeout 60 "$NODE_WIN" $NODE_FLAGS "$dirw\\import.mjs" "$@" >"$TMP/out.txt" 2>"$TMP/err.txt"
    fi
    RC=$?
    tr -d '\r' <"$TMP/out.txt" >"$TMP/out.lf"
  }
  local words changed
  words=$(native "$dir/words.xlsx")
  changed=$(native "$dir/changed.xlsx")

  echo "-- $mode: 1. check only (new database)"
  imp "$words" --new-db latin --lang latin
  [ "$RC" -eq 0 ] && ok "exit code 0" || fail "exit code $RC"
  has "$TMP/out.lf" "Added             : 178" "178 words would be added"
  has "$TMP/out.lf" "Errors            : 0" "no errors in the sample"
  [ ! -e "$dir/data/latin.db" ] && ok "no database was created" || fail "database exists after a check"
  local report; report=$(ls "$dir"/reports/words_*.txt 2>/dev/null | head -1)
  [ -n "$report" ] && ok "report file written" || fail "no report file"
  if [ -n "$report" ]; then
    has "$report" "Prōmētheus, Prōmēthei" "report keeps macrons (UTF-8)"
    has "$report" "quō?" "report keeps macron and question mark"
    [ "$(head -c3 "$report" | od -An -tx1 | tr -d ' ')" != "efbbbf" ] && ok "report has no byte order mark" || fail "report starts with a BOM"
    lacks "$report" $'\xef\xbf\xbd' "report has no replacement characters"
  fi

  echo "-- $mode: 2. apply (new database)"
  imp "$words" --new-db latin --lang latin --apply
  [ "$RC" -eq 0 ] && ok "exit code 0" || fail "exit code $RC"
  has "$TMP/out.lf" "Result: APPLIED. Added 178, updated 0." "178 words applied"
  [ -s "$dir/data/latin.db" ] && ok "database file created" || fail "database file missing"
  [ ! -e "$dir/data/backup" ] && ok "no backup for a new database" || fail "unexpected backup"

  echo "-- $mode: 3. check the same file again"
  imp "$words" --db latin
  [ "$RC" -eq 0 ] && ok "exit code 0" || fail "exit code $RC"
  has "$TMP/out.lf" "Unchanged         : 178" "all 178 words unchanged"
  has "$TMP/out.lf" "Added             : 0" "nothing to add"
  has "$TMP/out.lf" "Nothing to apply" "says there is nothing to apply"

  echo "-- $mode: 4. change one cell, check, then apply"
  ( cd "$ROOT" && node --input-type=module -e "
    import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
    import { readFileSync, writeFileSync } from 'node:fs';
    const files = unzipSync(new Uint8Array(readFileSync(process.argv[1])));
    const key = 'xl/sharedStrings.xml';
    const xml = strFromU8(files[key]);
    if (xml.split('<t>wohin?, wo?</t>').length !== 2) throw new Error('sample row 132 is not the expected text');
    files[key] = strToU8(xml.replace('<t>wohin?, wo?</t>', '<t>wohin?, wo?, wohin</t>'));
    writeFileSync(process.argv[2], zipSync(files));
  " "$SAMPLE" "$dir/changed.xlsx" ) || { fail "could not create the changed copy"; return; }
  imp "$changed" --db latin
  [ "$RC" -eq 0 ] && ok "exit code 0" || fail "exit code $RC"
  has "$TMP/out.lf" "Updated           : 1" "one word updated"
  has "$TMP/out.lf" "Unchanged         : 177" "177 words unchanged"
  has "$TMP/out.lf" "meanings : [wohin?, wo?]  ->  [wohin?, wo?, wohin]" "shows old and new meanings"
  [ ! -e "$dir/data/backup" ] && ok "a check makes no backup" || fail "a check created a backup"
  imp "$changed" --db latin --apply
  [ "$RC" -eq 0 ] && ok "exit code 0" || fail "exit code $RC"
  has "$TMP/out.lf" "Result: APPLIED. Added 0, updated 1." "update applied"
  local nb; nb=$(ls "$dir"/data/backup/latin.*.db 2>/dev/null | wc -l)
  [ "$nb" -eq 1 ] && ok "one backup was made (VACUUM INTO)" || fail "expected 1 backup, found $nb"
  local bk; bk=$(ls "$dir"/data/backup/latin.*.db 2>/dev/null | head -1)
  [ -n "$bk" ] && [ -s "$bk" ] && ok "backup is not empty" || fail "backup is empty"

  echo "-- $mode: 5. a name that only differs in case is refused"
  imp "$words" --new-db Latin --lang latin --apply
  [ "$RC" -eq 2 ] && ok "exit code 2" || fail "exit code $RC (expected 2)"
  has "$TMP/err.txt" "A database named latin.db already exists" "explains which database is in the way"
  [ "$(ls "$dir/data" | grep -c '\.db$')" -eq 1 ] && ok "still exactly one database" || fail "another database appeared"
  echo "-- $mode: 6. output piped into a reader that stops early does not crash"
  if [ "$mode" = linux ]; then
    timeout 60 node $NODE_FLAGS "$dir/import.mjs" "$words" --db latin 2>"$TMP/pipe-err.txt" | head -1 >/dev/null
  else
    timeout 60 "$NODE_WIN" $NODE_FLAGS "$dirw\\import.mjs" "$words" --db latin 2>"$TMP/pipe-err.txt" | head -1 >/dev/null
  fi
  local rcp=${PIPESTATUS[0]}
  if [ "$mode" = linux ]; then
    [ "$rcp" -eq 0 ] && ok "exit code 0 (no EPIPE crash)" || fail "exit code $rcp"
  else
    # Here bash sees the WSL relay of node.exe, which is ended by SIGPIPE (141) when head closes
    # the pipe. That is not the exit code of the program, so only its error output is checked.
    ok "exit code not checked on Windows (it belongs to the WSL relay: $rcp)"
  fi
  [ ! -s "$TMP/pipe-err.txt" ] && ok "nothing on stderr" || fail "stderr: $(head -c 200 "$TMP/pipe-err.txt")"
}

echo "== Linux"
scenario linux

echo "== Windows ($WIN_DEV)"
if [ ! -x "$NODE_WIN" ]; then
  echo "  SKIP  node.exe not found ($NODE_WIN)"
else
  mkdir -p "$WIN_DEV" && scenario win
  [ ! -e /mnt/c/WordQuiz ] && ok "real install directory untouched" || fail "C:\\WordQuiz exists"
fi

echo
echo "Result: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
