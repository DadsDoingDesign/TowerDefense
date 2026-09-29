import { nextId, type RNG } from '../core/rng'
import type { CoreStats, EffectMods, Item, ItemRarity } from '../types'
import { generateItem, type RarityPity, type RosterRef } from './items'

/** A team-wide buff a stat reward applies for the rest of the run. */
export interface RewardGrant {
  stats?: Partial<CoreStats>
  thorns?: number
  patience?: number
  mods?: EffectMods
}

/** One of the three cards offered after a cleared wave. Pick exactly one. */
export interface RewardCard {
  id: string
  kind: 'stat' | 'item'
  title: string
  desc: string
  /** Card quality, so the offer reads as an offer and not three grey boxes (L2). */
  rarity: ItemRarity
  /** What this card costs you, if it is a pact rather than a plain buff. */
  downside?: string
  item?: Item
  grant?: RewardGrant
}

/**
 * **Reward cards are a decision now (L2).**
 *
 * They used to be nine interchangeable pure-upside buffs of near-identical size
 * — the pick was "whichever number is biggest for my team", which is arithmetic,
 * not a choice, and the offer had no rarity so every card looked the same. Two
 * changes:
 *
 *  - **Rarity.** Cards roll `common` → `legendary` with the run's luck, and the
 *    grant scales with the tier, so a good offer feels like one.
 *  - **Pacts.** The strongest cards are `pact`s: a large team-wide gain bought
 *    with a real, stated team-wide loss on another axis. A pact is only correct
 *    for a team already shaped to eat the cost — a damage pact that sells range
 *    is fine on a Sharpshooter line and terrible on a fighter wall.
 *
 * Every `downside` string here is the number the engine applies, not flavour.
 */
export interface StatTemplate {
  title: string
  desc: string
  rarity: ItemRarity
  grant: RewardGrant
  downside?: string
}

/**
 * ---------------------------------------------------------------------------
 * ---- what §15 found when this table was finally measured (M6) -------------
 * ---------------------------------------------------------------------------
 *
 * Nothing had ever measured a reward card. `generateRewardCards` appears in the
 * whole balance suite twice — `report.ts` §11 and `runsim.ts` — and both absorb a
 * *random* card into a win rate, so no sweep ever enumerated this array and none
 * of the fourteen sweeps in `balance/README.md` was about it. The comment above
 * asserted a rarity ladder ("the grant scales with the tier") that had never
 * been checked, and the check found it **inverted**:
 *
 *   rarity      mean value over §15's four benches, as shipped
 *   common      +0.8pt
 *   rare        +3.4pt
 *   epic        +3.7pt
 *   legendary   **+0.5pt**
 *
 * Two of the three legendaries measured **negative** — Wildfire Pact −3.1pt and
 * Executioner's Oath −4.4pt — as did an epic, Long Watch, at −2.9pt. The best
 * card in the game was Power, a *rare*. A player who reads rarity as value, which
 * is what rarity is for, was being told to take the worst card in the hand.
 *
 * The three causes are worth writing down because they are all the same cause:
 * **the upside was priced in flavour and the downside in engine numbers.**
 *
 *  - *Wildfire Pact* bought 14 dps × 3s = 42 raw damage per application with
 *    −15% team damage — on a Weaponmaster, about −38 dps. It needed ~2.7 bodies
 *    burning simultaneously to break even, before resist, and burn does not
 *    stack. 14/s was a flavour number.
 *  - *Executioner's Oath* sold a 12% execute for −14% rate. The Executioner
 *    *mutation* — Mythic, one hero — carries 38%. A twelfth of a body's HP is
 *    less than a seventh of its damage.
 *  - *Long Watch* bought **range**, and §4 has measured for some time that range
 *    is the cheapest stat in this engine (`reach` saturates at ~+2pt on a
 *    Sharpshooter). Worse, on a *blocker* with the default `first` focus, more
 *    range is actively negative: it lets the tower see enemies that are already
 *    past it and spend shots on them instead of grinding the queue it is
 *    holding. Its epic sibling Close Quarters, which *sells* range for damage,
 *    was the strongest pact in the table for exactly the same reason.
 *
 * Every number below is now the one §15 measures, and §15 gates three things:
 * the ladder is monotone, no card is a net trap, and a card that states a
 * downside has to be a real trade in both directions (the §8/§10 standard).
 */
