# Emberfall Online: project context

Read this before changing anything. It sums up everything decided and built so far, so you don't redo or undo past decisions.

## What this is

An offline, single-player, MapleStory-style 2D side-scrolling RPG with cute 32-bit pixel art in the spirit of Seal Online. It's a Windows desktop app (Electron + electron-builder NSIS installer). All art, icons, backdrops and music are generated in code; the game itself is about 480 KB. The owner is Arden (GitHub `ardenvaler`).

History:
- **17 Oct 2026:** started as "Emberfall Ledger", a single-file 16-bit kingdom dashboard (commit `006d6b2`).
- **26 Oct 2026:** Arden asked to turn it into this game. The dashboard file was deleted; it's only in git history now.
- **27 Oct 2026:** Arden moved the repo off GitHub to a local folder on their PC. It came from a zip export: branch `main`, no git remote, 3 commits (`006d6b2`, `4e5a505`, `d21790b`) plus whatever has been added since.

## Arden's brief (keep to it)

From the original request, nearly word for word:
- An expansive game like a 2000s MMO (MapleStory): a job list, progression, a skill tree, many monsters including bosses and mini-bosses, item drops, and weapon and equipment enhancement.
- **Not** many quests, **not** many maps, **not** many NPCs.
- 2D with horizontal movement, like MapleStory.
- **WASD** to move, skills on **1–0**.
- Not heavy: about 60 monsters is enough, as long as they respawn regularly for grinding EXP and items.
- Not many weapons or armours. Armour should only be what your character can actually use (no junk); weapons can be a bit more varied.
- Jobs: Warrior, Mage, Cleric, Archer, then one second job each with no branching.
- **32-bit** art (not 16-bit), **cute and endearing like Seal Online**.
- A **Windows game you install on your PC**.
- **Settings for the EXP and item drop rates.**

Arden likes ambitious work ("break a leg"), and short, plain progress updates.

## Current state

- Everything in the brief is built and was tested headlessly (see Testing). **The installer has never been launched on a real Windows PC.** Arden hadn't reported trying it yet. It isn't code-signed, so SmartScreen warns ("More info → Run anyway").
- **Open request:** Arden said to "adjust this later" about the build instructions. `README.md` still tells people to download from GitHub Releases and says pushes trigger CI. Rewrite it for the offline setup: build locally with `npm install` then `npm run dist:win`.
- `.github/workflows/windows-installer.yml` built the installer on GitHub's Windows runners. It does nothing offline; ask Arden before deleting it.
- The old GitHub copy, `ardenvaler/16bitgames` (branch `claude/eloquent-edison-f96cuw`, releases v1.0.1 and v1.0.2), may still exist. Arden may archive or delete it; it's no longer the source of truth.
- A browser build was published as a private claude.ai artifact: https://claude.ai/artifact/LA1dLqTCTUXGALjwVSz3JA (the link that used to show the dashboard). To refresh it, run `npm run build:web` and republish `dist-web/emberfall-online.html` to that same URL (read the artifact first if you're in a new session).

## Build and run

```
npm install          # Electron 44.7.0 and electron-builder 26.16.1, pinned in package.json
npm start            # run the game in Electron
npm run dist:win     # build the NSIS installer -> dist/Emberfall-Online-Setup-<version>.exe (works natively on Windows; on Linux it needs Wine)
npm run build:web    # single-file browser build -> dist-web/emberfall-online.html (Google Fonts instead of local fonts)
```

