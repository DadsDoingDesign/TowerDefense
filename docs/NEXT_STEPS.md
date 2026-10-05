# Fieldwatch — next steps (paused 2026-09-30)

## Update 2026-10-05: the mercenary company, step 4 (trade-map menu, militia banner)

Built in parallel with step 3 (the HQ offices and the item pull), per `docs/MERCENARY_COMPANY.md` § Build order
step 4:

- **The menu is the trade map** (`src/ui/attract/`: `mapRules.ts` pure geometry and traffic, `paintMap.ts` the
  pixels, `TradeMap.tsx` the canvas and labels; the layout `src/ui/shell/MenuScreen.tsx` + `src/styles/menu.css`).
  It reads standing, the market of the day and `standing.charterProgress` (a locked "Sovereign Route" line until
  step 5) through existing selectors; the menu's tiles are whatever `offers.ts` lists, so the HQ / Sealed Crates
  rows step 3 adds appear as tiles with no menu change.
- **The attract battle is retired**, with the still key art (`MenuKeyArt`, `keyart.png`) and its CSS.
- **Your militia**: a generated name with a re-roll (no free text) and a banner (4 shapes, 6 dark field colours,
  3 emblems) — `src/game/run/militia.ts`, `src/game/data/banner.ts`, `metaStore.militia` (validated on load),
  the picker `src/ui/shell/MilitiaScreen.tsx` (`MetaView 'militia'`). Raised after the first finished contract
  from one tip on the menu; changed later from Settings. **Step 3's HQ can link to it** with `setMetaView('militia')`.
- **The wagon** now stands in the forest margin where the road leaves the field, with the banner beside it
  (`render/caravan.caravanLayout`, held by `tests/caravan.test.ts` on every field, twin, challenge and hazard
  layout).
## Update 2026-10-05: the mercenary company, step 3 (HQ and sealed crates)

Built on `claude/whales-ui-critique-plan` (from `2127773`), per `docs/MERCENARY_COMPANY.md` § The mercenary company:
road gold comes home taxed (the purse's rest in full, 25% of the road's gold), the HQ's three offices (HR's
Opening deal and Hiring Hall; Finance interest on finished contracts, capped 20–40; Operations' pack slots,
boulders, one-company focus and scouts) and sealed crates (500 gold, odds by Level lifted by standing, a duplicate
is a Rare bonus item next contract). Rules: `src/game/run/hq.ts`; screens: `src/ui/shell/hq/`. The old hub is
folded or refunded (meta v9); run snapshot v16. Balance §12 grades the HQ; nothing was tuned.

Next: step 4 (the trade-map menu, militia name and banner — in progress in parallel) and step 5 (the charter;
`standing.charterProgress` is untouched). Open from step 3: pulls and orders are not in the harness's money
model; the 4-hero pick scrolls on a phone.


## Update 2026-10-05: the mercenary company, step 2 (economy core)

Built on `claude/whales-ui-critique-plan` (from `6506780`), per `docs/MERCENARY_COMPANY.md` § Build order step 2:
gold only (bank and purse), five trade companies (crest, colour, goods, route ground, pool affinity), standing
per company, contracts (escort / staked crates), cities that pay by Cargo % with cash out or press on, the
market of the day, contract letters, and the Daily and Endless removed. Rules: `src/game/run/contracts.ts`,
`src/game/run/standing.ts`, `src/game/data/companies.ts`; screens: `src/ui/shell/contracts/`. Balance report
§13 is now "Stake tiers" (+ §13b, the routes as escorts); nothing was tuned.

