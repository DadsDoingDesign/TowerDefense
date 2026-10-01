import { useEffect, useRef } from 'react'
import { difficultyEffect, difficultyRules, MAX_DIFFICULTY } from '../../game/run/watch'
import { useGameStore } from '../../state/gameStore'
import { useMetaStore } from '../../state/metaStore'
import { difficultyAllowed } from '../../state/runTerms'

/**
 * ---------------------------------------------------------------------------
 * The difficulty picker (SK1) — what the Vow picker became
 * ---------------------------------------------------------------------------
 *
 * The designer: "each time you beat the game the difficulty goes up a bit. you
 * can turn it back down but you dont get another skill unless you beat your
 * score when you win at the same difficulty."
 *
 * A run opens at the save's top step (`beginCampaign`); this row is where it
 * is turned down — on the hero pick, the only screen the store accepts it on,
 * before any hero is committed. Choosing a step re-deals the map from the SAME
 * seed (a step turns battle nodes into elites), so switching back and forth
 * cannot reroll anything.
 *
 * Every number below is read off `difficultyRules`, so the copy cannot drift
 * from what the run does. It renders nothing until a win has raised the top
 * step, and nothing on a Daily (standard rules).
 */
export function DifficultyPicker() {
  const screen = useGameStore((s) => s.screen)
  const mode = useGameStore((s) => s.mode)
  const step = useGameStore((s) => s.runDifficulty)
  const setRunDifficulty = useGameStore((s) => s.setRunDifficulty)
  const allowed = useGameStore((s) => difficultyAllowed(s.challenge))
  const top = useMetaStore((s) => s.topDifficulty)
  const best = useMetaStore((s) => s.difficultyBest[String(step)])

  // Bring the chosen step into view: a run opens at the TOP step, which on a
  // long ladder is the chip furthest right. `scrollLeft`, not
  // `scrollIntoView` — the latter would scroll the page body too.
  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const row = rowRef.current
    const chip = row?.querySelector<HTMLElement>('.pg-banner-chip.sel')
    if (!row || !chip) return
    row.scrollLeft = Math.max(0, chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2)
  }, [step, top])

  if (screen !== 'heroPick' || mode !== 'campaign' || top < 1 || !allowed) return null

  const rules = difficultyRules(step)
  const steps = Array.from({ length: top + 1 }, (_, i) => i)
  const atTop = step >= top

  return (
    <section className="pg-banner">
      <div className="pg-banner-head">
        <span className="pg-banner-label">Difficulty</span>
        <span className="pg-banner-mult">{step === 0 ? 'standard pay' : `pays ×${rules.markMult} Marks`}</span>
      </div>

      <div className="pg-banner-row" ref={rowRef} role="group" aria-label="Choose the difficulty for this run">
        {steps.map((s) => {
          const r = difficultyRules(s)
          return (
            <button
              key={s}
              className={`pg-banner-chip ${step === s ? 'sel' : ''}`}
              aria-pressed={step === s}
              aria-label={`Difficulty ${s}${s === top ? ', your highest' : ''}. ${difficultyEffect(s)}.${s ? ` Pays ${r.markMult} times Marks.` : ''}`}
              onClick={() => setRunDifficulty(s)}
            >
              <span className="pg-banner-tier">{s}</span>
              <span className="pg-banner-name">{s === 0 ? 'Standard' : `+${Math.round((r.startThreat - 1) * 100)}% · ${r.extraElites} elite${r.extraElites === 1 ? '' : 's'}`}</span>
            </button>
          )
        })}
      </div>

      <div className="pg-card">
        <p className="pg-card-title">
          Difficulty {step}
          {atTop ? ' · your highest' : ''}
        </p>
        <p className="pg-card-body">{step === 0 ? 'Standard enemies and elites.' : `${difficultyEffect(step)} (on top of the usual).`}</p>
        <p className="pg-card-body accent">
          {atTop
            ? top < MAX_DIFFICULTY
              ? `Win here to unlock a skill and raise your highest difficulty to ${top + 1}.`
              : 'The top of the climb: every win here unlocks a skill.'
            : `Below your highest: a win unlocks a skill only if it beats your best score here${best !== undefined ? ` (${best})` : ''}.`}
        </p>
      </div>
    </section>
  )
}
