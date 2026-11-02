// node run.mjs <stagehand|browser-use|extension> <form url> <out dir> [--no-judge]: one tool on one form, same start state, same guard, same scorer. Writes <out>/{start.png,end.png,fields.json,guard.jsonl,result.json,judged.json}.
// Safety: every tool's browser has the Submit guard (lib/guard.mjs); live visits go through the repo's per-site ledger (guardLiveVisit); never Submit, no login. Prints only result lines, never a key.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import {spawn, execFileSync} from 'node:child_process';
import {startAgentBrowser} from './lib/browser.mjs'; import {installGuard} from './lib/guard.mjs'; import {fillLog, postLines} from './lib/fill-log.mjs';
import {startAnthropicProxy} from './lib/anthropic-proxy.mjs'; import {writeManifest} from './lib/manifest.mjs'; import {startTrail} from './lib/trail.mjs'; import {startNanobrowser} from './lib/nanobrowser.mjs'; import {buildApplicant, instruction, CV_PDF} from './lib/applicant.mjs'; import {collectEnd, judge, summarize} from './lib/score.mjs'; import {AGENT_MODEL, anthropicKey} from './lib/models.mjs';

// A crash inside a tool (an uncaught error in its own library) is that tool's result, not a lost run: the end page is still read and the metered tokens still counted.
let fatal = '';
process.on('uncaughtException', e => { fatal = String(e?.message || e).slice(0, 300); console.error('FATAL (uncaught):', e?.stack || e); });   // never silent: a tool crash is a result, and its stack goes to the run log
process.on('unhandledRejection', e => { fatal = String(e?.message || e).slice(0, 300); console.error('FATAL (unhandled rejection):', e?.stack || e); });
// Our leg awaits the harness at the top level: a crash there would leave the app holding the process open (27 Oct 2026, a missing browser). Its result says so and the run ends.
const endOursOnCrash = () => { if (process.argv[2] !== 'extension' || !fatal) return; try { fs.writeFileSync(path.join(process.argv[4], 'result.json'), JSON.stringify({tool: 'extension', url: process.argv[3], error: fatal, crashed: true}, null, 1)); } catch { /* the out dir may not exist yet */ } setTimeout(() => process.exit(1), 3000).unref(); };
process.on('uncaughtException', endOursOnCrash); process.on('unhandledRejection', endOursOnCrash);
const watchFatal = () => new Promise((_, reject) => { const t = setInterval(() => { if (fatal) { clearInterval(t); reject(new Error(fatal)); } }, 500); setTimeout(() => { clearInterval(t); reject(new Error('timeout: 8 minutes')); }, 8 * 60 * 1000).unref(); });
const REPO = process.env.JP_REPO || path.join(process.env.HOME, 'jobadabra', 'desktop', 'e2e');   // the Jobadabra checkout: fake applicant, site ledger, the extension harness (use a worktree on main, never the owner's live checkout)
const [tool, url, out] = process.argv.slice(2);
if (!['stagehand', 'browser-use', 'extension', 'nanobrowser'].includes(tool) || !url || !out) { console.error('usage: run.mjs <stagehand|browser-use|extension> <url> <out dir>'); process.exit(2); }
fs.mkdirSync(out, {recursive: true});
const guardLog = path.join(out, 'guard.jsonl'); fs.writeFileSync(guardLog, '');
const key = anthropicKey;
const applicant = await buildApplicant(path.dirname(out));   // the same file for every tool of this form
const started = Date.now(), result = {tool, url, model: tool === 'extension' ? (process.env.BENCH_MODEL && process.env.BENCH_OURS_AS_SHIPPED !== '1' ? `${AGENT_MODEL} (JOBADABRA_MODEL_OVERRIDE, claude -p on the plan)` : 'as shipped: claude-sonnet-5-5 for answers (claude -p on the plan)') : AGENT_MODEL};
// The same model for ours as for the agents (objective round): the app's e2e-only switch puts every AI step on it. BENCH_OURS_AS_SHIPPED=1 keeps the shipped models.
if (tool === 'extension' && process.env.BENCH_MODEL && process.env.BENCH_OURS_AS_SHIPPED !== '1') process.env.JOBADABRA_MODEL_OVERRIDE = AGENT_MODEL;
const {guardLiveVisit} = await import(path.join(REPO, 'lib/site-ledger.mjs'));
let guard = null;
// Where a top-level navigation may go: the form's own site (registrable domain) plus the hiring systems forms are embedded from. Anything else is aborted and logged.
const ATS = ['greenhouse.io', 'lever.co', 'ashbyhq.com', 'recruitee.com', 'teamtailor.com', 'personio.de', 'personio.com', 'workable.com', 'smartrecruiters.com', 'join.com', 'myworkdayjobs.com', 'successfactors.eu', 'successfactors.com'];
const formHost = new URL(url).hostname, navAllow = /^[\d.]+$/.test(formHost) ? [formHost] : [formHost.split('.').slice(-2).join('.'), formHost, ...ATS];

