import { useEffect, useRef, useState, type ReactNode } from 'react'
import { HERO_SLOTS } from '../../game/data/items'
import { DANGER_COPY } from '../../game/data/hazards'
import { fieldConflicts } from '../../state/game/selectors'
import { BLOCK_COPY, HELD_COPY, ROOM_COPY, terrainRuleById } from '../../game/data/terrain'
import { commandsFor, WATCH_COMMANDS } from '../../game/data/commands'
import { relicCommands } from '../../game/data/relics'
import { TIER1_LEVEL } from '../../game/engine/leveling'
import { pendingPerkLevel } from '../../game/run/perks'
import { useGameStore } from '../../state/gameStore'
import { useSettingsStore, type TeachId } from '../../state/settingsStore'
import { Icon } from '../Icon'
import { strengthPct, strengthText, type IconKey } from '../channels'
import { Tap } from '../pointer'
import { rewardInPlace } from './levelUps'
import { useShown } from './staging'
import { pickTipId, type TipFacts } from './coachRules'

/**
 * First-run teaching (WS9).
 *
 * The game had none — no tutorial, no coach marks, no glossary, no first-run
 * flags anywhere in the tree — and it opens onto a 27-node evolution tree, a
 * Threat multiplier, Patience, keepsakes and enchant stacking. Everything was
 * learn-by-autopsy.
 *
 * The rules this follows, in order of how much they cost to break:
 *
 * 1. **One idea at a time — and one idea at a time in the same PLACE.**
 *    `pickTipId` returns at most one tip, ever. It is a priority list, not a
 *    queue that drains: the most urgent live tip wins and the rest wait for
 *    their own moment.
 *
 *    That was honoured per moment and broken per screen. A fresh run starts
 *    with three unworn items, so the instant the player follows the deploy tip
 *    the deploy tip retires itself (rule three) and the equip tip fills the
 *    exact same strip about two seconds later. Two different lessons, same
 *    place, no gap: it does not read as "well done, here is the next idea", it
 *    reads as one bar that keeps nagging — and for a screen-reader user it is
 *    two `aria-live` announcements on top of each other. `COACH_GAP_MS` below
 *    makes the strip go quiet in between, so the second tip arrives as a new
 *    thought rather than as more of the same one (F10).
 * 2. **In context, at the moment of need.** Each tip is bound to the state that
 *    makes it true — the deploy tip only while nothing is deployed, the enemy
 *    strength tip only once its chip is actually on screen, the evolution tip
 *    only when a hero is within two levels of the choice.
 *
 *    LS3 made this the whole first-run teaching: the first run shows an idea
 *    only when it matters (`state/staging.ts`), and each staged idea has ONE
 *    tip here, said the first time the idea is on screen and never again —
 *    sub-waves and speed at the first breather, gear and the pack at the first
 *    win's spoils, the Watch Command in the second fight's setup, the road's
 *    depth and the first merchant on the map, relics at the first elite, perks
 *    at a hero's first choice, cursed ground and map challenges on the first
 *    field that has them. The ORDER lives in `coachRules.ts`, pure and tested.
 * 3. **Teach by doing, then get out of the way.** A tip whose lesson the player
 *    has just performed marks itself seen without being dismissed — deploy a
 *    hero and the deploy tip is finished with, equip anything and the equip tip
 *    is finished with. Nobody should have to close a hint about a thing they
 *    have already done.
 * 4. **Skippable, and permanently so.** "Got it" marks it seen; the flags live in
 *    `settingsStore` so they outlive the run, and Settings carries a "Show the
 *    tips again" row for anyone who wants them back.
 *
 * It renders into its own grid row above the Stage (see `.sh-coach` in
 * shell.css) rather than as an overlay, so it never covers the battlefield
 * (rule two of the shell) and never moves a control under a finger.
 */
interface Tip {
  id: TeachId
  icon: IconKey
  body: ReactNode
}

