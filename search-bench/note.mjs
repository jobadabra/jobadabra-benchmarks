// The one Telegram message a scheduled search round ends with (owner, 27 Oct 2026: "I want job search benchmarks to run on the CI and me
// getting telegram notifications"; "every 3 days"). Relevant jobs (right role AND in place) per tool, ours per persona, each against the
// previous run and the 27 Oct baseline round. Only counts, tool names and the made-up personas' title and city: no job, no URL.
// Usage: node search-bench/note.mjs <work dir> --round YYYY-MM-DD [--build abc1234] [--baseline search-bench/results/2026-10-27]
//          [--last <dir of earlier notes>] [--out note.json] [--url <run url>]
// Telegram: $CI_ALERTS_TELEGRAM_BOT_TOKEN and $CI_ALERTS_TELEGRAM_CHAT_ID (the Engineering bot, owner 12 Nov 2026); unset: printed only, and a failure in GitHub Actions. Guard: test/search-note.test.mjs.
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
import {NAME} from './tools.mjs';
import {CHIP, adminLink, delta, esc, link} from '../lib/telegram.mjs'; import {sendNote} from '../lib/telegram.mjs';

const rj = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const key = row => [row.title, row.company, row.location].map(part => (part || '').trim().toLowerCase()).join('|');
const relevant = row => row.role === 'yes' && row.place === 'yes';

/** rowsByPersona: {N: judged rows of persona N} (judge.py's rows) -> {round, build, tools: {tool: {relevant, found}}, personas: {N: {label, relevant, found}}} (personas: ours only) */
export function noteOf(rowsByPersona, {round = '', build = '', tiers = '', labels = {}, missing = [], notServed = [], rivalsOff = false} = {}) {
  const tools = {}, personas = {};
  for (const [n, rows] of Object.entries(rowsByPersona)) {
    for (const row of rows) { const t = (tools[row.tool] ||= {relevant: 0, found: 0}); t.found++; if (relevant(row)) t.relevant++; }
    const ours = rows.filter(row => row.tool === 'ours');
    personas[n] = {label: labels[n] || `Persona ${n}`, relevant: ours.filter(relevant).length, found: ours.length};
  }
  tools.ours ||= {relevant: 0, found: 0};
  return {round, build, ...(tiers ? {tiers} : {}), tools, personas, ...(rivalsOff ? {rivalsOff} : {})};
}

/** Reads judged<N>.json (a work dir) or persona-<N>.json (a results/<round> dir) into {N: rows}. */
export function readRound(dir) {
  const out = {};
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) { const m = f.match(/^(?:judged|persona-)(\d+)\.json$/); if (m) out[m[1]] = rj(path.join(dir, f))?.rows || []; }
  return out;
}

/**
 * note, baseline and last (notes or null), {missing: ["ours p3"], notServed, url} -> the message, Telegram HTML.
 * Why (12 Nov 2026, owner: "Not very clear to me"; the shape of the form note, chosen via AskUserQuestion, "Yes, this shape"): a verdict line, one line with every tool's number,
 * the searches that found nothing and the biggest moves, and what to know (failed jobs, rivals without data); the per-search table and the build lines are gone.
 */
