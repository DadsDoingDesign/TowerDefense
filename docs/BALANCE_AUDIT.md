# Fieldwatch — Systems & Balance Audit

_Audit of items, upgrades, mutations, stats, combat, map generation, and the
balance harness, with exact formulas and `file:line` evidence. This is the
current-state reference; the redesign plan lives in `docs/BALANCE_PLAN.md`._

---

## 0. Executive summary — the core problems

1. **A whole defensive stat layer is dead.** The only code path that damages a
   player tower is `engine.ts:349`, gated behind the **fighter-only `block`**
   mechanic. Rogue and mystic towers are literally invulnerable, so `hp`,
   `physDef`, `thorns`, `healAura`, `dmgReductionAura`, `hpMult`, `selfSacrifice`
   do nothing on them. `magDef` is **never read by the engine at all**, on any
   unit. `Sentinel.attack` is a dead field (combat reads the tree node instead).
2. **Two of three item slots are inert on most towers.** Off-hand and body items
   grant *only* `physDef`/`magDef`/`hp` (`items.ts:121-134`) — all dead for
   non-fighters. A rogue's body armour is a stat-less brick.
3. **No tradeoffs, almost anywhere.** 9 of 11 mutations are pure upside; the
   other 2 are still net-positive DPS. All 9 reward stat-cards are pure upside.
   All enchants/keepsakes are pure upside. Only 3 two-handed weapons and a
   handful of evolution nodes carry a genuine cost.
4. **Rarity exists only for items.** Mutations, hub upgrades, evolutions and stat
   cards have no quality tiering at all.
5. **Coverage is lumpy.** `damageMult`, `rateMult`, `critChanceAdd` and the core
   stats are each grantable by 3+ systems (they multiply → runaway scaling),
   while `range`, `splash`, `crit-mult`, and every crowd-control/support mod are
   unreachable by gear, and `projectileSpeed`/`damageType` are unreachable by
   *anything*.
6. **Maps are overloaded with special tiles.** A typical 11-layer map carries
   ~12–13 special tiles out of ~27 (~47%): merchant ≈4–5, shrine ≈4, recruit ≈2,
   elite ≈2–3 — and the pre-boss layer is force-converted to *all* shops/shrines.
7. **The game is too easy at the top.** The balance harness reports the standard
   team never breaks up to Threat ×5, and the support sweep can't tell supports
   apart (a harness blind spot).

---

## 1. Stat reference — what each stat does, and how much

Damage is only ever **physical** or **magic** (no true damage). Everything a
tower does is folded into a runtime `CombatProfile` by `computeCombat()`
(`combat.ts:108-157`); the engine reads that, not the raw `Sentinel`.

### Core stats (`CoreStats`, `types.ts:7-11`)
Bases: fighter `12/6/3`, rogue `6/12/4`, mystic `4/5/13` (`archetypeTree.ts:59/83/106`).

| Stat | What it impacts | Exact effect | Dead? |
|---|---|---|---|
| **STR** | Physical hit damage; tower HP | `+4%` physical damage per point (`combat.ts:125,128`); `+9` maxHp per point (`combat.ts:134`) | HP half dead (non-fighters) |
| **DEX** | Attack speed; crit | `+2%` attack rate per point (`combat.ts:129`); `+0.4%` crit chance per point (`combat.ts:131`). *"Dodge" in the doc-comment is unimplemented.* | live |
| **INT** | Magic hit damage | `+4%` magic damage per point (`combat.ts:125,128`) | live (magic units) |

### Secondary stats (`Sentinel`)
| Stat | What it impacts | Exact effect | Dead? |
|---|---|---|---|
| **thorns** | Reflect to blocked enemies | flat `thorns/sec` to enemies this tower blocks (`engine.ts:347`) | **dead unless blocking (fighter-only)** |
| **patience** | Ramp over a wave | `patienceMax = 3 + floor(patience/5)` (`engine.ts:169`); each stack `+4%` to str/dex/int (`engine.ts:263`) | live |

### Attack profile → derived (`AttackProfile` `types.ts:14-31` → `combat.ts`)
| Derived | What it impacts | Exact formula | Modifiable by |
|---|---|---|---|
| **damage** | Per-hit damage | `(base + flatGearDmg)·(1 + statPct)·damageMult·sacBonus` (`combat.ts:128`) | str/int, gear dmg, damageMult |
| **rate** | Attacks/sec | `base.rate·(1 + dex·0.02)·rateMult·(1 + gear.atkSpeed)` (`combat.ts:129`) | dex, rateMult, atkSpeed |
| **range** | Targeting radius | `base.range·rangeMult` (`combat.ts:130`) | rangeMult only (no gear) |
| **critChance** | Crit odds | `clamp(base + dex·0.004 + critChanceAdd, 0, 0.95)` (`combat.ts:131`) | dex, critChanceAdd |
| **critMult** | Crit damage | `base.critMult + critMultAdd` (`combat.ts:132`) | critMultAdd only (no gear) |
| **splashRadius** | AoE radius | `base.splashRadius + splashAdd` (`combat.ts:133`) | splashAdd only (no gear) |
| **projectileSpeed** | Projectile travel | fixed per archetype (`combat.ts:144`) | **nothing** |
| **damageType** | phys/magic | fixed per archetype (`combat.ts:148`) | **nothing** |
| **dps** | display only | `damage·rate·(1 + critChance·(critMult−1))` (`combat.ts:137`) | — (UI only) |

