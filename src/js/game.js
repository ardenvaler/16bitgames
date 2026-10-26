'use strict';
// Game state, player progression, combat, monsters, drops, quests and world rendering.
const Game = (() => {
  const GRAV = 980, JUMP_V = 352, WALK = 118, CLIMB = 72;
  const PW = 14, PH = 34;
  const G = {
    settings: null, pl: null, P: null, w: null, mapId: null,
    mobs: [], drops: [], projs: [], fx: [], parts: [], texts: [], events: [], npcs: [], extras: [],
    cam: { x: 0, y: 0 }, t: 0, buffs: {}, cds: {}, timers: {}, shake: 0, banner: null, bossBar: null,
    ambient: null, ambientKind: null, view: { w: 640, h: 360, scale: 2 }, lastHit: null, paused: false, summons: 0,
  };

  /* ================================================================ items */
  function makeItem(id, rar = 0) {
    const base = D.ITEMS[id];
    const inst = { uid: U.uid(), id, enh: 0, rar, bonus: {} };
    const R = D.RARITY[rar];
    if (R.bonus && (base.kind === 'weapon' || base.kind === 'armor')) {
      const fam = base.fam || (G.pl && D.JOBS[G.pl.job].fam) || 'warrior';
      const main = D.JOBS[fam].main, sub = D.JOBS[fam].sub;
      const pool = [main, main, sub, 'hp', 'crit', base.kind === 'weapon' ? 'atk' : 'def'];
      for (let i = 0; i < R.bonus + (rar === 3 ? 1 : 0); i++) {
        const k = U.pick(pool);
        const amt = k === 'hp' ? Math.round(base.lv * 2 + 10) : k === 'crit' ? 1 + Math.floor(base.lv / 20) : k === 'atk' || k === 'def' ? 1 + Math.floor(base.lv / 8) : 1 + Math.floor(base.lv / 7);
        inst.bonus[k] = (inst.bonus[k] || 0) + amt * (rar === 3 ? 2 : 1);
      }
    }
    return inst;
  }
  function itemStats(inst) {
    const b = D.ITEMS[inst.id], R = D.RARITY[inst.rar || 0], em = D.enhMul(inst.enh || 0);
    const s = { atk: 0, def: 0, hp: 0, mp: 0, str: 0, dex: 0, int: 0, wis: 0, crit: 0, speed: 0 };
    if (b.atk) s.atk += Math.round(b.atk * R.mul * (b.kind === 'weapon' ? em : 1));
    if (b.def) s.def += Math.round(b.def * R.mul * em);
    if (b.hp) s.hp += Math.round(b.hp * R.mul * (1 + (inst.enh || 0) * 0.05));
    if (b.speed) s.speed += b.speed;
    if (b.stat) for (const [k, v] of Object.entries(b.stat)) s[k] += v + Math.floor((inst.enh || 0) / 2);
    if (b.bonus) for (const [k, v] of Object.entries(b.bonus)) s[k] += Math.round(v * (1 + (inst.enh || 0) * 0.08));
    for (const [k, v] of Object.entries(inst.bonus || {})) s[k] += v;
    if (b.kind === 'armor' && inst.enh) s.hp += inst.enh * 3;
    return s;
  }
  function itemName(inst) { const b = D.ITEMS[inst.id]; return (inst.enh ? `+${inst.enh} ` : '') + b.name; }
  function canEquip(inst) {
    const b = D.ITEMS[inst.id], pl = G.pl, job = D.JOBS[pl.job];
    if (pl.lv < b.lv) return { ok: false, why: `Requires level ${b.lv}.` };
    if (b.fam && b.fam !== job.fam) return { ok: false, why: `Only for ${D.JOBS[b.fam].name}s.` };
    return { ok: true };
  }
  function tabOf(id) { const k = D.ITEMS[id].kind; return k === 'use' ? 'use' : k === 'etc' ? 'etc' : 'equip'; }
  function addItem(id, n = 1, inst = null) {
    const tab = tabOf(id), arr = G.pl.inv[tab], base = D.ITEMS[id];
    if (tab === 'equip') {
      const i = arr.findIndex(x => !x);
      if (i < 0) { toast('Your Equip tab is full!'); return false; }
      arr[i] = inst || makeItem(id); UI.dirty('inv'); return true;
    }
    let left = n;
    for (const s of arr) if (s && s.id === id && s.n < (base.stack || 300)) { const a = Math.min(left, (base.stack || 300) - s.n); s.n += a; left -= a; if (!left) break; }
    while (left > 0) {
      const i = arr.findIndex(x => !x);
      if (i < 0) { toast(`Your ${tab === 'use' ? 'Use' : 'Etc'} tab is full!`); UI.dirty('inv'); return false; }
      const a = Math.min(left, base.stack || 300); arr[i] = { id, n: a }; left -= a;
    }
    UI.dirty('inv'); return true;
  }
  function countItem(id) { const tab = tabOf(id); let n = 0; for (const s of G.pl.inv[tab]) if (s && s.id === id) n += s.n || 1; return n; }
  function removeItem(id, n) {
    const arr = G.pl.inv[tabOf(id)];
    for (let i = 0; i < arr.length && n > 0; i++) { const s = arr[i]; if (s && s.id === id) { const a = Math.min(n, s.n); s.n -= a; n -= a; if (s.n <= 0) arr[i] = null; } }
    UI.dirty('inv');
  }

  /* ================================================================ player */
  function newPlayer(name, look) {
    const pl = {
      v: 1, name, look, job: 'beginner', lv: 1, exp: 0, ap: 0, sp: 0,
      base: { str: 5, dex: 4, int: 4, wis: 4 }, hp: 1, mp: 1, coins: 120,
      inv: { equip: Array(48).fill(null), use: Array(48).fill(null), etc: Array(48).fill(null) },
      eq: { weapon: null, hat: null, top: null, gloves: null, shoes: null, acc: null },
      skills: {}, hotbar: [{ t: 's', id: 'pebble' }, { t: 's', id: 'sprint' }, null, null, null, null, null, null, { t: 'i', id: 'p_red' }, { t: 'i', id: 'p_blue' }],
      quests: {}, visited: ['town'], map: 'town', kills: 0, playTime: 0, created: Date.now(), boss: {},
    };
    G.pl = pl;
    pl.eq.weapon = makeItem('w_sword_0'); pl.eq.top = makeItem('a_any_top_0'); pl.eq.shoes = makeItem('a_any_shoes_0');
    pl.inv.use[0] = { id: 'p_red', n: 15 }; pl.inv.use[1] = { id: 'p_blue', n: 6 }; pl.inv.use[2] = { id: 's_return', n: 1 };
    pl.inv.equip[0] = makeItem('w_wand_0'); pl.inv.equip[1] = makeItem('w_bow_0'); pl.inv.equip[2] = makeItem('w_mace_0');
    const s = calc(pl); pl.hp = s.maxHp; pl.mp = s.maxMp;
    return pl;
  }
  function jobChain(job) { const out = ['beginner']; const j = D.JOBS[job]; if (j.tier >= 1) out.push(j.fam); if (j.tier >= 2) out.push(job); return out; }
  function skillLv(id) { return (G.pl && G.pl.skills[id]) || 0; }

  function calc(pl = G.pl) {
    const job = D.JOBS[pl.job];
    const st = { ...pl.base };
    const s = { atk: 0, def: 0, hp: 0, mp: 0, crit: 5, critDmg: 50, speed: 0, jump: 0, dmgPct: 0, mastery: 0, hpPct: 0, mpPct: 0, mpRegen: 0, hpRegen: 0, dodge: 0, dmgTaken: 0, finalAtk: 0, potion: 0, healPct: 0, pierce: 0, mguard: 0, expPct: 0, atkPct: 0, noKnock: false };
    for (const inst of Object.values(pl.eq)) {
      if (!inst) continue;
      const is = itemStats(inst);
      s.atk += is.atk; s.def += is.def; s.hp += is.hp; s.mp += is.mp; s.crit += is.crit; s.speed += is.speed;
      for (const k of ['str', 'dex', 'int', 'wis']) st[k] += is[k];
    }
    const add = fx => { for (const [k, v] of Object.entries(fx)) { if (typeof v === 'boolean') s[k] = s[k] || v; else s[k] = (s[k] || 0) + v; } };
    for (const [id, L] of Object.entries(pl.skills)) { const sk = D.SKILLS[id]; if (sk && sk.kind === 'passive' && L > 0) add(sk.pas(L)); }
    for (const b of Object.values(G.buffs)) add(b.fx);
    const main = st[job.main], sub = st[job.sub];
    s.st = st;
    s.maxHp = Math.round((50 + job.hp * (pl.lv - 1) + st.str * 2 + s.hp) * (1 + s.hpPct / 100));
    s.maxMp = Math.round((20 + job.mp * (pl.lv - 1) + st.int * 1.5 + st.wis + s.mp) * (1 + s.mpPct / 100));
    const watk = pl.eq.weapon ? 0 : 4;
    const power = (s.atk + watk + 4) * (1 + main / 20 + sub / 90);
    s.maxDmg = power * (1 + (s.dmgPct + s.atkPct) / 100);
    s.minDmg = s.maxDmg * U.clamp(0.6 + s.mastery, 0.6, 0.92);
    s.defT = Math.round(s.def + st.str * 0.2);
    s.crit = Math.min(80, s.crit + st.dex * 0.04);
    const wb = pl.eq.weapon ? D.ITEMS[pl.eq.weapon.id] : null;
    s.wstyle = wb ? D.WTYPES[wb.wtype].style : 'melee';
    s.wtype = wb ? wb.wtype : null;
    s.aspd = wb ? wb.spd : 0.4;
    s.reach = wb ? D.WTYPES[wb.wtype].reach : 36;
    pl._s = s;
    return s;
  }
  const S = () => G.pl._s || calc();

  function gainExp(n, quiet) {
    const pl = G.pl;
    if (pl.lv >= D.MAX_LV) return;
    pl.exp += n;
    if (!quiet) UI.log(`+${U.fmt(n)} EXP`, 'exp');
    let leveled = false;
    while (pl.lv < D.MAX_LV && pl.exp >= D.expNeed(pl.lv)) {
      pl.exp -= D.expNeed(pl.lv); pl.lv++; pl.ap += 5;
      const tier = D.JOBS[pl.job].tier;
      if (tier > 0) pl.sp += 2; else if (pl.lv <= 10) pl.sp += 1;
      leveled = true;
    }
    if (pl.lv >= D.MAX_LV) pl.exp = 0;
    if (leveled) {
      const s = calc(); pl.hp = s.maxHp; pl.mp = s.maxMp;
      fx('levelup', G.P.x, G.P.y, { dur: 1.6 });
      Sound.sfx('levelup');
      G.banner = { text: `Level ${pl.lv}!`, sub: pl.lv === 10 && pl.job === 'beginner' ? 'Visit Pip the Job Master in Emberfall' : pl.lv === 30 && D.JOBS[pl.job].tier === 1 ? 'Pip has a trial for your second job' : 'You gained 5 AP' + (D.JOBS[pl.job].tier > 0 || pl.lv <= 10 ? ' and SP' : ''), t: 0, gold: true };
      UI.log(`Level up! You are now level ${pl.lv}.`, 'good');
      UI.dirty('all'); Main.save();
    }
    UI.dirty('hud');
  }

  function autoAp() {
    const pl = G.pl, job = D.JOBS[pl.job];
    while (pl.ap > 0) { const k = (pl.base[job.main] + pl.base[job.sub]) % 5 === 4 ? job.sub : job.main; pl.base[k]++; pl.ap--; }
    calc(); UI.dirty('all');
  }
  function addAp(k) { const pl = G.pl; if (pl.ap <= 0) return; pl.base[k]++; pl.ap--; calc(); UI.dirty('all'); Sound.sfx('click'); }

  function canLearn(sk) {
    const pl = G.pl, chain = jobChain(pl.job), cur = skillLv(sk.id);
    if (!chain.includes(sk.job)) return { ok: false, why: 'Not your job yet.' };
    if (cur >= sk.max) return { ok: false, why: 'Mastered.' };
    if (pl.sp <= 0) return { ok: false, why: 'No SP left.' };
    if (sk.req && skillLv(sk.req[0]) < sk.req[1]) return { ok: false, why: `Needs ${D.SKILLS[sk.req[0]].name} Lv ${sk.req[1]}.` };
    return { ok: true };
  }
  function learn(id) {
    const sk = D.SKILLS[id], c = canLearn(sk);
    if (!c.ok) { toast(c.why); Sound.sfx('error'); return; }
    const first = !skillLv(id);
    G.pl.skills[id] = skillLv(id) + 1; G.pl.sp--;
    if (first && sk.kind !== 'passive' && !G.pl.hotbar.some(h => h && h.t === 's' && h.id === id)) {
      const i = G.pl.hotbar.findIndex((h, j) => !h && j < 8);
      if (i >= 0) { G.pl.hotbar[i] = { t: 's', id }; UI.log(`${sk.name} placed on key ${(i + 1) % 10}.`, 'info'); }
    }
    calc(); Sound.sfx('learn'); UI.dirty('all');
  }

  function equip(tab, idx) {
    const pl = G.pl, inst = pl.inv[tab][idx];
    if (!inst) return;
    const b = D.ITEMS[inst.id];
    const c = canEquip(inst);
    if (!c.ok) { toast(c.why); Sound.sfx('error'); return; }
    const prev = pl.eq[b.slot];
    pl.eq[b.slot] = inst; pl.inv[tab][idx] = prev || null;
    afterGear(); Sound.sfx('equip');
  }
  function unequip(slot) {
    const pl = G.pl, inst = pl.eq[slot];
    if (!inst) return;
    const i = pl.inv.equip.findIndex(x => !x);
    if (i < 0) { toast('Your Equip tab is full!'); return; }
    pl.inv.equip[i] = inst; pl.eq[slot] = null; afterGear(); Sound.sfx('equip');
  }
  function afterGear() { const s = calc(); G.pl.hp = Math.min(G.pl.hp, s.maxHp); G.pl.mp = Math.min(G.pl.mp, s.maxMp); G.P && (G.P.spr = null); UI.dirty('all'); }

  function playerVis(pl = G.pl) {
    const eq = pl.eq, top = eq.top && D.ITEMS[eq.top.id], hat = eq.hat && D.ITEMS[eq.hat.id];
    const w = eq.weapon && D.ITEMS[eq.weapon.id];
    return {
      style: top ? (top.fam || 'beginner') : 'beginner',
      top: top ? top.col : ['#f4f0e8', '#c8b8a0'],
      hat: hat ? { style: hat.fam ? Art.HATSTYLE[hat.fam] : 'beanie', col: hat.col, tier: hat.tier } : null,
      gloves: eq.gloves ? D.ITEMS[eq.gloves.id].col[0] : null,
      shoes: eq.shoes ? D.ITEMS[eq.shoes.id].col[0] : '#8a5a3a',
      weapon: w ? { wtype: w.wtype, col: w.col } : null,
    };
  }

  /* ================================================================ map */
  function changeMap(mapId, from) {
    const pl = G.pl;
    G.mapId = mapId; pl.map = mapId;
    G.w = World.get(mapId);
    G.mobs = []; G.drops = []; G.projs = []; G.fx = []; G.parts = []; G.texts = []; G.events = []; G.bossBar = null; G.summons = 0;
    const w = G.w;
    let x = w.W / 2, y = w.gy;
    if (from === 'town' || !from) { if (w.def.town) { x = 300; } }
    else { const p = w.portals.find(q => q.to === from); if (p) { x = p.x + (p.x < w.W / 2 ? 30 : -30); y = p.y; } }
    G.P = { x, y, vx: 0, vy: 0, dir: 1, onGround: true, plat: w.plats[0], rope: null, invuln: 1.2, actT: 0, actDur: 0, anim: null, animT: 0, knockT: 0, dead: false, deadT: 0, dropT: 0, dropPlat: null, leapT: 0, leaped: false, dashT: 0, dashHit: null, spr: null, ghosts: [], regenT: 0, comboT: 0 };
    if (!pl.visited.includes(mapId)) pl.visited.push(mapId);
    for (const sp of w.spawns) { sp.mob = null; sp.cd = 0; }
    if (!w.def.town) { for (const sp of w.spawns) spawnAt(sp); }
    G.npcs = []; G.extras = [];
    if (w.def.town) {
      for (const n of Object.values(D.NPCS)) G.npcs.push({ ...n, y: w.gy });
      makeTownFolk();
    }
    const T = G.timers[mapId] || (G.timers[mapId] = { mini: 45, boss: 150 });
    if (w.def.town) delete G.timers[mapId];
    G.ambientKind = w.def.theme.parts; G.ambient = World.makeParticles(G.ambientKind, G.view.w, G.view.h);
    G.banner = { text: w.def.name, sub: w.def.lv, t: 0 };
    G.cam.x = U.clamp(x - G.view.w / 2, 0, Math.max(0, w.W - G.view.w)); G.cam.y = U.clamp(y - G.view.h * 0.66, 0, Math.max(0, w.H - G.view.h));
    Sound.bgm(w.def.bgm);
    UI.dirty('all'); UI.onMap();
    Main.save();
  }

  function makeTownFolk() {
    const names = ['MochiKnight', 'xXSnailSlayerXx', 'PudingLover', 'Hanabi', 'StarryArcher', 'TofuMage', 'Kkomi', 'BunBun99'];
    const lines = ['LF party for Honeywood!', 'selling +7 Iron Sabre, PM me', 'anyone seen Aurora Seal today?', 'brb getting snacks', 'how do i get to Frostpuff Peaks?', 'gg Ignis down!!', 'Pudding Jelly 8c each, cheap!', 'enhance success +8!! (^o^)/', 'cleric LF Count Nibbles run', 'who wants to duel', 'nice hat', 'this music is so cozy'];
    const hairs = ['#6a4a3a', '#ffd36b', '#ff9ac0', '#7ab8ff', '#2a2a3a', '#c0503a', '#b48cff', '#7ee08a'];
    const fams = ['warrior', 'mage', 'cleric', 'archer'];
    const n = 4;
    for (let i = 0; i < n; i++) {
      const fam = fams[i % 4], t = U.randi(0, 4);
      const top = D.ITEMS[`a_${fam}_top_${t}`], hat = D.ITEMS[`a_${fam}_hat_${t}`];
      const wt = D.WTYPES; const wtype = Object.keys(wt).filter(k => wt[k].fam === fam)[U.randi(0, 1)];
      G.extras.push({
        name: names[(i * 3 + U.randi(0, 7)) % names.length] + (U.chance(0.5) ? U.randi(1, 99) : ''),
        look: { skin: U.pick(['#ffe0c8', '#ffd8b8', '#e8b890', '#f0c8a0']), hair: U.pick(hairs), hairStyle: U.randi(0, 5), eyes: U.pick(['#3a6ab8', '#c05a8a', '#3a8a5a', '#8a5ab8']) },
        vis: { style: fam, top: top.col, hat: U.chance(0.7) ? { style: Art.HATSTYLE[fam], col: hat.col, tier: t } : null, shoes: top.col[0], gloves: null, weapon: { wtype, col: D.TIER_COL[U.randi(1, 6)] } },
        x: U.rand(200, 1500), y: G.w.gy, dir: 1, vx: 0, t: U.rand(1, 4), walk: false, bubble: null, bubbleT: U.rand(4, 18), lines,
      });
    }
  }

  /* ================================================================ monsters */
  function mobAt(def, x, y, extra = {}) {
    const spr = Art.mob(def);
    return Object.assign({ def, spr, x, y, vx: 0, vy: 0, dir: U.chance(0.5) ? 1 : -1, hp: def.hp, maxHp: def.hp, st: U.rand(0.5, 2.5), walking: false,
      anim: Math.random() * 2, hurtT: 0, atkT: 0, aggro: 0, frozen: 0, stun: 0, burn: 0, burnT: 0, dead: false, deadT: 0, fade: 0,
      homeX: x, homeY: y, phase: Math.random() * 6.28, cd: U.rand(1.5, 3.5), w: spr.bw, h: spr.bh, onGround: !def.fly, skT: 4, tele: null, hopT: U.rand(0.4, 1.2) }, extra);
  }
  function spawnAt(sp) {
    const def = pickMobFor(sp);
    if (!def) return;
    const m = mobAt(def, sp.x, sp.y, { spawn: sp, plat: sp.plat });
    if (def.fly) { m.homeY = sp.y; }
    sp.mob = m; G.mobs.push(m);
  }
  function pickMobFor(sp) {
    const ids = G.w.def.mobs || [];
    const list = ids.map(id => D.MOBS[id]).filter(d => sp.air ? d.fly : !d.fly);
    if (!list.length) return null;
    const sorted = list.slice().sort((a, b) => a.lv - b.lv);
    const maxTier = Math.max(1, ...G.w.plats.map(p => p.tier || 0));
    const want = (sp.tier / maxTier) * (sorted.length - 1);
    return U.weighted(sorted, d => 1 / (1 + Math.abs(sorted.indexOf(d) - want) * 0.9));
  }
  function spawnBoss(kind) {
    const w = G.w, id = w.def[kind];
    if (!id || G.mobs.some(m => m.def.id === id && !m.dead)) return;
    const def = D.MOBS[id];
    const x = U.clamp(G.P.x + (G.P.x < w.W / 2 ? 220 : -220), 200, w.W - 200);
    const y = def.fly ? w.gy - 90 : w.gy;
    const m = mobAt(def, x, y, { plat: w.plats[0], aggro: 999, boss: true });
    m.fade = 0; G.mobs.push(m);
    G.bossBar = m;
    fx('poof', x, y - m.h / 2, { r: m.w });
    G.shake = 8;
    Sound.sfx('roar');
    G.banner = { text: def.name, sub: kind === 'boss' ? 'BOSS appeared!' : 'Mini-boss appeared!', t: 0, warn: true };
    UI.log(`${def.name} has appeared!`, 'warn');
    if (kind === 'boss') Sound.bgm('boss');
  }

  function surfaceAt(x, y, below = 6) {
    let best = null;
    for (const p of G.w.plats) if (x >= p.x - 2 && x <= p.x + p.w + 2 && p.y >= y - below && (!best || p.y < best.y)) best = p;
    return best;
  }

  function updateMob(m, dt) {
    const P = G.P, def = m.def;
    m.anim += dt;
    if (m.dead) { m.deadT += dt; return; }
    if (m.fade < 1) m.fade = Math.min(1, m.fade + dt * 2.5);
    m.hurtT -= dt; m.atkT -= dt; m.aggro -= dt;
    if (m.burn > 0) { m.burn -= dt; m.burnT -= dt; if (m.burnT <= 0) { m.burnT = 0.6; hitMob(m, { d: Math.max(1, Math.round(m.burnDmg)), crit: false }, { dot: true }); if (m.dead) return; } }
    if (m.frozen > 0) { m.frozen -= dt; return; }
    if (m.stun > 0) { m.stun -= dt; return; }
    const spd = 34 * def.spd * (m.boss ? 1.25 : 1);
    const dx = P.x - m.x, dy = P.y - m.y, dist = Math.hypot(dx, dy);
    const aggro = m.aggro > 0 && !P.dead;
    if (m.boss) bossAI(m, dt, dx, dist);
    if (def.fly) {
      m.phase += dt;
      let tx = m.homeX + Math.sin(m.phase * 0.6) * 60, ty = m.homeY + Math.sin(m.phase * 1.7) * 10;
      if (aggro || (m.boss && dist < 500)) { tx = P.x - Math.sign(dx || 1) * (def.beh === 'shoot' ? 90 : 0); ty = P.y - 30 + Math.sin(m.phase * 2) * 10; }
      if (def.beh === 'float') ty = m.homeY + Math.sin(m.phase * 1.2) * 16;
      const fs = (aggro ? 1.4 : 0.8) * spd;
      m.x += U.clamp(tx - m.x, -fs * dt, fs * dt); m.y += U.clamp(ty - m.y, -fs * dt, fs * dt);
      if (Math.abs(tx - m.x) > 1) m.dir = tx > m.x ? 1 : -1;
      if (!aggro && Math.hypot(m.x - m.homeX, m.y - m.homeY) > 260) { m.x += Math.sign(m.homeX - m.x) * spd * dt; }
      m.x = U.clamp(m.x, 20, G.w.W - 20); m.y = U.clamp(m.y, 40, G.w.gy - 8);
      m.walking = true;
    } else {
      const plat = m.plat || surfaceAt(m.x, m.y);
      const sameLevel = Math.abs(dy) < 40;
      m.st -= dt;
      if (aggro && sameLevel && def.beh !== 'shoot') { m.dir = dx > 0 ? 1 : -1; m.walking = Math.abs(dx) > 6; }
      else if (m.st <= 0) { m.st = U.rand(1, 3); m.walking = U.chance(0.6); m.dir = U.chance(0.5) ? 1 : -1; }
      let vx = m.walking ? m.dir * spd * (aggro ? 1.5 : 1) : 0;
      if (def.beh === 'hop') {
        if (m.onGround) { vx = 0; m.hopT -= dt; if (m.walking && m.hopT <= 0) { m.vy = -U.rand(150, 210); m.onGround = false; m.hopT = U.rand(0.5, 1.1); } }
        else vx = m.dir * spd * (aggro ? 1.9 : 1.4);
      }
      if (def.beh === 'shoot' && (aggro || dist < 220) && sameLevel) { vx = 0; m.dir = dx > 0 ? 1 : -1; }
      m.vx = U.approach(m.vx, vx, 600 * dt);
      m.x += m.vx * dt;
      if (plat) {
        const lo = plat.x + 10, hi = plat.x + plat.w - 10;
        if (m.x < lo) { m.x = lo; m.dir = 1; m.st = Math.min(m.st, 0.6); }
        if (m.x > hi) { m.x = hi; m.dir = -1; m.st = Math.min(m.st, 0.6); }
        if (!m.onGround) { m.vy += GRAV * dt; m.y += m.vy * dt; if (m.y >= plat.y) { m.y = plat.y; m.vy = 0; m.onGround = true; } }
        else m.y = plat.y;
      }
    }
    // ranged attack
    if ((def.beh === 'shoot' || def.proj) && !m.boss && !P.dead) {
      m.cd -= dt;
      if (m.cd <= 0 && (aggro || dist < 210) && dist < 260) {
        m.cd = U.rand(2.2, 3.4);
        mobShoot(m, def.proj || 'ink', Math.atan2((P.y - 16) - (m.y - m.h / 2), dx));
        m.atkT = 0.4;
      }
    }
    // contact damage
    if (!P.dead && P.invuln <= 0 && Math.abs(dx) < (m.w * 0.42 + PW * 0.4) && P.y - PH < m.y - 4 && P.y > m.y - m.h + 6) {
      hurtPlayer(def.atk, m.x);
    }
  }
  function mobShoot(m, kind, ang, speed = 150) {
    G.projs.push({ owner: 'm', kind, x: m.x + m.dir * m.w * 0.3, y: m.y - m.h * 0.55, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: 3, dmg: Math.round(m.def.atk * 0.9), r: 5 });
  }

  function bossAI(m, dt, dx, dist) {
    m.skT -= dt * (m.hp < m.maxHp * 0.3 ? 1.5 : 1);
    if (m.tele) {
      m.tele.t -= dt;
      if (m.tele.t <= 0) { const t = m.tele; m.tele = null; bossSkill(m, t.kind, t); }
      return;
    }
    if (m.skT <= 0 && dist < 520) {
      const opts = ['barrage', 'summon', 'rain'];
      if (!m.def.fly) opts.push('stomp', 'stomp', 'charge');
      const kind = U.pick(opts);
      m.skT = U.rand(3.5, 5.5) * (m.def.rank === 'mini' ? 1.25 : 1);
      if (kind === 'stomp') { m.tele = { kind, t: 0.8 }; fx('warn', m.x, m.y, { r: 170, dur: 0.8 }); }
      else if (kind === 'rain') { const xs = Array.from({ length: m.def.rank === 'boss' ? 7 : 4 }, (_, i) => G.P.x + (i - 3) * 46 + U.rand(-12, 12)); m.tele = { kind, t: 0.9, xs }; for (const x of xs) fx('warn', x, (surfaceAt(x, G.P.y - 10) || G.w.plats[0]).y, { r: 18, dur: 0.9 }); }
      else { m.tele = { kind, t: 0.5 }; fx('alert', m.x, m.y - m.h - 6, { dur: 0.5 }); }
    }
  }
  function bossSkill(m, kind, t) {
    const P = G.P;
    if (kind === 'stomp') {
      fx('shock', m.x, m.y, { rx: 170, dur: 0.45, col: '#ffe0a0' }); G.shake = 7; Sound.sfx('smash');
      if (P.onGround && Math.abs(P.x - m.x) < 175 && Math.abs(P.y - m.y) < 20) hurtPlayer(Math.round(m.def.atk * 1.3), m.x, true);
    } else if (kind === 'barrage') {
      const base = Math.atan2((P.y - 16) - (m.y - m.h / 2), P.x - m.x);
      const n = m.def.rank === 'boss' ? 7 : 5;
      for (let i = 0; i < n; i++) mobShoot(m, m.def.proj || (m.def.elem === 'fire' ? 'ember' : m.def.elem === 'ice' ? 'icicle' : m.def.undead ? 'wispfire' : 'boulder'), base + (i - (n - 1) / 2) * 0.16, 170);
      Sound.sfx('shoot');
    } else if (kind === 'summon') {
      const ids = G.w.def.mobs.filter(id => !D.MOBS[id].fly).slice(0, 5);
      const cap = G.mobs.filter(x => x.summoned && !x.dead).length;
      for (let i = 0; i < 3 && cap + i < 8; i++) {
        const d = D.MOBS[U.pick(ids)];
        const x = U.clamp(m.x + U.rand(-90, 90), 40, G.w.W - 40);
        const mm = mobAt(d, x, G.w.gy, { plat: G.w.plats[0], summoned: true, aggro: 20, fade: 0 });
        G.mobs.push(mm); fx('poof', x, G.w.gy - 10, { r: 14 });
      }
      Sound.sfx('poof');
    } else if (kind === 'rain') {
      for (const x of t.xs) G.projs.push({ owner: 'm', kind: m.def.elem === 'fire' ? 'ember' : m.def.elem === 'ice' ? 'icicle' : 'boulder', x, y: G.cam.y - 10, vx: 0, vy: 260, life: 3, dmg: Math.round(m.def.atk * 1.1), r: 7, fall: true });
    } else if (kind === 'charge') {
      m.vx = Math.sign(P.x - m.x) * 260; m.dir = Math.sign(P.x - m.x) || 1; m.walking = true; m.aggro = 99;
    }
  }

  /* ================================================================ combat */
  function rollDamage(mult, m, o = {}) {
    const s = S();
    let d = U.rand(s.minDmg, s.maxDmg) * mult;
    const crit = Math.random() * 100 < s.crit + (o.crit || 0);
    if (crit) d *= 1.5 + s.critDmg / 100 - 0.5;
    const me = m.def.elem;
    if (o.elem) {
      if (me && D.ELEM_WEAK[me] === o.elem) d *= 1.5;
      else if (me && me === o.elem) d *= 0.5;
      if (o.elem === 'holy' && m.def.undead) d *= 1.6;
    }
    d -= m.def.def * 0.6;
    return { d: Math.max(1, Math.round(d * U.rand(0.97, 1.03))), crit };
  }
  function hitMob(m, r, o = {}) {
    if (m.dead) return;
    m.hp -= r.d; m.hurtT = 0.25; m.aggro = 12;
    G.lastHit = m;
    if (!o.dot) {
      if (!m.boss && !m.def.fly && o.knock !== false) m.vx = (o.dir || Math.sign(m.x - G.P.x) || 1) * 70;
      if (o.stun) m.stun = Math.max(m.stun, o.stun);
      if (o.freeze && !m.boss) m.frozen = Math.max(m.frozen, o.freeze);
      if (o.burn) { m.burn = 3; m.burnT = 0.6; m.burnDmg = r.d * 0.12; }
    }
    if (m.boss) G.bossBar = m;
    text(m.x, m.y - m.h - 2 - (o.stack || 0) * 11, r.d, r.crit ? 'crit' : o.dot ? 'dot' : 'hit');
    if (!o.dot) { spark(m.x + U.rand(-4, 4), m.y - m.h * 0.5, r.crit ? '#ff7ab0' : '#fff3a0', r.crit ? 8 : 5); Sound.sfx(r.crit ? 'crit' : 'hit'); }
    if (m.hp <= 0) killMob(m);
  }
  function killMob(m) {
    m.dead = true; m.hp = 0; m.deadT = 0;
    const def = m.def, pl = G.pl, s = S();
    const expMul = G.settings.expRate * (1 + (s.expPct || 0) / 100) * (m.summoned ? 0.3 : 1);
    gainExp(Math.max(1, Math.round(def.exp * expMul)));
    pl.kills++;
    pl.boss = pl.boss || {};
    if (def.rank) pl.boss[def.id] = (pl.boss[def.id] || 0) + 1;
    for (const q of D.QUESTS) { const st = pl.quests[q.id]; if (st && st.st === 'active' && q.type === 'kill' && q.target === def.id) { st.n = Math.min(q.n, st.n + 1); if (st.n === q.n) { UI.log(`Quest ready to turn in: ${q.name}`, 'good'); Sound.sfx('quest'); } UI.dirty('quest'); } }
    rollDrops(m);
    fx('poof', m.x, m.y - m.h / 2, { r: Math.max(10, m.w * 0.5) });
    for (let i = 0; i < (m.boss ? 30 : 8); i++) G.parts.push({ x: m.x, y: m.y - m.h / 2, vx: U.rand(-80, 80), vy: U.rand(-140, -30), life: U.rand(0.4, 0.9), col: U.pick(['#fff3a0', '#ffb3d0', '#ffffff', def.p.b]), g: 300, s: U.chance(0.3) ? 2 : 1 });
    Sound.sfx('pop');
    if (m.spawn) { m.spawn.mob = null; m.spawn.cd = 7 / G.settings.respawn; }
    if (m.boss) {
      const T = G.timers[G.mapId];
      if (T) { if (def.rank === 'boss') T.boss = 420; else T.mini = 150; }
      G.banner = { text: `${def.name} defeated!`, sub: 'Check the loot!', t: 0, gold: true };
      if (def.rank === 'boss') Sound.bgm(G.w.def.bgm);
      G.shake = 6; Main.save();
    }
    if (G.bossBar === m) G.bossBar = null;
  }

  function rollDrops(m) {
    const def = m.def, rate = G.settings.dropRate, rank = def.rank, lv = def.lv, pl = G.pl;
    const spill = [];
    const coins = Math.round((lv * 2 + 4) * U.rand(0.7, 1.3) * G.settings.coinRate * (rank === 'boss' ? 30 : rank === 'mini' ? 10 : 1));
    const piles = rank ? (rank === 'boss' ? 5 : 3) : 1;
    for (let i = 0; i < piles; i++) spill.push({ coins: Math.max(1, Math.round(coins / piles)) });
    const P = p => Math.min(1, p * rate);
    if (!m.summoned || U.chance(0.3)) {
      if (U.chance(P(0.36))) spill.push({ id: `e_${def.fam}`, n: 1 });
      if (U.chance(P(0.1)) || rank) {
        const hp = lv < 15 ? 'p_red' : lv < 35 ? 'p_orange' : 'p_white', mp = lv < 35 ? 'p_blue' : 'p_mana';
        spill.push({ id: U.chance(0.6) ? hp : mp, n: rank ? U.randi(3, 8) : 1 });
        if (lv >= 40 && U.chance(rank ? 0.5 : 0.04)) spill.push({ id: 'p_elixir', n: 1 });
      }
      if (U.chance(P(rank === 'boss' ? 1 : rank === 'mini' ? 0.6 : 0.018 + lv * 0.0003))) spill.push({ id: 'm_stone', n: rank === 'boss' ? U.randi(2, 4) : 1 });
      if (U.chance(P(rank === 'boss' ? 0.25 : rank === 'mini' ? 0.05 : 0.0012))) spill.push({ id: 'm_charm', n: 1 });
      if (rank === 'mini' && U.chance(P(0.3))) spill.push({ id: 's_bell', n: 1 });
      if (U.chance(P(0.008))) spill.push({ id: 's_return', n: 1 });
      const nEq = rank === 'boss' ? 4 : rank === 'mini' ? 2 : U.chance(P(0.028)) ? 1 : 0;
      for (let i = 0; i < nEq; i++) { const it = rollEquipment(lv, rank); if (it) spill.push({ id: it.id, inst: it }); }
      if (def.id === 'ignis' && U.chance(P(0.3))) { const fam = D.JOBS[pl.job].fam || 'warrior'; spill.push({ id: `w_legend_${fam}`, inst: makeItem(`w_legend_${fam}`, 3) }); }
    }
    for (const q of D.QUESTS) {
      const st = pl.quests[q.id];
      if (!st || st.st !== 'active' || q.type !== 'collect') continue;
      if (q.target === 'q_honey' && q.dropFrom.includes(def.id) && countItem('q_honey') < q.n && U.chance(P(0.5))) spill.push({ id: 'q_honey', n: 1 });
      if (q.target === 'q_seal' && rank === 'mini' && countItem('q_seal') < 1) spill.push({ id: 'q_seal', n: 1 });
    }
    spill.forEach((it, i) => {
      const spread = (i - (spill.length - 1) / 2) * 14;
      G.drops.push(Object.assign({ x: m.x, y: m.y - m.h * 0.5, vx: spread * 2.2 + U.rand(-10, 10), vy: -U.rand(170, 230), t: 0, landed: false, gy: null }, it));
    });
  }
  function rollEquipment(lv, rank) {
    const pl = G.pl, fam = D.JOBS[pl.job].fam;
    const roll = Math.random();
    let id = null;
    if (roll < (rank ? 0.2 : 0.06)) {
      const accs = Object.values(D.ITEMS).filter(b => b.kind === 'acc' && b.lv <= lv + 2);
      if (accs.length) id = accs[accs.length - 1].id;
    } else if (roll < 0.62) {
      const types = Object.keys(D.WTYPES);
      const mine = fam ? types.filter(t => D.WTYPES[t].fam === fam) : types;
      const wt = U.chance(rank ? 0.85 : 0.65) ? U.pick(mine) : U.pick(types);
      const tiers = D.WTIERS.map((l, t) => [l, t]).filter(([l]) => l <= lv + 3 && l >= lv - 16);
      const t = tiers.length ? U.pick(tiers.slice(-2))[1] : 0;
      id = `w_${wt}_${t}`;
    } else {
      if (!fam) { id = U.pick(['a_any_top_0', 'a_any_shoes_0', 'a_any_hat_0', 'a_any_gloves_0']); }
      else {
        const tiers = D.ATIERS.map((l, t) => [l, t]).filter(([l]) => l <= lv + 3);
        if (!tiers.length) id = U.pick(['a_any_hat_0', 'a_any_gloves_0']);
        else id = `a_${fam}_${U.pick(D.ASLOTS)}_${tiers[tiers.length - 1][1]}`;
      }
    }
    if (!id) return null;
    const bump = Math.sqrt(Math.min(3, G.settings.dropRate));
    const r = Math.random();
    const odds = rank === 'boss' ? [0.12, 0.5, 1] : rank === 'mini' ? [0.03, 0.25, 0.75] : [0.004, 0.04, 0.2];
    const rar = r < odds[0] * bump ? 3 : r < odds[1] * bump ? 2 : r < odds[2] * bump ? 1 : 0;
    return makeItem(id, D.ITEMS[id].unique ? 3 : rar);
  }

  function hurtPlayer(dmg, srcX, unblockable) {
    const P = G.P, pl = G.pl, s = S();
    if (P.dead || P.invuln > 0 || P.dashT > 0) return;
    if (!unblockable && Math.random() * 100 < s.dodge) { text(P.x, P.y - PH - 4, 'MISS', 'miss'); P.invuln = 0.5; return; }
    let d = dmg * U.rand(0.85, 1.0) - s.defT * 0.5;
    d *= 1 - Math.min(60, s.dmgTaken) / 100;
    d = Math.max(1, Math.round(d));
    if (s.mguard > 0) { const toMp = Math.min(pl.mp, Math.round(d * s.mguard / 100)); pl.mp -= toMp; d -= toMp; }
    pl.hp -= d;
    text(P.x, P.y - PH - 4, d, 'hurt');
    P.invuln = 1.2;
    if (!s.noKnock) { P.knockT = 0.22; P.vx = (P.x < srcX ? -1 : 1) * 150; P.vy = -170; P.onGround = false; P.rope = null; }
    Sound.sfx('hurt');
    G.shake = Math.max(G.shake, 3);
    if (pl.hp <= 0) die();
    UI.dirty('hud');
  }
  function die() {
    const P = G.P, pl = G.pl;
    pl.hp = 0; P.dead = true; P.deadT = 0; P.rope = null;
    const lost = pl.job === 'beginner' ? 0 : Math.round(D.expNeed(pl.lv) * 0.05);
    pl.exp = Math.max(0, pl.exp - lost);
    UI.log(lost ? `You fainted and lost ${U.fmt(lost)} EXP.` : 'You fainted! Beginners lose no EXP.', 'bad');
    Sound.sfx('faint');
    setTimeout(() => UI.reviveDialog(), 1200);
  }
  function revive() {
    const pl = G.pl, s = calc();
    pl.hp = Math.round(s.maxHp * 0.6); pl.mp = Math.round(s.maxMp * 0.6);
    changeMap('town', 'town');
  }

  /* ---------------------------------------------------------------- attacking */
  function targetsInRect(x0, y0, x1, y1, n) {
    const out = [];
    for (const m of G.mobs) { if (m.dead || m.fade < 0.6) continue; if (m.x + m.w / 2 > x0 && m.x - m.w / 2 < x1 && m.y > y0 && m.y - m.h < y1) out.push(m); }
    out.sort((a, b) => Math.abs(a.x - G.P.x) - Math.abs(b.x - G.P.x));
    return out.slice(0, n);
  }
  function frontRect(w, h) {
    const P = G.P;
    return P.dir > 0 ? [P.x - 8, P.y - h, P.x + w, P.y + 8] : [P.x - w, P.y - h, P.x + 8, P.y + 8];
  }
  function later(t, fn) { G.events.push({ t, fn }); }
  function strike(targets, mult, hits, o = {}) {
    const s = S();
    targets.forEach((m, ti) => {
      for (let h = 0; h < hits; h++) {
        later((o.delay || 0.1) + h * 0.11 + ti * 0.02, () => { if (!m.dead) hitMob(m, rollDamage(mult, m, o), { ...o, stack: h, dir: G.P.dir }); });
      }
    });
    if (targets.length && s.finalAtk && Math.random() * 100 < s.finalAtk) later((o.delay || 0.1) + hits * 0.11 + 0.08, () => { const m = targets[0]; if (!m.dead) { hitMob(m, rollDamage(1.0, m, o), { stack: hits, dir: G.P.dir }); fx('slash', m.x, m.y - m.h / 2, { dir: G.P.dir, size: 14, col: '#ffcf5a', dur: 0.15 }); } });
  }
  function setAct(anim, dur) { const P = G.P; P.anim = anim; P.actDur = dur; P.actT = dur; P.animT = 0; }

  function basicAttack() {
    const P = G.P, s = S();
    if (P.actT > 0 || P.dead || P.rope) return;
    const dur = s.aspd;
    if (s.wstyle === 'bow') {
      setAct('shoot', dur); later(0.12, () => shootProj('arrow', 1.0, { pierce: 1, speed: 400, range: s.reach })); Sound.sfx('bow');
    } else if (s.wstyle === 'magic') {
      setAct('cast', dur); later(0.12, () => shootProj('orb', 1.0, { pierce: 1, speed: 300, range: s.reach })); Sound.sfx('magic');
    } else {
      setAct('swing', dur);
      const t = targetsInRect(...frontRect(s.reach, 38), 1);
      later(0.08, () => fx('slash', P.x + P.dir * 14, P.y - 18, { dir: P.dir, size: 16, dur: 0.16 }));
      strike(t, 1.0, 1, { delay: 0.1 });
      Sound.sfx('swing');
    }
  }
  function shootProj(kind, mult, o = {}) {
    const P = G.P, s = S();
    const y = P.y - 18;
    const range = o.range || 260;
    let ang = 0;
    const cand = G.mobs.filter(m => !m.dead && Math.sign(m.x - P.x) === P.dir && Math.abs(m.x - P.x) < range && Math.abs((m.y - m.h / 2) - y) < 90);
    cand.sort((a, b) => Math.abs(a.x - P.x) - Math.abs(b.x - P.x));
    if (cand[0]) { const m = cand[0]; ang = Math.atan2((m.y - m.h / 2) - y, Math.abs(m.x - P.x)); ang = U.clamp(ang, -0.5, 0.5); }
    const sp = o.speed || 320;
    G.projs.push({ owner: 'p', kind, x: P.x + P.dir * 8, y: y + (o.dy || 0), vx: Math.cos(ang) * sp * P.dir, vy: Math.sin(ang) * sp, life: range / sp, mult, pierce: (o.pierce || 1) + (kind.startsWith('arrow') ? s.pierce : 0), hit: new Set(), o, r: 5 });
  }

  function castSkill(id, quiet) {
    const sk = D.SKILLS[id], L = skillLv(id), P = G.P, pl = G.pl, s = S();
    if (!sk || P.dead) return false;
    if (!L) { if (!quiet) toast(`You haven't learned ${sk.name} yet.`); return false; }
    if (sk.kind === 'passive') { if (!quiet) toast(`${sk.name} is passive.`); return false; }
    if (P.rope) return false;
    if ((G.cds[id] || 0) > 0) return false;
    if (P.actT > 0 && sk.kind !== 'buff' && sk.kind !== 'leap' && sk.kind !== 'blink') return false;
    const cost = sk.mp(L);
    if (pl.mp < cost) { if (!quiet) { toast('Not enough MP.'); Sound.sfx('error'); } return false; }
    pl.mp -= cost;
    if (sk.cd) G.cds[id] = sk.cd(L);
    const col = sk.icon.c;
    const anim = sk.anim === 'swing' && s.wstyle !== 'melee' ? (s.wstyle === 'bow' ? 'shoot' : 'cast') : sk.anim;
    switch (sk.kind) {
      case 'melee': {
        setAct(anim, 0.5);
        const t = targetsInRect(...frontRect(sk.w, sk.h), sk.targets(L));
        later(0.06, () => fx(sk.fx || 'slash', P.x + P.dir * 18, P.y - 18, { dir: P.dir, size: sk.w * 0.5, col, dur: 0.22 }));
        strike(t, sk.mult(L), sk.hits, { elem: sk.elem, stun: sk.stunChance && U.chance(sk.stunChance) ? 1.5 : 0, delay: 0.12 });
        Sound.sfx('skill');
        break;
      }
      case 'aoe': {
        setAct(anim, 0.55);
        const cx = P.x + P.dir * (sk.ahead || 0);
        const t = targetsInRect(cx - sk.rx, P.y - sk.ry * 1.4, cx + sk.rx, P.y + sk.ry * 0.6, sk.targets(L));
        later(0.1, () => { fx(sk.fx, cx, P.y, { rx: sk.rx, col, dur: 0.5, dir: P.dir }); if (sk.shake) G.shake = sk.shake; });
        strike(t, sk.mult(L), sk.hits, { elem: sk.elem, freeze: sk.freeze, stun: sk.knock ? 0.6 : 0, delay: 0.16 });
        Sound.sfx(sk.elem === 'ice' ? 'ice' : sk.elem === 'holy' ? 'holy' : 'smash');
        break;
      }
      case 'strike': {
        setAct(anim, 0.5);
        const r = sk.range;
        const rect = sk.around ? [P.x - r, P.y - 120, P.x + r, P.y + 60] : (P.dir > 0 ? [P.x, P.y - 110, P.x + r, P.y + 60] : [P.x - r, P.y - 110, P.x, P.y + 60]);
        const t = targetsInRect(...rect, sk.targets(L));
        for (const m of t) later(0.08, () => fx(sk.fx, m.x, m.y, { h: m.h, col, dur: sk.fx === 'claw' ? 0.25 : 0.4, dir: P.dir }));
        if (sk.shake && t.length) later(0.1, () => { G.shake = sk.shake; });
        strike(t, sk.mult(L), sk.hits, { elem: sk.elem, delay: 0.14 });
        Sound.sfx(sk.elem === 'bolt' ? 'thunder' : sk.elem === 'holy' ? 'holy' : 'magic');
        if (!t.length) fx('blink', P.x + P.dir * 30, P.y - 18, { col, dur: 0.3 });
        break;
      }
      case 'proj': {
        setAct(anim, 0.45);
        const n = sk.count || 1;
        for (let i = 0; i < n; i++) later(0.08 + i * 0.07, () => shootProj(sk.proj, sk.mult(L), { pierce: sk.pierce, speed: sk.speed, range: sk.range, elem: sk.elem, burn: sk.burn, blast: sk.blast, targets: sk.targets ? sk.targets(L) : 1, dy: n > 1 ? (i % 2 ? -3 : 3) : 0 }));
        Sound.sfx(sk.proj.startsWith('arrow') ? 'bow' : sk.elem === 'fire' ? 'fire' : 'magic');
        break;
      }
      case 'rain': {
        setAct('shoot', 0.5);
        const x0 = P.x + P.dir * 30;
        for (let i = 0; i < sk.count; i++) later(0.15 + i * 0.07, () => {
          const x = x0 + P.dir * U.rand(0, sk.w);
          G.projs.push({ owner: 'p', kind: 'arrowDown', x, y: G.P.y - 170, vx: P.dir * 30, vy: 420, life: 0.8, mult: sk.mult(L), pierce: 2, hit: new Set(), o: {}, r: 6 });
        });
        Sound.sfx('bow');
        break;
      }
      case 'dash': {
        setAct('swing', 0.45);
        P.dashT = 0.26; P.vx = P.dir * sk.dist / 0.26; P.dashHit = new Set(); P.dashSk = { mult: sk.mult(L), stun: sk.stun, n: sk.targets(L) };
        Sound.sfx('dash');
        break;
      }
      case 'blink': {
        setAct('cast', 0.25);
        fx('blink', P.x, P.y - 16, { col, dur: 0.35 });
        const dist = sk.dist(L);
        if (Input.down('w')) { const tgt = G.w.plats.filter(p => p.y < P.y - 10 && p.y > P.y - dist && P.x > p.x && P.x < p.x + p.w).sort((a, b) => b.y - a.y)[0]; if (tgt) { P.y = tgt.y; P.plat = tgt; P.onGround = true; P.vy = 0; } }
        else if (Input.down('s')) { const tgt = G.w.plats.filter(p => p.y > P.y + 4 && p.y < P.y + dist && P.x > p.x && P.x < p.x + p.w).sort((a, b) => a.y - b.y)[0]; if (tgt) { P.y = tgt.y; P.plat = tgt; P.onGround = true; P.vy = 0; } }
        else { P.x = U.clamp(P.x + P.dir * dist, 12, G.w.W - 12); P.onGround = false; }
        fx('blink', P.x, P.y - 16, { col, dur: 0.35 });
        Sound.sfx('blink');
        break;
      }
      case 'leap': {
        if (P.leaped) { pl.mp += cost; G.cds[id] = 0; return false; }
        P.leaped = true; P.leapT = 0.55; P.vx = P.dir * (sk.dist(L) * 1.25); P.vy = -260; P.onGround = false;
        fx('blink', P.x, P.y - 6, { col, dur: 0.3 });
        Sound.sfx('jump');
        break;
      }
      case 'buff': {
        setAct('cast', 0.45);
        G.buffs[id] = { id, name: sk.name, fx: sk.buff.fx(L), until: G.t + sk.buff.dur(L), dur: sk.buff.dur(L) };
        calc(); fx('buff', P.x, P.y, { col, dur: 0.9 });
        Sound.sfx('buff'); UI.dirty('hud');
        break;
      }
      case 'heal': {
        setAct('cast', 0.5);
        const heal = Math.round((s.maxHp * sk.healPct(L) + s.st.wis * 2) * (1 + (s.healPct || 0) / 100));
        pl.hp = Math.min(s.maxHp, pl.hp + heal);
        text(P.x, P.y - PH - 6, '+' + heal, 'heal');
        fx('heal', P.x, P.y, { dur: 0.9 });
        const t = targetsInRect(P.x - sk.rx, P.y - sk.ry * 1.5, P.x + sk.rx, P.y + sk.ry * 0.5, 12).filter(m => m.def.undead).slice(0, sk.targets(L));
        strike(t, sk.mult(L) * 1.6, 1, { elem: 'holy', delay: 0.15 });
        Sound.sfx('heal');
        break;
      }
    }
    UI.dirty('hud');
    return true;
  }

  function useItem(id) {
    const pl = G.pl, b = D.ITEMS[id], s = S();
    if (!b || countItem(id) <= 0) { toast(`No ${b ? b.name : 'item'} left.`); return; }
    if (G.P.dead) return;
    const e = b.eff || {};
    const pm = 1 + (s.potion || 0) / 100;
    if (e.hp || e.hpPct || e.mp || e.mpPct) {
      const hp = Math.round(((e.hp || 0) + (e.hpPct || 0) * s.maxHp) * pm), mp = Math.round(((e.mp || 0) + (e.mpPct || 0) * s.maxMp) * pm);
      if ((hp && pl.hp >= s.maxHp && !mp) || (mp && pl.mp >= s.maxMp && !hp)) { toast('Already full.'); return; }
      pl.hp = Math.min(s.maxHp, pl.hp + hp); pl.mp = Math.min(s.maxMp, pl.mp + mp);
      if (hp) text(G.P.x, G.P.y - PH - 6, '+' + hp, 'heal');
      if (mp) text(G.P.x + 10, G.P.y - PH - 16, '+' + mp, 'mp');
      Sound.sfx('potion');
    } else if (e.town) { if (G.w.def.town) { toast('You are already in town.'); return; } removeItem(id, 1); Sound.sfx('portal'); changeMap('town', 'town'); return; }
    else if (e.bell) {
      const w = G.w.def;
      if (!w.boss) { toast('Ring it in a hunting ground.'); return; }
      if (G.mobs.some(m => m.boss && !m.dead)) { toast('A boss is already here!'); return; }
      removeItem(id, 1); spawnBoss('boss'); return;
    }
    removeItem(id, 1);
    UI.dirty('hud');
  }
  function useHotkey(i) {
    const h = G.pl.hotbar[i];
    if (!h) return;
    if (h.t === 's') castSkill(h.id);
    else useItem(h.id);
  }

  /* ================================================================ interactions */
  function nearNpc() {
    const P = G.P;
    let best = null;
    for (const n of G.npcs) if (Math.abs(n.x - P.x) < 28 && Math.abs(n.y - P.y) < 30) best = n;
    if (G.w.def.town && Math.abs(D.WAYSTONE_X - P.x) < 24 && P.y > G.w.gy - 30) best = { id: 'waystone', name: 'Waystone' };
    return best;
  }
  function nearPortal() { const P = G.P; return G.w.portals.find(p => Math.abs(p.x - P.x) < 18 && Math.abs(p.y - P.y) < 12); }
  function nearRope(grabDown) {
    const P = G.P;
    for (const r of G.w.ropes) {
      if (Math.abs(r.x - P.x) > 8) continue;
      if (grabDown ? Math.abs(P.y - (r.y1 + 4)) < 8 : (P.y > r.y1 + 8 && P.y < r.y2 + 10)) return r;
    }
    return null;
  }
  function interact() {
    const p = nearPortal();
    if (p) { Sound.sfx('portal'); changeMap(p.to, G.mapId); return true; }
    const n = nearNpc();
    if (n) { UI.npc(n.id); Sound.sfx('click'); return true; }
    return false;
  }

  function questState(q) {
    const st = G.pl.quests[q.id];
    if (st && st.st === 'done') return 'done';
    if (st && st.st === 'active') return questReady(q) ? 'ready' : 'active';
    if (G.pl.lv < q.lv) return 'locked';
    const prevSame = D.QUESTS.filter(x => x.giver === q.giver && D.QUESTS.indexOf(x) < D.QUESTS.indexOf(q));
    if (q.giver === 'elder' && prevSame.some(x => !(G.pl.quests[x.id] && G.pl.quests[x.id].st === 'done'))) return 'locked';
    if (q.id === 'q5' && D.JOBS[G.pl.job].tier !== 1) return 'locked';
    if (q.id === 'q2' && G.pl.job !== 'beginner') return 'done';
    return 'available';
  }
  function questReady(q) {
    const st = G.pl.quests[q.id];
    if (!st) return false;
    if (q.type === 'kill') return st.n >= q.n;
    if (q.type === 'collect') return countItem(q.target) >= q.n;
    return false;
  }
  function acceptQuest(id) { G.pl.quests[id] = { st: 'active', n: 0 }; Sound.sfx('quest'); UI.log(`Quest accepted: ${D.QUESTS.find(q => q.id === id).name}`, 'info'); UI.dirty('all'); }
  function completeQuest(id) {
    const q = D.QUESTS.find(x => x.id === id), pl = G.pl;
    if (!questReady(q)) return;
    if (q.type === 'collect') removeItem(q.target, q.n);
    pl.quests[id].st = 'done';
    const r = q.reward;
    if (r.coins) { pl.coins += r.coins; UI.log(`+${U.fmt(r.coins)} coins`, 'coin'); }
    for (const [iid, n] of r.items) {
      const real = iid === 'legend' ? `w_legend_${D.JOBS[pl.job].fam || 'warrior'}` : iid;
      const b = D.ITEMS[real];
      if (b.kind === 'weapon' || b.kind === 'armor' || b.kind === 'acc') addItem(real, 1, makeItem(real, b.unique ? 3 : b.kind === 'acc' ? 1 : 0));
      else addItem(real, n);
      UI.log(`Received ${b.name}${n > 1 ? ' ×' + n : ''}`, 'item');
    }
    if (r.exp) gainExp(Math.round(r.exp * G.settings.expRate));
    if (q.job2) advanceJob(D.JOBS[pl.job].next);
    Sound.sfx('quest');
    G.banner = { text: 'Quest complete!', sub: q.name, t: 0, gold: true };
    UI.dirty('all'); Main.save();
  }
  function advanceJob(job) {
    const pl = G.pl, J = D.JOBS[job];
    pl.job = job; pl.sp += 1;
    if (J.tier === 1) {
      const wt = Object.keys(D.WTYPES).find(k => D.WTYPES[k].fam === J.fam);
      addItem(`w_${wt}_1`, 1, makeItem(`w_${wt}_1`, 1));
      pl.quests.q2 = { st: 'done', n: 0 };
      pl.hotbar = pl.hotbar.map(h => (h && h.t === 's' && D.SKILLS[h.id].job === 'beginner' && h.id !== 'sprint') ? null : h);
    }
    calc(); const s = S(); pl.hp = s.maxHp; pl.mp = s.maxMp;
    fx('levelup', G.P.x, G.P.y, { dur: 1.8 }); Sound.sfx('levelup');
    G.banner = { text: `You are now a ${J.name}!`, sub: 'Open Skills (K) to spend your SP', t: 0, gold: true };
    UI.log(`Job advanced: ${J.name}`, 'good');
    UI.dirty('all'); Main.save();
  }

  function buy(id, n) {
    const b = D.ITEMS[id], pl = G.pl, cost = b.price * n;
    if (pl.coins < cost) { toast('Not enough coins.'); Sound.sfx('error'); return false; }
    const ok = (b.kind === 'weapon' || b.kind === 'armor') ? addItem(id, 1, makeItem(id)) : addItem(id, n);
    if (!ok) return false;
    pl.coins -= cost; Sound.sfx('coin'); UI.dirty('all'); return true;
  }
  function sellPrice(slot) {
    const b = D.ITEMS[slot.id];
    if (b.quest) return 0;
    if (b.kind === 'weapon' || b.kind === 'armor' || b.kind === 'acc') return Math.round(b.price * 0.3 * (1 + (slot.rar || 0) * 0.6) * (1 + (slot.enh || 0) * 0.25));
    return Math.max(1, Math.round(b.kind === 'etc' && !b.icon ? b.price : b.price * 0.4)) * (slot.n || 1);
  }
  function sell(tab, idx, all) {
    const pl = G.pl, slot = pl.inv[tab][idx];
    if (!slot) return;
    const b = D.ITEMS[slot.id];
    if (b.quest) { toast('Quest items cannot be sold.'); return; }
    const n = slot.n || 1, unit = Math.round(sellPrice(slot) / n);
    const k = all ? n : 1;
    pl.coins += unit * k;
    if (slot.n) { slot.n -= k; if (slot.n <= 0) pl.inv[tab][idx] = null; } else pl.inv[tab][idx] = null;
    Sound.sfx('coin'); UI.dirty('all');
  }
  function sellAllEtc() {
    const pl = G.pl; let total = 0;
    pl.inv.etc.forEach((s, i) => { if (s && D.ITEMS[s.id].fam && !D.ITEMS[s.id].quest) { total += sellPrice(s); pl.inv.etc[i] = null; } });
    pl.coins += total; if (total) Sound.sfx('coin'); UI.dirty('all'); return total;
  }

  function enhance(ref, useCharm) {
    const pl = G.pl, inst = ref.slot ? pl.eq[ref.slot] : pl.inv.equip[ref.idx];
    if (!inst) return null;
    const b = D.ITEMS[inst.id];
    if ((inst.enh || 0) >= D.ENH_MAX) { toast('Already at +10.'); return null; }
    const cost = D.enhCost(b, inst.enh || 0);
    if (pl.coins < cost.coins) { toast('Not enough coins.'); return null; }
    if (countItem('m_stone') < cost.stones) { toast(`You need ${cost.stones} Enhance Stone${cost.stones > 1 ? 's' : ''}.`); return null; }
    if (useCharm && countItem('m_charm') < 1) useCharm = false;
    pl.coins -= cost.coins; removeItem('m_stone', cost.stones);
    const info = D.ENH[inst.enh || 0];
    let result;
    if (Math.random() < info.rate) { inst.enh = (inst.enh || 0) + 1; result = 'success'; Sound.sfx('enhanceOk'); }
    else if (useCharm && info.down) { removeItem('m_charm', 1); result = 'saved'; Sound.sfx('enhanceFail'); }
    else if (info.brk && Math.random() < info.brk) { if (ref.slot) pl.eq[ref.slot] = null; else pl.inv.equip[ref.idx] = null; result = 'broken'; Sound.sfx('break'); }
    else if (info.down) { inst.enh = Math.max(0, inst.enh - 1); result = 'down'; Sound.sfx('enhanceFail'); }
    else { result = 'fail'; Sound.sfx('enhanceFail'); }
    afterGear(); Main.save();
    return result;
  }

  /* ================================================================ fx helpers */
  function fx(kind, x, y, o = {}) { G.fx.push(Object.assign({ kind, x, y, t: 0, dur: 0.4 }, o)); }
  function spark(x, y, col, n) { for (let i = 0; i < n; i++) G.parts.push({ x, y, vx: U.rand(-90, 90), vy: U.rand(-90, 40), life: U.rand(0.15, 0.35), col, g: 0, s: 1 }); }
  function text(x, y, v, kind) { if (!G.settings.dmgNumbers && (kind === 'hit' || kind === 'crit' || kind === 'dot')) return; G.texts.push({ x, y, v, kind, t: 0 }); }
  function toast(msg) { UI.toast(msg); }

  /* ================================================================ update */
  function update(dt) {
    if (!G.pl || !G.w) return;
    G.t += dt; G.pl.playTime += dt;
    const P = G.P, pl = G.pl, w = G.w, s = S();
    for (let i = G.events.length - 1; i >= 0; i--) { const e = G.events[i]; e.t -= dt; if (e.t <= 0) { G.events.splice(i, 1); e.fn(); } }
    for (const k of Object.keys(G.cds)) { G.cds[k] -= dt; if (G.cds[k] <= 0) delete G.cds[k]; }
    let buffChanged = false;
    for (const [k, b] of Object.entries(G.buffs)) if (G.t >= b.until) { delete G.buffs[k]; buffChanged = true; UI.log(`${b.name} wore off.`, 'info'); }
    if (buffChanged) { calc(); UI.dirty('hud'); }
    updatePlayer(dt);
    // regen
    P.regenT += dt;
    if (P.regenT >= 5 && !P.dead) {
      P.regenT = 0;
      const town = w.def.town ? 3 : 1;
      pl.hp = Math.min(s.maxHp, pl.hp + Math.round((2 + s.maxHp * 0.01 + (s.hpRegen || 0)) * town));
      pl.mp = Math.min(s.maxMp, pl.mp + Math.round((2 + s.maxMp * 0.012 + (s.mpRegen || 0) * 1.5) * town));
      UI.dirty('hud');
    }
    for (const m of G.mobs) updateMob(m, dt);
    G.mobs = G.mobs.filter(m => !(m.dead && m.deadT > 0.5));
    // respawn
    for (const sp of w.spawns) {
      if (sp.mob) continue;
      sp.cd -= dt;
      if (sp.cd <= 0 && Math.abs(sp.x - P.x) > 70) { spawnAt(sp); if (sp.mob) { sp.mob.fade = 0; fx('poof', sp.x, sp.y - 8, { r: 8, dur: 0.3 }); } }
    }
    // boss timers
    const T = G.timers[G.mapId];
    if (T && w.def.boss) {
      const k = G.settings.bossTimer;
      if (!G.mobs.some(m => m.boss && m.def.rank === 'mini' && !m.dead)) { T.mini -= dt / k; if (T.mini <= 0) { T.mini = 150; spawnBoss('mini'); } }
      if (!G.mobs.some(m => m.boss && m.def.rank === 'boss' && !m.dead)) { T.boss -= dt / k; if (T.boss <= 0) { T.boss = 420; spawnBoss('boss'); } }
    }
    updateProjs(dt);
    updateDrops(dt);
    for (const f of G.fx) f.t += dt;
    G.fx = G.fx.filter(f => f.t < f.dur);
    for (const q of G.parts) { q.life -= dt; q.vy += (q.g || 0) * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    G.parts = G.parts.filter(q => q.life > 0);
    for (const t of G.texts) t.t += dt;
    G.texts = G.texts.filter(t => t.t < 1.0);
    if (G.banner) { G.banner.t += dt; if (G.banner.t > 3) G.banner = null; }
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 25);
    updateExtras(dt);
    // camera
    const vw = G.view.w, vh = G.view.h;
    const hudPad = 56 / G.view.scale;
    const tx = U.clamp(P.x - vw / 2 + P.dir * 30, 0, Math.max(0, w.W - vw));
    const ty = U.clamp(P.y - vh * 0.62, 0, Math.max(0, w.H - vh + hudPad));
    G.cam.x += (tx - G.cam.x) * Math.min(1, dt * 6);
    G.cam.y += (ty - G.cam.y) * Math.min(1, dt * 5);
    pl.hp = U.clamp(pl.hp, 0, s.maxHp); pl.mp = U.clamp(pl.mp, 0, s.maxMp);
  }

  function updatePlayer(dt) {
    const P = G.P, pl = G.pl, w = G.w, s = S();
    P.animT += dt; P.invuln -= dt; P.actT -= dt; P.knockT -= dt; P.dropT -= dt; P.leapT -= dt;
    if (P.dead) { P.deadT += dt; P.y -= dt * 14; return; }
    const L = Input.down('a') || Input.down('arrowleft'), R = Input.down('d') || Input.down('arrowright');
    const up = Input.down('w') || Input.down('arrowup'), dn = Input.down('s') || Input.down('arrowdown');
    const jumpP = Input.pressed(' '), upP = Input.pressed('w') || Input.pressed('arrowup');
    // interactions
    if (Input.pressed('e')) interact();
    if (upP && !P.rope) {
      if (P.onGround && (nearPortal() || nearNpc())) { interact(); }
      else { const r = nearRope(false); if (r) grabRope(r); else if (P.onGround && P.actT <= 0) jump(); }
    }
    if (jumpP) {
      if (P.rope) { P.rope = null; P.vy = -JUMP_V * 0.7; P.vx = (R ? 1 : L ? -1 : 0) * WALK; P.onGround = false; }
      else if (P.onGround && dn && P.plat && !P.plat.ground) { P.dropT = 0.3; P.dropPlat = P.plat; P.onGround = false; P.vy = 40; }
      else if (P.onGround && P.actT <= 0) jump();
    }
    if (dn && P.onGround && !P.rope && !jumpP) { const r = nearRope(true); if (r && Input.pressed('s')) { grabRope(r); P.y = r.y1 + 10; } }
    // rope
    if (P.rope) {
      const r = P.rope;
      P.vx = 0; P.vy = 0;
      if (up) P.y -= CLIMB * dt; if (dn) P.y += CLIMB * dt;
      P.climbing = up || dn;
      if (P.y <= r.y1 + 4) { const top = surfaceAt(r.x, r.y1 - 2, 12); P.rope = null; if (top) { P.y = top.y; P.plat = top; P.onGround = true; } }
      else if (P.y >= r.y2 + 6) { P.rope = null; P.onGround = false; }
      return;
    }
    // dash
    if (P.dashT > 0) {
      P.dashT -= dt; P.invuln = Math.max(P.invuln, 0.1);
      if (G.t % 0.04 < dt) P.ghosts.push({ x: P.x, y: P.y, t: 0 });
      for (const m of G.mobs) if (!m.dead && !P.dashHit.has(m) && P.dashHit.size < P.dashSk.n && Math.abs(m.x - P.x) < m.w / 2 + 10 && Math.abs((m.y - m.h / 2) - (P.y - 16)) < m.h / 2 + 16) { P.dashHit.add(m); hitMob(m, rollDamage(P.dashSk.mult, m), { stun: P.dashSk.stun, dir: P.dir }); }
      P.x = U.clamp(P.x, 12, w.W - 12);
      if (P.dashT <= 0) P.vx = P.dir * 40;
    } else {
      const spd = WALK * (1 + s.speed / 100);
      let target = 0;
      if (P.knockT <= 0) { if (L) { target = -spd; P.dir = -1; } else if (R) { target = spd; P.dir = 1; } }
      if (P.actT > 0 && P.onGround) target = 0;
      if (P.knockT <= 0) {
        if (P.leapT > 0) P.vx = U.approach(P.vx, target || P.vx, 200 * dt);
        else P.vx = U.approach(P.vx, target, (P.onGround ? 1400 : 500) * dt);
      }
    }
    P.vy = Math.min(560, P.vy + GRAV * dt);
    const prevY = P.y;
    P.x += P.vx * dt; P.y += P.vy * dt;
    P.x = U.clamp(P.x, 10, w.W - 10);
    if (P.vy >= 0) {
      let landed = null;
      for (const p of w.plats) {
        if (P.dropT > 0 && p === P.dropPlat) continue;
        if (P.x >= p.x - 3 && P.x <= p.x + p.w + 3 && prevY <= p.y + 1 && P.y >= p.y && (!landed || p.y < landed.y)) landed = p;
      }
      if (landed) { P.y = landed.y; P.vy = 0; if (!P.onGround) Sound.sfx('land'); P.onGround = true; P.plat = landed; P.leaped = false; P.leapT = 0; }
      else if (P.onGround && P.plat && !(P.x >= P.plat.x - 3 && P.x <= P.plat.x + P.plat.w + 3)) P.onGround = false;
      else if (!landed) P.onGround = P.onGround && P.vy === 0;
    } else P.onGround = false;
    if (P.y > w.H + 40) { P.y = w.gy; P.vy = 0; }
    // attack + skills
    if (Input.down('j') || Input.down('control')) basicAttack();
    for (let i = 0; i < 10; i++) {
      const key = String((i + 1) % 10), h = pl.hotbar[i];
      if (!h || !Input.down(key)) continue;
      const pr = Input.pressed(key);
      if (h.t === 'i') { if (pr) useItem(h.id); continue; }
      const sk = D.SKILLS[h.id];
      const repeat = sk && ['melee', 'aoe', 'strike', 'proj', 'rain'].includes(sk.kind);
      if (pr || repeat) castSkill(h.id, !pr);
    }
    if (Input.pressed('z') || G.settings.autoLoot) pickup(G.settings.autoLoot ? 22 : 26);
    for (const gh of P.ghosts) gh.t += dt;
    P.ghosts = P.ghosts.filter(g => g.t < 0.25);
  }
  function jump() { const P = G.P, s = S(); P.vy = -JUMP_V * (1 + (s.jump || 0) / 100); P.onGround = false; Sound.sfx('jump'); }
  function grabRope(r) { const P = G.P; P.rope = r; P.x = r.x; P.vx = 0; P.vy = 0; P.onGround = false; P.leaped = false; }

  function updateProjs(dt) {
    const P = G.P;
    for (const p of G.projs) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.owner === 'p') {
        for (const m of G.mobs) {
          if (m.dead || p.hit.has(m) || p.pierce <= 0) continue;
          if (Math.abs(m.x - p.x) < m.w / 2 + p.r && p.y > m.y - m.h - p.r && p.y < m.y + p.r) {
            p.hit.add(m); p.pierce--;
            if (p.o.blast) {
              fx('boom', p.x, p.y, { r: p.o.blast, dur: 0.35 }); G.shake = 3; Sound.sfx('boom');
              const ts = G.mobs.filter(q => !q.dead && Math.hypot(q.x - p.x, (q.y - q.h / 2) - p.y) < p.o.blast + q.w / 2).slice(0, p.o.targets || 6);
              for (const q of ts) hitMob(q, rollDamage(p.mult, q, p.o), { burn: p.o.elem === 'fire' ? 1 : 0, dir: Math.sign(p.vx) });
            } else hitMob(m, rollDamage(p.mult, m, p.o), { burn: p.o.burn, dir: Math.sign(p.vx) });
            if (p.pierce <= 0) p.life = 0;
          }
        }
        if (p.kind === 'arrowDown') { const sf = surfaceAt(p.x, p.y - 4, 2); if (sf && p.y >= sf.y) { p.life = 0; spark(p.x, sf.y, '#fff3a0', 3); } }
      } else {
        if (!P.dead && P.invuln <= 0 && Math.abs(p.x - P.x) < 8 + p.r && p.y > P.y - PH - p.r && p.y < P.y + p.r) { hurtPlayer(p.dmg, p.x); p.life = 0; }
        if (p.fall) { const sf = surfaceAt(p.x, p.y - 4, 2); if (sf && p.y >= sf.y) { p.life = 0; spark(p.x, sf.y, '#ffffff', 6); G.shake = Math.max(G.shake, 2); } }
      }
    }
    G.projs = G.projs.filter(p => p.life > 0 && p.x > -40 && p.x < G.w.W + 40 && p.y < G.w.H + 40);
  }

  function updateDrops(dt) {
    for (const d of G.drops) {
      d.t += dt;
      if (!d.landed) {
        d.vy += GRAV * 0.8 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 0.98;
        if (d.vy > 0) { const sf = surfaceAt(d.x, d.y - d.vy * dt - 2, 2); if (sf && d.y >= sf.y) { d.y = sf.y; d.landed = true; d.gy = sf.y; } }
        if (d.y > G.w.gy) { d.y = G.w.gy; d.landed = true; }
      }
    }
    G.drops = G.drops.filter(d => d.t < 90);
  }
  function pickup(radius) {
    const P = G.P;
    for (const d of G.drops) {
      if (d.t < 0.45 || d.gone) continue;
      if (Math.abs(d.x - P.x) < radius && Math.abs(d.y - P.y) < 26) {
        if (d.coins) { G.pl.coins += d.coins; d.gone = true; Sound.sfx('coin'); text(P.x, P.y - PH - 10, '+' + d.coins + 'c', 'coin'); UI.dirty('hud'); }
        else {
          const ok = addItem(d.id, d.n || 1, d.inst || null);
          if (ok) {
            d.gone = true;
            const b = D.ITEMS[d.id];
            const rar = d.inst ? d.inst.rar : 0;
            UI.log(`Picked up ${b.name}${d.n > 1 ? ' ×' + d.n : ''}`, rar >= 2 ? 'rare' : 'item');
            Sound.sfx(rar >= 2 ? 'rare' : 'pickup');
            if (D.QUESTS.some(q => q.target === d.id)) UI.dirty('quest');
          }
        }
      }
    }
    G.drops = G.drops.filter(d => !d.gone);
  }

  function updateExtras(dt) {
    for (const e of G.extras) {
      e.t -= dt; e.bubbleT -= dt;
      if (e.t <= 0) { e.t = U.rand(1.5, 5); e.walk = U.chance(0.5); e.dir = U.chance(0.5) ? 1 : -1; }
      if (e.walk) { e.x += e.dir * 60 * dt; if (e.x < 120 || e.x > G.w.W - 120) { e.dir *= -1; e.x = U.clamp(e.x, 120, G.w.W - 120); } }
      if (e.bubbleT <= 0) { e.bubble = G.settings.chatter ? U.pick(e.lines) : null; e.bubbleT = U.rand(10, 25); e.bubbleLife = 4.5; }
      if (e.bubble) { e.bubbleLife -= dt; if (e.bubbleLife <= 0) e.bubble = null; }
    }
  }

  /* ================================================================ render */
  function drawSprite(ctx, img, x, y, ox, oy, flip, alpha = 1) {
    if (alpha <= 0) return;
    if (alpha < 1) ctx.globalAlpha = alpha;
    if (flip) { ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(-1, 1); ctx.drawImage(img, -ox, -oy); ctx.restore(); }
    else ctx.drawImage(img, Math.round(x - ox), Math.round(y - oy));
    if (alpha < 1) ctx.globalAlpha = 1;
  }
  function playerFrame() {
    const P = G.P, s = S();
    if (P.rope) return P.climbing ? (Math.floor(P.animT * 6) % 2 ? 'climb1' : 'climb0') : 'climb0';
    if (P.knockT > 0) return 'hurt';
    if (P.actT > 0 && P.anim) {
      const k = 1 - P.actT / P.actDur;
      if (P.anim === 'swing') return k < 0.3 ? 'swing0' : k < 0.6 ? 'swing1' : 'swing2';
      if (P.anim === 'shoot') return k < 0.45 ? 'shoot0' : 'shoot1';
      return k < 0.4 ? 'cast0' : 'cast1';
    }
    if (!P.onGround) return 'jump';
    if (Math.abs(P.vx) > 12) return 'walk' + (Math.floor(P.animT * 8) % 4);
    return Math.floor(P.animT * 1.6) % 2 ? 'stand1' : 'stand0';
  }

  function render(ctx, fctx) {
    const w = G.w; if (!w) return;
    const vw = G.view.w, vh = G.view.h, sc = G.view.scale;
    let cx = G.cam.x, cy = G.cam.y;
    if (G.shake > 0 && G.settings.shake) { cx += U.rand(-G.shake, G.shake) * 0.5; cy += U.rand(-G.shake, G.shake) * 0.5; }
    const cam = { x: Math.round(cx), y: Math.round(cy) };
    World.drawBack(ctx, w, cam, vw, vh, G.t);
    const X = x => Math.round(x - cam.x), Y = y => Math.round(y - cam.y);
    for (const p of w.portals) World.drawPortal(ctx, p, cam, G.t);
    if (w.def.town) drawWaystone(ctx, X(D.WAYSTONE_X), Y(w.gy));
    // npcs + extras
    for (const n of G.npcs) {
      const ch = n._ch || (n._ch = Art.character(n.look, { style: 'npc', hat: { style: n.look.hat, col: [n.look.robe, n.look.trim] } }));
      drawSprite(ctx, ch.frames[Math.floor(G.t * 1.2 + n.x) % 2 ? 'stand1' : 'stand0'], X(n.x), Y(n.y), ch.ox, ch.oy, n.x > G.P.x);
    }
    for (const e of G.extras) {
      const ch = e._ch || (e._ch = Art.character(e.look, e.vis));
      const fr = e.walk ? 'walk' + (Math.floor(G.t * 8) % 4) : Math.floor(G.t * 1.5) % 2 ? 'stand1' : 'stand0';
      drawSprite(ctx, ch.frames[fr], X(e.x), Y(e.y), ch.ox, ch.oy, e.dir < 0);
    }
    // drops
    for (const d of G.drops) {
      const bob = d.landed ? Math.sin(G.t * 3 + d.x) * 1.5 - 2 : 0;
      const ic = d.coins ? Art.itemIcon('coins').canvas : Art.itemIcon(d.id).canvas;
      const rar = d.inst ? d.inst.rar : 0;
      if (rar >= 1 && d.landed) { const col = D.RARITY[rar].col; ctx.fillStyle = U.rgba(col, 0.25 + 0.1 * Math.sin(G.t * 4)); ctx.fillRect(X(d.x) - 3, Y(d.y) - 48, 6, 46); ctx.fillStyle = U.rgba(col, 0.5); ctx.fillRect(X(d.x) - 1, Y(d.y) - 52, 2, 50); }
      const s = d.coins ? 0.6 : 0.75;
      ctx.drawImage(ic, X(d.x) - 12 * s, Y(d.y + bob) - 22 * s, 24 * s, 24 * s);
    }
    // mobs
    for (const m of G.mobs) {
      const spr = m.spr;
      if (!m.def.fly && m.onGround) { ctx.fillStyle = 'rgba(40,20,50,0.18)'; Art.E(ctx, X(m.x), Y(m.y) - 1, m.w * 0.42, 2.5); ctx.fill(); }
      let img;
      if (m.hurtT > 0.15) img = spr.frames.flash[0];
      else if (m.hurtT > 0 || m.dead) img = spr.frames.hurt[0];
      else if (m.atkT > 0 || m.tele) img = spr.frames.atk[0];
      else { const set = m.walking || m.def.fly || !m.onGround ? spr.frames.move : spr.frames.idle; img = set[Math.floor(m.anim * (m.def.fly ? 6 : 3.4)) % 2]; }
      const alpha = m.dead ? 1 - m.deadT * 2 : m.fade;
      let yy = m.y;
      if (m.def.beh === 'float') yy += Math.sin(m.anim * 2) * 1.5;
      drawSprite(ctx, img, X(m.x), Y(yy), spr.ox, spr.oy, m.dir < 0, alpha);
      if (m.frozen > 0) { ctx.fillStyle = 'rgba(170,230,255,0.55)'; Art.rr(ctx, X(m.x) - m.w * 0.55, Y(m.y) - m.h * 1.05, m.w * 1.1, m.h * 1.05, 4); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(X(m.x) - m.w * 0.35, Y(m.y) - m.h * 0.9, 2, m.h * 0.5); }
      if (m.stun > 0) { for (let i = 0; i < 3; i++) { const a = G.t * 5 + i * 2.1; Art.star(ctx, X(m.x) + Math.cos(a) * 8, Y(m.y - m.h) - 5 + Math.sin(a) * 2, 2.6, 1.1, 5, '#ffe35a'); } }
      if (m.burn > 0 && Math.random() < 0.3) G.parts.push({ x: m.x + U.rand(-m.w / 3, m.w / 3), y: m.y - U.rand(0, m.h), vx: 0, vy: -30, life: 0.4, col: U.pick(['#ff7a3a', '#ffcf3f']), g: 0, s: 1 });
      if (!m.dead && (m.hp < m.maxHp) && !m.boss) {
        const bw = Math.max(18, Math.min(40, m.w)); const bx = X(m.x) - bw / 2, by = Y(m.y - m.h) - 8;
        ctx.fillStyle = '#2a1a33'; ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
        ctx.fillStyle = '#ff5a6b'; ctx.fillRect(bx, by, Math.max(1, Math.round(bw * m.hp / m.maxHp)), 2);
      }
      if (m.tele && m.tele.kind !== 'rain') { ctx.fillStyle = '#ff5a5a'; Art.rr(ctx, X(m.x) - 3, Y(m.y - m.h) - 18, 6, 10, 2); ctx.fill(); ctx.fillRect(X(m.x) - 3, Y(m.y - m.h) - 6, 6, 3); }
    }
    // player
    const P = G.P;
    if (P.dead) { const g = Art.ghostSprite(); drawSprite(ctx, g, X(P.x), Y(P.y), 14, 28, false, 0.9); }
    else {
      if (!P.spr) P.spr = Art.character(G.pl.look, playerVis());
      for (const gh of P.ghosts) drawSprite(ctx, P.spr.frames.swing1, X(gh.x), Y(gh.y), P.spr.ox, P.spr.oy, P.dir < 0, 0.35 * (1 - gh.t / 0.25));
      const blink = P.invuln > 0 && Math.floor(P.invuln * 12) % 2 === 0;
      drawSprite(ctx, P.spr.frames[playerFrame()], X(P.x), Y(P.y), P.spr.ox, P.spr.oy, P.dir < 0 && !P.rope, blink ? 0.45 : 1);
    }
    // projectiles
    for (const p of G.projs) drawProj(ctx, p, X(p.x), Y(p.y));
    for (const f of G.fx) drawFx(ctx, f, X(f.x), Y(f.y));
    for (const q of G.parts) { ctx.fillStyle = q.col; ctx.fillRect(X(q.x), Y(q.y), q.s || 1, q.s || 1); }
    if (G.ambient) World.drawParticles(ctx, G.ambient, G.ambientKind, vw, vh, Main.dt(), G.t, cam);
    // overlay text layer
    fctx.clearRect(0, 0, fctx.canvas.width, fctx.canvas.height);
    drawOverlay(fctx, cam, sc);
  }

  function drawWaystone(ctx, x, y) {
    const t = G.t;
    ctx.fillStyle = 'rgba(160,140,255,0.22)'; Art.E(ctx, x, y - 2, 18, 4); ctx.fill();
    Art.rr(ctx, x - 9, y - 8, 18, 8, 2); ctx.fillStyle = '#8a7ab0'; ctx.fill();
    const fy = y - 30 + Math.sin(t * 2) * 2;
    ctx.beginPath(); ctx.moveTo(x, fy - 14); ctx.lineTo(x + 7, fy); ctx.lineTo(x, fy + 14); ctx.lineTo(x - 7, fy); ctx.closePath();
    ctx.fillStyle = Art.lg(ctx, x - 7, fy - 14, x + 7, fy + 14, '#e8e0ff', '#8f7bff'); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(x - 3, fy - 6, 2, 6);
    for (let i = 0; i < 4; i++) { const a = t * 1.8 + i * 1.57; ctx.fillStyle = '#d8ccff'; ctx.fillRect(Math.round(x + Math.cos(a) * 13), Math.round(fy + Math.sin(a) * 5), 2, 2); }
  }

  function drawProj(ctx, p, x, y) {
    const ang = Math.atan2(p.vy, p.vx);
    const spr = Art.projSprite(p.kind === 'arrowDown' ? 'arrow' : p.kind);
    if (spr) { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.drawImage(spr, -spr.width / 2, -spr.height / 2); ctx.restore(); return; }
    const col = { orb: '#c9b8ff', arcane: '#8fb0ff', fire: '#ff7a3a', holy: '#ffe08a' }[p.kind] || '#ffffff';
    for (let i = 4; i >= 1; i--) { ctx.fillStyle = U.rgba(col, 0.15 * (5 - i)); Art.E(ctx, x - Math.cos(ang) * i * 3, y - Math.sin(ang) * i * 3, 3 + (4 - i) * 0.4, 3 + (4 - i) * 0.4); ctx.fill(); }
    Art.E(ctx, x, y, p.kind === 'fire' ? 4.5 : 3.6, p.kind === 'fire' ? 3.6 : 3.6); ctx.fillStyle = Art.rg(ctx, x, y, 4, col, 0.7, 0.1); ctx.fill();
    if (p.kind === 'holy') { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 6 * Math.sign(p.vx), y - 0.5, 6 * Math.sign(p.vx), 1); }
  }

  function drawFx(ctx, f, x, y) {
    const k = f.t / f.dur, a = 1 - k;
    const col = f.col || '#ffffff';
    switch (f.kind) {
      case 'slash': case 'slashBig': case 'slashArc': case 'slashX': case 'holySlam': {
        const size = f.size || 16, dir = f.dir || 1;
        const arcs = f.kind === 'slashX' ? [[-1, 0], [1, 0.35]] : [[1, 0]];
        for (const [flip, delay] of arcs) {
          const kk = U.clamp((k - delay) / (1 - delay), 0, 1); if (kk <= 0) continue;
          ctx.save(); ctx.translate(x, y); ctx.scale(dir, flip);
          const start = -Math.PI * 0.65, end = start + Math.PI * 1.1 * Math.min(1, kk * 1.6);
          ctx.lineCap = 'round';
          ctx.strokeStyle = U.rgba(col, 0.55 * (1 - kk)); ctx.lineWidth = f.kind === 'slash' ? 4 : 7; ctx.beginPath(); ctx.arc(-size * 0.2, 0, size, start, end); ctx.stroke();
          ctx.strokeStyle = `rgba(255,255,255,${(0.95 * (1 - kk)).toFixed(2)})`; ctx.lineWidth = f.kind === 'slash' ? 1.6 : 2.6; ctx.beginPath(); ctx.arc(-size * 0.2, 0, size, start, end); ctx.stroke();
          ctx.restore();
        }
        if (f.kind === 'holySlam' && k < 0.6) { ctx.fillStyle = U.rgba('#ffe08a', 0.5 * a); ctx.fillRect(x - 6, y - 50, 12, 60); }
        break;
      }
      case 'shock': case 'holyRing': {
        const rx = (f.rx || 80) * (0.3 + k * 0.7);
        ctx.strokeStyle = U.rgba(f.kind === 'holyRing' ? '#ffe35a' : col, a); ctx.lineWidth = 3;
        Art.E(ctx, x, y - (f.kind === 'holyRing' ? 18 : 0), rx, f.kind === 'holyRing' ? rx * 0.5 : rx * 0.18); ctx.stroke();
        if (f.kind === 'holyRing') { for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4 + k; Art.star(ctx, x + Math.cos(an) * rx, y - 18 + Math.sin(an) * rx * 0.5, 3, 1.2, 4, U.rgba('#ffffff', a)); } }
        else for (let i = 0; i < 6; i++) { ctx.fillStyle = U.rgba('#c8a070', a); ctx.fillRect(x + (i - 2.5) * rx / 3, y - 4 - Math.sin(k * Math.PI) * 10 * ((i % 2) + 0.5), 3, 3); }
        break;
      }
      case 'ice': {
        const n = 7, rx = f.rx || 90;
        for (let i = 0; i < n; i++) {
          const sx = x + (i - (n - 1) / 2) * (rx * 2 / n), h = (18 + (i % 3) * 7) * Math.min(1, k * 4);
          Art.tri(ctx, [sx - 5, y], [sx + 1, y - h], [sx + 5, y], U.rgba('#bff0ff', a)); Art.tri(ctx, [sx - 1, y], [sx + 1, y - h], [sx + 2, y], U.rgba('#ffffff', a));
        }
        break;
      }
      case 'thunder': {
        if (k > 0.7) break;
        ctx.strokeStyle = U.rgba('#fff6a0', 1 - k); ctx.lineWidth = 3; ctx.beginPath();
        let lx = x, ly = y - (f.h || 20) / 2 - 160; ctx.moveTo(lx, ly);
        while (ly < y - (f.h || 20) / 2) { lx = x + U.rand(-7, 7); ly += U.rand(10, 18); ctx.lineTo(lx, ly); }
        ctx.stroke(); ctx.strokeStyle = U.rgba('#ffffff', 1 - k); ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = U.rgba('#fff6a0', 0.6 * (1 - k)); Art.E(ctx, x, y - (f.h || 20) / 2, 14, 14); ctx.fill();
        break;
      }
      case 'pillar': {
        const w2 = 10 * Math.sin(Math.min(1, k * 2) * Math.PI / 2) * a + 2;
        ctx.fillStyle = U.rgba('#fff6c0', 0.7 * a); ctx.fillRect(x - w2, y - 200, w2 * 2, 200);
        ctx.fillStyle = U.rgba('#ffffff', 0.9 * a); ctx.fillRect(x - w2 / 3, y - 200, w2 * 0.66, 200);
        Art.E(ctx, x, y, w2 * 2, 4); ctx.fillStyle = U.rgba('#ffe35a', 0.6 * a); ctx.fill();
        break;
      }
      case 'claw': {
        for (let i = 0; i < 3; i++) { const o = (i - 1) * 5; ctx.strokeStyle = U.rgba('#c9a8ff', a); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x - 9 + o, y - (f.h || 20) - 4); ctx.lineTo(x + 7 + o, y + 2); ctx.stroke(); ctx.strokeStyle = U.rgba('#ffffff', a); ctx.lineWidth = 0.8; ctx.stroke(); }
        break;
      }
      case 'heal': case 'buff': {
        const c = f.kind === 'heal' ? '#7ee08a' : col;
        ctx.strokeStyle = U.rgba(c, a); ctx.lineWidth = 2; Art.E(ctx, x, y - 2, 16 + k * 10, 4 + k * 2); ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const px = x + Math.cos(i * 1.05) * 12, py = y - 6 - k * 34 - (i % 3) * 6;
          if (f.kind === 'heal') { ctx.fillStyle = U.rgba('#ffffff', a); ctx.fillRect(px - 2, py - 0.5, 4, 1.5); ctx.fillRect(px - 0.75, py - 2, 1.5, 4); }
          else Art.tri(ctx, [px - 2.5, py + 2], [px, py - 2.5], [px + 2.5, py + 2], U.rgba(c, a));
        }
        break;
      }
      case 'blink': for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4; const r = 4 + k * 16; ctx.fillStyle = U.rgba(i % 2 ? '#ffffff' : col, a); ctx.fillRect(Math.round(x + Math.cos(an) * r), Math.round(y + Math.sin(an) * r), 2, 2); } break;
      case 'boom': { const r = (f.r || 40) * (0.4 + k * 0.6); ctx.fillStyle = U.rgba('#ffcf5a', 0.6 * a); Art.E(ctx, x, y, r, r * 0.8); ctx.fill(); ctx.fillStyle = U.rgba('#ff6a3a', 0.7 * a); Art.E(ctx, x, y, r * 0.6, r * 0.5); ctx.fill(); break; }
      case 'poof': { const r = (f.r || 12) * (0.5 + k * 0.8); for (let i = 0; i < 6; i++) { const an = i * 1.05; ctx.fillStyle = U.rgba('#ffffff', 0.7 * a); Art.E(ctx, x + Math.cos(an) * r * 0.7, y + Math.sin(an) * r * 0.5, r * 0.4, r * 0.35); ctx.fill(); } break; }
      case 'levelup': {
        const h = 120 * Math.min(1, k * 3);
        ctx.fillStyle = U.rgba('#fff3a0', 0.45 * a); ctx.fillRect(x - 14, y - h, 28, h);
        ctx.fillStyle = U.rgba('#ffffff', 0.6 * a); ctx.fillRect(x - 5, y - h, 10, h);
        for (let i = 0; i < 10; i++) { const an = i * 0.63 + G.t * 3; Art.star(ctx, x + Math.cos(an) * 20, y - 20 - ((k * 60 + i * 9) % 70), 3, 1.3, 5, U.rgba(i % 2 ? '#ffe35a' : '#ffffff', a)); }
        break;
      }
      case 'warn': { ctx.strokeStyle = `rgba(255,80,90,${(0.4 + 0.5 * Math.abs(Math.sin(f.t * 14))).toFixed(2)})`; ctx.lineWidth = 2; Art.E(ctx, x, y, f.r || 30, Math.max(3, (f.r || 30) * 0.15)); ctx.stroke(); ctx.fillStyle = 'rgba(255,80,90,0.15)'; ctx.fill(); break; }
      case 'alert': { ctx.fillStyle = '#ffe35a'; Art.rr(ctx, x - 3, y - 14, 6, 10, 2); ctx.fill(); ctx.fillRect(x - 3, y - 2, 6, 3); break; }
      case 'dash': break;
    }
  }

  function drawOverlay(c, cam, sc) {
    const SX = x => (x - cam.x) * sc, SY = y => (y - cam.y) * sc;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const tag = (txt, x, y, bg = 'rgba(30,20,45,0.72)', fg = '#ffffff', size = 11) => {
      c.font = `700 ${size}px Nunito, "Trebuchet MS", sans-serif`;
      const w = c.measureText(txt).width + 10;
      c.fillStyle = bg; c.beginPath(); c.roundRect ? c.roundRect(x - w / 2, y - size * 0.72, w, size * 1.45, 5) : c.rect(x - w / 2, y - 8, w, 16); c.fill();
      c.fillStyle = fg; c.fillText(txt, x, y + 0.5);
    };
    const P = G.P;
    for (const n of G.npcs) {
      tag(n.name, SX(n.x), SY(n.y) + 10, 'rgba(40,25,60,0.78)', '#ffe9a8');
      tag(n.title, SX(n.x), SY(n.y) + 26, 'rgba(255,255,255,0.75)', '#5a3a6a', 10);
      const mark = npcMark(n.id);
      if (mark) { c.font = '800 22px Fredoka, Nunito, sans-serif'; c.lineWidth = 4; c.strokeStyle = '#5a3a1a'; const yy = SY(n.y - 56) + Math.sin(G.t * 4) * 3; c.strokeText(mark, SX(n.x), yy); c.fillStyle = mark === '?' ? '#7ee08a' : '#ffd23f'; c.fillText(mark, SX(n.x), yy); }
    }
    if (G.w.def.town) tag('Waystone · travel', SX(D.WAYSTONE_X), SY(G.w.gy) + 10, 'rgba(60,40,110,0.78)', '#e0d8ff');
    for (const e of G.extras) {
      tag(e.name, SX(e.x), SY(e.y) + 10, 'rgba(30,20,45,0.6)', '#ffffff', 10);
      if (e.bubble) bubble(c, e.bubble, SX(e.x), SY(e.y - 52));
    }
    if (!P.dead) tag(G.pl.name, SX(P.x), SY(P.y) + 10, 'rgba(30,20,45,0.8)', '#ffffff');
    for (const m of G.mobs) {
      if (m.dead) continue;
      if (m.boss || m === G.lastHit) tag(`Lv.${m.def.lv} ${m.def.name}`, SX(m.x), SY(m.y) + 10, m.boss ? 'rgba(120,20,50,0.8)' : 'rgba(30,20,45,0.55)', m.boss ? '#ffd0d8' : '#ffffff', m.boss ? 12 : 10);
    }
    // interact hints
    if (!P.dead) {
      const p = nearPortal(), n = nearNpc();
      if (p) tag('W  enter ' + D.MAPS[p.to].name, SX(p.x), SY(p.y - 56), 'rgba(60,40,110,0.85)', '#ffffff', 11);
      else if (n) tag('W  talk', SX(P.x), SY(P.y - 64), 'rgba(60,40,110,0.85)', '#ffffff', 11);
    }
    // damage text
    for (const t of G.texts) {
      const k = t.t, rise = k * 26 * sc / 2;
      const alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      const crit = t.kind === 'crit';
      const size = (crit ? 24 : t.kind === 'hit' ? 19 : 16) * (sc / 2) * (k < 0.08 ? 1.3 : 1);
      c.globalAlpha = alpha;
      c.font = `800 ${size}px Fredoka, Nunito, sans-serif`;
      const str = typeof t.v === 'number' ? U.fmt(t.v) : t.v;
      const cols = { hit: ['#fff3a0', '#ff9a3a'], crit: ['#ffd0f0', '#ff3a8a'], hurt: ['#e8d8ff', '#9a5aff'], heal: ['#d8ffe0', '#3ac86a'], mp: ['#d8ecff', '#3a8aff'], coin: ['#fff6c0', '#e8a020'], dot: ['#ffd8b0', '#ff7a3a'], miss: ['#ffffff', '#8a8aa8'] }[t.kind] || ['#fff', '#888'];
      const x = SX(t.x), y = SY(t.y) - rise;
      c.lineWidth = Math.max(3, size * 0.24); c.strokeStyle = '#2a1a33'; c.lineJoin = 'round'; c.strokeText(str, x, y);
      const g = c.createLinearGradient(0, y - size / 2, 0, y + size / 2); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
      c.fillStyle = g; c.fillText(str, x, y);
      if (crit && k < 0.5) { c.font = `800 ${size * 0.5}px Fredoka, Nunito, sans-serif`; c.fillStyle = '#ffffff'; c.strokeText('CRITICAL', x, y - size * 0.75); c.fillText('CRITICAL', x, y - size * 0.75); }
      c.globalAlpha = 1;
    }
    // banner
    if (G.banner) {
      const b = G.banner, k = b.t;
      const a = k < 0.3 ? k / 0.3 : k > 2.4 ? Math.max(0, 1 - (k - 2.4) / 0.6) : 1;
      c.globalAlpha = a;
      const cx = c.canvas.width / 2, cy = c.canvas.height * 0.24;
      c.font = `800 ${Math.round(34 * Math.min(1.4, sc / 2 + 0.3))}px Fredoka, Nunito, sans-serif`;
      c.lineWidth = 7; c.strokeStyle = b.warn ? '#5a1020' : '#3a2050'; c.strokeText(b.text, cx, cy);
      const g = c.createLinearGradient(0, cy - 20, 0, cy + 20); g.addColorStop(0, b.warn ? '#ffd0d8' : b.gold ? '#fff6c0' : '#ffffff'); g.addColorStop(1, b.warn ? '#ff5a7a' : b.gold ? '#ffb347' : '#c9b8ff');
      c.fillStyle = g; c.fillText(b.text, cx, cy);
      if (b.sub) { c.font = `700 ${Math.round(15 * Math.min(1.4, sc / 2 + 0.3))}px Nunito, sans-serif`; c.lineWidth = 4; c.strokeText(b.sub, cx, cy + 32); c.fillStyle = '#ffffff'; c.fillText(b.sub, cx, cy + 32); }
      c.globalAlpha = 1;
    }
  }
  function bubble(c, txt, x, y) {
    c.font = '700 11px Nunito, sans-serif';
    const w = Math.min(200, c.measureText(txt).width + 14);
    c.fillStyle = 'rgba(255,255,255,0.95)'; c.strokeStyle = '#5a3a6a'; c.lineWidth = 1.5;
    c.beginPath(); c.roundRect ? c.roundRect(x - w / 2, y - 12, w, 22, 8) : c.rect(x - w / 2, y - 12, w, 22); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x - 4, y + 10); c.lineTo(x, y + 16); c.lineTo(x + 4, y + 10); c.fill();
    c.fillStyle = '#3a2a4a'; c.fillText(txt, x, y - 1, 190);
  }
  function npcMark(id) {
    let mark = null;
    for (const q of D.QUESTS) {
      if (q.giver !== id) continue;
      const st = questState(q);
      if (st === 'ready') return '?';
      if (st === 'available' && q.type !== 'job') mark = '!';
      if (q.type === 'job' && G.pl.job === 'beginner' && G.pl.lv >= 10) mark = '!';
    }
    return mark;
  }

  function setView(w, h, scale) { G.view = { w, h, scale }; if (G.ambientKind) G.ambient = World.makeParticles(G.ambientKind, w, h); }

  return { G, newPlayer, calc, S, makeItem, itemStats, itemName, canEquip, addItem, countItem, removeItem, equip, unequip, playerVis, changeMap, update, render, setView,
    castSkill, useItem, useHotkey, learn, canLearn, skillLv, jobChain, autoAp, addAp, questState, questReady, acceptQuest, completeQuest, advanceJob, buy, sell, sellPrice, sellAllEtc, enhance, revive, interact, gainExp, spawnBoss, tabOf };
})();
