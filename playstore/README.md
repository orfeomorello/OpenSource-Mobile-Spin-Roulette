# Google Play Store pack

Copy-paste texts, shared graphics and per-language screenshots for
[MobileSpinRoulette](https://github.com/orfeomorello/OpenSource-Mobile-Spin-Roulette).

This folder is a **Console kit**, not part of the game runtime. The software
stays `GPL-3.0-or-later`; these listing texts are written for Play Console.

## Folder map

```
playstore/
  README.md                          this file
  CHECKLIST.md                       Console steps beyond the listing
  copy.mjs                           source of all listing text
  write-listings.mjs                 regenerates each listing.md
  check-listings.mjs                 character-limit check
  shared/
    icon-512.png                     store icon
    feature-graphic-1024x500.png     required banner
    feature-graphic-1024x500.jpg     same banner as JPEG
    feature-graphic-art.jpg          art before the wordmark overlay
  en/ it/ es/ pt-BR/ fr/ de/ ko/ ja/ zh/
    listing.md                       paste into that Play language
    icon-512.png                     copy of the shared icon
    feature-graphic-1024x500.png     copy of the shared banner
    screenshots/                     real captures of the localized UI
```

Default Play language: **English (United States)**. Add the other eight as
translations. If a translation has no unique graphic, Play shows the English one.

## What Play asks for each language

| Field | Limit | Where |
| --- | --- | --- |
| App name | 30 characters | Main store listing |
| Short description | 80 characters | Main store listing |
| Full description | 4,000 characters | Main store listing |
| Release notes | 500 characters | Each release track |
| App icon | 512×512 PNG | Listing graphics (shared) |
| Feature graphic | 1024×500, no alpha | Listing graphics (shared) |
| Phone screenshots | 2–8 images | Listing graphics (per language) |
| 7" / 10" screenshots | up to 8 each | Recommended; this game is tablet-ready |
| Preview video | 1 YouTube URL | Optional |

Privacy policy is **one HTTPS URL for the whole app**, not a per-language field.
Use `https://mobilespinroulette.pages.dev/privacy.html`.

## How to paste

1. Open [Play Console](https://play.google.com/console) → the app →
   **Grow users → Store presence → Main store listing**.
2. Fill **English (United States)** from `en/listing.md`.
3. **Manage translations → Add your own translation** and repeat from each
   `listing.md`.
4. Upload graphics listed in that file.
5. Complete `CHECKLIST.md` (IARC, Data safety, ads, Capacitor APK).
   Application ID is **`io.mobilespinroulette.app`**. Public HTTPS host:
   `https://mobilespinroulette.pages.dev/` (must not contain `orfeomorello`).
   Recreate the debug APK with `npm.cmd run apk`. GitHub Releases want `npm.cmd run apk:release`. Play wants `npm.cmd run aab` and a release keystore.

Regenerate the markdown after editing `copy.mjs`:

```powershell
node playstore/write-listings.mjs
node playstore/check-listings.mjs
```

## Recreate graphics

Feature graphic (wordmark over the art, exact 1024×500):

```powershell
npm.cmd install puppeteer-core --no-save
node playstore/scripts/compose-feature-graphic.mjs
```

Localized screenshots (needs a running preview and Edge):

```powershell
npm.cmd run build
npm.cmd run preview
```

In a second terminal:

```powershell
npm.cmd install puppeteer-core --no-save
node playstore/scripts/capture-screenshots.mjs
```

## Words to avoid in every language

Do not write: win money, real jackpot, casino cash, withdraw, buy chips for cash.
Do write: virtual points, entertainment, no purchases, no prizes.
