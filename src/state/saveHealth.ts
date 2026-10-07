/**
 * Keeping the save alive (Lane 4.5): ask the browser to keep this site's
 * storage, and tell the player when a save is being refused.
 *
 * Both used to be missing. Browsers evict "best-effort" site storage under
 * disk pressure (Safari also after a week without a visit), and the meta bank —
 * every run's savings — lives in localStorage. And a refused write (full quota,
 * private browsing, site data blocked) was silent: the player found out on the
 * next launch, with the bank gone.
 *
 * No React here: the notice rides the shell's existing toast (`ReceiptToast`
 * in `ui/shell/PackStrip.tsx` says the store's `gearNotice` once, for six
 * seconds, in its polite status region), so no surface had to change for it.
 */
import { useGameStore } from './gameStore'
import { useMetaStore } from './metaStore'
import { onSaveFailure, type SaveFailReason } from './storage'

/** The notice's headline; one short reason follows it. */
export const SAVE_FAILED = "Progress isn't being saved on this device"

const REASON: Record<SaveFailReason, string> = {
  quota: "this browser's storage for the game is full.",
  blocked: 'private browsing, or site data is blocked.',
  error: 'the browser refused the save.',
}

/** The notice, in one line: the headline and why. */
export const saveFailedText = (reason: SaveFailReason): string => `${SAVE_FAILED}: ${REASON[reason]}`

/**
 * Put a notice in the shell's toast slot. One already waiting there (a resumed
 * save's gear, a sale) is never overwritten: this waits for it to be spent.
 */
export function postNotice(text: string, tone?: 'warn'): void {
  const store = useGameStore
  const post = () => store.setState({ gearNotice: { text, at: Date.now(), ...(tone ? { tone } : {}) } })
  if (!store.getState().gearNotice) return post()
  const off = store.subscribe((s) => {
    if (s.gearNotice) return
    off()
    post()
  })
}

interface StorageManagerLike {
  persist?: () => Promise<boolean>
  persisted?: () => Promise<boolean>
}

/**
 * Ask for persistent storage, once per session. Resolves true when storage is
 * (now) persistent, false when the browser said no, and null when it cannot
 * be asked (no StorageManager, an insecure context). Never rejects or throws.
 *
 * Already-persistent storage is not asked again, so a browser that prompts
 * (Firefox) never prompts a player who has already answered yes.
 */
let asked: Promise<boolean | null> | null = null
export function requestPersistentStorage(
  storage: StorageManagerLike | undefined = typeof navigator !== 'undefined' ? (navigator.storage as StorageManagerLike | undefined) : undefined,
): Promise<boolean | null> {
  if (asked) return asked
  asked = (async () => {
    try {
      if (!storage || typeof storage.persist !== 'function') return null
      if (typeof storage.persisted === 'function' && (await storage.persisted())) return true
      return !!(await storage.persist())
    } catch {
      return null
    }
  })()
  return asked
}

/** A run has settled: the bank changed hands, or the finished-run count moved. */
const settledSince = (
  was: { bank: number; stats: { runsCompleted: number } },
  now: { bank: number; stats: { runsCompleted: number } },
): boolean => now.stats?.runsCompleted !== was.stats?.runsCompleted || now.bank > was.bank

let installed = false

/**
 * Wire both, once, from `main.tsx`:
 *  - the session's first refused write becomes a notice (said once);
 *  - the first run that settles this session — the moment the bank first holds
 *    something worth keeping — asks for persistent storage.
 */
export function installSaveHealth(): void {
  if (installed) return
  installed = true
  onSaveFailure((f) => postNotice(saveFailedText(f.reason), 'warn'))

  let prev = useMetaStore.getState()
  const off = useMetaStore.subscribe((s) => {
    const settled = settledSince(prev, s)
    prev = s
    if (!settled) return
    off()
    void requestPersistentStorage()
  })
}

/** Test seam: forget the per-session latches. */
export function resetSaveHealthForTests(): void {
  installed = false
  asked = null
}
