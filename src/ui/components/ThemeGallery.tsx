import { useEffect, useRef } from 'react'
import { drawThemePreview } from '../../game/render/renderer'
import { onSpritesReady } from '../../game/render/sprites'
import { THEMES, THEME_IDS, withStyle } from '../../game/render/themes'
import { useSettingsStore } from '../../state/settingsStore'

const PREVIEW_W = 260
const PREVIEW_H = 128

function ThemePreview({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = PREVIEW_W * dpr
    canvas.height = PREVIEW_H * dpr
    const ctx = canvas.getContext('2d')!
    const render = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.imageSmoothingEnabled = THEMES[id].smoothing
      withStyle(THEMES[id], () => drawThemePreview(ctx, PREVIEW_W, PREVIEW_H))
    }
    render()
    // Sprite themes: redraw once the images finish loading.
    if (THEMES[id].sprites) onSpritesReady(render)
  }, [id])
  return <canvas ref={ref} className="theme-canvas" style={{ width: PREVIEW_W, height: PREVIEW_H }} />
}

export function ThemeGallery() {
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)

  return (
    <section className="hub-section">
      <h2>Visual Theme</h2>
      <p className="hub-note">
        Preview each art direction and pick your favorite — it applies everywhere instantly, in
        menus and battle. (These are procedural previews; the winner tells us which sprite pack to
        drop in.)
      </p>
      <div className="theme-grid">
        {THEME_IDS.map((id) => {
          const t = THEMES[id]
          const active = theme === id
          return (
            <div key={id} className={`theme-card ${active ? 'active' : ''}`}>
              <ThemePreview id={id} />
              <div className="theme-meta">
                <div className="theme-title">
                  <strong>{t.name}</strong>
                  {active && <span className="theme-active-tag">Active</span>}
                </div>
                <span className="theme-blurb">{t.blurb}</span>
              </div>
              <button className="theme-use" disabled={active} onClick={() => setTheme(id)}>
                {active ? 'In use' : 'Use this theme'}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
