# Bake-off re-run on main 935956c (15 Oct 2026)

Our extension only, one live run per form, same 6 forms, fake applicant, no Submit. Agents' numbers are their 13-14 Oct runs (not re-run). Judge spend $0.123 (extension is on the plan).

> [!WARNING]
> Single live runs are noisy (form 12 once gave 12 right, then 7 on near-identical builds). The required-field total differs a little between runs (the page and the field reader), so read 1-2 fields as noise. "By guess" is 0 for every tool: no required field the facts do not answer was filled right.

## Per form

**Form 1**

| Tool | Required right | From facts | By guess | Wrong | Required empty |
| --- | :-: | :-: | :-: | :-: | :-: |
| ours today | 5/7 | 5 | 0 | 1 | 2 |
| ours 14 Oct (9a0416d) | 5/8 | 5 | 0 | 0 | 3 |
| Stagehand | 5/7 | 5 | 0 | 0 | 2 |
| Browser Use | 4/7 | 4 | 0 | 0 | 3 |
| Nanobrowser | 5/9 | 5 | 0 | 3 | 1 |

**Form 4**

| Tool | Required right | From facts | By guess | Wrong | Required empty |
| --- | :-: | :-: | :-: | :-: | :-: |
| ours today | 10/16 | 10 | 0 | 1 | 5 |
| ours 14 Oct (9a0416d) | 4/16 | 4 | 0 | 1 | 11 |
| Stagehand | 2/16 | 2 | 0 | 0 | 14 |
| Browser Use | 11/16 | 11 | 0 | 0 | 5 |
| Nanobrowser | 10/16 | 10 | 0 | 0 | 6 |

**Form 5**

| Tool | Required right | From facts | By guess | Wrong | Required empty |
| --- | :-: | :-: | :-: | :-: | :-: |
| ours today | 6/13 | 6 | 0 | 0 | 7 |
| ours 14 Oct (9a0416d) | 6/13 | 6 | 0 | 0 | 7 |
| Stagehand | 5/13 | 5 | 0 | 0 | 8 |
| Browser Use | 3/13 | 3 | 0 | 0 | 10 |
| Nanobrowser | 3/13 | 3 | 0 | 1 | 9 |

**Form 9**

| Tool | Required right | From facts | By guess | Wrong | Required empty |
| --- | :-: | :-: | :-: | :-: | :-: |
| ours today | 5/18 | 5 | 0 | 0 | 13 |
| ours 14 Oct (9a0416d) | 6/18 | 6 | 0 | 0 | 12 |
| Stagehand | n/a | | | | |
| Browser Use | 6/18 | 6 | 0 | 0 | 12 |
| Nanobrowser | 4/18 | 4 | 0 | 0 | 14 |

**Form 11**

| Tool | Required right | From facts | By guess | Wrong | Required empty |
| --- | :-: | :-: | :-: | :-: | :-: |
| ours today | 2/7 | 2 | 0 | 0 | 5 |
| ours 14 Oct (9a0416d) | 2/7 | 2 | 0 | 0 | 5 |
| Stagehand | 1/7 | 1 | 0 | 2 | 5 |
| Browser Use | 2/7 | 2 | 0 | 0 | 5 |
| Nanobrowser | 2/7 | 2 | 0 | 0 | 5 |

**Form 13**

| Tool | Required right | From facts | By guess | Wrong | Required empty |
| --- | :-: | :-: | :-: | :-: | :-: |
| ours today | 7/17 | 7 | 0 | 3 | 7 |
| ours 14 Oct (9a0416d) | 9/18 | 9 | 0 | 0 | 9 |
| Stagehand | 7/17 | 7 | 0 | 0 | 10 |
| Browser Use | 5/17 | 5 | 0 | 1 | 11 |
| Nanobrowser | 5/17 | 5 | 0 | 2 | 10 |

## Overall (each tool over the forms it has a valid run on)

| Tool | Forms | Required right | % | From facts | By guess | Wrong | Required empty |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| ours today | 6 | 35/78 | 45% | 35 | 0 | 5 | 39 |
| ours 14 Oct (9a0416d) | 6 | 32/80 | 40% | 32 | 0 | 1 | 47 |
| Stagehand | 5 | 20/60 | 33% | 20 | 0 | 2 | 39 |
| Browser Use | 6 | 31/78 | 40% | 31 | 0 | 1 | 46 |
| Nanobrowser | 6 | 29/80 | 36% | 29 | 0 | 6 | 45 |

## What changed since 14 Oct (9a0416d -> 935956c)
- 🟢 **Hadrian (form 4): 4/16 -> 10/16.** The combobox stall fix (#690) holds live: late answers now land. Now 1 field behind Browser Use (11).
- 🔴 **Urrly (form 13): 9/18, 0 wrong -> 7/17, 3 wrong.** All 3 wrong are yes/no radios now typed as guesses (#688): "Based in Texas? Yes" (we live in Zurich), "Built backend services? No", "Live coding? No" (not in the facts).
- 🔴 **Lever (form 1): 1 wrong** (invents London as the office city in a free-text confirm); Hadrian 1 wrong (address box left as "Mus").
- 🟡 Nebius (form 9) 6 -> 5 of 18, Tether and epilot unchanged.
- Where we still lose: 39 required fields left empty over the 6 forms (Nebius 13 of 18), and we are the most wrong-prone since #688: 5 wrong vs 1 on 14 Oct. Ahead of the agents on count (45% vs 33-40%) but not on wrongs (Browser Use 1, Stagehand 2).

## Corrections after the follow-up (15 Oct 2026, evening)
- **Lever "London" is right, not invented:** the posting's location is London and the answer came from the saved relocation fact (owner decision: a knockout answered from a saved fact is typed). Judge false positive: ours today = **4 wrong, not 5**.
- **urrly's 3 wrong are a test-only bug:** the harness turns the repair rung on (`ladderAct`), real users did not have it at the time; the repair clicked the unchosen option of three yes/no radios. Fixed in jobadabra PR #866; offline replay of the same record: 7/17 + 3 wrong -> 11/18 + 0 wrong.
- **Hadrian "Mus":** not a product bug: the page's own handler clears the box and it ends empty on the real page; the bake-off's trail kept the latest non-empty value (fixed in the bake-off repo by the empty-fields session). Real-user wrong answers on these 6 forms: 0.
- **Mode:** every number here ran with the repair rung ON (harness). Owner decision 15 Oct 2026: repair for real users too (jobadabra PR "The repair rung acts for every user"), so this is the user mode from then on. Repairs made on these 6 forms: 4 retypes (none held), 3 toggles (all harmful, now refused).
- Same-form numbers with Lever corrected: ours today 35/78, 4 wrong; with the urrly replay fix 39/79 (49%), 0 wrong.
