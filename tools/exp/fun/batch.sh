#!/bin/bash
# Run several policies against one sim root, 4 at a time.
#   tools/exp/fun/batch.sh <label> <simRoot or ""> <outDir> <seeds> policy...
label=$1; root=$2; out=$3; seeds=$4; shift 4
cd "$(dirname "$0")/../../.."
printf '%s\n' "$@" | xargs -P 4 -I{} sh -c "VERBOSE=1 npx tsx tools/exp/fun/survival.ts {} $seeds $label '$root' $out > $out/{}.$label.txt 2>&1"
for p in "$@"; do sed -n 2,5p "$out/$p.$label.txt"; done
