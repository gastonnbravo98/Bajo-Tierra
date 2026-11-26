import { CELL, COLS, ROWS, CHUNK, AIR, FLUIDS } from './config.js';
import { mulberry32 } from './random.js';
import { isSolid } from './world.js';

export const ENEMY_TYPES = {
  bat: {
    name: 'Murciélago de cueva',
    hp: 25,
    speed: 4.6 * CELL,
    dmg: 12,
    reward: 25,
    lightAggro: true,
    flying: true,
    color: 0x9b5de5,
    w: 0.9 * CELL,
    h: 0.7 * CELL,
  },
  crawler: {
    name: 'Escarabajo de roca',
    hp: 40,
    speed: 3.1 * CELL,
    dmg: 18,
    reward: 40,
    lightAggro: false,
    flying: false,
    color: 0xf15bb5,
    w: 0.95 * CELL,
    h: 0.75 * CELL,
  },
  wisp: {
    name: 'Espectro de magma',
    hp: 55,
    speed: 5.2 * CELL,
    dmg: 24,
    reward: 65,
    lightAggro: true,
    flying: true,
    color: 0xff6b35,
    w: 0.9 * CELL,
    h: 0.9 * CELL,
  },
};

let nextEnemyId = 1;

export function createEnemy(kind, col, row) {
  const spec = ENEMY_TYPES[kind] || ENEMY_TYPES.bat;
  return {
    id: nextEnemyId++,
    kind,
    name: spec.name,
    x: (col + 0.5) * CELL - spec.w / 2,
    y: (row + 0.5) * CELL - spec.h / 2,
    w: spec.w,
    h: spec.h,
    vx: 0,
    vy: 0,
    hp: spec.hp,
    maxHp: spec.hp,
    dmg: spec.dmg,
    reward: spec.reward,
    flying: spec.flying,
    lightAggro: spec.lightAggro,
    color: spec.color,
    dir: 1,
    patrolTimer: 1.5,
    alertTimer: 0,
    hitFlash: 0,
  };
}

/**
 * Genera fauna subterránea en cuevas de mundos finitos.
 */
export function spawnEnemiesForWorld(world, seed, startRow) {
  const rand = mulberry32(seed + 888);
  const target = Math.max(8, Math.min(26, Math.floor((COLS * ROWS) / 3800)));
  const enemies = [];
  const minRow = startRow + 14;
  const maxRow = ROWS - 6;
  if (maxRow <= minRow) return enemies;

  let attempts = 0;
  while (enemies.length < target && attempts < target * 40) {
    attempts++;
    const col = 8 + Math.floor(rand() * Math.max(1, COLS - 16));
    const row = minRow + Math.floor(rand() * (maxRow - minRow));
    if (world.get(col, row) !== AIR) continue;
    if (enemies.some((e) => Math.hypot(e.x - col * CELL, e.y - row * CELL) < 10 * CELL)) continue;

    const depthRatio = (row - startRow) / Math.max(1, ROWS - startRow);
    let kind = 'bat';
    if (depthRatio > 0.68 && rand() < 0.5) kind = 'wisp';
    else if (rand() < 0.45 && isSolid(world, col, row + 1)) kind = 'crawler';
    enemies.push(createEnemy(kind, col, row));
  }
  return enemies;
}

/**
 * Genera un enemigo ocasional en un chunk de mundo infinito.
 */
export function spawnEnemyInChunk(cx, cy, seed, world, startRow) {
  const y0 = cy * CHUNK;
  if (y0 < startRow + 12) return null;
  let h = seed ^ Math.imul(cx, 2654435761) ^ Math.imul(cy, 1597334677);
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  const rand = mulberry32(h);
  if (rand() >= 0.22) return null;

  for (let i = 0; i < 8; i++) {
    const col = cx * CHUNK + Math.floor(rand() * CHUNK);
    const row = y0 + Math.floor(rand() * CHUNK);
    if (world.get(col, row) !== AIR) continue;
    const kind = row - startRow > 140 && rand() < 0.45 ? 'wisp' : (rand() < 0.45 ? 'crawler' : 'bat');
    return createEnemy(kind, col, row);
  }
  return null;
}

/**
 * Alerta a enemigos cercanos por ruido (excavación, dinamita, láser).
 */
export function alertEnemies(enemies, x, y, radiusPx, duration = 4) {
  for (const e of enemies) {
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;
    if (Math.hypot(cx - x, cy - y) <= radiusPx) {
      e.alertTimer = Math.max(e.alertTimer, duration);
    }
  }
}

function enemyCollides(world, x, y, w, h) {
  const x0 = Math.floor(x / CELL);
  const x1 = Math.floor((x + w - 0.001) / CELL);
  const y0 = Math.floor(y / CELL);
  const y1 = Math.floor((y + h - 0.001) / CELL);
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      if (isSolid(world, cx, cy)) return true;
    }
  }
  return false;
}

