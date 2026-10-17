import type { ClanId } from '../../game/data/clans'
import { runClan } from '../../game/run/clans'
import { useGameStore } from '../../state/gameStore'

/**
 * The goblin clan raiding the run's road now (`run/clans.runClan`), for every
 * surface that names or pictures an enemy: pass it to `clans.enemyName` and
 * `clans.clanArtId`. Null off a run and on a hand-made bench field.
 */
export const useRunClan = (): ClanId | null => useGameStore((s) => runClan(s))

/** The same, read once (outside React: the battle ledger, the announcer). */
export const runClanNow = (): ClanId | null => runClan(useGameStore.getState())
