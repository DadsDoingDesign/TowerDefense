# Sprite credits

Every sprite shipped here is **CC0 / public domain**. No attribution is legally
required; provenance is recorded for reference, courtesy, and — for Tiny Swords
— because getting it wrong is a licence violation.

> ## ⚠️ Tiny Swords is NOT CC0 any more. Do not re-download it from itch.
>
> The current **Tiny Swords** download carries a restrictive licence:
>
> > "Feel free to use this asset pack in both personal and commercial projects,
> > modifying the assets as needed. Crediting is not required, but it helps and
> > is always welcome. **You may not redistribute, resell, or repackage the
> > assets, even if the files are modified.**"
>
> This repository is public, so every PNG in it is a redistribution. Pixel Frog
> was asked about this exact case — a public GitHub starter kit — and declined.
>
> Pixel Frog kept the older public-domain build as a **separate download** named
> `TS_old version_CC0 Licensed`. **Only that build may be shipped here.** Anything
> taken from the current pack has to come straight back out again.
>
> Beware GitHub "CC0 mirrors": several serve the post-CC0 build under a CC0
> heading. `chongdashu/phaserjs-tinyswords` is one, and a previous version of
> this file cited it as a CC0 source — which is how nineteen post-CC0 files got
> in. Verify, don't trust the README. `npx tsx scripts/harvest-cc0.ts --check`
> runs the verification.

## `tinyswords` — the default theme (Tiny Swords by Pixel Frog)

**Tiny Swords**, created by **Pixel Frog**, *old CC0 1.0 build only*.

- Home: https://pixelfrog-assets.itch.io/tiny-swords (current build: NOT CC0)
- Pinned source: https://github.com/FulAppiOS/Agent-Quest — mirrors the old
  public-domain build ("Update 010, CC0 edition") and ships a real
  `CC0 1.0 LICENSE.txt` alongside it.
- Regenerate with `npx tsx scripts/harvest-cc0.ts`; every harvested file is
  listed in `public/assets/CC0-MANIFEST.md`.

Idle frames were sliced from the animation sheets and auto-trimmed. Field
sprites carry a 1px `#161C2E` halo at alpha 80 so they read against grass.

### How provenance is verified

The post-CC0 build introduced palette entries the public-domain build never
contained, so **exact opaque-colour sets** separate the two: a file carrying a
colour that exists only in the post-CC0 build cannot have come from the CC0 one.
The harvest script asserts this over the whole pack (223 colours across 197 CC0
files) and fails loudly on any sprite that uses a colour outside it.

### Roles

| Role | Source unit |
|---|---|
| fighter | Blue Warrior (idle) |
| rogue | Blue Archer (idle) |
| mystic | Blue Pawn (idle) — stands in for a caster (Tiny Swords has no mage) |
| torch1–4 | Goblin Torch — red / blue / purple / yellow |
| tnt1–4 | Goblin TNT — red / blue / purple / yellow |
| barrel1–4 | Goblin Barrel — red / blue / purple / yellow (idle cell of the 6×6 sheet) |
| torch5 / tnt5 / barrel5 | tier-5 champions — see below, they are **duplicates** |
| grass | Terrain tileset (`Tilemap_Flat`), interior grass tile |
| tree1–3 | Pine, three sway frames of the one tree the CC0 build ships |
| tree4 | Tree stump |
| bush1–2 | Deco 09 / 08 |
| rock1–3 | Deco 04 / 06 / 05 |
| rock4 | Deco 06, mirrored — the CC0 build has only three land rocks |

The enemy path is a dirt lane stroked in the theme's path colour (Tiny Swords
has no seamless dirt tile), so this pack ships no `road.png`.

### The tier-5 "champions" are byte-identical copies, not new art

Five sprite pairs are the **same file**, verified by md5:

| file | md5 | is the same file as |
|---|---|---|
| `torch1.png` | `4ae64a99aa70cb3eafa608ee03c5185a` | `torch5.png` |
| `torch1_walk.png` | `92f6c4bc7458ce1e5bf58abed04d839b` | `torch5_walk.png` |
| `tnt1.png` | `c084b927e9a6fdc990d7a1d2566c4543` | `tnt5.png` |
| `tnt1_walk.png` | `3dfd7b61a5d1b1d5b92da309dafab6a4` | `tnt5_walk.png` |
| `barrel3.png` | `c827bae83d5b48527be4ace708449abd` | `barrel5.png` |

They are **not recoloured** and **not boss-scaled**: the bytes are identical, so
no recolour exists, and the art carries no scale of its own. `torch5` reuses the
tier-1 *red* goblin and `barrel5` reuses the tier-3 *purple* barrel — so each
boss is pixel-for-pixel a trash mob the player has already fought.

Bosses read as large only because `ENEMY_TYPES[id].radius` in
`src/game/data/enemies.ts` is bigger (`torch5` 26 vs `torch1` 11), which the
renderer applies at draw time. The per-enemy `color` there also differs, but it
tints the procedural fallback token, not the sprite.

Distinct champion art is an open art task. Until it exists, do not describe
these as recoloured.

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
