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
- **The door:** every random skill card and every item kind of Levels 1–3 unlocked (`charterDoor`). Standing and the HQ do not count; feat cards follow their feats and are not in it. The page shows the meter and its two parts.
- **On the home** (October 2026; the designer: "a button that looks locked and it's called 'Buy Company'"): the sixth slot of the company dock, after the five companies, in a carved cyan frame with the Sovereign crest (`homeDock.charterSlot`). It shows from the first home after the free escort (Overlooked § 5: progress, so it reads as a goal). Locked, a padlock over the crest and the share unlocked ("40%") with a small bar; open, no padlock and a quiet glow. Selecting it lights all five roads (the route carries every good) and turns the card into Buy Company: locked, the Skills and Items counts and a disabled CTA, "Unlock 26 more"; open, what delivery pays and the CTA "Buy Company · 7,000" (disabled, with a line saying how short the bank is, until it covers the fee), which opens the charter page — the militia's founding first, if there is none. It replaced the "Sovereign Route ›" pill on the dock's shoulder.
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
- **What the cities pay:** the first sells half the load (rounded up) at **100** a crate (the stake back), the second the rest but one at **130**, and **one crate** rides to the destination, which pays **600** for it (400 until the gameplay pass, when the harder road made the delivered crate worth less than its stake) and a completion bonus of 150 + **20** a crate (`contracts.CITY_CRATE_VALUE`, `cratesSoldAt`; it was 100 everywhere, half of what was left after the first city went to the destination, and +40 a crate). Expected pay now rises with every crate. A cash-out still sells what is left at 50 a crate (half of 100).
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
  - **Hiring Hall** (180): the old hub service, reworked in the gameplay pass (Oct 2026) — there are no recruit stops; a hero is hired at a city (the act-boss arrival, `recruits.citySlate`), and the Hall adds a fourth candidate at every city and hires trained to the company's level.
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

## Draft 4 — companies as sponsors (approved 2026-10-14)

The designer, on the five "The Finals sponsors" mockups (Design canvas "Companies as sponsors — mockups"): "this is great", then "make the companies a bit of a longer grind. And then when you unlock your own company you get a mix of any and all … consider carrying this through the items and skills as well", "customize the flag for each team — as you play you get more unlocks from their flag, and when you make your own you can pick things from any one and combine", and "bring the customization back into play sooner, making it more fun". Numbers are placeholders for the tuning pass. Build order: **A** asks and **C** flags (in parallel), then **B** the track, then **D** the trade war, rivals and liaisons.

### A · Company asks (each contract wants something of the run) — built 2026-10-14

