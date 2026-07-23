import { ARCHETYPES, createSentinel } from '../../game/data/sentinels'
import type { Archetype } from '../../game/types'
import { useGameStore } from '../../state/gameStore'

const ARCHES: Archetype[] = ['fighter', 'rogue', 'mystic']
const ROLE: Record<Archetype, string> = {
  fighter: 'Melee bruiser — holds the line and blocks enemies from slipping past.',
  rogue: 'Ranged skirmisher — fast attacks and high single-target damage.',
  mystic: 'Artificer — utility, control, and area effects to support the team.',
}
// Sample builds just to surface each archetype's opening attributes.
const SAMPLES = Object.fromEntries(ARCHES.map((a) => [a, createSentinel(a)])) as Record<
  Archetype,
  ReturnType<typeof createSentinel>
>

export function HeroPickScreen() {
  const pick = useGameStore((s) => s.pickStartingHero)
  return (
    <div className="hero-pick">
      <div className="hp-head">
        <h1>Choose your first hero</h1>
        <p>
          This hero is your starting tower. You&apos;ll recruit teammates and roll attack mutations
          as you push deeper into the map.
        </p>
      </div>
      <div className="hp-grid">
        {ARCHES.map((a) => {
          const m = ARCHETYPES[a]
          const s = SAMPLES[a]
          return (
            <button key={a} className="hp-card" onClick={() => pick(a)}>
              <div className="hp-portrait" style={{ borderColor: m.color }}>
                <img src={`assets/sprites/tinyswords/${a}.png`} alt={m.name} />
              </div>
              <strong className="hp-name" style={{ color: m.color }}>
                {m.name}
              </strong>
              <span className="hp-blurb">{m.blurb}</span>
              <div className="hp-stats">
                <span>
                  <b>{s.stats.str}</b> STR
                </span>
                <span>
                  <b>{s.stats.dex}</b> DEX
                </span>
                <span>
                  <b>{s.stats.int}</b> INT
                </span>
              </div>
              <span className="hp-role">{ROLE[a]}</span>
              <span className="hp-cta" style={{ background: m.color }}>
                Choose {m.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
