# Fieldwatch — the mercenary company (design spec, draft 1)

Status: the designer's direction as of 2026-10-05 (draft 2: the push-further list approved, open questions defaulted), with the October 2026 designer pass built (draft 3, 2026-10-06: `docs/AUDIT_2026-10.md` §4 items 2, 3, 4b, 5 and 6 — the company advance, a two-office HQ, standing bonus items, the charter's new terms and the staggered run-2 reveal). Numbers are placeholders, to be tuned "to what makes the game fun". **Open** marks a decision still to make.

## Premise
You run a private militia hired by trade companies to clear their trade routes of raiders. Each company trades different goods: Art, Spice, Metals & Stones, and more. Playing for a company raises your **standing** with it.

## One currency: gold
- Gold is the only currency. It pays for services, the HQ, cargo stakes and item pulls. Marks and dust are gone.
- **Decided (2026-10-06): the company's advance.** Every contract sets out with a fixed **60-gold advance** from the company that hires you (`contracts.ADVANCE`) — never taken from the bank. The purse picker is gone: a purse taken from the bank, with spending coming out of it first, made a purse of 0 nearly always best (audit §4.2). The Sovereign Route gets the same advance. The contract terms say "Easel House advances 60 gold for the road"; the hero pick's contract chip says "advance 60"; the receipt's slip says "The advance · 50 repaid to Ironvein · 0".
- **Road gold comes home, taxed (2026-10-05).** Spending comes out of the advance first. At the end the advance is repaid — none of it is banked, it was never yours — and of the gold the road paid (fights, shrines, sales), **25%** comes home and the rest stays on the road. City pay and contract payouts are banked in full. The result screen says it plainly: "Road gold 412 → 103 banked (25%)". The share is `hq.ROAD_SHARE`, tunable. **October audit default:** a *fallen* contract banks only `hq.LOST_ROAD_SHARE` (**10%**) of the road's gold, so a fall costs something and "press on" is a real risk (`docs/AUDIT_2026-10.md` §4, lane 1).
- **Old saves.** A run signed before the advance carries no `advance` flag on its contract: its purse was taken from the bank and its rest still comes home in full ("Purse returned 40"), exactly as it was signed (`runSnapshot` validates the flag as a strict `true`; no version step).

## Contracts (a run = one company's route)
- **Escort contract (no stake):** costs nothing.
  - You are paid a flat service fee for each city (checkpoint) the caravan reaches.
  - Reaching the end pays a completion bonus.
- **Staked contract:** you buy cargo for the route. More cargo raises:
  - the difficulty multiplier;
  - the completion bonus;
  - the number of **item chances** at the end;
  - and every big stake milestone adds **one more skill**.

  Stakes cap at a tuned maximum.
- **Checkpoints** are the three act bosses' cities:
  - the first sells enough cargo to recoup your stake;
  - the second pays earnings;
  - the end pays the big reward.
- **Losing** keeps whatever was already paid at cities reached. Unsold cargo is lost, and most of the road's gold stays on the road (10% comes home, not 25%).
- **Stakes open per company** (2026-10-06): a company takes a stake from **standing 2** with it (`contracts.STAKES_OPEN_AT`); before that its terms offer the escort only and the Staked card says "Stakes open at Standing 2 with <Company>". Above it, the cap is still standing + 1 crates.
- **Cashing out** (October audit) sells the crates still on the wagons at **full** value (`CASH_OUT_RATE` 1) and banks the road's gold at the full share; you give up the completion bonus, the item chances and the contract skill. The city screen prices all three outcomes (cash out, deliver, fall) with `settle.cityTrade`, and when nothing is at risk it says so instead of staging the choice. A first contract is offered the choice from its second city.
- **Escort fee** (October audit): 60 a city (was 40), so the contract — banked win or lose — carries more of a run's income now that a fall leaves most of the road's gold behind.
- **Decided (2026-10-06): the road changes country at every city.** Each act is fought on its own battlefield. Act 1 is the field the seed always dealt; each later act's field is a fresh hash of (run seed, act) that never repeats the act before it (`run/fields.ts`). The company's route ground (wildfire, quarry, flooded…) still applies, and each fight still lays its own danger ground. When the first fight of a new act is entered, every hero comes off their post to the bench; within an act, posts carry from fight to fight as before. The city page says what is coming ("New ground ahead: The Kiln Road"), the run map's preview of that fight says "New ground", and its setup opens with "New ground: The Kiln Road — post your heroes". Why: with one field a run, posts carried over and every fight after the first came down to Start / Next / Take (October audit §4, designer item 7).

