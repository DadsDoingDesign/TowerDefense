# Icon family — three-round critique (Oct 2026)

The designer: "do 3 rounds of critiques to improve every asset along a rubric of
aesthetics, brand, and its job". This is the icon family: the atlas's item cells
and skill marks (`scripts/fw-icons.ts` → `public/assets/ui/fw-icons.png`,
`src/game/data/iconAtlas.ts`), what picks a skill's mark (`skills.skillHeadline`),
the Peoples & Trades draft icons and tells (`scripts/peoples-art/`,
`harness/peoples-tells.ts`), and their use at real size in the shell.

**Rubric** (1–5 each): **A**esthetics — would Pixel Frog have drawn it (closed
outline, upper-left light, the pack's 2–3-step ramps, density right for its
size, a clear 1× silhouette, no busier than its neighbours); **B**rand — warm
storybook medieval, teal for interactive, gold for value, the right people and
trade; **J**ob — can a player tell what it is, and its siblings apart, at the
size it is used (16 px on a line, 32 px in the pack and gear, 48 px in the
Codex and on the shelf).

**How it was judged.** Every round rendered the real thing: the atlas through
the generator, the drafts through `artRGBA` and the harness (`harness/peoples.html`,
the real `drawSentinel`), the figure through `harness/kit.html`, and the running
app through Playwright (Codex items and skills tabs, the Pack grid, Gear, the
hero card, the merchant shelf, the spoils hand, the upgrade panel; 390 × 844 at
DPR 2 and 1280 × 800). Each icon was looked at at 1×, 2×, 3×, 6× and 8× on dark
wood and on parchment, beside the CC0 pickups (gold, meat, wood) and system
icons (gear, lock, cart, sound). Scores are written as A/B/J.

- **Round 1** fixed everything that misread outright: the ghost Robe, the tooth
  Plate, the framed-gem Grimoire, the target Banner, a left-pointing Haste,
  the skill-mark order, the 14 px sword, and fifteen drafts (a spider, a bone,
  a bird, a ring, a TV…), plus three checker-making tell marks.
- **Round 2** took the noise out (every dithered body piece and shield), the
  flat ramps (Hammer), the Execute mark (R1's guillotine read as a picture
  frame) and the next tier of misreads (Silkwind, Relic, Berserk, Venom Spit,
  Herb Pouch, Thornweave Hood, the dark staffs).
