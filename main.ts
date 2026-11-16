// Rustyard Siege — an entry for make.fun's "Make the best three.js tactical FPS"
// bounty (Node 22, standard library only). The game is this directory's game/
// folder: plain static files a desktop browser loads offline as ES modules, with
// three.js 0.187.0 vendored under game/vendor/three/ and reached through the one
// import map in game/index.html. This program hands it in: it copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json,
// the summary the judge reads, with the vendored make.fun library.
//
// Rustyard Siege is an original round-based tactical shooter in the style
// Counter-Strike made famous, with its own map, art, sounds and names: two teams
// of five fight short rounds in a dusk industrial yard. AZURE attacks and plants
// a spark charge at site A (Foundry) or B (Depot); RUST defends, defuses, or wins
// on the clock. Money earned per kill and per round buys rifles, SMGs, shotguns,
// a sniper, grenades and armour in the freeze-time buy menu. Gunfire is hitscan
// with headshots, recoil, spread that punishes firing on the move, and crouching.
// Bots walk the map's waypoint lanes, hold the sites, react to what they see and
// hear, plant, defuse and guard a planted charge. First to five rounds takes the
// match. Every sound is synthesised WebAudio; every figure is box-built in code.
//
// Serve it locally with `node serve.ts`, then open the page it names.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps: only text_max_bytes shapes the bytes; the others refuse
// an entry the scorer would refuse (more than 4 screenshots or one over 256 KiB;
// more than 993 files in game/ or 48 MiB of game files, in all, or a path under
// game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
