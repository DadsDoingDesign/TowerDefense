# Fieldwatch — project notes for Claude

A roguelite tower-defense autobattler. Vite + React + TypeScript + Canvas 2D +
Zustand. Art direction: **Tiny Swords** (Pixel Frog, CC0) — the `tinyswords`
sprite pack/theme is the default.

## Working practice — review after every task

**After any task that changes visuals or gameplay feel, run the design review
loop in `docs/DESIGN_REVIEW.md` before committing.** Render the real result,
score it against the checklist, benchmark it against the reference games, fix
the top issues, and re-render until it passes. Don't ship a first pass as final
just because it works — "it renders" is not "it's good".

For visual changes, verify with a real screenshot (a render harness that calls
the actual draw code, or the running app via Playwright), never an assumed
result. Append a short note to the review log when you're done.

## Where things live

- Sprites: `public/assets/sprites/<pack>/` (role-named PNGs). Loader
  `src/game/render/sprites.ts`; themes `src/game/render/themes.ts`.
- Battle rendering: `src/game/render/renderer.ts` (`drawField` → terrain +
  level dressing, `drawSentinel`, `drawEnemy`).
- Enemies `src/game/data/enemies.ts` (goblin factions torch/tnt/barrel, tiers
  1–5); waves `src/game/data/waves.ts`.
- Towers/archetypes `src/game/data/archetypeTree.ts` + `sentinels.ts`.
- UI in `src/ui/`; design tokens in `src/styles/global.css`.
- **Root Shell** — `src/ui/shell/` is **the UI the game loads**: one screen,
  four bands, see `docs/FIGMA.md`. Mobile-only by design (520px cap). The old
  screens in `src/ui/screens/` survive behind `?shell=0` purely for comparison
  and are slated for deletion; both read the same store. They are **lazy** —
  `App.tsx` reaches them through `React.lazy(() => import('./ui/screens/LegacyApp'))`,
  so they cost a chunk nobody fetches rather than a slice of every download
  (H14). Their CSS is lazy too — `src/styles/legacy.css` is imported from
  `LegacyApp.tsx`, and `src/styles/app.css` is now only the ~8% of it the shell
  still needs. Before adding a rule, check which of the two it belongs in; both
  headers say what they hold.
- Anything the two UIs must agree on — archetype glyphs, currency marks, the
  rarity tokens, the targeting-order labels — lives in `src/ui/channels.ts`.
  Import it. Every local copy of one of those has gone stale so far.

## Conventions

- Sprite pack files are role-named; add new roles to `ROLE_NAMES` in
  `sprites.ts` or they won't preload — and add them to the pack's entry in
  `PACK_ROLES` too, since only the ACTIVE theme's pack is fetched at boot (M37)
  and each pack declares what it actually ships.
- Keep the enemy lane and build slots visually clear — decoration frames the
  map at its margins (see the review checklist).
- Typecheck with `npx tsc --noEmit` before committing.
