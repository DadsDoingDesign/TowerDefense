import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { sfx } from '../audio/audio'
import { num, numRecord, safePersistStorage } from './storage'

/**
 * What a hub purchase *does* to the game (H15).
 *
 *  - `ramp` makes the player stronger. Every one of the seven original hub
 *    upgrades was one of these, which made the whole meta layer a treadmill:
 *    the only thing a hundred runs could buy was a bigger number, and a maxed
 *    hub simply deleted the early game.
 *  - `unlock` makes the *run* wider — more map, more stops, more choices —
 *    without making the player stronger at any of them.
 *
 * The ramp is kept, deliberately and bounded. The balance harness measures a
 * zero-meta solo run clearing about six of ten nodes, so a new player does need
 * a hand; what it must not do is keep paying out forever. Every ramp line now
 * caps in one or two purchases (they used to run to five and six), so the whole
 * ramp is worth +10 base, +50 gold, +2 stats, one Sentinel and one item — a
 * first-week leg-up, not a permanent power budget. Everything bought after that
 * widens the game instead.
 */
export type UpgradeKind = 'ramp' | 'unlock'

export interface MetaUpgrade {
  id: string
  name: string
  desc: string
  maxLevel: number
  baseCost: number
  step: number
  kind: UpgradeKind
}

export const UPGRADES: MetaUpgrade[] = [
  // ── the onboarding ramp — bounded on purpose ─────────────────────────────
  { id: 'base', name: 'Reinforced Base', desc: '+5 max Base integrity', maxLevel: 2, baseCost: 60, step: 40, kind: 'ramp' },
  { id: 'gold', name: 'War Chest', desc: '+25 starting gold', maxLevel: 2, baseCost: 50, step: 30, kind: 'ramp' },
  // The copy says "every Sentinel", and since M18 the code agrees: the bonus is
  // applied in `buildStartingRoster` AND in `scaledRecruit`, so it covers the
  // company you start with and every body the run hires. It used to say
  // "starting Sentinels" and mean it, which made a permanent purchase quietly
  // worth less the longer a run went on.
  { id: 'stats', name: 'Seasoned Recruits', desc: '+1 to all stats on every Sentinel who joins the watch', maxLevel: 2, baseCost: 80, step: 50, kind: 'ramp' },
  { id: 'roster', name: 'Standing Company', desc: 'Begin each run with an extra Sentinel', maxLevel: 1, baseCost: 150, step: 150, kind: 'ramp' },
  { id: 'loot', name: 'Quartermaster', desc: 'Begin each run with an extra item', maxLevel: 1, baseCost: 70, step: 60, kind: 'ramp' },
  /**
   * **`marks` — "Chronicler", +15% Watch Marks per level, four levels — is gone
   * (F-B5).**
   *
   * It was 880 of the hub's ~1,990 marks, its single biggest sink, and it did
   * nothing to a run. A currency multiplier is correct on every horizon past
   * its own payback (~7 runs here) and correct regardless of how you play, so
   * the hub's first click had a known answer and its most expensive line was a
   * tax rebate. That is the opposite of what a hub is for: every other line on
   * this list changes a run, and the player should be choosing between changes.
   *
   * Marks now scale with the *risk the player accepts* — the Banner ladder,
   * where a multiplier is the payout on a bet rather than a purchase — and with
   * how far the run got. Nothing else multiplies them.
   *
   * A save that already bought levels of it keeps its marks; the level is
   * simply never read again. `migrateMeta` clamps unknown ids out of the way.
   */

  // ── horizontal unlocks — these widen the run, they do not strengthen you ──
  //
  // All three are graded by the harness on TWO gates (§12): the breadth their
  // card promises has to show up in the generated map, and none of them — alone
  // or in any combination — may lower the measured win rate. The second gate
  // exists because the first version of `Cartographer's Table` did exactly
  // that: it moved the boss two layers deeper and took the campaign from 40%
  // winnable to 7%, permanently, for 120 marks.
  {
    id: 'cartographer',
    name: "Cartographer's Table",
    desc: 'The Watch maps every fork it can find: three or four roads a layer and never a corridor — the route becomes an argument, not a queue',
    maxLevel: 1,
    baseCost: 120,
    step: 0,
    kind: 'unlock',
  },
  {
    id: 'freeCompanies',
    name: 'Free Companies',
    desc: 'A second Recruit stop on every map, and mercenaries arrive trained for the depth you hire them at',
    maxLevel: 1,
    baseCost: 180,
    step: 0,
    kind: 'unlock',
  },
  {
    id: 'standingOrders',
    name: 'Standing Orders',
    desc: 'The Watch picks its fights: no Elite ever stands on a road with no way around it — every ambush has a way past, if you would rather spend the march elsewhere',
    maxLevel: 1,
    baseCost: 160,
    step: 0,
    kind: 'unlock',
  },
]
const UPGRADE_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]))

