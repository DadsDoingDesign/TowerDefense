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
  cut when the hero holds something else, and the knight's painted shield is
  flood-cut by `cutOffHand` unless the off hand holds a Shield); the body
  piece is WORN, `bodyLayer.ts`: the tunic of every frame is measured off the
  strips by `npm run anchors` into `bodyAnchors.generated.ts` (`anchors:check`
  fails if stale or if a piece paints outside its cell), re-inked in the
  piece's icon colours and given its silhouette (pauldrons, skirt, hem, a cape
  behind), after the cuts and before the bake, one canvas per (strip, piece).
  `units.heroFigure` is that ONE composition; every hero portrait in the shell
  is cut from it (`heroPortrait.ts`, a bust data URL per (look, kit), read only
  through `offers.heroLookArt`; `RootShell` re-renders when the art lands;
  `tests/heroPortrait.test.ts`). Review harness `harness/kit.html`, app shots
  and the frame-time probe `scripts/kit-look.mjs`. The atlas
  order and item-noun → icon table live in `src/game/data/iconAtlas.ts`
  (re-exported by `channels`); every item kind has its own cell
  (`scripts/item-assets.ts` reports 0 shared).
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
- Hiring (the gameplay pass, Oct 2026): there are no recruit stops on the map.
  A hero is hired only at a city — every act boss before the last, the
  Sovereign Route's waypoints too: the Crossroads (`screen: 'crossroads'`)
  offers the city's candidates (`run/recruits.citySlate`, a hash of run seed
  and city, three; four with the HQ's Hiring Hall, which also trains them to
  the company's level), or a mutation instead, or nobody. Drawn as the
  recruiting yard (`StopScene` 'recruit'). An old save's recruit node loads
  as a battle (`runSnapshot.asBattle`).
- Assisted runs (the gameplay pass): a run is `assisted` (GameData, snapshot
  v19) once the assist dial is off `off` at any point of it — never cleared
  mid-run. **Every leaderboard, ranking or record reads
  `src/game/run/ranking.countsForRanking(run)` and nothing else** (an assisted
  run or a custom seed: false). Today it keeps the best depth, best stake and
  the stake record clean; gold, standing, unlocks, feats and the trade war
  still pay (Hades/Celeste: mark, never punish). Marker: `AssistedTag` on the
  HUD and the result. Tests `tests/ranking.test.ts`.
- Pure run rules (no zustand/React/DOM, unit-tested in `tests/run.rules.test.ts`
  and read by the balance harness): `src/game/run/` — `threat.ts`,
  `economy.ts` (prices, merchant shelf), `recruits.ts`, `rewards.ts`,
  `settle.ts` (payout plan), `inventory.ts`, `map.ts`, `battle.ts`. Put a new
  rule here, not in a slice.
- Procedural battlefields: every act of a run is fought on a generated road
  (`run/fields.actFieldId`: a profile that is not the act before's, and a
  road seed, each hashed from (run seed, act)). `src/game/data/fieldGen.ts`
  deals a road from (seed, `FieldWeights`) on a lattice two tiles apart
  (2,220 or 2,300px, like the hand-made fields); `scoreField` keeps it only
  inside the weights' bands; `layRuleGround` lays the flooded / wildfire
  ground on the bends' best tiles. A generated field's id is its recipe
  (`gen.<profile>.<seed>`) and `maps.mapById` / `fieldFor` rebuild it, so a
  save stores it like any id. The hand-made Green Line and Kiln Road stay as
  the fallback and the balance suite's fixed benches. Gallery:
  `harness/fields.html`; tests `tests/fieldGen.test.ts`, `tests/fields.test.ts`.
- Enemies `src/game/data/enemies.ts` (goblin factions torch/tnt/barrel, tiers
  1–5); waves `src/game/data/waves.ts`. Armour: Plated / Warded (`ENEMY_MODS`)
  reach `ARMOUR_CAP` (65%), everything else stops at `RESIST_CAP` (55%), and
  each leaves the other damage type open. The elite columns wear one, and so
  does a share of ordinary fights (`waves.nodeArmour`, leaning to the road's
  `Company.armour`). The run map tabs every such node (`.mn-armour`, via
  `encounterPreview.nodeModFor`). `balance/armour-eval.ts` measures fairness.
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
- Company asks (Draft 4 · A): `src/game/run/asks.ts` — each company's three
  asks, the deal (two per contract, three from three companies on the
  Sovereign Route; a hash of run seed and company, never a draw), counting,
  judging and the pay (standing XP, a tip on delivery, via `settle.contractGrant`).
  Progress rides `RunContract.asks`; the engine's `burningKills` feeds one.
  UI `ui/shell/contracts/AskParts.tsx` and `ui/shell/AskToast.tsx`; targets
  fitted by `npx tsx balance/ask-rates.ts`.
