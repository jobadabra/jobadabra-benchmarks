// search-bench/note.mjs: the search round's Telegram message (owner, 27 Oct 2026): relevant jobs per tool and ours per persona, against the
// previous run and the baseline; a failed job is said, not shown as 0; only counts and persona labels, never a job.
import test from 'node:test'; import assert from 'node:assert/strict';
import {noteOf, noteText} from '../search-bench/note.mjs';
const job = (tool, role, place, title = 'Zzyx Role') => ({tool, title, company: 'Co', location: 'Town', role, place});

test('ours against the previous run and the baseline, rivals ranked, a line per persona, missing jobs named', () => {
  const labels = {1: 'Nurse · Townville', 2: 'Coder · Cityburg'};
  const note = noteOf({1: [job('ours', 'yes', 'yes'), job('ours', 'yes', 'no'), job('jobspy', 'yes', 'yes')], 2: [job('eures', 'yes', 'yes'), job('eures', 'yes', 'yes')]}, {round: '2026-10-30', build: 'abc1234', labels});
  assert.deepEqual(note.tools, {ours: {relevant: 1, found: 2}, jobspy: {relevant: 1, found: 1}, eures: {relevant: 2, found: 2}});
  assert.deepEqual(note.personas, {1: {label: 'Nurse · Townville', relevant: 1, found: 2}, 2: {label: 'Coder · Cityburg', relevant: 0, found: 0}});
  const last = {rivalsOff: true, tools: {ours: {relevant: 3}, eures: {relevant: 2}}, personas: {1: {relevant: 3}}}, baseline = {tools: {ours: {relevant: 1}}, personas: {}};
  const text = noteText(note, baseline, last, {missing: ['ours p2'], notServed: ['adzuna p1', 'adzuna p2'], url: 'https://x/run'});
  assert.match(text, /^🔴 <b>Job search: ours 1 relevant of 2 shown<\/b>, ▼2 vs the previous run 3$/m, 'verdict first: a failed job makes it red');
  assert.match(text, /^🏁 Ours 1 · EURES 2 · JobSpy 1$/m, 'every tool on one line, relevant jobs');
  assert.match(text, /^⚠️ 1 of 2 searches found nothing: Coder · Cityburg$/m);
  assert.match(text, /^📈 ▼ Nurse · Townville −2$/m, 'the biggest moves against the nearest reference');
  assert.match(text, /^ℹ️ no data from the rivals for: adzuna p1, adzuna p2 \(not a failure, not a 0\)$/m, 'Gitar on #14: not-served rivals are named apart from failed jobs');
  assert.match(text, /^⚠️ <b>Missing<\/b> \(a job failed, not a 0\): ours p2$/m);
  assert.match(text, /<a href="https:\/\/x\/run">Run ↗<\/a>$/);
  assert.doesNotMatch(text, /Zzyx|Co\b|https:\/\/y/, 'no job title or employer');
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
  assert.match(noteText(note, null, {rivalsOff: true, tools: {ours: {relevant: 0}}, personas: {1: {relevant: 0}}}, {missing: ['a<b']}), /R&amp;D &lt;Lead&gt; · Town[\s\S]*a&lt;b/);
});

test('the first run has no previous note: its baseline had every source on, so ours is not diffed against it', () => {
  const note = noteOf({1: [job('ours', 'yes', 'yes')]}, {round: 'r'});
  const text = noteText(note, {tools: {ours: {relevant: 0}}, personas: {1: {relevant: 0}}}, null);
  assert.match(text, /^ℹ️ no earlier run with the rivals' sources off yet$/m);
  assert.match(text.split('\n')[0], /^🟢 <b>Job search: ours 1 relevant of 1 shown<\/b>$/, 'no arrow: the old baseline had every source on');
});

// Gitar on #24 (12 Nov 2026): the verdict and the 📈 moves must use the same reference: the previous note when it ran with the rivals' sources off, else the baseline when that did.
test('the moves line uses the same reference as the verdict line', () => {
  const note = noteOf({1: [job('ours', 'yes', 'yes')]}, {round: 'r', labels: {1: 'Nurse · Townville'}, rivalsOff: true});
  const oldLast = {tools: {ours: {relevant: 9}}, personas: {1: {relevant: 9}}};   // an old note: every source on
  const offBaseline = {rivalsOff: true, tools: {ours: {relevant: 4}}, personas: {1: {relevant: 4}}};
  const text = noteText(note, offBaseline, oldLast);
  assert.match(text.split('\n')[0], /▼3 vs baseline 4$/); assert.match(text, /^📈 ▼ Nurse · Townville −3$/m);
  assert.doesNotMatch(noteText(note, oldLast, oldLast), /📈/, 'no reference that ran the same way: no verdict delta, no moves');
});

test('a round the judge did not judge says so, shows no 0 and no delta', () => {
  // Why (12 Nov 2026, owner's Telegram screenshot after run 43297527466): "ours 0 relevant of 0 shown, ▼108 vs the previous run 108" with the judge failed on all 10 people.
  const note = noteOf({}, {round: 'r'});
  const text = noteText(note, null, {rivalsOff: true, tools: {ours: {relevant: 108}}, personas: {1: {relevant: 108}}}, {missing: ['judge p1', 'judge p2'], url: 'https://x/run'});
  assert.match(text, /^🔴 <b>Job search round not judged<\/b>: the judge failed/m);
  assert.doesNotMatch(text, /0 relevant|▼|vs the previous run/);
  assert.match(text, /judge p1, judge p2/); assert.match(text, /https:\/\/x\/run/);
});
