# Merchant Mercenaries: App Store release

Everything needed to get from this repo to the App Store. The app is a
Capacitor shell over the same `dist/` the web serves (`capacitor.config.ts`,
`ios/`); `.github/workflows/ios.yml` builds it on GitHub's Macs. See
`CLAUDE.md` § iOS for how the shell works.

## 1. One-time Apple setup (the designer, about an hour)

1. **Apple Developer Program**: enrol at developer.apple.com ($99 a year).
   Note the 10-character **Team ID** (Membership page).
2. **Register the bundle ID**: Certificates, Identifiers & Profiles →
   Identifiers → + → App IDs → App. Explicit ID
   `com.dadsdoingdesign.merchantmercenaries`. No extra capabilities needed.
   **It can never be changed once the app exists.**
3. **Create the app** in App Store Connect → Apps → + → New App: platform iOS,
   name "Merchant Mercenaries", language English (U.S.), the bundle ID above,
   SKU `merchantmercenaries`.
4. **API key**: App Store Connect → Users and Access → Integrations → App Store
   Connect API → Team Keys → +. Role **Admin** (the first build has to create
   the distribution certificate). Download the `.p8` (only offered once), and
   note the **Key ID** and the **Issuer ID** above the list.
5. **Repo secrets**: GitHub → Settings → Secrets and variables → Actions → New
   repository secret, four times:
   - `ASC_KEY_ID`: the Key ID
   - `ASC_ISSUER_ID`: the Issuer ID
   - `ASC_KEY_P8`: the whole `.p8` file, including the BEGIN/END lines
   - `APPLE_TEAM_ID`: the Team ID

## 2. Build to TestFlight

Actions → **iOS** → Run workflow (on `main`) → Upload on. Or from a terminal:
`git tag ios-1 && git push origin ios-1`. Each run is a new build number (the
run number). The build shows up in App Store Connect → TestFlight after Apple
finishes processing it (10–30 minutes). Add yourself as an internal tester
and install it with the TestFlight app.

Pull requests that touch the iOS side only compile the app, unsigned, to
catch a broken Xcode project early. They never upload.

## 3. On a real iPhone, before submitting

- [ ] First launch: splash → menu with no white flash; status bar text is light.
- [ ] Notch / Dynamic Island and home indicator: nothing important under them,
      on the menu, the battle HUD and every full-screen page.
- [ ] Sound starts after the first tap; the ring/silent switch and the in-game
      sliders behave as expected; a phone call or lock screen mid-battle, then
      return: sound comes back, the battle is where you left it.
- [ ] Saves: play a contract, force-quit (swipe up), reopen: progress and the
      run in progress are there. Repeat after a phone restart.
- [ ] Long-press on art, cards and the map: no "Save Image" or copy menu, no
      text selection. The militia name field still edits.
- [ ] No pinch-zoom or rubber-band scrolling of the whole page.
- [ ] Drag and drop (skill merging, held gear) works with a finger.
- [ ] Settings → larger text and the colour-vision modes look right.
- [ ] A long session (30+ minutes): the phone doesn't get hot; no slowdowns.
- [ ] Airplane mode: the whole game works offline.
- [ ] On an iPad (the app is iPhone-only, so iPads run it in iPhone mode):
      it opens and plays. App Review often tests on an iPad.

**Seen while capturing the screenshots (440 px wide, worth fixing before release):**
- Damage numbers pile into an unreadable smear where many hits land on one
  spot (worst with frost + spark "SHATTER").
- With Details open in setup, the field shrinks to a strip with wide dark
  bars either side.
- "Elite spoils" leaves the bottom half of a tall phone empty.
- The run map's vertical "CLEARED / NOT CLEARED YET" labels and the bottom
  city's name clip at the edge.
- The party row truncates weapon names ("Greatswo…"); the HQ page leaves a
  gap between Bank interest and its CTA.
- A defeat receipt showed "0 kills · 38132 dmg" for one hero (maybe right for
  Furnace Barrels, but it reads oddly).

## 4. The listing (App Store Connect → the app → App Store tab)

| Field | Value |
|---|---|
| Name (30) | Merchant Mercenaries |
| Subtitle (30) | Roguelite tower defense |
| Category | Games · Strategy; secondary Games · Role Playing |
| Privacy policy URL | https://tower-defense-coral.vercel.app/privacy.html |
| Support URL | https://tower-defense-coral.vercel.app/support.html |
| Marketing URL | https://tower-defense-coral.vercel.app/ (optional) |
| Copyright | 2026 DadsDoingDesign |
| Price | Free (see § 6 before changing) |

