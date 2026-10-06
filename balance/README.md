# Balance harness

Automated balance testing for Fieldwatch. It drives the **real combat engine**
headlessly with a seeded RNG (fully reproducible) and writes a report.

```bash
npm run balance          # runs the sweeps, writes balance/REPORT.md, exits non-zero on failure
BALANCE_INVARIANTS=warn npm run balance   # what CI runs: failed invariants become warnings, exit 0
npm run typecheck        # balance/ is type-checked as part of the tsconfig.node project
```

Each run draws its own **battlefield** and its own **composition variants** off
its run index, exactly as a real run draws them off its seed — so §6, §11, §12
and §13 are averages over the field and shape distributions the game actually
produces, not measurements of one map fighting one fixed wave table. Each also
gets its **own RNG stream** rather than sharing one: with a single stream, a
config change that ends run 12 a node earlier consumes fewer draws and hands
every later run a different team, so two configs could not be compared on paired
seeds. Measured while fitting the composition variants, the same battlefield read
61% and 48% across two configs that never touched it.

Runtime is around **8 minutes** on one core (§12 is ~5 of it, §13 ~1; `FW_SECTIONS` runs a subset). It was 26 seconds before §12 and §13, which
simulate whole runs rather than single waves: the hub sweep alone plays 4,200
campaigns. That is the price of measuring a *run*-level defect, and the defects
it was written for had been invisible to every wave-level sweep in the suite.

Two exploration CLIs sit beside the report. Neither is a gate; both exist so a
number can be *fitted* at a sample size the suite cannot afford, and so a
before/after can be quoted with its `n` on it:

```bash
npx tsx balance/meta-sweep.ts 300 unlocks   # hub states × routing policies
npx tsx balance/meta-sweep.ts 250 banners   # the Banner ladder's economy
npx tsx balance/meta-sweep.ts 200 rules     # each Banner rule measured alone
npx tsx balance/meta-sweep.ts 240 phase3b   # the Phase 3b scoreboard: route / build spread, XP curve, §6
npx tsx balance/meta-sweep.ts 300 mc        # §6's Monte Carlo alone, for fitting the Threat curve
npx tsx balance/meta-sweep.ts 1 map         # map shape: forks, stops, forced elites
npx tsx balance/hazard-sweep.ts mc+banner 300 0.75,1,3,3,10   # Q1 danger-ground levers vs §6 / §11 / §13
npx tsx balance/fit-curve.ts 170 2.7 1.44 0.515 200   # a candidate waves.ts curve, against §6 AND §11
npx tsx balance/tune.ts 600 fresh carto mc             # §11 lines, §12 Cartographer and §6 at n=600, on every core
```

### Node-only exploration knobs

Two environment overrides exist for re-fitting §11, and they live here rather
than in `src/` on purpose: **nothing under `src/` may reference `process`** —
`src/game/*` ships to the browser, where `process` is undefined and throws before
the app boots. A previous pass put `process.env.FW_*` tuning knobs in `waves.ts`
and it broke the build and every live harness.

