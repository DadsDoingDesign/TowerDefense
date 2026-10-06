import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { HERO_SLOTS } from '../../game/data/items'
import { DANGER_COPY } from '../../game/data/hazards'
import { fieldConflicts } from '../../state/game/selectors'
import { BLOCK_COPY, HELD_COPY, ROOM_COPY, terrainRuleById } from '../../game/data/terrain'
import { commandsFor, WATCH_COMMANDS } from '../../game/data/commands'
import { relicCommands } from '../../game/data/relics'
import { pendingMilestone } from '../../game/run/skills'
import { announceHint } from '../../state/combatNotes'
import { useGameStore } from '../../state/gameStore'
import { useSettingsStore, type TeachId } from '../../state/settingsStore'
import { Icon } from '../Icon'
import { strengthPct, strengthText, type IconKey } from '../channels'
import { Tap } from '../pointer'
import { rewardInPlace, waveLive } from './levelUps'
import { useShown } from './staging'
import {
  noteWhere,
  pickPill,
  pickTipId,
  pillDurationMs,
  PILL_FADE_MS,
  SETTLE_QUIET_MS,
  stageCrowded,
  TIP_GAP_MS,
  tipWhere,
  wagonsLow,
  type PillWhere,
  type TipFacts,
} from './coachRules'

/**
 * First-run teaching (WS9), as a hint pill over the Stage (October 2026).
 *
 * The game had none — no tutorial, no coach marks, no glossary, no first-run
 * flags anywhere in the tree — and it opens onto a company, a road, gear,
 * enemy strength and a Watch Command. Everything was learn-by-autopsy.
 *
 * It used to be a grid row between the header and the Stage with a "Got it"
 * button. The player's verdict: a banner they constantly had to close, that
 * moved the content around. Both were true — the Stage was the row's only
 * donor, so every tip pushed the field down ~45–74px and its leaving pulled
 * it back, and a lesson that had to be dismissed was a chore on top of the
 * lesson. So the rules this follows now, in order of how much they cost to
 * break:
 *
 * 1. **It takes no layout space.** The pill floats over an EDGE of the Stage
 *    (`.sh-coach` in shell.css), `pointer-events: none`, so a finger lands on
 *    the field under it, and the Stage keeps one box for the whole battle.
 * 2. **It needs no tap.** It fades in, stays long enough to read
 *    (`pillDurationMs`: a floor plus a little per word, capped; the clock
 *    stops while the tab is hidden), fades out and marks its tip taught. The
 *    flags live in `settingsStore` so they outlive the run, and Settings
 *    carries a "Show the tips again" row.
 * 3. **One idea at a time, with a gap.** `pickTipId` returns at most one tip
 *    — a priority list, not a queue. When one leaves, the next waits
 *    `TIP_GAP_MS` so it arrives as a new thought, not the same hint changing
 *    its words (F10).
 * 4. **In context, at the moment of need.** Each tip is bound to the state
 *    that makes it true, and may speak only once its idea is on screen
 *    (`state/staging.ts`). A live wave hears only its breather lessons.
 * 5. **Teach by doing.** A lesson performed (a hero posted, an item worn, the
 *    speed changed) marks its tip taught at once, and the pill goes.
 * 6. **Never over what it teaches.** A tip about the party row, the wave strip
 *    or the gear floats on the Stage's BOTTOM edge, next to them; a tip about
 *    the field or the header on the top edge (`tipWhere`, `noteWhere`).
 * 7. **Heard, too.** Its words go through the one polite voice (`Announcer`,
 *    via `announceHint`); the pill itself is not a live region.
 */
interface Tip {
  id: TeachId
  icon: IconKey
  body: ReactNode
}

/** A field note's words: its name, and the line that starts with it. */
export function fieldNoteCopy(fieldNote: NonNullable<ReturnType<typeof useGameStore.getState>['fieldNote']>): { name: string; line: string } {
  const base =
    fieldNote.kind === 'cursed'
      ? DANGER_COPY.cursed
      : fieldNote.kind === 'crowded'
        ? ROOM_COPY
        : fieldNote.kind === 'held'
          ? HELD_COPY
          : BLOCK_COPY[fieldNote.kind]
  // A crowded tile names who swings, and with what (`run/clearance.roomLine`).
  return fieldNote.line?.startsWith(base.name) ? { name: base.name, line: fieldNote.line } : base
}

