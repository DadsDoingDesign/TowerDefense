import { ACHIEVEMENTS } from '../../game/data/achievements'
import { lastFeats, useMetaStore } from '../../state/metaStore'
import { moneyText } from '../channels'
import { InfoCard } from './Page'

/**
 * The feats this settle earned (Phase 3b), on the run's receipt.
 *
 * A feat is the game telling the player "you opened something", so it is said
 * where the run ends and names what it opened. The ids come from the settle
 * itself (`lastFeats`, written by `settleContract`); subscribing to the
 * ledger re-renders the card the moment the settle lands. The result page is
 * already a polite live region, so the card is announced with the verdict.
 */
export function FeatsEarned() {
  // Read for the re-render only: the ledger changes exactly when a feat lands.
  useMetaStore((s) => s.achievements)
  const feats = lastFeats.ids.map((id) => ACHIEVEMENTS.find((a) => a.id === id)).filter((a) => a !== undefined)
  if (feats.length === 0) return null
  return (
    <InfoCard
      lines={[
        feats.length === 1 ? 'Feat earned' : `${feats.length} feats earned`,
        ...feats.map((a) => `${a.name} — ${moneyText(a.gold)} to the bank.${a.opens ? ` Opens: ${a.opens}.` : ''}`),
        'Every feat and what is still open is in the Codex.',
      ]}
    />
  )
}
