# Places — asset critique scorecard (Oct 2026)

The designer: "do 3 rounds of critiques to improve every asset along a rubric
of aesthetics, brand, and its job". This family is the **places**: the four
stops, the five liaison posts, the shop front, the signs and the bubble. The
people standing in the posts are another agent's (the character rig), so they
are kept as they are and each post leaves them the same room.

**Rubric** (1–5 each):

- **A — aesthetics.** Would Pixel Frog build this place from the pack?
  Composition, depth and a focal point; closed outlines, light from the upper
  left, the pack's ramps; no seams or floating props; props at the people's
  scale.
- **B — brand.** Warm storybook medieval, parchment and wood, no cool chrome
  (`BRAND.md`). Does the post belong to its company's land and trade?
- **J — job.** On a 390 phone: does it say where you are and who is talking,
  leave room for the sign, the bubble, the goods and the CTA, and never fight
  the choice? Does every element have one job (`DESIGN_SYSTEM.md` § 8)?

**How it was judged.** Each round was rendered in the running app (Playwright,
390 × 844 and 1280 × 800, `scripts/places-shots.mjs`) on every screen the place
is used. The scene PNGs were checked at 1×, 2× and 4×. The shot script also
measures each bubble against its sign and its scene, and flags any collision.
Scores are written as `A/B/J`.

## Inventory (13 assets, 2 proposals)

| # | Asset | Files | Used on |
|---|---|---|---|
| 1 | Merchant's stall | `scenes/merchant.png` | the merchant stop (the clerk holds up the focused ware) |
| 2 | Campfire | `scenes/campfire.png` + the pack's fire strip | the campfire stop |
| 3 | Shrine | `scenes/shrine.png` | the shrine stop |
| 4 | Hiring yard | `scenes/recruit.png` | a city's hiring (the Crossroads) |
| 5 | Peppercorn's post | `scenes/liaison-spice.png` | its cities; the receipt cameo |
| 6 | Easel House's post (the slot becomes Butcherblock's) | `scenes/liaison-art.png` | as above |
| 7 | Ironvein's post | `scenes/liaison-metals.png` | as above |
| 8 | Rosethread's post | `scenes/liaison-silk.png` | as above |
| 9 | Moonquill's post (the slot becomes Greenvial's) | `scenes/liaison-scrolls.png` | as above |
| 10 | Place signs | `stops.css` (`.t-title` at a stop), `liaisons.css` (`.ct-sign`) | every stop and city |
| 11 | Speech bubble | `StopScene.tsx`, `stops.css` / `liaisons.css` (`.ss-bubble`, `.ss-who`) | every stop and city |
| 12 | Shop front | `ShopFront.tsx`, `shop.css` | the merchant |
| 13 | Receipt cameo | `LiaisonScene.LiaisonSays` (52 px cut from the post) | the contract receipt |
| P1 | Proposal: Butcherblock's smokehouse | `--proposals` only | not shipped |
| P2 | Proposal: Greenvial's glasshouse | `--proposals` only | not shipped |

## Scores by round

| # | Asset | R0 | R1 | R2 | R3 |
|---|---|---|---|---|---|
| 1 | Merchant's stall | 3/3/3 | 4/4/4 | 4/4/4 | 4/4/4 |
| 2 | Campfire | 3/4/4 | 4/4/4 | 4/4/4 | 4/4/4 |
| 3 | Shrine | 4/4/4 | 5/4/4 | 5/4/4 | 5/4/4 |
| 4 | Hiring yard | 3/4/2 | 4/4/4 | 4/4/4 | 4/4/4 |
| 5 | Peppercorn's post | 3/4/3 | 4/5/4 | 4/5/4 | 4/5/4 |
| 6 | Easel House's post | 3/2/3 | 4/2/4 | 4/2/4 | 4/2/4 |
| 7 | Ironvein's post | 3/3/3 | 4/5/4 | 4/5/4 | 4/5/4 |
| 8 | Rosethread's post | 3/3/3 | 4/4/4 | 4/4/4 | 4/4/4 |
| 9 | Moonquill's post | 4/2/3 | 4/2/4 | 4/2/4 | 4/2/4 |
| 10 | Place signs | 4/3/4 | 4/4/4 | 4/4/4 | 4/4/4 |
| 11 | Speech bubble | 4/4/2 | 4/4/4 | 4/4/4 | 4/4/4 |
| 12 | Shop front | 4/4/3 | 4/4/4 | 4/4/4 | 4/4/4 |
| 13 | Receipt cameo | 3/3/3 | 3/4/3 | 3/4/3 | 3/4/3 |
| P1 | Butcherblock proposal | — | 3/4/4 | 4/4/4 | 4/4/4 |
| P2 | Greenvial proposal | — | 4/4/3 | 4/5/3 | 4/5/4 |

