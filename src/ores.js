import { COLS, ROWS, STONE, GRANITE, ORES } from './config.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const canReplace = (t) => t === STONE || t === GRANITE;

// Reemplaza algunas celdas de piedra o granito por mineral, en pequeñas venas.
// Usa el generador que le pasan, así que la misma seed da siempre las mismas venas.
export function placeOres(world, rand) {
  for (const ore of ORES) {
    const startY = Math.floor(ROWS * ore.minDepth);
    for (let y = startY; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!canReplace(world[y * COLS + x])) continue;
        if (rand() >= ore.chance) continue;

        // vena: caminata al azar que convierte la roca en mineral
        let cx = x;
        let cy = y;
        for (let k = 0; k < ore.size; k++) {
          if (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS && canReplace(world[cy * COLS + cx])) {
            world[cy * COLS + cx] = ore.type;
          }
          const d = DIRS[Math.floor(rand() * 4)];
          cx += d[0];
          cy += d[1];
        }
      }
    }
  }
}
