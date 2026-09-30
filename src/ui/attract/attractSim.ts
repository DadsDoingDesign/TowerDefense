/**
 * The menu's attract-mode battle — the SIMULATION half (no DOM, no React).
 *
 * A real `GameEngine` on the real map, fighting a real encounter from
 * `generateEncounter`, with a scripted company already posted. Everything is
 * pinned — the seed, the depth, the company, the slots — so the demo is the
 * same fight for every player, every time.
 *
 * ## Directed, not random (Whales UI plan H1-2)
 *
 * It used to cycle three scenarios and follow whatever the column did, which
 * read as a random stretch of somebody else's game. It is now ONE scene cut
 * into a ~20 s title sequence that plays identically on every loop:
 *
 *   fade up on the lane entrance as the champion walks on → the camera eases
 *   along the road with him → the column reaches the company and the knights
 *   hold → he falls (the one big hit) → a beat on the victors → fade to dark,
 *   and the same shot again.
 *
 * `directAttract()` plays the fight once, headless, and reads the beats off it
 * — when the champion appears, where he walks, the tick he falls — so the cut
 * follows the sim rather than a table of magic timings that a balance change
 * would silently break. The camera track is baked from those beats once, so
 * the camera does not depend on frame timing either.
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
import type { Vec2 } from '../../game/core/vec'
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
 * The scene. A champion stop (Warlord Grukk and his barrels) against a veteran
 * company on the Green Line's cluster — chosen because it has the three beats a
 * title sequence needs inside twenty seconds: one big figure walking the whole
 * lane, a hold at the bend, and a fall. Held by simulation in the test: the
 * champion dies in the shot, nothing leaks and no knight goes down.
 */
export const ATTRACT_SCENE: AttractScenario = {
  depth: 6,
  kind: 'boss',
  seed: 0x5eed03,
  company: [
    { archetype: 'fighter', slot: 's3', level: 16 },
    { archetype: 'rogue', slot: 's2', level: 16 },
    { archetype: 'mystic', slot: 's4', level: 16 },
  ],
}

/** The field the demo is fought on. */
export const ATTRACT_MAP: GameMap = FIRST_MAP

/** The cut, in seconds of sim time (the hitstop at the big hit is extra). */
export const ATTRACT_CUT = {
  /** Open this long before the champion walks on, so the road is seen first. */
  leadIn: 1.2,
  /** Stay on the company this long after he falls. */
  after: 3.4,
  /** Fade up from, and back down to, the page ground. */
  fadeIn: 1.4,
  fadeOut: 1.4,
  /** The freeze on the big hit — wall time the sim does not advance. */
  hitstop: 0.16,
} as const