### Defensive (gear-only; `combat.ts:134,152-153`)
| Stat | Effect | Status |
|---|---|---|
| **maxHp** | `round((70 + str·9 + gear.hp)·hpMult)` | **dead on non-fighters** (never decremented) |
| **physDef** | block mitigation `50/(50+physDef)` (`engine.ts:341`) | **dead on non-fighters** (only inside block branch) |
| **magDef** | — | **fully dead** (never read anywhere) |

Enemy damage taken: `dealt = amount·(1 − resist)`, `resist = physResist|magResist`
(`engine.ts:529-530`), default 0. Simple multiplicative; no penetration.

---

## 2. Dead-stat ledger

| Item | Where | Verdict |
|---|---|---|
| `magDef` | rolled on all off-hand/body items; never read by engine | **fully dead** |
| `Sentinel.attack` | set in `sentinels.ts:39`; never read | **fully dead** |
| `hp`/`maxHp`/`hpMult` | only decremented when blocking | dead on all non-fighters |
| `physDef` | only used in block mitigation | dead on all non-fighters |
| `thorns`/`thornsMult` | only reflects to blocked enemies | dead on all non-fighters |
| `healAura` | heals an HP pool that never drops | dead unless target is a blocking fighter |
| `dmgReductionAura` | reduces only blocking damage | dead unless target is a blocking fighter |
| `selfSacrifice` | its HP cost is free on invulnerable units | downside nullified → pure upside |
| DEX "dodge" | doc-comment only | unimplemented |

**Consequence for loot:** off-hand + body item bases (`physDef/magDef/hp`) are
worthless on rogue/mystic towers; the `warding` enchant (thorns), `k_barbs`
keepsake (thornsMult) and `k_vigor` keepsake (hpMult) are likewise dead there.

---

## 3. Item system

**Rarity** (`items.ts:29-37`): budget ×1.0/1.7/2.5/3.6, enchant slots 0/1/2/3,
drop weights 58/28/11/3 %. Base stats and enchant magnitudes both scale ×budget
(except `shock`/`pierce`, flat).

**Bases** — family noun is cosmetic; stats come from slot + weapon type:
- Weapons: phys→`physDamage`, magic→`magDamage`, **all**→`attackSpeed = speedBias·b`.
  1h dmg `round(5–8·b)`, 2h dmg `round(9–13·b)`. **7 physical vs 3 magic** families.
- Off-hand (5 families, identical): `physDef 3–6·b`, `magDef 3–6·b`, `hp 6–12·b`. **all dead on non-fighters**
- Body (5 families, identical): `physDef 6–10·b`, `magDef 5–9·b`, `hp 16–26·b`. **all dead on non-fighters**
- Keepsakes (5, body-slot trinket): empty base, team-wide enchant only.

**Enchants (14)**: might/precision/insight (str/dex/int), warding (thorns=dead),
patience, cruelty (critChanceAdd), heavy (damageMult), swift (rateMult), flaming
(burn), frost (chill), shocking (shock=flat), piercing (pierce=flat), vampiric
(lifedrain), executioner (execute). **Keepsakes (5)**: rally (damageMult),
quicken (rateMult), focus (critChanceAdd), vigor (hpMult=dead), barbs (thornsMult=dead).

**Negative tradeoffs in items:** ONLY 3 two-handers via negative `speedBias`
(Greatsword −0.05, Warhammer −0.08, Halberd −0.04). Everything else is upside-only.

**Prices** (`gameStore.ts:46`): item 30/60/110/200; reforge 20/35/60/100 gold or
4/7/12/20 dust; upgrade 50/90/150 gold (legendary gated off). Drop sources:
starting (3 fixed), reward cards, boss loot (3), campaign/endless merchants (4),
endless wave loot; luck biases rarity up a tier per source.

---

## 4. Progression coverage matrix

Legend: **I**=item/enchant, **M**=mutation, **E**=evolution, **R**=reward card, **H**=hub upgrade.

