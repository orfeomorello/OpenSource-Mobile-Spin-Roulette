import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const edgeCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const executablePath = edgeCandidates.find((candidate) => existsSync(candidate));
if (!executablePath) throw new Error("Microsoft Edge not found");

const html = path.resolve("playstore/scripts/new-feature-graphic2.html");
const png = path.resolve("playstore/shared/new-feature-graphic2.png");
const jpg = path.resolve("playstore/shared/new-feature-graphic2.jpg");

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

console.log("Wrote", png);
console.log("Wrote", jpg);
