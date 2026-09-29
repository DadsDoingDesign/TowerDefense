import { beforeEach, describe, expect, it } from 'vitest'
import { legacyBannerRefund, MAX_BANNER, META_VERSION, migrateMeta, useMetaStore } from '../src/state/metaStore'

/** Banner rungs are earned by winning, not bought (Phase 1). */
describe('Banner ladder — earned, not bought', () => {
  beforeEach(() => useMetaStore.getState().resetMeta())

  const win = (banner: number, extra: { ranked?: boolean; mode?: 'campaign' | 'endless' } = {}) =>
    useMetaStore.getState().grantRunRewards({ depth: 10, won: true, kills: 0, downs: 0, banner, ...extra })

  it('an unbannered win opens Banner 1; a win under N opens N+1', () => {
    expect(useMetaStore.getState().sacrificeTier).toBe(0)
    win(0)
    expect(useMetaStore.getState().sacrificeTier).toBe(1)
    win(1)
    expect(useMetaStore.getState().sacrificeTier).toBe(2)
    win(2)
    expect(useMetaStore.getState().sacrificeTier).toBe(3)
    win(3)
    expect(useMetaStore.getState().sacrificeTier).toBe(MAX_BANNER)
  })

  it('a loss, an Endless run, or an unranked (custom-seed) win opens nothing', () => {
    useMetaStore.getState().grantRunRewards({ depth: 9, won: false, kills: 0, downs: 0, banner: 0 })
    win(0, { mode: 'endless' })
    win(0, { ranked: false })
    expect(useMetaStore.getState().sacrificeTier).toBe(0)
  })

  it('winning a LOWER rung never takes one away, and a claimed rung above the unlocked one cannot skip', () => {
    win(0)
    win(1)
    expect(useMetaStore.getState().sacrificeTier).toBe(2)
    win(0)
    expect(useMetaStore.getState().sacrificeTier).toBe(2)
    useMetaStore.getState().resetMeta()
    win(3) // hand-edited payload flying a rung this save never opened
    expect(useMetaStore.getState().sacrificeTier).toBe(1)
  })

  it('there is no way to buy a rung any more', () => {
    const s = useMetaStore.getState() as unknown as Record<string, unknown>
    expect(s.doSacrifice).toBeUndefined()
    expect(s.sacrificeCost).toBeUndefined()
  })

  it('v2 saves get every mark they spent on rungs back, and keep the rungs', () => {
    expect(legacyBannerRefund(0)).toBe(0)
    expect(legacyBannerRefund(1)).toBe(200)
    expect(legacyBannerRefund(3)).toBe(200 + 350 + 500)
    const m = migrateMeta({ watchMarks: 40, sacrificeTier: 2, upgrades: {}, stats: {} }, 2)
    expect(m.watchMarks).toBe(40 + 550)
    expect(m.sacrificeTier).toBe(2)
    // A v1 save that bought rungs 4–5 paid for them too; the tier clamps, the refund does not.
    const v1 = migrateMeta({ watchMarks: 0, sacrificeTier: 5 }, 1)
    expect(v1.watchMarks).toBe(200 + 350 + 500 + 650 + 800)
    expect(v1.sacrificeTier).toBe(MAX_BANNER)
  })

  it('the refund is paid once — never on an ordinary load of a current save', () => {
    const m = migrateMeta({ watchMarks: 40, sacrificeTier: 2 }, META_VERSION)
    expect(m.watchMarks).toBe(40)
  })
})