**Built** (`src/game/run/asks.ts`; UI `ui/shell/contracts/AskParts.tsx`, `ui/shell/AskToast.tsx`; tests `tests/asks.test.ts`). What the build decided where the spec left it open:
- **Targets fitted** with `npx tsx balance/ask-rates.ts 400` (an escort on each company's own road, zero meta and the veteran pooled, delivered runs only). The gold and tally asks were placeholders an order of magnitude low (a delivered escort fells ~270 raiders and earns ~3,900 gold on the road). Fitted, met rate pooled: Peppercorn burning 120 (51%), clean 7 (52%), felled 260 (58%); Easel full cargo (52%), every city clean (35%), clean 7 (53%); Ironvein Plated 25 (50%), 2 elites (42%), felled 290 (41%); Rosethread 4 wares (48%), 3,500 road gold (55%), 3,900 earned (49%); Moonquill pact 1 (7%), Warded 35 (50%), 2 cities clean (75%).
- **Out of the band, for the designer:** the city asks can only be 1–3 (2 is 75%, 3 is 35%), and the pact is a road choice the modelled player rarely makes (7%) — the map's "Asked" tag is what puts a shrine on a player's road.
- **"Without a leak"** = no raider reached the wagons **and** the fight ended with the cargo it began with (a champion's charge the line mended before the end costs nothing). A raider stopped by Hold the Line still counts as through.
- **A first contract (LS3) is asked nothing**: it never sees the terms that name them. A custom seed is dealt its asks but they pay nothing (no standing, no tip), like everything else it would earn.
- Snapshot v18; an older save has no asks and settles as it was signed.

- Every company contract is dealt **two asks** from that company's own list, a hash of (run seed, company) in `src/game/run/asks.ts` — **never a run-stream draw**. Picking a company is picking a way to run the road.
- **The Sovereign Route** (your own road) deals **three asks from three different companies' lists** — "a mix of any and all". Each met ask pays standing with the company whose ask it is.
- **What an ask pays**: each one met earns **+40 standing XP** with its company on any finish that earns standing (delivered, cashed out or fallen; never a custom seed), and a **25-gold tip** banked only when the contract is **delivered** (the destination pays it). Asks judged at the end (cargo, road gold) can only be met by a delivery.
- **The lists** (targets to be fitted with the harness so a typical delivered run meets an ask about half the time; numbers below are starting points):
  - Peppercorn Co.: Fell 40 raiders while they burn · Win 3 fights without a leak · Fell 120 raiders
  - Easel House: Deliver with 90% cargo · Win 2 city fights without a leak · Win 4 fights without a leak
  - Ironvein: Fell 30 Plated raiders · Win an elite fight · Fell 150 raiders
  - Rosethread: Buy 2 wares from merchants · Deliver with 150 road gold · Earn 200 gold on the road
  - Moonquill: Accept a shrine pact · Fell 30 Warded raiders · Win a city fight without a leak
- **Counters**: kills by armour come from the engine's `killsByKey` (`_plated` / `_warded` keys); a kill while burning is a new engine counter; clean fights, elites and city fights from the fight results; wares and pacts from the merchant and shrine actions. Progress lives on the run's contract (`RunContract.asks`, snapshotted and validated, fuzzed).
- **Where they show**: the terms ("Ironvein asks", mockup 1a) and the pay ledger's "asks, if met: up to 50"; the run's route panel with progress (1b) and an "Asked" tag on a map node that serves one (an elite for "Win an elite fight"); a small battle toast when a count moves ("Ironvein · Plated felled 13/30", 1c); the receipt's "What Ironvein asked" with ✓/✕, the tip in the banked ledger (1d).
- Items and skills carry it without a word: a company's own pieces are already dealt twice as often on its road (`contracts.weightPool`), and its asks are written to fit them (Peppercorn's burns, Ironvein's plate-breakers). **Never explain the combo** — an ask says what it wants, a piece says what it does.

### B · The loyalty track (a longer grind you can see coming) — built 2026-10-14

**Built** (rules `src/game/run/track.ts`; curve and migration `run/standing.ts`; signature skills `data/skills.ts`; store `metaStore.settleContract` / `signTerm`, meta v13; UI `ui/shell/company/TrackScreen.tsx` + `styles/track.css`, the notice's standing chip, the receipt's track block and standing card; tests `tests/track.test.ts`). What the build decided where the spec left it open:
- **The curve** is exactly 1.75× the old one: 140 XP to standing 1, then 35 more a level (was 80, then 20) — standing 10 at **2,975** XP (was 1,700). A typical delivery (the whole road, ~270 felled, one ask of two met) earns ~307, so the term is about **ten deliveries** with one company; the track page's "about N deliveries away" divides by that figure. **Meta v13** moves each company's XP to the same level and the same fraction of the way to the next (`standing.migrateStandingXp`); a save at standing 10 lands on 2,975. No level is crossed by the move, so none pays.
- **A term's XP stops at its end** (2,975 in Term I): past standing 10 the bar stays full until you sign. Signing keeps the XP where it is, and Term II's track runs on from it, the same length.
- **Exact, not a roll.** A card level pays the company's next locked card in catalogue order at the level's floor, then its own at any level, then anyone's at the floor, then anyone's (`track.nextTrackCard`). An item level pays the company's next locked kind, **the lowest level first** (Ironvein: Pavise, Plate, then Greatsword), then anyone's. With nothing left, the level pays the Rare bonus item, its kind a hash of (company, level, term) only — so the page names it too. The settle pays the same function the page shows (`payTrack` / `trackPlan`); the preview is exact unless a delivery, a crate or another company's level unlocks the piece first. Delivery unlocks (`rollContractSkill` / `rollContractItem`) are unchanged and deal after the track's levels.
- **What an earned row shows:** what a crossed level paid is not kept in the save, so an earned row names its fixed parts (the flag piece, the signature skill if owned, the Sovereign item named) and only the kind of a card or item ("Skill card"). An old save's levels pay nothing new.
- **The signature skills** (Level 2, `signature: true`, never in `RANDOM_UNLOCK_SKILLS`, not starters, not feats): Peppercorn **Pepperfire** (every hit burns 10/s for 3 s, attacks 15% faster), Easel **Gilt Frame** (reach +25%, crit +15%, crits +25%), Ironvein **Ore Sense** (holds 1 more, hits 20% harder), Rosethread **Velvet Toll** (+4 gold a kill, hits slow 25% for 1.5 s), Moonquill **Moonwake** (jumps to 1 more enemy for 50%, slows 25% for 1.5 s). §7 (`FW_SECTIONS=7`) ranks none of them top of a point but Ore Sense on the wand, where it ties Shield Wall and Anchor at the bench's ceiling; all invariants pass. The Codex shows them in Level 2 ("Opens at Standing 5 with Easel House: its signature skill"; a "Signature" chip once owned).
- **Signature skills do not gate the Sovereign Route**: `charterDoor` counts the random cards and kinds only. A militia that crossed standing 5 before the track never got its signature; **Term II's level 5 pays it** (otherwise a Rare bonus item).
- **The second term** (`metaStore.terms`, v13, validated against the XP: never a term the XP has not reached, never past `MAX_TERMS` = 2): Term II's ten levels each pay a Rare bonus item; its asks pay +80 (`asks.askStandingFor`); its crest wears a gold rim everywhere (`.crest.rim`). Standing stays 10, so the stake cap and the flag kit are unchanged. **Not built:** Term II flag trims (the kits have ten pieces, one a level; a second set is for the tuning pass), and a third term.
- **Where it shows:** the road notice's standing chip ("Rep 4 · Gilt Frame at 5 ›", "Term II · 3 · a Rare Bow at 4") opens the track; the receipt lists each level's reward under the company's name (each company on the Sovereign Route) and its standing card (or the Sovereign Route's chips) opens the track. Screens: `docs/ui-audit-2026-10/track/`.

- **Longer**: standing 10 costs about **1.75×** what it did (≈3,000 XP, ~12 deliveries with one company, asks included). An old save keeps its **level** and its fraction of the way to the next (meta migration) — nobody loses a level.
- **Every level names its reward ahead of time** on a per-company track page (mockup 2a). The card a level unlocks is no longer a random hash: it is the company's **next locked card in catalogue order** at that level's floor, so the track can show it; the same for item kinds. The rewards, carried through the company's own items and skills:
  - 1 its skill card · 2 stakes open · 3 an item kind of its own · 4 its skill card · 5 its **signature skill** (one per company, five new Level 2 skills, only ever from the track) · 6 an item kind · 7 its skill card · 8 an item kind · 9 its skill card, and its **Sovereign item named and shown** · 10 a **second term**.
  - And a **flag piece at every level** (C below).
  - A level whose card or kind is already owned pays the Rare bonus item, as today.
- **A second term** at 10 (mockup 2c): re-sign — the track restarts as Term II, its levels paying Rare bonus items and Term II flag trims, the company's asks pay double standing, and its crest gets a gold rim. You keep everything.

### C · Company flags, and your own made from any of them — built 2026-10-14
- **Each company's standard is yours to dress.** The wagon on a company's road flies its standard (`data/companyStandard.ts`: its colour, its logo, a three-pointed foot). It gains slots — the **cut** of its foot, a **pattern** with a second colour, and its **trim** metal — and the logo always stays, so the flag still says whose road it is.
- **Each company has a kit** of pieces in its own taste (two colours, two cuts, two patterns, two emblems, a trim), and **one piece unlocks at every standing level** with it. You dress that company's standard from your first level — customisation comes into play from the first contracts, not the end game.
- **Your own militia's flag mixes any of them**: the builder (`MilitiaScreen`, `FlagCarousel`) offers its base set plus **every piece earned from any company**, each marked with the company it came from. Company colours on a militia flag are now allowed (the designer's call; the old "never reads as a company" rule gave way to "pick things from any one and combine").
- When the militia is founded is unchanged (the Sovereign Route); what changed is that flags are in play from standing 1.
- **Built 2026-10-14.** The kits are `data/companyKits.ts` (ten pieces each: two colours, two cuts, two patterns, **three** emblems — the tenth level needed a tenth piece, so each kit has a third emblem — and one trim; a pattern first, so a standing-1 standard is already dressed). The standard dresses through `companyStandard.ts` (`StandardLook`: cut, pattern + colour, an emblem under the logo that lengthens the cloth, trim; the plain look is the old standard pixel for pixel). Your liveries are `metaStore.liveries` (v12), validated per company against your standing by `run/livery.ts`. The livery panel (`ui/shell/company/LiveryScreen.tsx`) opens from the road notice's flag; the wagon and the notice fly the dressed standard; the receipt names a piece earned ("Ironvein flag · Cobalt"); the militia builder offers every earned piece marked with its company's logo. Screens: `docs/ui-audit-2026-10/flags/`.

