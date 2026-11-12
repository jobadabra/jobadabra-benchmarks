// "Ours" without the rivals' sources and "ours-all" with them (owner, 27 Oct 2026): both lines reach the note and the published rows.
import test from 'node:test'; import assert from 'node:assert/strict';
import {noteOf, noteText} from '../search-bench/note.mjs';

const rows = [
  {tool: 'ours', title: 'Cook', company: 'A', location: 'Krakow', role: 'yes', place: 'yes'},
  {tool: 'ours-all', title: 'Cook', company: 'A', location: 'Krakow', role: 'yes', place: 'yes'},
  {tool: 'ours-all', title: 'Chef', company: 'B', location: 'Krakow', role: 'yes', place: 'yes'},
  {tool: 'eures', title: 'Chef', company: 'B', location: 'Krakow', role: 'yes', place: 'yes'},
  {tool: 'eures', title: 'Aide', company: 'C', location: 'Krakow', role: 'yes', place: 'yes'},
];
test('the note shows ours without the rivals, ours with everything and the relevant jobs we add beyond each rival', () => {
  const note = noteOf({1: rows}, {round: '2026-10-30'});
  assert.deepEqual(note.beyond.eures, 1, 'A is not in EURES');
  assert.equal(note.beyond.jobspy, 2, 'nothing from JobSpy: both ours-all jobs are beyond it');
  const text = noteText(note, null, null);
  assert.match(text, /^🟢 <b>Job search: ours 1 relevant of 1 shown<\/b>/m, 'the verdict line is ours with the rivals\' sources off');
  assert.match(text, /^ℹ️ with every source ours finds 2 of 2/m);
  assert.match(text, /^➕ We add beyond .*EURES 1/m);
  assert.doesNotMatch(text.split('\n')[1] || '', /ours-all/, 'the rivals line holds only rivals');
});

test('ours (rivals off) is never diffed against a reference that had every source on; ours with every source is', () => {
  const note = noteOf({1: rows}, {round: 'r', rivalsOff: true});
  const old = {tools: {ours: {relevant: 5}}, personas: {1: {relevant: 5}}};   // the 27 Oct baseline and notes before this change: every source on
  const text = noteText(note, old, old);
  assert.match(text, /^ℹ️ with every source ours finds 2 of 2, ▼3 vs the previous run 5, ▼3 vs baseline 5; no earlier run with the rivals' sources off yet$/m);
  const next = {rivalsOff: true, tools: {ours: {relevant: 0}, 'ours-all': {relevant: 1}}, personas: {}};
  assert.match(noteText(note, old, next), /^🟢 <b>Job search: ours 1 relevant of 1 shown<\/b>, ▲1 vs the previous run 0$/m);
});

test('a rival whose job failed is unknown, not a lead: nothing is counted as beyond it', () => {
  const note = noteOf({1: rows}, {round: 'r', missing: ['eures p1', 'jobspy p1']});
  assert.equal(note.beyond.eures, undefined);
  assert.equal(note.beyond.jobspy, undefined);
  assert.equal(note.beyond.adzuna, 2, 'a rival that ran with an empty list is a real "beyond"');
});
