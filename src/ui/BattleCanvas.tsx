import { useEffect, useRef, useState } from 'react'
import { computeCombat } from '../game/engine/combat'
import { MAX_STEPS_PER_FRAME, TICK, type GameEngine } from '../game/engine/engine'
import {
  backToFront,
  shoulderNudge,
  drawBattleEntities,
  drawField,
  drawRange,
  drawSentinel,
  drawPlacementDim,
  drawSlot,
  drawBlockedFlash,
  drawClearance,
  drawClearanceLabel,
  drawConflictMark,
  drawTerrainDanger,
  drawTerrainFlames,
  drawTileGrid,
  entrySide,
  playRect,
  setPresentationTime,
  setViewScale,
  stageView,
  worldOf,
  type DrawSentinel,
  type StageView,
} from '../game/render/renderer'
import {
  drawSkull,
  drawStandingFlame,
  fxAdvance,
  fxHitstopLeft,
  fxPreload,
  fxReset,
  fxShake,
  fxStats,
  setFxReducedMotion,
} from '../game/render/fx'
import { FxDiffer } from '../game/render/fxDiff'
import { SlotLayer, type FieldRect } from './SlotLayer'
import { LedgerWatch, ledgerBeginWave } from './battleLedger'
import { dist } from '../game/core/vec'
import { clearanceOverlay, COARSE, distToPolyline, LANE_HALF } from '../game/data/terrain'
import { isMelee } from '../game/engine/melee'
import { fieldConflicts } from '../state/game/selectors'
import { drawnRoad } from '../game/render/terrain'
import { getActiveStyle } from '../game/render/themes'
import { placedSentinels, useGameStore } from '../state/gameStore'
import { useSettingsStore } from '../state/settingsStore'
import { reportFatal } from './fatal'
import type { GameMap } from '../game/types'
import {
  easeOutCubic,
  lerpView,
  nextPressMode,
  panView,
  PAN_SLOP,
  placeZoomScale,
  zoomAround,
  ZOOM_EASE_MS,
  type FieldView,
  type PressMode,
  type ViewBox,
} from './fieldZoom'

/*
 * Tile hit geometry (G1-2, grid-fit).
 *
 * Deployment is a tile grid, and a tap resolves to the TILE whose square it
 * lands in — open or blocked — rather than to the nearest of six circles within
 * a radius. The grid tiles the field edge to edge, so there is no dead zone
 * between targets and no snapping rule to reason about. Since grid-fit a tile
 * is 40 logical px (22–24 CSS px on a phone's portrait Stage), and what the
 * finger aims is an 80px patch — two tiles, 44–48 CSS px — with the tile
 * under it deciding where the hero lands to the nearest 40px (the range
 * preview shows the spot before the finger lifts). Past the grid, a tap on
 * the road where it runs on says so; the woodland takes nothing.
 */

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
 * untouched, and `stageView` (grid-fit; `fitView` before it) lays it out. The audit's alternative
 * — resizing the field to 780×662 so `dpr × view` came out at 1.0 — would have
 * moved the path and the slots, which is enemy travel time and tower coverage:
 * a balance change wearing an art fix's clothes.
 */
/**
 * Weapon clearance: where a conflict's zone label goes. It hugs the zone's
 * bottom row from inside — unless a marked hero stands in that row, when it
 * hangs just under the zone instead, clear of them.
 */
function labelSide(map: GameMap, c: { tile: string; crowding: readonly { tile: string }[] }): 'under' | 'inside' {
  const at = (id: string) => map.slots.find((s) => s.id === id)?.pos.y ?? 0
  const y = at(c.tile)
  return c.crowding.some((o) => at(o.tile) > y + 1) ? 'under' : 'inside'
}

