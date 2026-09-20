#!/usr/bin/env bash
# Dev-only: screenshots of the web app with headless Windows Chrome (from WSL), into docs/ui-checks/,
# and a count of the errors the browser console reported. Uses the bundles of `npm run build`, a
# temporary home with the sample words imported, and a web app built with `--mode shots` (which
# includes the component gallery). Never touches C:\WordQuiz.
set -u

ROOT=$(cd "$(dirname "$0")/.." && pwd)
DIST=$ROOT/dist
SAMPLE=$ROOT/data/latin_wortschatz.xlsx
OUT=${OUT:-$ROOT/docs/ui-checks}
CHROME=${CHROME:-"/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"}
WINTMP=${WINTMP:-/mnt/c/Users/$USER/AppData/Local/Temp}
PORT=35992
API=http://127.0.0.1:$PORT
PAGE=http://localhost:$PORT
export LC_ALL=C.UTF-8

[ -f "$DIST/server.mjs" ] || { echo "Run 'npm run build' first." >&2; exit 2; }
[ -f "$SAMPLE" ] || { echo "Sample word list not found: $SAMPLE" >&2; exit 2; }
[ -x "$CHROME" ] || { echo "Chrome not found: $CHROME" >&2; exit 2; }
[ -d "$WINTMP" ] || { echo "Windows temp folder not found: $WINTMP (set WINTMP)" >&2; exit 2; }

HOME_DIR=$(mktemp -d)
CONSOLE=$(mktemp)
SPID=""
cleanup() {
  [ -n "$SPID" ] && kill -TERM "$SPID" 2>/dev/null && wait "$SPID" 2>/dev/null
  rm -rf "$HOME_DIR" "$CONSOLE"
}
trap cleanup EXIT
mkdir -p "$OUT"

cp "$DIST/server.mjs" "$DIST/import.mjs" "$HOME_DIR/"
export WORDQUIZ_HOME=$HOME_DIR
node --disable-warning=ExperimentalWarning "$HOME_DIR/import.mjs" "$SAMPLE" --new-db latin --lang latin --apply --report "$HOME_DIR/report.txt" >/dev/null || { echo "import failed"; exit 1; }
(cd "$ROOT" && npx vite build --mode shots --outDir "$HOME_DIR/public" --emptyOutDir --logLevel warn) || { echo "vite build failed"; exit 1; }

node --disable-warning=ExperimentalWarning "$HOME_DIR/server.mjs" --port $PORT --no-open >"$HOME_DIR/server.log" 2>&1 &
SPID=$!
for _ in $(seq 1 40); do curl -s -o /dev/null "$API/api/databases" && break; sleep 0.25; done
curl -s -o /dev/null "$API/api/databases" || { echo "server did not start"; cat "$HOME_DIR/server.log"; exit 1; }

# (preferredColorScheme=0 is the dark one in this Chrome.)
# Headless Chrome will not make a window narrower than about 500 px, so phone screenshots show
# the page inside an iframe of the real phone width (its own viewport, so media queries and
# layout are those of a phone).
cat >"$HOME_DIR/public/phone.html" <<'HTML'
<!doctype html><meta charset="utf-8"><body style="margin:0;background:#888">
<iframe id="f" style="width:390px;height:100vh;border:0;background:#fff"></iframe>
<script>document.getElementById('f').src = '/' + location.hash</script>
HTML

# shot <name> <width> <height> <path-after-host> [dark]
shot() {
  local name=$1 w=$2 h=$3 path=$4 dark=${5:-}
  local args=(--headless=new --disable-gpu --hide-scrollbars --enable-logging=stderr --v=0
    --window-size="$w,$h" --virtual-time-budget=6000 "--screenshot=C:\\Users\\$USER\\AppData\\Local\\Temp\\wq-$name.png")
  [ -n "$dark" ] && args+=(--blink-settings=preferredColorScheme=0)
  "$CHROME" "${args[@]}" "$PAGE/$path" 2>&1 | grep -i "CONSOLE" >>"$CONSOLE"
  mv "$WINTMP/wq-$name.png" "$OUT/$name.png" && echo "  $OUT/$name.png"
}

echo "== start screen"
DOM=$("$CHROME" --headless=new --disable-gpu --virtual-time-budget=6000 --dump-dom "$PAGE/" 2>/dev/null)
START_BTN=$(echo "$DOM" | grep -o "<button[^>]*>Start" | head -1)
if [ -n "$START_BTN" ] && ! echo "$START_BTN" | grep -q disabled; then echo "  Start button is enabled"; else echo "  FAIL: Start button missing or disabled: $START_BTN"; STARTFAIL=1; fi
shot start-desktop 1100 700 ""
shot start-mobile 500 800 "phone.html"
shot start-dark 1100 700 "" dark

echo "== shell (session started)"
curl -s -X POST -H 'Content-Type: application/json' -d '{"db":"latin.db"}' "$API/api/session" -o /dev/null
shot shell-desktop 1100 700 "#/quiz"
shot shell-mobile 500 800 "phone.html#/words"
shot shell-dark 1100 700 "#/quiz" dark

echo "== quiz (a round is open: the page continues at its question)"
curl -s -X POST -H 'Content-Type: application/json' -d '{"mode":"normal","direction":"word_to_meaning"}' "$API/api/rounds" -o /dev/null
shot quiz-question-desktop 1100 700 "#/quiz"
shot quiz-question-mobile 500 800 "phone.html#/quiz"
shot quiz-question-dark 1100 700 "#/quiz" dark
curl -s -X DELETE "$API/api/session" -o /dev/null

echo "== gallery"
shot gallery 1000 6200 "#/dev"
shot gallery-mobile 500 9500 "phone.html#/dev"
shot dialog-nodb 1000 600 "#/dev/nodb"
shot dialog-switch 1000 600 "#/dev/switch"
shot dialog-done3 1000 600 "#/dev/done3"
shot dialog-done3-mobile 500 800 "phone.html#/dev/done3"
shot dialog-switch-dark 1000 600 "#/dev/switch" dark

echo
# every line of the browser console counts, so a check that saw nothing cannot pass by accident
TOTAL=$(wc -l <"$CONSOLE")
BAD=$(grep -ci "ERROR\|WARNING" "$CONSOLE")
echo "Browser console lines: $TOTAL, errors/warnings: $BAD"
[ "$BAD" -gt 0 ] && cat "$CONSOLE"
[ "$BAD" -eq 0 ] && [ -z "${STARTFAIL:-}" ]
