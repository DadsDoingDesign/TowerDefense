# Skill merging (ordered merges)

The designer (Oct 2026), in three steps:

1. "It's also kinda boring having my skills replace each other. Can they
   merge and fuse into new combos and new types of skills."
2. "We also need a similar interaction to drag and drop the items. If into
   an empty slot then it's kept as is, but if all slots are full you are
   forced to merge in."
3. "The merging should be possible with any combination in any order, but
   order does matter and affects what's made."

So a hero's skill milestone (SK1, `run/skills.ts`) is now a **drop**: the
milestone's card is dropped on one of the hero's three slots. Onto an empty
slot it is learned as itself. Onto a held skill it **merges in**, and the
order decides what is made: the skill already in the slot is the **base**,
the card is the **infusion**. Every ordered pair of skills makes a skill of
its own; twenty ordered pairs are **named merges**, the specials. There is
no swap any more — a skill never leaves a hero.

(This replaces the first fusion build of the same month: fifteen unordered
recipes, a fusion opening at level 10, a "Pairs" tag and a held-pair
choice. All of that is gone; its fifteen engine twists, its discovery, its
beat and its saves are kept.)

## 1. Rules

- **The drop** (`run/fusion.dropOnto`, `run/skills.dropSkill(hero, card,
  slot, pool, seed)` — the one move the store, the panel and the balance
  harness make). A card must be on the hero's owed offer (dealt as it always
  was) and land on a slot that takes it:
  - an **empty** slot: the card is learned as itself (skills fill in order,
    so any empty slot lands in the first free one);
  - a **held** skill: the card merges in. Always allowed — a hero with room
    may merge by choice, to make a named merge — and the only way once all
    three slots are full. No swap, no discard;
  - a slot already holding `MAX_DEPTH` (3) library skills takes nothing, and
    no slot ever holds a skill twice (the offer never deals a skill any slot
    already holds).
  The stat bump stays: a full hero (or a thin offer) may take +N to one stat
  instead.
- **The base keeps itself.** Its name, its numbers, the way it delivers them,
  its company and its picture. **The infusion lends** a share of itself
  (about 40%) and its element, re-expressed through the base (§ 2).
- **Order matters.** A onto B is never B onto A: another id, another name,
  other mods (`tests/fusion.test.ts` holds all 2,450 ordered pairs of the 50
  library skills to it). "Frozen Arc Spark" is Arc Spark's jump at full with
  Frostbite's slow riding its jumps; "Sparking Frostbite" is Frostbite's slow
  at full with a small jump that carries it.
- **Named merges** (`data/fusions.ts`) are the specials for ONE ordered pair
  each: the same base and share, and in place of the rule a stronger twist
  only they have. Fifteen are tier 1 (two library skills); five are
  **greater** — a tier-1 named merge with a Level 3 card poured in, three
  skills in one slot, keeping the tier-1 twist and adding a capstone. The
  other order of a named pair is a plain merge.
- **A merged skill as a base** takes one more card (to the depth cap): "Keen
  Hard Hitter" with Berserk poured in is "Berserk Keen Hard Hitter". A merged
  skill is never an infusion in this build — only cards are dropped — and
  were one ever poured in it would lend its ROOT base's infusion
  (`fusion.infusionOf`), so pouring a slot in is pouring its base in.
- **Named merges form only by a drop in their order.** Two parts of a recipe
  held in separate slots stay apart, each at full strength (the designer's
  "kept as is"); a hire's first skill and the Opening deal never merge
  anything. The panel stars every slot where the card in hand would make a
  named merge, so the build is always in view.
- **No new draws.** Merging reads no RNG; the twists in the engine read none
  either (the crit roll they read is the one `fire` always draws).
- **Unchanged:** the hero pick, a hire's first skill, unlock pools, crates,
  standing cards, signatures, contracts' `weightPool`, old-save migration.
  A merged skill is never in a pool.

## 2. Every skill's infusion half, and the re-expression rules

Every library skill has two authored halves: its CORE (its own `mods`, what
it keeps as a base) and its INFUSION (`data/infusions.ts`): a tag, a one-word
adjective no other skill uses, and the share it lends with its line.

