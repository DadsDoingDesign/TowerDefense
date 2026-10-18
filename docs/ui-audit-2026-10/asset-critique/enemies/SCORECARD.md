# Enemies — asset critique scorecard (Oct 2026)

Three rounds over the goblin clans (5 clans × torch / bomber / keg × tiers 1–5 =
75 baked strips) plus the field's elite / armour badge, the tier ticks, the
boss plate and the run map's armour tab: **79 assets**.

Scores are **A / B / J** (Aesthetics / Brand / Job), 1–5, judged on the real
bake (`npx tsx scripts/enemy-clans.ts`) at 1×, 3× and 8× beside the plain CC0
goblins, and in a real battle on each company's road (`scripts/enemy-clans-critique.mjs`,
390 × 844 at 2×). R0 is the art as it shipped; R1–R3 are the three rounds.

| | R0 | R1 | R2 | R3 |
|---|---|---|---|---|
| mean A | 2.32 | 3.30 | 4.00 | 4.00 |
| mean B | 3.48 | 3.54 | 3.92 | 4.13 |
| mean J | 3.28 | 3.99 | 3.99 | 4.00 |
| assets under 4 on any axis | 74 | 56 | 16 | 0 |

## The rounds

**Round 1 — what was wrong everywhere.** The tier-2 shoulder piece of every
clan sat at (83, 31): on the torch goblin's NOSE and the bomber's mouth (a gag,
a third eye, a bow tie). The keg bake left the hoops' white glints white on
soot and iron, and the stencil cut left see-through holes (grass in the keg).
Side pieces (fins, stones, brushes) and the paint tin's 1-px bail floated off
the keg. Silkcut's reel was flat planks over a dithered pP checker, the one
non-pack technique in the set. Hexmoon's bomber mask hid the goggles, the
bomber's own faction tell. Fixed: the pad on the back shoulder / basket strap
(`PAD_AT`, `TNT_PAD_AT`), `mend(…, sealAll)`, `bands.hi`, `lugs()`, `bailArc()`,
`disc()`, striped thread, `recolor` (moonlit lenses).

**Round 2 — found by counting islands.** An island counter over every frame
(opaque components off the body) found what the eye had missed: in walk
frames 3–5 every bomber's FIST FLOATED — the cut's ink cleanup erased the arm,
which the art draws as a bare ink line — and the stick's butt dangled under it
as a pink stub; the dynamite's fuse tips poked out of every hat; 1–5 px crumbs
sat by every keg lid; three bombs hovered over the fist; the star standard
floated beside the basket. Fixed: the cut drops only ink within 2 px of what it
took, the stick box runs to the butt, the bundle box covers the fuse tips, a
`despeckle` pass, bombs moved into the fist, poles planted behind the basket.
Islands over the 75 strips: 241 → 52, and the 52 left are meant: the plain
torch's own sparks (40, Cinder keeps the flame) and the Cinder champion
crown's flame tongues (12). Brand:
Cinder's crest became the hood's own tip burning (the candle row read as a
crown — the champion's mark); a Peppercorn spice label on the keg; the
Hexmoon mask moved onto the face; scroll cases stand in the basket; Silkcut
wears both flanges from T1 (a reel, not a brim).

**Round 3 — brand and job.** Smudge's grey pail got paint poured over it (it
read as a plain pot); Hexmoon's hooked crescent (a spanner) became a fat
crescent moon over a moon-and-stars plate; the elite badge's ring over a
Plated / Warded goblin now wears the run map tab's armour colour
(`src/game/data/armourInk.ts`, held to `--armour-*` by `tests/armourInk.test.ts`).

**Benchmarks.** Kingdom Rush's and BTD6's per-world enemies: the faction shape
stays, the costume carries the world, the lane reads first — held. Every
clan read in the greyscale shots by headgear silhouette alone (burning hood,
pail, dome lamp, wide brim, horns + mask).

**Frame time** (crowded wave, 26 bodies, phone, mean JS ms/frame): R0 2.75–4.35,
R3 2.74–5.67 — the same band (the run-to-run spread is larger than any change;
the bake adds no draw work).

## Still weakest (honest)

