import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { useMetaStore } from '../../../state/metaStore'
import { Icon } from '../../Icon'
import { Crest, Lock } from '../../pixel'
import { useMedia } from '../../pointer'
import { EnemyPortrait } from '../EnemyPortrait'
import { useMenuStaged } from '../staging'
import { codexModel, glossaryLines, type CodexEntry, type CodexTab, type CodexTabId } from './codexModel'
import { markCodexSeen, readCodexSeen } from './codexSeen'
import '../../../styles/codex.css'

/**
 * The Codex (October 2026, Figma-free: mockups approved by the designer in
 * chat): a collection screen in the manner of Supercell's — one bar for the
 * whole set, five icon tabs with their counts and a red dot for what is new,
 * and each tab a grid of tiles in sections. A tile's frame is its level's hue
 * (tan, teal, plum, Sovereign cyan); a locked tile is a black silhouette under
 * a padlock. A tap opens the tile's card — a sheet over the grid on a phone,
 * a panel beside it on a desk — with ‹ › through the tab. Feats are a list of
 * medals. The glossary is the "?" in the head.
 *
 * All data is `codexModel` (pure, tested); this file only draws it.
 */
export function CodexScreen({ onBack }: { onBack: () => void }) {
  const achievements = useMetaStore((s) => s.achievements)
  const codex = useMetaStore((s) => s.codex)
  const skills = useMetaStore((s) => s.skills)
  const items = useMetaStore((s) => s.items)
  const sovereign = useMetaStore((s) => s.sovereign)
  const met = useMetaStore((s) => s.met)
  const staged = useMenuStaged()
  const desk = useMedia('(min-width: 900px) and (min-height: 540px)')
  const tabs = useMemo(
    () => codexModel({ achievements, codex, skills, items, sovereign, met, staged }),
    [achievements, codex, skills, items, sovereign, met, staged],
  )
  // A first-timer's Items and Skills wait for the first run: open on the first tab that holds something.
  const [tabId, setTabId] = useState<CodexTabId>(() => tabs.find((t) => !t.locked)?.id ?? 'items')
  const tab = tabs.find((t) => t.id === tabId) ?? tabs[0]
  const entries = useMemo(() => tab.sections.flatMap((s) => s.entries), [tab])
  const [openId, setOpenId] = useState<string | null>(null)
  const [glossary, setGlossary] = useState(false)

  // NEW: unlocked but never opened here. A first visit takes everything already
  // owned as seen, so the badges mean "since you last looked".
  const unlocked = useMemo(() => tabs.flatMap((t) => t.sections.flatMap((s) => s.entries.filter((e) => !e.locked).map((e) => e.id))), [tabs])
  const [seen, setSeen] = useState<Set<string>>(() => readCodexSeen(unlocked))
  const isNew = (e: CodexEntry) => !e.locked && !seen.has(e.id)
  const open = (id: string | null) => {
    setOpenId(id)
    if (id && !seen.has(id)) setSeen(markCodexSeen(seen, id))
  }
  // A desk shows the card beside the grid: the tab's first tile until one is picked.
  const shownId = openId && entries.some((e) => e.id === openId) ? openId : desk ? (entries[0]?.id ?? null) : null
  const shown = entries.find((e) => e.id === shownId) ?? null

  const have = tabs.reduce((n, t) => n + t.have, 0)
  const total = tabs.reduce((n, t) => n + t.total, 0)

  return (
    <div className={`cx${desk ? ' is-desk' : ''}`}>
      <div className="cx-main">
        <header className="cx-head">
          <button type="button" className="cx-iconbtn" onClick={onBack} aria-label="Back to the menu">
            <Icon name="back" />
          </button>
          <h1 className="cx-title" tabIndex={-1}>
            Codex
          </h1>
          <button type="button" className="cx-iconbtn" onClick={() => setGlossary(true)} aria-label="Glossary" aria-haspopup="dialog">
            <Icon name="tips" />
          </button>
        </header>
        <div className="cx-total" role="img" aria-label={`Collected ${have} of ${total}`}>
          <span aria-hidden="true">Collected</span>
          <span className="cx-bar" aria-hidden="true">
            <i style={{ width: `${total ? (have / total) * 100 : 0}%` }} />
          </span>
          <b aria-hidden="true">
            {have}/{total}
          </b>
        </div>
        <Tabs tabs={tabs} on={tab.id} newIn={(t) => t.sections.reduce((n, s) => n + s.entries.filter(isNew).length, 0)} onPick={(id) => (setTabId(id), setOpenId(null))} />
        <div className="cx-body" role="tabpanel" id={`cx-panel-${tab.id}`} aria-labelledby={`cx-tab-${tab.id}`}>
          {tab.locked ? (
            <p className="cx-locked">
              <Lock /> {tab.locked}: every {tab.id === 'items' ? 'item' : 'skill'} your heroes can be dealt, and how to unlock the rest.
            </p>
          ) : tab.feats ? (
            <Feats tab={tab} />
          ) : (
            tab.sections.map((s) => (
              <section key={s.title} className="cx-sec" style={s.hue ? ({ '--sec': s.hue } as CSSProperties) : undefined} aria-label={`${s.title}, ${s.have} of ${s.entries.length}`}>
                <div className="cx-sec-head" aria-hidden="true">
                  <h2>{s.title}</h2>
                  <span className="cx-rule" />
                  <span className="cx-n">
                    {s.have}/{s.entries.length}
                  </span>
                </div>
                <div className="cx-grid">
                  {s.entries.map((e) => (
                    <Tile key={e.id} e={e} isNew={isNew(e)} on={e.id === shownId} onOpen={() => open(e.id)} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
      {desk && !tab.feats && !tab.locked && (
        <aside className="cx-side" aria-label="Detail">
          {shown && <Card e={shown} entries={entries} onStep={open} />}
        </aside>
      )}
      {!desk && shown && (
        <Sheet label={shown.name} onClose={() => setOpenId(null)}>
          <Card e={shown} entries={entries} onStep={open} onClose={() => setOpenId(null)} />
        </Sheet>
      )}
      {glossary && (
        <Sheet label="Glossary" onClose={() => setGlossary(false)}>
          <Glossary staged={staged} met={met} onClose={() => setGlossary(false)} />
        </Sheet>
      )}
    </div>
  )
}

function Tabs({ tabs, on, newIn, onPick }: { tabs: CodexTab[]; on: CodexTabId; newIn: (t: CodexTab) => number; onPick: (id: CodexTabId) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const onKey = (e: KeyboardEvent) => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!d) return
    e.preventDefault()
    const i = tabs.findIndex((t) => t.id === on)
    const next = tabs[(i + d + tabs.length) % tabs.length]
    onPick(next.id)
    ref.current?.querySelector<HTMLButtonElement>(`#cx-tab-${next.id}`)?.focus()
  }
  return (
    <div className="cx-tabs" role="tablist" aria-label="Codex" ref={ref} onKeyDown={onKey}>
      {tabs.map((t) => {
        const n = newIn(t)
        return (
          <button
            key={t.id}
            id={`cx-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={t.id === on}
            aria-controls={`cx-panel-${t.id}`}
            tabIndex={t.id === on ? 0 : -1}
            className={`cx-tab${t.id === on ? ' on' : ''}`}
            aria-label={`${t.label}, ${t.locked ? 'locked' : `${t.have} of ${t.total}`}${n ? `, ${n} new` : ''}`}
            onClick={() => onPick(t.id)}
          >
            {n > 0 && (
              <span className="cx-dot" aria-hidden="true">
                {n}
              </span>
            )}
            <Icon name={t.icon} />
            <span aria-hidden="true">{t.label}</span>
            <small aria-hidden="true">{t.locked ? <Lock scale={1} /> : `${t.have}/${t.total}`}</small>
          </button>
        )
      })}
    </div>
  )
}

function Art({ e }: { e: CodexEntry }) {
  return e.enemy ? <EnemyPortrait art={e.enemy} /> : e.icon ? <Icon name={e.icon} lg /> : null
}

function Tile({ e, isNew, on, onOpen }: { e: CodexEntry; isNew: boolean; on: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      className={`cx-tile${e.locked ? ' locked' : ''}${on ? ' on' : ''}`}
      style={{ '--lv': e.hue } as CSSProperties}
      onClick={onOpen}
      aria-label={e.locked ? `Locked. ${e.chips[0] ?? ''}` : `${e.name}${e.chips[0] ? `, ${e.chips[0]}` : ''}${isNew ? ', new' : ''}`}
      aria-haspopup="dialog"
    >
      {isNew && (
        <span className="cx-new" aria-hidden="true">
          NEW
        </span>
      )}
      <span className="cx-in" aria-hidden="true">
        {!e.locked && <span className="cx-lv">{e.badge}</span>}
        {!e.locked && e.company && (
          <span className="cx-co">
            <Crest company={e.company} scale={1} />
          </span>
        )}
        {e.locked && <Lock scale={1} />}
        <span className="cx-art">
          <Art e={e} />
        </span>
        <span className="cx-name">{e.name}</span>
      </span>
    </button>
  )
}

function Card({ e, entries, onStep, onClose }: { e: CodexEntry; entries: CodexEntry[]; onStep: (id: string) => void; onClose?: () => void }) {
  const i = entries.findIndex((x) => x.id === e.id)
  const step = (d: number) => onStep(entries[(i + d + entries.length) % entries.length].id)
  return (
    <div className={`cx-card${e.locked ? ' locked' : ''}`} style={{ '--lv': e.hue } as CSSProperties}>
      <div className="cx-card-in">
        {onClose && (
          <button type="button" className="cx-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        )}
        <div className="cx-card-art" aria-hidden="true">
          {e.locked && <Lock />}
          <Art e={e} />
        </div>
        <h2 className="cx-card-name">{e.locked ? 'Not yet yours' : e.name}</h2>
        <div className="cx-chips">
          {e.chips.map((c, n) => (
            <span key={c} className={`cx-chip${n === 0 ? ' lv' : ''}`}>
              {c}
            </span>
          ))}
        </div>
        {e.does && <p className="cx-does">{e.does}</p>}
        <p className="cx-how">{e.how}</p>
        {entries.length > 1 && (
          <div className="cx-pager">
            <button type="button" onClick={() => step(-1)} aria-label="Previous">
              ‹
            </button>
            <span>
              {i + 1} / {entries.length}
            </span>
            <button type="button" onClick={() => step(1)} aria-label="Next">
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Feats({ tab }: { tab: CodexTab }) {
  return (
    <section className="cx-sec" aria-label={`Feats, ${tab.have} of ${tab.total}`}>
      <div className="cx-sec-head" aria-hidden="true">
        <h2>Feats</h2>
        <span className="cx-rule" />
        <span className="cx-n">
          {tab.have}/{tab.total}
        </span>
      </div>
      <ul className="cx-feats">
        {tab.feats!.map((f) => (
          <li key={f.id} className={`cx-feat${f.earned ? '' : ' no'}`}>
            <span className="cx-medal" aria-hidden="true">
              <Icon name="crown" lg />
            </span>
            <span className="cx-feat-text">
              <b>{f.name}</b>
              <span>{f.feat}</span>
              {f.opens && <small>Opens: {f.opens}</small>}
            </span>
            <span className="cx-gold">
              {f.gold}g{f.earned && <small>Earned</small>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Glossary({ staged, met, onClose }: { staged: boolean; met: readonly string[]; onClose: () => void }) {
  const g = glossaryLines({ staged, met })
  return (
    <div className="cx-card cx-gloss" style={{ '--lv': 'var(--accent)' } as CSSProperties}>
      <div className="cx-card-in">
        <button type="button" className="cx-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h2 className="cx-card-name">Glossary</h2>
        <dl className="cx-terms">
          {g.lines.map((l) => (
            <div key={l.term}>
              <dt>{l.term}</dt>
              <dd>{l.line}</dd>
            </div>
          ))}
        </dl>
        {g.waiting > 0 && <p className="cx-how">{g.waiting} more to meet on the road.</p>}
      </div>
    </div>
  )
}

/** A modal sheet: Escape or a tap outside closes it, and focus goes in and comes back. */
function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      back?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="cx-scrim" role="dialog" aria-modal="true" aria-label={label} ref={ref} onClick={(e) => e.target === e.currentTarget && onClose()}>
      {children}
    </div>
  )
}
