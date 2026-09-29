import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { preloadAudioSamples, resumeAudio } from './audio/audio'
import { installMusicDirector } from './audio/director'
import { musicStatus, resumeMusic, suspendMusic } from './audio/music'
import { preloadSprites } from './game/render/sprites'
import { initSettings, initTheme, useSettingsStore } from './state/settingsStore'
import { flushRunSnapshot, installRunPersistence, useGameStore } from './state/gameStore'
import { onAppHidden, onAppVisible } from './state/lifecycle'
import { registerServiceWorker } from './pwa'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { reportFatal } from './ui/fatal'
import './styles/global.css'

initTheme()
initSettings()
preloadSprites()
// Fetch the UI samples now so the first tap has bytes to decode (M31).
preloadAudioSamples()
// Persist the run between waves and on the way out (C3).
installRunPersistence()
// Music follows the game: a live wave gets the battle cue, everything else gets
// the hub cue. The score itself is generated (src/audio/music.ts) — no track
// files, so nothing to precache and no licence to verify.
installMusicDirector()
// One shared visibility handler: the snapshot flush is bound inside
// installRunPersistence, and iOS needs its audio context re-resumed here after
// an interruption (M31).
//
// The music joins the SAME handler rather than binding a second
// `visibilitychange` listener of its own. A backgrounded tab's AudioContext
// keeps running on desktop, so without this the score would play on inside
// another app's tab — and it would go on scheduling notes on a phone that has
// been in a pocket for an hour.
onAppVisible(() => {
  resumeAudio()
  resumeMusic()
})
onAppHidden(suspendMusic)

// Nothing in the tree caught anything before this (H21). An uncaught throw
// outside React can't reach the error boundary, so route it to the same
// recovery surface. Resource-load failures have no `.error` and are ignored.
window.addEventListener('error', (e) => {
  if (e.error) reportFatal(e.error, 'window')
})
// A rejected promise is usually a failed asset fetch, not a broken game — it
// does not deserve a crash screen. Get the run to disk and log it.
window.addEventListener('unhandledrejection', (e) => {
  console.warn('Unhandled rejection:', e.reason)
  flushRunSnapshot()
})

// Dev-only: expose the store for headless testing (Playwright verification).
if (import.meta.env.DEV) {
  const w = window as unknown as {
    __game: typeof useGameStore
    __settings: typeof useSettingsStore
    __music: typeof musicStatus
  }
  w.__game = useGameStore
  // Settings drive mute, the music dial and the assist level, all of which have
  // to be provable from a harness rather than by ear.
  w.__settings = useSettingsStore
  // The transport's own account of itself — which cue, whether it is running,
  // and how many notes it has scheduled. A test can prove music actually plays
  // without having to listen to it.
  w.__music = musicStatus
}

registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
