import {
  COLS, ROWS, CHUNK, AIR, LAVA, GAS, LOOSE, HARDNESS, IS_INFINITE, IS_HARD,
} from './config.js';
import { chunkIndexOf, CHUNKS_X, CHUNKS_Y } from './chunks.js';

function recordDelta(delta, x, y, type) {
  const ch = chunkIndexOf(x, y);
  let map = delta.get(ch);
  if (!map) {
    map = new Map();
    delta.set(ch, map);
  }
  map.set(`${x},${y}`, type);
}

function setCell(world, delta, chunks, x, y, type) {
  world.set(x, y, type);
  recordDelta(delta, x, y, type);
  chunks.markDirty(chunkIndexOf(x, y));
}

export function applyDelta(world, delta) {
  for (const map of delta.values()) {
    for (const [key, type] of map) {
      const [x, y] = key.split(',').map(Number);
      world.set(x, y, type);
    }
  }
}

export function cellsBounds(cells) {
  if (!cells.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of cells) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

export function shapeCells(shape, cx, cy, radius, px = cx, py = cy) {
  const out = [];
  const r = Math.ceil(radius);

  if (shape === 'cross') {
    for (let d = -r; d <= r; d++) {
      out.push([cx + d, cy]);
      if (d !== 0) out.push([cx, cy + d]);
    }
    return out;
  }

  if (shape === 'drill') {
    const depth = Math.max(3, Math.round(radius * 2.2));
    for (let dy = -1; dy <= depth; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        out.push([cx + dx, cy + dy]);
      }
    }
    return out;
  }

  if (shape === 'cone') {
    const dx0 = cx - px;
    const dy0 = cy - py;
    const len = Math.hypot(dx0, dy0);
    if (len < 0.01) return [[cx, cy]];
    const dirX = dx0 / len;
    const dirY = dy0 / len;
    const reach = Math.max(4, Math.round(radius * 3));
    const maxCos = Math.cos(0.45);
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const d = Math.hypot(dx, dy);
        if (d === 0 || d > reach) continue;
        const dot = (dx * dirX + dy * dirY) / d;
        if (dot >= maxCos) out.push([px + dx, py + dy]);
      }
    }
    return out;
  }

  // Por defecto: 'circle'
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (Math.hypot(dx, dy) <= radius) out.push([cx + dx, cy + dy]);
    }
  }
  return out;
}

export function requiredHits(type, power) {
  const hard = HARDNESS[type] ?? 0;
  if (hard > power) return Infinity;
  if (hard <= 2) return 1;
  return hard - 1;
}

export function digCells(world, delta, chunks, cells, power, onBreak) {
  let count = 0;
  let blocked = 0;
  const broken = {};

  for (const [x, y] of cells) {
    if (!world.inBounds(x, y)) continue;
    const type = world.get(x, y);
    if (type === AIR || type === LAVA || type === GAS) continue;

    const hard = HARDNESS[type] ?? 0;
    if (hard > power) {
      blocked++;
      continue;
    }

    setCell(world, delta, chunks, x, y, AIR);
    count++;
    broken[type] = (broken[type] || 0) + 1;
    onBreak?.(x, y, type);
  }

  return { count, blocked, broken };
}

export function digCellsWithProgress(world, delta, chunks, cells, power, progressMap, onBreak) {
  let count = 0;
  let blocked = 0;
  let damaged = 0;
  const broken = {};

  for (const [x, y] of cells) {
    if (!world.inBounds(x, y)) continue;
    const type = world.get(x, y);
    if (type === AIR || type === LAVA || type === GAS) continue;

    const needed = requiredHits(type, power);
    if (!Number.isFinite(needed)) {
      blocked++;
      continue;
    }

    const key = `${x},${y}`;
    if (needed <= 1) {
      progressMap?.delete(key);
      setCell(world, delta, chunks, x, y, AIR);
      count++;
      broken[type] = (broken[type] || 0) + 1;
      onBreak?.(x, y, type);
      continue;
    }

    const entry = progressMap.get(key) || { x, y, hits: 0, needed, age: 0 };
    entry.hits++;
    entry.needed = needed;
    entry.age = 0;

    if (entry.hits >= needed) {
      progressMap.delete(key);
      setCell(world, delta, chunks, x, y, AIR);
      count++;
      broken[type] = (broken[type] || 0) + 1;
      onBreak?.(x, y, type);
    } else {
      progressMap.set(key, entry);
      damaged++;
    }
  }

  return { count, blocked, damaged, broken };
}

