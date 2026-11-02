// The benchmarks repo says Jobadabra everywhere (owner, 2 Nov 2026: "Everything that is job pilotto is renamed/dropped/replaced", "we should not support the 2 versions").
// The old name survives only in recorded run data: those files are records of what past runs saw, not our wording.
import test from 'node:test'; import assert from 'node:assert/strict'; import {execFileSync} from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path';

const root = path.join(import.meta.dirname, '..');
const OLD = /job[-_ ]?pilotto/i;
const BINARY = /\.(png|jpe?g|gif|ico|pdf|zip|woff2?|sqlite|pyc)$/i;
const RECORDED = /^(results\/runs\/|rounds\/.*\/(fields|result)\.json$)/;   // the extension's #jobpilotto-fill mark in recorded URLs: the public extension still uses it (JOB-199)

test('no old spelling outside recorded run data', () => {
  const files = execFileSync('git', ['ls-files', '-z'], {cwd: root, maxBuffer: 1 << 28}).toString().split('\0')
    .filter(f => f && !BINARY.test(f) && !RECORDED.test(f) && f !== 'test/no-old-name.test.mjs');
  const bad = [];
  for (const f of files) {
    let text; try { text = fs.readFileSync(path.join(root, f), 'utf8'); } catch { continue; }
    text.split('\n').forEach((line, i) => { if (OLD.test(line)) bad.push(`${f}:${i + 1}: ${line.trim().slice(0, 110)}`); });
  }
  assert.deepEqual(bad, [], 'say "Jobadabra":\n' + bad.slice(0, 40).join('\n'));
});
