'use strict';
// Map layouts (seeded), parallax backdrops, terrain pre-render and ambient particles.
const World = (() => {
  const GROUND_H = 48;
  const TIER = 62;
  const built = new Map();

  function surfaceBelow(plats, x, y) {
    let best = Infinity;
    for (const p of plats) if (x >= p.x && x <= p.x + p.w && p.y > y && p.y < best) best = p.y;
    return best;
  }

  function layout(def) {
    const rnd = U.seeded(def.seed * 7919 + 13);
    const W = def.w, H = def.h, gy = H - GROUND_H;
    const plats = [{ x: 0, y: gy, w: W, ground: true, tier: 0 }];
    const ropes = [];
    if (!def.town) {
      const tiers = [];
      for (let y = gy - TIER, i = 1; y > 120 && i <= 5; y -= TIER, i++) tiers.push(y);
      tiers.forEach((ty, ti) => {
        let x = 150 + rnd.range(0, 140);
        while (x < W - 280) {
          const len = rnd.int(150, 320);
          if (rnd() < 0.8 || ti === 0) plats.push({ x: Math.round(x), y: ty, w: Math.round(Math.min(len, W - 170 - x)), tier: ti + 1 });
          x += len + rnd.int(70, 190);
        }
      });
      for (const p of plats) {
        if (p.ground) continue;
        const lower = plats.filter(q => q.tier === p.tier - 1 && q.x < p.x + p.w - 30 && q.x + q.w > p.x + 30);
        const need = p.tier > 1 && lower.length === 0;
        if (need || rnd() < 0.45) {
          const rx = Math.round(p.x + (rnd() < 0.5 ? 26 : p.w - 26));
          const bot = surfaceBelow(plats, rx, p.y + 2);
          if (bot < Infinity && bot - p.y > 40) ropes.push({ x: rx, y1: p.y - 4, y2: bot - 6 });
        }
      }
    } else {
      plats.push({ x: 560, y: gy - 46, w: 150, tier: 1, deco: 'stage' });
    }
    const portals = [];
    const idx = D.MAP_ORDER.indexOf(def.id);
    if (idx > 0) portals.push({ x: 64, y: gy, to: D.MAP_ORDER[idx - 1], side: 'right' });
    if (idx < D.MAP_ORDER.length - 1) portals.push({ x: W - 64, y: gy, to: D.MAP_ORDER[idx + 1], side: 'left' });
    const spawns = [];
    if (!def.town) {
      for (const p of plats) {
        if (p.ground) { for (let x = 260; x < W - 260; x += rnd.int(150, 210)) spawns.push({ x, y: p.y, plat: p, air: false, tier: 0 }); }
        else { for (let x = p.x + 50; x < p.x + p.w - 40; x += rnd.int(140, 190)) spawns.push({ x, y: p.y, plat: p, air: false, tier: p.tier }); }
      }
      for (let x = 320; x < W - 320; x += rnd.int(330, 440)) {
        const y = gy - TIER * rnd.int(1, 3) - rnd.int(20, 40);
        spawns.push({ x, y, plat: null, air: true, tier: Math.round((gy - y) / TIER) });
      }
      const cap = def.cap || 34;
      while (spawns.length > cap) spawns.splice(Math.floor(rnd() * spawns.length), 1);
    }
    return { W, H, gy, plats, ropes, portals, spawns };
  }

  /* ---------------------------------------------------------------- backdrops */
  function sineRidge(ctx, w, h, base, amp, freqs, col, rnd, top) {
    const ph = freqs.map(() => rnd() * 6.28);
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) {
      let y = base;
      freqs.forEach((f, i) => { y -= Math.sin((x / w) * Math.PI * 2 * f + ph[i]) * amp / (i + 1); });
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h); ctx.closePath();
    ctx.fillStyle = top ? Art.lg(ctx, 0, base - amp, 0, h, top, col) : col; ctx.fill();
  }
  function roundTree(ctx, x, y, s, col, trunk) {
    ctx.fillStyle = trunk; ctx.fillRect(x - 2 * s, y - 10 * s, 4 * s, 10 * s);
    for (const [dx, dy, r] of [[0, -18, 9], [-6, -13, 6.5], [6, -13, 6.5], [0, -24, 6]]) { Art.E(ctx, x + dx * s, y + dy * s, r * s, r * s * 0.9); ctx.fillStyle = Art.rg(ctx, x + dx * s, y + dy * s, r * s, col, 0.25, 0.25); ctx.fill(); }
  }
  function pine(ctx, x, y, s, col, snow) {
    ctx.fillStyle = U.shade(col, -0.4); ctx.fillRect(x - 1.5 * s, y - 6 * s, 3 * s, 6 * s);
    for (let i = 0; i < 3; i++) {
      const w = (12 - i * 3) * s, yy = y - 5 * s - i * 8 * s;
      Art.tri(ctx, [x - w, yy], [x, yy - 13 * s], [x + w, yy], i % 2 ? U.shade(col, 0.06) : col);
      if (snow) Art.tri(ctx, [x - w * 0.45, yy - 7 * s], [x, yy - 13 * s], [x + w * 0.45, yy - 7 * s], '#ffffff');
    }
  }

  function makeBackdrop(def) {
    const th = def.theme, id = def.id, rnd = U.seeded(def.seed * 31 + 7);
    const FW = 1024, FH = 260, MW = 1024, MH = 200;
    const far = Art.canvas(FW, FH), f = far.getContext('2d');
    const mid = Art.canvas(MW, MH), m = mid.getContext('2d');
    const farC = th.far, midC = th.mid;
    if (id === 'peaks') {
      for (let i = 0; i < 9; i++) {
        const x = i * 128 + rnd.range(-30, 30), h = rnd.range(120, 210), w = rnd.range(110, 170);
        Art.tri(f, [x - w, FH], [x, FH - h], [x + w, FH], U.shade(farC, -0.05 * (i % 2)));
        Art.tri(f, [x - w * 0.28, FH - h * 0.72], [x, FH - h], [x + w * 0.28, FH - h * 0.72], '#ffffff');
      }
      sineRidge(f, FW, FH, FH - 40, 14, [2, 5], U.shade(farC, -0.12), rnd);
      for (let x = 10; x < MW; x += rnd.int(30, 70)) pine(m, x, MH, rnd.range(1.2, 2), midC, true);
      sineRidge(m, MW, MH, MH - 14, 6, [3, 7], '#ffffff', rnd);
    } else if (id === 'coast') {
      f.fillStyle = Art.lg(f, 0, FH - 120, 0, FH, '#7fe0ff', '#2fa6c9'); f.fillRect(0, FH - 120, FW, 120);
      for (let i = 0; i < 40; i++) { f.fillStyle = 'rgba(255,255,255,0.5)'; f.fillRect(rnd() * FW, FH - 118 + rnd() * 110, rnd.range(8, 24), 1); }
      for (let i = 0; i < 3; i++) { const x = rnd.range(100, 900); Art.E(f, x, FH - 118, rnd.range(40, 90), rnd.range(14, 26)); f.fillStyle = U.shade(farC, -0.2); f.fill(); }
      for (let x = 30; x < MW; x += rnd.int(120, 220)) {
        const h = rnd.range(70, 120); m.strokeStyle = '#a8784a'; m.lineWidth = 5; m.beginPath(); m.moveTo(x, MH); m.quadraticCurveTo(x + 12, MH - h * 0.5, x + 4, MH - h); m.stroke();
        for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; Art.E(m, x + 4 + Math.cos(a) * 14, MH - h + Math.sin(a) * 5 + 4, 16, 4.5, a); m.fillStyle = k % 2 ? '#3fb86a' : '#5ccf7a'; m.fill(); }
      }
      sineRidge(m, MW, MH, MH - 18, 8, [2, 6], '#ffe6a8', rnd, '#fff4cc');
    } else if (id === 'ruins') {
      Art.fe(f, 760, 60, 34, 34, '#fff6d8'); Art.fe(f, 772, 52, 30, 30, U.mix(th.sky[0], th.sky[1], 0.25));
      for (let i = 0; i < 7; i++) {
        const x = i * 150 + rnd.range(0, 40), h = rnd.range(70, 150), w = rnd.range(50, 90);
        f.fillStyle = U.shade(farC, -0.08 * (i % 2)); f.fillRect(x, FH - h, w, h);
        for (let b = 0; b < w; b += 14) f.fillRect(x + b, FH - h - 10, 8, 10);
        f.fillStyle = 'rgba(255,220,140,0.55)'; for (let k = 0; k < 3; k++) f.fillRect(x + rnd.range(8, w - 12), FH - h + rnd.range(16, h - 20), 5, 8);
      }
      sineRidge(f, FW, FH, FH - 30, 10, [3, 6], U.shade(farC, -0.18), rnd);
      for (let x = 20; x < MW; x += rnd.int(80, 150)) {
        const h = rnd.range(60, 140); m.fillStyle = Art.lg(m, x, 0, x + 22, 0, U.shade(midC, 0.18), U.shade(midC, -0.12)); m.fillRect(x, MH - h, 22, h);
        m.fillStyle = U.shade(midC, 0.25); m.fillRect(x - 4, MH - h - 6, 30, 7);
        if (rnd() < 0.5) { m.strokeStyle = '#5a9a5a'; m.lineWidth = 2; m.beginPath(); m.moveTo(x + 4, MH - h); m.quadraticCurveTo(x - 6, MH - h * 0.5, x + 8, MH - 20); m.stroke(); }
      }
    } else if (id === 'caldera') {
      f.beginPath(); f.moveTo(200, FH); f.lineTo(420, 70); f.lineTo(520, 70); f.lineTo(760, FH); f.closePath(); f.fillStyle = Art.lg(f, 0, 70, 0, FH, U.shade(farC, 0.1), U.shade(farC, -0.2)); f.fill();
      f.fillStyle = Art.lg(f, 0, 60, 0, 120, '#ffe35a', '#ff5a2a'); f.beginPath(); f.moveTo(420, 72); f.lineTo(470, 64); f.lineTo(520, 72); f.lineTo(480, 120); f.lineTo(455, 100); f.closePath(); f.fill();
      for (let i = 0; i < 6; i++) { Art.E(f, 470 + rnd.range(-60, 60), 50 - i * 9, rnd.range(16, 30), rnd.range(8, 14)); f.fillStyle = `rgba(90,60,80,${0.5 - i * 0.06})`; f.fill(); }
      sineRidge(f, FW, FH, FH - 50, 20, [2, 5], U.shade(farC, -0.15), rnd);
      for (let x = 20; x < MW; x += rnd.int(70, 140)) { const h = rnd.range(50, 130), w = rnd.range(18, 34); Art.tri(m, [x - w, MH], [x, MH - h], [x + w, MH], midC); m.strokeStyle = '#ff7a3a'; m.lineWidth = 1.5; m.beginPath(); m.moveTo(x - 4, MH - h * 0.6); m.lineTo(x + 2, MH - h * 0.4); m.lineTo(x - 2, MH - h * 0.2); m.stroke(); }
    } else if (id === 'forest') {
      sineRidge(f, FW, FH, FH - 90, 26, [2, 4], farC, rnd, U.shade(farC, 0.15));
      for (let x = 0; x < FW; x += rnd.int(36, 60)) roundTree(f, x, FH - 40 + rnd.range(-10, 10), rnd.range(2.2, 3.2), U.shade(farC, -0.1), U.shade(farC, -0.35));
      for (let x = 0; x < MW; x += rnd.int(50, 90)) {
        m.fillStyle = Art.lg(m, x, 0, x + 18, 0, '#8a5a3a', '#5a3a2a'); m.fillRect(x, 20, 18, MH - 20);
        Art.E(m, x + 9, 30, 46, 34); m.fillStyle = Art.rg(m, x + 9, 30, 46, midC, 0.15, 0.25); m.fill();
        if (rnd() < 0.3) { Art.E(m, x + 22, 90, 7, 9); m.fillStyle = '#ffbf47'; m.fill(); }
      }
    } else {
      sineRidge(f, FW, FH, FH - 110, 30, [1, 3], U.shade(farC, 0.08), rnd, U.shade(farC, 0.2));
      sineRidge(f, FW, FH, FH - 60, 22, [2, 5], farC, rnd, U.shade(farC, 0.12));
      if (id === 'town') { const cx = 640; f.fillStyle = U.shade(farC, -0.18); f.fillRect(cx - 40, FH - 150, 80, 100); for (const tx of [cx - 50, cx + 34]) { f.fillRect(tx, FH - 175, 16, 125); Art.tri(f, [tx - 4, FH - 175], [tx + 8, FH - 200], [tx + 20, FH - 175], '#e88aa8'); } Art.tri(f, [cx - 44, FH - 150], [cx, FH - 185], [cx + 44, FH - 150], '#e88aa8'); }
      for (let x = 0; x < MW; x += rnd.int(40, 80)) roundTree(m, x, MH, rnd.range(1.8, 2.6), midC, '#8a5a3a');
      sineRidge(m, MW, MH, MH - 12, 5, [4, 9], U.shade(midC, 0.1), rnd);
    }
    // clouds
    const clouds = [];
    for (let i = 0; i < 6; i++) {
      const w = rnd.int(50, 110), c = Art.canvas(w + 8, 34), cx = c.getContext('2d');
      const col = th.night ? 'rgba(200,190,255,0.35)' : id === 'caldera' ? 'rgba(120,80,100,0.55)' : 'rgba(255,255,255,0.92)';
      for (let k = 0; k < 5; k++) { Art.E(cx, 10 + k * (w - 12) / 4, 22 - (k % 2 ? 6 : 0), 12, 9); cx.fillStyle = col; cx.fill(); }
      cx.fillRect(10, 22, w - 12, 9);
      clouds.push({ c, x: rnd() * 1400, y: rnd.range(14, 120), v: rnd.range(3, 9) });
    }
    return { far, mid, clouds, FH, MH };
  }

  /* ---------------------------------------------------------------- terrain */
  const PLAT = {
    wood: { top: '#7ed957', body: '#b57a4a', edge: '#5cb843' },
    log: { top: '#8fd36b', body: '#9a6a42', edge: '#6a4a2a' },
    coral: { top: '#ffe6a8', body: '#ff9a8a', edge: '#e8786a' },
    ice: { top: '#ffffff', body: '#a8dcff', edge: '#7fb8e8' },
    stone: { top: '#b8a8d8', body: '#6a5a8a', edge: '#4a3e6a' },
    obsidian: { top: '#7a5a5a', body: '#3a2a30', edge: '#5a3a3e' },
  };
  function drawPlatform(ctx, p, th, rnd) {
    const st = PLAT[th.plat] || PLAT.wood, x = p.x, y = p.y, w = p.w;
    if (p.deco === 'stage') {
      Art.rr(ctx, x, y, w, 10, 3); ctx.fillStyle = Art.lg(ctx, 0, y, 0, y + 10, '#e8c8a0', '#b89070'); ctx.fill();
      ctx.fillStyle = '#9a7050'; ctx.fillRect(x + 10, y + 10, 6, 36); ctx.fillRect(x + w - 16, y + 10, 6, 36);
      return;
    }
    const bodyH = 14;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - 4, y + bodyH - 4);
    ctx.quadraticCurveTo(x + w * 0.5, y + bodyH + 8, x + 4, y + bodyH - 4); ctx.closePath();
    ctx.fillStyle = Art.lg(ctx, 0, y, 0, y + bodyH + 6, st.body, U.shade(st.body, -0.35)); ctx.fill();
    for (let i = 0; i < w / 18; i++) { const px = x + 8 + rnd() * (w - 16), py = y + 6 + rnd() * 6; ctx.fillStyle = U.shade(st.body, rnd() < 0.5 ? 0.12 : -0.15); ctx.fillRect(px, py, 2 + rnd() * 3, 2); }
    if (th.plat === 'obsidian') { ctx.strokeStyle = '#ff7a3a'; ctx.lineWidth = 1; for (let i = 0; i < w / 60; i++) { const px = x + 10 + rnd() * (w - 20); ctx.beginPath(); ctx.moveTo(px, y + 5); ctx.lineTo(px + 4, y + 9); ctx.lineTo(px + 1, y + 13); ctx.stroke(); } }
    if (th.plat === 'ice') { for (let i = 0; i < w / 22; i++) { const px = x + 6 + rnd() * (w - 12), h = 4 + rnd() * 7; Art.tri(ctx, [px - 2, y + bodyH - 3], [px, y + bodyH - 3 + h], [px + 2, y + bodyH - 3], '#d8f2ff'); } }
    if (th.plat === 'log') { Art.E(ctx, x + 3, y + 6, 4, 6.5); ctx.fillStyle = '#c99a6a'; ctx.fill(); Art.E(ctx, x + w - 3, y + 6, 4, 6.5); ctx.fill(); }
    if (th.plat === 'stone') { ctx.fillStyle = U.shade(st.body, -0.2); for (let bx = x + 16; bx < x + w - 8; bx += 22) ctx.fillRect(bx, y + 4, 1, 8); }
    ctx.fillStyle = st.top; Art.rr(ctx, x - 2, y - 2, w + 4, 6, 3); ctx.fill();
    ctx.fillStyle = U.shade(st.top, 0.25); ctx.fillRect(x + 2, y - 1, w - 4, 1);
    ctx.fillStyle = st.edge; for (let bx = x; bx < x + w; bx += 6) ctx.fillRect(bx + 2, y + 3, 3, 1 + ((bx / 6) % 2));
    if (th.plat === 'wood' || th.plat === 'log') {
      for (let i = 0; i < w / 40; i++) { const px = x + 6 + rnd() * (w - 12); ctx.fillStyle = '#5cb843'; ctx.fillRect(px, y - 4, 1, 3); ctx.fillRect(px + 2, y - 5, 1, 4); }
    }
  }
  function drawRope(ctx, r) {
    ctx.strokeStyle = '#a8784a'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(r.x, r.y1); ctx.lineTo(r.x, r.y2); ctx.stroke();
    ctx.strokeStyle = '#d4a46a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(r.x - 0.5, r.y1); ctx.lineTo(r.x - 0.5, r.y2); ctx.stroke();
    for (let y = r.y1 + 6; y < r.y2; y += 9) { Art.E(ctx, r.x, y, 2, 1.4); ctx.fillStyle = '#8a5a34'; ctx.fill(); }
    Art.E(ctx, r.x, r.y2 + 1, 2.2, 2.6); ctx.fillStyle = '#8a5a34'; ctx.fill();
  }
  function drawHouse(ctx, x, gy, w, h, wall, roof, rnd, sign) {
    const y = gy - h;
    ctx.fillStyle = Art.lg(ctx, x, 0, x + w, 0, U.shade(wall, 0.12), U.shade(wall, -0.12)); ctx.fillRect(x, y, w, h);
    for (let i = 0; i < h / 10; i++) { ctx.fillStyle = U.shade(wall, -0.06); ctx.fillRect(x, y + i * 10 + 9, w, 1); }
    ctx.beginPath(); ctx.moveTo(x - 10, y + 2); ctx.lineTo(x + w / 2, y - h * 0.6); ctx.lineTo(x + w + 10, y + 2); ctx.closePath();
    ctx.fillStyle = Art.lg(ctx, 0, y - h * 0.6, 0, y, U.shade(roof, 0.2), U.shade(roof, -0.15)); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.moveTo(x - 10, y + 2); ctx.lineTo(x + w / 2, y - h * 0.6); ctx.lineTo(x + w + 10, y + 2); ctx.closePath(); ctx.clip();
    for (let k = 0; k < 6; k++) { ctx.strokeStyle = U.shade(roof, -0.22); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 10, y - k * 7); ctx.lineTo(x + w + 10, y - k * 7); ctx.stroke(); }
    ctx.restore();
    const dw = 16; Art.rr(ctx, x + w / 2 - dw / 2, gy - 26, dw, 26, [8, 8, 0, 0]); ctx.fillStyle = '#8a5a34'; ctx.fill(); Art.fe(ctx, x + w / 2 + 4, gy - 13, 1.4, 1.4, '#ffd36b');
    for (const wx of [x + 10, x + w - 26]) { Art.rr(ctx, wx, y + 14, 16, 14, 2); ctx.fillStyle = '#fff6c0'; ctx.fill(); ctx.fillStyle = '#c0905a'; ctx.fillRect(wx + 7.5, y + 14, 1, 14); ctx.fillRect(wx, y + 20.5, 16, 1); ctx.fillStyle = '#ff9ec7'; for (let fx = 0; fx < 16; fx += 4) Art.fe(ctx, wx + fx + 2, y + 30, 2, 1.8, rnd() < 0.5 ? '#ff9ec7' : '#ffe35a'); }
    if (sign) { Art.rr(ctx, x + w / 2 - 22, y - 6, 44, 13, 3); ctx.fillStyle = '#fff2d8'; ctx.fill(); ctx.strokeStyle = '#8a5a34'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = '#6a3a24'; ctx.font = 'bold 8px Fredoka, Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(sign, x + w / 2, y + 3.5); }
  }
  function decoAt(ctx, kind, x, gy, rnd, th) {
    switch (kind) {
      case 'flowers': for (let i = 0; i < 3; i++) { const fx = x + i * 4, c = U.pick(['#ff9ec7', '#ffe35a', '#ffffff', '#b48cff']); ctx.fillStyle = '#4fae4f'; ctx.fillRect(fx, gy - 5, 1, 5); Art.fe(ctx, fx, gy - 6, 1.8, 1.6, c); Art.fe(ctx, fx, gy - 6, 0.6, 0.6, '#ffcf3f'); } break;
      case 'mushrooms': Art.rr(ctx, x - 1.5, gy - 5, 3, 5, 1); ctx.fillStyle = '#fff2e0'; ctx.fill(); ctx.beginPath(); ctx.arc(x, gy - 5, 4.5, Math.PI, 0); ctx.fillStyle = U.pick(['#ff6b6b', '#ffbf47', '#b48cff']); ctx.fill(); Art.fe(ctx, x - 1.5, gy - 7, 0.9, 0.9, '#fff'); break;
      case 'shells': if (rnd() < 0.5) Art.star(ctx, x, gy - 3, 3.5, 1.6, 5, '#ffa14a'); else { ctx.beginPath(); ctx.arc(x, gy, 4, Math.PI, 0); ctx.fillStyle = '#ffd6e6'; ctx.fill(); } break;
      case 'pines': pine(ctx, x, gy, 1, '#5a9a7a', true); break;
      case 'pillars': ctx.fillStyle = '#8a7ab0'; ctx.fillRect(x - 3, gy - 14, 6, 14); ctx.fillStyle = '#a89ad0'; ctx.fillRect(x - 5, gy - 16, 10, 3); break;
      case 'rocks': Art.E(ctx, x, gy - 2, 5, 3.5); ctx.fillStyle = '#5a4a4a'; ctx.fill(); ctx.fillStyle = '#ff7a3a'; ctx.fillRect(x - 1, gy - 3, 2, 1); break;
    }
  }

  function renderTerrain(def, L) {
    const th = def.theme, rnd = U.seeded(def.seed * 101 + 3);
    const c = Art.canvas(L.W, L.H), ctx = c.getContext('2d');
    const gy = L.gy;
    if (def.town) {
      const houses = [[250, 120, 70, '#fff2d8', '#ff8a9a', null], [380, 110, 64, '#ffe6f0', '#8fb8ff', null], [880, 130, 74, '#fff6e0', '#ffb347', 'SHOP'], [1180, 130, 72, '#f0e6ff', '#9a7ad8', 'FORGE'], [1460, 110, 66, '#e8fff0', '#7ec85a', null]];
      for (const [x, w, h, wall, roof, sign] of houses) drawHouse(ctx, x, gy, w, h, wall, roof, rnd, sign);
      ctx.fillStyle = '#a8c8e8'; Art.E(ctx, 640, gy - 4, 40, 9); ctx.fill();
      Art.rr(ctx, 600, gy - 14, 80, 12, 5); ctx.fillStyle = Art.lg(ctx, 0, gy - 14, 0, gy, '#e8e0f0', '#b8b0c8'); ctx.fill();
      Art.rr(ctx, 632, gy - 34, 16, 22, 4); ctx.fill(); Art.E(ctx, 640, gy - 36, 14, 4); ctx.fillStyle = '#9fe3ff'; ctx.fill();
      for (const lx of [170, 540, 820, 1120, 1400]) { ctx.fillStyle = '#5a4a6a'; ctx.fillRect(lx - 1.5, gy - 40, 3, 40); Art.rr(ctx, lx - 5, gy - 50, 10, 11, 3); ctx.fillStyle = '#fff2a0'; ctx.fill(); ctx.strokeStyle = '#5a4a6a'; ctx.lineWidth = 1.2; ctx.stroke(); }
    }
    // ground
    ctx.fillStyle = Art.lg(ctx, 0, gy, 0, L.H, th.dirt, U.shade(th.dirt, -0.4)); ctx.fillRect(0, gy + 4, L.W, L.H - gy);
    for (let i = 0; i < L.W / 10; i++) { ctx.fillStyle = U.shade(th.dirt, rnd() < 0.5 ? 0.1 : -0.18); ctx.fillRect(rnd() * L.W, gy + 10 + rnd() * (L.H - gy - 14), 2 + rnd() * 4, 2); }
    if (def.town) { for (let x = 0; x < L.W; x += 14) { Art.rr(ctx, x + 1, gy + 1, 12, 6, 2); ctx.fillStyle = U.shade('#d8c8b8', (x / 14) % 2 ? -0.05 : 0.05); ctx.fill(); } }
    else {
      ctx.fillStyle = th.ground; Art.rr(ctx, 0, gy - 2, L.W, 8, 3); ctx.fill();
      ctx.fillStyle = U.shade(th.ground, 0.25); ctx.fillRect(0, gy - 1, L.W, 1);
      for (let x = 0; x < L.W; x += 5) { ctx.fillStyle = U.shade(th.ground, -0.18); ctx.fillRect(x, gy + 5, 3, 1 + (x / 5) % 2); }
    }
    if (th.deco) for (let x = 30; x < L.W - 30; x += rnd.int(40, 110)) if (!(def.town && x > 590 && x < 700)) decoAt(ctx, th.deco, x, gy, rnd, th);
    for (const p of L.plats) if (!p.ground) drawPlatform(ctx, p, th, rnd);
    for (const r of L.ropes) drawRope(ctx, r);
    // signposts by portals
    for (const p of L.portals) {
      const sx = p.x + (p.x < L.W / 2 ? 34 : -34);
      ctx.fillStyle = '#8a5a34'; ctx.fillRect(sx - 1.5, gy - 22, 3, 22);
      Art.rr(ctx, sx - 22, gy - 30, 44, 11, 2); ctx.fillStyle = '#fff2d8'; ctx.fill(); ctx.strokeStyle = '#8a5a34'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#6a3a24'; ctx.font = 'bold 7px Fredoka, Nunito, sans-serif'; ctx.textAlign = 'center';
      const nm = D.MAPS[p.to].name.split(' ')[0];
      ctx.fillText((p.x < L.W / 2 ? '◀ ' : '') + nm + (p.x < L.W / 2 ? '' : ' ▶'), sx, gy - 22);
    }
    return c;
  }

  function get(mapId) {
    let w = built.get(mapId);
    if (w) return w;
    const def = D.MAPS[mapId];
    const L = layout(def);
    w = Object.assign({ def, terrain: renderTerrain(def, L), back: makeBackdrop(def) }, L);
    built.set(mapId, w);
    return w;
  }

  /* ---------------------------------------------------------------- per-frame drawing */
  const skyCache = new Map();
  function drawBack(ctx, w, cam, vw, vh, t) {
    const th = w.def.theme;
    const key = w.def.id + ':' + vh;
    let sky = skyCache.get(key);
    if (!sky) { sky = ctx.createLinearGradient(0, 0, 0, vh); sky.addColorStop(0, th.sky[0]); sky.addColorStop(1, th.sky[1]); skyCache.set(key, sky); }
    ctx.fillStyle = sky; ctx.fillRect(0, 0, vw, vh);
    const B = w.back;
    if (th.night || w.def.id === 'caldera') {
      for (let i = 0; i < 60; i++) { const sx = (i * 137.5 + 20) % vw, sy = (i * 71.3) % (vh * 0.6); const a = 0.4 + 0.4 * Math.sin(t * 2 + i); ctx.fillStyle = `rgba(255,250,230,${a.toFixed(2)})`; ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1); }
    }
    if (th.aurora) {
      for (let b = 0; b < 3; b++) {
        ctx.beginPath();
        for (let x = 0; x <= vw; x += 8) ctx.lineTo(x, 40 + b * 18 + Math.sin(x * 0.012 + t * 0.4 + b) * 14);
        for (let x = vw; x >= 0; x -= 8) ctx.lineTo(x, 58 + b * 18 + Math.sin(x * 0.012 + t * 0.4 + b + 0.6) * 14);
        ctx.closePath(); ctx.fillStyle = ['rgba(140,255,200,0.18)', 'rgba(255,150,220,0.14)', 'rgba(140,180,255,0.16)'][b]; ctx.fill();
      }
    }
    const yFar = Math.round(vh - B.FH + (w.gy - (cam.y + vh)) * 0.22 + 30);
    for (const cl of B.clouds) {
      const cx = ((cl.x + t * cl.v - cam.x * 0.08) % (vw + 200) + vw + 200) % (vw + 200) - 120;
      ctx.drawImage(cl.c, Math.round(cx), Math.round(cl.y + (yFar - (vh - B.FH)) * 0.3));
    }
    const fx = -Math.round(cam.x * 0.15) % B.far.width;
    for (let x = fx; x < vw; x += B.far.width) ctx.drawImage(B.far, x, yFar);
    if (yFar + B.FH < vh) { ctx.fillStyle = th.far; ctx.fillRect(0, yFar + B.FH, vw, vh - yFar - B.FH); }
    const yMid = Math.round(vh - B.MH + (w.gy - (cam.y + vh)) * 0.45 + 34);
    const mx = -Math.round(cam.x * 0.38) % B.mid.width;
    for (let x = mx; x < vw; x += B.mid.width) ctx.drawImage(B.mid, x, yMid);
    if (yMid + B.MH < vh) { ctx.fillStyle = U.shade(th.mid, -0.1); ctx.fillRect(0, yMid + B.MH, vw, vh - yMid - B.MH); }
    if (th.night) { ctx.fillStyle = 'rgba(30,20,70,0.18)'; ctx.fillRect(0, 0, vw, vh); }
    ctx.drawImage(w.terrain, Math.round(cam.x), Math.round(cam.y), vw, vh, 0, 0, vw, vh);
  }

  function drawPortal(ctx, p, cam, t) {
    const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y);
    for (let i = 0; i < 3; i++) {
      Art.E(ctx, x, y - 22, 13 - i * 3.5, 21 - i * 5);
      ctx.fillStyle = ['rgba(150,200,255,0.35)', 'rgba(190,150,255,0.45)', 'rgba(255,255,255,0.6)'][i]; ctx.fill();
    }
    for (let i = 0; i < 8; i++) {
      const a = t * 2.5 + i * Math.PI / 4;
      ctx.fillStyle = i % 2 ? '#ffffff' : '#c9b8ff';
      ctx.fillRect(Math.round(x + Math.cos(a) * 11), Math.round(y - 22 + Math.sin(a) * 18), 2, 2);
    }
    ctx.fillStyle = 'rgba(200,220,255,0.5)'; ctx.fillRect(x - 10, y - 2, 20, 2);
  }

  /* ---------------------------------------------------------------- ambient particles */
  function makeParticles(kind, vw, vh) {
    const n = kind === 'snow' ? 70 : 34;
    return Array.from({ length: n }, () => ({ x: Math.random() * vw, y: Math.random() * vh, s: Math.random(), p: Math.random() * 6.28 }));
  }
  function drawParticles(ctx, parts, kind, vw, vh, dt, t, cam) {
    for (const q of parts) {
      switch (kind) {
        case 'petal': q.x += (12 + q.s * 14) * dt; q.y += (10 + q.s * 10) * dt; ctx.fillStyle = q.s < 0.5 ? '#ffb3d0' : '#ffd8e8'; ctx.fillRect(Math.round(q.x), Math.round(q.y + Math.sin(t * 2 + q.p) * 3), 2, 1 + (q.s > 0.7)); break;
        case 'firefly': { q.x += Math.sin(t + q.p) * 8 * dt; q.y += Math.cos(t * 0.7 + q.p) * 6 * dt; const a = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2 + q.p * 3)); ctx.fillStyle = `rgba(255,240,140,${a.toFixed(2)})`; ctx.fillRect(Math.round(q.x), Math.round(q.y), 2, 2); break; }
        case 'bubble': q.y -= (10 + q.s * 16) * dt; q.x += Math.sin(t * 2 + q.p) * 6 * dt; ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(Math.round(q.x), Math.round(q.y), 1.5 + q.s * 1.5, 0, 6.28); ctx.stroke(); break;
        case 'snow': q.y += (14 + q.s * 22) * dt; q.x += Math.sin(t + q.p) * 10 * dt; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(Math.round(q.x), Math.round(q.y), 1 + (q.s > 0.6), 1 + (q.s > 0.6)); break;
        case 'wisp': q.y -= (4 + q.s * 6) * dt; q.x += Math.sin(t * 0.8 + q.p) * 6 * dt; ctx.fillStyle = `rgba(190,170,255,${(0.3 + q.s * 0.4).toFixed(2)})`; ctx.fillRect(Math.round(q.x), Math.round(q.y), 2, 2); break;
        case 'ember': q.y -= (12 + q.s * 18) * dt; q.x += Math.sin(t * 1.5 + q.p) * 8 * dt; ctx.fillStyle = q.s > 0.5 ? '#ffb347' : '#ff6a3a'; ctx.fillRect(Math.round(q.x), Math.round(q.y), 1 + (q.s > 0.8), 1 + (q.s > 0.8)); break;
      }
      if (q.y > vh + 4) { q.y = -4; q.x = Math.random() * vw; }
      if (q.y < -6) { q.y = vh + 4; q.x = Math.random() * vw; }
      if (q.x > vw + 4) q.x = -4; if (q.x < -6) q.x = vw + 4;
    }
  }

  return { get, drawBack, drawPortal, makeParticles, drawParticles, GROUND_H, TIER };
})();
