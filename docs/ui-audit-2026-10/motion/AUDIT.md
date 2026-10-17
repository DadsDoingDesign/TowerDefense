# Motion audit — every motion, judged per company world (Oct 2026)

The designer: "Consider an audit of the motion design and animations throughout. Is the
effects on home too much or ok etc and do it for each company."

Measured in the running app (dev server, headless Chromium, 390 × 844 phone) with
`scripts/motion-audit.mjs`. Re-run it with:

```
npx vite --port 5227 --strictPort &
node scripts/motion-audit.mjs <scratch dir> home,pages,battle,battleui,fps
```

## How it is measured

- **Frame sequences in slow motion.** The CSS clock is slowed through CDP
  (`Animation.setPlaybackRate`), and every JS clock the page reads (`performance.now`,
  `requestAnimationFrame`, `Date.now`, the timers) is patched to run at the same ×0.25. So a
  true 24 fps sequence of the real motion is captured frame by frame: 3 s of ambient, 1.25 s
  of a switch-in, 1 s of a press, 2–3 s of a page or a wave.
  - Round 1's numbers were thrown away. Headless frame timestamps lag the wall clock while
    screenshots are taken, so loops keyed to them ran at a quarter speed. The script now
    hands each frame the patched clock.
- **Motion energy.** A pixel "changes" when any channel moves by 24 or more between
  frames. **Hz** is the number of changes per pixel per second in a region. For example,
  0.5 Hz means each pixel there changes every two seconds.
  - **Heatmap:** a dimmed greyscale of the first frame, with the change rate over it on a
    log scale from 0.1 to 12 Hz. Cool colours are rare change; white is constant change.
- **Regions.**
  - *screen*: the whole view.
  - *words*: every text line box.
  - *card*, *CTA*, *dock*, *bar*.
  - *road*: a 10 px band round the focused road's line.
  - *signs*: the signposts.
  - *edge*: the battlefield's 26 px margin.
  - *stage*: the battle canvas.
- **Cost.** CDP `Emulation.setCPUThrottlingRate` 4× (a low-end phone), 5 s of rAF frames.
  It records the frame rate, frames over 50 ms, the 95th-percentile frame, and the worlds'
  loop's own time per frame (its `tick`, wrapped).
- **Baselines.**
  - The house look is the motion every world sits on: the map's caravans along every road,
    and a few lantern motes.
  - Its road band (0.9–1.1 Hz on every focus) is the focused road's own traffic.

Scores, per motion:

- **job:** 0–2. Does it do its one job: feedback, a state change, the one thing to look
  at, or atmosphere?
- **in the way:** none / minor / major.
- **amount:** too much / right / too little.

Numbers are **before → after** this pass.

## Verdict per world on the home

| | Peppercorn (fire) | Ironvein (forge) | Easel House (paint) | Rosethread (silk) | Moonquill (night) | house look |
|---|---|---|---|---|---|---|
| ambient, screen Hz | **0.87 → 0.29** | 0.39 → 0.28 | 0.16 → 0.12 | 0.18 → 0.18 | 0.12 → 0.08 | 0.06 |
| focused road band Hz | **2.62 → 1.57** | 1.35 → 1.41 | 0.91 → 0.85 | 1.14 → 1.13 | 1.12 → 1.09 | (all roads) |
| the dock Hz | 0.16 → 0.13 | 0.11 → 0.004 | 0.001 | 0.005 | 0.012 → 0.002 | 0 |
| card (live frame) Hz | 0.26 → 0.22 | 0.13 | 0.012 → 0.025 | 0.08 | 0.04 | 0 |
| CTA (frame + strip) Hz | 0.37 → 0.35 | 0.29 | 0.009 → 0.019 | 0.13 | 0.08 | 0 |
| words, ambient Hz | 0 | 0 | 0 | 0 | 0 | 0 |
| switch-in, screen Hz | **2.75 → 1.39** | **2.40 → 0.65** | 1.64 → 1.45 | 0.57 → 0.54 | 0.97 → 0.72 | 0.47 |
| switch-in, card Hz | **3.11 → 0.86** | **1.95 → 0.61** | 0.85 → 0.69 | 0.60 → 0.62 | 1.13 → 0.75 | 0.61 |
| press, CTA Hz | 2.16 → 2.25 | 2.62 → 2.49 | 0.41 → 0.53 | 0.53 → 0.48 | 1.15 → 1.19 | 0.05 |
| verdict before | **too much** | a touch much (crawling glow) | right on the map, janky washes | right | right, beam flicker | right |
| verdict after | **right** (still the richest) | right | right on the map; **a little little** on the card and CTA | right | right (the calmest) | right |

