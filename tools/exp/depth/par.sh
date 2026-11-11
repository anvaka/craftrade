#!/bin/bash
# Run jobs across cores, one process per job.
#   tools/exp/depth/par.sh <outDir> <seeds> <policy[@character]> ...     CONC=n sets the parallelism (default 4)
out=$1; seeds=$2; shift 2
cd "$(dirname "$0")/../../.."
printf '%s\n' "$@" | xargs -P "${CONC:-4}" -I{} npx tsx tools/exp/depth/run.ts "$out" "$seeds" {}
