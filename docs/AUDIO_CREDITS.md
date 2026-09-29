# Audio provenance and licences

Every sound Fieldwatch can make, where it came from, and under what terms. This
repository is public, so the rule is simple: **if a licence cannot be verified
from a file shipped in this repository, the audio does not ship.**

Last verified: 2026-08-21.

---

## 1. Interface samples — 10 × `.wav`

| | |
|---|---|
| **Files** | `public/assets/audio/ui/{back,click,close,confirm,equip,error,open,reward,select,toggle}.wav` |
| **Pack** | Kenney, *Interface Sounds* (1.0), created 2020-02-11 |
| **Source** | <https://kenney.nl> |
| **Licence** | **CC0 1.0 Universal** (public domain dedication) |
| **Licence text in repo** | `public/assets/audio/ui/KENNEY-LICENSE.txt` — ships alongside the files |
| **Attribution required** | **No.** The pack's own licence file states crediting Kenney "is not mandatory". |
| **Commercial use** | Yes, explicitly: "free to use in personal, educational and commercial projects". |
| **Payload** | 236 KB total, precached by the service worker |

Credited here anyway, because not being obliged to is not a reason not to.

---

## 2. Combat and ceremony effects — synthesised at runtime

| | |
|---|---|
| **Where** | `src/audio/audio.ts` (`playGame`, `sfxRarity`) |
| **Files** | none |
| **Licence** | this project's own code |
| **Payload** | **0 bytes** of audio assets |

Every combat sound — `shoot`, `hit`, `crit`, `death`, `down`, `leak`, `coin`,
`wave`, `clear`, `victory`, `defeat`, `upgrade`, `evolve`, and the five
rarity stings — is built from oscillators, one shared noise buffer and a
generated convolution impulse response. Nothing is fetched and nothing is
sampled from any third-party recording.

---

## 3. The score — performed at runtime

| | |
|---|---|
| **Where** | `src/audio/music.ts` (two cues: `hub`, `battle`) |
| **Files** | none |
| **Licence** | this project's own work, composed for it |
| **Payload** | **0 bytes** of audio assets; ~1.9 KB gzipped of JavaScript |

### Why there is no `.ogg` in this repository

The brief for the music was: ship it, but only under a licence that is
unambiguously safe for commercial use with no attribution trap. This repository
has already had one licence problem with a sprite pack. The way to make that
guarantee absolute is to not have a third-party audio file at all — so the score
is written in code, in this repository, and there is nothing to re-verify when
some pack changes its terms.

It is also the right call for a mobile PWA:

* **0 bytes of payload.** Two streamed tracks would have been ~1.5–3 MB, and
  every file in `dist/` lands in the service worker's precache list
  (`vite.config.ts`), so every player would have paid for them on install. The
  precache is unchanged by this phase: **267 files, 1562 KB**, exactly as before.
* It can never 404, stall on a train, or need the negative-cache and backoff
  machinery the UI samples needed (see the notes in `audio.ts`).
* It is a performance rather than a loop, so an eight-bar cycle does not audibly
  stitch every thirty seconds.

### What it is

Two cues, both in A minor, scheduled onto the audio clock by a lookahead
scheduler:

* **`hub`** — 76 BPM, no drums, long reverb. Pad, a soft sub, and a sparse
  plucked figure whose pattern rotates with the bar. Plays on the Watchtower,
  the run map, the crossroads, and during a battle's setup phase.
* **`battle`** — 132 BPM. Kick/snare/hats, a straight-eighths bass with an
  octave lift on the back half of the bar, a 16th arpeggio with a rest that
  moves each bar, and a pad. Progression: Am Am F G Am C Dm E. Plays only while
  a wave is actually running, so the wave's first bar lands as a change.

Deliberately quiet in the top octave: combat effects live up there and carry
information the music does not.

### How it behaves

* Routed through the music bus in `audio.ts`, under the same master gain and
  the same mute as everything else.
* **Mute** stops the transport (not just the gain) — a muted phone spends no
  battery performing.
* **Settings → Music** is its own on/off, separate from mute: sound effects
  carry information in this game and the score does not, so the score is the
  half you can drop on its own.
* **A hidden tab** suspends it, through the app's single `visibilitychange`
  lifecycle (`src/state/lifecycle.ts`) — no second listener.
* Never the only channel for anything: the score carries no information, and
  every event it accompanies is also stated in text and colour.

---

## 4. Nothing else

No other audio file, sample, loop or recording is shipped, referenced or
fetched by this game. If you add one, add its row to this table first, with the
licence text committed alongside the file.
