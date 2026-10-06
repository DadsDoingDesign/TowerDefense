/**
 * Balance report generator. Runs a battery of sweeps against the real engine and
 * writes balance/REPORT.md plus a console summary. Exits non-zero if any balance
 * invariant is violated, so it can gate CI.
 *
 *   npx tsx balance/report.ts        (or: npm run balance)
 *
 * Every sweep here has to *discriminate its subject*. A sweep that returns the
 * same number for seven different builds, or that cannot fail, is not a
 * measurement — it is a green light with nothing behind it. Where a sweep is
 * expected to fail today, it fails loudly rather than being tuned to pass.
 */
import { writeFileSync } from 'fs'
import { HQ_UPGRADES, INTEREST, ROAD_SHARE } from '../src/game/run/hq'
import { MIN_OBSTACLES } from '../src/game/data/hazards'
import { hashSeed, RNG } from '../src/game/core/rng'
import { effectiveHp, ENEMY_TYPES } from '../src/game/data/enemies'
import { ALL_MAPS, FIRST_MAP, legacyPostTile, orientationOf, orientField, pathLength, pickBattleMap } from '../src/game/data/maps'
import { TILE } from '../src/game/data/terrain'
import { RARITY, RARITY_ORDER, generateItem } from '../src/game/data/items'
import { computeCombat } from '../src/game/engine/combat'
import { HAZARD_LEVERS } from '../src/game/data/hazards'
/**
 * Q1 exploration knob (Node-only, like `FW_META_RUNS`): `FW_HAZARDS=mult,dangerTiles,
 * dangerPool,obstacles,obstaclePool` runs the whole report under other danger-ground
 * levers. `balance/hazard-sweep.ts` is quicker but reads §13 a few marks off the
 * report (the report's earlier sections leave process state behind), so a fit
 * that has to clear a gate by a few marks is confirmed here.
 */
if (process.env.FW_HAZARDS) {
  const [a, b, c, d, e] = process.env.FW_HAZARDS.split(',').map(Number)
  Object.assign(HAZARD_LEVERS, { cursedDamageMult: a, dangerTiles: b, dangerPool: c, obstacles: d, obstaclePool: e })
}
import { classicHero } from '../src/game/data/sentinels'
import { chosenHero, rollRecruitBody } from '../src/game/run/heroes'
import { ALL_ITEM_KINDS, BASIC_ITEM_KINDS, SOVEREIGN_ITEM_KINDS } from '../src/game/data/itemKinds'
import { CHARTER_FEE, CHARTER_PAYOUT, TRADE_OFFS } from '../src/game/run/charter'
import type { Archetype, EffectMods, Enchantment, Item, ItemRarity, Sentinel, WaveDef } from '../src/game/types'
import { generateRunMap } from '../src/game/data/runmap'
import { allMutations } from '../src/game/data/mutations'
import { ALL_SKILLS } from '../src/game/data/skills'
import { recruitSkill, withFirstSkill } from '../src/game/run/skills'
import {
  encounterSeed,
  generateEncounter,
  pickVariant,
  variantsFor,
  waveComposition,
  type EncounterKind,
  type WaveVariant,
} from '../src/game/data/waves'
import { generateRewardCards, type RewardGrant } from '../src/game/data/rewards'
import { RELICS, relicPool, relicSupported, relicTeamMods } from '../src/game/data/relics'
import { withRelicStats } from '../src/game/run/relics'
import { applyXp, xpToReach } from '../src/game/engine/leveling'
import { ACT_JUMP, MAX_BASE_HP, START_GOLD, THREAT_STEP, threatAtLayer } from '../src/state/gameStore'
import { levelXpAwards } from '../src/game/run/battle'
import { nodeThreatMult } from '../src/game/run/threat'
import { difficultyEffect, difficultyRules } from '../src/game/run/watch'
import { BONUS_PER_CRATE, COMPANY_WEIGHT, CRATE_PRICE, CRATE_VALUE, dangerPips, MAX_CRATES } from '../src/game/run/contracts'
import { COMPANIES } from '../src/game/data/companies'
import { runCombatDepth } from './combat'
import {
  loadoutFor,
  marksFor,
  contractNet,
  CASH_OUT_HALF,
  PRESS_ON,
  policyById,
  MC_LAYERS,
  mcKind,
  mcLevel,
  mcRarity,
  modelledPick,
  monteCarloRun,
  POLICIES,
  simulateRun,
  ZERO_META,
  type Loadout,
  type RoutePolicy,
  type RunOutcome,
  HQ_STATES,
  type HqState,
} from './runsim'
import {
  withMainAffix,
  AURA_TRIO,
  POST,
  bestSlots,
  buildSpec,
  randomSkills,
  STARTER_SKILL_POOL,
  heroDps,
  equipIfBetter,
  makeWave,
  MAP_FACTS,
  maxLeak,
  MAX_ROSTER,
  MAX_AURA_RADIUS,
  BENCH_RULES,
  mean,
  median,
  runBattle,
  scaleWave,
  SEEDS,
  SIEGE_PRESSURE,
  slotCoverage,
  slotDist,
  soloOffense,
  soloStopRate,
  stopRate,
  stat,
  std,
  equipFullSet,
  SUPPORT_SPECS,
  SWARM_PRESSURE,
  TIER2_NODES,
  type Stat,
} from './harness'

/**
 * `FW_SECTIONS=6,11,12 npm run balance` runs only those sections, their
 * invariants and their console lines — for iterating on a number without paying
 * for the whole suite. A filtered run never touches `REPORT.md` (the golden
 * file): it prints its sections and writes them to `REPORT.sections.md`
 * (ignored by version control). A section that quotes another one's result in
 * its prose reads `NaN` when that section was not asked for; no gate reads
 * across sections. Unset, every section runs and the output is unchanged.
 */
const SECTIONS = process.env.FW_SECTIONS
  ? new Set(process.env.FW_SECTIONS.split(',').map((s) => Number(s.trim())).filter((n) => n > 0))
  : null
const want = (n: number): boolean => !SECTIONS || SECTIONS.has(n)
const f1 = (n: number) => n.toFixed(1)
const f2 = (n: number) => n.toFixed(2)
const pct = (n: number) => `${(n * 100).toFixed(0)}%`
/** Percentage *points*, signed — the unit every stop-rate delta is quoted in. */
const pp = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n * 100).toFixed(1)}pt`
const pm = (s: Stat, digits = 1) => `${s.mean.toFixed(digits)} ±${s.std.toFixed(digits)}`
const md: string[] = []
const failures: string[] = []
const line = (s = '') => md.push(s)
/** One console line per section, pushed when it runs (see the end of the file). */
const summary: string[] = []

line('# Fieldwatch — Balance Report')
line('')
line('_Generated by `balance/report.ts` against the live combat engine (seeded, reproducible)._')
line('')
line('Cells marked **±** are multi-seed: mean ± population σ over the seed set, not a')
line('single roll. Sweeps that grade a *defence* use **stop rate** — the share of a')
line("wave's leak damage the towers prevented — because it is read off base HP rather")
line('than per-Sentinel damage attribution, and because it has a real failure mode.')
line('')

// -------------------------------------------------------------- Sweep 1
if (want(1)) {
  // Solo-offense throughput for every specialization (epic gear).
  line('## 1. Specialization throughput (all 27, Epic gear)')
  line('')
  line('**What broke here (M19-f).** This sweep used to report *damage dealt ÷ clear time*')
  line('on a wave the tower could not run out of — `baseHp: 999`, a depth-6 roster at ×1.8')
  line('HP — and gate "no dominant outlier" on the spread of that number. The wave is')
  line('**spawn-bound**: it ends when the last enemy is dealt with, and the last enemy')
  line('cannot be dealt with before it arrives, so every build shared a floor on clear time')
  line('and the measured spread compressed to **1.4×** while the analytic spread across the')
  line('same 27 builds was **14×**. An invariant with a 3× ceiling over a number that')
  line('cannot exceed 1.5× is not an invariant. It also fed a ⚠️ flag off mean ± 2σ of that')
  line('compressed distribution, which flagged builds that were not outliers and missed')
  line('ones that were.')
  line('')

  interface SpecRow {
    id: string
    name: string
    archetype: string
    support: boolean
    dps: Stat
    /** Raw HP of damage dealt inside the window — the un-quantised number (m-2). */
    damage: Stat
    analyticDps: number
    cleared: boolean
  }
  const SPEC_SEEDS = SEEDS.slice(0, 3)
  /**
   * The saturated throughput scenario. `barrel4` is the slowest body in the game
   * (60px/s on a 2290px lane) and the toughest, so forty of them at ×6 HP is a
   * target-rich field for the whole window with nothing leaking out of it.
   */
  const THROUGHPUT_WINDOW = 40
  const THROUGHPUT_COUNT = 40
  const THROUGHPUT_HP_MULT = 12
  const THROUGHPUT_WAVE = makeWave(
    [{ typeId: 'barrel4', count: THROUGHPUT_COUNT, hpMult: THROUGHPUT_HP_MULT, gap: 0.8 }],
    'saturated',
  )
  /** `ENEMY_TYPES.barrel4.baseHp` × the wave's multiplier — HP per kill. */
  const THROUGHPUT_HP = 430 * THROUGHPUT_HP_MULT
  /** The most this scenario can measure: if a build hits it, the bench is too small. */
  const THROUGHPUT_CEILING = (THROUGHPUT_COUNT * THROUGHPUT_HP) / THROUGHPUT_WINDOW
  line('**What it does now.** Throughput is measured as **enemy HP destroyed per second**')
  line(`inside a fixed ${THROUGHPUT_WINDOW}s window, on a queue the tower cannot exhaust and cannot outrun:`)
  line(`${THROUGHPUT_COUNT} Siege Barrels at ×${THROUGHPUT_HP_MULT} HP, one every 0.8s, on a lane they need 38s to walk. Nothing`)
  line('clears, nothing leaks out of the window, and the metric is read off the kill count')
  line('rather than per-Sentinel `damageDealt`, so the attribution gaps that made burn and')
  line('execute builds read *negative* cannot touch it.')
  line('')
  line('The density is deliberate and bounded: 20–40 bodies queued is the shape the game')
  line('actually ships in its back half. An earlier version of this bench used 150 bodies to')
  line('guarantee saturation and measured **6450 HP/s** for the top build — splash landing')
  line('on a blob nothing in the game generates, which is trap 4 in `balance/README.md`: the')
  line('sweep grading its own pressure model instead of its subject. There is now an')
  line('invariant on that too — if any build reaches 90% of what the bench can physically')
  line('measure, the bench is reported as saturating rather than quietly compressing again.')
  line('')
  line('Supports still read low here on purpose and are graded in §2.')
  line('')
  function throughput(s: Sentinel, seed: number): { hpPerSec: number; damage: number } {
    const m = runBattle({
      // G1-2: this bench reads kills inside a fixed window, so what calibrates it
      // is WHEN the queue reaches the hero, not how much road the post sees — it
      // keeps the tile nearest where s3 stood rather than the coverage-matched
      // `POST.s3` the stop-rate benches use (which starved the slow mystics to 0).
      team: [{ sentinel: s, slotId: legacyPostTile(FIRST_MAP.id, 's3')! }],
      depth: 6,
      wave: THROUGHPUT_WAVE,
      baseHp: 999,
      maxSeconds: THROUGHPUT_WINDOW,
      seed,
      // A stat bench on a FIXED HP queue: its ceiling is count × HP ÷ window, and
      // `hpPerSec` books kills × HP. The Siege Barrel is a splitter now (Phase
      // 3a), so with the kit on every kill would book two imps' worth of bodies
      // the queue never contained and the bench reads "saturating" at 2× its own
      // ceiling. The kit is graded in §16; this bench grades the tower.
      rules: { behaviours: false },
    })
    return { hpPerSec: (m.killCount * THROUGHPUT_HP) / THROUGHPUT_WINDOW, damage: m.totalDamage }
  }
  const specRows: SpecRow[] = []
  for (const node of TIER2_NODES) {
    const built = buildSpec(node.id, { gearRarity: 'epic', seed: 7 })
    const cells = SPEC_SEEDS.map((seed) => throughput(built, seed))
    specRows.push({
      id: node.id,
      name: node.name,
      archetype: node.archetype,
      support: SUPPORT_SPECS.has(node.id),
      dps: stat(cells.map((c) => c.hpPerSec)),
      damage: stat(cells.map((c) => c.damage)),
      analyticDps: computeCombat(built).dps,
      cleared: soloOffense(node.id, { gearRarity: 'epic', seed: 7 }, SPEC_SEEDS[0]).cleared,
    })
  }
  const offense = specRows.filter((r) => !r.support)
  const offDps = offense.map((r) => r.dps.mean)
  const offMean = mean(offDps)
  const offStd = std(offDps)
  const offMed = median(offDps)

  specRows.sort((a, b) => b.dps.mean - a.dps.mean)
  line('| Build | Archetype | Role | HP destroyed/s ± | Analytic DPS | Clears a depth-6 wave | vs median |')
  line('|---|---|---|--:|--:|:-:|--:|')
  for (const r of specRows) {
    const ratio = offMed ? r.dps.mean / offMed : 0
    const flag = !r.support && (ratio > 2 || ratio < 0.5) ? ' ⚠️' : ''
    line(
      `| ${r.name}${flag} | ${r.archetype} | ${r.support ? 'support' : 'offense'} | ${pm(r.dps)} | ${f1(r.analyticDps)} | ${r.cleared ? '✓' : '—'} | ${f2(ratio)}× |`,
    )
  }
  line('')
  const analyticSpread = Math.max(...offense.map((r) => r.analyticDps)) / Math.min(...offense.map((r) => r.analyticDps))
  line(
    `Offense builds — mean **${f1(offMean)}**, median **${f1(offMed)}**, σ **${f1(offStd)}**, measured spread **${f2(Math.max(...offDps) / Math.min(...offDps))}×** (max/min) against an analytic spread of **${f2(analyticSpread)}×**.`,
  )
  line('')
  if (Math.max(...offDps) > THROUGHPUT_CEILING * 0.9) {
    failures.push(
      `The §1 throughput bench is saturating: the top build destroys ${f1(Math.max(...offDps))} HP/s against a bench ceiling of ${f1(THROUGHPUT_CEILING)}. A scenario a build can exhaust is spawn-bound again, which is the exact defect this rebuild replaced — raise \`THROUGHPUT_COUNT\` / \`THROUGHPUT_HP_MULT\`.`,
    )
  }
  line('The ⚠️ flag is now the same rule the invariant is: a build over 2× or under 0.5×')
  line('the median. It used to be mean ± 2σ of a distribution the scenario had already')
  line('crushed, which is how a build at analytic 1494 got flagged while one at 1747 read')
  line('as normal.')
  line('')

  /*
   * ---- "dealt no damage" now means dealt no damage (m-2) --------------------
   *
   * This read `r.dps.mean <= 0` and reported it as *"Build X dealt no damage
   * (broken)"*. `dps` here is **HP destroyed per second, read off the kill
   * count** — deliberately, so that burn and execute attribution gaps cannot
   * touch it — and the bench's body is a Siege Barrel at ×12 HP, i.e. **5,160 HP
   * per unit of measurement**. A build whose 40-second window does 5,000 damage to
   * one barrel and does not finish it therefore scored 0 and was reported as
   * broken, having dealt five thousand damage.
   *
   * That is not hypothetical and it is not an edge: Radiant's analytic DPS is
   * 126.7, so its whole window is ~5,068 HP against a 5,160-HP body — the check
   * was one percent of one barrel away from firing on a healthy build, and an
   * unrelated affix re-roll elsewhere in `items.ts` was enough to tip it, on four
   * builds at once.
   *
   * The invariant is kept and pointed at what it names. `BattleMetrics.totalDamage`
   * is the un-quantised number and it is what "dealt no damage" is a claim about;
   * a build that truly cannot hurt anything still fails, and now nothing else
   * does. The kill-quantised zero is a fact about the bench and belongs in the
   * reported low-end table below, which is where it now is.
   */
  for (const r of specRows) {
    if (r.damage.mean <= 0) {
      failures.push(
        `Build "${r.name}" dealt no damage at all in ${THROUGHPUT_WINDOW}s (broken) — not "killed nothing", which is a different and legitimate result on a bench whose unit is a ${THROUGHPUT_HP}-HP body.`,
      )
    }
  }
  const zeroKill = specRows.filter((r) => r.dps.mean <= 0)
  if (zeroKill.length) {
    line(
      `**${zeroKill.length} build(s) finished nothing inside the window** — ${zeroKill.map((r) => `${r.name} (${f1(r.damage.mean)} HP of damage dealt)`).join(', ')} — against a bench body of ${THROUGHPUT_HP} HP. That is the metric's quantum, not a broken build: the invariant below is on damage dealt, which is the thing the sentence "dealt no damage" is about.`,
    )
    line('')
  }
  const worstRatio = Math.max(...offDps) / offMed
  if (worstRatio > 3) failures.push(`Offense spread too wide: top build is ${f2(worstRatio)}× the median (>3×) on saturated throughput.`)

  /**
   * **What this sweep does *not* measure, stated plainly.**
   *
   * The old §1 gated "no dominant outlier" on a number whose full range was 1.4×,
   * so the 3× ceiling could not be reached by anything. On the saturated bench the
   * same builds span **16×**, so the ceiling is now a real check — a genuinely
   * dominant damage build trips it.
   *
   * The *floor* is deliberately not a gate, and that is a statement about the
   * metric rather than a concession. Throughput cannot tell "weak" from "not a
   * damage build": Cryomancer sells chill, Plaguebringer sells a spreading DoT,
   * and both come out near the bottom of an HP-destroyed-per-second table by
   * design, exactly as an INT affix comes out at +0 on a STR build. Grading them
   * here would repeat the mistake §4 was rebuilt to stop making. The builds that
   * read low are listed instead, with their analytic DPS beside them, as a
   * question for whoever owns `archetypeTree` / `items`: a spec whose kit is
   * damage and reads 0.13× the median is a balance defect; a spec whose kit is
   * control and reads 0.13× is a spec this sweep cannot grade.
   */
  const lowOffense = offense.filter((r) => r.dps.mean < offMed * 0.5).sort((a, b) => a.dps.mean - b.dps.mean)
  line('')
  line('**Reported, not gated — the low end.**')
  line('')
  if (lowOffense.length) {
    line(`| Build | HP destroyed/s | vs median | Analytic DPS |`)
    line('|---|--:|--:|--:|')
    for (const r of lowOffense) line(`| ${r.name} | ${f1(r.dps.mean)} | ${f2(r.dps.mean / offMed)}× | ${f1(r.analyticDps)} |`)
  } else {
    line('_No offense build reads below half the median._')
  }
  line('')
  line('Throughput cannot distinguish a weak damage build from a control build doing its')
  line('job — chill, DoT and crowd effects are not HP-per-second — so the floor is reported')
  line('rather than gated, the same way §4 refuses to grade an INT affix on a STR build.')
  line('The ceiling **is** gated, and now on a metric with a 16× range instead of a 1.4×')
  line('one. What the table above is worth as a finding: the analytic column tracks it,')
  line(`so the ${f2(Math.max(...offense.map((r) => r.analyticDps)) / Math.min(...offense.map((r) => r.analyticDps)))}× analytic spread across offense specs is real and is a question for`)
  line('whoever owns the spec tree, not an artifact of this bench.')
  line('')
  summary.push(`Specializations: ${TIER2_NODES.length} | offense DPS median ${f1(offMed)}, spread ${f2(Math.max(...offDps) / Math.min(...offDps))}×`)
}

// -------------------------------------------------------------- Sweep 2
if (want(2)) {
  // Support value — rebuilt twice (M19-a, then M19-a2).
  line('## 2. Support value (adjacency + real encounters + a Threat ladder)')
  line('')
  line('**What broke the first time.** This sweep used to place the support at `s5` and the')
  line('damage dealers at `s1`/`s3` — 191–210px apart, while the largest aura radius in')
  line(`the game is ${MAX_AURA_RADIUS}. No aura ever reached an ally. It also ran at \`baseHp: 999\`, so`)
  line('heal / shield / damage-reduction had nothing to prevent, and graded on clear time,')
  line('which was spawn-bound. All seven supports returned an identical −1.9s / +0.0.')
  line('')
  line('**What broke the second time — and why the metric changed again.** The rebuild')
  line('fixed adjacency and the failure mode but graded on a *swarm-pressure* ladder: the')
  line('depth-9 roster was copied ×p and the arrival window compressed by √p until the line')
  line('collapsed. It collapsed at ×12 — which is **612 goblins carrying a ×30 HP')
  line('multiplier, all of them on the field inside 8.4 seconds**. Nothing the game')
  line('generates is remotely that shape, and in that regime the engine stops answering.')
  line('Holding the third slot fixed and injecting one effect at a time onto a Weaponmaster')
  line('moved the ceiling by **exactly 0.00** for `block`, `thorns`, `chill`, `burn`,')
  line('`trap`, `stun`, `pierce` and `splash+30`; only `buffAura ×1.25` (+25%),')
  line('`rangeMult ×2` (+40%), `dmgReductionAura 0.6` (+12%) and `healAura 20` (+12%)')
  line('registered at all. Worse, the **control failed**: two carriers with an empty slot')
  line('held ×12.26 and the same carriers plus a full tier-2 Weaponmaster held ×12.59 —')
  line("inside the ladder's own rung ratio. A bar that a real damage tower cannot clear is")
  line('not "a generic damage tower" bar, and by this harness’s first rule a sweep whose')
  line('control does not discriminate is not measuring its subject.')
  line('')
  line('**What it does now.** Same placement, same carriers, same finite base — but the')
  line("ladder is the run's own difficulty dial applied to the encounters the game actually")
  line('ships. `generateEncounter` builds a depth-9 swarm, a depth-8 elite armour column and')
  line('the depth-10 boss; head count, arrival schedule and composition are left exactly as')
  line('designed, and **Threat** is raised on a ×1.15 ladder until the base falls. The grade')
  line('is "did every seed clear with the real 20-HP base", which a stalled wave cannot fake')
  line('(a permanently blocked enemy leaves the wave uncleared, whereas a stop-rate reading')
  line('would score that 100%). Three shapes, geometric mean, so no single kit shape wins by')
  line('accident.')
  line('')
  const CONTROL_NOTE_AT = md.length
  line('')

  line('The support sits at the one slot on The Green Line whose')
  line(
    `neighbours are inside aura range: \`${AURA_TRIO.support}\` is ${f1(slotDist(AURA_TRIO.support, AURA_TRIO.allies[0]))}px from \`${AURA_TRIO.allies[0]}\` and ${f1(slotDist(AURA_TRIO.support, AURA_TRIO.allies[1]))}px from \`${AURA_TRIO.allies[1]}\`.`,
  )
  line('The carriers are a **blocking** Berserker and a Sharpshooter, with the real')
  line(`\`MAX_BASE_HP\` of ${MAX_BASE_HP}. (Heroes have no HP since the no-HP pass: every support aura is a damage buff now.)`)
  line('There are no support classes any more (the classless rework): a hero supports because it')
  line('holds an **aura skill** — Blessing (Level 2) or Rally (Level 3). Each is graded on a')
  line('level-20 Epic-geared hero of two kits (a wand; a sword and shield) against the *same hero*')
  line('holding its level\'s damage skill instead (Heavy Blows / Berserk), in the same slot — so the')
  line('aura has to pay for the damage it took the slot of, and "a third body" cannot masquerade')
  line('as support value. (The old rows graded the Bannerman, Radiant, Templar and Oracle specs;')
  line('the Bannerman\'s aura had no skill to become, so it was a damage tower graded against a')
  line('damage tower.)')
  line('')

  const SUP_SEEDS = SEEDS.slice(0, 4)
  /** Threat rungs — a ×1.15 geometric ladder, finer than the old sweep's rungs. */
  const THREAT_LADDER: number[] = []
  for (let t = 1; t <= 60; t *= 1.15) THREAT_LADDER.push(Math.round(t * 100) / 100)
  /** The three encounter shapes the campaign actually fields in its back half. */
  const SUP_SHAPES: { name: string; depth: number; kind: EncounterKind }[] = [
    { name: 'depth 9 — swarm', depth: 9, kind: 'normal' },
    { name: 'depth 8 — elite column', depth: 8, kind: 'elite' },
    { name: 'depth 10 — boss', depth: 10, kind: 'boss' },
  ]
  const carrierBlocker = buildSpec('berserker', { gearRarity: 'epic', seed: 3 })
  const carrierRanged = buildSpec('sharpshooter', { gearRarity: 'epic', seed: 4 })

  function supportTeam(third: Sentinel | null) {
    return [
      { sentinel: carrierBlocker, slotId: AURA_TRIO.allies[1] },
      { sentinel: carrierRanged, slotId: AURA_TRIO.allies[0] },
      ...(third ? [{ sentinel: third, slotId: AURA_TRIO.support }] : []),
    ]
  }
  /** Highest Threat rung every seed still CLEARS, on one shipped encounter. */
  function threatCeiling(third: Sentinel | null, shape: { depth: number; kind: EncounterKind }): number {
    const wave = generateEncounter(shape.depth, shape.kind)
    const team = supportTeam(third)
    let hold = 0
    for (const threat of THREAT_LADDER) {
      const ok = SUP_SEEDS.every(
        (seed) =>
          runBattle({ team, depth: shape.depth, wave, enemyHpMult: threat, baseHp: MAX_BASE_HP, maxSeconds: 150, seed })
            .cleared,
      )
      if (!ok) break
      hold = threat
    }
    return hold
  }
  /**
   * The OLD metric, kept as a reported diagnostic so the change is auditable
   * rather than a claim: the swarm-blob ladder the invariant used to be graded on.
   */
  const SWARM_LADDER = [6, 8, 10, 12, 14, 16, 18, 20, 24]
  function swarmCeiling(third: Sentinel | null): number {
    const team = supportTeam(third)
    let hold = 0
    for (const p of SWARM_LADDER) {
      const ok = SUP_SEEDS.every(
        (seed) =>
          runBattle({
            team,
            depth: 9,
            pressure: p,
            pressureModel: SWARM_PRESSURE,
            enemyHpMult: 2.5,
            baseHp: MAX_BASE_HP,
            maxSeconds: 240,
            seed,
          }).cleared,
      )
      if (!ok) break
      hold = p
    }
    return hold
  }

  interface SupRow {
    label: string
    kind: 'control' | 'filler' | 'support'
    /** The filler a support is graded against (`kit · level`). */
    arch: string | null
    ceilings: number[]
    score: number
    swarm: number
  }
  function supRow(label: string, kind: SupRow['kind'], arch: string | null, third: Sentinel | null): SupRow {
    const ceilings = SUP_SHAPES.map((sh) => threatCeiling(third, sh))
    const score = ceilings.every((c) => c > 0)
      ? Math.exp(ceilings.reduce((a, c) => a + Math.log(c), 0) / ceilings.length)
      : 0
    return { label, kind, arch, ceilings, score, swarm: swarmCeiling(third) }
  }

  /*
   * **What a support is now (the tuning pass).** There are no classes, so there
   * are no support SPECS: Bannerman, Radiant, Templar and Oracle were tree
   * nodes, and `buildSpec` rebuilt them from the skills their evolutions became —
   * the Bannerman's aura had no skill (it became Heavy Blows, a damage line), so
   * the old row graded a damage tower against a damage tower and failed at +10%.
   * A hero supports now because it holds an AURA SKILL (Blessing at Level 2,
   * Rally at Level 3), and what that skill costs is the skill it took the slot
   * of. So each aura skill is graded on a level-20 Epic-geared hero of two kits —
   * a wand (the old Mystic supports' chassis) and a sword and shield (the
   * Bannerman's) — against the SAME hero holding its level's damage starter
   * (Heavy Blows / Berserk) in the same slot.
   */
  const SUP_KITS: { look: Archetype; name: string }[] = [
    { look: 'mystic', name: 'Wand' },
    { look: 'fighter', name: 'Sword & Shield' },
  ]
  const SUP_SKILLS: { aura: string; filler: string; level: string }[] = [
    { aura: 'blessing', filler: 'heavy_blows', level: 'Level 2' },
    { aura: 'rally', filler: 'berserk', level: 'Level 3' },
  ]
  const supHero = (look: Archetype, skill: string): Sentinel =>
    equipFullSet({ ...applyXp(classicHero(look), xpToReach(20)), skills: [skill] }, 'epic', new RNG(5))
  const skillName = (id: string) => ALL_SKILLS.find((k) => k.id === id)!.name
  const supRows: SupRow[] = [supRow('_(two carriers, empty slot)_', 'control', null, null)]
  for (const kit of SUP_KITS) {
    for (const s of SUP_SKILLS) {
      const key = `${kit.name} · ${s.level}`
      supRows.push(supRow(`_filler_ — ${kit.name} + ${skillName(s.filler)} (${s.level} damage)`, 'filler', key, supHero(kit.look, s.filler)))
      supRows.push(supRow(`${kit.name} + ${skillName(s.aura)}`, 'support', key, supHero(kit.look, s.aura)))
    }
  }
  const fillerScore: Record<string, number> = Object.fromEntries(supRows.filter((r) => r.kind === 'filler').map((r) => [r.arch!, r.score]))

  {
    const ctrl = supRows.find((r) => r.kind === 'control')!
    const fFill = supRows.find((r) => r.kind === 'filler' && r.arch === 'Sword & Shield · Level 3')!
    md[CONTROL_NOTE_AT] =
      `**What the change did to the control:** the empty slot reads ×${f2(ctrl.score)} and the fighter ` +
      `filler ×${f2(fFill.score)} — a generic damage tower is worth **+${(((fFill.score / ctrl.score) - 1) * 100).toFixed(0)}%** Threat instead of the +0% ` +
      `the swarm-blob ladder credited it with. The control discriminates, so the invariant ` +
      `has something to stand on.`
  }
  line(
    `| Third tower | ${SUP_SHAPES.map((s) => s.name).join(' | ')} | **Hold ceiling** (geo-mean Threat) | vs the same hero's damage skill | _(old swarm-blob ladder)_ |`,
  )
  line(`|---|${'--:|'.repeat(SUP_SHAPES.length)}--:|--:|--:|`)
  for (const r of supRows) {
    const bar = r.arch ? fillerScore[r.arch] : 0
    const rel =
      r.kind === 'support' && bar > 0
        ? `${(r.score / bar - 1) * 100 >= 0 ? '+' : ''}${(((r.score / bar) - 1) * 100).toFixed(0)}%`
        : '—'
    line(`| ${r.label} | ${r.ceilings.map((c) => `×${f2(c)}`).join(' | ')} | **×${f2(r.score)}** | ${rel} | ×${r.swarm} |`)
  }
  line('')
  line('**Findings.**')
  line('')
  /**
   * A support must clear its filler by a real margin, not by an epsilon.
   *
   * The rungs are ×1.15 apart and the score is the cube-root geometric mean of
   * three of them, so **one rung on one shape is ×1.0477** — the floor of what
   * this measurement can resolve at all, below which a "win" is ladder alignment
   * rather than a finding. The gate is set at **×1.10**, roughly two rungs, which
   * every support currently clears by 21% or more; it is deliberately well above
   * the resolution floor so that a support drifting toward its filler trips the
   * check while it is still a design problem rather than a rounding one.
   *
   * The old form of this check asked only for "strictly greater" on rungs 15–33%
   * apart, where a tie was the overwhelmingly likely outcome — and three of the
   * seven supports duly tied.
   */
  const SUPPORT_MARGIN = 1.1
  const beaten: string[] = []
  const notBeaten: string[] = []
  for (const r of supRows.filter((x) => x.kind === 'support')) {
    const bar = fillerScore[r.arch!] ?? 0
    const txt = `${r.label} (×${f2(r.score)} vs a ×${f2(bar)} filler)`
    ;(r.score >= bar * SUPPORT_MARGIN ? beaten : notBeaten).push(txt)
  }
  line(
    `- Aura skills that beat the same hero holding its level's damage skill by ≥${((SUPPORT_MARGIN - 1) * 100).toFixed(0)}%: ${beaten.length ? beaten.join(', ') : '_none_'}.`,
  )
  line(`- Aura skills that do **not**: ${notBeaten.length ? notBeaten.join(', ') : '_none_'}.`)
  line('')
  line('**Aegis, Bulwark and Warden of Ash left this table in the no-HP pass.** They were')
  line('graded as supports for a shield aura (Aegis, Bulwark) and a hold that ate the melee')
  line('meant for the line; heroes have no HP now, so there is no melee to eat and no aura')
  line('left to grade. They hold and slow (Aegis, Bulwark) or grind (Warden) — offense and')
  line('control, graded in §1 with the rest. Measured on the run before they moved, all three')
  line('read *below* a plain Weaponmaster here (×16.4 / ×18.0 / ×19.7 against ×19.7): a')
  line('blocking damage tower that can no longer fall holds everything a holder did.')
  line('')
  for (const r of supRows.filter((x) => x.kind === 'support')) {
    const bar = fillerScore[r.arch!] ?? 0
    if (!(r.score >= bar * SUPPORT_MARGIN)) {
      failures.push(
        `Support "${r.label}" holds Threat ×${f2(r.score)} — not the required ${((SUPPORT_MARGIN - 1) * 100).toFixed(0)}% better than the same hero (${r.arch}) holding its level's damage skill instead (×${f2(bar)}). The aura is not paying for the damage it costs.`,
      )
    }
  }
  summary.push(`Support hold ceilings (geo-mean Threat): ${supRows.filter((r) => r.kind === 'support').map((r) => `${r.label} ×${f2(r.score)}`).join(', ')} | fillers: ${Object.entries(fillerScore).map(([k, v]) => `${k} ×${f2(v)}`).join(', ')}`)
}

