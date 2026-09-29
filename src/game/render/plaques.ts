/**
 * The enemy plaque: the non-colour tier channel (notch count) and the elite
 * modifier mark, drawn above each enemy's head.
 */
import { ENEMY_MODS, ENEMY_TYPES, modKey } from '../data/enemies'
import type { EnemyType } from '../types'
import { getViewScale } from './frame'
import { roundRect } from './paint'

/** Tier 1–5, read off the type id (`torch3` → 3). */
export function enemyTier(id: string): number {
  const n = Number(id.slice(-1))
  return n >= 1 && n <= 5 ? n : 1
}

/**
 * The non-colour tier channel (M34).
 *
 * `drawEnemy` used to answer "how dangerous is this thing?" with hue alone —
 * tiers 2/3/4 are literally the same blue/purple/gold in all three factions, so
 * the ONLY difference between a Bomber and a Sapper was a colour a deuteranope
 * cannot separate from the one next to it. The shell carries non-colour
 * channels everywhere in the DOM (rarity initials, archetype glyphs); the
 * canvas had none.
 *
 * **Why notches and not a glyph.** The field is 960×560 logical px drawn into
 * ~390×387 CSS px — a scale of ~0.41 — so a tier-1 goblin is about **9 CSS px
 * across on a phone**. Anything drawn INSIDE that silhouette (a numeral, a pip
 * row, an outline weight) lands at 1–3 px and is not a channel, it is texture.
 * So the tag sits ABOVE the head where it has its own space, carries its own
 * dark ground so it never has to fight grass or dirt for contrast, and encodes
 * tier as a COUNT — the one visual variable that survives every colour vision
 * difference, every scale and every screenshot. Tag WIDTH grows with the count
 * too, so the channel still reads even where four notches and five do not
 * resolve individually.
 *
 * It is also sized off `radius`, which already grows with tier, so the tag gets
 * bigger exactly where the count gets harder to read, and a tier-1 swarm wears
 * the smallest mark on the field rather than the noisiest.
 */
/**
 * ── the floor, in the units the eye lives in (M2) ───────────────────────────
 *
 * The comment this replaces claimed the notch "never drops below the ~1.6 CSS
 * px it needs to survive the phone's 0.41 scale". 0.41 is the **largest** view
 * scale in the support matrix, not the smallest. Measured at 320×568 — the
 * smallest supported phone — the view scale is 0.277 in battle and 0.269 during
 * setup, which put the notch at **1.11 CSS px with a 0.72 px gap**: below the
 * resolving limit, so four notches and five were one smear and tier was a
 * colour-only channel again, on exactly the device where it matters most and
 * for exactly the player the plaque was built for.
 *
 * A constant in logical px cannot express "big enough to read" when the number
 * of CSS px a logical px buys varies 1.5× across the matrix. So the notch and
 * the gap are now floored in **CSS px**, converted back through the live view
 * scale (`setViewScale`), and the radius-driven size is kept as the *lower*
 * bound it always was — a champion still wears a bigger tag than a runt, the
 * runt just never wears an illegible one.
 */
const NOTCH_MIN_CSS = 1.7
const NOTCH_GAP_MIN_CSS = 1.15
const NOTCH_H_MIN_CSS = 2.8

/**
 * ── the mark's INSIDE needed a floor of its own (minor 3) ───────────────────
 *
 * `NOTCH_MIN_CSS` floors the notch — a solid bar whose only job is to be
 * counted. It says nothing about the elite mark beside it, and the mark's
 * internal features were left on the radius-driven scale alone. Measured on
 * tier-3 elites at every viewport in the matrix: the swift chevron's stroke was
 * **0.77 CSS px** and the gap between its two chevrons **0.64** — 45% and 38%
 * of the notch floor. At dpr 2 that is two 1.5-device-px strokes 1.3 device px
 * apart, so the one thing the mark encodes, that there are TWO of them, aliases
 * away and "double chevron" reads as a smudge. Tier 3 is where elites are most
 * common, so this was the common case.
 *
 * 1.15 rather than 1.7 because these are separation features, not countable
 * ones: it is the same number `NOTCH_GAP_MIN_CSS` uses for "these two things
 * must not merge", which is exactly the question here. The mark's WIDTH is
 * derived from it rather than the other way round — see `tierTagGeometry` — so
 * the plaque grows to fit a legible mark instead of the mark shrinking to fit
 * the plaque.
 *
 * The other two marks are solid silhouettes with no thin interior: the warded
 * diamond has none at all, and the plated shield's one distinguishing feature
 * is its taper, which was 1.40 CSS px of a 2.90 CSS px mark — a shield that
 * read as a bar. The taper is now 0.58 of the mark's height, which against the
 * `NOTCH_H_MIN_CSS` floor is never less than 1.62 CSS px and needs no separate
 * constant.
 */
