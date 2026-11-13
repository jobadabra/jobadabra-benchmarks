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
  put(path.join(art, 'search-jobspy-p1', 'jobspy-p1.json'), [{tool: 'jobspy', title: 'Nurse', company: 'Ward', location: 'Town', job_url: 'https://y.test'}]);
  put(path.join(art, 'search-eures-p1', 'out', 'eures-p1.json'), []);
  put(path.join(art, 'search-jooble-p1', 'out', 'jooble-p1.json'), []);
  const {missing, build} = layOut(art, work, {personas: 2});
  assert.equal(build, 'abc1234');
  assert.deepEqual(missing, ['adzuna p1', 'ours p2', 'jobspy p2', 'eures p2', 'adzuna p2', 'jooble p2']);
  const pool = JSON.parse(fs.readFileSync(path.join(work, 'pool1.json'), 'utf8'));
  assert.deepEqual(pool.map(r => r.tool), ['ours', 'jobspy']);
  assert.deepEqual(Object.keys(pool[0]), ['tool', 'title', 'company', 'location', 'provider'], 'no URL reaches the judge');
  assert.equal(fs.readFileSync(path.join(work, 'ours', 'p1.log'), 'utf8'), 'PRESS 1 (120 s)\n');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(work, 'missing.json'), 'utf8')), missing);
});

// Why (2 Nov 2026, coordinator on benchmarks#14): a rival that is not served for a country, or could not place its jobs, writes null; that is unknown, never found-0 (an empty list is a real 0).
test('a rival that wrote null is missing (unknown); one that wrote an empty list found 0', () => {
  const art = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-art-')), work = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-work-'));
  put(path.join(art, 'search-ours-p1-x1', 'out', 'jobs.json'), []);
  put(path.join(art, 'search-jobspy-p1', 'jobspy-p1.json'), []);
  put(path.join(art, 'search-eures-p1', 'out', 'eures-p1.json'), 'null');
  put(path.join(art, 'search-adzuna-p1', 'out', 'adzuna-p1.json'), 'null');
  put(path.join(art, 'search-jooble-p1', 'out', 'jooble-p1.json'), []);
  assert.deepEqual(layOut(art, work, {personas: 1}).missing, ['eures p1', 'adzuna p1']);
});

// Why (2 Nov 2026, Gitar on #14): null from a rival whose meta says notServed is "no data for that place", listed apart from the jobs that failed (a null with no such word, or no file, is still a failure).
test('a rival that says it does not serve the place is listed as not served, never as a failed job', () => {
  const art = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-art-')), work = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-work-'));
  put(path.join(art, 'search-ours-p1-x1', 'out', 'jobs.json'), []);
  put(path.join(art, 'search-jobspy-p1', 'jobspy-p1.json'), []);
  put(path.join(art, 'search-adzuna-p1', 'out', 'adzuna-p1.json'), 'null');
  put(path.join(art, 'search-adzuna-p1', 'out', 'adzuna-p1.meta.json'), {rival: 'adzuna', kept: null, notServed: true, errors: []});
  put(path.join(art, 'search-eures-p1', 'out', 'eures-p1.json'), 'null');
  put(path.join(art, 'search-eures-p1', 'out', 'eures-p1.meta.json'), {rival: 'eures', kept: null, notServed: false, errors: ['http 500']});
  put(path.join(art, 'search-jooble-p1', 'out', 'jooble-p1.json'), []);
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
  assert.match(ours, /JOBADABRA_DISABLE="\$off"/);
});

