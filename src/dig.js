import { COLS, ROWS, AIR } from './config.js';
import { chunkIndexOf } from './chunks.js';

// Vacía las celdas dentro de un círculo centrado en la celda (cx, cy).
// Anota cada celda destruida en delta, marca el chunk para redibujar
// y devuelve un objeto { tipo: cantidad } con lo que se rompió.
export function dig(world, delta, chunks, cx, cy, radius) {
  const broken = {};
  const r = Math.ceil(radius);
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > radius * radius) continue;

      const i = y * COLS + x;
      const type = world[i];
      if (type === AIR) continue;

      broken[type] = (broken[type] || 0) + 1;
      world[i] = AIR;

      const c = chunkIndexOf(x, y);
      let set = delta.get(c);
      if (!set) { set = new Set(); delta.set(c, set); }
      set.add(i);
      chunks.markDirty(c);
    }
  }
  return broken;
}

// Reaplica sobre un mundo recién generado todo lo que el jugador destruyó
export function applyDelta(world, delta) {
  for (const set of delta.values()) {
    for (const i of set) world[i] = AIR;
  }
}