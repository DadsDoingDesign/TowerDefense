import type { RNG } from '../core/rng'
import { nextId } from '../core/rng'

export type NodeType = 'start' | 'battle' | 'elite' | 'merchant' | 'shrine' | 'recruit' | 'boss'

export interface MapNode {
  id: string
  type: NodeType
  layer: number
  row: number
  /** Normalized layout coords in [0,1]; the screen scales these to the container. */
  nx: number
  ny: number
}

export interface RunMap {
  nodes: MapNode[]
  edges: { from: string; to: string }[]
  layers: number
}

const NODE_META: Record<NodeType, { label: string; glyph: string; color: string }> = {
  start: { label: 'Start', glyph: '◆', color: '#98c1d9' },
  battle: { label: 'Battle', glyph: '⚔', color: '#c9d1cc' },
  elite: { label: 'Elite', glyph: '☠', color: '#e05a4f' },
  merchant: { label: 'Merchant', glyph: '⟡', color: '#f0b868' },
  shrine: { label: 'Shrine', glyph: '❖', color: '#c48ff0' },
  recruit: { label: 'Recruit', glyph: '＋', color: '#7ac74f' },
  boss: { label: 'Boss', glyph: '♛', color: '#e0aaff' },
}

export const nodeMeta = (t: NodeType) => NODE_META[t]

/**
 * Build a Slay-the-Spire-style branching DAG: a start node, several layers of
 * 2–4 nodes, and a boss. Edges only connect adjacent layers, forward-only, and
 * every node is reachable with at least one outgoing edge.
 */
export function generateRunMap(rng: RNG, layers = 11): RunMap {
  const nodesByLayer: MapNode[][] = []

  // Layer 0: start.
  nodesByLayer.push([mkNode('start', 0, 0, 0.5)])

  // Middle layers.
  for (let layer = 1; layer < layers - 1; layer++) {
    const count = rng.int(2, 4)
    const row: MapNode[] = []
    for (let r = 0; r < count; r++) {
      row.push(mkNode('battle', layer, r, count === 1 ? 0.5 : (r + 0.5) / count))
    }
    nodesByLayer.push(row)
  }

  // Last layer: boss.
  nodesByLayer.push([mkNode('boss', layers - 1, 0, 0.5)])

  // Assign types to middle-layer nodes.
  assignTypes(nodesByLayer, rng)

  // Position normalized x by layer.
  for (const row of nodesByLayer) {
    for (const n of row) n.nx = n.layer / (layers - 1)
  }

  // Edges: connect each node to 1–2 nearest nodes in the next layer, then ensure
  // every next-layer node has at least one incoming edge.
  const edges: { from: string; to: string }[] = []
  for (let layer = 0; layer < layers - 1; layer++) {
    const cur = nodesByLayer[layer]
    const next = nodesByLayer[layer + 1]
    for (const n of cur) {
      const sorted = [...next].sort((a, b) => Math.abs(a.ny - n.ny) - Math.abs(b.ny - n.ny))
      const k = next.length === 1 ? 1 : rng.int(1, 2)
      for (const t of sorted.slice(0, k)) edges.push({ from: n.id, to: t.id })
    }
    // Guarantee incoming coverage.
    for (const t of next) {
      if (!edges.some((e) => e.to === t.id)) {
        const src = [...cur].sort((a, b) => Math.abs(a.ny - t.ny) - Math.abs(b.ny - t.ny))[0]
        edges.push({ from: src.id, to: t.id })
      }
    }
  }

  // Dedup edges.
  const seen = new Set<string>()
  const uniqueEdges = edges.filter((e) => {
    const k = `${e.from}->${e.to}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  return { nodes: nodesByLayer.flat(), edges: uniqueEdges, layers }
}

function mkNode(type: NodeType, layer: number, row: number, ny: number): MapNode {
  return { id: nextId('node'), type, layer, row, nx: 0, ny }
}

function assignTypes(nodesByLayer: MapNode[][], rng: RNG): void {
  const last = nodesByLayer.length - 1
  const middle: MapNode[] = []
  for (let l = 1; l < last; l++) middle.push(...nodesByLayer[l])

  for (const n of middle) {
    // Layer 1 stays battles to ease players in.
    if (n.layer === 1) {
      n.type = 'battle'
      continue
    }
    n.type = weightedType(n.layer, last, rng)
  }

  // The layer right before the boss is always a prep stop (merchant or shrine).
  const preBoss = nodesByLayer[last - 1]
  for (const n of preBoss) if (n.type === 'battle' || n.type === 'elite') n.type = rng.chance(0.6) ? 'merchant' : 'shrine'

  // Guarantee at least one of each key type appears (after the pre-boss pass so
  // a guaranteed node isn't converted away). Elites avoid the pre-boss layer.
  ensureType('recruit', middle, rng, (n) => n.layer >= 2 && n.layer <= last - 3)
  ensureType('merchant', middle, rng, (n) => n.layer >= 3)
  ensureType('shrine', middle, rng, (n) => n.layer >= 2)
  ensureType('elite', middle, rng, (n) => n.layer >= 3 && n.layer < last - 1)
}

function weightedType(layer: number, last: number, rng: RNG): NodeType {
  const w: [NodeType, number][] = [
    ['battle', 52],
    ['elite', layer >= 3 ? 14 : 0],
    ['merchant', 12],
    ['shrine', 12],
    ['recruit', layer <= last - 3 ? 10 : 0],
  ]
  const total = w.reduce((s, [, n]) => s + n, 0)
  let roll = rng.range(0, total)
  for (const [t, n] of w) {
    roll -= n
    if (roll <= 0) return t
  }
  return 'battle'
}

function ensureType(
  type: NodeType,
  middle: MapNode[],
  rng: RNG,
  eligible: (n: MapNode) => boolean,
): void {
  if (middle.some((n) => n.type === type)) return
  const candidates = middle.filter((n) => n.type === 'battle' && eligible(n))
  if (candidates.length) rng.pick(candidates).type = type
}
