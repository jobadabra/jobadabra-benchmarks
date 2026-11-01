# Local profiles round, 2026-11-01

> **Verdict:** 1 of 20 new fictional profiles passed (Ljubljana welder, 6 of 6). 16 are below target, 3 could not be measured. Our first-jobs step found 55 relevant local jobs where the public EURES portal lists 341 for the same profiles; 21 are shared. Engine build `d500c1b`.

**Not the scoreboard.** The benchmark's own rule is that a local run is a side note (`CLAUDE.md`). This folder exists so a later round can be compared with this one (`python3 tools/compare.py <old folder> <new folder>`).

## What was measured
| Item | Meaning |
|---|---|
| **X** | Unique (title + employer) jobs that are the right role AND in the right place, found by EURES (public EU portal, no login, first 100 in-region matches) or by our search. A floor. |
| **N** | The same count, our search only. |
| **Pass** | N ≥ X, and only when the independent EURES count is ≥ 1. X of 0 is "not measured", never a pass. |
| Place | That city or its region, or remote within its country. Never worldwide remote. |
| Judge | `search-bench/judge.py`, `BENCH_JUDGE_ENGINE=plan` (Claude Sonnet on the plan, $0 API), blind to the source. |
| Search | `tools/persona-search/run.mjs draw --presses 1 --fresh --first-only`, Claude plan, one at a time, throwaway install. |

## Table (batch 2, 20 candidates tried; cap was 10 passing or 20 tried)
| # | City · role | N | X | Verdict |
|---|---|--:|--:|---|
| c01 | Amsterdam · Accountant | 1 | 26 | below |
| c02 | Vienna · Sales Representative | 11 | 82 | below |
| c03 | Lyon · Registered Nurse | 5 | 9 | below |
| c04 | Madrid · Electrician | 2 | 63 | below |
| c05 | Milan · Civil Engineer | 2 | 8 | below |
| c06 | Prague · Car Mechanic | 5 | 14 | below |
| c07 | Copenhagen · Secondary School Teacher | 0 | 5 | below (0 jobs listed) |
| c08 | Oslo · Pharmacist | 0 | 4 | below |
| c09 | Tallinn · Hotel Receptionist | – | – | not measured (no EURES rows) |
| c10 | Ljubljana · Welder | 6 | 6 | **pass** |
| c11 | Bratislava · Registered Nurse | 4 | 6 | below |
| c12 | Graz · Electrician | 19 | 56 | below |
| c13 | Brno · Pharmacist | 0 | 1 | below |
| c14 | Bologna · Accountant | 0 | 4 | below |
| c15 | Valencia · Secondary School Teacher | 0 | 3 | below (0 jobs listed) |
| c16 | Toulouse · Sales Representative | 0 | 10 | below (0 jobs listed) |
| c17 | Rotterdam · Civil Engineer | – | – | not measured (no EURES rows) |
| c18 | Seville · Car Mechanic | 0 | 5 | below |
| c19 | Paris · Hotel Receptionist | 0 | 73 | below (0 jobs listed) |
| c20 | Naples · Welder | 0 | – | not measured (EURES rows, none relevant) |

Batch 1 (the 10 benchmark personas, from rounds 2026-10-31 and 2026-10-27, no new runs): 17 of 285 relevant local jobs, 0 of 10 meet target.

## Caveats
- `--first-only` skips the light run and the scout: N is a floor for a full press (~20 min).
- EURES has no place code for Estonia, Lithuania, Luxembourg, Ireland, Hungary, Greece (Latvia is tiny); Rotterdam returned 0 of 500. Those candidates need another public no-login board counted by hand.
- Of 285 pooled benchmark jobs, 158 sit only behind a LinkedIn or Indeed login and were never read (GitHub #2915).
- Replacement candidates reuse some countries; the rule was a role family and city not yet on the board.
- X depends on which public boards the independent count reads. A pass means "found what EURES found", not "found every job".

## Findings filed (GitHub, label `search`)
#2918 four searches listed no job · #2919 7% of listed jobs match the role · #2920 21 of 341 EURES-relevant jobs found · #2915 login wall · #2901 CI persona gate judges 0 jobs.

## Files
- `summary.json`: one row per candidate (N, X, overlap, seconds, verdict) plus the method.
- `candidates/<id>.json`: candidate, result, every judged job (title, employer, place only; no posting texts, no URLs, no personal data).
- `tools/`: `xcount.py` (EURES count), `xjudge_all.sh` + `judgex.py` (judge X), `pipe.py` + `driver.py` (the live search, one at a time), `score.py`, `compare.py`, `cands.json`.

## Re-run
Set `JP_REPO` to a worktree of the engine (never switch it mid-run) and `JS_WORK` to a scratch folder. Run `xcount.py`, `./xjudge_all.sh <ids>`, `python3 driver.py <ids>`, `python3 score.py <ids>`. Keep a private copy of `claude` on PATH (`pinbin/claude`): Claude Code's auto-update replaces the global binary for ~10 s and kills a run (seen four times on 2026-11-01). Skill: `fictional-candidate-runs` in the jobadabra repo.