The proposals' R0 is the slot's post as it ships (Easel House 3/2/3, Moonquill
4/2/3): what each would replace.

## Round 0: what failed

Across the board:

- **The ground was the pack's beach.** Every daylight yard was Tiny Swords'
  lemon sand. It is the pack's shore, and a stall on it read as a beach.
- **The yards were rectangles.** The sand was laid as a 9-slice block, so it
  had a straight top edge across the whole scene.
- **Props floated and were too small.** No drawn prop had a shadow. Beside
  59 px pawns, a crate was 14 × 12, a tent 48 × 36 (shorter than a person), a
  bedroll 22 × 8, an anvil 22 × 13 and a straw man 38 tall.
- **The meadow repeated.** One 64 px grass tile tiled flat, and the repeat
  showed on the shrine and the night scenes.

Scene by scene:

- **Merchant (3/3/3).**
  - The counter was empty: a trader with nothing on it.
  - The ware floated over the clerk's hat, above the raised hands.
  - A sheep had no job.
  - On a phone, the counter was cut to a sliver.
- **Campfire (3/4/4).**
  - The tent, the pot and the bedroll were all hidden behind the two people.
  - The flame stood on bare grass, with no hearth.
  - The clearing was a bright rectangle in the dark.
  - A tree trunk glowed just above the flame.
- **Shrine (4/4/4).**
  - The stones stood on bare, repeating grass.
  - The keeper stood on the altar's end.
- **Hiring yard (3/4/2).**
  - On a phone, the sergeant's three-line lines ran off the top of the scene.
    The bubble was hung over the plume's tip.
  - The two hires stood in one tangle.
  - The flag did the sign's job a second time.
- **The posts.** All five were the same stall in a pine wood on sand. Only a
  colour and a prop or two told them apart:
  - Ironvein (3/3/3): the Knights' blue tower, and no mountain or quarry.
  - Rosethread (3/3/3): no river, no ford, no loom, and a sheep (wool, not silk).
  - Peppercorn (3/4/3): a market stall; the farmland was missing.
  - On a phone, the standard was cut at the scene's left edge.
- **Easel House and Moonquill (B 2).** Their slots become Butcherblock and
  Greenvial. A painter's gallery and a scriptorium belong to no current land.
- **Signs (4/3/4).** The shop's sign was a literal light wood. The city's
  sign, the same part, used the sign tokens, so the two woods differed and a
  theme reached only one.
- **Bubble (4/4/2).** It ran off the scene on the hiring yard (above).
- **Shop front (4/4/3).** An out-of-stock service, "Cargo is whole", was the
  shared `--muted` ink on the paper tag: cream on cream.
- **Cameo (3/3/3).** It is a 52 px cut of the hat. The face is the character
  agent's.

## Round 1: what changed

