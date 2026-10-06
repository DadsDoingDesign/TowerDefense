import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ALL_REVEALED,
  CORE_IDEAS,
  IDEAS,
  ideaShown,
  menuStaged,
  metaIdeas,
  openSlotShown,
  presentIdeas,
  readMet,
  revealOf,
  stakesShown,
  startsFirstRun,
  type IdeaId,
  type StageState,
} from '../src/state/staging'
import { HQ_OPENS_AT } from '../src/game/run/hq'
import { standingXpToReach } from '../src/game/run/standing'
import { META_VERSION, migrateMeta, useMetaStore } from '../src/state/metaStore'
import { LS3_TEACH_IDS, migrateSettings, SETTINGS_VERSION, TEACH_IDS, useSettingsStore } from '../src/state/settingsStore'
import { useGameStore } from '../src/state/gameStore'
import { captureRun, migrateSnapshot, RUN_SNAPSHOT_VERSION } from '../src/state/runSnapshot'
import { GLOSSARY } from '../src/ui/channels'
import { glossaryOffer } from '../src/ui/shell/codexOffers'
import { holdCoachRow, pickTipId, type TipFacts } from '../src/ui/shell/coachRules'

/**
 * LS3 — teach in layers. What a first run shows when, what is persisted and
 * how it is validated, and that a returning player sees everything.
 */

// A tiny road: start → two battles → a merchant and an elite → boss.
const MAP: StageState['runMap'] = {
  nodes: [
    { id: 's', type: 'start', layer: 0, row: 0, nx: 0, ny: 0.5 },
    { id: 'b1', type: 'battle', layer: 1, row: 0, nx: 0.2, ny: 0.3 },
    { id: 'b2', type: 'battle', layer: 1, row: 1, nx: 0.2, ny: 0.7 },
    { id: 'm', type: 'merchant', layer: 2, row: 0, nx: 0.4, ny: 0.3 },
    { id: 'e', type: 'elite', layer: 2, row: 1, nx: 0.4, ny: 0.7 },
    { id: 'x', type: 'boss', layer: 3, row: 0, nx: 1, ny: 0.5 },
  ],
}

/** The first battle of a first run, before anything has happened. */
const firstBattle = (patch: Partial<StageState> = {}): StageState => ({
  screen: 'battle',
  runMap: MAP,
  clearedNodeIds: ['s'],
  reachableNodeIds: ['b1', 'b2'],
  activeNodeId: 'b1',
  event: null,
  threat: 1,
  battlePhase: 'setup',
  hud: { subWave: 0, breather: false },
  roster: [{ level: 1 }],
  reward: null,
  relics: [],
  battleMap: { tiles: [] },
  ...patch,
})

const shown = (s: StageState, met: readonly string[] = []) =>
  new Set(IDEAS.filter((id) => ideaShown(id, true, met, presentIdeas(s))))

