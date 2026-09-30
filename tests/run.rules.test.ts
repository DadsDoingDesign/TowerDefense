import { describe, expect, it } from 'vitest'
import { idCounterState, restoreIdCounter, streamRng } from '../src/game/core/rng'
import { newRarityPity, generateItem } from '../src/game/data/items'
import type { MapNode } from '../src/game/data/runmap'
import type { RewardCard } from '../src/game/data/rewards'
import { createSentinel } from '../src/game/data/sentinels'
import { xpToReach } from '../src/game/engine/leveling'
import { endlessRoundSpoils } from '../src/game/run/battle'
import { ITEM_PRICE, merchantLuck, rollMerchantShelf, sortItems } from '../src/game/run/economy'
import { forkFires } from '../src/game/run/map'
import { recruitSlate, recruitTargetLevel, scaledRecruit, withRecruits } from '../src/game/run/recruits'
import { applyRewardCard } from '../src/game/run/rewards'
import { planPayout, runWasPlayed, type SettleFacts } from '../src/game/run/settle'
import {
  ACT_JUMP,
  ACT_LAYERS,
  ACT_STEPS,
  RUN_LAYERS,
  THREAT_PER_ROUND,
  actOf,
  clearBonusGold,
  encounterThreat,
  isActBossLayer,
  mapKind,
  nodeClearLuck,
  nodeKind,
  nodeThreatMult,
  threatAfterLayer,
  threatAfterRound,
  threatAtLayer,
} from '../src/game/run/threat'
import { CAMPFIRE_REPAIR, canTrain, restAtCampfire, restGain, trainAtCampfire, xpToNextLevel } from '../src/game/run/campfire'
import { GATE_REPAIR, repairGate, rerollCost } from '../src/game/run/economy'
import { levelXpAwards, STOP_XP_SHARE, stopXp, waveRawXp, waveXp } from '../src/game/run/battle'
import { encounterNode } from '../src/game/run/map'
import { generateRunMap } from '../src/game/data/runmap'
import { RNG } from '../src/game/core/rng'
import { ENGINE_CAPABILITIES, RELICS, relicPool, relicSupported, relicTeamMods } from '../src/game/data/relics'
import { afterFightRelics, diaryXp, hiresTrained, restockFree, rewardHand, shelfSize, SURGEON_HEAL, TITHE_GOLD, withRelicStats } from '../src/game/run/relics'
import { lockedPerkChoices, pendingPerkLevel, perkChoices, takePerk } from '../src/game/run/perks'
import { allPerkPoints } from '../src/game/data/perks'
import { computeCombat } from '../src/game/engine/combat'
import { STANDARD_RUN } from '../src/state/daily'
import type { Sentinel } from '../src/game/types'

const node = (type: MapNode['type'], layer = 3): MapNode => ({ id: `n-${type}-${layer}`, type, layer, row: 0 }) as MapNode