| Variable | Default | What it does |
|---|---|---|
| `FW_META_RUNS` | `210` | §12/§13 sample size per cell. Raised from 150 in WS8: composition variants and a second battlefield add per-run variance that paired seeds cannot cancel, and at 150 the hub and Banner ladders were failing on resolution rather than on the game. `500` halves the floor for a fit. |
| `FW_FRESH_RUNS` | `240` | §11 sample size. Raised from 120 when the first-timer line gained a floor gate (15%): at 120 a ~20% line sat one σ (≈3.7pt) off it. 240 is 1σ ≈ 2.6pt; `480` drops it to ≈ 1.8pt for a fit. |
| `FW_BANNER_RUNS` | `600` | §13 sample size per rung (Phase 1). The Banner gate asks every rung to cost ≥ 3pt, and a 210-run paired cell (±5pt) cannot resolve that: Thin Pickings read −1pt at 210 and −6.2±5.0pt at 600 on the same model. |
| `FW_HAZARDS` | shipped | Q1: `mult,dangerTiles,dangerPool,obstacles,obstaclePool` — run the whole report under other danger-ground levers (`src/game/data/hazards.ts`). `hazard-sweep.ts` is faster but reads §13 a few marks off the report. |
| `FW_SECTIONS` | all | Comma-separated section numbers (`FW_SECTIONS=6,11,12`): run only those sections, their invariants and their console lines. A filtered run prints its sections and writes them to `balance/REPORT.sections.md` (ignored) — it never touches the golden `REPORT.md`. Prose that quotes a section you did not ask for reads `NaN`; no gate reads across sections. Combine with the sample-size knobs above for a quick read, e.g. `FW_SECTIONS=11,12 FW_FRESH_RUNS=120 FW_META_RUNS=120`. |
| `BALANCE_INVARIANTS` | `fail` | `warn` reports failed invariants as GitHub `::warning::` annotations and a section in `$GITHUB_STEP_SUMMARY`, and exits 0 (`verdict.ts`). CI sets it: the balance job gates on the harness completing and on `REPORT.md` being current, while the tuning invariants stay red on purpose until the tuning pass re-anchors them. The console verdict and `REPORT.md` are the same in either mode. |

## The rule this harness is built around

**A sweep must discriminate its subject.** A sweep that returns the same number
for seven different builds, or that cannot fail, is not a measurement — it is a
green light with nothing behind it. Three specific traps produced most of the
false green in the previous version, and `harness.ts` now exists partly to make
them hard to fall into again:

1. **Adjacency is physical.** Aura effects only reach allies inside their radius.
   The largest aura in the game is 160px; The Green Line's slots are 95–508px
   apart and The Kiln Road's 130–420px, and only one Kiln pair is inside any aura
   at all. `AURA_TRIO` and `slotDist` are Green Line facts and stay that way. The
   old support sweep placed the support 191–210px from its allies, so no aura ever
   landed. Use `AURA_TRIO` (or check `slotDist`) when an aura has to reach.
2. **A scenario needs a failure mode.** `baseHp: 999` deletes leaks, heals,
   shields and slows from the measurement. Anything that only pays off when the
   base is losing must be measured on a scenario where the base can lose.
3. **Clear time is spawn-bound; attributed damage can be wrong.** A wave that
   ends when the last enemy walks off the field measures the spawn table, not the
   defence — and per-Sentinel `damageDealt` has historically dropped DoT, trap and
   execute damage entirely, which made burn and execute builds read *negative*.
   Grade defences on **stop rate** instead (see below).
4. **A synthetic pressure model can grade itself instead of the subject.** Push a
   scenario far enough past what the game generates and the engine stops
   answering: at the old §2 break point eight of the eleven effect primitives
   moved the number by exactly zero, and adding `block: {count: 5}` to a
   *Pyromancer* — a spec with no melee identity — cost it four rungs, because
   melee blocking is a decisive advantage against 50–110 bodies and a suicide
   note against 612. If a sweep needs a synthetic multiplier at all, check its
   **control** first: a bar that a real damage tower cannot clear is not a
   damage-tower bar, and the old §2's fighter filler beat an empty slot by less
   than the ladder's own rung ratio.
5. **A scenario can quietly stop being what it is named.** `endure` is defined as
   "a long grind — anything that ramps with time" and borrowed an unscaled
   depth-8 encounter described as a ~100s hold. Once enemy crossing times
   tightened, the same wave resolved in **47 seconds** and `patience` — the affix
   whose whole job is a time ramp — read +0.9pt. Scenarios that assert a property
   now **measure and print** it.

### Stop rate

`stopRate(team, wave)` = the share of a wave's total leak damage the defence
prevented, 0…1. The base is set to exactly `maxLeak(wave) + 2`, so the battle
always runs to the end *and* base-healing effects are capped the way they are in
a real run. It is read off base HP, so no attribution bug can flip its sign.

