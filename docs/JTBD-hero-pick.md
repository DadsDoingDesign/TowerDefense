# Hero pick: jobs to be done (H3-2)

For the designer to mark up. Your note on H3 was "yeah this whole screen needs
a jobs to be done exercise". This is that exercise. It ends with three layout
directions, all of them built into the game so you can try them before choosing.

**Try them:** start the dev server and add a query parameter, then Menu → Start a Run.

| Direction | URL |
|---|---|
| Today's screen | `/` (no parameter, unchanged) |
| A · Play-style cards | `/?heropick=cards` |
| B · Compare | `/?heropick=compare` |
| C · Recommended | `/?heropick=recommend` |

The parameter works on a preview deploy as well (like `?art=`). Nothing saves
it, and a player can't reach it by accident. Each variant uses the real store
actions, sprites, page skeleton, Vow picker and seed field, so choosing a hero
there starts the run exactly as today's button does.

**Working assumption.** The primary hirer is a **brand-new player on their
first run**. Returning players and Daily Watch players are secondary. This is
open question 1 at the end. If you change it, the recommendation in §6 changes too.

---

## 0. What the screen gives a first-time player today

Numbers are level 1 with no Watchtower perks. They come from `computeCombat`
on the same preview hero the screen builds.

| | Fighter | Rogue | Mystic |
|---|--:|--:|--:|
| Damage per second | 42 | 60 | 22 (splash, magic) |
| Reach | 96 | 168 | 150 |
| Health | 178 | 124 | 106 |
| Attacks per second | 1.1 | 2.6 | 0.9 |
| Crit | 7% for ×1.5 | 33% for ×2.0 | 7% for ×1.5 |
| Stops enemies | up to 2 | no | no |
| Armour / thorns | 20 / 8 | 0 / 2 | 0 / 2 |
| Opening weapon (dealt after the pick) | Common | Common | **Epic** |
| Grows into at level 10 | Warrior, Knight, Guard | Assassin, Trickster, Marksman | Elementalist, Cleric, Warlock |
| First-run stops cleared (`balance/REPORT.md` §11) | 9.4 | 9.2 | 9.6 |

The last row matters most. **On a first run there is no wrong pick by
strength.** The Mystic has the smallest damage number on the screen by a factor
of three, yet its first runs go furthest. Its splash and its Epic opening weapon
explain why, and the screen shows neither.

What today's screen shows (screenshots `today-phone.png`, `today-desk.png`):

1. **Two of the three heroes have no visible name.** The portrait row names
   only the selected one. The others are named only for a screen reader. To
   learn what the green one is, you have to tap it.
2. **STR / DEX / INT is the loudest number row**, and nothing on the screen says
   what those numbers do.
