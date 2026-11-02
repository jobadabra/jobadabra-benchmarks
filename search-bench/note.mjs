// The one Telegram message a scheduled search round ends with (owner, 27 Oct 2026: "I want job search benchmarks to run on the CI and me
// getting telegram notifications"; "every 3 days"). Relevant jobs (right role AND in place) per tool, ours per persona, each against the
// previous run and the 27 Oct baseline round. Only counts, tool names and the made-up personas' title and city: no job, no URL.
// Usage: node search-bench/note.mjs <work dir> --round YYYY-MM-DD [--build abc1234] [--baseline search-bench/results/2026-10-27]
//          [--last <dir of earlier notes>] [--out note.json] [--url <run url>]
// Telegram: $BENCH_TELEGRAM_BOT_TOKEN and $BENCH_TELEGRAM_CHAT_ID (the benchmarks bot); unset: printed only. Guard: test/search-note.test.mjs.
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
import {NAME} from './tools.mjs';
import {RIVALS} from './pool.mjs';

const rj = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const key = row => [row.title, row.company, row.location].map(part => (part || '').trim().toLowerCase()).join('|');
const relevant = row => row.role === 'yes' && row.place === 'yes';

/** rowsByPersona: {N: judged rows of persona N} (judge.py's rows) -> {round, build, tools: {tool: {relevant, found}}, personas: {N: {label, relevant, found}}} (personas: ours only) */
export function noteOf(rowsByPersona, {round = '', build = '', labels = {}, missing = [], notServed = [], rivalsOff = false} = {}) {
  const tools = {}, personas = {}, beyond = {};
  for (const [n, rows] of Object.entries(rowsByPersona)) {
    for (const rival of RIVALS) {   // our relevant jobs (every source on) that this rival did not show, summed over the personas
      const seen = new Set(rows.filter(row => row.tool === rival).map(key));
      // Why (27 Oct 2026, gitar-bot, #9): a rival whose job failed has no rows; counting every ours-all job as beyond it would show a made-up lead.
      if (!missing.includes(`${rival} p${n}`) && !notServed.includes(`${rival} p${n}`) && rows.some(row => row.tool === 'ours-all')) beyond[rival] = (beyond[rival] || 0) + rows.filter(row => row.tool === 'ours-all' && relevant(row) && !seen.has(key(row))).length;
    }
    for (const row of rows) { const t = (tools[row.tool] ||= {relevant: 0, found: 0}); t.found++; if (relevant(row)) t.relevant++; }
    const ours = rows.filter(row => row.tool === 'ours');
    personas[n] = {label: labels[n] || `Persona ${n}`, relevant: ours.filter(relevant).length, found: ours.length};
  }
  tools.ours ||= {relevant: 0, found: 0};
  return {round, build, tools, personas, ...(rivalsOff ? {rivalsOff} : {}), ...(Object.keys(beyond).length ? {beyond} : {})};
}

/** Reads judged<N>.json (a work dir) or persona-<N>.json (a results/<round> dir) into {N: rows}. */
export function readRound(dir) {
  const out = {};
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) { const m = f.match(/^(?:judged|persona-)(\d+)\.json$/); if (m) out[m[1]] = rj(path.join(dir, f))?.rows || []; }
  return out;
}

const diff = (now, then) => (then == null ? '' : now > then ? ` ▲${now - then}` : now < then ? ` ▼${then - now}` : ' =');

