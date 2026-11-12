// search-bench/note.mjs: the search round's Telegram message (owner, 27 Oct 2026): relevant jobs per tool and ours per persona, against the
// previous run and the baseline; a failed job is said, not shown as 0; only counts and persona labels, never a job.
import test from 'node:test'; import assert from 'node:assert/strict';
import {noteOf, noteText} from '../search-bench/note.mjs';
const job = (tool, role, place, title = 'Job') => ({tool, title, company: 'Co', location: 'Town', role, place});

test('ours against the previous run and the baseline, rivals ranked, a line per persona, missing jobs named', () => {
  const labels = {1: 'Nurse · Townville', 2: 'Coder · Cityburg'};
  const note = noteOf({1: [job('ours', 'yes', 'yes'), job('ours', 'yes', 'no'), job('jobspy', 'yes', 'yes')], 2: [job('eures', 'yes', 'yes'), job('eures', 'yes', 'yes')]}, {round: '2026-10-30', build: 'abc1234', labels});
  assert.deepEqual(note.tools, {ours: {relevant: 1, found: 2}, jobspy: {relevant: 1, found: 1}, eures: {relevant: 2, found: 2}});
  assert.deepEqual(note.personas, {1: {label: 'Nurse · Townville', relevant: 1, found: 2}, 2: {label: 'Coder · Cityburg', relevant: 0, found: 0}});
  const last = {rivalsOff: true, tools: {ours: {relevant: 3}, eures: {relevant: 2}}, personas: {1: {relevant: 3}}}, baseline = {tools: {ours: {relevant: 1}}, personas: {}};
  const text = noteText(note, baseline, last, {missing: ['ours p2'], notServed: ['adzuna p1', 'adzuna p2'], url: 'https://x/run'});
  assert.match(text, /^🔴 <b>Ours 1 relevant of 2 shown<\/b> · search round$/m, 'verdict first: a failed job makes it red');
  assert.match(text, /^round 2026-10-30 · build abc1234$/m);
  assert.match(text, /^▼2 vs the previous run 3 <i>\(rivals' sources off\)<\/i>$/m);
  assert.match(text, /^EURES 2 = · JobSpy 1$/m);
  assert.match(text, /^Searches with none: 1 of 2$/m);
  const pre = text.match(/<pre>([\s\S]*?)<\/pre>/)[1].split('\n');
  assert.match(pre[0], /^ *1\/2 +▼2 +Nurse · Townville$/); assert.match(pre[1], /^ *0\/0 +Coder · Cityburg$/);
  assert.match(text, /^⚠ <b>Missing<\/b> \(a job failed, not a 0\): ours p2$/m);
  assert.match(text, /^<i>ℹ Not served \(the rival has no data for that place; not a failure, not a 0\): adzuna p1, adzuna p2<\/i>$/m, 'Gitar on #14: not-served rivals are named apart from failed jobs');
  assert.match(text, /<a href="https:\/\/x\/run">Run ↗<\/a>$/);
  assert.doesNotMatch(text, /\bJob\b|Co\b|https:\/\/y/, 'no job title or employer');
});

test('the chip: green when level or up, yellow when down against the previous run, red when ours found nothing', () => {
  const ref = n => ({rivalsOff: true, tools: {ours: {relevant: n}}, personas: {}});
  const text = (jobs, last) => noteText(noteOf({1: jobs}, {round: 'r'}), null, last);
  assert.match(text([job('ours', 'yes', 'yes')], ref(1)), /^🟢 /);
  assert.match(text([job('ours', 'yes', 'yes')], ref(2)), /^🟡 /);
  assert.match(text([job('ours', 'no', 'yes')], ref(0)), /^🔴 /);
});

test('values are HTML-escaped', () => {
  const note = noteOf({1: [job('ours', 'yes', 'yes')]}, {round: 'r', labels: {1: 'R&D <Lead> · Town'}});
  assert.match(noteText(note, null, null, {missing: ['a<b']}), /R&amp;D &lt;Lead&gt; · Town[\s\S]*a&lt;b/);
});

test('the first run has no previous note: its baseline had every source on, so ours is not diffed against it', () => {
  const note = noteOf({1: [job('ours', 'yes', 'yes')]}, {round: 'r'});
  const text = noteText(note, {tools: {ours: {relevant: 0}}, personas: {1: {relevant: 0}}}, null);
  assert.match(text, /^<i>no earlier run with the rivals' sources off yet<\/i>$/m);
  assert.match(text, /1\/1 +Persona 1<\/pre>/, 'the old baseline had every source on: no arrow for a rivals-off count');
});
