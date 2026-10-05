/**
 * The Codex (Phase 3b): the Watch's field notes, as a Watchtower page.
 *
 * Sections — the glossary, the skill library (SK1), feats, goblins, relics —
 * each one row with a count on it; opening a row lists what has been seen by
 * name and what has not as a count, plus the feat that opens anything still
 * locked. It reads only the meta save, so it is the same on every device the
 * save is on and says nothing a run could not have shown.
 *
 * A new module rather than more of `offers.ts` (being restructured in
 * parallel): `offers.ts` mounts it with one line for the `codex` view.
 */
import { ACHIEVEMENTS } from '../../game/data/achievements'
import { ENEMY_TYPES } from '../../game/data/enemies'
import { RELICS, relicSupported } from '../../game/data/relics'
import { ALL_SKILLS, skillLevelLabel } from '../../game/data/skills'
import { ITEM_KINDS, itemPoolFor, SOVEREIGN_LEVEL } from '../../game/data/itemKinds'
import { SOVEREIGN_TIER } from '../../game/run/charter'
import { skillPoolFor } from '../../game/run/watch'
import { COMPANIES, type CompanyId } from '../../game/data/companies'
import { standingProgress } from '../../game/run/standing'
import type { Codex } from '../../state/metaStore'
import { CORE_IDEAS, IDEAS } from '../../state/staging'
import { GLOSSARY } from '../channels'
import type { Body, Offer } from './offers'

export interface CodexView {
  achievements: Record<string, number>
  codex: Codex
  /** The skill cards unlocked by standing levels and deliveries. */
  skills?: readonly string[]
  /** The item kinds unlocked by deliveries. */
  items?: readonly string[]
  /** The Sovereign kinds owned (the endgame charter). */
  sovereign?: readonly string[]
  /** Standing XP per company (the mercenary company). */
  standing?: Readonly<Partial<Record<CompanyId, number>>>
  /** LS3: the ideas the player has met. */
  met?: readonly string[]
  /** LS3: a first-timer's Codex lists only what they have met. */
  staged?: boolean
}

/**
 * The glossary (LS3/LS4): one line per idea, in the game's one name for it —
 * every idea for a returning player, only the ones met so far for a first-timer
 * (the rest are a count, never a spoiler).
 */
export function glossaryOffer(v: Pick<CodexView, 'met' | 'staged'>): Offer {
  const met = new Set<string>([...CORE_IDEAS, ...(v.met ?? [])])
  const shown = v.staged ? IDEAS.filter((id) => met.has(id)) : [...IDEAS]
  const waiting = IDEAS.length - shown.length
  return {
    id: 'codex-glossary',
    title: 'Glossary',
    sub: v.staged ? `${shown.length}/${IDEAS.length}` : `${IDEAS.length} terms`,
    icon: 'tips',
    body: [
      ...shown.flatMap((id) => [GLOSSARY[id], ...(GLOSSARY[id].also ?? [])].map((g) => `${g.term} — ${g.line}`)),
      ...(waiting > 0 ? [`${waiting} more to meet on the road.`] : []),
    ],
  }
}

const featName = (id: string): string => ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id

/** "Seen: a, b, c." with the unseen as a count — never a list of spoilers. */
function seenBody(seen: string[], total: number, noun: string): Body {
  const out: Body = [`${seen.length} of ${total} ${noun} recorded.`]
  if (seen.length > 0) out.push(seen.join(' · '))
  if (seen.length < total) out.push(`${total - seen.length} still unseen.`)
  return out
}

export function codexOffers(v: CodexView): Offer[] {
  const earned = ACHIEVEMENTS.filter((a) => v.achievements[a.id])
  const feats: Offer = {
    id: 'codex-feats',
    title: 'Feats',
    sub: `${earned.length}/${ACHIEVEMENTS.length}`,
    icon: 'crown',
    pips: { on: earned.length, of: ACHIEVEMENTS.length },
    // Every feat is listed, earned or not: a feat is a goal, and a goal you
    // cannot read is not one. What it opens is on the line too.
    body: ACHIEVEMENTS.map((a) => `${v.achievements[a.id] ? '✓' : '○'} ${a.name} — ${a.feat}${a.opens ? ` Opens: ${a.opens}.` : ''} (${a.gold} gold)`),
  }

  // Goblins by kind: the Codex records modded ids (a Warded Bomber is its own
  // sighting); the page groups them under the goblin they are a variant of.
  // Keyed by id: a modded entry is keyed `torch1_plated` but carries its base's `id`.
  const kinds = Object.entries(ENEMY_TYPES).filter(([key]) => !key.includes('_')).map(([key, k]) => ({ id: key, name: k.name }))
  const seenKinds = new Set(v.codex.enemies.map((id) => id.split('_')[0]))
  const goblins: Offer = {
    id: 'codex-goblins',
    title: 'Goblins',
    sub: `${kinds.filter((k) => seenKinds.has(k.id)).length}/${kinds.length}`,
    icon: 'wave',
    body: seenBody(kinds.filter((k) => seenKinds.has(k.id)).map((k) => k.name), kinds.length, 'kinds'),
  }

  // Only relics this build can actually deal count toward the total.
  const pool = RELICS.filter(relicSupported)
  const heldRelics = pool.filter((r) => v.codex.relics.includes(r.id))
  const lockedRelics = pool.filter((r) => r.unlock && !v.achievements[r.unlock])
  const relics: Offer = {
    id: 'codex-relics',
    title: 'Relics',
    sub: `${heldRelics.length}/${pool.length}`,
    icon: 'relic',
    body: [
      ...seenBody(heldRelics.map((r) => r.name), pool.length, 'relics'),
      ...lockedRelics.map((r) => `Locked: ${r.name} — earn ${featName(r.unlock!)}.`),
    ],
  }

  return [glossaryOffer(v), skillLibraryOffer(v), feats, goblins, relics]
}