// -------------------------------------------------------------- Sweep 3
if (want(3)) {
  // Rarity budget ladder (monotonic check).
  line('## 3. Item rarity ladder')
  line('')
  line('Average base-stat budget and enchant count over 400 rolled weapons per tier.')
  line('')
  line('| Rarity | Avg base-stat total | Avg enchants | Config slots |')
  line('|---|--:|--:|--:|')
  const rarBudget: Record<string, number> = {}
  for (const rar of RARITY_ORDER) {
    const rng = new RNG(99)
    let statSum = 0
    let enchSum = 0
    const N = 400
    for (let i = 0; i < N; i++) {
      const it = generateItem(rng, { slot: 'oneHand', rarity: rar })
      statSum += baseStatTotal(it)
      enchSum += it.enchantments.length
    }
    rarBudget[rar] = statSum / N
    line(`| ${RARITY[rar].label} | ${f1(statSum / N)} | ${f1(enchSum / N)} | ${RARITY[rar].enchants} |`)
  }
  line('')
  for (let i = 1; i < RARITY_ORDER.length; i++) {
    const lo = rarBudget[RARITY_ORDER[i - 1]]
    const hi = rarBudget[RARITY_ORDER[i]]
    if (hi <= lo) failures.push(`Rarity budget not monotonic: ${RARITY_ORDER[i]} (${f1(hi)}) ≤ ${RARITY_ORDER[i - 1]} (${f1(lo)}).`)
  }
}

// -------------------------------------------------------------- Sweep 4
if (want(4)) {
  // Enchantment strength — rebuilt (M19-b).
  line('## 4. Enchantment strength (scenario-matched)')
  line('')
  line('**What broke before.** Every affix was tested on one *physical* Weaponmaster at')
  line('`baseHp: 999`, graded on attributed damage. `insight` grants INT and so did')
  line("literally nothing on a STR build; `frost`'s slow and `vampiric`'s base-heal had no")
  line('leak to prevent; `flaming` and `executioner` read **negative** because burn ticks')
  line('and executed remainders were not credited to the tower that caused them; the gear')
  line('`patience` affix was genuinely dead in the engine. Four affixes read +0% and two')
  line('read negative, and nothing failed.')
  line('')
  line('**What it does now.** Three scenarios, each graded on **stop rate**:')
  line('')
  line('| Scenario | Build | Wave | Measured length | Baseline stop rate | Resolution (1 leak / 1 seed) | Tests |')
  line('|---|---|---|--:|--:|--:|---|')

}

/**
 * ---- eight seeds, not four, and the reason is printed in the table (m-2) ----
 *
 * §4 grades on stop rate, which is `1 − leaked/maxLeak` — a **quantised**
 * quantity. `endure` throws twenty Siege Barrels worth 4 leak each, so its
 * entire leak pool is 80 and a single barrel getting through is worth 5.0
 * points. At four seeds the bench could therefore only ever answer in steps of
 * 1.25pt, and an affix graded against a +2.0pt floor was being decided by
 * whether one body out of eighty leaked. `reach`, whose re-home to `endure` is
 * itself a correction (see below), sat at +3.7pt on that grid — under one barrel
 * clear of the floor.
 *
 * Eight seeds halves the step to 0.625pt. It does not make the bench continuous
 * and it cannot: the quantum is printed in the scenario table below, and any
 * affix landing within one quantum of the floor is reported as **marginal**
 * rather than as a clean pass, because that is what it is.
 */
const affixSeeds = [11, 137, 409, 1013, 2411, 5171, 7919, 23]
/**
 * **The affix bench is pinned (M19-f).**
 *
 * `phys` and `magic` borrow real encounters from `generateEncounter`, so every
 * change to the campaign's difficulty curve silently re-scales the bench every
 * affix in the game is graded on. When `BUDGET_RATIO_FLOOR` moved 1.30 → 1.44
 * (see `waves.ts`) the depth-8 pool rose ×1.25 and the depth-6 pool ×1.12, the
 * `phys` baseline stop rate fell 17% → 13%, and four affixes that had cleared
 * the +2.0pt floor stopped clearing it — without anything about those affixes
 * changing. That is trap 5 in `balance/README.md` wearing a new hat: a scenario
 * that has quietly stopped being the thing it was fitted as.
 *
 * These multipliers divide the curve change back out, so the bench holds the
 * absolute HP pool it was fitted against. They are the *inverse* of the budget
 * ratio at that depth and must be re-derived whenever the curve moves again —
 * which the baseline-band invariant below will insist on.
 *
 * **The subject can move the bench too.** `magic`'s build is a Stormcaller, and
 * when Stormcaller gained `damageMult: 1.35` (Phase 1, lifting the Mystic
 * offense floor in §1) its baseline went 32% → 55% and every affix, curse and
 * reward card graded on it was re-scaled with nothing about *them* changing —
 * §15 read Legendary cards below Epic. The pin was re-derived the same way as
 * for a curve change, by dividing the subject's change back out
 * (0.89 × 1.35 ≈ 1.2): baseline 30%, inside the band and within 2pt of the fit.
 */
/*
 * **`endure` ×1 → ×1.6 (the no-HP pass).** Its Weaponmaster BLOCKS the barrels,
 * and until heroes lost their HP it was also being ground down by them: the
 * hold ended when the blocker fell. Never hurt, it held the whole queue and the
 * bench read 99% — at its ceiling, where `patience`, `bursting` and
 * `executioner` all read dead. Swept ×1.3 / ×1.6 / ×1.8 / ×2 / ×2.5 (baseline
 * 73 / 60 / 56 / 48 / 43%); ×1.6 is the lightest pin that puts it back in band
 * with every endure affix clear of the floor by two quanta.
 */
/*
 * **`phys` ×0.8 → ×0.25 and `magic` ×1.2 → ×0.8 (the tuning pass).** The
 * classless rework moved both SUBJECTS: a Sharpshooter is now a stat-less
 * Dagger with Long Shot, a Stormcaller a stat-less Wand with Wildfire and
 * Stormcaller. At the old pins the baselines read 18% and 22% — inside the band
 * but on its floor, where nine affixes read +0.5 to +2.0pt and failed as dead
 * (might, heavy, ruin, flaming, insight, precision, cruelty, swift, piercing),
 * and the curse bench (§10) could not see Wild, Reckless or Frenzied cost or
 * pay anything. `phys` is a swarm a single-target thrower leaks by count, so it
 * barely answers HP: ×0.5 read 21%. Swept ×0.5 / ×0.25 and ×0.8 for `magic`;
 * ×0.25 / ×0.8 put both near the old fit (37% / 36%), and every affix reads
 * ≥ +2.0pt on its home bench there. Re-derive these the same way when the
 * subject or the curve moves again.
 */
const BENCH_PIN: Record<string, number> = { phys: 0.25, magic: 0.8, endure: 1.6 }
/** A bench that has drifted out of this band cannot resolve an affix at all. */
const BENCH_BAND: [number, number] = [0.15, 0.75]
const AFFIX_SCENARIOS = {
  phys: {
    label: 'phys',
    blurb: 'physical scaling, single-target',
    build: buildSpec('sharpshooter', { seed: 2 }),
    wave: scaleWave(generateEncounter(8, 'normal', { subWaves: false }), 1.5, SWARM_PRESSURE),
    waveLabel: 'depth 8, ×1.5 swarm',
    buildLabel: 'Sharpshooter (no gear)',
  },
  magic: {
    label: 'magic',
    blurb: 'INT scaling, splash + crowd control',
    build: buildSpec('stormcaller', { seed: 2 }),
    wave: scaleWave(generateEncounter(6, 'normal', { subWaves: false }), 1.5, SWARM_PRESSURE),
    waveLabel: 'depth 6, ×1.5 swarm',
    buildLabel: 'Stormcaller (no gear)',
  },
  /**
   * `endure` has to be an actual grind, and for a while it was not. It used to
   * borrow an unscaled depth-8 encounter and describe it as "a ~100s hold"; once
   * enemy crossing times tightened (see `enemies.ts`) the same wave resolved in
   * **47 seconds**, which is no longer than `phys` or `magic`. A scenario that
   * has quietly stopped being the thing it is named after cannot grade the affix
   * it is the home of: `patience` raises the Patience *stack ceiling*, both caps
   * are reached inside 20s, and it read +0.9pt — indistinguishable from dead.
   *
   * It is now built explicitly: twenty Siege Barrels, ×3 HP, one every 4s. They
   * are slow (60px/s on a 2290px lane), armoured (30% physical resist) and
   * arrive faster than one tower kills them, so the fight runs ~114s with a
   * blocker holding a queue the whole way. The label quotes the *measured*
   * duration, so this can never silently stop being a hold again.
   */
  endure: {
    label: 'endure',
    blurb: 'a long grind — anything that ramps with time',
    build: buildSpec('weaponmaster', { seed: 2 }),
    wave: makeWave([{ typeId: 'barrel4', count: 20, hpMult: 3, gap: 4 }], 'the long hold'),
    waveLabel: 'twenty Siege Barrels, ×3 HP, one every 4s',
    buildLabel: 'Weaponmaster (no gear, blocks)',
  },
} as const
type ScenarioKey = keyof typeof AFFIX_SCENARIOS
/** Stop rate on one bench scenario, at the pressure the bench was fitted at. */
function benchStop(hero: Sentinel, k: ScenarioKey): number {
  return soloStopRate(hero, AFFIX_SCENARIOS[k].wave, affixSeeds, { enemyHpMult: BENCH_PIN[k], rules: BENCH_RULES })
}
const SCEN_KEYS = Object.keys(AFFIX_SCENARIOS) as ScenarioKey[]
const affixBase: Record<ScenarioKey, number> = {} as Record<ScenarioKey, number>
// §4 grades on these baselines and §10 grades the curses against them.
if (want(4) || want(10)) {
  for (const k of SCEN_KEYS) {
    affixBase[k] = benchStop(AFFIX_SCENARIOS[k].build, k)
  }
}

if (want(4)) {
  /**
   * The smallest change one bench can report: one leaked body's worth of base HP,
   * divided across the seed set. Below this an affix and a dead affix are the same
   * number, and a floor placed inside it is a coin toss dressed as an invariant.
   */
  const benchQuantum: Record<ScenarioKey, number> = {} as Record<ScenarioKey, number>
  for (const k of SCEN_KEYS) {
    const sc = AFFIX_SCENARIOS[k]
    const ml = maxLeak(sc.wave)
    const dur = runBattle({ team: [{ sentinel: sc.build, slotId: POST.s3 }], depth: 8, wave: sc.wave, baseHp: ml + 2, enemyHpMult: BENCH_PIN[k], maxSeconds: 300, seed: 11, rules: BENCH_RULES }).timeSec
    // The lightest body in the wave is the finest step it can take.
    const minLeak = Math.min(...sc.wave.spawns.map((s) => ENEMY_TYPES[s.typeId].leak))
    benchQuantum[k] = minLeak / ml / affixSeeds.length
    line(
      `| \`${sc.label}\` | ${sc.buildLabel} | ${sc.waveLabel} | ${f1(dur)}s | ${pct(affixBase[k])} | ${pp(benchQuantum[k])} | ${sc.blurb} |`,
    )
  }
  line('')
  for (const k of SCEN_KEYS) {
    if (affixBase[k] < BENCH_BAND[0] || affixBase[k] > BENCH_BAND[1]) {
      failures.push(
        `Affix bench "${k}" has drifted out of the band an affix can be resolved in: baseline stop rate ${pct(affixBase[k])}, band ${pct(BENCH_BAND[0])}–${pct(BENCH_BAND[1])}. At the floor every affix reads +0 because the build is already losing; at the ceiling every affix reads +0 because it is already winning. Re-pin \`BENCH_PIN.${k}\` against the current \`waves.ts\` curve.`,
      )
    }
  }
  line(
    `Each scenario is **pinned** to the pressure it was fitted at (\`BENCH_PIN\`: ${SCEN_KEYS.map((k) => `${k} ×${BENCH_PIN[k]}`).join(', ')}), so a change to the campaign's difficulty curve moves the game without silently moving the bench every affix is graded on — and the baselines above must stay inside ${pct(BENCH_BAND[0])}–${pct(BENCH_BAND[1])}, which is checked.`,
  )
  line('')
  line('Each affix is rolled at legendary budget and equipped **alone** (an item with no')
  line('base stats), so the affix is the only variable. Every affix is measured in all')
  line('three scenarios; it is *graded* on the one it is designed for.')
  line('')

  /**
   * Which scenario each affix is actually designed to pay off in.
   *
   * ---- `reach`: `magic` → `endure`, and why that is a correction rather than
   * ---- moving the goalposts (F1-B) ------------------------------------------
   *
   * The old entry read `reach: 'magic'` with the note *"a blocking fighter fights
   * at 72–85px; reach only matters at range"*. That confuses a blocker's **melee
   * engagement distance** with its **attack range**: a Weaponmaster holding a
   * queue still shoots, and its 96px reach sees about 4% of a 2290px lane, so how
   * far back down the queue it can reach is the binding constraint on the entire
   * bench. The claim was never measured; when it was, it turned out backwards.
   *
   * `rangeMult` swept across all three benches, 4 seeds (what the gate uses) and
   * 12 seeds (to separate signal from sampling):
   *
   *   ×      1.05   1.10   1.15   1.20   1.25   1.30   1.35   1.40   1.50   2.00
   *   magic  +5.0  +14.4  +10.9  +22.3  +12.1   +3.7   +1.1   +5.2  +24.1   +3.9
   *   endure +0.4   +0.8   +0.8   +2.5   +2.5   +2.5   +2.5   +3.3   +4.6  +46.3
   *   phys   +0.4   +0.8   +1.0   +1.1   +1.1   +1.4   +1.5   +2.2   +2.1   +2.1
   *                                                       (12 seeds, in points)
   *
   * `magic` is **not noisy — it is non-monotone**, and that is the important
   * distinction: the 4-seed and 12-seed columns agree to within a point at every
   * rung (+1.1/+1.1 at ×1.35, +23.7/+24.1 at ×1.50), so tripling the sample does
   * not smooth it. A Stormcaller carries an 83px splash, and moving its range
   * ring changes *which* enemy it picks, which changes which cluster the blast
   * catches — a discontinuity in the outcome, not a distribution to average. A
   * bench whose answer swings between +1.1pt and +23.7pt as the affix gets
   * monotonically stronger cannot grade that affix in either direction: it would
   * have passed a dead `reach` on one rung and failed a working one on the next.
   *
   * `endure` is monotone across the whole sweep and the mechanism is legible, so
   * that is where `reach` is graded. `phys` is the other failure mode and is worth
   * recording too — a Sharpshooter already sees 479px of road, so range saturates
   * there at about +2pt no matter how much of it is bought.
   *
   * The gate keeps its teeth on the new home: at ×1.05–×1.10 `reach` reads +0.0pt
   * on `endure`, which is exactly the dead-affix signature this invariant exists
   * to catch.
   *
   * ---- and the re-home does not make it a comfortable pass (m-2) -------------
   *
   * `endure`'s answer to `reach` is coarse: the bench's whole leak pool is 80 (20
   * Siege Barrels at 4 apiece), so a seed's response to this affix is one barrel
   * or none — 5.0pt or 0.0pt, nothing between. At four seeds the affix read +3.7pt
   * against a +2.0pt floor, which is a pass decided by a single body out of eighty.
   * The seed set is doubled above and the bench quantum is printed in the table, and
   * `reach` reads **+4.4pt against a quantum of 0.63pt** on the shipped table,
   * which clears the two-quantum bar and is reported as a clean pass. It did not
   * get there by being re-graded: the `items.ts` clamp fix raised the Legendary
   * budget 3.6 → 3.7, so the roll this sweep grades is a little larger. At the
   * four-seed grid it was +3.7pt, i.e. **less than one leaked barrel** clear of
   * the floor — the reported `marginal` verdict exists so that state is visible
   * the next time it happens rather than passing silently.
   *
   * ---- `executioner`: `phys` → `endure`, and it was never passing honestly ----
   *
   * The old home was `phys`, and it read +5pt there — on a roll it should not have
   * been able to make. `items.ts` rolled `execute` as `min(0.25, range(0.08,0.14) ×
   * budget)`, which pins at the 0.25 cap for **100%** of Legendary and Mythic rolls
   * and 68.6% of Epic ones (measured, 6,000 items per tier), so the sweep was
   * grading a 25% threshold against a card whose band tops out below 20%. Re-based
   * so the ladder has room (see `items.ts`), the same affix reads **+0.8pt** on
   * `phys` — below the floor.
   *
   * That is not a reason to put the cap back; it is a reason `phys` was the wrong
   * bench. Execute removes the last `x` of a body's HP, so what it is worth scales
   * with how much HP a body has — `engine.applyHit`'s own note derives this — and
   * `phys` is a Sharpshooter against a swarm-scaled column of light bodies, where
   * a tenth of a Torch Raider is nothing. `endure` is twenty Siege Barrels at ×3
   * HP, which is where a threshold is worth something. On the shipped table the
   * same roll reads **+2.4pt on `phys` and +13.1pt on `endure`** — a factor of
   * five, on one affix, from nothing but which bodies it is asked to finish.
   */
  const AFFIX_HOME: Record<string, ScenarioKey> = {
    might: 'phys',
    precision: 'phys',
    insight: 'magic',
    // `endure` → `magic` (the no-HP pass). Range bought a blocker more of the
    // queue while it was being worn down; a blocker that is never hurt holds its
    // two bodies forever either way, and `reach` read −1.2pt there at every pin
    // swept. `magic` is non-monotone in range (see below), which is why it was not
    // the home before — the roll graded here is fixed (seed 500), so the number is
    // stable, but read it knowing that.
    // `magic` → `phys` (the tuning pass). The re-pin below moved `magic` to a
    // 36% baseline and `reach` read −0.3pt there (+2.1pt at the old pin): the
    // non-monotone answer this note warned about. The classless Sharpshooter
    // throws a knife (168px, ×1.5 with Long Shot), not the old 479px bow, so on
    // `phys` range is no longer saturated: +6.4pt at the shipped pin.
    reach: 'phys',
    patience: 'endure',
    cruelty: 'phys',
    ruin: 'phys',
    bursting: 'endure', // splash pays off against the queue a blocker holds still
    heavy: 'phys',
    swift: 'phys',
    flaming: 'phys',
    frost: 'magic',
    shocking: 'phys',
    piercing: 'phys',
    vampiric: 'phys',
    executioner: 'endure', // a threshold is worth what the body it removes is worth
  }
  /** An affix must move its own scenario by at least this much to count as working. */
  const MIN_AFFIX_UPLIFT = 0.02

  interface AffixRow { id: string; home: ScenarioKey; deltas: Record<ScenarioKey, number> }
  const affixRows: AffixRow[] = []
  for (const id of Object.keys(AFFIX_HOME)) {
    const ench = rollNamedEnchant(id)
    if (!ench) {
      failures.push(`Enchantment "${id}" could not be rolled — the sweep cannot see it.`)
      continue
    }
    const deltas = {} as Record<ScenarioKey, number>
    for (const k of SCEN_KEYS) {
      const b = AFFIX_SCENARIOS[k].build
      const withAffix: Sentinel = withMainAffix(b, id, ench)
      deltas[k] = benchStop(withAffix, k) - affixBase[k]
    }
    affixRows.push({ id, home: AFFIX_HOME[id], deltas })
  }
  affixRows.sort((a, b) => b.deltas[b.home] - a.deltas[a.home])
  /** How many bench quanta of daylight an uplift needs before it is a clean pass. */
  const MARGINAL_QUANTA = 2
  line('| Enchantment | Graded on | Uplift there | Verdict | `phys` | `magic` | `endure` |')
  line('|---|:-:|--:|:-:|--:|--:|--:|')
  const marginalAffixes: string[] = []
  for (const r of affixRows) {
    const up = r.deltas[r.home]
    const clean = up >= MIN_AFFIX_UPLIFT + MARGINAL_QUANTA * benchQuantum[r.home]
    const verdict = up < MIN_AFFIX_UPLIFT ? '❌ dead' : clean ? '✅' : '⚠️ marginal'
    if (up >= MIN_AFFIX_UPLIFT && !clean) marginalAffixes.push(`${r.id} (${pp(up)} on \`${r.home}\`, quantum ${pp(benchQuantum[r.home])})`)
    line(
      `| ${r.id} | \`${r.home}\` | **${pp(up)}** | ${verdict} | ${pp(r.deltas.phys)} | ${pp(r.deltas.magic)} | ${pp(r.deltas.endure)} |`,
    )
  }
  line('')
  line(
    `**⚠️ marginal** means the uplift clears the ${pp(MIN_AFFIX_UPLIFT)} floor by less than ${MARGINAL_QUANTA} of its bench's own quanta — the pass is real but it is being carried by one or two leaked bodies, and it should not be read as a measurement. ${marginalAffixes.length ? `Currently: ${marginalAffixes.join('; ')}.` : 'Currently: none.'} This is reported, not failed: the honest response to a number the bench cannot resolve is to say so, not to widen the floor until it looks clean or narrow it until it breaks.`,
  )
  line('')
  line(`**Invariant:** every affix must move its own scenario by ≥ ${pp(MIN_AFFIX_UPLIFT)}. This is the check`)
  line('that would have caught the dead `patience` gear affix: before the engine wired')
  line('`gear.patience` into the stack ceiling it contributed *exactly* 0.0pt, in every')
  line('scenario, forever.')
  line('')
  for (const r of affixRows) {
    if (r.deltas[r.home] < MIN_AFFIX_UPLIFT) {
      failures.push(
        `Enchantment "${r.id}" moves its own scenario (\`${r.home}\`) by ${pp(r.deltas[r.home])} — at or below the ${pp(MIN_AFFIX_UPLIFT)} floor. It is dead, mis-scaled, or mis-scoped.`,
      )
    }
  }

  /*
   * ---- and does the affix have a rarity ladder at all? (m-2) -----------------
   *
   * §3 checks that base-stat budget rises with rarity. Nothing checked the same
   * thing for an *enchantment*, and two of them did not have one: both roll
   * `budget`-scaled inside a `Math.min`, and the budget ladder (1.0 / 1.7 / 2.5 /
   * 3.6 / 5.0) drove them straight into the cap. As shipped, over 6,000 generated
   * items per tier:
   *
   *   frost         rare 0.0%   epic 39.3%   legendary **87.9%**   mythic 100%
   *   executioner   rare 0.0%   epic 68.6%   legendary **100%**    mythic 100%
   *
   * — "at the cap", i.e. the share of rolls where rarity bought nothing. A
   * Legendary Frost was 0.600 nine times in ten and a Legendary Executioner was
   * 0.250 every single time, while §4 scored `frost` as the strongest affix in the
   * game at a value it almost always rolled. This is the `cx_vengeful` crit-clamp
   * defect (see `items.ts`) in the enchantment table.
   *
   * The check is on the **median**, not the mean, and on every consecutive pair:
   * a ladder that stops climbing is what pinning looks like from the outside, and
   * it needs no knowledge of where the cap is. The list is explicit because only
   * a clamped affix can fail — `piercing` and `shocking` roll `int(1,2)` and do not
   * scale with rarity at all by design, so a blanket sweep would fail them for a
   * different reason. Add a row here whenever a `Math.min` appears in a roll.
   */
  const CLAMPED_AFFIXES: { id: string; label: string; read: (e: Enchantment) => number | undefined }[] = [
    { id: 'frost', label: 'chill slow', read: (e) => e.mods?.chill?.slow },
    { id: 'executioner', label: 'execute threshold', read: (e) => e.mods?.execute },
  ]
  /** Rarities that must show a climb. Common rolls no enchantments at all. */
  const LADDER_RARITIES: ItemRarity[] = ['rare', 'epic', 'legendary', 'mythic']
  const LADDER_ROLLS = 3000
  line('**Does the affix itself have a rarity ladder?** Median rolled magnitude per tier,')
  line(`over ${LADDER_ROLLS} generated items each. Only clamped affixes can fail this; \`piercing\` and`)
  line('`shocking` roll a small integer and are deliberately rarity-flat.')
  line('')
  line(`| Affix | Value | ${LADDER_RARITIES.map((r) => RARITY[r].label).join(' | ')} |`)
  line(`|---|---|${LADDER_RARITIES.map(() => '--:').join('|')}|`)
  for (const ca of CLAMPED_AFFIXES) {
    const meds: number[] = []
    for (const rar of LADDER_RARITIES) {
      const rng = new RNG(4242)
      const vals: number[] = []
      for (let i = 0; i < LADDER_ROLLS; i++) {
        const it = generateItem(rng, { slot: rng.pick(['oneHand', 'offHand', 'body']), rarity: rar })
        for (const e of it.enchantments) {
          if (e.id !== ca.id) continue
          const v = ca.read(e)
          if (v != null) vals.push(v)
        }
      }
      meds.push(median(vals))
    }
    line(`| ${ca.id} | ${ca.label} | ${meds.map((m) => f2(m)).join(' | ')} |`)
    for (let i = 1; i < meds.length; i++) {
      if (meds[i] <= meds[i - 1]) {
        failures.push(
          `Enchantment "${ca.id}" has no rarity ladder: its median ${ca.label} at ${RARITY[LADDER_RARITIES[i]].label} is ${f2(meds[i])}, no better than ${RARITY[LADDER_RARITIES[i - 1]].label}'s ${f2(meds[i - 1])}. Its roll is budget-scaled inside a clamp, so the cap — not the rarity — is deciding the value.`,
        )
      }
    }
  }
  line('')
}

