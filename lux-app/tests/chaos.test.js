/**
 * Chaos v2 tests (contract § 1, § 3, § 4; SPEC.md § 14 M7) apart from the per-level 10,000-race
 * invariant sweeps, which live in chaos-mild, chaos-silly and chaos-carnage.test.js. Every race
 * comes from a seeded generator, so a failure always reproduces.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRng} from '../lib/rng.js';
import {fakeResult, simulate} from '../lib/simulate.js';
import {buildRacePlan, laneAt, outfitAt} from '../lib/choreography.js';
import {rollOutfit} from '../lib/outfits.js';
import {themeConfig} from '../lib/theme-config.js';
import {
  CHAOS_LENGTHS_MS,
  CHAOS_LEVELS,
  MAX_SEED,
  checkPlanInvariants,
  makeNames,
  randomRaceInput
} from './support.js';

const EVERY_TYPE = ['tornado', 'hunter', 'suitor', 'eagle', 'beaver', 'lightning', 'catLady',
  'goldenAcorn', 'leafBlower', 'ufo', 'earthquake', 'flood', 'disco', 'acornHail', 'var',
  'trenchCoat', 'woodpecker'];
const COMBOS = ['hunterVsTornado', 'eagleIntoFunnel', 'suitorSwept', 'catVsEagle'];
const SWAPPING_TYPES = ['tornado', 'ufo'];

/**
 * @description A stored race of a fixed size and length, with outfits, from a seeded generator.
 * @param {Object} rng - A seeded generator.
 * @param {number} count - Entrants.
 * @param {number} durationMs - Race length.
 * @param {string} [chaosLevel] - The level, or none.
 * @returns {Object} The buildRacePlan input.
 */
function fixedRace(rng, count, durationMs, chaosLevel) {
  const result = fakeResult(rng, makeNames(count), durationMs, 0.25);
  const entrants = result.entrants.map((entrant) => ({...entrant, outfit: rollOutfit(rng)}));
  const input = {entrants, seed: rng.intBetween(0, MAX_SEED), durationMs, mode: 'chaos'};
  return chaosLevel ? {...input, chaosLevel} : input;
}

/**
 * @description A random Chaos race shape at a level.
 * @param {number} minEntrants - Fewest entrants.
 * @param {number} maxEntrants - Most entrants.
 * @param {string} [chaosLevel] - The level, or none.
 * @returns {Object} The shape for randomRaceInput.
 */
function chaosShape(minEntrants, maxEntrants, chaosLevel) {
  return {minEntrants, maxEntrants, lengths: CHAOS_LENGTHS_MS, mode: 'chaos', chaosLevel};
}

test('chaosLevel defaults to Silly, and changes the race', () => {
  const rng = createRng(1001);
  for (let race = 0; race < 50; race += 1) {
    const input = fixedRace(rng, 8, 60000);
    const unspecified = buildRacePlan(input);
    assert.equal(unspecified.chaosLevel, 'silly');
    assert.deepStrictEqual(buildRacePlan({...input, chaosLevel: 'silly'}), unspecified);
    assert.deepStrictEqual(buildRacePlan({...input, chaosLevel: null}), unspecified);
    const carnage = buildRacePlan({...input, chaosLevel: 'carnage'});
    assert.notDeepEqual(carnage.events, unspecified.events);
  }
});

test('Classic ignores chaosLevel entirely', () => {
  const rng = createRng(1002);
  const input = {...fixedRace(rng, 6, 20000), mode: 'classic'};
  const plain = buildRacePlan(input);
  assert.equal(plain.chaosLevel, null);
  assert.deepStrictEqual(buildRacePlan({...input, chaosLevel: 'carnage'}), plain);
  assert.deepStrictEqual(buildRacePlan({...input, chaosLevel: 'turbo'}), plain);
});

test('an unknown Chaos level is refused', () => {
  const input = fixedRace(createRng(1003), 4, 45000);
  assert.throws(() => buildRacePlan({...input, chaosLevel: 'turbo'}), RangeError);
  assert.throws(() => buildRacePlan({...input, chaosLevel: 'MILD'}), RangeError);
});

