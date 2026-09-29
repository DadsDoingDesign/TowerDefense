import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../state/gameStore'

/**
 * Keyboard shortcuts for the battle (Phase 4, desktop / tablet layout).
 *
 *   1 / 2 / 3       battle speed
 *   Space / Enter   Start Wave
 *   C               the Watch command, when the wave strip shows one
 *   ?               this sheet; Esc closes it
 *
 * Every action goes through the SAME control a pointer would use — Start Wave
 * and the command are pressed as DOM buttons (`[data-key="start"]`,
 * `.sh-command`), speed through the store action the speed toggle calls — so a
 * shortcut can never do something the visible control would refuse, and a new
 * command button (COMBAT's `CommandSlot`) is picked up with no change here.
 *
 * Deliberately inert when the key is someone else's: a focused button, tab,
 * link or text field keeps Space / Enter (native activation), modifier chords
 * are the browser's, and while a modal dialog (the evolution choice) is open
 * only Esc/? reach this.
 *
 * The "?" button is shown only to a hover-capable fine pointer (CSS); the keys
 * work on any keyboard, including a tablet's.
 */
export function Shortcuts() {
  const [open, setOpen] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return
      const t = e.target as HTMLElement | null
      const typing = !!t?.closest('input, textarea, select, [contenteditable="true"]')
      if (typing) return
      if (e.key === '?') {
        e.preventDefault()
        setOpen((o) => !o)
        return
      }
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (document.querySelector('[aria-modal="true"]')) return
      const st = useGameStore.getState()
      if (st.screen !== 'battle') return

      if (e.key === '1' || e.key === '2' || e.key === '3') {
        st.setSpeed(Number(e.key) as 1 | 2 | 3)
        return
      }
      if (e.key === ' ' || e.key === 'Enter') {
        // A focused control owns these keys natively.
        if (t?.closest('button, a[href], [role="button"], [role="tab"], [role="radio"], summary')) return
        const start = document.querySelector<HTMLButtonElement>('[data-key="start"]:not(:disabled)')
        if (start) {
          e.preventDefault()
          start.click()
        }
        return
      }
      if (e.key === 'c' || e.key === 'C') {
        const cmd = document.querySelector<HTMLButtonElement>('.sh-command:not(:disabled)')
        if (cmd) {
          e.preventDefault()
          cmd.click()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Click outside closes the sheet; focus returns to the "?" that opened it.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const n = e.target as Node
      if (sheetRef.current?.contains(n) || btnRef.current?.contains(n)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onDown, { capture: true })
    return () => document.removeEventListener('pointerdown', onDown, { capture: true })
  }, [open])

  return (
    <div className="sh-keys">
      <button
        ref={btnRef}
        className="sh-keys-btn"
        aria-expanded={open}
        aria-controls="sh-keys-sheet"
        aria-keyshortcuts="?"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
        data-sfx="toggle"
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">?</span>
      </button>
      {open && (
        <div className="sh-keys-sheet" id="sh-keys-sheet" role="dialog" aria-label="Keyboard shortcuts" ref={sheetRef}>
          <p className="sh-keys-title">Keyboard</p>
          <dl className="sh-keys-list">
            <dt>
              <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>
            </dt>
            <dd>Battle speed</dd>
            <dt>
              <kbd>Space</kbd> <kbd>Enter</kbd>
            </dt>
            <dd>Start the wave</dd>
            <dt>
              <kbd>C</kbd>
            </dt>
            <dd>Watch command (in a wave)</dd>
            <dt>
              <kbd>?</kbd>
            </dt>
            <dd>Show or hide this</dd>
            <dt>
              <kbd>Esc</kbd>
            </dt>
            <dd>Close</dd>
          </dl>
        </div>
      )}
    </div>
  )
}
