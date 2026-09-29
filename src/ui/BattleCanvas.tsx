import { useEffect, useRef, useState } from 'react'
import { computeCombat } from '../game/engine/combat'
import { MAX_STEPS_PER_FRAME, TICK, type GameEngine } from '../game/engine/engine'
import {
  drawBattleEntities,
  drawField,
  drawRange,
  drawSentinel,
  drawPlacementDim,
  drawSlot,
  fitView,
  setPresentationTime,
  setViewScale,
  type DrawSentinel,
} from '../game/render/renderer'
import {
  fxAdvance,
  fxHitstopLeft,
  fxPreload,
  fxReset,
  fxShake,
  fxStats,
  setFxReducedMotion,
} from '../game/render/fx'
import { FxDiffer } from '../game/render/fxDiff'
import { drawBreatherBanner } from '../game/render/telegraphs'
import { apronMargins, getApron } from '../game/render/apron'
import { SlotLayer, type FieldRect } from './SlotLayer'
import { LedgerWatch, ledgerBeginWave } from './battleLedger'
import { dist } from '../game/core/vec'
import { getActiveStyle } from '../game/render/themes'
import { placedSentinels, useGameStore } from '../state/gameStore'
import { useSettingsStore } from '../state/settingsStore'
import { reportFatal } from './fatal'

/**
 * Slot hit geometry (M2).
 *
 * `SLOT_HIT_RADIUS` is in the map's LOGICAL space — a 960×560 field — and the
 * shell draws that field into ~390×387 CSS px, a scale of ~0.406. So 26 logical
 * px is **10.6 CSS px of radius on a phone**: a 21px target for the core
 * placement gesture of the game, under a quarter of the 44px floor. Measured
 * before the fix by tapping at increasing offsets from a slot centre: 9px off
 * still landed, 11px off missed.
 *
 * The fix is not a bigger fixed radius — that would scale wrong on every other
 * viewport — but a floor expressed in the units the finger actually lives in.
 * `SLOT_HIT_SCREEN_RADIUS` is converted back through the live view scale each
 * tap, so the target is ~44px across whatever the field is squeezed to, and the
 * generous logical radius on a desktop-sized canvas is never *smaller* than the
 * original.
 */
const SLOT_HIT_RADIUS = 26
/**
 * Half of the touch target, in CSS pixels. 24 rather than 22 so the guarantee
 * is the 44px floor with margin rather than exactly on the boundary — measured,
 * a tap 22px off centre lands, which is what "44px target" has to mean.
 */
const SLOT_HIT_SCREEN_RADIUS = 24
/**
 * Ceiling on the converted radius, in logical px. Slots on the shipped map sit
 * ~95 logical px apart, so this lets neighbouring catchment areas meet (nearest
 * wins, so meeting is fine and is what "snapping" means) while still refusing a
 * tap that is simply nowhere near the build line.
 */
const SLOT_HIT_MAX_RADIUS = 80

/**
 * A subtle warm grade over the finished frame — the second post-process on the
 * field after the vignette (which is baked into the terrain now). One
 * `fillRect` in `overlay` at 6% pulls the composite together and answers the
 * brand's "warm storybook, no cool blue-grey" without touching any sprite.
 */
const GRADE = 'rgba(255,186,110,0.06)'

/**
 * ── `pixelated` vs `auto` is a per-viewport decision, not a global one (M3) ──
 *
 * The rejection of `image-rendering: pixelated` written into `app.css` reasons
 * entirely from one number: "960 → 780 nearest-neighbour discards 180 of 960
 * columns", i.e. the dpr-2 case at 390×844, where the composite really is being
 * MINIFIED and dropped columns really do delete a 1px sword. That argument is
 * correct and it is kept.
 *
 * It just does not apply to the other half of the matrix. The mapping ratio is
 * `view.scale × dpr`, and at **dpr 3 four of the five matrix viewports are
 * upscales** — 390×844 → 1.219×, 375×667 → 1.172×, 360×740 → 1.125×,
 * 360×640 → 1.055×. Nothing is discarded in an upscale; there is no "which
 * pixel survives" question to lose. What `auto` does there instead is smear a
 * frame that was composed at exactly 1.000 for the sole purpose of not being
 * smeared: measured on the same capture, it blurs the grass texture and softens
 * the baked `#161C2E`-class contour into the ground it is there to separate the
 * unit from. dpr-3 phones are the majority of current flagships, so that is the
 * common case, not the exotic one.
 *
 * So the property follows the ratio, and the two cases each get the answer that
 * was argued for them:
 *
 *   ratio ≥ 1  (upscale, e.g. any dpr-3 phone)  → `pixelated`, nothing to drop
 *   ratio < 1  (downscale, every dpr-1/2 phone) → `auto`, one filtered resample
 *
 * The CSS keeps `auto` as its declared value, which is both the correct default
 * for the downscale case and the right answer for the frames before the first
 * layout runs.
 */
