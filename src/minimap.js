import {
  CELL, COLS, ROWS, CHUNK, COLORS, AIR, MINIMAP_RADIUS,
  IS_INFINITE,
  GOLD, DIAMOND, CRYSTAL, RUBY, EMERALD, LAVA, GAS,
} from './config.js';
import { CHUNKS_X } from './chunks.js';

const HIGHLIGHT_ORES = new Set([GOLD, DIAMOND, CRYSTAL, RUBY, EMERALD]);

function rgbOf(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

export function createMinimap(world) {
  const canvas = document.createElement('canvas');
  canvas.id = 'minimap';
  canvas.style.borderColor = '#7a4e2d';
  canvas.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.65)';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let big = false;

  const mapW = IS_INFINITE ? 220 : COLS;
  const mapH = IS_INFINITE ? 160 : ROWS;
  canvas.width = mapW;
  canvas.height = mapH;

  const off = document.createElement('canvas');
  off.width = mapW;
  off.height = mapH;
  const offCtx = off.getContext('2d');

  // Registro de celdas exploradas (activo tanto en Fácil como en Difícil)
  const explored = IS_INFINITE ? new Set() : new Uint8Array(COLS * ROWS);

  function paintFiniteChunk(chunkIndex) {
    if (IS_INFINITE || typeof chunkIndex !== 'number') return;
    const cx0 = (chunkIndex % CHUNKS_X) * CHUNK;
    const cy0 = Math.floor(chunkIndex / CHUNKS_X) * CHUNK;
    if (cx0 < 0 || cx0 >= COLS || cy0 < 0 || cy0 >= ROWS) return;

    const img = offCtx.createImageData(CHUNK, CHUNK);
    const data = img.data;

    for (let dy = 0; dy < CHUNK; dy++) {
      const y = cy0 + dy;
      if (y >= ROWS) break;
      for (let dx = 0; dx < CHUNK; dx++) {
        const x = cx0 + dx;
        if (x >= COLS) break;
        const idx = (dy * CHUNK + dx) * 4;
        const seen = explored[y * COLS + x] === 1;

        if (!seen) {
          data[idx] = 12;
          data[idx + 1] = 9;
          data[idx + 2] = 14;
          data[idx + 3] = 255;
          continue;
        }

        const t = world.get(x, y);
        if (t === AIR) {
          const isSky = y < Math.round(ROWS * 0.14);
          data[idx] = isSky ? 42 : 24;
          data[idx + 1] = isSky ? 72 : 17;
          data[idx + 2] = isSky ? 105 : 15;
          data[idx + 3] = 255;
        } else {
          const [r, g, b] = rgbOf(COLORS[t] ?? 0x555555);
          const boost = HIGHLIGHT_ORES.has(t) ? 1.25 : 1;
          data[idx] = Math.min(255, Math.round(r * boost));
          data[idx + 1] = Math.min(255, Math.round(g * boost));
          data[idx + 2] = Math.min(255, Math.round(b * boost));
          data[idx + 3] = 255;
        }
      }
    }

    offCtx.putImageData(img, cx0, cy0);
  }

  // Pintado inicial cubierto por niebla de guerra
  if (!IS_INFINITE) {
    const totalChunks = (COLS / CHUNK) * (ROWS / CHUNK);
    for (let i = 0; i < totalChunks; i++) paintFiniteChunk(i);
  }

  function reveal(pcx, pcy, bonusRadius = 0) {
    const r = Math.round(MINIMAP_RADIUS + bonusRadius);
    const r2 = r * r;

    if (IS_INFINITE) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r2) {
            explored.add(`${pcx + dx},${pcy + dy}`);
          }
        }
      }
      if (explored.size > 45000) {
        let drop = 10000;
        for (const k of explored) {
          explored.delete(k);
          if (--drop <= 0) break;
        }
      }
      return;
    }

    const dirtyChunks = new Set();
    const x0 = Math.max(0, pcx - r);
    const x1 = Math.min(COLS - 1, pcx + r);
    const y0 = Math.max(0, pcy - r);
    const y1 = Math.min(ROWS - 1, pcy + r);

    for (let y = y0; y <= y1; y++) {
      const dy = y - pcy;
      for (let x = x0; x <= x1; x++) {
        const dx = x - pcx;
        if (dx * dx + dy * dy > r2) continue;
        const i = y * COLS + x;
        if (explored[i] === 0) {
          explored[i] = 1;
          dirtyChunks.add(Math.floor(y / CHUNK) * CHUNKS_X + Math.floor(x / CHUNK));
        }
      }
    }
    for (const ch of dirtyChunks) paintFiniteChunk(ch);
  }

  function drawInfiniteRadar(pcx, pcy) {
    const halfW = Math.floor(mapW / 2);
    const halfH = Math.floor(mapH / 2);
    const xStart = pcx - halfW;
    const yStart = pcy - halfH;

    const img = ctx.createImageData(mapW, mapH);
    const data = img.data;

    for (let py = 0; py < mapH; py++) {
      const wy = yStart + py;
      for (let px = 0; px < mapW; px++) {
        const wx = xStart + px;
        const idx = (py * mapW + px) * 4;

        if (wy < 0) {
          data[idx] = 36;
          data[idx + 1] = 64;
          data[idx + 2] = 96;
          data[idx + 3] = 255;
          continue;
        }

        const seen = explored.has(`${wx},${wy}`);
        if (!seen) {
          data[idx] = 12;
          data[idx + 1] = 9;
          data[idx + 2] = 14;
          data[idx + 3] = 255;
          continue;
        }

        const t = world.get(wx, wy);
        if (t === AIR) {
          const isSky = wy < world.surfaceAt(wx);
          data[idx] = isSky ? 42 : 24;
          data[idx + 1] = isSky ? 72 : 17;
          data[idx + 2] = isSky ? 105 : 15;
          data[idx + 3] = 255;
        } else {
          const [r, g, b] = rgbOf(COLORS[t] ?? 0x555555);
          const boost = HIGHLIGHT_ORES.has(t) || t === LAVA || t === GAS ? 1.25 : 1;
          data[idx] = Math.min(255, Math.round(r * boost));
          data[idx + 1] = Math.min(255, Math.round(g * boost));
          data[idx + 2] = Math.min(255, Math.round(b * boost));
          data[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(img, 0, 0);
    return { originX: xStart, originY: yStart };
  }

  function draw({ player, camX, camY, screenW, screenH, bases = [], goalRow = -1 }) {
    const pcx = Math.floor((player.x + player.w / 2) / CELL);
    const pcy = Math.floor((player.y + player.h / 2) / CELL);

    let originX = 0;
    let originY = 0;

    if (IS_INFINITE) {
      const view = drawInfiniteRadar(pcx, pcy);
      originX = view.originX;
      originY = view.originY;
    } else {
      ctx.drawImage(off, 0, 0);
    }

    // 1. Línea de Meta (si corresponde)
    if (goalRow >= 0) {
      const gy = goalRow - originY;
      if (gy >= 0 && gy < mapH) {
        ctx.fillStyle = 'rgba(255, 224, 102, 0.75)';
        for (let x = 0; x < mapW; x += 4) ctx.fillRect(x, gy, 2, 1);
      }
    }

    // 2. Recuadro sutil de la cámara actual
    const vx = camX / CELL - originX;
    const vy = camY / CELL - originY;
    const vw = screenW / CELL;
    const vh = screenH / CELL;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(vx) + 0.5, Math.round(vy) + 0.5, Math.round(vw), Math.round(vh));

    // 3. Bases (Tienda principal en dorado, Puestos Avanzados en celeste)
    for (const b of bases) {
      const bx = Math.round(b.col - originX);
      const by = Math.round(b.row - originY - 1);
      if (bx < -2 || bx > mapW + 2 || by < -2 || by > mapH + 2) continue;
      ctx.fillStyle = '#140d0a';
      ctx.fillRect(bx - 2, by - 2, 5, 5);
      ctx.fillStyle = b.main ? '#ffcf5a' : '#4fe3ff';
      ctx.fillRect(bx - 1, by - 1, 3, 3);
    }

    // 4. Jugador con pulso blanco/celeste
    const px = Math.round(pcx - originX);
    const py = Math.round(pcy - originY);
    const pulse = (Math.sin(performance.now() * 0.008) + 1) * 0.5;
    ctx.fillStyle = `rgba(79, 227, 255, ${0.35 + pulse * 0.45})`;
    ctx.fillRect(px - 2, py - 2, 5, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px - 1, py - 1, 3, 3);
  }

  return {
    redrawChunk(c) {
      paintFiniteChunk(c);
    },
    reveal,
    draw,
    toggleSize() {
      big = !big;
      canvas.classList.toggle('big', big);
      canvas.style.borderColor = big ? '#ffcf5a' : '#7a4e2d';
      return big;
    },
    destroy() {
      canvas.remove();
    },
  };
}