describe('what a first run shows, and when', () => {
  it('the first battle carries only the core: heroes, posting, the Gate and gold', () => {
    expect([...shown(firstBattle())].sort()).toEqual([...CORE_IDEAS].sort())
    // …and none of the things the brief names as held back.
    for (const id of ['speed', 'command', 'gear', 'depth', 'strength', 'relic', 'skill', 'danger', 'challenge'] as IdeaId[]) {
      expect(shown(firstBattle()).has(id)).toBe(false)
    }
  })

  it('the live first wave still holds speed back; the first breather brings it (and sub-waves)', () => {
    expect(shown(firstBattle({ battlePhase: 'battle' })).has('speed')).toBe(false)
    const held = shown(firstBattle({ battlePhase: 'battle', hud: { subWave: 1, breather: true } }))
    expect(held.has('speed')).toBe(true)
    expect(held.has('subwave')).toBe(true)
    expect(held.has('command')).toBe(false)
    expect(held.has('gear')).toBe(false)
  })

  it('the first win brings gear and the pack, the road length and the Watch Command', () => {
    const won = shown(firstBattle({ clearedNodeIds: ['s', 'b1'], threat: 1.12 }))
    for (const id of ['gear', 'depth', 'command', 'speed', 'strength'] as IdeaId[]) expect(won.has(id)).toBe(true)
    expect(won.has('relic')).toBe(false)
  })

  it('stops, relics and the ground arrive when they are in reach, offered or underfoot', () => {
    const map = firstBattle({ screen: 'map', clearedNodeIds: ['s', 'b1'], reachableNodeIds: ['m', 'e'], activeNodeId: null })
    expect(shown(map).has('merchant')).toBe(true)
    expect(shown(map).has('elite')).toBe(true)
    expect(shown(firstBattle({ reward: [{ kind: 'relic' }] })).has('relic')).toBe(true)
    expect(shown(firstBattle({ relics: ['horn'] })).has('relic')).toBe(true)
    expect(shown(firstBattle({ battleMap: { tiles: [{ danger: 'cursed' }] } })).has('danger')).toBe(true)
    expect(shown(firstBattle({ battleMap: { terrainRule: 'flooded', tiles: [] } })).has('challenge')).toBe(true)
    // Ground on the MAP screen is not ground underfoot.
    expect(shown(firstBattle({ screen: 'map', battleMap: { terrainRule: 'flooded', tiles: [{ danger: 'cursed' }] } })).has('danger')).toBe(false)
  })

  it('skills arrive with the hero pick (every hero there has one), or at a hero’s first milestone', () => {
    expect(shown(firstBattle({ roster: [{ level: 4 }] })).has('skill')).toBe(false)
    expect(shown(firstBattle({ screen: 'heroPick', roster: [] })).has('skill')).toBe(true)
    expect(shown(firstBattle({ roster: [{ level: 1, skills: ['quick_hands'] }] })).has('skill')).toBe(true)
    expect(shown(firstBattle({ roster: [{ level: 5 }] })).has('skill')).toBe(true)
  })

  it('an idea once met stays shown, even when the moment has passed', () => {
    // The next battle's setup: no breather, no sub-wave — but speed was met.
    expect(shown(firstBattle(), ['speed']).has('speed')).toBe(true)
    expect(shown(firstBattle(), []).has('speed')).toBe(false)
  })

  it('a run that is not staged shows everything, whatever it has met', () => {
    for (const id of IDEAS) expect(ideaShown(id, false, [], presentIdeas(firstBattle()))).toBe(true)
  })

  it('the menu opens up with the first finished run — then the staggered reveal (October 2026)', () => {
    expect(metaIdeas({ runsCompleted: 0 })).toEqual([])
    // Run 2 no longer opens everything: the bank, the purse, standing and the charter's goal.
    expect(metaIdeas({ runsCompleted: 1 })).toEqual(['bank', 'purse', 'standing', 'sovereign'])
    // The HQ at 500 banked, the crates at the first delivery, the stake at standing 2 with any company.
    expect(metaIdeas({ runsCompleted: 1, bank: HQ_OPENS_AT })).toContain('hq')
    expect(metaIdeas({ runsCompleted: 1, bank: HQ_OPENS_AT - 1 })).not.toContain('hq')
    expect(metaIdeas({ runsCompleted: 1, runsWon: 1 })).toContain('crates')
    expect(metaIdeas({ runsCompleted: 2, standing: { art: standingXpToReach(1) } })).not.toContain('stake')
    expect(metaIdeas({ runsCompleted: 2, standing: { art: standingXpToReach(2) } })).toContain('stake')
    // The market and company focus from the fifth finished contract.
    expect(metaIdeas({ runsCompleted: 4 })).not.toContain('market')
    expect(metaIdeas({ runsCompleted: 5 })).toEqual(expect.arrayContaining(['market', 'focus']))
  })

  it('revealOf: each gate, its latch, and "Show everything" opening it all', () => {
    const r = (v: Parameters<typeof revealOf>[0]) => revealOf(v, false)
    // A first-timer and a run-2 player with 100 in the bank: nothing yet.
    expect(r({ runsCompleted: 0, bank: 9999 })).toEqual({ hq: false, crates: false, market: false, focus: false })
    expect(r({ runsCompleted: 1, bank: 100 })).toEqual({ hq: false, crates: false, market: false, focus: false })
    // The HQ the first time the bank holds 500 — and it stays open once met (the latch).
    expect(r({ runsCompleted: 1, bank: 500 }).hq).toBe(true)
    expect(r({ runsCompleted: 3, bank: 40, met: ['hq'] }).hq).toBe(true)
    // A save that bought an HQ level has met the HQ.
    expect(r({ runsCompleted: 3, bank: 40, hqOwned: true }).hq).toBe(true)
    // The crates at the first delivered contract (a fall or a cash-out does not open them), latched.
    expect(r({ runsCompleted: 3, runsWon: 0 }).crates).toBe(false)
    expect(r({ runsCompleted: 3, runsWon: 1 }).crates).toBe(true)
    expect(r({ runsCompleted: 3, met: ['crates'] }).crates).toBe(true)
    // The market and focus at five finished contracts.
    expect(r({ runsCompleted: 4 })).toMatchObject({ market: false, focus: false })
    expect(r({ runsCompleted: 5 })).toMatchObject({ market: true, focus: true })
    // "Show everything from the start" opens every gate.
    expect(revealOf({ runsCompleted: 0 }, true)).toEqual(ALL_REVEALED)
    // Stakes, per company, at standing 2 with it.
    expect(stakesShown({ art: standingXpToReach(1) }, 'art', false)).toBe(false)
    expect(stakesShown({ art: standingXpToReach(2) }, 'art', false)).toBe(true)
    expect(stakesShown({ art: standingXpToReach(2) }, 'spice', false)).toBe(false)
    expect(stakesShown({}, 'spice', true)).toBe(true)
  })

  it('the HQ latch: a bank that falls back under 500 keeps the HQ open once it was met', () => {
    useMetaStore.getState().resetMeta()
    useMetaStore.setState({ bank: 520, stats: { ...useMetaStore.getState().stats, runsCompleted: 2 } })
    useMetaStore.getState().recordMet(metaIdeas({ runsCompleted: 2, bank: 520 }))
    expect(useMetaStore.getState().met).toContain('hq')
    useMetaStore.setState({ bank: 20 })
    const m = useMetaStore.getState()
    expect(revealOf({ runsCompleted: 2, bank: m.bank, met: m.met }, false).hq).toBe(true)
    // The latch is the persisted `met` list, validated on load.
    expect(migrateMeta({ met: ['hq', 'market', 'nope'] }, META_VERSION).met).toEqual(['hq', 'market'])
  })
})

