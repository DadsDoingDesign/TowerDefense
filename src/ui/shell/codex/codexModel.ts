/**
 * The Codex as a collection (October 2026; the designer: "make the codex a
 * neat icon grid of items and skills and so on", after Supercell's collection
 * screens). Pure: the meta save in, five tabs of tiles out — what the screen
 * (`CodexScreen.tsx`) draws and what `tests/codex.test.ts` holds.
 *
 * Every tab is sections of tiles. A tile is a picture, a short badge (its
 * level, tier or rarity), its name, and one hue; a locked one is a silhouette
 * named "???" that says only how it opens — never a spoiler. Tapping a tile
 * opens its card: the same picture large, chips, what it does, how it is had.
 * Feats are the one list: each is a goal with a sentence and a reward, which
 * a tile cannot hold.
 */
import { ACHIEVEMENTS } from '../../../game/data/achievements'
import { ENEMY_TYPES } from '../../../game/data/enemies'
import { knowledgeOf } from '../../../game/data/enemyKnowledge'
import { RELICS, relicSupported } from '../../../game/data/relics'
import { ALL_SKILLS, skillHeadline } from '../../../game/data/skills'
import { ITEM_KINDS, itemPoolFor, SOVEREIGN_LEVEL } from '../../../game/data/itemKinds'
import { itemIcon, type IconKey } from '../../../game/data/iconAtlas'
import { companyById, type CompanyId } from '../../../game/data/companies'
import { SOVEREIGN_COLOR } from '../../../game/run/charter'
import { skillPoolFor } from '../../../game/run/watch'
import type { ItemRarity, ItemSlot } from '../../../game/types'
import type { Codex } from '../../../state/metaStore'
import { CORE_IDEAS, IDEAS } from '../../../state/staging'
import { GLOSSARY } from '../../channels'
import { enemyCardData } from '../enemyFacts'

export interface CodexView {
  achievements: Record<string, number>
  codex: Codex
  /** The skill cards unlocked by standing levels and deliveries. */
  skills?: readonly string[]
  /** The item kinds unlocked by deliveries. */
  items?: readonly string[]
  /** The Sovereign kinds owned (the endgame charter). */
  sovereign?: readonly string[]
  /** LS3: the ideas the player has met. */
  met?: readonly string[]
  /** LS3: a first-timer's Codex holds back the collection and lists only the ideas met. */
  staged?: boolean
}

export type CodexTabId = 'items' | 'skills' | 'goblins' | 'relics' | 'feats'

/** One tile, and everything its card says. */
export interface CodexEntry {
  id: string
  name: string
  locked: boolean
  /** The tile's corner badge: "1"–"3", "S", "T2", "★". Empty when locked. */
  badge: string
  /** The frame's hue: the level's, the tier's, the rarity's. */
  hue: string
  /** The picture: an atlas icon, or a goblin's sprite key. */
  icon?: IconKey
  enemy?: string
  /** The company whose road deals it more often (its logo rides in the tile's corner). */
  company?: CompanyId
  /** The card: chips under the name, what it does, how it is had (or how it opens). */
  chips: string[]
  does: string
  how: string
}

export interface CodexSection {
  title: string
  /** A section's own hue (a level, a clan); absent = the default rule. */
  hue?: string
  entries: CodexEntry[]
  have: number
}

export interface CodexFeat {
  id: string
  name: string
  feat: string
  opens?: string
  gold: number
  earned: boolean
}

export interface CodexTab {
  id: CodexTabId
  label: string
  icon: IconKey
  have: number
  total: number
  sections: CodexSection[]
  /** The feats tab is a list, not a grid. */
  feats?: CodexFeat[]
  /** LS3: the tab exists but holds nothing until the first run is over. */
  locked?: string
}

/** What a silhouette says: the designer's words, and how. */
export const UNLOCK_BY_PLAYING = 'Unlock by playing — at random, as your standing with a company rises, or by delivering a contract.'
/** What a Sovereign silhouette says: the one way it opens. */
export const UNLOCK_BY_CHARTER = 'Unlock by delivering a Sovereign Route — one Sovereign item each time.'
/** LS3: the collection opens after the first run. */
export const LIBRARY_LOCKED = 'Opens after your first run'

/** A level's hue: tan, teal, plum — and the Sovereign tier's cyan. */
export const LEVEL_HUE: Record<1 | 2 | 3 | 4, string> = { 1: '#b7a37c', 2: '#4fa6bd', 3: '#b56aa3', 4: SOVEREIGN_COLOR }
const LEVEL_NAME: Record<1 | 2 | 3 | 4, string> = { 1: 'Level 1', 2: 'Level 2', 3: 'Level 3', 4: 'Sovereign' }
const RARITY_HUE: Record<ItemRarity, string> = {
  common: 'var(--rarity-common)',
  rare: 'var(--rarity-rare)',
  epic: 'var(--rarity-epic)',
  legendary: 'var(--rarity-legendary)',
  mythic: 'var(--rarity-mythic)',
}
const RARITY_NAME: Record<ItemRarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', mythic: 'Mythic' }

