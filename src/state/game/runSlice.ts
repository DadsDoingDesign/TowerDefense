/**
 * Run slice: starting, re-dealing, resuming and leaving a run, and walking the
 * run map (`selectNode`). A run is a contract (the mercenary company): it
 * begins from the contract board (`contractSlice`), with a company and a stake,
 * and the bank pays the stake when the hero is committed. The purse is the
 * company's advance (`contracts.ADVANCE`): it never leaves the bank.
 */
import { newRunSeed, restoreIdCounter, streamRng } from '../../game/core/rng'
import { restoreNameCounters } from '../../game/data/sentinels'
import type { RarityPity } from '../../game/data/items'
import { rollShrine } from '../../game/data/shrines'
import { nodeEncounter } from '../../game/data/waves'
import { GATE_REPAIR, merchantLuck, MAX_ROSTER, RECRUIT_PRICE, rollMerchantShelf } from '../../game/run/economy'
import { carryPlacements, emptyPlacements, encounterNode } from '../../game/run/map'
import { groundFor } from '../../game/run/fields'
import { nodeHazardSeed, nodeTerrainRule, type GroundOpts } from '../../game/run/terrain'
import { stageFirstRunMap } from '../../game/run/firstRun'
import { startsFirstRun } from '../staging'
import { useSettingsStore } from '../settingsStore'
import { shelfSize } from '../../game/run/relics'
import { freshFeats } from '../../game/run/settle'
import { gearReturnedText } from '../../game/run/inventory'
import { hubExtras, recruitSlate, scaledRecruit } from '../../game/run/recruits'
import { bonusItemsFor } from '../../game/run/hq'
import { soldText, stow } from '../../game/run/inventory'
import { chosenHero, resolvePick } from '../../game/run/heroes'
import { heroStyle } from '../../game/data/items'
import { companyById, type CompanyId } from '../../game/data/companies'
import { encounterRulesOf, priceMultOf, routePrice } from '../../game/run/charter'
import { contractRules, earn, freshContract, marketFor, marketOpen, signingCost, utcDateKey, type RunContract } from '../../game/run/contracts'
import type { Placement } from '../../game/types'
import { useMetaStore } from '../metaStore'
import { parseSeed, SEEDED_RUN, STANDARD_RUN, type RunChallenge } from '../seeds'
import { seedEditable } from '../runTerms'
import { clearSnapshot, snapshotBattleMap, snapshotShrine, type RunSnapshot } from '../runSnapshot'
import { CLEAR_SHELL, dealRunMap, freshHud, freshRunState, leaveToHub } from './fresh'
import { clearBeatTimer, dealSkill, layout, recruitHub, runBonuses, seedRunStreams, session, skillRun, startingItemPool, startingSkillPool, streams } from './runtime'
import { fieldFor, fieldIdOf, orientField } from '../../game/data/maps'
import { settleSavedRun } from './settle'
import type { Slice } from './types'

/** What a contract is signed on, before the run deals anything from it. */
export interface ContractOrder {
  /** The company whose road it is; null on the Sovereign Route. */
  company: CompanyId | null
  crates: number
  /** The Sovereign Route (the endgame charter, `run/charter.ts`). */
  charter?: boolean
}

/**
 * The route's ground, for every terrain read of this run (the node, the
 * preview, the harness): its company's, or — on the Sovereign Route — every
 * company's on every field.
 */
export const groundOf = (s: { contract: Pick<RunContract, 'company' | 'charter'> | null; firstRun: boolean }): GroundOpts => ({
  firstRun: s.firstRun,
  ...(s.contract?.charter ? { charter: true } : s.contract?.company ? { ground: companyById(s.contract.company).ground.rules } : {}),
})

/**
 * The contract a run begins on when none is named: an escort on Rosethread's
 * road, whose ground is the open ground every road used to share — the dev
 * handle's quick start (`newRun`) and the store tests' default.
 */
export const QUICK_ORDER: ContractOrder = { company: 'silk', crates: 0 }

