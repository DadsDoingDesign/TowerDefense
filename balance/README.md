# Balance harness

Automated balance testing for Fieldwatch. It drives the **real combat engine**
headlessly with a seeded RNG (fully reproducible) and writes a report.

```bash
npm run balance          # runs the sweeps, writes balance/REPORT.md, exits non-zero on failure
```

## What it checks

Exhaustive where feasible, Monte-Carlo where the space is combinatorial:

1. **Specialization throughput** — all 27 tier-2 builds fight a fixed wave solo;
   ranks empirical DPS and flags statistical outliers (>2σ). Supports are tagged
   and judged separately.
2. **Support value** — measures the clear-time / base-HP uplift each support
   build (cleric/guard line) adds to a two-DPS control team.
3. **Item rarity ladder** — averages base-stat budget and enchant count over 400
   rolls per tier; asserts the ladder is monotonic.
4. **Enchantment strength** — equips each affix alone on a fixed build and reports
   its % DPS uplift, exposing over/under-tuned affixes.
5. **Threat ceiling** — a standard team faces rising Threat at fixed depth to find
   the break point.
6. **Monte Carlo full runs** — 150 random teams (3–5 specs) play depths 1→10 with
   team power scaling to mirror real progression and Threat compounding per node;
   reports win rate and depth distribution.

## Invariants (fail the run)

- No build deals zero damage (broken build).
- Offense DPS spread ≤ 3× the median (no dominant outlier).
- Rarity base-stat budget strictly increases per tier.
- A standard team can clear depth 6 at Threat ×1 (game is winnable).
- Monte Carlo win rate within **10–80%** (not trivial, not impossible).

The latest run's output is in [`REPORT.md`](./REPORT.md).

## Files

- `harness.ts` — builders (`buildSpec`), gear generation, and `runBattle` (the
  engine runner returning comparable metrics). Reusable for ad-hoc experiments.
- `report.ts` — the sweeps, the report writer, and the invariant gate.