### D · The trade war, rivals, liaisons — trade war and rivals built 2026-10-14 (liaisons: their own step); **simplified 2026-10-15**

**Simplified (2026-10-15).** The designer, on the standings: "This needs some info arch and copy iterations", then on the war itself: "It doesn't really make sense to me what I'm looking at" → **option 1**. Kept: seasons of 7 contracts, shares that sum to 100 moved as below, the shares on the home dock, the crown — now **only on an outright leader** (a tie, the even start included, crowns nobody: `seasonLeader` returns null), and desperate terms for the last of the companies that hire you (none when they all hold the same share). **Changed: the season's end pays your patron** — the company you delivered the most contracts for this season, leader or not: **75 gold per delivery for it** and a **pick of 1 of 3 of its item kinds** (the vault, as before). A tie on your deliveries goes to the bigger share, then a hash of the season; no delivery this season, no patron and nothing paid (`seasonPatron`, `endSeason`, `PATRON_PURSE`). **Cut:** the champion threshold, exclusives (the sheet, the standing ×1.5/×1.25), rivals (`Company.rival`) and cold (the rival's stake cap one crate lower, the cold notice). Meta v16: an old save's `season.exclusive` is read past and dropped; a pending season's end that paid its champion reads the leader as your patron, and one that paid nothing is dropped. The season keeps an ordered **log** of its finished contracts (the company when delivered, else null) for the home's seven-bar widget (`seasonBars`); an older save's log is rebuilt from its deliveries. The standings' card was rebuilt for it: `docs/ui-audit-2026-10/tradewar/season-card/REVIEW.md`. The rest of this section is the build as it was before, kept for the record.

