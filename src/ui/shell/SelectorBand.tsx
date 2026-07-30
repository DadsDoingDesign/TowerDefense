import type { CSSProperties } from 'react'
import { computeCombat } from '../../game/engine/combat'
import { buildName, levelProgress } from '../../game/engine/leveling'
import { MAX_ROSTER, useGameStore } from '../../state/gameStore'
import type { Offer } from './offers'
import type { ShellContext } from './context'

const GLYPH: Record<string, string> = { fighter: '⚔', rogue: '✦', mystic: '❋' }

/**
 * Band 3 — the row of choosable things. Whatever is in here, one tap fills the
 * Context panel below with its detail. That is the only interaction the shell
 * asks you to learn.
 */
export function SelectorBand({ ctx, offers }: { ctx: ShellContext; offers: Offer[] }) {
  return (
    <section className="sh-selector">
      <div className="sh-selector-row">
        {ctx.selector === 'party' ? <PartyCards /> : offers.map((o) => <OfferCard key={o.id} offer={o} />)}
      </div>
    </section>
  )
}

function PartyCards() {
  const roster = useGameStore((s) => s.roster)
  const placements = useGameStore((s) => s.placements)
  const selection = useGameStore((s) => s.shellSelection)
  const evolutionQueue = useGameStore((s) => s.evolutionQueue)
  const shellSelect = useGameStore((s) => s.shellSelect)
  const screen = useGameStore((s) => s.screen)
  const battlePhase = useGameStore((s) => s.battlePhase)

  const slotOf = (id: string) => Object.entries(placements).find(([, v]) => v === id)?.[0] ?? null
  const canPlace = screen === 'battle' && battlePhase === 'setup'

  return (
    <>
      {roster.map((s) => {
        const placed = !!slotOf(s.id)
        const selected = selection?.kind === 'hero' && selection.id === s.id
        const profile = computeCombat(s)
        return (
          <button
            key={s.id}
            className={`sh-hero ${selected ? 'selected' : ''} ${placed ? 'placed' : ''}`}
            style={{ '--rail': s.color } as CSSProperties}
            onClick={() => shellSelect({ kind: 'hero', id: s.id })}
          >
            <span className="sh-hero-glyph" style={{ background: s.color }}>
              {GLYPH[s.archetype]}
              {evolutionQueue.includes(s.id) && <span className="sh-hero-star">★</span>}
            </span>
            <span className="sh-hero-name">{s.name}</span>
            <span className="sh-hero-sub">
              {buildName(s)} · {s.level}
            </span>
            <span className="sh-hero-xp">
              <span className="sh-hero-xp-fill" style={{ width: `${levelProgress(s) * 100}%` }} />
            </span>
            <span className={`sh-hero-tag ${placed ? 'on' : selected && canPlace ? 'arm' : ''}`}>
              {placed ? 'Deployed' : selected && canPlace ? 'Tap a slot' : `${Math.round(profile.dps)} DPS`}
            </span>
          </button>
        )
      })}
      {roster.length < MAX_ROSTER && (
        <div className="sh-hero empty" aria-hidden>
          <span className="sh-hero-glyph ghost">+</span>
          <span className="sh-hero-name muted">Open</span>
          <span className="sh-hero-sub">recruit</span>
        </div>
      )}
    </>
  )
}

function OfferCard({ offer }: { offer: Offer }) {
  const selection = useGameStore((s) => s.shellSelection)
  const shellSelect = useGameStore((s) => s.shellSelect)
  const selected = selection?.kind === 'offer' && selection.id === offer.id
  const CURRENCY = { gold: '⟡', dust: '◈', marks: '✦' }

  return (
    <button
      className={`sh-offer ${selected ? 'selected' : ''} ${offer.immediate ? 'nav' : ''}`}
      style={{ '--rail': offer.color ?? 'var(--line-strong)' } as CSSProperties}
      onClick={() => {
        if (offer.immediate && offer.action) offer.action.run()
        else shellSelect({ kind: 'offer', id: offer.id })
      }}
    >
      {offer.glyph && <span className="sh-offer-glyph">{offer.glyph}</span>}
      <span className="sh-offer-name" style={offer.color ? { color: offer.color } : undefined}>
        {offer.title}
      </span>
      {offer.sub && <span className="sh-offer-sub">{offer.sub}</span>}
      {offer.cost && (
        <span className="sh-offer-cost">
          {CURRENCY[offer.cost.currency]} {offer.cost.amount}
        </span>
      )}
    </button>
  )
}
