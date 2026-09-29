import { canUpgrade, describeBase, RARITY, reforgeDust, upgradeDust } from '../../game/data/items'
import { describeEnchant, describeGrant, describeMods, STACKING_RULE } from '../../game/data/describe'
import { getNode } from '../../game/data/archetypeTree'
import { UPGRADE_PATHS } from '../../game/data/upgradeTree'
import { buildName } from '../../game/engine/leveling'
import { computeCombat } from '../../game/engine/combat'
import { MAX_ROSTER, THREAT_PER_CHOICE, THREAT_PER_NODE, useGameStore } from '../../state/gameStore'
import { BANNER_RUNGS, MAX_BANNER, useMetaStore, UPGRADES } from '../../state/metaStore'
import { assistProfile, useSettingsStore, type AssistLevel, type VisionMode } from '../../state/settingsStore'
import { useShallow } from 'zustand/react/shallow'
import { archetypeVar, ARCHETYPE_GLYPH, damageMark, itemIcon, rarityVar, type IconKey } from '../channels'
import { useShellContext } from './context'
import type { Archetype, Item, Sentinel } from '../../game/types'

export interface Price {
  amount: number
  currency: 'gold' | 'dust' | 'marks'
}

/**
 * A body line that knows something its own words do not (M4).
 *
 * Almost every line is a bare string and stays one. This exists for the case
 * where the CLASSIFIER cannot be right: `effectIcon` reads the sentence, and
 * `Reckless — +85% damage, −45% attack speed` classifies to `damage`, which is
 * a true reading of the words and the wrong headline for the item. The fact
 * that decides the purchase is that it is a CURSE, and no substring of the text
 * carries that — only `e.id`'s `cx_` prefix does.
 *
 * `DetailBand` already knew this and rendered the override on the item panel.
 * `itemBody` below rebuilt the identical strings for the merchant board, the
 * Forge and the reward card and dropped it, so three of the four surfaces —
 * including the one this file calls the screen that has to be answerable before
 * you read a word — advertised all four curses with a plain upside icon. The
 * fix is not a second override at a second render site; it is that there is
 * now ONE producer, and what it knows travels with the line.
 */
export interface BodyLine {
  text: string
  /** Overrides `effectIcon` where the producer knows what the sentence cannot say. */
  mark?: IconKey
  /** The Context panel's accent treatment. The page card renders every line alike. */
  tone?: 'accent'
}
export type Body = (string | BodyLine)[]

export const lineText = (l: string | BodyLine): string => (typeof l === 'string' ? l : l.text)
export const lineMark = (l: string | BodyLine): IconKey | undefined => (typeof l === 'string' ? undefined : l.mark)
export const lineTone = (l: string | BodyLine): string | undefined => (typeof l === 'string' ? undefined : l.tone)

/**
 * A thing an Offer can do. `confirm` arms the control instead of firing it: the
 * control's own label swaps to "Never mind", the note appears, and a second,
 * separate control — labelled `confirm.label` — is what actually runs `run`.
 * Pressing the armed control again only backs out, which is what makes an
 * accidental double-activation structurally unable to destroy anything. See
 * `useArmedAction` in PageScreens.tsx for the full guarantee.
 *
 * That is the shell's one destructive-confirm affordance — rule four says
 * modals are for regret, and this is what stops the regret happening.
 *
 * `confirm.label` is therefore the label of the *confirm* control, not of this
 * action's own button; write it as the deed ("Yes — erase it all").
 */
export interface Act {
  label: string
  run: () => void
  disabled?: boolean
  cost?: Price
  confirm?: { label: string; note: string }
  /** The mark on the row a secondary action gets drawn as. */
  icon?: IconKey
}

/**
 * A secondary action — and deliberately NOT an `Act`, because it may not carry
 * a `confirm`.
 *
 * Neither renderer arms a secondary control: `PageScreen` puts it in a plain
 * `MenuRow` and `DetailBand`'s `OfferPanel` in a plain button, both of which
 * call `run` on the first tap. A `confirm` set here was therefore accepted by
 * the type checker, dropped silently at render, and the "guarded" action fired
 * immediately. Nothing destructive rides on a secondary today; this makes sure
 * the next one that tries is a compile error rather than a live one-tap wipe.
 * Anything that needs confirming has to be the primary `action`.
 */
export type SecondaryAct = Omit<Act, 'confirm'> & { confirm?: never }

/**
 * One shape for everything choosable. Merchant stock, shrine terms, recruits,
 * hero picks, reward cards, endless rooms, menu entries and perks all become
 * Offers, which is what lets a single Selector row and a single Context mode
 * serve all of them — rule one of the shell.
 */
export interface Offer {
  id: string
  title: string
  sub?: string
  /** Accent for the card rail and the panel title. */
  color?: string
  glyph?: string
  /**
   * What this offer IS, as a drawn mark (P3).
   *
   * `glyph` still exists for the handful of concepts with no cell — the three
   * archetype marks, `∞`, `♪` — but everything with a picture now carries the
   * picture, and both renderers draw it. Before this, `MenuRow` dropped `glyph`
   * on the floor, so the merchant board and the reward screen were plain text
   * even for the offers that already declared one.
   */
  icon?: IconKey
  /**
   * A corner mark riding on `icon` — physical or magic, on a weapon.
   *
   * A Greatsword and a Grimoire were both `⚒` and both an unlabelled row, so
   * the single property that decides whether a drop is worth anything to a
   * given hero was legible only by reading the noun and knowing the table.
   */
  mark?: IconKey | null
  /**
   * Every line of `body` is generated effect text — `describeBase`,
   * `describeEnchant`, `describeMods` — so both renderers may classify each
   * line and draw its mark.
   *
   * Opt-in, because most offer bodies mix generated lines with authored prose
   * and `effectIcon` matches phrases: "Threat is the HP multiplier on every
   * enemy in every wave that follows" contains "HP" and would take a heart.
   * Set on the merchant's stock, the Forge's stock and item reward cards, and
   * nowhere else.
   */
  bodyIcons?: boolean
  /** Price chip on the card. */
  cost?: Price
  /** Bullet lines shown in the Context panel. */
  body: Body
  /**
   * The one line that is a cost rather than a description — a reward card's
   * `downside`, and anything else that has to be read before it is taken. It is
   * drawn in the danger colour AND prefixed with a warning glyph, so it is not
   * a hue on its own, and it is a separate field rather than a body line so it
   * cannot be lost in the middle of a list.
   */
  warn?: string
  /** Primary action, rendered as the panel's button. */
  action?: Act
  /**
   * Secondary action (decline, skip, leave — or a second thing to buy). It
   * carries its own price and disabled state because the Forge sells two
   * different things off one item, and a single `cost` on the Offer cannot say
   * so. The proper fix is the typed Offer split (Commerce/Nav/Toggle/Candidate/
   * Destructive) scheduled for WS5; this is the minimum that stops the shell
   * lying about prices in the meantime.
   */
  secondary?: SecondaryAct
  /**
   * Fire the action on the card tap instead of filling the Context panel
   * first. Reserved for reversible navigation — back, leave, submenu — where
   * there is no detail worth reading and select-then-confirm is just friction.
   * Anything that spends, grants or destroys must never set this.
   */
  immediate?: boolean
  /**
   * Character offers render as the design's portrait chooser — the selected
   * one grows and takes a rail in its own colour. Without this the page falls
   * back to full-width rows.
   */
  portrait?: { art?: string; glyph?: string; color: string; badge?: IconKey }
  /** Up to three trait tiles shown under the body, per the hero-pick design. */
  tiles?: { caption: string; glyph?: string; art?: string; icon?: IconKey }[]
  /** Bold-value / muted-label pairs, e.g. "12 DEX". */
  stats?: { label: string; value: number | string }[]
}

