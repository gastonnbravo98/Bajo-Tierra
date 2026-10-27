import { COLS, ROWS } from './config.js';

// Cellular Automata. Devuelve una grilla: 1 = pared, 0 = hueco
export function generateCaves(rand, wallChance = 0.47, steps = 4) {
  // 1) ruido inicial al azar
  let grid = new Uint8Array(COLS * ROWS);
  for (let i = 0; i < grid.length; i++) {
    grid[i] = rand() < wallChance ? 1 : 0;
  }

  // 2) suavizar con la regla del autómata
  for (let s = 0; s < steps; s++) {
    const next = new Uint8Array(COLS * ROWS);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        let walls = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            // fuera del mapa cuenta como pared
            if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) walls++;
            else walls += grid[ny * COLS + nx];
          }
        }
        next[y * COLS + x] = walls >= 5 ? 1 : 0;
      }
    }
    grid = next; // copia nueva para no leer celdas ya modificadas
  }
  return grid;
}
