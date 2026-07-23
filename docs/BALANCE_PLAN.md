# Fieldwatch — Balance & Systems Redesign Plan

Companion to `docs/BALANCE_AUDIT.md`. Locked decisions + phased build.

## Locked decisions

1. **Upgrade tree = Augment.** The existing 3→9→27 evolution tree stays as the
   tower's spec identity. A new purchasable per-tower upgrade panel (3 paths ×
   3 levels, with tradeoffs) sits on top, unlocked at XP milestones.
2. **Defensive layer = Prune to offense/utility.** Remove `magDef` (never read)
   and dead `Sentinel.attack`. Off-hand and body items grant offense & utility
   (range, crit, splash, on-hit effects, auras, attack speed) so no slot is dead
   on any tower. HP / physDef / block / thorns remain the fighter "Guardian"
   line's identity only.
3. **Rarity = 5 tiers.** Common / Rare / Epic / Legendary / **Mythic**, applied
   consistently to items, reward cards, and upgrade nodes. **Mutations are always
   Mythic** (super-rare) and always carry a downside tradeoff.

## Phases

- **P1 — Stat model + itemization cleanup.** Remove `magDef`/`Sentinel.attack`;
  re-slot off-hand/body item bases to offense/utility; add gear paths for
  `range`/`splash`/`critMult`; fix the 7:3 physical/magic weapon skew; write the
  per-stat descriptions into the UI/tooltips.
- **P2 — Rarity unification + tradeoffs.** Add the Mythic tier; add negative-effect
  affixes to a rare subset of items; every mutation gets a real downside.
- **P3 — Even-coverage pass.** Rebalance so over-covered mults aren't 4-sourced
  and untouched mods (projectileSpeed, support/CC) get a home; give reward cards
  rarity + occasional tradeoffs.
- **P4 — Per-tower upgrade trees.** 3 paths × 3 levels, XP-milestone gated,
  tradeoffs; items/mutations grant free levels or bias a path; clicking a placed
  tower opens the upgrade panel instead of removing it.
- **P5 — Drag-and-drop inventory manager.** Replace the click-through equip flow.
- **P6 — Map special-tile pacing.** Caps + minimum spacing; minimal specials.
- **P7 — Balance testing platform.** Extend the harness (tradeoff / negative-item /
  upgrade-tree / map sweeps), tighten invariants, tune to a target win-rate band.