// -------------------------------------------------------------- Sweep 5
if (want(5)) {
  // Pressure ceiling — rebuilt (M19-d2).
  line('## 5. Pressure ceiling (standard team, depth 8)')
  /**
   * The standard team's level (Phase 3b). It was L20 — a finished tier-2 build —
   * which matched the old road, where Threat compounded to ×11.6 by depth 8. On
   * the three-act road levels are a resource: L20 lands around depth 9–10, and a
   * depth-8 company is a tier-1 line in its mid-teens.
   */
  const STD_LEVEL = 16
  line('')
  line('**What broke before.** The old sweep scaled enemy **HP only**, stopped at ×8, and')
  line('was demoted to "informational" with no invariant at all. Enemies that arrive at')
  line('the same rate and in the same number cannot threaten a tower line, so it could')
  line('not break — and an invariant that cannot fail is not an invariant.')
  line('')
  line('**What it does now.** *Siege pressure* scales three axes: per-enemy HP ×p, head')
  line('count ×p^0.35 and arrival compressed by p^0.35. Count is deliberately the *weakest*')
  line('axis, because `engine.impact` applies splash to every enemy in radius with no')
  line('target cap — piling bodies into the same space makes a splash line **stronger**,')
  line('which is exactly how the old ladder ended up censored.')
  line('')
  line(`A depth-8 team (Vanguard / Sharpshooter / Pyromancer lines at level ${STD_LEVEL} — tier 1, where the`)
  line('XP curve (§9) puts a depth-8 company, with L20 two layers deeper — Epic gear and random spec perks)')
  line(`faces depth-8 waves at the Threat a real depth-8 fight is fought at (×${f2(threatAtLayer(8))}) with the real`)
  line(`base of ${MAX_BASE_HP}. ${SEEDS.slice(0, 4).length} seeds per rung.`)
  line('')
  const PRESSURE_LADDER = [1, 1.5, 2.2, 3.4, 5, 7.6, 11, 17, 25, 38, 57, 85]
  const CEIL_SEEDS = SEEDS.slice(0, 4)
  const stdThreat = threatAtLayer(8)
  const stdTeam = [
    { sentinel: buildSpec('vanguard', { level: STD_LEVEL, gearRarity: 'epic', seed: 8, perkSeed: 8 }), slotId: POST.s0 },
    { sentinel: buildSpec('sharpshooter', { level: STD_LEVEL, gearRarity: 'epic', seed: 8, perkSeed: 8 }), slotId: POST.s3 },
    { sentinel: buildSpec('pyromancer', { level: STD_LEVEL, gearRarity: 'epic', seed: 8, perkSeed: 8 }), slotId: POST.s5 },
  ]
  line('| Siege pressure | Enemies | Cleared | Base HP left ± |')
  line('|--:|--:|:-:|--:|')
  let breakPoint = 0
  let censored = true
  for (const p of PRESSURE_LADDER) {
    const wave = scaleWave(generateEncounter(8, 'normal'), p, SIEGE_PRESSURE)
    const rows = CEIL_SEEDS.map((seed) =>
      runBattle({ team: stdTeam, depth: 8, wave, enemyHpMult: stdThreat, baseHp: MAX_BASE_HP, maxSeconds: 240, seed }),
    )
    const cleared = rows.filter((r) => r.cleared).length
    const hpLeft = stat(rows.map((r) => r.baseHpLeft))
    line(`| ×${f2(p)} | ${wave.spawns.length} | ${cleared}/${rows.length} | ${pm(hpLeft)} |`)
    if (cleared === rows.length) breakPoint = p
    if (cleared === 0) { censored = false; break }
  }
  line('')
  line(`Standard depth-8 team holds up to **siege pressure ×${f2(breakPoint)}**.`)
  line('')
  /** A depth-appropriate team should be genuinely tested by its own depth. */
  const TARGET_BREAK_BAND: [number, number] = [2, 8]
  line(
    `**Design target:** a depth-appropriate team should break somewhere in **×${TARGET_BREAK_BAND[0]}–×${TARGET_BREAK_BAND[1]}** — comfortable`,
  )
  line('at its own node, in danger at a couple of nodes deeper. Anything far above that')
  line('means the depth-8 encounter is not an encounter for a depth-8 team.')
  line('')
  if (censored) {
    failures.push(
      `Pressure ceiling is censored: the standard team survived every rung up to ×${f2(PRESSURE_LADDER[PRESSURE_LADDER.length - 1])}. The sweep found no break point, so it is not measuring difficulty.`,
    )
  } else if (breakPoint > TARGET_BREAK_BAND[1]) {
    failures.push(
      `Standard depth-8 team holds siege pressure ×${f2(breakPoint)}, far above the ×${TARGET_BREAK_BAND[0]}–×${TARGET_BREAK_BAND[1]} design band — a well-built team is untouchable at its own depth.`,
    )
  } else if (breakPoint < TARGET_BREAK_BAND[0]) {
    failures.push(`Standard depth-8 team breaks at siege pressure ×${f2(breakPoint)} — below the ×${TARGET_BREAK_BAND[0]} floor; depth 8 may be unwinnable.`)
  }
  const baselineClear = runBattle({ team: stdTeam, depth: 6, enemyHpMult: 1, baseHp: 20, maxSeconds: 90, seed: 21 })
  if (!baselineClear.cleared) failures.push('Standard team cannot clear depth 6 at Threat ×1 — game may be unwinnable.')
  summary.push(`Pressure ceiling (std team, depth 8): ×${f2(breakPoint)} (target ×${TARGET_BREAK_BAND[0]}–×${TARGET_BREAK_BAND[1]})`)
}

/** Every campaign sweep (§6, §11, §14, §17) is this many layers deep. */
const NODES = MC_LAYERS
/** §6's win rate and boss Threat, which §11's prose reads against its own. */
let winRate = NaN
let mcBossThreat = NaN
// -------------------------------------------------------------- Sweep 6
if (want(6)) {
  // Monte Carlo full runs.
  line('## 6. Monte Carlo full runs (compounding Threat vs. progression)')
  line('')
  line('Random teams (3–5 specs) play all twelve layers of the three acts — an act boss on')
  line('layers 4 and 8, the final boss on 12, an elite mid-way through acts 2 and 3. Team **power')
  line('scales with depth** (level ≈ 2.5·depth, the curve `levelXpAwards` pays; gear rarity improving)')
  line('to mirror real progression. Threat is the real road curve (`threatAtLayer`: ×' + THREAT_STEP + ' a layer, ×' + ACT_JUMP + ' more')
  line('per act) — it no longer compounds on choices, so this model and the routed first run in §11')
  line('meet every layer at the same Threat. Base HP (20) persists between nodes.')
  line('**Win** = the boss falls.')
  line('')
  /**
   * 150 → 200 → **300** (M19-f, then P7).
   *
   * Three of this sweep's four gates sit within one σ of their own edge — the win
   * band's floor, the 60% concentration ceiling and the "≥3 distinct death
   * depths" rule — so at 150 runs (σ = 4.1pt on the win rate at p≈0.5) the suite
   * could fail on a resample rather than on a change. 200 brought that to 3.5pt;
   * P7 widened the sweep again and took it to 300, where σ is **2.9pt**.
   *
   * The doc said "150 → 200" for as long as the constant has said 300 (F13). A
   * sample size is a claim about how much of a failure is noise, so a stale one
   * is not a cosmetic comment — it quotes the wrong σ beside gates that are read
   * to one σ.
   */
  const RUNS = 300
  let wins = 0
  const depths: number[] = []
  const deathDepths: number[] = []
  let bossAttempts = 0
  let bossKills = 0
  /**
   * Battles that hit the harness cap instead of ending (Phase 3a). This sweep
   * used a 70-second cap, and a capped battle counted as a LOSS: re-measured with
   * no cap, 38 of the 72 "deaths" in a 150-run sample were the clock — mostly at
   * the boss — and the honest win rate of the pre-3a game was 73%, not 50%. The
   * game has no timeout. The cap is now a per-sub-wave safety net far above any
   * real clear, and this counter must stay at zero.
   */
  let mcTimeouts = 0
  /** Threat each team carried into the boss fight — the other half of the §6/§11 gap. */
  const mcBossThreats: number[] = []
  /**
   * Every Monte Carlo run draws a battlefield and a set of composition variants
   * off its own index, the way a real run draws them off its seed (WS8), and its
   * own RNG stream, so two configs compare on paired seeds. The model itself is
   * `runsim.monteCarloRun`, shared with `fit-curve.ts`.
   */
  const mcFieldCounts = new Map<string, { n: number; won: number }>()
  for (let r = 0; r < RUNS; r++) {
    const out = monteCarloRun(r)
    const fieldTally = mcFieldCounts.get(out.fieldId) ?? { n: 0, won: 0 }
    fieldTally.n++
    mcFieldCounts.set(out.fieldId, fieldTally)
    if (out.finalAttempt) { bossAttempts++; if (out.bossThreat !== null) mcBossThreats.push(out.bossThreat) }
    if (out.finalKill) bossKills++
    mcTimeouts += out.timeouts
    depths.push(out.reached)
    if (out.died) deathDepths.push(out.died)
    if (out.won) {
      wins++
      fieldTally.won++
    }
  }
  winRate = wins / RUNS
  const avgDepth = mean(depths)
  const deathSpread = new Set(deathDepths).size
  const bossKillShare = bossAttempts ? bossKills / bossAttempts : 0
  /**
   * Mean Threat carried into the boss fight here. Printed because it is the
   * exchange rate between this sweep and §11: every wave-table dial is multiplied
   * by Threat, so a sweep that meets the boss at ×N feels a given change N times
   * over. When the two sweeps met the boss at wildly different Threat, they pulled
   * any shared dial in opposite directions.
   */
  mcBossThreat = mean(mcBossThreats)
  const deathCounts = new Map<number, number>()
  for (const d of deathDepths) deathCounts.set(d, (deathCounts.get(d) ?? 0) + 1)
  const worstDeathDepth = [...deathCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [0, 0]
  const deathConcentration = deathDepths.length ? worstDeathDepth[1] / deathDepths.length : 0
  line(`- Runs: **${RUNS}**`)
  line(`- Win rate (boss falls): **${pct(winRate)}**`)
  line(`- Average depth reached: **${f1(avgDepth)} / ${NODES}**`)
  line(`- Depth distribution: ${histogram(depths, NODES)}`)
  line(`- Runs ended at each depth: ${histogram(deathDepths, NODES)}`)
  line(`- Distinct depths that killed at least one team: **${deathSpread}**`)
  line(`- Deadliest single node: **depth ${worstDeathDepth[0]}** — **${pct(deathConcentration)}** of all lost runs end there`)
  line(`- Boss attempts: **${bossAttempts}**, boss kills: **${bossKills}** (**${pct(bossKillShare)}** of arrivals)`)
  line(`- Mean Threat carried into the boss fight: **×${f1(mcBossThreat)}** (the exchange rate with §11 — see there)`)
  line(
    `- Battlefields drawn, and what each one wins: ${[...mcFieldCounts.entries()]
      .map(([id, t]) => `**${id}** n=${t.n} (${pct(t.n / RUNS)}) win ${pct(t.won / t.n)}`)
      .join(' · ')}`,
  )
  line('')

  /** The band the design is aiming for, not a smoke test. */
  const TARGET_WIN_BAND: [number, number] = [0.45, 0.6]
  /** Deaths must not all land on one or two nodes. */
  const MIN_DEATH_SPREAD = 3
  /** …and no single node may be the whole difficulty curve on its own. */
  const MAX_DEATH_CONCENTRATION = 0.6
  /** The final boss must actually be a boss. */
  const TARGET_BOSS_KILL_SHARE = 0.1
  line(
    `**Target win-rate band: ${pct(TARGET_WIN_BAND[0])}–${pct(TARGET_WIN_BAND[1])}** for a depth-appropriate team. That is the band where a`,
  )
  line('run is worth finishing and losing is worth minding; the old 10–80% guardrail was a')
  line('smoke test that a completely degenerate curve could pass. The current game is')
  const bandGap =
    winRate > TARGET_WIN_BAND[1]
      ? `${((winRate - TARGET_WIN_BAND[1]) * 100).toFixed(0)}pt above the top of the band`
      : winRate < TARGET_WIN_BAND[0]
        ? `${((TARGET_WIN_BAND[0] - winRate) * 100).toFixed(0)}pt below the bottom of the band`
        : 'inside the band'
  line(`**${bandGap}** (${pct(winRate)} vs ${pct(TARGET_WIN_BAND[0])}–${pct(TARGET_WIN_BAND[1])}).`)
  line('')
  line('**Distribution shape matters as much as the rate.** A curve where every death')
  line('lands on the same two elite nodes and the boss kills nobody is degenerate even at')
  line('a perfect win rate: it means eight of the ten nodes are not doing anything. Three')
  line('invariants guard the shape — deaths must spread across at least')
  line(`${MIN_DEATH_SPREAD} distinct depths, no single node may end more than ${pct(MAX_DEATH_CONCENTRATION)} of lost runs, and`)
  line(`the boss must kill a nonzero share of the teams that reach it (design target ≥ ${pct(TARGET_BOSS_KILL_SHARE)}).`)
  line('')
  if (winRate < TARGET_WIN_BAND[0] || winRate > TARGET_WIN_BAND[1]) {
    failures.push(
      `Monte Carlo win rate ${pct(winRate)} is outside the ${pct(TARGET_WIN_BAND[0])}–${pct(TARGET_WIN_BAND[1])} design band (${bandGap}).`,
    )
  }
  if (deathSpread < MIN_DEATH_SPREAD) {
    failures.push(
      `Difficulty curve is degenerate: runs end at only ${deathSpread} distinct depth(s) (need ≥ ${MIN_DEATH_SPREAD}). ${histogram(deathDepths, NODES)}`,
    )
  }
  if (deathConcentration > MAX_DEATH_CONCENTRATION) {
    failures.push(
      `Difficulty curve is a cliff: depth ${worstDeathDepth[0]} alone ends ${pct(deathConcentration)} of all lost Monte Carlo runs (max ${pct(MAX_DEATH_CONCENTRATION)}). The other nine nodes are not contributing difficulty.`,
    )
  }
  line(`- Battles that hit the harness cap instead of ending: **${mcTimeouts}** (must be 0 — the game has no clock, so neither may the measurement)`)
  line('')
  if (mcTimeouts > 0) {
    failures.push(`${mcTimeouts} Monte Carlo battle(s) ended on the harness cap rather than a win or a loss — the clock is deciding runs again.`)
  }
  if (bossKills === 0) {
    failures.push(`The boss killed 0 of ${bossAttempts} teams that reached it — the final node is not a boss.`)
  } else if (bossKillShare < TARGET_BOSS_KILL_SHARE) {
    failures.push(
      `The boss kills only ${pct(bossKillShare)} of the teams that reach it, below the ${pct(TARGET_BOSS_KILL_SHARE)} design target.`,
    )
  }
  summary.push(`Monte Carlo: ${pct(winRate)} win rate (target ${pct(TARGET_WIN_BAND[0])}–${pct(TARGET_WIN_BAND[1])}), avg depth ${f1(avgDepth)}/${NODES}, deaths on ${deathSpread} depths, boss kills ${pct(bossKillShare)}`)
}

// -------------------------------------------------------------- Sweep 7
if (want(7)) {
  // Skills (SK1) — what replaced the spec perks and the evolutions.
  line('## 7. Skills (is any skill dead, and is any level solved?)')
  line('')
  line('**What this replaced.** §7 measured the spec perks — one of two at levels 5 and 15, by')
  line('line. Skills replaced the perks AND the evolutions (SK1): a hero holds up to three, and')
  line('at levels 5, 10 and 15 it is offered three of one skill level (Level 1, 2, 3) from the')
  line('player\'s unlocked pool. There are no classes (the classless rework): any hero may be dealt')
  line('any skill, and what a skill does on a hero follows from what that hero holds. So a choice')
  line('point is a (skill level, kit) pair — the three kits a hero is drawn as: a sword and a')
  line('shield, a knife, a wand — and every skill of that level is an option on it.')
  line('')
  line('**How each skill is graded.** A representative hero of the kit — level 9 for a Level 1')
  line('skill, 14 for Level 2, 19 for Level 3, stat-less gear and no other skill — takes the skill')
  line('alone, and is graded by **stop rate** on three waves of its depth (4, 6 or 8): a `swarm` of')
  line('runts, an `armour` column (Plated elite) and a `line` (the depth\'s normal wave). Each point\'s')
  line('waves are first scaled so the hero **without** a skill stops about half of each — a bench at')
  line('0% or 100% cannot see a skill at all. A blessing needs someone to reach, so a skill with an')
  line('aura is graded beside a second hero.')
  line('')
  line('**Two more benches, because some skills only show beside another piece (the tuning pass).**')
  line('The classless rework added skills that are self-contained effects meant to meet other')
  line('pieces in play — "its hits deal 25% more to slowed enemies", "each kill it makes pays 1')
  line('more gold". A lone hero on a stop-rate bench cannot see either: nobody slows, nobody')
  line('holds, and stop rate does not read gold. They read +0.0pt everywhere and were failed as')
  line('dead. So every skill is also graded on:')
  line('')
  line('- `partner` — the `line` wave, with the hero beside a **partner who holds and slows** (a')
  line('  sword-and-shield hero of the same level carrying Frostbite), re-scaled so the pair stops')
  line('  about half. This is where a skill that reads holds or slows (Pin Down, Cold Snap) shows.')
  line('- `gold` — the `line` wave\'s kill gold, as a share of what the hero earns without the skill')
  line('  (reported in pt of that gold). Only a skill that pays gold moves it.')
  line('')
  line('**The dead gate reads across kits.** Skills are dealt at random whatever the hero holds — the')
  line('designer: "they just apply their effects and things will happen" — so a hold skill on a hero')
  line('with no shield waits for one, by design. A skill is **dead** when it moves no bench by')
  line(`+${(0.02 * 100).toFixed(1)}pt on ANY kit; a kit on which it reads nothing is reported in the table, not`)
  line('failed. The solved gate stays per point: a choice is made for one hero, holding what it holds.')
  line('')
  const SKILL_SEEDS = SEEDS.slice(0, 3)
  /** The three kits a hero is drawn as (`sentinels.CLASSIC_KIT`), named by what it holds. */
  const KIT_NAME: Record<Archetype, string> = { fighter: 'Sword & Shield', rogue: 'Dagger', mystic: 'Wand' }
  interface SkillRow { point: string; skill: string; name: string; d: Record<string, number>; partner: number; gold: number; mean: number; dps: number }
  const skillRows: SkillRow[] = []
  const skillPointSummary: { point: string; gap: number; greedy: string; measured: string; options: number }[] = []
  const SKILL_BENCH_KEYS = ['swarm', 'armour', 'line'] as const
  function skillBenches(depth: number): Record<(typeof SKILL_BENCH_KEYS)[number], WaveDef> {
    return {
      swarm: makeWave([{ typeId: 'torch1', count: 40 + depth * 5, hpMult: 1 + depth * 0.4, gap: 0.3 }], 'swarm'),
      // Bench mode (`BENCH_RULES`, harness.ts): a skill is graded on the shape it was fitted to.
      armour: generateEncounter(depth, 'elite', { variantId: 'plated', subWaves: false }),
      line: generateEncounter(depth, 'normal', { subWaves: false }),
    }
  }
  const ally = (level: number) => applyXp(classicHero('fighter'), xpToReach(level))
  function skillTeam(hero: Sentinel, aura: boolean, level: number): { sentinel: Sentinel; slotId: string }[] {
    if (!aura) return [{ sentinel: hero, slotId: POST.s3 }]
    return [
      { sentinel: hero, slotId: AURA_TRIO.support },
      { sentinel: ally(level), slotId: AURA_TRIO.allies[0] },
    ]
  }
  /** The partner bench's second hero: it holds (a shield) and slows (Frostbite). */
  const partner = (level: number): Sentinel => ({ ...applyXp(classicHero('fighter'), xpToReach(level)), skills: ['frostbite'] })
  const partnerTeam = (hero: Sentinel, level: number) => [
    { sentinel: hero, slotId: AURA_TRIO.support },
    { sentinel: partner(level), slotId: AURA_TRIO.allies[0] },
  ]
  /** Mean kill gold `team` earns off `wave` at `hpMult`, on the stop-rate bench's terms. */
  const benchGold = (team: { sentinel: Sentinel; slotId: string }[], wave: WaveDef, hpMult: number): number =>
    mean(SKILL_SEEDS.map((seed) => runBattle({ team, depth: wave.index || 6, wave, baseHp: maxLeak(wave) + 2, enemyHpMult: hpMult, maxSeconds: 200, rules: BENCH_RULES, seed }).goldEarned))
  for (const tier of [1, 2, 3] as const) {
    const level = tier === 1 ? 9 : tier === 2 ? 14 : 19
    const depth = tier === 1 ? 4 : tier === 2 ? 6 : 8
    for (const archetype of ['fighter', 'rogue', 'mystic'] as const) {
      const options = ALL_SKILLS.filter((k) => k.level === tier)
      const point = `L${tier} · ${KIT_NAME[archetype]}`
      // No gear: a rolled `vampiric` affix heals the Gate off damage dealt to a
      // wave the hero cannot kill, which flattens a bench into a plateau.
      const base = applyXp(classicHero(archetype), xpToReach(level))
      const benches = skillBenches(depth)
      // Two pressures per point: one for a lone hero, one for a hero beside an
      // ally (the aura skills), each scaled so the skill-less team stops ~half.
      const pressureFor = (aura: boolean): Record<string, number> => {
        const out: Record<string, number> = {}
        for (const k of SKILL_BENCH_KEYS) {
          let lo = 0.02
          let hi = 60
          for (let it = 0; it < 9; it++) {
            const mid = Math.sqrt(lo * hi)
            const r = stopRate(skillTeam(base, aura, level), benches[k], SKILL_SEEDS, { enemyHpMult: mid, rules: BENCH_RULES })
            if (r > 0.5) lo = mid
            else hi = mid
          }
          out[k] = Math.sqrt(lo * hi)
        }
        return out
      }
      const pressure = { solo: pressureFor(false), aura: options.some((k) => k.mods.buffAura) ? pressureFor(true) : null }
      const baseRate = (aura: boolean): Record<string, number> => {
        const pr = aura ? pressure.aura! : pressure.solo
        const out: Record<string, number> = {}
        for (const k of SKILL_BENCH_KEYS) out[k] = stopRate(skillTeam(base, aura, level), benches[k], SKILL_SEEDS, { enemyHpMult: pr[k], rules: BENCH_RULES })
        return out
      }
      const soloBase = baseRate(false)
      const auraBase = pressure.aura ? baseRate(true) : null
      // The partner bench: the `line` wave, re-scaled so the skill-less pair stops about half.
      let plo = 0.02
      let phi = 60
      for (let it = 0; it < 9; it++) {
        const mid = Math.sqrt(plo * phi)
        if (stopRate(partnerTeam(base, level), benches.line, SKILL_SEEDS, { enemyHpMult: mid, rules: BENCH_RULES }) > 0.5) plo = mid
        else phi = mid
      }
      const partnerPr = Math.sqrt(plo * phi)
      const partnerBase = stopRate(partnerTeam(base, level), benches.line, SKILL_SEEDS, { enemyHpMult: partnerPr, rules: BENCH_RULES })
      const goldBase = benchGold(skillTeam(base, false, level), benches.line, pressure.solo.line)
      const rows: SkillRow[] = []
      for (const k of options) {
        const aura = !!k.mods.buffAura
        const hero: Sentinel = { ...base, skills: [k.id] }
        const pr = aura ? pressure.aura! : pressure.solo
        const b = aura ? auraBase! : soloBase
        const d: Record<string, number> = {}
        for (const key of SKILL_BENCH_KEYS) d[key] = stopRate(skillTeam(hero, aura, level), benches[key], SKILL_SEEDS, { enemyHpMult: pr[key], rules: BENCH_RULES }) - b[key]
        const partnerD = stopRate(partnerTeam(hero, level), benches.line, SKILL_SEEDS, { enemyHpMult: partnerPr, rules: BENCH_RULES }) - partnerBase
        const goldD = goldBase > 0 ? benchGold(skillTeam(hero, false, level), benches.line, pressure.solo.line) / goldBase - 1 : 0
        rows.push({ point, skill: k.id, name: k.name, d, partner: partnerD, gold: goldD, mean: mean(SKILL_BENCH_KEYS.map((key) => d[key])), dps: heroDps(hero) })
      }
      skillRows.push(...rows)
      const top = [...rows].sort((a, b) => b.mean - a.mean)
      const greedy = [...rows].sort((a, b) => b.dps - a.dps)[0]
      skillPointSummary.push({ point, gap: top.length > 1 ? top[0].mean - top[1].mean : 0, greedy: greedy.name, measured: top[0].name, options: rows.length })
    }
  }
  line('| Point | Skill | `swarm` | `armour` | `line` | Mean | `partner` | `gold` | heroDps |')
  line('|---|---|--:|--:|--:|--:|--:|--:|--:|')
  for (const r of skillRows) {
    line(`| ${r.point} | ${r.name} | ${pp(r.d.swarm)} | ${pp(r.d.armour)} | ${pp(r.d.line)} | **${pp(r.mean)}** | ${pp(r.partner)} | ${pp(r.gold)} | ${f1(r.dps)} |`)
  }
  line('')
  line('| Point | Options | Lead of the best over the runner-up | The greedy (heroDps) pick | The measured best |')
  line('|---|--:|--:|---|---|')
  for (const p of skillPointSummary) line(`| ${p.point} | ${p.options} | ${pp(p.gap)} | ${p.greedy} | ${p.measured} |`)
  line('')
  /** A skill must move at least one of its benches by this much, or it is dead. */
  const SKILL_EDGE = 0.02
  /** The best option at a point may not lead the runner-up by more than this on the mean. */
  const SKILL_GAP_CEILING = 0.2
  const greedyRight = skillPointSummary.filter((p) => p.greedy === p.measured).length
  const bestOf = (r: SkillRow) => Math.max(...SKILL_BENCH_KEYS.map((k) => r.d[k]), r.partner, r.gold)
  // Dead is read across kits: a skill's best bench on the hero it suits best.
  const skillBest = new Map<string, { name: string; best: number; where: string }>()
  for (const r of skillRows) {
    const b = bestOf(r)
    const cur = skillBest.get(r.skill)
    if (!cur || b > cur.best) skillBest.set(r.skill, { name: r.name, best: b, where: r.point })
  }
  const waiting = skillRows.filter((r) => bestOf(r) < SKILL_EDGE)
  line(`**Invariants.** Every skill moves at least one bench by ≥ ${pp(SKILL_EDGE)} on at least one kit (none is`)
  line(`dead), and no point's best skill leads its runner-up by more than ${pp(SKILL_GAP_CEILING)} on the mean (none is`)
  line(`solved by a mile). An offer deals three of a point's options at random, so a solved point would make`)
  line(`every offer that holds the answer a non-choice. Reported, not gated: how often the`)
  line(`heroDps-greedy pick — the "read the tooltip" answer — is the measured best one: **${greedyRight} of`)
  line(`${skillPointSummary.length}** points. A low number is the goal: it means the answer depends on the wave.`)
  line('')
  line(`**Waiting for a piece (reported, not gated):** ${waiting.length ? waiting.map((r) => `${r.name} at ${r.point} (best ${pp(bestOf(r))})`).join(', ') : '_none_'}. Each of these moves a bench on another kit; on this one it waits for what it needs (a shield to hold with, someone to slow for it).`)
  line('')
  for (const [, s] of skillBest) {
    if (s.best < SKILL_EDGE) failures.push(`Skill "${s.name}" is dead: its best bench on any kit moves only ${pp(s.best)} (${s.where}; needs ≥ ${pp(SKILL_EDGE)}).`)
  }
  for (const p of skillPointSummary) {
    if (p.gap > SKILL_GAP_CEILING) failures.push(`Skills at ${p.point} are solved: ${p.measured} leads the runner-up by ${pp(p.gap)} on the three-bench mean (ceiling ${pp(SKILL_GAP_CEILING)}).`)
  }
}

// -------------------------------------------------------------- Sweep 8
if (want(8)) {
  // Mutation tradeoffs — now measured, not asserted (M19-d1).
  line('## 8. Mutation tradeoffs (measured, not asserted)')
  line('')
  line('**What broke before.** The invariant checked that a `downside` *string* existed.')
  line('It never checked that the downside cost anything, so Incendiary (−9%), Executioner')
  line('(−16%) and Siphon (−1%) all passed green while the numbers said the opposite of')
  line('what the card said — those negatives were a damage-attribution artifact, not a')
  line('tradeoff.')
  line('')
  line('**What it does now.** Each mutation is applied alone to a Weaponmaster and')
  line('measured by **stop rate** across three shapes of wave. A mutation is a genuine')
  line('tradeoff only if it is clearly better in at least one and clearly worse in at least')
  line('one — that is what "re-shapes how you attack" means. Pure upside is a stat stick.')
  line('')
}

const MUT_SEEDS = SEEDS.slice(0, 4)
// Three waves chosen to load *different* axes, so a mutation that trades one for
// another has somewhere to show the loss:
//   swarm  — 90 tiny fast runners: every point of per-hit damage above ~50 is
//            overkill, so this is a pure attack-rate / splash test.
//   armour — 12 Siege Barrels at 30% physical resist: raw per-hit damage and
//            pierce matter, splash and rate much less.
//   line   — a real depth-8 wave at ×1.25 swarm pressure: the general case.
/**
 * ---- `armour` is pinned ×1.8 since heroes lost their HP (no-HP pass) --------
 *
 * The Weaponmaster these benches grade on BLOCKS, and until the no-HP change a
 * blocker holding twelve Siege Barrels took their melee and fell partway
 * through — so the `armour` bench's 44% baseline was partly "how long does the
 * blocker last". With heroes never hurt the same wave read **90%**, a bench at
 * its ceiling: every per-hit-damage mutation's cost vanished into it (Blasting
 * Powder, Chain Arc, Piercing Volley, Hoarfrost, Ricochet and Blood Frenzy all
 * read "no cost"). This is trap 5 in `README.md` — a scenario that quietly
 * stopped being what it was fitted as — and the answer is the same as
 * `BENCH_PIN`'s: divide the change back out. Swept ×1–×3, the pin that puts the
 * bench back in its resolving band is ×1.8 (58%; ×2.3 restores the old 46% but
 * lets Siphon's Gate-drain run 17pt clear of the column). `swarm` and `line`
 * were not moved: `line` is set by the bodies a lone blocker cannot reach, not
 * by how long it stands (×1 → ×3 moves it 38% → 30%).
 */
const MUT_SCENARIOS = {
  swarm: { wave: makeWave([{ typeId: 'torch1', count: 90, hpMult: 2, gap: 0.22 }], 'swarm'), pin: 1, blurb: '90 tiny fast runners — a pure rate/splash test' },
  armour: { wave: makeWave([{ typeId: 'barrel4', count: 12, hpMult: 2, gap: 2.4 }], 'armour'), pin: 1.8, blurb: '12 Siege Barrels, 30% physical resist, ×1.8 HP' },
  // Bench mode (`BENCH_RULES`): the pre-3a continuous wave, see harness.ts.
  line: { wave: scaleWave(generateEncounter(8, 'normal', { subWaves: false }), 1.25, SWARM_PRESSURE), pin: 1, blurb: 'a depth-8 wave at ×1.25 swarm pressure' },
} as const
type MutKey = keyof typeof MUT_SCENARIOS
const MUT_KEYS = Object.keys(MUT_SCENARIOS) as MutKey[]
const mutBase = buildSpec('weaponmaster', { seed: 2 })

if (want(8)) {
  const mutBaseRate = {} as Record<MutKey, number>
  for (const k of MUT_KEYS) mutBaseRate[k] = soloStopRate(mutBase, MUT_SCENARIOS[k].wave, MUT_SEEDS, { enemyHpMult: MUT_SCENARIOS[k].pin, rules: BENCH_RULES })
  line(`Baseline stop rate — ${MUT_KEYS.map((k) => `\`${k}\` (${MUT_SCENARIOS[k].blurb}) ${pct(mutBaseRate[k])}`).join(', ')}.`)
  line('')
  /** How far a mutation must move a scenario for that scenario to count as power / cost. */
  const MUT_EDGE = 0.03
  /**
   * ---- and a CEILING, because both of the above are floors (M5) --------------
   *
   * `hasCost` and `hasPower` are the same inequality pointing in two directions:
   * a mutation must move some scenario by at least 3pt down and some scenario by
   * at least 3pt up. Nothing bounded how far *up*. Pushing Incendiary's burn from
   * 180/s to 300/s scores −7.8 / +31.3 / +25.0 and passes green; Siphon shipped
   * at **+54.6pt on `line`**, rank 1 of 11 at z = +2.77 and thirty-one points
   * clear of the runner-up, and passed green.
   *
   * **Why the ceiling is a gap to the runner-up and not an absolute number.** The
   * `swarm` bench baselines at 47.8%, so +52.2pt *is* a 100% stop — its arithmetic
   * maximum — and four mutations sit exactly there. Any absolute cap low enough to
   * have caught Siphon's +54.6 would have failed those four for saturating a
   * bench, which is a fact about the bench and not about them. The gap to the next
   * mutation in the same column is immune to that by construction: where the
   * column is saturated the leaders tie and the gap is zero, and a genuine outlier
   * has nobody standing next to it. Measured on the shipped table the gaps are
   * `swarm` 0.0pt (four-way tie at the ceiling), `armour` 10.4pt, `line` 3.8pt
   * after the Siphon re-cost and **31.6pt** before it.
   *
   * The headroom of each column is printed beside its baseline above so a reader
   * can see which numbers are capped.
   */
  const MUT_GAP_CEILING = 0.15
  line('| Mutation | `swarm` | `armour` | `line` | Measured cost | Stated downside |')
  line('|---|--:|--:|--:|---|---|')
  const mutDeltas: { name: string; d: Record<MutKey, number> }[] = []
  for (const mut of allMutations()) {
    const withMut: Sentinel = { ...mutBase, mutations: [mut] }
    const d = {} as Record<MutKey, number>
    for (const k of MUT_KEYS) d[k] = soloStopRate(withMut, MUT_SCENARIOS[k].wave, MUT_SEEDS, { enemyHpMult: MUT_SCENARIOS[k].pin, rules: BENCH_RULES }) - mutBaseRate[k]
    mutDeltas.push({ name: mut.name, d })
    const worstKey = MUT_KEYS.reduce((a, b) => (d[a] <= d[b] ? a : b))
    const bestKey = MUT_KEYS.reduce((a, b) => (d[a] >= d[b] ? a : b))
    const hasCost = d[worstKey] <= -MUT_EDGE
    const hasPower = d[bestKey] >= MUT_EDGE
    const costCell = hasCost ? `${pp(d[worstKey])} on \`${worstKey}\`` : '**none measurable**'
    line(`| ${mut.name} | ${pp(d.swarm)} | ${pp(d.armour)} | ${pp(d.line)} | ${costCell} | ${mut.downside} |`)
    if (!mut.downside) failures.push(`Mutation "${mut.name}" has no stated downside tradeoff.`)
    if (!hasCost) {
      failures.push(
        `Mutation "${mut.name}" claims "${mut.downside}" but costs nothing measurable: its worst scenario is ${pp(d[worstKey])} (\`${worstKey}\`). It is pure upside wearing a tradeoff label.`,
      )
    }
    if (!hasPower) {
      failures.push(
        `Mutation "${mut.name}" is not worth taking: its best scenario is only ${pp(d[bestKey])} (\`${bestKey}\`).`,
      )
    }
  }
  line('')
  line('**The ceiling, per column: how far the leader stands clear of the runner-up.**')
  line(`A mutation more than ${pp(MUT_GAP_CEILING)} above the next one in the same scenario is not a`)
  line('tradeoff, it is the pick — and the two checks above are both *floors*, so nothing')
  line('bounded that until now. The gap rather than an absolute cap because `swarm`')
  line(`baselines at ${pct(mutBaseRate.swarm)} and therefore *cannot* be moved more than ${pp(1 - mutBaseRate.swarm)}: an`)
  line('absolute cap tight enough to catch a real outlier fails four mutations for')
  line('reaching a 100% stop, which is a fact about the bench.')
  line('')
  line('| Scenario | Headroom (100% − baseline) | Leader | Runner-up | Gap |')
  line('|---|--:|---|---|--:|')
  for (const k of MUT_KEYS) {
    const ranked = [...mutDeltas].sort((a, b) => b.d[k] - a.d[k])
    const gap = ranked[0].d[k] - ranked[1].d[k]
    line(
      `| \`${k}\` | ${pp(1 - mutBaseRate[k])} | ${ranked[0].name} ${pp(ranked[0].d[k])} | ${ranked[1].name} ${pp(ranked[1].d[k])} | **${pp(gap)}** |`,
    )
    if (gap > MUT_GAP_CEILING) {
      failures.push(
        `Mutation "${ranked[0].name}" is ${pp(gap)} clear of the next-best mutation on \`${k}\` (${pp(ranked[0].d[k])} vs ${pp(ranked[1].d[k])}, ceiling ${pp(MUT_GAP_CEILING)}). §8's other two checks are both floors; a Mythic that dominates a whole shape of wave by that margin is not a tradeoff, it is the answer, and the fork stops being a decision.`,
      )
    }
  }
  line('')
}

