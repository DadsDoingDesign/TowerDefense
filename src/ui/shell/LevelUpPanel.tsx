import { useEffect, useRef, useState } from 'react'
import { BUMP_LABEL, BUMP_STATS, BUMP_WHAT, skillById, skillLevelLabel, type BumpStat } from '../../game/data/skills'
import { bumpAmount, bumpOffered, MAX_SKILLS, pendingMilestone, skillOffer, slotsFull } from '../../game/run/skills'
import type { Sentinel } from '../../game/types'
import { useGameStore } from '../../state/gameStore'
import { useSettingsStore } from '../../state/settingsStore'
import { archetypeVar } from '../channels'
import { Icon } from '../Icon'
import { putOff, rewardInPlace, useLevelUps, waveLive } from './levelUps'

/**
 * SK1 — a hero's skill milestone, chosen in the Context panel (rule one)
 * rather than a blocking modal. Reached by tapping a hero whose roster card
 * wears the badge (`levelUps.ts`).
 *
 * One panel, one job: pick ONE of three skills of the milestone's level
 * (level 5 → Level 1, 10 → Level 2, 15 → Level 3). A hero holds three; once
 * all three are taken the panel asks which one the new skill replaces — or the
 * hero takes +N to one stat instead. The stat bump also fills an offer the
 * pool cannot: there are always three things to choose from.
 *
 * Select, THEN confirm — a permanent pick is never one tap. Never during a
 * live wave: the commit waits for the wave (and its sub-waves) to end.
 */
export function LevelUpPanel({ hero }: { hero: Sentinel }) {
  const m = pendingMilestone(hero)
  // Keyed on the milestone, so a pick made for one never leaks into the next.
  if (!m) return null
  return <SkillChoice key={`${hero.id}:${m.level}`} hero={hero} />
}

type Pick = { kind: 'skill'; id: string } | { kind: 'bump'; stat: BumpStat } | null

/** Dealt with: hand back to the reward card that was showing, if there is one. */
function handBack() {
  const st = useGameStore.getState()
  const back = useLevelUps.getState().lastReward
  if (rewardInPlace(st) && back && st.reward?.some((c) => c.id === back)) {
    useGameStore.setState({ shellSelection: { kind: 'offer', id: back }, selectedSentinelId: null, gearSlot: null })
  }
}

