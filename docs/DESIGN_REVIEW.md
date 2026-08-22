# Design review loop

A recurring self-review applied **after every task that changes visuals or
gameplay feel** — not just when something looks wrong. The goal is to catch
"flat and bland" *before* the user has to.

## The loop

1. **Render it.** Capture the real result — screenshot the app (or a render
   harness that calls the real draw code), not an imagined version.
2. **Look at it cold.** Score it against the checklist below. Name specific
   failures ("the grass is one flat block", not "could be nicer").
3. **Benchmark.** Compare against the reference games — would this look at home
   next to them? Where does it fall short?
4. **Fix the top 2–3 issues, then re-render.** Repeat until it passes.
5. **Only then** commit and report — include a before/after when it's visual.

## Checklist

**Readability & hierarchy** (most important for a tower-defense)
- [ ] The play field reads instantly — units and towers are the highest-contrast
      things; nothing decorative competes with them.
- [ ] Decoration lives at the **margins**, never in the play area or on build
      slots / the enemy lane.
- [ ] Enemy tiers/factions are distinguishable at a glance (silhouette + colour).

**Colour & surface**
- [ ] No large flat "dead" areas — backgrounds carry low-contrast tonal
      variation (patches, tufts, detail) so they feel alive, not noisy.
- [ ] Palette is cohesive; the background is slightly muted so foreground pops.
- [ ] Functional colours (health, boss ring, selection) stay unambiguous.

**Surfaces have character**
- [ ] Paths/roads/surfaces have texture and worn detail, not a single flat fill.
- [ ] Edges are broken up (tufts, irregularity), not clean vector strokes.

**Depth & composition**
- [ ] Grounding shadows, a subtle vignette or lighting — the scene has depth.
- [ ] The frame is composed: a clear focal area, framed edges, breathing room.

**Polish**
- [ ] Consistent pixel scale / `image-rendering: pixelated`; no blurring.
- [ ] Nothing clipped, mis-anchored, or z-fighting.

## Reference games (benchmark against these)

- **Kingdom Rush** — the gold standard for TD readability: rich but the lane and
  build spots are always clean; decoration frames the play area.
- **Bloons TD 6** — legible tracks, decorative-but-calm backgrounds.
- **Tiny Swords** showcases / **Warcraft II** — the target art language: lush
  grass with tonal variation, forest borders, worn dirt trails, water/cliffs.
- **Clash Royale / autobattlers** — extreme unit readability over muted grounds.

## Log

- **2026-07-23 — battle level design.** First pass was flat: one grass block, a
  bland brown stroke, trees scattered through the play area blocking sightlines.
  Fix: trees moved to a perimeter forest frame (interior kept clear); grass got
  tonal blobs + tufts + flowers; the lane got dirt speckle, worn ruts, and a
  tufted broken edge; base grass muted so units pop.

- **2026-07-23 — brand guide + full UI reskin.** The battle map + accessory
  screens were on-theme, but the surrounding UI chrome was still cool blue-grey
  (info-blue Marks/Endless/Dust, purple Sacrifice/epic, blue rarity, cool-black
  scrim/letterbox, white-alpha borders). Wrote `docs/BRAND.md` (warm storybook
  medieval; no cool chrome; teal = primary, gold = value) and swept every screen
  against it. Retokenised `global.css` :root to the warm table palette; warmed
  the scrim (`rgba(20,12,6,.66)`) and canvas letterbox (`#17100a`); recoloured
  hub marks→gold, sacrifice→goblin-red, upgrade buys→teal; endless→teal;
  map node types→warm (teal start, sage shrines, gold merchant), edges→gold,
  current→teal; rarity ramp→warm (stone/teal/orchid/gold); enchant + upgrade +
  xp + evolution-grant accents→teal; recruit DPS→gold. Verified with real
  screenshots of hub, map, battle, detail, merchant, shrine, and equip — all
  now read as one warm wooden-table set. Mystic-blue kept as intentional class
  identity (per BRAND.md archetype hues).

- **2026-07-26 — UI audit rebuilt in Figma.** Took `docs/ui-audit/` (7 folders,
  desktop + mobile) and rebuilt it as a real design system in Figma rather than
  a screenshot dump: `00 · Foundations` (colour/type/radius/spacing/elevation/
  glyphs, every swatch labelled with its `global.css` token), `01 · Component
  Library` (43 components, the multi-state ones as proper variant sets),
  `02 · Screens — Desktop` (9 × 1180×720, assembled from instances),
  `03 · Modals & Overlays` (7 overlays on a 60% scrim over real screen
  context), `04 · Screens — Mobile` (4 × 390×844). Verified every section with
  rendered screenshots from Figma, not assumed output — three defects were
  caught and fixed that way: sentinel cards were missing the 3px archetype rail,
  the evolve-ready card clipped its gear/info buttons (header tightened, card
  340px), and the tactics segmented control clipped "Near" inside the 294px HUD
  rail. Two fidelity notes recorded in `docs/FIGMA.md`: sprite upload is blocked
  by the sandbox network policy so pixel art is vector stand-ins, and teal
  legitimately carries two text treatments (dark ink on price chips, light on
  the large nine-slice CTA) — both are in the Button set.

- **2026-07-26 — mobile flow board + mobile UI system.** Added a second Figma
  page (`_Mobile first UI`) holding two sections. `01 · Mobile UI System` is the
  390×844 spec — safe areas, 14px gutters, the pinned action footer, a 44/48/52
  touch-target floor, the four-pattern navigation model (tab / sheet / full /
  over), and the mobile-only chrome as components (top bar, action footer, tab
  bar, bottom sheet, toast, inventory grid, list row). `02 · Mobile Flows` is
  every mobile screen in the audit — 40 frames across 5 lanes (Watchtower, Run,
  Battle, Gear & pack, Ending & endless) — wired with 68 orthogonally-routed
  paths, each forward edge labelled with the trigger that fires it and each
  return edge drawn faded. 56 of those paths are also real Figma prototype
  reactions attached to the actual CTA, so the board is walkable from
  A1 · Main Menu; the remaining 12 are state changes with no single trigger
  element (tab swaps, level-up, wave outcome) and stay documented as wires.
  Verified each lane with rendered screenshots as it was built.

- **2026-07-29 — the Root Shell.** The flow board was the diagnosis: 40 screens,
  four navigation patterns, and a battlefield six different sheets are allowed
  to cover. Added two Figma sections proposing the fix. `03 · Root Shell` is one
  390×844 screen in four fixed bands (Header 76 · Stage 388 · Selector 126 ·
  Detail 254) with the four rules — one interaction, the Stage is never covered,
  the pack is permanent, modals only for destructive confirms — plus a table of
  the ten surfaces it retires and every shell part as a component set.
  `04 · Contexts` renders the whole game in that shell: 21 states, each one
  nothing but instances, so the claim is checkable rather than asserted.

  Three defects caught by rendering rather than assuming. The run-end contexts
  were cool blue-grey (`#1d232b` ground, `#5d6b7e` card) — pure invention that
  broke the no-cool-chrome rule in `BRAND.md`; retinted onto the real
  `.overlay-card` spec (`--panel` card, `--accent-dim` marks chip, the
  `0 20px 60px` lift, and a 3px top rule in `--good` / `--bad` so victory and
  defeat read apart at a glance). The DETAIL band's three sub-panels sat on top
  of the band label in the anatomy diagram; pushed them below the caption.
  Context 08 · Battle — wave live turned out to be a *detached* frame named
  `Shell / Stage Band` — it looked right and undercut the whole section's
  premise; promoted its extra content (enemies, health bars, damage number,
  wave strip) into a real sixth variant, `Stage=Battlefield live`, and swapped
  the context back onto an instance.

  Open question recorded in `docs/FIGMA.md`: `Context Panel · Offer` carries 12
  of the 21 contexts. It is doing too much and is the first thing to split if
  the shell gets built.

- **2026-07-29 — the Root Shell, built.** Implemented the proposal from the
  Figma sections as real code in `src/ui/shell/`, behind `?shell=1` so `main`
  keeps shipping the screens it always has and the two can be compared. The
  four bands are a CSS grid; the Stage reuses the real `BattleCanvas` and
  `RunMapView` rather than a copy, so the battlefield and map are the shipped
  render path. The load-bearing abstraction is `Offer` — merchant stock, shrine
  terms, recruits, hero picks, reward cards, endless rooms, perks and settings
  all normalise to one shape, which is what lets a single Selector row and a
  single Context mode serve twenty-two contexts.

  Verified by driving the real app in Playwright at 390×844 and capturing all
  22 contexts as a contact sheet, twice over. Six defects came out of that,
  none of which were visible from reading the code:

  1. **The Selector's scrolling row widened the whole grid**, pushing the Pack
     column off-screen in every context. `.shell` needed an explicit
     `grid-template-columns: minmax(0, 1fr)` — without it the implicit column
     sizes to max-content.
  2. **A finished run could not be exited.** Contexts 17/18 keep the party in
     the Selector, so the "Bank and return" offer had nowhere to be tapped.
     The run-end actions moved into the Context panel's default state.
  3. **Endless rooms showed the wrong offers** — the endless merchant listed
     recruits. Root cause was a real store bug, not a shell one: `startEndless`
     never cleared `event`, so a campaign event outlived its run and shadowed
     the room. Fixed in the store; the shell also now treats `endlessRoom` as
     authoritative in endless mode.
  4. **Going back took two taps**, because every card followed the
     tap-to-fill-the-panel rule. Added `immediate` for reversible navigation
     only — recorded in `docs/FIGMA.md` as a deliberate deviation from rule one.
  5. Card titles truncated to nonsense ("Upgrade …", "Endless …") and then,
     after switching to two-line wrapping, split mid-word into "Watchtowe/r".
     `break-word`, not `anywhere`.
  6. The title stage spread its wordmark and tagline to opposite ends of the
     band — `place-items: center` on a two-child grid centres each row, not the
     pair.

  Confirmed the flag actually protects `main`: with `?shell=0` there is no
  `.shell` in the DOM, the legacy `.battle-screen` renders, and the console is
  clean.

  Not yet at parity, and deliberately out of this pass: the evolution choice is
  still a blocking modal (it is destructive, so rule four allows it), the
  Crossroads and post-wave reward boards are wired but unscreenshotted, and the
  shell is capped at 520px so desktop is still the legacy screens' job.

- **2026-07-30 — shell remediation, verified by measurement.** Went back over
  the six defects from the previous pass and checked each one against the
  running app rather than trusting the fix. Wrote an assertion harness
  (`scrollWidth` vs viewport, `scrollHeight` vs `clientHeight` for clipped text,
  bounding-box overhang for the map node, real taps for the interaction ones)
  so each fix has a number behind it instead of a glance. All six hold, 9/9
  assertions pass, console clean.

  Two things that pass turned up which the previous pass had let through:

  - **The map's bottom padding shipped unverified.** It went in after the last
    capture, so the commit claimed a fix nobody had looked at. It does hold —
    50px of clearance between the frontier node and the band edge — but that
    was luck, not process. Re-render *after* the last edit, not before it.
  - **Offer-card truncation was worse than judged.** The previous pass called
    "Common Beacon of…" acceptable because the Context panel carries the full
    name. Measured, 3 of 4 real merchant items clipped — the selector was
    unreadable for most generated gear. Offer cards widened to 106px with a
    three-line clamp at 11px (heroes stay 92px/two lines; their names are one
    short word). Now 0 of 6 clip, and the tallest card is 105px inside the
    126px band.

  Also rendered the two boards the last pass left unscreenshotted: Crossroads
  (recruit + mutate offers, "Take the recruit") and the post-wave reward pick
  ("Take it"). Both correct, no changes needed. Legacy path re-confirmed with
  `?shell=0` — no `.shell` in the DOM, real `.battle-screen`, clean console.

- **2026-07-30 — shell/legacy parity audit.** Diffed the store's action surface
  against what `src/ui/shell/` actually calls, then confirmed each suspected
  hole by driving the app rather than trusting the grep. Four actions were
  unreachable, and one of them was a silent dead end:

  - **Tapping a deployed tower did nothing.** `BattleCanvas` called
    `openUpgrade`, which only sets `upgradeTarget` — the legacy modal reads it,
    the shell does not. Measured: after the tap `upgradeTarget` was set and no
    UI changed at all. Replaced with a `focusTower` action that drives both —
    legacy still opens its modal, the shell puts that hero in the Context panel
    on its Upgrades tab. It deliberately leaves `selectedSentinelId` alone:
    tapping a tower inspects it, it does not pick it up.
  - **A deployed hero could never be taken off the field.** Undeploy lived on
    the old upgrade modal's footer and had no home in the shell. Added to the
    hero panel, setup phase only.
  - **Campaign reforge / raise-rarity were unreachable** — only the endless
    Forge room exposed crafting. They now sit on the item panel itself, gold in
    campaign and dust in endless, which is more honest than a Forge screen
    given the shell can select an item from anywhere.
  - **Sort pack** had no control; added to the Pack column header.

  Regression-checked the shared code: `BattleCanvas` is used by both UIs, so
  verified with `?shell=0` that tapping a tower still opens `.upgrade-modal`
  with its `.upg-remove` action. 9/9 shell assertions still pass, item panel
  fits its band at 232px of 254, console clean in both modes.

- **2026-07-30 — the shell becomes the game.** Flipped the default: the Root
  Shell is what loads, and `?shell=0` is the escape hatch rather than `?shell=1`
  being the way in. Building it flagged-off was the right call while it was
  unproven, but leaving it that way meant launching the game still showed the
  old screens — the redesign existed and nobody could see it. Fieldwatch is a
  mobile app, so the shell's 520px cap is the whole story and no desktop layout
  is planned. Verified a clean visitor with no query string and no localStorage
  lands on the shell, that `?shell=0` falls back and sticks, and that `?shell=1`
  returns. The pre-shell screens in `src/ui/screens/` are now dead weight kept
  only for comparison.

- **2026-08-01 — the mobile UI system.** Implemented the Figma section "Mobile
  UI Layout, Spacing, Gaps, Fonts, Colors" (node 2111:10818) across the whole
  app. Two screens were designed directly — the Watchtower menu and hero pick —
  and the rest were extrapolated from the same rules.

  The system: **Crimson Text** as the display serif for titles (32px, 0.06em)
  and button labels (24px), self-hosted so a mobile build makes no third-party
  font request; Inter for everything else. A **32px / 16px** rhythm — every
  section is 32px of vertical padding inside a 16px gutter. A translucent
  parchment wash `rgba(220,205,172,.08)` replaces solid brown panels. Radius
  scale 3 / 5 / 8 / 18, and a deeper teal `#3f7d8c` for the 64px pinned CTA.
  All of it lives in `global.css` as tokens so both layouts share one source.

  **The structural call.** Neither designed screen has the GEAR/PACK columns,
  which contradicts the shell's "the pack is permanent" rule. Read as correct
  rather than an oversight — you own no heroes on hero-pick and no run on the
  menu — so the four-band shell now applies only to **battle and the run map**,
  the two places where the uncovered Stage and the persistent pack are the
  whole point. Everything else is the page skeleton: title, body, optional
  secondary row, pinned CTA. Pages carry no app header (the serif title is the
  header, per the design); the purse rides as a chip in the title block on the
  pages where something is actually bought.

  Every offer already normalised to one shape, so hero-pick, the merchant, the
  shrine, recruits, the endless rooms, the spoils pick and the perk list all
  render from one page component — portraits when the offers are characters,
  rows when they are not.

  Four defects out of rendering, none visible from the code:

  1. **The page collapsed to content height.** `.shell-page` set its grid rows
     but lost to `.shell` on equal specificity, because `shell.css` imports
     after `page.css`. Needed `.shell.shell-page`.
  2. I rendered the app header *and* the page title, spending 76px the design
     doesn't spend — which is what pushed the hero-pick description into a
     mid-sentence clip.
  3. **The Pack's second tile column was cut off by the panel edge** — a
     pre-existing bug, not from this pass, that the native-resolution crop
     finally exposed. `aspect-ratio` with the default `stretch` let the row
     height drive the tile width; `align-self: start` sizes it from the column.
  4. A composite screenshot made the battle CTA *look* clipped. Measuring said
     `scrollWidth === clientWidth`. It was a resize artifact — worth recording
     because the contact sheet is a triage tool, not evidence.

  Battle keeps its density (32px padding would wreck an information-dense HUD)
  but adopts the same materials — serif headings, the parchment wash, the
  radius scale and the teal CTA — so it reads as one set with the pages.
  Verified all 22 contexts at 390×844 with the serif confirmed loaded, page
  height 844, CTA 64px sitting 32px off the bottom, and the legacy path still
  intact under `?shell=0`.

  **Synced back to Figma.** Added `05 · Built — the shipped mobile UI` to the
  `_Mobile first UI` page: a token plate recording the system as implemented,
  and the six screens that were extrapolated rather than designed (merchant,
  shrine, endless rooms, spoils, run end, perks) so the extrapolation is
  reviewable in the file rather than only in the app. One defect caught by
  rendering the section: `primaryAxisSizingMode = 'AUTO'` on a horizontal band
  hugs its *width*, so the CTA bands collapsed to 10px and clipped; they need
  `layoutSizingVertical = 'HUG'`.

