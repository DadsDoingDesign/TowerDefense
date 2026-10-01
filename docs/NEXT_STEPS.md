# Fieldwatch — next steps (paused 2026-09-30)

Where things stand when work paused, and what to do next, in order.

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
