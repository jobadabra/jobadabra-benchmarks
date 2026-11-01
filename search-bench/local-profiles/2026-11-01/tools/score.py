"""Scores candidates with the board's pooled rule: python3 score.py c01 c02 ...  (X = unique relevant jobs of EURES and ours; pass = N >= X)"""
import json,sys,os
from pathlib import Path
W=Path(os.environ.get('JS_WORK',Path(__file__).resolve().parent/'work'))
def rel(path):
    import os
    if not os.path.exists(path): return set()
    return {(r['title'].strip().lower(),(r['company'] or '').strip().lower()) for r in json.load(open(path))['rows'] if r.get('role')=='yes' and r.get('place')=='yes'}
for cid in sys.argv[1:]:
    e=rel(W/f'{cid}.eures.judged.json'); o=rel(W/f'run-{cid}'/'ours.judged.json')
    x=e|o
    print(cid,'N',len(o),'eures',len(e),'overlap',len(e&o),'X(pooled)',len(x),('not measured' if not e else 'PASS' if len(o)>=len(x) else 'below'))
