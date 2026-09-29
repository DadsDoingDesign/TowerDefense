# Fieldwatch — Complete Asset Manifest

**Purpose.** This is the exhaustive list of every visual asset the game loads, with the exact
dimensions, frame counts, anchoring rules and file names the engine requires. It exists so a
from-scratch art pack can be produced that drops in with **zero code changes**.

**Why from scratch.** The current pack is Tiny Swords, which is no longer CC0. Its licence reads:
*"You may not redistribute, resell, or repackage the assets, even if the files are modified."*
This repository is public, so every one of those PNGs is a redistribution. **All 45 sprite files
and both FX sheets must be replaced.** The 78-icon atlas is generated from source code in this
repo and is the one raster asset that does *not* need relicensing.

**Status of the numbers below.** Every frame count and **drawn** size in this document was measured
live from the running game via a `drawImage` census, not read off the source files or inferred.
Where a value is computed rather than observed it is marked ⚠.

**The `Sheet px` and `Cell px` columns are the target for the replacement, not a record of the
current files.** Each cell dimension is the measured one rounded **up to the next even number**
(§1.2), and the sheet is that cell times the frame count. 17 of the 25 current sprites are odd on
at least one axis and so differ from the table by a pixel per axis — `rogue_idle.png` is 426 × 79
on disk against the 432 × 80 specified here. Author to the table: because `drawn = ceil(cell/2)`,
even cells reproduce today's drawn sizes exactly, which is why the `Drawn on field` column is
identical either way. Do **not** treat the table as a description of what is in `public/` today.

---

## 0. How to read this file

| Tier | Meaning |
|---|---|
| **T1 — Required** | The game will not render correctly without it. 48 files. |
| **T2 — Strongly recommended** | Fixes a known art gap the audit flagged. Needs no code change. |
| **T3 — Expansion** | New art the game has no slot for yet. Needs a small code hook, noted per item. |

Delivery format for everything: **PNG-32, straight (non-premultiplied) alpha, no colour profile
chunk, no interlacing.** Do not pre-scale, pre-outline, or pre-shadow anything — see §1.

---

## 1. The rules that govern every sprite

These are not style preferences. They are what the renderer does to your files.

### 1.1 The field

The play area is **960 × 560 logical pixels** (`FIELD_W`/`FIELD_H`, `src/game/data/maps.ts:42`).
The canvas backing store *is* that size, image smoothing is off, and every blit happens at 1:1.
Exactly one resample to the device happens at the end, in `src/ui/BattleCanvas.tsx`.

### 1.2 Two pixel densities, and only two

`src/game/render/pixmap.ts` box-filters every sprite (alpha-weighted, in premultiplied space) once
at load, then the renderer blits the result 1:1:

```
cell width  cw = sheetWidth / frames        cell height ch = sheetHeight
rank & file (scale 0.5):   drawn = ceil(cw/2) × ceil(ch/2)
champion    (scale 1.0):   drawn = cw × ch
```

- **Rank and file — author at 2× the on-field size.** Everything except tier-5 enemies.
- **Champions — author at 1× the on-field size.** Tier-5 enemies only (`isBoss: true`).

A champion therefore draws at twice the size of its own line troops *and* carries pixels half
their size. That density split is deliberate — it is what makes a boss read as a boss — and it is
the **only** density split permitted anywhere in the game. Do not introduce a third.

> **Always use even native dimensions.** The `ceil` means an odd `2S−1` also lands on `S`, which
> silently swallows a one-pixel authoring error. Most cells in the current pack are odd on at
> least one axis (`fighter_idle` is 84 × 95 on disk); the tables in §2–§4 have already rounded
> those **up** to even for you, which is why they read 84 × 96. Author the table's number.

### 1.3 Anchoring and trim

`blitPixmap` (`src/game/render/renderer.ts:794`) places every sprite as:

```
dx = round(centreX − frameWidth / 2)
dy = round(baseY   − frameHeight)
```

So: **horizontally centred in the cell, and the cell's bottom edge is the feet line.**

- Trim so the character's feet touch the bottom edge of the cell and the body is centred
  left-to-right.
- **The top ~10 % of every cell must be empty transparent headroom.** The tier plaque and elite
  marks hang off `artTop = round(feet − height) + height × 0.1`, and that `0.1` is hard-coded
  (`renderer.ts:1326`). Fill that band and the plaque draws on top of your character's head.
- Attack frames are taller than idle frames and grow **upward** from the same feet line — that is
  the raised weapon. Keep the feet planted on the bottom edge in every single frame of a strip.
- **Barrels are the one exception:** they are drawn centred (`baseY = height / 2`) because they
  tumble. See §3.3.
- Decorations use the same bottom-edge convention (`renderer.ts:588`).

`radius` in `enemies.ts` is **gameplay only** — hitboxes, splash, blocking. It never sizes a
sprite. Art size comes only from the PNG.

### 1.4 What is generated for you — do not author it

A 1px contour ring is baked under every **unit** sprite automatically: `#1A0F08` at α214 on the
sides and above, `#FFEEC4` at α150 below. The hit-flash (`#FFF6E4`), the damage-over-time ember
(`#FF8A3C`) and the corpse shade (`#170E07`) are all derived from your silhouette via `source-in`.

**Do not draw outlines, rim light, or drop shadows into unit sprites.** Contact shadows are drawn
procedurally as ellipses.

**Decorations and grass get no ring** (`renderer.ts:579`) — trees, rocks and bushes must carry
their own outline or they will float.

### 1.5 The environment grade will change your colours

Every terrain and decoration pixel goes through a full-frame `getImageData` pass before the units
are drawn: saturation × 0.62, contrast × 0.97 around pivot 118, and a warm push of +12 R / +4 G /
−7 B. **Author decorations knowing they will be desaturated and warm-shifted.**

