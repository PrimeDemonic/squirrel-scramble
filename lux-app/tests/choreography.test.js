/**
 * Unit tests for lib/choreography.js: the M6 Node checks (SPEC.md § 14) and the render queries.
 * Every race comes from a seeded generator, so a failure always reproduces.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRng} from '../lib/rng.js';
import {fakeResult} from '../lib/simulate.js';
import {
  activeEventsAt,
  buildRacePlan,
  heightAt,
  laneAt,
  leaderAt,
  leaderboardAt,
  leaderChanges
} from '../lib/choreography.js';
import {
  CHAOS_LENGTHS_MS,
  CLASSIC_LENGTHS_MS,
  checkPlanInvariants,
  makeNames,
  randomRaceInput
} from './support.js';

/**
 * @description A fixed eight-entrant Classic input for the query tests.
 * @param {number} seed - The race seed.
 * @returns {Object} The buildRacePlan input.
 */
function sampleInput(seed = 4242) {
  const result = fakeResult(createRng(9), makeNames(8), 20000, 0.25);
  return {entrants: result.entrants, seed, durationMs: 20000, mode: 'classic'};
}

test('M6: 10,000 Classic races keep every invariant and are deterministic', () => {
  const rng = createRng(6006);
  const shape = {minEntrants: 1, maxEntrants: 12, lengths: CLASSIC_LENGTHS_MS, mode: 'classic'};
  for (let race = 0; race < 10000; race += 1) {
    const input = randomRaceInput(rng, shape);
    const plan = buildRacePlan(input);
    checkPlanInvariants(plan, input);
    assert.deepStrictEqual(buildRacePlan(input), plan);
  }
});

test('M6 at scale: 500 Classic races of 50 entrants keep every invariant', () => {
  const rng = createRng(5050);
  const shape = {minEntrants: 50, maxEntrants: 50, lengths: CLASSIC_LENGTHS_MS, mode: 'classic'};
  for (let race = 0; race < 500; race += 1) {
    const input = randomRaceInput(rng, shape);
    const plan = buildRacePlan(input);
    checkPlanInvariants(plan, input);
    assert.deepStrictEqual(buildRacePlan(input), plan);
  }
});

/**
 * @description Samples one entrant at a frame rate and returns the first frame time showing 100,
 *   failing if any earlier frame shows 100.
 * @param {Object} plan - The plan.
 * @param {number} index - The entrant.
 * @param {number} fps - Frames per second.
 * @returns {number} The first frame time at the top.
 */
function firstFrameAtTop(plan, index, fps) {
  const {finishMs} = plan.entrants[index];
  const lastFrame = Math.ceil((finishMs * fps) / 1000);
  for (let frame = 0; frame <= lastFrame; frame += 1) {
    const timeMs = (frame * 1000) / fps;
    if (heightAt(plan, index, timeMs) === 100) {
      return timeMs;
    }
  }
  return Infinity;
}

test('M6: rendering is a pure function of time (10 fps and 60 fps agree)', () => {
  const rng = createRng(1060);
  for (let race = 0; race < 200; race += 1) {
    const lengths = race % 2 === 0 ? CLASSIC_LENGTHS_MS : CHAOS_LENGTHS_MS;
    const mode = race % 2 === 0 ? 'classic' : 'chaos';
    const shape = {minEntrants: 1, maxEntrants: 12, lengths, mode};
    const plan = buildRacePlan(randomRaceInput(rng, shape));
    plan.entrants.forEach((entrant, index) => {
      [10, 60].forEach((fps) => {
        const frameMs = 1000 / fps;
        const arrival = firstFrameAtTop(plan, index, fps);
        // The first frame at the top is the first frame at or after the stored finish.
        assert.ok(arrival >= entrant.finishMs && arrival - frameMs < entrant.finishMs);
      });
      // Shared instants (every 100 ms) give the same height at either frame rate.
      for (let frame = 0; frame * 100 <= entrant.finishMs; frame += 1) {
        const tenFps = heightAt(plan, index, (frame * 1000) / 10);
        const sixtyFps = heightAt(plan, index, (frame * 6 * 1000) / 60);
        assert.equal(tenFps, sixtyFps);
      }
    });
  }
});

test('inputs are validated', () => {
  const input = sampleInput();
  const twoWinners = input.entrants.map((entrant) => ({...entrant, position: 1}));
  assert.throws(() => buildRacePlan({...input, entrants: twoWinners}), RangeError);
  const backwards = input.entrants.map((entrant) => ({
    ...entrant,
    finishMs: 30000 - entrant.position
  }));
  assert.throws(() => buildRacePlan({...input, entrants: backwards}), RangeError);
  assert.throws(() => buildRacePlan({...input, mode: 'turbo'}), RangeError);
  assert.throws(() => buildRacePlan({...input, entrants: []}), TypeError);
  assert.throws(() => buildRacePlan({...input, durationMs: 0}), RangeError);
});

