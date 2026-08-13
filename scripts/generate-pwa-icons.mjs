import { writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";

const root = process.cwd();
const outputDirectory = path.join(root, "public");
const samplesPerAxis = 2;

const palette = {
  background: rgb("#081611"),
  wood: rgb("#5c371b"),
  gold: rgb("#d6b66f"),
  brightGold: rgb("#e4c680"),
  red: rgb("#8f1f20"),
  black: rgb("#151a18"),
  green: rgb("#123326"),
  hubWood: rgb("#5a3519"),
  hubGold: rgb("#f0d99d"),
  ball: rgb("#f4ead6"),
  ballEdge: rgb("#b99454"),
};

const targets = [
  { file: "roulette-icon-192.png", size: 192, maskable: false },
  { file: "roulette-icon-512.png", size: 512, maskable: false },
  { file: "roulette-maskable-192.png", size: 192, maskable: true },
  { file: "roulette-maskable-512.png", size: 512, maskable: true },
  { file: "apple-touch-icon.png", size: 180, maskable: false },
];

function rgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function renderIcon(size, maskable) {
  const pixels = Buffer.alloc(size * size * 4);
  const sampleCount = samplesPerAxis * samplesPerAxis;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let opaqueSamples = 0;

      for (let sy = 0; sy < samplesPerAxis; sy += 1) {
        for (let sx = 0; sx < samplesPerAxis; sx += 1) {
          const px = ((x + (sx + 0.5) / samplesPerAxis) / size) * 512;
          const py = ((y + (sy + 0.5) / samplesPerAxis) / size) * 512;
          const color = colorAt(px, py, maskable);
          if (!color) continue;
          red += color[0];
          green += color[1];
          blue += color[2];
          opaqueSamples += 1;
        }
      }

      const offset = (y * size + x) * 4;
      if (opaqueSamples > 0) {
        pixels[offset] = Math.round(red / opaqueSamples);
        pixels[offset + 1] = Math.round(green / opaqueSamples);
        pixels[offset + 2] = Math.round(blue / opaqueSamples);
      }
      pixels[offset + 3] = Math.round((opaqueSamples / sampleCount) * 255);
    }
  }

  return pixels;
}

function colorAt(x, y, maskable) {
  if (!maskable && !insideRoundedSquare(x, y, 112)) return null;

  let color = palette.background;
  const dx = x - 256;
  const dy = y - 256;
  const radius = Math.hypot(dx, dy);

  if (radius <= 197) color = radius >= 183 ? palette.gold : palette.wood;

  if (radius >= 108 && radius <= 175) {
    const degrees = ((Math.atan2(dy, dx) * 180) / Math.PI + 450) % 360;
    const sectorPosition = (degrees % 20) / 20;
    if (sectorPosition >= 0.08 && sectorPosition <= 0.92) {
      color = Math.floor(degrees / 20) % 2 === 0 ? palette.red : palette.black;
    }
  }

  if (radius <= 109) color = radius >= 95 ? palette.brightGold : palette.green;
  if (radius <= 39) color = radius >= 29 ? palette.hubGold : palette.hubWood;

  const ballRadius = Math.hypot(x - 364, y - 138);
  if (ballRadius <= 22.5) color = ballRadius >= 15.5 ? palette.ballEdge : palette.ball;

  return color;
}

function insideRoundedSquare(x, y, cornerRadius) {
  if (x >= cornerRadius && x <= 512 - cornerRadius) return true;
  if (y >= cornerRadius && y <= 512 - cornerRadius) return true;
  const cx = x < cornerRadius ? cornerRadius : 512 - cornerRadius;
  const cy = y < cornerRadius ? cornerRadius : 512 - cornerRadius;
  return Math.hypot(x - cx, y - cy) <= cornerRadius;
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (stride + 1);
    raw[rowOffset] = 0;
    rgba.copy(raw, rowOffset + 1, y * stride, (y + 1) * stride);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), data.length + 8);
  return chunk;
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

for (const target of targets) {
  const pixels = renderIcon(target.size, target.maskable);
  await writeFile(path.join(outputDirectory, target.file), encodePng(target.size, target.size, pixels));
  console.log(`Wrote public/${target.file}`);
}