const SLOT_GROUP: Record<ItemSlot, string> = { oneHand: 'Weapons', twoHand: 'Weapons', offHand: 'Off hand', body: 'Body' }
const HAND: Record<ItemSlot, string> = { oneHand: 'One hand', twoHand: 'Both hands', offHand: 'Off hand', body: 'Body' }
const featName = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id
const roadLine = (company: CompanyId | undefined) =>
  company ? ` On ${companyById(company).name}’s road it turns up more often.` : ''

/** "One hand. Swings at…" → "Swings at…": the hand is a chip on the card. */
const doesOf = (does: string) => does.replace(/^(One hand|Both hands|Off hand|Body|One hand, or the off hand)\.\s*/, '')

function section(title: string, entries: CodexEntry[], hue?: string): CodexSection {
  return { title, hue, entries, have: entries.filter((e) => !e.locked).length }
}

function itemsTab(v: CodexView): CodexTab {
  const kinds = new Set(itemPoolFor([...(v.items ?? []), ...(v.sovereign ?? [])]))
  const entry = (k: (typeof ITEM_KINDS)[number]): CodexEntry => {
    const sov = k.level === SOVEREIGN_LEVEL
    const has = kinds.has(k.id)
    return {
      id: `item:${k.id}`,
      name: has ? k.id : '???',
      locked: !has,
      badge: has ? (sov ? 'S' : String(k.level)) : '',
      hue: LEVEL_HUE[k.level],
      icon: itemIcon({ name: k.id, slot: k.slot === 'twoHand' ? 'twoHand' : k.slot }),
      company: has ? k.company : undefined,
      chips: has ? [LEVEL_NAME[k.level], HAND[k.slot], ...(k.company ? [companyById(k.company).name] : [])] : [LEVEL_NAME[k.level]],
      does: has ? doesOf(k.does) : '',
      how: has
        ? `${k.basic ? 'Every Watch has it from the first run.' : 'Yours.'} Heroes and loot can be dealt it on any road.${roadLine(k.company)}`
        : sov
          ? UNLOCK_BY_CHARTER
          : UNLOCK_BY_PLAYING,
    }
  }
  const groups = ['Weapons', 'Off hand', 'Body']
  const sections = [
    ...groups.map((g) => section(g, ITEM_KINDS.filter((k) => k.level !== SOVEREIGN_LEVEL && SLOT_GROUP[k.slot] === g).map(entry))),
    section('Sovereign', ITEM_KINDS.filter((k) => k.level === SOVEREIGN_LEVEL).map(entry), SOVEREIGN_COLOR),
  ]
  return tab('items', 'Items', 'equip', sections)
}

function skillsTab(v: CodexView): CodexTab {
  const pool = new Set(skillPoolFor(v.skills ?? [], (id) => !!v.achievements[id]))
  const sections = ([1, 2, 3] as const).map((l) =>
    section(
      LEVEL_NAME[l],
      ALL_SKILLS.filter((k) => k.level === l).map((k): CodexEntry => {
        const has = pool.has(k.id)
        const feat = k.feat ? ACHIEVEMENTS.find((a) => a.id === k.feat) : undefined
        return {
          id: `skill:${k.id}`,
          name: has ? k.name : '???',
          locked: !has,
          badge: has ? String(l) : '',
          hue: LEVEL_HUE[l],
          icon: skillHeadline(k).icon,
          company: has ? k.company : undefined,
          chips: has ? [LEVEL_NAME[l], ...(k.company ? [companyById(k.company).name] : [])] : [LEVEL_NAME[l]],
          does: has ? k.desc : '',
          how: has
            ? `${k.starter ? 'Every Watch has it from the first run.' : 'Yours.'} A hero can be dealt it, at the hero pick, a recruit or a level-up.${roadLine(k.company)}`
            : feat
              ? `Opens with the feat ${feat.name}: ${feat.feat.replace(/\.$/, '').toLowerCase()}.`
              : UNLOCK_BY_PLAYING,
        }
      }),
      LEVEL_HUE[l],
    ),
  )
  return tab('skills', 'Skills', 'boon', sections)
}

const CLANS: { id: string; name: string; hue: string }[] = [
  { id: 'torch', name: 'Torch clan', hue: '#e07a3a' },
  { id: 'tnt', name: 'Powder clan', hue: '#d0563a' },
  { id: 'barrel', name: 'Barrel clan', hue: '#b08a4a' },
]

