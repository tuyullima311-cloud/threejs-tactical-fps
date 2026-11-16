// Bot brains: one per bot. A bot perceives only what it can see (line of sight
// plus a forward cone) or hear (recent shots nearby), then picks one job: push
// its assigned site, hold a site, converge on a planted charge, plant it, or
// defuse it. It walks the map's waypoint graph, aims with an error that shrinks
// the longer it has held a target, and fires in bursts with a reaction delay —
// so a still, aiming player wins the duel and a moving one does not.
import { MAP, nearestWaypoint, pointInSite } from './map.js';
import { angleDelta, clamp, range } from './rng.js';

const FOV_COS = 0.42; // ~65 degrees half-angle
const SEE_RANGE = 48;
const REACTION_MIN = 0.45;
const REACTION_MAX = 0.75;

export function createBotBrain(fighter) {
  const index = Number.parseInt(fighter.id.split('-')[1], 10) || 0;
  const isAttacker = fighter.team === 'azure';
  // Attackers split two and two across the sites; defenders do the same, with
  // the fifth defender roaming mid.
  const site = isAttacker ? (index % 2 === 0 ? 'A' : 'B') : (index % 2 === 0 ? 'A' : 'B');
  const midRoamer = !isAttacker && index === 8;

  const brain = {
    site,
    path: [],
    pathIndex: 0,
    holdNodes: [],
    holdIndex: 0,
    holdWait: 0,
    visibleEnemy: null,
    lastSeen: null,
    lastSeenTime: -99,
    aimError: 0,
    aimTime: 0,
    reactionLeft: 0,
    burstLeft: 0,
    pauseLeft: 0,
    strafeDir: 1,
    strafeTimer: 0,
    perceiveTimer: Math.random() * 0.12,
    stuckTimer: 0,
    lastX: fighter.pos.x,
    lastZ: fighter.pos.z,
    grenadeCooldown: 12,
    investigate: null,

    reset() {
      brain.path = [];
      brain.pathIndex = 0;
      brain.holdIndex = 0;
      brain.holdWait = 0;
      brain.visibleEnemy = null;
      brain.lastSeen = null;
      brain.lastSeenTime = -99;
      brain.aimTime = 0;
      brain.reactionLeft = 0;
      brain.burstLeft = 0;
      brain.pauseLeft = 0;
      brain.strafeTimer = 0;
      brain.grenadeCooldown = 12 + Math.random() * 8;
      brain.investigate = null;
      const siteNode = site === 'A' ? 5 : 14;
      const approach = site === 'A' ? 4 : 13;
      if (isAttacker) {
        brain.holdNodes = [siteNode];
      } else if (midRoamer) {
        brain.holdNodes = [9, 8, 17, 18];
      } else {
        brain.holdNodes = [siteNode, approach, site === 'A' ? 21 : 22];
      }
    },

    think(game, dt) {
      const f = fighter;
      if (!f.alive) return;
      brain.grenadeCooldown = Math.max(0, brain.grenadeCooldown - dt);
      brain.perceiveTimer -= dt;
      if (brain.perceiveTimer <= 0) {
        brain.perceiveTimer = 0.12;
        brain.perceive(game);
      }
      // A plant or defuse under fire is abandoned: the channel only holds
      // while nobody is watching. Otherwise stand still and let it finish.
      if (f.channelKind) {
        if (brain.visibleEnemy) {
          f.channel = -1;
          f.channelKind = null;
        } else {
          f.wishX = 0;
          f.wishZ = 0;
          return;
        }
      }
      const enemy = brain.visibleEnemy;
      if (enemy && enemy.alive) {
        brain.engage(game, enemy, dt);
      } else {
        brain.move(game, dt);
      }
      brain.aimAtMovement(game, dt);
    },

    perceive(game) {
      const f = fighter;
      let best = null;
      let bestDist = Infinity;
      const fx = -Math.sin(f.aimYaw);
      const fz = -Math.cos(f.aimYaw);
      for (const other of game.fighters) {
        if (other === f || !other.alive || other.team === f.team) continue;
        const dx = other.pos.x - f.pos.x;
        const dy = other.pos.y + 1.1 - (f.pos.y + f.eye);
        const dz = other.pos.z - f.pos.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist > SEE_RANGE) continue;
        const dot = (dx * fx + dz * fz) / (Math.hypot(dx, dz) || 1);
        if (dot < FOV_COS && dist > 7) continue; // outside the view cone (unless very close)
        if (!game.canSee(f, other)) continue;
        if (dist < bestDist) {
          bestDist = dist;
          best = other;
        }
      }
      if (best) {
        if (brain.visibleEnemy !== best) {
          brain.reactionLeft = REACTION_MIN + Math.random() * (REACTION_MAX - REACTION_MIN);
          brain.aimTime = 0;
          brain.aimError = range(Math.random, 0.06, 0.12);
          brain.burstLeft = 0;
          brain.pauseLeft = 0;
        }
        brain.visibleEnemy = best;
        brain.lastSeen = { x: best.pos.x, z: best.pos.z };
        brain.lastSeenTime = game.time;
      } else {
        brain.visibleEnemy = null;
      }
      // Hearing: a recent shot nearby pulls the bot toward it.
      if (!brain.visibleEnemy && game.time - brain.lastSeenTime > 2) {
        for (const shot of game.shotsHeard) {
          const d = Math.hypot(shot.x - f.pos.x, shot.z - f.pos.z);
          if (d < 25 && game.time - shot.time < 1.5) {
            brain.investigate = { x: shot.x, z: shot.z, until: game.time + 4 };
            break;
          }
        }
      }
    },

    engage(game, enemy, dt) {
      const f = fighter;
      brain.aimTime += dt;
      const dx = enemy.pos.x - f.pos.x;
      const dz = enemy.pos.z - f.pos.z;
      const dist = Math.hypot(dx, dz);
      const targetYaw = Math.atan2(-dx, -dz);
      const targetPitch = Math.atan2(enemy.pos.y + 1.2 - (f.pos.y + f.eye), dist);
      // A moving target is harder to track: rushing the site buys survival.
      const targetSpeed = Math.hypot(enemy.vel.x, enemy.vel.z);
      const movePenalty = 1 + Math.min(1, targetSpeed / 5) * 0.45;
      const error = brain.aimError * movePenalty * Math.max(0.3, 1 - brain.aimTime / 1.6);
      const turn = 4.2 * dt;
      f.aimYaw += clamp(angleDelta(f.aimYaw, targetYaw + error), -turn, turn);
      f.aimPitch += clamp(targetPitch + error * 0.6 - f.aimPitch, -turn, turn);
      f.yaw = f.aimYaw;
      f.pitch = f.aimPitch;
      // Fire in bursts after the reaction delay.
      if (brain.reactionLeft > 0) {
        brain.reactionLeft -= dt;
      } else if (brain.pauseLeft > 0) {
        brain.pauseLeft -= dt;
      } else if (brain.burstLeft > 0) {
        brain.burstLeft -= dt;
        game.fireWeapon(f);
        if (brain.burstLeft <= 0) brain.pauseLeft = f.weapon.def.auto ? 0.75 : 0.9;
      } else {
        brain.burstLeft = f.weapon.def.auto ? 0.28 + Math.random() * 0.2 : 0.1;
      }
      // Strafe while fighting; close in when far, back off when point-blank.
      // At long range the strafe thins out so the duel closes instead of
      // stalling in place forever.
      brain.strafeTimer -= dt;
      if (brain.strafeTimer <= 0) {
        brain.strafeTimer = 0.6 + Math.random() * 0.5;
        brain.strafeDir = Math.random() < 0.5 ? -1 : 1;
      }
      const px = -dz / (dist || 1);
      const pz = dx / (dist || 1);
      const strafeWeight = dist > 14 ? 0.25 : 0.8;
      const advanceWeight = dist > 14 ? 1.2 : dist > 20 ? 1.2 : 0.5;
      let mx = px * brain.strafeDir * strafeWeight;
      let mz = pz * brain.strafeDir * strafeWeight;
      if (dist > 14) {
        mx += (dx / dist) * advanceWeight;
        mz += (dz / dist) * advanceWeight;
      } else if (dist < 5) {
        mx -= (dx / dist) * 0.6;
        mz -= (dz / dist) * 0.6;
      }
      const len = Math.hypot(mx, mz) || 1;
      f.wishX = mx / len;
      f.wishZ = mz / len;
      f.crouching = dist > 22 && Math.random() < 0.3;
      // A grenade at a distant, visible enemy.
      if (f.grenades > 0 && brain.grenadeCooldown <= 0 && dist > 12 && dist < 30) {
        game.throwGrenade(f);
        brain.grenadeCooldown = 25;
      }
    },

    move(game, dt) {
      const f = fighter;
      f.crouching = false;
      // Pick the objective node.
      let targetNode = null;
      let targetPoint = null;
      const bomb = game.bomb;
      // The carrier's job outranks every sound it hears: go plant the charge.
      const isCarrier = isAttacker && bomb.state === 'carried' && bomb.carrier === f;
      if (isAttacker && bomb.state === 'dropped') {
        targetPoint = { x: bomb.x, z: bomb.z };
      } else if (isAttacker && bomb.state === 'planted') {
        // Attackers guard the planted charge from its site.
        targetNode = bomb.site === 'A' ? 5 : 14;
      } else if (!isAttacker && bomb.state === 'planted') {
        targetNode = bomb.site === 'A' ? 5 : 14;
      } else if (brain.investigate && game.time < brain.investigate.until && !isCarrier) {
        targetPoint = brain.investigate;
      } else if (isAttacker) {
        targetNode = brain.holdNodes[0];
      } else {
        // Defenders patrol their hold nodes, waiting a few seconds at each.
        if (brain.holdWait > 0) {
          brain.holdWait -= dt;
          f.wishX = 0;
          f.wishZ = 0;
          return;
        }
        targetNode = brain.holdNodes[brain.holdIndex];
        const node = game.waypoints[targetNode];
        if (Math.hypot(node.x - f.pos.x, node.z - f.pos.z) < 1.2) {
          brain.holdIndex = (brain.holdIndex + 1) % brain.holdNodes.length;
          brain.holdWait = 2.5 + Math.random() * 3;
          brain.path = [];
          f.wishX = 0;
          f.wishZ = 0;
          return;
        }
      }
      // Planting: the carrier plants when it reaches its site with nobody in view.
      if (isAttacker && bomb.state === 'carried' && bomb.carrier === f) {
        const siteRect = MAP.sites[brain.site];
        if (pointInSite(f.pos.x, f.pos.z, siteRect)) {
          game.tryChannel(f);
          f.wishX = 0;
          f.wishZ = 0;
          return;
        }
      }
      // Defusing: the nearest defender at the bomb defuses when nobody is in view.
      if (!isAttacker && bomb.state === 'planted') {
        const d = Math.hypot(bomb.x - f.pos.x, bomb.z - f.pos.z);
        if (d < 2.2) {
          game.tryChannel(f);
          f.wishX = 0;
          f.wishZ = 0;
          return;
        }
      }
      // Follow the waypoint path to the target node.
      let dest = targetPoint;
      if (targetNode !== null && targetNode !== undefined) {
        const here = nearestWaypoint(f.pos.x, f.pos.z);
        if (brain.path.length === 0 || brain.path[brain.path.length - 1] !== targetNode) {
          brain.path = findPathFrom(game, here, targetNode);
          brain.pathIndex = 0;
        }
        // Skip nodes already reached.
        while (brain.pathIndex < brain.path.length) {
          const node = game.waypoints[brain.path[brain.pathIndex]];
          if (Math.hypot(node.x - f.pos.x, node.z - f.pos.z) < 1.2) brain.pathIndex += 1;
          else break;
        }
        if (brain.pathIndex < brain.path.length) {
          dest = game.waypoints[brain.path[brain.pathIndex]];
        } else {
          dest = game.waypoints[targetNode];
        }
      }
      if (!dest) {
        f.wishX = 0;
        f.wishZ = 0;
        return;
      }
      const dx = dest.x - f.pos.x;
      const dz = dest.z - f.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      f.wishX = dx / dist;
      f.wishZ = dz / dist;
      // Stuck detection: no progress while pushing a wall means repath.
      brain.stuckTimer += dt;
      if (brain.stuckTimer > 0.5) {
        const moved = Math.hypot(f.pos.x - brain.lastX, f.pos.z - brain.lastZ);
        if (moved < 0.15 && (Math.abs(f.wishX) > 0.1 || Math.abs(f.wishZ) > 0.1)) {
          brain.path = [];
          brain.stuckTimer = 0;
        }
        brain.lastX = f.pos.x;
        brain.lastZ = f.pos.z;
        brain.stuckTimer = 0;
      }
      // Face where we walk.
      f.aimYaw = Math.atan2(-f.wishX, -f.wishZ);
      f.yaw = f.aimYaw;
    },

    aimAtMovement(game, dt) {
      const f = fighter;
      if (brain.visibleEnemy) return;
      // Look toward the last seen enemy for a while after losing sight.
      if (brain.lastSeen && game.time - brain.lastSeenTime < 2.5) {
        const dx = brain.lastSeen.x - f.pos.x;
        const dz = brain.lastSeen.z - f.pos.z;
        const targetYaw = Math.atan2(-dx, -dz);
        const turn = 3 * dt;
        f.aimYaw += clamp(angleDelta(f.aimYaw, targetYaw), -turn, turn);
        f.yaw = f.aimYaw;
      }
    },
  };
  return brain;
}

function findPathFrom(game, from, to) {
  // BFS over the waypoint graph (same routine the map module exposes).
  const waypoints = game.waypoints;
  if (from === to) return [to];
  const prev = new Array(waypoints.length).fill(-1);
  const queue = [from];
  prev[from] = from;
  while (queue.length) {
    const node = queue.shift();
    for (const next of waypoints[node].links) {
      if (prev[next] !== -1) continue;
      prev[next] = node;
      if (next === to) {
        const path = [to];
        let cur = to;
        while (cur !== from) {
          cur = prev[cur];
          path.unshift(cur);
        }
        return path;
      }
      queue.push(next);
    }
  }
  return [to];
}
