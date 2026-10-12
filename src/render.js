import { CELL, COLS, ROWS, AIR, COLORS } from './config.js';

// Dibuja todas las celdas llenas en un Graphics y lo devuelve
export function drawWorld(world) {
  const g = new PIXI.Graphics();
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const type = world[y * COLS + x];
      if (type !== AIR) {
        g.rect(x * CELL, y * CELL, CELL, CELL).fill(COLORS[type]);
      }
    }
  }
  return g;
}