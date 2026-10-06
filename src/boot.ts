/**
 * Entry point. In the iOS app the saves have to be back in localStorage before
 * any store module evaluates (they read at import time), so the game itself is
 * loaded only after `restoreNativeSaves` settles. On the web that resolves at
 * once.
 */
import { restoreNativeSaves } from './native'

void restoreNativeSaves().finally(() => import('./main'))
