# Merchant Mercenaries (formerly Fieldwatch) — brand & UI guide

> **Renamed 2026-10-06.** The game is now **Merchant Mercenaries**. The wordmark,
> lockups, social card (line: "Sellswords for hire"), page meta and app names are
> updated; the home-screen label is **"Mercenaries"**. The mark below — the
> Watchtower — was drawn for Fieldwatch and is kept for now; a mark for the new
> name is open work. Where this guide says Fieldwatch, read Merchant Mercenaries.
> Details: `CLAUDE.md` § Name.

A **warm, storybook, medieval tower-defense**. The UI is tactile parchment and
wood framing lush pixel battlefields — cozy, but with stakes. Everything reads
like it belongs on the same wooden table as the Tiny Swords art.

The rule of thumb: **no cool blue-grey chrome**. Grounds are warm dark wood;
panels are parchment, wood, or warm-dark slate; the one bright interactive
colour is the Tiny Swords **teal**, with **gold** for value/emphasis.

## Identity — the mark, the wordmark, the key art

Review sheet: `docs/brand/identity-sheet.png`. Every file below is generated
or hand-written in this repo: no web-fetched images, no model-generated
images. The one outside input is the Crimson Text face, already shipped under
the SIL OFL 1.1 (see `public/licenses/THIRD_PARTY_NOTICES.md`).

### The idea

**The Watchtower on the meadow rim, against a dusk sun, its lamp lit.** The
field is the horizon, the watch is the tower, and the lit window says someone
is on watch. The Watchtower is also the player's home screen, so the mark
names a place in the game rather than inventing a symbol. There is no hidden
second reading: it is a tower at sunset, and it should look like one at a glance.

Routes tried and dropped: a tower standing on a mound (read as a chess rook,
and shrank to a speck in a square icon); a deck-and-eaves watchtower (a cross
at 16px); a shield-and-lantern monogram (the shield is the genre's default,
and the old placeholder icon was exactly that).

### Construction (`src/assets/brand/mark.svg`, 48-unit grid)

| Part | Geometry | Why |
|---|---|---|
| Disc | circle c(24,24) r22 | The sun. It is the container, so the mark is square and survives any crop. |
| Horizon | quadratic (0,39.5) → ctrl (24,30.6) → (48,39.5), crest y35.05 | A mound, not a flat line: the tower stands on a rise, and the disc reads as setting. |
| Tower | axis x23.5, body 8.4 → 10.4 wide, eaves 13.2 at y20, apex y10.2 | Stocky enough to hold at 32px. The eaves overhang 2.4 each side, enough to read as a roof but not so much that it turns into a pine. |
| Pole + pennant | pole 1.3 wide to y5; swallowtail y5 → 8.8, tip x31.9 | Life and wind; it is also the asymmetry that stops the silhouette looking like a chess piece. |
| Window | arched, 3 × 5.6 | The lamp. In one colour it becomes an island of ink inside the tower. |

Optical corrections: the tower axis sits 0.5 left of centre to balance the
pennant's mass on the right; the pennant is kept 2.7 units inside the disc so
no gold sliver thins to a hairline; the icons nudge the disc 1% below centre
because its visible mass is the top 80%.

The gold is one compound path (disc minus tower minus hill), so the mark is a
single-ink shape by construction; the full-colour version only adds the cream
lamp and the teal pennant on top.

### The pixel mark (`PIXEL_MARK` in `scripts/brand.ts`, 16×16)

Below about 40px the vector's pole, pennant and window fall between pixels. The
reduction is **drawn on the grid**, not scaled: it keeps the three things that
carry the idea (disc, tower, horizon), thickens the tower from 18% to 36% of
the disc, and uses the icon atlas's convention: interior art inside rows and
columns 1–14, ringed by `outline()` in the Tiny Swords `#161C2E`. So it sits
beside `fw-icons.png` as one family. Display it at 16 or 32 CSS px only
(integer multiples), with `image-rendering: pixelated`.

### Colour ways

