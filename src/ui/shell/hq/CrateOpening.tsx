import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ITEM_BASES } from '../../../game/data/items'
import type { PullResult } from '../../../game/run/hq'
import { fxLevel, noteFxFrame } from '../../../game/render/fxQuality'
import { sfxCrate, sfxRarity } from '../../../audio/audio'
import { itemIcon } from '../../channels'
import { Icon } from '../../Icon'
import { Pixel } from '../../pixel'
import { tapWord } from '../../pointer'
import { LEVEL_HUE } from '../codex/codexModel'
import { fx } from '../../theme/fxEngine'
import { useMenuMotion } from '../MenuScreen'
import { CRATE_MARK, CRATE_PALETTE } from './crateArt'
import { CrateStage } from './crateStage'
import {
  advance,
  BUILD_MS,
  cratePlan,
  DUPLICATE_LINE,
  flipRing,
  flipShake,
  glowAfter,
  HIT_STOP_MS,
  LAND_MS,
  DROP_MS,
  FLIP_MS,
  FLY_MS,
  revealSting,
  skipPhase,
  startPhase,
  tapPhase,
  type CrateFx,
  type CrateTier,
  type Phase,
  type RewardCard,
} from './crateSequence'

/** An item kind's icon, by its noun. */
export const kindIcon = (kind: string) => itemIcon({ name: kind, slot: ITEM_BASES[kind]?.slot ?? 'oneHand' })
const HUE: Record<CrateTier, string> = { 1: LEVEL_HUE[1], 2: LEVEL_HUE[2], 3: LEVEL_HUE[3] }

/**
 * The sealed crate's opening (Oct 2026): the one big moment on the home side
 * of the game — the crate drops in, wobbles, cracks under each tap, bursts,
 * and deals its rewards face down one at a time; each flips to its item, and
 * a Level 3 gets the big beat. Then everything won, and Collect.
 *
 * The beats and their timings are `crateSequence.ts` (pure, tested); the
 * canvas is `crateStage.ts`; the cards and the words are DOM over it. The
 * crates were opened before this mounts (`metaStore.openCrate`): it reads
 * `results` and rolls nothing.
 *
 * Skip goes straight to the summary; under reduced motion the summary just
 * fades in; on Light the beats keep and the particles halve.
 */
