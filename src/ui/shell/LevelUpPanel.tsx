import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { lookVar, railText } from '../channels'
import { BUMP_LABEL, BUMP_STATS, BUMP_WHAT, mergedById, skillById, skillHeadline, skillLevelLabel, type BumpStat, type MergedSkill } from '../../game/data/skills'
import { computeCombat } from '../../game/engine/combat'
import { fxLevel } from '../../game/render/fxQuality'
import { afterDrop, buildsInto } from '../../game/run/fusion'
import { bumpAmount, bumpOffered, MAX_SKILLS, pendingMilestone, skillOffer, slotsFull } from '../../game/run/skills'
import type { Sentinel } from '../../game/types'
import { useGameStore } from '../../state/gameStore'
import { useSettingsStore } from '../../state/settingsStore'
import { Icon } from '../Icon'
import { elementVar, playFuseBeat } from './fuseBeat'
import { putOff, rewardInPlace, useLevelUps, waveLive } from './levelUps'
import { PickCard, PickStrip, type PickFact, type PickTokenSpec } from './PickStrip'
import { travelOf } from './press'
import { defaultTarget, dropCta, isDrag, slotTargets, type SlotTarget } from './skillDrop'
import '../../styles/fusion.css'

/**
 * SK1 — a hero's skill milestone, chosen in the Context panel (rule one)
 * rather than a blocking modal. Reached by tapping a hero whose roster card
 * wears the badge (`levelUps.ts`).
 *
 * One panel, one job: put ONE of three skills of the milestone's level
 * (level 5 → Level 1, 10 → Level 2, 15 → Level 3) into one of the hero's
 * three slots — or take +N to one stat instead.
 *
 * The drop (Oct 2026; the designer: "If into an empty slot then it's kept as
 * is, but if all slots are full you are forced to merge in", and "order does
 * matter"): the hero's slots stand under the strip as targets. A card dragged
 * (a finger or a mouse, pointer events) or tapped-then-placed onto an EMPTY
 * slot is learned as itself; onto a HELD skill it merges in — the held skill
 * is the base and keeps itself, the card lends its share and a rule
 * (`run/fusion.ts`). There is no swap: a full hero merges. While a card is
 * focused (or dragged) every slot says exactly what it would make there
 * ("→ Frozen Arc Spark"; a named merge is starred). The keyboard: the strip's
 * arrows focus a card, Tab reaches the slots, Enter places it; each slot's
 * name says what it makes.
 *
 * Pick one, then read (October 2026): the release (or the tap on a slot)
 * only CHOOSES the slot; the card below says what it makes and the CTA, which
 * names it, commits. Never during a live wave. Committing a merge plays the
 * fuse beat (`FuseBeat`) in the panel. Under reduced motion the dragged card
 * neither lifts nor eases: it is a still copy under the finger.
 */
export function LevelUpPanel({ hero, onDone }: { hero: Sentinel; onDone?: () => void }) {
  const m = pendingMilestone(hero)
  // Keyed on the milestone, so a pick made for one never leaks into the next.
  if (!m) return null
  return <SkillChoice key={`${hero.id}:${m.level}`} hero={hero} onDone={onDone} />
}

/** The focused token: one of the offered skills, or the stat boost. */
type Focus = { kind: 'skill'; id: string } | { kind: 'bump' }

/** Dealt with: hand back to the reward card that was showing, if there is one. */
function handBack() {
  const st = useGameStore.getState()
  const back = useLevelUps.getState().lastReward
  if (rewardInPlace(st) && back && st.reward?.some((c) => c.id === back)) {
    useGameStore.setState({ shellSelection: { kind: 'offer', id: back }, selectedSentinelId: null, gearSlot: null })
  }
}

const tokenId = (f: Focus) => (f.kind === 'bump' ? 'bump' : `skill:${f.id}`)
const focusOf = (id: string): Focus => (id === 'bump' ? { kind: 'bump' } : { kind: 'skill', id: id.slice('skill:'.length) })

