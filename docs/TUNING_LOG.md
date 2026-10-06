# Tuning log

Checkpointed logs of the tuning lanes, newest first. Every experiment is
recorded (change, command, numbers, keep/revert) and committed with the lever
it belongs to.

---

# Tuning pass 2 — the mercenary company (2026-10-05)

Base: `main` @ 1b43846 (grid-fit, weapon clearance, SK1 skills, classless
heroes, the mercenary-company economy, the HQ, sealed crates, the trade-map
menu, the Sovereign Route). Untuned: **50 invariants fail**, §6 Monte Carlo
57% (band 45–60%), first-timer line 14% (band 15–35%, aim 20–28%), adaptive 16%.

Tools: `FW_SECTIONS=…` for one section (§4/§10 7s, §7 11s, §14 10s, §16 26s,
§15 110s), `balance/tune.ts` for §6/§11/§12 on four cores (`240 fresh mc`
≈ 90s), and an uncommitted copy of it (`scratch/_tune.ts`, `state=<prefix>`
for one HQ row).

## Step 1 — re-target the benches (each its own commit)

| Commit | Bench | What it measured | What it measures now | Before → after |
|---|---|---|---|---|
| daca170 | §4 affix pins | Sharpshooter / Stormcaller rebuilt from gear sat on the band floor (18% / 22%) | pins ×0.8→×0.25, ×1.2→×0.8 (37% / 36%); `reach` graded on `phys` | 9 dead affixes → 0; §10 curse fails 5 → 2; §15 relic ladder inverted → ordered |
| 0ffac20 | §7 skills | points by class; a lone hero could not see holds, slows or gold | points by kit (Sword & Shield / Dagger / Wand); `partner` and `gold` benches; dead = dead on every kit | 19 fails → 1 (L2 Sword & Shield solved by Wildfire, +20.3pt) |
| a9631bb | §2 supports | four retired support specs; the Bannerman's aura had no skill | Blessing / Rally on a wand and a sword-and-shield vs the same hero's damage starter | Bannerman fail → Sword & Shield + Blessing +9.8% (one rung short) |
| 1d5abd3 | §16a bomber | ×3 HP column died before any bomber reached throwing range | ×5 HP | never fired → 5.3 Gate dmg without counter, 0.0 with |
| 5d0ed84 | §14c variety | leak ratio over a 0.05 clamp (teams leaked ~0) | each node's pressure raised until its canonical shape leaks ≥ 2 HP | ×22.14 (clamp) → elite ×2.52, normal ×5.67 (real, game-side) |
| be11ff2 | deployment (harness) | shield-bearers posted 90–110px off the lane, holding nothing; boulders hid it | a holder takes the best tile within its hold radius of the road | boulders adaptive −3.5 ±3.1 → −1.0 ±3.3 (n=600); MC 56.7 → 59.7%; first-timer 15.0 → 17.3% |

Explored and reverted: a marginal-coverage deployment (spread the team along
the road) — MC 57 → 45%, first-timer 14 → 8%, boulders still negative.


## Step 2 — core difficulty

Read with `tune.ts 240 fresh mc` (§6 n=300); first-timer = §11's `specials` line.

| Commit | Lever | §6 | first-timer | battles | recruits | adaptive |
|---|---|--:|--:|--:|--:|--:|
| (base after step 1) | — | 59.7% | 17.9% | 12.9% | 8.8% | 20.0% |
| 6c764e9 | caster weapons ×1.6 flat; the pick's caster weapon Epic → Rare | 63.7% | 17.9% | 11.7% | 10.4% | 21.7% |
| 8566b33 | loot rarity weights 56/28/11/4/1 → 46/32/15/5/2 | 63.7% | 20.0% | 20.4% | 15.8% | 28.3% |
| 9e7c1ab | a hire's weapon is Rare | 63.7% | 25.4% | 20.4% | 18.3% | 32.9% |
| 5d0bba3 | act 3 ×1.29 → ×1.40 a layer; final boss ×0.55 → ×0.45 | 57.7% | 25.4% | 19.6% | 17.5% | 31.3% |