- **2026-08-01 — Figma reconciled to the app.** Rebuilt `05` as `As built —
  every screen`: all 21 screens the app renders, as editable frames, plus the
  token plate. Pages for everything except battle and the run map, which keep
  the four bands; the battlefield reuses the existing `Shell / Stage Band`
  variants so the meadow is the same art the canvas draws.

  Two notes on method. Uploading the real 390×844 captures as image fills would
  have been the most faithful reconciliation, but the sandbox proxy blocks
  Figma's upload host, so every screen is a vector rebuild checked against the
  captures rather than traced from them. And rendering the result caught one
  defect: the base-integrity readout clipped to "20/" on all six battle frames
  because the bar was pinned at 160px inside a hugging row.

  `docs/FIGMA.md` now says plainly that `01`–`04` are superseded history and
  `05` is the section to trust, so the file stops presenting four equally
  authoritative answers.

- **2026-08-20 — enemy tier as a non-colour channel (M34).** `drawEnemy`
  separated tiers 1–5 by a colour ramp alone, and the ramp is literally the same
  blue/purple/gold across all three factions — so a Bomber and a Sapper differed
  only by a hue that deuteranopia collapses. Added a **tier tag**: a small dark
  plaque above the head carrying one cream notch per tier, anchored to the top
  of the drawn art rather than to the token radius.

  Four things were decided by rendering rather than by reasoning, at the real
  390×844 with `deviceScaleFactor: 1` and a nearest-neighbour zoom
  (`scratchpad/ws4b-tier.mjs` + `zoom.mjs`), because the field is 960×560
  logical px drawn into ~390×331 CSS — a scale of **0.41**, which makes a
  tier-1 goblin about 9 CSS px across:

  1. Anything drawn *inside* the silhouette (numeral, pip row, outline weight)
     lands at 1–3 px and is texture, not a channel. The tag had to go above the
     head with its own ground.
  2. First pass was cream plaque / dark notches and became the brightest thing
     on the field — a checklist failure ("nothing decorative competes with the
     units"). Inverted to dark plaque / cream notches, which is also the
     contrast direction the HP bar already uses, so the two read as one stack.
  3. Anchoring the tag to `type.radius` put it **on** the goblin's head: a Tiny
     Swords sprite is drawn at 2.7× the token. It now hangs off the top of the
     art (`artTop`), computed per draw branch.
  4. That over-corrected for barrels — the rotated-corner allowance floated the
     tag ~55 logical px above a static sprite — so the static branch anchors to
     the frame half-size with the same 0.9 headroom trim as the walk branch.

  Checked in context on a real endless wave (`ws4b-swarm.mjs`): five torch4s
  abreast show five tidy 4-notch tags, no overlap, lane still clean.

- **2026-08-20 — the shell stops lying (WS5/WS6 UI slice).** Phase 2 rebuilt the
  game systems under a shell that went on describing the old ones. Five things
  the running UI asserted were false, and one whole system was unreachable.

  **Dark Sacrifice → the Banner ladder.** `offers.ts` still read "Permanent and
  irreversible… +1 to all starting stats, +10% Watch Marks — and +15% enemy HP
  in every future run… There is no way back down a tier." Not one clause was
  still true: `metaStore` kept the old API names so saves migrate, but
  `sacrificeTier` now means "highest Banner unlocked", unlocking applies nothing
  to anything, and `bonuses().enemyHpMult` is hard-wired to 1. Rewritten off
  `BANNER_RUNGS` so the copy cannot drift from the rungs again. The destructive
  confirm stays — it is still an irreversible spend of a few hundred marks.

  **The ladder had no door.** Nothing anywhere called `setRunBanner`. Built
  `BannerPicker` into hero-pick, the only screen the store accepts it on: a
  scrolling chip row of unlocked rungs plus a card listing every cumulative rule
  in force and the payout multiplier. Verified end to end at 390×844 — Banner 1
  removes both merchant nodes from the dealt map, Banner 4 removes the recruiter,
  Banner 5 starts the run at Threat ×2, and the choice survives into the run.

  Rendering it is what settled where it goes. The page body measures 372px and
  the hero-pick page is 580px tall, so something is below the fold either way;
  the first arrangement put the whole Banner section under the fold, which is
  the same invisibility the component exists to fix. The hero's three headline
  traits are pinned in the tile row and the CTA names the hero, so the Banner
  section moved above the hero's stat card and the card became the scroll.

  **Hero-pick tiles were fiction.** "+4 dodge" — there is no dodge stat in the
  engine. "+6 armour" against a real `physDefAdd` of 20. "+6 speed" matching no
  stat at all. All three mystic tiles described tier-1/2 branch abilities a
  level-one mystic does not have. Tiles and body now derive from the tier-0 tree
  node and from `computeCombat` on a preview of the exact Sentinel
  `pickStartingHero` will build. Rendering caught a second-order version of the
  same bug: the tiles quoted base numbers (2.1/s, 28% crit) above a body quoting
  computed ones (2.6/s, 33% crit), so the tiles read the profile too.

  **The victory recap rendered nowhere.** `buildRecap` assembled a full receipt
  at the moment every campaign run ended — per-Sentinel kills, damage, build,
  level and downs, the leak count, the seed, the Banner, gold left, Threat
  reached, the boss's spoils — and put it in `state.victory`, which nothing read.
  The end screen is the receipt now, with "Run again" as the pinned CTA. Two
  defects out of rendering: the per-hero roll sat third and fell below the fold,
  so it leads the body; and the 96px verdict circle had become an ellipse,
  because a scrolling flex column shrinks its children by default — fixed for
  every page child, not just that one.

  **Shell parity (M6).** Wave composition with enemy names, counts and — for the
  first time anywhere in the game — faction resistances, which are the whole
  reason a mystic and a rogue are different answers. Per-hero battle results.
  Upgrade level descriptions and their tier-3 downsides before purchase.
  `describeMods` on the hero panel with `STACKING_RULE` under it. Evolution
  preview and next-unlock level. Dismantle yield on the button, keepsake tag,
  thorns/patience/armour/range in the stat grid, endless loot named, "Depth
  3/10" instead of "Depth 3".

  **Threat disclosure (M5).** The ×1.05 charged for accepting a shrine, recruit,
  merchant hire, crossroads recruit or mutation now appears in the terms — and
  only on the offers that actually pay it, since the endless rooms do not. Map
  nodes carry their own step (⚡×1.42 / ×1.52) on the fork you are choosing
  between. That disclosure immediately created a new lie and caught it in the
  same pass: under Banner 3 every battle node resolves as an elite, so the map
  drew "Battle ⚡×1.42" for a node that fields an elite and charges ×1.52. Both
  the label and the number read the Banner now.

- **2026-08-20 — the crossroads mutate path, rewired (M8).** The store moved the
  mutation roll to *before* the decision — three Mythics dealt once when the fork
  fires, `aimHeroMutation` to point at a hero, `chooseHeroMutation` to commit —
  and left `rollHeroMutation` behind as an alias that only aims. Both UIs still
  called it. So the "Mutate <hero>" card set `mutationHeroId`, nothing anywhere
  rendered that field, and the tap did nothing a player could see, on the one
  screen where the game hands out a permanent Mythic.

  Rebuilt as the two steps the two actions describe. Step one is the fork:
  recruits and your own roster in one chooser, and picking one of your own AIMS
  — free, reversible, rolls nothing. Step two is the read: the three cards with
  the effect, `describeMods`' own numbers beside it, the `downside` leading in
  the danger colour, what it grants, that it is permanent, and the ×1.05 Threat
  it charges *on landing*. The commit is behind the armed confirm, because a
  mutation is Mythic, one-per-key, and has no reroll.

  Measured live: aiming leaves Threat at 1.00 and the three mutation ids
  unchanged; re-aiming at a second hero leaves them unchanged again (the
  "aim somewhere else" reroll the store's comment warns about does not exist in
  the UI either); the first CTA tap only arms; the confirm applies exactly
  ×1.0500 and lands the mutation on the aimed hero and nobody else.

  Three defects out of rendering rather than reading:

  1. **The way out of step two was 140px below the fold.** "Pick someone else" is
     a nav row under the detail card, and a seven-line card pushed the one
     control that un-commits the branch off screen. Trimmed to the lines that
     earn it (the stacking rule went — a mutation is a single source), and the
     whole step now fits: body `scrollHeight === clientHeight` at 390×844, and
     2px of overflow at Large UI.
  2. **A recruit and one of your own were the same picture** — both an archetype
     sprite in an archetype-coloured frame, on a screen whose whole premise is
     that those are opposite choices. The rail cannot say it (it is already
     saying which archetype), so `PortraitRow` grew an optional corner badge:
     `＋` for a stranger, `⚗` for one of your own. Set only where a chooser
     genuinely mixes kinds — hero-pick renders none, verified.
  3. **`crossroads.mutations` is a field that did not exist a build ago**, so it
     arrives `undefined` from an older snapshot — and `rev-misc`'s dead-end probe
     sets exactly that shape. Reading `.length` off it turned the no-dead-ends
     test into a crash; it is coerced now, and the probe still finds its exit.

  The deprecated `?shell=0` screen had the identical dead button and got the
  identical two steps. `npm run balance` passes all invariants, `tsc -b --force`
  and `npm run build` are clean, and the `window.process` bridges that three
  agents added while `src/game/data/*` carried browser-illegal `process.env`
  knobs are all removed now that `grep -rn "process.env" src/` is empty.

- **2026-08-20 — the special-node Threat step, disclosed (M5, second pass).**
  `THREAT_PER_NODE` gained `special: 1.13` and `completeNode` began charging it:
  every node the player *consumes* advances Threat now, not just battle clears,
  because routing through a merchant / shrine / recruit used to skip a
  difficulty step outright and made "take the special" close to strictly
  correct. Two surfaces I own went stale the moment that landed, and both were
  stale in the direction that flatters the choice.

  **The map understated the fork.** `nodeThreat()` returned `null` for the three
  special types, so a fork of four battles and a shrine drew four ⚡ chips and
  nothing on the shrine — the map quoted a price for one branch and no price for
  the other at the exact moment the player chooses between them. Measured after:
  all five reachable kinds chip, `{Battle ×1.42, Elite ×1.52, Merchant ×1.13,
  Shrine ×1.13, Recruit ×1.13}`, zero chipless reachable nodes.

  **The terms said walking away was free.** It is not: reaching the node is what
  costs ×1.13, and the ×1.05 composes on top of it, so accepting a shrine is
  ×1.1865. Split into two variants rather than edited flat, because one string
  cannot be true in all three places it appears: `THREAT_TAX_VISIT` on a map
  special quotes both halves and their product and says plainly that walking
  away still pays the visit; `THREAT_TAX_FREE_EXIT` keeps the original wording
  at the Crossroads, which is a screen rather than a node (`finishCrossroads`
  charges nothing — measured, Threat 1 → 1); and endless keeps rendering
  neither, since `endlessOpenRoom` never touches `threat` (measured, two room
  visits, Threat 1 → 1, no "Threat" string anywhere in the endless shrine).

  The copy was checked against the engine rather than against itself: the card
  claims ×1.13 declining and ×1.19 accepting, and driving the real store gives
  `declineShrine → 1.13`, `acceptShrine → 1.1865`.

  Regressions unchanged: `rev-rotate` byte-identical, `x-shell` identical but
  for a rotated hero name, `rev-misc` 0 stuck, `rev-trap` keeps its exit,
  `ws9-audit` 0 failures with no sub-44px target and no sub-11px string,
  first-run still 7 taps with no dead taps, 0 page errors across eight runs.
  `npm run balance` still passes every invariant.

- **2026-08-20 — the stylesheet follows the screens out of the payload (H14b,
  L3).** The legacy screen tree was already lazy; its 3,929-line stylesheet was
  not. `app.css` shipped whole to every player for a UI the flag never selects,
  and the previous pass measured that only 7.6% of it was shell-reachable. Split
  it, and checked the split rather than asserting it.

  **What was moved, and how the boundary was found.** Not by reading: by walking
  the eager module graph from `main.tsx` with the `React.lazy` edge cut, then
  extracting the class tokens each side actually puts in the DOM (`className`
  attributes and expressions, `classList`, the template-literal chunks) and
  intersecting with every selector in the file. The shell emits exactly 28 of
  `app.css`'s class tokens, and 22 of those are `.app-root`, `.battle-canvas*`,
  `.overlay-scrim`/`.overlay-card`, `.evolve-*`/`.eo-*` and `.run-map-*` /
  `.map-node*`/`.mn-*`. The other six — `accent`, `danger`, `empty`, `ghost`,
  `primary`, `selected` — are compounded onto `.sh-*` bases in the shell and
  onto legacy bases here, and no rule in the file is rooted on one of them
  alone, which is what makes them safe to leave behind. `.brand`, `.roster`,
  `.stat` and `.toggle` ARE rooted bare, so each was checked by hand: the shell
  renders none of them (they were substring noise from `Coach.tsx`'s local
  `roster` variable and `HeaderBand`'s prose).

  Result: `src/styles/app.css` is 400 lines / 10.6 KB and still eager;
  `src/styles/legacy.css` is 3,216 lines / 60.6 KB and is imported from
  `LegacyApp.tsx`, so it rides that chunk. **Boot CSS on the shipping shell went
  15.3 KB → 7.7 KB encoded** (86.2 KB → 36.3 KB raw), total boot payload
  629.4 KB → 622.2 KB over the same 59 requests. `?shell=0` fetches a second
  7.9 KB sheet with its chunk, so it pays 642.3 → 642.9 KB — the deprecated path
  carries the cost, which is the point.

  **The three blocks that break silently.** The `@media (pointer: coarse)` 44px
  tap-target floor, `:root[data-reduced-motion='true'] *`, and the
  `:root[data-contrast='high']` TOKEN overrides exist nowhere else — `shell.css`
  restyles `.sh-*` borders under high contrast and redefines no tokens,
  `page.css` has two reduced-motion rules for `.pg-*`, and the only other
  `pointer: coarse` query in the tree is the rotate prompt's. All three stayed
  eager and were then measured in the shell against a build of the PREVIOUS
  state, on the same harness: high contrast moves 9 of 11 tokens (`--text`
  `#f3e7d0` → `#fff8ec`) and repaints real shell chrome, reduced motion drops a
  2s animation and a 3s transition to 1e-06s, and a bare `<button>` on a coarse
  pointer still computes `min-height: 44px` with 0 of 4 live controls under 44.
  Byte-identical before and after.

  Two tokens do NOT move under high contrast — `--panel` and `--accent`. That is
  pre-existing and not the split's doing: `applyThemeCss` in
  `game/render/themes.ts` writes both as INLINE custom properties on `:root`,
  and an inline declaration beats every author rule regardless of which file it
  sits in. Identical in the pre-split build. Worth fixing; it is not a CSS
  problem, so it was left alone.

  **61 blocks deleted, proven rather than assumed.** The old equip modal, the
  old hub, the theme picker, inventory v1 and the sentinel-card deploy button —
  362 lines, 6.9 KB. The line numbers in the hand-off had drifted (the range
  quoted for the equip modal contained `.equip-gold`, which `MerchantModal`
  still uses), so every class was re-derived from a parse of the file and then
  substring-grepped across all of `src/`, `index.html` and `public/`: zero hits
  outside `src/styles/`. Then confirmed at runtime — across 8 legacy screens and
  19 shell states, not one of the 42 deleted class names ever reached the DOM.

  **The split, verified against the previous build rather than against itself.**
  Both builds were served side by side and diffed three ways. The effective CSS
  rule list (every rule from every stylesheet the page loads, in order) differs
  by exactly the 61 dead blocks, plus the two selectors that were edited
  (`.unequip-btn` dropped from `.equip-btn, .unequip-btn`, `.inv-item` from the
  coarse-pointer floor), plus the one `@media (min-width: 860px)` wrapper lifted
  along with `.battle-canvas-wrap`. Shell screenshots are byte-identical at
  every captured step. And the load-bearing question — does anything the shell
  renders need a rule that is now lazy? — was answered by driving 19 shell
  surfaces (menu, hero-pick, map, all five node kinds, battle setup and live,
  the hero / item / tower panels, the evolution modal, crossroads, endless,
  run-end, hub) and testing all 448 `legacy.css` selectors against the live DOM
  at each one. Zero matches, zero console errors. Offline: the worker precaches
  both sheets (`CRITICAL` is derived from the emitted bundle, so it needed no
  edit), the legacy sheet loads with 504 rules and no network, and `?shell=1`
  never fetches it.

  **L3 — four duplications closed.** The archetype glyph map had three private
  copies outside `ARCHETYPE_GLYPH`, all still drawing rogue as `✦` — the mark
  that was reserved for Watch Marks alone precisely because it meant five
  things. `RecruitModal`, `Roster` and `SentinelDetail` import the canonical map
  now, so the legacy rogue reads `➶` like the shell. The renderer's fourth copy
  (`game/render/renderer.ts`) was deliberately left: it is canvas art, and
  changing the glyph a sprite draws is a visual decision, not a refactor.
  `PageScreens`' verbatim currency map is gone in favour of `CURRENCY_GLYPH`.
  The focus-option table existed three times with three wordings — the shell's
  four abbreviations, the shell's `FOCUS_FULL` accessible names, and the legacy
  panel's own hints, two of which described a rule the engine does not have
  ("Closest to the base" for first-in-lane, "Closest to the tower" for
  nearest-to-the-Sentinel). One table now — `FOCUS_OPTS` in `channels.ts`, with
  the shell's wording — and the legacy panel's hint and its new `aria-label`s
  both read from it. Rendered and measured at both UI scales: nothing clips, the
  four buttons stay 44px, and the longest string ("Nearest to the Sentinel")
  fits its rail.

  Rarity colours were deliberately NOT collapsed — `assertRarityTokensMatch` is
  load-bearing, since `--rarity-*` has three definitions in `global.css` and CSS
  is the runtime authority while `items.ts` is the default palette. What was
  fixed is the two legacy sites that inlined the hex past the token layer
  (`ResultOverlay`, `Roster`); they read `rarityVar()` now, which is what lets a
  colour-vision mode reach them — measured, epic goes `rgb(198,122,176)` →
  `rgb(215,154,210)` under deuteranopia, where before it could not move at all.
  `channels.ts` moved to `src/ui/channels.ts`, since two legacy directories
  import it and it was never a shell module.

  Not done: `findItem` still exists twice. `DetailBand`'s copy is the one to
  delete, but the store's twin is module-private and `gameStore.ts` was another
  agent's file this pass; collapsing them needs an `export` there.

  Regressions: `ws9-audit`, `ws9-firstrun`, `ws9-fit`, `rev-rotate`, `rev-misc`,
  `rev-shift`, `r2-confirm`, `x-confirm3` and `x-shell` byte-identical to their
  baselines; `rev-trap`, `rv-legacy` and `rev-reach` differ only by the dealt
  seed and the intended `✦` → `➶`; `r4-legacy-sw` identical to its post-fix
  baseline at 0 failures. `rev-sw6`, `rev-sw6b`, `r2-sw` and
  `h14-offline-legacy` all pass unchanged. `tsc -b --force` and `npm run build`
  clean, `npm run balance` passes every invariant, `grep -rn "process.env" src/`
  empty.

- **2026-08-21 — one pixel density, and one resample (Phase 3 renderer).** The
  field is 960×560 logical drawn into 390×331 CSS on the shipping phone:
  `fitView` scale exactly **0.40625**, and `dpr × view = 0.8125`, non-integer
  before any sprite scale applies. Measured on a live battle across all five
  matrix viewports, **not one of 39 sprite draws landed on an integer scale**;
  reciprocals ran 0.88 → 5.54; the density spread on one screen was **6.30×**,
  with grass the only asset *upscaled* (1.14×) and a barrel the sparsest at 0.18
  device px per source px. With `imageSmoothingEnabled = false` that is
  nearest-neighbour minification, and because units move at sub-pixel positions
  *which* source pixels survived changed every frame.

  **The crawl, measured rather than described.** Render one goblin, one frame,
  at ten sub-pixel offsets inside a single rounding bucket — so the sprite lands
  on the *same device pixels* every time (at 0.8125 it does not advance a whole
  device pixel until ~1.23 logical px of travel) — and count device pixels that
  change. Old pipeline: **2.6 / 4.8 / 7.2 / 10.8 / 13.4 / 16.3 / 19.1 / 23.9 /
  27.0 %** of the sprite rewritten, mean 13.9%, for motion that moves nothing.
  New pipeline: **0% at every offset.**

  **What was done, and what was deliberately not done.** The audit's proposal —
  resize the field to 780×662 so `dpr × view` comes out at 1.0 — was refused: it
  moves the path and the build slots, which is enemy travel time and tower
  coverage, i.e. a balance change dressed as an art fix, on top of two phases
  that had just gone green. Instead:

  1. **Every sprite is box-filtered to exactly ×½ once, at load** (`pixmap.ts`,
     alpha-weighted premultiplied box filter, `ceil(n/2)` cells so the *content*
     scale stays exactly 0.5 on both axes — no 1.6% squash), and then drawn
     **1:1**. Measured over the whole cast plus the dressing: **sprite scale
     (destination px ÷ source px) is [1.000, 1.000] across all 37 `drawImage`
     calls in a full-cast frame; zero non-1.000 draws.** Density spread 6.30× →
     **2.00×**, and that 2.00 is one deliberate step rather than a smear (below).
  2. **The canvas IS the composite.** Its backing store is the logical field
     (960×560), not `css × dpr`, so the frame is composed under the identity
     transform and the element is sized in CSS to the letterbox `fitView`
     computes; the compositor performs the single filtered resample. `fitView`
     is untouched and remains the authority, and because the element's rect now
     carries the field's exact aspect, the `ox`/`oy` every tap path computes come
     out 0 and the hit-test arithmetic in `BattleCanvas`, `dm-reach` and
     `ws9-firstrun` stays correct with no change. Verified: the canvas is inside
     the Stage and exactly centred at all five viewports in both setup and
     battle (top gap === bottom gap to 0.1 px), and the drawn field area is
     within 1.3% of the theoretical maximum everywhere.
  3. **`image-rendering` stays `auto`, on evidence.** The brief asked for
     `pixelated`; it was rendered both ways and rejected. It is *not* inert here
     — the backing store is no longer `css × dpr`, so captures differ at dpr 2
     (498 vs 532 KB) and dpr 3 (968 vs 852 KB). At 960 → 780, nearest-neighbour
     discards **180 of 960 columns and 105 of 560 rows outright** — about eleven
     columns off a 58 px goblin, so a 1 px sword or a torch flame is present or
     absent depending on where it stands. That is the same "which pixel
     survives" failure the 1:1 composite exists to end, moved to the frame blit;
     it also stair-steps every range ring and slot outline. Given a forced
     non-integer ratio, one *filtered* resample of a frame composed at exactly
     1.000 is the best answer available.

  **The tier-size tension, resolved to two buckets.** You cannot have five tiers
  differentiated by size, one pixel density, and this asset pack — Tiny Swords
  ships one goblin per faction. So: rank and file at ×½, the tier-5 champion at
  the pack's native density. A champion is exactly 2× its own faction's line
  troops and carries pixels half their size; that is the only density split on
  the field, and it is spent where a boss is supposed to look like a different
  order of thing. Tiers 1–4 are the same size on purpose, and tier is read off
  the notch tag, preserved unchanged — count-encoded, colour-vision-immune.
  Drawn heights, logical px → CSS at 390×844: torch 1–4 **40 → 16.3**, torch5
  **80 → 32.5**; tnt 1–4 **36 → 14.6**, tnt5 **71 → 28.8**; barrel 1–4 **36 →
  14.6**, barrel5 **72 → 29.3**; fighter **48 → 19.5**, rogue **40 → 16.3**,
  mystic **32 → 13.0**. `enemies.ts` `radius` was not touched — it is gameplay.

  **Two heroes no longer disagree about how big a pixel is.** The old code
  divided a fixed 60.75 px body height by each strip's own source height, so
  three archetypes standing side by side used three different sprite scales and
  differed in pixel density by **1.51×**. Gone: they draw at one density, which
  means the warrior really is taller than the pawn, which is what the art says.
  The anchor moved to the feet, so the taller attack frames grow upward — a
  raised sword — instead of sinking the character.

  **Static barrels.** `barrel*.png` was a 158×164 crop off a sheet holding
  **four** barrels in a 2×2 grid (alpha run-scan: columns 1–58 and 137–157, rows
  1–70 and 119–163, identical in all five files), drawn whole as one enemy and
  squashed into a `sz × sz` square — a permanent 3.7% vertical squash on top of
  being four barrels. The pack was re-exported to a trimmed 52×72 single barrel
  mid-pass, so the sub-rect guard in `barrelCell` is dormant now; it stays,
  because a four-up sheet drawn as one sprite reads as bad art rather than as a
  bug. The squash cannot recur regardless — `blitPixmap` draws `fw × fh`. The
  barrel roll is quantised to sixteenths of a turn: an arbitrary rotation angle
  resamples pixel art every frame, while sixteen discrete poses read as a chunky
  roll and hold one sampling phase per step.

  **Proportion inversion.** Before: 28 of 30 decorations were trees (93%),
  covering **35.7%** of the field, with `tree2` drawing 155–177 logical px
  against a 61 px hero — **5.15× a tier-1 goblin** — and nine of thirty clipped
  off the top edge. Placement was never the problem (`clearOf` works: 0 of 30
  touched the lane or a slot), so it was fixed with scale and mix. After: **30
  decorations, 15 trees (50%), 13.6% bbox coverage, tallest 88 logical px =
  35.8 CSS = 1.83× the tallest hero and 2.20× a tier-1 goblin**, none clipped.
  Three changes hold it there. Decorations have no random scale factor any more
  — one density means the *pool* has to carry the size range. What counts as a
  "tree" is derived from measured drawn height rather than from the filename:
  the pack was re-exported mid-pass and `tree4` went from a 124 px tree to a
  32 px stump, which a hard-coded pool would have got silently wrong. And
  clearance is tested along the whole **trunk**, not just the anchor, because an
  88 px crown on a legally-placed base still leans over the lane — the first
  pass at this drew a treeline with its canopy sitting on the enemy path.
  Honest limit: 1.83× a hero is not "nothing decorative exceeds hero height".
  You cannot have that, one pixel density, and this pack at the same time. The
  ceiling enforced instead is the champion silhouette, so nothing decorative
  out-masses the biggest unit the game can field, and `DECO_CEIL` drops anything
  taller from the pool so a future re-export cannot put a 177 px tree back.

  **Reserved channels.** Enemy tier is encoded as hue (t1 red, t2 teal, t3
  purple, t4 gold) and the environment was wearing it: rocks sat 53–67% in the
  t2-teal hue bin, `tree4` 56% in the t4-gold bin, `tree1` ~13% teal. Saturation
  was inverted on top of that — environment **43.9%** against units **38.4%**,
  with the two loudest trees (51.9 and 50.8) beating every unit on the field.
  One pass over the baked terrain — saturation ×0.62, a slight contrast pull, a
  warm push — fixes hue, saturation and value together and costs nothing per
  frame because the terrain is baked once per map. Measured on the *rendered*
  pixels afterwards: environment **25.0% saturation / 44.4% lightness**, units
  **36.2% / 36.9%** — units are **1.45× the more saturated** (was 0.87×) and sit
  **7.5 points** darker. Internal contrast moved the right way too: the
  environment holds 59% of its pixels inside a single 10-point lightness band,
  while the units spread across eight bands with 35% of their pixels below 20%
  lightness.

  **The cheapest missing polish.** Every unit sprite gets a baked 1 px ring —
  dark at the sides and below, warm above, a rim light rather than a flat
  outline — which is TF2's own remedy for units sharing the ground's value band,
  at the cost of one extra `drawImage` per unit instead of a shader. (The halo
  baked into `public/assets/sprites/tinyswords@half/` is `#161C2E`, a cool
  blue-grey that `docs/BRAND.md` rules out by name; this one is warm.) A subtle
  warm grade — `overlay` at 6% — now closes each frame, measured at 0.0 ms p50,
  and the vignette moved into the terrain bake.

  **H19, closed.** `drawField` re-rendered the whole static world every frame.
  Measured before, per frame: **497 `beginPath`, 985 `moveTo`, 1007 `lineTo`,
  252 `stroke`, 246 `fill`, 213 `arc`, 23 `fillRect`, 20 `createRadialGradient`,
  1 `createPattern`, 32 `drawImage`** — none of which ever changed. After: **6
  `beginPath`, 1 `moveTo`, 2 `stroke`, 5 `fill`, 3 `arc`, 2 `fillRect`, 0
  gradients, 0 patterns, 5–6 `drawImage`.** Frame time on the battle screen at
  390×844, p50 over ~240 frames: **1.4 ms → 0.3 ms** (p90 1.7 → 0.5, max 2.2 →
  0.7). An intermediate version that did the resample itself in JS measured 1.5
  ms with **1.2 ms of it inside that single `drawImage`** — more than the ~1000
  path ops it had just replaced — which is what drove handing the resize to the
  compositor. The per-projectile `shadowBlur: 6` is gone from `themes.ts`; the
  pop is bought back with a contour ring and a lit core, two arcs, no blur
  kernel. Cost added: the box-filter bake, **49 ms for 32 half-density roles
  (886k source px) plus 13 ms for the three champions**, once and lazily per
  sprite as each first appears (0.1 ms on every later call), so it amortises
  across entering a field instead of landing as one hitch.

  On **not** consuming `tinyswords@half/`: it exists now and is generated with
  the same box filter, but the champion bucket needs the pack at native density,
  so using it means shipping both — 236.9 KB + 85.5 KB against the 236.9 KB the
  game already fetches. Baking in the browser costs the 62 ms above and zero
  bytes. The swap point is documented in `pixmap.ts`.

  **Verification.** `npm run balance` passes every invariant, and
  `balance/REPORT.md` is **byte-identical** (md5 `5fbf56c9…`) both across
  repeated runs and against a run with this pass's `themes.ts` edits reverted.
  `themes.ts` is the only file I own that the harness's import closure reaches
  (29 modules; nothing else under `src/game/render/`, and nothing under
  `src/ui/` or `src/styles/`), and nothing outside the renderer reads a field
  this pass touched. `tsc -b --force` and `npm run build` are clean; `grep -rE
  "\b(process|Buffer|__dirname)\b" src/` finds only the word "process" in prose.
  `dm-reach` 20/20 with band heights byte-identical to the baseline and
  `canvasSpill` negative at every cell now (the field can no longer be drawn
  past its band); `dm-audit` byte-identical at 0 failures; `ws9-audit` 0
  failures; `ws9-firstrun` 7 taps, no dead taps; `rv-determinism2` all PASS
  (differing only by the dealt run seed); `rotate-pause` both PASS; `fw2-battle`,
  `-cross`, `-cross-fit`, `-disclose`, `-fit`, `-m21`, `-measure`, `-threat`,
  `-upg` and `-final` all exit 0. `fw2-verify` fails, and failed before this
  pass: it clicks `.pg-banner-chip` `nth(4)` and `nth(5)`, and the banner ladder
  has been cut to four chips in `src/state/metaStore.ts` — a stale harness
  against another agent's file, failing on the hero-pick screen before any
  canvas is drawn. Preserved and re-checked in the renders: the notch tier tag,
  the torch goblin's detached flame, contact shadows on all three object
  classes, y-sorted dressing, and the two-clock split. Screenshots:
  `scratchpad/shots/p3-final/` (390×844 and 320×568, in battle) and
  `scratchpad/shots/lineup-final-960.png` (the whole cast at 1:1).

- **2026-08-21 — the feedback layer (Phase 3 game feel).** The pixel pipeline
  had just been rebuilt and the frame budget had gone from 1.4 ms to 0.3 ms;
  this pass spends it. The juice audit scored ABSENT on particles, screenshake,
  hitstop, knockback, permanence, death feedback and the loss moment, and named
  four more specific failures: chain lightning drew **nothing**, four procs
  shared one yellow ring, a crit differed from a normal hit by 1 px of
  projectile, and every feedback timer decayed in GAME time so at 3× a damage
  number lived a fifth of a second.

  **Scorecard, before → after** (evidence in brackets, all from the running app
  at 390×844 unless stated):

  | | before | after |
  |---|---|---|
  | particle system | none at all | pooled, capped 420, **1 868 spawned** in one scripted fight, peak 288 alive; zero allocation after warm-up |
  | screenshake | absent | trauma-squared, decaying; **8/8 field-edge pixels move** while trauma > 0.25, **0/8** under reduced motion |
  | hitstop | absent | 2–8 frames scaled by significance and by play speed; **9 / 18 / 27** stops granted at 1× / 2× / 3×; budgeted (30 of 69 requests refused on a dense wave) |
  | knockback | absent | drawn-only recoil — enemy ≤ 3.4 logical px along the hit, tower 2.2 px opposite the shot; **no gameplay coordinate moves** |
  | permanence | `splice`, nothing left | the unit's own baked frame as a corpse, darkened, 5.5 s (8 s for a champion), cap 40 |
  | death feedback | a disappearance | per-class beat: torch → embers + fire sheet, tnt → explosion sheet + smoke, barrel → wood chunks + dust; champion gets both plus trauma 0.42 |
  | hit feedback | one white circle over `type.radius`, `dt*4` in game time | the unit's **white silhouette**, 110 ms of REAL time, at 1:1 on the same cell grid |
  | chain lightning | **nothing drawn** | a jittered two-stroke bolt per arc; **136–201 arcs** drawn per scripted fight |
  | proc tells | one `#ffe08a` ring for all four | four colours **and four geometries** — shock a spiked corona, burn a rising triple flame, execute a chevron pair, stun four orbiting pips |
  | crit legibility | 4.5 px vs 3.5 px dot; 13 px gold text | 5.5 px core + gold rim + a 1.5× longer hot tail; **19 px** outlined floater with a 1.5→1.0 scale pop over 90 ms |
  | projectiles | 3.5 px dot | muzzle flash at the barrel, a three-step tail stretched along velocity |
  | the loss | nothing | the gate falls, a 0.3 s blowout, a vignette closing on the breach — all inside the 550 ms `WAVE_BEAT_LOSS_MS` hold |
  | reduced motion on the canvas (L11) | never reached it | gates shake, hitstop, particles and decals — and **not** floaters, flashes or proc tells |

  **The base finding, which was not what it looked like.** "The base never
  visually reacts" is true, and flashing the base would not have fixed it:
  `FIRST_MAP.base` is `{x: 990, y: 520}` and the field is **960** wide, so the
  marker `drawBase` bakes into the terrain spans x 958–1010 — **two pixels of it
  are on screen.** Both shipped maps end their path off the edge on purpose, so
  enemies walk out of frame. There was nothing on the field standing for the
  thing being defended. So the fix is a new object, not a new effect: a warm-wood
  **palisade gate** across the lane at the last visible point, oriented off the
  last path segment so it works on either map. It carries base HP as
  **structure** — planks go missing from the middle outward as a COUNT, the same
  colour-vision-immune channel the tier notches use — reddens and flashes white
  as a leak lands, and lies flat when the run is lost. `map.base` did not move,
  `drawBase` did not move, and nothing about the path changed.

  **H20's visual half, measured rather than argued.** Both numbers come from the
  same running build: the engine's floaters still exist and still decay in game
  time, so watching ids enter and leave `engine.floaters` against the wall clock
  measures exactly what the renderer used to draw, while patching `fillText` and
  tracking each rising number measures what it draws now.

  | | on-screen life, p50, REAL seconds | |
  |---|---|---|
  | | **before** (engine floater, game-time decay) | **after** (drawn, real-time decay) |
  | 1× | 0.616 s | 1.250 s |
  | 3× | **0.200 s** | **1.331 s** |

  Before, a damage number was **3.1× shorter at 3× than at 1×**. After, it is the
  same number at both. The presentation clock is now a third hand alongside the
  two Phase-1 clocks: `engine.elapsed` for gameplay-state timestamps
  (burn/chill/stun, untouched), simulated time for ambient loops (walk cycles,
  bobs, auras — untouched), and REAL time for everything that is feedback.

  **Rendering is not simulation, and this was proved rather than asserted.** No
  engine file was edited. Feedback is *derived* by `BattleCanvas` snapshotting
  the engine's public state either side of a whole `TICK` and diffing it — one
  diff per tick, not per frame, because at 3× a frame runs three ticks and a
  frame-level diff loses which shot hit what. A shot is "`fireFlash === 1` after
  the tick"; an impact is "a projectile that was there and is not"; the
  kill/leak split is read off `leakCount` (the head count) rather than off
  `leaks` (the damage), so a two-point leaker is one breach and not two; the
  chain is reconstructed the way `impact()` builds its list and then
  **confirmed against who actually lost HP**, so a future drift in the engine's
  selection shows up as a missing arc rather than a wrong one.

  The determinism evidence is two-part. (1) In an isolated copy of the repo with
  one frozen `balance/report.ts`, the harness was run twice: once verbatim, once
  with `fx.ts`, `renderer.ts`, `BattleCanvas.tsx` and the whole of `src/ui/`
  **deleted outright**. `balance/REPORT.md` came out **byte-identical**, md5
  `83915a3b26a69576371bb7a96b9126eb` both ways. The static closure agrees: 29
  modules are reachable from `balance/report.ts` and the only one under
  `src/game/render/` is `themes.ts`, which this pass did not touch. (2) Hitstop
  is the one item that touches timing, so it has its own proof: one run dealt,
  its exact pre-battle state captured, then that identical battle fought **six
  times through the live rAF loop** — 1× / 2× / 3× with hitstop off and on — and
  all six `BattleResult`s are byte-identical. Wall clock at 1× went 16.95 s →
  17.25 s (+1.8%) for nine freezes, which is precisely what hitstop is: the same
  ticks, later. It is bought by not banking real time into the accumulator;
  `engine.step` is never stalled and only ever receives whole `TICK`s, the same
  property that already makes 30/60/144 Hz produce the identical battle.

  **The 1.000 invariant survived.** This layer adds several new blit families —
  the white silhouette flash, the corpse and its baked dark silhouette, the two
  CC0 effect sheets, and a second terrain blit on shake frames. Re-measured on a
  live battle: **15 350 `drawImage` calls into the 960×560 field, 100% at
  dw/sw × dh/sh = 1.000 × 1.000, zero non-1.000 draws.** Source cells seen
  include `96×96` (Explosions.png, 192² box-filtered ×½ through the same
  `pixmap` path) and `64×64` (Fire.png, 128² ×½). Screenshake is **translation
  only, rounded to whole logical px**: the rotational component the trauma model
  offers was built and dropped on evidence — the visible canvas *is* the
  composite, so rotating it nearest-neighbour-resamples every sprite on the
  field for the duration of the shake, which is the exact defect the pixel
  pipeline exists to end. The shaken field never grows a black edge either: the
  terrain is laid down once unshaken as a backdrop and again under the offset,
  so the ≤ 7 px band shows terrain, at the cost of one extra blit on shake
  frames only.

  **Frame budget.** Same rAF-callback probe as the pipeline pass, 390×844.

  | scene | FX off (reduced motion) | FX on |
  |---|---|---|
  | shipped depth-1 wave, 1× | p50 **0.3** ms (p90 0.5) | p50 **0.3–0.4** ms (p90 0.5–0.6) |
  | shipped depth-1 wave, 3× | p50 **0.3** ms | p50 **0.3** ms (p90 0.6) |
  | stress scene, 1× | p50 0.7–0.8 ms (p90 1.1) | p50 **1.0–1.5** ms (p90 1.3–2.0) |
  | stress scene, 3× | p50 0.7–0.8 ms | p50 **1.1–1.3** ms (p90 1.4–1.8) |

  On real gameplay the layer is below measurement noise. The stress scene is
  **deliberately not a shipped wave** — 27–31 concurrent enemies, four Sentinels
  at 2.6× fire rate with every proc live, i.e. roughly fifteen times the load a
  depth-1 wave puts up — and it is the honest upper bound rather than the number
  to quote. Degradation is by design: emitters ask for a count and get thinned
  as the pool fills (60% → 32% → 1), the pool refuses rather than evicting, and
  hitstop refuses once its budget (0.18 s per second, cap 0.3 s) is spent — 30
  of 69 requests refused on the dense wave, which is the difference between
  punctuation and a slideshow.

  **Reduced motion reaches the canvas (L11, closed).** Identical scripted battle
  under both settings:

  | | particles spawned | decals | hitstops | trauma events | floaters | arcs |
  |---|---|---|---|---|---|---|
  | normal | 1 756 | 40 | 47 | 43 | 119 | 51 |
  | reduced | **0** | **0** | **0** | **0** | 125 | 54 |

  Information is deliberately preserved: floaters, hit flashes, the proc tells
  and the chain arcs all still fire, because a setting that hides *what
  happened* is an accessibility failure of its own. Trauma never rises above
  zero, so the field-edge sampler never even triggers — which is the shake proof
  in its strongest form. Note that `dm.mjs`'s `coldPage` seeds
  `reducedMotion: true`, so the whole existing regression battery runs with this
  layer suppressed; a second cold-boot helper (`p3fx-lib.mjs`) parameterises the
  flag, and every juice measurement above uses it.

  **One tuning fix caught by measuring rather than looking.** A boss takes many
  hits a second and 0.05 trauma each stacked into a permanent 1.75 px wobble —
  224 trauma events in one fight. `fxTrauma` now takes a per-event *ceiling*:
  frequent minor events (boss hits, splash) can never push the shake past a low
  bound, while a leak, a champion death or the run loss are uncapped and slam.
  Lisa Brown's rule in one parameter.

  **Preserved and re-checked in the renders:** the notch tier tag, the torch
  goblin's detached flame, contact shadows on all three object classes (the gate
  got one too), y-sorted dressing, the two-clock split, and the 1.000 sprite
  scale.

  **Verification.** `tsc -b --force` and `npm run build` clean; the service
  worker precaches `assets/fx/tinyswords/explosions.png` and `fire.png`, so the
  new art is in the offline set; `grep -rE "\b(process|Buffer|__dirname)\b"
  src/` finds only the word "process" in prose. `dm-reach` **20/20, 0 failures**;
  `ws9-firstrun` 7 taps, no dead taps; `rotate-pause` both PASS;
  `rv-determinism2` all PASS; `fw2-battle`, `-cross`, `-cross-fit`, `-disclose`,
  `-fit`, `-m21`, `-measure`, `-threat`, `-upg`, `-final`, `ws9-fit`,
  `rev-rotate` and `rev-trap` all exit 0. `dm-audit` reports 70 failures and
  `ws9-audit` 7 — **every one of them the same single defect**, a
  `.sh-hero-arch` "⚔" rendering at 10 px against an 11 px floor, which is
  `src/ui/shell/SelectorBand.tsx` + `src/styles/shell.css`, another agent's
  files and in flight during this pass (they did not compile for part of it).
  Nothing on the canvas is implicated. `balance/REPORT.md` currently fails four
  invariants belonging to a `§14 Run variety` section that landed in
  `balance/report.ts` mid-pass; that file gained 1 709 lines while this work was
  underway and is not this pass's, which is exactly why the determinism proof
  above pins one frozen copy of the harness and varies only my files.

  Screenshots: `scratchpad/shots/p3fx-ship-390x844/` and
  `p3fx-final-320x568/` (dense lanes at 1× and 3×, leaks, the loss),
  `p3fx-beats-390x844/` (the gate at full health and breached, the four proc
  rings, the loss ceremony — captured off the canvas **backing store** at 960×560
  and 3× native, so a pixel is judgeable), and `p3fx-reduced/` (the A/B pair).
  Harnesses: `p3fx-lib.mjs`, `p3fx-scene.mjs`, `p3fx-beats.mjs`, `p3fx-clock.mjs`,
  `p3fx-perf.mjs`, `p3fx-perf-nat.mjs`, `p3fx-reduced.mjs`, `p3fx-scale.mjs`,
  `p3fx-hitstop-det.mjs`.

  **Honest gaps.** Squash-and-stretch on units (checklist item 2) is *not* here
  and was refused rather than forgotten: squashing a sprite is a non-integer
  draw, and one pass just spent itself getting every draw to exactly 1.000. The
  weight it would have bought is bought instead by the silhouette flash, the
  drawn recoil and the velocity-stretched projectile, none of which resample
  anything. There is no camera kick because there is no camera — the board is
  fixed and shake covers it. And the reward ceremony at the end of a *won* wave
  is still the `WAVE_BEAT_MS` hold plus the audio sting; the canvas contributes
  nothing to a victory yet, only to a loss.

- **2026-08-21 — the icon layer, and the end of the glyph shortage.** The item
  and status layer of the UI was 100% Unicode, and there were not enough
  distinct glyphs in it to go round. Measured in the shipping shell before this
  pass: **39 distinct mark glyphs**, of which **eleven carried two or more
  unrelated meanings** — `⛨` alone meant body-armour-the-item-kind, armour-the-
  stat, the Assist setting AND base integrity; `◆` meant a filled gear slot, an
  unknown item kind, a wave's loot and an item reward card; `❖` meant the
  shrine, "evolution ready" and the victory flourish. 26 item nouns and 5
  rarities shared **four** marks (`⚔ ⚒ ⛊ ⛨`), so a Greatsword, a Warhammer, a
  Bow, a Staff and a Grimoire were the same picture; all five off-hands and all
  five keepsakes were the same picture. **22 distinct combat effects had no mark
  at all.** And the one property that decides whether a drop is worth anything
  to a given hero — physical versus magic, against enemies that shrug off 15–35%
  of one or the other — had no visual channel anywhere in the game.

  After: **15 mark glyphs, one meaning each, zero collisions** (`node
  p3-glyphs.mjs`, which strips comments before counting so prose about a retired
  glyph is not mistaken for a render of it).

  **The style, measured off the shipped sprites rather than assumed.** A probe
  over all 243 harvested PNGs, and two of the three things the pass was briefed
  with turned out to be wrong:

  - The outline is `#161C2E`, **fully opaque**, and it is the strongest tell —
    247,849 of the opaque pixels in the whole harvest, present in all 68 files
    under `ui/tinyswords/`.
  - **There is no 1px outer halo at alpha 80.** Alpha 80 appears on exactly
    three files — the 128×128 pickups — and what it draws there is a *ground
    shadow*, an ellipse under the object. The 30 system icons use a different
    device again: alpha **100** for their interior fill, 255 only for the
    outline, because they are drawn to sit on a light button. Reproducing a
    halo that does not exist would have been the foreign-looking choice.
  - Density is 1× everywhere. No file in the kit is a scaled block grid.

  So the atlas reproduces what is actually there: an opaque `#161C2E`
  silhouette ring, applied uniformly by `outline()` rather than hand-drawn 66
  times, over a palette every entry of which occurs in the harvest.

  **66 icons, 2,746 bytes, one request.** `public/assets/ui/fw-icons.png`,
  16×16 cells in an 8×9 grid, generated by `scripts/fw-icons.ts` (dev-only,
  `sharp`, same contract as `scripts/icons.ts` — nothing in the build generates
  images). 22 status/effect marks, 18 item shapes covering the 26 nouns, the two
  damage-type marks, the three currencies, the six places and events, and the
  system set. Not 66 `<img>` tags (66 requests, 66 precache entries) and not 66
  inline SVGs (the same art inside the JS bundle, parsed every boot, and
  pixel-perfect 16px pixel art is what SVG is worst at). `channels.ts` carries
  the same key list as `ICON_ORDER` and the generator **refuses to write the
  file** unless the two match, so the duplication is checked rather than
  trusted — a shifted atlas is 66 wrong pictures, not one visible error.

  **Integer scales only, 16 and 32.** `image-rendering: pixelated` at a
  fractional scale does not soften, it duplicates and drops columns, and the 1px
  outline is exactly the feature that breaks when it does. That is also why
  Large UI does not scale icons: the type ramp grows 15%, which would put them
  at 18.4px. Measured across the matrix, every icon on screen is 16.00 or 32.00
  CSS px at both scales, both contrast modes and all four vision modes.

  **The three free fixes, which were free and did multiply everything.**
  `MenuRow` accepted no icon at all, so every `Offer` that already declared a
  `glyph` had it dropped at the render site: the merchant board and the Spoils
  screen — the emotional peak of a roguelite — were lists of plain text rows.
  `Tile` had an `art` slot that had existed since the shell landed and was
  passed from nowhere, so every tile in the game fell through to the glyph
  branch. And the battle roster card drew a 30×30 square of archetype hue with a
  14px glyph in it while `heroArt` — one import away, already drawn on hero-pick
  and at the Crossroads — resolved the real Tiny Swords sprite for the same
  archetype: the three cards you look at for the whole of a battle were the
  least illustrated thing in the game. All three are wired.

  **`describeMods` is the highest-reuse hook in the codebase, and it was not
  touched.** Every effect sentence in the game comes out of `describeMods` /
  `describeBase` / `describeEnchant` in `src/game/data/`, and they are read on
  the hero panel, in item details, on 39 tree nodes, 11 mutations, 9 upgrade
  levels, 16 reward cards and 6 shrines. `effectIcon` in `channels.ts`
  classifies their OUTPUT — 26 rules in priority order — so one table lights all
  of it and the data layer stays owned by whoever owns the data layer. Order is
  load-bearing and every entry that looks redundant is not: `−22% melee damage
  taken while blocking` contains "damage", `executes below 12% HP` contains
  "HP", `life-drain: +0.4 base HP per 100 damage` contains both. An unrecognised
  line returns `null` and renders exactly as before; there is deliberately no
  "unknown" icon, because a wrong picture is worse than no picture. For the same
  reason the body-line classifier is **opt-in** (`bodyIcons`) and set only where
  a body is generated end to end — the merchant's stock, the Forge's stock, item
  reward cards. Left on everywhere, "Threat is the HP multiplier on every enemy
  in every wave that follows" would have taken a heart.

  **The count channel survived, and doubled.** The Phase-2 fix for a colour-only
  rarity ramp was a letter plus a pip count, and the brief for this pass was
  explicit that new art must be ADDITIVE. A pack tile now carries: the rarity
  INITIAL (11px, 5.00:1 on its ground), the rarity PIP COUNT (1–5), a rarity
  ORNAMENT COUNT (1–5, up the left edge, opposite the pips), the item's own
  shape, and on a weapon its damage-type mark. Five channels where there were
  two, four of them readable with colour switched off entirely. Measured at
  390×844 and 320×568, both scales:

      C  pips=1  orn=1  blade      mark=phys   46x46  overflow=no
      R  pips=2  orn=2  grimoire   mark=magic  46x46  overflow=no
      E  pips=3  orn=3  hammer     mark=phys   46x46  overflow=no
      L  pips=4  orn=4  bow        mark=phys   46x46  overflow=no
      M  pips=5  orn=5  staff      mark=magic  46x46  overflow=no

  The rarity "frame" is an ornament COUNT rather than five pieces of frame art,
  and that is the point rather than a shortcut: five frames differing only in
  hue would put rarity back on colour alone, which is the failure two phases
  already paid to fix, and five frame PNGs would spend real bytes carrying a
  channel a count carries for free.

  **Three defects caught by rendering rather than by assuming**, which is what
  the loop is for. (1) `armour` was first drawn as three tapering steel bands —
  scale armour, in principle. At 16px on a real settings row it read as a
  **hamburger menu**: a picture saying something other than what it means, which
  is the exact defect this pass exists to remove. The second attempt was a
  breastplate, which reads correctly and is the same object as `plate`, the
  heavy-body item kind, so the collision only moved. It is a great helm.
  (2) The roster portrait was first fitted with `transform: scale(1.35)`, and
  `ws9-fit` caught it immediately — a transformed child overflows its box (35×38
  inside 30×28) whether or not the box clips it; as a plain grid item with
  `height:100%` it still measured 30×31, because the grid row is sized by its
  tallest item and not by the badge. It is `position:absolute; inset:0` with
  `object-fit: cover`, which fills by cropping the feet off a standing figure.
  (3) The archetype mark on that portrait shipped at **10px** and `ws9-audit`
  failed it on seven surfaces — it is the one mark that still says "fighter"
  when the rail hue is gone, so it is the last thing in the shell allowed to be
  undersized. 11px, and the coach strip's mark went the other way: at 32px it
  measured **579.9px of bands in a 568px viewport** at 320 Large and `dm-reach`
  caught it, because the strip is one line of type and the mark beside it is a
  line-height thing rather than a tile.

  **Contrast on every new surface**, measured with the real composited ground at
  390×844 and 320×568, standard and high contrast, and all four vision modes —
  lowest value seen anywhere: **5.00:1** (`.sh-tile-rar`, 11px, needs 4.5).
  `.sh-hero-arch` 11.05–13.77, `.sh-line.iconed` 10.21–11.84, `.sh-chip`
  6.23–9.29. Every icon is `aria-hidden` with `data-icon` for the harness, and
  every place one is drawn already carried the same meaning in text — which is
  what makes it safe for the layer to be silent, and safe for it to be missing.

  **The precache stopped carrying art nothing renders.** The harvest added 86
  files no shipping code names — 115.7 KB by basename, 199.1 KB once
  `tinyswords@half/` and the unused FX are counted properly — and each one was
  an extra request on every player's service-worker install, because "optional"
  meant "everything that is not a bundle chunk" and the walker cannot tell a
  wired sprite from a harvested one. The precache is now derived from what the
  BUILD names: basename or extension-less stem present in the emitted JS/CSS/
  HTML, or a `DYNAMIC` directory prefix for the paths that are built from a
  variable at runtime (`assets/sprites/…/${archetype}.png`, `assets/audio/…`).
  The haystack is the emitted code and not the source, which is what makes
  `tinyswords@half/` measurable as dead rather than arguable: `pixmap.ts` names
  it in prose and never in an expression. The stem test exists because
  `fx.ts` holds `['explosions','fire']` and appends `.png` at the call site — a
  basename-only test dropped both effect sheets. The never-precache guard tests
  the DIRECTORY, not the basename, because both dead folders are shadowed by a
  live folder holding the same filenames (`tinyswords@half/barrel1.png` against
  `tinyswords/barrel1.png` — the whole point of a half pack), and a basename
  test reported all 46 as referenced when every reference was to the other copy.
  If either folder is ever wired up, the build **fails** rather than shipping an
  offline install quietly missing its art. The cache digest also moved to the
  precached set only: hashing files the worker never stores meant editing an
  unwired deco PNG evicted every installed player's cache to re-download a build
  whose stored bytes were identical.

      install set   268 files / 1,594 KB   ->   136 files / 1,396 KB
      dropped       132 files /   199.1 KB  (63 ui/tinyswords, 46 sprites@half,
                                             18 deco, 5 fx)
      added           1 file  /     2.7 KB  (fw-icons.png)
      net           -131 requests, -196.4 KB on a cold install

  **`tinyswords@half/` stays on disk and comes out of the precache.** Once
  nothing requests it, it costs a player exactly zero bytes, so deletion buys
  nothing a player can feel; it is another agent's documented swap point with a
  stated condition for flipping, and deleting it turns a one-line loader change
  into a re-run of a sprite pipeline. The two reasons `pixmap.ts` gives for not
  consuming it both check out independently: the champion bucket needs native
  density, so using the half pack means shipping BOTH (236.9 + 85.5 = 322.4 KB
  against 236.9), and its baked halo is the pack's own cool `#161C2E`, which is
  the colour `docs/BRAND.md` rules out for chrome, where the renderer wants a
  warm rim light. That is a "not yet" with a test attached, not a "never".

  **Honest limits.** Three icons are the weakest in the set at 16px and are
  named here so the next pass knows where to start: `axe` and `hammer` differ
  only by the blade shape on the same haft, and `bow` reads as a rounded C with
  a string. `armour` (the helm) and `plate` (the heavy-body item) remain
  siblings by design — they are the same idea in two namespaces that never share
  a list. The `?shell=0` legacy screens (`src/ui/components/`, `src/ui/screens/`)
  were left on glyphs: they are the fallback path, not the shipping UI, and the
  vocabulary is exported and ready for them. And **one collision is outside this
  pass's ownership and survives**: `src/game/render/renderer.ts` still draws `✦`
  as the rogue archetype (line 893) and as the battlefield stun indicator (line
  1052), both of which `channels.ts` asserts is Watch Marks and nothing else.
  That file belongs to the renderer agent; the fix is `ARCHETYPE_GLYPH.rogue`
  and a different stun mark.

  **Verification.** `tsc -b --force` and `npm run build` clean. `ws9-audit` 0
  failures at normal AND Large; `ws9-fit` 0; `ws9-firstrun` 7 taps, no dead
  taps; `dm-audit` 0 failures across all 20 matrix cells; `dm-reach` 0 failures
  (20/20, including the 320×568 Large cell the 32px coach mark had broken);
  `rev-misc`, `rev-trap`, `rev-shift`, `r2-confirm`, `x-confirm3` and all ten
  `fw2-*` scripts exit 0. No `process`/`Buffer`/`__dirname` under `src/` (the
  only hits are the word "process" in prose). Screenshots at 390×844 and
  320×568, both UI scales, both contrast modes and all four colour-vision modes:
  `scratchpad/shots/p3-final-390/`, `p3-final-320/`, `p3-390x844-large-std-
  default/`, `p3-320x568-*/`, `p3-390x844-normal-high-default/` and
  `p3-390x844-normal-std-{deuter,protan,tritan}/`; before/after on the same
  script in `shots/p3-before/` and `shots/p3-after/`. Zero page errors and zero
  4xx on every capture.

  `npm run balance` passed every invariant with this pass's changes in the tree
  (run at 14:2x). It reports 2 failures now, and they are **not reachable from
  anything this pass owns**: `grep -rE "from '.*(ui/|styles/)" balance/ src/game/
  src/state/ src/audio/` returns nothing, so no file under `src/ui/`,
  `src/styles/` or `vite.config.ts` is in the harness's import closure at all.
  Both failures are Monte-Carlo properties of the hub and the Banner ladder, and
  `balance/harness.ts` and `balance/report.ts` were modified at 14:09 and 14:34
  today — the latter one minute before the failing run — by the agent who owns
  them.

- **2026-08-21 — the adversarial pass on the icon layer (P3b).** A review of the
  Phase-3 icon work found six defects the pass itself could not have seen,
  because every render it took was at 390×844 and every icon it judged was
  judged in the atlas. Both of those are the wrong instrument.

  **C4 — the shipped atlas was not the art it was authored in.** The generator
  ended `.png({ palette: true, colours: 64 })`. sharp does not honour `colours`
  on that path: the committed file decoded as **bit depth 4, sixteen palette
  entries** against 25 authored colours. Neither violet survived (`#a8719a`,
  `#775396` both gone), parchment light and mid collapsed into one entry, three
  unrelated authored colours all landed on `#aa7c70`, and six of the sixteen
  shipped colours occurred in no source file — contradicting the palette
  comment's own claim that every entry is a colour from the harvested CC0 set.
  The cost fell on the pair that had to work: `magic` and `phys` are the mark
  for the property `offers.ts` calls the single thing that decides whether a
  drop is worth anything to a given hero, and they were designed as
  violet-versus-steel. Quantised, `magic` shipped as a muddy tan spark next to a
  grey diamond. Fixed by encoding truecolour. Measured off the shipped file
  after: **25 of 25 authored colours present, no quantisation**, and the pair
  separates by 196° of hue, 29 saturation points and 118 of RGB distance —
  `phys` a solid diamond with 0 interior gaps, `magic` a radiating star with 16.
  An indexed PNG of 26 opaque colours saves almost nothing at this size; the
  whole difference was ~868 bytes on one forever-cached request.

  **M1 — the wave strip covered up to 40% of the battlefield.** `.sh-wave-strip`
  was `position: absolute; inset: 0 0 auto 0` over the canvas on a
  `rgba(20,12,6,0.72)` scrim, and because it carried the speed toggle at the
  44px touch floor it stood 54–62px tall. Measured share of the composed field:
  1.4% at 390×844, 23.9% at 375×667, 27.9% at 360×640, 35.5% at 320×568 and
  **40.4%** at 320×568 Large — hiding build slot `s1` and the top lane of
  `kilnroad` on four of ten viewport × scale cells. 390×844 is the outlier for a
  geometric reason: at that aspect the canvas is width-limited and letterboxes,
  so the scrim lands on the black bar. Every shorter phone makes it
  height-limited and the scrim lands on the map. **Every Phase-3 render was
  taken at the one viewport whose geometry hides this.**

  The fix was not to shrink the strip but to delete it. Its three contents —
  wave name, kill progress, speed toggle — moved into `WaveBar` in band 4, which
  already renders for every frame of a battle and already reserves 56px. One
  line, so the band's height is unchanged and the Stage gives up nothing
  further; the field costs zero pixels either way, which is what makes this a
  repair rather than a trade. `rv-occlude.mjs` after, all ten cells: **no strip,
  no absolutely-positioned children over the canvas at all, 0 logical rows
  hidden, 0 of 9–10 path points under, 0 slots under.**

  **M8 — five icons collided when judged at 16px.** In the atlas, at six times
  size, all 66 looked distinct; at the size they ship, five pairs were the same
  picture. `armour` (a great helm with two eye slits and a breathing grid) and
  `boss` (a skull) — two dark holes and a mouth make a cranium whatever the
  outline is doing. `axe` (a head on a full-height shaft with a foot) and `wave`
  (a pennant on a pole). `bow` (a leather arc and a string) and `curse` (a
  violet annulus) — both a dark broken "C". `splash` and `marks` — both an
  eight-rayed gold burst, one a combat effect and one the meta currency. `stun`
  and `gold` — both a yellow disc with a lighter figure inside it. The
  self-assessment had named `axe`/`hammer`/`bow` as the weak ones; `hammer` is
  fine and `armour`, `splash` and `stun` were the real problems, which is what
  judging in the atlas does to you.

  Redrawn, and the first attempt at `armour` had to be thrown away too: a banded
  pauldron renders as three grey bars with dark lines between them, i.e. a
  hamburger menu — the exact failure this pass had already caught once with
  scale mail. It ships as a crested helm with one T-visor. `axe` is double-bit,
  because symmetry is what a flag cannot do. `bow` puts an arrow through the
  arc. `curse` is a cracked violet gem. `splash` is a red detonation inside a
  dashed gold radius. `stun` is three separated five-pixel stars.

  Also under M8: three keys were still carrying two meanings apiece. `armour`
  meant the armour stat AND the Assist setting — the last survivor of the
  original eleven collisions, so the accessibility handicap was drawn as a
  defence statistic. `settings` (a cog) meant the Settings screen AND "put your
  gear on". `wave` meant four things: an incoming wave, the wave-clear beat,
  "start a campaign", and "post a Sentinel on a slot". And `✕` meant both "a
  Sentinel is dead on the field" (the renderer) and "dismiss this tip" (the
  coach strip) — both red on dark, both reachable during setup. Five cells
  appended (`slow`, `weaken`, `assist`, `equip`, `deploy`), both dead cells
  revived (`depth` is the Hub's Start a Run; `curse` marks a cursed enchant
  line, which is the one thing about an item that its own effect sentence
  cannot say — `Reckless — +85% damage, −45% attack speed` classifies to
  `damage`, a true reading of the words and the wrong headline for the item),
  and the coach's dismiss is the word "Got it".

  **M9 — 25 keepsake names drew the wrong object.** `itemIcon` was an ordered
  list of small regexes tested by LIST order, under a comment asserting it
  matched `items.ts`'s `renameFor` "and the order matters in the same way". Two
  different machines: `renameFor` is one alternation, matched
  leftmost-by-position, so the noun that appears earliest in the NAME wins; a
  list is matched by entry order, so the earliest ENTRY wins wherever it sits.
  They agree until a name carries two nouns, and keepsakes do — `of Focus` is in
  the keepsake enchant pool and keepsakes are named `${rarity} ${noun}
  ${enchant}`. `Legendary Banner of Focus` was a Banner by `renameFor` and an
  `orb` here, at the pack tile, merchant row, forge row, reward card, gear slot
  and item-panel head. Rewritten as the same alternation in the same branch
  order. Enumerated over **10,835 generatable names**: the old table mismatched
  on **25**, the new one on **0**.

  **M10 — speed-lines on the three slowest items in the game.** `effectIcon`
  returned the first rule in list order that matched anywhere, which is right for
  one effect and wrong for a sentence carrying several — and an enchant renders
  whole. `attack speed` sat at index 9 and outranked `crit` at 11 and `damage`
  at 25, so `Reckless — +85% damage, −45% attack speed` and `Wild` both wore
  `haste`. There was also no polarity channel at all, so `−45% attack speed` and
  `+20% attack speed` were the same picture, and every two-handed weapon in the
  game (`−8% Attack Speed`, straight off `describeBase`) advertised itself as
  fast. Now leftmost-by-position with list order as the tie-break, plus a sign
  read backwards over the number, plus two mirrored cells. Swept over **1,969
  distinct effect lines** generated from the real trees, upgrade paths,
  mutations and 40,000 rolled items: **26 classifications changed, every one of
  them a leading-term or a polarity fix, and no previously-correct line moved.**

  **M11 — icon-only channels, against the layer's own invariant.** `channels.ts`
  states that an atlas which fails to load costs decoration and no meaning.
  Three sites broke it. `damageMark` was the only statement of an item's damage
  type on the pack tile, the offer card and the menu row, and none of the three
  accessible names mentioned it — compounded by C4 having removed the hue
  difference too. The `boss` skull was `aria-hidden` with no label and `t.name`
  never says "boss", so a screen-reader user was never told one was coming. And
  four strings still told the player to look for a `⚡` Threat chip that has been
  three climbing bars since P3 — including, on the map nodes the shell itself
  renders, an actual second `⚡`. Fixed: two sites build the name themselves, the
  menu row gives the mark `role="img"` and a name, the composition row prints a
  visible `Boss` tag, and the map node draws the same sprite as the header.

  The first attempt used a `width:1px; overflow:hidden` visually-hidden span, and
  **ws9-fit flagged ten of them across the matrix** — that harness audits exactly
  that shape to catch a control whose label has been cut off. A layout audit that
  shouts on genuine clipping is worth more than the convenience utility, so there
  is deliberately no `.sr-only` in this codebase and the note in `global.css`
  says why.

  **M13 — the guard was watching the half that could not go wrong.**
  `fw-icons.ts` said "Run with `npm run fw-icons`" and there was no such script;
  nothing in `build` or any test invoked the order check. Worse, the checked,
  duplicated, append-never-reorder cell list in `channels.ts` guards the NAMES,
  while `background-size` in `global.css` decides where a cell actually IS — and
  it hardcoded `* 8` and `* 9` under a comment claiming it read `--fw-i-cols`, a
  token defined nowhere in the project. Append eight icons and every sprite
  samples a fraction of a cell short: the same "wrong pictures" failure,
  relocated to the one door nothing was watching. The grid is now two named
  tokens in CSS and two exported constants in TS; `npm run fw-icons:check`
  re-encodes into memory, byte-compares the committed PNG, and verifies all four
  against the real sheet plus the shape of the `background-size` rule itself;
  and `npm run build` runs it. Negative test: bumping `--fw-i-rows` to 10 fails
  the build with `global.css --fw-i-rows is 10, atlas is 9`.

  **Smaller things.** The resist chip's accessible name said "shrugs off …
  **of the damage it takes**", a universal claim `engine.ts` does not honour —
  `execute` returns before `damageEnemy` and bypasses resistance entirely — so
  the screen-reader version was the stronger and falser of the two; it now
  matches the visible text exactly. **Swift Raid disclosed nothing**: its
  modifier is `physKeep 0.5 / magKeep 0.5` with no resist of its own, so over a
  torch goblin's zero base resist both resists came out zero and the rows only
  print a chip for a truthy number — the one variant whose entire content is
  *coverage* looked like a plain wave. `WaveVariant.asks` and `EnemyMod.blurb`
  both existed and were rendered nowhere; both are rendered now, `asks` recovered
  from the wave label (every variant label is distinct and `defaultLabel` appends
  it) rather than by adding a field to another agent's data layer. **The Kiln
  Road is named**: `GameMap.name` was dead data on both maps and the run's most
  visible piece of input randomness was announced by the pixels alone. The two
  dead palette entries (`#87465a`, `#276740`) are in use, so all 25 authored
  colours now appear in the file. `iconCell` throws on an unknown key instead of
  returning `{-1,-1}`, which was a valid background-position one cell off the
  sheet — a silent transparent square. Stale comments corrected: the resist range
  is 5–55%, not 15–35%; "64 icons" is 71; and `Icon.tsx`'s claim that the
  `?shell=0` screens import it was never true (they do not, and `RunMapView` is
  the real second consumer).

  **One thing found and not fixed.** `SelectorBand`'s `OfferCard` — one of the
  three M11 sites — is unreachable in the shipping shell: every context with
  `selector: 'offers'` is `layout: 'page'`, and `SelectorBand` only renders under
  `layout: 'bands'`, where the selector is always `'party'`. The fix is in place
  and correct if it ever renders, but `.sh-offer` and its CSS are currently dead.

  Payload: `fw-icons.png` **2,746 → 3,853 bytes** (+1,107) for truecolour plus
  five new cells; like-for-like at 66 icons the truecolour re-encode is +868.
  `tsc -b --force` and `npm run build` clean; nothing under `src/` references
  `process`, `Buffer` or `__dirname`. `ws9-audit` 0, `ws9-fit` 0, `dm-audit` 0
  across the matrix, `dm-reach` 0, `ws9-firstrun` 7 taps and 0 dead, and
  `rev-misc`, `rev-trap`, `rev-shift`, `r2-confirm`, `x-confirm3` and the eleven
  `fw2-*` harnesses unchanged. `npm run balance` reports 3 failures — the `reach`
  enchantment's magic-scenario delta, the `Incendiary` mutation's value, and an
  elite body-mix gate whose own note says it was rekeyed this session — all of
  them inside `balance/` and `src/game/data/`, neither of which this pass edited,
  and all three of them Monte-Carlo properties of the wave and enchant tables.