test('same seed and level: deep-equal events, lane timelines and outfit timelines', () => {
  const rng = createRng(1004);
  CHAOS_LEVELS.forEach((chaosLevel) => {
    for (let race = 0; race < 200; race += 1) {
      const input = randomRaceInput(rng, chaosShape(1, 12, chaosLevel));
      assert.deepStrictEqual(buildRacePlan(input), buildRacePlan(input));
    }
  });
});

CHAOS_LEVELS.forEach((chaosLevel, order) => {
  test(`contract § 4 targets (${chaosLevel}): 1,000 races of 8 at 60 s`, () => {
    const stats = simulate(1000, {
      entrantCount: 8, mode: 'chaos', chaosLevel, durationMs: 60000, seed: 4100 + order
    });
    const level = themeConfig.chaosLevels.levels[chaosLevel];
    const covered = stats.everyEntrantCoveredShare;
    assert.equal(stats.chaosLevel, chaosLevel);
    assert.equal(stats.outOfOrderCount, 0);
    assert.ok(stats.maxBusiestOverlap <= level.maxOverlap, `busiest ${stats.maxBusiestOverlap}`);
    if (chaosLevel === 'silly') {
      assert.ok(stats.meanBusiestOverlap >= 2, `mean busiest ${stats.meanBusiestOverlap}`);
      assert.ok(covered >= 0.95, `every squirrel covered in ${covered}`);
    }
    if (chaosLevel === 'carnage') {
      assert.ok(stats.meanBusiestOverlap >= 4, `mean busiest ${stats.meanBusiestOverlap}`);
      assert.equal(stats.finaleBurstShare, 1, `finale in ${stats.finaleBurstShare}`);
      assert.ok(covered >= 0.95, `every squirrel covered in ${covered}`);
    }
  });
});

CHAOS_LEVELS.forEach((chaosLevel, order) => {
  test(`M7 (${chaosLevel}): 1,000 races of 12 at 60 s have tornadoes, hunters and suitors`, () => {
    const rng = createRng(1200 + order);
    const seen = {tornado: 0, hunter: 0, suitor: 0};
    const races = 1000;
    for (let race = 0; race < races; race += 1) {
      const plan = buildRacePlan(fixedRace(rng, 12, 60000, chaosLevel));
      Object.keys(seen).forEach((type) => {
        seen[type] += plan.events.some((event) => event.type === type) ? 1 : 0;
      });
    }
    assert.ok(seen.tornado / races >= 0.9, `tornado in ${seen.tornado} of ${races}`);
    assert.ok(seen.hunter / races >= 0.7, `hunter in ${seen.hunter} of ${races}`);
    assert.ok(seen.suitor / races >= 0.8, `suitor in ${seen.suitor} of ${races}`);
  });
});

test('every Absolute Carnage race has its finale burst, however small or busy the field', () => {
  const rng = createRng(1310);
  const {minEvents} = themeConfig.chaosLevels.levels.carnage.finale;
  [[1, 3], [4, 12], [8, 8], [30, 50]].forEach(([fewest, most]) => {
    const races = most > 12 ? 100 : 1000;
    for (let race = 0; race < races; race += 1) {
      const plan = buildRacePlan(randomRaceInput(rng, chaosShape(fewest, most, 'carnage')));
      const burst = plan.finaleBurst;
      assert.ok(burst !== null && burst.count >= minEvents,
        `seed ${plan.seed}, ${plan.entrants.length} squirrels: finale of ${burst && burst.count}`);
    }
  });
});

