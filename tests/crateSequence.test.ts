import { describe, expect, it } from 'vitest'
import { rollPull, type PullResult } from '../src/game/run/hq'
import { UNLOCK_ITEM_KINDS } from '../src/game/data/itemKinds'
import {
  advance,
  AUTO_TAP_MS,
  BUILD_MS,
  BURST_MS,
  burstCoins,
  burstParticles,
  cratePlan,
  DROP_MS,
  DUPLICATE_LINE,
  FLIP_MS,
  flipRing,
  flipShake,
  FLY_MS,
  glowAfter,
  HIT_STOP_MS,
  pacedMs,
  revealParticles,
  revealSting,
  rewardCard,
  skipPhase,
  startPhase,
  TAPS,
  tapPhase,
  type CratePlan,
  type Phase,
} from '../src/ui/shell/hq/crateSequence'
import { BADGE_MAX, crateBadge, crateShelf, OPEN_MAX } from '../src/ui/shell/hq/crateShelf'
import { CRATE_BODY, CRATE_LID, CRATE_LOOKS, CRATE_MARK, CRATE_PALETTE, LOOK_SCALE, lookFor, PLINTH, PLINTH_PALETTE } from '../src/ui/shell/hq/crateArt'
import { breathAt, HOP_EVERY_MS, HOP_MS, hopAt, idleFps, idleSparks, RATTLE_MS, rattleAt } from '../src/ui/shell/hq/crateIdle'
import { PULL_PRICE } from '../src/game/run/hq'

const r = (kind: string, level: 1 | 2 | 3, duplicate = false): PullResult => ({ kind, level, duplicate })

/** Play a plan to the summary on the clock alone (nobody taps): each phase and when it began. */
function autoplay(plan: CratePlan, tapEveryCard = true): Array<{ at: Phase['at']; step?: string; t: number }> {
  let now = 0
  let p = startPhase(plan, 'full', now)
  const log: Array<{ at: Phase['at']; step?: string; t: number }> = [{ at: p.at, t: now }]
  for (let i = 0; i < 100_000 && p.at !== 'summary'; i++) {
    now += 10
    let n = advance(p, plan, now)
    if (n === p && n.at === 'card' && n.step === 'shown' && tapEveryCard && now - n.t0 >= 1000) n = tapPhase(n, plan, now)
    if (n !== p) {
      p = n
      log.push({ at: p.at, ...(p.at === 'card' ? { step: p.step } : {}), t: now })
    }
  }
  return log
}

describe('crate opening: the plan reads the rolled result and rolls nothing', () => {
  it('orders the reveals lowest level first, the best last (stable within a level)', () => {
    const plan = cratePlan([r('A', 3), r('B', 1), r('C', 2), r('D', 1)])
    expect(plan.cards.map((c) => c.kind)).toEqual(['B', 'D', 'C', 'A'])
    expect(plan.best).toBe(3)
    expect(plan.title).toBe('From 4 crates')
    expect(cratePlan([r('B', 1)]).title).toBe('From your crate')
  })
  it('keeps every result it was given, exactly (no draw, no change)', () => {
    const have = UNLOCK_ITEM_KINDS.slice(0, 5)
    const results = [0, 1, 2].map((n) => rollPull(9, n, 11, have))
    const again = [0, 1, 2].map((n) => rollPull(9, n, 11, have))
    const plan = cratePlan(results)
    expect(results).toEqual(again)
    expect([...plan.cards.map((c) => c.kind)].sort()).toEqual(results.map((x) => x.kind).sort())
    for (const c of plan.cards) expect(c.isNew).toBe(!results.find((x) => x.kind === c.kind)!.duplicate)
  })
  it('a card names its item, its level and slot, and what it does — or what a duplicate becomes', () => {
    const kind = UNLOCK_ITEM_KINDS[0]
    const fresh = rewardCard(r(kind, 1))
    expect(fresh).toMatchObject({ kind, tier: 1, isNew: true, levelName: 'Level 1' })
    expect(fresh.line.length).toBeGreaterThan(0)
    expect(fresh.line).not.toBe(DUPLICATE_LINE)
    const dup = rewardCard(r(kind, 1, true))
    expect(dup.isNew).toBe(false)
    expect(dup.line).toBe(DUPLICATE_LINE)
    expect(DUPLICATE_LINE.length).toBeLessThanOrEqual(60) // COPY.md: an effect-length line
  })
})

