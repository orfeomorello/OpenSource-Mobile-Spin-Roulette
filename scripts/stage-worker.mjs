import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

await mkdir("dist/server", { recursive: true });
const worker = "export default { async fetch(request, env) { return env.ASSETS.fetch(request); } };\n";
await writeFile("dist/server/index.js", worker);

const distDirectory = path.resolve("dist");
const serviceWorkerPath = path.join(distDirectory, "sw.js");

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(absolute));
    else files.push(absolute);
  }
  return files;
}

const files = (await listFiles(distDirectory))
  .map((file) => path.relative(distDirectory, file).replaceAll(path.sep, "/"))
  .filter((file) => file !== "sw.js" && !file.startsWith("audio/") && !file.startsWith("server/"))
  .sort();
const precache = ["./", ...files.map((file) => `./${file}`)];
let serviceWorker = await readFile(serviceWorkerPath, "utf8");
if (!serviceWorker.includes("/* __MSR_PRECACHE__ */ []") || !serviceWorker.includes("__BUILD_ID__")) {
  throw new Error("Service worker injection markers are missing");
}
const buildId = createHash("sha256")
  .update(serviceWorker)
  .update(JSON.stringify(precache))
  .digest("hex")
  .slice(0, 12);
serviceWorker = serviceWorker
  .replace("/* __MSR_PRECACHE__ */ []", `/* generated */ ${JSON.stringify(precache)}`)
  .replaceAll("__BUILD_ID__", buildId);
await writeFile(serviceWorkerPath, serviceWorker);
console.log(`Prepared service worker ${buildId} with ${precache.length} offline shell entries`);