// The extra Trello profiles' target (13 Nov 2026, sa for the owner): Jooble and JobSpy per profile, averaged half up; a failed, unserved or half-judged rival is "not measured", never 0.
test('targets: right jobs per rival, the average rounded half up, and no rival ever reads 0 when it was not measured', async () => {
  const {summarize, markdown} = await import('../search-bench/targets.mjs');
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'targets-')), personas = [{id: 'c01', title: 'Accountant', city: 'Amsterdam', country: 'Netherlands'}, {id: 'c02', title: 'Nurse', city: 'Lyon', country: 'France'}, {id: 'c03', title: 'Welder', city: 'Tallinn', country: 'Estonia'}];
  const row = (tool, title, role, place, company = 'Co') => ({tool, title, company, location: 'x', role, place});
  fs.writeFileSync(path.join(work, 'judged1.json'), JSON.stringify({rows: [row('jooble', 'A', 'yes', 'yes'), row('jooble', 'a', 'yes', 'yes'), row('jooble', 'B', 'yes', 'no'), row('jooble', 'C', 'no', 'yes'), ...[...'DEFGH'].map(t => row('jooble', t, 'yes', 'yes')), ...[...'ABCDE'].map(t => row('jobspy', t, 'yes', 'yes'))]}));
  fs.writeFileSync(path.join(work, 'judged2.json'), JSON.stringify({rows: [row('jobspy', 'A', 'yes', 'yes'), row('jooble', 'B', 'missing', 'missing')]}));
  fs.writeFileSync(path.join(work, 'judged3.json'), JSON.stringify({rows: [row('jobspy', 'A', 'yes', 'yes'), row('jobspy', 'B', 'yes', 'yes')]}));
  fs.writeFileSync(path.join(work, 'missing.json'), JSON.stringify(['jobspy p2'])); fs.writeFileSync(path.join(work, 'notserved.json'), JSON.stringify(['jooble p3']));
  const [one, two, three] = summarize(work, personas, [1, 2, 3]);
  assert.deepEqual([one.jooble.right, one.jobspy.right, one.average], [6, 5, 6], 'a duplicate title + employer counts once; role no or place no does not count; (6+5)/2 = 5.5 rounds up');
  assert.equal(two.jooble.state, 'not measured (not fully judged)'); assert.equal(two.jobspy.state, 'not measured (the read failed)'); assert.equal(two.average, null);
  assert.equal(three.jooble.state, 'not served'); assert.equal(three.jobspy.right, 2); assert.equal(three.average, null, 'one rival alone gives no average');
  assert.doesNotMatch(markdown([two, three]).split('\n').slice(2).join('\n'), /\| 0 /, 'a rival that was not measured never shows 0');
});

test('layOut with numbers and no ours lays out only those personas and names no ours job missing', () => {
  const art = fs.mkdtempSync(path.join(os.tmpdir(), 'art-')), work = fs.mkdtempSync(path.join(os.tmpdir(), 'work-'));
  fs.mkdirSync(path.join(art, 'search-jooble-p9'), {recursive: true}); fs.writeFileSync(path.join(art, 'search-jooble-p9', 'jooble-p9.json'), JSON.stringify([{tool: 'jooble', title: 'T', company: 'C', location: 'L'}]));
  const {missing} = layOut(art, work, {numbers: [9], rivals: ['jooble', 'jobspy'], ours: false});
  assert.deepEqual(missing, ['jobspy p9']); assert.ok(fs.existsSync(path.join(work, 'pool9.json'))); assert.ok(!fs.existsSync(path.join(work, 'pool1.json')));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(work, 'pool9.json'), 'utf8')).map(r => r.tool), ['jooble']);
});

test('errorsMakeEmptyMissing: an empty list with named errors is a failed read, a clean empty list stays a found 0', () => {
  const art = fs.mkdtempSync(path.join(os.tmpdir(), 'art-')), work = fs.mkdtempSync(path.join(os.tmpdir(), 'work-'));
  put(path.join(art, 'search-jobspy-p9', 'jobspy-p9.json'), []); put(path.join(art, 'search-jobspy-p9', 'jobspy-p9.meta.json'), {kept: 0, errors: {linkedin: 'ValueError: Invalid country_indeed'}});
  put(path.join(art, 'search-jobspy-p13', 'jobspy-p13.json'), []); put(path.join(art, 'search-jobspy-p13', 'jobspy-p13.meta.json'), {kept: 0, errors: {}});
  assert.deepEqual(layOut(art, work, {numbers: [9, 13], rivals: ['jobspy'], ours: false, errorsMakeEmptyMissing: true}).missing, ['jobspy p9']);
  assert.deepEqual(layOut(art, work, {numbers: [9], rivals: ['jobspy'], ours: false}).missing, [], 'the round keeps its old reading');
});

// Why (13 Nov 2026, run 43480344860): a targets run of one profile whose Jooble job gave no artifact downloaded ONE artifact, and download-artifact then lays its files flat (no subfolder); the 50 JobSpy rows read as "missing".
test('layOut finds a rival file laid flat when the pattern matched one artifact only', () => {
  const art = fs.mkdtempSync(path.join(os.tmpdir(), 'art-')), work = fs.mkdtempSync(path.join(os.tmpdir(), 'work-'));
  fs.writeFileSync(path.join(art, 'jobspy-p24.json'), JSON.stringify([{tool: 'jobspy', title: 'T', company: 'C', location: 'L'}])); fs.writeFileSync(path.join(art, 'jobspy-p24.meta.json'), JSON.stringify({notServed: false, errors: {}}));
  const {missing} = layOut(art, work, {numbers: [24], rivals: ['jobspy'], ours: false});
  assert.deepEqual(missing, []); assert.deepEqual(JSON.parse(fs.readFileSync(path.join(work, 'pool24.json'), 'utf8')).map(r => r.tool), ['jobspy']);
});
