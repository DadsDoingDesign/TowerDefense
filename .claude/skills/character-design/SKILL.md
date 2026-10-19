---
name: character-design
description: Design a character for the Merchant Mercenaries world (a company's face, a hero, a keeper, a raider) so that who they are shows in how they look and move. Use whenever you create or rework any person, creature or mascot drawn in the game, its parts or animations, or the review cards the designer reads on a phone.
---

# Character design: part of the world, a person on sight

A character in this game is someone the world produced, not a sprite with a
palette swap. If a reader can't tell from the art alone which people, which
trade and what kind of person this is, the design isn't done. Work through
the steps in order and don't skip the critique.

## 1. Place them in the world

Every character has a home row in the world bible (Claude Doc "Peoples &
Trades — world bible"; the roster is in `docs/peoples/roster.json`). Five peoples,
five trades, five roads:

| Company (id) | People | Trade | Land | Fights by | World look |
|---|---|---|---|---|---|
| Peppercorn Co. (`spice`) | Humans | Spice | Farmland, spice fields that burn each summer | STR: front line, hold and hit | Harvest gold, embers |
| Rosethread (`silk`) | Elves | Silk | River forest, fords, looms | DEX: range, crits, speed | Satin, stitch, spring |
| Ironvein (`metals`) | Dwarves | Ore and stone | Mountain quarries, forge halls | STR: hold many, hit hardest, slow | Riveted iron, overcast |
| Butcherblock (`art` slot, was Easel House) | Reptilians | Meat, hides, salt | Salt marsh, smokehouses, reed channels | DEX: bleed, venom, frenzy | Reeds, mist, hide and bone |
| Greenvial, working name (`scrolls` slot, was Moonquill) | Gnomes | Plant potions | Hidden gardens, glasshouses, mushroom hollows | INT: bursts, chains, slows, support | Glass, vines, glowing spores |

The company's voice already exists: its liaison (`src/game/data/liaisons.ts`):
- Saffra, Peppercorn's broker: brisk, hot, always on the price.
- Brannoch, Ironvein's factor: gruff, short, counts every cart.
- Odile, Rosethread's mercer: smooth, warm, money in every word.
- Vell (Easel House's curator: fussy, precise) and Wren (Moonquill's archivist:
  quiet, a little ominous) were written for the old houses. When their slots
  become Butcherblock and Greenvial, keep the name only if the personality
  still fits the new trade. Otherwise propose a new one, as a proposal to the
  designer, never silently.

The raiders are goblin clans (`src/game/data/clans.ts`), one per road, a look
and a name only.

## 2. Write the person before drawing them

Write a short character brief (about 6 lines) and put it in the review card's
caption source or the PR:

- **Who:** name, people, trade, role in the company, and one line of history
  tied to their road (a town, a burned field, a flooded channel).
- **Want and worry:** what they want from the player, and what they fear
  losing.
- **Temperament:** three adjectives, one of them a contradiction (a gruff
  dwarf who is secretly sentimental about his carts).
- **Tic:** one repeatable behaviour that can be animated in 4 to 8 frames
  (counts coins, sniffs a spice pouch, taps a ledger, adjusts spectacles,
  flicks a tongue, polishes a vial).
- **Silhouette words:** two shape words (squat + square, tall + tapering,
  round + tufted).
- **Signature prop:** one object from their trade that they hold or wear.

## 3. Turn personality into design (the translation table)

Each trait must land in at least one of these channels. If a trait lands
nowhere, cut it or redesign:

| Channel | What it carries | Examples |
|---|---|---|
| Silhouette | the one big read at 1× | a dwarf's square block, an elf's tall taper, a gnome's huge hat |
| Posture | temperament | leans in (eager), rocks back (smug), hunched (wary), planted (stubborn) |
| Proportion | people and age | head-to-body ratio, hand size, limb length |
| Palette | trade and world | 3 to 4 hues from the company's theme (`src/ui/theme/companyThemes.ts`) plus the pack's outline ink and skin ramps |
| Prop | trade | spice scale, ledger, bolt of silk, hook, vial |
| Idle tempo | energy | brisk 6-frame bob vs slow 10-frame breath |
| Tic | personality | see the brief; plays every few seconds, never constantly |
| Reaction | relationship to the player | a nod, a frown, a flourish when picked |

Rule of three reads, in this order: shape first (who), then colour (whose),
then the detail (which one).

## 4. Draw it in our art language

We draw in the **old CC0 Tiny Swords** look (Pixel Frog). Never import the
current Tiny Swords download (`npx tsx scripts/harvest-cc0.ts --check`).
Anything else added must be commercially licensed and recorded in
`public/licenses/THIRD_PARTY_NOTICES.md` (see CLAUDE.md).

- **View:** 3/4, facing right; the near side reads narrower than the far side.
  Never mirror one half to invent the other: that is what makes heads
  "bulbous".
- **Outline:** the pack's dark outline ink at the pack's weight, closed all
  round. No doubled or broken runs, no single-pixel stair jaggies on curves,
  and no stray pixels.
- **Light:** from the upper left, consistent across every part. Shade with
  the pack's ramps (2 to 3 steps), not gradients or dithering noise.
- **Density:** match the pack's pixel density at each use. 1:1 on the field
  (the knight's 192-px cell, figure 50 to 92 px tall: § 4a), busts for
  portraits (`render/heroPortrait.ts`), and a tiny version for small slots
  (the home dock, about 32 to 48 px), which must be REDRAWN for that size,
  not downscaled.
- **Parts:** build with the character rig (`src/game/render/hero/`, the
  character builder) so bodies, heads, hands, gear and props swap by status:
  rank, mood, damage, company livery. Both hands are real parts with a grip
  anchor on every frame, and held things are drawn in the fist with correct
  layer order (fingers over the handle). Nothing floats at a fixed point.
- **Armour and clothes** are drawn parts with their own silhouette, shading
  and outline, made for that body, never a texture laid over a tunic.
- **Animations:** idle (4 to 8 frames), the tic (4 to 8 frames, every 4 to 8 s),
  and a reaction (3 to 5 frames) at minimum. Hold key poses and keep the
  timing readable; it should never jitter.
- **Motion budget:** atmosphere, not a show. Small slots animate subtly.
  Under reduced motion only the still pose shows (`fxQuality` 'off'), and on
  Light the tic plays half as often.

## 4a. At pack scale: the pack's mass, not anatomy

The lesson of Oct 2026. Slim, skeleton-driven figures at the pack's line
weight (42 to 57 px, thin arms and legs) were rejected outright: "they don't
fit in at all with the other assets". 72 × 72 figures with real limbs were
"chunky and ugly", with "arms busted". The 24 × 28 dock faces are liked. The
Tiny Swords people are not anatomical. They are squat, round, blobby masses.
The head (hair, helmet or hood) is most of the figure and the widest thing.
There is no neck. A short rounded body sits under the head's flared bottom
edge, with nub feet and arms that are stubs or round fists, never limbs.

So, at field or post size:

- **Design to the measured bands, not to a skeleton.** The skeleton (the
  rig) is for joints and motion only, and its proportions are the pack's
  chibi ones: a head of 55 to 75%, legs of 16% or less. Never use human
  anatomy.
- **Start from the pack's own bodies** (the pawn's or knight's pixels,
  repainted) or draw new to the same bands. Either way, check the result
  with `src/game/render/hero/packBands.ts`: `checkBands(measureFigure(still,
  { headBottom }))` must come back empty. Put that check in the figure's
  test.
- **Move it the pack's way.** The idle squashes and bobs the whole mass
  (about 6 frames). Nothing swings on its own.

The pack's bands (`PACK_BANDS`), measured off the shipped CC0 stills (pawn,
knight, archer, torch, TNT and barrel goblins) by `npx tsx
scripts/pack-bands.ts`. The card is
`docs/characters/cards/pack-direction/measure.png`.

| Measure | Pack range | Band | What it means |
|---|---|---|---|
| Height (opaque, 1×) | 53 (pawn) to 86 (knight) | 50 to 92 px | field / post people, not dock faces |
| Aspect (w ÷ h) | 0.75 to 1.41 | 0.70 to 1.45 | about as wide as tall |
| Fill (opaque ÷ box) | 0.55 to 0.72 | 0.50 to 0.78 | a solid blob, not a stick figure |
| Head share | 0.62 to 0.74 | 0.55 to 0.75 | the head is most of the figure |
| Top-half mass | 0.36 to 0.47 | 0.32 to 0.52 | the head flares widest at its bottom edge, so the mass sits low |
| Leg share (bottom rows under 45% of the widest) | 0 to 0.13 | at most 0.16 | nub feet |
| Outline | `#161c2e` on 85 to 100% of the edge | at least 80% | one navy ink, closed |
| Outline depth | 2.23 to 2.67 px | 2.2 to 2.8 | 2 px on straights, 3 on curves. An even 2 px ring reads thinner. |
| Main colours (each at least 1% of the figure) | 7 to 13 | 6 to 16 | three tones a material plus a white dash |

Per figure (box · fill · aspect · head · legs · depth · colours): pawn 58 × 53
· .65 · 1.09 · .68 · .13 · 2.67 · 7. Knight 78 × 86 · .56 · .91 · .74 · .08 ·
2.54 · 9. Archer 62 × 73 · .66 · .85 · .62 · .10 · 2.53 · 8. Torch goblin
74 × 74 · .55 · 1.00 · .64 · .08 · 2.23 · 13. TNT goblin 86 × 61 · .62 · 1.41 ·
.67 · .11 · 2.42 · 13. Barrel goblin 50 × 67 · .72 · .75 · (a keg) · .00 ·
2.56 · 8.

The bands catch drift in proportion and mass, and a thin line. They don't
judge whether a figure is good. Passing them is the floor, not the bar. The
bar is still the line-up: put the figure among the pack's people at 1× and
3× on the pack's grass and ask whether anyone would notice it wasn't drawn by
Pixel Frog. (The rejected 72 × 72 post faces pass every band except the
outline depth, which is about 2.1.)

## 4b. How to draw one the designer will pick (the Oct 2026 method)

The only figures the designer picked (Saffra's ten, then the five others)
were made like this. Earlier ones (reskins of the pack's pixels, skeletons,
smooth formula-filled domes and cones) were all rejected.

- **Hand-author every sprite as a pixel map.** Use string rows and a palette
  key, placed like a pixel artist works, and iterate at 8×. Only the outline
  is mechanical: a tool rings each part in 2 px of `#161c2e`. Shapes drawn
  by formula read as vector art. If a drafting helper roughs in a big mass,
  hand-place every texture mark, dash and edge after it.
- **Give every character its own body.** The designer, Oct 2026: "Body
  doesn't need to be shared, it should be unique." A shared, re-coloured
  tunic made every design read alike below the neck. Each figure gets a body
  drawn for who it is, inside the pack's mass bands (§ 4a):
  - its people's build: a squat, square dwarf; a taller, tapering elf; a
    reptile with a heavy tail and a forward lean; a tiny round gnome;
  - its costume's cut and material: an apron, a smock, a cloak, a coat, a
    sash, a belt and pouch;
  - its posture: brisk, planted, coiled or hunched.

  The head mass still leads (hair, hat, hood, beard), and the body answers
  it.
- **Lead with the hat or head.** The designer's pick was the hat-led Field
  Burner. **No prop may overlap the head or hat silhouette**: hold it low,
  at the side, or clear of the head mass. Check this per frame in code.
- **Shade by hand, row by row.** Use about half light, a third mid and a
  little dark, curved to the form, plus the pack's crisp white dashes.
- **Hide the face.** At most a nose, a cheek or an eye glint under a brim.
  Never a mouth object.
- **Put a texture you can name on every material:** stitching, a dent, a
  rolled and lit brim edge, kerchief folds, scales in paired light and dark
  dashes. Avoid noise and evenly spaced streaks, which read as staves or
  corduroy.
- **Make props big enough to read at 1×,** and give each one its own tic.

## 4c. Lessons from Stardew Valley (what transfers, what doesn't)

The designer shared a reverse-engineered Stardew Valley sprite spec (Oct
2026). We learn its methods. We never copy its art, and Tiny Swords stays
our look, so a Stardew rule that contradicts the pack's measured bands loses.
I measured the pack against it: `public/assets/sprites/tinyswords/` mystic,
fighter, rogue and torch1.

**Adopt: the pack already does it, or it fits it:**

- **Hue-shifted ramps.** Stardew turns hue 40–60° from shadow to light. The
  pack does the same:
  - cream: H22 → H37 → H48, warming toward yellow;
  - teal: H224 navy → H192 → H175;
  - goblin skin: H132 → H93;
  - goblin red: its shadow drops to magenta, H319.

  So never make a ramp by darkening one hue. Take the pack's own ramps, or
  shift a new one about 25–50°: shadows cool or magenta, lights warm.
- **Light from above, hard silhouettes.** There are no soft pixels on a
  silhouette. Soften inside it with in-between colours. Partial alpha is only
  for the ground shadow (about 30%) and effects like smoke.
- **Small motion that carries life, staggered.** Stardew's idle redraws an
  8×8 chest patch 6% larger for half of a ~3.8 s cycle, offset per
  character so a crowd never breathes in sync. That's our desynced dock
  clock and the pack's squash-and-bob; keep both. Strides drop the body
  exactly 1 px and swing the arms 1–2 px, and nothing else moves.
- **Land impacts early.** A short wind-up, the hit on the third frame (about
  190 ms), then a longer hold. Apply it to hero attacks and to any tic with
  a "hit": a slap, a stamp, a chalk mark.
- **Layers with one offset table.** The farmer is a stack of layers (body,
  pants, eyes, shirt, accessory, hair, hat). One per-frame offset table moves
  each layer with the body's bob, so one hair drawing serves every frame.
  That is the right model for our hero rig (`src/game/render/hero/`): parts
  ride the body by a per-frame offset table, never redrawn per frame.
- **Key-colour palette swaps and greyscale tints for variants.** Paint a
  swappable part (skin, a company's colour, a clan's cloth) in fixed key
  colours or greys, then swap or multiply at runtime. That is how one drawing
  gives every company livery, clan and skin tone. Keep near-black outline
  pixels out of the tint so the ink stays `#161c2e`.
- **Seasonal or company outfits on the same grid.** Keep the head and redraw
  only the clothes. That suits liveries and Sovereign Route outfits.
- **Portraits as one bust with small edits.** A 64×64 shoulders-up bust in
  3/4 view, with expressions as 100–300 changed pixels on the same base:
  neutral, happy, sad, angry, blush, plus a unique one. That's the model for
  liaison and keeper portraits (the speech-bubble scenes and the receipt),
  instead of one fixed face: the line's mood picks the expression. Add a
  1 px jiggle for about 250 ms when the expression changes, and a fast-snap
  emote bubble (open in 4 × 20 ms, play 4 × 250 ms, close fast).

**Don't adopt: it contradicts the pack:**

- **Coloured outlines per material.** Stardew outlines each material in a
  dark version of its own hue and uses no black. Tiny Swords uses ONE navy
  ink, `#161c2e`, on 85–100% of every edge. Keep the pack's ink.
- **Proportions.** Stardew heads are 38–48% of a 26–29 px body, about 2.4
  heads tall. The pack's heads are 62–74%. Keep the pack's bands (§ 4a).
- **Its grid, colour budget and four facings.** Stardew uses a 16×32 cell at
  4×, about 19 colours, and down/right/up/left rows. Our people face right
  in a 3/4 view, at 7–13 colours per figure, at the pack's density.

## 5. Critique loop: required, at least 3 rounds

"It renders" is not "it's good", and the designer has rejected first passes
that were never zoomed. Each round:

1. Render the real thing with the shipping draw code or the running app
   (Playwright: chromium `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`,
   module `/opt/node22/lib/node_modules/playwright/index.mjs`). Never judge an
   assumed result.
2. Look at 1×, 3× and 8×, next to the CC0 originals it must sit beside (the
   knight, archer, pawn, goblins).
3. Score it against this checklist and write down every failure:
   - Do the people, the trade and the temperament read at 1× without the
     caption?
   - Is the silhouette unique among the five at thumbnail size?
   - Is the outline closed and even, with no jaggies or stray pixels?
   - Is the light consistent, and are the ramps the pack's?
   - Are the hands attached and gripping in every frame, with nothing
     floating?
   - Is the 3/4 view kept, with no symmetric balloon head?
   - Does it look like it belongs to the pack, or is anything pasted-on,
     busier or shinier than its neighbours?
   - Does the animation have readable timing and no jitter, and does the tic
     say the personality?
   - At the smallest size, is it still a person, not a smudge?
4. Fix the top issues, re-render and repeat.

Then write an honest "weakest part" line in the report. Don't present
anything as done that isn't.

Log the rounds in `docs/DESIGN_REVIEW.md`.

## 6. Hand it to the designer's phone

The designer reviews on a phone through the Art Review Board artifact
(Good / Fix / Cut plus a note per card). Export:

- one card per idea, about 600 px wide PNG (animated WebP or GIF for
  motion, 3 to 4 s loop, under 1.5 MB), with any before/after or comparison
  inside the card;
- a `manifest.json` next to them: `[{id, group, people, title, caption, file}]`.
  The caption is one plain line: what it is and what to judge.

Keep the committed folder lean, with no intermediates.

The main session uploads the cards and seeds the board, then reads the
verdicts back. A card marked Fix comes back as round 2 with its notes
answered.

## 7. Ship rules

- No gameplay, number or RNG change from art work. Pure data and rules stay
  in `src/game/run` and `src/game/data`.
- Keep `npm run typecheck`, `npm test` and `npm run build:checks` green.
  New roles go in `ROLE_NAMES` and `PACK_ROLES` (`render/sprites.ts`).
- Every element has one job (DESIGN_SYSTEM § 8). A character put on a UI
  surface gets its row in "Parts and their jobs".
