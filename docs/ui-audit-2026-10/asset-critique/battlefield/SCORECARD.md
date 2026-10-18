# Battlefield static art — asset critique scorecard (Oct 2026)

The designer: "do 3 rounds of critiques to improve every asset along a rubric
of aesthetics, brand, and its job". This family is the battlefield's static
art: the terrain bake, the procedural roads, the danger ground, the five field
seasons and their scenery, the overlays (slots, grid, rings, reticles, the
gate), the battle wagon, and the projectiles and hits. The moving weather and
edge band (`weatherFx.ts`, `edgeFx.ts`) belong to another pass and were not
touched.

**Rubric** (1–5 each): **A**esthetics (does it look like a Tiny Swords map:
seamless tiles, grounded props, light from the upper left, the pack's ramps,
a season that reads as a place, no speckle fighting the sprites) · **B**rand
(warm storybook; each company's season shows its land) · **J**ob (road and
slots readable at a glance at 390 × 844; units, shots and bars pop off the
ground; danger reads as danger, and which; decoration only at the margins;
a hit says who hit what).

**How it was looked at.** `scripts/battlefield-critique.mjs` drives the
running dev app: the 1:1 terrain bake (`drawField` + `drawCaravan`) of each
field below, and real battles (heroes posted; setup, a hero armed with the
open tiles lit, and mid-wave under a crowded mixed wave) at 390 × 844 (2×) and
1280 × 800. Eight fields: each company's road with its own danger ground
(`gen.balanced.23` wildfire for Peppercorn, `gen.winding.41` flooded for the
art slot, `gen.switchbacks.53` quarry for Ironvein, `gen.balanced.67` flooded
for Rosethread, `gen.winding.79` hexed for the scrolls slot), the house look on
the Green Line, and both hand-made benches (the Kiln Road in the harvest, the
Green Line burning in the misty morning). Every shot was read at 1× and in
3× crops. The BEFORE set was served from an untouched export of the starting
commit on a second dev server, so no edit leaked into it.

**The lands** (world bible, `.claude/skills/character-design/SKILL.md` § 1):
Peppercorn farmland and spice fields that burn · Rosethread river forest and
fords · Ironvein quarries and forges · the art slot (Butcherblock) salt marsh
and reed channels · the scrolls slot (Greenvial) hidden gardens and mushroom
hollows. The art and scrolls seasons stay **spring** and **frost**, which the
designer asked for by name (`tests/fieldWorlds.test.ts` holds them); the land
is told in their scenery instead (see "Still weakest").

Scores are `A/B/J`. R0 is the starting state; R1–R3 after each round.

## Ground, road and danger

| Asset | R0 | R1 | R2 | R3 | What changed |
|---|---|---|---|---|---|
| Meadow (house look: grass tile, tonal blobs, tufts) | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Kept. |
| Road (`drawSpriteTerrain` lane) | 3/3/5 | 3/3/5 | 4/4/5 | 4/4/5 | R2: a sunken lane (a darker bank under the far and lit-side edges, light from the upper left), the caravans' broken wheel tracks and a few lit pebbles, by a hash along the road. |
| Forest frame (pines, bushes) | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Kept (the dressing is untouched). |
| Rock tiles / quarry boulders | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Kept. |
| Wood shade and grade (`gradeEnvironment`) | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Near-play autumn trees turned to 70–78° (was 75–90°: they read as summer green beside autumn). |
| Season keep-mask (what a season must not touch) | 2/3/3 | 4/4/4 | 4/4/4 | 4/4/4 | R1: keeps exactly the drawn road and each danger piece's drawn shape. It kept a 4 px verge and a square 2 px past each tile, a ring of summer grass round every road and patch in the snow and the straw: a seam. |
| Lakes (flooded) | 3/3/4 | 4/4/4 | 4/4/4 | 4/4/4 | R1: the bank's shadow on the water (far and lit side) and a deeper middle, so the water lies below the grass; reeds and pads ring them in the art slot and Rosethread. |
| Wildfire scorch + standing flames | 2/3/4 | 3/4/4 | 3/4/4 | 4/4/4 | R1: the seam's light square halo gone; a browned burn into the meadow, a ragged charred rim, a soot shade and ash. R3: rounder corners (15, was 12) and a thin ember ring where the grass still burns: a scorch, not a tray. |
| Cursed ground (+ skulls) | 3/3/5 | 3/3/5 | 4/3/5 | 4/3/5 | R2: sunken, a shade under its far rims. B stays 3: the blight's sickly green is a gameplay mark, not a company's land. |

