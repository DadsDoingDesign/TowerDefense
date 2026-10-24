import { useEffect, useState } from 'react'
import { useGameStore } from '../../state/gameStore'
import { placementsCount } from './heroCardModel'
import { lineUp, queueFor, queueWidth } from './enemyQueue'
import { wavePreviewShown } from './live'
import { WaveQueue } from './WaveQueue'
import { useRunClan } from './useRunClan'

/** How long the preview takes to fade once the wave starts (matches `.sh-wavepre` in battle-band.css). */
const FADE_MS = 240

/**
 * The coming wave, over the Stage's top edge (the battle band, Oct 2026; the
 * designer: "the bottom wave preview should overlay the map instead").
 *
 * It was the setup half of the wave strip under the party — its name, "Post a
 * hero" / "8 enemies", and the line-up — and it took the bottom band's middle.
 * It now hangs from the top of the Stage, where the road comes in: the
 * wave's name and the moment's words, then who is coming in spawn order (the
 * strip's own `WaveQueue`, the same portraits and counts).
 *
 *  - **Where.** Centred along the top edge, over the woodland and the road's
 *    way in. `BattleCanvas` keeps the play clear of it: when the field's first
 *    row of tiles sits higher than the preview's foot, the field is fit below
 *    it (the champion plate's mechanism), so it never covers a post, the
 *    lane's middle or the wagon (`frame.previewRoom`).
 *  - **Tappable.** A portrait opens the enemy's info card, hung under the
 *    preview; the name opens the wave's whole make-up — what each kind shrugs
 *    off, the ground, the threat — in the Context panel.
 *  - **When.** Setup only. Start Wave fades it; the live strip's queue says
 *    who is still to come from then on.
 *
 * It takes no tap outside its own controls (the Stage under it stays the
 * field), and it is not a live region (`Announcer` is the battle's one voice).
 */
export function WavePreview() {
  const shown = useGameStore(wavePreviewShown)
  const wave = useGameStore((s) => s.currentWave)
  const hud = useGameStore((s) => s.hud)
  const deployed = useGameStore(placementsCount)
  const shellSelect = useGameStore((s) => s.shellSelect)
  const clan = useRunClan()
  // Kept for one fade after the wave starts, then gone.
  const [mounted, setMounted] = useState(shown)
  useEffect(() => {
    if (shown) return setMounted(true)
    const t = window.setTimeout(() => setMounted(false), FADE_MS)
    return () => window.clearTimeout(t)
  }, [shown])
  if (!mounted || !wave) return null

  const n = wave.spawns.length
  const entries = lineUp(queueFor(wave, 'setup', hud), clan)
  const readWave = () => {
    // Nothing selected is the Context panel's wave read-out (`EmptyPanel`).
    if (useGameStore.getState().shellSelection) shellSelect(null)
    useGameStore.setState({ detailOpen: true })
  }
  return (
    <div className={`sh-wavepre${shown ? '' : ' out'}`} role="group" aria-label="The coming wave">
      <button type="button" className="sh-wavepre-cap" data-sfx="toggle" aria-controls="sh-detail-panels" onClick={readWave} aria-label={`${wave.label}: ${n} enemies — read the wave`}>
        <span className="sh-wavepre-name" aria-hidden="true">
          {wave.label}
        </span>
        <span className={`sh-wavepre-now${deployed ? '' : ' do'}`} aria-hidden="true">
          {deployed ? `${n} enemies` : 'Post a hero'} <span className="sh-wavepre-more">›</span>
        </span>
      </button>
      <WaveQueue
        entries={entries}
        width={queueWidth(entries.length)}
        lead="This wave"
        emptyText="No enemies"
        countNote="in this wave"
        anchor=".sh-wavepre"
        cardBelow
      />
    </div>
  )
}
