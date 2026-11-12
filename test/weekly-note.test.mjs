// lib/weekly-note.mjs: the weekly Telegram message (Telegram HTML, Engineering bot, 12 Nov 2026) says our score against the baseline and the previous run,
// an up/down per form, and never an answer or a fact (only scores, counts, form ids). When ours has no score it says so and why.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import {noteOf, noteText, readFailures} from '../lib/weekly-note.mjs';
const row = (form, tool, right, wrong, emptyAnswerable = 0) => ({form, tool, run: '1', right, wrong, emptyAnswerable, notReached: 0, unanswerable: 0});
const baseline = {tools: {extension: 97, 'browser-use': 87.3}, forms: {101: {score: 100, wrong: 0}, 102: {score: 100, wrong: 0}}, label: 'by-hand round'};

test('per form score and wrong, up/down against the baseline and the previous run', () => {
  const note = noteOf({tools: {extension: {score: 90}}, rows: [row('101', 'extension', 9, 1), row('102', 'extension', 10, 0), row('101', 'browser-use', 5, 5)]}, {round: 'fixed', build: 'abc1234', at: '2026-11-12T15:00:00Z'});
  assert.deepEqual(note.forms, {101: {score: 90, wrong: 1}, 102: {score: 100, wrong: 0}});
  const text = noteText(note, baseline, {tools: {extension: 85}, forms: {}}, 'https://x/run');
  assert.match(text, /^🟡 <b>Ours 90%<\/b> · fixed set \(our regression check\)$/m, 'a bold verdict line first: chip + number');
  assert.match(text, /▼7 vs baseline 97% · ▲5 vs the previous run 85%/);
  assert.match(text, /build abc1234 · 2026-11-12/);
  assert.match(text, /<a href="https:\/\/x\/run">Run ↗<\/a>$/, 'the run as a short link, last');
  const pre = text.match(/<pre>([\s\S]*?)<\/pre>/)[1].split('\n');
  assert.equal(pre.length, 2); assert.match(pre[0], /^101 +90% +▼10 +wrong 1 \(\+1\)$/); assert.match(pre[1], /^102 +100% +=/);
  assert.equal(pre[0].indexOf('%'), pre[1].indexOf('%'), 'columns line up');
  assert.doesNotMatch(text, /Ada|example\.test|Zurich/);
});
test('a new set: every tool on one line, no baseline, no previous', () => {
  const note = noteOf({tools: {extension: {score: 80}, 'browser-use': {score: 75}}, rows: [row('264501', 'extension', 8, 2)]}, {round: 'week-2026-W45'});
  const text = noteText(note, null, null);
  assert.match(text, /new set, week 2026-W45/); assert.match(text, /^🟢 <b>Ours 80%<\/b>/m); assert.match(text, /Browser Use 75%/);
});
test('values are HTML-escaped (a label or url with < & " never breaks the message)', () => {
  const note = noteOf({tools: {extension: {score: 80}}, rows: []}, {round: 'fixed', build: '<b>x'});
  const text = noteText(note, null, null, 'https://x/?a=1&b="2"');
  assert.match(text, /build &lt;b&gt;x/); assert.match(text, /href="https:\/\/x\/\?a=1&amp;b=&quot;2&quot;"/);
});

// The 12 Nov 2026 note ("Ours –% (= vs baseline 97%) (= vs the previous run undefined%)"): ours had no score, and a missing number printed as "–", "=" and "undefined".
test('ours has no score: the note says so, why, and never prints –, = or undefined', () => {
  const note = noteOf({tools: {'browser-use': {score: 87.3}, stagehand: {score: 44}}, rows: []}, {round: 'fixed', ourFailure: 'live row on CI: no GitHub OIDC token for the AI broker'});
  assert.equal(note.tools.extension, undefined); assert.equal(note.noScore, 'live row on CI: no GitHub OIDC token for the AI broker');
  const text = noteText(note, baseline, {tools: {'browser-use': 80}, forms: {}}, 'https://x/run');
  assert.match(text, /^🔴 <b>Our runs gave no score<\/b> · fixed set/m);
  assert.match(text, /Why: live row on CI: no GitHub OIDC token for the AI broker/);
  assert.match(text, /baseline 97% · the previous run: no score/);
  assert.match(text, /Browser Use 87\.3%/);
  assert.doesNotMatch(text, /undefined|–%|null|NaN| = vs/);
});
test('ours has a score but the previous note had none: "no score" instead of undefined', () => {
  const note = noteOf({tools: {extension: {score: 96}}, rows: []}, {round: 'fixed'});
  const text = noteText(note, baseline, {tools: {'browser-use': 80}, forms: {}});
  assert.match(text, /▼1 vs baseline 97% · the previous run had no score/); assert.doesNotMatch(text, /undefined/);
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
