// node publish-data.mjs <repo dir> [extra fixture dirs...]: publishes EVERY run (live forms, the local fixture iterations, invalid, crashed, recovered) into <repo>/results: runs/<id>/<tool>/ (result, judged fields, field list, guard log, notes, start/end screenshots as small jpg),
// ALL-RUNS.md + all-runs.json (one row per run, with status and why), forms/<id>.md (field by field, every tool side by side). Then a privacy scan of everything written with the Jobadabra tripwire's owner values: a hit deletes results/ and stops.
import fs from 'node:fs'; import {submitLike} from './lib/guard.mjs'; import path from 'node:path'; import {execFileSync} from 'node:child_process';
const here = import.meta.dirname, out = path.join(here, 'out'), repo = process.argv[2], extra = process.argv.slice(3), dest = path.join(repo, 'results');
const TOOLS = ['extension', 'extension-old2', 'extension-main', 'extension-b935956c', 'stagehand', 'browser-use', 'nanobrowser'], NAME = {'extension-b935956c': 'Our extension (main 935956c, 15 Oct)', extension: 'Our extension (old build 62dad23)', 'extension-old2': 'Our extension (primary checkout, re-run)', 'extension-main': 'Our extension (main build)', stagehand: 'Stagehand', 'browser-use': 'Browser Use', nanobrowser: 'Nanobrowser'};
const forms = [...JSON.parse(fs.readFileSync(path.join(here, 'forms.json'), 'utf8')), ...JSON.parse(fs.readFileSync(path.join(here, 'forms-fresh.json'), 'utf8')), ...JSON.parse(fs.readFileSync(path.join(here, 'forms-hard.json'), 'utf8'))];
const rj = (d, f) => { try { return JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); } catch { return null; } };
const txt = (d, f) => { try { return fs.readFileSync(path.join(d, f), 'utf8').trim(); } catch { return ''; } };
fs.rmSync(dest, {recursive: true, force: true}); fs.mkdirSync(path.join(dest, 'runs'), {recursive: true}); fs.mkdirSync(path.join(dest, 'forms'), {recursive: true});
const jpg = (src, to) => { try { fs.mkdirSync(path.dirname(to), {recursive: true}); execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '45', '--resampleWidth', '700', src, '--out', to], {stdio: 'ignore'}); } catch { /* no picture */ } };