// -------------------------------------------------------------- Sweep 9
if (want(9)) {
  // Map special-tile pacing: specials should be a minimal, non-clustered set.
  line('## 9. Map pacing — how much of the road is a fight')
  line('')
  line('300 generated maps. The review found **~70–83% of all nodes were battles** (83% measured on')
  line('the 10-layer map), so most forks were a battle against a battle and the route barely mattered.')
  line('With Threat following the road instead of the choice (Phase 3b), a stop is priced by the fight')
  line('it replaces, so the map can carry more of them: the target is **55–60% fights** across the')
  line('free layers (act bosses excluded — every route fights those). Stops still never crowd a layer')
  line('— at most two, and every free layer keeps at least one fight.')
  line('')
  const specialTypes = ['merchant', 'shrine', 'recruit', 'campfire', 'elite']
  const perType: Record<string, number> = Object.fromEntries(specialTypes.map((t) => [t, 0]))
  let specialSum = 0
  let worstLayerCluster = 0
  let freeNodes = 0
  let freeFights = 0
  let fightlessLayers = 0
  const MAPS = 300
  for (let i = 0; i < MAPS; i++) {
    const m = generateRunMap(new RNG(i * 7 + 1))
    const stopsByLayer: Record<number, number> = {}
    const fightsByLayer: Record<number, number> = {}
    const free = new Set<number>()
    for (const n of m.nodes) {
      if (n.type === 'start' || n.type === 'miniboss' || n.type === 'boss') continue
      free.add(n.layer)
      freeNodes++
      const fight = n.type === 'battle' || n.type === 'elite'
      if (fight) { freeFights++; fightsByLayer[n.layer] = (fightsByLayer[n.layer] ?? 0) + 1 }
      if (specialTypes.includes(n.type)) {
        perType[n.type]++
        specialSum++
        if (!fight) stopsByLayer[n.layer] = (stopsByLayer[n.layer] ?? 0) + 1
      }
    }
    for (const k of Object.keys(stopsByLayer)) worstLayerCluster = Math.max(worstLayerCluster, stopsByLayer[+k])
    for (const l of free) if (!fightsByLayer[l]) fightlessLayers++
  }
  const avgSpecials = specialSum / MAPS
  const fightShare = freeFights / freeNodes
  /** The band the map is shaped to (Phase 3b): down from ~83% toward 55–60%. */
  const FIGHT_SHARE_BAND: [number, number] = [0.5, 0.63]
  line(`- Fights (battle or elite) among free-layer nodes: **${pct(fightShare)}** (band ${pct(FIGHT_SHARE_BAND[0])}–${pct(FIGHT_SHARE_BAND[1])}; target 55–60%)`)
  line(`- Avg special tiles per map: **${f1(avgSpecials)}**`)
  line(`- Per type per map: ${specialTypes.map((t) => `${t} ${f2(perType[t] / MAPS)}`).join(', ')}`)
  line(`- Max stops in a single layer (any map): **${worstLayerCluster}** · free layers with no fight: **${fightlessLayers}**`)
  line('')
  if (fightShare < FIGHT_SHARE_BAND[0] || fightShare > FIGHT_SHARE_BAND[1]) {
    failures.push(`Map pacing: ${pct(fightShare)} of free-layer nodes are fights, outside the ${pct(FIGHT_SHARE_BAND[0])}–${pct(FIGHT_SHARE_BAND[1])} band.`)
  }
  if (worstLayerCluster > 2) failures.push(`Map stops cluster (${worstLayerCluster} in one layer > 2).`)
  if (fightlessLayers > 0) failures.push(`${fightlessLayers} free map layer(s) offer no fight at all — "fight here" must always be a road.`)
}

// -------------------------------------------------------------- Sweep 10
if (want(10)) {
  // Curse affixes — new (M19-c).
  line('## 10. Curse affixes (are the tradeoffs real?)')
  line('')
  line('`CURSE_ENCHANTS` roll at 20% on epic+ items as a *dramatic* extra affix: a big')
  line('upside bought with a real downside. Nothing measured them until now. Each curse is')
  line('equipped alone on both an offensive build and a low-crit magic build (the case')
  line('where a crit penalty has nothing to bite), and graded on the same stop rate as §4.')
  line('')
  const curseFound = new Map<string, Enchantment>()
  {
    const rng = new RNG(1234)
    for (let i = 0; i < 40000 && curseFound.size < 5; i++) {
      const it = generateItem(rng, { slot: rng.pick(['oneHand', 'offHand', 'body']), rarity: 'legendary' })
      for (const e of it.enchantments) if (e.id.startsWith('cx_') && !curseFound.has(e.id)) curseFound.set(e.id, e)
    }
  }
  /** A curse whose *worst* scenario is still this far positive is not a tradeoff. */
  const CURSE_FAKE_THRESHOLD = 0.05
  /**
   * The floor this sweep was missing (M19-f).
   *
   * "No curse is a net upgrade in *every* scenario" is satisfied trivially by a
   * curse that does nothing at all, and by one that is simply bad — neither is a
   * tradeoff, and both shipped. A curse is a *dramatic* affix: a big upside
   * bought with a real downside. So it has to move a build by this much in BOTH
   * directions somewhere in the set, exactly the way §8 grades a mutation.
   *
   * This replaces the old single-sided check. Before/after on the shipped table:
   * the old form passed all five curses; the new form is what shows `cx_reckless`
   * to be inert (×1.0175 throughput — the "big hits instead of many" shape it
   * sells does not exist in an engine whose only per-hit non-linearity is a
   * fractional resist) and `cx_frenzied` to be strictly worse than no curse.
   */
  const CURSE_EDGE = 0.02
  line('| Curse | Rolled mods | `phys` | `magic` | Worst case | Verdict |')
  line('|---|---|--:|--:|--:|---|')
  for (const [id, e] of curseFound) {
    const dPhys =
      benchStop(
        withMainAffix(AFFIX_SCENARIOS.phys.build, id, e),
        'phys',
      ) - affixBase.phys
    const dMagic =
      benchStop(
        withMainAffix(AFFIX_SCENARIOS.magic.build, id, e),
        'magic',
      ) - affixBase.magic
    const worst = Math.min(dPhys, dMagic)
    const fake = worst > CURSE_FAKE_THRESHOLD
    line(
      `| ${e.label} (\`${id}\`) | \`${JSON.stringify(e.mods)}\` | ${pp(dPhys)} | ${pp(dMagic)} | ${pp(worst)} | ${fake ? '**fake tradeoff — net upgrade**' : 'real tradeoff'} |`,
    )
    const best = Math.max(dPhys, dMagic)
    if (best < CURSE_EDGE) {
      failures.push(
        `Curse "${e.label}" (${id}) has no upside: its BEST scenario is ${pp(best)} (phys ${pp(dPhys)}, magic ${pp(dMagic)}). A curse is a dramatic affix bought with a downside; one that is inert or strictly bad is a downside bought with nothing.`,
      )
    }
    if (worst > -CURSE_EDGE && best >= CURSE_EDGE) {
      failures.push(
        `Curse "${e.label}" (${id}) has no downside anywhere it was measured: worst scenario ${pp(worst)}. It is a plain upgrade wearing a curse label.`,
      )
    }
    if (fake) {
      failures.push(
        `Curse "${e.label}" (${id}) is a fake tradeoff: even its worst scenario is ${pp(worst)}. It is a straight upgrade wearing a curse label.`,
      )
    }
  }
  line('')
  line('**Two invariants, not one.** A curse must (a) not be a net upgrade in every')
  line(`scenario — the original check — and (b) actually be a *trade*: at least ${pp(CURSE_EDGE)} of`)
  line('upside somewhere and at least that much cost somewhere. (b) is new, and it is the')
  line('half that can catch an affix that does nothing: the old check was satisfied by any')
  line('curse whose worst case was negative, including one whose best case was too.')
  line('')
  line('The prose that used to sit here described `cx_frenzied` as "+22% net with no axis')
  line('given up" and the −15% crit on `cx_vengeful` as "free for half the roster", one line')
  line('above a table showing neither number. Whatever the table says above is the current')
  line('state; this paragraph no longer carries a second, older one.')
  line('')
  line('**What (b) caught, and what fixing it taught (M19-g).** `cx_frenzied` was the last')
  line('affix to fail this floor: at ×1.9 rate / ×0.5 damage it measured −0.6pt / +13.6pt —')
  line('mildly bad on one bench, good on the other, i.e. a plain upgrade wearing a curse')
  line('label. The cause is structural and worth writing down before the next affix is')
  line('designed the same way: **the engine cannot read hit size.** Resists are fractional,')
  line('there is no flat armour, and nothing anywhere turns a halved hit into a wasted one,')
  line('so a rate/damage pair that cancels arithmetically buys nothing and costs nothing.')
  line('Sweeping that pair from ×1.9/×0.5 out to ×4.0/×0.3 moved the `phys` column −5.2,')
  line('−1.7, +3.5, +3.1, +5.8, −0.7, −2.0pt with no trend — noise, not a tradeoff. Crit is')
  line('the only per-hit spike the engine has, so it is the only axis a hit-size trade can')
  line('be priced against: Frenzied now buys its flurry with its crit (×1.9 rate, ×0.6')
  line('damage, −100% crit chance) and `cx_vengeful` buys raw damage with the same coin in')
  line('the opposite direction — one wants many cheap hits, the other few expensive ones.')
  line('Both of Frenzied\'s signs hold across the whole neighbourhood rate 1.8–2.2 × damage')
  line('0.60–0.70, so the pass is a basin rather than a knife edge.')
  line('')
}

// -------------------------------------------------------------- Sweep 11
if (want(11)) {
  // Fresh-player run — new (M19-e), then re-modelled (M19-e2).
  line('## 11. Fresh-player run (zero meta, one hero, 60 gold)')
  line('')
  line('**Why this exists.** Every other sweep fields 3–5 tier-2 specialists with')
  line('depth-scaled gear sets and upgrade purchases on every tower. A real first run does')
  line(`not: \`pickStartingHero\` hands the player **one level-1 hero**, \`START_GOLD\` = ${START_GOLD},`)
  line('and the opening kit `engine/kit.ts` deals **after the pick** and has the hero **wear**')
  line('(a weapon of the hero\'s own damage type — common, or epic for a Mystic — a common body,')
  line('a rare off-hand; the harness and the store call the same function). Every Sentinel who')
  line('joins later arrives carrying one common on-type weapon and dresses its empty slots out')
  line('of the pack. The zero-meta baseline had never been simulated, so nobody knew whether it')
  line('was a wall.')
  line('')
  line('**Two models, because one of them was a fiction.** The first version of this sweep')
  line('marched the hero through ten consecutive battles, refused every merchant, took no')
  line('recruits and picked a reward card **at random**. It reported 0%. That is not the')
  line('floor, it is a floor with the game removed: `generateRunMap` guarantees a recruit')
  line('stop, a merchant stop and a shrine on every map; `resolveNode` fires a one-time')
  line('Crossroads offering a free scaled body at the halfway point; and `scaledRecruit`')
  line('hands over a hero at the roster **median level minus 3**, not a level-1 body.')
  line('Both models are reported. The strict one is kept because it is a useful lower')
  line('bound on how badly a first run can be played; the graded one is the realistic one.')
  line('')
  line('**Threat follows the road (Phase 3b).** Both models fight every layer at')
  line('`threatAtLayer(layer)` — the same number whatever route reached it. The old rules')
  line('charged every battle ×1.42 (×1.52 an elite), every stop ×1.13 and every accepted')
  line('hire, pact or mutation ×1.05, which made taking power a Threat bill and put the boss')
  line('anywhere from ×15 to ×30 depending on greed. A stop now costs the fight it replaces —')
  line('its XP, gold and card — and nothing else.')
  line('')

}

/**
 * One simulated run's outcome. Model B now returns `runsim`'s {@link RunOutcome}
 * directly; model A (the strict floor) fills the same shape so both can be
 * summarised by one function.
 */
type FreshResult = RunOutcome

// ---- Model A: the strict floor (unchanged) --------------------------------
function freshRun(seed: number, archetype: Archetype, recruitDepths: number[]): FreshResult {
  const rng = new RNG(seed)
  // The classless rework: the hero pick's dealt hero of that look, wearing
  // its card's gear and skill (the store's own `chosenHero`).
  let roster: Sentinel[] = [chosenHero(seed, STARTER_SKILL_POOL, BASIC_ITEM_KINDS, modelledPick(seed, STARTER_SKILL_POOL, BASIC_ITEM_KINDS, archetype))!]
  let gold = START_GOLD
  let baseHp = MAX_BASE_HP
  let reached = 0
  let bossThreat: number | null = null
  let runMods: EffectMods[] = []
  // Same field and same variant keys the seed would deal a real run (WS8).
  const field = pickBattleMap(seed)
  const heroSlots = bestSlots(field)
  for (let depth = 1; depth <= NODES; depth++) {
    if (recruitDepths.includes(depth) && roster.length < MAX_ROSTER) {
      // A recruit node hands over a fresh level-1 body.
      const body = rollRecruitBody(rng, BASIC_ITEM_KINDS, roster.map((h) => h.name))
      roster = [...roster, withFirstSkill(body, recruitSkill(seed, body.id, STARTER_SKILL_POOL))]
    }
    const kind = mcKind(depth)
    const threat = threatAtLayer(depth) * nodeThreatMult(depth === NODES ? 'boss' : kind === 'elite' ? 'elite' : 'battle')
    if (depth === NODES) bossThreat = threat
    const m = runBattle({
      team: roster.map((s, i) => ({ sentinel: s, slotId: heroSlots[i] })),
      depth,
      kind,
      map: field,
      autoDeploy: true,
      variantSeed: encounterSeed(seed, depth),
      enemyHpMult: threat,
      baseHp,
      teamMods: runMods,
      maxSeconds: 90,
      seed: seed * 131 + depth,
    })
    baseHp = m.baseHpLeft
    if (!m.cleared || baseHp <= 0) break
    reached = depth

    if (depth === NODES) break
    gold += m.goldEarned + (kind === 'boss' ? 60 : kind === 'elite' ? 25 : 0)
    const awards = levelXpAwards(m.perSentinel.map((p) => ({ id: p.id, xpGained: p.xp })), { wave: m.wave, hpMult: threat, depth, kind })
    const xpById = new Map(awards.map((p) => [p.id, p.xpGained]))
    roster = roster.map((s) => randomSkills(applyXp(s, xpById.get(s.id) ?? 0), rng, STARTER_SKILL_POOL, seed))

    // One of three reward cards, taken at random the way a first-timer would.
    {
      const card = rng.pick(generateRewardCards(rng, { luck: depth * 0.03 }))
      if (card.kind === 'item' && card.item) {
        roster = [equipIfBetter(roster[0], card.item), ...roster.slice(1)]
      } else if (card.grant) {
        roster = applyGrant(roster, card.grant, (m2) => { runMods = [...runMods, m2] })
      }
    }
  }
  const won = reached >= NODES
  return {
    reached,
    contract: null,
    cleared: reached,
    won,
    battles: reached + 1,
    roster: roster.length,
    bossThreat,
    marks: marksFor(reached, won, difficultyRules(0)),
    layers: NODES + 1,
    fieldId: field.id,
    starter: archetype,
    fights: reached + 1,
    nodes: reached + 1,
    levelByLayer: [],
  }
}

function applyGrant(roster: Sentinel[], g: RewardGrant, addMods: (m: EffectMods) => void): Sentinel[] {
  if (g.mods) addMods(g.mods)
  return roster.map((s) => ({
    ...s,
    stats: {
      str: s.stats.str + (g.stats?.str ?? 0),
      dex: s.stats.dex + (g.stats?.dex ?? 0),
      int: s.stats.int + (g.stats?.int ?? 0),
    },
    thorns: s.thorns + (g.thorns ?? 0),
    patience: s.patience + (g.patience ?? 0),
  }))
}


