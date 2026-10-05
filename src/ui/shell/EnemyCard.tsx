import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { enemyKind, knowledgeOf } from '../../game/data/enemyKnowledge'
import { ENEMY_TYPES } from '../../game/data/enemies'
import { pathLength } from '../../game/data/maps'
import { useGameStore } from '../../state/gameStore'
import { battleHpMult } from '../../state/game/selectors'
import { waveFirsts } from '../../state/game/runtime'
import { spawnOrder } from './enemyQueue'
import { useMetaStore } from '../../state/metaStore'
import { Icon } from '../Icon'
import { strengthShort } from '../channels'
import { enemyCardData, learnLine } from './enemyFacts'
import { EnemyPortrait } from './EnemyPortrait'

/**
 * Q10 — the enemy info card: tap a portrait in the wave strip and a small card
 * about that enemy rises above the strip. The designer asked for "a little
 * info modal on the enemy from what you know fighting them", so it is a
 * dismissable card rather than a panel — but a NON-modal one: the wave keeps
 * running under it, the field stays live, and it covers only the room it
 * needs (a 300px card sitting on the strip's top edge).
 *
 * Closes on Esc, on "Close", on a tap anywhere outside it; focus goes back to
 * the portrait it was opened from. ‹ › step through every kind in the queue,
 * so the kinds hidden behind "+N" are one tap away too.
 *
 * What it says is gated by what the Watch has learned (`knowledgeOf`); the
 * rest is "?". Numbers are the real ones — `ENEMY_TYPES` and the wave being
 * fought, Threat included — see `enemyCard.ts`.
 */

export interface EnemyCardEntry {
  typeId: string
  art: string
  count: number
}

const LEVEL_WORD = { new: 'Not met yet', met: 'Met', known: 'Known' } as const

