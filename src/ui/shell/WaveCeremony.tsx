import { useEffect, useRef, useState } from 'react'
import { RARITY } from '../../game/data/items'
import { useGameStore } from '../../state/gameStore'
import { useSettingsStore } from '../../state/settingsStore'
import { useBattleLedger } from '../battleLedger'
import { itemName } from '../channels'
import { Icon } from '../Icon'
import { Money } from './Money'
import { battleLayoutOf } from './live'
import { grantWords, rewardInPlace } from './levelUps'

/**
 * A number that counts up to its value once, when it first appears. Instant
 * under reduced motion — the number is the information, the roll is not.
 */
function useCountUp(target: number, ms = 700): number {
  const reduced = useSettingsStore((s) => s.reducedMotion)
  const [v, setV] = useState(reduced ? target : 0)
  const from = useRef(0)
  useEffect(() => {
    if (reduced) {
      setV(target)
      return
    }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms)
      const eased = 1 - Math.pow(1 - k, 3)
      setV(Math.round(a + (target - a) * eased))
      if (k < 1) raf = requestAnimationFrame(step)
      else from.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms, reduced])
  return v
}

/**
 * The wave-clear beat, on the Stage (Phase 2, finding 3).
 *
 * A cleared wave used to be one line in the footer. Now the field itself says
 * so: a banner the moment the last enemy falls (during the store's 0.9s hold),
 * then — once the wave settles — the gold and XP counting up, and a call-out
 * for every hero who levelled ("Doyle → Lv 5"). The fight is over, so covering
 * the field is allowed here; the Continue control stays where it always is, in
 * the wave strip, so the thumb does not have to find a new place.
 *
 * Not a live region: `Announcer` owns the one polite voice for "wave cleared".
 */
export function WaveCeremony() {
  const layout = useGameStore(battleLayoutOf)
  const beat = useGameStore((s) => s.waveBeat)
  const result = useGameStore((s) => s.lastResult)
  const loot = useGameStore((s) => s.lastLoot)
  const roster = useGameStore((s) => s.roster)
  const mode = useGameStore((s) => s.mode)
  const waveLabel = useGameStore((s) => s.currentWave?.label ?? '')
  const isBossWave = useGameStore((s) => !!s.currentWave?.isBoss)
  const lives = useGameStore((s) => s.lives)
  const startLevels = useBattleLedger((s) => s.startLevels)
  // G3-2: after a normal wave the reward hand is in the Selector and the
  // level-ups are on the roster, so the Stage says only the result — one line
  // over a dimmed field, which stays visible around it.
  const inPlace = useGameStore(rewardInPlace)

  const settled = layout === 'settled' && !!result
  const status = beat?.status ?? result?.status
  const gold = useCountUp(settled ? result!.goldEarned : 0)
  const xpTotal = settled ? Math.round(result!.perSentinel.reduce((a, p) => a + p.xpGained, 0)) : 0
  const xp = useCountUp(xpTotal)

  if (layout !== 'live' && layout !== 'settled') return null
  if (!beat && !settled) return null
  const won = status === 'cleared'
  const elite = /elite/i.test(waveLabel) || isBossWave

  const levelUps = settled
    ? roster.filter((h) => startLevels[h.id] !== undefined && h.level > startLevels[h.id])
    : []
  const rows = settled ? [...result!.perSentinel].sort((a, b) => b.damageDealt - a.damageDealt) : []

  if (settled && inPlace) {
    return (
      <div className="sh-ceremony won settled compact">
        <div className="sh-ceremony-banner">
          <Icon name="wave" />
          <span>Wave cleared</span>
        </div>
        <p className="sh-ceremony-line">
          <span className="sh-ceremony-sum">
            <Money amount={gold} c="gold" /> <small>gold</small>
          </span>
          <span className="sh-ceremony-sum">
            <b>+{xp}</b> <small>xp</small>
          </span>
          <span className="sh-ceremony-sum">
            <b>{result!.enemiesKilled}</b> <small>felled</small>
          </span>
        </p>
        {result!.enemiesLeaked > 0 && (
          <p className="sh-ceremony-note">
            {result!.enemiesLeaked} reached the Gate · Gate {result!.baseHpLeft} left
          </p>
        )}
      </div>
    )
  }

  return (
    <div className={`sh-ceremony ${won ? 'won' : 'lost'} ${elite ? 'elite' : ''} ${settled ? 'settled' : 'beat'}`}>
      <div className="sh-ceremony-banner">
        <Icon name={won ? (elite ? 'crown' : 'wave') : 'warn'} />
        <span>{won ? (elite ? 'Elite wave cleared' : 'Wave cleared') : mode === 'endless' ? 'The line broke' : 'The Gate fell'}</span>
      </div>
      {settled && (
        <div className="sh-ceremony-card">
          <div className="sh-ceremony-sums">
            <span className="sh-ceremony-sum">
              <Money amount={gold} c="gold" /> <small>gold</small>
            </span>
            <span className="sh-ceremony-sum">
              <b>+{xp}</b> <small>xp</small>
            </span>
            <span className="sh-ceremony-sum">
              <b>{result!.enemiesKilled}</b> <small>felled</small>
            </span>
          </div>
          {!won && mode === 'endless' && (
            <p className="sh-ceremony-note">
              A retry is spent and the Gate is rebuilt. {lives} {lives === 1 ? 'retry' : 'retries'} left.
            </p>
          )}
          {result!.enemiesLeaked > 0 && (
            <p className="sh-ceremony-note">
              {result!.enemiesLeaked} reached the Gate · Gate {result!.baseHpLeft} left
            </p>
          )}
          {levelUps.length > 0 && (
            <ul className="sh-ceremony-levels">
              {levelUps.map((h) => (
                <li key={h.id}>
                  <Icon name="evolve" /> {h.name} → Lv {h.level}
                  {grantWords(h.archetype, startLevels[h.id], h.level) && <small>{grantWords(h.archetype, startLevels[h.id], h.level)}</small>}
                </li>
              ))}
            </ul>
          )}
          {rows.length > 0 && (
            <div className="sh-ceremony-roll">
              {rows.slice(0, 5).map((r) => {
                const hero = roster.find((h) => h.id === r.id)
                return (
                  <div className="sh-ceremony-row" key={r.id}>
                    <span className="sh-ceremony-who">{hero?.name ?? 'Hero'}</span>
                    <span className="sh-ceremony-what">
                      {r.kills} kills · {Math.round(r.damageDealt)} dmg
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          {loot.length > 0 && (
            <p className="sh-ceremony-note loot">
              <Icon name="loot" /> Found: {loot.map((i) => `${itemName(i)} (${RARITY[i.rarity].label})`).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
