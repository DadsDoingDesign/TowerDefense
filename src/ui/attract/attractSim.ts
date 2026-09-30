/**
 * The menu's attract-mode battle — the SIMULATION half (no DOM, no React).
 *
 * A real `GameEngine` on the real map, fighting a real encounter from
 * `generateEncounter`, with a scripted company already posted. Everything is
 * pinned — the seed, the depth, the company, the slots — so the demo is the
 * same loop for every player, every time.
 *
 * ## It must be invisible to the run
 *
 * The attract battle shares a process with the game, and the game's
 * reproducibility rests on three process-global counters: the entity-id
 * counter (`nextId`), the hero-name counters (`createSentinel`) and
 * `RNG.autoSeed`. A demo that spent any of them would make the run the player
 * starts afterwards differ from the same seed started cold — different ids in
 * the snapshot, a different name on the first hero. So:
 *
 *  - the company is built here from the archetype tree directly, never through
 *    `createSentinel`, and carries fixed `attract-*` ids;
 *  - the engine is constructed and stepped inside `withIsolatedIds`, which puts
 *    the id counter back after every call;
 *  - every RNG gets an explicit seed, so `RNG.autoSeed` is never consulted.
 *
 * It touches no store and no persistence: nothing here imports `state/`.
 * `tests/attract.test.ts` proves the counters and a seeded run are unchanged.
 */
import { withIsolatedIds } from '../../game/core/rng'
import { getNode } from '../../game/data/archetypeTree'
import { FIRST_MAP, legacyPostTile } from '../../game/data/maps'
import { ARCHETYPES } from '../../game/data/sentinels'
import { generateEncounter, type EncounterKind } from '../../game/data/waves'
import { GameEngine, TICK } from '../../game/engine/engine'
import { applyXp, xpToReach } from '../../game/engine/leveling'
import type { Archetype, GameMap, Sentinel } from '../../game/types'

export interface AttractScenario {
  depth: number
  kind: EncounterKind
  seed: number
  /** Who stands where, and at what level. */
  company: readonly { archetype: Archetype; slot: string; level: number }[]
}

/**
 * The loop. Chosen by simulation (see the test) so that every one is won —
 * the demo is an advert, and a Gate falling on the title screen is the wrong
 * one — and each runs 25–60 s of real fight in the framed stretch of the lane.
 */
export const ATTRACT_SCENARIOS: readonly AttractScenario[] = [
  {
    depth: 3,
    kind: 'normal',
    seed: 0x5eed01,
    company: [
      { archetype: 'fighter', slot: 's3', level: 5 },
      { archetype: 'rogue', slot: 's2', level: 5 },
      { archetype: 'mystic', slot: 's4', level: 5 },
      { archetype: 'fighter', slot: 's1', level: 5 },
    ],
  },
  {
    depth: 4,
    kind: 'elite',
    seed: 0x5eed02,
    company: [
      { archetype: 'fighter', slot: 's3', level: 5 },
      { archetype: 'rogue', slot: 's2', level: 5 },
      { archetype: 'mystic', slot: 's4', level: 5 },
    ],
  },
  {
    depth: 6,
    kind: 'boss',
    seed: 0x5eed03,
    company: [
      { archetype: 'fighter', slot: 's3', level: 16 },
      { archetype: 'rogue', slot: 's2', level: 16 },
      { archetype: 'mystic', slot: 's4', level: 16 },
    ],
  },
]

/** The field the demo is fought on. */
export const ATTRACT_MAP: GameMap = FIRST_MAP

/** G1-2: the company is authored on the old circle ids; each stands on the tile nearest its circle. */
const post = (id: string): string => legacyPostTile(ATTRACT_MAP.id, id) ?? id

/** A company member, built without touching the name or id counters. */
function attractHero(archetype: Archetype, level: number, i: number): Sentinel {
  const node = getNode(archetype)
  const meta = ARCHETYPES[archetype]
  const base: Sentinel = {
    id: `attract-${i}-${archetype}`,
    name: meta.name,
    archetype,
    branchPath: [archetype],
    stats: { ...node.baseStats! },
    thorns: node.baseThorns!,
    patience: node.basePatience!,
    level: 1,
    xp: 0,
    equipment: { mainHand: null, offHand: null, body: null },
    color: node.color!,
    accent: node.accent!,
  }
  return level > 1 ? applyXp(base, xpToReach(level)) : base
}

/** Scenario `index`, wrapped into range. */
const scenarioAt = (index: number): AttractScenario =>
  ATTRACT_SCENARIOS[((index % ATTRACT_SCENARIOS.length) + ATTRACT_SCENARIOS.length) % ATTRACT_SCENARIOS.length]

/**
 * Build scenario `index` (wrapped). Mints no global id.
 *
 * With `preroll`, the fight is fast-forwarded past the walk-in: the column
 * needs 8–10 s to reach the company, which on a title screen is 8–10 s of an
 * empty meadow. A throwaway probe finds the tick the first hero picks a target
 * and the real engine is stepped to one second before it, so the demo opens
 * on the approach. Same seed, same ticks: the fight that plays is exactly the
 * fight that would have played.
 */
export function createAttractEngine(index: number, opts: { preroll?: boolean } = {}): GameEngine {
  const build = () => buildEngine(scenarioAt(index))
  if (!opts.preroll) return build()
  return withIsolatedIds(() => {
    const probe = build()
    let contact = 0
    while (contact < 60 * 30 && probe.status === 'running' && !probe.sentinels.some((s) => s.targetId)) {
      probe.step(TICK)
      contact++
    }
    const engine = build()
    for (let t = 0; t < contact - 60 && engine.status === 'running'; t++) engine.step(TICK)
    return engine
  })
}

function buildEngine(sc: AttractScenario): GameEngine {
  return withIsolatedIds(
    () =>
      new GameEngine({
        map: ATTRACT_MAP,
        wave: generateEncounter(sc.depth, sc.kind, { seed: sc.seed }),
        placedSentinels: sc.company.map((c, i) => ({ sentinel: attractHero(c.archetype, c.level, i), slotId: post(c.slot) })),
        baseHp: 20,
        maxBaseHp: 20,
        seed: sc.seed,
        // No `onEvent`: the demo is muted by construction — the mixer never
        // hears it — and the sim stays a pure function of (seed, options).
      }),
  )
}

/**
 * Advance `ticks` whole TICKs (the only step size the sim knows), calling
 * `each` around every tick so a renderer-side differ can watch. Mints no
 * global id: the counter is restored after the batch.
 */
export function stepAttract(
  engine: GameEngine,
  ticks: number,
  each?: { before?: (e: GameEngine) => void; after?: (e: GameEngine) => void },
): void {
  withIsolatedIds(() => {
    for (let i = 0; i < ticks && engine.status === 'running'; i++) {
      each?.before?.(engine)
      engine.step(TICK)
      each?.after?.(engine)
    }
  })
}

/** Where the company stands — the crop centres on it. */
export function attractFocus(index: number): { x: number; y: number } {
  const sc = scenarioAt(index)
  const pts = sc.company.map((c) => ATTRACT_MAP.slots.find((s) => s.id === post(c.slot))!.pos)
  return {
    x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
    y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
  }
}
