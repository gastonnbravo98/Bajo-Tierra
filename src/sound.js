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

// Buffer reutilizable de 1 segundo de ruido blanco (para explosiones y jetpack)
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

// Secuencia ambiental subterránea en Re menor (frecuencias en Hz, 0 = silencio)
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

function playMusicStep() {
  if (!musicPlaying || musicMuted || volume <= 0) return;
  const ac = ensureCtx();
  if (!ac || ac.state !== 'running') return;

  const idx = musicStep % MELODY.length;
  const note = MELODY[idx];
  const bass = BASS[idx];

  if (note > 0) {
    tone(ac, musicGain, { type: 'triangle', f0: note, dur: 0.42, gain: 0.14 });
    // Armónico suave tipo cristal en tiempos fuertes
    if (idx % 4 === 0) {
      tone(ac, musicGain, { type: 'sine', f0: note * 2, dur: 0.55, gain: 0.045, delay: 0.02 });
    }
  }
  if (bass > 0) {
    tone(ac, musicGain, { type: 'sine', f0: bass, dur: 0.5, gain: 0.18 });
  }
  musicStep++;
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

  startMusic() {
    musicPlaying = true;
    if (musicTimer) return;
    musicStep = 0;
    musicTimer = setInterval(playMusicStep, 260);
  },

  stopMusic() {
    musicPlaying = false;
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  },

  // Golpe de pico: tono según dureza + brillo metálico si hubo mineral
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

  // Rebote cuando el material es demasiado duro
  blocked() {
    if (sfxMuted) return;
    const ac = ensureCtx();
    if (!ac) return;
    tone(ac, sfxGain, { type: 'square', f0: 260, f1: 190, dur: 0.055, gain: 0.08 });
  },

  // Colocar dinamita
  bombPlace() {
    if (sfxMuted) return;
    const ac = ensureCtx();
    if (!ac) return;
    tone(ac, sfxGain, { type: 'sine', f0: 520, f1: 380, dur: 0.07, gain: 0.12 });
  },

  // Detonación de dinamita (ruido filtrado + impacto grave)
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

  // Disparo láser (tecla F)
  laser() {
    if (sfxMuted) return;
    const ac = ensureCtx();
    if (!ac) return;
    tone(ac, sfxGain, { type: 'sawtooth', f0: 1250, f1: 180, dur: 0.18, gain: 0.14 });
    tone(ac, sfxGain, { type: 'sine', f0: 900, f1: 120, dur: 0.16, gain: 0.12 });
  },

  // Depositar minerales al pasar por la cabaña
  deposit() {
    if (sfxMuted) return;
    const ac = ensureCtx();
    if (!ac) return;
    tone(ac, sfxGain, { type: 'sine', f0: 440, f1: 660, dur: 0.09, gain: 0.1 });
  },

  // Vender minerales o comprar mejoras
  coin() {
    if (sfxMuted) return;
    const ac = ensureCtx();
    if (!ac) return;
    tone(ac, sfxGain, { type: 'triangle', f0: 987, dur: 0.07, gain: 0.13, delay: 0 });
    tone(ac, sfxGain, { type: 'triangle', f0: 1318, dur: 0.14, gain: 0.13, delay: 0.065 });
  },

  // Alerta de tanque vacío
  noFuel() {
    if (sfxMuted) return;
    const ac = ensureCtx();
    if (!ac) return;
    tone(ac, sfxGain, { type: 'square', f0: 220, f1: 180, dur: 0.08, gain: 0.08, delay: 0 });
    tone(ac, sfxGain, { type: 'square', f0: 180, f1: 140, dur: 0.1, gain: 0.08, delay: 0.1 });
  },

  // Alcanzar la profundidad meta
  goal() {
    if (sfxMuted) return;
    const ac = ensureCtx();
    if (!ac) return;
    [523, 659, 784, 1046].forEach((f, i) => {
      tone(ac, sfxGain, { type: 'triangle', f0: f, dur: 0.18, gain: 0.15, delay: i * 0.09 });
    });
  },

  // Propulsión continua mientras vuela con el jetpack
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