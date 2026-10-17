# Copy — the jobs to be done

The copy rule (Oct 2026). Every component has one job (`DESIGN_SYSTEM.md` § 8,
"Parts and their jobs"); so does every line of copy. Name the job, then cut the
line to the fewest words that still do it.

The designer, on a relic card that read "+5 Patience · every hero, hires
included / Stat relic — held for the rest of the run, by all your heroes.":

> The copy should be shorter like: +5 Patience to team / *relics affect new
> team members and stack for the remainder of your run*

and then:

> Take this copy feedback and apply to all copy in the game. It should be as
> brief as it can be where needed and explain clearly and succinctly if there
> needs to be context. Kinda like the jobs to be done on components but on
> copy now.

Every string a player reads is listed, by surface and with its job, in
[`INVENTORY.md`](INVENTORY.md). Regenerate it with
`npx tsx scripts/copy-inventory.ts` after a copy change.
`tests/copy.brevity.test.ts` holds the caps below.

## The jobs

| Line | Its one job | Pattern | Example |
|---|---|---|---|
| **Effect line** (relic, boon, item, shrine boon) | Say what it gives | The number and what it touches. No scope boilerplate. At most 60 characters for a stat relic or boon. | "+5 Patience to team" · "+25 gold per win" |
| **Rule relic** | Say the one rule it adds | One line with no full stop. At most 100 characters. | "First 2 raiders to reach your wagons each wave steal nothing" |
| **Bill** (a pact's downside, a curse) | Say the cost before you take it | The number and what it touches, on its own warning line (`warn`). At most 40 characters. It is never repeated in the effect line. | "Downside — −34% attack speed to team" · "Curse — −15% cargo now" |
| **Skill** | Say what the skill does to its hero, so two can be compared | One sentence with its numbers. Seconds as `s`, damage over time as `/s`. At most 80 characters. | "Every hit burns 12/s for 3s and splashes 15 wider." |
| **Mutation** | Say how it changes one hero's attack | Its upside only, in at most 60 characters; the bill is the downside line. | "Every shot hits ×3.2 as hard." |
| **Note** | Give context the player needs to choose, once | One short plain sentence in the quiet italic note (`BodyLine` `tone: 'note'`: `.sh-line.note` on cards and the Context panel, `.pg-card-body.note` on pages). Never a second effect line. | *"Relics affect new team members and stack for the rest of your run."* · *"Taking it doesn't raise enemy strength."* |
| **CTA** | Commit the screen's one action, and name it | A verb and its object. | "Hire Doyle" · "Read Easel House's terms" · "Take the free escort" |
| **Nav row** (Back, March on, Hire nobody) | Leave or skip | Its title says it all, with no body. | "March on" |
| **Board subtitle** | Say what the page is for, only when the title does not | At most one short line. None where the rows say it (Settings, Codex). | "Take one." |
| **Coach tip** | Teach one thing, once, when it first matters | One sentence. It names the control by its label. It never repeats a card's note. | "Take one: an item for one hero, or a relic for the team." |
| **Setting** | Say what the setting changes | One line, two at most. No history of the setting. | "One channel, so one earbud hears everything." |
| **Refusal / consequence** | Say why not, or what happens | Plain, and only while it applies. | "It ends as a fall. You keep city pay and …" |
| **Glossary line** (`channels.GLOSSARY`) | Define one term | Two short sentences at most. It may run longer than an effect line, because the Codex's "?" is where context lives. | "Skull tiles. Heroes may stand there but deal much less damage." |
| **Spoken line** (keeper, liaison) | Character voice | At most 40 characters (`stopScene.MAX_LINE`, tested). Never states a rule. | "Feed us, pay us, point us at goblins." |
| **a11y label** | Fully name the control for a screen reader | It may run longer than the visible text. It is never cut to match. | "Send the caravan, 100 gold stake" |

## Voice

From `BRAND.md` § Voice & tone, sharpened by the designer's note:

1. **Number first, then what it touches.** "+8% damage to team", not "Your
   heroes deal 8% more damage".
2. **Say a fact once per screen.** If a tag, tile or header says it, the line
   under it does not. The hire card's Holds tile says "2 enemies", so its
   "does" line keeps only the weapon.
3. **Context is a note, not a paragraph.** It gets one quiet italic sentence,
   and only when the player needs it to choose: permanence, scope, or what a
   choice does not cost.
4. **No scope boilerplate.** Write "to team", never "· every hero, hires
   included", "· all your heroes" or "held for the rest of the run". The relic
   note says how relics work, once per card.
5. **Cut filler and hedges.** "the fact that", "in order to", "simply", "just",
   "a little further forward than". Cut also any line that explains how the UI
   used to work.
6. **True first.** Generated numbers stay generated: the shrine's cargo curse
   is computed from the rule (`offers.shrineCurse`), not written by hand.
7. **One name per thing.** Use cargo, never Gate. The group of heroes is
   "your heroes", and "team" in an effect line ("to team", the designer's
   word). The player's band is "your militia", never "your company"
   (`tests/copy.terms.test.ts`).
8. **Plain and warm, with a little flavour.** Flavour belongs in names, scenes
   and spoken lines. It never blocks a decision, and it never restates a
   downside ("the round itself is mostly casing" was cut; the downside line
   says −55%).

## Before and after (the October 2026 pass)

| Surface | Before | After |
|---|---|---|
| Relic (pact) | "+70% damage, +8 Thorns, −34% attack speed · all your heroes" + "Downside — −34% attack speed · all your heroes" | "+70% damage, +8 Thorns to team" + "Downside — −34% attack speed to team" |
| Relic (rule) | "For the first 20s of every wave, all your heroes attack 35% faster." | "+35% attack speed to team for the first 20s of each wave" |
| Relic (rule) | "+25 gold for every fight you win." | "+25 gold per win" |
| Boon card body | desc, then `describeGrant` and every `describeMods` line under it (each number said twice) | the desc alone |
| Boon card tag | "Epic · all heroes" | "Epic · boon" |
| Skill | "Holds 2 more enemies, its thorns hit 3 times as hard, and its hits and thorns set enemies burning for 26 a second." | "Holds 2 more enemies, thorns ×3, and its hits and thorns burn 26/s." |
| Mutation | "One devastating 3.2× shell per reload. Anything small is a waste of it." | "Every shot hits ×3.2 as hard." |
| Shrine curse | "The base takes 3 damage now" | "−15% cargo now" (computed) |
| Shrine boon | "+4 STR to every hero" | "+4 STR to current heroes" (a shrine does not reach later hires) |
| Shrine / hire note | "Enemies get no stronger for taking it. Enemy strength rises with every stop you pass, whatever you take there." | *"Taking it doesn't raise enemy strength."* |
| Campfire | "Aldre (Grimoire) gains a full level: +44 XP." + "Training spends the campfire. No stray cargo is rounded up." | "+44 XP: one full level." (the row says Level 5 → 6; the keeper says "Pick.") |
| Mutation confirm | "… Use the red "Yes — mutate Doyle" button below to go through with it; "Never mind" or another card leaves the choice open." | "Hoarfrost is permanent and can't be rerolled. It costs −70% damage per hit." |
| Settings · Large UI | "Grows every label, tag and price by about 15% … It used to promise "bigger type" and move one button. It moves the whole type ramp now." | "All text about 15% larger; touch targets 48px." |
| Settings · Assist | Four lines, the first and second saying the same thing | the level's effect, "Waves, loot and pay stay the same.", and the Assisted rule as a note |
| Settings page | subtitle "Audio, motion, contrast, scale, colour vision, assist and tips." | no subtitle (the rows say it) |
| Terms tip | "Each crate costs 50 gold and makes the road harder …" under "Your stake · 50 gold a crate" | "Each crate makes the road harder, and pays more if delivered." |
| Codex item | "Every Watch has it from the first run. Heroes and loot can be dealt it on any road. On Easel House's road it turns up more often." | "Yours from the first run. Dealt on any road. More often on Easel House's road." |
| Defeat receipt | "×3 · 5 Gate" · "Hardest hit: Bomber, 3 Gate in one." | "×3 · −25% cargo" · "Hardest hit: Bomber, −15% cargo in one." |
| Coach (spoils) | "A relic helps all your heroes for the rest of the run." (the card's note again) | "Take one: an item for one hero, or a relic for the team." |
| Hire card | "Casts magic from a wand at a group · holds 2 enemies with its shield" beside a "Holds 2 enemies" tile | "Casts magic from a wand" |

The per-surface counts and average lengths before and after are in the
DESIGN_REVIEW.md log entry for this pass.
