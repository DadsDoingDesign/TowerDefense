import type { RNG } from '../core/rng'
import { nextId } from '../core/rng'
import { ACT_LAYERS, isActBossLayer, RUN_LAYERS } from '../run/threat'

/**
 * `campfire` (Phase 3b) is the rest stop: repair the Gate or train a hero.
 * `miniboss` is an act boss — the fight that closes acts 1 and 2 (layers 4 and
 * 8). `boss` is the final one, and clearing it is the only campaign win.
 */
export type NodeType = 'start' | 'battle' | 'elite' | 'merchant' | 'shrine' | 'recruit' | 'campfire' | 'miniboss' | 'boss'

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
  campfire: { label: 'Campfire', glyph: '♨', color: '#e08a4c' },
  miniboss: { label: 'Act boss', glyph: '♜', color: '#c0503a' },
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
 * Build a Slay-the-Spire-style branching DAG in three ACTS (Phase 3b): a start
 * node, then per act three free layers of 2–4 nodes and a single act-boss
 * layer every route funnels through. Edges only connect adjacent layers,
 * forward-only, and every node is reachable with at least one outgoing edge.
 *
 * The act bosses are single-node layers on purpose: an act is a chapter, and a
 * chapter ends in the same fight for everyone. What differs is how the company
 * arrives — which is the route's whole job.
 */
