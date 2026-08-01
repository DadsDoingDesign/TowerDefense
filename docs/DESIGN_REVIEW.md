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
