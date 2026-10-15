# The map-first home — three rounds of review (October 2026)

The designer's brief, verbatim: *"I don't like the character thing. On the
Home Screen I like the map being front and center. Can we minimize UI and try
to overlay the map where UI is needed on the home page. Maybe each company has
a consistent even space spot to click the options and then you see the things
light up on the map. Proceed with 3 rounds of review."*

Every shot is the running app (Vite dev, Playwright Chromium, reduced motion
so the still frame is deterministic), seeded through `window.__meta` /
`window.__game`:

- **vet** — 31 contracts, 2,480 gold: Peppercorn 7, Easel 4, Ironvein in
  Term II (level 3, gold rim), Rosethread 2, Moonquill 5; the market open
  (today: Easel House ×1.3); trade war season 3 with the exclusive signed
  with Ironvein (so Moonquill is cold) and Rosethread desperate; the
  Sovereign Route open.
- **mid** — 6 contracts, 340 gold, Peppercorn 3, Easel 1; season 1; HQ still
  locked.
- **early** — 2 contracts, the first-time dock tip showing.
- **first** — a first launch (LS3 staging): one road, the free escort.

Viewports: 390×844 and 375×667 phones (@2x), 1280×800 and 1440×900 desks,
768×1024 tablet. Each company is focused at least once across the set.
`before/` holds two shots of the home this replaced.

Scored against `docs/DESIGN_REVIEW.md`'s checklist and `DESIGN_SYSTEM.md`
§ 8; benchmarked against map-first homes — Slay the Spire's act map (the map
is the screen, the legend is tiny and in a corner), Inscryption's board (the
table is the UI; nothing floats that is not on it), Clash Royale / Supercell
homes (a slim resource bar on top, a fixed tab dock at the foot, the middle
is the world), Monument Valley's level select (one object in the middle, one
caption, nothing else).

---

## Round 1 — `r1/`

**What was built.** The trade map fills the viewport on every size. Over it:
a slim bar (the seal — the h1 is spoken on a phone, written on a desk — the
bank, four 44px place buttons: HQ, crates, Codex, Settings, a locked one
dimmed with its padlock and its reason as its name and tooltip); a company
dock of five fixed, evenly spaced slots in `COMPANY_IDS` order (crest, Rep,
war share, the day's marks on the top edge); a compact glass card for the
focused company (flag → livery, goods and name, chips, Next → track) closing
on the one CTA. The roads now fan west→east in the dock's order, so the dock
reads as the map's legend. Focusing a road re-lights the canvas: a night wash
over the map, the road's pixels and towns laid back undimmed, its glow at
Standing-5 strength or better (a never-worked road lights too), the others at
a third, their traffic dimmed; its signpost takes the company colour and its
three cities are named beside their towns. The liaison is gone from the home,
and so is the board line it said (`boardLine` and its data).

**Jury.** It is the right building. The map went from a 330px strip to the
whole screen, and on the phone the dock-and-card stack reads like a Supercell
tab bar with its panel: you see the five, you pick one, the world answers. The
first launch is the best screen of the set — one lit road, three named
cities, one card, one button — that is the Monument Valley bar. But:

1. **The cities collide with roads.** Ironvein's "Cobble Rise" sat on Easel
   House's road; at 375×667 "Cinder Ford" hid under "Pepperport". The
   readout lies when a label sits on the wrong road.
2. **Three crowns, one meaning each.** The season leader wore a crown on its
   signpost AND on its dock slot, and the season pill had a third, generic
   one. Say a fact once (§ 8 rule 2). Separately, Ironvein's crest (the
   tallest logo, rimmed for Term II) overflowed its 26px row and covered
   "II · 3".
3. **The fan is cramped, and desk has a dead band.** On a phone the roads use
   80% of the width; on desk the hub sat at 68% of the open height, so a dark
   empty band lay between the hub and the console, and the console's card
   stacked its CTA under it (a taller console, less map).
4. **The shoulders are heavy.** The season and Sovereign pills were as tall
   and as dark as the slots under them, competing with the dock.
5. Contrast: the desperate tag (ink on `--bad`) measured 4.41:1 —
   `tests/contrast.test.ts` caught it.

**Fixes for round 2.** Cities placed by score: of eight spots round each town,
the first free one with the least road under it (any road, its own included),
never over a signpost or another city. The crown lives only on the dock's
leader; the signposts are crest-only plates and the pill is words only
("Season 3 · 3 contracts left", the word "contracts" dropped under 420px).
The crest row is 32px. Hub at 88% (phone) / 86% (wide) of the open area, the
portrait fan at 46% of the width, the wide fan centred; the desk card is one
row (flag and name · chips · the CTA). Pills 30px with a 44px hit area. The
desperate tag on `--bad-text`. The focus wash a little deeper (0.5) and the
other roads at 0.3 of their light.

