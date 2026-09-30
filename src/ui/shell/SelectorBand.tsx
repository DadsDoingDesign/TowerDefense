import { useEffect, useRef, type CSSProperties } from 'react'
import { computeCombat } from '../../game/engine/combat'
import { buildName, levelProgress } from '../../game/engine/leveling'
import { DANGER_COPY, tileDamageMult } from '../../game/data/hazards'
import type { Sentinel } from '../../game/types'
import { MAX_ROSTER, useGameStore } from '../../state/gameStore'
import { archetypeVar, ARCHETYPE_GLYPH, markLabel } from '../channels'
import { Icon } from '../Icon'
import { heroArt, type Offer } from './offers'
import { tapWord } from '../pointer'
import { RarityTag } from './Page'
import { choiceOwed, levelUpOpen, rewardInPlace, useLevelUps } from './levelUps'
import { useMapFocus } from './mapFocus'
import { useShown } from './staging'

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
export function SelectorBand({ offers }: { offers: Offer[] }) {
  // G3-2: a cleared normal wave deals its reward hand into THIS row, under the
  // dimmed field, instead of sending the player to a Spoils page. The party
  // rides above it as a compact strip, so a level-up badge is still on screen.
  // `rewardInPlace` holds only in the `bands` battle context, so the invariant
  // above (bands => party) still decides everything else.
  const inPlace = useGameStore(rewardInPlace)
  if (inPlace) return <RewardSelector offers={offers} />
  return <PartySelector />
}

