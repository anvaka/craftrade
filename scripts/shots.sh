#!/bin/sh
# Headless Chrome screenshots of the built game. Usage: scripts/shots.sh <outdir> name=query ...
OUT="$1"; shift
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
npx vite preview --port 4179 --strictPort >/dev/null 2>&1 &
PID=$!
sleep 1.5
for pair in "$@"; do
  name="${pair%%=*}"; query="${pair#*=}"
  "$C" --headless=new --disable-gpu --hide-scrollbars --window-size=${SIZE:-1280,900} --screenshot="$OUT/$name.png" "http://localhost:4179/?$query" 2>/dev/null
done
kill $PID
