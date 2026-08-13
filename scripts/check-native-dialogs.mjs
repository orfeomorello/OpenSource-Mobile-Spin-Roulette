import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const roots = ["src", "scripts", "public"];
const sourceExtensions = new Set([".ts", ".js", ".mjs", ".html"]);
const nativeDialogCall = /\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/g;
const violations = [];

async function visit(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const itemPath = join(path, entry.name);
    if (entry.isDirectory()) {
      await visit(itemPath);
      continue;
    }
    if (!sourceExtensions.has(extname(entry.name))) continue;
    const source = await readFile(itemPath, "utf8");
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (nativeDialogCall.test(line)) violations.push(`${itemPath}:${index + 1}`);
      nativeDialogCall.lastIndex = 0;
    });
  }
}

for (const root of roots) await visit(root);

if (violations.length) {
  console.error(`Native browser dialogs found:\n${violations.join("\n")}`);
  process.exit(1);
}

console.log("✓ no native alert, confirm or prompt calls");
