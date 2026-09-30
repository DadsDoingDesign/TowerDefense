/**
 * Run slice: starting, re-dealing, resuming and leaving a run, and walking the
 * run map (`selectNode`).
 */
import { newRunSeed, restoreIdCounter, streamRng } from '../../game/core/rng'
import { startingKit, wearKit } from '../../game/engine/kit'
import { createSentinel, restoreNameCounters } from '../../game/data/sentinels'
import type { RarityPity } from '../../game/data/items'
import { rollShrine } from '../../game/data/shrines'
import { nodeEncounter } from '../../game/data/waves'
import { GATE_REPAIR, merchantLuck, MAX_ROSTER, RECRUIT_PRICE, rollMerchantShelf } from '../../game/run/economy'
import { carryPlacements, encounterNode } from '../../game/run/map'
import { nodeTerrainRule } from '../../game/run/terrain'
import { shelfSize } from '../../game/run/relics'
import { freshFeats } from '../../game/run/settle'
import { applyStatBonus, hubExtras, receiveItems, recruitSlate, RECRUIT_ARCHETYPES, scaledRecruit } from '../../game/run/recruits'
import type { Archetype, Placement } from '../../game/types'
import { sfx } from '../../audio/audio'
import { bannerRules, MAX_BANNER, useMetaStore } from '../metaStore'
import { dailySeed, parseSeed, STANDARD_RUN, utcDateKey, type RunChallenge } from '../daily'
import { snapshotBattleMap, snapshotShrine, type RunSnapshot } from '../runSnapshot'
import { CLEAR_SHELL, dealRunMap, freshHud, freshRunState, leaveToHub } from './fresh'
import { clearBeatTimer, hub, layout, recruitHub, runBonuses, seedRunStreams, streams, usesHub } from './runtime'
import { fieldFor, fieldIdOf, orientField } from '../../game/data/maps'
import { settleSavedRun } from './settle'
import type { Slice } from './types'

export interface RunActions {
  newRun: () => void
  /** Start a campaign on a given seed (the one door `newRun`, the Daily and custom seeds share). */
  beginCampaign: (runSeed: number, challenge: RunChallenge) => void
  /** Today's Daily Watch: the UTC day's shared seed, standard rules. */
  startDaily: () => void
  /**
   * Re-deal the run being set up from a typed seed (hero-pick only, before a
   * hero is committed). Returns false when refused or the text is empty.
   */
  reseedRun: (input: string) => boolean
  /**
   * Choose the Banner for the run being set up. Only legal on the hero-pick
   * screen — a Banner is a bet you place before the first node, never a switch
   * you flip mid-run — and it re-deals the map, because Banners 1 and 4 change
   * which stops exist on it.
   */
  setRunBanner: (tier: number) => void
  /** Start another run from the end screen, same Banner (M15). */
  runAgain: () => void
  pickStartingHero: (archetype: Archetype) => void
  returnToHub: () => void
  selectNode: (nodeId: string) => void
  /**
   * Put a persisted run back in play (C3). A mid-battle snapshot resumes at that
   * node's SETUP phase — a half-fought wave is not a save point.
   */
  resumeRun: (snap: RunSnapshot) => void
  /** Walk away from the persisted run without resuming it. */
  discardSavedRun: () => void
}

