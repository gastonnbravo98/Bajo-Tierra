import { COLS, ROWS, AIR, DIRT, STONE } from './config.js';
import { mulberry32 } from './random.js';
import { makeNoise1D } from './noise.js';

// Devuelve el mundo como un array con un tipo por celda
export function generateWorld(seed) {
  const rand = mulberry32(seed);
  const noise = makeNoise1D(rand);
  const world = new Uint8Array(COLS * ROWS);

  for (let x = 0; x < COLS; x++) {
    const n = noise(x * 0.08);                        // 0.08 = ancho de las colinas
    const surface = Math.floor(ROWS * 0.25 + n * 16); // altura del suelo en esta columna

    for (let y = 0; y < ROWS; y++) {
      let type;
      if (y < surface) type = AIR;
      else if (y < surface + 8) type = DIRT;
      else type = STONE;
      world[y * COLS + x] = type;
    }
  }
  return world;
}