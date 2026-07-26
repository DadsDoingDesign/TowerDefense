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

- **2026-07-23 — brand guide + full UI reskin.** The battle map + accessory
  screens were on-theme, but the surrounding UI chrome was still cool blue-grey
  (info-blue Marks/Endless/Dust, purple Sacrifice/epic, blue rarity, cool-black
  scrim/letterbox, white-alpha borders). Wrote `docs/BRAND.md` (warm storybook
  medieval; no cool chrome; teal = primary, gold = value) and swept every screen
  against it. Retokenised `global.css` :root to the warm table palette; warmed
  the scrim (`rgba(20,12,6,.66)`) and canvas letterbox (`#17100a`); recoloured
  hub marks→gold, sacrifice→goblin-red, upgrade buys→teal; endless→teal;
  map node types→warm (teal start, sage shrines, gold merchant), edges→gold,
  current→teal; rarity ramp→warm (stone/teal/orchid/gold); enchant + upgrade +
  xp + evolution-grant accents→teal; recruit DPS→gold. Verified with real
  screenshots of hub, map, battle, detail, merchant, shrine, and equip — all
  now read as one warm wooden-table set. Mystic-blue kept as intentional class
  identity (per BRAND.md archetype hues).

- **2026-07-26 — UI audit rebuilt in Figma.** Took `docs/ui-audit/` (7 folders,
  desktop + mobile) and rebuilt it as a real design system in Figma rather than
  a screenshot dump: `00 · Foundations` (colour/type/radius/spacing/elevation/
  glyphs, every swatch labelled with its `global.css` token), `01 · Component
  Library` (43 components, the multi-state ones as proper variant sets),
  `02 · Screens — Desktop` (9 × 1180×720, assembled from instances),
  `03 · Modals & Overlays` (7 overlays on a 60% scrim over real screen
  context), `04 · Screens — Mobile` (4 × 390×844). Verified every section with
  rendered screenshots from Figma, not assumed output — three defects were
  caught and fixed that way: sentinel cards were missing the 3px archetype rail,
  the evolve-ready card clipped its gear/info buttons (header tightened, card
  340px), and the tactics segmented control clipped "Near" inside the 294px HUD
  rail. Two fidelity notes recorded in `docs/FIGMA.md`: sprite upload is blocked
  by the sandbox network policy so pixel art is vector stand-ins, and teal
  legitimately carries two text treatments (dark ink on price chips, light on
  the large nine-slice CTA) — both are in the Button set.

- **2026-07-26 — mobile flow board + mobile UI system.** Added a second Figma
  page (`_Mobile first UI`) holding two sections. `01 · Mobile UI System` is the
  390×844 spec — safe areas, 14px gutters, the pinned action footer, a 44/48/52
  touch-target floor, the four-pattern navigation model (tab / sheet / full /
  over), and the mobile-only chrome as components (top bar, action footer, tab
  bar, bottom sheet, toast, inventory grid, list row). `02 · Mobile Flows` is
  every mobile screen in the audit — 40 frames across 5 lanes (Watchtower, Run,
  Battle, Gear & pack, Ending & endless) — wired with 68 orthogonally-routed
  paths, each forward edge labelled with the trigger that fires it and each
  return edge drawn faded. 56 of those paths are also real Figma prototype
  reactions attached to the actual CTA, so the board is walkable from
  A1 · Main Menu; the remaining 12 are state changes with no single trigger
  element (tab swaps, level-up, wave outcome) and stay documented as wires.
  Verified each lane with rendered screenshots as it was built.
