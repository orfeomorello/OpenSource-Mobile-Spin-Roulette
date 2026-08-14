import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { GITHUB_URL, HOSTING_ORIGIN, ITCH_URL } from "./hosting-chrome.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const locales = ["en", "it", "es", "pt-BR", "fr", "de", "ko", "ja", "zh"];
const banned = ["win money", "real jackpot", "casino cash"];

const indexPath = path.join("hosting", "index.html");
assert(existsSync(indexPath), "hosting/index.html is missing — run npm run generate:hosting");
const index = readFileSync(indexPath, "utf8");
const localesJs = readFileSync(path.join("hosting", "locales.js"), "utf8");
const css = readFileSync(path.join("hosting", "site.css"), "utf8");
const js = readFileSync(path.join("hosting", "site.js"), "utf8");

assert(index.includes(ITCH_URL), "landing must link itch.io");
assert(index.includes(GITHUB_URL), "landing must link GitHub");
assert(index.includes("./privacy.html"), "landing must link the store privacy index");
assert(index.includes(HOSTING_ORIGIN), "landing must declare the Pages origin");
assert(!index.includes("orfeomorello.pages.dev"), "Pages origin must not contain orfeomorello");
assert(!index.includes("io.mobilespinroulette.app"), "landing must not expose the Play application id as a store URL");
assert(!/play\.google\.com/.test(index), "do not add a Play Store badge before the listing is live");
assert(!index.includes("src/main.ts"), "hosting must not embed the game");
assert(!index.includes("assets/index-"), "hosting must not ship the Vite game bundle");

for (const phrase of banned) {
  assert(!index.toLowerCase().includes(phrase), `landing must not say "${phrase}"`);
  assert(!localesJs.toLowerCase().includes(phrase), `locales.js must not say "${phrase}"`);
}

assert(css.includes("--felt"), "site.css must keep the felt palette");
assert(js.includes("msr-hosting-locale"), "site.js must persist the landing locale");

const requiredFiles = [
  "hosting/site.css",
  "hosting/site.js",
  "hosting/locales.js",
  "hosting/404.html",
  "hosting/_headers",
  "hosting/robots.txt",
  "hosting/roulette-icon.svg",
  "hosting/apple-touch-icon.png",
  "hosting/images/feature-graphic.jpg",
  "hosting/images/phone-home.png",
  "hosting/images/phone-table.png",
  "hosting/images/phone-landscape.png",
  "hosting/images/tablet.png",
  "hosting/privacy.html",
];
for (const file of requiredFiles) {
  assert(existsSync(file), `missing ${file}`);
}
assert(!existsSync(path.join("hosting", "_redirects")), "do not add hosting/_redirects: HTML fallback loops /privacy.html");

const privacyIndex = readFileSync(path.join("hosting", "privacy.html"), "utf8");
assert(privacyIndex.includes("./privacy/en.html"), "hosting privacy index must link English");
assert(privacyIndex.includes("./privacy/it.html"), "hosting privacy index must link Italian");

for (const locale of locales) {
  const file = path.join("hosting", "privacy", `${locale}.html`);
  assert(existsSync(file), `missing hosting privacy page: ${file}`);
  const html = readFileSync(file, "utf8");
  assert(html.includes('href="../"'), `${file} must return to the landing page`);
  assert(!html.includes('id="italiano"'), `${file} must stay a single-language store page`);
}

const englishPrivacy = readFileSync(path.join("hosting", "privacy", "en.html"), "utf8");
assert(englishPrivacy.includes("does not collect, transmit, sell or share personal data"), "English hosting privacy must state the data-collection behavior");
assert(englishPrivacy.includes("virtual points only"), "English hosting privacy must include the simulated-gambling disclaimer");

console.log("✓ hosting landing, assets and store privacy pages are valid");
