/**
 * The goblin clans (Oct 2026; the designer: "a similar expansion of enemy
 * types unique to each map, with unique visual looks beyond just colour").
 *
 * Each company's road has its own clan: the same three factions of five tiers
 * (`enemies.ts`), dressed and named for that road's world —
 *
 *  - Peppercorn → the **Cinder Clan**, ember-and-spice raiders: hoods that
 *    burn at the tip, soot-black iron, firepots, chilli-stemmed spice kegs.
 *  - Butcherblock → the **Gnawbone Pack**, marsh raiders of the smokehouse
 *    barges: boar-skull helms, meat hooks, hides, kegs heaped with salt.
 *  - Ironvein → the **Deepdelve**, miners in riveted iron: lamp helmets,
 *    picks, ore baskets, riveted iron kegs.
 *  - Rosethread → the **Silkcut Gang**, thread-and-silk cutthroats: wide
 *    brimmed hats with a rose, needle blades, spools, a reel for a barrel.
 *  - Greenvial → the **Sporecap Rot**, hollow-dwellers who brew spoiled stock
 *    into rot: huge spotted caps, spore censers, moss, vats foaming over.
 *
 * (Oct 2026, the companies' rename: the `smudge` and `hexmoon` ids stay — a
 * save's Codex keeps them — and wear the Gnawbone and Sporecap looks and names.)
 *
 * **A clan is a LOOK and a NAME, nothing else.** Stats, behaviours, wave
 * make-up and every RNG draw are the faction's own (`enemies.ts`,
 * `waves.ts`): the engine never sees a clan. The renderer draws the clan's
 * baked strips (`scripts/enemy-clans.ts` → `tinyswords/<clan>_<id>…png`) and
 * every surface that names an enemy asks {@link enemyName}, so no two
 * surfaces can drift.
 *
 * **Every goblin a player sees is a clan's** (the designer: "we should update
 * everything … art should also update"). The plain CC0 goblins are the bake's
 * INPUT only — no runtime role, never fetched, never drawn. The clan follows
 * the RUN (`run/clans.ts`): the run's company's clan on any field, the
 * hand-made benches too; the Sovereign Route mixes them by act (a hash of the
 * run seed — never a draw on a run stream); and a surface with no run (the
 * home, a harness, the balance suite) draws {@link DEFAULT_CLAN}. Only the
 * engine — and so the balance report — keeps the faction's own names.
 */
import { SPECIALISTS } from './behaviours'
import { COMPANY_IDS, type CompanyId } from './companies'
import { eliteName, ENEMY_MODS } from './enemies'

export type Faction = 'torch' | 'tnt' | 'barrel'
export const FACTIONS: readonly Faction[] = ['torch', 'tnt', 'barrel']
export const TIERS = [1, 2, 3, 4, 5] as const
export type Tier = (typeof TIERS)[number]

export type ClanId = 'cinder' | 'smudge' | 'delve' | 'silkcut' | 'hexmoon'
/** In `COMPANY_IDS` order: the clan of each company's road. */
export const CLAN_IDS: readonly ClanId[] = ['cinder', 'smudge', 'delve', 'silkcut', 'hexmoon']
export const isClanId = (v: unknown): v is ClanId => typeof v === 'string' && (CLAN_IDS as readonly string[]).includes(v)
/** The clan drawn where no run says otherwise: the first company's (Peppercorn — the first launch's road). */
export const DEFAULT_CLAN: ClanId = 'cinder'

type Five = readonly [string, string, string, string, string]

export interface Clan {
  id: ClanId
  /** Whose road it raids. */
  company: CompanyId
  /** The clan's name, as a section title and a chip. */
  name: string
  /** One line: what tells the clan apart at a glance (the asset page). */
  tell: string
  /** Each faction's five tiers, named for the clan (tier 5 is its champion). */
  units: Readonly<Record<Faction, Five>>
  /** The two casters (`behaviours.SPECIALISTS`), by suffix. */
  specialists: Readonly<Record<'shaman' | 'bearer', string>>
  /** What each faction × tier wears, in words (the asset inventory). */
  looks: Readonly<Record<Faction, Five>>
}

