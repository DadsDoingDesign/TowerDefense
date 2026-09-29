import { useEffect, useState, type CSSProperties } from 'react'
import {
  canUpgrade,
  HERO_SLOTS,
  HERO_SLOT_LABEL,
  RARITY,
  heroSlotsFor,
  reforgeCost,
  reforgeDust,
  upgradeCost,
  upgradeDust,
} from '../../game/data/items'
// `describeBase` / `describeEnchant` are no longer imported here: the item
// panel renders `itemBody` (offers.ts), which is the ONE producer of an item's
// lines for all four surfaces (M4). Rebuilding them locally is what let the
// curse mark reach exactly one of them.
import { describeMods, STACKING_RULES } from '../../game/data/describe'
import { mutationName } from '../../game/data/mutations'
import { childrenOf } from '../../game/data/archetypeTree'
import { ENEMY_MODS, ENEMY_TYPES } from '../../game/data/enemies'
import { variantsFor, waveComposition } from '../../game/data/waves'
import { UPGRADE_PATHS, milestoneForLevel } from '../../game/data/upgradeTree'
import { computeCombat, effectiveUpgradeLevels, totalStats } from '../../game/engine/combat'
import { buildName, evolutionOptions, MAX_LEVEL, TIER1_LEVEL, TIER2_LEVEL } from '../../game/engine/leveling'
import type { Item, Sentinel } from '../../game/types'
import { canStartWave, scrapDust, scrapGold, useGameStore, type HeroTab } from '../../state/gameStore'
import {
  archetypeVar,
  damageMark,
  effectIcon,
  FOCUS_OPTS,
  focusFull,
  itemIcon,
  itemName,
  markLabel,
  moneyText,
  RARITY_INITIAL,
  rarityRank,
  rarityVar,
  type IconKey,
} from '../channels'
import { Icon } from '../Icon'
import { Money } from './Money'
import { NodePreviewPanel } from './NodePreview'
import { useMapFocus } from './mapFocus'
import { itemBody, lineMark, lineText, lineTone, type Offer } from './offers'
import { RarityTag } from './Page'
import { useArmedAction } from './PageScreens'

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
      {/* The battle's action bar is a SIBLING of the context panel, not one of
          its states, and it spans the whole band — see `.sh-wavebar` in
          shell.css for what that fixes and what it costs. */}
      <WaveBar />
    </section>
  )
}

/* --------------------------------------------------------- battle action bar */

/**
 * What to do next, and the control that does it — on screen for every frame of
 * a battle, whatever is selected (C4).
 *
 * The defect this replaces: "Start Wave" and the deploy instruction lived only
 * inside `EmptyPanel`, the panel's nothing-selected state. Tapping a hero — the
 * exact thing that same panel told you to do — removed the primary action of
 * the whole game, and deploying that hero did not bring it back. The only way
 * to see it again was to tap the hero card a second time to deselect, which
 * nothing anywhere teaches. Measured live before the change: entry → present
 * but disabled; tap hero → absent; tap slot, hero deployed → still absent.
 *
 * Every branch asks the STORE what it will do rather than guessing:
 * `canStartWave` is the same predicate `startWave` honours, so this can never
 * render an enabled action the store then refuses. The deployment gate below is
 * a stricter rule laid on top of it, which is allowed; nothing here relaxes it.
 */
function WaveBar() {
  const screen = useGameStore((s) => s.screen)
  const runPhase = useGameStore((s) => s.runPhase)
  const battlePhase = useGameStore((s) => s.battlePhase)
  const hasEngine = useGameStore((s) => !!s.engine)
  const lastResult = useGameStore((s) => s.lastResult)
  const currentWave = useGameStore((s) => s.currentWave)
  const hud = useGameStore((s) => s.hud)
  const roster = useGameStore((s) => s.roster)
  const placements = useGameStore((s) => s.placements)
  const startWave = useGameStore((s) => s.startWave)
  const continueAfterWave = useGameStore((s) => s.continueAfterWave)
  const speed = useGameStore((s) => s.speed)
  const setSpeed = useGameStore((s) => s.setSpeed)
  const canStart = useGameStore(canStartWave)
  const waveBeat = useGameStore((s) => s.waveBeat)

  if (screen !== 'battle' || runPhase !== 'active') return null

  // The wave-clear beat (H18). It comes before every other branch because for
  // its ~0.9s it IS the state of the battle.
  if (waveBeat) return <WaveBeatBar status={waveBeat.status} />

  // A settled wave. `battlePhase` is a label and the engine is the fact, so a
  // stale 'battle' with no engine still reads as finished.
  if (lastResult && (battlePhase !== 'battle' || !hasEngine)) {
    return (
      <div className="sh-wavebar">
        {/*
         * The one live region for "the wave ended" (F9).
         *
         * A screen-reader user got no signal at all before: the field simply
         * stopped, the panel swapped its contents, and nothing was announced.
         * The coach strip already had this right (`Coach.tsx`, `role="status"
         * aria-live="polite"`) and this matches it.
         *
         * It goes HERE and not on the result panel below, even though the panel
         * carries more detail, because the panel is one of several states of
         * the context column — select a hero and it is the hero's panel
         * instead, and a live region that only fires when nothing happens to be
         * selected is not a signal. `WaveBar` renders for every frame of a
         * battle whatever is selected, so this line is the one that is always
         * there to change. One region, not two: the panel says the same
         * headline in different words, and two polite regions firing on the
         * same tick queue up and read as one long garbled sentence.
         */}
        <p className="sh-wavebar-hint ready" role="status" aria-live="polite">
          {lastResult.status === 'cleared' ? 'Wave cleared' : 'Wave lost'} · <Money amount={lastResult.goldEarned} c="gold" />{' '}
          earned
        </p>
        <button className="sh-btn primary" onClick={continueAfterWave}>
          Continue
        </button>
      </div>
    )
  }

  if (battlePhase === 'battle' && hasEngine) {
    const left = hud.enemiesTotal - hud.enemiesSpawned + hud.enemiesAlive
    const total = hud.enemiesTotal || currentWave?.spawns.length || 0
    const killed = Math.max(0, hud.enemiesSpawned - hud.enemiesAlive)
    return (
      <div className="sh-wavebar">
        {/*
         * The live wave's readout, moved down out of the Stage (M1).
         *
         * This was `.sh-wave-strip`, an absolutely-positioned scrim across the
         * top of the battlefield — and because it carried a 44px speed toggle it
         * was 54–62px of it, covering up to 40.4% of the composed field and, on
         * four of the ten viewport × UI-scale cells, a build slot the player is
         * being told to tap. See `StageBand` for the measurements.
         *
         * It belongs here on the merits anyway. `WaveBar` renders for every
         * frame of a battle whatever is selected, it already holds the band's
         * height open across the setup → battle → settled transitions, and the
         * speed toggle is an ACTION — every other action in the shell is in
         * band 4. The strip was the only control anywhere in the game that lived
         * on top of the subject.
         */}
        <p className="sh-wavebar-live">
          <span className="sh-wavebar-live-name">{currentWave?.label ?? 'Wave'}</span>
          {/* The bar is decoration over a count that is already in words right
              beside it, so it is hidden rather than given a `progressbar` role
              that would read out again on every kill. */}
          <span className="sh-wave-bar" aria-hidden="true">
            <span className="sh-wave-fill" style={{ width: `${total ? (killed / total) * 100 : 0}%` }} />
          </span>
          <span className="sh-wavebar-left">
            <b>{Math.max(0, left)}</b> left
          </span>
        </p>
        {/* A visible word, not just "1×" (Wave 1): a bare multiplier in a box
            read as a score, not as a control. */}
        <button
          className="sh-speed"
          data-sfx="toggle"
          onClick={() => setSpeed(speed === 3 ? 1 : ((speed + 1) as 1 | 2 | 3))}
          aria-label={`Battle speed ${speed}× — tap to change`}
        >
          <span className="sh-speed-word">Speed</span>
          <span className="sh-speed-val">{speed}×</span>
        </button>
      </div>
    )
  }

  // Setup, but the store will not fight this ground: the node is already
  // settled or the wave rehydrated as null. Offering Start Wave here is exactly
  // the soft-lock `canStartWave` exists to kill; the honest control leaves — and
  // because the bar is not a panel state, that exit now survives a selection.
  if (!canStart) {
    // No hint line here: `StrandedPanel` directly above is already saying why,
    // and the bar repeating it word for word read as a rendering bug. `solo`
    // lets the button take the whole width it would otherwise leave empty.
    return (
      <div className="sh-wavebar solo">
        <button className="sh-btn primary" onClick={continueAfterWave}>
          March on
        </button>
      </div>
    )
  }

  const deployed = roster.filter((h) => Object.values(placements).includes(h.id)).length
  return (
    <div className="sh-wavebar">
      <p className={`sh-wavebar-hint ${deployed ? 'ready' : ''}`}>
        {deployed
          ? `${deployed} posted. Tap a circle to move a hero, or start the wave.`
          : 'Tap your hero, then a glowing circle on the field.'}
      </p>
      <button className="sh-btn primary" disabled={deployed === 0} onClick={startWave}>
        Start Wave ▶
      </button>
    </div>
  )
}