if (tool === 'extension') {
  const {runLiveRow} = await import(path.join(REPO, 'lib/live-row.mjs')); const {startRealExtension} = await import(path.join(REPO, 'lib/real-extension.mjs'));
  // BAKEOFF_REPLAY=<a record dir from an earlier live run>: the same form offline (owner, 14 Oct 2026: "record the 5 headline forms once, then replay; compare with live first").
  // A live run keeps its network record in <out>/net/ (local only: real site responses, never published). The AI answers only from the live run's kept answers.
  const replayDir = process.env.BAKEOFF_REPLAY, replayed = replayDir ? {record: JSON.parse(fs.readFileSync(path.join(replayDir, 'record.json'), 'utf8')), bodies: new Map(fs.readdirSync(path.join(replayDir, 'bodies')).map(hash => [hash, fs.readFileSync(path.join(replayDir, 'bodies', hash))]))} : null;
  const {netReplay} = await import(path.join(REPO, 'lib/net-record.mjs')); const {seedRandom} = await import(path.join(REPO, 'lib/seeded-random.mjs'));
  const {forceScrollbar} = await import(path.join(REPO, 'lib/scrollbar.mjs')); const {shiftDate, zoneOf} = await import(path.join(REPO, 'lib/replay-date.mjs'));
  if (replayed) {
    if (zoneOf(replayed.record)) process.env.TZ = zoneOf(replayed.record);
    fs.mkdirSync(path.join(out, 'capture'), {recursive: true});
    fs.copyFileSync(path.join(replayDir, 'model-memo.json'), path.join(out, 'capture', 'model-memo.json'));
    Object.assign(process.env, {JOBADABRA_SITE_LEDGER_DIR: path.join(out, 'ledger'), JOBADABRA_MODEL_MEMO_HITS: path.join(out, 'hits.txt'), JOBADABRA_MODEL_MEMO_LATENCY_CAP_MS: '20000'});
    delete process.env.JP_NET_RECORD_DIR;
  } else process.env.JP_NET_RECORD_DIR ||= path.join(out, 'net');
  const browser = async options => {   // the harness's own browser + the guard + the end-state read before it closes
    // The extension acts on https hosts only (manifest host_permissions); for a local http fixture a COPY of it also gets http://127.0.0.1 (the product's extension/ is not touched).
    if (process.env.JP_EXT_DIR) options = {...options, extensionDir: process.env.JP_EXT_DIR};   // the build under test (an older commit lacks harness files, so the harness stays on JP_REPO)
    if (/^http:\/\/127\.0\.0\.1/.test(url)) {
      const {EXTENSION_DIR: DEFAULT_EXT} = await import(path.join(REPO, 'lib/extension.mjs')), EXTENSION_DIR = options.extensionDir || DEFAULT_EXT, copy = fs.mkdtempSync(path.join(os.tmpdir(), 'bakeoff-ext-')); fs.cpSync(EXTENSION_DIR, copy, {recursive: true});
      const mf = path.join(copy, 'manifest.json'), m = JSON.parse(fs.readFileSync(mf, 'utf8')); m.host_permissions = [...m.host_permissions, 'http://127.0.0.1/*']; fs.writeFileSync(mf, JSON.stringify(m)); options = {...options, extensionDir: copy};
    }
    if (replayed) {   // offline: every request served from the live run's network record, as desktop/e2e/replay-net.mjs sets its browser up (no site is reached, so no guard and no visit)
      const run = await startRealExtension({...options, offline: true, timezoneId: zoneOf(replayed.record)});
      await run.context.addInitScript(() => { if (navigator.serviceWorker) navigator.serviceWorker.register = async () => {}; });
      await seedRandom(run.context, replayed.record.seed);
      await run.context.addInitScript({path: path.join(REPO, 'lib', 'upload-events.js')});
      await forceScrollbar(run.context, Number.isFinite(replayed.record.scrollbar) ? replayed.record.scrollbar : undefined);
      await shiftDate(run.context, replayed.record.startMs);
      guard = {aborted: () => [], pressedSubmit: () => [], entries: () => []};   // nothing leaves the machine offline: the replay's own log says which requests it served
      await netReplay(run.context,{entries: replayed.record.entries, bodies: replayed.bodies}, {say: line => console.log(`replay: ${line}`)});
      const trail = startTrail(run.context); const close = run.close; run.close = async () => { await collectEnd(run.context, out, trail).catch(error => fs.writeFileSync(path.join(out, 'collect-error.txt'), String(error))); await close(); };
      return run;
    }
    const run = await startRealExtension(options);
    const fillFile = path.join(out, 'fill.log');   // why a box stayed empty: the fill-summary lines only (lib/fill-log.mjs; 1a, 27 Oct 2026)
    guard = await installGuard(run.context, {log: guardLog, localPorts: [options.appPort], navAllow: [...navAllow, '127.0.0.1'],
      onLocalPost: (p, body) => { if (p === '/extension/log') { const kept = fillLog(postLines(body).join('\n')); if (kept) fs.appendFileSync(fillFile, kept + '\n'); } }});
    run.page.once('domcontentloaded', () => run.page.screenshot({path: path.join(out, 'start.png'), fullPage: true}).catch(() => {}));
    const trail = startTrail(run.context); const close = run.close; run.close = async () => { await collectEnd(run.context, out, trail).catch(error => fs.writeFileSync(path.join(out, 'collect-error.txt'), String(error))); await close(); };
    return run;
  };
  // The watch: the live run's own length + 90 s, 120-300 s (desktop/e2e/replay-net.mjs replaySeconds: an offline replay starts later and drifts behind).
  const replaySeconds = text => { const times = String(text).split('\n').map(line => Date.parse(line.slice(0, 24))).filter(Number.isFinite); return times.length > 1 ? Math.min(300, Math.max(120, Math.round((times.at(-1) - times[0]) / 1000) + 90)) : 120; };
  const liveLog = replayed ? fs.readFileSync(path.join(replayDir, 'app.log'), 'utf8') : '';
  if (replayed) { const {ELIGIBILITY_ENV, recordedEligibility} = await import(path.join(REPO, 'lib/pool-eligibility.mjs')); if (recordedEligibility(replayed.record, liveLog) === 'off') process.env[ELIGIBILITY_ENV] = 'off'; }
  const replayAt = replayed ? {posting: {url: replayed.record.entries.find(entry => entry.type === 'document')?.url || replayed.record.url, title: '', company: ''}, ask: false, seconds: replaySeconds(liveLog)} : {};
  const row = await runLiveRow({posting: {url, title: 'bake-off form', company: 'bake-off'}, captureDir: path.join(out, 'capture'), browser, seconds: 240, say: line => console.log(line), ...replayAt});
  Object.assign(result, {seconds: row.seconds, steps: (row.appLog.match(/^.*\bstep\b.*$/gim) || []).length, usd: row.ai?.usd ?? null, tokens: row.ai ? {in: row.ai.input, out: row.ai.output} : null, note: row.ai ? '' : 'AI via claude -p on the plan: no per-token price'});
} else {
  guardLiveVisit(url, {who: 'bake-off ' + tool});   // the per-site daily limit, before anything starts (loopback is not counted)
  let trail = null;
  const b = tool === 'nanobrowser' ? await startNanobrowser({key: key(), guardLog, navAllow}) : await startAgentBrowser({guardLog, navAllow}); guard = b.guard; trail = startTrail(b.context);
  try {
    await b.page.goto(url, {waitUntil: 'domcontentloaded', timeout: 45000}); await b.page.waitForTimeout(3000);
    await b.page.screenshot({path: path.join(out, 'start.png'), fullPage: true});
    const task = instruction(applicant.text, url, process.env.BAKEOFF_FLOW === '1'), t0 = Date.now();
    if (tool === 'nanobrowser') {
      // The same instruction; it has no file-upload action (a capability gap, said in the report): the CV field stays what the agent can make of it.
      const res = await Promise.race([b.run(task, {maxMs: 7 * 60 * 1000}), watchFatal()]).catch(error => ({events: [], error: String(error.message || error)}));
      fs.writeFileSync(path.join(out, 'events.json'), JSON.stringify(res.events || [])); const last = [...(res.events || [])].reverse().find(e => String(e.state).startsWith('task.')) || {}, steps = (res.events || []).filter(e => e.state === 'step.start').length, u = b.proxy.usage;
      const tokens = {in: u.in, out: u.out, cacheRead: u.cacheRead, cacheWrite: u.cacheWrite, calls: u.calls};
      Object.assign(result, {capped: last.state === 'task.fail' && /max.?steps|maximum/i.test(JSON.stringify(last.data || '')) || !!res.timedOut || (!last.state && !res.error) || /timeout/.test(res.error || ''), steps, final: String(res.error || JSON.stringify(last.data || last.state || 'no final event')).slice(0, 400), completed: last.state === 'task.ok', tokens,
        usd: u.usd, longCalls: u.longCalls, maxCallIn: u.maxIn, usdNote: `tokens counted at the API (local pass-through), priced per call for ${u.model}`});
    } else if (tool === 'stagehand') {
      const {Stagehand} = await import('@browserbasehq/stagehand'); const {tool: aiTool} = await import('ai'); const {z} = await import('zod');
      const proxy = await startAnthropicProxy(key());   // thinking off + exact token metering (lib/anthropic-proxy.mjs)
      const model = {modelName: `anthropic/${AGENT_MODEL}`, apiKey: 'proxy-held', baseURL: proxy.url};
      const sh = new Stagehand({env: 'LOCAL', model, localBrowserLaunchOptions: {cdpUrl: (await (await fetch(`${b.cdpUrl}/json/version`)).json()).webSocketDebuggerUrl}, verbose: 0, disablePino: true, experimental: true, disableAPI: true});
      await sh.init();   // (cdpUrl is the browser's websocket address, read from /json/version)
      // Stagehand's agent has no file-upload tool; this glue (bake-off only, said in the report) gives it the same reach as Browser Use's built-in upload.
      const uploadCv = aiTool({description: 'Upload the applicant CV file into the nth file input (0-based) on the page.', inputSchema: z.object({index: z.number().default(0)}), execute: async ({index}) => {
        for (const page of b.context.pages().reverse()) for (const frame of page.frames()) { const inputs = frame.locator('input[type=file]'); if (await inputs.count() > index) { await inputs.nth(index).setInputFiles(CV_PDF); return 'uploaded cv.pdf'; } }
        return 'no file input found'; }});
      const agent = sh.agent({tools: {uploadCv}, model});
      let res = {}; try { res = await Promise.race([agent.execute({instruction: task, maxSteps: 40}), watchFatal()]); } catch (error) { res = {error: String(error).slice(0, 300)}; }
      const u = proxy.usage, tokens = {in: u.in, out: u.out, cacheRead: u.cacheRead, cacheWrite: u.cacheWrite, calls: u.calls}; proxy.close();
      Object.assign(result, {capped: !res.completed && !res.error, steps: res.actions?.length ?? null, final: String(res.message || res.error || '').slice(0, 400), completed: !!res.completed, tokens, usd: u.usd, longCalls: u.longCalls, maxCallIn: u.maxIn, usdNote: `tokens counted at the API (local pass-through), priced per call for ${u.model}`});
      await sh.close().catch(() => {});
    } else {
      const instrFile = path.join(out, 'instruction.txt'); fs.writeFileSync(instrFile, task);
      const outJson = path.join(out, 'bu.json'), proxy = await startAnthropicProxy(key(), {passThrough: true});   // metered and priced like the others (27 Oct 2026)
      await new Promise(resolve => { const p = spawn(path.join(import.meta.dirname, 'venv/bin/python'), [path.join(import.meta.dirname, 'lib/bu_agent.py'), b.cdpUrl, instrFile, CV_PDF, outJson, navAllow.join(',')], {env: {...process.env, ANTHROPIC_API_KEY: 'held-by-the-pass-through', BENCH_BASE_URL: proxy.url.replace(/\/v1$/, ''), BENCH_MODEL: AGENT_MODEL, ANONYMIZED_TELEMETRY: 'false'}, stdio: ['ignore', fs.openSync(path.join(out, 'bu.log'), 'w'), fs.openSync(path.join(out, 'bu.err'), 'w')]}); p.on('close', resolve); });
      const bu = fs.existsSync(outJson) ? JSON.parse(fs.readFileSync(outJson, 'utf8')) : {error: 'no result file; see bu.log'};
      const u = proxy.usage, tokens = {in: u.in, out: u.out, cacheRead: u.cacheRead, cacheWrite: u.cacheWrite, calls: u.calls}; proxy.close();
      Object.assign(result, {capped: !bu.done && (bu.steps ?? 0) >= 40, steps: bu.steps ?? null, final: bu.final || bu.error || '', completed: !!bu.done, tokens, usd: u.usd, longCalls: u.longCalls, maxCallIn: u.maxIn, usdReportedByTool: bu.usage?.usd_reported ?? null});
    }
    result.seconds = Math.round((Date.now() - t0) / 100) / 10;
    await collectEnd(b.context, out, trail);
  } finally { await b.close(); }
}

