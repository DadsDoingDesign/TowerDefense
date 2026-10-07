import type { CSSProperties, ReactNode } from 'react'
import { Icon } from '../Icon'
import { RARITY } from '../../game/data/items'
import { railStyle, rarityVar } from '../channels'
import type { Offer } from './offers'
import { PickCard, PickSection, PickStrip, stepId, type PickFact, type PickTokenSpec } from './PickStrip'
import { SkillCard } from './SkillCards'

/**
 * ---------------------------------------------------------------------------
 * Heroes to choose from: pick one, then read (the hero pick, a recruit slate)
 * ---------------------------------------------------------------------------
 *
 * The designer: "its just 3 options with items and skills you have unlocked
 * applied randomly". With no class to name, a hero is read off three things —
 * what its gear makes it DO, the gear itself, and its skill.
 *
 * October 2026 (Figma "Pick one, then read"): the three stacked comparison
 * cards became a strip of three sprite tokens, each with its DPS — the one
 * deciding number, side by side — and ONE card below for the focused hero,
 * always in the same order: its look, kit and name; DPS, reach and what it
 * holds or hits; what it does; its gear as the equipment slots; its skill.
 * Flipping tokens compares them with the eye held still. A staged first run
 * holds the numbers back: its tokens say the weapon and its card the words.
 */
export function HeroCards({
  items,
  selectedId,
  onSelect,
  children,
}: {
  items: Offer[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** The terms of taking the focused hero (a full company, the strength note), at the card's foot. */
  children?: ReactNode
}) {
  const focused = items.find((o) => o.id === selectedId) ?? items[0]
  if (!focused) return null
  const h = focused.hero!
  const tokens: PickTokenSpec[] = items.map((o) => {
    const c = o.hero!
    return {
      id: o.id,
      art: <img src={c.art} alt="" />,
      label: c.facts ? 'DPS' : (o.sub ?? ''),
      value: c.facts?.dps,
      name: [o.title, o.sub, c.facts ? `${c.facts.dps} DPS` : c.does].filter(Boolean).join(', '),
      rail: c.color,
    }
  })
  const facts: PickFact[] | undefined = h.facts && [
    { label: 'DPS', value: h.facts.dps },
    { label: 'Reach', value: h.facts.reach },
    { label: h.facts.third.label, value: h.facts.third.value },
  ]

  return (
    <div className="pk rail">
      <PickStrip label="Choose one hero" tokens={tokens} focused={focused.id} onFocus={onSelect} />
      <PickCard
        className="pk-hero"
        style={railStyle(h.color) as CSSProperties}
        art={<img src={h.art} alt="" />}
        kicker={focused.sub}
        name={focused.title}
        index={items.indexOf(focused)}
        count={items.length}
        onStep={(d) => onSelect(stepId(items, focused.id, d) ?? focused.id)}
        facts={facts}
        noun="hero"
      >
        <p className="pk-does">{h.does}.</p>
        <PickSection title="Gear">
          <div className="pk-slots">
            {h.slots.map((s) => (
              <span
                key={s.slot}
                className={`pk-slot${s.piece ? '' : ' empty'}`}
                style={s.piece ? ({ '--pk-rar': rarityVar(s.piece.rarity) } as CSSProperties) : undefined}
              >
                <span className="pk-slot-box" aria-hidden="true">
                  {s.piece ? <Icon name={s.piece.icon} lg /> : '+'}
                </span>
                <span className="pk-slot-k">{s.slot}</span>
                {/* The rarity as a word for screen readers and colour-blind
                    players; the slot's frame carries the hue. */}
                <span className="pk-slot-v">{s.piece ? `${s.piece.name} · ${RARITY[s.piece.rarity].label}` : 'free'}</span>
              </span>
            ))}
          </div>
        </PickSection>
        {h.skill && <SkillCard skill={h.skill} color={h.color} />}
        {children}
      </PickCard>
    </div>
  )
}
