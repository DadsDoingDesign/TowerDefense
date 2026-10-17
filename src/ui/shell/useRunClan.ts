import type { ClanId } from '../../game/data/clans'
import { runClan } from '../../game/run/clans'
import { useGameStore } from '../../state/gameStore'

/**
 * The goblin clan raiding the run's road now (`run/clans.runClan`), for every
 * surface that names or pictures an enemy: pass it to `clans.enemyName` and
 * `clans.clanArtId`. Off a run: `DEFAULT_CLAN`.
 */
export const useRunClan = (): ClanId => useGameStore((s) => runClan(s))

/** The same, read once (outside React: the battle ledger, the announcer). */
export const runClanNow = (): ClanId => runClan(useGameStore.getState())
