# jobadabra-benchmarks: rules

Two benchmarks in one repo (owner, 27 Oct 2026): form filling at the root (`run.mjs`, `judge-blind.mjs`), job search in `search-bench/`.
Public page: jobadabra.top/benchmark (site repo `jobadabra-web`); the full runs stay on /admin.

- **The fair round is the one score every filling fix is judged by** (owner via 6e, 27 Oct 2026: "Yes: fixed set + weekly new set"):
  - **Fixed set:** the 6 forms of run 40440347913 (`forms-objective.json`). A fix is measured before/after on it, by hand on CI
    (ours alone, 3 runs, ~$0.08); it counts only if the fair score moves. Rivals' scores on it stay frozen from that day: `rounds/fixed/`
    (their judged runs and verdicts); the judge reuses those verdicts and asks only for new answers (`lib/verdict-cache.mjs`).
    `publish=fixed` puts the new runs in place of the same tool's; a side check of an OLDER build stays unpublished (the page shows ours' newest).
  - **Weekly new set** (owner, 27 Oct 2026: "All 4, 1 repeat"): 6 unseen forms drawn each week on a CI schedule, all 4 tools, one run each
    (~$0.77, ~$3.30/month under the Benchmarks key's $5 limit); same rules (never a company we tested or fixed on, nor an earlier set).
    `form-weekly.yml` (Monday 06:00 UTC): `tools/excluded.sh` + earlier weeks on the tag `weekly-picks`, ids YYWW*100+1.., then the form round.
  - **Regression check every 3 days** (owner, 27 Oct 2026, via 5b: "Weekly, ours only (Recommended)", then "I wan you to change CI job from
    weekly to every 3 days"; in 4e's window: "Both (Recommended)"): ours alone on the fixed set x3 (~$0.08, ~$0.82 a month), published as `fixed`;
    its note compares with "the previous run". A daily cron and a `when` job on days since 1970 mod 3 (cron's */3 restarts each month).
    A full round with rivals on the fixed set stays by hand.
  - **Each weekly round ends with one Telegram note** (owner: "It should send to telegram, as notification the results, and compare with a
    baseline"): ours per form vs `rounds/fixed/baseline.json` (the by-hand round of 27 Oct: ours 97%, Browser Use 87.3%) and the previous note
    (tag `weekly-picks`, notes/). Scores and counts only, never an answer or a fact. Bot: the Engineering bot, secrets CI_ALERTS_TELEGRAM_BOT_TOKEN / _CHAT_ID (owner, 12 Nov 2026: "let's move to Engineering"); both notes are Telegram HTML (`lib/telegram.mjs`), and a missing secret fails the step, never a fall back to the old BENCH_TELEGRAM_* (those can be deleted). Both notes go through the owner's Notifications switchboard first (events `form-benchmark-note`, `search-benchmark-note`; secret SELFHEAL_PUBLISH_KEY, the site's key, not BENCHMARK_PUBLISH_KEY; owner, 13 Nov 2026: "move all the messages from CI alerts"); the Engineering bot above is only the fail-open fallback.
  - Every round publishes its own scores to /admin as its last step. One score line per run: right / wrong / empty-but-answerable /
    not reached (`score-round.mjs`). A page's leftover copy of a field (an empty file box beside the uploaded CV, an empty box named like a
    filled one) is no miss, for every tool (`markTwins`, lib/holds.mjs). Each run folder of ours keeps `fill.log`: why a box stayed empty,
    the fill-summary lines only, never a value (lib/fill-log.mjs; the artifacts are public).
  - **The judge sees the job** (owner, 27 Oct 2026: "Show title + company"): each posting's title, company and place, the same for every
    tool (`--forms`); an answer may draw on the job, every claim about the applicant must be in the facts. A new judge rule applies to
    answers judged from then on: never re-judge old verdicts (it moved scores by judge noise, 27 Oct 2026).
- **Search round every 3 days** (owner, 27 Oct 2026: "I want job search benchmarks to run on the CI and me getting telegram notifications";
  "not weekly, but every 3 days"): `search-round.yml` (07:00 UTC) calls `search-ours.yml` (main, 1 search per persona) and `search-rivals.yml`
  (JobSpy, EURES, Adzuna), judges on the plan (`judge.py`), publishes (`publish.mjs`) and sends one Telegram note (`search-bench/note.mjs`:
  ours per persona vs the previous run and `search-bench/results/2026-10-27`). A failed job is named in the note, never shown as 0.
  career-ops stays by hand. $0 (plan only).
- **Otherwise by hand only, rarely** (owner, 27 Oct 2026: "trigger them manually, from time to time. Maybe once in a half a year"): every
  other workflow starts on `workflow_dispatch` (or is called by one) and nothing else. Guard: `test/workflows.test.mjs`. Exception: the org's PR checks
  (`pr-checks.yml`, the PR-description check and "All checks passed"; owner, 2 Nov 2026: the same workflow on every repo) start on `pull_request` and hold no secret.
- **Cost:** a whole round (both benchmarks) costs at most ~$3, or $0 (owner, 27 Oct 2026). Every tool on one model (`BENCH_MODEL`,
  Haiku 5.5 in the objective round); judges on the Claude plan. Measure a one-form trial before a full round.
- **Fair:** forms drawn by seed (`pick-forms.mjs`) from a list we did not make, minus every company we tested or fixed on; all tools the
  same day, 3 runs each (the weekly set: 1); the judge never sees the tool (`judge-blind.mjs`), a correction applies to the same answer for every tool.
  - **Honest draft = right** (owner via 5b, 27 Oct 2026: "Honest draft = right (Recommended)"): for a question the facts don't answer, a value
    is right when every claim is a stated fact (an openly hedged "the closest I can point to is <fact>" counts), wrong when it claims more or
    holds a drafting note ("Add: ..."); empty stays right. Each answer judged on its own, never against the pool.
  - **Judge prompt: a fixed case set** (`judge-cases.json`): a PROMPT change adds its case and replays all of them,
    `node judge-blind.mjs --cases judge-cases.json` ($0), before its PR. A verdict the big batch gets wrong goes to `rounds/fixed/corrections.json`.
  - **Same place, same AI for every contestant** (owner, 27 Oct 2026: "If using locally, then locally ours and theirs. If using CI, then CI
    ours and theirs. If using Haiku then haiku ours and theirs"): both rounds on CI, every AI contestant on Haiku 5.5 (form round: the
    Benchmarks API key; search round: the owner's plan token). No extra "as shipped" row. A local run is a side note, never the scoreboard.
    Guarded by test/workflows.test.mjs.
  - **A re-run is the whole round, same day** (27 Oct 2026): when ours must run again (a known bug fixed after the round), re-run
    every contestant of that round the same day; never one contestant alone. The earlier result stays as a labelled "before" row.
- **Safe:** never submit a live form (the guard in `lib/guard.mjs`), fake applicant only, no captcha or login wall. The Mac allows 3 visits
  a site a day (the product's site ledger): a full round runs on CI with its own one-day limit (owner's yes, 27 Oct 2026).
- **Keys:** create the API keys a benchmark needs yourself, in Claude in Chrome (owner, 27 Oct 2026), inside an account the owner is already
  signed into; a new sign-up, a password or a payment stays his. The value goes straight to the Keychain and a GitHub secret here, never
  into a message, log, file or PR.
  - How (27 Oct 2026): a key's own Copy button (or a hidden selected textarea + cmd+c) → `pbpaste` → Keychain + `gh secret set` from stdin,
    then clear the clipboard. A CLI that prints a token (`claude setup-token`) runs in a pty writing to a 600 file; read back only status
    lines, never the lines around the token: terminals wrap it, and a mask on one line printed its tail once. Wipe the file after.
  - Which: the agents' API calls use the Benchmarks workspace key ($5/month limit; owner: "a separate API Key for the benchmarks");
    the search round (ours and career-ops' docs run) uses the owner's plan token; in career-ops' run only Claude Code sees it (its scripts
    run as another Linux user; test/workflows).
    The plan token stays a GitHub secret for the scheduled rounds (owner, 27 Oct 2026: "Keep the plan token", "Keep it standing"); revoke it only if it leaks
    (claude.ai → Settings → Claude Code). It expires 27 Oct 2027.
- Tests: `node --test test/<file>.test.mjs`, one file at a time on the Mac.
- Watch a round: Monitor on `tools/watch-runs.sh <run id>...` (ends, failed jobs and steps, gh errors). Pass `product_ref` as a
  commit or a branch: the workflow resolves it once (`build` job), so a merge mid-round cannot break or split it.
