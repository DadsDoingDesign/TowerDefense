import { useEffect, useRef, useState } from 'react'
import { lookVar, railText } from '../channels'
import { describeMods, STACKING_RULES } from '../../game/data/describe'
import { mutationName } from '../../game/data/mutations'
import { skillLevelLabel } from '../../game/data/skills'
import { computeCombat, totalStats } from '../../game/engine/combat'
import { levelProgress } from '../../game/engine/leveling'
import { CURSED_DAMAGE_MULT, DANGER_COPY, dangerAt } from '../../game/data/hazards'
import { meleeSource, MELEE_LINE, weaponWord } from '../../game/engine/melee'
import type { Sentinel } from '../../game/types'
import { useGameStore } from '../../state/gameStore'
import { Icon } from '../Icon'
import { SkillIcon } from '../SkillIcon'
import { EffectLine } from './EffectLine'
import { InfoToggle } from './InfoToggle'
import { cardFields, levelWords, skillSlots, type SkillSlot } from './heroCard'
import { waveLive } from './levelUps'
import { heroLookArt } from './offers'
import { openUpgrade } from './UpgradePanel'
import { elementVar } from './fuseBeat'
import '../../styles/fusion.css'

/**
 * The focused hero, as one structured card (the battle band, Oct 2026).
 *
 * The designer crossed out the old hero panel — "unusable and unstructured":
 * a name, three tabs (Stats / Skills / Team), a sentence, "Level 6/20", a stat
 * block cut off at the fold and a full-width Undeploy. The card keeps the same
 * boxes for every hero, so the eye learns where each fact lives:
 *
 *  - **Head** — the portrait, the name in the hero's hue, the level with its
 *    XP bar, and the one headline number, DPS (the cursed ground's figure when
 *    it stands on one, in the danger ink).
 *  - **Fields** — the four facts that decide a post, as `.field-k` /
 *    `.field-v` (DESIGN_SYSTEM § 8 rule 4): Reach, Targets, Damage, Speed.
 *  - **Skills** — three icon slots with their level: a skill held, the choice
 *    owed now (it opens the Upgrade panel), or the level the next comes at. A
 *    tap reads one in a line under the row.
 *  - **"All stats"** (the ⓘ at the skills' end) opens the full sheet in place
 *    (STR / DEX / INT, Patience, crit, every ability and mutation) instead of
 *    a block cut off at the fold.
 *  - **Undeploy** — a small control in the card's foot while it is posted in
 *    setup, not a full-width button.
 *
 * The team's orders (targeting) and its relics are not a hero's: they left the
 * card for the HUD's Team panel (`TeamPanel`). Upgrading is the action bar's
 * Upgrade button (`UpgradePanel`).
 */
