import { canUpgrade, describeBase, itemNoun, RARITY, reforgeDust, upgradeDust } from '../../game/data/items'
import { describeEnchant, describeGrant, describeMods, STACKING_RULES } from '../../game/data/describe'
import { skillById, skillLevelLabel } from '../../game/data/skills'
import { heroChoices, previewOf } from '../../game/run/heroes'
import { heroDoes, kitName, lookOf } from '../../game/data/gear'
import { difficultyEffect, difficultyRules, MAX_DIFFICULTY, watchLevelFor } from '../../game/run/watch'
import { mutationName } from '../../game/data/mutations'
import { computeCombat } from '../../game/engine/combat'
import { MAX_ROSTER, runUnlocked, useGameStore } from '../../state/gameStore'
import { useMetaStore, UPGRADES } from '../../state/metaStore'
import { assistProfile, useSettingsStore, type AssistLevel, type VisionMode } from '../../state/settingsStore'
import { dailySeed, utcDateKey } from '../../state/daily'
import { menuStaged } from '../../state/staging'
import { useShallow } from 'zustand/react/shallow'
import { archetypeVar, ARCHETYPE_GLYPH, damageMark, handLine, itemIcon, itemName, moneyText, PERK_ICON, rarityVar, type IconKey } from '../channels'
import { useShellContext } from './context'
import { campfireOffers, merchantServiceOffers } from './campfireOffers'
import { relicLines } from './relicOffers'
import { codexOffers } from './codexOffers'
import { ACHIEVEMENTS } from '../../game/data/achievements'
import type { Item, ItemRarity, Sentinel } from '../../game/types'

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
  tone?: 'accent' | 'muted'
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
  /**
   * A purchase's receipt, shown briefly once it goes through ("Focus of
   * Insight added to your pack"). Setting it also tells the page to CLEAR its
   * selection afterwards, so the CTA under the thumb cannot fall through to the
   * next offer in the list and buy it on a second tap (Wave 1).
   */
  done?: string
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
  /** Reference text behind an ⓘ under the detail (Phase 2) — never a body line. */
  info?: { label: string; lines: readonly string[] }
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
  /**
   * A purchase the purse cannot cover right now (Wave 1). The row DIMS rather
   * than disabling — it still has to be tappable, because reading what a thing
   * does is how you decide to save up for it. The CTA is the part that refuses.
   */
  dim?: boolean
  /** Level pips for a levelled purchase (a Watchtower perk): `on` of `of`. */
  pips?: { on: number; of: number }
  /**
   * SK1: a grid of small cards under the body — the Codex's skill library.
   * A `locked` card is drawn as a silhouette: no name, no sentence, only how
   * it opens.
   */
  cards?: { id: string; name: string; sub: string; text: string; locked?: boolean; group?: string }[]
  /**
   * The Collection's tabs (Skills | Items): each a set of `cards`, drawn with
   * a tab bar over the grid (`CollectionTabs`).
   */
  tabs?: { id: string; label: string; count: string; cards: NonNullable<Offer['cards']> }[]
  /** SK1: the one skill a hero on offer arrives with, as a card under its name (the hero pick). */
  skill?: { name: string; level: string; text: string }
  /**
   * The classless rework: a hero drawn as a full comparison card (the hero
   * pick, a recruit slate) — what its gear makes it do, the gear, its skill.
   * When every choice on a page carries one, the page draws `HeroCards`.
   */
  hero?: HeroCardSpec
  /**
   * LS3: a menu entry the player has not opened yet — the one plain line that
   * says what opens it. The menu draws the row dimmed and inert, with this
   * line under its name.
   */
  locked?: string
  /** A real sprite for a row that is a hero (the merchant's recruit). */
  rowArt?: string
  /**
   * LS3: one plain line under a row's name (the first-run hero pick's role
   * line). The row grows to hold it and its sprite draws framed, at 48px.
   */
  note?: string
  /** The item or card rarity, drawn as a `RarityTag` (word + hue + pips). */
  rarity?: import('../../game/types').ItemRarity
  /**
   * Volume dials drawn in the detail block (the Sound row). A dial is not an
   * Offer action — dragging it is not a commit — so it rides here instead.
   */
  sliders?: { id: string; label: string; value: number; set: (v: number) => void; preview?: 'click' | 'coin' | 'toggle' }[]
}

