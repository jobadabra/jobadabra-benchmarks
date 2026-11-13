"""The search round's simple rivals (owner, 27 Oct 2026): what a person gets when they search each one themselves for the persona's role and city.
Each keeps the FIRST 100 results it shows (about five pages), as judge pool rows: title, company, location, provider. No posting text, no URL.
Usage (on CI only, by hand: .github/workflows/search-rivals.yml): python3 rivals.py <jobspy|eures|adzuna|jooble> <personas.json> <index 1-10> <out.json>
- jobspy: python-jobspy as shipped (LinkedIn, Indeed, Glassdoor, Google), one call per site, no login or cookies. Its reads stay in this
  benchmark: never copied into Jobadabra's product or index (owner, 27 Oct 2026).
- eures: the EU job portal's own public search (no key), the role as keyword and the city's own area (NUTS-3) as the place, each row labelled by its own place codes.
- adzuna: its public API (ADZUNA_APP_ID / ADZUNA_APP_KEY), the role as `what`, the city as `where`; only the countries Adzuna serves.
- jooble: its REST API (owner, 12 Nov 2026: "test these 2 against us, and against EURES"), the role as `keywords`, the city as `location`. Jooble's keys are per country
  domain (a jooble.org key reads US jobs only; free plan 100 calls a day per key), so JOOBLE_API_KEYS is one JSON secret {"de": "<key>", ...}."""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

KEEP = 100
# The persona city's own area, as EURES lists places (NUTS 3, NUTS 2021), and that area's name for the judge.
# Why (2 Nov 2026, Gitar on benchmarks#12): a NUTS-2 prefix plus the region's name as every row's place made Blagoevgrad jobs read as Sofia, so the judge
# said "right place" for jobs in another town. The prefix is the city's own code; the label is built from each row's own codes (xcount.py in local-profiles/2026-11-01).
REGIONS = {'Sofia': ('bg411', 'Sofia (stolitsa)'), 'Cluj-Napoca': ('ro113', 'Cluj'), 'Brussels': ('be100', 'Brussels-Capital Region'),
           'Zurich': ('ch040', 'Zurich'), 'Krakow': ('pl213', 'Krakow (city)'), 'Zagreb': ('hr050', 'City of Zagreb'),
           'Stockholm': ('se110', 'Stockholm county'), 'Nuremberg': ('de254', 'Nuremberg (city)'), 'Helsinki': ('fi1b1', 'Helsinki-Uusimaa'),
           'Lisbon': ('pt170', 'Lisbon metropolitan area'),
           # Why (13 Nov 2026, owner via sa: "Can we measure with both our rivals: JobSPy, Jobble and EURES"): EURES is a rival of the extra Trello profiles too (search-targets.yml); the city's own NUTS-3 area
           # (NUTS 2021), written from the NUTS list, not yet read from a run: a wrong code reads as 0 or "no town known", so the first targets run's EURES column is looked at before it is trusted.
           'Amsterdam': ('nl329', 'Greater Amsterdam'), 'Rotterdam': ('nl33a', 'Greater Rijnmond'), 'Vienna': ('at130', 'Vienna'), 'Graz': ('at221', 'Graz'),
           'Lyon': ('fr716', 'Rhone'), 'Toulouse': ('fr623', 'Haute-Garonne'), 'Paris': ('fr101', 'Paris'), 'Madrid': ('es300', 'Madrid'),
           'Valencia': ('es523', 'Valencia'), 'Seville': ('es618', 'Seville'), 'Milan': ('itc4c', 'Milan'), 'Bologna': ('ith55', 'Bologna'),
           'Naples': ('itf33', 'Naples'), 'Prague': ('cz010', 'Prague'), 'Brno': ('cz064', 'South Moravian Region'), 'Copenhagen': ('dk011', 'Copenhagen'),
           'Oslo': ('no081', 'Oslo'), 'Tallinn': ('ee001', 'Northern Estonia'), 'Ljubljana': ('si041', 'Central Slovenia'), 'Bratislava': ('sk010', 'Bratislava Region'),
           'Berlin': ('de300', 'Berlin'), 'Geneva': ('ch013', 'Geneva'), 'Monthey': ('ch012', 'Valais'),
           'Lausanne': ('ch011', 'Vaud'),   # Why (13 Nov 2026, owner via sa: d07 "If we have to choose just one. Let's choose Lausanne"): the rivals' one place for d07; EURES lists a canton, so Vaud
           'Switzerland': ('ch', 'Switzerland')}   # d06's rival place is the country (owner, 13 Nov 2026: "Switzerland (Recommended)"); EURES takes the country code (2,219 records for one search, probed)
