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
 *
 * **On speed.** The Green Line is 2290px end to end, so a mover's speed is a
 * crossing *time*. The original band (46→34px/s for barrels) meant 50–67 seconds
 * of walking — longer than the whole fight — so a barrel spawned in the back half
 * of a wave could not reach the base before the battle timed out. That made
 * armour a stalling mechanic rather than a threat and turned "did the base hold"
 * into "did the clock run out".
 *
 * The band was first reset so everything crossed in 19–46s, and has since been
 * lifted a further **×1.2** (M19-e2). That second step is measured rather than
 * aesthetic. The rebuilt fresh-player sweep (§11) showed the zero-meta curve is
 * governed by *time in range* — how many shots a defence gets per body — far more
 * than by roster size, and time in range is the one difficulty axis a run's
 * Threat multiplier does **not** touch, so it is the only lever that reaches a
 * one-hero line without landing 3.7× harder on a full one. Tightening crossings
 * to 16–38s makes coverage (range, placement, slows) matter to a small line
 * without inflating enemy HP, and it pulled §5's pressure ceiling from ×7.60 —
 * one rung off the top of its ×2–8 design band — to a mid-band ×5.00. Everything
 * still crosses in more than fifteen seconds, and the slowest thing on the field
 * is still 2.4× a Torch Runt.
 */
export const ENEMY_TYPES: Record<string, EnemyType> = {
  // ── Torch goblins — melee rushers ──────────────────────────────────────
  torch1: { id: 'torch1', name: 'Torch Runt', baseHp: 24, speed: 146, reward: 4, leak: 1, radius: 11, color: '#d0563a', meleeDps: 6 },
  torch2: { id: 'torch2', name: 'Torch Goblin', baseHp: 42, speed: 134, reward: 5, leak: 1, radius: 12, color: '#4a86c0', meleeDps: 9 },
  torch3: { id: 'torch3', name: 'Torch Raider', baseHp: 76, speed: 125, reward: 7, leak: 1, radius: 13, color: '#8a5ec0', meleeDps: 13 },
  torch4: { id: 'torch4', name: 'Torch Berserker', baseHp: 128, speed: 118, reward: 11, leak: 2, radius: 15, color: '#d4b24a', meleeDps: 19 },
  torch5: { id: 'torch5', name: 'Warlord Grukk', baseHp: 950, speed: 89, reward: 110, leak: 11, radius: 26, color: '#b0301f', meleeDps: 46, physResist: 0.15, isBoss: true },

  // ── TNT goblins — bombers ──────────────────────────────────────────────
  tnt1: { id: 'tnt1', name: 'Fuse Whelp', baseHp: 34, speed: 103, reward: 5, leak: 2, radius: 12, color: '#c0563a', meleeDps: 8 },
  tnt2: { id: 'tnt2', name: 'Bomber', baseHp: 60, speed: 98, reward: 7, leak: 2, radius: 13, color: '#4a86c0', meleeDps: 12, magResist: 0.15 },
  tnt3: { id: 'tnt3', name: 'Demolisher', baseHp: 100, speed: 94, reward: 9, leak: 3, radius: 14, color: '#8a5ec0', meleeDps: 17, magResist: 0.2 },
  tnt4: { id: 'tnt4', name: 'Sapper', baseHp: 172, speed: 89, reward: 14, leak: 3, radius: 16, color: '#d4b24a', meleeDps: 23, magResist: 0.25 },
  tnt5: { id: 'tnt5', name: 'Powderkeg King', baseHp: 1350, speed: 74, reward: 150, leak: 15, radius: 28, color: '#802a2a', meleeDps: 54, magResist: 0.25, physResist: 0.1, isBoss: true },

  // ── Barrel goblins — rolling tanks ─────────────────────────────────────
  barrel1: { id: 'barrel1', name: 'Barrel Imp', baseHp: 72, speed: 74, reward: 6, leak: 2, radius: 13, color: '#b5793a', meleeDps: 10, physResist: 0.15 },
  barrel2: { id: 'barrel2', name: 'Barrel Roller', baseHp: 134, speed: 70, reward: 9, leak: 2, radius: 15, color: '#4a86c0', meleeDps: 16, physResist: 0.2 },
  barrel3: { id: 'barrel3', name: 'Ironbarrel', baseHp: 248, speed: 65, reward: 14, leak: 3, radius: 18, color: '#8a5ec0', meleeDps: 25, physResist: 0.25 },
  barrel4: { id: 'barrel4', name: 'Siege Barrel', baseHp: 430, speed: 60, reward: 21, leak: 4, radius: 21, color: '#d4b24a', meleeDps: 35, physResist: 0.3 },
  barrel5: { id: 'barrel5', name: 'The Colossus Keg', baseHp: 2600, speed: 65, reward: 220, leak: 22, radius: 33, color: '#6a4a8f', meleeDps: 66, physResist: 0.35, magResist: 0.15, isBoss: true },
}