There is also a **reserved gold-hue window at 22°–68°**, where chroma is cut to 0.36. Tier-4
enemies wear that gold as a gameplay signal, so environment art is not allowed to compete for it.
Keep decoration hues out of that band.

### 1.6 Reserved channels (do not spend these on decoration)

The game reserves specific visual channels for information the player must read. Environment and
decoration art may not use them:

| Channel | Reserved for |
|---|---|
| Saturated gold, hue 22°–68° | Tier-4 enemy identity |
| Bright `#FFF6E4` full-silhouette flash | Damage impact |
| `#FF8A3C` ember tint | Burning / damage-over-time |
| Cyan-white overlay | Chilled |
| Rapid high-frequency motion | Stun, swift elites |
| Pure black silhouette mass | Enemy bodies, so they separate from ground |

### 1.7 The size it actually has to survive

Measured live:

| Viewport | UI scale | View scale | Canvas in CSS px |
|---|---|---|---|
| 390 × 844 | normal & large | 0.40625 | 390 × 227.5 |
| 320 × 568 | normal | 0.27677 | 265.7 × 155 |
| 320 × 568 | large | 0.26071 | 250.3 × 146 |
| 320 × 568 | **with first-run coach strip** | **0.174** | **167 × 97** |

A tier-1 goblin is 58 × 40 logical px. That is **23.6 × 16.3 CSS px** at 390 wide, and
**about 10 CSS px tall** in the worst measured case.

> **The silhouette test is the acceptance test.** Fill the sprite solid black, scale it to 10 px
> tall, and put it next to the other fourteen enemies. If you cannot name it, it fails. Detail
> added above that threshold is free polish; detail *instead of* silhouette is wasted work.

### 1.8 Naming and location

The loader looks up files by role name and preloads nothing else. A file that is misnamed does not
warn — it 404s and the role renders as a coloured circle.

```
public/assets/sprites/<packname>/<role>.png
public/assets/sprites/<packname>/<role>_<anim>.png
public/assets/fx/<packname>/<sheet>.png
```

Role names are fixed by `ROLE_NAMES` in `src/game/render/sprites.ts`. Animation names are fixed by
`ANIM_FRAMES` in `src/game/render/anim.ts`. Both are closed lists. Use lowercase, no spaces.

If the new pack is not named `tinyswords`, add its name to `SPRITE_PACKS` and declare its roles in
`PACK_ROLES` in `src/game/render/sprites.ts`, then point `themes.ts` at it. Naming the new pack
something else is the cleaner choice — it removes the last reference to the old licence.

---

## 2. T1 — Towers (9 files)

The three player unit types. The `_idle` and `_atk` strips are what render on the battlefield; the
static PNG is the canvas fallback **and** the DOM roster portrait.

| File | Sheet px | Frames | Cell px | Drawn on field | Notes |
|---|---|---|---|---|---|
| `fighter_idle.png` | 504 × 96 | 6 | 84 × 96 | 42 × 48 | 6 fps loop |
| `fighter_atk.png` | 780 × 120 | 6 | 130 × 120 | 65 × 60 | plays over 0.2 s |
| `rogue_idle.png` | 432 × 80 | 6 | 72 × 80 | 36 × 40 | 6 fps loop |
| `rogue_atk.png` | 704 × 118 | **8** | 88 × 118 | 44 × 59 | plays over 0.2 s |
| `mystic_idle.png` | 384 × 64 | 6 | 64 × 64 | 32 × 32 | 6 fps loop |
| `mystic_atk.png` | 588 × 82 | 6 | 98 × 82 | 49 × 41 | plays over 0.2 s |
| `fighter.png` | 80 × 94 | 1 | — | 40 × 47 ⚠ | also DOM portrait at native |
| `rogue.png` | 64 × 78 | 1 | — | 32 × 39 ⚠ | also DOM portrait at native |
| `mystic.png` | 60 × 62 | 1 | — | 30 × 31 ⚠ | also DOM portrait at native |

⚠ The three static PNGs never render on canvas while the strips exist, so their canvas draw size is
computed rather than observed. **They are not dead files** — they are used at native 1:1 as roster
portraits in `<img class="sh-hero-art">` (`src/ui/shell/offers.ts:225`,
`src/ui/shell/SelectorBand.tsx:97`). Author them to read at both sizes.

### Identity brief

| Role | Colour token | Fantasy | Must read as |
|---|---|---|---|
| `fighter` | `--fighter` | Frontline bruiser; blocks up to 2 enemies at close range | Widest, heaviest silhouette. Grounded stance, shield or brace visible. |
| `rogue` | `--rogue` | Fast long-range strikes, high crit | Narrowest silhouette. Leaning, asymmetric, weapon extended. |
| `mystic` | `--mystic` | Splash magic on impact | Tallest silhouette relative to width. Vertical staff or raised implement. |

The three must be separable **by outline alone** at 10 CSS px, because colour-vision modes re-tint
the hue channel and hue is therefore not a reliable identity signal.

### Animation semantics

- **Idle strips** loop at **6 fps**, with a per-unit phase offset derived from `pos.x × 0.05`, so
  a row of identical heroes does not breathe in lockstep. Design a 6-frame breathing loop that
  reads at 42 px tall.
- **Attack strips** do not loop. `frame = min(frames−1, floor((1 − fireFlash) × frames))` where
  `fireFlash` is set to 1 on fire and decays at 5/s — so the whole strip plays across roughly
  **0.2 s of game time** (≈30 fps for the 6-frame strips, ≈40 fps for `rogue_atk`). Front-load the
  strike: frame 0 is the wind-up, the contact should land by frame 2–3, and the rest is recovery.

