import {
  COLS, ROWS, CHUNK, AIR, DIRT, STONE, GRANITE, BEDROCK, PLATFORM, DEEPROCK, MAGMA_ROCK,
  SAND, GRAVEL, ORES, ORE_BOOST, LAYERS, NORMAL, ARENOSO, VOLCANICO, CRISTALINO,
} from './config.js';
import { mulberry32 } from './random.js';
import { makeNoise1D, makeNoise2D } from './noise.js';
import { generateCaves } from './caves.js';
import { placeOres } from './ores.js';
import { wrapFiniteWorld, chunkKey } from './world.js';

const GRANITE_WALL_CHANCE = 0.56;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const canReplace = (t) => t === STONE || t === GRANITE || t === DEEPROCK || t === MAGMA_ROCK;

// Hash determinista por chunk (seed, cx, cy) para que cada chunk sea 100% reproducible
function chunkSeed(seed, cx, cy) {
  let h = seed ^ Math.imul(cx, 374761393) ^ Math.imul(cy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// ---------- MODO FINITO (Pequeño, Mediano, Grande) ----------
export function generateBiomes(seed) {
  const nA = makeNoise2D(mulberry32(seed + 3));
  const nB = makeNoise2D(mulberry32(seed + 5));
  const biomes = new Uint8Array(COLS * ROWS);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const a = nA(x * 0.022, y * 0.022) * 1.4;
      const b = nB(x * 0.025 + 50, y * 0.025 + 50) * 1.4;
      let biome = NORMAL;
      if (a < -0.3) biome = ARENOSO;
      else if (a > 0.35) biome = VOLCANICO;
      else if (b > 0.4) biome = CRISTALINO;
      biomes[y * COLS + x] = biome;
    }
  }
  return biomes;
}

export function generateWorld(seed) {
  const noise = makeNoise1D(mulberry32(seed));
  const layerNoise = makeNoise1D(mulberry32(seed + 4));
  const blobs = generateCaves(mulberry32(seed + 1), GRANITE_WALL_CHANCE);
  const biomes = generateBiomes(seed);
  const world = new Uint8Array(COLS * ROWS);

  const rawSurface = (x) =>
    Math.floor(ROWS * 0.25 + (noise(x * 0.08) + 0.4 * noise(x * 0.25 + 100)) * 16);

  const mid = COLS >> 1;
  const flat = rawSurface(mid);

  for (let x = 0; x < COLS; x++) {
    const surface = Math.abs(x - mid) <= 6 ? flat : rawSurface(x);
    const deepStart = Math.floor(ROWS * LAYERS.deep + layerNoise(x * 0.04) * 14);
    const magmaStart = Math.floor(ROWS * LAYERS.magma + layerNoise(x * 0.05 + 300) * 10);

    for (let y = 0; y < ROWS; y++) {
      const i = y * COLS + x;
      let type;
      if (y < surface) type = AIR;
      else if (y < surface + 8) type = DIRT;
      else if (y >= magmaStart) type = MAGMA_ROCK;
      else if (y >= deepStart) type = DEEPROCK;
      else type = STONE;

      if (type === STONE && y > surface + 10 && blobs[i] === 1) type = GRANITE;
      if (Math.abs(x - mid) <= 4 && y >= surface && y < surface + 2) type = PLATFORM;
      if (y >= ROWS - 2) type = BEDROCK;

      world[i] = type;
    }
  }

  placeOres(world, mulberry32(seed + 2), biomes);
  return wrapFiniteWorld(world);
}

