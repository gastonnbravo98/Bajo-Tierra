import { CELL, COLS, ROWS, CHUNK, COLORS } from './config.js';

export const CHUNKS_X = COLS / CHUNK;
export const CHUNKS_Y = ROWS / CHUNK;

// ¿A qué chunk pertenece la celda (cx, cy)?
export function chunkIndexOf(cx, cy) {
  return Math.floor(cy / CHUNK) * CHUNKS_X + Math.floor(cx / CHUNK);
}

// Crea un Graphics por chunk y lleva la cuenta de cuáles hay que redibujar ("dirty")
export function createChunks(world) {
  const container = new PIXI.Container();
  const graphics = [];
  const dirty = new Set();
  const total = CHUNKS_X * CHUNKS_Y;

  for (let i = 0; i < total; i++) {
    const g = new PIXI.Graphics();
    g.position.set(
      (i % CHUNKS_X) * CHUNK * CELL,
      Math.floor(i / CHUNKS_X) * CHUNK * CELL
    );
    container.addChild(g);
    graphics.push(g);
    dirty.add(i);
  }

  function drawChunk(i) {
    const x0 = (i % CHUNKS_X) * CHUNK;
    const y0 = Math.floor(i / CHUNKS_X) * CHUNK;
    const g = graphics[i];
    g.clear();
    for (const type of Object.keys(COLORS)) {
      let any = false;
      for (let y = y0; y < y0 + CHUNK; y++) {
        for (let x = x0; x < x0 + CHUNK; x++) {
          if (world[y * COLS + x] === Number(type)) {
            g.rect((x - x0) * CELL, (y - y0) * CELL, CELL, CELL);
            any = true;
          }
        }
      }
      if (any) g.fill(COLORS[type]);
    }
  }

  return {
    container,
    markDirty(i) { dirty.add(i); },
    markAllDirty() { for (let i = 0; i < total; i++) dirty.add(i); },
    // redibuja los chunks marcados y devuelve su lista (la usa el minimapa)
    rebuildDirty() {
      const rebuilt = [...dirty];
      for (const i of rebuilt) drawChunk(i);
      dirty.clear();
      return rebuilt;
    },
  };
}