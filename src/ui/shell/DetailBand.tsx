import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import {
  canUpgrade,
  dualWieldCheck,
  gripOf,
  HERO_SLOTS,
  HERO_SLOT_LABEL,
  OFF_HAND_SHARE,
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
import { computeCombat, totalStats } from '../../game/engine/combat'
import { buildName, evolutionOptions, MAX_LEVEL, TIER1_LEVEL, TIER2_LEVEL } from '../../game/engine/leveling'
import type { HeroSlot, Item, Sentinel } from '../../game/types'
import { equipRules } from '../../game/run/relics'
import { canStartWave, scrapDust, scrapGold, useGameStore, type HeroTab } from '../../state/gameStore'
import {
  archetypeVar,
  damageMark,
  dualWieldShort,
  effectIcon,
  FOCUS_OPTS,
  focusFull,
  GRIP_NAME,
  itemIcon,
  itemName,
  markLabel,
  moneyText,
  OFF_HAND_TAKES,
  RARITY_INITIAL,
  rarityRank,
  rarityVar,
  TWINBLADE,
  TWINBLADE_TAKES,
  type IconKey,
  strengthPct,
  strengthText,
} from '../channels'
import { Icon } from '../Icon'
import { Money } from './Money'
import { PerkPanel } from './PerkPanel'
import { NodePreviewPanel } from './NodePreview'
import { useMapFocus } from './mapFocus'
import { itemBody, lineMark, lineText, lineTone, type Offer } from './offers'
import { RarityTag } from './Page'
import { useArmedAction } from './PageScreens'
import { CommandSlot } from './CommandSlot'
// G2-2 — the wave strip's enemy queue.
import { WaveQueue } from './WaveQueue'
import { lineUp, queueFor } from './enemyQueue'
import { InfoToggle } from './InfoToggle'
import { equipTarget, gearDeltas, newAffixes, planEquip, useGearTarget } from './gearPlan'
import { Tap, tapWord } from '../pointer'
import { fieldTitle, orientationOf } from '../../game/data/maps'
import { CURSED_DAMAGE_MULT, DANGER_COPY, dangerAt } from '../../game/data/hazards'
import { LevelUpPanel } from './LevelUpPanel'
import { levelUpOpen, rewardInPlace, useLevelUps } from './levelUps'
import { useShown } from './staging'
import { conflictCopy, equipWarning } from '../../game/run/clearance'
import { isMelee, MELEE_LINE, meleeSource, weaponWord } from '../../game/engine/melee'
import { fieldConflicts, fieldStanding, gearLocked } from '../../state/game/selectors'

/**
 * Band 4 — context panel, the selected hero's gear, and the pack. The pack is
 * permanent (rule three): it is on screen in battle, on the map and at the
 * merchant, so buying an item means watching it land.
 */
export function DetailBand({ offers }: { offers: Offer[] }) {
  // LS3: gear and the pack arrive with the first win's spoils. Until then the
  // context panel has the band to itself (`.sh-detail.no-gear`).
  const gear = useShown('gear')
  return (
    <section className={`sh-detail${gear ? '' : ' no-gear'}`} id="sh-detail-panels">
      <ContextPanel offers={offers} />
      {gear && <GearColumn />}
      {gear && <PackColumn />}
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
  const engine = useGameStore((s) => s.engine)
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
  const shellSelect = useGameStore((s) => s.shellSelect)
  const portrait = useGameStore((s) => orientationOf(s.battleMap) === 'portrait')
  const detailOpen = useGameStore((s) => s.detailOpen)
  const toggleDetail = useGameStore((s) => s.toggleDetail)
  const inPlace = useGameStore(rewardInPlace)
  const battleMap = useGameStore((s) => s.battleMap)
  // Weapon clearance: a hero swinging beside another holds the next wave
  // (`run/clearance`). Read off the same inputs the strip already follows —
  // the posts, the roster's gear, and the held engine (re-read on `hud`).
  const conflicts = fieldConflicts({ screen, engine, battlePhase, roster, placements, battleMap })
  // LS3: speed arrives once the first sub-wave is down; the Watch Command
  // after the first battle. `CommandSlot`'s "Next" is not staged — it is how a
  // breather ends.
  const speedShown = useShown('speed')
  const commandShown = useShown('command')

  if (screen !== 'battle' || runPhase !== 'active') return null

  // The wave-clear beat (H18). It comes before every other branch because for
  // its ~0.9s it IS the state of the battle.
  if (waveBeat) return <WaveBeatBar status={waveBeat.status} />

  // A settled wave. `battlePhase` is a label and the engine is the fact, so a
  // stale 'battle' with no engine still reads as finished.
  // G2-2 — the strip's left slot names the wave in every moment below.
  const waveName = currentWave?.label ?? 'Wave'

  if (lastResult && (battlePhase !== 'battle' || !hasEngine)) {
    return (
      <div className="sh-wavebar sh-wq-bar">
        {/* No live region here any more (Phase 2): `Announcer` owns the one
            polite voice for the whole battle — wave start, Gate hits, the
            clear, level-ups — so two regions can never read over each other. */}
        {/* G2-2 — cleared: the same three slots, holding the gold and Continue. */}
        <div className="sh-wq-mid">
          <StripCaption name={waveName} now={lastResult.status === 'cleared' ? 'Wave cleared' : 'Wave lost'} />
          <p className="sh-wq sh-wq-gold">
            <Money amount={lastResult.goldEarned} c="gold" /> earned
            {/* G3-2: the reward is picked right here, and "Take it" in the
                Context panel is the way on — a Continue beside it would be a
                second primary that skips the pick. */}
            {inPlace && <> · take a reward to march on</>}
          </p>
        </div>
        {!inPlace && (
          <button className="sh-btn primary" onClick={continueAfterWave}>
            Continue
          </button>
        )}
      </div>
    )
  }

  if (battlePhase === 'battle' && hasEngine) {
    const left = hud.enemiesTotal - hud.enemiesSpawned + hud.enemiesAlive
    // G2-2 — the breather between sub-waves is a moment of its own: the
    // strip's left slot carries the instruction the canvas banner used to
    // paint over the top of the field, and the queue shows the NEXT sub-wave.
    const held = hud.breather && !!engine?.breather
    const moved = held && !!engine?.subWaveState().moved
    const queue = lineUp(queueFor(currentWave, held ? 'held' : 'live', hud))
    const space = held && conflicts.length ? conflictCopy(conflicts, { moveLeft: !moved, breather: true }) : null
    return (
      <div className={`sh-wavebar sh-wq-bar${held ? ' held' : ''}`}>
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
         *
         * G2-2: the kill-progress bar is now the enemy queue — who is still
         * coming, next first — in the bar's own room.
         */}
        <div className="sh-wq-mid" id={space ? 'sh-make-space' : undefined}>
          {space ? (
            <MakeSpace head={space.head} fix={space.fix} />
          ) : held ? (
            <StripCaption name="Held" now={moved ? 'Move made' : 'Move one hero'} tone="do" />
          ) : (
            <StripCaption
              name={waveName}
              now={
                <>
                  <b>{Math.max(0, left)}</b> left
                </>
              }
            />
          )}
          {!space && (
            <WaveQueue
              entries={queue}
              lead={held ? `Sub-wave ${hud.subWave + 1} of ${hud.subWaveCount}, next` : 'Still to come'}
              emptyText="All on the field"
              countNote={held ? 'in the next sub-wave' : 'still to come'}
            />
          )}
        </div>
        {/* The live wave's command place — the COMBAT agent's active ability
            renders here (Phase 2 layout contract, docs/FIGMA.md). While a
            clearance conflict stands, Next waits and says why. */}
        <CommandSlot staged={!commandShown} hold={space?.line} />
        {/* A visible word, not just "1×" (Wave 1): a bare multiplier in a box
            read as a score, not as a control. */}
        {speedShown && (
          <button
            className="sh-speed"
            data-sfx="toggle"
            aria-keyshortcuts="1 2 3"
            onClick={() => setSpeed(speed === 3 ? 1 : ((speed + 1) as 1 | 2 | 3))}
            aria-label={`Battle speed ${speed}× — ${tapWord(false)} to change`}
          >
            <span className="sh-speed-word">Speed</span>
            <span className="sh-speed-val">{speed}×</span>
          </button>
        )}
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
  const space = conflicts.length ? conflictCopy(conflicts, { moveLeft: true, breather: false }) : null
  return (
    <div className={`sh-wavebar sh-wq-bar${space ? ' conflict' : ''}`}>
      {/* G2-2 — setup: the wave's name and what to do, then the whole line-up
          in spawn order, then Start Wave. It was a sentence ("Tap your hero,
          then a glowing circle…") and a bare "8 enemies"; the sentence is in
          the composition panel above on a landscape field and the glowing
          posts say it on the field itself, so the strip keeps the verb and
          spends the room on WHO is coming. */}
      <div className="sh-wq-mid" id={space ? 'sh-make-space' : undefined}>
        {space ? (
          <MakeSpace head={space.head} fix={space.fix} />
        ) : (
          <>
            <StripCaption
              name={waveName}
              now={deployed ? `${currentWave?.spawns.length ?? 0} enemies` : 'Post a hero'}
              tone={deployed ? undefined : 'do'}
            />
            <WaveQueue entries={lineUp(queueFor(currentWave, 'setup', hud))} lead="This wave" emptyText="No enemies" countNote="in this wave" />
          </>
        )}
      </div>
      {portrait && (
        <button
          className="sh-btn sh-detail-toggle"
          aria-expanded={detailOpen}
          aria-controls="sh-detail-panels"
          onClick={toggleDetail}
        >
          {detailOpen ? 'Hide' : 'Details'}
        </button>
      )}
      <button
        className="sh-btn primary"
        disabled={deployed === 0 || !!space}
        // The reason it waits is the strip beside it, read with the button.
        aria-describedby={space ? 'sh-make-space' : undefined}
        /* The keyboard path (Space / Enter, `Shortcuts.tsx`) presses THIS
           button, so a shortcut can never do what the button would refuse. */
        data-key="start"
        aria-keyshortcuts="Space Enter"
        onClick={() => {
          // A live wave collapses the Detail band so the Stage gets the height
          // (Phase 2) — unless something is selected, which re-opens it. The
          // hero just posted is almost always still selected, so let go of it
          // here, or the most common path into a wave would never collapse.
          if (useGameStore.getState().shellSelection) shellSelect(null)
          startWave()
        }}
      >
        Start Wave ▶
      </button>
    </div>
  )
}

/**
 * Weapon clearance — the strip while a clearance conflict holds the wave: who
 * swings, in the caption's place ("MAKE SPACE · Doyle swings a sword"), and the
 * fix in the queue's ("Move a hero out of the red zone."). Not a live region
 * (the strip has none — `Announcer` is the battle's one voice): the disabled
 * Start Wave / Next names this block as its description, so the reason is read
 * with the control it holds. The field draws the same thing (the red zone at
 * full strength, the hero inside it marked). It goes the moment the player
 * makes space.
 */
function MakeSpace({ head, fix }: { head: string; fix: string }) {
  return (
    <div className="sh-space">
      <p className="sh-wq-cap bad">
        <span className="sh-wq-name">
          <Icon name="warn" /> Make space
        </span>
        <span className="sh-wq-now">{head}</span>
      </p>
      {/* Where the strip is narrow (a phone beside Details and Start Wave) the
          caption keeps only "Make space" and the who moves into this line. */}
      <p className="sh-space-fix">
        <span className="sh-space-do">{fix}</span>
        <span className="sh-space-who">
          {head} — {fix.charAt(0).toLowerCase() + fix.slice(1)}
        </span>
      </p>
    </div>
  )
}

/**
 * G2-2 — the strip's caption: the wave's name, then the moment's few words,
 * on one line over the queue.
 *
 * It stays put across every moment of a battle so the eye learns where to
 * look — "Depth 1 · Post a hero", "Depth 1 · 4 left", "Held · Move one hero",
 * "Depth 1 · Wave cleared" — and it sits OVER the queue rather than beside it
 * so the portraits get the strip's whole middle on a 390px phone. The name
 * gives way (ellipsis) before the moment does. `do` marks an instruction
 * rather than a readout. The held instruction is also spoken, by `Announcer`
 * (`combatNotes`), and the Next button's name carries the sub-wave count.
 */
function StripCaption({ name, now, tone }: { name: string; now: ReactNode; tone?: 'do' }) {
  return (
    <p className={`sh-wq-cap${tone ? ` ${tone}` : ''}`}>
      <span className="sh-wq-name">{name}</span>
      <span className="sh-wq-now">{now}</span>
    </p>
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
  const evolutionQueue = useGameStore((s) => s.evolutionQueue)
  const levelUps = useLevelUps((s) => s.heroes)

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
    // G3-2: a hero wearing the roster's level-up badge opens its level-up
    // here — the choice the modal used to force — until it is dealt with.
    if (hero && levelUpOpen(levelUps[hero.id], hero, evolutionQueue)) return <LevelUpPanel hero={hero} />
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
            <p className="sh-line muted">
              <Tap /> a hero for its detail.
            </p>
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
            Post heroes on any glowing tile. Each reaches only what walks inside its ring.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="sh-context empty">
      <p className="sh-empty-hint">
        <Tap /> {hasOffers ? 'an offer to see what it does.' : screen === 'map' ? 'a stop on the map to see what waits there.' : 'a hero to see its detail.'}
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
  const relics = useGameStore((s) => s.relics)
  const hero = roster.find((h) => h.id === gearSlot?.sentinelId)
  if (!gearSlot || !hero) return null
  const dual = dualWieldCheck(hero, equipRules(relics))

  const offHand = hero.equipment.offHand
  const mainHand = hero.equipment.mainHand
  // Weapon clearance, before the one-tap equip from the pack: a sword, axe,
  // greatsword or warhammer in this hand would make a posted hero swing beside
  // someone (still allowed — it shows as a conflict and holds the wave).
  const swordIn: Item = { id: 'probe', name: 'Sword', slot: 'oneHand', rarity: 'common', base: {}, enchantments: [] }
  const probe =
    gearSlot.slot === 'mainHand' || (gearSlot.slot === 'offHand' && dual.ok)
      ? equipWarning(hero, { ...hero, equipment: { ...hero.equipment, [gearSlot.slot]: swordIn } }, 'a sword', fieldStanding(useGameStore.getState()))
      : null
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
        <p className="sh-line muted">
          The pack is showing only what fits. <Tap /> one to put it on.
        </p>
        {/* Round 3 (Q4 + Q5): the off hand's rule, said where the choice is
            made — what it takes, what a knife is worth there, and where this
            hero stands on the Twinblade Harness's check. */}
        {gearSlot.slot === 'offHand' && (
          <>
            {/* The relic's line first: it is the one about THIS hero, and on a
                phone the body scrolls under a pinned foot. */}
            {dual.relic && (
              <p className={`sh-line ${dual.ok ? 'accent' : 'muted'}`}>
                {dual.ok
                  ? `${TWINBLADE}: ${TWINBLADE_TAKES} fits here too, at full strength.`
                  : `${TWINBLADE}: a sword here needs ${dual.need} DEX — ${hero.name} has ${Math.floor(dual.dex)}.`}
              </p>
            )}
            <p className="sh-line muted">
              Small things only. A knife or wand hits at {Math.round(OFF_HAND_SHARE * 100)}% here.
            </p>
          </>
        )}
        {warn && (
          <p className="sh-line bad">
            <Icon name="warn" /> {warn}
          </p>
        )}
        {probe && (
          <p className="sh-line bad">
            <Icon name="warn" /> A sword, axe or hammer here makes {hero.name} melee — {probe.count} hero{probe.count === 1 ? ' is' : 'es are'}{' '}
            too close.
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
      {/* G1-2: the battle's map challenge rides with the ground's name. */}
      <p className="sh-line muted sh-comp-ground">{fieldTitle(battleMap)}</p>
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
          <Icon name="threat" /> {strengthText(threat)}: every enemy below has {strengthPct(threat)}% more HP.
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
function BattleRoll({ result }: { result: { perSentinel: { id: string; kills: number; damageDealt: number; xpGained: number }[] } }) {
  const roster = useGameStore((s) => s.roster)
  const rows = [...result.perSentinel].sort((a, b) => b.damageDealt - a.damageDealt)
  if (rows.length === 0) return null
  return (
    <div className="sh-comp">
      {rows.map((r) => {
        const hero = roster.find((h) => h.id === r.id)
        return (
          <div className="sh-comp-row" key={r.id}>
            <span className="sh-comp-name">
              {hero?.name ?? 'Hero'}
              <span className="sh-comp-res">
                {r.kills} kills · +{Math.round(r.xpGained)} xp
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
  const battleMap = useGameStore((s) => s.battleMap)
  const engine = useGameStore((s) => s.engine)
  // Re-read where the hero stands after a breather move (the hud changes then).
  useGameStore((s) => s.hud.breather)
  const profile = computeCombat(hero)

  // Undeploy lived on the old upgrade modal's footer; without it here a placed
  // hero can be moved but never taken off the field.
  const slotId = Object.keys(placements).find((id) => placements[id] === hero.id)
  const canUndeploy = !!slotId && battlePhase === 'setup'
  // Q1: the ground it stands on RIGHT NOW — the live post during a wave (a
  // breather move changes it), the setup post otherwise.
  const standing = (engine && battlePhase === 'battle' ? engine.sentinels.find((x) => x.id === hero.id)?.slotId : undefined) ?? slotId
  const danger = standing ? dangerAt(battleMap, standing) : null
  const groundMult = danger === 'cursed' ? CURSED_DAMAGE_MULT : 1
  const swing = meleeSource(hero)

  // LS3: Skills (perks) arrive at a hero's first choice, Team (the targeting
  // order) with the Watch Command — the other order the whole watch shares.
  const perksShown = useShown('perk')
  const ordersShown = useShown('command')
  const TABS: { id: HeroTab; label: string }[] = [
    { id: 'stats', label: 'Stats' },
    // "Upgr" was an abbreviation nobody could read aloud. These are the
    // hero's bought skill paths (Wave 1).
    ...(perksShown ? [{ id: 'upgrades' as const, label: 'Skills' }] : []),
    // "Tune" said nothing about scope; these are the whole watch's orders, not
    // this hero's (M20).
    ...(ordersShown ? [{ id: 'tactics' as const, label: 'Team' }] : []),
  ]
  // A tab that is not offered cannot be the open one.
  const open: HeroTab = TABS.some((t) => t.id === tab) ? tab : 'stats'

  return (
    <div className="sh-context">
      <div className="sh-context-head">
        {/* The hue comes from a token, not from `hero.color`'s raw hex, so the
            colour-vision modes in global.css can move it (M34). */}
        <strong style={{ color: archetypeVar(hero.archetype) }}>{hero.name}</strong>
        <span className={`sh-context-sub ${danger ? 'sh-cursed' : ''}`}>DPS {Math.round(profile.dps * groundMult)}</span>
      </div>
      {danger && (
        <p className="sh-line sh-cursed-line">
          <Icon name="warn" /> <b>{DANGER_COPY[danger].name}</b>: {DANGER_COPY[danger].short} here ({Math.round(profile.dps)} DPS elsewhere).
        </p>
      )}
      {/* Weapon clearance: whether this hero swings, in plain words — what
          it holds decides it (or a skill), not its class. */}
      {swing && (
        <p className="sh-line muted sh-swing-line" title={swing.kind === 'weapon' ? `Holding ${weaponWord(swing.item)}` : 'A skill'}>
          <Icon name="blade" /> {MELEE_LINE}
        </p>
      )}
      {/* One tab is not a choice: the tab row waits until there are two. */}
      {TABS.length > 1 && (
        <div className="sh-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={open === t.id}
              className={`sh-tab ${open === t.id ? 'active' : ''}`}
              data-sfx="toggle"
              onClick={() => setHeroTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div className="sh-context-body">
        {open === 'stats' && <HeroStats hero={hero} />}
        {open === 'upgrades' && <HeroUpgrades hero={hero} />}
        {open === 'tactics' && <HeroTactics />}
      </div>
      {canUndeploy && (
        <div className="sh-context-foot">
          <button
            className="sh-btn"
            // The store plays the undeploy sound itself; the generic click on
            // top of it doubled the feedback.
            data-sfx="none"
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
   * Heroes have no HP and are never hit. Thorns grind what a hero HOLDS, so
   * the row only means something on a blocker. `p.mods` is the fully merged
   * build (gear and mutations included), so a rogue handed a block by some
   * future affix grows the row back automatically.
   */
  const blocks = !!p.mods.block
  const cap = patienceCap(p.patience)
  // LS3: the evolution road is named once a hero has met its first choice.
  const choicesShown = useShown('perk')

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
        {blocks && (
          <Cell
            label="Hold"
            wide
            values={[
              { head: 'HLD', full: 'Enemies held', v: p.mods.block!.count },
              { head: 'THN', full: 'Thorns', v: Math.round(p.thorns) },
            ]}
          />
        )}
      </div>
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
      {!choicesShown ? null : options.length > 0 ? (
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
 * The Skills tab (Phase 3b): the hero's spec perks. The three identical
 * Onslaught / Tempo / Precision buy rows it used to hold are gone — a perk is
 * chosen at level 5 and 15, free, from the hero's own line (`PerkPanel`).
 */
function HeroUpgrades({ hero }: { hero: Sentinel }) {
  return <PerkPanel hero={hero} />
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
 * There used to be a "Hold the near half" toggle here as well. It was cut: the
 * balance harness measured it costing 10–50pt of stop rate in 7 of the 8
 * team × map × placement cells it was tried in, i.e. a trap option whose only
 * reliable effect was to lose waves. Targeting is the one order that ships.
 */
function HeroTactics() {
  const tactics = useGameStore((s) => s.tactics)
  const setTactics = useGameStore((s) => s.setTactics)
  return (
    <>
      <p className="sh-line muted head">Orders — the whole watch</p>
      <p className="sh-line muted">Targeting. One rule, followed by every hero on the field.</p>
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
  const activateGearSlot = useGameStore((s) => s.activateGearSlot)
  const mode = useGameStore((s) => s.mode)
  const gold = useGameStore((s) => s.gold)
  const dust = useGameStore((s) => s.dust)
  const reforge = useGameStore((s) => s.reforge)
  const upgradeItemAction = useGameStore((s) => s.upgradeItem)
  const forgeReforge = useGameStore((s) => s.endlessForgeReforge)
  const forgeUpgrade = useGameStore((s) => s.endlessForgeUpgrade)
  const relics = useGameStore((s) => s.relics)
  // Gear only changes between rounds; during a live sub-wave the panel says so
  // instead of offering an equip the store would refuse.
  const locked = useGameStore(gearLocked)
  // Who stands where right now (setup posts, or the breather's field), to warn
  // BEFORE an equip that would make a hero swing beside someone.
  useGameStore((s) => s.placements)
  useGameStore((s) => s.hud)
  const standing = fieldStanding(useGameStore.getState())

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

  // On a short phone the armed confirm and its "no undo" line land below the
  // context column's fold (Phase 2). Bring them up the moment it arms — the
  // column scrolls, so nothing moves under the thumb that armed it.
  const scrapNoticeRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (scrap.armed) scrapNoticeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [scrap.armed])

  // Where is it — loose in the pack, or worn by someone?
  const wearer = roster.find((s) => HERO_SLOTS.some((hs) => s.equipment[hs]?.id === item.id))
  const wornSlot = wearer ? HERO_SLOTS.find((hs) => wearer.equipment[hs]?.id === item.id) : undefined

  /*
   * Equip, in one tap, with the comparison in front of you (Phase 2, F4).
   *
   * Tapping an item never offered to put it on: the foot said "Tap a + under
   * Gear", and a swap took four taps (open the worn item, unequip, find the new
   * one in the pack, arm the slot, tap it). Now a loose item always offers
   * "Equip → <hero>" — the hero whose gear you were just looking at, or the one
   * it helps most — and an occupied slot SWAPS in that one tap, the old piece
   * going back to the pack. `planEquip` mirrors `equipFromPack` exactly, so the
   * DPS and stat lines below are the result, not an estimate.
   */
  const gearTargetId = useGearTarget((s) => s.heroId)
  const armedHero = gearSlot && !wearer ? roster.find((s) => s.id === gearSlot.sentinelId) : undefined
  const rules = equipRules(relics)
  const target = wearer ? undefined : equipTarget(roster, item, armedHero?.id, gearTargetId, rules)
  // Round 3 (Q4): a main-hand one-hander under the Twinblade Harness — can the
  // hero it is being weighed for carry it in the off hand?
  const twinFor = target ?? wearer
  const twin =
    rules.twinblade && twinFor && gripOf(item) === 'main' ? { hero: twinFor, check: dualWieldCheck(twinFor, rules) } : null
  const plan = target ? planEquip(target, item, armedHero && gearSlot ? gearSlot.slot : null, rules) : null
  const deltas = target && plan ? gearDeltas(target, plan.after) : []
  const fresh = plan ? newAffixes(item, plan.displaced) : []
  const ejection =
    plan && plan.displaced.length > 0
      ? `${plan.displaced.map((d) => d.name).join(' and ')} ${plan.displaced.length > 1 ? 'go' : 'goes'} back to the pack.`
      : null
  // Weapon clearance, said before the swap: a hero that starts swinging where
  // it stands with someone beside it is a conflict that holds the next wave.
  // Still allowed — the warning is the decision, not a refusal.
  const clash = target && plan ? equipWarning(target, plan.after, itemName(item), standing) : null
  const swingTurn =
    !clash && target && plan
      ? !isMelee(target) && isMelee(plan.after)
        ? `${target.name} will swing — needs clearance.`
        : isMelee(target) && !isMelee(plan.after)
          ? `${target.name} stops swinging — no clearance needed.`
          : null
      : null

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
        {/* Weapon clearance: the conflict this equip would cause, said FIRST —
            above the fold on a phone, where the body scrolls under the foot. */}
        {clash && (
          <p className="sh-line bad">
            <Icon name="warn" /> {clash.text}
          </p>
        )}
        <p className="sh-line">
          <RarityTag rarity={item.rarity} />
        </p>
        {/* The comparison FIRST — what changes on the target if this goes on —
            so the decision reads above the fold; the item's own lines follow. */}
        {target && plan && (
          <div className="sh-compare" aria-label={`On ${target.name}, ${plan.slotLabel}`} role="group">
            <p className="sh-compare-head">
              {roster.length > 1 && !armedHero ? (
                <select
                  className="sh-compare-who"
                  value={target.id}
                  aria-label="Equip on which hero"
                  onChange={(e) => useGearTarget.setState({ heroId: e.target.value })}
                >
                  {roster.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              ) : (
                <b>{target.name}</b>
              )}
              <span>{plan.slotLabel}</span>
            </p>
            {deltas.length === 0 ? (
              <p className="sh-line muted">No change to {target.name}&rsquo;s numbers.</p>
            ) : (
              <ul className="sh-deltas">
                {deltas.map((d) => (
                  <li key={d.label} className={d.after > d.before ? 'up' : 'down'}>
                    <span>{d.label}</span>
                    <span>
                      {d.a} → <b>{d.b}</b> <i aria-hidden="true">{d.after > d.before ? '▲' : '▼'}</i>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {fresh.map((f) => (
              <p className="sh-line accent" key={f}>
                <span className="sh-new">New</span> {f}
              </p>
            ))}
            {/* M26 — a two-hander ejects the off hand and an off-hand ejects a
                held two-hander. They go back to the pack, so this is a line,
                not a confirm — what was wrong was that it happened unsaid. */}
            {ejection && (
              <p className="sh-line muted">
                <Icon name="back" /> {ejection}
              </p>
            )}
            {swingTurn && (
              <p className="sh-line muted">
                <Icon name="blade" /> {swingTurn}
              </p>
            )}
          </div>
        )}
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
        {twin && (
          <p className={`sh-line ${twin.check.ok ? 'accent' : 'muted'}`}>
            {twin.check.ok
              ? `${TWINBLADE}: ${twin.hero.name} can carry it in the off hand too, at full strength.`
              : `${TWINBLADE}: ${twin.hero.name} has ${Math.floor(twin.check.dex)} DEX of ${twin.check.need} — not in the off hand yet.`}
          </p>
        )}
        {wearer && (
          <p className="sh-line muted">
            Worn by {wearer.name} · {wornSlot ? HERO_SLOT_LABEL[wornSlot] : ''}
          </p>
        )}
        {/* `title` carried the only explanation of what these two buttons do,
            and `title` does not exist on touch — so it is an `aria-label` now.
            No prose line to go with it: the panel is ~176px wide with a pinned
            foot, and two more lines of explanation pushed the buttons they
            explain off the bottom of the scroll. */}
        {/* Mid-wave the whole item is locked (the foot says so): no crafting. */}
        {!locked && (
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
        )}
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
        {!wearer && !locked && (
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
          <p className="sh-line bad" role="alert" ref={scrapNoticeRef}>
            <Icon name="warn" /> {scrap.notice}
          </p>
        )}
      </div>
      <div className="sh-context-foot">
        {locked && (target || wearer) ? (
          <GearLockNote />
        ) : target && plan ? (
          <button
            className="sh-btn primary"
            onClick={() => {
              equipItem(target.id, plan.slot, item.id)
              clearGearSlot()
              useGearTarget.setState({ heroId: target.id })
              shellSelect(null)
            }}
            aria-label={`Equip ${itemName(item)} on ${target.name}, ${plan.slotLabel}${ejection ? `. ${ejection}` : ''}${clash ? `. ${clash.text}` : ''}`}
          >
            Equip → {target.name}
          </button>
        ) : wearer && wornSlot ? (
          <>
            <button
              className="sh-btn"
              onClick={() => {
                unequipItem(wearer.id, wornSlot)
                shellSelect(null)
              }}
            >
              Unequip
            </button>
            {/* Swap in two taps: arm this slot, then tap the replacement in the
                pack — the pack filters to what fits. */}
            <button
              className="sh-btn"
              onClick={() => {
                shellSelect(null)
                activateGearSlot(wearer.id, wornSlot)
              }}
            >
              Swap
            </button>
          </>
        ) : null}
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

/**
 * The designer: "items locked during rounds". While a sub-wave is live, gear
 * cannot change; where the equip controls would be, this says so calmly — a
 * small drawn lock and one line — instead of controls that do nothing. It
 * goes the moment the round ends (the breather or the next setup).
 */
export const GEAR_LOCK_LINE = 'Gear locks during a wave'
function GearLockNote({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`sh-lock${compact ? ' compact' : ''}`}>
      <span className="sh-lock-glyph" aria-hidden="true" />
      {GEAR_LOCK_LINE}
    </p>
  )
}

/**
 * R3-2 — the gear as a paper doll.
 *
 * The designer: "a little human body type model with the item slots over it —
 * left hand on left, head up top, chest in middle". The three slots used to be
 * three stacked text boxes (MAIN HAND / OFF HAND / BODY) that Whales flagged as
 * faint on the desk rail; they now sit where they go on a small body: the body
 * slot on the chest, the off hand on the left, the main hand on the right (as
 * the heroes hold them on the field — shield left, weapon right), the hands at
 * the hips with the arms running down into them, head above, legs below.
 *
 * WHY A BODY MODEL AND NOT THE HERO'S SPRITE. The default Tiny Swords heroes
 * are chibi figures with their weapons painted in (the fighter always holds a
 * sword and shield, whatever is equipped), so their silhouette shows gear the
 * hero is not wearing and puts the hands where a 44px slot cannot follow. The
 * `loadout.ts` compositor only has art for the placeholder pack's fighter. So
 * the figure is drawn here from blocks on whole CSS pixels (crisp at any DPR,
 * nothing scaled), in the selected hero's archetype hue — it is still THEIR
 * doll, and the column head still names them.
 *
 * INTERACTION IS UNCHANGED (FIGMA.md rule three): tap an empty slot → the pack
 * filters to what fits → tap an item to put it on; tap a worn slot → that item
 * opens in the context panel. Every slot is a real button, at least
 * `--hit-min` square, with its state in its accessible name ("Main Hand: Axe,
 * Rare" / "Off Hand: empty"), in DOM order Body → Off Hand → Main Hand — the
 * doll's reading order (top, then left to right), so Tab walks it as seen.
 *
 * NARROW COLUMNS. Two hands side by side need 2 × `--hit-min` of column. Where
 * the column cannot give that (a phone under 390px, Large UI on a phone) a
 * container query drops the figure and stacks the same three buttons in the
 * same order — see `.sh-doll` in shell.css.
 *
 * AMBIDEXTROUS. With the relic held the off hand also takes a one-handed weapon
 * (`items.heroSlotsFor`): its outline changes (teal, doubled), an empty one
 * carries a small blade mark, and its accessible name says so.
 */
const DOLL_ORDER: readonly HeroSlot[] = ['body', 'offHand', 'mainHand']
/** The one-word slot names the narrow stack prints over a worn item's picture. */
const SLOT_SHORT: Record<HeroSlot, string> = { mainHand: 'MAIN', offHand: 'OFF', body: 'BODY' }

function GearColumn() {
  const roster = useGameStore((s) => s.roster)
  const selection = useGameStore((s) => s.shellSelection)
  const gearSlot = useGameStore((s) => s.gearSlot)
  const activateGearSlot = useGameStore((s) => s.activateGearSlot)
  const clearGearSlot = useGameStore((s) => s.clearGearSlot)
  const shellSelect = useGameStore((s) => s.shellSelect)
  const relics = useGameStore((s) => s.relics)
  const rules = equipRules(relics)
  // During a live sub-wave gear is locked: worn pieces still open (to read),
  // empty slots are not offered, and the column says why.
  const locked = useGameStore(gearLocked)

  // Follows the selected hero, then the last hero you looked at (an item tap
  // is a different selection, and used to snap this back to `roster[0]`), and
  // only then the first of the roster — and it SAYS whose it is (Phase 2).
  const gearTargetId = useGearTarget((s) => s.heroId)
  const inventory = useGameStore((s) => s.inventory)
  // A loose item selected: show the gear it would be compared against.
  const looseItem = selection?.kind === 'item' ? inventory.find((i) => i.id === selection.id) : undefined
  const hero =
    (selection?.kind === 'hero' ? roster.find((h) => h.id === selection.id) : undefined) ??
    (looseItem ? equipTarget(roster, looseItem, gearSlot?.sentinelId, gearTargetId, rules) : undefined) ??
    roster.find((h) => h.id === gearTargetId) ??
    roster[0]
  // Round 3 (Q4): the Twinblade Harness is company-wide, its check per hero.
  const twin = hero ? dualWieldCheck(hero, rules) : null
  const ambi = !!twin?.ok
  /** The off hand's rule, in words — the slot's accessible name carries it. */
  const offRule = !twin?.relic
    ? `takes ${OFF_HAND_TAKES}`
    : twin.ok
      ? `${TWINBLADE}: takes ${TWINBLADE_TAKES} too, at full strength`
      : `takes ${OFF_HAND_TAKES}; ${TWINBLADE}: ${dualWieldShort(hero!.name, twin)}`

  return (
    <div className="sh-gear" role="group" aria-label={hero ? `${hero.name}'s gear` : 'Gear'}>
      <div className="sh-col-head sh-gear-head">
        <span>GEAR</span>
        {hero && <span className="sh-gear-who">{hero.name}</span>}
      </div>
      {hero ? (
        <div className={`sh-gear-slots sh-doll${ambi ? ' ambi' : ''}`} style={{ '--doll-hue': archetypeVar(hero.archetype) } as CSSProperties}>
          {/* The body model: decoration under the slots, never a target. */}
          <span className="sh-doll-fig" aria-hidden="true">
            <i className="sh-doll-head" />
            <i className="sh-doll-arms" />
            <i className="sh-doll-legs" />
          </span>
          {DOLL_ORDER.map((hs) => {
            const worn = hero.equipment[hs]
            const active = gearSlot?.sentinelId === hero.id && gearSlot.slot === hs
            const dual = ambi && hs === 'offHand'
            const slotName = hs === 'offHand' ? `${HERO_SLOT_LABEL[hs]} (${offRule})` : HERO_SLOT_LABEL[hs]
            return (
              <button
                key={hs}
                disabled={locked && !worn}
                className={`sh-slot sh-doll-slot sh-doll-${hs} ${worn ? 'filled' : 'empty'}${active ? ' active' : ''}${dual ? ' dual' : ''}`}
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
                    ? `${slotName}: ${itemName(worn)}, ${RARITY[worn.rarity].label}`
                    : locked
                      ? `${slotName}: empty — ${GEAR_LOCK_LINE.toLowerCase()}`
                      : active
                      ? `${slotName}: choosing — pick something from the pack`
                      : `${slotName}: empty`
                }
              >
                {/* Rarity as a letter as well as a hue (M27c). */}
                {worn && (
                  <span className="sh-slot-rar" aria-hidden="true">
                    {RARITY_INITIAL[worn.rarity]}
                  </span>
                )}
                {/* What the empty off hand takes (round 3, Q5): a small-things
                    mark — the knife — or, for a hero the Twinblade Harness
                    lets dual-wield, the blade. */}
                {hs === 'offHand' && !worn && (
                  <span className={dual ? 'sh-slot-dual' : 'sh-slot-takes'} aria-hidden="true">
                    <Icon name={dual ? 'blade' : 'dagger'} />
                  </span>
                )}
                {/* A worn slot draws what is in it, and where the doll has no
                    room for words the position says which slot it is. An empty
                    slot keeps its words — they are the only thing in it. */}
                <span className="sh-slot-label">{HERO_SLOT_LABEL[hs]}</span>
                <span className="sh-slot-short" aria-hidden="true">
                  {SLOT_SHORT[hs]}
                </span>
                {worn ? (
                  <span className="sh-slot-mark" aria-hidden="true">
                    <Icon name={itemIcon(worn)} />
                  </span>
                ) : (
                  <span className="sh-slot-mark sh-slot-plus" aria-hidden="true">
                    {active ? '…' : '+'}
                  </span>
                )}
              </button>
            )
          })}
          {/* Which relic changed the off hand — its name, and when this hero
              falls short of its check, by how much. */}
          {twin?.relic && (
            <span className={`sh-doll-note${twin.ok ? '' : ' short'}`}>
              <span>Twinblade</span>
              {!twin.ok && <span>{`DEX ${Math.floor(twin.dex)}/${twin.need}`}</span>}
            </span>
          )}
        </div>
      ) : null}
      {/* Once, where the controls are: an open item's panel says it in its foot. */}
      {locked && hero && selection?.kind !== 'item' && <GearLockNote compact />}
      {/* The desk rail has the height the phone does not: there the doll is
          captioned with what each hand holds, in words (Whales, round 1: the
          desk's gear labels were the faintest text on the rail). Hidden from
          assistive tech — each slot button already says exactly this. */}
      {hero && (
        <ul className="sh-doll-legend" aria-hidden="true">
          {DOLL_ORDER.map((hs) => {
            const worn = hero.equipment[hs]
            return (
              <li key={hs}>
                <span>{HERO_SLOT_LABEL[hs]}</span>
                <b className={worn ? '' : 'none'}>{worn ? itemName(worn) : 'empty'}</b>
              </li>
            )
          })}
        </ul>
      )}
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
  const relics = useGameStore((s) => s.relics)
  const roster = useGameStore((s) => s.roster)
  // Round 3 (Q4 + Q5): what fits is the item's grip, and — for a main-hand
  // one-hander in the off hand — the Twinblade Harness and THIS hero's DEX.
  const rules = equipRules(relics)
  const armedHero = gearSlot ? roster.find((h) => h.id === gearSlot.sentinelId) : undefined

  // With a gear slot armed the pack filters to what fits it — that replaces the
  // whole equip drawer.
  const fitsArmed = (i: Item) => !!gearSlot && heroSlotsFor(i, armedHero, rules).includes(gearSlot.slot)
  const fits = (i: Item) => !gearSlot || fitsArmed(i)
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
            aria-label={[`${itemName(i)}, ${RARITY[i.rarity].label} ${GRIP_NAME[gripOf(i)]}`, markLabel(damageMark(i))]
              .filter(Boolean)
              .join(', ')}
            onClick={() => {
              if (gearSlot && fitsArmed(i)) {
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

/*
 * The equip kinds, spelled out — a glyph is not an accessible name, and neither
 * is a sprite — are `channels.GRIP_NAME` now (round 3): by the hand an item
 * fits, so a knife says "light weapon, either hand" where a sword says
 * "one-handed weapon". `itemIcon` draws the noun.
 */

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
