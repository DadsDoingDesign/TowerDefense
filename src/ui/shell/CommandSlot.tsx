/**
 * The live wave's command place (Phase 2 layout contract).
 *
 * The COMBAT agent's "Watch command" active ability renders here: one button,
 * at the 44px touch floor, in the live wave strip between the progress readout
 * and the speed toggle. The strip reserves nothing while this returns null, so
 * adding the button costs the progress bar its width and nothing else — the
 * strip's height (`--sh-wavebar-live-h`) is already sized for a 44px control.
 *
 * Contract (see docs/FIGMA.md § Live wave layout):
 *  - render ONE `<button className="sh-command">` (styles in shell.css), or null
 *  - the button's accessible name says what it does and its cooldown
 *  - it is only ever mounted during a live wave (`WaveBar` owns that)
 */
export function CommandSlot() {
  return null
}
