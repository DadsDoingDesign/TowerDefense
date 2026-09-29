import './overlays.css'

/**
 * Landscape handling (M36).
 *
 * The shell is four stacked bands sized for a 390×844 portrait phone. A
 * landscape phone gives it roughly 360px of height, which is not a layout
 * problem so much as a different game — and the design is explicitly
 * mobile-portrait. So rather than pretend, this says so.
 *
 * Visibility is entirely CSS (`.fw-rotate` in overlays.css): it shows only on a
 * short, phone-width landscape viewport driven by a coarse pointer. The docblock
 * used to claim desktop and tablet were left alone while the query gated on
 * orientation and height only — so a 1200x480 desktop window (a laptop with
 * devtools docked along the bottom) was blanked entirely, told to rotate a
 * screen that does not rotate, with no button anywhere to dismiss it. The
 * pointer and width conditions are what make the claim true. Nothing here runs
 * JavaScript on resize.
 */
export function RotatePrompt() {
  return (
    <div className="fw-rotate" role="status" aria-live="polite">
      <div className="fw-rotate-card">
        <div className="fw-rotate-glyph" aria-hidden="true">
          ⟲
        </div>
        <h1 className="fw-rotate-title">Turn your phone upright</h1>
        <p className="fw-rotate-body">
          Fieldwatch is built for one tall screen — the field, your company and the
          detail panel all read at once. Landscape has nowhere to put them.
        </p>
      </div>
    </div>
  )
}