describe('crate opening: the beats', () => {
  it('the glow climbs toward the best level, reaching it only at the burst', () => {
    expect([0, 1, 2, 3].map((t) => glowAfter(t, 3))).toEqual([1, 1, 2, 3])
    expect([0, 1, 2, 3].map((t) => glowAfter(t, 2))).toEqual([1, 1, 2, 2])
    expect([0, 1, 2, 3].map((t) => glowAfter(t, 1))).toEqual([1, 1, 1, 1])
  })
  it('a higher level builds up longer, bursts bigger, shakes harder; Level 3 rings gold', () => {
    expect(BUILD_MS[1]).toBeLessThan(BUILD_MS[2])
    expect(BUILD_MS[2]).toBeLessThan(BUILD_MS[3])
    for (const t of [1, 2, 3] as const) expect(HIT_STOP_MS[t]).toBeLessThan(BUILD_MS[t])
    expect(revealParticles(1, 'full')).toBeLessThan(revealParticles(2, 'full'))
    expect(revealParticles(2, 'full')).toBeLessThan(revealParticles(3, 'full'))
    expect(burstParticles(1, 'full')).toBeLessThan(burstParticles(3, 'full'))
    expect(flipShake(1).px).toBe(0)
    expect(flipShake(3).px).toBeGreaterThan(flipShake(2).px)
    expect([1, 2, 3].map((t) => flipRing(t as 1 | 2 | 3))).toEqual([false, false, true])
    expect(new Set([1, 2, 3].map((t) => revealSting(t as 1 | 2 | 3))).size).toBe(3)
  })
  it('Light keeps the beats and halves the particles; off draws none', () => {
    for (const t of [1, 2, 3] as const) {
      expect(burstParticles(t, 'light')).toBe(Math.round(burstParticles(t, 'full') / 2))
      expect(revealParticles(t, 'light')).toBe(Math.round(revealParticles(t, 'full') / 2))
      expect(burstParticles(t, 'off')).toBe(0)
    }
    expect(burstCoins('light')).toBe(burstCoins('full') / 2)
  })
  it('drop → ready → (three taps) → burst → each card fly, build, flip, shown → summary', () => {
    const plan = cratePlan([r('A', 2), r('B', 1)])
    let p = startPhase(plan, 'full', 0)
    expect(p.at).toBe('drop')
    expect(tapPhase(p, plan, 10)).toBe(p) // a tap mid-fall does nothing
    p = advance(p, plan, DROP_MS)
    expect(p.at).toBe('ready')
    for (let k = 1; k < TAPS; k++) {
      p = tapPhase(p, plan, DROP_MS + k * 100)
      expect(p).toMatchObject({ at: 'ready', taps: k })
    }
    p = tapPhase(p, plan, DROP_MS + 500)
    expect(p.at).toBe('burst')
    p = advance(p, plan, DROP_MS + 500 + BURST_MS)
    expect(p).toMatchObject({ at: 'card', i: 0, step: 'fly' })
    // A tap hurries a card to its face…
    p = tapPhase(p, plan, p.t0 + 10)
    expect(p).toMatchObject({ at: 'card', i: 0, step: 'flip' })
    p = advance(p, plan, p.t0 + FLIP_MS)
    expect(p).toMatchObject({ step: 'shown' })
    // …and waits there for the next tap.
    expect(advance(p, plan, p.t0 + 60_000)).toBe(p)
    p = tapPhase(p, plan, p.t0 + 1)
    expect(p).toMatchObject({ at: 'card', i: 1, step: 'fly' })
    p = advance(p, plan, p.t0 + FLY_MS)
    expect(p).toMatchObject({ step: 'build' })
    p = advance(p, plan, p.t0 + BUILD_MS[2])
    p = advance(p, plan, p.t0 + FLIP_MS)
    p = tapPhase(p, plan, p.t0 + 1)
    expect(p.at).toBe('summary')
  })
  it('an idle crate taps itself, so the moment never stalls', () => {
    const plan = cratePlan([r('A', 1)])
    const log = autoplay(plan)
    const ready = log.find((e) => e.at === 'ready')!
    const burst = log.find((e) => e.at === 'burst')!
    expect(burst.t - ready.t).toBeGreaterThanOrEqual(TAPS * AUTO_TAP_MS - 20)
    expect(log[log.length - 1].at).toBe('summary')
  })
  it('skip goes straight to the summary, from anywhere', () => {
    expect(skipPhase(123)).toEqual({ at: 'summary', t0: 123 })
  })
  it('reduced motion (and an empty plan) starts at the summary', () => {
    const plan = cratePlan([r('A', 3)])
    expect(startPhase(plan, 'off', 5).at).toBe('summary')
    expect(startPhase(cratePlan([]), 'full', 5).at).toBe('summary')
    expect(startPhase(plan, 'light', 5).at).toBe('drop')
  })
  it('paces one crate in 5–9 s for a player who taps along, a Level 3 longer than a Level 1', () => {
    const one = pacedMs(cratePlan([r('A', 1)]))
    const top = pacedMs(cratePlan([r('A', 3)]))
    expect(one).toBeGreaterThanOrEqual(5000)
    expect(top).toBeLessThanOrEqual(9000)
    expect(top).toBeGreaterThan(one)
  })
})

