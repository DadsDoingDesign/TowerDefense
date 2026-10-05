import { useState } from 'react'
import type { Offer } from './offers'
import { SovereignMark } from './charter/SovereignParts'

/**
 * The Collection (the classless rework): Skills | Items, one grid at a time.
 * A real tab list — arrow keys move between tabs, the panel is labelled by
 * its tab — and each tab carries its count, so "how much have I found" reads
 * without opening it.
 */
export function CollectionTabs({ tabs }: { tabs: NonNullable<Offer['tabs']> }) {
  const [open, setOpen] = useState(tabs[0]?.id ?? '')
  const cur = tabs.find((t) => t.id === open) ?? tabs[0]
  if (!cur) return null
  const move = (dir: number) => {
    const i = tabs.findIndex((t) => t.id === cur.id)
    const next = tabs[(i + dir + tabs.length) % tabs.length]
    setOpen(next.id)
    document.getElementById(`pg-tab-${next.id}`)?.focus()
  }
  return (
    <div className="pg-coll">
      <div className="pg-coll-tabs" role="tablist" aria-label="Collection">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`pg-tab-${t.id}`}
            role="tab"
            aria-selected={t.id === cur.id}
            aria-controls={`pg-tabpanel-${t.id}`}
            tabIndex={t.id === cur.id ? 0 : -1}
            className={`pg-coll-tab ${t.id === cur.id ? 'sel' : ''}`}
            onClick={() => setOpen(t.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') move(1)
              else if (e.key === 'ArrowLeft') move(-1)
            }}
          >
            {t.label} <span className="pg-coll-count">{t.count}</span>
          </button>
        ))}
      </div>
      <div id={`pg-tabpanel-${cur.id}`} role="tabpanel" aria-labelledby={`pg-tab-${cur.id}`}>
        <SkillCards cards={cur.cards} />
      </div>
    </div>
  )
}

/**
 * SK1 — the skill library as cards, grouped by level (the Codex). An unlocked
 * card shows its name, who can hold it and its one sentence; a locked one is a
 * silhouette that says only how it opens. Read-only: skills are offered in a
 * run, never picked here.
 */
export function SkillCards({ cards }: { cards: NonNullable<Offer['cards']> }) {
  const groups = [...new Set(cards.map((c) => c.group ?? ''))]
  return (
    <div className="pg-skills">
      {groups.map((g) => {
        const of = cards.filter((c) => (c.group ?? '') === g)
        const open = of.filter((c) => !c.locked).length
        const sov = of.some((c) => c.tier === 'sovereign')
        return (
          <section key={g} className={`pg-skills-group${sov ? ' sov' : ''}`} aria-label={`${g}: ${open} of ${of.length} unlocked`}>
            {g && (
              <p className="pg-skills-head">
                <span className="pg-skills-name">
                  {sov && <SovereignMark />}
                  {g}
                </span>{' '}
                <span>
                  {open}/{of.length}
                </span>
              </p>
            )}
            <ul className="pg-skills-grid">
              {of.map((c) => (
                <li key={c.id} className={`pg-skill ${c.locked ? 'locked' : ''}${c.tier === 'sovereign' ? ' sov' : ''}`}>
                  <span className="pg-skill-top">
                    {c.locked && (
                      <span className="pg-skill-shape" aria-hidden="true">
                        ?
                      </span>
                    )}
                    <b className="pg-skill-name">{c.name}</b>
                    <span className="pg-skill-sub">{c.sub}</span>
                  </span>
                  <span className="pg-skill-text">{c.text}</span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

/**
 * SK1 — the one skill a hero on offer arrives with (the hero pick), as a card
 * of its own under the hero's name: "Skill · Level 1", its name, its sentence.
 * The class says how the hero fights; this is the twist on it, and it has to
 * read at a glance, not as the third line of a stat block.
 */
export function SkillCard({ skill, color, kicker = 'Skill' }: { skill: { name: string; level: string; text: string }; color?: string; kicker?: string }) {
  return (
    <div className="pg-skill pg-skill-one" style={color ? { borderLeftColor: color } : undefined}>
      <span className="pg-skill-top">
        <span className="pg-skill-kicker">{kicker}</span>
        <b className="pg-skill-name">{skill.name}</b>
        <span className="pg-skill-sub">{skill.level}</span>
      </span>
      <span className="pg-skill-text">{skill.text}</span>
    </div>
  )
}
