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

### S0 — section filter + parallel sweep (tooling)

- `balance/report.ts`: every section body is wrapped in `if (want(N)) { … }`
  (`FW_SECTIONS=6,11,12`); definitions several sections share (§4's affix
  benches, §8's mutation benches, §11's constants/model, §12's hub cells) sit
  at top level between the blocks; the console summary is pushed per section.
  A filtered run writes `balance/REPORT.sections.md` (ignored), never
  `REPORT.md`. `FW_SECTIONS=6,9,17` runs in 23s.
- `balance/tune.ts`: §11's four lines, §12's Cartographer (or every hub state)
  and §6 sharded across all cores on §11/§12's own seeds.
  `npx tsx balance/tune.ts 600 fresh carto` = 74s.
- Per-section wall time (single core, before the change): §1–§10 42s total,
  §6 20s, §11 22s, §12 several minutes (the bulk sits in §12–§16).
- **E0 baseline, n=600** (`tune.ts 600 fresh carto`): zero meta specials
  15.3% · battles 27.0% · recruits 19.8% · adaptive 28.3%; Cartographer
  specials −2.5 ±3.6 · battles −3.5 ±4.2 · recruits +0.7 ±4.3 · adaptive
  +6.3 ±5.3. Matches the brief's −3.5 ±4.2, so `tune.ts` reproduces §12.
- Verification pending: full unfiltered run must leave `REPORT.md`
  byte-identical (full run 1 of 3, running).

## Current state / next step

- Step 0 done, pending the byte-identical check (full run 1/3 in background,
  output in scratchpad `tuning/full1.out`).
- Next: Step 1 experiments with `tune.ts` — E1 `STOP_XP_SHARE` 0.35 → 0.55,
  E2 Gate-aware campfire rank in `prefPolicy`.