The share **stacks on what the base already does** (`skills.stackShare`): a
burn onto a burn adds its damage, a slow onto a slow its slow (to 60%), a
jump's or an aura's share its strength, a rush its rate, an execute its
threshold, a stun its chance. Everything else is added as it is.

| Skill | Level | Tag | Adjective | Delivery (as a base) | Share it lends |
|---|--:|---|---|---|---|
| Quick Hands | 1 | speed | Quick | strike | Attacks 6% faster. |
| Hard Hitter | 1 | steel | Hard | strike | Hits 6% harder. |
| Keen Eye | 1 | crit | Keen | strike | Crit chance +4%, crit damage +20%. |
| Hold Fast | 1 | guard | Steadfast | hold | Hits 8% harder on held enemies. |
| Charge | 1 | speed | Charging | strike | Attacks 25% faster for the first 15s of each wave. |
| Bloodrush | 1 | blood | Bloodied | strike | Each kill makes it attack 10% faster for 1.5s. |
| Poisoned Tips | 1 | poison | Venomous | status | Hits poison 4/s for 3s. |
| Arc Spark | 1 | storm | Sparking | chain | Hits jump to 1 more enemy for 18%. |
| Frostbite | 1 | frost | Frozen | status | Hits slow 10% for 1.5s. |
| Long Reach | 1 | reach | Reaching | strike | Reaches 8% farther. |
| Cleave | 1 | splash | Cleaving | splash | Hits also strike enemies within 6. |
| Bounty | 1 | gold | Gilded | strike | Each kill pays 1 more gold. |
| Pin Down | 1 | guard | Pinning | hold | Hits 12% harder on held enemies. |
| Riposte | 1 | guard | Barbed | hold | Thorns +30%. |
| Heavy Blows | 2 | steel | Mighty | strike | Hits 10% harder and attacks 4% faster. |
| Long Shot | 2 | reach | Farshot | pierce | Reaches 15% farther. |
| Finisher | 2 | blood | Merciless | strike | Kills under 6% health outright; hits 4% harder. |
| Shield Wall | 2 | guard | Walled | hold | Holds 1 more enemy. |
| Anchor | 2 | guard | Anchored | hold | Hits slow 12% for 1.4s; thorns +50%. |
| Stunning Bash | 2 | steel | Stunning | strike | Hits have a 7% chance to stun for 0.7s. |
| Snare | 2 | root | Snaring | ground | Lays a snare on the path that burns 6/s and slows 12%. |
| Wildfire | 2 | fire | Blazing | splash | Hits burn 5/s for 3s and splash 6 wider. |
| Blessing | 2 | banner | Blessed | aura | Heroes near it hit 15% harder. |
| Siphon | 2 | blood | Siphoning | strike | Hits 18% harder; every 100 damage wins back 1% cargo. |
| Killing Spree | 2 | blood | Frenzied | strike | Each kill makes it attack 18% faster for 2s. |
| Cold Snap | 2 | frost | Brittle | strike | Hits 10% harder on slowed enemies. |
| Firebrand | 2 | fire | Branded | hold | Its thorns burn what it holds 5/s for 3s. |
| Split Shot | 2 | reach | Splitting | pierce | Every 3rd attack passes through 1 more enemy. |
| Deadeye | 2 | crit | Sighted | strike | Every 8th attack crits; crit damage +10%. |
| Spicy Peps | 2 | fire | Peppered | status | Hits burn 4/s for 3s; attacks 6% faster. |
| Starweave | 2 | crit | Starlit | strike | Reaches 10% farther; crit chance +6%, crit damage +10%. |
| Ore Sense | 2 | steel | Veined | hold | Hits 8% harder. |
| Blood Price | 2 | gold | Tolled | status | Each kill pays 1 more gold; hits slow 10% for 1.5s. |
| Thornbloom | 2 | storm | Blooming | chain | Hits jump to 1 more enemy for 20% and slow 10% for 1.5s. |
| Bolder Bash | 2 | splash | Bold | splash | Hits 8% harder and splash 8 wider. |
| Banner Bearer | 2 | banner | Bannered | aura | Heroes near it attack 8% faster. |
| Venom Spit | 2 | poison | Spitting | status | Every 5th attack poisons the 2 nearest enemies 8/s for 3s. |
| Overgrowth | 2 | root | Overgrown | ground | Grows roots on the path that slow 16% and sting 3/s. |
| Berserk | 3 | steel | Berserk | strike | Hits 16% harder and attacks 10% faster. |
| Weaponmaster | 3 | crit | Masterful | strike | Hits 8% harder; crit chance +8%, crit damage +24%. |
| Volley | 3 | reach | Volleying | pierce | Every 4th attack pierces its whole path. |
| Bulwark | 3 | guard | Bulwarked | hold | Holds 1 more enemy; hits slow 18% for 2s. |
| Reaper | 3 | blood | Reaping | strike | Kills under 11% health outright; hits 8% harder. |
| Rally | 3 | banner | Rallying | aura | Heroes near it hit 20% harder. |
| Momentum | 3 | speed | Rolling | hold | Attacks 6% faster per enemy it holds. |
| Last Rites | 3 | mend | Hallowed | strike | Every 12th kill wins back 5% cargo. |
| Warden of Ash | 3 | fire | Ashen | hold | Thorns +60%; hits burn 10/s for 3s. |
| Hexblade | 3 | frost | Hexed | status | Hits have an 8% chance to stun for 0.7s, and slow 18%. |
| Stormcaller | 3 | storm | Thundering | chain | Hits jump to 1 more enemy for 20%; hits 14% harder. |
| Tinker’s Spark | 3 | storm | Tinkered | chain | Every 5th attack jumps to 2 more enemies for 50%; hits 10% harder. |

