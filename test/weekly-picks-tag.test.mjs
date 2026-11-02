// The weekly-picks state is a TAG, written through tools/state-tag.sh (owner, 2 Nov 2026: "let's use tags not branches for storing things. Otherwise, they keep popping up like that":
// a pushed branch made GitHub offer "Compare & pull request"). Three workflows write it (two of them can run at once), so a write is a compare-and-swap, never a plain push.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';

const dir = path.join(import.meta.dirname, '..', '.github', 'workflows');
const code = name => fs.readFileSync(path.join(dir, name), 'utf8').replace(/^\s*#.*$/gm, '').replace(/\s+#\s.*$/gm, '');   // comments carry the Why, not behaviour
const WRITERS = {'form-round.yml': 'Note \\$ROUND \\$name', 'form-weekly.yml': 'Weekly new set \\$WEEK', 'search-round.yml': 'Search note \\$day'};

test('no workflow keeps state on a branch: no push of its own, no refs/heads, no orphan branch', () => {
  for (const name of ['form-round.yml', 'form-weekly.yml', 'search-round.yml']) {
    const text = code(name);
    assert.ok(!/git push/.test(text), `${name}: a push is state-tag.sh's job (lease on the tag)`);
    assert.ok(!/refs\/heads|HEAD:weekly-picks|--orphan|git pull/.test(text), `${name}: the state is never a branch`);
    assert.ok(!/git fetch[^\n]*origin weekly-picks\b(?!:)/.test(text), `${name}: weekly-picks is fetched as a tag`);
  }
});

test('each of the three writers reads and writes the tag weekly-picks through the script', () => {
  for (const [name, message] of Object.entries(WRITERS)) {
    const text = code(name);
    assert.match(text, /tools\/state-tag\.sh read weekly-picks picks/, `${name} reads the tag`);
    assert.match(text, new RegExp(`tools/state-tag\\.sh write weekly-picks picks "${message}`), `${name} writes it with a compare-and-swap`);
    assert.ok(!/state-tag[^\n]*\|\|\s*true/.test(text), `${name}: a failed write fails the job`);
  }
});

test('the forms file of a weekly draw is read from the tag (forms_from is tag:path)', () => {
  const text = code('form-round.yml');
  assert.equal((text.match(/git fetch -q --depth 1 origin "\+refs\/tags\/\$tag:refs\/tags\/\$tag"/g) || []).length, 2, 'both readers fetch the tag');
  assert.equal((text.match(/git show "refs\/tags\/\$tag:\$\{FROM#\*:\}"/g) || []).length, 2, 'both readers show the file from the tag');
  assert.ok(!/FETCH_HEAD:\$\{FROM#\*:\}/.test(text), 'no branch fetch of the forms file');
  assert.match(code('form-weekly.yml'), /forms_from="weekly-picks:weekly\/\$WEEK\.json"/, 'the draw hands over tag:path');
});
