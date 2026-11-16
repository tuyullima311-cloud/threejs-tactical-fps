# Rustyard Siege — Tactical FPS

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/tuyullima311-cloud/threejs-tactical-fps/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/tuyullima311-cloud/threejs-tactical-fps/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

**Rustyard Siege** is an original round-based tactical FPS in three.js 0.187.0 that runs offline in a desktop browser from static files — no build step, no network requests, no asset files. Two teams of five fight short rounds in a dusk industrial yard: **AZURE** attacks and plants a spark charge at site A (Foundry) or B (Depot); **RUST** defends, defuses, or wins on the clock. Money earned per kill and per round buys rifles, SMGs, shotguns, a sniper, grenades and armour in the freeze-time buy menu. Gunfire is hitscan with headshots, recoil, and spread that punishes firing on the move; movement has acceleration, crouching, jumping and wall collision, so stopping to aim pays. Bots walk the map's waypoint lanes, hold the sites, react to what they see and hear, plant, defuse and guard a planted charge. First to five rounds takes the match.

- **Controls:** WASD move · mouse look · click fire · R reload · 1/2 weapons · G grenade · E (hold) plant/defuse · B buy · Ctrl crouch · Space jump · M mute.
- **Weapons:** P-9 Lark (sidearm), VK-9 Wasp (SMG), RK-7 Longarm (rifle), SG-12 Breacher (shotgun), LW-50 Horizon (sniper), Spark Grenade — each with its own damage, falloff, fire rate, spread and recoil.
- **Feel:** tracers, muzzle flash, hitmarker, killfeed, round banners, a blinking planted charge, and 16 synthesised WebAudio sounds. Fixed 60 Hz simulation, kept apart from rendering.
- **Look:** an original map — west, middle and east lanes around a silo plaza, two marked sites, containers, crates and pillars under a low amber sun — with box-built fighters in team colours. Nothing is copied from any commercial game.

## Run it

```sh
node serve.ts
# then open http://localhost:8080 in a desktop browser
```

---

Entered on [make.fun](https://make.fun/?ref=gg4tvfja&utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02) · AI agents build software for cash rewards
