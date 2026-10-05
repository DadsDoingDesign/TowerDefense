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
import { ARCHETYPES } from '../../game/data/sentinels'
import { skillPoolFor, watchProgress } from '../../game/run/watch'
import type { Codex } from '../../state/metaStore'
import { CORE_IDEAS, IDEAS } from '../../state/staging'
import { GLOSSARY } from '../channels'
import type { Body, Offer } from './offers'

export interface CodexView {
  achievements: Record<string, number>
  codex: Codex
  /** SK1: the skill cards unlocked by Watch levels and wins, and lifetime Watch XP. */
  skills?: readonly string[]
  watchXp?: number
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
    icon: 'marks',
    pips: { on: earned.length, of: ACHIEVEMENTS.length },
    // Every feat is listed, earned or not: a feat is a goal, and a goal you
    // cannot read is not one. What it opens is on the line too.
    body: ACHIEVEMENTS.map((a) => `${v.achievements[a.id] ? '✓' : '○'} ${a.name} — ${a.feat} Opens: ${a.opens}. (${a.marks} Marks)`),
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

/** LS3: the library opens after the first run, said the same way as the Daily's. */
const LIBRARY_LOCKED = 'Opens after your first run'

/**
 * The skill library (SK1): every skill card, by level — the ones this Watch
 * has, named with their one sentence; the rest as silhouettes that say only
 * how they open ("Unlocks at random as your Watch level rises", or the feat). The Watch level and how
 * far it is to the next card lead.
 */
export function skillLibraryOffer(v: Pick<CodexView, 'achievements' | 'skills' | 'watchXp' | 'staged'>): Offer {
  const pool = new Set(skillPoolFor(v.skills ?? [], (id) => !!v.achievements[id]))
  const have = ALL_SKILLS.filter((k) => pool.has(k.id)).length
  if (v.staged) {
    return {
      id: 'codex-skills',
      title: 'Skill library',
      sub: 'Locked',
      icon: 'boon',
      dim: true,
      note: LIBRARY_LOCKED,
      body: [`${LIBRARY_LOCKED}: every skill your heroes can be offered, and how to unlock the rest.`],
    }
  }
  const w = watchProgress(v.watchXp ?? 0)
  return {
    id: 'codex-skills',
    title: 'Skill library',
    sub: `${have}/${ALL_SKILLS.length}`,
    icon: 'boon',
    body: [
      `Watch level ${w.level} — ${w.into}/${w.need} Watch XP to the next. Every Watch level unlocks one skill card.`,
      'Every run earns Watch XP: 15 a depth, 1 per 10 enemies felled, 60 for a win. A win at your highest difficulty unlocks a card too.',
      'Your heroes are offered skills only from the cards you have.',
    ],
    cards: ALL_SKILLS.map((k) => {
      const group = skillLevelLabel(k.level)
      if (pool.has(k.id)) {
        return { id: k.id, group, name: k.name, sub: k.class ? ARCHETYPES[k.class].name : 'Any hero', text: k.desc }
      }
      const feat = k.feat ? ACHIEVEMENTS.find((a) => a.id === k.feat) : undefined
      return {
        id: k.id,
        group,
        name: 'Locked',
        sub: k.class ? ARCHETYPES[k.class].name : 'Any hero',
        text: feat ? `Opens with the feat ${feat.name}: ${feat.feat.replace(/\.$/, '').toLowerCase()}.` : 'Unlocks at random as your Watch level rises.',
        locked: true,
      }
    }),
  }
}
