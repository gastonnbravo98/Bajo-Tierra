import { seedFromText } from './src/random.js';
import { sound } from './src/sound.js';
import { startGame } from './src/game.js';

const menuEl = document.getElementById('menu');
const seedInput = document.getElementById('seed-input');
const sizeSelect = document.getElementById('size-select');
const difficultySelect = document.getElementById('difficulty-select');
const playBtn = document.getElementById('play-btn');
const lastSeedEl = document.getElementById('last-seed');
const randomSeedBtn = document.getElementById('random-seed-btn');

const dom = {
  hudEl: document.getElementById('hud'),
  debugEl: document.getElementById('debug'),
  shopEl: document.getElementById('shop'),
  bannerEl: document.getElementById('banner'),
  deathModalEl: document.getElementById('death-modal'),
  deathInfoEl: document.getElementById('death-info'),
  btnRespawn: document.getElementById('btn-respawn'),
  btnDeathRestart: document.getElementById('btn-death-restart'),
  btnDeathExit: document.getElementById('btn-death-exit'),
  pauseEls: {
    pauseEl: document.getElementById('pause-menu'),
    pauseInfoEl: document.getElementById('pause-info'),
    btnResume: document.getElementById('btn-resume'),
    volumeLabel: document.getElementById('volume-label'),
    volumeSlider: document.getElementById('volume-slider'),
    toggleMusicEl: document.getElementById('toggle-music'),
    boxMusicEl: document.getElementById('box-music'),
    toggleSfxEl: document.getElementById('toggle-sfx'),
    boxSfxEl: document.getElementById('box-sfx'),
    btnCopySeed: document.getElementById('btn-copy-seed'),
    btnToggleDebug: document.getElementById('btn-toggle-debug'),
    btnToggleSim: document.getElementById('btn-toggle-sim'),
    btnToggleMap: document.getElementById('btn-toggle-map'),
    btnRestart: document.getElementById('btn-restart'),
    btnExit: document.getElementById('btn-exit'),
  },
};

let app;
let currentGame = null;
let lastPlayedSeed = null;

function launchGame(seed, sizeKey, diffKey) {
  currentGame = startGame({
    app,
    dom,
    seed,
    sizeKey,
    diffKey,
    onRestart: restartGame,
    onExit: backToMenu,
  });
}

function play() {
  if (currentGame) return;
  const seed = seedFromText(seedInput.value);
  const sizeKey = sizeSelect.value || 'medium';
  const diffKey = difficultySelect?.value || 'normal';
  seedInput.blur();
  menuEl.style.display = 'none';
  sound.coin();
  launchGame(seed, sizeKey, diffKey);
}

function restartGame(seed, sizeKey, diffKey) {
  if (currentGame) {
    currentGame.stop();
    currentGame = null;
  }
  launchGame(seed, sizeKey, diffKey);
}

function backToMenu() {
  lastPlayedSeed = currentGame.seed;
  lastSeedEl.textContent = `Última seed: ${lastPlayedSeed} (click para reutilizar)`;
  currentGame.stop();
  currentGame = null;
  menuEl.style.display = 'flex';
}

async function init() {
  app = new PIXI.Application();
  await app.init({ resizeTo: window, background: '#78b9e8', antialias: false });
  document.getElementById('app').appendChild(app.canvas);

  randomSeedBtn.addEventListener('click', () => {
    seedInput.value = String(Math.floor(Math.random() * 900000000) + 100000000);
    sound.deposit();
  });
  lastSeedEl.addEventListener('click', () => {
    if (lastPlayedSeed !== null) seedInput.value = String(lastPlayedSeed);
  });

  playBtn.addEventListener('click', play);
  seedInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') play(); });
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || !currentGame) return;
    if (currentGame.closePanel()) return;
    currentGame.togglePause();
  });
}

init();
