import { COLS, ROWS, STONE, GRANITE, ORES } from './config.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const canReplace = (t) => t === STONE || t === GRANITE;

// Reemplaza algunas celdas de piedra o granito por mineral, arena o grava, en pequeñas venas o bolsas.
// Usa el generador que le pasan, así que la misma seed da siempre lo mismo.
export function placeOres(world, rand) {
  for (const ore of ORES) {
    const startY = Math.floor(ROWS * ore.minDepth);

    // pinta una celda solo si es roca y está por debajo de la profundidad mínima
    const put = (x, y) => {
      if (x < 0 || x >= COLS || y < startY || y >= ROWS) return;
      if (canReplace(world[y * COLS + x])) world[y * COLS + x] = ore.type;
    };

    for (let y = startY; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!canReplace(world[y * COLS + x])) continue;
        if (rand() >= ore.chance) continue;

        // vena: caminata al azar que convierte la roca en mineral
        let cx = x;
        let cy = y;
        for (let k = 0; k < ore.size; k++) {
          put(cx, cy);
          if (ore.fat) { put(cx + 1, cy); put(cx - 1, cy); put(cx, cy + 1); put(cx, cy - 1); }
          const d = DIRS[Math.floor(rand() * 4)];
          cx += d[0];
          cy += d[1];
        }
      }
    }
  }
}