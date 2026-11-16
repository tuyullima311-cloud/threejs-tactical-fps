// Boot and the one loop: a fixed 60 Hz simulation feeding a render at the
// display's rate. ?shot=start|play|plant|end with &seed=N sets up a deterministic
// frame for a capture, renders it twice, then freezes it and sets
// window.__shotReady. Everything else is the live game: pointer lock, buy menu,
// weapon switching, grenades, planting and pausing.
import { mulberry32 } from './rng.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createGame } from './simulation.js';
import { createRenderer } from './render.js';
import { setupShot } from './shots.js';
import { BUY_MENU } from './config.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '7', 10) || 7;
const random = mulberry32(seed);

const audio = createAudio();
const game = createGame(random, audio);
const view = createRenderer(game);
const input = createInput(view.dom, onLockChange);

let frozen = false;
let started = false;
let accumulator = 0;
let lastTime = performance.now();
let downShown = false;

view.showOverlay('start');

document.getElementById('play').addEventListener('click', () => {
  audio.unlock();
  if (shot) return;
  if (game.phase === 'menu') {
    game.startMatch();
    started = true;
  } else if (game.phase === 'matchEnd') {
    game.startMatch();
    started = true;
  }
  downShown = false;
  input.requestLock();
});

document.querySelectorAll('[data-buy]').forEach((row) => {
  row.addEventListener('click', () => game.buy(row.getAttribute('data-buy')));
});

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
    view.hideOverlay();
    game.buyOpen = false;
    audio.unlock();
  } else if (game.phase === 'live' || game.phase === 'freeze') {
    view.showOverlay('paused');
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (frozen) return;
  const pressed = input.takePressed();
  const look = input.takeLook();
  const player = game.player;

  // Mouse look.
  if (look.x || look.y) {
    player.yaw -= look.x * 0.0022;
    player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - look.y * 0.0022));
  }

  // Edge-triggered actions.
  if (pressed.has('KeyM')) audio.setMuted(!audio.muted);
  if (pressed.has('KeyB') && (game.phase === 'freeze' || game.buyOpen)) {
    game.buyOpen = !game.buyOpen;
    audio.click();
  }
  if (game.buyOpen && game.phase === 'freeze') {
    const buyKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];
    buyKeys.forEach((code, i) => {
      if (pressed.has(code) && BUY_MENU[i]) game.buy(BUY_MENU[i].id);
    });
  } else {
    if (pressed.has('Digit1')) game.switchWeapon(1);
    if (pressed.has('Digit2')) game.switchWeapon(2);
  }
  if (pressed.has('KeyG')) game.throwGrenade(player);
  if (pressed.has('KeyR')) player.reloadQueued = true;

  // Holding E plants or defuses.
  if (input.state.keys.has('KeyE') && game.phase === 'live') game.tryChannel(player);

  // Death: release the mouse and say so once.
  if (started && !player.alive && game.phase === 'live' && !downShown) {
    downShown = true;
    if (document.pointerLockElement) document.exitPointerLock();
    view.showOverlay('down', 'You are down — your squad fights on. Click to keep watching.');
  }
  // Match end: release the mouse and show the result once.
  if (game.phase === 'matchEnd' && started && !view.matchShown) {
    view.matchShown = true;
    if (document.pointerLockElement) document.exitPointerLock();
    const winner = game.matchWinner === 'azure' ? 'AZURE' : 'RUST';
    view.showOverlay('matchEnd', `${winner} takes the match ${game.score.azure}–${game.score.rust}. Click to play again.`);
  }

  const snapshot = {
    keys: input.state.keys,
    firing: input.state.firing && input.state.locked,
    reloadPressed: !!player.reloadQueued,
  };
  player.reloadQueued = false;
  accumulator += dt;
  let steps = 0;
  while (accumulator >= FIXED_STEP && steps < 5) {
    game.step(FIXED_STEP, snapshot);
    accumulator -= FIXED_STEP;
    steps += 1;
  }
  if (accumulator > FIXED_STEP * 5) accumulator = 0;
  view.render();
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    view.render();
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => view.resize());

if (shot) {
  view.hideOverlay();
  setupShot(game, shot);
  paintTwiceThenReady();
} else {
  requestAnimationFrame(frame);
}
