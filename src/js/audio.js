'use strict';
// Synthesised sound effects and a tiny procedural composer: each map gets its own
// looping tune built from a chord progression, a seeded melody, bass, arps and drums.
const Sound = (() => {
  let ac = null, master, sfxG, musG, musBus, delay, fb, noiseBuf, pulse;
  const vol = { sfx: 0.7, music: 0.5 };
  const last = {};
  let pending = null;

  function init() {
    if (ac) return true;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    master = ac.createGain(); master.connect(ac.destination);
    sfxG = ac.createGain(); sfxG.connect(master);
    musG = ac.createGain(); musG.connect(master);
    musBus = ac.createGain(); musBus.connect(musG);
    delay = ac.createDelay(1); delay.delayTime.value = 0.27; fb = ac.createGain(); fb.gain.value = 0.28;
    const wet = ac.createGain(); wet.gain.value = 0.32;
    musBus.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(musG);
    const len = ac.sampleRate * 0.6; noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const n = 24, re = new Float32Array(n), im = new Float32Array(n), duty = 0.25;
    for (let k = 1; k < n; k++) { re[k] = Math.sin(2 * Math.PI * k * duty) / (k * Math.PI); im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI); }
    pulse = ac.createPeriodicWave(re, im);
    setVol(vol.sfx, vol.music);
    if (pending) { const p = pending; pending = null; bgm(p); }
    return true;
  }
  function resume() { if (init() && ac.state === 'suspended') ac.resume(); }
  function setVol(s, m) { vol.sfx = s; vol.music = m; if (sfxG) { sfxG.gain.value = s * 0.55; musG.gain.value = m * 0.4; } }
  const mf = n => 440 * Math.pow(2, (n - 69) / 12);

  function tone(f, d, o = {}) {
    if (!ac) return;
    const t = ac.currentTime + (o.when || 0);
    const osc = ac.createOscillator(), g = ac.createGain();
    if (o.type === 'pulse') osc.setPeriodicWave(pulse); else osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(f, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f * o.slide), t + d);
    const v = o.vol ?? 0.2, a = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g).connect(o.dest || sfxG); osc.start(t); osc.stop(t + d + 0.03);
  }
  function noise(d, o = {}) {
    if (!ac) return;
    const t = ac.currentTime + (o.when || 0);
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const flt = ac.createBiquadFilter(); flt.type = o.ft || 'bandpass'; flt.frequency.setValueAtTime(o.freq || 2000, t); flt.Q.value = o.q || 1;
    if (o.sweep) flt.frequency.exponentialRampToValueAtTime(o.sweep, t + d);
    const g = ac.createGain(); const v = o.vol ?? 0.2;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(flt).connect(g).connect(o.dest || sfxG); src.start(t); src.stop(t + d + 0.02);
  }
  const arp = (notes, step, o = {}) => notes.forEach((n, i) => tone(mf(n), o.d || 0.12, { ...o, when: (o.when || 0) + i * step }));

  const SFX = {
    jump: () => tone(380, 0.12, { type: 'triangle', slide: 2.1, vol: 0.18 }),
    land: () => noise(0.05, { freq: 400, vol: 0.06 }),
    swing: () => noise(0.12, { freq: 1800, sweep: 600, vol: 0.14, q: 0.8 }),
    hit: () => { tone(220, 0.07, { type: 'square', slide: 0.5, vol: 0.12 }); noise(0.05, { freq: 3000, vol: 0.1 }); },
    crit: () => { tone(520, 0.1, { type: 'square', slide: 0.4, vol: 0.14 }); noise(0.09, { freq: 4500, vol: 0.14 }); tone(1040, 0.08, { type: 'triangle', vol: 0.08, when: 0.02 }); },
    pop: () => { tone(660, 0.09, { type: 'triangle', slide: 1.8, vol: 0.16 }); tone(990, 0.08, { type: 'triangle', vol: 0.1, when: 0.05 }); },
    coin: () => { tone(1319, 0.06, { type: 'square', vol: 0.08 }); tone(1760, 0.12, { type: 'square', vol: 0.08, when: 0.05 }); },
    pickup: () => tone(880, 0.08, { type: 'triangle', slide: 1.5, vol: 0.14 }),
    rare: () => arp([84, 88, 91, 96], 0.06, { type: 'triangle', vol: 0.12, d: 0.22 }),
    levelup: () => { arp([72, 76, 79, 84, 88, 91], 0.07, { type: 'pulse', vol: 0.12, d: 0.25 }); arp([60, 67, 72], 0.14, { type: 'triangle', vol: 0.12, d: 0.5 }); },
    quest: () => arp([79, 84, 88], 0.08, { type: 'triangle', vol: 0.14, d: 0.25 }),
    hurt: () => { tone(300, 0.15, { type: 'sawtooth', slide: 0.45, vol: 0.1 }); },
    faint: () => arp([67, 63, 60, 55], 0.16, { type: 'triangle', vol: 0.14, d: 0.3 }),
    potion: () => { tone(500, 0.15, { type: 'sine', slide: 2, vol: 0.14 }); tone(800, 0.1, { type: 'sine', slide: 1.6, vol: 0.1, when: 0.08 }); },
    portal: () => { tone(300, 0.4, { type: 'sine', slide: 3, vol: 0.14 }); noise(0.35, { freq: 800, sweep: 4000, vol: 0.06 }); },
    click: () => tone(1200, 0.03, { type: 'triangle', vol: 0.08 }),
    error: () => tone(160, 0.14, { type: 'square', vol: 0.08 }),
    equip: () => { noise(0.05, { freq: 2500, vol: 0.08 }); tone(700, 0.06, { type: 'triangle', vol: 0.08, when: 0.03 }); },
    learn: () => arp([76, 83], 0.07, { type: 'triangle', vol: 0.12, d: 0.15 }),
    skill: () => { noise(0.18, { freq: 2600, sweep: 500, vol: 0.18, q: 0.7 }); tone(180, 0.12, { type: 'square', slide: 0.6, vol: 0.08 }); },
    magic: () => { tone(900, 0.18, { type: 'sine', slide: 1.8, vol: 0.12 }); tone(1350, 0.14, { type: 'triangle', slide: 1.4, vol: 0.06, when: 0.03 }); },
    bow: () => { tone(900, 0.05, { type: 'triangle', slide: 0.5, vol: 0.12 }); noise(0.07, { freq: 5000, vol: 0.06 }); },
    fire: () => noise(0.3, { freq: 900, sweep: 300, vol: 0.2, ft: 'lowpass' }),
    ice: () => { arp([96, 100, 103], 0.03, { type: 'triangle', vol: 0.08, d: 0.2 }); noise(0.2, { freq: 6000, vol: 0.08 }); },
    thunder: () => { noise(0.4, { freq: 300, sweep: 80, vol: 0.3, ft: 'lowpass' }); noise(0.12, { freq: 5000, vol: 0.15 }); },
    holy: () => arp([84, 88, 91, 96], 0.04, { type: 'sine', vol: 0.12, d: 0.4 }),
    heal: () => arp([72, 79, 84, 88], 0.06, { type: 'sine', vol: 0.12, d: 0.35 }),
    buff: () => { tone(400, 0.3, { type: 'triangle', slide: 2, vol: 0.12 }); tone(600, 0.3, { type: 'sine', slide: 2, vol: 0.08, when: 0.06 }); },
    blink: () => tone(1500, 0.12, { type: 'sine', slide: 0.4, vol: 0.12 }),
    dash: () => noise(0.25, { freq: 1200, sweep: 300, vol: 0.2 }),
    smash: () => { tone(90, 0.3, { type: 'sine', slide: 0.4, vol: 0.35 }); noise(0.25, { freq: 400, vol: 0.2, ft: 'lowpass' }); },
    boom: () => { tone(110, 0.3, { type: 'sine', slide: 0.3, vol: 0.3 }); noise(0.3, { freq: 600, sweep: 100, vol: 0.25, ft: 'lowpass' }); },
    shoot: () => tone(600, 0.12, { type: 'square', slide: 0.5, vol: 0.08 }),
    roar: () => { tone(110, 0.7, { type: 'sawtooth', slide: 0.6, vol: 0.18 }); noise(0.6, { freq: 300, vol: 0.18, ft: 'lowpass' }); },
    poof: () => noise(0.2, { freq: 1500, sweep: 400, vol: 0.12 }),
    enhanceOk: () => { arp([72, 76, 79, 84, 91, 96], 0.06, { type: 'triangle', vol: 0.14, d: 0.3 }); noise(0.3, { freq: 7000, vol: 0.05, when: 0.3 }); },
    enhanceFail: () => arp([64, 61, 57], 0.12, { type: 'square', vol: 0.08, d: 0.2 }),
    break: () => { noise(0.5, { freq: 3000, sweep: 300, vol: 0.25 }); arp([60, 56, 51], 0.12, { type: 'sawtooth', vol: 0.08, d: 0.3 }); },
  };
  function sfx(name) {
    if (!ac || vol.sfx <= 0) return;
    const now = ac.currentTime;
    if (last[name] && now - last[name] < 0.035) return;
    last[name] = now;
    const f = SFX[name]; if (f) f();
  }

  /* ---------------------------------------------------------------- music */
  const MODES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11], harm: [0, 2, 3, 5, 7, 8, 11] };
  const TRACKS = {
    title: { bpm: 88, root: 67, mode: 'major', prog: [0, 5, 3, 4], seed: 3, lead: 'triangle', drums: 0, bell: true },
    town: { bpm: 96, root: 65, mode: 'major', prog: [0, 3, 5, 4], seed: 11, lead: 'triangle', drums: 1, bell: true },
    meadow: { bpm: 122, root: 62, mode: 'major', prog: [0, 4, 5, 3], seed: 21, lead: 'pulse', drums: 2 },
    forest: { bpm: 108, root: 57, mode: 'dorian', prog: [0, 3, 0, 4], seed: 37, lead: 'triangle', drums: 1 },
    coast: { bpm: 100, root: 60, mode: 'major', prog: [0, 5, 1, 4], seed: 53, lead: 'pulse', drums: 1, swing: true },
    peaks: { bpm: 86, root: 64, mode: 'lydian', prog: [0, 1, 5, 4], seed: 71, lead: 'triangle', drums: 0, bell: true },
    ruins: { bpm: 80, root: 57, mode: 'harm', prog: [0, 5, 3, 4], seed: 89, lead: 'triangle', drums: 1 },
    caldera: { bpm: 132, root: 59, mode: 'minor', prog: [0, 5, 6, 4], seed: 97, lead: 'pulse', drums: 2 },
    boss: { bpm: 150, root: 57, mode: 'harm', prog: [0, 0, 5, 4], seed: 7, lead: 'pulse', drums: 3 },
  };
  function compose(name) {
    const T = TRACKS[name], R = U.seeded(T.seed * 977 + 5), sc = MODES[T.mode];
    const deg = d => { const o = Math.floor(d / 7); return T.root + sc[((d % 7) + 7) % 7] + 12 * o; };
    const bars = 8, steps = 8, len = bars * steps;
    const lead = Array(len).fill(null), bass = Array(len).fill(null), arpN = Array(len).fill(null);
    const rhythms = [[1, 0, 1, 0, 1, 1, 1, 0], [1, 0, 0, 1, 1, 0, 1, 0], [1, 1, 1, 0, 1, 0, 0, 0], [1, 0, 1, 1, 0, 1, 1, 1], [1, 0, 0, 0, 1, 0, 1, 1]];
    const motif = [];
    let cur = 7 + R.int(0, 4);
    for (let b = 0; b < 4; b++) {
      const ch = T.prog[b % T.prog.length], rh = R.pick(rhythms), barNotes = [];
      for (let s = 0; s < steps; s++) {
        if (!rh[s]) { barNotes.push(null); continue; }
        const tones = [ch, ch + 2, ch + 4].map(x => x + 7);
        if (s % 4 === 0) { cur = tones.reduce((a, t) => Math.abs(t - cur) < Math.abs(a - cur) ? t : a, tones[0]); }
        else cur += R.pick([-2, -1, -1, 1, 1, 2, 0]);
        cur = U.clamp(cur, 4, 14);
        barNotes.push(cur);
      }
      motif.push(barNotes);
    }
    for (let b = 0; b < bars; b++) {
      const src = motif[b % 4].slice();
      if (b >= 4) { if (b === 7) { src[6] = null; src[7] = null; src[4] = T.prog[3] + 7; } else if (R() < 0.5) { const i = R.int(1, 7); if (src[i] !== null) src[i] += R.pick([-1, 1, 2]); } }
      const ch = T.prog[b % T.prog.length];
      for (let s = 0; s < steps; s++) {
        const i = b * steps + s;
        if (src[s] !== null) lead[i] = deg(src[s]);
        if (s === 0 || s === 4 || (T.drums >= 2 && s === 6)) bass[i] = deg(ch + (s === 6 ? 4 : 0)) - 24;
        arpN[i] = deg(ch + [0, 2, 4, 7][s % 4]) - 12;
      }
    }
    return { name, T, len, lead, bass, arpN };
  }
  let cur = null, nextT = 0, step = 0, timer = null, trackGain = null;
  function bgm(name) {
    if (cur && cur.name === name) return;
    if (!ac) { pending = name; return; }
    stopBgm();
    cur = compose(name);
    trackGain = ac.createGain(); trackGain.gain.setValueAtTime(0.0001, ac.currentTime); trackGain.gain.linearRampToValueAtTime(1, ac.currentTime + 0.8); trackGain.connect(musBus);
    nextT = ac.currentTime + 0.12; step = 0;
    timer = setInterval(schedule, 25);
  }
  function stopBgm() {
    if (timer) clearInterval(timer); timer = null;
    if (trackGain && ac) { const g = trackGain; g.gain.cancelScheduledValues(ac.currentTime); g.gain.setValueAtTime(g.gain.value, ac.currentTime); g.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.4); setTimeout(() => g.disconnect(), 600); }
    cur = null;
  }
  function note(f, t, d, type, v, dest) {
    const o = ac.createOscillator(), g = ac.createGain();
    if (type === 'pulse') o.setPeriodicWave(pulse); else o.type = type;
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(dest); o.start(t); o.stop(t + d + 0.05);
  }
  function drum(kind, t, dest) {
    if (kind === 'k') { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(g).connect(dest); o.start(t); o.stop(t + 0.2); return; }
    const src = ac.createBufferSource(); src.buffer = noiseBuf; const f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = kind === 'h' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'h' ? 7000 : 1800;
    const d = kind === 'h' ? 0.04 : 0.12, v = kind === 'h' ? 0.08 : 0.2;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f).connect(g).connect(dest); src.start(t); src.stop(t + d + 0.02);
  }
  function schedule() {
    if (!cur || !ac) return;
    const T = cur.T, st = 60 / T.bpm / 2;
    while (nextT < ac.currentTime + 0.15) {
      const i = step % cur.len, s = i % 8;
      const t = nextT + (T.swing && s % 2 ? st * 0.22 : 0);
      const dest = trackGain;
      if (cur.lead[i]) {
        note(mf(cur.lead[i]), t, st * 1.6, T.lead, T.lead === 'pulse' ? 0.06 : 0.11, dest);
        if (T.bell) note(mf(cur.lead[i] + 12), t, st * 2.4, 'sine', 0.035, dest);
      }
      if (cur.bass[i]) note(mf(cur.bass[i]), t, st * 1.8, 'triangle', 0.16, dest);
      if (cur.arpN[i] && (T.drums < 3 || s % 2 === 0)) note(mf(cur.arpN[i]), t, st * 0.9, 'sine', 0.035, dest);
      if (T.drums >= 1) { if (s === 0 || (T.drums >= 2 && s === 4)) drum('k', t, dest); if (T.drums >= 2 && (s === 2 || s === 6)) drum('s', t, dest); if (s % 2 === 1) drum('h', t, dest); if (T.drums >= 3 && s % 2 === 0) drum('k', t, dest); }
      nextT += st; step++;
    }
  }

  return { init, resume, setVol, sfx, bgm, stopBgm, vol };
})();