const MARK_FEATURE_MIN_CSS = 1.15

/**
 * The tag's geometry in LOGICAL px, exported so a harness can measure the
 * channel rather than re-deriving the formula and measuring its own copy of it.
 * (`rv-small` hard-coded `4 * scale`, which is why the regression it caught was
 * caught by eye and not by the gate.)
 *
 * `markStroke` / `markArm` are part of the return for the same reason: they are
 * the numbers minor 3 is about, and a harness that re-derives them measures its
 * own copy of the formula rather than the channel.
 */
export function tierTagGeometry(tier: number, radius: number, elite: EliteMark = null) {
  const k = Math.max(1, radius / 13)
  const vs = Math.max(getViewScale(), 0.02)
  const notchW = Math.max(4 * k, NOTCH_MIN_CSS / vs)
  const notchH = Math.max(6.5 * k, NOTCH_H_MIN_CSS / vs)
  const gap = Math.max(2.6 * k, NOTCH_GAP_MIN_CSS / vs)
  const padX = Math.max(2.4 * k, gap * 0.9)
  const padY = 1.8 * k
  /**
   * The double chevron is the only mark with interior features, so it is the
   * only one whose width is driven by a floor rather than by the plaque scale.
   * Laid out as `[stroke][gap][stroke][arm]` with the gap set equal to the
   * stroke — three floored spans and the chevron's own reach — so the width
   * follows from the floor instead of the features being squeezed into it.
   */
  const markStroke = elite === 'swift' ? Math.max(notchH * 0.24, MARK_FEATURE_MIN_CSS / vs) : 0
  const markArm = elite === 'swift' ? Math.max(notchH * 0.34, markStroke) : 0
  // The elite mark is a SECOND field on the same plaque, set off by a wider gap
  // so the count never absorbs it (see `drawEliteMark`).
  const markW = elite === 'swift' ? 3 * markStroke + markArm : elite ? notchH * 0.92 : 0
  const markGap = elite ? gap * 1.9 : 0
  const w = tier * notchW + (tier - 1) * gap + markGap + markW + padX * 2
  const h = notchH + padY * 2
  return {
    k, notchW, notchH, gap, padX, padY, markW, markGap, markStroke, markArm, w, h,
    cssNotch: notchW * vs,
    cssGap: gap * vs,
    cssMarkStroke: markStroke * vs,
    /** The gap between the two chevrons — equal to the stroke by construction. */
    cssMarkGap: markStroke * vs,
    /** The plated shield's taper, the one feature that separates it from a bar. */
    cssMarkTaper: notchH * PLATED_TAPER * vs,
  }
}

export function drawTierTag(
  ctx: CanvasRenderingContext2D,
  tier: number,
  radius: number,
  top: number,
  elite: EliteMark,
): void {
  const G = tierTagGeometry(tier, radius, elite)
  const y = top - G.h - 2 * G.k

  // Dark plaque, light notches — deliberately the same contrast direction as
  // the HP bar right below it (`rgba(0,0,0,0.55)` ground, bright fill), so the
  // two read as one small HUD stack rather than as a second, louder decoration.
  // The first pass inverted it — dark notches on a cream plaque — and became the
  // brightest thing on the field, which is exactly what the review checklist
  // forbids: nothing may out-contrast the units themselves.
  ctx.fillStyle = 'rgba(26,17,9,0.62)'
  roundRect(ctx, -G.w / 2, y, G.w, G.h, 1.6 * G.k)
  ctx.fill()

  ctx.fillStyle = 'rgba(244,233,208,0.95)'
  for (let i = 0; i < tier; i++) {
    const x = -G.w / 2 + G.padX + i * (G.notchW + G.gap)
    ctx.fillRect(x, y + G.padY, G.notchW, G.notchH)
  }

  if (elite) {
    const x = -G.w / 2 + G.padX + tier * G.notchW + (tier - 1) * G.gap + G.markGap
    drawEliteMark(ctx, elite, x, y + G.padY, G.markW, G.notchH, G.markStroke, G.markArm)
  }
}

