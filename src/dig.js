import { COLS, ROWS, AIR, HARDNESS } from './config.js';
import { chunkIndexOf } from './chunks.js';

// Vacía las celdas dentro de un círculo centrado en la celda (cx, cy) (máscara de sustracción).
// - power: dureza máxima que se puede romper. Lo más duro queda intacto y se cuenta en "blocked".
// - onBreak(x, y, tipo): se llama por cada celda rota (la usan las partículas).
// Anota cada celda destruida en delta, marca el chunk para redibujar y
// devuelve { broken: {tipo: cantidad}, count, blocked }.
export function dig(world, delta, chunks, cx, cy, radius, power, onBreak) {
  const broken = {};
  let count = 0;
  let blocked = 0;
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
      if (HARDNESS[type] > power) { blocked++; continue; }

      broken[type] = (broken[type] || 0) + 1;
      count++;
      world[i] = AIR;

      const c = chunkIndexOf(x, y);
      let set = delta.get(c);
      if (!set) { set = new Set(); delta.set(c, set); }
      set.add(i);
      chunks.markDirty(c);

      if (onBreak) onBreak(x, y, type);
    }
  }
  return { broken, count, blocked };
}

// Reaplica sobre un mundo recién generado todo lo que el jugador destruyó
export function applyDelta(world, delta) {
  for (const set of delta.values()) {
    for (const i of set) world[i] = AIR;
  }
}
