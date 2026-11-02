"""X by script, independent of our engine: EURES's public search (no login, no key), the role as keyword, the city's NUTS-3 area as place, the first 100 in-area matches.
Why (2 Nov 2026, Gitar on #12): `prefix` is the city's own NUTS-3 code (cands.json `region` names it), and each row's `location` is built from ITS OWN codes inside that area, never the
candidate's region: with a NUTS-2 prefix and the region name as every row's place, Annecy and Grenoble read as Lyon and Portoroz as Ljubljana, which inflated X.
python3 xcount.py [<candidate id>...]   (no id = every candidate in cands.json)  ->  work/<id>.eures.json"""
import json,sys,os
from pathlib import Path
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[2]))   # search-bench/ holds rivals.py
from rivals import post
WORK=Path(os.environ.get('JS_WORK',HERE/'work')); WORK.mkdir(exist_ok=True)
def eures_rows(c, keep=100):
    rows,scanned,place=[],0,c['filter']
    for page in range(1,11):
        body={'resultsPerPage':50,'page':page,'sortSearch':'BEST_MATCH','keywords':[{'keyword':c['title'],'specificSearchCode':'EVERYWHERE'}],'publicationPeriod':None,'occupationUris':[],'skillUris':[],'requiredExperienceCodes':[],'positionScheduleCodes':[],'sectorCodes':[],'educationAndQualificationLevelCodes':[],'positionOfferingCodes':[],'locationCodes':[place],'euresFlagCodes':[],'otherBenefitsCodes':[],'requiredLanguages':[],'minNumberPost':None,'sessionId':'jobadabra-xcount'}
        d=post('https://europa.eu/eures/api/jv-searchengine/public/jv-search/search',body)
        if page==1 and not d.get('numberRecords') and place!=c['filter'][:2]:
            place=c['filter'][:2]; body['locationCodes']=[place]; d=post('https://europa.eu/eures/api/jv-searchengine/public/jv-search/search',body)
        jvs=d.get('jvs',[]); scanned+=len(jvs)
        for j in jvs:
            codes=[x for v in (j.get('locationMap') or {}).values() for x in (v or []) if x]
            inside=[x for x in codes if x.upper().startswith(c['prefix'].upper())]   # this row's own codes in the city's area (the row may list others outside it)
            if inside:
                rows.append({'tool':'eures','title':j.get('title') or '','company':(j.get('employer') or {}).get('name') or '','location':f"{c['city']} area ({c['region']}, {', '.join(inside)}), {c['country']}",'provider':'EURES','found':d.get('numberRecords')})
        if len(rows)>=keep or len(jvs)<50: break
    return rows[:keep],scanned
if __name__=='__main__':
    want=sys.argv[1:]
    for c in json.load(open(HERE/'cands.json')):
        if want and c['id'] not in want: continue
        try: rows,s=eures_rows(c)
        except Exception as e: print(c['id'],c['city'],'ERR',e); continue
        json.dump(rows,open(WORK/f"{c['id']}.eures.json",'w'),ensure_ascii=False)
        print(c['id'],c['city'],c['title'],'in-region',len(rows),'scanned',s,flush=True)
