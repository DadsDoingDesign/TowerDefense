/**
 * Armour fairness eval (Oct 2026): how hard is a Plated or Warded fight for a
 * company that brought the wrong damage type, at three armour levels?
 *
 * The designer's rule: an armoured fight is shown on the map, and the goblins
 * in it are "not unkillable by the other type, just much harder — like an
 * elite you can plan for". So the eval asks, per level, per depth:
 *
 *  - a MATCHED company (magic into Plated, steel into Warded) — should play
 *    about like a plain fight;
 *  - a MIXED company (half each) — what a player brings without planning —
 *    should feel it, not break on it;
 *  - a MISMATCHED company (steel into Plated, magic into Warded) — should be
 *    "much harder": a real drop in clears, yet still able to win.
 *
 * Levels move the modifier's bonus AND the resist cap together, so the
 * already-armoured goblins (a barrel's own plate, a bomber's own ward) reach
 * the new cap the way they reach 55% today:
 *
 *   55  shipped: Plated +0.30, Warded +0.34, cap 0.55
 *   65  +0.10 on both, cap 0.65
 *   70  +0.15 on both, cap 0.70
 *
 * Two fight shapes: the ELITE columns as they ship (Plated Column / Warded
 * Host, forced), and an ORDINARY fight with every goblin wearing the modifier
 * (the planned extension), each against the same encounter unmodified.
 *
 * Two measures per cell:
 *  - damage needed: exact, from the wave — how much more damage the company
 *    must deal to kill it than the same wave unarmoured;
 *  - clear rate and Gate HP lost, simulated, at a pressure where a MIXED
 *    company clears the unarmoured fight about 70% of the time (see
 *    `fairScale`).
 *
 *   npx tsx balance/armour-eval.ts [n] [part]   (n companies per cell, default 40;
 *                                               part: elite | ordinary)
 *
 * Not a gate; nothing under `src/` changes.
 */
import { ENEMY_MODS, ENEMY_TYPES, modKey } from '../src/game/data/enemies'
import { generateEncounter } from '../src/game/data/waves'
import { hashSeed } from '../src/game/core/rng'
import { nodeThreatMult, threatAtLayer } from '../src/game/run/threat'
import { MAX_BASE_HP } from '../src/game/run/economy'
import type { WaveDef } from '../src/game/types'
import { buildSpec, PLAYER, runBattle } from './harness'
import { BATTLE_CAP, mcLevel, mcRarity } from './runsim'

const N = Number(process.argv[2]) || 40
/** `elite` or `ordinary` to run one part (parts run in parallel shells). */
const ONLY = process.argv[3] ?? 'elite+ordinary'
const DEPTHS = [3, 6, 9]
const LEVELS = [
  { id: '55', shift: 0, cap: 0.55 },
  { id: '65', shift: 0.1, cap: 0.65 },
  { id: '70', shift: 0.15, cap: 0.7 },
] as const

// The two pure pools: every hero's damage is its weapon's (sword/axe/bow →
// physical, wand → magic), and burns, traps and thorns carry the same type.
const STEEL = ['berserker', 'weaponmaster', 'vanguard', 'juggernaut', 'deathdealer', 'sharpshooter', 'ranger', 'arbalest']
const MAGIC = ['pyromancer', 'cryomancer', 'stormcaller', 'soulflay', 'plaguebringer', 'doomcaller']
// The company a run fields at that depth (`mcCompany` on a 4-hero roster).
const companySize = (d: number) => Math.min(4, 2 + Math.floor((d - 1) / 4))

// ---- level patching: rewrite every `_plated` / `_warded` key from its base
const BASE = new Map<string, { phys: number; mag: number }>()
for (const [key, t] of Object.entries(ENEMY_TYPES)) BASE.set(key, { phys: t.physResist ?? 0, mag: t.magResist ?? 0 })
function setLevel(shift: number, cap: number) {
  for (const m of ENEMY_MODS) {
    if (m.id === 'swift') continue
    for (const key of Object.keys(ENEMY_TYPES)) {
      if (!key.endsWith(`_${m.id}`)) continue
      const b = BASE.get(key.slice(0, -m.id.length - 1))
      if (!b) continue
      const phys = Math.min(cap, b.phys * m.physKeep + (m.physResist > 0 ? m.physResist + shift : 0))
      const mag = Math.min(cap, b.mag * m.magKeep + (m.magResist > 0 ? m.magResist + shift : 0))
      ENEMY_TYPES[key] = { ...ENEMY_TYPES[key], physResist: phys > 0 ? phys : undefined, magResist: mag > 0 ? mag : undefined }
    }
  }
}

const strip = (w: WaveDef): WaveDef => ({
  ...w,
  spawns: w.spawns.map((s) => ({ ...s, typeId: s.typeId.replace(/_(plated|warded|swift)$/, '') })),
})
const wear = (w: WaveDef, mod: string): WaveDef => ({ ...w, spawns: w.spawns.map((s) => ({ ...s, typeId: modKey(s.typeId, mod) })) })