export function CrateOpening({ results, onDone }: { results: readonly PullResult[]; onDone: () => void }) {
  const plan = useMemo(() => cratePlan(results), [results])
  const motion = useMenuMotion()
  const fxRef = useRef<CrateFx>(motion ? fxLevel() : 'off')
  const [phase, setPhaseState] = useState<Phase>(() => startPhase(plan, fxRef.current, performance.now()))
  const phaseRef = useRef(phase)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<CrateStage | null>(null)
  const shakeRef = useRef<{ t0: number; px: number; ms: number } | null>(null)
  const landedRef = useRef(false)

  /** Enter a phase: its one-off effects and sounds, then the render. */
  const enter = (next: Phase, now: number) => {
    const prev = phaseRef.current
    phaseRef.current = next
    const st = stageRef.current
    if (next.at === 'ready' && prev.at === 'ready' && next.taps > prev.taps) {
      st?.tap(next.taps, glowAfter(next.taps, plan.best))
      sfxCrate('shake', next.taps)
    } else if (next.at === 'burst') {
      st?.burst(plan.best)
      sfxCrate('burst')
    } else if (next.at === 'card' && next.step === 'flip') {
      const tier = plan.cards[next.i].tier
      st?.flip(tier, flipRing(tier))
      sfxRarity(revealSting(tier))
      const s = flipShake(tier)
      if (s.px && fxRef.current !== 'off') shakeRef.current = { t0: now, px: fxRef.current === 'light' ? s.px / 2 : s.px, ms: s.ms }
    } else if (next.at === 'summary') st?.clearAll()
    setPhaseState(next)
  }

  const tap = () => {
    const now = performance.now()
    const next = tapPhase(phaseRef.current, plan, now)
    if (next !== phaseRef.current) enter(next, now)
  }
  const skip = () => {
    if (phaseRef.current.at !== 'summary') enter(skipPhase(performance.now()), performance.now())
  }

  // The stage and its one loop, while anything moves.
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap || fxRef.current === 'off') return
    const st = new CrateStage(canvas, HUE, () => fxRef.current)
    stageRef.current = st
    const fit = () => st.resize(wrap.clientWidth, wrap.clientHeight)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(wrap)
    if (phaseRef.current.at === 'drop') st.drop(phaseRef.current.t0, LAND_MS, DROP_MS)
    let raf = 0
    let last = 0
    const frames: number[] = []
    const draws: number[] = []
    const loop = () => {
      const now = performance.now()
      if (last) {
        const ms = now - last
        noteFxFrame(ms)
        frames.push(ms)
        if (frames.length > 600) frames.shift()
      }
      last = now
      // The device may step down to Light mid-way: the beats keep, the particles halve.
      if (fxRef.current !== 'off') fxRef.current = fxLevel() === 'off' ? 'light' : fxLevel()
      let p = phaseRef.current
      if (p.at === 'drop' && !landedRef.current && now - p.t0 >= LAND_MS) {
        landedRef.current = true
        st.land()
        sfxCrate('thud')
      }
      const n = advance(p, plan, now)
      if (n !== p) {
        enter(n, now)
        p = n
      }
      const card = p.at === 'card' ? plan.cards[p.i] : null
      const d0 = performance.now()
      st.draw(now, {
        glow: p.at === 'ready' ? glowAfter(p.taps, plan.best) : p.at === 'drop' ? 1 : plan.best,
        taps: p.at === 'ready' ? p.taps : 0,
        sealed: p.at === 'drop' || p.at === 'ready',
        crate: p.at !== 'summary',
        rays: card && p.at === 'card' && p.step !== 'fly' ? card.tier : 0,
        build: card && p.at === 'card' ? (p.step === 'build' ? Math.min(1, (now - p.t0) / BUILD_MS[card.tier]) : p.step === 'fly' ? 0 : 1) : 0,
      })
      draws.push(performance.now() - d0)
      if (draws.length > 600) draws.shift()
      // The screen shake on a big flip moves the stage and the card together.
      const s = shakeRef.current
      if (s) {
        const k = (now - s.t0) / s.ms
        if (k >= 1) {
          shakeRef.current = null
          wrap.style.transform = ''
        } else {
          const a = s.px * (1 - k)
          wrap.style.transform = `translate(${Math.round(Math.sin(now / 21) * a)}px, ${Math.round(Math.cos(now / 17) * a)}px)`
        }
      }
      if (p.at === 'summary' && !shakeRef.current) {
        st.draw(now, { glow: 1, taps: 0, sealed: false, crate: false, rays: 0, build: 0 })
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    // Dev: the frame lengths and the canvas's own cost per frame (`scripts/crate-cards.mjs` fps).
    if (import.meta.env.DEV) Object.assign(window, { __crateFrames: frames, __crateDraws: draws })
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      stageRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true })
    // The worlds' ambient loop sleeps under the opening (it is covered, and one big effect plays at a time).
    fx.hold(true)
    return () => fx.hold(false)
  }, [])

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (phaseRef.current.at === 'summary') onDone()
      else skip()
    } else if ((e.key === ' ' || e.key === 'Enter') && phaseRef.current.at !== 'summary') {
      e.preventDefault()
      tap()
    }
  }

  const n = plan.cards.length
  const card = phase.at === 'card' ? plan.cards[phase.i] : null
  const glow = phase.at === 'ready' ? glowAfter(phase.taps, plan.best) : phase.at === 'drop' ? 1 : (card?.tier ?? plan.best)
  const hint =
    phase.at === 'ready'
      ? `${tapWord()} the crate`
      : phase.at === 'card' && phase.step === 'shown'
        ? phase.i + 1 < n
          ? `${tapWord()} for the next`
          : `${tapWord()} to see all`
        : ''

  return createPortal(
    <div
      ref={rootRef}
      className={`cr-open at-${phase.at}${fxRef.current === 'off' ? ' is-still' : ''}`}
      style={{ '--cr-hue': HUE[glow], '--cr-fly': `${FLY_MS}ms`, '--cr-flip': `${FLIP_MS}ms` } as CSSProperties}
      role="dialog"
      aria-modal="true"
      aria-label={phase.at === 'summary' ? plan.title : 'Opening a sealed crate'}
      tabIndex={-1}
      onKeyDown={onKey}
      onPointerDown={(e) => {
        if (e.button !== 0 || (e.target as Element).closest('button')) return
        tap()
      }}
    >
      <div className="cr-open-stage" ref={wrapRef}>
        <canvas ref={canvasRef} className="cr-open-canvas" aria-hidden="true" />
        {card && phase.at === 'card' && <Reveal key={phase.i} card={card} step={phase.step} />}
      </div>
      {phase.at !== 'summary' && (
        <div className="cr-open-top">
          {card && n > 1 ? (
            <span className="cr-open-count" aria-label={`Reward ${(phase.at === 'card' ? phase.i : 0) + 1} of ${n}`}>
              {(phase.at === 'card' ? phase.i : 0) + 1} / {n}
            </span>
          ) : (
            <span />
          )}
          <button type="button" className="cr-skip" onClick={skip} aria-label="Skip to everything won">
            Skip <span aria-hidden="true">››</span>
          </button>
        </div>
      )}
      {hint && (
        <p key={`${phase.at}-${phase.at === 'card' ? phase.i : 0}`} className="cr-open-hint" aria-hidden="true">
          {hint}
        </p>
      )}
      {phase.at === 'summary' && <Summary title={plan.title} cards={plan.cards} onCollect={onDone} />}
    </div>,
    document.body,
  )
}

