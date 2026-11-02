// node publish-site.mjs [--dry] [--run <dir>] [root...]: sends one summary row per scored run to the owner-only page /admin/benchmark-form-filling (PUT /benchmark/data, Bearer = Keychain jobadabra.site.selfheal_publish_key or $SELFHEAL_PUBLISH_KEY).
// Reads <root>/<form>/<tool>/{judged.json,result.json,manifest.json} (roots: results/runs/form-N and out/<id>; --run <dir> = one tool dir right after a run). Counts are REQUIRED fields only, as in product-score.mjs:
// right / wrong / empty, not answerable (the facts cannot answer), consent holds (an empty checkbox or consent line, held for the person) and reader duplicates (same question and type twice).
// Forms go out as "Form N" (no hosts), tools by the names below; the site's code is public and holds none of them. Mode = our extension's repair rung: user = the build has it acting for every user (#873) or the harness had it off; harness = a build before #873 run with it on; a run that did not record it is harness (before 15 Oct 2026 the rung acted in the harness only).
import fs from 'node:fs'; import path from 'node:path'; import {execFileSync} from 'node:child_process'; import {holdOf} from './lib/holds.mjs';
const here = import.meta.dirname, args = process.argv.slice(2), dry = args.includes('--dry');
const one = args.includes('--run') ? args[args.indexOf('--run') + 1] : null, roots = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--run');
const NAME = {stagehand: 'Stagehand', 'browser-use': 'Browser Use', nanobrowser: 'Nanobrowser'};
const DIR_BUILD = {extension: '62dad23', 'extension-old2': '62dad23', 'extension-main': '9a0416d', 'extension-b935956c': '935956c'};
const FRESH = new Set((() => { try { return JSON.parse(fs.readFileSync(path.join(here, 'forms-fresh.json'), 'utf8')).map(f => f.id); } catch { return []; } })());   // forms picked fresh, never in our pool: the page's "held out when picked"
// Harness bugs fixed after some runs were scored (saved runs cannot be re-read): a run scored before a fix carries its key, the page names each. trail = a field the final page shows empty is empty (lib/trail.mjs);
// select = a react-select's chosen value is found above its input (lib/extract-fields.js). The upload hold (lib/holds.mjs: a required upload the safety guard stopped) is not a key: it is recomputed from each run's saved guard log, so no run predates it. Both hit every tool the same way.
const git = (...a) => { try { return execFileSync('git', ['-C', here, ...a], {encoding: 'utf8'}).trim(); } catch { return ''; } };
const FIXES = [['trail', git('log', '-1', '--format=%aI', '--grep=Trail: a field the final page shows empty is empty')], ['select', git('log', '-1', '--format=%aI', 'f20f9eb')]];
// Is this build one that has the repair rung acting for every user (the commit "The repair rung acts for every user")? Keyed on the build, not on the harness flag alone.
const JP = process.env.JP_MAIN_REPO || path.join(process.env.HOME, 'jobadabra');
const RUNG_USER = (() => { try { return execFileSync('git', ['-C', JP, 'log', 'origin/main', '-1', '--format=%H', '--grep=The repair rung acts for every user'], {encoding: 'utf8'}).trim(); } catch { return ''; } })();
const userBuild = build => { if (!RUNG_USER) return false; try { execFileSync('git', ['-C', JP, 'merge-base', '--is-ancestor', RUNG_USER, build], {stdio: 'ignore'}); return true; } catch { return false; } };
const rj = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

export function rowOf(dir) {
  const tool = path.basename(dir), formDir = path.basename(path.dirname(dir)), id = formDir === 'lever' ? 1 : Number(formDir.replace(/^form-/, ''));
  const judged = rj(path.join(dir, 'judged.json')), result = rj(path.join(dir, 'result.json')), manifest = rj(path.join(dir, 'manifest.json')) || {};
  if (!judged || !result || !id || !judged.some(f => f.required) || fs.existsSync(path.join(dir, 'INVALID.txt'))) return null;
  const ours = tool.startsWith('extension'); if (!ours && !NAME[tool]) return null;
  const req = judged.filter(f => f.required), seen = new Set(), c = {unans: 0, holds: 0, dups: 0};
  // a NAMELESS second row of a question is the widget's companion (react-select, phone prefix); two named controls are two controls
  for (const f of req) { const key = `${f.question}|${f.type}`; if (seen.has(key) && !f.name) { c.dups++; continue; } seen.add(key); if (!f.answerable) c.unans++; else if (holdOf(f, dir)) c.holds++; }
  const at = manifest.finishedAt || fs.statSync(path.join(dir, 'result.json')).mtime.toISOString(), build = ours ? DIR_BUILD[tool] || manifest.extension?.commit || result.build || '' : '';   // the older folders are named for their build; a backfilled manifest of form 9 says otherwise
  const ladderAct = manifest.flags?.ladderAct ?? result.ladderAct ?? true;
  const user = !ladderAct || (build ? userBuild(build) : false);   // since the repair rung acts for every user (#873) a build that contains it is what users run
  return {id: `form-${id}/${tool}/${at}`, at, applicant: manifest.applicant || 'thin', mode: ours ? (user ? 'user' : 'harness') : 'any', tool: ours ? 'Our extension' : NAME[tool], ours, build, form: `Form ${id}`, heldout: FRESH.has(id), fixes: FIXES.filter(([, date]) => !date || Date.parse(at) < Date.parse(date)).map(([key]) => key),
    required: req.length, right: req.filter(f => f.verdict === 'right').length, wrong: req.filter(f => f.verdict === 'wrong').length, empty: req.filter(f => f.verdict === 'empty').length, ...c};
}
const toolDirs = root => fs.readdirSync(root, {withFileTypes: true}).filter(d => d.isDirectory()).flatMap(f => fs.readdirSync(path.join(root, f.name), {withFileTypes: true}).filter(d => d.isDirectory() && fs.existsSync(path.join(root, f.name, d.name, 'judged.json'))).map(d => path.join(root, f.name, d.name)));
if (import.meta.url === `file://${process.argv[1]}`) {
  const dirs = one ? [one] : (roots.length ? roots : [path.join(here, 'results', 'runs')]).flatMap(r => fs.existsSync(r) ? toolDirs(r) : []);
  const runs = dirs.map(rowOf).filter(Boolean);
  console.log(`${runs.length} scored runs of ${dirs.length} folders`);
  if (dry) { console.table(runs.map(r => ({run: r.id.slice(0, 30), tool: r.tool, build: r.build, mode: r.mode, required: r.required, right: r.right, wrong: r.wrong, empty: r.empty}))); process.exit(0); }
  const key = process.env.SELFHEAL_PUBLISH_KEY || (() => { try { return execFileSync('security', ['find-generic-password', '-s', 'jobadabra.site.selfheal_publish_key', '-w'], {encoding: 'utf8'}).trim(); } catch { return ''; } })();
  if (!key) { console.log('no publish key (Keychain jobadabra.site.selfheal_publish_key): nothing sent'); process.exit(0); }
  for (let i = 0; i < runs.length; i += 200) {
    const res = await fetch(process.env.BENCHMARK_URL || 'https://www.jobadabra.top/benchmark/data', {method: 'PUT', headers: {Authorization: `Bearer ${key}`}, body: JSON.stringify({runs: runs.slice(i, i + 200)})});
    console.log(res.status, await res.text());
  }
}
