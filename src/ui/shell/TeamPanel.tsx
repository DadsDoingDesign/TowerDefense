import type { CSSProperties } from 'react'
import { FOCUS_OPTS, focusFull, itemName, rarityTextVar, rarityVar } from '../channels'
import { describeMods } from '../../game/data/describe'
import { HERO_SLOTS } from '../../game/data/items'
import { relicById, relicMark } from '../../game/data/relics'
import { useState } from 'react'
import { RarityTag } from './Page'
import { mergeMods } from '../../game/data/archetypeTree'
import { useGameStore } from '../../state/gameStore'
import { Icon } from '../Icon'
import { RELIC_NOTE } from './relicOffers'
import { EffectLine } from './EffectLine'

/**
 * The team, from the HUD (the battle band, Oct 2026; the designer: "the team
 * wide control shouldn't even be on characters it should be on the hud
 * somewhere").
 *
 * Everything here applies to every hero at once, which is why it is not on a
 * hero's card any more (the old hero panel's "Team" tab drew the targeting
 * order under one hero's name, and read as that hero's setting — M20):
 *
 *  - **Targeting** — the one order the whole team follows (`tactics.focus`,
 *    read by the engine for every hero; a change mid-wave reaches the fight).
 *  - **Relics** — what the run has taken, each with its effect "to team".
 *  - **Keepsakes** — a worn keepsake buffs the whole roster, so it is named
 *    here too, with who carries it.
 *  - **Older bonuses** — a save from before relics still applies its team
 *    stat cards (`runMods`); they are listed so nothing applies unseen.
 *
 * Opened by the header's Team button (`HeaderBand`), it fills the Context
 * panel as any selection does (rule one), and takes the band's width — the
 * gear and the pack are one hero's.
 */
export function TeamPanel() {
  const tactics = useGameStore((s) => s.tactics)
  const setTactics = useGameStore((s) => s.setTactics)
  const relics = useGameStore((s) => s.relics)
  const roster = useGameStore((s) => s.roster)
  const runMods = useGameStore((s) => s.runMods)
  const shellSelect = useGameStore((s) => s.shellSelect)
  const held = relics.map((id) => relicById(id)).filter((r) => !!r)
  const [open, setOpen] = useState<string | null>(null)
  const shown = held.find((r) => r!.id === open) ?? null
  const keepsakes = roster.flatMap((h) =>
    HERO_SLOTS.map((slot) => h.equipment[slot])
      .filter((i) => !!i?.keepsake)
      .map((i) => ({ item: i!, on: h.name })),
  )
  const older = runMods.length ? describeMods(mergeMods(runMods)) : []

  return (
    <div className="sh-context sh-team" role="group" aria-labelledby="sh-team-head">
      <div className="sh-context-head">
        <strong id="sh-team-head">Team</strong>
        <span className="sh-context-sub">
          {roster.length} hero{roster.length === 1 ? '' : 'es'}
        </span>
      </div>
      <div className="sh-context-body">
        <div className="sh-team-sec">
          <p className="sh-team-k">
            <span className="field-k">Targeting</span>
            <span className="field-v">{focusFull(tactics.focus)}</span>
          </p>
          <div className="sh-seg" role="group" aria-label="Targeting, for every hero">
            {FOCUS_OPTS.map((f) => (
              <button
                key={f.id}
                className={`sh-seg-btn ${tactics.focus === f.id ? 'active' : ''}`}
                data-sfx="toggle"
                aria-pressed={tactics.focus === f.id}
                aria-label={`${focusFull(f.id)} — every hero`}
                onClick={() => setTactics({ focus: f.id })}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="sh-team-sec">
          <p className="sh-team-k">
            <span className="field-k">Relics</span>
            <span className="field-v">{held.length || 'None yet'}</span>
          </p>
          {/* The run's relics as a collection (Oct 2026; the designer: "like an
              item collection similar to codex but in theme for the run, info on
              click to save space"): a tile each — its own mark on its rarity —
              and the tapped one's card under the grid. */}
          {held.length > 0 && (
            <div className="sh-relics" role="group" aria-label="Relics this run">
              {held.map((r) => (
                <button
                  key={r!.id}
                  type="button"
                  className={`sh-relic${open === r!.id ? ' on' : ''}`}
                  style={{ '--lv': rarityVar(r!.rarity) } as CSSProperties}
                  aria-pressed={open === r!.id}
                  aria-label={`${r!.name}: ${r!.desc}${r!.downside ? `; downside ${r!.downside}` : ''}`}
                  data-sfx="toggle"
                  onClick={() => setOpen(open === r!.id ? null : r!.id)}
                >
                  <Icon name={relicMark(r!.id)} lg />
                </button>
              ))}
            </div>
          )}
          {shown && (
            <div className="sh-relic-card" aria-live="polite">
              <p className="sh-relic-name">
                <b style={{ color: rarityTextVar(shown.rarity) }}>{shown.name}</b> <RarityTag rarity={shown.rarity} />
              </p>
              {/* A pact's cost on its own warning line, as on its spoils card. */}
              {shown.downside && (
                <p className="sh-line bad">
                  <Icon name="warn" /> Downside — {shown.downside}
                </p>
              )}
              <p className="sh-line">{shown.desc}</p>
              <p className="sh-line note">{RELIC_NOTE}</p>
            </div>
          )}
        </div>
        {keepsakes.length > 0 && (
          <div className="sh-team-sec">
            <p className="sh-team-k">
              <span className="field-k">Keepsakes</span>
              <span className="field-v">{keepsakes.length}</span>
            </p>
            {keepsakes.map(({ item, on }) => (
              <p className="sh-line sh-team-relic" key={item.id}>
                <Icon name="keepsake" />
                <span>
                  <b style={{ color: rarityTextVar(item.rarity) }}>{itemName(item)}</b> · on {on}, to team
                </span>
              </p>
            ))}
          </div>
        )}
        {older.length > 0 && (
          <div className="sh-team-sec">
            <p className="sh-team-k">
              <span className="field-k">Older bonuses</span>
            </p>
            {older.map((l) => (
              <EffectLine text={l} bullet key={l} />
            ))}
          </div>
        )}
      </div>
      <div className="sh-context-foot">
        <button className="sh-btn" data-sfx="toggle" onClick={() => shellSelect(null)}>
          Done
        </button>
      </div>
    </div>
  )
}