/**
 * The Threat a choice charges, said out loud at the point it is charged (M5).
 *
 * `acceptShrine`, `acceptRecruit`, `recruitTeammate`, `chooseHeroMutation` and
 * `buyMerchantRecruit` all multiply the run's Threat by `THREAT_PER_CHOICE`
 * — every enemy in every later wave gets that much more HP — and no terms text
 * anywhere mentioned it. Declining, walking on, buying *items* and merely
 * AIMING a mutation (`aimHeroMutation` commits nothing) do not charge it.
 *
 * **There are two shapes of this, because there are two kinds of place it is
 * charged in, and one blanket string is now a lie in one of them.**
 *
 * On the MAP, `completeNode` charges `THREAT_PER_NODE.special` (×1.13) for
 * consuming a merchant / shrine / recruit node *at all*, decision or no
 * decision — so "Walking away costs nothing" stopped being true the moment that
 * rule landed. Walking away is still the cheaper of the two, which is the thing
 * the terms have to keep saying clearly; it is the ×1.05 you avoid, not the
 * visit. The two steps compose, so accepting is ×1.13 × 1.05.
 *
 * At the CROSSROADS there is no visit step at all — `finishCrossroads` only
 * changes the screen — so marching on really is free there, and that variant
 * keeps the original wording.
 *
 * In ENDLESS neither step exists: rooms go through `endlessOpenRoom`, which
 * touches `threat` nowhere, and `endlessShrineAccept` / `endlessRecruit` charge
 * no choice tax either. Every call site below stays guarded on the mode rather
 * than quoting a campaign number at an endless player.
 */
const VISIT_MULT = THREAT_PER_NODE.special
const ACCEPT_MULT = VISIT_MULT * THREAT_PER_CHOICE

/** Terms for a special node on the map, where the visit itself is already billed. */
export const THREAT_TAX_VISIT: string[] = [
  `Threat ×${ACCEPT_MULT.toFixed(2)} if you take it — ×${VISIT_MULT.toFixed(2)} for the stop itself, ×${THREAT_PER_CHOICE.toFixed(2)} more for the offer.`,
  `Walking away still pays the ×${VISIT_MULT.toFixed(2)}: reaching this node is what costs that, not the decision. Threat is the HP multiplier on every enemy in every wave that follows.`,
]

/** Terms at the Crossroads, which is not a map node — marching on is genuinely free. */
export const THREAT_TAX_FREE_EXIT: string[] = [
  `Threat ×${THREAT_PER_CHOICE.toFixed(2)} — taking this raises the HP of every enemy in every wave that follows. Marching on costs nothing.`,
]

/**
 * Sprite path for an archetype — the real Tiny Swords art, not a stand-in.
 *
 * Exported since P3. Hero-pick and the Crossroads chooser have drawn the real
 * portrait since the shell landed; the battle roster card two files away drew a
 * 30x30 coloured square with a 14px glyph in it, and the sprite it wanted was
 * resolvable from the same one-line function. The three cards you look at for
 * the whole of a battle were the least illustrated thing in the game.
 */
export const heroArt = (archetype: string) => `assets/sprites/tinyswords/${archetype}.png`
const ARCH_COLOR: Record<string, string> = {
  fighter: 'var(--fighter)',
  rogue: 'var(--rogue)',
  mystic: 'var(--mystic)',
}

/**
 * `✦` used to mean five different things at once - rogue, Watch Marks,
 * attribute rewards, perks and mutations, twice over on some screens
 * (DESIGN_SYSTEM §6 flags the overload). It means Watch Marks now, and only
 * that; the archetype set lives in `channels.ts`.
 */
const GLYPH = ARCHETYPE_GLYPH

/**
 * A keepsake occupies a body slot and buffs the WHOLE roster
 * (`teamKeepsakeMods` in combat.ts), which nothing in the shell said — so a
 * keepsake and a breastplate were indistinguishable at the point of purchase,
 * and the one item in the game whose value scales with roster size read as the
 * one with no armour on it (M6).
 */
export const KEEPSAKE_TAG = 'Keepsake — its effects apply to the whole watch, not just whoever carries it.'

/**
 * Everything an item's own text says about it — the ONE producer of it (M4).
 *
 * This used to be a private helper here that built `${e.label} — ${t}` for the
 * merchant, the Forge and the reward card, while `DetailBand`'s item panel
 * built the same string a second time and added a `curse` mark the copy here
 * did not. Same words, two builders, one of them better informed: the classic
 * shape of a divergent duplicate, and the divergence fell on the four cursed
 * enchantments in the game.
 *
 * `DetailBand` now renders THIS, so there is no second builder to fall behind.
 *
 * ---------------------------------------------------------------------------
 * The word, not just the mark
 * ---------------------------------------------------------------------------
 * The curse line reads `Curse · Reckless — +85% damage, −45% attack speed`.
 * Before this it read `Reckless — …` and the ONLY statement that Reckless is a
 * curse was a 16px sprite — which breaks the rule the whole icon layer is built
 * on (an icon is additive; it is never the only channel; every `<Icon>` is
 * `aria-hidden` precisely because the meaning is already in text nearby). A
 * player who cannot see the mark, or whose atlas failed to load, could read
 * `+85% damage` and buy it. `Curse ·` is the same vocabulary the shrine offers
 * already use for `Curse — …`, and it costs one word.
 */
export function itemBody(item: Item): Body {
  const out: Body = [...describeBase(item)]
  for (const e of item.enchantments) {
    const t = describeEnchant(e)
    if (!t) continue
    // `cx_` is the curse prefix in `items.ts`. Read off the id rather than off
    // a hardcoded list of labels here — a copy of that list is the same defect
    // one level down.
    const curse = e.id.startsWith('cx_')
    out.push({
      text: curse ? `Curse · ${e.label} — ${t}` : `${e.label} — ${t}`,
      mark: curse ? 'curse' : undefined,
      tone: 'accent',
    })
  }
  if (item.keepsake) out.push({ text: KEEPSAKE_TAG, tone: 'accent' })
  return out
}

/** Portrait + stat pairs for any Sentinel-shaped offer. */
function heroBits(s: Sentinel) {
  return {
    // Token, not `s.color`'s raw hex, so the colour-vision modes reach the
    // portrait rail as well as everything else (M34).
    portrait: { art: heroArt(s.archetype), color: archetypeVar(s.archetype) },
    stats: [
      { label: 'STR', value: s.stats.str },
      { label: 'DEX', value: s.stats.dex },
      { label: 'INT', value: s.stats.int },
    ],
  }
}

function heroBody(s: Sentinel): string[] {
  const p = computeCombat(s)
  return [
    `STR ${s.stats.str} · DEX ${s.stats.dex} · INT ${s.stats.int}`,
    `${Math.round(p.dps)} DPS · ${Math.round(p.range)} range`,
    `${Math.round(p.maxHp)} HP`,
  ]
}

