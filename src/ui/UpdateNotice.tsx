import { useSyncExternalStore } from 'react'
import { applyUpdate, isUpdateReady, onUpdateReady } from '../pwa'
import { useGameStore } from '../state/gameStore'
import './overlays.css'

/**
 * "A new version is ready" — non-blocking, and only at the Watchtower.
 *
 * The new service worker waits rather than taking over a running page (see
 * `src/pwa.ts`). This is the one place the app offers to switch now: the hub,
 * where no wave is live and a reload loses nothing. Ignoring it is fine — the
 * update also applies on its own the next time the game is launched.
 */
export function UpdateNotice() {
  const ready = useSyncExternalStore(onUpdateReady, isUpdateReady, () => false)
  const atHub = useGameStore((s) => s.screen === 'hub')
  if (!ready || !atHub) return null
  return (
    <div className="fw-update" role="status">
      <span>New version ready</span>
      <button type="button" className="fw-update-btn" data-sfx="confirm" onClick={applyUpdate}>
        Update
      </button>
    </div>
  )
}
