# Fieldwatch — design system & token inventory

Companion to `docs/BRAND.md` (which describes the *intent*). This document is
the **audit of what actually exists in the code**, the gaps between the two, and
the full token set a real design system needs.

Screenshots of every state this describes: `docs/ui-audit/` (see
`docs/ui-audit/INDEX.md`). Regenerate with `node scripts/ui-audit.mjs`.

Audited against `src/styles/global.css` (28 tokens) and `src/styles/app.css`
(3,877 lines).

---

## 1. Scorecard

| Layer | Status | Notes |
|---|---|---|
| Colour — core palette | 🟢 Tokenized | 28 tokens in `:root` |
| Colour — rarity | 🔴 Duplicated | Defined in **both** `items.ts` and `app.css` |
| Colour — archetype | 🟡 Partial | Base hues tokenized; `accent` variants only in TS |
| Spacing | 🔴 Missing | No tokens; 14 distinct px values in use |
| Typography | 🔴 Missing | No tokens; 17 distinct font sizes in use |
| Radius | 🟡 Partial | 2 tokens exist, 10 distinct values used |
| Elevation / shadow | 🔴 Missing | 27 `box-shadow` decls, all ad-hoc |
| Motion | 🔴 Missing | 7 distinct durations, all inline |
| Z-index | 🔴 Missing | 6 raw values (1, 2, 20, 38, 39, 40) |
| Focus states | 🔴 Weak | Only 2 `:focus-visible` rules in 3,877 lines |
| Surface primitives | 🔴 Documented but absent | `.ts-*` classes in BRAND.md **do not exist** |

**Headline:** colour is in good shape; **every other dimension of the system is
undeclared.** 66 hardcoded hex values (32 distinct) and 63 raw `rgba()` calls
live in `app.css`.

---

## 2. Tokens that exist today

All in `src/styles/global.css :root`.

### Grounds & surfaces
| Token | Value | Use |
|---|---|---|
| `--bg` | `#201711` | Page ground |
| `--bg-2` | `#2a1f16` | Secondary ground |
| `--panel` | `#2f2418` | Dense HUD/data panel |
| `--panel-2` | `#3a2c1c` | Raised panel, secondary button fill |
| `--panel-3` | `#46331f` | Highest panel, disabled fill |
| `--line` | `rgba(233,205,150,.12)` | Hairline |
| `--line-strong` | `rgba(233,205,150,.22)` | Emphasised border |

### Parchment / wood inks
| Token | Value | Use |
|---|---|---|
| `--paper` | `#ece0c8` | Parchment surface |
| `--ink` | `#4a3a1e` | Text on parchment |
| `--ink-dim` | `#6a5738` | Muted text on parchment |
| `--wood` | `#6b4526` | Wood frame |

### Text
| Token | Value | Contrast on `--panel` |
|---|---|---|
| `--text` | `#f3e7d0` | 12.37 ✅ AA |
| `--muted` | `#b89e7e` | 5.94 ✅ AA |
| `--muted-2` | `#8a7458` | 3.40 ⚠️ large/UI only |

### Accent & semantic
| Token | Value | Contrast on `--panel` |
|---|---|---|
| `--accent` | `#e0ac4c` | 7.34 ✅ |
| `--accent-dim` | `rgba(224,172,76,.16)` | fill only |
| `--teal` | `#57a2b6` | 5.23 ✅ |
| `--teal-dim` | `rgba(87,162,182,.18)` | fill only |
| `--good` | `#6fce88` | 7.83 ✅ |
| `--warn` | `#e0b23a` | 7.64 ✅ |
| `--bad` | `#d0563a` | 3.66 ⚠️ **fails AA for body text** |
| `--info` | `#6fb0d8` | 6.40 ✅ |

### Archetype
`--fighter` `#d9743f` · `--rogue` `#4fae72` · `--mystic` `#5b8cd6`

### Shape & type
`--radius` `10px` · `--radius-sm` `6px` · `--font-display` `'Crimson Text', Georgia, 'Times New Roman', serif`

`--font-display` resolves to the **self-hosted** Crimson Text faces (weights 600
and 700) declared with `@font-face` at the top of `src/styles/global.css`. There
is no `--font-body` token — `body` sets `system-ui, -apple-system, 'Segoe UI',
Roboto, sans-serif` inline.

---

## 3. Findings — things to fix

### 3.1 🔴 Rarity colours are defined twice
The same five colours live in **two** places and can drift silently:

`src/game/data/items.ts`
```ts
common: '#c3b291'  rare: '#5fb0c4'  epic: '#c67ab0'  legendary: '#f0b868'  mythic: '#ef6a3a'
```
`src/styles/app.css` (`.rar-*` — plus *border* variants that exist nowhere else)
```css
.rar-rare      { border-color: #3f7d8c } .rar-rare .es-name      { color: #5fb0c4 }
.rar-epic      { border-color: #9c4d84 } .rar-epic .es-name      { color: #c67ab0 }
.rar-legendary { border-color: #d08a3a } .rar-legendary .es-name { color: #f0b868 }
.rar-mythic    { border-color: #c24a2a } .rar-mythic .es-name    { color: #ef6a3a }
```
The text colours currently agree — but nothing enforces that. **Fix:** declare
`--rarity-*` and `--rarity-*-border` in `:root`, have `app.css` use the tokens,
and have `items.ts` read them (or generate the CSS from the TS table).

