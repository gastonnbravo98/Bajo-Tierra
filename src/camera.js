import { CELL, COLS, ROWS, IS_INFINITE } from './config.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// Mueve el container del mundo para que el jugador quede centrado en pantalla
export function updateCamera(layer, screen, p) {
  let camX = p.x + p.w / 2 - screen.width / 2;
  let camY = p.y + p.h / 2 - screen.height / 2;

  if (IS_INFINITE) {
    // En infinito solo evitamos subir demasiado al cielo vacío
    camY = Math.max(-screen.height * 0.35, camY);
  } else {
    const worldW = COLS * CELL;
    const worldH = ROWS * CELL;
    camX = worldW <= screen.width  ? (worldW - screen.width) / 2  : clamp(camX, 0, worldW - screen.width);
    camY = worldH <= screen.height ? (worldH - screen.height) / 2 : clamp(camY, 0, worldH - screen.height);
  }

  layer.position.set(-Math.round(camX), -Math.round(camY));
}