export const SACRIFICE_BASE_COST = 200
export const SACRIFICE_STEP = 150

/**
 * ---------------------------------------------------------------------------
 * The Banner ladder — what Dark Sacrifice became (H16 / M29).
 * ---------------------------------------------------------------------------
 *
 * Dark Sacrifice broke every rule a difficulty ladder has. It was:
 *
 *  - **permanent and global** — one tap raised enemy HP by 15% *forever*, on
 *    every run, in both modes, with no way back short of erasing the save;
 *  - **bought, not earned** — the gate was 200 Watch Marks, so it measured
 *    grinding rather than skill;
 *  - **numbers only** — +1 to every stat, +10% marks, +15% enemy HP. Nothing
 *    about the game changed; the same run happened with different arithmetic;
 *  - **a stat ratchet on both sides** — it made the player stronger *and* the
 *    enemies stronger, so it did not even reliably raise difficulty.
 *
 * A Banner is the opposite of all four. It is chosen **per run, at the start**,
 * from the rungs you have unlocked; it never applies to a run you did not
 * choose it for; each rung takes a *rule* away rather than adding a multiplier;
 * and the reward scales with the rung, so flying a Banner is a bet rather than
 * a tax. Rungs are cumulative — Banner 3 flies 1, 2 and 3.
 */
export interface BannerRung {
  tier: number
  name: string
  /** The rule this rung changes, in the player's words. */
  rule: string
  /** Marks multiplier for finishing a run under this Banner (cumulative). */
  markMult: number
}

