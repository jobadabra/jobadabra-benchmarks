# Local profiles round, 2026-11-01

> **Verdict:** 1 of 20 new fictional profiles passed (Ljubljana welder, 6 of 6). 16 are below target, 3 could not be measured. Our first-jobs step found 55 relevant local jobs where the public EURES portal lists 268 for the same profiles; 13 are shared. Engine build `d500c1b`.
>
> **Recount (2 Nov 2026, Gitar on #12):** the first X counted EURES jobs in each city's NUTS-2 region and labelled every row with the candidate's region name, so Annecy and Grenoble read as Lyon and Portoroz as Ljubljana. X was recounted on the city's own NUTS-3 area, each row labelled from its own codes (341 → 268 EURES-relevant jobs; shared 21 → 13). The pass count did not move (1 of 20); Brno (no EURES job in its area) became "not measured" and Naples (1 relevant job) became "below". N is unchanged.

**Not the scoreboard.** The benchmark's own rule is that a local run is a side note (`CLAUDE.md`). This folder exists so a later round can be compared with this one (`python3 tools/compare.py <old folder> <new folder>`).

## What was measured
| Item | Meaning |
|---|---|
| **X** | Unique (title + employer) jobs that are the right role AND in the right place, found by EURES (public EU portal, no login, first 100 matches inside the city's own NUTS-3 area, each row labelled from its own codes) or by our search. A floor. |
| **N** | The same count, our search only. |
| **Pass** | N ≥ X, and only when the independent EURES count is ≥ 1. X of 0 is "not measured", never a pass. |
| Place | That city or its region, or remote within its country. Never worldwide remote. |
| Judge | `search-bench/judge.py`, `BENCH_JUDGE_ENGINE=plan` (Claude Sonnet on the plan, $0 API), blind to the source. |
| Search | `tools/persona-search/run.mjs draw --presses 1 --fresh --first-only`, Claude plan, one at a time, throwaway install. |

## Table (batch 2, 20 candidates tried; cap was 10 passing or 20 tried)
| # | City · role | N | X | Verdict |
|---|---|--:|--:|---|
| c01 | Amsterdam · Accountant | 1 | 18 | below |
| c02 | Vienna · Sales Representative | 11 | 88 | below |
| c03 | Lyon · Registered Nurse | 5 | 8 | below |
| c04 | Madrid · Electrician | 2 | 63 | below |
| c05 | Milan · Civil Engineer | 2 | 6 | below |
| c06 | Prague · Car Mechanic | 5 | 14 | below |
| c07 | Copenhagen · Secondary School Teacher | 0 | 4 | below (0 jobs listed) |
| c08 | Oslo · Pharmacist | 0 | 1 | below |
| c09 | Tallinn · Hotel Receptionist | – | – | not measured (no EURES rows) |
| c10 | Ljubljana · Welder | 6 | 6 | **pass** |
| c11 | Bratislava · Registered Nurse | 4 | 6 | below |
| c12 | Graz · Electrician | 19 | 38 | below |
| c13 | Brno · Pharmacist | 0 | – | not measured (no EURES rows in the city's area) |
| c14 | Bologna · Accountant | 0 | 2 | below |
| c15 | Valencia · Secondary School Teacher | 0 | 3 | below (0 jobs listed) |
| c16 | Toulouse · Sales Representative | 0 | 6 | below (0 jobs listed) |
| c17 | Rotterdam · Civil Engineer | – | – | not measured (no EURES rows) |
| c18 | Seville · Car Mechanic | 0 | 4 | below |
| c19 | Paris · Hotel Receptionist | 0 | 42 | below (0 jobs listed) |
| c20 | Naples · Welder | 0 | 1 | below |

Batch 1 (the 10 benchmark personas, from rounds 2026-10-31 and 2026-10-27, no new runs): 17 of 285 relevant local jobs, 0 of 10 meet target.

## Caveats
- `--first-only` skips the light run and the scout: N is a floor for a full press (~20 min).
- EURES has no place code for Estonia, Lithuania, Luxembourg, Ireland, Hungary, Greece (Latvia is tiny); Rotterdam returned 0 of 500. Those candidates need another public no-login board counted by hand.
- Of 285 pooled benchmark jobs, 158 sit only behind a LinkedIn or Indeed login and were never read (GitHub #2915).
- Replacement candidates reuse some countries; the rule was a role family and city not yet on the board.
- X depends on which public boards the independent count reads. A pass means "found what EURES found", not "found every job".
- The judge is not deterministic: the same Vienna rows judged 71 relevant before the recount and 77 after, with only the place label changed (X 82 → 88, the one candidate whose X rose). Read X to within a few jobs.
- EURES's place filter takes a country or a large region; the area (NUTS-3) is applied to the first 500 best matches it returns, so a small area (Oslo 2, Bologna 3) is a floor.

## Findings filed (GitHub, label `search`)
#2918 four searches listed no job · #2919 7% of listed jobs match the role · #2920 21 of 341 EURES-relevant jobs found (recounted on the NUTS-3 area: 13 of 268) · #2915 login wall · #2901 CI persona gate judges 0 jobs.

## Files
- `summary.json`: one row per candidate (N, X, overlap, seconds, verdict) plus the method.
- `candidates/<id>.json`: candidate, result, every judged job (title, employer, place only; no posting texts, no URLs, no personal data).
- `tools/`: `xcount.py` (EURES count), `xjudge_all.sh` + `judgex.py` (judge X), `pipe.py` + `driver.py` (the live search, one at a time), `score.py`, `compare.py`, `cands.json`.

## Re-run
Set `JP_REPO` to a worktree of the engine (never switch it mid-run) and `JS_WORK` to a scratch folder. Run `xcount.py`, `./xjudge_all.sh <ids>`, `python3 driver.py <ids>`, `python3 score.py <ids>`. Keep a private copy of `claude` on PATH (`pinbin/claude`): Claude Code's auto-update replaces the global binary for ~10 s and kills a run (seen four times on 2026-11-01). Skill: `fictional-candidate-runs` in the jobadabra repo.
