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
 * What the meta layer and the run's Banner change about the *shape* of a map.
 *
 * This is where the horizontal unlocks land (H15): they add *choices*, not
 * power, and — since F-C1 — not length either. `Cartographer's Table` forks the
 * march harder; `Free Companies` puts a second hiring stop on it; `Standing
 * Orders` opens a road around every ambush. A Banner pulls the same dial the
 * other way: `Blood Price` deletes the recruiters, and `noMerchants` stays
 * wired for the rung that will delete the merchants once a merchant is worth
 * stopping at (see `metaStore`).
 */
export interface MapOptions {
  /**
   * Cartographer's Table: a **wider** map — more nodes per layer, more forks
   * out of each one, and more stops worth arguing about.
   *
   * It used to be a wider map *and a longer one* (13 layers instead of 11), and
   * that second half was a permanent difficulty increase sold as a horizontal
   * unlock (F-C1). Two extra layers are two extra compounding Threat steps
   * (×1.42² = ×2.02) **and** they move the boss from layer 10 to layer 12,
   * which quotes its budget off `waveBudget(11)` instead of `waveBudget(9)`
   * (×2.28) — a ~4.6× harder final fight for a 120-mark purchase whose card
   * promised more routes. Measured over 150 paired runs it took the campaign
   * from **40% winnable to 7%**, forever, with no opt-out short of erasing the
   * save. The doctrine line it broke is the one this whole layer is built on:
   * *unlocks add breadth, never basic viability*.
   *
   * It also did not deliver the breadth it charged for. Across 500 generated
   * maps the long version moved no-choice steps **49% → 52%** and mixed forks
   * **25% → 21%** — both the wrong way, because two more layers of the same
   * 1–2 out-edge rule is more corridor, not more choice. Width is now bought
   * where choice actually lives: the number of nodes in a layer AND the number
   * of edges leaving each one.
   */
  wideMap?: boolean
  /** Free Companies: guarantee a second Recruit stop. */
  extraRecruit?: boolean
  /**
   * Standing Orders: **no Elite ever stands on a road with no way around it**
   * (see {@link relocateForcedElites}).
   *
   * It used to mean "the pre-boss layer holds a merchant AND a shrine", and that
   * was worth nothing measurable — it could not have been: the run walks *one*
   * node of that layer, so a second prep node on a different road changes which
   * stop you might reach, not whether you reach one. Measured across four
   * routing policies it moved the win rate by −2 to +5pt, inside the noise of
   * its own sample; adding stops measures *negative* on every policy, because a
   * stop costs a Threat step and pays a shop a first run cannot afford. What the
   * unlock buys now is agency: 41% of Elites used to sit behind a single-edge
   * corridor, which is not a fight the player chose to take.
   *
   * The field was called `fullCamp` for as long as it still meant that older
   * two-prep-node rule. It is named for what it does now (M19-g), so nothing
   * reading this interface has to know the dead meaning to know what it buys.
   */
  standingOrders?: boolean
  /**
   * No Merchant stops anywhere. No Banner rung sets this today — deleting the
   * merchants was measured and costs a run nothing (`metaStore`, BANNER_RUNGS) —
   * and it stays implemented and tested for the rung that earns it back.
   */
  noMerchants?: boolean
  /** Banner 3 — Blood Price: no Recruit stops anywhere. */
  noRecruits?: boolean
}

/**
 * Build a Slay-the-Spire-style branching DAG: a start node, several layers of
 * 2–4 nodes, and a boss. Edges only connect adjacent layers, forward-only, and
 * every node is reachable with at least one outgoing edge.
 */
