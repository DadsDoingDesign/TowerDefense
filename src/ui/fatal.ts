/**
 * The one channel for "something threw where React can't see it" (H21).
 *
 * A React error boundary only catches throws inside render/lifecycle. The
 * battle loop runs inside a bare `requestAnimationFrame` callback, which is
 * outside React entirely — a throw there used to freeze the fight forever with
 * no message and no way back. Anything that catches out-of-tree it reports
 * here; a component inside the boundary re-throws it during render so the same
 * recovery UI handles both kinds of failure.
 */
type Listener = (err: Error) => void

let current: Error | null = null
const listeners = new Set<Listener>()

/** The un-cleared fatal error, if any. */
export const currentFatal = (): Error | null => current

export function subscribeFatal(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Report a failure that happened outside the React tree. The first one wins —
 * a broken rAF loop can otherwise report the same throw sixty times a second.
 */
export function reportFatal(err: unknown, where: string): void {
  if (current) return
  const e = err instanceof Error ? err : new Error(String(err))
  e.message = `[${where}] ${e.message}`
  current = e
  // Still log it: the recovery screen is for the player, the console is for us.
  console.error(e)
  for (const fn of listeners) {
    try {
      fn(e)
    } catch {
      /* a listener must not mask the original failure */
    }
  }
}

/** Clear the fault so the tree can render again after a recovery action. */
export function clearFatal(): void {
  current = null
}
