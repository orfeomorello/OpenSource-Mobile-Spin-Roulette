import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { listings } from "../playstore/copy.mjs";
import { LOCALE_META } from "../src/i18n/localeMeta.ts";
import {
  GITHUB_URL,
  HOSTING_ORIGIN,
  ITCH_URL,
  hostingChrome,
} from "./hosting-chrome.mjs";

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function parseListing(full) {
  const lines = full.replaceAll("\r\n", "\n").split("\n");
  const lead = [];
  const features = [];
  const after = [];
  let phase = "lead";
  for (const raw of lines) {
    const line = raw.trim();
    if (phase === "lead") {
      if (line.startsWith("•")) {
        phase = "features";
        features.push(line.slice(1).trim());
      } else if (line) {
        lead.push(line);
      }
      continue;
    }
    if (phase === "features") {
      if (line.startsWith("•")) {
        features.push(line.slice(1).trim());
      } else if (line) {
        phase = "rest";
        after.push(line);
      }
      continue;
    }
    after.push(line);
  }

  const sections = [];
  let current = null;
  for (const line of after) {
    if (!line) {
      current = null;
      continue;
    }
    if (!current) {
      current = { heading: line, body: "" };
      sections.push(current);
    } else {
      current.body = current.body ? `${current.body} ${line}` : line;
    }
  }

  return {
    intro: lead[0] ?? "",
    featuresHeading: lead[1] ?? "",
    features,
    sections,
  };
}

function buildLocales() {
  const locales = {};
  for (const entry of listings) {
    const chrome = hostingChrome[entry.id];
    if (!chrome) throw new Error(`Missing hosting chrome for ${entry.id}`);
    const parsed = parseListing(entry.full);
    const meta = LOCALE_META.find((item) => item.id === entry.id);
    locales[entry.id] = {
      htmlLang: meta?.bcp47 ?? entry.playCode,
      native: meta?.native ?? entry.id,
      title: `${entry.name} · ${chrome.footer.split(" · ")[1] ?? "Virtual points only"}`,
      description: entry.short,
      chrome,
      ...parsed,
    };
  }
  return locales;
}

const locales = buildLocales();
const en = locales.en;
if (!en) throw new Error("English hosting copy is required");

const hreflang = listings
  .map((entry) => {
    const lang = locales[entry.id].htmlLang;
    return `    <link rel="alternate" hreflang="${lang}" href="${HOSTING_ORIGIN}/?lang=${entry.id}" />`;
  })
  .join("\n");

const langButtons = listings
  .map((entry) => {
    const pack = locales[entry.id];
    const pressed = entry.id === "en" ? "true" : "false";
    return `          <button type="button" class="lang-btn" data-lang="${entry.id}" lang="${pack.htmlLang}" aria-pressed="${pressed}">${escapeHtml(pack.native)}</button>`;
  })
  .join("\n");

const featureItems = en.features.map((item) => `            <li>${escapeHtml(item)}</li>`).join("\n");

const sectionCards = en.sections
  .map((section, index) => {
    const linked = escapeHtml(section.body).replaceAll(
      escapeHtml(GITHUB_URL),
      `<a href="${GITHUB_URL}" rel="noopener noreferrer">${escapeHtml(GITHUB_URL)}</a>`,
    );
    return `        <article class="card" data-section="${index}">
          <h2>${escapeHtml(section.heading)}</h2>
          <p>${linked}</p>
        </article>`;
  })
  .join("\n");

const index = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#081611" />
    <meta name="description" content="${escapeHtml(en.description)}" />
    <meta name="robots" content="index,follow" />
    <title>${escapeHtml(en.title)}</title>
    <link rel="canonical" href="${HOSTING_ORIGIN}/" />
