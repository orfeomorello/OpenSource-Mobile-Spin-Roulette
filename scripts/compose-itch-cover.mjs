import { cpSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const edgeCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

const executablePath = edgeCandidates.find((candidate) => existsSync(candidate));
if (!executablePath) {
  throw new Error("Microsoft Edge not found; install Edge or pass a Chromium path");
}

const html = path.resolve("scripts/itch-cover.html");
const rootPng = path.resolve("mobilespinroulette-itch-cover.png");
const publicPng = path.resolve("public/itch-cover-630x500.png");

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--hide-scrollbars", "--disable-gpu"],
});
const page = await browser.newPage();
await page.setViewport({ width: 630, height: 500, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(html).href, { waitUntil: "networkidle0" });
await page.screenshot({ path: rootPng, type: "png", omitBackground: false });
await browser.close();

cpSync(rootPng, publicPng);
console.log("Wrote", rootPng);
console.log("Wrote", publicPng);
