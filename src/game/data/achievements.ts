import type { HeroStyle } from './items'

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
 * A feat is a thing you did — win with each kind of first hero, reach act 3 without
 * hiring, clear an act boss without a scratch on the Gate — and it opens a new
 * way to play: a skill card, a relic, a Watchtower service.
 * Nothing here is a bigger number. Each also pays a one-off purse of gold
 * into the bank, so the ledger rewards range as well as depth.
 *
 * `check` reads the facts a settled run leaves behind (`RunFacts`) and the
 * record the Watchtower already keeps; it is pure, and `metaStore` calls it
 * once per settle.
 */
export interface RunFacts {
  /** The contract was delivered. */
  won: boolean
  /** What the first hero fought with as the march began — its weapon's style (campaign). */
  starter: HeroStyle | null
  /** Heroes the company hired over the run (hub extras do not count). */
  hires: number
  /** The most heroes fielded in one wave. */
  maxFielded: number
  /** The deepest act the run reached (1–3). */
  act: number
  /** Act bosses cleared with no cargo lost in that fight. */
  flawlessBosses: number
  /** Act bosses cleared at all. */
  actBosses: number
  /** A mutated hero was on the roster when the run ended. */
  mutated: boolean
  /** The most gold held at once. */
  goldPeak: number
  /** Crates the contract carried (its stake). */
  crates: number
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
  /** One-off gold for earning it, paid into the bank. */
  gold: number
  check: (f: RunFacts) => boolean
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'act_two', name: 'Into the Second Act', feat: 'Defeat an act boss.', opens: "Relic: Veteran's Cloak · Watchtower: Field Kitchen", gold: 40, check: (f) => f.actBosses >= 1 },
  { id: 'first_light', name: 'First Light', feat: 'Deliver a contract.', opens: 'Watchtower: Relic Cartulary', gold: 120, check: (f) => f.won },
  // The ids keep their class-era names: saves hold them. The feat is what the
  // first hero HELD (its weapon) when the march began — there are no classes.
  { id: 'win_fighter', name: 'Hold the Line', feat: 'Win with a first hero who swings a sword, axe or hammer.', opens: 'Skill card: Warden of Ash (Level 3)', gold: 80, check: (f) => f.won && f.starter === 'swing' },
  { id: 'win_rogue', name: 'Nothing Wasted', feat: 'Win with a first hero who shoots a bow or throws daggers.', opens: 'Skill card: Hexblade (Level 3)', gold: 80, check: (f) => f.won && f.starter === 'shoot' },
  { id: 'win_mystic', name: 'The Long Watch', feat: 'Win with a first hero who casts magic.', opens: 'Skill card: Stormcaller (Level 3)', gold: 80, check: (f) => f.won && f.starter === 'cast' },
  { id: 'lone_wolf', name: 'Lone Wolf', feat: 'Reach act 3 without hiring a single hero.', opens: 'Skill card: Riposte (Level 1)', gold: 100, check: (f) => f.act >= 3 && f.hires === 0 },
  { id: 'full_company', name: 'Full Company', feat: 'Field five heroes in one wave.', opens: 'Relic: Mercenary Charter', gold: 40, check: (f) => f.maxFielded >= 5 },
  { id: 'flawless_boss', name: 'Not a Scratch', feat: 'Beat an act boss without losing any cargo.', opens: 'Nothing — a feat for its own sake', gold: 60, check: (f) => f.flawlessBosses >= 1 },
  { id: 'mutant', name: 'Strange Growth', feat: 'Win with a mutated hero among your heroes.', opens: 'The Crossroads offers one more mutation', gold: 60, check: (f) => f.won && f.mutated },
  { id: 'hoard', name: 'Hoard', feat: 'Hold 300 gold at once.', opens: 'Nothing — a feat for its own sake', gold: 30, check: (f) => f.goldPeak >= 300 },
  // The ids keep their old names: saves hold them. The feat moved from the
  // Vow to the difficulty step (SK1), and from the step to the stake (the
  // mercenary company). The Endless and Daily feats went with their modes.
  { id: 'vow_one', name: 'Sworn', feat: 'Deliver a contract carrying 1 crate or more.', opens: 'Nothing — a feat for its own sake', gold: 100, check: (f) => f.won && f.crates >= 1 },
  { id: 'vow_three', name: 'Blood Price Paid', feat: 'Deliver a contract carrying 3 crates or more.', opens: 'Nothing — the record is the reward', gold: 250, check: (f) => f.won && f.crates >= 3 },
  { id: 'field_notes', name: 'Field Notes', feat: 'See 15 kinds of goblin.', opens: 'Nothing — the Codex is its own reward', gold: 50, check: (f) => f.goblinsSeen >= 15 },
]

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]))
export const achievementById = (id: string): Achievement | undefined => BY_ID.get(id)

/** The feats a settled run earns that the record does not already hold. */
export function newlyEarned(facts: RunFacts, held: Readonly<Record<string, unknown>>): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !held[a.id] && a.check(facts))
}
