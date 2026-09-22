#!/usr/bin/env bash
# Dev-only: runs the database layer behaviour check (test/support/db-check.ts) on Linux and,
# through node.exe, on Windows. Uses C:\WordQuiz-dev only; never touches C:\WordQuiz.
set -u

ROOT=$(cd "$(dirname "$0")/.." && pwd)
NODE_WIN=${NODE_WIN:-$(command -v node.exe || echo /mnt/d/tools/nodejs/node.exe)}
WIN_DEV=${WIN_DEV:-/mnt/c/WordQuiz-dev}
NODE_FLAGS=--disable-warning=ExperimentalWarning

WIN_DEV_REAL=$(readlink -m "$WIN_DEV")
if [ "${WIN_DEV_REAL,,}" = "/mnt/c/wordquiz" ]; then
  echo "Refusing to run: $WIN_DEV is the real install directory (C:\\WordQuiz)." >&2
  exit 2
fi

TMP=$(mktemp -d)
cleanup() {
  rm -rf "$TMP" "$WIN_DEV/db-check.mjs" "$WIN_DEV/db-check-data" "$WIN_DEV/cross-db-check.mjs" "$WIN_DEV/cross-db-check" 2>/dev/null
}
trap cleanup EXIT

banner="import { createRequire as __wqCreateRequire } from 'node:module'; const require = __wqCreateRequire(import.meta.url);"
"$ROOT/node_modules/.bin/esbuild" "$ROOT/test/support/db-check.ts" --bundle --platform=node --format=esm \
  --target=node22 --banner:js="$banner" --outfile="$TMP/db-check.mjs" --log-level=warning || exit 2
"$ROOT/node_modules/.bin/esbuild" "$ROOT/test/support/cross-db-check.ts" --bundle --platform=node --format=esm \
  --target=node22 --banner:js="$banner" --outfile="$TMP/cross-db-check.mjs" --log-level=warning || exit 2

STATUS=0

echo "== Linux"
node $NODE_FLAGS "$TMP/db-check.mjs" "$TMP/linux-data" || STATUS=1

echo "== Windows ($WIN_DEV)"
if [ ! -x "$NODE_WIN" ]; then
  echo "  SKIP  node.exe not found ($NODE_WIN)"
else
  mkdir -p "$WIN_DEV" && cp "$TMP/db-check.mjs" "$WIN_DEV/db-check.mjs" || exit 2
  WIN_DEV_W=$(wslpath -w "$WIN_DEV")
  timeout 90 "$NODE_WIN" $NODE_FLAGS "$WIN_DEV_W\\db-check.mjs" "$WIN_DEV_W\\db-check-data" 2>&1 | tr -d '\r'
  [ "${PIPESTATUS[0]}" -eq 0 ] || STATUS=1
  [ ! -e /mnt/c/WordQuiz ] || { echo "  FAIL  C:\\WordQuiz exists"; STATUS=1; }
fi

# ------------------------------------------------------------------------------------------
# TECH-SPEC 8.5 "OS를 넘나드는 DB 접근": a database made on one OS must still read correctly
# (read-only, sequentially, never open on both sides at once) from the other, over /mnt/c.
echo "== Cross-platform: made on one OS, read read-only on the other"
if [ ! -x "$NODE_WIN" ]; then
  echo "  SKIP  node.exe not found ($NODE_WIN)"
else
  CROSS_DIR=$WIN_DEV/cross-db-check
  mkdir -p "$CROSS_DIR" && cp "$TMP/cross-db-check.mjs" "$WIN_DEV/cross-db-check.mjs" || exit 2
  CROSS_DIR_W=$(wslpath -w "$CROSS_DIR")

  "$NODE_WIN" $NODE_FLAGS "$WIN_DEV_W\\cross-db-check.mjs" create "$CROSS_DIR_W\\win-made.db" 2>&1 | tr -d '\r'
  [ "${PIPESTATUS[0]}" -eq 0 ] || { echo "  FAIL  could not create win-made.db on Windows"; STATUS=1; }
  node $NODE_FLAGS "$TMP/cross-db-check.mjs" verify "$CROSS_DIR/win-made.db" && echo "  PASS  Linux reads a Windows-made database" \
    || { echo "  FAIL  Linux could not read the Windows-made database"; STATUS=1; }

  node $NODE_FLAGS "$TMP/cross-db-check.mjs" create "$CROSS_DIR/linux-made.db" >/dev/null \
    || { echo "  FAIL  could not create linux-made.db on Linux"; STATUS=1; }
  timeout 30 "$NODE_WIN" $NODE_FLAGS "$WIN_DEV_W\\cross-db-check.mjs" verify "$CROSS_DIR_W\\linux-made.db" 2>&1 | tr -d '\r'
  [ "${PIPESTATUS[0]}" -eq 0 ] && echo "  PASS  Windows reads a Linux-made database" \
    || { echo "  FAIL  Windows could not read the Linux-made database"; STATUS=1; }

  [ ! -e /mnt/c/WordQuiz ] || { echo "  FAIL  C:\\WordQuiz exists"; STATUS=1; }
fi

exit $STATUS
