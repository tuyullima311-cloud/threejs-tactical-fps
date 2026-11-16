// The game itself: rounds, teams, the economy, the bomb, grenades and hitscan
// combat — all pure numbers, no DOM and no three.js. The renderer only mirrors
// this state. One fixed 60 Hz step drives everything, so a replay of the same
// inputs gives the same round.
import {
  ROUND_TIME, FREEZE_TIME, PLANT_TIME, DEFUSE_TIME, BOMB_TIME,
  WIN_ROUNDS, MAX_ROUNDS, ECONOMY, WEAPONS, GRENADE,
} from './config.js';
import { MAP, buildColliders, moveBox, segmentBlocked, rayHitBoxes, rayHitSphere, pointInSite, nearestWaypoint, findPath, WAYPOINTS } from './map.js';
import { createFighter, resetFighter, applyDamage, hitSpheres, STAND_HEIGHT, CROUCH_HEIGHT, STAND_EYE, CROUCH_EYE, RADIUS } from './fighter.js';
import { createWeaponState, weaponReady, weaponTakeRound, weaponStartReload, weaponUpdate, weaponSpread, weaponDamage } from './weapons.js';
import { createBotBrain } from './bots.js';
import { clamp, angleDelta } from './rng.js';

const WALK_SPEED = 5.2;
const CROUCH_SPEED = 2.4;
const GROUND_ACCEL = 42;
const AIR_ACCEL = 9;
const FRICTION = 9;
const GRAVITY = 20;
const JUMP_SPEED = 6.2;

function forwardFrom(yaw, pitch) {
  const cp = Math.cos(pitch);
  return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
}

