import { CELL, COLS, ROWS, AIR, PLAYER_COLOR } from './config.js';

export function createPlayerSprite(p) {
  const g = new PIXI.Graphics();
  g.rect(0, 0, p.w, p.h).fill(PLAYER_COLOR);
  return g;
}

// Fondo: el cielo es el color del canvas; debajo de la superficie original hay una
// "pared de cueva" oscura que se ve en los túneles que cavás. Más profundo, más oscura.
export function createBackground(world) {
  const g = new PIXI.Graphics();
  const surface = new Array(COLS);
  for (let x = 0; x < COLS; x++) {
    let s = 0;
    while (s < ROWS && world[s * COLS + x] === AIR) s++;
    surface[x] = s;
  }
  const colors = [0x3d2a1a, 0x33231a, 0x2a1d18, 0x211719, 0x19121a, 0x120d14];
  const bands = colors.length;
  for (let b = 0; b < bands; b++) {
    const bandTop = Math.floor((ROWS * b) / bands);
    const bandBottom = Math.floor((ROWS * (b + 1)) / bands);
    for (let x = 0; x < COLS; x++) {
      const y0 = Math.max(surface[x], bandTop);
      if (bandBottom <= y0) continue;
      g.rect(x * CELL, y0 * CELL, CELL, (bandBottom - y0) * CELL);
    }
    g.fill(colors[b]);
  }
  return g;
}

// Línea punteada a la profundidad de la meta
export function createGoalLine(y) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  for (let x = 0; x < COLS * CELL; x += 24) g.rect(x, y - 1, 12, 3);
  g.fill({ color: 0xffe066, alpha: 0.75 });
  c.addChild(g);

  const label = new PIXI.Text({
    text: 'META',
    style: { fontFamily: 'sans-serif', fontSize: 14, fill: 0xffe066 },
  });
  label.position.set((COLS / 2) * CELL, y - 20);
  c.addChild(label);
  return c;
}

// Tienda: un cartel verde de 2x2 celdas centrado en la columna `col`,
// apoyado sobre el suelo en la altura `groundY` (en píxeles)
export function createShop(col, groundY) {
  const c = new PIXI.Container();

  const body = new PIXI.Graphics();
  body.rect(0, 0, 2 * CELL, 2 * CELL).fill(0x2e9e4f);
  body.rect(0.5 * CELL, 0.8 * CELL, CELL, 1.2 * CELL).fill(0x1b5e30); // puerta
  c.addChild(body);

  const label = new PIXI.Text({
    text: 'TIENDA',
    style: { fontFamily: 'sans-serif', fontSize: 12, fill: 0xffffff },
  });
  label.anchor.set(0.5, 1);
  label.position.set(CELL, -2);
  c.addChild(label);

  c.position.set((col + 0.5) * CELL - CELL, groundY - 2 * CELL);
  return c;
}

// Dinamita plantada: cuadrado rojo con mecha (main.js la hace parpadear)
export function createBomb() {
  const g = new PIXI.Graphics();
  g.rect(-6, -6, 12, 12).fill(0xd62828);
  g.rect(-1.5, -11, 3, 6).fill(0xffe066);
  return g;
}