Next (spec step 3): the HQ offices (HR, Finance with interest on the bank, Operations) and the item pull. Hooks
left for it and step 4–5: `metaStore.bank`, `CaravanLook.banner` (the wagon's banner slot),
`standing.charterProgress`.

Open from step 2 (closed in step 3): kill gold left in the purse came home in full — now only 25% of the road's gold does.

---

Where things stood when work paused on 2026-09-30, and what to do next, in order.

## What's live

`main` is at `e9de782`, deployed to https://tower-defense-coral.vercel.app. Close all game tabs and reopen to get past the offline cache. It includes:

- Whales UI rounds 1–3
- no hero HP
- first runs that teach one idea at a time (LS3)
- one name per thing (LS4)
- seeds that always deal the same fields
- a Back row on the hero pick
- the finer 40px grid on the ground's own lattice
- a map that fills the screen, with no apron
- the Fighter-only red "Clearance" zone

**Main's balance check is red, on purpose.** The 40px grid made the game easier:
- Monte Carlo win rate is 66% against a 45–60% target.
- 5 invariants fail.

You chose to merge and tune later. Typecheck, tests and build are green.

## Paused work: two branches, not merged

Both typecheck clean and pass their tests. Neither has had its design review screenshots finished or its balance run regenerated.

| Branch | What | State |
|---|---|---|
| `wip/weapon-clearance` (`e4560d1`) | Weapon decides melee (swords/axes swing, bows/wands don't); a clearance conflict is shown on the field ("Make space…") and **blocks Start Wave** until fixed; the equip screen warns first; **gear is locked and heroes can't move during a live wave**, only between rounds | Close to done. 506 tests pass. Needs: screenshots + review loop, `npm run balance`, then merge |
| `wip/skills` (`11ead2f` on top of `cf07bc4`) | The full skill system (SK1) as you wrote it: about 33 skills at Level 1/2/3; 3 starting skills; unlocks from Watch levels and wins; 1 of 3 rolled heroes at the pick; skill offers at levels 5/10/15; max 3 skills, then swap or stat bump; difficulty that rises with each win, replacing the Banner/Vow ladder; perks and evolutions folded into skills | About half done. Phase 1 (the library and its pure rules) is committed. The UI (hero pick, level-up offers, library view, difficulty picker) was being built. 519 tests pass. Needs: finish the UI, save migrations checked, staging tips, screenshots, balance |

**Merge order:**
1. `wip/weapon-clearance` first.
2. Then rebase `wip/skills` onto it.
3. Wire the skills' `grantsMelee` flag into `isMelee(hero)`, so a skill can make a hero swing.

## Next steps, in order

1. **Finish and merge weapon clearance.**
   - Render the conflict, the blocked Start Wave and the gear-lock states (phone and desk).
   - Run balance; merge to main.
2. **Finish the skill system.** Complete the UI, then do the review loop, migrations and balance. Then merge.
3. **One tuning pass**, once both land. Get every balance invariant green. Levers:
   - more cursed ground and boulders (the finer grid makes them easy to dodge);
   - the enemy-strength curve;
   - the Hoarfrost/Ricochet mutations' costs (or their skill equivalents);
   - the difficulty-step payouts;
   - the bomber bench.
4. **Review page:** update round 6 with these builds, and record SK1 as approved (full version). https://claude.ai/artifact/CxZoy1jPbBX1UM9bX8L3Hk

## Still waiting on your decisions (review page)

- **N1–N12:** the calls builders made, e.g. bombers target the Gate, cut relics, zoom size, and the hero-pick "DPS" line.
- **LS1:** cuts (patience, dust/reforge, curses, STR/DEX/INT off the main screens).
- **LS2:** merges (relics and shrine boons become blessings; five kinds of map stop). Evolutions/perks are already folding into skills.
- **SK2:** level badges only for real choices. **SK4:** exact stat breakdowns. **FX1:** spreading fire, on hold. **HC1:** Hall of Champions.
- **Clearance:**
  - Should a Fighter's zone show when you hover a tile that's dark because of a ranged hero?
  - Should an item that lets a Rogue or Mystic hold enemies give them a clearance?
- **Label:** "Clearance", "Hero clearance" or "Fighter clearance". "Tower Clearance" is blocked by the one-name rule.
- **1920-wide screens:** the map is slightly soft there (non-whole scale). Keep it, or go crisp but smaller?
- **Phone placement:** tiles are 22–24px; you aim at the hero's 44px space. Try it and say if it feels fiddly.

## Small follow-ups noticed

- **Returning-player hero pick:** the trait tiles ("Blocks 2", "8 thorns") are oversized and squeeze the page. They will likely change with the skills pick anyway.
- **CI:** GitHub warns that its Node 20 actions are deprecated and that Ubuntu runners change on Oct 19. Update `.github/workflows/ci.yml`.
- **Two-tab payouts:** with two tabs open, one tab can pay out a run another tab is still playing (documented in `src/state/game/settle.ts`).

## How to resume

Ask Claude: "resume Fieldwatch from docs/NEXT_STEPS.md". The working notes for builders are in `CLAUDE.md` and `docs/DESIGN_REVIEW.md` (the log's last entries describe each change).
