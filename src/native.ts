/**
 * The iOS app shell (Capacitor). Everything here is a no-op on the web.
 *
 * ## Saves live in two places
 *
 * The game reads and writes localStorage synchronously (`state/storage.ts`),
 * and that stays the working copy. But inside an app WebKit treats
 * localStorage as a cache it may clear when the phone runs low on space — a
 * player would lose every unlock without warning. So in the app every write is
 * mirrored to Preferences (iOS UserDefaults, which is never purged), and at
 * launch, BEFORE any store reads its save, Preferences is copied back over
 * localStorage. Preferences is the source of truth; localStorage is rebuilt
 * from it on every launch.
 */
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { setStorageMirror } from './state/storage'

export const isNativeApp = (): boolean => Capacitor.isNativePlatform()

/** Restore saves from Preferences and start mirroring. Resolves even on failure. */
export async function restoreNativeSaves(): Promise<void> {
  if (!isNativeApp()) return
  try {
    const { keys } = await Preferences.keys()
    if (keys.length === 0) {
      // First launch of a build with the mirror: seed it from whatever
      // localStorage already holds, so nothing is lost in the handover.
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        const value = key === null ? null : localStorage.getItem(key)
        if (key !== null && value !== null) await Preferences.set({ key, value })
      }
    } else {
      for (const key of keys) {
        const { value } = await Preferences.get({ key })
        if (value !== null) localStorage.setItem(key, value)
      }
    }
  } catch (e) {
    // A save that can't be restored must not stop the game from opening.
    console.warn('Native save restore failed:', e)
  }
  setStorageMirror((key, value) => {
    const done = value === null ? Preferences.remove({ key }) : Preferences.set({ key, value })
    done.catch((e: unknown) => console.warn('Native save write failed:', e))
  })
}
