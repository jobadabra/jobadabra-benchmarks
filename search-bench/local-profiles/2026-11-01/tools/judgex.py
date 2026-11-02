"""Judge a pool with the benchmark's blind judge (search-bench/judge.py) on the Claude plan ($0 API): python3 judgex.py <id> <pool.json> <out.json>
Needs a real claude install on PATH (never a shell wrapper); see README 'Claude binary'."""
import json,os,subprocess,sys,tempfile
from pathlib import Path
HERE=Path(__file__).resolve().parent
JUDGE=HERE.parents[2]/'judge.py'
cid,pool,out=sys.argv[1:4]
c=next(x for x in json.load(open(HERE/'cands.json')) if x['id']==cid)
d=tempfile.mkdtemp(); pj=os.path.join(d,'personas.json')
json.dump({'personas':[{'title':c['title'],'city':c['city'],'country':c['country'],'language':c['language']}]},open(pj,'w'))
env={k:v for k,v in os.environ.items() if not k.endswith('_API_KEY') and 'ANTHROPIC' not in k}
env['BENCH_JUDGE_ENGINE']='plan'
r=subprocess.run(['python3',str(JUDGE),pj,'1',pool,out],env=env,capture_output=True,text=True)
print(r.stdout.strip(),r.stderr.strip()[-300:]); sys.exit(r.returncode)
