/**
 * The menu's attract-mode battle — the SIMULATION half (no DOM, no React).
 *
 * A real `GameEngine` on a real field, fighting a real encounter from
 * `generateEncounter`, with a company already posted. The scene is GENERATED
 * from a seed — by default today's Daily Watch seed (`AttractMode` reads it) —
 * so everyone sees the same title sequence today and a new one tomorrow.
 *
 * ## A seeded scene, cut into fixed beats (Q12)
 *
 * From the seed, `composeScene` picks:
 *
 *  - the field (the Green Line or the Kiln Road) and its flavour (as fought,
 *    flooded or burning — the map challenges' terrain),
 *  - the foe: a boss stop or an elite column, its depth, and the wave's own
 *    variant seed — the first champion in it is the scene's headliner,
 *  - the company: three or four heroes (always a Fighter to hold the road),
 *    their levels, their evolutions and a few pieces of gear,
 *  - where the company stands: around a point on the road the headliner
 *    reaches about 11–15 s after he walks on, so the hold comes at the same
 *    point of every cut.
 *
 * The cut is the same every day — fade up on the road as the headliner walks
 * on → the camera eases along the road with him → the column reaches the
 * company and it holds → he falls (the one big hit) → a beat on the victors →
 * fade to dark — and the same shot again.
 *
 * ## Rejected until it plays (the director)
 *
 * `directAttract(seed)` plays the scene headless and reads the beats off it:
 * when the headliner appears, where he walks, the tick he falls. A draw that
 * does not give the beats is thrown away and the next draw of the SAME seed is
 * tried (`take` 0, 1, 2, …), so a seed always lands on the same scene:
 *
 *  - something hurt the Gate → rejected the tick it happens;
 *  - the headliner is not dead within {@link WALK_MAX} s of walking on, or
 *    fell before {@link WALK_MIN} s (no walk to watch) → rejected;
 *  - he fell more than {@link HIT_NEAR} px from the company (off the shot) →
 *    rejected;
 *  - the cut cannot be made 16–24 s long (a short walk is padded first with a
 *    longer establishing shot, then a longer beat after the hit) → rejected;
 *  - anything hurts the Gate during the beat after the hit → rejected.
 *
 * After {@link MAX_TAKES} draws it falls back to the authored scene
 * ({@link FALLBACK_SCENE}, round 2's Green Line boss), which is held by test.
 * `tests/attract.test.ts` sweeps 50 dates and checks every one lands.
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
 *    `createSentinel`, and carries fixed `attract-*` ids (its gear too);
 *  - the engine is constructed and stepped inside `withOwnIds`: it mints from
 *    its OWN counter (from 0, carried across calls), and the global counter
 *    is put back after every call. So the sim's ids are the same on every
 *    machine however its stepping is chunked — the director's idle-slice play
 *    and the test's straight-through one see the identical fight;
 *  - every RNG gets an explicit seed, so `RNG.autoSeed` is never consulted.
 *
 * It touches no store and no persistence: nothing here imports `state/` (the
 * seed is handed in). `tests/attract.test.ts` proves the counters and a seeded
 * run are unchanged.
 */
import { GamePath } from '../../game/core/path'
import { hashSeed, RNG, withIsolatedIds, withOwnIds, type IdCounter } from '../../game/core/rng'
import type { Vec2 } from '../../game/core/vec'
import { childrenOf, getNode } from '../../game/data/archetypeTree'
import { ENEMY_TYPES } from '../../game/data/enemies'
import { generateItem } from '../../game/data/items'
import { fieldFor, legacyPostTile } from '../../game/data/maps'
import { crowdedBy, type Post } from '../../game/data/terrain'
import { isMelee } from '../../game/engine/melee'
import { ARCHETYPES } from '../../game/data/sentinels'
import { generateEncounter, type EncounterKind } from '../../game/data/waves'
import { GameEngine, TICK } from '../../game/engine/engine'
import { applyXp, xpToReach } from '../../game/engine/leveling'
import { migrateGrowth } from '../../game/run/skills'

/**
 * The levels the scene draws a hero's line at. Heroes no longer evolve (SK1):
 * the drawn line is read as the skills it maps to (`migrateGrowth`), and the
 * draw is kept so every seed still deals the scene it always did.
 */
