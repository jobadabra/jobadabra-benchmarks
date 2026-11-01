#!/bin/bash
# Judges the EURES lists (X): ./xjudge_all.sh c01 c02 ...   (PATH must hold a real claude: ./pinbin)
cd "$(dirname "$0")"; W="${JS_WORK:-work}"
[ -x pinbin/claude ] && export PATH="$PWD/pinbin:$PATH"
for id in "$@"; do
  n=$(python3 -c "import json;print(len(json.load(open('$W/$id.eures.json'))))")
  if [ "$n" = "0" ]; then echo "XJUDGE $id empty"; continue; fi
  python3 judgex.py $id $W/$id.eures.json $W/$id.eures.judged.json && python3 - <<PY
import json
rows=json.load(open('$W/$id.eures.judged.json'))['rows']
rel={(r['title'].strip().lower(),r['company'].strip().lower()) for r in rows if r.get('role')=='yes' and r.get('place')=='yes'}
print('XJUDGE $id', len(rel), 'relevant unique of', len(rows))
PY
done
echo "XJUDGE ALL DONE"
