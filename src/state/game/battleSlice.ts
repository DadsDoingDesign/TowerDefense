/**
 * Battle slice: deploying, starting a wave, the wave-clear beat, and the one
 * place a wave pays out (`finishBattle`) for both modes.
 */
import { GameEngine } from '../../game/engine/engine'
import { teamKeepsakeMods } from '../../game/engine/combat'
import { generateItem } from '../../game/data/items'
import { relicCommands, relicTeamMods } from '../../game/data/relics'
import { afterFightRelics, diaryXp, handSize, rewardHand } from '../../game/run/relics'
import { battleRelicsWithheld } from '../../game/run/firstRun'
import { mutationOfferSize, rollMutationChoices } from '../../game/data/mutations'
import { applyBattleXp, combatSeed, levelXpAwards } from '../../game/run/battle'
import { MAX_ROSTER } from '../../game/run/economy'
import { forkFires, frontierFrom, meleeOf, placedSentinels, postsOf } from '../../game/run/map'
import { recruitSlate } from '../../game/run/recruits'
import { contractGrant } from '../../game/run/settle'
import { cargoPct, cityOfLayer, cityPay, earn, stakeRules } from '../../game/run/contracts'
import { stow } from '../../game/run/inventory'
import { packSale, packSlotsOf } from './purse'
import { clearBonusGold, mapKind, nodeClearLuck, threatAfterLayer } from '../../game/run/threat'
import { commandsFor, type CommandId } from '../../game/data/commands'
import { orientationOf } from '../../game/data/maps'
import { crowdedBy, crowds } from '../../game/data/terrain'
import { isMelee } from '../../game/engine/melee'
import { noteEngineEvent } from '../combatNotes'
import type { Placement, Tactics } from '../../game/types'
import { gameSfx, sfx } from '../../audio/audio'
import { useMetaStore } from '../metaStore'
import { assistProfile, useSettingsStore } from '../settingsStore'
import { abandonBattle, CLEAR_SHELL } from './fresh'
import { buildRecap } from './recap'
import { runFactsFromState, settleFactsFromState } from './settle'
import { beat, clearBeatTimer, featUnlocked, recruitHub, relicUnlocked, streams, WAVE_BEAT_LOSS_MS, WAVE_BEAT_MS, waveFirsts } from './runtime'
import { enemyKind } from '../../game/data/enemyKnowledge'
import { battleHpMult, canStartWave, fieldConflicts } from './selectors'
import type { Crossroads, Slice, Speed } from './types'

export interface BattleActions {
  /**
   * G1-2: a tap on a deployment tile, from the canvas or its keyboard layer —
   * the one router: a blocked tile says why (`noteTerrain`), a breather tile
   * is the one move, a setup tile posts the armed hero or inspects the posted
   * one.
   */
  tapTile: (tileId: string) => void
  placeOnSlot: (slotId: string) => void
  clearSlot: (slotId: string) => void
  setSpeed: (s: Speed) => void
  setTactics: (t: Partial<Tactics>) => void
  startWave: () => void
  /**
   * Fire a Watch Command (Phase 3a). The engine decides whether it can — one
   * charge per sub-wave — and logs the tick; the store only forwards the tap.
   */
  useCommand: (id: CommandId) => void
  /**
   * A tap on a slot during a breather: the first picks up the hero standing
   * there, the second puts it down (swapping with whoever stands there). One
   * move per breather; tapping the picked slot again drops the pick.
   */
  breatherTap: (slotId: string) => void
  /** End the breather and send in the next sub-wave. */
  resumeSubWave: () => void
  syncHud: () => void
  finishBattle: () => void
  /**
   * End the wave-clear hold right now and settle the wave.
   *
   * The doctrine's swift-retry rule applies to victories too: a beat you cannot
   * cut short is a cutscene. Any tap during the hold lands here, and so does
   * the tab going away.
   */
  skipWaveBeat: () => void
  continueAfterWave: () => void
}

