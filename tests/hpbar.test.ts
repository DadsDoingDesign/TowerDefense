import { describe, expect, it } from 'vitest'
import { drawEnemyBar, enemyBarTop } from '../src/game/render/hpbar'
import { setViewScale } from '../src/game/render/frame'

/*
 * The battle draws every enemy's bar in one pass over all the bodies
 * (`renderer.drawBattleEntities`, Oct 2026 job critique), so the behaviour
 * marks read each head's top from `enemyBarTop` before the bar is drawn: it
 * must say exactly what `drawEnemyBar` will draw.
 */
const stub = () =>
  new Proxy({} as Record<string, unknown>, {
    get: (t, k) => (k in t ? t[k as string] : () => undefined),
    set: (t, k, v) => ((t[k as string] = v), true),
  }) as unknown as CanvasRenderingContext2D

describe('an enemy bar’s top, before it is drawn', () => {
  for (const vs of [0.27, 0.41, 1]) {
    it(`matches the drawn bar at view scale ${vs}`, () => {
      setViewScale(vs)
      for (const elite of [null, 'plated', 'warded', 'swift'] as const)
        for (const champion of [false, true])
          for (const bottom of [-30, -12.4, 0]) expect(drawEnemyBar(stub(), 'e1', 5, 10, 3, elite, champion, bottom)).toBe(enemyBarTop(elite, champion, bottom))
    })
  }
})
