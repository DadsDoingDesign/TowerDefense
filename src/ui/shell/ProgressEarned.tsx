import type { CSSProperties } from 'react'
import { skillById, skillLevelLabel } from '../../game/data/skills'
import { itemKindById } from '../../game/data/itemKinds'
import { companyById } from '../../game/data/companies'
import { contractFloor, MAX_STANDING, standingProgress } from '../../game/run/standing'
import type { RunProgress } from '../../state/metaStore'
import { useMetaStore } from '../../state/metaStore'
import { companyVar } from '../channels'
import { Crest } from '../pixel'
import { SkillCard } from './SkillCards'

/**
 * What a finished contract did for the long game, on its receipt: every skill
 * card and item kind it unlocked — each as the card itself, labelled by what
 * paid for it (the contract, a stake milestone, a standing level) — and the
 * standing it earned with the company. Each card says only what IT does.
 */
const SLOT_WORD: Record<string, string> = { oneHand: 'Weapon', twoHand: 'Weapon', offHand: 'Off hand', body: 'Body' }

export function UnlocksEarned({ progress: p, crates }: { progress: RunProgress; crates: number }) {
  const skills = [
    ...p.contractCards.map((id, i) => ({ id, kicker: i === 0 ? 'Contract' : 'Stake milestone' })),
    ...p.standingCards.map((id, i) => ({ id, kicker: `Standing ${p.standingBefore + 1 + i}` })),
  ]
    .map((x) => ({ ...x, k: skillById(x.id) }))
    .filter((x) => !!x.k)
  const kinds = p.items.map((id, i) => ({ id, kicker: i === 0 ? 'Contract' : 'Item chance', k: itemKindById(id) })).filter((x) => !!x.k)
  const n = skills.length + kinds.length
  if (!n) return null
  const floor = contractFloor(crates)
  return (
    <section className="pg-unlocks" aria-label={`${n} new unlock${n === 1 ? '' : 's'}: ${[...skills.map((x) => x.k!.name), ...kinds.map((x) => x.id)].join(', ')}`}>
      {kinds.length > 0 && <p className="ct-eyebrow left">{kinds.length === 1 ? 'New item unlocked' : `${kinds.length} items unlocked`}</p>}
      {kinds.map((x) => (
        <SkillCard key={x.id} kicker={x.kicker} skill={{ name: x.id, level: `${SLOT_WORD[x.k!.slot]} · Level ${x.k!.level}`, text: x.k!.does }} />
      ))}
      {kinds.length > 0 && floor > 1 && (
        <p className="pg-unlocks-note">
          Your {crates} crates raised the floor: Level {floor} and up, while any are left.
        </p>
      )}
      {skills.length > 0 && <p className="ct-eyebrow left">{skills.length === 1 ? 'New skill unlocked' : `${skills.length} skills unlocked`}</p>}
      {skills.map((x) => (
        <SkillCard key={`${x.kicker}-${x.id}`} kicker={x.kicker} skill={{ name: x.k!.name, level: skillLevelLabel(x.k!.level), text: x.k!.desc }} />
      ))}
      <p className="pg-unlocks-note">Your next heroes, loot and offers can deal {n === 1 ? 'it' : 'them'}.</p>
    </section>
  )
}

/** The company's standing after the settle: the crest, the level, and what the next one opens. */
export function StandingEarned({ progress: p }: { progress: RunProgress }) {
  const xp = useMetaStore((s) => (p.company ? (s.standing[p.company] ?? 0) : 0))
  if (!p.company) return null
  const co = companyById(p.company)
  const prog = standingProgress(xp)
  const up = p.standingAfter > p.standingBefore
  return (
    <div className="ct-stand" style={{ '--co': companyVar(p.company) } as CSSProperties}>
      <Crest company={p.company} />
      <span className="ct-stand-text">
        <b>
          {co.name} · Standing {p.standingAfter}
        </b>
        <span>
          {p.unranked
            ? 'A custom seed earns no standing.'
            : up
              ? `+${p.xp} standing XP. Crate ${Math.min(8, p.standingAfter + 1)} can ride on its road.`
              : prog.max
                ? `+${p.xp} standing XP. The highest standing there is.`
                : `+${p.xp} standing XP · ${prog.need - prog.into} to Standing ${Math.min(MAX_STANDING, prog.standing + 1)}`}
        </span>
      </span>
      <span className="ct-stand-lv" aria-label={up ? `Standing ${p.standingBefore} to ${p.standingAfter}` : `Standing ${p.standingAfter}`}>
        {up ? `${p.standingBefore}→${p.standingAfter}` : p.standingAfter}
      </span>
    </div>
  )
}
