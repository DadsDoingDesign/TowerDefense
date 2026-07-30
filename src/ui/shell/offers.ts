import { describeBase, RARITY } from '../../game/data/items'
import { describeEnchant, describeGrant, describeMods } from '../../game/data/describe'
import { buildName } from '../../game/engine/leveling'
import { computeCombat } from '../../game/engine/combat'
import { MAX_ROSTER, useGameStore } from '../../state/gameStore'
import { useMetaStore, UPGRADES } from '../../state/metaStore'
import { useSettingsStore } from '../../state/settingsStore'
import type { Item, Sentinel } from '../../game/types'

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
  /** Price chip on the card. */
  cost?: { amount: number; currency: 'gold' | 'dust' | 'marks' }
  /** Bullet lines shown in the Context panel. */
  body: string[]
  /** Primary action, rendered as the panel's button. */
  action?: { label: string; run: () => void; disabled?: boolean }
  /** Secondary action (decline, skip, leave). */
  secondary?: { label: string; run: () => void }
  /**
   * Fire the action on the card tap instead of filling the Context panel
   * first. Reserved for reversible navigation — back, leave, submenu — where
   * there is no detail worth reading and select-then-confirm is just friction.
   * Anything that spends, grants or destroys must never set this.
   */
  immediate?: boolean
}

const GLYPH: Record<string, string> = { fighter: '⚔', rogue: '✦', mystic: '❋' }

function itemBody(item: Item): string[] {
  const out = [...describeBase(item)]
  for (const e of item.enchantments) {
    const t = describeEnchant(e)
    if (t) out.push(`${e.label} — ${t}`)
  }
  return out
}

function heroBody(s: Sentinel): string[] {
  const p = computeCombat(s)
  return [
    `STR ${s.stats.str} · DEX ${s.stats.dex} · INT ${s.stats.int}`,
    `${Math.round(p.dps)} DPS · ${Math.round(p.range)} range`,
    `${Math.round(p.maxHp)} HP`,
  ]
}

