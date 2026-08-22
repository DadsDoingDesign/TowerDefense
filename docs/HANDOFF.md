# Handoff — art replacement programme

**Read this first, then `docs/ART-PLAN.md`, then `docs/ASSET-LIST.md`.**
This file says where the work stands and what to do next. The other two say
*what* to build and *to what spec*.

Branch: `claude/asset-list-review-2btntw`.

---

## 1. Why this programme exists

Tiny Swords is no longer CC0. Its licence forbids redistribution **even of
modified files**, and this repository is public, so all 45 sprite files and both
FX sheets are a redistribution and must be replaced from scratch. The 78-icon
atlas is generated from source in this repo and is licence-clean — it does not
need replacing.

That forcing function is why the plan sequences by *risk*, not by tier:
everything has to be redrawn regardless, so the uncertain parts go first.

---

## 2. Decisions already made — do not relitigate

| Decision | Where it is argued |
|---|---|
| **Storybook Chunk**, 2.5-head chibi, one light source top-left, no dithering on units | `ART-PLAN.md` §2 |
| **One pixel density**, `spriteScale: 1` — the artist authors exactly what the player sees | `ART-PLAN.md` §1.3 |
| **Units grow 1.5×**, decorations stay put (`DECO_CEIL`) | `ART-PLAN.md` §1.4 |
| **Full three-slot paper doll** + procedural effects | `ART-PLAN.md` §3 |
| **No engine rebuild for higher density** — considered, costed, deferred | `ART-PLAN.md` §1.6 |

The density one is the most likely to be re-opened by someone who has not read
the arithmetic, so in short: the field composites at 960×560 and blits once at
`dpr × view = 0.8125`, so a hero is **34 × 39 device px**. Authoring at 4× adds
nothing. Detail and on-field size are the same knob. Raising the *internal*
render scale is capped at +22% and only on dpr-3 phones; growing the sprites
gives +50% on every device for free, because `radius` drives hitboxes and art
size comes only from the PNG.

---

## 3. What is built and working

### Phase 0 — engine (done, verified)

- **`src/game/render/loadout.ts`** — the paper-doll compositor. Layers body and
  gear into one canvas **before** `pixmap()` bakes the contour ring, so the
  assembled figure gets one ring instead of one per layer. Bounded cache (24)
  keyed by loadout; an incomplete composite is never cached.
- **`src/game/render/anchors.ts`** + **`anchors.generated.ts`** — the attach
  points and the shared five-pose vocabulary (`rest raise strike extend
  recover`).
- **`scripts/anchors.ts`** — reads `*_anchors.png` marker layers into the
  generated table. `npm run anchors:check` is wired into `npm run build`.
- **`pixmap()` accepts a canvas source**, which is what lets a composite feed
  the bake.
- **`DrawSentinel.loadout`** is optional; absent means the bare body renders
  exactly as before.
- **`fieldwatch` pack + theme** at `spriteScale: 1`, registered but **not
  activated**. Tiny Swords is still the live theme.

### Phase 1 — the harness (done, working on placeholder art)

- **`harness/`** — renders the fighter across five loadouts through the *real*
  draw code, at the three measured viewport scales, plus a 4× inspection view,
  an anchor-drift strip and the 10px silhouette gate.
- **`scripts/gen-placeholder-pack.ts`** — generates blocking at the exact
  spec'd dimensions so the pipeline runs end to end before any real art exists.
- **`scripts/slice-shot.mjs`** — screenshots the harness into `docs/slice/`.

`docs/slice/` currently holds the placeholder render. **That is blocking, not
art.** It exists to prove the rig and to give the artist correctly-sized
templates.

---

## 4. How to run it

```bash
npm install
npm run placeholder-pack     # regenerate the blocking pack (destructive)
npm run anchors              # extract anchors from *_anchors.png
npm run build                # includes fw-icons:check and anchors:check

npx vite --port 5188 --strictPort &
open http://localhost:5188/harness/

npm i --no-save playwright-core     # not a dependency, by design
node scripts/slice-shot.mjs         # writes docs/slice/
```

`playwright-core` is deliberately absent from `package.json` — see the note at
the top of `scripts/ui-audit.mjs`. On this container Chromium lives at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; override with
`PW_CHROMIUM`.

---

## 5. Traps already hit — do not rediscover these

