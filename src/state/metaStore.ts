import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { sfx } from '../audio/audio'
import { num, numRecord, onStorageKeyChange, safePersistStorage } from './storage'
import { dailyScore } from './daily'
import { ACHIEVEMENTS, newlyEarned, type RunFacts } from '../game/data/achievements'
import { addFelled, sanitizeFelled } from '../game/data/enemyKnowledge'
import { readMet, type IdeaId } from './staging'
import {
  clampStep,
  difficultyRules,
  MAX_DIFFICULTY,
  rollUnlock,
  watchLevelFor,
  watchXpFor,
  winReward,
  winScore,
} from '../game/run/watch'
import { RANDOM_UNLOCK_SKILLS } from '../game/data/skills'

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
  /**
   * The feat that makes this purchasable (Phase 3b). A horizontal service is
   * opened by PLAYING — the achievement — and then bought with marks; the
   * ramp needs nothing.
   */
  requires?: string
}

export const UPGRADES: MetaUpgrade[] = [
  // ── the onboarding ramp — bounded on purpose ─────────────────────────────
  { id: 'base', name: 'Reinforced Gate', desc: '+5 max Gate HP', maxLevel: 2, baseCost: 60, step: 40, kind: 'ramp' },
  { id: 'gold', name: 'War Chest', desc: '+25 starting gold', maxLevel: 2, baseCost: 50, step: 30, kind: 'ramp' },
  // The copy says "every Sentinel", and since M18 the code agrees: the bonus is
  // applied in `buildStartingRoster` AND in `scaledRecruit`, so it covers the
  // company you start with and every body the run hires. It used to say
  // "starting Sentinels" and mean it, which made a permanent purchase quietly
  // worth less the longer a run went on.
  { id: 'stats', name: 'Seasoned Recruits', desc: '+1 to all stats on every hero you start with or hire', maxLevel: 2, baseCost: 80, step: 50, kind: 'ramp' },
  { id: 'roster', name: 'Standing Company', desc: 'Begin each run with an extra hero', maxLevel: 1, baseCost: 150, step: 150, kind: 'ramp' },
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
  // ── Phase 3b: services opened by a feat, then bought — more choices, never
  //    more power at any one of them. Each is graded in §12 like the rest.
  {
    id: 'fieldKitchen',
    name: 'Field Kitchen',
    desc: 'Every campfire offers a third choice: forage the road for 40 gold instead of resting or training',
    maxLevel: 1,
    baseCost: 220,
    step: 0,
    kind: 'unlock',
    requires: 'act_two',
  },
  {
    id: 'cartulary',
    name: 'Relic Cartulary',
    desc: 'An act boss lays out four relics instead of three — the same prize, a wider pick',
    maxLevel: 1,
    baseCost: 260,
    step: 0,
    kind: 'unlock',
    requires: 'first_light',
  },
]
const UPGRADE_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]))

/**
 * What a Banner rung used to cost, kept ONLY so {@link migrateMeta} can refund
 * it: rung N cost `200 + 150·(N−1)` Watch Marks (200 / 350 / 500 / 650 / 800 —
 * v1 saves could hold rungs 4–5). Rungs are earned by winning now.
 */
const LEGACY_BANNER_PRICE = (rung: number): number => 200 + 150 * (rung - 1)
export const legacyBannerRefund = (unlocked: number): number => {
  let total = 0
  for (let r = 1; r <= Math.max(0, Math.floor(unlocked)); r++) total += LEGACY_BANNER_PRICE(r)
  return total
}

/**
 * ---------------------------------------------------------------------------
 * Difficulty steps — what replaced the Banner (Vow) ladder (SK1)
 * ---------------------------------------------------------------------------
 *
 * The designer: "each time you beat the game the difficulty goes up a bit.
 * you can turn it back down but you dont get another skill unless you beat
 * your score when you win at the same difficulty."
 *
 * The Vow ladder took a RULE away per rung (two reward cards, every battle an
 * elite, no recruits). A difficulty step is one plain dial instead —
 * enemies +8% stronger and one more elite in each act per step
 * (`run/watch.difficultyRules`) — raised by WINNING at the top step and
 * lowered at the start of any run. Marks still pay for the climb (×1.25 a
 * step), and the balance report keeps the ladder's two gates: every step must
 * cost, and every step must pay (§13).
 *
 * A save's highest unlocked Vow becomes its top difficulty step (v6), so a
 * player who had opened Vow 2 starts at difficulty 2 and can turn it down.
 */