- **2026-08-21 — Phase-3 render/FX: three CRITICALs, and four channels that were
  lying.** An adversarial review of the Phase-3 game-feel pass found that three
  of the readability channels it had shipped were not merely weak but
  **inverted**: they carried the opposite of the truth. All three came from the
  same place — the presentation layer treating a continuous process as a discrete
  event — and all three were invisible to the pass's own gates, because the gates
  counted particles and sprite scales and nothing watched the channels that
  broke.

  **C1 — every burning enemy was a featureless white blob for the whole burn.**
  `engine.ts` applies `burnDps * dt` on *every* tick a burn is live, so step 5 of
  the tick differ ("hp fell → `fxHitEnemy`") re-armed a 110 ms hit flash sixty
  times a second and it never decayed; `blitPixmap` then painted the white
  silhouette at `globalAlpha 0.92`. Measured: **42 of 44 frames pinned at flash
  1.000, mean 0.993**, sustained for the whole burn, with thorns and traps on the
  same path. Faction silhouette, tier colour and the torch goblin's detached
  flame were all gone; the notch plaque was the only surviving channel. Any run
  carrying a burn enchant turned the horde into identical white blobs.

  The fix is the distinction the differ never drew: **a tick of a
  damage-over-time is not a hit.** Attrition gets its own channel
  (`fxDotEnemy`) — the unit's own silhouette in ember orange at 0.34 against the
  impact flash's warm white at 0.92, never touching `flash`, never touching the
  recoil, and rate-limited to a ~2.2 Hz pulse, because a continuous process drawn
  continuously is a constant and a constant carries no information. An enemy is
  classified as HIT only when a reconstructed projectile reaches it *and* the HP
  drop exceeds what its own live DoTs could have produced that tick.
  Re-measured: **0 of 151 frames pinned, mean flash 0.000**, attrition at a 36%
  duty cycle (120 pulses against 3,204 ticks the gap suppressed).
  `scratchpad/shots/fix/C1-B-BEFORE-old-step5.png` (the old step 5, reproduced
  from the page against the *shipped* build, so nothing but the classification
  differs) against `C1-C-AFTER-real-burn.png`.

  **C2 — the drawn knockback did not exist: 0 of 988 samples.** Same root cause.
  Step 3 wrote directional recoil; step 5 ran afterwards with no exclusion and
  `fxHitEnemy` *assigns* rather than accumulates, so every hit in the game was
  overwritten by the DoT nudge. Measured over 14 s of real battle:
  `enemyNonZeroX 0`, `enemyMaxLen 0.475`, `enemyAngle {"-90": 39}` — every recoil
  straight up, at exactly the attrition strength, and `blitPixmap` rounds to
  whole logical px so it usually rounded to zero. Secondary: the documented
  3.4 px ceiling was unreachable, `min(3.4, 1.9 x strength)` with no caller
  passing `strength > 1`. Now the tick tracks which enemies took a discrete hit
  and step 5 skips them, and `strength` scales the ceiling itself. Re-measured
  over the same 14 s: **`enemyNonZeroX 60`, `enemyMaxLen 3.40`, `enemyMaxAbsX
  3.17`**, angles spread across real shot directions. The tower half is untouched
  (750/803 non-zero, max 2.20).

  **C3 — the palisade gate lied about base HP and inverted at defeat.** `rank`
  was integer-spaced and compared against `gone / 2`, so half the values of
  `gone` changed nothing — seven planks, four states. `floor` meant `gone` stayed
  0 until a sixth of the base was lost, so at **19, 18 and 17 of 20 the gate drew
  completely intact**: three leaks, 15% of the run's health, reported as
  undamaged. And `fallen` short-circuited the `continue`, so at the moment of
  defeat the gate went from 2 planks back to **7** — the count inverted exactly
  when it had to be unambiguous. This is the channel whose own comment calls it
  "the one visual variable that survives every colour-vision difference". Now a
  plain monotone count with `ceil` and an explicit middle-out removal order, and
  `fallen` changes the plank geometry without changing how many there are.
  Measured across every base-HP value 20 down to 0:
  `7 6 6 5 5 5 4 4 4 3 3 3 2 2 2 1 1 1 1 1 1`, **monotone non-increasing, 7
  distinct states, first damage visible**, and **1 plank at defeat**. Strip:
  `shots/fix/C3-gate-strip.png`.

  **M2 — the tier notch was sub-pixel on the smallest phone.** The comment
  claimed the notch "never drops below the ~1.6 CSS px it needs to survive the
  phone's 0.41 scale" — but 0.41 is the *largest* view scale in the matrix.
  Measured at 320x568: a **1.11 px notch with a 0.72 px gap** (0.70 during setup,
  where placement happens), i.e. tier was colour-only again on the smallest
  supported phone, for exactly the player the plaque was built for. A constant in
  logical px cannot express "big enough to read" when a logical px buys 1.5x more
  CSS px at one end of the matrix than the other, so `BattleCanvas` now pushes
  the live view scale into the renderer and the notch and gap are floored in
  **CSS px**. Measured at all five viewports: notch >= **1.70 CSS px**, gap >=
  **1.15**, 320x568 included. The geometry is exported as `tierTagGeometry()` —
  `rv-small` re-derived the formula and measured its own copy of it, which is why
  it still reports the old numbers after the fix, and why the next gate should
  measure the renderer instead of restating it.

  **M3 — the `pixelated` rejection was argued from a downscale and is wrong at
  dpr 3.** The `app.css` justification reasons entirely from "960 to 780 discards
  180 of 960 columns" — the dpr-2 case. At **dpr 3, four of five matrix viewports
  are upscales** (1.219x, 1.172x, 1.125x, 1.055x), where nothing is discarded and
  the argument has no force; what `auto` does there is smear a frame composed at
  exactly 1.000 for the sole purpose of not being smeared. `image-rendering` is
  now decided per viewport from `view.scale x dpr` (`resampleMode()`), the CSS
  keeps `auto` as the pre-layout default, and the comment states both cases.
  Measured across the matrix: `pixelated` on 360x640 / 375x667 / 360x740 /
  390x844 at dpr 3, `auto` on every downscale including 320x568 at dpr 3 (ratio
  0.830). Corroborated by compression, a proxy for edge energy: at 390x844 dpr 3
  `pixelated` is *smaller* (862 KB vs 1,007 KB — hard edges, flat runs), at dpr 2
  it is *larger* (541 KB vs 517 KB — aliasing noise). Side by side:
  `shots/fix/M3-dpr3-auto-vs-pixelated.png`.

  **M4 — the 1.000 metric was blind to rotation.** 1,935 of ~15,000 field blits
  (12.9%), all barrels, were drawn under `ctx.rotate` at 14 distinct angles, 12
  of them non-axis-aligned — the third of the three amateur tells the surrounding
  comments spend paragraphs eliminating — and the pass's own metric reported them
  clean, because `dw/sw` stays exactly 1.000 under a rotation. The roll is now
  **pre-rendered quarter turns**, the only rotations of a raster that resample
  nothing (they are a permutation of the source pixels), baked once into a
  four-cell strip so the runtime draw is back under the identity transform. And
  the invariant is restated in full in `blitPixmap` as four conditions rather
  than one — size ratio, context scale, context skew, destination integrality —
  with a zero-cost census (`blitCensus`) behind a flag. Re-measured on the same
  dense scene: **15,043 blits, 0 non-1.000, 0 context-scaled, 0 rotated, 0
  fractional destinations.**

  **M5 — the chain reconstruction could arc to an enemy that was never chained.**
  "Did this enemy lose HP this tick" is not "was this enemy chained": an enemy
  killed earlier in the same tick reads absent-as-zero and was confirmed, while
  the engine picks chain targets *after* the dead are spliced out; and any
  burning enemy was confirmed on every tick. Four fixes: a chain candidate must
  still be on the field and must have taken damage beyond its own DoT; the impact
  point comes from the target's **post-tick** position (the engine re-homes
  `toPos` after moving enemies, so the pre-tick copy was up to ~2.9 logical px
  stale) and the splash/pierce sets are reconstructed against the same positions;
  `EXECUTE` / `STUN` are attributed by **where the word was floated** rather than
  by a tick-global flag, so one tower's proc can no longer relabel another's
  ring; and the `?? 'burn'` fallback — which painted an orange burn ring for
  whatever had actually procced, for any projectile that fired and arrived inside
  one tick — is gone. It draws nothing unless the tower carries exactly one proc
  mod, in which case that is a fact rather than a guess. Measured: a 20-enemy
  lane, every enemy burning, **no shock tower gives arcsMade 0** (it was one arc
  per burning enemy per tick); with a shock tower, 33. Each proc tower shows
  **only its own ring** over ~180 samples each; strip the mods and no ring is
  drawn at all.

  **M6 — every elite variant was pixel-identical to its base type.** `applyMod`
  forces `id` back to the base, so a Warded Bomber shrugging off 49% magic was
  the same pixels as one shrugging off 15%, and a Swift column was 40% faster
  translation on a fixed 10 fps walk cycle — a visible moon-walk. `enemies.ts` is
  another agent's file, so this is solved from what `type` already carries: the
  modifier's own prefix on `type.name`. The channel is a **shape** on the plaque
  the tier count already owns (a shield, a diamond ward, a double chevron), for
  the same reason the count is a count. Separately the walk cycle is now driven
  by **distance covered** rather than by the clock, which fixes Swift, Plated and
  chilled enemies at once and needs no knowledge of the modifier; `STRIDE` is set
  so a line goblin's cadence is the ~10 fps it shipped with.
  `shots/fix/M6-elite-marks.png`, and the whole ladder at 320x568 in
  `shots/fix/M2-320x568-dpr3-tiers.png` — 1/2/3/4 notches plus the three marks,
  all separable on the smallest supported phone.

  **Minors.** Hitstop now micro-shakes: `fxAdvance` computed the shake from `fxT`
  and then returned *before* `fxT += dt`, so for 2-8 frames the phase was frozen
  and only the amplitude decayed — a static offset, not a vibration. A separate
  unconditional `shakeT` fixes it; measured, **8 frozen frames now carry 8
  distinct offsets**. The "a tick allocates nothing" claim was false and is
  corrected to what is true, and the per-tick `Set` allocations behind it are
  gone (hoisted and cleared), along with the fresh objects `fxEnemyRecoil` and
  `fxSentinel` returned on every draw call and the per-frame `targeted` Set.
  `drawThemePreview` carried the last non-1.000 sprite draw in the codebase —
  dead today, but it would have reintroduced the defect the day a theme picker
  landed — and now goes through `blitPixmap`. `PixmapOpts.scale` is typed
  `0.5 | 1` rather than `number`, because the bake silently box-filters by a half
  for anything that is not exactly 1. And `fxStats` grew the counters that would
  have caught C1 and C2 on the day they shipped: live flash count and mean, live
  attrition count, live recoil count and maximum, and cumulative hits, DoT pulses
  and DoT pulses suppressed.

  **The environment's tier-4 gold, and what it cost.** Teal and purple were
  already at 0.0% of the environment's hue-carrying pixels and red at 0.2%, but
  the 30-60 degree bin held **28.4%** — the dirt lane, with `#b0a040` (tier 4) at
  51 degrees, which is what a champion wears while standing on it. Two attempts
  are recorded in the code because both look obviously right and neither is: a
  harder saturation cut brings the bin back at **28.4%, to the decimal** (scaling
  toward luma preserves the hue angle exactly — that is what makes it a
  saturation operation), and a chroma-preserving hue remap of [0,90] to [60,90]
  clears every reserved bin to 0.0% **and turns the road green**, because brown
  *is* 30-60 and everything below it is the reserved red bin. Rejected on the
  picture. What shipped is a hue-selective chroma cut with the grade's own warm
  push neutralised inside the window (that push is itself a gold cast and put a
  floor under the window no upstream desaturation could reach): **gold bin 28.4%
  to 4.3%**, units/environment saturation **1.44x to 1.90x**, value gap 8.5 to
  9.1 points. **Handoff:** the last of it belongs to tier 4's own colour
  (`#d4b24a` / `#b0a040` in `src/game/data/enemies.ts`), which is another agent's
  file; the environment has a legitimate claim to brown and cannot leave the bin
  and stay earth.

  **Verification.** `tsc -b --force` and `npm run build` clean; no
  `process` / `Buffer` / `__dirname` under `src/`. **Rendering is still not
  simulation:** nothing in `balance/`'s import closure reaches `renderer.ts`,
  `fx.ts`, `pixmap.ts` or `BattleCanvas.tsx` (the only file this pass touched
  that is reachable at all is `themes.ts`, and only its type annotations), and
  the claim is measured rather than argued — `balance/REPORT.md` is md5
  **`1c4316113aa5ebee0ccdd5812580b1d8`** with this pass's `themes.ts` change and
  byte-identical with it reverted. `rv-determinism2` 29 PASS / 0 FAIL. `rv-draw`
  15,043 blits with zero violations of any of the four conditions. `rv-final`
  reduced-motion A/B intact (particles / decals / hitstops / trauma to 0 while
  floaters and arcs survive) and the frame budget held on the weakest device:
  **59.8-60.0 fps at 320x568, dpr 1 and 3, 1x and 3x**. `rv-geom` 6/6 slots at
  320x568 on both maps. `rv-colour`, `rv-minors`, `rv-occlude`, `rv-pixelated`
  and `rv-icons` clean. `dm-reach` 0 failures, `dm-audit` 0 across all ten matrix
  cells, `ws9-audit` 0, `ws9-firstrun` 7 taps with no dead taps, `rotate-pause`
  both PASS, and all eleven `fw2-*` scripts exit 0 with no failures and no page
  errors. Screenshots at 390x844 and 320x568 at dpr 2 and dpr 3 in
  `scratchpad/shots/fix/`. `npm run balance` reports one failure — the depth-9
  elite body-mix gate — inside `balance/` and `src/game/data/waves.ts`, neither
  of which this pass edited.