function resampleMode(viewScale: number, dpr: number): 'pixelated' | 'auto' {
  return viewScale * dpr >= 1 ? 'pixelated' : 'auto'
}

/*
 * The tick differ — how impacts, hits, kills and procs are derived from the
 * engine without an engine edit — lives in `src/game/render/fxDiff.ts`, one
 * `FxDiffer` per battle.
 */

/**
 * Owns the requestAnimationFrame loop. Draws the field every frame, steps the
 * engine during battle, and handles tap-to-place input during setup. Reads game
 * state via getState() so the loop never restarts on store updates.
 *
 * ## Why the field is composed offscreen (Phase 3)
 *
 * The battle used to be drawn straight onto the visible canvas under a
 * `dpr × view` transform. On the shipping phone that product is **0.8125** —
 * measured, not assumed — so every sprite draw was a non-integer minification,
 * and with `imageSmoothingEnabled = false` that is nearest-neighbour throwing
 * away 73–97% of each source. Because units move at sub-pixel positions, WHICH
 * pixels survived changed every frame: pixel crawl on everything in motion, and
 * a 6.30× density spread across one screen.
 *
 * So: compose the whole field into an offscreen canvas that is exactly the
 * logical field (960×560), where one source pixel is one destination pixel and
 * every `drawImage` is at scale 1.000 with smoothing OFF — then blit that one
 * finished frame down to the device with smoothing ON. One clean resample of a
 * composed image replaces ~30 per-sprite per-frame nearest-neighbour
 * minifications, and **not one gameplay coordinate moves**: the field is still
 * 960×560, the path, the build slots, tower range and every radius are
 * untouched, and `fitView` still does the letterboxing. The audit's alternative
 * — resizing the field to 780×662 so `dpr × view` came out at 1.0 — would have
 * moved the path and the slots, which is enemy travel time and tower coverage:
 * a balance change wearing an art fix's clothes.
 */
