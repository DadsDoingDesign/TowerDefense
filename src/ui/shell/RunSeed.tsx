import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../state/gameStore'
import { runTerms, type RunTerms } from '../../state/runTerms'
import '../../styles/run-seed.css'

/**
 * The run's seed and terms, as one compact strip in the hero-pick header.
 *
 * It used to be a card in the scrolling body — a title, a line and a full-width
 * text field — which cost every player a screen of scroll for a control almost
 * none of them use, and on a Daily it was actively wrong: typing a seed there
 * quietly turned today's scored run into an unranked custom-seed run.
 *
 * Now it is a chip in the title block, which never scrolls:
 *  - a random run reads `Seed 93200335 ✎`; pressing it swaps the chip for a
 *    one-line editor (type or paste, Use / Cancel, Enter / Escape) in the same
 *    place, so nothing moves below it;
 *  - a custom-seed run reads `Custom seed 424242 ✎`, says in one line what a
 *    custom seed does not count for, and carries a `Random seed` chip as the
 *    way back;
 *  - a Daily reads `Daily · 2026-09-30` with a lock — fixed, not a control —
 *    beside a Scored / Practice pill, and says in plain words what picking a
 *    hero spends.
 *
 * What it says is read off `runTerms` (`state/runTerms.ts`), the same table the
 * store enforces, so this strip cannot offer what `reseedRun` refuses. It gates
 * itself (hero-pick, campaign), so any hero-pick layout can drop it into its
 * header — today's `PageScreen` and the three `?heropick=` directions all do.
 */
export function RunSeed() {
  const screen = useGameStore((s) => s.screen)
  const runSeed = useGameStore((s) => s.runSeed)
  const challenge = useGameStore((s) => s.challenge)
  if (screen !== 'heroPick') return null
  return <RunSeedStrip terms={runTerms(challenge, runSeed)} />
}

function RunSeedStrip({ terms }: { terms: RunTerms }) {
  const reseedRun = useGameStore((s) => s.reseedRun)
  const randomizeRunSeed = useGameStore((s) => s.randomizeRunSeed)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const chipRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Focus follows the editor in and back out, so a keyboard user is never
  // dropped on <body> when the chip and the form swap places.
  const wasEditing = useRef(false)
  useEffect(() => {
    if (editing) inputRef.current?.focus()
    else if (wasEditing.current) chipRef.current?.focus()
    wasEditing.current = editing
  }, [editing])

  const close = () => {
    setText('')
    setEditing(false)
  }
  const use = () => {
    if (reseedRun(text)) close()
  }

  return (
    <div className="rs" data-kind={terms.kind}>
      <div className="rs-row">
        {editing ? (
          <form
            className="rs-edit"
            onSubmit={(e) => {
              e.preventDefault()
              use()
            }}
          >
            <input
              ref={inputRef}
              className="rs-input"
              type="text"
              value={text}
              maxLength={32}
              placeholder="Type or paste a seed"
              aria-label="Seed to play: a receipt's number, or any word"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="go"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  close()
                }
              }}
            />
            <button type="submit" className="rs-btn rs-use" disabled={!text.trim()}>
              Use
            </button>
            <button type="button" className="rs-btn" onClick={close}>
              Cancel
            </button>
          </form>
        ) : terms.editable ? (
          <>
            <button
              ref={chipRef}
              type="button"
              className="rs-chip"
              aria-label={terms.seedName}
              onClick={() => setEditing(true)}
            >
              <span className="rs-chip-text">{terms.seedLabel}</span>
              <PencilMark />
            </button>
            {terms.kind === 'seeded' && (
              <button
                type="button"
                className="rs-chip rs-quiet"
                onClick={() => {
                  // This chip leaves with the custom seed; focus stays on the seed.
                  if (randomizeRunSeed()) chipRef.current?.focus()
                }}
              >
                Random seed
              </button>
            )}
          </>
        ) : (
          <>
            {/* Fixed, so it is not a control: a named image of the seed, the
                way `MenuRow` names its marks (there is no visually-hidden
                utility in this app, on purpose — see global.css). */}
            <span className="rs-chip rs-fixed" role="img" aria-label={terms.seedName}>
              <LockMark />
              <span className="rs-chip-text">{terms.seedLabel}</span>
            </span>
          </>
        )}
      </div>
      {terms.lines.length > 0 && (
        <p className="rs-terms">
          {terms.lines.map((l, i) => (
            <span key={i} className={i === 0 ? 'rs-lead' : undefined}>
              {l}
            </span>
          ))}
        </p>
      )}
    </div>
  )
}

/** 12px pencil, drawn — the shell carries no system-font glyphs (Wave 1). */
function PencilMark() {
  return (
    <svg className="rs-mark" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M8.2 1.3l2.5 2.5-6.9 6.9H1.3V8.2z M7 2.5l2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

function LockMark() {
  return (
    <svg className="rs-mark" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect x="2" y="5.2" width="8" height="5.8" rx="1" fill="currentColor" />
      <path d="M3.9 5.4V3.8a2.1 2.1 0 0 1 4.2 0v1.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}