export const createRunSlice: Slice<RunActions> = (set, get) => ({
  newRun: () => get().beginCampaign(newRunSeed(), STANDARD_RUN),

  beginCampaign: (runSeed, challenge) => {
    // Starting a run destroys any saved one. Settle it first — the marks it
    // earned are the player's either way (M-2).
    settleSavedRun(get, set)
    // A Daily Watch reads no hub at all (standard rules), so the same seed
    // deals the same map, waves and offers on every save.
    hub.runUsesHub = usesHub(challenge)
    const b = runBonuses()
    // One seed per run, then every stream (map/loot/combat) hangs off it.
    seedRunStreams(runSeed)
    set({
      ...freshRunState(runSeed),
      mode: 'campaign',
      runSeed,
      challenge,
      screen: 'heroPick',
      roster: [],
      gold: b.startGold,
      baseHp: b.maxBaseHp,
      maxBaseHp: b.maxBaseHp,
      enemyHpMult: b.enemyHpMult,
      // The kit is dealt in `pickStartingHero`, FOR the hero picked there.
      inventory: [],
    })
  },

  startDaily: () => {
    const date = utcDateKey()
    // Whether this is the day's scored attempt is decided when a hero is
    // committed (`pickStartingHero`), not here: looking at today's map and
    // backing out costs nothing, but a run that has begun is the attempt.
    get().beginCampaign(dailySeed(date), { kind: 'daily', date, scored: false })
  },

  reseedRun: (input) => {
    const st = get()
    if (st.screen !== 'heroPick' || st.mode !== 'campaign' || st.roster.length) return false
    const seed = parseSeed(input)
    if (seed === null) return false
    const banner = st.challenge.kind === 'daily' ? 0 : st.runBanner
    get().beginCampaign(seed, { kind: 'seeded', date: null, scored: false })
    if (banner > 0) get().setRunBanner(banner)
    return true
  },

  setRunBanner: (tier) => {
    const st = get()
    // A Banner is chosen before the march, never during it — and never on a
    // Daily Watch, which is one set of rules for everyone.
    if (st.screen !== 'heroPick' || st.mode !== 'campaign' || st.challenge.kind === 'daily') return
    const unlocked = useMetaStore.getState().sacrificeTier
    const next = Math.max(0, Math.min(Math.min(MAX_BANNER, unlocked), Math.floor(tier)))
    if (next === st.runBanner) return
    const rules = bannerRules(next)
    // Re-deal the map from the SAME run seed: Banner 1 removes merchants and
    // Banner 4 removes recruiters, so the map is a function of the Banner. The
    // map stream is rewound rather than advanced, so switching Banners back and
    // forth cannot be used to reroll the map.
    streams.mapRng = streamRng(st.runSeed, 'map')
    set({ runBanner: next, threat: rules.startThreat, ...dealRunMap(rules) })
    sfx('confirm')
  },

  runAgain: () => {
    // The end screen's second door (M15). Three taps through the hub is not a
    // "one more run" loop; this is. The Banner carries over, so a run you
    // just lost under Banner 2 is retried under Banner 2.
    const { runBanner: banner, challenge, runSeed } = get()
    // A Daily is retried as today's Daily (practice once the attempt is
    // spent); a custom seed replays the same seed.
    if (challenge.kind === 'daily') return get().startDaily()
    if (challenge.kind === 'seeded') get().beginCampaign(runSeed, challenge)
    else get().newRun()
    if (banner > 0) get().setRunBanner(banner)
  },

  pickStartingHero: (archetype) => {
    const st = get()
    // Once per run: a second pick would re-deal the kit off the loot stream.
    if (st.screen !== 'heroPick' || st.mode !== 'campaign' || st.roster.length) return
    const b = runBonuses()
    // Committing a hero to today's Daily claims the day's scored attempt —
    // or finds it already claimed, and the run is practice.
    const challenge =
      st.challenge.kind === 'daily' && st.challenge.date
        ? { ...st.challenge, scored: useMetaStore.getState().beginDaily(st.challenge.date) }
        : st.challenge
    // The hub's extras are armed BEFORE the leader is created (id / name order).
    const extra = hubExtras(streams.rng, b.extraSentinels)
    const company = [createSentinel(archetype), ...extra].map((s) => applyStatBonus(s, b.statBonus))
    // The opening kit is dealt NOW, for the hero just picked — a Mystic is
    // not handed a Sword — and WORN, not left in the pack. The balance
    // harness calls the same two functions (`engine/kit.ts`), so the run it
    // grades is the run this deals.
    const kit = startingKit(streams.rng, archetype, { extra: b.extraItems, roster: company })
    const leader = wearKit(company[0], kit)
    const worn = new Set([leader.equipment.mainHand, leader.equipment.offHand, leader.equipment.body].map((i) => i?.id))
    const { roster, inventory } = receiveItems([leader, ...company.slice(1)], st.inventory, kit.filter((i) => !worn.has(i.id)))
    // The feats ledger starts here, with the company as it marches out.
    const feats = { ...freshFeats(), starter: archetype, startSize: roster.length, goldPeak: get().gold }
    useMetaStore.getState().recordCodex({ specs: [...new Set(roster.flatMap((s) => s.branchPath))] })
    set({ roster, inventory, challenge, screen: 'map', feats })
  },

  // Leaving for the Watchtower ends the run, so it settles like any other end.
  // This IS a mid-run quit — the shell's fallback escape offer dispatches it
  // (ui/shell/offers.ts) — so the run has to be destroyed here, not merely
  // paid. `settleSavedRun` retires it (M-1); the rest tears down the live
  // battle so nothing is left pointing at a run that no longer exists.
  returnToHub: () => {
    settleSavedRun(get, set)
    set(leaveToHub())
  },

  // ---- run snapshot (C3) ----
  resumeRun: (snap) => {
    // A resume replaces the whole run, `waveBeat` included, so any hold still
    // outstanding from the session's previous run goes with it (F6).
    clearBeatTimer()
    hub.runUsesHub = snap.mode === 'endless' || usesHub(snap.challenge)
    // Rebuild the seeded streams, then fast-forward each to where the run had
    // got to — a resume must not re-deal loot the player already saw.
    seedRunStreams(snap.runSeed)
    if (snap.rngLoot !== null) streams.rng.loadState(snap.rngLoot)
    if (snap.rngMap !== null) streams.mapRng.loadState(snap.rngMap)
    // The dry counter is restored WITH the loot stream, never without it: the
    // next drop is a function of both, so rewinding one alone resumes into a
    // sequence the interrupted run would never have dealt (M9).
    const lootPity: RarityPity = { dry: snap.lootPity }
    // The process-global counters move HERE, when the run really comes back —
    // not when the save is merely loaded to be peeked at or settled.
    restoreIdCounter(snap.idCounter)
    restoreNameCounters(snap.nameCounters)

    const battleMap = snapshotBattleMap(snap)
    // Only open tiles of the field the battle resumes on, each hero once, at
    // most a full company (G1-2) — whatever the payload claims.
    const rosterIds = new Set(snap.roster.map((s) => s.id))
    const placements: Placement = carryPlacements(snap.placements ?? {}, battleMap, (id) => rosterIds.has(id), MAX_ROSTER)

    // Which side of the wave was the snapshot taken on? (C-1)
    //
    // `lastResult` is the only honest answer, and it is why it is part of the
    // snapshot. A resolved wave has ALREADY moved the run on — node cleared,
    // threat compounded, gold and XP paid, a reward dealt — so it must restore
    // onto the summary, never onto a pre-battle setup screen that would offer
    // the cleared wave up to be fought (and paid) again.
    const resolved = snap.lastResult !== null
    const enemiesTotal = snap.currentWave?.spawns.length ?? 0
    const hud = {
      ...freshHud(),
      baseHp: snap.baseHp,
      maxBaseHp: snap.maxBaseHp,
      enemiesTotal,
      // A resolved wave reads as finished, not as one still to be fought.
      enemiesSpawned: resolved ? enemiesTotal : 0,
      goldEarned: resolved ? (snap.lastResult?.goldEarned ?? 0) : 0,
    }

    set({
      mode: snap.mode,
      runSeed: snap.runSeed,
      screen: snap.screen,
      runPhase: snap.runPhase,
      // A snapshot only ever exists for a run that was NOT settled, so taking
      // one up un-retires this session (M-1).
      runSettled: false,
      runMap: snap.runMap,
      currentNodeId: snap.currentNodeId,
      clearedNodeIds: snap.clearedNodeIds,
      reachableNodeIds: snap.reachableNodeIds,
      event: snap.event,
      battleMap,
      roster: snap.roster,
      placements,
      gold: snap.gold,
      baseHp: snap.baseHp,
      maxBaseHp: snap.maxBaseHp,
      enemyHpMult: snap.enemyHpMult,
      threat: snap.threat,
      inventory: snap.inventory,
      runKills: snap.runKills,
      runDowns: snap.runDowns,
      marksEarned: snap.marksEarned,
      lootPity,
      activeNodeId: snap.activeNodeId,
      currentWave: snap.currentWave,
      tactics: snap.tactics,
      merchant: snap.merchant,
      shrineOffer: snapshotShrine(snap),
      recruitOptions: snap.recruitOptions,
      reward: snap.reward,
      runMods: snap.runMods,
      relics: snap.relics,
      feats: snap.feats,
      crossroads: snap.crossroads,
      forkDone: snap.forkDone,
      evolutionQueue: snap.evolutionQueue,
      dust: snap.dust,
      lives: snap.lives,
      wins: snap.wins,
      round: snap.round,
      endlessRecruitCost: snap.endlessRecruitCost,
      endlessRoom: snap.endlessRoom,
      // The engine is deliberately NOT restored: a wave interrupted MID-fight
      // resumes from its setup phase, fully re-fightable, rather than from a
      // half-simulated state that would be neither the player's win nor their
      // loss. A wave that had already RESOLVED is a different thing entirely
      // and must not be re-offered — see `resolved` above.
      engine: null,
      battlePhase: 'setup',
      speed: 1,
      hud,
      lastResult: snap.lastResult,
      lastLoot: snap.lastLoot,
      // A resumed run never lands mid-beat: the beat is presentation, it is
      // not snapshotted, and whatever it was holding was settled before the
      // snapshot was written (see `installRunPersistence`).
      waveBeat: null,
      // Clamped to the ladder by the migration, and clamped again HERE to what
      // this save has actually opened (F8) — the bypass `setRunBanner` refuses
      // must not arrive through the back door. Downwards only: a resume may
      // never grant a rung, and it may never quietly raise the difficulty of
      // the run the player left.
      runBanner: snap.challenge.kind === 'daily' ? 0 : Math.min(snap.runBanner, useMetaStore.getState().sacrificeTier),
      challenge: snap.challenge,
      // A snapshot only ever exists for a LIVE run, so there is no recap to
      // restore — and leaving a stale one would show the last run's receipt
      // over this one's first node.
      victory: null,
      selectedSentinelId: null,
      ...CLEAR_SHELL,
    })
  },

  // Walking away from an interrupted run still SETTLES it. Losing the run to
  // a backgrounded tab must not also cost the player the marks they earned —
  // that was the second half of C3, and it is why this pays out rather than
  // just deleting the key.
  discardSavedRun: () => {
    settleSavedRun(get, set)
    set(leaveToHub())
  },

  selectNode: (nodeId) => {
    const { reachableNodeIds, clearedNodeIds, runMap, roster, runBanner, lootPity, event } = get()
    const banner = bannerRules(runBanner)
    if (!reachableNodeIds.includes(nodeId)) return
    // A cleared node is done, whatever `reachableNodeIds` says. Reachability
    // is derived state and a bad snapshot can hand us a set that overlaps the
    // cleared list; entering a cleared battle node from there lands on a
    // battle screen whose only control — Start Wave — the store refuses (M-3).
    if (clearedNodeIds.includes(nodeId)) return
    const node = runMap.nodes.find((n) => n.id === nodeId)
    if (!node) return

    // ---- a parked event is never left live behind you (F1) ---------------
    //
    // Tapping a special sets `event` and leaves the player on the map. If a tap
    // elsewhere left that event standing, a later `leaveEvent` / `acceptRecruit`
    // / `declineShrine` would `completeNode` a node the company is no longer on
    // — marching the marker backwards and charging the special step twice.
    //
    // The guard goes on the ACTION, not on the screen covering it (same as the
    // crossroads fork, F2). Re-tapping the open event's node is a no-op — it
    // must never re-enter the branches below, which would re-roll the
    // merchant's stock for free. Tapping ANOTHER node forfeits the special: it
    // is not cleared, it charges nothing, and its offers die with it.
    if (event) {
      if (event.nodeId === nodeId) return
      set({ event: null, merchant: null, shrineOffer: null, recruitOptions: [] })
    }

    if (node.type === 'merchant') {
      // An OFFER: `rollMerchantShelf` rolls with the drought's luck but leaves
      // the pity counter alone; `buyMerchantItem` charges it on the sale (F4).
      const relics = get().relics
      const items = rollMerchantShelf(streams.rng, { luck: merchantLuck(node.layer), roster, pity: lootPity, size: shelfSize(relics, banner.thinPickings) })
      const recruit =
        roster.length < MAX_ROSTER && !banner.noRecruits
          ? { sentinel: scaledRecruit(streams.rng, streams.rng.pick(RECRUIT_ARCHETYPES), roster, recruitHub(relics)), price: RECRUIT_PRICE }
          : null
      // The Gate repair is on every campaign counter (Phase 3b): the comeback.
      set({ event: { kind: 'merchant', nodeId }, merchant: { items, recruit, repair: { ...GATE_REPAIR }, rerolls: 0 } })
      return
    }
    if (node.type === 'campfire') {
      // Nothing is rolled: a campfire is the same two choices every time.
      set({ event: { kind: 'campfire', nodeId } })
      return
    }
    if (node.type === 'shrine') {
      set({ event: { kind: 'shrine', nodeId }, shrineOffer: rollShrine(streams.rng) })
      return
    }
    if (node.type === 'recruit') {
      set({ event: { kind: 'recruit', nodeId }, recruitOptions: recruitSlate(streams.rng, roster, recruitHub(get().relics)) })
      return
    }

    // Battle / elite / boss.
    //
    // The composition variant is seeded on (run seed, layer, row), so the node
    // keeps the wave it was dealt across a save/resume, and two battle nodes
    // standing in the same layer are two different fights rather than one
    // fight offered twice (WS8).
    // A Vow-made elite (Elite Watch) is drawn `eliteDepth` deeper; an elite
    // the MAP dealt stays at its own depth. `nodeEncounter` is the one
    // derivation — the map's preview reads the same one.
    const wave = nodeEncounter(encounterNode(node), get().runSeed, banner)!
    const { baseHp, maxBaseHp } = get()
    // The battle's orientation is chosen HERE, once, from the layout the
    // player is holding (Portrait battlefields) — the field identity is the
    // run's seeded one; only which twin is fought on changes. Its map challenge
    // (G1-2) is the node's own, the same one the preview named.
    const battleMap =
      fieldFor(fieldIdOf(get().battleMap), nodeTerrainRule(node, get().runSeed), layout.orientation()) ??
      orientField(get().battleMap, layout.orientation())
    set({
      activeNodeId: nodeId,
      currentWave: wave,
      battleMap,
      // A hero posted on a tile this field blocks goes back to the bench.
      placements: carryPlacements(get().placements, battleMap, (id) => roster.some((h) => h.id === id), MAX_ROSTER),
      battlePhase: 'setup',
      screen: 'battle',
      selectedSentinelId: null,
      lastResult: null,
      lastLoot: [],
      hud: { ...freshHud(), baseHp, maxBaseHp, enemiesTotal: wave.spawns.length },
      ...CLEAR_SHELL,
    })
  },
})