/**
 * Every rung states exactly one rule, only the rule that rung ADDS, and every
 * rule is implemented and measurable.
 *
 * ---------------------------------------------------------------------------
 * What the ladder used to be, and why none of it survived (F-C2)
 * ---------------------------------------------------------------------------
 *
 * Measured at n=150 paired runs per rung, marks by `grantRunRewards`'s own
 * formula, on the zero-meta baseline:
 *
 * | old rung | rule added | ×marks | win% | marks/run |
 * |---|---|--:|--:|--:|
 * | 1 Forced March | no merchants | 1.25 | 40% | 142 |
 * | 2 Thin Pickings | two cards | 1.55 | 32% | 157 |
 * | 3 Elite Watch | every node elite | 2.0 | 11% | 136 |
 * | 4 Blood Price | no recruits | 2.6 | 1% | 128 |
 * | 5 The Long Dark | start at Threat ×2 | 3.4 | 1% | 137 |
 *
 * Banner 0 wins 40% and banks 114 marks a run. So:
 *
 *  - **Rung 1 was free money.** Deleting the merchants costs a first run
 *    nothing measurable — a merchant detour is a ×1.13 Threat step for a shop
 *    the run usually cannot afford — and it paid +25%. There was no reason to
 *    ever fly Banner 0 again, which makes the ladder's first rung a mandatory
 *    bonus rather than a bet.
 *  - **Rungs 3–5 were strictly ignorable.** The payout multiplier exactly
 *    cancelled the difficulty: marks/run flatlined around 130–160 while the win
 *    rate collapsed 32 → 11 → 1 → 1%. Climbing was never worth it.
 *  - **Rung 5 was a numbers-only rung** — `startThreat: 2` and a line of copy
 *    ("the horde never sends a patrol again") that restated rung 3. Doctrine:
 *    numbers-only rungs are a treadmill.
 *
 * ---------------------------------------------------------------------------
 * What it is now
 * ---------------------------------------------------------------------------
 *
 * Every candidate rule was measured **alone**, on top of Banner 0, at n=200
 * paired runs per cell on the zero-meta baseline, across four routing policies
 * (win rate against Banner 0's 28 / 37 / 35 / 37%):
 *
 * | rule alone | specials | battles | recruits | adaptive |
 * |---|--:|--:|--:|--:|
 * | two reward cards | −9 | −12 | −6 | −7 |
 * | **no Merchants** | **−1** | **−7** | **−1** | **−3** |
 * | **every node elite** | **0** | **−3** | **+1** | **−1** |
 * | no recruits | −10 | −23 | −21 | −21 |
 * | start at Threat ×2 | −24 | −28 | −24 | −25 |
 *
 * **Re-measured after the Banner-2 pricing fix (M19-g).** `allElite` used to
 * read −10 / −25 / −17 / −15 on this table, and almost none of that was the
 * composition: it was `THREAT_PER_NODE[kind]`, which charged every battle node
 * the ×1.52 elite step under this rung instead of ×1.42 — a compounding
 * surcharge the rung's card never mentioned (`gameStore.mapKind`). With the
 * price *and* the elite pay (+25 gold, +0.15 card luck) both following the kind
 * the map dealt, the rule alone is close to free at this sample size. It still
 * earns its rung cumulatively — the ladder measures 39 → 29 → 26 → 11% win with
 * marks 110 → 130 → 181 → 210, so both §13 invariants hold — but Elite Watch is
 * now the cheapest rule on the ladder carrying the second-largest multiplier,
 * and that is the next thing to re-price. The honest fix is a harder elite
 * *composition* (`waves.ts`), not a second surcharge here.
 *
 * So the ladder is three rungs, priced so that *expected marks per run rise
 * across every rung* — the invariant the harness now gates on (§13). Two
 * candidates were cut:
 *
 *  - **Forced March is not a rung.** Deleting the merchants does not make a run
 *    meaningfully harder — a merchant is a ×1.13 Threat step for a shelf a
 *    gold-poor run cannot buy from, so on the line a first-timer walks it once
 *    measured *easier* (+6pt) and re-measures at −1 to −7pt: noise either side
 *    of free. A rung has to be a bet, and this one paid +25% for that. That the
 *    game contains a node type whose removal can measure as a *buff* is a real
 *    defect — it
 *    belongs to the shop economy (prices, stock, the special Threat step), not
 *    to this ladder, and it is reported as such. `noMerchants` stays wired and
 *    tested so the rung can come back the day a merchant is worth stopping at.
 *  - **The Long Dark is not a rung.** `startThreat: 2` is the largest number on
 *    the table and the only one that changes no decision — the definition of a
 *    treadmill rung. A fourth rung needs a fourth *rule* (no Shrines is the
 *    obvious next one, and wants a `noShrines` flag threaded through
 *    `mapOptionsFor`), not a bigger multiplier.
 *
 * Existing saves that had unlocked rungs 4–5 clamp to 3 in {@link migrateMeta}.
 */
export const BANNER_RUNGS: BannerRung[] = [
  { tier: 1, name: 'Thin Pickings', rule: 'Every clear offers two reward cards instead of three. Half the build, same march.', markMult: 1.4 },
  /*
   * ---- this card said three things and one of them was true (M7a) ---------
   *
   * It read "armour columns, champions, compressed waves". Measured against the
   * code it names:
   *
   *  - **"armour columns"** — `pickVariant` rotates uniformly over `plated` /
   *    `warded` / `swift` (`waves.ts`), so roughly two thirds of an Elite Watch
   *    run's battle nodes are not armour at all. Warded is a light host and
   *    Swift is a fast one; a player who buys this rung and brings magic to
   *    counter the plate meets a Warded Host that resists exactly that.
   *  - **"champions"** — `ELITE_CHAMPION_DEPTH` is 6, so on the standard
   *    11-layer map depths 1–5 field none. Half the march, no champions.
   *  - **"compressed waves"** — true: `ELITE_WINDOW` is 0.85.
   *
   * That is a card taking Watch Marks for mechanics two thirds of which do not
   * arrive, on a rung the player cannot opt out of once flown. This project has
   * now shipped copy describing a mechanic that does not exist five times; the
   * rule below says what the code does, including the depth the champion is
   * actually gated behind.
   */
  { tier: 2, name: 'Elite Watch', rule: 'Every battle node is an elite: armoured, warded or swift, arriving faster — champion-led from depth 6.', markMult: 2.2 },
  { tier: 3, name: 'Blood Price', rule: 'No recruits, anywhere. The company you start with is the company you finish with.', markMult: 3.5 },
]

