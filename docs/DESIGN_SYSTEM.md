# Fieldwatch — design system & token inventory

Companion to `docs/BRAND.md` (which describes the *intent*). This document is
the **audit of what actually exists in the code**, the gaps between the two, and
the full token set a real design system needs.

Screenshots of every state this describes are generated, not committed:
`node scripts/ui-audit.mjs` writes them to `docs/ui-audit/` (git-ignored). The
2026-07-26 set was removed from the repository because it depicted sprite files
that were not licence-clean.

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

## 8. Usage rules — how the parts are meant to be used

Sections 1–7 say what the parts **are**; this section says what each one is
**for** and how it is meant to be used. **Everything has a job.** These rules
are the contract every screen keeps.

**Breaking a rule takes a strong, stated need and the designer's approval.**
Write the need in the PR, get approval, and record the break in the
exceptions table below with its date and reason. A design review that finds
an unrecorded break fixes the screen; it does not add the break to the
table after the fact. Changing a rule follows the same path: propose it,
agree it, then edit this section.

0. **Everything has a job.** Every element on a screen can name its one job,
   and the table below gives each shared part's job. An element that cannot
   name one goes. Two elements doing the same job on one screen are one too
   many. A part is used only for its job: a CTA never navigates back, and a
   tip never stands in for an error. The rules after this one all follow
   from it.
1. **One title per screen.** The header says what the screen is. On a
   screen that edits one thing, the header *is* that thing, written in
   place: the militia builder's header is the militia's name as an input.
   No subtitle restates the title.
2. **Say a fact once.** If the header shows a name, no caption, label or
   badge on the same screen repeats it.
3. **No standing hints.** Text under a control appears only when it has
   something to say, such as a refusal, an error or a consequence ("That
   name isn't allowed"). A self-evident control (a text field, a dice, a
   carousel) carries no helper line.
4. **A field's label and value look the same everywhere.** Use `.field-k`
   for the label and `.field-v` for the current choice (both in
   `global.css`). Every picker shows its current value: same size, weight
   and colour on every row, with no local copy and no row that skips its
   value. Older surfaces still carry about sixteen local eyebrow-label
   copies (`.co-k`, `.pk-kicker`, `.hq-pulled-k` and others) that predate
   this rule. Move each one to `.field-*` when that surface is next
   touched.
5. **Choose-one surfaces.**
   - A choice that commits through a CTA is a `PickStrip` of picture tokens
     plus one `PickCard` (`src/ui/shell/PickStrip.tsx`).
   - In a builder:
     - a part with many visual options is a `FlagWheel`;
     - a smaller part subordinate to it is a `PartCarousel`;
     - "see all" is an `OptionGrid` sheet.

   All three live in `src/ui/shell/company/FlagCarousel.tsx`. Reuse these
   components; don't invent a sixth way to pick one thing.
6. **One primary CTA per screen.** It sits full width in the bottom band
   and names the action ("Found the militia", "Choose Vesper"). A secondary
   action is never styled as primary.
7. **Tokens, not literals.** Colours come from the `:root` tokens, type
   sizes from `--fs-*`, and spacing from `--gap-*` / `--r-*`. A table
   several surfaces must agree on lives in `src/ui/channels.ts` (CLAUDE.md).
8. **Touch and focus.** Every control is at least 44 px on a coarse
   pointer, a real `<button>` or `<input>`, and shows a visible focus ring
   (`--focus-ring`). An icon-only button has an `aria-label`.
9. **Copy says "Tap" through `<Tap />` / `tapWord()`**, and player-facing
   text never says "your company": the player's band is the militia
   (`tests/copy.terms.test.ts`).
