import { COLS, ROWS, AIR, FLUIDS, IS_INFINITE } from './config.js';

export const chunkKey = (cx, cy) => `${cx},${cy}`;

export function wrapFiniteWorld(arr) {
  return {
    infinite: false,
    raw: arr,
    get(x, y) {
      if (x < 0 || x >= COLS || y >= ROWS) return 99;
      if (y < 0) return AIR;
      return arr[y * COLS + x];
    },
    set(x, y, type) {
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
      arr[y * COLS + x] = type;
    },
    inBounds(x, y) {
      return x >= 0 && x < COLS && y >= 0 && y < ROWS;
    },
  };
}

// ¿La celda (cx, cy) es sólida? (Aire, Gas y Lava no frenan el movimiento físico)
export function isSolid(world, cx, cy) {
  if (IS_INFINITE) {
    if (cy < 0) return false;
    return !FLUIDS.has(world.get(cx, cy));
  }
  if (cx < 0 || cx >= COLS || cy >= ROWS) return true;
  if (cy < 0) return false;
  const raw = world.raw || world;
  return !FLUIDS.has(raw[cy * COLS + cx]);
}