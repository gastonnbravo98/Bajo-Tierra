import { COLS, ROWS, CHUNK, AIR, IS_INFINITE } from './config.js';

export const chunkKey = (cx, cy) => `${cx},${cy}`;

// Crea un envoltorio rápido sobre un array finito para usar la misma API get/set
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

// ¿La celda (cx, cy) es sólida?
// En mundo infinito no hay paredes laterales ni piso de bedrock: el espacio es abierto.
export function isSolid(world, cx, cy) {
  if (IS_INFINITE) {
    if (cy < 0) return false;
    return world.get(cx, cy) !== AIR;
  }
  if (cx < 0 || cx >= COLS || cy >= ROWS) return true;
  if (cy < 0) return false;
  const raw = world.raw || world;
  return raw[cy * COLS + cx] !== AIR;
}