/**
 * Every game-store field an Offer's *content* depends on (M21).
 *
 * `useOffers` used to call `useGameStore()` with no selector, which subscribes
 * the shell to every field of the store — including `hud`, which the battle
 * loop replaces ten times a second. So during a wave the whole offer set was
 * rebuilt 10× per second: three `computeCombat` passes per recruit, a
 * `describeBase`/`describeEnchant` pass per merchant item, fresh closures for
 * every action, and a new array identity handed to `SelectorBand` and
 * `DetailBand` each time — all to produce the empty list battle always returns.
 *
 * Listing the fields explicitly and comparing them shallowly means a HUD tick
 * changes nothing here. The rest of the state is read through `getState()` at
 * render time, which is safe precisely because a change to anything an offer
 * reads is a change to one of these.
 */
const offerDeps = (s: St) => ({
  screen: s.screen,
  runPhase: s.runPhase,
  mode: s.mode,
  event: s.event,
  endlessRoom: s.endlessRoom,
  crossroads: s.crossroads,
  reward: s.reward,
  merchant: s.merchant,
  shrineOffer: s.shrineOffer,
  recruitOptions: s.recruitOptions,
  endlessRecruitCost: s.endlessRecruitCost,
  roster: s.roster,
  inventory: s.inventory,
  gold: s.gold,
  dust: s.dust,
  round: s.round,
})

/** The offers for the current context, in Selector order. */
export function useOffers(metaView: MetaView, setMetaView: (v: MetaView) => void): Offer[] {
  useGameStore(useShallow(offerDeps))
  const st = useGameStore.getState()
  const meta = useMetaStore()
  // Subscribed, not read once: `settingsOffers` used to call
  // `useSettingsStore.getState()`, so flipping a toggle changed the store and
  // nothing else — "Mute" wrote `muted: true` while the row it sat on still
  // read "Sound / On". The settings page is the only home these toggles have.
  const settings = useSettingsStore()
  // Same context the renderer resolves, so "is this a page?" cannot drift
  // between the two. Battle and the run map keep their bands and their own
  // controls; they must not grow a stray escape row.
  const ctx = useShellContext()

  const offers = contextOffers(st, meta, settings, metaView, setMetaView)

  /*
   * No context may be a dead end.
   *
   * A page renders a CTA only for a selected offer's action, rows only for
   * choices, and nav rows only for immediate offers — so an empty list is a
   * title, a blurb and no control of any kind, with no back gesture and no
   * menu to reach. It is not hypothetical: a resumed snapshot whose shrine id
   * no longer exists rehydrates `shrineOffer: null` and strands the player
   * there, and a null merchant payload or an empty reward does the same. It
   * also used to be masked by `DetailBand`'s run-over fallback, which is gone.
   *
   * So the last thing that happens to any offer list is this: if nothing in it
   * can get you out, a way out is added.
   *
   * This covers pages only, and that used to be the whole claim — which was a
   * lie by omission, because `useShellContext` handed every screen it did not
   * recognise to the battle bands, and those draw the field's own controls
   * rather than offers. `screen: 'crossroads'` with a null `crossroads` payload
   * landed there: four bands, "Tap a Sentinel to see its detail", and not one
   * button that went anywhere. The other half of the guarantee therefore lives
   * outside this file: `context.ts` no longer lets an unrecognised screen fall
   * into the bands (it becomes a board page, and lands here), and
   * `DetailBand`'s battle panel always offers a way off a field that cannot be
   * fought. Between the three, every reachable shell state has a control that
   * gets the player somewhere.
   */
  const isOfferPage = ctx.layout === 'page' && ctx.stage !== 'result'
  if (isOfferPage && !offers.some(canExit)) return [...offers, escapeOffer(st)]
  return offers
}

/** True when tapping this offer eventually leads somewhere else. */
const canExit = (o: Offer): boolean => !!o.action && !o.action.disabled

function contextOffers(
  st: St,
  meta: Meta,
  settings: Settings,
  metaView: MetaView,
  setMetaView: (v: MetaView) => void,
): Offer[] {
  if (st.screen === 'hub') return metaOffers(metaView, meta, settings, setMetaView)
  // A finished run is a page of its own (ResultScreen) and takes no offers.
  if (st.runPhase !== 'active') return []
  if (st.screen === 'heroPick') return heroPickOffers(st, meta)
  if (st.screen === 'crossroads' && st.crossroads) return crossroadsOffers(st)
  if (st.screen === 'endless' && !st.endlessRoom) return roomOffers(st)
  if (st.reward) return rewardOffers(st)

  // In endless the room is authoritative; `event` belongs to the campaign map.
  const kind = st.mode === 'endless' ? st.endlessRoom : st.event?.kind
  if (kind === 'merchant') return merchantOffers(st)
  if (kind === 'shrine') return shrineOffers(st)
  if (kind === 'recruit') return recruitOffers(st)
  if (kind === 'forge') return forgeOffers(st)
  return []
}

/**
 * The way out of wherever you are, for the case where the context could not
 * supply one. Each branch uses the same store action the context's own "Leave"
 * row would have used, so the escape settles the node or closes the room
 * properly rather than teleporting out of it.
 */
function escapeOffer(st: St): Offer {
  const exit = (title: string, blurb: string, run: () => void): Offer => ({
    id: 'escape',
    title,
    icon: 'back',
    immediate: true,
    body: [blurb],
    action: { label: title, run },
  })

  if (inEndlessRoom(st)) return exit('Leave', 'Head back to the rooms.', () => st.endlessCloseRoom())
  if (st.reward) return exit('Walk on', 'There is nothing here to take.', () => st.continueAfterWave())
  if (st.screen === 'crossroads') return exit('March on', 'Leave the crossroads behind.', () => st.finishCrossroads())
  if (st.event) return exit('Walk on', 'Leave the offers and continue.', () => st.leaveEvent())
  // Nothing local left to close — the Watchtower is always reachable, and it
  // settles the run rather than dropping it.
  return exit('Back to the Watchtower', 'End the run and return.', () => st.returnToHub())
}

/**
 * Which set of store actions an offer should dispatch.
 *
 * `mode` is the only thing that decides this. `endlessRoom` used to stand in
 * for it, and it is not a mode flag — it is a *room*, and it survives leaving
 * endless. A stale one made a real campaign shrine dispatch
 * `endlessShrineAccept` (gold spent, node never cleared, threat tax never paid,
 * the event board still parked over the map) and gave a campaign recruit a ⟡100
 * price it then charged through `endlessRecruit`. Reading the mode means a
 * stale field can misprice nothing and misroute nothing; the room is only ever
 * asked *which* room, never *which game*.
 */
const inEndless = (st: St): boolean => st.mode === 'endless'
/** True only for an endless run that is standing inside a room. */
const inEndlessRoom = (st: St): boolean => inEndless(st) && !!st.endlessRoom

type St = ReturnType<typeof useGameStore.getState>
type Meta = ReturnType<typeof useMetaStore.getState>
type Settings = ReturnType<typeof useSettingsStore.getState>
export type MetaView = 'menu' | 'perks' | 'settings'