export interface RunActions {
  /** A quick start (dev handle, tests): {@link QUICK_ORDER} on a fresh seed, straight to the hero pick. */
  newRun: () => void
  /**
   * Start a contract run on a given seed: the one door the contract board,
   * a first-timer's free escort and a typed seed share. The bank is not
   * touched until the hero is committed (`pickStartingHero`).
   */
  beginCampaign: (runSeed: number, challenge: RunChallenge, order?: ContractOrder) => void
  /**
   * Re-deal the run being set up from a typed seed (hero-pick only, before a
   * hero is committed), on the same contract terms. Returns false when refused
   * or the text is empty.
   */
  reseedRun: (input: string) => boolean
  /** The way back from a typed seed: a fresh random seed, same terms. */
  randomizeRunSeed: () => boolean
  /** Take another contract from the end screen: back to the board, the last terms set. */
  runAgain: () => void
  /**
   * Commit the hero pick: one of the three random heroes the pick deals
   * (`pick-0` … `pick-2`). This signs the contract: the bank pays the stake,
   * and the company's advance becomes the run's gold.
   */
  pickStartingHero: (choiceId: string) => void
  returnToHub: () => void
  /**
   * Back out of the hero pick before any hero is committed. Nothing has begun:
   * no payout, no finished run on the record, and nothing taken from the bank.
   * Back to the contract's terms (a first-timer's to the menu).
   */
  cancelHeroPick: () => void
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

  beginCampaign: (runSeed, challenge, order = QUICK_ORDER) => {
    // Starting a run destroys any saved one. Settle it first — what it earned
    // is the player's either way (M-2).
    settleSavedRun(get, set)
    const b = runBonuses()
    // One seed per run, then every stream (map/loot/combat) hangs off it.
    seedRunStreams(runSeed)
    // LS3: a first run is staged. Decided here, once, and kept by the snapshot.
    const firstRun = startsFirstRun(useMetaStore.getState().stats, useSettingsStore.getState().showEverything)
    const fresh = freshRunState(runSeed)
    // The contract: its market is locked now, so crossing midnight mid-run
    // changes nothing it pays.
    // The HQ's terms for this run (pack slots, cleared boulders, company focus)
    // are frozen on the contract now; its paid orders are spent at signing.
    const hq = useMetaStore.getState().runHq()
    const charter = !!order.charter
    // The market of the day pays from the fifth finished contract (the
    // staggered reveal); before that every contract signs at 1.
    const market = !charter && (marketOpen(useMetaStore.getState().stats.runsCompleted) || useSettingsStore.getState().showEverything) ? marketFor(order.company, utcDateKey()) : 1
    const contract = freshContract(
      { company: charter ? null : order.company, crates: order.crates, market, ...(charter ? { charter } : {}) },
      // The Sovereign Route deals for no company: no HQ focus either.
      charter ? { ...hq, focus: null, boost: 0 } : hq,
    )
    // The stake is the run's difficulty step: re-deal the map from the same
    // seed with its elites (a hash of the seed, never a draw — the map stream
    // is rewound, so an escort deals exactly the map an unstaked run did).
    const rules = contractRules(contract)
    streams.mapRng = streamRng(runSeed, 'map')
    const dealt = dealRunMap(rules, runSeed)
    // SK1: the run's pools are read once, here, weighted to the company.
    const focus = { company: contract.hq.focus, boost: contract.hq.boost }
    const skillPool = startingSkillPool(contract.company, focus)
    const itemPool = startingItemPool(contract.company, focus)
    skillRun.seed = runSeed
    skillRun.pool = skillPool
    skillRun.items = itemPool
    set({
      ...fresh,
      ...dealt,
      // The map is post-processed, never re-dealt: no stream moves (LS3).
      runMap: stageFirstRunMap(dealt.runMap, firstRun),
      threat: rules.startThreat,
      firstRun,
      runSeed,
      challenge,
      contract,
      board: null,
      screen: 'heroPick',
      roster: [],
      // The company's advance shows on the hero pick; it is never the bank's.
      gold: contract.purse,
      baseHp: b.maxBaseHp,
      maxBaseHp: b.maxBaseHp,
      enemyHpMult: b.enemyHpMult,
      // The kit is dealt in `pickStartingHero`, FOR the hero picked there.
      inventory: [],
      skillPool,
      itemPool,
    })
  },

