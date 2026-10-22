import {
  CELL, COLS, ROWS, PLAYER_W, PLAYER_H,
  MOVE_SPEED, GRAVITY, JUMP_SPEED, MAX_FALL,
  FUEL_MAX, FUEL_USE, FUEL_REGEN, THRUST, FLY_SPEED,
} from './config.js';
import { isSolid } from './world.js';

const MAX_STEP = CELL / 2; // nunca mover más de media celda por paso

// Crea al jugador parado sobre la superficie de la columna del medio
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
    flying: false,
  };
}

// ¿La caja (x, y, w, h) toca alguna celda llena?
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
        p.y = Math.floor((p.y + p.h) / CELL) * CELL - p.h; // aterrizó
        p.onGround = true;
      } else {
        p.y = (Math.floor(p.y / CELL) + 1) * CELL;          // se pegó la cabeza
      }
      p.vy = 0;
      return;
    }
  }
}

export function updatePlayer(world, p, input, dt) {
  // horizontal
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  p.vx = dir * MOVE_SPEED * CELL;

  // salto: solo si estaba apoyado en el frame anterior
  if (input.jump && p.onGround) {
    p.vy = -JUMP_SPEED * CELL;
    p.onGround = false;
  }

  // gravedad, con límite de velocidad de caída
  p.vy = Math.min(p.vy + GRAVITY * CELL * dt, MAX_FALL * CELL);

  // jetpack: manteniendo salto en el aire, con combustible, y sin pasar la velocidad máxima de subida
  p.flying = false;
  if (input.jump && !p.onGround && p.fuel > 0 && p.vy > -FLY_SPEED * CELL) {
    p.vy = Math.max(p.vy - THRUST * CELL * dt, -FLY_SPEED * CELL);
    p.fuel = Math.max(0, p.fuel - FUEL_USE * dt);
    p.flying = true;
  }

  moveX(world, p, p.vx * dt);
  p.onGround = false; // se vuelve a poner en true si moveY detecta piso
  moveY(world, p, p.vy * dt);

  // en el suelo el combustible se recarga solo
  if (p.onGround) p.fuel = Math.min(FUEL_MAX, p.fuel + FUEL_REGEN * dt);
}