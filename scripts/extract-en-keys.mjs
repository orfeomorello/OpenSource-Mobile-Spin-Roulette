import fs from "fs";
const t = fs.readFileSync("src/i18n.ts", "utf8");
const m = t.match(/const en[^=]*=\s*\{([\s\S]*?)\n\};/);
if (!m) {
  console.error("no en block");
  process.exit(1);
}
const keys = [...m[1].matchAll(/"([^"]+)":/g)].map((x) => x[1]);
fs.writeFileSync("scripts/_en-keys.json", JSON.stringify(keys, null, 2));
console.log("keys", keys.length);