Deltas from this metric are quoted in **percentage points (`pt`)**, not percent.

## The sweeps

Exhaustive where feasible, Monte-Carlo where the space is combinatorial. Cells
marked ± are multi-seed (mean ± population σ), never a single roll.

1. **Specialization throughput** — all 27 tier-2 builds are measured on
   **HP destroyed per second** inside a fixed 40s window against a queue they
   cannot exhaust (40 Siege Barrels at ×12 HP, one every 0.8s, on a lane they
   need 38s to walk). Supports are tagged and judged separately in §2.

   *This replaced a clear-time measurement, and trap 3 below is why.* The old
   scenario was **spawn-bound** — it ended when the last enemy was dealt with,
   and the last enemy could not be dealt with before it arrived — so all 27
   builds shared a floor on clear time and the measured spread compressed to
   **1.4×** while the analytic spread over the same builds was **14×**. The 3×
   "no dominant outlier" ceiling was therefore unreachable: an invariant over a
   number that cannot vary. On the saturated bench the same builds span 16×.
   The bench also checks *itself*: if any build reaches 90% of what it can
   physically measure, it reports as saturating rather than compressing
   silently. An earlier attempt at this bench used 150 bodies to force
   saturation and measured 6450 HP/s for the top build — splash landing on a
   blob nothing in the game generates, i.e. trap 4.
2. **Support value** — each support sits at the one slot whose neighbours are
   inside aura range, beside a *blocking* carrier (heroes have no HP since the no-HP pass, so an aura is a damage buff), with the
   real 20-HP base. It is graded on the **encounters the game actually ships** —
   a depth-9 swarm, a depth-8 elite armour column and the depth-10 boss, with
   head count, arrival schedule and composition untouched — and the run's own
   **Threat** multiplier is raised on a ×1.15 ladder until the base falls. The
   **hold ceiling** is the geometric mean of the three break points. Each support
   is graded against a generic damage tower of its own archetype in the same
   slot, so "a third body" cannot masquerade as support value.

   *This replaced a swarm-pressure ladder, and trap 4 below is why.* The old
   version copied the depth-9 roster ×p until the line broke, which happened at
   ×12 — 612 goblins carrying a ×30 HP multiplier, all on the field inside 8.4
   seconds. Nothing the game generates is that shape, and in that regime `block`,
   `thorns`, `chill`, `burn`, `trap`, `stun`, `pierce` and `splash` each moved the
   ceiling by **exactly 0.00** when injected one at a time onto a fixed chassis.
   The old ladder is still computed and printed beside the new one, so the change
   is auditable rather than a claim.
3. **Item rarity ladder** — averages base-stat budget and enchant count over 400
   rolls per tier; asserts the ladder is monotonic.
4. **Enchantment strength** — every affix equipped alone, measured by stop rate
   in three scenarios (`phys` / `magic` / `endure`) and graded on the one it is
   designed for, so an INT affix is never judged on a STR build.
5. **Pressure ceiling** — a standard depth-8 team faces *siege pressure* (HP ×p,
   count ×p^0.35, arrival compressed by p^0.35) until it breaks. Count is the
   weakest axis on purpose: `engine.impact` applies splash with no target cap, so
   a count-led ladder makes splash lines stronger and can never break. The team
   is **level 16** (tier 1, Epic gear, random spec perks) — where the Phase 3b XP
   curve puts a depth-8 company; it was a finished L20 build when Threat
   compounded to ×11.6 by depth 8, and against the road's ×1.8 that team broke
   at ×11, outside the ×2–×8 band.
