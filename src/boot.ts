/**
 * Entry point. In the iOS app the saves have to be back in localStorage before
 * any store module evaluates (they read at import time), so the game itself is
 * loaded only after `restoreNativeSaves` settles. On the web that resolves at
 * once.
 *
 * The base stylesheet (tokens, @font-face) is imported HERE, not only in
 * `main.tsx`, so Vite still links it from `index.html`: the boot splash is set
 * in Crimson Text and the first paint is styled before the game chunk arrives.
 */
import './styles/global.css'
import { restoreNativeSaves } from './native'

void restoreNativeSaves().finally(() => import('./main'))