export function noteText(note, baseline, last, {missing = [], notServed = [], url = ''} = {}) {
  // Why (12 Nov 2026, owner's Telegram screenshot: "ours 0 relevant of 0 shown, ▼108 vs the previous run 108" after the judge failed on all 10 people): no verdicts is not a 0. Say the judge failed, nothing else.
  if (!Object.keys(note.personas).length && missing.some(m => m.startsWith('judge '))) return [`${CHIP.bad} <b>Job search round not judged</b>: the judge failed, so this round has no numbers`, `⚠️ <b>Missing</b> (a job failed, not a 0): ${esc(missing.join(', '))}`, ...(url ? [link(url)] : [])].join('\n');
  const ours = note.tools.ours, searches = Object.keys(note.personas).length, empty = Object.entries(note.personas).filter(([, p]) => p.relevant === 0);
  // Why (27 Oct 2026, gitar-bot, #9): "ours" runs with the rivals' sources off; the baseline and the notes saved before ran with everything on, so ours is compared only with a reference that has rivalsOff.
  const same = ref => ref?.rivalsOff ? ref.tools.ours : undefined;
  const vs = (ref, label) => { const r = same(ref)?.relevant; return r === undefined ? '' : `${delta(note.tools.ours.relevant, r, 0)} vs ${label} ${r}`; };
  const ref = same(last) ? last : same(baseline) ? baseline : null, down = ref && ours.relevant < ref.tools.ours.relevant;   // 🟡: down against the nearest reference that ran the same way
  const chip = missing.length || ours.relevant === 0 ? CHIP.bad : down ? CHIP.warn : CHIP.good;
  const versus = ref ? `, ${vs(ref, ref === last ? 'the previous run' : 'baseline')}` : '';
  const lines = [`${chip} <b>Job search: ours ${ours.relevant} relevant of ${ours.found} shown</b>${versus}`];
  const rivals = Object.entries(note.tools).filter(([t]) => t !== 'ours').sort((a, b) => b[1].relevant - a[1].relevant);
  lines.push(`🏁 ${[`Ours ${ours.relevant}`, ...rivals.map(([t, s]) => `${esc(NAME[t] || t)} ${s.relevant}`)].join(' · ')}`);
  const moves = Object.entries(note.personas).map(([n, p]) => [p, ref?.personas?.[n]?.relevant == null ? 0 : p.relevant - ref.personas[n].relevant]).filter(([, d]) => d)   // the verdict line's reference (Gitar on #24)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3).map(([p, d]) => `${d > 0 ? '▲' : '▼'} ${esc(p.label)} ${d > 0 ? '+' : '−'}${Math.abs(d)}`);
  lines.push(empty.length ? `⚠️ ${empty.length} of ${searches} searches found nothing: ${empty.slice(0, 4).map(([, p]) => esc(p.label)).join('; ')}${empty.length > 4 ? ' …' : ''}` : `✅ ${searches === 1 ? 'the search' : `all ${searches} searches`} found something`);
  if (moves.length) lines.push(`📈 ${moves.join('; ')}`);
  const info = [];
  if (!ref) info.push(`no earlier run with the rivals' sources off yet`);
  if (notServed.length) info.push(`no data from the rivals for: ${esc(notServed.join(', '))} (not a failure, not a 0)`);
  if (info.length) lines.push(`ℹ️ ${info.join('; ')}`);
  if (missing.length) lines.push(`⚠️ <b>Missing</b> (a job failed, not a 0): ${esc(missing.join(', '))}`);
  const review = [link(url), adminLink('search', note.round)].filter(Boolean).join(' · ');   // the owner reads the round in Admin first, then publishes it from there
  if (review) lines.push(review);
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const work = process.argv[2], arg = n => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : ''; };
  const personas = rj(path.join(import.meta.dirname, 'personas.json')).personas;
  const labels = Object.fromEntries(personas.map((p, i) => [i + 1, `${p.title} · ${p.city}`]));
  const missingNow = rj(path.join(work, 'missing.json')) || [], notServedNow = rj(path.join(work, 'notserved.json')) || [];
  const note = noteOf(readRound(work), {round: arg('round'), build: arg('build'), tiers: arg('tiers') || '', labels, missing: missingNow, notServed: notServedNow, rivalsOff: true});
  const baseline = arg('baseline') ? noteOf(readRound(arg('baseline')), {labels}) : null;
  const lastDir = arg('last'), lastFile = lastDir && fs.existsSync(lastDir) ? fs.readdirSync(lastDir).filter(f => f.endsWith('.json')).sort().at(-1) : '';
  const last = lastFile ? rj(path.join(lastDir, lastFile)) : null;
  const unjudged = personas.map((_, i) => i + 1).filter(n => !fs.existsSync(path.join(work, `judged${n}.json`))).map(n => `judge p${n}`);
  const text = noteText(note, baseline, last, {missing: [...missingNow, ...unjudged], notServed: notServedNow, url: arg('url')});
  // Why (12 Nov 2026): a round the judge did not finish is never the "previous run" of the next one; run 43297527466 saved an all-zero note that the next real round would have been compared with.
  if (arg('out') && unjudged.length) console.log(`note not saved: ${unjudged.length} persona(s) have no verdicts`);
  else if (arg('out')) { fs.mkdirSync(path.dirname(arg('out')), {recursive: true}); fs.writeFileSync(arg('out'), JSON.stringify(note, null, 1) + '\n'); }
  console.log(text);
  await sendNote(text, process.env, fetch, 'search-benchmark-note');
}