describe('threat maths (game/run/threat)', () => {
  it('follows the road: a pure function of layer and act', () => {
    expect(threatAtLayer(1)).toBe(1)
    expect(threatAtLayer(2)).toBeCloseTo(ACT_STEPS[0], 12)
    // Crossing into act 2 (layer 5) pays the act step AND the jump.
    expect(threatAtLayer(5) / threatAtLayer(4)).toBeCloseTo(ACT_STEPS[1] * ACT_JUMP, 12)
    expect(threatAtLayer(6) / threatAtLayer(5)).toBeCloseTo(ACT_STEPS[1], 12)
    expect(threatAtLayer(9) / threatAtLayer(8)).toBeCloseTo(ACT_STEPS[2] * ACT_JUMP, 12)
    // A Vow's starting Threat scales the whole curve.
    expect(threatAtLayer(7, 2)).toBeCloseTo(2 * threatAtLayer(7), 12)
    // Strictly rising along the road.
    for (let l = 2; l < RUN_LAYERS; l++) expect(threatAtLayer(l)).toBeGreaterThan(threatAtLayer(l - 1))
  })

  it('every node type moves the road on equally — no choice tax, no visit step', () => {
    for (const layer of [1, 3, 4, 7]) expect(threatAfterLayer(layer)).toBe(threatAtLayer(layer + 1))
  })

  it('acts are four layers; bosses hold layers 4, 8 and 12', () => {
    expect(RUN_LAYERS).toBe(13)
    expect([1, 4, 5, 8, 9, 12].map(actOf)).toEqual([1, 1, 2, 2, 3, 3])
    expect([4, 8, 12].every(isActBossLayer)).toBe(true)
    expect([1, 3, 5, 11].some(isActBossLayer)).toBe(false)
    expect(ACT_LAYERS).toBe(4)
  })

  it('a node type adds to the road, not to the rest of the run', () => {
    expect(nodeThreatMult('battle')).toBe(1)
    // An elite's price is its composition (`ELITE_BUDGET`, the modifiers) since the no-HP refit.
    expect(nodeThreatMult('elite')).toBe(1)
    expect(nodeThreatMult('boss')).toBeLessThan(1)
    expect(nodeThreatMult('miniboss')).toBe(1)
    expect(encounterThreat(node('elite', 6))).toBeCloseTo(threatAtLayer(6) * nodeThreatMult('elite'), 12)
  })

  it('kinds: an act boss fields a boss wave; a Vow substitutes the encounter, not the node', () => {
    expect(nodeKind(node('miniboss', 4))).toBe('boss')
    expect(nodeKind(node('battle'), { allElite: true })).toBe('elite')
    expect(mapKind(node('battle'))).toBe('normal')
    expect(encounterNode(node('miniboss', 4)).type).toBe('boss')
    expect(encounterNode(node('battle')).type).toBe('battle')
  })

  it('an Endless elite round compounds harder than a plain one', () => {
    expect(threatAfterRound(1, false)).toBe(THREAT_PER_ROUND)
    expect(threatAfterRound(1, true)).toBe(THREAT_PER_ROUND * 1.08)
  })

  it('purse and luck follow the map kind', () => {
    expect(clearBonusGold(node('battle'))).toBe(0)
    expect(clearBonusGold(node('elite'))).toBe(25)
    expect(clearBonusGold(node('miniboss', 4))).toBe(60)
    expect(clearBonusGold(node('boss'))).toBe(100)
    expect(nodeClearLuck(node('battle', 2))).toBeCloseTo(0.05)
    expect(nodeClearLuck(node('elite', 2))).toBeCloseTo(0.2)
    expect(nodeClearLuck(node('boss', 12))).toBeCloseTo(0.65)
  })
})

describe('the run map in three acts (data/runmap)', () => {
  const maps = Array.from({ length: 60 }, (_, i) => generateRunMap(new RNG(i * 7 + 1)))

  it('every map has 13 layers, act bosses on 4 and 8, the final boss on 12', () => {
    for (const m of maps) {
      expect(m.layers).toBe(RUN_LAYERS)
      for (const l of [4, 8]) {
        const row = m.nodes.filter((n) => n.layer === l)
        expect(row.map((n) => n.type)).toEqual(['miniboss'])
      }
      expect(m.nodes.filter((n) => n.layer === 12).map((n) => n.type)).toEqual(['boss'])
    }
  })

  it('a campfire waits in the layer before each act boss, and every layer keeps a fight', () => {
    for (const m of maps) {
      for (const l of [3, 7, 11]) expect(m.nodes.some((n) => n.layer === l && n.type === 'campfire')).toBe(true)
      for (let l = 1; l < 12; l++) {
        if (isActBossLayer(l)) continue
        expect(m.nodes.some((n) => n.layer === l && (n.type === 'battle' || n.type === 'elite'))).toBe(true)
      }
    }
  })

  it('every node is reachable from the start', () => {
    for (const m of maps) {
      const start = m.nodes.find((n) => n.type === 'start')!
      const seen = new Set([start.id])
      const q = [start.id]
      while (q.length) {
        const id = q.shift()!
        for (const e of m.edges) if (e.from === id && !seen.has(e.to)) { seen.add(e.to); q.push(e.to) }
      }
      expect(seen.size).toBe(m.nodes.length)
    }
  })
})

