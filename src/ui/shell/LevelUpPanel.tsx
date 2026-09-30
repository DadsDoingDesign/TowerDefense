import { useEffect, useRef, useState, type ReactNode } from 'react'
import { describeGrant } from '../../game/data/describe'
import { LOCKED_SPECS } from '../../game/data/achievements'
import { computeCombat } from '../../game/engine/combat'
import { evolutionOptions, evolveInto, TIER1_LEVEL, TIER2_LEVEL } from '../../game/engine/leveling'
import { lockedPerkChoices, pendingPerkLevel, perkChoices } from '../../game/run/perks'
import { availableEvolutions, lockedEvolutions } from '../../game/run/unlocks'
import { PERK_LEVELS } from '../../game/data/perks'
import type { Sentinel } from '../../game/types'
import { useGameStore } from '../../state/gameStore'
import { useSettingsStore } from '../../state/settingsStore'
import { archetypeVar } from '../channels'
import { Icon } from '../Icon'
import { ackLevelUp, choiceOwed, rewardInPlace, useLevelUps } from './levelUps'
import { featName, usePerkUnlocks } from './perkUnlocks'

/**
 * G3-2 — a hero's level-up, handled in the Context panel (rule one) instead of
 * a blocking modal. Reached by tapping a hero that wears the roster's
 * "Lv 5 ↑" badge.
 *
 * Three shapes, one panel:
 *  - an evolution owed (level 10 / 20): pick a path, read what it becomes, and
 *    commit — select, THEN confirm, the same contract `EvolutionModal` keeps;
 *  - a spec perk owed (level 5 / 15): the same, over the perks;
 *  - a plain level: what grew, and "Got it".
 *
 * Nothing here blocks the reward — "Take it" stays one tap away on the card
 * row above, and once this is dealt with the panel hands straight back to the
 * reward card that was showing.
 */
export function LevelUpPanel({ hero }: { hero: Sentinel }) {
  const queue = useGameStore((s) => s.evolutionQueue)
  const owed = choiceOwed(hero, queue)
  // Keyed on the choice, so a pick made for the evolution never leaks into the
  // perk that can follow it.
  return <LevelUpBody key={`${hero.id}:${owed ?? 'plain'}`} hero={hero} owed={owed} />
}

/** Dealt with: drop the badge (if nothing is still owed) and hand back to the reward. */
function finish(heroId: string) {
  const st = useGameStore.getState()
  const hero = st.roster.find((h) => h.id === heroId)
  if (hero) ackLevelUp(hero, st.evolutionQueue)
  const still = hero && useLevelUps.getState().heroes[heroId]
  if (still) return // another choice is owed — the panel shows it next
  const back = useLevelUps.getState().lastReward
  if (rewardInPlace(st) && back && st.reward?.some((c) => c.id === back)) {
    useGameStore.setState({ shellSelection: { kind: 'offer', id: back }, selectedSentinelId: null, gearSlot: null })
  }
}

