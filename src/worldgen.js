import { COLS, ROWS, AIR, DIRT, STONE, GRANITE, BEDROCK, PLATFORM } from './config.js';
import { mulberry32 } from './random.js';
import { makeNoise1D } from './noise.js';
import { generateCaves } from './caves.js';
import { placeOres } from './ores.js';

const GRANITE_WALL_CHANCE = 0.56; // con 0.56 el autómata deja ~30% de paredes

export function generateWorld(seed) {
  const noise = makeNoise1D(mulberry32(seed));
  const blobs = generateCaves(mulberry32(seed + 1), GRANITE_WALL_CHANCE); // autómata: manchas de granito
  const world = new Uint8Array(COLS * ROWS);

  // dos octavas de Perlin: colinas grandes + relieve chico
  const rawSurface = (x) =>
    Math.floor(ROWS * 0.25 + (noise(x * 0.08) + 0.4 * noise(x * 0.25 + 100)) * 16);

  // una meseta plana en el medio, donde van el punto de salida y la tienda
  const mid = COLS >> 1;
  const flat = rawSurface(mid);

  for (let x = 0; x < COLS; x++) {
    const surface = Math.abs(x - mid) <= 6 ? flat : rawSurface(x);

    for (let y = 0; y < ROWS; y++) {
      const i = y * COLS + x;
      let type;
      if (y < surface) type = AIR;              // aire solo arriba del suelo
      else if (y < surface + 8) type = DIRT;
      else type = STONE;

      // donde el autómata deja pared, la piedra pasa a ser granito (más duro)
      if (type === STONE && y > surface + 10 && blobs[i] === 1) type = GRANITE;

      // plataforma indestructible de 9 columnas x 2 filas bajo la tienda y el punto de salida
      if (Math.abs(x - mid) <= 4 && y >= surface && y < surface + 2) type = PLATFORM;

      // las dos últimas filas son roca base: indestructible
      if (y >= ROWS - 2) type = BEDROCK;

      world[i] = type;
    }
  }

  placeOres(world, mulberry32(seed + 2)); // generador aparte para los minerales
  return world;
}