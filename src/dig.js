import {
  COLS, ROWS, CHUNK, AIR, SAND, HARDNESS, LOOSE, SPAN_BY_HARDNESS,
} from './config.js';
import { chunkIndexOf, CHUNKS_X, CHUNKS_Y } from './chunks.js';

// ---------- Delta: lo que cambió respecto al mundo generado con la seed ----------
// delta = Map( chunk -> Map( índice de celda -> tipo nuevo ) )
function recordDelta(delta, chunk, i, type) {
  let m = delta.get(chunk);
  if (!m) { m = new Map(); delta.set(chunk, m); }
  m.set(i, type);
}

// Reaplica sobre un mundo recién generado todo lo que cambió (cavado, explosiones y caídas)
export function applyDelta(world, delta) {
  for (const m of delta.values()) {
    for (const [i, type] of m) world[i] = type;
  }
}

// ---------- Cavar (Unidad 7) ----------
// Vacía las celdas dentro de un círculo centrado en la celda (cx, cy) (máscara de sustracción).
// - power: dureza máxima que se puede romper. Lo más duro queda intacto y se cuenta en "blocked".
// - onBreak(x, y, tipo): se llama por cada celda rota (la usan las partículas).
// Devuelve { broken: {tipo: cantidad}, count, blocked }.
export function dig(world, delta, chunks, cx, cy, radius, power, onBreak) {
  const broken = {};
  let count = 0;
  let blocked = 0;
  const r = Math.ceil(radius);
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > radius * radius) continue;

      const i = y * COLS + x;
      const type = world[i];
      if (type === AIR) continue;
      if (HARDNESS[type] > power) { blocked++; continue; }

      broken[type] = (broken[type] || 0) + 1;
      count++;
      world[i] = AIR;

      const c = chunkIndexOf(x, y);
      recordDelta(delta, c, i, AIR);
      chunks.markDirty(c);

      if (onBreak) onBreak(x, y, type);
    }
  }
  return { broken, count, blocked };
}

// ---------- Simulación del terreno (autómata celular) ----------
// Reglas locales sobre la grilla, revisadas solo en los chunks "activos":
//  1. Arena y grava: si abajo hay aire, caen una celda por paso.
//     La arena además se desliza en diagonal (se desparrama); la grava solo cae derecho.
//  2. Derrumbes: una celda de material flojo (SPAN_BY_HARDNESS) con aire debajo forma, con sus
//     vecinas de la fila, un "tramo sin apoyo". Si el tramo es más ancho de lo que aguanta ese
//     material, cae. Lo duro (piedra, granito, plataforma) nunca se derrumba.
// Todo movimiento mueve una celda hacia abajo, así que siempre termina por asentarse.

const LOOSE_SET = new Set(LOOSE);
const MAX_RUN = 40;

// tipos de celda según su apoyo (los usa kind)
const GAP = 0;     // aire, o algo flojo que está cayendo
const ANCHOR = 1;  // algo firme: duro, o flojo pero apoyado
const HANG = 2;    // material de derrumbe con aire debajo

