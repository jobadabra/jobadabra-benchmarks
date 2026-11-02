// Sends a judged fair round to /admin/form-filling/benchmark (owner via 6e, 27 Oct 2026: every round publishes itself as its last step).
// One row per tool, form and repeat: right / wrong / empty-but-answerable / not reached (score-round.mjs), with the round ('fixed' or
// 'week-YYYY-Www'), the repeat and our build. Forms go out as "Form <id>", tools by name; no host or page text. Bearer: $BENCHMARK_PUBLISH_KEY,
// else the Keychain item jobadabra.site.selfheal_publish_key. Guard: test/publish-fair.test.mjs.
// Usage: node publish-fair.mjs <round dir> --round fixed|week-YYYY-Www [--dry]
import fs from 'node:fs'; import path from 'node:path'; import {execFileSync} from 'node:child_process'; import {fileURLToPath} from 'node:url';
import {scoreRound} from './score-round.mjs';

export const NAME = {extension: 'Our extension', 'browser-use': 'Browser Use', stagehand: 'Stagehand', nanobrowser: 'Nanobrowser'};
export const ROUND = /^(fixed|week-\d{4}-W\d{2})$/;
const rj = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

export function fairRows(round, key) {
  if (!ROUND.test(key)) throw new Error(`round must be fixed or week-YYYY-Www, got ${key}`);
  const {rows} = scoreRound(round, {rows: true});
  return rows.filter(r => NAME[r.tool]).map(r => {
    const m = rj(path.join(round, r.form, r.tool, r.run, 'manifest.json')) || {}, ours = r.tool === 'extension';
    const build = ours ? String(m.build || m.extension?.commit || '').slice(0, 7) : '';
    const rep = Math.max(1, Math.min(9, Number.parseInt(r.run, 10) || 1));
    return {id: `${key}/${r.form}/${r.tool}/${build}/${rep}`, at: String(m.startedAt || new Date().toISOString()).slice(0, 19) + 'Z', round: key, rep, applicant: 'thin', mode: 'user',
      tool: NAME[r.tool], ours, build, form: `Form ${r.form}`, heldout: 1, fixes: '',
      required: r.right + r.wrong + r.emptyAnswerable, right: r.right, wrong: r.wrong, empty: r.emptyAnswerable, unreached: r.notReached, unans: r.unanswerable, holds: 0, dups: 0};
  });
}

const keyOf = () => process.env.BENCHMARK_PUBLISH_KEY || execFileSync('security', ['find-generic-password', '-a', 'jobadabra', '-s', 'jobadabra.site.selfheal_publish_key', '-w'], {encoding: 'utf8'}).trim();

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [round] = process.argv.slice(2), at = process.argv.indexOf('--round'), key = at > 0 ? process.argv[at + 1] : '';
  const runs = fairRows(round, key);
  console.log(`publish-fair: ${runs.length} rows, round ${key}, tools ${[...new Set(runs.map(r => r.tool))].join(', ')}, ours build ${[...new Set(runs.filter(r => r.ours).map(r => r.build))].join(', ')}`);
  if (!process.argv.includes('--dry')) {
    const res = await fetch(process.env.BENCHMARK_URL || 'https://www.jobadabra.top/benchmark/data', {method: 'PUT', headers: {Authorization: `Bearer ${keyOf()}`, 'Content-Type': 'application/json'}, body: JSON.stringify({runs})});
    const text = await res.text(); console.log(`publish-fair: ${res.status} ${text.slice(0, 200)}`);
    if (!res.ok || !/"ok":true/.test(text)) process.exit(1);
  }
}
