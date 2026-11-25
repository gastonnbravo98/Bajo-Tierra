import {
  CELL, COLS, ROWS, PLAYER_W, PLAYER_H,
  MOVE_SPEED, GRAVITY, JUMP_SPEED, MAX_FALL,
  FUEL_MAX, FUEL_USE, FUEL_REGEN, THRUST, FLY_SPEED,
  HP_MAX, FALL_SAFE_SPEED, FALL_DMG_MULT, IS_HARD,
} from './config.js';
import { isSolid } from './world.js';

const MAX_STEP = CELL / 2;

export function createPlayer(world) {
  const w = PLAYER_W * CELL;
  const h = PLAYER_H * CELL;
  const col = Math.floor(COLS / 2);
  let row = 0;
  while (row < ROWS && !isSolid(world, col, row)) row++;
  return {
    x: col * CELL + (CELL - w) / 2,
    y: row * CELL - h,
    w, h,
    vx: 0, vy: 0,
    onGround: false,
    fuel: FUEL_MAX,
    fuelMax: FUEL_MAX,
    hp: HP_MAX,
    maxHp: HP_MAX,
    invuln: 0,
    lastFallDamage: 0,
    flying: false,
  };
}

function collides(world, x, y, w, h) {
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

function moveX(world, p, dx) {
  if (dx === 0) return;
  const n = Math.ceil(Math.abs(dx) / MAX_STEP);
  const step = dx / n;
  for (let i = 0; i < n; i++) {
    p.x += step;
    if (collides(world, p.x, p.y, p.w, p.h)) {
      if (step > 0) p.x = Math.floor((p.x + p.w) / CELL) * CELL - p.w;
      else p.x = (Math.floor(p.x / CELL) + 1) * CELL;
      p.vx = 0;
      return;
    }
  }
}

function moveY(world, p, dy) {
  if (dy === 0) return;
  const n = Math.ceil(Math.abs(dy) / MAX_STEP);
  const step = dy / n;
  for (let i = 0; i < n; i++) {
    p.y += step;
    if (collides(world, p.x, p.y, p.w, p.h)) {
      if (step > 0) {
        p.y = Math.floor((p.y + p.h) / CELL) * CELL - p.h;
        p.onGround = true;

        // Daño de caída solo en Modo Difícil
        if (IS_HARD) {
          const fallCellsPerSec = p.vy / CELL;
          if (fallCellsPerSec > FALL_SAFE_SPEED) {
            const dmg = Math.round((fallCellsPerSec - FALL_SAFE_SPEED) * FALL_DMG_MULT);
            if (dmg > 0) p.lastFallDamage = dmg;
          }
        }
      } else {
        p.y = (Math.floor(p.y / CELL) + 1) * CELL;
      }
      p.vy = 0;
      return;
    }
  }
}

export function updatePlayer(world, p, input, dt) {
  p.lastFallDamage = 0;
  if (!IS_HARD) p.hp = p.maxHp;
  if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);

  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  p.vx = dir * MOVE_SPEED * CELL;

  if (input.jump && p.onGround) {
    p.vy = -JUMP_SPEED * CELL;
    p.onGround = false;
  }

  p.vy = Math.min(p.vy + GRAVITY * CELL * dt, MAX_FALL * CELL);

  p.flying = false;
  if (input.jump && !p.onGround && p.fuel > 0 && p.vy > -FLY_SPEED * CELL) {
    p.vy = Math.max(p.vy - THRUST * CELL * dt, -FLY_SPEED * CELL);
    p.fuel = Math.max(0, p.fuel - FUEL_USE * dt);
    p.flying = true;
  }

  moveX(world, p, p.vx * dt);
  p.onGround = false;
  moveY(world, p, p.vy * dt);

  if (p.onGround) p.fuel = Math.min(p.fuelMax, p.fuel + FUEL_REGEN * dt);
}