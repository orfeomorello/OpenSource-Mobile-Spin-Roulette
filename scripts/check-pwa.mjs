import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const manifestPath = path.join("public", "manifest.webmanifest");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

assert(manifest.id === "./", "manifest id must remain relative for subdirectory hosting");
assert(manifest.start_url === "./", "manifest start_url must remain relative");
assert(manifest.scope === "./", "manifest scope must remain relative");
assert(manifest.display === "standalone", "manifest must launch standalone");
assert(manifest.orientation === "any", "manifest must allow portrait and landscape");
assert(typeof manifest.short_name === "string" && manifest.short_name.length <= 12, "short_name must fit launcher labels");
assert(manifest.categories?.includes("games"), "manifest must declare the games category");

const expectedIcons = new Map([
  ["./roulette-icon-192.png", { size: 192, purpose: "any" }],
  ["./roulette-icon-512.png", { size: 512, purpose: "any" }],
  ["./roulette-maskable-192.png", { size: 192, purpose: "maskable" }],
  ["./roulette-maskable-512.png", { size: 512, purpose: "maskable" }],
]);

assert(Array.isArray(manifest.icons) && manifest.icons.length === expectedIcons.size, "manifest must contain four PNG icons");
for (const icon of manifest.icons) {
  const expected = expectedIcons.get(icon.src);
  assert(expected, `unexpected manifest icon: ${icon.src}`);
  assert(icon.type === "image/png", `${icon.src} must be a PNG`);
  assert(icon.purpose === expected.purpose, `${icon.src} must have purpose ${expected.purpose}`);
  assert(icon.sizes === `${expected.size}x${expected.size}`, `${icon.src} has an invalid sizes value`);

  const file = path.join("public", icon.src.replace(/^\.\//, ""));
  assert(existsSync(file), `missing icon file: ${file}`);
  const png = readFileSync(file);
  assert(png.subarray(1, 4).toString("ascii") === "PNG", `${file} has an invalid PNG signature`);
  assert(png.readUInt32BE(16) === expected.size && png.readUInt32BE(20) === expected.size, `${file} dimensions do not match the manifest`);
}

const appleIcon = readFileSync(path.join("public", "apple-touch-icon.png"));
assert(appleIcon.readUInt32BE(16) === 180 && appleIcon.readUInt32BE(20) === 180, "Apple touch icon must be 180x180");

const index = readFileSync("index.html", "utf8");
assert(index.includes('rel="apple-touch-icon"'), "index must expose the Apple touch icon");
assert(index.includes('rel="manifest"'), "index must link the web app manifest");

const privacyLocales = ["en", "it", "es", "pt-BR", "fr", "de", "ko", "ja", "zh"];
const privacyIndex = readFileSync(path.join("public", "privacy.html"), "utf8");
assert(privacyIndex.includes("./privacy/en.html"), "privacy index must link the English store page");
assert(privacyIndex.includes("./privacy/it.html"), "privacy index must link the Italian store page");

for (const locale of privacyLocales) {
  const file = path.join("public", "privacy", `${locale}.html`);
  assert(existsSync(file), `missing store privacy page: ${file}`);
  const html = readFileSync(file, "utf8");
  assert(!html.includes('id="italiano"'), `${file} must be a single-language store page`);
}

const englishPrivacy = readFileSync(path.join("public", "privacy", "en.html"), "utf8");
assert(englishPrivacy.includes("does not collect, transmit, sell or share personal data"), "English store privacy must state the data-collection behavior");
assert(englishPrivacy.includes("virtual points only"), "English store privacy must include the simulated-gambling disclaimer");

const appSource = readFileSync(path.join("src", "main.ts"), "utf8");
assert(!appSource.includes("privacy.html"), "in-app UI must not open the store privacy URL");
assert(!/href=["']\.\/privacy\//.test(appSource), "in-app UI must not link per-locale store privacy pages");

const serviceWorker = readFileSync(path.join("public", "sw.js"), "utf8");
assert(serviceWorker.includes("__BUILD_ID__"), "source service worker must expose the build-id marker");
assert(serviceWorker.includes("/* __MSR_PRECACHE__ */ []"), "source service worker must expose the precache marker");
assert(serviceWorker.includes('event.request.destination === "audio"'), "service worker must leave audio streaming to the browser");

console.log("✓ PWA manifest, icons, privacy and offline-shell sources are valid");