describe('campfire (game/run/campfire)', () => {
  it('rest restores CAMPFIRE_REPAIR, capped at the maximum', () => {
    expect(restAtCampfire(5, 20)).toBe(5 + CAMPFIRE_REPAIR)
    expect(restAtCampfire(18, 20)).toBe(20)
    expect(restGain(18, 20)).toBe(2)
    expect(restGain(20, 20)).toBe(0)
  })

  it('train is exactly one level, from wherever the XP stands; the cap cannot train', () => {
    const s = createSentinel('rogue')
    const t = trainAtCampfire(s)
    expect(t.level).toBe(s.level + 1)
    expect(t.xp).toBe(xpToReach(s.level + 1))
    const partway = { ...s, level: 4, xp: xpToReach(4) + 10 }
    expect(xpToNextLevel(partway)).toBe(xpToReach(5) - partway.xp)
    expect(trainAtCampfire(partway).level).toBe(5)
    const capped = { ...s, level: 20, xp: xpToReach(20) }
    expect(canTrain(capped)).toBe(false)
    expect(trainAtCampfire(capped)).toBe(capped)
  })
})

describe('the gold sinks that replaced the skill tree (game/run/economy)', () => {
  it('a merchant repair heals GATE_REPAIR, capped', () => {
    expect(repairGate(3, 20)).toBe(3 + GATE_REPAIR.hp)
    expect(repairGate(19, 20)).toBe(20)
  })
  it('each reroll at a stall costs more than the last', () => {
    expect(rerollCost(0)).toBeLessThan(rerollCost(1))
    expect(rerollCost(1)).toBeLessThan(rerollCost(2))
  })
})

describe('levels are a resource (game/run/battle)', () => {
  const wave = { spawns: [{ typeId: 'torch1', at: 0, hpMult: 1 }, { typeId: 'torch2', at: 1, hpMult: 2 }] }

  it('raw XP matches the engine formula', () => {
    // 0.2 × round(24 × 1 × 3) + 4, then 0.2 × round(42 × 2 × 3) + 5
    expect(waveRawXp(wave, 3)).toBe(Math.round(72 * 0.2) + 4 + Math.round(252 * 0.2) + 5)
  })

  it('a full clear pays waveXp per fielded hero, split half even, half by kills', () => {
    const raw = waveRawXp(wave, 1)
    const out = levelXpAwards([{ id: 'a', xpGained: raw }, { id: 'b', xpGained: 0 }], { wave, hpMult: 1, depth: 3, kind: 'normal' })
    const pool = waveXp(3, 'normal') * 2
    expect(out[0].xpGained).toBe(Math.round(pool * 0.75))
    expect(out[1].xpGained).toBe(Math.round(pool * 0.25))
  })

  it('Threat no longer inflates XP; depth and kind do, linearly', () => {
    const raw = (m: number) => waveRawXp(wave, m)
    const at = (m: number) => levelXpAwards([{ id: 'a', xpGained: raw(m) }], { wave, hpMult: m, depth: 5, kind: 'normal' })[0].xpGained
    expect(at(1)).toBe(at(40))
    expect(waveXp(6, 'normal') - waveXp(5, 'normal')).toBeCloseTo(waveXp(5, 'normal') - waveXp(4, 'normal'), 9)
    expect(waveXp(5, 'elite')).toBeGreaterThan(waveXp(5, 'normal'))
    expect(waveXp(5, 'boss')).toBeGreaterThan(waveXp(5, 'elite'))
  })

  it('a stop pays a share of a plain fight, never more than the fight', () => {
    for (const d of [1, 5, 11]) {
      expect(stopXp(d)).toBe(Math.round(waveXp(d, 'normal') * STOP_XP_SHARE))
      expect(stopXp(d)).toBeLessThan(waveXp(d, 'normal'))
    }
  })

  it('a leak is XP not earned', () => {
    const raw = waveRawXp(wave, 1)
    const half = levelXpAwards([{ id: 'a', xpGained: raw / 2 }], { wave, hpMult: 1, depth: 2, kind: 'normal' })[0].xpGained
    expect(half).toBe(Math.round(waveXp(2, 'normal') / 2))
  })
})

