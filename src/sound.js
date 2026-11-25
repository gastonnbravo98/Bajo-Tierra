// Sintetizador procedural de efectos y música de fondo con Web Audio API
const STORAGE_KEY = 'bajotierra_audio_v1';

let ctx = null;
let sfxGain = null;
let musicGain = null;
let noiseBuf = null;
let jetpackNodes = null;
let musicTimer = null;
let musicStep = 0;
let musicPlaying = false;
let deepMode = false;

// Estado persistente
let volume = 0.8;
let sfxMuted = false;
let musicMuted = false;

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved) {
    if (typeof saved.volume === 'number') volume = Math.max(0, Math.min(1, saved.volume));
    if (typeof saved.sfxMuted === 'boolean') sfxMuted = saved.sfxMuted;
    if (typeof saved.musicMuted === 'boolean') musicMuted = saved.musicMuted;
  }
} catch {}

function savePrefs() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ volume, sfxMuted, musicMuted }));
  } catch {}
}

function updateGains() {
  if (!ctx || !sfxGain || !musicGain) return;
  const now = ctx.currentTime;
  sfxGain.gain.setTargetAtTime(sfxMuted ? 0 : volume, now, 0.015);
  musicGain.gain.setTargetAtTime(musicMuted ? 0 : volume * 0.42, now, 0.03);
}

function ensureCtx() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
    sfxGain = ctx.createGain();
    musicGain = ctx.createGain();
    sfxGain.connect(ctx.destination);
    musicGain.connect(ctx.destination);
    updateGains();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function getNoiseBuffer(ac) {
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function tone(ac, dest, { type = 'sine', f0 = 440, f1 = f0, dur = 0.1, gain = 0.15, delay = 0 }) {
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);

  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.connect(g);
  g.connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.01);
}

// ---------- Música normal (superficie y capas medias) ----------
const MELODY = [
  293.66, 0, 349.23, 440.00,  392.00, 0, 349.23, 329.63,
  293.66, 0, 261.63, 293.66,  220.00, 0, 0,      0,
  349.23, 0, 440.00, 523.25,  493.88, 0, 440.00, 392.00,
  349.23, 0, 329.63, 261.63,  293.66, 0, 0,      0,
];
const BASS = [
  146.83, 0, 0, 146.83,  110.00, 0, 0, 110.00,
  116.54, 0, 0, 116.54,  110.00, 0, 130.81, 0,
  174.61, 0, 0, 174.61,  130.81, 0, 0, 130.81,
  116.54, 0, 130.81, 0,  146.83, 0, 0, 0,
];

// ---------- Música tenebrosa (profundidad >= 85m o bioma volcánico) ----------
const DEEP_MELODY = [
  146.83, 0, 0, 155.56,  0, 0, 138.59, 0,
  110.00, 0, 0, 0,       116.54, 0, 110.00, 0,
  146.83, 0, 174.61, 0,  155.56, 0, 0, 138.59,
  110.00, 0, 103.83, 0,  73.42,  0, 0, 0,
];
const DEEP_BASS = [
  73.42, 0, 0, 0,  73.42, 0, 77.78, 0,
  55.00, 0, 0, 0,  58.27, 0, 55.00, 0,
  73.42, 0, 0, 0,  69.30, 0, 0,     0,
  55.00, 0, 51.91, 0, 36.71, 0, 0,  0,
];

