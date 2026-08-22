/**
 * Root Shell switch.
 *
 * The shell IS the game's UI — one screen, four bands (see docs/FIGMA.md).
 * `?shell=0` falls back to the pre-shell screens in `src/ui/screens/` and
 * sticks, `?shell=1` returns to the shell. The fallback exists only so the two
 * can be compared while the shell settles; it is not a supported mode.
 *
 * Storage goes through the guarded helpers: this runs during the very first
 * render, and an unguarded localStorage touch is fatal on a Safari with site
 * data blocked (H22).
 */
import { readRaw, removeRaw, writeRaw } from '../../state/storage'

const KEY = 'fieldwatch-root-shell'

export function rootShellEnabled(): boolean {
  if (typeof window === 'undefined') return true
  let param: string | null = null
  try {
    param = new URLSearchParams(window.location.search).get('shell')
  } catch {
    param = null
  }
  if (param === '0' || param === 'off') {
    writeRaw(KEY, '0')
    return false
  }
  if (param === '1' || param === 'on') {
    removeRaw(KEY)
    return true
  }
  return readRaw(KEY) !== '0'
}

/**
 * The way back from `?shell=0` (M30).
 *
 * The flag is written to localStorage and it *sticks* — that is the whole point
 * of it, so a comparison survives a reload. What it also meant is that anyone
 * who ever loaded the deprecated UI once was left in it permanently, on every
 * later visit, with no control anywhere in that UI that returned them: the only
 * way out was knowing to type `?shell=1` into the address bar. A stranding is a
 * stranding whether or not the mode is supported.
 *
 * Clearing the key and reloading is deliberate rather than a React state flip:
 * `SHELL` is read once at module scope, so the two UIs cannot swap in place.
 */
export function leaveLegacyUi(): void {
  removeRaw(KEY)
  if (typeof window === 'undefined') return
  try {
    const url = new URL(window.location.href)
    url.searchParams.delete('shell')
    window.location.replace(url.toString())
  } catch {
    window.location.reload()
  }
}
