import { useEffect, useRef } from 'react'
import { useGameStore } from '../../state/gameStore'
import { bannerRules, BANNER_RUNGS, useMetaStore } from '../../state/metaStore'

/**
 * ---------------------------------------------------------------------------
 * The Banner picker — the ascension ladder's only door (H16 / M29).
 * ---------------------------------------------------------------------------
 *
 * `setRunBanner` existed, `BANNER_RUNGS` existed, the payout multiplier was
 * wired through `grantRunRewards`, `runBanner` rode in the snapshot and the map
 * generator read it — and **nothing in the app ever called it**. Every rung a
 * player unlocked in the Watchtower was unreachable, so the whole difficulty
 * ladder was a system you could buy and never use.
 *
 * It lives on hero-pick because that is the only screen the store will accept
 * it on: a Banner is a bet placed before the first node, never a switch flipped
 * mid-run. Choosing one re-deals the map from the *same* run seed (Banner 1
 * deletes merchants, Banner 4 deletes recruiters), so switching back and forth
 * cannot be used to reroll the map, and the choice stays reversible right up
 * until the hero is chosen.
 *
 * Every string below is read off `BANNER_RUNGS` / `bannerRules`, so the copy
 * cannot drift from what the run actually does — the failure this whole pass
 * exists to fix.
 */
export function BannerPicker() {
  const screen = useGameStore((s) => s.screen)
  const mode = useGameStore((s) => s.mode)
  const runBanner = useGameStore((s) => s.runBanner)
  const setRunBanner = useGameStore((s) => s.setRunBanner)
  const unlocked = useMetaStore((s) => s.sacrificeTier)

  /*
   * Bring the flown rung into view.
   *
   * Six chips are 595px of row inside 358px, so the Banner a run arrives
   * already carrying is usually off-screen: "Run again" keeps the Banner you
   * just lost under (M15), and a resumed hero-pick keeps whatever was chosen.
   * Rendering that showed a card reading "Banner 5 · The Long Dark" above a row
   * where nothing looked selected.
   *
   * `scrollLeft` rather than `scrollIntoView`: the latter walks up and scrolls
   * every scrollable ancestor, and the ancestor here is the page body — which
   * would silently scroll the hero chooser off the top on arrival.
   */
  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const row = rowRef.current
    const chip = row?.querySelector<HTMLElement>('.pg-banner-chip.sel')
    if (!row || !chip) return
    const target = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2
    row.scrollLeft = Math.max(0, target)
  }, [runBanner, unlocked])

  // Nothing unlocked means there is no ladder to show yet, and a fresh player's
  // first screen should not carry a control with one dead option on it. The
  // Watchtower's Banner row is where the system is introduced.
  if (screen !== 'heroPick' || mode !== 'campaign' || unlocked < 1) return null

  const rungs = BANNER_RUNGS.slice(0, unlocked)
  const rules = bannerRules(runBanner)
  const flying = rungs.slice(0, runBanner)

  return (
    <section className="pg-banner">
      <div className="pg-banner-head">
        <span className="pg-banner-label">Banner</span>
        {/* "×1 marks" is not a payout, it is the absence of one — say so. */}
        <span className="pg-banner-mult">{runBanner === 0 ? 'standard pay' : `✦ ×${rules.markMult} marks`}</span>
      </div>

      <div className="pg-banner-row" ref={rowRef} role="group" aria-label="Choose the Banner for this run">
        <button
          className={`pg-banner-chip ${runBanner === 0 ? 'sel' : ''}`}
          aria-pressed={runBanner === 0}
          onClick={() => setRunBanner(0)}
        >
          <span className="pg-banner-tier">—</span>
          <span className="pg-banner-name">No Banner</span>
        </button>
        {rungs.map((r) => (
          <button
            key={r.tier}
            className={`pg-banner-chip ${runBanner === r.tier ? 'sel' : ''}`}
            aria-pressed={runBanner === r.tier}
            /* The chip's visible text is a numeral and a two-word name; the rule
               it changes and the payout are what the choice is actually about,
               so they belong in the accessible name too. */
            aria-label={`Banner ${r.tier}, ${r.name}. ${r.rule} Pays ${r.markMult} times Watch Marks.`}
            onClick={() => setRunBanner(r.tier)}
          >
            <span className="pg-banner-tier">{r.tier}</span>
            <span className="pg-banner-name">{r.name}</span>
          </button>
        ))}
      </div>

      <div className="pg-card">
        <p className="pg-card-title">
          {runBanner === 0
            ? 'No Banner — the ordinary march.'
            : `Banner ${runBanner} · ${BANNER_RUNGS[runBanner - 1].name}`}
        </p>
        {runBanner === 0 ? (
          <p className="pg-card-body">
            Every stop on the map, three cards a clear, standard pay. Fly a Banner to give a rule up and be paid more
            for finishing without it.
          </p>
        ) : (
          <>
            {/* Rungs are cumulative — flying 3 flies 1, 2 and 3 — so the panel
                lists every rule in force, not just the top one. */}
            {flying.map((r) => (
              <p className="pg-card-body" key={r.tier}>
                {r.tier}. {r.rule}
              </p>
            ))}
            <p className="pg-card-body accent">
              Pays ×{rules.markMult} Watch Marks, this run only.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
