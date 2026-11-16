// Screenshot scenes for ?shot=start|play|plant|end. Each one drives the real
// simulation into a deterministic frame, renders it twice, then freezes it and
// sets window.__shotReady. Nothing here is staged art: the bots, the bomb and the
// tracers are the game's own state.
import { MAP } from './map.js';

function dummyInput() {
  return { keys: new Set(), firing: false, reloadPressed: false };
}

function aimAt(game, x, y, z) {
  const p = game.player;
  const dx = x - p.pos.x;
  const dy = y - (p.pos.y + p.eye);
  const dz = z - p.pos.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  p.yaw = Math.atan2(-dx, -dz);
  p.pitch = Math.asin(Math.max(-1, Math.min(1, dy / len)));
  p.aimYaw = p.yaw;
  p.aimPitch = p.pitch;
}

function settle(game, steps) {
  const input = dummyInput();
  for (let i = 0; i < steps; i += 1) game.step(1 / 60, input);
}

function place(game, x, z, yaw) {
  const p = game.player;
  p.pos.x = x;
  p.pos.z = z;
  p.pos.y = 0;
  p.yaw = yaw;
  p.pitch = 0;
  p.aimYaw = yaw;
  p.aimPitch = 0;
  p.vel.x = 0;
  p.vel.y = 0;
  p.vel.z = 0;
}

export function setupShot(game, name) {
  game.startMatch();
  const p = game.player;
  if (name === 'start') {
    // Freeze time at the attacker spawn, buy menu open, the yard ahead.
    place(game, 0, 14, 0);
    settle(game, 30);
    place(game, 0, 14, 0);
    game.buyOpen = true;
    aimAt(game, 0, 1.4, -10);
  } else if (name === 'play') {
    // Mid-round in the middle lane: an enemy in the sights, a tracer in the air.
    game.phase = 'live';
    game.timer = 85;
    settle(game, 90);
    const enemy = game.bots.find((b) => b.team === 'rust' && b.alive);
    place(game, -13.5, 7, 0);
    if (enemy) {
      enemy.pos.x = -14.5;
      enemy.pos.z = -2.5;
      enemy.pos.y = 0;
      enemy.yaw = Math.PI;
      enemy.aimYaw = Math.PI;
      enemy.hp = 62;
      aimAt(game, enemy.pos.x, 1.3, enemy.pos.z);
      game.tracers.push({
        x1: p.pos.x, y1: p.pos.y + p.eye - 0.1, z1: p.pos.z,
        x2: enemy.pos.x, y2: 1.3, z2: enemy.pos.z,
        color: '#ffe9b0', ttl: 60,
      });
    }
    const friend = game.bots.find((b) => b.team === 'azure' && b.alive && !b.isPlayer);
    if (friend) {
      friend.pos.x = -11.5;
      friend.pos.z = 4.5;
      friend.yaw = 0.4;
      friend.aimYaw = 0.4;
    }
  } else if (name === 'plant') {
    // The charge is planted at A and ticking; a defender holds the far corner.
    game.phase = 'live';
    game.timer = 60;
    settle(game, 60);
    game.bomb = { state: 'planted', site: 'A', x: -13.5, z: -12.5, timer: 22, carrier: null };
    place(game, -11.5, -3.5, 0);
    aimAt(game, -13.5, 1.0, -12.5);
    const defender = game.bots.find((b) => b.team === 'rust' && b.alive);
    if (defender) {
      defender.pos.x = -19.5;
      defender.pos.z = -8.5;
      defender.yaw = Math.PI * 0.75;
      defender.aimYaw = defender.yaw;
    }
    const guard = game.bots.find((b) => b.team === 'azure' && b.alive && !b.isPlayer);
    if (guard) {
      guard.pos.x = -14;
      guard.pos.z = -6.5;
      guard.yaw = -0.6;
      guard.aimYaw = -0.6;
    }
  } else {
    // Round won: RUST is down, the banner is up, the score is 1–0.
    game.phase = 'live';
    game.timer = 60;
    settle(game, 45);
    for (const b of game.bots) {
      if (b.team === 'rust') {
        b.alive = false;
        b.hp = 0;
      }
    }
    game.score.azure = 1;
    game.phase = 'roundEnd';
    game.timer = 4;
    game.banner = { title: 'ROUND WON', sub: 'RUST eliminated — AZURE takes the round', until: game.time + 4 };
    place(game, 10, 6, 0);
    const fallen = game.bots.find((b) => b.team === 'rust');
    if (fallen) {
      fallen.pos.x = 10;
      fallen.pos.z = -2;
      aimAt(game, fallen.pos.x, 0.4, fallen.pos.z);
    } else {
      aimAt(game, 0, 1.4, -10);
    }
  }
}
