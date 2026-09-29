import { useCallback, useEffect, useRef, useState } from 'react'
import { RARITY } from '../../game/data/items'
import { CURRENCY_GLYPH, type IconKey } from '../channels'
import { Icon } from '../Icon'
import { useGameStore } from '../../state/gameStore'
import { bannerRules, useMetaStore } from '../../state/metaStore'
import { assistProfile, useSettingsStore, type AssistLevel } from '../../state/settingsStore'
import type { ShellContext } from './context'
import { bannerLine, type Act, type Offer, type Price } from './offers'
import { BannerPicker } from './BannerPicker'
import { InfoCard, MenuRow, PageLayout, PortraitRow, StatRow, Tile } from './Page'

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

  // Offers that act on tap (back, leave) are navigation, not choices — they
  // sit under the body as rows rather than joining the chooser.
  const choices = offers.filter((o) => !o.immediate)
  const navs = offers.filter((o) => o.immediate)

  // The CTA always needs a target, so default to the first choice.
  const selected = choices.find((o) => o.id === selection?.id) ?? choices[0]
  const confirm = useArmedAction(selected?.action, selected?.id)

  // With a long row list — the perks page is seven rows — the detail for the
  // row you just tapped falls below the fold, so the page answers a tap with
  // nothing visible. Bring it up, but only for a tap: doing it on first render
  // would scroll the top of the list away before it has been read.
  // Arming also re-runs it: the confirm notice takes height off the body, which
  // would otherwise re-clip the detail at the moment it matters most.
  const detailRef = useRef<HTMLDivElement>(null)
  const tapped = useRef(false)
  useEffect(() => {
    if (tapped.current) detailRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selected?.id, confirm.armed])

  const pick = (id: string) => {
    tapped.current = true
    confirm.disarm()
    if (selection?.kind !== 'offer' || selection.id !== id) shellSelect({ kind: 'offer', id })
  }

  const title = titleOverride ?? ctx.board?.title ?? 'Fieldwatch'
  const subtitle = subtitleOverride ?? ctx.board?.blurb

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
  const asPortraits = choices.length > 1 && choices.every((o) => o.portrait)
  const asRows = choices.length > 1 && !asPortraits

  return (
    <PageLayout
      title={title}
      subtitle={subtitle}
      // Announced only where the board is an outcome — today, the Crossroads
      // reveal. `titleOverride` is a Watchtower submenu, which is navigation.
      live={!titleOverride && ctx.board?.live}
      resources={purse.size ? <Resources show={purse} /> : undefined}
      notice={confirm.notice}
      confirm={confirm.confirm}
      cta={
        selected?.action
          ? { label: confirm.label, run: confirm.fire, disabled: selected.action.disabled, danger: confirm.danger }
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
        navs.length > 0 ? (
          <div className="pg-rows">
            {navs.map((o) => (
              <MenuRow key={o.id} label={o.title} value={o.sub} icon={o.icon} glyph={o.glyph} onClick={() => o.action?.run()} />
            ))}
          </div>
        ) : undefined
      }
    >
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

      {/* With a row chooser the list comes first — reading a detail for
          something you have not picked yet reads backwards. */}
      {asRows && (
        <div className="pg-rows">
          {choices.map((o) => (
            <MenuRow
              key={o.id}
              label={o.title}
              value={o.cost ? priceLabel(o.cost) : o.sub}
              currency={o.cost?.currency}
              rail={o.color}
              icon={o.icon}
              mark={o.mark}
              glyph={o.glyph}
              onClick={() => pick(o.id)}
              selected={o.id === selected?.id}
            />
          ))}
        </div>
      )}

      {selected && (
        <div className="pg-detail" ref={detailRef}>
          {!asRows && (
            <p className="pg-name" style={selected.color ? { color: selected.color } : undefined}>
              {selected.title}
            </p>
          )}
          {selected.stats?.length ? <StatRow stats={selected.stats} /> : null}
          <InfoCard lines={selected.body} warn={selected.warn} icons={selected.bodyIcons} />
        </div>
      )}

      {/*
        Hero-pick only, and self-gating: the Banner is the *other* half of the
        run-start decision and hero-pick is the only screen the store will
        accept it on.

        It used to sit ABOVE this detail block, on the reasoning that the hero's
        three headline traits are pinned in the tile row and the CTA names the
        hero, so the stat card was the half that could afford to be scrolled to.
        Measured at Large UI, that was wrong in a way the tiles cannot cover:
        all three body lines started below the fold, INCLUDING the one sentence
        that says what the archetype actually does (F15). The tiles carry
        numbers; nothing else on the screen says what a Mystic is. A
        choose-your-first-hero screen that shows a portrait, three stats and no
        explanation is not a choice.

        The tie-breaker is who is looking at each half. `BannerPicker` renders
        NOTHING until a rung is unlocked, so a first-time player — the only
        player who needs the ability sentence — never sees it at all; the player
        who does see it has already finished a run and knows the archetypes.
        The ability sentence goes first.
      */}
      <BannerPicker />

      {/* The selected thing's second action belongs with it, above the ways
          out — "Raise rarity" reading below "Leave" put the exit in the middle
          of the decision. It runs on the first tap and is never armed, which
          is why `SecondaryAct` will not accept a `confirm`. */}
      {selected?.secondary && (
        <div className="pg-rows">
          <MenuRow
            label={selected.secondary.label}
            value={selected.secondary.cost ? priceLabel(selected.secondary.cost) : undefined}
            onClick={selected.secondary.run}
            disabled={selected.secondary.disabled}
            currency={selected.secondary.cost?.currency}
            icon={selected.secondary.icon}
          />
        </div>
      )}

    </PageLayout>
  )
}