6. **Monte Carlo full runs** — 300 random 3–5 spec companies play all twelve
   layers of the three acts (act bosses on 4 and 8, the final boss on 12), with
   power scaling by depth (level ≈ 2.5·depth, gear rarity lagging, the company
   growing an act at a time) and every layer fought at the real road Threat
   (`threatAtLayer` × the node type's multiplier). The model lives in
   `runsim.monteCarloRun` so `fit-curve.ts` plays the same one. Reports win rate,
   depth distribution and where runs end.
7. **Spec perks** (Phase 3b; replaced the per-hero upgrade tree) — each perk at
   each choice point (level 5 by archetype, level 15 by the tier-1 line) taken
   alone by a representative hero **without gear** (a rolled `vampiric` affix
   heals the Gate off an unkillable wave and flattens the bench) and graded by
   stop rate on `swarm` / `armour` / `line`, each wave first scaled so the bare
   hero stops about half. Gates: no perk is dead (best bench ≥ +2pt) and no
   pair of open options is more than 20pt apart on the mean (none is solved).
8. **Mutation tradeoffs** — each mutation measured by stop rate on three waves
   loading different axes (`swarm` / `armour` / `line`). A mutation is a real
   tradeoff only if it is clearly better in one and clearly worse in another.
9. **Map pacing** — 300 generated maps: the share of free-layer nodes that are
   fights (gated 50–63%, target 55–60%), stops per type, and that no layer holds
   more than two stops or no fight at all.
10. **Curse affixes** — the five `CURSE_ENCHANTS`, each equipped alone on both an
    offensive and a low-crit magic build, to see whether the "downside" costs
    anything on either.
11. **Fresh-player run** — the zero-meta baseline, measured across a **set of
    routing policies** rather than one hardcoded line (see below): one level-1 hero, `START_GOLD`,
    the real opening kit **worn** (`src/game/engine/kit.ts` — the store and the
    harness call the same `startingKit` / `wearKit`, after the pick), base HP
    persisting between nodes and the real Threat ramp. Every Sentinel who joins
    later carries `RECRUIT_KIT` (one common on-type weapon) and dresses its
    empty slots from a modelled pack with the store's own `autoEquipEmpty` —
    the harness used to hand every hire a full fresh kit while the store hired
    a bare body, which overstated a recruit by ~5–9pt of win rate. Reported in **two models**, because the first one was a fiction:

    - the **strict floor** marches through every layer as a battle, refuses every
      merchant, takes no recruits and picks a reward card at random;
    - the **realistic first run** — *the model the invariant gates on* — walks a
      real `generateRunMap` with no meta unlocks, routes the way a player reads a
      map (specials over battles, elites last), shops at merchant nodes at the
      store's real prices, hires at recruit nodes and at the mid-map Crossroads
      with `scaledRecruit`'s real level (roster median −3, not level 1), takes
      shrines it can pay for, and reads the reward cards instead of rolling one.

    Both models fight every layer at the **road's Threat** (`threatAtLayer`,
    Phase 3b): the old per-battle ×1.42, per-stop ×1.13 and per-choice ×1.05
    steps are gone, so a stop's price is the fight it replaces (its XP, gold and
    card) and a hire, a pact or a mutation costs no Threat at all. Both sweeps
    print the **Threat carried into the final boss**, which §6 and §11 now share
    by construction — the old 2–3× exchange rate between the two bands is gone.

    **The policy set.** §11 used to grade one hardcoded routing rule — specials
    over battles, elites last — and describe it as "the way a player reads a
    map". Measured against three alternatives on identical seeds, it is the
    *worst* line available (28% against 41%), so the win-rate gate was being
    satisfied by a badly-played run and the band's ceiling rationale had never
    been tested against good play. Four lines are now measured — the shipped
    heuristic, battles-first, recruits-else-battles, and a state-aware adaptive
    one — and the two edges of the gate are read off the line each edge is a
    question about (see the invariants below). The spread is reported.

    **The loot model is at parity with the store.** `generateItem` and
    `generateRewardCards` used to be called here with `{ luck }` alone while
    every shipped call site passes `roster` (type-aware offers) and `pity` (the
    drought timer); the model also equipped items using a hand-rolled score that
    summed `physDamage + magDamage`, which `computeCombat` never does — it reads
    only the one matching the wielder — so the modelled player bought Greatswords
    for mystics and scored them as upgrades. Buying and equipping are now
    `computeCombat().dps` deltas, and the loot calls carry `roster` and `pity`.
    Together the two corrections were worth +13pt of measured win rate: the
    harness had been grading a player who could not read.