describe('crate shelf: how many the bank buys', () => {
  it('counts whole crates, opens at most OPEN_MAX at once, and badges up to 9+', () => {
    expect(crateShelf(0)).toEqual({ buys: 0, max: 0 })
    expect(crateShelf(PULL_PRICE - 1)).toEqual({ buys: 0, max: 0 })
    expect(crateShelf(PULL_PRICE * 3 + 10)).toEqual({ buys: 3, max: 3 })
    expect(crateShelf(PULL_PRICE * 40).max).toBe(OPEN_MAX)
    expect(crateShelf(Number.NaN).buys).toBe(0)
    expect(crateBadge(PULL_PRICE * 4, true)).toBe('4')
    expect(crateBadge(PULL_PRICE * 40, true)).toBe(`${BADGE_MAX}+`)
    expect(crateBadge(PULL_PRICE * 4, false)).toBeNull()
    expect(crateBadge(PULL_PRICE - 1, true)).toBeNull()
  })
})

describe('crate art', () => {
  it('every row is whole and every letter has a colour', () => {
    for (const rows of [CRATE_LID, CRATE_BODY, CRATE_MARK]) {
      const w = rows[0].length
      for (const row of rows) {
        expect(row.length).toBe(w)
        for (const ch of row) if (ch !== '.') expect(CRATE_PALETTE[ch], `'${ch}'`).toBeDefined()
      }
    }
    expect(CRATE_LID[0].length).toBe(CRATE_BODY[0].length)
  })
})

describe('the chest pass: looks and the idle (presentation only)', () => {
  it('the plinth and every look are whole, and every letter has a colour', () => {
    for (const row of PLINTH) {
      expect(row.length).toBe(PLINTH[0].length)
      for (const ch of row) if (ch !== '.') expect(PLINTH_PALETTE[ch], `'${ch}'`).toBeDefined()
    }
    for (const pal of Object.values(CRATE_LOOKS)) for (const ch of Object.keys(CRATE_PALETTE)) expect(pal[ch]).toMatch(/^#[0-9a-f]{6}$/i)
  })
  it('the chest grows with how many open at once: 1–2 wood, 3–4 iron, 5 gold', () => {
    expect([1, 2, 3, 4, 5].map(lookFor)).toEqual(['wood', 'wood', 'iron', 'iron', 'gold'])
    expect(LOOK_SCALE.wood).toBeLessThan(LOOK_SCALE.iron)
    expect(LOOK_SCALE.iron).toBeLessThan(LOOK_SCALE.gold)
    expect(HOP_EVERY_MS.gold).toBeLessThan(HOP_EVERY_MS.wood)
    expect(idleSparks('gold', 'full')).toBeGreaterThan(idleSparks('wood', 'full'))
  })
  it('Light halves the idle (sparkles and frame rate); reduced motion holds it still', () => {
    for (const l of ['wood', 'iron', 'gold'] as const) {
      expect(idleSparks(l, 'light')).toBe(Math.ceil(idleSparks(l, 'full') / 2))
      expect(idleSparks(l, 'off')).toBe(0)
    }
    expect(idleFps('light')).toBe(idleFps('full') / 2)
    expect(idleFps('off')).toBe(0)
  })
  it('a hop goes up and comes down; a rattle dies away; the breath stays in 0–1', () => {
    expect(hopAt(-1)).toEqual({ lift: 0, squash: 1 })
    expect(hopAt(HOP_MS)).toEqual({ lift: 0, squash: 1 })
    expect(hopAt(HOP_MS * 0.42).lift).toBeGreaterThan(3)
    expect(hopAt(HOP_MS * 0.85).squash).toBeLessThan(1)
    expect(rattleAt(RATTLE_MS)).toBe(0)
    expect(Math.abs(rattleAt(RATTLE_MS * 0.12))).toBeGreaterThan(0)
    for (let t = 0; t < 10_000; t += 97) {
      expect(breathAt(t)).toBeGreaterThanOrEqual(0)
      expect(breathAt(t)).toBeLessThanOrEqual(1)
    }
  })
})
