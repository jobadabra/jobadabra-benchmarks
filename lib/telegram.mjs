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
 * Takes the message (Telegram HTML), the env and a fetch; sends it to the Engineering chat. Returns {sent: false} when run outside CI without the two variables (the text is only printed).
 * Why (12 Nov 2026, owner via mac-9a): in GitHub Actions a missing secret is a failure the step shows, never a silent skip and never a fall back to the old BENCH_* bot.
 * Throws with Telegram's own description (never the token) when Telegram refuses.
 */
export async function sendNote(text, env = process.env, fetchImpl = fetch) {
  const token = env.CI_ALERTS_TELEGRAM_BOT_TOKEN, chat = env.CI_ALERTS_TELEGRAM_CHAT_ID;
  if (!token || !chat) {
    if (env.GITHUB_ACTIONS === 'true') throw new Error('telegram: CI_ALERTS_TELEGRAM_BOT_TOKEN / CI_ALERTS_TELEGRAM_CHAT_ID are not set on this repo (Engineering bot); the note was not sent');
    console.log('telegram: CI_ALERTS_TELEGRAM_BOT_TOKEN / CI_ALERTS_TELEGRAM_CHAT_ID not set, printed only');
    return {sent: false};
  }
  const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true})});
  if (!res.ok) throw new Error(`telegram: ${res.status} ${String((await res.json().catch(() => ({}))).description || '').slice(0, 200)}`);
  console.log(`telegram: ${res.status}`);
  return {sent: true};
}