| Mod / stat | I | M | E | R | Verdict |
|---|:-:|:-:|:-:|:-:|---|
| str / dex / int | ✓ | – | ✓ | ✓ | **over-covered** (also level growth + hub) |
| damageMult | ✓ | ✓ | ✓ | ✓ | **over-covered (4)** — multiplies |
| rateMult | ✓ | ✓ | ✓ | ✓ | **over-covered (4)** |
| critChanceAdd | ✓ | ✓ | ✓ | ✓ | **over-covered (4)** |
| burn / chill / pierce / lifedrain | ✓ | ✓ | ✓ | – | well covered |
| shock | ✓ | ✓ | ✓ | – | ok |
| execute | ✓ | ✓ | ✓ | – | ok |
| rangeMult | – | ✓ | ✓ | – | **no gear path** |
| splashAdd | – | ✓ | ✓ | – | **no gear path** |
| critMultAdd | ✓* | – | ✓ | – | *only via crit synergy; mostly E-only |
| stunChance/Dur | – | ✓ | ✓ | – | offense-locked |
| block | – | – | ✓ | – | **evolution-only** (fighter) |
| thornsMult | ✓(dead) | – | ✓ | – | evolution-only + dead item |
| healAura / buffAura / dmgReductionAura | – | – | ✓ | – | **evolution-only** (support) |
| selfSacrifice / trap | – | – | ✓ | – | **evolution-only** |
| hpMult | ✓(dead) | – | ✓ | ✓ | dead outside fighters |
| **projectileSpeed** | – | – | – | – | **untouched by anything** |
| **damageType** | – | – | – | – | **untouched by anything** |

**Stacking caveat:** in `mergeMods` (`archetypeTree.ts:239-251`) statuses take the
**stronger, not the sum**, so doubling burn/chill/shock/auras across
mutation+evolution is largely wasted — elemental "over-coverage" is partly illusory.

### Mutations (11, `mutations.ts`) — uniform pick, no rarity, no real downside
volatile, chain, pierce, rapid, heavy, incendiary, cryo, executioner, siphon,
overcharge, concussive. Only `rapid` (dmg ×0.62) and `heavy` (rate ×0.6) have a
sub-1 factor, both net-positive DPS.

### Hub upgrades (6 + Sacrifice, `metaStore.ts`) — linear cost, no rarity
Reinforced Base (+5 base HP ×5), War Chest (+25 gold ×5), Seasoned Recruits (+1
all stats ×6), Standing Company (+1 sentinel ×2), Quartermaster (+1 item ×2),
Chronicler (+15% marks ×4). **Sacrifice** (uncapped): +1 stats, ×1.1 marks,
**+15% enemy HP** — the game's only downside knob.

### Evolution (3→9→27, `archetypeTree.ts`) — the only system with real tradeoffs
Pick 1-of-3 at L10 and L20. Downsides: `berserker` hpMult ×0.85, warlock line
`selfSacrifice`. Holds the entire tank/support toolkit.

### Reward stat cards (9, `rewards.ts`) — uniform, all upside, no rarity
Might/Finesse/Insight, Ferocity (crit), Haste (rate), Power (dmg), Vigor (hpMult=dead),
Barbs (thorns=dead), Resolve (patience).

---

## 5. Map generation (`runmap.ts`)

11 layers; middle layers 1–9 have `rng.int(2,4)` nodes (mean 3, ~27 middle).
Type weights: battle 52 / elite 14 (L≥3) / merchant 12 / shrine 12 / recruit 10
(L≤7). Memoryless — no caps, no spacing. `ensureType` guarantees ≥1 of each.
Pre-boss layer 9 force-converts **every** node to merchant (60%)/shrine (40%).

**Expected specials per map:** merchant ≈4–5, shrine ≈4, recruit ≈2, elite ≈2–3
→ **~12–13 specials of ~27 (~47%)**. Merchant+shrine alone ≈8. Specials cluster
(whole pre-boss layer) and repeat back-to-back (no spacing). Target: ~4–6.

Intervention points: the per-node assign loop (`runmap.ts:107-114`, add
count caps + min-layer spacing), `weightedType` weights, and the pre-boss loop
(`:118`, convert at most one node).

---

## 6. Balance harness (`balance/`, `npm run balance`)

Real headless engine sim, seeded/reproducible. 6 sweeps: spec throughput (27),
support value, item rarity ladder, enchant strength, threat ceiling, Monte Carlo
full runs. CI-gating invariants. Latest report: 68% MC win rate, offense spread
2.2×, Sharpshooter outlier, **support sweep non-discriminating**, **threat ceiling
never breaks up to ×5** (too easy), rarity ladder monotonic.

Gaps to fix: `baseStatTotal` counts dead `physDef/magDef/hp`; no sweep for
tradeoffs, negative items, upgrade trees, or map special-tile counts; threat
invariant far too loose.