/**
 * ── every elite variant was pixel-identical to its base type (M6) ───────────
 *
 * `applyMod` in `enemies.ts` overrides `id` (forced back to the base, so the
 * sprite and the tier both resolve to the base type), `name`, `speed`,
 * `physResist` and `magResist` — and `drawEnemy` read none of those except
 * `id`. So a Warded Bomber shrugging off 49% magic was the same pixels as one
 * shrugging off 15%; a Plated column was identical but 10% slower; and a Swift
 * column was 40% faster translation on a fixed 10 fps walk cycle, which is a
 * moon-walk. Mid-fight the player could not tell which goblins were the
 * 55%-plated ones — the single most decision-relevant fact about them.
 *
 * The channel is a SHAPE on the plaque the tier count already owns, for the
 * same reason the count is a count: a second hue would be a second thing a
 * deuteranope cannot separate at 19 CSS px, and this codebase has now solved
 * this exact problem twice (the notch plaque, the four proc geometries).
 * Plated is a shield, Warded a diamond ward, Swift a double chevron — three
 * silhouettes that survive at the notch's own size, on the notch's own ground.
 */
export type EliteMark = 'plated' | 'warded' | 'swift' | null

/** How deep the plated shield's point is cut, as a fraction of the mark height. */
const PLATED_TAPER = 0.58

/**
 * ── the channel is keyed on the MODIFIER, not on a display string (M2) ──────
 *
 * The first version of this string-matched `'Plated '` / `'Warded '` / `'Swift '`
 * against `type.name`. Correct today, and one edit from silently wrong: the
 * thing it matched is `EnemyMod.prefix`, whose own docstring in `enemies.ts`
 * calls it "Display prefix on the enemy's name, shown in the pre-wave preview".
 * Retitling `Plated` to `Ironclad` — a copy change, in a file this very comment
 * calls another agent's — would have returned `null` for every plated variant,
 * dropped the mark, and made every elite pixel-identical to its base again:
 * **the exact defect this fix exists to close, restored with every gate green.**
 * The failure is silent in the other direction too — a future base enemy named
 * "Swift Runner" would have worn an unearned chevron.
 *
 * So the mark is keyed on the `EnemyType` OBJECT, resolved once from the
 * registry through `modKey` — the same `(base, mod)` composition `enemies.ts`
 * registers under, which is the gameplay identity that file itself names as the
 * durable one ("The key is the gameplay identity … The `id` is the *art*
 * identity"). Renaming a prefix now changes nothing here; only renaming a mod's
 * `id` can, and that is a registry key, not copy.
 *
 * And it fails LOUDLY rather than silently: `ELITE_MARK_BY_MOD` must cover
 * every entry in `ENEMY_MODS`, and a modifier that ships without one throws on
 * import in dev and logs in prod, instead of quietly wearing no mark. A fourth
 * modifier is a plausible next move for that file; this is the guard that makes
 * adding one a build failure rather than a regression nobody sees.
 */
const ELITE_MARK_BY_MOD: Readonly<Record<string, Exclude<EliteMark, null>>> = {
  plated: 'plated',
  warded: 'warded',
  swift: 'swift',
}