/** One hero card (`HeroCards.tsx`). Every field is derived from the hero itself. */
export interface HeroCardSpec {
  /** The sprite its weapon picks (`gear.lookOf`). */
  art: string
  /** The look's hue token, for the card's rail. */
  color: string
  /** What its gear makes it do, in plain words (`gear.heroDoes`). */
  does: string
  gear: { id: string; name: string; rarity: ItemRarity; icon: IconKey }[]
  skill?: { name: string; level: string; text: string }
  /** "49 DPS · 96 reach" — held back on a staged first run. */
  numbers?: string
}

/**
 * What a choice costs in Threat, said at the point of choosing — which is now
 * nothing (Phase 3b).
 *
 * Accepting a hire, a pact or a mutation used to multiply the run's Threat by
 * `THREAT_PER_CHOICE` (×1.05), and consuming a merchant / shrine / recruit stop
 * charged a ×1.13 visit step on top, so these terms read "Threat ×1.19 if you
 * take it". The review's verdict was that Threat punished getting stronger.
 * Threat now follows the road alone (`run/threat.ts`): every stop moves the
 * company one layer on, and the next fight is at that layer's Threat whatever
 * was taken. The terms say so, because the old wording is still in players'
 * heads and "take it or leave it, it costs the same" is the new rule.
 *
 * Endless has its own round-by-round Threat and never charged either step, so
 * every call site stays guarded on the mode.
 */
export const THREAT_FREE_CHOICE: string[] = [
  'Enemies get no stronger for taking it. Enemy strength rises with every stop you pass, whatever you take there.',
]

/** At the Crossroads — not a map stop, so nothing about the road moves. */
export const THREAT_FREE_FORK: string[] = ['Enemies get no stronger for taking it: the Crossroads is not a stop on the road.']

/**
 * LS3: the enemy-strength note rides on a choice only once the player has met
 * enemy strength — a first run's layer-1 recruit must not explain a number the
 * header has not shown yet. Endless has no road and never carries it.
 */
function strengthNote(st: St, lines: string[]): string[] {
  if (st.mode === 'endless') return []
  const met = !st.firstRun || useSettingsStore.getState().showEverything || st.threat > 1.001 || useMetaStore.getState().met.includes('strength')
  return met ? lines : []
}

/**
 * Sprite path for an archetype — the real Tiny Swords art, not a stand-in.
 *
 * Exported since P3. Hero-pick and the Crossroads chooser have drawn the real
 * portrait since the shell landed; the battle roster card two files away drew a
 * 30x30 coloured square with a 14px glyph in it, and the sprite it wanted was
 * resolvable from the same one-line function. The three cards you look at for
 * the whole of a battle were the least illustrated thing in the game.
 */
export const heroArt = (look: string) => `assets/sprites/tinyswords/${look}.png`
/** A hero's sprite and hue: picked by what it holds (there is no class). */
export const heroLookArt = (h: Pick<Sentinel, 'equipment'>): string => heroArt(lookOf(h))
export const heroLookVar = (h: Pick<Sentinel, 'equipment'>): string => archetypeVar(lookOf(h))

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
export const KEEPSAKE_TAG = 'Keepsake — its effects apply to all your heroes, not just whoever carries it.'

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
  // Which hand it fits (round 3, Q5) — every item surface says so, and says
  // what a knife or wand is worth from the off hand.
  const hand = item.keepsake ? null : handLine(item)
  if (hand) out.push({ text: hand, mark: 'equip', tone: 'muted' })
  return out
}

/** Portrait + stat pairs for any Sentinel-shaped offer. */
/** LS3: whether the live run is a staged first run. */
const stagedRun = (): boolean => useGameStore.getState().firstRun && !useSettingsStore.getState().showEverything

function heroBits(s: Sentinel) {
  return {
    // Token, not `s.color`'s raw hex, so the colour-vision modes reach the
    // portrait rail as well as everything else (M34).
    portrait: { art: heroLookArt(s), color: heroLookVar(s) },
    // SK1: a hire arrives with one skill — shown as its card, the way the hero
    // pick shows the leader's (a hero with more lists them in the body).
    skill: oneSkill(s),
    // LS3: a first run reads a hero by what it does, as on the first pick; the
    // stat block is one tap away on the hero's Stats tab.
    stats: stagedRun()
      ? undefined
      : [
          { label: 'STR', value: s.stats.str },
          { label: 'DEX', value: s.stats.dex },
          { label: 'INT', value: s.stats.int },
        ],
  }
}

/**
 * A hero offer's body. The STR/DEX/INT line is gone from here: every hero offer
 * also carries `heroBits(s).stats`, which the page renders as the stat row right
 * above this card, so the same three numbers were printed twice, one above the
 * other (Wave 1).
 */
