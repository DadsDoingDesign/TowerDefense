import type { GameMap } from '../types'

/**
 * The M1 field. Logical coordinates are 960x560; the renderer scales to fit.
 * The path snakes left→right so towers placed at the bends cover multiple lanes.
 */
export const FIELD_W = 960
export const FIELD_H = 560

const PATH = [
  { x: -30, y: 90 },
  { x: 250, y: 90 },
  { x: 250, y: 300 },
  { x: 500, y: 300 },
  { x: 500, y: 120 },
  { x: 720, y: 120 },
  { x: 720, y: 440 },
  { x: 480, y: 440 },
  { x: 480, y: 520 },
  { x: 990, y: 520 },
]

export const FIRST_MAP: GameMap = {
  id: 'greenline',
  name: 'The Green Line',
  width: FIELD_W,
  height: FIELD_H,
  path: PATH,
  base: PATH[PATH.length - 1],
  // Positions verified to sit 35–65px from the path so even short-range
  // Fighters can reach a lane. Each slot covers a different bend.
  slots: [
    { id: 's0', pos: { x: 185, y: 200 } },
    { id: 's1', pos: { x: 430, y: 345 } },
    { id: 's2', pos: { x: 610, y: 180 } },
    { id: 's3', pos: { x: 660, y: 300 } },
    { id: 's4', pos: { x: 655, y: 395 } },
    { id: 's5', pos: { x: 560, y: 485 } },
  ],
}
