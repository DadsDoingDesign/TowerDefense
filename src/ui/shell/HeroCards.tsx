import type { CSSProperties } from 'react'
import { Icon } from '../Icon'
import { RARITY } from '../../game/data/items'
import { railStyle, rarityVar } from '../channels'
import type { Offer } from './offers'

/**
 * ---------------------------------------------------------------------------
 * Three heroes, side by side (the classless rework)
 * ---------------------------------------------------------------------------
 *
 * The designer: "its just 3 options with items and skills you have unlocked
 * applied randomly". With no class to name, a hero is read off three things —
 * what its gear makes it DO, the gear itself, and its skill — and the pick is
 * a comparison of three of those. Portraits you tap one at a time hid two of
 * the three heroes at any moment; here every card carries all of it at once:
 *
 *   [look]  Bran             49 DPS · 96 reach   ← numbers: returning players only
 *           Swings a sword up close · holds 2 enemies with its shield
 *   ⚔ Sword · ⛨ Shield · ▣ Mail        ← each KIND, rarity on its own rail
 *   SKILL Quick Hands — Attacks 15% faster.
 *
 * Three compact rows, on a phone and on a desk alike (the page is a ~560px
 * column there too, where three columns broke every line into two words).
 * Each card is ONE button: its accessible name is everything printed on it,
 * so a screen-reader user compares the same facts a sighted one does.
 */
export function HeroCards({ items, selectedId, onSelect }: { items: Offer[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="pg-heroes" role="group" aria-label="Choose one hero">
      {items.map((o) => {
        const h = o.hero!
        const sel = selectedId === o.id
        return (
          <button
            key={o.id}
            className={`pg-hero ${sel ? 'sel' : ''}`}
            style={railStyle(h.color) as CSSProperties}
            aria-pressed={sel}
            onClick={() => onSelect(o.id)}
          >
            <span className="pg-hero-head">
              <img className="pg-hero-art" src={h.art} alt="" />
              <span className="pg-hero-id">
                <span className="pg-hero-top">
                  <b className="pg-hero-name">{o.title}</b>
                  {h.numbers && <span className="pg-hero-nums">{h.numbers}</span>}
                </span>
                <span className="pg-hero-does">{h.does}</span>
              </span>
            </span>
            <span className="pg-hero-gear">
              {h.gear.map((g) => (
                <span key={g.id} className="pg-hero-piece" style={railStyle(rarityVar(g.rarity)) as CSSProperties}>
                  <Icon name={g.icon} />
                  <span className="pg-hero-piece-name">{g.name}</span>
                  {/* The rarity as a word for screen readers and colour-blind
                      players; the rail carries the hue. */}
                  <span className="pg-hero-piece-rar">{RARITY[g.rarity].label}</span>
                </span>
              ))}
            </span>
            {h.skill && (
              <span className="pg-hero-skill">
                <span className="pg-hero-kicker">Skill</span> <b>{h.skill.name}</b> — {h.skill.text}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
