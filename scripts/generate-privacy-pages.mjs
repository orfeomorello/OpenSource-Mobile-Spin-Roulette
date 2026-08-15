import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LOCALE_META } from "../src/i18n/localeMeta.ts";
import {
  PRIVACY_ISSUES_URL,
  allPrivacyDocuments,
  privacyArticleMarkup,
  privacyStorePath,
} from "../src/legal/privacy.ts";

const PAGE_CSS = `:root {
  color-scheme: dark;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #06100d;
  color: #f2ead8;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: radial-gradient(circle at 50% 0, #163b2e 0, #071511 48%, #030806 100%);
}
main {
  width: min(820px, calc(100% - 32px));
  margin: 0 auto;
  padding: max(24px, env(safe-area-inset-top)) 0 max(40px, env(safe-area-inset-bottom));
}
nav { display: flex; flex-wrap: wrap; gap: 10px 18px; margin-bottom: 30px; }
a { color: #e4c680; text-underline-offset: 3px; }
article, .locale-list {
  padding: clamp(22px, 5vw, 46px);
  border: 1px solid rgba(228, 198, 128, .28);
  border-radius: 20px;
  background: rgba(6, 16, 13, .88);
  box-shadow: 0 24px 60px rgba(0, 0, 0, .34);
}
h1, h2 { color: #f4dfaa; letter-spacing: -.02em; }
h1 { margin: 0 0 8px; font-size: clamp(2rem, 8vw, 3.6rem); }
h2 { margin: 30px 0 8px; font-size: 1.2rem; }
p, li { color: #c6d2cb; line-height: 1.65; }
.privacy-updated { margin: 0 0 28px; color: #8fa59a; }
.privacy-notice {
  padding: 14px 16px;
  border-left: 4px solid #d6b66f;
  background: rgba(214, 182, 111, .08);
  color: #f2ead8;
}
.locale-list { display: grid; gap: 10px; padding: 22px; }
.locale-list a {
  display: block;
  padding: 12px 14px;
  border: 1px solid rgba(228, 198, 128, .22);
  border-radius: 12px;
  text-decoration: none;
  color: #f2ead8;
}
.locale-list a:hover { border-color: #d6b66f; }
.locale-list small { display: block; color: #8fa59a; font-size: .78rem; }
footer { padding: 24px 4px 0; color: #82988d; font-size: .9rem; text-align: center; }`;

function pageShell({ lang, title, description, nav, body }) {
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#081611" />
    <meta name="description" content="${description}" />
    <title>${title} · Mobile Roulette – No cash</title>
    <link rel="icon" href="../roulette-icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="../apple-touch-icon.png" sizes="180x180" />
    <style>
${PAGE_CSS}
    </style>
  </head>
  <body>
    <main>
      <nav aria-label="Page navigation">${nav}</nav>
      ${body}
      <footer>Mobile Roulette – No cash · Open source · Virtual points only</footer>
    </main>
  </body>
</html>
`;
}

const documents = allPrivacyDocuments();

function writePrivacyTree(rootDir) {
  const privacyDir = path.join(rootDir, "privacy");
  mkdirSync(privacyDir, { recursive: true });

  for (const doc of documents) {
    const others = documents
      .filter((item) => item.locale !== doc.locale)
      .map((item) => `<a href="./${item.locale === "pt-BR" ? "pt-BR" : item.locale}.html" lang="${item.htmlLang}">${item.title}</a>`)
      .join("\n        ");
    const html = pageShell({
      lang: doc.htmlLang,
      title: doc.title,
      description: `${doc.noticeLead} ${doc.noticeRest}`,
      nav: `
        <a href="../">← Mobile Roulette – No cash</a>
        <a href="../privacy.html">All languages</a>
        ${others}`,
      body: `<article>
        <h1>${doc.title}</h1>
        ${privacyArticleMarkup(doc, { issuesUrl: PRIVACY_ISSUES_URL })}
      </article>`,
    });
    writeFileSync(path.join(rootDir, privacyStorePath(doc.locale)), html);
  }

  const indexNav = documents.map((doc) => {
    const meta = LOCALE_META.find((item) => item.id === doc.locale);
    return `        <a href="./${privacyStorePath(doc.locale)}" lang="${doc.htmlLang}"><strong>${doc.title}</strong><small>${meta?.native ?? doc.locale}</small></a>`;
  }).join("\n");

  const index = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#081611" />
    <meta name="description" content="Mobile Roulette – No cash privacy policy. Virtual points only. No personal data collection." />
    <title>Privacy Policy · Mobile Roulette – No cash</title>
    <link rel="icon" href="./roulette-icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="./apple-touch-icon.png" sizes="180x180" />
    <style>
${PAGE_CSS}
    </style>
  </head>
  <body>
    <main>
      <nav aria-label="Page navigation">
        <a href="./">← Mobile Roulette – No cash</a>
      </nav>
      <article>
        <h1>Privacy Policy</h1>
        <p class="privacy-updated">Choose a language. Each page below is a standalone privacy policy for that locale.</p>
        <p class="privacy-notice"><strong>Mobile Roulette – No cash uses virtual points only.</strong> The app does not collect personal data.</p>
      </article>
      <div class="locale-list">
${indexNav}
      </div>
      <footer>Mobile Roulette – No cash · Open source · Virtual points only</footer>
    </main>
  </body>
</html>
`;
  writeFileSync(path.join(rootDir, "privacy.html"), index);
}

writePrivacyTree("public");
writePrivacyTree("hosting");

console.log(`Wrote privacy index and ${documents.length} locale pages to public/ and hosting/`);
