import { useEffect } from 'react'
import { nodeMeta } from '../../game/data/runmap'
import { useGameStore } from '../../state/gameStore'
import { encounterThreat } from '../../game/run/threat'
import { legMult } from '../../game/run/watch'
import { nodeTerrainRule } from '../../game/run/terrain'
import { TERRAIN_RULES } from '../../game/data/terrain'
import { CAMPFIRE_REPAIR } from '../../game/run/campfire'
import { cargoShare } from '../../game/run/contracts'
import { contractRules } from '../../game/run/contracts'
import { groundOf } from '../../state/game/runSlice'
import { fieldIdOf } from '../../game/data/maps'
import { fieldName, groundFor } from '../../game/run/fields'
import { NODE_ICON, strengthPct, strengthText } from '../channels'
import { Icon } from '../Icon'
import { tapWord } from '../pointer'
import { resistHint, summarizeEncounter } from './encounterPreview'
import { useMapFocus } from './mapFocus'

/** What each special stop is, in one line — the preview's whole body for a non-fight. */
const SPECIAL_BLURB: Record<string, string> = {
  merchant: 'Items for gold, and sometimes a hero for hire.',
  shrine: 'A bargain: a boon for all your heroes, paid for with a curse.',
  recruit: 'A hero looking for work. Take one on or walk on.',
  campfire: `Rest (round up stray cargo, +${cargoShare(CAMPFIRE_REPAIR)}%) or train one hero a full level. One of the two.`,
}

/**
 * The Context panel for a focused map node — what waits there, BEFORE the march
 * (Wave 1).
 *
 * For a fight it reads the encounter the store will actually spawn
 * (`summarizeEncounter`, proven equal to `selectNode`'s wave by
 * `tests/encounterPreview.test.ts`): the variant's name and what it asks for,
 * the elite modifier every enemy wears, the head count, any champions, and a
 * damage-type hint, and the Threat it is fought at. For a special stop it says
 * what the stop is. The march is a separate control: the full-width
 * {@link MarchBar} under this panel (Oct 2026: the map is the card and its CTA,
 * no party row and no gear beside it).
 */
