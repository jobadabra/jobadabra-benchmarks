// What both benchmark notes (lib/weekly-note.mjs, search-bench/note.mjs) share: Telegram HTML helpers and the one send.
// Why (12 Nov 2026, owner: "let's move to Engineering and improve the visual aspect of the message"): the notes go to the Engineering bot
// (CI_ALERTS_TELEGRAM_BOT_TOKEN / _CHAT_ID, the pair jobadabra, jobadabra-web and jobadabra-lab use), not the old benchmarks bot (BENCH_TELEGRAM_*).
// Guard: test/telegram.test.mjs.

/** Escapes a value for Telegram's HTML parse mode (also safe inside a double-quoted attribute). */
export const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A short link ("Run ↗"), or '' when there is no url. */
export const link = (url, label = 'Run ↗') => (url ? `<a href="${esc(url)}">${esc(label)}</a>` : '');

/**
 * The round's page in Admin (owner, 12 Nov 2026: "First I should see them more in depth in Admin, and then having a button to publish them on the website"): kind 'form' or 'search',
 * the round key as Admin keys it ('fixed', 'week-2026-W46', '2026-11-12'). The page has the owner-only "Publish to website" button; the note only points at it.
 */
export const adminLink = (kind, round) => (round ? link(`https://www.jobadabra.top/admin/${kind === 'form' ? 'form-filling' : 'job-search'}/benchmark?round=${encodeURIComponent(round)}`, 'Review in Admin ↗') : '');

/** now vs then -> "▲3", "▼2" or "=" ; '' when either is missing. digits: decimals kept (a percent: 1, a count: 0). */
export const delta = (now, then, digits = 1) => {
  if (now == null || then == null) return '';
  const d = +(now - then).toFixed(digits);
  return d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : '=';
};

/** A status chip: icon + word, so the verdict reads without colour. */
export const CHIP = {good: '🟢', warn: '🟡', bad: '🔴'};

/**
 * Asks the owner's Notifications switchboard (jobadabra-web POST /ops/notify: the owner's on/off, "when" and bot) to send `text` as `event`.
 * -> 'sent' | 'held' (the owner's switch held it on purpose: done) | null (no key, site down, a 400/503, anything unclear: the old bot sends it).
 */
export async function viaSwitchboard(event, text, env = process.env, fetchImpl = fetch) {
  if (!env.SELFHEAL_PUBLISH_KEY) return null;
  try {
    const res = await fetchImpl(`${env.CI_STATE_URL || 'https://www.jobadabra.top'}/ops/notify`, {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${env.SELFHEAL_PUBLISH_KEY}`},
      body: JSON.stringify({event, text: text.slice(0, 3900), html: true}), signal: AbortSignal.timeout(10000)});
    if (res.status !== 200) return null;
    const body = await res.json().catch(() => null);   // a 200 that is not the switchboard's JSON (a proxy page) is not a delivery
    if (body?.sent === true) return 'sent';
    return body?.sent === false && body.why ? 'held' : null;
  } catch { return null; }
}

/**
 * Takes the message (Telegram HTML), the env, a fetch and the switchboard `event` (an id of jobadabra-web shared/notify-registry.js); sends it through the switchboard first, then (it could not deliver) to the Engineering bot.
 * Returns {sent: false} when run outside CI without the bot variables (the text is only printed).
 * Why (12 Nov 2026, owner via mac-9a): in GitHub Actions a missing secret is a failure the step shows, never a silent skip and never a fall back to the old BENCH_* bot.
 * Why (13 Nov 2026, owner: "Please move all the messages from CI alerts"): the switchboard goes first so the owner's Admin switch, "when" and bot apply; the CI-alerts bot is only the fail-open fallback, as in the other repos.
 * Throws with Telegram's own description (never the token) when Telegram refuses.
 */
export async function sendNote(text, env = process.env, fetchImpl = fetch, event = '') {
  const board = event ? await viaSwitchboard(event, text, env, fetchImpl) : null;
  if (board) { console.log(`telegram: ${board} (switchboard)`); return {sent: board === 'sent', via: 'switchboard'}; }
  const token = env.CI_ALERTS_TELEGRAM_BOT_TOKEN, chat = env.CI_ALERTS_TELEGRAM_CHAT_ID;
  if (!token || !chat) {
    if (env.GITHUB_ACTIONS === 'true') throw new Error('telegram: the switchboard did not deliver and CI_ALERTS_TELEGRAM_BOT_TOKEN / CI_ALERTS_TELEGRAM_CHAT_ID are not set on this repo; the note was not sent');
    console.log('telegram: SELFHEAL_PUBLISH_KEY / CI_ALERTS_TELEGRAM_BOT_TOKEN / CI_ALERTS_TELEGRAM_CHAT_ID not set, printed only');
    return {sent: false};
  }
  const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true})});
  if (!res.ok) throw new Error(`telegram: ${res.status} ${String((await res.json().catch(() => ({}))).description || '').slice(0, 200)}`);
  console.log(`telegram: ${res.status}`);
  if (event && env.SELFHEAL_PUBLISH_KEY) await fetchImpl(`${env.CI_STATE_URL || 'https://www.jobadabra.top'}/ops/notify`, {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${env.SELFHEAL_PUBLISH_KEY}`}, body: JSON.stringify({event, fallback: true}), signal: AbortSignal.timeout(10000)}).catch(() => {});   // Admin shows "sent without switchboard"
  return {sent: true};
}
