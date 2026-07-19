# Loopward — Design Doc

An idle, semi-roguelite tower defense played on a closed loop.

## Core concept

Enemies walk around a ring track forever, lapping it over and over instead of
walking from point A to point B. Towers sit at fixed slots around the ring and
auto-fire at whatever's in range. There are two sources of enemies:

- **Grunts** spawn for free, continuously, on a timer. Your towers are meant
  to comfortably keep up with them alone — this is the "idle" part of the
  game. Even with zero interaction, grunts die to your towers and trickle in
  slow, steady gold.
- **Troops** (Scout, Brute, Signal Booster) are enemies *you* pay gold to
  send into the loop. When your towers kill one, you net more gold than it
  cost to send — that's the core "spend to earn more" engine. Send too many
  at once, though, and you outpace what your towers can kill per second
  (they only ever hit one target per cooldown tick), so some slip through
  uncontested. That fire-rate cap is the entire "distraction" mechanic —
  no separate meter, it just naturally emerges from overcrowding the ring.

Every enemy tracks how many full laps it's completed. Once an enemy exceeds
the leash limit (3 laps by default, upgradeable), it breaks off, hits your
base for its leash-damage value, and disappears. If base HP hits 0, the run
ends.

One troop type, the **Signal Booster**, is a "buffer": while it's alive on
the ring it makes every currently-alive grunt faster and tougher (harder to
kill). It pays out well when killed, but you're feeding the crowd while it
survives — a deliberate risk/reward troop.

## Loop tiers

The ring starts small (4 slots) and gets bigger — more tower slots, longer
laps — once you've earned enough lifetime gold in a run to hit the next
milestone. Expansion is player-invoked (a banner appears; you click it
whenever you're ready), never forced.

| Tier | Radius | Slots | Unlock (lifetime gold this run) |
|---|---|---|---|
| Ring I | 130px | 4 | 0 (start) |
| Ring II | 190px | 6 | 5,000 |
| Ring III | 250px | 8 | 25,000 |
| Ring IV | 320px | 11 | 100,000 |

## Roguelite upgrades (per run)

Every 20 kills, you're offered 3 random cards from a weighted pool — pick
one, it applies for the rest of *that run only*, then resets to a clean
slate on your next run. Cards include damage/fire-rate boosts, more leash
laps, cheaper/more profitable troops, crit chance, multi-target hits, and
unlocking the second tower type (Pulse) for the run.

## Meta progression (cross-run)

Runs end in defeat (base HP hit 0) or a voluntary "Cash Out." Either way,
the run's performance (gold earned, tier reached, time survived) converts
into **Cores** — a currency that persists forever across runs, independent
of any single run's roguelite upgrades. Cores buy permanent upgrades in the
meta-shop: starting gold/HP, extra tower slots, cheaper/more valuable
troops, better offline efficiency, and unlocking additional upgrade cards
into future runs' roguelite pool.

## Idle & offline progress

The game simulates live in a `requestAnimationFrame` loop while open — no
interaction needed for grunts to keep dying and gold to keep trickling in.
When you come back after closing the tab, elapsed real time is compared
against your last save, and you're granted an approximated share of your
idle gold rate for that gap (capped, at a fraction of the live rate — not a
full re-simulation). Enemies on the ring are never persisted across a
reload; a reload always resumes with an empty ring and leans on the offline
formula instead.

## Architecture

Static site, no build step: `index.html` + `style.css` + ES modules under
`js/**`, loaded via `<script type="module" src="js/main.js">`.

```
js/
  main.js                  # boot, RAF loop, wiring
  constants.js              # every tunable number/definition
  state/RunState.js          # current-run data
  state/MetaState.js          # cross-run persistent data
  entities/Enemy.js            # ring position, HP, laps
  entities/Tower.js             # targeting + firing
  systems/LoopManager.js         # ring geometry per tier
  systems/SpawnManager.js         # grunt timer + troop sends
  systems/CombatManager.js         # per-frame update glue
  systems/EconomyManager.js         # gold ledger
  systems/MilestoneManager.js        # tier-unlock checks
  systems/UpgradeManager.js           # roguelite card draw/apply
  systems/MetaProgressionManager.js    # Cores reward + purchases
  systems/OfflineManager.js             # offline formula + autosave
  systems/SaveManager.js                 # localStorage I/O
  systems/InputManager.js                 # canvas pointer -> taps
  renderer/BackgroundRenderer.js           # static ring (redraw on resize/expand)
  renderer/GameRenderer.js                  # per-frame dynamic draw + FX
  ui/UIManager.js                            # HUD, panels, all modals
```

## Save data

Two independent `localStorage` blobs: the current run (`loopward_run_v1`)
and cross-run meta progression (`loopward_meta_v1`). Enemies are never
serialized. Autosave runs every 10s, plus on tab-hide and unload.

## Running it locally

This is a static site with ES modules, so it needs to be served (not opened
via `file://`, which most browsers block for module scripts):

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`.
