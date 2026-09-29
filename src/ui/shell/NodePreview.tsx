import { useEffect } from 'react'
import { nodeMeta } from '../../game/data/runmap'
import { THREAT_PER_CHOICE, THREAT_PER_NODE, useGameStore } from '../../state/gameStore'
import { bannerRules } from '../../state/metaStore'
import { NODE_ICON } from '../channels'
import { Icon } from '../Icon'
import { resistHint, summarizeEncounter } from './encounterPreview'
import { useMapFocus } from './mapFocus'

/** What each special stop is, in one line — the preview's whole body for a non-fight. */
const SPECIAL_BLURB: Record<string, string> = {
  merchant: 'Items for gold, and sometimes a hero for hire.',
  shrine: 'A bargain: a boon for the company, paid for with a curse.',
  recruit: 'A hero looking for a company. Take one or walk on.',
}

/**
 * The Context panel for a focused map node — what waits there, BEFORE the march
 * (Wave 1).
 *
 * For a fight it reads the encounter the store will actually spawn
 * (`summarizeEncounter`, proven equal to `selectNode`'s wave by
 * `tests/encounterPreview.test.ts`): the variant's name and what it asks for,
 * the elite modifier every enemy wears, the head count, any champions, and a
 * damage-type hint. For a special stop it says what the stop is. Either way the
 * Threat step it charges is stated in full, and the march is a separate button.
 */
export function NodePreviewPanel({ nodeId }: { nodeId: string }) {
  const runMap = useGameStore((s) => s.runMap)
  const runSeed = useGameStore((s) => s.runSeed)
  const runBanner = useGameStore((s) => s.runBanner)
  const reachable = useGameStore((s) => s.reachableNodeIds)
  const cleared = useGameStore((s) => s.clearedNodeIds)
  const selectNode = useGameStore((s) => s.selectNode)
  const focus = useMapFocus((s) => s.focus)

  const node = runMap.nodes.find((n) => n.id === nodeId)
  const canMarch = !!node && reachable.includes(nodeId) && !cleared.includes(nodeId)

  // A focus that outlived its node (a new run, a march elsewhere) clears itself
  // rather than previewing a stop the player can no longer reach.
  useEffect(() => {
    if (!node) focus(null)
  }, [node, focus])
  if (!node) return null

  const allElite = bannerRules(runBanner).allElite
  const meta = nodeMeta(allElite && node.type === 'battle' ? 'elite' : node.type)
  const summary = summarizeEncounter({ runSeed, runBanner, runMap }, nodeId)
  const step =
    node.type === 'elite'
      ? THREAT_PER_NODE.elite
      : node.type === 'battle'
        ? THREAT_PER_NODE.normal
        : node.type in SPECIAL_BLURB
          ? THREAT_PER_NODE.special
          : null
  const hint = summary ? resistHint(summary) : null

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
        </p>
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
        {step && (
          <p className="sh-line muted">
            <Icon name="threat" /> Threat ×{step.toFixed(2)} for marching here
            {node.type in SPECIAL_BLURB ? `, ×${THREAT_PER_CHOICE.toFixed(2)} more if you take what it offers` : ''}.
          </p>
        )}
        {!canMarch && <p className="sh-line muted">Out of reach from where you stand.</p>}
      </div>
      <div className="sh-context-foot">
        <button className="sh-btn" onClick={() => focus(null)}>
          Back
        </button>
        {canMarch && (
          <button
            className="sh-btn primary"
            onClick={() => {
              focus(null)
              selectNode(nodeId)
            }}
          >
            March
          </button>
        )}
      </div>
    </div>
  )
}
