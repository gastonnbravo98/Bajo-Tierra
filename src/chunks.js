import {
  CELL, COLS, ROWS, CHUNK, COLORS, AIR, BIOME_TINT, TINTABLE, IS_INFINITE,
  IRON, COPPER, SILVER, GOLD, CRYSTAL, RUBY, EMERALD, DIAMOND, LAVA, GAS,
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
const hash2 = (x, y) => ((Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0) / 4294967295;
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

function paintChunkGraphics(g, world, biomes, chx, chy, meta) {
  const x0 = chx * CHUNK;
  const y0 = chy * CHUNK;
  g.clear();

  const buckets = {};
  const glints = [];
  const lavas = [];
  const surfaceLavas = [];
  const gases = [];

  for (let y = y0; y < y0 + CHUNK; y++) {
    for (let x = x0; x < x0 + CHUNK; x++) {
      const t = world.get(x, y);
      if (t === AIR) continue;

      if (t === GAS) {
        gases.push(x, y);
        continue;
      }

      if (t === LAVA) {
        lavas.push(x, y);
        if (world.get(x, y - 1) === AIR) surfaceLavas.push(x, y);
        continue;
      }

      const b = world.infinite ? world.biomeAt(x, y) : (biomes ? biomes[y * COLS + x] : 0);
      const key = (t * 3 + tone(x, y)) * 4 + b;
      (buckets[key] || (buckets[key] = [])).push(x, y);
      if (GLINT_ORES.has(t)) glints.push(x, y);
    }
  }

  if (meta) {
    meta.lavas = lavas;
    meta.surfaceLavas = surfaceLavas;
    meta.gases = gases;
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

  // ---------- Cuerpo continuo de LAVA (sin bloques ni puntos aislados) ----------
  if (lavas.length) {
    // 1. Base profunda uniforme de magma rojo-naranja
    for (let k = 0; k < lavas.length; k += 2) {
      const lx = (lavas[k] - x0) * CELL;
      const ly = (lavas[k + 1] - y0) * CELL;
      g.rect(lx, ly, CELL, CELL);
    }
    g.fill(0xd93800);

    // 2. Corrientes internas cálidas que cruzan horizontalmente entre celdas vecinas
    for (let k = 0; k < lavas.length; k += 2) {
      const wx = lavas[k];
      const wy = lavas[k + 1];
      const lx = (wx - x0) * CELL;
      const ly = (wy - y0) * CELL;
      const wave = Math.sin(wx * 0.85 + wy * 1.3);
      if (wave > -0.15) {
        const yOff = 4 + Math.cos(wx * 0.6 + wy) * 3;
        g.roundRect(lx - 2, ly + yOff, CELL + 4, 6, 3);
      }
    }
    g.fill({ color: 0xff6d00, alpha: 0.65 });

    // 3. Zonas más densas/oscuras en el fondo del pozo de lava
    for (let k = 0; k < lavas.length; k += 2) {
      const wx = lavas[k];
      const wy = lavas[k + 1];
      if (world.get(wx, wy - 1) === LAVA && world.get(wx, wy + 1) === LAVA) {
        const wave = Math.sin(wx * 0.7 - wy * 0.9);
        if (wave > 0.35) {
          const lx = (wx - x0) * CELL;
          const ly = (wy - y0) * CELL;
          g.roundRect(lx - 1, ly + 5, CELL + 2, 5, 2.5);
        }
      }
    }
    g.fill({ color: 0x8f1d00, alpha: 0.55 });

    // 4. Resplandor cálido por encima de la superficie donde toca el aire
    if (surfaceLavas.length) {
      for (let k = 0; k < surfaceLavas.length; k += 2) {
        const lx = (surfaceLavas[k] - x0) * CELL;
        const ly = (surfaceLavas[k + 1] - y0) * CELL;
        g.rect(lx, ly - 5, CELL, 8);
      }
      g.fill({ color: 0xff7b00, alpha: 0.22 });
    }
  }

  // ---------- Diseño volumétrico de GAS TÓXICO ----------
  if (gases.length) {
    for (let k = 0; k < gases.length; k += 2) {
      const wx = gases[k];
      const wy = gases[k + 1];
      const h = hash2(wx, wy);
      const cx = (wx - x0 + 0.5 + (h - 0.5) * 0.25) * CELL;
      const cy = (wy - y0 + 0.5 + (((wx + wy) & 1) - 0.5) * 0.2) * CELL;
      g.circle(cx, cy, CELL * 0.92);
    }
    g.fill({ color: 0x2ec46b, alpha: 0.16 });

    for (let k = 0; k < gases.length; k += 2) {
      const wx = gases[k];
      const wy = gases[k + 1];
      const h = hash2(wx + 7, wy + 13);
      const cx = (wx - x0 + 0.5 + (h - 0.5) * 0.2) * CELL;
      const cy = (wy - y0 + 0.5) * CELL;
      g.circle(cx, cy, CELL * 0.62);
    }
    g.fill({ color: 0x7ae582, alpha: 0.28 });

    for (let k = 0; k < gases.length; k += 2) {
      const wx = gases[k];
      const wy = gases[k + 1];
      const h = hash2(wx + 19, wy + 3);
      const lx = (wx - x0) * CELL;
      const ly = (wy - y0) * CELL;
      g.circle(lx + CELL * (0.35 + h * 0.3), ly + CELL * (0.35 + (1 - h) * 0.3), CELL * 0.32);
      g.circle(lx + 3 + h * 9, ly + 4 + ((wx * 7) % 8), 1.3);
    }
    g.fill({ color: 0xd8ff9c, alpha: 0.42 });
  }
}

export function createChunks(world, biomes) {
  const container = new PIXI.Container();
  const fxLayer = new PIXI.Graphics();
  const size = CHUNK * CELL;

  // Animación en tiempo real: superficie líquida ondulante + chispas + esporas de gas
  function drawAnimatedHazards(visibleMetas) {
    fxLayer.clear();
    if (!visibleMetas.length) return;

    const t = performance.now() * 0.003;
    let surfBudget = 0;
    let gasBudget = 0;

    // 1. Onda líquida continua en la superficie de la lava
    const sparks = [];
    for (const meta of visibleMetas) {
      const surf = meta.surfaceLavas;
      if (!surf || !surf.length) continue;
      for (let k = 0; k < surf.length; k += 2) {
        if (surfBudget > 220) break;
        surfBudget++;
        const wx = surf[k];
        const wy = surf[k + 1];
        const x = wx * CELL;
        const y = wy * CELL;

        // Dos sub-segmentos por celda para que la ola sea fluida y continua
        const w1 = Math.sin(t * 1.4 + wx * 1.1) * 1.4;
        const w2 = Math.sin(t * 1.4 + (wx + 0.5) * 1.1) * 1.4;
        fxLayer.roundRect(x - 1, y + w1, CELL * 0.6, 3.2, 1.5);
        fxLayer.roundRect(x + CELL * 0.45, y + w2, CELL * 0.6, 3.2, 1.5);

        // Algunas celdas sueltan una brasa ascendente hacia el aire
        const seed = hash2(wx, wy);
        if (seed > 0.62) {
          const cycle = (t * 0.55 + seed * 5) % 1;
          sparks.push(
            x + CELL * (0.2 + seed * 0.6) + Math.sin(t * 2 + wx) * 2.5,
            y - 2 - cycle * 11,
            1.4 * (1 - cycle),
          );
        }
      }
    }
    if (surfBudget > 0) {
      fxLayer.fill({ color: 0xffca3a, alpha: 0.92 });
    }
    if (sparks.length) {
      for (let i = 0; i < sparks.length; i += 3) {
        fxLayer.circle(sparks[i], sparks[i + 1], Math.max(0.5, sparks[i + 2]));
      }
      fxLayer.fill({ color: 0xfff3b0, alpha: 0.85 });
    }

    // 2. Esporas brillantes flotantes de gas
    for (const meta of visibleMetas) {
      const gases = meta.gases;
      if (!gases || !gases.length) continue;
      for (let k = 0; k < gases.length; k += 2) {
        if (gasBudget > 160) break;
        gasBudget++;
        const wx = gases[k];
        const wy = gases[k + 1];
        const phase = hash2(wx + 11, wy + 29) * Math.PI * 2;
        const driftX = Math.sin(t * 0.9 + phase) * 3.2;
        const driftY = Math.cos(t * 0.7 + phase * 1.3) * 2.6;
        const r = 2.2 + Math.sin(t * 1.4 + phase) * 1.1;
        fxLayer.circle((wx + 0.5) * CELL + driftX, (wy + 0.5) * CELL + driftY, Math.max(1, r));
      }
    }
    if (gasBudget > 0) fxLayer.fill({ color: 0xeaffb0, alpha: 0.35 });
  }

  // ---------- RAMA INFINITA ----------
  if (world.infinite) {
    const chunksContainer = new PIXI.Container();
    container.addChild(chunksContainer, fxLayer);

    const gfxMap = new Map();
    const metaMap = new Map();
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
          if (!g || !g.visible) continue;
          const [cx, cy] = key.split(',').map(Number);
          const meta = metaMap.get(key) || { lavas: [], surfaceLavas: [], gases: [] };
          metaMap.set(key, meta);
          paintChunkGraphics(g, world, null, cx, cy, meta);
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
        const visibleMetas = [];
        let vis = 0;

        for (let cy = cy0; cy <= cy1; cy++) {
          for (let cx = cx0; cx <= cx1; cx++) {
            const key = chunkKey(cx, cy);
            needed.add(key);
            let g = gfxMap.get(key);
            if (!g) {
              g = new PIXI.Graphics();
              g.position.set(cx * size, cy * size);
              chunksContainer.addChild(g);
              gfxMap.set(key, g);
              metaMap.set(key, { lavas: [], surfaceLavas: [], gases: [] });
              dirty.add(key);
            }
            const onScreen = cx * size < camX + screenW && (cx + 1) * size > camX &&
                             cy * size < camY + screenH && (cy + 1) * size > camY;
            g.visible = onScreen;
            if (onScreen) {
              vis++;
              const m = metaMap.get(key);
              if (m) visibleMetas.push(m);
            }
          }
        }

        for (const [key, g] of gfxMap) {
          if (!needed.has(key)) {
            chunksContainer.removeChild(g);
            g.destroy();
            gfxMap.delete(key);
            metaMap.delete(key);
            dirty.delete(key);
          }
        }

        world.pruneFar(cx0 - 6, cx1 + 6, Math.max(0, cy0 - 6), cy1 + 6);
        visibleCount = vis;
        drawAnimatedHazards(visibleMetas);
      },
    };
  }

  // ---------- RAMA FINITA ----------
  const chunksContainer = new PIXI.Container();
  container.addChild(chunksContainer, fxLayer);

  const graphics = [];
  const metas = [];
  const dirty = new Set();
  const total = CHUNKS_X * CHUNKS_Y;
  let visibleCount = total;

  for (let i = 0; i < total; i++) {
    const g = new PIXI.Graphics();
    g.position.set((i % CHUNKS_X) * size, Math.floor(i / CHUNKS_X) * size);
    chunksContainer.addChild(g);
    graphics.push(g);
    metas.push({ lavas: [], surfaceLavas: [], gases: [] });
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
        paintChunkGraphics(graphics[i], world, biomes, i % CHUNKS_X, Math.floor(i / CHUNKS_X), metas[i]);
        dirty.delete(i);
        rebuilt.push(i);
      }
      return rebuilt;
    },

    updateVisibility(camX, camY, screenW, screenH) {
      let n = 0;
      const visibleMetas = [];
      for (let i = 0; i < total; i++) {
        const px = (i % CHUNKS_X) * size;
        const py = Math.floor(i / CHUNKS_X) * size;
        const vis = px < camX + screenW && px + size > camX && py < camY + screenH && py + size > camY;
        graphics[i].visible = vis;
        if (vis) {
          n++;
          visibleMetas.push(metas[i]);
        }
      }
      visibleCount = n;
      drawAnimatedHazards(visibleMetas);
    },
  };
}