/** One thing the pill can hold. `key` changes when the content is a new thing. */
interface PillItem {
  key: string
  icon: IconKey
  where: PillWhere
  tone?: 'note'
  body: ReactNode
  /** Called once the pill has stayed its time and faded out. */
  done: () => void
}

/** The Stage's height, kept current (the reward-in-place layout shrinks it). */
function useHeight(el: RefObject<HTMLElement | null>): number {
  const [h, setH] = useState(0)
  useEffect(() => {
    const node = el.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setH(Math.round(node.getBoundingClientRect().height)))
    ro.observe(node)
    return () => ro.disconnect()
  }, [el])
  return h
}

export function Coach({ stage }: { stage: RefObject<HTMLElement | null> }) {
  const stageH = useHeight(stage)
  const taught = useSettingsStore((s) => s.taught)
  const markTaught = useSettingsStore((s) => s.markTaught)

  const screen = useGameStore((s) => s.screen)
  const battlePhase = useGameStore((s) => s.battlePhase)
  const roster = useGameStore((s) => s.roster)
  const placements = useGameStore((s) => s.placements)
  const inventory = useGameStore((s) => s.inventory)
  const threat = useGameStore((s) => s.threat)
  const live = useGameStore(waveLive)
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

  // Rule 5: a lesson performed is a lesson learnt. Doing this in an effect
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
  // SK1: a skill choice made is the milestone lesson learnt.
  const tookSkill = roster.some((h) => (h.skillPicks ?? 0) > 0)
  useEffect(() => {
    if (tookSkill) markTaught('skill')
  }, [tookSkill, markTaught])

  // The first milestone's tip speaks only when the choice can be made — never
  // over a live wave, where the choice waits.
  const owesSkill = live ? undefined : roster.find((h) => pendingMilestone(h) !== null)

  const node = (id: string | null) => runMap.nodes.find((n) => n.id === id)
  const nodeHere = node(activeNodeId)
  const depth = node(screen === 'battle' && activeNodeId ? activeNodeId : currentNodeId)?.layer ?? 0
  const command = WATCH_COMMANDS[commandsFor(relicCommands(relics))[0]]
  const rule = terrainRuleById(battleMap.terrainRule)

  const tip = pickTip({
    live,
    ceremonyCrowded: stageCrowded({ settled: screen === 'battle' && settled, stageH }),
    taught,
    inSetup,
    deployed,
    packCount: inventory.length,
    wearingAnything,
    showThreat: threat > 1.001,
    threat,
    owesSkill: owesSkill && (onMap || inSetup || inPlace) ? owesSkill.name : undefined,
    danger: inSetup && !!battleMap.tiles?.some((t) => t.danger === 'cursed'),
    challenge: inSetup && rule ? { name: rule.name, blurb: rule.blurb } : undefined,
    elite: inSetup && nodeHere?.type === 'elite',
    relicOffered: inPlace && !!reward?.some((c) => c.kind === 'relic'),
    command: inSetup && deployed > 0 && commandShown && command ? { name: command.name, blurb: command.blurb } : undefined,
    subwave: screen === 'battle' && battlePhase === 'battle' && breather && subwaveShown,
    speed: screen === 'battle' && battlePhase === 'battle' && breather && speedShown,
    gear: gearShown && (inPlace || onMap),
    depth: depthShown && onMap ? { depth, last: Math.max(depth, runMap.layers - 1) } : undefined,
    merchant: onMap && reachable.some((id) => node(id)?.type === 'merchant'),
  })

  /*
   * The quiet window (rule three, F10).
   *
   * What the pill shows is `displayed`, NOT the picker's live answer. The
   * moment the picker moves off what is on screen, the pill empties on that
   * same render — the replacement never gets a frame — and the window opens.
   * The waiting tip is not queued: when the window closes the pill asks the
   * picker again, so `pickTip` stays the single source of what matters now.
   */
  const [displayed, setDisplayed] = useState<TeachId | null>(null)
  const quietUntil = useRef(0)

  // The wave-clear beat: the Stage re-lays out for the reward (and may come
  // out too short for a pill, `stageCrowded`), so no tip speaks until it has
  // settled — or one would flash up and go. Declared before the effect below
  // so the window is open by the time it asks.
  useEffect(() => {
    if (settled) quietUntil.current = Math.max(quietUntil.current, Date.now() + SETTLE_QUIET_MS)
  }, [settled])

  useEffect(() => {
    const id = tip?.id ?? null
    if (id === displayed) return
    if (displayed !== null) {
      quietUntil.current = Date.now() + TIP_GAP_MS
      setDisplayed(null)
      return
    }
    const wait = quietUntil.current - Date.now()
    if (wait <= 0) {
      setDisplayed(id)
      return
    }
    // Nothing else is guaranteed to re-render when the window closes — the
    // store can sit still the whole time — so wake up and ask.
    const t = setTimeout(() => setDisplayed(tip?.id ?? null), wait + 20)
    return () => clearTimeout(t)
  }, [tip?.id, displayed])

  /*
   * G1-2: a tap on a blocked tile says why. It pre-empts any tip, at once —
   * it is an answer to something the player just did, not a lesson — and it
   * goes on its own (or on the next good tap). Any moment of a battle: the
   * pill moves nothing, so a note in a live wave costs the fight no room.
   */
  const fieldNote = useGameStore((s) => s.fieldNote)
  const clearFieldNote = useGameStore((s) => s.clearFieldNote)

  /*
   * Field-per-act (`run/fields`): the first fight on a new act's field says
   * so, plainly, in setup — the company is on the bench and this is not the
   * ground it left. It outranks the tips, and it goes on its own or as soon
   * as a hero is posted — the arrival is answered by doing.
   */
  const newGround = useGameStore((s) => s.newGround)
  const clearNewGround = useGameStore((s) => s.clearNewGround)
  useEffect(() => {
    if (newGround && deployed > 0) clearNewGround()
  }, [newGround, deployed, clearNewGround])

  const noteLive = !!fieldNote && screen === 'battle'
  const groundLive = !!newGround && inSetup && deployed === 0 && !conflicted
  const tipLive = tip && displayed === tip.id && !conflicted ? tip : null
  const pick = pickPill({ note: noteLive, ground: groundLive, tip: tipLive?.id ?? null })

  let item: PillItem | null = null
  if (pick?.kind === 'note' && fieldNote) {
    // Q1: the note is a blocked tile's reason, or cursed ground's cost (or,
    // that a hero stands too close to one that swings, `terrain.CLEARANCE`;
    // or that posts are held while a sub-wave is live).
    const copy = fieldNoteCopy(fieldNote)
    const tileY = fieldNote.tileId ? battleMap.tiles?.find((t) => t.id === fieldNote.tileId)?.pos.y : null
    item = {
      key: `note:${fieldNote.at}`,
      icon: 'warn',
      tone: 'note',
      where: noteWhere(tileY, battleMap.height),
      body: (
        <>
          <b>{copy.name}</b>
          {copy.line.slice(copy.name.length)}
        </>
      ),
      done: clearFieldNote,
    }
  } else if (pick?.kind === 'ground' && newGround) {
    item = {
      key: `ground:${newGround}`,
      icon: 'map',
      where: 'top',
      body: (
        <>
          <b>New ground: {newGround}</b> — post your heroes.
        </>
      ),
      done: clearNewGround,
    }
  } else if (pick?.kind === 'tip' && tipLive) {
    const id = tipLive.id
    // While the field is in play, a bottom-edge tip never sits on the wagons.
    const inPlay = inSetup || (screen === 'battle' && battlePhase === 'battle' && breather)
    const low = inPlay && wagonsLow(battleMap.path[battleMap.path.length - 1]?.y, battleMap.height)
    item = { key: `tip:${id}`, icon: tipLive.icon, where: tipWhere(id, { wagonsLow: low, onMap }), body: tipLive.body, done: () => markTaught(id) }
  }

  /*
   * A pill whose subject went away (the lesson performed, the setup over)
   * fades rather than blinking out: the last item is kept as a ghost for the
   * fade. A NEW item replaces whatever is up at once — a field note must not
   * wait on a fading tip.
   */
  // Decided in render, not in an effect: an effect would let one commit render
  // nothing between the item and its ghost, and the pill would remount (and be
  // said again) instead of fading. The write is idempotent — `until` is set once.
  const last = useRef<{ item: PillItem; until: number } | null>(null)
  if (item) last.current = { item, until: 0 }
  else if (last.current && last.current.until === 0) last.current.until = Date.now() + PILL_FADE_MS
  const ghost = !item && last.current && Date.now() < last.current.until ? last.current.item : null
  const [, wake] = useState(0)
  useEffect(() => {
    if (!ghost) return
    // Re-render once the fade is over, so the ghost is dropped.
    const t = setTimeout(() => wake((n) => n + 1), PILL_FADE_MS + 20)
    return () => clearTimeout(t)
  }, [ghost?.key])

  const shown = item ?? ghost
  if (!shown) return null
  return <HintPill key={shown.key} item={shown} leaving={!item} />
}

