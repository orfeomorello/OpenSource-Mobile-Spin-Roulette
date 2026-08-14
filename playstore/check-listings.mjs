import { LISTING_LIMITS, listings } from "./copy.mjs";

function count(value) {
  return [...value].length;
}

let failed = 0;
for (const entry of listings) {
  const checks = [
    ["name", entry.name, LISTING_LIMITS.name],
    ["short", entry.short, LISTING_LIMITS.short],
    ["full", entry.full, LISTING_LIMITS.full],
    ["releaseNotes", entry.releaseNotes, LISTING_LIMITS.releaseNotes],
  ];
  for (const [field, value, limit] of checks) {
    const n = count(value);
    const ok = n > 0 && n <= limit;
    const mark = ok ? "ok" : "FAIL";
    if (!ok) failed += 1;
    console.log(`${mark} ${entry.id} ${field}: ${n}/${limit}`);
  }
  if (/vinci soldi|casino cash|jackpot reale|win money|real jackpot/i.test(`${entry.short}\n${entry.full}`)) {
    failed += 1;
    console.log(`FAIL ${entry.id} forbidden real-money phrase`);
  }
}

const defaults = listings.filter((entry) => entry.isDefault);
if (defaults.length !== 1 || defaults[0].id !== "en") {
  failed += 1;
  console.log("FAIL default listing must be en");
}

if (failed) {
  console.error(`listing check failed (${failed})`);
  process.exit(1);
}
console.log("✓ playstore listing copy is within Play Console limits");