- **Round 3** re-scored all 236 assets in the app and on the sheets and fixed
  what still scored under 4 where a redraw could help: Silkwind (still a bird),
  Moonsilk Mantle (still a jellyfish), Gator Buckler (an urchin), and the
  Spiced Blade (the Sword's outline).

No rule, number, stat, name or RNG draw changed. `skillHeadline`'s table order
is presentation: it picks which of a skill's effects its mark and token show.

## Score distribution, before → after (236 assets)

| Axis | Before (R0) | After (R3) |
|---|---|---|
| Aesthetics | 2: 7 · 3: 41 · 4: 188 | 3: 3 · 4: 233 |
| Brand | 3: 2 · 4: 234 | 3: 2 · 4: 234 |
| Job | 2: 23 · 3: 32 · 4: 181 | 3: 21 · 4: 215 |

Assets with any axis under 4: **68 → 26**.

## Atlas · item cells (ship) (30)

| Asset | R0 | R1 | R2 | R3 | Why (R0) | What changed |
|---|---|---|---|---|---|---|
| blade | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Clean diagonal sword, 1px lit edge, leather grip; the family baseline. | — |
| dagger | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | A short sword; reads as the Sword's little sibling, which it is. | — |
| axe | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Double-bit head on a haft: unmistakable at 16 px. | — |
| wand | 4/4/3 | 4/4/3 | 4/4/3 | 4/4/3 | Short stick with a violet tip; at 1x only the tip colour tells it from Rod/Sceptre/Staff. | — |
| sceptre | 4/4/3 | 4/4/3 | 4/4/3 | 4/4/3 | Gold knob on a stick; one of four diagonal sticks told apart by the tip alone. | — |
| greatblade | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Wider, longer blade with a leather guard: reads bigger than the Sword. | — |
| hammer | 3/4/4 | 3/4/4 | 4/4/4 | 4/4/4 | Flat head, the light in the middle of the face (no ramp) - flatter than its neighbours. | R2: head shaded from the upper left (cream catch-light, mid, dark under-edge). |
| bow | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Bow with a nocked arrow; the archer's cell. | — |
| staff | 4/4/3 | 4/4/3 | 4/4/3 | 4/4/3 | Long stick with a teal crystal; 39-50 px from Wand/Sceptre - tip colour carries it. | — |
| grimoire | 3/4/2 | 4/4/4 | 4/4/4 | 4/4/4 | Concentric violet/cream/gold squares: a framed gem or picture, not a book. | R1: a violet book like the Tome's family - page edges, gold corners, gold eye sigil, clasp. |
| shield | 3/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Flat steel heater with one highlight pixel; no ramp. | R1: three-step steel ramp from the upper left; same silhouette. |
| quiver | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Leather tube with fletchings: clear. | — |
| orb | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Crystal ball on a stand; the Focus. | — |
| plate | 3/4/2 | 4/4/4 | 4/4/4 | 4/4/4 | A grey tooth/ghost with two legs; flat fill. | R1: a cuirass - shoulder caps, neck notch, waist band, fauld; steel ramp. Keeps the BODY_INK inks. |
| cloth | 3/4/2 | 4/4/4 | 4/4/4 | 4/4/4 | Cream hood with a black eye-slot: reads as a ghost. | R1: a robe - sleeves apart from the body, V neck, cord belt, floor-length skirt. Same three parchment inks. |
| banner | 3/4/2 | 4/4/4 | 4/4/4 | 4/4/4 | Gold-ringed red square on a post: an archery target or a sign. | R1: a hanging banner - crossbar, red cloth, gold lozenge, swallowtail, pole through the notch. |
| relic | 3/4/3 | 3/4/3 | 4/4/3 | 4/4/3 | Gold pedestal with a black hole: a one-eyed idol, unclear. | R2: a gold locket on a chain with a red gem. Clear object; still close to a flask at 1x. |
| beacon | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Lantern flame on a steel bell; reads as a light. | — |
| brand | 3/4/4 | 3/4/4 | 3/4/4 | 3/4/4 | Gold blade with red flame licks: shinier than any neighbour (the Sovereign tier earns some of that). | — |
| rod | 4/4/3 | 4/4/3 | 4/4/3 | 4/4/3 | Steel rod, gold bands, red gem; a fourth diagonal stick. | — |
| tome | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Brown book, page edges, red ribbon. | — |
| codex | 4/3/4 | 4/3/4 | 4/3/4 | 4/3/4 | Teal codex, crescent, quill - clear, but it is Moonquill's mark and that slot is Greenvial's gnomes now. | — |
| buckler | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Small round wooden shield with a steel rim. | — |
| pavise | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Tall red wall-shield with feet. | — |
| easel | 4/3/4 | 4/3/4 | 4/3/4 | 4/3/4 | Gold frame on easel legs - Easel House's off-hand, and that slot is Butcherblock's now. | — |
| mail | 3/4/4 | 3/4/4 | 3/4/4 | 3/4/4 | Chain as a 1px checker - the convention reads at 1x, but it is the dither the pack never uses. | — |
| aegis | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Rounded cuirass, gold rim and sun. | — |
| ironheart | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Dark iron plate, red heart. | — |
| cloak | 3/4/3 | 3/4/4 | 3/4/4 | 3/4/4 | Green triangle with a hood hole and red door: a tent. | R1: tried a cape with folds (a melon) - replaced the same round by a hooded figure: narrow hood, dark face slot, clasp, shoulders, cape, red lining. |
| silkwind | 3/4/2 | 3/4/2 | 3/4/3 | 4/4/4 | Violet blob with an eye and a body: a bird / an aubergine. | R2: hood and billow - still a bird. R3: the new Cloak's hooded figure in violet, gold lining, hem kicked right, wind streaks: Cloak's sibling. |

## Atlas · skill marks (ship) (21)

| Asset | R0 | R1 | R2 | R3 | Why (R0) | What changed |
|---|---|---|---|---|---|---|
| haste | 4/4/2 | 4/4/4 | 4/4/4 | 4/4/4 | Gold chevrons pointing LEFT: rewind, on Speed +15% and every Rush skill. | R1: haste points right (forward, like Start Wave), slow takes the left; the pair stays mirrored. |
| slow | 4/4/3 | 4/4/4 | 4/4/4 | 4/4/4 | Steel chevrons pointing right: the faster-looking one of the pair. | R1: mirrored with haste. |
| damage | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Three red slashes. | — |
| range | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Teal reticle eye. | — |
| crit | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Red/gold burst. | — |
| burn | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Flame, three-step ramp. | — |
| chill | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Teal snowflake. | — |
| shock | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Gold bolt. | — |
| stun | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Three stars, no disc. | — |
| execute | 3/4/2 | 3/4/3 | 4/4/4 | 4/4/4 | A white funnel over a red bar: a goblet or hourglass. | R1: guillotine posts round the blade - read as a picture frame at 48 px. R2: the blade falling on a nearly empty HP bar (red sliver, steel empty): the rule, drawn. |
| lifedrain | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Red drop. | — |
| splash | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Red core, dashed orange ring. | — |
| pierce | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Arrow through bars. | — |
| projectile | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Arrow with fletching dashes. | — |
| block | 4/4/3 | 4/4/3 | 4/4/3 | 4/4/3 | Shield with a teal band - one band away from the Shield item. | — |
| thorns | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Green spiky ring. | — |
| trap | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Steel jaws. | — |
| auraBuff | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Gold dashed ring with an up arrow. | — |
| hp | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Heart. | — |
| gold | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Gold coin. | — |
| boon | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Laurel with a gold cross. | — |

## In the shell, at real size (ships) (10)

| Asset | R0 | R1 | R2 | R3 | Why (R0) | What changed |
|---|---|---|---|---|---|---|
| skill-headline | 4/4/2 | 4/4/3 | 4/4/3 | 4/4/3 | skillHeadline read multipliers first: 18 skills drew a mark their own first words contradict (Heavy Blows -> speed, Snare/Anchor -> chill, Finisher -> damage). | R1: named effects first, then damage before speed; every skill now leads with its sentence (pinned in tests). Codex Level 1 still shows four Rush skills on one chevron. |
| hcard-tag-14px | 2/4/3 | 4/4/4 | 4/4/4 | 4/4/4 | The hero card's "Swings" sword at 14 px: pixelated drops two rows and columns, the outline breaks. | R1: 16 px (--icon-sm), a whole multiple. |
| codex-items-tile | 4/4/3 | 4/4/4 | 4/4/4 | 4/4/4 | 48 px tiles: Robe/Plate/Grimoire/Cloak misread (ghost, tooth, frame, tent). | R1-R3: those cells redrawn; every body and book reads at 48 px. |
| codex-skills-tile | 4/4/2 | 4/4/3 | 4/4/3 | 4/4/3 | Skill tiles: 4 x speed chevrons, 4 x slashes, a flame on "Poisoned Tips", chill on Snare/Anchor. | R1: execute/trap/stun/hold appear where the skill says them; same-effect families (the Rush skills) still share one cell. |
| pack-grid | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | 32 px tiles with rarity letter and damage mark; the icons read. | — |
| gear-doll | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | 32 px slot marks on the doll. | — |
| hero-card-slots | 4/4/3 | 4/4/4 | 4/4/4 | 4/4/4 | Skill slots draw the headline cell: Heavy Blows showed speed. | R1: follows the headline fix. |
| merchant-shelf | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | 48 px wares under the scene; icons read (checked in the app). | — |
| spoils-offer | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Offer cards at 32/48 px; icons read. | — |
| upgrade-panel | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Owed skill tokens and worn pieces at 32 px. | — |

## Peoples & Trades · draft icons (125)

| Asset | R0 | R1 | R2 | R3 | Why (R0) | What changed |
|---|---|---|---|---|---|---|
| humans/Arming Sword | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Upright sword: tells from the diagonal Sword by pose and its cross guard. | — |
| humans/Kite Shield | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Leather kite with a red cross. | — |
| humans/Gambeson | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Quilted cream tunic, red stitching. | — |
| humans/Falchion | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Curved chopping blade. | — |
| humans/Spiced Blade | 3/4/2 | 3/4/2 | 3/4/3 | 4/4/4 | Red/cream candy stripe; same silhouette as the Sword (38 px apart). | R2: steel blade with a red edge - still the Sword's outline. R3: a wavy red edge and a flame at the tip change the outline; steel back. |
| humans/Halberd | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Axe-blade on a pole. | — |
| humans/Banner Pole | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Red flag on a pole with a cream cross. | — |
| humans/Heater Shield | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Split steel/red heater. | — |
| humans/Brigandine | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Red studded vest. | — |
| humans/Pepperport Sabre | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Thin curved blade, gold D-guard. | — |
| humans/Captain's Shield | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Gold-rimmed red shield, steel chevron. | — |
| humans/Sergeant's Cuirass | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Steel cuirass, red V. | — |
| humans/Pepperport Standard | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Red standard with a gold pepper. | — |
| humans/Saltmarsh Warplate | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Gold-trimmed plate with a red tabard. | — |
| humans/Spicy Peps | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | A chili: the signature reads at once. | — |
| humans/Hard Hitter | 3/4/2 | 4/4/4 | 4/4/4 | 4/4/4 | Front fist with white rivet dots: a robot head. | R1: a steel fist - knuckle row, fold line, thumb across, cuff, red impact sparks. |
| humans/Charge | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Boot with speed lines. | — |
| humans/Hold Fast | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Open gauntlet. | — |
| humans/Shield Wall | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Shield with side shields. | — |
| humans/Wildfire | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Spreading flames. | — |
| humans/Firebrand | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Torch. | — |
| humans/Banner Bearer | 3/4/3 | 4/4/4 | 4/4/4 | 4/4/4 | Pennant over cream chevrons pointing nowhere in particular. | R1: a red swallowtail pennant on its pole beside gold haste chevrons (the speed it gives). |
| humans/Rally | 3/4/2 | 4/4/4 | 4/4/4 | 4/4/4 | A straight cream tube with a lump: a bone. | R1: a curved war horn - flared bell with a dark mouth, gold band, leather mouthpiece, sound marks. |
| humans/Weaponmaster | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Crossed sword and axe. | — |
| elves/Shortbow | 3/4/2 | 4/4/4 | 4/4/4 | 4/4/4 | Limbs and string close into an O: a ring. | R1: a small diagonal D-bow, green grip, straight string: smaller than Bow and Longbow. |
| elves/Silk Wrap | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Violet tunic with a sash. | — |
| elves/Longbow | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Tall green bow. | — |
| elves/Twin Knives | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Crossed knives. | — |
| elves/Barbed Quiver | 3/4/3 | 4/4/3 | 4/4/3 | 4/4/3 | Violet bag with three heads and green spots: a creature. | R1: a violet silk quiver, teal strap, two barbed steel heads. The heads still read a little like ears. |
| elves/Woven Vest | 3/4/3 | 3/4/3 | 4/4/3 | 4/4/3 | Two separate green checker halves. | R2: one vest - woven rows, cream lacing down the front. At 1x it is a green slab. |
| elves/Thornweave Hood | 3/4/3 | 3/4/3 | 4/4/4 | 4/4/4 | Front hood with a huge black hole: a ring. | R2: a 3/4 hood, the face opening to the right, thorns on the crown. |
| elves/Recurve Bow | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Violet recurve. | — |
| elves/Loomwarden Bow | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Bow with three arrows; busy but clear. | — |
| elves/Ranger's Dirk | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Long dagger. | — |
| elves/Starfeather Quiver | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Teal-fletched quiver. | — |
| elves/Moonsilk Mantle | 3/4/2 | 3/4/2 | 3/4/2 | 4/4/3 | Teal dome with fringe: a jellyfish. | R1: still a jellyfish. R2: a V capelet - read as a gem. R3: a capelet - neck hole, gold clasp, crescent, silver hem. Clear object; still could be a dome. |
| elves/Starstring Longbow | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Gold longbow. | — |
| elves/Whisperfang | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | A sickle blade. | — |
| elves/Starweave | 4/4/2 | 4/4/4 | 4/4/4 | 4/4/4 | Eight-armed white/teal star: the chill snowflake. | R1: a four-point silver star threaded by a violet needle line - a woven star. |
| elves/Quick Hands | 3/4/2 | 4/4/4 | 4/4/4 | 4/4/4 | Violet bird with a checker tail. | R1: a violet silk glove with cream motion lines, teal cuff. |
| elves/Keen Eye | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Eye with a gold glint. | — |
| elves/Long Reach | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Long diagonal arrow. | — |
| elves/Pin Down | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Arrow pinned in the ground. | — |
| elves/Long Shot | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Arrow into a target. | — |
| elves/Split Shot | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Forked arrow. | — |
| elves/Deadeye | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Violet reticle. | — |
| elves/Snare | 3/4/3 | 4/4/4 | 4/4/4 | 4/4/4 | Green loop on a stick: a lollipop or a stop sign. | R1: a noose snare - bent sapling, cord with an ember, the loop lying on the ground. |
| elves/Volley | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Three arrows. | — |
| dwarves/Hand Hammer | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Short steel hammer. | — |
| dwarves/Miner's Pick | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Pick. | — |
| dwarves/Round Shield | 3/4/4 | 3/4/4 | 4/4/4 | 4/4/4 | Wood drawn as a 1px leather checker. | R2: two-pixel planks, steel rim and boss. |
| dwarves/Chainshirt | 3/4/3 | 3/4/3 | 4/4/4 | 4/4/4 | Steel-blue checker; the Mail's twin in texture. | R2: banded steel shirt, short sleeves, leather belt with a gold buckle, ragged hem. |
| dwarves/Forge Apron | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Leather apron. | — |
| dwarves/Bearded Axe | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Bearded axe-head. | — |
| dwarves/Maul | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Long maul. | — |
| dwarves/Rune Shield | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Blue shield, teal rune. | — |
| dwarves/Stoneskin Mail | 2/4/3 | 2/4/3 | 4/4/4 | 4/4/4 | Cream/brown speckle: noise. | R2: a vest of stone slabs in a brick bond, mortar lines. |
| dwarves/Greataxe | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Double greataxe. | — |
| dwarves/Quarry Breaker | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Hammer with a chisel. | — |
| dwarves/Anvil Shield | 4/4/3 | 4/4/3 | 4/4/3 | 4/4/3 | An anvil: reads as the anvil, not as a shield. | — |
| dwarves/Deepforge Plate | 3/4/3 | 3/4/3 | 4/4/4 | 4/4/4 | Blue plate under red/gold stripes. | R2: dark steel cuirass with a molten seam down the centre. |
| dwarves/Mountainbreaker | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Gold-framed hammer, mountain. | — |
| dwarves/Thane's Bulwark | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Tower shield with a crown. | — |
| dwarves/Bolder Bash | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Boulder with stars. | — |
| dwarves/Cleave | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Axe with a sweep arc. | — |
| dwarves/Riposte | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Spiked shield. | — |
| dwarves/Heavy Blows | 4/4/3 | 4/4/3 | 4/4/3 | 4/4/3 | Hammer on anvil; busy. | — |
| dwarves/Ore Sense | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Rock with gems. | — |
| dwarves/Stunning Bash | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Hammer and stars. | — |
| dwarves/Anchor | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Anchor. | — |
| dwarves/Bulwark | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Wall. | — |
| dwarves/Momentum | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Gear. | — |
| dwarves/Warden of Ash | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Brazier. | — |
| reptilians/Spear | 4/4/3 | 4/4/3 | 4/4/3 | 4/4/3 | Bone-tipped spear; 39 px from the Staff, differs by tip, not shape. | — |
| reptilians/Fang Knife | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Curved bone knife. | — |
| reptilians/Bone Club | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Bone club. | — |
| reptilians/Leather | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Leather jerkin. | — |
| reptilians/Hide Wrap | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | A pelt. | — |
| reptilians/Cleaver | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Cleaver with a hang hole. | — |
| reptilians/Meat Hook | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Hook. | — |
| reptilians/Harpoon | 4/4/3 | 4/4/3 | 4/4/3 | 4/4/3 | Barbed harpoon; crossbars make it busy. | — |
| reptilians/Gator Buckler | 2/4/3 | 2/4/3 | 3/4/3 | 4/4/4 | Green dither disc ringed by teeth: noise. | R2: a green ball with bumps - an urchin. R3: a buckler - wooden rim, green face shaded from the upper left, a bony ridge. |
| reptilians/Javelin Sling | 2/4/2 | 4/4/4 | 4/4/4 | 4/4/4 | A tangle of sticks. | R1: one javelin in flight - bone tip, red fletching, speed lines. |
| reptilians/Scale Hide | 3/4/4 | 3/4/4 | 4/4/4 | 4/4/4 | Teal checker vest. | R2: staggered scale rows; still busy at 3x. |
| reptilians/Glaive | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Pole blade. | — |
| reptilians/Bonecrusher | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Bone mace. | — |
| reptilians/Venom Fang | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Green blade. | — |
| reptilians/Stalker Leathers | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Blue leathers, strap. | — |
| reptilians/Smokehouse Apron | 3/4/2 | 4/4/3 | 4/4/4 | 4/4/4 | A framed canvas: a TV. | R1: an apron - strap, bib, skirt, coin pocket; the ties read as arms. R2: ties cut for a belt with a gold buckle. |
| reptilians/Kingscale Shield | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Teal scale shield, gold crown. | — |
| reptilians/Wyrmtooth Spear | 4/4/3 | 4/4/3 | 4/4/3 | 4/4/3 | A third diagonal bone spear. | — |
| reptilians/Butcher-King's Cleaver | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Crowned cleaver. | — |
| reptilians/Blood Price | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Coin and drop. | — |
| reptilians/Poisoned Tips | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Tip dripping green. | — |
| reptilians/Bloodrush | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Drop with chevrons. | — |
| reptilians/Bounty | 3/4/3 | 4/4/4 | 4/4/4 | 4/4/4 | A zigzag of coins: a spring. | R1: a stack of four coins, rims shaded. |
| reptilians/Killing Spree | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Red claw marks. | — |
| reptilians/Finisher | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Skull with a slash. | — |
| reptilians/Venom Spit | 3/4/3 | 3/4/3 | 4/4/3 | 4/4/3 | A round teal head: a fish. | R2: a lizard profile - flat brow, long snout, open jaw, spit. Still a little fish-like. |
| reptilians/Berserk | 3/4/2 | 3/4/2 | 4/4/3 | 4/4/3 | A teal box of teeth: a mimic chest. | R2: a reptile face - red eyes, fangs, red throat. Still reads as a monster, not as rage. |
| reptilians/Reaper | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Scythe. | — |
| reptilians/Hexblade | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Violet blade. | — |
| gnomes/Sprout Wand | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Wand with a sprout. | — |
| gnomes/Herb Pouch | 3/4/2 | 3/4/2 | 4/4/3 | 4/4/3 | Cream bulb with green sprouts: a turnip. | R2: a leather pouch with a drawstring; herbs still make it an onion at 1x. |
| gnomes/Thornrod | 3/4/3 | 3/4/3 | 4/4/4 | 4/4/4 | Dark green on dark: low contrast at 1x. | R2: lit green shaft with thorns, bright bud. |
| gnomes/Spark Coil | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Gold coil, sparks. | — |
| gnomes/Flask | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Green potion flask. | — |
| gnomes/Mossweave Robe | 2/4/2 | 4/4/4 | 4/4/4 | 4/4/4 | Green dither blob: a bush. | R1: the Robe's silhouette in moss green, rope belt, mossy hem. |
| gnomes/Brew Belt | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Belt of vials. | — |
| gnomes/Bloomstaff | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Staff with a flower. | — |
| gnomes/Philter Rack | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Rack of vials; busy. | — |
| gnomes/Alchemist's Coat | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Brown coat. | — |
| gnomes/Greenvial Herbal | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Green book, leaf. | — |
| gnomes/Worldroot Staff | 3/4/3 | 3/4/3 | 4/4/4 | 4/4/4 | Dark brown on dark: a tree creature. | R2: lit wood, glowing green orb, gold collar, roots joined (no diagonal flecks). |
| gnomes/Elixir of Plenty | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Gold elixir. | — |
| gnomes/Thornbloom | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Flower with thorns. | — |
| gnomes/Arc Spark | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Two posts and a zap. | — |
| gnomes/Frostbite | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Icicle. | — |
| gnomes/Blessing | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Sprout under a halo. | — |
| gnomes/Siphon | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Potion with a tube. | — |
| gnomes/Cold Snap | 3/4/2 | 4/4/4 | 4/4/4 | 4/4/4 | Teal diamond with a dark line: the range reticle. | R1: an ice block split by a zigzag crack. |
| gnomes/Overgrowth | 3/4/2 | 4/4/3 | 4/4/3 | 4/4/3 | Radial green legs: a spider. | R1: a vine coiled up a stake, leaves, soil. Reads as a plant; the slow is in the tell. |
| gnomes/Last Rites | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Tombstone. | — |
| gnomes/Tinker's Spark | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Gear and bolt. | — |
| gnomes/Stormcaller | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Storm cloud and bolt. | — |

## Peoples & Trades · draft tells (50)

| Asset | R0 | R1 | R2 | R3 | Why (R0) | What changed |
|---|---|---|---|---|---|---|
| humans/Spicy Peps | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Chilis down the back. | — |
| humans/Charge | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Speed streaks off the back. | — |
| humans/Hold Fast | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | One shield at the feet. | — |
| humans/Shield Wall | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Three red shields. | — |
| humans/Wildfire | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Ember ring. | — |
| humans/Firebrand | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Thorn ring with embers. | — |
| humans/Rally | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Gold aura. | — |
| humans/Weaponmaster | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Three orbiting stars - shiny but small. | — |
| elves/Quick Hands | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Violet arrow motes. | — |
| elves/Keen Eye | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Gold sight. | — |
| elves/Long Reach | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Teal double ring. | — |
| elves/Pin Down | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Arrow pips. | — |
| elves/Long Shot | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Teal halo. | — |
| elves/Split Shot | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Arrow pips and ring. | — |
| elves/Deadeye | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Red sight and pips. | — |
| elves/Volley | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Orbiting arrows. | — |
| dwarves/Bolder Bash | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Ring and dust. | — |
| dwarves/Cleave | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Sparks at the weapon. | — |
| dwarves/Riposte | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Held arc, two shields. | — |
| dwarves/Heavy Blows | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Gold halo. | — |
| dwarves/Ore Sense | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Teal pips. | — |
| dwarves/Stunning Bash | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Stun glint. | — |
| dwarves/Bulwark | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Four shields. | — |
| dwarves/Momentum | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Orbiting gears. | — |
| dwarves/Warden of Ash | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Thorns, embers, burn glint. | — |
| reptilians/Blood Price | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Chill glint, orbiting drops. | — |
| reptilians/Poisoned Tips | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Green halo. | — |
| reptilians/Bloodrush | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Red streaks. | — |
| reptilians/Bounty | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Coin pips. | — |
| reptilians/Killing Spree | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Orbiting fangs. | — |
| reptilians/Finisher | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Execute glint. | — |
| reptilians/Venom Spit | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Green drops at the feet. | — |
| reptilians/Berserk | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Red halo and ring. | — |
| reptilians/Reaper | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Orbiting skulls. | — |
| reptilians/Hexblade | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Stun glint, violet halo. | — |
| gnomes/Arc Spark | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Shock glint, sparks. | — |
| gnomes/Frostbite | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Chill glint. | — |
| gnomes/Blessing | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Green aura. | — |
| gnomes/Siphon | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Drain glint. | — |
| gnomes/Last Rites | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Orbiting leaves. | — |
| gnomes/Tinker's Spark | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Gear pip, teal halo. | — |
| gnomes/Stormcaller | 4/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Shock glint, double ring. | — |
| humans/Hard Hitter | 4/4/3 | 4/4/3 | 4/4/3 | 4/4/3 | A faint red halo at the fist: barely there at 1x. | — |
| humans/Banner Bearer | 3/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | The pennant's emblem is a zigzag ringed pixel by pixel: a checker. | R1: a solid cream cross, unoutlined. |
| elves/Starweave | 2/4/3 | 4/4/4 | 4/4/4 | 4/4/4 | Three white stars stacked by the head: a white checker blob. | R1: the stars in Rosethread violet with a light centre; readable as three stars. |
| elves/Snare | 3/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Roots as diagonal pixel lines: each step ringed alone, a checker. | R1: pixLine is 4-connected (a corner cell on every diagonal step) - solid roots. Same fix for every root/chain tell. |
| dwarves/Anchor | 3/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Chain as a diagonal pixel line: broken. | R1: 4-connected line. |
| gnomes/Thornbloom | 3/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Roots: checker. | R1: 4-connected roots. |
| gnomes/Overgrowth | 3/4/4 | 4/4/4 | 4/4/4 | 4/4/4 | Roots: checker. | R1: 4-connected roots. |
| gnomes/Cold Snap | 2/4/3 | 4/4/4 | 4/4/4 | 4/4/4 | Flake pips = an X whose corners touch only diagonally: two checker blobs. | R1: the flake pip is a solid diamond. |

## Still weakest (honest)

1. **The casting sticks.** Wand, Sceptre, Rod and Staff (and, in the drafts,
   Spear, Halberd, Bloomstaff, Thornrod) are one diagonal stick each, told apart
   by the tip alone: 39–50 px of 256 apart. At 16 px on a text line they are one
   shape. A new silhouette per stick would change what every caster holds on the
   field, so it waits for the designer.
2. **A skill's mark is its effect's mark, not the skill's picture.** The fix
   above stops marks contradicting their skills, but the Codex skills tab still
   puts five Rush skills on one chevron and six "harder" skills on the slashes.
   Per-skill icons exist only in the Peoples & Trades drafts; shipping them is
   the world rework's call.
3. **Moonsilk Mantle**: four drafts (jellyfish, jellyfish, gem, dome). It is a
   clear capelet at 3× and still a teal dome at 1×.
4. **Mail** is the atlas's one dither (a 1 px checker). Chain reads that way at
   16 px by convention, but it is the texture the pack never uses.
5. **Saffron Brand** stays busier and shinier than its row (the Sovereign tier
   earns some of it).
6. **Moonquill Codex and Gilded Easel** are the retired houses' marks; their
   slots are Greenvial's gnomes and Butcherblock's reptilians now.
7. **The reptile heads** (Berserk, Venom Spit) read as a monster and a fish
   before they read as rage and venom. **Herb Pouch** is still a little onion;
   **Overgrowth** a plant on a stick; **Barbed Quiver**'s heads a little like
   ears; **Woven Vest** a green slab at 1×; **Relic** close to a flask.
8. **Hold (`block`)** is one teal band away from the Shield item.
9. **Hard Hitter's tell** is a faint red halo at the fist, barely there at 1×.
10. **The kept gnome cells** (Wand, Sceptre, Staff, Grimoire, Tome, Robe) are
    not re-themed, so the gnomes read as a family only through their new items.
11. **Not re-rendered here:** `docs/item-assets/` (the Figma page's renders)
    and `docs/peoples/` (the sheets and cards) still show the old cells; the
    main session re-renders them after the merge.

## Cards

`cards/` — one 600 px card per changed asset (before and after at 16, 32 and
48 px in context and at 4×, the scores before → after), the system cards
(the skill mark, the 16 px tag, four tells), and an overview of all 176
icons; `cards/manifest.json` lists them.