describe('the party row\'s open slot', () => {
  // The first map put a recruit stop in reach beside the first battle.
  const recruitMap: StageState['runMap'] = { nodes: [...MAP.nodes, { id: 'r', type: 'recruit', layer: 1, row: 2, nx: 0.2, ny: 0.9 }] }
  const onMap = firstBattle({ screen: 'map', runMap: recruitMap, reachableNodeIds: ['b1', 'b2', 'r'], activeNodeId: null })
  const inFirst = firstBattle({ runMap: recruitMap, reachableNodeIds: ['b1', 'b2', 'r'] })
  const recruit = (s: StageState, met: readonly string[] = []) => ideaShown('recruit', true, met, presentIdeas(s))

  it('waits out the first battle of a first run, even with a recruit stop met on the map', () => {
    expect(recruit(onMap)).toBe(true)
    expect(openSlotShown(true, recruit(onMap), onMap)).toBe(true)
    expect(openSlotShown(true, recruit(inFirst, ['recruit']), inFirst)).toBe(false)
  })

  it('then follows the recruit idea', () => {
    const second = firstBattle({ clearedNodeIds: ['s', 'b1'], reachableNodeIds: ['m', 'e'], activeNodeId: 'e' })
    expect(openSlotShown(true, recruit(second), second)).toBe(false)
    expect(openSlotShown(true, recruit(second, ['recruit']), second)).toBe(true)
  })

  it('is untouched on a run that is not staged', () => {
    expect(openSlotShown(false, true, firstBattle())).toBe(true)
  })
})

describe('who is staged', () => {
  it('a first run is a contract with no finished contract behind it', () => {
    expect(startsFirstRun({ runsCompleted: 0 }, false)).toBe(true)
    expect(startsFirstRun({ runsCompleted: 1 }, false)).toBe(false)
    expect(startsFirstRun({ runsCompleted: 0 }, true)).toBe(false)
  })

  it('the menu is staged on the same terms', () => {
    expect(menuStaged({ runsCompleted: 0 }, false)).toBe(true)
    expect(menuStaged({ runsCompleted: 3 }, false)).toBe(false)
    expect(menuStaged({ runsCompleted: 0 }, true)).toBe(false)
  })
})