/**
 * ---------------------------------------------------------------------------
 * Hero pick, from the real tree (H11).
 * ---------------------------------------------------------------------------
 *
 * The tiles used to be hand-written literals and three of the nine advertised
 * mechanics that do not exist: "+4 dodge" (there is no dodge stat anywhere in
 * the engine), "+6 armour" against a real `physDefAdd` of 20, "+6 speed"
 * matching no stat at all, and all three mystic tiles ("Chain arc", "Chills",
 * "Ally buff") describing tier-1/tier-2 branch abilities a LEVEL-ONE mystic
 * does not have — `shock`, `chill` and `buffAura` first appear on Stormcaller,
 * Cryomancer and Cleric. The base stat block was duplicated as literals too,
 * so it could drift from `archetypeTree.ts` silently.
 *
 * Everything on the card now comes from the tier-0 node and from
 * `computeCombat` on a preview of the exact Sentinel `pickStartingHero` will
 * build, Watchtower stat perks included. If a number here is wrong, the tree is
 * wrong.
 */
const ARCH_LIST: Archetype[] = ['fighter', 'rogue', 'mystic']

/**
 * The Sentinel `pickStartingHero` is about to create, without creating it.
 *
 * Deliberately NOT `createSentinel`: that mutates the process-global name and
 * id counters, and this runs on every render of the hero-pick page — previewing
 * a hero would burn a name the hero then does not get. It mirrors the same
 * fields (`sentinels.ts` `createSentinel` + `gameStore` `applyStatBonus`).
 */
function previewHero(a: Archetype, statBonus: number): Sentinel {
  const node = getNode(a)
  const b = node.baseStats!
  return {
    id: `preview-${a}`,
    name: node.name,
    archetype: a,
    branchPath: [a],
    stats: { str: b.str + statBonus, dex: b.dex + statBonus, int: b.int + statBonus },
    thorns: node.baseThorns!,
    patience: node.basePatience!,
    level: 1,
    xp: 0,
    equipment: { mainHand: null, offHand: null, body: null },
    color: node.color!,
    accent: node.accent!,
  }
}

const pct = (v: number) => `${Math.round(v * 100)}%`

/**
 * Up to three trait tiles, each one a fact about the hero this card will
 * actually hand you.
 *
 * Read off the COMPUTED profile rather than the tier-0 literals, so a tile and
 * the body line under it can never disagree — the base rate is 2.1/s and a
 * 12-DEX rogue's real rate is 2.6/s, and printing one above the other is a
 * smaller version of the same defect this is fixing. The list is in priority
 * order and sliced to three, so an archetype whose kit changes in
 * `archetypeTree.ts` re-tiles itself instead of lying.
 */
function archetypeTiles(p: ReturnType<typeof computeCombat>): { caption: string; icon: IconKey }[] {
  /*
   * Eight tiles, eight glyphs, and five of the eight were on loan from
   * something else: `⛊` was also the off-hand item kind, `⛨` was also body
   * armour AND the Assist setting AND base integrity, `⚡` was also the Threat
   * multiplier, `❋` was also the mystic archetype, and `◎`/`◉` were a pair of
   * near-identical circles standing for two unrelated ideas. Every one of them
   * now has a picture of its own — including the last of them, the Assist
   * setting, which was still borrowing THIS row's `armour` helm until M8 and
   * now draws `assist`.
   */
  const out: { caption: string; icon: IconKey }[] = []
  if (p.mods.block) out.push({ caption: `Blocks ${p.mods.block.count}`, icon: 'block' })
  if (p.physDef) out.push({ caption: `${Math.round(p.physDef)} armour`, icon: 'armour' })
  if (p.critChance >= 0.15) out.push({ caption: `${pct(p.critChance)} crit`, icon: 'crit' })
  if (p.damageType === 'magic') out.push({ caption: 'Magic damage', icon: 'magic' })
  if (p.splashRadius > 0) out.push({ caption: `${Math.round(p.splashRadius)} splash`, icon: 'splash' })
  if (p.rate >= 1.5) out.push({ caption: `${p.rate.toFixed(1)}/s attacks`, icon: 'haste' })
  if (p.range >= 150) out.push({ caption: `${Math.round(p.range)} range`, icon: 'range' })
  if (p.thorns >= 5) out.push({ caption: `${Math.round(p.thorns)} thorns`, icon: 'thorns' })
  return out.slice(0, 3)
}

function heroPickOffers(st: St, meta: Meta): Offer[] {
  const statBonus = meta.bonuses().statBonus
  return ARCH_LIST.map((a) => {
    const node = getNode(a)
    const hero = previewHero(a, statBonus)
    const p = computeCombat(hero)
    return {
      id: `pick-${a}`,
      title: node.name,
      sub: 'Starting hero',
      color: ARCH_COLOR[a],
      glyph: GLYPH[a],
      portrait: { art: heroArt(a), color: ARCH_COLOR[a] },
      stats: [
        { label: 'STR', value: hero.stats.str },
        { label: 'DEX', value: hero.stats.dex },
        { label: 'INT', value: hero.stats.int },
      ],
      tiles: archetypeTiles(p),
      // Three lines, not five: the tiles under the CTA carry the headline
      // traits already, and every line here costs vertical room the Banner
      // picker below needs in order to be seen at all.
      body: [
        node.ability,
        `${Math.round(p.dps)} DPS · ${Math.round(p.range)} range · ${Math.round(p.maxHp)} HP · ${p.rate.toFixed(1)}/s`,
        `${p.damageType === 'magic' ? 'Magic' : 'Physical'} · ${pct(p.critChance)} crit ×${p.critMult.toFixed(1)} · ${Math.round(p.thorns)} thorns · ${Math.round(p.patience)} patience${statBonus ? ` · +${statBonus} all stats (Watchtower)` : ''}`,
      ],
      action: { label: `Choose ${node.name}`, run: () => st.pickStartingHero(a) },
    }
  })
}

function merchantOffers(st: St): Offer[] {
  const m = st.merchant
  if (!m) return []
  const out: Offer[] = m.items.map((e) => ({
    id: e.item.id,
    title: e.item.name,
    sub: RARITY[e.item.rarity].label,
    color: rarityVar(e.item.rarity),
    // The merchant board was four text rows. It is the one screen where "what
    // is that, and can my roster use it?" has to be answerable before you read
    // a word — so the shape and the damage type both ride on the row now.
    icon: itemIcon(e.item),
    mark: damageMark(e.item),
    bodyIcons: true,
    cost: { amount: e.price, currency: 'gold' as const },
    body: itemBody(e.item),
    action: {
      label: `Buy · ⟡${e.price}`,
      run: () => (inEndless(st) ? st.endlessBuyItem(e.item.id) : st.buyMerchantItem(e.item.id)),
      disabled: st.gold < e.price,
    },
  }))
  if (m.recruit) {
    const r = m.recruit
    out.push({
      id: r.sentinel.id,
      title: r.sentinel.name,
      sub: buildName(r.sentinel),
      color: archetypeVar(r.sentinel.archetype),
      glyph: GLYPH[r.sentinel.archetype],
      cost: { amount: r.price, currency: 'gold' },
      ...heroBits(r.sentinel),
      // A merchant hire is one of the five choices that pays the choice tax, and
      // the merchant is a map special, so the visit step is already on the bill.
      // (Endless merchants deal `recruit: null`, so this branch is campaign in
      // practice — guarded anyway rather than relying on that.)
      body: [...heroBody(r.sentinel), ...(inEndless(st) ? [] : THREAT_TAX_VISIT)],
      action: {
        label: `Recruit · ⟡${r.price}`,
        run: () => st.buyMerchantRecruit(),
        disabled: st.gold < r.price || st.roster.length >= MAX_ROSTER,
      },
    })
  }
  out.push(leaveOffer(st))
  return out
}