/** Camera samples per second of sim time. */
const CAM_HZ = 10

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
 * Build the scene, stepped to `atTick` (the loop's first frame). Mints no
 * global id. Same seed, same ticks: the fight that plays from there is exactly
 * the fight that would have played from the start.
 */
export function createAttractEngine(atTick = 0): GameEngine {
  return withIsolatedIds(() => {
    const engine = buildEngine(ATTRACT_SCENE)
    for (let t = 0; t < atTick && engine.status === 'running'; t++) engine.step(TICK)
    return engine
  })
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

/** Where the company stands. */
export function attractFocus(): Vec2 {
  const pts = ATTRACT_SCENE.company.map((c) => ATTRACT_MAP.slots.find((s) => s.id === post(c.slot))!.pos)
  return {
    x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
    y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
  }
}

/** The title sequence, read off one headless play of the scene. */
export interface AttractScript {
  /** The sim tick the loop opens on. */
  startTick: number
  /** The tick the champion falls — the big hit. */
  hitTick: number
  /** Where he fell, in field px. */
  hitPos: Vec2
  /** Sim ticks from the opening frame to the last one. */
  lengthTicks: number
  /** The champion's smoothed walk in field px, `CAM_HZ` samples per sim second from `startTick` (see `attractCamera`). */
  cam: Vec2[]
  /** What the probe saw, for the test: nothing leaked, nobody fell, he died. */
  leaks: number
  downed: number
}

/**
 * Play the scene once and cut it. Deterministic — the same script on every
 * call. It costs one headless fight (~1,500 ticks, tens of ms on a laptop and
 * a few times that on a phone), so it is a generator: every `yield` is a point
 * where the renderer can hand the thread back and resume in the next idle
 * slice. `directAttract()` runs it straight through.
 */
export function* directAttractSteps(chunk = 240): Generator<void, AttractScript> {
  const e = buildEngine(ATTRACT_SCENE)
  /** The champion's position per tick, from the tick he appears. */
  const track: Vec2[] = []
  let spawnTick = -1
  let hitTick = -1
  let hitPos: Vec2 = attractFocus()
  let done = false
  const LIMIT = 60 * 90
  while (!done && e.tick < LIMIT && e.status === 'running') {
    withIsolatedIds(() => {
      for (let i = 0; i < chunk && e.status === 'running'; i++) {
        const kills = e.killCount
        e.step(TICK)
        const boss = e.enemies.find((x) => x.type.isBoss)
        if (boss) {
          if (spawnTick < 0) spawnTick = e.tick
          track.push({ x: boss.pos.x, y: boss.pos.y })
          hitPos = { x: boss.pos.x, y: boss.pos.y }
        } else if (spawnTick >= 0) {
          // He is gone: fallen if the kill count moved this tick, otherwise he
          // walked off the end of the road — which the test forbids.
          if (e.killCount > kills) hitTick = e.tick
          done = true
          return
        }
      }
    })
    if (!done) yield
  }
  if (spawnTick < 0 || hitTick < 0) throw new Error('attract scene: the champion never fell in the shot')
  const startTick = Math.max(0, spawnTick - Math.round(ATTRACT_CUT.leadIn * 60))
  const endTick = hitTick + Math.round(ATTRACT_CUT.after * 60)
  // Keep playing to the end of the cut, so the test can see the whole shot.
  withIsolatedIds(() => {
    while (e.tick < endTick && e.status === 'running') e.step(TICK)
  })
  return cut(startTick, endTick, spawnTick, hitTick, hitPos, track, e.leakCount, e.downedCount)
}

/** `directAttractSteps` run to completion. */
export function directAttract(): AttractScript {
  const it = directAttractSteps(Infinity)
  for (;;) {
    const r = it.next()
    if (r.done) return r.value
  }
}

function cut(
  startTick: number,
  endTick: number,
  spawnTick: number,
  hitTick: number,
  hitPos: Vec2,
  track: Vec2[],
  leaks: number,
  downed: number,
): AttractScript {
  const lengthTicks = endTick - startTick
  /** Where the champion is at tick `t` (held at his spawn before, his fall after). */
  const bossAt = (t: number): Vec2 => track[Math.max(0, Math.min(track.length - 1, t - spawnTick))]
  // The champion's walk, sampled, then a wide Gaussian over the whole track:
  // the lane's hard corners become one long ease instead of five small jerks.
  // `attractCamera` pulls it toward the company.
  const n = Math.ceil((lengthTicks / 60) * CAM_HZ) + 1
  const raw: Vec2[] = []
  for (let i = 0; i < n; i++) raw.push(bossAt(Math.min(startTick + Math.round((i / CAM_HZ) * 60), hitTick)))
  const sigma = 1.3 * CAM_HZ
  const R = Math.ceil(sigma * 2.5)
  const cam = raw.map((_, i) => {
    let sx = 0
    let sy = 0
    let sw = 0
    for (let j = -R; j <= R; j++) {
      const q = raw[Math.max(0, Math.min(n - 1, i + j))]
      const wt = Math.exp(-(j * j) / (2 * sigma * sigma))
      sx += q.x * wt
      sy += q.y * wt
      sw += wt
    }
    return { x: sx / sw, y: sy / sw }
  })
  return { startTick, hitTick, hitPos, lengthTicks, cam, leaks, downed }
}

/**
 * The camera centre `simSec` seconds into the loop: the champion's smoothed
 * walk, pulled toward the company — a little at first (the road is the
 * subject), more by the time he falls (the hold is). `pull` is that weight at
 * the start and at the fall: a narrow phone view stays on the champion, a wide
 * desk view can afford to keep the company in the shot too.
 */
export function attractCamera(script: AttractScript, simSec: number, pull: readonly [number, number] = [0.25, 0.6]): Vec2 {
  const f = Math.max(0, Math.min(script.cam.length - 1, simSec * CAM_HZ))
  const i = Math.floor(f)
  const a = script.cam[i]
  const b = script.cam[Math.min(script.cam.length - 1, i + 1)]
  const u = f - i
  const x = a.x + (b.x - a.x) * u
  const y = a.y + (b.y - a.y) * u
  const p = Math.min(1, Math.max(0, (simSec * 60) / Math.max(1, script.hitTick - script.startTick)))
  const w = pull[0] + (pull[1] - pull[0]) * p * p * (3 - 2 * p)
  const c = attractFocus()
  return { x: x + (c.x - x) * w, y: y + (c.y - y) * w }
}
