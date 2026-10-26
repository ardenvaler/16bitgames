'use strict';
// All game content: jobs, skills, items, monsters, maps, quests, NPCs.
const D = (() => {
  const MAX_LV = 70;
  const expNeed = L => Math.round((3 + L) * (4 + 1.6 * Math.pow(L, 1.45)));
  const mobExp = L => Math.round(4 + 1.6 * Math.pow(L, 1.45));
  const mobHp = L => Math.round(15 + 7 * Math.pow(L, 1.45));
  const mobAtk = L => Math.round(6 + 2.6 * Math.pow(L, 1.15));
  const mobDef = L => Math.round(L * 1.1);

  /* ------------------------------------------------------------ jobs */
  const JOBS = {
    beginner: { id: 'beginner', fam: null, tier: 0, name: 'Beginner', main: 'str', sub: 'dex', hp: 12, mp: 6, color: '#f6c56b',
      desc: 'Fresh off the boat in Emberfall. Reach level 10 and visit Pip the Job Master.' },
    warrior: { id: 'warrior', fam: 'warrior', tier: 1, name: 'Warrior', main: 'str', sub: 'dex', hp: 24, mp: 4, next: 'knight', color: '#ff7a6b',
      desc: 'Sturdy front-liner. Swords and axes, lots of HP, hits several monsters at once.' },
    knight: { id: 'knight', fam: 'warrior', tier: 2, name: 'Knight', main: 'str', sub: 'dex', hp: 28, mp: 5, color: '#ff7a6b',
      desc: 'Brandish, Ground Smash and Charge. Built to plough through crowds.' },
    mage: { id: 'mage', fam: 'mage', tier: 1, name: 'Mage', main: 'int', sub: 'wis', hp: 9, mp: 18, next: 'wizard', color: '#8f7bff',
      desc: 'Fragile but deadly from range. Wands and staves, Magic Guard and Teleport.' },
    wizard: { id: 'wizard', fam: 'mage', tier: 2, name: 'Wizard', main: 'int', sub: 'wis', hp: 10, mp: 22, color: '#8f7bff',
      desc: 'Fire, ice and lightning. Freezes packs and rains thunder.' },
    cleric: { id: 'cleric', fam: 'cleric', tier: 1, name: 'Cleric', main: 'wis', sub: 'int', hp: 15, mp: 13, next: 'priest', color: '#ffd36b',
      desc: 'Holy magic with a mace. Heals, blesses, and smites the undead.' },
    priest: { id: 'priest', fam: 'cleric', tier: 2, name: 'Priest', main: 'wis', sub: 'int', hp: 17, mp: 16, color: '#ffd36b',
      desc: 'Holy Symbol boosts EXP, Genesis calls down pillars of light.' },
    archer: { id: 'archer', fam: 'archer', tier: 1, name: 'Archer', main: 'dex', sub: 'str', hp: 15, mp: 8, next: 'ranger', color: '#6fd28a',
      desc: 'Long range and high crits. Bows and crossbows, plus a nimble Leap.' },
    ranger: { id: 'ranger', fam: 'archer', tier: 2, name: 'Ranger', main: 'dex', sub: 'str', hp: 17, mp: 9, color: '#6fd28a',
      desc: 'Strafe, Arrow Rain and Explosive Arrow. Clears the screen from afar.' },
  };
  const FAMS = ['warrior', 'mage', 'cleric', 'archer'];
  const STAT_NAMES = { str: 'STR', dex: 'DEX', int: 'INT', wis: 'WIS' };

  /* ------------------------------------------------------------ skills */
  // kind: melee | proj | aoe | rain | strike | dash | buff | heal | blink | leap | passive
  const S = [];
  const sk = o => { S.push(o); return o; };
  // Beginner
  sk({ id: 'pebble', job: 'beginner', name: 'Pebble Toss', kind: 'proj', max: 3, pos: [0, 0], icon: { g: 'orb', c: '#c9b38a' },
    mp: L => 2, mult: L => 1.0 + 0.15 * L, speed: 260, range: 200, proj: 'pebble', anim: 'cast',
    desc: L => `Throw a pebble for ${pct(1.0 + 0.15 * L)} damage.` });
  sk({ id: 'sprint', job: 'beginner', name: 'Sprint', kind: 'buff', max: 3, pos: [1, 0], icon: { g: 'wing', c: '#7fd6ff' },
    mp: L => 5, buff: { dur: L => 30 + 15 * L, fx: L => ({ speed: 8 * L, jump: 3 * L }) }, anim: 'cast',
    desc: L => `Move ${8 * L}% faster for ${30 + 15 * L}s.` });
  sk({ id: 'nap', job: 'beginner', name: 'Nap Time', kind: 'passive', max: 3, pos: [2, 0], icon: { g: 'moon', c: '#b9a8ff' },
    pas: L => ({ hpRegen: 1 + L }), desc: L => `Recover ${1 + L} extra HP every 5s.` });

  // Warrior / Knight
  sk({ id: 'pstrike', job: 'warrior', name: 'Power Strike', kind: 'melee', max: 10, pos: [0, 0], icon: { g: 'slash', c: '#ff9a5a' },
    mp: L => 4 + L, mult: L => 1.7 + 0.13 * L, targets: L => 1, hits: 1, w: 56, h: 40, fx: 'slashBig', anim: 'swing',
    desc: L => `Heavy blow to one monster for ${pct(1.7 + 0.13 * L)} damage.` });
  sk({ id: 'sblast', job: 'warrior', name: 'Slash Blast', kind: 'melee', max: 10, pos: [0, 1], req: ['pstrike', 3], icon: { g: 'arc', c: '#ffcf5a' },
    mp: L => 8 + L, mult: L => 1.1 + 0.08 * L, targets: L => 4 + Math.floor(L / 3), hits: 1, w: 78, h: 50, fx: 'slashArc', anim: 'swing',
    desc: L => `Sweep up to ${4 + Math.floor(L / 3)} monsters in front for ${pct(1.1 + 0.08 * L)}.` });
  sk({ id: 'ironbody', job: 'warrior', name: 'Iron Body', kind: 'buff', max: 10, pos: [1, 0], icon: { g: 'shield', c: '#a9c1d9' },
    mp: L => 10, buff: { dur: L => 60 + 12 * L, fx: L => ({ def: 10 + 3 * L }) }, anim: 'cast',
    desc: L => `+${10 + 3 * L} DEF for ${60 + 12 * L}s.` });
  sk({ id: 'rage', job: 'warrior', name: 'Rage', kind: 'buff', max: 10, pos: [1, 1], req: ['ironbody', 3], icon: { g: 'up', c: '#ff6b6b' },
    mp: L => 12, buff: { dur: L => 60 + 12 * L, fx: L => ({ atkPct: 4 + 1.5 * L }) }, anim: 'cast',
    desc: L => `+${(4 + 1.5 * L).toFixed(1)}% damage for ${60 + 12 * L}s.` });
  sk({ id: 'swmastery', job: 'warrior', name: 'Weapon Mastery', kind: 'passive', max: 5, pos: [2, 0], icon: { g: 'sword', c: '#ffd36b' },
    pas: L => ({ dmgPct: 2 * L, mastery: 0.04 * L, crit: L }), desc: L => `+${2 * L}% damage, steadier hits, +${L}% crit.` });
  sk({ id: 'ironwill', job: 'warrior', name: 'Iron Will', kind: 'passive', max: 5, pos: [2, 1], icon: { g: 'heart', c: '#ff7a8a' },
    pas: L => ({ hpPct: 4 * L }), desc: L => `+${4 * L}% max HP.` });
  sk({ id: 'brandish', job: 'knight', name: 'Brandish', kind: 'melee', max: 10, pos: [0, 0], icon: { g: 'cross', c: '#ff8a4a' },
    mp: L => 14 + L, mult: L => 1.4 + 0.1 * L, targets: L => 5, hits: 2, w: 84, h: 56, fx: 'slashX', anim: 'swing',
    desc: L => `Two sweeping strikes on up to 5 monsters, ${pct(1.4 + 0.1 * L)} each.` });
  sk({ id: 'gsmash', job: 'knight', name: 'Ground Smash', kind: 'aoe', max: 10, pos: [0, 1], req: ['brandish', 3], icon: { g: 'burst', c: '#e0a060' },
    mp: L => 22 + L, cd: L => 4, mult: L => 2.0 + 0.15 * L, targets: L => 8, hits: 1, rx: 110, ry: 50, fx: 'shock', anim: 'swing', shake: 5, knock: 1,
    desc: L => `Smash the ground. Hits 8 monsters nearby for ${pct(2.0 + 0.15 * L)}. 4s cooldown.` });
  sk({ id: 'charge', job: 'knight', name: 'Charge', kind: 'dash', max: 10, pos: [1, 0], icon: { g: 'dash', c: '#ffb36b' },
    mp: L => 16, cd: L => 3, mult: L => 2.2 + 0.12 * L, targets: L => 8, dist: 130, stun: 1, fx: 'dash', anim: 'swing',
    desc: L => `Dash forward, ramming everything in the way for ${pct(2.2 + 0.12 * L)} and stunning it.` });
  sk({ id: 'warcry', job: 'knight', name: 'War Cry', kind: 'buff', max: 10, pos: [1, 1], req: ['charge', 2], icon: { g: 'star', c: '#ffd36b' },
    mp: L => 25, buff: { dur: L => 60 + 12 * L, fx: L => ({ crit: 10 + L, atkPct: 10 }) }, anim: 'cast',
    desc: L => `+${10 + L}% crit and +10% damage for ${60 + 12 * L}s.` });
  sk({ id: 'finalstrike', job: 'knight', name: 'Final Strike', kind: 'passive', max: 5, pos: [2, 0], icon: { g: 'slash', c: '#ff6b6b' },
    pas: L => ({ finalAtk: 8 + 6 * L }), desc: L => `${8 + 6 * L}% chance to land a bonus hit after any attack.` });
  sk({ id: 'guardian', job: 'knight', name: 'Guardian', kind: 'passive', max: 5, pos: [2, 1], icon: { g: 'shield', c: '#ffd36b' },
    pas: L => ({ dmgTaken: 3 * L, noKnock: L >= 5 }), desc: L => `Take ${3 * L}% less damage.${L >= 5 ? ' No knockback.' : ''}` });

  // Mage / Wizard
  sk({ id: 'mclaw', job: 'mage', name: 'Magic Claw', kind: 'strike', max: 10, pos: [0, 0], icon: { g: 'claw', c: '#b48cff' },
    mp: L => 5 + L, mult: L => 1.0 + 0.08 * L, targets: L => 1, hits: 2, range: 230, fx: 'claw', anim: 'cast',
    desc: L => `Two magic claws on the nearest monster ahead, ${pct(1.0 + 0.08 * L)} each.` });
  sk({ id: 'mbolt', job: 'mage', name: 'Arcane Bolt', kind: 'proj', max: 10, pos: [0, 1], req: ['mclaw', 3], icon: { g: 'orb', c: '#8fb0ff' },
    mp: L => 8 + L, mult: L => 1.8 + 0.12 * L, pierce: 3, speed: 300, range: 280, proj: 'arcane', anim: 'cast',
    desc: L => `Bolt that pierces 3 monsters for ${pct(1.8 + 0.12 * L)}.` });
  sk({ id: 'mguard', job: 'mage', name: 'Magic Guard', kind: 'buff', max: 10, pos: [1, 0], icon: { g: 'shield', c: '#8f7bff' },
    mp: L => 12, buff: { dur: L => 120, fx: L => ({ mguard: 15 + 3 * L }) }, anim: 'cast',
    desc: L => `${15 + 3 * L}% of damage taken comes out of MP instead. 120s.` });
  sk({ id: 'teleport', job: 'mage', name: 'Teleport', kind: 'blink', max: 10, pos: [1, 1], icon: { g: 'wing', c: '#c9b8ff' },
    mp: L => 8, cd: L => 0.5, dist: L => 80 + 8 * L, anim: 'cast',
    desc: L => `Blink ${80 + 8 * L}px forward. Hold W or S to blink up or down.` });
  sk({ id: 'mpboost', job: 'mage', name: 'MP Boost', kind: 'passive', max: 5, pos: [2, 0], icon: { g: 'drop', c: '#6fb8ff' },
    pas: L => ({ mpPct: 6 * L, mpRegen: L }), desc: L => `+${6 * L}% max MP and faster MP recovery.` });
  sk({ id: 'smastery', job: 'mage', name: 'Spell Mastery', kind: 'passive', max: 5, pos: [2, 1], icon: { g: 'book', c: '#b48cff' },
    pas: L => ({ dmgPct: 3 * L, mastery: 0.04 * L }), desc: L => `+${3 * L}% damage and steadier spells.` });
  sk({ id: 'firearrow', job: 'wizard', name: 'Fire Arrow', kind: 'proj', max: 10, pos: [0, 0], icon: { g: 'fire', c: '#ff7a3a' },
    mp: L => 14 + L, mult: L => 2.6 + 0.18 * L, pierce: 1, speed: 330, range: 300, proj: 'fire', elem: 'fire', burn: 1, anim: 'cast',
    desc: L => `Flaming arrow for ${pct(2.6 + 0.18 * L)} that leaves a burn. Fire.` });
  sk({ id: 'icestrike', job: 'wizard', name: 'Ice Strike', kind: 'aoe', max: 10, pos: [0, 1], req: ['firearrow', 3], icon: { g: 'ice', c: '#8fe0ff' },
    mp: L => 24 + L, cd: L => 1.5, mult: L => 1.9 + 0.12 * L, targets: L => 6, hits: 1, rx: 100, ry: 46, ahead: 70, freeze: 1.5, elem: 'ice', fx: 'ice', anim: 'cast',
    desc: L => `Ice spikes burst ahead, hitting 6 monsters for ${pct(1.9 + 0.12 * L)} and freezing them. Ice.` });
  sk({ id: 'thunder', job: 'wizard', name: 'Thunder Spear', kind: 'strike', max: 10, pos: [1, 0], icon: { g: 'bolt', c: '#ffe35a' },
    mp: L => 28 + L, cd: L => 2, mult: L => 2.2 + 0.14 * L, targets: L => 6, hits: 1, range: 230, around: true, elem: 'bolt', fx: 'thunder', anim: 'cast', shake: 3,
    desc: L => `Lightning strikes 6 monsters around you for ${pct(2.2 + 0.14 * L)}. Lightning.` });
  sk({ id: 'meditate', job: 'wizard', name: 'Meditation', kind: 'buff', max: 10, pos: [1, 1], icon: { g: 'up', c: '#b48cff' },
    mp: L => 20, buff: { dur: L => 60 + 12 * L, fx: L => ({ atkPct: 12 + 2 * L }) }, anim: 'cast',
    desc: L => `+${12 + 2 * L}% magic damage for ${60 + 12 * L}s.` });
  sk({ id: 'elemamp', job: 'wizard', name: 'Element Amplify', kind: 'passive', max: 5, pos: [2, 0], icon: { g: 'burst', c: '#ff9a5a' },
    pas: L => ({ dmgPct: 6 * L }), desc: L => `+${6 * L}% spell damage.` });
  sk({ id: 'arcflow', job: 'wizard', name: 'Arcane Flow', kind: 'passive', max: 5, pos: [2, 1], icon: { g: 'drop', c: '#b48cff' },
    pas: L => ({ mpRegen: 2 * L, crit: 2 * L }), desc: L => `Faster MP recovery and +${2 * L}% crit.` });

  // Cleric / Priest
  sk({ id: 'holyarrow', job: 'cleric', name: 'Holy Arrow', kind: 'proj', max: 10, pos: [0, 0], icon: { g: 'arrow', c: '#ffe08a' },
    mp: L => 6 + L, mult: L => 1.5 + 0.12 * L, pierce: 1, speed: 320, range: 260, proj: 'holy', elem: 'holy', anim: 'cast',
    desc: L => `Arrow of light for ${pct(1.5 + 0.12 * L)}. Holy: big damage to undead.` });
  sk({ id: 'smite', job: 'cleric', name: 'Smite', kind: 'melee', max: 10, pos: [0, 1], req: ['holyarrow', 3], icon: { g: 'hammer', c: '#ffd36b' },
    mp: L => 8 + L, mult: L => 2.0 + 0.14 * L, targets: L => 3, hits: 1, w: 62, h: 46, stunChance: 0.2, elem: 'holy', fx: 'holySlam', anim: 'swing',
    desc: L => `Holy blow on up to 3 monsters for ${pct(2.0 + 0.14 * L)}. 20% chance to stun.` });
  sk({ id: 'heal', job: 'cleric', name: 'Heal', kind: 'heal', max: 10, pos: [1, 0], icon: { g: 'plus', c: '#7ee08a' },
    mp: L => 12 + L, cd: L => 1, healPct: L => 0.10 + 0.03 * L, mult: L => 1.2 + 0.1 * L, rx: 120, ry: 60, targets: L => 6, anim: 'cast',
    desc: L => `Heal ${Math.round((0.10 + 0.03 * L) * 100)}% HP + WIS. Burns undead nearby for ${pct(1.2 + 0.1 * L)}.` });
  sk({ id: 'bless', job: 'cleric', name: 'Bless', kind: 'buff', max: 10, pos: [1, 1], icon: { g: 'star', c: '#fff0a0' },
    mp: L => 14, buff: { dur: L => 120, fx: L => ({ def: 8 + 2 * L, atkPct: 2 + L }) }, anim: 'cast',
    desc: L => `+${8 + 2 * L} DEF and +${2 + L}% damage for 120s.` });
  sk({ id: 'macemastery', job: 'cleric', name: 'Faith Mastery', kind: 'passive', max: 5, pos: [2, 0], icon: { g: 'hammer', c: '#e0c070' },
    pas: L => ({ dmgPct: 3 * L, mastery: 0.04 * L }), desc: L => `+${3 * L}% damage and steadier hits.` });
  sk({ id: 'spirit', job: 'cleric', name: 'Spirit Recovery', kind: 'passive', max: 5, pos: [2, 1], icon: { g: 'drop', c: '#7ee0c0' },
    pas: L => ({ mpRegen: 1.5 * L, potion: 6 * L }), desc: L => `Faster MP recovery and potions heal ${6 * L}% more.` });
  sk({ id: 'shiningray', job: 'priest', name: 'Shining Ray', kind: 'aoe', max: 10, pos: [0, 0], icon: { g: 'sun', c: '#ffe35a' },
    mp: L => 22 + L, mult: L => 2.2 + 0.14 * L, targets: L => 6, hits: 1, rx: 95, ry: 55, elem: 'holy', fx: 'holyRing', anim: 'cast',
    desc: L => `Burst of light hits 6 monsters around you for ${pct(2.2 + 0.14 * L)}. Holy.` });
  sk({ id: 'genesis', job: 'priest', name: 'Genesis', kind: 'strike', max: 10, pos: [0, 1], req: ['shiningray', 5], icon: { g: 'pillar', c: '#fff0a0' },
    mp: L => 40 + 2 * L, cd: L => 6, mult: L => 3.0 + 0.2 * L, targets: L => 10, hits: 1, range: 260, around: true, elem: 'holy', fx: 'pillar', anim: 'cast', shake: 4,
    desc: L => `Pillars of light strike 10 monsters for ${pct(3.0 + 0.2 * L)}. 6s cooldown.` });
  sk({ id: 'holysymbol', job: 'priest', name: 'Holy Symbol', kind: 'buff', max: 10, pos: [1, 0], icon: { g: 'sym', c: '#ffd36b' },
    mp: L => 30, buff: { dur: L => 120 + 12 * L, fx: L => ({ expPct: 8 + 2 * L, atkPct: 5 }) }, anim: 'cast',
    desc: L => `+${8 + 2 * L}% EXP and +5% damage for ${120 + 12 * L}s.` });
  sk({ id: 'divshield', job: 'priest', name: 'Divine Shield', kind: 'buff', max: 10, pos: [1, 1], req: ['shiningray', 2], icon: { g: 'shield', c: '#fff4c2' },
    mp: L => 25, buff: { dur: L => 60 + 6 * L, fx: L => ({ dmgTaken: 10 + 2 * L, noKnock: true }) }, anim: 'cast',
    desc: L => `Take ${10 + 2 * L}% less damage and ignore knockback for ${60 + 6 * L}s.` });
  sk({ id: 'grace', job: 'priest', name: 'Grace', kind: 'passive', max: 5, pos: [2, 0], icon: { g: 'plus', c: '#ffe08a' },
    pas: L => ({ healPct: 10 * L, hpPct: 3 * L }), desc: L => `Heal +${10 * L}% stronger and +${3 * L}% max HP.` });
  sk({ id: 'holyfocus', job: 'priest', name: 'Holy Focus', kind: 'passive', max: 5, pos: [2, 1], icon: { g: 'eye', c: '#ffe35a' },
    pas: L => ({ dmgPct: 5 * L, crit: 2 * L }), desc: L => `+${5 * L}% damage and +${2 * L}% crit.` });

  // Archer / Ranger
  sk({ id: 'dshot', job: 'archer', name: 'Double Shot', kind: 'proj', max: 10, pos: [0, 0], icon: { g: 'arrows', c: '#9be07a' },
    mp: L => 4 + L, mult: L => 0.9 + 0.07 * L, count: 2, pierce: 1, speed: 420, range: 300, proj: 'arrow', anim: 'shoot',
    desc: L => `Fire two arrows, ${pct(0.9 + 0.07 * L)} each.` });
  sk({ id: 'arrowblow', job: 'archer', name: 'Arrow Blow', kind: 'proj', max: 10, pos: [0, 1], req: ['dshot', 3], icon: { g: 'arrow', c: '#6fd28a' },
    mp: L => 6 + L, mult: L => 1.6 + 0.12 * L, pierce: 4, speed: 480, range: 330, proj: 'arrowBig', anim: 'shoot',
    desc: L => `A piercing arrow through 4 monsters for ${pct(1.6 + 0.12 * L)}.` });
  sk({ id: 'focus', job: 'archer', name: 'Focus', kind: 'buff', max: 10, pos: [1, 0], icon: { g: 'eye', c: '#9be07a' },
    mp: L => 12, buff: { dur: L => 120, fx: L => ({ crit: 5 + L, atkPct: 5 }) }, anim: 'cast',
    desc: L => `+${5 + L}% crit and +5% damage for 120s.` });
  sk({ id: 'leap', job: 'archer', name: 'Leap', kind: 'leap', max: 10, pos: [1, 1], icon: { g: 'wing', c: '#7fd6ff' },
    mp: L => 5, cd: L => 0.6, dist: L => 150 + 10 * L, anim: 'cast',
    desc: L => `A bounding leap forward (${150 + 10 * L} power). Works in mid-air.` });
  sk({ id: 'bowmastery', job: 'archer', name: 'Bow Mastery', kind: 'passive', max: 5, pos: [2, 0], icon: { g: 'bow', c: '#c9a36a' },
    pas: L => ({ dmgPct: 3 * L, mastery: 0.04 * L }), desc: L => `+${3 * L}% damage and steadier shots.` });
  sk({ id: 'eagleeye', job: 'archer', name: 'Eagle Eye', kind: 'passive', max: 5, pos: [2, 1], icon: { g: 'eye', c: '#ffcf5a' },
    pas: L => ({ critDmg: 8 * L, crit: L }), desc: L => `+${8 * L}% critical damage and +${L}% crit.` });
  sk({ id: 'strafe', job: 'ranger', name: 'Strafe', kind: 'proj', max: 10, pos: [0, 0], icon: { g: 'arrows', c: '#ffcf5a' },
    mp: L => 12 + L, mult: L => 0.9 + 0.06 * L, count: 4, pierce: 1, speed: 460, range: 320, proj: 'arrow', anim: 'shoot',
    desc: L => `Four rapid arrows, ${pct(0.9 + 0.06 * L)} each.` });
  sk({ id: 'arrowrain', job: 'ranger', name: 'Arrow Rain', kind: 'rain', max: 10, pos: [0, 1], req: ['strafe', 3], icon: { g: 'rain', c: '#9be07a' },
    mp: L => 28 + L, cd: L => 3, mult: L => 1.0 + 0.08 * L, count: 9, w: 220, targets: L => 12, anim: 'shoot',
    desc: L => `Nine arrows fall on the area ahead, ${pct(1.0 + 0.08 * L)} each. 3s cooldown.` });
  sk({ id: 'explosive', job: 'ranger', name: 'Explosive Arrow', kind: 'proj', max: 10, pos: [1, 0], icon: { g: 'burst', c: '#ff7a3a' },
    mp: L => 18 + L, mult: L => 2.6 + 0.16 * L, pierce: 1, speed: 400, range: 300, proj: 'boom', blast: 60, targets: L => 6, elem: 'fire', anim: 'shoot',
    desc: L => `Arrow that explodes on impact, hitting 6 monsters for ${pct(2.6 + 0.16 * L)}. Fire.` });
  sk({ id: 'sharpeyes', job: 'ranger', name: 'Sharp Eyes', kind: 'buff', max: 10, pos: [1, 1], icon: { g: 'eye', c: '#ff9a5a' },
    mp: L => 25, buff: { dur: L => 120 + 12 * L, fx: L => ({ crit: 8 + L, critDmg: 10 + 2 * L }) }, anim: 'cast',
    desc: L => `+${8 + L}% crit and +${10 + 2 * L}% crit damage for ${120 + 12 * L}s.` });
  sk({ id: 'evasion', job: 'ranger', name: 'Evasion', kind: 'passive', max: 5, pos: [2, 0], icon: { g: 'wing', c: '#9be07a' },
    pas: L => ({ dodge: 4 * L }), desc: L => `${4 * L}% chance to dodge a hit.` });
  sk({ id: 'marksman', job: 'ranger', name: 'Marksman', kind: 'passive', max: 5, pos: [2, 1], icon: { g: 'bow', c: '#ffcf5a' },
    pas: L => ({ dmgPct: 4 * L, pierce: L >= 5 ? 1 : 0 }), desc: L => `+${4 * L}% damage.${L >= 5 ? ' Arrows pierce one extra monster.' : ''}` });

  function pct(m) { return Math.round(m * 100) + '%'; }
  const SKILLS = {}; for (const s of S) SKILLS[s.id] = s;
  const skillsOfJob = job => S.filter(s => s.job === job);

  /* ------------------------------------------------------------ items */
  const RARITY = [
    { name: 'Common', col: '#f4f1ff', mul: 1.0, bonus: 0 },
    { name: 'Rare', col: '#6fc3ff', mul: 1.1, bonus: 1 },
    { name: 'Epic', col: '#c993ff', mul: 1.22, bonus: 2 },
    { name: 'Legendary', col: '#ffb347', mul: 1.4, bonus: 3 },
  ];
  const ITEMS = {};
  const add = o => { ITEMS[o.id] = o; return o; };

  const WTYPES = {
    sword: { fam: 'warrior', label: 'Sword', mul: 1.0, spd: 0.40, style: 'melee', reach: 46 },
    axe: { fam: 'warrior', label: 'Axe', mul: 1.16, spd: 0.50, style: 'melee', reach: 48 },
    wand: { fam: 'mage', label: 'Wand', mul: 1.0, spd: 0.42, style: 'magic', reach: 210 },
    staff: { fam: 'mage', label: 'Staff', mul: 1.14, spd: 0.50, style: 'magic', reach: 230 },
    mace: { fam: 'cleric', label: 'Mace', mul: 1.08, spd: 0.46, style: 'melee', reach: 44 },
    scepter: { fam: 'cleric', label: 'Scepter', mul: 1.0, spd: 0.44, style: 'magic', reach: 210 },
    bow: { fam: 'archer', label: 'Bow', mul: 1.0, spd: 0.42, style: 'bow', reach: 270 },
    crossbow: { fam: 'archer', label: 'Crossbow', mul: 1.15, spd: 0.52, style: 'bow', reach: 290 },
  };
  const WTIERS = [1, 8, 16, 24, 32, 40, 50, 60];
  // metal + gem colours per tier, used by the weapon art
  const TIER_COL = [
    { m: '#c08a52', g: '#8fd36b' }, { m: '#d49a5a', g: '#ff9c6b' }, { m: '#cfd6e2', g: '#6fb8ff' }, { m: '#ffa08e', g: '#7fe8e0' },
    { m: '#b4e6ff', g: '#e8fbff' }, { m: '#dcd0ff', g: '#b48cff' }, { m: '#ff9a52', g: '#ffe35a' }, { m: '#fff2a8', g: '#ff8ad0' },
  ];
  const WNAMES = {
    sword: ['Twig Sword', 'Bronze Sword', 'Iron Sabre', 'Coral Blade', 'Frostbite Edge', 'Moonlight Sword', 'Emberbrand', 'Starfall Blade'],
    axe: ['Hatchet', 'Bronze Axe', 'Woodsman Axe', 'Anchor Axe', 'Glacier Cleaver', 'Grave Axe', 'Magma Axe', 'Titan Breaker'],
    wand: ['Twig Wand', 'Oak Wand', 'Honey Wand', 'Shell Wand', 'Snowflake Wand', 'Moon Wand', 'Ember Wand', 'Astral Wand'],
    staff: ['Walking Staff', 'Oak Staff', 'Sunflower Staff', 'Coral Staff', 'Frost Staff', 'Lunar Staff', 'Inferno Staff', 'Cosmos Staff'],
    mace: ['Wooden Mallet', 'Bronze Mace', 'Iron Mace', 'Pearl Mace', 'Icicle Mace', 'Moonstone Mace', 'Ember Mace', 'Seraph Mace'],
    scepter: ['Prayer Rod', 'Bronze Scepter', 'Bloom Scepter', 'Tide Scepter', 'Aurora Scepter', 'Holy Moon Scepter', 'Sunfire Scepter', 'Heaven Scepter'],
    bow: ['Practice Bow', 'Hunter Bow', 'Oak Longbow', 'Coral Bow', 'Snowhawk Bow', 'Moonwhisper Bow', 'Flamewing Bow', 'Skyfire Bow'],
    crossbow: ['Toy Crossbow', 'Bronze Crossbow', 'Iron Crossbow', 'Harpoon Crossbow', 'Frost Arbalest', 'Night Arbalest', 'Ember Arbalest', 'Star Arbalest'],
  };
  for (const [wt, info] of Object.entries(WTYPES)) {
    WTIERS.forEach((lv, t) => {
      add({ id: `w_${wt}_${t}`, kind: 'weapon', slot: 'weapon', wtype: wt, tier: t, lv, fam: t === 0 ? null : info.fam,
        name: WNAMES[wt][t], atk: Math.round((8 + lv * 1.9) * info.mul), spd: info.spd, col: TIER_COL[t],
        price: Math.round(40 + lv * lv * 6) });
    });
  }
  // legendary named weapons (final boss / final quest)
  const LEGEND = { warrior: 'sword', mage: 'staff', cleric: 'scepter', archer: 'bow' };
  [['warrior', 'Emberheart Blade'], ['mage', 'Phoenix Staff'], ['cleric', 'Dawnbringer'], ['archer', 'Sunwing Bow']].forEach(([fam, name]) => {
    const wt = LEGEND[fam], info = WTYPES[wt];
    add({ id: `w_legend_${fam}`, kind: 'weapon', slot: 'weapon', wtype: wt, tier: 7, lv: 62, fam, name, unique: true,
      atk: Math.round((8 + 70 * 1.9) * info.mul), spd: info.spd * 0.92, col: { m: '#ffe9a0', g: '#ff5a7a' }, price: 60000 });
  });

  const ASLOTS = ['hat', 'top', 'gloves', 'shoes'];
  const ATIERS = [10, 22, 34, 46, 58];
  const ANAMES = {
    warrior: { pre: ['Bronze', 'Iron', 'Coral', 'Frost', 'Moonsteel'], hat: 'Helm', top: 'Plate', gloves: 'Gauntlets', shoes: 'Greaves' },
    mage: { pre: ['Apprentice', 'Starlit', 'Tidal', 'Aurora', 'Eclipse'], hat: 'Hat', top: 'Robe', gloves: 'Mitts', shoes: 'Slippers' },
    cleric: { pre: ['Novice', 'Blessed', 'Pearl', 'Seraph', 'Lumina'], hat: 'Hood', top: 'Vestment', gloves: 'Gloves', shoes: 'Sandals' },
    archer: { pre: ['Hunter', 'Ranger', 'Gale', 'Snowhawk', 'Nightwing'], hat: 'Cap', top: 'Tunic', gloves: 'Bracers', shoes: 'Boots' },
  };
  const ACOL = {
    warrior: [['#c98b4f', '#ffd36b'], ['#a9b2c3', '#6f86a8'], ['#ff8a7a', '#ffe0a0'], ['#9fd8ff', '#ffffff'], ['#c7b8ff', '#ffe35a']],
    mage: [['#7a6cff', '#ffd36b'], ['#4a3fb0', '#9fe3ff'], ['#2fa6c9', '#ffe0a0'], ['#8fe3d0', '#c993ff'], ['#3b2a5e', '#ff8ad0']],
    cleric: [['#f4efe6', '#d4a24a'], ['#ffe7a3', '#ffffff'], ['#f8d7e8', '#9fd8ff'], ['#ffffff', '#ffcf3f'], ['#fff4c2', '#ff9ac0']],
    archer: [['#7a9a4a', '#c08a52'], ['#4f7a3a', '#e0c070'], ['#6fb8a8', '#fff0a0'], ['#e8f0ff', '#7fb8ff'], ['#3a3550', '#b48cff']],
  };
  const SLOTMUL = { hat: 1.0, top: 1.6, gloves: 0.6, shoes: 0.7 };
  for (const fam of FAMS) {
    ATIERS.forEach((lv, t) => {
      for (const slot of ASLOTS) {
        const n = ANAMES[fam];
        const o = { id: `a_${fam}_${slot}_${t}`, kind: 'armor', slot, fam, tier: t, lv, name: `${n.pre[t]} ${n[slot]}`,
          def: Math.round((1 + lv * 0.5) * SLOTMUL[slot]), col: ACOL[fam][t], price: Math.round(30 + lv * lv * 4) };
        if (slot === 'top') o.hp = Math.round(lv * (fam === 'warrior' ? 5 : 3));
        if (slot === 'hat') o.stat = { [JOBS[fam].main]: 1 + Math.floor(lv / 8) };
        if (slot === 'gloves') o.atk = 1 + Math.floor(lv / 10);
        if (slot === 'shoes') o.speed = 2 + t;
        add(o);
      }
    });
  }
  // starter clothes, any job
  add({ id: 'a_any_top_0', kind: 'armor', slot: 'top', fam: null, tier: -1, lv: 1, name: 'Cotton Tee', def: 3, hp: 5, col: ['#ffffff', '#7fb8ff'], price: 20 });
  add({ id: 'a_any_shoes_0', kind: 'armor', slot: 'shoes', fam: null, tier: -1, lv: 1, name: 'Comfy Sneakers', def: 1, speed: 2, col: ['#7fb8ff', '#ffffff'], price: 20 });
  add({ id: 'a_any_hat_0', kind: 'armor', slot: 'hat', fam: null, tier: -1, lv: 3, name: 'Cozy Beanie', def: 2, col: ['#ff9ec7', '#ffffff'], price: 40 });
  add({ id: 'a_any_gloves_0', kind: 'armor', slot: 'gloves', fam: null, tier: -1, lv: 5, name: 'Work Gloves', def: 1, atk: 1, col: ['#e0b070', '#ffffff'], price: 50 });

  // accessories (no class restriction)
  [['acc_clover', 'Clover Charm', 5, { hp: 30, crit: 1 }, '#7ee08a'], ['acc_honey', 'Honey Ring', 15, { hp: 60, mp: 30, atk: 3 }, '#ffcf3f'],
   ['acc_pearl', 'Pearl Pendant', 25, { mp: 80, def: 8, atk: 5 }, '#f8f0ff'], ['acc_snow', 'Snowflake Earring', 35, { hp: 150, crit: 3, atk: 7 }, '#9fe3ff'],
   ['acc_moon', 'Moon Ring', 45, { hp: 200, mp: 150, atk: 10, crit: 3 }, '#c993ff'], ['acc_ember', 'Ember Amulet', 55, { hp: 300, atk: 15, crit: 5, def: 15 }, '#ff7a3a']]
    .forEach(([id, name, lv, st, col]) => add({ id, kind: 'acc', slot: 'acc', lv, name, fam: null, bonus: st, col, price: lv * lv * 8 }));

  // consumables
  [['p_red', 'Red Potion', { hp: 60 }, 25, '#ff5a6b', 'Restores 60 HP.'],
   ['p_orange', 'Orange Potion', { hp: 180 }, 80, '#ff9a3a', 'Restores 180 HP.'],
   ['p_white', 'White Potion', { hp: 450 }, 220, '#f4f1ff', 'Restores 450 HP.'],
   ['p_elixir', 'Elixir', { hpPct: 0.5, mpPct: 0.5 }, 1200, '#ff8ad0', 'Restores 50% of HP and MP.'],
   ['p_blue', 'Blue Potion', { mp: 80 }, 60, '#5a8bff', 'Restores 80 MP.'],
   ['p_mana', 'Mana Elixir', { mp: 300 }, 260, '#8f7bff', 'Restores 300 MP.'],
   ['s_return', 'Return Scroll', { town: true }, 300, '#f2e2b0', 'Teleports you to Emberfall.'],
   ['s_bell', 'Summon Bell', { bell: true }, 0, '#ffcf3f', 'Ring it in a hunting ground to call its boss right now.'],
  ].forEach(([id, name, eff, price, col, desc]) => add({ id, kind: 'use', name, eff, price, col, desc, stack: 300 }));
  add({ id: 'm_stone', kind: 'etc', name: 'Enhance Stone', price: 1500, col: '#7fe8e0', icon: 'gem', desc: 'Used by Tok the blacksmith to enhance gear.', stack: 300 });
  add({ id: 'm_charm', kind: 'etc', name: 'Guardian Charm', price: 20000, col: '#ffd36b', icon: 'charm', desc: 'Protects gear from losing levels or breaking during enhancement. Used up on failure.', stack: 99 });
  add({ id: 'q_honey', kind: 'etc', name: 'Sweet Honey', price: 0, col: '#ffcf3f', icon: 'blob', desc: 'Quest item for Elder Momo.', stack: 99, quest: true });
  add({ id: 'q_seal', kind: 'etc', name: 'Trial Seal', price: 0, col: '#ff8ad0', icon: 'charm', desc: 'Proof of beating a mini-boss. Bring it to Pip.', stack: 1, quest: true });

  // monster materials, one per family (sell to Lulu)
  const MATS = {
    slime: ['Pudding Jelly', 'blob', 8], sprout: ['Fresh Leaf', 'leaf', 9], snail: ['Swirl Shell', 'shell', 9], bunny: ['Bunny Puff', 'puff', 10],
    bird: ['Soft Feather', 'feather', 10], mushroom: ['Mushroom Cap', 'cap', 10], bug: ['Shiny Wing', 'wing', 12], seal: ['Seal Whisker', 'whisker', 14],
    beast: ['Fluffy Tail', 'puff', 14], crab: ['Crab Claw', 'claw', 14], fish: ['Puffer Spine', 'shard', 14], star: ['Star Bit', 'star', 15],
    octo: ['Ink Sac', 'blob', 16], penguin: ['Penguin Scarf', 'scarf', 16], wisp: ['Wisp Ember', 'orb', 18], bat: ['Bat Wing', 'wing', 18],
    golem: ['Rune Pebble', 'rock', 20], drake: ['Drake Scale', 'scale', 22], tree: ['Ancient Bark', 'leaf', 30],
  };
  for (const [fam, [name, icon, p]] of Object.entries(MATS)) add({ id: `e_${fam}`, kind: 'etc', name, icon, price: p, col: null, fam, stack: 300, desc: 'Monster loot. Lulu buys it.' });

  /* ------------------------------------------------------------ monsters */
  // fam picks the art; beh: walk | hop | fly | float | shoot
  const M = [];
  const mob = (id, name, fam, lv, beh, p, x = {}) => M.push(Object.assign({ id, name, fam, lv, beh, p }, x));
  // Clover Meadow
  mob('pudding', 'Pudding', 'slime', 1, 'hop', { b: '#ff9ec7', s: '#ffd1e4' });
  mob('sprout', 'Sprout', 'sprout', 2, 'walk', { b: '#f7e3b0', s: '#7ed957', k: 'radish' });
  mob('snailbun', 'Snailbun', 'snail', 3, 'walk', { b: '#ffe6b8', s: '#f0a1b8', a: '#fff7ea' }, { spd: 0.5 });
  mob('bunbun', 'Bunbun', 'bunny', 4, 'hop', { b: '#fff7f2', s: '#ffb3c8' });
  mob('chickpea', 'Chickpea', 'bird', 5, 'hop', { b: '#ffe35a', s: '#ffb347', k: 'chick' });
  mob('mushy', 'Mushy', 'mushroom', 6, 'walk', { b: '#ff6b6b', s: '#fff2e0', a: '#ffffff' });
  mob('ladybug', 'Dotty', 'bug', 7, 'fly', { b: '#ff5a5a', s: '#2a1a33', k: 'lady' });
  mob('pupseal', 'Pupseal', 'seal', 9, 'walk', { b: '#f4f6ff', s: '#dfe8ff' }, { spd: 0.7 });
  // Honeywood Forest
  mob('honeypud', 'Honey Pudding', 'slime', 10, 'hop', { b: '#ffbf47', s: '#ffe08a', k: 'drip' });
  mob('acorn', 'Acorn Buddy', 'sprout', 11, 'walk', { b: '#c98b4f', s: '#8a5a3a', k: 'acorn' });
  mob('mossy', 'Mossy Mushy', 'mushroom', 12, 'walk', { b: '#7ec85a', s: '#fff2e0', a: '#d4f5a8' });
  mob('beebee', 'Beebee', 'bug', 13, 'shoot', { b: '#ffd23f', s: '#3a2a20', k: 'bee' }, { fly: true, proj: 'sting' });
  mob('foxkit', 'Fox Kit', 'beast', 14, 'walk', { b: '#ff9a4a', s: '#fff2e0', k: 'fox' }, { spd: 1.3 });
  mob('owlet', 'Owlet', 'bird', 16, 'fly', { b: '#b07a4a', s: '#f4e0c0', k: 'owl' });
  mob('treant', 'Treant Sprout', 'sprout', 17, 'walk', { b: '#9a6a42', s: '#5cc45c', k: 'treant' }, { size: 1.25 });
  mob('teddy', 'Teddy Cub', 'beast', 18, 'walk', { b: '#b9805a', s: '#f4d8b8', k: 'bear' }, { size: 1.15 });
  // Seashell Coast
  mob('seapud', 'Sea Pudding', 'slime', 20, 'hop', { b: '#6fd8ff', s: '#c8f3ff', k: 'bubble' }, { elem: 'water' });
  mob('crabby', 'Crabby', 'crab', 21, 'walk', { b: '#ff6b5a', s: '#ffd0c0' }, { elem: 'water', spd: 1.2 });
  mob('conch', 'Conch Snail', 'snail', 22, 'walk', { b: '#ffd6e6', s: '#ff9ab8', a: '#fff0f6' }, { elem: 'water', spd: 0.6 });
  mob('puffer', 'Puffer', 'fish', 23, 'float', { b: '#ffe35a', s: '#fff6c0' }, { elem: 'water' });
  mob('starry', 'Starry', 'star', 24, 'hop', { b: '#ffa14a', s: '#ffd8a0' }, { elem: 'water' });
  mob('sealpup', 'Seal Pup', 'seal', 26, 'walk', { b: '#a9b4c8', s: '#dfe6f2', k: 'spots' }, { elem: 'water', spd: 0.8 });
  mob('gully', 'Gully', 'bird', 27, 'fly', { b: '#f4f6ff', s: '#ffcf5a', k: 'gull' });
  mob('octo', 'Octo', 'octo', 28, 'shoot', { b: '#c38bff', s: '#f0d8ff' }, { elem: 'water', proj: 'ink' });
  // Frostpuff Peaks
  mob('snowpud', 'Snow Pudding', 'slime', 30, 'hop', { b: '#e8f4ff', s: '#ffffff', k: 'snowcap' }, { elem: 'ice' });
  mob('penguin', 'Pengu', 'penguin', 31, 'walk', { b: '#3a4a6a', s: '#ffffff', a: '#ff6b6b' }, { elem: 'ice' });
  mob('snowbun', 'Snowbun', 'bunny', 32, 'hop', { b: '#ffffff', s: '#a8d8ff', k: 'scarf' }, { elem: 'ice' });
  mob('frostsprite', 'Frost Sprite', 'wisp', 33, 'shoot', { b: '#9fe3ff', s: '#ffffff', k: 'sprite' }, { elem: 'ice', fly: true, proj: 'icicle' });
  mob('yeticub', 'Yeti Cub', 'beast', 35, 'walk', { b: '#f4f8ff', s: '#a8c8e8', k: 'yeti' }, { elem: 'ice', size: 1.15 });
  mob('icemushy', 'Ice Mushy', 'mushroom', 36, 'walk', { b: '#7fc8ff', s: '#f0f8ff', a: '#e8fbff' }, { elem: 'ice' });
  mob('snowowl', 'Snow Owl', 'bird', 37, 'fly', { b: '#f4f8ff', s: '#c8d8f0', k: 'owl' }, { elem: 'ice' });
  mob('walrus', 'Walrus', 'seal', 38, 'walk', { b: '#b9805a', s: '#e0b890', k: 'tusk' }, { elem: 'ice', size: 1.3, spd: 0.6 });
  // Moonlit Ruins
  mob('ghostpud', 'Ghost Pudding', 'slime', 40, 'hop', { b: '#c8b8ff', s: '#f0eaff', k: 'ghost' }, { undead: true });
  mob('wisp', 'Wisp', 'wisp', 41, 'float', { b: '#7fb8ff', s: '#e0f0ff', k: 'flame' }, { undead: true });
  mob('batty', 'Batty', 'bat', 42, 'fly', { b: '#8a6ab8', s: '#ffb3d0' });
  mob('golemling', 'Golemling', 'golem', 43, 'walk', { b: '#a8a0b8', s: '#7ee0c0', k: 'moss' }, { spd: 0.7, size: 1.1 });
  mob('skullmushy', 'Spooky Mushy', 'mushroom', 44, 'walk', { b: '#8a5ab8', s: '#e8e0f0', a: '#c8ff8a', k: 'spooky' }, { undead: true });
  mob('mummybun', 'Mummy Bun', 'bunny', 46, 'hop', { b: '#efe6d0', s: '#c8b890', k: 'mummy' }, { undead: true });
  mob('shadowcat', 'Shadow Cat', 'beast', 47, 'walk', { b: '#4a3a6a', s: '#b48cff', k: 'cat' }, { spd: 1.4 });
  mob('lantern', 'Lantern Ghost', 'wisp', 48, 'shoot', { b: '#efeaff', s: '#ffcf5a', k: 'lantern' }, { undead: true, fly: true, proj: 'wispfire' });
  // Ember Caldera
  mob('magmapud', 'Magma Pudding', 'slime', 50, 'hop', { b: '#ff6a3a', s: '#ffd05a', k: 'flame' }, { elem: 'fire' });
  mob('embersprout', 'Ember Sprout', 'sprout', 51, 'walk', { b: '#ffb08a', s: '#ff6a3a', k: 'ember' }, { elem: 'fire' });
  mob('lavasnail', 'Lava Snail', 'snail', 52, 'walk', { b: '#3a2a2a', s: '#ff7a3a', a: '#ffd05a', k: 'lava' }, { elem: 'fire', spd: 0.6 });
  mob('firebat', 'Fire Bat', 'bat', 53, 'fly', { b: '#e0503a', s: '#ffd05a' }, { elem: 'fire' });
  mob('salamander', 'Salamander', 'drake', 55, 'walk', { b: '#ff8a4a', s: '#ffe08a', k: 'lizard' }, { elem: 'fire', spd: 1.2 });
  mob('ashgolem', 'Ash Golem', 'golem', 56, 'walk', { b: '#5a5060', s: '#ff7a3a', k: 'ember' }, { elem: 'fire', spd: 0.6, size: 1.25 });
  mob('phoenixchick', 'Phoenix Chick', 'bird', 57, 'shoot', { b: '#ff7a3a', s: '#ffe35a', k: 'phoenix' }, { elem: 'fire', fly: true, proj: 'ember' });
  mob('drakeling', 'Drakeling', 'drake', 58, 'walk', { b: '#ff6b8a', s: '#ffe0b0', k: 'drake' }, { elem: 'fire', size: 1.1 });
  // mini-bosses
  mob('kingpud', 'King Pudding', 'slime', 12, 'hop', { b: '#ff7ab8', s: '#ffd1e4', k: 'crown' }, { rank: 'mini', size: 2.0 });
  mob('queenbee', 'Queen Bee', 'bug', 22, 'shoot', { b: '#ffc83f', s: '#3a2a20', k: 'queen' }, { rank: 'mini', size: 1.9, fly: true, proj: 'sting' });
  mob('captcrab', 'Captain Crab', 'crab', 32, 'walk', { b: '#ff4a4a', s: '#ffd0c0', k: 'pirate' }, { rank: 'mini', size: 1.9, elem: 'water' });
  mob('frostyeti', 'Frost Yeti', 'beast', 42, 'walk', { b: '#e8f4ff', s: '#7fb8e8', k: 'yeti' }, { rank: 'mini', size: 2.0, elem: 'ice' });
  mob('moongolem', 'Moon Golem', 'golem', 52, 'walk', { b: '#8a8aa8', s: '#c993ff', k: 'moon' }, { rank: 'mini', size: 2.0 });
  mob('flamedrake', 'Flame Drake', 'drake', 62, 'walk', { b: '#e0402a', s: '#ffd05a', k: 'drake' }, { rank: 'mini', size: 1.9, elem: 'fire' });
  // bosses
  mob('grandmushy', 'Grand Mushy', 'mushroom', 15, 'walk', { b: '#ff5a7a', s: '#fff2e0', a: '#ffffff', k: 'crown' }, { rank: 'boss', size: 3.0 });
  mob('oldoaken', 'Old Oaken', 'tree', 25, 'walk', { b: '#8a5a3a', s: '#6ccf5a', a: '#ff9ec7' }, { rank: 'boss', size: 2.6, spd: 0.4 });
  mob('kraken', 'Kraken Kiki', 'octo', 35, 'shoot', { b: '#ff8ab8', s: '#ffe0ee', k: 'hat' }, { rank: 'boss', size: 3.0, elem: 'water', proj: 'ink' });
  mob('auroraseal', 'Aurora Seal', 'seal', 45, 'walk', { b: '#e8f8ff', s: '#b8f0e0', k: 'aurora' }, { rank: 'boss', size: 3.2, elem: 'ice', spd: 0.6 });
  mob('countnib', 'Count Nibbles', 'bat', 55, 'fly', { b: '#5a3a8a', s: '#ff5a7a', k: 'count' }, { rank: 'boss', size: 2.8, undead: true });
  mob('ignis', 'Ignis', 'drake', 65, 'walk', { b: '#ff4a3a', s: '#ffe35a', k: 'dragon' }, { rank: 'boss', size: 3.2, elem: 'fire' });

  const MOBS = {};
  for (const m of M) {
    const r = m.rank;
    const hpMul = r === 'boss' ? 38 : r === 'mini' ? 13 : 1;
    const atkMul = r === 'boss' ? 1.7 : r === 'mini' ? 1.45 : 1;
    const expMul = r === 'boss' ? 60 : r === 'mini' ? 18 : 1;
    m.hp = Math.round(mobHp(m.lv) * hpMul * (m.size && !r ? 1.15 : 1));
    m.atk = Math.round(mobAtk(m.lv) * atkMul);
    m.def = Math.round(mobDef(m.lv) * (r ? 1.3 : 1));
    m.exp = Math.round(mobExp(m.lv) * expMul * (m.size && !r ? 1.15 : 1));
    m.size = m.size || 1;
    m.spd = m.spd || 1;
    if (m.beh === 'fly' || m.beh === 'float') m.fly = true;
    MOBS[m.id] = m;
  }

  /* ------------------------------------------------------------ maps */
  const MAPS = {
    town: { id: 'town', name: 'Emberfall Village', lv: 'Safe zone', w: 1700, h: 460, town: true, bgm: 'town', seed: 11,
      theme: { sky: ['#8fd3ff', '#fff1f6'], far: '#bfe3c8', mid: '#8fd39a', ground: '#8fdc6a', dirt: '#c9935a', plat: 'wood', parts: 'petal', deco: 'flowers' } },
    meadow: { id: 'meadow', name: 'Clover Meadow', lv: 'Lv 1-10', w: 2600, h: 600, bgm: 'meadow', seed: 21,
      mobs: ['pudding', 'sprout', 'snailbun', 'bunbun', 'chickpea', 'mushy', 'ladybug', 'pupseal'], mini: 'kingpud', boss: 'grandmushy',
      theme: { sky: ['#7fcfff', '#e8fbff'], far: '#a8e0b0', mid: '#6cc07a', ground: '#7ed957', dirt: '#b57a4a', plat: 'wood', parts: 'petal', deco: 'flowers' } },
    forest: { id: 'forest', name: 'Honeywood Forest', lv: 'Lv 10-20', w: 2800, h: 620, bgm: 'forest', seed: 37,
      mobs: ['honeypud', 'acorn', 'mossy', 'beebee', 'foxkit', 'owlet', 'treant', 'teddy'], mini: 'queenbee', boss: 'oldoaken',
      theme: { sky: ['#ffd58a', '#fff6d8'], far: '#8fc07a', mid: '#4f9a52', ground: '#6cc04a', dirt: '#8a5a3a', plat: 'log', parts: 'firefly', deco: 'mushrooms' } },
    coast: { id: 'coast', name: 'Seashell Coast', lv: 'Lv 20-30', w: 2800, h: 600, bgm: 'coast', seed: 53,
      mobs: ['seapud', 'crabby', 'conch', 'puffer', 'starry', 'sealpup', 'gully', 'octo'], mini: 'captcrab', boss: 'kraken',
      theme: { sky: ['#5ac8ff', '#e0fbff'], far: '#6fd8e8', mid: '#3fb8c8', ground: '#ffe6a8', dirt: '#e8c080', plat: 'coral', parts: 'bubble', deco: 'shells', water: true } },
    peaks: { id: 'peaks', name: 'Frostpuff Peaks', lv: 'Lv 30-40', w: 2800, h: 620, bgm: 'peaks', seed: 71,
      mobs: ['snowpud', 'penguin', 'snowbun', 'frostsprite', 'yeticub', 'icemushy', 'snowowl', 'walrus'], mini: 'frostyeti', boss: 'auroraseal',
      theme: { sky: ['#8fb0ff', '#f0f4ff'], far: '#d8e8ff', mid: '#a8c8f0', ground: '#f4f8ff', dirt: '#a8b8d8', plat: 'ice', parts: 'snow', deco: 'pines', aurora: true } },
    ruins: { id: 'ruins', name: 'Moonlit Ruins', lv: 'Lv 40-50', w: 3000, h: 620, bgm: 'ruins', seed: 89,
      mobs: ['ghostpud', 'wisp', 'batty', 'golemling', 'skullmushy', 'mummybun', 'shadowcat', 'lantern'], mini: 'moongolem', boss: 'countnib',
      theme: { sky: ['#2a2458', '#7a5aa8'], far: '#4a3a7a', mid: '#3a2e60', ground: '#8a7ab0', dirt: '#4a3e6a', plat: 'stone', parts: 'wisp', deco: 'pillars', night: true } },
    caldera: { id: 'caldera', name: 'Ember Caldera', lv: 'Lv 50-60', w: 3000, h: 620, bgm: 'caldera', seed: 97,
      mobs: ['magmapud', 'embersprout', 'lavasnail', 'firebat', 'salamander', 'ashgolem', 'phoenixchick', 'drakeling'], mini: 'flamedrake', boss: 'ignis',
      theme: { sky: ['#5a2a4a', '#ff9a6a'], far: '#7a3a4a', mid: '#4a2a3a', ground: '#6a4a4a', dirt: '#3a2a2e', plat: 'obsidian', parts: 'ember', deco: 'rocks', lava: true } },
  };
  const MAP_ORDER = ['town', 'meadow', 'forest', 'coast', 'peaks', 'ruins', 'caldera'];

  /* ------------------------------------------------------------ NPCs */
  const NPCS = {
    elder: { id: 'elder', name: 'Elder Momo', title: 'Village Elder', x: 420,
      look: { skin: '#ffe0c8', hair: '#f4f1ff', hairStyle: 4, eyes: '#5a4a8a', beard: true, robe: '#9a7ad8', trim: '#ffd36b', hat: 'elder' } },
    pip: { id: 'pip', name: 'Pip', title: 'Job Master', x: 700,
      look: { skin: '#ffd8b8', hair: '#ff7a5a', hairStyle: 0, eyes: '#3a6ab8', robe: '#3a6ab8', trim: '#ffd36b', hat: 'band' } },
    lulu: { id: 'lulu', name: 'Lulu', title: 'Merchant', x: 1010,
      look: { skin: '#ffe6d0', hair: '#ffb3d0', hairStyle: 3, eyes: '#c05a8a', robe: '#ff9ec7', trim: '#ffffff', hat: 'none', apron: true } },
    tok: { id: 'tok', name: 'Tok', title: 'Blacksmith', x: 1290,
      look: { skin: '#e8b890', hair: '#5a3a2a', hairStyle: 1, eyes: '#3a2a20', beard: true, robe: '#6a5a6a', trim: '#ff9a3a', hat: 'goggles', apron: true } },
  };
  const WAYSTONE_X = 180;

  /* ------------------------------------------------------------ quests */
  const QUESTS = [
    { id: 'q1', name: 'Pudding Trouble', giver: 'elder', lv: 1, type: 'kill', target: 'pudding', n: 12,
      text: 'The Puddings in Clover Meadow keep eating my petunias! Could you bounce a dozen of them for me?',
      done: 'Splendid! My petunias thank you. Take these for the road.', reward: { exp: 90, coins: 300, items: [['p_red', 10], ['a_any_hat_0', 1]] } },
    { id: 'q2', name: 'A Path of Your Own', giver: 'pip', lv: 10, type: 'job',
      text: 'Level 10 already? Then it is time. Choose your path: Warrior, Mage, Cleric or Archer.', done: 'Welcome to the guild!', reward: { exp: 0, coins: 0, items: [] } },
    { id: 'q3', name: 'Sticky Sweet', giver: 'elder', lv: 12, type: 'collect', target: 'q_honey', n: 12, dropFrom: ['honeypud', 'beebee'],
      text: 'I would love some honey for my tea. Honey Puddings and Beebees in Honeywood Forest carry Sweet Honey. Bring me 12?',
      done: 'Mmm, perfect. Here, this ring was my grandmother’s.', reward: { exp: 1800, coins: 1500, items: [['acc_honey', 1], ['p_orange', 15]] } },
    { id: 'q4', name: 'Shell Shock', giver: 'elder', lv: 22, type: 'kill', target: 'captcrab', n: 1,
      text: 'A crab in a pirate hat is terrorising the fishermen at Seashell Coast. Captain Crab, they call him. Please deal with him.',
      done: 'The fishermen are cheering! They asked me to give you this.', reward: { exp: 9000, coins: 5000, items: [['m_stone', 3], ['acc_pearl', 1]] } },
    { id: 'q5', name: 'Trial of the Second Seal', giver: 'pip', lv: 30, type: 'collect', target: 'q_seal', n: 1, job2: true,
      text: 'You have grown strong. Defeat any mini-boss in the hunting grounds and bring me the Trial Seal it drops. Then I will teach you more.',
      done: 'The Seal glows for you. Your second job awaits!', reward: { exp: 5000, coins: 3000, items: [['m_stone', 2]] } },
    { id: 'q6', name: 'Song of the Aurora', giver: 'elder', lv: 38, type: 'kill', target: 'auroraseal', n: 1,
      text: 'The giant Aurora Seal of Frostpuff Peaks has started a blizzard that will not stop. Calm it down, gently if you can.',
      done: 'The skies are clear again. Thank you, brave one.', reward: { exp: 40000, coins: 15000, items: [['acc_snow', 1], ['p_white', 20]] } },
    { id: 'q7', name: 'Count Nibbles’ Ball', giver: 'elder', lv: 48, type: 'kill', target: 'countnib', n: 1,
      text: 'Every full moon, Count Nibbles throws a ball in the ruins and nobody gets any sleep. Put an end to the party.',
      done: 'Quiet nights at last! Take these charms.', reward: { exp: 90000, coins: 30000, items: [['m_charm', 2], ['acc_moon', 1]] } },
    { id: 'q8', name: 'Heart of the Caldera', giver: 'elder', lv: 58, type: 'kill', target: 'ignis', n: 1,
      text: 'Ignis, the Ember Dragon, sleeps at the heart of the caldera. If it wakes, Emberfall will live up to its name. Stop it.',
      done: 'You are a true hero of Emberfall. This weapon was forged for you.', reward: { exp: 250000, coins: 80000, items: [['legend', 1], ['acc_ember', 1]] } },
  ];

  const SHOP = ['p_red', 'p_orange', 'p_white', 'p_blue', 'p_mana', 'p_elixir', 's_return', 'm_stone', 'm_charm',
    'w_sword_0', 'w_wand_0', 'w_mace_0', 'w_bow_0', 'a_any_top_0', 'a_any_shoes_0', 'a_any_hat_0', 'a_any_gloves_0'];

  // enhancement: success rate, and what happens on failure
  const ENH = [
    { rate: 1.00 }, { rate: 0.95 }, { rate: 0.90 }, { rate: 0.85 }, { rate: 0.75 },
    { rate: 0.65, down: true }, { rate: 0.55, down: true }, { rate: 0.45, down: true }, { rate: 0.35, down: true, brk: 0.4 }, { rate: 0.25, down: true, brk: 0.5 },
  ];
  const ENH_MAX = 10;
  const enhMul = e => 1 + 0.06 * e + 0.004 * e * e;
  const enhCost = (item, e) => ({ coins: Math.round(120 * Math.pow(e + 1, 1.6) * (1 + item.lv / 10)), stones: 1 + Math.floor(e / 3) });

  const ELEM_WEAK = { fire: 'ice', ice: 'fire', water: 'bolt' }; // monster elem -> skill elem it is weak to

  return { MAX_LV, expNeed, JOBS, FAMS, STAT_NAMES, SKILLS, skillsOfJob, RARITY, ITEMS, WTYPES, WTIERS, ATIERS, TIER_COL, MATS, MOBS, MAPS, MAP_ORDER, NPCS, WAYSTONE_X, QUESTS, SHOP, ENH, ENH_MAX, enhMul, enhCost, ELEM_WEAK, ASLOTS };
})();
