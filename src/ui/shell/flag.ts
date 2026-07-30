/**
 * Root Shell feature flag.
 *
 * The shell is a whole-app replacement for the screen-and-sheet navigation, so
 * it stays behind a flag until it is at parity. `?shell=1` turns it on and
 * sticks; `?shell=0` turns it back off. Default is off, so main ships the
 * screens it always has.
 */
const KEY = 'fieldwatch-root-shell'

export function rootShellEnabled(): boolean {
  if (typeof window === 'undefined') return false
  const param = new URLSearchParams(window.location.search).get('shell')
  if (param === '1' || param === 'on') {
    localStorage.setItem(KEY, '1')
    return true
  }
  if (param === '0' || param === 'off') {
    localStorage.removeItem(KEY)
    return false
  }
  return localStorage.getItem(KEY) === '1'
}
