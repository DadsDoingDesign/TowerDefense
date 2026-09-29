import { useEffect, useRef, useState } from 'react'
import { lockedPerkChoices, pendingPerkLevel, perkChoices, perkLine } from '../../game/run/perks'
import { getNode } from '../../game/data/archetypeTree'
import { useGameStore } from '../../state/gameStore'
import { archetypeVar } from '../channels'
import { Icon } from '../Icon'
import { featName, usePerkUnlocks } from './perkUnlocks'

/**
 * The level-up perk choice (Phase 3b) — pick one of two at levels 5 and 15.
 *
 * It follows `EvolutionModal`'s contract exactly, because it is the same kind
 * of moment: a required, permanent choice that arrives after a wave. A dialog
 * with a name, focus moved in and trapped, no dismiss (the choice is owed), and
 * the heroes owing one handled one at a time. An evolution always goes first —
 * the level-15 perk is chosen from the line the level-10 evolution picks.
 *
 * Mounted beside `EvolutionModal` in `RootShell`; the Skills tab shows the same
 * choices in place (`PerkPanel`) for a player who wants to read before picking.
 */
export function PerkPicker() {
  const roster = useGameStore((s) => s.roster)
  const evolutionQueue = useGameStore((s) => s.evolutionQueue)
  const runPhase = useGameStore((s) => s.runPhase)
  const screen = useGameStore((s) => s.screen)
  const choose = useGameStore((s) => s.choosePerk)
  const unlocked = usePerkUnlocks()
  const cardRef = useRef<HTMLDivElement>(null)
  // Select, THEN confirm — the evolution dialog's contract (Phase 2): a tap
  // reads the option, the button commits it. A permanent pick is never one tap.
  const [picked, setPicked] = useState<string | null>(null)

  // Between waves only: never over a live fight, never over a finished run.
  const owed = screen !== 'battle' && runPhase === 'active' && evolutionQueue.length === 0
    ? roster.filter((s) => pendingPerkLevel(s) !== null)
    : []
  const hero = owed[0]
  const open = !!hero

  useEffect(() => {
    if (!open) return
    const card = cardRef.current
    if (!card) return
    card.focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = [...card.querySelectorAll<HTMLElement>('button:not([disabled])')]
      if (!items.length) return e.preventDefault()
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (!active || !card.contains(active)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open, hero?.id])
  useEffect(() => setPicked(null), [hero?.id])

  if (!hero) return null
  const level = pendingPerkLevel(hero)!
  const line = perkLine(hero, level)!
  const options = perkChoices(hero, unlocked)
  const locked = lockedPerkChoices(hero, unlocked)
  const chosen = options.find((p) => p.id === picked) ?? null

  return (
    <div className="overlay-scrim">
      <div
        className="overlay-card evolve perk-pick"
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="perk-title"
        aria-describedby="perk-what"
        tabIndex={-1}
      >
        <span className="evolve-kicker">
          <Icon name="boon" /> Level {level} perk
        </span>
        <h2 id="perk-title">{hero.name} learns a trick</h2>
        <p className="evolve-branch">{getNode(line).name} line</p>
        <p className="evolve-what" id="perk-what">
          Pick one. It is permanent, and it is free — gold is for the Gate and the merchant now.
        </p>
        <div className="evolve-options" role="group" aria-label="Perks">
          {options.map((p) => (
            <button
              key={p.id}
              className={`evolve-option ${picked === p.id ? 'picked' : ''}`}
              style={{ borderColor: archetypeVar(hero.archetype) }}
              aria-pressed={picked === p.id}
              onClick={() => setPicked(p.id)}
            >
              <span className="eo-name">{p.name}</span>
              <span className="eo-ability">{p.desc}</span>
            </button>
          ))}
          {locked.map((p) => (
            <button key={p.id} className="evolve-option" disabled aria-disabled="true">
              <span className="eo-name">{p.name}</span>
              <span className="eo-ability">{p.desc}</span>
              <span className="eo-grant">Locked — {featName(p.unlock!)}</span>
            </button>
          ))}
        </div>
        <button
          className="evolve-confirm"
          disabled={!chosen}
          onClick={() => {
            if (chosen) choose(hero.id, chosen.id)
          }}
        >
          {chosen ? `Learn ${chosen.name}` : 'Choose a perk'}
        </button>
        {owed.length > 1 && <p className="evolve-more">{owed.length - 1} more to choose…</p>}
      </div>
    </div>
  )
}
