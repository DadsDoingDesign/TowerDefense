import type { CSSProperties, ReactNode } from 'react'
import { Icon } from '../Icon'
import { effectIcon, markLabel, type IconKey } from '../channels'
import { lineMark, lineText, type Body } from './offers'

/**
 * The page skeleton from the Figma mobile system: a serif title block, a body
 * that takes the slack, an optional secondary row, and a pinned call to action.
 * Every band is 32px of vertical padding inside a 16px gutter.
 *
 * Battle and the run map keep the four-band shell instead — they are the two
 * places where the Stage must stay uncovered and the pack must stay on screen.
 */
export function PageLayout({
  title,
  subtitle,
  resources,
  children,
  secondary,
  notice,
  confirm,
  cta,
  live,
  foot,
}: {
  title: string
  subtitle?: string
  /** Run resources, when the page is one where spending matters. */
  resources?: ReactNode
  children?: ReactNode
  secondary?: ReactNode
  /** A live warning that sits above the CTA — the armed confirm. */
  notice?: string
  /**
   * The armed confirm's own control — a *different* element from the CTA that
   * armed it, which is what makes an accidental double-activation structurally
   * unable to confirm. See `useArmedAction`. It appears above the notice zone
   * and takes its room from the body, so the pinned CTA does not move.
   */
  confirm?: {
    label: string
    run: (e?: { detail?: number }) => void
    onKeyDown?: (e: { repeat: boolean; preventDefault: () => void }) => void
    onPointerDown?: () => void
  }
  /**
   * `run` is handed the click that asked for it. Armed, this is the way back
   * out rather than the deed — the deed is on `confirm`.
   */
  cta?: { label: string; run: (e?: { detail?: number }) => void; disabled?: boolean; danger?: boolean }
  /**
   * Announce this page's title block when it appears (F9).
   *
   * Set only where the page is an OUTCOME rather than a place you navigated
   * to — the Crossroads reveal ("Mutated · Marek fights differently from here
   * on") and the run-end verdict. Both arrive in answer to something the player
   * just did, both replace the whole screen, and neither said a word to a
   * screen reader: the title changed silently and the CTA under a finger became
   * a different CTA.
   *
   * Deliberately not set on the boards you walk into (merchant, shrine, hero
   * pick): those are navigation, the user moved there on purpose, and a live
   * region on every one of them would announce a page the user is already
   * reading. It is also why this lives on the head block and not on the body —
   * the body changes on every card tap, and that is a selection, not news.
   */
  live?: boolean
  /**
   * Pinned exits, drawn between the secondary row and the pinned CTA — the
   * "leave / go back / return" rows that used to ride at the end of the
   * scrolling body. See the note at the render site.
   */
  foot?: ReactNode
}) {
  return (
    <div className="pg">
      <div className="pg-band pg-head" {...(live ? { role: 'status', 'aria-live': 'polite' as const } : {})}>
        <h1 className="t-title">{title}</h1>
        {subtitle && <p className="t-sub">{subtitle}</p>}
        {resources && <div className="pg-res">{resources}</div>}
      </div>

      <div className="pg-band pg-body">{children}</div>

      {secondary && <div className="pg-band pg-secondary">{secondary}</div>}

      {/*
        The ways OUT, pinned rather than parked at the end of the body (F13/F14).
        The body scrolls, so nothing here was ever unreachable — but "reachable
        by scrolling a receipt" is not the same as "on screen", and measured,
        every one of these sat below the fold on the screen where it mattered:
        run-end's `Return to the Watchtower` 116px under at 390x844 and 355px
        under at 360x640, and the Crossroads' `Pick someone else` — the only
        control that un-commits a permanent Mythic — 63px under at 360x640 Large.
        Both are the second half of a two-action footer the mobile system
        already specifies (`Mobile / Action Footer · Dual`).
        It sits ABOVE the notice and confirm bands in source and in `order`, so
        arming a destructive action still moves nothing under a finger already
        coming down — the property `rev-shift` exists to protect.
      */}
      {foot && <div className="pg-band pg-foot">{foot}</div>}

      {notice && (
        <div className="pg-notice" role="alert">
          <Icon name="warn" className="pg-notice-glyph" />
          <span>{notice}</span>
        </div>
      )}

      {/*
        Source order here is CTA-then-confirm; `order` in page.css paints them
        the other way round, so the picture is unchanged and the keyboard path
        is fixed. The confirm control used to come FIRST in the DOM, which put
        it before the CTA in the tab ring: a keyboard user who armed the action
        had to Shift+Tab *backwards* to reach the thing they had just asked for.
        Tabbing forward from "Never mind" now lands on it.

        Everything `useArmedAction` guarantees is untouched — this is still a
        different element from the one that armed it, so no repetition of one
        control's own activation can confirm.
      */}
      {cta && (
        <div className="pg-band pg-cta-band">
          <button className={`pg-cta ${cta.danger ? 'danger' : ''}`} disabled={cta.disabled} onClick={cta.run}>
            {cta.label}
          </button>
        </div>
      )}

      {confirm && (
        <div className="pg-confirm-band">
          <button
            className="pg-confirm"
            onClick={confirm.run}
            onKeyDown={confirm.onKeyDown}
            onPointerDown={confirm.onPointerDown}
          >
            {confirm.label}
          </button>
        </div>
      )}
    </div>
  )
}