export { difficultyRules, MAX_DIFFICULTY, type DifficultyRules } from '../game/run/watch'

export interface MetaStats {
  bestDepth: number
  /** Deepest Endless round survived — tracked separately so one cannot flatter the other (M33). */
  bestRound: number
  /** Highest difficulty step ever carried to a campaign win (was the best Banner). */
  bestDifficulty: number
  totalKills: number
  runsCompleted: number
  runsWon: number
}

/**
 * The day's scored Daily Watch attempt (Phase 1). One per UTC day: it is
 * claimed the moment a hero is committed to that day's seed, so backing out
 * after a bad first wave does not buy a second scored try.
 */
export interface DailyRecord {
  date: string
  depth: number
  won: boolean
  kills: number
  score: number
  /** True once the run has settled; false while the attempt is still live. */
  done: boolean
}

function migrateDaily(raw: unknown): DailyRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) return null
  return {
    date: o.date,
    depth: Math.max(0, num(o.depth, 0)),
    won: o.won === true,
    kills: Math.max(0, num(o.kills, 0)),
    score: Math.max(0, num(o.score, 0)),
    done: o.done === true,
  }
}

/** The Codex (Phase 3b): the Watch's field notes, persisted with the meta save. */
export interface Codex {
  /** Enemy type ids met in a wave (modded ids included — a Warded Bomber is its own entry). */
  enemies: string[]
  /** Relic ids ever taken. */
  relics: string[]
  /**
   * Q10 — enemies felled, by KIND (`enemyKind`: the key without its elite
   * modifier). The enemy info card's knowledge rule reads it
   * (`game/data/enemyKnowledge.ts`). Added without a version step: an older
   * save simply has none, which is the truth.
   */
  felled: Record<string, number>
}
const freshCodex = (): Codex => ({ enemies: [], relics: [], felled: {} })
const strList = (raw: unknown): string[] =>
  Array.isArray(raw) ? [...new Set(raw.filter((x): x is string => typeof x === 'string'))] : []
function migrateCodex(raw: unknown): Codex {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  // The spec and perk lists (v4) went with perks and evolutions (SK1).
  return { enemies: strList(o.enemies), relics: strList(o.relics), felled: sanitizeFelled(o.felled) }
}
function migrateAchievements(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!raw || typeof raw !== 'object') return out
  const known = new Set(ACHIEVEMENTS.map((a) => a.id))
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (known.has(k)) out[k] = Math.max(1, Math.floor(num(v, 1)))
  }
  return out
}

/**
 * Endless payout (Phase 3b). It paid a flat 8 marks a round and read no
 * multiplier at all, so the mode a strong player would spend an hour in paid
 * least per minute. It now pays per round, a bonus every fifth (an elite or a
 * boss round), and the multiplier of the highest difficulty step the player
 * has WON — the climb's reward carries into the endless mode it opened.
 */
