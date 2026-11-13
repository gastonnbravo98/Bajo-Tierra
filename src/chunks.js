import {
  CELL, COLS, ROWS, CHUNK, COLORS, AIR, BIOME_TINT, TINTABLE,
  IRON, COPPER, SILVER, GOLD, CRYSTAL, RUBY, EMERALD, DIAMOND,
} from './config.js';

// los chunks por lado cambian con el tamaño del mundo, así que se re-exportan de config
export { CHUNKS_X, CHUNKS_Y } from './config.js';
import { CHUNKS_X, CHUNKS_Y } from './config.js';

// ¿A qué chunk pertenece la celda (cx, cy)?
export function chunkIndexOf(cx, cy) {
  return Math.floor(cy / CHUNK) * CHUNKS_X + Math.floor(cx / CHUNK);
}

// Tres tonos por tipo de celda (el terreno no se ve plano) y un tinte según el bioma.
// El tono depende solo de la posición, así que no cambia al redibujar.
const SHADE = [1, 0.9, 0.8];
const tone = (x, y) => ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0) % 3;
const TINTABLE_SET = new Set(TINTABLE);
const GLINT_ORES = new Set([IRON, COPPER, SILVER, GOLD, CRYSTAL, RUBY, EMERALD, DIAMOND]);
const colorCache = new Map();

function colorFor(type, tn, biome) {
  const key = (type * 3 + tn) * 4 + biome;
  let color = colorCache.get(key);
  if (color === undefined) {
    const base = COLORS[type];
    const tint = TINTABLE_SET.has(type) ? BIOME_TINT[biome] : [1, 1, 1];
    const ch = (shift, k) => Math.min(255, Math.round(((base >> shift) & 255) * SHADE[tn] * tint[k]));
    color = (ch(16, 0) << 16) | (ch(8, 1) << 8) | ch(0, 2);
    colorCache.set(key, color);
  }
  return color;
}

// Crea un Graphics por chunk y lleva la cuenta de cuáles hay que redibujar ("dirty").
// biomes (opcional) es el mapa de biomas, para teñir las rocas.
export function createChunks(world, biomes) {
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

    // agrupar las celdas por tipo, tono y bioma: un solo fill por grupo
    const buckets = {};
    const glints = [];
    for (let y = y0; y < y0 + CHUNK; y++) {
      for (let x = x0; x < x0 + CHUNK; x++) {
        const idx = y * COLS + x;
        const t = world[idx];
        if (t === AIR) continue;
        const b = biomes ? biomes[idx] : 0;
        const key = (t * 3 + tone(x, y)) * 4 + b;
        (buckets[key] || (buckets[key] = [])).push(x, y);
        if (GLINT_ORES.has(t)) glints.push(x, y);
      }
    }
    for (const key in buckets) {
      const list = buckets[key];
      for (let k = 0; k < list.length; k += 2) {
        g.rect((list[k] - x0) * CELL, (list[k + 1] - y0) * CELL, CELL, CELL);
      }
      const b = key % 4;
      const rest = (key - b) / 4;
      const tn = rest % 3;
      g.fill(colorFor((rest - tn) / 3, tn, b));
    }

    // Destellos sobre las vetas de mineral
    if (glints.length) {
      for (let k = 0; k < glints.length; k += 2) {
        const gx = glints[k];
        const gy = glints[k + 1];
        const lx = (gx - x0) * CELL;
        const ly = (gy - y0) * CELL;
        const alt = (gx + gy) & 1;
        g.rect(lx + (alt ? 3 : 4), ly + 3, 3, 3);
        g.rect(lx + (alt ? 10 : 9), ly + 10, 2, 2);
      }
      g.fill({ color: 0xffffff, alpha: 0.45 });

      for (let k = 0; k < glints.length; k += 2) {
        const gx = glints[k];
        const gy = glints[k + 1];
        const lx = (gx - x0) * CELL;
        const ly = (gy - y0) * CELL;
        const alt = (gx + gy) & 1;
        g.rect(lx + (alt ? 4 : 5), ly + 4, 1.5, 1.5);
      }
      g.fill({ color: 0xffffff, alpha: 0.85 });
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