export function createSim(world, delta, chunks) {
  let pending = new Set(); // chunks que se revisan en el próximo paso
  let tick = 0;
  let moved = [];          // celdas (destino) que se movieron en el último paso
  let lastActive = [];     // chunks revisados en el último paso
  const stats = { steps: 0, activeChunks: 0, examined: 0, moved: 0, ms: 0, totalMoved: 0 };

  let occupied = null;     // celdas ocupadas por el jugador: nada puede caer ahí
  let blockedFlag = false;

  // despierta el chunk de una celda y sus vecinos (el apoyo cruza los bordes de chunk)
  function touch(i) {
    const x = i % COLS;
    const y = (i - x) / COLS;
    const cx = Math.floor(x / CHUNK);
    const cy = Math.floor(y / CHUNK);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx >= 0 && ny >= 0 && nx < CHUNKS_X && ny < CHUNKS_Y) pending.add(ny * CHUNKS_X + nx);
      }
    }
  }

  function setCell(i, type) {
    world[i] = type;
    const x = i % COLS;
    const c = chunkIndexOf(x, (i - x) / COLS);
    recordDelta(delta, c, i, type);
    chunks.markDirty(c);
  }

  // mueve la celda i a la celda j (que está vacía)
  function move(i, j) {
    setCell(j, world[i]);
    setCell(i, AIR);
    moved.push(j);
    touch(i);
    touch(j);
  }

  function canEnter(x, y) {
    if (x < 0 || x >= COLS || y >= ROWS) return false;
    const j = y * COLS + x;
    if (world[j] !== AIR) return false;
    if (occupied && occupied.has(j)) { blockedFlag = true; return false; }
    return true;
  }

  function kind(x, y) {
    if (x < 0 || x >= COLS) return ANCHOR;  // los bordes del mapa sostienen
    if (y < 0) return GAP;
    if (y >= ROWS) return ANCHOR;
    const t = world[y * COLS + x];
    if (t === AIR) return GAP;
    const loose = LOOSE_SET.has(t);
    if (!loose && SPAN_BY_HARDNESS[HARDNESS[t]] === undefined) return ANCHOR; // material duro
    if (y + 1 >= ROWS || world[(y + 1) * COLS + x] !== AIR) return ANCHOR;    // apoyado
    return loose ? GAP : HANG;
  }

  // ¿aguanta el tramo a..b de la fila y?
  function holds(a, b, y) {
    let span = Infinity;
    for (let x = a; x <= b; x++) {
      span = Math.min(span, SPAN_BY_HARDNESS[HARDNESS[world[y * COLS + x]]]);
    }
    const L = b - a + 1;
    const left = kind(a - 1, y) === ANCHOR;
    const right = kind(b + 1, y) === ANCHOR;
    if (left && right) return L <= span;                           // apoyado de los dos lados
    if (left || right) return L <= Math.max(1, Math.floor(span / 2)); // en voladizo
    return false;                                                  // flotando
  }

  // un paso de simulación; occ = Set de celdas ocupadas por el jugador (opcional)
  function step(occ) {
    const t0 = performance.now();
    occupied = occ || null;
    tick++;

    // de abajo hacia arriba por chunk, así una celda no se mueve dos veces en el mismo paso
    const list = [...pending].sort((a, b) => b - a);
    pending = new Set();
    moved = [];
    let examined = 0;

    for (const c of list) {
      blockedFlag = false;
      const x0 = (c % CHUNKS_X) * CHUNK;
      const y0 = Math.floor(c / CHUNKS_X) * CHUNK;
      const xEnd = x0 + CHUNK - 1;

      for (let y = y0 + CHUNK - 1; y >= y0; y--) {
        // 1) arena y grava (el sentido de la fila se alterna para que no se corran siempre al mismo lado)
        const ltr = ((tick + y) & 1) === 0;
        for (let k = 0; k < CHUNK; k++) {
          const x = ltr ? x0 + k : xEnd - k;
          const i = y * COLS + x;
          const t = world[i];
          if (!LOOSE_SET.has(t)) continue;
          examined++;
          if (canEnter(x, y + 1)) { move(i, i + COLS); continue; }
          if (t === SAND) {
            const d = ((x + tick) & 1) ? 1 : -1;
            if (canEnter(x + d, y + 1)) move(i, i + COLS + d);
            else if (canEnter(x - d, y + 1)) move(i, i + COLS - d);
          }
        }

        // 2) derrumbes: tramos de la fila sin apoyo suficiente
        let x = x0;
        while (x <= xEnd) {
          if (kind(x, y) !== HANG) { x++; continue; }
          let a = x;
          while (a > 0 && x - a < MAX_RUN && kind(a - 1, y) === HANG) a--;
          let b = x;
          while (b < COLS - 1 && b - a < MAX_RUN && kind(b + 1, y) === HANG) b++;
          const end = Math.min(b, xEnd);
          examined += end - x + 1;
          if (!holds(a, b, y)) {
            for (let xx = x; xx <= end; xx++) {
              if (canEnter(xx, y + 1)) { const i = y * COLS + xx; move(i, i + COLS); }
            }
          }
          x = end + 1;
        }
      }

      // si el jugador tapó el camino, el chunk sigue activo hasta que se mueva
      if (blockedFlag) pending.add(c);
    }

    lastActive = list;
    stats.steps++;
    stats.activeChunks = list.length;
    stats.examined = examined;
    stats.moved = moved.length;
    stats.totalMoved += moved.length;
    stats.ms = performance.now() - t0;
  }

  return {
    stats,
    step,
    get moved() { return moved; },
    get lastActive() { return lastActive; },
    get pendingCount() { return pending.size; },

    // despierta los chunks que tocan el rectángulo de celdas (después de cavar o explotar)
    wakeRect(x0, y0, x1, y1) {
      const cx0 = Math.max(0, Math.floor(x0 / CHUNK) - 1);
      const cx1 = Math.min(CHUNKS_X - 1, Math.floor(x1 / CHUNK) + 1);
      const cy0 = Math.max(0, Math.floor(y0 / CHUNK) - 1);
      const cy1 = Math.min(CHUNKS_Y - 1, Math.floor(y1 / CHUNK) + 1);
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) pending.add(cy * CHUNKS_X + cx);
      }
    },
  };
}