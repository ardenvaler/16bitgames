'use strict';
// Small shared helpers: math, randomness, colour.
const U = (() => {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const chance = p => Math.random() < p;
  const approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));
  const sign = v => (v < 0 ? -1 : 1);

  // xorshift; deterministic layouts and music per map
  function seeded(seed) {
    let s = (seed >>> 0) || 1;
    const next = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    next.range = (a, b) => a + next() * (b - a);
    next.int = (a, b) => Math.floor(a + next() * (b - a + 1));
    next.pick = arr => arr[Math.floor(next() * arr.length)];
    return next;
  }
  function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  const rgbCache = new Map();
  function rgb(hex) {
    let v = rgbCache.get(hex);
    if (v) return v;
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, v);
    return v;
  }
  const toHex = c => '#' + c.map(x => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, '0')).join('');
  function mix(a, b, t) { const A = rgb(a), B = rgb(b); return toHex([lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]); }
  // amt > 0 lightens toward white, amt < 0 darkens toward a plum shadow (warmer than black, reads cuter)
  function shade(c, amt) { return amt >= 0 ? mix(c, '#ffffff', amt) : mix(c, '#24142e', -amt); }
  function rgba(hex, a) { const c = rgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

  const fmt = n => Math.floor(n).toLocaleString('en-US');
  function fmtTime(s) { s = Math.max(0, Math.ceil(s)); const m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); }
  function weighted(list, weightFn) {
    let total = 0; for (const it of list) total += weightFn(it);
    let r = Math.random() * total;
    for (const it of list) { r -= weightFn(it); if (r <= 0) return it; }
    return list[list.length - 1];
  }
  let uidN = Date.now() % 100000;
  const uid = () => (++uidN).toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  const rectHit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  return { clamp, lerp, rand, randi, pick, chance, approach, sign, seeded, hashStr, rgb, toHex, mix, shade, rgba, fmt, fmtTime, weighted, uid, rectHit };
})();
