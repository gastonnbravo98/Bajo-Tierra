import {
  CELL, COLS, ROWS, CHUNK, AIR, PLATFORM, GRANITE, DEEPROCK, BEDROCK,
  IRON, COPPER, SILVER, GOLD, CRYSTAL, RUBY, EMERALD, DIAMOND, ORE_NAME,
} from './config.js';
import { mulberry32 } from './random.js';

function hashPos(seed, cx, cy) {
  let h = seed ^ Math.imul(cx, 374761393) ^ Math.imul(cy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function buildChestLoot(rand, depthRatio) {
  if (depthRatio >= 0.65) {
    return {
      tier: 'Legendario',
      money: 220 + Math.floor(rand() * 140),
      dynamite: 2,
      ores: {
        [DIAMOND]: 1 + Math.floor(rand() * 2),
        [EMERALD]: 1 + Math.floor(rand() * 2),
        [RUBY]: 2,
      },
    };
  }
  if (depthRatio >= 0.35) {
    return {
      tier: 'Raro',
      money: 120 + Math.floor(rand() * 90),
      dynamite: 1,
      ores: {
        [GOLD]: 2 + Math.floor(rand() * 3),
        [SILVER]: 3 + Math.floor(rand() * 3),
        [CRYSTAL]: 1,
      },
    };
  }
  return {
    tier: 'Común',
    money: 60 + Math.floor(rand() * 55),
    dynamite: rand() < 0.5 ? 1 : 0,
    ores: {
      [IRON]: 3 + Math.floor(rand() * 4),
      [COPPER]: 2 + Math.floor(rand() * 3),
    },
  };
}

function carveRuinChamber(world, col, row, depthRatio) {
  const wallType = depthRatio >= 0.5 ? DEEPROCK : GRANITE;
  for (let dy = -3; dy <= 1; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const wx = col + dx;
      const wy = row + dy;
      if (!world.inBounds(wx, wy)) continue;
      if (world.get(wx, wy) === BEDROCK) continue;

      const isBorderX = Math.abs(dx) === 3;
      const isFloor = dy === 1;
      const isCeiling = dy === -3;

      if (isFloor) {
        world.set(wx, wy, Math.abs(dx) <= 1 ? PLATFORM : wallType);
      } else if (isCeiling || (isBorderX && dy > -3)) {
        world.set(wx, wy, wallType);
      } else {
        world.set(wx, wy, AIR);
      }
    }
  }
}

/**
 * Genera ruinas subterráneas con cofres para mundos finitos.
 */
export function generateStructures(world, seed, startRow) {
  const rand = mulberry32(seed + 777);
  const count = Math.max(4, Math.min(10, Math.floor((COLS * ROWS) / 10000)));
  const chests = [];
  const minRow = startRow + 18;
  const maxRow = ROWS - 8;
  if (maxRow <= minRow) return chests;

  let attempts = 0;
  while (chests.length < count && attempts < count * 12) {
    attempts++;
    const col = 12 + Math.floor(rand() * Math.max(1, COLS - 24));
    const row = minRow + Math.floor(rand() * (maxRow - minRow));
    if (chests.some((c) => Math.hypot(c.col - col, c.row - row) < 22)) continue;

    const depthRatio = Math.min(1, (row - startRow) / Math.max(1, ROWS - startRow));
    carveRuinChamber(world, col, row, depthRatio);
    chests.push({
      id: `chest-${chests.length + 1}`,
      col,
      row,
      x: (col + 0.5) * CELL,
      y: (row + 0.5) * CELL,
      opened: false,
      loot: buildChestLoot(rand, depthRatio),
    });
  }
  return chests;
}

/**
 * Genera una cámara/cofre ocasional en un chunk de mundo infinito.
 */
export function generateChunkStructures(cx, cy, seed, world, startRow) {
  const row = cy * CHUNK + Math.floor(CHUNK / 2);
  if (row < startRow + 18) return null;

  const rand = mulberry32(hashPos(seed + 911, cx, cy));
  if (rand() >= 0.085) return null;

  const col = cx * CHUNK + Math.floor(CHUNK / 2);
  const depthRatio = Math.min(1, (row - startRow) / 220);
  carveRuinChamber(world, col, row, depthRatio);
  return {
    id: `chest-${cx},${cy}`,
    col,
    row,
    x: (col + 0.5) * CELL,
    y: (row + 0.5) * CELL,
    opened: false,
    loot: buildChestLoot(rand, depthRatio),
  };
}

/**
 * Abre un cofre y entrega su botín al jugador (mochila o almacén si está llena).
 */
export function openChest(chest, stats, cargo, maxBag) {
  if (!chest || chest.opened) return null;
  chest.opened = true;
  const { loot } = chest;

  stats.money += loot.money;
  if (loot.dynamite > 0) stats.dynamite += loot.dynamite;

  let curBag = Object.values(cargo).reduce((a, b) => a + b, 0);
  let toStash = 0;
  const oreParts = [];

  for (const [type, qty] of Object.entries(loot.ores)) {
    const free = Math.max(0, maxBag - curBag);
    const bagTake = Math.min(qty, free);
    const stashTake = qty - bagTake;
    if (bagTake > 0) {
      cargo[type] = (cargo[type] || 0) + bagTake;
      curBag += bagTake;
    }
    if (stashTake > 0) {
      stats.stash[type] = (stats.stash[type] || 0) + stashTake;
      toStash += stashTake;
    }
    oreParts.push(`${qty} ${ORE_NAME[type]}`);
  }

  return {
    tier: loot.tier,
    money: loot.money,
    dynamite: loot.dynamite,
    oreParts,
    toStash,
  };
}
