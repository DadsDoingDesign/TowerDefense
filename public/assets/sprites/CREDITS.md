# Sprite credits

All sprite packs here are **CC0 / public domain** — no attribution is legally
required, but provenance is recorded for reference and courtesy.

## `tinyswords` — the default theme (Tiny Swords by Pixel Frog)

The **Tiny Swords** pack, created by **Pixel Frog**, released **CC0 1.0**.
- Home: https://pixelfrog-assets.itch.io/tiny-swords
- Fetched via GitHub CC0 mirrors: `chongdashu/phaserjs-tinyswords` (units,
  terrain) and `FulAppiOS/Agent-Quest` (goblin factions).

Idle frames were sliced from the animation sheets and auto-trimmed.

| Role | Source unit |
|---|---|
| fighter | Blue Warrior (idle) |
| rogue | Blue Archer (idle) |
| mystic | Blue Pawn (idle) — stands in for a caster (Tiny Swords has no mage) |
| torch1–4 | Goblin Torch — red / blue / purple / yellow |
| tnt1–4 | Goblin TNT — red / blue / purple / yellow |
| barrel1–4 | Goblin Barrel — red / blue / purple / yellow |
| torch5 / tnt5 / barrel5 | tier-5 champions (recolored, boss-scaled) |
| grass | Terrain tileset, interior grass tile |

The enemy path is a dirt lane stroked in the theme's path colour (Tiny Swords
has no seamless dirt tile), so this pack ships no `road.png`.

## `fantasy` / `undead` / `infernal` / `frost` / `sylvan` — Dungeon Crawl themes

Sprites from the **Dungeon Crawl Stone Soup** tileset (`rltiles`), **CC0 /
public domain**.
- Source: https://github.com/crawl/crawl (`crawl-ref/source/rltiles`)

Each theme has a pack folder with role-named files. These packs predate the
goblin taxonomy, so their enemies fall back to procedural shapes; their
`fighter/rogue/mystic` tower tiles still render.

| Role | fantasy | undead | infernal | frost | sylvan |
|---|---|---|---|---|---|
| fighter | vault_guard | death_knight | hell_knight | vault_guard | vault_guard |
| rogue | deep_elf_blademaster | deep_elf_master_archer | deep_elf_blademaster | deep_elf_master_archer | deep_elf_master_archer |
| mystic | arcanist | necromancer | occultist | arcanist | arcanist |
| grass | floor/grass/grass0 | floor/rect_gray0 | floor/volcanic_floor0 | floor/ice0 | floor/moss0 |
| road | floor/dirt0 | floor/cobble_blood1 | floor/rough_red0 | floor/crystal_floor0 | floor/dirt0 |