Check both URLs load once `main` is deployed on Vercel. If the site moves to
its own domain, update them here and in App Store Connect.

**Promotional text (170, can change any time without review):**

> Guard the road, bank the gold. Hire heroes, escort caravans through goblin
> country, and decide at every city: cash out now, or press on for the big payday.

**Keywords (100, comma-separated, no spaces after commas):**

```
tower defense,roguelite,autobattler,strategy,td,caravan,goblin,heroes,pixel,offline,loot,castle
```

**Description (4,000):**

> Trade companies pay well to see their caravans through goblin country. Your
> militia takes the contract.
>
> Merchant Mercenaries is a roguelite tower defense where every run is a
> contract on the road. Pick a hero, place your defenders along the route, and
> let each wave play out. Between fights, choose your path on the map, shop the
> merchants, rest at campfires, and pick your rewards.
>
> CASH OUT OR PRESS ON
> Every city on the route is a choice. Sell your cargo and bank the gold now, or
> keep going for the bigger payout and risk losing most of it if you fall.
>
> FIVE TRADE COMPANIES
> Spice, metals, art and more. Each company has its own roads, goods and
> rivals. Work for one and your standing rises, opening better contracts,
> stakes and rewards.
>
> BUILD SOMETHING STRANGE
> Heroes level up during a run. Collect skill cards and infuse one into another
> (the order matters) to make new skills. Find and equip gear, up to the rare
> Sovereign tier.
>
> A COMPANY TO RUN
> Bring the gold home to upgrade your headquarters, open sealed crates of gear,
> raise your own banner, and take on the Sovereign Route, the endgame contract
> where everything is on the line.
>
> MADE FOR PHONES
> One-handed portrait play, 1×/2×/3× speed, larger text and colour-vision
> modes. Plays fully offline.
>
> No ads. No accounts. No tracking.

Before submitting, re-read the description against the build: every claim must
be true of the version under review.

**Screenshots:** `docs/app-store/screenshots/`, 1320×2868 (the required 6.9"
iPhone size; App Store Connect scales them for smaller phones). Regenerate
with `node scripts/app-store-shots.mjs` (header of that file for setup).
The app is iPhone-only, so no iPad screenshots are needed.

**App icon:** taken from the build (`ios/App/App/Assets.xcassets/AppIcon`,
made by `npm run brand`), nothing to upload.

## 5. Questionnaires in App Store Connect

**App Privacy:** "Data Not Collected". True of the code: no analytics, no
accounts, no network requests from the app; saves stay on the device
(`ios/App/App/PrivacyInfo.xcprivacy` declares the same).

**Age rating** (answers for the current build):
- Cartoon or Fantasy Violence: **Infrequent/Mild** (pixel-art fights with
  goblins; no blood or gore).
- Realistic violence, horror, sexual content, nudity, profanity, drugs,
  alcohol, tobacco, mature themes, medical, gambling: **None**.
- Simulated gambling: **None**. Sealed crates are bought with gold earned in
  play, never with money. If they are ever sold for real money this changes
  (and Apple requires the odds to be shown before purchase).
- Unrestricted web access: **No**. User-generated content: **No** (the militia
  name is filtered and never shared). Messaging/chat: **No**.
- Expect a **9+** rating.

**Export compliance:** answered by the build (`ITSAppUsesNonExemptEncryption`
is `false` in `Info.plist`), so TestFlight doesn't ask each time.

**Content rights:** Yes, the app contains third-party content and you have the
rights: the Tiny Swords art is CC0, the fonts are OFL and the UI sounds are
Kenney CC0 (`public/licenses/THIRD_PARTY_NOTICES.md`). Before submitting, do
the one open check in `docs/HANDOFF.md` § 1: record the hashes of Pixel Frog's
own CC0 archive in `public/assets/CC0-MANIFEST.md`.

## 6. App Review notes (paste into "Notes" under App Review Information)

> No sign-in is needed. The game saves on the device and works offline. To
> play: on the home map, tap a company's road and take its contract, choose a
> hero, then place your defenders; each wave plays itself out. Speed controls
> (1×/2×/3×) are on the battle screen. Later features (headquarters, sealed
> crates, the Sovereign Route) open as contracts are completed.

If in-app purchases are added later: each one must be created in App Store
Connect and attached to the version under review, a **Restore Purchases**
button must be reachable in the app, and the privacy policy's Purchases
section must be updated. Do not sell sealed crates or gold for money (see the
age-rating note above).

## 7. Submit

App Store tab → the 1.0 version → pick the TestFlight build → fill § 4–6 →
Add for Review → Submit. First reviews usually take one to three days.
Choose "Manually release this version" if you want to pick the launch day.