function shrineOffers(st: St): Offer[] {
  const s = st.shrineOffer
  if (!s) return []
  const accept = inEndless(st) ? () => st.endlessShrineAccept() : () => st.acceptShrine()
  return [
    {
      id: 'shrine',
      title: s.title,
      sub: 'Bargain',
      icon: 'shrine',
      // The third term the shrine never printed: accepting charges the choice
      // tax on top of the curse (M5) — and standing here at all charges the
      // ×1.13 visit, so walking away is cheaper rather than free. The endless
      // room charges neither step (`endlessShrineAccept` does not touch
      // `threat`), so the terms stay campaign-only or they become a new lie.
      body: [`Boon — ${s.boon}`, `Curse — ${s.curse}`, ...(inEndless(st) ? [] : THREAT_TAX_VISIT)],
      action: { label: 'Accept the terms', run: accept },
      secondary: inEndless(st)
        ? { label: 'Walk away', icon: 'back', run: () => st.endlessCloseRoom() }
        : { label: 'Walk away', icon: 'back', run: () => st.declineShrine() },
    },
  ]
}

function recruitOffers(st: St): Offer[] {
  const full = st.roster.length >= MAX_ROSTER
  const out: Offer[] = st.recruitOptions.map((s) => ({
    id: s.id,
    title: s.name,
    sub: buildName(s),
    color: archetypeVar(s.archetype),
    glyph: GLYPH[s.archetype],
    cost: inEndless(st) ? { amount: st.endlessRecruitCost, currency: 'gold' as const } : undefined,
    ...heroBits(s),
    body: [
      ...heroBody(s),
      ...(full ? ['Your roster is full — dismiss someone first.'] : []),
      // Campaign hires pay the choice tax (`acceptRecruit`) on top of the
      // recruit node's own visit step; endless rooms pay neither.
      ...(inEndless(st) || full ? [] : THREAT_TAX_VISIT),
    ],
    action: {
      // The tapped candidate's id goes to the store in both modes. Without it
      // endless hires `recruitOptions[0]` whatever you picked, which made the
      // whole screen a fake choice.
      label: full ? 'Roster full' : inEndless(st) ? `Recruit ${s.name} · ⟡${st.endlessRecruitCost}` : `Recruit ${s.name}`,
      run: () => (inEndless(st) ? st.endlessRecruit(s.id) : st.acceptRecruit(s.id)),
      disabled: full || (inEndless(st) ? st.gold < st.endlessRecruitCost : false),
    },
  }))
  out.push(
    inEndless(st)
      ? { id: 'leave', title: 'Leave', icon: 'back', immediate: true, body: ['Head back to the rooms.'], action: { label: 'Leave', run: () => st.endlessCloseRoom() } }
      : { id: 'skip', title: 'Walk on', icon: 'back', immediate: true, body: ['Turn the recruit away and march.'], action: { label: 'Walk on', run: () => st.skipRecruit() } },
  )
  return out
}

/**
 * The Forge sells two different things off one item at two different prices,
 * so both ride on the actions rather than on the Offer's single `cost` chip.
 * Both grey out when the dust is not there — the room used to show no price at
 * all and then silently do nothing when you tapped.
 */
function forgeOffers(st: St): Offer[] {
  const out: Offer[] = st.inventory.map((i) => ({
    id: i.id,
    title: i.name,
    sub: RARITY[i.rarity].label,
    color: rarityVar(i.rarity),
    icon: itemIcon(i),
    mark: damageMark(i),
    bodyIcons: true,
    cost: { amount: reforgeDust(i), currency: 'dust' as const },
    body: [
      ...itemBody(i),
      `Reforge ◈${reforgeDust(i)} — rerolls every enchantment on it.`,
      canUpgrade(i) ? `Raise rarity ◈${upgradeDust(i)} — one tier up, base kept.` : 'Already at the top rarity — it cannot be raised.',
      `You hold ◈${st.dust} dust.`,
    ],
    action: {
      label: `Reforge · ◈${reforgeDust(i)}`,
      run: () => st.endlessForgeReforge(i.id),
      disabled: st.dust < reforgeDust(i),
      cost: { amount: reforgeDust(i), currency: 'dust' as const },
    },
    secondary: canUpgrade(i)
      ? {
          label: 'Raise rarity',
          icon: 'evolve',
          run: () => st.endlessForgeUpgrade(i.id),
          disabled: st.dust < upgradeDust(i),
          cost: { amount: upgradeDust(i), currency: 'dust' as const },
        }
      : undefined,
  }))
  if (out.length === 0) {
    out.push({
      id: 'forge-empty',
      title: 'Nothing to work',
      sub: `◈ ${st.dust} dust`,
      icon: 'forge',
      body: ['The pack is empty. Find or buy an item, then bring it back here.', `You hold ◈${st.dust} dust.`],
    })
  }
  out.push({ id: 'leave', title: 'Leave', icon: 'back', immediate: true, body: ['Head back to the rooms.'], action: { label: 'Leave', run: () => st.endlessCloseRoom() } })
  return out
}

/**
 * A spoils card, with the two things the shell was dropping (M6 / M9).
 *
 * `RewardCard` carries a `rarity` of its own and, from Epic up, a real
 * `downside` — "−14% range for the team" is the number the engine applies, not
 * flavour. The card was coloured by `c.item?.rarity` only, so every attribute
 * card in the game rendered with no rail at all and a Legendary tradeoff card
 * looked exactly like a Common +2 STR. Both are on the card now, and the
 * downside leads the body so it cannot be missed under the fold.
 */
function rewardOffers(st: St): Offer[] {
  return (st.reward ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    sub: `${RARITY[c.rarity].label} · ${c.kind === 'item' ? 'Item' : 'Attribute'}`,
    color: rarityVar(c.rarity),
    icon: c.item ? itemIcon(c.item) : 'boon',
    mark: c.item ? damageMark(c.item) : null,
    bodyIcons: !!c.item,
    warn: c.downside ? `Downside — ${c.downside}` : undefined,
    body: (c.item
      ? [c.desc, ...itemBody(c.item)]
      : [
          c.desc,
          c.grant ? describeGrant(c.grant) : '',
          ...(c.grant?.mods ? describeMods(c.grant.mods) : []),
          // Team-wide mods merge with gear and branch mods, and the rule that
          // decides the winner was surfaced nowhere (H2).
          c.grant?.mods ? STACKING_RULE : '',
        ]
    ).filter(Boolean),
    action: { label: 'Take it', run: () => st.chooseReward(c.id) },
  }))
}

/**
 * ---------------------------------------------------------------------------
 * The Crossroads — recruit, or aim a mutation and then choose one (M8).
 * ---------------------------------------------------------------------------
 *
 * The store moved the randomness to BEFORE the decision and the shell did not
 * follow, which left the mutate branch dispatching into thin air: every
 * "Mutate <hero>" card called `rollHeroMutation`, which is now only a
 * deprecated alias for `aimHeroMutation` — it sets `mutationHeroId` and
 * returns. The shell rendered nothing off that field, so the tap did nothing a
 * player could see, on the one screen where the game hands out a permanent
 * Mythic.
 *
 * So the branch is two steps, exactly matching the two store actions:
 *
 *  1. `mutationHeroId === null` — recruits and the roster side by side.
 *     Choosing a hero AIMS: reversible, free, and it rolls nothing.
 *  2. `mutationHeroId !== null` — the three rolled options, each with its
 *     effect, its `downside` and the Threat tax it charges. Choosing one
 *     COMMITS, behind the armed confirm, because a mutation is permanent,
 *     one-of-each-key per hero, and has no reroll.
 *
 * The three were rolled once, at the fork, and live in `crossroads.mutations`;
 * nothing here may re-roll them, which is why step 1 dispatches
 * `aimHeroMutation` and never touches the offer.
 */
