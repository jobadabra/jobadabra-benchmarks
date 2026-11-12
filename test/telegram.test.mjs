// lib/telegram.mjs: the one send of both benchmark notes goes to the Engineering bot, fails loudly in CI without its secrets, and never falls back to BENCH_*.
import test from 'node:test'; import assert from 'node:assert/strict';
import {esc, delta, link, sendNote} from '../lib/telegram.mjs';
const ok = {ok: true, status: 200, json: async () => ({})};
test('esc and delta', () => {
  assert.equal(esc('a<b>&"c'), 'a&lt;b&gt;&amp;&quot;c');
  assert.equal(delta(5, 3, 0), '▲2'); assert.equal(delta(3, 5, 0), '▼2'); assert.equal(delta(3, 3), '='); assert.equal(delta(null, 3), ''); assert.equal(delta(3, undefined), ''); assert.equal(delta(90, 97.3), '▼7.3');
  assert.equal(link(''), ''); assert.equal(link('https://x/?a=1&b=2'), '<a href="https://x/?a=1&amp;b=2">Run ↗</a>');
});
test('sends to the Engineering chat as HTML', async () => {
  let seen;
  const out = await sendNote('<b>hi</b>', {CI_ALERTS_TELEGRAM_BOT_TOKEN: 'T', CI_ALERTS_TELEGRAM_CHAT_ID: 'C'}, async (url, init) => { seen = {url, body: JSON.parse(init.body)}; return ok; });
  assert.deepEqual(out, {sent: true}); assert.equal(seen.url, 'https://api.telegram.org/botT/sendMessage');
  assert.deepEqual(seen.body, {chat_id: 'C', text: '<b>hi</b>', parse_mode: 'HTML', disable_web_page_preview: true});
});
test('in GitHub Actions a missing secret fails; the old BENCH_* pair is never used', async () => {
  const old = {BENCH_TELEGRAM_BOT_TOKEN: 'old', BENCH_TELEGRAM_CHAT_ID: 'old'};
  await assert.rejects(() => sendNote('x', {GITHUB_ACTIONS: 'true', ...old}, async () => assert.fail('must not send')), /CI_ALERTS_TELEGRAM_BOT_TOKEN .* not set/);
  assert.deepEqual(await sendNote('x', old, async () => assert.fail('must not send')), {sent: false}, 'outside CI: printed only');
});
test('a refusal names Telegram\'s words, never the token', async () => {
  await assert.rejects(() => sendNote('x', {CI_ALERTS_TELEGRAM_BOT_TOKEN: 'SECRET', CI_ALERTS_TELEGRAM_CHAT_ID: 'C'}, async () => ({ok: false, status: 400, json: async () => ({description: "can't parse entities"})})), err => /400 can't parse entities/.test(err.message) && !/SECRET/.test(err.message));
});
test('the switchboard goes first; the CI-alerts bot is only the fallback and the switchboard is told', async () => {
  const env = {SELFHEAL_PUBLISH_KEY: 'K', CI_ALERTS_TELEGRAM_BOT_TOKEN: 'T', CI_ALERTS_TELEGRAM_CHAT_ID: 'C', GITHUB_ACTIONS: 'true'};
  const calls = [];
  const board = async (url, init) => { calls.push({url, body: JSON.parse(init.body), auth: init.headers.Authorization}); return {ok: true, status: 200, json: async () => ({sent: true})}; };
  assert.deepEqual(await sendNote('<b>hi</b>', env, board, 'search-benchmark-note'), {sent: true, via: 'switchboard'});
  assert.equal(calls.length, 1); assert.match(calls[0].url, /\/ops\/notify$/); assert.equal(calls[0].auth, 'Bearer K');
  assert.deepEqual(calls[0].body, {event: 'search-benchmark-note', text: '<b>hi</b>', html: true});
  // the owner's switch holds it on purpose: done, the old bot does not send
  const held = async () => ({ok: true, status: 200, json: async () => ({sent: false, why: 'off'})});
  assert.deepEqual(await sendNote('x', env, held, 'form-benchmark-note'), {sent: false, via: 'switchboard'});
  // the switchboard is down (503): the old bot sends, then the switchboard is told
  const urls = [];
  const down = async (url, init) => { urls.push(url); return /ops\/notify/.test(url) && !JSON.parse(init.body).fallback ? {ok: false, status: 503, json: async () => ({})} : ok; };
  assert.deepEqual(await sendNote('x', env, down, 'form-benchmark-note'), {sent: true});
  assert.deepEqual(urls.map(u => u.replace(/^https:\/\/[^/]+/, '')), ['/ops/notify', '/botT/sendMessage', '/ops/notify']);
});
test('without the key, or without an event, the old bot sends and the switchboard is not asked', async () => {
  const urls = [];
  const fetcher = async url => { urls.push(url); return ok; };
  await sendNote('x', {CI_ALERTS_TELEGRAM_BOT_TOKEN: 'T', CI_ALERTS_TELEGRAM_CHAT_ID: 'C'}, fetcher, 'form-benchmark-note');
  await sendNote('x', {SELFHEAL_PUBLISH_KEY: 'K', CI_ALERTS_TELEGRAM_BOT_TOKEN: 'T', CI_ALERTS_TELEGRAM_CHAT_ID: 'C'}, fetcher);
  assert.deepEqual(urls, ['https://api.telegram.org/botT/sendMessage', 'https://api.telegram.org/botT/sendMessage']);
});
