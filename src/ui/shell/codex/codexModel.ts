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
import { RELICS, relicMark, relicSupported } from '../../../game/data/relics'
import { RELIC_NOTE } from '../relicOffers'
import { ALL_SKILLS, isNamedId, NAMED_MERGES, skillById, skillHeadline } from '../../../game/data/skills'
import { ITEM_KINDS, itemPoolFor, kindEffect, kindSlot, SOVEREIGN_LEVEL } from '../../../game/data/itemKinds'
import { itemIcon, type IconKey } from '../../../game/data/iconAtlas'
import { companyById, type CompanyId } from '../../../game/data/companies'
import { SOVEREIGN_COLOR } from '../../../game/run/charter'
import { SIGNATURE_LEVEL } from '../../../game/run/track'
import { skillPoolFor } from '../../../game/run/watch'
import type { ItemRarity, ItemSlot } from '../../../game/types'
import type { Codex } from '../../../state/metaStore'
import { CORE_IDEAS, IDEAS } from '../../../state/staging'
import { GLOSSARY } from '../../channels'
import { enemyCardData } from '../enemyFacts'
import { baseOf, CLAN_IDS, clanArtId, clanById, enemyName, FACTIONS, TIERS, type Faction } from '../../../game/data/clans'

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
  /**
   * A named merge's recipe (Oct 2026): [base, card], always shown in that
   * order — the tile is "A ← B → ?" until it is made once — its tier, and,
   * once found, its twist.
   */
  fusion?: { parts: { name: string; icon: IconKey }[]; tier: 1 | 2; twist?: string }
}

/** One row of the Merges build tree: a tier-1 named merge, and the greater one it builds into. */
export interface CodexTreeRow {
  entry: CodexEntry
  greater?: CodexEntry
}

export interface CodexSection {
  title: string
  /** A section's own hue (a level, a clan); absent = the default rule. */
  hue?: string
  entries: CodexEntry[]
  have: number
  /** Laid out as a build tree (the Merges section): its rule line, its count, its rows. */
  tree?: { rule: string; made: string; rows: CodexTreeRow[] }
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
export const UNLOCK_BY_PLAYING = 'Unlocks as your standing rises, or for a delivered contract.'
/** What a Sovereign silhouette says: the one way it opens. */
export const UNLOCK_BY_CHARTER = 'Unlocks with a delivered Sovereign Route, one each time.'
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
const featName = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id
const roadLine = (company: CompanyId | undefined) =>
  company ? ` More often on ${companyById(company).name}’s road.` : ''


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
      chips: has ? [LEVEL_NAME[k.level], kindSlot(k), ...(k.company ? [companyById(k.company).name] : [])] : [LEVEL_NAME[k.level]],
      // The hand is a chip on the card (`kindSlot`); the line is what it does.
      does: has ? kindEffect(k) : '',
      how: has
        ? `${k.basic ? 'Yours from the first run.' : 'Yours.'} Dealt on any road.${roadLine(k.company)}`
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
          chips: has ? [LEVEL_NAME[l], ...(k.signature ? [SIGNATURE_CHIP] : []), ...(k.company ? [companyById(k.company).name] : [])] : [LEVEL_NAME[l]],
          does: has ? k.desc : '',
          how: has
            ? `${k.starter ? 'Yours from the first run.' : 'Yours.'} Dealt at the hero pick, a city’s hire or a level-up.${roadLine(k.company)}`
            : feat
              ? `Opens with the feat ${feat.name}: ${feat.feat.replace(/\.$/, '').toLowerCase()}.`
              : k.signature
                ? signatureHow(k.company)
                : UNLOCK_BY_PLAYING,
        }
      }),
      LEVEL_HUE[l],
    ),
  )
  return tab('skills', 'Skills', 'boon', [...sections, fusionsSection(v)])
}

