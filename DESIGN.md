# DESIGN.md — Tower Defense: Ops Console

A browser-based tower defense game styled as a modern B2B SaaS ops dashboard.
Inspired by Linear, Vercel, and Stripe. Dark mode only.

---

## Visual Theme & Atmosphere

The UI looks and feels like a real-time infrastructure monitoring console.
The game canvas is the "data view" — a live map of your network perimeter.
The bottom bar is the "control panel" — deploy defenses, track resources, manage threats.

- **Mood**: Technical, precise, calm under pressure
- **References**: Linear issue tracker, Vercel deployment dashboard, Stripe radar
- **No game kitsch**: no cartoon fonts, no bright primary colors, no pixel art UI
- **Data density**: every pixel of HUD space earns its place

---

## Color Palette

All colors defined as CSS custom properties. Use these — never hardcode hex in JS/CSS.

```css
:root {
  /* Backgrounds */
  --bg-base:        #0a0a0b;   /* page / canvas background */
  --bg-surface:     #111113;   /* UI bar, cards, panels */
  --bg-elevated:    #1a1a1f;   /* hover, selected, active states */
  --bg-overlay:     rgba(10, 10, 11, 0.95); /* modal backdrops */

  /* Borders */
  --border:         #2a2a30;   /* panel edges, dividers */
  --border-focus:   #3b82f6;   /* keyboard focus ring */

  /* Text */
  --text-primary:   #f4f4f5;   /* main readable text */
  --text-secondary: #71717a;   /* labels, captions, hints */
  --text-muted:     #3f3f46;   /* disabled / placeholder */

  /* Accents */
  --accent-blue:    #3b82f6;   /* selected tower, primary CTA, links */
  --accent-blue-bg: rgba(59, 130, 246, 0.12); /* blue tint backgrounds */
  --accent-green:   #22c55e;   /* gold/credits display, success */
  --accent-red:     #ef4444;   /* lives, danger, enemy health bars */
  --accent-amber:   #f59e0b;   /* wave timer, warning states */
  --accent-purple:  #a855f7;   /* frost tower */

  /* Tower identity */
  --tower-arrow:    #3b82f6;
  --tower-cannon:   #f59e0b;
  --tower-frost:    #a855f7;
  --tower-laser:    #ef4444;

  /* Enemy identity */
  --enemy-basic:    #71717a;
  --enemy-fast:     #22c55e;
  --enemy-tank:     #ef4444;

  /* Game map */
  --path-fill:      #1e1e24;
  --path-border:    #2a2a30;
  --grid-line:      rgba(255, 255, 255, 0.03);
  --tile-hover:     rgba(59, 130, 246, 0.15);
  --tile-invalid:   rgba(239, 68, 68, 0.15);
}
```

---

## Typography

```
UI / Labels:    Inter, -apple-system, BlinkMacSystemFont, sans-serif
Numbers/Stats:  'JetBrains Mono', 'Fira Code', 'Courier New', monospace
```

### Scale

| Use | Size | Weight | Font |
|-----|------|--------|------|
| Page title / Wave number | 20px | 600 | Sans |
| Stat value (gold, lives) | 16px | 500 | Mono |
| Stat label | 11px | 400 | Sans |
| Tower button label | 12px | 500 | Sans |
| Tower button cost | 11px | 400 | Mono |
| Toast / notification | 13px | 400 | Sans |
| Modal heading | 24px | 600 | Sans |
| Modal body | 14px | 400 | Sans |

### Rules
- Never use font-weight below 400 in the UI
- Stat numbers always use monospace so they don't shift width as they update
- All caps only for section labels (e.g., `WAVE`, `CREDITS`, `LIVES`)

---

## Layout

### Mobile (default, < 768px)

```
┌────────────────────────────────┐  ← 100dvh
│                                │
│         GAME CANVAS            │  flex-grow, touches all 4 sides
│                                │
│                                │
├────────────────────────────────┤
│  [CREDITS ◆ 150]  [LIVES ♥ 20] [WAVE 1]  │  stats row, 32px
├────────────────────────────────┤
│  [Arrow] [Cannon] [Frost] [Laser]  [▶ START]  │  tower strip, 56px
└────────────────────────────────┘
  ↑ bottom bar total: ~80px, fixed, z-index 10
```

### Desktop (≥ 768px)

Same layout but bottom bar expands to 96px, tower buttons show name + cost text below icon.

### Rules
- Use `100dvh` (not `100vh`) — avoids iOS Safari URL bar shifting layout
- `touch-action: none` on canvas container — prevents browser scroll/zoom interference
- Tower buttons: minimum **56 × 56px** tap target (Apple HIG / Google Material minimum)
- No horizontal scroll on any viewport width
- Canvas always fills available space; grid tiles scale accordingly