function playMusicStep() {
  if (!musicPlaying || musicMuted || volume <= 0) return;
  const ac = ensureCtx();
  if (!ac || ac.state !== 'running') return;

  if (deepMode) {
    const idx = musicStep % DEEP_MELODY.length;
    const note = DEEP_MELODY[idx];
    const bass = DEEP_BASS[idx];

    // Dron grave constante cada 8 tiempos
    if (idx % 8 === 0) {
      tone(ac, musicGain, { type: 'sawtooth', f0: 55.0, f1: 53.5, dur: 2.2, gain: 0.045 });
    }
    if (note > 0) {
      // Nota principal grave con leve caída de afinación inquietante
      tone(ac, musicGain, { type: 'sine', f0: note, f1: note * 0.985, dur: 0.85, gain: 0.14 });
      // Eco agudo disonante esporádico
      if (idx % 6 === 3) {
        tone(ac, musicGain, { type: 'triangle', f0: note * 2.98, f1: note * 2.92, dur: 0.7, gain: 0.03, delay: 0.08 });
      }
    }
    if (bass > 0) {
      tone(ac, musicGain, { type: 'triangle', f0: bass, dur: 0.9, gain: 0.22 });
    }
  } else {
    const idx = musicStep % MELODY.length;
    const note = MELODY[idx];
    const bass = BASS[idx];

    if (note > 0) {
      tone(ac, musicGain, { type: 'triangle', f0: note, dur: 0.42, gain: 0.14 });
      if (idx % 4 === 0) {
        tone(ac, musicGain, { type: 'sine', f0: note * 2, dur: 0.55, gain: 0.045, delay: 0.02 });
      }
    }
    if (bass > 0) {
      tone(ac, musicGain, { type: 'sine', f0: bass, dur: 0.5, gain: 0.18 });
    }
  }
  musicStep++;
}

function restartMusicTimer() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = setInterval(playMusicStep, deepMode ? 350 : 260);
}

