/**
 * The modular hero (prototype, Oct 2026) — our own characters for Peoples &
 * Trades, built like a component: a hero is a `HeroLook` (data); gear maps
 * to parts, state edits the parts, and a pure compositor draws the frames.
 *
 * Not used by the shipped game yet: `harness/heroes.html` renders it and
 * `docs/characters/` holds the sheets and the parts spec.
 */
export * from './palette'
export { CELL, FEET, CX } from './raster'
export * from './rig'
export * from './look'
export * from './faces'
export { miniFrame, miniFrames, MINI_FACES, MINI_W, MINI_H, MINI_MS, type MiniAnim, type MiniFrame } from './mini'
export { composeFrame, composeStrip, resolveLook, clearHeroCache, heroCacheSize, RACE_DEFAULTS, type HeroFrame, type Piece, type ResolvedLook, type RaceDefaults } from './compose'