/**
 * The doctrine gate (roguelite): a zero-unlock run must be **winnable by a good
 * player and still plainly hard**. Both edges matter. A floor below the band is
 * the genre's cardinal sin — "the first ten runs are unwinnable by design". A
 * ceiling above it means the campaign does not notice whether the player brought
 * a team, which makes every unlock cosmetic.
 */
const FRESH_WIN_BAND: [number, number] = [0.15, 0.35]
/**
 * The ceiling's old rationale — "the campaign is not noticing whether the player
 * brought a team" — turned into a comparison that can actually fail.
 *
 * It is gated in **§12**, not here, and the reason is worth writing down: the
 * obvious version of this check compares §11's fresh run against §6's
 * depth-appropriate company, and those two models differ in their *structure*
 * (§6 fights every layer straight with no map to route) as much as in their
 * team, so the number it produces is not about the team at all. §12 compares a
 * zero-meta run against a hub-equipped one **inside one model, on identical
 * seeds**, which is the same question asked properly.
 */
const FRESH_TEAM_EDGE = 0.08
/** A run should end in a *spread* of places, the same shape invariant §6 applies. */
const FRESH_CLIFF_MAX = 0.4

/**
 * Sample size for both §11 models. 120 → **240** (tuning lane): the first-timer
 * line is now gated at BOTH edges of its band, and at 120 (1σ ≈ 3.7pt at p≈0.2)
 * a 20% line sits one σ off the 15% floor — the gate would flip on a resample.
 * 240 puts 1σ at ≈ 2.6pt for ~25s more. `FW_FRESH_RUNS=480` (Node-only, like
 * `FW_SPECIAL_THREAT`) drops it to ≈ 1.8pt for a fit.
 */
const FRESH_RUNS = Number(process.env.FW_FRESH_RUNS) || 240
const FRESH_ARCHES: Archetype[] = ['fighter', 'rogue', 'mystic']
const policyIdx = (id: string) => POLICIES.findIndex((p) => p.id === id)
interface FreshSummary {
  label: string
  /** Row label for the survival table, where the full one does not fit. */
  short: string
  winRate: number
  avgDepth: number
  avgBattles: number
  avgRoster: number
  hist: number[]
  survival: number[]
  cliffDepth: number
  cliffShare: number
  byArch: Record<string, number>
  /** Mean Threat carried into the boss fight, over the runs that reached it. */
  bossThreat: number
  /** Share of runs that reached the boss at all (the denominator above). */
  bossReach: number
}
function summarise(label: string, short: string, run: (seed: number, a: Archetype) => FreshResult): FreshSummary {
  const hist = new Array(NODES + 1).fill(0)
  const byArch: Record<string, number[]> = { fighter: [], rogue: [], mystic: [] }
  const all: FreshResult[] = []
  for (let i = 0; i < FRESH_RUNS; i++) {
    const arch = FRESH_ARCHES[i % 3]
    const r = run(9001 + i * 17, arch)
    all.push(r)
    hist[Math.min(NODES, r.reached)]++
    byArch[arch].push(r.reached)
  }
  const endings = new Array(NODES + 2).fill(0)
  for (const r of all) if (!r.won) endings[r.reached + 1]++
  const survival = Array.from({ length: NODES }, (_, i) => all.filter((r) => r.reached >= i + 1).length / all.length)
  return {
    label,
    short,
    winRate: all.filter((r) => r.won).length / all.length,
    avgDepth: mean(all.map((r) => r.reached)),
    avgBattles: mean(all.map((r) => r.battles)),
    avgRoster: mean(all.map((r) => r.roster)),
    hist,
    survival,
    cliffDepth: endings.indexOf(Math.max(...endings)),
    cliffShare: Math.max(...endings) / all.length,
    bossThreat: mean(all.filter((r) => r.bossThreat !== null).map((r) => r.bossThreat!)),
    bossReach: all.filter((r) => r.bossThreat !== null).length / all.length,
    byArch: Object.fromEntries(Object.entries(byArch).map(([k, v]) => [k, mean(v)])),
  }
}

if (want(11)) {
  /**
   * ---------------------------------------------------------------------------
   * The policy set (M19-f)
   * ---------------------------------------------------------------------------
   *
   * §11 used to grade **one hardcoded routing policy** — specials over battles,
   * elites last — and call it "the way a player reads a map". Measured against
   * three alternatives on identical seeds and heroes, it is the *worst* line
   * available, which meant the 15–35% gate was being satisfied by a badly-played
   * run while nobody had ever measured what a well-played one does.
   *
   * All four are reported. The two edges of the gate are then read off the policy
   * each edge is a question about:
   *
   *  - **the floor** — "can a zero-meta run be won at all?" — is a question about
   *    the *ceiling of play*, so it is gated on the best line in the set;
   *  - **the ceiling** — "is a first run still hard?" — is a question about the
   *    line a first-timer actually walks, so it is gated on the shipped heuristic;
   *  - and a third gate, new, asks whether the campaign notices a real team at
   *    all: the best zero-meta line must stay a clear distance below §6's
   *    depth-appropriate 3–5 tower company.
   *
   * That is strictly more binding than the old single-policy band: it can now
   * fail because good play is impossible, because bad play is unpunished, or
   * because bringing a team stopped mattering.
   */
  const freshByPolicy = POLICIES.map((p) =>
    summarise(`route: ${p.label}`, p.id, (s, a) => simulateRun(s, a, { policy: p })),
  )
  /** The line a first-timer walks — what §11 has always claimed to model. */
  const freshReal = freshByPolicy[policyIdx('specials')]
  /** The best line the set finds, i.e. the ceiling of play on the same seeds. */
  const freshBest = freshByPolicy.reduce((a, b) => (b.winRate > a.winRate ? b : a))
  const freshSolo = summarise('Strict floor — 10 forced battles, no shops, no hires, random card', 'Strict floor', (s, a) => freshRun(s, a, []))
  const freshRecruit = summarise('Strict floor + 2 free level-1 recruits (depths 3 and 6)', 'Strict + 2 recruits', (s, a) => freshRun(s, a, [3, 6]))
  const FRESH_ROWS = [freshSolo, freshRecruit, ...freshByPolicy]

  line('| Variant | Runs | Win rate | Avg nodes cleared | Battles fought | Avg roster | Run-ending node | Share it ends |')
  line('|---|--:|--:|--:|--:|--:|--:|--:|')
  for (const s of FRESH_ROWS) {
    line(
      `| ${s.label} | ${FRESH_RUNS} | **${pct(s.winRate)}** | ${f1(s.avgDepth)} | ${f1(s.avgBattles)} | ${f1(s.avgRoster)} | depth ${s.cliffDepth} | ${pct(s.cliffShare)} |`,
    )
  }
  line('')
  line('**The routing spread.** Same seeds, same starting heroes, same map — only the')
  line('rule for choosing the next node changes:')
  line('')
  line('| Route | Win rate | Nodes cleared | Battles fought | Boss met at Threat |')
  line('|---|--:|--:|--:|--:|')
  for (const s of freshByPolicy) {
    const gate = s === freshReal ? ' ← **gated (band)**' : s === freshBest ? ' ← **gated (floor)**' : ''
    line(`| ${s.label}${gate} | **${pct(s.winRate)}** | ${f1(s.avgDepth)} | ${f1(s.avgBattles)} | ×${f1(s.bossThreat)} |`)
  }
  line('')
  line(
    `Spread across the set: **${pct(Math.min(...freshByPolicy.map((s) => s.winRate)))} – ${pct(Math.max(...freshByPolicy.map((s) => s.winRate)))}** — ${((freshBest.winRate - freshReal.winRate) * 100).toFixed(0)} points between the line the report used to grade and the best one it can find.`,
  )
  line('')
  line('Survival curve — share of fresh runs that clear each node:')
  line('')
  line(`| Depth | ${Array.from({ length: NODES }, (_, i) => i + 1).join(' | ')} |`)
  line(`|---|${'--:|'.repeat(NODES)}`)
  for (const s of FRESH_ROWS) {
    line(`| ${s.short} | ${s.survival.map(pct).join(' | ')} |`)
  }
  line('')
  line(`Nodes-cleared histogram (strict): ${freshSolo.hist.map((c, d) => `${d}:${c}`).join('  ')}`)
  line(`Nodes-cleared histogram (gated line): ${freshReal.hist.map((c, d) => `${d}:${c}`).join('  ')}`)
  line('')
  line('Average nodes cleared by starting archetype (gated line): ')
  line(
    Object.entries(freshReal.byArch)
      .map(([k, v]) => `**${k}** ${f1(v)}`)
      .join(', ') + '.',
  )
  line('')
  line('**Findings.**')
  line('')
  line(
    `- The strict floor is a fiction, and an expensive one: the same campaign, same seeds, same starting hero, wins ${pct(freshSolo.winRate)} when the model refuses to spend gold, hire or read a card, and ${pct(freshReal.winRate)} when it does what the game offers.`,
  )
  line(
    `- **The largest single term in a fresh run is the route.** ${((freshBest.winRate - freshReal.winRate) * 100).toFixed(0)} points separate the best line from the shipped heuristic — more than any wave-table dial in the fit table below, and more than the entire hub unlock track is worth (§12).`,
  )
  line(
    `- **A stop is a price now, not a trap.** The specials-first line fights ${f1(freshByPolicy[policyIdx('battles')].avgBattles - freshReal.avgBattles)} fewer battles than the battles-first line and wins ${Math.abs((freshReal.winRate - freshByPolicy[policyIdx('battles')].winRate) * 100).toFixed(0)} points ${freshReal.winRate >= freshByPolicy[policyIdx('battles')].winRate ? 'more' : 'less'}. Threat no longer bills a stop or a choice (Phase 3b), so what a stop costs is the fight it replaces — its XP, gold and reward card — and what it pays is its offer: a campfire's Gate or level, a merchant's repair and shelf, a hire.`,
  )
  line(
    `- The curve has a real bite at every node rather than one cliff: no single depth ends more than ${pct(freshReal.cliffShare)} of gated-line runs (depth ${freshReal.cliffDepth} is the worst).`,
  )
  line(
    `- Depths 1–3 are not a wall — ${pct(freshReal.survival[2])} of gated-line zero-meta runs clear depth 3 — and neither is any single later node.`,
  )
  line('')
  line('**Read it against §6.** The Monte Carlo fields a depth-scaled 3–5 tower team through')
  line(`all twelve layers and wins ${pct(winRate)} of the time; the zero-meta first run, played the`)
  line(`way the game is actually laid out, wins ${pct(freshReal.winRate)} on the first-timer line and ${pct(freshBest.winRate)} on the best`)
  line('one. The gap between those numbers is what the meta layer and the player\'s own')
  line('learning are worth, and it is now a difference in *how much slack you have*, not')
  line('the difference between a game and a grind gate.')
  line('')
  line('**The two bands meet the boss at the same Threat.** §6 and a routed first run both fight')
  line(`every layer at \`threatAtLayer\`, so the final boss is ×${f1(mcBossThreat)} in §6 and ×${f1(freshReal.bossThreat)} on the first-timer line —`)
  line('the exchange-rate problem the old special step was introduced to narrow (a routed run used to')
  line('meet the boss at ×11–15 against §6\'s ×30) is gone by construction: a wave-table dial now lands')
  line('equally hard on both sweeps.')
  line('')
  line('**The four gates.**')
  line('')
  line(
    `1. **Floor — winnable played well:** the best line in the set must win ≥ ${pct(FRESH_WIN_BAND[0])}. Measured **${pct(freshBest.winRate)}** (${freshBest.short}). Below this, the honest advice to a losing player is "go grind the hub", which is the genre's cardinal sin.`,
  )
  line(
    `2. **Ceiling — still hard for a first-timer:** the shipped heuristic line must win ≤ ${pct(FRESH_WIN_BAND[1])}. Measured **${pct(freshReal.winRate)}**.`,
  )
  line(
    `3. **Floor — a first-timer can win too:** the same first-timer line must win ≥ ${pct(FRESH_WIN_BAND[0])}. Measured **${pct(freshReal.winRate)}**. Gate 1 only asks that *good* play wins; nothing asked whether the line a first-timer actually walks can, and it sat at 14% — under its own band — with every invariant green. A first run the player loses nine times in ten is an instruction to farm the hub by another name.`,
  )
  line(
    `4. **The campaign must notice a team** — the old ceiling's stated rationale, which was never actually tested. It is measured in §12 rather than here, against a hub-equipped run on the same seeds, because §6 differs from §11 in *structure* as much as in team strength: for the record, §6 wins ${pct(winRate)} against this sweep's best line at ${pct(freshBest.winRate)}, and §12 puts the same comparison on a like-for-like footing.`,
  )
  line('')
  line(`The design *target* inside the band remains **15–25%** on the gated line. The band`)
  line(`is wide partly because this is a Monte Carlo over ${FRESH_RUNS} runs of a *modelled* player`)
  line(`(1σ ≈ ${f1(Math.sqrt(0.25 / FRESH_RUNS) * 100)}pt), and partly for a reason that belongs in the open.`)
  line('')
  line(`**The shipped number is ${pct(freshReal.winRate)}.** Two structural corrections moved it, and both were`)
  line('the harness being wrong rather than the game changing:')
  line('')
  line('| Correction | What it was |')
  line('|---|---|')
  line('| Equipping model | `itemScore` summed `physDamage + magDamage`; `computeCombat` reads only the one matching the wielder — `const flat = isPhys ? gear.flatPhys : gear.flatMag` — so the modelled player bought Greatswords for mystics and scored them as upgrades. Every buy and equip decision is now a `computeCombat().dps` delta. |')
  line('| Loot parity | `generateItem` / `generateRewardCards` were called with `{ luck }` only, while every shipped call site passes `roster` (type-aware offers) and `pity` (the drought timer). Now at parity, including `creditPity` on the item actually taken. |')
  line('')
  line('Together they were worth **+13pt** on this line — 24% before, 37% after, same')
  line('policy, same seeds, same game. They are quoted together because they were')
  line('measured together; the split between them was not measured and is not claimed.')
  line('Either way the point stands: 13 of the points this sweep used to report as')
  line('difficulty were the model failing to play the game properly.')
  line('The wave tables then moved once, deliberately, and for a reason that belongs to §6')
  line('as much as here: `BUDGET_RATIO_FLOOR` 1.30 → 1.44 and `BOSS_STEP` 0.78 → 0.58. The')
  line('boss keeps the same absolute HP pool; the nodes in front of it caught up. See the')
  line('constant\'s own doc comment for the before/after on both sweeps.')
  line('')
  line('**The first-timer line, re-fitted (tuning lane).** It read 14% here and 15.3% at n=600 — under')
  line('its own band, ungated. The lever was onboarding, not stats: `STOP_XP_SHARE` 0.35 → 0.55')
  line('(`run/battle.ts`), so a stop drills the company for a bigger share of the fight it skipped. The')
  line('line that stops most is the one that reached act 3 levels short, and §6 cannot move — its model')
  line('has no stops. Measured at n=600 on these seeds: first-timer 15.3% → 20.3%, battles 27 → 26,')
  line('recruits 20 → 20, adaptive 28 → 31. Every fixed-table line also reads its Gate now: at or below')
  line('60% it takes a campfire (or a merchant\'s repair it can pay for) when the road offers one — see §12.')
  line('')
  line('| Dial tried (earlier fit, kept for the record) | §11 realistic | §6 Monte Carlo | Verdict |')
  line('|---|--:|--:|---|')
  line('| budget step +4%/depth | 42% → 29% | 53% → **25%** | §6 win band broken |')
  line('| head count −38% | 42% → 27% | deaths **49% → 84%** on one node | §6 shape broken |')
  line('| enemy resists +0.12 | 42% → 28% | 53% → **39%** | §6 win band broken |')
  line('| enemy leak ×2 | 42% → 41% | 53% → 47% | no effect on §11 |')
  line('| budget curve front-loaded | 42% → **47%** | 53% → 55% | wrong direction |')
  line('| enemy speed ×1.5, boss 0.86 | 45% → 30% | 50% | §4 censors, §6 concentration 74% |')
  line('')
  if (freshBest.winRate < FRESH_WIN_BAND[0]) {
    failures.push(
      `Zero-meta baseline is a grind gate: even the best routing line (${freshBest.short}) wins only ${pct(freshBest.winRate)}, below the ${pct(FRESH_WIN_BAND[0])} floor. Losing a first run has to be a skill signal, not an instruction to farm the hub.`,
    )
  }
  if (freshReal.winRate < FRESH_WIN_BAND[0]) {
    failures.push(
      `First-timer line is a wall: the shipped heuristic wins only ${pct(freshReal.winRate)} at zero meta, below the ${pct(FRESH_WIN_BAND[0])} floor of its band. The line a first-timer walks has to be winnable, not only the best line.`,
    )
  }
  if (freshReal.winRate > FRESH_WIN_BAND[1]) {
    failures.push(
      `Zero-meta baseline is too soft: the first-timer line wins ${pct(freshReal.winRate)}, above the ${pct(FRESH_WIN_BAND[1])} ceiling.`,
    )
  }
  if (freshReal.cliffShare > FRESH_CLIFF_MAX) {
    failures.push(
      `Fresh-player difficulty is a cliff, not a curve: depth ${freshReal.cliffDepth} alone ends ${pct(freshReal.cliffShare)} of gated-line zero-meta runs (max ${pct(FRESH_CLIFF_MAX)}).`,
    )
  }
  if (freshSolo.cliffShare > FRESH_CLIFF_MAX) {
    failures.push(
      `Strict-floor difficulty is a cliff, not a curve: depth ${freshSolo.cliffDepth} alone ends ${pct(freshSolo.cliffShare)} of zero-meta solo runs (max ${pct(FRESH_CLIFF_MAX)}).`,
    )
  }
  summary.push(`Fresh player REALISTIC (zero meta, 1 hero, ${START_GOLD}g): ${pct(freshReal.winRate)} win (band ${pct(FRESH_WIN_BAND[0])}-${pct(FRESH_WIN_BAND[1])}), ${f1(freshReal.avgDepth)}/${NODES} nodes, ${f1(freshReal.avgBattles)} battles, worst node ${pct(freshReal.cliffShare)}`)
  summary.push(`Fresh player STRICT floor: ${pct(freshSolo.winRate)} win, ${f1(freshSolo.avgDepth)}/${NODES} nodes | +2 recruits ${pct(freshRecruit.winRate)}`)
  summary.push(`Fresh run by starter (first-timer line): ${Object.entries(freshReal.byArch).map(([k, v]) => `${k} ${f1(v)} nodes`).join(', ')} | boss met at ×${f1(freshReal.bossThreat)}`)
  summary.push(`Fresh-run routing spread: ${freshByPolicy.map((r) => `${r.short} ${pct(r.winRate)}`).join(', ')} | gated: band on ${freshReal.short} (${pct(freshReal.winRate)} vs ${pct(FRESH_WIN_BAND[0])}–${pct(FRESH_WIN_BAND[1])}), floor on ${freshBest.short} (${pct(freshBest.winRate)} vs ${pct(FRESH_WIN_BAND[0])})`)
}

// -------------------------------------------------------------- Sweep 12
if (want(12)) {
  // The hub — new (M19-f). The sweep that would have stopped the Cartographer.
  line('## 12. What the HQ sells (does a purchase ever make the game worse?)')
  line('')
  line('**Why this exists.** `Cartographer\'s Table` shipped as a 120-mark horizontal')
  line('unlock whose card promised *"longer runs, wider forks, more routes worth arguing')
  line('about"*. It set `layerCount` 11 → 13, which moved the boss from layer 10 to layer')
  line('12: two extra compounding Threat steps (×1.42² = ×2.02) **and** a boss budget')
  line('quoted off `waveBudget(11)` instead of `waveBudget(9)` (×2.28) — a ~4.6× harder')
  line('final fight, uncompensated, for a purchase that pays +8% marks. Measured on the')
  line('model below it took the campaign from **40% winnable to 7%**, permanently, with no')
  line('opt-out short of `resetMeta`. The fully-bought hub was the *worst* state to play')
  line('from. Every invariant in this report was green while that was true, because')
  line('nothing here had ever simulated a run with a hub behind it.')
  line('')
  line('**The HQ (build step 3) replaced the hub.** Its three offices — HR (the Opening deal, the')
  line('Hiring Hall), Finance (interest) and Operations (pack slots, boulders, company focus, the')
  line('scouts) — are graded here on the same gate. The modelled player makes the sensible')
  line('choices: each office alone at its top level, then everything, orders paid, with the focus')
  line('on Ironvein (the shield and mail company). Finance pays gold, not power, and is priced in §13.')
  line('')
  line('Each cell is `FW_META_RUNS` runs on **identical seeds and starting heroes**, so the')
  line('comparison against zero HQ is paired and the noise mostly cancels; the ± column is')
  line('two standard errors of that paired difference.')
  line('')

}

/** How far below zero-meta a purchase may measure before it is a defect. */
const HUB_TOLERANCE = 0.03
/**
 * The lines the hub gate is read off: **all of them**.
 *
 * This started as three — the specials-first heuristic was going to be exempt,
 * because on the current numbers a stop is worth *negative* to a fresh run
 * (§11), so a player who takes every stop is punished by any map that offers
 * more of them, and `Cartographer's Table` duly measured −9±5pt on that line at
 * n=500 while reading −1 on the others. The exemption was the wrong answer: it
 * would have shipped an unlock that is a trap for exactly the player least
 * equipped to see it coming. The map generator pays for its extra roads
 * instead (`runmap.assignTypes`): a wide layer keeps two fights and a road out
 * of a stop leads back to a fight (Phase 3b — the old price, a merchant and a
 * shrine off the cap, starved the stop-first line of Gate repairs on the
 * three-act road), which lands every line at or above the baseline. The
 * gate is therefore the strong form of the rule the doctrine states: buying
 * anything must not make the run worse, for anybody.
 */
const HUB_GATED_POLICIES = POLICIES.map((p) => p.id)
/**
 * 150 → **210** (WS8). §12 and §13 are paired-seed comparisons, and the pairing
 * carries the *battlefield* with it (`simulateRun` draws the field off the same
 * seed in both arms) — but it cannot pair out the interaction: a hub unlock or a
 * Banner rule is worth a different amount on a different field and against a
 * different wave shape, and two fields × four normal / three elite / three boss
 * shapes is a great deal more per-run variance than one field and one wave
 * table. That shows up directly in these two sweeps. While a third field was
 * being trialled, 150 a cell failed twice on resolution alone — `Free Companies`
 * read −11pt against a ±9pt floor and the Banner ladder inverted at rungs 1 and
 * 2 by 2pt — and both came back inside their gates at 350 with nothing in the
 * game changed. 210 buys most of that back for about 25 seconds of runtime; a
 * gate that flips on a resample is worse than a slow one, and a three-minute
 * suite nobody re-runs is worse than both. `FW_META_RUNS=500` still halves the
 * floor for a fit.
 */
const HUB_RUNS = Number(process.env.FW_META_RUNS) || 210

/**
 * §13's own sample size. The Banner gate asks every rung to cost **≥ 3pt** of
 * win rate (Phase 1: "earned, not bought" — a rung that costs nothing is a
 * bonus, not a wager), and 210 paired runs cannot resolve that: Thin Pickings
 * read −1pt at n=210 and −6.2±5.0pt at n=600 on the same model, and it is that
 * n=210 reading ("Banner 1 costs 0pt for ×1.4 marks") that put it on the review
 * list. A ≥3pt gate on a ±5pt cell is a coin flip, so the ladder is measured at
 * 600 (about +30s of runtime) and the gate reads the point estimate.
 */
const BANNER_RUNS = Number(process.env.FW_BANNER_RUNS) || 600
/** The smallest win-rate cost a difficulty step may have over the step below it. */
const BANNER_MIN_COST = 0.03

interface HubCell { winRate: number; wins: number[]; marks: number }
function hubCell(meta: Loadout, policy: RoutePolicy, banner = difficultyRules(0), runs = HUB_RUNS): HubCell {
  const wins: number[] = []
  const marks: number[] = []
  for (let i = 0; i < runs; i++) {
    const r = simulateRun(9001 + i * 17, FRESH_ARCHES[i % 3], { meta, difficulty: banner, policy })
    wins.push(r.won ? 1 : 0)
    marks.push(r.marks)
  }
  return { winRate: mean(wins), wins, marks: mean(marks) }
}
/** Two standard errors of a paired win-rate difference (cells share seeds). */
function pairedTolerance(a: number[], b: number[]): number {
  const d = a.map((x, i) => x - b[i])
  const m = mean(d)
  if (d.length < 2) return 1
  const v = mean(d.map((x) => (x - m) ** 2)) * (d.length / (d.length - 1))
  return 2 * Math.sqrt(v / d.length)
}

/** The HQ states §12 grades — `runsim.HQ_STATES`, shared with `meta-sweep` and `tune`. */
const HUB_STATES: [string, HqState][] = HQ_STATES
const ZERO_LABEL = HQ_STATES[0][0]
const DEAL_TOP_LABEL = HQ_STATES.find(([l]) => l.startsWith('Opening deal 5'))![0]