const TIER1_LEVEL = 10
const TIER2_LEVEL = 20
import type { Archetype, Equipment, GameMap, Item, ItemRarity, ItemSlot, Sentinel, TerrainRuleId, WaveDef } from '../../game/types'

/** One member of the company. */
export interface AttractHero {
  archetype: Archetype
  /** Tree node ids, tier 0 → current (`['fighter', 'knight']`), read as skills. */
  branchPath: readonly string[]
  /** The open tile they stand on. */
  slot: string
  level: number
  /** What they carry: a rarity per slot (the items are rolled from the scene seed). */
  gear: Partial<Record<'mainHand' | 'offHand' | 'body', ItemRarity>>
}

export interface AttractScenario {
  /** The seed the scene was drawn from (for the menu: today's Daily Watch seed). */
  seed: number
  /** Which draw of that seed this is (0 = the first; later ones are re-rolls). */
  take: number
  /** The field (`greenline`, `kilnroad`) and its map challenge, if any. */
  fieldId: string
  rule: TerrainRuleId | null
  depth: number
  kind: EncounterKind
  /** Seeds the wave's variant and the engine's combat rolls. */
  waveSeed: number
  /** Who stands where, at what level, carrying what. */
  company: readonly AttractHero[]
}

/**
 * The authored scene (round 2, H1-2): a champion stop — Warlord Grukk and his
 * barrels — against a veteran company on the Green Line's pocket. The director
 * falls back to it if a seed's every draw is rejected, so the menu always has
 * a scene; the test holds it to the same beats as every generated one.
 */
export const FALLBACK_SCENE: AttractScenario = {
  seed: 0,
  take: -1,
  fieldId: 'greenline',
  rule: null,
  depth: 6,
  kind: 'boss',
  waveSeed: 0x5eed03,
  company: [
    { archetype: 'fighter', branchPath: ['fighter'], slot: legacyPostTile('greenline', 's3') ?? 's3', level: 16, gear: {} },
    { archetype: 'rogue', branchPath: ['rogue'], slot: legacyPostTile('greenline', 's2') ?? 's2', level: 16, gear: {} },
    { archetype: 'mystic', branchPath: ['mystic'], slot: legacyPostTile('greenline', 's4') ?? 's4', level: 16, gear: {} },
  ],
}

/** The cut, in seconds of sim time (the hitstop at the big hit is extra). */
export const ATTRACT_CUT = {
  /**
   * Open at least this long before the headliner walks on, so the road is
   * seen first. A scene whose walk is short opens earlier (up to
   * {@link LEAD_IN_MAX}), so every cut runs about the same length.
   */
  leadIn: 1.2,
  /** Stay on the company this long after he falls. */
  after: 3.4,
  /** Fade up from, and back down to, the page ground. */
  fadeIn: 1.4,
  fadeOut: 1.4,
  /** The freeze on the big hit — wall time the sim does not advance. */
  hitstop: 0.16,
} as const

/** The longest establishing shot a short walk is padded to. */
const LEAD_IN_MAX = 3.2
/** The longest the beat on the company is held when the rest of the cut runs short. */
const AFTER_MAX = 4.6
/** The loop runs this long at least (wall s, the hitstop included), and less than {@link LOOP_MAX}. */
export const LOOP_MIN = 16.2
export const LOOP_MAX = 23.8
/** The hit lands at least this far into the cut (lead-in + walk), so the walk reads as the subject. */
const HIT_AT_MIN = 12.6
/** How long the headliner may walk before he falls: long enough to follow, short enough for the loop. */
export const WALK_MIN = 8.5
export const WALK_MAX = 18.8
/** He falls within this many field px of the company's centre, or the shot missed him. */
export const HIT_NEAR = 190
/** Draws of one seed tried before the authored scene is used. */
export const MAX_TAKES = 24

/** Camera samples per second of sim time. */
const CAM_HZ = 10

const FIELDS = ['greenline', 'kilnroad'] as const
const ARCH: readonly Archetype[] = ['fighter', 'rogue', 'mystic']

/** The field a scene is fought on (always landscape: the camera crops it). */
export function attractMap(sc: AttractScenario): GameMap {
  return fieldFor(sc.fieldId, sc.rule, 'landscape') ?? fieldFor('greenline', null, 'landscape')!
}

