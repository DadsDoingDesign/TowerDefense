# Fieldwatch in Figma

The UI audit in `docs/ui-audit/` has been rebuilt as a working Figma design
system. It is a **mirror of what ships**, not a proposal — every token matches
`src/styles/global.css` and `docs/DESIGN_SYSTEM.md`.

**File:** https://www.figma.com/design/xbggdvIl5WA2LYc4LyeII4/TD-Game-Roguelite

Two pages: **FieldWatch** (tokens, components, desktop) and **_Mobile first UI**
(the mobile system and the full flow board).

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
