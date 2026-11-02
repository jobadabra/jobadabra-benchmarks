#!/bin/bash
# A search-bench round (copy of the driver that ran round 2026-10-20). One persona at a time: career-ops on the runner and our search at the same moment, then extract + blind judge. Usage: WORK=<dir> round.sh <from> <to>
B=${WORK:?set WORK=<scratch dir for this round>}; REPO=$(cd "$(dirname "$0")/.." && pwd); JP=${JP:-$HOME/jobadabra}
TMP=$(python3 -c 'import tempfile;print(tempfile.gettempdir())')
cd $REPO
for i in $(seq $1 $2); do
  echo "BENCH p$i start $(date -u +%FT%TZ)"
  mkdir -p $B/ours/p$i $B/co/p$i
  python3 -I $REPO/search-bench/make-cv.py $REPO/search-bench/personas.json $i $B/ours/p$i >/dev/null || { echo "BENCH p$i FAILED cv"; continue; }
  gh workflow run search-bench-career-ops.yml -f persona=$i || { echo "BENCH p$i FAILED dispatch"; continue; }
  sleep 10
  RUN=$(gh run list --workflow=search-bench-career-ops.yml --limit 1 --json databaseId --jq '.[0].databaseId')
  (cd $JP && env -u ANTHROPIC_API_KEY -u LAB_HEAL_ANTHROPIC_KEY -u RANDOM_DRAWS_ANTHROPIC_KEY -u OPENAI_API_KEY -u REPLAYS_PUBLISH_KEY -u NET_RECORD_KEY JOBADABRA_NO_DOTENV=1 \
    node tools/persona-search/run.mjs draw $B/ours/p$i --presses 1 --fresh --tag bench$i > $B/ours/p$i.log 2>&1)
  echo "BENCH p$i ours done: $(grep '^PRESS' $B/ours/p$i.log)"
  gh run watch $RUN >/dev/null 2>&1
  gh run download $RUN -D $B/co/p$i >/dev/null 2>&1
  CO=$B/co/p$i/career-ops-persona-$i
  echo "BENCH p$i career-ops: $(head -c 200 $CO/receipt.json) seconds=$(cat $CO/seconds.txt)"
  python3 -I $REPO/search-bench/extract.py ours $TMP/jp-persona-draw-bench$i/data/jobs.sqlite $B/ours/p$i.json
  python3 -I $REPO/search-bench/extract.py career-ops $CO/scan-history.tsv $B/co/p$i/co.json
  python3 -I -c "import json;json.dump(json.load(open('$B/ours/p$i.json'))+json.load(open('$B/co/p$i/co.json')),open('$B/pool$i.json','w'))"
  BENCH_JUDGE_KEY=$(security find-generic-password -a jobadabra -s jobadabra.anthropic.judge_exam_key -w) python3 -I $REPO/search-bench/judge.py $REPO/search-bench/personas.json $i $B/pool$i.json $B/judged$i.json
  echo "BENCH p$i DONE $(date -u +%FT%TZ)"
done
echo "BENCH ALL DONE"
