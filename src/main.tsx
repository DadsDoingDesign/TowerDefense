import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { preloadSprites } from './game/render/sprites'
import { initTheme } from './state/settingsStore'
import './styles/global.css'

initTheme()
preloadSprites()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
