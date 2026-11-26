import test from 'node:test';
import assert from 'node:assert/strict';
import { setWorldSize, IRON, GOLD, CELL } from '../src/config.js';
import { generateWorld } from '../src/worldgen.js';
import { createStats, buyItem, sellAll } from '../src/shop.js';
import { findNearestBase, applyDeathPenalty } from '../src/recovery.js';
import { generateStructures, openChest } from '../src/structures.js';
import { createEnemy, damageEnemiesInRadius, damageEnemiesOnRay, alertEnemies } from '../src/enemies.js';
import { createQuestManager } from '../src/quests.js';
import { updateCamera, MAX_VIEW_W, MAX_VIEW_H } from '../src/camera.js';

test('recuperación en Modo Difícil: busca base más cercana y aplica penalización 50%', () => {
  const bases = [
    { name: 'Superficie', x: 100, y: 100 },
    { name: 'Base #1', x: 100, y: 900 },
  ];
  const nearest = findNearestBase(bases, 120, 820);
  assert.equal(nearest.name, 'Base #1');

  const cargo = { [IRON]: 5, [GOLD]: 4 };
  const res = applyDeathPenalty(cargo, 0.5);
  assert.equal(cargo[IRON], 2);
  assert.equal(cargo[GOLD], 2);
  assert.equal(res.kept, 4);
  assert.equal(res.lost, 5);
});

test('estructuras subterráneas: genera cofres y entrega botín al abrir', () => {
  setWorldSize('small');
  const world = generateWorld(4242);
  const chests = generateStructures(world, 4242, 32);
  assert.ok(chests.length >= 4);

  const stats = createStats();
  const cargo = {};
  const loot = openChest(chests[0], stats, cargo, 30);
  assert.ok(loot.money > 0);
  assert.equal(chests[0].opened, true);
  assert.equal(openChest(chests[0], stats, cargo, 30), null);
});

test('enemigos subterráneos: alerta por ruido y daño con láser o área', () => {
  const e1 = createEnemy('bat', 10, 10);
  const e2 = createEnemy('crawler', 30, 10);
  const enemies = [e1, e2];

  alertEnemies(enemies, 10.5 * CELL, 10.5 * CELL, 5 * CELL, 4);
  assert.ok(e1.alertTimer > 0);
  assert.equal(e2.alertTimer, 0);

  const killedRay = damageEnemiesOnRay(enemies, 5 * CELL, 10.5 * CELL, 1, 0, 10 * CELL, 50);
  assert.equal(killedRay.length, 1);
  assert.equal(killedRay[0].kind, 'bat');

  const killedArea = damageEnemiesInRadius(enemies, 30.5 * CELL, 10.5 * CELL, 2 * CELL, 100);
  assert.equal(killedArea.length, 1);
  assert.equal(enemies.length, 0);
});

test('contratos y tienda: progreso, reclamo de recompensas y compra de mejoras', () => {
  const stats = createStats();
  const qm = createQuestManager(101);
  const views = qm.getViews(stats);
  assert.equal(views.length, 3);

  // Forzar completado de un contrato según su tipo
  const first = views[0];
  if (first.kind === 'mineral') {
    for (const k of Object.keys(stats.stash)) stats.stash[k] = 50;
  } else if (first.kind === 'depth') {
    qm.record('depth', 500);
  } else {
    qm.record(first.kind, 20);
  }

  const afterViews = qm.getViews(stats);
  assert.equal(afterViews[0].ready, true);
  const reward = qm.claim(afterViews[0].id, stats);
  assert.ok(reward && reward.money > 0);

  stats.stash[IRON] = 10;
  const sold = sellAll(stats);
  assert.equal(sold, 100);
  const msg = buyItem(stats, 'bag');
  assert.ok(msg.includes('Mochila'));
});

test('cámara escala automáticamente si se aleja el zoom del navegador', () => {
  setWorldSize('small');
  const layer = {
    scale: { x: 1, y: 1, set(v) { this.x = v; this.y = v; } },
    position: { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } },
  };
  const player = { x: 1500, y: 1000, w: 12, h: 28 };
  const cam = updateCamera(layer, { width: 7680, height: 4320 }, player);
  assert.equal(cam.scale, 4);
  assert.ok(cam.viewW <= MAX_VIEW_W);
  assert.ok(cam.viewH <= MAX_VIEW_H);
  assert.equal(layer.scale.x, 4);
});
