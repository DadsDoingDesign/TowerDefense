import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ANIM_FRAMES } from '../../game/render/anim'
import { TIER1_LEVEL } from '../../game/engine/leveling'
import { useGameStore } from '../../state/gameStore'
import { useMetaStore } from '../../state/metaStore'
import { useSettingsStore } from '../../state/settingsStore'
import { archetypeVar, ARCHETYPE_GLYPH, type IconKey } from '../channels'
import { Icon } from '../Icon'
import { useMedia } from '../pointer'
import { BannerPicker } from './BannerPicker'
import type { ShellContext } from './context'
import { heroFacts, HERO_ORDER, recommendFirstRun, type HeroFacts, type HeroPickVariant } from './heroPickFacts'
import { heroArt, previewHero } from './offers'
import { PageLayout, RarityTag } from './Page'
import { RunSeed } from './RunSeed'
import '../../styles/heropick-variants.css'

/**
 * H3-2 — three hero-pick layouts to TRY, not to ship yet.
 *
 * `?heropick=cards|compare|recommend` swaps the hero-pick page for one of the
 * directions in `docs/JTBD-hero-pick.md`; without the parameter (or with any
 * other value) RootShell renders today's `PageScreen` exactly as before. Like
 * `?art=`, it is a URL switch rather than a setting: nothing persists it and no
 * player reaches it by accident, but it works on a preview deploy, which is
 * where the designer will try it.
 *
 * All three are the real screen, not mock-ups: the same store actions
 * (`shellSelect`, `pickStartingHero`), the same preview Sentinel the shipped
 * screen computes (`previewHero`, Watchtower stat perks included), the real
 * sprites and the real page skeleton, Banner picker and seed field. Choosing a
 * hero here starts the run exactly as the shipped CTA does. Once the designer
 * picks a direction, "building it" is deleting the other two.
 */
export function HeroPickVariantScreen({ ctx, variant }: { ctx: ShellContext; variant: HeroPickVariant }) {
  const statBonus = useMetaStore((s) => s.bonuses().statBonus)
  const firstRun = useMetaStore((s) => s.stats.runsCompleted === 0)
  const selection = useGameStore((s) => s.shellSelection)
  const shellSelect = useGameStore((s) => s.shellSelect)
  const pickStartingHero = useGameStore((s) => s.pickStartingHero)

  const facts = useMemo(() => HERO_ORDER.map((a) => heroFacts(previewHero(a, statBonus))), [statBonus])
  const rec = useMemo(() => recommendFirstRun(facts), [facts])
  // The recommend layout opens on its suggestion; the other two open on the
  // first hero, as the shipped screen does.
  const fallback = variant === 'recommend' ? rec.id : facts[0].id
  const selected = facts.find((f) => f.id === selection?.id) ?? facts.find((f) => f.id === fallback)!
  const pick = (id: string) => {
    if (selection?.kind !== 'offer' || selection.id !== id) shellSelect({ kind: 'offer', id })
  }

  return (
    <PageLayout
      title={ctx.board?.title ?? 'Choose your first hero'}
      subtitle={ctx.board?.blurb}
      resources={<RunSeed />}
      cta={{ label: `Choose ${selected.name}`, run: () => pickStartingHero(selected.archetype) }}
    >
      <div className={`hpv hpv-${variant}`}>
        {variant === 'cards' && <CardsVariant facts={facts} selected={selected} onPick={pick} />}
        {variant === 'compare' && <CompareVariant facts={facts} selected={selected} onPick={pick} />}
        {variant === 'recommend' && (
          <RecommendVariant facts={facts} selected={selected} onPick={pick} rec={rec} firstRun={firstRun} />
        )}
        <RunOptions />
      </div>
    </PageLayout>
  )
}

// ------------------------------------------------------------------ pieces

/**
 * The hero's own battle animation, played in a menu.
 *
 * The strips are the ones `render/units.ts` plays on the field (idle, and the
 * attack while firing), with the frame counts from `render/anim.ts`. The
 * attack loop runs at the hero's REAL attack rate — one cycle per attack — so
 * the preview itself says "fast" or "slow" without a number: a Rogue's bow
 * snaps 2.6 times a second, a Mystic's cast takes over a second.
 *
 * Drawn at 1 CSS px per sprite px (2 device px on a phone), `pixelated`, and
 * never at a fractional scale. Frame size is read off the loaded image rather
 * than hard-coded, so a re-cut strip cannot desync the steps. With reduced
 * motion (the setting, which follows the OS by default) it is a still frame.
 */
