import type { CSSProperties } from 'react'
import { describeBase, HERO_SLOTS, HERO_SLOT_LABEL, RARITY, heroSlotsFor } from '../../game/data/items'
import { describeEnchant } from '../../game/data/describe'
import { UPGRADE_PATHS, milestoneForLevel } from '../../game/data/upgradeTree'
import { computeCombat, effectiveUpgradeLevels } from '../../game/engine/combat'
import { buildName, MAX_LEVEL } from '../../game/engine/leveling'
import type { FocusMode, Item, Sentinel } from '../../game/types'
import { useGameStore, type HeroTab } from '../../state/gameStore'
import type { Offer } from './offers'

const FOCUS_OPTS: { id: FocusMode; label: string }[] = [
  { id: 'first', label: 'First' },
  { id: 'lowestHp', label: 'Low HP' },
  { id: 'strongest', label: 'Strong' },
  { id: 'nearest', label: 'Near' },
]

/**
 * Band 4 — context panel, the selected hero's gear, and the pack. The pack is
 * permanent (rule three): it is on screen in battle, on the map and at the
 * merchant, so buying an item means watching it land.
 */
export function DetailBand({ offers }: { offers: Offer[] }) {
  return (
    <section className="sh-detail">
      <ContextPanel offers={offers} />
      <GearColumn />
      <PackColumn />
    </section>
  )
}

/* ------------------------------------------------------------ context panel */

function ContextPanel({ offers }: { offers: Offer[] }) {
  const selection = useGameStore((s) => s.shellSelection)
  const roster = useGameStore((s) => s.roster)
  const inventory = useGameStore((s) => s.inventory)

  if (selection?.kind === 'hero') {
    const hero = roster.find((h) => h.id === selection.id)
    if (hero) return <HeroPanel hero={hero} />
  }
  if (selection?.kind === 'item') {
    const item = findItem(inventory, roster, selection.id)
    if (item) return <ItemPanel item={item} />
  }
  if (selection?.kind === 'offer') {
    const offer = offers.find((o) => o.id === selection.id)
    if (offer) return <OfferPanel offer={offer} />
  }
  return <EmptyPanel hasOffers={offers.length > 0} />
}

/**
 * With nothing selected the panel carries the context's primary action, which
 * is where the old pinned battle footer went.
 */
