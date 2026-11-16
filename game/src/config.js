// Rustyard Siege — every tuning number in one place: the palette, the weapons,
// the economy and the round rules. Nothing here touches the DOM or three.js, so the
// simulation can read it without dragging the renderer along.
// Palette: a dusk industrial yard — warm amber against slate blue-grey.
export const PALETTE = {
  canvas: '#23262e',
  surface: '#2e323c',
  hairline: '#3d434f',
  ink: '#ece7db',
  muted: '#9aa3ad',
  accent: '#f0a830',
  azure: '#4aa3ff',
  rust: '#ff6a3d',
  siteA: '#ffb02e',
  siteB: '#3ec6a7',
  ground: '#33373f',
  container: '#8a4a2b',
  containerB: '#4a6b7a',
  crate: '#6b5a3e',
  pillar: '#555c66',
  wall: '#3a3f48',
};

export const ROUND_TIME = 100; // seconds of live play per round
export const FREEZE_TIME = 6; // seconds to buy before the round starts
export const PLANT_TIME = 3.5; // seconds holding the plant channel
export const DEFUSE_TIME = 5; // seconds holding the defuse channel
export const BOMB_TIME = 35; // seconds from plant to detonation
export const WIN_ROUNDS = 5; // first team to this many round wins takes the match
export const MAX_ROUNDS = 9;

export const ECONOMY = {
  startMoney: 800,
  killReward: 300,
  plantReward: 300,
  winReward: 3250,
  lossReward: 1900,
  maxMoney: 16000,
};

// Weapons: original names, one job each. damage is the body-shot damage at close
// range; falloff trims it past falloffStart metres. headMult multiplies on a head hit.
export const WEAPONS = {
  sidearm: {
    id: 'sidearm', name: 'P-9 Lark', kind: 'pistol', price: 0,
    damage: 34, headMult: 2.5, fireGap: 0.16, auto: false, mag: 12, reserve: 48,
    reloadTime: 1.4, spreadStill: 0.0035, spreadMove: 0.02, kick: 0.011,
    range: 40, falloffStart: 18, falloffMin: 0.6, tracer: '#ffd27a',
  },
  smg: {
    id: 'smg', name: 'VK-9 Wasp', kind: 'smg', price: 1500,
    damage: 26, headMult: 2.5, fireGap: 0.075, auto: true, mag: 32, reserve: 96,
    reloadTime: 1.9, spreadStill: 0.006, spreadMove: 0.03, kick: 0.008,
    range: 38, falloffStart: 14, falloffMin: 0.55, tracer: '#ffd27a',
  },
  rifle: {
    id: 'rifle', name: 'RK-7 Longarm', kind: 'rifle', price: 2700,
    damage: 33, headMult: 3, fireGap: 0.1, auto: true, mag: 30, reserve: 90,
    reloadTime: 2.1, spreadStill: 0.0022, spreadMove: 0.026, kick: 0.013,
    range: 60, falloffStart: 22, falloffMin: 0.7, tracer: '#ffe9b0',
  },
  shotgun: {
    id: 'shotgun', name: 'SG-12 Breacher', kind: 'shotgun', price: 1050,
    damage: 14, headMult: 2, fireGap: 0.85, auto: false, mag: 6, reserve: 24,
    reloadTime: 2.6, spreadStill: 0.02, spreadMove: 0.035, kick: 0.03,
    pellets: 8, range: 26, falloffStart: 8, falloffMin: 0.35, tracer: '#ffb066',
  },
  sniper: {
    id: 'sniper', name: 'LW-50 Horizon', kind: 'sniper', price: 4750,
    damage: 95, headMult: 4, fireGap: 1.25, auto: false, mag: 5, reserve: 15,
    reloadTime: 3.2, spreadStill: 0.0009, spreadMove: 0.05, kick: 0.05,
    range: 90, falloffStart: 40, falloffMin: 0.85, tracer: '#cfe6ff',
  },
};

export const GRENADE = {
  id: 'grenade', name: 'Spark Grenade', price: 300,
  radius: 6.5, maxDamage: 110, fuse: 2.4, throwSpeed: 17,
};

export const BUY_MENU = [
  { id: 'rifle', label: 'RK-7 Longarm — Rifle', price: 2700 },
  { id: 'smg', label: 'VK-9 Wasp — SMG', price: 1500 },
  { id: 'shotgun', label: 'SG-12 Breacher — Shotgun', price: 1050 },
  { id: 'sniper', label: 'LW-50 Horizon — Sniper', price: 4750 },
  { id: 'grenade', label: 'Spark Grenade', price: 300 },
  { id: 'armor', label: 'Plated Vest — 100 armour', price: 650 },
];

export const BOT_NAMES = {
  azure: ['Juno', 'Marlowe', 'Kestrel', 'Bram'],
  rust: ['Vex', 'Harrow', 'Dagger', 'Rook', 'Sable'],
};

export const TEAMS = {
  azure: { name: 'AZURE', color: PALETTE.azure, spawn: 'azure' },
  rust: { name: 'RUST', color: PALETTE.rust, spawn: 'rust' },
};
