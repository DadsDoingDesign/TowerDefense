import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../state/gameStore'
import { cargoPct } from '../../game/run/contracts'
import { useBattleLedger } from '../battleLedger'
import { useCombatNotes } from '../../state/combatNotes'
import { battleLayoutOf } from './live'
import { choiceOwed, rewardInPlace } from './levelUps'

/** Gate hits are spoken at most this often; the latest count wins. */
const HIT_GAP_MS = 1600

/**
 * The battle's ONE polite voice (Phase 2, finding 6).
 *
 * A screen-reader player could post heroes and start a wave, and then heard
 * nothing: not the wave starting, not the Gate being hit, not the champion
 * arriving, not who levelled. Everything in a battle that the eye learns from
 * the field or a sting is said here, briefly:
 *
 *   "Depth 2 — Bombard. 14 enemies."   "Warlord Grukk has arrived."
 *   "Gate hit — 17 of 20."             "Wave cleared. 42 gold."
 *   "Doyle reached level 5."
 *
 * One region, not several: two polite regions firing on the same tick queue up
 * and read as one garbled sentence, which is why `WaveBar` gave up its own.
 * Messages that land together are joined into one utterance. Gate hits are
 * throttled — a leaking column would otherwise talk over the whole wave — and
 * always say the latest count.
 *
 * Placed off-screen rather than clipped: the project's layout audit flags any
 * 1px `overflow: hidden` box as a truncated label (see global.css), and an
 * off-screen box clips nothing.
 */
export function Announcer() {
  const [text, setText] = useState('')
  const queue = useRef<string[]>([])
  const flushT = useRef<number | null>(null)
  const lastHit = useRef(0)
  const hitT = useRef<number | null>(null)

  useEffect(() => {
    const say = (msg: string) => {
      queue.current.push(msg)
      if (flushT.current !== null) return
      flushT.current = window.setTimeout(() => {
        flushT.current = null
        const joined = queue.current.join(' ')
        queue.current = []
        // Clear first so the same sentence twice in a row is still spoken.
        setText('')
        window.setTimeout(() => setText(joined), 40)
      }, 250)
    }

    let prev = useGameStore.getState()
    const unGame = useGameStore.subscribe((s) => {
      const was = battleLayoutOf(prev)
      const now = battleLayoutOf(s)
      if (was === 'setup' && now === 'live' && s.engine && !s.waveBeat) {
        const n = s.currentWave?.spawns.length ?? 0
        say(`${s.currentWave?.label ?? 'The wave'} begins. ${n} ${n === 1 ? 'enemy' : 'enemies'}.`)
      }
      if (!prev.lastResult && s.lastResult && s.screen === 'battle') {
        const r = s.lastResult
        // G3-2: after a normal wave the reward is picked in place and a
        // level-up waits on the roster — say where both are, since the eye
        // gets there from the layout and a screen reader does not.
        const inPlace = rewardInPlace(s)
        if (r.status === 'cleared') {
          say(`Wave cleared. ${r.goldEarned} gold${r.enemiesLeaked ? `, ${r.enemiesLeaked} reached the wagons` : ''}.`)
          if (inPlace) say(`Take one of ${s.reward!.length} rewards, below the field.`)
        } else if (s.runPhase === 'active') {
          say('Wave lost.')
        }
        const start = useBattleLedger.getState().startLevels
        for (const h of s.roster) {
          if (start[h.id] === undefined || h.level <= start[h.id]) continue
          // SK1: a milestone is a skill to choose, from the hero's card.
          const owed = choiceOwed(h)
          say(`${h.name} reached level ${h.level}${owed ? ', with a skill to choose on its card' : ''}.`)
        }
      }
      prev = s
    })

    let prevL = useBattleLedger.getState()
    const unLedger = useBattleLedger.subscribe((l) => {
      if (l.champions.length > prevL.champions.length) {
        for (const c of l.champions.slice(prevL.champions.length)) say(`${c.name} has arrived.`)
      }
      if (l.hitSeq !== prevL.hitSeq && l.lastHit) {
        const speak = () => {
          hitT.current = null
          lastHit.current = Date.now()
          const h = useBattleLedger.getState().lastHit
          if (h) say(`Cargo stolen — ${cargoPct(h.gate, h.max)}% left.`)
        }
        const wait = HIT_GAP_MS - (Date.now() - lastHit.current)
        if (wait <= 0) speak()
        else if (hitT.current === null) hitT.current = window.setTimeout(speak, wait)
      }
      prevL = l
    })

    // Phase 3a: boss phases, the sub-wave breather and Watch Commands, as
    // sentences (`state/combatNotes.ts`), through this one region.
    let prevNote = useCombatNotes.getState().seq
    const unNotes = useCombatNotes.subscribe((n) => {
      if (n.seq !== prevNote && n.text) say(n.text)
      prevNote = n.seq
    })

    return () => {
      unGame()
      unLedger()
      unNotes()
      if (flushT.current !== null) window.clearTimeout(flushT.current)
      if (hitT.current !== null) window.clearTimeout(hitT.current)
    }
  }, [])

  return (
    <div className="sh-announcer" role="status" aria-live="polite" aria-atomic="true">
      {text}
    </div>
  )
}
