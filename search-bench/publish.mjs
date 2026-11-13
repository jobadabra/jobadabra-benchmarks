// node publish.mjs <work dir> [--round YYYY-MM-DD] [--build <sha>] [--dry]: turns one search-bench round (judgedN.json, ours/pN.log, co/pN/.../seconds.txt in <work dir>) into one summary row per tool and persona,
// keeps the judged lists (titles, employers, places, job system; no URLs, no posting texts) in search-bench/results/<round>/, and sends the rows to the owner-only page /admin/benchmark-job-search
// (PUT /benchmark-search/data, Bearer = Keychain jobadabra.site.selfheal_publish_key or $SELFHEAL_PUBLISH_KEY). --dry prints the rows and sends nothing.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {NAME, toolsOf} from './tools.mjs';

const [work] = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const flag = (name, fallback) => { const at = process.argv.indexOf(name); return at > 0 ? process.argv[at + 1] : fallback; };
if (!work) { console.error('usage: node publish.mjs <work dir> [--round YYYY-MM-DD] [--build <sha>] [--dry]'); process.exit(2); }
const here = import.meta.dirname, round = flag('--round', new Date().toISOString().slice(0, 10)), build = flag('--build', '').slice(0, 7), dry = process.argv.includes('--dry');
const personas = JSON.parse(fs.readFileSync(path.join(here, 'personas.json'), 'utf8')).personas;
const read = (file, fallback = '') => { try { return fs.readFileSync(file, 'utf8'); } catch { return fallback; } };
// Why (13 Nov 2026, owner: "Yes, switch to app tiers"; field name from jobadabra-web's `ai` column via mac-9a): our rows say which AI the round ran on, "app" or "haiku" (work/tiers.txt), so the page can mark the break; rivals have no AI and omit it, an old round without the file reads as haiku there.
const ai = read(path.join(work, 'tiers.txt')).trim() === 'app' ? 'app' : 'haiku';
const norm = row => [row.title, row.company, row.location].map(part => (part || '').trim().toLowerCase()).join('|');
const rows = [];
const missing = JSON.parse(read(path.join(work, 'missing.json'), '[]'));   // "ours p3"-style labels: a rival whose job failed has no rows (pool.mjs)
fs.mkdirSync(path.join(here, 'results', round), {recursive: true});

// every tool of the round, so a tool that found nothing on a persona still shows a 0 there
const roundTools = toolsOf([...missing.map(label => ({tool: label.replace(/ p\d+$/, '')})), ...personas.flatMap((_, at) => { try { return JSON.parse(fs.readFileSync(path.join(work, `judged${at + 1}.json`), 'utf8')).rows; } catch { return []; } })]);
personas.forEach((persona, at) => {
  const n = at + 1, judged = path.join(work, `judged${n}.json`);
  if (!fs.existsSync(judged)) return;
  const list = JSON.parse(fs.readFileSync(judged, 'utf8')).rows;
  fs.copyFileSync(judged, path.join(here, 'results', round, `persona-${n}.json`));
  const label = `${persona.title} · ${persona.city}`;
  const seconds = {
    ours: Number((read(path.join(work, 'ours', `p${n}.log`)).match(/^PRESS .*\((\d+) s/m) || [])[1] || 0),
    'career-ops': Number(read(path.join(work, 'co', `p${n}`, `career-ops-persona-${n}`, 'seconds.txt'), '0').trim()) || 0,
    'career-ops-docs': Number(read(path.join(work, 'co-docs', `p${n}`, 'seconds.txt'), '0').trim()) || 0,
  };
  const relevant = row => row.role === 'yes' && row.place === 'yes';
  const oursKeys = new Set(list.filter(row => row.tool === 'ours').map(norm));
  for (const tool of roundTools) {
    if (missing.includes(`${tool} p${n}`)) continue;   // Why (27 Oct 2026, owner): a failed search has no score, never a found-zero row.
    const name = NAME[tool] || tool;
    const mine = list.filter(row => row.tool === tool);
    const missed = {};   // the job systems of this tool's relevant jobs the other tool did not show
    if (tool !== 'ours') for (const row of mine.filter(relevant)) if (!oursKeys.has(norm(row))) missed[row.provider || 'unknown'] = (missed[row.provider || 'unknown'] || 0) + 1;
    rows.push({id: `${round}/p${n}/${tool}`, at: new Date().toISOString(), round, persona: label, kind: persona.kind, country: persona.country, tool: name, ours: tool === 'ours', build: tool === 'ours' ? build : '',
      ...(tool === 'ours' ? {ai} : {}),
      found: mine.length, place: mine.filter(row => row.place === 'yes').length, role: mine.filter(row => row.role === 'yes').length, relevant: mine.filter(relevant).length,
      employers: new Set(mine.map(row => (row.company || '').toLowerCase()).filter(Boolean)).size, seconds: seconds[tool] || 0, cents: 0, missed});
  }
});

if (dry || !rows.length) { console.log(JSON.stringify(rows, null, 1)); console.log(`${rows.length} rows${dry ? ' (dry)' : ''}`); process.exit(0); }
const key = process.env.SELFHEAL_PUBLISH_KEY || execFileSync('security', ['find-generic-password', '-a', 'jobadabra', '-s', 'jobadabra.site.selfheal_publish_key', '-w'], {encoding: 'utf8'}).trim();
const response = await fetch('https://www.jobadabra.top/benchmark-search/data', {method: 'PUT', headers: {Authorization: `Bearer ${key}`, 'content-type': 'application/json'}, body: JSON.stringify({runs: rows})});
const answer = await response.text(); console.log(response.status, answer);
if (!response.ok || !/"ok":true/.test(answer)) process.exit(1);   // Why (27 Oct 2026): on CI a refused publish must turn the round red