test('Absolute Carnage uses every event type, the sharknado and all four combos', () => {
  const rng = createRng(1300);
  const types = new Set();
  const combos = new Set();
  let sharks = 0;
  let chomps = 0;
  for (let race = 0; race < 1000; race += 1) {
    const plan = buildRacePlan(fixedRace(rng, 8, 60000, 'carnage'));
    plan.events.forEach((event) => {
      types.add(event.type);
      if (event.data.combo) {
        combos.add(event.data.combo.kind);
      }
      sharks += event.type === 'tornado' && event.data.sharks ? 1 : 0;
      chomps += event.type === 'tornado' && Number.isInteger(event.data.hatChomp) ? 1 : 0;
    });
  }
  EVERY_TYPE.forEach((type) => assert.ok(types.has(type), `no ${type} in 1,000 races`));
  COMBOS.forEach((kind) => assert.ok(combos.has(kind), `no ${kind} combo in 1,000 races`));
  assert.ok(sharks > 0 && chomps > 0, `sharknadoes ${sharks}, hats chomped ${chomps}`);
});

test('Mild keeps to the original deck, plus the rare shark and the Golden Acorn', () => {
  const rng = createRng(1301);
  const allowed = new Set(['tornado', 'hunter', 'suitor', 'eagle', 'beaver', 'lightning',
    'goldenAcorn']);
  for (let race = 0; race < 300; race += 1) {
    const plan = buildRacePlan(fixedRace(rng, 8, 60000, 'mild'));
    plan.events
      .filter((event) => event.category === 'chaos')
      .forEach((event) => assert.ok(allowed.has(event.type), `${event.type} in a Mild race`));
  }
});

test('the Golden Acorn only fires on a runaway leader, and does fire', () => {
  const rng = createRng(1302);
  let acorns = 0;
  CHAOS_LEVELS.forEach((chaosLevel) => {
    const level = themeConfig.chaosLevels.levels[chaosLevel];
    for (let race = 0; race < 300; race += 1) {
      const input = fixedRace(rng, 8, 60000, chaosLevel);
      const plan = buildRacePlan(input);
      // checkPlanInvariants rechecks every acorn's lead on the finished plan.
      checkPlanInvariants(plan, input);
      plan.events.filter((event) => event.type === 'goldenAcorn').forEach((event) => {
        acorns += 1;
        assert.ok(event.data.leadUnits >= event.data.thresholdUnits);
        assert.equal(event.data.thresholdUnits, level.goldenAcornLeadUnits);
      });
    }
  });
  assert.ok(acorns > 0, 'no Golden Acorn in 900 races');
});

test('hat losses and UFO swaps reach the outfit timeline', () => {
  const rng = createRng(1303);
  let hatLosses = 0;
  let swaps = 0;
  for (let race = 0; race < 300; race += 1) {
    const plan = buildRacePlan(fixedRace(rng, 8, 60000, 'carnage'));
    plan.events.forEach((event) => {
      if (event.type === 'leafBlower') {
        event.data.lostHats.forEach((lost) => {
          hatLosses += 1;
          assert.equal(outfitAt(plan, lost.entrant, event.endMs).hat, 'none');
        });
      }
      if (event.type === 'ufo') {
        swaps += 1;
        const [first, second] = event.entrants;
        const before = outfitAt(plan, first, event.data.swapAtMs - 1);
        assert.deepEqual(outfitAt(plan, second, event.data.swapAtMs), before);
      }
    });
  }
  assert.ok(hatLosses > 0 && swaps > 0, `hat losses ${hatLosses}, UFO swaps ${swaps}`);
});

test('after a tornado or a UFO every swapped squirrel is on its new tree', () => {
  const rng = createRng(3131);
  let checked = 0;
  for (let race = 0; race < 200; race += 1) {
    const plan = buildRacePlan(randomRaceInput(rng, chaosShape(4, 12, 'carnage')));
    const swappers = plan.events.filter((event) => SWAPPING_TYPES.includes(event.type));
    swappers.forEach((event) => {
      const landsAt = event.type === 'tornado' ? event.data.flightEndMs : event.data.beamEndMs;
      const midFlight = (event.startMs + landsAt) / 2;
      event.data.swaps.forEach((swap) => {
        const during = laneAt(plan, swap.entrant, midFlight);
        assert.equal(during.lane, swap.fromLane);
        assert.equal(during.flight.toLane, swap.toLane);
        assert.deepEqual(laneAt(plan, swap.entrant, landsAt), {
          lane: swap.toLane, flight: null, hidden: false
        });
      });
      checked += 1;
    });
  }
  assert.ok(checked >= 150, `only ${checked} swaps in 200 races`);
});