**The base's delivery** is read off its own mods (the first that applies):
a **jump** (Arc Spark), an **aura** (Blessing), the **ground** (Snare), a
**hold** (Hold Fast, Pin Down, thorns), a **pierce** (Long Shot), a
**splash** (Cleave, Wildfire), a **status** (Poisoned Tips, Frostbite), or a
plain **strike** (Hard Hitter, Keen Eye). A merged base reads its root's.

**The re-expression rules** (`infusions.reexpress`): the infusion's tag met
through the base's delivery. One rule per merge, the first that applies;
every one is a fusion twist (§ 3), at a systematic merge's strength:

| # | Infusion → base | What it does | Twist |
|--:|---|---|---|
| 1 | fire / poison / frost → a jump | its jumps carry the status ("Frozen Arc Spark: its jumps slow") | `arcCarry` |
| 2 | storm → a status | the share's small jump carries the base's status ("Sparking Frostbite") | `arcCarry` |
| 3 | splash → a burn or poison | enemies dying of it burst 25% within 40 ("Cleaving Poisoned Tips") | `deathBurst` |
| 4 | splash → a slow | hits on slowed enemies splinter 15% within 40 | `frostSplash` |
| 5 | fire / poison / frost → a splash or a pierce | the status rides the splash or the pierce (the engine strikes every body a splash or a pierce hits with the hit's statuses) — the line says so, no mods ("Venomous Cleave") | — |
| 6 | crit → a jump | crits bounce on for 30% | `ricochet` |
| 7 | crit → a slow | +5% crit on slowed enemies; those crits +20% and freeze 1s | `critFreeze` |
| 8 | crit → an aura | heroes near it crit 5% more | `critAura` |
| 9 | steel → a hold | a held enemy that dies bursts 20% within 45 | `heldBurst` |
| 10 | steel → a strike | +5% per hit on one enemy, to +15% | `focusStack` |
| 11 | blood → a splash | a killing hit's excess rolls on at 50% | `overkill` |
| 12 | reach → a pierce | every 6th attack also shoots 1 more for 30% | `fanEvery` |
| 13 | speed → a blood base | each kill this wave +2% speed, to +20% | `frenzy` |
| 14 | crit → a strike, a hold, a pierce or a splash | crits bounce on for 20% | `ricochet` |
| 15 | poison → a strike or a hold | its dead pass the poison to 2 near | `contagion` |
| 16 | fire → a strike or a hold | its dead burst 15% within 35 | `deathBurst` |
| 17 | frost → a strike or a hold | hits on slowed enemies splinter 10% within 35 | `frostSplash` |
| 18 | speed → a strike, a hold or a status | each kill this wave +1% speed, to +10% | `frenzy` |
| 19 | steel → a status | its first hit on each enemy +15% | `firstHit` |

Everything else (gold, mend, roots, a banner, storm into a plain hit…) is the
share alone: a merge is never empty, but not every pair has a rule.

**Names and words.** A plain merge is named for its infusion and its base —
the infusion's adjective, then the base's name ("Frozen Arc Spark", "Keen
Rimecut", "Berserk Keen Hard Hitter"); at most 34 characters (longest of the
pairs: "Thundering Tinker's Spark", 25). Its `desc` is its root base's own
sentence (the base keeps its identity) and its `lines` what each infusion
added, in order — the share's line, then the rule's or twist's — each one
sentence of at most 80 characters (COPY.md's skill cap). The copy test holds
every pair.

**Ids.** A plain merge's id is `mx.` and its slot's skills, base first:
`mx.arc_spark.frostbite`; onto a named base, `mx.fz_rimecut.anchor`; three
deep, `mx.hard_hitter.keen_eye.berserk`. A named merge is its `fz_*` id. One
id per slot: a chain whose first two make a named merge is always written
from it (`mx.frostbite.keen_eye` is refused — it is `fz_rimecut`), so a save
can hold nothing else. `skills.mergedById` builds (and caches) a merge from
its id; `mergeId(base, card)` writes it.

## 3. Named merges

| Named merge | Tier | Order (base ← card) | Level | Company | Twist |
|---|--:|---|--:|---|---|
| Thousand Cuts | 1 | Keen Eye ← Long Reach | 1 | silk | Crits bounce to 1 more enemy for 60%. |
| Relentless | 1 | Hard Hitter ← Pin Down | 1 | spice | Each hit on an enemy makes its next on it 25% harder, up to double. |
| Bushwhack | 1 | Quick Hands ← Charge | 1 | silk | Its first hit on each enemy deals 50% more. |
| Sunder | 1 | Hard Hitter ← Cleave | 1 | spice | A killing hit’s excess rolls on to the next enemy, up to 3 more. |
| Plague Spark | 1 | Arc Spark ← Poisoned Tips | 1 | scrolls | Every 2nd attack jumps to 1 more enemy, and its jumps poison what they hit. |
| Rimecut | 1 | Frostbite ← Keen Eye | 1 | scrolls | +18% crit on slowed enemies; those crits deal 60% more and freeze 2s. |
| Crushing Grip | 1 | Hold Fast ← Pin Down | 1 | spice | A held enemy that dies bursts for 40% of its hit within 50. |
| Plaguebearer | 1 | Poisoned Tips ← Venom Spit | 2 | art | Enemies dying of its poison pass it, fresh, to 4 near them. |
| Cinderburst | 1 | Cleave ← Wildfire | 2 | metals | Enemies it set burning burst for 50% of its hit when they die. |
| Hail of Arrows | 1 | Long Reach ← Long Shot | 2 | silk | Every 4th attack also shoots 2 more enemies for 40%. |
| Coup de Grâce | 1 | Charge ← Finisher | 2 | spice | Executes under 22% instead, and each execution readies its next attack. |
| Shatterglass | 1 | Frostbite ← Cold Snap | 2 | scrolls | Hits on slowed enemies splinter 35% to enemies within 45. |
| Rallying Standard | 1 | Hold Fast ← Banner Bearer | 2 | spice | Heroes near it crit 15% more often. |
| Anvilfall | 1 | Heavy Blows ← Weaponmaster | 3 | metals | Every 3rd attack shakes enemies within 60 of its target for 60%. |
| Red Mist | 1 | Bloodrush ← Berserk | 3 | art | Each kill this wave adds 2.5% attack speed, to +25%. |
| Skyfall | 2 | Hail of Arrows ← Volley | 3 | silk | Every 2nd attack shakes enemies within 55 of its target for 50%. |
| Black Death | 2 | Plaguebearer ← Reaper | 3 | art | Enemies dying of its poison burst for 40% of its hit within 50. |
| Glass Storm | 2 | Shatterglass ← Tinker’s Spark | 3 | scrolls | +30% crit on slowed enemies; those crits deal 80% more and freeze 1.5s. |
| Forgefire | 2 | Cinderburst ← Weaponmaster | 3 | metals | Crits bounce on in full, and a kill’s excess rolls on at 50%. |
| War Banner | 2 | Rallying Standard ← Rally | 3 | spice | Each kill this wave adds 4% attack speed, to +40%. |

Shape (`tests/fusion.test.ts`): every infusion is a starter or a common
unlock — never a signature or a feat card; no two Level 1 starters make one
(so a first-timer is not handed one at level 5 — the first build's starter
recipes put every first-timer's hero over its band); a first run meets one
only in Anvilfall (two starters, level 15); no skill is in more than three
recipes; one greater per company, each over a tier-1 merge; every tier-1
twist is a different rule no library card grants, and every capstone a rule
its tier 1 lacks. A named merge's level is its highest skill's, its company
its base's.

**Auto-combine and the tie rule.** A named merge forms when its card is
dropped on its base — at once, with the beat — and only then. There is no
tie to break: a drop names one slot, and one ordered pair makes at most one
named merge.

**Lean and cost.** No lean toward a recipe's missing part (the offer is
dealt exactly as before; a lean would move every offer of every run), and
no price on a greater merge: the depth cap and the order are its cost.

### The fifteen twists (the engine)

Fifteen new `EffectMods` fields (`game/types.ts`). As with every rule
capability, each is read in one place in `engine.ts`, is off unless a source
grants it, and draws nothing, so a hero without one fights exactly as before
(`tests/engine.determinism.test.ts`, the stats fixture). Area damage the
twists deal goes through `damageEnemy` (resist, cursed ground and kill credit
apply), is never itself a hit (it carries no statuses and sets off no further
twist), and lands at the end of the impact or the tick, never inside a loop
over the enemies.

| Field | Shape | What it does | Read in |
|---|---|---|---|
| `ricochet` | share | A crit that lands bounces to the nearest enemy it did not touch, for this share of the hit | `impact` |
| `overkill` | share | A hit that kills carries this share of its excess to the nearest living enemy within 70; an excess that kills again rolls on, up to `OVERKILL_HOPS` (3) more | `applyHit` → end of `impact` |
| `arcCarry` | flag | Its chain arcs also write its burn and its chill on what they jump to | `impact` (chains) |
| `critFreeze` | `{ dur, bonus, chance }` | Its crit bar is `chance` higher against a frost-chilled target (the bar, never the draw); a crit on one deals `bonus` more and stops it `dur` s, not again for `FREEZE_REST` (2s) after | `fire`, `applyHit` |
| `focusStack` | `{ step, cap }` | Each shot it has already aimed at an enemy (this wave) makes its next on it `step` harder, to `cap`; a retarget keeps the marks | `fire` |
| `heldBurst` | `{ frac, radius }` | An enemy it was holding that dies bursts for `frac` of its hit on enemies within `radius` | `onDeath` → `flushPending` |
| `firstHit` | share | Its first hit on each enemy deals this much more | `applyHit` |
| `contagion` | `{ count, radius }` | An enemy dying of its poison spreads the poison, at its full length, to `count` within `radius` (beside the Ember Urn's team rule; the larger count wins) | `onDeath` |
| `deathBurst` | `{ frac, radius }` | An enemy dying while its burn is on it bursts for `frac` of its hit within `radius` | `onDeath` → `flushPending` |
| `fanEvery` | `{ every, count, frac }` | Every `every`th attack also shoots `count` other enemies in reach for `frac` | `fire` |
| `executeReady` | flag | An execution readies its next attack at once (Coup de Grâce also raises the execute line to 22%, a plain `execute`) | `applyHit` (execute) |
| `frostSplash` | `{ frac, radius }` | A hit on a slowed enemy splinters `frac` of it to enemies within `radius` | `applyHit` → end of `impact` |
| `critAura` | `{ add, radius }` | Heroes within `radius` (itself too) get `add` crit chance; the strongest aura counts | `updateAuras` → `fire` |
| `quakeEvery` | `{ every, frac, radius }` | Every `every`th attack's impact also strikes every other enemy within `radius` for `frac` | `fire` → `impact` |
| `frenzy` | `{ rate, cap }` | Each kill this wave adds `rate` attack speed, to `cap` | `fire` |

`mergeMods` folds them like their neighbours: shares add, flags or, the
structured ones keep the best of each field and a cadence the shortest
interval.

## 4. Discovery

- The Codex skills tab's **Merges** section is the named merges' build tree:
  its rule once ("Drop a card on a held skill to merge it in. The skill in
  the slot leads: order matters."), the count ("Made N of 20 named merges."),
  then each tier 1 that builds into a greater one beside it with an arrow,
  then the other ten. An undiscovered tile is its order's marks and a "?"
  ("base ← card → ?"), its card "Undiscovered", the order, and "Drop CARD on
  BASE at a level-up to find out." — never the result; a greater over an
  unmade tier 1 hides that one's name too. Once made it shows its name, what
  its card lends and its twist, with a NEW badge until read (`codexSeen`).
  The plain merges are not listed: every ordered pair makes one.
- Discoveries are `codex.fusions` in the meta save — named ids, each once,
  in the order found, known ids only (`migrateCodex`). No version bump.
- `rosterSlice.dropSkill` records a named merge the first time it is made.

## 5. UI

- **The drop** (`LevelUpPanel`, words in `ui/shell/skillDrop.ts`). Under the
  strip of three cards and the stat boost, the hero's three slots stand as
  targets: what each holds and, for the focused card, what it makes there —
  "Learn as is" on an empty slot, "→ Frozen Arc Spark" on a held skill, gold
  "→ Rimecut ★" for a named merge, "Full" at the depth cap. A card that
  makes a named merge on a held slot wears a quiet ★ on its token.
- **Three ways in.** Drag a card (a finger or a mouse — pointer events; a
  press that travels past the tap's 8 px slop picks it up, a copy follows
  above the pointer and the slot under it lights); or tap a card, then tap a
  slot; or the keyboard — the strip's arrows focus a card, Tab reaches the
  slots, Enter chooses one. Each slot's accessible name says what dropping
  there makes ("Slot 1: Frostbite. Drop Keen Eye here to merge it in: makes
  Rimecut, a named merge."). Under reduced motion the dragged copy neither
  tilts nor lifts.
- **Pick one, then read.** A release (or a tap) only CHOOSES a slot. A hero
  with room has its first empty slot chosen by default, so "Learn Keen Eye"
  is one tap as ever; a full hero has none — a merge is always the player's
  pick ("Choose a skill to merge into"). On a held slot the card becomes the
  MERGE's: kicker "Merge · Level 3" / "Named merge · Level 1", its name, the
  order (Frostbite ← Keen Eye), the base's sentence, what the card lends,
  and the rule or twist on an element-coloured rule, with the DPS before →
  after; the CTA names it ("Merge into Frozen Arc Spark", "Make Rimecut").
  On a plain card, one quiet note: "Onto Frostbite: Rimecut ★", or the build
  it can become later ("Builds into Hail of Arrows with Long Shot.").
- **The fuse beat** (`FuseBeat.tsx`, pure timings `fuseBeat.ts`): the base
  (from the left) and the card (from the right) slide in and slam together
  (260 ms, a small thump), a flash in the element colour (140 ms), and the
  merged card — the order, its name (★ for a named one), its twist — settles
  (360 ms); 0.92 s in all, a tap skips. Sound `audio.sfxFusion`. Light: no
  flash, no thump, a shorter slide (0.7 s). Reduced motion: nothing moves —
  the merged card stands, still, for 1.1 s. The merge is in the store before
  the beat starts.
- **The hero card.** A merge sits in one slot with its base's mark (a named
  merge's own) and a small element-coloured corner; its read line is the
  order and the twist ("Rimecut · Frostbite ← Keen Eye — +18% crit …"). A
  plain skill a named merge builds from adds "Builds into Rimecut ← Keen
  Eye."

## 6. Data and saves

- Merged ids pass `isSkillId`, `skillById` and every validator that reads
  `hero.skills`. `runSnapshot.normaliseSkills` keeps known ids, each once, at
  most three, and drops a slot whose skills another slot before it already
  holds (a loose copy of a merge's part, or two merges sharing one). The
  fuzz's base run carries a greater named merge and a plain merge
  (`['fz_skyfall', 'mx.frostbite.arc_spark']`) and checks no skill is held
  twice. `migrateSkillPool` and the meta save's `skills` take library cards
  only (`isCardId`); `codex.fusions` named ids only (`isNamedId`).
- No snapshot or meta version bump: `hero.skills` already held ids, and no
  build that shipped holds a merged id (the first fusion build was never
  merged), so nothing migrates.

## 7. Balance

**§7b of `balance/REPORT.md`** (`balance/fusion-eval.ts`) grades two kinds of
merge with the damage-equivalent (on §7's benches for the merge's level and
each kit, waves scaled so the reference hero stops about half, read over a
band of pressures around that point, then turned into how much harder the
reference would have to hit to stop as much; the median over the cells that
price it):

- each **named** merge against the **plain** merge of the same order (the
  same base and share, the rule in place of the twist, `skills.plainExtra`)
  — this is the twist alone, "a bit above". Gated: ≥ +0% and ≤ +40%; target
  +10–25%;
- a sample of **plain** merges against their base alone, both orders of
  three pairs — what pouring a card in is worth, and that order changes it.
  Gated: ≥ +0%.

| Merge | Kind | Order (base ← card) | Against | Median | Best kit | Cells priced |
|---|---|---|---|--:|---|--:|
| Thousand Cuts | named | Keen Eye ← Long Reach | its plain merge | **+24%** | +43% (Dagger) | 8/9 |
| Relentless | named | Hard Hitter ← Pin Down | its plain merge | **+17%** | +32% (Dagger) | 8/9 |
| Bushwhack | named | Quick Hands ← Charge | its plain merge | **+20%** | +25% (Wand) | 9/9 |
| Sunder | named | Hard Hitter ← Cleave | its plain merge | **+7%** | +11% (Dagger) | 9/9 |
| Plague Spark | named | Arc Spark ← Poisoned Tips | its plain merge | **+19%** | +20% (Dagger) | 9/9 |
| Rimecut | named | Frostbite ← Keen Eye | its plain merge | **+18%** | +35% (Dagger) | 8/9 |
| Crushing Grip | named | Hold Fast ← Pin Down | its plain merge | **+17%** | +36% (Sword & Shield) | 8/9 |
| Plaguebearer | named | Poisoned Tips ← Venom Spit | its plain merge | **+11%** | +17% (Wand) | 8/9 |
| Cinderburst | named | Cleave ← Wildfire | its plain merge | **+27%** | +42% (Sword & Shield) | 9/9 |
| Hail of Arrows | named | Long Reach ← Long Shot | its plain merge | **+23%** | +26% (Sword & Shield) | 9/9 |
| Coup de Grâce | named | Charge ← Finisher | its plain merge | **+15%** | +25% (Wand) | 9/9 |
| Shatterglass | named | Frostbite ← Cold Snap | its plain merge | **+24%** | +37% (Sword & Shield) | 8/9 |
| Rallying Standard | named | Hold Fast ← Banner Bearer | its plain merge | **+19%** | +20% (Dagger) | 9/9 |
| Anvilfall | named | Heavy Blows ← Weaponmaster | its plain merge | **+13%** | +102% (Sword & Shield) | 9/9 |
| Red Mist | named | Bloodrush ← Berserk | its plain merge | **+14%** | +15% (Sword & Shield) | 9/9 |
| Skyfall | named | Hail of Arrows ← Volley | its plain merge | **+10%** | +16% (Sword & Shield) | 9/9 |
| Black Death | named | Plaguebearer ← Reaper | its plain merge | **+17%** | +157% (Sword & Shield) | 8/9 |
| Glass Storm | named | Shatterglass ← Tinker’s Spark | its plain merge | **+17%** | +63% (Dagger) | 9/9 |
| Forgefire | named | Cinderburst ← Weaponmaster | its plain merge | **+12%** | +49% (Dagger) | 9/9 |
| War Banner | named | Rallying Standard ← Rally | its plain merge | **+19%** | +25% (Dagger) | 9/9 |
| Keen Hard Hitter | plain | Hard Hitter ← Keen Eye | its base | **+16%** | +24% (Dagger) | 8/9 |
| Hard Keen Eye | plain | Keen Eye ← Hard Hitter | its base | **+8%** | +13% (Dagger) | 8/9 |
| Frozen Arc Spark | plain | Arc Spark ← Frostbite | its base | **+1%** | +9% (Wand) | 9/9 |
| Sparking Frostbite | plain | Frostbite ← Arc Spark | its base | **+23%** | +25% (Wand) | 8/9 |
| Venomous Cleave | plain | Cleave ← Poisoned Tips | its base | **+9%** | +25% (Wand) | 9/9 |
| Cleaving Poisoned Tips | plain | Poisoned Tips ← Cleave | its base | **+15%** | +200%+ (Sword & Shield) | 8/9 |

Seventeen of the twenty named merges sit in +10–25% (Sunder +7% and
Cinderburst +27% are the two clear misses, Skyfall sits on the edge); none
is solved. Every plain merge in the sample pays, and each pair's two orders
differ: Hard Hitter ← Keen Eye +16% vs Keen Eye ← Hard Hitter +8%; Arc Spark
← Frostbite +1% (a slow on the jumps is control, which damage barely prices)
vs Frostbite ← Arc Spark +23%; Cleave ← Poisoned Tips +9% vs Poisoned Tips
← Cleave +15%.

Tuning moves (each from that bench): Plague Spark's twist was the plain
rule's (its jumps poison: +2%), then a second jump on every attack (+34%),
now a jump every 2nd attack (+19%); Rimecut's freeze 12% / +40% → 18% / +60%
(the plain Keen-into-frost rule already freezes a little); Rallying
Standard's crit aura 10% → 15%; Red Mist's frenzy 4% → 2.5% a kill; Skyfall
every 5th → 2nd attack; Glass Storm's freeze 10% / +30% → 30% / +80%;
Forgefire's capstone overkill → crits bounce in full and a kill's excess
rolls on at 50%; Anvilfall every 4th → 3rd attack (rule 14 gave its plain
merge bouncing crits); Cinderburst's burst stays 50% (45% read +9%, 50%
+27%: the bench steps there).

### What the whole runs say (the report's §11–§13, §18)

The run models drop as the UI does: the coin-flipper places a card in an
empty slot while it has one and, once full, merges a random card into a
random held skill (or takes the bump) with exactly the draws its swap made;
the veteran (`build: 'best'`) takes whichever drop or bump raises its DPS
most, so it merges by choice when a named merge pays. Every other section
(§1–§10, §14, §16, §17) is unchanged to the digit — checked section by section against the golden: §6 too, though its
coin-flipper now merges where it swapped (its full heroes are past the end of
its fights).

| Line | Before (first fusion build) | Ordered merges | Gate |
|---|--:|--:|---|
| First-timer (zero meta, 1 hero) | 13% | 13% | 12–25% |
| Zero-meta escort | 16% | 16% | 12–20% |
| Veteran escort | 45% | 38% | 30–45% |
| Veteran, 8 crates | 16% | 12% | 8–16% |
| Best line in §11's set (adaptive) | 16% | 18% | ≥ 12% |
| Opening deal 5 (+ Level 2 skill, §12) | +17pt | +12pt | reported |
| Sovereign Route delivered (§18) | 44% | 47% | reported |

Every gate passes (`npm run balance`: "All balance invariants passed").

**Why the veteran fell.** A full hero used to SWAP at level 15: out went its
weakest Level 1, in came a Level 3 at full strength. Now it merges: it keeps
everything and pours in about 40% of the Level 3 card, plus a rule. For a
DPS-reading veteran that is less than the swap was (and the first fusion
build's fusions held both parts at full strength), so its escort is 7pt
lower and its 8-crate stake 4pt lower — both inside their bands, and well
off the edges they sat on. The levers if the designer wants the veteran
back: the Level 3 shares (`data/infusions.ts`), or a richer rule for a Level 3
card. The first-timer and zero-meta lines do not move: a first run rarely
reaches a full hero.
