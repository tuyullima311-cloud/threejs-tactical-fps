// A weapon's live state: magazine, reserve, cooldown, reload and recoil bloom.
// The numbers live in config.js; this module owns only the state machine, so the
// player, the bots and the buy menu all drive the same rules.
import * as THREE from 'three';
import { WEAPONS } from './config.js';

export function createWeaponState(weaponId) {
  const def = WEAPONS[weaponId];
  return {
    def,
    mag: def.mag,
    reserve: def.reserve,
    cooldown: 0,
    reloadLeft: 0,
    bloom: 0, // 0..1, grows while firing, decays while still
    kick: 0, // viewmodel kick, decays fast
  };
}

export function weaponReady(state) {
  return state.mag > 0 && state.cooldown <= 0 && state.reloadLeft <= 0;
}

export function weaponTakeRound(state) {
  if (state.mag <= 0) return false;
  state.mag -= 1;
  state.cooldown = state.def.fireGap;
  state.bloom = Math.min(1, state.bloom + (state.def.kind === 'sniper' ? 0.55 : 0.22));
  state.kick = 1;
  return true;
}

export function weaponStartReload(state) {
  if (state.reloadLeft > 0 || state.mag === state.def.mag || state.reserve === 0) return false;
  state.reloadLeft = state.def.reloadTime;
  return true;
}

export function weaponUpdate(state, dt) {
  state.cooldown = Math.max(0, state.cooldown - dt);
  state.bloom = Math.max(0, state.bloom - dt * 1.6);
  state.kick = Math.max(0, state.kick - dt * 9);
  if (state.reloadLeft > 0) {
    state.reloadLeft = Math.max(0, state.reloadLeft - dt);
    if (state.reloadLeft === 0) {
      const need = state.def.mag - state.mag;
      const take = Math.min(need, state.reserve);
      state.mag += take;
      state.reserve -= take;
    }
  }
}

// Spread in radians: still and crouched is tight; moving, airborne or holding a
// bloom from recent fire opens it up. Stopping to aim pays — that is the gunplay.
export function weaponSpread(state, speed, crouching, airborne) {
  const def = state.def;
  let spread = def.spreadStill + state.bloom * def.spreadMove * 1.4;
  const moveFactor = Math.min(1, speed / 5.2);
  spread += moveFactor * def.spreadMove;
  if (crouching) spread *= 0.65;
  if (airborne) spread += 0.02;
  return spread;
}

// Damage at a range, with falloff past the weapon's falloff start.
export function weaponDamage(state, distance, head) {
  const def = state.def;
  let damage = def.damage;
  if (distance > def.falloffStart) {
    const t = Math.min(1, (distance - def.falloffStart) / Math.max(1, def.range - def.falloffStart));
    damage *= 1 - (1 - def.falloffMin) * t;
  }
  if (head) damage *= def.headMult;
  return damage;
}

// The first-person view model: one box-built gun per weapon kind, attached to the
// camera. Original shapes, no copied models.
export function buildViewModel(weaponId) {
  const def = WEAPONS[weaponId];
  const dark = new THREE.MeshStandardMaterial({ color: 0x3d4048, roughness: 0.5, metalness: 0.45 });
  const mid = new THREE.MeshStandardMaterial({ color: 0x767b88, roughness: 0.45, metalness: 0.4 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.8, metalness: 0.05 });
  const group = new THREE.Group();
  const add = (w, h, d, x, y, z, mat) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  if (def.kind === 'pistol') {
    add(0.05, 0.07, 0.24, 0, 0, -0.1, dark);
    add(0.045, 0.1, 0.07, 0, -0.08, 0.02, gripMat);
    add(0.02, 0.02, 0.06, 0, 0.045, -0.2, mid);
  } else if (def.kind === 'smg') {
    add(0.07, 0.09, 0.34, 0, 0, -0.12, dark);
    add(0.04, 0.04, 0.22, 0, 0.02, -0.38, mid);
    add(0.05, 0.12, 0.06, 0, -0.1, -0.02, gripMat);
    add(0.05, 0.14, 0.05, 0, -0.11, -0.2, dark);
  } else if (def.kind === 'shotgun') {
    add(0.08, 0.09, 0.4, 0, 0, -0.12, dark);
    add(0.06, 0.06, 0.36, 0, -0.03, -0.14, mid);
    add(0.06, 0.09, 0.18, 0, -0.02, 0.14, gripMat);
    add(0.03, 0.03, 0.3, 0, 0.06, -0.24, mid);
  } else if (def.kind === 'sniper') {
    add(0.07, 0.08, 0.5, 0, 0, -0.16, dark);
    add(0.04, 0.04, 0.5, 0, 0.02, -0.4, mid);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 10), mid);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.07, -0.1);
    group.add(scope);
    add(0.06, 0.1, 0.2, 0, -0.03, 0.16, gripMat);
  } else {
    // Rifle.
    add(0.08, 0.1, 0.46, 0, 0, -0.14, dark);
    add(0.045, 0.045, 0.42, 0, 0.025, -0.4, mid);
    add(0.05, 0.05, 0.12, 0, 0.075, -0.18, dark);
    add(0.06, 0.11, 0.08, 0, -0.1, 0.0, gripMat);
    add(0.07, 0.08, 0.2, 0, -0.02, 0.26, gripMat);
  }
  group.position.set(0.24, -0.2, -0.42);
  return group;
}
