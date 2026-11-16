// Rustyard: an original industrial yard, 46 x 34 m, built from boxes. The map data
// here is pure numbers — no three.js — so the simulation, the bots and the renderer
// all read the same map. Every solid box is a collider for movement and a surface
// a bullet stops on. North is -z: the attackers spawn in the south, the two sites
// (A Foundry, west; B Depot, east) sit in the north, joined by west, middle and
// east lanes with a silo plaza at the centre.
import { PALETTE } from './config.js';

export const MAP = {
  bounds: { x0: -23, x1: 23, z0: -17, z1: 17 },
  sites: {
    A: { name: 'A — Foundry', x0: -20, x1: -12, z0: -14, z1: -7, color: PALETTE.siteA },
    B: { name: 'B — Depot', x0: 12, x1: 20, z0: -14, z1: -7, color: PALETTE.siteB },
  },
  spawns: {
    azure: [
      { x: -5, z: 14, yaw: 0 }, { x: -2, z: 14.5, yaw: 0 }, { x: 0.5, z: 14, yaw: 0 },
      { x: 3, z: 14.5, yaw: 0 }, { x: 5.5, z: 14, yaw: 0 },
    ],
    rust: [
      { x: -8, z: -12.5, yaw: Math.PI }, { x: -3, z: -13, yaw: Math.PI },
      { x: 2, z: -12, yaw: Math.PI }, { x: 7, z: -13, yaw: Math.PI },
      { x: 0, z: -6, yaw: Math.PI },
    ],
  },
};

// Boxes: {w,h,d, x,y,z, mat} with y the centre height. Walls and floor included.
export const BOXES = [
  // Floor and perimeter walls (h 5).
  { w: 46.8, h: 0.4, d: 34.8, x: 0, y: -0.2, z: 0, mat: 'ground' },
  { w: 0.4, h: 5, d: 34.8, x: -23.2, y: 2.5, z: 0, mat: 'wall' },
  { w: 0.4, h: 5, d: 34.8, x: 23.2, y: 2.5, z: 0, mat: 'wall' },
  { w: 46.8, h: 5, d: 0.4, x: 0, y: 2.5, z: -17.2, mat: 'wall' },
  { w: 46.8, h: 5, d: 0.4, x: 0, y: 2.5, z: 17.2, mat: 'wall' },
  // Central silo plaza: the silo itself, and two long containers framing mid.
  { w: 3.4, h: 5, d: 3.4, x: 0, y: 2.5, z: 2, mat: 'pillar' },
  { w: 5, h: 2.6, d: 2.4, x: -4.5, y: 1.3, z: -3, mat: 'container' },
  { w: 5, h: 2.6, d: 2.4, x: 5.5, y: 1.3, z: 4, mat: 'containerB' },
  // West lane cover.
  { w: 1.2, h: 1.1, d: 1.2, x: -15, y: 0.55, z: 4, mat: 'crate' },
  { w: 1.2, h: 1.1, d: 1.2, x: -16.5, y: 0.55, z: -2, mat: 'crate' },
  { w: 1.8, h: 1.6, d: 1.2, x: -13, y: 0.8, z: 8, mat: 'crate' },
  { w: 1, h: 4, d: 1, x: -9, y: 2, z: -6, mat: 'pillar' },
  { w: 1, h: 4, d: 1, x: -9, y: 2, z: 8, mat: 'pillar' },
  // East lane cover (mirrors the west lane).
  { w: 1.2, h: 1.1, d: 1.2, x: 15, y: 0.55, z: 4, mat: 'crate' },
  { w: 1.2, h: 1.1, d: 1.2, x: 16.5, y: 0.55, z: -2, mat: 'crate' },
  { w: 1.8, h: 1.6, d: 1.2, x: 13, y: 0.8, z: 8, mat: 'crate' },
  { w: 1, h: 4, d: 1, x: 9, y: 2, z: -6, mat: 'pillar' },
  { w: 1, h: 4, d: 1, x: 9, y: 2, z: 8, mat: 'pillar' },
  // Site A (Foundry) cover.
  { w: 4, h: 2.6, d: 2.2, x: -16.5, y: 1.3, z: -12.5, mat: 'container' },
  { w: 1.2, h: 1.1, d: 1.2, x: -13.5, y: 0.55, z: -13, mat: 'crate' },
  { w: 1.2, h: 1.1, d: 1.2, x: -18.5, y: 0.55, z: -8.5, mat: 'crate' },
  { w: 1, h: 4, d: 1, x: -12.5, y: 2, z: -10.5, mat: 'pillar' },
  // Site B (Depot) cover.
  { w: 4, h: 2.6, d: 2.2, x: 16.5, y: 1.3, z: -12.5, mat: 'containerB' },
  { w: 1.2, h: 1.1, d: 1.2, x: 13.5, y: 0.55, z: -13, mat: 'crate' },
  { w: 1.2, h: 1.1, d: 1.2, x: 18.5, y: 0.55, z: -8.5, mat: 'crate' },
  { w: 1, h: 4, d: 1, x: 12.5, y: 2, z: -10.5, mat: 'pillar' },
  // Low mid crates and spawn cover.
  { w: 2.4, h: 0.9, d: 1.2, x: -2.5, y: 0.45, z: 8.5, mat: 'crate' },
  { w: 2.4, h: 0.9, d: 1.2, x: 3, y: 0.45, z: -8, mat: 'crate' },
  { w: 1.2, h: 1.1, d: 1.2, x: -8, y: 0.55, z: 13, mat: 'crate' },
  { w: 1.2, h: 1.1, d: 1.2, x: 8, y: 0.55, z: 13, mat: 'crate' },
];

