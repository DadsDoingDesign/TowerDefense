import { useState, type CSSProperties } from 'react'
import { itemIcon, itemName, moneyText, RARITY_INITIAL, railStyle, rarityTextVar, rarityVar } from '../channels'
import { skillLevelLabel } from '../../game/data/skills'
import { BUMP_AMOUNT } from '../../game/data/skills'
import type { Sentinel } from '../../game/types'
import { useGameStore } from '../../state/gameStore'
import { gearLocked } from '../../state/game/selectors'
import { Icon } from '../Icon'
import { LevelUpPanel } from './LevelUpPanel'
import { Money } from './Money'
import { PickCard, PickStrip, stepId, type PickFact, type PickTokenSpec } from './PickStrip'
import { heroUpgrades, type HeroUpgrade } from './heroCardModel'
import { levelUpOpen, takeUp, useLevelUps, waveLive } from './levelUps'

/**
 * Open the focused hero's Upgrade panel (the action bar's Upgrade button, or
 * the owed slot on its card): the hero is read, not armed, and the band opens
 * on a portrait field. A choice the player put off ("Later") opens again.
 */
export function openUpgrade(heroId: string): void {
  takeUp(heroId)
  useGameStore.setState({
    shellSelection: { kind: 'hero', id: heroId },
    heroTab: 'upgrade',
    selectedSentinelId: null,
    gearSlot: null,
    detailOpen: true,
  })
}

/** Back to the hero's card. */
const toCard = () => useGameStore.setState({ heroTab: 'card' })

/**
 * What the hero can upgrade, what it costs, and what changes (the battle band,
 * Oct 2026; the designer: "reconsider … how to upgrade. Maybe upgrade is
 * another button that appears in the bottom").
 *
 * A hero grows two ways between rounds, and this panel is both:
 *
 *  - **A skill choice** at levels 5, 10 and 15 — free, and the biggest change
 *    a hero makes. While one is owed it IS the panel: the existing pick of
 *    three skills or a stat boost (`LevelUpPanel`, before → after on its
 *    card), until it is made or put off.
 *  - **Raising a worn piece** one rarity tier, for gold from the purse — the
 *    same `upgradeItem` the item's own panel offers, gathered here by hero.
 *
 * Pick one, then read (DESIGN_SYSTEM § 8 rule 5): every option is a token in
 * one `PickStrip`; the focused one's `PickCard` says what it costs and what
 * moves, before → after — DPS first, then each number the raise changes, the
 * tier, and the purse. Only the certain half of a raise is shown (the scaled
 * base, `items.raisedBase`); the new enchantment is rolled when it lands, so
 * the card says one is coming and no more. The commit is the panel's own
 * button, secondary in weight: Start Wave stays the screen's one primary.
 */
export function UpgradePanel({ hero }: { hero: Sentinel }) {
  const live = useGameStore(waveLive)
  const later = useLevelUps((s) => s.later)
  if (levelUpOpen(hero) && !live && !later[hero.id]) return <LevelUpPanel hero={hero} onDone={toCard} />
  return <UpgradeList hero={hero} />
}