export const MAX_BANNER = BANNER_RUNGS.length

/** Everything a run needs to know about the Banner it is flying. */
export interface BannerRules {
  tier: number
  /** No merchant nodes are generated. */
  noMerchants: boolean
  /** Reward picks drop from three cards to two. */
  thinPickings: boolean
  /** Every battle node resolves as an elite encounter. */
  allElite: boolean
  /** Recruit offers are withheld (nodes, crossroads, merchant hires). */
  noRecruits: boolean
  /**
   * Threat the run starts at.
   *
   * No rung sets this any more: it was the whole of the old rung 5, and a rung
   * that only multiplies a number is a treadmill rather than a wager. The field
   * stays because `setRunBanner` reads it to seed a run's Threat and a future
   * rung may want it *alongside* a rule — not as one.
   */
  startThreat: number
  /** Marks multiplier for the run. */
  markMult: number
}

export const NO_BANNER: BannerRules = {
  tier: 0,
  noMerchants: false,
  thinPickings: false,
  allElite: false,
  noRecruits: false,
  startThreat: 1,
  markMult: 1,
}

/** The cumulative ruleset for flying Banner `tier` (0 = none). */
export function bannerRules(tier: number): BannerRules {
  const t = Math.max(0, Math.min(MAX_BANNER, Math.floor(num(tier, 0))))
  if (t <= 0) return NO_BANNER
  return {
    tier: t,
    thinPickings: t >= 1,
    allElite: t >= 2,
    noRecruits: t >= 3,
    // No rung takes these two. Both are wired, implemented and covered by the
    // map generator; both were measured and neither earns a rung today (see
    // BANNER_RUNGS above).
    noMerchants: false,
    startThreat: 1,
    markMult: BANNER_RUNGS[t - 1].markMult,
  }
}

export interface MetaStats {
  bestDepth: number
  /** Deepest Endless round survived — tracked separately so one cannot flatter the other (M33). */
  bestRound: number
  /** Highest Banner ever carried to a campaign win. The real difficulty record. */
  bestBanner: number
  totalKills: number
  sentinelsLost: number
  runsCompleted: number
  runsWon: number
}

/** Bonuses the meta layer grants to each new run. */
export interface MetaBonuses {
  maxBaseHp: number
  startGold: number
  statBonus: number
  extraSentinels: number
  extraItems: number
  enemyHpMult: number
}

interface MetaState {
  watchMarks: number
  upgrades: Record<string, number>
  /**
   * Highest Banner rung UNLOCKED — a record of what you have opened up, not a
   * penalty you are stuck with. Persisted under its old name so every existing
   * save keeps its progress; what changed is what the number means (H16).
   */
  sacrificeTier: number
  stats: MetaStats
  // actions
  upgradeCost: (id: string) => number
  buyUpgrade: (id: string) => void
  /** True once this hub unlock has been bought. */
  unlocked: (id: string) => boolean
  sacrificeCost: () => number
  /** Unlock the next Banner rung. Costs marks; changes nothing about any run by itself. */
  doSacrifice: () => void
  grantMarks: (n: number) => void
  grantRunRewards: (info: {
    depth: number
    won: boolean
    kills: number
    downs: number
    mode?: 'campaign' | 'endless'
    /** Banner the run was flying, if any — scales the payout. */
    banner?: number
  }) => number
  bonuses: () => MetaBonuses
  resetMeta: () => void
}

const BASE_MAX_HP = 20
const BASE_GOLD = 60

