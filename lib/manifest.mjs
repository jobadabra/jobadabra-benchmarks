// What a run needs to be repeated: the manifest written next to every result (and backfilled for earlier runs): the form, the tool and its exact version, the model, the extension build and version, the hashes of the code that judged
// the run (guard, field reader, scorer), the instruction text and the applicant facts it was given, and the flags. A rerun (rerun.mjs) reads it; a QA comparison (qa.mjs) can say what differed.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import {execFileSync} from 'node:child_process';
const here = path.resolve(import.meta.dirname, '..');
export const hash = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 10);
const fileHash = f => { try { return hash(fs.readFileSync(path.join(here, f), 'utf8')); } catch { return ''; } };
const pkgVersion = (dir, name) => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'node_modules', ...name.split('/'), 'package.json'), 'utf8')).version; } catch { return ''; } };
const pyVersion = pkg => { try { const lib = path.join(here, 'venv', 'lib'), py = fs.readdirSync(lib)[0], d = fs.readdirSync(path.join(lib, py, 'site-packages')).find(x => x.toLowerCase().startsWith(pkg.replace('-', '_') + '-') && x.endsWith('.dist-info')); return d ? d.slice(pkg.length + 1, -10) : ''; } catch { return ''; } };
export function toolVersion(tool) {
  if (tool === 'stagehand') return pkgVersion(here, '@browserbasehq/stagehand');
  if (tool === 'browser-use') return pyVersion('browser-use') || pyVersion('browser_use');
  if (tool === 'nanobrowser') { try { return JSON.parse(fs.readFileSync(path.join(process.env.NANOBROWSER_DIR || path.join(process.env.HOME, 'bakeoff-tools', 'nb-0.2.0'), 'manifest.json'), 'utf8')).version; } catch { return ''; } }
  return '';
}
export function writeManifest({tool, url, out, instructionText, applicantText, repoE2e, result, startedAt, flow}) {
  const root = path.resolve(repoE2e, '..', '..'), sha = (() => { try { return execFileSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD'], {encoding: 'utf8'}).trim(); } catch { return ''; } })();
  const extVersion = (() => { try { const log = fs.readFileSync(path.join(out, 'capture', 'app.log'), 'utf8'); return (log.match(/"version":"(\d+\.\d+\.\d+)"/) || [])[1] || ''; } catch { return ''; } })();
  const manifest = {schema: 1, tool, url, flow: !!flow, startedAt, finishedAt: new Date().toISOString(), model: tool.startsWith('extension') ? (process.env.JOBADABRA_MODEL_OVERRIDE ? `${process.env.JOBADABRA_MODEL_OVERRIDE} (override, claude -p on the plan)` : 'as shipped (claude -p on the plan)') : (process.env.BENCH_MODEL || 'claude-sonnet-5-5'), maxSteps: tool.startsWith('extension') ? null : 40,
    toolVersion: toolVersion(tool), playwright: pkgVersion(here, 'playwright'), node: process.version,
    extension: tool.startsWith('extension') ? {commit: sha, version: extVersion, jpRepo: repoE2e} : null,
    code: {guard: fileHash('lib/guard.mjs'), fieldReader: fileHash('lib/extract-fields.js'), scorer: fileHash('lib/score.mjs'), trail: fileHash('lib/trail.mjs'), runner: fileHash('run.mjs')},
    flags: {readPosts: process.env.BAKEOFF_READPOSTS === '1', flow: !!flow}, instruction: instructionText, instructionHash: hash(instructionText || ''), applicantHash: hash(applicantText || ''), build: result?.build || ''};
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1)); return manifest;
}
