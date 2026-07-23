# Design review loop

A recurring self-review applied **after every task that changes visuals or
gameplay feel** — not just when something looks wrong. The goal is to catch
"flat and bland" *before* the user has to.

## The loop

1. **Render it.** Capture the real result — screenshot the app (or a render
   harness that calls the real draw code), not an imagined version.
2. **Look at it cold.** Score it against the checklist below. Name specific
   failures ("the grass is one flat block", not "could be nicer").
3. **Benchmark.** Compare against the reference games — would this look at home
   next to them? Where does it fall short?
4. **Fix the top 2–3 issues, then re-render.** Repeat until it passes.
5. **Only then** commit and report — include a before/after when it's visual.

## Checklist

**Readability & hierarchy** (most important for a tower-defense)
- [ ] The play field reads instantly — units and towers are the highest-contrast
      things; nothing decorative competes with them.
- [ ] Decoration lives at the **margins**, never in the play area or on build
      slots / the enemy lane.
- [ ] Enemy tiers/factions are distinguishable at a glance (silhouette + colour).

**Colour & surface**
- [ ] No large flat "dead" areas — backgrounds carry low-contrast tonal
      variation (patches, tufts, detail) so they feel alive, not noisy.
- [ ] Palette is cohesive; the background is slightly muted so foreground pops.
- [ ] Functional colours (health, boss ring, selection) stay unambiguous.

**Surfaces have character**
- [ ] Paths/roads/surfaces have texture and worn detail, not a single flat fill.
- [ ] Edges are broken up (tufts, irregularity), not clean vector strokes.

**Depth & composition**
- [ ] Grounding shadows, a subtle vignette or lighting — the scene has depth.
- [ ] The frame is composed: a clear focal area, framed edges, breathing room.

**Polish**
- [ ] Consistent pixel scale / `image-rendering: pixelated`; no blurring.
- [ ] Nothing clipped, mis-anchored, or z-fighting.

## Reference games (benchmark against these)

- **Kingdom Rush** — the gold standard for TD readability: rich but the lane and
  build spots are always clean; decoration frames the play area.
- **Bloons TD 6** — legible tracks, decorative-but-calm backgrounds.
- **Tiny Swords** showcases / **Warcraft II** — the target art language: lush
  grass with tonal variation, forest borders, worn dirt trails, water/cliffs.
- **Clash Royale / autobattlers** — extreme unit readability over muted grounds.

## Log

- **2026-07-23 — battle level design.** First pass was flat: one grass block, a
  bland brown stroke, trees scattered through the play area blocking sightlines.
  Fix: trees moved to a perimeter forest frame (interior kept clear); grass got
  tonal blobs + tufts + flowers; the lane got dirt speckle, worn ruts, and a
  tufted broken edge; base grass muted so units pop.