## Unlocks
- **Skills come only from playing.**
  - Each **standing level** with a company unlocks a random skill. Its rarity scales with how high that standing is.
  - **Past the card pool** (2026-10-06): once every card a level could deal is yours, the level pays a **Rare bonus item** in the next contract's pack instead — the sealed crate's duplicate mechanism, one of the kinds you own (the company's own first), a hash of (company, standing, run count), never a run stream (`standing.standingBonusKind`). The receipt shows it as a card: "Standing 7 with Ironvein: a Rare bonus item for your next contract". At most 6 wait (`hq.MAX_BONUS_ITEMS`).
  - **Finishing a contract** unlocks a skill and an item.
  - **Default:** "levelling up" means standing levels. In a run, hero levels 5/10/15 keep offering choices from skills you've already unlocked.
- **Items** come from contracts (completion, and the stake's item chances) or from an **item pull**.
  - An item pull spends gold on a random item unlock. Your standing with companies lifts the rarity.
  - A duplicate becomes a **bonus item in your next run**.
  - Pulls are priced so playing is the main way to unlock and pulling is a gamble.
- **Company bias.** A company's items and skills show up more often on its routes, but other companies' items still appear by chance.
- **Never explain combos.** Each piece states only its own effect.

## The endgame charter (replaces the Daily)
- Name TBD, in theme, along the lines of "Free Agent": e.g. **Free Charter** or **Sovereign Route**. You sponsor your own entire trade route.
- **Unlocks** only when everything else is unlocked.
- **Very expensive and all-or-nothing:** no staking and no checkpoint pay. The payout is huge.
- **The only source of the top item tier.** Each top-tier item unlocks by completing a charter.
- The route spawns **every item and enemy**. Each company imposes a **trade-off** you must handle; one constraint per company is proposed.

### Built in step 5: the Sovereign Route
Rules: `src/game/run/charter.ts`. Screens: `src/ui/shell/charter/` (the page), the menu line, the route panel and header chip in the run, the result screen. Every number is a placeholder for the tuning pass (REPORT §18 measures them).
- **Name:** the **Sovereign Route**. Its top tier is **Sovereign** (item Level 4), cyan `#38f2e8`, initial **S**.
- **The door:** every random skill card and every item kind of Levels 1–3 unlocked (`charterDoor`). Standing and the HQ do not count; feat cards follow their feats and are not in it. The menu shows the meter and "Opens when every skill and item is unlocked"; the page shows its two parts.
- **The contract:** a **7,000 gold** fee from the bank (5,000 before the tuning pass) (paid when the hero is committed, as a stake is). No crates, no market, no company. The three cities (Freemark, Crownwater, Highcharter) are waypoints that pay nothing, there is no cash-out, and a fall loses the fee (the road's share still comes home as on any road; the purse is the company advance every contract carries). Delivered, Highcharter pays **35,000 gold** (five fees; 20,000 before the tuning pass) whatever the cargo, and one Sovereign kind still locked unlocks. A charter is always dealt a random seed.
- **Standing with all five** (2026-10-06): the route is every company's, so it earns standing with each of the five — what an escort that ended the same way earns with its one company (`standing.charterStandingXp`: 15 a depth, 1 per 10 felled, +60 delivered). A fall earns the fall's. Levels it crosses pay as any standing level does (by then, Rare bonus items). The receipt shows five crest chips.
- **Merged with the tuning pass (2026-10-06):** the October designer pass had set 5,000 / 16,000 against its own eased road; `main`'s tuning pass set 7,000 / 35,000 and the muster's teeth against the steeper act 3 the merge keeps. The merge takes the tuning pass's numbers and re-measures them against the re-anchored gates (REPORT §18).
- **Every good, every raider:** the run deals from every pool you own with no company weighting and no HQ focus; every goblin clan marches from the first fight (`waves` `muster`; the teaching ramp is lifted), and every raider is **7% stronger and steals 7% more** (`charter.MUSTER_STRENGTH`, the tuning pass: the clans alone cost nothing measurable).
- **The five trade-offs, all at once:**
  - Peppercorn Co.: **Wildfire on every field.** Fire covers part of every field.
  - Easel House: **The canals flood.** Lakes cover some of the best ground.
  - Ironvein: **Quarry boulders.** 4 more boulders a field. They can't be cleared.
  - Rosethread: **Merchants charge double.** Every merchant price is twice as much.
  - Moonquill: **More cursed ground.** 2 more cursed patches on every field.

  The four ground rules are one map challenge, `sovereign` (`data/terrain.COMPOSITE_RULES`), laid on every fight including the first and the bosses.
- **The Sovereign tier** (`data/itemKinds.ts`): Saffron Brand (Peppercorn, one-hand sword: every hit burns 20 a second for 3 seconds), Gilded Easel (Easel House, off-hand shield: holds 4), Ironheart Plate (Ironvein, body: +15% damage), Silkwind Cloak (Rosethread, body: +15% attack speed), Moonquill Codex (Moonquill, two-hand caster: jumps to 2 more enemies). Once owned, each is dealt in loot, at merchants and on rolled heroes at a quarter of an ordinary kind's weight; sealed crates never deal one.
- **Saves:** meta v10 (`sovereign`, `charters`), run snapshot v17 (a charter contract, validated). Dev handle: `window.__charter.ready()`, `.fund(n)`, `.own(n)`.

## The staggered run-2 reveal — built 2026-10-06
Run 2 used to open the board, stakes, purse, HQ, crates, focus and market at once, after any finished first run, a loss included (audit §3 D). Now each opens on its own beat, with one tip, and a locked place says what opens it instead of being silently absent (`state/staging.revealOf`, `stakesShown`; the latches are the save's `met` list, validated on load):
- **The contract board and the cash-out:** after the first finished contract (unchanged; LS3's first run is untouched).
- **The HQ:** the first time the bank holds **500 gold** (`hq.HQ_OPENS_AT`), then for good — latched in `met`, so spending back under 500 keeps it open. Before: a locked tile and "Headquarters: opens when your bank first holds 500 gold".
- **Sealed crates:** after the first **delivered** contract (`hq.cratesOpenFor`), latched. Before: "Sealed crates: opens after your first delivered contract".
- **Stakes:** per company at **standing 2** with it (see Contracts).
- **The market of the day and company focus:** from the **5th finished contract** (`contracts.MARKET_FROM_RUN`, `hq.FOCUS_FROM_RUN`). Before, every contract signs at market 1, the menu's market line is locked with a count ("Market of the day · after 5 contracts · 2/5") and the HQ's focus card is locked ("Opens after your 5th finished contract · 3 of 5"). Each says one tip the first time it shows.
- A save that met the HQ or the crates before the stagger keeps them (the same `met` entries). "Show everything from the start" opens every gate.

### Tuned (the tuning pass, 2026-10-05)
REPORT §13, §18 and `docs/TUNING_LOG.md` (pass 2) have the measurements.
- **What a crate does to the road:** one more elite an act (as built), and the raiders on the **last leg** — act 3, past the second city — stronger and greedier: their HP and what a raider who reaches the wagons steals, ×1.12 / 1.22 / 1.36 / 1.5 / 1.74 / 2.1 / 4.5 / 5.5 at 1–8 crates (`watch.LAST_LEG`). It was +8% strength on the whole road a crate, and a crate cost 0–2pt of delivery; strength on the whole road also costs the second city, which is where a stake is paid. Delivery for a zero-HQ company: 34 → 28 → 23 → 19 → 16 → 10 → 7 → 1%. The top crates are a dare.
- **What the cities pay:** the first sells half the load (rounded up) at **100** a crate (the stake back), the second the rest but one at **130**, and **one crate** rides to the destination, which pays **400** for it and a completion bonus of 150 + **20** a crate (`contracts.CITY_CRATE_VALUE`, `cratesSoldAt`; it was 100 everywhere, half of what was left after the first city went to the destination, and +40 a crate). Expected pay now rises with every crate. A cash-out still sells what is left at 50 a crate (half of 100).
- **The Sovereign Route:** 7,000 fee, 35,000 payout, the muster 7% stronger (above). The door's company delivers ~27% (29% with every Sovereign item): about +2,900 a charter on average; the fee is ~8.5 of its good runs.
- **Unchanged after checking:** road-gold share 25%, interest caps 20–40, sealed crates 500.

## Removed
- **Endless mode:** removed for now.
- **The Daily:** replaced by the charter.
- **The Banner/Vow ladder and difficulty steps:** replaced by stakes.

## The mercenary company (HQ upgrades) — built in step 3, cut to two offices 2026-10-06
Rules: `src/game/run/hq.ts`. Screens: `src/ui/shell/hq/`. Every price is a placeholder for the tuning pass.

**October 2026 (audit §4.3):** the **Finance office is cut** — its levels paid back in about 260 runs — and so is **"Fewer boulders"** (the levels and the one-contract order): the harness measured it making runs 4pt *harder*. Both are refunded to the bank at what they cost (meta **v11**, `hq.refundRetiredHq`, the v9 pattern). The bank keeps the free base interest as a plain rule: **2% of the bank on every finished contract, at most 20 gold** (`hq.BASE_INTEREST`), shown on the HQ page under the tabs and in the glossary. Operations keeps three purchases with a felt effect: pack slots, company focus and the scouts. The entries below are kept as the record of what was built; the retired ones are marked.
- **HR office:**
  - **Opening deal** (150 / 300 / 500 / 800 / 1,200): 1 every hero comes with body armour, and an off-hand piece if a hand is free; 2 body armour arrives Rare; 3 pick 1 of 4; 4 one of them starts with a Level 2 skill; 5 a second hero marches with the one you pick.
  - **Hiring Hall** (180): the old hub service, kept — a second Recruit stop, hires trained to depth.
- **Finance office** *(cut 2026-10-06; the 2%/20 base rate stays as a bank rule)*: gold left in the bank earns interest at the end of each **finished** contract (delivered or cashed out; never a lost one, never a custom seed), on the bank before the run's deposit lands. 2% / 2.5% / 3% / 4% (200 / 400 / 700), capped at 20 / 25 / 30 / 40 gold a contract — every cap fills at 1,000 banked. **Why 40 at most:** the smallest stake (one crate) adds +50 to +55 gold to a contract's expected pay over the escort (REPORT §13) and +90 delivered; a 50 cap tied the measured one-crate gain, so the top is 40 and the bank never out-earns a stake. The page shows the next payout and the last one.
- **Operations:**
  - **Pack slots:** 6, up to 10 (150 / 250 / 350 / 450). A full pack sells its cheapest piece for scrap gold when loot arrives (only as many as arrived; moving your own gear never sells anything).
  - **Boulders** *(cut 2026-10-06, refunded)*: each field lays 6 seeded boulder patches. "Fewer for good" takes 1 away a level (250 / 450 / 700); an order clears 2 more for one contract (60). At least 2 always stand, and a quarry road's own extra boulders are never cleared.
  - **Company focus** (shown from the 5th finished contract): one company at a time (free to switch). +15 / +30 / +45 percentage points of its share of the run's skill and item pools (250 / 500 / 800), and an order adds +15 for one contract (50). Never past 90% — other companies' pieces always still turn up.
  - **Scouts:** the old Scout Reports (level 1: every ambush has a way around) and Cartographer's Table (level 2: three or four roads a layer), 150 / 200.
- **Orders** are paid at the HQ and spent when the next contract is signed; the run's HQ terms are frozen on its contract.
- **The old hub:** Hiring Hall and Scout Reports (+ Cartographer) fold in; Reinforced Wagons, War Chest, Seasoned Recruits, Reserve Squad, Quartermaster, Field Kitchen and Relic Cartulary are retired and refunded to the bank at what they cost (meta v9).

## Sealed crates (the item pull) — built in step 3
- 500 gold a crate (about one finished run's savings). Odds by Level: 70 / 22 / 8%, and every standing level you hold (all companies together, up to 30) moves a point off Level 1 (two thirds to Level 2, one third to Level 3). Within a Level, every unlockable kind is equally likely; the page shows the chance of a kind you don't have.
- A duplicate is a **Rare bonus item** of that kind in your next contract's pack.
- Each crate is a hash of the save's crate seed and its number — its own stream.

## Overlooked: decide or design for
1. **Bank vs. run purse.** Decided 2026-10-06: the company's 60-gold advance, not taken from the bank and not banked; 25% of the road's gold comes home (see One currency).
2. **Hoarding vs. staking.** Built: interest pays only on finished contracts, capped at 20 a contract (under one crate's +50 expected gain); there is no longer a way to buy a higher rate.
3. **Never broke.** The free escort contract plus per-city pay means a losing streak still earns. Keep it so.
4. **The pull's tone.** It's an in-game gamble with no real money: keep it that way, show the odds plainly, and handle duplicates well (the bonus item does this).
5. **The charter's unlock condition** ("everything unlocked") is a long road. Show progress ("Charter: 74% of the catalogue") so it reads as a goal, not a secret.
6. **The top item tier** needs a name and a colour that clash with nothing: rarity colours, company colours, cursed ground, the clearance red.
7. **Obstacles are a balance lever** (they were the main one after the finer grid). Price obstacle removal so it doesn't trivialise routes.
8. **Removing the Daily** loses the "same seed for everyone" feature. Fine for now; the charter could have a weekly seed later.
9. **First run (LS3):** a free escort contract from one company. (Built: the HQ and the crates are hidden from a first-timer's menu and each page says one tip, once.) After it, the staggered reveal opens the rest one beat at a time (see that section).

## Approved (2026-10-05: "i loove all these … go")
1. **The Gate is the caravan.** What you defend is the cargo. Leaked enemies steal crates, so less sells at the next city. Every battle ties to the money.
2. **Cash out or press on** at each city. Sell everything and head home, or keep going for the bigger payout. This is the push-your-luck moment.
3. **Market prices.** Each day one good pays more ("Spice ×1.3 today"). It applies to every contract, now that the Daily is gone, and pulls players around the map.
4. **Each route has its own ground.** Spice runs through wildfire country, Metals & Stones through quarries with boulders, Art along flooded canals. The existing map challenges become company flavour.
5. **Your militia's banner.** Name your militia and pick a banner that flies on your Gate.
6. **Contract letters.** One line of flavour before a run ("The Saffron Company seeks an escort to Saltmarsh…").

## Build order
1. Classless heroes and item unlocks (in progress).
2. The economy core: gold only, purse/bank, companies and standing, contracts and checkpoint pay, stakes, cash out or press on, the Gate as caravan, market prices, route ground, contract letters. Endless and the Daily are removed.
3. HQ offices (HR, Finance, Operations) and the item pull.
4. The trade-map menu (from the chosen mockup direction), and the militia name and banner.
5. The endgame charter (built: the Sovereign Route).
6. One tuning pass.