| Use | Mark | Wordmark |
|---|---|---|
| **On dark wood** (default: app, menu, social) | Full colour: gold `--accent` disc, cream `#fff1c8` lamp, teal `--teal` pennant | Cream `--text` |
| **On parchment** | One colour, ink `--ink` (`mark-mono.svg` with `color: var(--ink)`) | Ink `--ink` |
| **One colour** (print, emboss, a stamp, a watermark) | `mark-mono.svg` in any single ink; black or white for print | Same ink |

Do not recolour the full-colour mark onto parchment: gold on `--paper` is
under 2:1. Do not add a stroke, glow or shadow to the mark. The silhouette is
transparent, so the tower and the hill are always the ground the mark sits on.
The app icons fill them with a deeper wood (`#170f0a`) so the disc reads as a
whole circle on a launcher.

### The wordmark and the lockups

`wordmark.svg` is **Crimson Text Bold outlined**, not live text, by
`scripts/brand-wordmark.py` (fontTools). Outlines, because the lockup must render
identically where our `@font-face` cannot load: sharp/librsvg rasterising the
social card, email, store listings, a press kit. It is spaced by eye (tracking
−8/1000, plus four pair adjustments), because the font's own kerning is tuned
for 17px running text. In the UI, headings stay live Crimson Text: the menu's
`<h1>` is text a screen reader and a translator can use.

- `lockup.svg` (**primary, horizontal**): the wordmark's **baseline sits on the
  mark's horizon crest** and its cap height is 20 units (≈45% of the disc), so
  the word stands on the same ground as the tower. Gap: 10 units from the disc.
- `lockup-stacked.svg`: for square or tall spaces (a splash, a store tile).
  Mark centred over the word, cap height 16.
- Mark alone: avatars, favicons, app icons, anywhere the name is already said.

### Clear space and minimum size

- **Clear space:** half the disc's radius (11 units on the 48 grid, i.e. 23% of
  the mark's height) on every side, for the mark and for both lockups. Nothing
  (type, frame edge, other logos) enters it.
