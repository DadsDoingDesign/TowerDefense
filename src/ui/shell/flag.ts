/**
 * Root Shell switch.
 *
 * The shell IS the game's UI — one screen, four bands (see docs/FIGMA.md).
 * `?shell=0` falls back to the pre-shell screens in `src/ui/screens/` and
 * sticks, `?shell=1` returns to the shell. The fallback exists only so the two
 * can be compared while the shell settles; it is not a supported mode.
 */
const KEY = 'fieldwatch-root-shell'

export function rootShellEnabled(): boolean {
  if (typeof window === 'undefined') return true
  const param = new URLSearchParams(window.location.search).get('shell')
  if (param === '0' || param === 'off') {
    localStorage.setItem(KEY, '0')
    return false
  }
  if (param === '1' || param === 'on') {
    localStorage.removeItem(KEY)
    return true
  }
  return localStorage.getItem(KEY) !== '0'
}