1. **`DECO_CEIL = 96` drops decorations silently.** At `spriteScale: 1` the
   halving stops, so today's `tree1.png` at 113 × 176 would draw at 176 and
   vanish from the pool with no warning. Every decoration must be authored at
   its drawn size.
2. **A missing sprite does not 404 in dev.** Vite's SPA fallback answers
   `assets/sprites/<pack>/nope.png` with `200 text/html`, which the browser
   fails to decode. `slice-shot.mjs` detects this by content type; a plain 404
   check reports nothing.
3. **The harness needs `<base href="/">`.** The sprite loader builds *relative*
   URLs, so served from `/harness/` every sprite resolves to
   `/harness/assets/…`, misses, and the renderer silently falls back to
   procedural circles — a page that looks like it rendered fine.
4. **Body overlays are placed by centre-x and bottom-y, not at the frame
   origin.** Idle and attack cells are different sizes (64 × 72 and 98 × 90)
   and both are feet-anchored, so one overlay strip serves both. Matching the
   origin made overlays render on idle only and vanish on attack.
5. **Gear roles are full role names.** `gear_sword`, `body_plate`. An earlier
   version prefixed `gear_` inside the draw helper and looked up
   `gear_body_plate`.
6. **Rotation is unavailable.** Acceptance gate 2 forbids off-axis resampling.
   That is *why* the five-pose vocabulary exists — do not "simplify" it by
   rotating one weapon sprite.

---

## 6. What to do next, in order

### 6.1 Replace the placeholder fighter with real art *(the actual next task)*

Author over `public/assets/sprites/fieldwatch/` at these exact dimensions:

| File | Cells | Cell px | Notes |
|---|---|---|---|
| `fighter_idle.png` | 6 | 64 × 72 | 6 fps breathing loop, feet on the bottom row |
| `fighter_atk.png` | 6 | 98 × 90 | grows upward from the same feet line |
| `fighter.png` | 1 | 64 × 72 | also the DOM roster portrait at native 1:1 |
| `fighter_*_anchors.png` | — | match the strip | magenta grip, cyan off-hand, yellow tip |

Rules that are not negotiable: top 10% transparent (the tier plaque hangs
there), feet on the bottom row of **every** frame, even dimensions, no baked
outline or shadow (the engine bakes the ring), ≤ 14 colours.

Then `npm run anchors && node scripts/slice-shot.mjs` and review
`docs/slice/` against `DESIGN_REVIEW.md`.

### 6.2 Finish the slice
Rogue and mystic bodies, then the remaining gear nouns, one goblin, one tree,
the `paper_special_9.png` panel. `slice-shot.mjs` prints exactly which roles
are still unauthored — that list is the worklist.

### 6.3 Only then, Phase 2 onward
Heroes and gear, enemies **bosses first** (`torch5`/`tnt5`/`barrel5` are
byte-identical to `torch1`/`tnt1`/`barrel3` — three named bosses wearing
trash-mob art), environment, UI and key art. See `ART-PLAN.md` §4.

### 6.4 Flip the theme — the last step, not the first
When the pack is complete, change the active theme to `fieldwatch`. **Not
before**: flipping it now draws today's art at 2× and makes every tree vanish.

---

## 7. Open questions for whoever picks this up

1. **Weapon-tip effects are specified but not implemented.** `gearTip()` exists
   and the anchor extractor reads the yellow marker, but nothing consumes it
   yet. Wiring `Flaming`/`Frost`/`Shocking` to emit from the tip is a small
   piece of work in `fx.ts` and is the cheapest remaining win on the gear
   feature.
2. **Nothing populates `DrawSentinel.loadout` from real game state yet.** The
   compositor is wired into the renderer and exercised by the harness, but
   `sentinelFromRt()` does not map a hero's equipped `Item`s onto gear art
   names. That mapping — item noun → art role, lowercased, with the §7.4
   26-nouns-to-18-shapes compression — is what makes gear show up in an actual
   battle.
3. **The placeholder pack is precached.** It added 23 files (~10 KB) to the
   service worker's install set even though the theme is inactive, because the
   reachability pass sees `fieldwatch` in the bundle. Harmless, and correct
   once the pack ships real art, but worth knowing if install weight is being
   measured before then.
4. **Body armour's real value is unproven.** At 52 device px a torso texture is
   invisible and only a changed outline reads. The placeholder confirms
   pauldrons and a hem survive; whether five *distinct* armours can be told
   apart at that size is a question only real art answers. If they cannot,
   collapse them to three silhouette families and spend the budget on weapons.
