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

The five companies (`src/game/data/companies.ts`, ids in brackets): Peppercorn
Co. (`spice`), Butcherblock (`art`, was Easel House), Ironvein (`metals`),
Rosethread (`silk`), Greenvial (`scrolls`, was Moonquill; a working name —
`companies.GREENVIAL`, one constant). The ids and every storage key keep the
old slots; the world bible is `docs/peoples/roster.json` and the
character-design skill's table.

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
  `gearMarks.ts`. What the figure draws now (Oct 2026, the designer's bar:
  "as if Pixel Frog drew it"): the painted weapon wherever a swap would not
  read — the knight's painted sword for EVERY melee weapon and an empty hand
  (`Rig.paintedFor` / `paintedBare`, `paintsMain`), the archer's bow for the
  bow; any other weapon cuts the painted one and draws its atlas cell in the
  fist only where it reads (`Rig.markMain`: the robed look's bare fists yes,
  the hooded look none — a dagger there would float). Every held mark is
  held at THIS frame's fist (`gearMarks.handsAt`), never one fixed point:
  `npm run anchors` tracks each fist off the idle and attack strips (a hand
  hidden behind the body follows the tunic; a marker pack reads its markers;
  `scripts/held-grips-lib.ts`) into `heldGrips.generated.ts`, `anchors:check`
  fails if stale, idle frame 0 is the rig's `fistR` / `fistL`; review
  `harness/kit.html?held=1`, tests `tests/heldGrips.test.ts`. The knight's painted shield is
  flood-cut by `cutOffHand` unless the off hand holds a Shield, and the hole
  it leaves is FILLED, per frame, never by mirroring: the back of the helmet
  continues its painted contour in one rounded arc into the chin (never
  wider than the painted head), the tunic's back runs narrow down to the
  hem, the near leg and the shadow close; no near hand is drawn (that arm
  is behind the body in this 3/4 view). Baked by `npm run anchors`
  (`scripts/shield-fill-lib.ts`) into `shieldFill.generated.ts`, written by
  `gearMarks.cutAndFill`; `anchors:check` fails if stale or if a rebuilt
  frame has a hole, an open or fat outline, a lone px, a stray island, a
  swollen head or a write over the art; `offHandPlan` says when. The
  off-hand piece is drawn per frame at `StripFill.grips`: `holdOf` 'cover'
  (shields, books, quiver, Focus: over the painted shield's footprint,
  against the body) or 'hand' (a second weapon));
  NO body piece is drawn on the figure: `bodyLayer.BODY_ON_FIGURE` is off
  (Mail, Plate, Robe and Cloak read as pasted-on overlays); the piece shows
  in the UI only. The body layer stays for the character builder — when on,
  the piece is WORN, `bodyLayer.ts`: the tunic of every frame (the
  rebuilt strips' too, as `<strip>_bare`) is measured off the
  strips by `npm run anchors` into `bodyAnchors.generated.ts` (`anchors:check`
  fails if stale or if a piece paints outside its cell), re-inked in the
  piece's icon colours and given its silhouette (pauldrons, skirt, hem, a cape
  behind), after the cuts and before the bake, one canvas per (strip, piece).
  `units.heroFigure` is that ONE composition; every hero portrait in the shell
  is cut from it (`heroPortrait.ts`, a bust data URL per (look, kit), read only
  through `offers.heroLookArt`; `RootShell` re-renders when the art lands;
  `tests/heroPortrait.test.ts`). Review harness `harness/kit.html` (`?shipped=1`: the knight as it ships; `?shield=1`: every off hand over the rebuilt body; `?weapons=1`: every weapon on its look), app shots
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
  Goblin clans (Oct 2026): every goblin a player sees wears its road's clan,
  one per company (`src/game/data/clans.ts`: cinder, smudge, delve, silkcut,
  hexmoon — the ids; smudge wears the Gnawbone Pack and hexmoon the Sporecap
  Rot since the companies' rename; `DEFAULT_CLAN` cinder when there is no run). A clan is a LOOK and
  a NAME only: the engine keeps its ids, stats and RNG order
  (`tests/fixtures/enemyStats.snapshot.json`). Which clan: the run's company
  (`run/clans.runClan` / `roadClan`, the hand-made benches too); the Sovereign
  Route mixes them by a hash of (run seed, act) (`sovereignClan`, never a run
  stream). Names: `clans.enemyName(type, clan)` and nothing else (card,
  preview, boss plate, announcer, ledger, Codex). Art: the strips
  `<clan>_<faction><tier>[_walk]` are BAKED by `npx tsx scripts/enemy-clans.ts`
  (parts in `scripts/enemy-clans-art.ts`, anchors per frame, pack palette;
  `CLAN_ART` in `render/enemyClans.generated.ts` places the HP bar;
  `enemy-clans:check` runs in `build:checks`) from the plain CC0 goblins, which
  no drawing path may read. Every draw goes through `render/clanArt.clanArtFor`
  (`setEnemyClan` per battle); only cinder is precached, the rest are lazy
  roles. The Codex goblins tab is by clan (`Codex.clans`). Inventory and
  renders: `scripts/enemy-assets.ts` (`--render`), `harness/enemies.html`,
  `docs/enemy-assets/`; Figma page "Enemy assets". Tests `tests/clans.test.ts`.
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
  slots, the drop/bump, the hero pick, a hire's skill, old-save mapping)
  `src/game/run/skills.ts`; the generic unlock roll (`rollFromPool`)
  `src/game/run/watch.ts`. Every skill roll is a fresh RNG hashed from (run
  seed, purpose, hero id) — never a draw on a run stream.
  Merging (Oct 2026, spec `docs/SKILL_FUSION.md`): a milestone's card is
  DROPPED on one of the hero's slots (`run/skills.dropSkill(hero, card,
  slot, pool, seed)`, the one move; pure rule `run/fusion.dropOnto`). Onto
  an empty slot it is learned as itself; onto a held skill it MERGES in —
  always allowed, the only way once all three are full: there is no swap.
  ORDER MATTERS: the held skill is the BASE (keeps its name, numbers,
  delivery), the card the INFUSION (lends its share and one re-expression
  rule: `src/game/data/infusions.ts`, every library skill's tag, adjective
  and share, and the thirteen rules keyed on the base's delivery, which use
  only the fusion twists). Any ordered pair makes a skill ("Frozen Arc
  Spark", id `mx.<base>.<card>`); twenty NAMED merges are the specials for
  one ordered pair each (`src/game/data/fusions.ts`: fifteen tier 1, five
  greater = a tier-1 named merge ← a Level 3 card; ids `fz_*`) — the same
  base and share, their own twist in place of the rule. A slot holds at
  most `MAX_DEPTH` (3) library skills, none twice. The resolver is in
  `data/skills.ts` (`mergeId`, `mergedById`, `chainOf`, `plainExtra`;
  `skillModsOf` expands a merge into its base, the stacked share, its
  twist; `isSkillId` takes merged ids, `isCardId` library cards only,
  `isNamedId` the twenty). Merged ids are never in any pool, unlock, crate
  or track; the offer never deals a skill a slot already holds. A named
  merge forms only by a drop in its order (parts held apart stay apart).
  The fifteen twists are `EffectMods` fields at the end of `types.ts`, each
  read in one place in the engine, inert unless granted, drawing nothing.
  Discoveries are `codex.fusions` (named ids; metaStore, recorded by
  `rosterSlice.dropSkill`); the Codex's Merges section is a build tree
  ("base ← card → ?" until made). UI: the slot row, drag (pointer events),
  tap-then-slot and keyboard in `LevelUpPanel` (words in
  `ui/shell/skillDrop.ts`), the merge's `PickCard`, the fuse beat
  (`FuseBeat.tsx`, timings `fuseBeat.ts`, cue `audio.sfxFusion`), the
  merged slot (`.sh-sk.fused`); styles `src/styles/fusion.css`. Balance §7b
  (`balance/fusion-eval.ts`). Tests `tests/fusion.test.ts`; shots
  `scripts/fusion-shots.mjs`, cards `scripts/fusion-cards.mjs`.
  Skill art (Oct 2026, the merge art pass): every library skill has its own
  16 × 16 drawing (`src/game/data/skillArt.ts`: the part that carries its
  element is in key letters `1`/`2`/`3`, which take a tag's hue-shifted ramp,
  `TAG_RAMP`; one motif per tag on a fixed corner or edge, `MOTIFS`, frost's
  is rime on the top edges), and the twenty named merges are hand-drawn
  (`skillArtNamed.ts`; the composer adds a gold bracket on the bottom-right
  corner, both bottom corners for a greater). The pure composer
  `skillIcons.ts` (`skillIconPixels`, memoised; `iconRecipe`; `mergeLayers`
  for the fuse beat) draws a plain merge as its base's drawing (a named
  base's, unmarked), the keys swapped to the FIRST card's ramp, the rime if
  frost, the ink, then each card's motif — so A→B is never B→A. The 70 fixed
  pictures are baked into the atlas from it (`fw-icons.ts`, cells `sk*` /
  `fz*` = `skillArt.skillArtKey`; `skillHeadline(k).icon` is that cell); the
  2,437 plain merges are composed at runtime by `src/ui/SkillIcon.tsx` (one
  canvas → data URL each, memoised; the base's cell where there is no
  canvas). Draw any held or previewed skill with `<SkillIcon id>`. A chain
  that carries its status (`arcCarry`) draws its arcs in that status's ink
  (`attackLook.arcInk`, render only). Tests `tests/skillIcons.test.ts`; cards
  `scripts/merge-art-cards.mjs` → `docs/ui-audit-2026-10/merge-art/`.
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
- iOS app (Capacitor 8, SPM): `capacitor.config.ts` + `ios/` wrap the same
  `dist/`. Bundle id `com.dadsdoingdesign.merchantmercenaries` (permanent once
  registered with Apple); home-screen name `CFBundleDisplayName` is the short
  name, MerchMercs (`docs/BRAND.md`). Entry is `src/boot.ts`, which restores saves from native
  Preferences (`src/native.ts`) BEFORE `main.tsx` loads — stores read storage
  at import time. Every `writeRaw`/`removeRaw` is mirrored there, so all
  storage must go through `state/storage.ts` (`tests/storageOnly.test.ts`
  fails on any other localStorage call). No service worker in the app.
  The App Store icon and launch image come from `scripts/brand.ts`. Builds run
  only on GitHub (`.github/workflows/ios.yml`: manual or an `ios-*` tag →
  TestFlight; a PR touching iOS files gets an unsigned compile check): the
  local Mac can't run a current Xcode. Refresh `ios/` with `npx cap sync ios`.
  In the app `<html data-native="ios">` is set (boot.ts); CSS under
  `:root[data-native]` turns off web-page behaviour (long-press callout, text
  selection). `ios/App/App/PrivacyInfo.xcprivacy` declares the UserDefaults
  use; a new native plugin or SDK may need its own entry there. Release steps,
  listing copy and questionnaire answers: `docs/APP_STORE.md`.
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
  The five liaisons are the designer's APPROVED finals (Oct 2026; Saffra,
  Hask, Brannoch, Odile, Wren: pixel-map modules in `scripts/designs/`, the
  table `scripts/liaison-finals.ts`) — never redraw one. Each post stands
  its final pixel for pixel (unlit by the post's light) behind a LOW counter
  that stops short of the prop hand, and bakes `talk` (where the bubble
  hangs, clear of the hat and prop in every frame) and `cameo` (the
  receipt's head crop) beside `speaker`. Butcherblock's post is Hask's salt
  landing (smokehouse, barge, hooks); Greenvial's is Wren's potting yard
  (glasshouse, herbs, clay pots). Cards `docs/characters/cards/liaisons/`
  (`scripts/liaison-cards.ts`, shots `places-shots.mjs`, `dock-shots.mjs`).
  The contract board is the HOME, and the home is the map (Oct 2026, the
  map-first home, `MenuScreen` + `menu.css`): the trade map fills the screen
  and three slim layers float over it — the bar (the purse plaque: seal and
  bank; one carved plate per place, its mark and name; under the purse, the
  season panel: seven bars from `tradeWar.seasonBars`, `ui/shell/homeSeason.ts`),
  the foot (the company dock: exactly five fixed slots in `COMPANY_IDS`
  order, the order the map fans its roads west→east, pure model
  `ui/shell/homeDock.ts`; each slot shows its company's FACE, not its crest —
  the liaison's hand-drawn 28 × 28 dock figure (`render/hero/mini.ts`, a
  small version of its approved final, in the final's inks) at 2×,
  drawn by `ui/shell/DockFace.tsx` on ONE shared rAF (idle and tic on the
  desynced clock, the reaction when its slot is focused, a still shadow while
  the company is not hiring; still under reduced motion, the tic half as
  often on Light, asleep when hidden); who stands where is the one table
  `ui/shell/dockFaceModel.ts` `DOCK_FACE` (Hask, Butcherblock's salter, in the
  `art` slot; Wren, Greenvial's herbalist, in `scrolls`); crests stay everywhere else; the **Buy Company** slot — the Sovereign Route,
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
- The HQ (the HQ pass, Oct 2026): the page `src/ui/shell/hq/HqScreen.tsx`
  (styles: the HQ section of `src/styles/hq.css`, which also holds the
  crates'), its words and states as pure data in `hq/hqModel.ts` (now →
  next, buy / short / max / locked, the CTA's words, the milestone line),
  rules and prices in `src/game/run/hq.ts`, the save in `metaStore`. No
  tabs: the castle, then the five upgrades as one `PickStrip` + `PickCard`,
  the page's CTA buying the focused one. The castle is a picture only (it
  pays and gates nothing): each upgrade BUILDS A PART (`hq.castlePart`,
  `CASTLE_PARTS`: Opening deal → barracks yard, Hiring Hall → great hall,
  Pack slots → storehouse, Company focus → pennants, Scouts → lookout; level
  0 is the empty plot), lit in gold on the picture while its token is in
  focus; and the whole castle's MATERIAL is a milestone across all of them
  (`hq.castleTier`: Timber; Stone at every upgrade but focus at 1; Fortified
  at every upgrade halfway; Grand at everything maxed — a castle never loses
  a tier). The home plate's mark is the tier (`hqTimber`… in
  `scripts/fw-icons.ts`, `hqModel.hqMark`). The art is one sheet per tier,
  `public/assets/scenes/hq-castle-<tier>.png` (scene + every part at every
  level), laid out by `hq/castleScene.generated.ts`, baked from the pack's
  castle and troops by `npx tsx scripts/hq-keep.ts` (`--check`, `--compose`).
  A tier's rise plays once on this device (a `localStorage` note, not the
  save; never under reduced motion). Shots `scripts/hq-shots.mjs`, cards
  `scripts/hq-cards.mjs` → `docs/ui-audit-2026-10/hq/`; tests
  `tests/hqStage.test.ts`.
- The Codex (`src/ui/shell/codex/`): a Supercell-style collection — the pure
  `codexModel.ts` (five tabs of tiles: items, skills, goblins, relics, feats;
  tested in `tests/skills.test.ts`), drawn by `CodexScreen.tsx` with
  `src/styles/codex.css`. A tile's card is a sheet on a phone and a side panel
  on a desk; NEW badges are a UI note in `codexSeen.ts`, not the save.
- Sealed crates (the crates pass, Oct 2026): the rule is `run/hq.ts`
  (`PULL_PRICE`, `pullOdds`, `rollPull`: a hash of the save's crate seed and
  the crate's number), opened by `metaStore.openCrate` — bought with bank
  gold and opened at once, never held. The screen is
  `ui/shell/hq/CratesScreen.tsx` (one column, no tabs; styles
  `src/styles/crates.css`, out of `hq.css`; `.cr-panel` is in `worlds.css`'
  frame lists), the art `hq/crateArt.ts` (original pixels: the old CC0 pack
  has no chest; the chest pass's three LOOKS — 1–2 wood, 3–4 iron, 5 gold,
  `lookFor` — and the plinth), how many the bank buys `hq/crateShelf.ts`
  (also the home Crates plate's `.mn-place-badge`). The hero chest on the
  screen is `hq/CrateHero.tsx` (its idle timing the pure `hq/crateIdle.ts`);
  the odds are abstract (a "?" card per level, its chance, how many are new —
  never a picture of a kind). Opening several opens each in turn,
  exactly as one at a time. The OPENING (`hq/CrateOpening.tsx`) only READS
  the results and starts from the chest's look: its beats and timings are the pure `hq/crateSequence.ts`
  (`tests/crateSequence.test.ts`), the canvas `hq/crateStage.ts` (the pack's
  explosion strip, the coin, procedural rays/dust/cracks/ring; Light halves
  the particles, reduced motion goes straight to the summary), the cues
  `audio.sfxCrate` + `sfxRarity`. Cards and fps: `scripts/crate-cards.mjs` →
  `docs/ui-audit-2026-10/crates/`.
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
  rows in `src/ui/theme/themeArt.ts` (per world: a 4 px 9-slice frame that
  is QUIET but present — a dim line at most two pixels deep, a shade or two
  off the panel, with a sparse rhythm of its own and a corner whose outer
  pixel is clear: Peppercorn a charred line with a few embers, Butcherblock
  a dry reed stem jointed every eight pixels and lashed with hide twine, a
  bone knuckle in each corner, Ironvein a two-tone iron band lit on top with rivet heads,
  riveted corner plates and a forge glow in each joint, Rosethread satin
  with a running stitch, Greenvial a leaded glass line with a vine winding
  inside it and a spore bud at each corner — a low CTA strip (Ironvein's an iron
  bar with domed rivets), and Peppercorn's flame crest on the card; each
  ONE still image; the board approved Peppercorn's and Rosethread's as the
  bar the others match), rasterised once into CSS
  variables by `themeArtDom.ts` and laid on by `src/styles/worlds.css`
  (`border-image`: changes pixels, never boxes). The frames pass (Oct 2026;
  the designer: "the border on the ui can be too intense, especially when
  it's doubled up at the bottom"): frames are ONE DEEP — a framed part inside
  a framed panel (or under the battle detail band's trim) wears no frame, a
  CTA wears no 9-slice anywhere: a standalone CTA keeps only its strip on
  its lip, and a CTA inside a framed panel (the home card, Buy Company) keeps
  its plain button look, with no strip or glow. The page's exits row
  (`.pg-foot .pg-row`) is unframed. `tests/themeWorlds.test.ts` checks the
  CSS lists and the frames' weight. Cards: `docs/ui-audit-2026-10/frames-calm/`.
  The frames, strips and crest are STATIC: the only CSS loop the worlds keep
  is the CTA's faint shimmer (`th-shimmer`, one pale band every 9 s, on a
  promoted `::after` under the words; none on Light or reduced motion).
  The calm pass (Oct 2026; the designer: "a bit overwhelming now that I'm
  playing more") retuned Full for every world — felt, not watched, the map
  and the words are the show — and Light follows from it; before → after in
  `docs/ui-audit-2026-10/motion/AUDIT.md`, phone cards in
  `docs/ui-audit-2026-10/motion-calm/`. The motion is `src/ui/theme/fxWorlds.ts`
  (pure: each world's ambient particles and backdrop, its press burst, its
  switch-in) run by ONE rAF loop in `fxEngine.ts` (`fx`, dev handle
  `window.__worldFx`): the ambient layer `<ThemeFx>` (`.th-fx`, behind the page's
  panels; over the map on the home) is drawn in software by `pixelPen.ts`
  at 24 fps (backdrop 12), capped (`ambientCap`: 24 on a phone, 40 on a
  desk; each world's `peak`, ≤ 0.7, is its particles' strongest alpha, so
  none outshines the words), cleared under every word and panel, and
  measures the scene (the dock's top as the floor; the focused road from
  `.tm-leaders[data-road]`); press bursts stay on their `.pg-cta`'s face
  (`burstClip` is the button, ≤ 20 particles) and are cleared under its
  label; a switch-in is a crossfade (`SWITCH_S`, 350 ms: the old world's
  particles and backdrop fade out as the new one's fade in, `PixelPen.crossfade`)
  with a faint, still wash of the world on the overlay, cleared under every
  word and panel. Glows breathe (`BREATH_S`, 8 s), never crawl, and dither is anchored to the screen's
  pixels (a moving checker flips a whole shape). Sleeps when hidden; nothing
  moves under reduced motion; dimmed under high contrast. Tests
  `tests/themeWorlds.test.ts`; the motion budget per world, measured in the
  running app, is `scripts/motion-audit.mjs` →
  `docs/ui-audit-2026-10/motion/AUDIT.md`.
  How much plays is `src/game/render/fxQuality.ts`: the setting
  `settingsStore.effects` (Settings' "Effects: Full / Light", v6), an
  automatic step down to Light when the measured rate stays under 45 fps for
  2 s (back over 56 fps for 6 s, doubling after each relapse), and reduced
  motion (`off`) over both; mirrored onto `<html data-fx>` for `worlds.css`.
  Light: half of Full's particles at half the cadence, no glows, no CTA
  shimmer (the frames are still at every level).
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
  HP bars, plaques): particles (≤ 18 on a phone, 40–50% of the old counts,
  each at `WEATHER_PEAK` of its old strength), a narrow, faint rain / snow
  SHEET at the view's edges, fog banks and cloud shadows (`Veil`: a low-res
  layer through a margin mask, blitted in bands), a rare, faint flash at the
  margins (Full only, `FLASH_GAP_S`: 45–90 s apart); faint over the game
  (`edgeFx.clearGrid`; `OVER_GAME` 0.18), Light halves it and drops the clouds and
  the flash, reduced motion draws none. Particles of both layers are
  batched (`pixelBatch.ts`). The world's EDGE BAND of particles
  (`src/game/render/edgeFx.ts`, `EdgeBand`) still lives only in a thin band
  at the view's edges, on cells clear of the road, every slot and the wagon
  (`EDGE_PEAK` strength; caps 11 / 18, and 6 / 9 beside the weather in
  `BattleCanvas`). Tests `tests/fieldWorlds.test.ts`.
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
