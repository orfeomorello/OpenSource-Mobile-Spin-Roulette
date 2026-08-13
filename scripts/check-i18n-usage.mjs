import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const englishKeys = new Set(JSON.parse(fs.readFileSync("scripts/_en-keys.json", "utf8")));
const translationNamespaces = new Set([...englishKeys].map((key) => key.split(".")[0]));
const runtimeKeys = new Set();
const sourceFiles = [];

const visit = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(full);
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")
      && !full.endsWith("i18n.ts") && !full.endsWith("extraCatalogs.ts")) sourceFiles.push(full);
  }
};
visit("src");

for (const file of sourceFiles) {
  const text = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const scan = (node) => {
    if (ts.isStringLiteralLike(node) && /^[a-z][\w-]*(?:\.[\w-]+)+$/.test(node.text)
      && translationNamespaces.has(node.text.split(".")[0])) runtimeKeys.add(node.text);
    ts.forEachChild(node, scan);
  };
  scan(source);
}

[
  "player.phase.PREPARE",
  "player.phase.BETTING_OPEN",
  "player.phase.BETTING_CLOSED",
  "player.phase.SPINNING",
  "player.phase.PAYOUT",
  "player.phase.GAME_OVER",
  "player.snap.straight",
  "player.snap.split",
  "player.snap.corner",
  "player.snap.street",
  "player.snap.sixLine",
  "player.snap.trio",
  "player.snap.firstFour",
  "player.snap.fiveNumber",
  "player.snap.outside",
].forEach((key) => runtimeKeys.add(key));

const missing = [...runtimeKeys].filter((key) => !englishKeys.has(key)).sort();
if (missing.length) {
  console.error(`Missing English translations:\n${missing.join("\n")}`);
  process.exit(1);
}
console.log(`✓ ${runtimeKeys.size} runtime translation keys are defined`);
