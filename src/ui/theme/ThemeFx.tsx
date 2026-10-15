import { useEffect, useRef } from 'react'
import { fx } from './fxEngine'

/**
 * The company world's ambient layer (Oct 2026): a pixel canvas the size of the
 * screen, drawn BEHIND the page's panels (`.th-fx`: fixed, `z-index: -1`
 * inside the page's own stacking context), so embers, paint, sparks, petals
 * and stars move through the gaps between panels and never under text. One
 * engine draws it (`fxEngine.ts`); a page mounts one. `map`: the home's, over
 * the trade map and under its labels.
 */
export function ThemeFx({ map = false }: { map?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    fx.install()
    return fx.attachAmbient(c)
  }, [])
  return <canvas ref={ref} className={`th-fx${map ? ' is-map' : ''}`} aria-hidden="true" />
}
