/**
 * The Phase 3b stops as Offers: the campfire, and the two new things a
 * merchant's counter sells (a Gate repair and a shelf reroll).
 *
 * Kept out of `offers.ts` on purpose — the shell's offer builders are being
 * restructured in parallel, so these live in their own module and `offers.ts`
 * mounts them with one line each. They follow the same Offer contract: one
 * action per offer, a price on anything that spends, and the numbers quoted
 * from the rule that applies them (`run/campfire.ts`, `run/economy.ts`).
 */
import { lookVar } from '../channels'
import { kitName } from '../../game/data/gear'
import { cargoPct, cargoShare } from '../../game/run/contracts'
import { heroLookArt } from './offers'
import { CAMPFIRE_REPAIR, canTrain, restGain, xpToNextLevel } from '../../game/run/campfire'
import { GATE_REPAIR, rerollCost } from '../../game/run/economy'
import { restockFree, shelfSize } from '../../game/run/relics'
import type { useGameStore } from '../../state/gameStore'
import type { Offer } from './offers'

type St = ReturnType<typeof useGameStore.getState>

/**
 * Rest or train — one of the two, and the stop is spent either way. A rest on
 * a full Gate is offered but says it would restore nothing, rather than hiding:
 * the choice is still "train someone, or waste the fire".
 */
export function campfireOffers(st: St): Offer[] {
  // The Gate is the caravan: a rest rounds up cargo that scattered, said as
  // the share of the cargo it wins back.
  const gain = cargoShare(restGain(st.baseHp, st.maxBaseHp), st.maxBaseHp)
  const now = cargoPct(st.baseHp, st.maxBaseHp)
  const rest: Offer = {
    id: 'campfire-rest',
    title: 'Rest by the fire',
    sub: gain > 0 ? `Cargo +${gain}%` : 'Cargo is whole',
    icon: 'base',
    body: [
      `A night to round up stray cargo: +${cargoShare(CAMPFIRE_REPAIR, st.maxBaseHp)}%, up to all of it (${now}% now).`,
      'Resting spends the campfire. No one trains tonight.',
    ],
    action: { label: gain > 0 ? `Rest — cargo +${gain}%` : 'Rest anyway', run: () => st.campfireRest(), done: gain > 0 ? `Cargo +${gain}%` : undefined },
  }
  const train: Offer[] = st.roster.map((s) => {
    const able = canTrain(s)
    return {
      id: `campfire-train-${s.id}`,
      title: `Train ${s.name}`,
      sub: able ? `Level ${s.level} → ${s.level + 1}` : 'Already level 20',
      color: lookVar(s),
      rowArt: heroLookArt(s),
      body: able
        ? [
            `${s.name} (${kitName(s)}) gains a full level: +${xpToNextLevel(s)} XP.`,
            ...(s.level + 1 === 5 || s.level + 1 === 10 || s.level + 1 === 15 ? [`Level ${s.level + 1} brings a skill choice.`] : []),
            'Training spends the campfire. No stray cargo is rounded up.',
          ]
        : [`${s.name} is at the level cap. Training would do nothing.`],
      action: {
        label: able ? `Train ${s.name}` : 'At the cap',
        run: () => st.campfireTrain(s.id),
        disabled: !able,
        done: able ? `${s.name} reached level ${s.level + 1}` : undefined,
      },
    }
  })
  const walk: Offer = {
    id: 'campfire-leave',
    title: 'Walk on',
    icon: 'back',
    immediate: true,
    body: ['Leave the fire unlit and march.'],
    action: { label: 'Walk on', run: () => st.leaveEvent() },
  }
  // The page preselects the first row, so lead with the useful choice: the
  // rest on a hurt Gate, a trainable hero on a full one. A full Gate used to
  // open on "Rest by the fire — Gate is full" with "Rest anyway" as the big
  // button, i.e. one tap from wasting the fire.
  const trainable = train.some((o) => !o.action?.disabled)
  return gain > 0 || !trainable ? [rest, ...train, walk] : [...train, rest, walk]
}

/**
 * The two counter services a campaign merchant sells beside its shelf. An
 * Endless merchant room has neither (its stock is re-dealt every round).
 */
export function merchantServiceOffers(st: St): Offer[] {
  const m = st.merchant
  if (!m) return []
  const out: Offer[] = []
  if (m.repair) {
    const r = m.repair
    const full = st.baseHp >= st.maxBaseHp
    const gain = cargoShare(Math.min(r.hp, st.maxBaseHp - st.baseHp), st.maxBaseHp)
    out.push({
      id: 'merchant-repair',
      title: 'Wagon repair',
      sub: full ? 'Cargo is whole' : `Cargo +${gain}%`,
      icon: 'base',
      cost: { amount: r.price, currency: 'gold' },
      dim: st.gold < r.price || full,
      body: [`Timber, rope and a buyer for what was stolen: +${cargoShare(GATE_REPAIR.hp, st.maxBaseHp)}% cargo, up to all of it (${cargoPct(st.baseHp, st.maxBaseHp)}% now). One per visit.`],
      action: {
        label: full ? 'Cargo is whole' : `Repair — cargo +${gain}%`,
        cost: { amount: r.price, currency: 'gold' },
        run: () => st.buyGateRepair(),
        disabled: full || st.gold < r.price,
        done: `Cargo +${gain}%`,
      },
    })
  }
  // The Quartermaster's Seal makes the first restock at each stall free.
  const cost = restockFree(st.relics, m.rerolls ?? 0) ? 0 : rerollCost(m.rerolls ?? 0)
  out.push({
    id: 'merchant-reroll',
    title: 'Restock the shelf',
    sub: 'New wares',
    icon: 'loot',
    cost: { amount: cost, currency: 'gold' },
    dim: st.gold < cost,
    body: [`The merchant lays out ${shelfSize(st.relics)} new items. Each restock here costs 15 gold more than the last.`],
    action: {
      label: 'Restock',
      cost: { amount: cost, currency: 'gold' },
      run: () => st.rerollMerchant(),
      disabled: st.gold < cost,
      done: 'New wares on the shelf',
    },
  })
  return out
}