describe('merchant shelf (game/run/economy)', () => {
  const roster = [createSentinel('rogue')]
  const shelfFrom = (seed: number) => {
    const ids = idCounterState()
    const shelf = rollMerchantShelf(streamRng(seed, 'loot'), { luck: merchantLuck(4), roster, pity: newRarityPity() })
    restoreIdCounter(ids)
    return shelf.map((e) => ({ name: e.item.name, rarity: e.item.rarity, slot: e.item.slot, price: e.price }))
  }

  it('is deterministic in the seed', () => {
    expect(shelfFrom(42)).toEqual(shelfFrom(42))
    expect(shelfFrom(42)).not.toEqual(shelfFrom(43))
  })

  it('deals four items priced by rarity, and never spends the pity counter', () => {
    const pity = { dry: 7 }
    const shelf = rollMerchantShelf(streamRng(9, 'loot'), { luck: 0.2, roster, pity })
    expect(shelf).toHaveLength(4)
    for (const e of shelf) expect(e.price).toBe(ITEM_PRICE[e.item.rarity])
    expect(pity).toEqual({ dry: 7 })
  })

  it('sorts the pack rarity-first without mutating it', () => {
    const rng = streamRng(3, 'loot')
    const items = [generateItem(rng, { rarity: 'common' }), generateItem(rng, { rarity: 'epic' }), generateItem(rng, { rarity: 'rare' })]
    const sorted = sortItems(items)
    expect(sorted.map((i) => i.rarity)).toEqual(['epic', 'rare', 'common'])
    expect(items.map((i) => i.rarity)).toEqual(['common', 'epic', 'rare'])
  })
})

describe('reward application (game/run/rewards)', () => {
  const base = () => ({ roster: [createSentinel('fighter'), createSentinel('mystic')], inventory: [], runMods: [], lootPity: { dry: 4 }, relics: [] as string[] })

  it('a stat card buffs the whole company and appends its team mods', () => {
    const t = base()
    const card: RewardCard = { id: 'c', kind: 'stat', title: '', desc: '', rarity: 'rare', grant: { stats: { str: 2, int: 1 }, thorns: 3, mods: { rateMult: 1.1 } } }
    const next = applyRewardCard(t, card)
    next.roster.forEach((s, i) => {
      expect(s.stats.str).toBe(t.roster[i].stats.str + 2)
      expect(s.stats.int).toBe(t.roster[i].stats.int + 1)
      expect(s.stats.dex).toBe(t.roster[i].stats.dex)
      expect(s.thorns).toBe(t.roster[i].thorns + 3)
    })
    expect(next.runMods).toEqual([{ rateMult: 1.1 }])
    // A stat card is not a drop: the pity counter does not move.
    expect(next.lootPity).toBe(t.lootPity)
  })

  it('an item card lands on the company (or the pack) and credits a COPY of pity', () => {
    const t = base()
    const item = generateItem(streamRng(5, 'loot'), { rarity: 'common', slot: 'oneHand' })
    const card: RewardCard = { id: 'c', kind: 'item', title: '', desc: '', rarity: 'common', item }
    const next = applyRewardCard(t, card)
    const everywhere = [...next.inventory, ...next.roster.flatMap((s) => Object.values(s.equipment))]
    expect(everywhere.some((i) => i?.id === item.id)).toBe(true)
    expect(next.lootPity).toEqual({ dry: 5 })
    expect(t.lootPity).toEqual({ dry: 4 })
  })
})

