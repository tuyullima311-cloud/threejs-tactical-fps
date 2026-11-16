// A fighter is one body on the field — the player or a bot. The state is plain
// numbers so the simulation can run it without three.js; the mesh is a separate
// box-built figure the renderer syncs from that state.
import * as THREE from 'three';
import { PALETTE } from './config.js';
import { createWeaponState } from './weapons.js';

export const STAND_HEIGHT = 1.72;
export const CROUCH_HEIGHT = 1.12;
export const STAND_EYE = 1.6;
export const CROUCH_EYE = 1.02;
export const RADIUS = 0.34;

export function createFighter(id, team, name, isPlayer) {
  return {
    id, team, name, isPlayer,
    pos: { x: 0, y: 0, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    yaw: 0, pitch: 0,
    hp: 100, armor: 0, alive: true,
    weaponId: 'rifle',
    weapon: createWeaponState('rifle'),
    grenades: 0,
    money: 800,
    kills: 0, deaths: 0,
    crouching: false,
    onGround: true,
    eye: STAND_EYE,
    height: STAND_HEIGHT,
    // Movement wish set each step by the player input or the bot controller.
    wishX: 0, wishZ: 0, wishJump: false,
    // Aim the fighter is actually pointing at (bots lag behind their target).
    aimYaw: 0, aimPitch: 0,
    // Channels: planting / defusing progress 0..1, or -1 when idle.
    channel: -1, channelKind: null,
    mesh: null, // filled by the renderer
    flashUntil: 0,
  };
}

export function resetFighter(fighter, spawn, weaponId) {
  fighter.pos.x = spawn.x;
  fighter.pos.y = 0;
  fighter.pos.z = spawn.z;
  fighter.vel.x = 0;
  fighter.vel.y = 0;
  fighter.vel.z = 0;
  fighter.yaw = spawn.yaw;
  fighter.pitch = 0;
  fighter.aimYaw = spawn.yaw;
  fighter.aimPitch = 0;
  fighter.hp = 100;
  fighter.alive = true;
  fighter.crouching = false;
  fighter.onGround = true;
  fighter.eye = STAND_EYE;
  fighter.height = STAND_HEIGHT;
  fighter.channel = -1;
  fighter.channelKind = null;
  fighter.wishX = 0;
  fighter.wishZ = 0;
  fighter.wishJump = false;
  equipWeapon(fighter, weaponId);
}

export function equipWeapon(fighter, weaponId) {
  fighter.weaponId = weaponId;
  fighter.weapon = createWeaponState(weaponId);
}

// Damage with armour absorbing half (classic tactical split), hp the rest.
export function applyDamage(fighter, damage) {
  if (!fighter.alive) return 0;
  let remaining = damage;
  if (fighter.armor > 0) {
    const absorbed = Math.min(fighter.armor, remaining * 0.5);
    fighter.armor -= absorbed;
    remaining -= absorbed;
  }
  fighter.hp -= remaining;
  if (fighter.hp <= 0) {
    fighter.hp = 0;
    fighter.alive = false;
    fighter.channel = -1;
    fighter.channelKind = null;
  }
  return remaining;
}

// Hit spheres for ray tests, in world space. Head first: a head hit pays more.
export function hitSpheres(fighter) {
  const crouch = fighter.crouching ? 0.62 : 1;
  const eyeY = fighter.pos.y + fighter.eye;
  return [
    { part: 'head', x: fighter.pos.x, y: eyeY - 0.08, z: fighter.pos.z, r: 0.24 },
    { part: 'body', x: fighter.pos.x, y: fighter.pos.y + 1.12 * crouch, z: fighter.pos.z, r: 0.42 },
    { part: 'body', x: fighter.pos.x, y: fighter.pos.y + 0.62 * crouch, z: fighter.pos.z, r: 0.38 },
  ];
}

// A box-built humanoid: torso and visor in the team colour, dark limbs, a gun in
// its hands. Original art, drawn from boxes — no copied model.
export function buildFighterMesh(fighter) {
  const teamColor = fighter.team === 'azure' ? PALETTE.azure : PALETTE.rust;
  const torsoMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(teamColor), roughness: 0.75, metalness: 0.1 });
  const darkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x24262c), roughness: 0.85, metalness: 0.05 });
  const skinMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x8a6b4f), roughness: 0.8, metalness: 0 });
  const visorMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(teamColor), roughness: 0.3, metalness: 0.2,
    emissive: new THREE.Color(teamColor), emissiveIntensity: 0.55,
  });
  const group = new THREE.Group();
  const add = (w, h, d, x, y, z, mat) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  add(0.5, 0.62, 0.3, 0, 1.12, 0, torsoMat); // torso
  add(0.56, 0.1, 0.34, 0, 1.44, 0, darkMat); // shoulders
  add(0.3, 0.32, 0.3, 0, 1.62, 0, skinMat); // head
  add(0.32, 0.09, 0.05, 0, 1.64, -0.16, visorMat); // visor (faces -z of the group)
  add(0.16, 0.78, 0.2, -0.14, 0.39, 0, darkMat); // left leg
  add(0.16, 0.78, 0.2, 0.14, 0.39, 0, darkMat); // right leg
  add(0.12, 0.12, 0.62, 0.1, 1.18, -0.28, darkMat); // arms + gun, forward
  add(0.09, 0.14, 0.5, 0.16, 1.22, -0.42, torsoMat); // carried rifle
  group.traverse((child) => {
    child.castShadow = true;
  });
  fighter.mesh = group;
  return group;
}

// Copy the simulation state onto the mesh: position, facing, crouch, death pose.
export function syncFighterMesh(fighter) {
  const group = fighter.mesh;
  if (!group) return;
  group.position.set(fighter.pos.x, fighter.pos.y, fighter.pos.z);
  if (!fighter.alive) {
    group.rotation.set(-Math.PI / 2, fighter.yaw, 0);
    group.position.y = 0.25;
    return;
  }
  group.rotation.set(0, fighter.yaw, 0);
  const scaleY = fighter.crouching ? 0.72 : 1;
  group.scale.set(1, scaleY, 1);
}
