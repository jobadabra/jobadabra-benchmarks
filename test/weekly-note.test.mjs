// lib/weekly-note.mjs: the weekly Telegram message (Telegram HTML, Engineering bot; the at-a-glance shape the owner chose on 12 Nov 2026, "Yes, this shape"): a verdict against the baseline,
// every tool's score on one line, which forms are perfect / what is missing / which is new, what changed in the set; never an answer or a fact. When ours has no score it says so and why.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {noteOf, noteText, readFailures, rivalsSince} from '../lib/weekly-note.mjs'; import {setChanges} from '../lib/forms.mjs';
const row = (form, tool, right, wrong, emptyAnswerable = 0) => ({form, tool, run: '1', right, wrong, emptyAnswerable, notReached: 0, unanswerable: 0});
const baseline = {tools: {extension: 97, 'browser-use': 87.3}, forms: {101: {score: 100, wrong: 0}, 102: {score: 100, wrong: 0}}, label: 'by-hand round'};

test('the owner\'s shape: verdict vs baseline, all four scores, perfect / missing / new forms, what changed, the run link', () => {
  const rows = [row('101', 'extension', 10, 0), row('102', 'extension', 10, 0), row('103', 'extension', 7, 0, 1), row('104', 'extension', 10, 0), row('105', 'extension', 10, 0), row('107', 'extension', 9, 1)];
  const tools = {extension: {score: 96.8}, 'browser-use': {score: 85.7}, nanobrowser: {score: 45.6}, stagehand: {score: 43.2}};
  const note = noteOf({tools, rows}, {round: 'fixed', at: '2026-11-12T18:25:00Z', setChanges: setChanges({picks: [{id: '106', retired: '2026-11-12'}, {id: '107', replaces: '106', addedAt: '2026-11-12'}]}), rivalsSince: '2026-10-27'});
  assert.deepEqual(note.forms['103'], {score: 87.5, wrong: 0, empty: 1});
  const text = noteText(note, {tools: {extension: 97, 'browser-use': 87.3}, label: 'by-hand round'}, {tools: {extension: 96.8}}, 'https://x/run');
  assert.deepEqual(text.split('\n'), [
    '🟢 <b>Form filling: ours 96.8%</b>, same as baseline (97%)',
    '🏁 Ours 96.8 · Browser Use 85.7 · Nanobrowser 45.6 · Stagehand 43.2',
    '✅ 4 forms perfect · ⚠️ 103: 1 field left empty (none wrong) · 🆕 107: 90% (new form)',
    'ℹ️ Rivals not re-run since 27 Oct; form 106 replaced by 107 today',
    '<a href="https://x/run">Run ↗</a> · <a href="https://www.jobadabra.top/admin/form-filling/benchmark?round=fixed">Review in Admin ↗</a>']);   // owner, 12 Nov 2026: read the round in Admin first, publish it from there
  assert.doesNotMatch(text, /Ada|example\.test|Zurich|undefined|NaN/);
});
test('a drop: yellow, the size against the baseline and, when it moved more than the 2-point noise, against the previous run; wrong answers are counted', () => {
  const note = noteOf({tools: {extension: {score: 90}}, rows: [row('101', 'extension', 8, 2)]}, {round: 'fixed'});
  const lines = noteText(note, {tools: {extension: 97}}, {tools: {extension: 85}}, 'https://x/run').split('\n');
  assert.equal(lines[0], '🟡 <b>Form filling: ours 90%</b>, ▼7 vs baseline (97%) · ▲5 vs the previous run (85%)');
  assert.equal(lines[2], '⚠️ 101: 2 wrong');
});
test('a new set: every tool on one line, no baseline, "last week" only when it moved', () => {
  const note = noteOf({tools: {extension: {score: 80}, 'browser-use': {score: 75}}, rows: [row('264501', 'extension', 8, 2)]}, {round: 'week-2026-W45'});
  const text = noteText(note, null, null);
  assert.match(text, /^🟢 <b>New forms, week 2026-W45: ours 80%<\/b>$/m); assert.match(text, /^🏁 Ours 80 · Browser Use 75$/m);
  assert.match(noteText(note, null, {tools: {extension: 70}}), /ours 80%<\/b>, ▲10 vs last week \(70%\)$/m);
});
test('values are HTML-escaped (a form id or url with < & " never breaks the message)', () => {
  const note = noteOf({tools: {extension: {score: 80}}, rows: [row('<b>x', 'extension', 8, 2)]}, {round: 'fixed'});
  const text = noteText(note, null, null, 'https://x/?a=1&b="2"');
  assert.match(text, /⚠️ &lt;b&gt;x: 2 wrong/); assert.match(text, /href="https:\/\/x\/\?a=1&amp;b=&quot;2&quot;"/);
});

