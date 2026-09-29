import { MAX_BASE_HP, useGameStore } from '../../state/gameStore'
import { Icon } from '../Icon'

/**
 * Band 1 — run state, and nothing else. It never holds a control that changes
 * the subject; it only reports where you stand.
 *
 * Only battle and the run map use the four-band layout, and both are inside a
 * run, so this band is never the Watchtower's. The meta variant it used to
 * carry (brand + marks chip) was unreachable and is gone — the Watchtower is a
 * page, and its marks chip lives in the page title block.
 */
export function HeaderBand() {
  const mode = useGameStore((s) => s.mode)
  const gold = useGameStore((s) => s.gold)
  const dust = useGameStore((s) => s.dust)
  const threat = useGameStore((s) => s.threat)
  const lives = useGameStore((s) => s.lives)
  const round = useGameStore((s) => s.round)
  const clearedNodeIds = useGameStore((s) => s.clearedNodeIds)
  // The map's own length. "Depth 3" says nothing about how far there is left to
  // go; "Depth 3/10" is the difference between pacing a run and guessing at it
  // — and the Cartographer's Table makes the map longer, which the player had
  // no way of seeing either (M6).
  const layers = useGameStore((s) => s.runMap.layers)
  const baseHpStore = useGameStore((s) => s.baseHp)
  const battlePhase = useGameStore((s) => s.battlePhase)
  const hud = useGameStore((s) => s.hud)

  const inBattle = battlePhase === 'battle'
  const baseHp = inBattle ? hud.baseHp : baseHpStore
  const maxHp = hud.maxBaseHp || MAX_BASE_HP
  const hpFrac = Math.max(0, baseHp) / maxHp
  const goldDisplay = gold + (inBattle ? hud.goldEarned : 0)
  const depth = Math.max(0, clearedNodeIds.length - 1)

  // There is no 'RUN OVER' branch: a run that is not active takes the result
  // page instead (useShellContext answers `stage: 'result', layout: 'page'` for
  // it), so this band is only ever mounted mid-run and the status could never
  // read anything but LIVE or nothing. That is the same argument that retired
  // the meta variant described above — this branch was simply missed with it.
  const status = inBattle ? `LIVE · ${hud.enemiesTotal - hud.enemiesSpawned + hud.enemiesAlive} LEFT` : null

  return (
    <header className="sh-header">
      <div className="sh-header-row">
        <span className="sh-brand">FIELDWATCH</span>
        <span className="sh-chip">
          {mode === 'endless' ? `Round ${round}` : `Depth ${depth}/${Math.max(depth, layers - 1)}`}
        </span>
        {mode === 'campaign' && threat > 1.001 && (
          /* The `title` was the ONLY explanation of what ⚡ meant, and `title`
             does not exist on a touch device. The name is accessible now, and
             the first time this chip appears the coach strip says it out loud
             once (WS9 — `Coach`, tip `threat`). */
          <span
            className="sh-chip threat"
            role="img"
            aria-label={`Threat ${threat.toFixed(2)} times — enemies scale up as the run grows`}
          >
            <Icon name="threat" /> ×{threat.toFixed(2)}
          </span>
        )}
        {mode === 'endless' && (
          <span className="sh-chip threat" role="img" aria-label={`${lives} lives left`}>
            <Icon name="hp" /> {lives}
          </span>
        )}
        {status && <span className="sh-status">{status}</span>}
      </div>

      <div className="sh-header-row sub">
        <span className="sh-base" role="img" aria-label={`Base integrity ${Math.max(0, Math.ceil(baseHp))} of ${maxHp}`}>
          {/* Was `⬡`, one anti-aliased pixel from `⬢`, which was the mark on
              every Watchtower perk row. The keep is the keep. */}
          <Icon name="base" className="sh-base-glyph" />
          <span className="sh-base-bar">
            <span
              className="sh-base-fill"
              style={{
                width: `${hpFrac * 100}%`,
                background: hpFrac > 0.5 ? 'var(--good)' : hpFrac > 0.25 ? 'var(--warn)' : 'var(--bad)',
              }}
            />
          </span>
          <span className="sh-base-val">
            {Math.max(0, Math.ceil(baseHp))}/{maxHp}
          </span>
        </span>
        <span className="sh-res">
          <span className="sh-chip gold">
            <Icon name="gold" /> {goldDisplay}
          </span>
          {mode === 'endless' && (
            <span className="sh-chip teal">
              <Icon name="dust" /> {dust}
            </span>
          )}
        </span>
      </div>
    </header>
  )
}
