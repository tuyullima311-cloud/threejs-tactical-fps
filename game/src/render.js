// The renderer: three.js scene, lights, map meshes, fighter figures, tracers,
// the first-person view model and the DOM HUD. It only mirrors the simulation —
// it never decides a hit, a round or a score.
import * as THREE from 'three';
import { PALETTE, WEAPONS } from './config.js';
import { BOXES, MAP } from './map.js';
import { buildFighterMesh, syncFighterMesh } from './fighter.js';
import { buildViewModel } from './weapons.js';

const tmpVec = new THREE.Vector3();

function materialFor(name) {
  const colors = {
    ground: 0x33373f, wall: 0x3a3f48, container: 0x8a4a2b, containerB: 0x4a6b7a,
    crate: 0x6b5a3e, pillar: 0x555c66, accent: 0xf0a830,
  };
  return new THREE.MeshStandardMaterial({
    color: colors[name] ?? 0x555c66, roughness: 0.9, metalness: 0.05,
  });
}

function letterTexture(letter, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = color;
  ctx.font = 'bold 190px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 128, 138);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

export function createRenderer(game) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('game').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x272b34);
  scene.fog = new THREE.Fog(0x272b34, 26, 78);
  const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 160);
  scene.add(camera);

  // Lights: a low amber dusk sun, a cool sky fill, and warm lamps over each site.
  const sky = new THREE.HemisphereLight(0x8fa3c0, 0x2a2118, 1.15);
  scene.add(sky);
  const sun = new THREE.DirectionalLight(0xffc27a, 2.8);
  sun.position.set(18, 26, 20);
  sun.target.position.set(0, 0, -2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0x6f86a8, 0.5);
  fill.position.set(-14, 12, -16);
  scene.add(fill);

  // The map, box by box from the shared map data.
  const materials = {};
  const mapGroup = new THREE.Group();
  scene.add(mapGroup);
  const shootables = [];
  for (const box of BOXES) {
    if (!materials[box.mat]) materials[box.mat] = materialFor(box.mat);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(box.w, box.h, box.d), materials[box.mat]);
    mesh.position.set(box.x, box.y, box.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mapGroup.add(mesh);
    shootables.push(mesh);
  }
  // The silo reads as a cylinder; its collider is the square box at the same spot.
  const silo = new THREE.Mesh(
    new THREE.CylinderGeometry(1.55, 1.7, 5, 18),
    new THREE.MeshStandardMaterial({ color: 0x707a72, roughness: 0.55, metalness: 0.5 }),
  );
  silo.position.set(0, 2.5, 2);
  silo.castShadow = true;
  silo.receiveShadow = true;
  mapGroup.add(silo);
  // Distant skyline silhouettes beyond the walls, so the yard is not a void.
  const skylineMat = new THREE.MeshStandardMaterial({ color: 0x1e222b, roughness: 1 });
  const skyline = [
    [10, 14, 8, -34, 7, -30], [8, 20, 8, -12, 10, -34], [12, 10, 8, 14, 5, -32],
    [8, 16, 8, 32, 8, -26], [10, 11, 8, -36, 5.5, 10], [9, 18, 8, 34, 9, 12],
    [12, 9, 8, 0, 4.5, 34], [8, 13, 8, -20, 6.5, 32],
  ];
  for (const [w, h, d, x, y, z] of skyline) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), skylineMat);
    mesh.position.set(x, y, z);
    mapGroup.add(mesh);
  }
  // Site markers: a tinted ground pad and a big ground letter.
  for (const key of ['A', 'B']) {
    const site = MAP.sites[key];
    const cx = (site.x0 + site.x1) / 2;
    const cz = (site.z0 + site.z1) / 2;
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(site.x1 - site.x0, site.z1 - site.z0),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(site.color), transparent: true, opacity: 0.16, depthWrite: false }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(cx, 0.03, cz);
    mapGroup.add(pad);
    const letter = new THREE.Mesh(
      new THREE.PlaneGeometry(4.5, 4.5),
      new THREE.MeshBasicMaterial({ map: letterTexture(key, site.color), transparent: true, opacity: 0.85, depthWrite: false }),
    );
    letter.rotation.x = -Math.PI / 2;
    letter.position.set(cx, 0.05, cz);
    mapGroup.add(letter);
    const lamp = new THREE.PointLight(new THREE.Color(site.color), 12, 16);
    lamp.position.set(cx, 4.2, cz);
    scene.add(lamp);
  }

  // Fighters.
  for (const fighter of game.fighters) {
    const mesh = buildFighterMesh(fighter);
    scene.add(mesh);
  }
  // The player's own figure is hidden: the view model is the gun, not a body.
  game.player.mesh.visible = false;

  // The charge: a small blinking device, shown when planted or dropped.
  const bombGroup = new THREE.Group();
  const bombBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.3, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.5, metalness: 0.4 }),
  );
  bombBody.castShadow = true;
  const bombLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xff2a1e }),
  );
  bombLight.position.set(0, 0.22, 0);
  bombGroup.add(bombBody, bombLight);
  bombGroup.visible = false;
  scene.add(bombGroup);

  // Grenades in flight.
  const grenadeMeshes = [];
  for (let i = 0; i < 4; i += 1) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.4, metalness: 0.6 }),
    );
    mesh.visible = false;
    scene.add(mesh);
    grenadeMeshes.push(mesh);
  }

  // Tracers: a pool of lines, reused so the hot path allocates nothing.
  const tracerPool = [];
  for (let i = 0; i < 32; i += 1) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.9 }));
    line.visible = false;
    line.frustumCulled = false;
    scene.add(line);
    tracerPool.push(line);
  }

  // Explosion flash: one expanding shell + one light, reused.
  const blastMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xff8833, transparent: true, opacity: 0, depthWrite: false }),
  );
  blastMesh.visible = false;
  scene.add(blastMesh);
  const blastLight = new THREE.PointLight(0xff8833, 0, 22);
  scene.add(blastLight);
  let blastAge = 99;
  let blastX = 0;
  let blastY = 1;
  let blastZ = 0;

  // First-person view model + muzzle flash.
  let viewModel = null;
  let viewModelWeapon = null;
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.26),
    new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.17, -0.95);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(0xffc27a, 0, 6);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);
  // A small warm fill so the view model reads instead of going black.
  const gunLight = new THREE.PointLight(0xfff2dd, 2.2, 2.5);
  gunLight.position.set(0.3, 0.15, -0.3);
  camera.add(gunLight);

  function swapViewModel(weaponId) {
    if (viewModel) camera.remove(viewModel);
    viewModel = buildViewModel(weaponId);
    viewModelWeapon = weaponId;
    camera.add(viewModel);
  }
  swapViewModel(game.player.weaponId);

  // ---- HUD (DOM) ----
  const el = (id) => document.getElementById(id);
  const hud = {
    healthFill: el('health-fill'), healthNum: el('health-num'), armorNum: el('armor-num'),
    ammoMag: el('ammo-mag'), ammoReserve: el('ammo-reserve'), weaponName: el('weapon-name'),
    money: el('money'), timer: el('timer'), scoreAzure: el('score-azure'), scoreRust: el('score-rust'),
    aliveAzure: el('alive-azure'), aliveRust: el('alive-rust'), killfeed: el('killfeed'),
    bombStatus: el('bomb-status'), channelWrap: el('channel-wrap'), channelFill: el('channel-fill'),
    channelLabel: el('channel-label'), banner: el('banner'), bannerTitle: el('banner-title'),
    bannerSub: el('banner-sub'), buyMenu: el('buy-menu'), overlay: el('overlay'),
    overlayTitle: el('overlay-title'), overlayCopy: el('overlay-copy'), playBtn: el('play'),
    crosshair: el('crosshair'), hitmarker: el('hitmarker'), vignette: el('damage-vignette'),
    carry: el('carry-indicator'), roundLabel: el('round-label'), grenades: el('grenades'),
  };
  const cache = {};
  function setText(node, key, value) {
    if (cache[key] !== value) {
      cache[key] = value;
      node.textContent = value;
    }
  }
  let feedRendered = -1;

  function updateHud() {
    const p = game.player;
    const w = p.weapon;
    setText(hud.healthNum, 'hp', `${Math.ceil(p.hp)}`);
    hud.healthFill.style.width = `${Math.max(0, p.hp)}%`;
    hud.healthFill.style.background = p.hp > 50 ? '#7fc76a' : p.hp > 25 ? '#f0a830' : '#e0523d';
    setText(hud.armorNum, 'armor', `${Math.ceil(p.armor)}`);
    setText(hud.ammoMag, 'mag', `${w.mag}`);
    setText(hud.ammoReserve, 'reserve', `/ ${w.reserve}`);
    setText(hud.weaponName, 'wname', WEAPONS[p.weaponId].name);
    setText(hud.money, 'money', `$${p.money}`);
    setText(hud.grenades, 'nades', `◉ × ${p.grenades}`);
    const t = Math.max(0, Math.ceil(game.timer));
    setText(hud.timer, 'timer', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
    setText(hud.scoreAzure, 'sa', `${game.score.azure}`);
    setText(hud.scoreRust, 'sr', `${game.score.rust}`);
    setText(hud.aliveAzure, 'aa', `${game.aliveCount('azure')}`);
    setText(hud.aliveRust, 'ar', `${game.aliveCount('rust')}`);
    setText(hud.roundLabel, 'round', `ROUND ${Math.max(1, game.round)} / ${9}`);
    // Bomb status line (hidden once the round is decided).
    let bombText = '';
    if (game.phase === 'roundEnd' || game.phase === 'matchEnd') bombText = '';
    else if (game.bomb.state === 'planted') bombText = `◉ CHARGE PLANTED ${game.bomb.site} — ${Math.max(0, game.bomb.timer).toFixed(0)}s`;
    else if (game.bomb.state === 'carried' && game.bomb.carrier === p) bombText = 'YOU CARRY THE CHARGE — plant at A or B (hold E)';
    else if (game.bomb.state === 'dropped') bombText = 'CHARGE DROPPED — pick it up';
    else if (game.bomb.state === 'carried') bombText = `${game.bomb.carrier ? game.bomb.carrier.name : ''} carries the charge`;
    setText(hud.bombStatus, 'bomb', bombText);
    // Channel progress.
    if (p.channelKind && p.channel >= 0) {
      hud.channelWrap.style.display = 'block';
      hud.channelFill.style.width = `${Math.min(100, p.channel * 100)}%`;
      setText(hud.channelLabel, 'chan', p.channelKind === 'plant' ? 'PLANTING…' : 'DEFUSING…');
    } else {
      hud.channelWrap.style.display = 'none';
    }
    // Carry indicator (hidden once the round is decided).
    hud.carry.style.display = (game.phase === 'roundEnd' || game.phase === 'matchEnd') ? 'none'
      : game.bomb.state === 'carried' && game.bomb.carrier === p ? 'block' : 'none';
    // Killfeed: last five entries.
    if (game.feed.length !== feedRendered) {
      feedRendered = game.feed.length;
      const last = game.feed.slice(-5);
      hud.killfeed.innerHTML = last.map((e) => {
        const cls = e.team === 'azure' ? 'feed-azure' : 'feed-rust';
        return `<div class="${cls}">${e.text}</div>`;
      }).join('');
    }
    // Banner.
    if (game.banner && game.time < game.banner.until) {
      hud.banner.style.display = 'block';
      setText(hud.bannerTitle, 'bt', game.banner.title);
      setText(hud.bannerSub, 'bs', game.banner.sub);
    } else {
      hud.banner.style.display = 'none';
    }
    // Buy menu.
    hud.buyMenu.style.display = game.buyOpen ? 'block' : 'none';
    // Crosshair spread grows with the weapon's live spread.
    const spreadPx = 3 + game.player.weapon.bloom * 14;
    hud.crosshair.style.setProperty('--gap', `${spreadPx.toFixed(1)}px`);
    // Hitmarker and hurt vignette.
    hud.hitmarker.style.opacity = game.time < p.flashUntil ? '1' : '0';
    hud.vignette.style.opacity = p.hp < 35 && p.alive ? '0.55' : '0';
  }

  const COPY = {
    start: {
      title: 'RUSTYARD SIEGE',
      copy: 'A round-based tactical shooter. Plant the charge at A or B — or wipe out RUST. Five rounds take the match. WASD to move, mouse to aim, hold E to plant.',
      action: 'Click to play',
    },
    paused: {
      title: 'RUSTYARD SIEGE',
      copy: 'Paused. Click to resume.',
      action: 'Click to resume',
    },
    down: {
      title: 'You are down',
      copy: 'Your squad fights on.',
      action: 'Keep watching',
    },
    roundEnd: {
      title: 'Round over',
      copy: '',
      action: 'Keep playing',
    },
    matchEnd: {
      title: 'Match over',
      copy: '',
      action: 'Play again',
    },
  };

  const api = {
    renderer, scene, camera, dom: renderer.domElement,
    resize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    },
    showOverlay(kind, sub) {
      const copy = COPY[kind];
      hud.overlayTitle.textContent = copy.title;
      hud.overlayCopy.textContent = sub || copy.copy;
      hud.playBtn.textContent = copy.action;
      hud.overlay.hidden = false;
    },
    hideOverlay() {
      hud.overlay.hidden = true;
    },
    setBuyOpen(open) {
      game.buyOpen = open;
    },
    render() {
      const p = game.player;
      // Camera follows the player's eyes.
      camera.position.set(p.pos.x, p.pos.y + p.eye, p.pos.z);
      camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
      // View model: swap on weapon change, kick and bob with the weapon state.
      if (viewModelWeapon !== p.weaponId) swapViewModel(p.weaponId);
      const w = p.weapon;
      const speed = Math.hypot(p.vel.x, p.vel.z);
      const bob = Math.sin(game.time * 9) * 0.006 * Math.min(1, speed / 5);
      viewModel.position.set(0.24, -0.2 + bob - w.kick * 0.02, -0.42 + w.kick * 0.06);
      viewModel.rotation.x = w.kick * 0.16;
      if (w.reloadLeft > 0) viewModel.rotation.x = -0.5 * Math.min(1, w.reloadLeft);
      const flashed = game.time - (game.lastPlayerShot || -99) < 0.05;
      flash.visible = flashed;
      flash.rotation.z = game.time * 40;
      flashLight.intensity = flashed ? 14 : 0;
      // Fighters.
      for (const fighter of game.fighters) syncFighterMesh(fighter);
      game.player.mesh.visible = false;
      // Bomb.
      if (game.bomb.state === 'planted' || game.bomb.state === 'dropped') {
        bombGroup.visible = true;
        bombGroup.position.set(game.bomb.x, 0.16, game.bomb.z);
        const blink = game.bomb.state === 'planted' ? (Math.sin(game.time * 9) > 0 ? 1 : 0.15) : 1;
        bombLight.material.color.setRGB(1 * blink, 0.1, 0.1);
      } else {
        bombGroup.visible = false;
      }
      // Grenades.
      grenadeMeshes.forEach((mesh, i) => {
        const g = game.grenades[i];
        if (g) {
          mesh.visible = true;
          mesh.position.set(g.x, g.y, g.z);
        } else {
          mesh.visible = false;
        }
      });
      // Tracers.
      tracerPool.forEach((line, i) => {
        const t = game.tracers[i];
        if (t) {
          line.visible = true;
          const pos = line.geometry.attributes.position;
          pos.setXYZ(0, t.x1, t.y1, t.z1);
          pos.setXYZ(1, t.x2, t.y2, t.z2);
          pos.needsUpdate = true;
          line.material.color.set(t.color);
          line.material.opacity = Math.min(1, t.ttl / 0.07);
        } else {
          line.visible = false;
        }
      });
      // Explosion shell: a fresh blast tracer starts it, at the blast's own spot.
      for (const t of game.tracers) {
        if (t.blast) {
          blastAge = 0;
          blastX = t.x1; blastY = t.y1; blastZ = t.z1;
        }
      }
      if (blastAge < 0.6) {
        blastAge += 1 / 60;
        const r = 0.5 + blastAge * 14;
        blastMesh.visible = true;
        blastMesh.scale.setScalar(r);
        blastMesh.material.opacity = Math.max(0, 0.55 - blastAge);
        blastMesh.position.set(blastX, Math.max(0.6, blastY), blastZ);
        blastLight.position.set(blastX, Math.max(1, blastY), blastZ);
        blastLight.intensity = Math.max(0, 60 - blastAge * 100);
      } else {
        blastMesh.visible = false;
        blastLight.intensity = 0;
      }
      updateHud();
      renderer.render(scene, camera);
    },
  };
  return api;
}