/** The token's picture with the quiet ★ in its corner when it makes a named merge on a held skill. */
function FusingArt({ icon, into, tag }: { icon: Parameters<typeof Icon>[0]['name']; into: Pick<MergedSkill, 'element'>; tag?: string }) {
  return (
    <span className="fz-tok" style={elementVar(into)}>
      <Icon name={icon} lg />
      {tag && <span className="fz-tag">{tag}</span>}
    </span>
  )
}

/** The card being dragged: where it is, and the slot under it. */
interface DragNow {
  card: string
  x: number
  y: number
  over: number | null
}

/**
 * The drag: a press on a skill token that travels past the tap's slop picks
 * the card up; a copy follows the pointer (a portal, clear of every panel's
 * clip) and the slot under it lights; letting go over a slot that takes it
 * chooses that slot. A press that never travels is the strip's own tap.
 */
function useSkillDrag(onDrop: (card: string, slot: number) => void, onLift: (card: string) => void) {
  const [drag, setDrag] = useState<DragNow | null>(null)
  const press = useRef<{ card: string; x: number; y: number; id: number; lifted: boolean } | null>(null)
  const now = useRef<DragNow | null>(null)
  const drop = useRef(onDrop)
  const lift = useRef(onLift)
  drop.current = onDrop
  lift.current = onLift
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = press.current
      if (!p || e.pointerId !== p.id) return
      if (!p.lifted) {
        if (!isDrag(travelOf(p, { x: e.clientX, y: e.clientY }))) return
        p.lifted = true
        lift.current(p.card)
      }
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLButtonElement>('[data-slot]')
      const over = el && !el.disabled ? Number(el.dataset.slot) : null
      now.current = { card: p.card, x: e.clientX, y: e.clientY, over }
      setDrag(now.current)
    }
    const end = (e: PointerEvent) => {
      const p = press.current
      if (!p || e.pointerId !== p.id) return
      press.current = null
      const d = now.current
      now.current = null
      setDrag(null)
      if (e.type === 'pointerup' && d && d.over != null) drop.current(d.card, d.over)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [])
  /** On the strip: a press on a skill token may become a drag. */
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    const tok = (e.target as HTMLElement).closest<HTMLElement>('[data-pick^="skill:"]')
    if (!tok) return
    press.current = { card: tok.dataset.pick!.slice('skill:'.length), x: e.clientX, y: e.clientY, id: e.pointerId, lifted: false }
  }
  return { drag, onPointerDown }
}