- **Peppercorn: too much before.** It had 7× Moonquill's motion and 2.3× the next world's.
  - Its focused road was the busiest band on any home, at 2.6 Hz against 0.9–1.4: the
    embers set beside the road (the latest change) crowded it.
  - The heat glow along the dock was crawling. Its dither stepped sideways six times a
    second, so every pixel of a band the width of the screen changed all the time. It was
    the hottest region on the heatmap (`home-ambient-before-after.png`, first column).
  - Light did nothing for it before: 0.20 against 0.87, because the crawl was in the glow.
  - **After:** 0.29 Hz, level with the forge. Fire is still the richest world, and the right
    kind: the burning horizon, the embers, and the flames up the CTA on a press.
- **Ironvein: a touch much.**
  - Its glow crawled the same way, along the anvils and the dock (0.11 Hz on the dock).
    It holds still now, and the spark fountains are the motion.
  - Its switch-in flashed the **whole screen**, panels and all, white at 30% on every
    focus (2.40 Hz). Now the flash is a dithered burst round the anvil, and the ring and
    sparks go out from it (0.65 Hz).
- **Easel House: right on the map, but janky.**
  - Its three watercolour washes flashed as whole discs, about 70 px across, each time
    they drifted a pixel. The checker was tied to the disc's centre. It is anchored to the
    screen now, so a drift moves only the rim.
  - Its card and CTA barely move: 1–2 hundredths of a Hz, against the others' 0.1–0.35.
    The frame's glint now travels sooner (1200 ms, from 1800) and the strip has four flecks
    (1000 ms, from 1600). They are still the quietest panels: see *left alone*.
- **Rosethread: right.**
  - Petals and two ribbons. The ribbons' wave is a third slower now, and the ribbon is
    still the one wide moving shape on any home.
  - It passes behind the city labels, which keep their plates.
- **Moonquill: right, and the calmest.**
  - Its moonbeam flickered as a whole, twice a second (`floor(t*2)&1`). Now it is still,
    with a slow brighter ripple running down it.
  - Stars twinkle, runes drift, quill strokes write themselves.
  - Raising the quill share measured no difference (0.07 Hz), so it was not kept.
- **House look: right.** It is the map's own traffic and a few motes, and it is the
  baseline for the rest.

Benchmarks:

- **Clash Royale / Supercell menus:** the arena behind the menu moves slowly, and the
  buttons and chests carry the punch on a tap. That is our split now:
  - the ambient stays at 0.07–0.29 Hz and off every word;
  - the press is at 0.5–2.5 Hz on the CTA;
  - the switch-in plays once, over the map only.
- **Hades:** the hub's ambience is embers and dust at the edges, never over the dialogue.
  Our particles are cleared under every word and every panel.
- **Slay the Spire:** the map screen's motion is the one pulsing next node. The run map's
  `node-pulse` matches it.
- **Kingdom Rush:** the battlefield's decoration is still or slow, and the lane is the
  motion. Our battle heatmaps show the same thing (`battle-worlds-after.png`): the lane is
  white, and the margins are faint.

Shots: `home-ambient-before-after.png`, `home-switch-before-after.png`,
`home-press-after.png`, `home-modes-after.png`.

## The home, motion by motion

