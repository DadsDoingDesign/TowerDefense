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

| # | Parts | Fusion | Co. | Lv | Twist (the new mechanic) |
|--:|---|---|---|--:|---|
| 1 | Quick Hands + Keen Eye | Thousand Cuts | Rosethread | 1 | **Ricochet** — crits bounce to 1 more enemy for 60% |
| 2 | Hard Hitter + Cleave | Sunder | Ironvein | 1 | **Overkill** — a killing hit's excess carries to the nearest enemy |
| 3 | Poisoned Tips + Arc Spark | Plague Spark | Greenvial | 1 | **Arc carry** — its arcs poison (and chill) what they jump to |
| 4 | Frostbite + Keen Eye | Rimecut | Greenvial | 1 | **Freeze** — crits freeze slowed enemies for 0.8s |
| 5 | Quick Hands + Hard Hitter | Relentless | Rosethread | 1 | **Focus** — each hit on the same enemy +8%, to +40% |
| 6 | Hold Fast + Pin Down | Crushing Grip | Peppercorn | 1 | **Held burst** — a held enemy that dies bursts its hit on those near |
| 7 | Hard Hitter + Keen Eye | Bushwhack | Peppercorn | 1 | **First strike** — its first hit on each enemy deals double |
| 8 | Poisoned Tips + Venom Spit | Plaguebearer | Butcherblock | 2 | **Contagion** — poisoned enemies spread it to 2 near when they die |
| 9 | Cleave + Wildfire | Cinderburst | Ironvein | 2 | **Death burst** — enemies it set burning burst when they die |
| 10 | Long Reach + Long Shot | Hail of Arrows | Rosethread | 2 | **Fan** — every 3rd attack also shoots 2 more enemies |
| 11 | Charge + Finisher | Coup de Grâce | Butcherblock | 2 | **Execute refund** — an execution readies its next attack |
| 12 | Frostbite + Cold Snap | Shatterglass | Greenvial | 2 | **Shatter** — hits on slowed enemies splinter to those near |
| 13 | Hold Fast + Banner Bearer | Rallying Standard | Peppercorn | 2 | **Crit aura** — heroes near it crit more |
| 14 | Heavy Blows + Weaponmaster | Anvilfall | Ironvein | 3 | **Quake** — every 4th attack shakes everyone near its target |
| 15 | Bloodrush + Berserk | Red Mist | Butcherblock | 3 | **Frenzy** — each kill +4% attack speed for the wave, to +40% |

The three Level 1 starters pair three ways (1, 5, 7), so a first run meets a
fusion at its first milestone: a fresh player's hero holds one of them and is
offered the other two, and both fuse.

Use counts: Hard Hitter, Keen Eye 3; Quick Hands, Poisoned Tips, Cleave,
Frostbite, Hold Fast 2; every other part 1.

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
| `overkill` | share | A hit that kills carries this share of its excess to the nearest living enemy within 70 | `applyHit` → end of `impact` |
| `arcCarry` | flag | Its chain arcs also write its burn and its chill on what they jump to | `impact` (chains) |
| `critFreeze` | seconds | A crit on a frost-chilled enemy stops it this long; not again for 2s after | `applyHit` |
| `focusStack` | `{ step, cap }` | Each hit on the target it hit last is `step` harder, to `cap` | `fire` |
| `heldBurst` | `{ frac, radius }` | An enemy it was holding that dies bursts for `frac` of its hit on enemies within `radius` | `onDeath` → `flushPending` |
| `firstHit` | share | Its first hit on each enemy deals this much more | `applyHit` |
| `contagion` | `{ count, radius }` | An enemy dying of its poison spreads the poison to `count` within `radius` (beside the Ember Urn's team rule; the larger count wins) | `onDeath` |
| `deathBurst` | `{ frac, radius }` | An enemy dying while its burn is on it bursts for `frac` of its hit within `radius` | `onDeath` → `flushPending` |
| `fanEvery` | `{ every, count, frac }` | Every `every`th attack also shoots `count` other enemies in reach for `frac` | `fire` |
| `executeReady` | flag | An execution readies its next attack at once | `applyHit` (execute) |
| `frostSplash` | `{ frac, radius }` | A hit on a slowed enemy splinters `frac` of it to enemies within `radius` | `applyHit` → end of `impact` |
| `critAura` | `{ add, radius }` | Heroes within `radius` (itself too) get `add` crit chance; the strongest aura counts | `updateAuras` → `fire` |
| `quakeEvery` | `{ every, frac, radius }` | Every `every`th attack's impact also strikes every other enemy within `radius` for `frac` | `fire` → `impact` |
| `frenzy` | `{ rate, cap }` | Each kill this wave adds `rate` attack speed, to `cap` | `fire` |

`mergeMods` folds them like their neighbours: shares add, flags or, the
structured ones keep the best of each field and a cadence the shortest
interval.

## 4. Discovery

- The Codex skills tab gains a **Fusions** section: every recipe as a tile.
  An undiscovered fusion is a "?" tile whose card names its two parts and
  "Fuse them to find out"; once made it shows its name, its sentence and
  its twist, with a NEW badge until its card is read (`codexSeen`, a UI note).
- Discoveries are `codex.fusions` in the meta save — fusion ids, each once,
  in the order found, known ids only (`migrateCodex`). No version bump: the
  field is optional, so a v16 save without it reads as "none found", and a
  junk entry is dropped on load.
- The first time a player makes a fusion the Codex records it
  (`rosterSlice.chooseFusion` → `metaStore.recordCodex({ fusions })`).

## 5. UI

- **The offer.** A card that fuses wears a small "Fuses" tag on its token
  (in the fusion's element colour, on the token's lip — no frame, no glow).
  Focused, its `PickCard` is the *fusion's*: kicker "Fusion · Level 2", the
  fusion's name, the line "Quick Hands + Keen Eye", what it does, and its
  twist; the CTA reads "Fuse into Thousand Cuts". With two partners a chip
  row picks which. Nothing about the card's place in the strip moves.
- **The held pair.** "Fuse A + B" is one more token after the cards and the
  bump (its mark: the fusion's twist icon, label "Fuse"), its card the same
  fusion card; its CTA "Fuse into Name".
- **The fuse beat** (`FuseBeat.tsx`, `fuseBeat.ts` pure timings): over the
  Context panel, the two part cards slide in from the sides and slam
  together (≈ 260 ms), a flash in the element colour (≈ 120 ms), and the
  fusion card settles (≈ 360 ms); about 0.9 s in all, tap to skip. Sound:
  `audio.sfxFusion` — two knocks and a struck chord. Light: no flash and the
  cards cut straight to the slam. Reduced motion: no motion at all — the
  fusion card shows, still, with the chord.
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