// 1. every run folder
const runs = [];
const add = (id, form, tool, dir, kind) => runs.push({id, form, tool, dir, kind});
for (const id of fs.readdirSync(out)) {
  const top = path.join(out, id); if (!fs.statSync(top).isDirectory() || fs.lstatSync(top).isSymbolicLink()) continue;
  if (/^(\d+|lever)$/.test(id)) { for (const tool of TOOLS) if (fs.existsSync(path.join(top, tool))) add(`form-${id === 'lever' ? 1 : id}/${tool}`, id === 'lever' ? 1 : Number(id), tool, path.join(top, tool), 'live'); }
  else if (/^fixture\d*-/.test(id) && fs.existsSync(path.join(top, 'result.json'))) { const m = id.match(/^fixture(\d*)-(.+)$/), tool = m[2] === 'ext' ? 'extension' : m[2] === 'extmain' ? 'extension-old2' : m[2] === 'nb' ? 'nanobrowser' : m[2]; add(`fixture/iteration-${m[1] || 1}-${tool}`, 0, tool, top, 'fixture'); }
}
for (const d of extra) if (fs.existsSync(path.join(d, 'result.json'))) add(`fixture/wizard-${path.basename(d)}`, 30, 'extension', d, 'fixture-wizard');
// 2. copy + describe
const rows = [];
for (const r of runs) {
  const res = rj(r.dir, 'result.json'), judged = rj(r.dir, 'judged.json'), invalid = txt(r.dir, 'INVALID.txt'), noRes = fs.existsSync(path.join(r.dir, 'no-result.txt')), dropped = r.form && fs.existsSync(path.join(out, String(r.form === 1 ? 'lever' : r.form), 'DROPPED.txt'));
  const status = invalid ? 'INVALID (API limit/credits)' : res ? (res.recovered ? 'recovered' : 'valid') : noRes ? 'crashed, no result' : 'no result';
  const d = path.join(dest, 'runs', r.id); fs.mkdirSync(d, {recursive: true});
  for (const f of ['result.json', 'manifest.json', 'judged.json', 'fields.json', 'guard.jsonl', 'INVALID.txt', 'no-result.txt', 'run.log', 'events.json']) if (fs.existsSync(path.join(r.dir, f))) fs.copyFileSync(path.join(r.dir, f), path.join(d, f));
  if (r.tool.startsWith('extension') && fs.existsSync(path.join(r.dir, 'capture', 'case.json'))) { const cdir = path.join(dest, 'captures'); fs.mkdirSync(cdir, {recursive: true}); try { execFileSync('tar', ['-czf', path.join(cdir, r.id.replace(/\//g, '__') + '.tar.gz'), '-C', path.join(r.dir, 'capture'), 'case.json', 'pages', 'presses.json', 'journey.json'].filter(x => !/^(presses|journey)\.json$/.test(x) || fs.existsSync(path.join(r.dir, 'capture', x))), {stdio: 'ignore'}); } catch { /* no pages */ } }   // the page snapshots the extension saw: an exact offline replay (row.mjs) starts from them
  jpg(path.join(r.dir, 'start.png'), path.join(d, 'start.jpg')); jpg(path.join(r.dir, 'end.png'), path.join(d, 'end.jpg'));
  const req = (judged || []).filter(f => f.required), at = fs.existsSync(path.join(r.dir, res ? 'result.json' : 'guard.jsonl')) ? fs.statSync(path.join(r.dir, res ? 'result.json' : 'guard.jsonl')).mtime.toISOString().slice(0, 16).replace('T', ' ') : '';
  rows.push({run: r.id, when: at, form: r.form || '', kind: r.kind, tool: r.tool, build: res?.build || (r.tool === 'extension' ? '62dad23' : ''), status, requiredRight: judged ? `${req.filter(f => f.verdict === 'right').length}/${req.length}` : '', wrong: judged ? judged.filter(f => f.verdict === 'wrong').length : '', seconds: res?.seconds ?? '', usd: res?.usd == null ? (res ? 'plan' : '') : Number(res.usd.toFixed(3)), capped: res?.capped ?? '', submitPressed: res ? txt(r.dir, 'guard.jsonl').split('\n').filter(Boolean).map(l => JSON.parse(l)).some(submitLike) : '', note: dropped ? 'form dropped (posting closed)' : invalid.slice(0, 120)});
}
rows.sort((a, b) => a.when.localeCompare(b.when));
fs.writeFileSync(path.join(dest, 'all-runs.json'), JSON.stringify(rows, null, 1));
const cell = v => String(v ?? '').replace(/\|/g, '/');
fs.writeFileSync(path.join(dest, 'ALL-RUNS.md'), `# Every run, in order\n\n${rows.length} runs: ${rows.filter(r => r.kind === 'live').length} on live forms, ${rows.filter(r => r.kind !== 'live').length} on the local fixture forms (development iterations). Nothing is left out: invalid, crashed and recovered runs are listed with their status. Times are local (UTC+2). "plan" = our extension on the plan (no per-token price).\n\n| # | When | Run (folder) | Tool | Build | Status | Required right | Wrong | Time | Cost | Cap | Submit pressed | Note |\n| --: | --- | --- | --- | --- | --- | :-: | :-: | --: | --: | :-: | :-: | --- |\n${rows.map((r, i) => `| ${i + 1} | ${r.when} | [${r.run}](runs/${r.run}) | ${NAME[r.tool]} | ${r.build} | ${r.status === 'valid' ? '🟢 valid' : r.status.startsWith('INVALID') ? '⚫ ' + r.status : '🔴 ' + r.status} | ${r.requiredRight} | ${r.wrong} | ${r.seconds ? Math.round(r.seconds) + ' s' : ''} | ${r.usd === 'plan' ? 'plan' : r.usd !== '' ? '$' + r.usd : ''} | ${r.capped === true ? '⛔' : ''} | ${r.submitPressed === true ? '🚨' : ''} | ${cell(r.note)} |`).join('\n')}\n`);
// 3. one page per form: every field, every tool side by side
for (const form of forms.filter(f => rows.some(r => r.form === f.id))) {
  const mine = rows.filter(r => r.form === form.id && r.status === 'valid' || r.form === form.id && r.status === 'recovered'), data = Object.fromEntries(mine.map(r => [r.tool, rj(path.join(dest, 'runs', r.run), 'judged.json') || []]));
  const base = Object.values(data).sort((a, b) => b.length - a.length)[0] || [], dot = v => v === 'right' ? '🟢' : v === 'wrong' ? '🔴' : '⚪';
  const tools = Object.keys(data);
  fs.writeFileSync(path.join(dest, 'forms', `${form.id}.md`), `# Form ${form.id}: ${form.platform} (${form.host})\n\nRuns: ${rows.filter(r => r.form === form.id).map(r => `[${NAME[r.tool]} (${r.status})](../runs/${r.run})`).join(' · ')}\n\n🟢 right · 🔴 wrong · ⚪ empty. ★ = required. Question text and values are exactly what the field reader found on the end page (fake applicant).\n\n| Field | ${tools.map(t => NAME[t]).join(' | ')} |\n| --- | ${tools.map(() => '---').join(' | ')} |\n${base.map((f, i) => `| ${f.required ? '★ ' : ''}${cell(f.question).slice(0, 90)} | ${tools.map(t => { const x = data[t][i]; return x ? `${dot(x.verdict)} ${cell(x.value).slice(0, 50)}` : ''; }).join(' | ')} |`).join('\n')}\n`);
}
// 4. privacy scan of everything written
const {ownerValues, matchesOwner} = await import(path.join(process.env.JP_REPO || path.join(process.env.HOME, 'jobadabra', 'desktop', 'e2e'), 'lib/privacy-tripwire.mjs'));
const values = ownerValues(), walk = d => fs.readdirSync(d, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
// What a tool TYPED is what the tripwire guards (lib/privacy-tripwire.mjs): the values of the fields. Questions and agent messages quote public form text (city names in questions), so the scan reads the field values; the free text of agents' final messages is scanned line by line separately and reported, never printed.
const typedOf = f => { if (/(judged|fields)\.json$/.test(f)) { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return (Array.isArray(j) ? j : j.fields || []).map(x => ({label: x.question, value: x.value})); } return []; };
const hits = walk(dest).flatMap(f => matchesOwner(typedOf(f), values).map(h => `${h.kind} typed into "${h.label}" in ${path.relative(dest, f)}`));
if (hits.length) { fs.rmSync(dest, {recursive: true, force: true}); console.error('PRIVACY HIT, results/ deleted:', [...new Set(hits)].join('; ')); process.exit(1); }
console.log(`published ${rows.length} runs, ${fs.readdirSync(path.join(dest, 'forms')).length} form pages; privacy scan clean; ${Math.round(walk(dest).reduce((a, f) => a + fs.statSync(f).size, 0) / 1e6)} MB`);
