"""Blind judge for search-bench: pools both tools' lists for one persona, drops exact duplicates, shuffles, hides the source and asks the model, per job, 'right role?' and 'right place?'.
Usage: BENCH_JUDGE_KEY=<eval key> python3 judge.py <personas.json> <index> <pool.json> <out.json> [--limit N]
pool.json = [{"tool": "ours"|"career-ops", "title", "company", "location"}] (no URLs, no bodies). out.json = the pool with each job's verdict, the shuffle seed and the token cost.
Same prompt and rules for both tools; the model never sees which tool found a job."""
import json
import os
import random
import re
import sys
import urllib.request

ENGINE = os.environ.get('BENCH_JUDGE_ENGINE', '')   # '' = the Anthropic API with a key; 'plan' = Claude Code on the plan token; 'broker' = the AI broker on this run's OIDC token (the round, 12 Nov 2026)
MODEL = {'plan': 'sonnet (Claude plan)', 'broker': 'sonnet (Claude plan, through the AI broker)'}.get(ENGINE, 'claude-sonnet-5-5')
PRICE = (2.00, 10.00)   # $ per million input/output tokens (src/ai/cost.py, 2 Oct 2026)
BATCH = 60
SYSTEM = ('You check a job search for one job seeker. You get their short profile and a numbered list of jobs (title, employer, place). For EACH job decide two things on their own. '
          'role: would a person with this profile see it as their kind of job? yes = same occupation (any seniority, any employer, any language of the title); no = a different occupation. '
          'place: yes = in their city or a short commute from it, or remote and the text names their country; remote = says remote and names no country, or names many countries (a list such as "Remote - Moldova; Remote - Canada; ..." is worldwide remote, never yes); no = another city or country (including remote limited to another country); unknown = no place given. '
          'Judge only from the title, employer and place shown; do not guess beyond them. Answer with JSON only: {"jobs":[{"n":1,"role":"yes|no","place":"yes|remote|no|unknown"}, ...]} covering every number.')


def real_claude():
    """The Claude Code install itself, never a shell-script wrapper (a wrapper carries a terminal session's settings and the owner's identity)."""
    for folder in os.environ.get('PATH', '').split(os.pathsep):
        path = os.path.join(folder, 'claude')
        if os.access(path, os.X_OK) and not open(path, 'rb').read(120).startswith(b'#!'):
            return path
    raise SystemExit('no claude install found')


def parse_jobs(text):
    """The judge's verdict object: the first complete JSON object in the reply that has a "jobs" list, whatever the model wrote around it.
    Why (12 Nov 2026, run 43314316021, person 10 on the broker: "JSONDecodeError: Extra data"): `\\{.*\\}` took everything from the first brace to the LAST one, so any text or second object after the verdict broke the parse; the plan and API paths had the same line."""
    decoder = json.JSONDecoder()
    for m in re.finditer(r'\{', text):
        try:
            obj, _ = decoder.raw_decode(text, m.start())
        except ValueError:
            continue
        if isinstance(obj, dict) and isinstance(obj.get('jobs'), list):
            return obj
    raise ValueError(f'no JSON object with a "jobs" list in the judge reply ({len(text)} chars, ends {text[-120:]!r})')


def ask_plan(profile, jobs):
    """The same question on the Claude plan ($0 API): no API key in the environment, no settings, no tools, an empty folder."""
    import subprocess, tempfile
    env = {k: v for k, v in os.environ.items() if not k.endswith('_API_KEY') and 'ANTHROPIC' not in k and k != 'BENCH_JUDGE_KEY'}
    prompt = profile + '\n\nJOBS\n' + '\n'.join(f'{j["n"]}. {j["title"]} | {j["company"] or "?"} | {j["location"] or "(no place)"}' for j in jobs)
    out = subprocess.run([real_claude(), '-p', '--model', 'sonnet', '--system-prompt', SYSTEM, '--tools', '', '--setting-sources', '', '--disable-slash-commands', '--strict-mcp-config', '--no-session-persistence',
                          '--output-format', 'json'], input=prompt, capture_output=True, text=True, timeout=900, cwd=tempfile.mkdtemp(), env=env)
    reply = json.loads(out.stdout)
    data = parse_jobs(reply['result'])
    return {r['n']: r for r in data['jobs']}, {'input_tokens': 0, 'output_tokens': 0}


