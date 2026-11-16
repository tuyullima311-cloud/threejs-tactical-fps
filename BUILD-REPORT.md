# BUILD REPORT — Rustyard Siege: Tactical FPS

Entry for make.fun bounty **threejs-fps-02** ("Make the best three.js tactical FPS", $1,000 pool, 10 places).
Deadline: **Mon 16 Nov 2026 21:30 UTC = Tue 17 Nov 2026 04:30 WIB.**
Package state: **complete and verified** — ready to push to a public GitHub repo and submit.

## The game

**Rustyard Siege** is an original round-based tactical FPS in three.js 0.187.0,
single-player vs bots, running offline in a desktop browser from static files
(no build step, no network request). AZURE (the player + 4 bots) attacks; RUST
(5 bots) defends. Rounds are won by elimination, by detonating a planted spark
charge, or — for the defenders — by defusing it or running the clock out.
Freeze time (6 s) opens the buy menu; money is earned per kill (+$300), per
plant (+$300) and per round (win +$3250, loss +$1900). First to 5 rounds takes
the match (max 9 rounds).

- **Controls:** WASD move · mouse look (pointer lock) · click fire · R reload ·
  1/2 weapon slots · G grenade · E hold to plant/defuse · B buy menu · Ctrl
  crouch · Space jump · M mute.
- **Weapons (5 + grenade):** P-9 Lark sidearm, VK-9 Wasp SMG ($1500), RK-7
  Longarm rifle ($2700), SG-12 Breacher shotgun ($1050), LW-50 Horizon sniper
  ($4750), Spark Grenade ($300), Plated Vest ($650). Each has its own damage,
  headshot multiplier, falloff, fire gap, magazine, reload time, spread and
  recoil; the shotgun fires 8 pellets.
- **Gunplay:** hitscan rays against wall AABBs and per-fighter hit spheres
  (head / chest / pelvis); headshots pay 2.5–4×; spread grows with movement,
  bloom and being airborne and shrinks when crouched and still; recoil kicks
  the aim; armour absorbs half the damage.
- **Bots:** waypoint-graph routes (west / mid / east lanes to both sites),
  site holds and patrols, line-of-sight + view-cone perception, hearing
  (recent shots pull them in), reaction delay, aim error that shrinks while a
  target is held, burst fire, strafing that closes distance at long range,
  grenade throws, planting when carrying, defusing when the charge is planted
  and nobody is watching, and guarding a planted charge.
- **Feel:** tracers, muzzle flash + light, hitmarker, killfeed, damage
  vignette, round banners, blinking planted charge, explosion shell, and 16
  synthesised WebAudio sounds (no audio files).
- **Look:** an original dusk industrial yard — silo plaza, two marked sites
  (A Foundry amber, B Depot teal), containers, crates, pillars, a distant
  skyline, warm low sun + cool fill. Fighters are box-built in team colours
  (AZURE blue, RUST orange) with glowing visors. Nothing copied from any
  commercial game.

### Source layout (one clear job per file — the judge reads this outline)

| File | Job |
| --- | --- |
| `game/index.html` | Page shell, HUD DOM, the one import map (`three` → vendored module) |
| `game/src/config.js` | Every tuning number: palette, weapons, economy, round rules |
| `game/src/rng.js` | Seeded RNG (mulberry32) + angle/clamp helpers |
| `game/src/audio.js` | WebAudio synth: 16 SFX, no audio files |
| `game/src/input.js` | Keyboard/mouse + pointer lock, edge-triggered presses |
| `game/src/map.js` | The Rustyard map data, AABB physics, LOS, waypoint graph + BFS |
| `game/src/weapons.js` | Weapon state machine, spread/damage, first-person view models |
| `game/src/fighter.js` | Fighter state, armour damage, hit spheres, box-built figure |
| `game/src/bots.js` | Bot brains: perception, routes, holds, plant/defuse, bursts |
| `game/src/simulation.js` | The game: fixed-step rounds, economy, bomb, grenades, hitscan |
| `game/src/render.js` | three.js scene, map meshes, tracers, bomb, HUD sync |
| `game/src/shots.js` | Screenshot scenes (`?shot=…`) driving the real simulation |
| `game/src/main.js` | Boot, fixed 60 Hz loop, pointer-lock flow, buy/grenade keys |
| `main.ts` | Hands the entry in: copies game/ + screenshots/, writes dossier.json |
| `vendor/makefun-threejs.ts` | The kit's library, **byte-identical** |
| `serve.ts` | Local static server for play-testing |
| `game/vendor/three/` | three.js 0.187.0, byte-for-byte from the kit starter |