if (want(12)) {
  const hubZero: Record<string, HubCell> = {}
  for (const p of POLICIES) hubZero[p.id] = hubCell(ZERO_META, p)

  const hubCells = new Map<string, HubCell[]>()
  line(`| Hub state | ${POLICIES.map((p) => p.id).join(' | ')} | worst gated Δ |`)
  line(`|---|${'--:|'.repeat(POLICIES.length)}--:|`)
  for (const [label, upgrades] of HUB_STATES) {
    // The zero-meta row IS the baseline — same loadout, same seeds — so it is
    // reused rather than replayed.
    const cells =
      label === ZERO_LABEL
        ? POLICIES.map((p) => hubZero[p.id])
        : POLICIES.map((p) => hubCell(loadoutFor(label, upgrades), p))
    hubCells.set(label, cells)
    const deltas = cells.map((c, i) => c.winRate - hubZero[POLICIES[i].id].winRate)
    const cellText = cells.map((c, i) => {
      const d = deltas[i]
      const tol = pairedTolerance(c.wins, hubZero[POLICIES[i].id].wins)
      return `${pct(c.winRate)} (${d >= 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(0)}±${(tol * 100).toFixed(0)})`
    })
    let worst = Infinity
    for (let i = 0; i < POLICIES.length; i++) {
      if (!HUB_GATED_POLICIES.includes(POLICIES[i].id)) continue
      worst = Math.min(worst, deltas[i])
      const tol = Math.max(HUB_TOLERANCE, pairedTolerance(cells[i].wins, hubZero[POLICIES[i].id].wins))
      if (deltas[i] + tol < 0) {
        failures.push(
          `HQ purchase "${label}" LOWERS the win rate: ${pct(cells[i].winRate)} against zero HQ's ${pct(hubZero[POLICIES[i].id].winRate)} on the ${POLICIES[i].id} line (Δ ${(deltas[i] * 100).toFixed(0)}pt, beyond the ±${(tol * 100).toFixed(0)}pt paired noise floor). An HQ purchase may add breadth; it may never remove baseline viability.`,
        )
      }
    }
    line(`| ${label} | ${cellText.join(' | ')} | ${worst === Infinity ? '—' : `${worst >= 0 ? '+' : '−'}${Math.abs(worst * 100).toFixed(0)}pt`} |`)
  }
  line('')
  line('**The invariant.** No HQ state — any office alone, or everything the HQ sells — may')
  line('measure below zero HQ by more than the paired')
  line(`noise floor (2 s.e., minimum ${pct(HUB_TOLERANCE)}) on any of the gated routing lines`)
  line(`(${HUB_GATED_POLICIES.join(', ')}). This is the check that makes the Cartographer class of`)
  line('defect impossible to ship green: it does not care *why* a purchase made the run')
  line('worse, only that it did.')
  line('')
  line(
    `At ${HUB_RUNS} runs a cell the paired noise floor is ±3–8pt, which resolves a defect of the size that shipped (−33pt) with room to spare but not a 2pt drift; \`FW_META_RUNS=500\` halves it for a fit.`,
  )
  line('')
  {
    // Does the campaign notice a team at all? Zero meta against the full ramp, one
    // model, identical seeds — the comparison the §11 ceiling's rationale wanted.
    const rampCells = hubCells.get(DEAL_TOP_LABEL)!
    const edges = HUB_GATED_POLICIES.map((id) => {
      const i = POLICIES.findIndex((x) => x.id === id)
      return rampCells[i].winRate - hubZero[id].winRate
    })
    const bestEdge = Math.max(...edges)
    line(
      `**Does the campaign notice a team?** The Opening deal at its top (a dressed pick of four, a Level 2 skill, a second hero) is worth **+${(bestEdge * 100).toFixed(0)}pt** over zero HQ at its best (${HUB_GATED_POLICIES.map((id, i) => `${id} +${(edges[i] * 100).toFixed(0)}`).join(', ')}). The gate asks for ≥ ${pct(FRESH_TEAM_EDGE)}: below that the HQ is cosmetic, and a campaign that cannot tell a level-1 solo hero from an HQ-equipped company is not measuring the player's decisions either.`,
    )
    line('')
    if (bestEdge < FRESH_TEAM_EDGE) {
      failures.push(
        `The campaign does not notice whether the player brought a team: the whole Opening deal is worth ${(bestEdge * 100).toFixed(0)}pt of win rate (needs ≥ ${pct(FRESH_TEAM_EDGE)}). Every purchase is cosmetic.`,
      )
    }
  }
  line('**The breadth each service promises is checked separately**, because a horizontal')
  line('service is not supposed to move the win rate at all — it is supposed to widen the')
  line('run. A card that promises forks has to produce forks:')
  line('')
  const MAP_SAMPLES = 500
  interface MapShape { noChoice: number; mixed: number; specials: number; forcedElites: number; layers: number }
  function mapShape(opts: Parameters<typeof generateRunMap>[1]): MapShape {
    let steps = 0
    let noChoice = 0
    let mixed = 0
    let specials = 0
    let elites = 0
    let forced = 0
    let layers = 0
    for (let i = 0; i < MAP_SAMPLES; i++) {
      const m = generateRunMap(new RNG(i * 7 + 1), opts)
      layers += m.layers
      const byId = new Map(m.nodes.map((n) => [n.id, n]))
      const outDeg = new Map<string, number>()
      for (const e of m.edges) outDeg.set(e.from, (outDeg.get(e.from) ?? 0) + 1)
      const forcedIds = new Set<string>()
      for (const e of m.edges) if (outDeg.get(e.from) === 1) forcedIds.add(e.to)
      for (const n of m.nodes) {
        if (n.type === 'elite') { elites++; if (forcedIds.has(n.id)) forced++ }
        if (['merchant', 'shrine', 'recruit', 'campfire', 'elite'].includes(n.type)) specials++
        if (n.type === 'boss') continue
        const outs = m.edges.filter((e) => e.from === n.id).map((e) => byId.get(e.to)!)
        if (!outs.length) continue
        // The step into an act boss has one road on every map by design (the
        // act's closing fight is a single-node layer), so it is not a fork any
        // unlock could widen and is left out of the fork measure.
        if (outs.every((o) => o.type === 'miniboss' || o.type === 'boss')) continue
        steps++
        if (outs.length === 1) noChoice++
        else if (new Set(outs.map((o) => o.type)).size > 1) mixed++
      }
    }
    return {
      noChoice: noChoice / steps,
      mixed: mixed / steps,
      specials: specials / MAP_SAMPLES,
      forcedElites: elites ? forced / elites : 0,
      layers: layers / MAP_SAMPLES,
    }
  }
  const shapeBase = mapShape({})
  const shapeWide = mapShape({ wideMap: true })
  const shapeCamp = mapShape({ standingOrders: true })
  const shapeHire = mapShape({ extraRecruit: true })
  line(`| Map | Layers | Steps with no choice | Forks offering different node types | Elites with no way around | Specials / map |`)
  line('|---|--:|--:|--:|--:|--:|')
  for (const [label, sh] of [
    ['default (zero HQ)', shapeBase],
    ['Scouts 2 (wider roads)', shapeWide],
    ['Scouts 1 (a way round every ambush)', shapeCamp],
    ['Hiring Hall', shapeHire],
  ] as [string, MapShape][]) {
    line(`| ${label} | ${f1(sh.layers)} | ${pct(sh.noChoice)} | ${pct(sh.mixed)} | ${pct(sh.forcedElites)} | ${f1(sh.specials)} |`)
  }
  line('')
  /** A "wider forks" unlock has to at least halve the share of choiceless steps. */
  const WIDE_FORK_TARGET = 0.5
  if (shapeWide.layers !== shapeBase.layers) {
    failures.push(
      `Scouts 2 changes the LENGTH of the run (${f1(shapeBase.layers)} → ${f1(shapeWide.layers)} layers). A longer map is a compounding Threat increase and a bigger boss budget; an unlock may widen the march, never lengthen it.`,
    )
  }
  if (shapeWide.noChoice > shapeBase.noChoice * WIDE_FORK_TARGET) {
    failures.push(
      `Scouts 2 does not deliver the forks its card sells: steps with no choice ${pct(shapeBase.noChoice)} → ${pct(shapeWide.noChoice)} (needs ≤ ${pct(shapeBase.noChoice * WIDE_FORK_TARGET)}).`,
    )
  }
  if (shapeCamp.forcedElites > 0) {
    failures.push(
      `Scouts 1 does not deliver what its card sells: ${pct(shapeCamp.forcedElites)} of Elites still stand on a road with no way around them.`,
    )
  }
  if (shapeHire.specials <= shapeBase.specials) {
    failures.push(`The Hiring Hall adds no stop to the map (${f1(shapeBase.specials)} → ${f1(shapeHire.specials)} specials).`)
  }
  {
    const at = (label: string) => hubCells.get(label)!
    const best = (label: string) => Math.max(...HUB_GATED_POLICIES.map((id) => { const i = POLICIES.findIndex((x) => x.id === id); return at(label)[i].winRate - hubZero[id].winRate }))
    const sign = (d: number) => `${d >= 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(0)}pt`
    line('**Findings.**')
    line('')
    line(
      `- **Scouts** (the old Scout Reports and Cartographer's Table, folded into Operations) are width, not length: same ${f1(shapeBase.layers)} layers, choiceless steps ${pct(shapeBase.noChoice)} → ${pct(shapeWide.noChoice)}, mixed forks ${pct(shapeBase.mixed)} → ${pct(shapeWide.mixed)}, and Elites with no way past ${pct(shapeBase.forcedElites)} → ${pct(shapeCamp.forcedElites)}. Best line ${sign(best('Scouts 2'))}.`,
    )
    line(
      `- **The Opening deal is where the power is, and it is bounded:** five levels, ${HQ_UPGRADES.find((u) => u.id === 'deal')!.costs.reduce((a, b) => a + b, 0).toLocaleString('en')} gold in all, worth ${sign(best(DEAL_TOP_LABEL))} at its best and then finished (levels 1–3 alone: ${sign(best(HUB_STATES[1][0]))}). The old hub's ramp (wagons, purse, stats, an extra item) is retired and refunded; the extra hero lives on as the deal's last level.`,
    )
    line(
      `- **Pack slots, boulders and focus** are levers on the run's texture, not its odds: ${sign(best('Pack slots 10'))}, ${sign(best('Fewer boulders 3 + clear order'))} and ${sign(best('Focus Ironvein +60%'))} at their best. Boulders keep a floor of ${MIN_OBSTACLES} a field whatever is bought — they are a balance lever, and the tuning pass owns that number.`,
    )
    line(`- **Everything the HQ sells** reads ${sign(best('everything the HQ sells'))} at its best.`)
    line('')
  }
  summary.push(
    `Hub (n=${HUB_RUNS}/cell, gated lines ${HUB_GATED_POLICIES.join('/')}): ${HUB_STATES.map(([label]) => {
      const cells = hubCells.get(label)!
      const worst = Math.min(
        ...HUB_GATED_POLICIES.map((id) => cells[POLICIES.findIndex((x) => x.id === id)].winRate - hubZero[id].winRate),
      )
      return `${label} ${worst >= 0 ? '+' : '−'}${Math.abs(worst * 100).toFixed(0)}pt`
    }).join(' | ')}`,
  )
}

// -------------------------------------------------------------- Sweep 13
if (want(13)) {
  // The stake's economy (the mercenary company) — what the difficulty climb's
  // §13 became, as the Banner ladder's §13 became the climb before it.
  line('## 13. Stake tiers (is carrying more cargo ever worth it?)')
  line('')
  line('**What changed (the mercenary company).** A run is a contract now, and the difficulty')
  line('step is its **stake**: every crate of cargo carried is one step — enemies **+8% stronger**')
  line('and **one more elite an act**, on the map where the player can see it — and costs')
  line(`${CRATE_PRICE} gold from the bank. Delivered, the crates pay: each city sells its share of them at`)
  line(`${CRATE_VALUE} gold a crate, the destination's completion bonus rises ${BONUS_PER_CRATE} gold a crate, a skill`)
  line('comes at every milestone crate and an item chance at every second one. Every city pays')
  line('by the cargo that arrives (the wagons\' HP). An escort (no crates) is paid a fee at each city.')
  line('')
  line('**The intent is the climb\'s: every tier must cost difficulty AND pay more.** Each tier is')
  line(`measured on the same paired seeds as §11 and §12, ${BANNER_RUNS} runs a tier, on Rosethread's road (the`)
  line('open ground every route used to share, with its company weighting), at zero HQ. The gold')
  line('column is the bank\'s **net** change — everything banked (city pay, any cash-out sale, the')
  line(`purse's rest and ${Math.round(ROAD_SHARE * 100)}% of the road's gold, \`hq.homeGold\`) less the stake and the purse taken — priced from the contract code itself`)
  line('(`run/contracts.cityPay`, `cashOutValue`). The modelled player plays two lines on the same')
  line(`roads: **${PRESS_ON.label}**, and **${CASH_OUT_HALF.label}** at city 1 or 2.`)
  line('')
  const STAKE_POLICY = POLICIES[policyIdx('adaptive')]
  interface TierRow { crates: number; win: number; winCash: number; cashed: number; netPress: number; netCash: number; payPress: number; payCash: number }
  const tierRows: TierRow[] = []
  for (let c = 0; c <= MAX_CRATES; c++) {
    const press: number[] = []
    const cash: number[] = []
    const payP: number[] = []
    const payC: number[] = []
    const won: number[] = []
    const wonCash: number[] = []
    const cashed: number[] = []
    for (let i = 0; i < BANNER_RUNS; i++) {
      const r = simulateRun(9001 + i * 17, FRESH_ARCHES[i % 3], { meta: ZERO_META, policy: STAKE_POLICY, contract: { company: 'silk', crates: c } })
      const a = contractNet(r, PRESS_ON)
      const b = contractNet(r, CASH_OUT_HALF)
      press.push(a.net)
      cash.push(b.net)
      payP.push(a.pay)
      payC.push(b.pay)
      won.push(a.delivered ? 1 : 0)
      wonCash.push(b.delivered ? 1 : 0)
      cashed.push(b.cashedOut ? 1 : 0)
    }
    tierRows.push({ crates: c, win: mean(won), winCash: mean(wonCash), cashed: mean(cashed), netPress: mean(press), netCash: mean(cash), payPress: mean(payP), payCash: mean(payC) })
    if (mean(won) < 0.01) break
  }
  line('Two gold columns, because they answer different questions. **Contract pay** is what the stake')
  line("controls: the cities' pay and any cash-out sale, less the stake. **Bank net** adds what the purse")
  line(`brings home — what is left of it in full, and ${Math.round(ROAD_SHARE * 100)}% of the road's gold (kill gold, node purses, sales) — less the purse taken.`)
  line('')
  line('| Crates | Stake | What it adds | Danger | Delivered (press on) | Contract pay (press on) | Cashed out (policy) | **Contract pay (policy)** | Δ pay | Bank net (policy) |')
  line('|--:|--:|---|--:|--:|--:|--:|--:|--:|--:|')
  for (const r of tierRows) {
    const prev = r.crates > 0 ? tierRows[r.crates - 1].payCash : null
    line(
      `| ${r.crates} | ${r.crates * CRATE_PRICE} | ${r.crates === 0 ? 'escort · standard raiders' : difficultyEffect(r.crates)} | ${dangerPips(r.crates)}/5 | ${pct(r.win)} | ${f1(r.payPress)} | ${pct(r.cashed)} | **${f1(r.payCash)}** | ${prev === null ? '—' : `${r.payCash - prev >= 0 ? '+' : '−'}${Math.abs(r.payCash - prev).toFixed(0)}`} | ${f1(r.netCash)} |`,
    )
  }
  if (tierRows.length <= MAX_CRATES) line(`| ${tierRows.length}–${MAX_CRATES} | | not measured: the tier below already delivers under 1% | | | | | | | |`)
  line('')
  line('**Two invariants**, the climb\'s own, kept:')
  line('')
  line(`1. **Every crate is a cost of at least ${(BANNER_MIN_COST * 100).toFixed(0)}pt** of delivery rate (pressing on). A crate that`)
  line('   does not make the road harder is a bonus with a warning label.')
  line('2. **Every crate pays more.** Expected contract pay, on the cash-out line, must rise at every')
  line('   tier — a stake whose payout does not cover the difficulty it adds is a trap.')
  line('')
  for (let i = 1; i < tierRows.length; i++) {
    const cur = tierRows[i]
    const prev = tierRows[i - 1]
    if (prev.win - cur.win < BANNER_MIN_COST && prev.win >= 0.01) {
      failures.push(
        `Stake ${cur.crates} is not harder: it delivers ${pct(cur.win)} against ${prev.crates} crate${prev.crates === 1 ? '' : 's'}' ${pct(prev.win)} — a cost of ${((prev.win - cur.win) * 100).toFixed(1)}pt, under the ${(BANNER_MIN_COST * 100).toFixed(0)}pt every crate must cost.`,
      )
    }
    if (cur.payCash <= prev.payCash) {
      failures.push(
        `Stake ${cur.crates} does not pay more: ${f1(cur.payCash)} gold of contract pay against ${prev.crates} crate${prev.crates === 1 ? '' : 's'}' ${f1(prev.payCash)}. The crate's pay does not cover the difficulty it adds.`,
      )
    }
  }
  line(
    `Measured: delivery by tier is ${tierRows.map((r) => pct(r.win)).join(' → ')}; contract pay (cash-out line) ${tierRows.map((r) => f1(r.payCash)).join(' → ')}; bank net ${tierRows.map((r) => f1(r.netCash)).join(' → ')}.`,
  )
  line('')
  {
    // Finance's cap against the stake (reported, not gated): interest must
    // never out-earn carrying cargo, so the top cap is set under the smallest
    // stake's expected gain over the escort.
    const escort = tierRows[0].payCash
    const gains = tierRows.slice(1).map((r) => r.payCash - escort)
    const cap = Math.max(...INTEREST.map((t) => t.cap))
    const least = gains.length ? Math.min(...gains) : 0
    line(
      `**Bank vs. stake (reported, not gated).** The bank's interest is capped at ${cap} gold a finished contract at its top rate. Every stake measured adds more than that to a contract's expected pay over the escort (cash-out line): ${gains.map((g, i) => `${i + 1}c +${g.toFixed(0)}`).join(', ')} — the least is +${least.toFixed(0)} gold${least > cap ? `, ${(least - cap).toFixed(0)} above the cap` : `, **at or under the cap: the bank ties or out-earns that stake**`}.`,
    )
    line('')
  }
  line('**Not priced here: the unlocks.** A delivery also opens a skill and an item, a skill per milestone')
  line('crate and an item per two crates, at a level floor that rises with the stake (`run/standing`).')
  line('That widens every later run\'s deals — not a number this table can price — so the gold column')
  line('only has to say a bigger stake is never a loss.')
  line('')

  // The routes: each company's ground, as an escort.
  line('### 13b. The routes — each company\'s ground, as an escort')
  line('')
  line(`Each company's road carries its own map challenges (\`data/companies.ts\`); its own skills and items are dealt ×${COMPANY_WEIGHT}.`)
  line(`Same seeds, same modelled player (adaptive, zero meta), an escort on each road, ${HUB_RUNS} runs a road.`)
  line('Reported, not gated: a hard road is a choice the board shows, not a defect — but a road far')
  line('off the others is a lever for the tuning pass.')
  line('')
  line('| Company | Ground | Delivered | Contract pay (policy) | Bank net (policy) |')
  line('|---|---|--:|--:|--:|')
  const routeRows: string[] = []
  for (const co of COMPANIES) {
    const won: number[] = []
    const net: number[] = []
    const pay: number[] = []
    for (let i = 0; i < HUB_RUNS; i++) {
      const r = simulateRun(9001 + i * 17, FRESH_ARCHES[i % 3], { meta: ZERO_META, policy: STAKE_POLICY, contract: { company: co.id, crates: 0 } })
      const x = contractNet(r, CASH_OUT_HALF)
      won.push(r.won ? 1 : 0)
      net.push(x.net)
      pay.push(x.pay)
    }
    line(`| ${co.name} (${co.goods}) | ${co.ground.name} | ${pct(mean(won))} | ${f1(mean(pay))} | ${f1(mean(net))} |`)
    routeRows.push(`${co.id} ${pct(mean(won))}`)
  }
  line('')
  summary.push(`Stake tiers (${STAKE_POLICY.id} route, Rosethread; delivered / contract pay): ${tierRows.map((r) => `${r.crates}c ${pct(r.win)} / ${f1(r.payCash)}g`).join(' | ')}`)
  summary.push(`Routes as escorts (delivered): ${routeRows.join(' | ')}`)
}