/** What the plain CC0 goblin each clan is baked from looks like (the bake's input, never drawn). */
export const PLAIN_LOOKS: Readonly<Record<Faction, Five>> = {
  torch: ['hood, torch', 'hood, torch', 'hood, torch', 'hood, torch', 'hood, torch, champion scale'],
  tnt: ['goggles, dynamite pack, lit stick', 'goggles, dynamite pack, lit stick', 'goggles, dynamite pack, lit stick', 'goggles, dynamite pack, lit stick', 'goggles, dynamite pack, champion scale'],
  barrel: ['TNT keg, fuse', 'TNT keg, fuse', 'TNT keg, fuse', 'TNT keg, fuse', 'TNT keg, fuse, champion scale'],
}

export const CLANS: readonly Clan[] = [
  {
    id: 'cinder',
    company: 'spice',
    name: 'Cinder Clan',
    tell: 'Hoods that burn at the tip and soot iron; the torch burns on, the kegs wear a chilli stem and a spice label.',
    units: {
      torch: ['Ember Runt', 'Cinder Goblin', 'Pepper Raider', 'Blaze Berserker', 'Chief Scorchgut'],
      tnt: ['Spark Whelp', 'Firepot Bomber', 'Kiln Smasher', 'Ash Sapper', 'The Cayenne King'],
      barrel: ['Spice Keg', 'Pepper Roller', 'Charred Keg', 'Furnace Barrel', 'The Brimstone Vat'],
    },
    specialists: { shaman: 'Ember Shaman', bearer: 'Hearth Bearer' },
    looks: {
      torch: ['burning hood tip, torch', '+ soot pauldron', '+ chilli banner', 'taller flame', 'horned fire crown, ember mantle'],
      tnt: ['burning cap, firepot pack, firepot', '+ soot pauldron', '+ chilli banner', 'taller flame', 'horned fire crown, ember standard'],
      barrel: ['chilli stem, spice label', '+ ember studs', '+ ember fins', '+ taller stem', 'brimstone crown, ember fins'],
    },
  },
  {
    id: 'smudge',
    company: 'art',
    name: 'Gnawbone Pack',
    tell: 'Boar skulls for helms, meat hooks for torches, hides and smoke racks; the kegs come heaped with salt.',
    units: {
      torch: ['Gnaw Runt', 'Hook Goblin', 'Marsh Raider', 'Bone Berserker', 'Chief Gristle'],
      tnt: ['Salt Whelp', 'Brine Bomber', 'Rack Wrecker', 'Fen Sapper', 'The Marrow King'],
      barrel: ['Salt Keg', 'Brine Roller', 'Bone Cask', 'Siege Smoker', 'The Pickling Vat'],
    },
    specialists: { shaman: 'Bone Shaman', bearer: 'Hide Bearer' },
    looks: {
      torch: ['boar-skull helm, meat hook', '+ hide pauldron', '+ smoke rack of meat', 'tusked skull', 'bone crown, hide cape'],
      tnt: ['boar-skull helm, salt sacks, salt pouch', '+ hide pauldron', '+ smoke rack of meat', 'tusked skull', 'bone crown, hide standard'],
      barrel: ['salt heap, crossed-bones label', '+ twine', '+ hanging bones', '+ a bone in the salt', 'bone crown, hanging bones'],
    },
  },
  {
    id: 'delve',
    company: 'metals',
    name: 'Deepdelve',
    tell: 'Riveted iron: lamp helmets, picks for torches, ore baskets on their backs.',
    units: {
      torch: ['Pit Runt', 'Pick Goblin', 'Tunnel Raider', 'Drill Berserker', 'Overseer Krag'],
      tnt: ['Blast Whelp', 'Charge Bomber', 'Rockbreaker', 'Tunnel Sapper', 'The Blasting King'],
      barrel: ['Ore Tub', 'Cart Roller', 'Rivet Keg', 'Siege Boiler', 'The Iron Crucible'],
    },
    specialists: { shaman: 'Lamp Shaman', bearer: 'Rivet Bearer' },
    looks: {
      torch: ['lamp helmet, pick', '+ riveted pauldron', '+ mine lantern pole', 'twin-lamp helmet', 'great helm, iron mantle'],
      tnt: ['lamp helmet, ore basket, charge', '+ riveted pauldron', '+ mine lantern pole', 'twin-lamp helmet', 'great helm, iron standard'],
      barrel: ['rivet cap, rivet plate', '+ studded hoops', '+ iron side plates', '+ lamp on the cap', 'crucible crown, side plates'],
    },
  },
  {
    id: 'silkcut',
    company: 'silk',
    name: 'Silkcut Gang',
    tell: 'Wide brims and roses, needle blades, spools on their backs; the barrel is a reel.',
    units: {
      torch: ['Snip Runt', 'Needle Goblin', 'Thread Raider', 'Shear Berserker', 'Madam Briar'],
      tnt: ['Tangle Whelp', 'Bobbin Bomber', 'Loom Wrecker', 'Snare Sapper', 'The Spindle Queen'],
      barrel: ['Spool Imp', 'Bobbin Roller', 'Iron Spool', 'Siege Spindle', 'The Great Reel'],
    },
    specialists: { shaman: 'Silk Shaman', bearer: 'Veil Bearer' },
    looks: {
      torch: ['brimmed hat, rose, needle', '+ ribbon pauldron', '+ pennant', 'plumed hat', 'rose crown, silk train'],
      tnt: ['brimmed hat, spool pack, thread bomb', '+ ribbon pauldron', '+ pennant', 'plumed hat', 'rose crown, silk standard'],
      barrel: ['reel flanges, wound thread', '+ needle', '+ loose thread end', '+ rose on top', 'rose crown, flanges'],
    },
  },
  {
    id: 'hexmoon',
    company: 'scrolls',
    name: 'Sporecap Rot',
    tell: 'Huge spotted caps with glowing gills, swinging spore censers, moss; the kegs are vats foaming with green rot.',
    units: {
      torch: ['Spore Runt', 'Cap Goblin', 'Rot Raider', 'Mould Berserker', 'Mother Mildew'],
      tnt: ['Puff Whelp', 'Spore Bomber', 'Rot Wrecker', 'Blight Sapper', 'The Toadstool King'],
      barrel: ['Rot Jar', 'Moss Roller', 'Mould Cask', 'Siege Still', 'The Rot Vat'],
    },
    specialists: { shaman: 'Spore Shaman', bearer: 'Moss Bearer' },
    looks: {
      torch: ['spotted cap, spore censer', '+ moss pauldron', '+ glow-cap pole', 'double cap', 'toadstool ring, moss cloak'],
      tnt: ['spotted cap, rot jars, puffball', '+ moss pauldron', '+ glow-cap pole', 'double cap', 'toadstool ring, moss standard'],
      barrel: ['rot ooze, bubbling window', '+ moss patches', '+ side toadstools', '+ a toadstool on the lid', 'toadstool ring, side toadstools'],
    },
  },
]