function UpgradeList({ hero }: { hero: Sentinel }) {
  const gold = useGameStore((s) => s.gold)
  const upgradeItem = useGameStore((s) => s.upgradeItem)
  const locked = useGameStore(gearLocked)
  const live = useGameStore(waveLive)
  const ups = heroUpgrades(hero, gold)
  const [focusId, setFocus] = useState<string | null>(ups[0]?.id ?? null)
  const focused = ups.find((u) => u.id === focusId) ?? ups[0]

  const tokens: PickTokenSpec[] = ups.map((u) =>
    u.kind === 'skill'
      ? { id: u.id, art: <Icon name="boon" lg />, label: 'Skill', value: 'Free', name: `A ${skillLevelLabel(u.milestone.tier)} skill to choose, free` }
      : {
          id: u.id,
          art: <Icon name={itemIcon(u.item)} lg />,
          label: `${RARITY_INITIAL[u.item.rarity]}→${u.to[0]}`,
          value: <Money amount={u.cost} c="gold" />,
          name: `Raise ${itemName(u.item)} from ${u.from} to ${u.to}, ${moneyText(u.cost, 'gold')}${u.afford ? '' : `, ${moneyText(u.short, 'gold')} short`}`,
          state: u.afford ? undefined : 'unavailable',
          warn: !u.afford,
          rail: rarityVar(u.item.rarity),
        },
  )

  return (
    <div className="sh-context sh-upg-panel" role="group" aria-labelledby="sh-upg-head">
      <div className="sh-context-head">
        <strong id="sh-upg-head">Upgrade {hero.name}</strong>
        <span className="sh-context-sub">
          Purse <Money amount={gold} c="gold" />
        </span>
      </div>
      <div className="sh-context-body">
        {!focused ? (
          <p className="sh-line muted">Nothing to raise: {hero.name}&rsquo;s gear is all at the top tier, or there is none.</p>
        ) : (
          <div className="pk compact">
            <PickStrip label={`What ${hero.name} can upgrade`} tokens={tokens} focused={focused.id} onFocus={setFocus} />
            <UpgradeCard
              up={focused}
              hero={hero}
              gold={gold}
              index={ups.indexOf(focused)}
              count={ups.length}
              onStep={(d) => setFocus(stepId(ups, focused.id, d))}
            />
          </div>
        )}
      </div>
      <div className="sh-context-foot sh-lvl-foot">
        <button className="sh-btn" data-sfx="toggle" onClick={toCard}>
          Back
        </button>
        {focused?.kind === 'skill' ? (
          <button className="sh-btn sh-commit-2" disabled={live} onClick={() => takeUp(hero.id)}>
            {live ? 'After this wave' : 'Choose a skill'}
          </button>
        ) : focused?.kind === 'raise' ? (
          <button
            className="sh-btn sh-commit-2"
            disabled={!focused.afford || locked}
            aria-label={
              locked
                ? 'Gear locks during a wave'
                : `Raise ${itemName(focused.item)} to ${focused.to} for ${moneyText(focused.cost, 'gold')}${focused.afford ? '' : ` — ${moneyText(focused.short, 'gold')} short`}`
            }
            onClick={() => upgradeItem(focused.item.id)}
          >
            {locked ? 'Locked in a wave' : focused.afford ? (
              <>
                Raise · <Money amount={focused.cost} c="gold" />
              </>
            ) : (
              <>
                Need <Money amount={focused.short} c="gold" /> more
              </>
            )}
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** The focused option's card: what it is, and its before → after. */
function UpgradeCard({ up, hero, gold, index, count, onStep }: { up: HeroUpgrade; hero: Sentinel; gold: number; index: number; count: number; onStep: (d: number) => void }) {
  if (up.kind === 'skill') {
    const m = up.milestone
    return (
      <PickCard kicker={`Level ${m.level} · free`} name={`A ${skillLevelLabel(m.tier)} skill`} index={index} count={count} onStep={onStep} noun="upgrade">
        <p className="pk-does">
          One of three {skillLevelLabel(m.tier)} skills, or +{BUMP_AMOUNT[m.tier]} to one stat. {hero.name} holds up to three.
        </p>
      </PickCard>
    )
  }
  // Before → after, the hero's numbers first (DPS leads), then the tier — at
  // most three boxes, so each reads on one line on a phone. The price and the
  // purse after it are the line under them.
  const facts: PickFact[] = [
    ...up.deltas.slice(0, 2).map((d) => ({ label: d.label, value: `${d.a} → ${d.b}`, tone: d.after > d.before ? ('good' as const) : ('bad' as const) })),
    { label: 'Tier', value: `${up.from} → ${up.to}`, tone: 'accent' },
  ]
  return (
    <PickCard
      kicker={`Raise · ${up.slotLabel}`}
      name={<span style={{ color: rarityTextVar(up.item.rarity) }}>{itemName(up.item)}</span>}
      index={index}
      count={count}
      onStep={onStep}
      facts={facts}
      noun="upgrade"
      style={railStyle(rarityVar(up.item.rarity)) as CSSProperties}
    >
      <p className={`sh-line sh-upg-cost${up.afford ? '' : ' bad'}`}>
        Costs <Money amount={up.cost} c="gold" /> · purse <Money amount={gold} c="gold" /> →{' '}
        <Money amount={Math.max(0, gold - up.cost)} c="gold" />
      </p>
      {up.adds > 0 && (
        <p className="sh-line note">
          +{up.adds} enchantment{up.adds === 1 ? '' : 's'}, rolled when it lands.
        </p>
      )}
    </PickCard>
  )
}