describe('recruit scaling (game/run/recruits)', () => {
  const lv = (...levels: number[]) => levels.map((level) => ({ level }))

  it('targets the roster median, three back unless trained, never below 1', () => {
    expect(recruitTargetLevel([])).toBe(1)
    expect(recruitTargetLevel(lv(2, 3))).toBe(1)
    expect(recruitTargetLevel(lv(4, 9, 12))).toBe(6)
    expect(recruitTargetLevel(lv(4, 9, 12), true)).toBe(9)
    // Median of an even roster is the upper-middle, as the store always read it.
    expect(recruitTargetLevel(lv(1, 5, 7, 20))).toBe(4)
  })

  it('a hire arrives at the target level with the hub stat bonus', () => {
    const veteran = (level: number): Sentinel => ({ ...createSentinel('fighter'), level, xp: xpToReach(level) })
    const roster = [veteran(10), veteran(10), veteran(12)]
    const plain = scaledRecruit(streamRng(1, 'loot'), 'rogue', roster, { statBonus: 0, trained: false })
    expect(plain.level).toBe(7)
    const trained = scaledRecruit(streamRng(1, 'loot'), 'rogue', roster, { statBonus: 0, trained: true })
    expect(trained.level).toBe(10)
    const fresh = scaledRecruit(streamRng(1, 'loot'), 'rogue', [], { statBonus: 2, trained: false })
    const bare = scaledRecruit(streamRng(1, 'loot'), 'rogue', [], { statBonus: 0, trained: false })
    expect(fresh.level).toBe(1)
    expect(fresh.stats.str).toBe(bare.stats.str + 2)
    // Armed on arrival.
    expect(plain.equipment.mainHand).toBeTruthy()
  })

  it('the slate is one per archetype and deterministic in the stream', () => {
    const deal = () => {
      // Names come off a process-wide, forward-only counter, so compare what
      // the STREAM decides: archetype, weapon and its rolled numbers.
      const slate = recruitSlate(streamRng(8, 'loot'), [], { statBonus: 0, trained: false })
      return slate.map((s) => ({ a: s.archetype, w: s.equipment.mainHand?.name, base: s.equipment.mainHand?.base }))
    }
    const a = deal()
    expect(a.map((s) => s.a)).toEqual(['fighter', 'rogue', 'mystic'])
    expect(deal()).toEqual(a)
  })
})

describe('settle payout (game/run/settle)', () => {
  const facts = (over: Partial<SettleFacts> = {}): SettleFacts => ({
    mode: 'campaign', depth: 3, kills: 10, wins: 0, banner: 0, challenge: STANDARD_RUN, ...over,
  })

  it('pays nothing for a run that was never played', () => {
    expect(runWasPlayed(facts({ depth: 0, kills: 0 }))).toBe(false)
    expect(planPayout(facts({ depth: 0, kills: 0 }), 5)).toEqual({ kind: 'none' })
    expect(planPayout(facts({ mode: 'endless', depth: 0, kills: 0 }), 5)).toEqual({ kind: 'none' })
  })

  it('closes an abandoned scored Daily instead of paying it', () => {
    const daily = { kind: 'daily' as const, date: '2026-09-29', scored: true }
    expect(planPayout(facts({ depth: 0, kills: 0, challenge: daily }), 0)).toEqual({ kind: 'closeDaily', date: '2026-09-29' })
  })

  it('clamps a claimed Banner to what the save has opened (F8)', () => {
    const plan = planPayout(facts({ banner: 5 }), 1)
    expect(plan.kind === 'grant' && plan.grant.banner).toBe(1)
  })

  it('Endless settles through the same ledger, on rounds won', () => {
    expect(planPayout(facts({ mode: 'endless', wins: 7 }), 0)).toEqual({
      kind: 'grant',
      grant: { mode: 'endless', depth: 7, won: false, kills: 10 },
    })
  })

  it('a custom seed pays but is unranked', () => {
    const plan = planPayout(facts({ challenge: { kind: 'seeded', date: null, scored: false } }), 0)
    expect(plan.kind === 'grant' && plan.grant.ranked).toBe(false)
  })
})

describe('run structure helpers', () => {
  it('endless spoils: every 10th a boss, other 5ths elite', () => {
    expect(endlessRoundSpoils(3)).toMatchObject({ isBoss: false, isElite: false, dustGain: 5, lootCount: 1 })
    expect(endlessRoundSpoils(5)).toMatchObject({ isBoss: false, isElite: true, dustGain: 10, lootCount: 2 })
    expect(endlessRoundSpoils(10)).toMatchObject({ isBoss: true, isElite: false, dustGain: 20, lootCount: 3 })
    expect(endlessRoundSpoils(30).luck).toBe(0.45)
  })

  it('the Crossroads fires on each act boss, and on nothing else', () => {
    expect(forkFires({ type: 'miniboss' })).toBe(true)
    for (const t of ['battle', 'elite', 'boss', 'campfire', 'merchant']) expect(forkFires({ type: t })).toBe(false)
  })
})