- **The ground.**
  - **Trodden earth:** the pack's sand tile re-inked in a warm earth ramp,
    pixel for pixel (a palette swap, so the art's own shapes stay).
  - **A yard is an ellipse with a noisy edge:** its rim inked a step darker,
    nicked by grass blades.
  - **The meadow gets tonal patches:** its own four greens swapped a step.
- **Every drawn prop:**
  - stands on a shadow;
  - is redrawn at the people's scale: crate 22 × 18, barrel 18 × 22, tents
    70–84 wide, bedroll 40 × 11, straw man 54 tall, anvil 30 × 20, brazier
    20 × 24.
- **Merchant:** a kit stall.
  - A rack of blades, a helm on the counter, a shield on the post, barrels
    and crates.
  - The stall is lowered, so its counter shows on a phone.
  - The ware sits between the raised hands.
  - The sheep went.
- **Campfire.**
  - A hearth: a ring of stones and stacked logs under the flame.
  - The pot hangs on a spit.
  - The tent is in the wing, the bedroll in the open, and the stray trunk
    went.
- **Shrine.**
  - Worn flagstones under the stones, stepping stones to the front.
  - The keeper steps off the altar.
- **Hiring yard:** a drill yard.
  - A rack of arms, a straw man, and a hire (the archer) at practice. The
    tower is in the wing and the tent is warm canvas with a red hem.
  - The flag went: the sign is the yard's pennant.
- **Bubble.**
  - Anchors point at faces, not plume tips.
  - The bake marks a tall speaker (`beside: true` in
    `stopScenes.generated.ts`), so its bubble hangs beside the face.
    `StopScene` reads the flag.
- **Posts: each on its own land**, in the same layout (head at y 70, counter
  from 108, the bubble's room to the right):
  - **Peppercorn:** the stall at the edge of its chili fields, the far rows
    smaller.
  - **Ironvein:** the pack's cliff as a quarry face behind, a timbered adit, a
    cart of ore on rails. The Knights' tower went.
  - **Rosethread:** the river behind with a ford of stones, reeds on the
    bank, a loom. The sheep went.
  - **Easel House, Moonquill:** ground, shadows and the standard only.
  - **All five:** the standard moves in from the edge, so a phone shows it.
- **Signs:** the shop's sign uses the sign tokens, one wood with the city's.
- **Shop front:** an out-of-stock service's label is the paper ink.
- **Proposals:** Butcherblock's smokehouse and Greenvial's glasshouse, baked by
  `npx tsx scripts/stop-scenes.ts --proposals <dir>`, outside `public/` and the
  anchors.
- **Fixed after the round's re-render:**
  - The chili field read as a hedge; it now has spaced rows with earth
    between.
  - The reeds' outline inked the gaps between stems into a black comb; they
    are a shaded clump now, with only the heads inked.
  - The straw man was a child's height; it is a man's now.

## Round 2: what changed

- **Ironvein.**
  - The cliff foot is lower, so the adit's dark doorway shows under the
    bubble on a phone.
  - A drawn forge carries the glow. Before, the anvil's block glowed orange
    from nothing; the light is softer now.
- **Peppercorn:** the burned strip moved into view, behind the brazier.
- **Shop front:** the shelf's and the counter's washes are tokens
  (`color-mix` of `--sign-ink` / `--shade`, § 8 rule 7), so a company theme
  reaches them.
- **Butcherblock proposal.**
  - The channel is lower and clearer, with its jetty, and the mist is
    lighter.
  - The meat hangs on hooks.
  - The hide went: it was hidden behind the person.
- **Greenvial proposal:** the giant mushrooms out front were cut to small and
  medium ones; one large stands in the wing.

## Round 3: what changed

- **Campfire.**
  - The yard's pale tongue in the dark was trimmed.
  - The bedroll came out from behind a grass tuft.
- **Peppercorn:** the brazier's flame is inside a phone's width.
- **Merchant:** the crates are inside a phone's width.
- **Shrine:** the left mushrooms are inside a phone's width.
- **Proposals:** the smokehouse and the glasshouse stand lower, so their lower
  halves show under the bubble on a phone.
- **Re-rendered** every place on phone and desk. The shot script's collision
  check reports no bubble over a sign and none cut by its scene.

## Still weakest (honest)

1. **The Easel House and Moonquill posts, B 2.** They are tidied, but they
   belong to companies that are leaving. The fix is the proposals, once the
   designer picks: shipping either one is a bake of two blocks already in
   `stop-scenes.ts`.
2. **The receipt cameo, A 3 / J 3.** At 52 px it is a hat. The face belongs to
   the character rig, and every post leaves the person's room unchanged for
   it.
3. **On a phone the bubble covers the post's back-right.** The adit, the
   glasshouse, the smokehouse and the hung drapes lose their top half. That is
   the layout's price for a bubble beside the face. Each post keeps its
   company's read below and beside the bubble: the cart and the forge, the
   loom, the potions and the vines.
4. **The pack's people face away.** The pawn's hood hides its face, so the
   keeper reads as a hat behind a counter. That is out of this family's scope
   (people), and is the character agent's work.
5. **Three signs are literal colours.** The fire's charred plank, the shrine's
   stone and the yard's pennant are drawn materials that no theme should
   stain. Under § 8 rule 7 that is a standing break. It predates this pass, but
   it needs the designer's yes to go in the exceptions table.
6. **The flame is the pack's building fire.** It is as tall as a person, and
   it carries a dark smoke tip at the top of its first frame. It reads as a
   bonfire, which suits the cook's "Nothing walks into a fire this big".

## Cards

`cards/` holds 15 phone cards, about 600 px wide, each showing before and after
on a 390 phone plus a 2× crop of the scene, with the scores R0 → R3. The list
is `cards/manifest.json`. To regenerate them:

1. Shoot the old art and the new with
   `SHOTS_DPR=1.5 node scripts/places-shots.mjs <dir> p390`.
2. Copy the old liaison posts from git into `<before>/scenes/`.
3. Bake the proposals with `npx tsx scripts/stop-scenes.ts --proposals <dir>`.
4. Run `node scripts/places-cards.mjs <before> <after> <proposals>`.