---

## 3. T1 — Enemies (25 files)

Three factions × five tiers. The faction is *how it fights*; the tier is *how dangerous it is*.
Both must be readable independently.

### 3.1 The full roster

| Role | Name | Radius | HP | Speed | Damage type resisted |
|---|---|---|---|---|---|
| `torch1` | Torch Runt | 11 | 24 | 146 | — |
| `torch2` | Torch Goblin | 12 | 42 | 134 | — |
| `torch3` | Torch Raider | 13 | 76 | 125 | — |
| `torch4` | Torch Berserker | 15 | 128 | 118 | — |
| `torch5` | **Warlord Grukk** | 26 | 950 | 89 | 15 % physical |
| `tnt1` | Fuse Whelp | 12 | 34 | 103 | — |
| `tnt2` | Bomber | 13 | 60 | 98 | 15 % magic |
| `tnt3` | Demolisher | 14 | 100 | 94 | 20 % magic |
| `tnt4` | Sapper | 16 | 172 | 89 | 25 % magic |
| `tnt5` | **Powderkeg King** | 28 | 1350 | 74 | 25 % magic, 10 % physical |
| `barrel1` | Barrel Imp | 13 | 72 | 74 | 15 % physical |
| `barrel2` | Barrel Roller | 15 | 134 | 70 | 20 % physical |
| `barrel3` | Ironbarrel | 18 | 248 | 65 | 25 % physical |
| `barrel4` | Siege Barrel | 21 | 430 | 60 | 30 % physical |
| `barrel5` | **The Colossus Keg** | 33 | 2600 | 65 | 35 % physical, 15 % magic |

**Faction identity — the player has to make a targeting decision from the silhouette:**

- **Torch** — fast, fragile, no resistance. Lean, upright, running. Fire motif.
- **TNT** — resists *magic*, so send physical. Squat, carrying an explosive charge. Fuse motif.
- **Barrel** — resists *physical*, so send magic. Rolling, armoured, no visible limbs.

**Tier identity.** Tier is already carried by two non-colour channels the art must not duplicate
or contradict: a **notch count** on the tier plaque, and **physical size**. The current pack uses a
colour ramp per tier (`#d0563a` → `#4a86c0` → `#8a5ec0` → `#d4b24a` → deep red) — you may keep, or
replace it with escalating armour/bulk, but tier 4 must occupy the reserved gold band and tiers 1–3
must not.

### 3.2 Torch and TNT — files

| File | Sheet px | Frames | Cell px | Drawn on field |
|---|---|---|---|---|
| `torch1.png` … `torch4.png` | 76 × 82 | 1 | — | 38 × 41 |
| `torch5.png` | 76 × 82 | 1 | — | 76 × 82 (champion) |
| `torch1_walk.png` … `torch4_walk.png` | 696 × 80 | 6 | 116 × 80 | 58 × 40 |
| `torch5_walk.png` | 696 × 80 | 6 | 116 × 80 | **116 × 80** (champion) |
| `tnt1.png` … `tnt4.png` | 88 × 70 | 1 | — | 44 × 35 |
| `tnt5.png` | 88 × 70 | 1 | — | 88 × 70 (champion) |
| `tnt1_walk.png` … `tnt4_walk.png` | 540 × 72 | 6 | 90 × 72 | 45 × 36 |
| `tnt5_walk.png` | 540 × 72 | 6 | 90 × 72 | **90 × 72** (champion) |

**Walk cycles run off the odometer, not the clock.** `STRIDE = 13.5` logical px of ground covered
per frame (`renderer.ts:1487`). At a line goblin's 134 px/s that is about 9.9 fps, but a Swift
elite steps faster and a chilled enemy steps slower, automatically. **Design the cycle as a stride
that covers ground, not as a timed loop** — if the contact frames don't match the stride distance,
every enemy in the game will visibly skate. Each enemy also gets an independent phase offset from
an id hash, plus a vertical bob of `sin(now × 12 + pos.x × 0.3) × 1.4`.

**Tier 5 currently reuses tier 1 art**, byte-identical: `torch5.png ≡ torch1.png`,
`torch5_walk.png ≡ torch1_walk.png`, `tnt5.png ≡ tnt1.png`, `tnt5_walk.png ≡ tnt1_walk.png`. The
champion reads as different only because it draws at 2× size and 2× pixel density. **Nothing in
the code requires this reuse.** A replacement pack should author real champions — Warlord Grukk
and the Powderkeg King are named bosses at 950 and 1350 HP, and they currently look like the
weakest enemy in the game, magnified. This is the single largest art gap in the project.

### 3.3 Barrels — files, and the roll

| File | Sheet px | Frames | Drawn on field |
|---|---|---|---|
| `barrel1.png` … `barrel4.png` | 52 × 72 | 1 | **36 × 36** (squared) |
| `barrel5.png` | 52 × 72 | 1 | **72 × 72** (squared, champion) |

**Barrels have no walk strips and must not be given any.** Instead, `quarterTurns`
(`pixmap.ts:317`) bakes **four poses** from the single static PNG as lossless 90° rotations — no
resampling, no quality loss. The cell is squared to the next even `max(width, height)`, so
52 × 72 → half 26 × 36 → **36 × 36**, and the champion → **72 × 72**.

Consequences for authoring:

- **Author barrel content to fit inside a square of side `max(w, h)`, centred**, because a quarter
  turn swaps the axes. Anything that fits the 52-wide dimension but not the 72-tall one will be
  clipped once the sprite rotates.
- **The design must read correctly at all four cardinal rotations.** No "up" — no face, no crest,
  no text, no lighting that assumes a fixed sun. Banding, rivets and staves are the right
  vocabulary; a painted skull is not.
