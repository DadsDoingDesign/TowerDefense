import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../state/gameStore'
import { useMetaStore } from '../../state/metaStore'
import type { ShellContext } from './context'
import { railText } from '../channels'
import { type Act, type Offer, type Price } from './offers'
import { CollectionTabs, SkillCard, SkillCards } from './SkillCards'
import { HeroCards } from './HeroCards'
import { PackStrip } from './PackStrip'
import { InfoToggle } from './InfoToggle'
import { Money } from './Money'
import { InfoCard, MenuRow, PageLayout, PortraitRow, priceNode, RarityTag, StatRow, Tile } from './Page'
import { RunSeed } from './RunSeed'
import { VolumeSlider } from './VolumeSlider'
import { useStaged } from './staging'
import { ContractChip } from './contracts/parts'
import { commitOneTap, describeOneTap, OneTapHint, useOneTap, useOneTapUntaught } from './oneTap'

/**
 * How long a freshly-revealed confirm control refuses to act.
 *
 * This is belt-and-braces, not the guarantee. The guarantee is structural —
 * see `useArmedAction` — and this window only covers the one case structure
 * cannot: a tap that was already travelling when the control appeared. WebKit's
 * double-tap-to-zoom recogniser runs to roughly 300-350ms, so 400ms is past the
 * far edge of a single gesture rather than inside it.
 */
const CONFIRM_SETTLE_MS = 400

/**
 * What the arming control says once it is armed: the way back, not the deed.
 * Deliberately not "Back" — the Watchtower pages already carry a "Back" row,
 * and two controls a thumb apart must not read as the same word.
 */
const BACK_OUT_LABEL = 'Never mind'

/** The confirm control's handlers, handed to whichever renderer draws it. */
export interface ConfirmControl {
  label: string
  run: (e?: { detail?: number }) => void
  onKeyDown: (e: { repeat: boolean; preventDefault: () => void }) => void
  onPointerDown: () => void
}

/**
 * The shell's one confirm affordance, and what it actually guarantees.
 *
 * An action carrying `confirm` never fires from the control you pressed. The
 * first activation *arms*: that control's label swaps to "Never mind", a notice
 * explains what is about to happen, and a second, separately-labelled control
 * carrying the destructive verb appears above the pinned CTA. Pressing the
 * original control again just disarms it.
 *
 * So the guarantee is structural rather than temporal: no repetition of one
 * control's own activation can confirm — not a `dblclick`, not two taps at any
 * spacing, not Enter pressed twice, not a key held until the OS auto-repeats.
 * Confirming means moving to a different control, which is a second decision
 * rather than a second event.
 *
 * The previous version tried to buy that with a 250ms dwell plus a `detail > 1`
 * check and bought neither. `detail` is 0 on every keyboard-driven click, so
 * Enter-Enter and a held Enter both went straight through; and two taps more
 * than 250ms apart went through as well, which covers most of WebKit's
 * double-tap window (~300-350ms) and every OS key repeat (first repeat at
 * ~500ms, i.e. twice the dwell). Both of those wiped progress on the real app.
 *
 * Two smaller guards ride along, for the travelling-tap case only:
 * `CONFIRM_SETTLE_MS`, and dropping any activation whose keydown was an
 * auto-repeat.
 *
 * What has NOT changed: the CTA does not move or resize when it arms. Nothing
 * shifts under a finger already coming down — the notice and the confirm
 * control take their room from the body, and the CTA stays pinned where it was.
 * Rule four still holds too: no modal, nothing covering the page.
 *
 * Used by Reset progress and Dark Sacrifice, the two things in the shell that
 * cannot be taken back.
 */
