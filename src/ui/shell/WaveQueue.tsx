import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '../Icon'
import { chipsThatFit, lineUpWords, moreCount, type LineUpEntry } from './enemyQueue'
import { EnemyCard } from './EnemyCard'
import { EnemyPortrait } from './EnemyPortrait'

/**
 * The wave strip's enemy queue (G2-2): small portraits in spawn order, next one
 * first, each with its count. It sits where the kill-progress bar was and takes
 * exactly the bar's room — no new row, no new panel.
 *
 * Q10 — tappable now. Each portrait is a button with a 44px hit area round
 * its 32px art; tapping one opens the enemy info card (`EnemyCard`) with what
 * the Watch has learned about it. "+N" counts the ENEMIES still to come after
 * the portraits (not kinds) and opens the card on the first of them; the card's
 * ‹ › reach every kind. The queue is one GROUP to assistive tech, named with
 * every kind and count — including the kinds that did not fit — so the "+N"
 * is never the only statement of what is left.
 */

export function WaveQueue({
  entries,
  lead,
  emptyText,
  countNote,
}: {
  entries: LineUpEntry[]
  /** What the accessible name opens with — "Still to come", "Next sub-wave"… */
  lead: string
  /** Shown when nothing is queued (every body is already on the field). */
  emptyText: string
  /** Q10 — the info card's count line: "still to come", "in this wave"… */
  countNote: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Q10 — the open info card: which kind, and the button that opened it.
  const [card, setCard] = useState<{ typeId: string; opener: HTMLElement } | null>(null)
  const closeCard = useCallback((restore: boolean) => {
    setCard((c) => {
      if (c && restore) {
        // Back to the portrait for the kind on the card if it is still in the
        // strip (‹ › may have moved on), else to the button that opened it.
        const root = ref.current
        const own = root?.querySelector<HTMLElement>(`[data-wq-type="${CSS.escape(c.typeId)}"]`)
        const back = own ?? (c.opener.isConnected ? c.opener : root?.querySelector<HTMLElement>('.sh-wq-more'))
        queueMicrotask(() => back?.focus({ preventScroll: true }))
      }
      return null
    })
  }, [])
  const toggle = (typeId: string, opener: HTMLElement) =>
    setCard((c) => (c && c.typeId === typeId && c.opener === opener ? null : { typeId, opener }))
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const total = entries.reduce((n, e) => n + e.count, 0)
  const cardEl = card && (
    <EnemyCard
      entries={entries}
      typeId={card.typeId}
      countNote={countNote}
      anchor={{ strip: ref.current?.closest<HTMLElement>('.sh-wavebar') ?? ref.current, chip: card.opener }}
      onPick={(typeId) => setCard((c) => (c ? { ...c, typeId } : c))}
      onClose={closeCard}
    />
  )
  if (entries.length === 0) {
    return (
      <div ref={ref} className="sh-wq empty">
        <span className="sh-wq-empty">{emptyText}</span>
        {/* Q10 — a card left open as the last body spawns stays up ("All on the field now"). */}
        {cardEl}
      </div>
    )
  }
  const shown = chipsThatFit(width, entries.length)
  const more = moreCount(entries, shown)
  const hidden = entries.slice(shown)
  return (
    <div ref={ref} className="sh-wq" role="group" aria-label={`${lead}: ${lineUpWords(entries)}.`}>
      {shown === 0 ? (
        // Narrower than one portrait: say it in words rather than clip a face.
        <span className="sh-wq-empty">{total} {total === 1 ? 'enemy' : 'enemies'}</span>
      ) : (
        <>
          {entries.slice(0, shown).map((e, i) => (
            <button
              type="button"
              className={`sh-wq-chip${i === 0 ? ' next' : ''}`}
              key={e.typeId}
              data-wq-type={e.typeId}
              data-sfx="toggle"
              title={`${e.name} ×${e.count}`}
              aria-label={`${e.name} ×${e.count} — about this enemy`}
              aria-haspopup="dialog"
              aria-expanded={card?.typeId === e.typeId}
              onClick={(ev) => toggle(e.typeId, ev.currentTarget)}
            >
              <EnemyPortrait art={e.art} />
              {e.boss && <Icon name="boss" className="sh-wq-boss" />}
              <b className="sh-wq-n">×{e.count}</b>
            </button>
          ))}
          {more > 0 && (
            <button
              type="button"
              className="sh-wq-more"
              data-sfx="toggle"
              aria-label={`${more} more ${more === 1 ? 'enemy' : 'enemies'}: ${lineUpWords(hidden)} — about them`}
              aria-haspopup="dialog"
              aria-expanded={!!card && hidden.some((h) => h.typeId === card.typeId)}
              onClick={(ev) => toggle(hidden[0].typeId, ev.currentTarget)}
            >
              +{more}
            </button>
          )}
        </>
      )}
      {cardEl}
    </div>
  )
}