// ---------- MODO INFINITO (Generación on-demand por chunk) ----------
export function createInfiniteWorld(seed, delta) {
  const noise = makeNoise1D(mulberry32(seed));
  const layerNoise = makeNoise1D(mulberry32(seed + 4));
  const nA = makeNoise2D(mulberry32(seed + 3));
  const nB = makeNoise2D(mulberry32(seed + 5));
  const nGranite = makeNoise2D(mulberry32(seed + 1));

  const chunks = new Map(); // "cx,cy" -> Uint8Array(256)
  let lastKey = '';
  let lastArr = null;

  const mid = COLS >> 1; // columna inicial = 160
  const rawSurface = (x) =>
    Math.floor(ROWS * 0.25 + (noise(x * 0.08) + 0.4 * noise(x * 0.25 + 100)) * 16);
  const flatSurface = rawSurface(mid);

  function surfaceAt(x) {
    return Math.abs(x - mid) <= 6 ? flatSurface : rawSurface(x);
  }

  function biomeAt(x, y) {
    const a = nA(x * 0.022, y * 0.022) * 1.4;
    const b = nB(x * 0.025 + 50, y * 0.025 + 50) * 1.4;
    if (a < -0.3) return ARENOSO;
    if (a > 0.35) return VOLCANICO;
    if (b > 0.4) return CRISTALINO;
    return NORMAL;
  }

  function generateChunkData(cx, cy) {
    const arr = new Uint8Array(CHUNK * CHUNK);
    const x0 = cx * CHUNK;
    const y0 = cy * CHUNK;

    // 1. Terreno base por columna
    for (let lx = 0; lx < CHUNK; lx++) {
      const x = x0 + lx;
      const surface = surfaceAt(x);
      // En infinito las capas profundas arrancan a ~112m y ~175m y continúan sin fin
      const deepStart = Math.floor(ROWS * LAYERS.deep + layerNoise(x * 0.04) * 14);
      const magmaStart = Math.floor(ROWS * LAYERS.magma + layerNoise(x * 0.05 + 300) * 10);

      for (let ly = 0; ly < CHUNK; ly++) {
        const y = y0 + ly;
        let type;
        if (y < surface) type = AIR;
        else if (y < surface + 8) type = DIRT;
        else if (y >= magmaStart) type = MAGMA_ROCK;
        else if (y >= deepStart) type = DEEPROCK;
        else type = STONE;

        // Manchas de granito deterministas por ruido 2D
        if (type === STONE && y > surface + 10 && nGranite(x * 0.14, y * 0.14) > 0.22) {
          type = GRANITE;
        }
        // Plataforma indestructible bajo la cabaña inicial
        if (Math.abs(x - mid) <= 4 && y >= surface && y < surface + 2) {
          type = PLATFORM;
        }
        arr[ly * CHUNK + lx] = type;
      }
    }

    // 2. Vetas de minerales y bolsas de arena/grava deterministas dentro del chunk
    const rand = mulberry32(chunkSeed(seed, cx, cy));
    for (const ore of ORES) {
      const minRow = Math.floor(ROWS * ore.minDepth);
      // En infinito los minerales profundos (oro, diamante, rubí, cristal, etc.) siguen apareciendo hacia el infinito
      const infiniteDeep = ore.maxDepth >= 0.9;
      const maxRow = infiniteDeep ? Infinity : Math.floor(ROWS * ore.maxDepth);

      if (y0 + CHUNK <= minRow || y0 >= maxRow) continue;

      for (let ly = 0; ly < CHUNK; ly++) {
        const y = y0 + ly;
        if (y < minRow || y >= maxRow) continue;
        for (let lx = 0; lx < CHUNK; lx++) {
          const idx = ly * CHUNK + lx;
          if (!canReplace(arr[idx])) continue;
          const x = x0 + lx;
          const b = biomeAt(x, y);
          // Más abajo de 220 celdas aumentamos levemente la chance de gemas raras
          const depthBonus = y > ROWS ? 1.25 : 1;
          const chance = ore.chance * ORE_BOOST * depthBonus * (ore.biome?.[b] ?? 1);
          if (rand() >= chance) continue;

          let vx = lx;
          let vy = ly;
          const putLocal = (px, py) => {
            if (px < 0 || py < 0 || px >= CHUNK || py >= CHUNK) return;
            if (canReplace(arr[py * CHUNK + px])) arr[py * CHUNK + px] = ore.type;
          };
          for (let k = 0; k < ore.size; k++) {
            putLocal(vx, vy);
            if (ore.fat) {
              putLocal(vx + 1, vy); putLocal(vx - 1, vy);
              putLocal(vx, vy + 1); putLocal(vx, vy - 1);
            }
            const d = DIRS[Math.floor(rand() * 4)];
            vx += d[0];
            vy += d[1];
          }
        }
      }
    }

    // 3. Reaplicar cambios guardados en delta para este chunk (si el jugador ya cavó acá)
    const key = chunkKey(cx, cy);
    const saved = delta.get(key);
    if (saved) {
      for (const [localIdx, type] of saved) arr[localIdx] = type;
    }

    chunks.set(key, arr);
    return arr;
  }

  function getChunk(cx, cy) {
    const key = chunkKey(cx, cy);
    if (key === lastKey && lastArr) return lastArr;
    let arr = chunks.get(key);
    if (!arr) arr = generateChunkData(cx, cy);
    lastKey = key;
    lastArr = arr;
    return arr;
  }

  return {
    infinite: true,
    chunks,
    surfaceAt,
    biomeAt,
    getChunk,
    get loadedCount() { return chunks.size; },

    get(x, y) {
      if (y < 0) return AIR;
      const cx = Math.floor(x / CHUNK);
      const cy = Math.floor(y / CHUNK);
      const lx = x - cx * CHUNK;
      const ly = y - cy * CHUNK;
      return getChunk(cx, cy)[ly * CHUNK + lx];
    },

    set(x, y, type) {
      if (y < 0) return;
      const cx = Math.floor(x / CHUNK);
      const cy = Math.floor(y / CHUNK);
      const lx = x - cx * CHUNK;
      const ly = y - cy * CHUNK;
      getChunk(cx, cy)[ly * CHUNK + lx] = type;
    },

    inBounds(x, y) {
      return y >= 0;
    },

    // Libera de memoria chunks lejanos que no tengan cambios en delta
    pruneFar(minCx, maxCx, minCy, maxCy) {
      for (const key of chunks.keys()) {
        if (delta.has(key)) continue;
        const [cx, cy] = key.split(',').map(Number);
        if (cx < minCx || cx > maxCx || cy < minCy || cy > maxCy) {
          chunks.delete(key);
          if (key === lastKey) { lastKey = ''; lastArr = null; }
        }
      }
    },
  };
}