def ask_broker(profile, jobs):
    """The same question through the AI broker (tier mid = Sonnet, Claude engine only): no key, no token of ours, $0; the broker has no system field, so the rules lead the prompt."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # the workflow runs `python3 -I`, which leaves the script's folder off the path
    import broker
    prompt = SYSTEM + '\n\n' + profile + '\n\nJOBS\n' + '\n'.join(f'{j["n"]}. {j["title"]} | {j["company"] or "?"} | {j["location"] or "(no place)"}' for j in jobs)
    answer = broker.ask(prompt, tier='mid')
    data = parse_jobs(answer['reply'])
    return {r['n']: r for r in data['jobs']}, {'input_tokens': 0, 'output_tokens': 0}


def ask(key, profile, jobs):
    if ENGINE == 'broker':
        return ask_broker(profile, jobs)
    if ENGINE == 'plan':
        return ask_plan(profile, jobs)
    body = {'model': MODEL, 'max_tokens': 8000, 'system': SYSTEM, 'messages': [{'role': 'user', 'content': profile + '\n\nJOBS\n' + '\n'.join(
        f'{j["n"]}. {j["title"]} | {j["company"] or "?"} | {j["location"] or "(no place)"}' for j in jobs)}]}
    req = urllib.request.Request('https://api.anthropic.com/v1/messages', json.dumps(body).encode(), {'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'})
    reply = json.load(urllib.request.urlopen(req, timeout=300))
    text = ''.join(b.get('text', '') for b in reply['content'])
    data = parse_jobs(text)
    return {r['n']: r for r in data['jobs']}, reply['usage']


class BudgetExceeded(Exception):
    """The next API call would take the round's judge spend past its approved cap; nothing is sent."""


CAP_USD = float(os.environ.get('BENCH_JUDGE_CAP_USD', '1.00'))   # the owner's approved cap for a round; change it only with his yes
MAX_JOBS = int(os.environ.get('BENCH_JUDGE_MAX_JOBS', '400'))   # a persona's pooled list above this is refused before any call (persona 5 of round 2026-10-20: 1,393 jobs, $0.72)


def estimate_usd(profile, jobs):
    """An upper estimate of one call's cost: characters / 3 as input tokens, 60 output tokens per job (measured 44)."""
    chars = len(SYSTEM) + len(profile) + sum(len(f'{j["n"]}. {j["title"]} | {j["company"] or "?"} | {j["location"] or "(no place)"}') + 1 for j in jobs)
    return chars / 3 / 1e6 * PRICE[0] + 60 * len(jobs) / 1e6 * PRICE[1]


def spent_usd(ledger):
    try:
        return float(json.load(open(ledger))['spent_usd'])
    except (OSError, ValueError, KeyError):
        return 0.0