function SkillChoice({ hero, onDone }: { hero: Sentinel; onDone?: () => void }) {
  const m = pendingMilestone(hero)!
  const pool = useGameStore((s) => s.skillPool)
  const runSeed = useGameStore((s) => s.runSeed)
  const live = useGameStore(waveLive)
  const dropSkill = useGameStore((s) => s.dropSkill)
  const chooseStatBump = useGameStore((s) => s.chooseStatBump)
  const taught = useSettingsStore((s) => s.taught.skill)
  const markTaught = useSettingsStore((s) => s.markTaught)

  const offer = skillOffer(hero, pool, runSeed)
  const bump = bumpOffered(hero, pool, runSeed)
  const full = slotsFull(hero)
  const amount = bumpAmount(m)
  const have = hero.skills ?? []
  const hue = lookVar(hero)
  const still = fxLevel() === 'off'

  // Pick one, then read: the offer is a strip of tokens — the skill's lead
  // effect as a picture and a word, the stat boost as one more — and the
  // focused one's card below. The first is focused as the panel opens, so the
  // card is never empty; nothing is learned until the CTA, which names it.
  const focusList: Focus[] = [...offer.map((k) => ({ kind: 'skill' as const, id: k.id })), ...(bump ? [{ kind: 'bump' as const }] : [])]
  const first = focusList[0] ?? null
  const [focus, setFocus] = useState<Focus | null>(first)
  const [stat, setStat] = useState<BumpStat | null>(null)
  const [target, setTarget] = useState<number | null>(() => (first?.kind === 'skill' ? defaultTarget(slotTargets(hero, first.id)) : null))
  const chosen = focus?.kind === 'skill' ? skillById(focus.id) : undefined
  const targets: SlotTarget[] | null = chosen ? slotTargets(hero, chosen.id) : null
  const aim = targets && target != null ? targets[target] : null
  const into = aim?.drop?.base != null ? mergedById(aim.drop.into) : undefined

  const refocus = (id: string, slot?: number) => {
    const f = focusOf(id)
    setFocus(f)
    setTarget(slot ?? (f.kind === 'skill' ? defaultTarget(slotTargets(hero, f.id)) : null))
  }
  const { drag, onPointerDown } = useSkillDrag(
    (card, slot) => refocus(`skill:${card}`, slot),
    (card) => focus?.kind === 'skill' && focus.id === card ? undefined : refocus(`skill:${card}`),
  )
  const dragTargets = drag ? slotTargets(hero, drag.card) : null

  // The panel is ~150px of body on a phone: the stat row brings itself into
  // view when it opens. The commit is pinned below.
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bodyRef.current?.querySelector<HTMLElement>('.sh-lvl-bump')?.scrollIntoView({ block: 'nearest' })
  }, [focus, stat])

  const level = skillLevelLabel(m.tier)
  const kicker = full
    ? `${hero.name} holds ${MAX_SKILLS} skills. Drop a ${level} skill on one to merge it in.`
    : `Drop a ${level} skill on a slot${taught ? '.' : ': an empty one keeps it as it is, a skill merges it in.'}`

  let label: string
  let name: string | undefined
  let ready = false
  if (live) label = 'After this wave'
  else if (focus?.kind === 'bump') {
    label = stat ? `Take +${amount} ${BUMP_LABEL[stat]}` : 'Choose a stat'
    ready = !!stat
  } else if (chosen) {
    const cta = dropCta(chosen.id, aim, full)
    label = cta.label
    ready = cta.ready
    if (aim?.drop?.base != null) name = `${label}: ${chosen.name} onto ${aim.held}`
  } else label = 'Choose a skill'

  const commit = () => {
    if (!ready || live || !focus) return
    markTaught('skill')
    if (focus.kind === 'bump') {
      if (stat) chooseStatBump(hero.id, stat)
    } else if (aim?.drop) {
      dropSkill(hero.id, focus.id, aim.slot)
      // The merge is in the store now; the beat only shows it.
      if (aim.drop.base != null) playFuseBeat(hero.id, aim.drop.into, [aim.drop.base, focus.id])
    }
    handBack()
    // From the Upgrade panel: back to the hero's card, where the new skill sits in its slot.
    onDone?.()
  }

  // What the drop does to the numbers a hero is read by — shown only where it
  // moves them (a burn or a hold says so in its sentence instead).
  const before = computeCombat(hero)
  const after = aim?.drop ? computeCombat({ ...hero, skills: afterDrop(have, aim.drop) }) : before
  const facts: PickFact[] = []
  if (Math.round(after.dps) !== Math.round(before.dps)) facts.push({ label: 'DPS', value: `${Math.round(before.dps)} → ${Math.round(after.dps)}`, tone: after.dps > before.dps ? 'good' : 'bad' })
  if (Math.round(after.range) !== Math.round(before.range)) facts.push({ label: 'Reach', value: `${Math.round(before.range)} → ${Math.round(after.range)}`, tone: after.range > before.range ? 'good' : 'bad' })

  const tokens: PickTokenSpec[] = [
    ...offer.map((k) => {
      const h = skillHeadline(k)
      const star = slotTargets(hero, k.id).find((t) => t.kind === 'named')
      const made = star ? mergedById(star.drop!.into) : undefined
      return {
        id: `skill:${k.id}`,
        art: made ? <FusingArt icon={h.icon} into={made} tag="★" /> : <Icon name={h.icon} lg />,
        label: h.label,
        value: h.value,
        name: `${k.name}: ${k.desc}${star ? ` Onto ${star.held} it makes ${star.makes}, a named merge.` : ''}`,
      }
    }),
    ...(bump ? [{ id: 'bump', art: <Icon name="boon" lg />, label: 'Stat', value: `+${amount}`, name: `Or a stat boost: plus ${amount} to one stat` }] : []),
  ]
  const at = focus ? focusList.findIndex((f) => tokenId(f) === tokenId(focus)) : -1
  const step = (d: number) => {
    const next = focusList[(at + d + focusList.length) % focusList.length]
    if (next) refocus(tokenId(next))
  }
  // The note under a plain card: the named merge it makes on a held slot, or
  // the one it can become later (a build to aim at). One quiet line.
  const star = targets?.find((t) => t.kind === 'named')
  const later = chosen && !star ? buildsInto(chosen.id)[0] : undefined

  return (
    <div className="sh-context sh-lvl" role="group" aria-labelledby="sh-lvl-head">
      <div className="sh-context-head">
        <strong id="sh-lvl-head" style={{ color: railText(hue) }}>
          {hero.name}
        </strong>
        <span className="sh-lvl-up">
          Level {m.level} <span aria-hidden="true">↑</span>
        </span>
      </div>
      <div className="sh-context-body" ref={bodyRef}>
        <p className="sh-line accent">
          <Icon name="boon" /> {kicker}
        </p>
        {live && (
          <p className="sh-line muted">
            <Icon name="warn" /> Opens when the wave is over.
          </p>
        )}
        {focus && (
          <div className="pk compact">
            <div className={`sk-strip${drag ? ' dragging' : ''}`} onPointerDown={onPointerDown}>
              <PickStrip label={`${level} skills`} tokens={tokens} focused={tokenId(focus)} onFocus={(id) => refocus(id)} />
            </div>
            <SlotRow hero={hero} targets={dragTargets ?? targets} chosen={drag ? null : target} over={drag?.over ?? null} onChoose={setTarget} />
            {chosen && into ? (
              <PickCard
                kicker={`${into.named ? 'Named merge' : 'Merge'} · ${skillLevelLabel(into.level)}`}
                name={into.name}
                index={at}
                count={focusList.length}
                onStep={step}
                facts={facts}
                noun="choice"
                className="fz-card"
                style={{ borderLeft: `3px solid ${hue}`, ...elementVar(into) }}
              >
                <p className="fz-recipe">
                  <span className="field-v">{aim!.held}</span>
                  <span className="fz-plus" aria-label="with">
                    ←
                  </span>
                  <span className="field-v">{chosen.name}</span>
                </p>
                <p className="pk-does">{into.desc}</p>
                {into.lines.map((l, i) => (
                  <p key={i} className={`pk-does${i === into.lines.length - 1 && into.twist ? ' fz-twist' : ' fz-line'}`}>
                    {i === into.lines.length - 1 && into.twist && <Icon name={into.icon} />} {l}
                  </p>
                ))}
              </PickCard>
            ) : chosen ? (
              <PickCard kicker={`Skill · ${level}`} name={chosen.name} index={at} count={focusList.length} onStep={step} facts={facts} noun="choice" style={{ borderLeft: `3px solid ${hue}` }}>
                <p className="pk-does">{chosen.desc}</p>
                {star ? (
                  <p className="sh-line note">
                    Onto {star.held}: <b>{star.makes}</b> ★
                  </p>
                ) : later ? (
                  <p className="sh-line note">
                    Builds into {later.name} with {skillById(later.parts[1])?.name}.
                  </p>
                ) : null}
              </PickCard>
            ) : (
              <PickCard kicker="Instead of a skill" name={`+${amount} to one stat`} index={at} count={focusList.length} onStep={step} noun="choice" style={{ borderLeft: `3px solid ${hue}` }}>
                <div className="sh-lvl-bump" role="group" aria-label="Which stat">
                  {BUMP_STATS.map((st) => (
                    <button
                      key={st}
                      className="sh-lvl-chip"
                      aria-pressed={stat === st}
                      data-sfx="toggle"
                      aria-label={`Plus ${amount} ${BUMP_LABEL[st]}: ${BUMP_WHAT[st]}`}
                      onClick={() => setStat(st)}
                    >
                      +{amount} {BUMP_LABEL[st]}
                    </button>
                  ))}
                </div>
                <p className="pk-does">{stat ? `${BUMP_LABEL[stat]} raises ${BUMP_WHAT[stat]}.` : 'STR raises physical damage, DEX attack speed and crit, INT magic damage.'}</p>
              </PickCard>
            )}
          </div>
        )}
      </div>
      <div className="sh-context-foot sh-lvl-foot">
        <button
          className="sh-btn"
          data-sfx="toggle"
          // The hero's own panel opens in its place; the badge stays.
          onClick={() => putOff(hero.id)}
        >
          Later
        </button>
        <button className="sh-btn sh-commit-2" disabled={!ready || live} aria-label={name} onClick={commit}>
          {label}
        </button>
      </div>
      {drag &&
        createPortal(
          <div className={`sk-ghost${still ? ' still' : ''}`} style={{ transform: `translate(${drag.x}px, ${drag.y}px)` }} aria-hidden="true">
            <Icon name={skillHeadline(skillById(drag.card)!).icon} lg />
            <b>{skillById(drag.card)?.name}</b>
          </div>,
          document.body,
        )}
    </div>
  )
}

