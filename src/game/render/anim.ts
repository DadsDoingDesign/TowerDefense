/**
 * Animation strips for the Tiny Swords pack. Each strip is a horizontal
 * N-frame PNG (enemies: a run cycle; towers: idle + attack). Frame counts are
 * fixed per strip; frame width is derived at draw time from the image width.
 */
export const ANIM_FRAMES: Record<string, number> = {
  // enemy run cycles (torch / tnt tiers 1–5)
  torch1_walk: 6, torch2_walk: 6, torch3_walk: 6, torch4_walk: 6, torch5_walk: 6,
  tnt1_walk: 6, tnt2_walk: 6, tnt3_walk: 6, tnt4_walk: 6, tnt5_walk: 6,
  // tower idle + attack (fighter=warrior, rogue=archer, mystic=pawn)
  fighter_idle: 6, fighter_atk: 6,
  rogue_idle: 6, rogue_atk: 8,
  mystic_idle: 6, mystic_atk: 6,
}
export const ANIM_ROLES = Object.keys(ANIM_FRAMES)

/** Looping frame index for a strip. `now` in seconds; `offset` desyncs instances. */
export function loopFrame(now: number, frames: number, fps: number, offset = 0): number {
  const i = Math.floor(now * fps + offset)
  return ((i % frames) + frames) % frames
}
