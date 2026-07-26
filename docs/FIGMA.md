# Fieldwatch in Figma

The UI audit in `docs/ui-audit/` has been rebuilt as a working Figma design
system. It is a **mirror of what ships**, not a proposal — every token matches
`src/styles/global.css` and `docs/DESIGN_SYSTEM.md`.

**File:** https://www.figma.com/design/xbggdvIl5WA2LYc4LyeII4/?node-id=2001-30
(page **FieldWatch**)

## Layout

| Section | What's in it |
| --- | --- |
| `00 · Foundations` | Colour ramps (grounds, text/accent, archetype, rarity), the type scale, radius / spacing / elevation, and the glyph vocabulary. Every swatch is labelled with its token name and hex. |
| `01 · Component Library` | Every distinct component in the audit, as Figma **component sets with real variants** — buttons, badges, stat tiles, sentinel cards, item rarities, HUD panels, map nodes, modal shells. |
| `02 · Screens — Desktop` | Nine 1180×720 screens assembled from library instances. |
| `03 · Modals & Overlays` | Seven overlays on a 60% scrim over real screen context. |
| `04 · Screens — Mobile` | Four 390×844 frames covering the mobile-only chrome. |

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