/** A full-width tappable row: label left, value or icon right. */
export function MenuRow({
  label,
  value,
  onClick,
  tone,
  selected,
  disabled,
  currency,
  rail,
  icon,
  mark,
  glyph,
}: {
  label: string
  value?: ReactNode
  onClick?: () => void
  tone?: 'default' | 'danger'
  selected?: boolean
  /** Set when the row is a purchase you cannot afford — it greys, not hides. */
  disabled?: boolean
  /** Tints the value to match its purse chip, so two currencies never blur. */
  currency?: 'gold' | 'dust' | 'marks'
  /**
   * The offer's own accent, drawn as a 3px left edge — the same rail the
   * portrait chooser and the pack tiles use. Row choosers carried no rarity
   * signal at all, so a Legendary spoils card and a Common one were the same
   * grey bar; the rarity word rides in the row's value as well, so this is a
   * second channel rather than the only one (M27c).
   */
  rail?: string
  /**
   * What this row IS — the item's shape, the room's sign, the setting's mark.
   *
   * P3: this component took no icon at all, so every `Offer` that carried one
   * had it silently dropped at the render site. The merchant board and the
   * Spoils screen — the emotional peak of a run — were lists of plain text
   * rows, and the ONE thing a player needs off a merchant board at a glance
   * ("is that a sword or a robe?") was in the name and nowhere else.
   */
  icon?: IconKey
  /**
   * A second mark beside the first — physical vs magic on a weapon. The
   * property that decides whether a drop is worth anything to your roster had
   * no visual channel anywhere before this.
   */
  mark?: IconKey | null
  /**
   * The fallback for the concepts with no atlas cell — `♪`, `∞`, `◐`, `◔`, `⤢`,
   * `❓`. Without it a settings list showed pictures on three rows out of nine
   * and read as half-broken, which is worse than either extreme.
   */
  glyph?: string
}) {
  return (
    <button
      className={`pg-row ${tone === 'danger' ? 'danger' : ''} ${selected ? 'sel' : ''} ${rail ? 'railed' : ''}`}
      style={rail ? ({ '--rail': rail } as CSSProperties) : undefined}
      onClick={onClick}
      disabled={!onClick || disabled}
      aria-pressed={selected}
    >
      {(icon || glyph) && (
        <span className="pg-row-icon">
          {icon ? <Icon name={icon} lg /> : <span className="pg-row-glyph">{glyph}</span>}
          {/*
           * The one place an icon is allowed to speak (M11).
           *
           * A row's accessible name is its text content, and the mark was not in
           * it: a merchant row announced "Rare Wand of Insight, 85 gold" and the
           * single property that decides whether it is worth buying to THIS
           * roster was a 16px sprite and nothing else. `Icon` is `aria-hidden`
           * on the rule that the meaning is always already in text nearby, so
           * the honest repair where that is false is to make the mark itself
           * the text — `role="img"` with a name, which folds into the button's
           * accessible name where a plain `aria-hidden` span could not.
           *
           * Not a visually-hidden text node: a 1x1 box with its content clipped
           * is indistinguishable, to a layout audit, from a real control whose
           * label has been cut off, and ws9-fit flagged ten of them across the
           * matrix. A rule that shouts on genuine clipping is worth more than a
           * convenience utility.
           */}
          {mark &&
            (markLabel(mark) ? (
              <span className="pg-row-mark-wrap" role="img" aria-label={markLabel(mark)}>
                <Icon name={mark} className="pg-row-mark" />
              </span>
            ) : (
              <Icon name={mark} className="pg-row-mark" />
            ))}
        </span>
      )}
      <span className="pg-row-label">{label}</span>
      {value != null && <span className={`pg-row-val ${currency ?? ''}`}>{value}</span>}
    </button>
  )
}

/**
 * Parchment square with a caption — the trait/perk tile from the design.
 *
 * P3: the `art` slot has existed since the shell landed and was passed from
 * exactly nowhere, so every tile in the game fell through to the glyph branch.
 * `icon` is the third and now the usual source; `art` stays for a real sprite
 * (a hero portrait) and `glyph` for the handful of marks with no cell.
 */
export function Tile({
  caption,
  glyph,
  art,
  icon,
}: {
  caption: string
  glyph?: string
  art?: string
  icon?: IconKey
}) {
  return (
    <div className="pg-tile">
      <div className="pg-tile-art">
        {icon ? (
          <Icon name={icon} lg />
        ) : art ? (
          <img src={art} alt="" />
        ) : glyph ? (
          <span className="pg-tile-glyph">{glyph}</span>
        ) : null}
      </div>
      <span className="pg-tile-cap">{caption}</span>
    </div>
  )
}

