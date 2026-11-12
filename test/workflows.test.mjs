// Benchmarks run by hand only (owner, 27 Oct 2026: "We don't want to run this benchmarks daily on the CI. We want to trigger them
// manually, from time to time. Maybe once in a half a year"): every workflow here starts on workflow_dispatch and nothing else.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';

const dir = path.join(import.meta.dirname, '..', '.github', 'workflows');
const triggersOf = text => {   // the keys directly under `on:` (block form), or the inline value
  const lines = text.split('\n'), i = lines.findIndex(l => /^on:/.test(l));
  if (i < 0) return [];
  const inline = lines[i].replace(/^on:\s*/, '').trim(); if (inline) return inline.replace(/[[\]]/g, '').split(',').map(s => s.trim());
  const keys = []; for (const l of lines.slice(i + 1)) { if (/^\S/.test(l)) break; const m = l.match(/^ {2}([a-z_]+):/); if (m) keys.push(m[1]); }
  return keys;
};
const files = fs.readdirSync(dir).filter(f => /\.ya?ml$/.test(f));
test('there are workflows to check', () => assert.ok(files.length > 0));
// The one exception: the weekly rounds run on a schedule (owner via 6e, 27 Oct 2026: "Yes: fixed set + weekly new set (Recommended)"; via 5b:
// "Weekly, ours only (Recommended)": ours on the fixed set "catches our regressions"; in 4e's window: "Both (Recommended)"). A full round with
// every rival on the fixed set stays by hand.
// The search round too, every 3 days (owner, 27 Oct 2026: "I want job search benchmarks to run on the CI and me getting telegram
// notifications"; "not weekly, but every 3 days"); it calls the ours and rivals workflows, which also start by hand.
const SCHEDULED = {'form-weekly.yml': ['schedule', 'workflow_dispatch'], 'search-round.yml': ['schedule', 'workflow_dispatch'],
  'form-round-job.yml': ['workflow_call'],   // the form round's one job, called by form-round.yml (12 Nov 2026)
  'search-ours.yml': ['workflow_dispatch', 'workflow_call'], 'search-rivals.yml': ['workflow_dispatch', 'workflow_call']};
