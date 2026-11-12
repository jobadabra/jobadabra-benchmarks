// tools/archive.sh keeps each round's judged lists under the tag bench-archive, one folder per round key, never overwritten (owner, 12 Nov 2026: "Or the results are being lost").
// Real git against a local bare "origin"; no network.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
const root = path.join(import.meta.dirname, '..');
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {cwd, encoding: 'utf8'}).trim();

function clone() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-test-')), origin = path.join(base, 'origin.git'), work = path.join(base, 'work');
  git(base, 'init', '-q', '--bare', origin);
  git(base, 'clone', '-q', origin, work);
  fs.mkdirSync(path.join(work, 'tools'));
  for (const f of ['archive.sh', 'state-tag.sh']) fs.copyFileSync(path.join(root, 'tools', f), path.join(work, 'tools', f));
  fs.writeFileSync(path.join(work, 'README'), 'x'); git(work, 'add', '-A'); git(work, 'commit', '-q', '-m', 'init'); git(work, 'push', '-q', 'origin', 'HEAD:refs/heads/main');
  return {work, origin, base};
}
const seed = ({work}) => { git(work, 'checkout', '-q', '--orphan', 'seed'); git(work, 'rm', '-rfq', '.'); fs.writeFileSync(path.join(work, 'README.md'), 'archive'); git(work, 'add', 'README.md'); git(work, 'commit', '-q', '-m', 'seed'); git(work, 'push', '-q', 'origin', 'HEAD:refs/tags/bench-archive'); git(work, 'checkout', '-q', '-f', 'main'); };
const run = ({work}, ...args) => spawnSync('bash', ['tools/archive.sh', ...args], {cwd: work, encoding: 'utf8'});
const folder = (files) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-src-')); for (const [name, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(d, name)), {recursive: true}); fs.writeFileSync(path.join(d, name), text); } return d; };
const inTag = ({origin, base}) => { const c = path.join(base, 'check-' + Math.random().toString(36).slice(2)); git(base, 'clone', '-q', origin, c); git(c, 'fetch', '-q', 'origin', '+refs/tags/bench-archive:refs/tags/bench-archive'); return git(c, 'ls-tree', '-r', '--name-only', 'bench-archive').split('\n'); };

test('two rounds the same day keep their own folders; neither overwrites the other', () => {
  const r = clone(); seed(r);
  for (const key of ['2026-11-12-r00057', '2026-11-12-r00058']) {
    const out = run(r, 'search', key, folder({'persona-1.json': `{"round":"${key}"}`, 'manifest.json': '{}'}));
    assert.equal(out.status, 0, out.stderr + out.stdout);
  }
  const files = inTag(r);
  for (const key of ['2026-11-12-r00057', '2026-11-12-r00058']) assert.ok(files.includes(`search/${key}/persona-1.json`), key);
});

test('the same key again keeps what the first run archived and adds only new files', () => {
  const r = clone(); seed(r);
  run(r, 'form', '99', folder({'score.json': 'first'}));
  const again = run(r, 'form', '99', folder({'score.json': 'second', 'extra.json': 'new'}));
  assert.equal(again.status, 0, again.stderr);
  const c = path.join(r.base, 'read'); git(r.base, 'clone', '-q', r.origin, c); git(c, 'fetch', '-q', 'origin', '+refs/tags/bench-archive:refs/tags/bench-archive');
  assert.equal(git(c, 'show', 'bench-archive:form/99/score.json'), 'first', 'an archived file is never replaced');
  assert.equal(git(c, 'show', 'bench-archive:form/99/extra.json'), 'new');
});

test('refuses a bad kind, a key that is a path, an empty folder, and a missing tag (a run never creates the tag)', () => {
  const r = clone();
  assert.equal(run(r, 'other', 'k', folder({a: '1'})).status, 2);
  assert.equal(run(r, 'search', '../x', folder({a: '1'})).status, 2);
  assert.equal(run(r, 'search', 'k', fs.mkdtempSync(path.join(os.tmpdir(), 'archive-empty-'))).status, 2);
  const noTag = run(r, 'search', 'k', folder({a: '1'}));
  assert.notEqual(noTag.status, 0, 'no bench-archive tag: it fails loudly instead of creating one');
});
