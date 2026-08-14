import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { listings } from "../copy.mjs";

const BASE = process.env.PLAYSTORE_CAPTURE_URL ?? "http://127.0.0.1:4173/";
const edgeCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const executablePath = edgeCandidates.find((candidate) => existsSync(candidate));
if (!executablePath) throw new Error("Microsoft Edge not found");

const settings = {
  schemaVersion: 1,
  defaultTableVariant: "european",
  animationEnabled: true,
  muted: true,
  musicVolume: 0,
  playerMusicMode: "random",
  backgroundAnimation: "none",
};

const shots = [
  { file: "01-phone-home-1080x1920.png", width: 360, height: 640, dpr: 3, scene: "home" },
  { file: "02-phone-settings-1080x1920.png", width: 360, height: 640, dpr: 3, scene: "settings" },
  { file: "03-phone-table-1080x1920.png", width: 360, height: 640, dpr: 3, scene: "table" },
  { file: "04-phone-landscape-1920x1080.png", width: 640, height: 360, dpr: 3, scene: "table" },
  { file: "05-tablet7-table-1200x1920.png", width: 600, height: 960, dpr: 2, scene: "table" },
  { file: "06-tablet10-landscape-1920x1200.png", width: 960, height: 600, dpr: 2, scene: "table" },
];

async function waitVisible(page, selector, timeout = 15000) {
  await page.waitForSelector(selector, { visible: true, timeout });
}

async function applyLocale(page, locale) {
  await page.evaluateOnNewDocument(
    (nextLocale, nextSettings) => {
      localStorage.setItem("mobilespinroulette.locale.v1", nextLocale);
      localStorage.setItem("mobilespinroulette.settings.v1", JSON.stringify(nextSettings));
    },
    locale,
    settings,
  );
}

async function openHome(page) {
  await page.goto(BASE, { waitUntil: "networkidle0", timeout: 60000 });
  await page.evaluate(() => document.fonts?.ready);
  await waitVisible(page, "#start-game");
  await new Promise((resolve) => setTimeout(resolve, 250));
}

async function openSettings(page) {
  await page.click("#open-settings");
  await waitVisible(page, ".settings-panel");
  await new Promise((resolve) => setTimeout(resolve, 200));
}

async function openTable(page) {
  if (await page.$("#start-game")) {
    await page.click("#start-game");
  } else if (await page.$(".settings-back")) {
    await page.click(".settings-back");
    await waitVisible(page, "#start-game");
    await page.click("#start-game");
  }
  await waitVisible(page, ".player-felt");
  await waitVisible(page, "#player-spin");
  const hosts = ["straight_17", "straight_8", "straight_32", "red", "even"];
  for (const id of hosts) {
    const handle = await page.$(`[data-chip-host="${id}"]`);
    if (handle) await handle.click();
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}

async function capture(page, dest, spec) {
  await page.setViewport({
    width: spec.width,
    height: spec.height,
    deviceScaleFactor: spec.dpr,
    isMobile: spec.width < 700,
    hasTouch: true,
  });
  if (spec.scene === "home") await openHome(page);
  else if (spec.scene === "settings") {
    await openHome(page);
    await openSettings(page);
  } else {
    await openHome(page);
    await openTable(page);
  }
  await page.screenshot({
    path: dest,
    type: "png",
    omitBackground: false,
    captureBeyondViewport: false,
  });
}

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--hide-scrollbars", "--disable-gpu", "--allow-insecure-localhost"],
});

try {
  const probe = await browser.newPage();
  const response = await probe.goto(BASE, { waitUntil: "domcontentloaded", timeout: 15000 });
  if (!response || !response.ok()) {
    throw new Error(`Preview is not reachable at ${BASE}. Run npm.cmd run preview first.`);
  }
  await probe.close();

  for (const entry of listings) {
    const shotDir = path.resolve("playstore", entry.id, "screenshots");
    mkdirSync(shotDir, { recursive: true });
    const page = await browser.newPage();
    await applyLocale(page, entry.id);
    for (const spec of shots) {
      const dest = path.join(shotDir, spec.file);
      process.stdout.write(`${entry.id} ${spec.file}… `);
      await capture(page, dest, spec);
      console.log("ok");
    }
    await page.close();
    cpSync(path.resolve("playstore/shared/icon-512.png"), path.resolve("playstore", entry.id, "icon-512.png"));
    const feature = path.resolve("playstore/shared/feature-graphic-1024x500.png");
    if (existsSync(feature)) {
      cpSync(feature, path.resolve("playstore", entry.id, "feature-graphic-1024x500.png"));
    }
  }
} finally {
  await browser.close();
}

console.log("Captured screenshots for", listings.length, "languages");