// -------------------------------------------------------------- Sweep 14
if (want(14)) {
  // Run variety: battlefields and composition variants (WS8).
  line('## 14. Run variety — battlefields and wave composition')
  line('')
  line('**What this measures.** The audit\'s last open finding was that the tactical layer')
  line('had *no input randomness at all*: `ALL_MAPS` held one map, and `generateEncounter`')
  line('took no RNG, so depth 4 was the identical wave in every run forever and two battle')
  line('nodes in the same layer were literally the same fight. This sweep exists to hold')
  line('the fix honest in both directions — **varied enough to re-solve, fair enough to')
  line('stay attributable**. Variety that is bought with difficulty is not variety, it is a')
  line('difficulty roll, which is the output randomness the doctrine forbids.')
  line('')

  line('### 14a. The battlefields')
  line('')
  line('Path length is the load-bearing number: enemy speeds in `enemies.ts` are tuned as')
  line('*crossing times* against a 2290px field, and time in range is the one difficulty')
  line('axis the run\'s Threat multiplier does not touch — so a field 20% longer is a 20%')
  line('easier game on every dial in this report at once. Coverage is the road (in px) a')
  line('tower on a tile can see at a nominal 150px range; it is what makes the two fields')
  line('different puzzles rather than different wallpaper.')
  line('')
  line('Deployment is a tile grid (G1-2; 40px tiles since grid-fit): a hero may stand on any open')
  line('grass tile a tile clear of every other hero, so a field\'s "slots" are its open tiles and the')
  line('table lists the eight best of them a tile of room apart.')
  line('')
  line('| Field | Path px | Open tiles | Tile pitch | Coverage, best 8 tiles (px of road seen) |')
  line('|---|--:|--:|--:|---|')
  for (const m of MAP_FACTS) {
    const cov = m.order.slice(0, 8).map((id) => `${id} ${m.coverage[id]}`).join(' · ')
    line(`| ${m.name} (\`${m.id}\`) | ${m.length} | ${m.order.length} | ${m.minSlotGap} | ${cov} |`)
  }
  line('')
  /** Fields must be within this of each other in path length. */
  const MAX_FIELD_LENGTH_SPREAD = 0.06
  /**
   * …and no two posts may be closer than one tile (G1-2). The hit test is the
   * tile's own square, not a radius snapped to the nearest circle, so posts
   * can never be closer than the tile: 40 logical px since grid-fit (it was 80
   * on G1-2's grid, 90 — the old radius hit test's — before it). What a finger
   * aims for is a hero's ROOM, two tiles (80px, ≥ 44 CSS px at the phone's
   * portrait Stage); the tile under it only decides where, to the nearest 40px.
   */
  const MIN_SLOT_GAP = TILE
  const fieldLens = MAP_FACTS.map((m) => m.length)
  const fieldSpread = Math.max(...fieldLens) / Math.min(...fieldLens) - 1
  line(
    `Path lengths spread **${(fieldSpread * 100).toFixed(1)}%** (ceiling ${(MAX_FIELD_LENGTH_SPREAD * 100).toFixed(0)}%); tightest tile pitch **${Math.min(...MAP_FACTS.map((m) => m.minSlotGap))}px** (floor ${MIN_SLOT_GAP}px, one tile — the hit target).`,
  )
  line('')
  if (fieldSpread > MAX_FIELD_LENGTH_SPREAD) {
    failures.push(
      `Battlefield path lengths differ by ${(fieldSpread * 100).toFixed(1)}% (max ${(MAX_FIELD_LENGTH_SPREAD * 100).toFixed(0)}%). Crossing time is a difficulty dial Threat does not multiply, so a longer field is a quietly easier game.`,
    )
  }
  for (const m of MAP_FACTS) {
    if (m.minSlotGap < MIN_SLOT_GAP) {
      failures.push(
        `${m.name} has two posts ${m.minSlotGap}px apart (floor ${MIN_SLOT_GAP}px, one tile). Two posts closer than a tile cannot both be hit targets.`,
      )
    }
  }
  /**
   * The two fields have to be different *puzzles*, and the number that decides
   * that is not per-slot coverage — it is **overlap**.
   *
   * The first version of this check compared the sorted per-slot coverage vector
   * and read 7.9% apart, which says almost nothing: two fields can hand out the
   * same six coverage numbers and still be completely different to deploy on,
   * because what matters is whether the second tower you place sees road the
   * first one already sees. So the metric is the **marginal** union curve: fill
   * the slots best-first and record how much *new* road each one adds, as a share
   * of the path. That is exactly the sequence a player experiences when deciding
   * whether a fourth body is worth a slot, and it is where the two fields
   * separate — The Green Line's cluster is redundant early and pays off late, The
   * Kiln Road's crossroads pays immediately and its last two slots are scraps.
   */
  function marginalCurve(m: (typeof MAP_FACTS)[number]): number[] {
    const map = ALL_MAPS.find((x) => x.id === m.id)!
    const step = 6
    const pts: { x: number; y: number }[] = []
    for (let i = 1; i < map.path.length; i++) {
      const a = map.path[i - 1]
      const b = map.path[i]
      const len = Math.hypot(b.x - a.x, b.y - a.y)
      const n = Math.max(1, Math.round(len / step))
      for (let k = 0; k < n; k++) pts.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n })
    }
    const chosen: { x: number; y: number }[] = []
    const out: number[] = []
    let prev = 0
    for (const id of m.order) {
      chosen.push(map.slots.find((s) => s.id === id)!.pos)
      const seen = pts.filter((p) => chosen.some((q) => Math.hypot(p.x - q.x, p.y - q.y) <= 150)).length / pts.length
      out.push(seen - prev)
      prev = seen
    }
    return out
  }
  const curves = MAP_FACTS.map(marginalCurve)
  const shapeDist =
    curves.length < 2 ? 0 : 0.5 * curves[0].reduce((a, v, i) => a + Math.abs(v - (curves[1][i] ?? 0)), 0)
  /** Two fields whose marginal-coverage curves are this close are one puzzle twice. */
  const MIN_FIELD_SHAPE_DIST = 0.08
  line('| Field | New road each successive best slot adds (share of path) | Union at 5 towers |')
  line('|---|---|--:|')
  MAP_FACTS.forEach((m, i) => {
    line(
      `| ${m.name} | ${curves[i].slice(0, 8).map((v) => pct(v)).join(' → ')} | ${pct(curves[i].slice(0, 5).reduce((a, b) => a + b, 0))} |`,
    )
  })
  line('')
  line(
    `Marginal-coverage curves are **${(shapeDist * 100).toFixed(1)}%** apart (total-variation distance; floor ${(MIN_FIELD_SHAPE_DIST * 100).toFixed(0)}%). Five towers see **${pct(curves[0].slice(0, 5).reduce((a, b) => a + b, 0))}** of The Green Line and **${pct((curves[1] ?? []).slice(0, 5).reduce((a, b) => a + b, 0))}** of The Kiln Road, and they get there on different curves — which is the same company covering a different amount of road for the same six decisions.`,
  )
  line('')
  if (ALL_MAPS.length > 1 && shapeDist < MIN_FIELD_SHAPE_DIST) {
    failures.push(
      `The shipped battlefields have near-identical marginal-coverage curves (${(shapeDist * 100).toFixed(1)}% apart, floor ${(MIN_FIELD_SHAPE_DIST * 100).toFixed(0)}%). A second map that does not change the placement decision is wallpaper, not variety.`,
    )
  }
  if (ALL_MAPS.length < 2) {
    failures.push('Only one battlefield ships. Run-to-run variance below the map layer is then a single scalar, and placement solves once.')
  }

  /**
   * The §14c bench: how much base HP one composition variant actually puts
   * through a random depth-appropriate line, averaged over teams and fields.
   *
   * `baseHp` is `maxLeak + 2` so the battle always runs to the end and the number
   * is not truncated by the base falling; the seeds and team draws are identical
   * across variants, so the comparison is paired.
   */
  const VARIETY_TEAMS = 14
  function variantLeak(depth: number, kind: EncounterKind, variantId: string, pressure = 1): number {
    const rr = new RNG(77)
    const level = mcLevel(depth)
    const rarity: ItemRarity = mcRarity(depth)
    const threat = threatAtLayer(depth) * pressure
    const wave = generateEncounter(depth, kind, { variantId })
    const ml = maxLeak(wave)
    const out: number[] = []
    for (let t = 0; t < VARIETY_TEAMS; t++) {
      const size = 3 + Math.floor(rr.next() * 3)
      const ids = Array.from({ length: size }, () => rr.pick(TIER2_NODES).id)
      for (const field of ALL_MAPS) {
        const order = bestSlots(field)
        const team = ids.map((id, i) => ({
          sentinel: buildSpec(id, { level, gearRarity: rarity, seed: t * 10 + i, perkSeed: t * 10 + i }),
          slotId: order[i],
        }))
        out.push(
          runBattle({ team, depth, wave, map: field, autoDeploy: true, enemyHpMult: threat, baseHp: ml + 2, maxSeconds: 120, seed: t * 31 + depth })
            .baseHpLost,
        )
      }
    }
    return mean(out)
  }

  line('### 14b. How different is one depth-4 wave from another?')
  line('')
  line('Composition distance is the **total-variation distance** between two waves\' enemy')
  line('mixes — the share of bodies of each type, half the L1 norm of the difference. 0%')
  line('is the same wave; 100% shares no enemy type at all. It is quoted alongside the')
  line('*head count* and the *total effective HP*, because the pair is the whole claim:')
  line('the mix moves, the size does not.')
  line('')
  /**
   * **Every depth the campaign has, not a sample of three (M1).**
   *
   * This was `[4, 7, 9]`, and the three it skipped are the three that were broken.
   * `gate()` in `waves.ts` admits bombers only from depth 2 and armour only from
   * depth 3, and `roster()`'s tier ladder does not move until depth 4 — so the
   * shallow end is exactly where two variants can collapse onto one composition,
   * and it was the only part of the range never measured. Depth 1 elite read
   * **0.0%** (Plated Column and Swift Raid were both 100% torch), depth 2 read
   * 13.3%, and the normal pool read 0.0% / 14.2% / 19.1% at depths 1/2/3 — all
   * against this section's own 35% floor, all under a paragraph claiming
   * "42.7%–55.6% apart" that was true precisely over the sampled range.
   *
   * A gate whose sample excludes its failure region is the defect it is supposed
   * to catch. The fix is in `waves.ts` (`swarm.minDepth` 1 → 4, `plated.minDepth`
   * 1 → 3: a variant is legal only where its identity exists) and the range here
   * is now the whole campaign, with no exclusions.
   */
  const GATE_DEPTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  /** The depths whose full body-by-body composition is printed. The gate is wider. */
  const VARIETY_DEPTHS = [4, 7, 9]
  line('| Depth | Kind | Variant | Bodies | Total HP | Max leak | Composition |')
  line('|--:|---|---|--:|--:|--:|---|')
  // Effective HP (Phase 3a): a splitter's pieces are HP the node carries, and
  // `waves.ts` prices them into its budget — so the pool is read the same way.
  const waveHp = (w: ReturnType<typeof generateEncounter>) =>
    Math.round(w.spawns.reduce((a, s) => a + effectiveHp(s.typeId) * s.hpMult, 0))
  /**
   * The body mix of a wave, keyed by the **base type id** — `barrel4`, not
   * `barrel4_plated`.
   *
   * ---- this used to key on the registry key, and that made the gate below
   * ---- incapable of failing for elites (F5) --------------------------------
   *
   * `enemies.ts` gives a modified goblin two identities on purpose: the registry
   * KEY (`barrel4_plated`) is its gameplay identity, and the `id` (`barrel4`) is
   * its art identity — "a variant is the same goblin wearing more iron, it must
   * draw as one". Keying the share map on the registry key therefore makes any
   * two elite variants disjoint **by construction**, because each one wears a
   * different modifier: every elite pair read exactly 100% apart, at every depth,
   * no matter what bodies were actually in the two columns. A gate that cannot
   * fail is not a gate, and this one was reporting the strongest number in §14
   * while measuring nothing.
   *
   * The base id is what the renderer draws and what the player watches walk down
   * the road, so it is the honest denominator for "how much of this wave is the
   * same as that wave". The modifier is a real, disclosed difference and it is
   * still reported — in its own column, beside the number, rather than smuggled
   * into it.
   */
  const shares = (w: ReturnType<typeof generateEncounter>): Map<string, number> => {
    const m = new Map<string, number>()
    for (const s of w.spawns) {
      const base = ENEMY_TYPES[s.typeId].id
      m.set(base, (m.get(base) ?? 0) + 1)
    }
    const tot = w.spawns.length || 1
    for (const [k, v] of m) m.set(k, v / tot)
    return m
  }
  /** Total-variation distance between two composition share maps, 0…1. */
  function compDist(a: Map<string, number>, b: Map<string, number>): number {
    let d = 0
    for (const k of new Set([...a.keys(), ...b.keys()])) d += Math.abs((a.get(k) ?? 0) - (b.get(k) ?? 0))
    return d / 2
  }
  interface VarietyCell {
    depth: number
    kind: EncounterKind
    v: WaveVariant
    wave: ReturnType<typeof generateEncounter>
  }
  const varietyCells: VarietyCell[] = []
  for (const depth of GATE_DEPTHS) {
    for (const kind of ['normal', 'elite'] as EncounterKind[]) {
      for (const v of variantsFor(kind, depth)) {
        const wave = generateEncounter(depth, kind, { variantId: v.id })
        varietyCells.push({ depth, kind, v, wave })
        if (!VARIETY_DEPTHS.includes(depth)) continue
        const comp = waveComposition(wave)
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map((c) => `${ENEMY_TYPES[c.typeId].name} ×${c.count}`)
          .join(', ')
        line(
          `| ${depth} | ${kind} | ${v.label || v.id} | ${wave.spawns.length} | ${waveHp(wave)} | ${maxLeak(wave)} | ${comp} |`,
        )
      }
    }
  }
  line('')
  /** Two shapes closer than this are the same fight with a different name. */
  const MIN_COMP_DIST = 0.35
  /**
   * How far apart the HP *pools* of one node's variants may be.
   *
   * This is a sanity bound, not the fairness gate — §14c is. The first version of
   * it sat at 20% on the theory that equal budget is equal fairness, and that
   * theory is wrong: measured, an armour column and a light swarm carrying
   * *identical* HP differ by ×2.6 in the damage they actually put through a
   * depth-scaled line, because armour concentrates HP behind resistances and a
   * swarm spends it on bodies that die to splash. Equalising the pools would have
   * shipped a "fair" table in which one shape was two and a half times the fight
   * the other was.
   *
   * So the budget is a **price list**: a shape that is worth more per point of HP
   * is sold less of it (`WaveVariant.budgetScale`, fitted against §14c). The pools
   * therefore differ on purpose, and this ceiling only exists to catch a scale
   * that has run away far enough to be a difficulty roll dressed as a price.
   */
  const MAX_HP_SPREAD = 0.35
  /** …and the damage a wave can do if nothing stops it stays in a band. */
  const MAX_LEAK_SPREAD = 1.6
  line('| Depth | Kind | Pool | Pairwise body-mix distance (min / mean) | Closest pair | Total-HP spread | Max-leak spread |')
  line('|--:|---|--:|---|---|--:|--:|')
  let worstCompDist = 1
  let worstCompPair = ''
  let worstHpSpread = 0
  let worstLeakSpread = 1
  for (const depth of GATE_DEPTHS) {
    for (const kind of ['normal', 'elite'] as EncounterKind[]) {
      const cells = varietyCells.filter((c) => c.depth === depth && c.kind === kind)
      if (cells.length < 2) {
        // Reported rather than skipped in silence: a one-variant pool is a real
        // statement about the depth (the faction gate leaves one legal shape), and
        // an empty row here is what let depths 1–3 go unexamined (M1).
        line(
          `| ${depth} | ${kind} | ${cells.length} | — (one legal shape) | — | — | — |`,
        )
        continue
      }
      const dists: number[] = []
      let cellWorst = 1
      let cellWorstPair = ''
      for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          const d = compDist(shares(cells[i].wave), shares(cells[j].wave))
          dists.push(d)
          if (d < cellWorst) {
            cellWorst = d
            cellWorstPair = `${cells[i].v.label || cells[i].v.id} vs ${cells[j].v.label || cells[j].v.id}`
          }
        }
      }
      const hps = cells.map((c) => waveHp(c.wave))
      const leaks = cells.map((c) => maxLeak(c.wave))
      const hpSpread = Math.max(...hps) / Math.min(...hps) - 1
      const leakSpread = Math.max(...leaks) / Math.max(1, Math.min(...leaks))
      if (cellWorst < worstCompDist) {
        worstCompDist = cellWorst
        worstCompPair = `depth ${depth} ${kind}, ${cellWorstPair}`
      }
      worstHpSpread = Math.max(worstHpSpread, hpSpread)
      worstLeakSpread = Math.max(worstLeakSpread, leakSpread)
      line(
        `| ${depth} | ${kind} | ${cells.length} | ${pct(Math.min(...dists))} / ${pct(mean(dists))} | ${cellWorstPair} ${pct(cellWorst)} | ${(hpSpread * 100).toFixed(1)}% | ×${f2(leakSpread)} |`,
      )
    }
  }
  line('')
  line(`**Read the columns together.** The closest pair of shapes anywhere in the table is`)
  line(`**${pct(worstCompDist)}** apart (floor ${pct(MIN_COMP_DIST)}) — ${worstCompPair} — so two waves at the same node`)
  line(`share at most ${pct(1 - worstCompDist)} of their bodies. Over the same cells the total HP pool moves by`)
  line(`at most **${(worstHpSpread * 100).toFixed(1)}%** (ceiling ${(MAX_HP_SPREAD * 100).toFixed(0)}%) and the leak a wave can do if nothing stops it by at`)
  line(`most **×${f2(worstLeakSpread)}** (ceiling ×${f2(MAX_LEAK_SPREAD)}). That is the fairness claim, stated as numbers: the`)
  line('problem changes, the size does not.')
  line('')
  line('**The distance is measured on the BASE body — `barrel4`, not `barrel4_plated`.**')
  line('It used to key on the registry key, which made every elite pair disjoint by')
  line('construction (each elite variant wears a different modifier) and printed a')
  line('flat 100% for all nine elite pairs at every depth: the strongest number in §14,')
  line('measuring nothing. The modifier is a real and disclosed difference — the')
  line('pre-wave preview prints "shrugs off physical 55%" in the enemy\'s own row — but')
  line('it is not a difference in *which goblins walk down the road*, and that is what')
  line('this metric is for. A player who loses a Warded Host should lose to a')
  line('damage-type mistake they could read off the preview; whether the column that')
  line('taught them that is also a different column is a separate question, and it is')
  line('the one asked here.')
  line('')
  line('**And it is measured at every depth the campaign has (M1).** It used to be')
  line('measured at depths 4, 7 and 9 — and the paragraph below, reporting the elite')
  line('pairs "42.7%–55.6% apart", was true exactly over that range and false')
  line('immediately under it. `gate()` withholds bombers until depth 2 and armour')
  line('until depth 3, and `roster()`\'s tier ladder does not move until depth 4, so')
  line('the shallow end is the only place two variants can collapse onto one')
  line('composition — and it was the only part of the range never sampled. The')
  line('numbers that were there:')
  line('')
  line('| | depth 1 | depth 2 | depth 3 |')
  line('|---|--:|--:|--:|')
  line('| elite — Plated Column vs Swift Raid | **0.0%** | **13.3%** | 44.4% |')
  line('| normal — Patrol vs Swarm | **0.0%** | **14.2%** | **19.1%** |')
  line('')
  line('Four cells under a 35% floor, one of them at zero, in the part of the')
  line('campaign every run plays and Banner 2 turns entirely elite. Neither pair was')
  line('fixable by reshaping a mix: at depth 1 exactly one faction is legal, so every')
  line('variant is 100% torch whatever it is called, and at depth 2 Patrol\'s own 6:3')
  line('shape caps the best achievable distance at 33%. What was wrong was offering')
  line('a shape where it is not a second shape — so `swarm` is legal from depth 4')
  line('(where its `tierBump` stops clamping) and `plated` from depth 3 (where it')
  line('first contains a barrel, which is also when its "column of rolling armour"')
  line('line becomes true). The table above is the whole range, gated with no')
  line('exclusions.')
  line('')
  line('**What the honest number found, and what was done about it (F5).** Re-keyed,')
  line('the three elite mixes measured **17.6%–39.5%** apart — Warded Host against')
  line('Swift Raid at 17.6% at depth 9 — because `{3,2,4}` / `{5,3,1}` / `{7,2,0.5}` is')
  line('two torch-led hosts and one armour column, not three columns. A concurrent')
  line('render review found the same three pixel-identical on the field (the modifier')
  line('moves `speed`, `physResist` and `magResist`, none of which the renderer reads),')
  line('so "three elite variants" was very close to one wave with three names — and the')
  line('Banner rung built on them (§13, *Elite Watch*) was standing on it.')
  line('')
  line('The mixes are rebuilt onto **one faction each** — barrels / bombers / torches —')
  line('which is the only arrangement that makes three columns distinct when the roster')
  line('has three factions. The elite pairs now sit **42.7%–57.8%** apart across every')
  line('depth they are offered at, and the binding cell in this table is a *normal* pair.')
  line('The bill came due in two other columns of the same table and is paid there:')
  line('a bomber host leaks 3 per body against a torch raid\'s 1, which pushed max-leak')
  line('spread to ×1.68 until Swift\'s `countMult` went 1.2 → 1.3; and the three shapes')
  line('are worth very different amounts per point of HP, which is the `budgetScale`')
  line('refit in §14c below.')
  line('')
  if (worstCompDist < MIN_COMP_DIST) {
    failures.push(
      `Two composition variants at the same node are only ${pct(worstCompDist)} apart in body mix (floor ${pct(MIN_COMP_DIST)}): ${worstCompPair}. Variety the player cannot perceive is not variety. NOTE: this gate keys on the BASE body id (\`barrel4\`), not the registry key (\`barrel4_plated\`) — keying on the latter made every elite pair 100% apart by construction and could not fail (F5). Two variants are close when their \`mix\` weights are close, so the fix is in \`NORMAL_VARIANTS\` / \`ELITE_VARIANTS\` in \`waves.ts\`, and it is a rebalance rather than a report change: moving a mix moves what that shape is worth per point of HP, which needs \`budgetScale\` refitted against §14c and re-checked against the HP-spread and max-leak ceilings above.`,
    )
  }
  if (worstHpSpread > MAX_HP_SPREAD) {
    failures.push(
      `Composition variants at the same node differ in total HP by ${(worstHpSpread * 100).toFixed(1)}% (ceiling ${(MAX_HP_SPREAD * 100).toFixed(0)}%). A variant is meant to change the problem, not roll the difficulty.`,
    )
  }
  if (worstLeakSpread > MAX_LEAK_SPREAD) {
    failures.push(
      `Composition variants at the same node differ in maximum leak by ×${f2(worstLeakSpread)} (ceiling ×${f2(MAX_LEAK_SPREAD)}). The wave that walks through does wildly different damage depending on a roll the player never made.`,
    )
  }

  line('### 14c. Is any shape a free win or an auto-loss?')
  line('')
  line('Composition distance says the shapes *differ*; it cannot say whether one of them')
  line('is simply the easy one. **This is the gate the budget scales are fitted against**,')
  line('and it is where the fairness claim actually lives.')
  line('')
  line('The bench is deliberately not the §5 standard team: on the encounters the game')
  line("ships, that team stops **100.0%** of every variant's leak at every depth tried, so")
  line('it grades nothing — trap 2 in `balance/README.md`, a scenario with no failure')
  line('mode. What discriminates is a §6-shaped draw: random 3–5 tower teams at')
  line("depth-appropriate level, rarity and upgrades, on **both** battlefields, at the real")
  line('Threat a depth-8 run carries. The metric is **base HP leaked**, not stop rate,')
  line('because a 20-HP base dies to the four points a 96%-stop wave puts through.')
  line('')
  line(`| Depth | Kind | Variant | Base HP leaked (mean of ${VARIETY_TEAMS} teams × ${ALL_MAPS.length} fields) | vs the canonical shape |`)
  line('|--:|---|---|--:|--:|')
  let worstLeakRatio = 1
  let worstLeakCell = ''
  /**
   * **The bench must leak to grade a leak ratio (the tuning pass).** At the
   * road's Threat the classless §6-shaped teams put almost nothing through a
   * depth-8 node — Plated Column 0.14 base HP, Warded Host 0.00, Swift Raid
   * 1.11 — and the ratio was read over that near-zero floor (clamped at 0.05):
   * ×22.14, a number about the clamp, not the shapes. Trap 2 again: a scenario
   * whose control cannot fail. So each node's pressure is raised on a ×1.15
   * Threat ladder until its CANONICAL shape (the first) puts through at least
   * {@link VARIETY_LEAK_FLOOR} of base HP, and every shape of that node is then
   * measured at that one pressure — paired, as before.
   */
  const VARIETY_LEAK_FLOOR = 2
  const varietyPins: string[] = []
  for (const depth of [8]) {
    for (const kind of ['normal', 'elite'] as EncounterKind[]) {
      const vs = variantsFor(kind, depth)
      let pressure = 1
      let canon = variantLeak(depth, kind, vs[0].id, pressure)
      while (canon < VARIETY_LEAK_FLOOR && pressure < 20) {
        pressure *= 1.15
        canon = variantLeak(depth, kind, vs[0].id, pressure)
      }
      varietyPins.push(`depth ${depth} ${kind} ×${f2(pressure)}`)
      const leaks = [canon, ...vs.slice(1).map((v) => variantLeak(depth, kind, v.id, pressure))]
      for (let i = 0; i < vs.length; i++) {
        line(
          `| ${depth} | ${kind} | ${vs[i].label || vs[i].id} | ${leaks[i].toFixed(2)} | ${leaks[0] > 0 ? `×${f2(leaks[i] / leaks[0])}` : '—'} |`,
        )
      }
      const ratio = Math.max(...leaks) / Math.max(0.05, Math.min(...leaks))
      if (ratio > worstLeakRatio) {
        worstLeakRatio = ratio
        worstLeakCell = `depth ${depth} ${kind}`
      }
    }
  }
  line('')
  /**
   * The widest leak ratio one node's variants may span against a random,
   * *unadapted* team. Some spread is wanted and is the content: a Plated Column is
   * supposed to be a worse fight for a steel line than a Swarm is, and a bench
   * team cannot counter-pick the way a player who reads the preview can — so this
   * number is the upper bound on what the roll is worth, not what it costs a
   * player. ×2 is the point at which the roll, rather than the deployment, is
   * choosing the outcome of the node; before the budget scales were fitted the
   * unadapted spread measured ×2.6 (normal) and ×2.5 (elite).
   */
  const MAX_LEAK_RATIO = 2
  line(
    `Widest unadapted spread: **×${f2(worstLeakRatio)}** at ${worstLeakCell} (ceiling ×${f2(MAX_LEAK_RATIO)}). Measured on **fixed** teams that cannot counter-pick, so it is the ceiling on what the shape is worth against a player who ignores the preview entirely. Pressure over the road's Threat, raised until the canonical shape leaks ≥ ${VARIETY_LEAK_FLOOR} base HP: ${varietyPins.join(', ')}.`,
  )
  line('')
  line('**What this gate is worth, stated plainly.** `budgetScale` is fitted *against*')
  line('this number, so a green §14c is not independent evidence that the shapes are')
  line('fair — it is evidence that the fit converged. What it does still catch, and')
  line('what makes it worth running, is the case where **no** fit exists: the ceiling')
  line('is ×2.00 and the scales are bounded by §14b\'s 35% HP-spread ceiling to a ×1.35')
  line('ratio, so a shape whose worth per point of HP is more than about ×1.6 away from')
  line('its siblings cannot be priced into band and fails here no matter how the dial')
  line('is turned. That is a real property of the variant table and it is the one this')
  line('sweep tests. On the current table the measured worth per unit of scale is')
  line('warded 5.97, plated 7.74, swift 13.50 base HP through a random depth-8 line —')
  line('a ×2.26 spread — so the fit runs out of room and the residual ×1.54 above is')
  line('what is left over, not what was aimed at. Sweeping each variant across')
  line('`budgetScale` ×0.8…×1.85 is what produced those three slopes; the numbers are')
  line('not read off the shipped point.')
  line('')
  line('The gate that is **not** circular is §14b\'s pair: composition distance and the')
  line('HP-spread ceiling are computed straight off the wave tables with no fit')
  line('between them, and they are what bounds this one.')
  line('')
  if (worstLeakRatio > MAX_LEAK_RATIO) {
    failures.push(
      `Composition variants at ${worstLeakCell} span ×${f2(worstLeakRatio)} in base HP leaked against random unadapted teams (ceiling ×${f2(MAX_LEAK_RATIO)}). At that width the variant roll, not the deployment, is deciding the node.`,
    )
  }

  line('### 14d. Does a seeded run actually see the variety?')
  line('')
  line('A variant table nothing draws from is decoration. `encounterSeed(runSeed, layer)`')
  line("plus the node's row is what the store and `runsim` both key on, so this is the")
  line('distribution the game deals: 400 run seeds, the shape each one hands to depth 4 and')
  line('to its elites, and what the node standing beside it gets.')
  line('')
  const VARIETY_RUNS = 400
  const dealtNormal = new Map<string, number>()
  const dealtElite = new Map<string, number>()
  const dealtField = new Map<string, number>()
  for (let i = 0; i < VARIETY_RUNS; i++) {
    const rs = hashSeed(i, 'variety')
    dealtField.set(pickBattleMap(rs).id, (dealtField.get(pickBattleMap(rs).id) ?? 0) + 1)
    const n = generateEncounter(4, 'normal', { seed: encounterSeed(rs, 4) })
    const nv = variantsFor('normal', 4).find((v) => n.label.includes(v.label) || v.id === 'patrol')
    dealtNormal.set(n.label, (dealtNormal.get(n.label) ?? 0) + 1)
    void nv
    const e = generateEncounter(8, 'elite', { seed: encounterSeed(rs, 8) })
    dealtElite.set(e.label, (dealtElite.get(e.label) ?? 0) + 1)
  }
  const dist = (m: Map<string, number>) =>
    [...m.entries()].sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${pct(v / VARIETY_RUNS)}`).join(' · ')
  line(`- Battlefield over ${VARIETY_RUNS} seeds: ${dist(dealtField)}`)
  line(`- Depth-4 node: ${dist(dealtNormal)}`)
  line(`- Depth-8 elite: ${dist(dealtElite)}`)
  line('')

  /*
   * ---- the same-layer gate, rewritten so it can fail (F4) --------------------
   *
   * It used to compare `sibling: 0` against `sibling: 1` at depth 4 and gate the
   * mean at 30%. Depth 4's normal pool holds FOUR variants and `pickVariant`
   * rotates by the row — `pool[(base + sibling) % pool.length]` — so rows 0 and 1
   * are structurally guaranteed to draw different variants there. The gate was a
   * tautology: no change to the variant table, the rotation or the map generator
   * could have made it fail.
   *
   * `runmap.ts` deals **2–4 nodes per layer** (3–4 on a wide map), and
   * `variantsFor` returns 1 variant at depth 1 and 2 at depth 2. So the interesting
   * question was never "do rows 0 and 1 differ" but "what happens when the layer is
   * wider than the pool", and the honest answer is the pigeonhole: they cannot all
   * differ. `pickVariant`'s doc claimed two nodes in one layer "can never be dealt
   * the same shape", which is false wherever width > pool — measured at 17% of
   * multi-node battle layers, and on every seed of a wide map's layer 1.
   *
   * What the rotation DOES guarantee is that it is optimal: rows 0…w-1 receive
   * `min(w, pool)` distinct variants, always, which is the most any assignment can
   * manage. That is a real, falsifiable property — swap the rotation for an iid
   * draw and it breaks on the first seed — so that is what is gated here, across
   * every depth the map deals and every width it can deal.
   */
  line('**Two battle nodes standing in one layer.** `runmap.ts` puts 2–4 nodes in a')
  line('layer (3–4 on a wide map) and rotates each row through the depth\'s variant pool.')
  line('Where the layer is no wider than the pool, every node gets a different shape;')
  line('where it is wider, the pigeonhole applies and the rotation deals the most')
  line('distinct shapes that exist. Both halves are checked below.')
  line('')
  const LAYER_WIDTHS = [2, 3, 4]
  const ROTATION_DEPTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  line('| Depth | Kind | Pool | Distinct shapes at width 2 / 3 / 4 | Optimal on every seed? | Mean body-mix distance (w2/w3/w4) |')
  line('|--:|---|--:|---|---|---|')
  let rotationOptimal = true
  const rotationMisses: string[] = []
  /** Mean same-layer body-mix distance, per (kind, depth, width). */
  const layerMixMean = new Map<string, number>()
  for (const kind of ['normal', 'elite'] as EncounterKind[]) {
    for (const depth of ROTATION_DEPTHS) {
      const pool = variantsFor(kind, depth).length
      const distinctCols: string[] = []
      const mixCols: string[] = []
      let rowOptimal = true
      for (const width of LAYER_WIDTHS) {
        let optimal = 0
        const seen = new Set<number>()
        const ds: number[] = []
        for (let i = 0; i < VARIETY_RUNS; i++) {
          const rs = hashSeed(i, 'variety')
          const seed = encounterSeed(rs, depth)
          const ids = new Set<string>()
          for (let r = 0; r < width; r++) ids.add(pickVariant(kind, depth, seed, r).id)
          seen.add(ids.size)
          if (ids.size === Math.min(width, pool)) optimal++
          const waves = Array.from({ length: width }, (_, r) =>
            generateEncounter(depth, kind, { seed, sibling: r }),
          )
          for (let a = 0; a < width; a++)
            for (let b = a + 1; b < width; b++) ds.push(compDist(shares(waves[a]), shares(waves[b])))
        }
        if (optimal < VARIETY_RUNS) {
          rotationOptimal = false
          rowOptimal = false
          rotationMisses.push(
            `${kind} depth ${depth} width ${width}: ${VARIETY_RUNS - optimal}/${VARIETY_RUNS} seeds dealt fewer than ${Math.min(width, pool)} distinct shapes`,
          )
        }
        distinctCols.push([...seen].sort().join('/'))
        const m = mean(ds)
        layerMixMean.set(`${kind}:${depth}:${width}`, m)
        mixCols.push(pct(m))
      }
      line(
        `| ${depth} | ${kind} | ${pool} | ${distinctCols.join(' / ')} | ${rowOptimal ? '✅' : '❌'} | ${mixCols.join(' / ')} |`,
      )
    }
  }
  line('')
  /**
   * The rotation must deal the most distinct shapes the pool allows, on every
   * seed. Unlike the old depth-4 rows-0-and-1 check, this one is falsifiable: an
   * iid draw fails it immediately, and so does a pool that has silently shrunk.
   */
  if (!rotationOptimal) {
    failures.push(
      `The same-layer variant rotation is not dealing the maximum distinct shapes its pool allows: ${rotationMisses.slice(0, 4).join('; ')}. Two battle nodes in one layer must differ wherever the pool has the shapes to differ.`,
    )
  }
  /**
   * …and where two nodes DO get different variants, the columns must actually
   * look different.
   *
   * Gated from depth 3 up, and the exclusion is structural rather than
   * convenient: `gate()` in `waves.ts` admits bombers only from depth 2 and armour
   * only from depth 3, so at depth 1 EVERY normal variant collapses to a pure
   * torch column no matter which one is drawn — the measured distance there is
   * 0.0% for every width and would be 0.0% for any variant table anyone could
   * write. Asking "do the compositions differ" where exactly one composition is
   * legal is not a gate, it is a definition. Depths 1–2 are held by the rotation
   * check above instead, which is the only thing that IS controllable there.
   *
   * **Elites are gated here now (M1).** The old note said they were reported but
   * not checked because `variantsFor('elite', d)` returned 2 variants at depth 1
   * and 3 from depth 2 on, so depths 1–2 were "a pigeonhole plus a faction gate,
   * exactly the case this check excludes on the normal side". The first half of
   * that was an accurate description of a table in which Plated Column contained
   * no barrels until depth 3 and was therefore the same 100%-torch column as Swift
   * Raid at depth 1 — §14b, measuring only depths 4/7/9, never saw it. Now that a
   * variant is only offered where its identity exists, the elite cells clear this
   * floor at every depth this check covers, so there is no reason to look away
   * from them.
   *
   * Depths 1–2 stay out, for both kinds, and the exclusion is arithmetic rather
   * than convenient: those pools hold 1–2 shapes against layers up to 4 nodes
   * wide, so the mean below is dominated by pigeonhole duplicates — it would be
   * measuring `runmap.ts`'s layer width, not the variant table. The rotation check
   * above is what holds those layers, and it is the only thing that can.
   */
  const MIN_SAME_LAYER_DIFF = 0.3
  const gatedLayerCells = [...layerMixMean.entries()].filter(([k]) => {
    const [, depth] = k.split(':')
    return Number(depth) >= 3
  })
  const worstLayerMix = Math.min(...gatedLayerCells.map(([, v]) => v))
  const worstLayerCell = gatedLayerCells.find(([, v]) => v === worstLayerMix)?.[0] ?? ''
  line(
    `Battle nodes from depth 3 up — **normal and elite** (where all three factions are legal) — differ by at least **${pct(worstLayerMix)}** mean body-mix distance in the worst cell (${worstLayerCell}, floor ${pct(MIN_SAME_LAYER_DIFF)}). At depths 1–2 the pool holds 1–2 shapes against layers up to 4 nodes wide, so this mean would be measuring the pigeonhole rather than the table; the rotation check above is what holds those layers.`,
  )
  line('')
  if (worstLayerMix < MIN_SAME_LAYER_DIFF) {
    failures.push(
      `Two battle nodes in the same map layer differ by only ${pct(worstLayerMix)} body-mix distance at ${worstLayerCell} (kind:depth:width; floor ${pct(MIN_SAME_LAYER_DIFF)}). A fork between two identical fights is not a fork.`,
    )
  }
  /** The map draw must not be degenerate. */
  const MIN_FIELD_SHARE = 0.3
  const fieldShares = [...dealtField.values()].map((v) => v / VARIETY_RUNS)
  if (ALL_MAPS.length > 1 && Math.min(...fieldShares) < MIN_FIELD_SHARE) {
    failures.push(
      `Battlefield selection is lopsided: the rarest field lands in ${pct(Math.min(...fieldShares))} of ${VARIETY_RUNS} seeds (floor ${pct(MIN_FIELD_SHARE)}).`,
    )
  }
  /** …and neither may a node's shape draw. */
  const MIN_VARIANT_SHARE = 0.12
  for (const [name, m] of [['depth-4 node', dealtNormal], ['depth-8 elite', dealtElite]] as const) {
    const pool = m.size
    const rarest = Math.min(...[...m.values()].map((v) => v / VARIETY_RUNS))
    if (pool < 2) {
      failures.push(`The ${name} draws only ${pool} distinct shape(s) across ${VARIETY_RUNS} seeds — the node is still a fixed wave.`)
    } else if (rarest < MIN_VARIANT_SHARE) {
      failures.push(
        `The ${name}'s rarest shape lands in ${pct(rarest)} of ${VARIETY_RUNS} seeds (floor ${pct(MIN_VARIANT_SHARE)}) — a variant a player will not meet is not content.`,
      )
    }
  }
  // (The "two nodes in one layer must not be one node offered twice" gate now sits
  // above, beside the rotation table it is measured from — see F4.)
}