const priceLabel = (p: { amount: number; currency: keyof typeof CURRENCY_GLYPH }) =>
  `${CURRENCY_GLYPH[p.currency]} ${p.amount}`

/** The atlas cell for each purse, so a chip and its icon cannot disagree. */
const CURRENCY_ICON: Record<Price['currency'], IconKey> = {
  gold: 'gold',
  dust: 'dust',
  marks: 'marks',
}

/**
 * Purse chips for exactly the currencies the page in front of you spends.
 *
 * The glyph stays beside the icon rather than being replaced by it: `⟡ 240`
 * with a coin in front is two channels, and the glyph is what a copied string
 * or a screen reader still carries.
 */
function Resources({ show }: { show: ReadonlySet<Price['currency']> }) {
  const screen = useGameStore((s) => s.screen)
  const gold = useGameStore((s) => s.gold)
  const dust = useGameStore((s) => s.dust)
  const marks = useMetaStore((s) => s.watchMarks)

  const chip = (c: Price['currency'], n: number, tone: string) => (
    <span className={`pg-chip ${tone}`} key={c}>
      <Icon name={CURRENCY_ICON[c]} />
      {CURRENCY_GLYPH[c]} {n}
    </span>
  )

  // The Watchtower's pages price everything in Watch Marks and nothing else.
  if (screen === 'hub') return chip('marks', marks, 'gold')
  return (
    <>
      {show.has('gold') && chip('gold', gold, 'gold')}
      {show.has('dust') && chip('dust', dust, 'teal')}
      {show.has('marks') && chip('marks', marks, 'gold')}
    </>
  )
}

/**
 * The Watchtower menu. The only page with no chooser — the rows *are* the
 * choices and the CTA is the one thing you came here to do.
 */
