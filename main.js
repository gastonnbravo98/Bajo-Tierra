import {
  CELL, COLS, ROWS, CHUNK, NAMES, HARDNESS, COLORS, ORE_VALUE, ORE_NAME,
  DIG_REACH, DIG_DELAY, SELL_RANGE, DYNAMITE, GOAL_DEPTH, SIM_HZ,
} from './src/config.js';
import { seedFromText } from './src/random.js';
import { generateWorld } from './src/worldgen.js';
import {
  createPlayerSprite, createShop, createBackground, createBomb, createGoalLine,
} from './src/render.js';
import { createPlayer, updatePlayer } from './src/player.js';
import { updateCamera } from './src/camera.js';
import { createChunks, chunkIndexOf, CHUNKS_X, CHUNKS_Y } from './src/chunks.js';
import { dig, applyDelta, createSim } from './src/dig.js';
import { createMinimap } from './src/minimap.js';
import { createParticles } from './src/particles.js';
import {
  createStats, createShopPanel, digRadius, digPower, fuelMax, bagMax,
} from './src/shop.js';
import { createDebug, mmss } from './src/debug.js';
import { input } from './src/input.js';

const menuEl = document.getElementById('menu');
const seedInput = document.getElementById('seed-input');
const playBtn = document.getElementById('play-btn');
const lastSeedEl = document.getElementById('last-seed');
const hudEl = document.getElementById('hud');
const debugEl = document.getElementById('debug');
const shopEl = document.getElementById('shop');
const bannerEl = document.getElementById('banner');

let app;
let currentGame = null;
let debugOn = false; // se mantiene al volver al menú y jugar de nuevo

