# Our own characters — the hero builder (prototype)

The heroes today are the one CC0 Tiny Swords knight, with his painted weapon and
shield cut out and our gear pasted in. This is the replacement, as a design
and a working prototype: **our own modular hero**, built like a component. A
hero is data (`HeroLook`); gear maps to parts; state edits the parts; one pure
compositor draws the frames.

**Nothing in the shipped game uses it yet.** It lives in
`src/game/render/hero/` and is drawn only by `harness/heroes.html`.

| Sheet | What it shows |
|---|---|
| `lineup.png` | The five peoples in their base kit beside the CC0 tower, goblins and the shipped knight, 1× and 3× |
| `parts-map.png` | The rig with its anchors, the draw order, and one frame exploded layer by layer |
| `swaps.png` | One human across twelve kits; one kit on all five peoples; one hire in each company's livery |
| `states.png` | Rarity, level tiers, skill tells and status effects on one hero |
| `animation.png` | Idle, walk, attack, hit and cheer for every people |
| `faces.png` | The five company faces: field, bust and dock sizes |
| `dock-mock.png` | The real home at 390 × 844 with the faces in the dock |
| `cards/` | One ~600 px card per idea for the phone review board, with `manifest.json` |

Regenerate: `npx vite --port 5257 --strictPort &`, then `node scripts/hero-sheets.mjs`
and `node scripts/hero-dock.mjs docs/characters/dock-mock.png /tmp/before.png`.

## The house style, measured

All measured off the old CC0 build (`Warrior_Blue`, `Pawn_Blue`, `Archer_Blue`,
the torch and TNT goblins, the tower and house).

| | The pack | The builder |
|---|---|---|
| Cell | 192 px; the figure ~60–80 wide, 60–95 tall, feet on y 136 | 176 px cell; figures 61–82 tall, feet on y 138 |
| Outline | `#161c2e`; 2 px between parts, 2–3 px outside | each piece ringed 2 px (1 px for small features), plus 1 px round the whole figure |
| Shading | 3 tones per material + white specular dashes; bands, never dither | `palette.ts` ramps: shade · mid · light · specular, solved per pixel from the shape, quantised to those tones |
| Light | from the top, toward the side the figure faces (knights face right: lit right, shaded on the back edge and the bottom) | the same, one constant (`raster.ts` `LIGHT`) |
| Proportion | chibi: head ≈ the body below it; mitten fists; stub feet | the same; per-people numbers in `rig.RACE_BODY` |
| Ground | ink ellipse at alpha 80 | the same |
| Frames | idle 6 (the game loops it at 6 fps); attack 6 (the archer 8) | idle 6 at 6 fps, walk 6 at 10 fps, attack 6 timed slow wind-up / fast strike, hit 3, cheer 4 |

**One rule we did not follow, on purpose:** the character-design skill says "light
from the upper left". The pack's own knights are lit from the top on the side
they face (right). We follow the pack so our heroes sit with its art. It is one
constant; say the word and it flips.

## The rig

One skeleton for every people. Per frame of each animation it gives anchors in
the cell: `head`, `torso`, `hips`, `back`, `mainHand`, `offHand`, `footBack` and
`footFront`, plus the two shoulders the arms hang from. Each anchor has x, y,
an angle and a facing. A hand's angle is the direction "up the held item"
points. Parts never place themselves by hand; they read anchors and the torso
and head boxes.

The peoples differ by **body numbers only**, inside shared limits
(`RACE_LIMITS`, tested), so every part fits every people:

| People | Head (half w × h) | Torso (half w × h) | Legs | What else |
|---|---|---|---|---|
| Human | 20.5 × 19 | 15.5 × 21.5 | 8.5 | the baseline |
| Elf | 18 × 20 | 13 × 25 | 12 | taller, slimmer, a pointed chin, long ears |
| Dwarf | 21.5 × 18 | 20.5 × 18 | 3.5 | short and broad, a beard over the chest |
| Reptilian | 19 × 17 | 15.5 × 23 | 8.5 | a snout, a tail, a crest or a frill |
| Gnome | 23 × 21 | 12 × 14.5 | 3.5 | small, the biggest head, a big nose |

**3/4 view, never mirrored.** The skull is an asymmetric union: the cranium
bulges toward the back, the face is the narrower front, and a cheek and a nose
break the front silhouette. Nothing is drawn by mirroring one half.

**Hands are real parts.** Each arm is a sleeve plus a fist on its anchor, and
the held item is drawn in that hand's frame. The fist is re-stamped over its
grip, so the fingers close over the handle. A two-hander puts the off fist on
the shaft, a bow puts it on the string, and twin blades put a blade in each
hand. Nothing floats at a fixed point, and no second fist shows.

**Motions.** The attack is one of four motions, chosen by what the main hand
holds:

