# Tuning log — first-timer line, Cartographer's Table, final review

A checkpointed progress log for the last, time-boxed tuning lane. Every
experiment is recorded here (change, command, numbers, keep/revert) and
committed immediately, so a lost container loses at most one experiment.

Base: `claude/game-review-improvement-plan-qcepke` @ 7e1c084
("Merge portrait battlefields").

## Goals

1. **Step 0** — `FW_SECTIONS=…` filter in `balance/report.ts` for fast iteration
   (filtered runs never overwrite `balance/REPORT.md`; unfiltered output
   byte-identical).
2. **Step 1** — §11 first-timer line (the shipped `specials` heuristic) 14% →
   ~20%, keeping §6 inside 45–60% (59% now) and every invariant green; then gate
   the first-timer line at 15–35%.
3. **Step 2** — §12 Cartographer's Table: −6pt on battles-first at n=210,
   −3.5 ±4.2 at n=600. Fix at the design level so "no hub purchase lowers win
   rate" holds robustly at n=600.
4. **Step 3** — one full balance run, commit REPORT.md, final numbers table.
5. **Step 4** — Playwright end-to-end design review (390×844 + 1440×900).

## Baseline (committed REPORT.md @ 7e1c084)

| Metric | Value |
|---|---|
| §6 Monte Carlo | 59% (band 45–60%) |
| §11 specials (first-timer) | 14% |
| §11 battles / recruits / adaptive | 29% / 20% / 34% |
| §11 strict / strict+2 | 2% / 5% |
| §12 Cartographer (n=210) | specials −5, battles −6, recruits +2, adaptive +3 |

## Experiments

_(newest last)_

## Current state / next step

- Step 0 in progress: adding the section filter to `balance/report.ts`.
