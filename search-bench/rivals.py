"""The search round's simple rivals (owner, 27 Oct 2026): what a person gets when they search each one themselves for the persona's role and city.
Each keeps the FIRST 100 results it shows (about five pages), as judge pool rows: title, company, location, provider. No posting text, no URL.
Usage (on CI only, by hand: .github/workflows/search-rivals.yml): python3 rivals.py <jobspy|eures|adzuna> <personas.json> <index 1-10> <out.json>
- jobspy: python-jobspy as shipped (LinkedIn, Indeed, Glassdoor, Google), one call per site, no login or cookies. Its reads stay in this
  benchmark: never copied into Jobadabra's product or index (owner, 27 Oct 2026).
- eures: the EU job portal's own public search (no key), the role as keyword and the city's own area (NUTS-3) as the place, each row labelled by its own place codes.
- adzuna: its public API (ADZUNA_APP_ID / ADZUNA_APP_KEY), the role as `what`, the city as `where`; only the countries Adzuna serves."""
import json
import os
import sys
import urllib.parse
import urllib.request

KEEP = 100
# The persona city's own area, as EURES lists places (NUTS 3, NUTS 2021), and that area's name for the judge.
# Why (2 Nov 2026, Gitar on benchmarks#12): a NUTS-2 prefix plus the region's name as every row's place made Blagoevgrad jobs read as Sofia, so the judge
# said "right place" for jobs in another town. The prefix is the city's own code; the label is built from each row's own codes (xcount.py in local-profiles/2026-11-01).
REGIONS = {'Sofia': ('bg411', 'Sofia (stolitsa)'), 'Cluj-Napoca': ('ro113', 'Cluj'), 'Brussels': ('be100', 'Brussels-Capital Region'),
           'Zurich': ('ch040', 'Zurich'), 'Krakow': ('pl213', 'Krakow (city)'), 'Zagreb': ('hr050', 'City of Zagreb'),
           'Stockholm': ('se110', 'Stockholm county'), 'Nuremberg': ('de254', 'Nuremberg (city)'), 'Helsinki': ('fi1b1', 'Helsinki-Uusimaa'),
           'Lisbon': ('pt170', 'Lisbon metropolitan area')}
ADZUNA = {'Belgium': 'be', 'Switzerland': 'ch', 'Poland': 'pl', 'Germany': 'de', 'Austria': 'at', 'France': 'fr', 'Netherlands': 'nl', 'Spain': 'es', 'Italy': 'it'}


def post(url, body):
    req = urllib.request.Request(url, json.dumps(body).encode(), {'content-type': 'application/json', 'accept': 'application/json', 'user-agent': 'jobadabra-benchmarks'})
    return json.load(urllib.request.urlopen(req, timeout=60))


def eures(p):
    """EURES's place filter takes large regions only (NUTS 1, e.g. be1; be10 returns nothing): that region's best matches, page by page
    (at most 10 pages of 50), keeping those whose place code lies in the city's own area (NUTS 3), until 100 are kept. Each row's place is built from its own codes in that area."""
    region, name = REGIONS[p['city']]
    rows, scanned, place = [], 0, region[:3]
    for page in range(1, 11):
        body = {'resultsPerPage': 50, 'page': page, 'sortSearch': 'BEST_MATCH', 'keywords': [{'keyword': p['title'], 'specificSearchCode': 'EVERYWHERE'}],
                'publicationPeriod': None, 'occupationUris': [], 'skillUris': [], 'requiredExperienceCodes': [], 'positionScheduleCodes': [], 'sectorCodes': [],
                'educationAndQualificationLevelCodes': [], 'positionOfferingCodes': [], 'locationCodes': [place], 'euresFlagCodes': [], 'otherBenefitsCodes': [],
                'requiredLanguages': [], 'minNumberPost': None, 'sessionId': 'jobadabra-benchmarks'}
        data = post('https://europa.eu/eures/api/jv-searchengine/public/jv-search/search', body)
        if page == 1 and not data.get('numberRecords') and place != region[:2]:   # some countries take no region code (fi1: 0, fi: 1,126): the country
            place = region[:2]; body['locationCodes'] = [place]; data = post('https://europa.eu/eures/api/jv-searchengine/public/jv-search/search', body)
        jvs = data.get('jvs', []); scanned += len(jvs)
        for j in jvs:
            places = [c for codes in (j.get("locationMap") or {}).values() for c in (codes or []) if c]
            inside = [c for c in places if c.upper().startswith(region.upper())]
            if inside:
                rows.append({'tool': 'eures', 'title': j.get('title') or '', 'company': (j.get('employer') or {}).get('name') or '',
                             'location': f"{p['city']} area ({name}, {', '.join(inside)}), {p['country']}", 'provider': 'EURES', 'found': data.get('numberRecords'), 'filter': place})
        if len(rows) >= KEEP or len(jvs) < 50:
            break
    for r in rows:
        r['scanned'] = scanned
    return rows[:KEEP]


def adzuna(p):
    cc = ADZUNA.get(p['country'])
    if not cc:
        return None   # not served: the page says "not in this country", never 0
    rows = []
    for page in (1, 2):
        q = urllib.parse.urlencode({'app_id': os.environ['ADZUNA_APP_ID'], 'app_key': os.environ['ADZUNA_APP_KEY'], 'what': p['title'], 'where': p['city'], 'results_per_page': 50})
        data = json.load(urllib.request.urlopen(f'https://api.adzuna.com/v1/api/jobs/{cc}/search/{page}?{q}', timeout=60))
        rows += [{'tool': 'adzuna', 'title': j.get('title') or '', 'company': (j.get('company') or {}).get('display_name') or '',
                  'location': (j.get('location') or {}).get('display_name') or '', 'provider': 'Adzuna', 'found': data.get('count')} for j in data.get('results', [])]
        if len(data.get('results', [])) < 50:
            break
    return rows[:KEEP]


def jobspy(p):
    from jobspy import scrape_jobs   # python-jobspy, pinned in the workflow
    rows, errors = [], {}
    for site in ('linkedin', 'indeed', 'glassdoor', 'google'):
        try:
            df = scrape_jobs(site_name=[site], search_term=p['title'], google_search_term=f"{p['title']} jobs near {p['city']}, {p['country']}",
                             location=f"{p['city']}, {p['country']}", results_wanted=25, country_indeed=p['country'].lower(), verbose=0)
            for _, r in df.iterrows():
                rows.append({'tool': 'jobspy', 'title': str(r.get('title') or ''), 'company': str(r.get('company') or ''),
                             'location': str(r.get('location') or ''), 'provider': f'JobSpy/{site}'})
        except Exception as error:   # a site JobSpy can't search for this country is a result, not a stop
            errors[site] = f'{type(error).__name__}: {error}'[:200]
    return rows[:KEEP], errors


if __name__ == '__main__':
    kind, personas, index, out = sys.argv[1:5]
    p = json.load(open(personas))['personas'][int(index) - 1]
    errors = {}
    if kind == 'jobspy':
        rows, errors = jobspy(p)
    else:
        rows = {'eures': eures, 'adzuna': adzuna}[kind](p)
    meta = {'rival': kind, 'persona': p, 'kept': None if rows is None else len(rows), 'notServed': rows is None, 'errors': errors}
    json.dump(rows or [], open(out, 'w'), ensure_ascii=False, indent=1)
    json.dump(meta, open(out.replace('.json', '.meta.json'), 'w'), ensure_ascii=False, indent=1)
    print(kind, p['city'], 'not served' if rows is None else f'{len(rows)} rows', json.dumps(errors)[:300])