/**
 * Actualiza movimiento, IA (reacción a luz/ruido) y colisión con el jugador.
 */
export function updateEnemies(enemies, world, player, dt, options = {}) {
  const { flashLevel = 0, isHard = false, nearBase = false } = options;
  const px = player.x + player.w / 2;
  const py = player.y + player.h / 2;
  const contacts = [];

  for (const e of enemies) {
    if (e.alertTimer > 0) e.alertTimer = Math.max(0, e.alertTimer - dt);
    if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);

    const ex = e.x + e.w / 2;
    const ey = e.y + e.h / 2;
    const dist = Math.hypot(px - ex, py - ey);

    const detectRadius = (e.lightAggro && isHard ? (7.5 + flashLevel * 2.5) : 5.5) * CELL;
    const chasing = !nearBase && (e.alertTimer > 0 || dist <= detectRadius) && dist < 24 * CELL;

    const spec = ENEMY_TYPES[e.kind] || ENEMY_TYPES.bat;

    if (e.flying) {
      if (chasing && dist > 1) {
        e.vx = ((px - ex) / dist) * spec.speed;
        e.vy = ((py - ey) / dist) * spec.speed;
      } else {
        e.patrolTimer -= dt;
        if (e.patrolTimer <= 0) {
          e.dir *= -1;
          e.patrolTimer = 1.6 + Math.random() * 1.4;
        }
        e.vx = e.dir * spec.speed * 0.45;
        e.vy = Math.sin(e.patrolTimer * 3) * spec.speed * 0.25;
      }

      const nx = e.x + e.vx * dt;
      if (!enemyCollides(world, nx, e.y, e.w, e.h)) e.x = nx;
      else e.dir *= -1;

      const ny = e.y + e.vy * dt;
      if (!enemyCollides(world, e.x, ny, e.w, e.h)) e.y = ny;
    } else {
      // Terrestre: camina y salta obstáculos bajos
      if (chasing) e.dir = px >= ex ? 1 : -1;
      else {
        e.patrolTimer -= dt;
        if (e.patrolTimer <= 0) {
          e.dir *= -1;
          e.patrolTimer = 2 + Math.random() * 1.5;
        }
      }
      e.vx = e.dir * spec.speed * (chasing ? 1 : 0.55);
      e.vy = Math.min(e.vy + 70 * CELL * dt, 28 * CELL);

      const nx = e.x + e.vx * dt;
      if (!enemyCollides(world, nx, e.y, e.w, e.h)) {
        e.x = nx;
      } else {
        // Intentar pequeño salto si choca con un escalón
        if (enemyCollides(world, e.x, e.y + 2, e.w, e.h)) e.vy = -16 * CELL;
        else if (!chasing) e.dir *= -1;
      }

      const ny = e.y + e.vy * dt;
      if (!enemyCollides(world, e.x, ny, e.w, e.h)) {
        e.y = ny;
      } else {
        e.vy = 0;
      }
    }

    // Colisión con jugador
    if (
      e.x < player.x + player.w &&
      e.x + e.w > player.x &&
      e.y < player.y + player.h &&
      e.y + e.h > player.y
    ) {
      contacts.push({
        enemy: e,
        dmg: e.dmg,
        knockX: px >= ex ? 1 : -1,
      });
    }
  }

  return contacts;
}

/**
 * Aplica daño en área a enemigos (dinamita o golpe de pico) y devuelve los derrotados.
 */
export function damageEnemiesInRadius(enemies, x, y, radiusPx, dmg) {
  const killed = [];
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const ex = e.x + e.w / 2;
    const ey = e.y + e.h / 2;
    if (Math.hypot(ex - x, ey - y) <= radiusPx) {
      e.hp -= dmg;
      e.hitFlash = 0.2;
      e.alertTimer = 5;
      if (e.hp <= 0) {
        killed.push(e);
        enemies.splice(i, 1);
      }
    }
  }
  return killed;
}

/**
 * Aplica daño de láser en línea recta y devuelve los enemigos derrotados.
 */
export function damageEnemiesOnRay(enemies, ox, oy, dx, dy, maxDistPx, dmg) {
  const killed = [];
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const ex = e.x + e.w / 2;
    const ey = e.y + e.h / 2;
    const proj = (ex - ox) * dx + (ey - oy) * dy;
    if (proj < 0 || proj > maxDistPx) continue;
    const perp = Math.abs((ex - ox) * dy - (ey - oy) * dx);
    if (perp <= Math.max(e.w, e.h) * 0.75) {
      e.hp -= dmg;
      e.hitFlash = 0.25;
      e.alertTimer = 5;
      if (e.hp <= 0) {
        killed.push(e);
        enemies.splice(i, 1);
      }
    }
  }
  return killed;
}
