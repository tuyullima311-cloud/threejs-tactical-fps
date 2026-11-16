// All sound is synthesised live with WebAudio: no audio files, no network.
// One shared noise buffer, short envelopes, and a different recipe per event so a
// rifle crack, a pistol pop and a sniper boom are easy to tell apart.
export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let muted = false;
  let unlocked = false;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      const length = Math.floor(ctx.sampleRate * 0.5);
      noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function unlock() {
    const c = ensure();
    if (!c) return;
    unlocked = true;
    if (c.state === 'suspended') c.resume().catch(() => {});
  }

  function noise(when, duration, filterType, frequency, gainValue, q = 1) {
    if (!ctx || muted) return;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
    source.connect(filter).connect(gain).connect(master);
    source.start(when, Math.random() * 0.3);
    source.stop(when + duration + 0.02);
  }

  function tone(when, duration, type, fromFreq, toFreq, gainValue) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(fromFreq, when);
    if (toFreq !== fromFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, toFreq), when + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
    osc.connect(gain).connect(master);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  const api = {
    unlock,
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    get muted() { return muted; },
    get ready() { return unlocked && !!ctx; },

    shot(kind) {
      if (!ensure() || muted) return;
      const t = now();
      if (kind === 'sniper') {
        noise(t, 0.35, 'lowpass', 900, 0.9);
        tone(t, 0.22, 'sine', 140, 40, 0.7);
      } else if (kind === 'shotgun') {
        noise(t, 0.28, 'lowpass', 1400, 0.85);
        tone(t, 0.14, 'sine', 120, 45, 0.55);
      } else if (kind === 'pistol') {
        noise(t, 0.12, 'bandpass', 1800, 0.55, 1.4);
        tone(t, 0.07, 'square', 220, 90, 0.22);
      } else if (kind === 'smg') {
        noise(t, 0.09, 'bandpass', 2400, 0.45, 1.2);
      } else {
        noise(t, 0.14, 'lowpass', 2200, 0.7);
        tone(t, 0.1, 'sine', 160, 55, 0.5);
      }
    },
    distantShot() {
      if (!ensure() || muted) return;
      noise(now(), 0.1, 'lowpass', 700, 0.16);
    },
    dryFire() {
      if (!ensure() || muted) return;
      tone(now(), 0.05, 'square', 1200, 900, 0.12);
    },
    reload() {
      if (!ensure() || muted) return;
      const t = now();
      tone(t, 0.04, 'square', 900, 700, 0.14);
      tone(t + 0.35, 0.04, 'square', 1100, 800, 0.14);
      tone(t + 0.7, 0.05, 'square', 700, 500, 0.16);
    },
    hit(kill) {
      if (!ensure() || muted) return;
      const t = now();
      tone(t, 0.06, 'sine', kill ? 1500 : 1100, kill ? 1500 : 1100, 0.22);
      if (kill) tone(t + 0.07, 0.09, 'sine', 1900, 1900, 0.22);
    },
    hurt() {
      if (!ensure() || muted) return;
      tone(now(), 0.16, 'sawtooth', 180, 70, 0.2);
    },
    step() {
      if (!ensure() || muted) return;
      noise(now(), 0.05, 'lowpass', 500, 0.07);
    },
    plantBeep(final) {
      if (!ensure() || muted) return;
      tone(now(), final ? 0.3 : 0.09, 'sine', final ? 700 : 1250, final ? 700 : 1250, 0.25);
    },
    defuseBeep() {
      if (!ensure() || muted) return;
      tone(now(), 0.08, 'sine', 950, 950, 0.2);
    },
    explosion() {
      if (!ensure() || muted) return;
      const t = now();
      noise(t, 0.9, 'lowpass', 420, 1.0);
      tone(t, 0.7, 'sine', 90, 28, 0.9);
      noise(t + 0.05, 0.4, 'bandpass', 900, 0.4, 0.8);
    },
    grenadeBounce() {
      if (!ensure() || muted) return;
      tone(now(), 0.06, 'sine', 320, 180, 0.16);
    },
    roundWin() {
      if (!ensure() || muted) return;
      const t = now();
      [523, 659, 784].forEach((f, i) => tone(t + i * 0.12, 0.22, 'triangle', f, f, 0.25));
    },
    roundLose() {
      if (!ensure() || muted) return;
      const t = now();
      [392, 330, 262].forEach((f, i) => tone(t + i * 0.14, 0.26, 'triangle', f, f, 0.22));
    },
    buy() {
      if (!ensure() || muted) return;
      const t = now();
      tone(t, 0.07, 'sine', 880, 880, 0.2);
      tone(t + 0.08, 0.1, 'sine', 1320, 1320, 0.2);
    },
    denied() {
      if (!ensure() || muted) return;
      tone(now(), 0.12, 'square', 220, 180, 0.14);
    },
    click() {
      if (!ensure() || muted) return;
      tone(now(), 0.04, 'sine', 1400, 1400, 0.14);
    },
  };
  return api;
}
