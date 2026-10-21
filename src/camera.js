import { CELL, COLS, ROWS } from './config.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// Mueve el container del mundo para que el jugador quede centrado en pantalla
export function updateCamera(layer, screen, p) {
  const worldW = COLS * CELL;
  const worldH = ROWS * CELL;

  let camX = p.x + p.w / 2 - screen.width / 2;
  let camY = p.y + p.h / 2 - screen.height / 2;

  // no mostrar nada fuera del mundo; si el mundo es más chico que la pantalla, centrarlo
  camX = worldW <= screen.width  ? (worldW - screen.width) / 2  : clamp(camX, 0, worldW - screen.width);
  camY = worldH <= screen.height ? (worldH - screen.height) / 2 : clamp(camY, 0, worldH - screen.height);

  // redondear evita líneas finas entre celdas al moverse
  layer.position.set(-Math.round(camX), -Math.round(camY));
}