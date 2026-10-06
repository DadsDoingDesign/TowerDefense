# Fieldwatch UI audit: what to borrow from Supercell, Riot and mobile roguelites

October 2026 · branch `claude/compassionate-johnson-pzt0qc` off `main @ 1b43846`

This folder holds:

| File | What it is |
| --- | --- |
| `AUDIT.md` | This document: the current-UI audit, the research on how other games set up their UI, and the patterns we take from them |
| `mockups.html` | The **20 mockups**, as phone frames built from the game's own tokens, icon atlas (`fw-icons.png`), CC0 sprites and battlefield renders. Open it in a browser (it pulls two Google Fonts and falls back to system faces offline) |
| `current/` | Seven 390×844 captures of today's build: home, hero pick, run map, placement, hero selected, sub-wave held, spoils |
| `assets/` | The renders and sprites the mockups draw on. Every sprite is a copy of a file already shipped under `public/assets/` (CC0, see `public/assets/CC0-MANIFEST.md`); the `field-*.png` and `world-map.png` files are crops of the running game |

> **How the research was done.** Three research passes ran in parallel (Supercell; Riot; mobile roguelites and TDs). The sandbox's proxy blocked full-page fetches for most sites, so the facts below rest on search-result summaries of the linked pages. Where a point comes from first-hand knowledge of the game rather than a cited page it is marked **[obs]**. Check those in-game before building on them.

---

## 1. Today's loop, screen by screen

Captured on a 390×844 phone from a real run (`current/`).

| # | Screen | What works | What gets in the way |
| --- | --- | --- | --- |
| 1 | Home | The world map as a backdrop; one CTA | Codex, Settings, the contract banner and the CTA all have equal weight. The CTA says "Take the free escort", the system's word rather than the player's |
| 2 | Hero pick | A clear "Choose X" CTA | Three cards, each 3–5 lines of rarity and skill prose; the hero art is a 40px thumbnail |
| 3 | Run map | Branching nodes; select, then march | You see one row ahead. Threat is "+70%"/"+380%". The preview takes the whole lower half |
| 4 | Placement | Tap the hero, then tap a tile | Around 150 tiles glow the same way. The range and the tile's value only show after placing. A coach banner pushes the field down |
| 5 | Hero selected | Stats/Skills tabs | The field shrinks to a third of the screen. The next skill appears as a sentence |
| 6 | Sub-wave held | An interesting mechanic (move one hero mid-fight) | Explained by a two-line paragraph. The next sub-wave is one 24px icon |
| 7 | Spoils | Three offers with rarity colour; the paper doll exists | Names truncate ("Swift Shi…"). There's no comparison against what the hero wears, and taking an item needs select, then "Take it". Detail, doll and pack share 360px |

### Problems (P-numbers used by the mockups)

- **P1 · Coaching is written, not shown.** 13 one-time "Got it" tips (`coachRules.ts`), shown one at a time, each 60–90px tall and pushing the field down while it's up.
- **P2 · Placement gives no guidance.** Every legal tile looks equally good. Range and coverage appear only after you commit.
- **P3 · The Selector band is mostly empty.** A 126px band holds one or two 92px cards in a run that starts with one hero.
- **P4 · The header spends a row on the wordmark.** "FIELDWATCH" and a full-width cargo bar take 76px on every screen.
- **P5 · Enemy intent is hidden.** Armour, speed, explosions and the sub-wave split are invisible until they hurt.
- **P6 · Gear and skill effects can't be seen.** Affixes and skills fire silently, and nothing credits them after the wave.
- **P7 · Loot is compared in your head.** No delta against equipped gear, no slot-fit hint, no direct equip.
- **P8 · The economy is explained in prose.** Purse vs bank, road tax, interest capped at 40 and city pay are text strings, never a receipt.
- **P9 · Threat is an abstract percentage**, so nodes can't be compared at a glance.
- **P10 · Rewards land without ceremony.** Gold, XP and level-ups don't move into the counters they change.

