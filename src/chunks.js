import { CELL, COLS, ROWS, CHUNK, COLORS, AIR } from './config.js';

export const CHUNKS_X = COLS / CHUNK;
export const CHUNKS_Y = ROWS / CHUNK;

// ¿A qué chunk pertenece la celda (cx, cy)?
export function chunkIndexOf(cx, cy) {
  return Math.floor(cy / CHUNK) * CHUNKS_X + Math.floor(cx / CHUNK);
}

// Tres tonos por tipo de celda, para que el terreno no se vea plano
function shade(color, f) {
  const r = Math.round(((color >> 16) & 255) * f);
  const g = Math.round(((color >> 8) & 255) * f);
  const b = Math.round((color & 255) * f);
  return (r << 16) | (g << 8) | b;
}
const SHADES = {};
for (const t of Object.keys(COLORS)) {
  SHADES[t] = [COLORS[t], shade(COLORS[t], 0.9), shade(COLORS[t], 0.8)];
}
// el tono depende solo de la posición, así que no cambia al redibujar
const tone = (x, y) => ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0) % 3;

// Crea un Graphics por chunk y lleva la cuenta de cuáles hay que redibujar ("dirty")
export function createChunks(world) {
  const container = new PIXI.Container();
  const graphics = [];
  const dirty = new Set();
  const total = CHUNKS_X * CHUNKS_Y;
  const size = CHUNK * CELL;
  let visibleCount = total;

  for (let i = 0; i < total; i++) {
    const g = new PIXI.Graphics();
    g.position.set((i % CHUNKS_X) * size, Math.floor(i / CHUNKS_X) * size);
    container.addChild(g);
    graphics.push(g);
    dirty.add(i);
  }

  function drawChunk(i) {
    const x0 = (i % CHUNKS_X) * CHUNK;
    const y0 = Math.floor(i / CHUNKS_X) * CHUNK;
    const g = graphics[i];
    g.clear();

    // agrupar las celdas por tipo y tono: un solo fill por grupo
    const buckets = {};
    for (let y = y0; y < y0 + CHUNK; y++) {
      for (let x = x0; x < x0 + CHUNK; x++) {
        const t = world[y * COLS + x];
        if (t === AIR) continue;
        const key = t * 3 + tone(x, y);
        (buckets[key] || (buckets[key] = [])).push(x, y);
      }
    }
    for (const key in buckets) {
      const list = buckets[key];
      for (let k = 0; k < list.length; k += 2) {
        g.rect((list[k] - x0) * CELL, (list[k + 1] - y0) * CELL, CELL, CELL);
      }
      g.fill(SHADES[Math.floor(key / 3)][key % 3]);
    }
  }

  return {
    container,
    total,
    get visibleCount() { return visibleCount; },
    markDirty(i) { dirty.add(i); },
    markAllDirty() { for (let i = 0; i < total; i++) dirty.add(i); },

    // redibuja los chunks marcados y devuelve su lista (la usa el minimapa)
    rebuildDirty() {
      const rebuilt = [...dirty];
      for (const i of rebuilt) drawChunk(i);
      dirty.clear();
      return rebuilt;
    },

    // solo se dibujan los chunks que se cruzan con la pantalla (camX, camY en píxeles del mundo)
    updateVisibility(camX, camY, screenW, screenH) {
      let n = 0;
      for (let i = 0; i < total; i++) {
        const px = (i % CHUNKS_X) * size;
        const py = Math.floor(i / CHUNKS_X) * size;
        const vis = px < camX + screenW && px + size > camX && py < camY + screenH && py + size > camY;
        graphics[i].visible = vis;
        if (vis) n++;
      }
      visibleCount = n;
    },
  };
}
