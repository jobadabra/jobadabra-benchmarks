// The Jooble + JobSpy target of the extra Trello profiles (13 Nov 2026, sa for the owner: "if jobble find 20 and jobspy 10 then the target should be 15"). From the judged pools of
// search-targets.yml it prints, per profile, the right jobs each rival found (role AND place = yes, one per title + employer), and their average rounded half up.
// Invariant: a rival whose job failed, that does not serve the country, or whose list the judge could not fully judge is "not measured", never 0; with one rival measured there is no average.
// Usage: node search-bench/targets.mjs <work dir> <personas file> <numbers JSON> <out.md> [out.json]
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';

const RIVALS = ['jooble', 'jobspy'];
const rj = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } };
const unjudged = row => !['yes', 'no'].includes(row.role) || !['yes', 'remote', 'no', 'unknown'].includes(row.place);

/** Right jobs of one rival in one judged persona: a number, or why there is none. */
export function rightOf(judged, rival, label, missing, notServed) {
  if (notServed.includes(label)) return {state: 'not served'};
  if (missing.includes(label)) return {state: 'not measured (the read failed)'};
  if (!judged) return {state: 'not measured (not judged)'};
  const rows = judged.rows.filter(row => row.tool === rival);
  if (rows.some(unjudged)) return {state: 'not measured (not fully judged)'};
  const right = new Set(rows.filter(row => row.role === 'yes' && row.place === 'yes').map(row => `${row.title.trim().toLowerCase()}|${(row.company || '').trim().toLowerCase()}`));
  return {right: right.size, found: new Set(rows.map(row => `${row.title.trim().toLowerCase()}|${(row.company || '').trim().toLowerCase()}`)).size};
}

/** The table's rows for the persona numbers (1-based indexes into the personas file). */
export function summarize(work, personas, numbers) {
  const missing = rj(path.join(work, 'missing.json'), []), notServed = rj(path.join(work, 'notserved.json'), []);
  return numbers.map(n => {
    const p = personas[n - 1], judged = rj(path.join(work, `judged${n}.json`), null), row = {n, id: p.id, role: p.title, city: p.city, country: p.country};
    for (const rival of RIVALS) row[rival] = rightOf(judged, rival, `${rival} p${n}`, missing, notServed);
    const [a, b] = RIVALS.map(rival => row[rival].right);
    row.average = a !== undefined && b !== undefined ? Math.floor((a + b) / 2 + 0.5) : null;   // half up: 20 and 5 -> 13
    return row;
  });
}

export const cell = c => c.right !== undefined ? `${c.right} (of ${c.found})` : c.state;

export function markdown(rows) {
  const head = '| id | role | place | Jooble right | JobSpy right | average (half up) |\n|---|---|---|---|---|---|\n';
  return head + rows.map(r => `| ${r.id} | ${r.role} | ${r.city}, ${r.country} | ${cell(r.jooble)} | ${cell(r.jobspy)} | ${r.average ?? 'not measured (needs both)'} |`).join('\n') + '\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [work, personasFile, numbers, out, outJson] = process.argv.slice(2);
  const rows = summarize(work, JSON.parse(fs.readFileSync(personasFile, 'utf8')).personas, JSON.parse(numbers));
  fs.writeFileSync(out, markdown(rows)); if (outJson) fs.writeFileSync(outJson, JSON.stringify(rows, null, 1));
  console.log(markdown(rows));
}
