/**
 * Retiring a run: pay out whatever it earned, exactly once, then un-live it.
 * What a run is OWED is the pure `game/run/settle.planPayout`; this file owns
 * WHICH run gets settled and the once-only guarantee.
 */
import { goblinKinds, planPayout, runFacts, type SettleFacts } from '../../game/run/settle'
import { useMetaStore } from '../metaStore'
import { clearSnapshot, loadRunSnapshot, payoutFromRaw } from '../runSnapshot'
import { session } from './runtime'
import { isLiveRun } from './selectors'
import type { GameData, GetState, SetState } from './types'

export const settleFactsFromState = (s: GameData, won = false): SettleFacts => ({
  depth: Math.max(0, s.clearedNodeIds.length - 1),
  kills: s.runKills,
  gold: s.gold,
  contract: s.contract,
  challenge: s.challenge,
  facts: runFactsFromState(s, won),
})

/** The feats' facts for the run in memory (Phase 3b). */
export function runFactsFromState(s: GameData, won: boolean) {
  const layers = s.runMap.nodes.filter((n) => s.clearedNodeIds.includes(n.id)).map((n) => n.layer)
  return runFacts({
    won,
    feats: s.feats,
    roster: s.roster,
    deepestLayer: layers.length ? Math.max(...layers) : 0,
    crates: s.contract?.crates ?? 0,
    goblinsSeen: goblinKinds(useMetaStore.getState().codex.enemies),
  })
}

/*
 * There is no `settleFactsFromSnapshot`, on purpose: `payoutFromRaw` reads the
 * same numbers out of any payload, resumable or not, and a `RunSnapshot` is
 * one — so both paths go through it and cannot drift apart.
 */

/** Make the ledger call a retired run is owed (see `planPayout`). */
export function payOutRun(f: SettleFacts): void {
  const meta = useMetaStore.getState()
  const plan = planPayout(f)
  if (plan.kind === 'deposit') meta.deposit(plan.amount)
  else if (plan.kind === 'grant') meta.settleContract(plan.grant)
}

/**
 * End the current run: pay out whatever it earned, then RETIRE it (M-1 / M-2).
 *
 * Every path that destroys a run goes through here — `beginCampaign`,
 * `discardSavedRun` and `returnToHub` — because overwriting the storage key
 * with a fresh run silently cost the player everything they had earned.
 *
 * The rule that stops paying TWICE (never flush first — a flush of a LIVE run
 * WRITES it, and the next lines would load and pay that write; history in
 * docs/AUDIT_2026-08-20.md, M-1):
 *
 *  - Memory is authoritative for the run this session is holding. Storage may
 *    be a coalesced write behind, and flushing it is exactly the bug.
 *  - Storage is only consulted for a run this session never took up — a
 *    previous session's snapshot, identified by a `runSeed` that is not ours.
 *  - `runSettled` makes the whole thing idempotent: whatever was paid, the run
 *    is retired, which un-lives it. A run `finishBattle` or `cashOut` already
 *    settled (both set the flag) is never paid a second time here.
 */
export function settleSavedRun(get: GetState, set: SetState): void {
  const st = get()
  const { snap, unresumable } = loadRunSnapshot()

  /*
   * Payability and resumability are separate questions (M-1): an
   * unresumable-but-readable payload settles here like any other foreign run —
   * paid once, then discarded rather than offered back.
   */
  const stored = snap ? payoutFromRaw(snap) : unresumable

  if (stored && stored.runSeed !== st.runSeed) {
    // Someone else's run — a previous session's, never resumed here.
    payOutRun(stored)
  } else if (!st.runSettled && isLiveRun(st)) {
    // Our own run, still unpaid. Pay it from memory and destroy it in the same
    // breath — there is no window in which it is both paid and still live.
    payOutRun(settleFactsFromState(st))
  }

  /*
   * Known, documented gap: two tabs can have A pay B's still-running run and B
   * pay it again later from its own memory. See docs/AUDIT_2026-08-20.md.
   */
  clearSnapshot()
  session.ownsRun = false
  set({ runSettled: true })
}