const freshStats = (): MetaStats => ({
  bestDepth: 0,
  bestRound: 0,
  bestBanner: 0,
  totalKills: 0,
  sentinelsLost: 0,
  runsCompleted: 0,
  runsWon: 0,
})

/**
 * Persisted meta schema version (M11). Bump this and add a case to
 * {@link migrateMeta} whenever the shape changes.
 *
 * v2 — `stats.bestRound` / `stats.bestBanner` added, and `sacrificeTier`
 * reinterpreted from "permanent global heat, already applied" to "highest
 * Banner unlocked, flown per run". No data has to move: an old save's tier N
 * becomes N unlocked Banners, and the permanent +15% enemy HP / +1 stats it
 * used to carry simply stops applying, which is strictly what the player would
 * have chosen given the option.
 */
export const META_VERSION = 2

/** Persisted slice — the only part of the store that survives a reload. */
type PersistedMeta = Pick<MetaState, 'watchMarks' | 'upgrades' | 'sacrificeTier' | 'stats'>

/**
 * Bring any stored payload up to the current shape, defaulting EVERY numeric
 * field (M11).
 *
 * This store does `stats.x + n` arithmetic, so a field added in a later version
 * would arrive as `undefined` from an older save, become NaN on the first
 * grant, and stay NaN forever — persisted back out each time. Coercing on the
 * way in is what prevents that. It is also what keeps the existing (verified)
 * property that a hand-corrupted `fieldwatch-meta` key degrades to defaults
 * rather than crashing: anything unrecognisable simply becomes its default.
 */
export function migrateMeta(persisted: unknown, _version: number): PersistedMeta {
  const o = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>
  const rawStats = (o.stats && typeof o.stats === 'object' ? o.stats : {}) as Record<string, unknown>
  const base = freshStats()
  // Old saves bought hub levels against caps that are now lower; clamp rather
  // than leave a level the UI can never render and `bonuses()` would over-pay.
  const upgrades = numRecord(o.upgrades)
  for (const u of UPGRADES) {
    if (upgrades[u.id] != null) upgrades[u.id] = Math.max(0, Math.min(u.maxLevel, Math.floor(upgrades[u.id])))
  }
  return {
    watchMarks: Math.max(0, num(o.watchMarks, 0)),
    upgrades,
    sacrificeTier: Math.max(0, Math.min(MAX_BANNER, num(o.sacrificeTier, 0))),
    stats: {
      bestDepth: Math.max(0, num(rawStats.bestDepth, base.bestDepth)),
      bestRound: Math.max(0, num(rawStats.bestRound, base.bestRound)),
      bestBanner: Math.max(0, num(rawStats.bestBanner, base.bestBanner)),
      totalKills: Math.max(0, num(rawStats.totalKills, base.totalKills)),
      sentinelsLost: Math.max(0, num(rawStats.sentinelsLost, base.sentinelsLost)),
      runsCompleted: Math.max(0, num(rawStats.runsCompleted, base.runsCompleted)),
      runsWon: Math.max(0, num(rawStats.runsWon, base.runsWon)),
    },
  }
}