## How the judging criteria were addressed

1. **Complete game** — first-person view, mouse look, keyboard movement,
   weapons that fire/reload/run dry, opponents that move, see and shoot back,
   rounds that end in a win or a loss and start again, HUD with health,
   armour, ammunition, round timer, score, money and team-alive counts; the
   four screenshots show freeze-time buy → mid-round duel → planted charge →
   round won, all real renders of the game's own code.
2. **Gunplay and movement** — head/body hit spheres, recoil and spread that
   punish firing on the move, acceleration + friction movement, crouching,
   jumping, AABB collision, so stopping to aim pays.
3. **Tactics** — a bomb objective (plant at A or B / defuse), money earned
   each round and spent in a buy menu, five weapons plus a grenade, and bots
   that follow routes, hold positions and react to sight and sound.
4. **Map and look** — an original map with three lanes, corners and
   sightlines, a chosen dusk palette, site markers, and its own box-built art.
5. **Code** — twelve small modules with one job each, a fixed-step
   simulation kept apart from rendering, pooled tracers and reused vectors in
   the hot paths, state kept in the one `game` object, no duplicated blocks.

## Verification (all done in this session)

- `node --check` on every module; `main.ts` run produces `out/` with
  `dossier.json` (see below).
- **Headless simulation tests (Node, no DOM):** movement + freeze rules,
  round flow across 3 rounds, 15 kills, buy rules (unaffordable refused,
  grenade/armour/rifle bought); plant path (player plants at A, defenders
  converge and defuse); bomb-drop path (carrier bot retrieves the dropped
  charge and plants it); bot-only balance matches (duels resolve, 20–30
  kills/match; defenders hold a 4v5 edge when the human carrier hides, as
  designed — the player is the swing factor).
- **Headless Chrome 157 play-test (swiftshader WebGL):** all four `?shot=`
  scenes captured at 1280×720 and inspected visually — real rendered game,
  no blank/error page; fixed what the shots showed (waypoints that sat
  inside colliders, a silo blocking the play-shot sightline, a dark view
  model, a container hiding the planted charge, channels continuing under
  fire, and strafe duels that never resolved).
- Screenshots converted to JPEG (each ≤ 256 KiB, 1280×720).

## Kit

Downloaded from the official route given in make.fun's agent guide:
`GET https://make.fun/c/threejs-fps-02/kit` (competition `threejs-fps-02`,
phase `dev`). The unpacked kit is preserved at
`~/workspace/makefun/work/kit/threejs-fps-02-kit/threejs-fps-02-kit/` for the
submission steps. `vendor/makefun-threejs.ts` is the kit starter's file copied
unchanged; `game/vendor/three/three.module.min.js` and `three.core.min.js`
are the kit starter's three.js 0.187.0 files copied byte-for-byte (the module's
two `./three.core.js` specifiers already rewritten to `./three.core.min.js` in
the kit's copy). `LICENSE` is the kit starter's MIT license. `main.ts` was
written in this session (hand-in logic per the kit, header rewritten for this
game). The starter's game was used only as a layout reference; every line of
this game's source was written in this session.

## Submission steps (for the owner)

1. Create the public repo `tuyullima311-cloud/threejs-tactical-fps` and push
   this tree (HTTPS; SSH from the VM is blocked).
2. Set repo About: website `https://make.fun/bounty/threejs-fps-02`, topic
   `makefun` (`gh repo edit … --add-topic makefun`).
3. Bundle transcripts with the kit CLI, run the kit check (must pass, 0
   failed), upload the bundle, and submit from the owner's browser with
   Sign and submit.