export function laser(world, delta, chunks, ox, oy, dx, dy, pierce, range, power, onBreak) {
  let count = 0;
  let blocked = 0;
  const broken = {};
  const hitCells = [];
  const seen = new Set();
  let last = [Math.floor(ox), Math.floor(oy)];

  const steps = Math.ceil(range * 2);
  for (let i = 1; i <= steps; i++) {
    const t = i * 0.5;
    const cx = Math.floor(ox + dx * t);
    const cy = Math.floor(oy + dy * t);
    const key = `${cx},${cy}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (!world.inBounds(cx, cy)) break;
    last = [cx, cy];
    hitCells.push(last);

    const type = world.get(cx, cy);
    if (type === AIR || type === LAVA || type === GAS) continue;

    const hard = HARDNESS[type] ?? 0;
    if (hard > power) {
      blocked++;
      break;
    }

    setCell(world, delta, chunks, cx, cy, AIR);
    count++;
    broken[type] = (broken[type] || 0) + 1;
    onBreak?.(cx, cy, type);
    if (count >= pierce) break;
  }

  return { count, blocked, broken, last, hitCells };
}

export function igniteGas(world, delta, chunks, cells, onBreak) {
  const queue = [];
  const gasSet = new Set();

  for (const [x, y] of cells) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (!world.inBounds(nx, ny)) continue;
        if (world.get(nx, ny) === GAS) {
          const k = `${nx},${ny}`;
          if (!gasSet.has(k)) {
            gasSet.add(k);
            queue.push([nx, ny]);
          }
        }
      }
    }
  }

  if (!queue.length) return [];

  const blown = [];
  while (queue.length && blown.length < 180) {
    const [gx, gy] = queue.shift();
    blown.push([gx, gy]);

    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = gx + dx;
        const ny = gy + dy;
        if (!world.inBounds(nx, ny)) continue;
        const t = world.get(nx, ny);
        if (t === GAS) {
          const k = `${nx},${ny}`;
          if (!gasSet.has(k)) {
            gasSet.add(k);
            queue.push([nx, ny]);
          }
        } else if (t !== AIR && t !== LAVA && (HARDNESS[t] ?? 99) <= 3 && Math.hypot(dx, dy) <= 1.8) {
          setCell(world, delta, chunks, nx, ny, AIR);
          onBreak?.(nx, ny, t);
        }
      }
    }
    setCell(world, delta, chunks, gx, gy, AIR);
  }

  return blown;
}

const LOOSE_SET = new Set(LOOSE);

export function createSim(world, delta, chunks) {
  const pending = new Set();
  const moved = [];
  let lastActive = [];
  const stats = {
    steps: 0,
    activeChunks: 0,
    examined: 0,
    moved: 0,
    ms: 0,
    totalMoved: 0,
  };

  function wakeChunk(ch) {
    if (!IS_INFINITE && (ch < 0 || ch >= CHUNKS_X * CHUNKS_Y)) return;
    pending.add(ch);
  }

  function wakeRect(x0, y0, x1, y1) {
    const cx0 = Math.floor(x0 / CHUNK);
    const cx1 = Math.floor(x1 / CHUNK);
    const cy0 = Math.max(0, Math.floor(y0 / CHUNK));
    const cy1 = Math.floor(y1 / CHUNK);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        if (!IS_INFINITE && (cx < 0 || cx >= CHUNKS_X || cy >= CHUNKS_Y)) continue;
        wakeChunk(IS_INFINITE ? `${cx},${cy}` : cy * CHUNKS_X + cx);
      }
    }
  }

  function step(occupiedCells, activeBounds) {
    const t0 = performance.now();
    moved.length = 0;
    lastActive = [];
    let examined = 0;
    let movedCount = 0;
    let crushed = 0;
    const processed = new Set();

    const toProcess = [];
    for (const ch of pending) {
      let cx, cy;
      if (typeof ch === 'string') [cx, cy] = ch.split(',').map(Number);
      else { cx = ch % CHUNKS_X; cy = Math.floor(ch / CHUNKS_X); }
      if (
        cx >= activeBounds.cx0 && cx <= activeBounds.cx1 &&
        cy >= activeBounds.cy0 && cy <= activeBounds.cy1
      ) {
        toProcess.push([ch, cx, cy]);
      }
    }

    // Procesar de abajo hacia arriba para caída natural
    toProcess.sort((a, b) => b[2] - a[2]);

    for (const [ch, cx, cy] of toProcess) {
      pending.delete(ch);
      lastActive.push(ch);
      let chunkChanged = false;

      const xStart = cx * CHUNK;
      const yStart = cy * CHUNK;

      for (let y = yStart + CHUNK - 1; y >= yStart; y--) {
        const leftToRight = ((y + stats.steps) & 1) === 0;
        for (let i = 0; i < CHUNK; i++) {
          const x = xStart + (leftToRight ? i : CHUNK - 1 - i);
          if (!world.inBounds(x, y)) continue;
          const k = `${x},${y}`;
          if (processed.has(k)) continue;
          examined++;

          const type = world.get(x, y);
          if (type === AIR) continue;

          // Arena y grava caen
          if (LOOSE_SET.has(type)) {
            const below = world.inBounds(x, y + 1) ? world.get(x, y + 1) : 99;
            if (below === AIR || below === GAS || below === LAVA) {
              setCell(world, delta, chunks, x, y, below === LAVA ? LAVA : AIR);
              setCell(world, delta, chunks, x, y + 1, type);
              processed.add(`${x},${y + 1}`);
              moved.push([x, y + 1]);
              movedCount++;
              chunkChanged = true;
              if (occupiedCells.has(`${x},${y + 1}`)) crushed++;
              wakeRect(x - 1, y - 1, x + 1, y + 2);
              continue;
            }
            const dir = Math.random() < 0.5 ? -1 : 1;
            for (const d of [dir, -dir]) {
              const diag = world.inBounds(x + d, y + 1) ? world.get(x + d, y + 1) : 99;
              if (diag === AIR || diag === GAS) {
                setCell(world, delta, chunks, x, y, AIR);
                setCell(world, delta, chunks, x + d, y + 1, type);
                processed.add(`${x + d},${y + 1}`);
                moved.push([x + d, y + 1]);
                movedCount++;
                chunkChanged = true;
                if (occupiedCells.has(`${x + d},${y + 1}`)) crushed++;
                wakeRect(x - 1, y - 1, x + 1, y + 2);
                break;
              }
            }
          }

          // Lava fluye hacia abajo y los costados (Modo Difícil)
          if (IS_HARD && type === LAVA) {
            const below = world.inBounds(x, y + 1) ? world.get(x, y + 1) : 99;
            if (below === AIR || below === GAS) {
              setCell(world, delta, chunks, x, y, AIR);
              setCell(world, delta, chunks, x, y + 1, LAVA);
              processed.add(`${x},${y + 1}`);
              moved.push([x, y + 1]);
              movedCount++;
              chunkChanged = true;
              wakeRect(x - 1, y - 1, x + 1, y + 2);
              continue;
            }
            const dir = Math.random() < 0.5 ? -1 : 1;
            for (const d of [dir, -dir]) {
              const side = world.inBounds(x + d, y) ? world.get(x + d, y) : 99;
              if (side === AIR || side === GAS) {
                setCell(world, delta, chunks, x, y, AIR);
                setCell(world, delta, chunks, x + d, y, LAVA);
                processed.add(`${x + d},${y}`);
                moved.push([x + d, y]);
                movedCount++;
                chunkChanged = true;
                wakeRect(x - 1, y - 1, x + 1, y + 1);
                break;
              }
            }
          }

          // Gas sube hacia el techo (Modo Difícil)
          if (IS_HARD && type === GAS) {
            const above = world.inBounds(x, y - 1) ? world.get(x, y - 1) : 99;
            if (above === AIR) {
              setCell(world, delta, chunks, x, y, AIR);
              setCell(world, delta, chunks, x, y - 1, GAS);
              processed.add(`${x},${y - 1}`);
              moved.push([x, y - 1]);
              movedCount++;
              chunkChanged = true;
              wakeRect(x - 1, y - 2, x + 1, y + 1);
            }
          }
        }
      }

      if (chunkChanged) wakeChunk(ch);
    }

    stats.steps++;
    stats.activeChunks = toProcess.length;
    stats.examined = examined;
    stats.moved = movedCount;
    stats.totalMoved += movedCount;
    stats.ms = performance.now() - t0;

    return crushed;
  }

  return {
    get pendingCount() { return pending.size; },
    get lastActive() { return lastActive; },
    moved,
    stats,
    wakeRect,
    step,
  };
}