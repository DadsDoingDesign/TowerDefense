import { create } from 'zustand'
import type { GameEngine } from '../game/engine/engine'

/**
 * Who got through, and what it cost — kept by the UI, from the engine's own
 * public state, tick by tick (Phase 2).
 *
 * The engine's `BattleResult` knows HOW MANY reached the Gate and how much Gate
 * they took, but not WHICH goblins they were, and a defeat receipt that cannot
 * name the cause teaches nothing ("Your Gate fell" — to what?). This watches
 * the same two public counters the FX differ does (`leakCount`, `baseHp`) and
 * attributes each leak to the enemies that vanished furthest down the road that
 * tick. It never touches the sim and draws no RNG.
 *
 * It also carries the two live events the announcer speaks: a Gate hit and a
 * champion's arrival.
 */
export interface LeakRow {
  name: string
  /** Bodies that reached the Gate — or, on a TNT row, charges that landed on it. */
  heads: number
  damage: number
}

interface LedgerState {
  /** The run this ledger belongs to — a new seed starts a clean one. */
  runSeed: number | null
  /** Per enemy NAME, over the whole run. */
  run: Record<string, LeakRow>
  /** Per enemy name, the current wave only. */
  wave: Record<string, LeakRow>
  /** The single hardest hit the Gate took this run. */
  worst: { name: string; damage: number } | null
  /** Bumps on every Gate hit; the announcer listens to it. */
  hitSeq: number
  lastHit: { gate: number; max: number } | null
  /** Champions that have appeared this wave, by engine id. */
  champions: { id: string; name: string }[]
  /** Each hero's level when the wave began — the ceremony's "Doyle → Lv 5". */
  startLevels: Record<string, number>
}

export const useBattleLedger = create<LedgerState>(() => ({
  runSeed: null,
  run: {},
  wave: {},
  worst: null,
  hitSeq: 0,
  lastHit: null,
  champions: [],
  startLevels: {},
}))

/** Start (or continue) the ledger for a run, and open a fresh wave. */
export function ledgerBeginWave(runSeed: number, roster: readonly { id: string; level: number }[]): void {
  const s = useBattleLedger.getState()
  const startLevels = Object.fromEntries(roster.map((h) => [h.id, h.level]))
  if (s.runSeed !== runSeed) {
    useBattleLedger.setState({ runSeed, run: {}, wave: {}, worst: null, hitSeq: 0, lastHit: null, champions: [], startLevels })
  } else {
    useBattleLedger.setState({ wave: {}, champions: [], startLevels })
  }
}

/**
 * A per-battle watcher. `before` and `after` bracket one `engine.step`; they
 * allocate nothing on a tick where nobody reached the Gate.
 */
export class LedgerWatch {
  private ids: string[] = []
  private names: string[] = []
  private dist: number[] = []
  private leakValue: number[] = []
  /** Throwers mid-wind-up at the top of the tick (a bomber, the King): their charge may land this tick. */
  private throwers: string[] = []
  private n = 0
  private leakCount = 0
  private baseHp = 0
  private seen = new Set<string>()

  constructor(engine: GameEngine) {
    this.leakCount = engine.leakCount
    this.baseHp = engine.baseHp
  }

  before(engine: GameEngine): void {
    this.leakCount = engine.leakCount
    this.baseHp = engine.baseHp
    const es = engine.enemies
    this.n = es.length
    this.throwers.length = 0
    for (let i = 0; i < es.length; i++) {
      const e = es[i]
      this.ids[i] = e.id
      this.names[i] = e.type.name
      this.dist[i] = e.distance
      this.leakValue[i] = e.type.leak
      if (e.lobUntil > 0 || e.kingUntil > 0) this.throwers.push(e.id)
    }
  }

  /**
   * Heroes have no HP, so TNT hurts the Gate: a charge that lands takes Gate
   * with no head through the line. Booked as "<thrower>'s TNT", one per charge.
   */
  private bookCharge(engine: GameEngine): void {
    const damage = Math.max(0, Math.round(this.baseHp - engine.baseHp))
    if (damage <= 0 || !this.throwers.length) return
    const landed = this.throwers.find((id) => {
      const e = engine.enemies.find((x) => x.id === id)
      return e && e.lobUntil === 0 && e.kingUntil === 0
    })
    const i = landed ? this.ids.indexOf(landed) : -1
    if (i < 0) return
    const name = `${this.names[i]}'s TNT`
    const st = useBattleLedger.getState()
    const run = { ...st.run, [name]: { name, heads: (st.run[name]?.heads ?? 0) + 1, damage: (st.run[name]?.damage ?? 0) + damage } }
    const wave = { ...st.wave, [name]: { name, heads: (st.wave[name]?.heads ?? 0) + 1, damage: (st.wave[name]?.damage ?? 0) + damage } }
    const worst = !st.worst || damage > st.worst.damage ? { name, damage } : st.worst
    useBattleLedger.setState({ run, wave, worst, hitSeq: st.hitSeq + 1, lastHit: { gate: Math.max(0, Math.ceil(engine.baseHp)), max: engine.maxBaseHp } })
  }

  after(engine: GameEngine): void {
    // Champions arriving — the only per-tick check that runs every tick, and it
    // is a flag test per enemy.
    for (const e of engine.enemies) {
      // A Colossus half (Phase 3a) is the same champion's second act, not an arrival.
      if (e.type.isBoss && !this.seen.has(e.id) && !e.type.name.endsWith('(half)')) {
        this.seen.add(e.id)
        const st = useBattleLedger.getState()
        useBattleLedger.setState({ champions: [...st.champions, { id: e.id, name: e.type.name }] })
      }
    }
    const heads = engine.leakCount - this.leakCount
    if (heads <= 0) return this.bookCharge(engine)
    const damage = Math.max(0, Math.round(this.baseHp - engine.baseHp))
    const alive = new Set(engine.enemies.map((e) => e.id))
    const gone: number[] = []
    for (let i = 0; i < this.n; i++) if (!alive.has(this.ids[i])) gone.push(i)
    gone.sort((a, b) => this.dist[b] - this.dist[a])
    const leakers = gone.slice(0, heads)
    const totalLeak = leakers.reduce((a, i) => a + this.leakValue[i], 0) || 1
    const st = useBattleLedger.getState()
    const run = { ...st.run }
    const wave = { ...st.wave }
    let worst = st.worst
    for (const i of leakers) {
      const name = this.names[i]
      const dmg = Math.round((damage * this.leakValue[i]) / totalLeak)
      run[name] = { name, heads: (run[name]?.heads ?? 0) + 1, damage: (run[name]?.damage ?? 0) + dmg }
      wave[name] = { name, heads: (wave[name]?.heads ?? 0) + 1, damage: (wave[name]?.damage ?? 0) + dmg }
      if (!worst || dmg > worst.damage) worst = { name, damage: dmg }
    }
    useBattleLedger.setState({
      run,
      wave,
      worst,
      hitSeq: st.hitSeq + 1,
      lastHit: { gate: Math.max(0, Math.ceil(engine.baseHp)), max: engine.maxBaseHp },
    })
  }
}

/** Rows sorted worst first: by Gate damage, then by heads. */
export function leakRows(rec: Record<string, LeakRow>): LeakRow[] {
  return Object.values(rec).sort((a, b) => b.damage - a.damage || b.heads - a.heads)
}
