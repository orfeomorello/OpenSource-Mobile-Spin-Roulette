# MobileSpinRoulette

*Roulette from both sides of the table*

An **8-bit roulette web game** for the browser, designed to work **local-first**.

**Codename / repository folder:** `RouletteLife`.

| Mode | Status |
|------|--------|
| **Dealer** | **Playable** - identify `WIN!` players and pay them correctly; Service Points are added to the persistent score at a 1:1 rate |
| **Player** | **Immediately playable** - a one-time starting score of 1,000; earn more score by working as the Dealer; chips **1-500**, SPIN, rebet, double, strategies, Racetrack and statistics |
| **How to Play** | Removed from the home screen and currently not exposed |

**Home screen:** two cards, Dealer and Player. Clicking a card starts that mode. Settings include language, EU/US roulette, animations, presets, sound and data export.

English is the default language. English and Italian can be selected from the home screen or Settings. The UI refers only to **score**, never to a wallet or real money.

## SpinEngine v2

The winning number is not produced by a basic `Math.random` call and is not influenced by score or difficulty:

1. A **CSPRNG** (`crypto.getRandomValues`) samples the initial conditions.
2. Ball and wheel movement are integrated using a one-dimensional ODE until the ball drops.
3. The result is mapped to the physical EU (37 pockets) or US (38 pockets) wheel.
4. Canvas and reveal components present the already-decided result. Animation can be enabled or disabled, and the reveal can be dismissed with a tap before its timeout.

| File | Purpose |
|------|---------|
| `src/spin/spinEngine.ts` | `spin` and `spinDetailed` |
| `src/spin/rng.ts` | Cryptographically secure random number generation |
| `config/wheel-spin.json` | Simulation parameters and pocket order |
| `src/wheel/canvasWheel.ts` | Wheel animation toward the result already selected by SpinEngine |

## Running locally

```powershell
cd C:\RouletteLife
npm.cmd install
npm.cmd run dev
```

If PowerShell blocks `npm`, use `npm.cmd` as shown above.

Open `http://localhost:5173/`. If you see Workbox or a `main.tsx` file from another application, clear the site's service worker and cache or use a private browser window.

## Commands

```powershell
npm.cmd test
node --experimental-strip-types src/spin/spinEngine.test.ts
npm.cmd run build
npm.cmd run preview
```

## Stack

Vite and TypeScript, with:

- `src/core` for the pure game domain.
- `src/spin` for winning-number selection.
- `player.ts` and `callBets.ts` for Player mode.
- `src/persist/*` for profiles, sessions, settings and bet templates.
- `src/npc` for Dealer-mode NPC behavior.
- No backend and no analytics.

## Local persistence

| Key | Content |
|-----|---------|
| `mobilespinroulette.profile.v1` | Score (`walletUnits`) and best service |
| `mobilespinroulette.settings.v1` | Roulette variant, animations, preset and mute setting |
| `mobilespinroulette.session.v3` | Dealer/Player session resume data |
| `mobilespinroulette.betTemplates.v1` | Betting strategies and custom bet templates, up to 24 |
| `mobilespinroulette.locale.v1` | UI language |

## Optional audio assets

Audio binaries are intentionally not stored in Git. Missing tracks only produce warnings and never stop `npm run dev` or `npm run build`; the game remains fully playable without music.

Both commands automatically run `npm run prepare:audio`, which checks the tracks listed in `public/audio-manifest.json`. Existing files are reused and verified with SHA-256. CC0 tracks can be downloaded automatically from OpenGameArt.

Pixabay blocks automated downloads from its source pages. Those tracks must be downloaded manually or served by an authorized asset host:

```powershell
$env:MOBILESPINROULETTE_AUDIO_BASE_URL = "https://your-authorized-host.example/mobilespinroulette-audio"
npm.cmd run prepare:audio
```

The host must expose each file using the filename found in the manifest. Do not publish Pixabay MP3 files as standalone GitHub Release assets unless their license explicitly permits that form of redistribution.

To enable all music, place the following files in `public/audio/` without changing their names:

| File | Official download or source page |
|------|----------------------------------|
| `mus_menu_loop.mp3` | [Bossa Nova - OpenGameArt](https://opengameart.org/content/bossa-nova) |
| `mus_dealer_loop.wav` | [Jazz n' brass loop - OpenGameArt](https://opengameart.org/content/jazz-n-brass-loop) |
| `andriih-bossa-nova-bossa-nova-jazz-575813.mp3` | [Bossa Nova Jazz - Pixabay](https://pixabay.com/it/music/bossanova-bossa-nova-bossa-nova-jazz-575813/) |
| `andriih-bossa-nova-lounge-music-571055.mp3` | [Bossa Nova Lounge - Pixabay](https://pixabay.com/it/music/bossa-nova-bossa-nova-lounge-music-571055/) |
| `andriih-bossa-nova-restaurant-music-572268.mp3` | [Bossa Nova Restaurant - Pixabay](https://pixabay.com/it/music/bossa-nova-bossa-nova-restaurant-music-572268/) |
| `andriih-cooking-cooking-music-575825.mp3` | [Cooking Music - Pixabay](https://pixabay.com/it/music/upbeat-cooking-cooking-music-575825/) |
| `andriih-elevator-elevator-jazz-579808.mp3` | [Elevator Jazz - Pixabay](https://pixabay.com/it/music/jazz-elevator-elevator-jazz-579808/) |
| `andriih-hotel-cafe-restaurant-music-579812.mp3` | [Hotel Cafe Restaurant Music - Pixabay](https://pixabay.com/it/music/easy-listening-hotel-cafe-restaurant-music-579812/) |

Complete attribution and license information is available in `public/audio/CREDITS.md`.