// The 12 Nov 2026 note ("Ours –% (= vs baseline 97%) (= vs the previous run undefined%)"): ours had no score, and a missing number printed as "–", "=" and "undefined".
test('ours has no score: the note says so and why, rivals still shown, never –, = or undefined', () => {
  const note = noteOf({tools: {'browser-use': {score: 87.3}, stagehand: {score: 44}}, rows: []}, {round: 'fixed', ourFailure: 'live row on CI: no GitHub OIDC token for the AI broker'});
  assert.equal(note.tools.extension, undefined); assert.equal(note.noScore, 'live row on CI: no GitHub OIDC token for the AI broker');
  const text = noteText(note, baseline, {tools: {'browser-use': 80}, forms: {}}, 'https://x/run');
  assert.match(text, /^🔴 <b>Form filling: ours has no score<\/b>$/m);
  assert.match(text, /^Why: live row on CI: no GitHub OIDC token for the AI broker$/m);
  assert.match(text, /^🏁 Ours no score · Browser Use 87\.3 · Stagehand 44$/m);
  assert.doesNotMatch(text, /undefined|–%|null|NaN| = vs/);
});
test('readFailures: the reason ours has no scored run, from its result.json, with no url', () => {
  const pool = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-'));
  for (const [form, run, error] of [['103', '1', 'live row on CI: no GitHub OIDC token (see https://example.test/secret?x=1)'], ['104', '1', 'live row on CI: no GitHub OIDC token (see https://example.test/secret?x=1)'], ['104', '2', 'other']]) {
    const dir = path.join(pool, form, 'extension', run); fs.mkdirSync(dir, {recursive: true}); fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify({tool: 'extension', error, crashed: true}));
  }
  const dir = path.join(pool, '105', 'extension', '1'); fs.mkdirSync(dir, {recursive: true}); fs.writeFileSync(path.join(dir, 'result.json'), '{}'); fs.writeFileSync(path.join(dir, 'judged.json'), '[]');   // a scored run is no failure
  const failed = readFailures(pool, 'extension');
  assert.equal(failed.runs, 3); assert.match(failed.reason, /^live row on CI: no GitHub OIDC token/); assert.doesNotMatch(failed.reason, /https?:/);
  assert.deepEqual(readFailures(pool, 'stagehand'), {runs: 0, reason: ''});
});


// Gitar on #21 (12 Nov 2026): ours ran form 107 where the rivals' frozen rows and the baseline are on 106; the note says so instead of presenting the numbers as like for like.
test('a replaced form: the note says so with its day; no such line without a replacement', () => {
  const tools = {extension: {score: 90}, 'browser-use': {score: 85}}, rows = [row('107', 'extension', 9, 1)];
  const changes = setChanges({picks: [{id: '106', retired: '2026-11-12'}, {id: '107', replaces: '106', addedAt: '2026-11-12'}]});
  assert.deepEqual(changes, [{from: '106', to: '107', at: '2026-11-12'}]);
  assert.match(noteText(noteOf({tools, rows}, {round: 'fixed', at: '2026-11-15T00:00:00Z', setChanges: changes}), baseline, null), /^ℹ️ form 106 replaced by 107 on 12 Nov$/m, 'a later round: the day, not "today"');
  assert.doesNotMatch(noteText(noteOf({tools, rows}, {round: 'fixed'}), baseline, null), /replaced by/);
  assert.deepEqual(setChanges([{id: '101'}, {id: '106', retired: 'x'}]), []);
});

test('rivalsSince: the day of the rivals\' newest run when older than today; loose files in the pool (baseline.json) and our own runs are skipped', () => {
  const pool = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-'));
  const manifest = (form, tool, run, startedAt) => { const dir = path.join(pool, form, tool, run); fs.mkdirSync(dir, {recursive: true}); fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({startedAt})); };
  fs.writeFileSync(path.join(pool, 'baseline.json'), '{}');
  manifest('101', 'browser-use', '1', '2026-10-27T02:16:36.786Z'); manifest('102', 'stagehand', '1', '2026-10-26T01:00:00Z'); manifest('101', 'extension', '1', '2026-11-12T18:00:00Z');
  assert.equal(rivalsSince(pool, '2026-11-12'), '2026-10-27');
  assert.equal(rivalsSince(pool, '2026-10-27'), '', 'rivals ran today: nothing to say');
  assert.equal(rivalsSince(path.join(pool, 'nope'), '2026-11-12'), '');
});
