'use strict';
// DOM interface: HUD, hotbar, minimap and all the draggable windows.
const UI = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const flags = new Set();
  const wins = {};
  const winPos = {};
  let z = 10, hoverBind = null, invTab = 'equip', invSel = null, skillTab = null, shopTab = 'buy', enhSel = null, enhCharm = false, confirmDrop = false;
  let lastHud = {};
  const G = () => Game.G;

  function dirty(part) { if (part === 'all') ['hud', 'inv', 'char', 'skills', 'quest', 'hotbar', 'shop', 'enh', 'npc'].forEach(p => flags.add(p)); else flags.add(part); if (part === 'inv') { flags.add('shop'); flags.add('enh'); flags.add('hotbar'); flags.add('char'); } if (part === 'hud') flags.add('hotbar'); }

  /* ---------------------------------------------------------------- windows */
  function openWin(id, title, opts = {}) {
    let w = wins[id];
    if (!w) {
      w = document.createElement('section');
      w.className = 'win ' + (opts.cls || ''); w.dataset.id = id;
      w.innerHTML = `<header class="win-h"><span class="win-t"></span><button class="win-x" type="button" aria-label="Close">×</button></header><div class="win-b"></div>`;
      $('#windows').appendChild(w);
      wins[id] = w;
      w.querySelector('.win-x').addEventListener('click', () => closeWin(id));
      drag(w, w.querySelector('.win-h'), id);
      w.addEventListener('mousedown', () => { w.style.zIndex = ++z; });
      const p = winPos[id];
      if (p) { w.style.left = p[0] + 'px'; w.style.top = p[1] + 'px'; }
      else { w.style.left = (opts.x ?? Math.max(10, (innerWidth - (opts.w || 360)) / 2)) + 'px'; w.style.top = (opts.y ?? Math.max(10, innerHeight * 0.12)) + 'px'; }
      if (opts.w) w.style.width = opts.w + 'px';
    }
    w.querySelector('.win-t').textContent = title;
    w.hidden = false; w.style.zIndex = ++z;
    clampWin(w); requestAnimationFrame(() => clampWin(w));
    return w.querySelector('.win-b');
  }
  function clampWin(w) {
    const r = w.getBoundingClientRect();
    const x = U.clamp(r.left, 0, Math.max(0, innerWidth - Math.min(r.width, innerWidth)));
    const y = U.clamp(r.top, 0, Math.max(0, Math.min(innerHeight - 60, innerHeight - r.height - 10)));
    w.style.left = x + 'px'; w.style.top = y + 'px';
  }
  function closeWin(id) { const w = wins[id]; if (w && !w.hidden) { w.hidden = true; Sound.sfx('click'); if (id === 'npc') { closeWin('shop'); closeWin('enh'); } hideTip(); return true; } return false; }
  function isOpen(id) { return wins[id] && !wins[id].hidden; }
  function toggle(id, fn) { if (isOpen(id)) closeWin(id); else { fn(); Sound.sfx('click'); } }
  function drag(w, handle, id) {
    let sx, sy, ox, oy, on = false;
    handle.addEventListener('mousedown', e => { if (e.target.closest('button')) return; on = true; sx = e.clientX; sy = e.clientY; ox = w.offsetLeft; oy = w.offsetTop; e.preventDefault(); });
    addEventListener('mousemove', e => { if (!on) return; w.style.left = (ox + e.clientX - sx) + 'px'; w.style.top = (oy + e.clientY - sy) + 'px'; });
    addEventListener('mouseup', () => { if (on) { on = false; clampWin(w); winPos[id] = [w.offsetLeft, w.offsetTop]; } });
  }
  function closeTop() {
    const open = Object.entries(wins).filter(([, w]) => !w.hidden).sort((a, b) => (+b[1].style.zIndex) - (+a[1].style.zIndex));
    if (!open.length) return false;
    if (open[0][0] === 'revive') return true;
    return closeWin(open[0][0]);
  }

  /* ---------------------------------------------------------------- tooltip */
  const tip = () => $('#tip');
  function showTip(html, e) { const t = tip(); t.innerHTML = html; t.hidden = false; moveTip(e); }
  function moveTip(e) { const t = tip(); if (t.hidden) return; const r = t.getBoundingClientRect(); let x = e.clientX + 16, y = e.clientY + 14; if (x + r.width > innerWidth - 6) x = e.clientX - r.width - 12; if (y + r.height > innerHeight - 6) y = innerHeight - r.height - 6; t.style.left = x + 'px'; t.style.top = Math.max(4, y) + 'px'; }
  function hideTip() { tip().hidden = true; hoverBind = null; }
  addEventListener('mousemove', moveTip);

  function statLine(k, v, cmp) {
    const names = { atk: 'Attack', def: 'Defense', hp: 'Max HP', mp: 'Max MP', str: 'STR', dex: 'DEX', int: 'INT', wis: 'WIS', crit: 'Crit %', speed: 'Speed %' };
    let d = '';
    if (cmp !== undefined && cmp !== v) { const diff = v - cmp; d = ` <span class="${diff > 0 ? 'up' : 'dn'}">(${diff > 0 ? '+' : ''}${diff})</span>`; }
    return `<div class="tl"><span>${names[k] || k}</span><b>+${v}</b>${d}</div>`;
  }
  function itemTip(inst, extra = '') {
    const b = D.ITEMS[inst.id];
    const R = D.RARITY[inst.rar || 0];
    let h = `<div class="tt-name" style="color:${b.kind === 'weapon' || b.kind === 'armor' || b.kind === 'acc' ? R.col : '#fff6e0'}">${esc(Game.itemName(inst))}</div>`;
    if (b.kind === 'weapon' || b.kind === 'armor' || b.kind === 'acc') {
      const slotName = { weapon: D.WTYPES[b.wtype]?.label || 'Weapon', hat: 'Hat', top: 'Outfit', gloves: 'Gloves', shoes: 'Shoes', acc: 'Accessory' }[b.slot];
      h += `<div class="tt-sub">${R.name} ${slotName}${b.fam ? ' · ' + D.JOBS[b.fam].name : ' · Any job'}</div>`;
      const pl = G().pl, req = pl.lv >= b.lv;
      h += `<div class="tt-req ${req ? '' : 'bad'}">Requires level ${b.lv}</div>`;
      if (b.fam && D.JOBS[pl.job].fam !== b.fam) h += `<div class="tt-req bad">Your job can't equip this</div>`;
      const s = Game.itemStats(inst), cur = pl.eq[b.slot] && pl.eq[b.slot].uid !== inst.uid ? Game.itemStats(pl.eq[b.slot]) : null;
      for (const k of ['atk', 'def', 'hp', 'mp', 'str', 'dex', 'int', 'wis', 'crit', 'speed']) if (s[k] || (cur && cur[k])) h += statLine(k, s[k], cur ? cur[k] : undefined);
      if (b.kind === 'weapon') h += `<div class="tt-note">${b.spd <= 0.42 ? 'Fast' : b.spd <= 0.48 ? 'Normal' : 'Slow'} attack speed</div>`;
      h += `<div class="tt-note">Enhanced +${inst.enh || 0} / ${D.ENH_MAX}</div>`;
    } else {
      if (b.desc) h += `<div class="tt-desc">${esc(b.desc)}</div>`;
      if (b.kind === 'use') h += `<div class="tt-note">Hover and press 1–0 to put it on the hotbar.</div>`;
    }
    const price = Game.sellPrice(inst.n ? { ...inst, n: 1 } : inst);
    if (price) h += `<div class="tt-price">Sells for ${U.fmt(price)} coins${inst.n > 1 ? ' each' : ''}</div>`;
    return h + extra;
  }
  function skillTip(sk) {
    const L = Game.skillLv(sk.id);
    let h = `<div class="tt-name">${esc(sk.name)}</div><div class="tt-sub">${D.JOBS[sk.job].name} · ${sk.kind === 'passive' ? 'Passive' : 'Active'} · Lv ${L}/${sk.max}</div>`;
    if (sk.req) h += `<div class="tt-req ${Game.skillLv(sk.req[0]) >= sk.req[1] ? '' : 'bad'}">Requires ${esc(D.SKILLS[sk.req[0]].name)} Lv ${sk.req[1]}</div>`;
    if (L) h += `<div class="tt-desc"><b>Now:</b> ${esc(sk.desc(L))}${sk.mp ? ` <span class="mpc">${sk.mp(L)} MP</span>` : ''}</div>`;
    if (L < sk.max) h += `<div class="tt-desc dim"><b>Next:</b> ${esc(sk.desc(L + 1))}${sk.mp ? ` <span class="mpc">${sk.mp(L + 1)} MP</span>` : ''}</div>`;
    if (sk.kind !== 'passive') h += `<div class="tt-note">Hover and press 1–0, or drag it onto the hotbar.</div>`;
    return h;
  }

  function iconImg(url, cls = '') { return `<img class="ico ${cls}" src="${url}" alt="" draggable="false">`; }
  function slotHTML(inst, attrs = '') {
    if (!inst) return `<div class="slot empty" ${attrs}></div>`;
    const b = D.ITEMS[inst.id];
    const rar = inst.rar || 0;
    return `<div class="slot r${rar}" ${attrs}>${iconImg(Art.itemIcon(inst.id).url)}${inst.n > 1 ? `<span class="qty">${inst.n}</span>` : ''}${inst.enh ? `<span class="enh">+${inst.enh}</span>` : ''}${b.kind !== 'etc' && b.kind !== 'use' && G().pl.lv < b.lv ? '<span class="lock"></span>' : ''}</div>`;
  }

  /* ---------------------------------------------------------------- HUD */
  function buildHud() {
    $('#hud').innerHTML = `
      <div id="mini"><div class="mm-name"></div><div class="mm-lv"></div><canvas id="mmc" width="200" height="60"></canvas><div class="mm-boss"></div></div>
      <nav id="menu">
        <button data-w="char" title="Character (C)"><b>C</b>Character</button>
        <button data-w="inv" title="Bag (I)"><b>I</b>Bag</button>
        <button data-w="skills" title="Skills (K)"><b>K</b>Skills<span class="dot" id="spdot" hidden></span></button>
        <button data-w="quest" title="Quests (L)"><b>L</b>Quests</button>
        <button data-w="map" title="World map (M)"><b>M</b>Map</button>
        <button data-w="settings" title="Settings (Esc)"><b>⚙</b>Settings</button>
      </nav>
      <div id="buffs"></div>
      <div id="qtrack"></div>
      <div id="bossbar" hidden><div class="bb-name"></div><div class="bb-bar"><i></i></div><div class="bb-num"></div></div>
      <div id="log"></div>
      <div id="status">
        <div class="st-id"><div class="st-lv">Lv.<b id="h-lv">1</b></div><div class="st-nm"><b id="h-name"></b><span id="h-job"></span></div></div>
        <div class="st-bars">
          <div class="bar hp"><i id="h-hpb"></i><span id="h-hp"></span></div>
          <div class="bar mp"><i id="h-mpb"></i><span id="h-mp"></span></div>
        </div>
        <div id="hotbar"></div>
        <div class="st-coin"><img id="coinico" alt=""><span id="h-coins"></span></div>
      </div>
      <div id="expbar"><i id="h-expb"></i><span id="h-exp"></span><em id="h-rates"></em></div>`;
    $('#coinico').src = Art.itemIcon('coins').url;
    $('#menu').addEventListener('click', e => { const b = e.target.closest('button'); if (b) openByKey(b.dataset.w); });
    const hb = $('#hotbar');
    hb.innerHTML = Array.from({ length: 10 }, (_, i) => `<div class="hk" data-i="${i}"><span class="key">${(i + 1) % 10}</span><div class="hk-in"></div><div class="cd"></div><span class="hq"></span></div>`).join('');
    hb.addEventListener('click', e => { const s = e.target.closest('.hk'); if (s) Game.useHotkey(+s.dataset.i); });
    hb.addEventListener('contextmenu', e => { const s = e.target.closest('.hk'); if (s) { e.preventDefault(); G().pl.hotbar[+s.dataset.i] = null; dirty('hotbar'); } });
    hb.addEventListener('dragover', e => { if (e.target.closest('.hk')) e.preventDefault(); });
    hb.addEventListener('drop', e => { const s = e.target.closest('.hk'); if (!s) return; e.preventDefault(); const v = e.dataTransfer.getData('text/plain'); bindValue(v, +s.dataset.i); });
    hb.addEventListener('mouseover', e => { const s = e.target.closest('.hk'); if (!s) return; const h = G().pl.hotbar[+s.dataset.i]; if (!h) return; showTip(h.t === 's' ? skillTip(D.SKILLS[h.id]) : itemTip({ id: h.id, n: Game.countItem(h.id) }) + '<div class="tt-note">Right-click to clear this key.</div>', e); });
    hb.addEventListener('mouseout', hideTip);
  }
  function bindValue(v, i) {
    if (!v) return;
    const [t, id] = v.split(':');
    const pl = G().pl;
    if (t === 's') { const sk = D.SKILLS[id]; if (!sk || sk.kind === 'passive' || !Game.skillLv(id)) return; }
    pl.hotbar = pl.hotbar.map(h => (h && h.t === t && h.id === id) ? null : h);
    pl.hotbar[i] = { t, id };
    Sound.sfx('equip'); dirty('hotbar');
  }

  function renderHud() {
    const g = G(), pl = g.pl, s = Game.S();
    const set = (id, v) => { if (lastHud[id] !== v) { lastHud[id] = v; const el = document.getElementById(id); if (el) el.textContent = v; } };
    set('h-lv', pl.lv); set('h-name', pl.name); set('h-job', D.JOBS[pl.job].name);
    set('h-hp', `${U.fmt(pl.hp)} / ${U.fmt(s.maxHp)}`); set('h-mp', `${U.fmt(pl.mp)} / ${U.fmt(s.maxMp)}`);
    $('#h-hpb').style.width = (100 * pl.hp / s.maxHp).toFixed(1) + '%';
    $('#h-mpb').style.width = (100 * pl.mp / s.maxMp).toFixed(1) + '%';
    const need = D.expNeed(pl.lv), ep = pl.lv >= D.MAX_LV ? 100 : 100 * pl.exp / need;
    $('#h-expb').style.width = ep.toFixed(2) + '%';
    set('h-exp', pl.lv >= D.MAX_LV ? 'MAX LEVEL' : `EXP ${U.fmt(pl.exp)} / ${U.fmt(need)}  (${ep.toFixed(2)}%)`);
    const st = g.settings;
    set('h-rates', `EXP ×${st.expRate} · Drops ×${st.dropRate} · Coins ×${st.coinRate}`);
    set('h-coins', U.fmt(pl.coins));
    $('#spdot').hidden = !(pl.sp > 0 || pl.ap > 0);
  }
  function renderHotbar() {
    const pl = G().pl;
    document.querySelectorAll('#hotbar .hk').forEach((el, i) => {
      const h = pl.hotbar[i], inn = el.querySelector('.hk-in'), q = el.querySelector('.hq');
      if (!h) { inn.innerHTML = ''; q.textContent = ''; el.draggable = false; el.classList.remove('off'); return; }
      const url = h.t === 's' ? Art.skillIcon(D.SKILLS[h.id]).url : Art.itemIcon(h.id).url;
      if (inn.dataset.u !== url) { inn.innerHTML = iconImg(url); inn.dataset.u = url; }
      if (h.t === 'i') { const n = Game.countItem(h.id); q.textContent = n; el.classList.toggle('off', n === 0); }
      else { const sk = D.SKILLS[h.id], L = Game.skillLv(h.id); q.textContent = L ? sk.mp(L) : ''; el.classList.toggle('off', !L || pl.mp < sk.mp(L)); }
    });
  }
  function tickHotbarCd() {
    const g = G(), pl = g.pl;
    document.querySelectorAll('#hotbar .hk').forEach((el, i) => {
      const h = pl.hotbar[i], cd = el.querySelector('.cd');
      let k = 0;
      if (h && h.t === 's') { const sk = D.SKILLS[h.id], rem = g.cds[h.id] || 0; if (rem > 0 && sk.cd) k = rem / sk.cd(Game.skillLv(h.id) || 1); }
      cd.style.height = (k * 100).toFixed(0) + '%';
    });
  }
  function renderBuffs() {
    const g = G();
    const html = Object.values(g.buffs).map(b => `<div class="buff" title="${esc(b.name)}">${iconImg(Art.skillIcon(D.SKILLS[b.id]).url)}<span>${Math.ceil(b.until - g.t)}s</span></div>`).join('');
    const el = $('#buffs'); if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
  }
  function renderQuestTrack() {
    const pl = G().pl;
    const rows = D.QUESTS.filter(q => pl.quests[q.id] && pl.quests[q.id].st === 'active').map(q => {
      const st = pl.quests[q.id], ready = Game.questReady(q);
      const prog = q.type === 'kill' ? `${D.MOBS[q.target].name} ${st.n}/${q.n}` : q.type === 'collect' ? `${D.ITEMS[q.target].name} ${Math.min(q.n, Game.countItem(q.target))}/${q.n}` : '';
      return `<div class="qt ${ready ? 'ready' : ''}"><b>${esc(q.name)}</b><span>${ready ? `Return to ${D.NPCS[q.giver].name}` : prog}</span></div>`;
    }).join('');
    $('#qtrack').innerHTML = rows;
  }
  function renderMini() {
    const g = G(), w = g.w; if (!w) return;
    $('.mm-name').textContent = w.def.name; $('.mm-lv').textContent = w.def.lv;
    const c = $('#mmc'), ctx = c.getContext('2d');
    const sx = c.width / w.W, sy = c.height / w.H;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (const p of w.plats) ctx.fillRect(p.x * sx, p.y * sy, Math.max(2, p.w * sx), p.ground ? 3 : 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; for (const r of w.ropes) ctx.fillRect(r.x * sx, r.y1 * sy, 1, (r.y2 - r.y1) * sy);
    ctx.fillStyle = '#b48cff'; for (const p of w.portals) ctx.fillRect(p.x * sx - 2, p.y * sy - 6, 4, 6);
    ctx.fillStyle = '#ffd36b'; for (const n of g.npcs) ctx.fillRect(n.x * sx - 1.5, n.y * sy - 5, 3, 4);
    for (const m of g.mobs) { if (m.dead) continue; ctx.fillStyle = m.boss ? '#ff3a6a' : '#ff8a8a'; const r = m.boss ? 3 : 1.5; ctx.fillRect(m.x * sx - r, (m.y - m.h / 2) * sy - r, r * 2, r * 2); }
    ctx.fillStyle = '#7ee0ff'; ctx.fillRect(g.P.x * sx - 2, g.P.y * sy - 6, 4, 5);
    const T = g.timers[g.mapId];
    let bossTxt = '';
    if (T && w.def.boss) {
      const alive = g.mobs.filter(m => m.boss && !m.dead).map(m => m.def.name);
      const k = g.settings.bossTimer;
      bossTxt = alive.length ? `<span class="alive">${esc(alive.join(' & '))} is here!</span>` :
        `<span>${esc(D.MOBS[w.def.mini].name)} in ${U.fmtTime(T.mini * k)}</span><span>${esc(D.MOBS[w.def.boss].name)} in ${U.fmtTime(T.boss * k)}</span>`;
    }
    const mb = $('.mm-boss'); if (mb.dataset.h !== bossTxt) { mb.innerHTML = bossTxt; mb.dataset.h = bossTxt; }
    const bb = $('#bossbar'), m = g.bossBar;
    if (m && !m.dead) { bb.hidden = false; bb.querySelector('.bb-name').textContent = `Lv.${m.def.lv} ${m.def.name}${m.def.rank === 'boss' ? '' : ' (mini-boss)'}`; bb.querySelector('i').style.width = (100 * m.hp / m.maxHp).toFixed(1) + '%'; bb.querySelector('.bb-num').textContent = `${U.fmt(m.hp)} / ${U.fmt(m.maxHp)}`; }
    else bb.hidden = true;
  }
  function log(msg, kind = '') {
    const el = $('#log'); if (!el) return;
    const d = document.createElement('div'); d.className = 'lg ' + kind; d.textContent = msg; el.appendChild(d);
    while (el.children.length > 7) el.firstChild.remove();
    setTimeout(() => d.classList.add('fade'), 6000);
  }
  let worldChatT = 20;
  function worldChat(dt) {
    if (!G().settings.chatter) return;
    worldChatT -= dt;
    if (worldChatT > 0) return;
    worldChatT = U.rand(35, 80);
    const who = U.pick(['Mochi_92', 'PinkSlime', 'Hanabi', 'xXBraveXx', 'Tteokbokki', 'SealFan', 'LunaCleric', 'QuietArcher']);
    const msg = U.pick(['anyone selling Honey Ring?', 'LF2M Aurora Seal, need cleric', 'just hit +9 on my staff!!', 'Count Nibbles keeps one-shotting me lol', 'free pudding jelly at the fountain', 'where do snow owls spawn?', 'gm everyone', 'guild Puddingheads recruiting, all levels!', 'Ignis dropped a legendary for me today :D']);
    log(`[World] ${who}: ${msg}`, 'world');
  }
  function toast(msg) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
    $('#toasts').appendChild(el); setTimeout(() => el.remove(), 2200);
    while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
  }

  /* ---------------------------------------------------------------- character */
  function renderChar() {
    if (!isOpen('char')) return;
    const b = wins.char.querySelector('.win-b'), pl = G().pl, s = Game.S(), job = D.JOBS[pl.job];
    const slots = [['hat', 'Hat'], ['weapon', 'Weapon'], ['top', 'Outfit'], ['acc', 'Accessory'], ['gloves', 'Gloves'], ['shoes', 'Shoes']];
    const stats = ['str', 'dex', 'int', 'wis'].map(k => `<div class="stat ${k === job.main ? 'main' : k === job.sub ? 'sub' : ''}"><span>${D.STAT_NAMES[k]}</span><b>${s.st[k]}</b>${s.st[k] !== pl.base[k] ? `<em>(${pl.base[k]}+${s.st[k] - pl.base[k]})</em>` : ''}<button data-ap="${k}" ${pl.ap > 0 ? '' : 'disabled'} aria-label="Add a point to ${D.STAT_NAMES[k]}">+</button></div>`).join('');
    b.innerHTML = `
      <div class="char-top"><canvas id="charpv" width="96" height="96"></canvas>
        <div><div class="char-name">${esc(pl.name)}</div><div class="char-job" style="color:${job.color}">${job.name} · Lv ${pl.lv}</div>
        <div class="char-mini">Kills ${U.fmt(pl.kills)} · Played ${Math.floor(pl.playTime / 3600)}h ${Math.floor(pl.playTime / 60) % 60}m</div></div></div>
      <div class="eqgrid">${slots.map(([k, n]) => `<div class="eqs" data-slot="${k}">${slotHTML(pl.eq[k], `data-eq="${k}"`)}<span>${n}</span></div>`).join('')}</div>
      <div class="hint">Double-click gear to take it off.</div>
      <div class="stats"><div class="ap">Ability points: <b>${pl.ap}</b> <button id="autoap" ${pl.ap ? '' : 'disabled'}>Auto-assign</button></div>${stats}
        <div class="hint">Main stat for ${job.name}: <b>${D.STAT_NAMES[job.main]}</b>, then ${D.STAT_NAMES[job.sub]}.</div></div>
      <div class="derived">
        <div><span>Damage</span><b>${U.fmt(s.minDmg)} – ${U.fmt(s.maxDmg)}</b></div><div><span>Defense</span><b>${s.defT}</b></div>
        <div><span>Max HP</span><b>${U.fmt(s.maxHp)}</b></div><div><span>Max MP</span><b>${U.fmt(s.maxMp)}</b></div>
        <div><span>Crit chance</span><b>${s.crit.toFixed(1)}%</b></div><div><span>Crit damage</span><b>${150 + s.critDmg - 50}%</b></div>
        <div><span>Speed</span><b>${100 + s.speed}%</b></div><div><span>Dodge</span><b>${s.dodge || 0}%</b></div>
      </div>`;
    const pv = $('#charpv'), pctx = pv.getContext('2d'); pctx.imageSmoothingEnabled = false;
    Art.fitChar(pctx, Art.character(pl.look, Game.playerVis()), 'stand0', 96, 96);
    b.querySelectorAll('[data-ap]').forEach(x => x.addEventListener('click', () => Game.addAp(x.dataset.ap)));
    $('#autoap').addEventListener('click', () => { Game.autoAp(); Sound.sfx('click'); });
    b.querySelectorAll('[data-eq]').forEach(el => {
      const k = el.dataset.eq;
      el.addEventListener('dblclick', () => Game.unequip(k));
      el.addEventListener('mouseenter', e => { const inst = pl.eq[k]; if (inst) showTip(itemTip(inst), e); });
      el.addEventListener('mouseleave', hideTip);
    });
  }

  /* ---------------------------------------------------------------- inventory */
  function renderInv() {
    if (!isOpen('inv')) return;
    const b = wins.inv.querySelector('.win-b'), pl = G().pl, arr = pl.inv[invTab];
    const sel = invSel && invSel.tab === invTab ? invSel.idx : -1;
    const selItem = sel >= 0 ? arr[sel] : null;
    const shop = isOpen('shop');
    let actions = '';
    if (selItem) {
      const base = D.ITEMS[selItem.id];
      if (shop) actions += `<button data-a="sell">Sell${selItem.n > 1 ? ' 1' : ''}</button>${selItem.n > 1 ? '<button data-a="sellall">Sell all</button>' : ''}`;
      if (invTab === 'equip') actions += `<button data-a="equip">Equip</button>`;
      if (invTab === 'use') actions += `<button data-a="use">Use</button>`;
      if (!base.quest) actions += confirmDrop ? `<button data-a="dropyes" class="warn">Drop it?</button><button data-a="dropno">Keep</button>` : `<button data-a="drop">Drop</button>`;
    }
    b.innerHTML = `
      <div class="tabs">${['equip', 'use', 'etc'].map(t => `<button data-tab="${t}" class="${t === invTab ? 'on' : ''}">${t === 'equip' ? 'Equip' : t === 'use' ? 'Use' : 'Etc'}</button>`).join('')}<button data-a="sort" class="sort" title="Sort this tab">Sort</button></div>
      <div class="grid">${arr.map((it, i) => slotHTML(it, `data-i="${i}"`).replace('class="slot', `class="slot${i === sel ? ' sel' : ''}`)).join('')}</div>
      <div class="inv-foot"><span class="coins">${iconImg(Art.itemIcon('coins').url)} ${U.fmt(pl.coins)}</span><span class="acts">${actions}</span></div>
      <div class="hint">${shop ? 'Shop open: right-click to sell. ' : ''}Double-click to equip or use. Hover a potion and press 1–0 to bind it.</div>`;
    b.querySelectorAll('[data-tab]').forEach(x => x.addEventListener('click', () => { invTab = x.dataset.tab; invSel = null; confirmDrop = false; renderInv(); }));
    b.querySelectorAll('.grid .slot').forEach(el => {
      const i = +el.dataset.i;
      el.addEventListener('click', () => { invSel = { tab: invTab, idx: i }; confirmDrop = false; renderInv(); });
      el.addEventListener('dblclick', () => { if (invTab === 'equip') Game.equip('equip', i); else if (invTab === 'use') { const it = arr[i]; if (it) Game.useItem(it.id); } });
      el.addEventListener('contextmenu', e => { e.preventDefault(); if (isOpen('shop')) Game.sell(invTab, i, e.shiftKey); else if (invTab === 'equip') Game.equip('equip', i); else if (invTab === 'use' && arr[i]) Game.useItem(arr[i].id); });
      el.addEventListener('mouseenter', e => { const it = arr[i]; if (!it) return; showTip(itemTip(it), e); if (invTab === 'use') hoverBind = 'i:' + it.id; });
      el.addEventListener('mouseleave', hideTip);
      const it = arr[i];
      if (it && invTab === 'use') { el.draggable = true; el.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', 'i:' + it.id)); }
    });
    b.querySelectorAll('[data-a]').forEach(x => x.addEventListener('click', () => {
      const a = x.dataset.a;
      if (a === 'sort') { sortTab(invTab); return; }
      if (!selItem) return;
      if (a === 'equip') Game.equip('equip', sel);
      if (a === 'use') Game.useItem(selItem.id);
      if (a === 'sell') Game.sell(invTab, sel, false);
      if (a === 'sellall') Game.sell(invTab, sel, true);
      if (a === 'drop') { confirmDrop = true; renderInv(); return; }
      if (a === 'dropno') { confirmDrop = false; renderInv(); return; }
      if (a === 'dropyes') { pl.inv[invTab][sel] = null; invSel = null; confirmDrop = false; Sound.sfx('poof'); dirty('inv'); }
    }));
  }
  function sortTab(tab) {
    const arr = G().pl.inv[tab], items = arr.filter(Boolean);
    const order = id => { const b = D.ITEMS[id]; return (b.kind === 'weapon' ? 0 : b.kind === 'armor' ? 1 : 2) * 1000 + (b.lv || 0); };
    items.sort((a, b) => order(a.id) - order(b.id) || (b.rar || 0) - (a.rar || 0));
    for (let i = 0; i < arr.length; i++) arr[i] = items[i] || null;
    invSel = null; dirty('inv'); Sound.sfx('click');
  }

  /* ---------------------------------------------------------------- skills */
  function renderSkills() {
    if (!isOpen('skills')) return;
    const b = wins.skills.querySelector('.win-b'), pl = G().pl;
    const chain = Game.jobChain(pl.job);
    if (!skillTab || !chain.includes(skillTab)) skillTab = chain[chain.length - 1];
    const list = D.skillsOfJob(skillTab);
    const cells = [];
    for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
      const sk = list.find(s => s.pos[0] === col && s.pos[1] === row);
      if (!sk) { cells.push('<div class="sk-cell"></div>'); continue; }
      const L = Game.skillLv(sk.id), can = Game.canLearn(sk);
      const linked = sk.req ? ` linked` : '';
      cells.push(`<div class="sk-cell${linked}"><div class="sk ${L ? 'have' : 'no'} ${sk.kind === 'passive' ? 'pas' : ''}" data-sk="${sk.id}" draggable="${L && sk.kind !== 'passive'}">${iconImg(Art.skillIcon(sk).url)}<div class="sk-t"><b>${esc(sk.name)}</b><span>Lv ${L}/${sk.max}</span></div><button class="sk-up" data-up="${sk.id}" ${can.ok ? '' : 'disabled'} aria-label="Learn ${esc(sk.name)}">+</button></div></div>`);
    }
    const allJobs = ['beginner', ...D.FAMS.filter(f => chain.includes(f)), ...chain.filter(j => D.JOBS[j].tier === 2)];
    b.innerHTML = `<div class="tabs">${allJobs.map(j => `<button data-job="${j}" class="${j === skillTab ? 'on' : ''}">${D.JOBS[j].name}</button>`).join('')}</div>
      <div class="sp">Skill points: <b>${pl.sp}</b></div>
      <div class="sk-grid">${cells.join('')}</div>
      <div class="hint">Lines show prerequisites. Hover an active skill and press 1–0 to bind it, or drag it to the hotbar.${pl.job === 'beginner' ? ' Reach level 10 and see Pip to choose a job.' : D.JOBS[pl.job].tier === 1 ? ' Second job unlocks at level 30.' : ''}</div>`;
    b.querySelectorAll('[data-job]').forEach(x => x.addEventListener('click', () => { skillTab = x.dataset.job; renderSkills(); }));
    b.querySelectorAll('[data-up]').forEach(x => x.addEventListener('click', e => { e.stopPropagation(); Game.learn(x.dataset.up); }));
    b.querySelectorAll('[data-sk]').forEach(el => {
      const sk = D.SKILLS[el.dataset.sk];
      el.addEventListener('mouseenter', e => { showTip(skillTip(sk), e); if (Game.skillLv(sk.id) && sk.kind !== 'passive') hoverBind = 's:' + sk.id; });
      el.addEventListener('mouseleave', hideTip);
      el.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', 's:' + sk.id));
    });
  }

  /* ---------------------------------------------------------------- quests */
  function renderQuests() {
    if (!isOpen('quest')) return;
    const b = wins.quest.querySelector('.win-b'), pl = G().pl;
    const rows = D.QUESTS.map(q => {
      const st = Game.questState(q);
      if (st === 'locked' && pl.lv < q.lv - 8) return '';
      const prog = st === 'active' || st === 'ready' ? (q.type === 'kill' ? `${D.MOBS[q.target].name}: ${pl.quests[q.id].n}/${q.n}` : q.type === 'collect' ? `${D.ITEMS[q.target].name}: ${Math.min(q.n, Game.countItem(q.target))}/${q.n}` : '') : '';
      const label = { done: 'Done', ready: 'Ready', active: 'Active', available: 'Available', locked: `Level ${q.lv}` }[st];
      return `<div class="q ${st}"><div class="q-h"><b>${esc(q.name)}</b><span class="pill ${st}">${label}</span></div>
        <div class="q-d">${st === 'done' ? '' : esc(q.text)}</div>${prog ? `<div class="q-p">${esc(prog)}</div>` : ''}
        <div class="q-g">${st === 'available' ? `Talk to ${D.NPCS[q.giver].name} in Emberfall.` : st === 'ready' ? `Return to ${D.NPCS[q.giver].name}.` : ''}</div></div>`;
    }).join('');
    b.innerHTML = `<div class="qlist">${rows || '<div class="hint">No quests yet.</div>'}</div>`;
  }

  /* ---------------------------------------------------------------- npc */
  function npc(id) {
    if (id === 'waystone') return travel();
    const n = D.NPCS[id], pl = G().pl;
    const body = openWin('npc', `${n.name} · ${n.title}`, { w: 440, cls: 'npcw' });
    let text = '', btns = [];
    const pv = Art.portrait(n.look, { style: 'npc', hat: { style: n.look.hat, col: [n.look.robe, n.look.trim] } }, 2);
    if (id === 'elder') {
      text = 'Welcome to Emberfall, little adventurer! The puddings are bouncy and the skies are kind. What can an old elder do for you?';
      for (const q of D.QUESTS.filter(q => q.giver === 'elder')) {
        const st = Game.questState(q);
        if (st === 'available') btns.push([`Quest: ${q.name}`, () => questOffer(q)]);
        if (st === 'ready') btns.push([`Complete: ${q.name}`, () => questTurnIn(q)]);
        if (st === 'active') btns.push([`About “${q.name}”`, () => say(n, q.text + ' (Still working on it.)')]);
      }
      const next = D.QUESTS.find(q => q.giver === 'elder' && Game.questState(q) === 'locked');
      if (!btns.length && next) text += ` Come back at level ${next.lv}, I may need your help then.`;
    } else if (id === 'pip') {
      const J = D.JOBS[pl.job];
      if (pl.job === 'beginner') {
        if (pl.lv >= 10) { text = 'Level 10! You are ready to choose a path. Each one plays very differently. Take a look.'; btns.push(['Choose my job', jobPick]); }
        else text = `Hello hello! I teach jobs. Come back at level 10 (you are level ${pl.lv}). Clover Meadow, east of town, is a great place to train.`;
      } else if (J.tier === 1) {
        const q = D.QUESTS.find(x => x.id === 'q5'), st = Game.questState(q);
        if (st === 'available') { text = `A fine ${J.name}! At level 30 I can promote you to ${D.JOBS[J.next].name}.`; btns.push([`Trial: ${q.name}`, () => questOffer(q)]); }
        else if (st === 'ready') { text = 'Is that... a Trial Seal? Wonderful!'; btns.push([`Become a ${D.JOBS[J.next].name}`, () => questTurnIn(q)]); }
        else if (st === 'active') text = 'Defeat any mini-boss in the hunting grounds and bring me the Trial Seal. Mini-bosses appear on a timer; check your minimap.';
        else text = `Keep training, ${J.name}. At level 30 you can earn your second job: ${D.JOBS[J.next].name}.`;
      } else text = `A ${J.name}! There is nothing more I can teach you. Go show Ignis what Emberfall is made of.`;
      btns.push(['How do I play?', () => help()]);
    } else if (id === 'lulu') {
      text = 'Hi hi! Potions, scrolls, and sparkly stones! I also buy monster loot. Right-click items in your bag to sell them.';
      btns.push(['Open shop', () => { shop(); }]);
    } else if (id === 'tok') {
      text = 'Hrm. Bring me gear and Enhance Stones and I will make it stronger. Up to +10. Past +5 it can slip a level, and past +8 it might even shatter. A Guardian Charm keeps it safe.';
      btns.push(['Enhance gear', () => enhance()]);
    }
    btns.push(['Goodbye', () => closeWin('npc')]);
    body.innerHTML = `<div class="npc-row"><div class="npc-pv"></div><div class="npc-say">${esc(text)}</div></div><div class="npc-btns"></div>`;
    body.querySelector('.npc-pv').appendChild(pv);
    const bb = body.querySelector('.npc-btns');
    for (const [label, fn] of btns) { const x = document.createElement('button'); x.textContent = label; x.addEventListener('click', () => { Sound.sfx('click'); fn(); }); bb.appendChild(x); }
  }
  function say(n, text, btns = []) {
    const body = openWin('npc', `${n.name} · ${n.title}`, { w: 440, cls: 'npcw' });
    body.querySelector('.npc-say').textContent = text;
    const bb = body.querySelector('.npc-btns'); bb.innerHTML = '';
    for (const [label, fn] of [...btns, ['Back', () => npc(n.id)]]) { const x = document.createElement('button'); x.textContent = label; x.addEventListener('click', () => { Sound.sfx('click'); fn(); }); bb.appendChild(x); }
  }
  function rewardText(q) {
    const r = q.reward, pl = G().pl;
    const parts = [];
    if (r.exp) parts.push(`${U.fmt(Math.round(r.exp * G().settings.expRate))} EXP`);
    if (r.coins) parts.push(`${U.fmt(r.coins)} coins`);
    for (const [id, n] of r.items) parts.push(id === 'legend' ? `${D.ITEMS['w_legend_' + (D.JOBS[pl.job].fam || 'warrior')].name} (legendary)` : `${D.ITEMS[id].name}${n > 1 ? ' ×' + n : ''}`);
    return parts.join(', ');
  }
  function questOffer(q) {
    const n = D.NPCS[q.giver];
    say(n, `${q.text}\n\nReward: ${rewardText(q)}.`, [['Accept', () => { Game.acceptQuest(q.id); say(n, 'Thank you! Good luck out there.'); }]]);
  }
  function questTurnIn(q) {
    const n = D.NPCS[q.giver];
    Game.completeQuest(q.id);
    say(n, `${q.done}\n\nYou received: ${rewardText(q)}.`);
  }
  function jobPick() {
    const body = openWin('npc', 'Pip · Choose your job', { w: 620, cls: 'npcw' });
    const pl = G().pl;
    const cards = D.FAMS.map(f => {
      const J = D.JOBS[f], J2 = D.JOBS[J.next];
      return `<div class="job" data-job="${f}"><canvas width="96" height="96"></canvas><b style="color:${J.color}">${J.name}</b><span class="j2">→ ${J2.name} at Lv 30</span><p>${esc(J.desc)}</p><span class="jm">Main stat: ${D.STAT_NAMES[J.main]}</span><button data-pick="${f}">Become a ${J.name}</button></div>`;
    }).join('');
    body.innerHTML = `<div class="jobs">${cards}</div><div class="hint">Your stats stay as they are; use Auto-assign in the Character window to focus your new main stat. Weapons and armour for other jobs can be sold to Lulu.</div>`;
    body.querySelectorAll('.job').forEach(card => {
      const f = card.dataset.job, cv = card.querySelector('canvas'), ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
      const top = D.ITEMS[`a_${f}_top_0`], hat = D.ITEMS[`a_${f}_hat_0`], wt = Object.keys(D.WTYPES).find(k => D.WTYPES[k].fam === f);
      const ch = Art.character(pl.look, { style: f, top: top.col, hat: { style: Art.HATSTYLE[f], col: hat.col, tier: 0 }, shoes: top.col[0], weapon: { wtype: wt, col: D.TIER_COL[1] } });
      Art.fitChar(ctx, ch, 'stand0', 96, 96);
    });
    body.querySelectorAll('[data-pick]').forEach(x => x.addEventListener('click', () => { Game.advanceJob(x.dataset.pick); closeWin('npc'); openByKey('skills'); }));
  }

  /* ---------------------------------------------------------------- shop */
  function shop() {
    const body = openWin('shop', 'Lulu’s Shop', { w: 400, x: Math.max(10, innerWidth / 2 - 420), y: 70 });
    renderShop();
    if (!isOpen('inv')) openByKey('inv');
    return body;
  }
  function renderShop() {
    if (!isOpen('shop')) return;
    const b = wins.shop.querySelector('.win-b'), pl = G().pl;
    const rows = D.SHOP.map(id => {
      const it = D.ITEMS[id], stack = it.kind === 'use' || it.kind === 'etc';
      return `<div class="shop-row" data-id="${id}">${iconImg(Art.itemIcon(id).url)}<div class="shop-n"><b>${esc(it.name)}</b><span>${U.fmt(it.price)} coins${it.lv ? ' · Lv ' + it.lv : ''}</span></div>${stack ? `<input type="number" min="1" max="300" value="1" aria-label="Quantity" id="q-${id}">` : '<span class="q1">×1</span>'}<button data-buy="${id}" ${pl.coins >= it.price ? '' : 'disabled'}>Buy</button></div>`;
    }).join('');
    b.innerHTML = `<div class="shop-list">${rows}</div><div class="inv-foot"><span class="coins">${iconImg(Art.itemIcon('coins').url)} ${U.fmt(pl.coins)}</span><button id="sellloot">Sell all monster loot</button></div>`;
    b.querySelectorAll('[data-buy]').forEach(x => x.addEventListener('click', () => { const id = x.dataset.buy, q = b.querySelector('#q-' + id); Game.buy(id, q ? U.clamp(parseInt(q.value, 10) || 1, 1, 300) : 1); }));
    b.querySelectorAll('.shop-row').forEach(el => { el.addEventListener('mouseenter', e => showTip(itemTip({ id: el.dataset.id, n: 1, rar: 0, enh: 0, bonus: {} }), e)); el.addEventListener('mouseleave', hideTip); });
    $('#sellloot').addEventListener('click', () => { const t = Game.sellAllEtc(); toast(t ? `Sold loot for ${U.fmt(t)} coins.` : 'No monster loot to sell.'); });
  }

  /* ---------------------------------------------------------------- enhance */
  function enhance() { openWin('enh', 'Tok’s Forge', { w: 460, y: 60 }); renderEnh(); }
  function renderEnh(result) {
    if (!isOpen('enh')) return;
    const b = wins.enh.querySelector('.win-b'), pl = G().pl;
    const list = [];
    for (const [slot, inst] of Object.entries(pl.eq)) if (inst) list.push({ ref: { slot }, inst, where: 'Equipped' });
    pl.inv.equip.forEach((inst, idx) => { if (inst) list.push({ ref: { idx }, inst, where: 'Bag' }); });
    if (enhSel && !list.find(x => x.inst.uid === enhSel)) enhSel = null;
    const cur = list.find(x => x.inst.uid === enhSel);
    let panel = '<div class="enh-empty">Pick a piece of gear on the left.</div>';
    if (cur) {
      const inst = cur.inst, base = D.ITEMS[inst.id], e = inst.enh || 0;
      if (e >= D.ENH_MAX) panel = `<div class="enh-big">${slotHTML(inst)}<b>${esc(Game.itemName(inst))}</b></div><div class="enh-max">Maxed at +${D.ENH_MAX}. Tok is impressed.</div>`;
      else {
        const info = D.ENH[e], cost = D.enhCost(base, e);
        const now = Game.itemStats(inst), nxt = Game.itemStats({ ...inst, enh: e + 1 });
        const keys = ['atk', 'def', 'hp', 'str', 'dex', 'int', 'wis'].filter(k => now[k] || nxt[k]);
        const risk = info.brk ? `Fail: drops a level, or a ${Math.round(info.brk * 100)}% chance it breaks.` : info.down ? 'Fail: drops one level.' : 'Fail: nothing is lost except materials.';
        const stones = Game.countItem('m_stone'), charms = Game.countItem('m_charm');
        panel = `<div class="enh-big">${slotHTML(inst)}<b>${esc(Game.itemName(inst))}</b><span>+${e} → +${e + 1}</span></div>
          <div class="enh-stats">${keys.map(k => `<div><span>${k.toUpperCase()}</span><b>${now[k]}</b><i>→</i><b class="up">${nxt[k]}</b></div>`).join('')}</div>
          <div class="enh-rate"><div class="rate-bar"><i style="width:${info.rate * 100}%"></i></div><b>${Math.round(info.rate * 100)}% success</b></div>
          <div class="enh-risk ${info.down ? 'warn' : ''}">${risk}</div>
          <div class="enh-cost"><span class="${pl.coins >= cost.coins ? '' : 'bad'}">${U.fmt(cost.coins)} coins</span><span class="${stones >= cost.stones ? '' : 'bad'}">${cost.stones} Enhance Stone${cost.stones > 1 ? 's' : ''} (have ${stones})</span></div>
          ${info.down ? `<label class="enh-charm"><input type="checkbox" id="usecharm" ${enhCharm && charms ? 'checked' : ''} ${charms ? '' : 'disabled'}> Use a Guardian Charm (have ${charms})</label>` : ''}
          <button id="doenh" ${pl.coins >= cost.coins && stones >= cost.stones ? '' : 'disabled'}>Enhance</button>
          ${result ? `<div class="enh-res ${result}">${{ success: 'Success! ✨', fail: 'It didn’t take. Try again?', down: 'Oops, it slipped a level.', saved: 'Failed, but the Guardian Charm protected it.', broken: 'It shattered... Tok is very sorry.' }[result]}</div>` : ''}`;
      }
    }
    b.innerHTML = `<div class="enh"><div class="enh-list">${list.map(x => `<div class="enh-it ${x.inst.uid === enhSel ? 'on' : ''}" data-u="${x.inst.uid}">${slotHTML(x.inst)}<div><b>${esc(Game.itemName(x.inst))}</b><span>${x.where}</span></div></div>`).join('') || '<div class="hint">No gear to enhance.</div>'}</div><div class="enh-panel">${panel}</div></div>
      <div class="hint">Enhance Stones drop from monsters (often from bosses) or cost 1,500 at Lulu’s.</div>`;
    b.querySelectorAll('.enh-it').forEach(el => el.addEventListener('click', () => { enhSel = el.dataset.u; Sound.sfx('click'); renderEnh(); }));
    const cb = $('#usecharm'); if (cb) cb.addEventListener('change', () => { enhCharm = cb.checked; });
    const btn = $('#doenh');
    if (btn) btn.addEventListener('click', () => {
      const res = Game.enhance(cur.ref, enhCharm);
      if (!res) return;
      if (res === 'broken') enhSel = null;
      const panelEl = b.querySelector('.enh-panel'); panelEl.classList.remove('flash-ok', 'flash-bad'); void panelEl.offsetWidth;
      renderEnh(res);
      const p2 = b.querySelector('.enh-panel'); p2.classList.add(res === 'success' ? 'flash-ok' : 'flash-bad');
    });
  }

  /* ---------------------------------------------------------------- travel / map / settings / help */
  function travel() {
    const body = openWin('travel', 'Waystone', { w: 360 });
    const pl = G().pl;
    body.innerHTML = `<div class="hint">The Waystone hums. It can send you to any hunting ground you have visited, for free.</div><div class="travel">${D.MAP_ORDER.filter(id => id !== 'town').map(id => {
      const m = D.MAPS[id], ok = pl.visited.includes(id);
      return `<button data-go="${id}" ${ok ? '' : 'disabled'}><b>${m.name}</b><span>${m.lv}${ok ? '' : ' · not visited yet'}</span></button>`;
    }).join('')}</div>`;
    body.querySelectorAll('[data-go]').forEach(x => x.addEventListener('click', () => { closeWin('travel'); Sound.sfx('portal'); Game.changeMap(x.dataset.go, D.MAP_ORDER[D.MAP_ORDER.indexOf(x.dataset.go) - 1]); }));
  }
  function worldMap() {
    const body = openWin('map', 'World Map', { w: 420 });
    const g = G(), pl = g.pl;
    body.innerHTML = `<ol class="wmap">${D.MAP_ORDER.map(id => {
      const m = D.MAPS[id], here = g.mapId === id, seen = pl.visited.includes(id);
      const mons = m.mobs ? m.mobs.map(x => D.MOBS[x].name).join(', ') : 'Elder Momo, Pip, Lulu, Tok';
      return `<li class="${here ? 'here' : ''} ${seen ? '' : 'unseen'}"><div class="wm-h"><b>${m.name}</b><span>${m.lv}</span>${here ? '<em>You are here</em>' : ''}</div><div class="wm-d">${seen ? esc(mons) : '???'}</div>${m.boss && seen ? `<div class="wm-b">Mini-boss: ${D.MOBS[m.mini].name} · Boss: ${D.MOBS[m.boss].name}</div>` : ''}</li>`;
    }).join('')}</ol><div class="hint">Walk through the portals at the edge of each map, or use the Waystone in Emberfall.</div>`;
  }
  const RATE_OPTS = { expRate: [0.5, 1, 2, 3, 5, 10, 20], dropRate: [0.5, 1, 2, 3, 5, 10], coinRate: [0.5, 1, 2, 3, 5, 10], respawn: [0.5, 1, 1.5, 2, 3], bossTimer: [0.1, 0.25, 0.5, 1, 2] };
  function settings(fromTitle) {
    const body = openWin('settings', 'Settings', { w: 420 });
    const s = G().settings;
    const rate = (k, label, help, fmt = v => '×' + v) => { const opts = RATE_OPTS[k], i = Math.max(0, opts.indexOf(s[k])); return `<div class="set"><label for="set-${k}">${label} <b id="v-${k}">${fmt(s[k])}</b></label><input type="range" id="set-${k}" min="0" max="${opts.length - 1}" step="1" value="${i}" data-rate="${k}"><span class="set-h">${help}</span></div>`; };
    const tg = (k, label) => `<label class="tog"><input type="checkbox" data-tog="${k}" ${s[k] ? 'checked' : ''}> ${label}</label>`;
    body.innerHTML = `
      <div class="set-sec">Rates</div>
      ${rate('expRate', 'EXP rate', 'Multiplies EXP from monsters and quests.')}
      ${rate('dropRate', 'Item drop rate', 'Multiplies item drop chances and nudges rarity up.')}
      ${rate('coinRate', 'Coin drop rate', 'Multiplies coins dropped by monsters.')}
      ${rate('respawn', 'Monster respawn speed', 'Higher means monsters come back faster.')}
      ${rate('bossTimer', 'Boss timer', 'Time between mini-boss and boss spawns.', v => v === 1 ? 'normal' : v < 1 ? '×' + v + ' (faster)' : '×' + v + ' (slower)')}
      <div class="set-sec">Sound</div>
      <div class="set"><label for="set-music">Music <b id="v-music">${Math.round(s.music * 100)}%</b></label><input type="range" id="set-music" min="0" max="100" value="${Math.round(s.music * 100)}" data-vol="music"></div>
      <div class="set"><label for="set-sfx">Effects <b id="v-sfx">${Math.round(s.sfx * 100)}%</b></label><input type="range" id="set-sfx" min="0" max="100" value="${Math.round(s.sfx * 100)}" data-vol="sfx"></div>
      <div class="set-sec">Game</div>
      <div class="togs">${tg('autoLoot', 'Auto-loot (off: press Z)')}${tg('dmgNumbers', 'Damage numbers')}${tg('shake', 'Screen shake')}${tg('chatter', 'Town chatter')}</div>
      <div class="set"><label for="set-zoom">Zoom <b id="v-zoom">${s.zoom ? s.zoom + '×' : 'Auto'}</b></label><input type="range" id="set-zoom" min="0" max="4" value="${s.zoom}" data-zoom="1"></div>
      <div class="set-btns">${fromTitle ? '' : '<button id="s-save">Save now</button><button id="s-title">Save and return to title</button>'}<button id="s-full">Fullscreen (F11)</button>${window.desktop ? '<button id="s-quit">Quit game</button>' : ''}</div>`;
    body.querySelectorAll('[data-rate]').forEach(x => x.addEventListener('input', () => { const k = x.dataset.rate, v = RATE_OPTS[k][+x.value]; s[k] = v; $('#v-' + k).textContent = k === 'bossTimer' ? (v === 1 ? 'normal' : v < 1 ? '×' + v + ' (faster)' : '×' + v + ' (slower)') : '×' + v; Main.saveSettings(); dirty('hud'); }));
    body.querySelectorAll('[data-vol]').forEach(x => x.addEventListener('input', () => { s[x.dataset.vol] = +x.value / 100; $('#v-' + x.dataset.vol).textContent = x.value + '%'; Sound.setVol(s.sfx, s.music); Main.saveSettings(); }));
    body.querySelectorAll('[data-tog]').forEach(x => x.addEventListener('change', () => { s[x.dataset.tog] = x.checked; Main.saveSettings(); }));
    const zm = body.querySelector('[data-zoom]'); zm.addEventListener('input', () => { s.zoom = +zm.value; $('#v-zoom').textContent = s.zoom ? s.zoom + '×' : 'Auto'; Main.saveSettings(); Main.resize(); });
    const on = (id, fn) => { const el = $('#' + id); if (el) el.addEventListener('click', fn); };
    on('s-save', () => { Main.save(); toast('Game saved.'); });
    on('s-title', () => { closeWin('settings'); Main.toTitle(); });
    on('s-full', () => Main.fullscreen());
    on('s-quit', () => { Main.save(); window.desktop.quit(); });
  }
  function help() {
    const body = openWin('help', 'How to play', { w: 440 });
    body.innerHTML = `<div class="keys">
      <div><kbd>A</kbd><kbd>D</kbd><span>Walk left and right</span></div>
      <div><kbd>W</kbd><span>Jump. Climb ropes, enter portals, talk to NPCs</span></div>
      <div><kbd>S</kbd><span>Climb down. <kbd>S</kbd>+<kbd>Space</kbd> drops through a platform</span></div>
      <div><kbd>Space</kbd><span>Jump (also jumps off ropes)</span></div>
      <div><kbd>J</kbd><span>Basic attack (hold to keep swinging)</span></div>
      <div><kbd>1</kbd>–<kbd>0</kbd><span>Skills and potions on your hotbar</span></div>
      <div><kbd>E</kbd><span>Interact</span> <kbd>Z</kbd><span>Pick up (if auto-loot is off)</span></div>
      <div><kbd>C</kbd><kbd>I</kbd><kbd>K</kbd><kbd>L</kbd><kbd>M</kbd><span>Character, Bag, Skills, Quests, Map</span></div>
      <div><kbd>Esc</kbd><span>Close a window, or open Settings</span></div>
      <div><kbd>H</kbd><span>This help</span></div></div>
      <div class="hint">Grind monsters for EXP and loot, choose a job at level 10 from Pip, earn your second job at 30, and enhance your gear at Tok’s forge. Bosses appear on a timer in each hunting ground; your minimap shows when. Change EXP and drop rates in Settings.</div>`;
  }
  function reviveDialog() {
    const body = openWin('revive', 'You fainted', { w: 340 });
    body.innerHTML = `<div class="revive"><p>Your little ghost floats back to Emberfall to rest.</p><button id="revive">Return to Emberfall</button></div>`;
    $('#revive').addEventListener('click', () => { closeWin('revive'); Game.revive(); });
  }

  function openByKey(k) {
    if (k === 'char') toggle('char', () => { openWin('char', 'Character', { w: 360, x: 20, y: 70 }); renderChar(); });
    if (k === 'inv') toggle('inv', () => { openWin('inv', 'Bag', { w: 360, x: Math.max(10, innerWidth - 380), y: 70 }); renderInv(); });
    if (k === 'skills') toggle('skills', () => { openWin('skills', 'Skills', { w: 460, y: 70 }); renderSkills(); });
    if (k === 'quest') toggle('quest', () => { openWin('quest', 'Quests', { w: 400, x: Math.max(10, innerWidth - 420), y: 90 }); renderQuests(); });
    if (k === 'map') toggle('map', worldMap);
    if (k === 'settings') toggle('settings', () => settings(false));
    if (k === 'help') toggle('help', help);
  }
  function key(e) {
    const k = e.key.toLowerCase();
    if (/^[0-9]$/.test(k) && hoverBind) { bindValue(hoverBind, (+k + 9) % 10); Input.consume(k); return true; }
    if (k === 'escape') { if (!closeTop()) openByKey('settings'); return true; }
    const map = { c: 'char', i: 'inv', k: 'skills', l: 'quest', m: 'map', h: 'help', f1: 'help' };
    if (map[k]) { openByKey(map[k]); return true; }
    return false;
  }

  let acc = 0;
  function tick(dt) {
    if (!G().pl) return;
    acc += dt; worldChat(dt);
    renderHud();
    if (flags.has('hotbar')) { flags.delete('hotbar'); renderHotbar(); }
    tickHotbarCd();
    if (acc > 0.2) { acc = 0; renderMini(); renderBuffs(); renderHotbar(); }
    if (flags.has('quest')) { flags.delete('quest'); renderQuestTrack(); renderQuests(); }
    if (flags.has('char')) { flags.delete('char'); renderChar(); }
    if (flags.has('inv')) { flags.delete('inv'); renderInv(); }
    if (flags.has('skills')) { flags.delete('skills'); renderSkills(); }
    if (flags.has('shop')) { flags.delete('shop'); renderShop(); }
    if (flags.has('enh')) { flags.delete('enh'); renderEnh(); }
    flags.delete('hud'); flags.delete('npc');
  }
  function onMap() { renderMini(); renderQuestTrack(); }
  function startGame() { buildHud(); $('#hud').hidden = false; for (const id of Object.keys(wins)) wins[id].hidden = true; lastHud = {}; dirty('all'); }
  function stopGame() { $('#hud').hidden = true; for (const id of Object.keys(wins)) wins[id].hidden = true; hideTip(); }

  return { closeTop, dirty, log, toast, npc, reviveDialog, tick, onMap, key, startGame, stopGame, openByKey, settings, help, closeWin, isOpen, esc };
})();
