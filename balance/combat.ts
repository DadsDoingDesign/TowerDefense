/**
 * REPORT §16 — Combat depth (Phase 3a).
 *
 * The behaviour kit, the boss phases, sub-waves and the breather, the Watch
 * Commands and the status interactions, each measured the way `README.md`
 * demands: a bench that can fail, a counter-variant that shows the
 * counterplay the card claims, and an invariant on both.
 *
 * Every row is a PAIRED comparison on identical seeds — the same wave, the
 * same heroes, the same combat stream — so the only thing that differs
 * between the two columns is the one thing the row is about.
 */
import { hashSeed, RNG } from '../src/game/core/rng'
import { BEHAVIOUR_INFO, COLOSSUS_SPLIT, GRUKK_WARCRY, KING_LOB } from '../src/game/data/behaviours'
import { ALL_MAPS, pickBattleMap } from '../src/game/data/maps'
import { encounterSeed, generateEncounter, subWaveCount, variantsFor, type EncounterKind } from '../src/game/data/waves'
import { createSentinel } from '../src/game/data/sentinels'
import type { BehaviourStats, EngineRules } from '../src/game/engine/engine'
import type { Archetype, EffectMods, FocusMode, Sentinel, WaveDef } from '../src/game/types'
import {
  bestSlots,
  buildSpec,
  POST,
  makeWave,
  maxLeak,
  mean,
  NO_INPUT,
  PLAYER,
  runBattle,
  TIER2_NODES,
  type PlayerPolicy,
} from './harness'
import { MC_LAYERS, mcCompany, mcLevel, mcRarity } from './runsim'
import { nodeThreatMult, threatAtLayer } from '../src/game/run/threat'

