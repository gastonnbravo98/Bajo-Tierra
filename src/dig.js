import {
  COLS, ROWS, CHUNK, AIR, SAND, HARDNESS, LOOSE, SPAN_BY_HARDNESS, IS_INFINITE,
} from './config.js';
import { chunkIndexOf, CHUNKS_X, CHUNKS_Y } from './chunks.js';
import { chunkKey } from './world.js';

// ---------- Delta: Map( chunkId -> Map( localIdx (0..255) -> type ) ) ----------
function localIndex(x, y) {
  const cx = Math.floor(x / CHUNK);
  const cy = Math.floor(y / CHUNK);
  return (y - cy * CHUNK) * CHUNK + (x - cx * CHUNK);
}

function recordDelta(delta, chunkId, x, y, type) {
  let m = delta.get(chunkId);
  if (!m) { m = new Map(); delta.set(chunkId, m); }
  m.set(localIndex(x, y), type);
}

export function applyDelta(world, delta) {
  for (const [chunkId, m] of delta) {
    let chx, chy;
    if (typeof chunkId === 'string') {
      [chx, chy] = chunkId.split(',').map(Number);
    } else {
      chx = chunkId % CHUNKS_X;
      chy = Math.floor(chunkId / CHUNKS_X);
    }
    const x0 = chx * CHUNK;
    const y0 = chy * CHUNK;
    for (const [loc, type] of m) {
      const lx = loc % CHUNK;
      const ly = (loc - lx) / CHUNK;
      world.set(x0 + lx, y0 + ly, type);
    }
  }
}

// ---------- Formas del golpe (devuelve pares [x, y]) ----------
const COS_CONE = Math.cos((30 * Math.PI) / 180);

export function shapeCells(shape, cx, cy, radius, px, py) {
  const cells = [];
  const add = (x, y) => {
    if (y < 0) return;
    if (!IS_INFINITE && (x < 0 || x >= COLS || y >= ROWS)) return;
    cells.push([x, y]);
  };

  if (shape === 'cross') {
    const arm = Math.ceil(radius * 2);
    for (let k = -arm; k <= arm; k++) { add(cx + k, cy); if (k !== 0) add(cx, cy + k); }
  } else if (shape === 'drill') {
    const len = Math.ceil(radius * 4);
    for (let k = 0; k < len; k++) add(cx, cy + k);
  } else if (shape === 'cone') {
    const dx = cx - px;
    const dy = cy - py;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const len = 2 + radius * 2;
    const r = Math.ceil(len);
    for (let y = py - r; y <= py + r; y++) {
      for (let x = px - r; x <= px + r; x++) {
        const vx = x - px;
        const vy = y - py;
        const dist = Math.hypot(vx, vy);
        if (dist < 0.9 || dist > len) continue;
        if ((vx * ux + vy * uy) / dist >= COS_CONE) add(x, y);
      }
    }
  } else {
    const r = Math.ceil(radius);
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= radius * radius) add(x, y);
      }
    }
  }
  return cells;
}