| motion | job | duration / loop / easing | Peppercorn | Ironvein | Easel House | Rosethread | Moonquill | house | job · in the way · amount |
|---|---|---|---|---|---|---|---|---|---|
| ambient particles | atmosphere | drawn at 24 fps (12 on Light), lives 2–40 s | embers 60 → 40, shorter-lived | sparks from 3 anvils, ash | flecks, splats that drip | petals | stars, runes, quill | motes | 2 · none (0 Hz on words, every world) · right after |
| backdrop | atmosphere | redrawn at 12 fps (6 on Light) | flame line ✓, heat glow **crawl → breathe** | glow **crawl → breathe**, anvils | washes **anchored** | 2 ribbons, slower | moon, beam **still + ripple** | — | was 1 · minor (dock) → 2 · none |
| live frame (card, pick card, CTA `::after`) | the panels you act on belong to the world | `steps(1)`, 3 frames: 750 ms (was 600) · 1500 · 1200 (was 1800) · 1800 + sheen 4.2 s · 2400 | 0.22 Hz | 0.13 | 0.03 | 0.08 | 0.05 | none | 2 · none · Easel a little little |
| CTA strip | the primary wears the world | `steps(4)`: 480 · 560 · 1000 (was 1600) · 1200 · 1500 ms | flames | sparks | 4 flecks (was 2) | ribbon | runes | none | 2 · none · right |
| Peppercorn crest | the card is on fire | `steps(4)` 680 ms (was 520) | over the card's top edge, under the dock's words | — | — | — | — | — | 2 · none · right |
| press burst | feedback on the one CTA | 0.5–1.6 s, zoned to the CTA (`burstClip`) and cleared under its label | flames up the face, embers off the ends | molten seams, spark arcs | inked splat, drips | stitch, petals | sparkle rings, runes | gold drops | 2 · none (0 Hz on words) · right |
| switch-in | state change: you are in this world now | sweep 0.6–0.9 s, particles to 1.3 s, tokens ease 420 ms | wall of flame | strike: **full-screen flash → round the anvil** | brush wipe | ribbon sweep | moonlit sheet | none | was 2 · **major** (crossed the card and dock while its words changed) → 2 · none (cleared under every panel and word) |
| map re-light on focus | state change: which road | 220 ms cross-fade, brighten 600 ms | same in every world | | | | | | 2 · none · right |
| caravans (traffic) | atmosphere: the roads are alive | 30 fps, along every road | 0.9–1.1 Hz on the focused road in every world | | | | | | 2 · none · right |
| signposts, city labels | state (focus) | opacity 0.2 s on focus | 0.01–0.26 Hz ambient (a petal or ember passing behind) | | | | | | 2 · none · right |
| season panel, dock | — | still (a slot's outline is paint, not a box) | 0 Hz on the dock's words | | | | | | — · none · right |

`home-stability.mjs` passes on all 16 cases after the changes: a pick changes pixels, never
boxes.

## Pages

Energy is in Hz for the whole screen; the CTA column is the CTA's own.

| page | Peppercorn | Ironvein | Easel House | Rosethread | Moonquill | house | notes |
|---|---|---|---|---|---|---|---|
| terms | 0.16 → 0.06 (CTA 0.30 → 0.29) | 0.04 → 0.03 (CTA 0.21) | 0.02 → 0.01 (CTA 0.01) | 0.04 (CTA 0.10) | 0.01 (CTA 0.09) | — | the floor glow was crawling along the foot round the CTA |
| hero pick | 0.44 → 0.10 | 0.15 → 0.08 | 0.02 → 0.01 | 0.05 → 0.03 | 0.02 | — | the pick card's live frame: 0.004–0.02 Hz |
| HQ | **0.73 → 0.10** | — | — | — | 0.01 | 0.002 | the crate's `hq-shake`, one crate, every 2.4 s, is the one attention cue |
| Codex | 0.19 → 0.05 | — | — | — | 0.004 → 0.008 | 0.003 | `cx-pop` 160 ms on a card; NEW badges are still |
| Settings | 0.11 → 0.02 | — | — | — | 0.007 → 0.003 | 0.002 | only the open row wears the frame |
| charter (Buy Company) | — | — | — | — | — | 0.004 | `ch-aurora`, 3 s alternate, on the frame |

- **What changed:** the same two fixes as the home, the breathing glow and the anchored
  dither. Ribbons, the moon and splats stay off pages, as before.
- **Transitions and sheets:** a screen swap is a cut, which keeps the 44 px controls
  steady. The ceremonies have their own short entrances:
  - `pg-land` 700 ms with a back-ease (the receipt's stamp);
  - `ct-pop` 500 ms and `ct-rise` 350 ms (a contract's slip);
  - `sov-pop` 450 ms (the Sovereign reveal);
  - `hq-pop` 450 ms (a pulled crate).
- Each of those plays once and does one job: a state change. All are killed by reduced
  motion.
- The militia builder's `co-wave` (the flag waves, 2.6 s) is the builder's one loop. It is
  the thing you are making, so it is right.

Shot: `pages-before-after.png`.

## Battle

Canvas energy is in Hz:

- *stage*: the battle canvas;
- *edge*: its 26 px margin;
- the lane carries 5–12 Hz in every world (the white band on the heatmaps).

| | Peppercorn | Ironvein | Easel House | Rosethread | Moonquill | house |
|---|---|---|---|---|---|---|
| stage, a 19-raider wave | 1.35 | 1.77 | 1.09 | 1.11 | 0.77 | 1.13 |
| edge band, mid-wave | 0.30 | **1.32 → 1.16** | 0.22 | 0.22 | 0.44 | 0.32 |
| edge band, setup (no wave) | 0.26 | **0.61** | — | — | — | 0.21 |
| weather | dust, fluff, leaves | **rain sheet**, clouds, flash | petals, butterflies | dew, mist | snow sheet | none |

- **Ironvein's rain was the busiest atmosphere in the game.** At 540 px/s, every pixel of a
  band 22% of the view wide changed every frame: 4× the other worlds at the edge.
  - Its bands are 15% and 7.5% now, at 0.42 alpha, down from 22%, 11% and 0.5.
  - The rain stays fast, because rain falls fast and it is the right kind of motion for an
    overcast world.
  - It is still the busiest margin, at 2–3× the others, and well under the lane.
- **Hits and FX** (`fx.ts`, `fxDiff.ts`, `attackLook.ts`): they are already budgeted
  (Lisa Brown's rule, in the code).
  - Hitstop is capped at ~18% of real time, and trauma has a ceiling for frequent hits.
  - Damage numbers merge per target (one plain and one crit at a time), and they live
    1.15 / 1.45 / 1.55 s in real seconds at every speed.
  - On the heatmaps they are small hot specks on the lane and never over the HUD.
  - Job 2 · none · right. Not changed.
- **Projectiles, HP bars, unit idle and attack, the gate:** their motion is on the lane,
  where the eye belongs. The figure and enemy draw code belongs to other passes and was not
  touched.
- **DOM:**
  - **Wave preview:** 220 ms down and 240 ms opacity.
  - **Coach pills:** `sh-pill-down` 220 ms; reduced motion uses a fade only.
  - **Ceremony:** `sh-cer-in` 280 ms with a back-ease, and `sh-cer-up` 240 ms.
  - **Spoils hand:** `sh-rw-dim` 260 ms on the field, and the cards rise 240 ms.
  - **Level flash:** `sh-lvflash`, 3.2 s, then it fades.
  - All of these are one-shot state changes. They do their job (2) and are right.
- **One fix: two pulses at once.**
  - A hero owed a skill had its halo breathing (`sh-lvup-glow`, 1.8 s, a 20 px halo).
  - At the same time, the Upgrade badge pulsed (`sh-upg-pulse`, 1.8 s) for the same skill.
  - Now, while the badge is waiting, the halo holds still. The ring and halo stay to say
    who; the badge pulses to say where to act (`battle-band-after.png`).
- **Run map:** `node-pulse` (1.8 s) runs on the reachable nodes, as one group. That is
  the one "choose next" cue.

Shots: `battle-worlds-after.png`, `battle-band-after.png`.

## Settings: Full, Light, reduced motion, high contrast

| | Peppercorn | Ironvein | everything else |
|---|---|---|---|
| Full | 0.29 Hz | 0.28 Hz | see above |
| **Light** | 0.20 → **0.12** | 0.12 | half the particles at half the cadence, no glows, frames and strips still |
| reduced motion | **0** | **0** | 0 Hz on every home and page capture: no particles, no bursts, no switch-in, frames on their first step. On the battlefield the weather and edge band are gone; units, shots and HP still move, because that is the game. |
| high contrast | 0.30 (energy unchanged) | 0.27 | particles dimmed ×0.6, never brightened |

The automatic step-down (`fxQuality`: under 45 fps for 2 s) never triggered on the home at
4×, which held 60 fps. In a battle at 4× it can, which is the intent.

Shot: `home-modes-after.png`.

## Cost (4× CPU throttle, 390 × 844, headless Chromium)

| | before | after |
|---|---|---|
| home, every world, Full | 59.7–60.2 fps, 0 long frames | 59.5–60.2 fps, 0 long frames |
| the worlds' loop per frame (mean / p95) | 1.06–1.21 ms / 5.0–6.2 ms | 1.13–1.42 ms / 4.8–6.4 ms |
| Light | 56–60 fps, loop 0.89–1.08 ms | 60 fps, loop 0.81–1.07 ms |
| pages (terms) | 60 fps, loop 1.4–1.5 ms | 60 fps, loop 1.1–1.3 ms |
| a battle mid-wave | 25–39 fps (spread across runs) | 18–39 fps (the same spread) |

- The home is no longer costly on a slow phone. An earlier review measured 25–40 fps; the
  software pen and the 24 fps cadence fixed that.
- The battle is the cost, as before. With the weather, the edge band or both switched off
  (`battlecost`), the same fight ran 25–39 fps either way: within the wave-to-wave noise.

## Top findings, ranked by harm

1. **The switch-in crossed the card and the dock** as the new company's words landed. The
   worst cases were Peppercorn's wall of flame (3.1 Hz on the card) and Ironvein's
   full-screen white flash (2.4 Hz on screen). It got in the way of the one moment you read
   the card.
   - *Fixed:* the overlay is cleared under every panel as well as every word, and the
     forge's flash is local. Card during a switch: 0.6–0.9 Hz, which is the card's own
     colour ease and new words.
2. **Peppercorn's home was too much.** It ran at 0.87 Hz, 2.3× the next world, with its
   focused road the busiest band on any home (2.6 Hz).
   - *Fixed:* 40 embers, shorter-lived, the ones beside the road smaller and further off
     it; the heat breathes instead of crawling; the coal flickers by its halo. Now 0.29 Hz,
     with the road at 1.6 Hz (its traffic is 0.9).
3. **Crawling heat glows (fire and forge)** changed every pixel along the dock and round
   the CTA on pages. Light was the only thing that stopped them.
   - *Fixed:* the glows hold still and breathe. On pages: Peppercorn's HQ went from
     0.73 to 0.10 Hz and its pick from 0.44 to 0.10 Hz.
4. **Ironvein's battle rain:** 4× the other worlds' motion at the battlefield's edges.
   - *Fixed:* narrower, fainter bands. It is still the busiest margin, and the right kind.
5. **Jank: whole-shape dither flips.** Easel House's washes (≈70 px discs) and Moonquill's
   beam flipped their whole checker at once.
   - *Fixed:* the washes are anchored to the screen; the beam is still, with a ripple.
6. **Two pulses for one fact:** the levelled hero's halo and the Upgrade badge.
   - *Fixed:* one at a time.
7. **Easel House's panels barely move:** a hundredth of the others' motion on the card and
   the CTA.
   - *Raised a little:* the frame glint and four strip flecks. It is still the quietest.

## Left alone, and the recommendation

- **Easel House's card and CTA** are still the quietest of the five, at 0.02 Hz against
  0.08–0.35. Its identity lives on the map: splats, drips, washes.
  - If the designer wants its panels as alive as the others, the next step is a drip
    running down the CTA's strip every couple of seconds. It would be a new piece of art,
    not a timing change.
- **Moonquill is the calmest company world** (0.08 Hz). Night is still by nature, and its
  still frame names the world: the moon. Raising its quill strokes made no measurable
  difference.
- **Rosethread's ribbons** are the one wide moving shape on a home. They pass behind the
  city labels, which keep their plates. It is the world's identity, so it is kept.
- **Battle FX, damage numbers, unit animation:** already budgeted, the lane is the motion,
  and the figure code belongs to other passes.
- **`node-pulse`** uses a house `rgba()` literal on chrome (DESIGN_SYSTEM § 8 rule 7). It
  is not a motion issue, but worth a token.
- **The battle on a slow phone** (18–39 fps at 4×) is the remaining cost, and it is not the
  worlds' layers. A profile of the battle's own draw is the next performance step.

**Recommendation:** keep the five worlds as rich as they are now. All five are within a
4× band of each other (0.08–0.29 Hz), against 7× before (0.12–0.87 Hz), and each one moves in its
own kind of motion. The ambient never touches a word or a panel, and the bursts stay on the
CTA. Ship it.
