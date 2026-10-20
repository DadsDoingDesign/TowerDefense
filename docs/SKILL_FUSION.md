# Skill fusion

The designer (Oct 2026): "It's also kinda boring having my skills replace
each other. Can they merge and fuse into new combos and new types of skills.
I want real variety and fun."

A hero's three skill slots (SK1, `run/skills.ts`) used to fill at levels 5
and 10, and at 15 a full hero swapped one out or took a stat bump. Fusion
changes the swap into a chase: **two skills a hero holds fuse into one fused
skill in one slot**, with both parts' effects and a **twist** only the fusion
has. Fusing frees a slot, and the next milestone can fill it.

## 1. Rules

- **A recipe** is an unordered pair of library skills, A + B, and the fused
  skill it makes (`data/fusions.ts`, `FUSIONS`). Fifteen recipes; every part
  is a starter or a common unlock (never a signature or a feat card), every
  skill is in at most three recipes, and all five companies have three each.
- **A fused skill** holds one slot. Its effect is exactly A's mods, then B's,
  then its twist's (`skills.skillModsOf` expands it), so it is worth what
  holding both was, plus the twist. Its level is the higher part's. Its
  company is one of its parts'.
- **One level only.** A fused skill never fuses again: it is not a part of
  any recipe, and the recipe check reads plain skills only.
- **When.** Only at a skill milestone (5, 10, 15), only between waves, and
  only by the player's choice. Two ways, both pure functions of what the hero
  holds and the offer it is already shown:
  - **(a) A card that fuses.** The hero holds A, and B is on the offer: B's
    card says "Fuses with A → Name". Taking it fuses at once — A's slot
    becomes the fusion and B takes no slot, so a full hero needs no swap.
    When B fuses with two held skills, the card names both and the player
    picks the partner (the first is focused).
  - **(b) Fuse a pair already held.** The hero holds both A and B (a hire
    trained past a milestone, an Opening-deal Level 2 skill, a save from
    before fusion): the milestone also offers "Fuse A + B", beside the three
    cards and the bump. Taking it settles the milestone.
- **Nothing is re-dealt.** The three cards are dealt exactly as before
  (`skillOffer`: the same hash, the same candidates); fusion only annotates
  them and adds choices. One change to the candidates: a hero that already
  holds a fusion is not dealt either of its parts again (they would stack
  with the fusion's own copy). Only a hero holding a fusion — which no run
  before this build had — is dealt differently.
- **No new draws.** Fusion reads no RNG. The twists in the engine read no
  RNG either (the crit roll they read is the one `fire` always draws).
- **Unchanged:** the hero pick, a hire's first skill, unlock pools, crates,
  standing cards, signatures, contracts' `weightPool`, old-save migration.
  A fused skill is never in a pool: `ALL_SKILLS`, `RANDOM_UNLOCK_SKILLS`,
  `CHARTER_SKILLS`, `STARTER_SKILLS` and `SIGNATURE_SKILLS` are the library
  as it was. It comes only from fusing. No unlock is needed: a fusion is
  open whenever its parts meet.

## 2. Recipes

Level is the fused skill's (the higher part's). The twist line is its card's
second sentence.

| # | Parts | Fusion | Co. | Lv | Twist (the new mechanic, tuned) |
|--:|---|---|---|--:|---|
| 1 | Long Reach + Keen Eye | Thousand Cuts | Rosethread | 1 | **Ricochet** — crits bounce to 1 more enemy for 60% |
| 2 | Hard Hitter + Pin Down | Relentless | Rosethread | 1 | **Focus** — each hit on an enemy makes its next on it 12% harder, to +60% |
| 3 | Quick Hands + Charge | Bushwhack | Peppercorn | 1 | **First strike** — its first hit on each enemy deals 50% more |
| 4 | Hard Hitter + Cleave | Sunder | Ironvein | 1 | **Overkill** — a killing hit's excess rolls on to the next enemy, up to 3 more |
| 5 | Poisoned Tips + Arc Spark | Plague Spark | Greenvial | 1 | **Arc carry** — its jumps poison (and chill) what they hit |
| 6 | Frostbite + Keen Eye | Rimecut | Greenvial | 1 | **Freeze** — crits on slowed enemies deal 60% more and freeze them for 1.5s |
| 7 | Hold Fast + Pin Down | Crushing Grip | Peppercorn | 1 | **Held burst** — a held enemy that dies bursts for 40% of its hit within 50 |
| 8 | Poisoned Tips + Venom Spit | Plaguebearer | Butcherblock | 2 | **Contagion** — enemies dying of its poison pass it, fresh, to 4 near them |
| 9 | Cleave + Wildfire | Cinderburst | Ironvein | 2 | **Death burst** — enemies it set burning burst for 50% of its hit when they die |
| 10 | Long Reach + Long Shot | Hail of Arrows | Rosethread | 2 | **Fan** — every 4th attack also shoots 2 more enemies for 40% |
| 11 | Charge + Finisher | Coup de Grâce | Butcherblock | 2 | **Execute refund** — kills under 22% outright, and each execution readies its next attack |
| 12 | Frostbite + Cold Snap | Shatterglass | Greenvial | 2 | **Shatter** — hits on slowed enemies splinter 35% to enemies within 45 |
| 13 | Hold Fast + Banner Bearer | Rallying Standard | Peppercorn | 2 | **Crit aura** — heroes near it crit 10% more often |
| 14 | Heavy Blows + Weaponmaster | Anvilfall | Ironvein | 3 | **Quake** — every 4th attack shakes enemies within 60 of its target for 60% |
| 15 | Bloodrush + Berserk | Red Mist | Butcherblock | 3 | **Frenzy** — each kill this wave adds 4% attack speed, to +40% |