- **swing:** blades, axes, hammers, bare fists;
- **thrust:** spears and polearms (the hands slide back along the shaft at the thrust);
- **shoot:** bows (the off hand draws the string to its anchor);
- **cast:** wands, staffs and books.

Swings stop at the ground: a blade never buries its tip below the feet.

## Parts as components

Each slot is a layer, drawn in this fixed order (tested). Each layer is a list
of pieces, and each piece is inked by its own ring, so a part in front is
outlined against what is behind it.

| # | Layer | Anchor | What can occupy it | What state does to it |
|---|---|---|---|---|
| 1 | back | `back` | cape (from the level tier, or a cloak), quiver, javelins, Banner Bearer's pennant | level tier: none → short → long → long with a trimmed hem and clasp; Banner Bearer: a pennant; a fine cloak's rarity: a gold hem |
| 2 | off-hand arm | `offHand` | sleeve + fist | the fist closes over a held grip |
| 3 | legs & boots | `hips`, feet | the legs, the boots | slowed: frosted boots |
| 4 | body | `torso` | the people's torso (and a reptilian's tail) | — |
| 5 | body armour | the torso box | mail · padded · leather · brigandine · plate (+ pauldrons) · robe · apron · cloak's capelet · vest · scale · belt | rarity (plate): a gold trim |
| 6 | head | `head` | the race face: ears, beard, snout, nose, eyes, mouth | expression per frame; stunned: spiral eyes; wounded: a plaster |
| 7 | hair / headgear | `head` | the hair variant, or the hood a body piece brings | — |
| 8 | main-hand arm | `mainHand` | sleeve (mail and plate sleeves match the armour) + fist | re-stamped over the grip |
| 9 | main-hand item | `mainHand` (its angle) | every weapon family, the trade props | rarity: guard and pommel iron → steel → gold, a gem from rare up, a glow on mythic; burn / frost / venom: the blade's ink |
| 10 | off-hand item | `offHand` | shields, orb, tome, pouch, flask, off dagger, the trade props | rarity, as the main hand |
| 11 | FX | any | the swing's smear, a thrust's lines, a loosed arrow, spell sparks | skill tells (flames, frost, venom drip, sparks, rage, Keen Eye's lens, bloom); status (hasted, slowed, stunned, buffed, wounded) |

**The spec:**

```ts
HeroLook {
  race, head?, hair?, skin?, hairInk?,
  palette?: { cloth, trim, metal, leather, pants },   // ramp ids
  company?,                                           // a livery: swaps cloth + trim
  gear?: { main, off, body },                         // item names
  state?: { rarity: { main, off, body }, level, skills, status, wounded },
  persona?, posture?,                                 // the company faces
}
```

- `composeFrame(look, anim, frame)` is pure.
- `composeStrip(look, anim)` caches per spec, whatever the key order.

**Gear maps to parts.** Every roster item (100) has its own part: a family
(sword, axe, maul, spear, bow, staff, kite shield, mail, robe …) and its
knobs (size, blade and haft inks, trim, cloth, glow, variant, emblem), in
`look.ts` `ITEMS`. A name with no part takes a keyword family
("Mystery Blade" → sword), else its slot's generic part (a plain blade, a
plain round shield, a padded jerkin). A missing piece never leaves a hole
(tested).

**State edits the right layer only.** `STATE_LAYERS` lists the layers each
state may touch; the tests compose every state against its base and fail if
any other layer changes. A company livery swaps inks, never shapes (tested).

## The company faces

Each company's liaison, given a body on the rig (`faces.ts`). Saffra, Odile
and Brannoch are the liaisons `src/game/data/liaisons.ts` already voices.
**Hask and Wren are proposals**; `liaisons.ts` is untouched.

| | Saffra | Odile | Brannoch | Hask (proposal) | Wren (proposal) |
|---|---|---|---|---|---|
| Company | Peppercorn, broker | Rosethread, mercer | Ironvein, factor | Butcherblock (`art` slot), salter | Greenvial (`scrolls` slot), herbalist |
| Who | Came up selling pepper off a cart in the farm towns whose fields burn every summer; buys the smoke-singed sacks cheap | Buys bolts at the river-forest looms, sells them at the fords for twice the weight in coin | Counts the ore carts out of the quarry halls and back in, and has named every one | Works the smokehouses on the salt marsh's reed channels, weighing hides and salting the catch | Tends the glasshouses in the mushroom hollows and bottles whatever glows there |
| Want / worry | The price before it turns / a wagon gone to smoke | Every coin the road can pay / a pulled thread | Every cart home whole / a cart in the ditch | The meat delivered fresh / rot, and the salt running out | The rare cuttings home whole / a cracked vial, and what spills |
| Temperament | brisk, hot-tempered, generous | smooth, warm, calculating | gruff, terse, secretly sentimental | patient, cold-eyed, oddly courteous | quiet, patient, unsettlingly cheerful |
| Tic | sniffs her spice pouch, eyes shut | smooths the silk on her arm | taps the tally slate twice | tastes the air with a forked tongue | holds a vial up to the light |
| Silhouette | lean + angular | tall + tapering | squat + square | low + hooked | round + tufted |
| Prop | brass spice scale, pouch of pepper | bolt of cream satin | chalked tally slate | meat hook, sack of marsh salt | glowing green vial |
| Posture / tempo | leans in; brisk 6-frame idle | rocks back; slow 8-frame breath | planted; still | hunched; slow sway | still |
| Reaction (slot picked) | points and winks | a half-bow | one curt nod | touches the hook to his brow, tastes the air | lifts the vial |

