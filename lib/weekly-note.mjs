// The one Telegram message a weekly round ends with (owner, 27 Oct 2026: "It should send to telegram, as notification the results, and
// compare with a baseline"). Our score and wrong values per form, against the baseline (the last by-hand full round, ours and Browser Use)
// and the previous note, with an up/down per form. Only scores, counts and form ids: no answer, no applicant fact, no page text.
// Layout (12 Nov 2026, owner: "improve the visual aspect of the message"): Telegram HTML, a bold verdict line first (chip + number), the comparison
// on one line, rivals on one line, one aligned row per form, then the baseline note and a short "Run ↗" link. Guard: test/weekly-note.test.mjs.
import fs from 'node:fs'; import path from 'node:path';
import {CHIP, delta, esc, link} from './telegram.mjs';
const NAME = {extension: 'Ours', 'browser-use': 'Browser Use', stagehand: 'Stagehand', nanobrowser: 'Nanobrowser'};
const pct = (right, all) => (all ? Math.round(1000 * right / all) / 10 : null);

// scoreRound(round, {rows: true}) -> {at, round, build, tools: {tool: score}, forms: {form: {score, wrong}}} (forms: ours only)
// ourFailure: why ours has no scored run (readFailures' reason), kept in the note as `noScore` when tools has no `extension`.
export function noteOf({tools, rows}, {round, build = '', at = new Date().toISOString(), ourFailure = '', setChanges = []}) {
  const forms = {};
  for (const r of rows.filter(r => r.tool === 'extension')) {
    const f = (forms[r.form] ||= {right: 0, all: 0, wrong: 0});
    f.right += r.right; f.all += r.right + r.wrong + r.emptyAnswerable + r.notReached; f.wrong += r.wrong;
  }
  const scored = Object.fromEntries(Object.entries(tools).map(([t, s]) => [t, s.score]));
  return {at, round, build, tools: scored, ...(setChanges.length ? {setChanges} : {}), ...(scored.extension == null ? {noScore: ourFailure || 'no run of ours was scored (reason unknown)'} : {}),
    forms: Object.fromEntries(Object.entries(forms).map(([form, f]) => [form, {score: pct(f.right, f.all), wrong: f.wrong}]))};
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

const pad = (v, n, left = false) => (left ? String(v).padEnd(n) : String(v).padStart(n));

// note, baseline (a note, or null), last (the previous note of the same kind, or null), url -> Telegram HTML
// Why (27 Oct 2026, owner via 5b): the fixed set runs every 3 days, so its note compares with "the previous run"; the new set stays weekly.
// Why (12 Nov 2026): chip = 🔴 ours has no score, 🟡 ours is more than 2 points under the baseline, 🟢 otherwise (the run's noise is about 2 points).
export function noteText(note, baseline, last, url = '') {
  const kind = note.round === 'fixed' ? 'fixed set (our regression check)' : `new set, week ${note.round.slice(5)}`;
  const prevName = note.round === 'fixed' ? 'the previous run' : 'last week';
  const ours = note.tools.extension, base = baseline?.tools?.extension, prev = last?.tools?.extension;
  const meta = [note.build && `build ${note.build}`, note.at && note.at.slice(0, 10)].filter(Boolean).map(esc).join(' · ');
  const lines = [];
  if (ours == null) {
    lines.push(`${CHIP.bad} <b>Our runs gave no score</b> · ${kind}`);
    if (meta) lines.push(meta);
    lines.push(`Why: ${esc(note.noScore || 'no run of ours was scored (reason unknown)')}`);
    lines.push([base != null && `baseline ${base}%`, last ? (prev != null ? `${prevName} ${prev}%` : `${prevName}: no score`) : ''].filter(Boolean).join(' · '));
  } else {
    lines.push(`${base != null && ours < base - 2 ? CHIP.warn : CHIP.good} <b>Ours ${ours}%</b> · ${kind}`);
    if (meta) lines.push(meta);
    const versus = [];
    if (base != null) versus.push(`${delta(ours, base)} vs baseline ${base}%`);
    if (last) versus.push(prev != null ? `${delta(ours, prev)} vs ${prevName} ${prev}%` : `${prevName} had no score`);
    if (versus.length) lines.push(versus.join(' · '));
  }
  const rivals = Object.entries(note.tools).filter(([t]) => t !== 'extension').sort((a, b) => b[1] - a[1]);
  if (rivals.length) lines.push(rivals.map(([t, s]) => `${esc(NAME[t] || t)} ${s}%`).join(' · '));
  else if (base != null && baseline.tools['browser-use'] != null) lines.push(`Browser Use ${baseline.tools['browser-use']}% (baseline, by hand)`);
  if (note.setChanges?.length) lines.push(`ℹ️ Form set changed: ours ran ${note.setChanges.map(c => esc(c.to)).join(', ')}, the rivals and the baseline are on ${note.setChanges.map(c => esc(c.from)).join(', ')} (not re-run)`);
  const forms = Object.entries(note.forms).sort();
  if (forms.length) {
    const w = Math.max(...forms.map(([form]) => form.length)), rows = forms.map(([form, f]) => {
      const ref = baseline?.forms?.[form] || last?.forms?.[form], dw = ref ? f.wrong - ref.wrong : 0;
      return [pad(form, w, true), pad(f.score == null ? '–' : `${f.score}%`, 5), pad(delta(f.score, ref?.score), 5, true), f.wrong || dw ? `wrong ${f.wrong}${dw ? ` (${dw > 0 ? '+' : '−'}${Math.abs(dw)})` : ''}` : ''];
    });
    lines.push(`<pre>${rows.map(r => esc(r.join(' ').trimEnd())).join('\n')}</pre>`);
  }
  if (baseline?.label) lines.push(`<i>Baseline: ${esc(baseline.label)}</i>`);
  if (url) lines.push(link(url));
  return lines.join('\n');
}
