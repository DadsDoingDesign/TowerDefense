/**
 * Generates a visual "sprite sheet" (SVG) of every Fieldwatch entity — the full
 * 3→9→27 Sentinel tree, the enemy roster, map-node icons, and item rarities —
 * straight from the game data so it always matches the live game.
 *
 *   npx tsx scripts/spritesheet.ts   ->  writes spritesheet.svg
 */
import { writeFileSync } from 'fs'
import { ALL_NODES, childrenOf, getNode } from '../src/game/data/archetypeTree'
import { ENEMY_TYPES } from '../src/game/data/enemies'
import { nodeMeta, type NodeType } from '../src/game/data/runmap'
import { RARITY, RARITY_ORDER } from '../src/game/data/items'
import type { Archetype } from '../src/game/types'

const GLYPH: Record<Archetype, string> = { fighter: '⚔', rogue: '✦', mystic: '❉' }
const W = 1040
const COLS: Archetype[] = ['fighter', 'rogue', 'mystic']
const CW = (W - 48) / 3
const svg: string[] = []
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

function text(x: number, y: number, s: string, opts: { size?: number; fill?: string; weight?: number; anchor?: string } = {}) {
  svg.push(
    `<text x="${x}" y="${y}" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="${opts.size ?? 11}" font-weight="${opts.weight ?? 400}" fill="${opts.fill ?? '#8a9992'}" text-anchor="${opts.anchor ?? 'middle'}">${esc(s)}</text>`,
  )
}

function token(x: number, y: number, color: string, accent: string, glyph: string, label: string) {
  const r = 17
  // barrel indicator
  svg.push(`<rect x="${x + 6}" y="${y - 3.5}" width="16" height="7" rx="3" fill="${accent}"/>`)
  svg.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="${accent}" stroke-width="2.5"/>`)
  svg.push(
    `<text x="${x}" y="${y + 1}" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="rgba(0,0,0,0.6)" text-anchor="middle" dominant-baseline="middle">${glyph}</text>`,
  )
  text(x, y + r + 13, label, { size: 10, fill: '#c9d1cc' })
}

function line(x1: number, y1: number, x2: number, y2: number) {
  svg.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(255,255,255,0.14)" stroke-width="1.5"/>`)
}

// ---- layout the Sentinel tree per archetype column ----
const TREE_TOP = 118
const baseY = TREE_TOP + 24
const t1Y = baseY + 70
const t2Y0 = t1Y + 74
const rowH = 62

COLS.forEach((arch, ci) => {
  const x0 = 24 + ci * CW
  const cx = x0 + CW / 2
  const base = getNode(arch)
  const color = base.color!
  const accent = base.accent!
  const glyph = GLYPH[arch]
  const subX = (c: number) => x0 + (CW * (c + 0.5)) / 3

  text(cx, TREE_TOP - 6, base.name.toUpperCase(), { size: 13, weight: 800, fill: color })

  // base -> subs connectors
  const subs = childrenOf(arch)
  subs.forEach((_, c) => line(cx, baseY + 17, subX(c), t1Y - 17))
  token(cx, baseY, color, accent, glyph, base.name)

  subs.forEach((sub, c) => {
    const sx = subX(c)
    const specs = childrenOf(sub.id)
    specs.forEach((_, r) => line(sx, t1Y + 17, sx, t2Y0 + r * rowH - 17))
    token(sx, t1Y, color, accent, glyph, sub.name)
    specs.forEach((spec, r) => token(sx, t2Y0 + r * rowH, color, accent, glyph, spec.name))
  })
})

const treeBottom = t2Y0 + 2 * rowH + 40

// ---- section header helper ----
function sectionHeader(y: number, label: string, sub: string) {
  text(24, y, label, { size: 14, weight: 800, fill: '#e7efe9', anchor: 'start' })
  text(W - 24, y, sub, { size: 11, fill: '#647069', anchor: 'end' })
  svg.push(`<line x1="24" y1="${y + 10}" x2="${W - 24}" y2="${y + 10}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`)
}

