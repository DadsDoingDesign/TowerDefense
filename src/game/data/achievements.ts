import type { Archetype } from '../types'

/**
 * ---------------------------------------------------------------------------
 * Feats — horizontal unlocks earned by PLAYING, not bought (Phase 3b)
 * ---------------------------------------------------------------------------
 *
 * The review's meta finding: the Watchtower was 100% bought with marks and
 * fully bought in about a dozen runs, the Vow ladder had three rungs, and there
 * were no content unlocks and no achievements at all — nothing to do on run
 * forty that you had not done on run twelve.
 *
 * A feat is a thing you did — win with each starter, reach act 3 without
 * hiring, clear an act boss without a scratch on the Gate — and it opens a new
 * way to play: a skill card, a relic, a Watchtower service.
 * Nothing here is a bigger number. Each also pays a one-off purse of Watch
 * Marks, so the ledger rewards range as well as depth.
 *
 * `check` reads the facts a settled run leaves behind (`RunFacts`) and the
 * record the Watchtower already keeps; it is pure, and `metaStore` calls it
 * once per settle.
 */
export interface RunFacts {
  mode: 'campaign' | 'endless'
  won: boolean
  /** The first hero's archetype (campaign). */
  starter: Archetype | null
  /** Heroes the company hired over the run (hub extras do not count). */
  hires: number
  /** The most heroes fielded in one wave. */
  maxFielded: number
  /** The deepest act the run reached (1–3). */
  act: number
  /** Act bosses cleared with no Gate HP lost in that fight. */
  flawlessBosses: number
  /** Act bosses cleared at all. */
  actBosses: number
  /** A mutated hero was on the roster when the run ended. */
  mutated: boolean
  /** The most gold held at once. */
  goldPeak: number
  /** The difficulty step played (campaign). */
  difficulty: number
  /** Endless rounds survived. */
  rounds: number
  /** A scored Daily Watch that this settle closes. */
  daily: boolean
  /** Distinct goblin kinds in the Codex after this run. */
  goblinsSeen: number
}

export interface Achievement {
  id: string
  name: string
  /** The feat, in the player's words. */
  feat: string
  /** What it opens — shown on the Codex and wherever the locked thing is. */
  opens: string
  /** One-off Watch Marks for earning it. */
  marks: number
  check: (f: RunFacts) => boolean
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'act_two', name: 'Into the Second Act', feat: 'Defeat an act boss.', opens: "Relic: Veteran's Cloak · Watchtower: Field Kitchen", marks: 40, check: (f) => f.actBosses >= 1 },
  { id: 'first_light', name: 'First Light', feat: 'Win a campaign.', opens: 'Watchtower: Relic Cartulary', marks: 120, check: (f) => f.mode === 'campaign' && f.won },
  { id: 'win_fighter', name: 'Hold the Line', feat: 'Win with a Fighter as your first hero.', opens: 'Skill card: Warden of Ash (Level 3, Fighter)', marks: 80, check: (f) => f.won && f.starter === 'fighter' },
  { id: 'win_rogue', name: 'Nothing Wasted', feat: 'Win with a Rogue as your first hero.', opens: 'Skill card: Hexblade (Level 3, Rogue)', marks: 80, check: (f) => f.won && f.starter === 'rogue' },
  { id: 'win_mystic', name: 'The Long Watch', feat: 'Win with a Mystic as your first hero.', opens: 'Skill card: Stormcaller (Level 3, Mystic)', marks: 80, check: (f) => f.won && f.starter === 'mystic' },
  { id: 'lone_wolf', name: 'Lone Wolf', feat: 'Reach act 3 without hiring a single hero.', opens: 'Skill card: Riposte (Level 1, Fighter)', marks: 100, check: (f) => f.mode === 'campaign' && f.act >= 3 && f.hires === 0 },
  { id: 'full_company', name: 'Full Company', feat: 'Field five heroes in one wave.', opens: 'Relic: Mercenary Charter', marks: 40, check: (f) => f.maxFielded >= 5 },
  { id: 'flawless_boss', name: 'Not a Scratch', feat: 'Beat an act boss without the Gate losing any HP.', opens: 'Nothing — a feat for its own sake', marks: 60, check: (f) => f.flawlessBosses >= 1 },
  { id: 'mutant', name: 'Strange Growth', feat: 'Win with a mutated hero among your heroes.', opens: 'The Crossroads offers one more mutation', marks: 60, check: (f) => f.won && f.mutated },
  { id: 'hoard', name: 'Hoard', feat: 'Hold 300 gold at once.', opens: 'Nothing — a feat for its own sake', marks: 30, check: (f) => f.goldPeak >= 300 },
  // The ids keep their Vow-era names: saves hold them (SK1 moved the feat onto the difficulty step).
  { id: 'vow_one', name: 'Sworn', feat: 'Win at difficulty 1 or higher.', opens: 'Nothing new — winning climbs the difficulty on its own', marks: 100, check: (f) => f.won && f.difficulty >= 1 },
  { id: 'vow_three', name: 'Blood Price Paid', feat: 'Win at difficulty 3 or higher.', opens: 'Nothing new — the record is the reward', marks: 250, check: (f) => f.won && f.difficulty >= 3 },
  { id: 'endless_ten', name: 'Ten Rounds', feat: 'Survive 10 rounds of the Endless Watch.', opens: 'Endless payouts count toward the best difficulty you have won', marks: 60, check: (f) => f.mode === 'endless' && f.rounds >= 10 },
  { id: 'daily_done', name: 'On Watch', feat: 'Finish a scored Daily Watch.', opens: 'Nothing — a feat for its own sake', marks: 30, check: (f) => f.daily },
  { id: 'field_notes', name: 'Field Notes', feat: 'See 15 kinds of goblin.', opens: 'Nothing — the Codex is its own reward', marks: 50, check: (f) => f.goblinsSeen >= 15 },
]

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]))
export const achievementById = (id: string): Achievement | undefined => BY_ID.get(id)

/** The feats a settled run earns that the record does not already hold. */
export function newlyEarned(facts: RunFacts, held: Readonly<Record<string, unknown>>): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !held[a.id] && a.check(facts))
}
