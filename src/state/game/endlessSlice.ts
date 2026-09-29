/**
 * Endless Watch slice: starting the mode, its rooms (merchant / forge / shrine
 * / recruit) and beginning each round's wave. The round's settlement lives in
 * `battleSlice.finishBattle` beside the campaign's.
 */
import { newRunSeed } from '../../game/core/rng'
import { canUpgrade, creditPity, generateItem, reforgeDust, reforgeItem, upgradeDust, upgradeRarity, type RosterRef } from '../../game/data/items'
import { rollShrine } from '../../game/data/shrines'
import { generateEndlessWave } from '../../game/data/waves'
import {
  ENDLESS_START_DUST,
  ENDLESS_START_GOLD,
  endlessMerchantLuck,
  MAX_ROSTER,
  rollMerchantShelf,
} from '../../game/run/economy'
import { findItem, replaceItem } from '../../game/run/inventory'
import { buildStartingRoster, receiveItems, recruitSlate, RECRUIT_ARCHETYPES, scaledRecruit, withRecruits } from '../../game/run/recruits'
import type { Item } from '../../game/types'
import type { RNG } from '../../game/core/rng'
import { sfx, sfxRarity } from '../../audio/audio'
import { useMetaStore } from '../metaStore'
import { CLEAR_SHELL, freshHud, freshRunState } from './fresh'
import { hub, layout, recruitHub, seedRunStreams, streams } from './runtime'
import { orientField } from '../../game/data/maps'
import { settleSavedRun } from './settle'
import type { EndlessRoom, Slice } from './types'

export interface EndlessActions {
  startEndless: () => void
  endlessOpenRoom: (room: EndlessRoom) => void
  endlessCloseRoom: () => void
  endlessBeginWave: () => void
  endlessBuyItem: (itemId: string) => void
  /** Hire a specific candidate from `recruitOptions` (defaults to the first). */
  endlessRecruit: (candidateId?: string) => void
  endlessForgeReforge: (itemId: string) => void
  endlessForgeUpgrade: (itemId: string) => void
  endlessShrineAccept: () => void
}

/**
 * The Endless Watch's opening pack: three forced-rarity pieces and the
 * Quartermaster rolls, weighted for the roster it is dealt for (M9). The
 * CAMPAIGN kit is not dealt here — it is dealt after the hero is picked, for
 * that hero, by `engine/kit.startingKit`.
 *
 * No pity is threaded on purpose: these are forced-rarity/luck-0.1 opening
 * items, not the drought the pity timer exists to end.
 */
function endlessInventory(rng: RNG, extra: number, roster: readonly RosterRef[]): Item[] {
  const items = [
    generateItem(rng, { slot: 'oneHand', rarity: 'common', roster }),
    generateItem(rng, { slot: 'body', rarity: 'common', roster }),
    generateItem(rng, { slot: 'offHand', rarity: 'rare', roster }),
  ]
  for (let i = 0; i < extra; i++) items.push(generateItem(rng, { luck: 0.1, roster }))
  return items
}

