import { describeMods } from '../../game/data/describe'
import { perkById, PERK_LEVELS } from '../../game/data/perks'
import { lockedPerkChoices, pendingPerkLevel, perkChoices } from '../../game/run/perks'
import type { Sentinel } from '../../game/types'
import { useGameStore } from '../../state/gameStore'
import { Icon } from '../Icon'
import { featName, usePerkUnlocks } from './perkUnlocks'

/**
 * The Skills tab's content since Phase 3b: the hero's spec perks.
 *
 * It replaced the three identical Onslaught / Tempo / Precision buy rows. What
 * a hero HAS is listed first (the perks it took, with the rule and the
 * engine's own read-out); what it OWES is offered in place, the same choices
 * the level-up picker shows; what is still AHEAD says the level it arrives at.
 * The tab's layout belongs to the shell — this is only the body.
 */
export function PerkPanel({ hero }: { hero: Sentinel }) {
  const choose = useGameStore((s) => s.choosePerk)
  const unlocked = usePerkUnlocks()
  const owed = pendingPerkLevel(hero)
  const taken = hero.perks ?? []
  return (
    <>
      {PERK_LEVELS.map((level, i) => {
        const id = taken[i]
        const perk = id ? perkById(id) : undefined
        if (perk) {
          return (
            <div className="sh-upgblock" key={level}>
              <div className="sh-upg">
                <div className="sh-upg-head">
                  <strong>{perk.name}</strong>
                  <span className="sh-line muted">Level {level}</span>
                </div>
              </div>
              <p className="sh-line">{perk.desc}</p>
              <p className="sh-line muted">{describeMods(perk.mods).join(' · ')}</p>
            </div>
          )
        }
        if (owed === level) {
          const options = perkChoices(hero, unlocked)
          const locked = lockedPerkChoices(hero, unlocked)
          return (
            <div className="sh-upgblock" key={level}>
              <p className="sh-line accent">
                <Icon name="boon" /> Level {level}: pick one — permanent, and free.
              </p>
              {options.map((p) => (
                <div className="sh-upg" key={p.id}>
                  <div className="sh-upg-head">
                    <strong>{p.name}</strong>
                  </div>
                  <button className="sh-btn small" onClick={() => choose(hero.id, p.id)} aria-label={`Take ${p.name}: ${p.desc}`}>
                    Take
                  </button>
                  <p className="sh-line muted">{p.desc}</p>
                </div>
              ))}
              {locked.map((p) => (
                <p className="sh-line muted" key={p.id}>
                  <Icon name="warn" /> {p.name} — locked, {featName(p.unlock!)}.
                </p>
              ))}
            </div>
          )
        }
        return (
          <p className="sh-line muted" key={level}>
            Level {level}: a perk choice{hero.level >= level && level > 5 ? ' — after this hero evolves at level 10' : ''}.
          </p>
        )
      })}
    </>
  )
}