function HeroSprite({ f, attacking }: { f: HeroFacts; attacking: boolean }) {
  const reduced = useSettingsStore((s) => s.reducedMotion)
  const kind = attacking && !reduced ? 'atk' : 'idle'
  const src = kind === 'atk' ? f.attackStrip : f.idleStrip
  const frames = ANIM_FRAMES[`${f.archetype}_${kind}`] ?? 1
  const [size, setSize] = useState<Record<string, { w: number; h: number }>>({})
  useEffect(() => {
    if (size[src]) return
    const img = new Image()
    img.onload = () => setSize((m) => ({ ...m, [src]: { w: img.naturalWidth, h: img.naturalHeight } }))
    img.src = src
  }, [src, size])
  const dim = size[src]
  const period = kind === 'atk' ? 1 / Math.max(0.2, f.rate) : 1
  return (
    <span className="hpv-sprite-box" aria-hidden="true">
      {dim ? (
        <span
          className={`hpv-sprite ${reduced ? '' : 'play'}`}
          style={
            {
              backgroundImage: `url(${src})`,
              '--fw': `${dim.w / frames}px`,
              '--fh': `${dim.h}px`,
              '--sw': `${dim.w}px`,
              '--frames': frames,
              '--period': `${period.toFixed(3)}s`,
            } as CSSProperties
          }
        />
      ) : (
        // Until the strip has loaded, the still portrait the shipped screen uses.
        <img className="hpv-sprite-still" src={heroArt(f.archetype)} alt="" />
      )}
    </span>
  )
}

/** A big number with a picture and a plain word under it. */
function BigStat({ icon, value, label }: { icon: IconKey; value: number | string; label: string }) {
  return (
    <span className="hpv-big">
      <span className="hpv-big-val">
        <Icon name={icon} />
        <b>{value}</b>
      </span>
      <span className="hpv-big-label">{label}</span>
    </span>
  )
}

/** The three numbers that decide a first battle: how hard, how far, how long. */
function BigThree({ f }: { f: HeroFacts }) {
  return (
    <span className="hpv-big3">
      <BigStat icon={f.splash > 0 ? 'splash' : 'damage'} value={f.dps} label={f.splash > 0 ? 'area dmg/s' : 'damage/s'} />
      <BigStat icon="range" value={f.range} label="reach" />
      <BigStat icon="hp" value={f.hp} label="health" />
    </span>
  )
}

/** "a Warrior, a Knight or a Guard" — with the article each name needs. */
const an = (w: string) => `${/^[AEIOU]/i.test(w) ? 'an' : 'a'} ${w}`
const oneOf = (names: string[]) => {
  const a = names.map(an)
  return a.length > 1 ? `${a.slice(0, -1).join(', ')} or ${a[a.length - 1]}` : (a[0] ?? '')
}

const railStyle = (f: HeroFacts) => ({ '--rail': archetypeVar(f.archetype) }) as CSSProperties

/** Where to post it and what it becomes — the planning half of the job. */
function PlanCard({ f }: { f: HeroFacts }) {
  return (
    <div className="pg-card hpv-plan" style={railStyle(f)}>
      <p className="pg-card-title">
        <Icon name="deploy" /> {f.place}
      </p>
      <p className="pg-card-body">
        <Icon name="evolve" /> At level {TIER1_LEVEL} it grows into {oneOf(f.grows)}.
      </p>
      <p className="pg-card-body">
        <Icon name="equip" /> Starts wearing {an(f.kit.weapon.toLowerCase())} weapon, {f.kit.body.toLowerCase()} armour and {an(f.kit.offHand.toLowerCase())} off-hand.
      </p>
    </div>
  )
}

/**
 * The Banner, demoted for the player who did not come for it (JTBD doc §
 * Forces): it renders nothing until a rung is unlocked, and nothing on a Daily.
 * The seed rides in the header now (`RunSeed` in `resources`), as a chip.
 */
function RunOptions() {
  return <BannerPicker />
}

interface VariantProps {
  facts: HeroFacts[]
  selected: HeroFacts
  onPick: (id: string) => void
}

// ------------------------------------------------------- A · play-style cards

/**
 * Direction A — every hero on screen at once, each as how it FIGHTS: a looping
 * attack, one sentence, three big numbers. The selected card plays its attack;
 * the others idle. The plan card under the list answers "where do I put it".
 */