1. **The bomb in the fist, frames 3–5.** It is anchored where the plain lit
   stick's middle was, so on the down-swing it sits ON the fist, held from
   below, not gripped. Fingers over the handle would need a hand part.
2. **Back-shoulder pads ride the head's track**, not a shoulder track; across
   the walk they can drift a pixel against the robe edge.
3. **Silkcut kegs**: the hoops' glints (`t`) blotch the staves cream; the
   flange face is one flat brown.
4. **Hexmoon kegs**: the mint glints on purple are the busiest hoops in the set.
5. **Cinder champions**: the tall crown's flame tongues are separate 15-px
   tips (like the plain torch's sparks, but they read as floating at 8×).
6. **At 320 px wide** the field draws a rank goblin ~20 CSS px tall: the
   clan reads by headgear, but the T2/T3 ornaments (pad, banner) are 1–2 px.
7. **Smudge and Hexmoon** are brand-correct for Easel House and Moonquill,
   which the world bible is replacing — see the proposals.

## Proposal: Gnawbone Pack and Sporecap Rot (not shipped)

Mock bakes through the same ladder and bake (`scripts/enemy-clans-proposals.ts`,
`npx tsx scripts/enemy-clans.ts --proposals <dir>`); nothing is in `CLAN_IDS`.

- **Gnawbone Pack** (Butcherblock's raiders, replacing Smudge): an ox skull
  for a helm (horns back, snout forward; tusks at T4, a bone crown at T5), a
  meat hook for the torch, a hide pauldron, a smoke rack of meat, salt sacks in
  the basket, a salt pouch to throw; the keg heaped with salt under twine with
  crossed bones on a hide label. Card: `cards/proposal-gnawbone.png`.
- **Sporecap Rot** (Greenvial's raiders, replacing Hexmoon): a big spotted cap
  with glowing gills (a second cap at T4, a ring of toadstools at T5), a
  swinging spore censer, a moss pauldron, rot jars, a puffball to throw,
  green lenses; the keg a verdigris vat foaming over, a window of bubbling
  rot, toadstools at its sides. Card: `cards/proposal-sporecap.png`.

## Phone cards

`cards/` (28 files, ~3 MB; `manifest.json`): one card per clan × faction
(15: before vs after at 1× and 4×, scores worst-tier before → after), one walk
loop per clan (5 animated WebP, 3 s), one battlefield-at-real-size card per
clan (5), the armour badge (1) and the two proposals (2).

## Every asset × round

| Asset | R0 | R1 | R2 | R3 | R0 finding → what changed (R1 · R2 · R3) |
|---|---|---|---|---|---|
| Cinder Clan · Torch line T1 (`cinder_torch1_walk`) | 3/4/4 | 3/4/4 | 4/5/4 | 4/5/4 | flame crest = candles on a soot plank; reads as a crown, air under its corners → — · hood tip burns: one plume off the peak (T4 taller) · — |
| Cinder Clan · Torch line T2 (`cinder_torch2_walk`) | 2/4/3 | 3/4/4 | 4/5/4 | 4/5/4 | soot pad sits on the nose → pad moved to the back shoulder; face clear · hood tip burns: one plume off the peak (T4 taller) · — |
| Cinder Clan · Torch line T3 (`cinder_torch3_walk`) | 2/4/3 | 3/4/4 | 4/5/4 | 4/5/4 | soot pad sits on the nose → pad moved to the back shoulder; face clear · hood tip burns: one plume off the peak (T4 taller) · — |
| Cinder Clan · Torch line T4 (`cinder_torch4_walk`) | 2/4/3 | 3/4/4 | 4/5/4 | 4/5/4 | soot pad sits on the nose → pad moved to the back shoulder; face clear · hood tip burns: one plume off the peak (T4 taller) · — |
| Cinder Clan · Torch line T5 (`cinder_torch5_walk`) | 2/4/3 | 3/4/4 | 4/5/4 | 4/5/4 | soot pad sits on the nose; mantle a grey slab → pad moved to the back shoulder; face clear · mantle soot with an ember hem · — |
| Cinder Clan · Bombers T1 (`cinder_tnt1_walk`) | 2/4/4 | 2/4/4 | 4/5/4 | 4/5/4 | fist floats + pink stick butt dangles in walk 3–5; fuse tip pokes up → — · arm kept, fist held, crumbs cleared; burning cap · — |
| Cinder Clan · Bombers T2 (`cinder_tnt2_walk`) | 2/4/3 | 2/4/4 | 4/5/4 | 4/5/4 | fist floats + pink stick butt dangles in walk 3–5; fuse tip pokes up; pad on the mouth → pad on the basket strap · arm kept, fist held, crumbs cleared; burning cap · — |
| Cinder Clan · Bombers T3 (`cinder_tnt3_walk`) | 2/4/3 | 2/4/4 | 4/5/4 | 4/5/4 | fist floats + pink stick butt dangles in walk 3–5; fuse tip pokes up; pad on the mouth → pad on the basket strap · arm kept, fist held, crumbs cleared; burning cap · — |
| Cinder Clan · Bombers T4 (`cinder_tnt4_walk`) | 2/4/3 | 2/4/4 | 4/5/4 | 4/5/4 | fist floats + pink stick butt dangles in walk 3–5; fuse tip pokes up; pad on the mouth → pad on the basket strap · arm kept, fist held, crumbs cleared; burning cap · — |
| Cinder Clan · Bombers T5 (`cinder_tnt5_walk`) | 2/4/3 | 2/4/4 | 4/5/4 | 4/5/4 | fist floats + pink stick butt dangles in walk 3–5; fuse tip pokes up; pad on the mouth → pad on the basket strap · arm kept, fist held, crumbs cleared; burning cap · — |
| Cinder Clan · Kegs T1 (`cinder_barrel1`) | 3/3/4 | 4/3/4 | 4/4/4 | 4/4/4 | white glints on soot hoops; grass through stencil holes; grey plate → holes mended, glints soot, fins strapped on · spice label with a chilli · — |
| Cinder Clan · Kegs T2 (`cinder_barrel2`) | 3/3/4 | 4/3/4 | 4/4/4 | 4/4/4 | white glints on soot hoops; grass through stencil holes; grey plate → holes mended, glints soot, fins strapped on · spice label with a chilli · — |
| Cinder Clan · Kegs T3 (`cinder_barrel3`) | 2/3/4 | 4/3/4 | 4/4/4 | 4/4/4 | white glints on soot hoops; grass through stencil holes; grey plate; fins float → holes mended, glints soot, fins strapped on · spice label with a chilli · — |
| Cinder Clan · Kegs T4 (`cinder_barrel4`) | 2/3/4 | 4/3/4 | 4/4/4 | 4/4/4 | white glints on soot hoops; grass through stencil holes; grey plate; fins float → holes mended, glints soot, fins strapped on · spice label with a chilli · — |
| Cinder Clan · Kegs T5 (`cinder_barrel5`) | 2/3/4 | 4/3/4 | 4/4/4 | 4/4/4 | white glints on soot hoops; grass through stencil holes; grey plate; fins float → holes mended, glints soot, fins strapped on · spice label with a chilli · — |
| Smudge Gang · Torch line T1 (`smudge_torch1_walk`) | 4/3/4 | 4/3/4 | 4/3/4 | 4/4/4 | clean grey pail reads as a plain pot → — · paint dabs on the robe tried, dropped (noise at size) · paint poured over the bucket and down its side |
| Smudge Gang · Torch line T2 (`smudge_torch2_walk`) | 2/3/3 | 4/3/4 | 4/3/4 | 4/4/4 | palette pad on the face reads as a third eye → palette on the back shoulder · paint dabs on the robe tried, dropped (noise at size) · paint poured over the bucket and down its side |
| Smudge Gang · Torch line T3 (`smudge_torch3_walk`) | 2/3/3 | 4/3/4 | 4/3/4 | 4/4/4 | palette pad on the face reads as a third eye → palette on the back shoulder · paint dabs on the robe tried, dropped (noise at size) · paint poured over the bucket and down its side |
| Smudge Gang · Torch line T4 (`smudge_torch4_walk`) | 2/3/3 | 4/3/4 | 4/3/4 | 4/4/4 | palette pad on the face reads as a third eye → palette on the back shoulder · paint dabs on the robe tried, dropped (noise at size) · paint poured over the bucket and down its side |
| Smudge Gang · Torch line T5 (`smudge_torch5_walk`) | 2/3/3 | 4/3/4 | 4/3/4 | 4/4/4 | palette pad on the face reads as a third eye → palette on the back shoulder · paint dabs on the robe tried, dropped (noise at size) · paint poured over the bucket and down its side |
| Smudge Gang · Bombers T1 (`smudge_tnt1_walk`) | 2/3/4 | 2/3/4 | 4/3/4 | 4/4/4 | fist floats + stick butt in walk 3–5 → — · arm kept, bomb in the fist, crumbs cleared · paint-poured bucket |
| Smudge Gang · Bombers T2 (`smudge_tnt2_walk`) | 2/3/3 | 2/3/4 | 4/3/4 | 4/4/4 | fist floats + stick butt in walk 3–5; pad on the mouth → pad on the basket strap · arm kept, bomb in the fist, crumbs cleared · paint-poured bucket |
| Smudge Gang · Bombers T3 (`smudge_tnt3_walk`) | 2/3/3 | 2/3/4 | 4/3/4 | 4/4/4 | fist floats + stick butt in walk 3–5; pad on the mouth → pad on the basket strap · arm kept, bomb in the fist, crumbs cleared · paint-poured bucket |
| Smudge Gang · Bombers T4 (`smudge_tnt4_walk`) | 2/3/3 | 2/3/4 | 4/3/4 | 4/4/4 | fist floats + stick butt in walk 3–5; pad on the mouth → pad on the basket strap · arm kept, bomb in the fist, crumbs cleared · paint-poured bucket |
| Smudge Gang · Bombers T5 (`smudge_tnt5_walk`) | 2/3/3 | 2/3/4 | 4/3/4 | 4/4/4 | fist floats + stick butt in walk 3–5; pad on the mouth → pad on the basket strap · arm kept, bomb in the fist, crumbs cleared · paint-poured bucket |
| Smudge Gang · Kegs T1 (`smudge_barrel1`) | 2/3/3 | 4/4/4 | 4/4/4 | 4/4/4 | 1-px bail floats off the tin, flickers at half density → bail is an unbroken arc on rivets; paint tubes strapped on · crumbs cleared · — |
| Smudge Gang · Kegs T2 (`smudge_barrel2`) | 2/3/3 | 4/4/4 | 4/4/4 | 4/4/4 | 1-px bail floats off the tin, flickers at half density → bail is an unbroken arc on rivets; paint tubes strapped on · crumbs cleared · — |
| Smudge Gang · Kegs T3 (`smudge_barrel3`) | 2/3/3 | 4/4/4 | 4/4/4 | 4/4/4 | 1-px bail floats off the tin, flickers at half density; brushes float → bail is an unbroken arc on rivets; paint tubes strapped on · crumbs cleared · — |
| Smudge Gang · Kegs T4 (`smudge_barrel4`) | 2/3/3 | 4/4/4 | 4/4/4 | 4/4/4 | 1-px bail floats off the tin, flickers at half density; brushes float → bail is an unbroken arc on rivets; paint tubes strapped on · crumbs cleared · — |
| Smudge Gang · Kegs T5 (`smudge_barrel5`) | 2/3/3 | 4/4/4 | 4/4/4 | 4/4/4 | 1-px bail floats off the tin, flickers at half density; brushes float → bail is an unbroken arc on rivets; paint tubes strapped on · crumbs cleared · — |
| Deepdelve · Torch line T1 (`delve_torch1_walk`) | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | lamp helm sits right on the hood → — · — · — |
| Deepdelve · Torch line T2 (`delve_torch2_walk`) | 2/4/3 | 4/4/4 | 4/4/4 | 4/4/4 | riveted pad over the nose → pad on the back shoulder · — · — |
| Deepdelve · Torch line T3 (`delve_torch3_walk`) | 2/4/3 | 4/4/4 | 4/4/4 | 4/4/4 | riveted pad over the nose → pad on the back shoulder · — · — |
| Deepdelve · Torch line T4 (`delve_torch4_walk`) | 2/4/3 | 4/4/4 | 4/4/4 | 4/4/4 | riveted pad over the nose → pad on the back shoulder · — · — |
| Deepdelve · Torch line T5 (`delve_torch5_walk`) | 2/4/3 | 4/4/4 | 4/4/4 | 4/4/4 | riveted pad over the nose → pad on the back shoulder · — · — |
| Deepdelve · Bombers T1 (`delve_tnt1_walk`) | 2/4/4 | 2/4/4 | 4/4/4 | 4/4/4 | fist floats in walk 3–5; fuse tip pokes out of the helm → — · arm kept, crumbs cleared · — |
| Deepdelve · Bombers T2 (`delve_tnt2_walk`) | 2/4/3 | 2/4/4 | 4/4/4 | 4/4/4 | fist floats in walk 3–5; fuse tip pokes out of the helm; pad on the mouth → pad on the basket strap · arm kept, crumbs cleared · — |
| Deepdelve · Bombers T3 (`delve_tnt3_walk`) | 2/4/3 | 2/4/4 | 4/4/4 | 4/4/4 | fist floats in walk 3–5; fuse tip pokes out of the helm; pad on the mouth → pad on the basket strap · arm kept, crumbs cleared · — |
| Deepdelve · Bombers T4 (`delve_tnt4_walk`) | 2/4/3 | 2/4/4 | 4/4/4 | 4/4/4 | fist floats in walk 3–5; fuse tip pokes out of the helm; pad on the mouth → pad on the basket strap · arm kept, crumbs cleared · — |
| Deepdelve · Bombers T5 (`delve_tnt5_walk`) | 2/4/3 | 2/4/4 | 4/4/4 | 4/4/4 | fist floats in walk 3–5; fuse tip pokes out of the helm; pad on the mouth → pad on the basket strap · arm kept, crumbs cleared · — |
| Deepdelve · Kegs T1 (`delve_barrel1`) | 3/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | white glints, stencil holes → mended; plates touch · — · — |
| Deepdelve · Kegs T2 (`delve_barrel2`) | 3/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | white glints, stencil holes → mended; plates touch · — · — |
| Deepdelve · Kegs T3 (`delve_barrel3`) | 3/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | white glints, stencil holes; side plates 1 px off → mended; plates touch · — · — |
| Deepdelve · Kegs T4 (`delve_barrel4`) | 3/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | white glints, stencil holes; side plates 1 px off → mended; plates touch · — · — |
| Deepdelve · Kegs T5 (`delve_barrel5`) | 3/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | white glints, stencil holes; side plates 1 px off → mended; plates touch · — · — |
| Silkcut Gang · Torch line T1 (`silkcut_torch1_walk`) | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | wide brim reads; needle thin but there → — · — · — |
| Silkcut Gang · Torch line T2 (`silkcut_torch2_walk`) | 2/4/3 | 4/4/4 | 4/4/4 | 4/4/4 | ribbon bow on the snout reads as a bow tie → bow on the back shoulder · — · — |
| Silkcut Gang · Torch line T3 (`silkcut_torch3_walk`) | 2/4/3 | 4/4/4 | 4/4/4 | 4/4/4 | ribbon bow on the snout reads as a bow tie → bow on the back shoulder · — · — |
| Silkcut Gang · Torch line T4 (`silkcut_torch4_walk`) | 2/4/3 | 4/4/4 | 4/4/4 | 4/4/4 | ribbon bow on the snout reads as a bow tie → bow on the back shoulder · — · — |
| Silkcut Gang · Torch line T5 (`silkcut_torch5_walk`) | 2/4/3 | 4/4/4 | 4/4/4 | 4/4/4 | ribbon bow on the snout reads as a bow tie → bow on the back shoulder · — · — |
| Silkcut Gang · Bombers T1 (`silkcut_tnt1_walk`) | 2/4/4 | 2/4/4 | 4/4/4 | 4/4/4 | pP checker spools; bomb floats over the fist → wound-thread stripes; pad on the strap · thread ball in the fist, arm kept · — |
| Silkcut Gang · Bombers T2 (`silkcut_tnt2_walk`) | 2/4/3 | 2/4/4 | 4/4/4 | 4/4/4 | pP checker spools; bomb floats over the fist; bow on the mouth → wound-thread stripes; pad on the strap · thread ball in the fist, arm kept · — |
| Silkcut Gang · Bombers T3 (`silkcut_tnt3_walk`) | 2/4/3 | 2/4/4 | 4/4/4 | 4/4/4 | pP checker spools; bomb floats over the fist; bow on the mouth → wound-thread stripes; pad on the strap · thread ball in the fist, arm kept · — |
| Silkcut Gang · Bombers T4 (`silkcut_tnt4_walk`) | 2/4/3 | 2/4/4 | 4/4/4 | 4/4/4 | pP checker spools; bomb floats over the fist; bow on the mouth → wound-thread stripes; pad on the strap · thread ball in the fist, arm kept · — |
| Silkcut Gang · Bombers T5 (`silkcut_tnt5_walk`) | 2/4/3 | 2/4/4 | 4/4/4 | 4/4/4 | pP checker spools; bomb floats over the fist; bow on the mouth → wound-thread stripes; pad on the strap · thread ball in the fist, arm kept · — |
| Silkcut Gang · Kegs T1 (`silkcut_barrel1`) | 2/3/3 | 4/3/4 | 4/4/4 | 4/4/4 | flanges flat planks; thread band a pP checker (moiré); grass through holes → flanges are 3/4-view discs; thread wound in stripes; mended · both flanges from T1: a reel, not a brim · — |
| Silkcut Gang · Kegs T2 (`silkcut_barrel2`) | 2/3/3 | 4/3/4 | 4/4/4 | 4/4/4 | flanges flat planks; thread band a pP checker (moiré); grass through holes → flanges are 3/4-view discs; thread wound in stripes; mended · both flanges from T1: a reel, not a brim · — |
| Silkcut Gang · Kegs T3 (`silkcut_barrel3`) | 2/3/3 | 4/3/4 | 4/4/4 | 4/4/4 | flanges flat planks; thread band a pP checker (moiré); grass through holes → flanges are 3/4-view discs; thread wound in stripes; mended · both flanges from T1; loose thread end · — |
| Silkcut Gang · Kegs T4 (`silkcut_barrel4`) | 2/3/3 | 4/3/4 | 4/4/4 | 4/4/4 | flanges flat planks; thread band a pP checker (moiré); grass through holes → flanges are 3/4-view discs; thread wound in stripes; mended · both flanges from T1; loose thread end · — |
| Silkcut Gang · Kegs T5 (`silkcut_barrel5`) | 2/3/3 | 4/3/4 | 4/4/4 | 4/4/4 | flanges flat planks; thread band a pP checker (moiré); grass through holes → flanges are 3/4-view discs; thread wound in stripes; mended · both flanges from T1; loose thread end · — |
| Hexmoon Coven · Torch line T1 (`hexmoon_torch1_walk`) | 3/3/4 | 3/3/4 | 4/4/4 | 4/4/4 | "moon mask" is a pale disc stuck on the hood → — · mask on the face, eye holes and all · — |
| Hexmoon Coven · Torch line T2 (`hexmoon_torch2_walk`) | 2/3/3 | 3/3/4 | 4/4/4 | 4/4/4 | rune pad on the nose; disc on the hood → pad on the back shoulder · mask on the face, eye holes and all · — |
| Hexmoon Coven · Torch line T3 (`hexmoon_torch3_walk`) | 2/3/3 | 3/3/4 | 4/4/4 | 4/4/4 | rune pad on the nose; disc on the hood → pad on the back shoulder · mask on the face, eye holes and all · — |
| Hexmoon Coven · Torch line T4 (`hexmoon_torch4_walk`) | 2/3/3 | 3/3/4 | 4/4/4 | 4/4/4 | rune pad on the nose; disc on the hood → pad on the back shoulder · mask on the face, eye holes and all · — |
| Hexmoon Coven · Torch line T5 (`hexmoon_torch5_walk`) | 2/3/3 | 3/3/4 | 4/4/4 | 4/4/4 | rune pad on the nose; disc on the hood → pad on the back shoulder · mask on the face, eye holes and all · — |
| Hexmoon Coven · Bombers T1 (`hexmoon_tnt1_walk`) | 2/3/2 | 3/3/4 | 4/4/4 | 4/4/4 | full mask hides the goggles (the bomber tell); scroll case a shelf of eggs; vial floats → goggles back, lenses moonlit · scroll cases stand in the basket; vial in the fist · — |
| Hexmoon Coven · Bombers T2 (`hexmoon_tnt2_walk`) | 2/3/2 | 3/3/4 | 4/4/4 | 4/4/4 | full mask hides the goggles (the bomber tell); scroll case a shelf of eggs; vial floats → goggles back, lenses moonlit · scroll cases stand in the basket; vial in the fist · — |
| Hexmoon Coven · Bombers T3 (`hexmoon_tnt3_walk`) | 2/3/2 | 3/3/4 | 4/4/4 | 4/4/4 | full mask hides the goggles (the bomber tell); scroll case a shelf of eggs; vial floats → goggles back, lenses moonlit · scroll cases stand in the basket; vial in the fist · — |
| Hexmoon Coven · Bombers T4 (`hexmoon_tnt4_walk`) | 2/3/2 | 3/3/4 | 4/4/4 | 4/4/4 | full mask hides the goggles (the bomber tell); scroll case a shelf of eggs; vial floats → goggles back, lenses moonlit · scroll cases stand in the basket; vial in the fist · — |
| Hexmoon Coven · Bombers T5 (`hexmoon_tnt5_walk`) | 2/3/2 | 3/3/4 | 4/4/4 | 4/4/4 | full mask hides the goggles (the bomber tell); scroll case a shelf of eggs; vial floats → goggles back, lenses moonlit · scroll cases stand in the basket; vial in the fist; standard planted · — |
| Hexmoon Coven · Kegs T1 (`hexmoon_barrel1`) | 3/3/4 | 4/3/4 | 4/3/4 | 4/4/4 | white glints busy; thin hooked crescent reads as a spanner → mint glints, stones strapped on · crumbs cleared · fat crescent moon; moon-and-stars plate |
| Hexmoon Coven · Kegs T2 (`hexmoon_barrel2`) | 3/3/4 | 4/3/4 | 4/3/4 | 4/4/4 | white glints busy; thin hooked crescent reads as a spanner → mint glints, stones strapped on · crumbs cleared · fat crescent moon; moon-and-stars plate |
| Hexmoon Coven · Kegs T3 (`hexmoon_barrel3`) | 2/3/4 | 4/3/4 | 4/3/4 | 4/4/4 | white glints busy; thin hooked crescent reads as a spanner; rune stones float → mint glints, stones strapped on · crumbs cleared · fat crescent moon; moon-and-stars plate |
| Hexmoon Coven · Kegs T4 (`hexmoon_barrel4`) | 2/3/4 | 4/3/4 | 4/3/4 | 4/4/4 | white glints busy; thin hooked crescent reads as a spanner; rune stones float → mint glints, stones strapped on · crumbs cleared · fat crescent moon; moon-and-stars plate |
| Hexmoon Coven · Kegs T5 (`hexmoon_barrel5`) | 2/3/4 | 4/3/4 | 4/3/4 | 4/4/4 | white glints busy; thin hooked crescent reads as a spanner; rune stones float → mint glints, stones strapped on · crumbs cleared · fat crescent moon; moon-and-stars plate |
| Elite / armour badge (field) (`badge`) | 4/3/3 | 4/3/3 | 4/3/3 | 4/4/4 | Plated shield / Warded diamond ringed in the same gold as Swift: nothing ties it to the map tab → — · — · ring wears the armour colour (ARMOUR_INK = --armour-*) |
| Tier ticks in the HP bar (`ticks`) | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | count reads at 1×; sits over the tallest part → — · — · — |
| Boss plate (HUD) (`bossplate`) | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | clan champion name, war-cry pips, HP → — · — · — |
| Run map armour tab (.mn-armour) (`maptab`) | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | name + struck damage mark in the armour colour → — · — · — |