/** The Merges section's hue: the house accent (a merge is no one level). */
export const FUSION_HUE = 'var(--accent)'
/** The section's one-line rule (the whole system, said once). */
export const MERGE_RULE = 'Drop a card on a held skill to merge it in. The skill in the slot leads: order matters.'
/** How far the player is: the named merges made out of all of them. */
export const mergesMade = (n: number, of: number): string => `Made ${n} of ${of} named merges.`
/** What an undiscovered named merge's card says under its recipe: how to find it, never what it is. */
export const fusionHow = (base: string, card: string): string => `Drop ${card} on ${base} at a level-up to find out.`
/** What a found one's says. */
export const fusionFound = (base: string, card: string): string => `Found. Drop ${card} on ${base} at a level-up.`

/**
 * Merging (Oct 2026, `docs/SKILL_FUSION.md` § 4): every NAMED merge as a tile,
 * laid out as its build tree — each tier-1 recipe in a row, and the greater
 * one it builds into beside it (`tree`). Its parts always show, in their
 * order (base ← card) — a recipe is a goal to chase, not a secret — and its
 * result is "?" until the player has made it once (`codex.fusions`). The
 * plain merges are not listed: every ordered pair makes one, and the rule
 * line says so.
 */
function fusionsSection(v: CodexView): CodexSection {
  const found = new Set(v.codex.fusions ?? [])
  const entry = (f: (typeof NAMED_MERGES)[number]): CodexEntry => {
    const has = found.has(f.id)
    const parts = f.parts.map((id) => {
      const k = skillById(id)!
      // A greater recipe's base is a named merge: locked, it shows as "?" too.
      const hidden = isNamedId(id) && !found.has(id)
      return { name: hidden ? '???' : k.name, icon: skillHeadline(k).icon }
    })
    const named = f.named!
    return {
      id: `fusion:${f.id}`,
      name: has ? f.name : '???',
      locked: !has,
      badge: has ? String(f.level) : '',
      hue: FUSION_HUE,
      // Locked, the tile draws its parts and a "?" (`CodexScreen.Art`); found, its own mark.
      icon: has ? f.icon : parts[0].icon,
      company: has ? f.company : undefined,
      chips: has ? [`${named.tier === 2 ? 'Greater' : 'Named'} · ${LEVEL_NAME[f.level]}`, companyById(f.company).name] : [named.tier === 2 ? 'Greater' : 'Named'],
      does: has ? f.lines.slice(0, -1).join(' ') : '',
      how: has ? fusionFound(parts[0].name, parts[1].name) : fusionHow(parts[0].name, parts[1].name),
      fusion: { parts, tier: named.tier, ...(has ? { twist: f.twist } : {}) },
    }
  }
  const tier1 = NAMED_MERGES.filter((f) => f.named!.tier === 1)
  const rows = tier1.map((f) => {
    const g = NAMED_MERGES.find((x) => x.parts[0] === f.id)
    return { entry: entry(f), ...(g ? { greater: entry(g) } : {}) }
  })
  // The grid's own order (paging, NEW, the desk's side card) reads the tree's:
  // the branches (each tier 1, then its greater), then the leaves.
  const entries = [...rows.filter((r) => r.greater).flatMap((r) => [r.entry, r.greater!]), ...rows.filter((r) => !r.greater).map((r) => r.entry)]
  const out = section('Merges', entries, FUSION_HUE)
  return { ...out, tree: { rule: MERGE_RULE, made: mergesMade(out.have, entries.length), rows } }
}

/** A signature skill's chip (Draft 4 · B): the company's own, from its loyalty track. */
export const SIGNATURE_CHIP = 'Signature'
/** How a locked signature skill opens: the one way, standing 5 on its company's track. */
export const signatureHow = (company: CompanyId): string => `${companyById(company).name}’s signature: opens at Standing ${SIGNATURE_LEVEL}.`

/**
 * A skill or item kind as the loyalty track shows it AHEAD of time (Draft 4 ·
 * B): named and described in full — the track names what a level will pay —
 * with `how` saying where it comes from. The Codex's own card draws it.
 */
