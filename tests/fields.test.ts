import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { idCounterState } from '../src/game/core/rng'
import { ALL_MAPS, fieldFor, fieldIdOf, orientationOf, pickBattleMap } from '../src/game/data/maps'
import { nameCounterState } from '../src/game/data/sentinels'
import { actFieldId, actFieldIds, groundFor, inferredFieldAct, validFieldAct } from '../src/game/run/fields'
import { nodeHazardSeed, nodeTerrainRule } from '../src/game/run/terrain'
import { actOf, ACT_LAYERS, ACTS } from '../src/game/run/threat'
import { emptyPlacements } from '../src/game/run/map'
import type { MapNode } from '../src/game/data/runmap'
import { useGameStore } from '../src/state/gameStore'
import { useMetaStore } from '../src/state/metaStore'
import { STANDARD_RUN } from '../src/state/seeds'
import { setLayoutOrientation } from '../src/state/game/runtime'
import { groundOf } from '../src/state/game/runSlice'
import { captureRun, migrateSnapshot } from '../src/state/runSnapshot'

/**
 * The road changes country at every city (`run/fields`): each act is fought
 * on its own field, a pure hash of (run seed, act) that never repeats the act
 * before it, and the company starts each act's first fight on the bench.
 */

beforeAll(() => useMetaStore.setState({ stats: { ...useMetaStore.getState().stats, runsCompleted: 1 } }))

describe('the act field rule (pure)', () => {
  it('act 1 is the field the run was always dealt', () => {
    for (let seed = 1; seed < 300; seed++) expect(actFieldId(seed, 1)).toBe(pickBattleMap(seed).id)
  })

  it('is deterministic per (seed, act)', () => {
    for (let seed = 1; seed < 300; seed++) {
      const a = actFieldIds(seed)
      expect(a).toHaveLength(ACTS)
      expect(actFieldIds(seed)).toEqual(a)
      for (let act = 1; act <= ACTS; act++) expect(actFieldId(seed, act)).toBe(a[act - 1])
    }
  })

  it('never repeats the previous act while another field exists', () => {
    expect(ALL_MAPS.length).toBeGreaterThan(1)
    for (let seed = 1; seed < 500; seed++) {
      const a = actFieldIds(seed)
      for (let act = 2; act <= ACTS; act++) expect(a[act - 1]).not.toBe(a[act - 2])
      // …and whatever field a save is actually standing on.
      for (const m of ALL_MAPS) expect(actFieldId(seed, 2, m.id)).not.toBe(m.id)
    }
  })

  it('deals every field across seeds (no act is stuck on one map)', () => {
    for (let act = 1; act <= ACTS; act++) {
      const seen = new Set<string>()
      for (let seed = 1; seed < 200; seed++) seen.add(actFieldId(seed, act))
      expect(seen.size).toBe(ALL_MAPS.length)
    }
  })

  it('moves the field only when a fight opens a later act', () => {
    const seed = 4242
    const act1 = { fieldId: actFieldId(seed, 1), fieldAct: 1 }
    for (let layer = 0; layer <= ACT_LAYERS; layer++) expect(groundFor(seed, act1, layer)).toEqual({ ...act1, fresh: false })
    const g2 = groundFor(seed, act1, ACT_LAYERS + 1)
    expect(g2).toEqual({ fieldId: actFieldId(seed, 2), fieldAct: 2, fresh: true })
    // Within act 2 it stays; act 3 moves again.
    expect(groundFor(seed, g2, 2 * ACT_LAYERS).fresh).toBe(false)
    const g3 = groundFor(seed, g2, 2 * ACT_LAYERS + 1)
    expect(g3.fresh).toBe(true)
    expect(g3.fieldId).toBe(actFieldId(seed, 3))
    // The final boss is act 3: no fourth field.
    expect(groundFor(seed, g3, 3 * ACT_LAYERS).fresh).toBe(false)
  })

  it('reads a stored act strictly and infers a missing one from the layer', () => {
    expect(validFieldAct(2)).toBe(2)
    for (const bad of [0, ACTS + 1, 1.5, '2', null, undefined, NaN, -1]) expect(validFieldAct(bad)).toBeNull()
    expect(inferredFieldAct(0)).toBe(1)
    expect(inferredFieldAct(ACT_LAYERS)).toBe(1)
    expect(inferredFieldAct(ACT_LAYERS + 1)).toBe(2)
    expect(inferredFieldAct('x')).toBe(1)
    expect(inferredFieldAct(Infinity)).toBe(1)
  })
})

