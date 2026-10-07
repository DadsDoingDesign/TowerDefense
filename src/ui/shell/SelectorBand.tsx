import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { itemIcon, lookVar, railStyle } from '../channels'
import { kitName, styleWeapon, weaponName } from '../../game/data/gear'
import { lookOf } from '../../game/data/gear'
import { heroLookArt } from './offers'
import { computeCombat } from '../../game/engine/combat'
import { levelProgress } from '../../game/engine/leveling'
import { DANGER_COPY, tileDamageMult } from '../../game/data/hazards'
import type { Sentinel } from '../../game/types'
import { MAX_ROSTER, useGameStore } from '../../state/gameStore'
import { ARCHETYPE_GLYPH, markLabel } from '../channels'
import { Icon } from '../Icon'
import { type Offer } from './offers'
import { tapWord } from '../pointer'
import { RarityTag } from './Page'
import { FLASH_MS, flashLive, levelUpOpen, rewardInPlace, useLevelUps, type LevelFlash } from './levelUps'
import { useMapFocus } from './mapFocus'
import { openSlotShown } from '../../state/staging'
import { useShown, useStaged } from './staging'
import { isMelee, MELEE_LINE } from '../../game/engine/melee'
import { conflictedIds } from '../../game/run/clearance'
import { fieldConflicts } from '../../state/game/selectors'

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
  const shellSelect = useGameStore((s) => s.shellSelect)
  const screen = useGameStore((s) => s.screen)
  const battlePhase = useGameStore((s) => s.battlePhase)
  const flash = useFlashes()
  const battleMap = useGameStore((s) => s.battleMap)
  // LS3: "recruit a hero" names a stop the first run has not reached yet, and
  // the first battle is only "post a hero, start the wave".
  const recruitShown = useShown('recruit')
  const staged = useStaged()
  const openSlot = useGameStore((s) => openSlotShown(staged, recruitShown, s))

  const slotOf = (id: string) => Object.entries(placements).find(([, v]) => v === id)?.[0] ?? null
  const canPlace = screen === 'battle' && battlePhase === 'setup'
  // Weapon clearance: the card of a hero in a clearance conflict says which
  // side of it they are on, in the tag's own room (`run/clearance`). The held
  // engine is re-read on `hud` (a breather move or re-dress changes it).
  const engine = useGameStore((s) => s.engine)
  useGameStore((s) => s.hud)
  const conflicts = fieldConflicts({ screen, engine, battlePhase, roster, placements, battleMap })
  const swingers = new Set(conflicts.map((c) => c.hero.id))
  const tooClose = conflictedIds(conflicts)

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
        const hue = lookVar(s)
        const clash = swingers.has(s.id) ? 'swing' : tooClose.has(s.id) ? 'close' : null
        const state = placed ? (cursed ? `deployed on ${DANGER_COPY.cursed.name.toLowerCase()}, ${DANGER_COPY.cursed.short}` : 'deployed') : selected && canPlace ? `selected, ${tapWord(false)} a glowing tile to post it` : 'on the bench'
        // "Swings — needs clearance", in words, for whoever swings (what it holds or a skill).
        const swings = isMelee(s) ? `, ${MELEE_LINE.toLowerCase()}` : ''
        const clashWords = clash === 'swing' ? ', others too close — make space' : clash === 'close' ? ', too close to a hero that swings — move it' : ''
        // SK1: a skill choice waiting — the card glows and wears its badge
        // until the choice is made (see `levelUps.ts`). A plain level only
        // flashes "+1 level" and is gone.
        const lvlUp = levelUpOpen(s)
        return (
          <button
            key={s.id}
            className={`sh-hero ${selected ? 'selected' : ''} ${placed ? 'placed' : ''} ${lvlUp ? 'levelled' : ''}`}
            /* Hue through a token rather than `s.color`'s raw hex, so the
               colour-vision modes can move it (M34). */
            style={railStyle(hue) as CSSProperties}
            aria-pressed={selected}
            aria-label={`${s.name}, ${kitName(s)}, level ${s.level}, ${dps} DPS — ${state}${swings}${clashWords}${
              lvlUp ? `, ${levelUpWords(s)}` : ''
            }`}
            onClick={() => {
              // A focused map node owns the panel (NodePreview); a levelled
              // hero's tap is an explicit ask for its level-up, so it wins.
              if (lvlUp && screen === 'map') useMapFocus.getState().focus(null)
              shellSelect({ kind: 'hero', id: s.id })
            }}
          >
            {lvlUp ? <LevelBadge /> : <LevelFlashChip f={flash[s.id]} />}
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
              <img className="sh-hero-art" src={heroLookArt(s)} alt="" />
              <span className="sh-hero-arch">{ARCHETYPE_GLYPH[lookOf(s)]}</span>
            </span>
            <span className="sh-hero-name">{s.name}</span>
            <span className="sh-hero-sub">
              {/* The weapon it really holds — the picture it carries on the
                  field too (`render/gearMarks`), since the portrait's painted
                  weapon is the look's, not the hero's. */}
              {styleWeapon(s) && <Icon name={itemIcon(styleWeapon(s)!)} />}
              {weaponName(s)} · {s.level}
            </span>
            <span className="sh-hero-xp">
              <span className="sh-hero-xp-fill" style={{ width: `${levelProgress(s) * 100}%` }} />
            </span>
            <span className={`sh-hero-tag ${clash ? 'on clash' : placed ? (cursed ? 'on cursed' : 'on') : selected && canPlace ? 'arm' : ''}`}>
              {clash === 'swing' ? 'Make space' : clash === 'close' ? 'Too close' : placed ? (cursed ? 'Cursed' : 'Deployed') : selected && canPlace ? 'Place it' : `${dps} DPS`}
            </span>
          </button>
        )
      })}
      {roster.length < MAX_ROSTER && openSlot && (
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
function levelUpWords(hero: Sentinel): string {
  return `level ${hero.level}, a skill to choose`
}

/** The roster's skill-choice mark (SK2: only a real choice wears one). Visual only — the card's name says it in words. */
function LevelBadge() {
  return (
    <span className="sh-lvup" aria-hidden="true">
      Skill <span className="sh-lvup-arrow">↑</span>
    </span>
  )
}

/**
 * A plain level-up, said in passing (SK2): "+1 level" over the card for a
 * moment after the wave settles, then gone — nothing to clear. Visual only;
 * the Announcer says it in words.
 */
function LevelFlashChip({ f }: { f: LevelFlash | undefined }) {
  if (!f || !flashLive(f, Date.now())) return null
  const n = f.to - f.from
  return (
    <span className="sh-lvflash" aria-hidden="true" key={f.at}>
      +{n} level{n === 1 ? '' : 's'}
    </span>
  )
}

/** The live flashes, re-read when the last one should have faded. */
function useFlashes(): Record<string, LevelFlash> {
  const flash = useLevelUps((s) => s.flash)
  const [, tick] = useState(0)
  useEffect(() => {
    const ats = Object.values(flash).map((f) => f.at)
    if (!ats.length) return
    const wait = Math.max(0, Math.max(...ats) + FLASH_MS - Date.now()) + 50
    const t = setTimeout(() => tick((n) => n + 1), wait)
    return () => clearTimeout(t)
  }, [flash])
  return flash
}

/**
 * The Selector after a cleared normal wave: the company as a compact strip
 * (so a level-up can glow where the heroes are) over the reward hand.
 *
 * Select, then take. A tap on a card only READS it — its detail fills the
 * Context panel, so its stats can be compared card by card — and the take is
 * the wave strip's CTA, which names the card ("Take Cruel Bow"). Main's
 * one-tap reward (October 2026) took the card on the tap a player made to
 * look at it; the designer asked for the commit to live on the CTA alone.
 *
 * The first card is preselected, so the Context panel is never empty and the
 * CTA already names a card; tapping another moves both.
 */
function RewardSelector({ offers }: { offers: Offer[] }) {
  const reward = useGameStore((s) => s.reward)
  const selection = useGameStore((s) => s.shellSelection)
  const cards = offers.filter((o) => reward?.some((c) => c.id === o.id))
  const firstId = cards[0]?.id ?? null
  // Show the first card's detail once per hand. Nothing selected yet is the
  // only case: a hero or a level-up the player opened is theirs to leave.
  useEffect(() => {
    if (!firstId) return
    if (useGameStore.getState().shellSelection) return
    pickReward(firstId)
  }, [firstId])

  return (
    <section className="sh-selector sh-selector-reward" aria-label="Spoils">
      <PartyStrip />
      <div className="sh-reward-row" role="group" aria-label="Spoils — pick one, then take it">
        {cards.map((o) => {
          const selected = selection?.kind === 'offer' && selection.id === o.id
          const mark = o.mark ? markLabel(o.mark) : null
          return (
            <button
              key={o.id}
              className={`sh-offer sh-reward ${selected ? 'selected' : ''}`}
              style={o.color ? (railStyle(o.color) as CSSProperties) : undefined}
              // A toggle that reads the card; the strip's CTA takes it.
              aria-pressed={selected}
              aria-label={`${o.title}${mark ? `, ${mark}` : ''}`}
              data-sfx="toggle"
              onClick={() => pickReward(o.id)}
            >
              <span className="sh-reward-icon" aria-hidden="true">
                {o.icon && <Icon name={o.icon} lg />}
                {o.mark && (
                  <span className="sh-reward-mark">
                    <Icon name={o.mark} />
                  </span>
                )}
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

/** Show a reward card's detail in the Context panel, and aim the strip's "Take" at it. */
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
  const shellSelect = useGameStore((s) => s.shellSelect)
  const flash = useFlashes()
  return (
    <div className="sh-partystrip" role="group" aria-label="Your heroes">
      {roster.map((h) => {
        const lvlUp = levelUpOpen(h)
        const selected = selection?.kind === 'hero' && selection.id === h.id
        return (
          <button
            key={h.id}
            className={`sh-mate ${lvlUp ? 'levelled' : ''} ${selected ? 'selected' : ''}`}
            style={railStyle(lookVar(h)) as CSSProperties}
            aria-pressed={selected}
            aria-label={`${h.name}, level ${h.level}${lvlUp ? ` — ${levelUpWords(h)}` : ''}`}
            onClick={() => shellSelect({ kind: 'hero', id: h.id })}
          >
            <span className="sh-mate-art" aria-hidden="true">
              <img src={heroLookArt(h)} alt="" />
            </span>
            <span className="sh-mate-name">{h.name}</span>
            {lvlUp ? <LevelBadge /> : <span className="sh-mate-lv">Lv {h.level}</span>}
            {!lvlUp && <LevelFlashChip f={flash[h.id]} />}
          </button>
        )
      })}
    </div>
  )
}
