# MobileSpinRoulette

![MobileSpinRoulette cover](./mobilespinroulette-itch-cover.png)

**Open-source roulette built for mobile and desktop.**

[Play on itch.io](https://bitcroupier.itch.io/mobile-roulette)

MobileSpinRoulette is a browser-based roulette game focused on a fast, touch-friendly table experience. It is designed for small mobile displays, tablets and desktop browsers, with no backend, account or real-money transactions.

## Features

- European and American roulette tables.
- Inside and outside bets, racetrack calls, Rebet, Double and Undo.
- Strategy creator with up to 24 saved betting layouts.
- Session statistics and score trend chart.
- Configurable music, sound effects, animation and table settings.
- Responsive layouts for desktop, tablets and small phones, including iPhone SE-sized screens.
- Installable Progressive Web App with offline-ready production assets.
- English, Italian, Spanish, Brazilian Portuguese, French, German, Korean, Japanese and Chinese interfaces.
- Local autosave plus JSON export and import from Settings.

The home screen and Settings link to the bilingual [privacy policy](./public/privacy.html). The game uses virtual points only and provides no purchases, prizes, cash-out or accounts.

The game uses points only. A new profile starts with **2000000 score**, and starting a new game restores that amount when the score is zero or below.

## How to play

Choose a chip, tap the felt to place bets and press **Spin**. The table supports straight, split, street, corner, six-line and outside bets, plus the European racetrack calls where applicable. Saved strategies can place a complete layout in one action.

## Spin engine

The result is independent of score and presentation settings:

1. `crypto.getRandomValues` supplies cryptographically secure initial conditions.
2. Ball and wheel movement are integrated by the spin simulation until the ball drops.
3. The result maps to the physical European (37-pocket) or American (38-pocket) wheel order.
4. The canvas animation presents the result already selected by the engine.

Relevant files:

| File | Purpose |
| --- | --- |
| `src/spin/spinEngine.ts` | Spin simulation and result selection |
| `src/spin/rng.ts` | Cryptographically secure random source |
| `config/wheel-spin.json` | Simulation parameters and wheel order |
| `src/wheel/canvasWheel.ts` | Roulette wheel rendering and animation |

## Run locally

Requirements: a current Node.js release and npm.

```powershell
git clone https://github.com/orfeomorello/OpenSource-Mobile-Spin-Roulette.git
cd OpenSource-Mobile-Spin-Roulette
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173/`. On macOS or Linux, use `npm` in place of `npm.cmd`.

## Tests and production build

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

The production build is written to `dist/`. It regenerates the launcher icons and injects the complete local application shell into a versioned service-worker cache. Optional music remains on-demand and is intentionally not duplicated in offline storage.

PWA launcher assets can also be regenerated directly:

```powershell
npm.cmd run generate:icons
```

The manifest provides separate `any` and `maskable` PNG icons at 192 and 512 pixels, plus a 180-pixel Apple touch icon. Relative `id`, `scope` and `start_url` values preserve installability when the app is hosted in a subdirectory.

To create the itch.io upload package after building:

```powershell
node scripts/zip-itch.mjs
```

This creates `mobilespinroulette-itch.zip`. The recommended itch.io embed size is **1024 × 600**, with fullscreen and mobile-friendly options enabled.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/core/` | Game rules, payouts and player state |
| `src/spin/` | Spin simulation and secure random generation |
| `src/player/` | Touch betting and felt snapping |
| `src/persist/` | Profile, session, settings and strategy persistence |
| `src/i18n/` | Translation catalogs and locale metadata |
| `config/` | Game balance, controls, bets and wheel configuration |
| `public/` | PWA files, icon and optional audio assets |

The application is built with TypeScript and Vite. It has no backend and does not include analytics.

## Local data and migration

Progress is saved automatically in browser `localStorage`:

| Key | Content |
| --- | --- |
| `mobilespinroulette.profile.v1` | Persistent score data |
| `mobilespinroulette.settings.v1` | Table, animation, audio and interface settings |
| `mobilespinroulette.session.v3` | Current table session data |
| `mobilespinroulette.betTemplates.v1` | Saved betting strategies |
| `mobilespinroulette.locale.v1` | Selected interface language |

Legacy project keys are migrated automatically when found. Settings also provide a complete JSON backup and restore workflow; exported files use the `mobilespinroulette-export-YYYY-MM-DD.json` naming scheme.

## Audio

`npm run dev` and `npm run build` automatically execute `npm run prepare:audio`. The script checks the tracks declared in `public/audio-manifest.json`, reuses valid local files and can retrieve supported assets. Missing optional music produces a warning but does not prevent the game from running.

The selectable Player playlist contains the six tracks whose filenames begin with `andriih-`. To provide those files from an authorized asset host, set:

```powershell
$env:MOBILESPINROULETTE_AUDIO_BASE_URL = "https://your-authorized-host.example/mobilespinroulette-audio"
npm.cmd run prepare:audio
```

The host must expose each file using the name listed in `public/audio-manifest.json`. Source links, attribution and licensing notes are documented in [`public/audio/CREDITS.md`](./public/audio/CREDITS.md).

## Disclaimer

MobileSpinRoulette is intended for entertainment and educational purposes. It uses virtual points only and does not offer real-money gambling, purchases or prizes.