export function EnemyCard({
  entries,
  typeId,
  countNote,
  anchor,
  onPick,
  onClose,
}: {
  /** The queue's kinds, in order — what ‹ › step through. */
  entries: readonly EnemyCardEntry[]
  typeId: string
  /** "still to come", "in this wave", "in the next sub-wave". */
  countNote: string
  /** The strip the card sits on (its top edge) and the portrait it points at. */
  anchor: { strip: HTMLElement | null; chip: HTMLElement | null }
  onPick: (typeId: string) => void
  /** `restore`: send focus back to the opener (false when a tap elsewhere should keep it). */
  onClose: (restore: boolean) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const codex = useMetaStore((s) => s.codex)
  const wave = useGameStore((s) => s.currentWave)
  const hpMult = useGameStore(battleHpMult)
  const threat = useGameStore((s) => s.threat)
  const battleMap = useGameStore((s) => s.battleMap)
  const engine = useGameStore((s) => s.engine)
  // Re-render as the wave runs, so a kill mid-wave counts on an open card.
  const hud = useGameStore((s) => s.hud)

  // The live wave's own kills of this kind: the meta tally is only written
  // when the wave settles (and the engine is dropped in the same breath).
  const kind = enemyKind(typeId)
  let live = 0
  if (engine) for (const [k, n] of engine.killsByKey) if (enemyKind(k) === kind) live += n
  // A kind this wave introduced, none of which has spawned yet, is not met.
  const notYetSeen =
    !!engine &&
    waveFirsts.kinds.has(kind) &&
    !spawnOrder(wave)
      .slice(0, hud.enemiesSpawned)
      .some((s) => enemyKind(s.typeId) === kind)
  const knowledge = knowledgeOf(typeId, codex, { felled: live, notYetSeen })
  const d = enemyCardData(typeId, {
    wave,
    hpMult,
    laneLength: battleMap ? pathLength(battleMap.path) : 0,
    knowledge,
  })

  const idx = entries.findIndex((e) => e.typeId === typeId)
  const entry = idx >= 0 ? entries[idx] : null
  const art = entry?.art ?? ENEMY_TYPES[typeId]?.id ?? typeId

  // Placement: on the strip's top edge, centred on the portrait, kept 16px
  // inside the viewport. Measured, then re-measured on resize.
  const [pos, setPos] = useState<CSSProperties>({ visibility: 'hidden' })
  useLayoutEffect(() => {
    const place = () => {
      const card = ref.current
      const strip = anchor.strip
      if (!card || !strip) return
      const s = strip.getBoundingClientRect()
      const c = anchor.chip?.isConnected ? anchor.chip.getBoundingClientRect() : s
      const vw = document.documentElement.clientWidth
      const w = card.offsetWidth
      const x = Math.max(16, Math.min(vw - 16 - w, c.left + c.width / 2 - w / 2))
      setPos({ left: Math.round(x), bottom: Math.round(window.innerHeight - s.top + 8) })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [anchor.strip, anchor.chip, typeId])

  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])

  // Esc anywhere; a tap outside the card (a portrait in the queue opens its
  // own card instead, so the queue is left to its buttons).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(true)
    }
    const onDown = (e: PointerEvent) => {
      const n = e.target as Node
      if (ref.current?.contains(n)) return
      if ((n as Element).closest?.('.sh-wq')) return
      onClose(!!ref.current?.contains(document.activeElement))
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown, { capture: true })
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown, { capture: true })
    }
  }, [onClose])

  if (!d) return null
  const unknown = <span className="sh-ec-q" aria-label="not learned yet">?</span>
  const hpText = d.hp ? (d.hp[0] === d.hp[1] ? `${d.hp[0]}` : `${d.hp[0]}–${d.hp[1]}`) : null
  const showThreat = threat > 1.001
  const step = (dir: 1 | -1) => {
    if (!entries.length) return
    const i = idx < 0 ? 0 : (idx + dir + entries.length) % entries.length
    onPick(entries[i].typeId)
  }

  return createPortal(
    <div
      ref={ref}
      className={`sh-ec lvl-${d.level}`}
      role="dialog"
      aria-modal="false"
      aria-labelledby="sh-ec-name"
      aria-describedby="sh-ec-learn"
      tabIndex={-1}
      style={pos}
      onBlur={(e) => {
        // Non-modal, so Tab may leave it — and a card nobody is on closes.
        const to = e.relatedTarget as Element | null
        if (to && !e.currentTarget.contains(to) && !to.closest('.sh-wq')) onClose(false)
      }}
    >
      <div className="sh-ec-head">
        <span className="sh-ec-art">
          <EnemyPortrait art={art} className="sh-ec-art-img" />
          {d.boss && <Icon name="boss" className="sh-ec-boss" />}
        </span>
        <div className="sh-ec-title">
          <p className="sh-ec-kicker">
            {d.boss && <>Boss · </>}
            {LEVEL_WORD[d.level]}
          </p>
          <h2 className="sh-ec-name" id="sh-ec-name">
            {d.name}
          </h2>
          <p className="sh-ec-count">{entry ? `×${entry.count} ${countNote}` : 'All on the field now'}</p>
        </div>
        <button type="button" className="sh-ec-close" data-sfx="close" onClick={() => onClose(true)}>
          Close
        </button>
      </div>

      <dl className="sh-ec-stats">
        <div>
          <dt>
            <Icon name="hp" /> HP
          </dt>
          <dd>
            {hpText ?? unknown}
            {hpText && <small> each{showThreat ? `, at enemy strength ${strengthShort(threat)}` : ''}</small>}
          </dd>
        </div>
        <div>
          <dt>
            <Icon name="haste" /> Pace
          </dt>
          <dd>
            {d.pace ? d.pace.word : unknown}
            {d.pace?.seconds != null && <small> · crosses this lane in {d.pace.seconds}s</small>}
          </dd>
        </div>
        <div>
          <dt>
            <Icon name="armour" /> Armour
          </dt>
          <dd>{d.armour.length ? d.armour.join(' · ') : 'None'}</dd>
        </div>
        <div>
          <dt>
            <Icon name="warn" /> Tricks
          </dt>
          <dd>
            {d.tricks == null
              ? unknown
              : d.tricks.length === 0
                ? 'None — it walks and it hits'
                : d.tricks.map((t) => (
                    <span className="sh-ec-trick" key={t.label}>
                      {t.label}
                      <small>Beat it: {t.counter}</small>
                    </span>
                  ))}
          </dd>
        </div>
        <div>
          <dt>
            <Icon name="base" /> Wagons
          </dt>
          <dd>
            {d.gate == null ? unknown : <>−{d.gate}<small> base HP if it gets through</small></>}
          </dd>
        </div>
      </dl>
      {d.mod && <p className="sh-ec-mod">Elite: {d.mod}.</p>}

      <div className="sh-ec-foot">
        <p className="sh-ec-learn" id="sh-ec-learn">
          {d.level === 'met' && (
            <span className="sh-ec-pips" aria-hidden="true">
              {Array.from({ length: d.need }, (_, i) => (
                <i key={i} className={i < d.felled ? 'on' : ''} />
              ))}
            </span>
          )}
          {learnLine(d)}
        </p>
        {entries.length > 1 && (
          <div className="sh-ec-nav">
            <button type="button" aria-label="Previous enemy" onClick={() => step(-1)}>
              ‹
            </button>
            <span aria-live="polite">
              {idx >= 0 ? `${idx + 1} of ${entries.length}` : `– of ${entries.length}`}
            </span>
            <button type="button" aria-label="Next enemy" onClick={() => step(1)}>
              ›
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