export function BattleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const apronRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const hoverSlot = useRef<string | null>(null)
  /** The field's CSS rect inside the wrap — what the DOM slot layer rides on. */
  const [field, setFieldState] = useState<FieldRect | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const apron = apronRef.current!
    const wrap = wrapRef.current!
    /** The VISIBLE context. It only ever does the one final blit. */
    const vctx = canvas.getContext('2d')!
    /** Which baked apron is on the apron element right now. */
    let apronSrc: HTMLCanvasElement | null = null
    let apronView = { scale: 0, left: 0, top: 0 }
    const setField = (r: FieldRect) =>
      setFieldState((prev) =>
        prev && prev.left === r.left && prev.top === r.top && prev.width === r.width && prev.height === r.height ? prev : r,
      )
    /**
     * Copy the baked apron onto its element when the bake changes, and keep it
     * registered under the field. Cheap on every call but the first: a layout
     * change is three style writes.
     */
    const placeApron = (scale: number, left: number, top: number) => {
      apronView = { scale, left, top }
      const src = getApron(useGameStore.getState().battleMap)
      if (src && src !== apronSrc) {
        apronSrc = src
        apron.width = src.width
        apron.height = src.height
        const actx = apron.getContext('2d')
        if (actx) {
          actx.imageSmoothingEnabled = false
          actx.drawImage(src, 0, 0)
        }
      }
      if (!apronSrc) {
        apron.style.display = 'none'
        return
      }
      apron.style.display = 'block'
      apron.style.width = `${apronSrc.width * scale}px`
      apron.style.height = `${apronSrc.height * scale}px`
      const m = apronMargins(useGameStore.getState().battleMap)
      apron.style.left = `${left - m.x * scale}px`
      apron.style.top = `${top - m.y * scale}px`
      apron.style.imageRendering = resampleMode(scale, window.devicePixelRatio || 1)
    }

    let cssW = 0
    let cssH = 0
    /** The dpr the current `image-rendering` decision was made against. */
    let lastDpr = 0

    /**
     * The canvas IS the composite.
     *
     * The backing store is the map's logical box — 960×560 — not `css × dpr`,
     * so inside `step` the transform is the identity and one source pixel is one
     * destination pixel for every sprite on the field. The element is then sized
     * in CSS to the letterboxed rect `fitView` would have produced, and the
     * browser compositor performs the single, filtered resample down to the
     * device.
     *
     * That resample used to be ours: composite offscreen, then
     * `drawImage(field, …)` with `imageSmoothingQuality`. Measured at 390×844,
     * that one call was **1.2 ms of a 1.5 ms frame** — more than everything else
     * put together, and more than the ~1000 path ops it had just replaced.
     * Handing the same resize to the compositor costs the main thread nothing
     * and is the operation hardware acceleration exists to do.
     *
     * `fitView` is untouched and still the authority: the element's own rect now
     * has the field's exact aspect, so the `ox`/`oy` it computes for hit-testing
     * come out at 0 and every existing tap path (including `dm-reach`'s and
     * `ws9-firstrun`'s slot maths, which do the same arithmetic against
     * `getBoundingClientRect`) stays correct with no change.
     */
    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      // The field fits the wrap's CONTENT box: the Stage reserves a strip at
      // the top (the boss nameplate) as wrap padding, so the plate sits in the
      // apron above the field and never over it (Phase 2).
      const cs = getComputedStyle(wrap)
      const padT = parseFloat(cs.paddingTop) || 0
      const padB = parseFloat(cs.paddingBottom) || 0
      cssW = rect.width
      cssH = Math.max(1, rect.height - padT - padB)
      const map = useGameStore.getState().battleMap
      if (canvas.width !== map.width || canvas.height !== map.height) {
        canvas.width = map.width
        canvas.height = map.height
      }
      let view = fitView(cssW, cssH, map)
      // The wide layout (shell-wide.css) sets `--field-snap: 1`: when the field
      // is being ENLARGED, snap the scale down to a whole number of device
      // pixels per field pixel, so a 1440-wide desk shows it at exactly 1:1 (or
      // 2:1 on a retina panel) instead of a smeared 1.02. Phones never set it —
      // their field is width-bound and must keep the full width.
      if (cs.getPropertyValue('--field-snap').trim() === '1') {
        const d = window.devicePixelRatio || 1
        const n = Math.floor(view.scale * d + 1e-6)
        if (n >= 1) {
          const sc = n / d
          view = { scale: sc, ox: (cssW - map.width * sc) / 2, oy: (cssH - map.height * sc) / 2 }
        }
      }
      const fw = map.width * view.scale
      const fh = map.height * view.scale
      const left = Math.round(view.ox)
      const top = Math.round(padT + view.oy)
      canvas.style.width = `${fw}px`
      canvas.style.height = `${fh}px`
      canvas.style.left = `${left}px`
      canvas.style.top = `${top}px`
      placeApron(view.scale, left, top)
      setField({ left, top, width: fw, height: fh, scale: view.scale })
      // The renderer draws into the 960×560 composite and otherwise has no way
      // to know how hard that composite is about to be squeezed — which is how
      // the tier notch ended up at 1.11 CSS px on a 320×568 phone (M2).
      setViewScale(view.scale)
      lastDpr = window.devicePixelRatio || 1
      canvas.style.imageRendering = resampleMode(view.scale, lastDpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    // MUST stay byte-identical to the rotate-prompt query in overlays.css and
    // shell.css. Dropping a clause here does not just desync the prompt — it
    // freezes the sim on viewports that never see the prompt, with no way out.
    // The `max-height` clause is load-bearing: shell.css treats 501–720px-tall
    // landscape as a supported layout, so those devices must keep simulating.
    const rotated = window.matchMedia(
      '(orientation: landscape) and (max-height: 500px) and (max-width: 950px) and (pointer: coarse)',
    )

    let raf = 0
    let last = performance.now()
    let hudTimer = 0
    /** Leftover real time not yet consumed by a whole TICK. */
    let accumulator = 0
    /** Simulated seconds elapsed on screen — drives every looping animation. */
    let animTime = 0
    /** Identity of the engine the differ is armed against (a new wave re-arms). */
    let fxEngine: GameEngine | null = null
    /**
     * The tick differ for `fxEngine` — one instance per battle, so no snapshot
     * or scratch table can leak from one wave into the next (see `fxDiff.ts`).
     */
    let fxDiff: FxDiffer | null = null
    /** Who reached the Gate, per wave — the defeat receipt and the announcer. */
    let ledger: LedgerWatch | null = null

    // The effect sheets are fetched on mount, not at boot: 19 KB that the title
    // screen has no use for.
    fxPreload()
    // Live FX counters, alongside the `window.__game` the harnesses already
    // read. It is one frozen object of numbers and it is what makes claims
    // about particle counts, hitstop and reduced motion measurable rather than
    // asserted.
    ;(window as unknown as { __fx?: typeof fxStats }).__fx = fxStats

    /**
     * The unguarded body of one frame. Wrapped by `frame` below — a throw in
     * here used to freeze the battle silently forever, because rAF callbacks
     * are outside React and nothing was catching them (H21).
     */
    const step = (now: number) => {
      let dt = (now - last) / 1000
      last = now
      // A tab-out can hand us an enormous delta; cap the real time we bank.
      if (dt > 0.25) dt = 0.25

      // The rotate prompt only hides the field — rAF keeps firing behind it, so
      // without this a wave plays out, and can be lost, on a screen the player
      // cannot see. Freeze instead: nothing banks, so rotating back resumes
      // exactly where it stopped.
      if (rotated.matches) {
        accumulator = 0
        return
      }

      const st = useGameStore.getState()
      const { battleMap: map, engine, battlePhase: phase, speed } = st

      /**
       * The presentation layer runs on REAL time and is told about the reduced-
       * motion setting every frame (L11: the setting governed CSS only and never
       * reached the canvas). `fxAdvance` is called before anything is banked, so
       * shake and the hitstop budget keep moving even on a frozen frame.
       */
      setFxReducedMotion(useSettingsStore.getState().reducedMotion)
      fxAdvance(dt)

      // --- simulate ---
      // Fixed timestep (C2): the sim only ever advances in whole TICKs and play
      // speed multiplies how MANY ticks run, never their size — so 1×/2×/3× and
      // 30/60/144Hz all produce the identical battle.
      if (phase === 'battle' && engine) {
        if (engine !== fxEngine || !fxDiff) {
          fxEngine = engine
          fxReset()
          fxDiff = new FxDiffer(engine)
          ledger = new LedgerWatch(engine)
          ledgerBeginWave(st.runSeed, st.roster)
        }
        /**
         * ---- hitstop, and why it cannot desync the sim (Phase 3) -----------
         *
         * The freeze is bought by NOT BANKING real time, never by stalling
         * `engine.step`. The accumulator still only ever hands the sim whole
         * `TICK`s, in order, so the wave that plays is bit-for-bit the wave that
         * would have played — exactly the property that already lets 30 Hz,
         * 60 Hz and 144 Hz produce the identical battle. What changes is *when*
         * those ticks run in wall-clock terms, which is what a freeze frame is.
         *
         * Under reduced motion `fxHitstop` never grants anything, so this is a
         * no-op there.
         */
        if (fxHitstopLeft() > 0) dt = 0

        accumulator += dt
        let steps = 0
        while (accumulator >= TICK && steps < MAX_STEPS_PER_FRAME) {
          for (let i = 0; i < speed && engine.status === 'running'; i++) {
            // One diff per TICK, not per frame: at 3× a frame runs three ticks
            // and a frame-level diff would merge them.
            fxDiff.snapBefore(engine)
            ledger?.before(engine)
            engine.step(TICK)
            fxDiff.diffAfter(engine, speed)
            ledger?.after(engine)
          }
          accumulator -= TICK
          steps++
          animTime += TICK * speed
        }
        // Hit the ceiling with backlog still unconsumed: drop it instead of
        // spiralling deeper each frame.
        //
        // The `accumulator >= TICK` half matters (m-2). Without it, a frame that
        // happened to need exactly MAX_STEPS_PER_FRAME ticks threw away the
        // sub-tick remainder it had legitimately banked — so any hitch past
        // ~0.1s lost real sim time, and below ~10fps the sim ran permanently
        // slow because every frame ended at the ceiling with a live remainder.
        // Determinism is untouched: the sim still only ever advances in whole
        // TICKs, and this only decides whether a partial tick is carried.
        if (steps === MAX_STEPS_PER_FRAME && accumulator >= TICK) accumulator = 0

        hudTimer += dt
        if (hudTimer >= 0.1) {
          hudTimer = 0
          st.syncHud()
        }
        if (engine.status !== 'running') {
          st.syncHud()
          st.finishBattle()
        }
      } else {
        // Out of battle nothing is paused, so ambient animation runs on real time.
        animTime += dt
        accumulator = 0
      }
      setPresentationTime(animTime)

      // --- draw ---
      // The map can change under us (a new battle); keep the composite's box
      // and the element's letterbox in step with it.
      //
      // The dpr check is here rather than on a media-query listener because a
      // dpr change (browser zoom, a drag onto a second monitor) does not have
      // to change the element's size, so `ResizeObserver` can miss it entirely
      // — and dpr is half of the `pixelated`/`auto` decision above. One float
      // compare per frame, no allocation.
      if (canvas.width !== map.width || canvas.height !== map.height) resize()
      else if ((window.devicePixelRatio || 1) !== lastDpr) resize()
      else if (getApron(map) !== apronSrc) placeApron(apronView.scale, apronView.left, apronView.top)
      // Identity transform: logical px ARE canvas px here, so every sprite blit
      // is 1:1 and smoothing has nothing to do. Left off so the procedural
      // fallback keeps its hard pixel edges.
      const ctx = vctx
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.imageSmoothingEnabled = getActiveStyle().smoothing

      /**
       * Screenshake, applied to the composite.
       *
       * The offset is whole logical px (see `fx.ts`), so the shaken frame stays
       * exactly on the pixel grid and every sprite is still a scale-1.000 blit.
       * The terrain is laid down ONCE UNSHAKEN first and then again under the
       * offset: the shifted copy covers all but a ≤7 px band, and that band
       * shows the unshaken terrain rather than the letterbox, so the field
       * never grows a black edge as it kicks. It costs one extra 960×560 blit,
       * on shake frames only.
       */
      const sh = fxShake()
      if (sh.on) {
        drawField(ctx, map)
        ctx.translate(sh.dx, sh.dy)
      }

      drawField(ctx, map)

      const liveEngine = st.engine
      if (phase === 'battle' && liveEngine) {
        // Show ranges faintly while the fight runs.
        for (const s of liveEngine.sentinels) {
          if (s.downed) continue
          drawRange(ctx, s.pos, s.profile.range, s.def.accent)
        }
        // Breather: the open posts light up as places a hero can move to.
        if (liveEngine.breather && !liveEngine.subWaveState().moved) {
          for (const slot of map.slots) {
            if (liveEngine.sentinelOnSlot(slot.id)) continue
            drawSlot(ctx, slot.pos, st.breatherPick ? 'selected' : 'empty')
          }
        }
        drawBattleEntities(ctx, liveEngine)
        if (st.breatherPick) {
          const picked = map.slots.find((sl) => sl.id === st.breatherPick)
          if (picked) drawSlot(ctx, picked.pos, 'hover')
        }
        if (liveEngine.breather) drawBreatherBanner(ctx, liveEngine)
      } else {
        // Setup: slots + placed towers + range previews.
        const placed = placedSentinels(st.roster, st.placements)
        const occupied = new Set(placed.map((p) => p.slotId))
        // A hero armed for posting dims the field so the free slots, lit and
        // pulsing, are what the eye lands on (Wave 1).
        if (st.selectedSentinelId) drawPlacementDim(ctx, map.width, map.height)
        for (const p of placed) {
          const slot = map.slots.find((s) => s.id === p.slotId)!
          const profile = computeCombat(p.sentinel)
          drawRange(ctx, slot.pos, profile.range, p.sentinel.accent)
        }
        for (const slot of map.slots) {
          if (occupied.has(slot.id)) continue
          const state =
            hoverSlot.current === slot.id
              ? 'hover'
              : st.selectedSentinelId
                ? 'selected'
                : 'empty'
          drawSlot(ctx, slot.pos, state)
        }
        for (const p of placed) {
          const slot = map.slots.find((s) => s.id === p.slotId)!
          const profile = computeCombat(p.sentinel)
          const ds: DrawSentinel = {
            id: p.sentinel.id,
            pos: slot.pos,
            archetype: p.sentinel.archetype,
            color: p.sentinel.color,
            accent: p.sentinel.accent,
            range: profile.range,
            aimAngle: 0,
            fireFlash: 0,
            hp: profile.maxHp,
            maxHp: profile.maxHp,
            downed: false,
            procFlash: 0,
            patienceStacks: 0,
            blocking: false,
          }
          drawSentinel(ctx, ds)
        }
      }

      // A subtle warm grade over the composed frame. The vignette that used to
      // be rebuilt here every frame is baked into the terrain now, so this is
      // the only per-frame post-process left — measured at 0.0 ms p50.
      // Applied under the identity transform so the grade covers the whole
      // canvas regardless of how far the shake has pushed the field.
      if (sh.on) ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalCompositeOperation = 'overlay'
      ctx.fillStyle = GRADE
      ctx.fillRect(0, 0, map.width, map.height)
      ctx.globalCompositeOperation = 'source-over'
    }

    const frame = (now: number) => {
      try {
        step(now)
      } catch (err) {
        // Surface the failure instead of dying silently: stop the loop and hand
        // it to the error boundary, which offers the last run snapshot back.
        reportFatal(err, 'battle-loop')
        return
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    // --- input (setup placement) ---
    /**
     * Client px → the map's logical space. Unchanged in substance: still
     * `clientX` against a live `getBoundingClientRect()`, which is what keeps
     * the mapping correct under the pinch-zoom Phase 1 restored (a visual
     * viewport zoom moves the rect, and reading it per-event is what tracks
     * it). It just also hands back the scale, because the hit test needs to
     * express its radius in screen units.
     */
    const toLogical = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      const st = useGameStore.getState()
      const view = fitView(rect.width, rect.height, st.battleMap)
      return {
        x: (clientX - rect.left - view.ox) / view.scale,
        y: (clientY - rect.top - view.oy) / view.scale,
        scale: view.scale,
      }
    }

    /**
     * Nearest slot within a radius that is at least 22 CSS px on screen.
     *
     * Nearest-wins rather than first-within-range, so two catchment areas that
     * overlap resolve to the one the finger was actually closer to — which is
     * what makes a radius bigger than half the slot spacing safe.
     */
    const hitSlot = (x: number, y: number, scale: number): string | null => {
      const st = useGameStore.getState()
      const radius = Math.min(
        SLOT_HIT_MAX_RADIUS,
        Math.max(SLOT_HIT_RADIUS, SLOT_HIT_SCREEN_RADIUS / Math.max(scale, 0.001)),
      )
      let best: { id: string; d: number } | null = null
      for (const slot of st.battleMap.slots) {
        const d = dist({ x, y }, slot.pos)
        if (d <= radius && (!best || d < best.d)) best = { id: slot.id, d }
      }
      return best?.id ?? null
    }

    const onPointerMove = (e: PointerEvent) => {
      const st = useGameStore.getState()
      if (st.battlePhase !== 'setup') {
        hoverSlot.current = null
        return
      }
      const { x, y, scale } = toLogical(e.clientX, e.clientY)
      hoverSlot.current = hitSlot(x, y, scale)
    }

    const onPointerDown = (e: PointerEvent) => {
      const st = useGameStore.getState()
      // The breather between sub-waves (Phase 3a): the sim is paused and the
      // player may move ONE hero — tap it, then tap where it goes.
      if (st.battlePhase === 'battle' && st.engine?.breather) {
        const p = toLogical(e.clientX, e.clientY)
        const target = hitSlot(p.x, p.y, p.scale)
        if (target) st.breatherTap(target)
        return
      }
      if (st.battlePhase !== 'setup') return
      const { x, y, scale } = toLogical(e.clientX, e.clientY)
      const slotId = hitSlot(x, y, scale)
      if (!slotId) return
      const occupied = st.placements[slotId]
      if (st.selectedSentinelId) {
        st.placeOnSlot(slotId)
      } else if (occupied) {
        // Clicking a placed tower inspects it — the legacy upgrade modal, or
        // the shell's Context panel on its Upgrades tab.
        st.focusTower(occupied)
      }
    }

    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerleave', () => (hoverSlot.current = null))

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  return (
    <div className="battle-canvas-wrap" ref={wrapRef}>
      {/* The field canvas stays FIRST in the DOM, so `querySelector('canvas')`
          in every harness still finds the field; z-index puts the apron
          behind it. */}
      <canvas ref={canvasRef} className="battle-canvas" />
      <canvas ref={apronRef} className="battle-apron" aria-hidden="true" />
      {field && <SlotLayer field={field} />}
    </div>
  )
}
