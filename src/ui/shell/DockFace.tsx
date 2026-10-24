/**
 * `DockFace` — a company's face in its home dock slot (October 2026): the
 * liaison's hand-drawn 28 × 28 dock figure, a small version of its approved final (`game/render/hero/mini.ts`) on a canvas at
 * {@link DOCK_FACE_SCALE}, pixel-crisp (the backing store an integer multiple
 * of the art at the device's pixel ratio, no smoothing, `pixelated`).
 * Who stands in which slot and which frame plays: `dockFace.ts`.
 *
 * ONE clock for all five: a shared rAF here, started by the first face and
 * stopped with the last, asleep while the page is hidden and not running at
 * all under reduced motion (the still pose is drawn once). Each face repaints
 * only when its frame changes. Its time is ms since the dock appeared, so the
 * tics' hashed phases (no two start together, nobody mid-tic on arrival) hold
 * each time the home opens.
 *
 * Decorative: `aria-hidden`; the slot's accessible name says the company.
 */
import { useEffect, useRef } from 'react'
import type { CompanyId } from '../../game/data/companies'
import { fxLevel, onFxLevel, type FxLevel } from '../../game/render/fxQuality'
import { MINI_H, MINI_W, miniFrame } from '../../game/render/hero/mini'
import { DOCK_FACE_SCALE, dockFaceAt, type DockFaceState } from './dockFaceModel'

interface Face {
  draw: (t: number, level: FxLevel) => void
}

const faces = new Set<Face>()
let raf = 0
let epoch = 0
let unLevel: (() => void) | null = null

const now = () => performance.now() - epoch
const hidden = () => typeof document !== 'undefined' && document.hidden

function frame(): void {
  raf = 0
  if (hidden() || !faces.size) return
  const level = fxLevel()
  const t = now()
  for (const f of faces) f.draw(t, level)
  schedule()
}

function schedule(): void {
  if (raf || !faces.size || hidden() || fxLevel() === 'off') return
  raf = requestAnimationFrame(frame)
}

/** Repaint every face now (a level change, the page shown again), then run on if motion is on. */
function wake(): void {
  const level = fxLevel()
  const t = now()
  for (const f of faces) f.draw(t, level)
  schedule()
}

const onVisible = () => {
  if (!hidden()) wake()
}

function join(f: Face): () => void {
  if (!faces.size) {
    epoch = performance.now()
    document.addEventListener('visibilitychange', onVisible)
    unLevel = onFxLevel(() => wake())
  }
  faces.add(f)
  f.draw(now(), fxLevel())
  schedule()
  return () => {
    faces.delete(f)
    if (faces.size) return
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    document.removeEventListener('visibilitychange', onVisible)
    unLevel?.()
    unLevel = null
  }
}

/** One small canvas per (face, frame, locked), painted once from the pixel rows. */
const sprites = new Map<string, HTMLCanvasElement>()
function sprite(s: DockFaceState): HTMLCanvasElement {
  const key = `${s.persona}:${s.anim}:${s.frame}:${s.locked ? 1 : 0}`
  let c = sprites.get(key)
  if (!c) {
    const fr = miniFrame(s.persona, s.anim, s.frame, s.locked)
    c = document.createElement('canvas')
    c.width = fr.w
    c.height = fr.h
    c.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(fr.rgba), fr.w, fr.h), 0, 0)
    sprites.set(key, c)
  }
  return c
}

export function DockFace({ company, locked, on }: { company: CompanyId; locked: boolean; on: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  // What the clock reads each frame: kept in a ref so a re-render never restarts the loop.
  const live = useRef({ company, locked, pickedAt: undefined as number | undefined })
  live.current.company = company
  live.current.locked = locked
  // The reaction plays when the slot BECOMES focused (aria-pressed turning true), not when the dock appears.
  const wasOn = useRef(on)
  useEffect(() => {
    if (on && !wasOn.current && faces.size) live.current.pickedAt = now()
    wasOn.current = on
    wake()
  }, [on, company, locked])

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let shown = ''
    const face: Face = {
      draw: (t, level) => {
        // the backing store: the art at an integer number of device px per art px
        const k = Math.max(1, Math.round(DOCK_FACE_SCALE * (window.devicePixelRatio || 1)))
        if (canvas.width !== MINI_W * k) {
          canvas.width = MINI_W * k
          canvas.height = MINI_H * k
          shown = ''
        }
        const s = dockFaceAt(live.current.company, t, { locked: live.current.locked, level, pickedAt: live.current.pickedAt })
        const key = `${s.persona}:${s.anim}:${s.frame}:${s.locked ? 1 : 0}`
        if (key === shown) return
        shown = key
        ctx.imageSmoothingEnabled = false
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(sprite(s), 0, 0, canvas.width, canvas.height)
      },
    }
    return join(face)
  }, [])

  return (
    <canvas
      ref={ref}
      className="dock-face"
      aria-hidden="true"
      width={MINI_W * DOCK_FACE_SCALE}
      height={MINI_H * DOCK_FACE_SCALE}
      style={{ width: MINI_W * DOCK_FACE_SCALE, height: MINI_H * DOCK_FACE_SCALE }}
    />
  )
}
