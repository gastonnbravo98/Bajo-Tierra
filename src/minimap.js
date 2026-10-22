import { COLS, ROWS, CELL, CHUNK, AIR, COLORS, MINIMAP_RADIUS } from './config.js';
import { CHUNKS_X } from './chunks.js';

const FOG = 0x0a0a0a;    // celda sin explorar
const EMPTY = 0x24323d;  // aire ya explorado

export function createMinimap(world) {
  const explored = new Uint8Array(COLS * ROWS);

  // capa base: un píxel por celda
  const base = document.createElement('canvas');
  base.width = COLS;
  base.height = ROWS;
  const bctx = base.getContext('2d');
  const img = bctx.createImageData(COLS, ROWS);
  let changed = true;

  function paint(i) {
    const type = world[i];
    const color = !explored[i] ? FOG : type === AIR ? EMPTY : COLORS[type];
    const p = i * 4;
    img.data[p] = (color >> 16) & 255;
    img.data[p + 1] = (color >> 8) & 255;
    img.data[p + 2] = color & 255;
    img.data[p + 3] = 255;
  }
  for (let i = 0; i < COLS * ROWS; i++) paint(i);

  // lienzo visible (el CSS lo agranda y lo ubica a la derecha)
  const view = document.createElement('canvas');
  view.id = 'minimap';
  view.width = COLS;
  view.height = ROWS;
  document.body.appendChild(view);
  const ctx = view.getContext('2d');

  return {
    // descubrir lo que rodea al jugador (px, py en celdas)
    reveal(px, py) {
      const R = MINIMAP_RADIUS;
      for (let y = py - R; y <= py + R; y++) {
        for (let x = px - R; x <= px + R; x++) {
          if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
          const dx = x - px;
          const dy = y - py;
          if (dx * dx + dy * dy > R * R) continue;
          const i = y * COLS + x;
          if (explored[i]) continue;
          explored[i] = 1;
          paint(i);
          changed = true;
        }
      }
    },

    // repintar un chunk que cambió (cavado, regeneración)
    redrawChunk(c) {
      const x0 = (c % CHUNKS_X) * CHUNK;
      const y0 = Math.floor(c / CHUNKS_X) * CHUNK;
      for (let y = y0; y < y0 + CHUNK; y++) {
        for (let x = x0; x < x0 + CHUNK; x++) paint(y * COLS + x);
      }
      changed = true;
    },

    // camX, camY y screenW, screenH están en píxeles del mundo
    draw(player, camX, camY, screenW, screenH) {
      if (changed) { bctx.putImageData(img, 0, 0); changed = false; }
      ctx.drawImage(base, 0, 0);

      // recuadro de lo que ve la cámara
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(camX / CELL, camY / CELL, screenW / CELL, screenH / CELL);

      // jugador
      ctx.fillStyle = '#ff5252';
      const px = (player.x + player.w / 2) / CELL;
      const py = (player.y + player.h / 2) / CELL;
      ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
    },

    destroy() { view.remove(); },
  };
}