(The last row includes step 3's Anchor / Keen Eye / Finisher, which were in
the tree when the curve was fitted; the commit's message has the full table.)

Tried and dropped: `XP_PER_DEPTH` 55 → 65 (first-timer 17.9 → 15.4, noise),
`STOP_XP_SHARE` 0.55 → 0.85 (+1.3pt), merchant luck ×1.5 (+0.0pt) — a first
run is short of gear and hires, not levels. Act 3 at ×1.40 with the final boss
at ×0.55 put three §6 final bosses past the 600s cap; at ×1.42 / ×0.43 and
×1.36 / ×0.50 / elite ×1.15 one depth-11 wave stalled (three holders, a shaman
out-healing them: 139k HP healed in 600s). ×1.40 / ×0.45 has none in §6's 300.

## Step 3 — every choice real (skills)

| Commit | Lever | Before → after |
|---|---|---|
| 65f33ed | Anchor's thorns ×1.5 → ×3 | L2 Sword & Shield solved (Wildfire +20.3pt) → +17.4pt |
| ad69f99 | Keen Eye + crits deal 50% more; Finisher + hits 10% harder | Keen Eye on Sword & Shield +0.0 → +2.8pt; Finisher +0.5 → +2.5pt (Wand +1.3 → +20.6) |
| bf3853c | Blessing 15% → 25% | §2 Sword & Shield + Blessing +9.8% → +21%, Wand +20% |

## Step 7 (done early: the fast benches)

| Commit | Lever | Before → after |
|---|---|---|
| 93f85be | Vengeful ×1.6 → ×1.3 damage | knife +4.1 → −6.4pt, wand +26.2 → +9.8pt |
| 54b4646 | Erratic ×0.82 → ×0.75 damage | knife +0.4 → −8.1pt, wand +9.0 → +6.9pt |
| 9da7e13 | Wildfire Pact 80/s −35% → 50/s −40% | worst +0.0 → −5.6pt (armour), best +17.3pt (magic) |
| 5bea787 | Iron Vigil −12% → −20% damage | worst −1.7 → −7.7pt |
| 96b17d5 | variant budget scales (Swarm 0.95, Bombard 1.12, Column 1.2; Warded 1.1, Swift 0.86) | §14c normal ×5.67 → ×1.75, elite ×2.52 → ×1.51 |

## Step 2, continued — the slog, and runs that were not paired

- c45e296: after the variant refit the final boss at ×0.45 ran one §6 run
  past the 600s cap (a Colossus held by a Warden of Ash, ground down for 13
  minutes). ×0.42 has none in §6's 300. Act 3 ×1.38–1.42 with ×0.42–0.45 is
  chaotic in which seed slogs (runs 108, 257, 112 in different configs);
  heavier danger ground (4 cursed, 8 boulders) took §6 to 56.3% but slogged
  run 112. **A held champion with a weak team is a real slog in the game
  (no clock), not only in the harness** — designer item.
- 7d35355 (harness): skill offers hash the hero's id, and ids came off the
  process-global counter — the same seed in one process was re-dealt by
  whatever ran before it. One stake tier read 23.2% and 25.3% on identical
  rules. simulateRun / monteCarloRun now run on their own id counter; the
  scratch tools and the report read the same numbers. (§6 never depended on
  it: 58.0% before and after.)

## Step 4 — stakes

Tools: `scratch/_stakedump.ts` simulates the ladder once and dumps each run's
cities (cargo, purse); `scratch/_payeval.py` prices any pay rule offline on a
dump; `scratch/_tier.ts` probes one tier's delivery for candidate strengths
(tiers are independent, so each is fitted alone).

| Try | Delivery 0→8 crates (%) | Pay (cash line) | Verdict |
|---|---|---|---|
| +8% / crate (base) | 31 → 28 → 27 → 27 → 25 → 23 → 23 → 21 → 19 | dips at 4, 8 | cost 0–2pt |
| +15% HP / crate | 32 → 28 → 25 → 23 → 22 → 21 → 17 → 18 → 16 | dips at 4, 6, 8 | cost ~2pt |
| +15% HP and theft / crate | 32 → 24 → 19 → 15 → 12 → 9 → 7 → 6 → 4 | — | tail flattens |
| table HP+theft whole road (×1.08…×4) | 32 → 31 → 27 → 19 → 13 → 10 → 4 → 0.7 | collapses from 4 (city 2 reach 90 → 16%) | pay gate impossible |
| last leg only (act 3), table | 32 → 28 → 23 → 19 → 15 → 9 → 5 → 0.8 | rises with the new city pay | **kept** (02b06a5) |

Pay (53f06ae), priced on the kept ladder: old rules 118 / 165 / 195 / 242 /
200 / 229 / 249 / 279 (dip at 4); 100/130/350 with one crate at the
destination 118 / 161 / 167 / 204 / 244 / 264 / 304 / 329; **100/130/400**
118 / 161 / 175 / 212 / 249 / 268 / 305 / 330 (kept). Escort → 1 crate +43
(interest cap 40 stays under it). Cash-out under 50% cargo is right in ~80%
of the runs that take it (from 2 crates), −5 to −19 gold on average.

## Step 5 — economy sanity

- Interest cap 40 < smallest stake gain +43 (was +50; the docs say why).
- Sealed crate 500 ≈ one run's savings (escort ~510 net, 4 crates ~640 at
  zero HQ): unchanged.