describe('the store: a first run is staged, a returning player is not', () => {
  afterEach(() => {
    useMetaStore.getState().resetMeta()
    useSettingsStore.setState({ showEverything: false })
  })

  it('a fresh save begins a staged run; any finished run, or the setting, does not', () => {
    useMetaStore.getState().resetMeta()
    useGameStore.getState().newRun()
    expect(useGameStore.getState().firstRun).toBe(true)

    useMetaStore.setState({ stats: { ...useMetaStore.getState().stats, runsCompleted: 1 } })
    useGameStore.getState().newRun()
    expect(useGameStore.getState().firstRun).toBe(false)

    useMetaStore.getState().resetMeta()
    useSettingsStore.setState({ showEverything: true })
    useGameStore.getState().newRun()
    expect(useGameStore.getState().firstRun).toBe(false)
  })

  it('a first-timer’s Start a Run is one free escort for Peppercorn Co. — no board', () => {
    useMetaStore.getState().resetMeta()
    useGameStore.getState().openContracts()
    const s = useGameStore.getState()
    expect(s.screen).toBe('heroPick')
    expect(s.firstRun).toBe(true)
    expect(s.contract).toMatchObject({ company: 'spice', crates: 0, purse: 60, market: expect.any(Number) })
    expect(s.board).toBeNull()
  })

  it('a first contract cannot cash out at a city; a returning player can', () => {
    useMetaStore.getState().resetMeta()
    useGameStore.getState().openContracts()
    useGameStore.getState().pickStartingHero('pick-0')
    const c = useGameStore.getState().contract!
    useGameStore.setState({ contract: { ...c, paid: [40], cargoAt: [100], pending: 0 } })
    useGameStore.getState().cashOut()
    expect(useGameStore.getState().runPhase).toBe('active')
    expect(useGameStore.getState().contract!.pending).toBe(0)
    useGameStore.getState().pressOn()
    expect(useGameStore.getState().contract!.pending).toBeNull()
  })
})

