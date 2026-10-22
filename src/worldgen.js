import { COLS, ROWS, AIR, DIRT, STONE, GRANITE } from './config.js';
import { mulberry32 } from './random.js';
import { makeNoise1D } from './noise.js';
import { generateCaves } from './caves.js';
import { placeOres } from './ores.js';

export function generateWorld(seed) {
  const noise = makeNoise1D(mulberry32(seed));
  const blobs = generateCaves(mulberry32(seed + 1), 0.52); // autómata: manchas de granito
  const world = new Uint8Array(COLS * ROWS);

  for (let x = 0; x < COLS; x++) {
    const n = noise(x * 0.08);
    const surface = Math.floor(ROWS * 0.25 + n * 16);

    for (let y = 0; y < ROWS; y++) {
      const i = y * COLS + x;
      let type;
      if (y < surface) type = AIR;              // aire solo arriba del suelo
      else if (y < surface + 8) type = DIRT;
      else type = STONE;

      // las "cuevas" del autómata ahora se rellenan con granito, no con aire
      if (type === STONE && y > surface + 10 && blobs[i] === 0) {
        type = GRANITE;
      }
      world[i] = type;
    }
  }

  placeOres(world, mulberry32(seed + 2)); // los minerales solo reemplazan piedra común
  return world;
}