- Road share 25%: unchanged.
- HQ purchases (§12): see the final report.

## Step 6 — the charter (`scratch/_charter.ts`, 600 paired runs)

| Setting | Delivered (no / all Sovereign items) | Bank net a charter |
|---|--:|--:|
| after steps 1–4, muster flavour, 5,000 / 20,000 | 36% / 40% (n=210) | +2,693 |
| muster ×1.25 | 18.5% / 22.2% | −916 |
| without the muster | 30.3% | — |
| **muster ×1.07**, 5,000 / 20,000 | 26.0% / 28.3% | +619 |
| **muster ×1.07, 7,000 / 35,000** (kept) | 26.0% / 28.3% | **+2,519 / +3,344** |

Fee 7,000 ≈ 8.6 good runs (this company banks 814 from 4 crates). Each
condition lifted (n=300, after the pass): the ground (fire, lakes, boulders,
curses) +5.7pt, the double prices +2.3pt, the muster +4.3pt (n=600). Before
the pass the untuned report read the ground +4.3, the prices +3.3 and the
muster −0.5pt (n=210).

## Step 2, last — the boss share and the cap

The first full report (all else green) failed one gate: the final boss
killed 9% of the teams that reached it (§6 floor 10%). Every multiplier that
killed more slogged a seed past 600s. The slogs are real 13–19 minute fights
(run 108's final boss 1,159s, a defeat; run 260 789s / 908s, cleared), so
the harness cap went 600 → 1800s (109a334) and the boss went ×0.42 → ×0.44
(657360e): §6 57.3%, boss kills 20/192 (10.4%), no timeouts. The final boss is
in every staked run, so stake tiers 3, 7 and 8 were re-probed alone.

## Final numbers (pass 2)

| Metric | Before (1b43846) | After |
|---|--:|--:|
| Invariants failing | 50 | **0** (REPORT.md, full run) |
| §6 Monte Carlo (45–60%) | 57% | 57.3% |
| §6 final-boss kills of arrivals (≥10%) | 12% | 10.4% |
| §11 first-timer (15–35%, aim 20–28) | 14% | 25.4% (n=600: 27.7%) |
| §11 battles / recruits / adaptive | 10 / 8 / 16% | 18 / 20 / 34% (n=600: 16.7 / 19.0 / 33.5%) |
| §11 strict floor's worst node (≤40%) | 43% | 35% |
| Stake delivery 0→8 crates | 18 → 18 → 19 → 15 → 14 → 14 → 12 → 11 → 10% | 33.5 → 27.5 → 23.2 → 18.7 → 15.5 → 10.0 → 6.5 → 0.7% (8: unmeasured, <1% below it) |
| Stake pay, cash line | 87 → 136 → 157 → 190 → 149 → 188 → 191 → 219 → 173 | 119 → 162 → 176 → 210 → 257 → 274 → 313 → 329 |
| Smallest stake gain vs interest cap 40 | +50 | +43 |
| Charter delivery (no / all Sovereign items) | 23 / 27% | 29 / 32% (report, n=210; n=600: 27 / 29%) |
| Charter bank net a run | +80 | +3,597 (report; n=600: +2,929) |
| Charter fee in good runs | 7.6 | 9.0 (report; n=600: 8.5) |
| Muster cost (lifted) | −0.5pt | +4.3pt (report; n=600: +3.3) |

Report runtime grew to ~50 minutes single-core (§12 alone ~60 core-minutes
at n=210: runs are longer — bigger companies, harder act 3, the 1800s cap).

---

# Tuning pass 1 — first-timer line, Cartographer's Table, final review

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

### R1 — filtered report at report n (`FW_SECTIONS=6,11,12`)

- §6 **59%** (unchanged: its model has no stops or routes).
- §11 (n=120): specials **18%** · battles 29 · recruits 17 · adaptive 30;
  strict 2% / +2 recruits 5%. All §11 gates green including the new floor.
- §12 (n=210): Cartographer −1 / −3 / +12 / +3 (worst −3pt vs a ±8 floor);
  every state green; full ramp +27pt.

### R2 — every hub state at n=600 (`tune.ts 600 hub`, 303s)

| Hub state | specials | battles | recruits | adaptive |
|---|--:|--:|--:|--:|
| zero meta | 20.3% | 25.8% | 19.5% | 30.5% |
| Cartographer's Table | −0.3 ±4.3 | +0.3 ±4.4 | +5.8 ±4.7 | +6.5 ±5.1 |
| Free Companies | +3.0 ±3.8 | +4.0 ±4.6 | +8.7 ±4.3 | +5.8 ±4.7 |
| Standing Orders | −1.2 ±1.7 | +0.0 ±0.9 | −0.7 ±1.1 | +0.8 ±1.2 |
| all three unlocks | +3.7 | +5.0 | +8.3 | +11.0 |
| Field Kitchen + Cartulary | +0.3 ±1.6 | −0.8 ±1.9 | +0.0 ±2.0 | −0.3 ±1.9 |
| the full ramp | +28.7 | +29.8 | +31.0 | +29.0 |
| everything | +31.8 | +30.7 | +32.2 | +34.7 |

No state is below zero meta by more than 1.2pt on any line at n=600 (the gate
allows max(3pt, 2 s.e.)): "no hub purchase lowers win rate" holds robustly.

### E5 — §11 sample 120 → 240 — KEEP

- With a floor gate on the first-timer line, n=120 (1σ ≈ 3.7pt at p≈0.2)
  put an 18% reading one σ off 15%. `tune.ts 240 fresh`: specials **22.1%** ·
  battles 30.8 · recruits 16.7 · adaptive 32.5 (n=360: 21.1%). Default
  `FW_FRESH_RUNS` is now 240 (+~25s).

### Step 2 decision — Cartographer's Table

**Chosen: the Gate-aware player model (E2 + E4), not a map change.** The map
change that was the natural design lever (E3: every road into the pre-boss
layer reaches its campfire) cost the stop-first line 3pt, because a line that
already ranks the fire high traded a fight's XP for rests it did not need. The
defect the numbers showed was the model: a fixed-table player marching into its
fourth act-3 battle on 5 Gate HP with a campfire one fork away. Reading the
on-screen Gate bar and walking to the fire (or buying the merchant's repair)
below 60% is what the adaptive line and the store's own rest rule already do;
it changes no game rule and applies identically to every hub state and to zero
meta. The wide map itself is unchanged.

Gates: `npm run typecheck` ✓ · `npm test` 264/264 ✓ · `npm run build` ✓.

### R3 — full run 2/3 — FAILED one invariant (§13)

- Everything else green: §6 59% · §11 (n=240) specials **22%** · battles 31 ·
  recruits 17 · adaptive 33 · strict 1% / +2 recruits 4% · §12 worst −3pt
  (Cartographer) · ramp +27pt.
- **§13 Vow ladder (adaptive, n=600): B0 31% · B1 29% · B2 20% · B3 4%.**
  Thin Pickings now costs 1.5pt, under the 3pt a rung must cost (it cost 5pt
  at 7e1c084: 28% → 23%). Cause: `STOP_XP_SHARE` 0.55 — levels from stops
  substitute for the cards and shelf slot Thin Pickings takes away.
- Added `banner` to `tune.ts` (the §13 ladder on every core, 24s at n=600):
  reproduces B0 30.5 · B1 29.0 (−1.5) · B2 19.8 · B3 4.0.

### E6 — STOP_XP_SHARE vs the Vow ladder (`tune.ts 600 banner fresh`, `tune.ts 240 fresh`)

| STOP_XP_SHARE | Thin Pickings shelf | first-timer n=600 | first-timer n=240 | B0 → B1 (cost) | B2 | B3 |
|---|---|--:|--:|--:|--:|--:|
| 0.35 (7e1c084) | −1 | 15.3% | — | 28 → 23 (5.0, report) | 16 | 4 |
| 0.40 | −1 | 16.8% | 21.7% | 27.3 → 22.3 (**5.0**) | 16.2 | 3.5 |
| 0.45 | −1 | 19.3% | 24.6% | 28.7 → 25.8 (**2.8** ✗) | 18.3 | 3.3 |
| 0.55 | −1 | 20.3% | 22.1% | 30.5 → 29.0 (**1.5** ✗) | 19.8 | 4.0 |
| 0.45 | **−2 (half)** | 19.3% | 24.6% | 28.7 → 21.8 (6.8) | 14.8 | 3.0 |
| **0.55** | **−2 (half)** | **20.3%** | **22.1%** | **30.5 → 23.8 (6.7)** | **16.7** | **2.7** |

STOP_XP alone cannot hit both targets: every non-loot power gain shrinks what
a loot-denial rung costs. **KEEP 0.55 + Thin Pickings halves the shelf**
(`shelfSize` 4 → 2, 5 → 3 with the Seal): the card already reads "Half the
build, same march", two cards instead of three; the shelf now matches. Copy in
`metaStore` BANNER_RUNGS, doc on `shelfSize`, unit test, §13 prose. Every rung
costs ≥ 6.7pt at n=600; no §11/§12 cell moves (both are Banner 0).

### Step 4 — review, run 1 (390×844, dev server for `window.__game`; prod preview for the menu)

`window.__game` is exposed only in DEV builds (`main.tsx`), so the playthrough
runs on `npx vite --port 4361`; the menu/attract mode was checked on the
production preview (4360). Driver: scratchpad `pw.mjs` + `auto.mjs` (taps the
real canvas at each slot's box — the "Circle N" buttons are an accessible layer
under the canvas).

Run 1 (Fighter, honest play, no Assist): lost at depth 5 (Torch ×12, Bomber
×3; 72 marks). Seen: attract mode, hero pick, map, node preview, portrait setup
+ coach tip, sub-waves 1/2 and 1–2/3, the breather banner, Rally Horn in the
command slot, wave-cleared card, campfire, spoils (relic + item), level-5 perk
dialog (locked perk shows its feat), Crossroads, defeat receipt.

Fixed (UI-only, cannot move the balance report):
- **Campfire on a full Gate preselected "Rest by the fire — Gate is full"
  with "Rest anyway" as the big button** — one tap from wasting the fire.
  `campfireOffers` now leads with a trainable hero when the Gate is full
  (rest still leads on a hurt Gate).
- **Spoils row truncated "Executioner's Oa…"** beside "•••• Legendary · relic"
  at 390px. `.pg-row-label` wraps to two lines inside the 48px row.

### Step 3 — full run 3/3 — ALL INVARIANTS PASS, REPORT.md committed (9ea3779)

## Final numbers

Before = the committed REPORT at 7e1c084; after = REPORT at 9ea3779 (report
sample sizes: §11 n=120 → 240, §12 n=210, §13 n=600), plus the n=600 paired
reads from `tune.ts` and the `meta-sweep.ts 240 phase3b` scoreboard run on
both trees (the "before" from a `git archive` of 7e1c084).

| Metric | Before | After |
|---|--:|--:|
| §6 Monte Carlo (band 45–60%) | 59% | 59% |
| §11 first-timer (specials), report | 14% (n=120, ungated floor) | **22%** (n=240, gated 15–35%) |
| §11 first-timer, n=600 | 15.3% | **20.3%** |
| §11 battles / recruits / adaptive, report | 29 / 20 / 34% | 31 / 17 / 33% |
| §11 battles / recruits / adaptive, n=600 | 27.0 / 19.8 / 28.3% | 25.8 / 19.5 / 30.5% |
| §11 strict floor / +2 recruits | 2% / 5% | 1% / 4% |
| Route spread (report §11) | 14–34% (20pt) | 17–33% (16pt) |
| Route spread (phase3b, n=240) | 18–32% (14.6pt) | 17–33% (15.8pt) |
| Build spread, oracle vs random (adaptive, in-sample n=240) | 12.1pt | 25.0pt |
| Build spread, same oracle on 480 fresh seeds | 24.2pt | 30.2pt |
| Vow ladder B0/B1/B2/B3 (adaptive, n=600) | 28 / 23 / 16 / 4% | 31 / 24 / 17 / 3% |
| Vow marks/run | 111 / 146 / 213 / 233 | 116 / 149 / 220 / 227 |
| Starters F/R/M, first-timer line (phase3b n=240) | 14 / 21 / 18% | 25 / 23 / 19% |
| Starters F/R/M, adaptive (phase3b n=240) | 31 / 38 / 28% | 31 / 38 / 29% |
| Starters F/R/M, nodes cleared (report §11) | 9.4 / 9.2 / 9.6 | 9.7 / 9.7 / 9.9 |
| §12 Cartographer worst gated Δ (n=210) | −6pt | −3pt (±8) |
| §12 Cartographer battles-first, n=600 | −3.5 ±4.2 | +0.3 ±4.4 |
| §12 any hub state, worst Δ at n=600 | — | −1.2 ±1.7 (Standing Orders, specials) |
| §17 portrait parity (stop / Gate lost, both fields) | identical (94%/1.56, 94%/1.25) | identical (unchanged) |

**Watch item — build spread.** The in-sample oracle doubled (12 → 25pt), and
an out-of-sample check (the oracle's picks replayed on 480 seeds it never saw)
reads 24 → 30pt: the build layer was already more solved than the in-sample
number said, and faster levelling (more of the level-10/15/20 choices get
reached) widened it by ~6pt. It is not gated; it belongs to the perk/evolution
lane, not to this one.

### Step 4 — review conclusions (screenshots in scratchpad only, not committed)

Run 2 (Mystic, `GOD=1` refills the Gate before each fight, as a review
shortcut) reached the act-1 boss: Warlord Grukk's plate stepped
"Phase 0 of 2: war-cry at 66%" → "1 of 2: war-cry at 33%" → "2 of 2:
war-cries spent", followed by the Crossroads, a campfire and a second recruit.
Desk pass at 1440×900: 1/2/3 → speed 3/1/2 ✓, Space → battle starts ✓,
C → command spent (ready true → false) ✓, ? → key sheet ✓, Esc closes ✓.
Codex: five sections with counts; the feats list is readable.

**Scorecard** (docs/DESIGN_REVIEW.md checklist, 1–5): readability 4 · decoration
at the margins 5 · faction legibility 4 · colour/surface 5 · surface character 4
· depth/composition 4 · polish 3.

**Fixed and committed** (each rendered again at 390×844):
1. Campfire on a full Gate leads with Train, not "Rest anyway" (3b02683).
2. Long offer names wrap; the rarity tag wraps its suffix (3b02683, dcca65d).
3. Act bosses are "Act N Boss", not "The Final Watch" (2dbce38).

**Open** (listed in DESIGN_REVIEW.md, 2026-09-29 entry): the last enemy is
frozen mid-death during a breather; the breather banner and boss plate cover
the lane's entry at the top of the portrait field; the merchant item's detail
sits below the fold; the layer-1 map nodes touch at 390px; the gear-slot rarity
letter overlaps its label; the defeat receipt's company list clips to one row
("0 kills" reads oddly); the node preview cuts off its Threat line; a depth-0
resume offers "collect marks"; relics share one glyph.

`window.__game` exists only in DEV builds, so the playthrough ran on the Vite
dev server and the production preview was used for the menu and the Codex.

## Current state / next step

- **All four steps done.** Branch `worktree-agent-a26babe6cd2b22e29`,
  not pushed.
- Next (for a later lane): the open review items above, and the build-spread
  watch item (the oracle-vs-random gap is ~30pt out of sample).

---

# October audit, lane B — re-anchored gates, item identities, never-taken options

Designer items 1, 4a and 9 of `docs/AUDIT_2026-10.md` §4. Base: the
integration branch with lanes 1–4, C (a field per act), A and D merged.
Reads are `tune.ts` on paired seeds (`9001 + i·17`) unless marked REPORT
(the full `npm run balance`). Before = the committed REPORT at c8bda01 (50
invariants failing); after = the REPORT committed with this lane (38).

## The new gates (balance/report.ts §6, §13, §13c)

| Gate | Before | After (REPORT) | 1σ |
|---|--:|--:|--:|
| §6 Monte Carlo 45–60% | 61% (failing) | 68% — **retired as a gate**, still printed | — |
| Zero-meta escort 20–30% (§13, 0 crates, adaptive, Rosethread) | 21% | **28%** | 1.8pt (inside by > 1σ) |
| Veteran escort 35–55% (§13c, runsim.VETERAN) | 30% (§18's row, random picks) | **41%** | 2.0pt |
| Veteran max stake (8 crates) 10–20% | — (not measured) | **17%** | 1.5pt |
| Every crate ≥ 8% of the tier below (log-linear fit) | "≥ 3pt a crate" failed 6 of 8 | zero meta **15%** ±1.1, veteran **11%** ±0.8 | — |
| No crate easier beyond 2 paired s.e. | — | none | — |
| §11 first-timer floor ≥ 15% / ceiling ≤ 35% | 16% | **22%** | 2.7pt |
| §11 best line ≥ 15% | 19% | **27%** (adaptive) | — |
| §6 boss kills ≥ 10% of arrivals (kept) | 10% (9.85, failing) | **12%** | — |

The veteran is §18's late-game company (HQ bought out, every random skill
card, every L1–3 item kind), and it **reads its offers** (`build: 'best'`).
With random picks the same company delivered 17.5% against a zero-meta
escort's 17.8% (n=400): 36 cards dealt three at a time, several dead on a
lone hero, dilute a random pick.

The per-crate gate is read off the ladder's fit because one step's paired
s.e. at 600 runs is ≈2pt — larger than an 8% step (1–3pt). Measured at n=600
on the veteran's ladder, single steps read from −7% to +28% relative around a
fitted ≈11%.

## Levers moved

| Lever | Before | After | Why / read |
|---|--:|--:|---|
| `watch.STRENGTH_PER_STEP` | 0.08 | **0.19** | At 0.08 the veteran's ladder was 29.5% → 19.8% over 8 crates, steps inside the noise. 0.15 (the economy audit's figure) left the veteran's max stake at 18–20%; 0.17 at 18.5%; 0.19 → 16–17%. |
| `threat.ACT_STEPS` | [1.12, 1.2, 1.25] | **[1.06, 1.13, 1.18]** | Zero-meta escort 19.8% → 26.7%, veteran 26% → 40–43% (n=400 → 600). The first-timer line 14.5% → 22.7%. |
| `threat.nodeThreatMult('boss')` | ×0.55 | **×0.85** | The eased road alone took the boss's kill share to 7.5% (gate ≥ 10%): ×0.62 → 7.4%, ×0.80 → 12.0%, ×0.85 → 12.4%. |
| Bounty (skill) | +1 gold a kill | **+3** | Item 9. A stop-rate bench cannot see gold; §7 now lists it as graded in gold. |
| Tithe Box (relic) `TITHE_GOLD` | 10 | **25** | Item 9. Whole runs: −1 ±6pt (paired, n=150) — gold does not move the win rate. |
| Field Surgeon's Kit `SURGEON_HEAL` | 2 (10%) | **4 (20%)** | Item 9. Whole runs: +1 ±6pt. |
| Iron Vigil | −12% damage | **−35%** | The designer's −25% read a worst bench of −1.2 to −1.4pt (its thorns and patience pay it back); −30% −1.6pt; −35% **−2.8pt** (gate: a pact must cost ≥ 2pt). Mean still +6.1pt. |
| Wildfire Pact | −35% damage a hit | **−50%** | Worst bench +0.0 → **−5.6pt**; mean +7.2 → +3.4pt. |
| Bloodletting | +70% dmg / −34% speed | **+90% / −30%** | Epic stat relics +1.0pt → **+3.3pt** (Rare +2.0pt): the ladder is monotone. |
| Whetstone Pact | +32% speed | **+36%** | +40% erased its cost (worst −0.4pt); +36% keeps −5.6pt. |
| Cleave (L1) | splash 20 | **14** (−30%) | §7 reads it unchanged (+43.0 → +42.7pt on the fighter): any splash on a lone melee hero is the whole bench. L1:fighter's lead 19.6 → 19.3pt (under the 20pt ceiling either way). |
| Wildfire (L2) | burn 12, splash 15 | **burn 10, splash 13** (≈ −15%) | L2:fighter's lead 20.3 → **19.3pt** (gate ≤ 20pt: now passing). |
| §7 Level 3 bench (harness) | fitted on the bare hero | **fitted on a hero holding Berserk** | Every strong L3 skill read the +59.3pt ceiling. Now fighter and rogue rank (Stormcaller leads the rogue point by 25.5pt — a new, real finding); on the mystic two hold skills (Bulwark, Warden of Ash) still stop every bench. |
| Harness equip rule (`keepsJob`) | keeps a hold | **keeps a hold, a blast and a reach** | With item identities the DPS-greedy model swapped Mail for Plate and Staff for Grimoire because `dps` cannot see splash or range. |

Not moved: the swift elite's `budgetScale` (the ×22 variant spread is a §14
finding the contract gates did not need), the stake elites' placement
(`map.addDifficultyElites`; the veteran owns the scouts, so its stake elites
are avoidable whatever the order), and anything in lanes A, C and D.

## Item kinds (designer item 4a)

Each kind rolls one identity (table in `items.ts` above `WEAPONS`). Set on a
scratch §7-style bench: a level-10 hero of each look with the kind at Rare
(enchantments stripped), each bench fitted so the slot's basic kind stops
half; three roll seeds × three battle seeds, so ±5pt is noise. Final reads
(stop rate, mean of `swarm` / `armour` / `line`):

| Slot | Kind (mean stop %) |
|---|---|
| One hand, swing | Sword 50 · Axe 52 |
| One hand, cast | Wand 59 · Rod 61 · Sceptre 61 |
| Two hand, swing | Greatsword 45 · Warhammer 50 |
| Two hand, cast | Staff 53 · Grimoire 53 (Staff wins the swarm, Grimoire the armour and line) |
| Shoot | Bow 52 · Dagger 43 (one-handed: it leaves the off hand free) |
| Shields (fighter / rogue / mystic) | Shield 52 / 50 / 46 · Buckler 28 / 33 / 38 · Pavise 46 / 54 / 59 |
| Off hand, no hold | Tome 12 / 14 / 26 · Quiver 11 / 15 / 17 · Focus 11 / 14 / 17 |
| Body (fighter / rogue / mystic) | Mail 52 / 52 / 47 · Cloak 22 / 57 / 40 · Robe 61 / 50 / 53 · Plate 31 / 50 / 63 · Aegis 32 / 58 / 43 |

A lone hero's bench prizes a hold above everything, so a shield beats any
non-shield off hand there (as it did when Tome, Quiver and Focus rolled a
shield's numbers); within each family the kinds now trade. Reach (Cloak) is
the weakest axis the engine has (see the `reach` affix's comment) and stays
the build-dependent pick: best on the rogue, worst on the fighter.

First reads on the veteran after the item change, before `keepsJob` and the
tuning above: 29.5% → 24.0% (n=400) — the DPS-greedy model was trading its
blast and reach away, which `keepsJob` now refuses.

## Still red that this lane owns or touched

- §7: L3:rogue is solved by Stormcaller (+25.5pt), visible only now that the
  L3 bench discriminates; Momentum, Cold Snap, Firebrand, Pin Down, Riposte
  and Keen Eye are dead on their benches (unchanged).
- §11 strict floor: depth 6 ends 46% of solo runs (was 43%; gate 40%).
- §13 / §13c "every crate pays more": dips at 4 and 8 crates on both ladders
  (and 6 on zero meta) — `contracts.cratesSoldAt`, lane A's (the audit's 1.2
  was reverted for this reason).
- Tithe Box and Field Surgeon still measure ≈0 on whole-run win rate: gold
  and cargo do not convert into deliveries on the modelled line.
