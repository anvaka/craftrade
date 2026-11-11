#!/bin/bash
# The three skill tiers from tools/exp/fun (novice 400 ms, average 250 ms, expert bot delayed 250 ms) against this tree.
#   tools/exp/depth/skill.sh <seeds> [policy ...]
seeds=${1:-100}; shift
cd "$(dirname "$0")/../../.."
[ $# -eq 0 ] && set -- novice average expert-lag250
printf '%s\n' "$@" | xargs -P 4 -I{} sh -c "npx tsx tools/exp/fun/survival.ts {} $seeds x 2>&1 | sed -n 1,6p | cut -c1-260"
