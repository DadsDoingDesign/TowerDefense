import type { Offer } from './offers'

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
        return (
          <section key={g} className="pg-skills-group" aria-label={`${g}: ${open} of ${of.length} unlocked`}>
            {g && (
              <p className="pg-skills-head">
                {g} <span>
                  {open}/{of.length}
                </span>
              </p>
            )}
            <ul className="pg-skills-grid">
              {of.map((c) => (
                <li key={c.id} className={`pg-skill ${c.locked ? 'locked' : ''}`}>
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
