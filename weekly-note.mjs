// A weekly round's last word: one Telegram message (lib/weekly-note.mjs) and its note, kept on the weekly-picks tag for next week.
// Usage: node weekly-note.mjs <judged pool> --round fixed|week-YYYY-Www [--build abc1234 (default: our runs' build)] [--baseline rounds/fixed/baseline.json] [--forms forms-objective.json]
//          [--last <dir of earlier notes of this kind>] [--out note.json] [--url <run url>]
// Telegram: $CI_ALERTS_TELEGRAM_BOT_TOKEN and $CI_ALERTS_TELEGRAM_CHAT_ID (the Engineering bot, owner 12 Nov 2026); unset: printed only, and a failure in GitHub Actions.
import fs from 'node:fs'; import path from 'node:path';
import {scoreRound} from './score-round.mjs'; import {noteOf, noteText, readFailures, rivalsSince} from './lib/weekly-note.mjs'; import {sendNote} from './lib/telegram.mjs'; import {setChanges} from './lib/forms.mjs';
const arg = n => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : ''; };
const rj = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const pool = process.argv[2], round = arg('round');
const buildOf = () => { for (const form of fs.readdirSync(pool)) { const dir = path.join(pool, form, 'extension'); if (!fs.existsSync(dir)) continue;
  for (const run of fs.readdirSync(dir)) { const m = rj(path.join(dir, run, 'manifest.json')); if (m?.build) return String(m.build).slice(0, 7); } } return ''; };
const scored = scoreRound(pool, {rows: true}), failed = readFailures(pool, 'extension');
const note = noteOf(scored, {round, build: arg('build') || buildOf(), rivalsSince: round === 'fixed' ? rivalsSince(pool) : '', setChanges: round === 'fixed' ? setChanges(rj(arg('forms') || 'forms-objective.json') || []) : [], missingForms: scored.tools.extension ? failed.byForm : {}, ourFailure: scored.tools.extension ? '' : failed.runs ? `all ${failed.runs} of our runs failed: ${failed.reason || 'no reason in their result files'}` : ''});
const lastDir = arg('last'), last = lastDir && fs.existsSync(lastDir) ? rj(path.join(lastDir, fs.readdirSync(lastDir).filter(f => f.endsWith('.json')).sort().at(-1) || '-')) : null;
const text = noteText(note, arg('baseline') ? rj(arg('baseline')) : null, last, arg('url'));
if (arg('out')) fs.writeFileSync(arg('out'), JSON.stringify(note, null, 1) + '\n');
console.log(text);
await sendNote(text, process.env, fetch, 'form-benchmark-note');