// ---- enemies ----
const enemyY = treeBottom + 30
sectionHeader(enemyY, 'ENEMIES', 'drawn to relative scale')
const enemyIds = ['torch1', 'torch3', 'tnt2', 'tnt4', 'barrel3', 'torch5', 'barrel5']
const eStep = (W - 48) / enemyIds.length
const eRowY = enemyY + 58
enemyIds.forEach((id, i) => {
  const e = ENEMY_TYPES[id]
  const x = 24 + eStep * (i + 0.5)
  svg.push(`<circle cx="${x}" cy="${eRowY}" r="${e.radius}" fill="${e.color}"${e.isBoss ? ' stroke="#e0aaff" stroke-width="3"' : ''}/>`)
  text(x, eRowY + 40, e.name, { size: 10, fill: '#c9d1cc' })
  text(x, eRowY + 53, `${e.baseHp} HP${e.isBoss ? ' · BOSS' : ''}`, { size: 9, fill: '#647069' })
})

// ---- map nodes ----
const nodeY = eRowY + 90
sectionHeader(nodeY, 'MAP NODES', 'run-map encounter types')
const nodeTypes: NodeType[] = ['start', 'battle', 'elite', 'merchant', 'shrine', 'recruit', 'boss']
const nStep = (W - 48) / nodeTypes.length
const nRowY = nodeY + 52
nodeTypes.forEach((t, i) => {
  const m = nodeMeta(t)
  const x = 24 + nStep * (i + 0.5)
  svg.push(`<rect x="${x - 26}" y="${nRowY - 20}" width="52" height="40" rx="10" fill="#16201a" stroke="${m.color}" stroke-width="2"/>`)
  svg.push(`<text x="${x}" y="${nRowY - 1}" font-family="system-ui,sans-serif" font-size="18" fill="${m.color}" text-anchor="middle" dominant-baseline="middle">${m.glyph}</text>`)
  text(x, nRowY + 34, m.label, { size: 10, fill: '#c9d1cc' })
})

// ---- item rarities ----
const rarY = nRowY + 74
sectionHeader(rarY, 'ITEM RARITIES', 'base budget + enchant slots rise per tier')
const rStep = (W - 48) / RARITY_ORDER.length
const rRowY = rarY + 46
RARITY_ORDER.forEach((rar, i) => {
  const c = RARITY[rar]
  const x = 24 + rStep * (i + 0.5)
  svg.push(`<rect x="${x - 60}" y="${rRowY - 14}" width="120" height="34" rx="8" fill="#16201a" stroke="${c.color}" stroke-width="2"/>`)
  svg.push(`<rect x="${x - 60}" y="${rRowY - 14}" width="4" height="34" rx="2" fill="${c.color}"/>`)
  text(x, rRowY + 2, `${c.label}`, { size: 12, weight: 700, fill: c.color })
  text(x, rRowY + 16, `${c.enchants} enchant${c.enchants === 1 ? '' : 's'}`, { size: 9, fill: '#647069' })
})

const H = rRowY + 60
const header = `<rect width="${W}" height="${H}" fill="#0a0e0c"/>
<text x="24" y="42" font-family="system-ui,sans-serif" font-size="22" font-weight="800" fill="#e7efe9">FIELDWATCH — Sprite Sheet</text>
<text x="24" y="64" font-family="system-ui,sans-serif" font-size="12" fill="#8a9992">Current in-engine tokens (placeholders to swap for real sprites) · ${ALL_NODES.length} Sentinel builds · ${enemyIds.length} enemies · ${nodeTypes.length} node types</text>
<text x="24" y="${TREE_TOP - 30}" font-family="system-ui,sans-serif" font-size="14" font-weight="800" fill="#e7efe9">SENTINELS — Archetype Tree (3 → 9 → 27)</text>
<line x1="24" y1="${TREE_TOP - 20}" x2="${W - 24}" y2="${TREE_TOP - 20}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`

const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${header}
${svg.join('\n')}
</svg>`

const out = new URL('../spritesheet.svg', import.meta.url)
writeFileSync(out, doc)
console.log(`Wrote spritesheet.svg (${W}x${H})`)
