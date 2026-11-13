// search-bench/tools.mjs: every tool in a round's judged rows is published, ours first, rivals by name; an unknown tool keeps its own name.
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import {execFileSync} from 'node:child_process';
import {NAME, toolsOf} from '../search-bench/tools.mjs';
test('ours first, then the rivals present, in a fixed order; unknown tools last', () => {
  const rows = ['career-ops-docs', 'eures', 'jobspy', 'new-tool', 'adzuna', 'career-ops'].map(tool => ({tool}));
  assert.deepEqual(toolsOf(rows), ['ours', 'jobspy', 'eures', 'adzuna', 'career-ops', 'career-ops-docs', 'new-tool']);
  assert.deepEqual(toolsOf([]), ['ours']);   // ours always gets its row, even with nothing found
  assert.equal(NAME['career-ops-docs'], 'career-ops (set up per its docs)');
});


test('publisher keeps a rival failed for every persona as null, never a win or a zero-result run', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'search-publish-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  // Run a disposable copy: --dry still saves judged lists beside the script.
  const scripts = path.join(root, 'search-bench'), work = path.join(root, 'work');
  fs.mkdirSync(scripts); fs.mkdirSync(work);
  for (const file of ['publish.mjs', 'tools.mjs']) fs.copyFileSync(new URL(`../search-bench/${file}`, import.meta.url), path.join(scripts, file));
  fs.writeFileSync(path.join(scripts, 'personas.json'), JSON.stringify({personas: [
    {title: 'Cook', city: 'Town', kind: 'non-tech', country: 'Land'},
    {title: 'Nurse', city: 'City', kind: 'non-tech', country: 'Land'},
  ]}));
  for (const n of [1, 2]) fs.writeFileSync(path.join(work, `judged${n}.json`), JSON.stringify({rows: [
    {tool: 'ours-all', title: 'Job', company: 'A', location: 'Town', role: 'yes', place: 'yes'},
    ...(n === 1 ? [{tool: 'eures', title: 'Different', company: 'B', location: 'Town', role: 'yes', place: 'yes'}] : []),
  ]}));
  fs.writeFileSync(path.join(work, 'missing.json'), JSON.stringify(['jobspy p1', 'jobspy p2']));
  const output = execFileSync(process.execPath, [path.join(scripts, 'publish.mjs'), work, '--round', 'fixture', '--dry'], {encoding: 'utf8'});
  const rows = JSON.parse(output.slice(0, output.lastIndexOf(']') + 1));
  const all = rows.filter(row => row.tool === NAME['ours-all']);
  assert.equal(all.length, 2);
  for (const row of all) assert.equal(row.beyond.JobSpy, null, 'no judged rows anywhere: missing.json must preserve the rival');
  assert.deepEqual(all.map(row => row.beyond.EURES), [1, 1], 'a successful empty search remains a measured lead');
  assert.ok(!rows.some(row => row.tool === NAME.jobspy), 'a failed search never becomes a found-zero score row');
});

test('our published rows carry the AI the round ran on (app or haiku), the rivals carry none', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'search-publish-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const scripts = path.join(root, 'search-bench');
  fs.mkdirSync(scripts);
  for (const file of ['publish.mjs', 'tools.mjs']) fs.copyFileSync(new URL(`../search-bench/${file}`, import.meta.url), path.join(scripts, file));
  fs.writeFileSync(path.join(scripts, 'personas.json'), JSON.stringify({personas: [{title: 'Cook', city: 'Town', kind: 'non-tech', country: 'Land'}]}));
  const run = tiers => {
    const work = path.join(root, `work-${tiers || 'none'}`); fs.mkdirSync(work);
    fs.writeFileSync(path.join(work, 'judged1.json'), JSON.stringify({rows: [
      {tool: 'ours', title: 'Job', company: 'A', location: 'Town', role: 'yes', place: 'yes'},
      {tool: 'eures', title: 'Other', company: 'B', location: 'Town', role: 'yes', place: 'yes'},
    ]}));
    if (tiers !== null) fs.writeFileSync(path.join(work, 'tiers.txt'), tiers);
    const output = execFileSync(process.execPath, [path.join(scripts, 'publish.mjs'), work, '--round', 'fixture', '--dry'], {encoding: 'utf8'});
    return JSON.parse(output.slice(0, output.lastIndexOf(']') + 1));
  };
  const app = run('app'), old = run('haiku'), none = run(null);
  assert.equal(app.find(row => row.ours).ai, 'app');
  assert.ok(app.filter(row => !row.ours).every(row => !('ai' in row)), 'a rival has no AI');
  assert.equal(old.find(row => row.ours).ai, 'haiku');
  assert.equal(none.find(row => row.ours).ai, 'haiku', 'a round without tiers.txt reads as haiku');
});
