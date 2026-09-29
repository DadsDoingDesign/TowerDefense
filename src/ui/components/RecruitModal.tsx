import { computeCombat } from '../../game/engine/combat'
import { ARCHETYPES } from '../../game/data/sentinels'
import { MAX_ROSTER, useGameStore } from '../../state/gameStore'
import { ARCHETYPE_GLYPH as GLYPH } from '../channels'

export function RecruitModal() {
  const event = useGameStore((s) => s.event)
  const options = useGameStore((s) => s.recruitOptions)
  const roster = useGameStore((s) => s.roster)
  const accept = useGameStore((s) => s.acceptRecruit)
  const skip = useGameStore((s) => s.skipRecruit)

  if (event?.kind !== 'recruit') return null
  const full = roster.length >= MAX_ROSTER

  return (
    <div className="overlay-scrim">
      <div className="event-modal recruit">
        <div className="event-head">
          <h2>＋ Recruit a Sentinel</h2>
        </div>
        <p className="event-sub">
          {full
            ? `Your roster is full (${MAX_ROSTER}/${MAX_ROSTER}). You can only skip.`
            : `Add one to your roster (${roster.length}/${MAX_ROSTER}) or skip.`}
        </p>

        <div className="recruit-options">
          {options.map((s) => {
            const meta = ARCHETYPES[s.archetype]
            const dps = Math.round(computeCombat(s).dps)
            return (
              <button
                key={s.id}
                className="recruit-option"
                style={{ borderColor: s.color }}
                disabled={full}
                onClick={() => accept(s.id)}
              >
                <span className="ro-glyph" style={{ background: s.color }}>
                  {GLYPH[s.archetype]}
                </span>
                <span className="ro-name">{s.name}</span>
                <span className="ro-arch">{meta.name}</span>
                <span className="ro-blurb">{meta.blurb}</span>
                <span className="ro-dps">DPS {dps}</span>
              </button>
            )
          })}
        </div>

        <button className="overlay-btn ghost" onClick={skip}>
          Skip
        </button>
      </div>
    </div>
  )
}
