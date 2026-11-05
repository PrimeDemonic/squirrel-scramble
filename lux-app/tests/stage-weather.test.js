/**
 * The race stage's weather (Chaos v2 contract § 14), checked on components/stage-weather.js: no
 * DOM, no Lit. Covers which skies rain and how hard, the rain layout being a pure function of
 * the seed (same seed, same rain), the streak counts, sizes, opacities and angles, the depth
 * layers' order and speeds, the splashes, the seamless tiling of the streak paths, the wind's
 * overhang, and the thunderclouds over lightning strikes in skies without storm clouds.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRng} from '../lib/rng.js';
import {fakeResult} from '../lib/simulate.js';
import {buildRacePlan, laneAt} from '../lib/choreography.js';
import {rollOutfit} from '../lib/outfits.js';
import {themeConfig} from '../lib/theme-config.js';
import {makeNames} from './support.js';
import {prepareTimeline} from '../components/stage-timeline.js';
import {
  RAIN_DEPTHS,
  RAIN_DEPTH_ORDER,
  RAIN_TILE,
  SPLASHES,
  STREAK_TILT_DEG,
  THUNDERCLOUD,
  WIND_SLANT_DEG,
  hasStormClouds,
  rainLayout,
  rainOf,
  streakGroups,
  thundercloudsFor,
  windOverhang
} from '../components/stage-weather.js';

const STORM = themeConfig.skies.presets.storm.rain;
const DRIZZLE = themeConfig.skies.presets.drizzle.rain;

/**
 * @description Says whether a number lies in a range, both ends included.
 * @param {number} value - The number.
 * @param {number} low - The lowest allowed.
 * @param {number} high - The highest allowed.
 * @returns {boolean} True when inside.
 */
function within(value, low, high) {
  return value >= low && value <= high;
}

/**
 * @description An Absolute Carnage race of a fixed size, from a seeded generator.
 * @param {Object} rng - A seeded generator.
 * @param {number} count - Entrants.
 * @returns {Object} The buildRacePlan input.
 */
function carnageRace(rng, count) {
  const result = fakeResult(rng, makeNames(count), 60000, 0.25);
  const entrants = result.entrants.map((entrant) => ({...entrant, outfit: rollOutfit(rng)}));
  return {
    entrants,
    seed: rng.intBetween(0, 1000000),
    durationMs: 60000,
    mode: 'chaos',
    chaosLevel: 'carnage'
  };
}

test('only the rainy skies rain; only the storm has storm clouds', () => {
  assert.equal(rainOf('day'), null);
  assert.equal(rainOf('golden_hour'), null);
  assert.equal(rainOf('night'), null);
  assert.equal(rainOf('no-such-sky'), null);
  assert.deepEqual(rainOf('drizzle'), DRIZZLE);
  assert.deepEqual(rainOf('storm'), STORM);
  assert.equal(hasStormClouds('storm'), true);
  ['day', 'golden_hour', 'night', 'drizzle', 'no-such-sky'].forEach((skyId) => {
    assert.equal(hasStormClouds(skyId), false, skyId);
  });
});

test('the rain is a pure function of the seed', () => {
  assert.equal(rainLayout(42, null), null);
  assert.equal(rainLayout(42, {density: 0}), null);
  assert.deepStrictEqual(rainLayout(42, STORM), rainLayout(42, STORM));
  assert.notDeepStrictEqual(rainLayout(42, STORM), rainLayout(43, STORM));
  const winds = Array.from({length: 200}, (_value, seed) => rainLayout(seed, STORM).windDeg);
  winds.forEach((windDeg) => assert.ok(within(windDeg, WIND_SLANT_DEG.min, WIND_SLANT_DEG.max)));
  // The wind varies from race to race across its whole range.
  assert.ok(Math.min(...winds) < 10 && Math.max(...winds) > 16);
});

test('a storm has three depth layers, back to front, the near one fastest', () => {
  const layout = rainLayout(7, STORM);
  assert.deepEqual(layout.layers.map((layer) => layer.depth), RAIN_DEPTH_ORDER);
  assert.deepEqual(RAIN_DEPTH_ORDER, ['far', 'mid', 'near']);
  layout.layers.forEach((layer) => {
    assert.equal(layer.streaks.length, RAIN_DEPTHS[layer.depth].count, layer.depth);
    assert.equal(layer.fallMs, RAIN_DEPTHS[layer.depth].fallMs, layer.depth);
  });
  const [far, mid, near] = layout.layers;
  assert.ok(far.fallMs > mid.fallMs && mid.fallMs > near.fallMs);
  assert.ok(far.streaks.length > mid.streaks.length && mid.streaks.length > near.streaks.length);
  assert.equal(layout.splashes.length, SPLASHES.count);
});

test('streaks vary in length, width (1 to 2.5 px), opacity (0.2 to 0.6) and angle', () => {
  for (let seed = 0; seed < 25; seed += 1) {
    rainLayout(seed * 977, STORM).layers.forEach((layer) => {
      const spec = RAIN_DEPTHS[layer.depth];
      layer.streaks.forEach((streak) => {
        assert.ok(within(streak.x, 0, RAIN_TILE.width));
        assert.ok(within(streak.y, 0, RAIN_TILE.height));
        assert.ok(within(streak.length, spec.length[0], spec.length[1]));
        assert.ok(within(streak.width, 1, 2.5));
        assert.ok(within(streak.width, spec.width[0], spec.width[1]));
        assert.ok(within(streak.opacity, 0.2, 0.6));
        assert.ok(within(streak.tiltDeg, -STREAK_TILT_DEG, STREAK_TILT_DEG));
      });
      const lengths = new Set(layer.streaks.map((streak) => streak.length));
      const widths = new Set(layer.streaks.map((streak) => streak.width));
      assert.ok(lengths.size > 1 && widths.size > 1, layer.depth);
    });
  }
});