function crossroadsOffers(st: St): Offer[] {
  const cr = st.crossroads
  if (!cr) return []
  /*
   * `mutations` is coerced rather than trusted. It is a field that did not
   * exist a build ago, so it arrives `undefined` from a v-previous snapshot, a
   * half-applied migration, or a hand-set state — and `rev-misc` sets exactly
   * that shape (`{ recruits: [], revealed: null }`) to prove no context is a
   * dead end. Reading `.length` off it there would turn the dead-end probe into
   * a crash, which is a worse answer than the one it was testing for.
   */
  const mutations = Array.isArray(cr.mutations) ? cr.mutations : []

  if (cr.revealed) {
    const m = cr.revealed.mutation
    return [
      {
        id: 'revealed',
        title: m.name,
        sub: `${cr.revealed.heroName} · Mythic`,
        color: rarityVar('mythic'),
        icon: 'mutate',
        warn: m.downside ? `Downside — ${m.downside}` : undefined,
        body: [m.desc, ...describeMods(m.mods), STACKING_RULE],
        action: { label: 'March on', run: () => st.finishCrossroads() },
      },
    ]
  }

  // ---- step 2: a hero is aimed at, so the choice is which mutation ---------
  const aimed = cr.mutationHeroId ? st.roster.find((h) => h.id === cr.mutationHeroId) : undefined
  if (aimed) {
    const out: Offer[] = mutations.map((m) => {
      // The roll already excludes every key the company holds, so this is
      // belt-and-braces — but `chooseHeroMutation` refuses a duplicate key, and
      // the shell must never render an enabled action the store will refuse.
      const held = (aimed.mutations ?? []).some((x) => x.key === m.key)
      return {
        id: m.id,
        title: m.name,
        sub: 'Mythic',
        color: rarityVar('mythic'),
        icon: 'mutate',
        warn: m.downside ? `Downside — ${m.downside}` : undefined,
        /*
         * Kept deliberately short. The way OUT of this step — "Pick someone
         * else" — is a nav row *under* the detail card, and measured at 390×844
         * a seven-line card pushed it 140px below the fold: the one control
         * that un-commits the branch was the hardest thing on the screen to
         * find. Every line here earns its place twice over, and the stacking
         * rule (which lives on the hero panel and the spoils cards) is the one
         * that does not — a mutation is a single source.
         */
        body: [
          m.desc,
          // The engine's own read-out of the same mods, beside the authored
          // line — `mutations.ts` states that its `downside` is the number the
          // engine applies, and this is what lets a player check that.
          ...describeMods(m.mods),
          ...(m.grantUpgrade
            ? [`Also grants ${aimed.name} ${m.grantUpgrade.levels} free level of ${upgradePathName(m.grantUpgrade.path)}.`]
            : []),
          held
            ? `${aimed.name} already carries this one.`
            : `Permanent — ${aimed.name} keeps it for the rest of the run and there is no reroll. Threat ×${THREAT_PER_CHOICE.toFixed(2)} when it lands.`,
        ],
        action: {
          label: held ? 'Already carried' : `Give ${aimed.name} ${m.name}`,
          run: () => st.chooseHeroMutation(aimed.id, m.id),
          disabled: held,
          confirm: {
            label: `Yes — mutate ${aimed.name}`,
            note: `${m.name} is permanent — ${aimed.name} carries it for the rest of the run and there is no reroll.${m.downside ? ` It costs ${m.downside}.` : ''} Use the red "Yes — mutate ${aimed.name}" button below to go through with it; "Never mind" or another card leaves the choice open.`,
          },
        },
      }
    })
    // Aiming is reversible, so backing out of it has to be reversible too — and
    // it must not look like it forfeits the fork.
    out.push({
      id: 'unaim',
      title: 'Pick someone else',
      sub: `Aiming at ${aimed.name}`,
      icon: 'back',
      immediate: true,
      body: ['Back to the recruits and the roster. Nothing has been spent, and the same three mutations will be waiting.'],
      action: { label: 'Pick someone else', run: () => st.aimHeroMutation(null) },
    })
    return out
  }

  // ---- step 1: recruit, or aim ---------------------------------------------
  const out: Offer[] = cr.recruits.map((s) => ({
    id: s.id,
    title: s.name,
    sub: `Recruit · ${buildName(s)}`,
    color: archetypeVar(s.archetype),
    glyph: GLYPH[s.archetype],
    ...heroBits(s),
    // A stranger and one of your own are the same sprite in the same coloured
    // frame; the corner mark is what tells the two halves of this fork apart
    // before you tap one.
    portrait: { ...heroBits(s).portrait, badge: 'recruit' },
    // `recruitTeammate` charges the choice tax on the spot. The mutate branch
    // does NOT charge it here any more: `aimHeroMutation` commits nothing, and
    // the tax is paid by `chooseHeroMutation` one step later (M5).
    //
    // The FREE_EXIT variant, not the VISIT one: the Crossroads is a screen, not
    // a map node — `finishCrossroads` only changes `screen` and charges no
    // visit step — so marching on here really does cost nothing.
    body: [...heroBody(s), ...THREAT_TAX_FREE_EXIT],
    action: { label: 'Take the recruit', run: () => st.recruitTeammate(s.id) },
  }))
  for (const h of st.roster) {
    const carried = h.mutations ?? []
    out.push({
      id: `mutate-${h.id}`,
      title: h.name,
      sub: 'Mutate',
      color: archetypeVar(h.archetype),
      icon: 'mutate',
      ...heroBits(h),
      portrait: { ...heroBits(h).portrait, badge: 'mutate' },
      body: [
        `Change how ${h.name} attacks, permanently.`,
        `${mutations.length} Mythic mutations are on the table — you read all ${mutations.length} and take one. They were dealt when the fork fired, so aiming at a different hero does not change them.`,
        ...carried.map((m) => `Already carries ${m.name} — ${m.desc}`),
        'Aiming costs nothing and can be undone.',
      ],
      action: { label: `Aim at ${h.name}`, run: () => st.aimHeroMutation(h.id) },
    })
  }
  return out
}

/** The upgrade path a mutation grants a free level of, by its player-facing name. */
const upgradePathName = (id: string): string => UPGRADE_PATHS.find((p) => p.id === id)?.name ?? id

function roomOffers(st: St): Offer[] {
  const rooms = [
    { id: 'merchant', title: 'Merchant', icon: 'merchant', body: ['Four items for gold.'] },
    { id: 'forge', title: 'Forge', icon: 'forge', body: ['Spend dust to reforge or raise rarity.'] },
    { id: 'shrine', title: 'Shrine', icon: 'shrine', body: ['A bargain with terms.'] },
    { id: 'recruit', title: 'Recruit', icon: 'recruit', body: ['Add a Sentinel to the watch.'] },
  ] as const
  const out: Offer[] = rooms.map((r) => ({
    id: r.id,
    title: r.title,
    sub: 'Room',
    icon: r.icon,
    body: [...r.body],
    action: { label: `Enter the ${r.title.toLowerCase()}`, run: () => st.endlessOpenRoom(r.id) },
  }))
  out.push({
    id: 'wave',
    title: `Wave ${st.round}`,
    sub: 'Fight',
    icon: 'wave',
    color: 'var(--accent)',
    body: ['Take the next wave. Rooms stay open between waves.'],
    action: { label: 'Begin the wave', run: () => st.endlessBeginWave() },
  })
  return out
}

