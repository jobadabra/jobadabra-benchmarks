// The bake-off as a regression QA (owner, 14 Oct 2026: "use this mechanism as a QA, to see if we introduce regressions, to have a baseline").
//   node qa.mjs baseline --tool extension            freeze the CURRENT results of that tool folder (default: the old build's) as qa/baseline.json: per form, required right / total, wrong values, seconds, build, run folder.
//   node qa.mjs compare [--tool extension-main]      compare a tool folder's results with the baseline: per form 🟢 same/better, 🔻 REGRESSION, 🆕 no baseline. Exit code 1 when any form regressed.
//   node qa.mjs compare --tool A --against B          head to head: tool folder A against tool folder B (e.g. extension-b9a0416d against extension-b62dad23), no baseline file needed.
//   node qa.mjs fields <form id> <toolA> <toolB>        the fields that differ between two runs of one form (value + verdict), for debugging a regression.
//   node qa.mjs bisect --good <sha> --bad <sha> --form <id>   binary search over the commits that touch extension/ between a good and a bad build, one site visit per step; stops cleanly when the day's visits are used and prints how to resume.
//   node qa.mjs localbisect --good <sha> --bad <sha> --url <local fixture url> [--runs 3]   the same search on a LOCAL fixture (fixture/combo.html: a suggest-only address box): no site visit, no limit, ~90 s a step. A step is good when the question fields were typed.
//   node qa.mjs run --build <git sha|ref> [--forms 1,4,5,11,13]   a worktree at that commit (linked packages like tools/worktree.sh), the extension on each form (plan: no per-token cost; the judge ~$0.015 a form), then compare. One visit per host per run (3 a day).
// Regression = required right drops by 2 or more, or by 15 points of its share or more, or a wrong value appears that the baseline did not have. The baseline is data (qa/baseline.json), not a promise: re-freeze it when a better build is accepted.
import fs from 'node:fs'; import {ensureWorktree} from './lib/worktree.mjs'; import path from 'node:path'; import {execFileSync, spawnSync} from 'node:child_process';
const here = import.meta.dirname, out = path.join(here, 'out'), baseFile = path.join(here, 'qa', 'baseline.json'), [mode, ...rest] = process.argv.slice(2);
const flag = (n, d) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : d; };
const forms = [...JSON.parse(fs.readFileSync(path.join(here, 'forms.json'), 'utf8')), ...JSON.parse(fs.readFileSync(path.join(here, 'forms-fresh.json'), 'utf8'))];
const dirOf = id => path.join(out, id === 1 ? 'lever' : String(id));
const rj = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
function measure(id, tool) {   // -> {right, req, wrong, seconds, build, dir} of one run, or null (no valid result)
  const d = path.join(dirOf(id), tool), r = rj(path.join(d, 'result.json')), j = rj(path.join(d, 'judged.json')); if (!r || !j || fs.existsSync(path.join(d, 'INVALID.txt'))) return null;
  const req = j.filter(f => f.required); if (!req.length) return null;   // a form with no required flags found (the German Personio form) cannot be compared on required fields
  return {right: req.filter(f => f.verdict === 'right').length, req: req.length, wrong: j.filter(f => f.verdict === 'wrong').length, seconds: r.seconds, build: r.build || '62dad23', dir: path.relative(here, d)};
}
const regressed = (b, n) => n.right <= b.right - 2 || (n.req && b.req && n.right / n.req <= b.right / b.req - 0.15) || n.wrong > b.wrong;
function compare(tool, against = '') {
  const base = against ? {tool: against, frozen: 'live', forms: Object.fromEntries(forms.map(f => [f.id, measure(f.id, against)]).filter(([, m]) => m))} : rj(baseFile); if (!base) { console.error('no baseline: node qa.mjs baseline first'); process.exit(2); }
  const rows = []; let bad = 0;
  for (const f of forms) { const b = base.forms[f.id], n = measure(f.id, tool); if (!n) continue;
    const status = !b ? '🆕 no baseline' : regressed(b, n) ? '🔻 REGRESSION' : (n.right > b.right || n.wrong < b.wrong) ? '🟢 better' : '🟢 same'; if (status.includes('REGRESSION')) bad++;
    rows.push(`| ${f.id} | ${f.platform} (${f.host}) | ${b ? `${b.right}/${b.req}, ${b.wrong} wrong (${b.build})` : '-'} | ${n.right}/${n.req}, ${n.wrong} wrong (${n.build}) | ${status} |`); }
  console.log(`# QA: ${tool} vs the baseline (${base.tool}, frozen ${base.frozen})\n\n| # | Form | Baseline | Now | Verdict |\n| --: | --- | --- | --- | --- |\n${rows.join('\n')}\n\n${bad ? `🔻 ${bad} form(s) regressed` : '🟢 no regression'} over ${rows.length} forms.`);
  process.exitCode = bad ? 1 : 0; return bad;
}
if (mode === 'baseline') {
  const tool = flag('tool', 'extension'), res = {}; for (const f of forms) { const m = measure(f.id, tool); if (m) res[f.id] = m; }
  fs.mkdirSync(path.dirname(baseFile), {recursive: true}); fs.writeFileSync(baseFile, JSON.stringify({tool, frozen: new Date().toISOString().slice(0, 10), forms: res}, null, 1)); console.log(`baseline frozen from ${tool}: ${Object.keys(res).length} forms`);
} else if (mode === 'compare') compare(flag('tool', 'extension-main'), flag('against', ''));
else if (mode === 'run') {
  const sha = flag('build'); if (!sha) { console.error('--build <sha>'); process.exit(2); }
  const wt = ensureWorktree(sha);
  const tool = `extension-b${wt.sha}`, ids = flag('forms', '1,4,5,11,13');
  for (const file of ['forms.json', 'forms-fresh.json']) { const r = spawnSync('node', ['batch.mjs', file, ids, '1.0'], {cwd: here, stdio: 'inherit', env: {...process.env, JP_REPO: wt.e2e, BAKEOFF_TOOLS: tool, BAKEOFF_CAP: process.env.BAKEOFF_CAP || '100'}}); if (r.status) console.error(`batch ${file}: exit ${r.status}`); }
  compare(tool);
} else if (mode === 'fields') {
  const [id, a, b] = rest, ja = rj(path.join(dirOf(Number(id)), a, 'judged.json')) || [], jb = rj(path.join(dirOf(Number(id)), b, 'judged.json')) || [], keyed = list => { const seen = {}; return list.map(f => { seen[f.question] = (seen[f.question] || 0) + 1; return [`${f.question}#${seen[f.question]}`, f]; }); }, mb = new Map(keyed(jb));   // older runs have no field name: the question text + its n-th occurrence pairs the fields
  console.log(`# Form ${id}: ${a} vs ${b}: fields that differ\n\n| Field | ${a} | ${b} |\n| --- | --- | --- |`);
  for (const [k, f] of keyed(ja)) { const g = mb.get(k); if (!g || g.verdict !== f.verdict || g.value !== f.value) console.log(`| ${f.required ? '★ ' : ''}${f.question.slice(0, 70).replace(/\|/g, '/')} | ${f.verdict}: ${String(f.value).slice(0, 30)} | ${g ? g.verdict + ': ' + String(g.value).slice(0, 30) : '(not on the page)'} |`); }
}
else if (mode === 'bisect') {
  const repo = path.join(process.env.HOME, 'jobadabra'), id = Number(flag('form')), good = flag('good'), bad = flag('bad'), run = sha => { const wt = ensureWorktree(sha), tool = `extension-b${wt.sha}`; if (!measure(id, tool)) for (const file of ['forms.json', 'forms-fresh.json']) spawnSync('node', ['batch.mjs', file, String(id), '1.0'], {cwd: here, stdio: 'inherit', env: {...process.env, JP_REPO: wt.e2e, BAKEOFF_TOOLS: tool, BAKEOFF_CAP: '100'}}); return measure(id, tool); };
  const list = execFileSync('git', ['-C', repo, 'rev-list', '--reverse', `${good}..${bad}`, '--', 'extension/'], {encoding: 'utf8'}).split('\n').filter(Boolean), base = run(good); if (!base) { console.error('the good build has no valid result on this form (no visit left today?)'); process.exit(3); }
  let lo = 0, hi = list.length - 1; console.log(`${list.length} commits touch extension/ between ${good} and ${bad}; the good build scored ${base.right}/${base.req}, ${base.wrong} wrong`);
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2), m = run(list[mid]); if (!m) { console.log(`stopped: no valid result for ${list[mid].slice(0, 8)} (site visits used today?). Resume tomorrow with the same command: finished steps are kept.`); process.exit(4); }
    const bad2 = regressed(base, m); console.log(`${list[mid].slice(0, 8)}: ${m.right}/${m.req}, ${m.wrong} wrong -> ${bad2 ? 'REGRESSED' : 'ok'}`); if (bad2) hi = mid; else lo = mid + 1; }
  console.log(`first regressing commit: ${list[lo]}\n${execFileSync('git', ['-C', repo, 'log', '-1', '--format=%h %s', list[lo]], {encoding: 'utf8'})}`);
}
else if (mode === 'localbisect') {
  const repo = path.join(process.env.HOME, 'jobadabra'), good = flag('good'), bad = flag('bad'), url = flag('url'), harness = process.env.JP_REPO;   // JP_REPO: a worktree on a recent main: the harness; only the extension under test comes from each commit
  if (!url || !harness) { console.error('--url <fixture url>, and JP_REPO=<a recent worktree>/desktop/e2e'); process.exit(2); }
  const RUNS = Number(flag('runs', '3'));   // a timing-dependent bug shows only in some runs: good = every run typed the questions, bad = any run lost them (14 Oct 2026: main passed 2 of 3)
  const isGood = sha => { const runs = []; for (let i = 1; i <= RUNS; i++) { const r = isGoodOnce(sha, i); if (!r) return null; runs.push(r); if (!r.good) break; } return {typed: Math.min(...runs.map(r => r.typed)), good: runs.every(r => r.good), runs: runs.length, wt: runs[0].wt}; };
  const isGoodOnce = (sha, i) => { const wt = ensureWorktree(sha), dir = path.join(out, `combo-b${wt.sha}-${i}`);
    if (!fs.existsSync(path.join(dir, 'result.json'))) spawnSync('node', ['run.mjs', 'extension', url, dir, '--no-judge'], {cwd: here, stdio: 'ignore', env: {...process.env, JP_REPO: harness, JP_EXT_DIR: path.join(wt.tree, 'extension')}});
    const f = rj(path.join(dir, 'fields.json')); if (!f) return null;
    const typed = f.fields.filter(x => /aws|kubernetes|linkedin/i.test(x.question) && String(x.value).trim()).length; return {typed, good: typed >= 2, wt: wt.sha}; };
  const list = execFileSync('git', ['-C', repo, 'rev-list', '--reverse', `${good}..${bad}`, '--', 'extension/'], {encoding: 'utf8'}).split('\n').filter(Boolean), g = isGood(good), b = isGood(bad);
  console.log(`good ${good}: ${g?.typed}/3 questions typed | bad ${bad}: ${b?.typed}/3 | ${list.length} commits touch extension/`);
  if (!g?.good || b?.good) { console.log('the fixture does not separate the two builds (the good one must type the questions and the bad one not): no bisect'); process.exit(3); }
  let lo = 0, hi = list.length - 1;
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2), r = isGood(list[mid]); console.log(`${list[mid].slice(0, 8)}: ${r ? r.typed + '/3 typed -> ' + (r.good ? 'good' : 'BAD') : 'no result'}`); if (!r) process.exit(4); if (r.good) lo = mid + 1; else hi = mid; }
  console.log(`first bad commit: ${execFileSync('git', ['-C', repo, 'log', '-1', '--format=%h %s', list[lo]], {encoding: 'utf8'}).trim()}`);
}
else { console.error('node qa.mjs baseline|compare|run (see the header)'); process.exit(2); }
