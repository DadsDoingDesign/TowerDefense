import { ARCHETYPES } from '../../game/data/sentinels'
import { useGameStore } from '../../state/gameStore'

const MAX_ROSTER = 5

/**
 * Mid-map fork: recruit a teammate, OR aim a mutation at a hero and pick one of
 * the three Mythics the fork dealt.
 *
 * This screen is the deprecated `?shell=0` build, but it had the same defect as
 * the shell: its "Roll ⟳" button called `rollHeroMutation`, which is now only a
 * deprecated alias for `aimHeroMutation`, and nothing here rendered
 * `mutationHeroId` — so the button set a field and looked broken. A dead button
 * is a dead button whichever UI it is in.
 */
export function CrossroadsScreen() {
  const cr = useGameStore((s) => s.crossroads)
  const roster = useGameStore((s) => s.roster)
  const recruit = useGameStore((s) => s.recruitTeammate)
  const aimMut = useGameStore((s) => s.aimHeroMutation)
  const chooseMut = useGameStore((s) => s.chooseHeroMutation)
  const finish = useGameStore((s) => s.finishCrossroads)
  if (!cr) return null

  if (cr.revealed) {
    const { heroName, mutation } = cr.revealed
    return (
      <div className="crossroads">
        <div className="cr-reveal">
          <span className="cr-eyebrow">Mutation taken</span>
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

  // Step two: a hero is aimed at, so the choice is which of the three to take.
  const aimed = cr.mutationHeroId ? roster.find((h) => h.id === cr.mutationHeroId) : undefined
  if (aimed) {
    return (
      <div className="crossroads">
        <div className="cr-head">
          <h1>Choose the mutation</h1>
          <p>
            Three Mythics, dealt when the fork fired — aiming at someone else does not change them. Whichever{' '}
            {aimed.name} takes is permanent, and Threat rises ×1.05 when it lands.
          </p>
        </div>
        <div className="cr-heroes">
          {cr.mutations.map((m) => {
            const held = (aimed.mutations ?? []).some((x) => x.key === m.key)
            return (
              <button key={m.id} className="cr-hero" disabled={held} onClick={() => chooseMut(aimed.id, m.id)}>
                <span className="cr-hero-info">
                  <strong>{m.name}</strong>
                  <span className="cr-sub">{m.desc}</span>
                  <span className="cr-mut-downside">
                    {held ? `${aimed.name} already carries this one.` : `Tradeoff: ${m.downside}`}
                  </span>
                </span>
                <span className="cr-roll">{held ? '—' : 'Take'}</span>
              </button>
            )
          })}
        </div>
        <button className="overlay-btn" onClick={() => aimMut(null)}>
          Pick someone else
        </button>
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
          <p className="cr-note">
            Pick who it lands on, then choose one of {cr.mutations.length} Mythic mutations. Aiming costs nothing.
          </p>
          <div className="cr-heroes">
            {roster.map((s) => {
              const m = ARCHETYPES[s.archetype]
              return (
                <button key={s.id} className="cr-hero" onClick={() => aimMut(s.id)}>
                  <img src={`assets/sprites/tinyswords/${s.archetype}.png`} alt={m.name} />
                  <span className="cr-hero-info">
                    <strong>{s.name}</strong>
                    <span className="cr-sub">
                      {m.name} · Lv {s.level}
                      {s.mutations?.length ? ` · ${s.mutations.length} mutation${s.mutations.length > 1 ? 's' : ''}` : ''}
                    </span>
                  </span>
                  <span className="cr-roll">Aim ▸</span>
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
