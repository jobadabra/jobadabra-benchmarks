// node batch.mjs <forms.json> <ids comma list> <budget usd>: for each form, the extension then Stagehand then Browser Use, back to back (run.mjs); stops before a form when the spend so far (agents + judges) reaches the budget.
// A form where the extension's end page has no fields at all is dropped and named (its reason in out/<id>/drop.json) and the agents are not run on it, so no money goes to a page that is not a form.
import fs from 'node:fs'; import path from 'node:path'; import {spawnSync} from 'node:child_process';
const [file, ids, budget] = process.argv.slice(2), forms = JSON.parse(fs.readFileSync(file, 'utf8')).filter(f => ids.split(',').map(Number).includes(f.id));
// The $9 cap is for everything since the owner's "ok" (13 Oct 2026, key limit raised): every result.json of forms 4+ counts, whatever batch wrote it; a form starts only below CAP.
const CAP = Number(process.env.BAKEOFF_CAP || 4.6), START = (() => { try { return fs.statSync(path.join(import.meta.dirname, 'out', 'BUDGET-START')).mtimeMs; } catch { return 0; } })();
// The owner's cap (13 Oct 2026, 23:30): "no more than $5 from this point". Everything that costs money counts: every result.json written after out/BUDGET-START (agents + judge), any form, any batch; the stop is a little under $5 so a run in flight does not cross it.
const allSpent = () => { let t = 0; const o = path.join(import.meta.dirname, 'out'); for (const id of fs.readdirSync(o)) { if (!fs.existsSync(path.join(o, id)) || !fs.statSync(path.join(o, id)).isDirectory()) continue; for (const tool of fs.readdirSync(path.join(o, id)).filter(t => fs.existsSync(path.join(o, id, t, 'result.json')))) { const f = path.join(o, id, tool, 'result.json'); try { if (fs.statSync(f).mtimeMs > START) { const r = JSON.parse(fs.readFileSync(f, 'utf8')); t += (r.usd || 0) + (r.judgeUsd || 0); } } catch { /* not run */ } } } return t; };
const TOOLS = (process.env.BAKEOFF_TOOLS || 'extension,stagehand,browser-use').split(',');   // BAKEOFF_TOOLS=nanobrowser: the 4th tool on a later day (site limit)
let spent = 0; const here = import.meta.dirname;
if (fs.existsSync(path.join(here, 'out', 'HOLD'))) { console.log('HOLD file present (out/HOLD): not starting these forms yet'); process.exit(0); }   // the owner added a 4th tool (13 Oct 2026): forms not yet visited wait for it
for (const form of forms) {
  if (spent >= Number(budget) || allSpent() >= CAP) { console.log(`BUDGET reached ($${spent.toFixed(2)} of ${budget}; all forms since the ok: $${allSpent().toFixed(2)} of cap ${CAP}): form ${form.id} (${form.platform}) not run`); continue; }
  console.log(`FORM ${form.id} ${form.platform} ${form.host} start ${new Date().toTimeString().slice(0, 8)} spent so far $${spent.toFixed(2)}`);
  for (const tool of TOOLS) {
    if (allSpent() >= CAP) { console.log(`BUDGET reached before ${tool} on form ${form.id}: $${allSpent().toFixed(2)} of the cap ${CAP}`); break; }
    const out = path.join(here, 'out', String(form.id), tool); fs.mkdirSync(out, {recursive: true});
    const r = spawnSync('node', ['run.mjs', tool.startsWith('extension') ? 'extension' : tool, form.url, out], {cwd: here, encoding: 'utf8', env: {...process.env, JOBADABRA_SESSION: 'bake-off', BAKEOFF_FLOW: form.flow ? '1' : '0'}, timeout: 15 * 60 * 1000});
    fs.writeFileSync(path.join(out, 'run.log'), `${r.stdout || ''}\n--- stderr ---\n${r.stderr || ''}`);   // every tool's own lines (the privacy tripwire's reason, errors) stay with its result
    const resFile = path.join(out, 'result.json');
    if (!fs.existsSync(resFile)) { const why = (r.stderr || r.stdout || '').split('\n').filter(l => /Error|refus|limit|SiteLimit/i.test(l)).slice(0, 2).join(' | ').slice(0, 300); console.log(`  ${tool}: NO RESULT ${why}`); fs.writeFileSync(path.join(out, 'no-result.txt'), why); if (tool === TOOLS[0]) break; continue; }
    const res = JSON.parse(fs.readFileSync(resFile, 'utf8')); spent += (res.usd || 0) + (res.judgeUsd || 0);
    console.log(`  RUNNING TOTAL since the cap started: $${allSpent().toFixed(3)} of ${CAP}`); console.log(`  ${tool}: ${JSON.stringify({score: res.score, sec: res.seconds, steps: res.steps, usd: res.usd, submit: res.submitPressed, navBlocked: res.navBlocked})}`);
    if (tool === 'extension' || tool === 'extension-main') {
      const f = path.join(out, 'fields.json'), n = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).fields.length : 0;
      if (n === 0) { console.log(`  DROPPED form ${form.id}: the end page has no form fields (not a no-login form at this URL)`); fs.writeFileSync(path.join(here, 'out', String(form.id), 'drop.json'), JSON.stringify({reason: 'no form fields on the page'})); break; }
    }
  }
}
console.log(`BATCH DONE spent $${spent.toFixed(2)}`);
