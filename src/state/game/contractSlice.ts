/**
 * Contract slice (the mercenary company): the contract board and its terms,
 * signing a contract, and the cities' "cash out or press on".
 *
 * The rules are pure (`game/run/contracts.ts`, `game/run/standing.ts`); this
 * slice only holds the board's choices and applies the rules to the run.
 */
import { hashSeed, newRunSeed } from '../../game/core/rng'
import { COMPANY_IDS, FIRST_COMPANY, type CompanyId } from '../../game/data/companies'
import { canCashOut, cargoPct, cashOutValue, clampCrates, CRATE_PRICE, crateCap, marketOfDay, marketOpen, utcDateKey } from '../../game/run/contracts'
import { companyOpen, standingOf } from '../../game/run/standing'
import { CHARTER_FEE, charterDoor } from '../../game/run/charter'
import { contractGrant } from '../../game/run/settle'
import { sfx } from '../../audio/audio'
import { useMetaStore } from '../metaStore'
import { useSettingsStore } from '../settingsStore'
import { menuStaged, stakesShown } from '../staging'
import { STANDARD_RUN } from '../seeds'
import { buildRecap } from './recap'
import { settleFactsFromState } from './settle'
import type { ContractOrder } from './runSlice'
import type { ContractBoard, Slice } from './types'

export interface ContractActions {
  /**
   * "Start a Run": the contract board. A first-timer (LS3) skips it — one free
   * escort for Peppercorn Co., straight to the hero pick; the board and the
   * cash-out open after the first finished contract, stakes per company at
   * standing 2 with it (the staggered reveal). `terms` pre-sets the board (the
   * end screen's "another contract"); `step` opens it on the terms.
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
  /** Sign the contract on the board's terms: on to the hero pick. */
  signContract: () => void
  /**
   * Sponsor the Sovereign Route (the endgame charter): on to the hero pick,
   * with the company advance every contract carries. Refused while the door
   * is shut or the bank cannot pay the fee. The fee leaves the bank when the
   * hero is committed, as a stake does.
   */
  signCharter: () => void
  /** At a city: keep going for the bigger payout. */
  pressOn: () => void
  /**
   * At a city: sell the crates still on the wagons at full value and head
   * home. Standing earned so far is kept; no completion bonus, no item
   * chances, no contract skill.
   */
  cashOut: () => void
}

type Meta = ReturnType<typeof useMetaStore.getState>

/**
 * The most crates this save can stake with `company`: none until stakes open
 * with it (standing 2, the staggered reveal), then its standing cap and what
 * the bank can pay.
 */
export function stakeCap(meta: Pick<Meta, 'standing' | 'bank'>, company: CompanyId): number {
  if (!stakesShown(meta.standing, company, useSettingsStore.getState().showEverything)) return 0
  return Math.min(crateCap(standingOf(meta.standing, company)), Math.floor(Math.max(0, meta.bank) / CRATE_PRICE))
}

/** Whether this save may sponsor the Sovereign Route now: the door open, the fee in the bank, and no first contract pending. */
export function charterOpen(meta: Pick<Meta, 'skills' | 'items' | 'bank' | 'stats'>): boolean {
  if (menuStaged(meta.stats, useSettingsStore.getState().showEverything)) return false
  return charterDoor({ skills: meta.skills, items: meta.items ?? [] }).open && meta.bank >= CHARTER_FEE
}

/** The company the board opens on: the one asked for, today's market (once it is open), or the first that hires. */
function boardCompany(meta: Pick<Meta, 'standing' | 'stats'>, want?: CompanyId): CompanyId {
  const open = COMPANY_IDS.filter((c) => companyOpen(c, meta.standing))
  if (want && open.includes(want)) return want
  const hot = marketOfDay(utcDateKey())
  const market = marketOpen(meta.stats.runsCompleted) || useSettingsStore.getState().showEverything
  return market && open.includes(hot) ? hot : (open[0] ?? FIRST_COMPANY)
}

/** A board with its stake clamped to what this save may set. */
function clampBoard(b: ContractBoard, meta: Pick<Meta, 'standing' | 'bank'>): ContractBoard {
  return { ...b, crates: clampCrates(b.crates, stakeCap(meta, b.company)) }
}

export const createContractSlice: Slice<ContractActions> = (set, get) => ({
  openContracts: (terms, step = 'board') => {
    const meta = useMetaStore.getState()
    if (menuStaged(meta.stats, useSettingsStore.getState().showEverything)) {
      // LS3: the first contract is one free escort — no board, no stakes, no
      // market. The purse is the company's advance, as on every contract.
      get().beginCampaign(newRunSeed(), STANDARD_RUN, { company: FIRST_COMPANY, crates: 0 })
      return
    }
    const company = boardCompany(meta, terms?.company ?? undefined)
    const board = clampBoard(
      { seed: newRunSeed(), company, step, crates: terms?.crates ?? 0 },
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

  signContract: () => {
    const b = get().board
    if (!b) return
    const meta = useMetaStore.getState()
    if (!companyOpen(b.company, meta.standing)) return
    const terms = clampBoard(b, meta)
    useSettingsStore.getState().markTaught('board')
    // Each company's contract on this board deals its own seed.
    get().beginCampaign(hashSeed(b.seed, 'contract', b.company), STANDARD_RUN, { company: terms.company, crates: terms.crates })
  },

  signCharter: () => {
    const meta = useMetaStore.getState()
    if (!charterOpen(meta)) return sfx('error')
    get().beginCampaign(newRunSeed(), STANDARD_RUN, { company: null, charter: true, crates: 0 })
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
    // A first contract cannot cash out at its first city (LS3: there it learns
    // that cities pay), nor can the Sovereign Route: all or nothing.
    if (!c || c.pending == null || c.status !== 'open' || st.runSettled || !canCashOut(c, st.firstRun)) return
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
