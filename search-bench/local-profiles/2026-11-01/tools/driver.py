"""Runs candidates one at a time (no load on the Mac); a run over 40 min or a failure is a failed try; the 2nd failed try stops everything. python3 driver.py <id>...
Claude binary: put a private copy of claude.exe at ./pinbin/claude first (cp <global claude-code>/bin/claude.exe pinbin/claude): the global install is swapped by auto-updates
and is missing for ~10 s each time (1 Nov 2026: 4 runs died on it, not on the search)."""
import os,signal,subprocess,sys,time
from pathlib import Path
HERE=Path(__file__).resolve().parent
PIN=HERE/'pinbin'
fails=0
for cid in sys.argv[1:]:
    t0=time.time()
    env=dict(os.environ,PATH=f'{PIN}:'+os.environ['PATH']) if (PIN/'claude').exists() else dict(os.environ)
    p=subprocess.Popen([sys.executable,'-u',str(HERE/'pipe.py'),cid,'--quick'],start_new_session=True,env=env)
    try: code=p.wait(timeout=2400)
    except subprocess.TimeoutExpired:
        os.killpg(p.pid,signal.SIGKILL); code=-9; print(f'HANG {cid} killed after 40 min',flush=True)
    print(f'QUEUE {cid} exit {code} in {int(time.time()-t0)} s',flush=True)
    if code:
        fails+=1
        if fails>=2: print('QUEUE STOP: two failed or hung runs',flush=True); break
print('QUEUE END',flush=True)
