import test from 'node:test';
import assert from 'node:assert/strict';
import { setWorldSize, COLS, ROWS, AIR, BEDROCK, DIRT } from '../src/config.js';
import { generateWorld, createInfiniteWorld } from '../src/worldgen.js';
import { isSolid } from '../src/world.js';

test('generateWorld es determinístico por seed y respeta límites', () => {
  setWorldSize('small');
  const w1 = generateWorld(12345);
  const w2 = generateWorld(12345);
  assert.equal(w1.raw.length, COLS * ROWS);
  assert.deepEqual(w1.raw, w2.raw);
  assert.equal(w1.get(Math.floor(COLS / 2), 0), AIR);
  assert.equal(w1.get(10, ROWS - 1), BEDROCK);
  assert.equal(isSolid(w1, 10, ROWS - 1), true);
  assert.equal(isSolid(w1, 10, 0), false);
});

test('createInfiniteWorld genera chunks bajo demanda y respeta delta', () => {
  setWorldSize('infinite');
  const delta = new Map();
  const world = createInfiniteWorld(999, delta);
  const deepRow = Math.floor(ROWS * 0.4);
  const initial = world.get(20, deepRow);
  assert.notEqual(initial, AIR);
  world.set(20, deepRow, DIRT);
  assert.equal(world.get(20, deepRow), DIRT);
});