/**
 * The visible half of the wave-clear beat (H18).
 *
 * The sting is the sound of it; this is the same news in words and colour,
 * because audio is never allowed to be the only channel for anything here.
 *
 * Deliberately NOT a live region. `WaveBar`'s settled state owns the one polite
 * announcement for "the wave ended" and says more than this does (it carries
 * the gold), and it arrives 0.9s later — two regions firing on the same news
 * queue up and read as one garbled sentence, which is exactly the trap the
 * existing note in this file warns about. A screen-reader user loses nothing:
 * they get the sting immediately and the fuller sentence a beat later.
 *
 * Focus is deliberately not moved either. Any key settles the beat, so the
 * button is an affordance rather than the only way through, and stealing focus
 * from wherever the player left it would be worse than not having it.
 */
function WaveBeatBar({ status }: { status: 'cleared' | 'defeated' }) {
  const skipWaveBeat = useGameStore((s) => s.skipWaveBeat)
  useEffect(() => {
    // Capture phase and `pointerdown`: the beat should end on the press, before
    // whatever was under the finger gets a chance to act on it.
    const skip = () => skipWaveBeat()
    document.addEventListener('pointerdown', skip, { capture: true })
    document.addEventListener('keydown', skip)
    return () => {
      document.removeEventListener('pointerdown', skip, { capture: true })
      document.removeEventListener('keydown', skip)
    }
  }, [skipWaveBeat])

  const won = status === 'cleared'
  return (
    <div className={`sh-wavebar sh-beat ${won ? 'won' : 'lost'}`}>
      <p className="sh-wavebar-hint ready">
        <Icon name={won ? 'wave' : 'warn'} /> {won ? 'Wave cleared' : 'The line broke'}
      </p>
      <button className="sh-btn primary" data-sfx="none" onClick={() => skipWaveBeat()}>
        {won ? 'Collect' : 'Go on'}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------ context panel */

/**
 * A battle the store will not let anyone fight, and which has not been fought:
 * no engine running, no result to read, and `canStartWave` saying no.
 *
 * That is the shape of every incoherent resume — a node already in
 * `clearedNodeIds`, a null `currentWave`, a v1 payload whose battle was settled
 * before the snapshot was written. There is nothing to do on the field and
 * nothing else in the four bands that leaves it, so the way out takes the
 * context panel whatever happens to be selected. (Selection alone is not a
 * trap — `shellSelect` toggles off on a second tap — but "tap the same hero
 * again to find the only exit" is not an exit anyone finds.)
 */
const strandedInBattle = (s: Parameters<typeof canStartWave>[0]): boolean =>
  s.screen === 'battle' && s.runPhase === 'active' && !s.engine && !s.lastResult && !canStartWave(s)

function ContextPanel({ offers }: { offers: Offer[] }) {
  const selection = useGameStore((s) => s.shellSelection)
  const roster = useGameStore((s) => s.roster)
  const inventory = useGameStore((s) => s.inventory)
  const gearSlot = useGameStore((s) => s.gearSlot)
  const stranded = useGameStore(strandedInBattle)
  const screen = useGameStore((s) => s.screen)
  const focusedNode = useMapFocus((s) => s.nodeId)

  if (stranded) return <StrandedPanel />
  // A focused map node takes the panel whatever else is selected: it is the
  // decision in front of the player, and it must be readable BEFORE the march
  // is committed (Wave 1).
  if (screen === 'map' && focusedNode) return <NodePreviewPanel nodeId={focusedNode} />
  // An armed gear slot with nothing selected is the one moment the next tap
  // equips something in ONE action — `PackColumn` calls `equipItem` straight
  // off the tile — so it is the only moment a two-hand ejection can be warned
  // about before it happens (M26).
  if (gearSlot && !selection) return <GearSlotPanel />
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
 * With nothing selected the panel READS the context. It no longer carries the
 * battle's primary action: a control that exists only while nothing is selected
 * is a control the player loses the instant they follow an instruction, which
 * is precisely what C4 was. `WaveBar` owns every battle action now,
 * unconditionally, and this panel is free to be information.
 */
function EmptyPanel({ hasOffers }: { hasOffers: boolean }) {
  const screen = useGameStore((s) => s.screen)
  const battlePhase = useGameStore((s) => s.battlePhase)
  const currentWave = useGameStore((s) => s.currentWave)
  const lastResult = useGameStore((s) => s.lastResult)
  const lastLoot = useGameStore((s) => s.lastLoot)
  const runPhase = useGameStore((s) => s.runPhase)
  const hasEngine = useGameStore((s) => !!s.engine)
  /*
   * Still the store's own predicate, not a second opinion about it — the
   * stranded branch below has to agree with the bar about whether this ground
   * can be fought, or the panel would describe a wave the bar refuses to start.
   */
  const canStart = useGameStore(canStartWave)

  // A finished run is never in the four-band layout — `useShellContext` sends it
  // to `ResultScreen`, which owns the only run-end copy in the shell.
  if (screen === 'battle' && runPhase === 'active') {
    // A result with no engine left counts as settled however `battlePhase`
    // reads: the phase is a label, the engine is the fact.
    if (lastResult && (battlePhase !== 'battle' || !hasEngine)) {
      return (
        // Not a second live region — see the note in `WaveBar`, which owns the
        // announcement. A labelled group instead, so the user who has just
        // heard "Wave cleared" can find the numbers behind it as one named
        // region rather than as loose text in the middle of the band (F9).
        <div className="sh-context" role="group" aria-labelledby="sh-waveresult-head">
          <div className="sh-context-head">
            <strong id="sh-waveresult-head">
              {lastResult.status === 'cleared' ? 'Wave cleared' : 'Wave lost'}
            </strong>
          </div>
          <div className="sh-context-body">
            <p className="sh-line">
              <Money amount={lastResult.goldEarned} c="gold" /> earned · {lastResult.enemiesKilled} felled
            </p>
            {/* `enemiesLeaked` is the HEAD COUNT; `leaks` (now `leakDamage`)
                always was base-HP damage, and rendering it after the words
                "reached the line" reported 6 enemies where 2 had got through
                and taken 6 off the base. `baseHpLeft` arrives whole and
                already clamped from the engine now, so the old
                `Math.max(0, Math.ceil(...))` wrapper is gone too — the
                double-rounding was the other half of a receipt that could not
                be made to add up (F2). */}
            <p className="sh-line muted">
              {lastResult.enemiesLeaked} reached the Gate · Gate {lastResult.baseHpLeft} left
            </p>
            {/* Loot dropped by the wave. It lands in the pack silently in the
                shell — only the legacy `ResultOverlay` ever named it — so an
                Endless boss round's triple drop was three tiles that appeared
                out of nowhere (M6). */}
            {lastLoot.length > 0 && (
              <p className="sh-line accent">
                <Icon name="loot" /> Found:{' '}
                {lastLoot.map((i) => `${itemName(i)} (${RARITY[i.rarity].label})`).join(', ')}
              </p>
            )}
            {/* Per-Sentinel kills, damage and XP are computed by the engine for
                every wave and were discarded on every wave (M6). Without them
                nothing tells you which posting worked — the whole feedback loop
                of a tower-defence setup phase. */}
            <BattleRoll result={lastResult} />
          </div>
        </div>
      )
    }

    if (battlePhase === 'battle' && hasEngine) {
      /*
       * The live count lives in ONE place now: the WaveBar (Wave 1). It was on
       * screen three times at once — the header's "LIVE · 16 LEFT" (which
       * wrapped), a "Cleared 4/20" meter here, and the WaveBar's "16 left" — and
       * three readouts of one number ticking on every kill is noise, not
       * information. This panel shows what the wave IS instead.
       */
      return (
        <div className="sh-context">
          <div className="sh-context-head">
            <strong>{currentWave?.label ?? 'Wave'}</strong>
          </div>
          <div className="sh-context-body">
            <WaveComposition />
            <p className="sh-line muted">Tap a hero for its detail.</p>
          </div>
        </div>
      )
    }

    if (!canStart) return <StrandedPanel />

    return (
      <div className="sh-context">
        <div className="sh-context-head">
          <strong>{currentWave?.label ?? 'Encounter'}</strong>
          <span className="sh-context-sub">{currentWave?.spawns.length ?? 0} enemies</span>
        </div>
        <div className="sh-context-body">
          <WaveComposition />
          <p className="sh-line muted">
            Post heroes on the glowing circles. Each reaches only what walks inside its ring.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="sh-context empty">
      <p className="sh-empty-hint">
        {hasOffers ? 'Tap an offer to see what it does.' : screen === 'map' ? 'Tap a stop on the map to see what waits there.' : 'Tap a hero to see its detail.'}
      </p>
    </div>
  )
}

/**
 * "You are choosing a Main hand for Marek", and what that will cost the slot
 * next to it (M26).
 *
 * The pack filters to what fits an armed slot and equips on the first tap, so
 * before this panel there was no surface at all between arming a slot and a
 * two-handed weapon silently ejecting the off-hand. The item goes back to the
 * pack rather than being destroyed, so this is a warning rather than a confirm
 * — what was wrong was that it happened with no word anywhere.
 */
function GearSlotPanel() {
  const gearSlot = useGameStore((s) => s.gearSlot)
  const roster = useGameStore((s) => s.roster)
  const clearGearSlot = useGameStore((s) => s.clearGearSlot)
  const hero = roster.find((h) => h.id === gearSlot?.sentinelId)
  if (!gearSlot || !hero) return null

  const offHand = hero.equipment.offHand
  const mainHand = hero.equipment.mainHand
  const warn =
    gearSlot.slot === 'mainHand' && offHand
      ? `A two-handed weapon needs both hands — it would put ${offHand.name} back in the pack. A one-hander leaves it where it is.`
      : gearSlot.slot === 'offHand' && mainHand?.slot === 'twoHand'
        ? `${hero.name} is holding ${mainHand.name} with both hands — filling this slot puts it back in the pack.`
        : null

  return (
    <div className="sh-context">
      <div className="sh-context-head">
        <strong>{HERO_SLOT_LABEL[gearSlot.slot]}</strong>
        <span className="sh-context-sub">{hero.name}</span>
      </div>
      <div className="sh-context-body">
        <p className="sh-line muted">The pack is showing only what fits. Tap one to put it on.</p>
        {warn && (
          <p className="sh-line bad">
            <Icon name="warn" /> {warn}
          </p>
        )}
      </div>
      <div className="sh-context-foot">
        <button className="sh-btn" onClick={clearGearSlot}>
          Never mind
        </button>
      </div>
    </div>
  )
}

/**
 * Every variant's `asks` line, by the label the wave carries.
 *
 * `WaveVariant.asks` is one authored sentence saying what a shape ASKS FOR —
 * "physical bounces off it — bring magic", "lightly armoured and 40% faster — a
 * coverage problem, not a damage one" — and it was rendered nowhere in the
 * game. The variant is not on `WaveDef`; what survives generation is the label,
 * and `defaultLabel` composes it by appending `variant.label` (so "Depth 4 —
 * Bombard", "Elite — Swift Raid", "Wave 15 — Elite · Plated Column"). Every
 * variant label across the three pools is distinct, so matching the tail of the
 * wave's label recovers the variant exactly, without reaching into the data
 * layer to add a field. `variantsFor(kind, LATE)` returns whole pools because
 * the only filter is `minDepth`.
 */
const VARIANT_ASKS: Map<string, string> = new Map(
  (['normal', 'elite', 'boss'] as const)
    .flatMap((k) => [...variantsFor(k, 999)])
    .filter((v) => v.label)
    .map((v) => [v.label, v.asks]),
)

const asksFor = (label: string): string | null => {
  for (const [name, asks] of VARIANT_ASKS) if (label.endsWith(name)) return asks
  return null
}

/**
 * What is actually coming, by name and by count — and what it shrugs off (M6).
 *
 * The shell said "12 enemies" and stopped there. The legacy `WavePreview` has
 * always shown the roster; the shell dropped it, and with it the only way to
 * counter-pick a wave. Worse, the game's central tactical axis was never shown
 * ANYWHERE: TNT goblins resist magic and barrel goblins resist physical — with
 * `ENEMY_MODS` on top, anywhere from 5% to the 55% `RESIST_CAP` — which is the
 * entire point of an elite's armour column and the entire reason a mystic and a
 * rogue are different answers, and a player could only learn it by osmosis.
 * Both are read straight off `ENEMY_TYPES`.
 *
 * Threat rides here too: it multiplies every one of these enemies' HP, and the
 * header chip's `×1.42` never said what it multiplied.
 */
function WaveComposition() {
  const wave = useGameStore((s) => s.currentWave)
  const mode = useGameStore((s) => s.mode)
  const threat = useGameStore((s) => s.threat)
  const battleMap = useGameStore((s) => s.battleMap)
  if (!wave) return null
  const comp = waveComposition(wave).sort((a, b) => b.count - a.count)
  const showThreat = mode === 'campaign' && threat > 1.001
  const asks = asksFor(wave.label)

  return (
    <>
      {/*
       * The ground, named. `GameMap.name` — "The Green Line", "The Kiln Road" —
       * has been carried on both maps since the maps existed and printed
       * nowhere: which map a run draws is the most visible piece of input
       * randomness in the game (different lane, different slots, different
       * counter-picks) and it was announced by the pixels and by nothing else.
       */}
      <p className="sh-line muted sh-comp-ground">{battleMap.name}</p>
      {/*
       * What the shape asks for. This is the whole disclosure for Swift Raid,
       * which had none: its modifier is `physKeep 0.5 / magKeep 0.5` over a
       * torch goblin's zero base resist, so both resists come out ZERO, and the
       * rows below only print a chip for a truthy number. The one variant whose
       * entire content is a COVERAGE problem looked identical to a plain wave.
       */}
      {asks && <p className="sh-line">{asks}</p>}
      {showThreat && (
        <p className="sh-line accent">
          <Icon name="threat" /> Threat ×{threat.toFixed(2)}: every enemy below has {Math.round((threat - 1) * 100)}% more HP.
        </p>
      )}
      <div className="sh-comp">
        {comp.map(({ typeId, count }) => {
          const t = ENEMY_TYPES[typeId]
          if (!t) return null
          // No minus signs: "resists −15% magic" reads as a penalty to the
          // resistance rather than to your damage. Say the damage type and how
          // much of it bounces.
          const resists: string[] = []
          if (t.physResist) resists.push(`physical ${Math.round(t.physResist * 100)}%`)
          if (t.magResist) resists.push(`magic ${Math.round(t.magResist * 100)}%`)
          /*
           * A modifier that grants no resistance still changes the fight, and
           * `EnemyMod.blurb` is the authored sentence for exactly that — and it
           * was rendered nowhere in the game.
           *
           * The condition is on the MODIFIER, not on whether this particular
           * enemy happens to have a resist chip. `swift` is the whole point:
           * `physKeep 0.5 / magKeep 0.5` and no resist of its own, so a Swift
           * Torch Goblin (zero base resist) showed nothing at all, and a Swift
           * Bomber showed "shrugs off magic 8%" — its halved BASE resist, with
           * the 40% speed that is the actual threat left unsaid. For `plated`
           * and `warded` the blurb and the numbers say the same thing and the
           * numbers say it better, so those keep the chip alone.
           */
          const mod = ENEMY_MODS.find((m) => typeId.endsWith(`_${m.id}`) && !m.physResist && !m.magResist)
          const note = [resists.length > 0 ? `shrugs off ${resists.join(' · ')}` : '', mod?.blurb ?? '']
            .filter(Boolean)
            .join(' · ')
          return (
            <div className="sh-comp-row" key={typeId}>
              <span className="sh-comp-name">
                {/* The skull was `aria-hidden` with no label anywhere near it
                    and `t.name` never contains the word, so a screen-reader
                    user was never told a boss was coming — the icon was the
                    only channel (M11). A visible tag rather than a hidden one:
                    the picture is small, red on a dark row and easy to miss
                    with working eyes too. `.sh-comp-name` is a COLUMN, so the
                    mark and the word have to share a wrapper to sit together
                    on one line. */}
                {t.isBoss && (
                  <span className="sh-comp-tag">
                    <Icon name="boss" className="sh-comp-boss" />
                    Boss
                  </span>
                )}
                {t.name}
                {/* The label used to end "…of the damage it takes", which is a
                    universal claim the engine does not honour: `execute`
                    returns before `damageEnemy` and bypasses resistance
                    entirely, so the screen-reader version was the stronger and
                    falser of the two. It now says exactly what the visible text
                    says, with the separator spelled. */}
                {note && (
                  <span
                    className="sh-comp-res"
                    aria-label={[resists.length > 0 ? `shrugs off ${resists.join(' and ')}` : '', mod?.blurb ?? '']
                      .filter(Boolean)
                      .join(', ')}
                  >
                    {note}
                  </span>
                )}
              </span>
              <span className="sh-comp-count">×{count}</span>
            </div>
          )
        })}
      </div>
    </>
  )
}

/** Who did what, last wave. Sorted by damage so the answer leads. */
function BattleRoll({ result }: { result: { perSentinel: { id: string; kills: number; damageDealt: number; xpGained: number; downed: boolean }[] } }) {
  const roster = useGameStore((s) => s.roster)
  const rows = [...result.perSentinel].sort((a, b) => b.damageDealt - a.damageDealt)
  if (rows.length === 0) return null
  return (
    <div className="sh-comp">
      {rows.map((r) => {
        const hero = roster.find((h) => h.id === r.id)
        return (
          <div className={`sh-comp-row ${r.downed ? 'downed' : ''}`} key={r.id}>
            <span className="sh-comp-name">
              {hero?.name ?? 'Hero'}
              <span className="sh-comp-res">
                {r.kills} kills · +{Math.round(r.xpGained)} xp{r.downed ? ' · fell' : ''}
              </span>
            </span>
            <span className="sh-comp-count">{Math.round(r.damageDealt)}</span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * The panel half of "there is nothing here to fight". The way OUT is the
 * `WaveBar`'s "March on" — same `continueAfterWave`, so it settles the node and
 * lands on the map (or the endless rooms) properly rather than teleporting out
 * of the run. Moving it there is what makes the exit survive a selection: the
 * old version put the only escape inside a panel any tap could replace.
 */
function StrandedPanel() {
  return (
    <div className="sh-context">
      <div className="sh-context-head">
        <strong>Nothing to fight</strong>
      </div>
      <div className="sh-context-body">
        <p className="sh-line muted">
          This ground is already settled. There is no wave here to take. March on and pick the next stop.
        </p>
      </div>
    </div>
  )
}

function HeroPanel({ hero }: { hero: Sentinel }) {
  const tab = useGameStore((s) => s.heroTab)
  const setHeroTab = useGameStore((s) => s.setHeroTab)
  const placements = useGameStore((s) => s.placements)
  const battlePhase = useGameStore((s) => s.battlePhase)
  const clearSlot = useGameStore((s) => s.clearSlot)
  const shellSelect = useGameStore((s) => s.shellSelect)
  const profile = computeCombat(hero)

  // Undeploy lived on the old upgrade modal's footer; without it here a placed
  // hero can be moved but never taken off the field.
  const slotId = Object.keys(placements).find((id) => placements[id] === hero.id)
  const canUndeploy = !!slotId && battlePhase === 'setup'

  const TABS: { id: HeroTab; label: string }[] = [
    { id: 'stats', label: 'Stats' },
    // "Upgr" was an abbreviation nobody could read aloud. These are the
    // hero's bought skill paths (Wave 1).
    { id: 'upgrades', label: 'Skills' },
    // "Tune" said nothing about scope; these are the whole watch's orders, not
    // this hero's (M20).
    { id: 'tactics', label: 'Team' },
  ]

  return (
    <div className="sh-context">
      <div className="sh-context-head">
        {/* The hue comes from a token, not from `hero.color`'s raw hex, so the
            colour-vision modes in global.css can move it (M34). */}
        <strong style={{ color: archetypeVar(hero.archetype) }}>{hero.name}</strong>
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
      {canUndeploy && (
        <div className="sh-context-foot">
          <button
            className="sh-btn"
            onClick={() => {
              clearSlot(slotId)
              shellSelect(null)
            }}
          >
            Undeploy
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Patience, in the engine's own numbers (`engine.ts`): every 3 s of a wave a
 * hero gains a stack worth +4% to its STR, DEX and INT, up to
 * `3 + floor(patience / 5)` stacks. The stat itself only raises the CAP.
 */
const PATIENCE_INTERVAL_S = 3
const PATIENCE_PER_STACK = 0.04
const patienceCap = (patience: number) => 3 + Math.floor(patience / 5)

function HeroStats({ hero }: { hero: Sentinel }) {
  const p = computeCombat(hero)
  const t = totalStats(hero)
  // `describeMods` — the one function that turns a merged `EffectMods` into
  // sentences. Everything a hero has merged into it (tier-0 kit, both
  // evolutions, every enchantment on its gear, mutations, team keepsakes) lands
  // in `p.mods`.
  const abilities = describeMods(p.mods)
  const options = evolutionOptions(hero)
  const nextEvoLevel = hero.branchPath.length === 1 ? TIER1_LEVEL : hero.branchPath.length === 2 ? TIER2_LEVEL : null
  /*
   * Only a blocker is ever hit (Wave 1). The engine's ONE damage path to a hero
   * is melee from the enemies it is holding (`engine.ts`, `s.blockIds`), and
   * thorns fire on the same enemies — so for a hero with no `block` in its
   * merged mods, HP, armour and thorns are numbers that can never matter, and
   * printing them invited a player to buy armour for an archer. `p.mods` is the
   * fully merged build (gear and mutations included), so a rogue handed a block
   * by some future affix grows the rows back automatically.
   */
  const canBeHit = !!p.mods.block
  const cap = patienceCap(p.patience)

  return (
    <>
      <p className="sh-line muted">
        {buildName(hero)} · Level {hero.level}/{MAX_LEVEL}
      </p>
      {/*
       * One naming for the three stats everywhere: STR / DEX / INT, the words
       * the hero cards, recruit offers and shrine terms already use. This panel
       * said PHY/MAG for the same two numbers.
       *
       * DEX sits under Attack now. It drives attack rate (+2% a point) and crit
       * chance (+0.4% a point) and nothing defensive — it was filed under
       * "Defense", which sent players to it for survivability.
       */}
      <div className="sh-statgrid">
        <Cell
          label="Attack"
          wide
          values={[
            { head: 'STR', full: 'Strength', v: Math.round(t.str) },
            { head: 'DEX', full: 'Dexterity', v: Math.round(t.dex) },
            { head: 'INT', full: 'Intelligence', v: Math.round(t.int) },
          ]}
        />
        <Cell label="Reach" values={[{ head: 'RNG', full: 'Range', v: Math.round(p.range) }]} />
        <Cell
          label="Patience"
          values={[{ head: 'PAT', full: 'Patience', v: Math.round(p.patience) }]}
          info={`Every ${PATIENCE_INTERVAL_S} s of a wave: +${Math.round(PATIENCE_PER_STACK * 100)}% STR, DEX and INT, up to ${cap} times (+${Math.round(cap * PATIENCE_PER_STACK * 100)}%). Every 5 Patience adds one more.`}
        />
        {canBeHit && (
          <Cell
            label="Defence"
            values={[
              { head: 'HP', full: 'Hit points', v: Math.round(p.maxHp) },
              { head: 'ARM', full: 'Armour', v: Math.round(p.physDef) },
            ]}
          />
        )}
        {canBeHit && <Cell label="Thorns" values={[{ head: 'THN', full: 'Thorns', v: Math.round(p.thorns) }]} />}
      </div>
      {!canBeHit && <p className="sh-line muted">Never hit: only heroes that block take damage.</p>}
      <Meter label="Speed" value={`${p.rate.toFixed(1)}/s`} frac={Math.min(1, p.rate / 3)} />
      <Meter label="Crit mult" value={`×${p.critMult.toFixed(1)}`} frac={Math.min(1, (p.critMult - 1) / 2)} />
      <Meter label="Crit chance" value={`${Math.round(p.critChance * 100)}%`} frac={p.critChance} />

      {abilities.length > 0 && (
        <>
          <p className="sh-line muted head">
            Abilities
            {/* The stacking rule is reference, not reading: it answers "does a
                second Burn do anything?" for the player who asks, and it was
                three always-on lines pushing the abilities themselves out of a
                176px column. Behind an ⓘ now (Wave 1). */}
            <InfoToggle label="How effects stack" lines={STACKING_RULES} />
          </p>
          {abilities.map((a) => (
            <EffectLine text={a} bullet key={a} />
          ))}
        </>
      )}

      {/* The evolution choice used to arrive cold: a modal appeared, named three
          branches nobody had heard of, and demanded an irreversible pick (M6). */}
      {options.length > 0 ? (
        <p className="sh-line accent">
          <Icon name="evolve" /> Evolution ready — {options.map((o) => o.name).join(' · ')}
        </p>
      ) : nextEvoLevel ? (
        <p className="sh-line muted">
          <Icon name="evolve" /> Next evolution at level {nextEvoLevel} — {childrenOf(hero.branchPath[hero.branchPath.length - 1]).map((o) => o.name).join(' · ')}
        </p>
      ) : (
        <p className="sh-line muted">
          <Icon name="evolve" /> Fully evolved.
        </p>
      )}

      {(hero.mutations ?? []).map((m) => (
        <p key={m.key} className="sh-line accent">
          <Icon name="mutate" /> {mutationName(m.key, m.name)} — {m.desc}
        </p>
      ))}
    </>
  )
}

/**
 * A labelled stat cell. The label is one short word and each number carries
 * its own three-letter head UNDER it, so no cell label wraps — "ATTACK ·
 * PHY/MAG" broke over two lines in a 77px cell and pushed the bottom row of the
 * grid under the panel's pinned foot, where its numbers were clipped (Wave 1).
 * The unabbreviated name is each number's accessible name.
 */
function Cell({
  label,
  values,
  wide,
  info,
}: {
  label: string
  values: { head: string; full: string; v: number }[]
  wide?: boolean
  /** A one-line explanation behind an ⓘ — `title` does not exist on touch. */
  info?: string
}) {
  return (
    <div className={`sh-cell ${wide ? 'wide' : ''}`}>
      <span className="sh-cell-label">{label}</span>
      {/* The ⓘ sits with the numbers, not the label: in a 77px cell the label
          plus the disc wrapped onto two lines. */}
      <span className="sh-cell-vals">
        {values.map((x) => (
          <span className="sh-cell-val" key={x.head} role="img" aria-label={`${x.full} ${x.v}`}>
            <b aria-hidden="true">{x.v}</b>
            <small aria-hidden="true">{x.head}</small>
          </span>
        ))}
        {info && <InfoToggle label={`What ${label} does`} lines={[info]} />}
      </span>
    </div>
  )
}

/**
 * An ⓘ that opens one or more lines of reference text in place.
 *
 * A disclosure, not a tooltip: a tooltip needs hover, and every device this
 * ships to is a touchscreen. The text renders into a portal-free sibling so it
 * pushes the column down rather than covering it (rule two of the shell: nothing
 * covers anything).
 */
function InfoToggle({ label, lines }: { label: string; lines: readonly string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={`sh-info ${open ? 'on' : ''}`}
        aria-expanded={open}
        aria-label={label}
        data-sfx="toggle"
        onClick={() => setOpen((o) => !o)}
      >
        i
      </button>
      {open && (
        <span className="sh-info-body" role="note">
          {lines.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </span>
      )}
    </>
  )
}

/**
 * One line of generated effect text, with its own mark.
 *
 * `describeMods` / `describeBase` / `describeEnchant` produce every effect
 * sentence in the game and they are read on the hero panel, in item details, on
 * 39 tree nodes, on 11 mutations, on 9 upgrade levels, on 16 reward cards and
 * on 6 shrines. Classifying the OUTPUT (see `effectIcon`) lights all of that
 * with one table and leaves `src/game/data/` untouched.
 *
 * A line the table does not recognise — a pure stat grant, an authored blurb —
 * renders exactly as it did before, with the `·` bullet. There is deliberately
 * no "unknown" icon: a wrong picture is worse than no picture, and the sentence
 * was always the real channel anyway.
 *
 * `mark` overrides the classification where the CALLER knows something the
 * sentence cannot say. There is one such caller: a cursed enchantment. `Reckless
 * — +85% damage, −45% attack speed` classifies to `damage`, which is right for
 * the sentence and misses the point of the item — the fact that decides the
 * purchase is that it is a curse, and no substring of the text carries that.
 * The caller reads `e.id`, so nothing here has to keep a copy of which labels
 * are curses; a hardcoded list of them would be the same defect this pass spent
 * its day on.
 */
function EffectLine({ text, tone, bullet, mark }: { text: string; tone?: string; bullet?: boolean; mark?: IconKey }) {
  const icon = mark ?? effectIcon(text)
  return (
    <p className={`sh-line ${tone ?? ''} ${icon ? 'iconed' : ''}`}>
      {icon ? <Icon name={icon} /> : bullet ? '· ' : null}
      {text}
    </p>
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

/**
 * The three upgrade paths — and what each next level actually does (M6 / M18).
 *
 * The whole panel was "Onslaught  ●●○  [L3 · ⟡180]". Every level in the tree
 * carries a `desc`, and every level past the first carries a real `downside`
 * ("−12% attack speed", "−14% damage per hit", "−8% range") that the engine
 * applies — so 180 gold bought a stat change the player could not read until
 * after they had paid for it. The paths deliberately interfere with each other
 * (Onslaught buys damage with attack speed, Tempo buys attack speed with
 * damage), which is only a decision if both halves are on screen.
 */
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
        const next = canBuyMore ? path.levels[nextLevel - 1] : null
        const cost = next?.cost ?? 0
        const milestone = canBuyMore ? milestoneForLevel(nextLevel) : 0
        const meets = hero.level >= milestone
        return (
          <div className="sh-upgblock" key={path.id}>
            <div className="sh-upg">
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
                aria-label={
                  !canBuyMore
                    ? `${path.name} is fully bought`
                    : meets
                      ? `Buy ${path.name} level ${nextLevel} for ${cost} gold: ${next!.desc}`
                      : `${path.name} level ${nextLevel} unlocks at hero level ${milestone}`
                }
              >
                {!canBuyMore ? (
                  'Maxed'
                ) : meets ? (
                  <>
                    L{nextLevel} · <Money amount={cost} c="gold" />
                  </>
                ) : (
                  `Lv ${milestone}`
                )}
              </button>
            </div>
            {next ? (
              <>
                <p className="sh-line muted">
                  L{nextLevel} — {next.desc}
                </p>
                {/* Deliberately a repeat of the tail of `desc`: the tradeoff is
                    the half a player skims past inside a comma list, and it is
                    the half they cannot take back. Colour, glyph and the word
                    "Downside" all carry it, so none of the three is load-bearing
                    on its own. */}
                {next.downside && (
                  <p className="sh-line bad">
                    <Icon name="warn" /> Downside: {next.downside}
                  </p>
                )}
              </>
            ) : (
              <p className="sh-line muted">{path.blurb} — all three levels bought.</p>
            )}
          </div>
        )
      })}
    </>
  )
}

/**
 * Team orders — and the panel says so now (M20).
 *
 * `tactics` is ONE object on the store, read once by the engine and applied to
 * every Sentinel on the field. Drawing it inside a hero's "Tune" tab, under
 * that hero's name, said the opposite: that you were setting this hero's
 * targeting. Every player who set "Low HP" on their rogue expecting their
 * fighter to keep blocking was misled by the layout.
 *
 * The hold-fire copy was also wrong about what it does. "Until in range" is not
 * a rule — a tower cannot fire out of range in the first place. The engine holds
 * fire on anything past **45% of the path** (`holdThreshold = path.length *
 * 0.45`), with one exception: an enemy a fighter is blocking is always shot at,
 * whatever the threshold, so a forward posting cannot soft-stall the wave.
 */
function HeroTactics() {
  const tactics = useGameStore((s) => s.tactics)
  const setTactics = useGameStore((s) => s.setTactics)
  return (
    <>
      <p className="sh-line muted head">Orders — the whole watch</p>
      <p className="sh-line muted">Targeting. One rule, followed by every Sentinel on the field.</p>
      <div className="sh-seg" role="group" aria-label="Targeting order for the whole watch">
        {FOCUS_OPTS.map((f) => (
          <button
            key={f.id}
            className={`sh-seg-btn ${tactics.focus === f.id ? 'active' : ''}`}
            data-sfx="toggle"
            aria-pressed={tactics.focus === f.id}
            aria-label={`${focusFull(f.id)} — for the whole watch`}
            onClick={() => setTactics({ focus: f.id })}
          >
            {f.label}
          </button>
        ))}
      </div>
      <button
        className={`sh-check ${tactics.holdFire ? 'on' : ''}`}
        data-sfx="toggle"
        aria-pressed={tactics.holdFire}
        onClick={() => setTactics({ holdFire: !tactics.holdFire })}
      >
        <span>{tactics.holdFire ? '☑' : '☐'}</span> Hold the near half
      </button>
      <p className="sh-line muted">
        {tactics.holdFire
          ? 'Holding: nothing is shot until it has walked 45% of the lane — except anything a Sentinel is blocking, which is always fair game.'
          : 'Off: every Sentinel fires the moment something enters its ring.'}
      </p>
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
  const mode = useGameStore((s) => s.mode)
  const gold = useGameStore((s) => s.gold)
  const dust = useGameStore((s) => s.dust)
  const reforge = useGameStore((s) => s.reforge)
  const upgradeItemAction = useGameStore((s) => s.upgradeItem)
  const forgeReforge = useGameStore((s) => s.endlessForgeReforge)
  const forgeUpgrade = useGameStore((s) => s.endlessForgeUpgrade)

  const scrap = useArmedAction(
    {
      label: 'Scrap',
      run: () => {
        dismantleItem(item.id)
        if (selection?.kind === 'item' && selection.id === item.id) shellSelect(null)
      },
      confirm: {
        label: 'Yes — scrap it',
        note: `${itemName(item)} is destroyed for ${moneyText(scrapGold(item), 'gold')}${
          mode === 'endless' ? ` and ${moneyText(scrapDust(item), 'dust')}` : ''
        }. There is no undo.`,
      },
    },
    `scrap-${item.id}`,
  )

  // Where is it — loose in the pack, or worn by someone?
  const wearer = roster.find((s) => HERO_SLOTS.some((hs) => s.equipment[hs]?.id === item.id))
  const wornSlot = wearer ? HERO_SLOTS.find((hs) => wearer.equipment[hs]?.id === item.id) : undefined

  // What equipping this into the armed slot would push back into the pack.
  // Mirrors `equipItem`'s two-hand branches exactly.
  const target = gearSlot && !wearer ? roster.find((s) => s.id === gearSlot.sentinelId) : undefined
  const ejection = ((): string | null => {
    if (!target || !gearSlot || !heroSlotsFor(item.slot).includes(gearSlot.slot)) return null
    if (item.slot === 'twoHand' && target.equipment.offHand) {
      return `Two-handed — ${target.name} puts ${target.equipment.offHand.name} back in the pack to hold it.`
    }
    if (gearSlot.slot === 'offHand' && target.equipment.mainHand?.slot === 'twoHand') {
      return `${target.name} needs both hands for ${target.equipment.mainHand.name} — it goes back in the pack.`
    }
    return null
  })()

  // Crafting is gold in the campaign and dust in endless — the Forge room is
  // only one place you can reach an item, so the actions belong on the item.
  const endless = mode === 'endless'
  const craft = {
    currency: (endless ? 'dust' : 'gold') as 'dust' | 'gold',
    purse: endless ? dust : gold,
    reforgeCost: endless ? reforgeDust(item) : reforgeCost(item),
    upgradeCost: endless ? upgradeDust(item) : upgradeCost(item),
    doReforge: () => (endless ? forgeReforge(item.id) : reforge(item.id)),
    doUpgrade: () => (endless ? forgeUpgrade(item.id) : upgradeItemAction(item.id)),
  }

  return (
    <div className="sh-context">
      <div className="sh-context-head start">
        {/* The item's own shape, at the head of its own panel. The damage type
            is NOT repeated here: the panel is ~176px wide and every mark costs
            the item name 18px of it (measured: "Mythic Staff of Ruin" clipped to
            "Mythi..." with two marks in the head). The first line of the body is
            "+34 Magic Damage" and carries the mark already. */}
        <span className="sh-context-icon" aria-hidden="true">
          <Icon name={itemIcon(item)} />
        </span>
        <strong style={{ color: rarityVar(item.rarity) }}>{itemName(item)}</strong>
      </div>
      <div className="sh-context-body">
        {/* The rarity in its own hue with a pip count, on its own line: in the
            head it cost the name its width ("Dagg…"). It used to be the gold
            sub-label at every tier (Wave 1). */}
        <p className="sh-line">
          <RarityTag rarity={item.rarity} />
        </p>
        {/*
          `itemBody` — the same function the merchant board, the Forge and the
          reward card render, rather than a second copy of the same three steps
          (M4). This panel used to build the lines itself, and it was the only
          one of the four surfaces that knew a `cx_` enchantment is a CURSE:
          `Reckless — +85% damage, −45% attack speed` classifies to `damage`,
          which is a true reading of the words and the wrong headline for the
          item, and the other three shipped exactly that. One producer is the
          only version of this fix that cannot come apart again. It is also what
          carries the `Curse ·` prefix and the mark together, so the picture is
          never the only thing saying so. A keepsake's whole-roster tag
          (`KEEPSAKE_TAG`, M6) rides in the same list.
        */}
        {itemBody(item).map((l, i) => (
          <EffectLine text={lineText(l)} tone={lineTone(l)} mark={lineMark(l)} key={i} />
        ))}
        {wearer && (
          <p className="sh-line muted">
            Worn by {wearer.name} · {wornSlot ? HERO_SLOT_LABEL[wornSlot] : ''}
          </p>
        )}
        {/* M26 — equipping a two-hander silently ejected whatever was in the
            off hand, and equipping an off-hand silently ejected a held
            two-hander. Both go back to the pack rather than being destroyed, so
            a warning is the honest fix rather than a confirm; what was wrong was
            that it happened with no word at all. */}
        {ejection && (
          <p className="sh-line bad">
            <Icon name="warn" /> {ejection}
          </p>
        )}
        {/* `title` carried the only explanation of what these two buttons do,
            and `title` does not exist on touch — so it is an `aria-label` now.
            No prose line to go with it: the panel is ~176px wide with a pinned
            foot, and two more lines of explanation pushed the buttons they
            explain off the bottom of the scroll. */}
        <div className="sh-craft">
          <button
            className="sh-btn small"
            disabled={craft.purse < craft.reforgeCost}
            onClick={craft.doReforge}
            aria-label={`Reforge ${itemName(item)} — reroll its enchantments for ${moneyText(craft.reforgeCost, craft.currency)}`}
          >
            Reforge <Money amount={craft.reforgeCost} c={craft.currency} />
          </button>
          <button
            className="sh-btn small"
            disabled={!canUpgrade(item) || craft.purse < craft.upgradeCost}
            onClick={craft.doUpgrade}
            aria-label={
              canUpgrade(item)
                ? `Raise ${itemName(item)} one rarity tier for ${moneyText(craft.upgradeCost, craft.currency)}`
                : `${itemName(item)} is already at the top rarity`
            }
          >
            {canUpgrade(item) ? (
              <>
                Raise <Money amount={craft.upgradeCost} c={craft.currency} />
              </>
            ) : (
              'Max rarity'
            )}
          </button>
        </div>
        {/*
         * Scrap lives HERE now, in the body beside the other things you can do
         * to an item, and it arms before it fires (Wave 1).
         *
         * It used to be the panel's foot button — one tap, no confirm, no undo,
         * item destroyed — in exactly the spot where a worn item shows
         * "Unequip". Unequip a sword, tap it in the pack to look at it, and the
         * same thumb position now destroyed it. Moving it off the foot breaks
         * the positional trap; the arm-then-confirm (`useArmedAction`, the
         * shell's one destructive-confirm pattern) makes it a second decision
         * on a different control.
         */}
        {!wearer && (
          <div className="sh-craft sh-scrap">
            <button
              className={`sh-btn small ${scrap.armed ? '' : 'quiet-danger'}`}
              onClick={scrap.fire}
              aria-label={
                scrap.armed
                  ? 'Never mind — keep it'
                  : `Scrap ${itemName(item)} for ${moneyText(scrapGold(item), 'gold')}${endless ? ` and ${moneyText(scrapDust(item), 'dust')}` : ''} — it is destroyed`
              }
            >
              {scrap.armed ? (
                'Keep it'
              ) : (
                <>
                  Scrap <Money amount={scrapGold(item)} c="gold" />
                  {endless ? <Money amount={scrapDust(item)} c="dust" /> : null}
                </>
              )}
            </button>
            {scrap.confirm && (
              <button
                className="sh-btn small danger"
                onClick={scrap.confirm.run}
                onKeyDown={scrap.confirm.onKeyDown}
                onPointerDown={scrap.confirm.onPointerDown}
              >
                {scrap.confirm.label}
              </button>
            )}
          </div>
        )}
        {/* Below the buttons, not above: arming must not move a control under a
            thumb that is already coming down (the rule `rev-shift` guards). */}
        {scrap.notice && (
          <p className="sh-line bad" role="alert">
            <Icon name="warn" /> {scrap.notice}
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
          // A loose item with no slot armed: say how to wear it rather than
          // leaving the foot empty — the foot is where the eye goes next.
          <p className="sh-line muted sh-foot-hint">Tap a + under Gear to wear it.</p>
        )}
      </div>
    </div>
  )
}

function OfferPanel({ offer }: { offer: Offer }) {
  // Same arm-then-fire confirm the page CTA uses, so a destructive offer is
  // never one tap whichever band it is read in.
  const confirm = useArmedAction(offer.action, offer.id)
  return (
    <div className="sh-context">
      <div className="sh-context-head">
        <strong style={offer.color ? { color: offer.color } : undefined}>{offer.title}</strong>
        {offer.sub && <span className="sh-context-sub">{offer.sub}</span>}
      </div>
      <div className="sh-context-body">
        {/* Same rule as the page renderer: the cost reads before the detail. */}
        {offer.warn && (
          <p className="sh-line bad">
            <Icon name="warn" /> {offer.warn}
          </p>
        )}
        {/* `lineMark` is why the merchant's curses carry the curse mark here and
            not just on the item panel (M4) — the producer's knowledge travels
            with the line rather than being re-derived by whichever renderer
            happens to be looking. */}
        {offer.body.map((l, i) =>
          offer.bodyIcons ? <EffectLine text={lineText(l)} tone={lineTone(l)} mark={lineMark(l)} key={i} /> : (
            <p className="sh-line" key={i}>
              {lineText(l)}
            </p>
          ),
        )}
        {confirm.notice && (
          <p className="sh-line bad" role="alert">
            <Icon name="warn" /> {confirm.notice}
          </p>
        )}
      </div>
      <div className="sh-context-foot">
        {offer.action && (
          <button className="sh-btn primary" disabled={offer.action.disabled} onClick={confirm.fire}>
            {confirm.label}
            {offer.action.cost && !confirm.armed ? (
              <>
                {' · '}
                <Money amount={offer.action.cost.amount} c={offer.action.cost.currency} />
              </>
            ) : null}
          </button>
        )}
        {/* The armed confirm is a different button from the one that armed it —
            see `useArmedAction`. Repeating the primary can only arm and disarm,
            so no double-activation of any kind reaches the destructive action.
            It is rendered AFTER the control that armed it (and pulled back to
            the left visually with `order`) so tabbing forward from "Never mind"
            reaches it: a keyboard user used to have to Shift+Tab backwards to
            find the confirm, which is exactly the wrong direction for the one
            control that needs finding deliberately. */}
        {confirm.confirm && (
          <button
            className="sh-btn danger"
            onClick={confirm.confirm.run}
            onKeyDown={confirm.confirm.onKeyDown}
            onPointerDown={confirm.confirm.onPointerDown}
          >
            {confirm.confirm.label}
          </button>
        )}
        {/* Fires on the first tap, deliberately: a secondary is never armed.
            That is why `SecondaryAct` refuses a `confirm` at the type level —
            one set here used to be accepted and then dropped silently, so a
            destructive secondary would have gone off unguarded. */}
        {offer.secondary && (
          <button className="sh-btn" disabled={offer.secondary.disabled} onClick={offer.secondary.run}>
            {offer.secondary.label}
            {offer.secondary.cost ? (
              <>
                {' · '}
                <Money amount={offer.secondary.cost.amount} c={offer.secondary.cost.currency} />
              </>
            ) : null}
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
                  style={worn ? ({ '--rail': rarityVar(worn.rarity) } as CSSProperties) : undefined}
                  onClick={() => {
                    if (worn) {
                      shellSelect({ kind: 'item', id: worn.id })
                    } else if (active) {
                      clearGearSlot()
                    } else {
                      activateGearSlot(hero.id, hs)
                    }
                  }}
                  // `title` is invisible on touch, so the slot's state has to be
                  // in its accessible name rather than in a hover tooltip.
                  aria-label={
                    worn
                      ? `${HERO_SLOT_LABEL[hs]}: ${itemName(worn)}, ${RARITY[worn.rarity].label}`
                      : active
                        ? `${HERO_SLOT_LABEL[hs]}: choosing — pick something from the pack`
                        : `${HERO_SLOT_LABEL[hs]}: empty`
                  }
                >
                  {/* Rarity as a letter as well as a hue (M27c). */}
                  {worn && (
                    <span className="sh-slot-rar" aria-hidden="true">
                      {RARITY_INITIAL[worn.rarity]}
                    </span>
                  )}
                  <span className="sh-slot-label">{HERO_SLOT_LABEL[hs]}</span>
                  {/* A filled slot said `◆` — the same diamond the pack used for
                      an unknown kind, the loot line used for a drop and the
                      spoils screen used for an item card. It draws what is
                      actually in it now, so "Main Hand: Greatsword" is legible
                      without opening the panel. Empty and arming keep their
                      text marks: they are states, not things. */}
                  {worn ? (
                    <span className="sh-slot-mark" aria-hidden="true">
                      <Icon name={itemIcon(worn)} />
                    </span>
                  ) : (
                    <span className="sh-slot-mark" aria-hidden="true">
                      {active ? '…' : '+'}
                    </span>
                  )}
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
  const sortInventory = useGameStore((s) => s.sortInventory)

  // With a gear slot armed the pack filters to what fits it — that replaces the
  // whole equip drawer.
  const fits = (i: Item) => !gearSlot || heroSlotsFor(i.slot).includes(gearSlot.slot)
  const shown = inventory.filter(fits)

  return (
    <div className={`sh-pack ${gearSlot ? 'filtering' : ''}`}>
      <div className="sh-col-head">
        <span>PACK</span>
        {/* "0/0" was shown/owned with no words on either number (Wave 1).
            It says what it counts now, and the filter case says so. */}
        <span className="sh-col-count">
          {inventory.length === 0
            ? 'empty'
            : gearSlot
              ? `${shown.length} of ${inventory.length} fit`
              : `${inventory.length} item${inventory.length === 1 ? '' : 's'}`}
        </span>
        <button className="sh-col-btn" onClick={sortInventory} aria-label="Sort the pack by rarity, then kind">
          ⇅
        </button>
      </div>
      <div className="sh-pack-grid">
        {shown.map((i) => (
          <button
            key={i.id}
            className={`sh-tile ${selection?.kind === 'item' && selection.id === i.id ? 'selected' : ''}`}
            style={{ '--rail': rarityVar(i.rarity) } as CSSProperties}
            /* The tile used to say what it was ONLY in `title` and its border
               hue — nothing for a touch player and nothing for a colour-blind
               one. Now: a real accessible name, the rarity initial, and a pip
               count, so the ramp reads as shape before it reads as colour. */
            /* The damage type is in the NAME now (M11). The mark in the corner
               was the only place this tile said whether a weapon was physical
               or magic — the property `damageMark` itself calls the one that
               decides whether a drop is worth anything to a given hero — and
               the accessible name did not mention it at all. */
            aria-label={[`${itemName(i)}, ${RARITY[i.rarity].label} ${KIND_NAME[i.slot] ?? 'item'}`, markLabel(damageMark(i))]
              .filter(Boolean)
              .join(', ')}
            onClick={() => {
              if (gearSlot && heroSlotsFor(i.slot).includes(gearSlot.slot)) {
                equipItem(gearSlot.sentinelId, gearSlot.slot, i.id)
                clearGearSlot()
              } else {
                shellSelect({ kind: 'item', id: i.id })
              }
            }}
          >
            {/* THE COUNT CHANNEL IS NOT NEGOTIABLE. The letter and the pips are
                the Phase-2 fix for a ramp that was hue-only, and the art is
                ADDITIVE to them: the tile now carries the rarity initial, the
                rarity pip count, an ornament count that escalates C→M, the item
                shape and (on weapons) the damage type. Five channels, four of
                them colour-blind, where there used to be one hue and one
                borrowed glyph. Replacing the letter with a coloured gem would
                have walked the whole thing back. */}
            <span className="sh-tile-rar" aria-hidden="true">
              {RARITY_INITIAL[i.rarity]}
            </span>
            <span className="sh-tile-glyph" aria-hidden="true">
              <Icon name={itemIcon(i)} lg />
              {damageMark(i) && <Icon name={damageMark(i)!} className="sh-tile-mark" />}
            </span>
            {/* The rarity frame. Ornament COUNT, not ornament colour: one corner
                notch at Common through five at Mythic, so the frame doubles the
                pip count rather than adding a second colour-only signal. */}
            <span className={`sh-tile-frame r${rarityRank(i.rarity)}`} aria-hidden="true">
              {Array.from({ length: rarityRank(i.rarity) }, (_, n) => (
                <i className="sh-tile-orn" key={n} />
              ))}
            </span>
            <span className="sh-tile-pips" aria-hidden="true">
              {Array.from({ length: rarityRank(i.rarity) }, (_, n) => (
                <span className="sh-tile-pip" key={n} />
              ))}
            </span>
          </button>
        ))}
        {shown.length === 0 && (
          <span className="sh-pack-empty">{gearSlot ? 'Nothing fits' : 'Nothing yet. Spoils and the merchant fill it.'}</span>
        )}
      </div>
    </div>
  )
}

/**
 * The four equip kinds, spelled out — a glyph is not an accessible name, and
 * neither is a sprite.
 *
 * The matching `KIND_GLYPH` table is gone. It mapped 26 item nouns onto four
 * marks (`⚔ ⚒ ⛊ ⛨`), every one of them already meaning something else
 * elsewhere in the shell, and a Greatsword, a Warhammer, a Bow, a Staff and a
 * Grimoire were the same picture. `itemIcon` draws the noun now.
 */
const KIND_NAME: Record<string, string> = {
  oneHand: 'one-handed weapon',
  twoHand: 'two-handed weapon',
  offHand: 'off-hand',
  body: 'body armour',
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
