# 🧪 QA guide: use the bake-off to catch regressions in the extension

The benchmark's forms, scorer and safety net double as a **regression test for the extension**. Run any build of the extension on the same forms, compare with a **baseline**, and get a per-form verdict: 🟢 same or better, 🔻 regression, 🆕 no baseline yet.

> [!IMPORTANT]
> **Never test with the primary checkout** (`~/jobadabra`, the owner's live app runs from it). QA always makes its own **worktree at one commit** (`~/jobadabra/.claude/worktrees/bakeoff-at-<sha>`), so "which build" is always an exact commit, and every result records it.

---

## ⚡ Quick start (3 commands)

```bash
git -C ~/jobadabra fetch origin                       # 1. get the latest commits (never pull in the primary checkout)
node qa.mjs run --build origin/main                     # 2. latest main on the QA forms, then the comparison with the baseline
node qa.mjs fields 4 extension extension-b<sha>         # 3. if a form regressed: which fields changed (use the short sha printed in step 2)
```

Step 2 prints a table and exits **1 if any form regressed**, **0** otherwise:

```
| # | Form | Baseline | Now | Verdict |
| 1 | Lever (jobs.lever.co)        | 4/7, 1 wrong (62dad23) | 5/8, 0 wrong (9a0416d) | 🟢 better |
| 4 | Teamtailor (careers.hadrian.io) | 9/16, 0 wrong (62dad23) | 4/16, 1 wrong (9a0416d) | 🔻 REGRESSION |
🔻 1 form(s) regressed over 5 forms.
```

---

## 🧭 How it works

| Piece | What it is |
| --- | --- |
| **Forms** | `forms.json`, `forms-fresh.json`: public no-login forms, one per host. Default QA set: forms **1, 4, 5, 11, 13** (`--forms` to change). |
| **Build** | An exact commit of the Jobadabra repo. `--build` takes a sha, a branch, `origin/main`, or a PR head (`git fetch origin pull/123/head`, then `--build FETCH_HEAD`). |
| **Run** | The extension on the form in a fresh headless browser, **fake applicant**, never Submit (every write is aborted by the guard). Uses the plan (`claude -p`): no per-token cost. |
| **Score** | One field reader + a judge (Sonnet 5.5, ~$0.015 a form) → required fields right / total, wrong values. |
| **Baseline** | `qa/baseline.json`: the per-form scores of a build we accepted (now: the old build `62dad23`). |
| **Regression** | required right drops by **2 or more**, or by **15 points** of its share, or a **new wrong value** appears. |

---

## 📖 Recipes

### 1. Test a specific build of the extension

```bash
node qa.mjs run --build 9a0416d                  # a commit
node qa.mjs run --build origin/main              # latest main (fetch first)
node qa.mjs run --build my-branch --forms 4,5    # a branch, only some forms
```

Results land in `out/<form>/extension-b<sha>/` (`result.json`, `judged.json`, `fields.json`, `manifest.json`, screenshots, the page captures).

### 2. Compare with the baseline

```bash
node qa.mjs compare --tool extension-b9a0416d
```

### 3. Compare two builds head to head (no baseline file)

```bash
node qa.mjs run --build 62dad23
node qa.mjs run --build 9a0416d
node qa.mjs compare --tool extension-b9a0416d --against extension-b62dad23
```

### 4. See exactly which fields changed

```bash
node qa.mjs fields 4 extension-b62dad23 extension-b9a0416d
```

Example (Hadrian, the regression found on 14 Oct 2026): the old build filled *Where are you based*, *LinkedIn URL* and three experience answers; main left them empty and put a street value in *Address*.

### 4b. Find the commit that caused it (bisect)

```bash
node qa.mjs bisect --good 62dad23 --bad 9a0416d --form 4
```

It binary-searches the commits that touch `extension/` between the two builds (about 4 steps for 11 commits), one **site visit** per step. If the day's visits are used it stops cleanly and prints how to resume (steps already done are kept).

### 4c. Bisect on a local fixture (no site visit, no daily limit)

When a live form regressed, **reproduce the failure shape on a tiny local page** and bisect there (about 90 s a step, as often as you like):

```bash
node fixture/serve.mjs                       # prints the fixture's address; pages: /combo (suggest-only address box), /wizard (5 steps), / (plain form)
export JP_REPO=~/jobadabra/.claude/worktrees/<a worktree on recent main>/desktop/e2e   # the harness; only the extension under test varies
node qa.mjs localbisect --good 62dad23 --bad 9a0416d --url http://127.0.0.1:<port>/combo --runs 3   # timing bugs: 3 runs per build
```

A step is *good* when the question fields were typed. The command first checks that the fixture really separates the two builds; if not, it says so and stops (the fixture does not reproduce your bug: change the fixture, not the verdict).

### 5. Accept a build as the new baseline

```bash
node qa.mjs baseline --tool extension-b9a0416d
git add qa/baseline.json && git commit -m "Baseline: main 9a0416d"
```

Only do this after the owner accepted the build; the baseline is data, not a promise.

### 6. Repeat one recorded run (same inputs), maybe on another build

```bash
node rerun.mjs 4 extension --build 62dad23       # Hadrian again, on the old build
node rerun.mjs 13 stagehand                       # an agent again
```

It reads the run's `manifest.json` (URL, tool + version, flags, instruction, extension commit) and writes `out/<form>/<tool>-rerun-<n>/`. Runs from before 14 Oct 2026 have a *backfilled* manifest (it says what is unknown).

### 7. An exact repeat, offline (no site visit)

`results/captures/<run>.tar.gz` holds the page snapshots the extension saw. With the Jobadabra repo's replay tool:

```bash
tar -xzf results/captures/form-4__extension-main.tar.gz -C /tmp/hadrian-capture
cd ~/jobadabra/.claude/worktrees/<a worktree>/desktop/e2e
node row.mjs /tmp/hadrian-capture                              # the build in this worktree
node row.mjs /tmp/hadrian-capture --old <other extension dir>  # another build on the same page
```

It shows time, number of AI asks and where the run ended, but **not** the filled values; for field accuracy use a live run (recipe 1).

### Recipe: record once, replay a form offline (14 Oct 2026, ⚠️ not yet trusted for build-to-build verdicts)
- Every live extension run now keeps the form's network record in `<out>/net/<name>-<ts>/` (the repo's `desktop/e2e/lib/net-record.mjs`). Local only: real site responses, never published (`publish-data.mjs` copies named files only).
- Replay it, with fields read and judged like a live run:
  `BAKEOFF_REPLAY=<out>/net/<dir> JP_REPO=<worktree>/desktop/e2e node run.mjs extension <form url> <new out dir>`