export function MenuScreen({ offers }: { offers: Offer[] }) {
  const primary = offers.find((o) => o.id === 'run')
  const rows = offers.filter((o) => o.id !== 'run')
  const stats = useMetaStore((s) => s.stats)
  // `bestDepth`, `bestRound` and `bestBanner` were tracked every run and shown
  // only in the retired `HubScreen` — so the shipping UI recorded three lifetime
  // records and displayed none of them (M33). They are the reason to play again.
  const hasRecord = stats.bestDepth > 0 || stats.bestRound > 0 || stats.runsCompleted > 0

  return (
    <PageLayout
      title="Fieldwatch"
      subtitle="Hold the meadow against the goblin horde"
      cta={primary?.action ? { label: 'Start a Run', run: primary.action.run } : undefined}
    >
      <div className="pg-art" aria-hidden />
      {hasRecord && (
        <div className="pg-records">
          <Record label="Best depth" value={stats.bestDepth} />
          <Record label="Best round" value={stats.bestRound} />
          <Record label="Best banner" value={stats.bestBanner} />
          <Record label="Runs won" value={`${stats.runsWon}/${stats.runsCompleted}`} />
        </div>
      )}
      <div className="pg-rows">
        {rows.map((o) => (
          <MenuRow
            key={o.id}
            label={o.title}
            value={o.cost ? `✦ ${o.cost.amount}` : o.sub}
            icon={o.icon}
            glyph={o.glyph}
            onClick={() => o.action?.run()}
            tone={o.color === 'var(--bad-text)' ? 'danger' : 'default'}
          />
        ))}
      </div>
    </PageLayout>
  )
}

function Record({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="pg-record">
      <b>{value}</b>
      <span>{label}</span>
    </span>
  )
}

/**
 * The one place run-end copy is written. The shell used to say three different
 * things about the same ending — this screen, `StageBand`'s result card and
 * `DetailBand`'s run-over panel — and two of the three were unreachable. Those
 * are gone; if the wording changes, it changes here.
 */
export function runEndCopy(mode: string, won: boolean, wins: number, depth: number) {
  if (mode === 'endless') {
    return {
      title: 'The Watch Ends',
      blurb: `You held out for ${wins} wave${wins === 1 ? '' : 's'} before the last life fell.`,
    }
  }
  return won
    ? { title: 'The Watch Holds', blurb: 'You reached the end of the line and struck down the Colossus.' }
    : {
        title: 'The Line Breaks',
        blurb: `Your base has fallen after clearing ${depth} node${depth === 1 ? '' : 's'}. Permadeath — this run is over.`,
      }
}

/**
 * Run end — the verdict, the receipt, and two doors (M14 / M15 / M33).
 *
 * The screen used to read four scalars off the live store and show three tiles.
 * Meanwhile `gameStore.buildRecap` was assembling a full `RunRecap` at the exact
 * moment the run ended — per-Sentinel kills, damage, build name, level and
 * whether they went down; the leak count; the run seed that reproduces the whole
 * run; the Banner it flew; the gold left on the table; the Threat it reached;
 * the boss's spoils — and putting it in `state.victory`, where **nothing in the
 * app ever read it**. A death that tells you nothing teaches nothing, so the
 * receipt is what this screen is now.
 *
 * `victory` is null for an Endless run (its end path does not build one), so
 * every recap block is optional and the old scalars stay the fallback.
 */
