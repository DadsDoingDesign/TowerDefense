# Our own characters — the hero builder (prototype)

The heroes today are the one CC0 Tiny Swords knight, with his painted weapon and
shield cut out and our gear pasted in. This is the replacement, as a design
and a working prototype: **our own modular hero**, built like a component. A
hero is data (`HeroLook`); gear maps to parts; state edits the parts; one pure
compositor draws the frames.

**The rig is not in the shipped game yet.** It lives in
`src/game/render/hero/` and is drawn only by `harness/heroes.html`. The
company faces' DOCK figures (`mini.ts`) ship: they stand in the home dock's
slots in place of the crests (October 2026, `ui/shell/DockFace.tsx`; see
"The dock figures").

| Sheet | What it shows |
|---|---|
| `lineup.png` | The five peoples in their base kit beside the CC0 tower, goblins and the shipped knight, 1× and 3× |
| `parts-map.png` | The rig with its anchors, the draw order, and one frame exploded layer by layer |
| `swaps.png` | One human across twelve kits; one kit on all five peoples; one hire in each company's livery |
| `states.png` | Rarity, level tiers, skill tells and status effects on one hero |
| `animation.png` | Idle, walk, attack, hit and cheer for every people |
| `faces.png` | The five company faces, hand-drawn at each size the game shows them (field / post, dock), beside the CC0 pawn, knight and goblin |
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
| Outline | `#161c2e`; its most common outer run is 2 px (median 3), inner lines 2 | each piece ringed 2 px (1 px for small features); nothing added outside (round 3: the extra outer px made ours 4) |
| Shading | 3 tones per material + white specular dashes; bands, never dither; hand-laid strands in hair | `palette.ts` ramps, in clean bands, plus a hand-laid rim (the upper-left edge a step lighter, the lower-right a step darker) and strands on hair, scarves and beards |
| Light | from the upper left (the helmets' and the pawns' hair highlights) | the same (`raster.ts` `LIGHT`) |
| Proportion | chibi: the head is the widest mass (the pawn: a 58 px head over a 43 px body); small round fists at the hips; thin dark legs | the same; per-people numbers in `rig.RACE_BODY` (round 3: torsos narrower, fists smaller, legs thin and dark) |
| Colours per figure | 7–9 | the builder's 17–24 before round 3; fewer since (no streak noise) |
| Ground | ink ellipse at alpha 80 | the same |
| Frames | idle 6 (the game loops it at 6 fps); attack 6 (the archer 8) | idle 6 at 6 fps, walk 6 at 10 fps, attack 6 timed slow wind-up / fast strike, hit 3, cheer 4 |

**The light** (round 3) is from the upper left, as the skill says and as the
pack's helmets and hair show on a closer look; round 1 had read the knights as
lit from the top on their facing side.

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
| Human | 20.5 × 19 | 11.5 × 20 | 7.5 | the baseline |
| Elf | 18 × 20 | 9.5 × 23 | 11 | taller, slimmer, a pointed chin, long ears |
| Dwarf | 21.5 × 18 | 15.5 × 17 | 3.5 | short and broad, a beard over the chest |
| Reptilian | 19 × 17 | 11.5 × 22 | 8 | a snout, a tail, a crest or a frill |
| Gnome | 23 × 21 | 9.5 × 14 | 3.5 | small, the biggest head, a big nose |

**3/4 view, never mirrored.** The skull is an asymmetric union: the cranium
bulges toward the back, the face is the narrower front, and a cheek and a nose
break the front silhouette. Nothing is drawn by mirroring one half.

**Arms are two bones** (round 3): shoulder, upper arm, elbow, forearm, and the
fist on the forearm's own line (`parts.elbowOf`: the elbow bends back and
down; a reach past both bones straightens the arm). The far arm, behind the
body, is slimmer and a step darker. A resting fist hangs at mid-thigh. A
wind-up passes the near arm and its weapon BEHIND the head (`Pose.behind`): a
chibi arm cannot reach over its own head, so it never rises across the face.

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

