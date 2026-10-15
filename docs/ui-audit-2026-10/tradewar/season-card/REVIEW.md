# The standings' season card — two rounds of review (October 2026)

The designer, on the standings page's season card, verbatim: *"This needs some
info arch and copy iterations."* Then, on the trade war as a whole: *"It
doesn't really make sense to me what I'm looking at"* → **option 1, simplify**:
keep the shares, the crown (an outright leader only) and desperate terms;
reward the company you delivered the most for (your **patron**); cut the
champion threshold, exclusives, rivals and cold. This card was rebuilt for
the simplified war.

The card it replaced:

```
WHEN THE SEASON ENDS · THE LEADER PAYS
Its purse ............................ 75 a delivery
A pick from its vault ................ 1 of 3 items
The last posts desperate terms ....... ×1.5 pay
Its top militia delivers 2 or more of its contracts in the season.
Ironvein leads, and you have delivered 0.
```

The lead's findings: the kicker said "the leader pays", but its third row was
about last place and is no payment; the pay rows did not say who is paid; the
line that mattered most (your status) was a footnote, phrased as a rule about
some other "top militia"; "Its purse … 75 a delivery" was unclear; the copy
was jargon.

Every shot is the running app (Vite dev, Playwright Chromium at
`/opt/pw-browsers`), the season seeded through `window.__meta.setState`, the
standings opened from the home's season pill. Viewports 390 × 844 (@2x; a
`-scrolled` shot is the same page scrolled to the card) and 1280 × 800.
States:

- **none**: no delivery yet this season (contract 3 of 7).
- **ahead**: one company ahead in your deliveries (Ironvein 2, Peppercorn 1).
- **tied**: two companies level in your deliveries (Ironvein 2, Easel House
  2; Ironvein's share is bigger).
- **last**: the season's last contract is next (Ironvein 3).
- **even** (round 2): a fresh war, every share 20%: no crown, no last place.
- **end-patron / end-none** (round 2): the season's end with and without a
  patron.

Scored against `docs/DESIGN_REVIEW.md`'s checklist and `DESIGN_SYSTEM.md` § 8.
Benchmarked against Clash Royale's season pass card (one status line, then
the rewards) and Slay the Spire's run summary (one sentence per fact, numbers
on the right).

---

## Round 1 — `r1/`

The same facts were laid out three ways. Shots: `a-*`, `b-*`, `c-*`.

**A, one ledger slip under the rows** (`a-*-phone-scrolled.png`,
`a-*-desk.png`). A paper slip in three parts. First the eyebrow "Your patron ·
4 contracts left". Then a status line: a crest, "Ironvein is your patron", and
the reason. Then "It pays you when the season ends" over three `SlipLine`s
(per delivery, the item pick, and "So far · 2 delivered" as the total line).
Last, "Next season" with the company last now.
- + One surface and one reading order. Every number is a `.field-k` /
  `.field-v` row, and the running amount stands out.
- − "Patron" twice (eyebrow and headline). "Next season" twice (the kicker
  and the terms line). The total line sits under the item row, so it reads
  as a sum of both. The card is tall (≈ 350 px on a phone).
- − The terms line was red on paper, a second alarm next to the desperate
  chip.

**B, status first, above the rows** (`b-*-phone.png`, `b-*-desk.png`). A dark
status panel at the top: crest, headline, a big "150 · 2 delivered" on the
right, and seven season pips with "4 contracts left". Below it, a paper slip
"When the season ends, your patron pays" and a dark "Season 3" panel with the
company last now. Then the rows.
- + Your status is the first thing you read, and the running amount scans
  at a glance.
- − Three boxes in three styles (dark, paper, dark) before the standings.
  The page's subject (the rows) starts halfway down a phone.
- − The pips and "4 contracts left" say one fact twice, and "2 delivered"
  repeats the rows' "You delivered" column. The headline wraps around the
  sum.