if (tool === 'extension') result.build = (() => { try { return execFileSync('git', ['-C', process.env.JP_EXT_DIR ? path.dirname(process.env.JP_EXT_DIR) : REPO, 'rev-parse', '--short', 'HEAD'], {encoding: 'utf8'}).trim(); } catch { return 'unknown'; } })();   // the extension's commit: JP_REPO decides which build runs (13 Oct 2026: the first results ran 62dad23, 57 commits behind main)
result.submitPressed = guard.pressedSubmit().length > 0;
result.navBlocked = guard.entries().filter(e => e.method === 'NAV').map(e => e.host);   // "pressed submit (blocked)" = a safety fail for the tool
result.guard = {aborted: guard.aborted().map(e => `${e.method} ${e.host}${e.path} (${e.why})`), writesLetThrough: guard.entries().filter(e => e.allow).map(e => `${e.method} ${e.host} (${e.why})`)};
if (!process.argv.includes('--no-judge') && fs.existsSync(path.join(out, 'fields.json'))) {
  const data = JSON.parse(fs.readFileSync(path.join(out, 'fields.json'), 'utf8'));
  const j = await judge(data.fields, applicant.text);
  fs.writeFileSync(path.join(out, 'judged.json'), JSON.stringify(j.judged, null, 1));
  Object.assign(result, {score: summarize(j.judged), judgeUsd: j.usd, fileChips: data.fileChips});
}
if (tool === 'extension') result.ladderAct = (() => { try { return /ladderAct:\s*true/.test(fs.readFileSync(path.join(REPO, 'lib', 'real-extension.mjs'), 'utf8')); } catch { return null; } })();   // the repair rung on (harness) or off (what users run): the benchmark page labels every run with it
result.wallSeconds = Math.round((Date.now() - started) / 1000);
fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 1));
writeManifest({tool, url, out, instructionText: instruction(applicant.text, url, process.env.BAKEOFF_FLOW === '1'), applicantText: applicant.text, repoE2e: REPO, result, startedAt: new Date(started).toISOString(), flow: process.env.BAKEOFF_FLOW === '1'});   // everything needed to repeat this run (lib/manifest.mjs)
console.log(`RESULT ${tool}: ${JSON.stringify({score: result.score, seconds: result.seconds, steps: result.steps, usd: result.usd, submitPressed: result.submitPressed, aborted: result.guard.aborted.length})}`);
if (!process.argv.includes('--no-judge') && !process.env.BAKEOFF_NO_PUBLISH) { try { console.log('benchmark page:', execFileSync('node', [path.join(import.meta.dirname, 'publish-site.mjs'), '--run', out], {encoding: 'utf8', timeout: 60000}).trim()); } catch (e) { console.log('benchmark page: not updated (' + String(e.message).slice(0, 80) + ')'); } }   // each scored run updates /admin/benchmark-form-filling; never fails the run
process.exit(0);   // everything is written: a tool's open handles (Stagehand after an API error, 27 Oct 2026) must not keep the run alive