export function HeroCard({ hero }: { hero: Sentinel }) {
  const placements = useGameStore((s) => s.placements)
  const battlePhase = useGameStore((s) => s.battlePhase)
  const clearSlot = useGameStore((s) => s.clearSlot)
  const shellSelect = useGameStore((s) => s.shellSelect)
  const battleMap = useGameStore((s) => s.battleMap)
  const engine = useGameStore((s) => s.engine)
  const live = useGameStore(waveLive)
  // Re-read where the hero stands after a breather move (the hud changes then).
  useGameStore((s) => s.hud.breather)
  const profile = computeCombat(hero)
  const [more, setMore] = useState(false)
  const [read, setRead] = useState<number | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const readRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (more) sheetRef.current?.scrollIntoView({ block: 'nearest' })
  }, [more])
  useEffect(() => {
    if (read != null) readRef.current?.scrollIntoView({ block: 'nearest' })
  }, [read])

  const slotId = Object.keys(placements).find((id) => placements[id] === hero.id)
  const canUndeploy = !!slotId && battlePhase === 'setup'
  // Q1: the ground it stands on RIGHT NOW — the live post during a wave (a
  // breather move changes it), the setup post otherwise.
  const standing = (engine && battlePhase === 'battle' ? engine.sentinels.find((x) => x.id === hero.id)?.slotId : undefined) ?? slotId
  const danger = standing ? dangerAt(battleMap, standing) : null
  const dps = Math.round(profile.dps * (danger === 'cursed' ? CURSED_DAMAGE_MULT : 1))
  const swing = meleeSource(hero)
  const hue = lookVar(hero)
  const progress = levelProgress(hero)
  const fields = cardFields(profile)
  const slots = skillSlots(hero)
  const reading = read != null ? slots[read] : null

  return (
    <div className="sh-context sh-hcard" role="group" aria-labelledby="sh-hcard-name">
      <div className="sh-hcard-head">
        <span className="sh-hcard-face" style={{ background: hue }} aria-hidden="true">
          <img src={heroLookArt(hero)} alt="" />
        </span>
        <span className="sh-hcard-id">
          {/* The hue comes from a token, not `hero.color`'s raw hex, so the
              colour-vision modes can move it (M34). */}
          <strong id="sh-hcard-name" style={{ color: railText(hue) }}>
            {hero.name}
          </strong>
          <span className="sh-hcard-lv">
            <span className="sh-hcard-lvbar" role="img" aria-label={levelWords(hero.level, progress)}>
              <span className="sh-hcard-lvn" aria-hidden="true">
                Lv {hero.level}
              </span>
              <span className="sh-hcard-xp" aria-hidden="true">
                <span style={{ width: `${progress * 100}%` }} />
              </span>
            </span>
            {/* Two facts about the POST, only when they hold: the ground it
                stands on costs it (the DPS beside is already that figure), or
                it swings and needs clearance — what it holds decides it (or a
                skill), not a class. */}
            {danger && (
              <span className="sh-hcard-tag bad" title={`${DANGER_COPY[danger].name}: ${DANGER_COPY[danger].short}`}>
                <Icon name="curse" /> {DANGER_COPY[danger].name.split(' ')[0]}
              </span>
            )}
            {swing && !danger && (
              <span className="sh-hcard-tag" title={swing.kind === 'weapon' ? `${MELEE_LINE} · holding ${weaponWord(swing.item)}` : MELEE_LINE}>
                <Icon name="blade" /> Swings
              </span>
            )}
          </span>
        </span>
        <span
          className={`sh-hcard-dps${danger ? ' bad' : ''}`}
          role="img"
          aria-label={`${dps} damage per second${danger ? `, ${DANGER_COPY[danger].short} on this ground — ${Math.round(profile.dps)} elsewhere` : ''}${swing ? `. ${MELEE_LINE}` : ''}`}
        >
          <b aria-hidden="true">{dps}</b>
          <small aria-hidden="true">DPS</small>
        </span>
      </div>
      <div className="sh-context-body sh-hcard-body">
        <dl className="sh-hcard-fields">
          {fields.map((f) => (
            <div key={f.key} className="sh-hcard-field" role="group" aria-label={f.words}>
              <dt className="field-k" aria-hidden="true">
                {f.label}
              </dt>
              <dd className="field-v" aria-hidden="true">
                {f.icon && <Icon name={f.icon} />}
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="sh-hcard-skills" role="group" aria-label="Skills">
          {slots.map((s, i) => (
            <SkillSlotButton
              key={i}
              slot={s}
              open={read === i}
              live={live}
              onRead={() => setRead(read === i ? null : i)}
              onChoose={() => openUpgrade(hero.id)}
            />
          ))}
          <button
            type="button"
            className="sh-sk sh-hcard-more"
            data-sfx="toggle"
            aria-expanded={more}
            aria-controls={`sh-sheet-${hero.id}`}
            aria-label={more ? 'Fewer stats' : 'All stats'}
            title={more ? 'Fewer stats' : 'All stats'}
            onClick={() => setMore((m) => !m)}
          >
            <span aria-hidden="true">{more ? '−' : 'i'}</span>
          </button>
        </div>
        {reading && (
          <p className="sh-line sh-hcard-skillread" role="note" ref={readRef}>
            {reading.kind === 'held' ? (
              <>
                {/* A merge reads as its slot (base ← what was poured in) and its
                    last rule: the parts' own numbers are their names (the full
                    sentences are in "All stats"), so the line stays short
                    enough to keep the slot row in view. A plain skill that a
                    named merge builds from says which, and with what. */}
                <b>{reading.skill.name}</b> ·{' '}
                {reading.fused
                  ? `${reading.fused.parts.join(' ← ')} — ${reading.fused.skill.twist || reading.fused.skill.lines[reading.fused.skill.lines.length - 1]}`
                  : `${skillLevelLabel(reading.level)} — ${reading.skill.desc}`}
                {!reading.fused && reading.builds && (
                  <span className="fz-builds">
                    {' '}
                    Builds into <b>{reading.builds[0].name}</b> ← {reading.builds[0].needs}.
                  </span>
                )}
              </>
            ) : reading.kind === 'owed' ? (
              `A ${skillLevelLabel(reading.milestone.tier)} skill to choose when this wave is over.`
            ) : reading.level ? (
              `The next skill choice comes at level ${reading.level}.`
            ) : (
              'Every skill choice is made.'
            )}
          </p>
        )}
        {more && (
          <div className="sh-hcard-sheet" id={`sh-sheet-${hero.id}`} ref={sheetRef}>
            <HeroSheet hero={hero} />
          </div>
        )}
      </div>
      {canUndeploy && (
        <div className="sh-context-foot sh-hcard-foot">
          <button
            className="sh-btn small sh-hcard-off"
            // The store plays the undeploy sound itself; the generic click on
            // top of it doubled the feedback.
            data-sfx="none"
            aria-label={`Undeploy ${hero.name} — back to the bench`}
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

/** One of the card's three skill slots — see `heroCard.skillSlots`. */
function SkillSlotButton({ slot, open, live, onRead, onChoose }: { slot: SkillSlot; open: boolean; live: boolean; onRead: () => void; onChoose: () => void }) {
  if (slot.kind === 'held') {
    return (
      <button
        type="button"
        className={`sh-sk held${slot.fused ? ' fused' : ''}`}
        data-sfx="toggle"
        aria-expanded={open}
        aria-label={
          slot.fused
            ? `${slot.skill.name}, ${slot.fused.parts.join(' with ')} merged: ${slot.skill.desc} ${slot.fused.skill.lines.join(' ')}`
            : `${slot.skill.name}, ${skillLevelLabel(slot.level)}: ${slot.skill.desc}`
        }
        style={slot.fused ? elementVar(slot.fused.skill) : undefined}
        onClick={onRead}
      >
        <SkillIcon id={slot.skill.id} lg />
        <b className="sh-sk-lv" aria-hidden="true">
          L{slot.level}
        </b>
      </button>
    )
  }
  if (slot.kind === 'owed') {
    // Between rounds, the owed choice is the way into the Upgrade panel; mid-wave
    // it can only say when it opens.
    return (
      <button
        type="button"
        className="sh-sk owed"
        data-sfx="toggle"
        aria-expanded={live ? open : undefined}
        aria-label={live ? `A ${skillLevelLabel(slot.milestone.tier)} skill to choose when this wave is over` : `Choose a ${skillLevelLabel(slot.milestone.tier)} skill`}
        onClick={live ? onRead : onChoose}
      >
        <Icon name="boon" lg />
        <b className="sh-sk-lv" aria-hidden="true">
          ↑
        </b>
      </button>
    )
  }
  return (
    <button
      type="button"
      className="sh-sk later"
      data-sfx="toggle"
      aria-expanded={open}
      aria-label={slot.level ? `Empty skill slot — the next choice comes at level ${slot.level}` : 'Empty skill slot'}
      onClick={onRead}
    >
      <span className="sh-sk-at" aria-hidden="true">
        {slot.level ? `Lv ${slot.level}` : '—'}
      </span>
    </button>
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

/**
 * The full stat sheet, behind the card's "All stats" (it was the old Stats
 * tab, cut off at the fold): the three stats, Patience, Hold on a blocker, the
 * speed and crit numbers, every ability merged into the hero, and its
 * mutations. Same producers as before (`describeMods`), so nothing it says
 * is a second copy.
 */
function HeroSheet({ hero }: { hero: Sentinel }) {
  const p = computeCombat(hero)
  const t = totalStats(hero)
  const abilities = describeMods(p.mods)
  const cap = patienceCap(p.patience)
  // Heroes have no HP and are never hit. Thorns grind what a hero HOLDS, so the
  // row only means something on a blocker.
  const blocks = !!p.mods.block
  const rows: { k: string; v: string; words: string; info?: string }[] = [
    { k: 'STR', v: String(Math.round(t.str)), words: `Strength ${Math.round(t.str)}` },
    { k: 'DEX', v: String(Math.round(t.dex)), words: `Dexterity ${Math.round(t.dex)}` },
    { k: 'INT', v: String(Math.round(t.int)), words: `Intelligence ${Math.round(t.int)}` },
    {
      k: 'Patience',
      v: String(Math.round(p.patience)),
      words: `Patience ${Math.round(p.patience)}`,
      info: `Every ${PATIENCE_INTERVAL_S} s of a wave: +${Math.round(PATIENCE_PER_STACK * 100)}% STR, DEX and INT, up to ${cap} times (+${Math.round(cap * PATIENCE_PER_STACK * 100)}%). Every 5 Patience adds one more.`,
    },
    { k: 'Crit', v: `${Math.round(p.critChance * 100)}% · ×${p.critMult.toFixed(1)}`, words: `Crit chance ${Math.round(p.critChance * 100)}%, crit damage times ${p.critMult.toFixed(1)}` },
    ...(blocks
      ? [
          { k: 'Holds', v: String(p.mods.block!.count), words: `Holds ${p.mods.block!.count} enemies` },
          { k: 'Thorns', v: String(Math.round(p.thorns)), words: `Thorns ${Math.round(p.thorns)}` },
        ]
      : []),
  ]
  return (
    <>
      <dl className="sh-hcard-fields sh-hcard-sheetgrid">
        {rows.map((r) => (
          <div key={r.k} className="sh-hcard-field" role="group" aria-label={r.words}>
            <dt className="field-k" aria-hidden="true">
              {r.k}
            </dt>
            <dd className="field-v" aria-hidden="true">
              {r.v}
            </dd>
            {r.info && <InfoToggle label={`What ${r.k} does`} lines={[r.info]} />}
          </div>
        ))}
      </dl>
      {abilities.length > 0 && (
        <>
          <p className="sh-line muted head">
            Abilities
            <InfoToggle label="How effects stack" lines={STACKING_RULES} />
          </p>
          {abilities.map((a) => (
            <EffectLine text={a} bullet key={a} />
          ))}
        </>
      )}
      {(hero.mutations ?? []).map((m) => (
        <p key={m.key} className="sh-line accent">
          <Icon name="mutate" /> {mutationName(m.key, m.name)} — {m.desc}
        </p>
      ))}
    </>
  )
}
