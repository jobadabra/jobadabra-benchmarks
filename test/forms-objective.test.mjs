// The fixed set (forms-objective.json) and the forms a round runs (lib/forms.mjs activeForms).
// Why (12 Nov 2026, owner via the coordinator: "Replace with a live form"): form 106's posting (semios, 0A6915AC27) was taken down, so the page redirected to ?not_found=true and
// ours scored 0% on it for a reason that is no fault of the product. The rivals' frozen rows of 106 (rounds/fixed/106) stay as they are, so the new page gets a NEW id (107):
// the scorer counts a question only some tool "reached" by form id, and ours on a different page under 106 would be marked down for questions the rivals answered on the old one.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
import {activeForms} from '../lib/forms.mjs';
const set = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'forms-objective.json'), 'utf8'));

test('activeForms leaves out a retired form and keeps order; a plain list works too', () => {
  const picks = [{id: 1}, {id: 2, retired: '2026-11-12'}, {id: 3}];
  assert.deepEqual(activeForms({picks}).map(f => f.id), [1, 3]); assert.deepEqual(activeForms(picks).map(f => f.id), [1, 3]);
});
test('the fixed set: 106 is retired with a dated reason, 107 replaces it, the other five are untouched', () => {
  const by = id => set.picks.find(f => f.id === id);
  assert.match(by(106).retired, /^2026-11-12$/); assert.match(by(106).why, /not_found/);
  assert.equal(by(107).replaces, 106); assert.equal(by(107).platform, 'workable'); assert.equal(by(107).company, 'semios');
  assert.notEqual(by(107).url, by(106).url, 'a live posting, not the dead one'); assert.match(by(107).url, /^https:\/\/apply\.workable\.com\/semios\/j\/[0-9A-F]{10}\/apply\/$/);
  assert.deepEqual(activeForms(set).map(f => f.id), [101, 102, 103, 104, 105, 107]);
  assert.equal(new Set(set.picks.map(f => f.id)).size, set.picks.length, 'one id, one form');
  const kept = Object.fromEntries(set.picks.filter(f => f.id < 106).map(f => [f.id, f.url]));
  assert.deepEqual(kept, {101: 'https://job-boards.greenhouse.io/humeai/jobs/4775962008', 102: kept[102], 103: kept[103], 104: kept[104], 105: kept[105]}, 'forms 101-105 are as drawn on 27 Oct');
  assert.ok(fs.existsSync(path.join(import.meta.dirname, '..', 'rounds', 'fixed', '106')), "the rivals' frozen rows of 106 stay");
});
test('round-job.mjs runs only the active forms', () => assert.match(fs.readFileSync(path.join(import.meta.dirname, '..', 'round-job.mjs'), 'utf8'), /activeForms\(file\)\.filter\(f => !only\.length/));
