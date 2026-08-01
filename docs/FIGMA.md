# Fieldwatch in Figma

The UI audit in `docs/ui-audit/` has been rebuilt as a working Figma design
system. Every token matches `src/styles/global.css` and `docs/DESIGN_SYSTEM.md`.

**File:** https://www.figma.com/design/xbggdvIl5WA2LYc4LyeII4/TD-Game-Roguelite

Two pages: **FieldWatch** (tokens, components, desktop) and **_Mobile first UI**
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
| `05 · Built — the shipped mobile UI` | What the code actually renders: the token plate, plus the six screens extrapolated from the two designed ones. |

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
| **Detail** | 254 | Context panel 176 · equipped gear 78 · pack 100 |

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
| Equip drawer sheet | Tap a gear slot → the Pack filters → tap the item |
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
what loads. Fieldwatch is a mobile app, so the shell is the only layout that
matters; it caps at 520px and centres.

`?shell=0` falls back to the pre-shell screens in `src/ui/screens/` and sticks;
`?shell=1` returns. That fallback exists only so the two can be compared while
the shell settles — it is not a supported mode, and the old screens are
expected to be deleted once the shell has been played in properly.

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