function EmptyPanel({ hasOffers }: { hasOffers: boolean }) {
  const screen = useGameStore((s) => s.screen)
  const battlePhase = useGameStore((s) => s.battlePhase)
  const roster = useGameStore((s) => s.roster)
  const placements = useGameStore((s) => s.placements)
  const currentWave = useGameStore((s) => s.currentWave)
  const hud = useGameStore((s) => s.hud)
  const startWave = useGameStore((s) => s.startWave)
  const continueAfterWave = useGameStore((s) => s.continueAfterWave)
  const lastResult = useGameStore((s) => s.lastResult)
  const runPhase = useGameStore((s) => s.runPhase)
  const marksEarned = useGameStore((s) => s.marksEarned)
  const returnToHub = useGameStore((s) => s.returnToHub)

  // A finished run keeps the party in the Selector, so its actions live here
  // rather than behind an offer nobody can tap.
  if (runPhase !== 'active' && screen !== 'hub') {
    return (
      <div className="sh-context">
        <div className="sh-context-head">
          <strong>{runPhase === 'won' ? 'The Watch Holds' : 'The Line Breaks'}</strong>
          <span className="sh-context-sub">run over</span>
        </div>
        <div className="sh-context-body">
          <p className="sh-line accent">✦ {marksEarned} Watch Marks banked.</p>
          <p className="sh-line muted">Spend them on permanent upgrades in the Watchtower.</p>
        </div>
        <div className="sh-context-foot">
          <button className="sh-btn primary" onClick={returnToHub}>
            Return to the Watchtower
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'battle' && runPhase === 'active') {
    // A cleared wave with no reward pick waiting — offer the way out.
    if (lastResult && battlePhase !== 'battle') {
      return (
        <div className="sh-context">
          <div className="sh-context-head">
            <strong>{lastResult.status === 'cleared' ? 'Wave cleared' : 'Wave lost'}</strong>
          </div>
          <div className="sh-context-body">
            <p className="sh-line">⟡ {lastResult.goldEarned} earned · {lastResult.enemiesKilled} felled</p>
          </div>
          <div className="sh-context-foot">
            <button className="sh-btn primary" onClick={continueAfterWave}>
              Continue
            </button>
          </div>
        </div>
      )
    }

    if (battlePhase === 'battle') {
      const killed = Math.max(0, hud.enemiesSpawned - hud.enemiesAlive)
      return (
        <div className="sh-context">
          <div className="sh-context-head">
            <strong>{currentWave?.label ?? 'Wave'}</strong>
            <span className="sh-context-sub">live</span>
          </div>
          <div className="sh-context-body">
            <Meter label="Cleared" value={`${killed}/${hud.enemiesTotal}`} frac={killed / Math.max(1, hud.enemiesTotal)} />
            <p className="sh-line muted">{hud.enemiesAlive} on the field</p>
          </div>
        </div>
      )
    }

    const deployed = roster.filter((s) => Object.values(placements).includes(s.id)).length
    return (
      <div className="sh-context">
        <div className="sh-context-head">
          <strong>{currentWave?.label ?? 'Encounter'}</strong>
          <span className="sh-context-sub">{currentWave?.spawns.length ?? 0} enemies</span>
        </div>
        <div className="sh-context-body">
          <p className="sh-line muted">
            {deployed
              ? `${deployed} deployed. Tap a Sentinel, then tap a slot to move it.`
              : 'Tap a Sentinel, then tap a build slot to deploy it.'}
          </p>
        </div>
        <div className="sh-context-foot">
          <button className="sh-btn primary" disabled={deployed === 0} onClick={startWave}>
            Start Wave ▶
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="sh-context empty">
      <p className="sh-empty-hint">{hasOffers ? 'Tap an offer to see what it does.' : 'Tap a Sentinel to see its detail.'}</p>
    </div>
  )
}

function HeroPanel({ hero }: { hero: Sentinel }) {
  const tab = useGameStore((s) => s.heroTab)
  const setHeroTab = useGameStore((s) => s.setHeroTab)
  const profile = computeCombat(hero)

  const TABS: { id: HeroTab; label: string }[] = [
    { id: 'stats', label: 'Stats' },
    { id: 'upgrades', label: 'Upgr' },
    { id: 'tactics', label: 'Tune' },
  ]

  return (
    <div className="sh-context">
      <div className="sh-context-head">
        <strong style={{ color: hero.color }}>{hero.name}</strong>
        <span className="sh-context-sub">DPS {Math.round(profile.dps)}</span>
      </div>
      <div className="sh-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`sh-tab ${tab === t.id ? 'active' : ''}`}
            data-sfx="toggle"
            onClick={() => setHeroTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="sh-context-body">
        {tab === 'stats' && <HeroStats hero={hero} />}
        {tab === 'upgrades' && <HeroUpgrades hero={hero} />}
        {tab === 'tactics' && <HeroTactics />}
      </div>
    </div>
  )
}

function HeroStats({ hero }: { hero: Sentinel }) {
  const p = computeCombat(hero)
  return (
    <>
      <p className="sh-line muted">
        {buildName(hero)} · Level {hero.level}/{MAX_LEVEL}
      </p>
      <div className="sh-statgrid">
        <Cell label="Attack" a={hero.stats.str} b={hero.stats.int} heads={['Physical', 'Magic']} />
        <Cell label="Defense" a={hero.stats.dex} b={Math.round(p.maxHp)} heads={['DEX', 'HP']} />
      </div>
      <Meter label="Speed" value={`${p.rate.toFixed(1)}/s`} frac={Math.min(1, p.rate / 3)} />
      <Meter label="Crit mult" value={`×${p.critMult.toFixed(1)}`} frac={Math.min(1, (p.critMult - 1) / 2)} />
      <Meter label="Crit chance" value={`${Math.round(p.critChance * 100)}%`} frac={p.critChance} />
      {(hero.mutations ?? []).map((m) => (
        <p key={m.key} className="sh-line accent">
          ⚗ {m.name} — {m.desc}
        </p>
      ))}
    </>
  )
}

function Cell({ label, a, b, heads }: { label: string; a: number; b: number; heads: [string, string] }) {
  return (
    <div className="sh-cell">
      <span className="sh-cell-label">{label}</span>
      <span className="sh-cell-pair">
        <span title={heads[0]}>{a}</span>
        <span title={heads[1]}>{b}</span>
      </span>
    </div>
  )
}

function Meter({ label, value, frac }: { label: string; value: string; frac: number }) {
  return (
    <div className="sh-meter">
      <span className="sh-meter-label">{label}</span>
      <span className="sh-meter-track">
        <span className="sh-meter-fill" style={{ width: `${Math.max(0, Math.min(1, frac)) * 100}%` }} />
      </span>
      <span className="sh-meter-val">{value}</span>
    </div>
  )
}

function HeroUpgrades({ hero }: { hero: Sentinel }) {
  const gold = useGameStore((s) => s.gold)
  const buy = useGameStore((s) => s.buyTowerUpgrade)
  const effective = effectiveUpgradeLevels(hero)

  return (
    <>
      {UPGRADE_PATHS.map((path) => {
        const eff = effective[path.id] ?? 0
        const canBuyMore = eff < path.levels.length
        const nextLevel = eff + 1
        const cost = canBuyMore ? path.levels[nextLevel - 1].cost : 0
        const milestone = canBuyMore ? milestoneForLevel(nextLevel) : 0
        const meets = hero.level >= milestone
        return (
          <div className="sh-upg" key={path.id}>
            <div className="sh-upg-head">
              <strong>{path.name}</strong>
              <span className="sh-pips">
                {path.levels.map((_, i) => (
                  <span key={i} className={`sh-pip ${i < eff ? 'on' : ''}`} />
                ))}
              </span>
            </div>
            <button
              className="sh-btn small"
              disabled={!canBuyMore || !meets || gold < cost}
              onClick={() => buy(hero.id, path.id)}
            >
              {!canBuyMore ? 'Maxed' : meets ? `L${nextLevel} · ⟡${cost}` : `Lv ${milestone}`}
            </button>
          </div>
        )
      })}
    </>
  )
}

function HeroTactics() {
  const tactics = useGameStore((s) => s.tactics)
  const setTactics = useGameStore((s) => s.setTactics)
  return (
    <>
      <p className="sh-line muted">Targeting</p>
      <div className="sh-seg">
        {FOCUS_OPTS.map((f) => (
          <button
            key={f.id}
            className={`sh-seg-btn ${tactics.focus === f.id ? 'active' : ''}`}
            data-sfx="toggle"
            onClick={() => setTactics({ focus: f.id })}
          >
            {f.label}
          </button>
        ))}
      </div>
      <button
        className={`sh-check ${tactics.holdFire ? 'on' : ''}`}
        data-sfx="toggle"
        onClick={() => setTactics({ holdFire: !tactics.holdFire })}
      >
        <span>{tactics.holdFire ? '☑' : '☐'}</span> Hold fire until in range
      </button>
    </>
  )
}

function ItemPanel({ item }: { item: Item }) {
  const gearSlot = useGameStore((s) => s.gearSlot)
  const roster = useGameStore((s) => s.roster)
  const selection = useGameStore((s) => s.shellSelection)
  const equipItem = useGameStore((s) => s.equipItem)
  const unequipItem = useGameStore((s) => s.unequipItem)
  const dismantleItem = useGameStore((s) => s.dismantleItem)
  const shellSelect = useGameStore((s) => s.shellSelect)
  const clearGearSlot = useGameStore((s) => s.clearGearSlot)

  // Where is it — loose in the pack, or worn by someone?
  const wearer = roster.find((s) => HERO_SLOTS.some((hs) => s.equipment[hs]?.id === item.id))
  const wornSlot = wearer ? HERO_SLOTS.find((hs) => wearer.equipment[hs]?.id === item.id) : undefined

  return (
    <div className="sh-context">
      <div className="sh-context-head">
        <strong style={{ color: RARITY[item.rarity].color }}>{item.name}</strong>
        <span className="sh-context-sub">{RARITY[item.rarity].label}</span>
      </div>
      <div className="sh-context-body">
        {describeBase(item).map((l, i) => (
          <p className="sh-line" key={i}>
            {l}
          </p>
        ))}
        {(item.enchantments).map((e, i) => (
          <p className="sh-line accent" key={`e${i}`}>
            {e.label} — {describeEnchant(e)}
          </p>
        ))}
        {wearer && (
          <p className="sh-line muted">
            Worn by {wearer.name} · {wornSlot ? HERO_SLOT_LABEL[wornSlot] : ''}
          </p>
        )}
      </div>
      <div className="sh-context-foot">
        {gearSlot && !wearer && heroSlotsFor(item.slot).includes(gearSlot.slot) ? (
          <button
            className="sh-btn primary"
            onClick={() => {
              equipItem(gearSlot.sentinelId, gearSlot.slot, item.id)
              clearGearSlot()
              shellSelect(null)
            }}
          >
            Equip to {HERO_SLOT_LABEL[gearSlot.slot]}
          </button>
        ) : wearer && wornSlot ? (
          <button
            className="sh-btn"
            onClick={() => {
              unequipItem(wearer.id, wornSlot)
              shellSelect(null)
            }}
          >
            Unequip
          </button>
        ) : (
          <button
            className="sh-btn"
            onClick={() => {
              dismantleItem(item.id)
              if (selection?.kind === 'item' && selection.id === item.id) shellSelect(null)
            }}
          >
            Dismantle
          </button>
        )}
      </div>
    </div>
  )
}

function OfferPanel({ offer }: { offer: Offer }) {
  return (
    <div className="sh-context">
      <div className="sh-context-head">
        <strong style={offer.color ? { color: offer.color } : undefined}>{offer.title}</strong>
        {offer.sub && <span className="sh-context-sub">{offer.sub}</span>}
      </div>
      <div className="sh-context-body">
        {offer.body.map((l, i) => (
          <p className="sh-line" key={i}>
            {l}
          </p>
        ))}
      </div>
      <div className="sh-context-foot">
        {offer.action && (
          <button className="sh-btn primary" disabled={offer.action.disabled} onClick={offer.action.run}>
            {offer.action.label}
          </button>
        )}
        {offer.secondary && (
          <button className="sh-btn" onClick={offer.secondary.run}>
            {offer.secondary.label}
          </button>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- gear + pack */

function GearColumn() {
  const roster = useGameStore((s) => s.roster)
  const selection = useGameStore((s) => s.shellSelection)
  const gearSlot = useGameStore((s) => s.gearSlot)
  const activateGearSlot = useGameStore((s) => s.activateGearSlot)
  const clearGearSlot = useGameStore((s) => s.clearGearSlot)
  const shellSelect = useGameStore((s) => s.shellSelect)

  // Follows the selected hero; falls back to the first of the roster so the
  // column is never an empty mystery.
  const hero = (selection?.kind === 'hero' ? roster.find((h) => h.id === selection.id) : undefined) ?? roster[0]

  return (
    <div className="sh-gear">
      <div className="sh-col-head">
        <span>GEAR</span>
      </div>
      <div className="sh-gear-slots">
        {hero
          ? HERO_SLOTS.map((hs) => {
              const worn = hero.equipment[hs]
              const active = gearSlot?.sentinelId === hero.id && gearSlot.slot === hs
              return (
                <button
                  key={hs}
                  className={`sh-slot ${worn ? 'filled' : 'empty'} ${active ? 'active' : ''}`}
                  style={worn ? ({ '--rail': RARITY[worn.rarity].color } as CSSProperties) : undefined}
                  onClick={() => {
                    if (worn) {
                      shellSelect({ kind: 'item', id: worn.id })
                    } else if (active) {
                      clearGearSlot()
                    } else {
                      activateGearSlot(hero.id, hs)
                    }
                  }}
                  title={HERO_SLOT_LABEL[hs]}
                >
                  <span className="sh-slot-label">{HERO_SLOT_LABEL[hs]}</span>
                  <span className="sh-slot-mark">{worn ? '◆' : active ? '…' : '+'}</span>
                </button>
              )
            })
          : null}
      </div>
    </div>
  )
}

function PackColumn() {
  const inventory = useGameStore((s) => s.inventory)
  const gearSlot = useGameStore((s) => s.gearSlot)
  const selection = useGameStore((s) => s.shellSelection)
  const shellSelect = useGameStore((s) => s.shellSelect)
  const equipItem = useGameStore((s) => s.equipItem)
  const clearGearSlot = useGameStore((s) => s.clearGearSlot)

  // With a gear slot armed the pack filters to what fits it — that replaces the
  // whole equip drawer.
  const fits = (i: Item) => !gearSlot || heroSlotsFor(i.slot).includes(gearSlot.slot)
  const shown = inventory.filter(fits)

  return (
    <div className={`sh-pack ${gearSlot ? 'filtering' : ''}`}>
      <div className="sh-col-head">
        <span>PACK</span>
        <span className="sh-col-count">
          {shown.length}/{inventory.length}
        </span>
      </div>
      <div className="sh-pack-grid">
        {shown.map((i) => (
          <button
            key={i.id}
            className={`sh-tile ${selection?.kind === 'item' && selection.id === i.id ? 'selected' : ''}`}
            style={{ '--rail': RARITY[i.rarity].color } as CSSProperties}
            title={i.name}
            onClick={() => {
              if (gearSlot && heroSlotsFor(i.slot).includes(gearSlot.slot)) {
                equipItem(gearSlot.sentinelId, gearSlot.slot, i.id)
                clearGearSlot()
              } else {
                shellSelect({ kind: 'item', id: i.id })
              }
            }}
          >
            <span className="sh-tile-glyph">{KIND_GLYPH[i.slot] ?? '◆'}</span>
          </button>
        ))}
        {shown.length === 0 && <span className="sh-pack-empty">{gearSlot ? 'Nothing fits' : 'Empty'}</span>}
      </div>
    </div>
  )
}

const KIND_GLYPH: Record<string, string> = {
  oneHand: '⚔',
  twoHand: '⚒',
  offHand: '⛊',
  body: '⛨',
}

function findItem(inventory: Item[], roster: Sentinel[], id: string): Item | undefined {
  const loose = inventory.find((i) => i.id === id)
  if (loose) return loose
  for (const s of roster) {
    for (const hs of HERO_SLOTS) {
      const it = s.equipment[hs]
      if (it?.id === id) return it
    }
  }
  return undefined
}
