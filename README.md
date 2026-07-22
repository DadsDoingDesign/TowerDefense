# Fieldwatch

A roguelite tower-defense autobattler (working title), inspired by the class-tree
autobattler _Doomfields_ and reimagined as a Slay-the-Spire-style tower defense.

Recruit up to five **Sentinels** (tower units), place them along a fixed path, set
team tactics, then let each wave auto-resolve. Sentinels level up _during_ a run and
branch into specialized forms. Runs are permadeath; meta-progression persists in a hub.

> Status: **Milestone 1 complete** — core wave/combat loop. See the roadmap below.

## Tech stack

- **Vite + React + TypeScript** — app shell, UI panels, screen flow.
- **Canvas 2D** — the battle view (field, path, towers, enemies, projectiles, effects).
  Chosen over WebGL/PixiJS for a small bundle and fast mobile load; the tower-defense
  entity counts don't need a GPU renderer yet.
- **Zustand** — game/meta state (will persist to `localStorage` for the hub).
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
  main.tsx, App.tsx          App entry + screen shell
  game/
    core/                    vec math, arc-length path, seeded RNG
    data/                    maps, enemies, wave generation, sentinel templates
    engine/                  battle simulation (GameEngine) + stat derivation
    render/                  Canvas 2D renderer
  state/                     Zustand store (setup ⇄ battle flow)
  ui/
    screens/                 BattleScreen
    components/              TopBar, Roster, WavePreview, BattleControls, ResultOverlay
    BattleCanvas.tsx         requestAnimationFrame loop + tap-to-place input
  styles/                    global tokens + component CSS
```

### How the battle loop works

`BattleCanvas` runs a single `requestAnimationFrame` loop. During a wave it steps the
`GameEngine` by the frame delta (scaled by the 1×/2×/3× speed), draws every frame from
the engine's live arrays, and pushes a lightweight HUD snapshot to the store ~10×/sec so
React re-renders stay cheap. Between waves the same canvas renders the map, slots, and
placed towers, and handles tap-to-deploy input. The engine owns all mutable combat state
and reports a `BattleResult` (gold, per-Sentinel kills/damage/XP, base HP left) on finish.

## Roadmap (milestones)

1. ✅ **Core wave/combat loop** — fixed path, escalating waves, placeholder Sentinels
   (Fighter / Rogue / Mystic) on fixed slots, Canvas 2D battle, speed toggle, win/lose.
2. ⏳ Archetype branching (3 → 9 → 27) with per-branch abilities and in-run leveling.
3. ⏳ Itemization — base stats + random enchantments + rarity, Reforge / Increase Rarity.
4. ⏳ Node map — Standard / Elite / Merchant / Shrine / Recruit, branching paths.
5. ⏳ Meta-progression hub + permadeath reset, Dark Sacrifice prestige.
6. ⏳ Endless Watch (Arena) mode with the Rooms economy.
7. ⏳ Polish — tactics/behavior settings, richer enchant-proc feedback.