- These are drawn **centred**, not feet-anchored: `baseY = height / 2`.
- Pose advances as `floor(distance / (radius × 1.6)) % 4`, odometer-driven, so it can never reverse.

`barrel5.png` is currently byte-identical to `barrel3.png` (note: barrel *3*, not barrel 1). Same
recommendation as above — The Colossus Keg is a 2600 HP boss and deserves its own art.

### 3.4 Elite variants — no new files, but a real constraint

Three elite prefixes wrap any base enemy (`ENEMY_MODS`, `enemies.ts:126`), producing 60 registry
entries from the 15 base types. **They reuse the base sprite** and are distinguished by a
procedurally drawn mark on the tier plaque:

| Prefix | Mark drawn | Meaning |
|---|---|---|
| **Plated** | Shield, tapered at 0.58 | Extra physical armour |
| **Warded** | Diamond | Extra magic resistance |
| **Swift** | Double chevron | Higher speed |

You do not author these marks. But you must **leave the plaque band clear** (§1.3) and keep the
base silhouette clean enough that a 1.15 CSS px chevron laid near it is still discriminable. The
plaque enforces its own minimum sizes — `NOTCH_MIN_CSS = 1.7`, `MARK_FEATURE_MIN_CSS = 1.15` — and
derives its width from them, so it will grow rather than shrink. Assume it will occupy that band.

---

## 4. T1 — Terrain and decorations (11 files)

### 4.1 Grass

| File | Sheet px | Drawn |
|---|---|---|
| `grass.png` | 64 × 64 | **32 × 32 repeating pattern** |

Must **tile seamlessly at 32 × 32 after the ½ downsample**, not at 64 × 64 before it. Check the
seam on the baked output, not the source. It is then multiplied by `rgba(0,0,0,0.06)` and overlaid
with procedural blobs, tufts and flowers (§6), so keep it low-contrast and low-frequency — a busy
grass tile fights the procedural layer and destroys enemy readability.

### 4.2 Road — deliberately absent

There is no `road.png`. The entire lane is procedural (§6). Supplying one activates a dormant code
branch, replacing only the middle fill pass with a tiled pattern. **Do not author one unless you
intend to change `drawSpriteTerrain`.**

### 4.3 Decorations

No ring is baked under these. **Author your own outline.**

| File | Sheet px | Drawn | Pool |
|---|---|---|---|
| `tree1.png` | 114 × 176 | 57 × 88 | framing tree |
| `tree2.png` | 108 × 176 | 54 × 88 | framing tree |
| `tree3.png` | 112 × 174 | 56 × 87 | framing tree |
| `tree4.png` | 38 × 32 | 19 × 16 | ground litter |
| `rock1.png` | 22 × 20 | 11 × 10 | ground litter |
| `rock2.png` | 46 × 36 | 23 × 18 | ground litter |
| `rock3.png` | 32 × 24 | 16 × 12 | ground litter |
| `rock4.png` | 46 × 36 | 23 × 18 | ground litter |
| `bush1.png` | 64 × 44 | 32 × 22 | ground litter |
| `bush2.png` | 44 × 34 | 22 × 17 | ground litter |

**Two hard gates, applied to the measured drawn height — not the filename** (`renderer.ts:350`):

- `DECO_CEIL = 96` — anything that draws taller than 96 logical px is **silently dropped from the
  pool**. A native height above 192 disappears with no warning.
- `DECO_TREE_MIN = 40` — splits framing trees from ground litter.

**Keep at least one role in each band** or the layout degrades. Note that `tree4` is in the *litter*
band despite its name.

Decoration art is subject to the environment grade (§1.5) and must stay out of the gold window.

---

## 5. T1 — Effect sheets (2 files)

Only two FX assets are art. Everything else in `fx.ts` is procedural.

| Role | File | Sheet px | Frames | Cell px | Drawn | fps | Lifetime |
|---|---|---|---|---|---|---|---|
| `FX_EXPLOSION` | `fx/<pack>/explosions.png` | 1728 × 192 | 9 | 192 × 192 | 96 × 96 | 18 | 0.5 s |
| `FX_FIRE` | `fx/<pack>/fire.png` | 896 × 128 | 7 | 128 × 128 | 64 × 64 | 12 | 0.583 s |

Square cells, single horizontal row, baked at scale 0.5 like everything else. Both are additive-
feeling but composited normally — bake the glow into the frames.

**Six files in the current `fx/tinyswords/` folder are never referenced** and should not be
re-commissioned: `arrow` (64 × 128), `bridge` (192 × 256), `dead` (896 × 256), `dynamite`
(384 × 64), `foam` (1536 × 192), `water` (64 × 64).

---

## 6. Reference — what is already procedural (author nothing)

Listed so the art agent does not produce assets the engine will never load. All of this is Canvas
2D drawing code today.