const STAT_CARDS: StatTemplate[] = [
  // ---- common / rare: small, safe, no strings ----
  // The four commons are deliberately below the bench's resolution (≈0.4pt, one
  // leak point) and §15 reports them without gating them — see there. +2 → +3/+4
  // because +2 of a stat a level-20 hero already has 30 of is not a card.
  { title: 'Might', desc: '+3 STR to the whole team', rarity: 'common', grant: { stats: { str: 3 } } },
  { title: 'Finesse', desc: '+4 DEX to the whole team', rarity: 'common', grant: { stats: { dex: 4 } } },
  { title: 'Insight', desc: '+4 INT to the whole team', rarity: 'common', grant: { stats: { int: 4 } } },
  { title: 'Resolve', desc: '+4 Patience to the whole team', rarity: 'common', grant: { patience: 4 } },
  { title: 'Ferocity', desc: '+6% crit chance for the team', rarity: 'rare', grant: { mods: { critChanceAdd: 0.06 } } },
  { title: 'Haste', desc: '+6% attack rate for the team', rarity: 'rare', grant: { mods: { rateMult: 1.06 } } },
  { title: 'Power', desc: '+8% damage for the team', rarity: 'rare', grant: { mods: { damageMult: 1.08 } } },
  { title: 'Reach', desc: '+8% range for the team', rarity: 'rare', grant: { mods: { rangeMult: 1.08 } } },
  { title: 'Ruin', desc: '+25% crit damage for the team', rarity: 'rare', grant: { mods: { critMultAdd: 0.25 } } },

  // ---- epic pacts: a big gain, a real bill ----
  {
    // Was ×1.22 damage for ×0.86 range and the strongest card in the table at
    // +12.7pt — because the bill it prints is the cheapest stat in the engine.
    // Priced down to +18% and the range charged harder, so the pact still reads
    // as one and stops out-earning both legendaries.
    title: 'Close Quarters',
    desc: '+18% damage for the team, bought with reach',
    rarity: 'epic',
    downside: '−18% range for the team',
    grant: { mods: { damageMult: 1.18, rangeMult: 0.82 } },
  },
  {
    // The card that bought range with rate: −2.9pt, worse than taking nothing.
    // Range alone cannot carry a pact (see the block comment above), so the
    // upside now includes **Patience**, which §4 grades on the one bench where
    // time-in-fight is the binding axis, and the rate bill is lighter.
    title: 'Long Watch',
    desc: '+25% range, +30% projectile speed and +8 Patience, bought with rate',
    rarity: 'epic',
    downside: '−8% attack rate for the team',
    grant: { patience: 8, mods: { rangeMult: 1.25, projSpeedMult: 1.3, rateMult: 0.92 } },
  },
  {
    // ---- re-pointed onto crit, for §10's reason (M6) ----------------------
    //
    // At ×1.20 rate for ×0.90 damage this was arithmetically +8% throughput for
    // nothing, and §15 measured its worst bench at −0.8pt: a plain upgrade
    // wearing a pact label. It cannot be fixed by making both numbers bigger.
    // §10 established why, at length, while re-costing `cx_frenzied`: **the
    // engine cannot read hit size.** Resists are fractional, there is no flat
    // armour, and nothing turns a halved hit into a wasted one, so a rate/damage
    // pair that cancels arithmetically buys nothing and costs nothing. Swept
    // here too — ×1.2/0.9, ×1.3/0.82, ×1.35/0.78, ×1.4/0.75 — the worst bench
    // never went past −0.8pt.
    //
    // Crit is the only per-hit spike the engine has, so it is the only coin a
    // hit-size trade can be paid in. The flurry now costs the edge outright, and
    // §15 measures +22.9pt on a low-crit splash mystic against −3.9pt on the
    // depth-8 line and a crit carrier's whole burst.
    title: 'Whetstone Pact',
    desc: '+32% attack rate for the team — ground so fine there is no edge left',
    rarity: 'epic',
    downside: 'the team never crits',
    grant: { mods: { rateMult: 1.32, critChanceAdd: -1 } },
  },
  {
    // −12% tower HP was inside the bench's resolution (−1.9pt worst). HP only
    // costs anything on a Sentinel that blocks and therefore takes melee, so the
    // bill has to be big enough to fell one: −22%, against a bigger gain.
    title: 'Bloodletting',
    desc: '+20% damage and +8 Thorns, bought with tower HP',
    rarity: 'epic',
    downside: '−22% tower HP for the team',
    grant: { thorns: 8, mods: { damageMult: 1.2, hpMult: 0.78 } },
  },

  // ---- legendary pacts: run-defining, and they hurt ----
  {
    // 12% → 45%. A twelfth of a body's HP against −14% of the team's rate was a
    // net −4.4pt; the Mythic Executioner mutation carries 38% on ONE hero, and a
    // legendary team card that does a third of that is not a legendary.
    title: 'Executioner’s Oath',
    desc: 'The team executes anything below 45% HP and crits 12% more often — slowly',
    rarity: 'legendary',
    downside: '−12% attack rate for the team',
    grant: { mods: { execute: 0.45, critChanceAdd: 0.12, rateMult: 0.88 } },
  },
  {
    // 14/s → 80/s, and the bill raised to match. 14 dps over 3s is 42 raw damage
    // per application against a −15% team damage cost worth roughly −38 dps: it
    // needed nearly three bodies burning at once to break even, and burn does not
    // stack. At 80/s it is what the card says it is — and it is worth most where
    // a splash line applies it to a crowd (+49.4pt on §15's magic bench) and
    // least on 90 runts that die to the first hit (+0.0pt).
    title: 'Wildfire Pact',
    desc: 'Every hit burns for 80/s over 3s — the hit itself lands far lighter',
    rarity: 'legendary',
    downside: '−35% damage per hit for the team',
    grant: { mods: { burn: { dps: 80, dur: 3 }, damageMult: 0.65 } },
  },
  {
    title: 'Iron Vigil',
    desc: '+60% tower HP, +16 Thorns and +6 Patience, bought with damage',
    rarity: 'legendary',
    downside: '−14% damage for the team',
    grant: { thorns: 16, patience: 6, mods: { hpMult: 1.6, damageMult: 0.86 } },
  },
]

