/**
 * Unit tests for lib/simulate.js: the server-timing port (SPEC.md § 7 draw steps 5 to 7) and the
 * M8 race-feel checks (SPEC.md § 14), run for both modes with fixed seeds.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRng} from '../lib/rng.js';
import {fakeResult, orderViolations, simulate} from '../lib/simulate.js';
import {buildRacePlan} from '../lib/choreography.js';
import {makeNames} from './support.js';

test('fakeResult follows the server rules', () => {
  const rng = createRng(8080);
  for (let race = 0; race < 2000; race += 1) {
    const count = rng.intBetween(1, 50);
    const durationMs = rng.pick([10000, 20000, 40000, 45000, 60000, 90000]);
    const result = fakeResult(rng, makeNames(count), durationMs);
    const lanes = result.entrants.map((entrant) => entrant.lane);
    assert.deepEqual(lanes, Array.from({length: count}, (_value, index) => index + 1));
    const byPosition = result.entrants
      .slice()
      .sort((left, right) => left.position - right.position);
    assert.deepEqual(byPosition.map((entrant) => entrant.position), lanes);
    assert.equal(byPosition[0].finishMs, durationMs);
    byPosition.forEach((entrant, place) => {
      assert.ok(Number.isInteger(entrant.finishMs));
      if (place > 0) {
        assert.ok(entrant.finishMs > byPosition[place - 1].finishMs);
      }
    });
    assert.ok(byPosition[count - 1].finishMs - durationMs <= durationMs / 2);
    if (count > 1) {
      const gap = byPosition[1].finishMs - byPosition[0].finishMs;
      assert.equal(result.photoFinish, gap <= 150);
    }
  }
});

test('the photo-finish rate is about 25% when no scaling applies', () => {
  const rng = createRng(2525);
  let photos = 0;
  const races = 10000;
  for (let race = 0; race < races; race += 1) {
    photos += fakeResult(rng, makeNames(2), 20000).photoFinish ? 1 : 0;
  }
  assert.ok(Math.abs(photos / races - 0.25) <= 0.015, `photo finishes: ${photos / races}`);
});

test('orderViolations finds a broken plan and passes a good one', () => {
  const rng = createRng(31);
  const result = fakeResult(rng, makeNames(6), 20000);
  const input = {entrants: result.entrants, seed: 5, durationMs: 20000, mode: 'chaos'};
  const plan = buildRacePlan(input);
  assert.equal(orderViolations(plan), 0);
  const broken = JSON.parse(JSON.stringify(plan));
  broken.entrants[0].heights[3] = 100;
  assert.ok(orderViolations(broken) > 0);
});

['classic', 'chaos'].forEach((mode) => {
  test(`M8 (${mode}): 1,000 races of 8 feel like races`, () => {
    const stats = simulate(1000, {entrantCount: 8, mode, seed: mode === 'classic' ? 808 : 909});
    assert.equal(stats.races, 1000);
    assert.equal(stats.outOfOrderCount, 0);
    assert.ok(
      stats.winnerLeadsAtQuarterShare < 0.25,
      `winner leads at 25% in ${stats.winnerLeadsAtQuarterShare}`
    );
    assert.ok(
      stats.twoOrMoreLeadChangesShare >= 0.7,
      `two or more lead changes in ${stats.twoOrMoreLeadChangesShare}`
    );
    if (mode === 'chaos') {
      assert.ok(stats.tornadoShare > 0 && stats.hunterShare > 0 && stats.suitorShare > 0);
    } else {
      assert.equal(stats.tornadoShare + stats.hunterShare + stats.suitorShare, 0);
    }
  });
});

test('simulate refuses bad options and reports its seed', () => {
  assert.throws(() => simulate(0), RangeError);
  assert.throws(() => simulate(10, {mode: 'turbo'}), RangeError);
  assert.throws(() => simulate(10, {entrantCount: 0}), RangeError);
  const stats = simulate(5, {seed: 123, durationMs: 10000});
  assert.equal(stats.seed, 123);
  assert.deepEqual(simulate(5, {seed: 123, durationMs: 10000}), stats);
  assert.ok(Number.isInteger(simulate(1).seed));
});
