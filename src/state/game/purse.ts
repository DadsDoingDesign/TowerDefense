/**
 * The purse's ledger, store side: gold the road pays into the purse is
 * recorded on the contract (`contract.earned`) so the settle can tell the
 * purse you brought from the road's gold (`game/run/hq.homeGold`), and a full
 * pack's sale pays into the purse with a receipt.
 */
import { earn } from '../../game/run/contracts'
import { soldText } from '../../game/run/inventory'
import type { Item } from '../../game/types'
import type { GameData } from './types'

/** The purse and the contract after the road paid `gain` gold (a gain only). */
export function roadPays(st: Pick<GameData, 'gold' | 'contract'>, gain: number): Pick<GameData, 'gold' | 'contract'> {
  const n = Math.max(0, Math.floor(gain))
  return { gold: st.gold + n, contract: earn(st.contract, n) }
}

/** A full pack's sale (`inventory.stow`): the gold into the purse, and the receipt. Nothing when nothing sold. */
export function packSale(st: Pick<GameData, 'gold' | 'contract'>, sold: readonly Item[], gold: number): Partial<GameData> {
  if (!sold.length) return {}
  return { ...roadPays(st, gold), gearNotice: { text: soldText(sold, gold), at: Date.now() } }
}

/** The run's pack slots (`RunHq.pack`), or no limit for a run with no contract. */
export const packSlotsOf = (st: Pick<GameData, 'contract'>): number => st.contract?.hq.pack ?? Infinity