### 3.2 🔴 `.ts-paper` / `.ts-special` / `.ts-wood` / `.ts-btn` don't exist
`BRAND.md` §"Surfaces & framing" presents these as "Reusable classes (in
`app.css`)". They are **not implemented anywhere in `src/`**.

The nine-slice PNGs *do* exist (`public/assets/ui/tinyswords/*_9.png`) and are
used — but hardwired to five specific component selectors:

| Nine-slice | Bound to |
|---|---|
| `paper_regular_9.png` | `.hp-card` |
| `btn_big_blue_9.png` | `.hp-cta`, `.overlay-btn` |
| `paper_special_9.png` | `.overlay-card` |
| `woodtable_9.png` | `.crossroads .cr-col` |

So the branded surfaces can't be reused on a new component without copying a
`border-image` line. **Fix:** promote these four to real utility classes, then
have the component selectors compose them.

### 3.3 🔴 No spacing scale
BRAND.md specifies **8 / 12 / 16 / 24 / 32**. Actual usage in `app.css`:

| px | 10 | 8 | 6 | 12 | 14 | 4 | 3 | 16 | 9 | 7 | 2 | 20 | 18 | 5 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| count | 55 | 40 | 28 | 28 | 16 | 12 | 12 | 11 | 9 | 8 | 7 | 5 | 4 | 3 |

The most-used value (`10px`) isn't even on the documented scale, and 3/7/9/18px
are one-offs. **Fix:** adopt a 4px-base scale and migrate.

### 3.4 🔴 No type scale
BRAND.md specifies **30 / 22 / 17 / 15 / 13 / 11.5**. Actual: **17 distinct
sizes** — 12px (50×), 13px (29×), 11px (26×), 10px (20×), 15px (18×), 14px
(18×), 9px (10×), 16px (9×), 18px (7×), 20px (5×), 22px (3×), 17px (3×), 30px
(2×), **12.5px (2×)**, 8px, 28px, 26px.

`8px` and `9px` body text is below the practical floor on mobile.

### 3.5 🔴 Focus states are nearly absent
Only **2** `:focus-visible` rules exist. BRAND.md promises "visible 2px gold
outline, 2px offset (keyboard reachable)" on every interactive element. With
~100+ buttons, keyboard navigation is effectively invisible.

### 3.6 ⚠️ Two contrast failures
Measured (WCAG 2.1):

| Pair | Ratio | Verdict |
|---|---|---|
| `--muted-2` on `--panel-3` | **2.69** | ❌ fails even 3:1 |
| `--bad` on `--panel-3` | **2.89** | ❌ fails even 3:1 |
| `--bad` on `--panel` | 3.66 | ⚠️ under 4.5 — not safe for body text |
| `--muted-2` on `--panel` | 3.40 | ⚠️ under 4.5 |

`--bad` carries danger/error meaning, which is the worst place for low contrast.
High-contrast mode fixes this (`--bad` → `#ff6f52`), but the default shouldn't
need it.

### 3.7 ⚠️ Z-index is unlayered
Raw values `1, 2, 20, 38, 39, 40`. The 38/39/40 cluster is the modal stack, and
its ordering is implicit. **Fix:** name the layers.

---

## 4. Proposed token set

What a complete system needs. **Bold** = new.