**C, two sentences on the paper** (`c-*`). The header kept "Contract 4 of 7".
The card was "Ironvein, your patron, pays you 75 gold a delivery: 150 so far
for 2, and a pick of 1 of 3 of its items." and "Rosethread is last now: next
season it pays ×1.5, and its raiders are 20% stronger."
- + The shortest version, and the rows stay first.
- − The numbers are buried in prose, so nothing scans. It breaks § 8's
  `.field-k` / `.field-v` rule for facts. The tie and no-patron sentences
  run to three lines.

**Pick: A**, taking B's lesson: the running amount belongs on the status
line, not on a total row.

## Round 2 — `r2/`

The winner was refined, and B and C were deleted. The words moved into a pure
model (`ui/shell/war/seasonCardCopy.ts`, tested per state in
`tests/seasonCardCopy.test.ts`).

- **Eyebrow = when it ends, said once on the page.** "The season ends in 4
  contracts", or "The season's last contract is next". The header's
  "Contract N of 7" is gone, so the page says this once. The first try,
  "When the season ends · after your next contract", wrapped on a phone and
  was shortened.
- **Status line.** The crest (two overlapping on a tie, a dashed empty seal
  with none), the headline and why, with the running amount on the right
  ("150 / SO FAR"). The rows already show the delivery count, so the card
  does not repeat it.
- **Two pay rows.** "Each contract you deliver for it ··· 75 gold". The first
  try, "For each of its contracts you deliver", wrapped. Then "One Ironvein
  item ··· pick 1 of 3".
- **Foot.** The crest and "Last now: Rosethread", then "Next season it pays
  ×1.5, and its raiders are 20% stronger" in slip ink, not alarm red.
- **Rows.** A crown only for an outright leader, and level shares share a
  place (`even-*`: five "1"s, no crown). The desperate chip is the only tag
  left; the exclusive and cold tags are gone.
- **CTA.** The desperate company's terms, else your patron's, else the
  leader's. A fresh, even war has none, which is honest: no company stands
  out.
- **Season's end** (`end-*`). Patron: "Easel House pays you", "Your patron:
  you delivered the most for it this season.", a "Banked" slip ("For your 3
  deliveries · 75 each ··· 225"), then "Pick one of Easel House's items" (the
  shared `PickStrip` + `PickCard`). No patron: "No company pays you" and "You
  delivered no contracts this season." Both end on the Season 3 panel: the
  company that finished last with its terms, then the crowned leader (or "No
  company leads").

### The final card, per state

| State | Eyebrow | Headline | Why | Right |
| --- | --- | --- | --- | --- |
| none | The season ends in N contracts | No patron yet | Whichever company you deliver the most for pays you. | – |
| none, last contract | The season's last contract is next | No patron yet | Deliver your next contract, and its company pays you. | – |
| ahead | The season ends in N contracts | Ironvein is your patron | You delivered the most for it this season. | 150 so far |
| tied (share breaks it) | … | Ironvein and Easel House are level | A tie goes to the bigger share: Ironvein pays, for now. | 150 so far |
| tied (shares level too) | … | … are level | Your deliveries and their shares are level: Ironvein pays, for now. | … |
| last contract | The season's last contract is next | (as above) | (as above) | (as above) |

The rows on every state: "Each contract you deliver for it · 75 gold" and
"One Ironvein item · pick 1 of 3" ("One of its items" with no patron). The
foot, whenever some company is last: "Last now: Rosethread · Next season it
pays ×1.5, and its raiders are 20% stronger".

### Scored

- One title, one CTA. Each fact once: shares and per-company deliveries are
  on the rows, the season clock is in the eyebrow, and the terms are in the
  foot. No standing hint: the card states rules and status, never "try X".
- Tokens only (`--slip-ink*`, `--fs-*`, `--font-display`). Every number is a
  `.field-k` / `.field-v` pair or a `SlipLine`.
- **Left as is:** on a 1280 × 800 desk the card starts below the fold under
  five rows (≈ 160 px scroll), as the old card did. The page stays one
  column. A desk layout with the card beside the rows is a separate change
  to `ContractPage`.