10. **A view you click around keeps its geometry.** Where a pick, a tab or a
    focus changes what a view shows, it changes values, never boxes: reserve
    a slot for anything that comes and goes ("Usual terms" when there is no
    condition, a season's seven bars from its first contract), keep the same
    rows for every option, cut a long value in place rather than wrap it,
    and float transient notes over the view instead of pushing it. Responsive
    across sizes, still across picks. The home is held to it in Playwright:
    every box, the map's framing and its terrain are identical across the
    five companies and Buy Company (`docs/ui-audit-2026-10/home-map/REVIEW.md`,
    "Polish").

### Parts and their jobs

| Part | Its one job | Not for |
|---|---|---|
| Screen header (`PageLayout` / `ContractPage` head) | Names the screen, or *is* the one thing the screen edits (the militia's name) | Instructions, stats, a second title |
| Primary CTA (the bottom band) | Commits the screen's one action and names it | Going back; a second action |
| Back (`.ct-back`) | Leaves without changing anything | Saving or confirming |
| `LeaveRun` | Abandons the run, after a confirm | Anything short of abandoning |
| A hero, tapped (its card on the bar, or posted on the field) | In setup, picks the hero up: its posts glow, and the next tap posts or moves it | Opening its details (that is the Details button). During a live wave, posts are held, so the tap reads instead |
| Details button (battle strip) | Opens and closes the selected hero's details in setup | Selecting or arming anything |
| `PickStrip` + `PickCard` | Chooses one of several: a token focuses it, the CTA commits it | Settings that apply on tap |
| `MenuRow` (inline detail) | A setting or list choice that applies on tap; its detail opens under the selected row | Choices that need a CTA |
| `FlagWheel` | The main part of a builder, with many visual options; its middle opens them all | Small sets (use a `PartCarousel`) |
| `PartCarousel` | A smaller part under a wheel, applied on tap | The main part of a builder |
| `OptionGrid` sheet | Shows every option of a part at once: pick one, it closes | Anything but "see all" |
| `.field-k` / `.field-v` | Names a part and states its current choice | Headings, kickers, body copy |
| Dice | Rolls the thing it sits on or beside (the name; the whole flag) | Any other shortcut |
| Refusal line (`.co-why`) | Says why an input is refused, only while it is | Hints, tips |
| `PageTip` / `Coach` | Teaches once, the first time it matters | A standing hint; an error |
| `Slip` / `SlipLine` | A receipt: what is paid, owed or earned, item by item | Prose |
| `Gold` | An amount of gold, the only currency | Other numbers |
| `RarityTag` | An item's rarity, in the shared rarity tokens | Any other ranking |
| `CompanyFlag` (UI) / `companyStandard` (canvas) | A trading company's identity: on its road's card on the home, and over the wagon on its contract — the same pixel rows, dressed as you dressed it (its logo and colour always stay) | The player's militia (that is its own flag, `Banner`) |
| Card flag button (`.mn-livery`, brush mark) | Opens that company's livery: the home card's flag is the way in, from standing 1 | Reading the terms (the CTA) |
| Livery panel (`LiveryScreen`) | Dresses one company's standard: the standard on its wagon over one `PartCarousel` per part (Cut, Pattern, Colour, Emblem, Trim); a locked piece is dimmed with its lock, says the standing that unlocks it on its row, and can be tried on; the CTA keeps the look (none before standing 1) | Explaining the track (the receipt and the track page) |
| Track page (`TrackScreen`, `track.css`) | One company's loyalty track: the five companies as chips to switch, its card (standard, level, bar), and the ten levels of the term as rows naming what each pays; the CTA reads its terms, or at standing 10 signs a second term (the terms then a quiet second button) | Dressing the standard (the livery panel) or signing a contract (the terms) |
| Track chip (`.tk-chip`) | Switches the track page to a company: its crest (locked if not hiring) and your level with it | Navigating away from the page |
| Track row (`.tk-row`) | One level of the track: its number, then each reward as `.field-k` / `.field-v` (the card's or item's real name with its icon, the flag piece). Earned: one dimmed line with ✓, words only. Next: lit in gold, with "Next · about N deliveries away" | Explaining a reward (its card does) |
| Track reward part (`.tk-part.is-open`) | Opens the Codex card of the skill or item a row names, ahead of time | Unlocking or buying anything |
| Sign view (`SignTerm`, mockup B3) | Says what a second term starts again, what you keep, and its consequence (the gold rim), before the CTA signs | Anything but signing a second term |
| Gold rim (`.crest.rim`) | Marks a company you signed a second term with, on its crest wherever it is drawn | Any other state of a company |
| Receipt standing card (`.ct-stand-btn`) | Says the standing a settle earned with the company and what the next level needs, and opens its track (on the Sovereign Route, each company's chip does) | Listing what the levels paid (the track block above it) |
| Receipt track block (`TrackEarned`) | Lists what each track level a settle crossed paid, under the company's name, one card a reward ("Standing 5 · signature", "Standing 9 · named"); one block per company on the Sovereign Route | Flag pieces (the flag line); the standing itself (the standing card) |
| Company mark on a builder option (`.co-from`) | Says which company's flag a militia piece came from: its logo, small, in the option's corner (and spoken to a screen reader) | Locking or pricing an option |
| Flag piece line (`FlagEarned`, `.ct-flag-line`) | On the receipt, names each flag piece a settle's standing earned, one line per company ("Ironvein flag · Cobalt") | A modal or a card; anything but flag pieces |
| Map armour tab (`.mn-armour`) | Says, from the map and before the march, what every goblin in a fight wears: Plated / Warded with the damage type it shrugs off struck through, Swift with its speed. On every fight still ahead, so a road can be planned | Explaining the modifier (the Context panel does that on focus) or the node's kind (its picture and label) |
| Raiders row (`.mn-fact.is-raiders`, `homeCard.companyFacts`) | Says, on a company's home card, what its road's armoured fights lean to and the damage that goes through it ("Some plated · bring magic", with the map tab's struck mark), or "Plate or wards, evenly": a road fact, like its ground | Saying which fights are armoured (the map's tabs do that, per node) |
| Offer pick (`OfferPick`, `.pk-offers`) | Every offer board that commits on its CTA (the spoils, the shop): picture tokens with rarity pips and damage mark, one card for the focused offer, the CTA takes or buys it. The same pick-one parts as the hero, skill and city picks | Committing on a tap (the campfire's one-tap rows do that, by design) |
| Stop scene (`StopScene`, `stops.css`) | Says where on the road you have stopped and who is there: a baked pixel scene (the trader's stall, the cook's fire, the shrine's stones and keeper, the recruiting yard), the page's one title hung on it as the place's sign; the clerk holds up the ware in focus | Saying what the stop offers (its cards do) |
| Stop line (the keeper's speech bubble, `stopScene.stopLine`) | What the keeper says to you at this stop, one short spoken line, fixed per node: the story of the road. It is the page's subtitle, read in place | Explaining a rule or an offer (never: the cards say it) |
| Liaison scene (`LiaisonScene`, `liaisons.css`) | Says who speaks for a company, and where: its liaison behind the counter of the company's post (a baked scene flying its standard, `scenes/liaison-<company>.png`), heading a city's page at the stops' 2×, the city's name hung on it as the page's one title. Never on the home (October 2026) | Saying what a contract pays, asks or risks (the terms, the route panel and the receipt do) |
| Liaison line (its bubble, `run/liaison.ts`) | What the company's liaison says to you now, headed with who speaks ("Brannoch · Ironvein's factor"): one spoken line, ≤ 40 characters, fixed for the run and city at a city, for the run on the receipt. It reacts to the road, the cargo that arrived or one of the contract's asks, and never promises more than the rules pay. | Stating a rule, a number or a reward (a fact the page says elsewhere) |
| Receipt liaison line (`LiaisonSays`, `.lia-says`) | The liaison's last word on how the contract ended (delivered by asks met, cashed out, fallen): small, their face cut from their post, who, the line | Listing the asks (the ask panel) or the pay (the slip) |
| Shop SOLD cubby (`.shop-sold`) | Shows a ware was bought off this shelf: the cubby stays, stamped | Anything for sale |
| Shop shelf (`ShopShelf`, `.shop-wares`) | Shows every ware at once, with its price on a paper tag, its rarity pips and damage mark in the corners; a tap focuses one | Describing a ware (the card) or buying it (the CTA) |
| Shop counter (`.shop-counter`) | Holds the stall's services, the wagon repair and the restock, apart from its wares | Selling goods (the shelf) |
| Ask panel (`AskTerms` / `AskReceipt`, `.ask-panel`) | What a contract's company asks of the road, one row an ask: on the terms with what each pays (+40 standing, the tip), on the receipt ✓ met or ✕ not with the count it reached | Explaining why it asks, or which pieces help (an ask says what it wants, a piece what it does) |
| Ask track (`AskProgress`, `.ask-track`, in the route panel) | Each ask's count against its target, a bar and the number, ✓ once met; an ask judged at the end names where | Saying what an ask pays (the terms and the receipt do) |
| Map "Asked" tab (`.mn-asked`) | Marks a stop ahead that serves an ask still open — an elite, a city, a Plated or Warded fight, a merchant, a shrine — on the node's bottom edge, with the asking company's crest | Asks every fight serves (a tally, a clean fight); the armour (its own tab, on the top edge) |
| Ask toast (`AskToast`, `.sh-asktick`) | In a fight, says an ask's count moved: whose ask, the count, ✓ when met. A pill on the Stage's edge, no layout, no tap, gone in a beat | Anything that needs reading twice; anything but a count moving |
| `ContractBanner` | On the hero pick: whose contract you're on, its terms, and who flies for it | Any other screen's header |
| `Tile` (Codex, menus) | One entry: a picture and a name; opens its card | Actions |
| Map zones (`.rm-zone`, run map) | Shows which ground is cleared (your row and below) and which is not yet (above); two muted captions up the left margin name the two grounds, in the background | Marking which nodes you can reach (the node states do that) |
| Decoration (rods, finials, cloth, meadow) | Sets the scene at the margins | Carrying information alone; sitting on the play field |
| Home bar (`.mn-bar`, `MenuScreen`) | Across the top of the home, over the map: the purse plaque, your militia's flag once founded (opens its builder), and the places | Instructions, tips, standing (the dock) |
| Purse plaque (`.mn-purse`) | Holds the seal (the screen's one title, spoken on a phone, written beside it on a desk) and the bank, in one small glass plaque, so the brand and the gold read as one thing over any map | Anything but the seal and the bank |
| Place button (`.mn-place`) | Opens one of the home's places — the HQ, the sealed crates, the Codex, Settings: a carved plate in the signposts' wood, its mark at the sheet's double (32px) and its name (short under the mark on a phone, "HQ", "Crates"; written beside it on a desk) — one family on every size. A locked one is a charred plate, its mark in shadow under a padlock, its name still there; it does nothing and says "locked" and what opens it as its name and tooltip | Any action on a company (the dock and the card) |
| Road signpost (`.tm-label`, `TradeMap`) | Marks where a company's road ends, by its crest (a padlock on a road not hiring yet); a tap focuses that road, like its dock slot. The focused one is lit in the company's colour. Its place depends on the layout and your standing only, never the focus (`labelLayout.placeSignposts`): a pick never moves a signpost | Standing, shares or the day's marks (the dock says those, once) |
| City tags (`.tm-town`, `.tm-leaders`) | Name the focused road's three cities as annotations: hung in a line beside the road, all on one side of it (two only where a road has no room, Peppercorn's on a 375 × 667 phone), each joined to its town by a 1px leader to a small square in the company's colour, the destination in bold. Never on each other, a signpost, the road, the keep, the notes or the screen's edge (`labelLayout.placeCityLabels`, tested); a name with no room is left off the map (still read by a screen reader) | Any other road's cities; anything but names |
| Company dock (`.mn-dock`, `homeDock.ts`) | The five companies as exactly five fixed, evenly spaced slots, always in `COMPANY_IDS` order — the order the map fans its roads, west to east. A slot shows the company's crest (gold-rimmed on a second term), your standing ("Rep 4", or "II · 3"), its share of the trade while the war is on, and the crown on the season's outright leader; a tap focuses its road (the map re-lights in the company's season, the card follows). A company not hiring yet shows its padlock and the standing that opens it | Signing (the CTA); explaining a mark (the card); Buy Company (its own slot, floating over the dock) |
| Buy Company slot (`.mn-own`, `homeDock.charterSlot`) | The Sovereign Route, your own road, as a slot like a company's — the same size — floating over the dock's right end, in its rightmost column (never in the dock row). No company's frame: a carved (double) cyan rim and the Sovereign crest. Locked (until every skill and item is unlocked): the crest in shadow under a padlock, the share unlocked ("40%") and a thin bar. Open: the crest in colour, "Buy", a soft glow. A desk writes its name. A tap focuses it like a road: every road lights and no city is named | A marketing pill or a count of anything but the unlocks; signing (the card's CTA) |
| Buy Company card (`.mn-own-card`) | The card while the Buy Company slot is in focus, in the company card's frame: the Sovereign crest (padlocked while locked), "Sovereign Route" over the title "Buy Company", and four rows — Road, Ground (every hazard, with its four marks), Have (the skills and items unlocked; once open, Bank: whether it covers the fee, or by how much it is short, in red), Pays — then the CTA: locked, a disabled "Unlock 26 more"; open, "Buy Company · 7,000", which opens the charter page (the militia's founding first, if there is none) and waits while the bank is short | The charter's terms and the five trade-offs (the charter page) |
| Dock mark (`.mn-mark-tag`) | Hangs on a slot's top edge, at most two: desperate terms "×1.5", the market of the day "×1.3" — the number. Every mark is also in the slot's accessible name | Saying what the mark means (the card's head badge does) |
| Company card (`.mn-card`, `homeCard.ts`) | The focused company, under the dock, as a fixed form: its flag (the way into its livery), its road's goods and its name, then the same three one-line rows for every company — Ground, Raiders, and Rep N (what its loyalty track pays at the next level, by kind: "Skill · Gilt Frame") — and the one CTA. A desk lays it in one row (flag and name · the form · the CTA) | Standing, share or cities (the dock and the map say them) |
| Card row (`.mn-fact`) | One fact of the card's form, on one line: its `.field-k` label, its mark in its own column (so every value starts at one edge) and its `.field-v` value, shortened in place at a narrow width, never wrapped; the whole fact in words is its accessible name and tooltip. A value that means "nothing special" reads quiet (muted); a condition reads in its colour (desperate in red) | A chip; a row that comes and goes with the company |
| Ground row (`.mn-fact.is-ground`, `terrain.GROUND_EFFECTS`) | Says what the road's ground DOES to its fights, in a few words, with the hazard's own marks (the atlas flame and curse, a drawn pond and boulder): "Fires block posts", "Lakes block posts", "Extra boulders block posts", "More cursed tiles · −70% dmg", "Lakes or fires block posts". One table, read by every surface that names a road's ground | The ground's place-name ("Wildfire") — a name that means nothing until you know the rule |
| Head badge (`.mn-badge`, `companyBadge`) | A one-off condition on the focused company — desperate terms, then the market's top price, each with its dock mark's own number ("Desperate · pays ×1.5"; desperate's +20% raiders ride the Raiders row) — at the right of the card's head, only when one applies; most cards have none. The head's height never changes with it | A second condition (the dock's marks carry it, and the slot's name says it) |
| Next row (`button.mn-fact.is-link`) | Names what the focused company's track pays next ("Next · Gilt Frame at 5 ›") and opens its track; the whole row is the button, its hit area reaching 44px below it | Saying your standing (the dock) |
| Season panel (`.mn-season`, `homeSeason.ts`) | Under the purse, floating over the map while the trade war shows: "SEASON 3" and "3 left ›", over seven bars, one per contract of the season in order — a delivery in the colour of the company it was for, a fall or a cash-out in earth, the ones still to come dim. A fixed size. The whole panel opens the standings; its name reads the season, what is left, who leads and each contract so far | The shares (the dock's slots); the patron (the standings' season card) |
| Map season (`mapRules.MAP_SEASONS`, `paintMap.seasonPixels`) | Says, softly, which company's road is in focus by its weather: a tint and a sparse speckle over the same baked terrain — Peppercorn late summer, Easel House spring, Ironvein overcast, Rosethread a morning mist, Moonquill frost. It crossfades with the focus (a cut under reduced motion); no focus and Buy Company keep the neutral night. The lit road stays the strongest thing on screen | Carrying any fact (the road's light and the card do); re-scattering the map |
| Coach pill (`.mn-coach`) | Under the home bar, floating over the map (it never pushes the map): one first-time tip at a time (the dock, the market, the war), gone once read where it matters; the map's labels keep off it | A standing hint |
| Share bar (`ShareBar`, `.tw-bar`) | Each company's share of the trade, one segment in its colour, widest first, its % inside when it fits; its accessible name reads them all | Any other proportion |
| Leader's crown (`.mn-slot-crown`, `pixel.Crown`) | Marks the trade war's sole leader (`tradeWar.seasonLeader`: the biggest share, alone — a tie, the even start included, crowns nobody) on its dock slot, its standings row and the season's end | A company's standing or the market (the slot's own marks) |
| Standings (`StandingsScreen`) | The five companies ranked by share, each with its bar, how the last contract moved it (▲/▼) and your deliveries this season; level shares share a place, the crown only on an outright leader; this season's desperate company tagged where it sits; the season card under them. Its head is the season alone (the card says when it ends). Its CTA reads the desperate company's terms, else your patron's, else the leader's | Signing anything |
| Season card (`SeasonCard`, `seasonCardCopy.ts`, `.tw-card`) | One paper ledger under the standings' rows: when the season ends (its eyebrow — "The season ends in 4 contracts" / "The season's last contract is next"), your patron with its crest and what it would pay now ("Ironvein is your patron … 150 so far"; "No patron yet"; "Ironvein and Easel House are level" and what breaks the tie), what a patron pays (two `SlipLine`s: each delivery, one of its items), and the company last now with its terms next season | Shares or per-company deliveries (the rows); the season's number (the head) |
| Season's end (`SeasonEndScreen`) | After the settle that ends a season, before the home: your patron ("Easel House pays you") with its standard, the purse (a "Banked" slip) and its vault pick as the shared `PickStrip` + `PickCard`, the CTA naming the item — or, with no delivery, "No company pays you"; then the next season: the company that finished last and its terms, the leader the shares carry over (or "No company leads") | Showing anything but the season that ended |
| War fact on the terms (`WarTerms`, `.tw-fact`) | On the desperate company's terms, its one trade-war fact this season: desperate terms (pays ×1.5, raiders 20% stronger) | The pay itself (the slip does, ×1.5 included) |
| Desperate chip (`DesperateChip`, `.tw-chip.is-desperate`) | Names the company on desperate terms this season ("This season: pays ×1.5" — "this season", so it never reads against the season card's "Last now", which is next season's), on its standings row (the home says it with the dock's "×1.5" mark and the card's chip) | Saying what makes it desperate (the season card's foot, the glossary) |

A new part gets a row here, with its job, before it ships.

### Exceptions (approved breaks)

| Date | Where | Rule | Need | Approved by |
|---|---|---|---|---|
| — | — | — | — | — |