3. **The sentence that says how the hero fights** ("Blocks up to 2 enemies at
   close range.") is 13px. The two lines under it use terms the screen never
   explains: *patience*, *thorns*, *×1.5*.
4. **Comparing means tapping and remembering.** Only one hero's facts are on
   screen at a time.
5. **Nothing says where to post the hero**, which is the next decision the game
   asks for. The first Coach tip on the next screen is "Tap your hero, then a
   glowing circle". A Fighter with 96 reach on a circle far from the path does
   nothing.
6. **The numbers leave out the opening kit.** The kit is dealt after the pick
   (`engine/kit.ts`), so the Mystic's Epic weapon never appears.
7. **The seed card sits between the hero and the button** on a random run. It
   is there for a different hirer (§2).
8. **Three large tiles repeat what the text above them says**, at 16px icon size
   inside 186px parchment squares. On desk they fill a third of the column.
9. **Daily Watch friction (pre-existing, not changed here):** the Vow chips show
   on a Daily Watch, but `setRunBanner` refuses a Vow there, so tapping one does
   nothing. The seed field also lets a Daily player type a seed, which quietly
   turns the run into a custom-seed run (`reseedRun`).

---

## 1. The job

> **When I start a run, I want to pick a hero whose way of fighting I understand,
> so I can plan my first battles and feel it was my choice.**

The job has three parts, and each needs something different from the screen:

- **Functional: understand and plan.** How does this hero kill things? Where
  do I put it? What will the first fight look like?
- **Emotional: my choice.** I weighed it, I picked it, and I don't feel I
  guessed. If the run goes badly, I don't blame the screen.
- **Social (Daily Watch only).** Everyone plays the same seed today, so my pick
  is part of how my score compares.

The steps a player walks through on this screen:

1. See what the options are.
2. Understand how each one fights.
3. Compare them.
4. Decide.
5. Confirm.
6. On the next screen: post the hero on a circle, which is where the plan is tested.

Today's screen supports steps 4 and 5 well: one pinned button that names the
hero. It is thin on steps 1 to 3 and says nothing about step 6.

---

## 2. Who hires this screen

| Hirer | How to recognise them in the game | What they need here | What they don't need |
|---|---|---|---|
| **First run** (primary) | `stats.runsCompleted === 0`, no Vow unlocked (the picker renders nothing) | What each hero does, in words and motion. Where to post it. Reassurance that one hero isn't all-in ("Recruit more along the road" already says this). | Seed, STR/DEX/INT, the evolution tree in full |
| **Returning player** | `runsCompleted > 0`; the Vow picker appears from `sacrificeTier ≥ 1` | Speed. Which *line* the hero opens (what it grows into). The Vow. The starter feats: winning with each starter unlocks a specialization (`win_fighter` unlocks Warden of Ash), and hero pick never mentions this. | Being taught what a Fighter is again |
| **Daily Watch player** | `challenge.kind === 'daily'` | To know this commit spends today's **scored** attempt (`pickStartingHero` claims it). Standard rules, so no Vow. The seed shown as today's, not as a field to change. | A seed field that leaves the Daily, and Vow chips that do nothing |

---

## 3. Forces

**Push (what brings them here):** they just pressed Start a Run, or opened
today's Daily. They want to play, and this screen stands between them and the
field.

**Pull (what a good choice promises):**
- a hero whose fighting they can picture before the first wave
- a plan: where it goes, what it stops, what gets past it
- for returning players, a strategy: the line it grows into, or a feat to chase

**Anxiety (what makes them hesitate or regret):**
- "Is this permanent? Is it my whole army?" The copy answers this; it is short
  and it works.
- Terms they don't know (patience, thorns, ×1.5, STR/DEX/INT).
- A number that looks like a trap. The Mystic's 22 DPS reads as "weakest", and
  that is false (§0).
- Daily: committing uses up today's scored attempt, and the screen says so only
  in a small grey line inside the seed card.

**Habit (what they'd do anyway):**
- **Take the default.** The Fighter is preselected and the button already says
  "Choose Fighter", so one tap starts the run without reading anything. For a
  first-timer, this is the most likely path.
- Pick the one with the best-looking sprite or the familiar class word.
- Returning players pick what they picked last time.

---

## 4. What success looks like

The game has no analytics (nothing is sent anywhere), so each signal below says
how it could be observed: in a playtest, or with a local counter.

| Signal | Why it shows the job is done | How to observe it |
|---|---|---|
| **First-run players look at more than the default** before choosing (a tap on another hero, or a comparison view) | The choice was made rather than defaulted: the "my choice" half | Local counter on hero-pick taps. Playtest observation. |
| **They can say where the hero goes** when asked right after picking ("beside the path" / "can stand back") | They understood how it fights well enough to plan | Playtest question. Its answer is the variant's own place line, so it can be scored. |
| **First posting covers the path**: the hero's reach touches the path from the circle chosen in battle 1 | The plan survived contact with the field | The engine knows slot positions and reach, so coverage at the first deploy can be computed |
| **Pick spread on first runs doesn't collapse to the default** | The default isn't doing the choosing | `feats.starter` is already recorded per run. Aggregate it locally or in a playtest. |
| **No early quit after a pick** (`returnToHub` within the first two stops) | No "I chose wrong" regret | Local counter |
| **Daily: zero accidental leaves** (reseed from a Daily) and players can say "this counts" before committing | The social half, without anxiety | Playtest. Count reseeds from `kind === 'daily'`. |
| **All three heroes are named without a tap**, including by a screen reader | Step 1 of the job is met for everyone | Checklist |

---

## 5. Three directions

All three share these changes, each of which comes straight from §0 to §3:

- **Every hero is named on screen**, not only the selected one.
- **"How it fights" is one plain sentence**, built from the numbers rather than
  written by hand (`heroPickFacts.ts` → `playStyle`). If the tree changes, the
  sentence changes with it. `tests/heroPickFacts.test.ts` pins each sentence to
  the data, the same rule H11 set for today's tiles.
- **Where to post it** is one line, built from reach, block and splash
  (`placeHint`), using the glossary's words (*circle*, *path*).
- **STR / DEX / INT is gone** from this screen. The three big numbers are
  **damage/s, reach and health**, the three that decide a first battle. A
  splash hero's damage is labelled *area dmg/s*, so the Mystic's number stops
  reading as weakness.
- **The opening kit is named**, so the Mystic's Epic weapon is visible before the pick.
- **The seed folds behind one row on a random run.** On a Daily Watch or a
  custom seed, that player is there *for* the seed, so the card stays open.
  The Vow picker is unchanged.
- **The attack preview is the hero's real battle animation**: the same idle and
  attack strips `render/units.ts` plays on the field, with the frame counts from
  `render/anim.ts`. One attack plays per real attack interval, so a Rogue's bow
  visibly snaps 2.6 times a second and a Mystic's cast takes over a second. It is
  drawn at 1 CSS px per sprite px, pixelated. It becomes a still frame under
  reduced motion (the setting, which follows the OS). *Not drawn:* the
  projectile, the target and the splash ring. Those belong to the battle
  renderer, and a menu copy of them would drift.

### A · Play-style cards (`?heropick=cards`)

All three heroes are on screen as stacked cards. Each card has the looping
sprite, the name, one sentence on how it fights, and three big numbers. The
selected card plays its attack while the others idle. Under the list, a plan
card for the selected hero says where to post it, what it grows into and what
it starts wearing. On desk the cards sit side by side.

Screenshots: `cards-phone.png`, `cards-phone-scrolled.png`, `cards-desk.png`, `cards-phone-returning-scrolled.png`.

### B · Compare (`?heropick=compare`)

One column per hero and one row per question: damage/s, what it hits, reach,
whether it stops enemies, health, attacks/s, crit, damage type, opening weapon,
what it grows into. Numbers get a bar scaled to the best of the three. *Kinds*
("one enemy" vs "everything near the target", "up to 2" vs "no") stay words,
because a bar would rank things that are only different, not better or worse.
The Hits row sits directly under damage so the Mystic's small bar is read with
its reason. Tapping a sprite selects that column. The hero names pin to the
top while the rows scroll. Under the table, a summary card says how the
selected hero fights and where to post it. On a phone the columns are too
narrow for the Fighter's 130px swing, so they idle there. On desk the selected
column plays its attack.

Screenshots: `compare-phone.png`, `compare-phone-scrolled.png`, `compare-desk.png`, `compare-phone-daily.png`, `compare-phone-daily-scrolled.png`.

### C · Recommended (`?heropick=recommend`)

The screen opens on one suggestion in a large card: "Recommended for your first
run", the looping attack, the sentence, **the reason**, the three numbers and
where to post it. Below it: "Or lead with", with the other two as rows showing
their own sentence. Tapping a row swaps it into the large card, and the
*Recommended* tag stays on the suggested hero wherever it is.

The reason is a claim about **forgiveness, not strength**, because §0 shows no
hero is stronger on a first run. The default rule is "longest reach, ties to
damage per second", which picks the Rogue: *"It reaches farthest of the three
(168) and deals the most damage per second (60), so where you post it matters
least. All three can win."* The numbers in that sentence come from the data.
After a first run, the label changes to "The most forgiving to place" and the
reason stays.

Screenshots: `recommend-phone.png`, `recommend-desk.png`, `recommend-phone-returning.png`.

---

## 6. Tradeoffs against the job

Fold measurements are from the running app at 390×844. They give how much of
the page body sits below the fold on first view.

| Against the job | Today | A · Cards | B · Compare | C · Recommended |
|---|---|---|---|---|
| **1. See the options**: all three named, no tap | ✗ one named | ✓ | ✓ | ✓ (one large, two rows) |
| **2. Understand how each fights** | one 13px sentence, selected only | ✓ sentence + motion for all three | ~ the numbers are all there, but the sentence is for the selected hero only | ✓ for the suggestion, a sentence each for the others |
| **3. Compare** | ✗ tap and remember | ~ three numbers side by side | ✓✓ that is its purpose | ✗ comparison is not the point |
| **4. Decide** | default does it | player does it | player does it | suggestion does it, player can overrule |
| **Plan the first battle** (where to post it) | ✗ | ✓ plan card, below the fold on phone | ✓ summary card, below the fold on phone | ✓ inside the large card, above the fold |
| **"It was my choice"** | weak: one tap on the default | strong | strongest: every fact in view | moderate: a suggestion is still a nudge |
| **Honesty risk** | Mystic reads weak; STR/DEX/INT unexplained | low (area dmg/s label) | highest: bars invite "biggest bar wins" (mitigated by the Hits row and words for kinds) | the recommendation must stay true as the balance moves (the rule is data-driven and tested) |
| **Returning player (speed, strategy)** | fast | fast: three cards, one tap | good for strategy, *grows into* is a row | slower: first-run framing they don't need (label changes after run 1) |
| **Daily player** | Vow/seed friction (§0.9) | seed card open, same friction | same | same |
| **Phone fit** (body below the fold on first view) | 92px | 170px (the plan card) | 258px (last rows and summary) | 53px (the seed row) |
| **Cost to keep** | none | low: one card component | medium: a table layout, two header rows, a wide-screen rule | low, plus one product rule to own (what "recommended" means) |

**My lean, for you to overrule:** **A, with C's recommendation shown on first
run only.** A does the whole job for the primary hirer on one screen (see,
understand, plan) and stays fast for returning players. C's reason line, placed
on one of A's cards for `runsCompleted === 0`, answers the default-habit
problem without turning the screen into a quiz. B suits a returning player
choosing a strategy more than a first-timer. If you want it, it fits better as
a "Compare all" view behind a link on A than as the default.

---

## 7. Open questions

1. **(Headline) Who is the primary hirer?** I assumed a brand-new player on
   their first run, with returning and Daily players as secondary. If returning
   players matter most, B (or A with a *grows into* line on every card) moves up.
2. **What should a recommendation rest on?** The default is forgiveness
   (longest reach, so the Rogue). Alternatives: the Fighter, because *stops 2
   enemies* is the most visible cause and effect on the field and matches the
   first Coach tip; or no recommendation at all.
3. **STR / DEX / INT off this screen?** All three directions drop them in
   favour of damage/s, reach and health. They are still glossary terms
   elsewhere (hero panel, gear).
4. **Is folding the seed behind a row OK on a random run?** It stays open on a
   Daily Watch and a custom seed.
5. **Daily Watch friction (pre-existing):** fix the Vow chips that do nothing on
   a Daily, and the seed field that leaves the Daily, in whichever direction you
   choose? Should the screen say plainly "This counts as today's scored attempt"?
6. **Keep a default selection?** Today the Fighter is preselected and the
   button is live, which is the habit force in §3. C preselects on purpose,
   with a reason. A and B keep today's default (the first hero).
7. **Starter feats on this screen?** "Win with a Fighter as your first hero"
   unlocks Warden of Ash (and one each for the other two). This is a returning
   player's strongest pull, and hero pick never mentions it.
8. **The attack preview runs at the real attack rate.** The Mystic's 0.9/s cast
   looks slow. That is honest, but is it what you want in a menu? No projectile
   or target is drawn (§5).

---

*Built for H3-2. Code: `src/ui/shell/HeroPickVariants.tsx` (the three
directions), `src/ui/shell/heroPickFacts.ts` (every line they print, from the
data), `src/styles/heropick-variants.css`, a branch in `RootShell.tsx`, and
`previewHero` exported from `offers.ts`. Screenshots:
`/Users/denisdukhvalov/fieldwatch-critique/build-h3/`.*