export const createBattleSlice: Slice<BattleActions> = (set, get) => ({
  tapTile: (tileId) => {
    const st = get()
    if (st.screen !== 'battle') return
    // Tiles only mean something while a hero can be put down: setup, or the
    // breather's one move. During a live sub-wave posts are held (the
    // designer: "towers cannot be moved during rounds. only between"): a tap
    // on a hero says so and opens its panel; any other tap does nothing.
    const breather = st.battlePhase === 'battle' && !!st.engine?.breather
    if (st.battlePhase === 'battle' && st.engine && !breather) {
      const rt = st.engine.status === 'running' ? st.engine.sentinelOnSlot(tileId) : undefined
      if (!rt) return
      set({ fieldNote: { tileId, kind: 'held', at: Date.now() } })
      st.focusTower(rt.def.id)
      sfx('error')
      return
    }
    if (!breather && (st.battlePhase !== 'setup' || st.engine)) return
    const tile = st.battleMap.tiles?.find((t) => t.id === tileId)
    // A blocked tile says why instead of doing nothing (G1-2).
    if (tile?.block) {
      st.noteTerrain(tileId)
      return
    }
    if (st.fieldNote) set({ fieldNote: null })
    if (breather) {
      st.breatherTap(tileId)
      return
    }
    if (st.selectedSentinelId) st.placeOnSlot(tileId)
    else if (st.placements[tileId]) st.focusTower(st.placements[tileId]!)
  },

  placeOnSlot: (slotId) => {
    const { selectedSentinelId, placements, battlePhase, screen, battleMap, roster } = get()
    if (screen !== 'battle' || battlePhase !== 'setup' || !selectedSentinelId) return
    // Only an OPEN tile of this battle's field takes a hero (G1-2).
    if (!battleMap.slots.some((s) => s.id === slotId)) return
    // A swinger's clearance (`terrain.CLEARANCE`): nobody stands on the tiles
    // beside a melee hero, whichever of the two is being posted. Ranged heroes
    // may stand side by side. The hero it would replace on this very tile, and
    // itself, are excepted.
    const melee = meleeOf(roster)
    const others = postsOf(placements, melee, selectedSentinelId, slotId)
    const near = crowdedBy(slotId, melee(selectedSentinelId), others)
    if (near) {
      // The coach names whichever of the two swings, and with what.
      const id = melee(selectedSentinelId) ? selectedSentinelId : placements[near.tile]
      get().noteCrowded(slotId, roster.find((h) => h.id === id))
      return
    }
    const next: Placement = { ...placements }
    for (const key of Object.keys(next)) if (next[key] === selectedSentinelId) next[key] = null
    next[slotId] = selectedSentinelId
    // On a portrait field the post also lets go of the hero's Context panel:
    // the setup Detail band is collapsed there (Portrait battlefields), and a
    // selection left behind would re-open it the instant the hero landed.
    const portrait = orientationOf(get().battleMap) === 'portrait'
    set({ placements: next, selectedSentinelId: null, ...(portrait ? { shellSelection: null } : {}) })
    sfx('deploy')
    // Q1: posted on cursed ground — the coach strip says what it costs.
    get().noteDanger(slotId)
  },

  clearSlot: (slotId) => {
    const { placements, battlePhase } = get()
    if (battlePhase !== 'setup') return
    if (!placements[slotId]) return
    set({ placements: { ...placements, [slotId]: null } })
    sfx('undeploy')
  },

  setSpeed: (s) => set({ speed: s }),
  setTactics: (t) => {
    const tactics = { ...get().tactics, ...t }
    set({ tactics })
    // Mid-battle, the order reaches the live fight too — logged by the engine
    // with its tick, so a replay reproduces the change (Phase 3a).
    const { engine, battlePhase } = get()
    if (engine && battlePhase === 'battle') engine.setFocus(tactics.focus)
  },

  startWave: () => {
    const st = get()
    const { battleMap, roster, placements, baseHp, maxBaseHp, currentWave, tactics, runMods } = st
    // ---- the load-bearing invariant (C-1) --------------------------------
    // A wave that has already resolved can never be fought again, and a node
    // already in `clearedNodeIds` can never be re-fought. Both grants — gold,
    // XP, threat, the reward pick, a city's pay — hang off finishing
    // a wave, so re-entering one is how everything gets paid twice.
    //
    // These are guards on the ACTION rather than on any one screen, on
    // purpose: the C-1 bug arrived through a snapshot shape, and the next one
    // would too. Whatever state a future save restores, it cannot get past
    // here. They live in `canStartWave` so the UI reads the same answer the
    // store will give — a control the store refuses must never render enabled.
    if (!canStartWave(st)) return
    if (!currentWave) return // narrowing only — `canStartWave` already rejected it
    // A clearance conflict (a hero swinging beside another, `run/clearance`)
    // holds the wave until the player makes space. The strip says so and the
    // button is disabled; this is the store's half of the same rule.
    if (fieldConflicts(st).length) return sfx('error')
    const effHpMult = battleHpMult(st)
    // The battle's combat rolls are pinned to (run seed, node, wave) — replaying
    // the same run replays the same fight, and no two nodes share a sequence.
    // A campaign wave without a node never reaches this line (`canStartWave`),
    // because `finishBattle` has nothing to pay a nodeless clear into (M-4).
    const nodeKey = st.activeNodeId ?? 'node'
    const waveIndex = st.clearedNodeIds.length
    const engine = new GameEngine({
      map: battleMap,
      wave: currentWave,
      placedSentinels: placedSentinels(roster, placements),
      baseHp,
      maxBaseHp,
      enemyHpMult: effHpMult,
      // Relics (Phase 3b) ride beside the legacy keepsakes and stat-card mods an
      // older save may still carry.
      teamMods: [...teamKeepsakeMods(roster), ...runMods, ...relicTeamMods(st.relics)],
      tactics,
      seed: combatSeed(st.runSeed, nodeKey, waveIndex),
      // The assist dial is read HERE, not inside the sim (M34). The engine
      // stays a pure function of (seed, options), so the balance harness and
      // any replay are untouched by whatever this player has set.
      //
      // It is read live rather than pinned at run start, on purpose: assist
      // exists to help the run you are currently losing, so it has to bite the
      // next wave, not the next run. That makes the dial part of the run's
      // reproducibility contract, which is why the recap records it next to
      // the seed (F6).
      baseDamageMul: assistProfile(useSettingsStore.getState().assist).baseDamageMul,
      // Audio hears every event; the Announcer hears the few a player must be
      // told about (boss phases, the breather, a command) — `combatNotes.ts`.
      onEvent: (e, p) => {
        gameSfx(e, p)
        noteEngineEvent(e, p)
      },
      // The game pauses between sub-waves for the player's one move; the
      // harness and replays auto-continue (Phase 3a).
      breathers: 'pause',
      // Rally Horn, unless a relic swapped it (Signal Flare → Flare).
      commands: commandsFor(relicCommands(st.relics)),
    })
    sfx('wave')
    // The Codex notes every goblin the Watch has faced; the feats note the
    // biggest company ever fielded (Phase 3b).
    // Q10: first note which kinds this wave is the first sighting of, for the
    // enemy info card (see `waveFirsts`).
    const seenBefore = new Set(useMetaStore.getState().codex.enemies.map(enemyKind))
    waveFirsts.kinds = new Set(currentWave.spawns.map((sp) => enemyKind(sp.typeId)).filter((k) => !seenBefore.has(k)))
    useMetaStore.getState().recordCodex({ enemies: [...new Set(currentWave.spawns.map((sp) => sp.typeId))] })
    const fielded = engine.sentinels.length
    set({
      engine,
      battlePhase: 'battle',
      selectedSentinelId: null,
      breatherPick: null,
      // Gear locks for the round: an armed gear slot would offer an equip the
      // store now refuses.
      gearSlot: null,
      hud: hudOf(engine),
      feats: fielded > st.feats.maxFielded ? { ...st.feats, maxFielded: fielded } : st.feats,
    })
  },

  useCommand: (id) => {
    const { engine, battlePhase } = get()
    if (!engine || battlePhase !== 'battle') return
    if (engine.useCommand(id)) {
      sfx('confirm')
      set({ hud: hudOf(engine) })
    }
  },

  breatherTap: (slotId) => {
    const { engine, battlePhase, breatherPick } = get()
    if (!engine || battlePhase !== 'battle' || !engine.breather) return
    if (engine.subWaveState().moved) return
    if (!breatherPick) {
      // Only a slot with a hero on it can be picked up.
      if (!engine.sentinelOnSlot(slotId)) return
      set({ breatherPick: slotId })
      sfx('toggle')
      // Q1: a hero picked up to move — where the cursed ground is, and its cost.
      get().noteDangerOnField()
      return
    }
    if (breatherPick === slotId) {
      set({ breatherPick: null })
      return
    }
    const other = engine.sentinelOnSlot(slotId)
    const swapped = !!other
    const moving = engine.sentinelOnSlot(breatherPick)
    if (!moving) {
      set({ breatherPick: null })
      return
    }
    // A swinger's clearance: the engine refuses a move that puts either hero
    // too close to a third (`engine.moveHero`); say why.
    const third = engine.sentinels.find(
      (s) =>
        s.slotId !== breatherPick &&
        s.slotId !== slotId &&
        (crowds(s.slotId, isMelee(s.def), slotId, isMelee(moving.def)) ||
          (!!other && crowds(s.slotId, isMelee(s.def), breatherPick, isMelee(other.def)))),
    )
    if (third) {
      get().noteCrowded(slotId, isMelee(third.def) ? third.def : isMelee(moving.def) ? moving.def : other?.def)
      return
    }
    const moved = engine.moveHero(breatherPick, slotId)
    if (moved) sfx('deploy')
    set({ breatherPick: null, hud: hudOf(engine) })
    // Q1: whoever the move put on cursed ground, the strip says what it costs.
    if (moved) {
      get().noteDanger(slotId)
      if (swapped) get().noteDanger(breatherPick)
    }
  },

  resumeSubWave: () => {
    const { engine } = get()
    if (!engine || !engine.breather) return
    // The next sub-wave waits while a hero swings beside another — the gear
    // change that made it is the breather's to undo (`run/clearance`).
    if (fieldConflicts(get()).length) return sfx('error')
    engine.resume()
    sfx('wave')
    set({ breatherPick: null, gearSlot: null, hud: hudOf(engine) })
  },

  syncHud: () => {
    const { engine } = get()
    if (!engine) return
    set({ hud: hudOf(engine) })
  },

  /**
   * The rAF loop calls this on every frame an engine that is no longer
   * `running` is still mounted. The FIRST such call opens a short hold (H18)
   * instead of settling on the spot; every call during the hold is a no-op,
   * and the timer — or a tap, or the tab going away — settles it.
   *
   * Everything below the beat is the settlement, with its invariants: C-1's
   * no-node-pays-twice, M-4's never-bail-into-a-dead-battle, M-1's settle-once.
   */
  finishBattle: () => {
    const st = get()
    if (!st.engine) return
    if (st.waveBeat) {
      // Held. Only `skipWaveBeat` (the timer, a tap, or `pagehide`) may pass.
      if (!beat.settling) return
    } else {
      /*
       * ---- the wave-clear beat (H18) ------------------------------------
       *
       * Hold the last frame of the fight on screen (the engine stays mounted,
       * which is what keeps it drawn), play the sting, raise the banner, and
       * settle a beat later. The hold is short and skippable.
       */
      const status = st.engine.status === 'defeated' ? 'defeated' : 'cleared'
      if (status === 'cleared') sfx('clear')
      set({ waveBeat: { status, startedAt: Date.now() } })
      beat.timer = setTimeout(
        () => {
          beat.timer = null
          get().skipWaveBeat()
        },
        status === 'cleared' ? WAVE_BEAT_MS : WAVE_BEAT_LOSS_MS,
      )
      return
    }
    // Past the hold: the wave settles now, so the beat is over.
    set({ waveBeat: null })
    // The other half of the C-1 invariant: no node can be paid out twice.
    // Bailing has to leave a state with a way out of it (M-4).
    if (st.activeNodeId && st.clearedNodeIds.includes(st.activeNodeId)) {
      set(abandonBattle())
      return
    }
    const rawResult = st.engine.result()
    // Q10 — the Codex counts what fell, by kind, for the enemy info card.
    useMetaStore.getState().recordFelled(st.engine.killsByKey)
    const settlingNode = st.activeNodeId ? st.runMap.nodes.find((n) => n.id === st.activeNodeId) : undefined
    // Levels are a resource, not a clock (Phase 3b): the wave's raw XP decides
    // who gets the share, `waveXp` decides how big the share is.
    const result = {
      ...rawResult,
      perSentinel:
        st.currentWave && settlingNode
          ? levelXpAwards(rawResult.perSentinel, {
              wave: st.currentWave,
              hpMult: battleHpMult(st),
              depth: settlingNode.layer,
              kind: mapKind(settlingNode),
            })
          : rawResult.perSentinel,
    }
    const nodePurse = settlingNode ? clearBonusGold(settlingNode) : 0
    if (result.status === 'cleared' && (result.goldEarned > 0 || nodePurse > 0)) sfx('coin')
    const totalKills = st.runKills + result.enemiesKilled

    // XP applies in both outcomes; a skill milestone it crosses is owed and
    // offered between rounds (SK1). The War Diary relic tops up the
    // least-levelled hero on the field.
    const { roster: rosterXp } = applyBattleXp(st.roster, diaryXp(result.perSentinel, st.roster, st.relics))

    const { gold, inventory, runMap, activeNodeId } = st
    // A wave with no node has nothing to pay into and nothing to advance.
    // Leave the battle rather than `return` with the engine mounted (M-4).
    const node = activeNodeId ? runMap.nodes.find((n) => n.id === activeNodeId) : undefined
    if (!activeNodeId || !node) {
      set(abandonBattle())
      return
    }

    if (result.status === 'defeated') {
      // The wagons fell: this wave loss IS the contract lost (M32). The cities
      // already paid keep their pay, the purse comes home, unsold crates are lost.
      sfx('defeat')
      const depth = get().clearedNodeIds.length - 1
      const contract = st.contract ? { ...st.contract, pending: null, status: 'lost' as const } : null
      const lost = { ...st, roster: rosterXp, contract, runKills: totalKills }
      const deposit = useMetaStore
        .getState()
        .settleContract(contractGrant({ ...settleFactsFromState(lost, false), depth, kills: totalKills }, 'lost'))
      set({
        runPhase: 'lost',
        // The settle just paid this run out; settling it here is what stops
        // `returnToHub` off the defeat screen paying it again (M-1).
        runSettled: true,
        contract,
        lastResult: result,
        victory: buildRecap(lost, result, { outcome: 'lost', depth, kills: totalKills, deposit, baseHp: 0 }),
        baseHp: 0,
        engine: null,
        battlePhase: 'setup',
        runKills: totalKills,
      })
      return
    }

    // Advance the map.
    const rules = stakeRules(st.contract?.crates ?? 0)
    const cleared = [...get().clearedNodeIds, activeNodeId]
    const reachable = frontierFrom(runMap, activeNodeId, cleared)
    const wonRun = node.type === 'boss'
    if (wonRun) sfx('victory')
    // An act boss down is a feat's fact; one felled without losing any cargo
    // is a better one (Phase 3b).
    const actBoss = node.type === 'miniboss'
    const feats = {
      ...st.feats,
      actBosses: st.feats.actBosses + (actBoss ? 1 : 0),
      flawlessBosses: st.feats.flawlessBosses + (actBoss && result.baseHpLeft >= st.baseHp ? 1 : 0),
      goldPeak: Math.max(st.feats.goldPeak, gold + result.goldEarned + clearBonusGold(node)),
    }

    // ---- a city (the mercenary company) ------------------------------------
    // Each act boss is a city on the route. It pays for the cargo that
    // arrives — its share of the crates, its fee, and at the destination the
    // completion bonus — into the contract's ledger (banked at the settle, so
    // a later fall keeps it). Cities 1 and 2 then wait on "cash out or press on".
    const city = cityOfLayer(node.layer)
    let contract = st.contract
    if (contract && city != null && contract.paid.length === city) {
      const cargo = cargoPct(result.baseHpLeft, st.maxBaseHp)
      const pay = cityPay(contract, city, cargo)
      contract = {
        ...contract,
        paid: [...contract.paid, pay.total],
        cargoAt: [...contract.cargoAt, cargo],
        // The Sovereign Route's cities are waypoints: nothing to cash out.
        pending: wonRun || contract.charter ? null : city,
        status: wonRun ? 'delivered' : contract.status,
      }
    }

    // What the fight paid into the purse is road gold (`contract.earned`).
    const fightGold = result.goldEarned + clearBonusGold(node)
    const delivered = { ...st, feats, roster: rosterXp, clearedNodeIds: cleared, contract: earn(contract, fightGold), runKills: totalKills, gold: gold + fightGold }
    const deposit = wonRun
      ? useMetaStore
          .getState()
          .settleContract(
            contractGrant({ ...settleFactsFromState(delivered, true), depth: cleared.length - 1, kills: totalKills, facts: runFactsFromState(delivered, true) }, 'delivered'),
          )
      : 0
    // Threat follows the road: the next stop is fought at the next layer's,
    // from the stake's starting Threat.
    const nextThreat = threatAfterLayer(node.layer, rules.startThreat)
    const bonusGold = clearBonusGold(node)
    const luck = nodeClearLuck(node)

    // Non-boss clears offer a card pick (copy-spend-write-back for pity, M9/F4).
    const pity = { ...st.lootPity }
    const handKind = node.type === 'miniboss' ? 'boss' : node.type === 'elite' ? 'elite' : 'battle'
    const reward = wonRun
      ? null
      : rewardHand(streams.rng, {
          kind: handKind,
          luck,
          count: handSize({ thinPickings: false }),
          // LS3: a first run meets relics at its first elite.
          noBattleRelics: battleRelicsWithheld(st.firstRun, st.runMap, cleared),
          held: st.relics,
          unlocked: relicUnlocked,
          roster: rosterXp,
          pity,
          kinds: st.itemPool,
        })
    // The boss's spoils go on the RECAP, not into the inventory of a run that
    // has just ended (M16).
    const bossLoot = wonRun
      ? Array.from({ length: 3 }, () => generateItem(streams.rng, { luck, roster: rosterXp, pity, kinds: st.itemPool }))
      : []

    // After each act boss, the Crossroads: recruit or mutate (Phase 3b).
    const fireFork = !wonRun && forkFires(node)
    const crossroads: Crossroads | null = fireFork
      ? {
          recruits: rosterXp.length < MAX_ROSTER ? recruitSlate(streams.rng, rosterXp, recruitHub(st.relics)) : [],
          mutations: rollMutationChoices(
            streams.rng,
            [...new Set(rosterXp.flatMap((s) => (s.mutations ?? []).map((m) => m.key)))],
            mutationOfferSize(false, featUnlocked('mutant')),
          ),
          mutationHeroId: null,
        }
      : null

    // Field Surgeon's Kit and the Tithe Box pay on every won fight; the purse's
    // whole gain is road gold. An act boss's spoils go to the pack, and a full
    // pack sells its cheapest pieces (the run's pack slots, `inventory.stow`).
    const after = afterFightRelics(st.relics, { baseHp: result.baseHpLeft, maxBaseHp: st.maxBaseHp, gold: gold + result.goldEarned + bonusGold })
    const stowed = wonRun ? { inventory, sold: [], gold: 0 } : stow(inventory, bossLoot, packSlotsOf(st))
    const purse = { gold: after.gold, contract: earn(contract, after.gold - gold) }
    set({
      roster: rosterXp,
      baseHp: after.baseHp,
      ...purse,
      inventory: stowed.inventory,
      ...packSale(purse, stowed.sold, stowed.gold),
      threat: nextThreat,
      lastResult: result,
      lastLoot: bossLoot,
      lootPity: pity,
      victory: wonRun
        ? buildRecap(delivered, result, { outcome: 'delivered', depth: cleared.length - 1, kills: totalKills, deposit, spoils: bossLoot, roster: rosterXp, baseHp: result.baseHpLeft })
        : null,
      reward,
      crossroads,
      forkDone: st.forkDone || fireFork,
      clearedNodeIds: cleared,
      feats,
      currentNodeId: activeNodeId,
      reachableNodeIds: reachable,
      runPhase: wonRun ? 'won' : 'active',
      // The delivery is the only win, and it pays on the spot.
      runSettled: wonRun,
      engine: null,
      // The wave is over, so the phase says so (C-1).
      battlePhase: 'setup',
      runKills: totalKills,
    })
  },

  skipWaveBeat: () => {
    clearBeatTimer()
    if (!get().waveBeat) return
    // The one door through `finishBattle`'s hold. A flag rather than a second
    // copy of the settlement, so there is still exactly one place a wave pays
    // out and no invariant can be enforced in one copy and not the other.
    beat.settling = true
    try {
      get().finishBattle()
    } finally {
      beat.settling = false
    }
  },

  continueAfterWave: () => {
    // Back to the node map. A reward that has not been taken is still owed:
    // leaving the summary is "I've read this", not "I forfeit my pick" — the
    // reward board lives on the map screen, behind a city's payout if one is due.
    const st = get()
    set({
      screen: 'map',
      activeNodeId: null,
      currentWave: null,
      lastResult: null,
      lastLoot: [],
      reward: st.reward,
      battlePhase: 'setup',
      ...CLEAR_SHELL,
    })
  },
})

/** The HUD fields the shell reads, off a live engine. */
export function hudOf(engine: GameEngine) {
  const s = engine.hudSnapshot()
  return {
    baseHp: s.baseHp,
    maxBaseHp: s.maxBaseHp,
    goldEarned: s.goldEarned,
    enemiesAlive: s.enemiesAlive,
    enemiesSpawned: s.enemiesSpawned,
    enemiesTotal: s.enemiesTotal,
    subWave: s.subWave,
    subWaveCount: s.subWaveCount,
    breather: s.breather,
    commandReady: s.commandReady,
  }
}