const BY_ID = new Map(CLANS.map((c) => [c.id, c]))
export const clanById = (id: ClanId): Clan => BY_ID.get(id)!

/** The clan raiding a company's road. */
export const CLAN_OF_COMPANY: Readonly<Record<CompanyId, ClanId>> = Object.fromEntries(
  COMPANY_IDS.map((c) => [c, CLANS.find((k) => k.company === c)!.id]),
) as Record<CompanyId, ClanId>

/** A registry key or art id's faction and tier: `torch3_plated` → torch, 3. Null for anything else. */
export function baseOf(key: string): { faction: Faction; tier: Tier } | null {
  const m = /^(torch|tnt|barrel)([1-5])(?:_|$)/.exec(key)
  return m ? { faction: m[1] as Faction, tier: Number(m[2]) as Tier } : null
}

/** A clan's name for one faction × tier. */
export const clanUnitName = (clan: ClanId, faction: Faction, tier: Tier): string => clanById(clan).units[faction][tier - 1]

/**
 * The look's id: one per clan × faction × tier (`cinder.torch3`; a bench
 * goblin is `plain.torch3`). Elites and specialists wear their base's look,
 * as they always have (`enemies.ts`: the art identity is `type.id`).
 */
export const clanLookId = (clan: ClanId | null, faction: Faction, tier: Tier): string => `${clan ?? 'plain'}.${faction}${tier}`