export function useArmedAction(act: Act | undefined, key: string | undefined) {
  const [armedKey, setArmedKey] = useState<string | null>(null)
  const armedAt = useRef(0)
  /** Set when the keydown that produced the pending activation was a repeat. */
  const fromRepeat = useRef(false)
  // Moving to a different offer always disarms — an armed confirm must never
  // outlive the thing it was pointed at.
  useEffect(() => {
    setArmedKey(null)
    armedAt.current = 0
    fromRepeat.current = false
  }, [key])

  const needsConfirm = !!act?.confirm
  const armed = needsConfirm && armedKey === key && key != null
  const disarm = useCallback(() => setArmedKey(null), [])

  /**
   * The arming control's handler. It arms, or it backs out. It never runs a
   * `confirm` action, which is the whole point: pressing this thing twice —
   * however, whenever, with whatever — cannot destroy anything.
   */
  const fire = () => {
    if (!act) return
    if (!needsConfirm) return act.run()
    armedAt.current = armed ? 0 : Date.now()
    setArmedKey(armed ? null : (key ?? null))
  }

  /** The separate confirm control's handler — the only path to `act.run()`. */
  const runConfirm = (e?: { detail?: number }) => {
    if (!act?.confirm || !armed) return
    // An auto-repeat is the OS talking, not a person deciding.
    if (fromRepeat.current) {
      fromRepeat.current = false
      return
    }
    // The browser's own consecutive-click counter: one double-click, one
    // gesture, one decision — never two.
    if ((e?.detail ?? 0) > 1) return
    if (Date.now() - armedAt.current < CONFIRM_SETTLE_MS) return
    armedAt.current = 0
    setArmedKey(null)
    act.run()
  }

  const confirm: ConfirmControl | undefined = armed
    ? {
        label: act!.confirm!.label,
        run: runConfirm,
        onKeyDown: (e) => {
          if (e.repeat) {
            e.preventDefault()
            fromRepeat.current = true
          } else {
            fromRepeat.current = false
          }
        },
        onPointerDown: () => {
          fromRepeat.current = false
        },
      }
    : undefined

  return {
    armed,
    disarm,
    fire,
    confirm,
    label: armed ? BACK_OUT_LABEL : (act?.label ?? ''),
    notice: armed ? act!.confirm!.note : undefined,
    // Danger red belongs on whatever is about to do the damage. Once armed that
    // is the confirm control; the CTA is the way back out, and must not read as
    // the destructive one.
    danger: needsConfirm && !armed,
  }
}

/**
 * Every non-battle context, rendered on the page skeleton.
 *
 * They all reduce to the same shape — pick one of N, read what it does, commit
 * with the pinned CTA — which is why hero-pick, the merchant, the shrine, the
 * endless rooms and the perk list can share one renderer.
 */
