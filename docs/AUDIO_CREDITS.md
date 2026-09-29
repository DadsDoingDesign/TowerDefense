# Audio provenance and licences

Every sound Fieldwatch can make, where it came from, and under what terms. This
game is a commercial product, so the rule is simple: **if a licence cannot be verified
from a file shipped in this repository, the audio does not ship.**

Last verified: 2026-09-29.

---

## 1. Interface samples — 8 × `.wav`

| | |
|---|---|
| **Files** | `public/assets/audio/ui/{back,click,close,confirm,equip,error,reward,toggle}.wav` |
| **Pack** | Kenney, *Interface Sounds* (1.0), created 2020-02-11 |
| **Source** | <https://kenney.nl> |
| **Licence** | **CC0 1.0 Universal** (public domain dedication) |
| **Licence text in repo** | `public/assets/audio/ui/KENNEY-LICENSE.txt` — ships alongside the files |
| **Attribution required** | **No.** The pack's own licence file states crediting Kenney "is not mandatory". |
| **Commercial use** | Yes, explicitly: "free to use in personal, educational and commercial projects". |
| **Payload** | ~190 KB total, precached by the service worker |

Credited here anyway, because not being obliged to is not a reason not to.

`open.wav` and `select.wav` from the same pack used to ship too. Nothing played
`open`, and `select` only previewed a legacy slider, yet both were fetched at
boot and precached on install, so they were removed (audio Phase 1). Each sample
plays at a per-file loudness trim (`UI_TRIM_DB` in `src/audio/mix.ts`) because
the pack is peak-normalised rather than loudness-matched.

---

## 2. Combat and ceremony effects — synthesised at runtime

| | |
|---|---|
| **Where** | `src/audio/audio.ts` (`playGame`, `playSting`, `sfxRarity`), voices in `src/audio/instruments.ts` |
| **Files** | none |
| **Licence** | this project's own code |
| **Payload** | **0 bytes** of audio assets |

Every combat sound — `shoot`, `hit`, `crit`, `death`, `down`, `leak`, `melee`,
`coin`, `wave`, `boss`, `clear`, `levelup`, `victory`, `defeat`, `upgrade`,
`evolve`, `deploy`, `undeploy`, and the five rarity stings — is built from
oscillators, one shared noise buffer, a generated convolution impulse response
and the Karplus–Strong strings described below. Nothing is fetched and nothing
is sampled from any third-party recording.

Since audio Phase 2 the engine's events carry who and where
(`EngineEventPayload` in `src/game/engine/engine.ts`): each archetype's shot
and hit has its own sound (Fighter blade swish + ting, Rogue bowstring twang +
arrow whoosh, Mystic FM sparkle), each goblin faction dies its own way (torch
pop, TNT boom, barrel splinter), SFX pan with field position (±0.4, lows
centred), and the stings are held to the score's next beat, written in its key,
and duck the music bus by ~4 dB on a separate node.

Levels, the UI-sample trims, the per-bus makeup, the master chain (glue
compressor → limiter), the duck, the pan width and the Calm-audio chain are
data in `src/audio/mix.ts`, each with the harness measurement that set it.
Default mix: ≈ −17.5 LUFS integrated in battle, ≈ −22 in the hub, true peak
≤ −2 dBTP.

---

## 3. The score — performed at runtime

| | |
|---|---|
| **Where** | `src/audio/theme.ts` (the notes), `src/audio/music.ts` (the performer), `src/audio/instruments.ts` (the voices), `src/audio/director.ts` (what plays when) |
| **Files** | none |
| **Licence** | this project's own work, composed for it |
| **Payload** | **0 bytes** of audio assets; the voices are rendered in code at startup |

### Why there is no `.ogg` in this repository

The brief for the music was: ship it, but only under a licence that is
unambiguously safe for commercial use with no attribution trap. This repository
has already had one licence problem with a sprite pack. The way to make that
guarantee absolute is to not have a third-party audio file at all — so the score
is written in code, in this repository, and there is nothing to re-verify when
some pack changes its terms.

It is also the right call for a mobile PWA:

* **0 bytes of payload.** Streamed tracks would have been megabytes, and every
  file in `dist/` lands in the service worker's precache list, so every player
  would have paid for them on install.
* It can never 404, stall on a train, or need the negative-cache and backoff
  machinery the UI samples needed (see the notes in `audio.ts`).
* It is a performance rather than a loop: the battle cue does not repeat
  exactly for ~4.5 minutes, and the adaptive layers mean it practically never
  does.

### What it is (audio Phase 4: synthesised folk)

One four-bar theme in A Dorian — A C D E | G E D C | D E C A | B G A — set six
ways: the Watchtower (D Dorian, 72 BPM, harp and recorder, rubato), the run map
and deploy phase (the field's key, 96 BPM), the fight (132 BPM, 50 bars ×
three instrumentation cycles), the boss (Phrygian: Am–B♭ | Am–G | F | E, war
drums, low brass), and ~10 s victory (A major) and defeat outros. The Green
Line plays in A with recorder and lute; the Kiln Road in G with a shawm over
harp; endless climbs a semitone every ten waves.

Every voice is synthesised: pre-rendered Karplus–Strong lute, harp and
bowstring (a delay line with a filtered feedback loop — computed in
TypeScript, one buffer per ±2-semitone anchor, at 24 kHz); a recorder (a sine
with a little 2nd and 3rd harmonic, breath noise, tongued chiff, delayed 5 Hz
vibrato); a hurdy-gurdy drone (saws on tonic and fifth through two formant
bandpasses, with a 16th-note buzz); frame drum, slap, shaker, tambourine and
war drums rendered from inharmonic membrane modes; soft saw viols for the pad.

### How it behaves

* **Adaptive:** five stems (drums, bass/drone, ostinato, melody, pad) are
  switched at barlines by an intensity level computed from enemies alive,
  run depth, a boss on the field, Gate HP and game speed (`musicIntensity` in
  `mix.ts`); up at once, down only after two bars. A champion spawning turns the
  fight into its boss form on the next barline. At ≤ 30 % Gate HP the score
  closes in behind a 900 Hz lowpass, a heartbeat starts, and a leak tolls.
* **In time:** the transport is the game's music clock — stings wait for the
  next beat (the next 8th in the slow hub, never more than 0.7 s) and the
  battle cue starts on the prep cue's next beat, where the wave call lands.
* Routed through the music bus in `audio.ts`, under the same master gain and
  the same mute as everything else; ducking and the low-Gate filter are their
  own nodes after it, so they never touch the player's volume.
* **Mute** stops the transport (not just the gain) — a muted phone spends no
  battery performing.
* **Settings → Sound** carries the music dial (0 = off), plus **Calm audio**
  (no drums, a gentler limiter, the score 4 dB further back) and **Mono**.
* **A hidden tab** suspends it, through the app's single `visibilitychange`
  lifecycle (`src/state/lifecycle.ts`) — no second listener.
* **The hub and prep cues resume** at the start of the four-bar phrase they
  stopped in. The battle cue and the outros always start at bar 1.
* **The AudioContext itself is suspended** when nothing can be heard — muted,
  hidden with nothing ringing, or 8 s of silence with the music off — and
  woken by the next sound (policy: `shouldSuspend` in `mix.ts`).
* Never the only channel for anything: every event it accompanies is also
  stated in text and colour.

---

## 4. Nothing else

No other audio file, sample, loop or recording is shipped, referenced or
fetched by this game. If you add one, add its row to this table first, with the
licence text committed alongside the file.
