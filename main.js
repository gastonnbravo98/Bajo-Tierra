import {
  CELL, DIG_RADIUS, DIG_REACH, DIG_DELAY, ORE_VALUE, ORE_NAME, SELL_RANGE, FUEL_MAX,
} from './src/config.js';
import { seedFromText } from './src/random.js';
import { generateWorld } from './src/worldgen.js';
import { createPlayerSprite, createShop } from './src/render.js';
import { createPlayer, updatePlayer } from './src/player.js';
import { updateCamera } from './src/camera.js';
import { createChunks } from './src/chunks.js';
import { dig, applyDelta } from './src/dig.js';
import { createMinimap } from './src/minimap.js';
import { input } from './src/input.js';

const menuEl = document.getElementById('menu');
const seedInput = document.getElementById('seed-input');
const playBtn = document.getElementById('play-btn');
const lastSeedEl = document.getElementById('last-seed');
const hudEl = document.getElementById('hud');

let app;
let currentGame = null;

// ---------- Una partida ----------
function startGame(seed) {
  const world = generateWorld(seed);
  const delta = new Map(); // chunk -> Set de celdas destruidas

  const worldLayer = new PIXI.Container();
  app.stage.addChild(worldLayer);

  const chunks = createChunks(world);
  worldLayer.addChild(chunks.container);

  const player = createPlayer(world);
  const startY = player.y + player.h;                             // altura de la superficie inicial
  const spawnCol = Math.floor((player.x + player.w / 2) / CELL);

  // la tienda queda en el punto de salida
  worldLayer.addChild(createShop(spawnCol, startY));
  const shopX = (spawnCol + 0.5) * CELL;
  const shopY = startY - CELL;

  // llama del jetpack (se ve solo mientras vuela)
  const flame = new PIXI.Graphics();
  flame.rect(0, 0, player.w * 0.5, CELL * 0.9).fill(0xff9f1c);
  flame.visible = false;
  worldLayer.addChild(flame);

  const playerSprite = createPlayerSprite(player);
  worldLayer.addChild(playerSprite);

  const cursor = new PIXI.Graphics();
  cursor.circle(0, 0, DIG_RADIUS * CELL).stroke({ width: 2, color: 0xffffff });
  worldLayer.addChild(cursor);

  const minimap = createMinimap(world);

  // mochila: una cuenta por cada tipo de mineral
  const cargo = {};
  for (const t of Object.keys(ORE_VALUE)) cargo[t] = 0;
  let money = 0;
  let msg = '';
  let msgTimer = 0;
  let digTimer = 0;
  let lastHud = '';

  // Tecla R: prueba de persistencia (seed + delta debe dar el mundo actual)
  function onKey(e) {
    if (e.code !== 'KeyR') return;
    const fresh = generateWorld(seed);
    applyDelta(fresh, delta);
    let diff = 0;
    for (let i = 0; i < fresh.length; i++) if (fresh[i] !== world[i]) diff++;
    console.log('Celdas distintas entre mundo actual y seed + delta:', diff);
    world.set(fresh);
    chunks.markAllDirty();
  }
  window.addEventListener('keydown', onKey);

  hudEl.style.display = 'block';

  const tick = (ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 1 / 30);

    updatePlayer(world, player, input, dt);
    playerSprite.position.set(player.x, player.y);
    flame.visible = player.flying;
    flame.position.set(player.x + player.w * 0.25, player.y + player.h);
    updateCamera(worldLayer, app.screen, player);

    // mouse en coordenadas del mundo
    const wx = input.mouseX - worldLayer.x;
    const wy = input.mouseY - worldLayer.y;
    const tcx = Math.floor(wx / CELL);
    const tcy = Math.floor(wy / CELL);
    const targetX = (tcx + 0.5) * CELL;
    const targetY = (tcy + 0.5) * CELL;

    const pcx = player.x + player.w / 2;
    const pcy = player.y + player.h / 2;
    const inReach = Math.hypot(targetX - pcx, targetY - pcy) <= DIG_REACH * CELL;

    cursor.position.set(targetX, targetY);
    cursor.alpha = inReach ? 0.9 : 0.25;

    // cavar y juntar minerales
    digTimer -= dt;
    if (input.mouseDown && inReach && digTimer <= 0) {
      const broken = dig(world, delta, chunks, tcx, tcy, DIG_RADIUS);
      for (const t in broken) if (t in cargo) cargo[t] += broken[t];
      digTimer = DIG_DELAY;
    }

    // en la tienda: vender todo y llenar el combustible
    if (Math.hypot(pcx - shopX, pcy - shopY) <= SELL_RANGE * CELL) {
      player.fuel = FUEL_MAX;
      let earned = 0;
      for (const t in cargo) { earned += cargo[t] * ORE_VALUE[t]; cargo[t] = 0; }
      if (earned > 0) {
        money += earned;
        msg = `¡Vendiste todo por $${earned}!`;
        msgTimer = 2.5;
      }
    }

    // redibujar chunks modificados y actualizar el minimapa
    for (const c of chunks.rebuildDirty()) minimap.redrawChunk(c);
    minimap.reveal(Math.floor(pcx / CELL), Math.floor(pcy / CELL));
    minimap.draw(player, -worldLayer.x, -worldLayer.y, app.screen.width, app.screen.height);

    // HUD (solo se toca el DOM si el texto cambió)
    msgTimer -= dt;
    if (msgTimer <= 0) msg = '';
    const depth = Math.max(0, Math.floor((player.y + player.h - startY) / CELL));
    const bag = Object.keys(cargo).map((t) => `${ORE_NAME[t]} ${cargo[t]}`).join(' · ');
    const bars = Math.round((player.fuel / FUEL_MAX) * 10);
    const fuelBar = '█'.repeat(bars) + '░'.repeat(10 - bars);
    const hud = `Seed: ${seed}\nProfundidad: ${depth} m\nDinero: $${money}\nMochila: ${bag}\nCombustible: ${fuelBar}\n${msg}`.trimEnd();
    if (hud !== lastHud) { hudEl.textContent = hud; lastHud = hud; }
  };
  app.ticker.add(tick);

  return {
    seed,
    stop() {
      app.ticker.remove(tick);
      window.removeEventListener('keydown', onKey);
      app.stage.removeChild(worldLayer);
      worldLayer.destroy({ children: true });
      minimap.destroy();
      hudEl.style.display = 'none';
    },
  };
}

// ---------- Menú ----------
function play() {
  if (currentGame) return;
  const seed = seedFromText(seedInput.value);
  seedInput.blur();
  menuEl.style.display = 'none';
  currentGame = startGame(seed);
}

function backToMenu() {
  lastSeedEl.textContent = `Última seed: ${currentGame.seed}`;
  currentGame.stop();
  currentGame = null;
  menuEl.style.display = 'flex';
}

async function init() {
  app = new PIXI.Application();
  await app.init({ resizeTo: window, background: '#1a1a1a', antialias: false });
  document.getElementById('app').appendChild(app.canvas);

  playBtn.addEventListener('click', play);
  seedInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') play(); });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && currentGame) backToMenu();
  });
}

init();