/** The offers for the current context, in Selector order. */
export function useOffers(metaView: MetaView, setMetaView: (v: MetaView) => void): Offer[] {
  const st = useGameStore()
  const meta = useMetaStore()

  if (st.screen === 'hub') return metaOffers(metaView, meta, setMetaView)
  if (st.runPhase !== 'active') return runEndOffers(st)
  if (st.screen === 'heroPick') return heroPickOffers(st)
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

type St = ReturnType<typeof useGameStore.getState>
type Meta = ReturnType<typeof useMetaStore.getState>
export type MetaView = 'menu' | 'perks' | 'settings'

function heroPickOffers(st: St): Offer[] {
  const archs = ['fighter', 'rogue', 'mystic'] as const
  const blurb = {
    fighter: 'Front line. High HP, blocks the lane, thorns on contact.',
    rogue: 'Fast single-target damage. Crits and executes.',
    mystic: 'Ranged control. Chills, chains and buffs allies.',
  }
  return archs.map((a) => ({
    id: `pick-${a}`,
    title: a[0].toUpperCase() + a.slice(1),
    sub: 'Starting Sentinel',
    glyph: GLYPH[a],
    body: [blurb[a]],
    action: { label: `Take the ${a}`, run: () => st.pickStartingHero(a) },
  }))
}

function merchantOffers(st: St): Offer[] {
  const m = st.merchant
  if (!m) return []
  const out: Offer[] = m.items.map((e) => ({
    id: e.item.id,
    title: e.item.name,
    sub: RARITY[e.item.rarity].label,
    color: RARITY[e.item.rarity].color,
    cost: { amount: e.price, currency: 'gold' as const },
    body: itemBody(e.item),
    action: {
      label: `Buy · ⟡${e.price}`,
      run: () => (st.endlessRoom ? st.endlessBuyItem(e.item.id) : st.buyMerchantItem(e.item.id)),
      disabled: st.gold < e.price,
    },
  }))
  if (m.recruit) {
    const r = m.recruit
    out.push({
      id: r.sentinel.id,
      title: r.sentinel.name,
      sub: buildName(r.sentinel),
      color: r.sentinel.color,
      glyph: GLYPH[r.sentinel.archetype],
      cost: { amount: r.price, currency: 'gold' },
      body: heroBody(r.sentinel),
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
  const accept = st.endlessRoom ? () => st.endlessShrineAccept() : () => st.acceptShrine()
  return [
    {
      id: 'shrine',
      title: s.title,
      sub: 'Bargain',
      glyph: '❖',
      body: [`Boon — ${s.boon}`, `Curse — ${s.curse}`],
      action: { label: 'Accept the terms', run: accept },
      secondary: st.endlessRoom
        ? { label: 'Walk away', run: () => st.endlessCloseRoom() }
        : { label: 'Walk away', run: () => st.declineShrine() },
    },
  ]
}

function recruitOffers(st: St): Offer[] {
  const full = st.roster.length >= MAX_ROSTER
  const out: Offer[] = st.recruitOptions.map((s) => ({
    id: s.id,
    title: s.name,
    sub: buildName(s),
    color: s.color,
    glyph: GLYPH[s.archetype],
    cost: st.endlessRoom ? { amount: st.endlessRecruitCost, currency: 'gold' as const } : undefined,
    body: full ? [...heroBody(s), 'Your roster is full — dismiss someone first.'] : heroBody(s),
    action: {
      label: full ? 'Roster full' : 'Recruit',
      run: () => (st.endlessRoom ? st.endlessRecruit() : st.acceptRecruit(s.id)),
      disabled: full || (st.endlessRoom ? st.gold < st.endlessRecruitCost : false),
    },
  }))
  out.push(
    st.endlessRoom
      ? { id: 'leave', title: 'Leave', glyph: '←', immediate: true, body: ['Head back to the rooms.'], action: { label: 'Leave', run: () => st.endlessCloseRoom() } }
      : { id: 'skip', title: 'Walk on', glyph: '←', immediate: true, body: ['Turn the recruit away and march.'], action: { label: 'Walk on', run: () => st.skipRecruit() } },
  )
  return out
}

function forgeOffers(st: St): Offer[] {
  const out: Offer[] = st.inventory.map((i) => ({
    id: i.id,
    title: i.name,
    sub: RARITY[i.rarity].label,
    color: RARITY[i.rarity].color,
    body: itemBody(i),
    action: { label: 'Reforge', run: () => st.endlessForgeReforge(i.id) },
    secondary: { label: 'Upgrade rarity', run: () => st.endlessForgeUpgrade(i.id) },
  }))
  out.push({ id: 'leave', title: 'Leave', glyph: '←', immediate: true, body: ['Head back to the rooms.'], action: { label: 'Leave', run: () => st.endlessCloseRoom() } })
  return out
}

function rewardOffers(st: St): Offer[] {
  return (st.reward ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    sub: c.kind === 'item' ? 'Item' : 'Attribute',
    color: c.item ? RARITY[c.item.rarity].color : undefined,
    glyph: c.kind === 'item' ? '◆' : '✦',
    body: c.item
      ? [c.desc, ...itemBody(c.item)]
      : [c.desc, c.grant ? describeGrant(c.grant) : '', ...(c.grant?.mods ? describeMods(c.grant.mods) : [])].filter(Boolean),
    action: { label: 'Take it', run: () => st.chooseReward(c.id) },
  }))
}

function crossroadsOffers(st: St): Offer[] {
  const cr = st.crossroads
  if (!cr) return []
  if (cr.revealed) {
    return [
      {
        id: 'revealed',
        title: cr.revealed.mutation.name,
        sub: `${cr.revealed.heroName} mutated`,
        glyph: '✦',
        body: [cr.revealed.mutation.desc],
        action: { label: 'March on', run: () => st.finishCrossroads() },
      },
    ]
  }
  const out: Offer[] = cr.recruits.map((s) => ({
    id: s.id,
    title: s.name,
    sub: `Recruit · ${buildName(s)}`,
    color: s.color,
    glyph: GLYPH[s.archetype],
    body: heroBody(s),
    action: { label: 'Take the recruit', run: () => st.recruitTeammate(s.id) },
  }))
  for (const h of st.roster) {
    out.push({
      id: `mutate-${h.id}`,
      title: h.name,
      sub: 'Mutate',
      color: h.color,
      glyph: '⚗',
      body: ['Roll a permanent attack mutation for this hero.'],
      action: { label: `Mutate ${h.name}`, run: () => st.rollHeroMutation(h.id) },
    })
  }
  return out
}

function roomOffers(st: St): Offer[] {
  const rooms = [
    { id: 'merchant', title: 'Merchant', glyph: '⟡', body: ['Four items for gold.'] },
    { id: 'forge', title: 'Forge', glyph: '⚒', body: ['Spend dust to reforge or raise rarity.'] },
    { id: 'shrine', title: 'Shrine', glyph: '❖', body: ['A bargain with terms.'] },
    { id: 'recruit', title: 'Recruit', glyph: '⚔', body: ['Add a Sentinel to the watch.'] },
  ] as const
  const out: Offer[] = rooms.map((r) => ({
    id: r.id,
    title: r.title,
    sub: 'Room',
    glyph: r.glyph,
    body: [...r.body],
    action: { label: `Enter the ${r.title.toLowerCase()}`, run: () => st.endlessOpenRoom(r.id) },
  }))
  out.push({
    id: 'wave',
    title: `Wave ${st.round}`,
    sub: 'Fight',
    glyph: '⚑',
    color: 'var(--accent)',
    body: ['Take the next wave. Rooms stay open between waves.'],
    action: { label: 'Begin the wave', run: () => st.endlessBeginWave() },
  })
  return out
}

function runEndOffers(st: St): Offer[] {
  return [
    {
      id: 'bank',
      title: 'Bank and return',
      sub: 'Watchtower',
      glyph: '⌂',
      body: [`✦ ${st.marksEarned} Watch Marks banked.`, 'Spend them on permanent upgrades.'],
      action: { label: 'Return to the Watchtower', run: () => st.returnToHub() },
    },
  ]
}

function leaveOffer(st: St): Offer {
  return st.endlessRoom
    ? { id: 'leave', title: 'Leave', glyph: '←', immediate: true, body: ['Head back to the rooms.'], action: { label: 'Leave', run: () => st.endlessCloseRoom() } }
    : { id: 'leave', title: 'March on', glyph: '←', immediate: true, body: ['Leave the offers and continue.'], action: { label: 'March on', run: () => st.leaveEvent() } }
}

/** Each setting is an offer whose action flips it — same one interaction. */
function settingsOffers(): Offer[] {
  const s = useSettingsStore.getState()
  const onOff = (v: boolean) => (v ? 'On' : 'Off')
  return [
    {
      id: 'mute',
      title: 'Sound',
      sub: onOff(!s.audio.muted),
      glyph: s.audio.muted ? '🔇' : '🔊',
      body: ['Master audio for music and effects.'],
      action: { label: s.audio.muted ? 'Unmute' : 'Mute', run: () => s.toggleMute() },
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
      body: ['Bigger type and taller touch targets.'],
      action: {
        label: s.uiScale === 'large' ? 'Normal size' : 'Make it large',
        run: () => s.setUiScale(s.uiScale === 'large' ? 'normal' : 'large'),
      },
    },
    {
      id: 'reset',
      title: 'Reset progress',
      sub: 'Destructive',
      glyph: '⚠',
      color: 'var(--bad)',
      body: ['Wipes Watch Marks, perks and records. This cannot be undone.'],
      action: { label: 'Erase everything', run: () => useMetaStore.getState().resetMeta() },
    },
  ]
}

function metaOffers(view: MetaView, meta: Meta, setView: (v: MetaView) => void): Offer[] {
  const game = useGameStore.getState()
  // Going back is a choice like any other, so it rides in the Selector rather
  // than as a floating button over the Stage.
  const back: Offer = {
    id: 'back',
    title: 'Back',
    sub: 'Watchtower',
    glyph: '←',
    immediate: true,
    body: ['Back to the Watchtower menu.'],
    action: { label: 'Back', run: () => setView('menu') },
  }
  if (view === 'settings') return [back, ...settingsOffers()]
  if (view === 'perks') {
    return [back, ...UPGRADES.map((u) => {
      const level = meta.upgrades[u.id] ?? 0
      const maxed = level >= u.maxLevel
      const cost = meta.upgradeCost(u.id)
      return {
        id: u.id,
        title: u.name,
        sub: `${level}/${u.maxLevel}`,
        glyph: '✦',
        cost: maxed ? undefined : { amount: cost, currency: 'marks' as const },
        body: [u.desc, maxed ? 'Fully upgraded.' : `Next level costs ✦${cost}.`],
        action: {
          label: maxed ? 'Maxed' : `Buy · ✦${cost}`,
          run: () => meta.buyUpgrade(u.id),
          disabled: maxed || meta.watchMarks < cost,
        },
      }
    })]
  }
  return [
    {
      id: 'run',
      title: 'Start a Run',
      sub: 'Campaign',
      glyph: '▶',
      color: 'var(--accent)',
      body: ['A fresh map, a fresh roster. Permadeath — one loss ends it.'],
      action: { label: 'Begin', run: () => game.newRun() },
    },
    {
      id: 'perks',
      title: 'Upgrade Perks',
      sub: `✦ ${meta.watchMarks}`,
      glyph: '✦',
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
      glyph: '⚙',
      immediate: true,
      body: ['Audio, motion, contrast and scale.'],
      action: { label: 'Open', run: () => setView('settings') },
    },
  ]
}