/** One reward: face down while it flies and builds up, then flipped to its item. */
function Reveal({ card, step }: { card: RewardCard; step: 'fly' | 'build' | 'flip' | 'shown' }) {
  const up = step === 'flip' || step === 'shown'
  const hold = BUILD_MS[card.tier] - HIT_STOP_MS[card.tier]
  // The held breath: the last moment of a build-up, the card dead still before it flips.
  const [still, setStill] = useState(false)
  useEffect(() => {
    if (step !== 'build' || !HIT_STOP_MS[card.tier]) return
    const t = setTimeout(() => setStill(true), hold)
    return () => clearTimeout(t)
  }, [step, card.tier, hold])
  return (
    <div
      className={`cr-card t${card.tier} is-${step}${still && step === 'build' ? ' is-still' : ''}`}
      style={{ '--lv': HUE[card.tier], '--cr-build': `${BUILD_MS[card.tier]}ms` } as CSSProperties}
      aria-live="polite"
    >
      <div className={`cr-card-in${up ? ' up' : ''}`}>
        <div className="cr-face cr-back" aria-hidden="true">
          <Pixel rows={CRATE_MARK} palette={CRATE_PALETTE} scale={5} />
        </div>
        <div className="cr-face cr-front" aria-hidden={!up}>
          <div className="cr-front-in">
            <RewardFace card={card} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** The face of a reward, as a card: its level plate, New, the icon, its name and its line. */
function RewardFace({ card }: { card: RewardCard }) {
  return (
    <>
      <span className="cr-lv" aria-hidden="true">
        {card.tier}
      </span>
      {card.isNew && <span className="cr-new">New</span>}
      <span className="cr-art" aria-hidden="true">
        <Icon name={kindIcon(card.kind)} lg />
      </span>
      <b className="cr-name">{card.kind}</b>
      <span className="cr-meta">
        {card.levelName}
        {card.slot ? ` · ${card.slot}` : ''}
      </span>
      <span className={`cr-line${card.isNew ? '' : ' dup'}`}>{card.line}</span>
    </>
  )
}

/** Everything won, as tiles, and the one CTA. */
function Summary({ title, cards, onCollect }: { title: string; cards: readonly RewardCard[]; onCollect: () => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])
  return (
    <div className="cr-sum cr-panel">
      <h2 className="cr-sum-title">{title}</h2>
      <ul className={`cr-sum-grid n${Math.min(cards.length, 5)}`}>
        {cards.map((c, i) => (
          <li key={i} className={`cr-tile t${c.tier}${c.isNew ? '' : ' dup'}`} style={{ '--lv': HUE[c.tier], '--i': i } as CSSProperties} aria-label={`${c.kind}, ${c.levelName}, ${c.isNew ? 'new' : DUPLICATE_LINE}`}>
            {c.isNew && (
              <span className="cr-new" aria-hidden="true">
                New
              </span>
            )}
            <span className="cr-tile-in" aria-hidden="true">
              <span className="cr-lv">{c.tier}</span>
              <span className="cr-art">
                <Icon name={kindIcon(c.kind)} lg />
              </span>
              <span className="cr-tile-name">{c.kind}</span>
            </span>
          </li>
        ))}
      </ul>
      {cards.some((c) => !c.isNew) && <p className="cr-note">{DUPLICATE_LINE}.</p>}
      <button ref={ref} type="button" className="pg-cta cr-collect" onClick={onCollect}>
        Collect
      </button>
    </div>
  )
}
