import test from 'node:test';
import assert from 'node:assert/strict';
import {draw} from '../lib/draw.mjs';

const co = (ats, n) => Array.from({length: n}, (_, i) => ({ats, slug: `${ats}${i}`, key: `${ats}/${ats}${i}`}));
const feeds = Object.fromEntries(['greenhouse', 'ashby', 'lever', 'workable'].map(a => [a, async s => (s.startsWith('empty') ? [] : [{title: 'T', location: 'L', url: `https://h.example/${s}/apply`}])]));
const same = l => l;   // fixed order is enough: the seeded shuffle is not under test
const per = {greenhouse: 2, ashby: 2, lever: 1, workable: 1};

test('every platform fills its own slots when it can', async () => {
  const r = await draw({companies: [...co('greenhouse', 3), ...co('ashby', 3), ...co('lever', 2), ...co('workable', 2)], excluded: '', per, feeds, shuffled: same, first: 100});
  assert.deepEqual(r.picks.map(p => p.platform), ['greenhouse', 'greenhouse', 'ashby', 'ashby', 'lever', 'workable']);
  assert.ok(r.picks.every(p => !p.fillsFor));
});

test('a platform with no unseen company hands its slot to the next one, and the pick says so', async () => {
  // The 12 Nov 2026 case: every Workable company excluded or without postings, the weekly draw had 5 picks and failed.
  const workable = [{ats: 'workable', slug: 'seen0', key: 'workable/seen0'}, {ats: 'workable', slug: 'empty1', key: 'workable/empty1'}];
  const r = await draw({companies: [...co('greenhouse', 4), ...co('ashby', 3), ...co('lever', 2), ...workable], excluded: 'seen0', per, feeds, shuffled: same, first: 100});
  assert.equal(r.picks.length, 6);
  assert.equal(r.picks.filter(p => p.platform === 'workable').length, 0);
  assert.deepEqual(r.picks.filter(p => p.fillsFor).map(p => [p.platform, p.fillsFor]), [['greenhouse', 'workable']]);
  assert.equal(new Set(r.picks.map(p => p.company)).size, 6, 'no company twice');
  assert.deepEqual(r.picks.map(p => p.id), [100, 101, 102, 103, 104, 105]);
  assert.deepEqual(r.skipped.map(s => s.why), ['tested or fixed on before', 'no open postings']);
});

test('when no platform has anything left the draw returns what it has (the workflow then fails loudly)', async () => {
  const r = await draw({companies: co('greenhouse', 1), excluded: '', per, feeds, shuffled: same, first: 1});
  assert.equal(r.picks.length, 1);
});
