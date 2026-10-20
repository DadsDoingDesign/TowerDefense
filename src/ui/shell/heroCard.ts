import { canUpgrade, HERO_SLOT_LABEL, RARITY, raiseAdds, raisedBase, upgradeCost } from '../../game/data/items'
import { computeCombat, type CombatProfile } from '../../game/engine/combat'
import { MAX_LEVEL } from '../../game/engine/leveling'
import { MAX_SKILLS, nextMilestone, pendingMilestone, SKILL_MILESTONES, type Milestone } from '../../game/run/skills'
import { mergedById, skillById, type MergedSkill, type Skill } from '../../game/data/skills'
import { buildsInto } from '../../game/run/fusion'
import type { HeroSlot, Item, Sentinel } from '../../game/types'
import type { IconKey } from '../channels'
import { gearDeltas, type GearDelta } from './gearPlan'

/**
 * The battle band's hero card and Upgrade panel, as data (Oct 2026; the
 * designer: "the current player details is unusable and unstructured …
 * reconsider a better way to show stats and skills and how to upgrade").
 *
 * Pure — no store, no React — so the card's fields, the skill slots and what
 * an upgrade costs and changes are tested in `tests/heroCard.test.ts`, and
 * the components only lay them out.
 */

/** One key fact on the card: a `.field-k` label over its `.field-v` value. */
export interface CardField {
  key: 'reach' | 'targets' | 'damage' | 'speed'
  label: string
  value: string
  /** The value's mark, where it has one (the damage type). */
  icon?: IconKey
  /** The whole fact in words, for its accessible name. */
  words: string
}

/** How many enemies one attack reaches, in a word or two ("1", "Area", "1+2 pierce"). */
export function targetsValue(p: Pick<CombatProfile, 'splashRadius' | 'mods'>): { value: string; words: string } {
  if (p.splashRadius > 0) return { value: 'Area', words: 'everything in a small area' }
  const pierce = p.mods.pierce ?? 0
  if (pierce > 0) return { value: `1+${pierce} pierce`, words: `one, and pierces ${pierce} more` }
  const chains = p.mods.shock?.chains ?? 0
  if (chains > 0) return { value: `1+${chains} chain`, words: `one, and chains to ${chains} more` }
  return { value: '1', words: 'one at a time' }
}

/** The card's four key facts, in a fixed order — the same boxes for every hero. */
export function cardFields(p: CombatProfile): CardField[] {
  const t = targetsValue(p)
  const magic = p.damageType === 'magic'
  const rate = p.rate.toFixed(1)
  const reach = String(Math.round(p.range))
  return [
    { key: 'reach', label: 'Reach', value: reach, words: `Reach ${reach}` },
    { key: 'targets', label: 'Targets', value: t.value, words: `Targets: ${t.words}` },
    { key: 'damage', label: 'Damage', value: magic ? 'Magic' : 'Physical', icon: magic ? 'magic' : 'phys', words: `${magic ? 'Magic' : 'Physical'} damage` },
    { key: 'speed', label: 'Speed', value: `${rate}/s`, words: `${rate} attacks a second` },
  ]
}

/** The XP bar's words: "Level 6 of 20 · 40% to 7". */
export function levelWords(level: number, progress: number): string {
  if (level >= MAX_LEVEL) return `Level ${level}, the top level`
  return `Level ${level} of ${MAX_LEVEL}, ${Math.round(progress * 100)}% of the way to ${level + 1}`
}

/**
 * One of the card's skill slots. A hero holds up to three skills (SK1), one
 * per milestone; a slot is a skill it holds, the milestone's choice it is owed
 * now, or the level the next one opens at.
 */
export type SkillSlot =
  | {
      kind: 'held'
      skill: Skill
      level: number
      /** A merged skill: its record, with its slot's skills' names, base first. */
      fused?: { skill: MergedSkill; parts: readonly string[] }
      /** The named merges this held skill builds into as the base, each with the card it needs. */
      builds?: readonly { name: string; needs: string }[]
    }
  | { kind: 'owed'; milestone: Milestone }
  /** An empty slot, and the hero level the next choice comes at (null: no choice left). */
  | { kind: 'later'; level: number | null }

/**
 * Always three slots (`MAX_SKILLS`), the same boxes for every hero: the skills
 * it holds, then the choice it is owed (when a slot is free for it — with all
 * three held, the choice is a merge and the Upgrade button's badge says so),
 * then empty slots marked with the level the next choices come at. A hero that
 * took a stat boost at a milestone settled it without a skill, so the levels
 * come from the milestones left, not from the slot count.
 */
