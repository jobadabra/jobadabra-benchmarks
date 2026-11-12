// The one Telegram message a weekly round ends with (owner, 27 Oct 2026: "It should send to telegram, as notification the results, and
// compare with a baseline"). Our score and wrong values per form, against the baseline (the last by-hand full round, ours and Browser Use)
// and the previous note, with an up/down per form. Only scores, counts and form ids: no answer, no applicant fact, no page text.
// Layout (12 Nov 2026, owner: "Not very clear to me"; chosen via AskUserQuestion, "Yes, this shape"): Telegram HTML, 3-4 short lines each led by one emoji, then
// a short "Run ↗" link (see noteText). Guard: test/weekly-note.test.mjs.
import fs from 'node:fs'; import path from 'node:path';
import {CHIP, delta, esc, link} from './telegram.mjs';
const NAME = {extension: 'Ours', 'browser-use': 'Browser Use', stagehand: 'Stagehand', nanobrowser: 'Nanobrowser'};
const pct = (right, all) => (all ? Math.round(1000 * right / all) / 10 : null);

// scoreRound(round, {rows: true}) -> {at, round, build, tools: {tool: score}, forms: {form: {score, wrong}}} (forms: ours only)
// ourFailure: why ours has no scored run (readFailures' reason), kept in the note as `noScore` when tools has no `extension`.
export function noteOf({tools, rows}, {round, build = '', at = new Date().toISOString(), ourFailure = '', setChanges = [], rivalsSince = ''}) {
  const forms = {};
  for (const r of rows.filter(r => r.tool === 'extension')) {
    const f = (forms[r.form] ||= {right: 0, all: 0, wrong: 0, empty: 0});
    f.right += r.right; f.all += r.right + r.wrong + r.emptyAnswerable + r.notReached; f.wrong += r.wrong; f.empty += r.emptyAnswerable + r.notReached;
  }
  const scored = Object.fromEntries(Object.entries(tools).map(([t, s]) => [t, s.score]));
  return {at, round, build, tools: scored, ...(setChanges.length ? {setChanges} : {}), ...(rivalsSince ? {rivalsSince} : {}), ...(scored.extension == null ? {noScore: ourFailure || 'no run of ours was scored (reason unknown)'} : {}),
    forms: Object.fromEntries(Object.entries(forms).map(([form, f]) => [form, {score: pct(f.right, f.all), wrong: f.wrong, empty: f.empty}]))};
}

/**
 * Takes a pool dir (<form>/<tool>/<run>/) and a tool; returns {runs, reason}: how many of its runs have no judged.json (the run crashed or never started) and the most common error of their result.json, one line, urls removed.
 * Why (12 Nov 2026, owner: "Ours –%"): ours scored nothing for 3 rounds because every run died at start with the same error; the note must say that error, not print a dash.
 */
export function readFailures(pool, tool) {
  const errors = [];
  for (const form of fs.existsSync(pool) ? fs.readdirSync(pool) : []) {
    const dir = path.join(pool, form, tool);
    for (const run of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
      if (fs.existsSync(path.join(dir, run, 'judged.json'))) continue;
      let error = ''; try { error = String(JSON.parse(fs.readFileSync(path.join(dir, run, 'result.json'), 'utf8')).error || ''); } catch { /* no result.json: no reason */ }
      errors.push(error.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim());
    }
  }
  const count = {}; for (const e of errors.filter(Boolean)) count[e] = (count[e] || 0) + 1;
  return {runs: errors.length, reason: (Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] || '').slice(0, 220)};
}

/**
 * Takes a pool dir (<form>/<tool>/<run>/manifest.json; loose files such as baseline.json are skipped) and today (YYYY-MM-DD); returns the day of the rivals' newest run when it is
 * older than today, else ''. Why (12 Nov 2026, owner's note shape): the fixed set's rivals are frozen runs of 27 Oct; the note says "Rivals not re-run since <day>".
 */
export function rivalsSince(pool, today = new Date().toISOString().slice(0, 10)) {
  const dirs = dir => (fs.existsSync(dir) ? fs.readdirSync(dir).filter(name => fs.statSync(path.join(dir, name)).isDirectory()) : []);
  let newest = '';
  for (const form of dirs(pool)) for (const tool of dirs(path.join(pool, form)).filter(t => t !== 'extension')) for (const run of dirs(path.join(pool, form, tool))) {
    let at = ''; try { at = String(JSON.parse(fs.readFileSync(path.join(pool, form, tool, run, 'manifest.json'), 'utf8')).startedAt || '').slice(0, 10); } catch { /* no manifest: no date */ }
    if (at > newest) newest = at;
  }
  return newest && newest < today ? newest : '';
}

