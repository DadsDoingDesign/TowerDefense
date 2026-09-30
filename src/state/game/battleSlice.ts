/**
 * Battle slice: deploying, starting a wave, the wave-clear beat, and the one
 * place a wave pays out (`finishBattle`) for both modes.
 */
import { GameEngine } from '../../game/engine/engine'
import { hashSeed, RNG } from '../../game/core/rng'
import { teamKeepsakeMods } from '../../game/engine/combat'
import { generateItem } from '../../game/data/items'
import { relicCommands, relicTeamMods } from '../../game/data/relics'
import { afterFightRelics, cartularyRelic, diaryXp, handSize, rewardHand } from '../../game/run/relics'
import { mutationOfferSize, rollMutationChoices } from '../../game/data/mutations'
import { applyBattleXp, combatSeed, endlessRoundSpoils, levelXpAwards } from '../../game/run/battle'
import { MAX_ROSTER } from '../../game/run/economy'
import { forkFires, frontierFrom, placedSentinels } from '../../game/run/map'
import { receiveItems, recruitSlate } from '../../game/run/recruits'
import { challengeGrant } from '../../game/run/settle'
import { clearBonusGold, mapKind, nodeClearLuck, threatAfterLayer, threatAfterRound } from '../../game/run/threat'
import { commandsFor, type CommandId } from '../../game/data/commands'
import { orientationOf } from '../../game/data/maps'
import { noteEngineEvent } from '../combatNotes'
import type { Placement, Tactics } from '../../game/types'
import { gameSfx, sfx } from '../../audio/audio'
import { bannerRules, useMetaStore } from '../metaStore'
import { assistProfile, useSettingsStore } from '../settingsStore'
import { abandonBattle, CLEAR_SHELL } from './fresh'
import { buildRecap } from './recap'
import { runFactsFromState } from './settle'
import { beat, clearBeatTimer, featUnlocked, recruitHub, relicUnlocked, runUnlocked, streams, WAVE_BEAT_LOSS_MS, WAVE_BEAT_MS } from './runtime'
import { battleHpMult, canStartWave } from './selectors'
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
    // breather's one move. A live wave ignores taps on the field.
    const breather = st.battlePhase === 'battle' && !!st.engine?.breather
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
    const { selectedSentinelId, placements, battlePhase, screen, battleMap } = get()
    if (screen !== 'battle' || battlePhase !== 'setup' || !selectedSentinelId) return
    // Only an OPEN tile of this battle's field takes a hero (G1-2).
    if (!battleMap.slots.some((s) => s.id === slotId)) return
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
    const { battleMap, roster, placements, baseHp, maxBaseHp, mode, currentWave, tactics, runMods } = st
    // ---- the load-bearing invariant (C-1) --------------------------------
    // A wave that has already resolved can never be fought again, and a node
    // already in `clearedNodeIds` can never be re-fought. Both grants — gold,
    // XP, threat, the reward pick, the endless win/round — hang off finishing
    // a wave, so re-entering one is how everything gets paid twice.
    //
    // These are guards on the ACTION rather than on any one screen, on
    // purpose: the C-1 bug arrived through a snapshot shape, and the next one
    // would too. Whatever state a future save restores, it cannot get past
    // here. They live in `canStartWave` so the UI reads the same answer the
    // store will give — a control the store refuses must never render enabled.
    if (!canStartWave(st)) return
    if (!currentWave) return // narrowing only — `canStartWave` already rejected it
    // Both modes compound via Threat (H7): one difficulty model covers both.
    const effHpMult = battleHpMult(st)
    // The battle's combat rolls are pinned to (run seed, node, wave) — replaying
    // the same run replays the same fight, and no two nodes share a sequence.
    // A campaign wave without a node never reaches this line (`canStartWave`),
    // because `finishBattle` has nothing to pay a nodeless clear into (M-4).
    const nodeKey = mode === 'endless' ? 'endless' : (st.activeNodeId ?? 'node')
    const waveIndex = mode === 'endless' ? st.round : st.clearedNodeIds.length
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
    useMetaStore.getState().recordCodex({ enemies: [...new Set(currentWave.spawns.map((sp) => sp.typeId))] })
    const fielded = engine.sentinels.length
    set({
      engine,
      battlePhase: 'battle',
      selectedSentinelId: null,
      breatherPick: null,
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
    const swapped = !!engine.sentinelOnSlot(slotId)
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
    engine.resume()
    sfx('wave')
    set({ breatherPick: null, hud: hudOf(engine) })
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
       * settle a beat later. The hold is short and skippable — this game is
       * played in one-to-three-minute bursts.
       *
       * The status is read off the engine rather than off `result()`, which
       * allocates the whole receipt; the settlement below builds that once.
       */
      const status = st.engine.status === 'defeated' ? 'defeated' : 'cleared'
      // A loss already has a voice — `leak` fired as the line broke — so the
      // beat for it is shorter and its sound is the run/wave ending below,
      // not a second thud on top of the one just heard.
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
    // `startWave` should already have made this unreachable; it is repeated
    // here because this is the function that hands out the money.
    //
    // Bailing has to leave a state with a way out of it (M-4). Dropping the
    // engine but staying on the battle screen with an unresolvable wave is the
    // soft-lock in another costume.
    if (st.mode === 'campaign' && st.activeNodeId && st.clearedNodeIds.includes(st.activeNodeId)) {
      set(abandonBattle(st.mode))
      return
    }
    const rawResult = st.engine.result()
    // The payout lands here, so the coin does too (H17): sting → hold →
    // receipt, with the money on the receipt. It sounds when ANY currency
    // lands, not just kill gold — see `clearBonusGold` (F12). (No 'confirm'
    // on top: the `clear` sting already announced the win.) The two loss
    // cases are sounded at their own branches below.
    const settlingNode =
      st.mode === 'campaign' && st.activeNodeId
        ? st.runMap.nodes.find((n) => n.id === st.activeNodeId)
        : undefined
    // Levels are a resource, not a clock (Phase 3b): the wave's raw XP decides
    // who gets the share, `waveXp` decides how big the share is. The receipt
    // prints the re-priced number, because it is the one the heroes received.
    const endlessSpoils = st.mode === 'endless' ? endlessRoundSpoils(st.round) : null
    const result = {
      ...rawResult,
      perSentinel: st.currentWave
        ? levelXpAwards(rawResult.perSentinel, {
            wave: st.currentWave,
            hpMult: battleHpMult(st),
            depth: settlingNode ? settlingNode.layer : st.round,
            kind: settlingNode
              ? mapKind(settlingNode)
              : endlessSpoils?.isBoss
                ? 'boss'
                : endlessSpoils?.isElite
                  ? 'elite'
                  : 'normal',
          })
        : rawResult.perSentinel,
    }
    const nodePurse = settlingNode ? clearBonusGold(settlingNode) : 0
    if (result.status === 'cleared' && (result.goldEarned > 0 || nodePurse > 0)) sfx('coin')
    const totalKills = st.runKills + result.enemiesKilled
    const totalDowns = st.runDowns + result.downed

    // XP + evolution apply in both modes and both outcomes.
    // The War Diary relic tops up the least-levelled hero on the field.
    const { roster: rosterXp, evolutionQueue } = applyBattleXp(st.roster, diaryXp(result.perSentinel, st.roster, st.relics))

    if (st.mode === 'endless') {
      if (result.status === 'cleared') {
        const spoils = endlessRoundSpoils(st.round)
        // Copy-spend-write-back: the counter is mutated in place (M9).
        const pity = { ...st.lootPity }
        const loot = Array.from({ length: spoils.lootCount }, () =>
          generateItem(streams.rng, { luck: spoils.luck, roster: rosterXp, pity }),
        )
        set({
          // Loot drops into any empty slot it strictly improves; the rest
          // goes to the pack. Nothing worn is ever replaced.
          ...receiveItems(rosterXp, st.inventory, loot, st.relics),
          lootPity: pity,
          gold: st.gold + result.goldEarned,
          dust: st.dust + spoils.dustGain,
          baseHp: st.maxBaseHp,
          // A new round is a new shelf. The stock survives closing the room
          // (F5) precisely so it cannot be re-rolled on demand; this is the
          // one place it is allowed to change.
          merchant: null,
          lastResult: result,
          lastLoot: loot,
          evolutionQueue,
          wins: st.wins + 1,
          round: st.round + 1,
          // The Watch closes in: every round survived compounds Threat, the
          // same way clearing a campaign node does (H7).
          threat: threatAfterRound(st.threat, spoils.isElite),
          engine: null,
          battlePhase: 'setup',
          runKills: totalKills,
          runDowns: totalDowns,
        })
      } else {
        const lives = st.lives - 1
        if (lives <= 0) {
          // Endless pays through the SAME ledger as a campaign run (M13).
          const marks = useMetaStore
            .getState()
            .grantRunRewards({ mode: 'endless', depth: st.wins, won: false, kills: totalKills, downs: totalDowns, facts: runFactsFromState(st, false) })
          // The run is over, and losing has a sound (M32).
          sfx('defeat')
          set({
            roster: rosterXp,
            gold: st.gold + result.goldEarned,
            lives: 0,
            runPhase: 'lost',
            // Marks are granted right here, so the run is settled right here:
            // nothing downstream may pay it a second time (M-1).
            runSettled: true,
            lastResult: result,
            engine: null,
            battlePhase: 'setup',
            marksEarned: marks,
            runKills: totalKills,
            runDowns: totalDowns,
            evolutionQueue,
          })
        } else {
          // A lost ROUND with lives still in hand is not the run ending, so
          // it does not get the run's jingle — it gets the sound of something
          // of yours falling, and the retry is one tap away.
          sfx('down')
          // A LOST round does not advance the Watch (H7): a life is a retry,
          // not a skip — `round` and Threat stay where they were.
          set({
            roster: rosterXp,
            gold: st.gold + result.goldEarned,
            baseHp: st.maxBaseHp,
            lives,
            lastResult: result,
            engine: null,
            battlePhase: 'setup',
            runKills: totalKills,
            runDowns: totalDowns,
            evolutionQueue,
          })
        }
      }
      return
    }

    // ---- Campaign ----
    const { gold, inventory, runMap, activeNodeId } = st
    // A campaign wave with no node has nothing to pay into and nothing to
    // advance. Leave the battle rather than `return` with the engine mounted —
    // the rAF loop would call this forever (M-4). `startWave` refuses this
    // state outright; this is the belt to that braces.
    const node = activeNodeId ? runMap.nodes.find((n) => n.id === activeNodeId) : undefined
    if (!activeNodeId || !node) {
      set(abandonBattle(st.mode))
      return
    }

    if (result.status === 'defeated') {
      // The campaign has no lives: this wave loss IS the run loss (M32).
      sfx('defeat')
      const depth = get().clearedNodeIds.length - 1
      const marks = useMetaStore
        .getState()
        .grantRunRewards({ depth, won: false, kills: totalKills, downs: totalDowns, banner: st.runBanner, ...challengeGrant(st.challenge), facts: runFactsFromState(st, false) })
      set({
        runPhase: 'lost',
        // `grantRunRewards` just paid this run out; settling it here is what
        // stops `returnToHub` off the defeat screen paying it again (M-1).
        runSettled: true,
        lastResult: result,
        // The receipt is built here, while everything it needs is still in
        // hand (M14).
        victory: buildRecap(st, result, { won: false, depth, marks, kills: totalKills, downs: totalDowns }),
        baseHp: 0,
        engine: null,
        battlePhase: 'setup',
        runKills: totalKills,
        runDowns: totalDowns,
        marksEarned: marks,
      })
      return
    }

    // Advance the map.
    const banner = bannerRules(st.runBanner)
    const cleared = [...get().clearedNodeIds, activeNodeId]
    const reachable = frontierFrom(runMap, activeNodeId, cleared)
    const wonRun = node.type === 'boss'
    if (wonRun) sfx('victory')
    // An act boss down is a feat's fact; one felled without a scratch on the
    // Gate is a better one (Phase 3b).
    const actBoss = node.type === 'miniboss'
    const feats = {
      ...st.feats,
      actBosses: st.feats.actBosses + (actBoss ? 1 : 0),
      flawlessBosses: st.feats.flawlessBosses + (actBoss && result.baseHpLeft >= st.baseHp ? 1 : 0),
      goldPeak: Math.max(st.feats.goldPeak, gold + result.goldEarned + clearBonusGold(node)),
    }
    const marks = wonRun
      ? useMetaStore
          .getState()
          .grantRunRewards({
            depth: cleared.length - 1,
            won: true,
            kills: totalKills,
            downs: totalDowns,
            banner: st.runBanner,
            ...challengeGrant(st.challenge),
            facts: runFactsFromState({ ...st, feats, roster: rosterXp, clearedNodeIds: cleared }, true),
          })
      : 0
    // What the NODE costs and what the NODE pays: both follow the kind the map
    // dealt, not the one the Banner substituted (see `mapKind`).
    // Threat follows the road: the next stop is fought at the next layer's.
    const nextThreat = threatAfterLayer(node.layer, banner.startThreat)
    const bonusGold = clearBonusGold(node)
    const luck = nodeClearLuck(node)

    // Non-boss clears offer a card pick (attribute buff or item). Banner 1 —
    // Thin Pickings — cuts the hand to two.
    //
    // Copy-spend-write-back for the pity counter (M9). The two halves differ
    // in WHEN they spend it (F4): the boss's spoils go straight onto the
    // recap, so the player receives all three and they charge here; the reward
    // hand is an offer of which at most one card is taken, so it rolls with
    // the drought's luck and `chooseReward` charges the card actually picked.
    const pity = { ...st.lootPity }
    const handKind = node.type === 'miniboss' ? 'boss' : node.type === 'elite' ? 'elite' : 'battle'
    const reward = wonRun
      ? null
      : rewardHand(streams.rng, {
          // An act boss's hand is three relics; an elite's always holds one.
          kind: handKind,
          luck,
          count: handSize({ thinPickings: banner.thinPickings }),
          noBattleRelics: banner.thinPickings,
          held: st.relics,
          unlocked: relicUnlocked,
          roster: rosterXp,
          pity,
        })
    // The Relic Cartulary: one more relic beside an act boss's hand, from its
    // own seeded stream so the service re-deals nothing else in the run.
    if (reward && handKind === 'boss' && runUnlocked('cartulary')) {
      const extra = cartularyRelic(new RNG(hashSeed(st.runSeed, 'cartulary', node.layer)), { luck, held: st.relics, hand: reward, unlocked: relicUnlocked })
      if (extra) reward.push(extra)
    }
    // The boss's spoils go on the RECAP, not into the inventory of a run that
    // has just ended (M16).
    const bossLoot = wonRun
      ? Array.from({ length: 3 }, () => generateItem(streams.rng, { luck, roster: rosterXp, pity }))
      : []

    // After each act boss, the Crossroads: recruit or mutate (Phase 3b).
    const fireFork = !wonRun && forkFires(node)
    // Both halves of the fork are dealt HERE, from the seeded run stream, and
    // then live in run state until the player answers (M8) — so the offer
    // survives a snapshot unchanged and "aim at another hero" is not a reroll.
    const crossroads: Crossroads | null = fireFork
      ? {
          recruits: rosterXp.length < MAX_ROSTER && !banner.noRecruits ? recruitSlate(streams.rng, rosterXp, recruitHub(st.relics)) : [],
          mutations: rollMutationChoices(
            streams.rng,
            // Nothing already on the company's books — the offer must not
            // contain an option that is a no-op for the hero it lands on.
            [...new Set(rosterXp.flatMap((s) => (s.mutations ?? []).map((m) => m.key)))],
            // Two under Vow 1 (Thin Pickings: half the offer), else three — one
            // of each template (Phase 3b). The Strange Growth feat adds one.
            mutationOfferSize(banner.thinPickings, featUnlocked('mutant')),
          ),
          mutationHeroId: null,
        }
      : null

    set({
      roster: rosterXp,
      // Field Surgeon's Kit and the Tithe Box pay on every won fight.
      ...afterFightRelics(st.relics, { baseHp: result.baseHpLeft, maxBaseHp: st.maxBaseHp, gold: gold + result.goldEarned + bonusGold }),
      inventory: wonRun ? inventory : [...inventory, ...bossLoot],
      threat: nextThreat,
      lastResult: result,
      lastLoot: bossLoot,
      lootPity: pity,
      victory: wonRun
        ? buildRecap(st, result, { won: true, depth: cleared.length - 1, marks, kills: totalKills, downs: totalDowns, spoils: bossLoot, roster: rosterXp })
        : null,
      reward,
      crossroads,
      forkDone: st.forkDone || fireFork,
      evolutionQueue,
      clearedNodeIds: cleared,
      feats,
      currentNodeId: activeNodeId,
      reachableNodeIds: reachable,
      runPhase: wonRun ? 'won' : 'active',
      // The boss clear is the only campaign win, and it pays on the spot.
      runSettled: wonRun,
      engine: null,
      // The wave is over, so the phase says so (C-1). Leaving it at 'battle'
      // made the persisted post-wave state describe a fight still in progress
      // and left the shell with no way out of a cleared wave.
      battlePhase: 'setup',
      runKills: totalKills,
      runDowns: totalDowns,
      marksEarned: marks,
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
    // Endless returns to the Rooms screen; campaign returns to the node map.
    const st = get()
    const dest = st.mode === 'endless' ? 'endless' : 'map'
    // A reward that has not been taken is still owed. Leaving the summary is
    // "I've read this", not "I forfeit my pick" — the campaign's reward board
    // lives on the map screen, so it is waiting there.
    set({
      screen: dest,
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
function hudOf(engine: GameEngine) {
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