export function cellsBounds(cells) {
  if (!cells.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of cells) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

function breakCell(world, delta, chunks, x, y, broken, onBreak) {
  const type = world.get(x, y);
  broken[type] = (broken[type] || 0) + 1;
  world.set(x, y, AIR);
  const c = chunkIndexOf(x, y);
  recordDelta(delta, c, x, y, AIR);
  chunks.markDirty(c);
  if (onBreak) onBreak(x, y, type);
}

export function digCells(world, delta, chunks, cells, power, onBreak) {
  const broken = {};
  let count = 0;
  let blocked = 0;
  for (const [x, y] of cells) {
    const type = world.get(x, y);
    if (type === AIR) continue;
    if (HARDNESS[type] > power) { blocked++; continue; }
    breakCell(world, delta, chunks, x, y, broken, onBreak);
    count++;
  }
  return { broken, count, blocked };
}

export function dig(world, delta, chunks, cx, cy, radius, power, onBreak) {
  return digCells(world, delta, chunks, shapeCells('circle', cx, cy, radius), power, onBreak);
}

// ---------- Láser: raycasting DDA ----------
export function rayCells(ox, oy, dx, dy, maxDist) {
  const cells = [];
  let cx = Math.floor(ox);
  let cy = Math.floor(oy);
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const tDeltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
  const tDeltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
  let tMaxX = dx === 0 ? Infinity : (dx > 0 ? cx + 1 - ox : ox - cx) * tDeltaX;
  let tMaxY = dy === 0 ? Infinity : (dy > 0 ? cy + 1 - oy : oy - cy) * tDeltaY;

  while (cy >= 0 && (IS_INFINITE || (cx >= 0 && cx < COLS && cy < ROWS))) {
    cells.push([cx, cy]);
    const t = Math.min(tMaxX, tMaxY);
    if (t > maxDist) break;
    if (tMaxX < tMaxY) { cx += stepX; tMaxX += tDeltaX; }
    else { cy += stepY; tMaxY += tDeltaY; }
  }
  return cells;
}

export function laser(world, delta, chunks, ox, oy, dx, dy, pierce, range, power, onBreak) {
  const path = rayCells(ox, oy, dx, dy, range);
  const broken = {};
  const hitCells = [];
  let blocked = 0;
  let last = path.length ? path[path.length - 1] : [Math.floor(ox), Math.floor(oy)];
  for (const [x, y] of path) {
    const type = world.get(x, y);
    if (type === AIR) continue;
    if (HARDNESS[type] > power) { blocked++; last = [x, y]; break; }
    breakCell(world, delta, chunks, x, y, broken, onBreak);
    hitCells.push([x, y]);
    last = [x, y];
    if (hitCells.length >= pierce) break;
  }
  return { broken, count: hitCells.length, blocked, hitCells, last };
}

// ---------- Simulación del terreno (autómata celular) ----------
const LOOSE_SET = new Set(LOOSE);
const MAX_RUN = 40;
const GAP = 0;
const ANCHOR = 1;
const HANG = 2;

export function createSim(world, delta, chunks) {
  let pending = new Set(); // Set de chunkId (número en finito, "cx,cy" en infinito)
  let tick = 0;
  let moved = [];          // pares [x, y] movidos en el último paso
  let lastActive = [];
  const stats = { steps: 0, activeChunks: 0, examined: 0, moved: 0, ms: 0, totalMoved: 0 };

  let occupied = null;
  let blockedFlag = false;

  const cellKey = (x, y) => `${x},${y}`;

  function touch(x, y) {
    const cx = Math.floor(x / CHUNK);
    const cy = Math.floor(y / CHUNK);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (ny < 0) continue;
        if (!IS_INFINITE && (nx < 0 || nx >= CHUNKS_X || ny >= CHUNKS_Y)) continue;
        pending.add(IS_INFINITE ? chunkKey(nx, ny) : ny * CHUNKS_X + nx);
      }
    }
  }

  function setCell(x, y, type) {
    world.set(x, y, type);
    const c = chunkIndexOf(x, y);
    recordDelta(delta, c, x, y, type);
    chunks.markDirty(c);
  }

  function move(x0, y0, x1, y1) {
    setCell(x1, y1, world.get(x0, y0));
    setCell(x0, y0, AIR);
    moved.push([x1, y1]);
    touch(x0, y0);
    touch(x1, y1);
  }

  function canEnter(x, y) {
    if (y < 0) return false;
    if (!IS_INFINITE && (x < 0 || x >= COLS || y >= ROWS)) return false;
    if (world.get(x, y) !== AIR) return false;
    if (occupied && occupied.has(cellKey(x, y))) { blockedFlag = true; return false; }
    return true;
  }

  function kind(x, y) {
    if (!IS_INFINITE && (x < 0 || x >= COLS)) return ANCHOR;
    if (y < 0) return GAP;
    if (!IS_INFINITE && y >= ROWS) return ANCHOR;
    const t = world.get(x, y);
    if (t === AIR) return GAP;
    const loose = LOOSE_SET.has(t);
    if (!loose && SPAN_BY_HARDNESS[HARDNESS[t]] === undefined) return ANCHOR;
    if ((!IS_INFINITE && y + 1 >= ROWS) || world.get(x, y + 1) !== AIR) return ANCHOR;
    return loose ? GAP : HANG;
  }

  function holds(a, b, y) {
    let span = Infinity;
    for (let x = a; x <= b; x++) {
      span = Math.min(span, SPAN_BY_HARDNESS[HARDNESS[world.get(x, y)]]);
    }
    const L = b - a + 1;
    const left = kind(a - 1, y) === ANCHOR;
    const right = kind(b + 1, y) === ANCHOR;
    if (left && right) return L <= span;
    if (left || right) return L <= Math.max(1, Math.floor(span / 2));
    return false;
  }

  // activeBounds (opcional): { cx0, cx1, cy0, cy1 } ventana alrededor de la cámara
  function step(occ, activeBounds) {
    const t0 = performance.now();
    occupied = occ || null;
    tick++;

    const parseChunk = (id) => {
      if (typeof id === 'string') {
        const [cx, cy] = id.split(',').map(Number);
        return { id, cx, cy };
      }
      return { id, cx: id % CHUNKS_X, cy: Math.floor(id / CHUNKS_X) };
    };

    const all = [...pending].map(parseChunk);
    const toProcess = [];
    const deferred = new Set();

    for (const item of all) {
      if (activeBounds && (
        item.cx < activeBounds.cx0 || item.cx > activeBounds.cx1 ||
        item.cy < activeBounds.cy0 || item.cy > activeBounds.cy1
      )) {
        deferred.add(item.id); // fuera de la ventana 3x3: queda pendiente para cuando vuelvas
      } else {
        toProcess.push(item);
      }
    }

    // Ordenar de abajo hacia arriba (cy descendente)
    toProcess.sort((a, b) => b.cy - a.cy);
    pending = deferred;
    moved = [];
    let examined = 0;

    for (const { id, cx, cy } of toProcess) {
      blockedFlag = false;
      const x0 = cx * CHUNK;
      const y0 = cy * CHUNK;
      const xEnd = x0 + CHUNK - 1;

      for (let y = y0 + CHUNK - 1; y >= y0; y--) {
        const ltr = ((tick + y) & 1) === 0;
        for (let k = 0; k < CHUNK; k++) {
          const x = ltr ? x0 + k : xEnd - k;
          const t = world.get(x, y);
          if (!LOOSE_SET.has(t)) continue;
          examined++;
          if (canEnter(x, y + 1)) { move(x, y, x, y + 1); continue; }
          if (t === SAND) {
            const d = ((x + tick) & 1) ? 1 : -1;
            if (canEnter(x + d, y + 1)) move(x, y, x + d, y + 1);
            else if (canEnter(x - d, y + 1)) move(x, y, x - d, y + 1);
          }
        }

        let x = x0;
        while (x <= xEnd) {
          if (kind(x, y) !== HANG) { x++; continue; }
          let a = x;
          while ((IS_INFINITE || a > 0) && x - a < MAX_RUN && kind(a - 1, y) === HANG) a--;
          let b = x;
          while ((IS_INFINITE || b < COLS - 1) && b - a < MAX_RUN && kind(b + 1, y) === HANG) b++;
          const end = Math.min(b, xEnd);
          examined += end - x + 1;
          if (!holds(a, b, y)) {
            for (let xx = x; xx <= end; xx++) {
              if (canEnter(xx, y + 1)) move(xx, y, xx, y + 1);
            }
          }
          x = end + 1;
        }
      }

      if (blockedFlag) pending.add(id);
    }

    lastActive = toProcess.map((p) => p.id);
    stats.steps++;
    stats.activeChunks = toProcess.length;
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

    wakeRect(x0, y0, x1, y1) {
      const cx0 = Math.floor(x0 / CHUNK) - 1;
      const cx1 = Math.floor(x1 / CHUNK) + 1;
      const cy0 = Math.max(0, Math.floor(y0 / CHUNK) - 1);
      const cy1 = Math.floor(y1 / CHUNK) + 1;
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          if (!IS_INFINITE && (cx < 0 || cx >= CHUNKS_X || cy >= CHUNKS_Y)) continue;
          pending.add(IS_INFINITE ? chunkKey(cx, cy) : cy * CHUNKS_X + cx);
        }
      }
    },
  };
}