/** LS3: the collection opens after the first run, said the same way as the Daily's. */
const LIBRARY_LOCKED = 'Opens after your first run'
/** What a silhouette says: the designer's words, and how. */
export const UNLOCK_BY_PLAYING = 'Unlock by playing — at random, as your standing with a company rises, or by delivering a contract.'
/** What a Sovereign silhouette says: the one way it opens. */
export const UNLOCK_BY_CHARTER = 'Unlock by delivering a Sovereign Route — one Sovereign item each time.'

const SLOT_GROUP: Record<string, string> = { oneHand: 'Weapons', twoHand: 'Weapons', offHand: 'Off hand', body: 'Body' }

/**
 * The Collection (the classless rework; was SK1's skill library): two tabs,
 * Skills and Items. What this Watch has is named with its one sentence; the
 * rest are silhouettes that say only how they open. A hero is rolled from
 * these — its gear from the item kinds, its skill from the skill cards — so
 * the more a player unlocks, the more kinds of hero and loot a run can deal.
 * Each card says only what IT does (the designer: "dont say how it will mix").
 */
export function skillLibraryOffer(v: Pick<CodexView, 'achievements' | 'skills' | 'items' | 'sovereign' | 'standing' | 'staged'>): Offer {
  const pool = new Set(skillPoolFor(v.skills ?? [], (id) => !!v.achievements[id]))
  const have = ALL_SKILLS.filter((k) => pool.has(k.id)).length
  const kinds = new Set(itemPoolFor([...(v.items ?? []), ...(v.sovereign ?? [])]))
  const haveItems = ITEM_KINDS.filter((k) => kinds.has(k.id)).length
  if (v.staged) {
    return {
      id: 'codex-skills',
      title: 'Collection',
      sub: 'Locked',
      icon: 'boon',
      dim: true,
      note: LIBRARY_LOCKED,
      body: [`${LIBRARY_LOCKED}: every skill and item your heroes can be dealt, and how to unlock the rest.`],
    }
  }
  const skillCards = ALL_SKILLS.map((k) => {
    const group = skillLevelLabel(k.level)
    if (pool.has(k.id)) return { id: k.id, group, name: k.name, sub: k.starter ? 'Starter' : 'Unlocked', text: k.desc }
    const feat = k.feat ? ACHIEVEMENTS.find((a) => a.id === k.feat) : undefined
    return {
      id: k.id,
      group,
      name: 'Locked',
      sub: '',
      text: feat ? `Opens with the feat ${feat.name}: ${feat.feat.replace(/\.$/, '').toLowerCase()}.` : UNLOCK_BY_PLAYING,
      locked: true,
    }
  })
  const itemCards = ITEM_KINDS.map((k) => {
    // The Sovereign tier (Level 4) is its own group, in its cyan, last.
    if (k.level === SOVEREIGN_LEVEL) {
      const tier = 'sovereign' as const
      if (kinds.has(k.id)) return { id: `kind-${k.id}`, group: SOVEREIGN_TIER, name: k.id, sub: 'Yours', text: k.does, tier }
      return { id: `kind-${k.id}`, group: SOVEREIGN_TIER, name: 'Locked', sub: '', text: UNLOCK_BY_CHARTER, locked: true, tier }
    }
    const group = SLOT_GROUP[k.slot]
    if (kinds.has(k.id)) return { id: `kind-${k.id}`, group, name: k.id, sub: k.basic ? 'Basic' : 'Unlocked', text: k.does }
    return { id: `kind-${k.id}`, group, name: 'Locked', sub: '', text: UNLOCK_BY_PLAYING, locked: true }
  })
  return {
    id: 'codex-skills',
    title: 'Collection',
    sub: `${have + haveItems}/${ALL_SKILLS.length + ITEM_KINDS.length}`,
    icon: 'boon',
    body: [
      ...COMPANIES.map((c) => {
        const p = standingProgress(v.standing?.[c.id] ?? 0)
        return p.max ? `${c.name}: Standing ${p.standing}, the highest.` : `${c.name}: Standing ${p.standing} — ${p.into}/${p.need} to the next.`
      }),
      'A contract earns standing with its company: 15 a depth, 1 per 10 enemies felled, 60 for a delivery. Each standing level unlocks a skill, from that company’s cards first.',
      'Delivering a contract unlocks a skill and an item, plus a skill per milestone crate and an item per two crates staked.',
      'Sovereign items, the top tier, unlock only by delivering a Sovereign Route.',
      'Your heroes, loot and offers are dealt only from what you have.',
    ],
    tabs: [
      { id: 'skills', label: 'Skills', count: `${have}/${ALL_SKILLS.length}`, cards: skillCards },
      { id: 'items', label: 'Items', count: `${haveItems}/${ITEM_KINDS.length}`, cards: itemCards },
    ],
  }
}
