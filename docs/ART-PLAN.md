# Fieldwatch — Art Production Plan

**Companion to `docs/ASSET-LIST.md`.** That document is the *spec* — what the engine
requires. This one is the *plan* — the style, the order, and the system that lets gear
show up on the heroes without drawing 1,080 sprites.

Decisions recorded here: **Storybook Chunk at uniform density**, **full three-slot paper
doll plus effect layers**, **vertical slice first, with one hero shown across several
loadouts.**

---

## 1. The pixel budget — read this before choosing a size

The brief was "higher pixel density so we can put in more detail". The engine makes that
one knob, not two, and it is worth being exact about why.

### 1.1 Where the pixels actually go

The field composites offscreen at exactly **960 × 560** logical px, then blits once to the
device. On the shipping phone (390 CSS wide, dpr 2) that final blit is
`dpr × view = 0.8125` — measured, and called out in `BattleCanvas.tsx:883`. So:

```
sprite logical px  ──  × 0.8125  ──▶  device px  ──  ÷ dpr  ──▶  CSS px
     42 × 48                            34 × 39                  17 × 19.5
```

**A hero is 34 × 39 device pixels.** That is the entire budget. Authoring the same hero at
4× and letting the box filter bring it down does not add one pixel of detail — `pixmap.ts`
bakes it to 42 × 48 logical at load, and the final blit then discards a further 19%.

> **Detail and on-field size are the same knob.** The only way to put more real information
> into a hero is to let it cover more device pixels, which means drawing it larger on the
> field. There is no resolution trick that avoids this.

### 1.2 The good news: art size is free of gameplay

`radius` in `enemies.ts` drives hitboxes, splash and blocking. **It never sizes a sprite**
(`ASSET-LIST.md` §1.3) — art size comes only from the PNG. So growing the sprites moves no
path, no build slot, no tower coverage and no enemy travel time.

This is the opposite of the option the Phase-3 audit rejected. That one proposed resizing
the *field* to 780 × 662 to make the blit land on 1.0, which would have moved the path and
the slots — "a balance change wearing an art fix's clothes" (`BattleCanvas.tsx:898`).
Growing the *sprites* has none of that exposure. It is a pure art change.

### 1.3 Go to one density, at `spriteScale: 1`

`PixmapOpts.scale` is the literal union `0.5 | 1`, deliberately — `0.75` would silently box
down to `0.5` and hand back a two-thirds-size sprite with no error. Today rank-and-file bake
at `0.5` and tier-5 champions at `1`, and the whole game reads through one theme knob,
`style.sprites.spriteScale`.

**Set it to `1` and author every sprite at its true on-field size.** Two things follow:

1. **The artist authors exactly what the player sees.** No box filter deciding which of your
   pixels survive. Even at an identical drawn size this is a visible sharpness gain — it
   removes the half-pixel mush that currently softens every edge.
2. **One pixel size across the whole game.** Right now a boss carries pixels half the size of
   its own trash mobs. The doc frames that split as deliberate, and it does make a boss read
   as a boss — but the *size* is what does that work, not the pixel density. Uniform density
   is the pixel-art-correct choice and it stops bosses looking like they came from a
   different game.

Under one density, size differences come from the authored dimensions alone. You pick each
sprite's on-field size directly, in pixels, with nothing in between.

### 1.4 Recommended sizes

**Grow units by 1.5×; hold decorations where they are.**

| Sprite | Drawn today | Author at (new) | Device px on a 390 phone |
|---|---|---|---|
| Hero idle | 42 × 48 | **64 × 72** | 52 × 58 |
| Hero attack | 65 × 60 | **98 × 90** | 80 × 73 |
| Goblin tier 1–4 walk | 58 × 40 | **88 × 60** | 71 × 49 |
| Goblin tier 5 (boss) | 116 × 80 | **148 × 102** | 120 × 83 |
| Barrel tier 1–4 | 36 × 36 | **54 × 54** | 44 × 44 |
| Trees (framing) | 57 × 88 | **57 × 88** (unchanged) | 46 × 71 |
| Rocks, bushes | 11 × 10 … 32 × 22 | unchanged | — |

