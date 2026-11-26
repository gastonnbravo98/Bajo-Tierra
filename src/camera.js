import { CELL, COLS, ROWS, IS_INFINITE } from './config.js';

export const MAX_VIEW_W = 1920;
export const MAX_VIEW_H = 1080;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * Mueve y escala el container del mundo para mantener el viewport acotado incluso si se aleja el zoom del navegador.
 */
export function updateCamera(layer, screen, p) {
  const scale = Math.max(1, screen.width / MAX_VIEW_W, screen.height / MAX_VIEW_H);
  const viewW = screen.width / scale;
  const viewH = screen.height / scale;

  let camX = p.x + p.w / 2 - viewW / 2;
  let camY = p.y + p.h / 2 - viewH / 2;

  if (IS_INFINITE) {
    // En infinito solo evitamos subir demasiado al cielo vacío
    camY = Math.max(-viewH * 0.35, camY);
  } else {
    const worldW = COLS * CELL;
    const worldH = ROWS * CELL;
    camX = worldW <= viewW ? (worldW - viewW) / 2 : clamp(camX, 0, worldW - viewW);
    camY = worldH <= viewH ? (worldH - viewH) / 2 : clamp(camY, 0, worldH - viewH);
  }

  layer.scale.set(scale);
  layer.position.set(-Math.round(camX * scale), -Math.round(camY * scale));
  return { camX, camY, scale, viewW, viewH };
}