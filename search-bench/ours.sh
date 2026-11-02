#!/bin/bash
# Our search on THIS MAC, on its plan with the shipped models: a side note and a before/after tool for product fixes, never the round's
# scoreboard (the round runs ours on CI on Haiku 5.5 beside the rivals: .github/workflows/search-ours.yml; owner, 27 Oct 2026).
# One persona at a time, on this Mac's Claude plan ($0), a fresh throwaway install, the persona's fake CV, PRESSES Find jobs presses
# (default 1; each press has the product's own 3-minute cap). The page shows both "first search" and "after 3 searches" (owner, 27 Oct 2026).
# Usage: WORK=<dir> JP=<jobadabra checkout on main> [PRESSES=3] search-bench/ours.sh <from> <to>   (out: <dir>/ours, or <dir>/ours-3x)
B=${WORK:?set WORK=<scratch dir>}; REPO=$(cd "$(dirname "$0")/.." && pwd); JP=${JP:-$HOME/jobadabra}
N=${PRESSES:-1}; O=ours; [ "$N" = 1 ] || O=ours-${N}x
TMP=$(python3 -c 'import tempfile;print(tempfile.gettempdir())')
echo "OURS build ($N press(es)) $(git -C $JP rev-parse --short HEAD)"
for i in $(seq $1 $2); do
  mkdir -p $B/$O/p$i
  JP=$JP python3 -I $REPO/search-bench/make-cv.py $REPO/search-bench/personas.json $i $B/$O/p$i >/dev/null || { echo "OURS p$i FAILED cv"; continue; }
  start=$(date +%s)
  (cd $JP && env -u ANTHROPIC_API_KEY -u OPENAI_API_KEY JOBADABRA_NO_DOTENV=1 \
    bash tools/heavy-lock.sh persona-search node tools/persona-search/run.mjs draw $B/$O/p$i --presses $N --fresh --tag bench$N-$i > $B/$O/p$i.log 2>&1)
  echo "OURS p$i done in $(( $(date +%s) - start )) s: $(grep '^PRESS' $B/$O/p$i.log | cut -c1-110 | tr '\n' ' ')"
  python3 -I $REPO/search-bench/extract.py ours $TMP/jp-persona-draw-bench$N-$i/data/jobs.sqlite $B/$O/p$i.json
done
echo "OURS ALL DONE"
