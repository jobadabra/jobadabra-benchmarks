// search-bench/pool.mjs: the CI artifacts become one pool per persona (title, employer, place, job system; no URL) and a tool whose list
// is missing is named, never read as "found 0".
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {layOut} from '../search-bench/pool.mjs';
const put = (file, value) => { fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value)); };

test('ours and the rivals land in one pool; the missing ones are named; the build is read', () => {
  const art = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-art-')), work = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-work-'));
  put(path.join(art, 'search-ours-p1-x1', 'build.txt'), 'our build: abc1234\n');
  put(path.join(art, 'search-ours-p1-x1', 'out', 'jobs.json'), [{tool: 'ours', title: 'Nurse', company: 'Clinic', location: 'Town', provider: 'greenhouse', url: 'https://x.test/1'}]);
  put(path.join(art, 'search-ours-p1-x1', 'out', 'run.log'), 'PRESS 1 (120 s)\n');
  put(path.join(art, 'search-ours-all-p1-x1', 'out', 'jobs.json'), [{tool: 'ours', title: 'Nurse', company: 'Clinic', location: 'Town'}, {tool: 'ours', title: 'Aide', company: 'EURES Co', location: 'Town', provider: 'EURES'}]);
  put(path.join(art, 'search-jobspy-p1', 'jobspy-p1.json'), [{tool: 'jobspy', title: 'Nurse', company: 'Ward', location: 'Town', job_url: 'https://y.test'}]);
  put(path.join(art, 'search-eures-p1', 'out', 'eures-p1.json'), []);
  const {missing, build} = layOut(art, work, {personas: 2});
  assert.equal(build, 'abc1234');
  assert.deepEqual(missing, ['adzuna p1', 'ours p2', 'ours-all p2', 'jobspy p2', 'eures p2', 'adzuna p2']);
  const pool = JSON.parse(fs.readFileSync(path.join(work, 'pool1.json'), 'utf8'));
  assert.deepEqual(pool.map(r => r.tool), ['ours', 'ours-all', 'ours-all', 'jobspy']);
  assert.deepEqual(Object.keys(pool[0]), ['tool', 'title', 'company', 'location', 'provider'], 'no URL reaches the judge');
  assert.equal(fs.readFileSync(path.join(work, 'ours', 'p1.log'), 'utf8'), 'PRESS 1 (120 s)\n');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(work, 'missing.json'), 'utf8')), missing);
});

// Why (2 Nov 2026, coordinator on benchmarks#14): a rival that is not served for a country, or could not place its jobs, writes null; that is unknown, never found-0 (an empty list is a real 0).
test('a rival that wrote null is missing (unknown); one that wrote an empty list found 0', () => {
  const art = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-art-')), work = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-work-'));
  put(path.join(art, 'search-ours-p1-x1', 'out', 'jobs.json'), []);
  put(path.join(art, 'search-ours-all-p1-x1', 'out', 'jobs.json'), []);
  put(path.join(art, 'search-jobspy-p1', 'jobspy-p1.json'), []);
  put(path.join(art, 'search-eures-p1', 'out', 'eures-p1.json'), 'null');
  put(path.join(art, 'search-adzuna-p1', 'out', 'adzuna-p1.json'), 'null');
  assert.deepEqual(layOut(art, work, {personas: 1}).missing, ['eures p1', 'adzuna p1']);
});

// Why (2 Nov 2026, Gitar on #14): null from a rival whose meta says notServed is "no data for that place", listed apart from the jobs that failed (a null with no such word, or no file, is still a failure).
test('a rival that says it does not serve the place is listed as not served, never as a failed job', () => {
  const art = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-art-')), work = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-work-'));
  put(path.join(art, 'search-ours-p1-x1', 'out', 'jobs.json'), []);
  put(path.join(art, 'search-ours-all-p1-x1', 'out', 'jobs.json'), []);
  put(path.join(art, 'search-jobspy-p1', 'jobspy-p1.json'), []);
  put(path.join(art, 'search-adzuna-p1', 'out', 'adzuna-p1.json'), 'null');
  put(path.join(art, 'search-adzuna-p1', 'out', 'adzuna-p1.meta.json'), {rival: 'adzuna', kept: null, notServed: true, errors: []});
  put(path.join(art, 'search-eures-p1', 'out', 'eures-p1.json'), 'null');
  put(path.join(art, 'search-eures-p1', 'out', 'eures-p1.meta.json'), {rival: 'eures', kept: null, notServed: false, errors: ['http 500']});
  const {missing, notServed} = layOut(art, work, {personas: 1});
  assert.deepEqual(notServed, ['adzuna p1']);
  assert.deepEqual(missing, ['eures p1'], 'a null with errors and no notServed word is a failure');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(work, 'notserved.json'), 'utf8')), ['adzuna p1']);
});

test('the rivals are listed once (rivals.json): the rivals workflow, the round and the fair ours arm read the same names', () => {
  const rivals = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'search-bench', 'rivals.json'), 'utf8')), flows = path.join(import.meta.dirname, '..', '.github', 'workflows');
  for (const f of ['search-rivals.yml', 'search-round.yml']) assert.ok(fs.readFileSync(path.join(flows, f), 'utf8').includes(JSON.stringify(rivals).replace(/","/g, '","')), `${f} lists ${rivals}`);
  const ours = fs.readFileSync(path.join(flows, 'search-ours.yml'), 'utf8');
  assert.match(ours, /rivals\.json/, 'the fair arm reads the list');
  assert.match(ours, /JOB_PILOTTO_DISABLE="\$off"/);
});
