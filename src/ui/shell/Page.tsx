import type { CSSProperties, ReactNode } from 'react'

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
  cta,
}: {
  title: string
  subtitle?: string
  /** Run resources, when the page is one where spending matters. */
  resources?: ReactNode
  children?: ReactNode
  secondary?: ReactNode
  cta?: { label: string; run: () => void; disabled?: boolean }
}) {
  return (
    <div className="pg">
      <div className="pg-band pg-head">
        <h1 className="t-title">{title}</h1>
        {subtitle && <p className="t-sub">{subtitle}</p>}
        {resources && <div className="pg-res">{resources}</div>}
      </div>

      <div className="pg-band pg-body">{children}</div>

      {secondary && <div className="pg-band pg-secondary">{secondary}</div>}

      {cta && (
        <div className="pg-band pg-cta-band">
          <button className="pg-cta" disabled={cta.disabled} onClick={cta.run}>
            {cta.label}
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
}: {
  label: string
  value?: ReactNode
  onClick?: () => void
  tone?: 'default' | 'danger'
  selected?: boolean
}) {
  return (
    <button
      className={`pg-row ${tone === 'danger' ? 'danger' : ''} ${selected ? 'sel' : ''}`}
      onClick={onClick}
      disabled={!onClick}
      aria-pressed={selected}
    >
      <span className="pg-row-label">{label}</span>
      {value != null && <span className="pg-row-val">{value}</span>}
    </button>
  )
}

/** Parchment square with a caption — the trait/perk tile from the design. */
export function Tile({ caption, glyph, art }: { caption: string; glyph?: string; art?: string }) {
  return (
    <div className="pg-tile">
      <div className="pg-tile-art">
        {art ? <img src={art} alt="" /> : glyph ? <span className="pg-tile-glyph">{glyph}</span> : null}
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
export function InfoCard({ lines }: { lines: string[] }) {
  const [lead, ...rest] = lines.filter(Boolean)
  if (!lead) return null
  return (
    <div className="pg-card">
      <p className="pg-card-title">{lead}</p>
      {rest.map((l, i) => (
        <p className="pg-card-body" key={i}>
          {l}
        </p>
      ))}
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
  items: { id: string; art?: string; glyph?: string; color: string }[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="pg-portraits">
      {items.map((it) => (
        <button
          key={it.id}
          className={`pg-portrait ${selectedId === it.id ? 'sel' : ''}`}
          style={{ '--rail': it.color } as CSSProperties}
          onClick={() => onSelect(it.id)}
          aria-pressed={selectedId === it.id}
        >
          {it.art ? <img src={it.art} alt="" /> : <span className="pg-portrait-glyph">{it.glyph}</span>}
        </button>
      ))}
    </div>
  )
}