function CardsVariant({ facts, selected, onPick }: VariantProps) {
  return (
    <>
      <div className="hpv-cardlist" role="group" aria-label="Starting heroes">
        {facts.map((f) => {
          const sel = f.id === selected.id
          return (
            <button key={f.id} className={`hpv-card ${sel ? 'sel' : ''}`} style={railStyle(f)} aria-pressed={sel} onClick={() => onPick(f.id)}>
              <span className="hpv-card-art">
                <HeroSprite f={f} attacking={sel} />
              </span>
              <span className="hpv-card-main">
                <span className="hpv-card-name">
                  <span className="hpv-glyph" aria-hidden="true">
                    {ARCHETYPE_GLYPH[f.archetype]}
                  </span>
                  {f.name}
                </span>
                <span className="hpv-card-style">{f.playStyle}</span>
                <BigThree f={f} />
              </span>
            </button>
          )
        })}
      </div>
      <PlanCard f={selected} />
    </>
  )
}

// ------------------------------------------------------------- B · compare

/**
 * Direction B — the three side by side, one row per question, so nothing has
 * to be held in memory between taps. Numbers get a bar scaled to the best of
 * the three; KINDS (one target or an area, holds or not) stay words, because a
 * bar would rank things that are not better or worse, only different.
 *
 * The honesty problem this layout has to solve: a Mystic's 22 damage per
 * second is the smallest bar on the board, and a Mystic-led first run goes as
 * far as any (balance/REPORT.md §11). So its damage cell says "area" beside
 * the number and the Hits row sits directly under it.
 */