function goblinsTab(v: CodexView): CodexTab {
  const sections = CLANS.map((clan) => {
    const keys = Object.keys(ENEMY_TYPES).filter((k) => !k.includes('_') && k.replace(/\d+$/, '') === clan.id)
    return section(
      clan.name,
      keys.map((key): CodexEntry => {
        const t = ENEMY_TYPES[key]
        const tier = Number(key.match(/\d+$/)?.[0] ?? 1)
        const knowledge = knowledgeOf(key, v.codex)
        const met = knowledge.level !== 'new'
        const d = enemyCardData(key, { wave: null, hpMult: 1, laneLength: 0, knowledge })
        const tricks = d?.tricks?.length ? ` ${d.tricks.map((x) => `${x.label}: ${x.counter}`).join(' ')}` : ''
        return {
          id: `goblin:${key}`,
          name: met ? t.name : '???',
          locked: !met,
          badge: met ? (t.isBoss ? '★' : `T${tier}`) : '',
          hue: t.isBoss ? LEVEL_HUE[3] : tier >= 3 ? LEVEL_HUE[2] : LEVEL_HUE[1],
          enemy: key,
          chips: met ? [t.isBoss ? 'Clan boss' : `Tier ${tier}`, clan.name, ...(d?.pace ? [d.pace.word] : []), ...(d?.armour ?? [])] : [clan.name],
          does: met ? `${t.baseHp} HP at full strength.${tricks}` : '',
          how: met
            ? knowledge.level === 'known'
              ? `Studied: ${knowledge.felled} felled.`
              : `Felled ${knowledge.felled}. Fell ${knowledge.need - knowledge.felled} more to learn its tricks.`
            : 'Not met yet. Every goblin you face is recorded here.',
        }
      }),
      clan.hue,
    )
  })
  return tab('goblins', 'Goblins', 'wave', sections)
}

function relicsTab(v: CodexView): CodexTab {
  const entries = RELICS.filter(relicSupported).map((r): CodexEntry => {
    const held = v.codex.relics.includes(r.id)
    const featLocked = !!r.unlock && !v.achievements[r.unlock]
    return {
      id: `relic:${r.id}`,
      name: held ? r.name : '???',
      locked: !held,
      badge: held ? RARITY_NAME[r.rarity][0] : '',
      hue: RARITY_HUE[r.rarity],
      icon: 'relic',
      chips: [RARITY_NAME[r.rarity]],
      does: held ? `${r.desc}${r.downside ? `. Cost: ${r.downside}.` : ''}` : '',
      how: held ? 'Taken on a run. A relic lasts the rest of the run it is taken on.' : featLocked ? `Opens with the feat ${featName(r.unlock!)}.` : 'Not taken yet.',
    }
  })
  return tab('relics', 'Relics', 'relic', [section('Relics', entries)])
}

function featsTab(v: CodexView): CodexTab {
  const feats = ACHIEVEMENTS.map((a) => ({ id: a.id, name: a.name, feat: a.feat, opens: a.opens, gold: a.gold, earned: !!v.achievements[a.id] }))
  return { id: 'feats', label: 'Feats', icon: 'crown', have: feats.filter((f) => f.earned).length, total: feats.length, sections: [], feats }
}

function tab(id: CodexTabId, label: string, icon: IconKey, sections: CodexSection[]): CodexTab {
  return {
    id,
    label,
    icon,
    sections,
    have: sections.reduce((n, s) => n + s.have, 0),
    total: sections.reduce((n, s) => n + s.entries.length, 0),
  }
}

/** The five tabs, in order. A first-timer's Items and Skills wait for the first run (LS3). */
export function codexModel(v: CodexView): CodexTab[] {
  const lockedLib = (t: CodexTab): CodexTab => (v.staged ? { ...t, sections: [], have: 0, locked: LIBRARY_LOCKED } : t)
  return [lockedLib(itemsTab(v)), lockedLib(skillsTab(v)), goblinsTab(v), relicsTab(v), featsTab(v)]
}

/**
 * The glossary (LS3/LS4): one line per idea, in the game's one name for it —
 * every idea for a returning player, only the ones met so far for a
 * first-timer (the rest are a count, never a spoiler). Opened from the
 * Codex's "?" button.
 */
export function glossaryLines(v: Pick<CodexView, 'met' | 'staged'>): { lines: { term: string; line: string }[]; waiting: number } {
  const met = new Set<string>([...CORE_IDEAS, ...(v.met ?? [])])
  const shown = v.staged ? IDEAS.filter((id) => met.has(id)) : [...IDEAS]
  return {
    lines: shown.flatMap((id) => [GLOSSARY[id], ...(GLOSSARY[id].also ?? [])].map((g) => ({ term: g.term, line: g.line }))),
    waiting: IDEAS.length - shown.length,
  }
}
