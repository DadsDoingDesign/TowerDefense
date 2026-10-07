# Fieldwatch in Figma

The UI audit (formerly committed in `docs/ui-audit/`, now generated locally and git-ignored) has been rebuilt as a working Figma design
system. Every token matches `src/styles/global.css` and `docs/DESIGN_SYSTEM.md`.

**File:** https://www.figma.com/design/xbggdvIl5WA2LYc4LyeII4/TD-Game-Roguelite

## Current: page `Audit.16.06.26` — `?node-id=2149-2083`

**Start here.** This page rebuilds the whole design system from `main @ 6588e6a`
(2026-10-06): tokens, styles, components and screens, exactly as the code ships.
It supersedes everything below, which is kept as history. The page's own
`Cover · Read me` frame explains the layout.

| Area | What's in it |
| --- | --- |
| Variables | Four local collections. **Merchant Mercenaries · Color**: modes Default, Deuter/Protan, Tritan, High contrast. **Merchant Mercenaries · Type**: modes Default and Large UI. **Merchant Mercenaries · Layout**: space, radius, icon sizes. **Merchant Mercenaries · Shell**: band heights at 390×844, ≤800h, ≤700h, ≤600h. Each variable has WEB code syntax `var(--x)` and a USE FOR / NOT FOR / WHERE description. The older `Fieldwatch Tokens` collection is superseded. |
| Styles | 32 text styles, bound to the Type variables (Display, Title, Heading, Button, Row, Body, Card, Caption, Eyebrow, Label, Number, Slip). 14 effect styles (Elevation, Ring, Glow, Rail). |
| Foundations | Plates for Color (every token's use), Icons (all 96 atlas keys as vector components — one shape per colour, traced pixel-exact from `fw-icons.png` — each with meaning and use), Type, Space · Radius · Elevation, and Sprites. |
| Components 01–10 | About 150 components and sets, grouped by shell band and page family. Each set has a Spec block (source file, CSS class, USE FOR, AUDIT notes). Every variant is labelled under itself with what that state means; the same text is the variant's description. |
| Screens | Built only from instances: D Battle (12), C Run (8), A Watchtower (16), B Contract (4), E End (4), all at 390×844. W Desktop: 3 screens at 1440×900. |
| X Edge cases | 15 screens at the limits: five heroes (the Selector scrolls), a full 10-slot pack, a long wave queue (+N chip), long names, Large UI, the 320×568 tier, nothing affordable, roster full, toasts over content, every header chip at once, the longest militia name with an 8-digit bank, and the High contrast and Tritan modes. Magenta dashed boxes are annotations, not UI. |
| Audit / Findings | 44 findings with severity and `file:line`, plus the visual issues seen in a full capture of `main`. |
| Brand (Oct 2026) | The game is **Merchant Mercenaries** (short name *MerchMercs*, tagline “Guard the road, bank the gold.” (it replaced “Sellswords for hire”, which said *for hire* twice; the menu subtitle still reads “… · sellswords for hire” in code, `militiaTagline`)). The mark is the **Dripping Seal**: red wax, a gold coin and a sword whose crossguard runs into the ring. It is the chosen concept, *29 refined*, in the `LOGO ONLY` section. A **Brand Lockup** set (Stacked · Horizontal · Short) in Components / 08 Menu replaces the Fieldwatch wordmark on every menu screen and in the rotate prompt. The run header carries no wordmark, as on main. The four variable collections are renamed to `Merchant Mercenaries · …`. The repo itself still uses *Fieldwatch* (`index.html`, `manifest.webmanifest`, `package.json`, `docs/BRAND.md`): those change when the rename lands in code. |
| Proposal · Pick one, then read | **Built in the game (October 2026)** as `ui/shell/PickStrip.tsx` on the contract board, hero pick, recruit, city payout and skill choice; the elite/boss spoils keep main's one-tap commit instead. One pattern for every choose-one surface: hero pick, contract board, recruit, elite/boss spoils, city payout and skill choice. Options sit in one row as small Pick Tokens (a new component set: Default, Focused, Seen, Unavailable, Locked). One focused option shows below in a fixed recipe: head, three key facts, what it does, specifics, and a compare line against the option looked at before. Tapping focuses and never commits; the CTA names the choice. Each surface has a before → after pair; there is also a desk master–detail. Revised after the first review: tokens are pictures with one label + number and no name (a new Company Logo set gives each company its own pixel logo), gear is drawn as the in-game equipment slots and skills as the Skill card, and the compare line, the Seen dot and the swipe hint are gone. |

Older pages: **FieldWatch** (tokens, components, desktop) and **_Mobile first UI**
(the mobile system, the flow board, and the Root Shell redesign).

Read the sections in two halves. `FieldWatch`, `01 · Mobile UI System` and
`02 · Mobile Flows` **mirror what ships** — the same screens, tabs and sheets
the audit captured. `03 · Root Shell` and `04 · Contexts` are a **proposal**:
one four-band screen that absorbs those forty screens. Where the two halves
disagree, the shipped app is right and the shell is the argument.

## Page: FieldWatch — `?node-id=2001-30`

| Section | What's in it |
| --- | --- |
| `00 · Foundations` | Colour ramps (grounds, text/accent, archetype, rarity), the type scale, radius / spacing / elevation, and the glyph vocabulary. Every swatch is labelled with its token name and hex. |
| `01 · Component Library` | Every distinct component in the audit, as Figma **component sets with real variants** — buttons, badges, stat tiles, sentinel cards, item rarities, HUD panels, map nodes, modal shells. |
| `02 · Screens — Desktop` | Nine 1180×720 screens assembled from library instances. |
| `03 · Modals & Overlays` | Seven overlays on a 60% scrim over real screen context. |

## Page: _Mobile first UI — `?node-id=2001-2342`

| Section | What's in it |
| --- | --- |
| `01 · Mobile UI System` | The 390×844 layout spec (safe areas, 14px gutters, pinned action footer), the touch-target floor, the navigation model, and the mobile-only chrome components. |
| `02 · Mobile Flows — every path` | All 40 mobile screens in 5 lanes, wired with 68 labelled paths. |
| `03 · Root Shell — anatomy & parts` | The four-band shell: band anatomy, the four rules, the surfaces it retires, and every shell part as a component set. |
| `04 · Contexts — the whole app in one shell` | The same shell in 21 states — the whole game, no navigation. |
| `Mobile UI Layout, Spacing, Gaps, Fonts, Colors` | **The current design direction.** The Watchtower menu and hero pick, drawn directly — serif display type, the 32/16 rhythm, the pinned CTA. |
| `05 · As built — every screen` | A one-for-one mirror of the running app: the token plate plus all 21 screens, rebuilt as editable frames. |

Sections `01`–`04` are history — the audit, the flow board, and the Root Shell
proposal. **`05 · As built` is the one to trust**: it is reconciled against real
390×844 captures of the running app, so where it and an older section disagree,
`05` is right and the older one is a superseded step.

There is also a **`Working section | DO NOT BUILD`** on the page. Nothing is
implemented from it, per its own label.

### Mobile chrome components

`Mobile / Top Bar` (Run · Screen) · `Mobile / Action Footer` (Single · Hint +
Action · Dual) · `Mobile / Tab Bar` · `Mobile / Bottom Sheet` · `Mobile / Toast`
· `Mobile / Inventory Grid` · `Mobile / List Row`. Everything else is a shared
component from the FieldWatch library stretched to full width.

### Navigation model

| Pattern | Used for | Behaviour |
| --- | --- | --- |
| **Tab** | Squad / Tactics / Wave | Swaps the panel under the field. No history. |
| **Sheet** | Equip, Sentinel detail, Tower upgrades | Slides up over the screen. Dismiss by ✕, scrim tap, or swipe down. |
| **Full** | Inventory, Perks, Settings | Whole screen with a ← back. One level deep. |
| **Over** | Shrine, Recruit, Merchant, Run end | Blocking decision on a 60% scrim. No dismiss — you must choose. |

### Flow lanes

| Lane | Screens |
| --- | --- |
| **A · Watchtower** | Main Menu, Perks (no marks / with marks), Settings, reset confirm, high contrast |
| **B · Run** | Hero Pick, Run Map (start / progressed), Crossroads, Merchant, Shrine, Recruit, Recruit — roster full |
| **C · Battle** | Setup (Squad / Tactics / Wave), Hero selected, Gear expanded, Hero placed, Evolution ready, Wave in progress, Wave cleared, Run lost |
| **D · Gear & pack** | Sentinel detail, Equip drawer (all / main hand / item inspect), Tower upgrades (fresh / partly owned), Inventory (empty / populated / item selected) |
| **E · Ending & endless** | Run end (victory / defeat), Endless hub, Rooms — Merchant / Forge / Shrine / Recruit |

Gold wires are forward moves and carry the trigger that fires them; faded wires
are the return path (back, close, leave, walk away). The board is also a working
Figma prototype — 56 of the 68 paths are attached to the real CTA that drives
them, with **A1 · Main Menu** as the start point. The 12 unwired paths are
state changes with no single trigger element (tab-to-tab, level-up, wave
outcome); they stay documented as wires.

## The Root Shell — `?node-id=2058-4359`

The flow board above is the diagnosis: forty screens, four navigation patterns,
and a battlefield that six different sheets are allowed to cover. The Root Shell
is the fix. **One screen for the whole game** — four bands at fixed heights, and
every other surface becomes a state of those bands rather than a place you go.

| Band | Height | Holds |
| --- | --- | --- |
| **Header** | 44 (was 76) | Run state in ONE row — depth, enemy strength, cargo, gold. No wordmark (October 2026) |
| **Stage** | 388 | The subject: battlefield · map · board · result · title |
| **Selector** | 126 | The row of choosable things — party, offers, rooms, menu |
| **Detail** | 254 | Context panel (the rest, ~160) · gear doll 98 · pack 108 |

### The four rules

1. **One interaction.** Tap a card in the Selector, its detail fills the Context
   panel. Learn it once and it works for heroes, items, offers, rooms and perks.
   *Exception (October 2026, the designer's call):* a reward card and the
   campfire's rest and train commit on the tap itself; holding, hovering or
   focusing one shows its detail instead. See § One-tap commits below.
2. **The Stage is sacred.** Nothing covers the battlefield or the map — no
   sheet, no drawer, no scrim. The one thing that floats over an edge of it is
   the coach's hint pill (§ The coach hint pill): it takes no tap and no
   layout, and it fades on its own.
3. **The pack is permanent.** The right column is your inventory in battle, on
   the map, at the merchant. Buying an item means watching it land.
4. **Modals are for regret only.** The one blocking overlay left is a
   destructive confirm.

### What it retires

| Surface today | Becomes |
| --- | --- |
| Squad / Tactics / Wave tabs | Selector is always the party; tactics is a Context tab |
| Sentinel detail sheet | `Context Panel · Hero Stats` |
| Equip drawer sheet | Tap a gear slot → the Pack filters → tap the item. The slots sit on a paper doll (R3-2): body on the chest, off hand left, main hand right |
| Item inspect sheet | `Context Panel · Item` |
| Tower upgrade sheet | `Context Panel · Hero Upgrades` |
| Inventory modal | The Pack column, permanent |
| Merchant / Shrine / Recruit / Crossroads | `Stage=Board` + `Selector=Offers` |
| Endless room screens | `Stage=Board` + `Selector=Rooms` |
| Run end overlay | `Stage=Result` |

### Shell component sets

`Shell / Header Band` (Run · Meta) · `Shell / Stage Band` (Battlefield ·
Battlefield live · Map · Board · Result · Title) · `Shell / Selector Band`
(Party · Party + bench · Offers · Rooms · Menu) · `Shell / Detail Band` ·
`Shell / Context Panel` (Hero Stats · Hero Upgrades · Hero Tactics · Item ·
Item Fusable · Item Equipped · Offer · Empty) · `Shell / Hero Slot` (6 states) ·
`Shell / Gear Slot` (3) · `Shell / Pack Tile` (8) · `Shell / Choice Card`
(8 types).

Every context below is those instances and nothing else — no bespoke frames.

### It is built

The shell is implemented in `src/ui/shell/` and is **the game's UI** — it is
what loads. Fieldwatch is mobile-first: on a phone the shell is one column
capped at 520px. On a tablet and a desk the same bands re-flow — see
§ Wide layout below.

The pre-shell screens (`src/ui/screens/`, the `?shell=0` fallback) have been
deleted; the shell is the only UI.

| File | Role |
| --- | --- |
| `RootShell.tsx` | The four-band frame |
| `context.ts` | Game state → which subject each band shows |
| `offers.ts` | Everything choosable, normalised to one `Offer` shape |
| `HeaderBand` · `StageBand` · `SelectorBand` · `DetailBand` | The bands |
| `styles/shell.css` | Band geometry and the shell's own components |

The Stage reuses the real `BattleCanvas` and `RunMapView`, so the battlefield
and the map are the shipped render path, not a copy.

One deviation from the spec, made while building it: reversible navigation
(back, leave, walk on, open a submenu) acts on the card tap instead of
select-then-confirm. Rule one exists so consequential choices show their detail
before you commit; a back button has no detail worth reading and the second tap
was pure friction. Offers opt in with `immediate`, and anything that spends,
grants or destroys is forbidden from setting it.

### One-tap commits — the exception to rule one (October 2026)

The designer approved this (audit `AUDIT_2026-10.md` §4, designer item 8). It
overrides rule one for exactly two surfaces: **rewards** (the hand dealt in
place after a cleared wave, and the Spoils page after an elite or a boss) and
**the campfire** (rest, or train one hero). They are the most frequent choices
in a run and the cheapest, and select-then-confirm doubled their taps.

| Input | What it does on a one-tap option |
| --- | --- |
| Tap · click · Enter · Space | **Commits it.** The reward goes to the pack (the receipt toast says so) or the fire is spent, and the Announcer says what happened. |
| Press and hold (touch, 350 ms) | Shows its detail in the Context panel (or the board's detail block). Letting go does **not** commit. |
| Hover (a fine pointer, after a 120 ms rest) | Shows its detail. |
| Keyboard focus | Shows its detail; the option's `aria-description` carries the same text for a screen reader. |

The rules that keep a tap honest are pure and unit-tested (`ui/shell/press.ts`,
`tests/press.test.ts`): a press that travels more than 8 px is a scroll, a
press held 350 ms is a look, and a press that starts within 250 ms of the
surface appearing is ignored (the tail of a double-tap on the last screen). The
wiring is `ui/shell/oneTap.tsx`; an offer opts in with `Offer.oneTap`, whose
`label` is the option's accessible name as the deed ("Take Bow — two-handed
weapon, Common").

There is no "Take it", "Rest" or "Train" button any more: a button that does
what the tap already did is chrome. "Walk on" stays as its own row. The first
one-tap board says how it works once — "Tap to take · hold to look" ("Click to
take · hover to look" under a mouse) — until the first one-tap commit
(`taught.oneTap`).

Everything that spends gold, is permanent or destroys stays select-then-confirm:
the merchant, the shrine, a recruit, the hero pick, skill picks and the city's
cash-out. `oneTap` is forbidden on them, as `immediate` is.

Taps per battle node once the posts carry over (every fight after the first),
from the map and back: tap the node, March, Start Wave, then the reward.
**Before:** the reward was 2 taps (pick the card, "Take it"), or 1 if you
wanted the preselected first card — 5 taps (4 at best). **After:** any card is
1 tap — 4. The first fight adds the same 2 posting taps either way. A campfire
goes from 2 taps (pick, then "Rest" or "Train") to 1.

### The header — one row, no wordmark (October 2026)

The player's call: "get rid of the name fieldwatch too in the header. we need
the space." The in-run header no longer shows FIELDWATCH (the title screen
keeps it). Its heading — the `h1` the shell focuses on a screen change, named
"Battle — <field>" or "Run map" — is still there, off-screen. What is left is
one row: **Depth** · (Sovereign) · **enemy strength** · **cargo** (crate, word,
bar, %) · **gold**. The cargo block is the only part that gives ground: its bar
shrinks first, then the visible word "Cargo" steps aside (a container query at
150px; the crate, the bar and the % stay, and the accessible name still says
"Cargo 100%").

| Header | 430×932 | 390×844 | 375×667 | 360×740 | 320×568 | 1440×900 |
| --- | --- | --- | --- | --- | --- | --- |
| Before | 76 | 76 | 68 | 76 | 62.6 | 60 |
| After, first battle (cargo + gold) | **44** | **44** | **40** | **44** | **38** | **52** |
| After, depth + strength + 4-digit gold | 44 | 44 | 40 | 44 | **53** (two rows) | 52 |

Two rows only where one cannot hold the pieces legibly — depth AND strength on
a phone under 360 wide, Large UI under 430, or the Sovereign chip on any phone:
the chips and the purse, then the cargo across the width. That choice is made
by the viewport and by which chips the run has, never by a number's width, so
it cannot flip in the middle of a fight.

### The coach hint pill (October 2026)

The player's call: "im not a fan of the banner with the X that i constantly
have to remove its moving around content and annoying to have a chore." The
coach was a grid row between the header and the Stage with a "Got it" button;
every tip pushed the field down 45–74px and its leaving pulled it back, and
during a live wave the row was sometimes held open, empty, at a fixed height.

It is now a **hint pill** (`Coach.tsx`, rules in `coachRules.ts`):

- **No layout.** It floats over one edge of the Stage (`position: absolute`
  inside `.sh-stage`), `pointer-events: none` — a finger lands on the field
  under it. There is no coach row in any band layout (phone, tablet, desk);
  the Stage keeps one box for a whole battle.
- **No tap.** It fades in, stays `pillDurationMs` — 2.5 s + 60 ms a word,
  capped at 9 s, with the clock stopped while the tab is hidden — fades out and
  marks its tip taught. Reduced motion: a plain fade (no slide); the in-game
  Reduce motion setting makes it instant.
- **Next to what it teaches, never over it.** Tips about the party row, the
  wave strip or the gear (`skill`, `relic`, `command`, `subwave`, `speed`,
  `gear`, `equip`) float on the Stage's **bottom** edge; tips about the field
  or the header's chips on the **top** edge (`tipWhere`). While the field is in
  play a bottom-edge tip moves to the top if the wagons are down there
  (`wagonsLow`) — on a portrait field they always are. A top pill clears the
  champion's plate and the zoom-to-place line.
- **Field notes** (a tap on a tile that will not take a hero) and the
  **new-ground** note use the same pill and pre-empt a tip at once
  (`pickPill`); a note about a tile in the top third of the field floats on the
  bottom edge (`noteWhere`). The new-ground note also goes when a hero is posted.
- **One at a time**, `TIP_GAP_MS` (4 s) apart; a live wave hears only its
  breather lessons; tips wait out the wave-clear beat, and on a Stage too short
  for the ceremony and a pill (`CEREMONY_ROOM_PX`, the 375 and 320 reward
  screens) they wait for the run map.
- **Heard.** The words go through the one polite voice (`Announcer`, via
  `announceHint`); the pill is not a live region.
- **Look.** A dark wash (`rgba(20,13,7,.9)`) with a gold hairline (a field note:
  the danger hairline), radius 14, max `min(100% − 16px, 400px)`, the tip's icon
  and one to three lines of `--fs-xs` (12px) text — `--text` ~13:1 and
  `--accent-text` ~8:1 on it, whatever is under it.

## Live wave layout (Phase 2) — the contract the other lanes drop into

Setup keeps the four bands as budgeted in `shell.css`. When a wave goes live the
shell carries `.is-collapsed` (`useBattleLayout`, `src/ui/shell/live.ts`) and the
**Detail band collapses to the wave strip**; the Stage, the only `1fr` row, takes
the height. Selecting anything re-opens it (`.is-peek`) — rule one still holds —
and Start Wave lets go of the just-posted hero so the common path collapses.
The wave-clear ceremony keeps the collapse (`settled`) so nothing jumps while the
eye is on the field. Reduced motion: the 260 ms height transition is instant.

| Band (live) | 390×844 | 375×667 | 320×568 | Holds |
| --- | --- | --- | --- | --- |
| Header | 44 (was 76) | 40 (68) | 38 (63) | Run state, one row (§ The header) |
| Stage | **606** (was 332, then 574) | **447** (419) | **356** (331) | Field and the map round it, `.sh-stage-top`, `.sh-stage-center`, the coach pill over an edge |
| Selector | 126 | 112 | 106 | Party (unchanged) |
| Wave strip | 68 | 68 | 68 | caption (name · N left) over the **enemy queue** · **CommandSlot** · Speed |

The Stage's box is the same from setup through every breather to the last
enemy (measured per frame, October 2026: 390×844 `0,44,390×606`; 375×667
`0,40,375×447`; 320×568 `0,38,320×356`; 1440×900 `0,52,979×848`) — no coach
row opens or closes over it any more. It changes only when the wave settles
and the reward hand opens the Detail band.

The field is fit to the Stage wrap's **content box**. On the phone column a
battle is fought on the field's **portrait twin** (620×960 logical, the
landscape field transposed — see *Portrait battlefields* below), which is
height-bound in the tall Stage; desks and tablets keep the 960×560 landscape
field. Grid-fit: there is no apron and no letterbox — the battlefield is one
continuous map (`render/terrain.ts` bakes the meadow, the road and the woodland
round it on the grid's own 40px lattice) and the canvas fills the whole Stage.
`frame.stageView` fits the **playable rect** (the road inside the grid, the Gate,
every tile that is not forest) to the content box and shows as much map as the
Stage has room for; on the side the road enters, it never shows past the field's
edge, so the horde walks in from off-screen. Desks get a crisp scale: whole device
px when within 10%, else a ×2/×3 supersampled composite filtered down. Units draw
at the pack's native density (`unitPixmapScale`): ~35 CSS px goblins and ~44 CSS
px heroes on the portrait field at 390 wide (they were ~24 / ~30 on the
landscape field).

### Portrait battlefields — which field, and what setup looks like

| Phone (live) | Landscape field (before) | Portrait twin (now) | Scale |
| --- | --- | --- | --- |
| 390×844 | 390×228 | **370×573** | 0.41 → 0.60 |
| 375×667 | 375×219 | **270×418** | 0.39 → 0.44 |
| 320×568 | 320×187 | **213×330** | 0.33 → 0.34 |
| 430×932 | 430×251 | **427×661** | 0.45 → 0.69 |

- **Which field.** `chooseFieldOrientation(innerWidth, innerHeight)` in
  `maps.ts`: portrait on the phone column (`< 700` wide and `h ≥ 1.3 w`),
  landscape everywhere else (tablets, desks, short landscape windows). It is read
  **once per battle**, when the node is entered, and stored with the run — a
  rotation mid-battle re-fits the same field (more map round it), a resume comes back on
  the twin it was saved on, and the next node chooses again. The twins are an
  isometry of the originals, so this is a presentation choice with zero balance
  consequence (REPORT §17 gates it).
- **Setup collapses too on a portrait field** (`setupCollapsible`, `live.ts`).
  A portrait field in the four-band setup Stage would be smaller than the
  landscape one was (0.30 at 390, 0.12 at 320), so setup takes the live layout:
  the Detail band is the wave strip — a caption (*Post a hero*, then *12
  enemies*) over the wave's line-up, a **Details** toggle and Start Wave. Arming a hero from the party
  row keeps it collapsed (the field is the target); a post lets go of the
  selection; Details, or tapping a posted hero on the field, opens the band.
  Setup field at 390×844: 341×528 (was 390×228); at 320×568: 184×285 (was
  191×111).

### One wave strip, four moments (G2-2)

The strip is two slots that never move: a **middle** — a one-line caption (the
wave's name · the moment's words) over the **enemy queue** — and the
**actions** on the right. The queue is who is still coming: 32px portraits
(`--icon-md`, the field's own sprite at its ×½ bake, drawn 1:1) in spawn
order, next first (accent edge), each with its `×n`; at most three kinds, then
`+N`, fewer when the room is narrower (`chipsThatFit`). It is glance-only and
ONE `role="img"` whose name lists every kind and count.

| Moment | Caption | Queue | Actions |
| --- | --- | --- | --- |
| Setup | *Depth 1 · Post a hero* → *Depth 1 · 12 enemies* | the whole wave | (Details) · Start Wave |
| Live | *Depth 1 · 8 left* | everything not yet spawned (*All on the field* when empty) | Watch Command · Speed |
| Held sub-wave | *Held · Move one hero* → *Held · Moved* (accent edge on the strip) | the NEXT sub-wave only | Next ▶ · Speed |
| Cleared | *Depth 1 · Wave cleared* | gold earned | Continue |

There is no banner over the field during a held sub-wave any more — the
caption carries the instruction, `Announcer` speaks it, and the open posts
still light up on the field. Where the middle is under 140px (portrait setup
beside Details on a phone, and every moment at 320 wide) the name steps aside whole and the moment keeps the
line; the header's Depth chip names the wave right above.

**Where things go — for the COMBAT and RUN/META lanes:**

| Place | File | Rule |
| --- | --- | --- |
| **Command button** | `src/ui/shell/CommandSlot.tsx` (rendered by `WaveBar`, live only) | Return ONE `<button className="sh-command">` (44px, styled in `shell-live.css`) or null. It sits between the enemy queue and Speed; the strip's height already fits it. Actions live in band 4 — never on the Stage. |
| **Boss / champion nameplate** | `src/ui/shell/BossPlate.tsx` in `.sh-stage-top` | While it renders, `.sh-stage:has(.sh-bossplate)` pads the canvas wrap by `--sh-bossplate-h` (54px) and `BattleCanvas` fits the playable rect below it — the plate lies over the woodland past the play (grid-fit). Boss phases: fill `.sh-bossplate-extra` (a flex spacer between the name and the HP number) with phase pips / a phase word. |
| **Telegraphs** | `render/overlays.ts` or a new render file | Draw in the field composite (logical px). The HP bar stack sits at `artTop` (see `render/hpbar.ts`); leave the band just above the head for it. |
| **Post-wave / result copy** | `WaveCeremony.tsx` (Stage centre, after the fight only), `DefeatReceipt.tsx` (run end) | The ceremony may cover the field because the fight is over; nothing may cover a LIVE field. |
| **Post-wave reward + level-ups** (G3-2) | `levelUps.ts` (`rewardInPlace`, the roster's level-up state), `SelectorBand.tsx` (`RewardSelector`), `LevelUpPanel.tsx` | After a cleared NORMAL campaign wave the Stage dims to one result line, the Selector holds a compact party strip over the reward hand (first card preselected, "Take it" in the Context panel), and a levelled hero wears a "Lv 5 ↑" badge until its level-up is dealt with in the panel. Elite and boss spoils keep their page, and their level-ups keep the modal. |
| **Announcements** | `Announcer.tsx` | The one polite live region in a battle. Add a message there; do not add a second region. |
| **Event-page receipts** | `ReceiptToast` + `PackStrip` (`PackStrip.tsx`) | Derived from the store (a new item id / hero id), so a new rest/unlock page gets them for free. |

Build circles are real buttons (`src/ui/SlotLayer.tsx`), laid over the canvas
with `pointer-events: none` — keyboard and assistive tech reach them; a finger
still lands on the canvas hit test.

## Wide layout (Phase 4) — tablet and desk

Same bands, same components, same rule set (the Stage is never covered, one
interaction, the pack is permanent). Only the GRID changes, all of it in
`src/styles/shell-wide.css`, behind media queries no phone matches — 390×844 is
byte-for-byte the phone layout.

| Viewport | Query | Layout |
| --- | --- | --- |
| Phone portrait | < 700 wide | Unchanged: one 520px-capped column, four bands. |
| Phone landscape | landscape, ≤ 500 tall, ≤ 950 wide, coarse pointer | Unchanged: the rotate prompt. |
| Tablet portrait | 700–899 wide, portrait | Four bands at FULL width (768 → field 768×448, was 520×303); Detail 296. Pages 600 wide; the menu fills the screen over its trade map. |
| Wide | ≥ 900 wide and ≥ 540 tall | Header one row across (52, no wordmark); Stage left spanning the height; Selector + Detail stacked in a right column `clamp(400px, 32vw, 468px)`. The coach pill floats over the Stage's edge, as on a phone. |

**Wide, battle / run map** (1440×900):

    ┌──────────────────────────────── header 52 ────────────────────── ? ┐
    │                                        │ Selector 126 (party row)   │
    │   STAGE  980×840                       ├────────────────────────────┤
    │   field 960×560 at exactly 1:1         │ Detail — context · gear ·  │
    │   (the map runs on round it)           │ pack, full height; wave    │
    │                                        │ strip at its foot          │
    └────────────────────────────────────────┴────────────────────────────┘

- **Field scale.** `--field-snap: 1` on the canvas wrap makes `BattleCanvas`
  snap an ENLARGED field down to whole device pixels per field pixel (1:1 at
  1440×900 dpr 1, 2:1 on a retina 1440). A field that must shrink (1024 → 0.66,
  1280 → 0.88) keeps the one filtered resample. Phones never snap.
- **No live collapse.** The Detail band sits beside the field, so collapsing it
  in a live wave would buy the field nothing: it stays open, wave strip at its
  foot. The gear column is a paper doll (R3-2): 60px slots on a larger body,
  and under it what each slot holds, in words. Where the doll falls back to
  the stacked slots (narrow rail on Large UI), they cap at 76px.
- **Run map** centred at ≤ 760px of the Stage.
- **Pages** are a 600px column framed on the table (hairline sides, soft
  shadow). The **menu** fills the screen over the trade map
  (`ui/attract/TradeMap.tsx`): a left-hand column (`clamp(380px, 31vw,
  460px)`, 52px title) holds the title, your militia, the bank, today's
  market, the charter line, the tiles and the CTA, with your standing with
  each company at its foot; the map takes the rest (mockup
  `trade/r3/1-menu-desk.png`, CSS in `menu.css`).

**Pointer and keyboard** (any width):

- Copy follows the primary pointer, not the UA: `(hover: hover) and (pointer:
  fine)` says **Click**, everything else **Tap** — `<Tap />` / `tapWord()` in
  `src/ui/pointer.tsx`. New copy that tells the player to activate something
  uses them.
- Hover (fine pointer only): cards, tiles, gear slots, tabs, rows, portraits
  lift to `--surface-strong` with an accent inset; buttons brighten 10%;
  pointer cursor; disabled shows `not-allowed`.
- Shortcuts (`Shortcuts.tsx`): **1 / 2 / 3** speed · **Space / Enter** Start
  Wave · **C** the command button (`.sh-command`, when COMBAT's slot shows one)
  · **?** the sheet · **Esc** closes. They press the visible control
  (`[data-key="start"]`), so they can never do what it would refuse, and they
  yield to a focused control, a text field, a modifier chord or an open modal.
  The "?" button shows in the wide header only; the sheet opens over the right
  column, never over the Stage.

## Contexts — `?node-id=2062-4739`

Twenty-one states of the one shell, proving it carries the whole game. Same four
bands in each; only the Stage subject, the Selector contents and the Context
mode change.

| # | Context | Stage | Selector | Context panel |
| --- | --- | --- | --- | --- |
| 01 | Battle — nothing selected | Battlefield | Party | Empty |
| 02 | Battle — hero selected | Battlefield | Party | Hero Stats |
| 03 | Battle — hero upgrades | Battlefield | Party | Hero Upgrades |
| 04 | Battle — hero tactics | Battlefield | Party | Hero Tactics |
| 05 | Battle — item selected | Battlefield | Party | Item |
| 06 | Battle — fuse available | Battlefield | Party | Item Fusable |
| 07 | Battle — gear slot active | Battlefield | Party | Item Equipped |
| 08 | Battle — wave live | Battlefield live | Party | Hero Stats |
| 09 | Map — where next | Map | Party | Hero Stats |
| 10 | Map — crossroads | Board | Offers | Offer |
| 11 | Merchant — offer held | Board | Offers | Offer |
| 12 | Shrine — terms | Board | Offers | Offer |
| 13 | Recruit — candidate held | Board | Offers | Offer |
| 14 | Recruit — roster full | Board | Party + bench | Offer |
| 15 | Hero pick — first pick | Board | Offers | Offer |
| 16 | Endless — room choice | Board | Rooms | Offer |
| 17 | Run end — victory | Result | Party | Offer |
| 18 | Run end — defeat | Result | Party | Offer |
| 19 | Watchtower — perks | Board | Menu | Offer |
| 20 | Watchtower — settings | Board | Menu | Offer |
| 21 | Main menu | Title | Menu | Empty |

The Header runs `Type=Run` for 01–18 and `Type=Meta` for 19–21. `Mode=Offer`
carries a lot of weight — it is the generic "here is the thing you tapped and
what it costs you" panel, and 12 of the 21 contexts use it. If the shell gets
built, that mode is the first place to look for a split.

## Component sets

`Button` (6 tones) · `Icon Button` (4) · `Badge` (6 tones) · `Stat Tile` (3) ·
`Progress Bar` (4) · `Segmented Control` (tactics / speed / equip filter) ·
`HUD Tab Bar` · `Toggle` · `Slider Row` · `Checkbox Row` · `Archetype Avatar` ·
`Currency Readout` · `Section Header` · `Sentinel Card` (5 states + gear
expanded) · `Equip Slot Row` · `Item Card` (7 rarities incl. cursed and
keepsake) · `Equip Item Row` · `Inventory Tile` · `HUD Top Bar` ·
`Wave Preview` · `Tactics Panel` · `Battle Controls` · `Build Slot` ·
`Menu Row` · `Screen Header Bar` · `Stat Record Tile` · `Perk Row` ·
`Map Node` (8 states) · `Roster Chip` · `Inventory Chip` · `Hero Pick Card` ·
`Room Card` · `Recruit Candidate` · `Mutate Hero Row` · `Board Panel` ·
`Modal Shell` (panel / slate) · `Shrine Term Row` · `Reward Row` ·
`Upgrade Tier Row` · `Upgrade Path Column` · `Empty State` · `Tooltip`

## Caveats

- **Loose rebuild.** Structure, copy and tokens match the audit shots; it is not
  a pixel trace.
- **Art is represented, not imported.** Sprite upload to Figma is blocked by the
  sandbox network policy, so hero and enemy sprites are drawn as vector
  pixel-figure stand-ins and the meadow/lane are built from flat shapes. Swap in
  the real `public/assets/sprites/tinyswords/` PNGs when working from a machine
  with Figma network access.
- **Inter stands in for the shipped `Trebuchet MS` / `system-ui` stack.** The
  size and weight ramp is the real one.
- **Teal reads two ways in the product** — dark ink on small price chips, light
  text on the large nine-slice CTA. Both are in the `Button` set (`Teal` and the
  CTA used on hero-pick and run-end).