export function endlessMarks(rounds: number, bestDifficulty: number): number {
  const r = Math.max(0, Math.floor(num(rounds, 0)))
  return Math.round((r * 8 + Math.floor(r / 5) * 20) * difficultyRules(bestDifficulty).markMult)
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

/**
 * SK1 — what the last settle did for the Watch's long game, for the run's
 * receipt (the result screen). Process-local, like `lastFeats`.
 */
export interface RunProgress {
  /** Watch XP the run earned. */
  xp: number
  levelBefore: number
  levelAfter: number
  /** Skill cards unlocked by this settle, in order (Watch levels first, then the win). */
  cards: string[]
  /** Why the win did or did not pay a card (null when the run was not a ranked win). */
  win: null | { step: number; card: boolean; stepUp: boolean; newBest: boolean; score: number; best: number | null }
}
export const lastProgress: { run: RunProgress | null } = { run: null }

interface MetaState {
  watchMarks: number
  upgrades: Record<string, number>
  /**
   * The highest difficulty step this save has reached (SK1). A run may be
   * played at any step from 0 up to it; a win AT it raises it one step. A v5
   * save's highest unlocked Vow (`sacrificeTier`) becomes this.
   */
  topDifficulty: number
  /** Best winning score at each difficulty step, keyed by the step. */
  difficultyBest: Record<string, number>
  /** Lifetime Watch XP (SK1): Watch levels are read off it (`run/watch.watchLevelFor`). */
  watchXp: number
  /**
   * Skill cards unlocked by Watch levels and wins, in the order they were
   * unlocked (SK1). The starters are everyone's and feat cards follow their
   * feat, so neither is stored. Validated against the library on load.
   */
  skills: string[]
  stats: MetaStats
  /** Today's (or the last played day's) scored Daily Watch attempt. */
  daily: DailyRecord | null
  /**
   * Feats earned (Phase 3b): achievement id → the run count it was earned on.
   * A feat opens content — a skill card, a relic, a Watchtower service — and
   * pays its purse once.
   */
  achievements: Record<string, number>
  /** What the Watch has seen and used, for the Codex (Phase 3b). */
  codex: Codex
  /**
   * LS3: the ideas this player has met, in the order they first appeared
   * (`state/staging.ts`). A staged first run shows an idea once it is here, and
   * the Codex glossary lists these. Validated on load (`readMet`).
   */
  met: IdeaId[]
  // actions
  /**
   * Claim `date`'s scored Daily attempt. Returns false — and changes nothing —
   * when that day's attempt was already claimed: the run is practice.
   */
  beginDaily: (date: string) => boolean
  /** Close `date`'s attempt as it stands (a run abandoned before it earned anything). */
  closeDaily: (date: string) => void
  upgradeCost: (id: string) => number
  buyUpgrade: (id: string) => void
  /** True once this hub unlock has been bought. */
  unlocked: (id: string) => boolean
  grantMarks: (n: number) => void
  grantRunRewards: (info: {
    depth: number
    won: boolean
    kills: number
    mode?: 'campaign' | 'endless'
    /** The difficulty step the run was played at — scales the payout. */
    difficulty?: number
    /**
     * Whether a win here may climb the difficulty and pay a skill card
     * (default true). A hand-picked custom seed can be shopped for an easy
     * map, and a Daily is standard rules, so neither counts toward the climb.
     */
    ranked?: boolean
    /** The UTC day of a SCORED Daily attempt this settle belongs to. */
    daily?: string | null
    /** The facts the feats are judged on (Phase 3b). Omitted: no feat can be earned. */
    facts?: RunFacts
  }) => number
  bonuses: () => MetaBonuses
  /** True once a feat is earned. */
  achieved: (id: string) => boolean
  /** Whether a hub purchase's feat (if it has one) is earned. */
  purchasable: (id: string) => boolean
  /** Add to the Codex. Ids are deduplicated; order of first sighting is kept. */
  recordCodex: (seen: Partial<Omit<Codex, 'felled'>>) => void
  /** Q10 — add one settled wave's kills (by registry key) to the Codex's felled tally. */
  recordFelled: (byKey: Iterable<readonly [string, number]>) => void
  /** LS3 — note ideas as met. Known ids only, each once; a no-op when nothing is new. */
  recordMet: (ids: Iterable<IdeaId>) => void
  resetMeta: () => void
}

const BASE_MAX_HP = 20
const BASE_GOLD = 60

const freshStats = (): MetaStats => ({
  bestDepth: 0,
  bestRound: 0,
  bestDifficulty: 0,
  totalKills: 0,
  runsCompleted: 0,
  runsWon: 0,
})

/**
 * Persisted meta schema version (M11). Bump this and add a case to
 * {@link migrateMeta} whenever the shape changes.
 *
 * v2 — `stats.bestRound` / `stats.bestDifficulty` added, and `topDifficulty`
 * reinterpreted from "permanent global heat, already applied" to "highest
 * Banner unlocked, flown per run". No data has to move: an old save's tier N
 * becomes N unlocked Banners, and the permanent +15% enemy HP / +1 stats it
 * used to carry simply stops applying, which is strictly what the player would
 * have chosen given the option.
 *
 * v3 — Banner rungs are earned by winning, not bought. Every mark a v1/v2 save
 * spent unlocking rungs is refunded (`legacyBannerRefund`), and the rungs it
 * holds are KEPT: the fix is to the price, not a reason to take back progress.
 * `daily` (the Daily Watch record) is added and defaults to null.
 *
 * v4 — Phase 3b: `achievements` (feats earned) and `codex` (enemies, relics,
 * specs and perks seen) are added and default to empty. Nothing moves.
 *
 * v5 — LS3: `met` (the ideas a player has met, for first-run staging and the
 * Codex glossary) is added and defaults to empty. Nothing moves: whether a
 * player is staged is read off `stats.runsCompleted`, which every older save
 * already carries.
 *
 * v6 — SK1: skills, Watch levels and difficulty steps. The Vow ladder is gone:
 * the highest Vow a save had unlocked (`sacrificeTier`) becomes its top
 * difficulty step, and its best Vow won (`stats.bestBanner`) its best
 * difficulty won. `watchXp`, `skills` and `difficultyBest` are added; a save
 * that has played is credited the Watch XP its lifetime record implies
 * ({@link retroWatchXp}) and one card per Watch level that buys, so a veteran
 * does not start the new progression from nothing. The Codex's spec and perk
 * lists are dropped with the systems they recorded.
 */
export const META_VERSION = 6

/**
 * The Watch XP a pre-SK1 save is credited (v6): 1 per 10 kills, 60 per win,
 * and 45 per run finished (about depth 3 — the record keeps no per-run depth).
 */
export function retroWatchXp(stats: Pick<MetaStats, 'totalKills' | 'runsWon' | 'runsCompleted'>): number {
  return Math.floor(Math.max(0, stats.totalKills) / 10) + 60 * Math.max(0, stats.runsWon) + 45 * Math.max(0, stats.runsCompleted)
}

/** The cards a fresh unlock run of `n` levels deals onto `have`, in order. */
function dealCards(have: readonly string[], n: number, ...salt: (string | number)[]): string[] {
  const out = [...have]
  for (let i = 0; i < n; i++) {
    const c = rollUnlock(out, ...salt, i)
    if (!c) break
    out.push(c)
  }
  return out.slice(have.length)
}

/** Persisted slice — the only part of the store that survives a reload. */
type PersistedMeta = Pick<
  MetaState,
  'watchMarks' | 'upgrades' | 'topDifficulty' | 'difficultyBest' | 'watchXp' | 'skills' | 'stats' | 'daily' | 'achievements' | 'codex' | 'met'
>

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
export function migrateMeta(persisted: unknown, version: number): PersistedMeta {
  const o = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>
  const rawStats = (o.stats && typeof o.stats === 'object' ? o.stats : {}) as Record<string, unknown>
  const base = freshStats()
  // Old saves bought hub levels against caps that are now lower; clamp rather
  // than leave a level the UI can never render and `bonuses()` would over-pay.
  const upgrades = numRecord(o.upgrades)
  for (const u of UPGRADES) {
    if (upgrades[u.id] != null) upgrades[u.id] = Math.max(0, Math.min(u.maxLevel, Math.floor(upgrades[u.id])))
  }
  // Read BEFORE the clamp: a v1 save that bought rungs 4–5 paid for them too.
  // A v5 save keeps its highest unlocked Vow as `sacrificeTier`; v6 calls the
  // same number its top difficulty step.
  const rawTier = Math.max(0, Math.floor(num(o.topDifficulty ?? o.sacrificeTier, 0)))
  // v3: rungs were bought with marks until now; give every one of them back.
  // Only on a real version step — `merge` calls this with META_VERSION on
  // every load, and a refund there would pay out on every boot.
  const refund = version < 3 ? legacyBannerRefund(rawTier) : 0
  const stats: MetaStats = {
    bestDepth: Math.max(0, num(rawStats.bestDepth, base.bestDepth)),
    bestRound: Math.max(0, num(rawStats.bestRound, base.bestRound)),
    // v6: the best Vow won is the best difficulty won.
    bestDifficulty: clampStep(num(rawStats.bestDifficulty ?? rawStats.bestBanner, base.bestDifficulty)),
    totalKills: Math.max(0, num(rawStats.totalKills, base.totalKills)),
    runsCompleted: Math.max(0, num(rawStats.runsCompleted, base.runsCompleted)),
    runsWon: Math.max(0, num(rawStats.runsWon, base.runsWon)),
  }
  // Only the random cards are stored, each once, in unlock order.
  const known = new Set(RANDOM_UNLOCK_SKILLS)
  let skills = Array.isArray(o.skills) ? [...new Set(o.skills.filter((x): x is string => typeof x === 'string' && known.has(x)))] : []
  let watchXp = Math.max(0, Math.floor(num(o.watchXp, 0)))
  // v6: a save that played before skills is credited the Watch XP its record
  // implies, and the cards those levels unlock. Only on the real step.
  if (version < 6 && watchXp === 0 && stats.runsCompleted > 0) {
    watchXp = retroWatchXp(stats)
    skills = [...skills, ...dealCards(skills, watchLevelFor(watchXp) - 1, 'v6', stats.runsCompleted)]
  }
  const difficultyBest: Record<string, number> = {}
  for (const [k, v] of Object.entries(numRecord(o.difficultyBest))) {
    const step = Number(k)
    if (Number.isInteger(step) && step >= 0 && step <= MAX_DIFFICULTY) difficultyBest[String(step)] = Math.max(0, Math.floor(v))
  }
  return {
    watchMarks: Math.max(0, num(o.watchMarks, 0)) + refund,
    upgrades,
    topDifficulty: clampStep(rawTier),
    difficultyBest,
    watchXp,
    skills,
    stats,
    daily: migrateDaily(o.daily),
    achievements: migrateAchievements(o.achievements),
    codex: migrateCodex(o.codex),
    // v6: the perk and evolution ideas are one idea now (skill), and the Vow
    // is the difficulty — `readMet` carries both over.
    met: readMet(o.met),
  }
}

/**
 * The feats the most recent `grantRunRewards` call earned — read by the run's
 * receipt (the recap) right after it settles. Process-local, not persisted:
 * the ledger itself is `achievements`.
 */
export const lastFeats: { ids: string[] } = { ids: [] }

export const useMetaStore = create<MetaState>()(
  persist(
    (set, get) => ({
      watchMarks: 0,
      upgrades: {},
      topDifficulty: 0,
      difficultyBest: {},
      watchXp: 0,
      skills: [],
      stats: freshStats(),
      daily: null,
      achievements: {},
      codex: freshCodex(),
      met: [],

      beginDaily: (date) => {
        if (get().daily?.date === date) return false
        set({ daily: { date, depth: 0, won: false, kills: 0, score: 0, done: false } })
        return true
      },

      closeDaily: (date) => {
        const rec = get().daily
        if (rec && rec.date === date && !rec.done) set({ daily: { ...rec, done: true } })
      },

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
        // A service behind a feat cannot be bought before the feat.
        if (!get().purchasable(id)) return sfx('error')
        const cost = get().upgradeCost(id)
        if (watchMarks < cost) return sfx('error')
        set({ watchMarks: watchMarks - cost, upgrades: { ...upgrades, [id]: level + 1 } })
        sfx('confirm')
      },

      unlocked: (id) => (get().upgrades[id] ?? 0) > 0,

      achieved: (id) => !!get().achievements[id],

      purchasable: (id) => {
        const u = UPGRADE_BY_ID.get(id)
        return !!u && (!u.requires || !!get().achievements[u.requires])
      },

      recordCodex: (seen) => {
        const cur = get().codex
        const merge = (a: string[], b?: string[]) => (b && b.some((x) => !a.includes(x)) ? [...a, ...b.filter((x, i) => !a.includes(x) && b.indexOf(x) === i)] : a)
        const next: Codex = { enemies: merge(cur.enemies, seen.enemies), relics: merge(cur.relics, seen.relics), felled: cur.felled }
        if (next.enemies !== cur.enemies || next.relics !== cur.relics) set({ codex: next })
      },

      recordMet: (ids) => {
        const cur = get().met
        const next = readMet([...cur, ...ids])
        if (next.length !== cur.length) set({ met: next })
      },

      recordFelled: (byKey) => {
        const cur = get().codex
        const felled = addFelled(cur.felled, byKey)
        if (felled) set({ codex: { ...cur, felled } })
      },

      grantMarks: (n: number) => set({ watchMarks: get().watchMarks + Math.max(0, Math.round(n)) }),

      grantRunRewards: ({ depth, won, kills, mode = 'campaign', difficulty = 0, ranked = true, daily = null, facts }) => {
        const { watchMarks, stats, topDifficulty, achievements } = get()
        // The scored Daily attempt records its result on the record it claimed
        // at hero-pick — and only that one, and only once.
        const rec = get().daily
        const dailyNext =
          daily && rec && rec.date === daily && !rec.done && mode !== 'endless'
            ? {
                ...rec,
                depth: Math.max(0, num(depth, 0)),
                won,
                kills: Math.max(0, num(kills, 0)),
                score: dailyScore(num(depth, 0), num(kills, 0), won),
                done: true,
              }
            : rec
        const isEndless = mode === 'endless'
        // The step actually played, clamped to what this save has reached, so
        // a hand-edited payload can neither skip steps nor be paid for one.
        const top = clampStep(num(topDifficulty, 0))
        const flown = Math.min(top, clampStep(num(difficulty, 0)))
        // **One multiplier, and you have to earn it**: the difficulty step the
        // run was played at, multiplied by how far the march got.
        const markMult = difficultyRules(flown).markMult
        // Endless is routed through the best difficulty the player has won
        // (Phase 3b) — once the Ten Rounds feat opens it; before that it pays
        // unmultiplied.
        const runMarks = isEndless
          ? endlessMarks(depth, achievements.endless_ten ? stats.bestDifficulty : 0)
          : Math.round((num(depth, 0) * 8 + (won ? 120 : 0)) * markMult)
        // Feats: judged on the facts this run leaves, earned once, each paying
        // its purse on top of the run's marks.
        const feats = facts ? newlyEarned(facts, achievements) : []
        const runsDone = num(stats.runsCompleted, 0) + 1
        const featMarks = feats.reduce((a, f) => a + f.marks, 0)
        const earned = runMarks + featMarks
        lastFeats.ids = feats.map((f) => f.id)

        // ---- SK1: Watch XP, Watch levels, and the cards they unlock -----------
        const xpBefore = Math.max(0, num(get().watchXp, 0))
        const xp = watchXpFor({ mode, depth: num(depth, 0), kills: num(kills, 0), won })
        const levelBefore = watchLevelFor(xpBefore)
        const levelAfter = watchLevelFor(xpBefore + xp)
        const have = get().skills
        const cards = dealCards(have, levelAfter - levelBefore, 'level', runsDone, levelBefore)
        // A WIN at the top step climbs it and pays a card; a win below it pays a
        // card only for a new best score there. Not on a custom seed (shoppable)
        // or a Daily (standard rules, no difficulty step).
        const best = get().difficultyBest
        let win: RunProgress['win'] = null
        let nextTop = top
        let nextBest = best
        if (won && !isEndless && ranked && !daily) {
          const score = winScore(num(depth, 0), num(kills, 0))
          const prev = best[String(flown)]
          const r = winReward({ step: flown, top, score, best: prev })
          if (r.card) cards.push(...dealCards([...have, ...cards], 1, 'win', runsDone, flown))
          if (r.stepUp) nextTop = Math.min(MAX_DIFFICULTY, top + 1)
          if (r.newBest) nextBest = { ...best, [String(flown)]: score }
          win = { step: flown, card: r.card, stepUp: r.stepUp, newBest: r.newBest, score, best: prev ?? null }
        }
        lastProgress.run = { xp, levelBefore, levelAfter, cards, win }

        // Every read is coerced: this is `x + n` arithmetic over a persisted
        // record, and one field arriving as `undefined` from an older save
        // would turn a stat into NaN permanently (M11).
        set({
          watchMarks: num(watchMarks, 0) + earned,
          topDifficulty: nextTop,
          difficultyBest: nextBest,
          watchXp: xpBefore + xp,
          skills: cards.length ? [...have, ...cards] : have,
          daily: dailyNext,
          achievements: feats.length ? { ...achievements, ...Object.fromEntries(feats.map((f) => [f.id, runsDone])) } : achievements,
          stats: {
            // Campaign depth and Endless rounds are different achievements and
            // are recorded as such — an Endless run used to update nothing at
            // all, and folding its round count into `bestDepth` would have made
            // the campaign record a lie instead (M13 / M33).
            bestDepth: isEndless ? num(stats.bestDepth, 0) : Math.max(num(stats.bestDepth, 0), num(depth, 0)),
            bestRound: isEndless ? Math.max(num(stats.bestRound, 0), num(depth, 0)) : num(stats.bestRound, 0),
            bestDifficulty: won && !isEndless ? Math.max(num(stats.bestDifficulty, 0), flown) : num(stats.bestDifficulty, 0),
            totalKills: num(stats.totalKills, 0) + num(kills, 0),
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
          // chosen per run, by step, and climbed by winning (SK1).
          enemyHpMult: 1,
        }
      },

      resetMeta: () =>
        set({ watchMarks: 0, upgrades: {}, topDifficulty: 0, difficultyBest: {}, watchXp: 0, skills: [], stats: freshStats(), daily: null, achievements: {}, codex: freshCodex(), met: [] }),
    }),
    {
      name: 'fieldwatch-meta',
      version: META_VERSION,
      storage: createJSONStorage(() => safePersistStorage),
      partialize: (s) => ({
        watchMarks: s.watchMarks,
        upgrades: s.upgrades,
        topDifficulty: s.topDifficulty,
        difficultyBest: s.difficultyBest,
        watchXp: s.watchXp,
        skills: s.skills,
        stats: s.stats,
        daily: s.daily,
        achievements: s.achievements,
        codex: s.codex,
        met: s.met,
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

// Another tab's marks/perks land here instead of being overwritten by this
// tab's stale copy on its next save (see onStorageKeyChange).
onStorageKeyChange('fieldwatch-meta', () => void useMetaStore.persist.rehydrate())