test('a trench coat hides its outer two on the host tree, then they topple home', () => {
  const rng = createRng(1304);
  let coats = 0;
  for (let race = 0; race < 600 && coats < 20; race += 1) {
    const plan = buildRacePlan(fixedRace(rng, 10, 60000, 'carnage'));
    plan.events.filter((event) => event.type === 'trenchCoat').forEach((coat) => {
      coats += 1;
      coat.data.hidden.forEach((index) => {
        const inside = laneAt(plan, index, coat.startMs);
        assert.equal(inside.hidden, true);
        assert.equal(inside.lane, coat.data.hostLane);
        const home = laneAt(plan, index, coat.endMs);
        assert.equal(home.hidden, false);
        assert.equal(Math.abs(home.lane - coat.data.hostLane), 1);
      });
    });
  }
  assert.ok(coats > 0, 'no trench coat in 600 races');
});

test('a tornado needs three squirrels', () => {
  const rng = createRng(2002);
  for (let race = 0; race < 300; race += 1) {
    const plan = buildRacePlan(randomRaceInput(rng, chaosShape(1, 2, 'carnage')));
    assert.ok(!plan.events.some((event) => event.type === 'tornado'));
  }
});

test('the sky comes from one seeded pool in both modes, and never changes the race', () => {
  const pool = themeConfig.skies.seededChoices;
  assert.deepEqual(pool, ['day', 'day', 'golden_hour', 'night', 'drizzle', 'storm']);
  assert.equal(Object.prototype.hasOwnProperty.call(themeConfig.skies, 'chaos'), false);
  const rng = createRng(2003);
  const seen = {classic: new Set(), chaos: new Set()};
  for (let race = 0; race < 300; race += 1) {
    const input = fixedRace(rng, 6, 45000, 'silly');
    const chaosPlan = buildRacePlan(input);
    // The same stored race, as Classic (a Classic race carries no level).
    const classicInput = {...input, mode: 'classic'};
    delete classicInput.chaosLevel;
    const classicPlan = buildRacePlan(classicInput);
    // The same seed picks the same sky in either mode, straight from the pool.
    assert.equal(chaosPlan.sky, pool[chaosPlan.seed % pool.length]);
    assert.equal(classicPlan.sky, chaosPlan.sky);
    seen.chaos.add(chaosPlan.sky);
    seen.classic.add(classicPlan.sky);
  }
  const everySky = ['day', 'drizzle', 'golden_hour', 'night', 'storm'];
  assert.deepEqual([...seen.chaos].sort(), everySky);
  assert.deepEqual([...seen.classic].sort(), everySky);
  // Forcing a different sky leaves everything else in the plan exactly as it was.
  const input = fixedRace(createRng(2004), 9, 60000, 'carnage');
  const withSky = (skyId) => buildRacePlan(input, {
    ...themeConfig,
    skies: {...themeConfig.skies, seededChoices: [skyId]}
  });
  const night = withSky('night');
  const storm = withSky('storm');
  assert.equal(night.sky, 'night');
  assert.equal(storm.sky, 'storm');
  assert.deepStrictEqual({...night, sky: 'storm'}, storm);
});

test('hunter and suitor outcomes are the SPEC ones', () => {
  const rng = createRng(4004);
  const outcomes = {hunter: new Set(), suitor: new Set()};
  for (let race = 0; race < 300; race += 1) {
    buildRacePlan(randomRaceInput(rng, chaosShape(8, 12))).events
      .filter((event) => event.type === 'hunter' || event.type === 'suitor')
      .forEach((event) => outcomes[event.type].add(event.outcome));
  }
  assert.deepEqual([...outcomes.hunter].sort(), ['hit', 'miss']);
  assert.deepEqual([...outcomes.suitor].sort(), ['kiss', 'slap']);
});
