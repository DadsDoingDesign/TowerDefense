/**
 * The enemy-asset inventory, as pure data — every goblin the game can field,
 * on every road: clan × faction × tier, and the elite / armour / boss forms
 * each one takes, with its look (in words and as the parts the bake lays on)
 * and the name every surface gives it (`clans.enemyName`).
 *
 * Read by `scripts/enemy-assets.ts` (the CLI: prints the table, writes
 * `docs/enemy-assets/inventory.json`, drives the render harness) and by
 * `harness/enemies.ts` (the harness, which renders through the real
 * `units.drawEnemy`). No DOM, no Node: both programs import it.
 */
import { CLAN_IDS, CLANS, clanArtId, clanLookId, enemyName, FACTIONS, PLAIN_LOOKS, TIERS, type ClanId, type Faction, type Tier } from '../src/game/data/clans'
import { ENEMY_TYPES } from '../src/game/data/enemies'
import { recipeFor } from './enemy-clans-art'

/** The forms a goblin takes: itself, the three elite columns' modifiers. A tier 5 is the boss. */
export const FORMS = ['base', 'swift', 'plated', 'warded'] as const
export type Form = (typeof FORMS)[number]
/** What each form is called on the asset page: Swift is the plain elite (no armour), Plated / Warded the armoured ones. */
export const FORM_TITLE: Readonly<Record<Form, string>> = { base: 'Base', swift: 'Elite (Swift)', plated: 'Plated', warded: 'Warded' }

/** The roads' clans, in the companies' order (every goblin drawn is a clan's: the plain CC0 goblins are the bake's input only). */
export const ROADS: readonly (ClanId | null)[] = CLAN_IDS
export const roadSlug = (clan: ClanId | null): string => clan ?? 'plain'
export const roadTitle = (clan: ClanId | null): string => (clan ? CLANS.find((c) => c.id === clan)!.name : 'Plain goblins (benches)')

export interface EnemyAssetRow {
  /** Null: the plain goblin (the hand-made benches, the balance suite). */
  clan: ClanId | null
  clanName: string
  company: string | null
  faction: Faction
  tier: Tier
  /** The engine's registry key (`torch3`) and the look's id (`delve.torch3`). */
  key: string
  lookId: string
  /** The sprite role the field draws (`delve_torch3`, or `torch3`). */
  role: string
  /** The name every surface shows on this road. */
  name: string
  /** The engine's own name (the bench's, and the balance report's). */
  engineName: string
  boss: boolean
  /** The look, in words, and the parts the bake laid on (in paint order). */
  look: string
  parts: string[]
  /** Each form's registry key and name. */
  forms: { form: Form; key: string; name: string }[]
}

export function enemyAssetRows(): EnemyAssetRow[] {
  return ROADS.flatMap((clan) =>
    FACTIONS.flatMap((faction) =>
      TIERS.map((tier): EnemyAssetRow => {
        const key = `${faction}${tier}`
        const t = ENEMY_TYPES[key]
        const c = clan ? CLANS.find((k) => k.id === clan)! : null
        return {
          clan,
          clanName: roadTitle(clan),
          company: c?.company ?? null,
          faction,
          tier,
          key,
          lookId: clanLookId(clan, faction, tier),
          role: clanArtId(clan, key),
          name: enemyName(t, clan),
          engineName: t.name,
          boss: !!t.isBoss,
          look: c ? c.looks[faction][tier - 1] : PLAIN_LOOKS[faction][tier - 1],
          parts: clan ? recipeFor(clan, faction, tier).parts.map((p) => p.name) : [],
          forms: FORMS.map((form) => {
            const k = form === 'base' ? key : `${key}_${form}`
            return { form, key: k, name: enemyName(ENEMY_TYPES[k], clan) }
          }),
        }
      }),
    ),
  )
}

/** Where one render lands under `docs/enemy-assets/`. */
export const renderPath = (clan: ClanId | null, key: string, form: Form): string => `${roadSlug(clan)}/${key}${form === 'base' ? '' : `-${form}`}.png`
export const walkPath = (clan: ClanId | null, key: string): string => `${roadSlug(clan)}/walk-${key}.png`
export const sheetPath = (clan: ClanId | null): string => `sheets/${roadSlug(clan)}.png`