---

## Round 2 — `r2/`

**What changed.** Round 1's fixes, above.

**Jury.** The phone at 390×844 now holds up next to a Supercell home: the bar
is a thin resource strip, the middle is the world, and the dock is a tab bar
whose selected tab drops a notch into its panel. Picking Ironvein draws a blue
road from the hub to Deepforge with Slagpit and Cobble Rise hung off it, every
other road a third as bright — the map is the readout, as asked. The desk is
the Slay the Spire layout it wanted to be: the fan centred over a one-row
console (dock above, card-and-CTA below), nothing in a column. One crown, on
the leader's slot. The Term II rim and "II · 3" read cleanly now. Remaining:

1. **A crowded road still loses a city.** At 375×667 the spice road is ~100px
   long with three towns and a signpost on it; "Cinder Ford" was still
   placed under "Pepperport" (no free spot, so the fallback overlapped).
2. **The shoulders are still 44px tall on a phone.** The shell's
   coarse-pointer floor gives every button `min-height: 44px`, so the pills'
   slim face never showed; they still outweigh the dock's labels.
3. **A short phone hides a fact.** The card's chips became one
   horizontally-scrolling line there, and Moonquill's "Next …" chip was cut
   at "Arc" — a chip scrolled out of sight is a fact nobody reads.
4. **The chips run long.** "Your exclusive · standing ×1.5" wraps the
   phone's chips to a second row; the dock's tag already says "Excl.".
5. **Moonquill's road is a stub.** At −16° and 64% reach its three cities
   stack within 40px of the hub.

**Fixes for round 3.** Cities are placed destination first, from thirteen
candidate spots (the eight round the town, then five further out); if none is
free the name leaves the map (it stays in the road's list for a screen
reader) rather than covering another. Pills drop the floor (`min-height: 0`)
and keep a 44px hit area through their `::after`. On a short phone the card
drops its goods kicker (the crest carries the goods), the name is one line,
and the chips wrap — every chip shows. The chips say the meaning only:
"Exclusive: standing ×1.5", "Desperate: raiders +20%". The east road runs at
−20° to 78% reach.

---

## Round 3 — `r3/` (critique), `r3/final/` (after its fixes)

**What changed.** Round 2's fixes, above. `r3/final/` adds three states: a
locked company in focus (early save, Moonquill), and the veteran with a
founded militia (its flag in the bar) on a phone and a desk.

**Jury.** Every city now finds a spot, even on the 375×667 spice road
(Saltmarsh, Cinder Ford, Pepperport all read, none on another road); the
pills are slim; a short phone's card shows every chip. The dock-to-road
mapping is the strongest idea in the set — slot 1 is the leftmost road, slot
5 the rightmost, so a player learns the map from the dock without being told.
Monument Valley test: on the first launch there is one lit thing and one
button. Clash Royale test: the bar is resources and places only. Slay the
Spire test: the map is the screen on every size. Last issues:

1. **A fresh season crowned a winner.** With five even shares (20% each) the
   dock still hung the crown on one slot — a tie is not a lead.
2. **Grammar on a plural good.** "Paintings sells high today".
3. **Two padlocks on a locked slot.** The locked crest is a padlock, and the
   standing under it repeated one ("🔒 3").
4. **A first launch's desk bar.** With no bank to push them, Codex and
   Settings sat beside the title instead of at the bar's end.
5. The crown on a desk slot (scale 1, 9px) was too small to read.