---

## Component Patterns

### Stat Chip
```
┌───────────┐
│  ◆ 150    │  ← accent-green, mono, 16px
│  CREDITS  │  ← text-secondary, sans, 11px uppercase
└───────────┘
```
- Background: transparent (sits on bg-surface)
- No border, no shadow

### Tower Button
```
┌─────────┐
│  [icon] │  ← 28×28px SVG or canvas-drawn icon
│  Arrow  │  ← text-primary, 12px (hidden on mobile)
│  50 cr  │  ← text-secondary mono, 11px (hidden on mobile)
└─────────┘
```
- Default: `bg-elevated`, 1px `border` border, border-radius 6px
- Selected: `accent-blue-bg` background, 1px `accent-blue` border
- Unaffordable: opacity 0.4, not interactive
- Active press: scale(0.95) for 100ms

### Modal Card
```
┌──────────────────────────┐
│  WAVE COMPLETE           │  heading, 24px 600
│  ─────────────────────── │
│  +75 credits awarded     │  body text
│                          │
│  [  START WAVE 2  ]      │  primary button
└──────────────────────────┘
```
- Backdrop: `bg-overlay`
- Card: `bg-surface`, 1px `border` border, border-radius 8px, padding 24px
- Max-width 360px, centered

### Primary Button
- Background: `accent-blue`
- Text: white, 14px, weight 500
- Border-radius: 6px
- Padding: 10px 20px
- No box-shadow
- Hover: brightness(1.1)
- Active: scale(0.97)

### Health Bar (canvas)
- Track: `rgba(255,255,255,0.08)`, height 3px
- Fill: gradient `accent-green` → `accent-amber` → `accent-red` based on % remaining
- Drawn 4px above enemy sprite

---

## Motion & Interaction

| Event | Animation |
|-------|-----------|
| Tower placed | Scale 0 → 1.08 → 1.0, 200ms ease-out |
| Tower selected | Border transitions to `accent-blue`, 120ms |
| Wave start toast | Translate Y +20px → 0, opacity 0→1, 300ms ease-out; auto-dismiss 2s |
| Enemy death | Opacity 1→0, scale 1→0.5, 250ms (canvas, skip if >20 deaths/sec) |
| Gold earned | +N float text, moves up 20px, fades, 600ms |
| Modal appear | Opacity 0→1, scale 0.96→1, 200ms ease-out |
| Button press | Scale 0.95, 100ms |

**Performance rules:**
- Death animation capped at 20/sec to prevent frame drops on mobile
- No CSS animations that trigger layout recalculation (only `transform` and `opacity`)
- Canvas idle redraws only on state change (enemies moving, projectiles active)

---

## Iconography

Simple geometric icons drawn on canvas or as inline SVG. No icon font.

| Tower | Icon shape |
|-------|-----------|
| Arrow | Triangle pointing right, stroke only |
| Cannon | Filled circle with short barrel rectangle |
| Frost | Six-point snowflake, stroke |
| Laser | Diamond shape, filled |

| UI | Icon |
|----|------|
| Credits | ◆ (Unicode diamond, `accent-green`) |
| Lives | ♥ (Unicode heart, `accent-red`) |
| Wave | # prefix |

---

## Accessibility

- Color is never the *only* signal (shapes + labels always accompany color coding)
- Interactive elements have visible `:focus-visible` ring: 2px `border-focus` outline, 2px offset
- Minimum contrast ratio 4.5:1 for all text on its background
- Touch targets minimum 56×56px
- Viewport `user-scalable=no` is acceptable here (game input requires it), but font sizes must be readable at 1× zoom

---

## Brand Voice (UI Copy)

- **Tone**: Calm, precise, professional. No exclamation marks in status messages.
- **Labels**: Terse. "CREDITS" not "Gold Coins". "LIVES" not "Hearts". "WAVE 4" not "Round 4".
- **Notifications**: Present tense. "Wave 3 inbound." not "Wave 3 is starting!"
- **Game over**: "Connection lost. 0 lives remaining." — not "YOU LOSE!!!"
- **Victory**: "Perimeter secured. Wave 10 complete." — understated

---

## What This Is Not

- Not a fantasy/medieval game UI (no parchment, no swords, no pixel fonts)
- Not a mobile candy-crush style (no bright yellows, no bouncy animations, no stars)
- Not Material Design or iOS defaults (no elevation shadows, no FABs)
- Not a developer dark terminal (not green-on-black, not monospace-everything)

The target is: if you saw a screenshot without the game canvas, you'd think it was a B2B SaaS product's monitoring dashboard.
