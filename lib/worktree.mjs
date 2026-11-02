// A worktree of the Jobadabra repo at ONE commit, packages linked like tools/worktree.sh does, never the owner's primary checkout: how a run (qa.mjs run, rerun.mjs) gets "this exact build of the extension".
import fs from 'node:fs'; import path from 'node:path'; import {execFileSync} from 'node:child_process';
export function ensureWorktree(ref, repo = path.join(process.env.HOME, 'jobadabra')) {
  const full = execFileSync('git', ['-C', repo, 'rev-parse', '--verify', ref + '^{commit}'], {encoding: 'utf8'}).trim(), short = full.slice(0, 8), tree = path.join(repo, '.claude', 'worktrees', `bakeoff-at-${short}`);
  if (!fs.existsSync(tree)) { execFileSync('git', ['-C', repo, 'worktree', 'add', '--detach', tree, full], {stdio: 'ignore'});
    for (const rel of ['desktop/node_modules', 'desktop/e2e/node_modules', '.venv']) if (fs.existsSync(path.join(repo, rel)) && !fs.existsSync(path.join(tree, rel))) fs.symlinkSync(path.join(repo, rel), path.join(tree, rel)); }
  return {tree, e2e: path.join(tree, 'desktop', 'e2e'), sha: execFileSync('git', ['-C', tree, 'rev-parse', '--short', 'HEAD'], {encoding: 'utf8'}).trim()};
}
