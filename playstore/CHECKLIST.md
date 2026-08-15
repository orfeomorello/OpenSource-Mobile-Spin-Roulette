# Play Console checklist (once per app)

Do these after the listing texts. They are **not** repeated per language.

## 1. Developer account and app

- [ ] Paid Play developer account
- [ ] Create app: name `Mobile Roulette – No cash`, type **Game**, free
- [ ] Application ID (closed): `io.mobilespinroulette.app` — do not put `orfeomorello` in the Play id or in the public HTTPS host
- [ ] Default language: English (United States)

## 2. Main store listing

- [ ] Paste `en/listing.md` (name, short, full)
- [ ] Upload `shared/icon-512.png`
- [ ] Upload `shared/feature-graphic-1024x500.png`
- [ ] Upload at least the four phone screenshots in `en/screenshots/`
- [ ] Upload 7-inch and 10-inch screenshots
- [ ] Add translations for IT, ES, PT-BR, FR, DE, KO, JA, ZH from each `listing.md`
- [ ] Optional: one YouTube preview video (cover = feature graphic)

## 3. Store settings

- [ ] App category: **Game → Casino**
- [ ] Tags: roulette, board, casual (adjust in Console)
- [ ] Contact email
- [ ] Website: `https://mobilespinroulette.pages.dev/` or the GitHub repo
- [ ] External marketing: leave on unless you want to hide Play promotions

## 4. App content / policy

- [ ] Privacy policy URL: `https://mobilespinroulette.pages.dev/privacy.html`
- [ ] Ads: **No**
- [ ] App access: all features available without a login
- [ ] Content ratings (IARC): complete the questionnaire
  - Simulated gambling / casino theme: yes
  - Real-money gambling: **no**
  - Users cannot win real money or prizes: **no**
  - Suggested audience: **18+** is the safer choice for a casino theme
- [ ] Target audience: if 18+, do not include children
- [ ] News app: No
- [ ] COVID-19: No
- [ ] Government: No
- [ ] Data safety:
  - Collects user data: **No**
  - Data is processed on the device only (score, settings, strategies in local storage)
  - No account, no analytics, no advertising ID
  - Security practices: data is not transmitted, so encryption-in-transit is not applicable
- [ ] Financial features: no real-money payments

## 5. Host HTTPS (vetrina + privacy, not the APK)

- [x] Deploy the `hosting/` folder to Cloudflare Pages (`mobilespinroulette.pages.dev`)
- [x] Confirm `https://mobilespinroulette.pages.dev/privacy.html` and the nine `/privacy/*.html` pages
- [ ] Do **not** publish the Vite game `dist/` on this origin
- [ ] Do **not** wrap this origin in a Trusted Web Activity

## 6. Package and review

- [x] Build a Capacitor Android app that embeds the local game `dist/` (the APK must play if Pages is down)
- [x] Recreate the package with `npm.cmd run apk` (debug APK built 2026-08-14)
- [x] GitHub sideload: `npm.cmd run apk:release` → `android-dist/MobileSpinRoulette.apk`
- [x] `npm.cmd run aab` for Play (signed 2026-08-14 → `android-dist/MobileSpinRoulette.aab`; upload key in `%USERPROFILE%\.mobilespinroulette\`)
- [x] Application ID: `io.mobilespinroulette.app` (do not change after first upload)
- [ ] Target current API, 64-bit
- [ ] Upload AAB to an internal or closed test track first
- [ ] Paste first-release notes from each `listing.md`
- [ ] Production review

## 7. Countries

Some countries restrict casino-themed apps even when they use virtual points.
After IARC, review the country list in Console before a worldwide rollout.