  reseedRun: (input) => {
    const st = get()
    // The Sovereign Route is never played on a chosen seed (`runTerms.seedEditable`).
    if (st.screen !== 'heroPick' || st.roster.length || !st.contract || !seedEditable(st.challenge, !!st.contract.charter)) return false
    const seed = parseSeed(input)
    if (seed === null) return false
    const { company, crates } = st.contract
    get().beginCampaign(seed, SEEDED_RUN, { company, crates })
    return true
  },

  randomizeRunSeed: () => {
    const st = get()
    if (st.screen !== 'heroPick' || st.roster.length || !st.contract || !seedEditable(st.challenge)) return false
    const { company, crates, charter } = st.contract
    get().beginCampaign(newRunSeed(), STANDARD_RUN, { company, crates, ...(charter ? { charter } : {}) })
    return true
  },

  runAgain: () => {
    // The end screen's second door (M15): back to the board with the last
    // contract's terms set, one tap from signing another.
    const last = get().contract
    // After a Sovereign Route, the board opens on its default company.
    get().openContracts(last?.company ? { company: last.company, crates: last.crates } : undefined)
  },

  pickStartingHero: (choiceId) => {
    const st = get()
    // Once per run: a second pick would re-deal the extras off the loot stream.
    if (st.screen !== 'heroPick' || st.roster.length || !st.contract) return
    const b = runBonuses()
    // Signing: the bank pays the stake (or the charter's fee). The purse is
    // the company's advance and leaves the bank untouched. A contract an older
    // save set up before the advance still takes its purse from the bank, as
    // it was set — shrunk to what is left; a stake the bank cannot cover
    // refuses (it changed in another tab since the terms were set).
    const meta = useMetaStore.getState()
    const stake = signingCost({ ...st.contract, purse: 0 })
    if (meta.bank < stake) return
    const purse = st.contract.advance ? st.contract.purse : Math.min(st.contract.purse, Math.max(0, meta.bank - stake))
    const taken = signingCost({ ...st.contract, purse })
    if (!meta.withdraw(taken)) return
    const contract: RunContract = { ...st.contract, purse, signed: true }
    // The leader is the card the player chose — re-dealt off the same hashed
    // generator the card was, with real ids, under the HQ's Opening deal. No
    // run stream moves for it.
    const leader = chosenHero(st.runSeed, st.skillPool, st.itemPool, resolvePick(st.runSeed, st.skillPool, st.itemPool, choiceId, b.deal), 0, b.deal)
    if (!leader) {
      meta.deposit(taken)
      return
    }
    // The Opening deal's second hero: a random hire off the loot stream, named
    // apart from the leader.
    const extra = hubExtras(streams.rng, b.extraSentinels, dealSkill, st.itemPool, [leader.name])
    const company = [leader, ...extra]
    // Signing spends the HQ's orders (they are already on the contract's
    // terms) and hands over the bonus items a sealed crate's duplicate owed:
    // Rare pieces off their own hashed generator, into the pack.
    const owed = meta.takeOrders()
    const got = stow(st.inventory, bonusItemsFor(st.runSeed, owed.bonusItems), contract.hq.pack)
    const roster = company
    const inventory = got.inventory
    const gold = purse + got.gold
    // The feats ledger starts here, with the heroes as they march out.
    const feats = { ...freshFeats(), starter: heroStyle(leader), startSize: roster.length, goldPeak: gold }
    set({ roster, inventory, contract: earn(contract, got.gold), gold, screen: 'map', feats, ...(got.sold.length ? { gearNotice: { text: soldText(got.sold, got.gold), at: Date.now() } } : {}) })
    // SK1: the hero pick's tip ("Each hero comes with a skill") has been read.
    useSettingsStore.getState().markTaught('heroSkill')
    useSettingsStore.getState().markTaught('heroGear')
  },

  // Leaving for the menu ends the run, so it settles like any other end: a
  // fall — the cities' pay and the road's share come home, unsold crates are lost.
  returnToHub: () => {
    settleSavedRun(get, set)
    set(leaveToHub())
  },

