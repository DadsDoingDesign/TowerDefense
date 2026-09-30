/**
 * Events slice: the campaign's special nodes (merchant / shrine / recruit), the
 * post-wave reward pick, and the mid-map crossroads fork.
 */
import { creditPity } from '../../game/data/items'
import { merchantLuck, MAX_ROSTER, repairGate, rerollCost, rollMerchantShelf } from '../../game/run/economy'
import { canTrain, forageAtCampfire, restAtCampfire, trainAtCampfire } from '../../game/run/campfire'
import { receiveItems, withRecruits } from '../../game/run/recruits'
import { applyRewardCard } from '../../game/run/rewards'
import { applyBattleXp } from '../../game/run/battle'
import { restockFree, shelfSize } from '../../game/run/relics'
import { sfx, sfxRarity, sfxReward } from '../../audio/audio'
import { CLEAR_SHELL } from './fresh'
import { bannerRules, useMetaStore } from '../metaStore'
import { completeNode } from './nodes'
import { runUnlocked, streams } from './runtime'
import type { Slice } from './types'

export interface EventActions {
  chooseReward: (cardId: string) => void
  recruitTeammate: (sentinelId: string) => void
  /**
   * Aim the fork's mutation offer at a hero. Commits nothing and rolls nothing —
   * the three options were rolled when the fork fired, and stay the same
   * whichever hero is aimed at (see `Crossroads`).
   */
  aimHeroMutation: (heroId: string | null) => void
  /**
   * @deprecated Kept as the old name for `aimHeroMutation` while the shell
   * migrates. It no longer rolls: the choice is `chooseHeroMutation`.
   */
  rollHeroMutation: (heroId: string) => void
  /** Commit one of the offered mutations to a hero. Permanent, once per hero. */
  chooseHeroMutation: (heroId: string, mutationId: string) => void
  finishCrossroads: () => void
  buyMerchantItem: (itemId: string) => void
  buyMerchantRecruit: () => void
  leaveEvent: () => void
  acceptShrine: () => void
  declineShrine: () => void
  acceptRecruit: (sentinelId: string) => void
  skipRecruit: () => void
  /** Campfire (Phase 3b): the Gate recovers `CAMPFIRE_REPAIR`, and the stop is spent. */
  campfireRest: () => void
  /** Campfire: one hero gains a full level, and the stop is spent. */
  campfireTrain: (sentinelId: string) => void
  /** Campfire with the Field Kitchen: forage `CAMPFIRE_FORAGE` gold, and the stop is spent. */
  campfireForage: () => void
  /** Buy the merchant's Gate repair (once per visit). */
  buyGateRepair: () => void
  /** Reroll the merchant's four-item shelf, at `rerollCost(rerolls)`. */
  rerollMerchant: () => void
}