// Waypoint graph the bots walk: nodes with x/z and neighbour indices.
export const WAYPOINTS = [
  { x: 0, z: 13.5, links: [1, 7, 10, 23, 24] }, // 0 attacker spawn
  { x: -15, z: 11, links: [0, 2, 23] }, // 1 west lane entry
  { x: -17, z: 2, links: [1, 3, 19] }, // 2 west mid
  { x: -15, z: -4, links: [2, 4, 17] }, // 3 west north
  { x: -14, z: -6.5, links: [3, 5, 6, 9] }, // 4 site A approach
  { x: -16, z: -10.5, links: [4, 21] }, // 5 site A
  { x: -12.5, z: -8.5, links: [4, 15] }, // 6 site A east edge
  { x: 0, z: 8, links: [0, 8, 19, 20] }, // 7 mid south
  { x: -4, z: 0, links: [7, 9, 19, 20] }, // 8 mid plaza
  { x: 0, z: -5, links: [8, 4, 13, 17, 18] }, // 9 mid north
  { x: 15, z: 11, links: [0, 11, 24] }, // 10 east lane entry
  { x: 17, z: 2, links: [10, 12, 20] }, // 11 east mid
  { x: 15, z: -4, links: [11, 13, 18] }, // 12 east north
  { x: 14, z: -6.5, links: [12, 14, 15, 9] }, // 13 site B approach
  { x: 16, z: -10.5, links: [13, 22] }, // 14 site B
  { x: 12.5, z: -8.5, links: [13, 6] }, // 15 site B west edge
  { x: 0, z: -11, links: [9, 4, 13, 6, 15] }, // 16 defender spawn
  { x: -9, z: -2, links: [3, 9, 19] }, // 17 west connector
  { x: 9, z: -2, links: [12, 9, 20] }, // 18 east connector
  { x: -6, z: 2, links: [2, 8, 17] }, // 19 mid west
  { x: 6, z: 2, links: [11, 8, 18] }, // 20 mid east
  { x: -19, z: -13.5, links: [5] }, // 21 site A far corner
  { x: 19, z: -13.5, links: [14] }, // 22 site B far corner
  { x: -5, z: 13.5, links: [0, 1] }, // 23 attacker spawn west
  { x: 5, z: 13.5, links: [0, 10] }, // 24 attacker spawn east
];