**Built (2026-10-14, before the simplification)** (rules `src/game/run/tradeWar.ts`; save `metaStore.season`, meta v14; UI `ui/shell/war/`, `styles/war.css`; tests `tests/tradeWar.test.ts`). What the build decided where the spec left it open:
- **When it counts**: with the market of the day (`MARKET_FROM_RUN`, 5 finished contracts) — staged as `revealOf.war`, the `war` idea latched in `met`, one coach tip on the home the first time (after the market's). Before it no contract counts. A custom seed never counts; the **Sovereign Route counts toward the season but moves no share** (it is your own road, no company's).
- **Shares**: whole points summing to 100, never below a floor of 2 (every company keeps a segment on the bar). Delivered: **+4** for its company, **+1 per 2 crates** staked; cashed out: **+2**; fallen: **−2**. A gain takes one point at a time from the biggest other share, a loss gives to the smallest — as even as whole points allow. Only your contracts move the trade.
- **The season's end** (the 7th contract's settle): the leader is the biggest share (ties: your deliveries for it, then a hash of the season). **Its top militia** is you if you delivered **2 or more** of its contracts this season: it pays **75 gold per delivery**, banked at the settle, and a **pick of one of 3 item kinds from its vault** — its own Level 1–3 kinds, still-locked first (taking one unlocks it), else owned ones as a **Rare bonus item** for the next contract (the standing bonus's path). A page left unread when the next season ends is picked for you (its first offer).
- **Desperate terms**: the last company **that hires you** (never the leader) posts them for the next season: everything its contracts pay ×**1.5** (fees, sales, completion bonus and a cash-out, on top of the market), its raiders ×**1.2** (the run's starting Threat, `contractRules`). Signed onto the contract (`ContractTerms.desperate`, snapshotted), so a midnight or a season's end changes nothing mid-road. Measured (paired seeds, n=150, `balance/runsim` with `contract.desperate`): zero-meta escort delivered 13.3% → 10.0%, veteran escort 35.3% → 30.0%, veteran 4 crates 24.0% → 15.3%.
- **Then the shares regress halfway to even** (a season's lead carries half over; the order holds, so the leader keeps leading until the next contracts move it).
- **Exclusive**: once a season, from the company's terms (a row under the war's facts opens the sheet, mockup 4a). +50% standing XP from its contracts (Easel House +25%, no cost); its rival's stake cap one crate lower (never below 1) and its home notice cold (pale paper, a "Cold" tag, "Stakes stop at N"). The other offers in the mockup (double-gold asks, city fees −20%, first vault pick) were not built — the approved spec names only these.
- **Banners at the margins — cut (2026-10-15).** The designer, on a battle with four of them: "Why are these flags randomly around the map in addition to the cargo one?" → "Keep only wagon flags." The battlefield flies the wagon's flag alone; the season's leader shows on the home (the dock's crown) and the standings.
- Screens: `docs/ui-audit-2026-10/tradewar/`.

- **Seasons** of 7 contracts. A delivered contract moves market share to its company; the home map shows a season bar and a crown on the leader's signpost (mockups 3a/3b). At season end the leader pays a reward to its top militia (its purse, a vault pick), and the last-place company posts **desperate terms** next season: pay ×1.5, raiders +20% (3c).
- **Rivals** (optional, 4a/4b): Ironvein ↔ Moonquill (plate against wards) and Peppercorn ↔ Rosethread (the river trade); Easel House sells to everyone and has no rival, so its exclusive costs nothing and pays +25% instead (pairs fixed in data). An **exclusive** for a season: +50% standing with the company, its rival's stake cap one lower and its notice "cold".
- **Liaisons** (5a/5b): one person per company who speaks at the contract board and at its cities, the way the stop keepers do — a line ≤ 40 characters, spoken, in a bubble. **Built 2026-10-14** (`data/liaisons.ts`, `run/liaison.ts`, `ui/shell/LiaisonScene.tsx`, `styles/liaisons.css`; tests `tests/liaisons.test.ts`; screens `docs/ui-audit-2026-10/liaisons/`):
  - **Who**: Saffra, Peppercorn's broker (a spice stall, lime awning hung with chilies, a brazier); Vell, Easel House's curator (a lavender tent by the canal, an easel and canvases); Brannoch, Ironvein's factor (a slate-and-blue lean-to by the blue watchtower, ore and an anvil); Odile, Rosethread's mercer (bolts of silk on a line, a sheep); Wren, Moonquill's archivist (a scroll rack and candles by night, a warded stone). Each post flies the company's own standard (the wagon's rows) and is baked by `scripts/stop-scenes.ts` from the CC0 pack, like the stops.
  - **Where**: the home notice's head (the whole post at 1×; the bubble *is* the notice's letter now, so the quoted letter went — a road not hiring yet gets its liaison's "not yet"); a city's head (2×, the city's name hung on it as the page's title, which replaced the "The caravan reaches…" eyebrow — the rail says the act); and one small line on the receipt (delivered by asks met — all, some, none or a contract that asked nothing — cashed out, or fallen).
  - **What they say**: at the board, the road's trouble or what the company wants (fixed for the day); at a city, one of: the cargo that arrived (≥ 90% good, ≥ 60% fair, a rough arrival is all they talk about) or one of the contract's asks — a nudge while it is open, "Deepforge tips for it" once met (a count ask only). The tip promised is the real one (`ASK_TIP`, paid by the destination on a delivery); no line names a number. Every choice is a hash (day; run seed + city; run seed), never a run-stream draw.
  - **The Sovereign Route has no liaison**: it is your own road and no company hired you (its cities never stop on the city page anyway).
  - Short phones (≤ 760px tall) show the post at 82px with the line only; very short ones (≤ 640px) drop the band, as they dropped the letter.
