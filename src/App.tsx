import { lazy, Suspense, useEffect } from 'react'
import { sfx, unlockAudio, type SoundEvent } from './audio/audio'
import { ResumeRunPrompt } from './ui/ResumeRunPrompt'
import { RotatePrompt } from './ui/RotatePrompt'
import { RootShell } from './ui/shell/RootShell'
import { rootShellEnabled } from './ui/shell/flag'
import './styles/app.css'

const SHELL = rootShellEnabled()

/**
 * The `?shell=0` comparison UI, split out of the initial payload (H14).
 *
 * Six screens plus twelve legacy-only modals used to be imported statically for
 * a flag that is off for every player and documented as slated for deletion, so
 * every phone downloaded and parsed the whole thing to render none of it. It is
 * still a real escape hatch and several regression harnesses drive it, so it is
 * lazy rather than gone — the code is one chunk away, precached by the service
 * worker, and costs nothing until the flag asks for it. See
 * `src/ui/screens/LegacyApp.tsx`.
 */
const LegacyApp = lazy(() => import('./ui/screens/LegacyApp'))

export default function App() {
  // One delegated listener gives every button a UI sound. `data-sfx` overrides
  // the sound (or "none" silences it); a few common controls map by class.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest('button, [role="button"]') as HTMLElement | null
      if (!el || (el as HTMLButtonElement).disabled) return
      const ds = el.dataset.sfx
      if (ds === 'none') return
      let ev: SoundEvent = (ds as SoundEvent) || 'click'
      if (!ds) {
        const c = typeof el.className === 'string' ? el.className : ''
        if (c.includes('detail-close')) ev = 'close'
        else if (c.includes('submenu-back')) ev = 'back'
        else if (c.includes('eq-tab') || c.includes('tac-btn') || c.includes('speed-btn') || c.includes('sc-gear-btn')) ev = 'toggle'
      }
      sfx(ev)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  // iOS only lets an AudioContext start inside a user gesture. Unlocking on the
  // very first touch — rather than on the first sound — means the context is
  // already running by the time anything wants to play (M31).
  useEffect(() => {
    const unlock = () => void unlockAudio()
    const opts = { once: true, passive: true } as const
    document.addEventListener('pointerdown', unlock, opts)
    document.addEventListener('touchstart', unlock, opts)
    document.addEventListener('keydown', unlock, { once: true })
    return () => {
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('touchstart', unlock)
      document.removeEventListener('keydown', unlock)
    }
  }, [])

  // The Root Shell replaces the whole screen-and-sheet stack, so it is an
  // either/or with the legacy screens rather than something layered on top.
  if (SHELL) {
    return (
      <div className="app-root shell-root">
        <RootShell />
        <ResumeRunPrompt />
        <RotatePrompt />
      </div>
    )
  }

  // The prompts stay outside Suspense: they are shared with the shell, they are
  // the first thing a returning player must see, and neither depends on the
  // legacy screens.
  return (
    <div className="app-root">
      <Suspense fallback={null}>
        <LegacyApp />
      </Suspense>
      <ResumeRunPrompt />
      <RotatePrompt />
    </div>
  )
}