function LevelUpBody({ hero, owed }: { hero: Sentinel; owed: 'evolve' | 'perk' | null }) {
  const entry = useLevelUps((s) => s.heroes[hero.id])
  const chooseEvolution = useGameStore((s) => s.chooseEvolution)
  const choosePerk = useGameStore((s) => s.choosePerk)
  const unlocked = usePerkUnlocks()
  const taughtEvolve = useSettingsStore((s) => s.taught.evolve)
  const markTaught = useSettingsStore((s) => s.markTaught)
  const [picked, setPicked] = useState<string | null>(null)
  // The panel is ~150px of body on a phone: a pick brings what it does into
  // view (its line and, for a path, the numbers that move). The commit button
  // is pinned below, so it never scrolls away.
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!picked) return
    const body = bodyRef.current
    const row = body?.querySelector<HTMLElement>('.sh-lvl-opt[aria-pressed="true"]')
    // A path: the numbers under the options. A perk: its own row.
    const target = owed === 'evolve' ? body?.querySelector<HTMLElement>('.sh-lvl-end') : row
    target?.scrollIntoView({ block: 'nearest' })
  }, [picked, owed])

  const from = entry?.from ?? hero.level
  const hue = archetypeVar(hero.archetype)

  let kicker: string
  let options: { id: string; name: string; blurb: string }[] = []
  let locked: { id: string; name: string; why: string }[] = []
  let confirm: { label: string; name?: string; run: () => void; disabled: boolean }
  let detail: ReactNode = null

  if (owed === 'evolve') {
    kicker = taughtEvolve ? 'Pick a path · permanent' : `Pick a path · permanent — it changes how ${hero.name} fights`
    options = availableEvolutions(hero, unlocked).map((n) => ({ id: n.id, name: n.name, blurb: n.blurb }))
    locked = lockedEvolutions(hero, unlocked).map((n) => ({ id: n.id, name: n.name, why: featName(LOCKED_SPECS[n.id] ?? '') }))
    const chosen = options.find((o) => o.id === picked)
    detail = chosen ? <EvolveDelta hero={hero} nodeId={chosen.id} /> : null
    confirm = {
      label: chosen ? 'Evolve' : 'Choose a path',
      name: chosen ? `Evolve into ${chosen.name}` : undefined,
      disabled: !chosen,
      run: () => {
        if (!chosen) return
        markTaught('evolve')
        chooseEvolution(hero.id, chosen.id)
        finish(hero.id)
      },
    }
  } else if (owed === 'perk') {
    const level = pendingPerkLevel(hero)!
    kicker = `Level ${level} perk · permanent, and free`
    options = perkChoices(hero, unlocked).map((p) => ({ id: p.id, name: p.name, blurb: p.desc }))
    locked = lockedPerkChoices(hero, unlocked).map((p) => ({ id: p.id, name: p.name, why: featName(p.unlock!) }))
    const chosen = options.find((o) => o.id === picked)
    confirm = {
      label: chosen ? 'Learn it' : 'Choose a perk',
      name: chosen ? `Learn ${chosen.name}` : undefined,
      disabled: !chosen,
      run: () => {
        if (!chosen) return
        choosePerk(hero.id, chosen.id)
        finish(hero.id)
      },
    }
  } else {
    kicker = 'Stronger for the next wave'
    detail = <Grew hero={hero} before={entry?.before} />
    confirm = { label: 'Got it', disabled: false, run: () => finish(hero.id) }
  }

  return (
    <div className="sh-context sh-lvl" role="group" aria-labelledby="sh-lvl-head">
      <div className="sh-context-head">
        <strong id="sh-lvl-head" style={{ color: hue }}>
          {hero.name}
        </strong>
        <span className="sh-lvl-up">
          Lv {from === hero.level ? hero.level : `${from} → ${hero.level}`} <span aria-hidden="true">↑</span>
        </span>
      </div>
      <div className="sh-context-body" ref={bodyRef}>
        <p className="sh-line accent">
          <Icon name={owed === 'perk' ? 'boon' : 'evolve'} /> {kicker}
        </p>
        {options.length > 0 && (
          <div className="sh-lvl-opts" role="group" aria-label={owed === 'evolve' ? 'Paths' : 'Perks'}>
            {options.map((o) => (
              <button
                key={o.id}
                className="sh-lvl-opt"
                style={{ borderLeftColor: hue }}
                aria-pressed={picked === o.id}
                data-sfx="toggle"
                onClick={() => setPicked(o.id)}
              >
                <span className="sh-lvl-opt-name">{o.name}</span>
                {/* Names first, so every option fits the panel at once; the
                    tap that picks one opens what it does (rule one, inside
                    the panel). The commit is still the separate button. */}
                {picked === o.id && <span className="sh-lvl-opt-blurb">{o.blurb}</span>}
              </button>
            ))}
          </div>
        )}
        {locked.map((l) => (
          <p className="sh-line muted" key={l.id}>
            <Icon name="warn" /> {l.name} — locked, {l.why}.
          </p>
        ))}
        {detail}
        <span className="sh-lvl-end" aria-hidden="true" />
      </div>
      <div className="sh-context-foot">
        <button className="sh-btn primary" disabled={confirm.disabled} aria-label={confirm.name} onClick={confirm.run}>
          {confirm.label}
        </button>
      </div>
    </div>
  )
}

/** What the picked path does to the hero, before the irreversible tap. */
function EvolveDelta({ hero, nodeId }: { hero: Sentinel; nodeId: string }) {
  const node = evolutionOptions(hero).find((o) => o.id === nodeId)
  if (!node) return null
  const a = computeCombat(hero)
  const evolved = evolveInto(hero, nodeId)
  const b = computeCombat(evolved)
  const rows = [
    { label: 'DPS', a: a.dps, b: b.dps },
    { label: 'Reach', a: a.range, b: b.range },
    { label: 'HP', a: a.maxHp, b: b.maxHp },
    { label: 'STR', a: hero.stats.str, b: evolved.stats.str },
    { label: 'DEX', a: hero.stats.dex, b: evolved.stats.dex },
    { label: 'INT', a: hero.stats.int, b: evolved.stats.int },
  ].filter((r) => Math.round(r.a) !== Math.round(r.b))
  return (
    <>
      <p className="sh-line">
        <Icon name="evolve" /> {node.ability}
      </p>
      {node.grant && <p className="sh-line muted">{describeGrant(node.grant)}</p>}
      <Deltas rows={rows} />
    </>
  )
}

/** A plain level: the numbers that moved since the wave began. */
function Grew({ hero, before }: { hero: Sentinel; before?: Sentinel }) {
  const later = [...PERK_LEVELS, TIER1_LEVEL, TIER2_LEVEL].filter((l) => l > hero.level)
  const next = later.length > 0 ? Math.min(...later) : null
  const rows = before
    ? (() => {
        const a = computeCombat(before)
        const b = computeCombat(hero)
        return [
          { label: 'DPS', a: a.dps, b: b.dps },
          { label: 'HP', a: a.maxHp, b: b.maxHp },
          { label: 'STR', a: before.stats.str, b: hero.stats.str },
          { label: 'DEX', a: before.stats.dex, b: hero.stats.dex },
          { label: 'INT', a: before.stats.int, b: hero.stats.int },
        ].filter((r) => Math.round(r.a) !== Math.round(r.b))
      })()
    : []
  return (
    <>
      <Deltas rows={rows} />
      {next !== null && (
        <p className="sh-line muted">
          Next choice at level {next} — {PERK_LEVELS.includes(next as (typeof PERK_LEVELS)[number]) ? 'a perk' : 'an evolution'}.
        </p>
      )}
    </>
  )
}

function Deltas({ rows }: { rows: { label: string; a: number; b: number }[] }) {
  if (rows.length === 0) return null
  return (
    <dl className="sh-lvl-deltas">
      {rows.map((r) => {
        const up = r.b > r.a
        return (
          <div key={r.label} className={up ? 'up' : 'down'}>
            <dt>{r.label}</dt>
            <dd>
              {Math.round(r.a)} → <b>{Math.round(r.b)}</b> <span aria-hidden="true">{up ? '▲' : '▼'}</span>
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
