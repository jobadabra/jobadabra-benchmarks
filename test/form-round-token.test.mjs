// Why (12 Nov 2026, owner via the coordinator, jobadabra-benchmarks #20): the AI broker answers any run token of this repo on the owner's Claude plan, so the OIDC token
// (`id-token: write`) may be held only by the job that runs OUR tool; a job that runs a rival's third-party code (Browser Use, Stagehand, Nanobrowser) never holds it,
// and the round gives ours no API key and the rivals no broker. The class: every job of every workflow here, not one name.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
const dir = path.join(import.meta.dirname, '..', '.github', 'workflows');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
/** The jobs of a workflow text: {name: its block}. */
const jobsOf = text => { const out = {}, from = text.indexOf('\njobs:\n'); const lines = text.slice(from + 7).split('\n'); let name = null; for (const line of lines) { const m = line.match(/^  ([\w-]+):/); if (m) { name = m[1]; out[name] = ''; } if (name) out[name] += line + '\n'; } return out; };
const holdsToken = block => /^\s+id-token: write/m.test(block);

test('only the job that runs ours holds id-token: write; no job that runs a rival does', () => {
  for (const file of fs.readdirSync(dir).filter(f => /\.ya?ml$/.test(f))) {
    const text = read(file);
    if (/^permissions:[\s\S]*?\n {2}id-token: write/m.test(text.split('\njobs:')[0])) assert.fail(`${file}: a workflow-wide id-token: write reaches every job`);
    for (const [name, block] of Object.entries(jobsOf(text))) if (holdsToken(block)) assert.ok(file === 'form-round.yml' && name === 'run-ours', `${file}: job ${name} holds id-token: write (only form-round.yml's run-ours may)`);
  }
  const jobs = jobsOf(read('form-round.yml'));
  assert.ok(holdsToken(jobs['run-ours']), 'ours has the token the broker asks for');
  assert.match(jobs['run-ours'], /tool: \$\{\{ fromJSON\(needs\.build\.outputs\.ours\) \}\}/, 'run-ours runs the tools of the ours list only');
  assert.match(jobs['run-rivals'], /tool: \$\{\{ fromJSON\(needs\.build\.outputs\.rivals\) \}\}/);
  assert.doesNotMatch(jobs['run-ours'], /secrets\.BENCH_ANTHROPIC_KEY/, 'ours needs no API key: its AI goes through the broker');
  assert.match(jobs['run-rivals'], /secrets:\n\s+BENCH_ANTHROPIC_KEY:/, 'the rivals keep the Benchmarks key');
});
test('the two lists are split on the tool name extension, and the called workflow sets no permissions of its own', () => {
  const build = jobsOf(read('form-round.yml')).build;
  assert.match(build, /ours=\$\(jq -c '\[\.\[\] \| select\(\. == "extension"\)\]'/); assert.match(build, /rivals=\$\(jq -c '\[\.\[\] \| select\(\. != "extension"\)\]'/);
  const callee = read('form-round-job.yml');
  assert.doesNotMatch(callee, /^\s+permissions:/m, 'a called job inherits the caller\'s permissions; it must not widen them'); assert.doesNotMatch(callee, /^\s*id-token:/m);
  assert.match(jobsOf(read('form-round.yml'))['run-rivals'], /permissions:\n\s+contents: read[^\n]*\n\s+uses:/, 'the rivals job: contents: read only');
});
test('the form round gives ours no Anthropic key variable (the app has no API-key path on CI since jobadabra #3177)', () => {
  assert.doesNotMatch(read('form-round.yml') + read('form-round-job.yml'), /E2E_ANTHROPIC_KEY/);
});