  cancelHeroPick: () => {
    const st = get()
    if (st.screen !== 'heroPick' || st.roster.length) return
    // `beginCampaign` already settled whatever run came before; this one never
    // started and took nothing from the bank, so it is dropped, not settled.
    clearSnapshot()
    session.ownsRun = false
    const c = st.contract
    set(leaveToHub())
    // Back to the terms it came from — a first-timer's free escort has none,
    // and the Sovereign Route's are on the menu's charter page.
    if (c?.company && !st.firstRun) get().openContracts({ company: c.company, crates: c.crates }, 'terms')
  },

  // ---- run snapshot (C3) ----
  resumeRun: (snap) => {
    // A resume replaces the whole run, `waveBeat` included, so any hold still
    // outstanding from the session's previous run goes with it (F6).
    clearBeatTimer()
    // Rebuild the seeded streams, then fast-forward each to where the run had
    // got to — a resume must not re-deal loot the player already saw.
    seedRunStreams(snap.runSeed)
    skillRun.seed = snap.runSeed
    skillRun.pool = snap.skillPool
    skillRun.items = snap.itemPool
    if (snap.rngLoot !== null) streams.rng.loadState(snap.rngLoot)
    if (snap.rngMap !== null) streams.mapRng.loadState(snap.rngMap)
    // The dry counter is restored WITH the loot stream, never without it (M9).
    const lootPity: RarityPity = { dry: snap.lootPity }
    // The process-global counters move HERE, when the run really comes back.
    restoreIdCounter(snap.idCounter)
    restoreNameCounters(snap.nameCounters)

    const battleMap = snapshotBattleMap(snap)
    // Only open tiles of the field the battle resumes on, each hero once, at
    // most a full roster (G1-2) — whatever the payload claims.
    const rosterIds = new Set(snap.roster.map((s) => s.id))
    const placements: Placement = carryPlacements(snap.placements ?? {}, battleMap, (id) => rosterIds.has(id), MAX_ROSTER)

    // Which side of the wave was the snapshot taken on? (C-1) `lastResult` is
    // the only honest answer: a resolved wave has ALREADY moved the run on.
    const resolved = snap.lastResult !== null
    const enemiesTotal = snap.currentWave?.spawns.length ?? 0
    const hud = {
      ...freshHud(),
      baseHp: snap.baseHp,
      maxBaseHp: snap.maxBaseHp,
      enemiesTotal,
      enemiesSpawned: resolved ? enemiesTotal : 0,
      goldEarned: resolved ? (snap.lastResult?.goldEarned ?? 0) : 0,
    }

    set({
      runSeed: snap.runSeed,
      screen: snap.screen,
      runPhase: snap.runPhase,
      // A snapshot only ever exists for a run that was NOT settled (M-1).
      runSettled: false,
      runMap: snap.runMap,
      currentNodeId: snap.currentNodeId,
      clearedNodeIds: snap.clearedNodeIds,
      reachableNodeIds: snap.reachableNodeIds,
      event: snap.event,
      battleMap,
      fieldAct: snap.fieldAct,
      roster: snap.roster,
      placements,
      gold: snap.gold,
      baseHp: snap.baseHp,
      maxBaseHp: snap.maxBaseHp,
      enemyHpMult: snap.enemyHpMult,
      threat: snap.threat,
      inventory: snap.inventory,
      runKills: snap.runKills,
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
      skillPool: snap.skillPool,
      itemPool: snap.itemPool,
      contract: snap.contract,
      board: null,
      // The engine is deliberately NOT restored: a wave interrupted MID-fight
      // resumes from its setup phase, fully re-fightable.
      engine: null,
      battlePhase: 'setup',
      speed: 1,
      hud,
      lastResult: snap.lastResult,
      lastLoot: snap.lastLoot,
      // A resumed run never lands mid-beat.
      waveBeat: null,
      challenge: snap.challenge,
      // LS3: a run saved before staging existed has none, and plays unstaged.
      firstRun: snap.firstRun === true,
      // A snapshot only ever exists for a LIVE run, so there is no recap.
      victory: null,
      selectedSentinelId: null,
      ...CLEAR_SHELL,
      // Round 3 (Q5): the load moved an off-hand item back to the pack — say so, once.
      gearNotice: snap.gearReturned?.length ? { text: gearReturnedText(snap.gearReturned), at: Date.now() } : null,
    })
  },