// ---------- Una partida ----------
function startGame(seed) {
  const debug = createDebug(debugEl, debugOn);

  const tGen = performance.now();
  const world = generateWorld(seed);
  debug.log(`Mundo generado (seed ${seed}) en ${(performance.now() - tGen).toFixed(0)} ms`);

  const delta = new Map(); // chunk -> Map(celda -> tipo nuevo): todo lo que cambió respecto de la seed
  const stats = createStats();

  const worldLayer = new PIXI.Container();
  app.stage.addChild(worldLayer);
  worldLayer.addChild(createBackground(world));

  const chunks = createChunks(world);
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
  const goalRow = startRow + GOAL_DEPTH;
  const spawnCol = Math.floor((player.x + player.w / 2) / CELL);

  worldLayer.addChild(createGoalLine(goalRow * CELL));

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

  const particles = createParticles();
  worldLayer.addChild(particles.layer);

  // círculo que muestra dónde se va a cavar (su radio crece con las mejoras)
  const cursor = new PIXI.Graphics();
  worldLayer.addChild(cursor);
  let cursorRadius = 0;
  function drawCursor() {
    cursor.clear();
    cursor.circle(0, 0, cursorRadius * CELL).stroke({ width: 2, color: 0xffffff });
  }

  const minimap = createMinimap(world);

  // mochila: una cuenta por cada tipo de mineral
  const cargo = {};
  for (const t of Object.keys(ORE_VALUE)) cargo[t] = 0;
  const cargoTotal = () => Object.values(cargo).reduce((a, b) => a + b, 0);

  // estado de la partida
  let msg = '';
  let msgTimer = 0;
  let bannerTimer = 0;
  let digTimer = 0;
  let lastHud = '';
  let playTime = 0;
  let won = false;
  let shake = 0;
  let near = false;             // ¿el jugador está cerca de la tienda?
  let actionText = '';          // se completa con el redibujo y va al registro de debug
  let rebuiltTotal = 0;
  let lastRebuild = { n: 0, ms: 0 };
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

  const panel = createShopPanel(shopEl, stats, (text) => {
    say(text);
    debug.log(text);
  });

  // ---------- Cavar y explotar (Unidad 7) ----------
  // guarda en la mochila lo que entre; el resto se pierde
  function collect(broken) {
    let free = bagMax(stats) - cargoTotal();
    let lost = 0;
    for (const t in broken) {
      if (!(t in cargo)) continue;
      const take = Math.min(broken[t], Math.max(0, free));
      cargo[t] += take;
      free -= take;
      lost += broken[t] - take;
    }
    if (lost > 0) say(`¡Mochila llena! Se perdieron ${lost} minerales`, 2);
  }

  function applyDig(cx, cy, radius, power, kind) {
    const t = performance.now();
    const isBomb = kind === 'bomb';
    const res = dig(world, delta, chunks, cx, cy, radius, power, (x, y, type) => {
      if (Math.random() < 0.55) {
        particles.spawn((x + 0.5) * CELL, (y + 0.5) * CELL, COLORS[type], 1, isBomb ? 1.8 : 1);
      }
    });
    const ms = performance.now() - t;
    collect(res.broken);
    const R = Math.ceil(radius) + 1;
    sim.wakeRect(cx - R, cy - R, cx + R, cy + R); // el terreno de alrededor puede perder apoyo

    if (res.count === 0 && res.blocked > 0) {
      const under = cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS ? world[cy * COLS + cx] : 0;
      if ((HARDNESS[under] ?? 0) >= 99) say('Eso no se puede romper', 1.5);
      else say('Material muy duro: necesitás el pico de acero', 1.5);
    }

    if (res.count > 0 || res.blocked > 0) {
      const parts = Object.entries(res.broken).map(([type, n]) => `${NAMES[type]} ${n}`).join(', ');
      actionText =
        `${isBomb ? 'Explosión' : 'Cavó'} en (${cx}, ${cy}): ${res.count} celdas` +
        (parts ? ` [${parts}]` : '') +
        (res.blocked ? `, ${res.blocked} bloqueadas` : '') +
        ` en ${ms.toFixed(2)} ms`;
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
    debug.log(`Dinamita colocada en (${cx}, ${cy}), explota en ${DYNAMITE.fuse} s`);
  }

  function updateBombs(dt) {
    for (let i = bombs.length - 1; i >= 0; i--) {
      const b = bombs[i];
      b.t -= dt;
      b.g.alpha = Math.sin(b.t * 18) > 0 ? 1 : 0.4; // parpadea
      if (b.t > 0) continue;

      const x = (b.cx + 0.5) * CELL;
      const y = (b.cy + 0.5) * CELL;
      applyDig(b.cx, b.cy, DYNAMITE.radius, DYNAMITE.power, 'bomb');
      particles.spawn(x, y, 0xff9f1c, 30, 2.2); // fuego
      particles.spawn(x, y, 0xffe066, 15, 1.6);
      shake = 9;
      b.g.destroy();
      bombs.splice(i, 1);
    }
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
    if (e.target instanceof HTMLInputElement || e.repeat) return;

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
      const big = minimap.toggleSize();
      debug.log(`Minimapa ${big ? 'grande' : 'normal'}`);
    } else if (e.code === 'KeyE') {
      if (panel.isOpen) panel.close();
      else if (near) panel.open();
      else say('Acercate a la tienda para abrirla', 1.5);
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
    let deltaCells = 0;
    for (const m of delta.values()) deltaCells += m.size;
    const ss = sim.stats;
    return [
      `Seed: ${seed}   Mundo: ${COLS}x${ROWS} celdas (${CHUNKS_X}x${CHUNKS_Y} chunks de ${CHUNK})`,
      `Jugador: celda (${pcx}, ${pcy})  vel (${Math.round(player.vx)}, ${Math.round(player.vy)}) px/s`,
      `  suelo: ${player.onGround ? 'sí' : 'no'}  vuelo: ${player.flying ? 'sí' : 'no'}  combustible: ${player.fuel.toFixed(0)}/${player.fuelMax}`,
      `  chunk: #${chunkIndexOf(pcx, pcy)}`,
      `Mouse: celda (${tcx}, ${tcy})  ${NAMES[mouseType]}  dureza ${HARDNESS[mouseType] ?? 0}  ${inReach ? 'al alcance' : 'lejos'}`,
      `Chunks visibles: ${chunks.visibleCount} de ${chunks.total}   redibujos totales: ${rebuiltTotal}`,
      `Último redibujo: ${lastRebuild.n} chunk(s) en ${lastRebuild.ms.toFixed(2)} ms`,
      `Delta: ${deltaCells} celdas cambiadas en ${delta.size} chunk(s)`,
      `Simulación: ${ss.steps} pasos, chunks activos ${ss.activeChunks}, revisadas ${ss.examined}, movidas ${ss.moved}, ${ss.ms.toFixed(2)} ms`,
      `  pendientes ${sim.pendingCount} chunk(s), movidas en total ${ss.totalMoved}, modo visual (V): ${simView ? 'sí' : 'no'}`,
      `Dinamitas activas: ${bombs.length}   partículas: ${particles.count}`,
      `Pico: radio ${digRadius(stats)}, poder ${digPower(stats)}   mochila ${cargoTotal()}/${bagMax(stats)}`,
    ];
  };

  // ---------- Un frame ----------
  const tick = (ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 1 / 30);
    playTime += dt;

    player.fuelMax = fuelMax(stats);
    updatePlayer(world, player, input, dt);
    playerSprite.position.set(player.x, player.y);
    flame.visible = player.flying;
    flame.position.set(player.x + player.w * 0.25, player.y + player.h);
    updateCamera(worldLayer, app.screen, player);

    const camX = -worldLayer.x;
    const camY = -worldLayer.y;
    chunks.updateVisibility(camX, camY, app.screen.width, app.screen.height);

    // mouse en coordenadas del mundo
    tcx = Math.floor((input.mouseX + camX) / CELL);
    tcy = Math.floor((input.mouseY + camY) / CELL);
    const targetX = (tcx + 0.5) * CELL;
    const targetY = (tcy + 0.5) * CELL;
    const pcx = player.x + player.w / 2;
    const pcy = player.y + player.h / 2;
    inReach = Math.hypot(targetX - pcx, targetY - pcy) <= DIG_REACH * CELL;

    const radius = digRadius(stats);
    if (radius !== cursorRadius) { cursorRadius = radius; drawCursor(); }
    cursor.position.set(targetX, targetY);
    cursor.alpha = inReach ? 0.9 : 0.25;

    // click izquierdo: cavar. Click derecho: dinamita
    digTimer -= dt;
    if (input.mouseDown && inReach && digTimer <= 0) {
      applyDig(tcx, tcy, radius, digPower(stats), 'dig');
      digTimer = DIG_DELAY;
    }
    if (input.consumeRight()) {
      if (inReach) plantBomb(tcx, tcy);
      else say('Muy lejos para colocar dinamita', 1.5);
    }
    updateBombs(dt);

    // simulación a paso fijo (máximo 2 pasos por frame para no trabar el juego)
    simAcc += dt;
    let simRuns = 0;
    while (simAcc >= SIM_STEP && simRuns < 2) {
      simAcc -= SIM_STEP;
      simRuns++;
      runSimStep();
    }
    if (simAcc > SIM_STEP) simAcc = 0;

    // en la tienda: vender todo y llenar el combustible
    near = Math.hypot(pcx - shopX, pcy - shopY) <= SELL_RANGE * CELL;
    if (near) {
      player.fuel = player.fuelMax;
      let earned = 0;
      for (const t in cargo) { earned += cargo[t] * ORE_VALUE[t]; cargo[t] = 0; }
      if (earned > 0) {
        stats.money += earned;
        say(`¡Vendiste todo por $${earned}!`);
        debug.log(`Venta: $${earned} (dinero $${stats.money})`);
        panel.render();
      }
    } else if (panel.isOpen) {
      panel.close();
    }

    particles.update(dt);
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
    if (!won && depth >= GOAL_DEPTH) {
      won = true;
      showBanner(`¡Llegaste a ${GOAL_DEPTH} m en ${mmss(playTime)}! Podés seguir explorando`);
      debug.log(`Meta alcanzada en ${mmss(playTime)}`);
    }

    // HUD (solo se toca el DOM si el texto cambió)
    msgTimer -= dt;
    if (msgTimer <= 0) msg = '';
    bannerTimer -= dt;
    if (bannerTimer <= 0) bannerEl.style.display = 'none';
    const bag = Object.keys(cargo).map((t) => `${ORE_NAME[t]} ${cargo[t]}`).join(' · ');
    const bars = Math.round((player.fuel / player.fuelMax) * 10);
    const fuelBar = '█'.repeat(bars) + '░'.repeat(10 - bars);
    const hud = [
      `Seed: ${seed}`,
      `Profundidad: ${depth} m de ${GOAL_DEPTH} m${won ? ' (lograda)' : ''}`,
      `Tiempo: ${mmss(playTime)}`,
      `Dinero: $${stats.money}`,
      `Mochila (${cargoTotal()}/${bagMax(stats)}): ${bag}`,
      `Combustible: ${fuelBar}`,
      `Dinamita: ${stats.dynamite}`,
      near ? 'Apretá E para abrir la tienda' : '',
      msg,
    ].filter(Boolean).join('\n');
    if (hud !== lastHud) { hudEl.textContent = hud; lastHud = hud; }

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
    stop() {
      app.ticker.remove(tick);
      window.removeEventListener('keydown', onKey);
      app.stage.removeChild(worldLayer);
      worldLayer.destroy({ children: true });
      minimap.destroy();
      panel.close();
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
  await app.init({ resizeTo: window, background: '#78b9e8', antialias: false });
  document.getElementById('app').appendChild(app.canvas);

  playBtn.addEventListener('click', play);
  seedInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') play(); });
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || !currentGame) return;
    if (currentGame.closePanel()) return; // Esc primero cierra la tienda
    backToMenu();
  });
}

init();