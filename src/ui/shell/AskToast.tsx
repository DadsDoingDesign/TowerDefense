import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useGameStore } from '../../state/gameStore'
import { announceHint } from '../../state/combatNotes'
import { companyById, type CompanyId } from '../../game/data/companies'
import { askById, askProgressText, askText, engineTally, type AskStat, type AskTally } from '../../game/run/asks'
import { companyVar } from '../channels'
import { Crest } from '../pixel'

/** What the battle toast says: whose ask, its count, and whether that met it. */
interface Tick {
  key: number
  company: CompanyId
  label: string
  count: string
  met: boolean
}

/** The stats a fight moves (the gold earned and the end's cargo and road gold move every second, or only at the end). */
const FOUGHT: ReadonlySet<AskStat> = new Set(['kills', 'burnKills', 'platedKills', 'wardedKills', 'cleanFights', 'cleanCities', 'eliteWins'])

/** Show every count of a small ask; a big tally only every few (a toast on every kill is noise). */
const stepOf = (target: number): number => Math.max(1, Math.round(target / 25))

/** How long the toast stays after its last move. */
const HOLD_MS = 2400

/**
 * The battle's ask toast (Draft 4 · A; mockup "1c"): when a fight moves the
 * count of an ask the contract carries — a Plated raider felled, a clean win,
 * an elite won — a small pill at the top edge of the Stage says whose ask and
 * where it stands ("Ironvein · Plated felled 13/25"). It takes no layout, no
 * tap (a finger lands on the field under it) and fades on its own; it stays
 * off the lane, at the Stage's edge, clear of the champion's plate and of the
 * coach's pill.
 *
 * The count is the contract's (`RunContract.asks`) plus what the live engine
 * has counted this fight (`asks.engineTally`), polled at 5 Hz the way the
 * champion's plate is — the engine is not reactive. The settle moves the
 * engine's count onto the contract in the same write that unmounts it, so
 * the sum never jumps. Visual only: the one voice (`Announcer`) says an ask
 * met, once.
 */
export function AskToast() {
  const [tick, setTick] = useState<Tick | null>(null)
  const [out, setOut] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    const read = (): Map<string, number> => {
      const st = useGameStore.getState()
      const live: AskTally = st.engine ? engineTally(st.engine) : {}
      const m = new Map<string, number>()
      for (const a of st.contract?.asks ?? []) {
        const def = askById(a.id)
        if (!def || !FOUGHT.has(def.stat)) continue
        m.set(a.id, a.got + (live[def.stat as keyof AskTally] ?? 0))
      }
      return m
    }
    let prev = read()
    const poll = () => {
      const now = read()
      const asks = useGameStore.getState().contract?.asks ?? []
      for (const [id, got] of now) {
        const was = prev.get(id) ?? got
        const a = asks.find((x) => x.id === id)
        const def = askById(id)
        if (!a || !def || got <= was || was >= a.target) continue
        const met = got >= a.target
        if (!met && Math.floor(got / stepOf(a.target)) === Math.floor(was / stepOf(a.target))) continue
        setTick((t) => ({ key: t ? t.key : Date.now(), company: def.company, label: def.label, count: askProgressText(a, got), met }))
        setOut(false)
        if (timer.current !== null) window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setOut(true), HOLD_MS)
        if (met) announceHint(`${companyById(def.company).name}'s ask met: ${askText(a)}.`)
      }
      prev = now
    }
    const iv = window.setInterval(poll, 200)
    return () => {
      window.clearInterval(iv)
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  if (!tick) return null
  const co = companyById(tick.company)
  return (
    <div
      className={`sh-asktick${tick.met ? ' met' : ''}${out ? ' out' : ''}`}
      key={tick.key}
      style={{ '--co': companyVar(tick.company) } as CSSProperties}
      aria-hidden="true"
      onTransitionEnd={() => out && setTick(null)}
    >
      <Crest company={tick.company} scale={1} />
      <span>
        {co.name} · {tick.label}
      </span>
      <b>{tick.met ? `✓ ${tick.count}` : tick.count}</b>
    </div>
  )
}
