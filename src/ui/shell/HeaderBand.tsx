import { fieldTitle } from '../../game/data/maps'
import { cargoPct } from '../../game/run/contracts'
import { routeOf } from '../../game/run/charter'
import { SovereignCrest } from '../pixel'
import { MAX_BASE_HP, useGameStore } from '../../state/gameStore'
import { Icon } from '../Icon'
import { Crate } from '../pixel'
import { Money } from './Money'
import { strengthPct, strengthShort, strengthText } from '../channels'
import { useShown } from './staging'

/**
 * Band 1 — run state, and nothing else. It never holds a control that changes
 * the subject; it only reports where you stand.
 *
 * Only battle and the run map use the four-band layout, and both are inside a
 * run, so this band is never the Watchtower's. The meta variant it used to
 * carry (brand + currency chip) was unreachable and is gone — the menu is a
 * page, and its bank chip lives in the page title block.
 *
 * The mercenary company: the Gate is the caravan, so its bar reads CARGO and a
 * percentage — the share of the cargo still on the wagons, which is what every
 * city pays by. Gold here is the PURSE (the bank stays home).
 */
export function HeaderBand() {
  const gold = useGameStore((s) => s.gold)
  const threat = useGameStore((s) => s.threat)
  const company = useGameStore((s) => s.contract?.company ?? null)
  const charter = useGameStore((s) => !!s.contract?.charter)
  const hasContract = useGameStore((s) => !!s.contract)
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
  const cargo = cargoPct(baseHp, maxHp)
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
        {depthShown && (
        <span className="sh-chip" role="img" aria-label={`Depth ${depth} of ${lastLayer}`}>
          {/* H2: "Depth 1" is the heading and "/12" the context. */}
          <b className="sh-chip-lead">Depth {depth}</b>
          <span className="sh-chip-of">/{lastLayer}</span>
        </span>
        )}
        {charter && (
          /* The in-run marker (the endgame charter): this road is your own. */
          <span className="sh-chip sov" role="img" aria-label="Sovereign Route: all or nothing">
            <SovereignCrest scale={1} />
            <span className="sh-chip-sov" aria-hidden="true">
              Sovereign
            </span>
          </span>
        )}
        {threat > 1.001 && (
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
      </div>

      <div className="sh-header-row sub">
        <span className="sh-base" role="img" aria-label={`Cargo ${cargo}%`}>
          {/* The crate, in the route's colour: the cargo is what the wagons carry. */}
          <span className="sh-base-glyph sh-cargo-crate">
            <Crate color={hasContract ? routeOf({ company, charter }).color : '#e0ac4c'} scale={1} />
          </span>
          {/* The word, visibly (Wave 1): the bar says WHAT it measures. */}
          <span className="sh-base-word" aria-hidden="true">
            Cargo
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
            {cargo}%
          </span>
        </span>
        <span className="sh-res">
          <span className="sh-chip gold" title="Your purse: the bank stays home">
            <Money amount={goldDisplay} c="gold" />
          </span>
        </span>
      </div>
    </header>
  )
}
