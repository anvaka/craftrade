#!/bin/sh
# Build play.html for production and serve it on :8802 (HARNESS for the scripts).
set -e
cd "$(dirname "$0")/../../.."
export HARNESS_OUT="${HARNESS_OUT:-/tmp/scrip-harness}"
npx vite build --config tools/exp/mobile/vite.harness.config.mjs >/dev/null
pkill -f "http.server 8802" 2>/dev/null || true
cd "$HARNESS_OUT" && nohup python3 -m http.server 8802 >/dev/null 2>&1 &
sleep 1
echo "harness on http://localhost:8802/play.html"
