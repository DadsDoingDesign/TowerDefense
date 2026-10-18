# Marks, flags, the home map and the shell's pixel art: scorecard

The designer's ask (Oct 2026): "do 3 rounds of critiques to improve every asset along a rubric of aesthetics, brand, and its job".

**Family.**
- The company crests and the shared pixel marks (`src/ui/pixel.tsx`, `game/data/companies.ts`, `game/data/pixelArt.ts`).
- The brand mark and the wordmark.
- The company standards and their kits.
- The militia banner builder's parts.
- The wagon's flag.
- The home trade map (`ui/attract/paintMap.ts`), with its plates, purse, signposts, leaders and season bars.
- The Codex tile frames.
- The rarity tokens and the currency marks (`ui/channels.ts`).

**Rubric.** Each asset is scored 1–5 on three axes:
- **A, aesthetics:** crisp at 1× and 2×; closed outline; light from the upper left; the pack's ramps; no mud or noise.
- **B, brand:** follows `docs/BRAND.md` (warm storybook, gold for money, teal for action), and says its company's trade at a glance.
- **J, job:** does its one job at the size it is shown.

Anything under 4 was fixed, worst first.

**How each round was judged.**
- **The running app.** Playwright at 390 × 844 (@2×) and 1280 × 800, on these screens:
  - the home with each of the five companies focused, and with Buy Company;
  - terms, charter, militia create and edit, track, livery, standings, Codex, receipt;
  - a battle, for the wagon's flag.
  - Scripts: `scripts/meta-shots.mjs`, plus this pass's home, battle and harness shooters, kept in a scratch folder.
- **The marks on their own.** The new harness, `harness/marks.html`, draws every mark from the shipping rows and components at 1×, 2×, 4× and 8× on wood, panel, parchment and map ground.
  - `?proposal=1` adds the two unshipped companies.
- **Checks.** `scripts/home-stability.mjs` passes after every round: every focus keeps the home's geometry, framing and terrain.

## Rounds

- **Round 1** (the worst first):
  - the Ironvein crest, the coin, the small lock, the Peppercorn chili;
  - the standards' logo contrast;
  - the Rosethread, Moonquill and Easel House crests, and the locked padlock;
  - the Codex tile literals, and eight 5 × 5 emblems.
- **Round 2** (re-shot, zoomed to 8×):
  - The Sovereign crest's and the Crown's jewels read as a **smiling face**. Both redrawn, and the shield's two-row stem tip fixed.
  - The gold rim was a 1 px hairline in the *themed* accent, so it was lime under Peppercorn. It is now one crest pixel wide, in `--gold`.
  - The map's towns became houses and its pines are lit.
- **Round 3** (re-shot):
  - The map's peaks read as tents; they now have a shoulder.
  - The towns' roofs were near-black; they are warm now.
  - Every screen re-shot, and the proposals drawn.

## Scores (A / B / J), every asset × round

R0 is the asset as found. A dash means the asset did not change in that round.