- The trade war (Draft 4 § D, simplified Oct 2026): pure rules
  `src/game/run/tradeWar.ts` — seasons of 7 finished contracts (counted at
  the settle, from the market's opening; `log` keeps them in order for the
  home's bars, `seasonBars`), whole shares summing to 100 (`moveShares`), the
  crown on an outright leader only (`seasonLeader`: a tie crowns nobody), and
  the season's end (`endSeason`): your **patron** — the company you delivered
  the most for (`seasonPatron`; a tie goes to the bigger share, then a hash)
  — pays 75 gold a delivery and a vault pick; the last that hires you posts
  desperate terms (`contracts.DESPERATE_PAY` / `DESPERATE_STRENGTH` via
  `ContractTerms.desperate` and `contractRules`). No exclusives, rivals or
  cold (cut: `docs/MERCENARY_COMPANY.md` § D). Saved as `metaStore.season`
  (`readSeason`); the settle is `metaStore.settleContract`. UI
  `src/ui/shell/war/` (the standings and their season card —
  `seasonCardCopy.ts` is its words — the season's end, the desperate fact on
  the terms) with `src/styles/war.css`; the crown is `pixel.Crown`. Tests
  `tests/tradeWar.test.ts`, `tests/seasonCardCopy.test.ts`.
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
  tap (hero pick, a city's hire, city payout, skill milestone) is a
  `PickStrip` of picture tokens + one `PickCard` for the focused option
  (`src/ui/shell/PickStrip.tsx`, `src/styles/pick.css`; a rail on desk). Reuse
  it for a new one; a token focuses, the CTA names the choice and commits.
  Every offer board that commits on its CTA (the spoils, the merchant) is
  one through `OfferPick.tsx`, not rows. Every stop (merchant, campfire, shrine, and a city's
  hiring yard) is drawn as a place
  with someone in it talking to you: `StopScene.tsx` draws a pixel scene
  baked from the CC0 pack by `npx tsx scripts/stop-scenes.ts`
  (`public/assets/scenes/<stop>.png` + `stopScenes.generated.ts`, the
  anchors), the page's title hung on it as the place's sign (`stops.css`),
  and the keeper's line for that node (`stopScene.ts`, spoken, ≤ 40 chars)
  in a speech bubble. The clerk holds up the ware you are looking at; the
  campfire's flame is the pack's fire strip. Re-run the script after
  changing a scene. The merchant's goods sit under it (`ShopFront.tsx`,
  `styles/shop.css`: wares on a shelf, services on a counter). It sells goods only, with no hire on the counter.
  Each company's liaison (Draft 4 · D) talks the same way: words in
  `src/game/data/liaisons.ts`, which line when (board / city / receipt, a
  hash, never a run stream) in `src/game/run/liaison.ts`, drawn by
  `LiaisonScene.tsx` (+ `liaisons.css`) on the company's post that the same
  script bakes (`scenes/liaison-<company>.png`); tests `tests/liaisons.test.ts`.
  The contract board is the HOME, and the home is the map (Oct 2026, the
  map-first home, `MenuScreen` + `menu.css`): the trade map fills the screen
  and three slim layers float over it — the bar (the purse plaque: seal and
  bank; one carved plate per place, its mark and name; under the purse, the
  season panel: seven bars from `tradeWar.seasonBars`, `ui/shell/homeSeason.ts`),
  the foot (the company dock: exactly five fixed slots in `COMPANY_IDS`
  order, the order the map fans its roads west→east, pure model
  `ui/shell/homeDock.ts`; the **Buy Company** slot — the Sovereign Route,
  padlocked with its progress until `charterDoor` opens — floats over the
  dock's right end, a slot's size) and the card: a FIXED FORM, the same three rows for
  every company (Ground · Raiders · At Rep N — the track's next reward by kind, `track.nextReward` — `ui/shell/homeCard.ts`; the
  ground says its effect from `terrain.GROUND_EFFECTS`, never its
  place-name; a one-off condition — desperate terms, the market's top price
  — is a badge at the head's right, `companyBadge`, only when it applies)
  and the Buy Company card in the same frame. **No wiggle**: a
  pick changes values, never boxes, so the open area the roads fan into (the
  `.mn-window` box, between the bar and the foot; the season panel, the notes
  and the Buy Company slot float over the map) depends on the viewport alone
  and the terrain bakes once (`scripts/home-stability.mjs` proves it). A slot
  or a signpost focuses a road (`homeFocus`): the canvas re-lights
  it (`paintMap.bakeBase` `focus`, a `mapRules.MapFocus`) in the company's
  season (`mapRules.MAP_SEASONS`, a tint over the same bake via
  `paintMap.seasonPixels`), its cities hang beside it as annotations with
  leader lines (pure placement in `ui/attract/labelLayout.ts`, which also
  places the signposts — never by focus), and the card's CTA opens the terms
  (`openContracts`). Buy Company is `homeFocus: 'charter'`: every road lights
  (`'all'`, no season), and its card's CTA opens the charter page
  (`onCharter`). No liaison on the home. Choosing the hero (`marchOut`) goes
  straight into the opening fight: the one battle on `OPENING_LAYER`
  (`data/runmap.ts`), the only road out of the start, which the map draws AS
  its Start (`openingNodeOf`). The first fork is the layer after it, and the
  map shades the ground at and below your row as cleared, above as not.
- The Codex (`src/ui/shell/codex/`): a Supercell-style collection — the pure
  `codexModel.ts` (five tabs of tiles: items, skills, goblins, relics, feats;
  tested in `tests/skills.test.ts`), drawn by `CodexScreen.tsx` with
  `src/styles/codex.css`. A tile's card is a sheet on a phone and a side panel
  on a desk; NEW badges are a UI note in `codexSeen.ts`, not the save.
- The loyalty track (Draft 4 · B): what each standing level pays is named
  ahead of time — `src/game/run/track.ts` (`trackPlan` for the page,
  `payTrack` for the settle: the same function, never a roll; the second
  term, `metaStore.terms`, v13). The curve and the v13 migration are in
  `run/standing.ts`; the five signature skills are `signature: true` in
  `data/skills.ts` (only the track pays them). The page is
  `ui/shell/company/TrackScreen.tsx`, opened from the notice's standing chip
  and the receipt's standing card (`company/trackLink.ts`); a company you
  re-signed with gets a gold rim on its `Crest`. Tests `tests/track.test.ts`.
- Your militia (the player's band): founded when the Sovereign Route opens
  (the full run, your own road: `RootShell` shows `MilitiaScreen mode="create"`
  on the charter page while `metaStore.militia` is null). A new game goes
  straight into the loop, and a militia an older save founded stays hidden
  until the road opens (`flyingMilitia`, `ui/shell/useMilitia.ts`). Once founded, the home's purse (bare seal and gold
  until then) becomes a carved-plate button, `.mn-purse-btn`, with its flag in
  the seal's place (a desk names it there too); a tap on it — or Settings —
  edits it. The flag
  is `src/game/data/banner.ts` (shape, field, pattern + its colour, emblem,
  metal — one `bannerRows(look)` for SVG and both canvases; `soldierRows(look)`
  dresses the builder preview's soldiers in it). The battle wagon flies the
  flag of whoever the run is for: the hiring company's standard
  (`data/companyStandard.ts`), your militia's banner only on the Sovereign
  Route. The builder's wheels and carousels
  are `src/ui/shell/company/FlagCarousel.tsx`. A typed name goes through
  `src/game/run/nameFilter.ts` (profanity filter); `readMilitia` validates the
  save and fills an older flag's missing parts.
- Company flags (Draft 4 § C, `docs/MERCENARY_COMPANY.md`): each company's kit
  of ten flag pieces, one per standing level, is `src/game/data/companyKits.ts`;
  its standard dresses through `companyStandard.ts` (`StandardLook`; the default
  is the old standard pixel for pixel). Your dressed standards are
  `metaStore.liveries`, validated by `src/game/run/livery.ts` (which also deals
  the militia builder its earned pieces); the panel is
  `src/ui/shell/company/LiveryScreen.tsx`, opened from the road notice's flag.
- Company UI themes (Oct 2026; the designer: "allll of the ui … re-theme to
  the company you chose"): the pure table `src/ui/theme/companyThemes.ts`
  (`UI_THEMES`: `neutral` = global.css's `:root` exactly, plus one per
  company, built from its colour; `highContrast`; `themeCss` generates the
  `:root[data-co-theme='<id>']` blocks and `@property` registrations;
  `themeFor` says which is on) applied by `useCompanyTheme` (RootShell): at
  home the focused road (`homeFocus`), Buy Company your militia's, a first
  launch Peppercorn's; a run — terms to receipt — its `contract.company`, the
  Sovereign Route your militia's; derived from saved state, so a reload keeps
  it (the boot's resume prompt wears the saved run's via `useThemePreview`).
  Themes are token overrides only: money is `--gold` / `--gold-text` (never
  themed), washes are `color-mix` of `--shade` / `--rule` / `--accent`, the
  bar's plates `--plate*`; never a house `rgba()` literal on chrome (DESIGN_SYSTEM
  § 2, § 8 rule 7). The sprite theme's `applyThemeCss` writes no inline colour
  for the default style (an inline value would pin it). Your militia's theme:
  `militia.theme` (absent = neutral), open at standing `THEME_LEVEL` (6) with
  its company (`src/game/run/militiaTheme.ts`; `readMilitia` drops a locked or
  unknown one), named on the track (`TrackPay.theme`, cosmetic, pays
  nothing), picked in the builder's Theme carousel (a try-on). Tests
  `tests/companyThemes.test.ts` (contrast of every theme, HC, `themeFor`),
  `tests/militia.test.ts`, `tests/track.test.ts`.
- Company worlds (Oct 2026; the designer: "if one is fire themed it should
  have fire effects"): each company theme is a PLACE, in pixels, all under
  `:root[data-co-theme]` (the neutral house look has none). The art is pixel
  rows in `src/ui/theme/themeArt.ts` (per world: a 4 px 9-slice frame
  flipbook with its own edge and corner — Peppercorn charred with ember
  cracks, Easel House a scalloped paint stroke, Ironvein riveted plates and
  a molten seam, Rosethread satin and a running stitch, Moonquill a rune
  band — a CTA strip, and Peppercorn's flame crest on the card), rasterised
  once into CSS variables by `themeArtDom.ts` and laid on by
  `src/styles/worlds.css` (`border-image`: changes pixels, never boxes; the
  frame flickers only on the card, the pick card and the CTA, on a promoted
  `::after` under the words). The motion is `src/ui/theme/fxWorlds.ts`
  (pure: each world's ambient particles and backdrop, its press burst, its
  switch-in) run by ONE rAF loop in `fxEngine.ts` (`fx`, dev handle
  `window.__worldFx`): the ambient layer `<ThemeFx>` (`.th-fx`, behind the page's
  panels; over the map on the home) is drawn in software by `pixelPen.ts`
  at 24 fps (backdrop 12), capped (`ambientCap`: 60 on a phone, 110 on a
  desk), cleared under every word and panel, and measures the scene (the
  dock's top as the floor; the focused road from `.tm-leaders[data-road]`);
  press bursts are zoned to their `.pg-cta` (`burstClip`) and cleared under
  its label. Sleeps when hidden; nothing moves under reduced motion; dimmed
  under high contrast. Tests `tests/themeWorlds.test.ts`.
  How much plays is `src/game/render/fxQuality.ts`: the setting
  `settingsStore.effects` (Settings' "Effects: Full / Light", v6), an
  automatic step down to Light when the measured rate stays under 45 fps for
  2 s (back over 56 fps for 6 s, doubling after each relapse), and reduced
  motion (`off`) over both; mirrored onto `<html data-fx>` for `worlds.css`.
  Light: half the particles at half the cadence, no glows, frames still.
  The battlefield wears the run's world too: its SEASON
  (`src/game/data/fieldSeasons.ts`, named as the home map's `MAP_SEASONS`;
  the hiring company's, your militia's chosen world's on the Sovereign
  Route) is a PLACE, not a tint (the designer: "more visual interest beyond
  a color filter"). STATIC, in the terrain bake (`terrain.setFieldSeason`,
  part of the bake key; nothing per frame): `src/game/render/season.ts`
  runs twice — `seasonGround` on the bare ground (a ground cover in patches:
  straw, snow with blades through, wet grass; speckle; dew) and
  `seasonFinish` over everything (frozen lake rims, mist, washes, a low
  side-light) — with the road, its verge and the danger ground kept
  (`keepMask`); between them `drawDecos` repaints the pines / bushes / rocks
  by palette swap and stands broadleaf trees in for some pines
  (`src/game/render/seasonArt.ts`, procedural pixel art in the pack's look),
  and `terrain.seasonScenery` places the season's PROPS by a hash of the
  field id and season (never an RNG stream; `buildDressing` untouched):
  upright ones (bales, stooks, sunflowers, pumpkins, reeds, mushrooms,
  drifts) only on forest tiles, flat ones (flowers, puddles, mud, leaves,
  lily pads) off every open tile's standing spot. Pumpkins and mushrooms are
  the old-CC0 Tiny Swords scatter (`public/assets/deco/tinyswords/`, already
  in `CC0-MANIFEST.md`; named literally so the precache finds them). A
  season's `accent` pixels keep their hue through the grade's gold cut
  (`gradeEnvironment`'s `accent` mask, `ACCENT_SAT`). MOVING:
  `src/game/render/weatherFx.ts` (`WeatherLayer`, one per battle, drawn in
  the battle's loop right after the terrain — under the wagon, units, shots,
  HP bars, plaques): particles (≤ 40 on a phone), a rain / snow SHEET at the
  view's edges, fog banks and cloud shadows (`Veil`: a low-res layer through
  a margin mask, blitted in bands), a rare flash at the margins; faint over
  the game (`edgeFx.clearGrid`), Light halves it and drops the clouds and
  the flash, reduced motion draws none. Particles of both layers are
  batched (`pixelBatch.ts`). The world's EDGE BAND of particles
  (`src/game/render/edgeFx.ts`, `EdgeBand`) still lives only in a thin band
  at the view's edges, on cells clear of the road, every slot and the wagon
  (half its old cap beside the weather). Tests `tests/fieldWorlds.test.ts`.
  Dev: `window.__fxQuality`, `__seasonOff`, `__weather` (live counts).
- The battle band (Oct 2026, `docs/FIGMA.md` § The battle band): in setup
  the wave's name and line-up hang from the Stage's top edge (`WavePreview`,
  `live.wavePreviewShown`; `BattleCanvas` fits the play below it only when
  the woodland above the first row of posts is not room enough —
  `frame.firstRowTop` / `stageViewClear`); the Detail band is the focused
  hero's card (`HeroCard.tsx`, pure data in `heroCard.ts`: fields, skill
  slots, what it can upgrade) beside ONE "Gear | Pack" kit column
  (`KitColumn` in `DetailBand.tsx`, real tabs); the team's targeting and
  relics are the HUD's Team button and panel (`TeamPanel.tsx`; selection
  `{ kind: 'team' }`); the setup bar is Details · Upgrade · Start Wave, and
  Upgrade opens `UpgradePanel.tsx` (the owed skill choice first, then each
  worn piece's raise with its before → after — `items.raisedBase` is the raise
  without its roll, so a preview never draws on a run stream). Styles in
  `src/styles/battle-band.css`; tests `tests/heroCard.test.ts`.
- Anything several UI surfaces must agree on — archetype glyphs, currency marks, the
  rarity tokens, the targeting-order labels — lives in `src/ui/channels.ts`.
  Import it. Every local copy of one of those has gone stale so far. A table the
  CANVAS also needs lives under `src/game/data/` (e.g. `glyphs.ts`, the archetype
  glyph) and `channels.ts` re-exports it — `game/` must not import `ui/`.

## Conventions

- **Everything has a job.** Every element on a screen can name its one job;
  an element that cannot goes, and no two elements do the same job. Each
  shared part's job is in `docs/DESIGN_SYSTEM.md` § 8, "Parts and their
  jobs", and a new part gets its row there before it ships.
- **Copy: `docs/copy/COPY.md`.** Every line a player reads has one job and
  the fewest words that do it: an effect is the number and what it touches
  ("+5 Patience to team"), context is one quiet italic note (`tone: 'note'`),
  a fact is said once per screen, and there is no scope boilerplate.
  `tests/copy.brevity.test.ts` holds the caps; `npx tsx scripts/copy-inventory.ts`
  regenerates `docs/copy/INVENTORY.md`.
- **Design system usage rules: `docs/DESIGN_SYSTEM.md` § 8.** They cover one
  title, saying a fact once, no standing hints, `.field-k` / `.field-v` for
  every label and value, the shared choose-one parts, one primary CTA, and
  tokens over literals. Breaking a rule needs a strong, stated need and the
  designer's approval, recorded in that section's exceptions table. Never
  break one silently.

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
