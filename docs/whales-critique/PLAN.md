# Fieldwatch UI plan — from the Whales critique

Branch `claude/whales-ui-critique-plan` · base `main @ f3760d1` · Whales project **Tower Defense Game**

Whales critiqued 11 screens captured from one full run (menu → hero pick → run map → battle → spoils → merchant → defeat) on phone (390×844) and desk (1440×900). This file turns those findings into 16 changes. **Nothing here is implemented yet.** Each item waits for the designer to approve, edit or reject it on the review page. That page is built from `index.html`, `plan.json` and `critiques.json` in this folder.

> Whales inferred every goal below from its own reading of the screen (goal_source: inferred); none was stated by the designer yet.

## Plan

### Readability

Text that fails WCAG AA contrast, mostly caused by dimming with opacity.

#### R1 · Replace opacity dimming with AA-safe dim colours

*Effort M · from Whales*

**What Whales found**

- Run map #2: **Readiness stats are hard to read at a glance**. "GEAR" #a18a6b on #4c4132 = 3.0:1, "64 DPS" #9d8769 on #48382a = 3.3:1, "HAND" #b19c7d on #534736 = 3.4:1, +9 more failing
- Battle setup (first deploy) #2: **Tutorial instruction text sits below readable contrast**. "PLACE IT" bottom-left 4.3:1, "recruit a hero" bottom-center 4.4:1, icon glyph mid-left #514c3a on #5a5a39 = 1.2:1
- Wave in progress #4: **Three status labels sit below the readable contrast line**. "recruit a hero" bottom-center at #ab9679 on #3d3225 = 4.4:1; "DEPLOYED" bottom-left 4.5:1; "SPEED" bottom-right 4.5:1
- Wave cleared #3: **Roster and status labels fall below readable contrast**. icon-like glyphs middle-right at 1.1:1 (#332a20 on #2d2619), "recruit a hero" and "DEPLOYED" both 4.4:1
- Main menu (desk) #1: **Menu column labels are too dim to scan**. "2026-09-29" at 2.8:1, "Watchtower" at 3.9:1, "Settings" at 4.2:1, +1 more, all middle-right, AA needs 4.5:1

**Proposed change**

- Add dim text tokens to global.css (for example --text-dim and --muted-dim) and check each against --panel, --panel-2 and --panel-3 so small text clears 4.5:1 and large text 3:1.
- Stop fading whole elements to show state: .sh-hero.empty (opacity 0.5, the 'recruit a hero' slot), .sh-btn:disabled (0.45), .map-node.cleared and .locked glyphs (0.72). Show the state with a dashed border or a dim token instead.
- Lift the labels Whales measured: GEAR, 64 DPS, HAND, DEPLOYED, SPEED, PLACE IT, recruit a hero, and the desktop menu's date and row labels.
- Add a small test (tests/contrast.test.ts) that computes contrast for every text-token and panel-token pair, so these can't regress.

**Files:** `src/styles/global.css`, `src/styles/shell.css`, `src/styles/shell-live.css`, `src/styles/page.css`, `tests/contrast.test.ts (new)`

#### R2 · Make prices you can't afford readable

*Effort S · from Whales*

**What Whales found**

- Merchant #2: **A price is invisible against its own background**. the "80" price, middle-right, #43331f on #413424 = 1.0:1, where WCAG AA needs 3:1 at this size

**Proposed change**

- .pg-row.dim fades the price and icon to 55% opacity. Keep the row marked as unaffordable, but render the price in a readable dim colour (at least 3:1) with a short 'need 18 more' hint, instead of fading it.

**Files:** `src/styles/page.css (.pg-row.dim)`, `src/ui/shell/offers.ts`

#### R3 · Fix the desktop sidebar's faint labels and counters

*Effort S · from Whales*

**What Whales found**

- Wave in progress (desk) #3: **Sidebar labels and counters are too faint to read**. "CS 20/70" top-left #31261a on #342b1d = 1.1:1; the large "a: 4" readout 1.7:1; "HAND" top-right 2.8:1; +21 more

**Proposed change**

- Apply the R1 tokens to the desk layout's right rail (the Depth, gear and pack column heads, and their counters).
- Raise any 10px label to the 11px floor (--fs-micro).

**Files:** `src/styles/shell-wide.css`

> **My read, not Whales':** Whales read the header's 'GATE 20/20' as 'CS 20/70' and measured it at 1.1:1. The readable text is fine; the 1.1:1 is probably the header's dark ornament behind it. The rest of this row (HAND at 2.8:1, 10px labels) looks right.

### Icon legibility

Icons under Whales' 72 image px minimum (36 CSS px at 2×).

#### I1 · Set an icon size scale and scale up stand-alone icons

*Effort M · from Whales*

**What Whales found**