export function NodePreviewPanel({ nodeId }: { nodeId: string }) {
  const runMap = useGameStore((s) => s.runMap)
  const runSeed = useGameStore((s) => s.runSeed)
  const crates = useGameStore((s) => s.contract?.crates ?? 0)
  const company = useGameStore((s) => s.contract?.company ?? null)
  const charter = useGameStore((s) => !!s.contract?.charter)
  const reachable = useGameStore((s) => s.reachableNodeIds)
  const cleared = useGameStore((s) => s.clearedNodeIds)
  const focus = useMapFocus((s) => s.focus)

  const firstRun = useGameStore((s) => s.firstRun)
  const fieldId = useGameStore((s) => fieldIdOf(s.battleMap))
  const fieldAct = useGameStore((s) => s.fieldAct)
  const node = runMap.nodes.find((n) => n.id === nodeId)
  const canMarch = !!node && reachable.includes(nodeId) && !cleared.includes(nodeId)

  // A focus that outlived its node (a new run, a march elsewhere) clears itself
  // rather than previewing a stop the player can no longer reach.
  useEffect(() => {
    if (!node) focus(null)
  }, [node, focus])
  if (!node) return null

  const meta = nodeMeta(node.type)
  const summary = summarizeEncounter({ runSeed, runMap, muster: charter }, nodeId)
  // Threat follows the road (Phase 3b): a fight here is fought at this layer's
  // Threat whatever the route was, and a stop costs none at all.
  const rules = contractRules({ crates, charter })
  const step = summary ? encounterThreat(node, rules.startThreat) * legMult(rules, node.layer) : null
  const hint = summary ? resistHint(summary) : null
  // The map challenge this fight is fought under (G1-2) — the same pure draw
  // `selectNode` makes, so the preview can never name the wrong ground.
  // LS3: a first run's first two depths are plain ground — the same answer.
  // The ground is the route's (its company's), as `selectNode` deals it.
  const rule = summary ? nodeTerrainRule(node, runSeed, groundOf({ firstRun, contract: charter ? { company: null, charter } : company ? { company } : null })) : null
  // A new act's first fight is on new ground (`run/fields`) — the same pure
  // rule `selectNode` deals it by — and the company starts it on the bench.
  const ground = summary ? groundFor(runSeed, { fieldId, fieldAct }, node.layer) : null

  return (
    <div className="sh-context" role="group" aria-labelledby="sh-node-head">
      <div className="sh-context-head start">
        <span className="sh-context-icon" aria-hidden="true">
          <Icon name={NODE_ICON[node.type] ?? 'depth'} />
        </span>
        <strong id="sh-node-head" style={{ color: meta.color }}>
          {summary ? summary.variant : meta.label}
        </strong>
      </div>
      <div className="sh-context-body">
        <p className="sh-line muted sh-node-kind">
          {meta.label} · Depth {node.layer}
          {rule ? ` · ${TERRAIN_RULES[rule].name}` : ''}
        </p>
        {ground?.fresh && (
          <p className="sh-line sh-node-ground">
            <Icon name="map" /> <b>New ground: {fieldName(ground.fieldId)}.</b> Heroes start on the bench.
          </p>
        )}
        {rule && (
          <p className="sh-line sh-node-terrain">
            <Icon name="warn" /> <b>{TERRAIN_RULES[rule].name}.</b> {TERRAIN_RULES[rule].blurb}
          </p>
        )}
        {summary ? (
          <>
            <p className="sh-line">
              <b>{summary.heads}</b> enemies
              {summary.mod ? (
                <>
                  , all <b>{summary.mod.prefix}</b>
                </>
              ) : null}
              {summary.champions.length ? ` · led by ${summary.champions.join(', ')}` : ''}
            </p>
            {summary.mod && <p className="sh-line muted">{summary.mod.prefix}: {summary.mod.blurb}.</p>}
            {hint && (
              <p className="sh-line accent">
                <Icon name={summary.physShare >= summary.magShare ? 'phys' : 'magic'} /> {hint}
              </p>
            )}
            {summary.asks && (
              <p className="sh-line muted">
                {summary.asks.charAt(0).toUpperCase()}
                {summary.asks.slice(1)}.
              </p>
            )}
          </>
        ) : (
          <p className="sh-line">{SPECIAL_BLURB[node.type] ?? 'Where the march began.'}</p>
        )}
        {/* Enemies at their starting strength need no line (LS3/LS4). */}
        {step && strengthPct(step) > 0 && (
          <p className="sh-line muted">
            <Icon name="threat" /> {strengthText(step)}: every enemy has {strengthPct(step)}% more HP.
          </p>
        )}
        {!canMarch && <p className="sh-line muted">Out of reach from where you stand.</p>}
      </div>
    </div>
  )
}

/**
 * The run map's one CTA, full width under the Context panel like every page's
 * (Oct 2026). It names the focused stop — "March to Patrol" — and commits the
 * march; with nothing focused, or a stop out of reach, it waits and says why.
 */
export function MarchBar() {
  const screen = useGameStore((s) => s.screen)
  const runMap = useGameStore((s) => s.runMap)
  const runSeed = useGameStore((s) => s.runSeed)
  const charter = useGameStore((s) => !!s.contract?.charter)
  const reachable = useGameStore((s) => s.reachableNodeIds)
  const cleared = useGameStore((s) => s.clearedNodeIds)
  const selectNode = useGameStore((s) => s.selectNode)
  const nodeId = useMapFocus((s) => s.nodeId)
  const focus = useMapFocus((s) => s.focus)
  if (screen !== 'map') return null
  const node = nodeId ? runMap.nodes.find((n) => n.id === nodeId) : undefined
  const canMarch = !!node && reachable.includes(node.id) && !cleared.includes(node.id)
  const name = node ? (summarizeEncounter({ runSeed, runMap, muster: charter }, node.id)?.variant ?? nodeMeta(node.type).label) : null
  return (
    <div className="sh-marchbar">
      <button
        type="button"
        className="pg-cta"
        disabled={!canMarch}
        onClick={() => {
          if (!node || !canMarch) return
          focus(null)
          selectNode(node.id)
        }}
      >
        {canMarch ? `March to ${name}` : node ? 'Out of reach' : `${tapWord()} a stop to march`}
      </button>
    </div>
  )
}