| System | Implementation summary |
|---|---|
| **Road** | Three stroked passes over the raw polyline, widths hard-coded in `drawSpriteTerrain` (`renderer.ts:250`): edge `#3c2c18` at 50 px, fill `#7a5a30` at 40 px, worn centre at 20 px. Round joins and caps. |
| **Road detail** | Specks sampled every 10 px at 85 % chance, ±15 px off the normal, r 1.2–3.2, α0.5; paired ruts at ±7; edge tufts at ±17, 34 % per side. |
| **Grass overlay** | 28 radial blobs r 58–174 at α0.36→0; 128 candidate tufts (rejected within 24 px of the path) height 3.0–6.4; 22 flowers r 1.6 in `#f2ead0 #e8cf55 #e07ba0 #eaf2f6`. Seeded `mulberry32`, deterministic per map. |
| **Environment grade** | Full `getImageData` pass — see §1.5. |
| **Vignette** | Radial from (480, 280) r196 → r691.2, transparent → `rgba(0,0,0,0.22)`, baked once. Plus a per-frame `overlay` warm grade at α0.06. |
| **Contact shadows** | Ellipses. Enemy `(0, r×0.7, r×0.9, r×0.35)` α0.3; tower `(0, 13, 14, 5)` α0.32; deco `(x, y−2, w×0.34, w×0.14)` α0.20. |
| **Palisade gate (base HP)** | 7 planks, step 9, span 54. Planks removed **centre-outward**, one per 1/7 of base HP, and **one always remains**. Body `#6b4526`/`#7a5230` alternating, highlight `rgba(255,232,190,0.26)`, braces `#4a2d18`. |
| **Build-slot rings** | `arc(r=20)`, dashed `[4,5]`, lw 2. Hover `#f0a868`, selected `#98c1d9`, empty `rgba(255,255,255,0.16)`. Setup phase only. |
| **Range and aura rings** | Fill accent α0.06, stroke accent α0.35. Auras dashed `[6,8]`, pulsing α0.10–0.20. |
| **HP bars** | Height 4, radius 2. `#7ac74f` above 50 %, `#e6b800` above 25 %, `#e05a4f` below. |
| **Tier plaque and elite marks** | See §3.4. |
| **Damage floaters** | `bold Npx system-ui`, stroke `rgba(24,14,7,0.88)` then fill. Normal 13 px/1.15 s, crit 19 px/1.45 s, word 15 px/1.55 s. Pop 1.5× → 1.0× over 90 ms. Cap 36 on screen. |
| **Particles** | 7 kinds, pool of 420. SPARK, DUST, EMBER, CHUNK, RING, SMOKE are fully procedural; only SHEET reads art (§5). |
| **Projectiles** | 3-step velocity tail, contour + core + specular. Muzzle flash procedural. |
| **Proc rings** | Four — shock, burn, execute, stun — all drawn. |
| **Screenshake** | Translation only, `SHAKE_MAX_PX = 7`. |
| **Wave banners and all HUD chrome** | DOM, not canvas. Nothing is drawn on the canvas for these. |

Two dead knobs, so nobody wastes time on them: `themes.path.edgeWidth`/`fillWidth` are ignored by
`drawSpriteTerrain`, and `SpriteConfig.towerScale`/`enemyScale` are marked `@deprecated` and read
by nothing.

---

## 7. T1 — The icon atlas (1 file, 78 icons)

| File | Sheet px | Grid | Cell px |
|---|---|---|---|
| `public/assets/ui/fw-icons.png` | **128 × 160** | **8 cols × 10 rows** | **16 × 16** |

Position is `ix = index % 8`, `iy = floor(index / 8)`; CSS offset `(−ix × 16px, −iy × 16px)`.
80 cells for 78 icons, so **cells (6,9) and (7,9) are unused** — pixel rects (96,144)–(111,159) and
(112,144)–(127,159).

> **This file is generated, not harvested.** `scripts/fw-icons.ts` holds all 78 icons as 16 × 16
> ASCII palette grids in this repository, and `npm run build` fails if the PNG, `ICON_ORDER` and
> the CSS tokens ever disagree. **It carries no third-party licence and does not need replacing.**
> Redraw it only if you want a different look — and if you do, edit the ASCII grids in that script
> rather than the PNG, or the build guard will reject it.

### 7.1 Sizes every icon must survive

**Every icon renders at exactly 16 × 16 or 32 × 32 CSS px — identical at 390 and 320 wide, and
identical at normal and Large UI.** `global.css:296` deliberately excludes icons from the type
ramp, because a fractional scale combined with `image-rendering: pixelated` drops whole columns.
Nothing anywhere overrides the size — verified by grep across the repo.

| Render site | Size |
|---|---|
| Pack tile — shape | 32 × 32 |
| Pack tile — damage mark | 16 × 16 |
| Gear slot mark | 16 × 16 |
| Menu row — icon | 32 × 32 |
| Menu row — mark | 16 × 16 |
| Offer card — body | 16 × 16 |
| Offer card — warning | 16 × 16 |
| Hero trait tile | 32 × 32 |
| Coach strip | 16 × 16 |
| Header chips (gold, dust, threat, HP) | 16 × 16 |
| Base integrity | 16 × 16 |
| Map node threat | 16 × 16 |

At device pixel ratio 2, a 16 px icon becomes 32 × 32 device px (4× the source) and a 32 px icon
becomes 64 × 64 (8×). Both are integer multiples and `image-rendering: pixelated` is confirmed
computed on every one. **So: author at 16 × 16, and design for legibility at 16 CSS px.** That is
the floor, and it is where this project has failed before.

### 7.2 The 78 keys, in atlas order

**Row 0 — status A:** `burn` `chill` `shock` `stun` `execute` `lifedrain` `crit` `splash`
**Row 1 — status B:** `block` `thorns` `pierce` `armour` `damage` `range` `haste` `hp`
**Row 2 — status C:** `auraHeal` `auraBuff` `auraShield` `trap` `sacrifice` `projectile` `patience` `curse`
**Row 3 — weapons:** `blade` `dagger` `axe` `wand` `sceptre` `greatblade` `hammer` `bow`
**Row 4 — weapons, off-hands, bodies:** `staff` `grimoire` `shield` `quiver` `orb` `plate` `cloth` `banner`
**Row 5 — keepsakes, damage marks, currencies:** `relic` `beacon` `phys` `magic` `gold` `dust` `marks` `keepsake`
**Row 6 — places and events:** `shrine` `forge` `merchant` `recruit` `wave` `boss` `evolve` `mutate`
**Row 7 — system marks:** `threat` `base` `depth` `back` `soundOn` `soundOff` `settings` `warn`
**Row 8 — polarity and mirrors:** `boon` `loot` `slow` `weaken` `assist` `equip` `deploy` `frail`
**Row 9 — remaining polarity mirrors:** `shorten` `drag` `shrink` `nocrit` `blunt` `auraWeaken`