- **2026-08-21 — the differ's attrition threshold, the elite-mark channel, and
  five minors (C1 / M2 / minors 1-5).** Presentation-layer pass. Everything here
  is in `src/ui/BattleCanvas.tsx` and `src/game/render/renderer.ts`; nothing in
  the simulation moved.

  **C1 — an upper bound was on the wrong side of a subtraction.** The tick
  differ decides "was that a shot or a tick of burn?" with
  `drop > (burning ? burnDps * TICK : 0) + ATTRITION_FLOOR`, and the docstring
  defended the `burnDps * TICK` term as "a strict UPPER bound … which is exactly
  the property needed". It is a bound on the right quantity, argued backwards.
  A drop is `attrition_actual + discrete` and nothing else, so
  `drop > bound  ⇔  discrete > bound − attrition_actual`: with an **upper** bound
  that right-hand side is positive and every hit smaller than the slack is
  classified as attrition. Slack in a *subtracted* bound is not conservatism, it
  is a hit budget being spent.

  The slack was real, because `damageEnemy` resists burn by `e.burnType` and this
  predicate did not. On a 55%-plated column an Incendiary at 180 dps charged
  `180 × TICK = 3.000` per tick while the burn actually removed `1.350` — 1.650
  of over-charge, **3.3× the entire 0.5 floor**. This is a same-round
  interaction: raising Incendiary 45 → 180 in another agent's rebalance
  multiplied the threshold 1.25 → 3.5 and the resist over-charge 0.41 → 1.65.
  Neither change is wrong alone; they were never measured together.

  The fix is not a corrected bound, it is **no bound**: `ESnap.atr` is the
  engine's own arithmetic re-run — all three continuous sources
  (`updateSentinels` thorns, `updateEnemies` burn, `updateTraps`), each
  multiplied by the resistance **its** damage type meets on **this** enemy, in
  the same order of operations, so the two agree to the ulp and the floor becomes
  a 1e-6 float epsilon. The burn half is settled by pre-tick state and is
  computed in `snapBefore` (against `elapsed + TICK`, because `step()` increments
  the clock first — reading the pre-increment value kept a burn "live" for one
  tick past its last billing and would have eaten one hit per expiry); thorns and
  traps are settled by what the tick did and are read off the engine in
  `diffAfter`. Thorns are attributed through `e.blockedBy` for survivors, which
  outlives a blocker being downed mid-tick, and through the blocker's `blockIds`
  for bodies the tick removed.

  Measured against engine ground truth — prototype instrumentation on
  `impact` / `applyHit` / `damageEnemy` / `killEnemy` / `updateEnemies` /
  `updateSentinels` / `updateTraps`, with **both predicates run over the same
  tick stream** so every row is paired (`scratchpad/rv4-differ.mts`):

  ```
  scenario                                     | eHit hMISS hSPUR | eImp iMISS | eChn arcs aMISS killArc | corpseDir corpseOrg | dotSPUR | minMargin
  Y1 Incendiary + Chain-Arc marksman  [BEFORE] |   82     0     0 |   82     0 |  178  148    30       1 |     0        0      |      29 |    1.401
     vs barrel4_plated                [AFTER ] |   82     0     0 |   82     0 |  178  178     0       0 |     0        0      |       0 |    3.551
  Y2 marksman + Incendiary + Chain    [BEFORE] |  214    21     1 |  134     8 |  213  191    22       3 |     1        0      |      40 |   -0.152
     Arc vs barrel4_plated            [AFTER ] |  214     0     0 |  134     0 |  213  213     0       0 |     0        0      |       0 |    1.998
  Y3 magic Incendiary pyro +          [BEFORE] |   59     0     0 |   23     0 |   17   17     0       0 |     0        0      |       0 |    3.355
     stormcaller vs tnt4_warded       [AFTER ] |   59     0     0 |   23     0 |   17   17     0       0 |     0        0      |       0 |    5.505
  Y4 magic Incendiary + Chain-Arc     [BEFORE] |   47     0     0 |   47     0 |   50   50     0       0 |     0        0      |       0 |    4.105
     vs barrel5_warded boss           [AFTER ] |   47     0     0 |   47     0 |   50   50     0       0 |     0        0      |       0 |    6.075
  Y5 Warden of Ash burn 26 +          [BEFORE] |  170     0     2 |   73     0 |  177  175     2       1 |     2        2      |       1 |    1.498
     thorns 48 vs barrel4_plated      [AFTER ] |  170     0     0 |   73     0 |  177  177     0       0 |     0        0      |       0 |    1.998
  Y6 Saboteur traps 30dps +           [BEFORE] |  249     2     0 |  145     0 |  194  191     3       0 |     0        0      |       5 |   -0.152
     Juggernaut thorns vs plated      [AFTER ] |  249     0     0 |  145     0 |  194  194     0       0 |     0        0      |       0 |    1.905
  Y7 CONTROL Y2 team vs               [BEFORE] |   30     0     0 |   30     0 |    0    0     0       0 |     0        0      |       0 |   18.621
     unarmoured torch2                [AFTER ] |   30     0     0 |   30     0 |    0    0     0       0 |     0        0      |       0 |   19.121

  totals   hit-miss 23 -> 0        hit-spurious 3 -> 0     impact-miss 8 -> 0
           impact-spurious 2 -> 0  arc-miss 57 -> 0        arc-wrong-target 0 -> 0
           chain-kill arcs lost 5 -> 0                     spurious DoT paints 75 -> 0
           missing DoT paints 0 -> 0                       stale corpse in hit list 3 -> 0
           stale corpse as arc origin 2 -> 0
  ```

  Y5 and Y6 are new and are the thorns and trap cases: a Juggernaut grinds
  `48 × TICK = 0.800`/tick and a Saboteur's trap `30 × TICK = 0.500`, each on its
  own at or over the old 0.5 floor — so that floor was never a bound on attrition
  either. It was covering for the burn over-charge in one direction and being
  overrun by thorns in the other (Y5's two spurious hits and two spurious
  impacts). Both go to zero for the same reason C1 does.

  **The fix is independent of the magnitude that broke it.** Same scenario, same
  seed, Incendiary's burn swept and nothing else changed:

  ```
  burnDps | BEFORE  hitMISS impMISS arcMISS dotSPUR  minMargin | AFTER  hitMISS impMISS arcMISS dotSPUR  minMargin
       45 |              0       0       0       0      1.085  |             0       0       0       0      1.998
       90 |              0       0      16      16      0.673  |             0       0       0       0      1.998
      180 |             21       8      22      40     -0.152  |             0       0       0       0      1.998
      360 |             49      24      45      94     -1.802  |             0       0       0       0      1.998
      900 |             32       7       0      32     -6.752  |             0       0       0       0      1.998
  ```

  The AFTER margin is **1.998 at every magnitude, to three decimals**: `atr` and
  the real drop move by the identical amount, so the margin does not move at all.
  The BEFORE column shows the defect was already latent at 90 (16 arcs) and gets
  worse in both directions, which is what "another agent may still be tuning it"
  means in practice.

  **Minors 1 and 2 — the roster the differ reconstructs against.** The comment on
  `direct` claimed "enemies that died earlier in the tick are not in it". They
  were: `eSnap` is the pre-tick roster with no liveness filter, while `impact()`
  scans `this.enemies` with every leak and earlier kill already spliced out. The
  three exits split cleanly by *when*: a leak or an attrition kill happens in
  `updateEnemies`/`updateSentinels`, **before** any projectile, and is never a
  candidate; a kill by an earlier projectile in the same tick was a candidate for
  that shot and no other, because a body can only be killed once and `pSnap` is
  in the engine's projectile order; a trap kill happens in `updateTraps`, which
  runs **last**, so that body was standing for every impact and stays in.
  `candidate()` encodes exactly that, with the attrition kill identified by
  `e.hp <= e.atr` — not a guess, a statement that this tick's own exact DoT toll
  covered everything the body had left. Cross-checked against the engine's own
  removal phase: **80 bodies over the seven scenarios, 80 reconstructed, 0
  disagreements.** With the corpses gone, the chain guard
  `if (!hpNow.has(c.id)) continue` — which suppressed **every arc that scored the
  kill**, the most legible chain event there is — comes out; the 5 chain-kill
  arcs it was discarding are the whole of the arc-miss column that survives the
  C1 fix.

  Proc attribution is the one thing this could have reached, through `origin`
  becoming null where it used to be a corpse (which matches the engine: it sets
  `procFlash` only `if (hitList.length > 0)`). Graded: **509 shock/burn
  attributions across the seven scenarios, 0 changed.**

  **M2 — the elite-mark channel was keyed on a display string.** `eliteMark`
  string-matched `'Plated '` / `'Warded '` / `'Swift '` against `type.name`.
  Correct today and one copy edit from silently wrong: the thing it matched is
  `EnemyMod.prefix`, whose own docstring calls it "Display prefix on the enemy's
  name, shown in the pre-wave preview", in a file the comment beside it calls
  another agent's. Renaming `Plated` to `Ironclad` returns `null`, the mark
  vanishes, and every elite is pixel-identical to its base again — the exact
  defect that fix exists to close, restored with every gate green. It failed
  silently the other way too: a future base named "Swift Runner" wore an unearned
  chevron. The mark is now keyed on the `EnemyType` **object**, resolved once
  through `modKey` from the same `(base, mod)` composition `enemies.ts` registers
  under — the gameplay identity that file itself names as the durable one — and
  `ELITE_MARK_BY_MOD` must cover every entry in `ENEMY_MODS` or the module throws
  on import in dev and logs in prod. `eliteMarkAudit()` is exported so the
  assertion can be made over the whole registry rather than the three variants
  someone remembered. `scratchpad/rv4-mark.mjs`, against the live app: **60
  registered types (15 base, 45 modified); 0 variants without a mark; 0 mod ids
  uncovered; 0 base types wearing one; a base literally named "Swift Runner"
  resolves to `null`; under a `prefix` rename to "Ironclad" the identity mark is
  unchanged for all three while a string matcher returns `null` for all three;
  three distinct marks. ALL PASS.**

  **Minor 3 — the mark had no feature floor of its own.** `NOTCH_MIN_CSS = 1.7`
  floors the notch, a solid bar whose job is to be counted, and said nothing
  about the mark beside it. Measured off `tierTagGeometry` at every matrix
  viewport, tier 3, radius 13: the swift chevron's stroke was **0.77 CSS px** and
  the gap between its two chevrons **0.64** — 45% and 38% of the notch floor, so
  at dpr 2 two 1.5-device-px strokes 1.3 px apart, and "double chevron" aliased
  to one. The chevron is now laid out from a floored stroke and arm
  (`MARK_FEATURE_MIN_CSS = 1.15`, the same number `NOTCH_GAP_MIN_CSS` uses for
  "these two must not merge") and the mark's **width is derived from them**
  rather than the features being squeezed into a width. The plated shield's only
  distinguishing feature, its taper, went from 0.50 to 0.58 of the mark height —
  a shape change at no size cost, and above the floor at every viewport by
  construction. Measured, identical at all five viewports: **stroke 0.77 → 1.15,
  chevron gap 0.64 → 1.15, plated taper 1.40 → 1.62 CSS px**; the tier-3 swift
  plaque grows 9.5 → 16.3 CSS px wide.

  **Minor 4 — the harness that gates that channel was measuring its own copy of
  the formula.** `rv-small.mjs` still computed `const notch = 4 * m.sc`: the
  radius-driven term only, with the CSS floor the shipped code applies on top of
  it omitted entirely, reporting **1.11 CSS px where the shipped value is 1.70**
  — a 35% under-report, in the direction that manufactures a failure, on the one
  channel that section exists to gate; and it knew nothing of the height floor or
  of the mark. `tierTagGeometry` was exported specifically to end this and says
  so; the export landed and the harness never moved. It moves now — every number
  in that section is read out of the shipped module at the live view scale
  `setViewScale` wrote.

  **Minor 5 — the barrel rolled backwards on a third of the lane.** The pose
  index was `floor((pos.x + pos.y) / (r * 1.6))`. The sum of the two axes is not
  distance travelled: where the lane heads right-and-up it *falls* while the
  barrel advances. Measured along the whole Green Line at 2 px steps
  (`scratchpad/dz-rolldir.mjs`, now A/B): **30.5% of samples reverse, in two
  contiguous runs of 378 and 318 logical px**, against 0% after. The gross rate
  was never the problem and is why this survived — 111 pose changes before, 110
  after, against 113 physically correct quarter turns. Driven off `e.distance`,
  the sim's own odometer and the same one the walk cycle already uses: monotonic,
  so it cannot reverse, and in simulated time, so it still freezes on pause.
  `r * 1.6` is kept — a real barrel covers `πr/2 ≈ 1.571r` per quarter turn, so
  the constant was always within 2% and only ever looked wrong because it was
  being fed the wrong odometer.

  **Verification.** `tsc -b --force` and `npm run build` clean; no `process` /
  `Buffer` / `__dirname` under `src/`. **Rendering is still not simulation:**
  nothing in `balance/`'s import closure reaches `renderer.ts` or
  `BattleCanvas.tsx`, and the claim is measured, not argued — `balance/REPORT.md`
  is md5 **`6758d8ec54f1d9070d3944402243f991`** with this pass's changes and
  byte-identical with both files reverted, `npm run balance` all-pass both times.
  `rv-determinism2` **29 PASS / 0 FAIL**. `rotate-pause` both PASS. `dm-reach` 0
  failures, `dm-audit` 0 across the matrix, `ws9-audit` 0, `ws9-firstrun` 7 taps
  with no dead taps, all eleven `fw2-*` exit 0. Preserved and re-measured: the
  1.000 invariant (**53,482 field blits at 390x844 dpr 2 — 0 non-integer, 0
  non-axis-aligned, 0 scaled, smoothing off on 53,482/53,482**), palisade
  monotonicity (`monotone non-increasing: true`), the conditional
  `image-rendering` (pixelated/auto tracked correctly across a live
  resize/rotate/rotate-back cycle and at the ratio-1.000 boundary), the 2.2 Hz
  DoT throttle (`DOT_GAP 0.45s`, 783–5,123 pulses suppressed per scenario), and
  knockback: `recoilMax` reads **2.666 in 14 of 18 scenario-runs and 2.671 in
  4**, which is the same full-strength `RECOIL_PX = 3.4` sampled one decay frame
  later (`3.4 × (1 − 13·dt)` is 2.663 at dt 16.8 ms and 2.671 at 16.6 ms) — the
  frame delta of the sampling frame, not a change in the ceiling. Frame budget
  held: **p50 16.7 / p95 16.7–16.8 / p99 16.8 / max 16.8 ms at 320x568, dpr 1 and
  3, 1x / 2x / 3x, with 21–45 live enemies and 0 frames over 33 ms.** Raw data in
  `scratchpad/rv4-differ.mts` + `c1-rv4-differ.txt`, `rv4-mark.mjs`,
  `rv-small.mjs`, `dz-rolldir.mjs`, and the `c1-*.txt` captures beside them.

  **Handoff.** The reviewer's original `rv3-differ.mts` is left in place as the
  record of the defect; `rv4-differ.mts` supersedes it and grades both predicates
  at once, so re-running it after any burn, thorns or trap retune re-proves the
  interaction rather than re-arguing it.