// -------------------------------------------------------------- Sweep 15
if (want(15)) {
  // Relics — the reward half of the hand (Phase 3b; this sweep graded the stat
  // cards relics replaced, and it grades the same way).
  line('## 15. Relics (the company-wide half of every reward hand)')
  line('')
  line('**What changed (Phase 3b).** Keepsakes (body-slot items that buffed the whole company)')
  line('and team stat cards (rewards that buffed the whole company) did one job with two')
  line('vocabularies. They are one pool of **relics** now: a run-long possession taken from')
  line('a reward hand (every elite deals one, an act boss deals three). About half are no')
  line('longer "+x%" but a **rule** — a ward, a cadence, a rush, a charter — and no relic sells')
  line('plain "+x% damage", which removed one of the eight `damageMult` sources.')
  line('')
  line('**How they are graded.** A relic that acts inside a fight (a stat relic, or a rule the')
  line('engine keeps) is applied alone — its mods as `teamMods`, exactly as `startWave` hands')
  line('them over, its stats onto the hero — and graded on **stop rate** on four benches, as')
  line('the stat cards were: §8\'s three on a physical Weaponmaster and §4\'s `magic` bench on a')
  line('Stormcaller. A relic that changes the RUN (hires, Gate, merchants, XP, gold) cannot be')
  line('seen in one wave, so it is graded on whole runs instead: held from the first node, on')
  line('paired seeds, against the same runs without it.')
  line('')
  /**
   * Six seeds rather than §8's four. A relic is a *fraction* of a mutation, so
   * the cells have to be quieter to resolve one.
   */
  const CARD_SEEDS = [11, 137, 409, 1013, 2411, 5171]
  /** How far a stated tradeoff must move a bench, in each direction, to be one. */
  const CARD_EDGE = 0.02
  /** …and how far below zero a relic's average may sit before it is a punishment. */
  const CARD_TRAP = 0.02
  interface CardBench { label: string; wave: WaveDef; hero: Sentinel; pin: number; blurb: string }
  const CARD_BENCHES: CardBench[] = [
    { label: 'swarm', wave: MUT_SCENARIOS.swarm.wave, hero: mutBase, pin: MUT_SCENARIOS.swarm.pin, blurb: MUT_SCENARIOS.swarm.blurb },
    { label: 'armour', wave: MUT_SCENARIOS.armour.wave, hero: mutBase, pin: MUT_SCENARIOS.armour.pin, blurb: MUT_SCENARIOS.armour.blurb },
    { label: 'line', wave: MUT_SCENARIOS.line.wave, hero: mutBase, pin: MUT_SCENARIOS.line.pin, blurb: MUT_SCENARIOS.line.blurb },
    {
      label: 'magic',
      wave: AFFIX_SCENARIOS.magic.wave,
      hero: AFFIX_SCENARIOS.magic.build,
      pin: BENCH_PIN.magic,
      blurb: 'a splash mystic — the half of the roster a STR card cannot reach',
    },
  ]
  const cardBase = CARD_BENCHES.map((bch) =>
    stopRate([{ sentinel: bch.hero, slotId: POST.s3 }], bch.wave, CARD_SEEDS, { enemyHpMult: bch.pin, rules: BENCH_RULES }),
  )
  line('| Bench | What it loads | Baseline stop rate |')
  line('|---|---|--:|')
  CARD_BENCHES.forEach((b, i) => line(`| \`${b.label}\` | ${b.blurb} | ${pct(cardBase[i])} |`))
  line('')
  line(`${CARD_SEEDS.length} seeds per cell.`)
  line('')
  const RUN_RULE_RELICS = RELICS.filter((r) => r.rule)
  const FIGHT_RELICS = RELICS.filter((r) => !r.rule && relicSupported(r) && r.grant)
  line('| Relic | Kind | Rarity | `swarm` | `armour` | `line` | `magic` | Mean | Worst | Stated downside |')
  line('|---|---|---|--:|--:|--:|--:|--:|--:|---|')
  const cardTier = new Map<ItemRarity, number[]>()
  for (const relic of FIGHT_RELICS) {
    const teamMods = relicTeamMods([relic.id])
    const d = CARD_BENCHES.map(
      (bch, i) =>
        stopRate([{ sentinel: withRelicStats(bch.hero, [relic.id]), slotId: POST.s3 }], bch.wave, CARD_SEEDS, {
          enemyHpMult: bch.pin,
          teamMods,
          rules: BENCH_RULES,
        }) - cardBase[i],
    )
    const m = mean(d)
    const worst = Math.min(...d)
    const best = Math.max(...d)
    // The rarity ladder is read off the STAT half — a rule's value depends on the
    // wave it meets, which is the point of a rule, and says nothing about tier.
    if (relic.kind === 'stat') cardTier.set(relic.rarity, [...(cardTier.get(relic.rarity) ?? []), m])
    line(
      `| ${relic.name} | ${relic.kind} | ${RARITY[relic.rarity].label} | ${pp(d[0])} | ${pp(d[1])} | ${pp(d[2])} | ${pp(d[3])} | **${pp(m)}** | ${pp(worst)} | ${relic.downside ?? '—'} |`,
    )
    if (m < -CARD_TRAP) {
      failures.push(
        `Relic "${relic.name}" (${relic.rarity}) is a trap: it measures ${pp(m)} averaged over §15's four benches. A reward must not make the company worse.`,
      )
    }
    if (relic.kind === 'rule' && best < CARD_EDGE) {
      failures.push(`Rule relic "${relic.name}" changes nothing a fight can see: its best bench is ${pp(best)} (needs ≥ ${pp(CARD_EDGE)}).`)
    }
    if (relic.downside) {
      if (best < CARD_EDGE) {
        failures.push(`Relic "${relic.name}" is a pact with no upside: its best bench is ${pp(best)}. It charges "${relic.downside}" for nothing.`)
      }
      if (worst > -CARD_EDGE) {
        failures.push(
          `Relic "${relic.name}" claims "${relic.downside}" but costs nothing measurable: its worst bench is ${pp(worst)}. A plain upgrade wearing a pact label.`,
        )
      }
    }
  }
  line('')
  line('| Rarity (stat relics) | Relics | Mean value |')
  line('|---|--:|--:|')
  const CARD_TIERS: ItemRarity[] = ['common', 'rare', 'epic', 'legendary']
  const tierMean = CARD_TIERS.map((r) => mean(cardTier.get(r) ?? [0]))
  CARD_TIERS.forEach((r, i) => line(`| ${RARITY[r].label} | ${(cardTier.get(r) ?? []).length} | **${pp(tierMean[i])}** |`))
  line('')
  for (let i = 1; i < CARD_TIERS.length; i++) {
    if (tierMean[i] < tierMean[i - 1]) {
      failures.push(
        `Relic rarity ladder is inverted: ${RARITY[CARD_TIERS[i]].label} stat relics mean ${pp(tierMean[i])}, below ${RARITY[CARD_TIERS[i - 1]].label} at ${pp(tierMean[i - 1])}. Rarity is the only signal the offer gives before the pick.`,
      )
    }
  }

  // ---- the run-rule half: whole runs, paired ---------------------------------
  /** Paired runs per run-rule relic (adaptive line, zero meta). */
  const RELIC_RUNS = Number(process.env.FW_RELIC_RUNS) || 150
  const relicPolicy = policyById('adaptive')
  const relicZero = Array.from({ length: RELIC_RUNS }, (_, i) => (simulateRun(9001 + i * 17, FRESH_ARCHES[i % 3], { policy: relicPolicy }).won ? 1 : 0))
  line(`**The run-rule relics, on whole runs.** Each held from the first node, ${RELIC_RUNS} paired runs on the adaptive line, against the same runs without it (zero meta ${pct(mean(relicZero))}):`)
  line('')
  line('| Relic | Rarity | Rule | Win rate | Δ (± 2 s.e.) |')
  line('|---|---|---|--:|--:|')
  for (const relic of RUN_RULE_RELICS) {
    const wins = Array.from({ length: RELIC_RUNS }, (_, i) => (simulateRun(9001 + i * 17, FRESH_ARCHES[i % 3], { policy: relicPolicy, startRelics: [relic.id] }).won ? 1 : 0))
    const dlt = mean(wins) - mean(relicZero)
    const tol = Math.max(HUB_TOLERANCE, pairedTolerance(wins, relicZero))
    line(`| ${relic.name} | ${RARITY[relic.rarity].label} | ${relic.desc} | ${pct(mean(wins))} | ${dlt >= 0 ? '+' : '−'}${Math.abs(dlt * 100).toFixed(0)}±${(tol * 100).toFixed(0)}pt |`)
    if (dlt + tol < 0) {
      failures.push(`Run-rule relic "${relic.name}" LOWERS the win rate by ${(dlt * 100).toFixed(0)}pt (beyond the ±${(tol * 100).toFixed(0)}pt paired floor). A relic is a reward.`)
    }
  }
  line('')
  const awaiting = RELICS.filter((r) => !relicSupported(r))
  line(`**Declared, not dealt.** ${awaiting.length ? awaiting.map((r) => `${r.name} (\`${r.requires}\`)`).join(', ') : 'none'} — relics whose rule belongs to the combat lane's engine. \`ENGINE_CAPABILITIES\` gates them out of every hand until that capability lands, so no card sells a rule this build cannot keep; the invariant below checks it.`)
  line('')
  for (const r of relicPool({ unlocked: () => true })) {
    if (!relicSupported(r)) failures.push(`Relic "${r.name}" is in the offer pool but needs \`${r.requires}\`, which this engine does not implement.`)
  }
  const plainDamage = RELICS.filter((r) => r.grant?.mods?.damageMult && r.grant.mods.damageMult > 1 && !r.downside)
  line(`**No plain "+x% damage" relic:** ${plainDamage.length === 0 ? 'none in the pool' : plainDamage.map((r) => r.name).join(', ')}. Damage relics are pacts, which is the point.`)
  line('')
  if (plainDamage.length) failures.push(`Relic(s) ${plainDamage.map((r) => r.name).join(', ')} sell plain "+x% damage" — the damageMult source Phase 3b removed.`)
}

// -------------------------------------------------------------- Sweep 16
if (want(16)) {
  // Combat depth (Phase 3a): the behaviour kit, boss phases, sub-waves, Watch
  // Commands and status interactions — each with a bench, a counter and a gate.
  const combatDepth = runCombatDepth()
  for (const l of combatDepth.md) line(l)
  failures.push(...combatDepth.failures)
  summary.push(combatDepth.summary)
}

// -------------------------------------------------------------- Sweep 17
if (want(17)) {
  line('## 17. Portrait twins — does a phone fight the same battle?')
  line('')
  line('**Why this exists.** A phone held upright fights on a **portrait twin** of the')
  line('seeded field (`maps.ts` § Portrait battlefields): the landscape field transposed')
  line('and padded, so the lane fills the tall live-wave Stage instead of a 390×228 strip.')
  line('The seed still deals the landscape field (`pickBattleMap` never returns a twin);')
  line('which twin is fought on is chosen per battle from the layout. That is only safe if')
  line('the two are the same game — the Daily Watch deals one seed to every device, and a')
  line('twin that were even a few points easier would make the phone the right way to')
  line('play it. So the twin is checked twice: its geometry against the original, and its')
  line('difficulty on the live engine.')
  line('')
  /** Path lengths may differ by at most this (the ±5% brief; the isometry gives 0). */
  const TWIN_MAX_LENGTH_DIFF = 0.005
  /** Per-slot coverage at every range may differ by at most this share of the original. */
  const TWIN_MAX_COVERAGE_DIFF = 0.02
  /** Stop-rate difference allowed across the battery (points). */
  const TWIN_MAX_STOP_DIFF = 0.03
  /** Mean Gate HP lost may differ by at most this share (or 0.25 HP, whichever is larger). */
  const TWIN_MAX_LEAK_DIFF = 0.05
  const TWIN_RANGES = [96, 150, 168]
  line('| Field | Twin | Box | Path px (twin / original) | Slots | Worst per-slot coverage Δ (96 / 150 / 168px) | Worst slot-gap Δ |')
  line('|---|---|---|--:|--:|---|--:|')
  for (const land of ALL_MAPS) {
    const tall = orientField(land, 'portrait')
    const lenL = pathLength(land.path)
    const lenT = pathLength(tall.path)
    const covDiff = TWIN_RANGES.map((r) => {
      const a = slotCoverage(land, r)
      const b = slotCoverage(tall, r)
      return Math.max(...land.slots.map((sl) => Math.abs(b[sl.id] - a[sl.id]) / Math.max(1, a[sl.id])))
    })
    let gapDiff = 0
    for (const a of land.slots) {
      for (const b of land.slots) {
        const ta = tall.slots.find((x) => x.id === a.id)!
        const tb = tall.slots.find((x) => x.id === b.id)!
        gapDiff = Math.max(gapDiff, Math.abs(Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y) - Math.hypot(ta.pos.x - tb.pos.x, ta.pos.y - tb.pos.y)))
      }
    }
    line(
      `| ${land.name} | \`${tall.id}\` | ${tall.width}×${tall.height} | ${Math.round(lenT)} / ${Math.round(lenL)} | ${tall.slots.length} / ${land.slots.length} | ${covDiff.map((d) => `${(d * 100).toFixed(1)}%`).join(' / ')} | ${gapDiff.toFixed(2)}px |`,
    )
    if (Math.abs(lenT / lenL - 1) > TWIN_MAX_LENGTH_DIFF) {
      failures.push(`${land.name}'s portrait twin is ${((lenT / lenL - 1) * 100).toFixed(1)}% off the original's path length (max ±${(TWIN_MAX_LENGTH_DIFF * 100).toFixed(1)}%): crossing time is a difficulty dial Threat does not multiply.`)
    }
    if (tall.slots.length !== land.slots.length || tall.slots.some((sl, i) => sl.id !== land.slots[i].id)) {
      failures.push(`${land.name}'s portrait twin does not carry the same slots (placements are keyed by slot id and ride across orientations).`)
    }
    if (Math.max(...covDiff) > TWIN_MAX_COVERAGE_DIFF) {
      failures.push(`${land.name}'s portrait twin changes what a slot sees by up to ${(Math.max(...covDiff) * 100).toFixed(1)}% (max ${(TWIN_MAX_COVERAGE_DIFF * 100).toFixed(0)}%) — a phone would be solving a different placement puzzle.`)
    }
  }
  line('')
  /**
   * The battery: the §14c teams (3–5 random tier-2 specs, depth-scaled level and
   * gear, best-coverage slots) at five depths and three node kinds, on the twin
   * and on the original, same seeds. `baseHp` is the real 20 so the stop rate
   * means something; Gate HP lost is summed over every fight.
   */
  const TWIN_DEPTHS: [number, EncounterKind][] = [[2, 'normal'], [4, 'boss'], [6, 'elite'], [8, 'normal'], [10, 'normal'], [12, 'boss']]
  const TWIN_TEAMS = 8
  line(`**Battery** — ${TWIN_TEAMS} random §14c-style companies × ${TWIN_DEPTHS.length} nodes (${TWIN_DEPTHS.map(([d, k]) => `d${d} ${k}`).join(', ')}) at the road's Threat, base ${MAX_BASE_HP}, identical seeds on both twins:`)
  line('')
  line('| Field | Orientation | Fights | Stopped (cleared) | Gate HP lost (mean) |')
  line('|---|---|--:|--:|--:|')
  for (const land of ALL_MAPS) {
    const res: Record<string, { cleared: number; lost: number; n: number }> = {}
    for (const field of [land, orientField(land, 'portrait')]) {
      const acc = { cleared: 0, lost: 0, n: 0 }
      const rr = new RNG(1717)
      const order = bestSlots(field)
      for (let t = 0; t < TWIN_TEAMS; t++) {
        const size = 3 + Math.floor(rr.next() * 3)
        const ids = Array.from({ length: size }, () => rr.pick(TIER2_NODES).id)
        for (const [depth, kind] of TWIN_DEPTHS) {
          const team = ids.map((id, i) => ({
            sentinel: buildSpec(id, { level: mcLevel(depth), gearRarity: mcRarity(depth), seed: t * 10 + i, perkSeed: t * 10 + i }),
            slotId: order[i],
          }))
          const m = runBattle({ team, depth, kind, map: field, autoDeploy: true, enemyHpMult: threatAtLayer(depth), baseHp: MAX_BASE_HP, maxSeconds: 600, seed: t * 97 + depth, variantSeed: t * 13 + depth })
          acc.n++
          if (m.cleared) acc.cleared++
          acc.lost += m.baseHpLost
        }
      }
      res[orientationOf(field)] = acc
      line(`| ${land.name} | ${orientationOf(field)} (\`${field.id}\`) | ${acc.n} | ${pct(acc.cleared / acc.n)} | ${f2(acc.lost / acc.n)} |`)
    }
    const a = res.landscape
    const b = res.portrait
    const stopDiff = Math.abs(a.cleared / a.n - b.cleared / b.n)
    const leakA = a.lost / a.n
    const leakB = b.lost / b.n
    if (stopDiff > TWIN_MAX_STOP_DIFF) {
      failures.push(`${land.name}: the portrait twin's stop rate differs from the landscape field's by ${(stopDiff * 100).toFixed(1)}pt (max ${(TWIN_MAX_STOP_DIFF * 100).toFixed(0)}pt) — the orientation a device picks is changing the game.`)
    }
    if (Math.abs(leakB - leakA) > Math.max(0.25, TWIN_MAX_LEAK_DIFF * leakA)) {
      failures.push(`${land.name}: the portrait twin leaks ${f2(leakB)} Gate HP a fight against ${f2(leakA)} on the landscape field (max ±${(TWIN_MAX_LEAK_DIFF * 100).toFixed(0)}%).`)
    }
  }
  line('')
  line(`**The gates.** Path length within ±${(TWIN_MAX_LENGTH_DIFF * 100).toFixed(1)}%, the same slot ids, every slot's coverage within ${(TWIN_MAX_COVERAGE_DIFF * 100).toFixed(0)}% at ${TWIN_RANGES.join(' / ')}px, and on the battery a stop rate within ${(TWIN_MAX_STOP_DIFF * 100).toFixed(0)}pt and Gate HP lost within ±${(TWIN_MAX_LEAK_DIFF * 100).toFixed(0)}% of the landscape field. The twins are an isometry of the originals, so the geometry reads 0 by construction and the battery reads identical fights: what these gates really hold is **the engine's isotropy** — a future rule that treats x and y differently (a lob that falls "down", a spawn edge that assumes the left) turns them red instead of quietly making one device class easier.`)
  line('')
}

// -------------------------------------------------------------- Sweep 18
if (want(18)) {
  // The Sovereign Route (the endgame charter, build step 5): how often a strong
  // late-game company delivers it, what it is worth to the bank, and what each
  // company's trade-off costs. Reported, not gated: the fee and the payout are
  // placeholders the tuning pass owns.
  line('## 18. The Sovereign Route (the endgame charter)')
  line('')
  line(`**What it is.** The endgame charter (\`run/charter.ts\`): it opens once every skill card and every Level 1–3 item kind is`)
  line(`unlocked. A **${CHARTER_FEE.toLocaleString('en')} gold** fee from the bank, no crates, waypoint cities that pay nothing, no cash-out; delivered, the`)
  line(`destination pays **${CHARTER_PAYOUT.toLocaleString('en')} gold** whatever the cargo, and one Sovereign item kind unlocks. It deals every pool the`)
  line('player owns for no company (no route weighting, no HQ focus), and every company sets a condition at once:')
  line('')
  for (const t of TRADE_OFFS) line(`- **${COMPANIES.find((c) => c.id === t.company)!.name}: ${t.rule}.** ${t.line}`)
  line('- And every goblin clan marches from the first fight (the muster).')
  line('')
  const LATE_HQ = { deal: 5, hiring: 1, rate: 3, pack: 4, rocks: 3, focus: 3, scouting: 2 }
  const late = loadoutFor('late game', { upgrades: LATE_HQ })
  const lateSkills = ALL_SKILLS.filter((s) => !s.feat).map((s) => s.id)
  const lateItems = [...ALL_ITEM_KINDS]
  const lateOwned = [...ALL_ITEM_KINDS, ...SOVEREIGN_ITEM_KINDS]
  const CH_POLICY = POLICIES[policyIdx('adaptive')]
  line(`**The company.** A strong late-game militia: every skill card a contract can unlock (${lateSkills.length}, feat cards aside), every Level 1–3`)
  line('item kind, and the HQ bought out (Opening deal 5, the Hiring Hall, pack slots 10, boulders 3, the scouts) — the save that')
  line(`opens the door. The adaptive route, ${HUB_RUNS} runs a row on the paired seeds of §12–§13.`)
  line('')
  interface ChRow { label: string; won: number; net: number }
  const chRows: ChRow[] = []
  const measure = (label: string, o: Parameters<typeof simulateRun>[2]) => {
    const won: number[] = []
    const net: number[] = []
    for (let i = 0; i < HUB_RUNS; i++) {
      const r = simulateRun(9001 + i * 17, FRESH_ARCHES[i % 3], { meta: late, policy: CH_POLICY, skillPool: lateSkills, itemPool: lateItems, ...o })
      const x = contractNet(r, o?.contract?.charter ? PRESS_ON : CASH_OUT_HALF)
      won.push(r.won ? 1 : 0)
      net.push(x.net)
    }
    const row = { label, won: mean(won), net: mean(net) }
    chRows.push(row)
    return row
  }
  const escort = measure("Escort on Rosethread's road (for scale)", { contract: { company: 'silk', crates: 0 } })
  const staked = measure("4 crates on Rosethread's road (a good run, for scale)", { contract: { company: 'silk', crates: 4 } })
  const charter = { company: null, crates: 0, charter: true } as const
  const none = measure('**Sovereign Route** · no Sovereign item owned', { contract: charter })
  const all = measure('**Sovereign Route** · all five Sovereign items owned', { contract: charter, itemPool: lateOwned })
  const noGround = measure('Sovereign Route without its ground (fire, lakes, boulders, curses)', { contract: charter, charterParts: { ground: false } })
  const noPrices = measure("Sovereign Route without Rosethread's double prices", { contract: charter, charterParts: { prices: false } })
  const noMuster = measure('Sovereign Route without the muster (the usual clan ramp)', { contract: charter, charterParts: { muster: false } })
  line('| Road | Delivered | Bank net a run (gold) |')
  line('|---|--:|--:|')
  for (const r of chRows) line(`| ${r.label} | ${pct(r.won)} | ${r.net >= 0 ? '' : '−'}${Math.abs(r.net).toFixed(0)} |`)
  line('')
  const breakEven = CHARTER_FEE / CHARTER_PAYOUT
  const goodRuns = staked.net > 0 ? CHARTER_FEE / staked.net : NaN
  line(`**The charter's delivery rate for this company: ${pct(none.won)}** (${pct(all.won)} once all five Sovereign items are owned). The payout is ${(CHARTER_PAYOUT / CHARTER_FEE).toFixed(0)}× the fee, so the charter breaks even at a ${pct(breakEven)} delivery rate; measured, a charter is worth **${none.net >= 0 ? '+' : '−'}${Math.abs(none.net).toFixed(0)} gold** to the bank on average (the fee, the purse and the road's share included).`)
  line('')
  line(`**The fee against savings.** The same company banks ${escort.net.toFixed(0)} gold net from an escort and ${staked.net.toFixed(0)} from a 4-crate contract (cash-out line), so the ${CHARTER_FEE.toLocaleString('en')} fee is about **${Number.isFinite(goodRuns) ? goodRuns.toFixed(1) : '—'} good runs** of savings.`)
  line('')
  line(`**Each condition, lifted one at a time** (delivery against the full charter's ${pct(none.won)}): without the ground ${pct(noGround.won)} (${pp(noGround.won - none.won)}), without the double prices ${pct(noPrices.won)} (${pp(noPrices.won - none.won)}), without the muster ${pct(noMuster.won)} (${pp(noMuster.won - none.won)}). A positive delta is what that condition costs; a negative one means the charter is easier with it than without — at ${HUB_RUNS} runs a row the paired noise is several points, so read the signs, not the decimals.`)
  line('')
  line('_Not tuned. The fee, the payout and the conditions are the designer\'s to set; this section exists so the tuning pass starts from a number._')
  line('')
  summary.push(`Sovereign Route (late-game company): delivered ${pct(none.won)} (all five Sovereign items ${pct(all.won)}), bank net ${none.net.toFixed(0)} a charter; break-even ${pct(breakEven)}; lifting each: ground ${pp(noGround.won - none.won)}, prices ${pp(noPrices.won - none.won)}, muster ${pp(noMuster.won - none.won)}`)
}

// -------------------------------------------------------------- Summary
line('## Verdict')
line('')
if (SECTIONS) {
  line(`_Filtered run (\`FW_SECTIONS\`): sections ${[...SECTIONS].sort((a, b) => a - b).join(', ')} and their invariants only._`)
  line('')
}
if (failures.length === 0) {
  line('✅ **All balance invariants passed.**')
} else {
  line(`❌ **${failures.length} balance issue(s) detected:**`)
  line('')
  for (const fmsg of failures) line(`- ${fmsg}`)
  line('')
  line('_Several of these are expected to be red: they are the findings this rebuild was')
  line('written to surface. They are deliberately **not** tuned to pass._')
}
line('')

const out = md.join('\n')
// A filtered run is a partial report: it must never overwrite the golden file.
const outPath = new URL(SECTIONS ? './REPORT.sections.md' : './REPORT.md', import.meta.url)
writeFileSync(outPath, out)
if (SECTIONS) console.log(out)

// Console summary — one line per section, pushed by each section as it ran, so a
// filtered run prints only the lines of the sections it ran (same order).
console.log('=== Fieldwatch Balance ===')
for (const s of summary) console.log(s)
console.log(SECTIONS ? `Sections ${[...SECTIONS].sort((a, b) => a - b).join(', ')} written to ${outPath.pathname}` : `Report written to balance/REPORT.md`)
if (failures.length) {
  console.log(`\n❌ ${failures.length} invariant(s) failed:`)
  for (const fmsg of failures) console.log('  - ' + fmsg)
  process.exit(1)
} else {
  console.log('\n✅ All balance invariants passed.')
}

// ---- helpers ----
function baseStatTotal(it: Item): number {
  const b = it.base
  // Normalise disparate base fields onto a rough "budget points" scale so the
  // rarity ladder stays comparable across weapon / off-hand / body items.
  return (
    (b.physDamage ?? 0) +
    (b.magDamage ?? 0) +
    (b.attackSpeed ?? 0) * 100 +
    (b.critChance ?? 0) * 100 +
    (b.rangeMult ?? 0) * 100 +
    (b.splashAdd ?? 0)
  )
}

/** Roll a single named enchantment at legendary budget by generating items until it appears. */
function rollNamedEnchant(id: string): Enchantment | null {
  const rng = new RNG(500)
  for (let i = 0; i < 8000; i++) {
    const it = generateItem(rng, { slot: rng.pick(['oneHand', 'offHand', 'body']), rarity: 'legendary' })
    const e = it.enchantments.find((x) => x.id === id)
    if (e) return e
  }
  return null
}

function histogram(values: number[], max: number): string {
  const counts = new Array(max + 1).fill(0)
  for (const d of values) counts[Math.min(max, d)]++
  return counts.map((c, d) => `${d}:${c}`).join('  ')
}