describe('settle pays once (through the store)', () => {
  it('a retired run cannot be paid again, even if put back on the map (M-1)', async () => {
    const { useGameStore } = await import('../src/state/gameStore')
    const { useMetaStore } = await import('../src/state/metaStore')
    // Counted on the ledger itself: a spy on the state object would miss every
    // call after the first `set` replaces that object.
    const runs = () => useMetaStore.getState().stats.runsCompleted
    const g = () => useGameStore.getState()
    g().newRun()
    g().pickStartingHero('fighter')
    useGameStore.setState({ clearedNodeIds: [...g().clearedNodeIds, 'fake-1', 'fake-2'], runKills: 12 })
    const before = runs()
    g().returnToHub()
    expect(runs()).toBe(before + 1)
    expect(g().runSettled).toBe(true)
    // The old bug: putting `screen` back made the settled run live and payable.
    useGameStore.setState({ screen: 'map' })
    g().returnToHub()
    g().newRun()
    expect(runs()).toBe(before + 1)
  })
})

describe('spec perks (game/run/perks)', () => {
  const at = (level: number, path: string[], perks: string[] = []) => ({ level, branchPath: path, perks })

  it('owes the level-5 pick by base archetype, the level-15 pick by the evolved line', () => {
    expect(pendingPerkLevel(at(4, ['rogue']))).toBeNull()
    expect(pendingPerkLevel(at(5, ['rogue']))).toBe(5)
    // Level 15 waits for the level-10 evolution: its line is the sub-archetype.
    expect(pendingPerkLevel(at(15, ['rogue'], ['r5_ambush']))).toBeNull()
    expect(pendingPerkLevel(at(15, ['rogue', 'marksman'], ['r5_ambush']))).toBe(15)
    expect(pendingPerkLevel(at(20, ['rogue', 'marksman', 'ranger'], ['r5_ambush', 'marksman_volley']))).toBeNull()
    // A level-5 pick still owed at level 12 comes first.
    expect(pendingPerkLevel(at(12, ['rogue', 'marksman']))).toBe(5)
  })

  it('offers two per line, hides feat-locked options until opened', () => {
    const five = perkChoices(at(5, ['fighter']))
    expect(five.map((p) => p.id)).toEqual(['f5_second_wind', 'f5_last_stand'])
    expect(lockedPerkChoices(at(5, ['fighter'])).map((p) => p.id)).toEqual(['f5_riposte'])
    expect(perkChoices(at(5, ['fighter']), (id) => id === 'lone_wolf')).toHaveLength(3)
    expect(perkChoices(at(15, ['rogue', 'marksman'], ['r5_ambush'])).map((p) => p.id)).toEqual(['marksman_volley', 'marksman_deadeye'])
  })

  it('takePerk refuses anything not on offer, and appends in milestone order', () => {
    const h = at(5, ['mystic'])
    expect(takePerk(h, 'warrior_cleave')).toBeNull()
    expect(takePerk(h, 'm5_ember')).toBeNull() // locked
    expect(takePerk(h, 'm5_arc')?.perks).toEqual(['m5_arc'])
  })

  it('every line has its own perks: no id or pair is shared', () => {
    const points = allPerkPoints()
    expect(points).toHaveLength(12)
    const ids = points.flatMap((p) => p.options.map((o) => o.id))
    expect(new Set(ids).size).toBe(ids.length)
    for (const p of points) expect(p.options.filter((o) => !o.unlock)).toHaveLength(2)
  })

  it('perk mods reach the combat profile', () => {
    const base = createSentinel('rogue')
    const withPerk = { ...base, level: 5, perks: ['r5_ambush'] }
    expect(computeCombat(withPerk).mods.openingRush).toEqual({ rate: 0.7, dur: 20 })
    expect(computeCombat({ ...base, perks: ['not-a-perk'] }).dps).toBe(computeCombat(base).dps)
  })
})