- Main menu #2: **Menu icons too small to recognise**. icons next to "Watchtower" 51x59, "Settings" 51x51, "Codex" 43x47 image px, +5 more, all under the 72 image px house minimum
- Main menu (desk) #4: **The icon beside "Fieldwatch" is unrecognisable**. Top-right icon measures 29x36 image px against a 72 image px house minimum
- Hero pick #4: **Perk and header icons are too small to recognise**. The two icons next to "Choose your first hero" (top-left and top-right) at 38x47 image px, an unlabelled bottom-left icon at 47x51, +8 more under the 72 image px house minimum
- Run map #3: **Roster and slot icons too small to identify**. The icon next to "BATTLE" 70x63, next to "Doyle" 64x64, next to "Open slot" 54x54 image px, plus two unlabelled icons at top-left and top-center, against a 72 image px house minimum
- Battle setup (first deploy) #3: **HUD icons are too small to recognise at a glance**. the icon next to "hi" 59x57, the icon next to "ig" top-left 57x57, an unlabelled top-right icon 36x35 image px, +9 more
- Wave in progress #5: **Four icons are too small to recognise**. Unlabelled icons top-left 57x56 and top-right 51x37, the icon next to "Sub-wave 1 of 2 held - tap a hero, then…" at 31x38, +1 more bottom-center
- Wave in progress (desk) #4: **Seven status and panel icons are too small to recognise**. icons beside "CS 20/70" at 43x58 and 31x38 image px, an unlabelled top-right icon at 44x44, +4 more, all under the 72px house minimum
- Wave cleared #4: **Icons are too small to recognise**. 7 icons under the 72 image px house minimum, including two unlabelled top-left and top-right at 57x56 and 53x45, plus the icon by "# Doyle > Lv3"
- Spoils #4: **Four icons are too small to recognise**. the icon next to "Take one. Each card says where it goes." at 51x51, two next to "Spoils" at 35x44 and 29x45 image px, +1 more; house minimum 72 image px
- Merchant #4: **Navigation and merchant icons are too small to recognise**. unlabelled top-right icon 51x51 image px, the icon next to "March on" 47x43, +3 more by "Merchant" — house minimum 72 image px
- Run lost #1: **13 icons are under the house minimum**. the icon next to "The Line Breaks" (top-left) at 41x45 image px and the icon next to "Return to the Watchtower" (bottom-left) at 47x43 image px sit well under the 72 image px house minimum, as do the icons next to "0 marks" and "Turn on Assist - Steady" (both 55 px wide) and 9 more

**Proposed change**

- Add --icon-sm 20px, --icon-md 28px and --icon-lg 36px to global.css, and use them everywhere instead of per-component sizes.
- Move stand-alone icons (menu rows, map node glyphs, the run-lost stat tiles, the Assist and Watchtower rows, empty gear slots) to --icon-lg (36 CSS px = 72 image px).
- Leave inline glyphs that sit beside a text label (gold coin, rarity pips, the Gate tower, the coach arrow) at --icon-sm. Their label already carries the meaning.
- Give the two unlabelled header icons Whales flagged a visible label or an aria-label, or remove them.

**Files:** `src/styles/global.css`, `src/styles/shell.css`, `src/styles/page.css`, `src/ui/shell/PageScreens.tsx`, `src/ui/shell/HeaderBand.tsx`

> **My read, not Whales':** Whales applies its 72 image px minimum to every icon, including glyphs that already have a text label next to them. I'd exempt those, which is the third bullet. Approve as written to keep that exemption, or use Edit to scale every icon.

### Primary actions

The one next step on each screen should be the strongest thing on it.

#### A1 · One primary button style for the next step on every screen

*Effort M · from Whales*

**What Whales found**

- Run map #1: **"March" doesn't read as the decisive action**. Back and March commit buttons styled below primary importance; "March" label #e4deca on #6f9498 = 2.5:1, below the 3:1 AA minimum at that size
- Wave in progress #2: **"Next wave" doesn't read as a primary action**. Wave control in the bottom band, meant to be primary-importance but styled well below it, and weaker than the screen's other primary messages
- Wave cleared #1: **Continue doesn't read as the main action**. the Continue button with its rewards confirmation in the footer is styled well below primary; whole screen reads as distributed focus, not concentrated
- Spoils #2: **The Take it confirm button doesn't read as the main action**. the single confirm button, one of the screen's primary messages, stands out far less than the elements around it

**Proposed change**