/**
 * The pill itself: fades in, says its words once through the Announcer, stays
 * `pillDurationMs` of VISIBLE time (a hidden tab stops the clock), fades out,
 * then reports done. `leaving` (its subject went away first) fades it at once.
 */
function HintPill({ item, leaving }: { item: PillItem; leaving: boolean }) {
  const text = useRef<HTMLParagraphElement>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [out, setOut] = useState(false)
  const done = useRef(item.done)
  done.current = item.done
  // Said once per pill, even when StrictMode runs the effect twice.
  const said = useRef(false)

  // Read the words as rendered (`<Tap />` says Tap or Click), say them once,
  // and time the pill by them.
  useLayoutEffect(() => {
    const words = text.current?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    setDuration(pillDurationMs(words))
    if (words && !said.current) announceHint(words)
    said.current = true
  }, [])

  useEffect(() => {
    if (duration === null || leaving || out) return
    let remaining = duration
    let started = 0
    let t: number | null = null
    const expire = () => {
      t = null
      setOut(true)
    }
    const arm = () => {
      started = performance.now()
      t = window.setTimeout(expire, remaining)
    }
    const pause = () => {
      if (t === null) return
      window.clearTimeout(t)
      t = null
      remaining -= performance.now() - started
    }
    const onVis = () => (document.hidden ? pause() : t === null && arm())
    if (!document.hidden) arm()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      pause()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [duration, leaving, out])

  // Faded out on its own: the tip is taught, the note retired.
  useEffect(() => {
    if (!out) return
    const t = window.setTimeout(() => done.current(), PILL_FADE_MS)
    return () => window.clearTimeout(t)
  }, [out])

  return (
    <aside className={`sh-coach ${item.where}${item.tone ? ` ${item.tone}` : ''}${out || leaving ? ' out' : ''}`}>
      <Icon name={item.icon} className="sh-coach-glyph" />
      <p className="sh-coach-text" ref={text}>
        {item.body}
      </p>
    </aside>
  )
}

/**
 * The tip `pickTipId` (`coachRules.ts`) names, as the pill renders it. The
 * ORDER lives there, pure and tested; this is only the words and the picture.
 */
export function pickTip(s: TipFacts): Tip | null {
  const id = pickTipId(s)
  if (!id) return null
  switch (id) {
    case 'skill':
      return {
        id,
        icon: 'boon',
        body: (
          <>
            <b>{s.owesSkill}</b> reached a <b>skill</b> level: <Tap /> the glowing hero and pick one of three. A hero holds up to three skills.
          </>
        ),
      }
    // Said on the hero pick itself, which has no coach pill (`offers.ts`).
    case 'heroSkill':
    case 'heroGear':
      return null
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
            Items you win land in your <b>pack</b>. <Tap /> a slot under <b>Gear</b> to wear one — what a hero holds is what it does.
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
            A <b>Merchant</b> is in reach: spend your purse on gear, a hire or a wagon repair.
          </>
        ),
      }
    // The trade pages' tips (board, stakes, purse, cash-out) are said on
    // those pages themselves, not in the battle's pill.
    default:
      return null
  }
}