function waveOf(sc: AttractScenario): WaveDef {
  return generateEncounter(sc.depth, sc.kind, { seed: sc.waveSeed })
}

/** The wave's headliner: its first champion to walk on (or its toughest body if it has none). */
function headlinerSpeed(wave: WaveDef): number {
  const byTime = [...wave.spawns].sort((a, b) => a.at - b.at)
  const champ = byTime.find((s) => ENEMY_TYPES[s.typeId]?.isBoss)
  const t = ENEMY_TYPES[(champ ?? byTime[0]).typeId]
  return t?.speed ?? 80
}

/**
 * Draw `take` of `seed`: a field, a foe, a company and where it stands. Pure
 * and cheap (no fight is played) — {@link directAttract} decides whether the
 * draw is kept.
 */
export function composeScene(seed: number, take: number): AttractScenario {
  const rng = new RNG(hashSeed('fieldwatch-attract', seed >>> 0, take))
  const fieldId = rng.pick(FIELDS)
  const f = rng.next()
  const rule: TerrainRuleId | null = f < 0.5 ? null : f < 0.75 ? 'flooded' : 'wildfire'
  const kind: EncounterKind = rng.chance(0.6) ? 'boss' : 'elite'
  // A boss stop from the first act's to the last before the final (one or two
  // champions); an elite column deep enough to be led by a champion.
  const depth = kind === 'boss' ? rng.int(4, 8) : rng.int(6, 8)
  const waveSeed = rng.int(1, 0x7ffffffe)
  const sc0 = { seed: seed >>> 0, take, fieldId, rule, depth, kind, waveSeed }
  const map = attractMap({ ...sc0, company: [] })
  const path = new GamePath(map.path)

  // The hold: the point on the road the headliner would reach ~11–15 s after he
  // walks on, kept off the first and last stretch so the walk and the hold
  // both happen inside the field.
  const walk = rng.range(11.5, 15)
  const d = Math.max(path.length * 0.3, Math.min(path.length * 0.8, headlinerSpeed(waveOf({ ...sc0, company: [] })) * walk))
  const hold = path.pointAt(d)

  // The company: a Fighter on the road at the hold, then two or three others.
  const size = rng.chance(0.3) ? 4 : 3
  const rest = [...ARCH]
  for (let i = rest.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  const archetypes: Archetype[] = ['fighter', ...rest.filter((a) => a !== 'fighter')]
  while (archetypes.length < size) archetypes.push(rng.pick(ARCH))

  // Veterans, deeper for a deeper foe: level 12–20.
  const floor = Math.min(18, 8 + depth + (kind === 'boss' ? 1 : 0))
  // The game's spacing rule: nobody beside a hero that swings
  // (`terrain.CLEARANCE`, `melee.isMelee`); ranged heroes may stand side by
  // side. Who swings is what the hero holds — its main hand, rolled below
  // from its own per-piece stream. The weapon's KIND is that stream's first
  // draw whatever the rarity (`generateItem`: slot and rarity forced, no
  // roster), so it is read here, before the rarity is drawn, at no cost to
  // the scene's own draw order.
  const taken: Post[] = []
  const byNear = (p: Vec2, melee: boolean) =>
    map.slots
      .filter((s) => !taken.some((t) => t.tile === s.id) && !crowdedBy(s.id, melee, taken))
      .map((s) => ({ id: s.id, d: Math.hypot(s.pos.x - p.x, s.pos.y - p.y) }))
      .sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1))
  const company: AttractHero[] = archetypes.map((archetype, i) => {
    // The holder stands on the roadside tile nearest the hold; the others on
    // one of the few tiles nearest it, so they fight as one group on camera.
    const melee = isMelee({ ...bareHero(archetype, i), equipment: { mainHand: attractItem(sc0, i, 'mainHand', 'rare', archetype), offHand: null, body: null } })
    const near = byNear(hold, melee)
    const pickFrom = i === 0 ? near.slice(0, 1) : near.filter((t) => t.d < 175).slice(0, 4)
    const slot = (pickFrom.length ? rng.pick(pickFrom) : near[0]).id
    taken.push({ tile: slot, melee })
    const level = Math.min(20, floor + rng.int(0, 3))
    const branchPath = [archetype as string]
    if (level >= TIER1_LEVEL) branchPath.push(rng.pick(childrenOf(archetype)).id)
    if (level >= TIER2_LEVEL) {
      const kids = childrenOf(branchPath[1])
      if (kids.length) branchPath.push(rng.pick(kids).id)
    }
    const rarity = (): ItemRarity => {
      const r = rng.next()
      return r < 0.45 ? 'rare' : r < 0.8 ? 'epic' : r < 0.96 ? 'legendary' : 'mythic'
    }
    const gear: AttractHero['gear'] = { mainHand: rarity() }
    if (rng.chance(0.6)) gear.body = rarity()
    if (rng.chance(0.35)) gear.offHand = rarity()
    return { archetype, branchPath, slot, level, gear }
  })
  return { ...sc0, company }
}