export const useMetaStore = create<MetaState>()(
  persist(
    (set, get) => ({
      watchMarks: 0,
      upgrades: {},
      sacrificeTier: 0,
      stats: freshStats(),

      upgradeCost: (id) => {
        const u = UPGRADE_BY_ID.get(id)!
        const level = get().upgrades[id] ?? 0
        return u.baseCost + u.step * level
      },

      buyUpgrade: (id) => {
        const u = UPGRADE_BY_ID.get(id)
        if (!u) return
        const { watchMarks, upgrades } = get()
        const level = upgrades[id] ?? 0
        if (level >= u.maxLevel) return
        const cost = get().upgradeCost(id)
        if (watchMarks < cost) return sfx('error')
        set({ watchMarks: watchMarks - cost, upgrades: { ...upgrades, [id]: level + 1 } })
        sfx('confirm')
      },

      unlocked: (id) => (get().upgrades[id] ?? 0) > 0,

      sacrificeCost: () => SACRIFICE_BASE_COST + SACRIFICE_STEP * get().sacrificeTier,

      doSacrifice: () => {
        const { watchMarks, sacrificeTier } = get()
        if (sacrificeTier >= MAX_BANNER) return sfx('error')
        const cost = get().sacrificeCost()
        if (watchMarks < cost) return sfx('error')
        // Unlocking a Banner changes NOTHING on its own — no global multiplier,
        // no permanent ratchet. It adds a rung the next run may choose to fly.
        set({ watchMarks: watchMarks - cost, sacrificeTier: sacrificeTier + 1 })
        sfx('confirm')
      },

      grantMarks: (n: number) => set({ watchMarks: get().watchMarks + Math.max(0, Math.round(n)) }),

      grantRunRewards: ({ depth, won, kills, downs, mode = 'campaign', banner = 0 }) => {
        const { watchMarks, stats } = get()
        // **One multiplier, and you have to earn it.** The formula used to fold
        // in `sacrificeTier` (a permanent bonus for a permanent penalty, paid
        // whether the run was hard or not) and then the Chronicler hub line (a
        // flat rebate on every run forever). What is left is the Banner the run
        // actually flew — a bet the player placed at the start of THIS march —
        // multiplied by how far the march got.
        const markMult = bannerRules(banner).markMult
        const earned = Math.round((num(depth, 0) * 8 + (won ? 120 : 0)) * markMult)
        const isEndless = mode === 'endless'
        // Every read is coerced: this is `x + n` arithmetic over a persisted
        // record, and one field arriving as `undefined` from an older save
        // would turn a stat into NaN permanently (M11).
        set({
          watchMarks: num(watchMarks, 0) + earned,
          stats: {
            // Campaign depth and Endless rounds are different achievements and
            // are recorded as such — an Endless run used to update nothing at
            // all, and folding its round count into `bestDepth` would have made
            // the campaign record a lie instead (M13 / M33).
            bestDepth: isEndless ? num(stats.bestDepth, 0) : Math.max(num(stats.bestDepth, 0), num(depth, 0)),
            bestRound: isEndless ? Math.max(num(stats.bestRound, 0), num(depth, 0)) : num(stats.bestRound, 0),
            // Clamped to the ladder: a record is a rung that exists (F8).
            bestBanner:
              won && !isEndless
                ? Math.max(num(stats.bestBanner, 0), Math.min(MAX_BANNER, Math.max(0, num(banner, 0))))
                : num(stats.bestBanner, 0),
            totalKills: num(stats.totalKills, 0) + num(kills, 0),
            sentinelsLost: num(stats.sentinelsLost, 0) + num(downs, 0),
            runsCompleted: num(stats.runsCompleted, 0) + 1,
            runsWon: num(stats.runsWon, 0) + (won ? 1 : 0),
          },
        })
        return earned
      },

      bonuses: () => {
        const { upgrades } = get()
        const lvl = (id: string) => upgrades[id] ?? 0
        return {
          maxBaseHp: BASE_MAX_HP + lvl('base') * 5,
          startGold: BASE_GOLD + lvl('gold') * 25,
          statBonus: lvl('stats'),
          extraSentinels: lvl('roster'),
          extraItems: lvl('loot'),
          // Nothing the hub sells makes the world harder any more. Difficulty is
          // opted into per run, by Banner, and it is paid for in marks (H16).
          enemyHpMult: 1,
        }
      },

      resetMeta: () => set({ watchMarks: 0, upgrades: {}, sacrificeTier: 0, stats: freshStats() }),
    }),
    {
      name: 'fieldwatch-meta',
      version: META_VERSION,
      storage: createJSONStorage(() => safePersistStorage),
      partialize: (s) => ({
        watchMarks: s.watchMarks,
        upgrades: s.upgrades,
        sacrificeTier: s.sacrificeTier,
        stats: s.stats,
      }),
      migrate: migrateMeta,
      // `migrate` only runs when the stored version differs, so the coercion is
      // also applied through `merge` — that way a payload that is the current
      // version but corrupt (hand-edited, half-written on a crash) still lands
      // as defaults instead of NaN.
      merge: (persisted, current) => ({ ...current, ...migrateMeta(persisted, META_VERSION) }),
    },
  ),
)
