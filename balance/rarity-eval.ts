/**
 * Loot rarity by act — what a run is actually OFFERED, per roll and per hand.
 * Node-only, like `tune.ts`; not a gate (REPORT §3b prints the same table).
 *
 *   npx tsx balance/rarity-eval.ts [n]
 *     n  runs (default 4000)
 *
 * Each run deals a real map (`generateRunMap`, the map stream), walks it on a
 * random road, and at every node deals what the store deals there, with the
 * store's own functions and luck: a fight's reward hand (`rewardHand`, luck
 * `nodeClearLuck`), a merchant's shelf (`rollMerchantShelf`, `merchantLuck`),
 * the final boss's spoils. The pity counter runs as the store runs it: an
 * offer never moves it, and the modelled player TAKES the rarest item card
 * in every hand that holds one — the most pity a run can accrue, so the pity
 * column is an upper bound.
 *
 * Read per roll (every item rolled for an offer, by act) and per hand (a
 * fight's hand that shows at least one Epic-or-better item), plus the share of
 * runs whose act shows one at all — "a purple early is a moment, not a weekly
 * event" is the last column of act 1.
 */
import { hashSeed, RNG } from '../src/game/core/rng'
import { generateRunMap } from '../src/game/data/runmap'
import { BASIC_ITEM_KINDS } from '../src/game/data/itemKinds'
import { creditPity, generateItem, newRarityPity, RARITY_ORDER } from '../src/game/data/items'
import { rewardHand, handSize } from '../src/game/run/relics'
import { merchantLuck, rollMerchantShelf } from '../src/game/run/economy'
import { actOf, ACTS, nodeClearLuck } from '../src/game/run/threat'
import type { ItemRarity } from '../src/game/types'

const N = Number(process.argv[2]) || 4000
const EPIC = RARITY_ORDER.indexOf('epic')

interface Tally {
  rolls: number
  byRarity: Record<ItemRarity, number>
  hands: number
  handsEpic: number
  /** Relic cards in fight hands, and those Epic or better; hands showing any Epic+ card. */
  relics: number
  relicsEpic: number
  fightHands: number
  handsAnyEpic: number
  shelves: number
  shelvesEpic: number
  runsEpic: number
}
const fresh = (): Tally => ({
  rolls: 0,
  byRarity: { common: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 },
  hands: 0,
  handsEpic: 0,
  relics: 0,
  relicsEpic: 0,
  fightHands: 0,
  handsAnyEpic: 0,
  shelves: 0,
  shelvesEpic: 0,
  runsEpic: 0,
})

export function rarityByAct(n = N): Tally[] {
  const acts = Array.from({ length: ACTS }, fresh)
  for (let i = 0; i < n; i++) {
    const seed = 50_000 + i * 31
    const map = generateRunMap(new RNG(hashSeed(seed, 'map')))
    const loot = new RNG(seed)
    const route = new RNG(hashSeed(seed, 'route'))
    const pity = newRarityPity()
    const sawEpic = new Set<number>()
    const count = (act: number, rarity: ItemRarity) => {
      const t = acts[act - 1]
      t.rolls++
      t.byRarity[rarity]++
      if (RARITY_ORDER.indexOf(rarity) >= EPIC) sawEpic.add(act)
    }
    let cur = map.nodes.find((x) => x.type === 'start')!
    for (let guard = 0; guard < 40; guard++) {
      const nexts = map.edges.filter((e) => e.from === cur.id).map((e) => map.nodes.find((x) => x.id === e.to)!)
      if (!nexts.length) break
      const node = route.pick(nexts)
      cur = node
      const act = actOf(node.layer)
      if (node.type === 'battle' || node.type === 'elite') {
        const hand = rewardHand(loot, { kind: node.type, luck: nodeClearLuck(node), count: handSize({ thinPickings: false }), held: [], pity, kinds: BASIC_ITEM_KINDS, depth: node.layer })
        const items = hand.filter((c) => c.kind === 'item' && c.item).map((c) => c.item!)
        const relicCards = hand.filter((c) => c.kind === 'relic')
        const t = acts[act - 1]
        t.fightHands++
        t.relics += relicCards.length
        t.relicsEpic += relicCards.filter((c) => RARITY_ORDER.indexOf(c.rarity) >= EPIC).length
        if (hand.some((c) => RARITY_ORDER.indexOf(c.rarity) >= EPIC)) t.handsAnyEpic++
        for (const it of items) count(act, it.rarity)
        if (items.length) {
          acts[act - 1].hands++
          if (items.some((it) => RARITY_ORDER.indexOf(it.rarity) >= EPIC)) acts[act - 1].handsEpic++
          const best = [...items].sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity))[0]
          creditPity(pity, best.rarity)
        }
      } else if (node.type === 'merchant') {
        const shelf = rollMerchantShelf(loot, { luck: merchantLuck(node.layer), roster: [], pity, kinds: BASIC_ITEM_KINDS, depth: node.layer })
        for (const e of shelf) count(act, e.item.rarity)
        acts[act - 1].shelves++
        if (shelf.some((e) => RARITY_ORDER.indexOf(e.item.rarity) >= EPIC)) acts[act - 1].shelvesEpic++
      } else if (node.type === 'boss') {
        for (let k = 0; k < 3; k++) count(act, generateItem(loot, { luck: nodeClearLuck(node), pity, kinds: BASIC_ITEM_KINDS, depth: node.layer }).rarity)
      }
    }
    for (const a of sawEpic) acts[a - 1].runsEpic++
  }
  return acts
}

const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : '—')

export function rarityTable(acts: Tally[], n = N): string {
  const lines = [
    '| Act | Item rolls | Common | Rare | Epic | Legendary | Mythic | **Epic+ per roll** | Leg.+Myth. | Fight hands | **Hands showing Epic+** | Shelves showing Epic+ | Runs whose act shows any Epic+ |',
    '|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|',
  ]
  acts.forEach((t, i) => {
    const epicUp = t.byRarity.epic + t.byRarity.legendary + t.byRarity.mythic
    const legUp = t.byRarity.legendary + t.byRarity.mythic
    lines.push(
      `| ${i + 1} | ${t.rolls} | ${pct(t.byRarity.common, t.rolls)} | ${pct(t.byRarity.rare, t.rolls)} | ${pct(t.byRarity.epic, t.rolls)} | ${pct(t.byRarity.legendary, t.rolls)} | ${pct(t.byRarity.mythic, t.rolls)} | **${pct(epicUp, t.rolls)}** | ${pct(legUp, t.rolls)} | ${t.hands} | **${pct(t.handsEpic, t.hands)}** | ${pct(t.shelvesEpic, t.shelves)} | ${pct(t.runsEpic, n)} |`,
    )
  })
  lines.push('', '| Act | Fight hands | Relic cards | Relic cards Epic+ | **Hands showing any Epic+ card** (item or relic) |', '|---|--:|--:|--:|--:|')
  acts.forEach((t, i) => lines.push(`| ${i + 1} | ${t.fightHands} | ${t.relics} | ${pct(t.relicsEpic, t.relics)} | **${pct(t.handsAnyEpic, t.fightHands)}** |`))
  return lines.join('\n')
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop()!)) {
  const t0 = Date.now()
  console.log(rarityTable(rarityByAct(N), N))
  console.log(`\n${N} runs, ${((Date.now() - t0) / 1000).toFixed(1)}s`)
}
