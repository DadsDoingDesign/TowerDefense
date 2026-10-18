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
  (about the knight's 192-px cell, figure about 60 to 100 px tall), busts for
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
