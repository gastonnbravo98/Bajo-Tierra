import { COLS, ROWS, CELL, CHUNK, AIR, COLORS, MINIMAP_RADIUS, IS_INFINITE } from './config.js';
import { CHUNKS_X } from './chunks.js';

const FOG = 0x0a0a0a;
const EMPTY = 0x24323d;
const RADAR_SIZE = 160; // 160x160 celdas alrededor del jugador en modo infinito

export function createMinimap(world) {
  const view = document.createElement('canvas');
  view.id = 'minimap';
  document.body.appendChild(view);
  const ctx = view.getContext('2d');

  // ---------- MODO INFINITO: Radar local centrado en el jugador ----------
  if (IS_INFINITE) {
    view.width = RADAR_SIZE;
    view.height = RADAR_SIZE;
    const explored = new Set(); // "x,y"
    const img = ctx.createImageData(RADAR_SIZE, RADAR_SIZE);

    return {
      toggleSize() { return view.classList.toggle('big'); },

      reveal(px, py) {
        const R = MINIMAP_RADIUS;
        for (let y = py - R; y <= py + R; y++) {
          if (y < 0) continue;
          for (let x = px - R; x <= px + R; x++) {
            const dx = x - px;
            const dy = y - py;
            if (dx * dx + dy * dy <= R * R) explored.add(`${x},${y}`);
          }
        }
      },

      redrawChunk() {}, // en modo radar se dibuja directo alrededor del jugador

      draw({ player, camX, camY, screenW, screenH, bases = [], goalRow }) {
        const px = Math.floor((player.x + player.w / 2) / CELL);
        const py = Math.floor((player.y + player.h / 2) / CELL);
        const half = RADAR_SIZE >> 1;
        const x0 = px - half;
        const y0 = py - half;

        for (let ry = 0; ry < RADAR_SIZE; ry++) {
          const wy = y0 + ry;
          for (let rx = 0; rx < RADAR_SIZE; rx++) {
            const wx = x0 + rx;
            let color = FOG;
            if (wy < 0) {
              color = 0x162436; // cielo nocturno
            } else if (explored.has(`${wx},${wy}`)) {
              const t = world.get(wx, wy);
              color = t === AIR ? EMPTY : COLORS[t];
            }
            const p = (ry * RADAR_SIZE + rx) * 4;
            img.data[p] = (color >> 16) & 255;
            img.data[p + 1] = (color >> 8) & 255;
            img.data[p + 2] = color & 255;
            img.data[p + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);

        // Línea de hito / profundidad
        if (goalRow >= y0 && goalRow < y0 + RADAR_SIZE) {
          ctx.fillStyle = 'rgba(255, 224, 102, 0.75)';
          ctx.fillRect(0, goalRow - y0, RADAR_SIZE, 1.5);
        }

        // Tienda principal y puestos avanzados
        for (const b of bases) {
          const bx = b.col - x0;
          const by = b.row - y0;
          if (bx >= -4 && bx <= RADAR_SIZE + 4 && by >= -4 && by <= RADAR_SIZE + 4) {
            ctx.fillStyle = b.main ? '#38b95e' : '#4fe3ff';
            ctx.fillRect(bx - 2, by - 3, 5, 3);
          }
        }

        // Cámara
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(camX / CELL - x0, camY / CELL - y0, screenW / CELL, screenH / CELL);

        // Jugador (centro)
        ctx.fillStyle = '#ff5252';
        ctx.fillRect(half - 1.5, half - 1.5, 3, 3);
      },

      destroy() { view.remove(); },
    };
  }

  // ---------- MODO FINITO (original) ----------
  const raw = world.raw || world;
  const explored = new Uint8Array(COLS * ROWS);
  const base = document.createElement('canvas');
  base.width = COLS;
  base.height = ROWS;
  const bctx = base.getContext('2d');
  const img = bctx.createImageData(COLS, ROWS);
  let changed = true;

  function paint(i) {
    const type = raw[i];
    const color = !explored[i] ? FOG : type === AIR ? EMPTY : COLORS[type];
    const p = i * 4;
    img.data[p] = (color >> 16) & 255;
    img.data[p + 1] = (color >> 8) & 255;
    img.data[p + 2] = color & 255;
    img.data[p + 3] = 255;
  }
  for (let i = 0; i < COLS * ROWS; i++) paint(i);

  view.width = COLS;
  view.height = ROWS;

  return {
    toggleSize() { return view.classList.toggle('big'); },

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

    redrawChunk(c) {
      if (typeof c !== 'number') return;
      const x0 = (c % CHUNKS_X) * CHUNK;
      const y0 = Math.floor(c / CHUNKS_X) * CHUNK;
      for (let y = y0; y < y0 + CHUNK; y++) {
        for (let x = x0; x < x0 + CHUNK; x++) paint(y * COLS + x);
      }
      changed = true;
    },

    draw({ player, camX, camY, screenW, screenH, bases = [], goalRow }) {
      if (changed) { bctx.putImageData(img, 0, 0); changed = false; }
      ctx.drawImage(base, 0, 0);

      if (goalRow >= 0 && goalRow < ROWS) {
        ctx.fillStyle = 'rgba(255, 224, 102, 0.75)';
        ctx.fillRect(0, goalRow, COLS, 1.5);
      }

      for (const b of bases) {
        ctx.fillStyle = b.main ? '#38b95e' : '#4fe3ff';
        ctx.fillRect(b.col - 2, b.row - 3, 5, 3);
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(camX / CELL, camY / CELL, screenW / CELL, screenH / CELL);

      ctx.fillStyle = '#ff5252';
      const px = (player.x + player.w / 2) / CELL;
      const py = (player.y + player.h / 2) / CELL;
      ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
    },

    destroy() { view.remove(); },
  };
}