12. **The hub** — every purchasable state of the Watchtower (each unlock alone,
    all three, the two feat-opened services together — Field Kitchen and Relic
    Cartulary — the ramp, everything) played out as whole runs on **paired
    seeds**, against the zero-meta baseline. The map rides its own RNG stream and
    the Cartulary's extra relic its own, so an unlock that reshapes the map or
    widens a hand does not re-deal every later roll behind it. Also checks that each unlock
    delivers the *breadth its card promises* — forks, reachable stops, elites
    with a way around them — measured over 500 generated maps.
13. **The Banner ladder** — every rung played out as whole runs, with the marks
    each run banks computed by `grantRunRewards`'s own formula, so the ladder's
    economy can be read directly: what a rung costs in win rate, and what it
    pays.
14. **Run variety** (WS8) — the battlefields, the wave composition variants and
    the elite modifiers, measured in four parts: the fields' path lengths, slot
    spacing and **marginal** coverage curves (14a); how far apart two shapes of
    the same node are, against how far apart their HP pools and leak ceilings
    are (14b); how much base HP each shape actually puts through random
    depth-scaled lines on both fields (14c — the gate the shapes' budget scales
    are fitted against); and the distribution a seeded run actually draws, plus
    what the node standing beside it gets (14d).

    **Why 14c is not a stop-rate bench.** The §5 standard team stops **100.0%**
    of every variant's leak on the encounters the game ships, at every depth
    tried — a bench with no failure mode, which is trap 2 above. It grades on
    **base HP leaked** by §6-shaped random teams instead, because a 20-HP base
    dies to the four points a 96%-stop wave puts through.

    **Why the HP pools are allowed to differ.** The first version of 14b gated
    "same node, same HP" at ±20% on the theory that equal budget is equal
    fairness. Measured, that theory is wrong: an armour column and a light swarm
    carrying *identical* HP differ by ×2.6 in what they put through the same
    lines, because armour concentrates HP behind resistances and a swarm spends
    it on bodies that die to splash. So the budget is a **price list** — a shape
    worth more per point of HP is sold less of it — the HP ceiling is a loose
    sanity bound at 35%, and the fairness gate is 14c.
15. **Reward cards** — every card graded on its own benches (see REPORT §15).
16. **Combat depth** (Phase 3a, `balance/combat.ts`) — the enemy behaviour kit,
    the boss phases, sub-waves, the Watch Commands and the status
    interactions. Every row is **paired** (same wave, heroes and seeds):
    - 16a — each behaviour on its own bench, with and without the counterplay
      its card states (`BEHAVIOUR_INFO.counter`), read off the engine's own
      `behaviourStats` counter for that behaviour;
    - 16b — the three boss phases, counted across every shipped boss variant;
    - 16c — every generated node shape is cut into the specified 2–3 sub-waves;
    - 16d — **decision value**: a battery of real encounters played by
      different input policies (`PlayerPolicy` in `harness.ts`: command timing
      none / early / surge / finish, five targeting orders, breather
      repositions none / sponge / cover / uncover), in base HP lost per node,
      against the pre-3a game where targeting was the only input;
    - 16e — shatter / spread / brittle, on and off.

### The no-HP pass (heroes are never hurt)

Heroes lost their HP, so a blocker no longer falls partway through a hold. Three
benches that were fitted with a blocker that could die read at their ceiling
afterwards, and were re-pinned the way `BENCH_PIN` already is (trap 5):

- §8's `armour` bench (a Weaponmaster holding twelve Siege Barrels): 44% → 90%,
  now pinned ×1.8 HP (58%). §15's `armour` bench is the same wave and pin.
