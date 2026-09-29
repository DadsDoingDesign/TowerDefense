import { useState } from 'react'
import { useGameStore } from '../../state/gameStore'
import { useMetaStore } from '../../state/metaStore'

/**
 * The run's seed on the run-start screen, and a way to type one (Phase 1).
 *
 * Deliberately tiny — one card, one field, one button, existing card classes —
 * because the UI lane restyles it. Hero-pick only: the seed decides the map
 * and the kit, so it can only change before a hero is committed, and the store
 * (`reseedRun`) refuses it anywhere else.
 */
export function RunSeed() {
  const screen = useGameStore((s) => s.screen)
  const mode = useGameStore((s) => s.mode)
  const runSeed = useGameStore((s) => s.runSeed)
  const challenge = useGameStore((s) => s.challenge)
  const reseedRun = useGameStore((s) => s.reseedRun)
  const daily = useMetaStore((s) => s.daily)
  const [text, setText] = useState('')
  if (screen !== 'heroPick' || mode !== 'campaign') return null

  const kind =
    challenge.kind === 'daily'
      ? `Daily Watch ${challenge.date} · ${daily?.date === challenge.date ? 'practice (today’s attempt is spent)' : 'scored'}`
      : challenge.kind === 'seeded'
        ? 'Custom seed · pays marks, does not unlock Banners'
        : 'Random seed'
  const submit = () => {
    if (reseedRun(text)) setText('')
  }
  return (
    <section className="pg-card" aria-label="Run seed">
      <p className="pg-card-title">Seed {runSeed}</p>
      <p className="pg-card-body">{kind}</p>
      <form
        style={{ display: 'flex', gap: 8, marginTop: 6 }}
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input
          type="text"
          value={text}
          maxLength={32}
          placeholder="Play a seed…"
          aria-label="Seed to play"
          onChange={(e) => setText(e.target.value)}
          style={{ flex: 1, minWidth: 0, minHeight: 44, font: 'inherit', padding: '0 10px' }}
        />
        <button type="submit" className="sh-seg-btn" disabled={!text.trim()} style={{ minHeight: 44 }}>
          Use seed
        </button>
      </form>
    </section>
  )
}