- Offline: no site reached, no ledger visit; the AI answers only from the live run's kept answers (a new build that asks something new = "not in the row's kept answers" in its app.log: needs a fresh live record).
- Proof so far: form 12 (Breezy), same build e6ede59: replay = live on all 23 fields, 7/7 asks hit. Not proven: other forms, a different build on an old record, catching a known regression.

---

## 🧑‍⚖️ Reading the verdict

| Verdict | Meaning | What to do |
| --- | --- | --- |
| 🟢 same / better | within the rule | nothing |
| 🔻 REGRESSION | worse than the baseline by the rule | **repeat once** (recipe 6) before concluding: agents and pages vary; then `fields` + `bisect` |
| 🆕 no baseline | the form has no baseline yet | freeze one (recipe 5) once the build is accepted |

A regression that reproduces on a second run is a real finding: send the form, the two builds, the `fields` table and the log lines (`out/<form>/<tool>/capture/app.log`) to the fixer.

---

## 💸 Cost, limits, safety

| | |
| --- | --- |
| **Cost** | plan + judge ≈ **$0.015 a form** → a 5-form pass ≈ $0.08. Agents are not part of QA. |
| **Time** | ~2 min a form, one form at a time, headless. |
| **Site limit** | **3 visits per host per day** (a machine-wide ledger). A QA pass is 1 visit per host; a repeat or a bisect step is another. Never override it. |
| **Safety** | the guard aborts every write to the form site (so nothing is submitted); fake applicant; no login/captcha; never the owner's browser or data; a privacy scan runs before anything is published. |
| **Needs** | Keychain `jobadabra.anthropic.e2e_key` (judge), `~/jobadabra` repo (to make worktrees), Node + the packages in `package.json`. |