export function skillSlots(hero: Pick<Sentinel, 'level' | 'skills' | 'skillPicks'>): SkillSlot[] {
  const held = (hero.skills ?? []).map((id) => skillById(id)).filter((k): k is Skill => !!k)
  const slots: SkillSlot[] = held.slice(0, MAX_SKILLS).map((skill) => {
    const f = mergedById(skill.id)
    const fused = f ? { skill: f, parts: f.chain.map((id) => skillById(id)?.name ?? id) } : undefined
    const builds = buildsInto(skill.id).map((r) => ({ name: r.name, needs: skillById(r.parts[1])?.name ?? r.parts[1] }))
    return { kind: 'held', skill, level: skill.level, ...(fused ? { fused } : {}), ...(builds.length ? { builds } : {}) }
  })
  const owed = pendingMilestone(hero)
  if (owed && slots.length < MAX_SKILLS) slots.push({ kind: 'owed', milestone: owed })
  const next = nextMilestone(hero)
  const ahead = next ? SKILL_MILESTONES.filter((lv) => lv >= next.level && lv !== owed?.level) : []
  let i = 0
  while (slots.length < MAX_SKILLS) slots.push({ kind: 'later', level: ahead[i++] ?? null })
  return slots
}

/* ------------------------------------------------------------- upgrades */

/** The doll's reading order — body, then off hand, then main hand (`GearColumn`). */
export const DOLL_ORDER: readonly HeroSlot[] = ['body', 'offHand', 'mainHand']

/** The hero's skill choice, owed now: free, and the biggest change a hero makes. */
export interface SkillUpgrade {
  kind: 'skill'
  id: 'skill'
  milestone: Milestone
}

/**
 * Raising one worn piece one rarity tier, for gold (`items.upgradeRarity`,
 * the store's `upgradeItem`). The preview is the certain half — the new tier
 * and the scaled base (`items.raisedBase`) — and how many enchantments the
 * raise will roll; the roll itself is never previewed.
 */
export interface RaiseUpgrade {
  kind: 'raise'
  id: string
  slot: HeroSlot
  slotLabel: string
  item: Item
  from: string
  to: string
  cost: number
  /** The purse covers it. */
  afford: boolean
  /** Gold still needed when it does not. */
  short: number
  /** What moves on the hero, DPS first (the certain half only). */
  deltas: GearDelta[]
  /** Enchantments the raise rolls. */
  adds: number
}

export type HeroUpgrade = SkillUpgrade | RaiseUpgrade

/**
 * Everything the hero can spend on right now, skill choice first, then its
 * worn pieces in the doll's reading order. A piece at the top tier is not
 * listed (there is nothing to raise it to).
 */
export function heroUpgrades(hero: Sentinel, gold: number): HeroUpgrade[] {
  const out: HeroUpgrade[] = []
  const m = pendingMilestone(hero)
  if (m) out.push({ kind: 'skill', id: 'skill', milestone: m })
  for (const slot of DOLL_ORDER) {
    const item = hero.equipment[slot]
    if (!item || !canUpgrade(item)) continue
    const cost = upgradeCost(item)
    const raised = raisedBase(item)
    const after: Sentinel = { ...hero, equipment: { ...hero.equipment, [slot]: raised } }
    out.push({
      kind: 'raise',
      id: `raise:${item.id}`,
      slot,
      slotLabel: HERO_SLOT_LABEL[slot],
      item,
      from: RARITY[item.rarity].label,
      to: RARITY[raised.rarity].label,
      cost,
      afford: gold >= cost,
      short: Math.max(0, cost - gold),
      deltas: gearDeltas(hero, after),
      adds: raiseAdds(item),
    })
  }
  return out
}

/**
 * Whether the action bar shows the hero's Upgrade button: there is something
 * to spend — a skill choice owed, or a worn piece the purse can raise.
 */
export function canSpend(ups: readonly HeroUpgrade[]): boolean {
  return ups.some((u) => u.kind === 'skill' || u.afford)
}

/** The badge on the Upgrade button: a choice is WAITING (a skill, which costs nothing). */
export function upgradeWaiting(ups: readonly HeroUpgrade[]): boolean {
  return ups.some((u) => u.kind === 'skill')
}

/** The Upgrade button's accessible name: who, and what is waiting. */
export function upgradeButtonName(heroName: string, ups: readonly HeroUpgrade[]): string {
  const raises = ups.filter((u) => u.kind === 'raise' && u.afford).length
  const parts: string[] = []
  if (upgradeWaiting(ups)) parts.push('a skill to choose')
  if (raises) parts.push(`${raises} piece${raises === 1 ? '' : 's'} to raise`)
  return `Upgrade ${heroName}${parts.length ? ` — ${parts.join(', ')}` : ''}`
}

/** The hero's profile, for the card head (re-exported so the card reads one module). */
export const profileOf = (hero: Sentinel): CombatProfile => computeCombat(hero)

/** How many heroes stand on the field in setup (the preview says "Post a hero" until one does). */
export const placementsCount = (s: { roster: readonly { id: string }[]; placements: Record<string, string | null> }): number => {
  const posted = new Set(Object.values(s.placements))
  return s.roster.filter((h) => posted.has(h.id)).length
}