describe('the store: new ground at each act, posts kept within one', () => {
  afterEach(() => setLayoutOrientation(null))
  const SEED = 4242

  const fightIn = (act: number, not: string[] = []): MapNode => {
    const st = useGameStore.getState()
    return st.runMap.nodes.find(
      (n) => actOf(n.layer) === act && n.layer > (act - 1) * ACT_LAYERS && (n.type === 'battle' || n.type === 'elite') && !not.includes(n.id),
    )!
  }
  /** Stand the caravan just before `node` (as if the road had got there) and enter it. */
  const enter = (node: MapNode) => {
    const st = useGameStore.getState()
    const before = st.runMap.nodes.find((n) => n.layer === node.layer - 1)!
    useGameStore.setState({
      currentNodeId: before.id,
      clearedNodeIds: [...st.clearedNodeIds, before.id],
      reachableNodeIds: [node.id],
      contract: st.contract ? { ...st.contract, pending: null } : st.contract,
      screen: 'map',
      activeNodeId: null,
      lastResult: null,
    })
    useGameStore.getState().selectNode(node.id)
  }
  /** Post the whole company on the first open tiles. */
  const postAll = () => {
    const st = useGameStore.getState()
    const p = emptyPlacements(st.battleMap)
    st.roster.forEach((h, i) => (p[st.battleMap.slots[i * 3].id] = h.id))
    useGameStore.setState({ placements: p })
    return p
  }

  it('deals act 2 its own field, benches the company and says so; act 2 fights keep the posts', () => {
    useGameStore.getState().beginCampaign(SEED, STANDARD_RUN)
    useGameStore.getState().pickStartingHero('fighter')
    const fields = actFieldIds(SEED)
    expect(useGameStore.getState().fieldAct).toBe(1)

    setLayoutOrientation(() => 'portrait')
    const a1 = fightIn(1)
    enter(a1)
    let st = useGameStore.getState()
    expect(fieldIdOf(st.battleMap)).toBe(fields[0])
    expect(st.fieldAct).toBe(1)
    expect(st.newGround).toBeNull()
    const posted = postAll()

    // A second act-1 fight: the posts carry (as they always have).
    enter(fightIn(1, [a1.id]))
    st = useGameStore.getState()
    expect(st.fieldAct).toBe(1)
    expect(Object.values(st.placements).filter(Boolean).length).toBe(Object.values(posted).filter(Boolean).length)

    // Over the act boss: new ground, in the orientation of the moment.
    const a2 = fightIn(2)
    enter(a2)
    st = useGameStore.getState()
    expect(st.fieldAct).toBe(2)
    expect(fieldIdOf(st.battleMap)).toBe(fields[1])
    expect(fieldIdOf(st.battleMap)).not.toBe(fields[0])
    expect(orientationOf(st.battleMap)).toBe('portrait')
    // The company's route ground still rules: the node's own challenge and danger ground.
    const ground = groundOf(st)
    expect(st.battleMap).toBe(
      fieldFor(fields[1], nodeTerrainRule(a2, SEED, ground), 'portrait', nodeHazardSeed(a2, SEED, ground), st.contract?.hq.rocks ?? 0),
    )
    expect(Object.values(st.placements).every((v) => v === null)).toBe(true)
    expect(st.newGround).toBe(st.battleMap.name)

    // Re-post on the new field; the next act-2 fight keeps them.
    const posted2 = postAll()
    setLayoutOrientation(() => 'landscape')
    enter(fightIn(2, [a2.id]))
    st = useGameStore.getState()
    expect(st.fieldAct).toBe(2)
    expect(fieldIdOf(st.battleMap)).toBe(fields[1])
    expect(orientationOf(st.battleMap)).toBe('landscape')
    expect(st.newGround).toBeNull()
    const kept = Object.values(st.placements).filter(Boolean)
    expect(kept.length).toBeGreaterThan(0)
    expect(kept.length).toBeLessThanOrEqual(Object.values(posted2).filter(Boolean).length)

    // Act 3: new ground again.
    enter(fightIn(3))
    st = useGameStore.getState()
    expect(st.fieldAct).toBe(3)
    expect(fieldIdOf(st.battleMap)).toBe(fields[2])
    expect(Object.values(st.placements).every((v) => v === null)).toBe(true)
  })

  it('a non-fight stop at the start of an act leaves the field and the posts alone', () => {
    useGameStore.getState().beginCampaign(SEED, STANDARD_RUN)
    useGameStore.getState().pickStartingHero('fighter')
    enter(fightIn(1))
    postAll()
    const st = useGameStore.getState()
    const stop = st.runMap.nodes.find((n) => actOf(n.layer) === 2 && n.layer > ACT_LAYERS && ['merchant', 'campfire', 'shrine', 'recruit'].includes(n.type))
    if (!stop) return
    enter(stop)
    const after = useGameStore.getState()
    expect(after.fieldAct).toBe(1)
    expect(fieldIdOf(after.battleMap)).toBe(fieldIdOf(st.battleMap))
    expect(after.placements).toEqual(st.placements)
  })

  it('a save keeps its field act; a save from before the rule honours its field for the act it stands in', () => {
    useGameStore.getState().beginCampaign(SEED, STANDARD_RUN)
    useGameStore.getState().pickStartingHero('fighter')
    const fields = actFieldIds(SEED)
    enter(fightIn(2))
    const snap = () =>
      JSON.parse(JSON.stringify(captureRun(useGameStore.getState(), { rngLoot: 1, rngMap: 2, lootPity: 0, idCounter: idCounterState(), nameCounters: nameCounterState() })))
    const s = snap()
    expect(s.fieldAct).toBe(2)
    expect(migrateSnapshot(s)!.fieldAct).toBe(2)

    // An old save in act 2, still on act 1's field (it predates the rule).
    const old = { ...s, battleMapId: fields[0], terrainRule: null, hazardSeed: null, placements: {} }
    delete old.fieldAct
    const loaded = migrateSnapshot(old)!
    expect(loaded.fieldAct).toBe(2)
    useGameStore.getState().resumeRun(loaded)
    expect(useGameStore.getState().fieldAct).toBe(2)
    // Another act-2 fight stays on the field it was on…
    enter(fightIn(2, [s.activeNodeId]))
    expect(fieldIdOf(useGameStore.getState().battleMap)).toBe(fields[0])
    // …and act 3 moves on without repeating it.
    enter(fightIn(3))
    expect(fieldIdOf(useGameStore.getState().battleMap)).not.toBe(fields[0])
    expect(useGameStore.getState().fieldAct).toBe(3)
  })
})
