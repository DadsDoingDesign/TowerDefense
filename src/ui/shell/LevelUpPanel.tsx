import { useEffect, useRef, useState } from 'react'
import { lookVar, railText } from '../channels'
import { BUMP_LABEL, BUMP_STATS, BUMP_WHAT, skillById, skillHeadline, skillLevelLabel, type BumpStat } from '../../game/data/skills'
import { computeCombat } from '../../game/engine/combat'
import { bumpAmount, bumpOffered, MAX_SKILLS, pendingMilestone, skillOffer, slotsFull } from '../../game/run/skills'
import type { Sentinel } from '../../game/types'
import { useGameStore } from '../../state/gameStore'
import { useSettingsStore } from '../../state/settingsStore'
import { Icon } from '../Icon'
import { putOff, rewardInPlace, useLevelUps, waveLive } from './levelUps'
import { PickCard, PickStrip, type PickFact, type PickTokenSpec } from './PickStrip'

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
 * Pick one, then read (October 2026): the three skills and the stat boost sit
 * as tokens in a strip, and the focused one's card says what it does and what
 * it does to the hero's numbers. Focus, THEN confirm — a token never commits;
 * the CTA names the pick. Never during a live wave: the commit waits for the
 * wave (and its sub-waves) to end.
 */
export function LevelUpPanel({ hero }: { hero: Sentinel }) {
  const m = pendingMilestone(hero)
  // Keyed on the milestone, so a pick made for one never leaks into the next.
  if (!m) return null
  return <SkillChoice key={`${hero.id}:${m.level}`} hero={hero} />
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

function SkillChoice({ hero }: { hero: Sentinel }) {
  const m = pendingMilestone(hero)!
  const pool = useGameStore((s) => s.skillPool)
  const runSeed = useGameStore((s) => s.runSeed)
  const live = useGameStore(waveLive)
  const chooseSkill = useGameStore((s) => s.chooseSkill)
  const chooseStatBump = useGameStore((s) => s.chooseStatBump)
  const taught = useSettingsStore((s) => s.taught.skill)
  const markTaught = useSettingsStore((s) => s.markTaught)

  const offer = skillOffer(hero, pool, runSeed)
  const bump = bumpOffered(hero, pool, runSeed)
  const full = slotsFull(hero)
  const amount = bumpAmount(m)
  const held = (hero.skills ?? []).map((id) => skillById(id)).filter((k) => !!k)
  const hue = lookVar(hero)

  // Pick one, then read (October 2026): the offer is a strip of tokens — the
  // skill's lead effect as a picture and a word, the stat boost as one more —
  // and the focused one's card below. The first is focused as the panel opens,
  // so the card is never empty; nothing is learned until the CTA, which names it.
  const focusList: Focus[] = [...offer.map((k) => ({ kind: 'skill' as const, id: k.id })), ...(bump ? [{ kind: 'bump' as const }] : [])]
  const [focus, setFocus] = useState<Focus | null>(focusList[0] ?? null)
  const [stat, setStat] = useState<BumpStat | null>(null)
  const [drop, setDrop] = useState<string | null>(null)
  const chosen = focus?.kind === 'skill' ? skillById(focus.id) : undefined

  // The panel is ~150px of body on a phone: a swap or stat row brings itself
  // into view when it opens. The commit is pinned below.
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bodyRef.current?.querySelector<HTMLElement>('.sh-lvl-swap, .sh-lvl-bump')?.scrollIntoView({ block: 'nearest' })
  }, [focus, drop, stat])

  const level = skillLevelLabel(m.tier)
  const kicker = full
    ? `${hero.name} holds ${MAX_SKILLS} skills. Pick a ${level} skill to swap in.`
    : `Pick a ${level} skill${taught ? '.' : ` — ${hero.name} keeps it, and holds up to ${MAX_SKILLS}.`}`

  let label: string
  let name: string | undefined
  let ready = false
  if (live) label = 'After this wave'
  else if (focus?.kind === 'bump') {
    label = stat ? `Take +${amount} ${BUMP_LABEL[stat]}` : 'Choose a stat'
    ready = !!stat
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
    if (!ready || live || !focus) return
    markTaught('skill')
    if (focus.kind === 'bump') {
      if (stat) chooseStatBump(hero.id, stat)
    } else chooseSkill(hero.id, focus.id, drop)
    handBack()
  }
  const refocus = (id: string) => {
    setFocus(focusOf(id))
    setDrop(null)
  }

  // What the focused skill does to the numbers a hero is read by — shown only
  // where it moves them (a burn or a hold says so in its sentence instead).
  const before = computeCombat(hero)
  const after = chosen ? computeCombat({ ...hero, skills: [...(hero.skills ?? []).filter((id) => id !== drop), chosen.id] }) : before
  const facts: PickFact[] = []
  if (Math.round(after.dps) !== Math.round(before.dps)) facts.push({ label: 'DPS', value: `${Math.round(before.dps)} → ${Math.round(after.dps)}`, tone: after.dps > before.dps ? 'good' : 'bad' })
  if (Math.round(after.range) !== Math.round(before.range)) facts.push({ label: 'Reach', value: `${Math.round(before.range)} → ${Math.round(after.range)}`, tone: after.range > before.range ? 'good' : 'bad' })

  const tokens: PickTokenSpec[] = [
    ...offer.map((k) => {
      const h = skillHeadline(k)
      return { id: `skill:${k.id}`, art: <Icon name={h.icon} lg />, label: h.label, value: h.value, name: `${k.name}: ${k.desc}` }
    }),
    ...(bump ? [{ id: 'bump', art: <Icon name="boon" lg />, label: 'Stat', value: `+${amount}`, name: `Or a stat boost: plus ${amount} to one stat` }] : []),
  ]
  const at = focus ? focusList.findIndex((f) => tokenId(f) === tokenId(focus)) : -1
  const step = (d: number) => {
    const next = focusList[(at + d + focusList.length) % focusList.length]
    if (next) refocus(tokenId(next))
  }

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
            <Icon name="warn" /> Choices are made between rounds — this one opens when the wave is over.
          </p>
        )}
        {focus && (
          <div className="pk compact">
            <PickStrip label={`${level} skills`} tokens={tokens} focused={tokenId(focus)} onFocus={refocus} />
            {chosen ? (
              <PickCard kicker={`Skill · ${level}`} name={chosen.name} index={at} count={focusList.length} onStep={step} facts={facts} noun="choice" style={{ borderLeft: `3px solid ${hue}` }}>
                <p className="pk-does">{chosen.desc}</p>
                {full && (
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
                {held.length > 0 && !full && <p className="pk-sec-v">Has: {held.map((k) => k.name).join(' · ')}</p>}
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
        <button className="sh-btn primary" disabled={!ready || live} aria-label={name} onClick={commit}>
          {label}
        </button>
      </div>
    </div>
  )
}