function heroBody(s: Sentinel): string[] {
  const p = computeCombat(s)
  const line = `${Math.round(p.dps)} DPS · ${Math.round(p.range)} range · ${p.rate.toFixed(1)}/s`
  // SK1: every hire arrives with a skill. One is shown as its card
  // (`heroBits`); more are listed here, each in its one sentence.
  const skills = oneSkill(s) ? [] : skillLines(s)
  // LS3: with the stat row held back, the sentence that says what the hero
  // does leads — the same one the first pick shows.
  return stagedRun() ? [`${heroDoes(s)}.`, ...skills, line] : [`${heroDoes(s)}.`, ...skills, line]
}

/** A hero as a comparison card: what its gear does, the gear, its skill (and its numbers, after the first run). */
export function heroCard(s: Sentinel, staged: boolean): HeroCardSpec {
  const p = computeCombat(s)
  const k = s.skills?.length ? skillById(s.skills[0]) : undefined
  const gear = [s.equipment.mainHand, s.equipment.offHand, s.equipment.body]
    .filter((i): i is Item => !!i)
    // The kind, not the generated name: "Wand", not "Swift Wand of Precision" —
    // the kind is what decides what the hero does, and three cards side by side
    // must read in one glance. The full name is on the gear panel once picked.
    .map((i) => ({ id: i.id, name: itemNoun(i) ?? itemName(i), rarity: i.rarity, icon: itemIcon(i) }))
  return {
    art: heroLookArt(s),
    color: heroLookVar(s),
    does: heroDoes(s),
    gear,
    skill: k ? { name: k.name, level: skillLevelLabel(k.level), text: k.desc } : undefined,
    numbers: staged ? undefined : `${Math.round(p.dps)} DPS · ${Math.round(p.range)} reach`,
  }
}

/** The card for a hero holding exactly one skill (a hire, a fresh pick). */
function oneSkill(s: Pick<Sentinel, 'skills'>): Offer['skill'] {
  const k = s.skills?.length === 1 ? skillById(s.skills[0]) : undefined
  return k ? { name: k.name, level: skillLevelLabel(k.level), text: k.desc } : undefined
}

