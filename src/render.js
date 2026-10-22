import { CELL, PLAYER_COLOR } from './config.js';

export function createPlayerSprite(p) {
  const g = new PIXI.Graphics();
  g.rect(0, 0, p.w, p.h).fill(PLAYER_COLOR);
  return g;
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