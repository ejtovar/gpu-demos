/* Draws the app icons procedurally and writes PNGs (no dependencies). */
import fs from 'fs';
import zlib from 'zlib';

function png(w, h, rgba) {
  const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/* u, v in [0, 1]^2 (v up) -> [r, g, b] in 0..1. Full bleed: the OS applies the mask. */
const supersonic = (u, v) => {
  const x = (u - 0.5) * 2, y = (v - 0.5) * 2;
  let c = mix([0.04, 0.07, 0.16], [0.10, 0.16, 0.30], v);
  const cx = 0.12, r = 0.30;
  /* bow shock: hyperbola-like curve ahead of the body, hot glow behind it */
  const xs = cx - r - 0.18 + 0.55 * y * y;
  const d = x - xs;
  const glow = Math.exp(-Math.pow(d / 0.035, 2));
  const hot = sstep(0.0, 0.02, d) * Math.exp(-Math.max(d, 0) / 0.35) * sstep(0.95, 0.6, Math.abs(y));
  c = mix(c, [0.85, 0.22, 0.25], 0.65 * hot);
  c = mix(c, [1.0, 0.62, 0.16], 0.55 * hot * hot);
  c = mix(c, [1.0, 0.93, 0.78], glow * sstep(1.0, 0.75, Math.abs(y)));
  /* wake streaks */
  const wake = Math.exp(-Math.pow((y - 0.06 * Math.sin(9 * x)) / 0.12, 2)) * sstep(cx + r - 0.05, cx + r + 0.3, x) * 0.35;
  c = mix(c, [0.98, 0.55, 0.20], wake);
  /* cylinder */
  const rr = Math.hypot(x - cx, y);
  const body = sstep(r + 0.01, r - 0.01, rr);
  const shade = 0.55 + 0.35 * ((-(x - cx) + y) / r * 0.5 + 0.5);
  c = mix(c, [shade * 0.82, shade * 0.86, shade * 0.85], body);
  return c;
};
const runoff = (u, v) => {
  const x = u, y = v;
  let c = mix([0.13, 0.30, 0.20], [0.30, 0.45, 0.26], y);
  /* terrain shading bands */
  const h = 0.5 + 0.25 * Math.sin(7 * x + 3 * y) * Math.cos(5 * y - 2 * x);
  c = mix(c, [0.42, 0.52, 0.32], 0.3 * h);
  /* river */
  const rc = 0.5 + 0.18 * Math.sin(5.5 * y + 0.6) + 0.06 * Math.sin(13 * y);
  const w = 0.07 + 0.05 * (1 - y);
  const dist = Math.abs(x - rc);
  const water = sstep(w, w - 0.02, dist);
  const shore = Math.exp(-Math.pow((dist - w) / 0.02, 2));
  c = mix(c, [0.82, 0.86, 0.72], 0.5 * shore);
  c = mix(c, mix([0.20, 0.50, 0.85], [0.55, 0.80, 1.0], Math.max(0, 1 - dist / w) * 0.6), water);
  /* rain streaks */
  const s = (x * 23 + y * 31) % 1, t = ((x * 7.3 - y * 2.1) * 9) % 1;
  const rain = (Math.abs(s - 0.5) < 0.03 && Math.abs(t - 0.5) < 0.2 && y > 0.55) ? 0.35 : 0;
  c = mix(c, [0.85, 0.92, 1.0], rain);
  return c;
};
const stratus = (u, v) => {
  /* potential temperature bands (blue below, warm above) bent into lee waves over a mountain */
  const hx = 0.36, m = 0.30 * Math.exp(-Math.pow((u - hx) / 0.13, 2));
  const wave = (y) => 0.07 * Math.exp(-Math.pow((y - 0.55) / 0.35, 2)) * Math.sin(10 * (u - hx) - 6 * y) * sstep(0.1, 0.35, u);
  const th = v - m * Math.exp(-2.5 * v) + wave(v);
  const pal = [[0.11, 0.17, 0.36], [0.16, 0.45, 0.58], [0.55, 0.72, 0.62], [0.93, 0.80, 0.52], [0.89, 0.45, 0.22]];
  const t = Math.min(0.999, Math.max(0, th)) * 4, k = Math.floor(t);
  let c = mix(pal[k], pal[k + 1], t - k);
  /* isentropes */
  const line = Math.abs(((th * 9) % 1 + 1) % 1 - 0.5);
  c = mix(c, [0.97, 0.97, 0.95], 0.55 * sstep(0.42, 0.48, line));
  /* mountain */
  const ground = 0.12 + m;
  c = mix(c, mix([0.33, 0.29, 0.24], [0.55, 0.50, 0.38], sstep(ground - 0.06, ground, v)), sstep(ground + 0.006, ground - 0.006, v));
  return c;
};
function render(f, n) {
  const ss = 3, buf = Buffer.alloc(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let acc = [0, 0, 0];
    for (let b = 0; b < ss; b++) for (let a = 0; a < ss; a++) {
      const c = f((i + (a + 0.5) / ss) / n, 1 - (j + (b + 0.5) / ss) / n);
      acc = acc.map((v, k) => v + c[k] / (ss * ss));
    }
    const k = 4 * (j * n + i);
    buf[k] = Math.round(255 * Math.min(1, Math.max(0, acc[0]))); buf[k + 1] = Math.round(255 * Math.min(1, Math.max(0, acc[1])));
    buf[k + 2] = Math.round(255 * Math.min(1, Math.max(0, acc[2]))); buf[k + 3] = 255;
  }
  return png(n, n, buf);
}
for (const [name, f] of [['supersonic', supersonic], ['runoff', runoff], ['stratus', stratus]]) {
  fs.mkdirSync(`docs/${name}`, { recursive: true });
  for (const n of [512, 192, 180]) fs.writeFileSync(`docs/${name}/icon-${n}.png`, render(f, n));
}
console.log('icons written');