test('drizzle has fewer, slower, fainter streaks than the storm, and fewer splashes', () => {
  const storm = rainLayout(99, STORM);
  const drizzle = rainLayout(99, DRIZZLE);
  drizzle.layers.forEach((layer, index) => {
    const spec = RAIN_DEPTHS[layer.depth];
    assert.equal(layer.streaks.length, Math.round(spec.count * DRIZZLE.density), layer.depth);
    assert.ok(layer.streaks.length < storm.layers[index].streaks.length);
    assert.ok(layer.fallMs > storm.layers[index].fallMs);
    layer.streaks.forEach((streak) => {
      assert.ok(streak.opacity <= spec.opacity[1] * DRIZZLE.opacity + 0.01);
      assert.ok(within(streak.width, 1, 2.5));
    });
  });
  assert.ok(drizzle.splashes.length < storm.splashes.length);
  assert.ok(drizzle.splashes.length >= 1);
});

test('splashes spread along the grass, each part-way through its own loop', () => {
  for (let seed = 0; seed < 25; seed += 1) {
    const {splashes} = rainLayout(seed, STORM);
    splashes.forEach((splash, index) => {
      assert.ok(within(splash.x, 0, 100));
      assert.ok(within(splash.y, SPLASHES.band[0], SPLASHES.band[1]));
      assert.ok(splash.durationMs > 0);
      assert.ok(splash.delayMs <= 0 && splash.delayMs >= -splash.durationMs);
      if (index > 0) {
        assert.ok(splash.x > splashes[index - 1].x, 'one splash per stretch of the strip');
      }
    });
  }
});

test('each streak is drawn three times, a tile apart, so the sheet has no seam', () => {
  const groups = streakGroups([
    {x: 10, y: 20, length: 8, width: 1.2, opacity: 0.33, tiltDeg: 0},
    {x: 50, y: 95, length: 10, width: 1.1, opacity: 0.36, tiltDeg: 0}
  ]);
  // Both round to 1 px and 0.35, so they share one path.
  assert.equal(groups.length, 1);
  assert.equal(groups[0].width, 1);
  assert.equal(groups[0].opacity, 0.35);
  assert.equal(
    groups[0].d,
    'M10 -80l0 8M10 20l0 8M10 120l0 8M50 -5l0 10M50 95l0 10M50 195l0 10'
  );
  const layout = rainLayout(5, STORM);
  layout.layers.forEach((layer) => {
    const drawn = streakGroups(layer.streaks);
    const moves = drawn.reduce((total, group) => total + (group.d.match(/M/g) || []).length, 0);
    assert.equal(moves, layer.streaks.length * 3, layer.depth);
    drawn.forEach((group) => {
      assert.ok(within(group.width, 1, 2.5));
      assert.equal(Math.round(group.width * 2), group.width * 2);
      assert.ok(Math.abs(Math.round(group.opacity * 20) - group.opacity * 20) < 1e-9);
    });
    // A handful of paths, not one per streak.
    assert.ok(drawn.length < layer.streaks.length || layer.streaks.length <= 3);
  });
});

test('a layer reaches past each side of its box by half the tangent of the wind', () => {
  assert.equal(windOverhang(0), 0);
  assert.equal(windOverhang(-5), 0);
  assert.equal(windOverhang(Number.NaN), 0);
  assert.equal(windOverhang(12), 0.106);
  assert.equal(windOverhang(18), 0.162);
  assert.ok(windOverhang(WIND_SLANT_DEG.max) > windOverhang(WIND_SLANT_DEG.min));
});

test('a strike in a sky without storm clouds comes from a thundercloud over its tree', () => {
  const rng = createRng(1414);
  let strikes = 0;
  for (let race = 0; race < 200 && strikes < 12; race += 1) {
    const plan = buildRacePlan(carnageRace(rng, 10));
    const before = JSON.stringify(plan);
    const timeline = prepareTimeline(plan, 3);
    const lightning = timeline.events.filter((event) => (
      event.type === 'lightning' && Number.isInteger(event.entrants[0])
    ));
    assert.deepEqual(thundercloudsFor(plan, timeline, 'storm'), []);
    ['day', 'golden_hour', 'night', 'drizzle'].forEach((skyId) => {
      const clouds = thundercloudsFor(plan, timeline, skyId);
      assert.equal(clouds.length, lightning.length, skyId);
      clouds.forEach((cloud, index) => {
        const strike = lightning[index];
        const {lane} = laneAt(plan, strike.entrants[0], strike.startMs);
        assert.equal(cloud.key, strike.id);
        assert.equal(cloud.lane, lane);
        assert.equal(cloud.side, lane > plan.entrants.length / 2 ? 1 : -1);
        assert.equal(cloud.startMs, strike.startMs - THUNDERCLOUD.leadMs);
        assert.equal(cloud.durationMs, THUNDERCLOUD.leadMs + THUNDERCLOUD.tailMs);
        // Fully in before the strike, and still there when it lands.
        const fullAtMs = cloud.startMs + cloud.inShare * cloud.durationMs;
        const fadeAtMs = cloud.startMs + cloud.outShare * cloud.durationMs;
        assert.ok(fullAtMs <= strike.startMs);
        assert.ok(fadeAtMs > strike.startMs);
      });
    });
    // Drawing the weather never changes the plan.
    assert.equal(JSON.stringify(plan), before);
    strikes += lightning.length;
  }
  assert.ok(strikes > 0, 'no lightning strike in 200 Absolute Carnage races');
});
