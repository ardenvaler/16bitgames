// Renders the app icon from the game's own sprite code (needs Playwright + Chromium),
// then writes build/icon.png (256px) and build/icon.ico (16–256px).
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exe = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage();
await page.goto('file://' + path.join(root, 'src', 'index.html'));
await page.waitForTimeout(300);
const sizes = [256, 128, 64, 48, 32, 24, 16];
const pngs = await page.evaluate(sizes => {
  const def = { ...D.MOBS.pupseal, id: 'icon-seal', size: 1 };
  def.p = { ...def.p, k: 'aurora' };
  const full = Art.mob(def).frames.idle[0];
  const d = full.getContext('2d').getImageData(0, 0, full.width, full.height).data;
  let x0 = full.width, y0 = full.height, x1 = 0, y1 = 0;
  for (let y = 0; y < full.height; y++) for (let x = 0; x < full.width; x++) if (d[(y * full.width + x) * 4 + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const spr = Art.canvas(x1 - x0 + 1, y1 - y0 + 1); spr.getContext('2d').drawImage(full, -x0, -y0);
  return sizes.map(S => {
    const c = Art.canvas(S, S), ctx = c.getContext('2d');
    const r = S * 0.22;
    ctx.beginPath(); ctx.roundRect(S * 0.03, S * 0.03, S * 0.94, S * 0.94, r);
    const g = ctx.createRadialGradient(S * 0.4, S * 0.3, S * 0.05, S * 0.5, S * 0.5, S * 0.7);
    g.addColorStop(0, '#fff6fb'); g.addColorStop(0.6, '#ffc8e2'); g.addColorStop(1, '#b8a4ff');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1, S / 32); ctx.strokeStyle = '#5a3a6a'; ctx.stroke();
    ctx.imageSmoothingEnabled = false;
    const k = Math.max(1, Math.floor((S * 0.84) / spr.width));
    const w = spr.width * k, h = spr.height * k;
    ctx.drawImage(spr, Math.round((S - w) / 2), Math.round((S - h) / 2 + S * 0.02), w, h);
    return c.toDataURL('image/png').split(',')[1];
  });
}, sizes);
await browser.close();
const bufs = pngs.map(b => Buffer.from(b, 'base64'));
mkdirSync(path.join(root, 'build'), { recursive: true });
writeFileSync(path.join(root, 'build', 'icon.png'), bufs[0]);
const head = Buffer.alloc(6 + 16 * sizes.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
let off = head.length;
sizes.forEach((s, i) => {
  const e = 6 + i * 16;
  head.writeUInt8(s >= 256 ? 0 : s, e); head.writeUInt8(s >= 256 ? 0 : s, e + 1);
  head.writeUInt8(0, e + 2); head.writeUInt8(0, e + 3); head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
  head.writeUInt32LE(bufs[i].length, e + 8); head.writeUInt32LE(off, e + 12);
  off += bufs[i].length;
});
writeFileSync(path.join(root, 'build', 'icon.ico'), Buffer.concat([head, ...bufs]));
console.log('wrote build/icon.png and build/icon.ico');