/** One of every stat card, for balance tooling (§15). Mirrors `allMutations`. */
export function allStatCards(): readonly StatTemplate[] {
  return STAT_CARDS
}

/** Cards a given luck roll may offer. Luck 0 tops out at epic; high luck opens legendary. */
const RARITY_WEIGHT: Record<ItemRarity, number> = {
  common: 40,
  rare: 34,
  epic: 18,
  legendary: 8,
  mythic: 0, // mutations own the Mythic tier; reward cards never reach it
}

function pickCardRarity(rng: RNG, luck: number): ItemRarity {
  const tiers: ItemRarity[] = ['common', 'rare', 'epic', 'legendary']
  // Luck tilts the table upward the way item drops do, without ever guaranteeing.
  const weights = tiers.map((t, i) => RARITY_WEIGHT[t] * (1 + luck * i))
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = rng.range(0, total)
  for (let i = 0; i < tiers.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return tiers[i]
  }
  return 'common'
}

/**
 * Three reward cards for a cleared wave — a mix of team attribute buffs and
 * items (items go to the inventory to equip later). Always at least one of each.
 */
export function generateRewardCards(
  rng: RNG,
  opts: {
    luck?: number
    count?: number
    /** The team the card is being offered to, so the item card is not dead on arrival (M9). */
    roster?: readonly RosterRef[]
    /**
     * Run-scoped rarity pity (M9). The drought's luck applies to every item card
     * in the hand, but the counter is NOT advanced here: a hand is an offer and
     * at most one card of it is ever taken. The caller charges the counter when
     * the player picks an item card — see `creditPity` (F4).
     */
    pity?: RarityPity
  } = {},
): RewardCard[] {
  const count = opts.count ?? 3
  const luck = opts.luck ?? 0
  const kinds: ('stat' | 'item')[] = []
  for (let i = 0; i < count; i++) kinds.push(rng.chance(0.5) ? 'stat' : 'item')
  if (!kinds.includes('item')) kinds[0] = 'item'
  if (!kinds.includes('stat')) kinds[kinds.length - 1] = 'stat'

  const usedStats = new Set<string>()
  return kinds.map((k) => {
    if (k === 'item') {
      const item = generateItem(rng, { luck, roster: opts.roster, pity: opts.pity, commitPity: false })
      return { id: nextId('rw'), kind: 'item', title: item.name, desc: '', rarity: item.rarity, item }
    }
    const rarity = pickCardRarity(rng, luck)
    const tier = STAT_CARDS.filter((c) => c.rarity === rarity)
    const pool = tier.length ? tier : STAT_CARDS
    let t = rng.pick(pool)
    let guard = 0
    while (usedStats.has(t.title) && guard++ < 20) t = rng.pick(pool)
    usedStats.add(t.title)
    return {
      id: nextId('rw'),
      kind: 'stat',
      title: t.title,
      desc: t.desc,
      rarity: t.rarity,
      ...(t.downside ? { downside: t.downside } : {}),
      grant: t.grant,
    }
  })
}
