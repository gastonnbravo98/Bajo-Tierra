import { CELL, COLS, ROWS } from './src/config.js';
import { generateWorld } from './src/worldgen.js';
import { drawWorld } from './src/render.js';

const SEED = 12345; // cambiá este número para obtener otro mapa

async function main() {
  const world = generateWorld(SEED);

  const app = new PIXI.Application();
  await app.init({
    width: COLS * CELL,
    height: ROWS * CELL,
    background: '#1a1a1a',
  });
  document.getElementById('app').appendChild(app.canvas);

  app.stage.addChild(drawWorld(world));
}

main();