/**
 * ---------------------------------------------------------------------------
 * Elite modifiers (WS8)
 * ---------------------------------------------------------------------------
 *
 * An elite used to be "the same wave, denser, one tier up". That is a bigger
 * question, not a different one, and the balance suite measured exactly what
 * that is worth: Banner 2 — *Elite Watch*, which turns every battle node into an
 * elite — priced out at **−1pt of win rate** while carrying the ladder's
 * second-largest payout multiplier. The rung was very nearly free.
 *
 * A modifier is the honest fix. It changes what an elite column *is*, on the one
 * axis the game already teaches: which damage type gets through, and how long a
 * defence has to apply it.
 *
 *  - **Plated** — physical bounces, magic does not. The armour column proper,
 *    and it rolls 10% slower for it (`speedMult` 0.9).
 *  - **Warded** — magic bounces, physical does not. Its mirror.
 *  - **Swift** — neither bounces; they move **40% faster**, which is 29% sooner,
 *    not 40% (`speedMult` 1.4 ⇒ crossing time ×1/1.4 = 0.714). This line used to
 *    say "arrive 40% sooner" while the player-facing blurb below correctly said
 *    "40% faster"; a speed multiplier and a time saving are not the same number
 *    and the one the maintainer reads should not be the wrong one. `enemies.ts`'s
 *    own note is that *time in range* is the difficulty axis Threat cannot
 *    touch, so this is the modifier a bigger HP number cannot imitate.
 *
 * **Every modifier leaves one damage type fully viable.** Plated zeroes magic
 * resistance and Warded zeroes physical, so a modified elite is a counter-pick
 * question with an answer, never a wall that resists everything the company
 * brought. That is the difference between varying the problem and taxing the
 * player.
 *
 * ### Two identities, on purpose
 *
 * A variant is registered under a **key** (`barrel3_plated`) but keeps the base
 * type's **`id`** (`barrel3`). The key is the gameplay identity: `SpawnEvent`
 * names it, `waveComposition` groups by it, and the pre-wave preview looks it up
 * to print "Plated Ironbarrel ×7 — shrugs off physical 55%", so the modifier is
 * disclosed by the same code path that already discloses faction resistances.
 * The `id` is the *art* identity: the renderer resolves sprites, animation
 * frames and the tier tag off `type.id`, and a variant is the same goblin
 * wearing more iron — it must draw as one.
 *
 * `baseHp` is deliberately **untouched** by every modifier. The encounter budget
 * in `waves.ts` is solved per point of roster HP, so scaling a variant's base HP
 * changes nothing but the number on the bar; leaving it alone keeps a modifier
 * strictly qualitative and keeps the elite's *size* the property that
 * `ELITE_BUDGET` alone controls.
 */
export interface EnemyMod {
  /** Key suffix, e.g. `barrel3` + `plated` → `barrel3_plated`. */
  id: string
  /** Display prefix on the enemy's name, shown in the pre-wave preview. */
  prefix: string
  /** One line, for anything that wants to explain the column. */
  blurb: string
  speedMult: number
  /** Resistance the modifier grants, before the cap. */
  physResist: number
  magResist: number
  /** Multiplier on whatever resistance the base type already had. */
  physKeep: number
  magKeep: number
}

/** No resistance may pass this: a wall with no answer is not a decision. */
const RESIST_CAP = 0.55

export const ENEMY_MODS: readonly EnemyMod[] = [
  {
    id: 'plated',
    prefix: 'Plated',
    // Says all three things the modifier does. It used to name the two
    // resistances and leave out `speedMult` entirely, so the one modifier that
    // makes a column *slower* — a real and readable advantage to the defence —
    // was undisclosed on the card that discloses the other two.
    blurb: 'physical damage bounces; magic goes straight through — and it rolls 10% slower',
    speedMult: 0.9,
    physResist: 0.3,
    magResist: 0,
    physKeep: 1,
    magKeep: 0,
  },
  {
    id: 'warded',
    prefix: 'Warded',
    blurb: 'magic damage bounces; steel goes straight through',
    speedMult: 1,
    physResist: 0,
    magResist: 0.34,
    physKeep: 0,
    magKeep: 1,
  },
  {
    id: 'swift',
    prefix: 'Swift',
    blurb: 'lightly armoured and 40% faster — coverage, not damage type',
    speedMult: 1.4,
    physResist: 0,
    magResist: 0,
    physKeep: 0.5,
    magKeep: 0.5,
  },
]

export const modById = (id: string): EnemyMod | null => ENEMY_MODS.find((m) => m.id === id) ?? null

/** The registry key for a base type under a modifier (`null` → the base type). */
export const modKey = (typeId: string, mod: string | null): string => (mod ? `${typeId}_${mod}` : typeId)

function applyMod(base: EnemyType, m: EnemyMod): EnemyType {
  const phys = Math.min(RESIST_CAP, (base.physResist ?? 0) * m.physKeep + m.physResist)
  const mag = Math.min(RESIST_CAP, (base.magResist ?? 0) * m.magKeep + m.magResist)
  return {
    ...base,
    // NOT `${base.id}_${m.id}`: the renderer resolves sprites and the tier tag
    // off `type.id`, and a modified goblin is the same goblin. See above.
    id: base.id,
    name: `${m.prefix} ${base.name}`,
    speed: Math.round(base.speed * m.speedMult),
    physResist: phys > 0 ? Math.round(phys * 100) / 100 : undefined,
    magResist: mag > 0 ? Math.round(mag * 100) / 100 : undefined,
  }
}

// Registered for every base type and every modifier, so an elite column at any
// tier — and the champion leading it — can wear one.
for (const base of Object.values({ ...ENEMY_TYPES })) {
  for (const m of ENEMY_MODS) ENEMY_TYPES[modKey(base.id, m.id)] = applyMod(base, m)
}