type Team = 'steel' | 'magic' | 'mixed'
function company(kind: Team, depth: number, i: number) {
  const size = companySize(depth)
  const pick = (pool: string[], k: number) => pool[hashSeed(i * 7 + k, `ae:${kind}`) % pool.length]
  return Array.from({ length: size }, (_, k) => {
    const pool = kind === 'steel' ? STEEL : kind === 'magic' ? MAGIC : k % 2 ? MAGIC : STEEL
    return {
      sentinel: buildSpec(pick(pool, k), { level: mcLevel(depth), gearRarity: mcRarity(depth), seed: i * 10 + k, perkSeed: i * 10 + k }),
      slotId: '',
    }
  })
}

/** Clear rate and mean Gate HP lost for N companies of `team` at `scale` × the node's Threat. */
function fight(wave: WaveDef, team: Team, depth: number, scale: number): { clear: number; lost: number } {
  let won = 0
  let lost = 0
  for (let i = 0; i < N; i++) {
    const m = runBattle({
      team: company(team, depth, i),
      depth,
      wave,
      autoDeploy: true,
      enemyHpMult: threatAtLayer(depth) * nodeThreatMult('battle') * scale,
      baseHp: MAX_BASE_HP,
      maxSeconds: BATTLE_CAP,
      seed: 7000 + i,
      player: PLAYER,
    })
    if (m.cleared) won++
    lost += m.baseHpLost
  }
  return { clear: won / N, lost: lost / N }
}

/**
 * The pressure the comparison is fought at: the HP scale at which a MIXED
 * company clears the UNARMOURED fight closest to 70% of the time — a fight
 * that is fair for a company that did not plan. (At the shipped Threat a
 * depth-3 company of this size clears everything and a depth-9 one almost
 * nothing, which would compare 100% with 100% and 0% with 0%.)
 */
const SCALES = [0.2, 0.35, 0.5, 0.7, 1, 1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 23, 32]
function fairScale(plain: WaveDef, depth: number): number {
  let best = SCALES[0]
  let gap = Infinity
  for (const sc of SCALES) {
    const c = fight(plain, 'mixed', depth, sc).clear
    if (Math.abs(c - 0.7) < gap) (gap = Math.abs(c - 0.7)), (best = sc)
    if (c < 0.4) break
  }
  return best
}

/**
 * The exact part: how much more damage a company must deal to kill the wave,
 * HP-weighted over every goblin in it. A company dealing share `f` physical
 * and `1 − f` magic needs `1 / (f·(1−phys) + (1−f)·(1−mag))` of each goblin's
 * HP. Armoured ÷ plain. (Shield auras, splits and heals are left out: this is
 * the armour alone.)
 */
function effort(wave: WaveDef, f: number): number {
  let hp = 0
  let eff = 0
  for (const sp of wave.spawns) {
    const t = ENEMY_TYPES[sp.typeId]
    const h = t.baseHp * sp.hpMult
    hp += h
    eff += h / (f * (1 - (t.physResist ?? 0)) + (1 - f) * (1 - (t.magResist ?? 0)))
  }
  return eff / hp
}

const t0 = Date.now()
const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(4)
const cell = (c: { clear: number; lost: number }) => `${pct(c.clear)} ${c.lost.toFixed(1).padStart(4)}hp`
const x = (r: number) => `×${r.toFixed(2)}`.padStart(6)
const share = (t: Team) => (t === 'steel' ? 1 : t === 'magic' ? 0 : 0.5)

for (const shape of (['elite', 'ordinary'] as const).filter((s) => ONLY.includes(s))) {
  console.log(`\n## ${shape === 'elite' ? 'Elite columns as shipped (Plated Column / Warded Host)' : 'Ordinary fights, every goblin wearing the modifier (the planned extension)'}`)
  for (const depth of DEPTHS) {
    for (const mod of ['plated', 'warded'] as const) {
      const armoured =
        shape === 'elite'
          ? generateEncounter(depth, 'elite', { variantId: mod, seed: hashSeed(depth, 'ae') })
          : wear(generateEncounter(depth, 'normal', { seed: hashSeed(depth, 'ae') }), mod)
      const plain = strip(armoured)
      const matched: Team = mod === 'plated' ? 'magic' : 'steel'
      const wrong: Team = mod === 'plated' ? 'steel' : 'magic'
      const teams = [matched, 'mixed', wrong] as const
      setLevel(0, 0.55)
      const sc = fairScale(plain, depth)
      const plainEffort = teams.map((t) => effort(plain, share(t)))
      const rows = [
        `\nd${depth} ${mod}: ${armoured.spawns.length} goblins, ${companySize(depth)} heroes, fought at ×${sc} Threat   (matched = ${matched}, wrong = ${wrong})`,
        `               damage needed vs plain     clear · Gate HP lost (of ${MAX_BASE_HP})`,
        `               matched  mixed  wrong      matched       mixed         wrong`,
        `  plain        ${x(1)} ${x(1)} ${x(1)}    ${teams.map((t) => cell(fight(plain, t, depth, sc))).join('    ')}`,
      ]
      for (const L of LEVELS) {
        setLevel(L.shift, L.cap)
        const ef = teams.map((t, i) => x(effort(armoured, share(t)) / plainEffort[i])).join(' ')
        rows.push(`  ${mod} ${L.id}%   ${ef}    ${teams.map((t) => cell(fight(armoured, t, depth, sc))).join('    ')}`)
      }
      setLevel(0, 0.55)
      console.log(rows.join('\n'))
    }
  }
}
console.log(`\n(${((Date.now() - t0) / 1000).toFixed(0)}s)`)