// Breadth-first shortest path over the waypoint graph. Returns node indices.
export function findPath(from, to) {
  if (from === to) return [to];
  const prev = new Array(WAYPOINTS.length).fill(-1);
  const queue = [from];
  prev[from] = from;
  while (queue.length) {
    const node = queue.shift();
    for (const next of WAYPOINTS[node].links) {
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

export function nearestWaypoint(x, z) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < WAYPOINTS.length; i += 1) {
    const dx = WAYPOINTS[i].x - x;
    const dz = WAYPOINTS[i].z - z;
    const d = dx * dx + dz * dz;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

// Colliders derived from BOXES as plain {x0,y0,z0,x1,y1,z1} boxes.
export function buildColliders() {
  return BOXES.map((b) => ({
    x0: b.x - b.w / 2, x1: b.x + b.w / 2,
    y0: b.y - b.h / 2, y1: b.y + b.h / 2,
    z0: b.z - b.d / 2, z1: b.z + b.d / 2,
  }));
}

function overlapsBox(x, y, z, half, height, c) {
  return (
    x - half < c.x1 && x + half > c.x0 &&
    y < c.y1 && y + height > c.y0 &&
    z - half < c.z1 && z + half > c.z0
  );
}

// Move a standing box (feet at pos, square footprint half, height) with velocity,
// one axis at a time so a wall never swallows the mover. Returns onGround.
export function moveBox(pos, half, height, vel, dt, colliders) {
  let onGround = false;
  const nx = pos.x + vel.x * dt;
  let blocked = false;
  for (const c of colliders) {
    if (overlapsBox(nx, pos.y + 0.05, pos.z, half, height - 0.1, c)) { blocked = true; break; }
  }
  if (!blocked) pos.x = nx; else vel.x = 0;
  const nz = pos.z + vel.z * dt;
  blocked = false;
  for (const c of colliders) {
    if (overlapsBox(pos.x, pos.y + 0.05, nz, half, height - 0.1, c)) { blocked = true; break; }
  }
  if (!blocked) pos.z = nz; else vel.z = 0;
  pos.y += vel.y * dt;
  for (const c of colliders) {
    if (!overlapsBox(pos.x, pos.y, pos.z, half, height, c)) continue;
    if (vel.y <= 0 && pos.y >= c.y1 - 0.6) {
      pos.y = c.y1;
      vel.y = 0;
      onGround = true;
    } else if (vel.y > 0) {
      pos.y = c.y0 - height;
      vel.y = 0;
    }
  }
  if (pos.y <= 0) {
    pos.y = 0;
    vel.y = 0;
    onGround = true;
  }
  return onGround;
}

// Line of sight: sample the segment; blocked if any sample sits inside a collider.
export function segmentBlocked(ax, ay, az, bx, by, bz, colliders) {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const dist = Math.hypot(dx, dy, dz);
  const steps = Math.max(1, Math.ceil(dist / 0.25));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = ax + dx * t;
    const y = ay + dy * t;
    const z = az + dz * t;
    for (const c of colliders) {
      if (x > c.x0 + 0.02 && x < c.x1 - 0.02 && y > c.y0 + 0.02 && y < c.y1 - 0.02 && z > c.z0 + 0.02 && z < c.z1 - 0.02) {
        return true;
      }
    }
  }
  return false;
}

// Slab-method ray vs a list of boxes: nearest hit distance, or Infinity.
export function rayHitBoxes(ox, oy, oz, dx, dy, dz, maxDist, colliders) {
  let best = Infinity;
  for (const c of colliders) {
    let tmin = 0;
    let tmax = maxDist;
    let ok = true;
    const axes = [
      [ox, dx, c.x0, c.x1], [oy, dy, c.y0, c.y1], [oz, dz, c.z0, c.z1],
    ];
    for (const [o, d, lo, hi] of axes) {
      if (Math.abs(d) < 1e-9) {
        if (o < lo || o > hi) { ok = false; break; }
      } else {
        let t1 = (lo - o) / d;
        let t2 = (hi - o) / d;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) { ok = false; break; }
      }
    }
    if (ok && tmin < best && tmin >= 0) best = tmin;
  }
  return best;
}

// Ray vs a sphere: nearest hit distance, or Infinity.
export function rayHitSphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r, maxDist) {
  const lx = cx - ox;
  const ly = cy - oy;
  const lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return Infinity;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  const r2 = r * r;
  if (d2 > r2) return Infinity;
  const thc = Math.sqrt(r2 - d2);
  const t = tca - thc;
  if (t < 0 || t > maxDist) return Infinity;
  return t;
}

export function pointInSite(x, z, site) {
  return x >= site.x0 && x <= site.x1 && z >= site.z0 && z <= site.z1;
}

export function siteCenter(site) {
  return { x: (site.x0 + site.x1) / 2, z: (site.z0 + site.z1) / 2 };
}