### 7.3 The polarity rule

Rows 8 and 9 exist because a sign is information. `−45 % attack speed` and `+20 % attack speed` used
to render the same picture, so every two-handed weapon in the game advertised itself with a
speed-line. Ten concepts carry a sign, and each has a **mirror** icon:

| Positive | Negative mirror | Concept |
|---|---|---|
| `haste` | `drag` | attack speed |
| `damage` | `blunt` | damage |
| `hp` | `frail` | health |
| `range` | `shorten` | range |
| `splash` | `shrink` | splash radius |
| `crit` | `nocrit` | crit |
| `auraBuff` | `auraWeaken` | ally buff |
| `boon` | `curse` | polarity in general |
| `armour` | `weaken` | defence |
| `assist` | `slow` | tempo help/hindrance |

**A mirror pair must be readable as the same object with an opposite sign** — the same shape with a
downward arrow, a break, a crack — not two unrelated pictures. If the pair does not read as a pair,
the channel does not work.

### 7.4 The 26 item nouns → 18 icons

Item art is derived from the item's *name*, and 26 nouns compress onto 18 drawn shapes. This is
deliberate: a Buckler and a Shield are the same silhouette at 16 px.

| Icon | Nouns it serves |
|---|---|
| `blade` | Sword |
| `greatblade` | Greatsword |
| `axe` | Axe |
| `dagger` | Dagger |
| `wand` | Wand, Rod |
| `sceptre` | Scepter, Sceptre |
| `hammer` | Warhammer |
| `bow` | Bow |
| `staff` | Staff |
| `grimoire` | Grimoire, Tome |
| `shield` | Shield, Buckler |
| `quiver` | Quiver |
| `orb` | Focus |
| `plate` | Plate, Mail, Aegis |
| `cloth` | Robe, Cloak |
| `banner` | Banner, Standard |
| `relic` | Relic, Oath |
| `beacon` | Beacon |

Slot fallbacks for hand-built items: `oneHand → blade`, `twoHand → greatblade`, `offHand → shield`,
`body → plate`.

### 7.5 Rarity — art is additive, never the only channel

Five rarities, each already carrying **two colour-free channels** — an initial letter and a pip
count — plus a hue. Any art you add must be **additive to those**, never a replacement:

| Rarity | Initial | Pips | Hue | Enchants | Drop weight |
|---|---|---|---|---|---|
| Common | C | 1 | `#c3b291` | 0 | 56 |
| Rare | R | 2 | `#5fb0c4` | 1 | 28 |
| Epic | E | 3 | `#c67ab0` | 2 | 11 |
| Legendary | L | 4 | `#f0b868` | 3 | 4 |
| Mythic | M | 5 | `#ef6a3a` | 4 | 1 |

---

## 8. T1 — UI chrome (currently 1 live file, 4 total)

`public/assets/ui/` holds 68 PNGs totalling 94,903 bytes. **63 of them are orphaned — 90.3 % by
bytes.** Note the two directories below: `fw-icons.png` sits at the `ui/` root, but all four
9-slice panels live one level down in **`public/assets/ui/tinyswords/`**. Deliver to the exact
path in the table — a file at the wrong one 404s silently (§1.8). Confirmed independently by the build's own reachability pass: `dist/sw.js` precaches
exactly five files. Orphans include all 30 `icon_*`, all 6 `pointer_*`, 6 `banner_*`, 3 `ribbon_*`,
3 `pickup_*`, 3 `carved_*` and 10 `button_*`. **Do not re-commission any of them.**

| File | Dims | Used by | 9-slice |
|---|---|---|---|
| `ui/fw-icons.png` | 128 × 160 | `.fw-i` (`global.css:318`) | — |
| `ui/tinyswords/paper_special_9.png` | 110 × 110 | `.overlay-card` (`app.css:383`) | slice 46, 22 px border, `fill`, no stretch |
| `ui/tinyswords/paper_regular_9.png` ⚠ | 110 × 110 | `.hp-card` (`legacy.css:1845`) | slice 46, 20 px border |
| `ui/tinyswords/btn_big_blue_9.png` ⚠ | 110 × 110 | `.hp-cta`, `.overlay-btn` (`legacy.css:1871`) | slice 46, 15 px border |
| `ui/tinyswords/woodtable_9.png` ⚠ | 110 × 110 | `.crossroads .cr-col` (`legacy.css:1879`) | slice 46, 26 px border |

⚠ The three `legacy.css` files load **only** under `?shell=0`, which is documented as unsupported.
**In the shipping shell only `fw-icons.png` and `paper_special_9.png` are live.** Replace those two
first; the other three only if `?shell=0` is being kept.

All four 9-slices share **slice 46 on a 110 px source**: corners 46 × 46, edge strips 18 px wide,
centre patch 18 × 18 with `fill`. Pure CSS — no JS constants to update. If you author at a
different size, the `border-image-slice` values in the CSS must change to match.

---

## 9. T1/T2 — Key art, app icons, marketing

### 9.1 Main-menu art block — **currently empty**

`.pg-art` (`src/ui/shell/PageScreens.tsx:412`, styled at `src/styles/page.css:624`) holds no image at all today, just a radial-gradient
placeholder. It is `flex: 1 0 0`, so its height depends on whether the lifetime-records row is
present:

| Config | Fresh install (CSS / device px) | With records (CSS / device px) |
|---|---|---|
| 390 normal | 358 × 330 / **716 × 661** | 358 × 266 / 716 × 533 |
| 390 large | 358 × 310 / 716 × 620 | 358 × 242 / 716 × 484 |
| 320 normal | 288 × 196 / 576 × 393 | 288 × 132 / 576 × 265 |
| 320 large | 288 × 176 / 576 × 352 | 288 × 120 / **576 × 240** |

Width is fixed per viewport (716 device px at 390, 576 at 320). Height ranges from 330 down to 120
CSS px — an aspect range of **1.08:1 to 2.40:1**.

> **Author one asset at 720 × 664 device px and let it crop** (`object-fit: cover`), never fit.
> Compose so the subject survives a centre crop down to a 2.4:1 letterbox. ⚠ At 320 wide with Large
> UI and records present it sits exactly on its `min-height: 120px` floor — there is no slack.

This is the highest-value single art asset in the project: it is the first thing every player sees
and the slot is currently empty.

### 9.2 App icons — all present and correct

Five files, five references, zero orphans, zero declared/actual mismatches. Generated by
`scripts/icons.ts` from one inline SVG (padding 0.12 for `any`, 0.22 for maskable, 0.16 for Apple).

| Reference | File | Size |
|---|---|---|
| `<link rel="icon">` | inline `data:image/svg+xml`, `viewBox 0 0 32 32` | — |
| `apple-touch-icon` ⚠ no `sizes` attribute | `public/icons/apple-touch-icon.png` | 180 × 180 |
| manifest `any` | `icons/icon-192.png` | 192 × 192 |
| manifest `any` | `icons/icon-512.png` | 512 × 512 |
| manifest `maskable` | `icons/icon-192-maskable.png` | 192 × 192 |
| manifest `maskable` | `icons/icon-512-maskable.png` | 512 × 512 |

**T2 gap: there is no raster favicon.** No 16/32/48 px PNG and no `.ico` exists — desktop browser
tabs get only the inline SVG. Add `favicon.ico` containing 16, 32 and 48 px frames.

### 9.3 Social preview — **completely absent (T2)**

A repo-wide grep for `og:image`, `og:title`, `twitter:image` and `twitter:card` returns **zero
matches**. There is no `og:` namespace at all, so every shared link renders with no preview card.

Author **1200 × 630** into `public/` and add the meta tags. Design and approve it at **120 × 45 px**
— that is the size it is actually judged at in a feed. Genre plus title must read there, and it must
not be a screenshot with a logo stamped on it.

---

## 10. T3 — Expansion assets (need a code hook)

The game currently has no slot for any of these. Each is listed with what it would take to wire it.
Ordered by value per unit of work.

### 10.1 Archetype branch emblems — 9 assets

**Recommended over doing all 27.** The specialisation tree is 3 archetypes → 9 tier-1 branches →
27 tier-2 specs. Authoring 27 distinct hero sprites is the obvious ask and the wrong one: nine
branch emblems inherited by their three children costs a third as much and produces the same
in-play read, because the player picks the *branch* and then refines within it.

| Archetype | Tier-1 branch | Tier-2 specs that inherit the emblem |
|---|---|---|
| Fighter | **Warrior** | Berserker, Juggernaut, Weaponmaster |
| Fighter | **Knight** | Bulwark, Vanguard, Sentinel of Order |
| Fighter | **Guard** | Aegis, Warden of Ash, Bannerman |
| Rogue | **Assassin** | Deathdealer, Nightblade, Reaper |
| Rogue | **Trickster** | Saboteur, Venomancer, Hexblade |
| Rogue | **Marksman** | Sharpshooter, Ranger, Arbalest |
| Mystic | **Elementalist** | Pyromancer, Cryomancer, Stormcaller |
| Mystic | **Cleric** | Radiant, Templar, Oracle |
| Mystic | **Warlock** | Soulflay, Plaguebringer, Doomcaller |

*Hook:* a `specArt` field on the tree nodes plus a render site on the hero panel and tree nodes.
*Format:* 32 × 32 emblems fit the existing icon pipeline; 64 × 64 badges if they get their own slot.

**Ambitious version:** 9 full tower sprite sets (idle + attack strips at the §2 dimensions), so a
specialised hero visibly changes on the battlefield. That is 18 strips and the single largest
optional job in this document.

### 10.2 Run-map node art — 7 assets

Node types (`src/game/data/runmap.ts`): `start`, `battle`, `elite`, `merchant`, `shrine`,
`recruit`, `boss`. Currently drawn as generic shapes with a 16 px icon. Icons already exist for
`merchant`, `shrine`, `recruit` and `boss`.

*Hook:* node art field in the map renderer. *Format:* 48 × 48 or 64 × 64.

### 10.3 Mutation art — 11 assets

`Volatile Rounds` · `Chain Arc` · `Piercing Volley` · `Rapid Fire` · `Heavy Ordnance` ·
`Incendiary` · `Cryo Blast` · `Executioner` · `Siphon` · `Overcharge` · `Concussive`

These are offered three-at-a-time as a choice at the mid-map crossroads, which is one of the
highest-stakes decisions in a run and is currently all text. *Format:* 32 × 32 or 48 × 48 cards.

### 10.4 Curse art — 5 assets

`Reckless` · `Frenzied` · `Wild` · `Erratic` · `Vengeful`

The three most punishing items in the game. They already have the `curse` and `nocrit` icons; a
distinct mark per curse would help players learn them. *Format:* 16 × 16, fits the atlas' 2 free
cells plus 3 more if a row is added — note that adding a row moves every cell, and the build guard
will catch it, but `ICON_ROWS` and the CSS token must be updated together.

### 10.5 Second map identity — variable