export function generateRunMap(rng: RNG, opts: MapOptions = {}, layers?: number): RunMap {
  /**
   * **The run is the same length whatever the hub has bought.** Every map has
   * `RUN_LAYERS` layers (13: the start and three acts of four), so every run
   * meets the same act bosses at the same depth and the same final boss. A hub
   * purchase may change the *shape* of the march; it may not change its price.
   */
  const layerCount = layers ?? RUN_LAYERS
  const nodesByLayer: MapNode[][] = []

  // Layer 0: start.
  nodesByLayer.push([mkNode('start', 0, 0, 0.5)])

  // Middle layers. A wide map forks harder — 3–4 nodes a layer instead of 2–4 —
  // so a route is a real choice rather than a corridor with occasional doors.
  // An act-boss layer holds one node: the act's closing fight.
  for (let layer = 1; layer < layerCount - 1; layer++) {
    if (isActBossLayer(layer)) {
      nodesByLayer.push([mkNode('miniboss', layer, 0, 0.5)])
      continue
    }
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
      // of them; a wide map guarantees at least two wherever two exist. A
      // single-successor step (into an act boss) consumes no roll.
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

  if (opts.wideMap) detourThroughFights(nodesByLayer, uniqueEdges)
  if (opts.standingOrders) relocateForcedElites(nodesByLayer, uniqueEdges, rng)

  return { nodes: nodesByLayer.flat(), edges: uniqueEdges, layers: layerCount }
}

/**
 * **On a wide map, a detour leads back to the fighting (Phase 3b).**
 *
 * Three or four roads a layer and two or three edges out of every node let a
 * stop-greedy route chain stop into stop almost the whole way down, and §12
 * measured that costing the stop-first line 11pt: the extra forks became a way
 * to never fight, not a better argument. So on a wide map a road out of a stop
 * that leads straight into another stop is re-pointed at the nearest fight in
 * that layer the stop does not already reach — keeping the fork count, and the
 * target keeping another way in. No RNG is drawn, so nothing after it shifts.
 */
function detourThroughFights(nodesByLayer: MapNode[][], edges: { from: string; to: string }[]): void {
  const byId = new Map(nodesByLayer.flat().map((n) => [n.id, n]))
  const isStop = (n: MapNode) => n.type !== 'battle' && n.type !== 'elite' && n.type !== 'start' && n.type !== 'miniboss' && n.type !== 'boss'
  for (const e of edges) {
    const a = byId.get(e.from)!
    const b = byId.get(e.to)!
    if (!isStop(a) || !isStop(b)) continue
    // `b` must keep another way in, or it would be stranded.
    if (!edges.some((o) => o !== e && o.to === b.id)) continue
    const reached = new Set(edges.filter((o) => o.from === a.id).map((o) => o.to))
    const fight = nodesByLayer[b.layer]
      .filter((c) => (c.type === 'battle' || c.type === 'elite') && !reached.has(c.id))
      .sort((x, y) => Math.abs(x.ny - a.ny) - Math.abs(y.ny - a.ny))[0]
    if (fight) e.to = fight.id
  }
}

function mkNode(type: NodeType, layer: number, row: number, ny: number): MapNode {
  return { id: nextId('node'), type, layer, row, nx: 0, ny }
}

/**
 * Per-map caps on each kind of stop (Phase 3b).
 *
 * The review measured **~70–83% of all nodes as battles** and a route spread of
 * a few points between the best and worst line: a map that is mostly one node
 * type is a corridor with a coat of paint, and a fork between two battles is
 * not a fork. With Threat now following the road rather than the choice
 * (`run/threat.ts`), a stop is no longer a trap — skipping a fight costs its
 * XP, gold and card, not a compounding surcharge — so the map can afford more
 * of them. The target is 55–60% fights across the free layers, which
 * `balance/report.ts` §9 gates.
 *
 * Caps are per map across all three acts; `MIN_SPECIAL_GAP` keeps two stops of
 * the same kind out of adjacent layers.
 */
const SPECIAL_CAPS: Record<string, number> = { merchant: 4, shrine: 3, recruit: 3, elite: 3, campfire: 3 }
const MIN_SPECIAL_GAP = 1 // same-type stops never share a layer (adjacent layers are fine)
/** At most this many stops in one layer — and always at least one fight beside them. */
const MAX_SPECIALS_PER_LAYER = 2

const isFight = (n: MapNode): boolean => n.type === 'battle' || n.type === 'elite'

function assignTypes(nodesByLayer: MapNode[][], rng: RNG, opts: MapOptions = {}): void {
  const last = nodesByLayer.length - 1
  const middle: MapNode[] = []
  for (let l = 1; l < last; l++) if (!isActBossLayer(l)) middle.push(...nodesByLayer[l])

  // A Vow that forbids a stop sets its cap to zero.
  const caps = { ...SPECIAL_CAPS }
  /**
   * **A wide map trades stop *density* for fork density.** Half a layer more
   * road and an extra edge out of every node means a stop-greedy route walks
   * into more of them. It used to pay for that by taking a merchant and a
   * shrine off the cap; on the three-act road (Phase 3b) that stopped being
   * enough (§12: −11pt on the stop-first line) and started starving it of Gate
   * repairs. The price is structural now: a wide layer keeps TWO fights (below)
   * and a road out of a stop leads back to a fight (`detourThroughFights`).
   */
  // Free Companies guarantees a SECOND hiring stop (below) rather than raising the
  // cap: a map already carries up to three, and a higher cap only traded fights
  // for hiring stops the company could not fill (measured −8pt on the recruit line).
  if (opts.noMerchants) caps.merchant = 0
  if (opts.noRecruits) caps.recruit = 0

  const counts: Record<string, number> = { merchant: 0, shrine: 0, recruit: 0, elite: 0, campfire: 0 }
  const lastLayer: Record<string, number> = { merchant: -9, shrine: -9, recruit: -9, elite: -9, campfire: -9 }

  // Roll layer by layer. Enforce per-type caps, a minimum layer gap between
  // same-type specials, and at most MAX_SPECIALS_PER_LAYER stops a layer with at
  // least one fight left in it — so "fight here" is always one of the roads.
  for (let l = 1; l < last; l++) {
    if (isActBossLayer(l)) continue
    const row = nodesByLayer[l]
    let specialsThisLayer = 0
    // A wide layer keeps two fights: its extra road is a fork, not another stop.
    const maxStops = opts.wideMap ? Math.max(1, Math.min(MAX_SPECIALS_PER_LAYER, row.length - 2)) : MAX_SPECIALS_PER_LAYER
    for (let i = 0; i < row.length; i++) {
      const n = row[i]
      // The first layer eases in: at most one stop, and it is never a shrine's bill.
      let t = weightedType(n.layer, last, rng)
      if (t !== 'battle') {
        const capped = counts[t] >= (caps[t] ?? 99)
        const tooClose = n.layer - lastLayer[t] < MIN_SPECIAL_GAP
        const crowded = t !== 'elite' && (specialsThisLayer >= (l === 1 ? 1 : maxStops) || (l === 1 && t === 'shrine'))
        // The last node of a layer cannot be a stop if nothing before it fights.
        const noFightLeft = t !== 'elite' && i === row.length - 1 && !row.slice(0, i).some(isFight)
        if (capped || tooClose || crowded || noFightLeft) t = 'battle'
      }
      n.type = t
      if (t !== 'battle') {
        counts[t]++
        lastLayer[t] = n.layer
        if (t !== 'elite') specialsThisLayer++
      }
    }
  }

  /**
   * **Every act closes with a campfire in reach (Phase 3b).** The layer before
   * each act boss holds one — the rest-or-train decision the review found the
   * game missing entirely ("no comeback: the Gate never regenerates, there is
   * no rest node"). It is one node of that layer, not the whole layer, so
   * taking it is still a route choice: the fire, or one more fight's XP and
   * gold before the boss.
   */
  for (let l = ACT_LAYERS - 1; l < last; l += ACT_LAYERS) {
    const row = nodesByLayer[l]
    if (!row || row.some((n) => n.type === 'campfire')) continue
    const battles = row.filter((n) => n.type === 'battle')
    const stops = row.filter((n) => !isFight(n))
    // Never the layer's last fight, and never a third stop: the campfire joins
    // the road, it does not close it. A full layer trades one of its stops.
    const candidates =
      stops.length < MAX_SPECIALS_PER_LAYER && (battles.length > 1 || row.some((n) => n.type === 'elite')) ? battles : []
    const pick = candidates.length ? rng.pick(candidates) : stops.length ? rng.pick(stops) : rng.pick(row)
    if (pick.type !== 'battle' && counts[pick.type] != null) counts[pick.type]--
    pick.type = 'campfire'
    counts.campfire++
  }

  // Guarantee at least one of each key type appears (only adds when absent, so
  // it never fights the caps). Elites avoid the layer before an act boss.
  const preBoss = (n: MapNode) => isActBossLayer(n.layer + 1)
  if (!opts.noRecruits) {
    ensureType('recruit', middle, rng, (n) => n.type === 'battle' && n.layer >= 2 && n.layer <= last - 3)
    // Free Companies: a SECOND hiring stop, well clear of the first.
    if (opts.extraRecruit) forceSecond('recruit', middle, rng, (n) => n.layer >= 4 && n.layer <= last - 2)
  }
  if (!opts.noMerchants) ensureType('merchant', middle, rng, (n) => n.type === 'battle' && n.layer >= 3)
  ensureType('shrine', middle, rng, (n) => n.type === 'battle' && n.layer >= 2)
  ensureType('elite', middle, rng, (n) => n.type === 'battle' && n.layer >= 3 && !preBoss(n))

  // A Vow's rule is absolute: a stop it forbids must not survive any of the
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
    (n) => n.type === 'battle' && eligible(n) && Math.abs(n.layer - firstLayer) >= MIN_SPECIAL_GAP && (type === 'elite' || notLastFight(n, middle)),
  )
  if (candidates.length) rng.pick(candidates).type = type
}

/** True when `n`'s layer keeps a fight even if `n` stops being one. */
const notLastFight = (n: MapNode, middle: MapNode[]): boolean =>
  middle.some((o) => o !== n && o.layer === n.layer && isFight(o)) &&
  middle.filter((o) => o.layer === n.layer && !isFight(o)).length < MAX_SPECIALS_PER_LAYER

function weightedType(layer: number, last: number, rng: RNG): NodeType {
  // Fights are still the most common road; a stop is a detour whose price is
  // the fight it replaces — not a Threat surcharge any more (Phase 3b).
  const w: [NodeType, number][] = [
    ['battle', 24],
    ['elite', layer >= 3 ? 13 : 0],
    ['merchant', 13],
    ['shrine', 10],
    ['recruit', layer <= last - 3 ? 10 : 0],
    ['campfire', layer >= 2 ? 11 : 0],
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
  // A guaranteed stop never takes a layer's last fight (an elite still is one).
  const candidates = middle.filter((n) => n.type === 'battle' && eligible(n) && (type === 'elite' || notLastFight(n, middle)))
  if (candidates.length) rng.pick(candidates).type = type
}