export const createEndlessSlice: Slice<EndlessActions> = (set, get) => ({
  startEndless: () => {
    // Same contract as `newRun`: the saved run is settled, not dropped (M-2).
    settleSavedRun(get, set)
    hub.runUsesHub = true
    const b = useMetaStore.getState().bonuses()
    const runSeed = newRunSeed()
    seedRunStreams(runSeed)
    // Order-preserving: fresh run (deals the map), then roster (spends ids and
    // the loot stream), then the inventory dealt FOR that roster (M9).
    const fresh = freshRunState(runSeed)
    const roster = buildStartingRoster(streams.rng, b)
    set({
      // The same shared reset as `newRun` (m-2): neither entry point may
      // inherit the other's leftovers.
      ...fresh,
      mode: 'endless',
      runSeed,
      screen: 'endless',
      gold: ENDLESS_START_GOLD,
      dust: ENDLESS_START_DUST,
      baseHp: b.maxBaseHp,
      maxBaseHp: b.maxBaseHp,
      enemyHpMult: b.enemyHpMult,
      ...receiveItems(roster, [], endlessInventory(streams.rng, b.extraItems, roster)),
    })
  },

  /*
   * Every `endless*` action below is a no-op outside Endless Watch (m-2).
   *
   * The shell forks on `st.endlessRoom` rather than on `st.mode`, so a stale
   * room leaking out of an endless run once turned a real campaign shrine into
   * a dispatch of `endlessShrineAccept`. `freshRunState` stops the leak; this
   * stops the whole class. Mode is the only thing that decides which half of
   * the game an action belongs to.
   */
  endlessOpenRoom: (room) => {
    const { roster, mode, lootPity, merchant } = get()
    if (mode !== 'endless') return
    if (room === 'merchant') {
      // ---- one shelf per round, not one per tap (F5) --------------------
      //
      // The stock survives a close and is re-rolled only when the round
      // advances (see `finishBattle`) — otherwise opening and closing the room
      // is a free re-roll that also churns the pity counter. Buying removes the
      // entry, so re-opening shows what is left rather than what might have been.
      if (merchant) {
        set({ endlessRoom: 'merchant' })
        return
      }
      // An offer, so the drought's luck applies but the counter is not spent;
      // `endlessBuyItem` charges it on the sale (F4).
      const items = rollMerchantShelf(streams.rng, { luck: endlessMerchantLuck(get().round), roster, pity: lootPity })
      set({ endlessRoom: 'merchant', merchant: { items, recruit: null } })
    } else if (room === 'shrine') {
      set({ endlessRoom: 'shrine', shrineOffer: rollShrine(streams.rng) })
    } else if (room === 'recruit') {
      set({ endlessRoom: 'recruit', recruitOptions: roster.length < MAX_ROSTER ? recruitSlate(streams.rng, roster, recruitHub()) : [] })
    } else {
      set({ endlessRoom: 'forge' })
    }
  },

  // The merchant's stock is deliberately NOT cleared here (F5): it belongs to
  // the round, not to the visit, and dropping it is what made re-opening the
  // room a free re-roll. The shrine offer and the recruit slate are cleared
  // because declining them IS the answer to them.
  endlessCloseRoom: () => set({ endlessRoom: null, shrineOffer: null, recruitOptions: [] }),

  endlessBeginWave: () => {
    if (get().mode !== 'endless') return
    const wave = generateEndlessWave(get().round, get().runSeed)
    const { baseHp, maxBaseHp } = get()
    set({
      currentWave: wave,
      // Chosen per battle from the layout (Portrait battlefields), as `selectNode`.
      battleMap: orientField(get().battleMap, layout.orientation()),
      battlePhase: 'setup',
      screen: 'battle',
      endlessRoom: null,
      selectedSentinelId: null,
      lastResult: null,
      lastLoot: [],
      hud: { ...freshHud(), baseHp, maxBaseHp, enemiesTotal: wave.spawns.length },
      ...CLEAR_SHELL,
    })
  },

  endlessBuyItem: (itemId) => {
    const { merchant, gold, inventory, mode, lootPity } = get()
    if (mode !== 'endless' || !merchant) return
    const entry = merchant.items.find((e) => e.item.id === itemId)
    if (!entry || gold < entry.price) return
    // The sale is the drop (F4) — see `buyMerchantItem`.
    const pity = { ...lootPity }
    creditPity(pity, entry.item.rarity)
    sfx('coin')
    sfxRarity(entry.item.rarity)
    set({
      gold: gold - entry.price,
      ...receiveItems(get().roster, inventory, [entry.item]),
      lootPity: pity,
      merchant: { ...merchant, items: merchant.items.filter((e) => e.item.id !== itemId) },
    })
  },

  endlessRecruit: (candidateId) => {
    const { gold, roster, endlessRecruitCost, recruitOptions, mode } = get()
    if (mode !== 'endless') return
    if (roster.length >= MAX_ROSTER || gold < endlessRecruitCost) return
    // Hire the candidate the player actually tapped; only fall back to the
    // first when no id was supplied (legacy callers).
    const chosen = candidateId ? recruitOptions.find((s) => s.id === candidateId) : undefined
    if (candidateId && !chosen) return
    const pick = chosen ?? recruitOptions[0] ?? scaledRecruit(streams.rng, streams.rng.pick(RECRUIT_ARCHETYPES), roster, recruitHub())
    set({
      gold: gold - endlessRecruitCost,
      ...withRecruits(roster, get().evolutionQueue, [pick], get().inventory),
      endlessRecruitCost: Math.round(endlessRecruitCost * 1.6),
      endlessRoom: null,
      recruitOptions: [],
    })
  },

  endlessForgeReforge: (itemId) => {
    const { dust, mode } = get()
    if (mode !== 'endless') return
    const found = findItem(get().inventory, get().roster, itemId)
    if (!found) return
    const cost = reforgeDust(found.item)
    if (dust < cost) return
    set(replaceItem(get().inventory, get().roster, itemId, reforgeItem(found.item, streams.rng)))
    set({ dust: dust - cost })
  },

  endlessForgeUpgrade: (itemId) => {
    const { dust, mode } = get()
    if (mode !== 'endless') return
    const found = findItem(get().inventory, get().roster, itemId)
    if (!found || !canUpgrade(found.item)) return
    const cost = upgradeDust(found.item)
    if (dust < cost) return
    set(replaceItem(get().inventory, get().roster, itemId, upgradeRarity(found.item, streams.rng)))
    set({ dust: dust - cost })
  },

  endlessShrineAccept: () => {
    const { shrineOffer, roster, baseHp, gold, mode } = get()
    if (mode !== 'endless' || !shrineOffer) return
    const eff = shrineOffer.apply({ roster, baseHp, gold })
    // The Endless twin of the campaign shrine, and it was silent for the same
    // reason (F12).
    if ((eff.goldDelta ?? 0) > 0) sfx('coin')
    set({
      roster: eff.roster ?? roster,
      baseHp: Math.max(1, baseHp + (eff.baseHpDelta ?? 0)),
      gold: Math.max(0, gold + (eff.goldDelta ?? 0)),
      endlessRoom: null,
      shrineOffer: null,
    })
  },
})
