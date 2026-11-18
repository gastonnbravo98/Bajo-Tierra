import {
  CELL, COLS, ROWS, CHUNK, NAMES, HARDNESS, COLORS, ORE_VALUE, ORE_NAME,
  DIG_REACH, DIG_DELAY, SELL_RANGE, DYNAMITE, LASER, CRYSTAL, CRYSTAL_FUEL, SIM_HZ,
  SIZES, BIOME_NAMES, SHAPE_NAMES, setWorldSize, goalDepth,
} from './src/config.js';
import { seedFromText } from './src/random.js';
import { generateWorld, generateBiomes } from './src/worldgen.js';
import {
  createPlayerSprite, updatePlayerSprite, createShop, createBackground,
  createBomb, createGoalLine, createFloatingTexts, createEffects,
} from './src/render.js';
import { createPlayer, updatePlayer } from './src/player.js';
import { updateCamera } from './src/camera.js';
import { createChunks, chunkIndexOf, CHUNKS_X, CHUNKS_Y } from './src/chunks.js';
import {
  digCells, shapeCells, cellsBounds, laser, applyDelta, createSim,
} from './src/dig.js';
import { createMinimap } from './src/minimap.js';
import { createParticles } from './src/particles.js';
import {
  createStats, createShopPanel, digRadius, digPower, fuelMax, bagMax,
  fortuneChance, laserPierce, availableShapes, cycleShape, stashCount, stashValue,
} from './src/shop.js';
import { createDebug, mmss } from './src/debug.js';
import { input } from './src/input.js';

const menuEl = document.getElementById('menu');
const seedInput = document.getElementById('seed-input');
const sizeSelect = document.getElementById('size-select');
const playBtn = document.getElementById('play-btn');
const lastSeedEl = document.getElementById('last-seed');
const hudEl = document.getElementById('hud');
const debugEl = document.getElementById('debug');
const shopEl = document.getElementById('shop');
const bannerEl = document.getElementById('banner');

const pauseEl = document.getElementById('pause-menu');
const pauseInfoEl = document.getElementById('pause-info');
const btnResume = document.getElementById('btn-resume');
const btnCopySeed = document.getElementById('btn-copy-seed');
const btnToggleDebug = document.getElementById('btn-toggle-debug');
const btnToggleSim = document.getElementById('btn-toggle-sim');
const btnToggleMap = document.getElementById('btn-toggle-map');
const btnRestart = document.getElementById('btn-restart');
const btnExit = document.getElementById('btn-exit');

let app;
let currentGame = null;
let debugOn = false; // se mantiene al volver al menú y jugar de nuevo

