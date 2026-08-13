import { createWriteStream, existsSync, unlinkSync, statSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { cwd } from "node:process";
import { createRequire } from "node:module";

// Use built-in compression via PowerShell if no archiver — prefer Node zip with child process tar
import { execFileSync } from "node:child_process";

const root = cwd();
const dist = path.join(root, "dist");
const out = path.join(root, "mobilespinroulette-itch.zip");

if (!existsSync(path.join(dist, "index.html"))) {
  console.error("Missing dist/index.html — run npm run build first");
  process.exit(1);
}

if (existsSync(out)) unlinkSync(out);

// Windows tar can create zip: tar -a -c -f out.zip -C dist files
const entries = [
  "index.html",
  "assets",
  "audio",
  "manifest.webmanifest",
  "privacy.html",
  "sw.js",
  "roulette-icon.svg",
  "roulette-icon-192.png",
  "roulette-icon-512.png",
  "roulette-maskable-192.png",
  "roulette-maskable-512.png",
  "apple-touch-icon.png",
].filter((name) =>
  existsSync(path.join(dist, name)),
);

execFileSync(
  "tar",
  ["-a", "-c", "-f", out, "-C", dist, ...entries],
  { stdio: "inherit" },
);

const size = statSync(out).size;
console.log(`Wrote ${out} (${(size / 1024 / 1024).toFixed(1)} MB)`);
console.log("Entries:", entries.join(", "));
