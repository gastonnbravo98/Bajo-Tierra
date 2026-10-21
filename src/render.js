import { CELL, COLS, ROWS, COLORS } from './config.js';

// Dibuja el mundo: un solo trazo por tipo de celda (mucho más liviano que uno por celda)
export function drawWorld(world) {
  const g = new PIXI.Graphics();
  for (const type of Object.keys(COLORS)) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (world[y * COLS + x] === Number(type)) {
          g.rect(x * CELL, y * CELL, CELL, CELL);
        }
      }
    }
    g.fill(COLORS[type]);
  }
  return g;
}

// El jugador por ahora es un rectángulo amarillo
export function createPlayerSprite(p) {
  const g = new PIXI.Graphics();
  g.rect(0, 0, p.w, p.h).fill(0xffd23f);
  return g;
}