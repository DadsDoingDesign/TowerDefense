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
export { miniAt, miniFrame, miniFrames, miniMs, paintSprite, spriteAt, ticPhase, MINI_FACES, MINI_W, MINI_H, MINI_MS, type ClockOpts, type MiniAnim, type MiniFace, type MiniFrame, type SpriteSize } from './mini'
export { POST_FACES, POST_FEET, POST_H, POST_W, postAt, postFeetOf, postFrame, postFrames, postSize } from './post'
export { composeFrame, composeStrip, resolveLook, clearHeroCache, heroCacheSize, RACE_DEFAULTS, type HeroFrame, type Piece, type ResolvedLook, type RaceDefaults } from './compose'