${hreflang}
    <link rel="alternate" hreflang="x-default" href="${HOSTING_ORIGIN}/" />
    <link rel="icon" href="./roulette-icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="./apple-touch-icon.png" sizes="180x180" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${HOSTING_ORIGIN}/" />
    <meta property="og:title" content="Mobile Roulette – No cash" />
    <meta property="og:description" content="${escapeHtml(en.description)}" />
    <meta property="og:image" content="${HOSTING_ORIGIN}/images/feature-graphic.jpg" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="stylesheet" href="./site.css" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "VideoGame",
        "name": "Mobile Roulette – No cash",
        "url": "${HOSTING_ORIGIN}/",
        "description": ${JSON.stringify(en.description)},
        "applicationCategory": "GameApplication",
        "operatingSystem": "Android, iOS, Windows, macOS, Linux",
        "isAccessibleForFree": true,
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
        "license": "https://www.gnu.org/licenses/gpl-3.0.html",
        "codeRepository": "${GITHUB_URL}"
      }
    </script>
  </head>
  <body>
    <a class="skip" href="#content" data-i18n="skip">${escapeHtml(en.chrome.skip)}</a>
    <header class="top">
      <a class="brand" href="./">
        <img src="./roulette-icon.svg" width="40" height="40" alt="" />
        <span>Mobile Roulette – No cash</span>
      </a>
      <nav class="top-nav" aria-label="Site">
        <a href="${ITCH_URL}" rel="noopener noreferrer" data-i18n="play">${escapeHtml(en.chrome.play)}</a>
        <a href="${GITHUB_URL}" rel="noopener noreferrer" data-i18n="github">${escapeHtml(en.chrome.github)}</a>
        <a href="./privacy.html" data-i18n="privacy">${escapeHtml(en.chrome.privacy)}</a>
      </nav>
    </header>

    <main id="content">
      <section class="hero">
        <img class="hero-art" src="./images/feature-graphic.jpg" width="1024" height="500" alt="Mobile Roulette – No cash — open source, virtual points only" />
        <div class="hero-copy">
          <p class="kicker">Open source</p>
          <h1>Mobile Roulette – No cash</h1>
          <p class="lede" data-field="intro">${escapeHtml(en.intro)}</p>
          <p class="notice"><strong data-field="short">${escapeHtml(en.description)}</strong></p>
          <div class="cta">
            <a class="btn primary" href="${ITCH_URL}" rel="noopener noreferrer">
              <span data-i18n="play">${escapeHtml(en.chrome.play)}</span>
              <small data-i18n="playHint">${escapeHtml(en.chrome.playHint)}</small>
            </a>
            <a class="btn ghost" href="${GITHUB_URL}" rel="noopener noreferrer" data-i18n="github">${escapeHtml(en.chrome.github)}</a>
            <a class="btn ghost" href="./privacy.html" data-i18n="privacy">${escapeHtml(en.chrome.privacy)}</a>
          </div>
        </div>
      </section>

      <section class="block" aria-labelledby="gallery-heading">
        <h2 id="gallery-heading" data-i18n="gallery">${escapeHtml(en.chrome.gallery)}</h2>
        <div class="shots">
          <figure class="shot portrait">
            <img src="./images/phone-home.png" width="1080" height="1920" alt="" />
            <figcaption data-i18n="shotHome">${escapeHtml(en.chrome.shotHome)}</figcaption>
          </figure>
          <figure class="shot portrait">
            <img src="./images/phone-table.png" width="1080" height="1920" alt="" />
            <figcaption data-i18n="shotTable">${escapeHtml(en.chrome.shotTable)}</figcaption>
          </figure>
          <figure class="shot wide">
            <img src="./images/phone-landscape.png" width="1920" height="1080" alt="" />
            <figcaption data-i18n="shotLandscape">${escapeHtml(en.chrome.shotLandscape)}</figcaption>
          </figure>
          <figure class="shot wide">
            <img src="./images/tablet.png" width="1920" height="1200" alt="" />
            <figcaption data-i18n="shotTablet">${escapeHtml(en.chrome.shotTablet)}</figcaption>
          </figure>
        </div>
      </section>

      <section class="block" aria-labelledby="features-heading">
        <h2 id="features-heading" data-field="featuresHeading">${escapeHtml(en.featuresHeading)}</h2>
        <ul class="features" data-field="features">
${featureItems}
        </ul>
      </section>

      <section class="cards">
${sectionCards}
      </section>

      <p class="license" data-i18n="licenseShort">${escapeHtml(en.chrome.licenseShort)}</p>
    </main>

    <footer class="foot">
      <div class="langs" role="group" aria-label="${escapeHtml(en.chrome.chooseLang)}">
        <span class="langs-label" data-i18n="languages">${escapeHtml(en.chrome.languages)}</span>
        <div class="lang-row">
${langButtons}
        </div>
      </div>
      <p data-i18n="footer">${escapeHtml(en.chrome.footer)}</p>
      <p>
        <a href="${ITCH_URL}" rel="noopener noreferrer" data-i18n="play">${escapeHtml(en.chrome.play)}</a>
        ·
        <a href="${GITHUB_URL}" rel="noopener noreferrer" data-i18n="github">${escapeHtml(en.chrome.github)}</a>
        ·
        <a href="./privacy.html" data-i18n="privacy">${escapeHtml(en.chrome.privacy)}</a>
      </p>
    </footer>

    <script src="./locales.js"></script>
    <script src="./site.js"></script>
  </body>
</html>
`;

const notFound = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#081611" />
    <title>Page not found · Mobile Roulette – No cash</title>
    <link rel="icon" href="./roulette-icon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="./site.css" />
  </head>
  <body>
    <main class="missing">
      <h1>Page not found</h1>
      <p>This host is the product site and the Play Store privacy pages. The game is not served from here.</p>
      <p>
        <a href="./">Mobile Roulette – No cash</a>
        ·
        <a href="./privacy.html">Privacy</a>
        ·
        <a href="${ITCH_URL}" rel="noopener noreferrer">Play online</a>
      </p>
    </main>
  </body>
</html>
`;

const root = "hosting";
const images = path.join(root, "images");
mkdirSync(images, { recursive: true });

writeFileSync(path.join(root, "index.html"), index);
writeFileSync(path.join(root, "404.html"), notFound);
writeFileSync(
  path.join(root, "locales.js"),
  `window.MSR_HOSTING = ${JSON.stringify(
    {
      origin: HOSTING_ORIGIN,
      itch: ITCH_URL,
      github: GITHUB_URL,
      locales,
    },
    null,
    2,
  )};\n`,
);

const copies = [
  ["public/roulette-icon.svg", "hosting/roulette-icon.svg"],
  ["public/apple-touch-icon.png", "hosting/apple-touch-icon.png"],
  ["playstore/shared/icon-512.png", "hosting/icon-512.png"],
  ["playstore/shared/feature-graphic-1024x500.jpg", "hosting/images/feature-graphic.jpg"],
  ["playstore/en/screenshots/01-phone-home-1080x1920.png", "hosting/images/phone-home.png"],
  ["playstore/en/screenshots/03-phone-table-1080x1920.png", "hosting/images/phone-table.png"],
  ["playstore/en/screenshots/04-phone-landscape-1920x1080.png", "hosting/images/phone-landscape.png"],
  ["playstore/en/screenshots/06-tablet10-landscape-1920x1200.png", "hosting/images/tablet.png"],
];

for (const [from, to] of copies) {
  copyFileSync(from, to);
}

console.log(`Wrote hosting landing, 404, locales (${listings.length} languages) and ${copies.length} assets`);
