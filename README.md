# Emberfall Online

A cosy, offline, MapleStory-style 2D side-scrolling RPG with cute 32-bit pixel art, in the spirit of Seal Online. All the art and music are generated in code, so the game itself is under 500 KB.

## Download for Windows

Grab the newest `Emberfall-Online-Setup-*.exe` from **[Releases](https://github.com/ardenvaler/16bitgames/releases/latest)** and run it. The installer isn't code-signed, so Windows SmartScreen may say "Windows protected your PC": click **More info → Run anyway**. It installs per-user (no admin needed) and adds desktop and Start menu shortcuts.

Saves are stored in `%APPDATA%\Emberfall Online` and survive updates.

## What's in it

- **Jobs:** start as a Beginner, choose Warrior, Mage, Cleric or Archer at level 10 from Pip, then earn Knight, Wizard, Priest or Ranger at level 30 with a mini-boss trial.
- **Skill trees:** six skills per job (actives and passives) with prerequisites. You get 2 SP per level after your first job.
- **60 monsters** across 6 hunting grounds, including 6 mini-bosses and 6 bosses on respawn timers (the minimap shows the countdown). Bosses telegraph stomps, barrages, summons and falling hazards.
- **Loot:** coins, potions, monster materials, Enhance Stones, Guardian Charms and gear in four rarities (Common, Rare, Epic, Legendary) with random bonus stats. Armour only drops for your own job, so there's no junk; weapons drop for every job.
- **Enhancement:** Tok the blacksmith enhances gear from +0 to +10. Past +5 a failure can drop a level, and past +8 the gear can break. A Guardian Charm prevents both.
- **8 quests, 7 maps, 4 NPCs.** The Waystone in town teleports you to any hunting ground you have visited.
- **Settings:** EXP rate (×0.5–×20), item drop rate, coin rate, monster respawn speed, boss timer, volume, zoom, auto-loot and more.

## Controls

| Key | Action |
| --- | --- |
| A / D | Walk |
| W | Jump, climb ropes, enter portals, talk to NPCs |
| S | Climb down; S + Space drops through a platform |
| Space | Jump |
| J (hold) | Basic attack |
| 1–0 | Hotbar skills and potions (hover a skill or potion and press a number to bind it) |
| C · I · K · L · M | Character, Bag, Skills, Quests, World map |
| Esc | Close a window / Settings |
| F11 | Fullscreen |

## Development

```
npm install
npm start            # run the desktop app
npm run dist:win     # build the NSIS installer (on Windows, or anywhere with Wine)
npm run build:web    # single-file browser build in dist-web/
```

Pushing to `main` or a `claude/**` branch runs `.github/workflows/windows-installer.yml` on a Windows runner, which builds the installer and publishes it as a GitHub Release.

`scripts/make-icon.mjs` re-renders `build/icon.png` and `build/icon.ico` from the game's own sprite code (needs Playwright).

Code layout (plain scripts, no bundler): `src/js/util.js` helpers, `data.js` all content, `art.js` procedural sprites, `audio.js` sound and music, `world.js` maps and backdrops, `game.js` gameplay, `ui.js` interface, `main.js` loop, input and saves. `electron/` holds the desktop shell.
