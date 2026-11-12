import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
import {allFailed} from '../lib/round-health.mjs';
test('a job whose every tried form errored is failed; one scored form, or nothing tried, is not', () => {
  const err = {error: 'live row on CI: no GitHub OIDC token for the AI broker'};
  assert.equal(allFailed([err, err, err]), true);
  assert.equal(allFailed([err, {error: ''}, err]), false, 'one form worked: the job did its work');
  assert.equal(allFailed([err, {notRun: 'cap'}]), true, 'a form skipped by the cap is not tried');
  assert.equal(allFailed([{notRun: 'cap'}]), false); assert.equal(allFailed([]), false);
});
test('round-job.mjs ends red through it, and the form round gives the run job the OIDC token without any API key for ours (12 Nov 2026)', () => {
  assert.match(fs.readFileSync(path.join(import.meta.dirname, '..', 'round-job.mjs'), 'utf8'), /if \(allFailed\(rows\)\)[^\n]*process\.exitCode = 1/);
  const wf = fs.readFileSync(path.join(import.meta.dirname, '..', '.github/workflows/form-round.yml'), 'utf8'), run = wf.slice(wf.indexOf('\n  run:'), wf.indexOf('\n  publish:'));
  assert.match(run, /permissions:\n {6}contents: read\n {6}id-token: write/);
  assert.doesNotMatch(wf, /E2E_ANTHROPIC_KEY/, 'the app has no API-key path on CI since jobadabra #3177');
});