**Why the two proposals.** Vell, Easel House's fussy curator, does not fit
hides and salt, so Butcherblock gets a new face. Wren, Moonquill's quiet and
slightly ominous archivist, suits a herbalist who knows every poison, so
Greenvial keeps the name with a new trade.

## The dock figures

`mini.ts`. The faces are **redrawn** for the dock, not downscaled: hand-drawn
pixel parts in a 24 × 28 cell, shown at 2× (the crests' own pixel scale), so
the 1 px ring reads as the field figures' 2 px.

- **Idle:** 4 frames at 320 ms, a 1 px breath.
- **Tic:** 4–6 frames, every 5–8 s per face, never constant.
- **Reaction:** 4 frames when the slot is picked.
- **Locked:** the figure as a navy shadow inside its ink. A shape change, not
  only a colour (the slot's padlock and label still say it).
- **Motion budget:** atmosphere, not a show. Under reduced motion only the
  still pose plays; on Light the tic plays half as often (to wire with
  `fxQuality`).

**The figure is decorative.** It sits in the slot's `aria-hidden` crest span;
the slot's accessible name (`slotName`) still carries the company and its
standing. The reaction plays on `aria-pressed` turning true, so it follows
the same state the focus ring does.

**Needed for the dock: +16 px per slot.** The figure is 48 px tall, the crest
box 32. The mock grows `.mn-slot` from 76 to 92 px and `.mn-slot-crest` from
32 to 48 px. The map window loses 16 px, but its height still depends on the
viewport alone (the home's "no wiggle" rule holds). This is the designer's
call.

## Migrating the shipped knight to the builder

What changes:

1. **`units.heroFigure`** composes from `HeroLook` instead of cutting the
   knight. The game's `HeroGear` maps to `gear` (item kind → roster name, or
   via a kind → family table), rarity and level come from the hero, and
   `burningKills`, statuses and skills come from the engine state already
   passed to `drawSentinel`. The strip is a new pixmap per (look, anim).
   `gearMarks.ts`, `bodyLayer.ts`, the anchor scripts and the cuts retire.
2. **The portraits** (`heroPortrait.ts`): the bust is the same crop of the
   composed figure, so the shell keeps reading `offers.heroLookArt`.
3. **The attack** plays the motion's 6 frames on `fireFlash`, as the knight's
   strip does. The fist and item are part of the frame, so `drawHeldGear`
   goes.
4. **The hire's people and company** come from the city that hired them, and
   become a `race` and a `company` on the hero (a save field, validated in
   `runSnapshot.ts`, fuzzed).
5. **Precache:** nothing to preload. The art is code, drawn on first use and
   cached.

The risks:

- **Draw cost.** About 4–12 ms per frame to compose in node today (more under
  load). Fine as a cache filled once per hero and animation (~30 frames), but
  not per draw. On a slow phone, warm the cache at hire time or in idle
  slices.
- **The cell is bigger.** The figure is drawn 1:1, so the battle's hero
  footprint grows (a 176 px cell against the knight's 84 × 95 strip).
  Selection rings, plaque and HP-bar anchors want re-measuring (`CLAN_ART`
  style).
- **Shield-bearers hide their capes.** A level tier on a hero with a kite
  shield barely shows (`states.png`). The tier needs a second channel
  (pauldron trim, a plume) before it can carry meaning.
- **Old saves** have no people. They load as humans of the hiring company:
  a migration, not a crash.
- **The look drifts from the art direction**, now that it is code. The fit,
  draw-order, state-layer, palette and fallback tests guard the mechanics, not
  the taste. Keep the review loop.

## Credits

All hero, face and dock art is original, drawn by `src/game/render/hero/`. The
tower, goblins and knight in the sheets are the CC0 Tiny Swords build, from the
verified cache `harvest-cc0.ts` keeps. The ramps are the pack's colours, plus
one new tone (the tan skin's mid, `#eaa98a`).