- **2026-08-21 — the polarity channel, the curse mark, and a second copy of the
  offer card.** A close-out review of the icon layer found three defects. All
  three are the same failure wearing different clothes: something the code
  already KNEW was not reaching the pixels a player looks at.

  **M3 — polarity covered 2 of 10 sign-carrying concepts.** `POLARITY` in
  `channels.ts` held `{ haste: 'slow', damage: 'weaken' }` under a comment
  claiming everything absent was "a fact without a direction (`splash radius`,
  `range`, `HP`, `pierces`)". Three of those four are written WITH a sign by the
  very function that emits them — `describeMods` writes
  `${m.splashAdd >= 0 ? '+' : ''}${m.splashAdd} splash radius` — so
  `−70 splash radius` shipped wearing the picture for `+34 splash radius`. That
  line is `cx_wild`, whose own source comment says the curse "zeroes a
  Stormcaller's 83px blast", and it renders standalone on the hero panel the
  moment anyone equips the item. `−15% HP`, `−14% range`, `−22% range`,
  `−15% projectile speed` and `never crits` had the same problem.

  Counted off the producers rather than guessed, **ten** concepts carry a sign.
  Five of the eight that were missing have shipping content behind them today
  (`rangeMult`, `projSpeedMult`, `hpMult`, `critChanceAdd`, `splashAdd` all go
  negative in `src/game/data/`); `thornsMult`, `critMultAdd` and
  `buffAura.damageMult` do not yet, and are drawn anyway because they are the
  same KIND of fact off the same three functions, and a cell costs ~50 bytes of
  PNG against a picture that argues for the wrong purchase the first time
  somebody types a number below 1. Seven cells appended — `frail`, `shorten`,
  `drag`, `shrink`, `nocrit`, `blunt`, `auraWeaken` — taking the atlas from 71
  to **78 cells, 8x9 to 8x10**. Two absentees are deliberate and argued for at
  `POLARITY` itself: `armour`, because `−22% melee damage taken while blocking`
  is written with a minus and is a *bonus*, and `sacrifice`, because
  `starts at 30% less HP for +30% damage` is a cost and a benefit in one
  sentence.

  Two mechanical changes went with it. `never crits` has no number in front of
  it, so it can never reach a mirror through `POLARITY` and takes a rule of its
  own, listed before the crit rule because both match at index 0 and a tie at a
  position goes to whichever rule is written first. And `negativeBefore` became
  `signOf`: the backwards walk is right for nine of the ten, because
  `describeMods` writes them as sign-number-noun — but the tenth is
  `buffs allies −20% dmg`, where the phrase LEADS and its number sits after it,
  so a backwards-only reader finds nothing before index 0 and hands back the
  positive cell for a debuff. The forward scan is a fallback reached only when
  the backwards walk found no sign at all, and it is bounded by the next comma
  and requires a sign *immediately followed by a digit*. Both bounds are
  load-bearing: unbounded, `+34 splash radius, −18% damage` would lend the
  second clause's minus to the first clause's phrase; without the digit test,
  the brand-new `thorns set every blocked enemy alight` (a boolean line the
  concurrent balance pass added mid-pass) would have gone hunting for a sign in
  its own prose. It classifies to plain `thorns`, verified.

  **M4 — the curse mark reached 1 of its 4 render sites.** `DetailBand`'s item
  panel built `${e.label} — ${describeEnchant(e)}` itself and knew to stamp
  `curse` on a `cx_` enchantment. `offers.ts`'s `itemBody` rebuilt the identical
  strings for the merchant board, the Forge and the reward card and dropped it —
  so on the screen `offers.ts` itself calls the one that "has to be answerable
  before you read a word", all four curses advertised with a plain upside icon:
  `damage` on Reckless, `haste` on Frenzied, `crit` on Wild, `damage` on
  Vengeful. The fix is not a second override at a second render site. `itemBody`
  is now the ONE producer for all four surfaces — `DetailBand` renders it rather
  than rebuilding it — and what it knows travels with the line as a `BodyLine`
  `{ text, mark?, tone? }`. There is no builder left to fall behind.

  The mark also stopped being the only channel. The line reads
  `Curse · Reckless — +85% damage, −45% attack speed` now; before, the sole
  statement that Reckless is a curse was a 16px sprite, which breaks the rule
  this whole layer is built on and the rule that makes every `<Icon>` safe to be
  `aria-hidden`. A player whose atlas failed to load could read `+85% damage`
  and buy it. `Curse ·` is the vocabulary the shrine offers already use, and it
  costs one word.

  **Minor — `OfferCard` was a second, divergent copy of the offer card.**
  `SelectorBand` branched on `ctx.selector` and the else-half rendered an
  `OfferCard` with its own `aria-label` and its own mark rendering, beside the
  one in `Page.tsx` that the app actually draws. Two copies of the same card is
  how a fix lands on one of them — which is exactly what M4 was. Proven
  unreachable twice rather than read off the source, because line numbers have
  drifted under this project repeatedly. **Statically:** 11 context literals in
  `useShellContext`, 2 of them `layout: 'bands'`, **0** of those non-`party`;
  `RootShell` early-returns for `page` and `<SelectorBand>` sits after that
  return. **Live:** driven through all 11 reachable screen states, `.sh-offer`
  rendered **0** times anywhere in the document, while `.sh-selector` held 4
  `.sh-hero` cards in each of the 3 states that produced it at all. The branch
  and the duplicate are gone; the invariant they rested on is now asserted in
  `useShellContext`, at the two returns that could falsify it, rather than at
  the render site that would silently draw an empty row.

  **The art was judged at 16px, and four of the seven cells did not survive it.**
  Rendered through the real `.fw-i` path at the size it ships at, `shrink` kept
  `splash`'s dashed containing ring and read as the same orange ring twice;
  `shorten`'s four corner wedges were a small grey X, which is `trap`; `blunt`
  was a plain steel disc, which is `settings`; `drag` was a faint diagonal
  streak. All four were redrawn. The worst was `frail`: the first version was
  `hp`'s heart with a 2px crack, and `sacrifice` — eight cells earlier, shipping
  since P3 — is a red heart with a 2px crack. Measured at 98% silhouette
  agreement, on two lines that appear on the same panel. It drains instead of
  breaking, `d` for the empty part and `R` for what is left, which gives the
  pair a channel that survives greyscale (luminance 99 against 146, on a panel
  at 36) rather than one that is only hue.

  **Collisions, measured off the shipped PNG.** Three states per pixel (empty /
  outline / ink), because half the sheet draws its detail as negative space that
  the auto-outline then fills, and a two-state metric reported `hp / sacrifice`
  as a 100% match — backwards, since the crack is the most legible thing about
  that cell. Under `shape >= 92% AND mean-colour distance < 40 AND luminance gap
  < 25`: **2 collisions in 78 cells, both pre-existing and neither involving a
  new cell** — `block / shield` (shape 100%, dcol 9, dlum 4) and
  `hp / sacrifice` (94.1%, dcol 1, dlum 0). Both are flagged for a later pass
  rather than redrawn here; `sacrifice` is verified art outside this brief's
  three defects. All nine polarity pairs are distinct: haste/slow 59.4%,
  damage/weaken 68.4%, hp/frail 100%/dcol 98, range/shorten 47.7%,
  projectile/drag 57.0%, splash/shrink 50.4%, crit/nocrit 84.0%,
  thorns/blunt 69.1%, auraBuff/auraWeaken 87.5%.

  **Verification.** *Polarity, exhaustively:* **156,466 lines swept** from the
  real producers — every archetype-tree node, every mutation, every upgrade
  level, 4,000 shrine rolls, 4,000 reward deals and **20,000 generated items**
  through the real generator — **2,019 distinct**, of which **1,900 are
  CLASSIFIED** (the corpus the four opt-in render sites actually hand to
  `effectIcon`) and **1,655 of those carry a sign**. Cells carrying BOTH signs
  in the classified corpus: **0**, down from 8. (The distinct counts drift by a
  few dozen run to run because the concurrent balance pass is still editing
  `src/game/data/`; the zero does not.) The 119 authored-prose lines are
  swept too and still show 3 mixed cells (`null`, `patience`, `hp`) — which is
  the measured case FOR the opt-in, not against it: a reward `downside` renders
  as `offer.warn` under the `warn` icon, a shrine `boon`/`curse` has no
  `bodyIcons`, and all 1,643 item reward cards carry an empty `desc`. Every
  `EffectMods` field swept at both signs: **10 signed fields, 10 flip**;
  `physDefAdd` and `selfSacrifice` correctly do not; 12 signless fields
  unchanged. *M4:* **16/16** — 4 surfaces (item panel, merchant, Forge, reward
  card) x 4 curses, each checked in the real DOM for `data-icon="curse"` AND the
  word "Curse", at 390x844 and 320x568. *The guard:* `fw-icons:check` green at
  78 keys / 8x10, and its negative test still fails the build three ways —
  `--fw-i-rows: 9` ("global.css --fw-i-rows is 9, atlas is 10"), `ICON_ROWS = 9`,
  and one key dropped from `ICON_ORDER` ("ICON_ORDER disagrees with the atlas").
  Cold load: **0 page errors, 0 console warnings**, atlas 200, and `.fw-i`
  computing `background-size: 128px 160px` against a 128x160 sheet. *Gates:*
  `tsc -b --force` and `npm run build` clean; nothing under `src/` references
  `process` / `Buffer` / `__dirname`. `ws9-audit` **0 failures**,
  `ws9-firstrun` **7 taps / 0 dead**, `ws9-fit` **0** across the matrix at both
  scales, `dm-reach` **0**, `dm-audit` **0 across 10 device/scale cells**,
  `rev-misc` / `rev-trap` / `rev-shift` / `r2-confirm` / `x-confirm3` all
  unchanged, all eleven `fw2-*` exit 0 (`fw2-cross-fit` went from a crash to a
  pass). No `width:1px; overflow:hidden` was introduced. Raw data in
  `scratchpad/m3-verify.mts` + `m3-verify.txt`, `m3-collide.mts`,
  `m3-signs.mts`, `m3-pairs.mjs`, `m3-live.mjs`, `m4-curse.mjs`,
  `m5-offercard.mjs`, `m3-console.mjs`, and the shots under `scratchpad/shots/`
  (`m3/`, `m4/`, `m4-320x568/`, `m3live-390x844/`, `m3live-320x568/`, `p4/`).

  **Payload.** Atlas **3,853 → 4,204 bytes (+351 B)**, 128x144 → 128x160, 71 →
  78 cells — still one file, one request, one precache entry. `index.js` 402.87
  → **404.55 kB** (gzip 134.46 → **135.48**), `index.css` 42.88 → **42.89 kB**
  (gzip unchanged at 9.14). Precache 1,405 → **1,407 KB**, still 136 files.
  **About +2.0 kB shipped for seven pictures and a channel that decides
  purchases.**

  **Not mine, and flagged rather than touched:** `npm run balance` currently
  fails one invariant — *Support "Radiant" holds Threat x8.14, not the required
  10% better than a generic mystic damage tower (x7.41)*. It passed all-invariant
  at the start of this pass and nothing in this pass can reach it: the import
  closure of `balance/report.ts` is `src/game/{core,data,engine}`,
  `src/game/types`, `src/state/{gameStore,metaStore}` and `balance/` — no
  `src/ui`, no `src/styles`, no `scripts/`. The concurrent balance pass changed
  `archetypeTree.ts`'s `radiant` node (`healAura` now `hps: 38, radius: 160`)
  and added `thornsIgnite`; the failure is theirs to close.