function leaveOffer(st: St): Offer {
  return inEndless(st)
    ? { id: 'leave', title: 'Leave', icon: 'back', immediate: true, body: ['Head back to the rooms.'], action: { label: 'Leave', run: () => st.endlessCloseRoom() } }
    : { id: 'leave', title: 'March on', icon: 'back', immediate: true, body: ['Leave the offers and continue.'], action: { label: 'March on', run: () => st.leaveEvent() } }
}

/**
 * Each setting is an offer whose action flips it — same one interaction.
 *
 * `s` is passed in from `useOffers`, which subscribes to the settings store.
 * Reading `getState()` here instead meant the rows never re-rendered: tapping
 * "Mute" muted the game while the row above it still read "Sound / On" and the
 * button still said "Mute", so the page reported the opposite of the truth.
 */
const VISION_LABEL: Record<VisionMode, string> = {
  default: 'Standard',
  deuter: 'Deuteranopia',
  protan: 'Protanopia',
  tritan: 'Tritanopia',
}
/*
 * Both dials cycle rather than branching into a sub-page, because the settings
 * page is a list of Offers and an Offer has one action. Cycling keeps the "one
 * interaction" rule and keeps the current value readable in the row's own sub.
 */
const VISION_CYCLE: VisionMode[] = ['default', 'deuter', 'protan', 'tritan']
const nextVision = (v: VisionMode): VisionMode =>
  VISION_CYCLE[(VISION_CYCLE.indexOf(v) + 1) % VISION_CYCLE.length]
const ASSIST_CYCLE: AssistLevel[] = ['off', 'steady', 'sure']
const nextAssist = (v: AssistLevel): AssistLevel =>
  ASSIST_CYCLE[(ASSIST_CYCLE.indexOf(v) + 1) % ASSIST_CYCLE.length]

function settingsOffers(s: Settings): Offer[] {
  const onOff = (v: boolean) => (v ? 'On' : 'Off')
  return [
    {
      id: 'mute',
      title: 'Sound',
      sub: onOff(!s.audio.muted),
      icon: s.audio.muted ? 'soundOff' : 'soundOn',
      /*
       * This row used to promise "music and effects" while the game had no
       * music at all — dead copy about a feature that did not exist. There is a
       * score now (`src/audio/music.ts`), so the sentence is true; the second
       * line says what the two rows do differently, because "Sound off" and
       * "Music off" are not the same request.
       */
      body: [
        'Silences everything: the score, combat and the interface.',
        'To keep the combat feedback and drop only the score, leave this on and turn Music off instead.',
      ],
      action: { label: s.audio.muted ? 'Unmute' : 'Mute', run: () => s.toggleMute() },
    },
    {
      id: 'music',
      title: 'Music',
      sub: onOff(s.audio.music > 0),
      glyph: '♪',
      body: [
        'The score. It follows the game: the Watchtower and the map stay quiet, a live wave gets the drums.',
        'Sound effects carry information here — what hit, what died, what got through — and the music carries none, so it is the half you can drop.',
        'Off stops it being performed at all rather than turning it down, so it costs nothing while it is off.',
      ],
      action: { label: s.audio.music > 0 ? 'Turn off' : 'Turn on', run: () => s.toggleMusic() },
    },
    {
      id: 'motion',
      title: 'Reduced motion',
      sub: onOff(s.reducedMotion),
      glyph: '≈',
      body: ['Cuts animation and screen shake.'],
      action: { label: s.reducedMotion ? 'Turn off' : 'Turn on', run: () => s.setReducedMotion(!s.reducedMotion) },
    },
    {
      id: 'contrast',
      title: 'High contrast',
      sub: onOff(s.highContrast),
      glyph: '◐',
      body: ['Stronger borders and text contrast throughout.'],
      action: { label: s.highContrast ? 'Turn off' : 'Turn on', run: () => s.setHighContrast(!s.highContrast) },
    },
    {
      id: 'scale',
      title: 'Large UI',
      sub: onOff(s.uiScale === 'large'),
      glyph: '⤢',
      body: [
        'Grows every label, tag and price by about 15%, and lifts the touch floor from 44px to 48px.',
        'It used to promise "bigger type" and move one button. It moves the whole type ramp now.',
      ],
      action: {
        label: s.uiScale === 'large' ? 'Normal size' : 'Make it large',
        run: () => s.setUiScale(s.uiScale === 'large' ? 'normal' : 'large'),
      },
    },
    {
      id: 'vision',
      title: 'Colour vision',
      sub: VISION_LABEL[s.vision],
      glyph: '◔',
      body: [
        'Re-tints the rarity ramp, the three archetype hues and the good/bad pair for the common colour-vision differences.',
        'Rarity also carries a letter and a pip count, and every hero carries its archetype mark — so colour is never the only signal either way.',
        `Now: ${VISION_LABEL[s.vision]}.`,
      ],
      action: {
        label: `Switch to ${VISION_LABEL[nextVision(s.vision)]}`,
        run: () => s.setVision(nextVision(s.vision)),
      },
    },
    {
      id: 'assist',
      title: 'Assist',
      sub: assistProfile(s.assist).label,
      /*
       * `armour` before, and that was the last survivor of the original eleven
       * collisions (M8). `⛨` used to mean body armour AND the armour stat AND
       * the Assist setting AND base integrity; P3 gave three of those four a
       * sprite of their own and left this one pointing at the armour stat's
       * helm. So the Settings row for the game's difficulty handicap was drawn
       * as a defence STATISTIC — the same picture the hero panel puts beside
       * "38 armour" two taps away. `assist` is an open hand: help offered, not
       * a number.
       */
      icon: 'assist',
      body: [
        /*
         * Framing, deliberately (M34). No "easy mode", no warning, no asterisk
         * on what you earn — the Hades reading of this is that the option is
         * there for whoever wants it, on whatever day they want it, and the
         * game does not editorialise about taking it. What it does say plainly
         * is exactly what changes, so the choice is informed rather than a
         * mystery dial.
         */
        'Softens what the horde takes off your base when something reaches the line.',
        assistProfile(s.assist).blurb,
        'Nothing else moves: same waves, same loot, same Watch Marks. Change it whenever you like, mid-run included.',
      ],
      action: {
        label: `Set to ${assistProfile(nextAssist(s.assist)).label}`,
        run: () => s.setAssist(nextAssist(s.assist)),
      },
    },
    {
      id: 'tips',
      title: 'Tips',
      sub: Object.values(s.taught).some(Boolean) ? 'Some seen' : 'All waiting',
      glyph: '❓',
      body: [
        'The one-line hints that appear the first time something new matters — deploying, equipping, Threat, evolutions.',
        'Bring them back for another pass, or for whoever picks the game up on this device next.',
      ],
      action: { label: 'Show the tips again', run: () => s.resetTeaching() },
    },
    {
      id: 'reset',
      title: 'Reset progress',
      sub: 'Destructive',
      icon: 'warn',
      color: 'var(--bad-text)',
      body: [
        'Wipes Watch Marks, perks, Banner unlocks and records.',
        'This cannot be undone. Nothing is kept and nothing is backed up.',
      ],
      action: {
        label: 'Erase everything',
        run: () => useMetaStore.getState().resetMeta(),
        // `confirm.label` is the label of the *separate* control that appears
        // when this one arms — not of this one. See `useArmedAction`.
        confirm: {
          label: 'Yes — erase it all',
          note: 'Everything you have earned will be gone. Use the red "Yes — erase it all" button below to go through with it; "Never mind" or another row keeps it.',
        },
      },
    },
  ]
}

