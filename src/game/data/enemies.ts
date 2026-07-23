import type { EnemyType } from '../types'

/**
 * Enemy roster — the goblin horde, in three factions of five escalating tiers.
 *
 *  • torch  — melee rushers: fast, fragile, cheap. They swarm.
 *  • tnt    — bombers: sturdier, hit harder on leak, shrug off some magic.
 *  • barrel — rolling tanks: slow, armored, punishing if they reach the base.
 *
 * Tier 5 of each faction is a champion (boss-scale). Sprites live in the
 * `tinyswords` pack as torch1..5 / tnt1..5 / barrel1..5.
 */
export const ENEMY_TYPES: Record<string, EnemyType> = {
  // ── Torch goblins — melee rushers ──────────────────────────────────────
  torch1: { id: 'torch1', name: 'Torch Runt', baseHp: 24, speed: 122, reward: 4, leak: 1, radius: 11, color: '#d0563a', meleeDps: 6 },
  torch2: { id: 'torch2', name: 'Torch Goblin', baseHp: 42, speed: 112, reward: 5, leak: 1, radius: 12, color: '#4a86c0', meleeDps: 9 },
  torch3: { id: 'torch3', name: 'Torch Raider', baseHp: 76, speed: 104, reward: 7, leak: 1, radius: 13, color: '#8a5ec0', meleeDps: 13 },
  torch4: { id: 'torch4', name: 'Torch Berserker', baseHp: 128, speed: 98, reward: 11, leak: 2, radius: 15, color: '#d4b24a', meleeDps: 19 },
  torch5: { id: 'torch5', name: 'Warlord Grukk', baseHp: 950, speed: 60, reward: 110, leak: 11, radius: 26, color: '#b0301f', meleeDps: 46, physResist: 0.15, isBoss: true },

  // ── TNT goblins — bombers ──────────────────────────────────────────────
  tnt1: { id: 'tnt1', name: 'Fuse Whelp', baseHp: 34, speed: 86, reward: 5, leak: 2, radius: 12, color: '#c0563a', meleeDps: 8 },
  tnt2: { id: 'tnt2', name: 'Bomber', baseHp: 60, speed: 82, reward: 7, leak: 2, radius: 13, color: '#4a86c0', meleeDps: 12, magResist: 0.15 },
  tnt3: { id: 'tnt3', name: 'Demolisher', baseHp: 100, speed: 78, reward: 9, leak: 3, radius: 14, color: '#8a5ec0', meleeDps: 17, magResist: 0.2 },
  tnt4: { id: 'tnt4', name: 'Sapper', baseHp: 172, speed: 74, reward: 14, leak: 3, radius: 16, color: '#d4b24a', meleeDps: 23, magResist: 0.25 },
  tnt5: { id: 'tnt5', name: 'Powderkeg King', baseHp: 1350, speed: 42, reward: 150, leak: 15, radius: 28, color: '#802a2a', meleeDps: 54, magResist: 0.25, physResist: 0.1, isBoss: true },

  // ── Barrel goblins — rolling tanks ─────────────────────────────────────
  barrel1: { id: 'barrel1', name: 'Barrel Imp', baseHp: 72, speed: 46, reward: 6, leak: 2, radius: 13, color: '#b5793a', meleeDps: 10, physResist: 0.15 },
  barrel2: { id: 'barrel2', name: 'Barrel Roller', baseHp: 134, speed: 42, reward: 9, leak: 2, radius: 15, color: '#4a86c0', meleeDps: 16, physResist: 0.2 },
  barrel3: { id: 'barrel3', name: 'Ironbarrel', baseHp: 248, speed: 38, reward: 14, leak: 3, radius: 18, color: '#8a5ec0', meleeDps: 25, physResist: 0.25 },
  barrel4: { id: 'barrel4', name: 'Siege Barrel', baseHp: 430, speed: 34, reward: 21, leak: 4, radius: 21, color: '#d4b24a', meleeDps: 35, physResist: 0.3 },
  barrel5: { id: 'barrel5', name: 'The Colossus Keg', baseHp: 2600, speed: 30, reward: 220, leak: 22, radius: 33, color: '#6a4a8f', meleeDps: 66, physResist: 0.35, magResist: 0.15, isBoss: true },
}
