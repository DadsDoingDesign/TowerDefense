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
| `CompanyFlag` (UI) / `companyStandard` (canvas) | A trading company's identity: on its road and notice, and over the wagon on its contract — the same pixel rows, dressed as you dressed it (its logo and colour always stay) | The player's militia (that is its own flag, `Banner`) |
| Notice flag button (`.mn-livery`, brush mark) | Opens that company's livery: the road notice's flag is the way in, from standing 1 | Reading the terms (the CTA) |
| Livery panel (`LiveryScreen`) | Dresses one company's standard: the standard on its wagon over one `PartCarousel` per part (Cut, Pattern, Colour, Emblem, Trim); a locked piece is dimmed with its lock, says the standing that unlocks it on its row, and can be tried on; the CTA keeps the look (none before standing 1) | Explaining the track (the receipt and, later, the track page) |
| Company mark on a builder option (`.co-from`) | Says which company's flag a militia piece came from: its logo, small, in the option's corner (and spoken to a screen reader) | Locking or pricing an option |
| Flag piece line (`FlagEarned`, `.ct-flag-line`) | On the receipt, names each flag piece a settle's standing earned, one line per company ("Ironvein flag · Cobalt") | A modal or a card; anything but flag pieces |
| Map armour tab (`.mn-armour`) | Says, from the map and before the march, what every goblin in a fight wears: Plated / Warded with the damage type it shrugs off struck through, Swift with its speed. On every fight still ahead, so a road can be planned | Explaining the modifier (the Context panel does that on focus) or the node's kind (its picture and label) |
| Road armour chip (`.mn-chip.is-armour`) | Says, on a company's notice, the armour its road's goblins lean to ("Plated raiders"), with the map tab's struck mark: a road fact, like its ground | Saying which fights are armoured (the map's tabs do that, per node) |
| Offer pick (`OfferPick`, `.pk-offers`) | Every offer board that commits on its CTA (the spoils, the shop): picture tokens with rarity pips and damage mark, one card for the focused offer, the CTA takes or buys it. The same pick-one parts as the hero, skill and city picks | Committing on a tap (the campfire's one-tap rows do that, by design) |
| Stop scene (`StopScene`, `stops.css`) | Says where on the road you have stopped and who is there: a baked pixel scene (the trader's stall, the cook's fire, the shrine's stones and keeper, the recruiting yard), the page's one title hung on it as the place's sign; the clerk holds up the ware in focus | Saying what the stop offers (its cards do) |
| Stop line (the keeper's speech bubble, `stopScene.stopLine`) | What the keeper says to you at this stop, one short spoken line, fixed per node: the story of the road. It is the page's subtitle, read in place | Explaining a rule or an offer (never: the cards say it) |
| Liaison scene (`LiaisonScene`, `liaisons.css`) | Says who speaks for a company, and where: its liaison behind the counter of the company's post (a baked scene flying its standard, `scenes/liaison-<company>.png`). On the home's road notice, a band across its top showing the whole post at 1×; on a city's page, the head at the stops' 2×, the city's name hung on it as the page's one title | Saying what a contract pays, asks or risks (the terms, the route panel and the receipt do) |
| Liaison line (its bubble, `run/liaison.ts`) | What the company's liaison says to you now, headed with who speaks ("Brannoch · Ironvein's factor"): one spoken line, ≤ 40 characters, fixed for the day at the board, for the run and city at a city, for the run on the receipt. It reacts to the road, the cargo that arrived or one of the contract's asks, and never promises more than the rules pay. On the notice it is the company's letter, said once | Stating a rule, a number or a reward (a fact the page says elsewhere) |
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

A new part gets a row here, with its job, before it ships.

### Exceptions (approved breaks)

| Date | Where | Rule | Need | Approved by |
|---|---|---|---|---|
| — | — | — | — | — |