export function previewEntry(kind: 'skill' | 'item', id: string, how: string): CodexEntry | null {
  if (kind === 'skill') {
    const k = ALL_SKILLS.find((x) => x.id === id)
    if (!k) return null
    return {
      id: `skill:${k.id}`,
      name: k.name,
      locked: false,
      badge: String(k.level),
      hue: LEVEL_HUE[k.level],
      icon: skillHeadline(k).icon,
      company: k.company,
      chips: [LEVEL_NAME[k.level], ...(k.signature ? [SIGNATURE_CHIP] : []), companyById(k.company).name],
      does: k.desc,
      how,
    }
  }
  const k = ITEM_KINDS.find((x) => x.id === id)
  if (!k) return null
  return {
    id: `item:${k.id}`,
    name: k.id,
    locked: false,
    badge: k.level === SOVEREIGN_LEVEL ? 'S' : String(k.level),
    hue: LEVEL_HUE[k.level],
    icon: itemIcon({ name: k.id, slot: k.slot === 'twoHand' ? 'twoHand' : k.slot }),
    company: k.company,
    chips: [LEVEL_NAME[k.level], kindSlot(k), companyById(k.company).name],
    does: kindEffect(k),
    how,
  }
}

/** The faction, as a chip: what kind of goblin a tile is in every clan. */
const FACTION_CHIP: Record<Faction, string> = { torch: 'Torch', tnt: 'Powder', barrel: 'Barrel' }

/**
 * The goblins, by CLAN (Oct 2026, `data/clans.ts`): one section per company's
 * road, each the clan's fifteen units (three factions × five tiers) in its own
 * dress and under its own names. A clan's tiles open once it has fielded a
 * wave against you (`codex.clans`) AND you have met that unit; what is learned
 * of a unit (`knowledgeOf`) is shared by every clan, because the fight is.
 */
function goblinsTab(v: CodexView): CodexTab {
  const keys = FACTIONS.flatMap((f) => TIERS.map((t) => `${f}${t}`))
  const met = new Set(v.codex.clans ?? [])
  const sections = CLAN_IDS.map((clan) => {
    const c = clanById(clan)
    const company = companyById(c.company)
    const clanMet = met.has(clan)
    return section(
      c.name,
      keys.map((key): CodexEntry => {
        const t = ENEMY_TYPES[key]
        const { faction, tier } = baseOf(key)!
        const knowledge = knowledgeOf(key, v.codex)
        const open = clanMet && knowledge.level !== 'new'
        const d = enemyCardData(key, { wave: null, hpMult: 1, laneLength: 0, knowledge, clan })
        const tricks = d?.tricks?.length ? ` ${d.tricks.map((x) => `${x.label}: ${x.counter}`).join(' ')}` : ''
        return {
          id: `goblin:${clan}:${key}`,
          name: open ? enemyName(t, clan) : '???',
          locked: !open,
          badge: open ? (t.isBoss ? '★' : `T${tier}`) : '',
          hue: t.isBoss ? LEVEL_HUE[3] : tier >= 3 ? LEVEL_HUE[2] : LEVEL_HUE[1],
          enemy: clanArtId(clan, key),
          company: c.company,
          chips: open ? [t.isBoss ? 'Clan boss' : `Tier ${tier}`, FACTION_CHIP[faction], ...(d?.pace ? [d.pace.word] : []), ...(d?.armour ?? [])] : [c.name],
          does: open ? `${t.baseHp} HP at full strength.${tricks}` : '',
          how: open
            ? knowledge.level === 'known'
              ? `Studied: ${knowledge.felled} felled.`
              : `Felled ${knowledge.felled}. ${knowledge.need - knowledge.felled} more to learn its tricks.`
            : clanMet
              ? 'Not met yet.'
              : `Raids ${company.name}’s road.`,
        }
      }),
      company.color,
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
      icon: relicMark(r.id),
      chips: [RARITY_NAME[r.rarity]],
      does: held ? `${r.desc}${r.downside ? `. Cost: ${r.downside}` : ''}` : '',
      how: held ? RELIC_NOTE : featLocked ? `Opens with the feat ${featName(r.unlock!)}.` : 'Not taken yet.',
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