/**
 * The Banner ladder's unlock row — what Dark Sacrifice became (H16 / M29).
 *
 * The copy that shipped here described the system it replaced, word for word:
 * "Permanent and irreversible… +1 to all starting stats, +10% Watch Marks —
 * and +15% enemy HP in every future run… There is no way back down a tier."
 * Not one clause of that is true any more. `metaStore` kept the old API names
 * (`sacrificeTier`, `sacrificeCost`, `doSacrifice`) so every save migrates, but
 * the number now means "highest Banner UNLOCKED", unlocking applies nothing to
 * anything, and `bonuses().enemyHpMult` is hard-wired to 1.
 *
 * So this row buys a *rung*, and the rung is flown — or not — per run, at
 * hero-pick, by {@link BannerPicker}. The confirm stays: it is still an
 * irreversible spend of a few hundred Watch Marks.
 */
export const BANNER_BLURB =
  'A Banner is a bet you place at the start of a run: it takes a rule away and pays more Watch Marks for the finish. It applies to that run only, and you pick it fresh every time.'

/** "Banner 3 — Elite Watch" and what it does to the run, from the real rung data. */
export const bannerLine = (tier: number): string =>
  tier <= 0 || tier > MAX_BANNER
    ? 'No Banner — the ordinary march.'
    : `Banner ${tier} · ${BANNER_RUNGS[tier - 1].name} — ${BANNER_RUNGS[tier - 1].rule}`

function sacrificeOffer(meta: Meta): Offer {
  const tier = meta.sacrificeTier
  const cost = meta.sacrificeCost()
  const afford = meta.watchMarks >= cost
  const maxed = tier >= MAX_BANNER
  const next = maxed ? null : BANNER_RUNGS[tier]

  if (maxed) {
    return {
      id: 'sacrifice',
      title: 'Banners',
      sub: `${MAX_BANNER}/${MAX_BANNER} unlocked`,
      icon: 'banner',
      color: 'var(--accent)',
      body: [
        'Every rung is open. Choose one at the start of a run.',
        BANNER_BLURB,
        ...BANNER_RUNGS.map((r) => `Banner ${r.tier} · ${r.name} — ${r.rule} Pays ×${r.markMult}.`),
      ],
    }
  }

  return {
    id: 'sacrifice',
    title: `Banner ${next!.tier} · ${next!.name}`,
    sub: `${tier}/${MAX_BANNER} unlocked`,
    icon: 'banner',
    color: 'var(--accent)',
    cost: { amount: cost, currency: 'marks' as const },
    body: [
      `Unlock Banner ${next!.tier} — ${next!.name} — for ✦${cost}.`,
      next!.rule,
      `A run flown under it pays ×${next!.markMult} Watch Marks. Banners are cumulative: flying ${next!.tier} means flying every rung below it too.`,
      BANNER_BLURB,
      tier > 0
        ? `Already open: ${BANNER_RUNGS.slice(0, tier).map((r) => `${r.tier} ${r.name}`).join(' · ')}. Unlocking changes nothing on its own — no run gets harder until you choose to fly one.`
        : 'Nothing is unlocked yet, so every run is the ordinary march. Unlocking changes nothing on its own — no run gets harder until you choose to fly one.',
    ],
    action: {
      label: afford ? `Unlock · ✦${cost}` : `Need ✦${cost}`,
      run: () => meta.doSacrifice(),
      disabled: !afford,
      confirm: {
        label: `Yes — spend ✦${cost}`,
        note: `✦${cost} is spent for good — Watch Marks do not come back. It does not make any run harder by itself; it adds Banner ${next!.tier} to the rungs you may choose at the start of a run. Use the red "Yes — spend ✦${cost}" button below to go through with it; "Never mind" or another row keeps the marks.`,
      },
    },
  }
}

function metaOffers(view: MetaView, meta: Meta, settings: Settings, setView: (v: MetaView) => void): Offer[] {
  const game = useGameStore.getState()
  // Going back is a choice like any other, so it rides in the Selector rather
  // than as a floating button over the Stage.
  const back: Offer = {
    id: 'back',
    title: 'Back',
    sub: 'Watchtower',
    icon: 'back',
    immediate: true,
    body: ['Back to the Watchtower menu.'],
    action: { label: 'Back', run: () => setView('menu') },
  }
  if (view === 'settings') return [back, ...settingsOffers(settings)]
  if (view === 'perks') {
    return [back, ...UPGRADES.map((u): Offer => {
      const level = meta.upgrades[u.id] ?? 0
      const maxed = level >= u.maxLevel
      const cost = meta.upgradeCost(u.id)
      return {
        id: u.id,
        title: u.name,
        sub: `${level}/${u.maxLevel}`,
        icon: 'boon',
        cost: maxed ? undefined : { amount: cost, currency: 'marks' as const },
        body: [u.desc, maxed ? 'Fully upgraded.' : `Next level costs ✦${cost}.`],
        action: {
          label: maxed ? 'Maxed' : `Buy · ✦${cost}`,
          run: () => meta.buyUpgrade(u.id),
          disabled: maxed || meta.watchMarks < cost,
        },
      }
    }), sacrificeOffer(meta)]
  }
  return [
    {
      id: 'run',
      title: 'Start a Run',
      sub: 'Campaign',
      /*
       * `wave` before (M8). One pennant was carrying four unrelated meanings —
       * the incoming wave, the wave-clear beat, "post a Sentinel on a slot" and
       * this — and the Hub's primary action is the least wave-like of them: a
       * run is not a wave, it is a walk from node to node down a fresh map.
       * `depth` is that map's own marker, and it was a dead cell until now.
       */
      icon: 'depth',
      color: 'var(--accent)',
      body: ['A fresh map, a fresh roster. Permadeath — one loss ends it.'],
      action: { label: 'Begin', run: () => game.newRun() },
    },
    {
      id: 'perks',
      title: 'Upgrade Perks',
      sub: `✦ ${meta.watchMarks}`,
      icon: 'marks',
      immediate: true,
      body: ['Spend Watch Marks on permanent bonuses that carry between runs.'],
      action: { label: 'Open', run: () => setView('perks') },
    },
    {
      id: 'endless',
      title: 'Endless Watch',
      sub: 'Survival',
      glyph: '∞',
      color: 'var(--teal)',
      body: ['Three lives, escalating waves, rooms between each one.'],
      action: { label: 'Begin', run: () => game.startEndless() },
    },
    {
      id: 'settings',
      title: 'Settings',
      sub: 'Options',
      icon: 'settings',
      immediate: true,
      body: ['Audio, motion, contrast, scale, colour vision, assist and the first-run tips.'],
      action: { label: 'Open', run: () => setView('settings') },
    },
  ]
}