export function createGame(random, audio) {
  const colliders = buildColliders();
  const player = createFighter('player', 'azure', 'You', true);
  const bots = [];
  const brains = new Map();
  const names = { azure: ['Juno', 'Marlowe', 'Kestrel', 'Bram'], rust: ['Vex', 'Harrow', 'Dagger', 'Rook', 'Sable'] };
  let botIndex = 0;
  for (const team of ['azure', 'rust']) {
    for (const name of names[team]) {
      const bot = createFighter(`bot-${botIndex}`, team, name, false);
      bots.push(bot);
      brains.set(bot.id, createBotBrain(bot));
      botIndex += 1;
    }
  }
  const fighters = [player, ...bots];

  const game = {
    random, audio, colliders,
    player, bots, fighters,
    phase: 'menu', // menu | freeze | live | roundEnd | matchEnd
    round: 0,
    score: { azure: 0, rust: 0 },
    timer: 0,
    time: 0,
    bomb: { state: 'carried', site: null, x: 0, z: 0, timer: 0, carrier: player },
    grenades: [],
    tracers: [],
    feed: [], // killfeed entries {text, team, time}
    shotsHeard: [],
    banner: null, // {title, sub, until}
    matchWinner: null,
    buyOpen: false,
    primaryId: 'rifle',
    roundKills: 0,
    beepTimer: 0,
    stepCount: 0,

    startMatch() {
      game.score.azure = 0;
      game.score.rust = 0;
      game.round = 0;
      game.matchWinner = null;
      game.banner = null;
      game.feed = [];
      for (const f of fighters) {
        f.money = ECONOMY.startMoney;
        f.kills = 0;
        f.deaths = 0;
        f.grenades = 0;
        f.armor = 0;
      }
      game.primaryId = 'rifle';
      game.startRound();
    },

    startRound() {
      game.round += 1;
      game.phase = 'freeze';
      game.timer = FREEZE_TIME;
      game.bomb = { state: 'carried', site: null, x: 0, z: 0, timer: 0, carrier: player };
      game.grenades = [];
      game.tracers = [];
      game.banner = null;
      const azureSpawns = MAP.spawns.azure;
      const rustSpawns = MAP.spawns.rust;
      const azureLoadout = ['rifle', 'rifle', 'sniper', 'rifle', 'smg'];
      const rustLoadout = ['smg', 'rifle', 'shotgun', 'rifle', 'smg'];
      let ai = 0;
      let ri = 0;
      for (const f of fighters) {
        const spawn = f.team === 'azure' ? azureSpawns[ai % azureSpawns.length] : rustSpawns[ri % rustSpawns.length];
        if (f.team === 'azure') ai += 1; else ri += 1;
        const weaponId = f.isPlayer ? game.primaryId : (f.team === 'azure' ? azureLoadout[(ai - 1) % 5] : rustLoadout[(ri - 1) % 5]);
        resetFighter(f, spawn, weaponId);
        if (!f.isPlayer) {
          f.grenades = random() < 0.4 ? 1 : 0;
          const brain = brains.get(f.id);
          brain.reset(game.round);
        }
      }
      game.bomb.carrier = player;
      game.feed.push({ text: `Round ${game.round} — plant the charge at A or B`, team: 'azure', time: game.time });
    },

    aliveCount(team) {
      let n = 0;
      for (const f of fighters) if (f.team === team && f.alive) n += 1;
      return n;
    },

    buy(itemId) {
      if (game.phase !== 'freeze') return false;
      const p = player;
      if (itemId === 'armor') {
        if (p.money < 650 || p.armor >= 100) { audio.denied(); return false; }
        p.money -= 650;
        p.armor = 100;
        audio.buy();
        return true;
      }
      if (itemId === 'grenade') {
        if (p.money < GRENADE.price || p.grenades >= 2) { audio.denied(); return false; }
        p.money -= GRENADE.price;
        p.grenades += 1;
        audio.buy();
        return true;
      }
      const def = WEAPONS[itemId];
      if (!def) return false;
      if (p.money < def.price) { audio.denied(); return false; }
      p.money -= def.price;
      game.primaryId = itemId;
      equipPrimary(p, itemId);
      audio.buy();
      return true;
    },

    // One fixed step. input is the player's per-frame snapshot; bots read the game.
    step(dt, input) {
      game.time += dt;
      game.stepCount += 1;
      if (game.phase === 'menu' || game.phase === 'matchEnd') {
        // Idle scene: bots stand at spawn, world still.
        return;
      }
      if (game.phase === 'freeze') {
        game.timer -= dt;
        applyPlayerInput(player, input, dt, true);
        stepFighterMovement(player, dt);
        if (game.timer <= 0) {
          game.phase = 'live';
          game.timer = ROUND_TIME;
          game.buyOpen = false;
          game.feed.push({ text: 'Round live — go plant the charge', team: 'azure', time: game.time });
        }
        return;
      }
      if (game.phase === 'roundEnd') {
        game.timer -= dt;
        for (const f of fighters) weaponUpdate(f.weapon, dt);
        if (game.timer <= 0) {
          if (game.matchWinner) game.phase = 'matchEnd';
          else game.startRound();
        }
        return;
      }
      // Live round.
      game.timer -= dt;
      // Bomb beeps speed up as the timer runs down.
      if (game.bomb.state === 'planted') {
        game.bomb.timer -= dt;
        game.beepTimer -= dt;
        const interval = game.bomb.timer > 10 ? 1 : 0.45;
        if (game.beepTimer <= 0) {
          game.beepTimer = interval;
          audio.plantBeep(false);
        }
        if (game.bomb.timer <= 0) {
          explodeBomb();
          return;
        }
      }
      if (game.timer <= 0 && game.bomb.state !== 'planted') {
        endRound('rust', 'Time expired — RUST holds the yard');
        return;
      }
      applyPlayerInput(player, input, dt, false);
      for (const bot of bots) {
        if (!bot.alive) continue;
        brains.get(bot.id).think(game, dt);
      }
      for (const f of fighters) {
        if (!f.alive) continue;
        stepFighterMovement(f, dt);
        weaponUpdate(f.weapon, dt);
        if (f.channelKind) updateChannel(f, dt);
      }
      stepGrenades(dt);
      stepTracers(dt);
      game.checkBombPickup();
      // Prune old heard shots.
      while (game.shotsHeard.length && game.time - game.shotsHeard[0].time > 4) game.shotsHeard.shift();
      // Elimination check.
      if (game.aliveCount('azure') === 0) {
        endRound(game.bomb.state === 'planted' ? 'azure' : 'rust',
          game.bomb.state === 'planted' ? 'Charge planted — AZURE takes the round' : 'AZURE eliminated');
        return;
      }
      if (game.aliveCount('rust') === 0) {
        endRound('azure', 'RUST eliminated');
      }
    },
  };

  function equipPrimary(fighter, weaponId) {
    fighter.weaponId = weaponId;
    fighter.weapon = createWeaponState(weaponId);
  }

  // Switch between the bought primary and the sidearm.
  game.switchWeapon = function switchWeapon(slot) {    if (!player.alive || game.phase !== 'live' && game.phase !== 'freeze') return;
    if (slot === 1 && player.weaponId !== game.primaryId) equipPrimary(player, game.primaryId);
    if (slot === 2 && player.weaponId !== 'sidearm') equipPrimary(player, 'sidearm');
  };

  // Bots fire through the same hitscan path as the player.
  game.fireWeapon = function fireWeapon(fighter) {
    if (game.phase !== 'live' || !fighter.alive) return;
    tryFire(fighter);
  };

  game.throwGrenade = function throwGrenade(fighter) {
    if (!fighter.alive || fighter.grenades <= 0) return false;
    fighter.grenades -= 1;
    const dir = forwardFrom(fighter.aimYaw, fighter.aimPitch);
    const eye = fighter.pos.y + fighter.eye;
    game.grenades.push({
      owner: fighter,
      x: fighter.pos.x + dir.x * 0.6, y: eye - 0.1, z: fighter.pos.z + dir.z * 0.6,
      vx: dir.x * GRENADE.throwSpeed + fighter.vel.x * 0.5,
      vy: dir.y * GRENADE.throwSpeed + 3.5,
      vz: dir.z * GRENADE.throwSpeed + fighter.vel.z * 0.5,
      fuse: GRENADE.fuse, bounced: false,
    });
    return true;
  };

  function applyPlayerInput(fighter, input, dt, frozen) {
    // Mouse look was already applied to yaw/pitch by main.js; here we read the
    // movement keys into a world-space wish.
    const keys = input.keys;
    const forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    const sin = Math.sin(fighter.yaw);
    const cos = Math.cos(fighter.yaw);
    let wx = -sin * forward + cos * strafe;
    let wz = -cos * forward - sin * strafe;
    const len = Math.hypot(wx, wz);
    if (len > 0) { wx /= len; wz /= len; }
    fighter.wishX = frozen ? 0 : wx;
    fighter.wishZ = frozen ? 0 : wz;
    fighter.wishJump = !frozen && keys.has('Space') && fighter.onGround;
    fighter.crouching = keys.has('ControlLeft') || keys.has('KeyC');
    fighter.aimYaw = fighter.yaw;
    fighter.aimPitch = fighter.pitch;
    if (frozen) return;
    if (input.firing) tryFire(fighter);
    if (input.reloadPressed) weaponStartReload(fighter.weapon);
  }

  function stepFighterMovement(f, dt) {
    const crouching = f.crouching;
    const targetHeight = crouching ? CROUCH_HEIGHT : STAND_HEIGHT;
    if (crouching && f.height !== CROUCH_HEIGHT) f.height = CROUCH_HEIGHT;
    else if (!crouching && f.height !== STAND_HEIGHT) {
      // Only stand up when the space above is clear.
      let blocked = false;
      for (const c of colliders) {
        if (f.pos.x - RADIUS < c.x1 && f.pos.x + RADIUS > c.x0 && f.pos.y < c.y1 && f.pos.y + STAND_HEIGHT > c.y0 && f.pos.z - RADIUS < c.z1 && f.pos.z + RADIUS > c.z0) { blocked = true; break; }
      }
      if (!blocked) f.height = STAND_HEIGHT;
    }
    const eyeTarget = f.height === CROUCH_HEIGHT ? CROUCH_EYE : STAND_EYE;
    f.eye += (eyeTarget - f.eye) * Math.min(1, dt * 12);
    const speed = f.height === CROUCH_HEIGHT ? CROUCH_SPEED : WALK_SPEED;
    const wishLen = Math.hypot(f.wishX, f.wishZ);
    const blend = Math.min(1, (f.onGround ? GROUND_ACCEL : AIR_ACCEL) * dt / speed);
    f.vel.x += (f.wishX * speed * (wishLen > 0 ? 1 : 0) - f.vel.x) * blend;
    f.vel.z += (f.wishZ * speed * (wishLen > 0 ? 1 : 0) - f.vel.z) * blend;
    if (f.onGround && wishLen === 0) {
      const damp = Math.max(0, 1 - FRICTION * dt);
      f.vel.x *= damp;
      f.vel.z *= damp;
    }
    if (f.wishJump && f.onGround) {
      f.vel.y = JUMP_SPEED;
      f.onGround = false;
    }
    f.vel.y -= GRAVITY * dt;
    f.onGround = moveBox(f.pos, RADIUS, f.height, f.vel, dt, colliders);
    f.vel.y = Math.max(-30, f.vel.y);
  }

  function groundSpeed(f) {
    return Math.hypot(f.vel.x, f.vel.z);
  }

  // Hitscan fire: one ray per pellet against walls and every living enemy's
  // hit spheres. The nearest hit wins; a head sphere pays the head multiplier.
  function tryFire(shooter) {
    const weapon = shooter.weapon;
    if (!weaponReady(weapon)) {
      if (weapon.mag === 0 && weapon.cooldown <= 0) audio.dryFire();
      return;
    }
    if (!weaponTakeRound(weapon)) return;
    const def = weapon.def;
    const eyeY = shooter.pos.y + shooter.eye;
    const spread = weaponSpread(weapon, groundSpeed(shooter), shooter.crouching, !shooter.onGround);
    const pellets = def.pellets || 1;
    let anyHit = false;
    for (let p = 0; p < pellets; p += 1) {
      const base = forwardFrom(shooter.aimYaw, shooter.aimPitch);
      const dir = {
        x: base.x + (random() * 2 - 1) * spread,
        y: base.y + (random() * 2 - 1) * spread,
        z: base.z + (random() * 2 - 1) * spread,
      };
      const dl = Math.hypot(dir.x, dir.y, dir.z) || 1;
      dir.x /= dl; dir.y /= dl; dir.z /= dl;
      const wallDist = rayHitBoxes(shooter.pos.x, eyeY, shooter.pos.z, dir.x, dir.y, dir.z, def.range, colliders);
      let bestDist = wallDist;
      let bestVictim = null;
      let bestHead = false;
      for (const target of fighters) {
        if (target === shooter || !target.alive || target.team === shooter.team) continue;
        for (const sphere of hitSpheres(target)) {
          const t = rayHitSphere(shooter.pos.x, eyeY, shooter.pos.z, dir.x, dir.y, dir.z, sphere.x, sphere.y, sphere.z, sphere.r, def.range);
          if (t < bestDist) {
            bestDist = t;
            bestVictim = target;
            bestHead = sphere.part === 'head';
          }
        }
      }
      const end = {
        x: shooter.pos.x + dir.x * bestDist,
        y: eyeY + dir.y * bestDist,
        z: shooter.pos.z + dir.z * bestDist,
      };
      game.tracers.push({
        x1: shooter.pos.x + dir.x * 0.7, y1: eyeY - 0.08, z1: shooter.pos.z + dir.z * 0.7,
        x2: end.x, y2: end.y, z2: end.z, color: def.tracer, ttl: 0.07,
      });
      if (bestVictim) {
        anyHit = true;
        const damage = weaponDamage(weapon, bestDist, bestHead);
        const dealt = applyDamage(bestVictim, damage);
        if (bestVictim === player) audio.hurt();
        if (shooter === player) audio.hit(!bestVictim.alive);
        if (!bestVictim.alive) {
          shooter.kills += 1;
          bestVictim.deaths += 1;
          shooter.money = Math.min(ECONOMY.maxMoney, shooter.money + ECONOMY.killReward);
          if (shooter === player) game.roundKills += 1;
          game.feed.push({
            text: `${shooter.name} ✕ ${bestVictim.name}${bestHead ? ' (headshot)' : ''} — ${def.name}`,
            team: shooter.team, time: game.time,
          });
          if (game.bomb.carrier === bestVictim) {
            game.bomb.state = 'dropped';
            game.bomb.x = bestVictim.pos.x;
            game.bomb.z = bestVictim.pos.z;
            game.bomb.carrier = null;
            game.feed.push({ text: 'The charge was dropped!', team: 'azure', time: game.time });
          }
          bestVictim.flashUntil = 0;
        }
      }
    }
    // Recoil kicks the shooter's aim up; the player feels it, bots absorb it.
    shooter.pitch = Math.min(1.45, shooter.pitch + def.kick * 0.55);
    shooter.aimPitch = shooter.pitch;
    if (shooter.isPlayer) {
      audio.shot(def.kind);
      game.lastPlayerShot = game.time;
    } else audio.distantShot();
    game.shotsHeard.push({ x: shooter.pos.x, z: shooter.pos.z, time: game.time });
    if (anyHit && shooter.isPlayer) player.flashUntil = game.time + 0.12;
  }

  function stepGrenades(dt) {
    for (let i = game.grenades.length - 1; i >= 0; i -= 1) {
      const g = game.grenades[i];
      g.vy -= GRAVITY * dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.z += g.vz * dt;
      let bounced = false;
      for (const c of colliders) {
        if (g.x > c.x0 && g.x < c.x1 && g.y > c.y0 && g.y < c.y1 && g.z > c.z0 && g.z < c.z1) {
          // Push out along the smallest penetration and reflect that axis.
          const dxl = g.x - c.x0; const dxr = c.x1 - g.x;
          const dyl = g.y - c.y0; const dyr = c.y1 - g.y;
          const dzl = g.z - c.z0; const dzr = c.z1 - g.z;
          const min = Math.min(dxl, dxr, dyl, dyr, dzl, dzr);
          if (min === dxl) { g.x = c.x0; g.vx = -Math.abs(g.vx) * 0.45; }
          else if (min === dxr) { g.x = c.x1; g.vx = Math.abs(g.vx) * 0.45; }
          else if (min === dyl) { g.y = c.y0; g.vy = -Math.abs(g.vy) * 0.45; }
          else if (min === dyr) { g.y = c.y1; g.vy = Math.abs(g.vy) * 0.45; }
          else if (min === dzl) { g.z = c.z0; g.vz = -Math.abs(g.vz) * 0.45; }
          else { g.z = c.z1; g.vz = Math.abs(g.vz) * 0.45; }
          bounced = true;
        }
      }
      if (g.y < 0.05) {
        g.y = 0.05;
        g.vy = Math.abs(g.vy) * 0.45;
        bounced = true;
      }
      if (bounced && !g.bounced) {
        g.bounced = true;
        audio.grenadeBounce();
      }
      g.fuse -= dt;
      if (g.fuse <= 0) {
        explodeGrenade(g);
        game.grenades.splice(i, 1);
      }
    }
  }

  function explodeGrenade(g) {
    audio.explosion();
    game.tracers.push({ x1: g.x, y1: g.y, z1: g.z, x2: g.x, y2: g.y, z2: g.z, color: '#ff8833', ttl: 0.25, blast: true });
    for (const f of fighters) {
      if (!f.alive) continue;
      const d = Math.hypot(f.pos.x - g.x, f.pos.y + 0.9 - g.y, f.pos.z - g.z);
      if (d > GRENADE.radius) continue;
      const damage = GRENADE.maxDamage * (1 - (d / GRENADE.radius) * 0.7);
      const wasAlive = f.alive;
      applyDamage(f, damage);
      if (f === player) audio.hurt();
      if (!f.alive && wasAlive && g.owner) {
        g.owner.kills += 1;
        f.deaths += 1;
        game.feed.push({ text: `${g.owner.name} ✕ ${f.name} — Spark Grenade`, team: g.owner.team, time: game.time });
      }
    }
    game.shotsHeard.push({ x: g.x, z: g.z, time: game.time });
  }

  function explodeBomb() {
    audio.explosion();
    game.bomb.state = 'detonated';
    for (const f of fighters) {
      if (!f.alive) continue;
      const d = Math.hypot(f.pos.x - game.bomb.x, f.pos.z - game.bomb.z);
      if (d < 9) applyDamage(f, 200);
    }
    endRound('azure', 'Charge detonated — AZURE takes the round');
  }

  // Plant / defuse channels: hold still in the right place and the bar fills.
  function updateChannel(f, dt) {
    const kind = f.channelKind;
    if (kind === 'plant') {
      const site = MAP.sites[game.bomb.site || 'A'];
      const inSite = game.bomb.site && pointInSite(f.pos.x, f.pos.z, site);
      if (!inSite || !f.alive) { f.channel = -1; f.channelKind = null; return; }
      f.channel += dt / PLANT_TIME;
      if (f.channel >= 1) {
        f.channel = -1; f.channelKind = null;
        game.bomb.state = 'planted';
        game.bomb.timer = BOMB_TIME;
        game.bomb.x = f.pos.x;
        game.bomb.z = f.pos.z;
        game.bomb.carrier = null;
        f.money = Math.min(ECONOMY.maxMoney, f.money + ECONOMY.plantReward);
        audio.plantBeep(true);
        game.feed.push({ text: `${f.name} planted the charge at ${game.bomb.site}!`, team: f.team, time: game.time });
      }
    } else if (kind === 'defuse') {
      const near = Math.hypot(f.pos.x - game.bomb.x, f.pos.z - game.bomb.z) < 2.2;
      if (!near || !f.alive || game.bomb.state !== 'planted') { f.channel = -1; f.channelKind = null; return; }
      f.channel += dt / DEFUSE_TIME;
      if (f.channel >= 1) {
        f.channel = -1; f.channelKind = null;
        game.bomb.state = 'defused';
        endRound('rust', 'Charge defused — RUST holds the yard');
      }
    }
  }

  // Called by main.js when the player holds E; bots call it from their brains.
  game.tryChannel = function tryChannel(fighter) {
    if (!fighter.alive || game.phase !== 'live') return;
    if (fighter.channelKind) return;
    if (fighter.team === 'azure' && game.bomb.state === 'carried' && game.bomb.carrier === fighter) {
      for (const key of ['A', 'B']) {
        if (pointInSite(fighter.pos.x, fighter.pos.z, MAP.sites[key])) {
          game.bomb.site = key;
          fighter.channel = 0;
          fighter.channelKind = 'plant';
          return;
        }
      }
    }
    if (fighter.team === 'rust' && game.bomb.state === 'planted') {
      if (Math.hypot(fighter.pos.x - game.bomb.x, fighter.pos.z - game.bomb.z) < 2.2) {
        fighter.channel = 0;
        fighter.channelKind = 'defuse';
      }
    }
    if (fighter.team === 'azure' && game.bomb.state === 'planted') {
      // Attackers cannot defuse their own charge.
    }
  };

  // Picking the dropped charge up: walk over it.
  game.checkBombPickup = function checkBombPickup() {
    if (game.bomb.state !== 'dropped') return;
    for (const f of fighters) {
      if (f.team !== 'azure' || !f.alive) continue;
      if (Math.hypot(f.pos.x - game.bomb.x, f.pos.z - game.bomb.z) < 1.6) {
        game.bomb.state = 'carried';
        game.bomb.carrier = f;
        game.feed.push({ text: `${f.name} picked up the charge`, team: 'azure', time: game.time });
        return;
      }
    }
  };

  function endRound(winner, reason) {
    if (game.phase !== 'live') return;
    game.phase = 'roundEnd';
    game.timer = 4;
    game.score[winner] += 1;
    for (const f of fighters) {
      f.money = Math.min(ECONOMY.maxMoney, f.money + (f.team === winner ? ECONOMY.winReward : ECONOMY.lossReward));
    }
    game.banner = { title: winner === 'azure' ? 'ROUND WON' : 'ROUND LOST', sub: reason, until: game.time + 4 };
    game.feed.push({ text: reason, team: winner, time: game.time });
    if (winner === 'azure') audio.roundWin(); else audio.roundLose();
    if (game.score[winner] >= WIN_ROUNDS || game.round >= MAX_ROUNDS) {
      const matchWinner = game.score.azure > game.score.rust ? 'azure' : game.score.rust > game.score.azure ? 'rust' : null;
      game.matchWinner = matchWinner || winner;
    }
  }

  function stepTracers(dt) {
    for (let i = game.tracers.length - 1; i >= 0; i -= 1) {
      game.tracers[i].ttl -= dt;
      if (game.tracers[i].ttl <= 0) game.tracers.splice(i, 1);
    }
  }

  // Visibility test shared by bots and the HUD: can `a` see `b`'s chest?
  game.canSee = function canSee(a, b) {
    const ax = a.pos.x;
    const ay = a.pos.y + a.eye;
    const az = a.pos.z;
    const bx = b.pos.x;
    const by = b.pos.y + 1.1;
    const bz = b.pos.z;
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > 48) return false;
    return !segmentBlocked(ax, ay, az, bx, by, bz, colliders);
  };

  game.nearestWaypoint = nearestWaypoint;
  game.findPath = findPath;
  game.waypoints = WAYPOINTS;
  game.sites = MAP.sites;

  return game;
}
