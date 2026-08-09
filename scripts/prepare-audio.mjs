import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const manifestPath = path.join(root, "public", "audio-manifest.json");
const audioDir = path.join(root, "public", "audio");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

await mkdir(audioDir, { recursive: true });

function digest(data) {
  return createHash("sha256").update(data).digest("hex");
}

async function fetchBuffer(url, referer) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "BitCroupier asset preparation/1.0",
      ...(referer ? { Referer: referer } : {}),
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function resolveTrack(track) {
  if (track.url) return [{ url: track.url }];
  const baseUrl = process.env.BITCROUPIER_AUDIO_BASE_URL?.replace(/\/$/, "");
  if (baseUrl) {
    return [{ url: `${baseUrl}/${encodeURIComponent(track.file)}` }];
  }
  throw new Error(
    `Missing ${track.file}. Pixabay blocks automated source-page downloads. ` +
      "Restore the licensed local file or set BITCROUPIER_AUDIO_BASE_URL to an authorized asset host.",
  );
}

async function isCurrent(target, expectedHash) {
  try {
    if ((await stat(target)).size === 0) return false;
    if (!expectedHash) return true;
    return digest(await readFile(target)) === expectedHash;
  } catch {
    return false;
  }
}

for (const track of manifest.tracks) {
  const target = path.join(audioDir, track.file);
  if (await isCurrent(target, track.sha256)) {
    console.log(`audio ok: ${track.file}`);
    continue;
  }

  try {
    const candidates = await resolveTrack(track);
    let selected;
    for (const candidate of candidates) {
      const data = await fetchBuffer(candidate.url, candidate.referer);
      if (!track.sha256 || digest(data) === track.sha256) {
        selected = data;
        break;
      }
    }
    if (!selected) throw new Error(`Downloaded candidates do not match SHA-256 for ${track.file}`);

    const temporary = `${target}.download`;
    await writeFile(temporary, selected);
    await rm(target, { force: true });
    await rename(temporary, target);
    console.log(`audio downloaded: ${track.file}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`audio optional, skipped: ${track.file}\n  ${reason}`);
  }
}
