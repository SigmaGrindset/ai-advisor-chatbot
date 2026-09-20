/**
 * Draws the application's home-screen icons.
 *
 * Run with `node scripts/icons.mjs` from `frontend/`. The icons it writes into
 * `public/` are committed, because a build that has to rasterise its own
 * artwork is a build with a rasteriser in it; this is the source they came
 * from, kept so the mark can be changed rather than redrawn from memory.
 *
 * The mark is the compass the interface already carries in its own header — a
 * four-point star inside a ring, set in the accent. It is drawn here in
 * pixels rather than fetched, so nothing outside this repository decides what
 * the traveler pins to their home screen.
 *
 * PNG is written by hand over `node:zlib`, which is why there is no image
 * dependency in `package.json`. The format is small enough to be honest about:
 * a signature, a header, one deflated block of filtered rows, and an end.
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, "..", "public");

/**
 * The theme's own accent, and the near-white that is written on it.
 *
 * Read out of `tokens.css` rather than copied, because that file is the only
 * one in the project allowed to say what a colour is, and a mark that quietly
 * kept the old accent after a re-theme would be the worst kind of drift: the
 * one nobody sees until it is already on somebody's home screen.
 */
const THEME = readFileSync(join(HERE, "..", "src", "design", "tokens.css"), "utf8");
const ACCENT = themeColour("accent");
const CHALK = themeColour("accent-contrast");

/** One `--color-*` token from the theme, as the three bytes it names. */
function themeColour(name) {
  const declared = new RegExp(`--color-${name}:\\s*#([0-9a-f]{6})\\b`, "i").exec(THEME);
  if (declared === null) throw new Error(`No --color-${name} in the theme`);
  return [0, 2, 4].map((at) => parseInt(declared[1].slice(at, at + 2), 16));
}

/** Samples a side of each pixel, so the ring and the points have edges. */
const GRAIN = 4;

/**
 * One icon: a square of the accent carrying the mark, drawn at `size` pixels.
 *
 * `room` is how much of the square the mark is allowed, which is the whole
 * difference between an ordinary icon and a maskable one — a launcher that
 * crops to a circle takes the corners, so a maskable mark keeps well inside
 * the safe zone and lets the accent take the cropping.
 */
function draw(size, room) {
  const middle = size / 2;
  const outer = (size * room) / 2;
  // The ring, and the star inside it.
  const ring = outer;
  const band = outer * 0.09;
  const point = outer * 0.74;
  const waist = point * 0.36;

  const pixels = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let lit = 0;
      for (let dy = 0; dy < GRAIN; dy += 1) {
        for (let dx = 0; dx < GRAIN; dx += 1) {
          const at = [
            x + (dx + 0.5) / GRAIN - middle,
            y + (dy + 0.5) / GRAIN - middle,
          ];
          if (onRing(at, ring, band) || inStar(at, point, waist)) lit += 1;
        }
      }
      const mix = lit / (GRAIN * GRAIN);
      const into = (y * size + x) * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        pixels[into + channel] = Math.round(ACCENT[channel] * (1 - mix) + CHALK[channel] * mix);
      }
    }
  }
  return pixels;
}

function onRing([x, y], radius, band) {
  const away = Math.hypot(x, y);
  return away <= radius && away >= radius - band;
}

/**
 * A four-point star, as the winding of a compass needle.
 *
 * The points reach `point` along each axis and the waist pulls in to `waist`
 * on the diagonals, which is what makes it a compass rose rather than a
 * diamond — and what makes it concave, so it is decided by walking the
 * outline rather than by intersecting a few half-planes.
 */
function inStar(at, point, waist) {
  const corner = waist / Math.SQRT2;
  return inside(
    [
      [point, 0],
      [corner, corner],
      [0, point],
      [-corner, corner],
      [-point, 0],
      [-corner, -corner],
      [0, -point],
      [corner, -corner],
    ],
    at,
  );
}

/** Whether a point is within an outline, by how often a ray leaving it crosses. */
function inside(outline, [x, y]) {
  let within = false;
  for (let here = 0, before = outline.length - 1; here < outline.length; before = here, here += 1) {
    const [ax, ay] = outline[here];
    const [bx, by] = outline[before];
    const straddles = ay > y !== by > y;
    if (straddles && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) within = !within;
  }
  return within;
}

/** A PNG of `size` square, from `size * size` RGB triples. */
function png(size, pixels) {
  const stride = size * 3;
  // One filter byte a row, and the filter is "none": the image is flat colour
  // over a few edges, so the deflate does the work a predictor would.
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits a channel
  header[9] = 2; // truecolour, no alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(kind, body) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length, 0);
  const named = Buffer.concat([Buffer.from(kind, "ascii"), body]);
  const checked = Buffer.alloc(4);
  checked.writeUInt32BE(crc(named), 0);
  return Buffer.concat([length, named, checked]);
}

const TABLE = Array.from({ length: 256 }, (_, byte) => {
  let value = byte;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

/**
 * What is written, and why each one is there.
 *
 * - The two square icons are what a manifest offers an installer to choose
 *   from, at the two sizes every installer looks for.
 * - The maskable one is the same mark with room around it, for a launcher
 *   that crops icons to its own shape.
 * - The touch icon is iOS's, which reads no manifest and rounds the corners
 *   itself, so the mark is inset to survive the rounding.
 */
const ICONS = [
  ["icon-192.png", 192, 0.66],
  ["icon-512.png", 512, 0.66],
  ["icon-512-maskable.png", 512, 0.52],
  ["apple-touch-icon.png", 180, 0.6],
];

mkdirSync(PUBLIC, { recursive: true });
for (const [name, size, room] of ICONS) {
  writeFileSync(join(PUBLIC, name), png(size, draw(size, room)));
  process.stdout.write(`${name} ${size}x${size}\n`);
}