  // Walking away from an interrupted run still SETTLES it (C3): the cities'
  // pay and the purse come home.
  discardSavedRun: () => {
    settleSavedRun(get, set)
    set(leaveToHub())
  },

  selectNode: (nodeId) => {
    const { reachableNodeIds, clearedNodeIds, runMap, roster, lootPity, event } = get()
    if (!reachableNodeIds.includes(nodeId)) return
    // A cleared node is done, whatever `reachableNodeIds` says (M-3).
    if (clearedNodeIds.includes(nodeId)) return
    // A city's cash-out choice is answered before the road goes on.
    if (get().contract?.pending != null) return
    const node = runMap.nodes.find((n) => n.id === nodeId)
    if (!node) return

    // ---- a parked event is never left live behind you (F1) ---------------
    if (event) {
      if (event.nodeId === nodeId) return
      set({ event: null, merchant: null, shrineOffer: null, recruitOptions: [] })
    }

    if (node.type === 'merchant') {
      // An OFFER: `rollMerchantShelf` rolls with the drought's luck but leaves
      // the pity counter alone; `buyMerchantItem` charges it on the sale (F4).
      const relics = get().relics
      // The road's prices: the Sovereign Route's merchants charge double (Rosethread's trade-off).
      const contract = get().contract
      const items = rollMerchantShelf(streams.rng, {
        luck: merchantLuck(node.layer),
        roster,
        pity: lootPity,
        size: shelfSize(relics),
        kinds: get().itemPool,
        priceMult: priceMultOf(contract),
      })
      const recruit =
        roster.length < MAX_ROSTER
          ? { sentinel: scaledRecruit(streams.rng, roster, recruitHub(relics)), price: routePrice(RECRUIT_PRICE, contract) }
          : null
      // The wagon repair is on every counter (Phase 3b): the comeback.
      set({ event: { kind: 'merchant', nodeId }, merchant: { items, recruit, repair: { ...GATE_REPAIR, price: routePrice(GATE_REPAIR.price, contract) }, rerolls: 0 } })
      return
    }
    if (node.type === 'campfire') {
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

    // Battle / elite / boss. The composition variant is seeded on (run seed,
    // layer, row) (WS8); a stake's extra elites are real elite NODES on the map.
    // The Sovereign Route musters every goblin clan from the first fight.
    const wave = nodeEncounter(encounterNode(node), get().runSeed, encounterRulesOf(get().contract))!
    const { baseHp, maxBaseHp } = get()
    // The battle's orientation is chosen HERE, once (Portrait battlefields).
    // Its map challenge is the node's own on this ROUTE's ground (the
    // company's), and so (Q1) is its danger ground — a hash, no stream draw.
    const ground = groundOf(get())
    // The road changes country at every city (`run/fields`): the first fight
    // of a new act is fought on that act's field — a hash of (seed, act), no
    // stream draw — and the company starts it on the bench.
    const field = groundFor(get().runSeed, { fieldId: fieldIdOf(get().battleMap), fieldAct: get().fieldAct }, node.layer)
    const battleMap =
      fieldFor(
        field.fieldId,
        nodeTerrainRule(node, get().runSeed, ground),
        layout.orientation(),
        nodeHazardSeed(node, get().runSeed, ground),
        // The HQ's cleared boulders, frozen on the contract.
        get().contract?.hq.rocks ?? 0,
      ) ??
      orientField(get().battleMap, layout.orientation())
    set({
      activeNodeId: nodeId,
      currentWave: wave,
      battleMap,
      fieldAct: field.fieldAct,
      // New ground: everyone back to the bench, to be posted afresh. Within an
      // act the posts carry, and a hero on a tile this field blocks goes back.
      placements: field.fresh ? emptyPlacements(battleMap) : carryPlacements(get().placements, battleMap, (id) => roster.some((h) => h.id === id), MAX_ROSTER),
      battlePhase: 'setup',
      screen: 'battle',
      selectedSentinelId: null,
      lastResult: null,
      lastLoot: [],
      hud: { ...freshHud(), baseHp, maxBaseHp, enemiesTotal: wave.spawns.length },
      ...CLEAR_SHELL,
      // The arrival note, said in the coach row in setup (`Coach`).
      newGround: field.fresh ? battleMap.name : null,
    })
  },
})