function CompareVariant({ facts, selected, onPick }: VariantProps) {
  const wide = useMedia('(min-width: 900px) and (min-height: 540px)')
  const max = (k: 'dps' | 'range' | 'hp' | 'rate') => Math.max(...facts.map((f) => f[k]))
  const bar = (f: HeroFacts, k: 'dps' | 'range' | 'hp' | 'rate', text: string, note?: string) => (
    <td key={f.id} className={f.id === selected.id ? 'sel' : ''} style={railStyle(f)}>
      <span className="hpv-cell-num">
        {text}
        {note && <span className="hpv-cell-note"> {note}</span>}
      </span>
      <span className="hpv-bar" aria-hidden="true">
        <i style={{ width: `${Math.round((f[k] / max(k)) * 100)}%` }} />
      </span>
    </td>
  )
  const word = (f: HeroFacts, text: ReactNode) => (
    <td key={f.id} className={f.id === selected.id ? 'sel' : ''} style={railStyle(f)}>
      <span className="hpv-cell-word">{text}</span>
    </td>
  )
  return (
    <>
      <table className="hpv-table" aria-label="The three starting heroes compared">
        <thead>
          {/* Two header rows: the sprites are the controls (named, pressed
              state), the names are the real column headers and stay pinned
              while the rows scroll, so a long table never loses which column
              is which. */}
          <tr className="hpv-sprites">
            <td className="hpv-corner" />
            {facts.map((f) => {
              const sel = f.id === selected.id
              return (
                <td key={f.id} className={sel ? 'sel' : ''} style={railStyle(f)}>
                  <button className="hpv-colhead" aria-label={f.name} aria-pressed={sel} onClick={() => onPick(f.id)}>
                    {/* The attack strip is wider than a phone column (a
                        Fighter's swing is 130px); there the columns idle and
                        the attack plays where it fits. */}
                    <HeroSprite f={f} attacking={sel && wide} />
                  </button>
                </td>
              )
            })}
          </tr>
          <tr className="hpv-names">
            <td className="hpv-corner" />
            {facts.map((f) => (
              <th key={f.id} scope="col" className={f.id === selected.id ? 'sel' : ''} style={railStyle(f)} onClick={() => onPick(f.id)}>
                {f.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Damage/s</th>
            {facts.map((f) => bar(f, 'dps', String(f.dps), f.splash > 0 ? 'area' : undefined))}
          </tr>
          <tr>
            <th scope="row">Hits</th>
            {facts.map((f) => word(f, f.splash > 0 ? 'Everything near the target' : 'One enemy'))}
          </tr>
          <tr>
            <th scope="row">Reach</th>
            {facts.map((f) => bar(f, 'range', String(f.range)))}
          </tr>
          <tr>
            <th scope="row">Stops enemies</th>
            {facts.map((f) => word(f, f.block ? `Up to ${f.block}` : 'No'))}
          </tr>
          <tr>
            <th scope="row">Health</th>
            {facts.map((f) => bar(f, 'hp', String(f.hp)))}
          </tr>
          <tr>
            <th scope="row">Attacks/s</th>
            {facts.map((f) => bar(f, 'rate', f.rate.toFixed(1)))}
          </tr>
          <tr>
            <th scope="row">Crit</th>
            {facts.map((f) => word(f, `${Math.round(f.critChance * 100)}% for ×${f.critMult.toFixed(1)}`))}
          </tr>
          <tr>
            <th scope="row">Damage</th>
            {facts.map((f) => word(f, f.damageType === 'magic' ? 'Magic' : 'Physical'))}
          </tr>
          <tr>
            <th scope="row">Weapon</th>
            {facts.map((f) => word(f, <RarityTag rarity={f.kit.weaponRarity} />))}
          </tr>
          <tr>
            <th scope="row">Grows into</th>
            {facts.map((f) => word(f, f.grows.join(', ')))}
          </tr>
        </tbody>
      </table>
      <div className="pg-card hpv-plan" style={railStyle(selected)}>
        <p className="pg-card-title">{selected.playStyle}</p>
        <p className="pg-card-body">
          <Icon name="deploy" /> {selected.place}
        </p>
      </div>
    </>
  )
}

// ---------------------------------------------------------- C · recommended

/**
 * Direction C — one suggestion, with its reason, and the other two one tap
 * away. For the first-run hirer the screen stops being a quiz: it says who to
 * take and why, and still lets them overrule it (the "it was my choice" half
 * of the job). The reason is a claim about FORGIVENESS, not strength — see
 * `recommendFirstRun`. After a first run the label drops "for your first run"
 * and keeps the reason.
 */
function RecommendVariant({ facts, selected, onPick, rec, firstRun }: VariantProps & { rec: { id: string; reason: string }; firstRun: boolean }) {
  const isRec = selected.id === rec.id
  const others = facts.filter((f) => f.id !== selected.id)
  // Picking an alternative REMOVES the row you pressed (it becomes the big
  // card), which would drop keyboard focus to <body>. Focus follows the pick
  // to the card instead, so a screen reader reads who you just chose.
  const heroRef = useRef<HTMLElement>(null)
  const picked = useRef(false)
  useEffect(() => {
    if (picked.current) heroRef.current?.focus({ preventScroll: false })
  }, [selected.id])
  const choose = (id: string) => {
    picked.current = true
    onPick(id)
  }
  return (
    <>
      <section
        ref={heroRef}
        tabIndex={-1}
        className="hpv-hero"
        style={railStyle(selected)}
        aria-label={`${selected.name}${isRec ? ', recommended' : ''}`}
      >
        <p className={`hpv-eyebrow ${isRec ? 'rec' : ''}`}>
          {isRec ? (
            <>
              <Icon name="boon" /> {firstRun ? 'Recommended for your first run' : 'The most forgiving to place'}
            </>
          ) : (
            'Your pick'
          )}
        </p>
        <div className="hpv-hero-row">
          <span className="hpv-card-art">
            <HeroSprite f={selected} attacking />
          </span>
          <div className="hpv-card-main">
            <p className="hpv-card-name">
              <span className="hpv-glyph" aria-hidden="true">
                {ARCHETYPE_GLYPH[selected.archetype]}
              </span>
              {selected.name}
            </p>
            <p className="hpv-card-style">{selected.playStyle}</p>
          </div>
        </div>
        {isRec && <p className="hpv-reason">{rec.reason} All three can win.</p>}
        <BigThree f={selected} />
        <p className="pg-card-body hpv-place">
          <Icon name="deploy" /> {selected.place}
        </p>
      </section>
      <p className="hpv-eyebrow">Or lead with</p>
      <div className="hpv-alts" role="group" aria-label="Other starting heroes">
        {others.map((f) => (
          <button key={f.id} className="hpv-alt" style={railStyle(f)} onClick={() => choose(f.id)}>
            <span className="hpv-alt-art">
              <img src={heroArt(f.archetype)} alt="" />
            </span>
            <span className="hpv-alt-text">
              <span className="hpv-alt-name">
                {f.name}
                {f.id === rec.id && <span className="hpv-alt-tag">Recommended</span>}
              </span>
              <span className="hpv-alt-style">{f.playStyle}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  )
}
