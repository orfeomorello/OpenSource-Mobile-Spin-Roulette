import { cpSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";
import { listings } from "../copy.mjs";

const edgeCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

const executablePath = edgeCandidates.find((candidate) => existsSync(candidate));
if (!executablePath) {
  throw new Error("Microsoft Edge not found; install Edge or pass a Chromium path");
}

const html = path.resolve("playstore/scripts/feature-graphic.html");
const png = path.resolve("playstore/shared/feature-graphic-1024x500.png");
const jpg = path.resolve("playstore/shared/feature-graphic-1024x500.jpg");

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--hide-scrollbars", "--disable-gpu"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1024, height: 500, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(html).href, { waitUntil: "networkidle0" });
await page.screenshot({ path: png, type: "png", omitBackground: false });
await page.screenshot({ path: jpg, type: "jpeg", quality: 92 });
await browser.close();

for (const entry of listings) {
  const folder = path.resolve("playstore", entry.id);
  cpSync(png, path.join(folder, "feature-graphic-1024x500.png"));
  cpSync(path.resolve("playstore/shared/icon-512.png"), path.join(folder, "icon-512.png"));
}

console.log("Wrote", png);
console.log("Wrote", jpg);