OUTSIDE_EURES = {'Moldova'}   # EURES covers the EU, the EEA and Switzerland
# The extra profiles' areas above were written from the NUTS list and no run has shown them returning jobs yet; the 10 cities before them were proven by the rounds. Take a city out of this set once a run's EURES column shows rows for it.
UNVERIFIED = {'Amsterdam', 'Rotterdam', 'Vienna', 'Graz', 'Lyon', 'Toulouse', 'Paris', 'Madrid', 'Valencia', 'Seville', 'Milan', 'Bologna', 'Naples', 'Prague', 'Brno', 'Copenhagen', 'Oslo',
              'Tallinn', 'Ljubljana', 'Bratislava', 'Berlin', 'Geneva', 'Monthey', 'Lausanne', 'Switzerland'}
ADZUNA = {'Belgium': 'be', 'Switzerland': 'ch', 'Poland': 'pl', 'Germany': 'de', 'Austria': 'at', 'France': 'fr', 'Netherlands': 'nl', 'Spain': 'es', 'Italy': 'it'}
# Jooble's country domain for each persona country (the key is only valid on its own domain).
JOOBLE = {'Bulgaria': 'bg', 'Romania': 'ro', 'Belgium': 'be', 'Switzerland': 'ch', 'Poland': 'pl', 'Croatia': 'hr', 'Sweden': 'se', 'Germany': 'de', 'Finland': 'fi', 'Portugal': 'pt',
          # Why (13 Nov 2026, sa for the owner, "take the target from Jooble or JobSpy"): the 20 extra Trello profiles (search-targets.yml); Estonia, Slovenia and Moldova stay out: ee.jooble.org, si.jooble.org and md.jooble.org have no DNS record (checked 13 Nov 2026)
          'Netherlands': 'nl', 'Austria': 'at', 'France': 'fr', 'Spain': 'es', 'Italy': 'it', 'Czechia': 'cz', 'Denmark': 'dk', 'Norway': 'no', 'Slovakia': 'sk'}
JOOBLE_PAGE = 50   # asked per page; Jooble may return fewer, so the loop stops on a short page
JOOBLE_MAX_CALLS = 5   # a persona's key has 100 calls a day: never a retry loop


def post(url, body):
    req = urllib.request.Request(url, json.dumps(body).encode(), {'content-type': 'application/json', 'accept': 'application/json', 'user-agent': 'jobadabra-benchmarks'})
    return json.load(urllib.request.urlopen(req, timeout=60))


def eures(p):
    """EURES's place filter takes large regions only (NUTS 1, e.g. be1; be10 returns nothing): that region's best matches, page by page
    (at most 10 pages of 50), keeping those whose place code lies in the city's own area (NUTS 3), until 100 are kept. Each row's place is built from its own codes in that area."""
    if p['country'] in OUTSIDE_EURES:
        return None   # Why (13 Nov 2026, sa: "Moldova has no EURES"): a country outside EURES is "not served", named and left out of the target, never 0; any other city missing from REGIONS stays a KeyError, by name (Gitar on #39)
    region, name = REGIONS[p['city']]
    rows, scanned, place, coarse = [], 0, region[:3], 0   # coarse = jobs whose only codes are broader than the city's area (no town known)
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
            if not inside and any(region.upper().startswith(c.upper()) for c in places):
                coarse += 1
            if inside:
                rows.append({'tool': 'eures', 'title': j.get('title') or '', 'company': (j.get('employer') or {}).get('name') or '',
                             'location': f"{p['city']} area ({name}, {', '.join(inside)}), {p['country']}", 'provider': 'EURES', 'found': data.get('numberRecords'), 'filter': place})
        if len(rows) >= KEEP or len(jvs) < 50:
            break
    if not rows and not coarse and p['city'] in UNVERIFIED:
        return None   # Why (13 Nov 2026, Gitar on #39, sa: "a code is trusted only once a run showed it returns jobs for that place"): a hand-written code that has returned no job of its area may be wrong, so it is unknown, never a 0 in the target's average
    if not rows and coarse:
        return None   # Why (2 Nov 2026, coordinator on benchmarks#14): jobs that carry only a region code (Krakow: PL21) do not say which town, so "none in the city" is unknown, never 0
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


