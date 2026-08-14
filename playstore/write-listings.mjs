import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LISTING_LIMITS, PUBLIC_HTTPS_ORIGIN, listings } from "./copy.mjs";

function count(value) {
  return [...value].length;
}

function listingMarkdown(entry) {
  const nameLen = count(entry.name);
  const shortLen = count(entry.short);
  const fullLen = count(entry.full);
  const notesLen = count(entry.releaseNotes);
  const folder = entry.id;
  return `# ${entry.name} — ${entry.playLanguage}

Play Console → **Grow users → Store presence → Main store listing**  
Language to add: **${entry.playLanguage}** (\`${entry.playCode}\`)  
${entry.isDefault ? "**Default listing.** Fill this first." : "Translation. If a graphic is missing here, Play reuses the default-language graphic."}

Do not edit the fenced blocks below. Copy the inner text only.

## App name (max ${LISTING_LIMITS.name} · ${nameLen} used)

\`\`\`
${entry.name}
\`\`\`

## Short description (max ${LISTING_LIMITS.short} · ${shortLen} used)

\`\`\`
${entry.short}
\`\`\`

## Full description (max ${LISTING_LIMITS.full} · ${fullLen} used)

\`\`\`
${entry.full}
\`\`\`

## Release notes — first production release (max ${LISTING_LIMITS.releaseNotes} · ${notesLen} used)

Play Console → **Release → Production** (or testing track) → Release notes for ${entry.playLanguage}.

\`\`\`
${entry.releaseNotes}
\`\`\`

## Graphics to upload for this language

Reuse the shared files unless you later make a localized feature graphic.

| Play field | File | Spec |
| --- | --- | --- |
| App icon | \`../shared/icon-512.png\` (copy also in this folder) | 512×512 PNG 32-bit, alpha OK, ≤ 1 MB |
| Feature graphic | \`../shared/feature-graphic-1024x500.png\` | 1024×500 JPEG or 24-bit PNG, **no alpha** |
| Phone screenshots | \`screenshots/01-phone-home-1080x1920.png\` … | 2–8 images; 1080×1920 or 1920×1080 |
| 7-inch tablet | \`screenshots/05-tablet7-table-1200x1920.png\` | recommended |
| 10-inch tablet | \`screenshots/06-tablet10-landscape-1920x1200.png\` | recommended |

Phone set captured for this language:

1. \`screenshots/01-phone-home-1080x1920.png\`
2. \`screenshots/02-phone-settings-1080x1920.png\`
3. \`screenshots/03-phone-table-1080x1920.png\`
4. \`screenshots/04-phone-landscape-1920x1080.png\`
5. \`screenshots/05-tablet7-table-1200x1920.png\`
6. \`screenshots/06-tablet10-landscape-1920x1200.png\`

Preview video: optional YouTube URL. Cover image is the feature graphic. Not required to publish.

## Privacy policy URL (once per app, not per language)

Play Console → **App content → Privacy policy** accepts **one** HTTPS URL. Use the index so every language is one tap away:

\`\`\`
${PUBLIC_HTTPS_ORIGIN}/privacy.html
\`\`\`

Direct page for this language (link from the index, or from a localized website):

\`\`\`
${PUBLIC_HTTPS_ORIGIN}/privacy/${folder === "pt-BR" ? "pt-BR" : folder}.html
\`\`\`

Use the index URL in Play Console. The pages live in \`hosting/\` on Cloudflare Pages. Do not use a \`file:\` path.

## Category and contact (once per app)

- App / game category: **Game → Casino** (simulated / virtual points).
- Contact email: the Play developer account email.
- Website (optional): GitHub or the HTTPS host.

## Policy phrases already in this copy

Virtual points only. No real-money gambling, purchases, cash-out or prizes. Do not add “win money”, “real jackpot” or “casino cash”.
`;
}

for (const entry of listings) {
  const dir = path.join("playstore", entry.id);
  mkdirSync(path.join(dir, "screenshots"), { recursive: true });
  writeFileSync(path.join(dir, "listing.md"), listingMarkdown(entry), "utf8");
}

console.log(`Wrote ${listings.length} listing.md files`);