describe('persistence and validation', () => {
  it('`met` keeps known ideas only, each once, in the order met', () => {
    expect(readMet(['gear', 'nope', 7, 'gear', null, 'speed', { id: 'relic' }])).toEqual(['gear', 'speed'])
    // SK1: perks and evolutions were met as skills; the mercenary company: the
    // Vow and the difficulty are the stake, the Gate the cargo, Marks the bank.
    expect(readMet(['perk', 'evolve', 'vow', 'gear'])).toEqual(['skill', 'stake', 'gear'])
    expect(readMet(['gate', 'marks', 'difficulty', 'daily', 'endless'])).toEqual(['cargo', 'bank', 'stake'])
    expect(readMet('gear')).toEqual([])
    expect(readMet(undefined)).toEqual([])
  })

  it('the meta save carries `met` (v5+), and a v4 save loads with none', () => {
    expect(META_VERSION).toBe(11)
    const v4 = { watchMarks: 12, upgrades: {}, topDifficulty: 0, stats: { runsCompleted: 2 }, codex: {} }
    expect(migrateMeta(v4, 4).met).toEqual([])
    expect(migrateMeta({ ...v4, met: ['relic', 'bogus', 'relic'] }, 5).met).toEqual(['relic'])
    expect(migrateMeta({ ...v4, met: 'relic' }, 5).met).toEqual([])
  })

  it('recordMet latches, dedupes, and is a no-op when nothing is new', () => {
    const meta = useMetaStore.getState()
    meta.resetMeta()
    useMetaStore.getState().recordMet(['gear', 'speed'])
    const once = useMetaStore.getState().met
    useMetaStore.getState().recordMet(['speed', 'gear'])
    expect(useMetaStore.getState().met).toBe(once)
    useMetaStore.getState().recordMet(['bogus' as IdeaId, 'relic'])
    expect(useMetaStore.getState().met).toEqual(['gear', 'speed', 'relic'])
    useMetaStore.getState().resetMeta()
    expect(useMetaStore.getState().met).toEqual([])
  })

  it('settings v4+: "Show everything" is a boolean that defaults off', () => {
    expect(SETTINGS_VERSION).toBe(5)
    const none = () => null
    expect(migrateSettings({}, 4, none).showEverything).toBe(false)
    expect(migrateSettings({ showEverything: true }, 4, none).showEverything).toBe(true)
    expect(migrateSettings({ showEverything: 'yes' }, 4, none).showEverything).toBe(false)
  })

  it('a player who played before the new tips has met their ideas: v3 → v4 marks them taught', () => {
    const played = () => JSON.stringify({ state: { stats: { runsCompleted: 3 } }, version: 4 })
    const fresh = () => JSON.stringify({ state: { stats: { runsCompleted: 0 } }, version: 4 })
    const old = { taught: { deploy: true, gold: true } }
    const returning = migrateSettings(old, 3, played).taught
    for (const id of LS3_TEACH_IDS) expect(returning[id]).toBe(true)
    expect(returning.deploy).toBe(true)
    // A v3 payload from someone who never finished a run keeps every new tip.
    const newcomer = migrateSettings(old, 3, fresh).taught
    for (const id of LS3_TEACH_IDS) expect(newcomer[id]).toBe(false)
    // Corrupt meta never throws and never mutes anything.
    for (const id of LS3_TEACH_IDS) expect(migrateSettings(old, 3, () => '{not json').taught[id]).toBe(false)
    // Not on a same-version load: "Show the tips again" must stick.
    for (const id of LS3_TEACH_IDS) expect(migrateSettings({}, 4, played).taught[id]).toBe(false)
    // Only known tips: the retired `gold` is dropped.
    expect(Object.keys(returning).sort()).toEqual([...TEACH_IDS].sort())
  })

  it('the run snapshot keeps `firstRun`; only a literal true stages a resumed run', () => {
    useMetaStore.getState().resetMeta()
    useGameStore.getState().newRun()
    useGameStore.getState().pickStartingHero('fighter')
    const st = useGameStore.getState()
    const snap = captureRun(st, { rngLoot: 1, rngMap: 2, lootPity: 0, idCounter: 1, nameCounters: {} as never })
    expect(snap.firstRun).toBe(true)
    const raw = JSON.parse(JSON.stringify(snap))
    expect(migrateSnapshot(raw)?.firstRun).toBe(true)
    for (const bad of [undefined, 'true', 1, null, {}]) {
      expect(migrateSnapshot({ ...raw, firstRun: bad })?.firstRun).toBe(false)
    }
    // A save from before staging (no field at all) resumes unstaged.
    const { firstRun: _, ...older } = raw
    expect(migrateSnapshot({ ...older, v: RUN_SNAPSHOT_VERSION })?.firstRun).toBe(false)
    useGameStore.getState().resumeRun(migrateSnapshot({ ...older, v: RUN_SNAPSHOT_VERSION })!)
    expect(useGameStore.getState().firstRun).toBe(false)
  })
})