/**
 * The hero's three slots as drop targets: what each holds and, for the card
 * in hand, what it makes there — "Learn as is" on an empty slot, "→ Frozen
 * Arc Spark" on a held skill (★ for a named merge), nothing on a slot at the
 * depth cap. A tap (or Enter) on one chooses it, as a release over it does.
 */
function SlotRow({
  hero,
  targets,
  chosen,
  over,
  onChoose,
}: {
  hero: Sentinel
  targets: SlotTarget[] | null
  chosen: number | null
  over: number | null
  onChoose: (slot: number) => void
}) {
  const have = hero.skills ?? []
  return (
    <div className="sk-slots" role="group" aria-label={`${hero.name}'s skill slots`}>
      {Array.from({ length: MAX_SKILLS }, (_, i) => {
        const held = have[i] ? skillById(have[i]) : undefined
        const t = targets?.[i]
        const merged = held ? mergedById(held.id) : undefined
        const takes = !!t && t.kind !== 'full'
        return (
          <button
            key={i}
            type="button"
            data-slot={i}
            className={`sk-slot ${t?.kind ?? 'idle'}${chosen === i ? ' on' : ''}${over === i ? ' over' : ''}${merged ? ' fused' : ''}`}
            style={merged ? elementVar(merged) : undefined}
            disabled={!takes}
            aria-pressed={takes ? chosen === i : undefined}
            aria-label={t?.aria ?? (held ? `Slot ${i + 1}: ${held.name}` : `Slot ${i + 1}: empty`)}
            data-sfx="toggle"
            onClick={() => onChoose(i)}
          >
            <span className="sk-slot-held" aria-hidden="true">
              {held ? <Icon name={skillHeadline(held).icon} /> : <span className="sk-slot-dot" />}
              <span className="sk-slot-name">{held?.name ?? 'Empty'}</span>
            </span>
            {t && t.kind !== 'full' && (
              <span className="sk-slot-to" aria-hidden="true">
                {t.kind === 'empty' ? 'Learn as is' : `→ ${t.makes}`}
                {t.kind === 'named' && <span className="sk-star"> ★</span>}
              </span>
            )}
            {t?.kind === 'full' && (
              <span className="sk-slot-to muted" aria-hidden="true">
                Full
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
