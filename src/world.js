import { COLS, ROWS, AIR } from './config.js';

// ¿La celda (cx, cy) está llena?
// Los costados y el fondo del mapa cuentan como pared; por arriba es aire.
export function isSolid(world, cx, cy) {
  if (cx < 0 || cx >= COLS || cy >= ROWS) return true;
  if (cy < 0) return false;
  return world[cy * COLS + cx] !== AIR;
}