export const sound = {
  get volume() { return volume; },
  get sfxMuted() { return sfxMuted; },
  get musicMuted() { return musicMuted; },

  setVolume(val) {
    volume = Math.max(0, Math.min(1, val));
    updateGains();
    savePrefs();
  },

  toggleSfx() {
    sfxMuted = !sfxMuted;
    if (sfxMuted) this.stopJetpack();
    updateGains();
    savePrefs();
    return sfxMuted;
  },

  toggleMusic() {
    musicMuted = !musicMuted;
    updateGains();
    savePrefs();
    return musicMuted;
  },

  setDeepMode(isDeep) {
    const next = Boolean(isDeep);
    if (deepMode === next) return;
    deepMode = next;
    if (musicPlaying) restartMusicTimer();
  },

  startMusic() {
    musicPlaying = true;
    if (musicTimer) return;
    musicStep = 0;
    restartMusicTimer();
  },

  stopMusic() {
    musicPlaying = false;
    deepMode = false;
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  },

  // Chasquido de detector de gas cercano (intensity: 0.1 a 1)
  gasClick(intensity = 0.5) {
    if (sfxMuted) return;
    const ac = ensureCtx();
    if (!ac) return;
    const g = 0.04 + intensity * 0.09;
    const pitch = 1400 + intensity * 650 + (Math.random() - 0.5) * 180;
    tone(ac, sfxGain, { type: 'square', f0: pitch, f1: pitch * 0.45, dur: 0.022, gain: g });
  },

  // Burbujeo grave de lava cercana (intensity: 0.1 a 1)
  lavaBubble(intensity = 0.5) {
    if (sfxMuted) return;
    const ac = ensureCtx();
    if (!ac) return;
    const g = 0.05 + intensity * 0.11;
    const base = 58 + Math.random() * 22;
    tone(ac, sfxGain, { type: 'sine', f0: base, f1: base * 2.1, dur: 0.14, gain: g });
    tone(ac, sfxGain, { type: 'triangle', f0: base * 1.8, f1: base * 0.8, dur: 0.11, gain: g * 0.6, delay: 0.09 });
  },

  dig(hardness = 1, hasOre = false) {
    if (sfxMuted) return;
    const ac = ensureCtx();
    if (!ac) return;
    const base = 110 + hardness * 35 + (Math.random() - 0.5) * 20;
    tone(ac, sfxGain, { type: 'triangle', f0: base, f1: 45, dur: 0.065, gain: 0.16 });
    if (hasOre) {
      const pitch = 880 + Math.random() * 220;
      tone(ac, sfxGain, { type: 'sine', f0: pitch, f1: pitch * 1.25, dur: 0.12, gain: 0.12, delay: 0.015 });
    }
  },

  blocked() {
    if (sfxMuted) return;
    const ac = ensureCtx();
    if (!ac) return;
    tone(ac, sfxGain, { type: 'square', f0: 260, f1: 190, dur: 0.055, gain: 0.08 });
  },

  bombPlace() {
    if (sfxMuted) return;
    const ac = ensureCtx();
    if (!ac) return;
    tone(ac, sfxGain, { type: 'sine', f0: 520, f1: 380, dur: 0.07, gain: 0.12 });
  },

  explosion() {
    if (sfxMuted) return;
    const ac = ensureCtx();
    if (!ac) return;
    const t = ac.currentTime;
    const dur = 0.65;

    const src = ac.createBufferSource();
    src.buffer = getNoiseBuffer(ac);

    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(90, t + dur);

    const g = ac.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(sfxGain);
    src.start(t);
    src.stop(t + dur);

    tone(ac, sfxGain, { type: 'sine', f0: 110, f1: 28, dur: 0.45, gain: 0.3 });
  },

  laser() {
    if (sfxMuted) return;
    const ac = ensureCtx();
    if (!ac) return;
    tone(ac, sfxGain, { type: 'sawtooth', f0: 1250, f1: 180, dur: 0.18, gain: 0.14 });
    tone(ac, sfxGain, { type: 'sine', f0: 900, f1: 120, dur: 0.16, gain: 0.12 });
  },

  deposit() {
    if (sfxMuted) return;
    const ac = ensureCtx();
    if (!ac) return;
    tone(ac, sfxGain, { type: 'sine', f0: 440, f1: 660, dur: 0.09, gain: 0.1 });
  },

  coin() {
    if (sfxMuted) return;
    const ac = ensureCtx();
    if (!ac) return;
    tone(ac, sfxGain, { type: 'triangle', f0: 987, dur: 0.07, gain: 0.13, delay: 0 });
    tone(ac, sfxGain, { type: 'triangle', f0: 1318, dur: 0.14, gain: 0.13, delay: 0.065 });
  },

  noFuel() {
    if (sfxMuted) return;
    const ac = ensureCtx();
    if (!ac) return;
    tone(ac, sfxGain, { type: 'square', f0: 220, f1: 180, dur: 0.08, gain: 0.08, delay: 0 });
    tone(ac, sfxGain, { type: 'square', f0: 180, f1: 140, dur: 0.1, gain: 0.08, delay: 0.1 });
  },

  goal() {
    if (sfxMuted) return;
    const ac = ensureCtx();
    if (!ac) return;
    [523, 659, 784, 1046].forEach((f, i) => {
      tone(ac, sfxGain, { type: 'triangle', f0: f, dur: 0.18, gain: 0.15, delay: i * 0.09 });
    });
  },

  setJetpack(active) {
    if (!active || sfxMuted) {
      this.stopJetpack();
      return;
    }
    if (jetpackNodes) return;
    const ac = ensureCtx();
    if (!ac) return;

    const src = ac.createBufferSource();
    src.buffer = getNoiseBuffer(ac);
    src.loop = true;

    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 320;
    filter.Q.value = 1.4;

    const g = ac.createGain();
    g.gain.setValueAtTime(0.001, ac.currentTime);
    g.gain.linearRampToValueAtTime(0.09, ac.currentTime + 0.05);

    src.connect(filter);
    filter.connect(g);
    g.connect(sfxGain);
    src.start();

    jetpackNodes = { src, g, ac };
  },

  stopJetpack() {
    if (!jetpackNodes) return;
    const { src, g, ac } = jetpackNodes;
    jetpackNodes = null;
    try {
      g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.02);
      src.stop(ac.currentTime + 0.08);
    } catch {}
  },
};