/**
 * How long the strip stays empty after one tip leaves before another may take
 * its place.
 *
 * Long enough that the player looks away and back — the point is that the strip
 * is visibly EMPTY in between, so the next tip is a new thing appearing rather
 * than the same bar changing its words. Short enough that the second lesson is
 * still in the moment it belongs to: the equip tip is most useful before the
 * first wave, so the answer here is a pause, not a different beat in the run.
 *
 * It gates the first tip after any other tip, not just the deploy/equip pair —
 * the same collision is available to every future pair, and the rule "one idea
 * at a time" should not have to be re-derived for each of them.
 */
const COACH_GAP_MS = 9000

/** How long a blocked-tile note stays in the strip (G1-2). */
const FIELD_NOTE_MS = 4500
const inSetupOrBreather = (screen: string, phase: string) => screen === 'battle' && (phase === 'setup' || phase === 'battle')

export function Coach() {
  const taught = useSettingsStore((s) => s.taught)
  const markTaught = useSettingsStore((s) => s.markTaught)

  const screen = useGameStore((s) => s.screen)
  const mode = useGameStore((s) => s.mode)
  const battlePhase = useGameStore((s) => s.battlePhase)
  const roster = useGameStore((s) => s.roster)
  const placements = useGameStore((s) => s.placements)
  const inventory = useGameStore((s) => s.inventory)
  const threat = useGameStore((s) => s.threat)
  const evolutionQueue = useGameStore((s) => s.evolutionQueue)
  const speed = useGameStore((s) => s.speed)
  const breather = useGameStore((s) => s.hud.breather)
  const subWave = useGameStore((s) => s.hud.subWave)
  const relics = useGameStore((s) => s.relics)
  const battleMap = useGameStore((s) => s.battleMap)
  const runMap = useGameStore((s) => s.runMap)
  const reachable = useGameStore((s) => s.reachableNodeIds)
  const activeNodeId = useGameStore((s) => s.activeNodeId)
  const currentNodeId = useGameStore((s) => s.currentNodeId)
  const reward = useGameStore((s) => s.reward)
  const inPlace = useGameStore(rewardInPlace)
  // The engine's own flag: true from the first tick until the charge is spent.
  const commandUsed = useGameStore((s) => !!s.engine && s.engine.status === 'running' && !s.engine.commandReady)
  // Weapon clearance: while a conflict holds the wave the strip says what to
  // do; a tip beside it ("Move one hero if you like, then Next") would
  // contradict the disabled button. The tip comes back once space is made.
  const conflicted = useGameStore((s) => !s.lastResult && fieldConflicts(s).length > 0)

  // LS3: a tip is about something on screen, so it may only speak once its
  // idea is shown (`state/staging.ts`) — never ahead of the thing it names.
  const speedShown = useShown('speed')
  const subwaveShown = useShown('subwave')
  const gearShown = useShown('gear')
  const commandShown = useShown('command')
  const depthShown = useShown('depth')

  const deployed = roster.filter((h) => Object.values(placements).includes(h.id)).length
  const wearingAnything = roster.some((h) => HERO_SLOTS.some((slot) => !!h.equipment[slot]))
  // Setup is BEFORE the wave: a settled wave also reads 'setup' (with its
  // result standing), and a tip about posting or the next fight does not
  // belong on the reward.
  const settled = useGameStore((s) => !!s.lastResult)
  const inSetup = screen === 'battle' && battlePhase === 'setup' && !settled
  const onMap = screen === 'map'

  // Rule 3: a lesson performed is a lesson learnt. Doing this in an effect
  // rather than inside `pickTip` keeps the picker pure and keeps the write
  // out of the render pass.
  useEffect(() => {
    if (deployed > 0) markTaught('deploy')
  }, [deployed, markTaught])
  useEffect(() => {
    if (wearingAnything) markTaught('equip')
  }, [wearingAnything, markTaught])
  useEffect(() => {
    if (speed > 1) markTaught('speed')
  }, [speed, markTaught])
  // Sending the next sub-wave is the breather's lesson performed.
  // (`subWave` counts up as a breather BEGINS, so it is the breather ending.)
  useEffect(() => {
    if (subWave > 0 && !breather) markTaught('subwave')
  }, [subWave, breather, markTaught])
  useEffect(() => {
    if (commandUsed) markTaught('command')
  }, [commandUsed, markTaught])
  const tookPerk = roster.some((h) => (h.perks?.length ?? 0) > 0)
  useEffect(() => {
    if (tookPerk) markTaught('perk')
  }, [tookPerk, markTaught])

  // The evolution heads-up has to arrive BEFORE the choice does. Once a hero is
  // in the queue the blocking modal is already up and the tip is too late — it
  // explains itself there instead (see EvolutionModal).
  const nearEvolution = roster.find((h) => h.level >= 8 && h.level < 10 && !evolutionQueue.includes(h.id))
  const owesPerk = roster.find((h) => pendingPerkLevel(h) !== null && !evolutionQueue.includes(h.id))

  const node = (id: string | null) => runMap.nodes.find((n) => n.id === id)
  const nodeHere = node(activeNodeId)
  const depth = node(screen === 'battle' && activeNodeId ? activeNodeId : currentNodeId)?.layer ?? 0
  const command = WATCH_COMMANDS[commandsFor(relicCommands(relics))[0]]
  const rule = terrainRuleById(battleMap.terrainRule)

  const tip = pickTip({
    taught,
    inSetup,
    deployed,
    packCount: inventory.length,
    wearingAnything,
    showThreat: mode === 'campaign' && threat > 1.001,
    threat,
    nearEvolution: nearEvolution?.name,
    owesPerk: owesPerk && (onMap || inSetup || inPlace) ? owesPerk.name : undefined,
    danger: inSetup && !!battleMap.tiles?.some((t) => t.danger === 'cursed'),
    challenge: inSetup && rule ? { name: rule.name, blurb: rule.blurb } : undefined,
    elite: inSetup && nodeHere?.type === 'elite',
    relicOffered: inPlace && !!reward?.some((c) => c.kind === 'relic'),
    command: mode === 'campaign' && inSetup && deployed > 0 && commandShown && command ? { name: command.name, blurb: command.blurb } : undefined,
    subwave: screen === 'battle' && battlePhase === 'battle' && breather && subwaveShown,
    speed: screen === 'battle' && battlePhase === 'battle' && breather && speedShown,
    gear: gearShown && mode === 'campaign' && (inPlace || onMap),
    depth: depthShown && mode === 'campaign' && onMap ? { depth, last: Math.max(depth, runMap.layers - 1) } : undefined,
    merchant: mode === 'campaign' && onMap && reachable.some((id) => node(id)?.type === 'merchant'),
  })

  /*
   * The quiet window (rule one, F10).
   *
   * What the strip renders is `displayed`, NOT the picker's live answer. That
   * indirection is the whole mechanism: the moment the picker moves off what is
   * on screen, the strip goes empty on that same render — the replacement never
   * gets a frame — and the window opens. Deciding it in an effect instead would
   * let the next tip paint once before the gate closed on it, which is the flash
   * this exists to remove.
   *
   * The waiting tip is not queued. When the window closes the strip asks the
   * picker again, so `pickTip` stays the single source of what matters right
   * now — a tip whose moment has passed in the meantime never arrives late.
   */
  const [displayed, setDisplayed] = useState<TeachId | null>(null)
  const quietUntil = useRef(0)

  useEffect(() => {
    const id = tip?.id ?? null
    if (id === displayed) return
    if (displayed !== null) {
      quietUntil.current = Date.now() + COACH_GAP_MS
      setDisplayed(null)
      return
    }
    const wait = quietUntil.current - Date.now()
    if (wait <= 0) {
      setDisplayed(id)
      return
    }
    // Nothing else is guaranteed to re-render when the window closes — the
    // store can sit still for the whole nine seconds — so wake up and ask.
    const t = setTimeout(() => setDisplayed(tip?.id ?? null), wait + 20)
    return () => clearTimeout(t)
  }, [tip?.id, displayed])

  /*
   * G1-2: a tap on a blocked tile says why, here, instead of doing nothing.
   * It outranks any tip and skips the quiet window — it is an answer to
   * something the player just did, not a lesson — and it clears itself after
   * a few seconds (or on "Got it", or on the next good tap).
   */
  const fieldNote = useGameStore((s) => s.fieldNote)
  const clearFieldNote = useGameStore((s) => s.clearFieldNote)
  useEffect(() => {
    if (!fieldNote) return
    const t = setTimeout(clearFieldNote, FIELD_NOTE_MS)
    return () => clearTimeout(t)
  }, [fieldNote, clearFieldNote])

  if (fieldNote && inSetupOrBreather(screen, battlePhase)) {
    // Q1: the note is a blocked tile's reason, or cursed ground's cost (or,
    // that a hero stands too close to one that swings, `terrain.CLEARANCE`;
    // or that posts are held while a sub-wave is live).
    const base =
      fieldNote.kind === 'cursed'
        ? DANGER_COPY.cursed
        : fieldNote.kind === 'crowded'
          ? ROOM_COPY
          : fieldNote.kind === 'held'
            ? HELD_COPY
            : BLOCK_COPY[fieldNote.kind]
    // A crowded tile names who swings, and with what (`run/clearance.roomLine`).
    const copy = fieldNote.line?.startsWith(base.name) ? { name: base.name, line: fieldNote.line } : base
    return (
      <aside className="sh-coach sh-coach-note" role="status" aria-live="polite">
        <Icon name="warn" className="sh-coach-glyph" />
        <p className="sh-coach-text" key={fieldNote.at}>
          <b>{copy.name}</b>
          {copy.line.slice(copy.name.length)}
        </p>
        <button className="sh-coach-dismiss" onClick={clearFieldNote} aria-label="Got it — hide this note" data-sfx="close">
          Got it
        </button>
      </aside>
    )
  }

  if (!tip || displayed !== tip.id || conflicted) return null

  return (
    <aside className="sh-coach" role="status" aria-live="polite">
      <Icon name={tip.icon} className="sh-coach-glyph" />
      <p className="sh-coach-text">{tip.body}</p>
      {/*
       * "Got it", not `✕` (M8).
       *
       * `✕` used to mean something else on this screen: the renderer drew a red ✕
       * over a Sentinel that had fallen (before heroes lost their HP), and both were red on
       * dark, both are reachable during setup, and one of them is a control.
       * A glyph that means "a hero is dead" and "close this" at the same time
       * on the same screen is worse than no glyph.
       *
       * The word is also the better button on its own terms: it says what
       * pressing it asserts (I have read this) rather than what it does to the
       * strip, it is the same string the accessible name already carried, and
       * it makes the target self-evidently tappable in a way a 12px glyph never
       * is. `aria-label` stays because the visible word alone does not say what
       * is being got.
       */}
      <button
        className="sh-coach-dismiss"
        onClick={() => markTaught(tip.id)}
        aria-label="Got it — hide this tip"
        data-sfx="close"
      >
        Got it
      </button>
    </aside>
  )
}