/** "Skill · Quick Hands — Attacks 15% faster." for every skill a hero holds. */
export function skillLines(s: Pick<Sentinel, 'skills'>): string[] {
  return (s.skills ?? []).map((id) => skillById(id)).filter((k) => !!k).map((k) => `Skill · ${k.name} — ${k.desc}`)
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
  // LS3: a staged first run words hero offers and choices differently.
  firstRun: s.firstRun,
  threat: s.threat,
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
  if (kind === 'campfire') return campfireOffers(st, runUnlocked('fieldKitchen'))
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
export type MetaView = 'menu' | 'perks' | 'settings' | 'codex'

/**
 * ---------------------------------------------------------------------------
 * The hero pick: three random heroes (the classless rework)
 * ---------------------------------------------------------------------------
 *
 * The designer: "we dont have a set class, its just 3 options with items and
 * skills you have unlocked applied randomly". Each of the three is rolled from
 * the run's unlocked item kinds and skill pool (`run/heroes.heroChoices`, a
 * hash of the run seed — the same seed or Daily deals the same three), and
 * each is shown as what it IS: what its gear makes it do, the gear, the skill.
 * Every word and number is derived from the exact hero `pickStartingHero`
 * will create (`previewOf` mints nothing), Watchtower stat perks included.
 *
 * A first run (LS3) is dealt the same way from the basic five kinds, and its
 * cards hold the plain words only — no DPS, no stats.
 */
function heroPickOffers(st: St, meta: Meta): Offer[] {
  const statBonus = st.challenge.kind === 'daily' ? 0 : meta.bonuses().statBonus
  const staged = st.firstRun && !useSettingsStore.getState().showEverything
  const picks: Offer[] = heroChoices(st.runSeed, st.skillPool, st.itemPool).map((c) => {
    const hero = previewOf(c, statBonus)
    return {
      id: c.id,
      title: c.name,
      sub: kitName(hero),
      color: heroLookVar(hero),
      hero: heroCard(hero, staged),
      body: [],
      action: { label: `Choose ${c.name}`, run: () => st.pickStartingHero(c.id) },
    }
  })
  // The way back to the menu: nothing is spent until a hero is chosen, the
  // Daily's attempt included. `immediate`, so it sits as a row above the CTA.
  const back: Offer = { id: 'back', title: 'Back', icon: 'back', immediate: true, body: ['Back to the menu.'], action: { label: 'Back', run: () => st.cancelHeroPick() } }
  return [...picks, back]
}

function merchantOffers(st: St): Offer[] {
  const m = st.merchant
  if (!m) return []
  const out: Offer[] = m.items.map((e) => ({
    id: e.item.id,
    title: itemName(e.item),
    sub: RARITY[e.item.rarity].label,
    rarity: e.item.rarity,
    color: rarityVar(e.item.rarity),
    // The merchant board was four text rows. It is the one screen where "what
    // is that, and can my roster use it?" has to be answerable before you read
    // a word — so the shape and the damage type both ride on the row now.
    icon: itemIcon(e.item),
    mark: damageMark(e.item),
    bodyIcons: true,
    cost: { amount: e.price, currency: 'gold' as const },
    dim: st.gold < e.price,
    body: itemBody(e.item),
    action: {
      label: 'Buy',
      cost: { amount: e.price, currency: 'gold' as const },
      done: `${itemName(e.item)} added to your pack`,
      run: () => (inEndless(st) ? st.endlessBuyItem(e.item.id) : st.buyMerchantItem(e.item.id)),
      disabled: st.gold < e.price,
    },
  }))
  if (m.recruit) {
    const r = m.recruit
    out.push({
      id: r.sentinel.id,
      // What they carry rides in the row's own label: a merchant row is a line
      // of text, and "Sable" alone did not say this was a hero for hire, let
      // alone what kind (Wave 1). There is no class: the kit is the kind.
      title: `${r.sentinel.name} · ${kitName(r.sentinel)} for hire`,
      sub: kitName(r.sentinel),
      rowArt: heroLookArt(r.sentinel),
      dim: st.gold < r.price,
      color: heroLookVar(r.sentinel),
      glyph: GLYPH[lookOf(r.sentinel)],
      cost: { amount: r.price, currency: 'gold' },
      ...heroBits(r.sentinel),
      // A merchant hire is one of the five choices that pays the choice tax, and
      // the merchant is a map special, so the visit step is already on the bill.
      // (Endless merchants deal `recruit: null`, so this branch is campaign in
      // practice — guarded anyway rather than relying on that.)
      body: [...heroBody(r.sentinel), ...strengthNote(st, THREAT_FREE_CHOICE)],
      action: {
        label: 'Recruit',
        cost: { amount: r.price, currency: 'gold' },
        done: `${r.sentinel.name} joins your heroes`,
        run: () => st.buyMerchantRecruit(),
        disabled: st.gold < r.price || st.roster.length >= MAX_ROSTER,
      },
    })
  }
  out.push(...merchantServiceOffers(st))
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
      body: [`Boon — ${s.boon}`, `Curse — ${s.curse}`, ...strengthNote(st, THREAT_FREE_CHOICE)],
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
    // A hire is shown as the hero pick shows a hero: one comparison card each.
    title: s.name,
    sub: kitName(s),
    color: heroLookVar(s),
    glyph: GLYPH[lookOf(s)],
    cost: inEndless(st) ? { amount: st.endlessRecruitCost, currency: 'gold' as const } : undefined,
    hero: heroCard(s, stagedRun()),
    body: [
      ...(full ? [`You already have ${MAX_ROSTER} heroes — dismiss one first.`] : []),
      // Campaign hires pay the choice tax (`acceptRecruit`) on top of the
      // recruit node's own visit step; endless rooms pay neither.
      ...(full ? [] : strengthNote(st, THREAT_FREE_CHOICE)),
    ],
    action: {
      // The tapped candidate's id goes to the store in both modes. Without it
      // endless hires `recruitOptions[0]` whatever you picked, which made the
      // whole screen a fake choice.
      label: full ? 'No room for more heroes' : `Recruit ${s.name}`,
      done: `${s.name} joins your heroes`,
      cost: inEndless(st) && !full ? { amount: st.endlessRecruitCost, currency: 'gold' } : undefined,
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
    title: itemName(i),
    sub: RARITY[i.rarity].label,
    rarity: i.rarity,
    color: rarityVar(i.rarity),
    icon: itemIcon(i),
    mark: damageMark(i),
    bodyIcons: true,
    cost: { amount: reforgeDust(i), currency: 'dust' as const },
    dim: st.dust < reforgeDust(i),
    body: [
      ...itemBody(i),
      `Reforge for ${moneyText(reforgeDust(i), 'dust')} — rerolls every enchantment on it.`,
      canUpgrade(i) ? `Raise rarity for ${moneyText(upgradeDust(i), 'dust')} — one tier up, base kept.` : 'Already at the top rarity — it cannot be raised.',
      `You hold ${moneyText(st.dust, 'dust')}.`,
    ],
    action: {
      label: 'Reforge',
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
      sub: moneyText(st.dust, 'dust'),
      icon: 'forge',
      body: ['The pack is empty. Find or buy an item, then bring it back here.', `You hold ${moneyText(st.dust, 'dust')}.`],
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
    title: c.item ? itemName(c.item) : c.title,
    // The scope, per card (Wave 1). The board used to say "Take one — it
    // applies to the whole watch", which is false for every item card: an item
    // goes to the pack and helps whoever wears it.
    // Short, because it shares the row with the card's name and rarity.
    sub: c.kind === 'item' ? 'to pack' : c.kind === 'relic' ? 'relic' : 'all heroes',
    rarity: c.rarity,
    color: rarityVar(c.rarity),
    icon: c.item ? itemIcon(c.item) : c.kind === 'relic' ? 'relic' : 'boon',
    mark: c.item ? damageMark(c.item) : null,
    bodyIcons: !!c.item,
    warn: c.downside ? `Downside — ${c.downside}` : undefined,
    body: (c.item
      ? [c.desc, ...itemBody(c.item)]
      : c.kind === 'relic'
        ? relicLines(c.relic)
        : [
          c.desc,
          c.grant ? describeGrant(c.grant) : '',
          ...(c.grant?.mods ? describeMods(c.grant.mods) : []),
        ]
    ).filter(Boolean),
    // Team-wide mods merge with gear and branch mods, and the rule that decides
    // the winner was surfaced nowhere (H2). It is reference text, so it sits
    // behind an ⓘ like the hero panel's (Phase 2) instead of a paragraph on
    // every card.
    info: c.grant?.mods ? { label: 'How effects stack', lines: STACKING_RULES } : undefined,
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
        title: mutationName(m.key, m.name),
        sub: `${cr.revealed.heroName} · Mythic`,
        color: rarityVar('mythic'),
        icon: 'mutate',
        warn: m.downside ? `Downside — ${m.downside}` : undefined,
        body: [m.desc, ...describeMods(m.mods)],
        info: { label: 'How effects stack', lines: STACKING_RULES },
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
      const name = mutationName(m.key, m.name)
      return {
        id: m.id,
        title: name,
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
          held
            ? `${aimed.name} already carries this one.`
            : `Permanent — ${aimed.name} keeps it for the rest of the run and there is no reroll.`,
        ],
        action: {
          label: held ? 'Already carried' : `Give ${aimed.name} ${name}`,
          run: () => st.chooseHeroMutation(aimed.id, m.id),
          disabled: held,
          confirm: {
            label: `Yes — mutate ${aimed.name}`,
            note: `${name} is permanent — ${aimed.name} carries it for the rest of the run and there is no reroll.${m.downside ? ` It costs ${m.downside}.` : ''} Use the red "Yes — mutate ${aimed.name}" button below to go through with it; "Never mind" or another card leaves the choice open.`,
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
      body: ['Back to the recruits and your heroes. Nothing has been spent, and the same three mutations will be waiting.'],
      action: { label: 'Pick someone else', run: () => st.aimHeroMutation(null) },
    })
    return out
  }

  // ---- step 1: recruit, or aim ---------------------------------------------
  const out: Offer[] = cr.recruits.map((s) => ({
    id: s.id,
    title: `${s.name} · ${kitName(s)}`,
    sub: `Recruit · ${kitName(s)}`,
    color: heroLookVar(s),
    glyph: GLYPH[lookOf(s)],
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
    body: [...heroBody(s), ...strengthNote(st, THREAT_FREE_FORK)],
    action: { label: 'Take the recruit', run: () => st.recruitTeammate(s.id) },
  }))
  for (const h of st.roster) {
    const carried = h.mutations ?? []
    out.push({
      id: `mutate-${h.id}`,
      title: h.name,
      sub: 'Mutate',
      color: heroLookVar(h),
      icon: 'mutate',
      ...heroBits(h),
      portrait: { ...heroBits(h).portrait, badge: 'mutate' },
      body: [
        `Change how ${h.name} attacks, permanently.`,
        `${mutations.length} Mythic mutations are on the table — you read all ${mutations.length} and take one. They were dealt when the fork fired, so aiming at a different hero does not change them.`,
        ...carried.map((m) => `Already carries ${mutationName(m.key, m.name)} — ${m.desc}`),
        'Aiming costs nothing and can be undone.',
      ],
      action: { label: `Aim at ${h.name}`, run: () => st.aimHeroMutation(h.id) },
    })
  }
  return out
}

function roomOffers(st: St): Offer[] {
  const rooms = [
    { id: 'merchant', title: 'Merchant', icon: 'merchant', body: ['Items for gold.'] },
    { id: 'forge', title: 'Forge', icon: 'forge', body: ['Spend dust to reforge or raise rarity.'] },
    { id: 'shrine', title: 'Shrine', icon: 'shrine', body: ['A bargain with terms.'] },
    { id: 'recruit', title: 'Recruit', icon: 'recruit', body: ['Add a hero to your side.'] },
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

/** The Sound row's dials: `settingsStore`'s clamped, NaN-safe volume setters. */
function audioDials(s: Settings): NonNullable<Offer['sliders']> {
  return [
    { id: 'music', label: 'Music', value: s.audio.music, set: s.setMusicVolume },
    { id: 'effects', label: 'Effects', value: s.audio.game, set: s.setEffectsVolume, preview: 'coin' },
    { id: 'ui', label: 'Interface', value: s.audio.ui, set: s.setUiVolume, preview: 'toggle' },
  ]
}

function settingsOffers(s: Settings): Offer[] {
  const onOff = (v: boolean) => (v ? 'On' : 'Off')
  return [
    {
      id: 'mute',
      title: 'Sound',
      sub: s.audio.muted ? 'Muted' : `Music ${Math.round(s.audio.music * 100)} · Effects ${Math.round(s.audio.game * 100)}`,
      icon: s.audio.muted ? 'soundOff' : 'soundOn',
      /*
       * Three dials and a mute (Wave 1). This row used to be Mute plus a
       * separate Music on/off row — two switches and no volume at all, while
       * the store has carried master/game/ui/music gains since the audio pass.
       * The dials come from the legacy Watchtower's `VolumeSlider`, moved here
       * before that screen is deleted. Music at 0 stops the score outright
       * (the director stops scheduling), so the old on/off row is the bottom of
       * this dial and no longer needs a row of its own.
       */
      body: [
        'Effects carry information — what hit, what died, what got through. Music carries none, so it is the one to turn down first.',
        'Mute silences everything at once.',
      ],
      sliders: audioDials(s),
      action: { label: s.audio.muted ? 'Unmute' : 'Mute', run: () => s.toggleMute() },
    },
    {
      id: 'calmAudio',
      title: 'Calm audio',
      sub: onOff(s.calmAudio),
      icon: 'calm',
      body: [
        'The score without its drums, a softer master limiter, and the effects a little further forward than the music.',
        'Every warning still plays — only the pulse goes.',
      ],
      action: { label: s.calmAudio ? 'Turn off' : 'Turn on', run: () => s.setCalmAudio(!s.calmAudio) },
    },
    {
      id: 'monoAudio',
      title: 'Mono audio',
      sub: onOff(s.monoAudio),
      icon: 'mono',
      body: ['Folds the stereo mix to one channel, so nothing is lost to a single earbud or one ear.'],
      action: { label: s.monoAudio ? 'Turn off' : 'Turn on', run: () => s.setMonoAudio(!s.monoAudio) },
    },
    {
      id: 'motion',
      title: 'Reduced motion',
      sub: onOff(s.reducedMotion),
      icon: 'motion',
      body: ['Cuts animation and screen shake.'],
      action: { label: s.reducedMotion ? 'Turn off' : 'Turn on', run: () => s.setReducedMotion(!s.reducedMotion) },
    },
    {
      id: 'contrast',
      title: 'High contrast',
      sub: onOff(s.highContrast),
      icon: 'contrast',
      body: ['Stronger borders and text contrast throughout.'],
      action: { label: s.highContrast ? 'Turn off' : 'Turn on', run: () => s.setHighContrast(!s.highContrast) },
    },
    {
      id: 'scale',
      title: 'Large UI',
      sub: onOff(s.uiScale === 'large'),
      icon: 'scale',
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
      icon: 'vision',
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
        'Softens what the horde takes off your Gate when something reaches it.',
        assistProfile(s.assist).blurb,
        'Nothing else moves: same waves, same loot, same Marks. Change it whenever you like, mid-run included.',
      ],
      action: {
        label: `Set to ${assistProfile(nextAssist(s.assist)).label}`,
        run: () => s.setAssist(nextAssist(s.assist)),
      },
    },
    {
      id: 'everything',
      title: 'Show everything from the start',
      sub: onOff(s.showEverything),
      icon: 'map',
      body: [
        'Off: a first run introduces the game a piece at a time — gear after the first win, relics at the first elite, the Daily and Endless after the first run.',
        'On: every screen shows everything straight away, as it does for a returning player.',
      ],
      action: {
        label: s.showEverything ? 'Introduce things as they come' : 'Show everything',
        run: () => s.setShowEverything(!s.showEverything),
      },
    },
    {
      id: 'tips',
      title: 'Tips',
      sub: Object.values(s.taught).some(Boolean) ? 'Some seen' : 'All waiting',
      icon: 'tips',
      body: [
        'The one-line hints that appear the first time something new matters — posting a hero, gear, enemy strength, the merchant, relics, evolutions.',
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
        'Wipes Marks, Watchtower bonuses, unlocked skills, difficulty and records.',
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
 * The difficulty row in the Watchtower (SK1) — what the Vow row became.
 *
 * Information, with no price and no button: the step is chosen per run, on
 * the hero pick (`DifficultyPicker`), and raised only by winning at the top
 * step. Every number is read off `difficultyRules`.
 */
export const DIFFICULTY_BLURB =
  'Each difficulty step makes enemies 8% stronger and adds one elite to each act, and pays more Marks. A win at your highest step raises it and unlocks a skill and an item; you can turn it down at the start of any run.'

/** "Difficulty 2 · Enemies 16% stronger · 2 more elites an act" — for receipts. */
export const difficultyLine = (step: number): string => (step <= 0 ? 'Difficulty 0 — standard.' : `Difficulty ${step} · ${difficultyEffect(step)}`)

/** LS3: the difficulty row before the first finished run — locked, one plain line. */
function lockedDifficultyOffer(): Offer {
  return {
    id: 'difficulty',
    title: 'Difficulty',
    sub: 'Locked',
    icon: PERK_ICON.sacrifice,
    dim: true,
    locked: OPENS_AFTER_FIRST_RUN,
    body: [`${OPENS_AFTER_FIRST_RUN}. Winning raises the difficulty a step, and each step unlocks a skill and an item.`],
    action: { label: 'Locked', run: () => {}, disabled: true },
  }
}

function difficultyOffer(meta: Meta): Offer {
  const top = meta.topDifficulty
  const best = meta.difficultyBest
  return {
    id: 'difficulty',
    title: `Difficulty ${top}`,
    sub: top >= MAX_DIFFICULTY ? 'the top step' : `highest of ${MAX_DIFFICULTY}`,
    icon: PERK_ICON.sacrifice,
    color: 'var(--accent)',
    pips: { on: top, of: MAX_DIFFICULTY },
    body: [
      top === 0
        ? 'Win a run to raise it to 1 and unlock a skill and an item.'
        : `Your highest is ${top}: ${difficultyEffect(top)}. A run opens there; turn it down on the hero screen.`,
      DIFFICULTY_BLURB,
      ...(top < MAX_DIFFICULTY ? [`Next: Difficulty ${top + 1} — ${difficultyEffect(top + 1)}, pays ×${difficultyRules(top + 1).markMult} Marks.`] : []),
      ...Object.entries(best)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([step, score]) => `Best winning score at difficulty ${step}: ${score}.`),
    ],
  }
}

/**
 * Daily Watch (Phase 1): the UTC day's shared seed under standard rules, one
 * scored attempt a day. Kept to one row on purpose — the UI lane restyles it.
 */
/** LS3: what opens the Daily, Endless and the Vows — said the same way on all three. */
export const OPENS_AFTER_FIRST_RUN = 'Opens after your first run'

function dailyOffer(meta: Meta, staged: boolean): Offer {
  if (staged) {
    return {
      id: 'daily',
      title: 'Daily Watch',
      icon: 'map',
      dim: true,
      locked: OPENS_AFTER_FIRST_RUN,
      body: [`${OPENS_AFTER_FIRST_RUN}: one shared road a day, the same for everyone.`],
    }
  }
  const date = utcDateKey()
  const rec = meta.daily?.date === date ? meta.daily : null
  const status = !rec
    ? "Today's scored attempt is unplayed."
    : !rec.done
      ? "Today's scored attempt is under way — another start today is practice."
      : `Today: ${rec.won ? 'won' : `depth ${rec.depth}`}, score ${rec.score}. Another start today is practice.`
  return {
    id: 'daily',
    title: 'Daily Watch',
    sub: date,
    icon: 'map',
    color: 'var(--accent)',
    body: [
      `Seed ${dailySeed(date)} — the same map, waves and offers for every Watch today (UTC).`,
      'Standard rules: no Watchtower bonuses, the starting skills only, no difficulty step. The first run you commit a hero to each day is scored.',
      status,
    ],
    action: { label: rec ? 'Practice' : 'Begin', run: () => useGameStore.getState().startDaily() },
  }
}

function metaOffers(view: MetaView, meta: Meta, settings: Settings, setView: (v: MetaView) => void): Offer[] {
  const game = useGameStore.getState()
  // LS3: until the first run is finished the menu holds back what a first
  // run has not met: the Vows, the Daily Watch and Endless.
  const staged = menuStaged(meta.stats, settings.showEverything)
  // Going back is a choice like any other, so it rides in the Selector rather
  // than as a floating button over the Stage.
  const back: Offer = {
    id: 'back',
    title: 'Back',
    icon: 'back',
    immediate: true,
    body: ['Back to the Watchtower menu.'],
    action: { label: 'Back', run: () => setView('menu') },
  }
  if (view === 'settings') return [back, ...settingsOffers(settings)]
  if (view === 'codex') return [back, ...codexOffers({ ...meta, staged })]
  if (view === 'perks') {
    return [back, ...UPGRADES.map((u): Offer => {
      const level = meta.upgrades[u.id] ?? 0
      const maxed = level >= u.maxLevel
      const cost = meta.upgradeCost(u.id)
      // A service opened by a feat (Phase 3b): shown, priced, and locked until
      // the feat is earned — the row says which one, so the goal is legible.
      const feat = u.requires && !meta.achieved(u.requires) ? ACHIEVEMENTS.find((a) => a.id === u.requires) : undefined
      if (feat) {
        return {
          id: u.id,
          title: u.name,
          sub: 'Locked',
          icon: PERK_ICON[u.id] ?? 'boon',
          dim: true,
          body: [u.desc, `Opens with the feat ${feat.name}: ${feat.feat}`, `Then ${moneyText(cost, 'marks')}.`],
          action: { label: `Locked — ${feat.name}`, run: () => {}, disabled: true },
        }
      }
      return {
        id: u.id,
        title: u.name,
        sub: `${level}/${u.maxLevel}`,
        icon: PERK_ICON[u.id] ?? 'boon',
        pips: { on: level, of: u.maxLevel },
        cost: maxed ? undefined : { amount: cost, currency: 'marks' as const },
        dim: !maxed && meta.watchMarks < cost,
        body: [
          u.desc,
          `Level ${level} of ${u.maxLevel}.`,
          maxed ? 'Fully upgraded.' : `Next level: ${moneyText(cost, 'marks')}.`,
        ],
        action: {
          label: maxed ? 'Maxed' : 'Buy',
          cost: maxed ? undefined : { amount: cost, currency: 'marks' as const },
          run: () => meta.buyUpgrade(u.id),
          disabled: maxed || meta.watchMarks < cost,
        },
      }
    }), staged ? lockedDifficultyOffer() : difficultyOffer(meta)]
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
      body: ['A fresh map, fresh heroes. Permadeath — one loss ends it.'],
      action: { label: 'Begin', run: () => game.newRun() },
    },
    dailyOffer(meta, staged),
    {
      id: 'perks',
      title: 'Watchtower',
      // Marks are met at the end of the first run (LS3/LS4); a first-timer's
      // menu does not name them before then.
      sub: staged && meta.watchMarks === 0 ? undefined : moneyText(meta.watchMarks, 'marks'),
      icon: 'marks',
      immediate: true,
      body: ['Spend Marks on permanent bonuses that carry between runs.'],
      action: { label: 'Open', run: () => setView('perks') },
    },
    {
      id: 'codex',
      title: 'Codex',
      sub: staged ? 'Glossary' : `Watch level ${watchLevelFor(meta.watchXp)}`,
      icon: 'grimoire',
      immediate: true,
      body: ['A glossary of every idea you have met, your collection of skills and items and your Watch level, feats earned and still open, and every goblin and relic the Watch has seen.'],
      action: { label: 'Open', run: () => setView('codex') },
    },
    staged
      ? {
          id: 'endless',
          title: 'Endless Watch',
          icon: 'endless',
          dim: true,
          locked: OPENS_AFTER_FIRST_RUN,
          body: [`${OPENS_AFTER_FIRST_RUN}: wave after wave, for as long as the Gate holds.`],
        }
      : {
          id: 'endless',
          title: 'Endless Watch',
          sub: meta.stats.bestRound > 0 ? `best round ${meta.stats.bestRound}` : undefined,
          icon: 'endless',
          color: 'var(--teal)',
          body: ['Three retries, escalating waves, rooms between each one.'],
          action: { label: 'Begin', run: () => game.startEndless() },
        },
    {
      id: 'settings',
      title: 'Settings',
      icon: 'settings',
      immediate: true,
      body: ['Audio, motion, contrast, scale, colour vision, assist and the first-run tips.'],
      action: { label: 'Open', run: () => setView('settings') },
    },
  ]
}