export function ResultScreen() {
  const runPhase = useGameStore((s) => s.runPhase)
  const mode = useGameStore((s) => s.mode)
  const wins = useGameStore((s) => s.wins)
  const marksEarned = useGameStore((s) => s.marksEarned)
  const clearedNodeIds = useGameStore((s) => s.clearedNodeIds)
  const returnToHub = useGameStore((s) => s.returnToHub)
  const runAgain = useGameStore((s) => s.runAgain)
  const recap = useGameStore((s) => s.victory)
  const baseHp = useGameStore((s) => s.baseHp)
  const maxBaseHp = useGameStore((s) => s.maxBaseHp)
  const assist = useSettingsStore((s) => s.assist)
  const setAssist = useSettingsStore((s) => s.setAssist)
  const won = runPhase === 'won'
  const depth = recap?.depth ?? Math.max(0, clearedNodeIds.length - 1)
  const marks = recap?.marks ?? marksEarned
  const { title, blurb } = runEndCopy(mode, won, wins, depth)
  const campaign = mode === 'campaign'
  const base = Math.round(baseHp)

  return (
    <PageLayout
      title={title}
      subtitle={blurb}
      // A run ending is news, not navigation — it arrives in answer to the last
      // wave rather than being somewhere the player went, and until now the
      // whole screen changed without a word to anyone who could not see it (F9).
      live
      // "One more run" is the loop, so it is the pinned control on a campaign
      // ending — the Watchtower is one row away and is still a real exit, so
      // no context loses its way out.
      cta={campaign ? { label: 'Run again', run: runAgain } : { label: 'Return', run: returnToHub }}
      // The other door, pinned. It used to trail a receipt that is five cards
      // long: measured 116px below the fold at 390x844 and 355px at 360x640,
      // on the one screen whose job is to offer two ways on (F13).
      foot={
        campaign || (!won && assist === 'off') ? (
          <div className="pg-rows">
            {/*
              The assist control itself is PINNED on a loss, and its explanation
              stays in the body above (F11).

              Measured with it in the body: the receipt is five cards long, and
              even after reclaiming the verdict circle the row sat 39px below
              the fold at 390x844 and 83px below at 360x640 — an offer you have
              to go looking for is the thing this finding is about. Pinning the
              row and leaving the card where it reads means the offer is on
              screen the moment the run ends, and the full "here is exactly what
              changes and what does not" is one scroll up in the body rather
              than a mystery. Splitting them is safe in a way it would not be
              for a purchase: this is a settings toggle, instant, free and
              reversible from the same row.
            */}
            {!won && assist === 'off' && (
              /* `⛨` used to be the value here, and the same glyph was the Assist
                 setting's mark, the armour stat, the body-armour item kind AND
                 the base-intact tile below. The armour icon says the one thing
                 this row means — less damage taken — and says it once. */
              <MenuRow label="Turn on Assist · Steady" icon="armour" onClick={() => setAssist('steady')} />
            )}
            {campaign && <MenuRow label="Return to the Watchtower" icon="back" onClick={returnToHub} />}
          </div>
        ) : undefined
      }
      secondary={
        <>
          <Tile caption={`✦ ${marks} earned`} icon="marks" />
          <Tile caption={mode === 'endless' ? `${wins} waves` : `Depth ${depth}`} icon="depth" />
          {/* The real number, not a verdict (F5). "Base intact" was printed for
              any win, so surviving the Colossus on 1 of 20 read exactly like
              finishing untouched — the one statistic that says how close the
              run came, rounded away to a word. `baseHp` is the live final
              value; the mark still reads win/loss at a glance.
              A fallen base takes the WARNING mark rather than the skull: the
              skull is the boss enemy's mark in the wave list, and one picture
              meaning both "a Colossus is coming" and "your keep is gone" is the
              collision this pass exists to remove. */}
          <Tile caption={`Base ${Math.max(0, base)}/${maxBaseHp}`} icon={base > 0 ? 'base' : 'warn'} />
        </>
      }
    >
      {/*
        The verdict circle is a win-only flourish now.
        On a defeat it was the third place the same news was told — the serif
        title already says "The Line Breaks", the blurb spells out the depth,
        and the tile row carries its own ☠ — and it was spending 112px of the
        372px body on saying it a third time. Those 112px are what put the
        assist offer below the fold on the one screen that is supposed to make
        it findable (F11), and reclaiming them costs the screen nothing it was
        not already saying twice.
      */}
      {won && (
        <div className="pg-verdict win">
          {/* Was `❖`, which also meant "shrine" and "evolution ready". The keep
              is what holding the line actually means. */}
          <Icon name="base" lg className="pg-verdict-glyph" />
        </div>
      )}

      {/* Per-Sentinel contribution — computed by the engine every battle and
          thrown away every battle until now. Best damage first, and a downed
          hero is marked, because "who actually held the line" is the one
          question a receipt has to answer. It leads the body for the same
          reason: measured at 390×844 the body shows ~370px, and everything
          under the second card is a scroll away. */}
      {recap && recap.heroes.length > 0 && (
        <div className="pg-recap">
          <div className="pg-recap-head">
            <span>The Watch</span>
            <span>KILLS · DMG</span>
          </div>
          {recap.heroes.map((h) => (
            <div className={`pg-recap-row ${h.downed ? 'downed' : ''}`} key={h.id}>
              <span className="pg-recap-name">
                {h.name}
                <span className="pg-recap-build">
                  {h.build} · L{h.level}
                  {h.downed ? ' · fell' : ''}
                </span>
              </span>
              <span className="pg-recap-num">
                {h.kills} · {h.damage}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* After the receipt, not before it — the screen answers "what happened"
          first, and the offer reads as an option rather than as a verdict on
          the player. Loss only (F11); the control it explains is pinned in the
          foot so it does not have to be scrolled to. */}
      {!won && <AssistCard assist={assist} />}

      <InfoCard
        lines={[
          `✦ ${marks} Watch Marks earned`,
          ...(recap
            ? [
                // `enemiesLeaked`, not `leaks` — the latter is base-HP damage
                // and this line counts enemies (F2).
                `${recap.kills} felled · ${recap.downs} Sentinel${recap.downs === 1 ? '' : 's'} lost · ${recap.enemiesLeaked} reached the line`,
                `⟡ ${recap.goldLeft} unspent · Threat reached ×${recap.threat.toFixed(2)}`,
                bannerLine(recap.banner),
              ]
            : []),
          'Marks buy permanent upgrades in the Watchtower — they carry into every future run.',
        ]}
      />

      {recap && recap.spoils.length > 0 && (
        <InfoCard
          lines={[
            `The Colossus dropped ${recap.spoils.length} thing${recap.spoils.length === 1 ? '' : 's'}`,
            ...recap.spoils.map((i) => `${i.name} — ${RARITY[i.rarity].label}`),
          ]}
        />
      )}

      {/* Winning under Banner N is what earns the ask about N+1 (H16). Say so
          on the screen that ends the run, or the ladder is invisible again. */}
      {recap && recap.nextBanner > recap.banner && (
        <InfoCard
          lines={[
            `Next: ${bannerLine(recap.nextBanner)}`,
            `Pick it on the hero screen of your next run — it pays ×${bannerRules(recap.nextBanner).markMult} Watch Marks.`,
          ]}
        />
      )}

      {recap && <InfoCard lines={[`Run seed ${recap.seed}`, 'The same seed deals the same map, loot and rolls.']} />}

      {!campaign && (
        <div className="pg-rows">
          <MenuRow label="Return to the Watchtower" icon="back" onClick={returnToHub} />
        </div>
      )}
    </PageLayout>
  )
}

/**
 * The assist dial, offered at the one moment it is relevant (F11).
 *
 * The dial has existed since M34 with good copy — and lived only as a row on
 * the Settings page, which is three taps away behind a menu a losing player has
 * no reason to open. Nothing anywhere ever mentioned it. Not after a loss, not
 * on this screen, which knows exactly how the run ended and how far it got.
 * With 76% of fresh runs ending at the first elite, that is the whole
 * accessibility feature sitting behind a door nobody is told about.
 *
 * The framing is the Celeste / Hades one (see
 * `gamedev-general/references/ui-ux-accessibility.md`), and every word of it is
 * a decision:
 *
 * - **No diagnosis.** It does not say the player struggled, or died a lot, or
 *   that this is for people who are finding it hard. It says the option exists.
 * - **No penalty and no asterisk.** Marks, loot and the Banner payout are
 *   untouched, and the copy says so — because the fear that it will quietly
 *   cost something is the main reason people refuse the option they need.
 * - **Exact, not vague.** "40% less damage when something gets through" rather
 *   than "makes the game easier", so taking it is an informed choice.
 * - **Not a modal, not a prompt, not a nag.** It is a card among the other
 *   cards on a screen the player is already reading, and it is gone the moment
 *   the dial is off `off`.
 *
 * It shows on a LOSS only. After a win it would be editorialising about a run
 * the player just succeeded at.
 */
function AssistCard({ assist }: { assist: AssistLevel }) {
  const steady = assistProfile('steady')
  if (assist !== 'off') {
    return (
      <InfoCard
        lines={[
          `Assist is on — ${assistProfile(assist).label}.`,
          assistProfile(assist).blurb,
          'Change it or turn it off whenever you like, in Settings or mid-run.',
        ]}
      />
    )
  }
  return (
    <InfoCard
      lines={[
        'Assist is there if you want it.',
        `${steady.label} — ${steady.blurb.charAt(0).toLowerCase()}${steady.blurb.slice(1)}`,
        'Nothing else moves: same waves, same loot, same Watch Marks, same Banner payout. Change it whenever you like, mid-run included.',
      ]}
    />
  )
}
