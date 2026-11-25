import {
  CELL, COLS, ROWS, CHUNK, COLORS, AIR, BIOME_TINT, TINTABLE, IS_INFINITE,
  IRON, COPPER, SILVER, GOLD, CRYSTAL, RUBY, EMERALD, DIAMOND,
} from './config.js';
import { CHUNKS_X, CHUNKS_Y } from './config.js';
import { chunkKey } from './world.js';

export { CHUNKS_X, CHUNKS_Y };

export function chunkIndexOf(cx, cy) {
  const chx = Math.floor(cx / CHUNK);
  const chy = Math.floor(cy / CHUNK);
  return IS_INFINITE ? chunkKey(chx, chy) : chy * CHUNKS_X + chx;
}

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

function paintChunkGraphics(g, world, biomes, chx, chy) {
  const x0 = chx * CHUNK;
  const y0 = chy * CHUNK;
  g.clear();

  const buckets = {};
  const glints = [];
  for (let y = y0; y < y0 + CHUNK; y++) {
    for (let x = x0; x < x0 + CHUNK; x++) {
      const t = world.get(x, y);
      if (t === AIR) continue;
      const b = world.infinite ? world.biomeAt(x, y) : (biomes ? biomes[y * COLS + x] : 0);
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

export function createChunks(world, biomes) {
  const container = new PIXI.Container();
  const size = CHUNK * CELL;

  // ---------- RAMA INFINITA ----------
  if (world.infinite) {
    const gfxMap = new Map(); // "cx,cy" -> PIXI.Graphics
    const dirty = new Set();
    let visibleCount = 0;

    return {
      container,
      get total() { return gfxMap.size; },
      get visibleCount() { return visibleCount; },
      markDirty(key) { dirty.add(key); },
      markAllDirty() { for (const k of gfxMap.keys()) dirty.add(k); },

      rebuildDirty() {
        const rebuilt = [];
        for (const key of dirty) {
          const g = gfxMap.get(key);
          if (!g || !g.visible) continue; // lazy: no dibuja lo que está fuera de cámara
          const [cx, cy] = key.split(',').map(Number);
          paintChunkGraphics(g, world, null, cx, cy);
          dirty.delete(key);
          rebuilt.push(key);
        }
        return rebuilt;
      },

      updateVisibility(camX, camY, screenW, screenH) {
        const cx0 = Math.floor(camX / size) - 1;
        const cx1 = Math.floor((camX + screenW) / size) + 1;
        const cy0 = Math.max(0, Math.floor(camY / size) - 1);
        const cy1 = Math.floor((camY + screenH) / size) + 1;

        const needed = new Set();
        let vis = 0;

        for (let cy = cy0; cy <= cy1; cy++) {
          for (let cx = cx0; cx <= cx1; cx++) {
            const key = chunkKey(cx, cy);
            needed.add(key);
            let g = gfxMap.get(key);
            if (!g) {
              g = new PIXI.Graphics();
              g.position.set(cx * size, cy * size);
              container.addChild(g);
              gfxMap.set(key, g);
              dirty.add(key);
            }
            const onScreen = cx * size < camX + screenW && (cx + 1) * size > camX &&
                             cy * size < camY + screenH && (cy + 1) * size > camY;
            g.visible = onScreen;
            if (onScreen) vis++;
          }
        }

        // Destruir gráficos que salieron del margen de cámara
        for (const [key, g] of gfxMap) {
          if (!needed.has(key)) {
            container.removeChild(g);
            g.destroy();
            gfxMap.delete(key);
            dirty.delete(key);
          }
        }

        // Liberar datos de chunks muy lejanos sin cambios
        world.pruneFar(cx0 - 6, cx1 + 6, Math.max(0, cy0 - 6), cy1 + 6);
        visibleCount = vis;
      },
    };
  }

  // ---------- RAMA FINITA (original) ----------
  const graphics = [];
  const dirty = new Set();
  const total = CHUNKS_X * CHUNKS_Y;
  let visibleCount = total;

  for (let i = 0; i < total; i++) {
    const g = new PIXI.Graphics();
    g.position.set((i % CHUNKS_X) * size, Math.floor(i / CHUNKS_X) * size);
    container.addChild(g);
    graphics.push(g);
    dirty.add(i);
  }

  return {
    container,
    total,
    get visibleCount() { return visibleCount; },
    markDirty(i) { dirty.add(i); },
    markAllDirty() { for (let i = 0; i < total; i++) dirty.add(i); },

    rebuildDirty() {
      const rebuilt = [];
      for (const i of dirty) {
        if (!graphics[i].visible) continue;
        paintChunkGraphics(graphics[i], world, biomes, i % CHUNKS_X, Math.floor(i / CHUNKS_X));
        dirty.delete(i);
        rebuilt.push(i);
      }
      return rebuilt;
    },

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