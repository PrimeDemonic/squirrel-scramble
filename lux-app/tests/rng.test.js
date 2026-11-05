/**
 * Unit tests for lib/rng.js: determinism, ranges and the helpers built on mulberry32.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRng, normaliseSeed, randomSeed} from '../lib/rng.js';

test('the same seed gives the same sequence', () => {
  const first = createRng(123456789);
  const second = createRng(123456789);
  for (let draw = 0; draw < 1000; draw += 1) {
    assert.equal(first.nextUint32(), second.nextUint32());
  }
});

test('different seeds give different sequences', () => {
  const first = createRng(1);
  const second = createRng(2);
  const firstDraws = Array.from({length: 20}, () => first.nextUint32());
  const secondDraws = Array.from({length: 20}, () => second.nextUint32());
  assert.notDeepEqual(firstDraws, secondDraws);
});

test('seeds normalise to unsigned 32-bit integers', () => {
  assert.equal(normaliseSeed('42'), 42);
  assert.equal(normaliseSeed(Number.NaN), 0);
  assert.equal(normaliseSeed(undefined), 0);
  assert.equal(normaliseSeed(-1), 4294967295);
  assert.equal(normaliseSeed(2147483646), 2147483646);
  assert.equal(normaliseSeed(7.9), 7);
});

test('nextFloat stays in [0, 1)', () => {
  const rng = createRng(99);
  for (let draw = 0; draw < 100000; draw += 1) {
    const value = rng.nextFloat();
    assert.ok(value >= 0 && value < 1);
  }
});

test('intBetween is inclusive, stays in range and is roughly uniform', () => {
  const rng = createRng(7);
  const counts = new Map();
  const draws = 100000;
  for (let draw = 0; draw < draws; draw += 1) {
    const value = rng.intBetween(3, 7);
    assert.ok(Number.isInteger(value) && value >= 3 && value <= 7);
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  assert.deepEqual([...counts.keys()].sort(), [3, 4, 5, 6, 7]);
  counts.forEach((count) => {
    assert.ok(Math.abs(count / draws - 0.2) < 0.01, `share ${count / draws}`);
  });
});

test('intBetween refuses bad bounds', () => {
  const rng = createRng(1);
  assert.throws(() => rng.intBetween(5, 4), RangeError);
  assert.throws(() => rng.intBetween(0.5, 4), RangeError);
});

test('floatBetween stays in [min, max)', () => {
  const rng = createRng(11);
  for (let draw = 0; draw < 10000; draw += 1) {
    const value = rng.floatBetween(0.5, 1.5);
    assert.ok(value >= 0.5 && value < 1.5);
  }
});

test('chance(0) is never true and chance(1) always is', () => {
  const rng = createRng(5);
  for (let draw = 0; draw < 10000; draw += 1) {
    assert.equal(rng.chance(0), false);
    assert.equal(rng.chance(1), true);
  }
});

test('pick returns members and refuses an empty array', () => {
  const rng = createRng(3);
  const items = ['oak', 'beech', 'ash'];
  for (let draw = 0; draw < 1000; draw += 1) {
    assert.ok(items.includes(rng.pick(items)));
  }
  assert.throws(() => rng.pick([]), RangeError);
});

test('shuffle returns a permutation, leaves the input alone and is deterministic', () => {
  const items = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
  const shuffled = createRng(17).shuffle(items);
  assert.deepEqual([...shuffled].sort((left, right) => left - right), [...items]);
  assert.deepEqual(items, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(createRng(17).shuffle(items), shuffled);
});

test('weightedIndex follows the weights and skips zero weights', () => {
  const rng = createRng(21);
  const counts = [0, 0, 0, 0];
  const draws = 50000;
  for (let draw = 0; draw < draws; draw += 1) {
    counts[rng.weightedIndex([15, 0, 55, 30])] += 1;
  }
  assert.equal(counts[1], 0);
  assert.ok(Math.abs(counts[0] / draws - 0.15) < 0.01);
  assert.ok(Math.abs(counts[2] / draws - 0.55) < 0.01);
  assert.ok(Math.abs(counts[3] / draws - 0.3) < 0.01);
  assert.throws(() => rng.weightedIndex([0, 0]), RangeError);
  assert.throws(() => rng.weightedIndex([-1, 2]), RangeError);
});

test('randomSeed gives a 31-bit integer', () => {
  for (let draw = 0; draw < 100; draw += 1) {
    const seed = randomSeed();
    assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 2147483647);
  }
});
