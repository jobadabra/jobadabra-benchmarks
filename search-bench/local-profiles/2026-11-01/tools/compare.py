"""Compares two archived rounds of the local profiles: python3 compare.py <date A folder> <date B folder>  (same candidates matched by city + role)."""
import json,sys
a,b=[json.load(open(f'{d}/summary.json')) for d in sys.argv[1:3]]
k=lambda r:(r['city'],r['role'])
A={k(r):r for r in a['rows']}; B={k(r):r for r in b['rows']}
print(f"{'profile':44} {'N A':>4} {'X A':>4} {'N B':>4} {'X B':>4}  verdict A -> B")
for key in sorted(set(A)|set(B)):
    x,y=A.get(key),B.get(key)
    f=lambda r,n:('-' if not r or r.get(n) is None else r[n])
    print(f"{key[0]+' · '+key[1]:44} {f(x,'n_found'):>4} {f(x,'x_pooled'):>4} {f(y,'n_found'):>4} {f(y,'x_pooled'):>4}  {(x or {}).get('verdict','-')} -> {(y or {}).get('verdict','-')}")
na=sum(r.get('n_found') or 0 for r in a['rows']); nb=sum(r.get('n_found') or 0 for r in b['rows'])
pa=sum(r['verdict']=='pass' for r in a['rows']); pb=sum(r['verdict']=='pass' for r in b['rows'])
print(f"total relevant found: {na} -> {nb}; passing: {pa} -> {pb}")
