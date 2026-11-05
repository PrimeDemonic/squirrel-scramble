/**
 * Unit tests for sound-effect throttling (components/audio/throttle.js, Chaos v2 contract § 9
 * "Mixing"): at most three effects at once, a minimum gap per type, cues counted but never
 * refused, and a reset between races. Times are milliseconds on the AudioContext clock.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MAX_CONCURRENT_EFFECTS, createEffectThrottle} from '../components/audio/throttle.js';
import {minGapFor} from '../components/audio/effect-map.js';

test('the limit is three effects at once', () => {
  assert.equal(MAX_CONCURRENT_EFFECTS, 3);
  const throttle = createEffectThrottle();
  assert.equal(throttle.tryAcquire('tornado', 0, 2000), true);
  assert.equal(throttle.tryAcquire('hunter', 10, 500), true);
  assert.equal(throttle.tryAcquire('eagle', 20, 800), true);
  assert.equal(throttle.tryAcquire('beaver', 30, 600), false, 'a fourth is dropped');
  assert.equal(throttle.activeCount(30), 3);
  assert.equal(throttle.tryAcquire('beaver', 511, 600), true, 'free again once the pop has ended');
  assert.equal(throttle.activeCount(5000), 0);
});

test('each key keeps its minimum gap; other keys are not held up', () => {
  const throttle = createEffectThrottle({gapFor: minGapFor});
  assert.equal(throttle.tryAcquire('slip', 1000, 100), true);
  assert.equal(throttle.tryAcquire('slip', 1100, 100), false, '100 ms after the last slip');
  assert.equal(throttle.tryAcquire('burst', 1100, 100), true, 'a different type plays');
  assert.equal(throttle.tryAcquire('slip', 1250, 100), true, 'the 250 ms gap has passed');
  assert.equal(throttle.tryAcquire('tornado', 2000, 100), true);
  assert.equal(throttle.tryAcquire('tornado', 3400, 100), false, 'tornadoes keep 1.5 s apart');
  assert.equal(throttle.tryAcquire('tornado', 3500, 100), true);
  assert.equal(throttle.tryAcquire('catLady:impact', 4000, 100), true);
  assert.equal(throttle.tryAcquire('catLady:impact', 4100, 100), false);
  assert.equal(throttle.tryAcquire('catLady:impact', 4120, 100), true, 'follow-ups wait 120 ms');
});

test('a refused effect does not take a slot or reset its gap', () => {
  const throttle = createEffectThrottle({gapFor: () => 300});
  assert.equal(throttle.tryAcquire('ufo', 0, 50), true);
  assert.equal(throttle.tryAcquire('ufo', 100, 50), false);
  assert.equal(throttle.activeCount(100), 0);
  assert.equal(throttle.tryAcquire('ufo', 300, 50), true, 'the gap counts from the last play');
});

test('cues are held against the limit but are never refused themselves', () => {
  const throttle = createEffectThrottle();
  throttle.hold(0, 3000);
  throttle.hold(0, 3000);
  throttle.hold(0, 3000);
  throttle.hold(0, 3000);
  assert.equal(throttle.activeCount(10), 4);
  assert.equal(throttle.tryAcquire('slip', 10, 100), false, 'no room under the cues');
  assert.equal(throttle.tryAcquire('slip', 3001, 100), true);
});

test('reset forgets the slots and the gaps', () => {
  const throttle = createEffectThrottle({gapFor: () => 10000});
  throttle.tryAcquire('var', 0, 5000);
  throttle.reset();
  assert.equal(throttle.activeCount(0), 0);
  assert.equal(throttle.tryAcquire('var', 1, 5000), true);
});

test('odd input is survivable', () => {
  const throttle = createEffectThrottle(null);
  assert.equal(throttle.tryAcquire('slip', 0, Number.NaN), true, 'a NaN duration counts as 0');
  assert.equal(throttle.activeCount(1), 0);
  const custom = createEffectThrottle({maxConcurrent: 1});
  assert.equal(custom.tryAcquire('slip', 0, 100), true);
  assert.equal(custom.tryAcquire('burst', 0, 100), false);
  const broken = createEffectThrottle({maxConcurrent: -2});
  assert.equal(broken.tryAcquire('a', 0, 100), true);
  assert.equal(broken.tryAcquire('b', 0, 100), true);
  assert.equal(broken.tryAcquire('c', 0, 100), true);
  assert.equal(broken.tryAcquire('d', 0, 100), false, 'falls back to three');
});