// ---------- Una partida ----------
function startGame(seed, sizeKey) {
  setWorldSize(sizeKey); // COLS y ROWS cambian para todos los módulos
  const GOAL = goalDepth();
  const debug = createDebug(debugEl, debugOn);

  const tGen = performance.now();
  const world = generateWorld(seed);
  const biomes = generateBiomes(seed);
  debug.log(`Mundo ${SIZES[sizeKey].name} ${COLS}x${ROWS} generado (seed ${seed}) en ${(performance.now() - tGen).toFixed(0)} ms`);

  const delta = new Map(); // chunk -> Map(celda -> tipo nuevo): todo lo que cambió respecto de la seed
  const stats = createStats();

  const worldLayer = new PIXI.Container();
  app.stage.addChild(worldLayer);
  worldLayer.addChild(createBackground(world));

  const chunks = createChunks(world, biomes);
  worldLayer.addChild(chunks.container);

  const sim = createSim(world, delta, chunks); // arena, grava y derrumbes

  // modo simulación (tecla V): pinta las celdas que se movieron y los chunks que se están simulando
  const simGfx = new PIXI.Graphics();
  worldLayer.addChild(simGfx);
  let simView = false;
  const heat = new Map(); // celda -> segundos desde que se movió

  const player = createPlayer(world);
  const startY = player.y + player.h;                              // altura de la superficie inicial
  const startRow = Math.round(startY / CELL);
  const goalRow = startRow + GOAL;
  const spawnCol = Math.floor((player.x + player.w / 2) / CELL);

  worldLayer.addChild(createGoalLine(goalRow * CELL));

  // la tienda queda en el punto de salida
  worldLayer.addChild(createShop(spawnCol, startY));
  const shopX = (spawnCol + 0.5) * CELL;
  const shopY = startY - CELL;

  const playerSprite = createPlayerSprite(player);
  worldLayer.addChild(playerSprite);

  const particles = createParticles();
  worldLayer.addChild(particles.layer);

  const effects = createEffects();
  worldLayer.addChild(effects.layer);

  const floatingTexts = createFloatingTexts();
  worldLayer.addChild(floatingTexts.layer);

  const preview = new PIXI.Graphics(); // celdas que va a romper el próximo golpe
  worldLayer.addChild(preview);

  const minimap = createMinimap(world);
  let bigMap = false;

  // mochila: una cuenta por cada tipo de mineral
  const cargo = {};
  for (const t of Object.keys(ORE_VALUE)) cargo[t] = 0;
  const cargoTotal = () => Object.values(cargo).reduce((a, b) => a + b, 0);

  // estado de la partida
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
  let near = false;             // ¿el jugador está cerca de la tienda?
  let actionText = '';          // se completa con el redibujo y va al registro de debug
  let rebuiltTotal = 0;
  let lastRebuild = { n: 0, ms: 0 };
  let camX = 0, camY = 0;
  let tcx = 0, tcy = 0, inReach = false; // celda bajo el mouse
  const bombs = [];
  const SIM_STEP = 1 / SIM_HZ;
  let simAcc = 0;
  let burst = null;              // resumen de un derrumbe en curso
  let lastActiveChunks = [];
  let lastActiveTime = -99;

  const say = (text, secs = 2.5) => { msg = text; msgTimer = secs; };
  const showBanner = (text, secs = 8) => {
    bannerEl.textContent = text;
    bannerEl.style.display = 'block';
    bannerTimer = secs;
  };

  function alertNoFuel(text = '¡Sin combustible!') {
    floatingTexts.spawn(player.x + player.w / 2, player.y - 6, text, 0xff5252);
    say('¡Sin combustible!', 1.5);
    noFuelAlertTimer = 1.2;
  }

  const panel = createShopPanel(shopEl, stats, (text) => {
    say(text);
    debug.log(text);
    floatingTexts.spawn(shopX, shopY - 26, text, 0xffe066);
  });

  // ---------- Menú de pausa ----------
  function syncPauseLabels() {
    pauseInfoEl.textContent = `Seed: ${seed} · Mundo ${SIZES[sizeKey].name} · Tiempo: ${mmss(playTime)}`;
    btnCopySeed.textContent = 'Copiar seed';
    btnToggleDebug.textContent = `Depuración (U): ${debugOn ? 'Activada' : 'Desactivada'}`;
    btnToggleSim.textContent = `Vista simulación (V): ${simView ? 'Activada' : 'Desactivada'}`;
    btnToggleMap.textContent = `Minimapa (M): ${bigMap ? 'Grande' : 'Normal'}`;
  }

  function setPaused(value) {
    paused = value;
    if (paused) {
      syncPauseLabels();
      pauseEl.style.display = 'flex';
    } else {
      pauseEl.style.display = 'none';
    }
  }

  btnResume.onclick = () => setPaused(false);
  btnCopySeed.onclick = () => {
    navigator.clipboard?.writeText(String(seed));
    btnCopySeed.textContent = '¡Seed copiada!';
  };
  btnToggleDebug.onclick = () => {
    debugOn = debug.toggle();
    syncPauseLabels();
  };
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
  btnRestart.onclick = () => restartGame(seed, sizeKey);
  btnExit.onclick = () => backToMenu();

  // ---------- Cavar, explotar y disparar (Unidad 7) ----------
  // guarda en la mochila lo que entre (con fortuna); el resto se pierde. Los cristales recargan combustible.
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

  // lo que pasa después de romper celdas: mochila, despertar la simulación, mensajes y registro
  function afterDig(res, label, cells, ms, cx, cy) {
    collect(res.broken);
    const b = cellsBounds(cells);
    if (b) sim.wakeRect(b.x0 - 1, b.y0 - 1, b.x1 + 1, b.y1 + 1); // el terreno de alrededor puede perder apoyo

    if (res.count === 0 && res.blocked > 0) {
      const under = cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS ? world[cy * COLS + cx] : 0;
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
    afterDig(res, label, cells, performance.now() - t, cx, cy);
    return res;
  }

  function plantBomb(cx, cy) {
    if (stats.dynamite <= 0) { say('No te queda dinamita. Comprala en la tienda', 2); return; }
    stats.dynamite--;
    const g = createBomb();
    g.position.set((cx + 0.5) * CELL, (cy + 0.5) * CELL);
    worldLayer.addChild(g);
    bombs.push({ cx, cy, t: DYNAMITE.fuse, g });
    debug.log(`Dinamita colocada en (${cx}, ${cy}), explota en ${DYNAMITE.fuse} s`);
  }

  function updateBombs(dt) {
    for (let i = bombs.length - 1; i >= 0; i--) {
      const b = bombs[i];
      b.t -= dt;
      // parpadea cada vez más rápido antes de explotar
      const freq = b.t < 0.6 ? 34 : 18;
      b.g.alpha = Math.sin(b.t * freq) > 0 ? 1 : 0.35;
      if (b.t > 0) continue;

      const x = (b.cx + 0.5) * CELL;
      const y = (b.cy + 0.5) * CELL;
      applyDig(shapeCells('circle', b.cx, b.cy, DYNAMITE.radius), DYNAMITE.power, 'bomb', b.cx, b.cy);
      effects.spawnExplosion(x, y, DYNAMITE.radius * CELL);
      particles.spawn(x, y, 0xff9f1c, 34, 2.3); // fuego
      particles.spawn(x, y, 0xffe066, 18, 1.7);
      particles.spawn(x, y, 0x4a4a52, 14, 1.3); // escombros oscuros
      shake = 10;
      b.g.destroy();
      bombs.splice(i, 1);
    }
  }

  // Láser (tecla F): un rayo recto hacia el cursor, hecho con raycasting sobre la grilla
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

    const ex = ((res.last % COLS) + 0.5) * CELL;
    const ey = (Math.floor(res.last / COLS) + 0.5) * CELL;
    effects.spawnLaser(ox, oy, ex, ey, stats.levels.laser);
    particles.spawn(ex, ey, 0xff9f1c, 8, 1.2);
    shake = Math.max(shake, 2.5);

    afterDig(res, 'Láser', res.hitCells, performance.now() - t, res.last % COLS, Math.floor(res.last / COLS));
  }

  // ---------- Simulación del terreno ----------
  // celdas que ocupa el jugador: nada puede caer adentro de su caja
  function occupiedCells() {
    const set = new Set();
    const x0 = Math.floor(player.x / CELL);
    const x1 = Math.floor((player.x + player.w - 0.001) / CELL);
    const y0 = Math.floor(player.y / CELL);
    const y1 = Math.floor((player.y + player.h - 0.001) / CELL);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set.add(y * COLS + x);
    return set;
  }

  function runSimStep() {
    if (sim.pendingCount === 0) return; // nada activo: no se simula
    sim.step(occupiedCells());
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
      if (simView) for (const i of sim.moved) heat.set(i, 0);
    }
    if (sim.pendingCount === 0 && burst) {
      debug.log(`Terreno estable: ${burst.moved} movimientos de celda en ${burst.steps} pasos (${burst.ms.toFixed(1)} ms de simulación)`);
      burst = null;
    }
  }

  // dibuja el modo simulación: magenta = celdas que se movieron hace poco, celeste = chunks simulados
  function drawSimView(dt) {
    simGfx.clear();
    const fresh = [], mid = [], old = [];
    for (const [i, age] of heat) {
      const a = age + dt;
      if (a > 0.5) { heat.delete(i); continue; }
      heat.set(i, a);
      (a < 0.15 ? fresh : a < 0.3 ? mid : old).push(i);
    }
    const paint = (list, alpha) => {
      if (!list.length) return;
      for (const i of list) {
        const x = i % COLS;
        simGfx.rect(x * CELL, ((i - x) / COLS) * CELL, CELL, CELL);
      }
      simGfx.fill({ color: 0xff2bd6, alpha });
    };
    paint(old, 0.25);
    paint(mid, 0.55);
    paint(fresh, 0.9);

    if (playTime - lastActiveTime < 0.25) {
      for (const c of lastActiveChunks) {
        simGfx.rect((c % CHUNKS_X) * CHUNK * CELL, Math.floor(c / CHUNKS_X) * CHUNK * CELL, CHUNK * CELL, CHUNK * CELL);
      }
      simGfx.stroke({ width: 1, color: 0x2ee6ff, alpha: 0.7 });
    }
  }

  // ---------- Teclas de la partida ----------
  function onKey(e) {
    if (e.target instanceof HTMLInputElement || e.repeat || paused) return;

    if (e.code === 'KeyR') {
      // prueba de persistencia: seed + delta debe dar exactamente el mundo actual
      const fresh = generateWorld(seed);
      applyDelta(fresh, delta);
      let diff = 0;
      for (let i = 0; i < fresh.length; i++) if (fresh[i] !== world[i]) diff++;
      console.log('Celdas distintas entre mundo actual y seed + delta:', diff);
      debug.log(`Persistencia (R): seed + delta vs mundo actual = ${diff} celdas distintas`);
      world.set(fresh);
      chunks.markAllDirty();
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
    } else if (e.code === 'KeyE') {
      if (panel.isOpen) panel.close();
      else if (near) panel.open();
      else say('Acercate a la tienda para abrirla', 1.5);
    } else if (e.code === 'Digit0') {
      panel.sellAll();
    } else if (/^Digit[1-9]$/.test(e.code)) {
      panel.buy(Number(e.code.slice(5)) - 1);
    }
  }
  window.addEventListener('keydown', onKey);

  hudEl.style.display = 'block';

  // ---------- Datos del panel de debug ----------
  const debugInfo = () => {
    const pcx = Math.floor((player.x + player.w / 2) / CELL);
    const pcy = Math.floor((player.y + player.h / 2) / CELL);
    const inWorld = tcx >= 0 && tcy >= 0 && tcx < COLS && tcy < ROWS;
    const mouseType = inWorld ? world[tcy * COLS + tcx] : 0;
    const mouseBiome = inWorld ? BIOME_NAMES[biomes[tcy * COLS + tcx]] : '-';
    let deltaCells = 0;
    for (const m of delta.values()) deltaCells += m.size;
    const ss = sim.stats;
    return [
      `Seed: ${seed}   Mundo ${SIZES[sizeKey].name}: ${COLS}x${ROWS} celdas (${CHUNKS_X}x${CHUNKS_Y} chunks de ${CHUNK})`,
      `Jugador: celda (${pcx}, ${pcy})  vel (${Math.round(player.vx)}, ${Math.round(player.vy)}) px/s`,
      `  suelo: ${player.onGround ? 'sí' : 'no'}  vuelo: ${player.flying ? 'sí' : 'no'}  combustible: ${player.fuel.toFixed(0)}/${player.fuelMax}`,
      `  chunk: #${chunkIndexOf(pcx, pcy)}`,
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
    updateCamera(worldLayer, app.screen, player);

    // aviso al quedarse sin combustible o al intentar volar con el tanque vacío
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
    chunks.updateVisibility(camX, camY, app.screen.width, app.screen.height);

    // mouse en coordenadas del mundo
    tcx = Math.floor((input.mouseX + camX) / CELL);
    tcy = Math.floor((input.mouseY + camY) / CELL);
    const pcx = player.x + player.w / 2;
    const pcy = player.y + player.h / 2;
    inReach = Math.hypot((tcx + 0.5) * CELL - pcx, (tcy + 0.5) * CELL - pcy) <= DIG_REACH * CELL;

    // forma del golpe: la vista previa muestra exactamente las celdas que va a romper
    const radius = digRadius(stats);
    const cells = shapeCells(stats.shape, tcx, tcy, radius, Math.floor(pcx / CELL), Math.floor(pcy / CELL));
    const usable = stats.shape === 'cone' || inReach; // el cono sale del jugador y no necesita alcance

    updatePlayerSprite(playerSprite, player, input.mouseX + camX, input.mouseDown && usable, stats.levels, dt);

    // humo del jetpack mientras vuela
    if (player.flying) {
      smokeTimer -= dt;
      if (smokeTimer <= 0) {
        const nozzle = playerSprite.getNozzlePos();
        effects.spawnJetpackSmoke(nozzle.x, nozzle.y);
        smokeTimer = 0.04;
      }
    }

    preview.clear();
    for (const i of cells) {
      const x = i % COLS;
      preview.rect(x * CELL, ((i - x) / COLS) * CELL, CELL, CELL);
    }
    if (cells.length) preview.fill({ color: 0xffffff, alpha: usable ? 0.28 : 0.1 });

    // click izquierdo: cavar. Click derecho: dinamita
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

    // simulación a paso fijo (máximo 2 pasos por frame para no trabar el juego)
    simAcc += dt;
    let simRuns = 0;
    while (simAcc >= SIM_STEP && simRuns < 2) {
      simAcc -= SIM_STEP;
      simRuns++;
      runSimStep();
    }
    if (simAcc > SIM_STEP) simAcc = 0;

    // en la tienda: depositar la mochila en el almacén y llenar el combustible
    near = Math.hypot(pcx - shopX, pcy - shopY) <= SELL_RANGE * CELL;
    if (near) {
      player.fuel = player.fuelMax;
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
        floatingTexts.spawn(shopX, shopY - 26, `+${n} al almacén ($${val})`, 0x7ae582);
        debug.log(`Depósito: ${n} minerales (almacén ${stashCount(stats)}, vale $${stashValue(stats)})`);
        panel.render();
      }
    } else if (panel.isOpen) {
      panel.close();
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

    // redibujar solo los chunks modificados y repintarlos en el minimapa
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
    minimap.reveal(Math.floor(pcx / CELL), Math.floor(pcy / CELL));
    minimap.draw({
      player, camX, camY,
      screenW: app.screen.width, screenH: app.screen.height,
      shopCol: spawnCol, shopRow: startRow, goalRow,
    });

    // meta
    const depth = Math.max(0, Math.floor((player.y + player.h - startY) / CELL));
    if (!won && depth >= GOAL) {
      won = true;
      showBanner(`¡Llegaste a ${GOAL} m en ${mmss(playTime)}! Podés seguir explorando`);
      debug.log(`Meta alcanzada en ${mmss(playTime)}`);
    }

    // HUD (solo se toca el DOM si el contenido cambió)
    msgTimer -= dt;
    if (msgTimer <= 0) msg = '';
    bannerTimer -= dt;
    if (bannerTimer <= 0) bannerEl.style.display = 'none';
    const bag = Object.keys(cargo).filter((t) => cargo[t] > 0).map((t) => `${ORE_NAME[t]} ${cargo[t]}`).join(' · ');
    const fuelPct = Math.max(0, Math.min(100, (player.fuel / player.fuelMax) * 100));
    const fuelCur = Math.ceil(player.fuel);
    const fuelLow = fuelPct <= 25;
    const fuelEmpty = fuelCur <= 0;
    const pbx = Math.floor(pcx / CELL);
    const pby = Math.floor(pcy / CELL);
    const biome = pbx >= 0 && pby >= 0 && pbx < COLS && pby < ROWS ? BIOME_NAMES[biomes[pby * COLS + pbx]] : '-';

    const lines = [
      `<div class="hud-line">Seed: ${seed} · ${SIZES[sizeKey].name}</div>`,
      `<div class="hud-line">Bioma: ${biome}</div>`,
      `<div class="hud-line">Profundidad: ${depth} m de ${GOAL} m${won ? ' (lograda)' : ''}</div>`,
      `<div class="hud-line">Tiempo: ${mmss(playTime)}</div>`,
      `<div class="hud-line">Dinero: $${stats.money}</div>`,
      `<div class="hud-line">Almacén: ${stashCount(stats)} minerales ($${stashValue(stats)})</div>`,
      `<div class="hud-line">Mochila (${cargoTotal()}/${bagMax(stats)}): ${bag || 'vacía'}</div>`,
      `<div class="fuel-row">` +
        `<span>Combustible:</span>` +
        `<div class="fuel-track${fuelEmpty ? ' empty' : ''}">` +
          `<div class="fuel-fill${fuelLow ? ' low' : ''}" style="width:${fuelPct.toFixed(1)}%"></div>` +
          `<span class="fuel-val">${fuelEmpty ? 'VACÍO' : `${fuelCur}/${player.fuelMax}`}</span>` +
        `</div>` +
      `</div>`,
      `<div class="hud-line">Dinamita: ${stats.dynamite}</div>`,
      availableShapes(stats).length > 1 ? `<div class="hud-line">Forma: ${SHAPE_NAMES[stats.shape]} (Q cambia)</div>` : '',
      laserPierce(stats) > 0 ? `<div class="hud-line">Láser: F (rompe ${laserPierce(stats)} celdas)</div>` : '',
      near ? `<div class="hud-line">Apretá E para vender y mejorar</div>` : '',
      msg ? `<div class="${fuelEmpty ? 'hud-warn' : 'hud-msg'}">${msg}</div>` : '',
    ].filter(Boolean).join('');

    if (lines !== lastHud) { hudEl.innerHTML = lines; lastHud = lines; }

    debug.frame(dt, debugInfo);

    // temblor de cámara por explosiones (se aplica al final para no afectar el cálculo del mouse)
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

// ---------- Menú ----------
function play() {
  if (currentGame) return;
  const seed = seedFromText(seedInput.value);
  const sizeKey = sizeSelect.value || 'medium';
  seedInput.blur();
  menuEl.style.display = 'none';
  currentGame = startGame(seed, sizeKey);
}

function restartGame(seed, sizeKey) {
  if (currentGame) {
    currentGame.stop();
    currentGame = null;
  }
  currentGame = startGame(seed, sizeKey);
}

function backToMenu() {
  lastSeedEl.textContent = `Última seed: ${currentGame.seed}`;
  currentGame.stop();
  currentGame = null;
  menuEl.style.display = 'flex';
}

async function init() {
  app = new PIXI.Application();
  await app.init({ resizeTo: window, background: '#78b9e8', antialias: false });
  document.getElementById('app').appendChild(app.canvas);

  playBtn.addEventListener('click', play);
  seedInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') play(); });
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || !currentGame) return;
    if (currentGame.closePanel()) return; // Esc primero cierra la tienda
    currentGame.togglePause();
  });
}

init();