def jooble(p):
    cc = JOOBLE.get(p['country'])
    if not cc:
        return None   # not served: the page says "not in this country", never 0
    key = json.loads(os.environ.get('JOOBLE_API_KEYS') or '{}').get(cc)
    if not key:
        raise RuntimeError(f'Jooble: no key for {cc} in JOOBLE_API_KEYS')   # a missing key is a named failure, never "not served" or 0
    rows = []
    for page in range(1, JOOBLE_MAX_CALLS + 1):
        try:
            data = post(f'https://{cc}.jooble.org/api/{key}', {'keywords': p['title'], 'location': p['city'], 'page': str(page), 'ResultOnPage': str(JOOBLE_PAGE)})
        except urllib.error.HTTPError as error:
            raise RuntimeError(f'Jooble {cc}: HTTP {error.code}') from None   # urllib's own message is fine, but the URL holds the key: never let it reach a log
        jobs = data.get('jobs') or []
        rows += [{'tool': 'jooble', 'title': j.get('title') or '', 'company': j.get('company') or '', 'location': j.get('location') or '',
                  'provider': 'Jooble', 'found': data.get('totalCount')} for j in jobs]
        if len(rows) >= KEEP or len(jobs) < JOOBLE_PAGE:
            break
    return rows[:KEEP]


def jobspy(p):
    from jobspy import scrape_jobs   # python-jobspy, pinned in the workflow
    rows, errors = [], {}
    for site in ('linkedin', 'indeed', 'glassdoor', 'google'):
        try:
            where = p['country'] if p['city'] == p['country'] else f"{p['city']}, {p['country']}"   # a rival place that is the country itself (d06) is asked as the country, not "Switzerland, Switzerland"
            ask = dict(site_name=[site], search_term=p['title'], google_search_term=f"{p['title']} jobs near {where}",
                       location=where, results_wanted=25, verbose=0)
            try:
                df = scrape_jobs(**ask, country_indeed=p['country'].lower())
            except ValueError as error:
                # Why (13 Nov 2026, run 43432473083, c09 Tallinn: all 4 sites "Invalid country_indeed: 'estonia'"): JobSpy checks Indeed's country list before any site; LinkedIn and Google take no Indeed country,
                # so they run without it (nothing was sent before the check); Indeed and Glassdoor stay a named error.
                if 'country_indeed' not in str(error) or site not in ('linkedin', 'google'):
                    raise
                df = scrape_jobs(**ask)
            for _, r in df.iterrows():
                rows.append({'tool': 'jobspy', 'title': str(r.get('title') or ''), 'company': str(r.get('company') or ''),
                             'location': str(r.get('location') or ''), 'provider': f'JobSpy/{site}'})
        except Exception as error:   # a site JobSpy can't search for this country is a result, not a stop
            errors[site] = f'{type(error).__name__}: {error}'[:200]
    return rows[:KEEP], errors


def rival_persona(p):
    """(the persona the rivals search, why none). A persona without an `area` is searched as it is. One with an area is searched at its `rival_place` (its city in the rivals' place); with an
    area and no rival place there is no search: None + the reason, so the row reads "not measured", never a guessed town. Why (13 Nov 2026, owner via sa: d07 "If we have to choose just one.
    Let's choose Lausanne"; d06 "the entire Switzerland" has no town the owner chose): our N counts the whole area, the rivals one place, and the table says which."""
    if not p.get('area'):
        return p, None
    if not p.get('rival_place'):
        return None, 'the persona has an area and no rival_place chosen'
    return {**p, 'city': p['rival_place']}, None


if __name__ == '__main__':
    kind, personas, index, out = sys.argv[1:5]
    p = json.load(open(personas))['personas'][int(index) - 1]
    errors = {}
    searched, why = rival_persona(p)
    if searched is None:
        rows = None
    elif kind == 'jobspy':
        rows, errors = jobspy(searched)
    else:
        rows = {'eures': eures, 'adzuna': adzuna, 'jooble': jooble}[kind](searched)
    meta = {'rival': kind, 'persona': p, 'kept': None if rows is None else len(rows), 'notServed': rows is None, 'errors': errors, **({'reason': why} if why else {}), **({'searched': searched['city']} if searched is not p else {})}
    json.dump(rows, open(out, 'w'), ensure_ascii=False, indent=1)   # Why (2 Nov 2026, coordinator): null = not served / not measured; pool.mjs lists a non-list as missing (unknown), an empty list is a real 0
    json.dump(meta, open(out.replace('.json', '.meta.json'), 'w'), ensure_ascii=False, indent=1)
    print(kind, p['city'], 'not served' if rows is None else f'{len(rows)} rows', json.dumps(errors)[:300])