/** The bold-value / muted-label stat pair, e.g. "12 DEX". */
export function StatRow({ stats }: { stats: { label: string; value: number | string }[] }) {
  return (
    <div className="pg-stats">
      {stats.map((s) => (
        <span className="pg-stat" key={s.label}>
          <b>{s.value}</b>
          <span>{s.label}</span>
        </span>
      ))}
    </div>
  )
}

/**
 * The parchment card. The first line leads in text colour and the rest follow
 * muted — which suits a hero's headline-plus-blurb and an item's stat list
 * equally, so offers of every kind can share it.
 */
export function InfoCard({
  lines,
  warn,
  icons,
}: {
  lines: Body
  warn?: string
  /**
   * Classify each body line and draw its mark (P3).
   *
   * OPT-IN, and deliberately so. `effectIcon` matches phrases, and most offer
   * bodies are a mix of generated effect lines and authored prose — "Threat is
   * the HP multiplier on every enemy in every wave that follows" contains "HP"
   * and would take a heart. So this is set only where the body is known to be
   * `describeBase` / `describeEnchant` / `describeMods` output end to end: the
   * merchant's stock, the Forge's stock, an item reward card. Everywhere else
   * the card renders exactly as it did, because a wrong picture is worse than
   * no picture.
   */
  icons?: boolean
}) {
  /*
   * In icon mode there is no lead line. The lead treatment exists because a
   * hero card is a headline plus a blurb — but an item's body is a stat LIST,
   * every entry of the same kind, and promoting "+9 Physical Damage" to a bold
   * title while the four lines under it stay muted says the first stat matters
   * most. It also skipped the icon, since only `rest` is classified.
   */
  const all = lines.filter(Boolean)
  const lead = icons || all.length === 0 ? undefined : lineText(all[0])
  const rest = icons ? all : all.slice(1)
  if (!lead && rest.length === 0 && !warn) return null
  return (
    <div className="pg-card">
      {lead && <p className="pg-card-title">{lead}</p>}
      {/* The cost, immediately under the benefit and before the detail — a
          tradeoff card read in the other order is a card whose downside is
          discovered after the tap. */}
      {warn && (
        <p className="pg-card-warn">
          <Icon name="warn" /> {warn}
        </p>
      )}
      {rest.map((l, i) => {
        // The producer's own mark outranks the classifier's guess (M4). This is
        // the LIVE path for the merchant board, the Forge and the reward card —
        // all three are `layout: 'page'` contexts — so it is the site where all
        // four curses were advertising with a plain upside icon while the item
        // panel, which almost nobody reaches first, had the override.
        const mark = icons ? (lineMark(l) ?? effectIcon(lineText(l))) : null
        return (
          <p className={`pg-card-body ${mark ? 'iconed' : ''}`} key={i}>
            {mark && <Icon name={mark} />}
            {lineText(l)}
          </p>
        )
      })}
    </div>
  )
}

/**
 * The chooser row. The selected entry grows to 120px and takes a 3px rail in
 * its own colour — how the design signals the active pick.
 */
export function PortraitRow({
  items,
  selectedId,
  onSelect,
}: {
  items: {
    id: string
    label: string
    art?: string
    glyph?: string
    color: string
    /**
     * A corner mark saying what KIND of choice this portrait is, when a single
     * chooser mixes kinds. The Crossroads is the case: a recruit and one of
     * your own heroes are both an archetype sprite in an archetype-coloured
     * frame, so "take a stranger" and "permanently change one of my own" were
     * the same picture — and the rail cannot carry it, because the rail is
     * already saying which archetype it is.
     */
    badge?: IconKey
  }[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="pg-portraits" role="group" aria-label="Choose one">
      {items.map((it) => (
        <button
          key={it.id}
          className={`pg-portrait ${selectedId === it.id ? 'sel' : ''}`}
          style={{ '--rail': it.color } as CSSProperties}
          onClick={() => onSelect(it.id)}
          aria-pressed={selectedId === it.id}
          /*
           * M27d. These are the chooser on hero pick, on the merchant's
           * recruit, on the Crossroads — and every one of them was a `<button>`
           * whose only child was an `<img alt="">`, i.e. a control with NO
           * accessible name at all. Three of the four controls on the first
           * screen of a new run announced themselves as "button".
           */
          aria-label={it.label}
        >
          {it.art ? <img src={it.art} alt="" /> : <span className="pg-portrait-glyph">{it.glyph}</span>}
          {/* `aria-hidden`: the kind is already the second half of `it.label`
              ("Wren — Recruit · Fighter" / "Marek — Mutate"), so this is the
              visual half of a signal the screen reader already has. */}
          {it.badge && (
            <span className="pg-portrait-badge" aria-hidden>
              <Icon name={it.badge} />
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