- §4's `endure` bench (a Weaponmaster holding twenty Siege Barrels): 99%, now
  pinned ×1.6 (60%); `reach` moved to `magic`, because range buys a holder that
  cannot fall nothing on `endure`.
- §2's support table lost Aegis, Bulwark and Warden of Ash: their shield aura
  and the melee they ate went with hero HP, so they are graded as offense in §1.

TNT leak was split rather than added to (leak + blast = the old leak), so every
leak ceiling, and with it §14's fairness gates and `maxLeak`, is unchanged; the
Powderkeg King's TNT is a clock, which `maxLeak` prices as the throws an
unhindered walk down The Green Line gives him.

### Phase 3a changes to how the harness plays a battle

- **The clock is out of the measurement.** §6 used a 70-second cap and booked a
  capped battle as a loss; re-measured with no cap, 38 of 72 "deaths" in a
  150-run sample were the clock, mostly at the boss (honest pre-3a win rate
  73%, not 50%). `maxSeconds` is now a **per-sub-wave** safety net (600s in §6
  and the run simulator) and §6 gates on it firing **zero** times. A cap sized
  for one continuous wave also silently truncated the later sub-waves of every
  other bench, which is why `runBattle` resets it at each sub-wave.
- **Who presses the buttons.** `runBattle({ player })` — the whole-run sweeps
  (§6, §11–§13) play `PLAYER` (Rally Horn when enough of the column is in
  reach, no repositioning, first-in-lane); every bench defaults to `NO_INPUT`.
- **Bench mode.** §4 affixes, §8 mutations, §10 curses and §15 reward cards
  grade an item's stat contribution on scenarios whose pressure was fitted
  (`BENCH_PIN`), and they keep grading it on the shape they were fitted to:
  `BENCH_RULES` (kit, interactions and sub-waves off) and
  `generateEncounter(..., { subWaves: false })` (no cut, no HP step, no
  specialists). The new rules are graded in §16 and in the whole-run sweeps,
  which play with everything on; §2, §5 and §14 grade encounters and also
  play with everything on. Measured on the first full-rules pass, `magic`'s
  baseline fell to 10% (band 15–75%) and eleven item verdicts flipped on a
  bench that had moved under them — and those files are re-tuned in parallel
  by another lane, which is the shared-constant collision the audit names.

15. **Relics** (Phase 3b; merged keepsakes and team stat cards) — the stat half
    graded on the §7-style fight benches as a company-wide grant, the run-rule
    half (Gate heals, tithes, charters, the ledger) by paired whole runs
    (`FW_RELIC_RUNS`, 150). A relic whose rule needs an engine capability that
    has not shipped (`ENGINE_CAPABILITIES`, e.g. `burnSpreadOnDeath`) must be
    out of the pool; the gate fails if one is dealt.

## Invariants (fail the run)

- No build deals zero damage (broken build).
- Offense DPS spread ≤ 3× the median (no dominant outlier).
- Rarity base-stat budget strictly increases per tier.
- Every support **beats** a generic damage tower of its own archetype in the same
  slot — a support kit has to pay for the DPS it costs — by at least one full
  rung of §2's Threat ladder (×1.10 on the three-shape geometric mean; one rung is
  ×1.048, so the gate sits about two rungs clear of the resolution floor). The
  old form of this check asked only for "strictly greater" on rungs 15–33% apart,
  where a tie was the likely outcome and three of seven supports duly tied.
- Every enchantment moves its designated scenario by ≥ +2.0pt. (This is the check
  that would have caught the dead gear `patience` affix.)
- A standard team can clear depth 6 at Threat ×1 (game is winnable).
- The pressure ceiling **finds a break point** inside the ladder, and that break
  point lands in the ×2–×8 design band. A censored ladder is a failure: an
  invariant that cannot fail is not an invariant.
- Monte Carlo win rate inside the **45–60%** design band. (Not the old 10–80%
  smoke test, which a completely degenerate curve passes.)
