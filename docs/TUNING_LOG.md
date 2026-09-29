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

- Baseline reproduction: the old `report.ts` (instrumented copy, single core,
  469s end to end: §12 290s, §13 65s, §15 37s) regenerates the committed
  `REPORT.md` byte for byte.

### E1 — `STOP_XP_SHARE` 0.35 → 0.55 — KEEP

- Change: `src/game/run/battle.ts` `STOP_XP_SHARE = 0.55` (a stop drills the
  company for 55% of a plain fight's XP for the layer, up from 35%).
- Command: `npx tsx balance/tune.ts 600 fresh carto` (91s).
- Zero meta: specials **15.3 → 20.3%** · battles 27.0 → 25.3 · recruits
  19.8 → 18.5 · adaptive 28.3 → 30.5.
- Cartographer Δ: specials −0.2 ±4.4 · battles **−1.7 ±4.2** · recruits
  +4.2 ±4.5 · adaptive +6.5 ±5.1.
- §6 cannot move (its model has no stops). Hits the ~20% target on the
  first-timer line with an onboarding lever: the line that stops most is the one
  that was starved of levels. Battles/recruits moved ≤1.7pt (paired noise; the
  XP change re-deals evolution/perk rolls behind it).

### Diagnosis — where battles-first loses on the wide map (n=300, E1 state)

`scratchpad/tuning/diag.ts` (per-fight hook on `simulateRun`):

| | zero meta | Cartographer |
|---|--:|--:|
| win | 28.7% | 25.3% |
| battles / run | 8.93 | 9.77 |
| fights taken at layers 2 / 3 / 6 / 7 | 210 / 204 / 219 / 210 | 288 / 274 / 290 / 264 |
| Gate HP lost per fight, layer 7 | 3.0 | 4.0 |
| deaths at layer 7 (plain battle) | 15 | 29 |
| Gate HP into the act-2 boss | 18.4 | 17.7 |

Runs die in act 3's plain battles (layers 9–11 lose 4.6–6.7 Gate HP a fight),
not at the bosses. The wide map hands the fight-first line more fights, and the
model walked into every one of them however low the Gate was — a campfire one
fork away included.

### E2 — Gate-aware campfire rank in `prefPolicy` — KEEP

- Change (`balance/runsim.ts`): every fixed-table line ranks a campfire first
  (8, under the bosses' 9) when the Gate is at or below 60% (`GATE_HURT`, the
  adaptive line's and the store-model's rest threshold).
- Why it is a realistic player and not a gate trick: the Gate bar is on screen
  all run and a campfire's first offer is its repair. The table's only other
  state read (a full roster skips recruits) is the same kind. It changes no
  game rule and applies identically to zero meta and every hub state.
- `tune.ts 600 fresh carto`: zero specials 20.3 · battles 25.3 · recruits 18.8
  · adaptive 30.5. Cartographer Δ specials −0.3 ±4.3 · battles **−0.3 ±4.3**
  (was −1.7) · recruits +5.0 · adaptive +6.5.
- n=210 (the report's cells): battles −4.3 ±7.8 — the first 210 seeds are a
  noisier draw; passes the gate, but the point estimate is still negative.

### E3 — wide map: every road into the pre-boss layer reaches its campfire — REVERT

- Change (`runmap.ts`, wide map only, edges added, no RNG): each node of the
  layer before the pre-boss layer gets an edge to the campfire.
- `tune.ts 600 carto`: specials **−3.0 ±4.3** (worse: the stop-first line now
  walks into the fire on every act instead of a fight, and loses the XP),
  battles −0.2, recruits +5.5, adaptive +6.3. Reverted.

### E4 — …and a merchant's Gate repair when hurt and able to pay — KEEP

- Change (`balance/runsim.ts`): a hurt Gate (≤60%) with ≥ `GATE_REPAIR.price`
  gold ranks a merchant 7 (the counter's repair — the same rule the merchant
  stop already buys on at ≤65%).
- `tune.ts 600 fresh carto`: zero specials 20.3 · battles 25.8 · recruits 19.5
  · adaptive 30.5. Cartographer Δ specials −0.3 ±4.3 · battles **+0.3 ±4.4** ·
  recruits +5.8 ±4.7 · adaptive +6.5 ±5.1.

### S0 verified — full run 1/3

- Unfiltered `npx tsx balance/report.ts` with the `FW_SECTIONS` refactor (at
  7e1c084's game, STOP_XP 0.35) left `balance/REPORT.md` byte-identical to the
  committed file and passed every invariant. Console summary lines unchanged.

### Step 1 gate + prose

- `report.ts` §11: new invariant — the first-timer line (the shipped heuristic,
  `specials`) must win ≥ 15% as well as ≤ 35% (`FRESH_WIN_BAND`). Prose: "The
  four gates", a re-fit paragraph with the n=600 before/after; §12 gets a
  finding on Gate-aware routing and the reverted map change.
- `battle.ts`: `STOP_XP_SHARE` doc updated with the fit.

## Current state / next step

- Running `FW_SECTIONS=6,11,12` (report n) to read §11 at n=120 and §12 at
  n=210 with the new gate (scratchpad `tuning/f2.out`).
- Next: if green, gates (typecheck/test/build) and a non-WIP commit for Steps
  1+2; then the Cartographer robustness read at n=600 with `FW_META_RUNS=600
  FW_SECTIONS=12` (or `tune.ts 600 hub`).
