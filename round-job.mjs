// One CI job of the objective round: ONE tool, ONE run number, every form once, in an order seeded by (tool, run) so no tool always
// meets a form first or last. Each form visit is a fresh browser (run.mjs, --no-judge: the blind judge scores the pooled round later).
// Stops between forms once this job's spend reaches --cap (the forms left are written as "not run: cap"), so a whole round stays under
// the owner's ~$3 (27 Oct 2026). Ours is priced from its tokens at the round's model (the harness counts Sonnet's price).
// Usage: node round-job.mjs --tool <browser-use|stagehand|nanobrowser|extension|extension-shipped> --run <n> --forms forms-objective.json --out <dir> --cap 0.30
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import {spawnSync} from 'node:child_process';
import {AGENT_MODEL, callUsd} from './lib/models.mjs'; import {allFailed} from './lib/round-health.mjs';

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const label = arg('tool'), run = Number(arg('run', 1)), out = arg('out'), cap = Number(arg('cap', 0.3));
const tool = label.startsWith('extension') ? 'extension' : label;
const file = JSON.parse(fs.readFileSync(arg('forms', 'forms-objective.json'), 'utf8')), only = String(arg('only', '') || '').split(',').filter(Boolean).map(Number);
const forms = (file.picks || file).filter(f => !only.length || only.includes(f.id));   // a pick-forms.mjs file or a plain forms list
const order = [...forms].sort((a, b) => crypto.createHash('sha256').update(`${label}|${run}|${a.id}`).digest('hex').localeCompare(crypto.createHash('sha256').update(`${label}|${run}|${b.id}`).digest('hex')));
const env = {...process.env, ...(label === 'extension-shipped' ? {BENCH_OURS_AS_SHIPPED: '1'} : {})};

export const usdOf = (r, model) => r.tool === 'extension' ? (r.tokens ? callUsd(model, {input_tokens: r.tokens.in, output_tokens: r.tokens.out}) : 0) : (r.usd || 0);

let spent = 0; const rows = [];
for (const form of order) {
  const dir = path.join(out, String(form.id), label, String(run));
  if (spent >= cap) { rows.push({form: form.id, label, run, notRun: `cap $${cap} reached ($${spent.toFixed(3)})`}); console.log(`round: ${form.id} ${label} run ${run} NOT RUN (cap)`); continue; }
  fs.mkdirSync(dir, {recursive: true});
  const t0 = Date.now(), p = spawnSync('node', ['run.mjs', tool, form.url, dir, '--no-judge'], {cwd: import.meta.dirname, env, encoding: 'utf8', timeout: 12 * 60 * 1000, maxBuffer: 64 << 20});
  fs.writeFileSync(path.join(dir, 'run.log'), `${p.stdout || ''}\n--- stderr ---\n${p.stderr || ''}`);
  let r = {}; try { r = JSON.parse(fs.readFileSync(path.join(dir, 'result.json'), 'utf8')); } catch { r = {error: `no result (exit ${p.status}${p.error ? `, ${p.error.code}` : ''})`}; }
  const model = label === 'extension-shipped' ? 'claude-sonnet-5-5' : AGENT_MODEL, usd = usdOf({...r, tool}, model);
  spent += usd;
  rows.push({form: form.id, label, run, usd, seconds: r.seconds ?? null, wallSeconds: Math.round((Date.now() - t0) / 1000), submitPressed: !!r.submitPressed, error: r.error || r.fatal || '', build: r.build || null});
  console.log(`round: ${form.id} ${label} run ${run} usd=${usd.toFixed(4)} s=${r.seconds ?? '?'} submit=${!!r.submitPressed}${r.error ? ` error=${String(r.error).slice(0, 120)}` : ''}`);
}
fs.writeFileSync(path.join(out, `job-${label}-${run}.json`), JSON.stringify({label, run, model: label === 'extension-shipped' ? 'as shipped' : AGENT_MODEL, cap, spent, rows}, null, 1));
console.log(`round: JOB DONE ${label} run ${run} spent=$${spent.toFixed(3)}`);
if (allFailed(rows)) { console.log(`round: FAILED ${label} run ${run}: every form ended in an error (first: ${String(rows.find(row => row.error).error).slice(0, 160)})`); process.exitCode = 1; }   // Why (12 Nov 2026): a job that did nothing is red, not green
