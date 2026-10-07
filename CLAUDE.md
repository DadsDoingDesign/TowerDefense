# Merchant Mercenaries (repo: fieldwatch) — project notes for Claude

A roguelite tower-defense autobattler, formerly Fieldwatch (renamed Oct 2026:
see `docs/BRAND.md`; storage keys and the `fieldwatch` sprite pack keep the old
id on purpose). Vite + React + TypeScript + Canvas 2D +
Zustand. Art direction: **Tiny Swords** (Pixel Frog) — **old CC0 build only**;
the `tinyswords` sprite pack/theme is the default. Never import files from the
current Tiny Swords download (not CC0); `npx tsx scripts/harvest-cc0.ts --check`
verifies provenance.

**This is proprietary, commercial software** (see `LICENSE`). Every third-party
asset or package added must allow commercial use and be recorded in
`public/licenses/THIRD_PARTY_NOTICES.md` (plus `CC0-MANIFEST.md` /
`sprites/CREDITS.md` / `docs/AUDIO_CREDITS.md` for its category). No CC-BY-SA /
GPL / non-commercial material, and nothing without a verifiable licence.

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
- Battle rendering: `src/game/render/renderer.ts` is a facade (public names +
  `drawBattleEntities`) over `terrain.ts` (`drawField`, baked once per map),
  `units.ts` (`drawSentinel`, `drawEnemy`), `plaques.ts` (tier/elite plaque),
  `overlays.ts` (slots, ranges, reticles, base gate), `projectiles.ts`,
  `blit.ts` (the 1:1 sprite blit + census), `paint.ts` (colour helpers) and
  `frame.ts` (presentation clock, view scale). Import from `renderer`.
  What a hit LOOKS like is `attackLook.ts` (pure: delivery by weapon — a
  melee hero's hit is a blade arc, never a drawn projectile — and the one
  on-hit effect palette); the hero's real weapon/off-hand on the figure is
  `gearMarks.ts` (atlas cells in the fists; the painted Tiny Swords weapon is
  cut when the hero holds something else). The atlas order and item-noun →
  icon table live in `src/game/data/iconAtlas.ts` (re-exported by `channels`).
- FX: `src/game/render/fx.ts` draws effects; `fxDiff.ts` derives them from the
  engine tick by tick — one `FxDiffer` per battle, created by `BattleCanvas`,
  no module-level state. `tests/fxDiff.test.ts` drives it on synthetic ticks.
- Run store: `src/state/gameStore.ts` is a barrel — import `useGameStore` and
  the constants from there. The store is `src/state/game/`: ONE zustand store
  combined from action slices (`runSlice`, `contractSlice`, `battleSlice`,
  `eventsSlice`, `rosterSlice`, `shellSlice`) over the data in `types.ts`;
  RNG streams, the hub flag, the wave-beat timer and session ownership live in
  `runtime.ts`; snapshot autosave in `persistence.ts`; settle-once in
  `settle.ts`. RNG draw ORDER is part of behaviour: keep it when editing.
- Pure run rules (no zustand/React/DOM, unit-tested in `tests/run.rules.test.ts`
  and read by the balance harness): `src/game/run/` — `threat.ts`,
  `economy.ts` (prices, merchant shelf), `recruits.ts`, `rewards.ts`,
  `settle.ts` (payout plan), `inventory.ts`, `map.ts`, `battle.ts`. Put a new
  rule here, not in a slice.
- Enemies `src/game/data/enemies.ts` (goblin factions torch/tnt/barrel, tiers
  1–5); waves `src/game/data/waves.ts`.
- Towers/archetypes `src/game/data/archetypeTree.ts` + `sentinels.ts`.
- UI in `src/ui/`; design tokens in `src/styles/global.css`.
- **Root Shell** — `src/ui/shell/` is **the UI the game loads**, and the only
  one: one screen, four bands, see `docs/FIGMA.md`. Mobile-first (a 520px
  column on phones); tablet and desk re-flow the same bands in
  `src/styles/shell-wide.css` (FIGMA.md § Wide layout). Copy that says "Tap"
  uses `<Tap />` / `tapWord()` from `src/ui/pointer.tsx`. The pre-shell screens (`?shell=0`) were deleted. The only
  component outside `shell/` is `src/ui/components/RunMapView.tsx`, rendered
  by the shell (the evolution and perk modals went with SK1 — a skill choice
  is made in the Context panel, `LevelUpPanel`). Eager non-shell CSS it (and
  BattleCanvas) needs lives in `src/styles/app.css`.