const GEAR_SLOT: Record<'mainHand' | 'offHand' | 'body', ItemSlot> = { mainHand: 'oneHand', offHand: 'offHand', body: 'body' }

/** A company member, built without touching the name or id counters. */
function attractHero(sc: AttractScenario, h: AttractHero, i: number): Sentinel {
  let s = bareHero(h.archetype, i)
  if (h.level > 1) s = applyXp(s, xpToReach(h.level))
  const grown = migrateGrowth({ archetype: h.archetype, level: s.level, branchPath: h.branchPath, stats: s.stats })
  s = { ...s, skills: grown.skills, skillPicks: grown.skillPicks, stats: grown.stats }
  const equipment: Equipment = { mainHand: null, offHand: null, body: null }
  for (const slot of ['mainHand', 'offHand', 'body'] as const) {
    const rarity = h.gear[slot]
    if (!rarity) continue
    equipment[slot] = attractItem(sc, i, slot, rarity, h.archetype)
  }
  return { ...s, equipment }
}

/** A company member at level 1 with nothing on, without touching the name or id counters. */
function bareHero(archetype: Archetype, i: number): Sentinel {
  const node = getNode(archetype)
  const meta = ARCHETYPES[archetype]
  return {
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
}

/**
 * One piece of a company member's gear. It is rolled from the scene seed with
 * its own stream per piece, and renamed onto a fixed id — the generator mints
 * from the global counter, which `withIsolatedIds` puts back, but its id
 * would still depend on it. A main-hand weapon is of the hero's damage type.
 */
function attractItem(
  sc: Pick<AttractScenario, 'seed' | 'take'>,
  i: number,
  slot: 'mainHand' | 'offHand' | 'body',
  rarity: ItemRarity,
  archetype: Archetype,
): Item {
  const node = getNode(archetype)
  const rng = new RNG(hashSeed('fieldwatch-attract-gear', sc.seed, sc.take, i, slot))
  const item = withIsolatedIds(() =>
    generateItem(rng, {
      slot: GEAR_SLOT[slot],
      rarity,
      allowCurse: false,
      ...(slot === 'mainHand' ? { damageType: node.base?.damageType ?? 'physical' } : {}),
    }),
  )
  return { ...item, id: `attract-${i}-${slot}` }
}

/** Each engine's private id counter (see `withOwnIds`). */
const ENGINE_IDS = new WeakMap<GameEngine, IdCounter>()

function buildEngine(sc: AttractScenario, ids: IdCounter): GameEngine {
  const engine = withOwnIds(
    ids,
    () =>
      new GameEngine({
        map: attractMap(sc),
        wave: waveOf(sc),
        placedSentinels: sc.company.map((c, i) => ({ sentinel: attractHero(sc, c, i), slotId: c.slot })),
        baseHp: 20,
        maxBaseHp: 20,
        seed: sc.waveSeed,
        // No `onEvent`: the demo is muted by construction — the mixer never
        // hears it — and the sim stays a pure function of (scene, options).
      }),
  )
  ENGINE_IDS.set(engine, ids)
  return engine
}

/** Run `fn` on `engine`'s own id counter. */
const onEngine = <T>(engine: GameEngine, fn: () => T): T => {
  let ids = ENGINE_IDS.get(engine)
  if (!ids) ENGINE_IDS.set(engine, (ids = { n: 0 }))
  return withOwnIds(ids, fn)
}

/**
 * Build the scene, stepped to `atTick` (the loop's first frame). Mints no
 * global id. Same scene, same ticks: the fight that plays from there is
 * exactly the fight that would have played from the start.
 */
export function createAttractEngine(sc: AttractScenario, atTick = 0): GameEngine {
  const engine = buildEngine(sc, { n: 0 })
  onEngine(engine, () => {
    for (let t = 0; t < atTick && engine.status === 'running'; t++) engine.step(TICK)
  })
  return engine
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
  onEngine(engine, () => {
    for (let i = 0; i < ticks && engine.status === 'running'; i++) {
      each?.before?.(engine)
      engine.step(TICK)
      each?.after?.(engine)
    }
  })
}

/** Where the company stands (the centre of its tiles). */
export function attractFocus(sc: AttractScenario): Vec2 {
  const map = attractMap(sc)
  const pts = sc.company.map((c) => map.slots.find((s) => s.id === c.slot)?.pos ?? map.base)
  return {
    x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
    y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
  }
}

/** The title sequence, read off one headless play of the scene. */
export interface AttractScript {
  /** The scene that was kept. */
  scene: AttractScenario
  /** Its field. */
  map: GameMap
  /** Where the company stands, in field px. */
  focus: Vec2
  /** The sim tick the loop opens on. */
  startTick: number
  /** The tick the headliner falls — the big hit. */
  hitTick: number
  /** Where he fell, in field px. */
  hitPos: Vec2
  /** Sim ticks from the opening frame to the last one. */
  lengthTicks: number
  /** The headliner's smoothed walk in field px, `CAM_HZ` samples per sim second from `startTick` (see `attractCamera`). */
  cam: Vec2[]
  /** What the probe saw, for the test: the Gate damage taken (0 — nothing hurt it), and he died. */
  leaks: number
  /** How many draws of the seed were rejected before this one (the fallback counts all of them). */
  rejected: number
}

/** Why a draw was thrown away (for the test and the notes; the menu never shows it). */
export type Rejection = 'leak' | 'no-headliner' | 'slow' | 'quick' | 'off-shot'

/**
 * Play one draw headless and cut it — or reject it. Every `yield` is a point
 * where the renderer can hand the thread back; a rejected draw stops the tick
 * its fault shows, so a bad draw costs a fraction of a good one.
 */
function* playScene(sc: AttractScenario, chunk: number): Generator<void, AttractScript | Rejection> {
  const e = buildEngine(sc, { n: 0 })
  const map = attractMap(sc)
  const focus = attractFocus(sc)
  /** The headliner's position per tick, from the tick he appears. */
  const track: Vec2[] = []
  let headId: string | null = null
  let spawnTick = -1
  let hitTick = -1
  let hitPos: Vec2 = focus
  let verdict: Rejection | null = null
  const LIMIT = 60 * 60
  while (hitTick < 0 && !verdict && e.status === 'running') {
    onEngine(e, () => {
      for (let i = 0; i < chunk && e.status === 'running'; i++) {
        const kills = e.killCount
        e.step(TICK)
        if (e.leaks > 0) return void (verdict = 'leak')
        if (!headId) {
          const champ = e.enemies.find((x) => x.type.isBoss)
          if (champ) {
            headId = champ.id
            spawnTick = e.tick
          } else if (e.tick > LIMIT) return void (verdict = 'no-headliner')
        }
        if (!headId) continue
        const him = e.enemies.find((x) => x.id === headId)
        if (him) {
          track.push({ x: him.pos.x, y: him.pos.y })
          hitPos = { x: him.pos.x, y: him.pos.y }
          if ((e.tick - spawnTick) / 60 > WALK_MAX) return void (verdict = 'slow')
        } else {
          // He is gone: fallen if the kill count moved this tick (he did not
          // leak — that was checked above).
          if (e.killCount <= kills) return void (verdict = 'leak')
          hitTick = e.tick
          return
        }
      }
    })
    if (hitTick < 0 && !verdict) yield
  }
  if (verdict) return verdict
  if (hitTick < 0) return 'no-headliner'
  const walk = (hitTick - spawnTick) / 60
  if (walk < WALK_MIN) return 'quick'
  if (Math.hypot(hitPos.x - focus.x, hitPos.y - focus.y) > HIT_NEAR) return 'off-shot'
  // Pad a short walk: first the establishing shot (as far as the wave has
  // been running), then the beat after the hit, so every cut runs 16–24 s.
  const leadIn = Math.min(LEAD_IN_MAX, Math.max(ATTRACT_CUT.leadIn, HIT_AT_MIN - walk))
  const startTick = Math.max(0, spawnTick - Math.round(leadIn * 60))
  const hitAt = (hitTick - startTick) / 60
  const after = Math.min(AFTER_MAX, Math.max(ATTRACT_CUT.after, LOOP_MIN - ATTRACT_CUT.hitstop - hitAt))
  const endTick = hitTick + Math.round(after * 60)
  const loop = (endTick - startTick) / 60 + ATTRACT_CUT.hitstop
  if (loop < LOOP_MIN - 0.02) return 'quick'
  if (loop > LOOP_MAX) return 'slow'
  // Keep playing to the end of the cut: the beat on the company must hold too.
  onEngine(e, () => {
    while (e.tick < endTick && e.status === 'running') e.step(TICK)
  })
  if (e.leaks > 0) return 'leak'
  return cut(sc, map, focus, startTick, endTick, spawnTick, hitTick, hitPos, track, e.leaks)
}

/**
 * Direct `seed`'s scene: draw it, play it, keep the first draw that gives the
 * beats (see the header). Deterministic — the same script for the same seed on
 * every call. A draw costs one headless fight (~1,000–1,800 ticks, tens of ms
 * on a laptop), so this is a generator: every `yield` is a point where the
 * renderer can hand the thread back and resume in the next idle slice.
 */
export function* directAttractSteps(seed: number, chunk = 240): Generator<void, AttractScript> {
  for (let take = 0; take < MAX_TAKES; take++) {
    const r = yield* playScene(composeScene(seed, take), chunk)
    if (typeof r !== 'string') return { ...r, rejected: take }
    yield
  }
  const r = yield* playScene(FALLBACK_SCENE, chunk)
  if (typeof r === 'string') throw new Error(`attract scene: the authored scene was rejected (${r})`)
  return { ...r, scene: { ...FALLBACK_SCENE, seed: seed >>> 0 }, rejected: MAX_TAKES }
}

/** `directAttractSteps` run to completion. */
export function directAttract(seed: number): AttractScript {
  const it = directAttractSteps(seed, Infinity)
  for (;;) {
    const r = it.next()
    if (r.done) return r.value
  }
}

/** Play one draw straight through: its script, or why it was rejected. For the test. */
export function judgeScene(sc: AttractScenario): AttractScript | Rejection {
  const it = playScene(sc, Infinity)
  for (;;) {
    const r = it.next()
    if (r.done) return r.value
  }
}

function cut(
  scene: AttractScenario,
  map: GameMap,
  focus: Vec2,
  startTick: number,
  endTick: number,
  spawnTick: number,
  hitTick: number,
  hitPos: Vec2,
  track: Vec2[],
  leaks: number,
): AttractScript {
  const lengthTicks = endTick - startTick
  /** Where the headliner is at tick `t` (held at his spawn before, his fall after). */
  const headAt = (t: number): Vec2 => track[Math.max(0, Math.min(track.length - 1, t - spawnTick))]
  // The headliner's walk, sampled, then a wide Gaussian over the whole track:
  // the lane's hard corners become one long ease instead of five small jerks.
  // `attractCamera` pulls it toward the company.
  const n = Math.ceil((lengthTicks / 60) * CAM_HZ) + 1
  const raw: Vec2[] = []
  for (let i = 0; i < n; i++) raw.push(headAt(Math.min(startTick + Math.round((i / CAM_HZ) * 60), hitTick)))
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
  return { scene, map, focus, startTick, hitTick, hitPos, lengthTicks, cam, leaks, rejected: 0 }
}

/**
 * The camera centre `simSec` seconds into the loop: the headliner's smoothed
 * walk, pulled toward the company — a little at first (the road is the
 * subject), more by the time he falls (the hold is). `pull` is that weight at
 * the start and at the fall: a narrow phone view stays on the headliner, a
 * wide desk view can afford to keep the company in the shot too.
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
  const c = script.focus
  return { x: x + (c.x - x) * w, y: y + (c.y - y) * w }
}
