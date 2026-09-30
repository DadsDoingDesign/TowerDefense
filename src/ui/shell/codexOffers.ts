/**
 * The Codex (Phase 3b): the Watch's field notes, as a Watchtower page.
 *
 * Five sections — feats, goblins, relics, specializations, perks — each one
 * row with a count on it; opening a row lists what has been seen by name and
 * what has not as a count, plus the feat that opens anything still locked. It
 * reads only the meta save (`achievements`, `codex`), so it is the same on
 * every device the save is on and says nothing a run could not have shown.
 *
 * A new module rather than more of `offers.ts` (being restructured in
 * parallel): `offers.ts` mounts it with one line for the `codex` view.
 */
import { ACHIEVEMENTS, LOCKED_SPECS } from '../../game/data/achievements'
import { ALL_NODES } from '../../game/data/archetypeTree'
import { ENEMY_TYPES } from '../../game/data/enemies'
import { ALL_PERKS } from '../../game/data/perks'
import { RELICS, relicSupported } from '../../game/data/relics'
import type { Codex } from '../../state/metaStore'
import { CORE_IDEAS, IDEAS } from '../../state/staging'
import { GLOSSARY } from '../channels'
import type { Body, Offer } from './offers'

export interface CodexView {
  achievements: Record<string, number>
  codex: Codex
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
      ...shown.map((id) => `${GLOSSARY[id].term} — ${GLOSSARY[id].line}`),
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

  const specNodes = ALL_NODES.filter((n) => n.tier > 0)
  const seenSpecs = specNodes.filter((n) => v.codex.specs.includes(n.id))
  const specs: Offer = {
    id: 'codex-specs',
    title: 'Specializations',
    sub: `${seenSpecs.length}/${specNodes.length}`,
    icon: 'evolve',
    body: [
      ...seenBody(seenSpecs.map((n) => n.name), specNodes.length, 'lines'),
      ...Object.entries(LOCKED_SPECS)
        .filter(([, feat]) => !v.achievements[feat])
        .map(([id, feat]) => `Locked: ${ALL_NODES.find((n) => n.id === id)?.name ?? id} — earn ${featName(feat)}.`),
    ],
  }

  const takenPerks = ALL_PERKS.filter((p) => v.codex.perks.includes(p.id))
  const lockedPerks = ALL_PERKS.filter((p) => p.unlock && !v.achievements[p.unlock])
  const perks: Offer = {
    id: 'codex-perks',
    title: 'Perks',
    sub: `${takenPerks.length}/${ALL_PERKS.length}`,
    icon: 'boon',
    body: [
      ...seenBody(takenPerks.map((p) => p.name), ALL_PERKS.length, 'perks'),
      ...(lockedPerks.length ? [`${lockedPerks.length} perk options locked — earn ${[...new Set(lockedPerks.map((p) => featName(p.unlock!)))].join(', ')}.`] : []),
    ],
  }

  return [glossaryOffer(v), feats, goblins, relics, specs, perks]
}
