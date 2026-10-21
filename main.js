import { generateWorld } from './src/worldgen.js';
import { drawWorld, createPlayerSprite } from './src/render.js';
import { createPlayer, updatePlayer } from './src/player.js';
import { updateCamera } from './src/camera.js';
import { input } from './src/input.js';

const SEED = 12345; // cambiá este número para obtener otro mapa

async function main() {
  const world = generateWorld(SEED);

  const app = new PIXI.Application();
  await app.init({
    resizeTo: window,   // el canvas ocupa toda la ventana
    background: '#1a1a1a',
    antialias: false,
  });
  document.getElementById('app').appendChild(app.canvas);

  // todo el mundo vive en este container; mover la cámara = moverlo a él
  const worldLayer = new PIXI.Container();
  app.stage.addChild(worldLayer);
  worldLayer.addChild(drawWorld(world));

  const player = createPlayer(world);
  const playerSprite = createPlayerSprite(player);
  worldLayer.addChild(playerSprite);

  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 1 / 30); // segundos, con tope
    updatePlayer(world, player, input, dt);
    playerSprite.position.set(player.x, player.y);
    updateCamera(worldLayer, app.screen, player);
  });
}

main();