- Monte Carlo deaths spread across ≥ 3 distinct depths, no single node ends more
  than 60% of lost runs, and the boss kills a nonzero share of the teams that
  reach it (design target ≥ 10%).
- Every mutation has both a measurable cost (≤ −3pt somewhere) and measurable
  power (≥ +3pt somewhere). A `downside` string is not evidence of a downside.
- No curse is a net upgrade in *every* scenario (a fake tradeoff).
- **Spec perks** (§7): every perk moves at least one bench by ≥ +2pt (none is
  dead), and no choice point's two open options are more than 20pt apart on
  the three-bench mean (none is solved).
- **Map pacing** (§9): 50–63% of free-layer nodes are fights (target 55–60%),
  and every free layer offers a fight.
- **Relics** (§15): every rule relic changes something a fight can see (≥ +2pt
  on its best bench), no pact is a cost for nothing, no run-rule relic lowers
  the paired win rate, none sells plain "+x% damage", and nothing in the pool
  needs an engine capability that has not shipped.
- Fresh-player difficulty is a curve, not a cliff: no single node ends more than
  40% of zero-meta runs — checked on **both** §11 models.
- **The zero-meta baseline is winnable and still hard.** Three checks, each on
  the policy it is a question about:
  - *winnable played well* — the **best** line in the policy set wins ≥ 15%;
  - *still hard for a first-timer* — the **shipped heuristic** line wins ≤ 35%
    (design target 15–25%);
  - *the campaign notices a team* — the hub's full ramp is worth ≥ 8pt of win
    rate over zero meta, measured inside one model on identical seeds (§12).
    This is the old ceiling's stated rationale — "the campaign is not noticing
    whether the player brought a team" — turned into a check that can fail. The
    obvious version of it, §6 against §11, compares two models that differ in
    *structure* (§6 has no map to route) as much as in team strength, which is
    why it is not the one that gates.
- **No hub purchase may lower the win rate.** No purchasable state of the hub —
  any unlock alone, all of them together, the ramp, or everything — may measure
  below zero meta by more than the paired noise floor (2 s.e., minimum 3pt) on
  any gated routing line. This is the check that would have caught
  `Cartographer's Table`, a 120-mark "wider forks" unlock that lengthened the map
  by two layers and took the campaign from 40% winnable to 7%, permanently, with
  every invariant in this file green while it did.
- **Each unlock delivers the breadth its card sells**: `Cartographer's Table`
  may not change the *length* of the run and must at least halve the share of
  choiceless steps; `Standing Orders` must leave no Elite standing on a road with
  no way around it; `Free Companies` must add a hiring stop.
- **Every Banner rung is a wager.** A rung must cost **at least 3pt** of win
  rate over the rung below it (a rung that does not is a mandatory bonus, not a
  bet — nobody would fly the rung below it again), and expected **marks per run
  must rise at every step of the ladder** (a rung whose payout does not cover
  the difficulty it adds is a decoration). The old ladder failed both: rung 1
  paid +25% for a rule that costs nothing, and marks/run flatlined at ~100–160
  while the win rate collapsed 32 → 11 → 1%. The cost floor used to be "may
  not *gain* more than 2pt"; Phase 1 tightened it to a 3pt cost, measured at
  `FW_BANNER_RUNS` (600) because 210 cannot resolve 3pt. Under it, Elite Watch
  (−0.8pt alone, −3.0pt over rung 1) was the rung with no teeth; its elites are
  now drawn one depth deeper and it pays ×2.5. Rungs are **earned** — Banner N
  opens by winning a run under Banner N−1 (`metaStore.grantRunRewards`) — not
  bought with marks.
- **A curse is a trade in both directions**: ≥ +2pt of upside somewhere and
  ≥ 2pt of cost somewhere. The old form asked only that a curse not be a net
  upgrade in *every* scenario, which is satisfied by a curse that does nothing —
  and by one that is simply bad. Both had shipped.