No two Level 1 starters fuse. The first build paired all three (Quick Hands
+ Keen Eye, + Hard Hitter, Hard Hitter + Keen Eye), so every first-timer's
hero fused at level 5 — and the balance run read the zero-meta escort 15% →
30% and the first-timer line 12% → 28%, past both bands (§ 7). Every Level 1
recipe now pairs a card standing or a delivery unlocks, so fusion arrives with
the collection; a first run can still meet one, Anvilfall (Heavy Blows and
Weaponmaster, two starters met at levels 10 and 15).

Use counts: Hard Hitter, Keen Eye, Long Reach, Pin Down, Charge, Poisoned
Tips, Cleave, Frostbite, Hold Fast 2; every other part 1.

The final numbers are the tuned ones in `data/fusions.ts`; §7b of
`balance/REPORT.md` measures each.

## 3. Mechanics

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
| `critFreeze` | `{ dur, bonus }` | A crit on a frost-chilled enemy deals `bonus` more and stops it `dur` s; not again for `FREEZE_REST` (2s) after | `applyHit` |
| `focusStack` | `{ step, cap }` | Each hit on the target it hit last is `step` harder, to `cap` | `fire` |
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

- The Codex skills tab gains a **Fusions** section: every recipe as a tile.
  An undiscovered fusion's tile is its two parts' marks and a "?" ("A + B →
  ?"), its card "Undiscovered", the recipe, and "Fuse these two on one hero
  at a level-up to find out." — never the result. Once made it shows its
  name, its sentence and its twist, with a NEW badge until its card is read
  (`codexSeen`, a UI note).
- Discoveries are `codex.fusions` in the meta save — fusion ids, each once,
  in the order found, known ids only (`migrateCodex`). No version bump: the
  field is optional, so a v16 save without it reads as "none found", and a
  junk entry is dropped on load.
- The first time a player makes a fusion the Codex records it
  (`rosterSlice.chooseFusion` → `metaStore.recordCodex({ fusions })`).

## 5. UI

- **The offer.** A card that fuses wears a small "Fuses" tag in its token's
  corner (on the fusion's element colour — no frame, no glow).
  Focused, its `PickCard` is the *fusion's*: kicker "Fusion · Level 2", the
  fusion's name, the line "Long Reach + Keen Eye", what it does, and its
  twist; the CTA reads "Fuse into Thousand Cuts". With two partners a chip
  row picks which. Nothing about the card's place in the strip moves.
- **The held pair.** One more token after the cards and the bump (its mark:
  the fusion's twist icon, label "Fuse" — no tag, the label says it), its
  card the same fusion card with the note "Frees a slot."; its CTA "Fuse
  into Name". The fusing card's note is "Takes no new slot.".
- **The fuse beat** (`FuseBeat.tsx`, `fuseBeat.ts` pure timings): the
  Context panel, for a moment, IS the beat — the two part cards slide in
  from its sides and slam together (260 ms, a small thump), a flash in the
  element colour (140 ms), and the fusion card — its parts, name and twist —
  settles (360 ms); 0.92 s in all, a tap skips, then the hero's card with the
  fusion in its slot. Sound: `audio.sfxFusion` — two knocks, the slam, and
  the evolution's struck chord. Light: no flash, no thump, a shorter slide
  (0.7 s). Reduced motion: nothing moves — the fused card stands, still, for
  1.1 s, with the chord. The fusion is in the store before the beat starts;
  skipping loses nothing.
- **The hero card.** A fused skill sits in one slot with its twist's icon and
  a small fused mark; its read line names the parts. A slot fusion freed is
  an empty slot like any other ("Lv 10", or "—" past the last milestone).
- **Copy** (`COPY.md`): a fusion's `desc` is its parts' numbers in one
  sentence; its twist line is the new rule with its number. Both under the
  skill caps (80 characters).

## 6. Data and saves

- Fused ids (`fz_<name>`) pass `isSkillId`, `skillById` and every validator
  that reads `hero.skills` (`runSnapshot.normaliseSkills`, the fuzz's base
  run carries one). A hero that somehow holds a fusion and one of its parts
  drops the loose part on load. `migrateSkillPool` and the meta save's
  `skills` reject fused ids (they are not cards).
- Snapshot version is unchanged: `hero.skills` already holds ids.

## 7. Balance

The tuned figures (§7b of `balance/REPORT.md`, the damage-equivalent of the
twist over the parts, median over the kit × bench cells that price it):
Thousand Cuts +23%, Relentless +8% (+24% on a dagger), Bushwhack +19%, Sunder +10%, Plague
Spark +10%, Rimecut +6% (+31% on a dagger: a crit twist), Crushing Grip +16%
(+41% on a sword and shield: a hold twist), Plaguebearer +13%, Cinderburst
+12%, Hail of Arrows +21%, Coup de Grâce +17%, Shatterglass +19%, Rallying
Standard +17%, Anvilfall +24%, Red Mist +25%.

How it was measured, and why that way: a stop rate read at one pressure is a
step function of damage, so the first bench (the fused hero's break pressure
over the parts') read +170% on one cell and −30% on its neighbour. The bench
now reads a band of pressures around the parts' break point, turns the
fusion's stop rate into the damage the parts' hero would need to match it,
drops the benches damage cannot move at all, and takes the median.

Tuning moves (each from that bench): Relentless's focus counts marks per
enemy (a retarget keeps them), at 12% to +60% — it read +0–4% while a new
target reset it; Bushwhack ×2 → +50%; Sunder's overkill now rolls
on (it read +3%); Rimecut's freeze became freeze-and-crack (+60%) — freezing
alone read +0% on every bench, which do not price control; Crushing Grip 100%
→ 40%; Plaguebearer 2 → 4 bodies, passed on fresh; Hail of Arrows every 3rd
at 60% → every 4th at 40%; Shatterglass 35% → 50% → 35% within 45; Coup de
Grâce gained the 22% line (executions at 15% were too rare to refund).

Target: a fusion is worth its two parts held together plus a modest twist,
**+10–25% over the parts** on the benches its twist reads; the freed slot is
the main reward. §7b of the report fits each kit's benches so a hero holding
both parts stops about half, then raises the HP of the waves until each of
the two (parts, fusion) breaks: the fusion's break pressure over the parts'
is the twist's worth. Gated: no fusion reads below the parts on its best
kit, and none passes +40% on its mean (solved). The run models fuse as the
UI does (a card that fuses is taken as the fusion), so §6 and §11–§13 move
with it; the report notes the shift.

## 8. What changed from the brief, and why

- **Fifteen recipes, fifteen distinct twists.** The brief listed eleven
  candidates; each fits the engine as a pure, draw-free rule, and four more
  (focus, first strike, quake, freeze) fill the pairs without a repeat —
  every fusion is a skill *type* the library did not have.
- **The thorns burst bursts the hit, not the thorns.** Thorns come from a
  shield; a hold skill on a hero with none would burst nothing. Bursting
  the hero's own hit works on every kit.
- **Ricochet, shatter and storm-chain reuse what exists.** The engine already
  shatters frost with shock (Phase 3a), so "shatter" here is the hit's own
  splinter on a slowed body, and "storm chain" is the arc carrying the
  hero's statuses rather than splashing.
- **A fusing card always fuses.** Taking B apart would be strictly worse
  (both effects in two slots, no twist), so the card does not ask.
- **The offer skips a held fusion's parts.** Otherwise Thousand Cuts could
  be dealt Keen Eye again, and the two copies would stack.
- **No meta version bump.** `codex.fusions` is optional and defaults empty.

### What the whole runs say (the report's §11–§13, §18)

The run models fuse as the UI does, so the run-level sections read runs that
fuse. Every other section (§1–§10, §14, §16, §17) is unchanged to the
digit: the engine fights a non-fusion battle exactly as before.

| Line | Before | After |
|---|--:|--:|
| First-timer (zero meta, 1 hero) | 12% | 13% |
| Zero-meta escort (gate 12–20%) | 15% | 16% |
| Veteran escort (gate 30–45%) | 45% | **47%** |
| Veteran, 8 crates (gate 8–16%) | 14% | **18%** |
| Opening deal 5 (+ Level 2 skill) | +15pt | +17pt |
| Sovereign Route delivered | 44% | 47% |

The first build (the three Level 1 starters fusing each other) read the
first-timer line 28% and the zero-meta escort 30%; an ablation with every
twist switched off still read 22% / 25%, so most of it was the SLOT (a
level-15 hero that fused takes its Level 3 card into a free slot instead of
swapping one out or taking the bump), and almost all of that came from the
starter triangle, which fused every first-timer's hero at level 5. With no
starter pair (the shipped recipes) the zero-meta lines are back in band.

**Two gates are red, by 2pt and 2pt:** the veteran's escort (47%, ceiling
45%) and its 8-crate stake (18%, ceiling 16%). A veteran holds the whole
library, so it meets a recipe at most milestones, and the freed slot is the
reward the brief asked for; switching the twists off moves these lines by
about 1pt, so trimming twists cannot close them. Closing them is a tuning
call for the designer: re-anchor the veteran's bands (fusion is a power the
veteran now has), or lift the late stakes' Threat — neither is a change a
fusion pass should make on its own, since both move non-fusion runs.
