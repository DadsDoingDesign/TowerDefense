import { useState } from 'react'

/**
 * An ⓘ that opens one or more lines of reference text in place.
 *
 * A disclosure, not a tooltip: a tooltip needs hover, and every device this
 * ships to is a touchscreen. The text renders into a portal-free sibling so it
 * pushes the column down rather than covering it (rule two of the shell: nothing
 * covers anything).
 */
export function InfoToggle({ label, lines }: { label: string; lines: readonly string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={`sh-info ${open ? 'on' : ''}`}
        aria-expanded={open}
        aria-label={label}
        data-sfx="toggle"
        onClick={() => setOpen((o) => !o)}
      >
        i
      </button>
      {open && (
        <span className="sh-info-body" role="note">
          {lines.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </span>
      )}
    </>
  )
}