- **The tactical layer has input randomness, and it is input randomness** (§14).
  Six checks, split so that "varied" and "fair" can fail separately:
  - *more than one battlefield ships*, their path lengths are within 6% of each
    other (crossing time is the one difficulty axis Threat does not multiply, so
    a longer field is a quietly easier game), no two build slots are closer than
    90 logical px (the canvas hit test caps its radius at 80 and resolves
    nearest-wins), and their **marginal-coverage curves** are ≥ 8% apart — a
    second map that does not change the placement decision is wallpaper;
  - *two shapes of the same node are ≥ 35% apart* in composition
    (total-variation distance over the enemy mix), while their HP pools stay
    within 35% and their leak ceilings within ×1.6;
  - *no shape is a free win*: against random unadapted depth-scaled teams on
    both fields, the leak one node's variants put through spans ≤ **×2.0**;
  - *a seeded run actually draws the variety*: the rarest field lands in ≥ 30%
    of seeds, every node draws ≥ 2 distinct shapes with the rarest at ≥ 12%, and
    two battle nodes standing in the same map layer differ by ≥ 30% composition
    distance — a fork between two identical fights is not a fork.
- **Combat depth (§16).** Every behaviour fires on its bench and its stated
  counter measurably reduces it; every boss phase triggers in the shipped boss
  fights; every node shape is cut into 2–3 sub-waves; the Rally Horn used well
  is worth between 0.05 and 3 base HP per node over never pressing it (a
  command must matter and must not be the game); each interaction fires.
- **The clock never decides a run**: zero §6 battles may end on the harness cap.
- **The affix bench stays in the band it can resolve in.** §4's `phys` / `magic`
  scenarios borrow real encounters, so a change to the campaign's difficulty
  curve silently re-scales the bench every affix is graded on. They are pinned
  (`BENCH_PIN`) to the pressure they were fitted at, and their baseline stop
  rates must stay inside 15–75%: at the floor every affix reads +0 because the
  build is already losing, at the ceiling because it is already winning.

**After the no-HP pass** (heroes are never hurt, then one tuning pass on the
danger ground, the Threat curve, the Swarm shape's budget and the trade-off
costs) all of these are green **except two, each within a point of its gate**:
§11's strict floor ends 41% of its runs at the depth-6 elite (max 40%), and on
§12's battles line the Field Kitchen + Relic Cartulary row reads −6pt against a
±5pt paired noise floor. Both moved by 2–3pt between Threat curves that differ
in the second decimal, and each curve that closed one of them opened another of
the noise-level gates (§13's Thin Pickings cost, §16d's Rally value, §14c's
Swarm row), so they are reported rather than chased; the curves tried are
tabulated in `src/game/run/threat.ts`. (The old red one, `cx_frenzied`, went
green in an earlier pass.)

Where a red one was closed by
changing a *measurement* rather than the game, REPORT.md carries the old metric
beside the new one and the argument for the swap; where it was closed by changing
the game, the constant carries the before/after numbers in its doc comment. The
latest run's output is in [`REPORT.md`](./REPORT.md).

## Files

- `harness.ts` — builders (`buildSpec`, `freshHero`), gear generation, wave
  construction (`makeWave`, `scaleWave`, the pressure models), the engine runner
  `runBattle`, the `stopRate` metric, the multi-seed helpers, and the shopping
  model (`heroDps` / `bestSlotGain` / `equipIfBetter`, all `computeCombat`
  deltas). Reusable for ad-hoc experiments.
- `runsim.ts` — one whole campaign run, with the hub state, the Banner and the
  routing policy as *arguments*. §11, §12 and §13 all drive this one simulator,
  which is what makes their numbers comparable rather than three opinions.
- `report.ts` — the sweeps, the report writer, and the invariant gate.
- `meta-sweep.ts`, `fit-curve.ts` — Node-only exploration CLIs (see the top of
  this file). Not gates.
