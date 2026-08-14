# Public product site (Cloudflare Pages)

This folder is the **vetrina**, not the game.

Published origin: `https://mobilespinroulette.pages.dev/`

| URL | Role |
| --- | --- |
| `/` | Product page, itch.io play link, GitHub, language switcher |
| `/privacy.html` | **Play Console privacy URL** (one URL for the whole app) |
| `/privacy/*.html` | One store privacy page per language |

The Android package (`io.mobilespinroulette.app`) will ship the game inside the APK (Capacitor). This host must stay up for the Play privacy link and for the public landing page. If Pages is down, installed APKs still play; a missing privacy URL can block store review.

Do not put the Vite `dist/` game here. Do not point a Trusted Web Activity at this origin.

## Deploy (Pages, not a Worker)

The unified **Workers & Pages** wizard defaults to a **Worker**. A Worker URL looks like `mobilespinroulette.orfeomorello.workers.dev` and is **not** usable for Play: it contains `orfeomorello`. Play and this repo expect a **Pages** origin:

`https://mobilespinroulette.pages.dev/`

### Dashboard

1. [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) → **Create application**.
2. Choose **Pages**, not the default Worker / “Start with Hello World”.
   - Git: **Pages → Connect to Git**.
   - Or: **Get started → Drag and drop your files**.
3. Project name: `mobilespinroulette` (this is the `pages.dev` label).
4. If that name is already taken by the Worker you created, **delete or rename the Worker first**, then create the Pages project. Do not keep the Worker URL as the public origin.
5. Git settings, if you connect the repo:
   - Production branch: `main`
   - Framework preset: None
   - Build command: empty
   - Root directory: `hosting`
6. Drag-and-drop: upload the contents of this `hosting/` folder (not the repo root).

### Wrangler (same Pages URL)

```powershell
npx wrangler login
npx wrangler pages project create mobilespinroulette --production-branch main
npx wrangler pages deploy hosting --project-name mobilespinroulette
```

After a successful Pages deploy the site is at `https://mobilespinroulette.pages.dev/`. The Worker at `*.workers.dev` can then be deleted.

The folder is already the finished site. Refresh generated files before a deploy:

```powershell
npm.cmd run generate:privacy
npm.cmd run generate:hosting
```

`generate:privacy` writes the same pages to `public/` (itch zip) and `hosting/` (this site). `generate:hosting` rebuilds `index.html`, `locales.js` and copies icon / screenshot assets.

## After the first deploy

Live (2026-08-14): `https://mobilespinroulette.pages.dev/` and the privacy index. Pages redirects `privacy.html` to `/privacy` (same page, HTTP 308). Either URL is valid; Play Console should follow the redirect.

1. Paste `https://mobilespinroulette.pages.dev/privacy.html` into Play Console → App content → Privacy policy.
2. Website field in the listing can be this origin or the GitHub repo.
3. Do not use any `*.orfeomorello.workers.dev` URL in Console.
