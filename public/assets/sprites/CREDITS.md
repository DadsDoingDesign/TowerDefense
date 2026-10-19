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
> A web game serves its PNGs as loose, downloadable files, which is exactly the
> "repackage" case, and this repository was public for most of its history. Pixel Frog was
> asked about a public GitHub starter kit and declined. Keep the current build out
> entirely, private repo or not.
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

## `scenes/` — the stops on the road and the liaisons' posts (composed from the CC0 build)

`public/assets/scenes/{merchant,campfire,shrine,recruit}.png` and the five
companies' posts, `public/assets/scenes/liaison-{spice,art,metals,silk,scrolls}.png`
(Draft 4 · D), are composed by
`scripts/stop-scenes.ts` from the **old CC0 build** of Tiny Swords, read from the
same verified upstream as `harvest-cc0.ts` (`FulAppiOS/Agent-Quest`, which ships
the build under a real CC0 1.0 LICENSE.txt): terrain tiles (the flat ground,
whose sand the script re-inks as trodden earth, and the elevation cliff for
Ironvein's quarry), the water rocks, pines, the house and
the tower, pawns (idle and carrying), warriors, the archer, the fire, the wood
pile, deco. The stall, tents, standing stones, altar, flagstones, hearth,
spit and pot, bedroll, crates, barrels, rack of arms, helm, shield, straw man
and candles — and, at the liaisons' posts, the spice sacks, chilies and chili
field, brazier, easel and canvases, canal, stone counter, ore, anvil, forge,
adit, rails and ore cart, river, hung silk and bolts, loom, reeds, scroll rack
and ledger — are drawn by the script in the pack's palette
and ink; each post's standard is the game's own company standard
(`src/game/data/companyStandard.ts`); the night, dusk
and firelight are its own. The scenes live outside the `*tinyswords` folders on
purpose: their drawn props and lighting carry colours the palette check would
(rightly) not find in the pack.

The HQ's castle, `public/assets/scenes/hq-castle-{timber,stone,fortified,grand}.png`
(the HQ pass, Oct 2026: one sheet per quality tier, the scene and every part
at every level), is composed by `scripts/hq-keep.ts` from the same old CC0
build and upstream: the Knights' castle (Blue), re-inked pixel for pixel by
light in each tier's material; the Knights' pawn and archer; the flat
ground's grass and sand (re-inked as earth), pines and deco. The great hall,
lookout, tents, rack of arms, crates, barrels, pallets, stakes and pennant
poles are drawn by the script in the pack's palette and ink. Nothing comes
from `BuildingsCustom/` (unverified provenance, never harvested) or the
current, non-CC0 download.

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

### The goblin clans (`tinyswords/<clan>_*.png`, Oct 2026)

The 75 clan strips — `cinder_`, `smudge_`, `delve_`, `silkcut_`, `hexmoon_`
× `torch1..5_walk`, `tnt1..5_walk`, `barrel1..5` — are **derived** files, baked
by `scripts/enemy-clans.ts` from the plain old-CC0 goblins above. The bake cuts
the parts a clan replaces (the torch's flame, the bomber's dynamite, the keg's
fuse and stencil) and lays on ORIGINAL pixel parts drawn in this repository
(`scripts/enemy-clans-art.ts`: crests, helmets, hats, horns, weapons, packs,
caps, mantles), snapped to colours the pack already ships — so they pass the
CC0 palette test (`harvest-cc0.ts --check`; offline twin in
`tests/clans.test.ts`). Nothing comes from the current Tiny Swords download.
Each clan's champion (tier 5) now carries its own boss look: the open art task
above is answered per clan, while the plain bench champions stay as noted.
