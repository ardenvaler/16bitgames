'use strict';
// Input, main loop, save slots, title screen and character creation.
const Input = (() => {
  const down = new Set(), pressed = new Set(), blocked = new Set();
  const GAME_KEYS = new Set([' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'tab']);
  function typing() { const a = document.activeElement; return a && (a.tagName === 'INPUT' && a.type !== 'range' && a.type !== 'checkbox' || a.tagName === 'TEXTAREA'); }
  addEventListener('keydown', e => {
    if (typing()) return;
    const k = e.key.toLowerCase();
    if (GAME_KEYS.has(k)) e.preventDefault();
    if (k === 'f11') { e.preventDefault(); Main.fullscreen(); return; }
    if (e.repeat) return;
    Sound.resume();
    if (Main.state() === 'play' && UI.key(e)) return;
    if (Main.state() !== 'play' && k === 'escape') { UI.closeTop(); return; }
    if (blocked.has(k)) return;
    down.add(k); pressed.add(k);
  });
  addEventListener('keyup', e => { const k = e.key.toLowerCase(); down.delete(k); blocked.delete(k); });
  addEventListener('blur', () => { down.clear(); pressed.clear(); });
  return {
    down: k => down.has(k), pressed: k => pressed.has(k),
    endFrame: () => pressed.clear(),
    consume: k => { down.delete(k); pressed.delete(k); blocked.add(k); },
    clear: () => { down.clear(); pressed.clear(); },
  };
})();

const Main = (() => {
  const SLOTS = 3;
  const KEY = n => `efo-slot-${n}`;
  const DEFAULTS = { expRate: 1, dropRate: 1, coinRate: 1, respawn: 1, bossTimer: 1, autoLoot: true, dmgNumbers: true, shake: true, chatter: true, music: 0.5, sfx: 0.7, zoom: 0 };
  let state = 'title', slot = -1, last = 0, acc = 0, frameDt = 0, saveT = 0;
  let world, fxc, wctx, fctx;
  const title = { t: 0, w: null, mobs: [] };

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } return null; }
  function loadSettings() { let s = {}; try { s = JSON.parse(store('efo-settings') || '{}') || {}; } catch (e) { s = {}; } Game.G.settings = Object.assign({}, DEFAULTS, s); Sound.setVol(Game.G.settings.sfx, Game.G.settings.music); }
  function saveSettings() { store('efo-settings', JSON.stringify(Game.G.settings)); }
  function readSlot(n) { try { const d = JSON.parse(store(KEY(n)) || 'null'); return d && d.v === 1 ? d : null; } catch (e) { return null; } }
  function save() {
    const pl = Game.G.pl;
    if (state !== 'play' || !pl || slot < 0) return;
    const copy = JSON.parse(JSON.stringify(pl, (k, v) => (k === '_s' ? undefined : v)));
    copy.savedAt = Date.now();
    store(KEY(slot), JSON.stringify(copy));
  }

  function resize() {
    const W = innerWidth, H = innerHeight, z = Game.G.settings ? Game.G.settings.zoom : 0;
    const scale = z || Math.max(1, Math.floor(H / 330));
    const vw = Math.ceil(W / scale), vh = Math.ceil(H / scale);
    world.width = vw; world.height = vh;
    world.style.width = vw * scale + 'px'; world.style.height = vh * scale + 'px';
    const dpr = 1;
    fxc.width = W * dpr; fxc.height = H * dpr; fxc.style.width = W + 'px'; fxc.style.height = H + 'px';
    wctx.imageSmoothingEnabled = false;
    Game.setView(vw, vh, scale);
  }
  function fullscreen() {
    if (window.desktop && window.desktop.toggleFullscreen) { window.desktop.toggleFullscreen(); return; }
    try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { /* not allowed here */ }
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; frameDt = dt;
    if (state === 'play') {
      acc += dt;
      const step = 1 / 60;
      let n = 0;
      while (acc >= step && n < 4) { Game.update(step); Input.endFrame(); acc -= step; n++; }
      if (n === 4) acc = 0;
      Game.render(wctx, fctx);
      UI.tick(dt);
      saveT += dt; if (saveT > 30) { saveT = 0; save(); }
    } else {
      renderTitle(dt);
      Input.endFrame();
    }
    requestAnimationFrame(loop);
  }

  /* ---------------------------------------------------------------- title */
  function renderTitle(dt) {
    title.t += dt;
    if (!title.w) {
      title.w = World.get('meadow');
      const ids = ['pudding', 'bunbun', 'pupseal', 'chickpea', 'mushy', 'snailbun', 'sprout'];
      title.mobs = ids.map((id, i) => ({ def: D.MOBS[id], x: 300 + i * 70, dir: i % 2 ? 1 : -1, hop: Math.random() * 6 }));
    }
    const vw = world.width, vh = world.height;
    const cam = { x: 600 + Math.sin(title.t * 0.05) * 400, y: title.w.H - vh };
    World.drawBack(wctx, title.w, cam, vw, vh, title.t);
    const gy = title.w.gy - cam.y;
    for (const m of title.mobs) {
      m.x += m.dir * 18 * dt; if (m.x < cam.x - 40) m.x = cam.x + vw + 30; if (m.x > cam.x + vw + 40) m.x = cam.x - 30;
      const spr = Art.mob(m.def), hop = Math.abs(Math.sin(title.t * 3 + m.hop)) * (m.def.beh === 'hop' ? 8 : 1.5);
      const fr = spr.frames.move[Math.floor(title.t * 4 + m.hop) % 2];
      wctx.save(); wctx.translate(Math.round(m.x - cam.x), Math.round(gy - hop)); if (m.dir < 0) wctx.scale(-1, 1); wctx.drawImage(fr, -spr.ox, -spr.oy); wctx.restore();
    }
    fctx.clearRect(0, 0, fxc.width, fxc.height);
  }

  const HAIRS = ['#6a4a3a', '#2a2a3a', '#ffd36b', '#ff9ac0', '#7ab8ff', '#c0503a', '#b48cff', '#f4f1ff', '#7ee08a'];
  const SKINS = ['#ffe6d0', '#ffd8b8', '#f0c8a0', '#e8b890', '#c8916a', '#9a6a4a'];
  const EYES = ['#3a6ab8', '#c05a8a', '#3a8a5a', '#8a5ab8', '#5a3a2a', '#d08a2a'];
  const HAIR_NAMES = ['Spiky', 'Bob', 'Ponytail', 'Twin buns', 'Long', 'Messy'];
  const draft = { name: '', look: { skin: SKINS[0], hair: HAIRS[0], hairStyle: 0, eyes: EYES[0] } };
  let confirmDel = -1;

  function showTitle() {
    state = 'title';
    const el = document.getElementById('title');
    el.hidden = false;
    const slots = Array.from({ length: SLOTS }, (_, i) => readSlot(i));
    el.innerHTML = `
      <div class="logo"><span class="l1">Emberfall</span><span class="l2">Online</span><span class="tag">a cosy little offline MMO</span></div>
      <div class="slots">${slots.map((d, i) => d ? `
        <div class="card" data-i="${i}"><canvas width="96" height="96"></canvas>
          <div class="c-n">${UI.esc(d.name)}</div><div class="c-j">Lv ${d.lv} ${D.JOBS[d.job].name}</div><div class="c-m">${D.MAPS[d.map] ? D.MAPS[d.map].name : ''}</div>
          <button class="play" data-play="${i}">Play</button>
          ${confirmDel === i ? `<div class="del-confirm"><span>Delete ${UI.esc(d.name)} forever?</span><button data-delyes="${i}" class="warn">Delete</button><button data-delno="1">Keep</button></div>` : `<button class="del" data-del="${i}" aria-label="Delete ${UI.esc(d.name)}">Delete</button>`}
        </div>` : `<div class="card empty"><div class="c-new">Empty slot</div><button class="play" data-new="${i}">New character</button></div>`).join('')}</div>
      <div class="t-btns"><button id="t-settings">Settings</button><button id="t-help">Controls</button>${window.desktop ? '<button id="t-quit">Quit</button>' : ''}</div>
      <div class="t-foot">WASD to move · J to attack · 1–0 for skills · your saves stay on this computer</div>`;
    el.querySelectorAll('.card[data-i]').forEach(card => {
      const d = slots[+card.dataset.i], cv = card.querySelector('canvas'), ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
      Art.fitChar(ctx, Art.character(d.look, Game.playerVis(d)), 'stand0', 96, 96);
    });
    el.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => play(+b.dataset.play)));
    el.querySelectorAll('[data-new]').forEach(b => b.addEventListener('click', () => creator(+b.dataset.new)));
    el.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => { confirmDel = +b.dataset.del; showTitle(); }));
    el.querySelectorAll('[data-delyes]').forEach(b => b.addEventListener('click', () => { store(KEY(+b.dataset.delyes), null); confirmDel = -1; showTitle(); }));
    el.querySelectorAll('[data-delno]').forEach(b => b.addEventListener('click', () => { confirmDel = -1; showTitle(); }));
    document.getElementById('t-settings').addEventListener('click', () => { Sound.resume(); UI.settings(true); });
    document.getElementById('t-help').addEventListener('click', () => UI.help());
    const q = document.getElementById('t-quit'); if (q) q.addEventListener('click', () => window.desktop.quit());
    Sound.bgm('title');
  }

  function creator(n) {
    Sound.resume();
    const el = document.getElementById('title');
    const L = draft.look;
    const sw = (arr, key) => arr.map(c => `<button class="sw ${L[key] === c ? 'on' : ''}" data-k="${key}" data-v="${c}" style="background:${c}" aria-label="${key} colour"></button>`).join('');
    el.innerHTML = `
      <div class="creator">
        <h2>New adventurer</h2>
        <div class="cr-row"><canvas id="crpv" width="160" height="160"></canvas>
          <div class="cr-opts">
            <label for="cr-name">Name</label><input id="cr-name" maxlength="14" value="${UI.esc(draft.name)}" placeholder="Pick a cute name" autocomplete="off">
            <label>Hair style</label><div class="cr-style"><button id="hs-prev" aria-label="Previous style">◀</button><span id="hs-name">${HAIR_NAMES[L.hairStyle]}</span><button id="hs-next" aria-label="Next style">▶</button></div>
            <label>Hair colour</label><div class="sws">${sw(HAIRS, 'hair')}</div>
            <label>Skin</label><div class="sws">${sw(SKINS, 'skin')}</div>
            <label>Eyes</label><div class="sws">${sw(EYES, 'eyes')}</div>
          </div></div>
        <div class="cr-msg" id="cr-msg"></div>
        <div class="t-btns"><button id="cr-back">Back</button><button id="cr-go" class="go">Start adventure</button></div>
      </div>`;
    const draw = () => {
      const cv = document.getElementById('crpv'), ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, 160, 160);
      const vis = { style: 'beginner', top: ['#f4f0e8', '#c8b8a0'], hat: null, gloves: null, shoes: '#8a5a3a', weapon: { wtype: 'sword', col: D.TIER_COL[0] } };
      Art.fitChar(ctx, Art.character(L, vis), 'stand0', 160, 160, 8);
    };
    draw();
    el.querySelectorAll('.sw').forEach(b => b.addEventListener('click', () => { L[b.dataset.k] = b.dataset.v; creator(n); }));
    document.getElementById('hs-prev').addEventListener('click', () => { L.hairStyle = (L.hairStyle + 5) % 6; creator(n); });
    document.getElementById('hs-next').addEventListener('click', () => { L.hairStyle = (L.hairStyle + 1) % 6; creator(n); });
    const nm = document.getElementById('cr-name');
    nm.addEventListener('input', () => { draft.name = nm.value; });
    nm.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    if (!draft.name) nm.focus();
    document.getElementById('cr-back').addEventListener('click', showTitle);
    const go = () => {
      const name = draft.name.trim();
      if (name.length < 2) { document.getElementById('cr-msg').textContent = 'Names need at least 2 characters.'; return; }
      Game.newPlayer(name, { ...L });
      slot = n; state = 'play';
      draft.name = '';
      begin(true);
    };
    document.getElementById('cr-go').addEventListener('click', go);
  }

  function play(n) {
    Sound.resume();
    const d = readSlot(n);
    if (!d) return;
    Game.G.pl = d; slot = n; state = 'play';
    migrate(d);
    begin(false);
  }
  function migrate(d) {
    d.boss = d.boss || {}; d.visited = d.visited || ['town'];
    for (const t of ['equip', 'use', 'etc']) { d.inv[t] = (d.inv[t] || []).concat(Array(48).fill(null)).slice(0, 48).map(x => x && D.ITEMS[x.id] ? x : null); }
    for (const k of Object.keys(d.eq)) if (d.eq[k] && !D.ITEMS[d.eq[k].id]) d.eq[k] = null;
  }
  function begin(fresh) {
    document.getElementById('title').hidden = true;
    UI.closeWin('settings'); UI.closeWin('help');
    const G = Game.G;
    G.buffs = {}; G.cds = {}; G.timers = {};
    Game.calc();
    UI.startGame();
    const pl = G.pl, idx = D.MAP_ORDER.indexOf(pl.map);
    Game.changeMap(D.MAPS[pl.map] ? pl.map : 'town', idx > 0 ? D.MAP_ORDER[idx - 1] : 'town');
    if (fresh) {
      UI.log(`Welcome to Emberfall, ${pl.name}!`, 'good');
      UI.log('Talk to Elder Momo (W) for your first quest.', 'info');
      UI.help();
    } else UI.log(`Welcome back, ${pl.name}.`, 'good');
    saveT = 0;
  }
  function toTitle() { save(); state = 'title'; UI.stopGame(); Game.G.pl = null; Game.G.w = null; showTitle(); }

  function boot() {
    world = document.getElementById('world'); fxc = document.getElementById('fx');
    wctx = world.getContext('2d'); fctx = fxc.getContext('2d');
    loadSettings();
    resize();
    addEventListener('resize', resize);
    addEventListener('beforeunload', save);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
    addEventListener('pointerdown', () => Sound.resume(), { once: false });
    document.addEventListener('contextmenu', e => { if (!e.target.closest('input')) e.preventDefault(); });
    showTitle();
    requestAnimationFrame(t => { last = t; loop(t); });
    window.__efo = { Game, Main, D, UI };
  }

  return { boot, save, saveSettings, resize, fullscreen, toTitle, state: () => state, dt: () => frameDt };
})();

window.addEventListener('DOMContentLoaded', () => Main.boot());
