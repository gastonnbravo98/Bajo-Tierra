import {
  CELL, COLS, ROWS, CHUNK, NAMES, HARDNESS, COLORS, ORE_VALUE, ORE_NAME,
  DIG_REACH, DIG_DELAY, SELL_RANGE, DYNAMITE, LASER, CRYSTAL, CRYSTAL_FUEL, SIM_HZ,
  SIZES, BIOME_NAMES, SHAPE_NAMES, setWorldSize, setDifficulty, goalDepth,
  IS_INFINITE, IS_HARD, PLATFORM, AIR, LAVA, GAS, VOLCANICO, HP_REGEN_BASE,
} from './src/config.js';
import { seedFromText } from './src/random.js';
import { generateWorld, generateBiomes, createInfiniteWorld } from './src/worldgen.js';
import {
  createPlayerSprite, updatePlayerSprite, createShop, createOutpost, createBackground,
  createBomb, createGoalLine, createFloatingTexts, createEffects, createFogOfWar,
} from './src/render.js';
import { createPlayer, updatePlayer } from './src/player.js';
import { updateCamera } from './src/camera.js';
import { createChunks, chunkIndexOf, CHUNKS_X, CHUNKS_Y } from './src/chunks.js';
import {
  digCells, shapeCells, cellsBounds, laser, applyDelta, createSim, igniteGas,
} from './src/dig.js';
import { createMinimap } from './src/minimap.js';
import { createParticles } from './src/particles.js';
import {
  createStats, createShopPanel, digRadius, digPower, fuelMax, bagMax,
  fortuneChance, laserPierce, availableShapes, cycleShape, stashCount, stashValue,
} from './src/shop.js';
import { createDebug, mmss } from './src/debug.js';
import { input } from './src/input.js';
import { sound } from './src/sound.js';

const menuEl = document.getElementById('menu');
const seedInput = document.getElementById('seed-input');
const sizeSelect = document.getElementById('size-select');
const difficultySelect = document.getElementById('difficulty-select');
const playBtn = document.getElementById('play-btn');
const lastSeedEl = document.getElementById('last-seed');
const hudEl = document.getElementById('hud');
const debugEl = document.getElementById('debug');
const shopEl = document.getElementById('shop');
const bannerEl = document.getElementById('banner');
const randomSeedBtn = document.getElementById('random-seed-btn');

const pauseEl = document.getElementById('pause-menu');
const pauseInfoEl = document.getElementById('pause-info');
const btnResume = document.getElementById('btn-resume');
const volumeLabel = document.getElementById('volume-label');
const volumeSlider = document.getElementById('volume-slider');
const toggleMusicEl = document.getElementById('toggle-music');
const boxMusicEl = document.getElementById('box-music');
const toggleSfxEl = document.getElementById('toggle-sfx');
const boxSfxEl = document.getElementById('box-sfx');
const btnCopySeed = document.getElementById('btn-copy-seed');
const btnToggleDebug = document.getElementById('btn-toggle-debug');
const btnToggleSim = document.getElementById('btn-toggle-sim');
const btnToggleMap = document.getElementById('btn-toggle-map');
const btnRestart = document.getElementById('btn-restart');
const btnExit = document.getElementById('btn-exit');

let app;
let currentGame = null;
let debugOn = false;