## The seasons (a company's land)

| Season (company) | R0 | R1 | R2 | R3 | What changed |
|---|---|---|---|---|---|
| Late summer (Peppercorn) | 3/3/3 | 4/4/4 | 4/4/4 | 4/4/4 | R1: props in clumps (`clump`, a soft noise: a harvested field, then plain wood) instead of one per forest tile; pepper plants (the spice) among the bales and stooks; half the brown speckle; calmer, larger straw patches. R3: near trees yellow, not green. |
| Spring (art slot: Butcherblock's marsh) | 2/2/4 | 3/3/4 | 3/3/4 | 4/3/4 | R1: blossom with a real dark step (the pale and white ramps read as cotton puffs), fewer blossom trees, reed beds and brackish pools in the wood, reeds and pads on every lake, fewer flowers on the open ground. R2: wet sedge in drifts through the meadow; taller reeds. R3: more reeds and pools, blossom thinned to one tree in three broadleaves. |
| Overcast (Ironvein) | 3/3/3 | 4/4/4 | 4/4/4 | 4/4/4 | R1: cut quarry stone stacked in the wood; puddles a third as many on the open ground, smaller, two-lobed, with a mud lip and the grey sky in them (they were bright blue discs floating by the road). |
| Misty morning (Rosethread) | 3/3/4 | 4/4/4 | 4/4/4 | 4/4/4 | R1: the screen wash nearly halved and the haze ramp a step darker (the pines were bleached: a filter); willows and alders among the pines (the river forest); half the dew speckle. |
| Frost (scrolls slot: Greenvial's hollows) | 2/2/3 | 4/3/4 | 4/3/4 | 4/3/4 | R1: the seam gone; the snow a step down from paper white with a narrower ramp (the grass streaks showed through like ruled lines), so a cream helmet stands off it; pines keep their green body with snow on the lit boughs (they were grey-white cones); mushrooms in the wood. R2: rings of glowing mushrooms in clumped hollows. |

### The season props

| Prop | R0 | R3 | Note |
|---|---|---|---|
| Hay bale, stook, pumpkin | 4/4/4 | 4/4/4 | Kept; clumped. |
| Sunflowers | 3/4/4 | 3/4/4 | Kept. Thin at a phone's scale. |
| Pepper plant (new) | — | 4/4/4 | A lit leafy bush hung with red and orange pods (margins only). |
| Flowers | 3/3/4 | 4/3/4 | Fewer on the open ground near the play. |
| Puddle | 2/3/3 | 4/4/4 | Redrawn: lies in the ground. |
| Mud | 3/3/4 | 3/3/4 | Kept. |
| Reeds | 3/4/4 | 4/4/4 | Redrawn: 15 × 22, three greens lit on the left, bulrush heads. |
| Lily pads | 3/4/4 | 3/4/4 | Kept. |
| Mushrooms (CC0, tan caps) | 4/3/4 | 4/4/4 | Now also the scrolls slot's hollows. |
| Glowing mushrooms (new) | — | 3/4/4 | Small at a phone's scale; the grade softens the teal. |
| Marsh pool (new) | — | 3/4/4 | Small; reads at 3×, a dark fleck at 1×. |
| Cut stone (new) | — | 4/4/4 | Ironvein's quarries. |
| Snow drift | 3/3/4 | 3/3/4 | Kept. |
| Fallen leaves | 3/3/4 | 3/3/4 | Kept. |
| Broadleaf trees (procedural) | 3/3/4 | 4/4/4 | Blossom ramp with a dark step; willow ramp for Rosethread. |
| Repainted pines | 3/4/4 | 4/4/4 | The snow pine keeps its green. |

## Overlays

| Asset | R0 | R1 | R2 | R3 | What changed |
|---|---|---|---|---|---|
| Deployment grid (open tiles lit while armed; cursed tiles coral, dashed, −70 %) | 4/4/5 | 4/4/5 | 4/4/5 | 4/4/5 | Kept: the brightest thing on a dimmed field, on every season's ground. |
| Build slot ring (`drawSlot`) | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Kept. |
| Best-ground star | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Kept. |
| Clearance zone, label, conflict mark | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Kept. |
| Range rings, auras | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Kept: faint, in the hero's accent. |
| Target reticle | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Kept. |
| Last stretch | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Kept. |
| Placement dim | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Kept. |
| The gate (palisade) | 3/4/4 | 3/4/4 | 4/4/4 | 4/4/4 | R2: standing, sharpened stakes, upright on the screen whatever way the lane runs, each outlined, lit on the left, bound with rope (the planks lay flat across the road: a log in the dirt). The planks still go from the middle out; fallen, they lie flat. |

## The battle wagon

| Asset | R0 | R1 | R2 | R3 | What changed |
|---|---|---|---|---|---|
| Wagon, crates, company flag | 3/4/4 | 3/4/4 | 4/4/4 | 4/4/4 | R2: round, spoked wheels lit from the upper left (they were flat ovals); a clearing in the bake (no tree or prop inside the caravan's box, trodden ground and wheel ruts), so it stands on the ground instead of on baked treetops under a brown wash. `WAGON` is shared with the livery screen, which gets the same wheels. |

## Projectiles and hits

| Asset | R0 | R3 | Note |
|---|---|---|---|
| Arrow, knife, bolt, stone | 4/4/4 | 4/4/4 | Kept: outlined, in the hero's ink; a crit gold-rimmed. |
| Melee swing arc | 4/4/4 | 4/4/4 | Kept. |
| Hit effects (burn, chill, shock, drain, stun, execute) | 4/4/4 | 4/4/4 | Kept. |
| Impact ring, sparks, dust; death puffs | 4/4/4 | 4/4/4 | Kept. On the frost's snow the pack's white death puff is the faintest it gets (see below). |

## Still weakest (honest)

1. **The art slot's salt marsh is a hint, not a land.** Reed beds, pools,
   sedge and reeds round the lakes say "wet", but the wood is still pines and
   the season is still spring with blossom, which the designer asked for.
   A real Butcherblock land — reed channels through the margins, smokehouses —
   needs a field-wide water layer and the designer's call on dropping spring.
2. **The scrolls slot is still frost.** Greenvial's hollows are told by
   mushrooms and glowing caps in clumps, which are small at a phone's scale.
   Hidden gardens and glasshouses would be new set pieces.
3. **Small props at 1×.** Marsh pools, glowing caps, sunflowers and drifts are
   10–20 field px: at 390 × 844 they are flecks. They read at 3×.
4. **The danger ground is still grid-fit rounded shapes.** Lakes and burns
   must fill their tiles, so their outline is the tile's; the depth and the
   ragged rims help, the silhouette does not change.
5. **White on white.** The pack's white death puff and impact dust are low
   contrast on the frost's snow. They belong to the hit family's palette and
   were left as they are.
6. **The UI's world for the art and scrolls slots is still Easel House and
   Moonquill** (another agent's files). Their battlefields now lean to the
   world bible; the home map's season tint (`mapRules.MAP_SEASONS`) does not.

## Cards and re-running

`cards/` holds the designer's phone cards (13, `manifest.json`): one asset
each, BEFORE beside AFTER at phone width (the real 390 × 844 stage), a 3×
crop of each, and the scores before → after. Rebuild:

    npx vite --port 5255 --strictPort &
    node scripts/battlefield-critique.mjs <dir> all all      # bakes + real battles
    node scripts/battlefield-cards.mjs <spec.json> docs/ui-audit-2026-10/asset-critique/battlefield/cards
