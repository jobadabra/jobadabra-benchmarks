// tools/excluded.sh: every web address in the product repo's tracked files, this repo's form lists and saved runs, and any extra dir
// (the weekly-picks tag) is on the list, lowercased, host + first path part; an untracked product file is not read.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {execFileSync} from 'node:child_process';
const SCRIPT = new URL('../tools/excluded.sh', import.meta.url).pathname;
test('product repo, form lists, saved runs and extra dirs all exclude their companies', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'excluded-')), jp = path.join(root, 'jp'), here = path.join(root, 'here'), weekly = path.join(root, 'weekly');
  for (const d of [jp, path.join(here, 'results'), weekly]) fs.mkdirSync(d, {recursive: true});
  fs.writeFileSync(path.join(jp, 'case.mjs'), "const u = 'https://Jobs.Ashbyhq.com/AcmeCo/123/application';\n");
  fs.writeFileSync(path.join(jp, 'untracked.txt'), 'https://jobs.lever.co/notours\n');
  execFileSync('git', ['init', '-q'], {cwd: jp}); execFileSync('git', ['add', 'case.mjs'], {cwd: jp});
  fs.writeFileSync(path.join(here, 'forms-objective.json'), '[{"url":"https://job-boards.greenhouse.io/fixedco/jobs/1"}]');
  fs.writeFileSync(path.join(here, 'results', 'run.json'), '{"url":"https://apply.workable.com/runco/j/AB/apply/"}');
  fs.writeFileSync(path.join(weekly, '2026-W45.json'), '{"url":"https://jobs.eu.lever.co/weekco/x"}');
  const out = execFileSync('bash', [SCRIPT, jp, here, weekly], {encoding: 'utf8'}).trim().split('\n');
  assert.deepEqual(out, ['apply.workable.com/runco', 'job-boards.greenhouse.io/fixedco', 'jobs.ashbyhq.com/acmeco', 'jobs.eu.lever.co/weekco']);
});