```css
:root {
  /* ---------- colour: grounds & surfaces (exists) ---------- */
  --bg: #201711;  --bg-2: #2a1f16;
  --panel: #2f2418;  --panel-2: #3a2c1c;  --panel-3: #46331f;
  --line: rgba(233,205,150,.12);  --line-strong: rgba(233,205,150,.22);
  --paper: #ece0c8;  --ink: #4a3a1e;  --ink-dim: #6a5738;  --wood: #6b4526;

  /* ---------- colour: text (exists) ---------- */
  --text: #f3e7d0;  --muted: #b89e7e;  --muted-2: #8a7458;

  /* ---------- colour: accent & semantic (exists) ---------- */
  --accent: #e0ac4c;  --accent-dim: rgba(224,172,76,.16);
  --teal: #57a2b6;    --teal-dim: rgba(87,162,182,.18);
  --good: #6fce88;  --warn: #e0b23a;  --bad: #d0563a;  --info: #6fb0d8;
  /** NEW — accessible danger for body-size text */
  --bad-text: #e87358;

  /* ---------- colour: archetype ---------- */
  --fighter: #d9743f;  --rogue: #4fae72;  --mystic: #5b8cd6;
  /** NEW — the accent halves already in archetypeTree.ts */
  --fighter-accent: #f0a868;  --rogue-accent: #88e0a8;  --mystic-accent: #9ec1f0;

  /** NEW — colour: rarity (single source of truth) */
  --rarity-common: #c3b291;     --rarity-common-border: rgba(233,205,150,.22);
  --rarity-rare: #5fb0c4;       --rarity-rare-border: #3f7d8c;
  --rarity-epic: #c67ab0;       --rarity-epic-border: #9c4d84;
  --rarity-legendary: #f0b868;  --rarity-legendary-border: #d08a3a;
  --rarity-mythic: #ef6a3a;     --rarity-mythic-border: #c24a2a;
  --curse: #d0563a;   /* the ◆ curse marker */

  /** NEW — spacing (4px base) */
  --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px;  --sp-4: 16px;
  --sp-5: 24px; --sp-6: 32px; --sp-7: 48px;
  --sp-px: 2px; /* hairline nudges only */

  /** NEW — typography */
  --font-body: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  /* Ships today (self-hosted, weights 600 + 700 — see docs/BRAND.md § Type). */
  --font-display: 'Crimson Text', Georgia, 'Times New Roman', serif;
  --fs-display: 30px;  --fs-h1: 22px;  --fs-h2: 17px;
  --fs-body: 15px;     --fs-sm: 13px;  --fs-xs: 11px;  --fs-micro: 10px;
  --lh-tight: 1.15;  --lh-body: 1.45;
  --fw-regular: 400; --fw-medium: 600; --fw-bold: 700; --fw-heavy: 800;
  --tracking-label: .12em;  /* uppercase eyebrows */

  /* ---------- radius (partly exists) ---------- */
  --radius-sm: 6px;  --radius: 10px;
  /** NEW */
  --radius-lg: 16px;  --radius-pill: 999px;

  /** NEW — elevation */
  --shadow-1: 0 1px 2px rgba(0,0,0,.30);
  --shadow-2: 0 4px 12px rgba(0,0,0,.35);
  --shadow-3: 0 12px 32px rgba(0,0,0,.45);
  --shadow-inset: inset 0 1px 0 rgba(255,240,214,.06);

  /** NEW — motion */
  --dur-fast: 80ms;  --dur: 120ms;  --dur-slow: 220ms;
  --ease: cubic-bezier(.2,.7,.3,1);

  /** NEW — z-index layers */
  --z-base: 1;  --z-raised: 2;  --z-sticky: 20;
  --z-scrim: 38;  --z-modal: 39;  --z-toast: 40;

  /** NEW — focus */
  --focus-ring: 2px solid var(--accent);
  --focus-offset: 2px;

  /** NEW — touch */
  --hit-min: 44px;
}
```

---

## 5. Branding checklist for a new component

1. **Ground** — warm `--bg`; never blue-grey, never pure black.
2. **Surface** — `--panel*` for dense data; a nine-slice utility for
   menu/overlay/choice moments.
3. **Text** — `--text` primary, `--muted` secondary. Never pure white.
   Uppercase eyebrow labels at `--fs-xs` / `--tracking-label` / `--muted`.
4. **Numbers** — `font-variant-numeric: tabular-nums` in any column.
5. **One primary action** per view, teal. Everything else secondary or ghost.
6. **Currency** — `⟡` gold, `◈` dust, `✦` watch marks, all in `--accent`.
7. **State needs form + colour** — rarity gets a border *and* a tag; danger gets
   an icon *and* red. Colour alone never carries meaning.
8. **Hit targets ≥ 44px** on coarse pointers, in at least one axis.
9. **Focus** — visible gold ring on every interactive element.
10. **Motion** — 80–120ms on transform/filter/border; must vanish under
    `--reduced-motion`.

---

## 6. Iconography & glyph vocabulary

Currently Unicode glyphs, not an icon set — cheap and CSP-safe, but
inconsistent in weight.

| Glyph | Meaning | | Glyph | Meaning |
|---|---|---|---|---|
| `⟡` | Gold | | `⚔` | Fighter |
| `◈` | Dust | | `✦` | Rogue / Watch Marks |
| `⬡` | Base integrity | | `❋` | Mystic |
| `⚡` | Threat multiplier | | `★` | Evolution ready |
| `❖` | Shrine | | `◆` | Cursed item |
| `⚙` | Equipment | | `ⓘ` | Details |
| `🎒` | Inventory | | `▶` | Start wave |

⚠️ `✦` is overloaded — it means both **Rogue archetype** and **Watch Marks**.
🎒 is the only full-colour emoji in an otherwise monochrome set.

---

## 7. Breakpoints

| Name | Query | Behaviour |
|---|---|---|
| Mobile | `< 900px` | HUD collapses to tabs (Squad/Tactics/Wave), one panel at a time |
| Desktop | `≥ 900px` | All HUD panels stacked in the side rail; tab bar hidden |
| Coarse pointer | `(pointer: coarse)` | `min-height: 44px` on all controls |
| Reduced motion | `:root[data-reduced-motion='true']` | Animations disabled |
| High contrast | `:root[data-contrast='high']` | Brighter text, stronger borders |
