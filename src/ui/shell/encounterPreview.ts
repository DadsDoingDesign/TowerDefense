import { ENEMY_MODS, ENEMY_TYPES, type EnemyMod } from '../../game/data/enemies'
import type { MapNode, RunMap } from '../../game/data/runmap'
import {
  nodeEncounter,
  nodeEncounterSpec,
  pickVariant,
  waveComposition,
  type EncounterKind,
  type WaveVariant,
} from '../../game/data/waves'
import type { WaveDef } from '../../game/types'
import { encounterNode } from '../../game/run/map'
import { ACT_LAYERS } from '../../game/run/threat'

/**
 * ---------------------------------------------------------------------------
 * What a map node will field, before you march onto it (Wave 1).
 * ---------------------------------------------------------------------------
 *
 * The WS8 composition variants made every battle node a different problem —
 * Plated columns shrug off steel, Warded ones shrug off magic, a Swift Raid is a
 * coverage problem — and none of it reached the map. `generateEncounter` was
 * called from exactly one place, `gameStore.selectNode`, which is also the call
 * that COMMITS the march. So every fork was blind: the variant, its elite
 * modifier and its head count were first shown on the battle screen, after the
 * choice they should have informed.
 *
 * This module answers the same question the store asks, with the same inputs:
 *
 *   kind    boss → 'boss'; elite, or any battle under an all-elite Vow → 'elite';
 *           else 'normal'          (`nodeKind` in gameStore)
 *   seed    `encounterSeed(runSeed, node.layer)`
 *   sibling `node.row`
 *   depth   `node.layer`
 *
 * It is a re-statement rather than a shared call because the store's
 * `nodeKind` is private to a file another lane owns, and because a preview must
 * never be able to mutate anything. The equality is not trusted: the Vitest
 * suite (`tests/encounterPreview.test.ts`) drives the REAL store's `selectNode`
 * across hundreds of nodes, seeds and Vows and asserts that the wave it spawns
 * is deep-equal to `previewEncounter` for the same node. If the store's
 * derivation changes, that test fails before a player sees a preview lie.
 */

/** Everything `previewEncounter` reads off the run — a slice of `GameState`. */
export interface PreviewRun {
  runSeed: number
  runDifficulty: number
  runMap: RunMap
}

/**
 * The encounter kind the store fields on this node: its own. (A Vow could make
 * a battle node field an elite; a difficulty step makes it an elite NODE on
 * the map instead, SK1, so the node's type is the whole answer.)
 */
export function encounterKindFor(node: Pick<MapNode, 'type'>): EncounterKind | null {
  return nodeEncounterSpec(encounterNode({ type: node.type, layer: 0, row: 0 }), 0)?.kind ?? null
}

/** The variant the store's `generateEncounter` call will pick for this node. */
export function variantFor(run: PreviewRun, node: MapNode): WaveVariant | null {
  const spec = nodeEncounterSpec(encounterNode(node), run.runSeed)
  return spec ? pickVariant(spec.kind, spec.depth, spec.seed, spec.sibling) : null
}

/**
 * The exact wave `selectNode(nodeId)` would spawn — or `null` for a node that
 * is not a fight (start, merchant, shrine, recruit) or does not exist.
 */
export function previewEncounter(run: PreviewRun, nodeId: string): WaveDef | null {
  const node = run.runMap.nodes.find((n) => n.id === nodeId)
  return node ? nodeEncounter(encounterNode(node), run.runSeed) : null
}

/** The one-glance read of an encounter, for the Context panel. */
export interface EncounterSummary {
  kind: EncounterKind
  /** "Patrol", "Plated Column", "Swift Raid"… — the variant's own name. */
  variant: string
  /** The variant's authored one-liner: what the shape asks of you. */
  asks: string
  /** The elite modifier every enemy in the column wears, if any. */
  mod: EnemyMod | null
  heads: number
  /** Champions (boss-tier enemies) in the wave, by display name. */
  champions: string[]
  /**
   * Share of heads with ANY physical / magic resist, and the highest resist
   * in the wave, 0–1. The panel turns this into "steel bounces" / "magic
   * bounces" so the counter-pick is legible before the march.
   */
  physShare: number
  magShare: number
  physMax: number
  magMax: number
}

export function summarizeEncounter(run: PreviewRun, nodeId: string): EncounterSummary | null {
  const node = run.runMap.nodes.find((n) => n.id === nodeId)
  if (!node) return null
  const kind = encounterKindFor(node)
  const wave = previewEncounter(run, nodeId)
  const v = variantFor(run, node)
  if (!kind || !wave || !v) return null

  let phys = 0
  let mag = 0
  let physMax = 0
  let magMax = 0
  const champions: string[] = []
  for (const { typeId, count } of waveComposition(wave)) {
    const t = ENEMY_TYPES[typeId]
    if (!t) continue
    if (t.physResist) {
      phys += count
      physMax = Math.max(physMax, t.physResist)
    }
    if (t.magResist) {
      mag += count
      magMax = Math.max(magMax, t.magResist)
    }
    if (t.isBoss) champions.push(t.name)
  }
  const heads = wave.spawns.length
  return {
    kind,
    variant: v.label || (kind === 'boss' ? (node.type === 'miniboss' ? `Act ${Math.ceil(node.layer / ACT_LAYERS)} Boss` : 'The Final Watch') : 'Patrol'),
    asks: v.asks,
    mod: v.mod ? (ENEMY_MODS.find((m) => m.id === v.mod) ?? null) : null,
    heads,
    champions,
    physShare: heads ? phys / heads : 0,
    magShare: heads ? mag / heads : 0,
    physMax,
    magMax,
  }
}

/**
 * The damage-type hint in words. Leads with whichever resist the wave leans on,
 * and says nothing rather than something vague when neither is meaningful —
 * "a third of them shrug off a little magic" is not a counter-pick.
 */
export function resistHint(s: EncounterSummary): string | null {
  const pct = (v: number) => `${Math.round(v * 100)}%`
  const p = s.physShare >= 0.34 && s.physMax >= 0.2
  const m = s.magShare >= 0.34 && s.magMax >= 0.2
  if (p && m) return `Both damage types bounce off some of them (steel up to ${pct(s.physMax)}, magic up to ${pct(s.magMax)}).`
  if (p) return `Steel bounces: up to ${pct(s.physMax)} of physical damage is shrugged off. Bring magic.`
  if (m) return `Magic bounces: up to ${pct(s.magMax)} of magic damage is shrugged off. Bring steel.`
  return null
}
