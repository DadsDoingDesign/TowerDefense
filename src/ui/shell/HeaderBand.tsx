import { fieldTitle } from '../../game/data/maps'
import { MAX_BASE_HP, useGameStore } from '../../state/gameStore'
import { Icon } from '../Icon'
import { Money } from './Money'
import { strengthPct, strengthShort, strengthText } from '../channels'
import { useShown } from './staging'

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
  // The map's own length. "Depth 3" says nothing about how far there is left to
  // go; "Depth 3/10" is the difference between pacing a run and guessing at it
  // (M6).
  const runMap = useGameStore((s) => s.runMap)
  const currentNodeId = useGameStore((s) => s.currentNodeId)
  const activeNodeId = useGameStore((s) => s.activeNodeId)
  const screen = useGameStore((s) => s.screen)
  const baseHpStore = useGameStore((s) => s.baseHp)
  const battlePhase = useGameStore((s) => s.battlePhase)
  const hud = useGameStore((s) => s.hud)
  const mapName = useGameStore((s) => fieldTitle(s.battleMap))
  // LS3: a first battle's header carries two numbers, the Gate and gold. The
  // road's length arrives with the first win (`state/staging.ts`).
  const depthShown = useShown('depth')

  const inBattle = battlePhase === 'battle'
  const baseHp = inBattle ? hud.baseHp : baseHpStore
  const maxHp = hud.maxBaseHp || MAX_BASE_HP
  const hpFrac = Math.max(0, baseHp) / maxHp
  const hpNow = Math.max(0, Math.ceil(baseHp))
  const goldDisplay = gold + (inBattle ? hud.goldEarned : 0)
  /*
   * Depth is the LAYER of the node you are on (Wave 1).
   *
   * It was `clearedNodeIds.length - 1`, which counts nodes already FINISHED —
   * so the first battle's header said "Depth 0/10" while the wave bar right
   * below it said "DEPTH 1", because a wave is labelled by its node's layer.
   * Both read the layer now: the battle being fought, or on the map the node
   * the company stands on, out of the boss's layer.
   */
  const nodeId = screen === 'battle' && activeNodeId ? activeNodeId : currentNodeId
  const depth = runMap.nodes.find((n) => n.id === nodeId)?.layer ?? 0
  const lastLayer = Math.max(depth, runMap.layers - 1)

  // The live "N LEFT" status is gone from this band (Wave 1). The live count
  // was on screen three times at once — here (where it wrapped to a second
  // line), in the context panel and in the wave bar. It lives in the wave bar
  // only now, beside the wave's name and its progress.

  return (
    <header className="sh-header" aria-label="Run status">
      <div className="sh-header-row">
        {/* The bands' heading (Phase 2): focus lands here when the screen
            changes, and its name says which screen it is. */}
        <h1 className="sh-brand" tabIndex={-1} aria-label={screen === 'battle' ? `Battle — ${mapName}` : 'Run map'}>
          FIELDWATCH
        </h1>
        {(mode === 'endless' || depthShown) && (
        <span
          className="sh-chip"
          role="img"
          aria-label={mode === 'endless' ? `Round ${round}` : `Depth ${depth} of ${lastLayer}`}
        >
          {/* H2: "Depth 1" is the heading and "/12" the context — they were one
              run of same-size text, so the block read without a headline. */}
          {mode === 'endless' ? (
            `Round ${round}`
          ) : (
            <>
              <b className="sh-chip-lead">Depth {depth}</b>
              <span className="sh-chip-of">/{lastLayer}</span>
            </>
          )}
        </span>
        )}
        {mode === 'campaign' && threat > 1.001 && (
          /* The name is accessible, and the first time this chip appears the
             coach strip says it out loud once (WS9 — `Coach`, tip `threat`). */
          <span
            className="sh-chip threat"
            role="img"
            aria-label={`${strengthText(threat)}: enemies have ${strengthPct(threat)}% more HP`}
          >
            <Icon name="threat" /> {strengthShort(threat)}
          </span>
        )}
        {mode === 'endless' && (
          /* Was a heart and a bare "3". The heart is the HP mark everywhere
             else, and nothing said that a lost wave spends one of these and
             rebuilds the Gate. The word is on the chip now (Wave 1). */
          <span
            className="sh-chip threat"
            role="img"
            aria-label={`${lives} ${lives === 1 ? 'retry' : 'retries'} left: a lost wave spends one and rebuilds the Gate`}
          >
            {lives} {lives === 1 ? 'retry' : 'retries'}
          </span>
        )}
      </div>

      <div className="sh-header-row sub">
        <span className="sh-base" role="img" aria-label={`Gate ${hpNow} of ${maxHp}`}>
          {/* Was `⬡`, one anti-aliased pixel from `⬢`. The keep is the keep. */}
          <Icon name="base" className="sh-base-glyph" />
          {/* The word, visibly (Wave 1): "20/20" beside a bar never said WHAT
              was twenty. It is the Gate — the one noun for base HP. */}
          <span className="sh-base-word" aria-hidden="true">
            Gate
          </span>
          <span className="sh-base-bar">
            <span
              className="sh-base-fill"
              style={{
                width: `${hpFrac * 100}%`,
                background: hpFrac > 0.5 ? 'var(--good)' : hpFrac > 0.25 ? 'var(--warn)' : 'var(--bad)',
              }}
            />
          </span>
          <span className="sh-base-val" aria-hidden="true">
            {hpNow}/{maxHp}
          </span>
        </span>
        <span className="sh-res">
          <span className="sh-chip gold">
            <Money amount={goldDisplay} c="gold" />
          </span>
          {mode === 'endless' && (
            <span className="sh-chip teal">
              <Money amount={dust} c="dust" />
            </span>
          )}
        </span>
      </div>
    </header>
  )
}
