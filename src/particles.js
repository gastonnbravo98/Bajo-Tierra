import {
  CELL, COLS, ROWS, AIR, MAGMA_ROCK, ARENOSO, VOLCANICO, CRISTALINO,
} from './config.js';

const MAX = 350;
const MAX_AMBIENT = 90;

// Escombros, polvo y partículas ambientales por zona.
export function createParticles() {
  const layer = new PIXI.Container();
  const g = new PIXI.Graphics();
  const ambGfx = new PIXI.Graphics();
  layer.addChild(ambGfx, g);

  const list = [];
  const ambient = [];
  let drawn = false;
  let spawnAcc = 0;

  return {
    layer,
    get count() { return list.length + ambient.length; },

    // power > 1 = salen más rápido (explosiones)
    spawn(x, y, color, n = 1, power = 1) {
      for (let k = 0; k < n && list.length < MAX; k++) {
        const life = 0.4 + Math.random() * 0.5;
        list.push({
          x, y,
          vx: (Math.random() - 0.5) * 160 * power,
          vy: -(40 + Math.random() * 140) * power,
          life, max: life,
          size: 2 + Math.random() * 3,
          color,
        });
      }
    },

    // Partículas ambientales según lo que ve la cámara (cielo, magma, cristal, arena, cueva)
    updateAmbient(dt, { camX, camY, screenW, screenH, world, biomes, startRow }) {
      spawnAcc += dt * 18;
      while (spawnAcc >= 1) {
        spawnAcc -= 1;
        if (ambient.length >= MAX_AMBIENT) break;

        const wx = camX + Math.random() * screenW;
        const wy = camY + Math.random() * screenH;
        const cx = Math.floor(wx / CELL);
        const cy = Math.floor(wy / CELL);
        if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) continue;

        const idx = cy * COLS + cx;
        const cell = world[idx];
        const biome = biomes[idx];

        if (cy < startRow - 2 && cell === AIR) {
          // Nubes suaves en el cielo
          const life = 8 + Math.random() * 6;
          ambient.push({
            kind: 'cloud',
            x: wx, y: wy,
            vx: 6 + Math.random() * 10,
            vy: 0,
            w: 36 + Math.random() * 44,
            h: 10 + Math.random() * 8,
            life, max: life,
            color: 0xffffff,
            alpha: 0.16,
          });
        } else if (biome === VOLCANICO || cell === MAGMA_ROCK) {
          // Chispas ascendentes en zona volcánica o magma
          const life = 1.4 + Math.random() * 1.4;
          ambient.push({
            kind: 'spark',
            x: wx, y: wy,
            vx: (Math.random() - 0.5) * 14,
            vy: -(18 + Math.random() * 28),
            w: 2.5, h: 2.5,
            life, max: life,
            color: Math.random() < 0.6 ? 0xff7b29 : 0xffd166,
            alpha: 0.85,
          });
        } else if (biome === CRISTALINO) {
          // Destellos flotantes en zona cristalina
          const life = 1.8 + Math.random() * 1.6;
          ambient.push({
            kind: 'mote',
            x: wx, y: wy,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            w: 2.5, h: 2.5,
            life, max: life,
            color: Math.random() < 0.5 ? 0xb967ff : 0x4fe3ff,
            alpha: 0.75,
          });
        } else if (biome === ARENOSO && cell === AIR) {
          // Polvo dorado en cuevas arenosas
          const life = 2.2 + Math.random() * 1.5;
          ambient.push({
            kind: 'mote',
            x: wx, y: wy,
            vx: 10 + Math.random() * 14,
            vy: 3 + Math.random() * 5,
            w: 2, h: 2,
            life, max: life,
            color: 0xe3cf8a,
            alpha: 0.45,
          });
        }
      }

      ambGfx.clear();
      for (let i = ambient.length - 1; i >= 0; i--) {
        const p = ambient[i];
        p.life -= dt;
        if (p.life <= 0) { ambient.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'spark') p.x += Math.sin(p.life * 7) * 8 * dt;

        const fade = Math.sin((1 - p.life / p.max) * Math.PI); // aparece y se desvanece suave
        const a = p.alpha * fade;
        if (p.kind === 'cloud') {
          ambGfx.roundRect(p.x, p.y, p.w, p.h, 5).fill({ color: p.color, alpha: a });
        } else {
          ambGfx.rect(p.x, p.y, p.w, p.h).fill({ color: p.color, alpha: a });
        }
      }
    },

    update(dt) {
      if (list.length === 0 && !drawn) return;
      g.clear();
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life -= dt;
        if (p.life <= 0) { list.splice(i, 1); continue; }
        p.vy += 700 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        g.rect(p.x, p.y, p.size, p.size).fill({ color: p.color, alpha: p.life / p.max });
      }
      drawn = list.length > 0;
    },
  };
}