/**
 * The tip `pickTipId` (`coachRules.ts`) names, as the strip renders it. The
 * ORDER lives there, pure and tested; this is only the words and the picture.
 */
export function pickTip(s: TipFacts): Tip | null {
  const id = pickTipId(s)
  if (!id) return null
  switch (id) {
    case 'evolve':
      return {
        id,
        icon: 'evolve',
        body: (
          <>
            At level {TIER1_LEVEL}, <b>{s.nearEvolution}</b> picks a path. It&rsquo;s permanent.
          </>
        ),
      }
    case 'perk':
      return {
        id,
        icon: 'boon',
        body: (
          <>
            <b>{s.owesPerk}</b> can pick a <b>perk</b>. <Tap /> the glowing hero to choose — it&rsquo;s permanent.
          </>
        ),
      }
    case 'danger':
      return {
        id,
        icon: 'warn',
        body: (
          <>
            <b>{DANGER_COPY.cursed.name}</b> (the skull tiles): a hero can stand there, but deals {DANGER_COPY.cursed.short}.
          </>
        ),
      }
    case 'challenge':
      return {
        id,
        icon: 'map',
        body: (
          <>
            <b>{s.challenge?.name}</b>: {s.challenge?.blurb}
          </>
        ),
      }
    case 'deploy':
      return {
        id,
        // `wave` before (M8). That one pennant was carrying four unrelated
        // meanings — an incoming wave, the wave-clear beat, "start a campaign"
        // and this, "post a hero on a slot" — and a picture with four
        // meanings teaches none of them. `deploy` is a caret coming down onto
        // the dashed slot marker the sentence below tells the player to look for.
        icon: 'deploy',
        body: (
          <>
            <Tap /> your hero, then a <b>glowing tile</b> on the field.
          </>
        ),
      }
    case 'relic':
      return {
        id,
        icon: 'relic',
        body: s.elite ? (
          <>
            An <b>elite</b>: tougher goblins, and a <b>relic</b> in the spoils. A relic helps all your heroes for the rest of the run.
          </>
        ) : (
          <>
            A <b>relic</b> helps all your heroes for the rest of the run.
          </>
        ),
      }
    case 'command':
      return {
        id,
        icon: 'orders',
        body: (
          <>
            New: <b>{s.command?.name}</b>, once per sub-wave in the fight. {s.command?.blurb}.
          </>
        ),
      }
    case 'subwave':
      return {
        id,
        icon: 'wave',
        body: (
          <>
            A <b>sub-wave</b> is down and the fight is paused. Move one hero if you like, then <b>Next</b>.
          </>
        ),
      }
    case 'speed':
      return {
        id,
        icon: 'haste',
        body: (
          <>
            <b>Speed</b> fast-forwards the fight. <Tap /> it for 2× or 3×.
          </>
        ),
      }
    case 'gear':
      return {
        id,
        icon: 'equip',
        body: (
          <>
            Items you win land in your <b>pack</b>. <Tap /> a slot under <b>Gear</b> to wear one.
          </>
        ),
      }
    case 'threat':
      return {
        id,
        icon: 'threat',
        body: (
          <>
            {/* Names the chip by its LABEL, the half that cannot go stale (M11),
                and says what the number does in one plain clause. */}
            <b>{strengthText(s.threat)}</b>: enemies have {strengthPct(s.threat)}% more HP. It rises at every stop.
          </>
        ),
      }
    case 'equip':
      return {
        id,
        // `settings` before — a cog, which is the Settings screen's mark, on a
        // tip about putting armour on (M8). `equip` draws the dashed `+` the
        // sentence names, so the picture and the instruction point at the same
        // pixels on the same screen.
        icon: 'equip',
        body: (
          <>
            <b>
              {s.packCount} {s.packCount === 1 ? 'item' : 'items'}
            </b>{' '}
            to equip. <Tap /> a <b>+</b> under Gear.
          </>
        ),
      }
    case 'depth':
      return {
        id,
        icon: 'depth',
        body: (
          <>
            <b>
              Depth {s.depth?.depth}/{s.depth?.last}
            </b>
            : how far down the road you are. The boss waits at the end.
          </>
        ),
      }
    case 'merchant':
      return {
        id,
        icon: 'merchant',
        body: (
          <>
            A <b>Merchant</b> is in reach: spend gold on gear, a hire or Gate repair.
          </>
        ),
      }
  }
}
