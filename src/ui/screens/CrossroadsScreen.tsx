import { ARCHETYPES } from '../../game/data/sentinels'
import { useGameStore } from '../../state/gameStore'

const MAX_ROSTER = 5

/** Mid-map fork: recruit a teammate OR roll a random attack mutation on a hero. */
export function CrossroadsScreen() {
  const cr = useGameStore((s) => s.crossroads)
  const roster = useGameStore((s) => s.roster)
  const recruit = useGameStore((s) => s.recruitTeammate)
  const rollMut = useGameStore((s) => s.rollHeroMutation)
  const finish = useGameStore((s) => s.finishCrossroads)
  if (!cr) return null

  if (cr.revealed) {
    const { heroName, mutation } = cr.revealed
    return (
      <div className="crossroads">
        <div className="cr-reveal">
          <span className="cr-eyebrow">Mutation rolled</span>
          <h1>{heroName} mutated!</h1>
          <div className="cr-mut-card">
            <div className="cr-mut-top">
              <strong className="cr-mut-name">{mutation.name}</strong>
              <span className="cr-mut-rarity">Mythic</span>
            </div>
            <span className="cr-mut-desc">{mutation.desc}</span>
            <span className="cr-mut-downside">Tradeoff: {mutation.downside}</span>
          </div>
          <button className="overlay-btn" onClick={finish}>
            Continue
          </button>
        </div>
      </div>
    )
  }

  const rosterFull = roster.length >= MAX_ROSTER
  return (
    <div className="crossroads">
      <div className="cr-head">
        <h1>Crossroads</h1>
        <p>Halfway through the map. Strengthen your team — recruit a new hero, or mutate one you already command.</p>
      </div>
      <div className="cr-columns">
        <section className="cr-col">
          <h2>Recruit a teammate</h2>
          {rosterFull || cr.recruits.length === 0 ? (
            <p className="cr-note">Your team is full ({MAX_ROSTER}).</p>
          ) : (
            <div className="cr-recruits">
              {cr.recruits.map((s) => {
                const m = ARCHETYPES[s.archetype]
                return (
                  <button key={s.id} className="cr-recruit" onClick={() => recruit(s.id)}>
                    <img src={`assets/sprites/tinyswords/${s.archetype}.png`} alt={m.name} />
                    <strong style={{ color: m.color }}>{s.name}</strong>
                    <span className="cr-sub">{m.name}</span>
                    <span className="cr-stats">
                      {s.stats.str} / {s.stats.dex} / {s.stats.int}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <div className="cr-divider">
          <span>or</span>
        </div>

        <section className="cr-col">
          <h2>Mutate a hero</h2>
          <p className="cr-note">Rolls a random mutation that dramatically changes that hero&apos;s attack.</p>
          <div className="cr-heroes">
            {roster.map((s) => {
              const m = ARCHETYPES[s.archetype]
              return (
                <button key={s.id} className="cr-hero" onClick={() => rollMut(s.id)}>
                  <img src={`assets/sprites/tinyswords/${s.archetype}.png`} alt={m.name} />
                  <span className="cr-hero-info">
                    <strong>{s.name}</strong>
                    <span className="cr-sub">
                      {m.name} · Lv {s.level}
                      {s.mutations?.length ? ` · ${s.mutations.length} mutation${s.mutations.length > 1 ? 's' : ''}` : ''}
                    </span>
                  </span>
                  <span className="cr-roll">Roll ⟳</span>
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