/** note, baseline and last (notes or null), {missing: ["ours p3"], url} -> the message text */
export function noteText(note, baseline, last, {missing = [], notServed = [], url = ''} = {}) {
  const ours = note.tools.ours, none = Object.values(note.personas).filter(p => p.relevant === 0).length;
  // Why (27 Oct 2026, gitar-bot, #9): "ours" now runs with the rivals' sources off; the baseline and the notes saved before ran with everything on. Each line is
  // compared only with a reference that ran the same way: ours with a note that has rivalsOff, ours-all with a note's ours-all, or (an old note) its ours, which had every source on.
  const same = (ref, tool) => (tool === 'ours' ? (ref?.rivalsOff ? ref.tools.ours : undefined) : ref?.tools['ours-all'] || (ref && !ref.rivalsOff ? ref.tools.ours : undefined));
  const vs = (ref, label, tool = 'ours') => { const r = same(ref, tool)?.relevant; return r === undefined ? '' : ` (${diff(note.tools[tool].relevant, r).trim()} vs ${label} ${r})`; };
  const lines = [`🔎 Search round · ${note.round}${note.build ? ` · build ${note.build}` : ''}`,
    `Ours (rivals' sources off) ${ours.relevant} relevant of ${ours.found} shown${vs(last, 'the previous run')}${vs(baseline, 'baseline')}${last || baseline ? (same(last, 'ours') || same(baseline, 'ours') ? '' : ' (no earlier run with the rivals off yet)') : ''}`];
  const all = note.tools['ours-all'];
  if (all) lines.push(`Ours with every source ${all.relevant} relevant of ${all.found} shown${vs(last, 'the previous run', 'ours-all')}${vs(baseline, 'baseline', 'ours-all')}${note.beyond ? `; we add beyond ${Object.entries(note.beyond).map(([r, k]) => `${NAME[r] || r} ${k}`).join(' · ')}` : ''}`);
  const rivals = Object.entries(note.tools).filter(([t]) => t !== 'ours' && t !== 'ours-all').sort((a, b) => b[1].relevant - a[1].relevant);
  if (rivals.length) lines.push(rivals.map(([t, s]) => `${NAME[t] || t} ${s.relevant}${diff(s.relevant, (last || baseline)?.tools[t]?.relevant)}`).join(' · '));
  lines.push(`Searches with none: ${none} of ${Object.keys(note.personas).length}`);
  for (const [n, p] of Object.entries(note.personas).sort((a, b) => a[0] - b[0])) {
    const ref = same(last || baseline, 'ours') ? (last || baseline)?.personas?.[n] : undefined;   // the same way of running, or no arrow
    lines.push(`${p.label}: ${p.relevant} of ${p.found} shown${diff(p.relevant, ref?.relevant)}`);
  }
  if (missing.length) lines.push(`⚠ Missing (a job failed, not a 0): ${missing.join(', ')}`);
  if (notServed.length) lines.push(`ℹ Not served (the rival has no data for that place; not a failure, not a 0): ${notServed.join(', ')}`);
  if (url) lines.push(url);
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const work = process.argv[2], arg = n => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : ''; };
  const personas = rj(path.join(import.meta.dirname, 'personas.json')).personas;
  const labels = Object.fromEntries(personas.map((p, i) => [i + 1, `${p.title} · ${p.city}`]));
  const missingNow = rj(path.join(work, 'missing.json')) || [], notServedNow = rj(path.join(work, 'notserved.json')) || [];
  const note = noteOf(readRound(work), {round: arg('round'), build: arg('build'), labels, missing: missingNow, notServed: notServedNow, rivalsOff: true});
  const baseline = arg('baseline') ? noteOf(readRound(arg('baseline')), {labels}) : null;
  const lastDir = arg('last'), lastFile = lastDir && fs.existsSync(lastDir) ? fs.readdirSync(lastDir).filter(f => f.endsWith('.json')).sort().at(-1) : '';
  const last = lastFile ? rj(path.join(lastDir, lastFile)) : null;
  const unjudged = personas.map((_, i) => i + 1).filter(n => !fs.existsSync(path.join(work, `judged${n}.json`))).map(n => `judge p${n}`);
  const text = noteText(note, baseline, last, {missing: [...missingNow, ...unjudged], notServed: notServedNow, url: arg('url')});
  if (arg('out')) { fs.mkdirSync(path.dirname(arg('out')), {recursive: true}); fs.writeFileSync(arg('out'), JSON.stringify(note, null, 1) + '\n'); }
  console.log(text);
  const {BENCH_TELEGRAM_BOT_TOKEN: token, BENCH_TELEGRAM_CHAT_ID: chat} = process.env;
  if (!token || !chat) console.log('telegram: BENCH_TELEGRAM_BOT_TOKEN / BENCH_TELEGRAM_CHAT_ID not set, printed only');
  else {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({chat_id: chat, text, disable_web_page_preview: true})});
    console.log(`telegram: ${res.status}`); if (!res.ok) process.exit(1);
  }
}
