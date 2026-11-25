import {
  COLS, ROWS, STONE, GRANITE, DEEPROCK, MAGMA_ROCK, ORES, ORE_BOOST, IS_HARD,
} from './config.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const canReplace = (t) => t === STONE || t === GRANITE || t === DEEPROCK || t === MAGMA_ROCK;

export function placeOres(world, rand, biomes) {
  for (const ore of ORES) {
    if (ore.hardOnly && !IS_HARD) continue;

    const startY = Math.floor(ROWS * ore.minDepth);
    const endY = Math.min(ROWS, Math.floor(ROWS * ore.maxDepth));

    const put = (x, y) => {
      if (x < 0 || x >= COLS || y < startY || y >= endY) return;
      if (canReplace(world[y * COLS + x])) world[y * COLS + x] = ore.type;
    };

    for (let y = startY; y < endY; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x;
        if (!canReplace(world[i])) continue;
        const chance = ore.chance * ORE_BOOST * (ore.biome?.[biomes[i]] ?? 1);
        if (rand() >= chance) continue;

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