/**
 * The sprite role a goblin art id is drawn with (`cinder_torch3`): its clan's
 * strip — {@link DEFAULT_CLAN}'s with no clan given, since no plain goblin is
 * ever drawn. A non-goblin id comes back as it is.
 */
export const clanArtId = (clan: ClanId | null | undefined, artId: string): string => (baseOf(artId) && !isClanRole(artId) ? `${clan ?? DEFAULT_CLAN}_${artId}` : artId)
/** The plain goblin strips' roles (`torch3_walk`, `barrel2`): bake inputs only, never a runtime role. */
export const PLAIN_GOBLIN_ROLES: readonly string[] = (['torch', 'tnt', 'barrel'] as const).flatMap((f) => [1, 2, 3, 4, 5].flatMap((t) => (f === 'barrel' ? [`${f}${t}`] : [`${f}${t}`, `${f}${t}_walk`])))

/** Every baked clan role: a run cycle for torch and tnt, the still for a barrel. */
export const CLAN_WALK_ROLES: readonly string[] = CLAN_IDS.flatMap((c) =>
  (['torch', 'tnt'] as const).flatMap((f) => TIERS.map((t) => `${c}_${f}${t}_walk`)),
)
export const CLAN_STILL_ROLES: readonly string[] = CLAN_IDS.flatMap((c) => TIERS.map((t) => `${c}_barrel${t}`))
/** A role is a clan's when it starts with a clan id. */
export function isClanRole(role: string): boolean {
  return CLAN_IDS.some((c) => role.startsWith(`${c}_`))
}
export const clanRolesOf = (clan: ClanId): string[] => [...CLAN_WALK_ROLES, ...CLAN_STILL_ROLES].filter((r) => r.startsWith(`${clan}_`))

const HALF = ' (half)'

/**
 * What an enemy is called on this road. THE one helper every surface names an
 * enemy through — the enemy card, the wave preview, the run map's preview,
 * the boss plate, the announcer, the defeat receipt and the Codex.
 *
 * Takes the runtime type (its art `id` and engine `name`), so it covers every
 * registry key the engine can field: a specialist (`Torch Shaman` → the
 * clan's caster), an elite (`Bomber · Warded` → `Hex Bomber · Warded`), and a
 * champion's half (`… (half)`). With no clan it is the engine's name, so the
 * benches — and the balance report — read exactly as before.
 */
export function enemyName(type: { id: string; name: string }, clan: ClanId | null | undefined): string {
  if (!clan) return type.name
  const base = baseOf(type.id)
  if (!base) return type.name
  let rest = type.name
  const half = rest.endsWith(HALF)
  if (half) rest = rest.slice(0, -HALF.length)
  const mod = ENEMY_MODS.find((m) => rest.endsWith(eliteName('', m.prefix)))
  if (mod) rest = rest.slice(0, -eliteName('', mod.prefix).length)
  const sp = SPECIALISTS.find((s) => s.name === rest)
  let name = sp ? clanById(clan).specialists[sp.suffix as 'shaman' | 'bearer'] ?? rest : clanUnitName(clan, base.faction, base.tier)
  if (mod) name = eliteName(name, mod.prefix)
  return half ? name + HALF : name
}
