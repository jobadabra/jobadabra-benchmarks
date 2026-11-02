"""One candidate end to end: CV, live search on the Claude plan (run.mjs, no API key), jobs out of the install, blind judge. python3 pipe.py <id> [--quick]
JP_REPO = the jobadabra checkout to run (a worktree of its own; never switch it while a run goes). Writes work/run-<id>/."""
import json,os,sqlite3,subprocess,sys,tempfile,time
from pathlib import Path
HERE=Path(__file__).resolve().parent
JP=Path(os.environ.get('JP_REPO',Path.home()/'jobadabra'))
WORK=Path(os.environ.get('JS_WORK',HERE/'work'))
cid=sys.argv[1]; quick='--quick' in sys.argv
c=next(x for x in json.load(open(HERE/'cands.json')) if x['id']==cid)
sys.path.insert(0,str(JP/'tools'/'persona-search'))
import draw
from personas import pdf
fam=next(f for f in draw.DATA['families'] if f['id']==c['family'])
city={'city':c['city'],'country':c['country'],'language':c['language']}
out=WORK/f'run-{cid}'; (out/'draw').mkdir(parents=True,exist_ok=True)
lines=draw.cv(fam,city,'Alex Example')
(out/'draw'/'cv.pdf').write_bytes(pdf(lines)); (out/'draw'/'cv.md').write_text('\n'.join(lines)+'\n')
(out/'draw'/'draw.json').write_text(json.dumps({'seed':f'js-{cid}','family':c['family'],'city':c['city'],'country':c['country']}))
env={k:v for k,v in os.environ.items() if k not in ('ANTHROPIC_API_KEY','LAB_HEAL_ANTHROPIC_KEY','RANDOM_DRAWS_ANTHROPIC_KEY','OPENAI_API_KEY','REPLAYS_PUBLISH_KEY','NET_RECORD_KEY','PR_PROOF_ANTHROPIC_KEY')}
env['JOBADABRA_NO_DOTENV']='1'
tag=f'js{cid}'
print(f'START {cid} {c["title"]} {c["city"]} quick={quick}',flush=True)
t0=time.time()
r=subprocess.run(['node','tools/persona-search/run.mjs','draw',str(out),'--presses','1','--fresh','--tag',tag]+(['--first-only'] if quick else []),cwd=JP,env=env)
print(f'RUN exit {r.returncode} in {int(time.time()-t0)} s',flush=True)
if r.returncode: print('FAILED run',cid); sys.exit(1)
press=json.loads((out/'draw'/'presses.jsonl').read_text().splitlines()[0])
db=Path(tempfile.gettempdir())/f'jp-persona-draw-{tag}'/'data'/'jobs.sqlite'
con=sqlite3.connect(db)
rows=[{'tool':'ours','title':t,'company':co or '','location':loc or '','provider':s or ''} for t,co,loc,s in con.execute("SELECT j.title, co.name, j.location, s.name FROM jobs j LEFT JOIN companies co ON co.id=j.company_id LEFT JOIN sources s ON s.id=j.source_id WHERE j.state='open'")]
json.dump(rows,open(out/'ours.json','w'),ensure_ascii=False)
print(f'JOBS {len(rows)} open; engine in_places {press.get("in_places")} local_jobs {press.get("local_jobs")} seconds {press.get("seconds")}',flush=True)
if rows:
    j=subprocess.run([sys.executable,str(HERE/'judgex.py'),cid,str(out/'ours.json'),str(out/'ours.judged.json')],capture_output=True,text=True)
    print('JUDGE',j.stdout.strip(),j.stderr.strip()[-200:])
    if j.returncode: print('FAILED judge',cid); sys.exit(1)
    rel=[r for r in json.load(open(out/'ours.judged.json'))['rows'] if r.get('role')=='yes' and r.get('place')=='yes']
else: rel=[]
print(f'N {cid} {len(rel)} relevant of {len(rows)} shown',flush=True)
print('DONE',cid)