function SkillChoice({ hero }: { hero: Sentinel }) {
  const m = pendingMilestone(hero)!
  const pool = useGameStore((s) => s.skillPool)
  const runSeed = useGameStore((s) => s.runSeed)
  const live = useGameStore(waveLive)
  const chooseSkill = useGameStore((s) => s.chooseSkill)
  const chooseStatBump = useGameStore((s) => s.chooseStatBump)
  const taught = useSettingsStore((s) => s.taught.skill)
  const markTaught = useSettingsStore((s) => s.markTaught)
  const [picked, setPicked] = useState<Pick>(null)
  const [drop, setDrop] = useState<string | null>(null)

  const offer = skillOffer(hero, pool, runSeed)
  const bump = bumpOffered(hero, pool, runSeed)
  const full = slotsFull(hero)
  const amount = bumpAmount(m)
  const held = (hero.skills ?? []).map((id) => skillById(id)).filter((k) => !!k)
  const chosen = picked?.kind === 'skill' ? skillById(picked.id) : undefined
  const hue = archetypeVar(hero.archetype)

  // The panel is ~150px of body on a phone: a pick brings what it does (and,
  // when full, the swap row) into view. The commit is pinned below.
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const body = bodyRef.current
    const target = drop || !full || picked?.kind !== 'skill' ? body?.querySelector<HTMLElement>('[aria-pressed="true"]') : body?.querySelector<HTMLElement>('.sh-lvl-swap')
    target?.scrollIntoView({ block: 'nearest' })
  }, [picked, drop, full])

  const level = skillLevelLabel(m.tier)
  const kicker = full
    ? `${hero.name} holds ${MAX_SKILLS} skills. Pick a ${level} skill to swap in.`
    : `Pick a ${level} skill${taught ? '.' : ` — ${hero.name} keeps it, and holds up to ${MAX_SKILLS}.`}`

  let label: string
  let name: string | undefined
  let ready = false
  if (live) label = 'After this wave'
  else if (picked?.kind === 'bump') {
    label = `Take +${amount} ${BUMP_LABEL[picked.stat]}`
    ready = true
  } else if (chosen && full && !drop) label = 'Choose one to swap out'
  else if (chosen && full && drop) {
    // The commit names both halves of the swap: what leaves, what arrives.
    label = `Swap ${skillById(drop)?.name} for ${chosen.name}`
    name = label
    ready = true
  } else if (chosen) {
    label = `Learn ${chosen.name}`
    ready = true
  } else label = 'Choose a skill'

  const commit = () => {
    if (!ready || live || !picked) return
    markTaught('skill')
    if (picked.kind === 'bump') chooseStatBump(hero.id, picked.stat)
    else chooseSkill(hero.id, picked.id, drop)
    handBack()
  }

  return (
    <div className="sh-context sh-lvl" role="group" aria-labelledby="sh-lvl-head">
      <div className="sh-context-head">
        <strong id="sh-lvl-head" style={{ color: hue }}>
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
            <Icon name="warn" /> Choices are made between rounds — this one opens when the wave is over.
          </p>
        )}
        {offer.length > 0 && (
          <div className="sh-lvl-opts" role="group" aria-label={`${level} skills`}>
            {offer.map((k) => {
              const on = picked?.kind === 'skill' && picked.id === k.id
              return (
                <button
                  key={k.id}
                  className="sh-lvl-opt"
                  style={{ borderLeftColor: hue }}
                  aria-pressed={on}
                  data-sfx="toggle"
                  onClick={() => {
                    setPicked({ kind: 'skill', id: k.id })
                    setDrop(null)
                  }}
                >
                  <span className="sh-lvl-opt-name">{k.name}</span>
                  {/* The choice has the band to itself (`.sh-detail.choosing`),
                      so all three say what they do at once, side by side. */}
                  <span className="sh-lvl-opt-blurb">{k.desc}</span>
                </button>
              )
            })}
          </div>
        )}
        {full && chosen && (
          <div className="sh-lvl-swap" role="group" aria-label="Swap out">
            <p className="sh-line muted">Swap out one of {hero.name}&rsquo;s skills:</p>
            {held.map((k) => (
              <button
                key={k.id}
                className="sh-lvl-chip"
                aria-pressed={drop === k.id}
                data-sfx="toggle"
                aria-label={`Swap out ${k.name}: ${k.desc}`}
                onClick={() => setDrop(k.id)}
              >
                {k.name}
              </button>
            ))}
            {drop && <p className="sh-line muted">{skillById(drop)?.name} — {skillById(drop)?.desc} It leaves when you swap.</p>}
          </div>
        )}
        {bump && (
          <div className="sh-lvl-bump" role="group" aria-label="Or take a stat boost">
            <p className="sh-line muted">{offer.length ? 'Or take a stat boost instead:' : 'Take a stat boost:'}</p>
            {BUMP_STATS.map((st) => (
              <button
                key={st}
                className="sh-lvl-chip"
                aria-pressed={picked?.kind === 'bump' && picked.stat === st}
                data-sfx="toggle"
                aria-label={`Plus ${amount} ${BUMP_LABEL[st]}: ${BUMP_WHAT[st]}`}
                onClick={() => {
                  setPicked({ kind: 'bump', stat: st })
                  setDrop(null)
                }}
              >
                +{amount} {BUMP_LABEL[st]}
              </button>
            ))}
            {picked?.kind === 'bump' && (
              <p className="sh-line muted">
                {BUMP_LABEL[picked.stat]} raises {BUMP_WHAT[picked.stat]}.
              </p>
            )}
          </div>
        )}
        {held.length > 0 && !(full && chosen) && (
          <p className="sh-line muted">
            Has: {held.map((k) => k.name).join(' · ')}
          </p>
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
        <button className="sh-btn primary" disabled={!ready || live} aria-label={name} onClick={commit}>
          {label}
        </button>
      </div>
    </div>
  )
}
