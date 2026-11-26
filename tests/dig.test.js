import test from 'node:test';
import assert from 'node:assert/strict';
import { setWorldSize, AIR, DIRT, GRANITE, OBSIDIAN, BEDROCK } from '../src/config.js';
import { wrapFiniteWorld } from '../src/world.js';
import { shapeCells, requiredHits, digCellsWithProgress } from '../src/dig.js';

function mockChunks() {
  const dirty = new Set();
  return {
    markDirty: (idx) => dirty.add(idx),
    dirty,
  };
}

test('shapeCells genera formas circle y cross correctamente', () => {
  const c = shapeCells('circle', 10, 10, 1);
  assert.ok(c.some(([x, y]) => x === 10 && y === 10));
  assert.equal(c.length, 5);

  const cr = shapeCells('cross', 10, 10, 1);
  assert.equal(cr.length, 5);
});

test('digCellsWithProgress exige múltiples golpes en bloques duros y bloquea sin poder', () => {
  setWorldSize('small');
  const raw = new Uint8Array(192 * 128);
  const world = wrapFiniteWorld(raw);
  const delta = new Map();
  const chunks = mockChunks();
  const progress = new Map();

  world.set(5, 5, DIRT);
  world.set(6, 5, GRANITE);
  world.set(7, 5, OBSIDIAN);
  world.set(8, 5, BEDROCK);

  // Con poder 2: rompe DIRT en 1 golpe, bloquea GRANITE/OBSIDIAN/BEDROCK
  const r1 = digCellsWithProgress(world, delta, chunks, [[5, 5], [6, 5], [8, 5]], 2, progress);
  assert.equal(r1.count, 1);
  assert.equal(r1.blocked, 2);
  assert.equal(world.get(5, 5), AIR);

  // Con poder 3: GRANITE requiere 2 golpes (requiredHits(GRANITE, 3) === 2)
  assert.equal(requiredHits(GRANITE, 3), 2);
  const r2 = digCellsWithProgress(world, delta, chunks, [[6, 5]], 3, progress);
  assert.equal(r2.count, 0);
  assert.equal(r2.damaged, 1);
  assert.equal(world.get(6, 5), GRANITE);

  const r3 = digCellsWithProgress(world, delta, chunks, [[6, 5]], 3, progress);
  assert.equal(r3.count, 1);
  assert.equal(world.get(6, 5), AIR);
  assert.equal(progress.size, 0);
  assert.equal(requiredHits(OBSIDIAN, 3), Infinity);
});