| # | Asset | Where it shows | R0 | R1 | R2 | R3 | What changed |
|---|---|---|---|---|---|---|---|
| 1 | Peppercorn crest | dock, card, track, signpost, notices | 3/2/3 | 4/4/4 | – | 4/4/4 | The fat lime sausage read as a pickle. Now a chili that hangs from a green cap and curls to its tip. |
| 2 | Easel House crest | same | 3/3/4 | 4/4/4 | – | 4/4/4 | Random daubs on a lilac board read as a screen. Now a painting: a sun over a hill, in a wooden frame. |
| 3 | Ironvein crest | same | 2/3/2 | 4/4/4 | – | 4/4/4 | A brown rock with a 3 px blue vein: at dock size, a grey sack. Now a blue-steel pick over a lump of ore with a blue crystal. |
| 4 | Rosethread crest | same | 3/3/3 | 4/4/4 | – | 4/4/4 | The dotted winding read as a jar. Now one sheen down the lit side, with shaded wooden flanges. |
| 5 | Moonquill crest | same | 3/3/3 | 4/4/4 | – | 4/4/4 | The quill was a solid blade, so the mark read as a scimitar. Now a feather: lit vane, shade vane, rachis, bare shaft. |
| 6 | The five as a family | dock, track chips | 3/3/3 | 4/4/4 | – | 4/4/4 | One outline, one light; each company's colour is the biggest mass. Five distinct silhouettes at 16 px. |
| 7 | Locked company padlock (16 × 16) | dock, signposts, track | 4/3/3 | 4/4/4 | – | 4/4/4 | Was cool slate, a second lock look. Now the small lock's warm parchment and steel. |
| 8 | Sovereign crest | Buy Company slot and card, charter | 4/3/3 | – | 4/4/4 | 4/4/4 | The crown's two jewels over a dark band made a face. Now a raised centre point and one ruby. The shield's point no longer hangs a stem. |
| 9 | Crown (trade-war leader) | dock slot, standings, season's end | 4/3/3 | – | 4/4/4 | 4/4/4 | The same face. It is now the new crown, outlined. Same 10 × 8 box. |
| 10 | Lock (8 × 10) | Codex, crates, track, livery, militia | 2/3/3 | 4/4/4 | – | 4/4/4 | The shackle was outline only, so on dark wood the lock was a box. It now has its own steel, and the body is lit. One row taller. |
| 11 | Coin (shell, `Gold`) | purse, terms, receipt, city | 3/3/2 | 4/4/3 | – | 4/4/3 | The 7 × 7 cut-corner square read as a gold block. Now round, 8 × 8, lit, with a shaded far edge. J stays 3, because the run HUD still draws a second, different coin (row 12). |
| 12 | Atlas gold (`Money`, run HUD) | battle HUD, run shell | 4/3/3 | – | – | 4/3/3 | **Not changed** (`fw-icons` belongs to another agent). It is lemon `#ffed44`, not the brand's `--gold`, and a different drawing from the shell's coin. |
| 13 | Crate, ghost crate | terms, receipt, wagon | 4/4/4 | – | – | 4/4/4 | – |
| 14 | Lantern | route rail | 4/4/4 | – | – | 4/4/4 | – |
| 15 | Sword (item chance) | terms, receipt | 4/4/4 | – | – | 4/4/4 | – |
| 16 | Sealed scroll (skill) | terms, receipt, Codex | 4/4/4 | – | – | 4/4/4 | – |
| 17 | Gold rim (second term) | every crest | 3/3/3 | – | 4/4/4 | 4/4/4 | A 1 px hairline round 2 px cells, in `--accent` (lime under Peppercorn). Now `--rim` = the crest's scale, in `--gold`. |
| 18 | The Dripping Seal (vector) | purse, icons, social | 5/5/4 | – | – | 5/5/4 | – The purse's 40 px seal is crisp and reads as wax. |
| 19 | Mono seal | stamp uses | 4/5/4 | – | – | 4/5/4 | – |
| 20 | Pixel mark 16 (favicon) | tab, PWA | 4/5/4 | – | – | 4/5/4 | – |
| 21 | Wordmark and lockups | social card, press | 4/5/4 | – | – | 4/5/4 | – Not drawn in the app (the menu's `<h1>` is live text). |
| 22 | Company standards (plain) | wagon, home card flag, track, livery, hero pick, season's end | 3/3/2 | 4/4/4 | – | 4/4/4 | Each logo was in its cloth's own colour, so only the outline showed. Now a patch of deeper dye (`8`, `PATCH_SHADE` −0.55), one cell round the logo, sews it on. A deliberate change to the plain standard; its test was updated. |
| 23 | Kit cuts (14) | livery, militia | 4/4/4 | – | – | 4/4/4 | – |
| 24 | Kit patterns | same | 4/4/4 | – | – | 4/4/4 | – |
| 25 | Emblems (5 × 5, 31) | livery, militia, standards | 3/3/3 | 4/4/4 | – | 4/4/4 | Eight redrawn: the gem and the palette read as skulls, the rose as a key, the chili and the quill as slashes, and the flame, the sack and the candle as blobs. Same box, same ids. |
| 26 | Tinctures and colour pairs | militia | 4/4/4 | – | – | 4/4/4 | – |
| 27 | Trim metals | livery, militia | 4/4/4 | – | – | 4/4/4 | – |
| 28 | Militia banner | purse, HQ on the map, Sovereign wagon | 4/4/4 | – | – | 4/4/4 | – |
| 29 | Builder soldiers | militia builder | 4/4/4 | – | – | 4/4/4 | – |
| 30 | Map terrain (grass, woods, peaks, sea) | home | 3/4/4 | – | 3/4/4 | 4/4/4 | R2: the pines were lit in the middle and darker than the grass, so the woods were black blots. They are now lit from the left, still dim. R3: the peaks were 45° wedges (tents). They now have a summit, a shoulder and a ragged snowline. |
| 31 | Map roads | home | 4/4/5 | – | – | 4/4/5 | – |
| 32 | Map towns | home | 3/4/3 | – | 4/4/4 | 4/4/4 | R2: flat boxes that read as crates became houses with pitched roofs and a lit window; the destination is wider. The pennant sits on the peak. R3: the roof is warm terracotta. |
| 33 | HQ keep and its banner | home | 4/4/4 | – | – | 4/4/4 | – |
| 34 | Map seasons (tint and speckle) | home | 4/4/4 | – | – | 4/4/4 | – |
| 35 | Place marks and carved plates | home bar | 4/4/4 | – | – | 4/4/4 | – The atlas icons are another agent's. |
| 36 | Purse plaque | home bar | 4/4/4 | 4/4/4 | – | 4/4/4 | Its coin is now round (row 11). |
| 37 | Road signposts | home map | 4/4/4 | 4/4/4 | – | 4/4/4 | They carry the new crests. |
| 38 | City annotations and leaders | home map | 4/4/5 | – | – | 4/4/5 | – |
| 39 | Season bars | home | 4/4/4 | – | – | 4/4/4 | – |
| 40 | Codex tile frames | Codex | 4/3/4 | 4/4/4 | – | 4/4/4 | Pure `#fff` text and `#000` shadows became `--text` and `--shade`; the NEW tag became `--bad`. |
| 41 | Rarity tokens, pips and rails | pack, shop, spoils, Codex | 4/3/4 | – | – | 4/3/4 | **Not changed.** Rare `#5fb0c4` is ΔE2000 4.1 from the CTA teal `#57a2b6`. Retuning a token needs the designer (card `rarity-teal`). |

**Totals** (41 assets, A + B + J summed):
- R0: 448 of 615, mean 3.64.
- R3: 495 of 615, mean 4.02.
- 19 assets scored under 4 on some axis at R0. At R3, 3 do, all outside this pass's reach: rows 11, 12 and 41.

## Proposals (not shipped)

`harness/marksProposals.ts` draws both proposals; nothing in `src/` reads them.

| Company | People · trade | Crest | Colour | Standard |
|---|---|---|---|---|
| **Butcherblock** (Easel House's slot) | Reptilians · meat, hides, salt | A haunch on the bone, its fat marbled: it reads as meat at 16 px. | `#c25b6b` brine-cured red, ≥ ΔE 15 from danger red and every rarity and company | Plain, with the patch. Dressed: a tattered cut, smokehouse bars, bronze trim. |
| **Greenvial** (Moonquill's slot) | Gnomes · plant potions | A potion flask, a sprout from its cork, spores glowing in it. | `#2fa58a` bottle jade, ≥ ΔE 15.8 from the good green and the CTA teal | Plain. Dressed: a scalloped leaf hem, glasshouse chequers, verdigris trim. |

Neither crest names its people; the dock's figures will carry the people. One proposal option: a scale pattern on the Butcherblock haunch's hide, if the designer wants the crest to carry the people too.

## Still weakest (honest)

1. **Rare is the CTA's teal** (ΔE 4.1). A Rare rail can read as a button. Changing it means retuning a token, its colour-vision variants and its contrast tests, and every blue nearby is taken: Ironvein, mystic, info. The designer's call.
2. **Two gold coins.** The shell's `Coin` is `--gold`; the run's atlas coin (`fw-icons.png`, owned by the icons pass) is lemon `#ffed44` and drawn differently. One currency should have one mark.
3. **The patch at large sizes.** At the livery's 4× the logo reads as a doubled outline, because its body is still the cloth's own colour. It works at the wagon's 2 px and the card's 2×; a real fix would put the logo on a field, which the "cloth stays the company's colour" rule rules out.
4. **The 5 × 5 emblems are at their resolution floor.** The chili and the quill are still near-slashes.
5. **The crests say the trade, not the people.** That is deliberate, since the dock's figures carry the people, but no crest reads as human, elf or dwarf by itself.
6. **The Easel House and Moonquill crests** were raised to 4, not 5, since both slots are planned to change. At 8×, the feather's notch pixels read as noise.
7. **The two proposals' colours** have not been run through the company-theme contrast tests; `companyThemes` belongs to another agent.

## Cards

The phone review cards are in `cards/`, listed in `cards/manifest.json` with the group "Marks & map":
- the crests: `crest-family`, `crest-spice`, `crest-art`, `crest-metals`, `crest-silk`, `crest-scrolls`;
- the flags and marks: `standards`, `lock`, `coin`, `crown`, `gold-rim`, `emblems`;
- the map and the Codex: `map-detail`, `codex-tiles`, `home-phone`;
- the proposals: `proposal-butcherblock`, `proposal-greenvial`, `proposal-family`;
- the open question: `rarity-teal` (Fix?).