**Fixes (`r3/final/`).** The dock crowns only a sole leader (and the season
pill's name says who leads only then) — tested. The market chip reads "Top
price for paintings today". A locked slot reads "at 3" under its padlock
crest. The places push themselves right when there is no bank. The slot's
crown is drawn at 2×.

**Scorecard (final).**

| Check | |
|---|---|
| The map reads instantly; decoration at the margins | ✓ — the map is the screen; the overlays sit on the edges, never on a road |
| Each element has one job; no two do the same | ✓ — the dock and the signposts both focus a road (asked for); the signposts say nothing else |
| One title | ✓ — the seal's h1 (spoken on a phone, written on a desk); the card's name is an h2 |
| A fact said once | ✓ — Rep, share and the crown on the dock; the meaning of a mark on the card; the cities on the map |
| No standing hints | ✓ — "Pick a road — tap a signpost" and the standing strip are gone; one coach pill at a time, first time only |
| `.field-k` / `.field-v` | ✓ on the track chip ("Next · …") |
| One primary CTA | ✓ — "Read Ironvein's terms" / "Take the free escort" / "Opens at Standing 3" (disabled) |
| Tokens over literals | ✓ — new `--glass` / `--glass-strong`; contrast held over pure white in `tests/contrast.test.ts` |
| 44px targets, real buttons, focus order | ✓ — bar → season / Sovereign pills → dock → card (flag, track) → CTA, checked by Tab in Playwright; slim pills and chips reach 44 through a hit area |
| Reduced motion | ✓ — a focus change is a cut; with motion it crossfades over 220 ms (`FOCUS_FADE_MS`) |

**Left as is / for the designer.**

- The phone card is still the tallest layer (about 205px with four chips at
  390×844). Folding the chips into the dock would shrink it but would put
  words on the slots; we kept the slots glanceable.
- A short phone keeps the name and chips, so the card is two lines plus the
  CTA rather than the "one line" the brief allowed; dropping the chips there
  would hide the ground and armour.
- Peppercorn's next track reward is the skill "Wildfire", which reads oddly
  next to its "Wildfire" ground chip ("Next · Wildfire at 4"). That is the
  data's naming, not the home's.
- The roads now fan in the dock's order, so each company's road points a new
  way (Peppercorn west, Moonquill east). The first launch's free road runs
  west.

---

## Buy Company — the dock's sixth slot (`buy-company/`)

The designer, on the "Sovereign Route ›" pill: *"let's not show it that way,
it looks like a marketing chip. Maybe there is a button that looks locked
and it's called 'Buy Company' or something that just makes a bit more sense
intuitively."*

**What was built.** The pill is gone. The dock gains a sixth slot after the
five companies — narrower on a phone (44px at 375 wide, the touch floor; the
five keep 55), as wide on a desk, where it writes its name. It is no
company's road, so it wears no company's frame: a carved (double) cyan rim
and the Sovereign crest. Locked: the crest in shadow under a padlock, the
share of the catalogue unlocked ("40%") and a thin bar. Open: the crest in
colour, "Buy", a quiet glow. It shows from the first home after the free
escort — the endgame as a goal, not a secret. Selecting it lights all five
roads at once (`MapFocus 'all'`: the night wash, every road laid back at
Standing-5 glow or better, no city tags — fifteen names would bury the map)
and turns the card into Buy Company: "Sovereign Route" over the title, one
line on the road. Locked: Skills and Items counts and a disabled "Unlock 26
more". Open: "Delivered pays 30,000" and the CTA "Buy Company · 7,000", which
opens the charter page (the militia's founding first, if none). A short bank
gets one red line, "Your bank is 1,240 gold short.", and the CTA waits.

States: **mid** (6 contracts, 340 gold, 18 of 44 unlocks — 40%), **vet**
(31 contracts, 12,480 gold, door open, militia founded, season 3 with an
exclusive, a desperate and a cold company), **short** (the vet's door, 5,760
gold, no militia). 390×844 and 375×667 phones (touch, @2x), 1280×800 desk;
the slot in focus, and a company in focus to check the dock.

**Round 1 (`buy-company/r1/`) — jury.** The idea lands: the sixth slot reads
as "the one you are working toward" next to five you work for, and lighting
every road says what the route is without a word. Issues:

1. **The padlock sat on "40%".** On a short phone the slot's rows close up,
   and the padlock, hung under the crest, covered the number.
2. **The desk dock grew.** At 128px the slot could not fit the crest beside
   "Buy Company", so it wrapped and the whole row went from 72 to 95px tall.
3. **The open slot shouted.** Cyan crest, cyan "Buy" and a glow: the badge
   the designer asked to lose, in a new place.
4. **The bar clipped at 390.** A five-figure bank (and opening this road
   needs 7,000) plus the militia's flag pushed Settings off the edge — the
   narrow-bar rule stopped at 380.
5. A hairline divider before the slot was invisible over the glass: cut.

**Fixes (`buy-company/`).** The padlock hangs on the shield's face; the
desk dock is six even columns, the slot unwrapped (all six 65px tall);
"Buy" is plain text and the glow is softer (14%); the narrow bar applies up
to 420px; the divider is gone; the card's line is a few words shorter.
Checked in Playwright: the pill is gone, the slot focuses (`homeFocus:
'charter'`), five signposts lit and no city tags, the CTA opens the
militia's founding when there is none, and Tab runs the bar → season → six
slots → card → CTA.

**For the designer.**

- On a desk "Buy Company" is written three times (the slot, the card's
  title, the CTA) where a company slot shows only its logo. The desk has the
  room and the slot is "the button called Buy Company"; on a phone it says
  "Buy".
- The fee is said once, on the CTA (the store pattern, and the charter
  page's "Charter the road · 7,000"); the card's fact is the payout. A short
  bank keeps the price on the disabled CTA and says the shortfall in a
  refusal line, rather than replacing the label.
- While locked the CTA is disabled, so — as with the pill, which showed only
  once the door was open — the charter page (its meter, what the road is)
  is not reachable before the door opens. The card carries the two counts;
  say if the locked page should be a tap away.