- Skills (SK1): the library `src/game/data/skills.ts`; in-run rules (offers,
  slots, swap/bump, the hero pick, a hire's skill, old-save mapping)
  `src/game/run/skills.ts`; the generic unlock roll (`rollFromPool`)
  `src/game/run/watch.ts`. Every skill roll is a fresh RNG hashed from (run
  seed, purpose, hero id) — never a draw on a run stream.
- The mercenary company (spec: `docs/MERCENARY_COMPANY.md`): gold is the only
  currency (purse for the run, bank at home, `metaStore.bank`). Companies
  `src/game/data/companies.ts`; contracts, stakes, city pay and cash-out
  `src/game/run/contracts.ts`; standing per company `src/game/run/standing.ts`;
  the store side is `contractSlice`. A hero has no class: its role comes from
  its gear (`src/game/data/gear.ts`); `archetype` survives only as an art key and
  in old-save migration. The Daily and Endless modes were removed.
- Service worker: generated after every build by `build/pwa.ts` from the
  template `src/sw/sw.template.js`; registration and the "update ready" signal
  (`isUpdateReady` / `applyUpdate`) live in `src/pwa.ts`, surfaced at the hub by
  `src/ui/UpdateNotice.tsx`. A new build WAITS; it never takes over a running
  page. The precache is derived from the files the DEFAULT theme draws across
  its per-role fallback chain (`themeAssetPaths` in `sprites.ts`) plus
  whatever the emitted code names — see `planPrecache`.
- Run snapshot load/validation: `src/state/runSnapshot.ts` — every field a
  save can put into arithmetic is validated, and `tests/runSnapshot.fuzz.test.ts`
  mutates a real snapshot ~15k ways to prove it. Extend the validators (and the
  fuzz's base run) when you add a snapshot field.
- Paper-doll compositor `src/game/render/loadout.ts`. Anchors are generated per
  PACK by `npm run anchors` (`scripts/anchors.ts` + `anchors-lib.ts`) into
  `anchors.generated.ts`; `anchors:check` in the build also fails if any gear
  piece would overhang a hero cell.
- Pick one, then read: every choose-one surface that does not commit on the
  tap (contract board, hero pick, recruit, city payout, skill milestone) is a
  `PickStrip` of picture tokens + one `PickCard` for the focused option
  (`src/ui/shell/PickStrip.tsx`, `src/styles/pick.css`; a rail on desk). Reuse
  it for a new one; a token focuses, the CTA names the choice and commits.
- Anything several UI surfaces must agree on — archetype glyphs, currency marks, the
  rarity tokens, the targeting-order labels — lives in `src/ui/channels.ts`.
  Import it. Every local copy of one of those has gone stale so far. A table the
  CANVAS also needs lives under `src/game/data/` (e.g. `glyphs.ts`, the archetype
  glyph) and `channels.ts` re-exports it — `game/` must not import `ui/`.

## Conventions

- Sprite pack files are role-named; add new roles to `ROLE_NAMES` in
  `sprites.ts` or they won't preload — and add them to the pack's entry in
  `PACK_ROLES` too: each pack declares exactly what it ships, and each role is
  drawn from the first pack in the theme's fallback chain that ships it
  (`fieldwatch` → `tinyswords`, at each pack's own density). Preview the new
  pack with `?art=fieldwatch`; see `docs/HANDOFF.md` §6.4.
- Keep the enemy lane and build slots visually clear — decoration frames the
  map at its margins (see the review checklist).
- Never put `.js`, `.css` or `.woff2` files under `public/assets/`: `vercel.json`
  serves every such file under `/assets/` as `immutable` for a year, which is
  only safe for Vite's content-hashed output.
- Run `npm test` (Vitest, `tests/`) alongside the typecheck. CI
  (`.github/workflows/ci.yml`) runs typecheck, tests and build on every PR, and
  `npm run balance` when `src/game`, `src/state` or `balance/` change. The
  committed `balance/REPORT.md` is a golden file: commit it regenerated.
- Typecheck with `npm run typecheck` (`tsc -b`) before committing. Plain
  `npx tsc --noEmit` checks nothing: the root tsconfig has `"files": []` and
  only `-b` follows its project references — `tsconfig.app.json` (src,
  harness), `tsconfig.node.json` (vite/vitest config, build/, balance, tests)
  and `tsconfig.scripts.json` (scripts/).
