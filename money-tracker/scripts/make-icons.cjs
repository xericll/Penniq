// Draws the Penniq app icons from the master symbol (no dependencies): `npm run icons`.
// Guideline p.45: the symbol alone, parchment cradle and flat gold coin on Ledger Navy,
// about 62% of the tile wide and nudged slightly down so it looks centred.
// The paths are read from src/components/ui/brandArt.ts and filled with a supersampled scanline.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const NAVY = [0x1f, 0x26, 0x35];
const PARCHMENT = [0xef, 0xea, 0xdf];
const GOLD = [0xc2, 0xa9, 0x7d];

const art = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'ui', 'brandArt.ts'), 'utf8');
const symbolBlock = art.slice(art.indexOf('export const SYMBOL'), art.indexOf('export const WORDMARK'));
const num = (name) => Number(symbolBlock.match(new RegExp(`${name}: ([\\d.]+)`))[1]);
const str = (name) => symbolBlock.match(new RegExp(`${name}: '([^']+)'`))[1];
const SYMBOL = { width: num('width'), height: num('height'), coin: str('coin'), cradle: str('cradle') };

/** Flatten an M/L/C/Z path into closed polygons. */
function polygons(d) {
  const tokens = d.match(/[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?/g);
  const polys = [];
  let cur = null;
  let i = 0;
  let x = 0;
  let y = 0;
  const n = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === 'M') {
      x = n();
      y = n();
      cur = [[x, y]];
      polys.push(cur);
    } else if (cmd === 'L') {
      x = n();
      y = n();
      cur.push([x, y]);
    } else if (cmd === 'C') {
      const [x1, y1, x2, y2, x3, y3] = [n(), n(), n(), n(), n(), n()];
      for (let s = 1; s <= 24; s++) {
        const t = s / 24;
        const u = 1 - t;
        cur.push([
          u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
        ]);
      }
      x = x3;
      y = y3;
    }
  }
  return polys;
}

/** Coverage (0..1) of a set of polygons per pixel, nonzero winding, SS×SS samples per pixel. */
function coverage(polys, size, transform) {
  const SS = 4;
  const cov = new Float32Array(size * size);
  const edges = [];
  for (const poly of polys) {
    const pts = poly.map(transform);
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k];
      const b = pts[(k + 1) % pts.length];
      if (a[1] !== b[1]) edges.push(a[1] < b[1] ? [a[0], a[1], b[0], b[1], 1] : [b[0], b[1], a[0], a[1], -1]);
    }
  }
  for (let sy = 0; sy < size * SS; sy++) {
    const yy = (sy + 0.5) / SS;
    const hits = [];
    for (const [x0, y0, x1, y1, w] of edges) {
      if (yy >= y0 && yy < y1) hits.push([x0 + ((yy - y0) / (y1 - y0)) * (x1 - x0), w]);
    }
    hits.sort((p, q) => p[0] - q[0]);
    let wind = 0;
    for (let h = 0; h < hits.length - 1; h++) {
      wind += hits[h][1];
      if (wind === 0) continue;
      const from = hits[h][0];
      const to = hits[h + 1][0];
      for (let sx = Math.max(0, Math.ceil(from * SS - 0.5)); sx < Math.min(size * SS, to * SS - 0.5); sx++) {
        cov[Math.floor(yy) * size + Math.floor((sx + 0.5) / SS)] += 1 / (SS * SS);
      }
    }
  }
  return cov;
}

function render(size, { scale, fullBleed }) {
  const w = size * scale;
  const k = w / SYMBOL.width;
  const h = SYMBOL.height * k;
  const ox = (size - w) / 2;
  const oy = (size - h) / 2 + size * 0.02;
  const t = ([x, y]) => [ox + x * k, oy + y * k];
  const cradle = coverage(polygons(SYMBOL.cradle), size, t);
  const coin = coverage(polygons(SYMBOL.coin), size, t);
  const px = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const r = size * 0.22;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Tile: rounded square, or full bleed for maskable / iOS icons (they are masked by the OS).
      let alpha = 1;
      if (!fullBleed) {
        const qx = Math.abs(x + 0.5 - c) - (c - r);
        const qy = Math.abs(y + 0.5 - c) - (c - r);
        const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
        alpha = Math.max(0, Math.min(1, 0.5 - outside));
      }
      const i = y * size + x;
      const a = Math.min(1, cradle[i]);
      const g = Math.min(1, coin[i]);
      const col = NAVY.map((v, j) => v + (PARCHMENT[j] - v) * a).map((v, j) => v + (GOLD[j] - v) * g);
      px[i * 4] = Math.round(col[0]);
      px[i * 4 + 1] = Math.round(col[1]);
      px[i * 4 + 2] = Math.round(col[2]);
      px[i * 4 + 3] = Math.round(alpha * 255);
    }
  }
  return px;
}

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
  for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = path.join(__dirname, '..', 'public');
const icons = [
  ['icon-192.png', 192, { scale: 0.62 }],
  ['icon-512.png', 512, { scale: 0.62 }],
  // Maskable icons are cropped to a circle of 80%: keep the symbol inside it.
  ['icon-maskable-512.png', 512, { scale: 0.5, fullBleed: true }],
  ['apple-touch-icon.png', 180, { scale: 0.6, fullBleed: true }],
];
for (const [name, size, opts] of icons) {
  fs.writeFileSync(path.join(out, name), png(size, render(size, opts)));
  console.log('wrote', name);
}

// Favicon: the same tile as an SVG.
const fw = 64 * 0.66;
const fk = fw / SYMBOL.width;
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#1f2635"/>
  <g transform="translate(${((64 - fw) / 2).toFixed(2)} ${((64 - SYMBOL.height * fk) / 2 + 1.3).toFixed(2)}) scale(${fk.toFixed(5)})">
    <path fill="#efeadf" d="${SYMBOL.cradle}"/>
    <path fill="#c2a97d" d="${SYMBOL.coin}"/>
  </g>
</svg>
`;
fs.writeFileSync(path.join(out, 'favicon.svg'), favicon);
console.log('wrote favicon.svg');