const f1 = (n: number) => n.toFixed(1)
const pct = (n: number) => `${(n * 100).toFixed(0)}%`
const pp = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n * 100).toFixed(1)}pt`

const SEEDS = [11, 137, 409, 1013, 2411, 5171]

// ------------------------------------------------------------ the benches

interface BenchOpts {
  team: { sentinel: Sentinel; slotId: string }[]
  wave: WaveDef
  focus?: FocusMode
  teamMods?: EffectMods[]
  rules?: Partial<EngineRules>
  player?: PlayerPolicy
  enemyHpMult?: number
}

/** Mean behaviour stats and stop rate of a bench over the seed set. */
function bench(o: BenchOpts): { stop: number; stats: BehaviourStats } {
  const ml = maxLeak(o.wave)
  const rows = SEEDS.map((seed) =>
    runBattle({
      team: o.team,
      depth: 6,
      wave: o.wave,
      baseHp: ml + 2,
      enemyHpMult: o.enemyHpMult ?? 1,
      maxSeconds: 200,
      seed,
      tactics: o.focus ? { focus: o.focus } : undefined,
      teamMods: o.teamMods,
      rules: o.rules,
      player: o.player,
    }),
  )
  const stats = {} as BehaviourStats
  for (const k of Object.keys(rows[0].stats) as (keyof BehaviourStats)[]) stats[k] = mean(rows.map((r) => r.stats[k]))
  return { stop: 1 - mean(rows.map((r) => r.baseHpLost)) / ml, stats }
}

const hero = (a: Archetype, level = 6): Sentinel => {
  let s = createSentinel(a)
  s = { ...s, level, stats: { str: s.stats.str + level, dex: s.stats.dex + level, int: s.stats.int + level } }
  return s
}
const post = (arr: [Sentinel, string][]) => arr.map(([sentinel, slotId]) => ({ sentinel, slotId }))

export interface CombatDepthResult {
  md: string[]
  failures: string[]
  summary: string
}

export function runCombatDepth(): CombatDepthResult {
  const md: string[] = []
  const failures: string[] = []
  const line = (s = '') => md.push(s)

  line('## 16. Combat depth — behaviours, boss phases, sub-waves, commands, interactions (Phase 3a)')
  line('')
  line('Every enemy used to be HP, speed and two resistances; a battle had no input after')
  line('Start. This section measures what replaced that. **Each row is paired**: same wave,')
  line('same heroes, same seeds — the two columns differ only in the thing the row names.')
  line('')

  // ---------------------------------------------------------------- 16a
  line('### 16a. The behaviour kit — does each fire, and does its counter work?')
  line('')
  line('| Enemy → behaviour | Telegraph | Counter | Without counter | With counter | Verdict |')
  line('|---|---|---|--:|--:|---|')

  type Row = { name: string; kind: keyof typeof BEHAVIOUR_INFO; fired: number; base: number; counter: number; unit: string; lowerIsBetter: boolean; counterLabel: string }
  const rows: Row[] = []

  // Shaman — focus.
  {
    const w = makeWave([
      { typeId: 'torch3', count: 8, hpMult: 2.5, gap: 0.5 },
      { typeId: 'torch3_shaman', count: 2, hpMult: 2.5, gap: 1.5, delay: -3 },
    ])
    const team = post([[hero('rogue'), POST.s1], [hero('mystic'), POST.s2], [hero('rogue'), POST.s3]])
    const a = bench({ team, wave: w, focus: 'first' })
    const b = bench({ team, wave: w, focus: 'threat' })
    rows.push({ name: 'Torch Shaman → heal pulse', kind: 'healPulse', fired: a.stats.healPulses, base: a.stats.hpHealed, counter: b.stats.hpHealed, unit: 'HP healed', lowerIsBetter: true, counterLabel: 'Threat targeting' })
  }
  // Berserker — a frost slow drags the enraged sprint back down.
  {
    const w = makeWave([{ typeId: 'torch4', count: 14, hpMult: 3, gap: 0.6 }])
    const team = post([[hero('rogue'), POST.s1], [hero('mystic'), POST.s2]])
    const on = bench({ team, wave: w })
    const onC = bench({ team, wave: w, teamMods: [{ chill: { slow: 0.35, dur: 2 } }] })
    // Normalised by how many enraged: a slow keeps bodies in range longer, so
    // MORE of them cross the threshold — the question is how many of those
    // then make it through.
    const share = (r: typeof on) => (r.stats.enrages > 0 ? r.stats.enragedLeaks / r.stats.enrages : 0)
    rows.push({ name: 'Torch Berserker → enrage', kind: 'enrage', fired: on.stats.enrages, base: share(on) * 100, counter: share(onC) * 100, unit: '% of enraged that reach the Gate', lowerIsBetter: true, counterLabel: 'a frost slow on the line' })
  }
  // Sapper — it blows at the Gate; a blocker on the road holds it and it goes
  // off harmlessly at the wall (the no-HP rule change: heroes are never hurt).
  {
    const w = makeWave([{ typeId: 'tnt4', count: 8, hpMult: 6, gap: 1 }])
    const open = bench({ team: post([[hero('mystic'), POST.s5], [hero('rogue'), POST.s2]]), wave: w })
    const held = bench({ team: post([[hero('fighter'), POST.s5], [hero('rogue'), POST.s2]]), wave: w })
    rows.push({ name: 'Sapper (and Fuse Whelp) → blast at the Gate', kind: 'sapper', fired: open.stats.sapperBlasts, base: open.stats.sapperDamage, counter: held.stats.sapperDamage, unit: 'extra Gate damage from blasts', lowerIsBetter: true, counterLabel: `hold it: a blocking Fighter on the road (${POST.s5}) instead of a Mystic` })
  }
  // Bomber — Threat targeting picks it out of the column and kills it in the wind-up.
  {
    const w = makeWave([
      { typeId: 'torch2', count: 12, hpMult: 3, gap: 0.6 },
      { typeId: 'tnt2', count: 6, hpMult: 3, gap: 1.2, delay: -7 },
    ])
    const team = post([[hero('rogue'), POST.s1], [hero('mystic'), POST.s2], [hero('rogue'), POST.s3]])
    const a = bench({ team, wave: w, focus: 'first' })
    const b = bench({ team, wave: w, focus: 'threat' })
    rows.push({ name: 'Bomber / Demolisher → charge lobbed at the Gate', kind: 'lob', fired: a.stats.lobsStarted, base: a.stats.lobDamage, counter: b.stats.lobDamage, unit: 'Gate damage from charges', lowerIsBetter: true, counterLabel: 'Threat targeting (kill it in the wind-up)' })
  }
  // Splitter — splash: the pieces spawn together, so one blast takes both.
  {
    const w = makeWave([{ typeId: 'barrel4', count: 8, hpMult: 0.45, gap: 1.4 }])
    const team = post([[hero('mystic', 10), POST.s0], [hero('mystic', 10), POST.s1], [hero('mystic', 10), POST.s2]])
    const plain = bench({ team, wave: w })
    const splash = bench({ team, wave: w, teamMods: [{ splashAdd: 50 }] })
    // Normalised by pieces spawned: the question is how many of them get through.
    const share = (r: typeof plain) => (r.stats.splitSpawned > 0 ? r.stats.splitLeaks / r.stats.splitSpawned : 0)
    rows.push({ name: 'Siege Barrel → splits into imps', kind: 'split', fired: plain.stats.splits, base: share(plain) * 100, counter: share(splash) * 100, unit: '% of imps that reach the Gate', lowerIsBetter: true, counterLabel: 'splash on the line' })
  }
  // Shield-bearer — focus the bearer.
  {
    const w = makeWave([
      { typeId: 'barrel3', count: 6, hpMult: 2, gap: 0.8 },
      { typeId: 'barrel3_bearer', count: 2, hpMult: 2, gap: 1.6, delay: -4 },
    ])
    const team = post([[hero('rogue'), POST.s1], [hero('mystic'), POST.s2], [hero('rogue'), POST.s3]])
    const a = bench({ team, wave: w, focus: 'first' })
    const b = bench({ team, wave: w, focus: 'threat' })
    rows.push({ name: 'Shieldbearer → resist aura', kind: 'shieldAura', fired: a.stats.shieldedPrevented > 0 ? 1 : 0, base: a.stats.shieldedPrevented, counter: b.stats.shieldedPrevented, unit: 'damage the shield absorbed', lowerIsBetter: true, counterLabel: 'Threat targeting' })
  }
  // Leaper — a second blocker downstream.
  {
    const w = makeWave([{ typeId: 'barrel2', count: 10, hpMult: 4, gap: 1 }])
    const one = bench({ team: post([[hero('fighter'), POST.s1], [hero('rogue'), POST.s3]]), wave: w })
    const two = bench({ team: post([[hero('fighter'), POST.s1], [hero('fighter'), POST.s4], [hero('rogue'), POST.s3]]), wave: w })
    rows.push({ name: 'Barrel Roller → vaults the first blocker', kind: 'leap', fired: one.stats.leaps, base: one.stats.leapLeaks, counter: two.stats.leapLeaks, unit: 'vaulters reaching the Gate', lowerIsBetter: true, counterLabel: 'a second blocker downstream' })
  }
  const isRate = (u: string) => u.startsWith('stop-rate')
  for (const r of rows) {
    const info = BEHAVIOUR_INFO[r.kind]
    const works = r.lowerIsBetter ? r.counter < r.base : r.counter > r.base
    const fmt = (v: number) => (isRate(r.unit) ? pp(v) : f1(v))
    line(`| ${r.name} | ${info.telegraph} | ${r.counterLabel} | ${fmt(r.base)} ${r.unit} | ${fmt(r.counter)} | ${r.fired > 0 && works ? '✅ fires, counter works' : '❌'} |`)
    if (r.fired <= 0) failures.push(`§16a: behaviour "${r.name}" never fired on its own bench — a behaviour that does nothing is decoration.`)
    else if (!works) failures.push(`§16a: the counter to "${r.name}" (${r.counterLabel}) does not reduce it (${fmt(r.base)} → ${fmt(r.counter)} ${r.unit}). A counterplay the card states must measurably work.`)
  }
  line('')

  // ---------------------------------------------------------------- 16b
  line('### 16b. Boss phases — do they trigger in the fights the game ships?')
  line('')
  const bossStats = { warCries: 0, kingLobs: 0, kingDamage: 0, bossSplits: 0, bossPhases: 0, fights: 0 }
  for (const v of variantsFor('boss', 10)) {
    for (let t = 0; t < 4; t++) {
      const rr = new RNG(hashSeed(t, 'boss16', v.id))
      const ids = Array.from({ length: 4 }, () => rr.pick(TIER2_NODES).id)
      const field = ALL_MAPS[t % ALL_MAPS.length]
      const slots = bestSlots(field)
      const team = ids.map((id, i) => ({ sentinel: buildSpec(id, { level: 20, gearRarity: 'epic', seed: t * 10 + i, perkSeed: t * 10 + i }), slotId: slots[i] }))
      const m = runBattle({ team, depth: 10, kind: 'boss', variantId: v.id, map: field, autoDeploy: true, enemyHpMult: 25, baseHp: 999, maxSeconds: 300, seed: t, player: PLAYER })
      bossStats.fights++
      bossStats.warCries += m.stats.warCries
      bossStats.kingLobs += m.stats.kingLobs
      bossStats.kingDamage += m.stats.kingDamage
      bossStats.bossSplits += m.stats.bossSplits
      bossStats.bossPhases += m.stats.bossPhases
    }
  }
  line(`${bossStats.fights} depth-10 boss fights (every boss variant × 4 legendary teams, Threat ×25):`)
  line('')
  line('| Champion | Phase | Triggered |')
  line('|---|---|--:|')
  line(`| Warlord Grukk | war-cry at ${GRUKK_WARCRY.at.map((a) => `${Math.round(a * 100)}%`).join(' / ')} (allies ×${GRUKK_WARCRY.speedMult} pace for ${GRUKK_WARCRY.dur}s) | ${bossStats.warCries} |`)
  line(`| Powderkeg King | TNT at the Gate every ${KING_LOB.interval}s (${KING_LOB.gateDamage} Gate each); every ${KING_LOB.rageInterval}s below ${Math.round(KING_LOB.rageAt * 100)}% | ${bossStats.kingLobs} lobs, ${f1(bossStats.kingDamage)} Gate damage |`)
  line(`| The Colossus Keg | splits into two halves at ${Math.round(COLOSSUS_SPLIT.at * 100)}% | ${bossStats.bossSplits} |`)
  line(`| (all) | \`bossPhase\` events | ${bossStats.bossPhases} |`)
  line('')
  if (bossStats.warCries === 0 || bossStats.kingLobs === 0 || bossStats.bossSplits === 0) {
    failures.push(`§16b: a boss phase never triggered across ${bossStats.fights} shipped boss fights (war-cries ${bossStats.warCries}, King lobs ${bossStats.kingLobs}, Colossus splits ${bossStats.bossSplits}).`)
  }

  // ---------------------------------------------------------------- 16c
  line('### 16c. Sub-waves — a partition of the node, not a different node')
  line('')
  let nodes = 0
  let bad = 0
  const counts = new Map<string, number>()
  for (let depth = 1; depth <= 10; depth++) {
    for (const kind of ['normal', 'elite', 'boss'] as EncounterKind[]) {
      for (const v of variantsFor(kind, depth)) {
        const w = generateEncounter(depth, kind, { variantId: v.id, seed: 7 })
        const groups = new Set(w.spawns.map((s) => s.group ?? 0))
        nodes++
        counts.set(`${kind}`, groups.size)
        if (groups.size !== subWaveCount(depth, kind) || groups.size < 2 || groups.size > 3) bad++
      }
    }
  }
  line(`- ${nodes} generated node shapes checked (every depth × kind × variant): **${nodes - bad}** cut into 2–3 sub-waves as specified (normal ${counts.get('normal')}, elite ${counts.get('elite')}, boss ${counts.get('boss')} at depth 10).`)
  line('- The cut is a partition of the spawn list `generateEncounter` already produced, so head count and composition are exact by construction; `tests/encounterPreview.test.ts` holds the map preview to the same derivation.')
  line('')
  if (bad > 0) failures.push(`§16c: ${bad} of ${nodes} generated node shapes are not cut into the specified 2–3 sub-waves.`)

  // ---------------------------------------------------------------- 16d
  line('### 16d. Decision value — what the new inputs are worth, and what the worst use costs')
  line('')
  line('A battery of real campaign encounters (depth 3, the act-1 boss, 5, the depth-6 elite, 9 and the final boss) against')
  line('§6-shaped random companies at depth-appropriate power and the Threat a full run carries,')
  line('on both fields. Metric: **base HP lost** per node (lower is better), mean over the battery.')
  line('')
  // The §6 model's own nodes: an act-1 battle, the act-1 boss, act-2 battle and
  // elite, act-3 battle, and the final boss.
  const battery: { depth: number; kind: EncounterKind }[] = [
    { depth: 3, kind: 'normal' },
    { depth: 4, kind: 'boss' },
    { depth: 5, kind: 'normal' },
    { depth: 6, kind: 'elite' },
    { depth: 9, kind: 'normal' },
    { depth: MC_LAYERS, kind: 'boss' },
  ]
  const TEAMS = 20
  const lost = (player: PlayerPolicy, focus: FocusMode, rules?: Partial<EngineRules>, subWaves?: boolean): number => {
    const out: number[] = []
    for (let t = 0; t < TEAMS; t++) {
      const rr = new RNG(hashSeed(t, 'dv16'))
      const size = 3 + Math.floor(rr.next() * 3)
      const ids = Array.from({ length: size }, () => rr.pick(TIER2_NODES).id)
      const field = pickBattleMap(hashSeed(t, 'dv16field'))
      const slots = bestSlots(field)
      for (const b of battery) {
        const team = ids.slice(0, mcCompany(b.depth, ids.length)).map((id, i) => ({
          sentinel: buildSpec(id, { level: mcLevel(b.depth), gearRarity: mcRarity(b.depth), seed: t * 10 + i, perkSeed: t * 10 + i }),
          slotId: slots[i],
        }))
        const threat = threatAtLayer(b.depth) * nodeThreatMult(b.depth === MC_LAYERS ? 'boss' : b.kind === 'elite' ? 'elite' : 'battle')
        const m = runBattle({
          team,
          depth: b.depth,
          kind: b.kind,
          map: field,
          autoDeploy: true,
          variantSeed: encounterSeed(hashSeed(t, 'dv16'), b.depth),
          enemyHpMult: threat,
          baseHp: 60,
          maxSeconds: 300,
          seed: t * 7 + b.depth,
          player,
          tactics: { focus },
          rules,
          subWaves,
        })
        out.push(m.baseHpLost)
      }
    }
    return mean(out)
  }
  const base = lost(PLAYER, 'first')
  const cells: [string, number][] = [
    ['Rally Horn — never', lost(NO_INPUT, 'first')],
    ['Rally Horn — first tick of each sub-wave', lost({ command: 'early', reposition: 'none' }, 'first')],
    ['Rally Horn — when enough of the column is in reach (the modelled player)', base],
    ['Rally Horn — on the last one or two bodies', lost({ command: 'finish', reposition: 'none' }, 'first')],
    ['Targeting: Threat instead of First', lost(PLAYER, 'threat')],
    ['Breather: a fighter onto the first post', lost({ command: 'surge', reposition: 'sponge' }, 'first')],
    ['Breather: weakest post → best-covered free post', lost({ command: 'surge', reposition: 'cover' }, 'first')],
    ['Breather: best hero → worst free post', lost({ command: 'surge', reposition: 'uncover' }, 'first')],
  ]
  const focusModes: FocusMode[] = ['first', 'lowestHp', 'strongest', 'nearest', 'threat']
  const focusCells = focusModes.map((f) => (f === 'first' ? base : f === 'threat' ? cells[4][1] : lost(PLAYER, f)))
  line('| Input policy | Base HP lost / node | vs the modelled player |')
  line('|---|--:|--:|')
  for (const [label, v] of cells) line(`| ${label} | ${v.toFixed(2)} | ${v === base ? '—' : `${v - base >= 0 ? '+' : '−'}${Math.abs(v - base).toFixed(2)}`} |`)
  line('')
  const never = cells[0][1]
  const timings = [cells[1][1], cells[2][1], cells[3][1]]
  const commandValue = never - Math.min(...timings)
  const commandSpread = Math.max(...timings) - Math.min(...timings)
  const focusSpread = Math.max(...focusCells) - Math.min(...focusCells)
  const repos = [base, cells[5][1], cells[6][1], cells[7][1]]
  const repoSpread = Math.max(...repos) - Math.min(...repos)
  // Pre-3a: the continuous wave, no kit, no interactions, no commands, no
  // breathers — the ONLY in-battle decision the game had was the targeting
  // order (four of them; 'threat' did not exist).
  const PRE = { behaviours: false, interactions: false, subWaves: false }
  const preCells = (['first', 'lowestHp', 'strongest', 'nearest'] as FocusMode[]).map((f) => lost(NO_INPUT, f, PRE, false))
  const preBase = preCells[0]
  const preSpread = Math.max(...preCells) - Math.min(...preCells)
  // Every in-battle decision now, best of each axis against worst of each.
  const bestAll = Math.min(...timings, never, ...focusCells, ...repos)
  const worstAll = Math.max(...timings, never, ...focusCells, ...repos)
  line(`- **The Rally Horn** used at the best timing saves **${commandValue.toFixed(2)}** base HP a node over never pressing it; **timing alone** (best vs worst of three) spans **${commandSpread.toFixed(2)}**.`)
  line(`- **Targeting** (five orders) spans **${focusSpread.toFixed(2)}**/node.`)
  line(`- **The breather's move** spans **${repoSpread.toFixed(2)}**/node across none / sponge / cover / uncover.`)
  line(`- **Before Phase 3a** (continuous wave, no kit, no commands, no breathers) the targeting order was the only in-battle input, and its four orders spanned **${preSpread.toFixed(2)}**/node on a baseline of ${preBase.toFixed(2)} (**${pct(preBase > 0 ? preSpread / preBase : 0)}** of it). Now the best-vs-worst policy spread across every input is **${(worstAll - bestAll).toFixed(2)}**/node on a baseline of ${base.toFixed(2)} (**${pct(base > 0 ? (worstAll - bestAll) / base : 0)}** of it).`)
  line('')
  /**
   * Command value is BOUNDED on both sides. A Rally Horn worth nothing is a
   * button with no decision behind it; one worth most of a node is a
   * mandatory tap that the whole campaign's difficulty is then quietly tuned
   * around. The band is in base HP per node against a 20-HP base.
   */
  const COMMAND_VALUE_BAND: [number, number] = [0.05, 3]
  if (commandValue < COMMAND_VALUE_BAND[0] || commandValue > COMMAND_VALUE_BAND[1]) {
    failures.push(`§16d: Rally Horn used well is worth ${commandValue.toFixed(2)} base HP/node over never using it — outside the ${COMMAND_VALUE_BAND[0]}–${COMMAND_VALUE_BAND[1]} band (a command must matter, and must not be the game).`)
  }

  // ---------------------------------------------------------------- 16e
  line('### 16e. Status interactions — rules, measured on and off')
  line('')
  {
    const swarm = makeWave([{ typeId: 'torch2', count: 18, hpMult: 9, gap: 0.35 }])
    const team = post([[hero('mystic', 8), POST.s2], [hero('rogue', 8), POST.s4]])
    const frostShock: EffectMods[] = [{ chill: { slow: 0.25, dur: 2 } }, { shock: { chains: 2, dmgFrac: 0.45 } }]
    // Spread is a granted capability (the Ember Urn relic's flag).
    const burn: EffectMods[] = [{ burn: { dps: 30, dur: 4 }, splashAdd: 20, burnSpreadOnDeath: true }]
    const frost: EffectMods[] = [{ chill: { slow: 0.25, dur: 2 } }]
    const fsOn = bench({ team, wave: swarm, teamMods: frostShock })
    const fsOff = bench({ team, wave: swarm, teamMods: frostShock, rules: { interactions: false } })
    const bOn = bench({ team, wave: swarm, teamMods: burn })
    const bOff = bench({ team, wave: swarm, teamMods: burn, rules: { interactions: false } })
    const phys = post([[hero('rogue', 8), POST.s2], [hero('fighter', 8), POST.s4]])
    const frOn = bench({ team: phys, wave: swarm, teamMods: frost })
    const frOff = bench({ team: phys, wave: swarm, teamMods: frost, rules: { interactions: false } })
    line('| Rule | Fired | Stop rate on | off | Δ |')
    line('|---|--:|--:|--:|--:|')
    line(`| SHATTER — frost + shock burst (${Math.round(0.6 * 100)}% of the hit) | ${f1(fsOn.stats.shatters)} | ${pct(fsOn.stop)} | ${pct(fsOff.stop)} | ${pp(fsOn.stop - fsOff.stop)} |`)
    line(`| SPREAD (Ember Urn) — a burning death lights 2 neighbours | ${f1(bOn.stats.burnSpreads)} | ${pct(bOn.stop)} | ${pct(bOff.stop)} | ${pp(bOn.stop - bOff.stop)} |`)
    line(`| BRITTLE — frosted bodies take +25% physical | ${f1(frOn.stats.brittleBonus)} dmg | ${pct(frOn.stop)} | ${pct(frOff.stop)} | ${pp(frOn.stop - frOff.stop)} |`)
    line('')
    line('Burn keeps its audit-era arithmetic: it is resisted by the burning tower\'s damage type through the same `takenMult` the tick differ re-runs, so a spread burn is resisted exactly as the burn it came from.')
    line('')
    if (fsOn.stats.shatters <= 0 || bOn.stats.burnSpreads <= 0 || frOn.stats.brittleBonus <= 0) {
      failures.push('§16e: a status interaction never fired on its bench (shatter / spread / brittle).')
    }
  }

  const summary = `Combat depth: Rally value ${commandValue.toFixed(2)} HP/node (timing spread ${commandSpread.toFixed(2)}), focus spread ${focusSpread.toFixed(2)}, reposition spread ${repoSpread.toFixed(2)}; all-input spread ${(worstAll - bestAll).toFixed(2)} on ${base.toFixed(2)} vs pre-3a ${preSpread.toFixed(2)} on ${preBase.toFixed(2)}; boss phases: ${bossStats.warCries} war-cries / ${bossStats.kingLobs} King lobs / ${bossStats.bossSplits} splits`
  return { md, failures, summary }
}