Each company's liaison (`faces.ts` holds their briefs). Saffra, Odile and
Brannoch are the liaisons `src/game/data/liaisons.ts` already voices. **Hask
and Wren are proposals**; `liaisons.ts` is untouched.

**Drawn by hand, once per size the game shows them** (round 3; the designer:
the small hand-made figures read, the magnified rig does not). They are fixed
people with no gear swaps, so they do not need the rig to look right:

| Size | Where it shows | Cell | Module |
|---|---|---|---|
| field / post | the battlefield and the liaison post, both at the pack's unit scale (the post stands the person where the CC0 pawn stands, at native size; the page draws the scene at 2×) | 72 × 72, feet on row 57 | `post.ts` |
| dock | the home dock's slot (drawn at 2×) | 24 × 28 | `mini.ts` |

Both are pixel rows in the pack's inks, named parts, each ringed in 1 px of
ink; the field / post size adds one more px round the whole figure (the
pack's 2 px outer line) and the pack's small dark eyes (2 × 3, never a white
disc). Both run on one clock (`spriteAt`): a face moves in step with itself at
both sizes, out of step with the other four. The heroes' portrait bust
(`heroPortrait.ts`) is a crop of a hero's figure, not of a liaison, so there
is no third size for the faces today. The rig stays for the heroes, whose
gear swaps; it is only ever meant to be drawn 1:1, and its cards say they are
magnified for critique.

The posts in the cards are the shipped posts' layouts with the face at the
counter: `npx tsx scripts/stop-scenes.ts --faces <dir>` (only into <dir>;
nothing shipped changes).

| | Saffra | Odile | Brannoch | Hask (proposal) | Wren (proposal) |
|---|---|---|---|---|---|
| Company | Peppercorn, broker | Rosethread, mercer | Ironvein, factor | Butcherblock (`art` slot), salter | Greenvial (`scrolls` slot), herbalist |
| Who | Came up selling pepper off a cart in the farm towns whose fields burn every summer; buys the smoke-singed sacks cheap | Buys bolts at the river-forest looms, sells them at the fords for twice the weight in coin | Counts the ore carts out of the quarry halls and back in, and has named every one | Works the smokehouses on the salt marsh's reed channels, weighing hides and salting the catch | Tends the glasshouses in the mushroom hollows and bottles whatever glows there |
| Want / worry | The price before it turns / a wagon gone to smoke | Every coin the road can pay / a pulled thread | Every cart home whole / a cart in the ditch | The meat delivered fresh / rot, and the salt running out | The rare cuttings home whole / a cracked vial, and what spills |
| Temperament | brisk, hot-tempered, generous | smooth, warm, calculating | gruff, terse, secretly sentimental | patient, cold-eyed, oddly courteous | quiet, patient, unsettlingly cheerful |
| Tic | weighs her pepper sack in her hand (it sinks, never rises), grins | smooths the silk at her waist, eyes half shut | lifts the slate and chalks a cart home | a slow blink of his slit eyes, a tail swish | holds a vial out to the side, in the light |
| Silhouette | lean + angular | tall + tapering, a long ear out sideways | squat + square | low + long: flat snout, thick tail | round + tall: a huge sprouting hat |
| Prop | a burlap pepper sack (a balance reads as a crossbow at both sizes) | bolt of cream silk, a rose ribbon round it | chalked tally slate | a butcher's J hook | glowing green vial at his side |
| Idle (shape, period) | quick bob, 0.83 s | slow breath, 1.57 s | weight shift side to side, 2.21 s | sway + tail swish, 1.93 s | bob, the hat's sprout lagging, 1.31 s |
| Reaction (slot picked) | a hop and a wink | a half-bow, eyes shut | one curt nod | twirls the hook | dips, then lifts the vial |

**Round 2 rules for every face** (the designer's notes, applied to all five and
the builder):

- **Nothing at the mouth, ever.** No mouths are drawn; the shoulders sit below
  the chin and the near sleeve is clipped there; a resting hand is held clear
  of the face; a bow rests low; the hook hangs; the flask is held by its neck
  below the hand. `tests/heroBuilder.test.ts` "nothing at the mouth" checks a
  zone from the eyes to the chin and past the face's front on every frame of
  every face (idle, walk, tic, react, hit, cheer) and of every people × five
  kits (idle, walk, hit, cheer). The pouch-sniff and the forked tongue are
  gone.
- **The people read at 1×.** Reptilian: a flat wide snout, nostril, heavy brow
  over a gold slit eye, a two-tone ridge, a lipless mouth line, a thick tail,
  teal scales. Gnome: a big round nose, a white beard, a rosy cheek (field),
  a small round body. Elf: a long ear out sideways, over the hair.
- **Motion varies.** Five idle shapes at five prime periods (829, 1571, 2213,
  1933, 1307 ms); tics every 5.3 / 7.1 / 6.7 / 5.9 / 7.7 s at a hashed phase
  (`ticPhase`), so in the first twelve seconds no two tics start within 0.6 s
  and nobody is mid-tic when the home opens. Tested; the card is
  `motion-desync`.

**Why the two proposals.** Vell, Easel House's fussy curator, does not fit
hides and salt, so Butcherblock gets a new face. Wren, Moonquill's quiet and
slightly ominous archivist, suits a herbalist who knows every poison, so
Greenvial keeps the name with a new trade.

## The dock figures

`mini.ts`. The faces are **redrawn** for the dock, not downscaled: hand-drawn
pixel parts in a 24 × 28 cell, shown at 2× (the crests' own pixel scale), so
the 1 px ring reads as the field figures' 2 px.

- **Idle:** each face's own shape and period (the table above), from 4
  frames (Saffra) to 11 (Brannoch).
- **Tic:** 6 frames, on the face's own interval and hashed phase.
- **Reaction:** 4 frames when the slot is picked, each in its own style.
- **The clock:** `miniAt(id, t, { pickedAt, still, ticEach })` says which
  frame shows at time `t`; the dock runs one rAF for all five
  (`DockFace.tsx`), its `t` counted from the moment the dock appears.
- **Drawn for the slot:** the company colour is the biggest mass (Odile's
  tunic is rose, her cloak plum behind); one prop each, low and away from the
  face; hands attached to their sleeves.
- **Locked:** the figure as a navy shadow inside its ink. A shape change, not
  only a colour (the slot's padlock and label still say it).
- **Motion budget:** atmosphere, not a show. Under reduced motion
  (`fxQuality` 'off') only the still pose shows and no loop runs; on Light
  the tic plays half as often (`ticEach: 2`, every other one on the same
  phase); the loop sleeps while the page is hidden. A locked figure is
  still and never reacts.

**The figure is decorative.** It sits in the slot's `aria-hidden` crest span;
the slot's accessible name (`slotName`) still carries the company and its
standing. The reaction plays on `aria-pressed` turning true, so it follows
the same state the focus ring does.

**Shipped (October 2026), +16 px per slot.** The designer approved the mock
("The home dock, with the faces", "Crests → faces", "The dock in motion").
`.mn-slot` grows from 76 to 92 px on a phone (60 → 76 on a short phone,
64 → 80 on a desk) and its picture row from 32 to 48 px; the figure is drawn
at 2× everywhere (a desk's 80 px slot has no room for 3×). The map window
loses 16 px, and its height still depends on the viewport alone
(`scripts/home-stability.mjs`). Which face stands in which slot is one table,
`ui/shell/dockFace.ts` `DOCK_FACE`: Hask in Easel House's slot and Wren in
Moonquill's lead the companies' rename. Cards:
`docs/ui-audit-2026-10/dock-faces/` (`node scripts/dock-faces.mjs`).

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