describe('relics (data/relics + game/run/relics)', () => {
  it('one pool: about half rules, no plain "+x% damage", ids unique', () => {
    const ids = RELICS.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    const rules = RELICS.filter((r) => r.kind === 'rule').length
    expect(rules / RELICS.length).toBeGreaterThanOrEqual(0.45)
    for (const r of RELICS) {
      if ((r.grant?.mods?.damageMult ?? 1) > 1) expect(r.downside).toBeTruthy()
    }
  })

  it('never offers a relic whose engine capability is missing, a held one, or a locked one', () => {
    const pool = relicPool({ held: ['tithe'] })
    expect(pool.every(relicSupported)).toBe(true)
    expect(pool.some((r) => r.id === 'tithe')).toBe(false)
    expect(pool.some((r) => r.id === 'ember_urn')).toBe(ENGINE_CAPABILITIES.burnSpreadOnDeath)
    expect(pool.some((r) => r.unlock)).toBe(false)
    expect(relicPool({ unlocked: () => true }).some((r) => r.id === 'charter')).toBe(true)
  })

  it('team mods and stat grants reach the company, hires included', () => {
    expect(relicTeamMods(['warding_stone'])).toEqual([{ leakWard: 2 }])
    expect(relicTeamMods(['ember_urn'])).toEqual(ENGINE_CAPABILITIES.burnSpreadOnDeath ? [{ burnSpreadOnDeath: true }] : [])
    const s = createSentinel('fighter')
    const g = withRelicStats(s, ['ledger', 'hourglass'])
    expect(g.stats.str).toBe(s.stats.str + 3)
    expect(g.patience).toBe(s.patience + 5)
    const hired = withRecruits([], [], [s], [], ['ledger']).roster[0]
    expect(hired.stats.dex).toBe(s.stats.dex + 3)
  })

  it('run rules: surgeon, tithe, charter, seal, diary', () => {
    expect(afterFightRelics(['surgeon', 'tithe'], { baseHp: 10, maxBaseHp: 20, gold: 5 })).toEqual({ baseHp: 10 + SURGEON_HEAL, gold: 5 + TITHE_GOLD })
    expect(afterFightRelics([], { baseHp: 10, maxBaseHp: 20, gold: 5 })).toEqual({ baseHp: 10, gold: 5 })
    expect(afterFightRelics(['surgeon'], { baseHp: 20, maxBaseHp: 20, gold: 0 }).baseHp).toBe(20)
    expect(hiresTrained(false, ['charter'])).toBe(true)
    expect(hiresTrained(false, [])).toBe(false)
    expect(shelfSize(['seal'])).toBe(5)
    // Thin Pickings halves the shelf.
    expect(shelfSize([], true)).toBe(2)
    expect(shelfSize(['seal'], true)).toBe(3)
    expect(restockFree(['seal'], 0)).toBe(true)
    expect(restockFree(['seal'], 1)).toBe(false)
    const roster = [{ id: 'a', level: 9 }, { id: 'b', level: 3 }]
    const awards = diaryXp([{ id: 'a', xpGained: 100 }, { id: 'b', xpGained: 100 }], roster, ['diary'])
    expect(awards.map((x) => x.xpGained)).toEqual([100, 150])
  })

  it('the reward hand: a battle mixes, an elite always holds a relic, an act boss is all relics', () => {
    const roster = [{ archetype: 'rogue' as const }]
    for (let seed = 1; seed < 40; seed++) {
      const battle = rewardHand(streamRng(seed, 'loot'), { kind: 'battle', luck: 0.1, count: 3, held: [], roster })
      expect(battle.some((c) => c.kind === 'item')).toBe(true)
      const elite = rewardHand(streamRng(seed, 'loot'), { kind: 'elite', luck: 0.1, count: 3, held: [], roster })
      expect(elite.some((c) => c.kind === 'relic')).toBe(true)
      const boss = rewardHand(streamRng(seed, 'loot'), { kind: 'boss', luck: 0.3, count: 3, held: [], roster })
      expect(boss.every((c) => c.kind === 'relic')).toBe(true)
      expect(new Set(boss.map((c) => c.relic)).size).toBe(3)
    }
  })

  it('taking a relic card adds it once and lands its stats', () => {
    const t = { roster: [createSentinel('mystic')], inventory: [], runMods: [], lootPity: { dry: 0 }, relics: [] as string[] }
    const card: RewardCard = { id: 'r', kind: 'relic', title: '', desc: '', rarity: 'common', relic: 'ledger' }
    const once = applyRewardCard(t, card)
    expect(once.relics).toEqual(['ledger'])
    expect(once.roster[0].stats.int).toBe(t.roster[0].stats.int + 3)
    const twice = applyRewardCard(once, card)
    expect(twice.relics).toEqual(['ledger'])
    expect(twice.roster[0].stats.int).toBe(once.roster[0].stats.int)
  })
})
