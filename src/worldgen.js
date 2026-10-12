import { COLS, ROWS, AIR, DIRT, STONE } from './config.js';
import { mulberry32 } from './random.js';
import { makeNoise1D } from './noise.js';
import { generateCaves } from './caves.js';

export function generateWorld(seed) {
  const noise = makeNoise1D(mulberry32(seed));
  const caves = generateCaves(mulberry32(seed + 1)); // generador aparte para las cuevas
  const world = new Uint8Array(COLS * ROWS);

  for (let x = 0; x < COLS; x++) {
    const n = noise(x * 0.08);
    const surface = Math.floor(ROWS * 0.25 + n * 16);

    for (let y = 0; y < ROWS; y++) {
      const i = y * COLS + x;
      let type;
      if (y < surface) type = AIR;
      else if (y < surface + 8) type = DIRT;
      else type = STONE;

      // tallar cuevas solo en la piedra, un poco por debajo de la tierra
      if (type === STONE && y > surface + 10 && caves[i] === 0) {
        type = AIR;
      }
      world[i] = type;
    }
  }
  return world;
}