function PartySelector() {
  const bandRef = useRef<HTMLElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const rosterSize = useGameStore((s) => s.roster.length)

  /*
   * The overflow cue (Wave 1). With four or five heroes the row is wider than
   * a 390px screen and the last cards were simply cut off at the edge, with
   * nothing to say the row scrolled. The band carries `data-more-left/right`
   * from the live scroll position and shell.css fades that edge and draws a
   * chevron. Written as attributes straight onto the element, not React state,
   * so a scroll does not re-render the party.
   */
  useEffect(() => {
    const row = rowRef.current
    const band = bandRef.current
    if (!row || !band) return
    const update = () => {
      const max = row.scrollWidth - row.clientWidth
      band.dataset.moreLeft = row.scrollLeft > 4 ? '1' : '0'
      band.dataset.moreRight = row.scrollLeft < max - 4 ? '1' : '0'
    }
    update()
    row.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(row)
    return () => {
      row.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [rosterSize])

  return (
    <section className="sh-selector" ref={bandRef}>
      <div className="sh-selector-row" ref={rowRef}>
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
  const levelUps = useLevelUps((s) => s.heroes)
  const battleMap = useGameStore((s) => s.battleMap)
  // LS3: "recruit a hero" names a stop the first run has not reached yet.
  const recruitShown = useShown('recruit')

  const slotOf = (id: string) => Object.entries(placements).find(([, v]) => v === id)?.[0] ?? null
  const canPlace = screen === 'battle' && battlePhase === 'setup'

  return (
    <>
      {roster.map((s) => {
        const placed = !!slotOf(s.id)
        const selected = selection?.kind === 'hero' && selection.id === s.id
        const profile = computeCombat(s)
        // Q1: posted on cursed ground — the card says so, and its DPS is the cost's.
        const ground = screen === 'battle' && placed ? tileDamageMult(battleMap, slotOf(s.id)!) : 1
        const cursed = ground !== 1
        const dps = Math.round(profile.dps * ground)
        const hue = archetypeVar(s.archetype)
        const state = placed ? (cursed ? `deployed on ${DANGER_COPY.cursed.name.toLowerCase()}, ${DANGER_COPY.cursed.short}` : 'deployed') : selected && canPlace ? `selected, ${tapWord(false)} a glowing tile to post it` : 'on the bench'
        // G3-2: a level-up waiting on the roster — the card glows and wears a
        // "Lv 5 ↑" badge until it has been dealt with (see `levelUps.ts`).
        const lvlUp = levelUpOpen(levelUps[s.id], s, evolutionQueue)
        return (
          <button
            key={s.id}
            className={`sh-hero ${selected ? 'selected' : ''} ${placed ? 'placed' : ''} ${lvlUp ? 'levelled' : ''}`}
            /* Hue through a token rather than `s.color`'s raw hex, so the
               colour-vision modes can move it (M34). */
            style={{ '--rail': hue } as CSSProperties}
            aria-pressed={selected}
            aria-label={`${s.name}, ${buildName(s)} level ${s.level}, ${dps} DPS — ${state}${
              lvlUp ? `, ${levelUpWords(s, evolutionQueue)}` : evolutionQueue.includes(s.id) ? ', ready to evolve' : ''
            }`}
            onClick={() => {
              // A focused map node owns the panel (NodePreview); a levelled
              // hero's tap is an explicit ask for its level-up, so it wins.
              if (lvlUp && screen === 'map') useMapFocus.getState().focus(null)
              shellSelect({ kind: 'hero', id: s.id })
            }}
          >
            {lvlUp && <LevelBadge level={s.level} />}
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
              {evolutionQueue.includes(s.id) && !lvlUp && (
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
            <span className={`sh-hero-tag ${placed ? (cursed ? 'on cursed' : 'on') : selected && canPlace ? 'arm' : ''}`}>
              {placed ? (cursed ? 'Cursed' : 'Deployed') : selected && canPlace ? 'Place it' : `${dps} DPS`}
            </span>
          </button>
        )
      })}
      {roster.length < MAX_ROSTER && recruitShown && (
        <div className="sh-hero empty" aria-hidden>
          <span className="sh-hero-glyph ghost">+</span>
          <span className="sh-hero-name muted">Open slot</span>
          <span className="sh-hero-sub">recruit a hero</span>
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ G3-2 */

/** "levelled up to 5, a perk to choose" — the badge, in words. */
function levelUpWords(hero: Sentinel, evolutionQueue: readonly string[]): string {
  const owed = choiceOwed(hero, evolutionQueue)
  return `levelled up to ${hero.level}${owed === 'evolve' ? ', an evolution to choose' : owed === 'perk' ? ', a perk to choose' : ''}`
}

/** The roster's level-up mark. Visual only — the card's name says it in words. */
function LevelBadge({ level }: { level: number }) {
  return (
    <span className="sh-lvup" aria-hidden="true">
      Lv {level} <span className="sh-lvup-arrow">↑</span>
    </span>
  )
}

/**
 * The Selector after a cleared normal wave: the company as a compact strip
 * (so a level-up can glow where the heroes are) over the reward hand.
 *
 * The first card is preselected, so its detail and "Take it" are already in
 * the Context panel below — the one-interaction rule with the first tap done
 * for you. Tapping the selected card again keeps it: the reward's only button
 * must not vanish on a double tap.
 */
function RewardSelector({ offers }: { offers: Offer[] }) {
  const reward = useGameStore((s) => s.reward)
  const selection = useGameStore((s) => s.shellSelection)
  const cards = offers.filter((o) => reward?.some((c) => c.id === o.id))
  const firstId = cards[0]?.id ?? null

  // Preselect once per hand. Nothing selected yet is the only case: a hero or
  // a level-up the player opened is theirs to leave.
  useEffect(() => {
    if (!firstId) return
    if (useGameStore.getState().shellSelection) return
    pickReward(firstId)
  }, [firstId])

  return (
    <section className="sh-selector sh-selector-reward" aria-label="Spoils">
      <PartyStrip />
      <div className="sh-reward-row" role="group" aria-label="Spoils — take one">
        {cards.map((o) => {
          const selected = selection?.kind === 'offer' && selection.id === o.id
          return (
            <button
              key={o.id}
              className={`sh-offer sh-reward ${selected ? 'selected' : ''}`}
              style={o.color ? ({ '--rail': o.color } as CSSProperties) : undefined}
              aria-pressed={selected}
              onClick={() => pickReward(o.id)}
            >
              <span className="sh-reward-icon">
                {o.icon && <Icon name={o.icon} lg />}
                {o.mark &&
                  (markLabel(o.mark) ? (
                    <span className="sh-reward-mark" role="img" aria-label={markLabel(o.mark)}>
                      <Icon name={o.mark} />
                    </span>
                  ) : (
                    <span className="sh-reward-mark">
                      <Icon name={o.mark} />
                    </span>
                  ))}
              </span>
              <span className="sh-offer-name">{o.title}</span>
              <span className="sh-reward-sub">
                {o.rarity ? <RarityTag rarity={o.rarity} /> : null}
                {o.sub && <span className="sh-reward-scope">{o.sub}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/** Show a reward card's detail (and its "Take it") in the Context panel. */
function pickReward(id: string) {
  useLevelUps.setState({ lastReward: id })
  useGameStore.setState({ shellSelection: { kind: 'offer', id }, selectedSentinelId: null, gearSlot: null })
}

/**
 * The company in one line — portrait, name, level — while the reward hand has
 * the row. A hero with a level-up waiting glows and wears its badge; tapping
 * any hero opens it in the Context panel (its level-up, or its detail).
 */
function PartyStrip() {
  const roster = useGameStore((s) => s.roster)
  const selection = useGameStore((s) => s.shellSelection)
  const evolutionQueue = useGameStore((s) => s.evolutionQueue)
  const shellSelect = useGameStore((s) => s.shellSelect)
  const levelUps = useLevelUps((s) => s.heroes)
  return (
    <div className="sh-partystrip" role="group" aria-label="Your heroes">
      {roster.map((h) => {
        const lvlUp = levelUpOpen(levelUps[h.id], h, evolutionQueue)
        const selected = selection?.kind === 'hero' && selection.id === h.id
        return (
          <button
            key={h.id}
            className={`sh-mate ${lvlUp ? 'levelled' : ''} ${selected ? 'selected' : ''}`}
            style={{ '--rail': archetypeVar(h.archetype) } as CSSProperties}
            aria-pressed={selected}
            aria-label={`${h.name}, level ${h.level}${lvlUp ? ` — ${levelUpWords(h, evolutionQueue)}` : ''}`}
            onClick={() => shellSelect({ kind: 'hero', id: h.id })}
          >
            <span className="sh-mate-art" aria-hidden="true">
              <img src={heroArt(h.archetype)} alt="" />
            </span>
            <span className="sh-mate-name">{h.name}</span>
            {lvlUp ? <LevelBadge level={h.level} /> : <span className="sh-mate-lv">Lv {h.level}</span>}
          </button>
        )
      })}
    </div>
  )
}
