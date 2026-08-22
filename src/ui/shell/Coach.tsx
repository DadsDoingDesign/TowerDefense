import { useEffect, useRef, useState, type ReactNode } from 'react'
import { HERO_SLOTS } from '../../game/data/items'
import { useGameStore } from '../../state/gameStore'
import { useSettingsStore, type TeachId } from '../../state/settingsStore'
import { Icon } from '../Icon'
import type { IconKey } from '../channels'

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
 *    `pickTip` returns at most one tip, ever. It is a priority list, not a
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
 *    makes it true — the deploy tip only while nothing is deployed, the Threat
 *    tip only once the Threat chip is actually on screen, the evolution tip only
 *    when a hero is within two levels of the choice.
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

  const deployed = roster.filter((h) => Object.values(placements).includes(h.id)).length
  const wearingAnything = roster.some((h) => HERO_SLOTS.some((slot) => !!h.equipment[slot]))
  const inSetup = screen === 'battle' && battlePhase === 'setup'

  // Rule 3: a lesson performed is a lesson learnt. Doing this in an effect
  // rather than inside `pickTip` keeps the picker pure and keeps the write
  // out of the render pass.
  useEffect(() => {
    if (deployed > 0) markTaught('deploy')
  }, [deployed, markTaught])
  useEffect(() => {
    if (wearingAnything) markTaught('equip')
  }, [wearingAnything, markTaught])

  // The evolution heads-up has to arrive BEFORE the choice does. Once a hero is
  // in the queue the blocking modal is already up and the tip is too late — it
  // explains itself there instead (see EvolutionModal).
  const nearEvolution = roster.find((h) => h.level >= 8 && h.level < 10 && !evolutionQueue.includes(h.id))

  const tip = pickTip({
    taught,
    inSetup,
    deployed,
    packCount: inventory.length,
    wearingAnything,
    showThreat: mode === 'campaign' && threat > 1.001,
    nearEvolution: nearEvolution?.name,
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

  if (!tip || displayed !== tip.id) return null

  return (
    <aside className="sh-coach" role="status" aria-live="polite">
      <Icon name={tip.icon} className="sh-coach-glyph" />
      <p className="sh-coach-text">{tip.body}</p>
      {/*
       * "Got it", not `✕` (M8).
       *
       * `✕` already means something on this screen: the renderer draws a red ✕
       * over a Sentinel that has fallen on the field, and both marks are red on
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
 * Which single tip is live. Pure and exported-shaped so the ordering can be
 * reasoned about (and tested) without a browser.
 *
 * Ordered by urgency rather than by when a player meets them: the two late
 * tips cannot fire before their early siblings are long since taught, and if a
 * returning player somehow met both at once, the one with a deadline wins.
 */
function pickTip(s: {
  taught: Record<TeachId, boolean>
  inSetup: boolean
  deployed: number
  packCount: number
  wearingAnything: boolean
  showThreat: boolean
  nearEvolution?: string
}): Tip | null {
  if (!s.taught.evolve && s.nearEvolution) {
    return {
      id: 'evolve',
      icon: 'evolve',
      body: (
        <>
          <b>{s.nearEvolution}</b> nears Level 10 — a permanent branch choice that cannot be swapped
          later.
        </>
      ),
    }
  }
  if (!s.taught.threat && s.showThreat) {
    return {
      id: 'threat',
      icon: 'threat',
      body: (
        <>
          {/* The chip up top was `⚡` when this string was written and has been
              `<Icon name="threat"/>` — three climbing bars — since P3. Telling
              the player to look for a mark that is not on the screen is worse
              than not pointing at all, so the tip names the chip by its LABEL,
              which is the half that cannot go stale (M11). */}
          <b>Threat</b> — the multiplier chip up top — raises the HP of everything the horde
          brings. It climbs with every node cleared.
        </>
      ),
    }
  }
  if (!s.taught.deploy && s.inSetup && s.deployed === 0) {
    return {
      id: 'deploy',
      // `wave` before (M8). That one pennant was carrying four unrelated
      // meanings — an incoming wave, the wave-clear beat, "start a campaign"
      // and this, "post a Sentinel on a slot" — and a picture with four
      // meanings teaches none of them. `deploy` is a caret coming down onto the
      // dashed slot marker the sentence below tells the player to look for.
      icon: 'deploy',
      body: (
        <>
          Tap a Sentinel below, then a <b>marked slot</b> on the field. Start Wave lights up once one is
          posted.
        </>
      ),
    }
  }
  if (!s.taught.equip && s.inSetup && s.packCount > 0 && !s.wearingAnything) {
    return {
      id: 'equip',
      // `settings` before — a cog, which is the Settings screen's mark, on a
      // tip about putting armour on (M8). `equip` draws the dashed `+` the
      // sentence names, so the picture and the instruction point at the same
      // pixels on the same screen.
      icon: 'equip',
      body: (
        <>
          <b>{s.packCount} unworn</b> {s.packCount === 1 ? 'piece' : 'pieces'} in your pack. Tap a dashed{' '}
          <b>+</b> under GEAR, then an item to put it on.
        </>
      ),
    }
  }
  return null
}
