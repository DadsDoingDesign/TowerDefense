import { useEffect } from 'react'
import { sfx, unlockAudio, type SoundEvent } from './audio/audio'
import { ResumeRunPrompt } from './ui/ResumeRunPrompt'
import { RotatePrompt } from './ui/RotatePrompt'
import { RootShell } from './ui/shell/RootShell'
import './styles/app.css'

export default function App() {
  // One delegated listener gives every button a UI sound. `data-sfx` overrides
  // the sound (or "none" silences it).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest('button, [role="button"]') as HTMLElement | null
      if (!el || (el as HTMLButtonElement).disabled) return
      const ds = el.dataset.sfx
      if (ds === 'none') return
      sfx((ds as SoundEvent) || 'click')
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

  // The Root Shell is the whole UI: one screen, four bands (docs/FIGMA.md).
  return (
    <div className="app-root shell-root">
      <RootShell />
      <ResumeRunPrompt />
      <RotatePrompt />
      {/* UpdateNotice lives in the menu's title block now (Phase 2) — it used
          to float over the hub title. */}
    </div>
  )
}