- The held sub-wave 'Next ▶' (.sh-command.ready) is outlined in gold, while 'Start Wave' is filled teal. Use the filled primary style for both, since each is the one thing to do next.
- March on the run map: make it the filled primary button, with Back as the quiet secondary, and fix its label contrast (Whales measured 2.5:1).
- Brighten --cta (#336e7e) slightly and add a 1px lighter top edge, so Continue, Take it and Run again stand out from the warm art without changing their colour.

**Files:** `src/styles/global.css (--cta)`, `src/styles/shell.css (.sh-btn.primary, .sh-command)`, `src/ui/shell/CommandSlot.tsx`, `src/ui/shell/DetailBand.tsx`

> **My read, not Whales':** Continue and Take it already use the filled teal button. I read Whales' 'styled well below primary' as the teal being too muted against the bright art, not as a missing style. The third bullet addresses that.

#### A2 · Merchant: make your gold the headline number

*Effort S · from Whales*

**What Whales found**

- Merchant #1: **The gold balance doesn't read as the screen's key number**. player's gold of 92 at the top, styled well below primary importance

**Proposed change**

- Enlarge the gold pill under 'Merchant' (display font, --fs-xl).
- Repeat the remaining gold on the Buy button ('Buy · 30 → 62 left'), so the budget is visible where you commit.

**Files:** `src/ui/shell/Page.tsx`, `src/styles/page.css`

### Hierarchy & headlines

Titles and panel heads that don't outrank their body text.

#### H1 · Stronger title on the main menu

*Effort S · from Whales*

**What Whales found**

- Main menu #1: **Game title and tagline don't read as the top of the page**. title and tagline block at the top, styled well below primary weight against the art scene and oversized teal "Start a Run" button
- Main menu (desk) #2: **"Fieldwatch" title reads weaker than its role**. Game title and tagline styled well below their intended secondary importance
- Main menu (desk) #3: **The intro block has no headline**. "Hold the meadow against the goblin horde" title is 16px against 14px body — near-identical

**Proposed change**

- Step the Fieldwatch wordmark up one level (--fs-display to about 40px on phone, 48px on desk) and add a light text shadow so it holds against the art.
- Keep the tagline small, but give it more space below the title so the title and tagline read as a pair.

**Files:** `src/ui/shell/PageScreens.tsx (MenuScreen)`, `src/styles/page.css (.pg-head)`, `src/styles/shell-wide.css`

#### H2 · Give panel heads a real headline (GEAR, Depth)

*Effort S · from Whales*

**What Whales found**

- Run map #4: **The GEAR panel has no headline**. "GEAR" title 21px sits below its 25px body text, so the block reads as one flat run
- Wave in progress #4: **Three status labels sit below the readable contrast line**. "recruit a hero" bottom-center at #ab9679 on #3d3225 = 4.4:1; "DEPLOYED" bottom-left 4.5:1; "SPEED" bottom-right 4.5:1

**Proposed change**

- Column heads such as GEAR and PACK are 11px uppercase, above 12–13px bodies. Keep them uppercase but raise the weight and use --text rather than --muted-2.
- The 'Depth 1/12' badge and its progress text are the same size. Make 'Depth N' the heading and the '/12' secondary.

**Files:** `src/styles/shell.css (.sh-col-head)`, `src/ui/shell/HeaderBand.tsx`

#### H3 · Hero pick: make the selected hero's stats the main content

*Effort M · from Whales*

**What Whales found**

- Hero pick #1: **The selected Fighter's stats don't read as the main content**. Fighter name and STR/DEX/INT stats in the detail panel, a primary message, styled well below primary importance
- Hero pick #2: **Focus is spread across all three options instead of the chosen one**. Screen reads as distributed focus, but the strategy calls for concentrated emphasis on the detail panel and confirm button

**Proposed change**

- Keep the three hero tiles equal and a bit smaller. Move the scale into the detail panel: the hero name at --fs-xl, and DPS, range and HP as three large stat figures instead of one sentence.
- Keep 'Choose Fighter' as the one filled button.

**Files:** `src/ui/shell/PageScreens.tsx (hero pick)`, `src/styles/page.css`

### Battle guidance

The first-deploy and sub-wave instructions lose to ambient status.

#### G1 · First deploy: spotlight the hero card

*Effort M · from Whales*

**What Whales found**

- Battle setup (first deploy) #1: **Doyle's hero card doesn't lead the guided path**. hero card meant to be primary but styled well below it; screen reads as distributed focus, not the intended concentrated funnel
- Wave in progress #1: **The hero roster the tutorial points to is the weakest thing on screen**. Doyle's deployed card and the open recruit slot, bottom band — smaller and lower-contrast than the game title with "Depth 1/12" and the depth-1 wave readout with 4 enemies left

**Proposed change**

- While the coach tip says 'Tap your hero', give the benched hero card a pulsing teal ring and a 'Tap me' label. Stop the pulse after the first tap (respect prefers-reduced-motion).
- Dim the Details button and the open recruit slot until the hero is posted.

**Files:** `src/ui/shell/Coach.tsx`, `src/ui/shell/SelectorBand.tsx`, `src/styles/shell-live.css`

#### G2 · Stronger sub-wave instruction banner

*Effort S · from Whales*

**What Whales found**

- Wave in progress #3: **The instruction banner is losing the screen to ambient status**. "Sub-wave 1 of 2 held - tap a hero, then…" over the map stands out far less than the other primary messages; focus reads distributed, not concentrated
- Wave in progress (desk) #1: **The placement instruction doesn't lead — attention spreads across the sidebar**. the banner telling players to tap a hero then a post is styled well below its primary role; focus reads as distributed, not playfield-first

**Proposed change**

- The 'Sub-wave 1 of 2 held · tap a hero, then a post' strip is thin, light text on a translucent bar. Make it a solid banner with a readable size (--fs-md) and an icon.
- On desk, show it over the field, not the sidebar.

**Files:** `src/styles/shell-live.css`, `src/styles/shell-wide.css`, `src/ui/shell/StageBand.tsx`

#### G3 · Wave cleared: end the reading order on Continue

*Effort S · from Whales*

**What Whales found**

- Wave cleared #2: **A large image sits after Continue and pulls the eye past it**. a picture 33x the button's area in the button's own hue family follows it, as it does the "8 kills - 184 dmg" stats block

**Proposed change**

- Darken the battlefield scrim behind the 'Wave cleared' card, so the card and the Continue footer are the only lit things on screen.

**Files:** `src/ui/shell/WaveCeremony.tsx`, `src/styles/shell-live.css`

> **My read, not Whales':** The 'large image after Continue' Whales flags is most likely the battlefield behind the overlay, not a separate picture. There's nothing to move, so I propose a darker scrim instead of Whales' 'move the picture above the button'.

### Layout & space

Empty space and chrome that push the decision below the fold.

#### S1 · Close the empty gap on the Spoils, Merchant and Hero pick pages

*Effort S · from Whales*

**What Whales found**

- Spoils #3: **Banners, filters and navigation crowd out the three cards**. 46% of the first screen, room for roughly 7.8 more items
- Merchant #3: **Banners, filters and nav crowd out the offers**. 29% of the first screen is chrome — about 4.9 more items could fit
- Hero pick #3: **Banners, filters and navigation crowd out the class details**. Banners, filters and navigation occupy 43% of the first screen — space for roughly 4.4 more items

**Proposed change**

- Spoils and Merchant leave about 64px of empty space between the pack strip and the list. Remove it, so the cards and the detail panel sit higher and more merchant offers fit above the fold.
- Keep the title and subtitle; there are no filter rows to cut.

**Files:** `src/ui/shell/Page.tsx`, `src/styles/page.css`

> **My read, not Whales':** Whales says 'banners, filters and navigation' take 29–46% of these screens. There are no filters. The real waste is the empty gap under the pack strip, which is what this item removes.

#### S2 · Merchant: stop the last offer hiding under 'March on'

*Effort S · from Claude*

**Proposed change**

- In the capture, a 7th offer row peeks out behind the 'March on' row. Give the offer list its own scroll area with a fade, or move 'March on' into the footer next to Buy.

**Files:** `src/ui/shell/Page.tsx`, `src/styles/page.css`

> **My read, not Whales':** This one is mine, not Whales'. I spotted it in the screenshot.

#### D1 · Dark art flags: no change

*Effort S · from Whales*

**What Whales found**

- Hero pick #5: **Confirm whether the dark Fighter artwork is intentional**. The Fighter name and stats area is dark enough that faces or subjects may be hard to make out; may be a deliberate style
- Battle setup (first deploy) #5: **Confirm whether Doyle's dark portrait is intentional**. the hero card art is dark enough that the character may be hard to make out
- Wave in progress (desk) #5: **Confirm the dark hero roster art is intentional**. roster panel art for Doyle (Fighter 1, deployed) and the open recruit slot is dark enough that subjects may be hard to make out
- Wave cleared #5: **Confirm whether the dark roster art is intentional**. the Doyle (Fighter, Lv3, deployed) and open-recruit-slot roster is dark enough that faces may be hard to make out
- Spoils #5: **Confirm whether the dark card art is intentional**. the selected Bloodletting epic relic and the rare Piercing Bow are both dark enough that subjects may be hard to make out
- Merchant #5: **Confirm whether the dark item art is intentional**. six offer images incl. Executioner Greatsword of F, Frost Axe, Buckler dark enough that subjects may be hard to make out

**Proposed change**

- Whales asks on six screens whether the hero and item art is too dark. The pixel art is Tiny Swords at full brightness, and the portraits sit on bright orange tiles. I recommend no change unless you see a problem on a device.

> **My read, not Whales':** I think these are false positives from the dark UI panels around the art. Reject this item if you do want the art brightened.

### Verify

Re-capture and re-critique after the fixes land.

#### V1 · Commit the flow-capture script and re-critique after the fixes

*Effort S · from Claude*

**Proposed change**

- Add scripts/flow-shots.mjs, the Playwright script that played this run (menu → hero → map → battle → spoils → merchant → defeat) on phone and desk.
- After the fixes, re-capture and re-run Whales on every screen. Re-run the two reports that were cut off (both battle screens) and the run-lost screen on a real defeat.
- Add a line to docs/DESIGN_REVIEW.md's log.

**Files:** `scripts/flow-shots.mjs (new)`, `docs/DESIGN_REVIEW.md`

## Whales critiques (verbatim)

### Main menu · mobile 390×844

![Main menu](shots/mobile-01-menu.jpg)

Critique id `4793a732-c544-4991-a827-6cfe86efdb00` · goal (inferred): "establish game tone and direct returning players to start playing"

Fieldwatch's title screen sets tone and points returning players to "Start a Run". The title and tagline are styled too quietly to carry that tone, and the menu icons are too small to read at a glance.

| # | Problem | What to do | Why |
|---|---|---|---|
| 1 | **Game title and tagline don't read as the top of the page**<br>title and tagline block at the top, styled well below primary weight against the art scene and oversized teal "Start a Run" button | Raise the title's size, weight and contrast so it clearly outranks the menu rows below | Tone is sold in the top half; a quiet title leaves the screen to do that job alone |
| 2 | **Menu icons too small to recognise**<br>icons next to "Watchtower" 51x59, "Settings" 51x51, "Codex" 43x47 image px, +5 more, all under the 72 image px house minimum | Make menu icons noticeably larger, or drop them and let the labels carry the rows | Returning players scan for "Daily Watch" and "Codex"; unreadable glyphs slow that scan |

### Main menu · desktop 1440×900

![Main menu](shots/desktop-01-menu.jpg)

Critique id `55b6915a-63a1-4066-8b14-04654f0eeb26` · goal (inferred): "get players into a run quickly from the main menu"

Fieldwatch's main menu sells the game with a looping preview while funnelling every choice into one right-hand column ending in "Start a Run". The column's labels sit below WCAG AA contrast, the title is underweighted, and its intro block has no headline.

| # | Problem | What to do | Why |
|---|---|---|---|
| 1 | **Menu column labels are too dim to scan**<br>"2026-09-29" at 2.8:1, "Watchtower" at 3.9:1, "Settings" at 4.2:1, +1 more, all middle-right, AA needs 4.5:1 | Lighten the text colours (#c79945, #cec1ac, #cec2ac, #c69844) until each clears 4.5:1 on its brown | Every mode and meta choice lives in this column; dim labels slow the path into a run |
| 2 | **"Fieldwatch" title reads weaker than its role**<br>Game title and tagline styled well below their intended secondary importance | Raise the title's size, weight or contrast so it clearly outranks the small mode rows | — |
| 3 | **The intro block has no headline**<br>"Hold the meadow against the goblin horde" title is 16px against 14px body — near-identical | Push the title up in size and weight so it leads the block instead of blending into body copy | A flat block gives players nothing to land on before they hit "Start a Run" |
| 4 | **The icon beside "Fieldwatch" is unrecognisable**<br>Top-right icon measures 29x36 image px against a 72 image px house minimum | Make the icon noticeably larger, or drop it if the title carries the branding alone | An illegible mark adds noise to a column that should read instantly |

### Hero pick · mobile 390×844

![Hero pick](shots/mobile-02-hero-pick.jpg)

Critique id `6ca85703-8474-40fe-9695-dc2559d46bf9` · goal (inferred): "let user select and confirm a starting hero class"

This screen lets a player compare three hero classes and commit to one. The Fighter name and stats the choice rests on are styled too lightly, so all three options read as equal, and banners, filters and navigation eat 43% of the first screen.

| # | Problem | What to do | Why |
|---|---|---|---|
| 1 | **The selected Fighter's stats don't read as the main content**<br>Fighter name and STR/DEX/INT stats in the detail panel, a primary message, styled well below primary importance | Raise the Fighter name and stat values in size and weight until they clearly outrank the three option tiles | The stat readout is what justifies the pick; if it reads as secondary, there is nothing to decide on |
| 2 | **Focus is spread across all three options instead of the chosen one**<br>Screen reads as distributed focus, but the strategy calls for concentrated emphasis on the detail panel and confirm button | Keep the three option tiles small and equal, and push contrast and scale into the detail panel plus confirm button | Compare-then-commit only works if the selected class visibly dominates the two alternatives |
| 3 | **Banners, filters and navigation crowd out the class details**<br>Banners, filters and navigation occupy 43% of the first screen — space for roughly 4.4 more items | Trim or collapse the banner and filter rows so the detail panel and confirm button sit higher | First-screen space should go to the class the player is evaluating, not surrounding chrome |
| 4 | **Perk and header icons are too small to recognise**<br>The two icons next to "Choose your first hero" (top-left and top-right) at 38x47 image px, an unlabelled bottom-left icon at 47x51, +8 more under the 72 image px house minimum | Make these icons noticeably larger, or pair them with text labels where space is tight | Unreadable perk and header icons remove the visual shorthand players use to weigh one class against another |
| 5 | **Confirm whether the dark Fighter artwork is intentional**<br>The Fighter name and stats area is dark enough that faces or subjects may be hard to make out; may be a deliberate style | Check on a real device; if unintended, lift exposure or add a scrim behind the name and stats | A murky hero image weakens the case for the class the screen is asking the player to commit to |

### Run map · mobile 390×844

![Run map](shots/mobile-03-run-map.jpg)

Critique id `925344e3-64b1-455a-a940-e2750ec80dbc` · goal (inferred): "let players evaluate their next move and party readiness before committing to a path"

Players use this screen to weigh the next map node against party readiness before committing to a path. But the March commit button is styled below primary importance, and the readiness labels it depends on — GEAR, DPS, equipment slots — sit at contrast levels that fail WCAG AA.

| # | Problem | What to do | Why |
|---|---|---|---|
| 1 | **"March" doesn't read as the decisive action**<br>Back and March commit buttons styled below primary importance; "March" label #e4deca on #6f9498 = 2.5:1, below the 3:1 AA minimum at that size | Give March a stronger fill and weight than Back, and raise its label past 3:1 | The whole screen builds toward committing to a path; that step should be the clearest thing on it |
| 2 | **Readiness stats are hard to read at a glance**<br>"GEAR" #a18a6b on #4c4132 = 3.0:1, "64 DPS" #9d8769 on #48382a = 3.3:1, "HAND" #b19c7d on #534736 = 3.4:1, +9 more failing | Lighten these label colours or darken their panels to reach 4.5:1 | Players cross-reference DPS and gear against encounter difficulty; unreadable numbers break that comparison |
| 3 | **Roster and slot icons too small to identify**<br>The icon next to "BATTLE" 70x63, next to "Doyle" 64x64, next to "Open slot" 54x54 image px, plus two unlabelled icons at top-left and top-center, against a 72 image px house minimum | Make these icons noticeably larger, especially the unlabelled ones | Encounter type and empty gear slots are read by icon, not text, when scanning readiness |
| 4 | **The GEAR panel has no headline**<br>"GEAR" title 21px sits below its 25px body text, so the block reads as one flat run | Make the GEAR title clearly larger or heavier than its body text | Support panels need scannable entry points when five blocks compete on one surface |

### Battle setup (first deploy) · mobile 390×844

![Battle setup (first deploy)](shots/mobile-04-battle-setup.jpg)

Critique id `12054830-f867-42bb-8b0e-be930d2d401a` · goal (inferred): "guide new players through their first hero deployment without distraction"

The screen sets up a first hero placement before the wave starts. But the hero card the tutorial points to is under-styled, attention spreads instead of funnelling, and the instruction text and HUD icons fall below readable contrast and size.

| # | Problem | What to do | Why |
|---|---|---|---|
| 1 | **Doyle's hero card doesn't lead the guided path**<br>hero card meant to be primary but styled well below it; screen reads as distributed focus, not the intended concentrated funnel | Make the hero card the loudest element — stronger glow, larger frame — and quiet the rest of the HUD | The first deployment depends on players spotting the hero to move into the glowing slot |
| 2 | **Tutorial instruction text sits below readable contrast**<br>"PLACE IT" bottom-left 4.3:1, "recruit a hero" bottom-center 4.4:1, icon glyph mid-left #514c3a on #5a5a39 = 1.2:1 | Lift all three to 4.5:1 or better — lighten #c59744 and #ab9679, or darken the #483726 and #3d3225 panels | The banner is the only instruction a first-time player has for the hero→slot step |
| 3 | **HUD icons are too small to recognise at a glance**<br>the icon next to "hi" 59x57, the icon next to "ig" top-left 57x57, an unlabelled top-right icon 36x35 image px, +9 more | Scale these icons up noticeably, past the 72 image px house minimum, or pair them with text labels | Unreadable HUD glyphs pull attention away from the single guided route |
| 4 | **Smallest labels fall under the house minimum size**<br>"ig" center and one unlabelled glyph, center, both 10 image px against an 11px house minimum | Raise both above the 11px house minimum, or drop them if they carry no onboarding information | — |
| 5 | **Confirm whether Doyle's dark portrait is intentional**<br>the hero card art is dark enough that the character may be hard to make out | If unintended, brighten the portrait or add a rim light so the hero reads clearly | Players are being asked to find and place this specific hero |

**Also noticed**

- Banners, filters and navigation occupy 69% of the first screen, leaving room for roughly 5.4 more items — expected for stripped-back onboarding, but worth confirming the chrome is all earning its place.

### Wave in progress · mobile 390×844

![Wave in progress](shots/mobile-05-wave-in-progress.jpg)

Critique id `eedbbabb-1011-47a7-901b-e40778c61b5d` · goal (inferred): "guide new players through active tower-defense battles with clear next actions"

An active tower-defense battle meant to walk new players through one tap sequence. The pieces that sequence depends on — the hero roster, the instruction banner, "Next wave" — are outweighed by ambient status readouts, and small icons plus low-contrast labels add strain.

| # | Problem | What to do | Why |
|---|---|---|---|
| 1 | **The hero roster the tutorial points to is the weakest thing on screen**<br>Doyle's deployed card and the open recruit slot, bottom band — smaller and lower-contrast than the game title with "Depth 1/12" and the depth-1 wave readout with 4 enemies left | Raise the roster cards' size and contrast above the top status readouts; quiet the title and depth block | The instruction tells a new player to tap a hero first, so the roster must be the loudest control |
| 2 | **"Next wave" doesn't read as a primary action**<br>Wave control in the bottom band, meant to be primary-importance but styled well below it, and weaker than the screen's other primary messages | Give it a filled, high-contrast primary button treatment, larger than the surrounding roster chrome | It closes the tutorial's tap sequence; a new player needs to see where the turn ends |
| 3 | **The instruction banner is losing the screen to ambient status**<br>"Sub-wave 1 of 2 held - tap a hero, then…" over the map stands out far less than the other primary messages; focus reads distributed, not concentrated | Strengthen the banner's contrast and size, and mute the resource and wave readouts around it | The banner is the only place a new player is told what to do next |
| 4 | **Three status labels sit below the readable contrast line**<br>"recruit a hero" bottom-center at #ab9679 on #3d3225 = 4.4:1; "DEPLOYED" bottom-left 4.5:1; "SPEED" bottom-right 4.5:1 | Lighten each label until it clears 4.5:1 against its panel — aim nearer 7:1 for the small sizes | These labels explain hero state and controls mid-battle, when reading time is short |
| 5 | **Four icons are too small to recognise**<br>Unlabelled icons top-left 57x56 and top-right 51x37, the icon next to "Sub-wave 1 of 2 held - tap a hero, then…" at 31x38, +1 more bottom-center | Make all four noticeably larger than the house minimum, or pair them with text labels | The banner icon carries the screen's main instruction; the others are unlabelled status |

**Also noticed**

- Confirm whether the dark treatment of Doyle's card and the open recruit slot is a deliberate style — subjects may be hard to make out.
- The "Depth 1/12" title and its body text are both 26px, so the block reads without a headline.

_Note: Whales' report was cut off at its token limit after these rows; the rest of "Also noticed" is missing. Re-run to regenerate._

### Wave in progress · desktop 1440×900

![Wave in progress](shots/desktop-05-wave-in-progress.jpg)

Critique id `e062149a-2159-4b73-8a1b-9fbd2658bf44` · goal (inferred): "keep the player focused on the playfield while keeping reference data glanceable during hero placement"

This is the placement phase of a tower-defense battle: an open playfield on the left, reference panels on the right. The instruction that drives placement is styled too quietly to lead, the page heading is clipped away, and 24 text elements plus seven icons fall below readable contrast and size.

| # | Problem | What to do | Why |
|---|---|---|---|
| 1 | **The placement instruction doesn't lead — attention spreads across the sidebar**<br>the banner telling players to tap a hero then a post is styled well below its primary role; focus reads as distributed, not playfield-first | Raise its size, weight and contrast above every sidebar panel, and quiet the right rail further | Placement depends on players reading the one-move instruction before tapping a hero onto a post |
| 2 | **The page heading is cut off at the top**<br>large heading at the top of the content clipped to glyph fragments — nothing on screen states what the page is | Reveal the full heading inside the content area, or add a visible battle/phase title | Players have no on-screen confirmation of which battle or phase they are placing heroes in |
| 3 | **Sidebar labels and counters are too faint to read**<br>"CS 20/70" top-left #31261a on #342b1d = 1.1:1; the large "a: 4" readout 1.7:1; "HAND" top-right 2.8:1; +21 more | Lighten text or darken panels to 4.5:1 (3:1 for the large readout); lift 10px labels to the 11px house minimum | Reference data only works if it is glanceable; at 1.1:1 these values are effectively invisible |
| 4 | **Seven status and panel icons are too small to recognise**<br>icons beside "CS 20/70" at 43x58 and 31x38 image px, an unlabelled top-right icon at 44x44, +4 more, all under the 72px house minimum | Make these noticeably larger, or pair each with a text label | Wave, gear and inventory icons are reference cues the player must decode without leaving the playfield |
| 5 | **Confirm the dark hero roster art is intentional**<br>roster panel art for Doyle (Fighter 1, deployed) and the open recruit slot is dark enough that subjects may be hard to make out | Check against the intended art direction; if unintended, lighten the art or raise contrast against the panel | Players choose which hero to place from this panel, so the portraits need to be identifiable |

**Also noticed**

- Banners, filters and navigation occupy 98% of the first screen, leaving room for roughly 7.4 more items.

_Note: Whales' report was cut off at its token limit; the rest of "Also noticed" is missing. Re-run to regenerate._

### Wave cleared · mobile 390×844

![Wave cleared](shots/mobile-06-wave-cleared.jpg)

Critique id `86181611-6851-49a8-abe9-9561f6e82760` · goal (inferred): "display wave-clear outcome and rewards while presenting the hero roster and funneling the player to continue"

The screen delivers a wave-clear payoff and pushes the player to continue. But the Continue button and its rewards confirmation are styled well below primary and sit before a large image that pulls the eye past them, and several labels and icons fall under readable thresholds.

| # | Problem | What to do | Why |
|---|---|---|---|
| 1 | **Continue doesn't read as the main action**<br>the Continue button with its rewards confirmation in the footer is styled well below primary; whole screen reads as distributed focus, not concentrated | Raise the button to full primary styling so it and the centered reward panel clearly outrank map and roster | The screen's job is to funnel the player onward; the exit is currently one voice among many |
| 2 | **A large image sits after Continue and pulls the eye past it**<br>a picture 33x the button's area in the button's own hue family follows it, as it does the "8 kills - 184 dmg" stats block | Move the picture above the button so the button ends the block — don't just shrink it | Reading order should finish on the action, not drift into decorative art after it |
| 3 | **Roster and status labels fall below readable contrast**<br>icon-like glyphs middle-right at 1.1:1 (#332a20 on #2d2619), "recruit a hero" and "DEPLOYED" both 4.4:1 | Lighten to at least 4.5:1; take the middle-right glyphs to 3:1 or above | "recruit a hero" is the progression hook the earned gold pays for and it is the hardest label to read |
| 4 | **Icons are too small to recognise**<br>7 icons under the 72 image px house minimum, including two unlabelled top-left and top-right at 57x56 and 53x45, plus the icon by "# Doyle > Lv3" | Make these noticeably larger, and label or drop the unlabelled top-corner ones | Hero and level icons carry roster meaning the player is being asked to act on |
| 5 | **Confirm whether the dark roster art is intentional**<br>the Doyle (Fighter, Lv3, deployed) and open-recruit-slot roster is dark enough that faces may be hard to make out | Check against the intended art direction; brighten the card art if legibility matters more than mood | The roster is meant to sell the recruit hook, which needs a visible hero |

**Also noticed**

- Banners, filters and navigation consume 34% of the first screen — roughly 2.7 more items' worth of room.

### Spoils · mobile 390×844

![Spoils](shots/mobile-07-spoils.jpg)

Critique id `e2564d10-76bf-45bc-98b4-6626759e73ab` · goal (inferred): "let players make informed tradeoff decisions when selecting post-battle rewards"

This screen asks players to weigh three mutually exclusive loot cards and commit to one. Right now the Piercing Bow option reads as weaker than its peers, the confirm button barely registers, and banners, filters and navigation eat 46% of the first screen.

| # | Problem | What to do | Why |
|---|---|---|---|
| 1 | **The Piercing Bow card reads as a lesser option, not a peer**<br>the rare Piercing Bow card that goes to the pack, styled well below the primary importance it should carry next to the other two | Match its card treatment to the other options; reserve extra weight for the selected card only | Players can only judge a tradeoff if all three rewards read as equal-weight choices |
| 2 | **The Take it confirm button doesn't read as the main action**<br>the single confirm button, one of the screen's primary messages, stands out far less than the elements around it | Give it a filled, higher-contrast treatment and more visual weight than any card element | It's the only way to commit once the player has settled the power-versus-cost call |
| 3 | **Banners, filters and navigation crowd out the three cards**<br>46% of the first screen, room for roughly 7.8 more items | Trim banner and filter height so all three cards and the detail panel sit above the fold | Comparison breaks down if stats, destination and the downside line need scrolling |
| 4 | **Four icons are too small to recognise**<br>the icon next to "Take one. Each card says where it goes." at 51x51, two next to "Spoils" at 35x44 and 29x45 image px, +1 more; house minimum 72 image px | Scale these icons up noticeably, or pair each with a text label so meaning doesn't rest on the glyph | Destination and rarity cues are part of the information the tradeoff depends on |
| 5 | **Confirm whether the dark card art is intentional**<br>the selected Bloodletting epic relic and the rare Piercing Bow are both dark enough that subjects may be hard to make out | Confirm this is a deliberate style; if not, lift image brightness until subjects read clearly | Art is the fastest way players tell the three options apart at a glance |

### Merchant · mobile 390×844

![Merchant](shots/mobile-08-merchant.jpg)

Critique id `0e89777d-7cda-43ca-a850-5a4ecb886d50` · goal (inferred): "let the player purchase items from a shop by choosing from available offers within their gold budget"

Shop screen where players weigh priced offers against their gold and buy. The gold balance that drives every decision is underplayed, one price is effectively invisible, and top chrome eats space the offer list needs.

| # | Problem | What to do | Why |
|---|---|---|---|
| 1 | **The gold balance doesn't read as the screen's key number**<br>player's gold of 92 at the top, styled well below primary importance | Increase its size and weight so it clearly outranks the offer list as the screen's status line | Every buy decision is a comparison against the remaining budget |
| 2 | **A price is invisible against its own background**<br>the "80" price, middle-right, #43331f on #413424 = 1.0:1, where WCAG AA needs 3:1 at this size | Lighten the number until it reaches at least 3:1 against #413424 | A player can't judge affordability on an offer whose price can't be read |
| 3 | **Banners, filters and nav crowd out the offers**<br>29% of the first screen is chrome — about 4.9 more items could fit | Shrink or collapse the top banner and filter row so more offers sit above the fold | Shops work by comparison; more visible offers means less scrolling to weigh prices |
| 4 | **Navigation and merchant icons are too small to recognise**<br>unlabelled top-right icon 51x51 image px, the icon next to "March on" 47x43, +3 more by "Merchant" — house minimum 72 image px | Make these icons noticeably larger, or pair them with visible text labels | These are how players identify the vendor and exit the shop |
| 5 | **Confirm whether the dark item art is intentional**<br>six offer images incl. Executioner Greatsword of F, Frost Axe, Buckler dark enough that subjects may be hard to make out | Confirm the style is deliberate; if not, raise brightness on the item art | Players scan offers by recognising the item before reading its price |

### Run lost · mobile 390×844

![Run lost](shots/mobile-09-run-lost.jpg)

Critique id `bd47f544-f126-4dfd-b4cf-1e7545879ed6` · goal (inferred): "soften permadeath failure by providing meaningful post-mortem and stats recap, then encourage immediate retry"

Whales could not write the full critique for this screen: it lacked measurements for its two main findings (an underweighted headline and distributed focus). It gave one well-evidenced finding.

| # | Problem | What to do | Why |
|---|---|---|---|
| 1 | **13 icons are under the house minimum**<br>the icon next to "The Line Breaks" (top-left) at 41x45 image px and the icon next to "Return to the Watchtower" (bottom-left) at 47x43 image px sit well under the 72 image px house minimum, as do the icons next to "0 marks" and "Turn on Assist - Steady" (both 55 px wide) and 9 more | Scale the whole icon set up noticeably and keep the sizes consistent across the recap and the action rows | Those icons mark the stats recap and the two exits (Assist, Watchtower), so the moment meant to make the loss legible and route players into a retry is carried by marks too small to recognise |

_Note: Partial critique. This defeat was forced (Gate HP set to 1 mid-battle), so "0 stops" and "1 Gate in one" come from that shortcut. Re-run on a real loss._
