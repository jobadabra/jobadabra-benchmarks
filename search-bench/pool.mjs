// Lays out one CI search round for judge.py and publish.mjs (search-round.yml; owner, 27 Oct 2026: "every 3 days"). From the downloaded
// artifacts (search-ours-p<N>-x1/, search-<rival>-p<N>/) it writes <work>/pool<N>.json (tool, title, company, place, job system: no URL,
// no posting text) and <work>/ours/p<N>.log (publish.mjs reads our time there). A tool whose list is missing for a persona is named in
// <work>/missing.json: a failed job must never read as "found 0". A rival that answered "not served here" (null list + its meta says notServed) is named in
// <work>/notserved.json instead: no data for that place, not a failure. Guard: test/search-pool.test.mjs.
// Usage: node search-bench/pool.mjs <artifacts dir> <work dir>
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';

// Why (27 Oct 2026, owner: "I want to compete our algorithm with their algorithms"): the rivals are listed once, in rivals.json; search-round.yml turns
// their sources off in "ours", the one arm of ours (13 Nov 2026, owner: no run with them on).
export const RIVALS = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'rivals.json'), 'utf8'));
const rj = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const first = files => files.find(f => fs.existsSync(f));
const keep = row => ({tool: row.tool, title: row.title || '', company: row.company || '', location: row.location || '', provider: row.provider || ''});

/**
 * @param {string} art the folder actions/download-artifact filled (one sub-folder per artifact)
 * @param {{personas?: number, rivals?: string[], numbers?: number[], ours?: boolean}} opts numbers = the persona numbers to lay out (default 1..personas); errorsMakeEmptyMissing = an empty list whose meta names errors is a failed read, not "found 0" (search-targets.yml); ours false = no arm of ours (search-targets.yml: rivals only, nothing named missing for it)
 * @param {string} work where pool<N>.json, ours/p<N>.log, missing.json and build.txt go
 * @returns {{missing: string[], notServed: string[], build: string, tiers: string}} missing = "ours p3"-style labels of jobs that failed; notServed = rivals that said they do not serve that place; build = our short commit, '' if no ours artifact
 */
export function layOut(art, work, {personas = 10, rivals = RIVALS, numbers = null, ours: withOurs = true, errorsMakeEmptyMissing = false} = {}) {
  fs.mkdirSync(path.join(work, 'ours'), {recursive: true});
  const missing = [], notServed = []; let build = '', tiers = '';
  for (const n of numbers || Array.from({length: personas}, (_, i) => i + 1)) {
    const pool = [], ours = path.join(art, `search-ours-p${n}-x1`);
    const jobs = withOurs ? rj(path.join(ours, 'out', 'jobs.json')) : null;
    if (Array.isArray(jobs)) pool.push(...jobs.map(row => keep({...row, tool: 'ours'}))); else if (withOurs) missing.push(`ours p${n}`);
    const log = path.join(ours, 'out', 'run.log');
    if (fs.existsSync(log)) fs.copyFileSync(log, path.join(work, 'ours', `p${n}.log`));
    build ||= ((fs.existsSync(path.join(ours, 'build.txt')) ? fs.readFileSync(path.join(ours, 'build.txt'), 'utf8') : '').match(/build: (\w+)/) || [])[1] || '';
    tiers ||= (fs.existsSync(path.join(ours, 'out', 'tiers-mode.txt')) ? fs.readFileSync(path.join(ours, 'out', 'tiers-mode.txt'), 'utf8') : '').trim();
    for (const rival of rivals) {
      const dir = path.join(art, `search-${rival}-p${n}`), file = first([path.join(dir, `${rival}-p${n}.json`), path.join(dir, 'out', `${rival}-p${n}.json`)]), list = rj(file || '-');
      // Why (2 Nov 2026, Gitar on #14): a null list from a rival that says it does not serve the place is "no data", not a failed job; without that word it stays missing.
      const errored = errorsMakeEmptyMissing && Array.isArray(list) && list.length === 0 && file && Object.keys(rj(file.replace(/\.json$/, '.meta.json'))?.errors || {}).length > 0;   // Why (13 Nov 2026, run 43432473083, c09): JobSpy's 4 sites all errored and the empty list read as "0 right jobs"
      if (errored) missing.push(`${rival} p${n}`);
      else if (Array.isArray(list)) pool.push(...list.map(row => keep({...row, tool: rival})));
      else if (list === null && file && rj(file.replace(/\.json$/, '.meta.json'))?.notServed === true) notServed.push(`${rival} p${n}`);
      else missing.push(`${rival} p${n}`);
    }
    fs.writeFileSync(path.join(work, `pool${n}.json`), JSON.stringify(pool, null, 1));
  }
  fs.writeFileSync(path.join(work, 'missing.json'), JSON.stringify(missing));
  fs.writeFileSync(path.join(work, 'notserved.json'), JSON.stringify(notServed));
  fs.writeFileSync(path.join(work, 'build.txt'), build);
  fs.writeFileSync(path.join(work, 'tiers.txt'), tiers);   // Why (13 Nov 2026, owner: "Yes, switch to app tiers"): app-tier rounds are not comparable with the Haiku ones; the note carries which one a round ran on
  return {missing, notServed, build, tiers};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [art, work] = process.argv.slice(2);
  const {missing, notServed, build} = layOut(art, work);
  console.log(`pool: build ${build || '?'}; missing: ${missing.join(', ') || 'none'}; not served: ${notServed.join(', ') || 'none'}`);
}