1.5× gives **2.25× the pixel area** — enough to carry a face, a belt, a weapon read — without
doubling the on-field footprint. Going the full 2× (straight `0.5 → 1` on today's files) makes
a hero 17% of field height and crowds the lane.

Bosses grow less than 1.5× on purpose: they were already double-size, and the *ratio* to line
troops is what sells them. At the numbers above a boss is still ~1.7× its own tier-1.

> ⚠️ **`DECO_CEIL = 96` is a silent trap.** Any decoration whose *drawn* height exceeds 96
> logical px is dropped from the pool with no warning (`renderer.ts:373`). At
> `spriteScale: 1` the halving stops, so today's `tree1.png` at 113 × 176 native would draw
> at 176 and **vanish**. Every decoration must be re-authored at its drawn size, ≤ 96 tall.
> Keep at least one role above `DECO_TREE_MIN = 40` and one below, or the layout degrades.

### 1.5 What this costs

Bake memory rises with the square of the size change: roughly **4×** from dropping the
halving, then ×2.25 for the 1.5× growth on units — and every unit sprite also carries a ring
canvas of equal size. Measure before committing to the full roster; the walk strips
(10 × 690 × 80 today) dominate. If it bites, the lever is strip length, not sprite size.

---

## 2. Style: Storybook Chunk

`BRAND.md` already fixes the palette and the mood — *warm, storybook, medieval; no cool
blue-grey chrome; teal is the one bright interactive colour, gold is for value*. The sprites
inherit that. What follows is only the drawing treatment.

### 2.1 The rules

- **Proportion: 2.5-head chibi.** Big head, wide shoulders, planted feet, mitten hands. At
  52 device px tall a realistic 6-head figure gives you ~8 px of face; a 2.5-head gives ~20.
- **One light source, top-left.** Consistent across every sprite in the game. Two shading
  levels per material: shadow and midtone, plus a highlight only on metal and skin.
- **Hue-shift, never darken.** Shadows shift warm-red toward `#5A2E18`; highlights shift
  toward `#F3E7D0` (the brand cream). Never mix black into a colour — the ground is already
  warm-dark and a neutral shadow reads as a hole.
- **4–5 colours per material, ≤ 14 per character.** Materials: skin, cloth, leather, metal,
  accent.
- **No dithering on units.** It becomes crawling noise the moment the sprite moves, and the
  0.8125 blit will chew it. Dithering is allowed on terrain and large decorations only.
- **No baked outlines, rim light or drop shadows.** The engine bakes a 1px contour ring under
  every unit (`#1A0F08` α214 sides/top, `#FFEEC4` α150 below) and draws contact shadows as
  ellipses. Drawing your own doubles them.
- **Decorations get no ring** (`renderer.ts:579`) and must carry their own outline.
- **Stay out of hue 22°–68° at saturation.** That gold band is reserved for tier-4 enemy
  identity, and the environment grade already cuts chroma to 0.36 inside it.

### 2.2 Silhouette is still the acceptance test

Even at 1.5×, the game's own gate applies: fill the sprite solid black, scale to 10 px tall,
line it up with the other fourteen enemies. If you cannot name it, it fails — before any
colour goes down. More pixels buy detail *on top of* a working silhouette; they never
substitute for one.

The three heroes must separate **by outline alone**, because colour-vision modes re-tint the
hue channel:

| Role | Silhouette job |
|---|---|
| `fighter` | Widest and heaviest. Grounded stance, visible brace or shield line. |
| `rogue` | Narrowest. Leaning, asymmetric, weapon extended past the body. |
| `mystic` | Tallest relative to width. Strong vertical — staff or raised implement. |

---

## 3. The gear system

The ask: everything equippable shows on the hero, plus the effects and boosts you add. Base
stats stay invisible. Three slots — `mainHand`, `offHand`, `body` — and any hero can equip
any item.

### 3.1 Why the naive version is impossible, and the way out

3 heroes × 11 weapons × 6 off-hands × 5 bodies = **1,080 full sprite sets**, each 6 idle +
6–8 attack frames. Not a real option.

**You never pre-render the matrix. You composite the handful actually equipped, on demand,
and cache them.** A run has three heroes wearing one loadout each — so ~3 live composites,
re-baked only when the player equips something. The matrix never exists.

### 3.2 Composite before the bake — the one rule that matters

The contour ring is generated **inside** `pixmap()` (`pixmap.ts:291`), by dilating each
cell's silhouette. So:

- **Wrong:** blit body, then blit sword on top at draw time. Each layer goes through
  `pixmap()` separately and gets *its own* ring. The sword ends up outlined against the
  hand that holds it — the classic sticker look.
- **Right:** composite body + gear into one offscreen canvas at native resolution, across
  the whole strip, then pass that composite through `pixmap()` **once**. One silhouette, one
  unified ring, and the hit-flash, DoT ember and corpse shade — all derived by `source-in`
  from the silhouette — pick up the gear for free.

```
body strip ─┐
weapon strip ─┼─▶ composite canvas (native, full strip) ─▶ pixmap({scale:1, ring:true}) ─▶ cache
off-hand ─┤                                                        │
body overlay ─┘                                          key: archetype|main|off|body
```

`pixmap()` already caches per source image in a `WeakMap`, so a composite canvas is a
first-class input — it needs no change to accept one. The new code is the compositor and its
loadout-keyed cache, not a rewrite.

### 3.3 Anchors, and the rotation constraint

Gear has to move with the animation, so every frame needs an attach point.

**Rotation is not available.** Acceptance gate 2 forbids off-axis rotation — it resamples and
destroys pixel purity. Only 90° turns are lossless (which is exactly why barrels use
`quarterTurns`). So a weapon cannot simply be rotated to follow a swing.

**The fix is a shared angle vocabulary.** Define five poses, and animate all three heroes'
arms to hit those same five angles:

| Pose | Used by |
|---|---|
| `rest` | idle frames 0–5 |
| `raise` | attack frame 0 (wind-up) |
| `strike` | attack frames 1–2 (contact) |
| `extend` | attack frame 3 |
| `recover` | attack frames 4–7 |

Each weapon is authored once as a 5-cell strip. **11 weapons × 5 poses = 55 small cells** —
and a sword cell is maybe 14 × 44 px. This is the discipline that makes the doll cheap: the
cost is per-weapon, not per weapon-per-hero-per-frame.

**Author anchors as a layer, not a spreadsheet.** Alongside each hero strip, ship
`<role>_<anim>_anchors.png` at identical dimensions, empty except for one marker pixel per
frame: pure magenta `#FF00FF` at the main-hand point, pure cyan `#00FFFF` at the off-hand
point. A build script reads it and emits JSON. The artist positions hands in Aseprite by
drawing, which is the only way they will stay correct through revisions.

### 3.4 What each slot contributes

| Slot | How it reads | Cost |
|---|---|---|
| **mainHand** | Breaks the body outline — the strongest channel at this size. 11 weapons × 5 poses. | 55 cells |
| **offHand** | Shield/buckler/quiver/focus/tome. Silhouette on the opposite side; 5 poses each. | ~30 cells |
| **body** | Pauldron + hem **shape**, not torso texture. Texture is invisible at 52 px; a changed outline is not. Needs a per-archetype version — three torso widths. | 5 × 3 = 15 sets |

**Body armour is the weakest return on the field and the strongest in the roster portrait**,
which renders the static PNG at native 1:1 in `<img class="sh-hero-art">`. Author body items
for the portrait first and accept that on the battlefield they contribute a pauldron
silhouette and little else.

### 3.5 Effects and boosts — draw almost none of them

Enchants (`Flaming`, `Frost`, `Shocking`, `Vampiric`, …), mutations and auras should be
**procedural, anchored to gear**, not authored art. The engine already reserves the channels
and owns the particle system: 7 particle kinds in a pool of 420, plus proc rings for shock,
burn, execute and stun.

| Effect | Treatment |
|---|---|
| Flaming / Incendiary | `#FF8A3C` ember particles emitted from the weapon-tip anchor |
| Frost / Cryo | cyan-white overlay on the weapon layer only |
| Shocking / Chain Arc | existing shock proc ring, origin moved to the weapon tip |
| Vampiric / Siphon | `lifedrain` tint pulse on the composite silhouette |
| Rarity | a rim tint on the **gear layer only**, from the `RARITY` colours |

This costs one extra anchor — the weapon tip — and no new PNGs. It also keeps `§1.6`'s
reserved channels honest: effects stay in the channels the player is already trained to read.

> **Rarity stays additive.** Rarity already carries an initial letter and a pip count.
> Per `ASSET-LIST.md` §7.5, art may add to those, never replace them — colour alone must
> never be the only signal.

### 3.6 Total gear budget

**~100 small cells and 15 body sets**, against 1,080 sprite sets for the naive approach.
The compositor and anchor rig are the real work; the art volume is modest.

---

## 4. Order of work

Ordered to retire risk first. Everything must be replaced anyway — the licence forces it —
so sequence by uncertainty, not by tier.

### Phase 0 — Engine prep *(code, no art)*
1. `spriteScale: 1` in `themes.ts`; re-author or re-export decorations ≤ 96 drawn height.
2. Anchor-strip build script → JSON.
3. Loadout compositor + cache, in front of `pixmap()`.
4. Extend `drawSentinel` to take a loadout key.

Do this before art, so the first sprite drawn is drawn into the real pipeline.

### Phase 1 — Style bible + vertical slice ← **the chosen probe**
One fighter (6 idle + 6 attack), one goblin, one tree, one 9-slice panel, four icons — and
the fighter shown across **four loadouts with two effects active**. Rendered together at real
size, at 390 and 320, through the actual draw code.

This tests three things at once: the style holds across contexts; sprites and parchment UI
read as one game; and the doll rig survives an equip swap. Everything after this is volume.

**Gate: do not proceed until the slice passes `DESIGN_REVIEW.md`.**

### Phase 2 — Heroes and gear
Three hero bodies (idle + attack + portrait), then the 5-pose weapon strips, then off-hands,
then body overlays. Weapons before off-hands: they carry the read.

### Phase 3 — Enemies
**Bosses first.** `torch5`, `tnt5` and `barrel5` are byte-identical to `torch1`, `tnt1` and
`barrel3` today — three named bosses at 950, 1350 and 2600 HP wearing trash-mob art. That is
the largest single art gap in the project and the cheapest big win.
Then tiers 1–4 across all three factions, authored as a family so the tier ramp reads.
**Gate: all 15 silhouettes at 10 px, each nameable.**

### Phase 4 — Environment
Grass (must tile seamlessly at its *baked* size), then the ten decorations. Low-contrast and
low-frequency — a busy grass tile fights the procedural blob/tuft/flower layer and destroys
enemy readability.

### Phase 5 — UI, icons, key art
`paper_special_9.png` (the one live 9-slice in the shipping shell), then the main-menu art
block, then the social preview and the raster favicon.

> **The menu art block is the highest-value single asset in the project** and the slot is
> empty today — `.pg-art` (`src/ui/shell/PageScreens.tsx:412`) is a radial-gradient
> placeholder. Author one asset at **720 × 664** and let `object-fit: cover` crop it;
> compose so the subject survives a centre crop to 2.4:1.

---

## 5. Acceptance gates

Inherits all thirteen gates in `ASSET-LIST.md` §11, with three amendments and three additions.

**Amended**
- *Density* — now **exactly one** density across the whole pack, at `spriteScale: 1`. Any
  second density is a bug.
- *Even dimensions* — still even, but now authored at true on-field size.
- *Deco gates* — drawn height ≤ 96 is now the **authored** height. Verify per file.

**New**
1. **Composite ring.** A geared hero shows **one** contour ring around the assembled figure.
   Any ring visible between hand and weapon means the composite ran after the bake.
2. **Anchor drift.** Play all 6 idle and all 8 attack frames with the longest weapon
   equipped. The grip must not slide, and the weapon must not clip the body.
3. **Loadout legibility.** Four loadouts side by side at 390 CSS px. A player must be able to
   tell them apart at a glance — if they cannot, the gear channel is decorative and the
   silhouette work is not done.