test('the plan never changes its input', () => {
  const input = sampleInput();
  const entrants = Object.freeze(input.entrants.map((entrant) => Object.freeze({...entrant})));
  const frozen = Object.freeze({...input, entrants});
  // ES modules run in strict mode, so any write to a frozen object would throw.
  assert.doesNotThrow(() => buildRacePlan(frozen));
});

test('different seeds give different races; the stored order never changes', () => {
  const first = buildRacePlan(sampleInput(1));
  const second = buildRacePlan(sampleInput(2));
  assert.notDeepEqual(first.entrants[0].heights, second.entrants[0].heights);
  assert.deepEqual(first.finishOrder, second.finishOrder);
});

test('heightAt: 0 at the start, linear between keyframes, 100 from the finish', () => {
  const plan = buildRacePlan(sampleInput());
  const entrant = plan.entrants[0];
  assert.equal(heightAt(plan, 0, 0), 0);
  assert.equal(heightAt(plan, 0, -50), 0);
  assert.equal(heightAt(plan, 0, entrant.finishMs), 100);
  assert.equal(heightAt(plan, 0, entrant.finishMs + 60000), 100);
  const middle = heightAt(plan, 0, 4 * 250 + 125);
  const expected = (entrant.heights[4] + entrant.heights[5]) / 2;
  assert.ok(Math.abs(middle - expected) < 1e-9);
});

test('a Classic race has no lane changes and no flights', () => {
  const plan = buildRacePlan(sampleInput());
  plan.entrants.forEach((entrant, index) => {
    assert.deepEqual(laneAt(plan, index, 12345), {lane: entrant.lane, flight: null, hidden: false});
    assert.equal(entrant.outfitTimeline.length, 1);
  });
  assert.equal(plan.raceEvents.length, 0);
  assert.equal(plan.chaosLevel, null);
  assert.equal(plan.finaleBurst, null);
  assert.ok(plan.events.every((event) => event.category === 'classic'));
  assert.ok(plan.events.every((event) => event.scope === 'entrants' && /^evt-\d+$/.test(event.id)));
  // Chaos v2 contract § 14: Classic draws from the same seeded pool as Chaos, storm and drizzle
  // included.
  const pool = ['day', 'day', 'golden_hour', 'night', 'drizzle', 'storm'];
  assert.equal(plan.sky, pool[plan.seed % pool.length]);
});

test('leaderboardAt puts finished entrants first, by position', () => {
  const plan = buildRacePlan(sampleInput());
  const thirdFinish = plan.entrants[plan.finishOrder[2]].finishMs;
  const board = leaderboardAt(plan, thirdFinish);
  assert.deepEqual(board.slice(0, 3).map((row) => row.position), [1, 2, 3]);
  assert.ok(board.slice(3).every((row) => !row.finished && row.height < 100));
  const heights = board.slice(3).map((row) => row.height);
  assert.deepEqual(heights, [...heights].sort((left, right) => right - left));
  assert.equal(leaderAt(plan, plan.durationMs), plan.winnerIndex);
});

test('leaderChanges: each new leader held 0.5 s, the winner last', () => {
  const plan = buildRacePlan(sampleInput());
  const changes = leaderChanges(plan);
  assert.ok(changes.length >= 1);
  assert.equal(changes[0].previousIndex, null);
  assert.equal(changes[changes.length - 1].entrantIndex, plan.winnerIndex);
  changes.slice(1).forEach((change, order) => {
    assert.equal(change.previousIndex, changes[order].entrantIndex);
    assert.notEqual(change.entrantIndex, change.previousIndex);
  });
});

test('activeEventsAt returns copies of the events in progress', () => {
  const plan = buildRacePlan(sampleInput(77));
  plan.events.forEach((event) => {
    const middle = (event.startMs + event.endMs) / 2;
    const active = activeEventsAt(plan, middle).find((candidate) => candidate.id === event.id);
    assert.ok(active, event.id);
    assert.ok(active.progress >= 0 && active.progress < 1);
    active.entrantIndexes.push(99);
    assert.ok(!event.entrantIndexes.includes(99));
    assert.ok(!activeEventsAt(plan, event.endMs).some((candidate) => candidate.id === event.id));
  });
});