// Unit tests are no benchmark: a workflow that holds no secret and runs only a test file may start on a PR or a push (search-bench-tests.yml,
// 21 Oct 2026: the judge's spend-cap tests, no API call).
const isUnitTests = text => !/secrets\./.test(text) && /^\s+- run: python3 -I search-bench\/test_\w+\.py$/m.test(text);
// PR labels are no benchmark either (owner, 2 Nov 2026: "basically on all the repos in the org... the same workflow"): the label workflow writes labels on a PR, holds no secret (the job's
// own token only) and runs jobadabra's scripts from its main; its exact triggers are listed, so any other trigger still fails here.
const LABELS = {'pr-labels.yml': ['push', 'pull_request_target', 'pull_request_review', 'issue_comment', 'check_run']};   // check_run added by #19 (5 Nov 2026, jobadabra#3176); the guard was not updated and main's test was red
for (const f of files) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8');
  // Why (2 Nov 2026, Gitar on benchmarks#16): the org's PR checks (jobadabra templates/org-repo/pr-checks.yml) start on pull_request only and hold no secret: the PR-description check and "All checks passed".
  if (f === 'pr-checks.yml') { test(`${f}: org PR checks, exact trigger, no secret`, () => { assert.deepEqual(triggersOf(text), ['pull_request']); assert.doesNotMatch(text, /secrets\./); }); continue; }
  if (LABELS[f]) { test(`${f}: PR label workflow, exact triggers, no secret`, () => { assert.deepEqual(triggersOf(text), LABELS[f]); assert.doesNotMatch(text, /secrets\./);
    // Why (2 Nov 2026, Gitar on web#258 and #307): the scripts come from jobadabra's main as FILE patterns (cone mode reads each entry as a folder and fetches nothing), and a YAML block has no comments.
    assert.match(text, /sparse-checkout-cone-mode: false/); assert.match(text, /repository: jobadabra\/jobadabra[^\n]*\n\s+ref: main\n/);
    for (const [, entry] of text.matchAll(/^ +(tools\/\S+)$/gm)) assert.doesNotMatch(entry, /#/);
  }); continue; }
  if (isUnitTests(text)) { test(`${f}: unit tests only, no secret`, () => assert.ok(triggersOf(text).every(t => ['pull_request', 'push', 'workflow_dispatch'].includes(t)))); continue; }
  test(`${f} starts by hand only${SCHEDULED[f] ? `, or: ${SCHEDULED[f].join(', ')}` : ''}`, () => assert.deepEqual(triggersOf(text), SCHEDULED[f] || ['workflow_dispatch']));
}
// Exactly 3 days apart: a daily cron and a `when` job on days since 1970 mod 3 (cron's */3 restarts each month).
const every3Days = /\$\(\( \$\(date -u \+%s\) \/ 86400 % 3 \)\) = 0/;
test('form-weekly.yml: the fixed set every 3 days, the new set on Mondays, and it hands its draw to the form round to publish', () => {
  const text = fs.readFileSync(path.join(dir, 'form-weekly.yml'), 'utf8');
  assert.deepEqual([...text.matchAll(/cron: '([^']+)'/g)].map(m => m[1]), ['0 6 * * *']);
  assert.match(text, new RegExp(`echo "fixed=.*${every3Days.source}`), 'fixed: every 3 days (owner via 5b, 27 Oct 2026)');
  assert.match(text, /echo "draw=.*"\$\(date -u \+%u\)" = 1/, 'the new set: Mondays');
  assert.match(text, /\n  fixed:[^\n]*\n    needs: when\n    if: needs\.when\.outputs\.fixed == 'yes'/);
  assert.match(text, /\n  draw:\n    needs: when\n    if: needs\.when\.outputs\.draw == 'yes'/);
  assert.match(text, /gh workflow run form-round\.yml[\s\S]*-f runs='\[1\]'[\s\S]*-f publish="week-\$WEEK"/, 'all four tools, 1 repeat, published as the week');
  assert.match(text, /tools\/excluded\.sh jp \. picks\/weekly/, 'every company we know and every earlier week left out');
  const fixed = text.slice(text.indexOf('\n  fixed:'), text.indexOf('\n  draw:'));
  assert.match(fixed, /gh workflow run form-round\.yml[^\n]*-f tools='\["extension"\]' -f runs='\[1,2,3\]' -f publish=fixed -f weekly=yes/, 'ours alone on the fixed set, x3');
  assert.match(text, /-f publish="week-\$WEEK" -f weekly=yes/, 'the new set ends with the weekly note too');
  for (const [, tools] of text.matchAll(/-f tools='([^']+)'/g)) assert.deepEqual(JSON.parse(tools), ['extension'], 'no scheduled full round with rivals on the fixed set');
});
test('form-round.yml: a weekly run ends with one Telegram note against the baseline and last week', () => {
  const text = fs.readFileSync(path.join(dir, 'form-round.yml'), 'utf8');
  assert.match(text, /if: \$\{\{ !inputs\.judge_only && inputs\.weekly == 'yes' \}\}/);
  assert.match(text, /node weekly-note\.mjs pool --round "\$ROUND" "\$\{base\[@\]\}" --last "picks\/notes\/\$kind"/);
  assert.match(text, /base=\(--baseline rounds\/fixed\/baseline\.json\)/);
  assert.match(text, /CI_ALERTS_TELEGRAM_BOT_TOKEN: \$\{\{ secrets\.CI_ALERTS_TELEGRAM_BOT_TOKEN \}\}/); assert.match(text, /CI_ALERTS_TELEGRAM_CHAT_ID: \$\{\{ secrets\.CI_ALERTS_TELEGRAM_CHAT_ID \}\}/); assert.doesNotMatch(text, /BENCH_TELEGRAM/, 'the Engineering bot only (owner, 12 Nov 2026): no fall back to the old benchmarks bot');
});

// Every round publishes itself as its last step (owner via 6e, 27 Oct 2026): a form round takes `publish` and its last job judges, scores
// and sends the round with publish-fair.mjs; it runs after every contestant's job, on a fresh runner.
test('form-round.yml: the last job judges, scores and publishes the round', () => {
  const text = fs.readFileSync(path.join(dir, 'form-round.yml'), 'utf8'), last = text.slice(text.lastIndexOf('\n  publish:'));
  assert.match(text, /^ {6}publish:\n {8}description:/m, 'a publish input');
  assert.match(last, /needs: \[run-rivals, run-ours\]\n/); assert.match(last, /if: \$\{\{ !cancelled\(\) && \(inputs\.judge_only \|\| inputs\.publish != ''\) \}\}/);
  for (const step of [/node judge-blind\.mjs pool --forms "\$FORMS"/, /node score-round\.mjs pool/, /node publish-fair\.mjs pool --round "\$ROUND"/]) assert.match(last, step);
  assert.match(last, /cp -R rounds\/fixed\/\. pool\//, 'the fixed set judges inside its frozen baseline');
  assert.match(last, /BENCHMARK_PUBLISH_KEY: '\$\{\{ secrets\.BENCHMARK_PUBLISH_KEY \}\}'/);
});

// The owner's Claude plan token reaches Claude Code only, never a rival's own scripts (owner via 6e, 27 Oct 2026). Every workflow that
// hands out the token secret AND checks out someone else's code must run that code's node as another user (the shim on PATH) and prove
// it first with a dummy token. Our own product (GarryOne/...) and this repo are not third-party.
const thirdParty = text => [...text.matchAll(/repository:\s*([\w.-]+)\//g)].some(m => m[1] !== 'GarryOne');
for (const f of files) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8');
  if (!/secrets\.CLAUDE_CODE_OAUTH_TOKEN/.test(text) || !thirdParty(text)) continue;
  test(`${f}: the plan token stays with Claude Code`, () => {
    const check = text.indexOf('- name: Isolation check'), use = text.indexOf('secrets.CLAUDE_CODE_OAUTH_TOKEN');
    assert.ok(check > 0 && check < use, 'an isolation check runs before the token is used');
    assert.match(text, /sudo -n -u scanner -H -- env -i PATH=/, 'node runs as another user with an emptied environment (sudo on the runner keeps it: 27 Oct smoke)');
    assert.match(text.slice(use), /export PATH="\$RUNNER_TEMP\/shim:\$PATH"/, 'the step with the token puts the shim first');
    assert.match(text.slice(check, use), /EACCES/, 'the check proves /proc is denied');
    assert.doesNotMatch(text.slice(use), /claude -p[\s\S]*?; true\s*$/m, 'a failed Claude run fails the job (no swallowed exit code)');
  });
}

// One AI for every contestant (owner, 27 Oct 2026: "why we don't use objectively, the same AI for all? ... If using Haiku then haiku ours
// and theirs"): every workflow holding an AI secret pins the round's model, Haiku 5.5, through BENCH_MODEL or the app's override.
const AI_SECRETS = /secrets\.(BENCH_ANTHROPIC_KEY|CLAUDE_CODE_OAUTH_TOKEN)/;
// A judge is no contestant: search-round.yml holds the plan token for judge.py only (its test below checks that); the contestants it
// calls pin Haiku in their own files.
const JUDGE_ONLY = ['search-round.yml'];
for (const f of files) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8');
  if (!AI_SECRETS.test(text) || JUDGE_ONLY.includes(f)) continue;
  test(`${f}: every contestant on Haiku 5.5`, () => {
    assert.match(text, /^\s*(BENCH_MODEL|JOBADABRA_MODEL_OVERRIDE): claude-haiku-5-5\b/m, 'the round model is pinned');
    assert.doesNotMatch(text, /extension-shipped|claude-sonnet|claude-opus/, 'no contestant on another model');
    if (/claude -p/.test(text)) assert.match(text, /claude -p [^\n]*--model "\$(BENCH_MODEL|JOBADABRA_MODEL_OVERRIDE)"/, 'Claude Code is told the model');
  });
}

// One build for the whole round (27 Oct 2026: the round passed a branch, the branch was deleted on merge, every job failed at checkout;
// a branch that moves mid-round would also hand jobs different builds). A workflow that takes product_ref resolves it ONCE, in a
// `build` job, to a commit; every job that checks out our product checks out that commit.
for (const f of files) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8');
  if (!/^\s+product_ref:/m.test(text) || !/repository: GarryOne\/jobadabra,/.test(text)) continue;   // a caller passes it on (search-round.yml)
  test(`${f}: every job runs one resolved product commit`, () => {
    assert.match(text, /^ {2}build:.*\n[\s\S]*?outputs:\n\s+sha:/m, 'a build job outputs the resolved commit');
    assert.match(text, /gh api "repos\/GarryOne\/jobadabra\/commits\/\$REF"/, 'resolved by the commits API (actions/checkout refuses a short commit)');
    const refs = [...text.matchAll(/repository: GarryOne\/jobadabra,\s*ref: '([^']+)'/g)].map(m => m[1]);
    assert.ok(refs.length >= 1, 'a job checks out the product');
    assert.deepEqual(refs.filter(r => r !== '${{ needs.build.outputs.sha }}'), [], 'every checkout of our product uses the resolved commit, never the input ref');
  });
}

// The form bench asks every tool to fill the application, so ours fills it too: our eligibility stop is off (owner via 6e, 27 Oct 2026:
// "Off for the form bench (Recommended)"; the round had it on, and ours filled only the contact details on North-America jobs).
test('form-round.yml: our eligibility check is off', () =>
  assert.match(fs.readFileSync(path.join(dir, 'form-round-job.yml'), 'utf8'), /^\s+LIVE_ELIGIBILITY: 'off'/m));

// The search round every 3 days (owner, 27 Oct 2026): ours (1 search per persona, every persona) and the three free rivals, judged blind
// on the plan, published, then one Telegram note; the plan token reaches only the judge step.
test('search-round.yml: every 3 days, ours + free rivals, judged on the plan, published, a Telegram note', () => {
  const text = fs.readFileSync(path.join(dir, 'search-round.yml'), 'utf8');
  assert.deepEqual([...text.matchAll(/cron: '([^']+)'/g)].map(m => m[1]), ['0 7 * * *']);
  assert.match(text, every3Days);
  assert.match(text, /uses: \.\/\.github\/workflows\/search-ours\.yml\n    with:\n      product_ref: [^\n]+\n      personas: '\[1,2,3,4,5,6,7,8,9,10\]'\n      presses: '\[1\]'/);
  assert.match(text, /uses: \.\/\.github\/workflows\/search-rivals\.yml\n    with:\n      rivals: '\["jobspy","eures","adzuna"\]'/);
  assert.doesNotMatch(text, /uses: \.\/\.github\/workflows\/search-(bench-)?career-ops/, 'career-ops stays by hand');
  const judge = text.slice(text.indexOf('- name: Blind judge'), text.indexOf('- name: Publish'));
  assert.match(judge, /BENCH_JUDGE_ENGINE: plan/); assert.match(judge, /search-bench\/judge\.py/);
  assert.equal(text.split('secrets.CLAUDE_CODE_OAUTH_TOKEN').length - 1, 1, 'the token appears once'); assert.ok(judge.includes('secrets.CLAUDE_CODE_OAUTH_TOKEN'), 'in the judge step');
  assert.match(text, /SELFHEAL_PUBLISH_KEY: \$\{\{ secrets\.BENCHMARK_PUBLISH_KEY \}\}\n {8}run: node search-bench\/publish\.mjs work --round/);
  assert.match(text, /node search-bench\/note\.mjs work [^\n]*--baseline search-bench\/results\/2026-10-27/);
  assert.match(text, /CI_ALERTS_TELEGRAM_BOT_TOKEN: \$\{\{ secrets\.CI_ALERTS_TELEGRAM_BOT_TOKEN \}\}/); assert.match(text, /CI_ALERTS_TELEGRAM_CHAT_ID: \$\{\{ secrets\.CI_ALERTS_TELEGRAM_CHAT_ID \}\}/); assert.doesNotMatch(text, /BENCH_TELEGRAM/, 'the Engineering bot only (owner, 12 Nov 2026): no fall back to the old benchmarks bot');
});


test('judge-only round pools only its new artifacts; normal fixed and weekly pools retain their contracts', async () => {
  const os = await import('node:os'), {execFileSync} = await import('node:child_process');
  const text = fs.readFileSync(path.join(dir, 'form-round.yml'), 'utf8');
  const poolStep = text.match(/- name: The pool[^\n]*\n        run: \|\n([\s\S]*?)(?=      - name:)/)?.[1];
  assert.ok(poolStep);
  const script = poolStep.replace(/^ {10}/gm, '');
  for (const [judgeOnly, round, frozen] of [['true', '', false], ['true', 'fixed', false], ['false', 'fixed', true], ['false', 'week-2026-W44', false]]) {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'judge-only-pool-'));
    try {
      const write = (file, marker) => { fs.mkdirSync(path.dirname(path.join(cwd, file)), {recursive: true}); fs.writeFileSync(path.join(cwd, file), marker); };
      write('rounds/fixed/1/browser-use/1/result.json', 'frozen-rival');
      write('rounds/fixed/1/extension/1/result.json', 'old-ours');
      write('arts/form-round-extension-1/round-out/1/extension/1/result.json', 'new-ours');
      execFileSync('bash', ['-e', '-o', 'pipefail', '-c', script], {cwd, env: {...process.env, ROUND: round, JUDGE_ONLY: judgeOnly}, stdio: 'pipe'});
      assert.equal(fs.existsSync(path.join(cwd, 'pool/1/browser-use/1/result.json')), frozen, `${judgeOnly}/${round}`);
      assert.equal(fs.readFileSync(path.join(cwd, 'pool/1/extension/1/result.json'), 'utf8'), 'new-ours');
    } finally { fs.rmSync(cwd, {recursive: true, force: true}); }
  }
});

test('judge-only mode scores and saves a run-specific artifact without publishing or Telegram', () => {
  const text = fs.readFileSync(path.join(dir, 'form-round.yml'), 'utf8');
  assert.match(text, /judge_only:\n\s+description:[^\n]*\n\s+type: boolean\n\s+default: false/);
  assert.match(text, /- name: Score the round\n\s+run: \|[\s\S]*?node score-round\.mjs pool --json score\.json/);
  assert.match(text, /- name: Publish the round\n\s+if: \$\{\{ !inputs\.judge_only \}\}/);
  assert.match(text, /- name: The weekly note[^\n]*\n\s+if: \$\{\{ !inputs\.judge_only && inputs\.weekly == 'yes' \}\}/);
  assert.match(text, /name: form-round-judged-\$\{\{ inputs\.judge_only && 'judge-only' \|\| inputs\.publish \}\}-\$\{\{ github\.run_id \}\}/);
});