export function PageScreen({
  ctx,
  offers,
  title: titleOverride,
  subtitle: subtitleOverride,
}: {
  ctx: ShellContext
  offers: Offer[]
  title?: string
  subtitle?: string
}) {
  const selection = useGameStore((s) => s.shellSelection)
  const shellSelect = useGameStore((s) => s.shellSelect)
  const gold = useGameStore((s) => s.gold)
  const bank = useMetaStore((s) => s.bank)
  const onHub = useGameStore((s) => s.screen === 'hub')
  // How far off an unaffordable price is, in the gold it is paid from (R2):
  // the purse in a run, the bank at home.
  const shortfall = (c: Price) => Math.max(0, c.amount - (onHub ? bank : gold))
  const heroPick = useGameStore((s) => s.screen === 'heroPick')
  const contract = useGameStore((s) => s.contract)
  // LS3: a first run's hero-pick carries no seed chip — a seed is a thing to
  // share or replay, and a first run has neither yet.
  const staged = useStaged()
  // The pack + company strip rides on every in-run event page (Phase 2).
  const inRunBoard = useGameStore(
    (s) => s.runPhase === 'active' && (s.screen === 'map' || s.screen === 'crossroads'),
  )

  // Offers that act on tap (back, leave) are navigation, not choices — they
  // sit under the body as rows rather than joining the chooser.
  const choices = offers.filter((o) => !o.immediate)
  const navs = offers.filter((o) => o.immediate)

  /*
   * After a purchase the page selects NOTHING (Wave 1).
   *
   * The CTA defaults to the first choice when nothing is picked, and a bought
   * item leaves the list — so the selection fell through to the next row and
   * the same thumb, on the same pinned button, bought it too. `receipt` holds
   * the brief "added to your pack" line and, while it is up, suppresses the
   * default; picking any row clears it.
   */
  const [receipt, setReceipt] = useState<{ text: string; key: number } | null>(null)
  useEffect(() => {
    if (!receipt) return
    const t = setTimeout(() => setReceipt((r) => (r?.key === receipt.key ? { ...r, text: '' } : r)), 2600)
    return () => clearTimeout(t)
  }, [receipt])
  const explicit = choices.find((o) => o.id === selection?.id)
  // The CTA needs a target, so default to the first choice — except straight
  // after a purchase, when the player has to pick the next thing on purpose.
  const selected = explicit ?? (receipt ? undefined : choices[0])
  const confirm = useArmedAction(selected?.action, selected?.id)

  // With a long row list — the perks page is seven rows — the detail for the
  // row you just tapped falls below the fold, so the page answers a tap with
  // nothing visible. Bring it up, but only for a tap: doing it on first render
  // would scroll the top of the list away before it has been read.
  // Arming also re-runs it: the confirm notice takes height off the body, which
  // would otherwise re-clip the detail at the moment it matters most.
  const detailRef = useRef<HTMLDivElement>(null)
  const tapped = useRef(false)
  // Counts taps, so tapping the row that is ALREADY the default selection (the
  // Settings page's first row, Sound) still brings its detail — the dials —
  // into view; `selected.id` alone does not change on that tap.
  const [tapN, setTapN] = useState(0)
  useEffect(() => {
    if (tapped.current) detailRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selected?.id, confirm.armed, tapN])

  const pick = (id: string) => {
    tapped.current = true
    setTapN((n) => n + 1)
    setReceipt(null)
    confirm.disarm()
    if (selection?.kind !== 'offer' || selection.id !== id) shellSelect({ kind: 'offer', id })
  }

  /*
   * One-tap choices (October 2026; the designer's call on audit §4 item 8):
   * a reward card on the Spoils page and the campfire's rest and train commit
   * on the tap. A hold (touch), a hover (mouse) or keyboard focus shows the
   * row's detail instead — the same detail block a pick fills — and the
   * page has no CTA for them: a button that repeats what the tap did is
   * chrome. Everything that spends, is permanent or destroys keeps `pick`
   * and the pinned CTA.
   */
  const oneTapUntaught = useOneTapUntaught()
  const hasOneTap = choices.some((o) => o.oneTap)
  const spoils = useGameStore((s) => !!s.reward)
  const oneTap = useOneTap({
    surface: choices.map((o) => o.id).join(' '),
    commit: (id) => {
      const o = choices.find((c) => c.id === id)
      if (o) commitOneTap(o)
    },
    inspect: (id, how) => {
      // A hover reads in place; a hold or keyboard focus brings the detail
      // into view, as a pick does. Hovering must never scroll the page.
      if (how === 'hover') {
        if (selection?.kind !== 'offer' || selection.id !== id) shellSelect({ kind: 'offer', id })
        return
      }
      pick(id)
    },
    disabled: (id) => !!choices.find((c) => c.id === id)?.action?.disabled,
  })

  const title = titleOverride ?? ctx.board?.title ?? 'Merchant Mercenaries'
  // Oct 2026 (3.5): an in-run event board (merchant, shrine, campfire, a
  // recruit, the Crossroads) carries no subtitle — its title and the pack
  // strip are the head, and the board's own detail says the rest. The flavour
  // line cost a row of chrome on every stop of every run.
  const eventBoard = inRunBoard && !titleOverride
  const subtitle = subtitleOverride ?? (eventBoard ? undefined : ctx.board?.blurb)

  // A page where nothing is bought or spent does not need a purse on it, and a
  // page that spends one currency does not need the other. Reading the prices
  // the page actually shows answers both: the Forge prices both its actions
  // rather than the card, which is why the dust purse used to be missing in the
  // one room that spends dust — and why a GOLD chip sat there instead,
  // reporting a currency the Forge cannot take.
  const purse = new Set<Price['currency']>()
  for (const o of choices) {
    for (const c of [o.cost, o.action?.cost, o.secondary?.cost]) if (c) purse.add(c.currency)
  }

  // A chooser only makes sense with more than one thing to choose between.
  // Heroes as comparison cards (the hero pick, a recruit slate) come first.
  const asHeroes = choices.length > 1 && choices.every((o) => o.hero)
  const asPortraits = !asHeroes && choices.length > 1 && choices.every((o) => o.portrait)
  // A one-tap choice is always a row, even alone: the row IS its commit.
  const asRows = (choices.length > 1 || hasOneTap) && !asPortraits && !asHeroes

  return (
    <PageLayout
      title={title}
      subtitle={subtitle}
      // Announced only where the board is an outcome — today, the Crossroads
      // reveal. `titleOverride` is a Watchtower submenu, which is navigation.
      live={!titleOverride && ctx.board?.live}
      // Hero-pick prices nothing, so its title block carries the run's seed
      // and terms instead (`RunSeed`, a chip that never scrolls).
      // On an event board the purse rides on the pack strip's row (3.5).
      resources={purse.size && !eventBoard ? <Resources show={purse} /> : heroPick && !staged ? <RunSeed /> : undefined}
      strip={
        eventBoard ? (
          <PackStrip gold={purse.has('gold') ? gold : undefined} />
        ) : heroPick && contract ? (
          <ContractChip company={contract.company} crates={contract.crates} purse={contract.purse} advance={!!contract.advance} />
        ) : undefined
      }
      // 3.5: a short board keeps its CTA under its content instead of pinning
      // it to the bottom of an empty column — except while the selected action
      // can ARM (`confirm`): there the CTA stays pinned, so arming (which adds
      // the notice and the confirm above it) moves nothing under the finger.
      compact={!selected?.action?.confirm}
      tone={ctx.board?.tone}
      notice={confirm.notice}
      confirm={confirm.confirm}
      cta={
        selected?.action && !selected.oneTap
          ? {
              label: confirm.label,
              run: () => {
                const done = selected.action?.done
                confirm.fire()
                if (done && !selected.action?.confirm) {
                  setReceipt({ text: done, key: Date.now() })
                  shellSelect(null)
                }
              },
              disabled: selected.action.disabled,
              danger: confirm.danger,
              // 3.3: a setting's flip is not a step forward — it takes the quiet
              // treatment, so the page never shows a primary that goes nowhere.
              quiet: selected.action.quiet,
              // Armed, the CTA is the way back out ("Never mind") and carries no price.
              cost: confirm.armed ? undefined : selected.action.cost,
              // A2: the purse after this gold purchase, where you commit to it.
              after:
                !confirm.armed && !selected.action.disabled && selected.action.cost?.currency === 'gold'
                  ? `${(onHub ? bank : gold) - selected.action.cost.amount} left`
                  : undefined,
            }
          : receipt
            ? // Held in place, disabled, so nothing moves under the thumb.
              { label: 'Pick the next one', run: () => {}, disabled: true }
            : undefined
      }
      secondary={
        selected?.tiles?.length ? (
          <>
            {selected.tiles.map((t) => (
              <Tile key={t.caption} caption={t.caption} glyph={t.glyph} art={t.art} icon={t.icon} />
            ))}
          </>
        ) : undefined
      }
      // The reversible exits — "March on", "Leave", "Back", "Pick someone
      // else" — are pinned above the CTA instead of trailing a scrolling body.
      // They are what an offer board's second footer slot is for, and they are
      // exactly the rows that kept measuring below the fold (F14).
      foot={
        navs.length > 0 || heroPick ? (
          <>
            {/* The hero pick's difficulty rides PINNED, above Back: in the
                scrolling body its chips sat half under the body's fade, which
                read as hidden behind the Back row. Self-gating — nothing until
                a win has raised the top step, nothing on a Daily. */}
            {navs.length > 0 && (
              <div className="pg-rows">
                {navs.map((o) => (
                  <MenuRow key={o.id} label={o.title} value={o.sub} icon={o.icon} glyph={o.glyph} onClick={() => o.action?.run()} />
                ))}
              </div>
            )}
          </>
        ) : undefined
      }
    >
      {/* The receipt is said by `ReceiptToast` now (Phase 2), derived from what
          actually landed, and shown where the eye is — the in-body line sat
          below the fold on a small phone. `receipt` still holds the CTA. */}

      {asPortraits && (
        <PortraitRow
          items={choices.map((o) => ({
            id: o.id,
            // The chooser's only visible content is a sprite, so the offer's
            // own title and sub have to become the control's name (M27d).
            label: [o.title, o.sub].filter(Boolean).join(' — '),
            art: o.portrait!.art,
            glyph: o.portrait!.glyph,
            color: o.portrait!.color,
            // Only set where a chooser genuinely mixes kinds (the Crossroads).
            // On hero-pick all three are the same kind of thing and a badge on
            // every one of them would be decoration.
            badge: o.portrait!.badge,
          }))}
          selectedId={selected?.id ?? null}
          onSelect={pick}
        />
      )}

      {asHeroes && <HeroCards items={choices} selectedId={selected?.id ?? null} onSelect={pick} />}

      {/* With a row chooser the list comes first — reading a detail for
          something you have not picked yet reads backwards. */}
      {/* The how-to for a one-tap board, once (until the first one-tap
          commit anywhere): "Tap to take · hold to look". */}
      {asRows && hasOneTap && oneTapUntaught && <OneTapHint verb={spoils ? 'take' : 'choose'} className="pg-hint" />}

      {asRows && (
        <div className="pg-rows">
          {choices.map((o) => (
            <MenuRow
              key={o.id}
              label={o.title}
              value={
                o.cost ? priceNode(o.cost, o.dim ? shortfall(o.cost) : false) : o.rarity ? <RarityTag rarity={o.rarity} suffix={o.sub} /> : o.sub
              }
              currency={o.cost?.currency}
              rail={o.color}
              icon={o.icon}
              mark={o.mark}
              glyph={o.glyph}
              art={o.rowArt}
              note={o.note}
              big={!!o.note}
              dim={o.dim}
              pips={o.pips}
              onClick={() => pick(o.id)}
              selected={o.id === selected?.id}
              {...(o.oneTap
                ? {
                    press: oneTap.bind(o.id),
                    pressing: oneTap.pressing === o.id,
                    name: o.oneTap.label,
                    description: describeOneTap(o),
                    disabled: o.action?.disabled,
                  }
                : {})}
            />
          ))}
        </div>
      )}

      {selected && asHeroes && (selected.body.length > 0 || selected.warn) && (
        <div className="pg-detail" ref={detailRef}>
          {/* Everything about the hero is on its card; what is left is the
              terms of taking it (a full company, the enemy-strength note). */}
          <InfoCard lines={selected.body} warn={selected.warn} />
        </div>
      )}

      {selected && !asHeroes && (
        <div className="pg-detail" ref={detailRef}>
          {!asRows && (
            <p className="pg-name" style={selected.color ? { color: railText(selected.color) } : undefined}>
              {selected.title}
            </p>
          )}
          {/* The full name with its rarity in its own hue and pip count. A long
              generated name ("Ruinous Bow of Precision") is cut short in its
              row, and merchant and Forge rows spend their value slot on the
              price, so this line is where both read in full. */}
          {asRows && selected.rarity ? (
            <p className="pg-rarity-line">
              <b style={selected.color ? { color: railText(selected.color) } : undefined}>{selected.title}</b>{' '}
              <RarityTag rarity={selected.rarity} />
            </p>
          ) : null}
          {selected.stats?.length ? <StatRow stats={selected.stats} /> : null}
          {selected.skill ? <SkillCard skill={selected.skill} color={selected.color} /> : null}
          <InfoCard lines={selected.body} warn={selected.warn} icons={selected.bodyIcons} />
          {selected.cards?.length ? <SkillCards cards={selected.cards} /> : null}
          {selected.tabs?.length ? <CollectionTabs tabs={selected.tabs} /> : null}
          {selected.info && (
            <p className="pg-info-line">
              {selected.info.label}
              <InfoToggle label={selected.info.label} lines={selected.info.lines} />
            </p>
          )}
          {selected.sliders?.length ? (
            <div className="pg-sliders">
              {selected.sliders.map((d) => (
                <VolumeSlider key={d.id} label={d.label} value={d.value} onChange={d.set} preview={d.preview} />
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* The selected thing's second action belongs with it, above the ways
          out — "Raise rarity" reading below "Leave" put the exit in the middle
          of the decision. It runs on the first tap and is never armed, which
          is why `SecondaryAct` will not accept a `confirm`. */}
      {selected?.secondary && (
        <div className="pg-rows">
          <MenuRow
            label={selected.secondary.label}
            value={selected.secondary.cost ? priceNode(selected.secondary.cost) : undefined}
            onClick={selected.secondary.run}
            disabled={selected.secondary.disabled}
            dim={selected.secondary.disabled}
            currency={selected.secondary.cost?.currency}
            icon={selected.secondary.icon}
          />
        </div>
      )}

    </PageLayout>
  )
}

/**
 * Purse chips for exactly the currencies the page in front of you spends.
 *
 * One mark per currency (Wave 1): the chip used to be a pixel coin AND `⟡ 240`,
 * and `⟡` was also the Merchant on the run map. The words a copied string or a
 * screen reader needs are in `Money`'s accessible name ("240 gold").
 */
function Resources({ show }: { show: ReadonlySet<Price['currency']> }) {
  const screen = useGameStore((s) => s.screen)
  const gold = useGameStore((s) => s.gold)
  const bank = useMetaStore((s) => s.bank)
  if (!show.has('gold')) return null
  // At home the gold is the bank's; in a run it is the purse.
  return (
    <span className="pg-chip gold">
      <Money amount={screen === 'hub' ? bank : gold} c="gold" />
      {screen === 'hub' && <span className="pg-chip-word">in the bank</span>}
    </span>
  )
}