export function BattleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  /**
   * The tile under the pointer (desk hover) or under the finger while it is
   * down (touch) — the armed hero's range is previewed there (G1-2).
   */
  const hoverSlot = useRef<string | null>(null)
  /** The field's CSS rect inside the wrap — what the DOM slot layer rides on. */
  const [field, setFieldState] = useState<FieldRect | null>(null)
  /** Q3: the field is zoomed for posting (drives the drag hint). */
  const [zoomOn, setZoomOn] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current!
    const wrap = wrapRef.current!
    /** The VISIBLE context. It only ever does the one final blit. */
    const vctx = canvas.getContext('2d')!
    const setField = (r: FieldRect) =>
      setFieldState((prev) =>
        prev && prev.left === r.left && prev.top === r.top && prev.width === r.width && prev.height === r.height ? prev : r,
      )

    /** The dpr the current `image-rendering` decision was made against. */
    let lastDpr = 0
    /**
     * The map the Stage shows (grid-fit, `frame.stageView`): which part of the
     * baked world the canvas holds, at what density, and where it sits. The
     * canvas covers the whole wrap — the field and the map round it are one
     * picture — and its backing store is that part of the world, `density`
     * composite px per field px.
     */
    let sv: StageView = { scale: 1, density: 1, pixelated: false, x0: 0, y0: 0, w: 1, h: 1, left: 0, top: 0 }
    /** The map `sv` was laid out for (a new battle re-lays it). */
    let svMap: GameMap | null = null

    /*
     * ── Zoom to place (Q3; the rules are in `fieldZoom.ts`) ──
     *
     * `fit` is the canvas as `stageView` lays it out; `shown` is the view on
     * screen. They differ only while a hero is armed on a phone whose hero's
     * room (two tiles) is under the 44 px floor and the player has touched the
     * field: then `zoomed` holds the view being eased to / panned, and it lets
     * go the moment the hero is posted, disarmed, or the setup ends. Nothing
     * here moves a gameplay coordinate — the element is just laid out bigger,
     * and every hit test already reads its live rect.
     */
    let fit: FieldView = { scale: 1, left: 0, top: 0 }
    let box: ViewBox = { left: 0, top: 0, width: 1, height: 1 }
    let shown: FieldView = fit
    let zoomed: { view: FieldView; armed: string; map: GameMap } | null = null
    let anim: { from: FieldView; to: FieldView; t0: number; dur: number } | null = null
    let lastMode = ''
    /** Lay the canvas (and the DOM grid with it) out at `v`. */
    const showView = (v: FieldView) => {
      shown = v
      const map = useGameStore.getState().battleMap
      canvas.style.width = `${sv.w * v.scale}px`
      canvas.style.height = `${sv.h * v.scale}px`
      canvas.style.left = `${v.left}px`
      canvas.style.top = `${v.top}px`
      // The field's own box inside the wrap — what the DOM tile layer rides on.
      setField({
        left: v.left - sv.x0 * v.scale,
        top: v.top - sv.y0 * v.scale,
        width: map.width * v.scale,
        height: map.height * v.scale,
        scale: v.scale,
      })
      // Whole device px per composite px is `pixelated` (lossless); a
      // supersampled composite is filtered DOWN to the screen (`auto`).
      const mode = sv.density > 1 ? 'auto' : resampleMode(v.scale, window.devicePixelRatio || 1)
      if (mode !== lastMode) canvas.style.imageRendering = lastMode = mode
    }
    /** Ease to `to` — or jump there under reduced motion. */
    const goTo = (to: FieldView, now: number) => {
      if (useSettingsStore.getState().reducedMotion) {
        anim = null
        showView(to)
      } else anim = { from: shown, to, t0: now, dur: ZOOM_EASE_MS }
    }
    const zoomOut = (now: number, instant = false) => {
      if (!zoomed) return
      zoomed = null
      setZoomOn(false)
      if (instant) {
        anim = null
        showView(fit)
      } else goTo(fit, now)
    }
    /** Zoom in about a client point, for `armed`. False when this screen needs no zoom. */
    const zoomIn = (clientX: number, clientY: number, armed: string, now: number): boolean => {
      const map = useGameStore.getState().battleMap
      const dpr = window.devicePixelRatio || 1
      // Grid-fit: the target a finger aims is an 80px patch (two tiles).
      const zs = placeZoomScale(fit.scale, dpr, COARSE)
      if (!zs) return false
      const wr = wrap.getBoundingClientRect()
      const view = zoomAround(shown, zs, clientX - wr.left, clientY - wr.top, sv.w, sv.h, box, dpr)
      zoomed = { view, armed, map }
      setZoomOn(true)
      goTo(view, now)
      return true
    }
    const panBy = (dx: number, dy: number) => {
      if (!zoomed) return
      zoomed.view = panView(zoomed.view, dx, dy, sv.w, sv.h, box, window.devicePixelRatio || 1)
      if (anim) anim.to = zoomed.view
      else showView(zoomed.view)
    }

    /**
     * The canvas IS the composite.
     *
     * The backing store is the part of the map the Stage shows, at `density`
     * composite px per field px (1 everywhere but a desk whose scale is not a
     * whole number of device px) — not `css × dpr` — so inside `step` every
     * sprite is a whole-number blit and one source pixel is one (or exactly
     * 2 × 2, 3 × 3) destination pixels. The element is then sized in CSS, and
     * the browser compositor performs the single resample down to the device.
     *
     * That resample used to be ours: composite offscreen, then
     * `drawImage(field, …)` with `imageSmoothingQuality`. Measured at 390×844,
     * that one call was **1.2 ms of a 1.5 ms frame** — more than everything else
     * put together. Handing the same resize to the compositor costs the main
     * thread nothing and is the operation hardware acceleration exists to do.
     */
    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      // The playable rect fits the wrap's CONTENT box: the Stage reserves a
      // strip at the top (the boss nameplate) as wrap padding, so the plate
      // sits over the woodland past the field and never over the play.
      const cs = getComputedStyle(wrap)
      const padT = parseFloat(cs.paddingTop) || 0
      const padB = parseFloat(cs.paddingBottom) || 0
      const map = useGameStore.getState().battleMap
      lastDpr = window.devicePixelRatio || 1
      // The wide layout (shell-wide.css) sets `--field-snap: 1`: crisp scales
      // there (see `stageView`). Phones never set it — their field is fit
      // exactly and must keep the full width.
      sv = stageView({
        wrapW: rect.width,
        wrapH: rect.height,
        padT,
        padB,
        dpr: lastDpr,
        crisp: cs.getPropertyValue('--field-snap').trim() === '1',
        play: playRect(map),
        world: worldOf(map),
        entry: entrySide(map),
      })
      svMap = map
      const bw = sv.w * sv.density
      const bh = sv.h * sv.density
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw
        canvas.height = bh
      }
      fit = { scale: sv.scale, left: sv.left, top: sv.top }
      box = { left: 0, top: 0, width: rect.width, height: rect.height }
      // The renderer otherwise has no way to know how hard the composite is
      // about to be squeezed — which is how the tier notch ended up at 1.11
      // CSS px on a 320×568 phone (M2). Always the FITTED scale: the
      // place-zoom shows the same composite bigger, it does not redraw it.
      setViewScale(sv.scale)
      anim = null
      // Q3: a layout change while zoomed keeps the zoom (re-derived for the new
      // fit, about the box's centre) or drops it if the new fit no longer needs it.
      const zs = zoomed ? placeZoomScale(fit.scale, lastDpr, COARSE) : null
      if (zoomed && zs && zoomed.map === map) {
        zoomed.view = zoomAround(fit, zs, box.left + box.width / 2, box.top + box.height / 2, sv.w, sv.h, box, lastDpr)
        showView(zoomed.view)
      } else {
        zoomed = null
        setZoomOn(false)
        showView(fit)
      }
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
      // and the element's layout in step with it.
      //
      // The dpr check is here rather than on a media-query listener because a
      // dpr change (browser zoom, a drag onto a second monitor) does not have
      // to change the element's size, so `ResizeObserver` can miss it entirely
      // — and dpr is half of the `pixelated`/`auto` decision above. One float
      // compare per frame, no allocation.
      if (map !== svMap) resize()
      else if ((window.devicePixelRatio || 1) !== lastDpr) resize()
      // Q3: the place-zoom lets go once its hero is posted or disarmed (or a
      // different hero is armed), or the setup ends; then the view eases out.
      if (zoomed && (st.selectedSentinelId !== zoomed.armed || phase !== 'setup' || engine || st.screen !== 'battle' || map !== zoomed.map))
        zoomOut(now)
      if (anim) {
        const t = anim.dur > 0 ? (now - anim.t0) / anim.dur : 1
        const v = t >= 1 ? anim.to : lerpView(anim.from, anim.to, easeOutCubic(t))
        if (t >= 1) anim = null
        showView(v)
      }
      // Field px → composite px: a whole-number scale (the density) and a
      // whole-px offset (the part of the map shown), so every sprite blit is
      // 1:1 or an exact pixel double and smoothing has nothing to do. Left off
      // so the procedural fallback keeps its hard pixel edges.
      const ctx = vctx
      const D = sv.density
      const base = () => ctx.setTransform(D, 0, 0, D, -sv.x0 * D, -sv.y0 * D)
      base()
      ctx.imageSmoothingEnabled = getActiveStyle().smoothing

      /**
       * Screenshake, applied to the composite.
       *
       * The offset is whole logical px (see `fx.ts`), so the shaken frame stays
       * exactly on the pixel grid and every sprite is still a scale-1.000 blit.
       * The terrain is laid down ONCE UNSHAKEN first and then again under the
       * offset: the shifted copy covers all but a ≤7 px band, and that band
       * shows the unshaken terrain rather than a blank edge, so the map never
       * grows a black edge as it kicks. It costs one extra blit, on shake
       * frames only.
       */
      const sh = fxShake()
      if (sh.on) {
        drawField(ctx, map, sv)
        ctx.translate(sh.dx, sh.dy)
      }

      drawField(ctx, map, sv)
      // A Wildfire's standing flames (G1-2): terrain, so under everything else.
      drawTerrainFlames(map, (x, y, p) => drawStandingFlame(ctx, x, y, p))
      // Q1: the skulls on cursed ground — terrain too, under the hero on it.
      drawTerrainDanger(map, (x, y, v) => drawSkull(ctx, x, y, v))

      const liveEngine = st.engine
      /** The hovered tile, when it is one a hero can stand on. */
      const hoverOpen = hoverSlot.current && map.slots.find((s) => s.id === hoverSlot.current)
      if (phase === 'battle' && liveEngine) {
        // Show ranges faintly while the fight runs.
        for (const s of liveEngine.sentinels) {
          drawRange(ctx, s.pos, s.profile.range, s.def.accent)
        }
        // Breather: the open tiles light up as places a hero can move to —
        // faintly until a hero is picked up, fully once one is (G1-2).
        let labels: { tile: string; strength: 'full' | 'faint' }[] = []
        // Weapon clearance: a gear change in the breather made a hero swing
        // beside another — its zone at full strength, whoever is inside it
        // marked, until the player makes space (`run/clearance`).
        const conflicts = liveEngine.breather ? fieldConflicts(st) : []
        const conflictZones = new Set(conflicts.map((c) => c.tile))
        if (liveEngine.breather && !liveEngine.subWaveState().moved) {
          const occupied = new Set(liveEngine.sentinels.map((s) => s.slotId))
          if (st.breatherPick) drawPlacementDim(ctx, sv.w, sv.h, sv.x0, sv.y0)
          // A swinger's clearance: the tiles too close to a hero that is not
          // being moved are no place to put the one that is — and each staying
          // swinger's clearance is drawn, faintly, to say why.
          const picked = st.breatherPick ? liveEngine.sentinelOnSlot(st.breatherPick) : undefined
          const staying = liveEngine.sentinels.filter((s) => s.slotId !== st.breatherPick).map((s) => ({ tile: s.slotId, melee: isMelee(s.def) }))
          const hover = picked && hoverOpen && !occupied.has(hoverOpen.id) ? hoverOpen.id : null
          const lay = clearanceOverlay(map.slots, staying, !!picked && isMelee(picked.def), hover)
          const crowded = picked ? lay.crowded : new Set<string>()
          const lit = hover && !crowded.has(hover) ? hover : null
          drawTileGrid(ctx, map, { hover: lit, faint: !st.breatherPick, skip: occupied, crowded })
          if (picked) {
            const faint = lay.zones.filter((z) => !conflictZones.has(z))
            for (const z of faint) drawClearance(ctx, map, z, 'faint')
            if (lay.landing) drawClearance(ctx, map, lay.landing, 'full')
            labels = [...faint.map((tile) => ({ tile, strength: 'faint' as const })), ...(lay.landing ? [{ tile: lay.landing, strength: 'full' as const }] : [])]
          }
          if (picked && lit && hoverOpen) drawRange(ctx, hoverOpen.pos, picked.profile.range, picked.def.accent)
        }
        for (const z of conflictZones) drawClearance(ctx, map, z, 'full')
        drawBattleEntities(ctx, liveEngine)
        for (const l of labels) drawClearanceLabel(ctx, map, l.tile, l.strength, shown.scale)
        for (const c of conflicts) drawClearanceLabel(ctx, map, c.tile, 'full', shown.scale, labelSide(map, c))
        for (const c of conflicts) for (const o of c.crowding) drawConflictMark(ctx, map, o.tile, shown.scale)
        if (st.breatherPick) {
          const picked = map.slots.find((sl) => sl.id === st.breatherPick)
          if (picked) drawSlot(ctx, picked.pos, 'hover')
        }
        // G2-2: no banner over the field during a breather any more — the
        // wave strip says "Held · move one hero" and lists the next sub-wave.
      } else {
        // Setup: the grid (only while a hero is armed), placed towers, ranges.
        const placed = placedSentinels(st.roster, st.placements).filter((p) => map.slots.some((s) => s.id === p.slotId))
        const armed = st.selectedSentinelId ? st.roster.find((h) => h.id === st.selectedSentinelId) : undefined
        // A hero armed for posting dims the field so the open tiles, lit, are
        // what the eye lands on (Wave 1); blocked tiles stay dark (G1-2).
        // A swinger's clearance (`terrain.CLEARANCE`): the tiles too close to a
        // posted swinger — or, for an armed swinger, to anyone — stay dark; each
        // posted swinger's clearance is drawn faintly to say why, and an armed
        // swinger's is drawn round the tile it would land on. A posted hero's
        // own tile lights (a tap there swaps the armed hero in).
        const armedMelee = !!armed && isMelee(armed)
        const others = armed ? placed.filter((p) => p.sentinel.id !== armed.id).map((p) => ({ tile: p.slotId, melee: isMelee(p.sentinel) })) : []
        const lay = clearanceOverlay(map.slots, others, armedMelee, armed && hoverOpen ? hoverOpen.id : null)
        const lit = armed && hoverOpen && !lay.crowded.has(hoverOpen.id) ? hoverOpen : undefined
        // Weapon clearance: a hero swinging beside another — its zone at full
        // strength and whoever is inside it marked, armed or not, until the
        // player makes space (`run/clearance`). Start Wave waits for it.
        const conflicts = st.lastResult ? [] : fieldConflicts(st)
        const conflictZones = new Set(conflicts.map((c) => c.tile))
        const faintZones = lay.zones.filter((z) => !conflictZones.has(z))
        if (armed) {
          drawPlacementDim(ctx, sv.w, sv.h, sv.x0, sv.y0)
          drawTileGrid(ctx, map, { hover: lit ? lit.id : null, crowded: lay.crowded })
          for (const z of faintZones) drawClearance(ctx, map, z, 'faint')
          if (lay.landing) drawClearance(ctx, map, lay.landing, 'full')
        }
        for (const z of conflictZones) drawClearance(ctx, map, z, 'full')
        for (const p of placed) {
          // The armed hero's own post shows its range at the tile it would move
          // to instead, below.
          if (armed && hoverOpen && p.sentinel.id === armed.id) continue
          const slot = map.slots.find((s) => s.id === p.slotId)!
          const profile = computeCombat(p.sentinel)
          drawRange(ctx, slot.pos, profile.range, p.sentinel.accent)
        }
        // The range the armed hero WOULD have on the tile under the pointer or
        // finger — the answer to "what does this tile see?" before committing.
        if (armed && lit) drawRange(ctx, lit.pos, computeCombat(armed).range, armed.accent)
        // Heroes stand back to front (by where their feet are), so two ranged
        // heroes side by side overlap the way the eye expects.
        const standAt = (q: (typeof placed)[number]) => map.slots.find((s) => s.id === q.slotId)!.pos
        const lean = shoulderNudge(placed, standAt, map.tile)
        for (const p of backToFront(placed, standAt)) {
          const slot = map.slots.find((s) => s.id === p.slotId)!
          const profile = computeCombat(p.sentinel)
          const ds: DrawSentinel = {
            id: p.sentinel.id,
            pos: { x: slot.pos.x + (lean.get(p)?.x ?? 0), y: slot.pos.y + (lean.get(p)?.y ?? 0) },
            archetype: p.sentinel.archetype,
            color: p.sentinel.color,
            accent: p.sentinel.accent,
            range: profile.range,
            aimAngle: 0,
            fireFlash: 0,
            procFlash: 0,
            patienceStacks: 0,
            blocking: false,
          }
          drawSentinel(ctx, ds)
        }
        if (armed) {
          for (const z of faintZones) drawClearanceLabel(ctx, map, z, 'faint', shown.scale)
          if (lay.landing) drawClearanceLabel(ctx, map, lay.landing, 'full', shown.scale)
        }
        for (const c of conflicts) drawClearanceLabel(ctx, map, c.tile, 'full', shown.scale, labelSide(map, c))
        for (const c of conflicts) for (const o of c.crowding) drawConflictMark(ctx, map, o.tile, shown.scale)
      }

      // A tapped blocked tile answers where the finger is (G1-2); the coach
      // strip says why in words.
      if (st.fieldNote?.tileId) drawBlockedFlash(ctx, map, st.fieldNote.tileId, (Date.now() - st.fieldNote.at) / 1000)

      // A subtle warm grade over the composed frame. The vignette that used to
      // be rebuilt here every frame is baked into the terrain now, so this is
      // the only per-frame post-process left — measured at 0.0 ms p50.
      // Applied under the identity transform so the grade covers the whole
      // canvas regardless of how far the shake has pushed the field.
      if (sh.on) base()
      ctx.globalCompositeOperation = 'overlay'
      ctx.fillStyle = GRADE
      ctx.fillRect(sv.x0, sv.y0, sv.w, sv.h)
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
      // The canvas holds the map from (x0, y0), `sv.w` field px across.
      const scale = rect.width / sv.w
      return {
        x: (clientX - rect.left) / scale + sv.x0,
        y: (clientY - rect.top) / scale + sv.y0,
        scale,
      }
    }

    /**
     * The tile whose square contains a logical point — open or blocked — or
     * null outside the grid (a portrait twin's side pads). See the note on tile
     * hit geometry at the top of this file.
     */
    /** On the drawn road where it runs on PAST the grid (inside it, the road is its lane tiles). */
    const onRoad = (x: number, y: number): boolean =>
      distToPolyline({ x, y }, drawnRoad(useGameStore.getState().battleMap)) <= LANE_HALF
    const hitTile = (x: number, y: number): string | null => {
      const map = useGameStore.getState().battleMap
      const half = (map.tile ?? 80) / 2
      for (const t of map.tiles ?? []) {
        if (Math.abs(x - t.pos.x) <= half && Math.abs(y - t.pos.y) <= half) return t.id
      }
      // A map without a grid (none ship; kept for a hand-built test map): the
      // nearest open post within a tile's reach.
      let best: { id: string; d: number } | null = null
      for (const s of map.tiles ? [] : map.slots) {
        const d = dist({ x, y }, s.pos)
        if (d <= half * 2 && (!best || d < best.d)) best = { id: s.id, d }
      }
      return best?.id ?? null
    }
    /** Is the field taking a tile right now (setup, or the breather's move)? */
    const tilesLive = () => {
      const st = useGameStore.getState()
      return (st.battlePhase === 'setup' && !st.engine) || (st.battlePhase === 'battle' && !!st.engine?.breather)
    }

    /*
     * Tap, then tap — unchanged as a gesture (G1-2): pick a hero, then tap a
     * tile. The tile is committed on RELEASE rather than on press, so while a
     * finger is down on the field the armed hero's range is previewed at the
     * tile under it, and sliding the finger moves the preview; lifting posts.
     * A plain tap is a press and a release on the same tile, so it behaves
     * exactly as before. A mouse gets the same preview on hover. A second
     * finger (pinch-zoom is allowed here) cancels the press without posting.
     */
    /*
     * Zoom to place (Q3) adds two things, both only on a ZOOMED field (so only
     * on a phone whose tiles are under 44 px, only while posting, only by
     * touch) — everywhere else this is byte-for-byte the gesture above:
     *
     * - `zooming`: the first touch on the field with a hero armed zooms about
     *   the finger and never posts (a drag during it pans).
     * - `mode` (`nextPressMode`): on the zoomed field a finger that travels
     *   past the slop BEFORE the hold is a pan and posts nothing; a tap still
     *   posts, and a finger that rests first still gets the sliding preview
     *   and posts where it lifts.
     */
    let press: {
      id: number
      touch: boolean
      zooming: boolean
      mode: PressMode
      x0: number
      y0: number
      t0: number
      lastX: number
      lastY: number
    } | null = null

    const onPointerMove = (e: PointerEvent) => {
      if (!tilesLive()) {
        hoverSlot.current = null
        return
      }
      // A touch only previews while it is down; a mouse previews on hover.
      if (e.pointerType !== 'mouse' && (!press || press.id !== e.pointerId)) return
      if (press && press.touch && zoomed) {
        const moved = Math.hypot(e.clientX - press.x0, e.clientY - press.y0)
        // A zoom-touch cannot become a hold-preview: it never posts.
        press.mode = press.zooming && press.mode === 'pending' && moved > PAN_SLOP ? 'pan' : nextPressMode(press.mode, moved, performance.now() - press.t0)
        if (press.mode === 'pan') {
          panBy(e.clientX - press.lastX, e.clientY - press.lastY)
          press.lastX = e.clientX
          press.lastY = e.clientY
          hoverSlot.current = null
          return
        }
        press.lastX = e.clientX
        press.lastY = e.clientY
        if (press.zooming) return
      }
      const { x, y } = toLogical(e.clientX, e.clientY)
      hoverSlot.current = hitTile(x, y)
    }

    const onPointerDown = (e: PointerEvent) => {
      if (!tilesLive()) return
      if (press && press.id !== e.pointerId) {
        // A second finger: this is a pinch, not a placement.
        press = null
        hoverSlot.current = null
        return
      }
      const touch = e.pointerType !== 'mouse'
      const now = performance.now()
      press = { id: e.pointerId, touch, zooming: false, mode: 'pending', x0: e.clientX, y0: e.clientY, t0: now, lastX: e.clientX, lastY: e.clientY }
      // Q3: the first touch with a hero armed zooms a small-tiled field about
      // the finger instead of choosing a tile at a size under the floor.
      const st = useGameStore.getState()
      if (touch && !zoomed && st.battlePhase === 'setup' && !st.engine && st.selectedSentinelId && zoomIn(e.clientX, e.clientY, st.selectedSentinelId, now)) {
        press.zooming = true
        hoverSlot.current = null
        return
      }
      const { x, y } = toLogical(e.clientX, e.clientY)
      hoverSlot.current = hitTile(x, y)
    }

    const onPointerUp = (e: PointerEvent) => {
      if (!press || press.id !== e.pointerId) return
      const wasTouch = press.touch
      // Q3: the zoom-touch and a pan choose nothing.
      const chooses = !press.zooming && press.mode !== 'pan'
      press = null
      const { x, y } = toLogical(e.clientX, e.clientY)
      if (wasTouch) hoverSlot.current = null
      if (!chooses) return
      if (!tilesLive()) return
      const tile = hitTile(x, y)
      if (!tile) {
        // Past the grid: the road where it runs on says so; the wood is mute.
        if (onRoad(x, y)) useGameStore.getState().noteRoad()
        return
      }
      // One router for canvas and keyboard: a blocked tile says why, an open
      // one posts / moves / inspects (`battleSlice.tapTile`).
      useGameStore.getState().tapTile(tile)
    }

    const onPointerCancel = () => {
      press = null
      hoverSlot.current = null
    }
    const onPointerLeave = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') hoverSlot.current = null
    }

    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerCancel)
    canvas.addEventListener('pointerleave', onPointerLeave)
    // Q3: keyboard placement is the unzoomed grid, always. Focus arriving in
    // the tile layer while a touch had zoomed the field snaps it back at once,
    // so a tile button is never focused outside the clipped Stage.
    const onFocusIn = () => zoomOut(performance.now(), true)
    wrap.addEventListener('focusin', onFocusIn)

    return () => {
      wrap.removeEventListener('focusin', onFocusIn)
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerCancel)
      canvas.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [])

  return (
    <div className="battle-canvas-wrap" ref={wrapRef}>
      {/* The field canvas stays FIRST in the DOM, so `querySelector('canvas')`
          in every harness still finds the field. */}
      <canvas ref={canvasRef} className="battle-canvas" />
      {field && <SlotLayer field={field} />}
      {/* Q3: only ever shown to a touch that zoomed the field, so it is not
          announced — the keyboard grid never zooms. */}
      {zoomOn && (
        <div className="place-zoom-hint" aria-hidden="true">
          Drag to look around
        </div>
      )}
    </div>
  )
}
