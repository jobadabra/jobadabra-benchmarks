// node rerun.mjs <form id> <tool dir> [--build <sha|ref>] [--tag <name>]: repeat one recorded run with the same inputs (its manifest: url, flow, instruction, flags), optionally on another extension build. Writes out/<id>/<tool>-rerun-<n>/; compare it with the original.
// Example: node rerun.mjs 4 extension --build 62dad23   (Hadrian on the old build, a new visit). Costs: the plan + a judge call for the extension; the model's tokens for an agent. Counts against the site limit and the budget stop.
import fs from 'node:fs'; import path from 'node:path'; import {spawnSync} from 'node:child_process'; import {ensureWorktree} from './lib/worktree.mjs';
const here = import.meta.dirname, [idArg, toolDir, ...rest] = process.argv.slice(2), flag = n => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : ''; };
const id = idArg === '1' ? 'lever' : idArg, src = path.join(here, 'out', id, toolDir), man = (() => { try { return JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8')); } catch { return null; } })();
if (!man) { console.error(`no manifest in ${src}: run backfill-manifests.mjs first`); process.exit(2); }
const build = flag('build'), tool = man.tool.replace(/^extension.*/, 'extension'), n = fs.readdirSync(path.join(here, 'out', id)).filter(d => d.startsWith(`${toolDir}-rerun-`)).length + 1, dest = path.join(here, 'out', id, `${toolDir}-rerun-${n}`);
const env = {...process.env, JOBADABRA_SESSION: 'bake-off', BAKEOFF_FLOW: man.flow ? '1' : '0', ...(man.flags?.readPosts ? {BAKEOFF_READPOSTS: '1'} : {})};
if (tool === 'extension' && build) env.JP_REPO = ensureWorktree(build).e2e; else if (tool === 'extension' && man.extension?.jpRepo && fs.existsSync(man.extension.jpRepo)) env.JP_REPO = man.extension.jpRepo;
console.log(`rerun ${id}/${toolDir} -> ${path.relative(here, dest)}${build ? ` on build ${build}` : ''} (${man.url})`);
process.exit(spawnSync('node', ['run.mjs', tool, man.url, dest], {cwd: here, stdio: 'inherit', env}).status || 0);