function startGame(seed, sizeKey, diffKey = 'normal') {
  setWorldSize(sizeKey);
  setDifficulty(diffKey);
  const GOAL = goalDepth();
  const debug = createDebug(debugEl, debugOn);

  const delta = new Map();
  const tGen = performance.now();
  const world = IS_INFINITE ? createInfiniteWorld(seed, delta) : generateWorld(seed);
  const biomes = IS_INFINITE ? null : generateBiomes(seed);
  debug.log(
    `Mundo ${SIZES[sizeKey].name} [${IS_HARD ? 'Difícil' : 'Fácil'}] (seed ${seed}) en ${(performance.now() - tGen).toFixed(1)} ms`,
  );

  const stats = createStats();

  const worldLayer = new PIXI.Container();
  app.stage.addChild(worldLayer);
  const bg = createBackground(world);
  worldLayer.addChild(bg);

  const chunks = createChunks(world, biomes);
  worldLayer.addChild(chunks.container);

  const sim = createSim(world, delta, chunks);

  const simGfx = new PIXI.Graphics();
  worldLayer.addChild(simGfx);
  let simView = false;
  const heat = new Map();

  const player = createPlayer(world);
  const startY = player.y + player.h;
  const startRow = Math.round(startY / CELL);
  const goalRow = startRow + GOAL;
  const spawnCol = Math.floor((player.x + player.w / 2) / CELL);

  if (!IS_INFINITE) {
    worldLayer.addChild(createGoalLine(goalRow * CELL, false));
  }

  const bases = [{
    name: 'Superficie',
    col: spawnCol,
    row: startRow,
    x: (spawnCol + 0.5) * CELL,
    y: startY - CELL,
    main: true,
  }];
  let activeBaseIndex = 0;
  worldLayer.addChild(createShop(spawnCol, startY));

  const playerSprite = createPlayerSprite(player);
  worldLayer.addChild(playerSprite);

  const particles = createParticles();
  worldLayer.addChild(particles.layer);

  const effects = createEffects();
  worldLayer.addChild(effects.layer);

  const floatingTexts = createFloatingTexts();
  worldLayer.addChild(floatingTexts.layer);

  // Niebla de guerra + linterna (solo en Modo Difícil)
  const fog = IS_HARD ? createFogOfWar() : null;
  if (fog) worldLayer.addChild(fog.layer);

  const preview = new PIXI.Graphics();
  worldLayer.addChild(preview);

  const minimap = createMinimap(world);
  let bigMap = false;

  const cargo = {};
  for (const t of Object.keys(ORE_VALUE)) cargo[t] = 0;
  const cargoTotal = () => Object.values(cargo).reduce((a, b) => a + b, 0);

  let paused = false;
  let msg = '';
  let msgTimer = 0;
  let bannerTimer = 0;
  let digTimer = 0;
  let laserCooldown = 0;
  let smokeTimer = 0;
  let noFuelAlertTimer = 0;
  let wasFuelEmpty = false;
  let lastHud = '';
  let playTime = 0;
  let won = false;
  let shake = 0;
  let nearBase = null;
  let actionText = '';
  let rebuiltTotal = 0;
  let lastRebuild = { n: 0, ms: 0 };
  let camX = 0, camY = 0;
  let tcx = 0, tcy = 0, inReach = false;
  const bombs = [];
  const SIM_STEP = 1 / SIM_HZ;
  let simAcc = 0;
  let burst = null;
  let lastActiveChunks = [];
  let lastActiveTime = -99;

  // Temblores sísmicos (Modo Difícil)
  let quakeCooldown = 38;
  let quakeWarning = 0;

  // Sensor de proximidad a gas y lava
  let scanTimer = 0;
  let gasAlertTimer = 0;
  let lavaAlertTimer = 0;
  let nearGasDist = Infinity;
  let nearLavaDist = Infinity;

  sound.startMusic();

  const say = (text, secs = 2.5) => { msg = text; msgTimer = secs; };
  const showBanner = (text, secs = 8) => {
    bannerEl.textContent = text;
    bannerEl.style.display = 'block';
    bannerTimer = secs;
  };

  function alertNoFuel(text = '¡Sin combustible!') {
    floatingTexts.spawn(player.x + player.w / 2, player.y - 6, text, 0xff5252);
    say('¡Sin combustible!', 1.5);
    sound.noFuel();
    noFuelAlertTimer = 1.2;
  }

  // ---------- Daño y muerte en Modo Difícil ----------
  function damagePlayer(amount, reason, ignoreInvuln = false) {
    if (!IS_HARD || amount <= 0) return;
    if (!ignoreInvuln && player.invuln > 0) return;
    if (!ignoreInvuln) player.invuln = 0.55;

    player.hp = Math.max(0, player.hp - amount);
    const tx = player.x + player.w / 2;
    const ty = player.y - 4;
    floatingTexts.spawn(tx, ty, `-${Math.ceil(amount)} HP (${reason})`, 0xff5252);
    sound.blocked();
    shake = Math.max(shake, Math.min(8, amount * 0.35));

    if (player.hp <= 0) {
      let lostCargo = 0;
      for (const t in cargo) { lostCargo += cargo[t]; cargo[t] = 0; }

      const resp = bases[activeBaseIndex] || bases[0];
      player.x = resp.x - player.w / 2;
      player.y = resp.row * CELL - player.h;
      player.vx = 0;
      player.vy = 0;
      player.onGround = true;
      player.hp = player.maxHp;
      player.fuel = player.fuelMax;
      player.invuln = 1.5;

      sound.explosion();
      effects.spawnExplosion(resp.x, resp.y, 44);
      showBanner(`¡Moriste (${reason})! Perdiste ${lostCargo} minerales de la mochila`, 5);
      debug.log(`Muerte por ${reason}: perdió ${lostCargo} minerales, reapareció en ${resp.name}`);
    }
  }

  // ---------- Puestos Avanzados (G) y Teletransporte (T) ----------
  function deployOutpost() {
    if (stats.outposts <= 0) {
      say('No tenés Puestos Avanzados. Comprá uno en la tienda ($500)', 2.5);
      return;
    }
    const col = Math.floor((player.x + player.w / 2) / CELL);
    const groundRow = Math.floor((player.y + player.h + 2) / CELL);
    if (groundRow < startRow + 5) {
      say('Bajá un poco más para instalar un Puesto Avanzado', 2);
      return;
    }
    if (bases.some((b) => Math.hypot(b.col - col, b.row - groundRow) < 12)) {
      say('Ya hay una base muy cerca de acá', 2);
      return;
    }

    stats.outposts--;
    for (let dy = -3; dy <= 0; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const wx = col + dx;
        const wy = groundRow + dy;
        if (dy === 0) world.set(wx, wy, PLATFORM);
        else if (world.get(wx, wy) !== PLATFORM) world.set(wx, wy, AIR);
        chunks.markDirty(chunkIndexOf(wx, wy));
      }
    }

    const groundY = groundRow * CELL;
    const baseNum = bases.length;
    worldLayer.addChild(createOutpost(col, groundY, baseNum));
    const newBase = {
      name: `Base #${baseNum}`,
      col,
      row: groundRow,
      x: (col + 0.5) * CELL,
      y: groundY - CELL,
      main: false,
    };
    bases.push(newBase);
    activeBaseIndex = bases.length - 1;

    sound.coin();
    effects.spawnExplosion(newBase.x, newBase.y, 42);
    floatingTexts.spawn(newBase.x, newBase.y - 26, `¡${newBase.name} instalada!`, 0x4fe3ff);
    say(`¡${newBase.name} instalada! Usá T para viajar entre bases`, 3.5);
    debug.log(`Puesto Avanzado #${baseNum} instalado en (${col}, ${groundRow})`);
  }

  function teleportNextBase() {
    if (bases.length < 2) {
      say('Instalá un Puesto Avanzado (tecla G) para poder teletransportarte', 2.5);
      return;
    }
    activeBaseIndex = (activeBaseIndex + 1) % bases.length;
    const dest = bases[activeBaseIndex];
    player.x = dest.x - player.w / 2;
    player.y = dest.row * CELL - player.h;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;

    sound.laser();
    effects.spawnExplosion(dest.x, dest.y, 36);
    floatingTexts.spawn(dest.x, dest.y - 26, `Teletransportado a ${dest.name}`, 0x4fe3ff);
    say(`Viajaste a ${dest.name} (${Math.max(0, dest.row - startRow)} m)`, 2.5);
  }

  const panel = createShopPanel(shopEl, stats, (text) => {
    say(text);
    debug.log(text);
    sound.coin();
    const target = nearBase || bases[0];
    floatingTexts.spawn(target.x, target.y - 26, text, 0xffe066);
  }, teleportNextBase);

  // ---------- Menú de pausa ----------
  function syncPauseLabels() {
    pauseInfoEl.textContent = `Seed: ${seed} · ${SIZES[sizeKey].name} (${IS_HARD ? 'Difícil' : 'Fácil'}) · ${mmss(playTime)}`;
    const pct = Math.round(sound.volume * 100);
    volumeLabel.textContent = `Volumen: ${pct}%`;
    volumeSlider.value = String(pct);

    toggleMusicEl.classList.toggle('muted', sound.musicMuted);
    toggleMusicEl.setAttribute('aria-checked', String(sound.musicMuted));
    boxMusicEl.textContent = sound.musicMuted ? '✕' : '';

    toggleSfxEl.classList.toggle('muted', sound.sfxMuted);
    toggleSfxEl.setAttribute('aria-checked', String(sound.sfxMuted));
    boxSfxEl.textContent = sound.sfxMuted ? '✕' : '';

    btnCopySeed.textContent = 'Copiar seed';
    btnToggleDebug.textContent = `Depuración (U): ${debugOn ? 'Activada' : 'Desactivada'}`;
    btnToggleSim.textContent = `Vista simulación (V): ${simView ? 'Activada' : 'Desactivada'}`;
    btnToggleMap.textContent = `Minimapa (M): ${bigMap ? 'Grande' : 'Normal'}`;
  }

  function setPaused(value) {
    paused = value;
    if (paused) {
      sound.stopJetpack();
      syncPauseLabels();
      pauseEl.style.display = 'flex';
    } else {
      pauseEl.style.display = 'none';
    }
  }

  btnResume.onclick = () => setPaused(false);
  volumeSlider.oninput = () => {
    sound.setVolume(Number(volumeSlider.value) / 100);
    volumeLabel.textContent = `Volumen: ${volumeSlider.value}%`;
  };
  toggleMusicEl.onclick = () => { sound.toggleMusic(); syncPauseLabels(); };
  toggleSfxEl.onclick = () => { sound.toggleSfx(); syncPauseLabels(); };
  btnCopySeed.onclick = () => {
    navigator.clipboard?.writeText(String(seed));
    btnCopySeed.textContent = '¡Seed copiada!';
  };
  btnToggleDebug.onclick = () => { debugOn = debug.toggle(); syncPauseLabels(); };
  btnToggleSim.onclick = () => {
    simView = !simView;
    if (!simView) { heat.clear(); simGfx.clear(); }
    debug.log(`Modo simulación ${simView ? 'activado' : 'desactivado'}`);
    syncPauseLabels();
  };
  btnToggleMap.onclick = () => {
    bigMap = minimap.toggleSize();
    debug.log(`Minimapa ${bigMap ? 'grande' : 'normal'}`);
    syncPauseLabels();
  };
  btnRestart.onclick = () => restartGame(seed, sizeKey, diffKey);
  btnExit.onclick = () => backToMenu();

  // ---------- Cavar, explotar y disparar ----------
  function collect(broken) {
    let free = bagMax(stats) - cargoTotal();
    let lost = 0;
    let bonus = 0;
    const fortune = fortuneChance(stats);
    const gained = [];
    for (const t in broken) {
      if (!(t in cargo)) continue;
      let n = broken[t];
      for (let k = 0; k < broken[t]; k++) if (Math.random() < fortune) { n++; bonus++; }
      const take = Math.min(n, Math.max(0, free));
      cargo[t] += take;
      free -= take;
      lost += n - take;
      if (take > 0) gained.push(`+${take} ${ORE_NAME[t]}`);
      if (Number(t) === CRYSTAL) player.fuel = Math.min(player.fuelMax, player.fuel + CRYSTAL_FUEL * take);
    }
    const tx = player.x + player.w / 2;
    const ty = player.y - 4;
    if (gained.length) floatingTexts.spawn(tx, ty, gained.join(' · '), 0xffffff);
    if (bonus > 0) {
      say(`¡Fortuna! +${bonus} de bonus`, 1.5);
      floatingTexts.spawn(tx, ty - 14, `¡Fortuna +${bonus}!`, 0x4fe3ff);
    }
    if (lost > 0) {
      say(`¡Mochila llena! Se perdieron ${lost} minerales`, 2);
      floatingTexts.spawn(tx, ty - 14, '¡Mochila llena!', 0xff6b6b);
    }
  }

  const breakParticles = (power) => (x, y, type) => {
    if (Math.random() < 0.55) particles.spawn((x + 0.5) * CELL, (y + 0.5) * CELL, COLORS[type], 1, power);
  };

  function checkGasDetonation(cells) {
    if (!IS_HARD) return;
    const blown = igniteGas(world, delta, chunks, cells, breakParticles(2));
    if (!blown.length) return;

    sound.explosion();
    shake = Math.max(shake, 11);
    const [gx, gy] = blown[0];
    effects.spawnExplosion((gx + 0.5) * CELL, (gy + 0.5) * CELL, 5.5 * CELL);
    say('¡Explosión de bolsa de gas!', 2);
    debug.log(`Detonación de gas: ${blown.length} celdas explotadas`);

    const pcx = Math.floor((player.x + player.w / 2) / CELL);
    const pcy = Math.floor((player.y + player.h / 2) / CELL);
    if (blown.some(([x, y]) => Math.hypot(x - pcx, y - pcy) <= 3.5)) {
      damagePlayer(32, 'explosión de gas', true);
    }
  }

  function afterDig(res, label, cells, ms, cx, cy, canIgnite = false) {
    collect(res.broken);
    if (canIgnite) checkGasDetonation(cells);
    const b = cellsBounds(cells);
    if (b) sim.wakeRect(b.x0 - 1, b.y0 - 1, b.x1 + 1, b.y1 + 1);

    if (res.count === 0 && res.blocked > 0) {
      const under = world.inBounds(cx, cy) ? world.get(cx, cy) : 0;
      if ((HARDNESS[under] ?? 0) >= 99) say('Eso no se puede romper', 1.5);
      else say(`Material muy duro: ${NAMES[under]} pide un pico mejor`, 1.5);
    }
    if (res.count > 0 || res.blocked > 0) {
      const parts = Object.entries(res.broken).map(([type, n]) => `${NAMES[type]} ${n}`).join(', ');
      actionText =
        `${label} en (${cx}, ${cy}): ${res.count} celdas` +
        (parts ? ` [${parts}]` : '') +
        (res.blocked ? `, ${res.blocked} bloqueadas` : '') +
        ` en ${ms.toFixed(2)} ms`;
    }
  }

  function applyDig(cells, power, kind, cx, cy) {
    const t = performance.now();
    const isBomb = kind === 'bomb';
    const res = digCells(world, delta, chunks, cells, power, breakParticles(isBomb ? 1.8 : 1));
    const label = isBomb ? 'Explosión' : `Cavó (${SHAPE_NAMES[stats.shape]})`;
    afterDig(res, label, cells, performance.now() - t, cx, cy, isBomb);

    if (!isBomb) {
      if (res.count > 0) {
        let maxH = 1;
        let hasOre = false;
        for (const type in res.broken) {
          maxH = Math.max(maxH, HARDNESS[type] ?? 1);
          if (type in cargo) hasOre = true;
        }
        sound.dig(maxH, hasOre);
      } else if (res.blocked > 0) {
        sound.blocked();
      }
    }
    return res;
  }

  function plantBomb(cx, cy) {
    if (stats.dynamite <= 0) { say('No te queda dinamita. Comprala en la tienda', 2); return; }
    stats.dynamite--;
    const g = createBomb();
    g.position.set((cx + 0.5) * CELL, (cy + 0.5) * CELL);
    worldLayer.addChild(g);
    bombs.push({ cx, cy, t: DYNAMITE.fuse, g });
    sound.bombPlace();
    debug.log(`Dinamita colocada en (${cx}, ${cy}), explota en ${DYNAMITE.fuse} s`);
  }

  function updateBombs(dt) {
    for (let i = bombs.length - 1; i >= 0; i--) {
      const b = bombs[i];
      b.t -= dt;
      const freq = b.t < 0.6 ? 34 : 18;
      b.g.alpha = Math.sin(b.t * freq) > 0 ? 1 : 0.35;
      if (b.t > 0) continue;

      const x = (b.cx + 0.5) * CELL;
      const y = (b.cy + 0.5) * CELL;
      applyDig(shapeCells('circle', b.cx, b.cy, DYNAMITE.radius), DYNAMITE.power, 'bomb', b.cx, b.cy);
      sound.explosion();
      effects.spawnExplosion(x, y, DYNAMITE.radius * CELL);
      particles.spawn(x, y, 0xff9f1c, 34, 2.3);
      particles.spawn(x, y, 0xffe066, 18, 1.7);
      particles.spawn(x, y, 0x4a4a52, 14, 1.3);
      shake = 10;
      b.g.destroy();
      bombs.splice(i, 1);
    }
  }

  function fireLaser() {
    const pierce = laserPierce(stats);
    if (pierce === 0) { say('Todavía no tenés el láser. Comprálo en la tienda', 2); return; }
    if (laserCooldown > 0) return;
    if (player.fuel < LASER.fuel) {
      alertNoFuel('¡Sin combustible para láser!');
      return;
    }

    const ox = player.x + player.w / 2;
    const oy = player.y + player.h * 0.4;
    let dx = input.mouseX + camX - ox;
    let dy = input.mouseY + camY - oy;
    const d = Math.hypot(dx, dy);
    if (d < 1) return;
    dx /= d;
    dy /= d;

    player.fuel -= LASER.fuel;
    laserCooldown = LASER.cooldown;
    const t = performance.now();
    const res = laser(world, delta, chunks, ox / CELL, oy / CELL, dx, dy, pierce, LASER.range, digPower(stats), breakParticles(1.4));

    const [lx, ly] = res.last;
    const ex = (lx + 0.5) * CELL;
    const ey = (ly + 0.5) * CELL;
    sound.laser();
    effects.spawnLaser(ox, oy, ex, ey, stats.levels.laser);
    particles.spawn(ex, ey, 0xff9f1c, 8, 1.2);
    shake = Math.max(shake, 2.5);

    afterDig(res, 'Láser', res.hitCells, performance.now() - t, lx, ly, true);
  }

  // ---------- Simulación del terreno ----------
  function occupiedCells() {
    const set = new Set();
    const x0 = Math.floor(player.x / CELL);
    const x1 = Math.floor((player.x + player.w - 0.001) / CELL);
    const y0 = Math.floor(player.y / CELL);
    const y1 = Math.floor((player.y + player.h - 0.001) / CELL);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set.add(`${x},${y}`);
    return set;
  }

  function runSimStep() {
    if (sim.pendingCount === 0) return;
    const chunkPx = CHUNK * CELL;
    const activeBounds = {
      cx0: Math.floor((camX - app.screen.width) / chunkPx),
      cx1: Math.floor((camX + app.screen.width * 2) / chunkPx),
      cy0: Math.max(0, Math.floor((camY - app.screen.height) / chunkPx)),
      cy1: Math.floor((camY + app.screen.height * 2) / chunkPx),
    };
    const crushed = sim.step(occupiedCells(), activeBounds);
    if (IS_HARD && crushed > 0) {
      damagePlayer(8, 'derrumbe');
    }

    const st = sim.stats;
    lastActiveChunks = sim.lastActive;
    lastActiveTime = playTime;

    if (st.moved > 0) {
      if (!burst) {
        burst = { moved: 0, steps: 0, ms: 0 };
        debug.log('Simulación: el terreno empezó a moverse');
      }
      burst.moved += st.moved;
      burst.steps++;
      burst.ms += st.ms;
      if (simView) for (const [mx, my] of sim.moved) heat.set(`${mx},${my}`, 0);
    }
    if (sim.pendingCount === 0 && burst) {
      debug.log(`Terreno estable: ${burst.moved} movimientos de celda en ${burst.steps} pasos (${burst.ms.toFixed(1)} ms de simulación)`);
      burst = null;
    }
  }

  function drawSimView(dt) {
    simGfx.clear();
    const fresh = [], mid = [], old = [];
    for (const [key, age] of heat) {
      const a = age + dt;
      if (a > 0.5) { heat.delete(key); continue; }
      heat.set(key, a);
      const pos = key.split(',').map(Number);
      (a < 0.15 ? fresh : a < 0.3 ? mid : old).push(pos);
    }
    const paint = (list, alpha) => {
      if (!list.length) return;
      for (const [x, y] of list) simGfx.rect(x * CELL, y * CELL, CELL, CELL);
      simGfx.fill({ color: 0xff2bd6, alpha });
    };
    paint(old, 0.25);
    paint(mid, 0.55);
    paint(fresh, 0.9);

    if (playTime - lastActiveTime < 0.25) {
      for (const c of lastActiveChunks) {
        let cx, cy;
        if (typeof c === 'string') [cx, cy] = c.split(',').map(Number);
        else { cx = c % CHUNKS_X; cy = Math.floor(c / CHUNKS_X); }
        simGfx.rect(cx * CHUNK * CELL, cy * CHUNK * CELL, CHUNK * CELL, CHUNK * CELL);
      }
      simGfx.stroke({ width: 1, color: 0x2ee6ff, alpha: 0.7 });
    }
  }

  // ---------- Teclas ----------
  function onKey(e) {
    if (e.target instanceof HTMLInputElement || e.repeat || paused) return;

    if (e.code === 'KeyR' && !IS_INFINITE) {
      const fresh = generateWorld(seed);
      applyDelta(fresh, delta);
      let diff = 0;
      for (let i = 0; i < fresh.raw.length; i++) if (fresh.raw[i] !== world.raw[i]) diff++;
      debug.log(`Persistencia (R): seed + delta vs mundo actual = ${diff} celdas distintas`);
      world.raw.set(fresh.raw);
      chunks.markAllDirty();
    } else if (e.code === 'KeyN') {
      const m = sound.toggleSfx();
      say(m ? 'Efectos silenciados' : 'Efectos activados', 1.2);
    } else if (e.code === 'KeyU') {
      debugOn = debug.toggle();
    } else if (e.code === 'KeyV') {
      simView = !simView;
      if (!simView) { heat.clear(); simGfx.clear(); }
      debug.log(`Modo simulación ${simView ? 'activado' : 'desactivado'}`);
    } else if (e.code === 'KeyM') {
      bigMap = minimap.toggleSize();
      debug.log(`Minimapa ${bigMap ? 'grande' : 'normal'}`);
    } else if (e.code === 'KeyQ') {
      if (availableShapes(stats).length === 1) say('Comprá "Formas del pico" en la tienda', 2);
      else say(`Forma: ${SHAPE_NAMES[cycleShape(stats)]}`, 1.5);
    } else if (e.code === 'KeyF') {
      fireLaser();
    } else if (e.code === 'KeyG') {
      deployOutpost();
    } else if (e.code === 'KeyT') {
      teleportNextBase();
    } else if (e.code === 'KeyE') {
      if (panel.isOpen) panel.close();
      else if (nearBase) panel.open();
      else say('Acercate a una tienda o Puesto Avanzado para abrirla', 1.8);
    } else if (e.code === 'Digit0') {
      panel.sellAll();
    } else if (/^Digit[1-9]$/.test(e.code)) {
      panel.buy(Number(e.code.slice(5)) - 1);
    }
  }
  window.addEventListener('keydown', onKey);

  hudEl.style.display = 'block';

  const debugInfo = () => {
    const pcx = Math.floor((player.x + player.w / 2) / CELL);
    const pcy = Math.floor((player.y + player.h / 2) / CELL);
    const inWorld = world.inBounds(tcx, tcy);
    const mouseType = inWorld ? world.get(tcx, tcy) : 0;
    const mouseBiome = inWorld
      ? BIOME_NAMES[IS_INFINITE ? world.biomeAt(tcx, tcy) : biomes[tcy * COLS + tcx]]
      : '-';
    let deltaCells = 0;
    for (const m of delta.values()) deltaCells += m.size;
    const ss = sim.stats;
    return [
      `Seed: ${seed}   ${SIZES[sizeKey].name} · ${IS_HARD ? 'Modo Difícil' : 'Modo Fácil'}`,
      `Jugador: celda (${pcx}, ${pcy})  HP: ${Math.ceil(player.hp)}/${player.maxHp}  fuel: ${player.fuel.toFixed(0)}/${player.fuelMax}`,
      `  chunk: ${chunkIndexOf(pcx, pcy)}   bases activas: ${bases.length}`,
      `Mouse: celda (${tcx}, ${tcy})  ${NAMES[mouseType]}  dureza ${HARDNESS[mouseType] ?? 0}  bioma ${mouseBiome}  ${inReach ? 'al alcance' : 'lejos'}`,
      `Chunks visibles: ${chunks.visibleCount} de ${chunks.total}   redibujos totales: ${rebuiltTotal}`,
      `Último redibujo: ${lastRebuild.n} chunk(s) en ${lastRebuild.ms.toFixed(2)} ms`,
      `Delta: ${deltaCells} celdas cambiadas en ${delta.size} chunk(s)`,
      `Simulación: ${ss.steps} pasos, chunks activos ${ss.activeChunks}, revisadas ${ss.examined}, movidas ${ss.moved}, ${ss.ms.toFixed(2)} ms`,
      `  pendientes ${sim.pendingCount} chunk(s), movidas en total ${ss.totalMoved}, modo visual (V): ${simView ? 'sí' : 'no'}`,
      `Dinamitas activas: ${bombs.length}   partículas: ${particles.count}`,
      `Pico: ${SHAPE_NAMES[stats.shape]}, radio ${digRadius(stats)}, poder ${digPower(stats)}, fortuna ${Math.round(fortuneChance(stats) * 100)}%, láser ${laserPierce(stats)} celdas`,
    ];
  };

  // ---------- Un frame ----------
  const tick = (ticker) => {
    if (paused) return;

    const dt = Math.min(ticker.deltaMS / 1000, 1 / 30);
    playTime += dt;

    player.fuelMax = fuelMax(stats);
    updatePlayer(world, player, input, dt);
    if (IS_HARD && player.lastFallDamage > 0) {
      damagePlayer(player.lastFallDamage, 'caída', true);
    }

    updateCamera(worldLayer, app.screen, player);
    sound.setJetpack(player.flying);

    noFuelAlertTimer -= dt;
    if (player.fuel <= 0) {
      if (!wasFuelEmpty || (input.jump && !player.onGround && noFuelAlertTimer <= 0)) {
        alertNoFuel('¡Sin combustible!');
      }
      wasFuelEmpty = true;
    } else {
      wasFuelEmpty = false;
    }

    camX = -worldLayer.x;
    camY = -worldLayer.y;
    if (bg.updateInfinite) bg.updateInfinite(camX, camY, app.screen.width, app.screen.height, startRow);
    chunks.updateVisibility(camX, camY, app.screen.width, app.screen.height);

    tcx = Math.floor((input.mouseX + camX) / CELL);
    tcy = Math.floor((input.mouseY + camY) / CELL);
    const pcx = player.x + player.w / 2;
    const pcy = player.y + player.h / 2;
    inReach = Math.hypot((tcx + 0.5) * CELL - pcx, (tcy + 0.5) * CELL - pcy) <= DIG_REACH * CELL;

    const radius = digRadius(stats);
    const cells = shapeCells(stats.shape, tcx, tcy, radius, Math.floor(pcx / CELL), Math.floor(pcy / CELL));
    const usable = stats.shape === 'cone' || inReach;

    updatePlayerSprite(playerSprite, player, input.mouseX + camX, input.mouseDown && usable, stats.levels, dt);

    if (player.flying) {
      smokeTimer -= dt;
      if (smokeTimer <= 0) {
        const nozzle = playerSprite.getNozzlePos();
        effects.spawnJetpackSmoke(nozzle.x, nozzle.y);
        smokeTimer = 0.04;
      }
    }

    preview.clear();
    for (const [x, y] of cells) preview.rect(x * CELL, y * CELL, CELL, CELL);
    if (cells.length) preview.fill({ color: 0xffffff, alpha: usable ? 0.28 : 0.1 });

    digTimer -= dt;
    if (input.mouseDown && usable && digTimer <= 0) {
      applyDig(cells, digPower(stats), 'dig', tcx, tcy);
      digTimer = DIG_DELAY;
    }
    if (input.consumeRight()) {
      if (inReach) plantBomb(tcx, tcy);
      else say('Muy lejos para colocar dinamita', 1.5);
    }
    updateBombs(dt);

    laserCooldown -= dt;

    simAcc += dt;
    let simRuns = 0;
    while (simAcc >= SIM_STEP && simRuns < 2) {
      simAcc -= SIM_STEP;
      simRuns++;
      runSimStep();
    }
    if (simAcc > SIM_STEP) simAcc = 0;

    // Cerca de la tienda o Puesto Avanzado: recarga combustible, deposita minerales y cura HP
    nearBase = bases.find((b) => Math.hypot(pcx - b.x, pcy - b.y) <= SELL_RANGE * CELL) || null;
    if (nearBase) {
      player.fuel = player.fuelMax;
      if (IS_HARD && player.hp < player.maxHp) {
        player.hp = Math.min(player.maxHp, player.hp + HP_REGEN_BASE * dt);
      }
      let n = 0;
      let val = 0;
      for (const t in cargo) {
        stats.stash[t] += cargo[t];
        n += cargo[t];
        val += cargo[t] * ORE_VALUE[t];
        cargo[t] = 0;
      }
      if (n > 0) {
        say(`Depositaste ${n} minerales en el almacén`);
        sound.deposit();
        floatingTexts.spawn(nearBase.x, nearBase.y - 26, `+${n} al almacén ($${val})`, 0x7ae582);
        debug.log(`Depósito en ${nearBase.name}: ${n} minerales (almacén ${stashCount(stats)}, vale $${stashValue(stats)})`);
        panel.render();
      }
    } else if (panel.isOpen) {
      panel.close();
    }

    const depth = Math.max(0, Math.floor((player.y + player.h - startY) / CELL));
    const pbx = Math.floor(pcx / CELL);
    const pby = Math.floor(pcy / CELL);
    const biomeIdx = world.inBounds(pbx, pby)
      ? (IS_INFINITE ? world.biomeAt(pbx, pby) : biomes[pby * COLS + pbx])
      : 0;

    // Música tenebrosa al bajar muy hondo (>= 85m) o entrar en bioma volcánico
    sound.setDeepMode(depth >= 85 || biomeIdx === VOLCANICO);

    // Escaneo de proximidad a Gas y Lava en un radio de 6 celdas
    scanTimer -= dt;
    if (scanTimer <= 0) {
      scanTimer = 0.16;
      nearGasDist = Infinity;
      nearLavaDist = Infinity;
      const R = 6;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const wx = pbx + dx;
          const wy = pby + dy;
          if (!world.inBounds(wx, wy)) continue;
          const cell = world.get(wx, wy);
          if (cell !== GAS && cell !== LAVA) continue;
          const dist = Math.hypot(dx, dy);
          if (cell === GAS && dist < nearGasDist) nearGasDist = dist;
          if (cell === LAVA && dist < nearLavaDist) nearLavaDist = dist;
        }
      }
    }

    if (nearGasDist <= 6) {
      const prox = Math.max(0.1, 1 - nearGasDist / 6.5);
      gasAlertTimer -= dt;
      if (gasAlertTimer <= 0) {
        sound.gasClick(prox);
        gasAlertTimer = Math.max(0.11, 0.55 - prox * 0.44);
      }
    }
    if (nearLavaDist <= 6) {
      const prox = Math.max(0.1, 1 - nearLavaDist / 6.5);
      lavaAlertTimer -= dt;
      if (lavaAlertTimer <= 0) {
        sound.lavaBubble(prox);
        lavaAlertTimer = Math.max(0.28, 0.95 - prox * 0.65);
      }
    }

    // ---------- Mecánicas ambientales de Modo Difícil ----------
    if (IS_HARD) {
      const suitLv = stats.levels.suit || 0;
      const suitFactor = suitLv === 0 ? 1 : suitLv === 1 ? 0.6 : suitLv === 2 ? 0.3 : 0;

      // 1) Contacto con Lava o Gas tóxico
      const feetRow = Math.floor((player.y + player.h - 2) / CELL);
      const bodyCell = world.get(pbx, pby);
      const feetCell = world.get(pbx, feetRow);

      if (bodyCell === LAVA || feetCell === LAVA) {
        damagePlayer(24, 'lava');
      } else if ((bodyCell === GAS || feetCell === GAS) && suitFactor > 0) {
        damagePlayer(Math.max(4, Math.round(14 * suitFactor)), 'gas tóxico');
      }

      // 2) Calor y presión ambiental en profundidad o bioma volcánico
      const isHotZone = biomeIdx === VOLCANICO || depth > 130;
      if (isHotZone && !nearBase && suitFactor > 0) {
        const heatDrain = (depth > 180 ? 2.4 : 1.3) * suitFactor;
        if (player.fuel > 0) {
          player.fuel = Math.max(0, player.fuel - heatDrain * dt);
        } else {
          damagePlayer(Math.max(3, Math.round(10 * suitFactor)), 'calor extremo');
        }
      }

      // 3) Temblores sísmicos periódicos en profundidad
      if (depth > 25 && !nearBase) {
        if (quakeWarning > 0) {
          quakeWarning -= dt;
          shake = Math.max(shake, 2.2);
          if (quakeWarning <= 0) {
            sim.wakeRect(pbx - 24, pby - 20, pbx + 24, pby + 20);
            shake = 9;
            sound.explosion();
            say('¡Temblor sísmico! Cuidado con los derrumbes', 2.5);
            debug.log(`Sismo en profundidad ${depth}m: chunks cercanos despertados`);
            quakeCooldown = 35 + Math.random() * 25;
          }
        } else {
          quakeCooldown -= dt;
          if (quakeCooldown <= 0) {
            quakeWarning = 2.0;
            say('¡Se siente un rugido subterráneo...!', 2);
            sound.noFuel();
          }
        }
      }
    }

    particles.updateAmbient(dt, {
      camX, camY,
      screenW: app.screen.width,
      screenH: app.screen.height,
      world,
      biomes,
      startRow,
    });
    particles.update(dt);
    effects.update(dt);
    floatingTexts.update(dt);
    if (simView) drawSimView(dt);

    if (fog) {
      fog.update({
        camX, camY,
        screenW: app.screen.width,
        screenH: app.screen.height,
        playerX: pcx,
        playerY: player.y + player.h * 0.25,
        targetX: input.mouseX + camX,
        targetY: input.mouseY + camY,
        depth,
        flashLevel: stats.levels.flashlight || 0,
      });
    }

    const tR = performance.now();
    const rebuilt = chunks.rebuildDirty();
    if (rebuilt.length > 0) {
      lastRebuild = { n: rebuilt.length, ms: performance.now() - tR };
      rebuiltTotal += rebuilt.length;
      for (const c of rebuilt) minimap.redrawChunk(c);
      if (actionText) {
        debug.log(`${actionText} -> redibujó ${rebuilt.length} chunk(s) en ${lastRebuild.ms.toFixed(2)} ms`);
        actionText = '';
      }
    }
    minimap.reveal(pbx, pby);
    minimap.draw({
      player, camX, camY,
      screenW: app.screen.width, screenH: app.screen.height,
      bases, goalRow: IS_INFINITE ? -1 : goalRow,
    });

    if (!IS_INFINITE && !won && depth >= GOAL) {
      won = true;
      sound.goal();
      showBanner(`¡Llegaste a ${GOAL} m en ${mmss(playTime)}! Podés seguir explorando`);
      debug.log(`Meta alcanzada en ${mmss(playTime)}`);
    }

    msgTimer -= dt;
    if (msgTimer <= 0) msg = '';
    bannerTimer -= dt;
    if (bannerTimer <= 0) bannerEl.style.display = 'none';
    const bag = Object.keys(cargo).filter((t) => cargo[t] > 0).map((t) => `${ORE_NAME[t]} ${cargo[t]}`).join(' · ');
    const fuelPct = Math.max(0, Math.min(100, (player.fuel / player.fuelMax) * 100));
    const fuelCur = Math.ceil(player.fuel);
    const fuelLow = fuelPct <= 25;
    const fuelEmpty = fuelCur <= 0;

    const hpPct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
    const hpCur = Math.ceil(player.hp);
    const biome = world.inBounds(pbx, pby) ? BIOME_NAMES[biomeIdx] : '-';
    const isHot = IS_HARD && (biomeIdx === VOLCANICO || depth > 130);

    const depthText = IS_INFINITE
      ? `Profundidad: ${depth} m (Infinito)`
      : `Profundidad: ${depth} m de ${GOAL} m${won ? ' (lograda)' : ''}`;

    const lines = [
      `<div class="hud-line">Seed: ${seed} · ${SIZES[sizeKey].name} · ${IS_HARD ? 'Difícil' : 'Fácil'}</div>`,
      `<div class="hud-line">Bioma: ${biome}${isHot ? ' · 🔥 Calor' : ''}</div>`,
      `<div class="hud-line">${depthText}</div>`,
      `<div class="hud-line">Tiempo: ${mmss(playTime)}</div>`,
      `<div class="hud-line">Dinero: $${stats.money}</div>`,
      `<div class="hud-line">Almacén: ${stashCount(stats)} minerales ($${stashValue(stats)})</div>`,
      `<div class="hud-line">Mochila (${cargoTotal()}/${bagMax(stats)}): ${bag || 'vacía'}</div>`,
      IS_HARD ? (
        `<div class="fuel-row">` +
          `<span>Vida:</span>` +
          `<div class="fuel-track${hpPct <= 30 ? ' empty' : ''}">` +
            `<div class="hp-fill${hpPct <= 30 ? ' low' : ''}" style="width:${hpPct.toFixed(1)}%"></div>` +
            `<span class="fuel-val">${hpCur}/${player.maxHp}</span>` +
          `</div>` +
        `</div>`
      ) : '',
      `<div class="fuel-row">` +
        `<span>Combustible:</span>` +
        `<div class="fuel-track${fuelEmpty ? ' empty' : ''}">` +
          `<div class="fuel-fill${fuelLow ? ' low' : ''}" style="width:${fuelPct.toFixed(1)}%"></div>` +
          `<span class="fuel-val">${fuelEmpty ? 'VACÍO' : `${fuelCur}/${player.fuelMax}`}</span>` +
        `</div>` +
      `</div>`,
      `<div class="hud-line">Dinamita: ${stats.dynamite} · Puestos: ${stats.outposts} (G)</div>`,
      bases.length > 1 ? `<div class="hud-line">Bases: ${bases.length} (T teletransporta)</div>` : '',
      availableShapes(stats).length > 1 ? `<div class="hud-line">Forma: ${SHAPE_NAMES[stats.shape]} (Q cambia)</div>` : '',
      laserPierce(stats) > 0 ? `<div class="hud-line">Láser: F (rompe ${laserPierce(stats)} celdas)</div>` : '',
      nearBase ? `<div class="hud-line">Apretá E para abrir ${nearBase.name}</div>` : '',
      nearGasDist <= 5 ? `<div class="hud-warn">⚠️ Sensor: Gas cercano (${Math.ceil(nearGasDist)}m)</div>` : '',
      nearLavaDist <= 5 ? `<div class="hud-warn">🔥 Sensor: Lava cercana (${Math.ceil(nearLavaDist)}m)</div>` : '',
      msg ? `<div class="${fuelEmpty || hpPct <= 30 ? 'hud-warn' : 'hud-msg'}">${msg}</div>` : '',
    ].filter(Boolean).join('');

    if (lines !== lastHud) { hudEl.innerHTML = lines; lastHud = lines; }

    debug.frame(dt, debugInfo);

    if (shake > 0) {
      worldLayer.x += (Math.random() - 0.5) * 2 * shake;
      worldLayer.y += (Math.random() - 0.5) * 2 * shake;
      shake = Math.max(0, shake - 40 * dt);
    }
  };
  app.ticker.add(tick);

  return {
    seed,
    closePanel() {
      if (!panel.isOpen) return false;
      panel.close();
      return true;
    },
    togglePause() {
      setPaused(!paused);
    },
    stop() {
      sound.stopJetpack();
      sound.stopMusic();
      app.ticker.remove(tick);
      window.removeEventListener('keydown', onKey);
      app.stage.removeChild(worldLayer);
      worldLayer.destroy({ children: true });
      minimap.destroy();
      panel.close();
      pauseEl.style.display = 'none';
      hudEl.style.display = 'none';
      debugEl.style.display = 'none';
      bannerEl.style.display = 'none';
    },
  };
}

let lastPlayedSeed = null;

function play() {
  if (currentGame) return;
  const seed = seedFromText(seedInput.value);
  const sizeKey = sizeSelect.value || 'medium';
  const diffKey = difficultySelect?.value || 'normal';
  seedInput.blur();
  menuEl.style.display = 'none';
  sound.coin();
  currentGame = startGame(seed, sizeKey, diffKey);
}

function restartGame(seed, sizeKey, diffKey) {
  if (currentGame) {
    currentGame.stop();
    currentGame = null;
  }
  currentGame = startGame(seed, sizeKey, diffKey);
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