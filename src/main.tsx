import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { preloadSprites } from './game/render/sprites'
import { initSettings, initTheme } from './state/settingsStore'
import { useGameStore } from './state/gameStore'
import './styles/global.css'

initTheme()
initSettings()
preloadSprites()

// Dev-only: expose the store for headless testing (Playwright verification).
if (import.meta.env.DEV) (window as unknown as { __game: typeof useGameStore }).__game = useGameStore

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
