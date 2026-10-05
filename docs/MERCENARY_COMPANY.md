# Fieldwatch — the mercenary company (design spec, draft 1)

Status: the designer's direction as of 2026-10-05 (draft 2: the push-further list approved, open questions defaulted). Numbers are placeholders, to be tuned "to what makes the game fun". **Open** marks a decision still to make.

## Premise
You run a private militia hired by trade companies to clear their trade routes of raiders. Each company trades different goods: Art, Spice, Metals & Stones, and more. Playing for a company raises your **standing** with it.

## One currency: gold
- Gold is the only currency. It pays for services, the HQ, cargo stakes and item pulls. Marks and dust are gone.
- **Default (overridable):** you set out with a **purse** you choose; the bank stays home and earns interest; what's left in the purse returns at the end.

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
- **Losing** keeps whatever was already paid at cities reached. Unsold cargo is lost.

## Unlocks
- **Skills come only from playing.**
  - Each **standing level** with a company unlocks a random skill. Its rarity scales with how high that standing is.
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

## Removed
- **Endless mode:** removed for now.
- **The Daily:** replaced by the charter.
- **The Banner/Vow ladder and difficulty steps:** replaced by stakes.

## The mercenary company (HQ upgrades)
- **HR office:** better odds on your opening hero deal. Each level improves your initial picks.
- **Finance office:** a bank. Gold left on deposit earns interest at the end of each completed run. Upgrades raise the rate.
- **Operations:**
  - **Pack slots:** buy more backpack slots.
  - **Obstacles:** pay to clear obstacles for one run, or upgrade to reduce them permanently.
  - **Company focus:** pay to weight a run's spawns further toward one company, or upgrade the default focus.
    - Spreading focus across companies must never cancel out ("+1% to all three does nothing"). Focus is therefore **one company at a time**, with meaningful steps (e.g. its share of the pool +15% / +30% / +45%).

## Overlooked: decide or design for
1. **Bank vs. run purse.**
   - If the whole bank funds merchants mid-run, a rich player buys everything and runs get easy. That fights the stakes, and it fights interest too (spending drains the deposit).
   - Proposed: set out with a purse you choose. The bank stays home and earns interest. What's left in the purse returns at the end.
2. **Hoarding vs. staking.** Default: interest pays only on finished contracts, and is capped so it never beats staking.
3. **Never broke.** The free escort contract plus per-city pay means a losing streak still earns. Keep it so.
4. **The pull's tone.** It's an in-game gamble with no real money: keep it that way, show the odds plainly, and handle duplicates well (the bonus item does this).
5. **The charter's unlock condition** ("everything unlocked") is a long road. Show progress ("Charter: 74% of the catalogue") so it reads as a goal, not a secret.
6. **The top item tier** needs a name and a colour that clash with nothing: rarity colours, company colours, cursed ground, the clearance red.
7. **Obstacles are a balance lever** (they were the main one after the finer grid). Price obstacle removal so it doesn't trivialise routes.
8. **Removing the Daily** loses the "same seed for everyone" feature. Fine for now; the charter could have a weekly seed later.
9. **First run (LS3):** a free escort contract from one company. Stakes, pulls and the HQ open after the first finished contract, each with one tip.

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
5. The endgame charter.
6. One tuning pass.