Two maps exist: **The Green Line** and **The Kiln Road**. They currently share one decoration pool
and one grass tile, so they look identical. A second terrain set — a kiln/ash `grass.png` variant
plus 4–6 decorations — would make the second map feel like a place.

*Hook:* per-map pack or decoration-pool selection in `themes.ts`/`maps.ts`.

### 10.6 Wave and event banners — 8 labels

`Patrol` · `Swarm` · `Bombard` · `Column` (normal); `Plated Column` · `Warded Host` · `Swift Raid`
(elite); `The Powder Court` (boss). All DOM text today. Banner art would need a DOM image slot,
which is cheap.

### 10.7 Enchant marks — 16 + 5 keepsake suffixes

Enchants: `of Might` `of Precision` `of Insight` `of Reach` `of Patience` `Cruel` `Ruinous`
`Bursting` `Heavy` `Swift` `Flaming` `Frost` `Shocking` `Piercing` `Vampiric` `Executioner`.
Keepsake suffixes: `of Rallying` `of Haste` `of Focus` `of the Hunt` `of Ruin`.

Every one of these already resolves to an existing atlas icon through the effect-classification
table. **This is the lowest-priority item in the document** — it is already solved well enough, and
21 more icons is real cost for marginal gain.

---

## 11. Delivery checklist

### File manifest — T1, 48 files (45 sprites + 2 FX + 1 UI panel)

```
public/assets/sprites/<pack>/
  fighter.png  fighter_idle.png  fighter_atk.png
  rogue.png    rogue_idle.png    rogue_atk.png
  mystic.png   mystic_idle.png   mystic_atk.png
  torch1.png  torch2.png  torch3.png  torch4.png  torch5.png
  torch1_walk.png  torch2_walk.png  torch3_walk.png  torch4_walk.png  torch5_walk.png
  tnt1.png  tnt2.png  tnt3.png  tnt4.png  tnt5.png
  tnt1_walk.png  tnt2_walk.png  tnt3_walk.png  tnt4_walk.png  tnt5_walk.png
  barrel1.png  barrel2.png  barrel3.png  barrel4.png  barrel5.png
  grass.png
  tree1.png  tree2.png  tree3.png  tree4.png
  rock1.png  rock2.png  rock3.png  rock4.png
  bush1.png  bush2.png

public/assets/fx/<pack>/
  explosions.png  fire.png

public/assets/ui/tinyswords/
  paper_special_9.png
```

Plus `fw-icons.png`, which already exists and is licence-clean.

### Acceptance gates

1. **Silhouette.** All 15 enemies filled solid black at 10 CSS px tall — each nameable, none
   confusable with another faction.
2. **Density.** Exactly two pixel densities in the whole pack. No sprite rotated off-axis. No
   non-integer scaling anywhere.
3. **Even dimensions.** Every cell width and height is even.
4. **Headroom.** Top 10 % of every unit cell fully transparent.
5. **Feet line.** Bottom row of every unit cell contains the feet, in every frame of every strip.
6. **Barrel rotation.** Each barrel read at 0°, 90°, 180° and 270° — no implied "up".
7. **Stride.** Walk cycle contact frames match `STRIDE = 13.5` logical px per frame with no skate.
8. **Deco gates.** Every decoration's *drawn* height under 96; at least one role above 40 and at
   least one below.
9. **Grass seam.** Tiles cleanly at 32 × 32 *after* the ½ bake.
10. **Gold band.** No environment or decoration art in hue 22°–68° at saturation.
11. **No baked outlines or shadows** on unit sprites.
12. **Icons at 16.** Every icon legible at 16 CSS px, and every polarity pair reads as a pair.
13. **Licence.** Provenance recorded for every file. `npm run build` passes, including the icon
    atlas guard.

### Files that are generated, not authored

Do not hand-edit these; they are rebuilt by scripts and will be overwritten:

- `public/assets/sprites/tinyswords@half/` (46 PNGs) — produced by `scripts/prep-sprites.ts` and
  **never read at runtime**; the browser bake replaces it. Its dimensions are *not* a valid
  authoring reference — `tree1` is 59 × 90 there versus the 57 × 88 the renderer actually produces.
- `public/assets/deco/` (18 files) — entirely orphaned.
- The five non-`tinyswords` sprite packs (60 PNGs at 32 × 32) — unreachable; no theme picker exists.
- `public/icons/*` — generated by `scripts/icons.ts` from an inline SVG.
- `public/assets/ui/fw-icons.png` — generated by `scripts/fw-icons.ts` from ASCII grids.

---

## 12. Source of truth

Every enumeration in this document is generated from code, and code wins if they ever disagree:

| Fact | File |
|---|---|
| Role names the loader accepts | `src/game/render/sprites.ts` — `ROLE_NAMES`, `PACK_ROLES` |
| Animation names and frame counts | `src/game/render/anim.ts` — `ANIM_FRAMES` |
| Downsample, ring baking, barrel quarter-turns | `src/game/render/pixmap.ts` |
| Anchoring, deco gates, plaque minimums, stride | `src/game/render/renderer.ts` |
| Pack selection and scale | `src/game/render/themes.ts` |
| Field dimensions and map list | `src/game/data/maps.ts` |
| Enemy roster, radii, elite prefixes | `src/game/data/enemies.ts` |
| Item nouns, rarities, enchants, curses | `src/game/data/items.ts` |
| Archetypes, branches, specs | `src/game/data/archetypeTree.ts` |
| Icon keys, grid, noun and effect mapping | `src/ui/channels.ts` |
| Icon atlas generation and build guard | `scripts/fw-icons.ts` |
| Particle kinds and FX sheet definitions | `src/game/render/fx.ts` |
| Icon render sizes | `src/ui/styles/global.css` |
