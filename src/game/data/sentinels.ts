import { nextId } from '../core/rng'
import { BASE_ARCHETYPE_NODES, getNode } from './archetypeTree'
import { STYLE_LOOK } from './gear'
import type { HeroStyle } from './items'
import type { Archetype, CoreStats, Equipment, Item, Sentinel } from '../types'

/**
 * Hue and words for each of the three LOOKS (the art a hero is drawn with —
 * `gear.lookOf`, picked by its weapon). Not a class: nothing reads it but the
 * renderers and the legacy benches.
 */
export const ARCHETYPES: Record<Archetype, { name: string; blurb: string; color: string; accent: string }> =
  Object.fromEntries(
    BASE_ARCHETYPE_NODES.map((n) => [
      n.archetype,
      { name: n.name, blurb: n.blurb, color: n.color!, accent: n.accent! },
    ]),
  ) as Record<Archetype, { name: string; blurb: string; color: string; accent: string }>

/** A look's two hues (range ring, projectile, glow). */
export const lookHue = (look: Archetype): { color: string; accent: string } => ({ color: ARCHETYPES[look].color, accent: ARCHETYPES[look].accent })

/**
 * One name pool for every hero (there is no class to split it by). The run
 * snapshot carries how many it has handed out, so a hire after a resume is
 * not given a name already worn on the roster (m-4).
 */
export const HERO_NAMES: readonly string[] = [
  'Bran', 'Vesper', 'Aldre', 'Doyle', 'Quill', 'Sorrel', 'Marek', 'Sable', 'Ipha', 'Ossa', 'Nyx', 'Cael',
  'Torv', 'Wren', 'Mireth', 'Grael', 'Fenn', 'Yavn', 'Hthe', 'Dask', 'Esk', 'Rook', 'Lyre', 'Orla',
]

export interface NameCounters {
  heroes: number
}

/**
 * How many names the pool has handed out. A process-global, like the entity-id
 * counter — so it resets on reload, and rides in the run snapshot (m-4).
 */
const nameCounters: NameCounters = { heroes: 0 }

/** The counters as they stand, for the run snapshot. */
export const nameCounterState = (): NameCounters => ({ ...nameCounters })

/**
 * Fast-forward the counter past every name a restored run already issued. Only
 * ever moves forward, so it cannot collide with names handed out since boot.
 */
export function restoreNameCounters(counters: Partial<NameCounters> | null | undefined): void {
  if (!counters) return
  const n = counters.heroes
  if (typeof n === 'number' && Number.isFinite(n) && n > nameCounters.heroes) nameCounters.heroes = Math.floor(n)
}

/** The next name off the pool, skipping any in `taken` (a roster's). */
export function nextName(taken: Iterable<string> = []): string {
  const used = new Set(taken)
  for (let i = 0; i < HERO_NAMES.length; i++) {
    const name = HERO_NAMES[(nameCounters.heroes + i) % HERO_NAMES.length]
    if (!used.has(name)) {
      nameCounters.heroes += i + 1
      return name
    }
  }
  return HERO_NAMES[nameCounters.heroes++ % HERO_NAMES.length]
}

function emptyEquipment(): Equipment {
  return { mainHand: null, offHand: null, body: null }
}

/**
 * The base stats a hero trained for a style starts from — the three old
 * tier-0 stat blocks, keyed by what the hero holds (a sword-hand is strong, a
 * bow-hand is quick, a wand-hand is clever). Rolled heroes jitter these a
 * little (`run/heroes.rollBase`).
 */
export function styleStats(style: HeroStyle | null): CoreStats {
  if (!style) return { str: 7, dex: 7, int: 7 }
  return { ...getNode(STYLE_LOOK[style]).baseStats! }
}

/** Thorns and patience every hero starts near (a shield adds thorns on top). */
export const BASE_THORNS = 2
export const BASE_PATIENCE = 4

export interface HeroSpec {
  name?: string
  stats?: CoreStats
  thorns?: number
  patience?: number
  equipment?: Partial<Equipment>
}

/**
 * A fresh level-1 hero. There is no class: pass its stats and gear (the hero
 * pick and the recruit roll do, `run/heroes.ts`); with neither it is a bare,
 * even-statted body. Takes a name off the shared pool unless one is given.
 */
export function createHero(spec: HeroSpec = {}): Sentinel {
  return {
    id: nextId('sent'),
    name: spec.name ?? nextName(),
    stats: { ...(spec.stats ?? styleStats(null)) },
    thorns: spec.thorns ?? BASE_THORNS,
    patience: spec.patience ?? BASE_PATIENCE,
    level: 1,
    xp: 0,
    equipment: { ...emptyEquipment(), ...(spec.equipment ?? {}) },
  }
}

/**
 * The gear each old class is rebuilt from: what it held is what it was. A
 * Fighter is a sword and a shield (the shield holds 2 and adds 6 thorns —
 * with the base 2, the Fighter's old 8), a Rogue a dagger, a Mystic a wand.
 */
export const CLASSIC_KIT: Readonly<Record<Archetype, { main: string; off: string | null }>> = {
  fighter: { main: 'Sword', off: 'Shield' },
  rogue: { main: 'Dagger', off: null },
  mystic: { main: 'Wand', off: null },
}

/** A piece with no stats of its own: only its noun, so only what it makes the hero DO. */
export const plainItem = (id: string, noun: string, slot: Item['slot']): Item => ({ id, name: noun, slot, rarity: 'common', base: {}, enchantments: [] })

/**
 * The old class `look` stood for, rebuilt from gear — its base stats, and
 * its {@link CLASSIC_KIT} as stat-less pieces — so it fights exactly as that
 * class did (the same attack, the same hold and thorns). For the balance
 * benches and tests only: a real hero is rolled (`run/heroes.ts`).
 */
export function classicHero(look: Archetype, spec: HeroSpec = {}): Sentinel {
  const node = getNode(look)
  const kit = CLASSIC_KIT[look]
  const hero = createHero({ stats: { ...node.baseStats! }, thorns: BASE_THORNS, patience: node.basePatience!, ...spec })
  return {
    ...hero,
    equipment: spec.equipment
      ? hero.equipment
      : {
          mainHand: plainItem(`kit-${hero.id}-main`, kit.main, 'oneHand'),
          offHand: kit.off ? plainItem(`kit-${hero.id}-off`, kit.off, 'offHand') : null,
          body: null,
        },
  }
}