export function generateRunMap(rng: RNG, opts: MapOptions = {}, layers?: number): RunMap {
  /**
   * **The run is the same length whatever the hub has bought.** The boss sits on
   * layer 10 of an 11-layer map for everyone, so it is quoted off the same
   * `waveBudget(9)` and met after the same ten compounding Threat steps. A hub
   * purchase may change the *shape* of the march; it may not change its price.
   */
  const layerCount = layers ?? 11
  const nodesByLayer: MapNode[][] = []

  // Layer 0: start.
  nodesByLayer.push([mkNode('start', 0, 0, 0.5)])

  // Middle layers. A wide map forks harder — 3–4 nodes a layer instead of 2–4 —
  // so a route is a real choice rather than a corridor with occasional doors.
  for (let layer = 1; layer < layerCount - 1; layer++) {
    const count = opts.wideMap ? rng.int(3, 4) : rng.int(2, 4)
    const row: MapNode[] = []
    for (let r = 0; r < count; r++) {
      row.push(mkNode('battle', layer, r, count === 1 ? 0.5 : (r + 0.5) / count))
    }
    nodesByLayer.push(row)
  }

  // Last layer: boss.
  nodesByLayer.push([mkNode('boss', layerCount - 1, 0, 0.5)])

  // Assign types to middle-layer nodes.
  assignTypes(nodesByLayer, rng, opts)

  // Position normalized x by layer.
  for (const row of nodesByLayer) {
    for (const n of row) n.nx = n.layer / (layerCount - 1)
  }

  // Edges: connect each node to 1–2 nearest nodes in the next layer, then ensure
  // every next-layer node has at least one incoming edge.
  const edges: { from: string; to: string }[] = []
  for (let layer = 0; layer < layerCount - 1; layer++) {
    const cur = nodesByLayer[layer]
    const next = nodesByLayer[layer + 1]
    for (const n of cur) {
      const sorted = [...next].sort((a, b) => Math.abs(a.ny - n.ny) - Math.abs(b.ny - n.ny))
      // A fork is an out-edge, not a node. The default map gives each node 1–2
      // of them, so about half of all steps are a corridor with no decision in
      // them at all; a wide map guarantees at least two wherever two exist.
      //
      // The single-successor case still consumes no roll, exactly as it always
      // did: this generator is driven by the run's seeded map stream, and moving
      // a draw here would re-deal every default map in the game.
      const k = next.length === 1 ? 1 : Math.min(next.length, opts.wideMap ? rng.int(2, 3) : rng.int(1, 2))
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

  if (opts.standingOrders) relocateForcedElites(nodesByLayer, uniqueEdges, rng)

  return { nodes: nodesByLayer.flat(), edges: uniqueEdges, layers: layerCount }
}

function mkNode(type: NodeType, layer: number, row: number, ny: number): MapNode {
  return { id: nextId('node'), type, layer, row, nx: 0, ny }
}

/** Per-map caps and spacing so a map holds a minimal, non-repetitive set of
 * special tiles instead of ~half the nodes being shops/shrines/elites. */
const SPECIAL_CAPS: Record<string, number> = { merchant: 2, shrine: 2, recruit: 1, elite: 2 }
const MIN_SPECIAL_GAP = 2 // layers between two specials of the same type

function assignTypes(nodesByLayer: MapNode[][], rng: RNG, opts: MapOptions = {}): void {
  const last = nodesByLayer.length - 1
  const middle: MapNode[] = []
  for (let l = 1; l < last; l++) middle.push(...nodesByLayer[l])

  // A longer map earns proportionally more stops, or the extra layers are just
  // more battles; a Banner that forbids a stop sets its cap to zero.
  const caps = { ...SPECIAL_CAPS }
  /**
   * **A wide map holds the same stops; it just offers more ways past them.**
   *
   * The old version raised the merchant, shrine AND elite caps, which is how a
   * "more routes" purchase came to sell a harder map — and it does not even
   * help the routes. A stop costs a ×1.13 Threat step and pays a shop the run
   * usually cannot afford, so *adding* stops measures negative on every routing
   * policy (−12pt on the specials-first line, −2pt on the adaptive one, n=300).
   * Width buys forks; forks are the thing the card is selling.
   */
  /**
   * **A wide map trades stop *density* for fork density.** Half a layer more
   * road and an extra edge out of every node means a stop-greedy route walks
   * into more of them, and on the current numbers a stop is worth *negative* to
   * a fresh run (§11) — so leaving the caps alone made the unlock measure −9pt
   * on the line a first-timer walks. One merchant and one shrine come off the
   * cap to pay for the roads, which lands every routing policy at or above the
   * baseline. The map keeps one of each by guarantee, so nothing disappears
   * from a run; what changes is that the second one is not owed.
   */
  if (opts.wideMap) { caps.merchant -= 1; caps.shrine -= 1 }
  if (opts.extraRecruit) caps.recruit += 1
  if (opts.noMerchants) caps.merchant = 0
  if (opts.noRecruits) caps.recruit = 0

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
        const capped = counts[t] >= (caps[t] ?? 99)
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

  // The layer right before the boss is a prep stop: normally ONE node of it, a
  // merchant (preferred) or a shrine — which the run reaches only if its route
  // happens to land on that node.
  //
  // Standing Orders used to put a merchant AND a shrine here. It was worth
  // nothing, and it could not have been worth anything: the run walks exactly
  // ONE node of this layer, so a second prep node on a different road changes
  // which stop you might reach, not whether you reach one. Measured across four
  // routing policies it moved the win rate by −2 to +5pt — inside the noise of
  // its own sample — and adding stops measures *negative* on every policy,
  // because a stop costs a Threat step and pays a shop a first run cannot
  // afford. What that unlock now buys is in `relocateForcedElites`.
  const preBoss = nodesByLayer[last - 1]
  for (const n of preBoss) n.type = 'battle'
  const prep: NodeType = counts.merchant <= counts.shrine ? 'merchant' : 'shrine'
  if (!(prep === 'merchant' && opts.noMerchants)) {
    const pick = rng.pick(preBoss)
    pick.type = prep
    counts[prep]++
  }

  // Guarantee at least one of each key type appears (only adds when absent, so
  // it never fights the caps). Elites avoid the pre-boss layer.
  if (!opts.noRecruits) {
    ensureType('recruit', middle, rng, (n) => n.type === 'battle' && n.layer >= 2 && n.layer <= last - 3)
    // Free Companies: a SECOND hiring stop, well clear of the first. A single
    // recruit node is why the fresh-player harness reads a *roster-size* cliff —
    // one extra body was worth more than everything else in the run combined.
    if (opts.extraRecruit) forceSecond('recruit', middle, rng, (n) => n.layer >= 4 && n.layer <= last - 2)
  }
  if (!opts.noMerchants) ensureType('merchant', middle, rng, (n) => n.type === 'battle' && n.layer >= 3)
  ensureType('shrine', middle, rng, (n) => n.type === 'battle' && n.layer >= 2)
  ensureType('elite', middle, rng, (n) => n.type === 'battle' && n.layer >= 3 && n.layer < last - 1)

  // A Banner's rule is absolute: a stop it forbids must not survive any of the
  // guarantee passes above.
  if (opts.noMerchants) for (const n of middle) if (n.type === 'merchant') n.type = 'battle'
  if (opts.noRecruits) for (const n of middle) if (n.type === 'recruit') n.type = 'battle'
}

/**
 * Standing Orders, second half: **no Elite ever stands on a road with no way
 * around it.**
 *
 * About half of all steps on a default map are a single out-edge — a corridor,
 * not a fork — so an Elite that lands on the far side of one is not a decision
 * the player lost, it is a decision they were never offered. This pass finds
 * every Elite that can only be approached down a corridor and **opens a road
 * around it** — one extra edge, from the node that had no choice to the nearest
 * alternative in the Elite's own layer.
 *
 * It adds a road rather than deleting the Elite on purpose. An unlock that
 * removed the fight would be a difficulty discount dressed as breadth — the
 * same mistake, in the other direction, that made the old Cartographer's Table
 * a difficulty *tax* dressed as breadth. The map keeps every Elite it rolled;
 * what it stops keeping is ambushes with no way past them. Measured over 500
 * maps, forced Elites fall **41% → 0%**.
 */
function relocateForcedElites(nodesByLayer: MapNode[][], edges: { from: string; to: string }[], _rng: RNG): void {
  const byId = new Map(nodesByLayer.flat().map((n) => [n.id, n]))
  const outDeg = new Map<string, number>()
  for (const e of edges) outDeg.set(e.from, (outDeg.get(e.from) ?? 0) + 1)
  const added: { from: string; to: string }[] = []
  for (const e of edges) {
    if (outDeg.get(e.from) !== 1) continue
    const target = byId.get(e.to)!
    if (target.type !== 'elite') continue
    const alt = nodesByLayer[target.layer]
      .filter((o) => o.id !== target.id)
      .sort((a, b) => Math.abs(a.ny - target.ny) - Math.abs(b.ny - target.ny))[0]
    if (alt) added.push({ from: e.from, to: alt.id })
  }
  for (const e of added) if (!edges.some((x) => x.from === e.from && x.to === e.to)) edges.push(e)
}

/** Free Companies: place a SECOND stop of this type, clear of the first. */
function forceSecond(
  type: NodeType,
  middle: MapNode[],
  rng: RNG,
  eligible: (n: MapNode) => boolean,
): void {
  const existing = middle.filter((n) => n.type === type)
  if (existing.length >= 2) return
  const firstLayer = existing[0]?.layer ?? -99
  const candidates = middle.filter(
    (n) => n.type === 'battle' && eligible(n) && Math.abs(n.layer - firstLayer) >= MIN_SPECIAL_GAP,
  )
  if (candidates.length) rng.pick(candidates).type = type
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
