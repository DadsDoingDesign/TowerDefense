/**
 * Contract slice (the mercenary company): the contract board and its terms,
 * signing a contract, and the cities' "cash out or press on".
 *
 * The rules are pure (`game/run/contracts.ts`, `game/run/standing.ts`); this
 * slice only holds the board's choices and applies the rules to the run.
 */
import { hashSeed, newRunSeed } from '../../game/core/rng'
import { COMPANY_IDS, FIRST_COMPANY, type CompanyId } from '../../game/data/companies'
import {
  cargoPct,
  cashOutValue,
  clampCrates,
  clampPurse,
  CRATE_PRICE,
  crateCap,
  defaultPurse,
  marketOfDay,
  utcDateKey,
} from '../../game/run/contracts'
import { companyOpen, standingOf } from '../../game/run/standing'
import { contractGrant } from '../../game/run/settle'
import { sfx } from '../../audio/audio'
import { useMetaStore } from '../metaStore'
import { useSettingsStore } from '../settingsStore'
import { menuStaged } from '../staging'
import { STANDARD_RUN } from '../seeds'
import { buildRecap } from './recap'
import { settleFactsFromState } from './settle'
import type { ContractOrder } from './runSlice'
import type { ContractBoard, Slice } from './types'

export interface ContractActions {
  /**
   * "Start a Run": the contract board. A first-timer (LS3) skips it — one free
   * escort for Peppercorn Co., straight to the hero pick; the board, the
   * stakes, the purse and the cash-out open after the first finished
   * contract. `terms` pre-sets the board (the end screen's "another
   * contract"); `step` opens it on the terms.
   */
  openContracts: (terms?: Partial<ContractOrder>, step?: ContractBoard['step']) => void
  /** Choose a company on the board. */
  boardPick: (company: CompanyId) => void
  /** From the board to the chosen company's terms. */
  boardTerms: () => void
  /** One step back: terms → board → menu. */
  boardBack: () => void
  /** Set the stake (0: the free escort), clamped to the standing cap and the bank. */
  setCrates: (crates: number) => void
  /** Set the purse, clamped to what the bank holds after the stake. */
  setPurse: (purse: number) => void
  /** Sign the contract on the board's terms: on to the hero pick. */
  signContract: () => void
  /** At a city: keep going for the bigger payout. */
  pressOn: () => void
  /**
   * At a city: sell the crates still on the wagons at half their value and
   * head home. Standing earned so far is kept; no completion bonus, no item
   * chances, no contract skill.
   */
  cashOut: () => void
}

type Meta = ReturnType<typeof useMetaStore.getState>

/** The most crates this save can stake with `company`: its standing cap, and what the bank can pay. */
export function stakeCap(meta: Pick<Meta, 'standing' | 'bank'>, company: CompanyId): number {
  return Math.min(crateCap(standingOf(meta.standing, company)), Math.floor(Math.max(0, meta.bank) / CRATE_PRICE))
}

/** The company the board opens on: the one asked for, today's market, or the first that hires. */
function boardCompany(meta: Pick<Meta, 'standing'>, want?: CompanyId): CompanyId {
  const open = COMPANY_IDS.filter((c) => companyOpen(c, meta.standing))
  if (want && open.includes(want)) return want
  const hot = marketOfDay(utcDateKey())
  return open.includes(hot) ? hot : (open[0] ?? FIRST_COMPANY)
}

/** A board with its stake and purse clamped to what this save may set. */
function clampBoard(b: ContractBoard, meta: Pick<Meta, 'standing' | 'bank'>): ContractBoard {
  const crates = clampCrates(b.crates, stakeCap(meta, b.company))
  return { ...b, crates, purse: clampPurse(b.purse, meta.bank - crates * CRATE_PRICE) }
}

export const createContractSlice: Slice<ContractActions> = (set, get) => ({
  openContracts: (terms, step = 'board') => {
    const meta = useMetaStore.getState()
    if (menuStaged(meta.stats, useSettingsStore.getState().showEverything)) {
      // LS3: the first contract is one free escort — no board, no stakes, no
      // purse choice, no market. The purse is the default one.
      get().beginCampaign(newRunSeed(), STANDARD_RUN, { company: FIRST_COMPANY, crates: 0, purse: defaultPurse(meta.bank) })
      return
    }
    const company = boardCompany(meta, terms?.company)
    const board = clampBoard(
      { seed: newRunSeed(), company, step, crates: terms?.crates ?? 0, purse: terms?.purse ?? defaultPurse(meta.bank) },
      meta,
    )
    set({ screen: 'contracts', board, shellSelection: null })
  },

  boardPick: (company) => {
    const b = get().board
    const meta = useMetaStore.getState()
    if (!b || !companyOpen(company, meta.standing)) return
    set({ board: clampBoard({ ...b, company }, meta) })
  },

  boardTerms: () => {
    const b = get().board
    if (!b) return
    set({ board: { ...b, step: 'terms' } })
    useSettingsStore.getState().markTaught('board')
  },

  boardBack: () => {
    const b = get().board
    if (b?.step === 'terms') return set({ board: { ...b, step: 'board' } })
    set({ screen: 'hub', board: null })
  },

  setCrates: (crates) => {
    const b = get().board
    if (!b) return
    const next = clampBoard({ ...b, crates }, useMetaStore.getState())
    if (next.crates === b.crates) return crates === b.crates ? undefined : sfx('error')
    set({ board: next })
    useSettingsStore.getState().markTaught('stakes')
  },

  setPurse: (purse) => {
    const b = get().board
    if (!b) return
    const meta = useMetaStore.getState()
    set({ board: { ...b, purse: clampPurse(purse, meta.bank - b.crates * CRATE_PRICE) } })
    useSettingsStore.getState().markTaught('purse')
  },

  signContract: () => {
    const b = get().board
    if (!b) return
    const meta = useMetaStore.getState()
    if (!companyOpen(b.company, meta.standing)) return
    const terms = clampBoard(b, meta)
    useSettingsStore.getState().markTaught('board')
    // Each company's contract on this board deals its own seed.
    get().beginCampaign(hashSeed(b.seed, 'contract', b.company), STANDARD_RUN, { company: terms.company, crates: terms.crates, purse: terms.purse })
  },

  pressOn: () => {
    const c = get().contract
    if (!c || c.pending == null || c.status !== 'open') return
    set({ contract: { ...c, pending: null } })
    useSettingsStore.getState().markTaught('cashOut')
    sfx('confirm')
  },

  cashOut: () => {
    const st = get()
    const c = st.contract
    // A first contract cannot cash out (LS3): its cities only pay.
    if (!c || c.pending == null || c.status !== 'open' || st.runSettled || st.firstRun) return
    const sale = cashOutValue(c, c.paid.length, cargoPct(st.baseHp, st.maxBaseHp))
    const contract = { ...c, cashOut: sale, pending: null, status: 'cashedOut' as const }
    const next = { ...st, contract }
    // The settle happens HERE, so the run is retired here: nothing downstream
    // may pay it a second time (M-1).
    const deposit = useMetaStore.getState().settleContract(contractGrant(settleFactsFromState(next, false), 'cashedOut'))
    sfx('coin')
    useSettingsStore.getState().markTaught('cashOut')
    set({
      contract,
      runPhase: 'cashedOut',
      runSettled: true,
      reward: null,
      crossroads: null,
      victory: buildRecap(next, null, { outcome: 'cashedOut', depth: Math.max(0, st.clearedNodeIds.length - 1), kills: st.runKills, deposit }),
    })
  },
})
