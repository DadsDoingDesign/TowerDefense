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
  start: { label: 'Start', glyph: '◆', color: '#57a2b6' },
  battle: { label: 'Battle', glyph: '⚔', color: '#cbb488' },
  elite: { label: 'Elite', glyph: '☠', color: '#d0563a' },
  merchant: { label: 'Merchant', glyph: '⟡', color: '#e0ac4c' },
  shrine: { label: 'Shrine', glyph: '❖', color: '#7fb8a0' },
  recruit: { label: 'Recruit', glyph: '＋', color: '#6fce88' },
  boss: { label: 'Boss', glyph: '♛', color: '#c0503a' },
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

/** Per-map caps and spacing so a map holds a minimal, non-repetitive set of
 * special tiles instead of ~half the nodes being shops/shrines/elites. */
const SPECIAL_CAPS: Record<string, number> = { merchant: 2, shrine: 2, recruit: 1, elite: 2 }
const MIN_SPECIAL_GAP = 2 // layers between two specials of the same type

function assignTypes(nodesByLayer: MapNode[][], rng: RNG): void {
  const last = nodesByLayer.length - 1
  const middle: MapNode[] = []
  for (let l = 1; l < last; l++) middle.push(...nodesByLayer[l])

  const counts: Record<string, number> = { merchant: 0, shrine: 0, recruit: 0, elite: 0 }
  const lastLayer: Record<string, number> = { merchant: -9, shrine: -9, recruit: -9, elite: -9 }

  // Roll layer by layer (excluding the pre-boss layer, handled below). Enforce
  // per-type caps, a minimum layer gap between same-type specials, and at most
  // one special per layer so specials never cluster.
  for (let l = 1; l < last - 1; l++) {
    let specialThisLayer = false
    for (const n of nodesByLayer[l]) {
      if (l === 1) { n.type = 'battle'; continue } // ease-in layer
      let t = weightedType(n.layer, last, rng)
      if (t !== 'battle') {
        const capped = counts[t] >= (SPECIAL_CAPS[t] ?? 99)
        const tooClose = n.layer - lastLayer[t] < MIN_SPECIAL_GAP
        if (capped || tooClose || specialThisLayer) t = 'battle'
      }
      n.type = t
      if (t !== 'battle') {
        counts[t]++
        lastLayer[t] = n.layer
        specialThisLayer = true
      }
    }
  }

  // The layer right before the boss is a single prep stop — pick one node to be
  // a merchant (preferred) or shrine, and leave the rest as battles.
  const preBoss = nodesByLayer[last - 1]
  for (const n of preBoss) n.type = 'battle'
  const prep: NodeType = counts.merchant <= counts.shrine ? 'merchant' : 'shrine'
  rng.pick(preBoss).type = prep
  counts[prep]++

  // Guarantee at least one of each key type appears (only adds when absent, so
  // it never fights the caps). Elites avoid the pre-boss layer.
  ensureType('recruit', middle, rng, (n) => n.type === 'battle' && n.layer >= 2 && n.layer <= last - 3)
  ensureType('merchant', middle, rng, (n) => n.type === 'battle' && n.layer >= 3)
  ensureType('shrine', middle, rng, (n) => n.type === 'battle' && n.layer >= 2)
  ensureType('elite', middle, rng, (n) => n.type === 'battle' && n.layer >= 3 && n.layer < last - 1)
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