- Bump `version` in `package.json` by hand before a release build. CI used to stamp it as `1.0.<run number>`.
- `scripts/make-icon.mjs` re-renders `build/icon.png` and `build/icon.ico` from the game's sprite code. It needs Playwright, which is not a dependency: `npm i -D playwright` first.
- Installer: per-user, no admin rights, lets you choose the folder, creates desktop and Start menu shortcuts. Saves live in `%APPDATA%\Emberfall Online` (Electron's localStorage) and survive uninstalling.

## Code layout

Plain scripts, no bundler, no ES modules. `src/index.html` loads them in this order, and each defines one global object:

| File | Global | What it holds |
| --- | --- | --- |
| `src/js/util.js` | `U` | math, seeded RNG, colour helpers (`shade`, `mix`) |
| `src/js/data.js` | `D` | **all content and formulas**: jobs, skills, items, monsters, maps, NPCs, quests, shop, enhancement table |
| `src/js/art.js` | `Art` | procedural sprites: monster families, the character paper doll, weapons, item and skill icons |
| `src/js/audio.js` | `Sound` | Web Audio sound effects, plus procedural background music per map (`TRACKS`) |
| `src/js/world.js` | `World` | seeded map layouts, parallax backdrops, terrain pre-render, ambient particles |
| `src/js/game.js` | `Game` | state `G`, stats (`calc`), combat, monster and boss AI, drops, quests, shop, enhancement, world rendering |
| `src/js/ui.js` | `UI` | DOM HUD and draggable windows (character, bag, skills, quests, map, settings, NPC, shop, forge, travel) |
| `src/js/main.js` | `Input`, `Main` | input, fixed 60 Hz loop, resize, save slots, title screen, character creator |
| `electron/main.js`, `preload.js` | | 1280×720 window (minimum 960×540), F11 fullscreen, F12 devtools; preload exposes `window.desktop = { toggleFullscreen, quit }` |

Key mechanics:
- **Art pipeline:** shapes are drawn with smooth gradients, then `Art.finalize` thresholds alpha (≥100) and adds a hue-aware 1px outline. That's what makes the "32-bit" look. Monsters come from 19 families in `Art.FAM` with palette and kind variants, 6 frames each plus a white hit-flash frame. The character is a paper doll (`drawChar`, 17 poses in `POSES`) re-rendered and cached whenever equipment changes. `Art.fitChar` draws a full body into a box.
- **Rendering:** the world canvas runs at low internal resolution (scale = floor(window height / 330), or the Zoom setting) and is upscaled pixelated. A second full-resolution canvas draws text: name tags, damage numbers, banners.
- **Maps:** ground plus tiers of one-way platforms every 62px (jump height is about 63px), ropes, edge portals, and spawn points capped at 34 per map. Respawn takes 7s ÷ the respawn setting.
- **Saves:** localStorage `efo-slot-0..2` (player JSON, `v: 1`; `migrate()` in main.js pads old saves) and `efo-settings`.
- **Debug handle:** `window.__efo = { Game, Main, D, UI }`.

## Content

- **Jobs:** Beginner → at level 10, choose via Pip: Warrior / Mage / Cleric / Archer → at level 30, via quest q5: Knight / Wizard / Priest / Ranger. Main stats are STR / INT / WIS / DEX. Levels give 5 AP each. SP: 1 per level up to 10 as a Beginner, then 2 per level after a job, plus 1 per advancement. Max level 70.
- **Skills:** 51 in total. Beginner has 3 (Pebble Toss, Sprint, Nap Time); every other job has 6 (4 active, 2 passive), laid out in a 3×2 grid with prerequisites (`req`). Actives go to level 10, passives to 5.
- **Maps (7):** Emberfall Village (town), Clover Meadow (Lv 1–10), Honeywood Forest (10–20), Seashell Coast (20–30), Frostpuff Peaks (30–40), Moonlit Ruins (40–50), Ember Caldera (50–60). Each hunting ground has 8 monster types, 1 mini-boss and 1 boss:
  - Meadow: King Pudding / Grand Mushy
  - Forest: Queen Bee / Old Oaken
  - Coast: Captain Crab / Kraken Kiki
  - Peaks: Frost Yeti / Aurora Seal
  - Ruins: Moon Golem / Count Nibbles
  - Caldera: Flame Drake / Ignis

  That's 60 monsters. Seals are the signature: Pupseal, Seal Pup, Walrus, Aurora Seal.
- **Boss timers:** the first mini-boss arrives 45s after entering a map and the first boss after 150s. After a kill, they respawn after 150s (mini) or 420s (boss). All timers are multiplied by the Boss timer setting, only count down while you're in that map, and aren't saved. A Summon Bell (dropped by mini-bosses) calls the boss immediately. Bosses telegraph stomp, barrage, summon, falling-hazard and charge attacks.
- **NPCs (4) in town:** Elder Momo (quests), Pip (jobs), Lulu (shop; buys loot), Tok (enhancing). There's also a Waystone that teleports you to any visited map, 4 fake wandering players with chat bubbles, and fake `[World]` chat (both can be turned off with the "Town chatter" setting).
- **Quests (8):**

  | # | Name | Giver | Level | Goal |
  | --- | --- | --- | --- | --- |
  | q1 | Pudding Trouble | Elder | 1 | Kill 12 Puddings |
  | q2 | A Path of Your Own | Pip | 10 | Choose a job |
  | q3 | Sticky Sweet | Elder | 12 | Collect 12 Sweet Honey (from Honey Puddings and Beebees) |
  | q4 | Shell Shock | Elder | 22 | Defeat Captain Crab |
  | q5 | Trial of the Second Seal | Pip | 30 | Bring a Trial Seal from any mini-boss; gives your second job |
  | q6 | Song of the Aurora | Elder | 38 | Defeat Aurora Seal |
  | q7 | Count Nibbles' Ball | Elder | 48 | Defeat Count Nibbles |
  | q8 | Heart of the Caldera | Elder | 58 | Defeat Ignis; gives a legendary weapon for your job |

  Elder Momo's quests unlock in order.
- **Items:**
  - Weapons: 8 types (sword, axe, wand, staff, mace, scepter, bow, crossbow) × 8 tiers (level 1, 8, 16, 24, 32, 40, 50, 60) = 64, plus 4 legendaries.
  - Armour: 4 slots (hat, top, gloves, shoes) × 5 tiers (level 10, 22, 34, 46, 58) per job, plus 4 starter pieces anyone can wear. **Armour only drops for the player's own job.**
  - 6 accessories, potions, Return Scroll, Summon Bell, Enhance Stone, Guardian Charm, and one loot material per monster family.
  - Rarity: Common, Rare, Epic, Legendary (stat multipliers ×1, ×1.1, ×1.22, ×1.4, plus random bonus stats).
- **Enhancement:** +0 to +10 at Tok's forge, costing coins and Enhance Stones. Success rates by current level are in `D.ENH`, from 100% down to 25%. Failures from +5 upward drop a level. Attempts at +8 and +9 can also break the item (40% and 50% of failures). A Guardian Charm prevents both and is used up when it saves you. Each + raises stats by ×(1 + 0.06e + 0.004e²).
- **Settings:** EXP rate (×0.5–×20), item drop rate (×0.5–×10, also nudges rarity up), coin rate, monster respawn speed, boss timer, music and effects volume, auto-loot, damage numbers, screen shake, town chatter, zoom.

## Balance (tuned 26 Oct; keep the targets)

- Monsters: HP = 15 + 7·L^1.45, attack = 6 + 2.6·L^1.15, defence = 1.1·L, EXP = 4 + 1.6·L^1.45. EXP to the next level = (3 + L) × monster EXP, so about 3 + L kills per level at ×1.
- Mini-bosses have (18 + 0.9·L)× HP and 18× EXP; bosses have (40 + 2·L)× HP and 60× EXP.
- Player damage power = (weapon attack + 4) × (1 + main/20 + sub/90). Minimum damage is 60% of maximum plus mastery (capped at 92%). Armour defence = (1 + 0.5·level) × slot multiplier.
- **Targets:** 2–3 basic hits per same-level monster and about 1 main-skill cast; a mini-boss takes 20–30s of real play at its level and a boss about 1 minute. Mages are fragile on purpose (Magic Guard compensates).

## Controls

A/D walk · W jump, climb ropes, enter portals, talk to NPCs · S climb down (S + Space drops through a platform) · Space jump · J basic attack (hold to repeat) · 1–0 hotbar (hover a skill or potion and press a number to bind it; drag also works; right-click clears a slot) · E interact · Z pick up (when auto-loot is off) · C / I / K / L / M windows · H help · Esc closes a window or opens Settings · F11 fullscreen.

## Testing that was done

The test scripts were throwaway files in the old cloud session and are **not in this repo**.
- Headless Playwright with Chromium drove the game through `window.__efo`: title → character creation → town → all six maps; combat, ropes, portals, drop-through, job pick, quest turn-in, fainting and revive, the forge and shop, a full mini-boss fight, and a save/load round trip. No page errors.
- Performance was about 0.6–0.9 ms per frame. The real Electron app was also launched under Xvfb.
- At phone width there's no horizontal scroll, but the HUD covers the ground. The game needs a keyboard; there are no touch controls.

## Known limits / ideas not done

No touch controls · boss timers reset when you restart · fake players don't fight · installer unsigned · no party, trading or real multiplayer (single-player only, by design).
