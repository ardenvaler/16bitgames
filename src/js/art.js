'use strict';
// Procedural 32-bit style sprite art. Shapes are drawn with smooth shading, then
// alpha-thresholded and given a selective (hue-aware) outline so they read as pixel art.
const Art = (() => {
  const TAU = Math.PI * 2;
  const INK = '#2a1a33';

  function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }

  function finalize(c, { outline = true, thresh = 100, dark = 0.62 } = {}) {
    const ctx = c.getContext('2d'), w = c.width, h = c.height;
    const id = ctx.getImageData(0, 0, w, h), d = id.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= thresh ? 255 : 0;
    if (outline) {
      const src = new Uint8ClampedArray(d);
      const ink = U.rgb(INK);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (src[i + 3]) continue;
        let j = -1;
        if (x > 0 && src[i - 1]) j = i - 4;
        else if (x < w - 1 && src[i + 7]) j = i + 4;
        else if (y > 0 && src[i - w * 4 + 3]) j = i - w * 4;
        else if (y < h - 1 && src[i + w * 4 + 3]) j = i + w * 4;
        if (j < 0) continue;
        d[i] = src[j] * (1 - dark) + ink[0] * dark; d[i + 1] = src[j + 1] * (1 - dark) + ink[1] * dark; d[i + 2] = src[j + 2] * (1 - dark) + ink[2] * dark; d[i + 3] = 255;
      }
    }
    ctx.putImageData(id, 0, 0);
    return c;
  }

  /* ---------------------------------------------------------------- primitives */
  function E(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); }
  function fe(ctx, x, y, rx, ry, col, rot = 0) { E(ctx, x, y, rx, ry, rot); ctx.fillStyle = col; ctx.fill(); }
  function rg(ctx, x, y, r, base, hi = 0.45, lo = 0.32, lx = -0.35, ly = -0.45) {
    const g = ctx.createRadialGradient(x + r * lx, y + r * ly, r * 0.05, x, y, r * 1.25);
    g.addColorStop(0, U.shade(base, hi)); g.addColorStop(0.5, base); g.addColorStop(1, U.shade(base, -lo));
    return g;
  }
  function lg(ctx, x0, y0, x1, y1, a, b) { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
  function blob(ctx, x, y, rx, ry, base, rot = 0, hi, lo) { E(ctx, x, y, rx, ry, rot); ctx.fillStyle = rg(ctx, x, y, Math.max(rx, ry), base, hi, lo); ctx.fill(); }
  function shine(ctx, x, y, rx, ry, rot = -0.5, a = 0.8) { fe(ctx, x, y, rx, ry, `rgba(255,255,255,${a})`, rot); }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
  function line(ctx, pts, col, w, cap = 'round') { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = cap; ctx.lineJoin = 'round'; ctx.stroke(); }
  function tri(ctx, a, b, c, col) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); }
  function star(ctx, x, y, r1, r2, n, col, rot = -Math.PI / 2) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = rot + i * Math.PI / n; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  }

  function face(ctx, x, y, f, o = {}) {
    const sp = o.sp ?? 4, r = o.r ?? 2.1, col = o.col || INK;
    const eyesX = [x - sp, x + sp];
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (f.hurt) {
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.9, r * 0.55);
      ctx.beginPath(); ctx.moveTo(eyesX[0] - r * 0.8, y - r * 0.8); ctx.lineTo(eyesX[0] + r * 0.6, y); ctx.lineTo(eyesX[0] - r * 0.8, y + r * 0.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(eyesX[1] + r * 0.8, y - r * 0.8); ctx.lineTo(eyesX[1] - r * 0.6, y); ctx.lineTo(eyesX[1] + r * 0.8, y + r * 0.8); ctx.stroke();
    } else if (o.closed) {
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.9, r * 0.5);
      for (const ex of eyesX) { ctx.beginPath(); ctx.arc(ex, y + r * 0.3, r * 0.8, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    } else {
      for (const ex of eyesX) {
        if (o.sclera) fe(ctx, ex, y, r * 1.2, r * 1.3, '#ffffff');
        if (o.glow) { fe(ctx, ex, y, r * 1.1, r * 1.1, U.shade(o.glow, 0.5)); fe(ctx, ex, y, r * 0.7, r * 0.8, o.glow); continue; }
        fe(ctx, ex, y, r * 0.8, r, col);
        if (o.iris) fe(ctx, ex, y + r * 0.25, r * 0.55, r * 0.6, o.iris);
        fe(ctx, ex - r * 0.28, y - r * 0.38, r * 0.34, r * 0.42, '#ffffff');
        fe(ctx, ex + r * 0.3, y + r * 0.42, r * 0.16, r * 0.16, '#ffffff');
      }
    }
    if (f.atk && !f.hurt) {
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.8, r * 0.4);
      ctx.beginPath(); ctx.moveTo(eyesX[0] - r, y - r * 1.6); ctx.lineTo(eyesX[0] + r * 0.6, y - r * 1.15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(eyesX[1] + r, y - r * 1.6); ctx.lineTo(eyesX[1] - r * 0.6, y - r * 1.15); ctx.stroke();
    }
    const my = y + r * 1.55 + (o.mdy || 0);
    if (o.mouth !== 'none') {
      if (f.atk || f.hurt) fe(ctx, x, my + r * 0.15, r * 0.5, r * 0.55, '#8a2a40');
      else if (o.mouth === 'w') {
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.7, r * 0.35);
        ctx.beginPath(); ctx.arc(x - r * 0.4, my - r * 0.2, r * 0.42, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.arc(x + r * 0.4, my - r * 0.2, r * 0.42, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
      } else {
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.7, r * 0.38);
        ctx.beginPath(); ctx.arc(x, my - r * 0.5, r * 0.6, 0.18 * Math.PI, 0.82 * Math.PI); ctx.stroke();
      }
    }
    if (o.blush !== false) {
      const bx = sp + r * 1.05;
      fe(ctx, x - bx, y + r * 1.2, r * 0.85, r * 0.48, 'rgba(255,105,150,0.55)');
      fe(ctx, x + bx, y + r * 1.2, r * 0.85, r * 0.48, 'rgba(255,105,150,0.55)');
    }
  }

  function crown(ctx, x, y, w) {
    const h = w * 0.62;
    ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2, y - h * 0.6); ctx.lineTo(x - w / 4, y - h * 0.28); ctx.lineTo(x, y - h);
    ctx.lineTo(x + w / 4, y - h * 0.28); ctx.lineTo(x + w / 2, y - h * 0.6); ctx.lineTo(x + w / 2, y); ctx.closePath();
    ctx.fillStyle = lg(ctx, 0, y - h, 0, y, '#fff6b0', '#e89a20'); ctx.fill();
    fe(ctx, x, y - h * 0.32, w * 0.09, w * 0.09, '#ff5a8a');
    fe(ctx, x - w * 0.3, y - h * 0.2, w * 0.07, w * 0.07, '#6fb8ff');
    fe(ctx, x + w * 0.3, y - h * 0.2, w * 0.07, w * 0.07, '#7ee08a');
  }
  function flame(ctx, x, y, w, h, c1, c2, wob = 0) {
    ctx.beginPath(); ctx.moveTo(x - w / 2, y);
    ctx.bezierCurveTo(x - w / 2, y - h * 0.5, x - w * 0.1 + wob, y - h * 0.6, x + wob, y - h);
    ctx.bezierCurveTo(x + w * 0.15 + wob, y - h * 0.6, x + w / 2, y - h * 0.5, x + w / 2, y);
    ctx.quadraticCurveTo(x, y + w * 0.35, x - w / 2, y); ctx.closePath();
    ctx.fillStyle = lg(ctx, 0, y - h, 0, y, c2, c1); ctx.fill();
  }

  /* ---------------------------------------------------------------- monster families */
  // Each draws facing right with the origin at the feet. f = frame params.
  const FAM = {};

  FAM.slime = { w: 28, h: 23, draw(ctx, p, f) {
    const k = p.k, rx = 13 * (1 + f.sq * 0.9), h = 20 * (1 - f.sq);
    const wavy = k === 'ghost';
    ctx.beginPath(); ctx.moveTo(-rx, 0);
    ctx.bezierCurveTo(-rx, -h * 0.8, -rx * 0.58, -h, 0, -h);
    ctx.bezierCurveTo(rx * 0.58, -h, rx, -h * 0.8, rx, 0);
    if (wavy) { const n = 4; for (let i = 0; i < n; i++) { const x0 = rx - i * 2 * rx / n, x1 = rx - (i + 1) * 2 * rx / n; ctx.quadraticCurveTo((x0 + x1) / 2, i % 2 ? -2 : 3, x1, 0); } }
    else ctx.quadraticCurveTo(0, 1.6, -rx, 0);
    ctx.closePath(); ctx.fillStyle = rg(ctx, 0, -h * 0.55, rx * 1.05, p.b, 0.5, 0.3); ctx.fill();
    fe(ctx, 1, -h * 0.25, rx * 0.62, h * 0.2, U.rgba(p.s, 0.55));
    if (k === 'drip') {
      ctx.beginPath(); ctx.moveTo(-rx * 0.85, -h * 0.55);
      ctx.bezierCurveTo(-rx * 0.6, -h * 1.02, rx * 0.6, -h * 1.02, rx * 0.85, -h * 0.55);
      for (let i = 0; i <= 4; i++) { const xx = rx * 0.85 - i * rx * 0.425; ctx.quadraticCurveTo(xx + rx * 0.2, -h * (i % 2 ? 0.3 : 0.48), xx, -h * 0.55); }
      ctx.closePath(); ctx.fillStyle = U.shade(p.b, -0.12); ctx.fill();
    }
    shine(ctx, -rx * 0.45, -h * 0.72, rx * 0.2, h * 0.13, -0.6, 0.85);
    fe(ctx, -rx * 0.18, -h * 0.86, 1, 1, 'rgba(255,255,255,0.9)');
    face(ctx, 1.5, -h * 0.42, f, { sp: 4.6, r: 2.2, col: k === 'ghost' ? '#5a3a8a' : INK });
    if (k === 'snowcap') {
      ctx.beginPath(); ctx.moveTo(-rx * 0.8, -h * 0.66);
      ctx.bezierCurveTo(-rx * 0.6, -h * 1.08, rx * 0.6, -h * 1.08, rx * 0.8, -h * 0.66);
      for (let i = 0; i < 5; i++) { const xx = rx * 0.8 - (i + 1) * rx * 0.32; ctx.quadraticCurveTo(xx + rx * 0.16, -h * 0.56, xx, -h * 0.66); }
      ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill();
    }
    if (k === 'flame') { flame(ctx, -3, -h + 1, 7, 9 + f.t * 2, '#ff5a2a', '#ffe35a', f.t ? 1 : -1); flame(ctx, 3, -h + 2, 5, 6, '#ff7a3a', '#fff0a0'); }
    if (k === 'bubble') { fe(ctx, rx * 0.6, -h * 1.05, 2, 2, 'rgba(220,250,255,0.95)'); fe(ctx, rx * 0.9, -h * 1.25, 1.3, 1.3, 'rgba(220,250,255,0.95)'); }
    if (k === 'crown') crown(ctx, 0, -h + 2.5, 11);
    if (k === 'ghost') { fe(ctx, -rx - 1, -h * 0.35, 2.2, 1.6, p.b, 0.6); fe(ctx, rx + 1, -h * 0.35, 2.2, 1.6, p.b, -0.6); }
  } };

  FAM.mushroom = { w: 26, h: 30, draw(ctx, p, f) {
    const sq = f.sq, st = f.step || 0;
    fe(ctx, -4.5 + st * 1.2, -1.6, 3.2, 2, U.shade(p.s, -0.25)); fe(ctx, 4.5 - st * 1.2, -1.6 - Math.abs(st) * 0.6, 3.2, 2, U.shade(p.s, -0.25));
    const sh = 13 * (1 - sq);
    rr(ctx, -7, -2 - sh, 14, sh + 1, 5); ctx.fillStyle = lg(ctx, -7, 0, 7, 0, U.shade(p.s, 0.2), U.shade(p.s, -0.15)); ctx.fill();
    face(ctx, 1, -2 - sh * 0.48, f, { sp: 3.4, r: 1.9, glow: p.k === 'spooky' ? p.a : null, mouth: p.k === 'spooky' ? 'w' : undefined });
    const cy = -1 - sh, rx = 13 * (1 + sq * 0.8), ry = 11.5 * (1 - sq * 0.5);
    ctx.beginPath(); ctx.moveTo(-rx, cy); ctx.bezierCurveTo(-rx, cy - ry * 1.25, rx, cy - ry * 1.25, rx, cy);
    ctx.quadraticCurveTo(0, cy + 3.2, -rx, cy); ctx.closePath();
    ctx.fillStyle = rg(ctx, -2, cy - ry * 0.6, rx, p.b, 0.4, 0.3); ctx.fill();
    const spots = [[-6, -0.55, 2.6], [1.5, -0.8, 3], [7.5, -0.4, 2.2], [-1, -0.25, 1.6]];
    for (const [sx, sy, r] of spots) fe(ctx, sx * (rx / 13), cy + sy * ry, r, r * 0.85, p.a);
    shine(ctx, -rx * 0.45, cy - ry * 0.62, 3, 1.6, -0.5, 0.7);
    if (p.k === 'crown') crown(ctx, 0, cy - ry * 0.85, 10);
    if (p.k === 'spooky') { fe(ctx, -rx * 0.7, cy + 1.2, 1.2, 2.2, U.shade(p.b, -0.2)); fe(ctx, rx * 0.5, cy + 1.6, 1, 2.6, U.shade(p.b, -0.2)); }
  } };

  FAM.bunny = { w: 24, h: 32, draw(ctx, p, f) {
    const sq = f.sq, k = p.k;
    ctx.save(); ctx.scale(1 + sq * 0.5, 1 - sq);
    fe(ctx, -10, -8, 3.4, 3.4, U.shade(p.b, 0.1));
    fe(ctx, -4.5, -1.8, 3.8, 2.2, U.shade(p.b, -0.06)); fe(ctx, 4.5, -1.8, 3.8, 2.2, U.shade(p.b, -0.06));
    blob(ctx, 0, -8.5, 9, 8, p.b, 0, 0.4, 0.2);
    const wob = f.t ? 0.12 : 0;
    for (const s of [-1, 1]) {
      const ex = s * 3.6 + 1, a = s * 0.16 + wob * s;
      blob(ctx, ex, -29, 2.8, 7.6, p.b, a, 0.4, 0.2);
      fe(ctx, ex, -28.5, 1.4, 5.4, p.s, a);
    }
    blob(ctx, 1, -18, 9.6, 8.6, p.b, 0, 0.45, 0.2);
    fe(ctx, 3.2, -15.4, 1, 0.75, '#ff7aa0');
    face(ctx, 2.6, -18, f, { sp: 3.9, r: 2, mouth: 'w', mdy: 0.4 });
    if (k === 'scarf') { rr(ctx, -7.5, -12, 16, 3.4, 1.6); ctx.fillStyle = '#ff6b8a'; ctx.fill(); rr(ctx, -8, -11, 3.4, 7, 1.4); ctx.fill(); }
    if (k === 'mummy') {
      ctx.strokeStyle = p.s; ctx.lineWidth = 1.1;
      for (const yy of [-22, -19.5, -12, -8, -4]) { ctx.beginPath(); ctx.moveTo(-9, yy + 1.2); ctx.lineTo(9.5, yy - 1); ctx.stroke(); }
      fe(ctx, -1.4, -18, 2.8, 2.4, '#efe6d0');
    }
    ctx.restore();
  } };

  FAM.bird = { w: 26, h: 26, draw(ctx, p, f) {
    const k = p.k, sq = f.sq, fl = f.flap || 0, flying = k !== 'chick';
    const by = flying ? -12 : -10;
    if (k === 'phoenix') { for (let i = 0; i < 3; i++) flame(ctx, -10 - i * 2.2, by + 2 + i * 2.5, 5, 9, '#ff5a2a', '#ffe35a', f.t ? 1 : -1); }
    if (k === 'gull') { fe(ctx, -9, by + 1, 4.5, 2, U.shade(p.b, -0.1), -0.3); }
    if (!flying) { line(ctx, [-3, -3, -3, 0, -1, 0], '#ffa030', 1.2); line(ctx, [3, -3, 3, 0, 5, 0], '#ffa030', 1.2); }
    ctx.save(); ctx.translate(0, by); ctx.scale(1 + sq * 0.5, 1 - sq * 0.6);
    if (flying) { const a = -0.9 + fl * 0.7; blob(ctx, -5, -2, k === 'gull' ? 9 : 7, 3.4, U.shade(p.b, -0.08), a, 0.3, 0.3); if (k === 'gull') fe(ctx, -5 + Math.cos(a) * -7, -2 + Math.sin(a) * -7, 2.6, 2, '#5a6a80', a); }
    blob(ctx, 0, 0, 10.5, 10, p.b, 0, 0.45, 0.25);
    fe(ctx, 1.5, 3, 6.5, 5.8, U.rgba(p.s, 0.95));
    if (!flying) blob(ctx, -5.5, 1, 4.2, 3, U.shade(p.b, -0.06), 0.4 - fl * 0.2, 0.3, 0.3);
    if (k === 'owl') { fe(ctx, 1, -3, 4.2, 4.2, U.shade(p.s, 0.3)); fe(ctx, 7, -3, 3.6, 3.6, U.shade(p.s, 0.3)); tri(ctx, [-6, -7], [-3.5, -13], [-1.5, -8], p.b); tri(ctx, [5, -8], [8.5, -13], [9.5, -7], p.b); }
    tri(ctx, [8.5, -3.2], [13, -1.6], [8.5, 0.2], '#ffa830');
    face(ctx, 4, -3, f, { sp: 3, r: 1.9, mouth: 'none' });
    if (k === 'chick') { ctx.strokeStyle = U.shade(p.b, -0.2); ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(0, -9.5); ctx.quadraticCurveTo(-1, -14, 2.5, -13); ctx.stroke(); }
    if (k === 'phoenix') flame(ctx, 0, -8.5, 5, 7, '#ff5a2a', '#ffe35a', f.t ? 1 : -1);
    ctx.restore();
  } };

  FAM.seal = { w: 36, h: 22, draw(ctx, p, f) {
    const sq = f.sq, st = f.step || 0, k = p.k;
    ctx.save(); ctx.scale(1 + sq * 0.4, 1 - sq * 0.7);
    blob(ctx, -16, -3, 3.2, 2, U.shade(p.b, -0.1), -0.5 + st * 0.2); blob(ctx, -16, -1, 3.2, 2, U.shade(p.b, -0.1), 0.5 - st * 0.2);
    blob(ctx, -3, -7.5, 14.5, 7.5, p.b, 0, 0.4, 0.22);
    blob(ctx, 7, -11, 8.8, 8.2, p.b, 0, 0.45, 0.2);
    fe(ctx, 1, -4, 10, 3.4, U.rgba(p.s, 0.9));
    if (k === 'spots') for (const [x, y, r] of [[-8, -11, 1.6], [-3, -12.5, 1.2], [-12, -8, 1.1], [2, -13, 0.9]]) fe(ctx, x, y, r, r, U.shade(p.b, -0.2));
    if (k === 'aurora') {
      ctx.save(); E(ctx, -3, -7.5, 14.5, 7.5); ctx.clip();
      const g = ctx.createLinearGradient(-16, 0, 10, 0); g.addColorStop(0, '#8fffd0'); g.addColorStop(0.5, '#ff9ae0'); g.addColorStop(1, '#8fb8ff');
      ctx.fillStyle = g; ctx.globalAlpha = 0.75; ctx.fillRect(-18, -15, 30, 4.5); ctx.globalAlpha = 1; ctx.restore();
    }
    blob(ctx, 3 + st * 0.8, -2, 4, 1.8, U.shade(p.b, -0.12), 0.5);
    face(ctx, 8, -12, f, { sp: 2.8, r: 2.3, mouth: 'w', mdy: 1.4 });
    fe(ctx, 8.4, -9.8, 1.3, 0.9, '#3a2a3a');
    ctx.strokeStyle = 'rgba(60,40,60,0.6)'; ctx.lineWidth = 0.6;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(8.4 + s * 2.5, -8.8); ctx.lineTo(8.4 + s * 6, -9.5); ctx.stroke(); }
    if (k === 'tusk') { tri(ctx, [6.5, -8.4], [7.4, -8.4], [7, -4.2], '#fffaf0'); tri(ctx, [9.6, -8.4], [10.5, -8.4], [10, -4.2], '#fffaf0'); }
    if (k === 'aurora') crown(ctx, 7, -18.5, 9);
    ctx.restore();
  } };

  FAM.snail = { w: 28, h: 24, draw(ctx, p, f) {
    const sq = f.sq, k = p.k, st = f.step || 0;
    blob(ctx, 3 + st * 0.5, -3.4, 12 * (1 + sq * 0.3), 3.6, p.b, 0, 0.3, 0.2);
    blob(ctx, 10.5, -8.5, 4.8, 6.2, p.b, 0.15, 0.4, 0.2);
    line(ctx, [9, -14, 8, -19], p.b, 1.1); line(ctx, [12, -14, 13.5, -18.5], p.b, 1.1);
    fe(ctx, 8, -19.5, 1.3, 1.3, U.shade(p.b, -0.1)); fe(ctx, 13.6, -19, 1.3, 1.3, U.shade(p.b, -0.1));
    face(ctx, 10.6, -9.5, f, { sp: 2, r: 1.5, mouth: 'smile', blush: true });
    const sy = -11 * (1 - sq * 0.4);
    blob(ctx, -3, sy, 9, 9 * (1 - sq * 0.3), p.s, 0, 0.45, 0.3);
    if (k === 'lava') { ctx.strokeStyle = p.a; ctx.lineWidth = 1.2; line(ctx, [-8, sy - 2, -4, sy + 1, -1, sy - 3, 3, sy + 2], p.a, 1.1); }
    ctx.strokeStyle = U.shade(p.s, -0.3); ctx.lineWidth = 1.2; ctx.beginPath();
    for (let a = 0; a < TAU * 1.75; a += 0.2) { const r = 0.8 + a * 0.68; ctx.lineTo(-3 + Math.cos(a) * r, sy + Math.sin(a) * r); }
    ctx.stroke();
    if (p.a && k !== 'lava') { ctx.strokeStyle = p.a; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(-3, sy, 9.2, Math.PI * 1.05, Math.PI * 1.85); ctx.stroke(); }
    shine(ctx, -6, sy - 5, 2.2, 1.3, -0.6, 0.7);
  } };

  FAM.sprout = { w: 22, h: 30, draw(ctx, p, f) {
    const sq = f.sq, k = p.k, st = f.step || 0, sway = f.t ? 0.18 : -0.1;
    fe(ctx, -3.5 + st, -1.4, 2.4, 1.6, U.shade(p.b, -0.25)); fe(ctx, 3.5 - st, -1.4, 2.4, 1.6, U.shade(p.b, -0.25));
    ctx.save(); ctx.scale(1 + sq * 0.5, 1 - sq);
    if (k === 'treant') {
      rr(ctx, -7, -17, 14, 16, 5); ctx.fillStyle = lg(ctx, -7, 0, 7, 0, U.shade(p.b, 0.15), U.shade(p.b, -0.2)); ctx.fill();
      line(ctx, [-3, -14, -2, -4], U.shade(p.b, -0.3), 0.8); line(ctx, [3.5, -15, 4, -6], U.shade(p.b, -0.3), 0.8);
      line(ctx, [-7, -11, -11, -14 - sway * 8], p.b, 1.8); line(ctx, [7, -11, 11, -14 + sway * 8], p.b, 1.8);
      for (const [x, y, r] of [[0, -23, 7.5], [-6, -20, 5], [6, -20, 5], [-3, -27, 4.5], [4, -27, 4.5]]) blob(ctx, x, y, r, r * 0.9, p.s, 0, 0.35, 0.25);
      face(ctx, 1, -10, f, { sp: 3, r: 1.8 });
    } else if (k === 'acorn') {
      blob(ctx, 0, -9.5, 7.8, 8.6, p.b, 0, 0.45, 0.25);
      ctx.beginPath(); ctx.moveTo(-8.6, -13); ctx.bezierCurveTo(-8, -21.5, 8, -21.5, 8.6, -13); ctx.quadraticCurveTo(0, -10.5, -8.6, -13); ctx.closePath();
      ctx.fillStyle = rg(ctx, -1, -17, 8, p.s, 0.3, 0.3); ctx.fill();
      for (let x = -6; x <= 6; x += 3) for (let y = -18; y <= -13; y += 2.5) fe(ctx, x + (y % 5 ? 1.5 : 0), y, 0.55, 0.55, U.shade(p.s, -0.25));
      line(ctx, [0, -20, 1.5, -23.5], '#6a4a2a', 1.4);
      face(ctx, 1, -8, f, { sp: 3.2, r: 1.9 });
    } else {
      blob(ctx, 0, -9.5, 8.2, 8.8, p.b, 0, 0.45, 0.22);
      if (k === 'ember') { flame(ctx, -3, -17, 5, 9, '#ff5a2a', '#ffe35a', sway * 4); flame(ctx, 3, -17, 5, 11, '#ff6a2a', '#fff0a0', -sway * 4); }
      else { for (const s of [-1, 1]) { blob(ctx, s * 3.6, -21, 2.6, 5.4, p.s, s * 0.6 + sway, 0.35, 0.25); } blob(ctx, 0, -22.5, 2.2, 5, U.shade(p.s, 0.1), sway * 0.6, 0.35, 0.25); }
      face(ctx, 1, -9, f, { sp: 3.3, r: 2 });
    }
    ctx.restore();
  } };

  FAM.bug = { w: 26, h: 24, draw(ctx, p, f) {
    const k = p.k, fl = f.flap || 0, sq = f.sq;
    const by = -12;
    ctx.save(); ctx.translate(0, by); ctx.scale(1 + sq * 0.3, 1 - sq * 0.3);
    const wingC = 'rgba(210,240,255,0.92)';
    const wa = -0.5 - fl * 0.5;
    if (k !== 'lady') { blob(ctx, -3, -7, k === 'queen' ? 6.5 : 5, 3, wingC, wa, 0.3, 0.1); blob(ctx, 1, -8, k === 'queen' ? 6 : 4.6, 2.8, wingC, wa - 0.3, 0.3, 0.1); }
    if (k === 'lady') {
      blob(ctx, -3, -6, 4, 2.2, wingC, -0.8 - fl * 0.5, 0.3, 0.1);
      blob(ctx, -1.5, 0, 10, 8.2, p.b, 0, 0.45, 0.3);
      line(ctx, [-1.5, -8, -1.5, 8], U.shade(p.b, -0.5), 0.8);
      for (const [x, y, r] of [[-6, -2, 1.8], [-3, 3.5, 1.6], [2.5, -3.5, 1.7], [-4.5, -5.8, 1.1]]) fe(ctx, x, y, r, r, '#3a2030');
      blob(ctx, 8.5, 1.2, 5.4, 5, '#4a3a50', 0, 0.3, 0.3);
      face(ctx, 9.4, 1, f, { sp: 2.1, r: 1.5, sclera: true, mouth: 'none', blush: false });
      line(ctx, [8, -3.5, 7, -7.5], '#3a2a40', 0.8); line(ctx, [10.5, -3.5, 12, -7.2], '#3a2a40', 0.8);
    } else {
      tri(ctx, [-10, 0], [-14, 1.2], [-10, 3], '#3a2a20');
      blob(ctx, 0, 0, 10, 8.5, p.b, 0, 0.45, 0.25);
      ctx.save(); E(ctx, 0, 0, 10, 8.5); ctx.clip(); ctx.fillStyle = U.rgba(p.s, 0.85);
      ctx.fillRect(-7, -9, 2.6, 18); ctx.fillRect(-2.2, -9, 2.6, 18); ctx.restore();
      line(ctx, [4, -7, 3, -11], '#3a2a20', 0.8); line(ctx, [7, -6.5, 9, -10], '#3a2a20', 0.8);
      fe(ctx, 3, -11.3, 1, 1, '#3a2a20'); fe(ctx, 9.2, -10.3, 1, 1, '#3a2a20');
      face(ctx, 5, -0.5, f, { sp: 2.6, r: 1.8 });
      if (k === 'queen') crown(ctx, 2, -7.5, 8);
    }
    ctx.restore();
  } };

  FAM.beast = { w: 28, h: 28, draw(ctx, p, f) {
    const k = p.k, st = f.step || 0, sq = f.sq;
    ctx.save(); ctx.scale(1 + sq * 0.4, 1 - sq * 0.6);
    if (k === 'fox') { blob(ctx, -12, -13, 4.8, 8.5, p.b, -0.6 + (f.t ? 0.12 : 0), 0.4, 0.2); fe(ctx, -15.4, -19.5, 2.6, 2.8, '#fff6ea', -0.6); }
    if (k === 'cat') { ctx.strokeStyle = p.b; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-9, -8); ctx.quadraticCurveTo(-15, -10, -13, -18 + (f.t ? 1 : 0)); ctx.stroke(); }
    if (k === 'bear' || k === 'yeti') fe(ctx, -10.5, -9, 2.6, 2.6, U.shade(p.b, -0.05));
    fe(ctx, -7 + st * 1.4, -1.8, 2.8, 2.4, U.shade(p.b, -0.18)); fe(ctx, 4 - st * 1.4, -1.8, 2.8, 2.4, U.shade(p.b, -0.18));
    if (k === 'yeti') { for (const [x, y] of [[-8, -9], [-3, -12], [3, -11], [-6, -4], [2, -4]]) blob(ctx, x, y, 5, 5, p.b, 0, 0.35, 0.15); }
    else blob(ctx, -2, -8, 10, 7.5, p.b, 0, 0.4, 0.22);
    fe(ctx, 1, -6, 5, 4, U.rgba(p.s, 0.75));
    const hx = 6, hy = -16.5;
    if (k === 'fox' || k === 'cat') {
      for (const ex of [1, 10.5]) { tri(ctx, [ex - 3.4, hy - 4], [ex, hy - 12.5], [ex + 3.4, hy - 4], p.b); tri(ctx, [ex - 1.8, hy - 5], [ex, hy - 10], [ex + 1.8, hy - 5], U.shade(p.s, -0.05)); }
    } else if (k === 'bear') { for (const ex of [0.5, 11.5]) { fe(ctx, ex, hy - 6.5, 3.2, 3.2, p.b); fe(ctx, ex, hy - 6.5, 1.7, 1.7, p.s); } }
    else if (k === 'yeti') { tri(ctx, [0, hy - 5], [-2.5, hy - 11], [3, hy - 7], '#c8d8f0'); tri(ctx, [12, hy - 5], [14.5, hy - 11], [9, hy - 7], '#c8d8f0'); }
    blob(ctx, hx, hy, 8.6, 8, p.b, 0, 0.45, 0.2);
    if (k === 'yeti') fe(ctx, hx + 1.2, hy + 1, 6, 5.2, p.s);
    fe(ctx, hx + 2.5, hy + 3.2, 4, 2.9, k === 'yeti' ? U.shade(p.s, 0.2) : U.shade(p.s, 0.05));
    fe(ctx, hx + 2.6, hy + 1.9, 1.3, 0.95, '#3a2030');
    face(ctx, hx + 1.4, hy - 1, f, { sp: 3.4, r: 1.9, mouth: 'w', mdy: 0.9, glow: k === 'cat' ? '#ffe35a' : null });
    ctx.restore();
  } };

  FAM.crab = { w: 32, h: 24, draw(ctx, p, f) {
    const st = f.step || 0, open = f.t ? 0.5 : 0.15, k = p.k;
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) line(ctx, [s * (4 + i * 2.5), -4, s * (8 + i * 2.8), -0.5 + ((i + (st > 0 ? 1 : 0)) % 2) * -1.2], U.shade(p.b, -0.2), 1.1);
    blob(ctx, 0, -8, 12, 7, p.b, 0, 0.45, 0.25);
    fe(ctx, 0, -5.5, 7.5, 2.6, U.rgba(p.s, 0.55));
    for (const s of [-1, 1]) {
      const cx = s * 13, cy = -14;
      line(ctx, [s * 9, -9, cx, cy + 3], U.shade(p.b, -0.1), 2);
      blob(ctx, cx, cy, 4.6, 4, p.b, 0, 0.45, 0.25);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-s * open);
      tri(ctx, [s * -1, -2.5], [s * 2, -7], [s * 3.5, -2], U.shade(p.b, 0.1)); ctx.restore();
    }
    line(ctx, [-3, -13, -3, -16.5], U.shade(p.b, -0.15), 1.2); line(ctx, [3, -13, 3, -16.5], U.shade(p.b, -0.15), 1.2);
    face(ctx, 0, -17.2, f, { sp: 3, r: 1.8, sclera: true, mouth: 'none', blush: false });
    face(ctx, 0, -10.2, { hurt: false }, { sp: 5.2, r: 1.2, mouth: 'smile', closed: false, blush: true, col: 'rgba(0,0,0,0)' });
    if (k === 'pirate') {
      ctx.beginPath(); ctx.moveTo(-8, -19.5); ctx.quadraticCurveTo(0, -28, 8, -19.5); ctx.quadraticCurveTo(0, -22, -8, -19.5); ctx.closePath(); ctx.fillStyle = '#2a2a3a'; ctx.fill();
      fe(ctx, 0, -23, 1.6, 1.4, '#ffffff'); fe(ctx, 3, -17.2, 2.2, 2.2, '#2a2a3a'); line(ctx, [1, -19, 6, -16], '#2a2a3a', 0.6);
    }
  } };

  FAM.fish = { w: 26, h: 26, draw(ctx, p, f) {
    const sq = f.sq, r = 10 * (1 + sq * 0.6);
    ctx.save(); ctx.translate(0, -13);
    tri(ctx, [-r + 1, 0], [-r - 6, -5 + (f.t ? 1 : 0)], [-r - 6, 5 - (f.t ? 1 : 0)], U.shade(p.b, -0.1));
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; tri(ctx, [Math.cos(a - 0.18) * r * 0.92, Math.sin(a - 0.18) * r * 0.92], [Math.cos(a) * (r + 3), Math.sin(a) * (r + 3)], [Math.cos(a + 0.18) * r * 0.92, Math.sin(a + 0.18) * r * 0.92], U.shade(p.b, -0.25)); }
    blob(ctx, 0, 0, r, r, p.b, 0, 0.45, 0.25);
    fe(ctx, 1, 4, r * 0.7, r * 0.45, U.rgba(p.s, 0.85));
    blob(ctx, -2, 2, 3, 2, U.shade(p.b, -0.1), 0.5 + (f.flap || 0) * 0.4);
    face(ctx, 4, -2, f, { sp: 3, r: 2, mouth: 'smile' });
    ctx.restore();
  } };

  FAM.star = { w: 26, h: 26, draw(ctx, p, f) {
    ctx.save(); ctx.translate(0, -12); ctx.rotate((f.t ? 0.12 : -0.05) + (f.step || 0) * 0.05); ctx.scale(1 + f.sq * 0.4, 1 - f.sq * 0.5);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 5.5 : 12, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.lineJoin = 'round'; ctx.lineWidth = 3.5; ctx.strokeStyle = p.b; ctx.stroke(); ctx.fillStyle = rg(ctx, 0, 0, 12, p.b, 0.4, 0.25); ctx.fill();
    fe(ctx, 0, 1, 5, 4.5, U.rgba(p.s, 0.7));
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; fe(ctx, Math.cos(a) * 8, Math.sin(a) * 8, 0.8, 0.8, U.shade(p.b, 0.4)); }
    face(ctx, 0.5, 0, f, { sp: 2.8, r: 1.8 });
    ctx.restore();
  } };

  FAM.octo = { w: 28, h: 30, draw(ctx, p, f) {
    const sq = f.sq, k = p.k;
    for (let i = 0; i < 5; i++) {
      const x = -9 + i * 4.5, wob = ((i + (f.t ? 1 : 0)) % 2 ? 1.4 : -1.4);
      ctx.beginPath(); ctx.moveTo(x - 2.4, -10); ctx.quadraticCurveTo(x - 2 + wob, -3, x + wob * 1.2, -0.5); ctx.quadraticCurveTo(x + 2.6 + wob * 0.5, -3, x + 2.4, -10); ctx.closePath();
      ctx.fillStyle = U.shade(p.b, -0.08); ctx.fill();
      fe(ctx, x + wob * 0.6, -4, 0.8, 0.8, p.s);
    }
    blob(ctx, 0, -16 * (1 - sq * 0.3), 11.5 * (1 + sq * 0.4), 11 * (1 - sq * 0.3), p.b, 0, 0.45, 0.25);
    shine(ctx, -5, -22, 2.6, 1.6, -0.6, 0.7);
    face(ctx, 1, -14, f, { sp: 4, r: 2.3, mouth: f.atk ? undefined : 'smile' });
    if (k === 'hat') {
      rr(ctx, -9, -28.5, 18, 4.5, 2); ctx.fillStyle = '#ffffff'; ctx.fill();
      rr(ctx, -6.5, -32, 13, 4.5, 2); ctx.fill(); fe(ctx, 0, -27, 9.5, 1.4, '#3a6ab8');
      crown(ctx, 0, -31.5, 7);
    }
  } };

  FAM.penguin = { w: 22, h: 28, draw(ctx, p, f) {
    const st = f.step || 0, sq = f.sq;
    fe(ctx, -3.5 + st, -1, 3, 1.6, '#ffa030'); fe(ctx, 3.5 - st, -1, 3, 1.6, '#ffa030');
    ctx.save(); ctx.scale(1 + sq * 0.4, 1 - sq * 0.6);
    blob(ctx, -8.5, -11, 2.4, 5.5, U.shade(p.b, -0.05), 0.5 - (f.flap || 0) * 0.4);
    blob(ctx, 0, -12.5, 9, 12, p.b, 0, 0.35, 0.3);
    fe(ctx, 1.2, -9.5, 6, 8.5, p.s);
    fe(ctx, 1.5, -18.2, 5.8, 4.8, p.s);
    tri(ctx, [4.5, -16.5], [8.5, -15.2], [4.5, -14], '#ffa030');
    face(ctx, 1.3, -18.4, f, { sp: 2.8, r: 1.7, mouth: 'none' });
    rr(ctx, -7, -14.2, 14, 3, 1.4); ctx.fillStyle = p.a; ctx.fill(); rr(ctx, -6.5, -13, 3, 6.5, 1.2); ctx.fill();
    blob(ctx, 8, -11, 2.4, 5, U.shade(p.b, -0.05), -0.5 + (f.flap || 0) * 0.4);
    ctx.restore();
  } };

  FAM.wisp = { w: 24, h: 28, draw(ctx, p, f) {
    const k = p.k, wob = f.t ? 1.2 : -1.2;
    ctx.save(); ctx.translate(0, -2);
    if (k === 'flame') {
      flame(ctx, 0, -2, 18, 26, p.b, U.shade(p.b, 0.6), wob);
      flame(ctx, 0, -3, 10, 15, U.shade(p.b, 0.4), '#ffffff', -wob * 0.6);
      face(ctx, 0.5, -8, f, { sp: 3.2, r: 2, col: '#2a3a6a' });
    } else if (k === 'sprite') {
      blob(ctx, -6, -14, 5, 2.4, 'rgba(230,250,255,0.95)', -0.6 - (f.flap || 0) * 0.4, 0.2, 0.1);
      blob(ctx, 6, -14, 5, 2.4, 'rgba(230,250,255,0.95)', 0.6 + (f.flap || 0) * 0.4, 0.2, 0.1);
      blob(ctx, 0, -10, 7.5, 7.5, p.b, 0, 0.5, 0.2);
      for (let i = -2; i <= 2; i++) tri(ctx, [i * 2.6 - 1.4, -16], [i * 2.6, -21 + Math.abs(i) * 1.6], [i * 2.6 + 1.4, -16], '#e8fbff');
      face(ctx, 0.5, -10, f, { sp: 2.8, r: 1.8, col: '#2a4a7a' });
    } else {
      ctx.beginPath(); ctx.moveTo(-9, -2);
      ctx.bezierCurveTo(-10, -22, 10, -22, 9, -2);
      for (let i = 0; i < 4; i++) { const x0 = 9 - i * 4.5, x1 = 9 - (i + 1) * 4.5; ctx.quadraticCurveTo((x0 + x1) / 2, i % 2 ? -5 : 1.5, x1, -2); }
      ctx.closePath(); ctx.fillStyle = rg(ctx, -1, -12, 11, p.b, 0.4, 0.25); ctx.fill();
      face(ctx, 0.5, -12, f, { sp: 3.2, r: 2, col: '#4a3a6a' });
      line(ctx, [7, -9, 11, -10], p.b, 2.4);
      line(ctx, [11, -12, 11, -6], '#6a5a4a', 0.8);
      rr(ctx, 9, -6, 4.4, 5.4, 1.2); ctx.fillStyle = '#5a4a3a'; ctx.fill(); fe(ctx, 11.2, -3.4, 1.5, 1.9, p.s);
    }
    ctx.restore();
  } };

  FAM.bat = { w: 34, h: 22, draw(ctx, p, f) {
    const fl = f.flap || 0, k = p.k;
    ctx.save(); ctx.translate(0, -11);
    if (k === 'count') { tri(ctx, [-7, -3], [-10, -10], [-2, -5], '#2a1a3a'); tri(ctx, [7, -3], [10, -10], [2, -5], '#2a1a3a'); }
    for (const s of [-1, 1]) {
      ctx.save(); ctx.scale(s, 1); ctx.rotate(-fl * 0.45);
      ctx.beginPath(); ctx.moveTo(4, -2); ctx.quadraticCurveTo(10, -10, 16, -6);
      ctx.quadraticCurveTo(14, -2, 15, 1); ctx.quadraticCurveTo(12, -1, 10, 2); ctx.quadraticCurveTo(8, 0, 5, 3); ctx.closePath();
      ctx.fillStyle = lg(ctx, 4, -8, 16, 2, U.shade(p.b, 0.15), U.shade(p.b, -0.2)); ctx.fill();
      ctx.restore();
    }
    tri(ctx, [-5.5, -4], [-4.5, -11], [-1.5, -6], p.b); tri(ctx, [5.5, -4], [4.5, -11], [1.5, -6], p.b);
    blob(ctx, 0, 0, 7.2, 6.8, p.b, 0, 0.45, 0.25);
    fe(ctx, 0.5, 2.5, 4, 3, U.rgba(p.s, 0.6));
    face(ctx, 0.8, -0.8, f, { sp: 2.8, r: 1.8, mouth: f.atk ? undefined : 'smile' });
    tri(ctx, [-0.6, 2.2], [0.2, 2.2], [-0.2, 3.8], '#ffffff'); tri(ctx, [1.4, 2.2], [2.2, 2.2], [1.8, 3.8], '#ffffff');
    if (k === 'count') { tri(ctx, [0, 5.6], [-4, 3.6], [-4, 7.6], p.s); tri(ctx, [0, 5.6], [4, 3.6], [4, 7.6], p.s); fe(ctx, 0, 5.6, 1, 1, '#ffe35a'); rr(ctx, -4, -13, 8, 6, 1); ctx.fillStyle = '#2a1a3a'; ctx.fill(); rr(ctx, -6, -7.6, 12, 1.8, 0.8); ctx.fill(); fe(ctx, 0, -8.4, 4, 0.7, '#ff5a7a'); }
    ctx.restore();
  } };

  FAM.golem = { w: 28, h: 32, draw(ctx, p, f) {
    const st = f.step || 0, k = p.k, sq = f.sq;
    const stone = p.b, eye = p.s;
    rr(ctx, -8 + st, -7, 6, 7, 2); ctx.fillStyle = U.shade(stone, -0.15); ctx.fill();
    rr(ctx, 2 - st, -7, 6, 7, 2); ctx.fill();
    ctx.save(); ctx.scale(1 + sq * 0.3, 1 - sq * 0.4);
    rr(ctx, -10, -24, 20, 18, 5); ctx.fillStyle = lg(ctx, -10, -24, 10, -6, U.shade(stone, 0.25), U.shade(stone, -0.2)); ctx.fill();
    rr(ctx, -6.5, -31, 13, 9, 4); ctx.fillStyle = lg(ctx, -6, -31, 6, -22, U.shade(stone, 0.3), U.shade(stone, -0.1)); ctx.fill();
    face(ctx, 0.5, -26.5, f, { sp: 2.8, r: 1.6, glow: eye, mouth: 'none', blush: false });
    if (k === 'moss') { for (const [x, y, r] of [[-6, -23, 3], [-3, -24.5, 2.4], [5, -31, 2.6], [7, -16, 2]]) fe(ctx, x, y, r, r * 0.7, '#7ec85a'); }
    if (k === 'ember') { line(ctx, [-6, -20, -3, -16, -5, -12], eye, 1.1); line(ctx, [4, -21, 6, -15, 3, -10], eye, 1.1); }
    if (k === 'moon') { fe(ctx, 0, -15, 4, 4, eye); fe(ctx, 1.6, -16, 3.4, 3.4, U.shade(stone, 0.05)); }
    const sw = st * 2;
    rr(ctx, -15, -22 + sw, 6, 13, 3); ctx.fillStyle = lg(ctx, -15, 0, -9, 0, U.shade(stone, 0.15), U.shade(stone, -0.25)); ctx.fill();
    rr(ctx, 9, -22 - sw, 6, 13, 3); ctx.fill();
    ctx.restore();
  } };

  FAM.drake = { w: 32, h: 28, draw(ctx, p, f) {
    const k = p.k, st = f.step || 0, fl = f.flap || 0, sq = f.sq;
    ctx.save(); ctx.scale(1 + sq * 0.35, 1 - sq * 0.5);
    if (k === 'lizard') {
      ctx.strokeStyle = p.b; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-8, -5); ctx.quadraticCurveTo(-16, -4, -18, -9 + (f.t ? 1 : 0)); ctx.stroke();
      flame(ctx, -18.5, -9.5 + (f.t ? 1 : 0), 4, 7, '#ff5a2a', '#ffe35a');
      for (const lx of [-6 + st, -1 - st, 4 + st, 8 - st]) fe(ctx, lx, -1.5, 1.8, 1.6, U.shade(p.b, -0.2));
      blob(ctx, -1, -6, 11, 5, p.b, 0, 0.4, 0.25);
      for (const [x, y] of [[-6, -8], [-1, -9], [4, -8]]) fe(ctx, x, y, 1.3, 1, p.s);
      blob(ctx, 10, -9, 6.5, 5.5, p.b, 0, 0.45, 0.2);
      face(ctx, 11, -10.5, f, { sp: 2.4, r: 1.6 });
    } else {
      const big = k === 'dragon';
      ctx.strokeStyle = p.b; ctx.lineWidth = 3.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-6, -6); ctx.quadraticCurveTo(-14, -3, -15, -10 + (f.t ? 1 : 0)); ctx.stroke();
      tri(ctx, [-17.5, -11], [-15, -15], [-12.5, -10.5], U.shade(p.b, -0.1));
      for (const s of [-1]) { ctx.save(); ctx.translate(-2, -14); ctx.rotate(-0.4 - fl * 0.5);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-4, -12 - (big ? 4 : 0), -12 - (big ? 4 : 0), -10); ctx.quadraticCurveTo(-9, -6, -10, -2); ctx.quadraticCurveTo(-6, -3, -5, 1); ctx.closePath();
        ctx.fillStyle = lg(ctx, 0, -12, -10, 0, U.shade(p.s, 0.1), U.shade(p.b, -0.1)); ctx.fill(); ctx.restore(); }
      fe(ctx, -5 + st, -1.6, 2.4, 2, U.shade(p.b, -0.2)); fe(ctx, 3 - st, -1.6, 2.4, 2, U.shade(p.b, -0.2));
      blob(ctx, -1, -9.5, 9, 8.5, p.b, 0, 0.45, 0.25);
      fe(ctx, 1, -7, 5, 5, U.rgba(p.s, 0.85));
      for (let i = 0; i < 3; i++) fe(ctx, 1, -10 + i * 2.4, 3.6 - i * 0.4, 0.4, U.shade(p.s, -0.2));
      blob(ctx, 7, -18, 7.5, 6.8, p.b, 0, 0.45, 0.2);
      fe(ctx, 11.5, -16, 3.6, 2.6, U.shade(p.b, 0.15));
      tri(ctx, [3, -23], [1, -28 - (big ? 2 : 0)], [5.5, -24], '#fff0d0'); tri(ctx, [8, -24], [9, -29 - (big ? 2 : 0)], [10.5, -23.5], '#fff0d0');
      face(ctx, 7.5, -19, f, { sp: 2.6, r: 1.8, mouth: 'smile' });
      fe(ctx, 13.2, -16.6, 0.6, 0.6, '#3a2030');
      if (big) crown(ctx, 6.5, -24.5, 6);
      if (f.atk) flame(ctx, 16, -15, 4, 6, '#ff5a2a', '#ffe35a', 3);
    }
    ctx.restore();
  } };

  FAM.tree = { w: 32, h: 40, draw(ctx, p, f) {
    const st = f.step || 0, sway = f.t ? 1 : -1;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 6 + st * s, -1.5, 4.5, 2.2, 0, 0, TAU); ctx.fillStyle = U.shade(p.b, -0.2); ctx.fill(); }
    rr(ctx, -9, -26, 18, 25, 7); ctx.fillStyle = lg(ctx, -9, 0, 9, 0, U.shade(p.b, 0.18), U.shade(p.b, -0.25)); ctx.fill();
    for (const [x0, y0, x1, y1] of [[-5, -22, -4, -12], [4, -20, 5, -6], [-1, -9, 0, -3]]) line(ctx, [x0, y0, x1, y1], U.shade(p.b, -0.35), 0.8);
    line(ctx, [-9, -16, -15, -21 + sway * 2], p.b, 2.6); line(ctx, [9, -16, 15, -21 - sway * 2], p.b, 2.6);
    fe(ctx, -15, -21.5 + sway * 2, 3, 2.4, p.s); fe(ctx, 15, -21.5 - sway * 2, 3, 2.4, p.s);
    for (const [x, y, r] of [[0, -33, 11], [-9, -28, 7], [9, -28, 7], [-5, -39, 6.5], [6, -38, 6.5]]) blob(ctx, x, y, r, r * 0.88, p.s, 0, 0.35, 0.28);
    for (const [x, y] of [[-6, -34], [4, -40], [8, -30], [-10, -27], [1, -29]]) star(ctx, x, y, 1.8, 0.8, 5, p.a);
    face(ctx, 0.5, -16, f, { sp: 3.6, r: 2.2, closed: !f.hurt && !f.atk && f.t === 0, mouth: 'smile' });
  } };

  const FRAMES = {
    idle: [{ t: 0, sq: 0, step: 0, flap: 0 }, { t: 1, sq: 0.06, step: 0, flap: 1 }],
    move: [{ t: 0, sq: -0.05, step: 1, flap: -1 }, { t: 1, sq: 0.05, step: -1, flap: 1 }],
    hurt: [{ t: 0, sq: 0.1, hurt: true, flap: 0, step: 0 }],
    atk: [{ t: 1, sq: -0.08, atk: true, flap: 1, step: 0 }],
  };
  const mobCache = new Map();
  function mob(def) {
    let m = mobCache.get(def.id);
    if (m) return m;
    const fam = FAM[def.fam], s = def.size;
    const pad = 5;
    const W = Math.ceil(fam.w * s * 1.2) + pad * 2, H = Math.ceil(fam.h * s * 1.15) + pad * 2 + 4;
    const frames = {};
    for (const [name, list] of Object.entries(FRAMES)) {
      frames[name] = list.map(fp => {
        const c = canvas(W, H), ctx = c.getContext('2d');
        ctx.translate(W / 2, H - pad); ctx.scale(s, s);
        fam.draw(ctx, def.p, fp, def);
        return finalize(c);
      });
    }
    frames.flash = frames.hurt.map(src => {
      const c = canvas(W, H), ctx = c.getContext('2d');
      ctx.drawImage(src, 0, 0); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(0, 0, W, H);
      return c;
    });
    m = { frames, w: W, h: H, ox: W / 2, oy: H - pad, bw: fam.w * s * 0.82, bh: fam.h * s * 0.9 };
    mobCache.set(def.id, m);
    return m;
  }

  /* ---------------------------------------------------------------- weapons */
  function drawWeapon(ctx, wt, col) {
    const m = col.m, g = col.g, wood = '#8a5a34';
    switch (wt) {
      case 'sword':
        rr(ctx, -1, -1.5, 2, 6, 0.8); ctx.fillStyle = '#6a3a24'; ctx.fill();
        fe(ctx, 0, 5, 1.5, 1.5, m);
        ctx.beginPath(); ctx.moveTo(-1.9, -2.6); ctx.lineTo(-1.9, -15.5); ctx.lineTo(0, -19); ctx.lineTo(1.9, -15.5); ctx.lineTo(1.9, -2.6); ctx.closePath();
        ctx.fillStyle = lg(ctx, -2, 0, 2, 0, U.shade(m, 0.6), U.shade(m, -0.1)); ctx.fill();
        line(ctx, [0, -3.5, 0, -16], U.shade(m, -0.25), 0.6);
        rr(ctx, -4.6, -3.4, 9.2, 2.2, 1); ctx.fillStyle = U.shade(m, -0.2); ctx.fill(); fe(ctx, 0, -2.3, 1.1, 1.1, g);
        break;
      case 'axe':
        rr(ctx, -1, -15, 2, 20, 0.8); ctx.fillStyle = wood; ctx.fill();
        ctx.beginPath(); ctx.moveTo(0.5, -16); ctx.quadraticCurveTo(7, -20, 9.5, -16.5); ctx.quadraticCurveTo(10.5, -12, 9, -8); ctx.quadraticCurveTo(6, -10.5, 0.5, -10); ctx.closePath();
        ctx.fillStyle = lg(ctx, 0, -18, 10, -8, U.shade(m, 0.5), U.shade(m, -0.15)); ctx.fill();
        tri(ctx, [-0.5, -15], [-4.5, -13], [-0.5, -11], U.shade(m, -0.1)); fe(ctx, 2.6, -13, 1, 1, g);
        break;
      case 'wand':
        rr(ctx, -0.9, -9, 1.8, 13, 0.8); ctx.fillStyle = lg(ctx, -1, 0, 1, 0, U.shade(wood, 0.2), wood); ctx.fill();
        fe(ctx, 0, -9.5, 2, 1, m);
        blob(ctx, 0, -12, 2.8, 2.8, g, 0, 0.6, 0.2); star(ctx, -1, -13, 1.4, 0.5, 4, '#ffffff');
        break;
      case 'staff':
        rr(ctx, -1, -19, 2, 25, 0.8); ctx.fillStyle = lg(ctx, -1, 0, 1, 0, U.shade(wood, 0.25), U.shade(wood, -0.1)); ctx.fill();
        ctx.strokeStyle = m; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, -22, 4.2, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
        blob(ctx, 0, -22, 3, 3, g, 0, 0.6, 0.2); star(ctx, -1, -23.2, 1.5, 0.5, 4, '#ffffff');
        break;
      case 'mace':
        rr(ctx, -1, -8, 2, 12.5, 0.8); ctx.fillStyle = wood; ctx.fill();
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; tri(ctx, [Math.cos(a - 0.35) * 3.6, -11.5 + Math.sin(a - 0.35) * 3.6], [Math.cos(a) * 6, -11.5 + Math.sin(a) * 6], [Math.cos(a + 0.35) * 3.6, -11.5 + Math.sin(a + 0.35) * 3.6], U.shade(m, -0.15)); }
        blob(ctx, 0, -11.5, 4.2, 4.2, m, 0, 0.55, 0.25); fe(ctx, 0, -11.5, 1.3, 1.3, g);
        break;
      case 'scepter':
        rr(ctx, -0.9, -13, 1.8, 17, 0.8); ctx.fillStyle = lg(ctx, -1, 0, 1, 0, U.shade(m, 0.4), U.shade(m, -0.2)); ctx.fill();
        blob(ctx, -3.2, -15, 3.2, 1.6, '#ffffff', 0.5, 0.2, 0.2); blob(ctx, 3.2, -15, 3.2, 1.6, '#ffffff', -0.5, 0.2, 0.2);
        blob(ctx, 0, -15.5, 2.6, 2.9, g, 0, 0.6, 0.2); fe(ctx, 0, -11.5, 2, 0.9, m);
        break;
      case 'bow':
        ctx.strokeStyle = U.shade(m, -0.1); ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-1, -12); ctx.quadraticCurveTo(7, -6, 2.5, 0); ctx.quadraticCurveTo(7, 6, -1, 12); ctx.stroke();
        ctx.strokeStyle = U.shade(m, 0.4); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-0.6, -11.5); ctx.quadraticCurveTo(6, -6, 2.6, -1); ctx.stroke();
        fe(ctx, -1, -12, 1.2, 1.2, g); fe(ctx, -1, 12, 1.2, 1.2, g);
        rr(ctx, 1.4, -1.8, 2.6, 3.6, 1); ctx.fillStyle = '#6a3a24'; ctx.fill();
        break;
      case 'crossbow':
        rr(ctx, -4, -1.6, 15, 3.2, 1.2); ctx.fillStyle = lg(ctx, 0, -2, 0, 2, U.shade(wood, 0.25), wood); ctx.fill();
        ctx.strokeStyle = m; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(7, -8); ctx.quadraticCurveTo(11, 0, 7, 8); ctx.stroke();
        line(ctx, [7, -8, 3, 0, 7, 8], 'rgba(255,255,255,0.9)', 0.6);
        fe(ctx, 11, 0, 1.2, 1.2, g); rr(ctx, -3, 1, 3, 4, 1); ctx.fillStyle = '#6a3a24'; ctx.fill();
        break;
    }
  }

  /* ---------------------------------------------------------------- characters */
  const PANTS = { beginner: '#6a8acb', warrior: '#5a5a70', mage: '#3a3050', cleric: '#c8b8a0', archer: '#6a5a3a', npc: '#4a3a50' };
  const POSES = {
    stand0: { bob: 0, legF: [1.5, 0], legB: [-1.5, 0], armF: 22, armB: -14 },
    stand1: { bob: 0.8, legF: [1.5, 0], legB: [-1.5, 0], armF: 26, armB: -10 },
    walk0: { bob: 0, legF: [3.5, 0], legB: [-3.5, 0], armF: -12, armB: 28 },
    walk1: { bob: -1, legF: [1, -2.2], legB: [-1, 0], armF: 8, armB: 8 },
    walk2: { bob: 0, legF: [-3.5, 0], legB: [3.5, 0], armF: 38, armB: -22 },
    walk3: { bob: -1, legF: [-1, 0], legB: [1, -2.2], armF: 14, armB: 2 },
    jump: { bob: -1, legF: [3, -3.5], legB: [-2, -1.5], armF: 130, armB: -120, wAdd: 25 },
    climb0: { view: 'back', legF: [2, -2.4], legB: [-2, 0], armF: 168, armB: -168 },
    climb1: { view: 'back', legF: [-2, 0], legB: [2, -2.4], armF: 150, armB: -150 },
    swing0: { bob: 0, legF: [3, 0], legB: [-3, 0], armF: -150, armB: -30, wAng: -35, lean: -1 },
    swing1: { bob: 1, legF: [4.5, 0], legB: [-3, 0], armF: 72, armB: -40, wAng: 95, lean: 1 },
    swing2: { bob: 1.5, legF: [4.5, 0], legB: [-3, 0], armF: 112, armB: -45, wAng: 150, lean: 2 },
    shoot0: { legF: [2.5, 0], legB: [-3, 0], armF: 90, armB: 75, wAng: 0, draw: 1 },
    shoot1: { legF: [2.5, 0], legB: [-3, 0], armF: 90, armB: 35, wAng: 0, draw: 0 },
    cast0: { legF: [2, 0], legB: [-2, 0], armF: 160, armB: -35, wAng: 10, eyes: 'closed' },
    cast1: { legF: [3, 0], legB: [-2, 0], armF: 96, armB: -35, wAng: 86 },
    hurt: { legF: [-1, 0], legB: [-3, 0], armF: -40, armB: -60, wAng: -20, eyes: 'hurt', lean: -2 },
  };
  const POSE_NAMES = Object.keys(POSES);
  const rad = d => d * Math.PI / 180;

  function restAngle(wt) {
    if (!wt) return 30;
    const st = D.WTYPES[wt].style;
    return st === 'magic' ? 8 : st === 'bow' ? 0 : 38;
  }

  function drawHairBack(ctx, look, hx, hy, r, P, hasHat) {
    const c = look.hair, st = look.hairStyle | 0;
    const fill = lg(ctx, 0, hy - r, 0, hy + r, U.shade(c, 0.25), U.shade(c, -0.15));
    ctx.fillStyle = fill;
    E(ctx, hx - 1.8, hy - 1.4, r + 1.5, r + 0.6); ctx.fill();
    if (st === 1) { E(ctx, hx - 2.6, hy + 4.5, r * 0.8, 6.2); ctx.fill(); }
    if (st === 2) { const sw = (P.bob || 0) * 0.6; E(ctx, hx - r - 3.5, hy + 2 + sw, 3.4, 7.5, 0.35); ctx.fill(); fe(ctx, hx - r - 1, hy - 3, 2, 1.8, '#ff6b8a'); }
    if (st === 4) { E(ctx, hx - 3, hy + 7, r * 0.85, 10.5); ctx.fill(); }
    if (!hasHat) {
      if (st === 3) { for (const bx of [-6.5, 5.5]) { E(ctx, hx + bx, hy - r - 0.5, 3.8, 3.6); ctx.fill(); } }
      if (st === 0) { for (const [ax, ay] of [[-9, -6], [-11, -1], [-5, -10.5]]) { ctx.beginPath(); ctx.moveTo(hx + ax + 3, hy + ay - 1); ctx.lineTo(hx + ax - 3.5, hy + ay - 3.5); ctx.lineTo(hx + ax + 1, hy + ay + 3); ctx.closePath(); ctx.fill(); } }
      if (st === 5) { for (const [ax, ay] of [[-8, -8], [-11, -3], [-3, -11], [3, -11.5]]) { E(ctx, hx + ax, hy + ay, 3, 2.6); ctx.fill(); } }
    }
  }
  function drawHairFront(ctx, look, hx, hy, r, hasHat) {
    const c = look.hair, st = look.hairStyle | 0;
    ctx.fillStyle = lg(ctx, 0, hy - r - 2, 0, hy + 2, U.shade(c, 0.3), U.shade(c, -0.1));
    ctx.beginPath();
    ctx.arc(hx - 0.4, hy - 0.8, r + 1.3, Math.PI * 0.98, Math.PI * 2.02);
    const R = hx + r + 1;
    if (st === 1) { ctx.lineTo(R, hy + 1.5); ctx.lineTo(hx + 6, hy - 2.4); ctx.lineTo(hx - 3, hy - 2.4); }
    else { ctx.lineTo(R, hy + 0.5); ctx.lineTo(hx + 7.2, hy - 1.2); ctx.lineTo(hx + 5.8, hy - 3.8); ctx.lineTo(hx + 3.6, hy - 0.8); ctx.lineTo(hx + 1.4, hy - 4.2); ctx.lineTo(hx - 1.2, hy - 1.4); ctx.lineTo(hx - 3.6, hy - 4.4); }
    ctx.lineTo(hx - r - 1.4, hy + (st === 1 || st === 4 ? 6 : 2));
    ctx.closePath(); ctx.fill();
    if (!hasHat) shine(ctx, hx - 3, hy - r + 1.2, 3.2, 1, -0.2, 0.45);
  }
  function drawHat(ctx, hat, hx, hy, r, layer) {
    const [c1, c2] = hat.col || ['#ffffff', '#ffd36b'], tier = hat.tier || 0;
    switch (hat.style) {
      case 'helm':
        if (layer !== 'front') return;
        ctx.beginPath(); ctx.arc(hx - 0.5, hy - 1.2, r + 1.9, Math.PI, TAU); ctx.closePath();
        ctx.fillStyle = lg(ctx, hx - r, hy - r, hx + r, hy, U.shade(c1, 0.45), U.shade(c1, -0.2)); ctx.fill();
        rr(ctx, hx - r - 2.2, hy - 2.4, r * 2 + 3.6, 2.8, 1.2); ctx.fillStyle = U.shade(c1, -0.15); ctx.fill();
        rr(ctx, hx - 1.2, hy - r - 2.6, 2.4, r + 1, 1); ctx.fillStyle = U.shade(c1, 0.2); ctx.fill();
        if (tier >= 1) blob(ctx, hx - 6, hy - r - 3, 5.5, 2.4, c2, 0.5, 0.3, 0.3);
        shine(ctx, hx - 4, hy - r + 0.5, 2.6, 1.1, -0.4, 0.55);
        break;
      case 'witch':
        if (layer !== 'front') return;
        fe(ctx, hx - 0.5, hy - r + 1.2, r + 5.2, 2.6, U.shade(c1, -0.1));
        ctx.beginPath(); ctx.moveTo(hx - r + 0.5, hy - r + 1); ctx.quadraticCurveTo(hx - 1, hy - r - 10, hx - 8.5, hy - r - 15);
        ctx.quadraticCurveTo(hx + 1, hy - r - 9, hx + r - 1.5, hy - r + 1); ctx.closePath();
        ctx.fillStyle = lg(ctx, hx - 6, hy - r - 15, hx + 6, hy - r, U.shade(c1, 0.35), U.shade(c1, -0.15)); ctx.fill();
        rr(ctx, hx - r + 1.2, hy - r - 1.6, r * 2 - 3.4, 2.2, 1); ctx.fillStyle = c2; ctx.fill();
        if (tier >= 2) star(ctx, hx - 2.5, hy - r - 7, 2.2, 0.9, 5, c2);
        break;
      case 'hood':
        if (layer === 'back') { E(ctx, hx - 0.8, hy - 0.2, r + 2.6, r + 2.4); ctx.fillStyle = lg(ctx, 0, hy - r, 0, hy + r, U.shade(c1, 0.15), U.shade(c1, -0.2)); ctx.fill(); return; }
        ctx.beginPath(); ctx.arc(hx - 0.5, hy - 0.6, r + 2.4, Math.PI * 1.02, Math.PI * 1.98); ctx.quadraticCurveTo(hx, hy - r + 2, hx - r - 2.2, hy + 0.5); ctx.closePath();
        ctx.fillStyle = lg(ctx, 0, hy - r - 2, 0, hy, U.shade(c1, 0.35), U.shade(c1, -0.05)); ctx.fill();
        ctx.strokeStyle = c2; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(hx - 0.5, hy - 0.6, r + 1.6, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
        rr(ctx, hx - 0.6, hy - r - 2.4, 1.6, 4.4, 0.4); ctx.fillStyle = c2; ctx.fill(); rr(ctx, hx - 2.1, hy - r - 1.2, 4.6, 1.5, 0.4); ctx.fill();
        break;
      case 'cap':
        if (layer !== 'front') return;
        blob(ctx, hx - 9, hy - r - 2, 6.5, 1.7, c2, -0.45, 0.3, 0.2);
        ctx.beginPath(); ctx.arc(hx - 0.5, hy - 1.6, r + 1.4, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath();
        ctx.fillStyle = lg(ctx, 0, hy - r - 2, 0, hy, U.shade(c1, 0.3), U.shade(c1, -0.15)); ctx.fill();
        fe(ctx, hx + r - 0.5, hy - 2.6, 4.5, 1.5, U.shade(c1, -0.1), 0.15);
        rr(ctx, hx - r - 0.5, hy - 3.6, r * 2, 1.8, 0.8); ctx.fillStyle = U.shade(c2, -0.1); ctx.fill();
        break;
      case 'beanie':
        if (layer !== 'front') return;
        ctx.beginPath(); ctx.arc(hx - 0.5, hy - 1.4, r + 1.5, Math.PI * 1.0, TAU); ctx.closePath();
        ctx.fillStyle = lg(ctx, 0, hy - r - 2, 0, hy, U.shade(c1, 0.25), U.shade(c1, -0.1)); ctx.fill();
        rr(ctx, hx - r - 1.8, hy - 3.2, r * 2 + 2.6, 3, 1.4); ctx.fillStyle = c2; ctx.fill();
        blob(ctx, hx - 2, hy - r - 3.2, 2.8, 2.8, c2, 0, 0.3, 0.2);
        break;
      case 'elder':
        if (layer !== 'front') return;
        fe(ctx, hx, hy - r + 1.5, r + 4.8, 2.6, U.shade(c1, -0.1));
        ctx.beginPath(); ctx.moveTo(hx - r + 1, hy - r + 1.5); ctx.quadraticCurveTo(hx + 2, hy - r - 14, hx - 11, hy - r - 9); ctx.quadraticCurveTo(hx + 4, hy - r - 7, hx + r - 1, hy - r + 1.5); ctx.closePath();
        ctx.fillStyle = lg(ctx, 0, hy - r - 14, 0, hy - r, U.shade(c1, 0.3), c1); ctx.fill();
        rr(ctx, hx - r + 1.6, hy - r - 1.2, r * 2 - 3.4, 2, 1); ctx.fillStyle = c2; ctx.fill(); star(ctx, hx - 10.5, hy - r - 9, 2, 0.8, 5, c2);
        break;
      case 'band':
        if (layer !== 'front') return;
        rr(ctx, hx - r - 0.6, hy - 5, r * 2 + 1.2, 2.2, 1); ctx.fillStyle = c2; ctx.fill();
        line(ctx, [hx - r - 0.5, hy - 4, hx - r - 4, hy - 1.5], c2, 1.4); break;
      case 'goggles':
        if (layer !== 'front') return;
        rr(ctx, hx - r, hy - 6.2, r * 2, 1.6, 0.6); ctx.fillStyle = '#5a4a3a'; ctx.fill();
        for (const gx of [1, 6.5]) { fe(ctx, hx + gx, hy - 5.6, 2.6, 2.4, '#8a7a6a'); fe(ctx, hx + gx, hy - 5.6, 1.8, 1.6, '#9fe3ff'); shine(ctx, hx + gx - 0.6, hy - 6.2, 0.8, 0.5); }
        break;
    }
  }

  function drawTorso(ctx, style, c1, c2, by, lean, look) {
    const top = -19 + by, x = lean * 0.4;
    const metal = style === 'warrior';
    const grad = lg(ctx, x - 6, 0, x + 6, 0, U.shade(c1, metal ? 0.45 : 0.18), U.shade(c1, metal ? -0.25 : -0.15));
    if (style === 'mage' || style === 'cleric' || style === 'npc') {
      ctx.beginPath(); ctx.moveTo(x - 5.2, top); ctx.lineTo(x + 5.6, top); ctx.quadraticCurveTo(x + 7.5, -6, x + 8, -1.2 + by * 0.3);
      ctx.lineTo(x - 7.6, -1.2 + by * 0.3); ctx.quadraticCurveTo(x - 7, -6, x - 5.2, top); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
      rr(ctx, x - 7.8, -3.2 + by * 0.3, 15.8, 2.1, 1); ctx.fillStyle = c2; ctx.fill();
      if (style === 'mage') { rr(ctx, x - 5.8, -11 + by, 11.8, 2.2, 1); ctx.fillStyle = c2; ctx.fill(); }
      if (style === 'cleric') { rr(ctx, x + 1.2, top + 1, 2.2, 16, 0.6); ctx.fillStyle = c2; ctx.fill(); rr(ctx, x - 0.4, top + 3.5, 5.4, 1.8, 0.6); ctx.fill(); }
      if (style === 'npc' && look && look.apron) { rr(ctx, x - 3, top + 4, 9, 13, 2.5); ctx.fillStyle = '#fffaf0'; ctx.fill(); }
    } else {
      const bot = style === 'archer' ? -5 : -7.5;
      ctx.beginPath(); ctx.moveTo(x - 5.4, top); ctx.lineTo(x + 5.6, top); ctx.lineTo(x + 6.6, bot + by * 0.5); ctx.lineTo(x - 6.4, bot + by * 0.5); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
      rr(ctx, x - 6.4, -10.2 + by * 0.7, 13, 2.2, 0.8); ctx.fillStyle = c2; ctx.fill();
      if (metal) { shine(ctx, x - 2, top + 3.5, 2, 1.2, -0.3, 0.55); fe(ctx, x + 1.5, -9.1 + by * 0.7, 1, 1, '#ffe35a'); }
      if (style === 'beginner') { tri(ctx, [x - 1.5, top], [x + 3.5, top], [x + 1, top + 2.6], c2); }
    }
  }

  function drawArm(ctx, sx, sy, ang, len, sleeve, hand, under) {
    const hx = sx + Math.sin(rad(ang)) * len, hy = sy + Math.cos(rad(ang)) * len;
    line(ctx, [sx, sy, hx, hy], sleeve, 3.6);
    if (!under) fe(ctx, hx, hy, 1.9, 1.9, hand);
    return [hx, hy];
  }

  function drawChar(ctx, look, vis, P) {
    const style = vis.style || 'beginner';
    const by = P.bob || 0, lean = P.lean || 0, back = P.view === 'back';
    const c1 = vis.top ? vis.top[0] : (look.robe || '#ffffff'), c2 = vis.top ? vis.top[1] : (look.trim || '#7fb8ff');
    const skin = look.skin, pants = PANTS[style] || '#5a5a70';
    const shoe = vis.shoes || '#8a5a3a', glove = vis.gloves || skin;
    const sleeve = style === 'beginner' ? U.mix(c1, skin, 0.15) : c1;
    const hx = 1 + lean * 0.6, hy = -29.5 + by, r = 10.5;
    const shF = [2.6 + lean * 0.4, -17.2 + by], shB = [-2.4 + lean * 0.4, -17.4 + by];
    const wt = vis.weapon ? vis.weapon.wtype : null;
    const wStyle = wt ? D.WTYPES[wt].style : null;
    const wAng = (P.wAng !== undefined ? P.wAng : restAngle(wt)) + (P.wAdd || 0);

    // back arm
    const backArmAng = back ? P.armB : P.armB;
    const [bhx, bhy] = drawArm(ctx, shB[0], shB[1], backArmAng, 7.6, U.shade(sleeve, -0.12), U.shade(glove, -0.1));
    // quiver
    if (style === 'archer' && !back) { rr(ctx, -9 + lean * 0.4, -21 + by, 4, 11, 1.4); ctx.fillStyle = '#8a5a34'; ctx.fill(); for (const fx of [-8.6, -6.6]) tri(ctx, [fx - 1, -21 + by], [fx + 0.3, -25 + by], [fx + 1.4, -21 + by], '#ff8a8a'); }
    if (vis.hat) drawHat(ctx, vis.hat, hx, hy, r, 'back');
    // legs
    const legX = 2.2;
    for (const [lx, L, dark] of [[-legX, P.legB, true], [legX, P.legF, false]]) {
      const x0 = lx * 0.6 + lean * 0.3, y0 = -8 + by * 0.5, x1 = lx * 0.6 + L[0], y1 = -2.4 + L[1];
      line(ctx, [x0, y0, x1, y1], dark ? U.shade(pants, -0.15) : pants, 4);
      fe(ctx, x1 + 1, -1.6 + L[1], 3, 1.9, dark ? U.shade(shoe, -0.15) : shoe);
    }
    if (back) {
      drawTorso(ctx, style, U.shade(c1, -0.06), c2, by, 0, look);
      blob(ctx, hx - 0.5, hy, r, r * 0.98, skin, 0, 0.3, 0.2);
      ctx.fillStyle = lg(ctx, 0, hy - r, 0, hy + r, U.shade(look.hair, 0.2), U.shade(look.hair, -0.2));
      E(ctx, hx - 0.5, hy - 0.5, r + 1.4, r + 1); ctx.fill();
      if ((look.hairStyle | 0) === 4) { E(ctx, hx - 0.5, hy + 7, r * 0.85, 10); ctx.fill(); }
      if (vis.hat) drawHat(ctx, vis.hat, hx, hy, r, 'front');
      drawArm(ctx, shF[0] - 1, shF[1], P.armF, 7.6, sleeve, glove);
      return;
    }
    drawTorso(ctx, style, c1, c2, by, lean, look);
    // head + hair
    drawHairBack(ctx, look, hx, hy, r, P, !!vis.hat && vis.hat.style !== 'band' && vis.hat.style !== 'goggles');
    blob(ctx, hx, hy, r, r * 0.97, skin, 0, 0.35, 0.18);
    // face
    const ey = hy + 1.6, e1 = hx + 5, e2 = hx - 1.1;
    const eyes = P.eyes || 'open';
    if (eyes === 'hurt') {
      ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
      line(ctx, [e2 - 1.4, ey - 1.6, e2 + 1, ey, e2 - 1.4, ey + 1.6], INK, 1.1);
      line(ctx, [e1 + 1.4, ey - 1.6, e1 - 1, ey, e1 + 1.4, ey + 1.6], INK, 1.1);
    } else if (eyes === 'closed') {
      for (const ex of [e1, e2]) { ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ex, ey + 0.6, 1.6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    } else {
      for (const [ex, s] of [[e1, 1], [e2, 0.9]]) {
        fe(ctx, ex, ey, 1.75 * s, 2.5, INK);
        const ig = ctx.createLinearGradient(0, ey - 1.5, 0, ey + 2.4); ig.addColorStop(0, U.shade(look.eyes, -0.2)); ig.addColorStop(1, U.shade(look.eyes, 0.35));
        E(ctx, ex, ey + 0.55, 1.3 * s, 1.75); ctx.fillStyle = ig; ctx.fill();
        fe(ctx, ex - 0.55, ey - 0.8, 0.65, 0.8, '#ffffff'); fe(ctx, ex + 0.5, ey + 1.2, 0.35, 0.35, '#ffffff');
      }
    }
    fe(ctx, hx + 7.6, hy + 5.4, 1.7, 0.9, 'rgba(255,110,150,0.5)'); fe(ctx, hx - 3.2, hy + 5.4, 1.6, 0.9, 'rgba(255,110,150,0.5)');
    if (eyes === 'hurt') fe(ctx, hx + 2.8, hy + 6.6, 0.9, 0.9, '#8a2a40');
    else { ctx.strokeStyle = '#8a4a50'; ctx.lineWidth = 0.75; ctx.beginPath(); ctx.arc(hx + 2.8, hy + 5.6, 1, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
    if (look.beard) { blob(ctx, hx + 2, hy + 7.5, 6.5, 4.6, look.hair, 0, 0.3, 0.15); fe(ctx, hx + 3.8, hy + 5.4, 3.2, 1.2, U.shade(look.hair, -0.05)); }
    const hatHidesHair = vis.hat && ['helm', 'witch', 'cap', 'beanie', 'elder'].includes(vis.hat.style);
    if (!(vis.hat && vis.hat.style === 'hood')) drawHairFront(ctx, look, hx, hy, r, hatHidesHair);
    if (vis.hat) drawHat(ctx, vis.hat, hx, hy, r, 'front');
    // pauldron
    if (style === 'warrior') blob(ctx, shF[0] + 0.5, shF[1] + 0.5, 3.6, 2.8, c1, 0.2, 0.5, 0.25);
    // front arm + weapon
    const armAng = P.armF;
    const hxF = shF[0] + Math.sin(rad(armAng)) * 7.6, hyF = shF[1] + Math.cos(rad(armAng)) * 7.6;
    line(ctx, [shF[0], shF[1], hxF, hyF], sleeve, 3.6);
    if (vis.weapon && !P.noWeapon) {
      ctx.save(); ctx.translate(hxF, hyF);
      if (wStyle === 'bow') {
        ctx.rotate(rad(wt === 'crossbow' ? (P.wAng !== undefined ? 0 : 20) : (P.wAng !== undefined ? 0 : -8)));
        drawWeapon(ctx, wt, vis.weapon.col);
        if (P.draw && wt === 'bow') { line(ctx, [-1, -12, bhx - hxF, bhy - hyF, -1, 12], 'rgba(255,255,255,0.95)', 0.6); rr(ctx, bhx - hxF, bhy - hyF - 0.5, 13, 1, 0.5); ctx.fillStyle = '#c08a52'; ctx.fill(); }
      } else { ctx.rotate(rad(wAng)); drawWeapon(ctx, wt, vis.weapon.col); }
      ctx.restore();
    }
    fe(ctx, hxF, hyF, 1.95, 1.95, glove);
  }

  const charCache = new Map();
  function charKey(look, vis) { return JSON.stringify([look, vis]); }
  function character(look, vis) {
    const key = charKey(look, vis);
    let ch = charCache.get(key);
    if (ch) return ch;
    const W = 64, H = 76, ox = 32, oy = 70;
    const frames = {};
    for (const name of POSE_NAMES) {
      const c = canvas(W, H), ctx = c.getContext('2d');
      ctx.translate(ox, oy);
      drawChar(ctx, look, vis, POSES[name]);
      frames[name] = finalize(c);
    }
    ch = { frames, w: W, h: H, ox, oy };
    if (charCache.size > 40) charCache.clear();
    charCache.set(key, ch);
    return ch;
  }
  // draws a full-body frame scaled to fit a w×h box, feet at the bottom
  function fitChar(ctx, ch, frame, w, h, pad = 4) {
    const src = ch.frames[frame || 'stand0'];
    const sx = 10, sy = 14, sw = 44, sh = 60;
    const k = Math.min((w - pad * 2) / sw, (h - pad * 2) / sh);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, sx, sy, sw, sh, Math.round((w - sw * k) / 2), Math.round(h - pad - sh * k), Math.round(sw * k), Math.round(sh * k));
  }
  function portrait(look, vis, scale = 2) {
    const ch = character(look, vis);
    const src = ch.frames.stand0;
    const c = canvas(48 * scale, 48 * scale), ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 8, 8, 48, 48, 0, 0, 48 * scale, 48 * scale);
    return c;
  }

  /* ---------------------------------------------------------------- icons */
  const iconCache = new Map();
  function iconCanvas(drawFn, size = 24) {
    const c = canvas(size, size), ctx = c.getContext('2d');
    drawFn(ctx, size);
    return finalize(c);
  }
  const WICON = { sword: [7, 18, 45, 0.85], axe: [8, 17, 35, 0.85], wand: [8, 17, 40, 1.05], staff: [7, 19, 40, 0.68], mace: [8, 17, 40, 0.95], scepter: [8, 17, 40, 0.95], bow: [12, 12, 40, 0.85], crossbow: [5, 15, -35, 0.95] };
  function drawMatIcon(ctx, kind, col) {
    const c = col || '#c9b8ff';
    switch (kind) {
      case 'blob': blob(ctx, 12, 14, 7.5, 6, c, 0, 0.5, 0.25); shine(ctx, 9, 11, 2, 1.2); break;
      case 'leaf': ctx.save(); ctx.translate(12, 12); ctx.rotate(-0.7); blob(ctx, 0, 0, 4.5, 8.5, c, 0, 0.4, 0.3); line(ctx, [0, -7, 0, 9], U.shade(c, -0.35), 0.8); ctx.restore(); break;
      case 'shell': blob(ctx, 12, 13, 8, 7, c, 0, 0.45, 0.3); for (let i = -2; i <= 2; i++) line(ctx, [12, 19, 12 + i * 3.2, 7.5], U.shade(c, -0.25), 0.8); break;
      case 'puff': for (const [x, y] of [[9, 11], [15, 11], [12, 15], [12, 9]]) blob(ctx, x, y, 4.6, 4.2, c, 0, 0.35, 0.15); break;
      case 'feather': ctx.save(); ctx.translate(12, 12); ctx.rotate(0.7); blob(ctx, 0, -1, 3.6, 9, c, 0, 0.4, 0.25); line(ctx, [0, -9, 0, 10], U.shade(c, -0.3), 0.9); ctx.restore(); break;
      case 'cap': ctx.beginPath(); ctx.moveTo(3, 15); ctx.bezierCurveTo(3, 3, 21, 3, 21, 15); ctx.closePath(); ctx.fillStyle = rg(ctx, 10, 9, 10, c); ctx.fill(); fe(ctx, 8, 10, 1.8, 1.6, '#ffffff'); fe(ctx, 15, 9, 2, 1.8, '#ffffff'); rr(ctx, 9, 15, 6, 5, 2); ctx.fillStyle = '#fff2e0'; ctx.fill(); break;
      case 'wing': ctx.beginPath(); ctx.moveTo(4, 18); ctx.quadraticCurveTo(6, 4, 20, 4); ctx.quadraticCurveTo(16, 10, 19, 14); ctx.quadraticCurveTo(12, 13, 4, 18); ctx.fillStyle = lg(ctx, 4, 4, 20, 18, U.shade(c, 0.3), U.shade(c, -0.2)); ctx.fill(); break;
      case 'whisker': for (const y of [9, 12, 15]) line(ctx, [4, y + 1, 20, y - 1], c, 1); fe(ctx, 12, 12, 2.4, 2, '#3a2a3a'); break;
      case 'claw': ctx.beginPath(); ctx.moveTo(6, 19); ctx.quadraticCurveTo(4, 6, 15, 4); ctx.quadraticCurveTo(12, 9, 19, 10); ctx.quadraticCurveTo(14, 14, 6, 19); ctx.fillStyle = rg(ctx, 10, 10, 10, c); ctx.fill(); break;
      case 'shard': ctx.beginPath(); ctx.moveTo(12, 2); ctx.lineTo(17, 11); ctx.lineTo(12, 22); ctx.lineTo(7, 11); ctx.closePath(); ctx.fillStyle = lg(ctx, 7, 2, 17, 22, U.shade(c, 0.5), U.shade(c, -0.2)); ctx.fill(); break;
      case 'star': star(ctx, 12, 12, 9, 4.2, 5, c); fe(ctx, 10, 10, 1.6, 1.2, 'rgba(255,255,255,0.8)'); break;
      case 'scarf': rr(ctx, 3, 8, 18, 5, 2.5); ctx.fillStyle = c; ctx.fill(); rr(ctx, 13, 10, 5, 11, 2); ctx.fill(); for (const x of [6, 10, 15]) line(ctx, [x, 8, x, 13], U.shade(c, 0.4), 0.8); break;
      case 'orb': blob(ctx, 12, 12, 7, 7, c, 0, 0.6, 0.2); star(ctx, 10, 10, 2.4, 0.8, 4, '#ffffff'); break;
      case 'rock': ctx.beginPath(); ctx.moveTo(5, 17); ctx.lineTo(4, 10); ctx.lineTo(9, 5); ctx.lineTo(17, 6); ctx.lineTo(20, 13); ctx.lineTo(16, 19); ctx.closePath(); ctx.fillStyle = lg(ctx, 4, 5, 20, 19, U.shade(c, 0.3), U.shade(c, -0.25)); ctx.fill(); fe(ctx, 12, 12, 2, 2, '#7ee0c0'); break;
      case 'scale': for (const [x, y] of [[8, 9], [16, 9], [12, 15]]) { ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI); ctx.lineTo(x - 5, y); ctx.fillStyle = rg(ctx, x, y, 5, c); ctx.fill(); } break;
      case 'gem': ctx.beginPath(); ctx.moveTo(6, 9); ctx.lineTo(10, 4); ctx.lineTo(14, 4); ctx.lineTo(18, 9); ctx.lineTo(12, 20); ctx.closePath(); ctx.fillStyle = lg(ctx, 6, 4, 18, 20, U.shade(c, 0.5), U.shade(c, -0.25)); ctx.fill(); line(ctx, [6, 9, 18, 9], U.shade(c, 0.6), 0.8); shine(ctx, 10, 7, 1.6, 0.9); break;
      case 'charm': ctx.beginPath(); ctx.moveTo(12, 3); ctx.lineTo(19, 6); ctx.quadraticCurveTo(19, 16, 12, 21); ctx.quadraticCurveTo(5, 16, 5, 6); ctx.closePath(); ctx.fillStyle = lg(ctx, 5, 3, 19, 21, U.shade(c, 0.4), U.shade(c, -0.2)); ctx.fill(); star(ctx, 12, 11, 4, 1.8, 5, '#ffffff'); break;
      default: blob(ctx, 12, 12, 7, 7, c, 0, 0.45, 0.25);
    }
  }
  const MAT_COL = { slime: '#ff9ec7', sprout: '#7ed957', snail: '#f0a1b8', bunny: '#fff2f6', bird: '#ffe35a', mushroom: '#ff6b6b', bug: '#cfeaff', seal: '#e8e0f0', beast: '#ff9a4a', crab: '#ff6b5a', fish: '#ffe35a', star: '#ffa14a', octo: '#c38bff', penguin: '#ff6b6b', wisp: '#7fb8ff', bat: '#8a6ab8', golem: '#a8a0b8', drake: '#ff6b8a', tree: '#6ccf5a' };

  function drawArmorIcon(ctx, base) {
    const [c1, c2] = base.col, fam = base.fam;
    switch (base.slot) {
      case 'hat': {
        const style = fam ? HATSTYLE[fam] : 'beanie';
        drawHat(ctx, { style, col: base.col, tier: base.tier }, 12, 19, 8.5, 'back');
        drawHat(ctx, { style, col: base.col, tier: base.tier }, 12, 19, 8.5, 'front');
        break;
      }
      case 'top': {
        const robe = fam === 'mage' || fam === 'cleric';
        ctx.beginPath(); ctx.moveTo(8, 4); ctx.lineTo(16, 4); ctx.lineTo(22, 9); ctx.lineTo(19, 12); ctx.lineTo(17, 10.5);
        ctx.lineTo(robe ? 19 : 17, robe ? 22 : 20); ctx.lineTo(robe ? 5 : 7, robe ? 22 : 20); ctx.lineTo(7, 10.5); ctx.lineTo(5, 12); ctx.lineTo(2, 9); ctx.closePath();
        ctx.fillStyle = lg(ctx, 4, 4, 20, 20, U.shade(c1, fam === 'warrior' ? 0.45 : 0.2), U.shade(c1, -0.2)); ctx.fill();
        rr(ctx, 6.5, 13, 11, 2, 0.8); ctx.fillStyle = c2; ctx.fill();
        tri(ctx, [9.5, 4], [14.5, 4], [12, 7], U.shade(c1, -0.25));
        if (fam === 'cleric') { rr(ctx, 11, 7, 2, 7, 0.4); ctx.fillStyle = c2; ctx.fill(); rr(ctx, 9.5, 8.5, 5, 1.6, 0.4); ctx.fill(); }
        break;
      }
      case 'gloves':
        for (const [x, rot] of [[8, -0.25], [16, 0.25]]) { ctx.save(); ctx.translate(x, 13); ctx.rotate(rot); rr(ctx, -3.6, -6, 7.2, 10, 3); ctx.fillStyle = lg(ctx, -4, -6, 4, 4, U.shade(c1, 0.3), U.shade(c1, -0.2)); ctx.fill(); fe(ctx, -3.8, -1, 1.8, 2.4, c1); rr(ctx, -3.8, 2.5, 7.6, 2.2, 1); ctx.fillStyle = c2; ctx.fill(); ctx.restore(); }
        break;
      case 'shoes':
        for (const x of [4, 13]) { rr(ctx, x, 6, 5, 11, 2); ctx.fillStyle = lg(ctx, x, 6, x + 5, 17, U.shade(c1, 0.3), U.shade(c1, -0.15)); ctx.fill(); fe(ctx, x + 4, 17, 4.5, 2.6, U.shade(c1, -0.1)); rr(ctx, x, 9, 5, 1.6, 0.6); ctx.fillStyle = c2; ctx.fill(); }
        break;
    }
  }
  const HATSTYLE = { warrior: 'helm', mage: 'witch', cleric: 'hood', archer: 'cap' };

  function itemIcon(id) {
    let ic = iconCache.get(id);
    if (ic) return ic;
    const base = D.ITEMS[id];
    let c;
    if (id === 'coins') c = iconCanvas(ctx => { for (const [x, y] of [[9, 15], [15, 15], [12, 10]]) { blob(ctx, x, y, 5, 4.4, '#ffcf3f', 0, 0.5, 0.25); fe(ctx, x, y, 2.4, 2, '#e8a020'); } });
    else if (!base) c = iconCanvas(ctx => blob(ctx, 12, 12, 7, 7, '#cccccc'));
    else if (base.kind === 'weapon') c = iconCanvas(ctx => { const [tx, ty, r, sc] = WICON[base.wtype]; ctx.translate(tx, ty); ctx.rotate(rad(r)); ctx.scale(sc, sc); drawWeapon(ctx, base.wtype, base.col); });
    else if (base.kind === 'armor') c = iconCanvas(ctx => drawArmorIcon(ctx, base));
    else if (base.kind === 'acc') c = iconCanvas(ctx => {
      if (/ring/i.test(base.name)) { ctx.strokeStyle = '#ffcf3f'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(12, 14, 6, 0, TAU); ctx.stroke(); blob(ctx, 12, 7, 3.4, 3, base.col, 0, 0.6, 0.2); }
      else { ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(12, 6, 7, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke(); if (/Earring/.test(base.name)) star(ctx, 12, 15, 6, 2.6, 6, base.col); else blob(ctx, 12, 15, 4.6, 5.2, base.col, 0, 0.6, 0.25); shine(ctx, 10.5, 13.5, 1.4, 1); }
    });
    else if (base.kind === 'use') c = iconCanvas(ctx => {
      if (base.eff.town) { rr(ctx, 4, 6, 16, 12, 2); ctx.fillStyle = lg(ctx, 0, 6, 0, 18, '#fff6d8', '#e8d0a0'); ctx.fill(); for (const x of [3, 19]) { fe(ctx, x + 1, 12, 2.2, 6.5, '#c9a36a'); } for (const y of [9.5, 12, 14.5]) line(ctx, [7, y, 17, y], '#8a6a4a', 0.7); }
      else if (base.eff.bell) { ctx.beginPath(); ctx.moveTo(6, 17); ctx.quadraticCurveTo(6, 5, 12, 5); ctx.quadraticCurveTo(18, 5, 18, 17); ctx.closePath(); ctx.fillStyle = lg(ctx, 6, 5, 18, 17, '#fff3a0', '#e89a20'); ctx.fill(); fe(ctx, 12, 18.5, 2, 2, '#c97a10'); rr(ctx, 4.5, 16, 15, 2.2, 1); ctx.fillStyle = '#ffcf3f'; ctx.fill(); }
      else { rr(ctx, 9.5, 3, 5, 4, 1); ctx.fillStyle = '#c08a52'; ctx.fill(); rr(ctx, 9, 6, 6, 3.5, 1); ctx.fillStyle = 'rgba(230,245,255,0.95)'; ctx.fill(); blob(ctx, 12, 15, 7.2, 6.8, base.col, 0, 0.45, 0.3); shine(ctx, 9.2, 12.5, 2, 1.4, -0.6, 0.85); }
    });
    else c = iconCanvas(ctx => drawMatIcon(ctx, base.icon, base.col || MAT_COL[base.fam]));
    ic = { canvas: c, url: c.toDataURL() };
    iconCache.set(id, ic);
    return ic;
  }

  /* ---------------------------------------------------------------- skill icons */
  function glyph(ctx, g, s) {
    const W = '#ffffff', C = 12;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    switch (g) {
      case 'slash': ctx.strokeStyle = W; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(8, 16, 11, -1.2, -0.1); ctx.stroke(); line(ctx, [6, 18, 17, 7], W, 1.6); break;
      case 'arc': ctx.strokeStyle = W; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(12, 16, 9, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(12, 16, 5.5, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); break;
      case 'cross': line(ctx, [5, 5, 19, 19], W, 2.4); line(ctx, [19, 5, 5, 19], W, 2.4); break;
      case 'burst': star(ctx, C, C, 9, 4, 8, W); break;
      case 'shield': ctx.beginPath(); ctx.moveTo(12, 4); ctx.lineTo(19, 7); ctx.quadraticCurveTo(19, 16, 12, 20); ctx.quadraticCurveTo(5, 16, 5, 7); ctx.closePath(); ctx.fillStyle = W; ctx.fill(); break;
      case 'up': tri(ctx, [12, 3], [20, 12], [4, 12], W); rr(ctx, 9, 12, 6, 8, 1); ctx.fillStyle = W; ctx.fill(); break;
      case 'sword': ctx.save(); ctx.translate(8, 17); ctx.rotate(rad(45)); ctx.scale(0.75, 0.75); drawWeapon(ctx, 'sword', { m: '#ffffff', g: '#ffe35a' }); ctx.restore(); break;
      case 'heart': ctx.beginPath(); ctx.moveTo(12, 19); ctx.bezierCurveTo(2, 12, 6, 3, 12, 8); ctx.bezierCurveTo(18, 3, 22, 12, 12, 19); ctx.fillStyle = W; ctx.fill(); break;
      case 'dash': for (const y of [8, 12, 16]) line(ctx, [4 + (y === 12 ? 0 : 3), y, 14, y], W, 1.6); tri(ctx, [14, 6], [21, 12], [14, 18], W); break;
      case 'star': star(ctx, C, C, 9, 4, 5, W); break;
      case 'claw': for (const d of [-4, 0, 4]) line(ctx, [7 + d, 5, 15 + d, 19], W, 1.6); break;
      case 'orb': blob(ctx, C, C, 6.5, 6.5, W, 0, 0, 0.2); star(ctx, 10, 10, 2.2, 0.7, 4, s); break;
      case 'wing': ctx.beginPath(); ctx.moveTo(5, 18); ctx.quadraticCurveTo(5, 5, 19, 5); ctx.quadraticCurveTo(15, 9, 18, 12); ctx.quadraticCurveTo(12, 12, 14, 15); ctx.quadraticCurveTo(9, 14, 5, 18); ctx.fillStyle = W; ctx.fill(); break;
      case 'drop': ctx.beginPath(); ctx.moveTo(12, 3); ctx.quadraticCurveTo(19, 12, 18, 15); ctx.arc(12, 15, 6, 0, Math.PI); ctx.quadraticCurveTo(5, 12, 12, 3); ctx.fillStyle = W; ctx.fill(); break;
      case 'book': rr(ctx, 4, 6, 16, 13, 1.5); ctx.fillStyle = W; ctx.fill(); line(ctx, [12, 6, 12, 19], s, 1); break;
      case 'fire': flame(ctx, 12, 20, 12, 17, '#ffffff', '#fff6c0', 1); break;
      case 'ice': for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; line(ctx, [C - Math.cos(a) * 9, C - Math.sin(a) * 9, C + Math.cos(a) * 9, C + Math.sin(a) * 9], W, 1.8); } break;
      case 'bolt': ctx.beginPath(); ctx.moveTo(14, 3); ctx.lineTo(6, 13); ctx.lineTo(11, 13); ctx.lineTo(9, 21); ctx.lineTo(18, 10); ctx.lineTo(13, 10); ctx.closePath(); ctx.fillStyle = W; ctx.fill(); break;
      case 'arrow': line(ctx, [5, 19, 18, 6], W, 1.6); tri(ctx, [19, 5], [13, 7], [17, 11], W); line(ctx, [5, 19, 4, 15], W, 1.2); line(ctx, [5, 19, 9, 20], W, 1.2); break;
      case 'arrows': for (const d of [-4, 3]) { line(ctx, [4, 14 + d, 18, 14 + d - 5], W, 1.4); tri(ctx, [20, 8 + d], [15, 8 + d], [17, 12 + d], W); } break;
      case 'rain': for (const x of [6, 12, 18]) { line(ctx, [x, 4, x, 15], W, 1.4); tri(ctx, [x - 2.4, 15], [x + 2.4, 15], [x, 20], W); } break;
      case 'hammer': rr(ctx, 5, 5, 14, 7, 2); ctx.fillStyle = W; ctx.fill(); rr(ctx, 10.5, 11, 3, 10, 1); ctx.fill(); break;
      case 'plus': rr(ctx, 9.5, 4, 5, 16, 1.5); ctx.fillStyle = W; ctx.fill(); rr(ctx, 4, 9.5, 16, 5, 1.5); ctx.fill(); break;
      case 'sun': fe(ctx, C, C, 4.5, 4.5, W); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; line(ctx, [C + Math.cos(a) * 6.5, C + Math.sin(a) * 6.5, C + Math.cos(a) * 9.5, C + Math.sin(a) * 9.5], W, 1.6); } break;
      case 'pillar': for (const x of [6, 12, 18]) { rr(ctx, x - 1.8, 3, 3.6, 17, 1.6); ctx.fillStyle = W; ctx.fill(); } break;
      case 'sym': ctx.strokeStyle = W; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(C, C, 7, 0, TAU); ctx.stroke(); star(ctx, C, C, 5, 2, 4, W); break;
      case 'eye': fe(ctx, C, C, 9, 5, W); fe(ctx, C, C, 3.6, 3.6, s); fe(ctx, C, C, 1.6, 1.6, '#2a1a33'); break;
      case 'bow': ctx.save(); ctx.translate(10, 12); ctx.scale(0.8, 0.8); drawWeapon(ctx, 'bow', { m: '#ffffff', g: '#ffe35a' }); ctx.restore(); break;
      case 'moon': fe(ctx, C, C, 8, 8, W); fe(ctx, 15.5, 9, 6.5, 6.5, s); break;
      default: blob(ctx, C, C, 6, 6, W);
    }
  }
  function skillIcon(sk) {
    const key = 'sk_' + sk.id;
    let ic = iconCache.get(key);
    if (ic) return ic;
    const c = canvas(24, 24), ctx = c.getContext('2d');
    rr(ctx, 1, 1, 22, 22, 6); ctx.fillStyle = lg(ctx, 0, 0, 0, 24, U.shade(sk.icon.c, 0.25), U.shade(sk.icon.c, -0.35)); ctx.fill();
    ctx.save(); ctx.globalAlpha = 0.25; fe(ctx, 8, 6, 9, 4, '#ffffff', -0.3); ctx.restore();
    ctx.save(); glyph(ctx, sk.icon.g, sk.icon.c); ctx.restore();
    if (sk.kind === 'passive') { rr(ctx, 1, 1, 22, 22, 6); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.setLineDash([2, 2]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]); }
    finalize(c, { dark: 0.5 });
    ic = { canvas: c, url: c.toDataURL() };
    iconCache.set(key, ic);
    return ic;
  }

  /* ---------------------------------------------------------------- small world sprites */
  const misc = {};
  function projSprite(kind) {
    if (misc[kind]) return misc[kind];
    const P = {
      pebble: [8, 8, ctx => blob(ctx, 4, 4, 2.6, 2.4, '#b8a888', 0, 0.4, 0.3)],
      arrow: [18, 6, ctx => { line(ctx, [1, 3, 15, 3], '#c08a52', 1.2); tri(ctx, [17, 3], [13.5, 1], [13.5, 5], '#e8eef8'); tri(ctx, [1, 3], [4, 0.5], [5, 3], '#ff8a8a'); tri(ctx, [1, 3], [4, 5.5], [5, 3], '#ff8a8a'); }],
      arrowBig: [24, 8, ctx => { line(ctx, [1, 4, 19, 4], '#ffe08a', 1.8); tri(ctx, [23, 4], [17.5, 0.5], [17.5, 7.5], '#ffffff'); tri(ctx, [1, 4], [5, 0], [7, 4], '#7ee08a'); tri(ctx, [1, 4], [5, 8], [7, 4], '#7ee08a'); }],
      boom: [20, 8, ctx => { line(ctx, [1, 4, 15, 4], '#c08a52', 1.4); blob(ctx, 16, 4, 3.2, 3.2, '#ff5a3a', 0, 0.5, 0.2); fe(ctx, 15, 3, 1, 1, '#ffe35a'); }],
      sting: [10, 6, ctx => tri(ctx, [9, 3], [1, 0.5], [1, 5.5], '#3a2a20')],
      ink: [10, 10, ctx => blob(ctx, 5, 5, 4, 3.6, '#4a2a6a', 0, 0.4, 0.2)],
      icicle: [12, 6, ctx => tri(ctx, [11, 3], [1, 0.5], [1, 5.5], '#bff0ff')],
      wispfire: [10, 10, ctx => blob(ctx, 5, 5, 3.6, 3.6, '#ffcf5a', 0, 0.7, 0.2)],
      ember: [10, 10, ctx => blob(ctx, 5, 5, 3.6, 3.6, '#ff7a3a', 0, 0.7, 0.2)],
      boulder: [16, 16, ctx => blob(ctx, 8, 8, 6.5, 6, '#9a8a7a', 0, 0.4, 0.3)],
    }[kind];
    if (!P) return null;
    const c = canvas(P[0], P[1]); P[2](c.getContext('2d'));
    misc[kind] = finalize(c);
    return misc[kind];
  }

  // A tombstone-free "fainted" sprite: a little angel ghost
  function ghostSprite() {
    if (misc.ghost) return misc.ghost;
    const c = canvas(28, 30), ctx = c.getContext('2d');
    ctx.translate(14, 28);
    FAM.wisp.draw(ctx, { b: '#ffffff', s: '#ffe35a', k: 'ghosty' }, { t: 0, sq: 0, closed: true });
    ctx.strokeStyle = '#ffe35a'; ctx.lineWidth = 1.3; E(ctx, 0, -22, 6, 1.8); ctx.stroke();
    misc.ghost = finalize(c);
    return misc.ghost;
  }

  return { fitChar, canvas, finalize, E, fe, rg, lg, blob, shine, rr, line, tri, star, flame, crown, face, FAM, mob, drawWeapon, character, portrait, POSES, itemIcon, skillIcon, projSprite, ghostSprite, MAT_COL, HATSTYLE };
})();