- **Minimum size:** the vector mark at **40px**. Below that, use the pixel mark
  at 16 or 32px, never a scaled vector. The horizontal lockup at **120px wide**
  (the wordmark's counters close below that); smaller than that, use the mark alone.

### Files and where they are used

| File | Use |
|---|---|
| `src/assets/brand/mark.svg`, `mark-mono.svg` | Source vector, full colour and one colour |
| `src/assets/brand/wordmark.svg`, `tagline.svg` | Outlined type (generated, do not hand-edit) |
| `src/assets/brand/lockup.svg`, `lockup-stacked.svg` | Lockups (generated) |
| `src/assets/brand/mark-16.png` | Pixel mark, 1× |
| `public/icons/favicon.svg`, `favicon-32.png` | Tab icon: the pixel mark as crisp SVG rects, and 2× PNG |
| `public/icons/apple-touch-icon.png` (180, opaque), `icon-192/512.png` (squircle), `icon-*-maskable.png` (disc within the 80% safe circle) | Home screen and PWA |
| `public/social/og-image.png` | 1200×630 link preview (never precached) |

Regenerate everything with `npm run brand` (`npm run icons` is an alias). The
wordmark needs `pip install fonttools brotli` and `python3
scripts/brand-wordmark.py`, but only when the spacing changes. The page's
`theme-color` and the manifest's `theme_color` / `background_color` are `--bg`
`#201711`. `og:image` becomes an absolute URL at build time from `FW_SITE_URL`
or Vercel's production URL (`build/siteMeta.ts`).

### The menu (was: key art)

The menu used to show a 488×272 dusk diorama from `scripts/brand.ts`, then a
live attract-mode battle behind the whole page (Whales UI plan H1/Q12). Since
the mercenary company's build step 4 the menu's background is the **trade
map** (`src/ui/attract/TradeMap.tsx`): your HQ town at night and the five
company roads, lit by your standing. Both the diorama and the attract battle
were retired; `scripts/brand.ts` still composes the same dusk scene for the
social card.

## Colour

Tokens live in `src/styles/global.css` (`:root`) and the `tinyswords` theme in
`src/game/render/themes.ts`.

**Grounds** (page backgrounds — warm, dark, never black-blue)
- `--bg` `#201711` · `--bg-2` `#2a1f16`

**Surfaces**
- Warm-dark panel (HUD, dense data): `--panel` `#2f2418`, `--panel-2` `#3a2c1c`, `--panel-3` `#46331f`
- Parchment (menus, cards): `--paper` `#ece0c8`, ink `--ink` `#4a3a1e`, ink-dim `--ink-dim` `#6a5738`
- Wood frame (headers, framed panels): `--wood` `#6b4526`
- Hairlines: `--line` `rgba(233,205,150,.12)`, `--line-strong` `rgba(233,205,150,.22)`

**Text** — warm cream, never pure white
- `--text` `#f3e7d0` · `--muted` `#b89e7e` · `--muted-2` `#8a7458`

**Accents & semantics**
- Gold (value, active, highlight): `--accent` `#e0ac4c`
- Teal (primary action — the knights' colour): `--teal` `#57a2b6`
- Good `--good` `#6fce88` · Warn `--warn` `#e0b23a` · Bad/danger (goblin red) `--bad` `#d0563a` · Info `--info` `#6fb0d8`
- Archetype hues: fighter `#d9743f`, rogue `#4fae72`, mystic `#5b8cd6`

## Type

One **self-hosted** display serif over a system stack, carried by hierarchy not
novelty. There is no third-party font request — the two woff2 faces ship from
`src/assets/fonts/` and are declared with `@font-face` in `src/styles/global.css`,
so the page still makes zero cross-origin requests and stays CSP-safe. (This
section previously read "System stack (no webfonts)", which stopped being true
when the Crimson Text faces landed.)

- **Display / headings + button labels**: `--font-display` =
  `'Crimson Text', Georgia, 'Times New Roman', serif`, weights **600 and 700** —
  the only two faces shipped, so do not ask for 400 or 800 or the browser will
  synthesise them. `font-display: swap`, tight tracking, `text-wrap: balance`.
- **Body / UI**: `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`.
- **Eyebrows / labels / data**: uppercase, `letter-spacing:.12em`, `--muted`; numeric columns use `font-variant-numeric: tabular-nums`.
- Scale: 30 / 22 / 17 / 15 / 13 / 11.5.
- Budget: 2 × ~25KB woff2. A third weight or a second family needs a reason —
  this is a mobile-first build and the fonts are the only self-hosted binary in
  the CSS path.

## Surfaces & framing (nine-slice)

Reassembled Tiny Swords nine-slices in `public/assets/ui/tinyswords/*_9.png`,
applied with `border-image`. The intended reusable classes:
- `.ts-paper` — parchment panel, **dark ink text**. Menus, choice cards, tooltips.
- `.ts-special` — dark slate w/ gold corners, **light text**. Overlays, modals.
- `.ts-wood` — wood frame, **light text**. Section framing, headers.
- `.ts-btn` — teal button. Primary actions.

> ⚠️ **Not yet implemented.** These four classes do not exist in `app.css`. The
> nine-slices are currently bound directly to specific components (`.hp-card`,
> `.hp-cta`/`.overlay-btn`, `.overlay-card`, `.crossroads .cr-col`), so the
> surface treatments can't be reused without copying a `border-image` line.
> See `docs/DESIGN_SYSTEM.md` §3.2.

Use warm-dark `--panel` (with `--line`) for dense HUD/data panels where parchment
would hurt legibility over the bright battlefield.

## Buttons

- **Primary** → `.ts-btn` (teal) — the one main action per view (Begin Run, Equip, Choose).
- **Secondary** → warm `--panel-2` fill, `--line-strong` border, `--text`.
- **Ghost/quiet** → transparent, `--muted`, hover to `--text`.
- Currency/cost shown inline with the currency's **pixel mark** (`<Money>` in
  `src/ui/shell/Money.tsx`: coin, dust crystal, Watch Mark star) and the number —
  one mark per currency, never a Unicode glyph beside it. In prose, say it in
  words: "60 gold", "12 dust", "40 Watch Marks".
- Disabled: `--panel-3` fill, `--muted-2` text, `cursor:not-allowed`.

## Layout structure (every page)

1. **Ground**: warm `--bg` + a soft top vignette; content never touches the raw edge.
2. **Header band**: page title (display) + one-line purpose (`--muted`), optionally on a wood/banner strip. Currency/status pinned top-right.
3. **Content**: a centred column (max ~1120px) of panels on a spacing scale of **8 / 12 / 16 / 24 / 32**. Cards in responsive grids with `gap`, not per-element margins.
4. **Primary action**: one teal button, bottom or bottom-right.
5. **Overlays**: dim scrim `rgba(20,12,6,.66)` + a `.ts-special` card, centred.

## Interaction

- **Hover**: lift `translateY(-2–4px)` + slight brighten; never a jarring colour swap.
- **Focus**: visible `2px` gold outline, `2px` offset (keyboard reachable).
- **Transitions**: 80–120ms ease on transform/filter/border. Respect `prefers-reduced-motion`.
- **State in form + colour**: pills/stripes for rarity, boss, danger — colour alone never carries meaning.
- Feedback is immediate and plainly worded ("Equipped", "Recruited").

## Voice & tone

Fieldwatch speaks like a **veteran sergeant writing orders on a campaign
table**: plain, warm, brief, and never wrong. The storybook lives in the art;
the words' job is to be believed.

**Rules** (Strunk & White, applied to a 390px screen)

1. **True first.** Every string that states a number or a rule is checked
   against the engine before it ships. A lovely sentence that misstates a
   mechanic is a bug. (Examples retired in Wave 1: "Take one — it applies to
   the whole watch" on item cards that go to the pack; "Marching on costs
   nothing" on a fork with no march-on; "Three offers" over five.)
2. **Omit needless words.** "Your first hero. Recruit more along the road." —
   not "This is your starting tower. You can recruit more heroes as you play
   through a run." Cut until the next cut loses meaning.
3. **Active voice, second person, present tense.** "Tap your hero, then a
   glowing circle." Not "Heroes can be deployed by…".
4. **Say the number and what it does.** "Threat ×1.42: enemies have 42% more
   HP." A multiplier with no noun is a riddle.
5. **Point at what is on screen, by its label.** Name a control by the words it
   shows ("Skills", "a + under Gear"), never by a glyph that may not render.
6. **One idea per line.** Coach tips are one sentence where possible, two at
   most. Anything longer is a help page, and the game has none.
7. **Costs before benefits are read.** A downside is its own line, in
   `--bad-text`, with the warning mark and the word "Downside".
8. **No exclamation marks, no "simply", no "just".** Calm is the brand.
9. **UK spelling.** Armour, defence, colour, sceptre, centre.
10. **Sentence case** for body text and buttons ("Start a Run" and other
    display titles keep their title case; everything else is sentence case).

**Tone by moment**

| Moment | Tone | Example |
|---|---|---|
| Teaching | a hand on the shoulder | "3 items to equip. Tap a + under Gear." |
| A cost or risk | level, exact | "At level 10, Doyle picks a path. It's permanent." |
| Destructive confirm | plain, no drama | "There is no undo." |
| Victory | quiet pride | "You reached the end of the road and broke the last stand." |
| Defeat | honest, no blame | "Your Gate fell after 4 stops. Permadeath: this run is over." |
| Receipt | two to five words | "Cloak added to your pack" · "Sable joined the company" |

## Glossary — one noun per concept

| Concept | Say | Never say |
|---|---|---|
| A unit you post on the field | **hero** | tower, Sentinel, unit, defender |
| All your heroes together | **company** | team, roster, watch, party |
| Base HP / what enemies attack | **Gate** ("Gate 20/20", "Gate HP") | base, lives, Base integrity, keep |
| Where a hero is posted | **circle** (in teaching), slot (in code only) | marked slot, tile, pad |
| The HP multiplier that climbs | **Threat** | heat, difficulty, danger |
| Map node | **stop** (prose), node (code) | room, tile |
| Endless second chances | **retries** | lives, hearts |
| The per-run difficulty ladder | **Vow** (ids/store stay `banner`/`sacrifice`) | Banner, Sacrifice, ascension |
| A hero's bought upgrade paths | **Skills** | Upgr, upgrades, tower upgrades |
| Currencies | **gold**, **dust**, **Watch Marks** | coins, crystals, marks alone in body copy |
| STR / DEX / INT | exactly these three, everywhere | PHY, MAG, strength stat |
| An elite enemy | "Bomber · Warded" (goblin first, modifier after) | "Warded Bomber", "Plated The Colossus Keg" |
| An item | "Heavy Grimoire" + its rarity beside it | "Heavy Rare Grimoire · Rare" |

"Sentinel" survives only as flavour inside proper names (Sentinel of Order).

## Banned terms

`tower` (for a hero) · `Sentinel` (as the unit noun) · `team` · `lives` ·
`Base integrity` · `Banner` (for the difficulty ladder) · `Upgr` · `PHY/MAG` ·
`bought with rate/reach` · `simply` · `just` · `!` · US spellings (`armor`,
`defense`, `color`, `scepter`) · any currency glyph (`⟡ ◈ ✦`) in shell UI.

## Apply-everywhere checklist

Hub (Watchtower) · Run map · Battle HUD (top bar, controls, roster, tactics, wave preview) ·
Endless rooms · Equip · Sentinel detail · Merchant · Shrine · Recruit · Evolution ·
Result / Run-end overlays. Each: warm ground, themed panels, teal primary button,
cream text, gold accents — reviewed against this guide with a real screenshot.

## Appendix — commission brief: key art

The menu diorama and the social card are **composed** from the Tiny Swords CC0
sprites. That is honest and on-palette, but it is still a stock asset pack
arranged well, and any other Tiny Swords game can look the same. The
recommended next step for a commercial release is original, commissioned key
art. This brief is what to hand a pixel artist.

**Deliverables** (all original work, full copyright assigned to us, layered
source files included)

| Piece | Native size (art px) | Shown at | Notes |
|---|---|---|---|
| Menu key art | 488×272 | 1 CSS px per art px, cropped to as little as 328×120 | The subject stays inside the centre 328×150; only scenery at the margins. Layers: sky, far ridge, meadow, road, actors, light. |
| Social / store card | 600×315 | exactly 2× → 1200×630 | Top ~40% kept clear (darker sky) for the lockup and one line of type. |
| Store capsule / splash | 460×215 and 616×353 | 2× | The same scene re-staged, not stretched. |
| Optional: 3–4 frame loop | the menu size | steps() at 6–8 fps | Torch flicker, pennant, grass sway only; it must also read as a still frame. |

**Subject.** A meadow at dusk. A dirt road comes out of a dark wood and winds
toward the viewer. A goblin column with torches walks it (torch, dynamite and
barrel goblins). Three heroes hold marked circles beside the road: a
fighter with sword and shield, an archer (rogue), a hooded mystic. On the far
ridge the Watchtower stands in front of the setting sun, its lamp lit and a
teal pennant flying. This is our logo and must match `mark.svg` in silhouette:
pointed roof, eaves, tapered body, arched window.

**Palette and light.** Warm wooden-table palette (this file's Colour section).
The sky runs plum-brown `#241619` to amber `#d3853f`; the sun is `--accent`
`#e0ac4c`; silhouettes are warm dark wood `#2b1a17`, never blue-black. Heroes
wear the knights' teal. Goblin red is `--bad` `#d0563a`. Low sun behind the
goblins: they carry warm rim light, and the heroes carry torchlight. **No cool
blue-grey chrome**, no pure black or white.

**Style.** Match the in-game read: 1px dark contour, low-contrast ground with
tonal patches (never one flat block), clear lane and circles, and decoration
only at the edges (`docs/DESIGN_REVIEW.md` checklist). One pixel density
across the whole piece, with no mixed-scale sprites and no anti-aliased
painterly edges. Units must stay the highest-contrast things in frame.

**Must survive.** A 120px-tall crop that keeps the tower and the front of the
column; a 1200×630 card read at 500px wide in a feed; greyscale (the tower
against the sun must still read).

**Do not.** Put the name or any lettering in the art (the page and the card set
the type). Trace or paint over the Tiny Swords sprites (the new art replaces
them). Use AI-generated imagery. Use any reference asset you do not own.

**Hand-off.** PNG at native size, plus the layered source (Aseprite or PSD).
Supply the light-source coordinates (lamp, torches) so `keyart.ts` can be
written by hand once `scripts/brand.ts` stops generating the diorama.
