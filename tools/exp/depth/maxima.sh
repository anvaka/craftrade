#!/bin/bash
# Re-measure the server's report caps after a sim change (tools/exp/meta/maxima.ts, five configurations in parallel).
#   tools/exp/depth/maxima.sh <outDir> [seeds=100]      then: npx tsx tools/exp/meta/maxima-report.ts <outDir>
out=$1; seeds=${2:-100}
cd "$(dirname "$0")/../../.."
mkdir -p "$out"
for c in expert average st5 cap5; do npx tsx tools/exp/meta/maxima.ts $c "$seeds" 0 1 "$out/$c.jsonl" > "$out/$c.log" 2>&1 & done
npx tsx tools/exp/meta/maxima.ts idle 30 0 1 "$out/idle.jsonl" > "$out/idle.log" 2>&1 &
wait
