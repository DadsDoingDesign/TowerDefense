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
| Variables | Four local collections. **Fieldwatch · Color**: modes Default, Deuter/Protan, Tritan, High contrast. **Fieldwatch · Type**: modes Default and Large UI. **Fieldwatch · Layout**: space, radius, icon sizes. **Fieldwatch · Shell**: band heights at 390×844, ≤800h, ≤700h, ≤600h. Each variable has WEB code syntax `var(--x)` and a USE FOR / NOT FOR / WHERE description. The older `Fieldwatch Tokens` collection is superseded. |
| Styles | 32 text styles, bound to the Type variables (Display, Title, Heading, Button, Row, Body, Card, Caption, Eyebrow, Label, Number, Slip). 14 effect styles (Elevation, Ring, Glow, Rail). |
| Foundations | Plates for Color (every token's use), Icons (all 96 atlas keys, each with meaning and use), Type, Space · Radius · Elevation, and Sprites. |
| Components 01–10 | About 150 components and sets, grouped by shell band and page family. Each set has a Spec block (source file, CSS class, USE FOR, AUDIT notes). Every variant is labelled under itself with what that state means; the same text is the variant's description. |
| Screens | Built only from instances: D Battle (12), C Run (8), A Watchtower (16), B Contract (4), E End (4), all at 390×844. W Desktop: 3 screens at 1440×900. |
| X Edge cases | 15 screens at the limits: five heroes (the Selector scrolls), a full 10-slot pack, a long wave queue (+N chip), long names, Large UI, the 320×568 tier, nothing affordable, roster full, toasts over content, every header chip at once, the longest militia name with an 8-digit bank, and the High contrast and Tritan modes. Magenta dashed boxes are annotations, not UI. |
| Audit / Findings | 44 findings with severity and `file:line`, plus the visual issues seen in a full capture of `main`. |

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
| **Header** | 76 | Run state — depth, base, gold, dust, threat |
| **Stage** | 388 | The subject: battlefield · map · board · result · title |
| **Selector** | 126 | The row of choosable things — party, offers, rooms, menu |
| **Detail** | 254 | Context panel (the rest, ~160) · gear doll 98 · pack 108 |

### The four rules

1. **One interaction.** Tap a card in the Selector, its detail fills the Context
   panel. Learn it once and it works for heroes, items, offers, rooms and perks.
2. **The Stage is sacred.** Nothing covers the battlefield or the map — no
   sheet, no drawer, no scrim.
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
| Header | 76 | 68 | 62 | Run state (unchanged) |
| Stage | **574** (was 332) | **419** | **331** | Field and the map round it, `.sh-stage-top`, `.sh-stage-center` |
| Selector | 126 | 112 | 106 | Party (unchanged) |
| Wave strip | 68 | 68 | 68 | caption (name · N left) over the **enemy queue** · **CommandSlot** · Speed |

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
| Wide | ≥ 900 wide and ≥ 540 tall | Header one row across; Stage left spanning the height; Selector + Detail stacked in a right column `clamp(400px, 32vw, 468px)`. |

**Wide, battle / run map** (1440×900):

    ┌──────────────────────────────── header 60 ────────────────────── ? ┐
    ├──────────────────────────────── coach (when a tip is live) ────────┤
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
