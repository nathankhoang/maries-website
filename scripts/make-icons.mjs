/* Dependency-free PWA icon generator (run on your machine):
 *   npm run make-icons
 * Emits brand-pink rounded-square icons with a white "equalizer" mark
 * (reads as audio/translation). Re-run only if you change the design.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ── Minimal PNG encoder (RGBA, filter 0) ─────────────────────────────── */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size);
      const p = rowStart + 1 + x * 4;
      raw[p] = r; raw[p + 1] = g; raw[p + 2] = b; raw[p + 3] = a;
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type RGBA
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ── Brand design ─────────────────────────────────────────────────────── */
const PINK = [219, 39, 119]; // --pink-600
const WHITE = [255, 255, 255];
const CLEAR = [0, 0, 0, 0];

function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function pixel(x, y, S) {
  // Rounded-square pink tile (kept within full canvas; safe for maskable).
  if (!inRoundedRect(x, y, 0, 0, S - 1, S - 1, S * 0.22)) return CLEAR;

  // White "equalizer" — 4 centered bars of varying height (audio/translation).
  const heights = [0.40, 0.66, 0.54, 0.46];
  const bars = heights.length;
  const glyphW = S * 0.46;
  const barW = glyphW / (bars * 2 - 1);
  const startX = (S - glyphW) / 2;
  const midY = S / 2;
  for (let i = 0; i < bars; i++) {
    const bx0 = startX + i * 2 * barW;
    const bx1 = bx0 + barW;
    const h = heights[i] * S;
    const by0 = midY - h / 2;
    const by1 = midY + h / 2;
    if (inRoundedRect(x, y, bx0, by0, bx1, by1, barW * 0.45)) return WHITE;
  }
  return [...PINK, 255];
}

const SIZES = [
  ['images/icon-192.png', 192],
  ['images/icon-512.png', 512],
  ['images/apple-touch-icon.png', 180],
  ['images/favicon-32.png', 32],
];

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" rx="22" fill="#db2777"/>
<g fill="#fff">
<rect x="27" y="30" width="6.6" height="40" rx="3"/>
<rect x="40.2" y="17" width="6.6" height="66" rx="3"/>
<rect x="53.4" y="23" width="6.6" height="54" rx="3"/>
<rect x="66.6" y="27" width="6.6" height="46" rx="3"/>
</g></svg>`;

await mkdir(join(root, 'images'), { recursive: true });
for (const [rel, size] of SIZES) {
  await writeFile(join(root, rel), encodePNG(size, pixel));
  console.log(`✓ ${rel} (${size}×${size})`);
}
await writeFile(join(root, 'images', 'icon.svg'), SVG, 'utf8');
console.log('✓ images/icon.svg');