const day = iso => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', timeZone: 'UTC'});   // "27 Oct"
const NOISE = 2;   // points: the run's own noise (3 runs of the same build differ by about 2)

// note, baseline (a note, or null), last (the previous note of the same kind, or null), url -> Telegram HTML
// Why (12 Nov 2026, owner: "Not very clear to me"; shape chosen via AskUserQuestion, "Yes, this shape"): four short lines you read in 5 seconds, each with one emoji:
// verdict against the baseline, the scores of all four tools, which forms are perfect / what is missing on the others / which form is new, and what changed in the set up.
// Why (27 Oct 2026, owner via 5b): the fixed set runs every 3 days, so its note compares with "the previous run"; a new set stays weekly ("last week").
// Chip = 🔴 ours has no score, 🟡 ours is more than 2 points under the baseline, 🟢 otherwise. A per-form table and the build/date lines are gone (the Run link holds them).
export function noteText(note, baseline, last, url = '') {
  const fixed = note.round === 'fixed', title = fixed ? 'Form filling' : `New forms, week ${note.round.slice(5)}`;
  const ours = note.tools.extension, base = baseline?.tools?.extension, prev = last?.tools?.extension, prevName = fixed ? 'the previous run' : 'last week';
  const lines = [];
  if (ours == null) {
    lines.push(`${CHIP.bad} <b>${title}: ours has no score</b>`, `Why: ${esc(note.noScore || 'no run of ours was scored (reason unknown)')}`);
  } else {
    const parts = [];
    if (base != null) parts.push(Math.abs(ours - base) <= NOISE ? `same as baseline (${base}%)` : `${delta(ours, base)} vs baseline (${base}%)`);
    if (prev != null && Math.abs(ours - prev) > NOISE) parts.push(`${delta(ours, prev)} vs ${prevName} (${prev}%)`);
    else if (base == null && prev != null) parts.push(`same as ${prevName} (${prev}%)`);
    lines.push(`${base != null && ours < base - NOISE ? CHIP.warn : CHIP.good} <b>${title}: ours ${ours}%</b>${parts.length ? `, ${parts.join(' · ')}` : ''}`);
  }
  const rivals = Object.entries(note.tools).filter(([t]) => t !== 'extension').sort((a, b) => b[1] - a[1]).map(([t, sc]) => `${esc(NAME[t] || t)} ${sc}`);
  if (!rivals.length && base != null && baseline.tools['browser-use'] != null) rivals.push(`Browser Use ${baseline.tools['browser-use']} (baseline)`);
  lines.push(`🏁 ${[ours == null ? 'Ours no score' : `Ours ${ours}`, ...rivals].join(' · ')}`);
  const fresh = new Set((note.setChanges || []).map(c => c.to)), forms = Object.entries(note.forms).sort();
  const perfect = forms.filter(([id, f]) => !fresh.has(id) && f.score === 100 && !f.wrong).length;
  const items = [perfect && `✅ ${perfect} form${perfect > 1 ? 's' : ''} perfect`];
  for (const [id, f] of forms) {
    if (fresh.has(id)) { items.push(`🆕 ${esc(id)}: ${f.score == null ? 'no score' : `${f.score}%`} (new form)`); continue; }
    if (f.score === 100 && !f.wrong) continue;
    const part = [f.wrong && `${f.wrong} wrong`, f.empty && `${f.empty} field${f.empty > 1 ? 's' : ''} left empty`].filter(Boolean).join(', ') || (f.score == null ? 'no score' : `${f.score}%`);
    items.push(`⚠️ ${esc(id)}: ${part}${f.wrong ? '' : ' (none wrong)'}`);
  }
  if (items.some(Boolean)) lines.push(items.filter(Boolean).join(' · '));
  const info = [];
  if (note.rivalsSince) info.push(`Rivals not re-run since ${day(note.rivalsSince)}`);
  for (const c of note.setChanges || []) info.push(`form ${esc(c.from)} replaced by ${esc(c.to)} ${c.at && note.at && c.at.slice(0, 10) === note.at.slice(0, 10) ? 'today' : c.at ? `on ${day(c.at)}` : ''}`.trim());
  if (info.length) lines.push(`ℹ️ ${info.join('; ')}`);
  if (url) lines.push(link(url));
  return lines.join('\n');
}