---

## ⚠️ Known limits (read before trusting a verdict)

- **Live sites change**: a posting can close (the form disappears) or a field can be added. If a form's field count changes, compare `fields` before blaming the build.
- **The guard blocks harmless writes** (a page's address autocomplete, the CV presign request): this breaks some page features for every build. `BAKEOFF_READPOSTS=1` lets read-like requests through for a diagnosis run; keep it off for baselines so numbers stay comparable.
- **Run-to-run variance**: the extension's AI steps vary; one run is one sample. Repeat a regression once.
- **Required flags**: some forms (German Personio) show no required markers to the reader, so they cannot be compared on required fields and are skipped.
- **Counts are per control**: a question with several controls counts several times, the same for every build.

---

## 🎓 Learnings: how to validate quickly and not fool yourself

These come from the first day of using this as a QA (14 Oct 2026); each cost us time once.

**1. Prove which build ran, every time.**
Our first "main build" runs were not main: the runner's repo path was hard-coded, so they ran the primary checkout. The `build` field in `result.json` / `manifest.json` showed it. After any batch run, list the builds that actually ran and check there is exactly the sha you meant:

```bash
cat out/*/extension-b*/result.json | grep '"build"' | sort | uniq -c
```

Never test from the owner's primary checkout; use `qa.mjs run --build …` (its own worktree at one commit).

**2. Two kinds of test, use both.**

| | Live QA (`qa.mjs run`) | Local fixture (`fixture/*`, `localbisect`) |
| --- | --- | --- |
| Truth | the real site, the real page scripts | a look-alike of one failure shape |
| Limits | 3 visits per host per day, pages change or close | none |
| Speed | ~2 min a form | ~90 s a step, unlimited |
| Use it to | **detect** a regression | **explain** it and find the commit |

Detect live, explain locally. A regression found live is only a finding until a local fixture reproduces it.

**3. Triage a regression in this order (cheapest first).**
1. `qa.mjs compare`: which forms, how big?
2. **Repeat once** on the same build: is it stable? (agents and pages vary)
3. `BAKEOFF_READPOSTS=1` diagnosis run: is it only our guard blocking harmless writes (address autocomplete, upload presign)? If the stall remains, it is the build.
4. `qa.mjs fields <form> <old> <new>`: the exact fields that differ (here: five answers not typed + one wrong street value).
5. Read the two `app.log`s side by side, from the line where they diverge (here: after `Claude answered N of M` the old build logs `a menu showed no choice that matched`, the new one is silent for 40 s, then `dead end: silent`). **The first silent point names the code path.**
6. Reproduce that path on a local fixture, then `localbisect`.
7. Report with: the two builds, the fields table, both log lines, the first bad commit. No fix from QA.

**4. Compare like with like.** Totals over *different* forms mislead (a tool that skipped the hard form looks better). The scoreboard now ranks only on the forms **every** tool ran. Per-form tables show the rest.

**5. Know what you are timing.** The harness waits ~50 s after the last change before it stops; the extension's own working time is from the form opening to its last fill line (`lib/activetime.mjs`). Agents return when done. Never compare the first with the second.

**6. Guard artifacts exist.** The write guard aborts *every* write to the form site, so a page's harmless POSTs (address suggestions, CV presign) fail for every tool and can break page features. Look at `guard.jsonl` when one form drops suddenly; use the diagnosis switch to separate artifact from regression, but keep it off for baselines.

**7. Runs are cheap to corrupt; keep them clean.**
- Kill leftover processes **by PID**: an orphaned old run can finish later and overwrite the new run's result folder. Check `pgrep -fl "^node (batch|run).mjs"` before starting a batch.
- An API usage-limit or credit error mid-run makes the result INVALID (marked `INVALID.txt`, never counted): do not read it as a tool failure.
- A crash handler must never be silent: stacks go to `run.log`.
- Write the manifest (`manifest.json`) for every run so any run can be repeated on any build (`rerun.mjs`).

**8. Make the fixture earn its keep.** Build a fixture only after you know the shape (from the logs and screenshots). Keep it tiny, give it labels a real form would have, and make the *broken* behaviour the only difference (here: an address box whose suggestion list never opens). Then the two builds either separate or they do not; if they do not, the fixture is wrong, not the verdict.

**9. Before you trust a verdict:** build field correct · one process only · no INVALID marker · same forms compared · regression repeated once · the guard not the cause.

**10. Timing bugs need repeats, not one run per build.** The Hadrian stall shows only when Claude's answers arrive after the fill has started, and mostly on a busy machine: main passed 2 of 3 runs on the same page. A single-run bisect would have blamed the wrong commit or none. Rules: a build is *bad* if any run loses the answers, *good* only after N clean runs that include the trigger (late answers); `localbisect` does this (`--runs 3`, the default), and `flaky-probe.mjs <url> <runs> <sha>…` counts failures per build. Make the trigger deterministic when you can (the offline replay's late-answer pad: `JOBADABRA_MODEL_MEMO_LATENCY_PAD_MS`).

