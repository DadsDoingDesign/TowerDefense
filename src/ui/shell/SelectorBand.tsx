import type { CSSProperties } from 'react'
import { computeCombat } from '../../game/engine/combat'
import { buildName, levelProgress } from '../../game/engine/leveling'
import { MAX_ROSTER, useGameStore } from '../../state/gameStore'
import { archetypeVar, ARCHETYPE_GLYPH } from '../channels'
import { Icon } from '../Icon'
import { heroArt } from './offers'

/**
 * Band 3 — the party. One tap fills the Context panel below with a hero's
 * detail. That is the only interaction the shell asks you to learn.
 *
 * ---------------------------------------------------------------------------
 * It used to branch on `ctx.selector`, and the other branch was dead
 * ---------------------------------------------------------------------------
 * The branch read `ctx.selector === 'party' ? <PartyCards/> : offers.map(...)`
 * and the else-half rendered an `OfferCard` defined below it — a SECOND,
 * divergent copy of offer-card presentation, with its own `aria-label` and its
 * own mark rendering, next to the one in `Page.tsx` that the app actually
 * draws. Two copies of the same card is how a fix lands on one of them, which
 * is precisely the defect M4 was.
 *
 * It could never run. `RootShell` early-returns for `layout: 'page'` before it
 * reaches this band, so this component only ever renders under `layout:
 * 'bands'` — and there are exactly two `bands` contexts in `useShellContext`
 * (the run map and battle), both of which carry `selector: 'party'`. Every
 * `selector: 'offers'` context is a page.
 *
 * Proven twice rather than read off the source, because line numbers have
 * drifted under this project before. Statically: 11 context literals in
 * `useShellContext`, 2 of them `bands`, 0 of those non-`party`. Live: driven
 * through all 11 reachable screen states, `.sh-offer` rendered 0 times
 * anywhere in the document, and `.sh-selector` held 4 `.sh-hero` cards in each
 * of the 3 states that produced it at all.
 *
 * So the branch and the duplicate are gone, and the invariant they depended on
 * is asserted in `useShellContext` — at the place that decides it, rather than
 * at the place that would quietly render an empty row if it stopped being true.
 */
export function SelectorBand() {
  return (
    <section className="sh-selector">
      <div className="sh-selector-row">
        <PartyCards />
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
        const hue = archetypeVar(s.archetype)
        const state = placed ? 'deployed' : selected && canPlace ? 'selected, tap a slot to post it' : 'on the bench'
        return (
          <button
            key={s.id}
            className={`sh-hero ${selected ? 'selected' : ''} ${placed ? 'placed' : ''}`}
            /* Hue through a token rather than `s.color`'s raw hex, so the
               colour-vision modes can move it (M34). */
            style={{ '--rail': hue } as CSSProperties}
            aria-pressed={selected}
            aria-label={`${s.name}, ${buildName(s)} level ${s.level}, ${Math.round(profile.dps)} DPS — ${state}${
              evolutionQueue.includes(s.id) ? ', ready to evolve' : ''
            }`}
            onClick={() => shellSelect({ kind: 'hero', id: s.id })}
          >
            {/*
              The portrait, at last.
              This was a 30x30 square of the archetype hue with a 14px `⚔`/`➶`/`❋`
              in it, while `heroArt` — one import away, and already drawn on
              hero-pick and at the Crossroads — resolves the real Tiny Swords
              sprite for the same archetype. So the roster cards you stare at for
              an entire battle were the one place in the game that showed you a
              coloured rectangle instead of your knight.
              The glyph does not go away: it sits in the corner, because the
              three sprites are three silhouettes and the mark is the channel
              that survives at 30px, on a small screen, in every colour-vision
              mode. Portrait plus mark, not portrait instead of mark.
            */}
            <span className="sh-hero-glyph" style={{ background: hue }} aria-hidden="true">
              <img className="sh-hero-art" src={heroArt(s.archetype)} alt="" />
              <span className="sh-hero-arch">{ARCHETYPE_GLYPH[s.archetype]}</span>
              {/* One concept, one mark. `★` here and `❖` on the hero panel were
                  the same "evolution ready" in two bands wearing two glyphs. */}
              {evolutionQueue.includes(s.id) && (
                <span className="sh-hero-star">
                  <Icon name="evolve" />
                </span>
              )}
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