def judge(p, index, pool, ledger, ask_fn, limit=None, plan=False, cap=None, max_jobs=None, key=''):
    """Judges the pool's distinct jobs and returns (rows, jobs judged, tokens, cost). On the API the round's spend (the ledger file) is counted before every call:
    a list over max_jobs, a persona whose estimate does not fit the rest of the cap, or a batch that would cross it raises BudgetExceeded before that call is sent."""
    cap = CAP_USD if cap is None else cap
    max_jobs = MAX_JOBS if max_jobs is None else max_jobs
    profile = f'Profile: {p["title"]}, 6 years of experience, living in {p["city"]}, {p["country"]}; on-site or hybrid; speaks {p["language"]} and English.'
    unique = {}   # one verdict per distinct job; every tool that found it gets it
    for row in pool:
        unique.setdefault((row['title'].strip().lower(), (row['company'] or '').strip().lower(), (row['location'] or '').strip().lower()), row)
    jobs = list(unique.values())
    random.Random(f'bench-judge-{index}').shuffle(jobs)
    if limit:
        jobs = jobs[:limit]
    numbered = lambda chunk: [{'n': i + 1, **{k: j[k] for k in ('title', 'company', 'location')}} for i, j in enumerate(chunk)]
    if not plan:
        if len(jobs) > max_jobs:
            raise BudgetExceeded(f'{len(jobs)} distinct jobs is over the {max_jobs} a persona may have on the API (use --limit N for a seeded sample, or the plan engine); nothing was sent')
        whole = sum(estimate_usd(profile, numbered(jobs[start:start + BATCH])) for start in range(0, len(jobs), BATCH))
        if spent_usd(ledger) + whole > cap:
            raise BudgetExceeded(f'estimated ${whole:.2f} for this persona plus ${spent_usd(ledger):.2f} already spent is over the ${cap:.2f} cap; nothing was sent')
    tokens = [0, 0]
    for start in range(0, len(jobs), BATCH):
        chunk = numbered(jobs[start:start + BATCH])
        if not plan and spent_usd(ledger) + estimate_usd(profile, chunk) > cap:
            raise BudgetExceeded(f'the next batch would take the round past the ${cap:.2f} cap (${spent_usd(ledger):.2f} spent); stopped before sending it')
        verdicts, usage = ask_fn(key, profile, chunk)
        tokens[0] += usage['input_tokens']; tokens[1] += usage['output_tokens']
        if not plan:
            json.dump({'spent_usd': round(spent_usd(ledger) + usage['input_tokens'] / 1e6 * PRICE[0] + usage['output_tokens'] / 1e6 * PRICE[1], 6)}, open(ledger, 'w'))
        for i, j in enumerate(jobs[start:start + BATCH]):
            v = verdicts.get(i + 1, {})
            j['role'], j['place'] = v.get('role', 'missing'), v.get('place', 'missing')
    verdict = {(j['title'].strip().lower(), (j['company'] or '').strip().lower(), (j['location'] or '').strip().lower()): j for j in jobs}
    for row in pool:
        v = verdict.get((row['title'].strip().lower(), (row['company'] or '').strip().lower(), (row['location'] or '').strip().lower()))
        row['role'], row['place'] = (v['role'], v['place']) if v else ('not-judged', 'not-judged')
    return pool, len(jobs), tokens, tokens[0] / 1e6 * PRICE[0] + tokens[1] / 1e6 * PRICE[1]


def main():
    personas, index, pool_path, out_path = sys.argv[1:5]
    limit = int(sys.argv[sys.argv.index('--limit') + 1]) if '--limit' in sys.argv else None
    plan = ENGINE in ('plan', 'broker')   # both run on a subscription: no per-call price, no ledger
    ledger = os.environ.get('BENCH_JUDGE_LEDGER') or os.path.join(os.path.dirname(os.path.abspath(out_path)), 'judge-spend.json')
    p = json.load(open(personas))['personas'][int(index) - 1]
    try:
        rows, count, tokens, cost = judge(p, index, json.load(open(pool_path)), ledger, ask, limit=limit, plan=plan, key=os.environ.get('BENCH_JUDGE_KEY', ''))
    except BudgetExceeded as error:
        print(f'judge: {error}', file=sys.stderr)
        sys.exit(3)
    json.dump({'persona': p, 'seed': f'bench-judge-{index}', 'model': MODEL, 'judged_jobs': count, 'tokens_in': tokens[0], 'tokens_out': tokens[1], 'cost_usd': round(cost, 4), 'rows': rows}, open(out_path, 'w'), ensure_ascii=False, indent=1)
    print(f'judged {count} distinct jobs, {tokens[0]} in / {tokens[1]} out tokens, ${cost:.4f}' + ('' if plan else f' (round total ${spent_usd(ledger):.2f} of ${CAP_USD:.2f})'))


if __name__ == '__main__':
    main()