**11. Old commits lack today's harness.** An old commit's `desktop/e2e` misses files the runner needs (`applicant-seed.mjs` did not exist at `62dad23`). Keep the harness on a recent worktree (`JP_REPO`) and swap only the extension under test (`JP_EXT_DIR=<worktree at the old commit>/extension`). Worktrees made by `qa.mjs` are named with 8 characters of the sha (`bakeoff-at-62dad235`): use the path the tool prints, never type it.

**12. Read facts from `origin/main`, not from the owner's checkout.** The primary checkout is the owner's live app and lags main (57 commits on 14 Oct). A comparison built from its files (workflows, replay features) was wrong on four rows. `git fetch` then `git show origin/main:<file>`.

**13. Check the standing rules before proposing a check.** A proposed scheduled live check broke the owner's rule "live site visits by hand only, never scheduled". Read the rule files (and the coordinator's notes) first.

### 🛡️ Preventing this class of bug (what the Hadrian hunt taught)

- **Late answers by default** in replays and fixtures: a build that only works when the AI answers first passes every instant-answer test.
- **Fail on silence:** a "dead end: silent" (no progress for ~40 s mid-fill) should fail a test run, not just be logged.
- **Score values, not "no crash":** here nothing errored, the answers were simply never typed; expected values per field make that a failure.
- **Repeat timing-sensitive cases** (or run them in a deliberately slow mode).
- **Safety switches are flow-core changes:** the Stop button (`5afa5a8`) touched `flow.js`, `read-gen.js` and the debugger attach; changes like that get the full replay with late answers before merging.
- **Before a release:** `qa.mjs compare` against the baseline, by hand.

---

## ➕ Adding a form to the QA set

1. Pick a public, no-login application form (the form URL itself, not the posting) on a host not already in the set.
2. Add it to `forms-fresh.json`: `{"id": 14, "platform": "…", "host": "…", "url": "…"}`.
3. Run the baseline build on it, check the field reader found the required fields (`fields.json`), then freeze the baseline.

---

## 🗂️ Where things are

`qa.mjs` the QA commands (baseline, compare, fields, bisect, localbisect, run) · `rerun.mjs` repeat a run · `batch.mjs` / `run.mjs` the runners · `report.mjs` the scoreboard · `publish-data.mjs` publish every run · `qa/baseline.json` the baseline · `results/` every run published (manifests, per-field verdicts, screenshots, page captures) · `ITERATIONS.md` how the benchmark was built.
