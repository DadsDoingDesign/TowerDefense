# Fieldwatch — brand & UI guide

A **warm, storybook, medieval tower-defense**. The UI is tactile parchment and
wood framing lush pixel battlefields — cozy, but with stakes. Everything reads
like it belongs on the same wooden table as the Tiny Swords art.

The rule of thumb: **no cool blue-grey chrome**. Grounds are warm dark wood;
panels are parchment, wood, or warm-dark slate; the one bright interactive
colour is the Tiny Swords **teal**, with **gold** for value/emphasis.

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

System stack (no webfonts — CSP-safe), carried by hierarchy not novelty.
- **Display / headings**: `'Trebuchet MS', system-ui, sans-serif`, weight 700–800, tight tracking, `text-wrap: balance`.
- **Body / UI**: `system-ui, sans-serif`.
- **Eyebrows / labels / data**: uppercase, `letter-spacing:.12em`, `--muted`; numeric columns use `font-variant-numeric: tabular-nums`.
- Scale: 30 / 22 / 17 / 15 / 13 / 11.5.

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
- Currency/cost shown inline with the gold coin glyph `⟡` in `--accent`.
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

## Apply-everywhere checklist

Hub (Watchtower) · Run map · Battle HUD (top bar, controls, roster, tactics, wave preview) ·
Endless rooms · Equip · Sentinel detail · Merchant · Shrine · Recruit · Evolution ·
Result / Run-end overlays. Each: warm ground, themed panels, teal primary button,
cream text, gold accents — reviewed against this guide with a real screenshot.