The Root Shell's four rules ("one interaction", "the Stage is sacred", "the pack is permanent", "modals are for regret only", `docs/FIGMA.md`) are sound. Most of the problems above come from **prose standing in for feedback** and from **showing every option at once**, not from the shell itself.

---

## 2. Supercell

Games covered: Clash Royale (CR), Clash of Clans (CoC), Brawl Stars, Boom Beach, Hay Day, Squad Busters, mo.co, Clash Mini, CR Merge Tactics.

### Screen architecture
- **Everything important is in the bottom half; navigation is almost never more than one level deep** ([Górnicki, UX in Clash Royale pt 1](https://www.artstation.com/blogs/dasp/90l/ux-in-clash-royale-part-1)).
- CR's bottom tab bar is Shop / Cards / **Battle (centre, default)** / Clan / Events. Tabs swipe as one carousel, and the active tab grows and gains a label **[obs]**.
- **2025 Game Mode Switcher.** Modes buried in tabs (Ranked, Merge Tactics) moved next to the Battle button ([Supercell, June 2025](https://supercell.com/en/games/clashroyale/blog/release-notes/june-update-2025/), [RoyaleAPI](https://royaleapi.com/blog/trophy-road-rework-2025-q2-update?lang=en)). The lesson: whatever sits in a tab goes unplayed.
- Launch popups are capped at about one; everything else becomes a badge, because sessions last 2–5 minutes ([watanuxdesign](https://watanuxdesign.medium.com/why-clash-royale-has-one-of-the-best-user-experience-design-part-1-fb9c761042c7)).
- Brawl Stars puts the selected brawler centre stage with a big yellow **Play** button bottom-right and the mode picker beside it ([Pratt critique](https://ixd.prattsi.org/2025/02/design-critique-brawl-stars/)).
- Squad Busters' hub is a plaza where unlocked characters wander and drop coins when tapped ([TalkAndroid](https://www.talkandroid.com/478545-squad-busters-ultimate-beginners-guide/)). mo.co's hub is an apartment that fills as features unlock ([mo.co wiki](https://mo-co.fandom.com/wiki/Beginner's_Guide)).

### In-battle HUD
- **CR hand:** 4 cards plus a smaller **Next** card ([fandom](https://clashroyale.fandom.com/wiki/Basics_of_Battle)). Cards you can't afford dim but keep their art. The elixir bar has 10 segments, and a "2x Elixir" banner announces the double-rate phase ([fandom Elixir](https://clashroyale.fandom.com/wiki/Elixir)).
- The arena takes the upper ~75%. Information is attached to units (tower HP floats over each tower) rather than shown in panels.
- **Brawl Stars** offers two input styles at once: tap the attack button to auto-aim, or drag it to aim by hand ([fandom](https://brawlstars.fandom.com/wiki/User_blog:Speedmaster6670/Brawl_Basics:_How_to_Play)).
- **Boom Beach flares:** one energy pool, one active flare that redirects every troop, and each use costs more than the last ([fandom Flare](https://boombeach.fandom.com/wiki/Flare)). This is the model for **one meaningful nudge during an autobattle**.

### Placement
- **CR offers drag-and-drop or tap-then-tap**, snapped to a tile grid, with no confirm step ([Górnicki](https://www.artstation.com/blogs/dasp/90l/ux-in-clash-royale-part-1)). A ghost of the unit follows the finger and the forbidden half is shaded **[obs]**.
- **CoC** flashes a red outline around the no-deploy zone when you tap inside it **[obs]**, and edit mode outlines where enemies can spawn ([supercheats](https://www.supercheats.com/clash-of-clans/walkthrough/the-no-spawn-zone)).
- **Clash Mini** (portrait, the closest Supercell game to ours): drag cards onto a 5×8 board, place a duplicate on a unit to star it up, and press **Ready** to end deployment. A 2023 change locked units between rounds so only the hero moves ([fandom](https://clashmini.fandom.com/wiki/Version_History)).
- **Merge Tactics**: 3-card shop, 5-slot bench, auto-merge of two identical units, and **drag back onto the shop to sell** ([RoyaleAPI](https://royaleapi.com/blog/merge-tactics-2025-july?lang=en)).
- **Hay Day** patented "one swipe acts on many fields" ([US8448095](https://patents.google.com/patent/US8448095)), which replaces many taps with one gesture.

### Upgrades, rewards and juice
- In CR the card progress bar is blue while filling and turns **green with an up-arrow** when an upgrade is ready ([timesaver](https://timesaver.gg/blog/clash-royale-card-levels-explained-september-2026)). The upgrade shows green "+N" per stat, then a count-up ceremony **[obs]**.
- **Colour roles:** yellow is the main action, green is a secondary positive action (upgrade, buy), red is a notification, blue is chrome ([Górnicki pt 3](https://gornicki.me/blog/Bd87/ux-in-clash-royale-part-3)).
- **Coins fly into the counter** ([Game Economist Consulting](https://www.gameeconomistconsulting.com/the-best-currency-animations-of-all-time/)). CR Lucky Drops and Brawl Stars Starr Drops are **tap-to-upgrade reveals whose outcome is decided before the animation** ([GameRant](https://gamerant.com/clash-royale-how-do-lucky-drops-work/), [timesaver](https://timesaver.gg/blog/brawl-stars-starr-drops-july-2026)).
- CR's 2026 GDC talk named its lessons as novelty, accessibility and **simplifying systems** ([GDC](https://schedule.gdconf.com/session/recent-bets-outcomes-from-supercells-clash-royale/917002)).

### Onboarding
- The CR tutorial drops you into the arena in the first second. It suggests moves without forcing them, speeds up elixir, and pays a reward after every one of three tutorial fights ([fandom Training Camp](https://clashroyale.fandom.com/wiki/Training_Camp)). Features unlock by arena ([fandom Arenas](https://clashroyale.fandom.com/wiki/Arenas)).
- The CoC tutorial is a short story with a guaranteed win ([supercheats](https://www.supercheats.com/clash-of-clans/walkthrough/tutorial)).

### Stated principles
- Paananen: games for as many people as possible, which players keep for years ([Sequoia](https://sequoiacap.com/podcast/supercell-ft-ilkka-paananen-how-an-early-pivot-led-to-clash-of-clans-and-brawl-stars)).
- **Brawl Stars dropped portrait** because fingers covered the action ("landscape or kill", [DoF](https://www.deconstructoroffun.com/blog/2018/5/11/bs)). Portrait works when the player issues **indirect commands from a bottom band** (CR, Mini, Merge Tactics). Fieldwatch is on the safe side of that line.
- Squad Busters' reboot admitted its accessible controls and intense play "fell between two stools" ([mobilegamer.biz](https://mobilegamer.biz/inside-supercells-big-squad-busters-reboot/)). Pick one focus.

---

## 3. Riot Games

Games covered: Teamfight Tactics (PC and mobile), Legends of Runeterra / Path of Champions (PoC), League of Legends, Wild Rift, Valorant.

### Teamfight Tactics, the closest genre cousin
- **Put a cause next to its effect.** Patch 9.24 put Buy XP, Level and the per-tier drop odds side by side because the link "was not an obvious, understandable one" ([TFT Interface Update](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/tft-interface-update/)).
- **"Tough choices, not touch execution"** (David Abecassis, GDC). Auto star-up and auto-combine remove busywork ([Pocket Tactics](https://www.pockettactics.com/teamfight-tactics-design), [GDC Vault](https://gdcvault.com/play/1026808/-Teamfight-Tactics-Design)).
- **Shop card glow** when you already own a copy ([TFT wiki 11.9](https://wiki.leagueoflegends.com/en-us/TFT:V11.9)). Team Planner marks planned units ([esports.gg](https://esports.gg/news/teamfight-tactics/tft-tip-tuesday-how-to-utilize-the-ui-tools/)).
- **Gold and interest:** +1 per 10 held, capped at 5. Hovering the gold shows next round's income ([TFT wiki Gold](https://wiki.leagueoflegends.com/en-us/TFT:Gold)).
- **Items:** every finished item is two components. Dragging one over another shows the result **before you let go** ([metabot](https://metabot.gg/en/TFT/guides/tft-items-components-recipes-how-to-combine)). Set 13 moved items to a toolbar that combines in place and holds 20 ([/dev QoL](https://teamfighttactics.leagueoflegends.com/en-us/news/dev/dev-quality-of-life-improvements/)). The inspect panel shows **item role tags** and recommended positioning ([TFT wiki 13.12](https://wiki.leagueoflegends.com/en-us/TFT:V13.12)).
- **Trait tracker:** active traits are lit in their tier colour, inactive ones are dimmed and show progress ("1/2"), and it updates live ([tft.ninja](https://tft.ninja/guides/game-mechanics/traits/overview)).
- **Augments:** pick 1 of 3, tiered silver/gold/prismatic, with **one reroll per card** ([dotesports Set 9](https://dotesports.com/tft/news/huge-quality-of-life-changes-in-tft-set-9-improve-player-experience)).
- **Round tracker** with an icon per upcoming round, plus a preview of the next PvE monsters ([mobalytics](https://mobalytics.gg/tft/guides/tft-beginners-guide)).
- **TFT mobile** is landscape only. The shop toggles and **opens itself at each round**, a finger-friendly item panel slides in from the side, and tap-to-inspect replaces hover ([TFT Mobile Update](https://teamfighttactics.leagueoflegends.com/en-us/news/riot-games/teamfight-tactics-mobile-update/)). Early reviews complained about mis-drops onto the wrong hex ([dotesports](https://dotesports.com/tft/news/tft-mobile-hands-on-good-fun-but-definitely-not-perfect)), so drop targets need to be generous.

### Legends of Runeterra / Path of Champions
- Map nodes stay hidden until reached, **except boss and power nodes**, so the big goals are always in view. Fixed rhythms such as a healer before each boss ([LoR wiki Nodes](https://wiki.leagueoflegends.com/en-us/LoR:The_Path_of_Champions_1.0/Nodes)).
- Pick-3 powers with reroll tokens. Relic slots are gated by rarity and accept their own rarity or lower ([Relics](https://leagueoflegends.fandom.com/wiki/Relics_(The_Path_of_Champions))).
- **The shop sells cards with the item already attached**, so you see the result before paying ([Shop](https://leagueoflegends.fandom.com/wiki/Encounters_(The_Path_of_Champions)/Shop)).
- Card inspect enlarges the card and gives every keyword its own tooltip. Keywords share one icon grid ([Riot Dribbble](https://dribbble.com/shots/11615002-Legends-of-Runeterra-Keyword-Icons)).
- **Oracle's Eye** previews how combat will resolve before you commit ([LoR wiki](https://wiki.leagueoflegends.com/en-us/LoR:Oracle's_Eye)).

### League, Wild Rift, Valorant
- The League shop's design goal is "purchasing is quick and intuitive". It has recommended builds from player data, and a **queued item turns the shop icon into a ring that fills with gold and lights up when affordable** ([Preseason Item Shop](https://www.leagueoflegends.com/en-us/news/dev/preseason-item-shop-update/), [LoL wiki Shop](https://wiki.leagueoflegends.com/en-us/Shop)).
- Wild Rift: a **"+" on an ability when a point is free**, with optional suggest and auto-level assists. The recommended item lights up when you can afford it ([ONE Esports](https://www.oneesports.gg/wild-rift/wild-rift-beginners-guide-everything-you-need-to-know-about-the-client/)).
- League **pruned its ping wheel** (Bait and the vision wheel) for clutter ([dotesports](https://dotesports.com/league-of-legends/news/riot-introduces-revamped-ping-wheel-objective-voting-league-2023-preseason)).
- Valorant's buy menu shows **"MIN NEXT ROUND"**, so the cost of spending now is visible ([thespike](https://www.thespike.gg/valorant/beginner-guides/valorant-economy-guide)). Enemy highlight colour has colourblind options ([dotesports](https://dotesports.com/valorant/news/how-to-change-enemy-highlight-color-in-valorant)).

### Principles Riot states
- **"Visual impact should represent gameplay impact"**; brightness (value) contrast is the strongest tool. Priorities run clarity, minimal clutter, theme, then delight ([League VFX style guide](https://nexus.leagueoflegends.com/en-us/2017/10/dev-leagues-vfx-style-guide/)).
- A champion has to read instantly even in a skin ([Ask Riot: Clarity](https://www.leagueoflegends.com/en-us/news/dev/ask-riot-let-s-talk-clarity/)).
- One colour ramp per concept, each with a shape or icon as backup.

---

## 4. Mobile roguelites and tower defense

Games covered: Balatro, Slay the Spire, Luck be a Landlord, Vampire Survivors, Archero 1–2, Kingdom Rush, Bloons TD 6, Rogue Tower, Legend of Keepers, Backpack Battles, Super Auto Pets, Dicey Dungeons, Loop Hero, Monster Train, Ball x Pit, Hades, Dome Keeper, Thronefall.

### Balatro
- **Tap selects; hold-and-drag moves.** On mobile, the PC's small Sell/Use tabs became **drag-to-zone** ([Balatro Wiki Controls](https://balatrowiki.org/w/Controls), [Android Police](https://www.androidpolice.com/balatro-hands-on/)).
- **The sell zone sat next to the end of the most common reorder drag**, and players sold jokers by accident; patches 1.1.1–1.1.4 kept moving it ([GameRant](https://gamerant.com/balatro-mobile-port-sell-mechanic-problem/)). Destructive drop zones belong far from reorder gestures.
- **The scoring ceremony explains every number.** Cards pop +chips (blue) and +mult (red), each joker wiggles as it fires, and screen shake grows with the score ([blakecrosley](https://blakecrosley.com/guides/design/balatro)).
- The shop layout never changes (2 cards, 2 packs, 1 voucher) and the reroll gets dearer each time ([dood.gg](https://dood.gg/en/balatro/guides/shop-guide/)). Skipping a blind pays a Tag. A Run Info button holds the reference sheet. Speed runs from 0.5× to 4× ([Settings](https://balatrowiki.org/w/Settings)). It won a 2025 Apple Design Award for Delight and Fun ([Apple](https://www.apple.com/newsroom/2025/06/apple-unveils-winners-and-finalists-of-the-2025-apple-design-awards/)).

### Slay the Spire
- **Intents:** icons over each enemy show its next action ([wiki](https://slaythespire.wiki.gg/wiki/Intent)). StS2 lays multiple intents side by side ([untapped.gg](https://sts2.untapped.gg/en/guides/how-to-read-enemy-intent)).
- The mobile port kept PC-sized targets and lets cards play by accident while you inspect them ([TouchArcade](https://toucharcade.com/2020/06/15/slay-the-spire-ios-review-iphone-ipad-performance-icloud-megacrit-humble-games/)). That's the cautionary tale.
- The whole act's map is visible, so routing is the strategy ([map](https://slay-the-spire.fandom.com/wiki/Map_locations)). Skip can pay something (Singing Bowl, [wiki](https://slaythespire.wiki.gg/wiki/Singing_Bowl)).

### Kingdom Rush and Bloons TD 6 (tower flows on touch)
- **Kingdom Rush:** tap a plot and a **ring of towers with prices** opens around it. Tap one to preview (range shows), tap again to build; tapping outside cancels for free. Upgrading and selling also take 3 taps from the same ring. The rally point is set by tapping inside a range circle, and it works while paused ([Emily Miles](https://emilym.space/thumbelina-hurts-mobile-ui-blog/2018/6/26/kingdom-rush-a-tower-defense-trilogy-with-ui-design-approaching-perfection-and-entertainment-worth-missing-bedtime-for), [KR wiki](https://kingdomrushtd.fandom.com/wiki/Upgrades)).
- **BTD6:** drag to place, with the range circle turning red on invalid ground and an optional ✓/✗ "Drop and Lock" mode. The upgrade panel opens **on the side away from the tower**. Three upgrade paths show tier pips and "Path Closed". A targeting toggle cycles First/Last/Close/Strong, and a pop count proves each tower is pulling its weight ([Blooncyclopedia](https://www.bloonswiki.com/Bloons_TD_6_(mobile)), [Crosspathing](https://bloons.fandom.com/wiki/Crosspathing), [Pop Count](https://bloons.fandom.com/wiki/Pop_Count)).

### Choices, items and merging
- **Pick 1 of 3** is the standard (StS, Luck be a Landlord, Hades, Archero, Ball x Pit). VS adds Reroll, Skip and Banish charges ([VS wiki](https://vampire.survivors.wiki/w/Level_up)).
- **Hades:** a rarity frame plus a slot icon plus a NEW/upgrade marker. Poms show old → new values ([Boons](https://hades.fandom.com/wiki/Boons)).
- **Super Auto Pets:** shop row over team row, drag a duplicate onto a pet to merge it (an XP bar fills), and Freeze keeps an item through rerolls ([SAP wiki](https://superautopets.wiki.gg/wiki/The_Basics)).
- **Archero:** merge 3 identical items into the next rarity ([wiki](https://archero.fandom.com/wiki/Category:Equipment)). The Devil offer is a choice with a visible cost.
- **Backpack Battles:** adjacency stars light up while you drag, so synergy shows spatially ([wiki](https://backpackbattles.wiki.gg/wiki/Game_Mechanics)).
- **Loop Hero mobile:** tap-tap or drag, your choice; green and red stat arrows on gear ([TouchArcade](https://toucharcade.com/2024/05/03/loop-hero-mobile-review-iphone-15-pro-ipad/)).
- **Ball x Pit:** Fusion merges two maxed balls **and frees a slot** ([wiki](https://ballxpit.fandom.com/wiki/Fission,_Fusion,_and_Evolution)).
- **Thronefall:** one currency, and coins float into slots drawn above the building, so the cost is part of the world ([I.N.T.](https://int-magazine.com/interview/paul-schnepf-of-thronefall/)).
- **Dome Keeper's anti-pattern:** gating the wave timer and HP behind tech drew complaints ([Steam](https://steamcommunity.com/app/1637320/discussions/0/3187989286462506092/?ctp=2)). Never gate core information.

---

## 5. Pattern catalogue mapped to Fieldwatch

| Pattern | Source | Problem it solves here | Mockup |
| --- | --- | --- | --- |
| Raised centre "Battle" tab, mode switcher beside it | CR, Brawl Stars | Home has four equal weights | 01 |
| Hero showcase, icons over words | Brawl Stars, Hades | Hero pick is three paragraphs | 02 |
| Whole act visible, intents per node, boss pinned | StS, PoC, TFT tracker | Map shows one row; threat as % | 03 |
| Arena top, hand of cards bottom, Next card | CR | Field gets 52%; empty Selector | 04 |
| Ghost + range + coverage while dragging; best tiles starred; red no-go zone | CR, CoC, BTD6, Backpack Battles, Oracle's Eye | 150 identical glowing tiles | 05 |
| Ring of verbs around the selected tower | Kingdom Rush, BTD6 | Hero panel shrinks the field | 06 |
| One-tap targeting cycle with target preview | BTD6, Wild Rift | Tactics hidden in a tab | 07 |
| Intent rail, keyword chips, early call bonus | StS, TFT, KR, LoR | Wave is "×8" and a Details button | 08 |
| Controls float in the bottom corners during the wave; speed pill | CR, mo.co, Balatro, SAP | Unusable bands during the wave | 09 |
| One nudge per pause as a spendable token | Boom Beach, KR rally, Clash Mini | Paragraph explaining the hold | 10 |
| Proc pops, then a chips × mult damage receipt | Balatro, BTD6 pop count, League VFX guide | Affixes and skills are invisible | 11 |
| Coins fly to the counter; tap-to-upgrade loot reveal | Supercell, CR Lucky Drop, Starr Drop | Rewards land without motion | 12 |
| Pick 1 of 3 with deltas against equipped, best-fit hero, paid skip | Hades, Loop Hero, CR "+N", StS | Loot compared in your head | 13 |
| Drag an item onto a unit with a result preview | TFT, PoC | Doll, pack and detail share 360px | 14 |
| Merge three of a kind, preview first, auto option | Archero, SAP, TFT, Ball x Pit | Duplicate clutter; hidden fusion | 15 |
| Level-up event: 3 cards, a reroll each, peek, "+" badge | TFT augments, VS, Hades, Wild Rift | Skill pick is a sentence in a tab | 16 |
| Fixed shop anatomy, freeze, owned glow, drag-to-sell | Balatro, SAP, TFT, Merge Tactics | Merchant read one card at a time | 17 |
| Breakpoint tracker for team roles against wave needs | TFT traits, LoR keywords | Gear roles invisible at team level | 18 |
| Cash-out receipt; interest pips toward the cap; "hold N more" | Balatro, TFT, Valorant | Economy taught in prose | 19 |
| Ghost hand performs the action; features unlock on milestones | CR, CoC, mo.co | 13 text coach tips | 20 |

Smaller patterns that fit inside the above:
- **Colour roles** (CR): gold for the primary action, teal for the secondary CTA the game already uses, green for upgrade/positive, red for badges and unaffordable. Badges are red for new and green ↑ for can-act.
- **Long-press opens a keyword card everywhere** (LoR, Balatro, SAP). Tap selects, drag commits, hold inspects.
- **Tap-tap as an accessibility alternative to every drag** (CR, Loop Hero, StS).
- **Destructive actions take a hold or sit far from reorder gestures** (Balatro's sell-zone lesson; KR keeps its confirm for sell).

---

## 6. Order of work

| Phase | Mockups | Why first | Likely files |
| --- | --- | --- | --- |
| 1 · Read | 08, 13, 19, 16 | Mostly presentation of data the store already has; the biggest clarity gain for the lowest risk | `src/ui/shell/WaveQueue.tsx`, `DetailBand.tsx`, `offers.ts`, `SkillCards.tsx`, `src/game/run/settle.ts` |
| 2 · Place | 05, 20, 10 | Fixes the first 30 seconds of every run; one shared ghost, ring and star renderer | `src/ui/SlotLayer.tsx`, `src/ui/BattleCanvas.tsx`, `src/game/render/overlays.ts`, `src/ui/shell/Coach.tsx` |
| 3 · Frame | 04, 09, 06, 07 | Re-budgets the four bands, so it comes after the content is settled | `src/ui/shell/RootShell.tsx`, `src/styles/shell.css`, `src/ui/shell/live.ts` |
| 4 · Feel | 11, 12 | The "fun" layer; needs a per-source damage ledger and an FX budget | `src/game/render/fxDiff.ts`, `fx.ts`, `src/ui/battleLedger.ts`, `src/ui/shell/WaveCeremony.tsx`, audio |
| 5 · Build | 14, 15, 17, 18 | Deeper pack and shop changes; do them once 13 shows which comparisons players read | `src/game/run/inventory.ts`, `economy.ts`, `contractSlice` |
| 6 · Shell | 01, 02, 03 | Front door and map; the biggest visual change, best paired with the art pass | `src/ui/components/RunMapView.tsx`, shell title/menu states |

Every phase that changes visuals or feel runs the design review loop in `docs/DESIGN_REVIEW.md` before it ships (per `CLAUDE.md`).

### What the mockups assume
- **Star ratings and coverage (05)** need a cheap per-tile score: road length within range, weighted by bends. `src/game/run/` is the place for the pure function, so the balance harness can read it.
- **Role targets (18)** come from the next wave's composition (`src/game/data/waves.ts`). It's a lens over existing gear roles, not a new trait system.
- **The damage receipt (11)** needs the engine's per-hero damage split into base, gear and skill contributions. `FxDiffer` already derives procs tick by tick; the totals belong in the `BattleResult`.
- **The rarity reveal (12)** decides the outcome before the animation, as CR and Brawl Stars do, so it never touches RNG draw order.
