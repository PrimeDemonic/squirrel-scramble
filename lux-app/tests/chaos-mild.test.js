/**
 * Chaos v2 invariant sweep at the Mild level (contract § 1, § 4; SPEC.md § 14 M7): every
 * invariant on 10,000 seeded races of 1 to 12 entrants, every fourth rebuilt to prove
 * determinism, then 200 races of 50. One file per level so Node runs the sweeps in parallel.
 */
import {test} from 'node:test';
import {CHAOS_LENGTHS_MS, invariantSweep} from './support.js';

const LEVEL = 'mild';

test('Mild: 10,000 Chaos races keep every invariant; every fourth rebuilds deep-equal', () => {
  invariantSweep({
    seed: 71001,
    races: 10000,
    mode: 'chaos',
    chaosLevel: LEVEL,
    minEntrants: 1,
    maxEntrants: 12,
    lengths: CHAOS_LENGTHS_MS,
    determinismEvery: 4
  });
});

test('Mild at scale: 200 Chaos races of 50 entrants keep every invariant', () => {
  invariantSweep({
    seed: 71050,
    races: 200,
    mode: 'chaos',
    chaosLevel: LEVEL,
    minEntrants: 50,
    maxEntrants: 50,
    lengths: CHAOS_LENGTHS_MS,
    determinismEvery: 2
  });
});