export const createEventsSlice: Slice<EventActions> = (set, get) => ({
  chooseReward: (cardId) => {
    const { reward, roster, inventory, runMods, lootPity, relics } = get()
    if (!reward) return
    const card = reward.find((c) => c.id === cardId)
    if (!card) return
    // ---- ceremony (Phase 3) ----------------------------------------------
    // An item gets a sting whose length, brightness and reverb follow its
    // rarity — ALONE, because the `reward` sample layered on top masked the
    // ladder. Anything without a sting gets the (trimmed) `reward` sample.
    // Rarity is on the card in words, letter and pips, so this is a second
    // channel, never the only one.
    sfxReward(card.kind === 'item' ? card.item?.rarity : undefined)
    if (card.kind !== 'item' || !card.item) sfx('upgrade')
    // The pity counter moves for the card actually taken, and only if it is an
    // item (F4) — see `applyRewardCard`.
    const next = applyRewardCard({ roster, inventory, runMods, lootPity, relics }, card)
    if (card.kind === 'relic' && card.relic) useMetaStore.getState().recordCodex({ relics: [card.relic] })
    // Applying a reward returns to the map — or to the mid-map fork if it fired.
    set({
      roster: next.roster,
      inventory: next.inventory,
      runMods: next.runMods,
      lootPity: next.lootPity,
      relics: next.relics,
      reward: null,
      screen: get().crossroads ? 'crossroads' : 'map',
      activeNodeId: null,
      currentWave: null,
      lastResult: null,
      lastLoot: [],
      battlePhase: 'setup',
      ...CLEAR_SHELL,
    })
  },

  recruitTeammate: (sentinelId) => {
    const { crossroads, roster } = get()
    if (!crossroads) return
    // ---- the fork is once-per-run and EXCLUSIVE (F2) ---------------------
    //
    // `chooseHeroMutation` deliberately leaves `crossroads` non-null (with its
    // recruits) so the reveal can render — so without this line, mutating and
    // then recruiting takes BOTH branches of a "recruit OR mutate" fork.
    //
    // The guard belongs on the ACTION, not on the screen — same rule as
    // `startWave` (C-1): whatever a future screen or a restored snapshot
    // renders, the branch is closed once the fork is answered. The mirror case
    // needs no guard: `recruitTeammate` nulls `crossroads`, which is what the
    // mutation actions already refuse on.
    if (crossroads.revealed) return
    const hero = crossroads.recruits.find((s) => s.id === sentinelId)
    if (!hero || roster.length >= MAX_ROSTER) return
    set({
      ...withRecruits(roster, get().evolutionQueue, [hero], get().inventory, get().relics),
      crossroads: null,
      screen: 'map',
    })
  },

  aimHeroMutation: (heroId) => {
    const { crossroads, roster } = get()
    if (!crossroads || crossroads.revealed) return
    // Aiming at nobody is a legitimate "back out of the mutation branch".
    if (heroId !== null && !roster.some((s) => s.id === heroId)) return
    set({ crossroads: { ...crossroads, mutationHeroId: heroId } })
  },

  // The old name, pointed at the new behaviour so the shell keeps compiling
  // while it is rewired. It used to roll AND commit in one tap.
  rollHeroMutation: (heroId) => get().aimHeroMutation(heroId),

  chooseHeroMutation: (heroId, mutationId) => {
    const { crossroads, roster } = get()
    if (!crossroads || crossroads.revealed) return
    const hero = roster.find((s) => s.id === heroId)
    if (!hero) return
    // Only ever one of the options that were actually offered — a mutation id
    // from anywhere else would be a reroll by another name.
    const mutation = crossroads.mutations.find((m) => m.id === mutationId)
    if (!mutation) return
    // One of each key per hero: the offer excludes held keys already, but the
    // rule belongs on the commit, which is the thing that is irreversible.
    if ((hero.mutations ?? []).some((m) => m.key === mutation.key)) return
    const nextRoster = roster.map((s) =>
      s.id === heroId ? { ...s, mutations: [...(s.mutations ?? []), mutation] } : s,
    )
    set({
      roster: nextRoster,
      crossroads: { ...crossroads, mutationHeroId: heroId, revealed: { heroName: hero.name, mutation } },
    })
  },

  finishCrossroads: () => set({ crossroads: null, screen: 'map' }),

  // ---- events ----
  buyMerchantItem: (itemId) => {
    const { merchant, gold, inventory, lootPity, roster } = get()
    if (!merchant) return
    const entry = merchant.items.find((e) => e.item.id === itemId)
    if (!entry || gold < entry.price) return
    // The sale is the drop, so the sale is what charges the pity counter (F4).
    // The three items the player walked past are not drops and cost nothing.
    const pity = { ...lootPity }
    creditPity(pity, entry.item.rarity)
    // Coin first, then the tier's sting, so it reads as "paid, and look what for".
    sfx('coin')
    sfxRarity(entry.item.rarity)
    set({
      gold: gold - entry.price,
      ...receiveItems(roster, inventory, [entry.item], get().relics),
      lootPity: pity,
      merchant: { ...merchant, items: merchant.items.filter((e) => e.item.id !== itemId) },
    })
  },

  buyMerchantRecruit: () => {
    const { merchant, gold, roster } = get()
    if (!merchant?.recruit || gold < merchant.recruit.price || roster.length >= MAX_ROSTER) return
    set({
      gold: gold - merchant.recruit.price,
      ...withRecruits(roster, get().evolutionQueue, [merchant.recruit.sentinel], get().inventory, get().relics),
      merchant: { ...merchant, recruit: null },
    })
  },

  leaveEvent: () => {
    const { event } = get()
    if (event) completeNode(get, set, event.nodeId)
  },

  acceptShrine: () => {
    const { shrineOffer, roster, baseHp, gold, event } = get()
    if (!shrineOffer || !event) return
    const eff = shrineOffer.apply({ roster, baseHp, gold })
    const newBaseHp = Math.max(1, baseHp + (eff.baseHpDelta ?? 0))
    // Only a GAIN of coin sounds (F12): a shrine that takes gold is paying for
    // something else, and that something has its own voice.
    if ((eff.goldDelta ?? 0) > 0) sfx('coin')
    set({
      roster: eff.roster ?? roster,
      baseHp: newBaseHp,
      gold: Math.max(0, gold + (eff.goldDelta ?? 0)),
    })
    completeNode(get, set, event.nodeId)
  },

  declineShrine: () => {
    const { event } = get()
    if (event) completeNode(get, set, event.nodeId)
  },

  acceptRecruit: (sentinelId) => {
    const { recruitOptions, roster, event } = get()
    if (!event) return
    const pick = recruitOptions.find((s) => s.id === sentinelId)
    if (pick && roster.length < MAX_ROSTER) {
      set({ ...withRecruits(roster, get().evolutionQueue, [pick], get().inventory, get().relics) })
    }
    completeNode(get, set, event.nodeId)
  },

  skipRecruit: () => {
    const { event } = get()
    if (event) completeNode(get, set, event.nodeId)
  },

  // ---- campfire (Phase 3b) ----
  // One of two, and the stop is spent either way: the choice IS the node.
  campfireRest: () => {
    const { event, baseHp, maxBaseHp } = get()
    if (event?.kind !== 'campfire') return
    set({ baseHp: restAtCampfire(baseHp, maxBaseHp) })
    sfx('upgrade')
    completeNode(get, set, event.nodeId)
  },

  campfireTrain: (sentinelId) => {
    const { event, roster, evolutionQueue } = get()
    if (event?.kind !== 'campfire') return
    const hero = roster.find((s) => s.id === sentinelId)
    if (!hero || !canTrain(hero)) return
    const trained = trainAtCampfire(hero)
    const nextRoster = roster.map((s) => (s.id === sentinelId ? trained : s))
    // A level that crosses 10 or 20 owes a branch choice, exactly as a wave's XP does.
    const owed = applyBattleXp(nextRoster, []).evolutionQueue
    set({ roster: nextRoster, evolutionQueue: [...new Set([...evolutionQueue, ...owed])] })
    sfx('upgrade')
    completeNode(get, set, event.nodeId)
  },

  campfireForage: () => {
    const { event, gold, feats } = get()
    if (event?.kind !== 'campfire' || !runUnlocked('fieldKitchen')) return
    const next = forageAtCampfire(gold)
    set({ gold: next, feats: { ...feats, goldPeak: Math.max(feats.goldPeak, next) } })
    sfx('coin')
    completeNode(get, set, event.nodeId)
  },

  buyGateRepair: () => {
    const { merchant, gold, baseHp, maxBaseHp } = get()
    const repair = merchant?.repair
    if (!merchant || !repair || gold < repair.price || baseHp >= maxBaseHp) return
    sfx('coin')
    set({ gold: gold - repair.price, baseHp: repairGate(baseHp, maxBaseHp), merchant: { ...merchant, repair: null } })
  },

  rerollMerchant: () => {
    const { merchant, gold, event, runMap, roster, lootPity, mode, relics, runBanner } = get()
    if (!merchant || mode !== 'campaign' || event?.kind !== 'merchant') return
    // The Quartermaster's Seal makes the first restock at each stall free.
    const cost = restockFree(relics, merchant.rerolls ?? 0) ? 0 : rerollCost(merchant.rerolls ?? 0)
    if (gold < cost) return sfx('error')
    const node = runMap.nodes.find((n) => n.id === event.nodeId)
    const items = rollMerchantShelf(streams.rng, { luck: merchantLuck(node?.layer ?? 0), roster, pity: lootPity, size: shelfSize(relics, bannerRules(runBanner).thinPickings) })
    sfx('coin')
    set({ gold: gold - cost, merchant: { ...merchant, items, rerolls: (merchant.rerolls ?? 0) + 1 } })
  },
})
