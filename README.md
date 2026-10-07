# Fieldwatch

A roguelite tower-defense autobattler (working title), inspired by the class-tree
autobattler _Doomfields_ and reimagined as a Slay-the-Spire-style tower defense.

Recruit up to five **Sentinels** (tower units), place them along a fixed path, set
team tactics, then let each wave auto-resolve. Sentinels level up _during_ a run and
branch into specialized forms. Runs are permadeath; meta-progression persists in a hub.

> **Proprietary — all rights reserved.** Not open source; see [`LICENSE`](./LICENSE).
> Third-party components: [`public/licenses/THIRD_PARTY_NOTICES.md`](./public/licenses/THIRD_PARTY_NOTICES.md).
>
> Status: all seven original milestones shipped, plus three audit phases
> (`docs/AUDIT_2026-08-20.md`). In active development: art replacement
> (`docs/HANDOFF.md`) and the improvement plan.

## Tech stack

- **Vite + React + TypeScript** — app shell, UI panels, screen flow.
- **Canvas 2D** — the battle view (field, path, towers, enemies, projectiles, effects).
  Chosen over WebGL/PixiJS for a small bundle and fast mobile load; the tower-defense
  entity counts don't need a GPU renderer yet.
- **Zustand** — game, meta and settings state; meta, settings and the mid-run snapshot persist to `localStorage`.
- **Plain CSS** with design tokens — no CSS framework dependency; mobile-first, one-handed.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build
```

## Project structure

```
src/
  main.tsx, App.tsx          App entry; loads the Root Shell
  pwa.ts                     service-worker registration (worker generated in vite.config.ts)
  audio/                     procedural SFX, the score, and the music director
  game/
    core/                    vec math, arc-length path, seeded RNG
    data/                    archetype tree, sentinels, enemies, waves, items, rewards,
                             mutations, run map, battlefields
    engine/                  deterministic battle simulation (GameEngine) + combat maths
    run/                     pure run rules (no zustand/React/DOM): threat, economy +
                             merchant roll, recruits, rewards, settle payout, inventory
    render/                  Canvas 2D: renderer.ts facade over terrain / units / plaques /
                             overlays / projectiles / blit / paint; fx.ts (effects),
                             fxDiff.ts (per-battle tick differ); sprites/themes, loadouts
  state/
    gameStore.ts             barrel for the run store (useGameStore + constants)
    game/                    the run store: one zustand store from slices (run, endless,
                             battle, events, roster, shell), runtime.ts, persistence.ts
    metaStore.ts, settingsStore.ts, runSnapshot.ts, daily.ts
  ui/
    shell/                   Root Shell — the UI the game ships (see docs/FIGMA.md)
    components/              RunMapView + EvolutionModal (rendered by the shell)
    channels.ts              shared UI vocabulary (glyphs, rarity tokens, labels)
    BattleCanvas.tsx         requestAnimationFrame loop + tap-to-place input
  styles/                    design tokens (global.css) + shell/page CSS
public/
  assets/                    sprite packs, UI art, Kenney UI sounds (see CREDITS/CC0-MANIFEST)
  licenses/                  third-party licence texts, shipped with every build
balance/                     deterministic balance harness (npm run balance)
harness/                     art vertical-slice harness (docs/HANDOFF.md)
```

### How the battle loop works

`BattleCanvas` runs a single `requestAnimationFrame` loop. During a wave it advances the
`GameEngine` in fixed `TICK` steps through an accumulator; the 1×/2×/3× speed runs more
ticks per frame, never bigger ones, so a seeded battle is identical at any speed or
frame rate. It draws every frame from
the engine's live arrays, and pushes a lightweight HUD snapshot to the store ~10×/sec so
React re-renders stay cheap. Around every tick a per-battle `FxDiffer`
(`src/game/render/fxDiff.ts`) snapshots the engine and derives the presentation events
(impacts, kills, leaks, procs) from the difference, so the sim never emits them. Between
waves the same canvas renders the map, slots, and placed towers, and handles tap-to-deploy
input. The engine owns all mutable combat state
and reports a `BattleResult` (gold, per-Sentinel kills/damage/XP, base HP left) on finish.

## Roadmap (milestones)

1. ✅ **Core wave/combat loop** — fixed path, escalating waves, Fighter/Rogue/Mystic on
   fixed slots, Canvas 2D battle, speed toggle, win/lose.
2. ✅ **Archetype branching (3 → 9 → 27)** — data-driven ability mods, in-run leveling,
   evolution choices; engine gains blocking, DoTs, CC, thorns, auras, Patience (heroes have no HP — only the Gate can be hurt).
3. ✅ **Itemization** — base stats + rolled enchantments + rarity ladder, Keepsakes
   (team buffs), Reforge / Increase Rarity sinks, equip UI, loot drops.
4. ✅ **Node map** — Slay-the-Spire DAG with Standard / Elite / Merchant / Shrine /
   Recruit / Boss nodes and branching paths.
5. ✅ **Meta-progression hub + permadeath** — Watch Marks, upgrades, Dark Sacrifice
   prestige, lifetime stats, persisted to localStorage.
6. ✅ **Endless Watch (Arena)** — 200 Gold / 30 Dust / 3 lives, Rooms economy
   (Merchant / Forge / Shrine / Recruit), escalating AI waves, win counter.
7. ✅ **Polish** — team Tactics (focus priority + hold-fire), proc/aura/reticle
   visual feedback, mobile-first layout throughout.

## Compounding difficulty (Threat)

A campaign run is one continuous, escalating defense: base HP, roster, gear, and
evolutions all persist across nodes. Hero posts carry from fight to fight within
an act, but **the road changes country at every city**: each act is fought on its
own battlefield (`src/game/run/fields.ts`), and the company starts that act's
first fight on the bench, to be posted afresh. A **Threat** multiplier
compounds as you clear nodes (more for elites) and as you gain power (shrines,
recruits), scaling enemy HP so the opposition keeps pace with your growing
strength. Threat is shown on the map header and in the pre-wave preview.

## Testing

Two automated test assets:

- **Vitest unit tests** in `tests/` — starting with engine determinism (same seed
  ⇒ identical battle at 1×/2×/3×).
- **The balance harness** — a deterministic, seeded simulation that drives the
  real `GameEngine` headlessly and gates on balance invariants.

```bash
npm test            # Vitest (tests/**/*.test.ts)
npm run balance     # 15 sweeps against the live engine; writes balance/REPORT.md
                    # and exits non-zero on any failed balance invariant.
npm run typecheck   # tsc -b --noEmit over src/, harness/, vite/vitest configs, balance/, tests/
npm run build       # type-check + production build
```

CI (`.github/workflows/ci.yml`) runs typecheck, tests and build on every pull
request and push to `main`, and the balance harness when the simulation or its
data change. `balance/REPORT.md` is deterministic, so CI fails if the committed
copy is stale.

See [`balance/README.md`](./balance/README.md) for what each sweep measures and
which invariants gate the run.

**What does not exist yet:** unit tests for tree integrity, item generation, map
connectivity, save migration, or meta/endless economy, and no Playwright
dependency. Tree, item, map and
economy behaviour is exercised only indirectly, through the balance sweeps.

`npm run ui-audit` (`scripts/ui-audit.mjs`) is a screenshot harness that is
currently **non-functional** — it imports `playwright-core`, which is not
installed, and hard-codes a Linux Chromium path. See the header of that file.