describe('one tip per new idea (the coach)', () => {
  const none = Object.fromEntries(TEACH_IDS.map((id) => [id, false])) as TipFacts['taught']
  const facts = (patch: Partial<TipFacts> = {}): TipFacts => ({
    taught: none,
    inSetup: false,
    deployed: 0,
    packCount: 0,
    wearingAnything: true,
    showThreat: false,
    threat: 1,
    danger: false,
    elite: false,
    relicOffered: false,
    subwave: false,
    speed: false,
    gear: false,
    merchant: false,
    ...patch,
  })

  it('the first battle says one thing: post a hero', () => {
    expect(pickTipId(facts({ inSetup: true }))).toBe('deploy')
  })

  it('every staged idea has its tip, the first time it is on screen', () => {
    const cases: [Partial<TipFacts>, string][] = [
      [{ subwave: true }, 'subwave'],
      [{ speed: true }, 'speed'],
      [{ gear: true }, 'gear'],
      [{ command: { name: 'Rally Horn', blurb: 'Your heroes attack 40% faster for 8s' } }, 'command'],
      [{ showThreat: true, threat: 1.12 }, 'threat'],
      [{ depth: { depth: 1, last: 12 } }, 'depth'],
      [{ merchant: true }, 'merchant'],
      [{ elite: true }, 'relic'],
      [{ relicOffered: true }, 'relic'],
      [{ owesSkill: 'Doyle' }, 'skill'],
      [{ danger: true }, 'danger'],
      [{ challenge: { name: 'Wildfire', blurb: 'Patches of the field are burning.' } }, 'challenge'],
    ]
    for (const [patch, id] of cases) expect(pickTipId(facts(patch))).toBe(id)
  })

  it('then never again: a taught idea stays quiet', () => {
    const taught = Object.fromEntries(TEACH_IDS.map((id) => [id, true])) as TipFacts['taught']
    const everything = facts({
      taught,
      inSetup: true,
      subwave: true,
      speed: true,
      gear: true,
      merchant: true,
      elite: true,
      danger: true,
      showThreat: true,
      threat: 1.2,
      owesSkill: 'Doyle',
      depth: { depth: 2, last: 12 },
    })
    expect(pickTipId(everything)).toBeNull()
  })

  it('one at a time: when several are due, the most urgent wins', () => {
    // Depth 3 on a first run can bring an elite and cursed ground together.
    expect(pickTipId(facts({ inSetup: true, deployed: 1, elite: true, danger: true }))).toBe('danger')
    // The first win's reward: the gear lesson before the enemy-strength one.
    expect(pickTipId(facts({ gear: true, showThreat: true, threat: 1.12 }))).toBe('gear')
  })

  // Oct 2026 audit, 2.5: a tip never moves the Stage during a live wave.
  it('a tip that comes due mid-wave waits for the wave to end', () => {
    // Enemy strength rises mid-run; during a live wave it waits…
    expect(pickTipId(facts({ live: true, showThreat: true, threat: 1.12 }))).toBeNull()
    // …and speaks at the next non-live moment.
    expect(pickTipId(facts({ live: false, showThreat: true, threat: 1.12 }))).toBe('threat')
    // The breather lessons wait too, unless the row was held open for the wave…
    expect(pickTipId(facts({ live: true, subwave: true }))).toBeNull()
    expect(pickTipId(facts({ live: true, rowHeld: true, subwave: true }))).toBe('subwave')
    expect(pickTipId(facts({ live: true, rowHeld: true, speed: true }))).toBe('speed')
    // …and a held row is still only theirs: nothing else jumps the wave.
    expect(pickTipId(facts({ live: true, rowHeld: true, gear: true, showThreat: true, threat: 1.2 }))).toBeNull()
  })

  it('the row is held open for a whole wave only while a breather lesson is still to teach', () => {
    const t = (subwave: boolean, speed: boolean) => ({ subwave, speed })
    expect(holdCoachRow({ taught: t(false, false), subWaves: 2 })).toBe(true)
    expect(holdCoachRow({ taught: t(true, false), subWaves: 3 })).toBe(true)
    expect(holdCoachRow({ taught: t(true, true), subWaves: 3 })).toBe(false)
    // A wave with no breather has nothing to teach there.
    expect(holdCoachRow({ taught: t(false, false), subWaves: 1 })).toBe(false)
  })
})

describe('the glossary', () => {
  it('has one line per idea, in the one name', () => {
    for (const id of IDEAS) {
      expect(GLOSSARY[id].term.length).toBeGreaterThan(0)
      expect(GLOSSARY[id].line).not.toMatch(/Threat ×|Sentinel|whole company/)
    }
  })

  it('a first-timer’s glossary lists only what they have met; a returning player’s lists all', () => {
    const first = glossaryOffer({ met: ['gear'], staged: true })
    const lines = first.body as string[]
    expect(lines.some((l) => l.startsWith('Gear and pack'))).toBe(true)
    expect(lines.some((l) => l.startsWith('Relic'))).toBe(false)
    expect(lines.at(-1)).toMatch(/more to meet on the road/)
    const all = glossaryOffer({ met: [], staged: false }).body as string[]
    // One line per idea, plus the extra lines an idea carries (SK1: Skill
    // level and the Collection ride with Skill).
    expect(all).toHaveLength(IDEAS.length + IDEAS.reduce((n, id) => n + (GLOSSARY[id].also?.length ?? 0), 0))
    // The mercenary company's terms, each in its one name.
    for (const term of ['Skill —', 'Skill level —', 'Gold —', 'Purse —', 'Bank —', 'Standing —', 'Contract —', 'Escort —', 'Cargo —', 'City —', 'Stake —'])
      expect(all.some((l) => l.startsWith(term)), term).toBe(true)
  })
})

beforeEach(() => {
  useSettingsStore.setState({ showEverything: false })
})