/** Registered `EnemyType` object → its mark. Identity, not text. */
const ELITE_BY_TYPE = new Map<EnemyType, Exclude<EliteMark, null>>()
{
  const uncovered: string[] = []
  for (const m of ENEMY_MODS) if (!ELITE_MARK_BY_MOD[m.id]) uncovered.push(m.id)
  // `applyMod` forces the variant's `id` back to the base's, so a registry entry
  // whose key equals its own `id` is a BASE type and everything else is a
  // variant — which is how the base types are enumerated without importing a
  // list `enemies.ts` does not export.
  for (const [key, type] of Object.entries(ENEMY_TYPES)) {
    if (type.id !== key) continue
    for (const m of ENEMY_MODS) {
      const mark = ELITE_MARK_BY_MOD[m.id]
      const variant = ENEMY_TYPES[modKey(key, m.id)]
      if (mark && variant) ELITE_BY_TYPE.set(variant, mark)
    }
  }
  if (uncovered.length > 0) {
    const msg =
      `renderer: elite modifier(s) ${uncovered.join(', ')} have no mark in ELITE_MARK_BY_MOD — ` +
      `every variant of them draws pixel-identical to its base type (M2).`
    if (import.meta.env?.DEV) throw new Error(msg)
    console.error(msg)
  }
}

export function eliteMark(type: EnemyType): EliteMark {
  return ELITE_BY_TYPE.get(type) ?? null
}

/**
 * Every registered enemy type with the mark it resolves to — the shape a
 * harness needs to assert coverage over the whole registry rather than over the
 * three variants someone remembered to check.
 */
export function eliteMarkAudit(): { key: string; base: string; mod: string | null; name: string; mark: EliteMark }[] {
  const rows: { key: string; base: string; mod: string | null; name: string; mark: EliteMark }[] = []
  for (const [key, type] of Object.entries(ENEMY_TYPES)) {
    const mod = ENEMY_MODS.find((m) => modKey(type.id, m.id) === key)
    rows.push({ key, base: type.id, mod: mod ? mod.id : null, name: type.name, mark: eliteMark(type) })
  }
  return rows
}

function drawEliteMark(
  ctx: CanvasRenderingContext2D,
  kind: Exclude<EliteMark, null>,
  x: number,
  y: number,
  w: number,
  h: number,
  stroke: number,
  arm: number,
): void {
  const cx = x + w / 2
  const cy = y + h / 2
  ctx.fillStyle = 'rgba(244,233,208,0.95)'
  ctx.beginPath()
  if (kind === 'plated') {
    // A shield: flat shoulders, tapered point. Reads as "armoured" — and the
    // taper is the ONLY thing separating it from a notch, so it takes 0.58 of
    // the height rather than 0.50, which puts it above the feature floor at
    // every viewport in the matrix instead of 0.25 CSS px under it.
    ctx.moveTo(x, y)
    ctx.lineTo(x + w, y)
    ctx.lineTo(x + w, y + h * (1 - PLATED_TAPER))
    ctx.lineTo(cx, y + h)
    ctx.lineTo(x, y + h * (1 - PLATED_TAPER))
    ctx.closePath()
  } else if (kind === 'warded') {
    // A diamond ward — the only mark with no flat edge, so it separates from
    // the notches beside it by outline alone.
    ctx.moveTo(cx, y)
    ctx.lineTo(x + w, cy)
    ctx.lineTo(cx, y + h)
    ctx.lineTo(x, cy)
    ctx.closePath()
  } else {
    /**
     * A double chevron, pointing the way it runs — laid out from the FLOORED
     * stroke and arm `tierTagGeometry` computed, not from fractions of `w`.
     *
     * `w` is now derived from them (`3 * stroke + arm`), so the two chevrons sit
     * at 0 and `2 * stroke` and the whole mark lands exactly inside its box:
     * stroke, a gap equal to the stroke, stroke, arm. The old form took its
     * thickness as `0.3 * w` and its separation as `0.55 * w` — which also
     * over-ran the box by one stroke — so both features shrank with the plaque
     * and neither had a floor. See `MARK_FEATURE_MIN_CSS`.
     */
    for (const o of [0, stroke * 2]) {
      ctx.moveTo(x + o, y)
      ctx.lineTo(x + o + stroke, y)
      ctx.lineTo(x + o + arm + stroke, cy)
      ctx.lineTo(x + o + stroke, y + h)
      ctx.lineTo(x + o, y + h)
      ctx.lineTo(x + o + arm, cy)
      ctx.closePath()
    }
  }
  ctx.fill()
}
