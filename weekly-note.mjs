// A weekly round's last word: one Telegram message (lib/weekly-note.mjs) and its note, kept on the weekly-picks tag for next week.
// Usage: node weekly-note.mjs <judged pool> --round fixed|week-YYYY-Www [--build abc1234 (default: our runs' build)] [--baseline rounds/fixed/baseline.json]
//          [--last <dir of earlier notes of this kind>] [--out note.json] [--url <run url>]
// Telegram: $BENCH_TELEGRAM_BOT_TOKEN and $BENCH_TELEGRAM_CHAT_ID (the benchmarks bot, owner 27 Oct 2026); unset: printed only.
import fs from 'node:fs'; import path from 'node:path';
import {scoreRound} from './score-round.mjs'; import {noteOf, noteText} from './lib/weekly-note.mjs';
const arg = n => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : ''; };
const rj = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const pool = process.argv[2], round = arg('round');
const buildOf = () => { for (const form of fs.readdirSync(pool)) { const dir = path.join(pool, form, 'extension'); if (!fs.existsSync(dir)) continue;
  for (const run of fs.readdirSync(dir)) { const m = rj(path.join(dir, run, 'manifest.json')); if (m?.build) return String(m.build).slice(0, 7); } } return ''; };
const note = noteOf(scoreRound(pool, {rows: true}), {round, build: arg('build') || buildOf()});
const lastDir = arg('last'), last = lastDir && fs.existsSync(lastDir) ? rj(path.join(lastDir, fs.readdirSync(lastDir).filter(f => f.endsWith('.json')).sort().at(-1) || '-')) : null;
const text = noteText(note, arg('baseline') ? rj(arg('baseline')) : null, last, arg('url'));
if (arg('out')) fs.writeFileSync(arg('out'), JSON.stringify(note, null, 1) + '\n');
console.log(text);
const {BENCH_TELEGRAM_BOT_TOKEN: token, BENCH_TELEGRAM_CHAT_ID: chat} = process.env;
if (!token || !chat) console.log('telegram: BENCH_TELEGRAM_BOT_TOKEN / BENCH_TELEGRAM_CHAT_ID not set, printed only');
else {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({chat_id: chat, text, disable_web_page_preview: true})});
  console.log(`telegram: ${res.status}`); if (!res.ok) process.exit(1);
}
