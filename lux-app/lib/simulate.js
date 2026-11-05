/**
 * Race simulation for tuning and the M8 checks (SPEC.md § 14): fakes stored results under the
 * server's timing rules and runs the choreography on each, then reports how races feel. In the
 * browser it backs SquirrelScramble.debug.simulate(1000); in Node it backs the unit tests.
 *
 * fakeResult() ports the server's draw steps 5 to 7 (SPEC.md § 7): two independent shuffles
 * (finishing order and lanes), then finish times by position. The server rounds its own way;
 * that does not matter here, because the choreography only needs finish times that strictly
 * increase with position.
 *
 * Pure ES module: no DOM, no Lit and no platform imports.
 */
import {createRng, randomSeed} from './rng.js';
import {themeConfig} from './theme-config.js';
import {buildRacePlan, heightAt, leaderAt, leaderChanges} from './choreography.js';

// The largest seed the server stores (SPEC.md § 5, Race.seed).
const MAX_SEED = 2147483646;
// M8 asks who leads at a quarter of the race.
const QUARTER = 0.25;
const MODES = ['classic', 'chaos'];

/**
 * @description The gaps between consecutive finishers, by position (SPEC.md § 7, step 7): the
 *   runner-up gap from the photo-finish range or the normal range, every later gap from the
 *   later range, all scaled down if the spread exceeds half the race.
 * @param {Object} rng - A seeded generator.
 * @param {number} count - Entrants.
 * @param {number} durationMs - The winner's finish time.
 * @param {number} photoFinishChance - Chance the runner-up gap is a photo-finish gap.
 * @returns {number[]} count - 1 whole-millisecond gaps, each at least 1.
 * @since 1.0.0
 */
function finishGaps(rng, count, durationMs, photoFinishChance) {
  const rules = themeConfig.serverTiming;
  const gaps = [];
  for (let position = 2; position <= count; position += 1) {
    let range = rules.laterGapMs;
    if (position === 2) {
      range = rng.chance(photoFinishChance) ? rules.photoGapMs : rules.runnerUpGapMs;
    }
    gaps.push(rng.intBetween(range.min, range.max));
  }
  const spread = gaps.reduce((sum, gap) => sum + gap, 0);
  const limit = durationMs * rules.maxSpreadFraction;
  if (spread <= limit) {
    return gaps;
  }
  const scale = limit / spread;
  return gaps.map((gap) => Math.max(1, Math.floor(gap * scale)));
}

/**
 * @description Fakes a stored result under the server's rules: an independent finishing order
 *   and lane order, then finish times by position with the winner at exactly durationMs.
 *   Generator order: the finishing-order shuffle, the lane shuffle, then the gaps.
 * @param {Object} rng - A seeded generator.
 * @param {string[]} names - Entrant names (at least one).
 * @param {number} durationMs - The race length (the winner's finish time).
 * @param {number} [photoFinishChance] - Defaults to the theme's 0.25.
 * @returns {{durationMs: number, photoFinish: boolean,
 *   entrants: Array<{name: string, lane: number, position: number, finishMs: number}>}} The
 *   result, entrants sorted by lane like the race payload.
 * @throws {RangeError} If there are no names or the length is not positive.
 * @example
 *   const result = fakeResult(createRng(7), ['Alex', 'Sam'], 20000);
 * @since 1.0.0
 */
export function fakeResult(
  rng,
  names,
  durationMs,
  photoFinishChance = themeConfig.race.photoFinishChance
) {
  if (!Array.isArray(names) || names.length === 0) {
    throw new RangeError('fakeResult needs at least one name.');
  }
  if (!(Number.isFinite(durationMs) && durationMs > 0)) {
    throw new RangeError('fakeResult needs a positive durationMs.');
  }
  const indexes = Array.from(names.keys());
  // positionRank[index] + 1 is a name's position; laneRank[index] + 1 is its lane.
  const positionRank = rng.shuffle(indexes);
  const laneRank = rng.shuffle(indexes);
  const gaps = finishGaps(rng, names.length, durationMs, photoFinishChance);
  const finishByPosition = [durationMs];
  gaps.forEach((gap, place) => {
    finishByPosition.push(finishByPosition[place] + gap);
  });
  const entrants = names
    .map((name, index) => ({
      name,
      lane: laneRank[index] + 1,
      position: positionRank[index] + 1,
      finishMs: finishByPosition[positionRank[index]]
    }))
    .sort((left, right) => left.lane - right.lane);
  const photoGap = names.length > 1 ? finishByPosition[1] - finishByPosition[0] : Infinity;
  return {
    durationMs,
    photoFinish: photoGap <= themeConfig.timings.photoFinishThresholdMs,
    entrants
  };
}

/**
 * @description Counts order problems in a plan: an entrant whose keyframes leave [0, 98] before
 *   its final tick, that shows 100 before its finishMs or not at it, or finish times that do
 *   not strictly increase with position. Zero means nobody reaches the top out of order.
 * @param {Object} plan - From buildRacePlan.
 * @returns {number} The number of problems.
 * @example
 *   orderViolations(plan) === 0;
 * @since 1.0.0
 */
export function orderViolations(plan) {
  const ceiling = themeConfig.choreography.preFinishCeiling;
  let violations = 0;
  plan.entrants.forEach((entrant, index) => {
    const ceilingKept = entrant.heights.every((height, tick) => (
      tick === entrant.tickCount || (height >= 0 && height <= ceiling)
    ));
    const onTime = heightAt(plan, index, entrant.finishMs) === 100
      && heightAt(plan, index, entrant.finishMs - 1) < 100;
    if (!ceilingKept || !onTime) {
      violations += 1;
    }
  });
  for (let place = 1; place < plan.finishOrder.length; place += 1) {
    const ahead = plan.entrants[plan.finishOrder[place - 1]].finishMs;
    if (!(plan.entrants[plan.finishOrder[place]].finishMs > ahead)) {
      violations += 1;
    }
  }
  return violations;
}

/**
 * @description The most Chaos events on screen at once at any moment of a race (contract § 4's
 *   "overlapping at the busiest moment"). The count is highest at some event's start, so only
 *   starts are checked.
 * @param {Object} plan - From buildRacePlan.
 * @returns {number} The busiest overlap (0 in a race with no Chaos events).
 * @example
 *   busiestOverlap(plan) <= 5;
 * @since 2.0.0
 */
export function busiestOverlap(plan) {
  const chaos = plan.events.filter((event) => event.category === 'chaos');
  return chaos.reduce((most, event) => {
    const active = chaos.filter((other) => (
      other.startMs <= event.startMs && event.startMs < other.endMs
    ));
    return Math.max(most, active.length);
  }, 0);
}

/**
 * @description Says whether every squirrel had a Chaos moment of its own: an event that singles it
 *   out (a field-wide stall alone does not count).
 * @param {Object} plan - From buildRacePlan.
 * @returns {boolean} True when every entrant has one.
 * @example
 *   everyEntrantCovered(plan);
 * @since 2.0.0
 */
export function everyEntrantCovered(plan) {
  return plan.entrants.every((entrant) => entrant.chaosEvents.some((record) => record.personal));
}

/**
 * @description What one simulated race looked like.
 * @param {Object} plan - From buildRacePlan.
 * @param {number} finaleMinEvents - Burst events needed to count as a finale (0 for none).
 * @returns {Object} The race's outcome: the M8 measures, the Chaos v2 measures and which event
 *   types appeared.
 * @since 1.0.0
 */
function raceOutcome(plan, finaleMinEvents) {
  const types = new Set(plan.events.map((event) => event.type));
  return {
    winnerLeads: leaderAt(plan, plan.durationMs * QUARTER) === plan.winnerIndex,
    leadChanges: leaderChanges(plan).filter((change) => change.previousIndex !== null).length,
    outOfOrder: orderViolations(plan) > 0,
    tornado: types.has('tornado'),
    hunter: types.has('hunter'),
    suitor: types.has('suitor'),
    goldenAcorn: types.has('goldenAcorn'),
    busiest: busiestOverlap(plan),
    covered: everyEntrantCovered(plan),
    finale: finaleMinEvents > 0 && plan.finaleBurst !== null
      && plan.finaleBurst.count >= finaleMinEvents
  };
}

/**
 * @description Checks and fills the simulate() options.
 * @param {number} count - Races to run.
 * @param {Object} options - The caller's options.
 * @returns {{entrantCount: number, mode: string, chaosLevel: (string|null),
 *   durationMs: (number|null), seed: number}} The settings.
 * @throws {RangeError} If an option is out of range.
 * @since 1.0.0
 */
function simulationSettings(count, options) {
  const settings = {
    entrantCount: 8,
    mode: 'classic',
    chaosLevel: null,
    durationMs: null,
    seed: null,
    ...options
  };
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError('simulate needs a whole number of races, at least 1.');
  }
  if (!Number.isInteger(settings.entrantCount) || settings.entrantCount < 1) {
    throw new RangeError('simulate needs entrantCount of at least 1.');
  }
  if (!MODES.includes(settings.mode)) {
    throw new RangeError(`Unknown race mode: ${settings.mode}.`);
  }
  return {...settings, seed: settings.seed ?? randomSeed()};
}

/**
 * @description Fakes count results and runs the choreography on each, reporting the M8 numbers
 *   (SPEC.md § 14): how often the eventual winner leads at 25% of the race, how often there are
 *   two or more lead changes (each held 0.5 s, a win on the line included), how many races broke
 *   the stored order (must be 0); and in Chaos how often each headline event appeared plus the
 *   Chaos v2 measures (contract § 4): the mean busiest overlap, how often every squirrel had a
 *   moment of its own, how often there was a finale burst. Without durationMs each race takes a
 *   random length allowed for its mode.
 * @param {number} count - Races to run.
 * @param {{entrantCount?: number, mode?: string, chaosLevel?: string, durationMs?: number,
 *   seed?: number}} [options] - Defaults: 8 entrants, Classic (Chaos defaults to Silly), random
 *   lengths, a fresh random seed (reported back).
 * @returns {{races: number, mode: string, chaosLevel: (string|null), entrantCount: number,
 *   seed: number, winnerLeadsAtQuarterShare: number, twoOrMoreLeadChangesShare: number,
 *   meanLeadChanges: number, outOfOrderCount: number, tornadoShare: number,
 *   hunterShare: number, suitorShare: number, goldenAcornShare: number,
 *   meanBusiestOverlap: number, maxBusiestOverlap: number, everyEntrantCoveredShare: number,
 *   finaleBurstShare: number}} Shares are 0 to 1.
 * @throws {RangeError} If an option is out of range.
 * @example
 *   simulate(1000, {mode: 'chaos', chaosLevel: 'carnage', seed: 42});
 * @since 1.0.0
 */
export function simulate(count, options = {}) {
  const settings = simulationSettings(count, options);
  const rng = createRng(settings.seed);
  const lengths = themeConfig.race.lengths[settings.mode].map((length) => length.seconds * 1000);
  const names = Array.from(
    {length: settings.entrantCount},
    (_value, index) => `Squirrel ${index + 1}`
  );
  const totals = {
    winnerLeads: 0,
    twoOrMore: 0,
    leadChanges: 0,
    outOfOrder: 0,
    tornado: 0,
    hunter: 0,
    suitor: 0,
    goldenAcorn: 0,
    busiest: 0,
    maxBusiest: 0,
    covered: 0,
    finale: 0
  };
  let chaosLevel = null;
  for (let race = 0; race < count; race += 1) {
    const durationMs = settings.durationMs || rng.pick(lengths);
    const result = fakeResult(rng, names, durationMs);
    const plan = buildRacePlan({
      entrants: result.entrants,
      seed: rng.intBetween(0, MAX_SEED),
      durationMs,
      mode: settings.mode,
      chaosLevel: settings.chaosLevel
    });
    chaosLevel = plan.chaosLevel;
    const finaleSettings = chaosLevel ? themeConfig.chaosLevels.levels[chaosLevel].finale : null;
    const outcome = raceOutcome(plan, finaleSettings ? finaleSettings.minEvents : 0);
    totals.winnerLeads += outcome.winnerLeads ? 1 : 0;
    totals.twoOrMore += outcome.leadChanges >= 2 ? 1 : 0;
    totals.leadChanges += outcome.leadChanges;
    totals.outOfOrder += outcome.outOfOrder ? 1 : 0;
    totals.tornado += outcome.tornado ? 1 : 0;
    totals.hunter += outcome.hunter ? 1 : 0;
    totals.suitor += outcome.suitor ? 1 : 0;
    totals.goldenAcorn += outcome.goldenAcorn ? 1 : 0;
    totals.busiest += outcome.busiest;
    totals.maxBusiest = Math.max(totals.maxBusiest, outcome.busiest);
    totals.covered += outcome.covered ? 1 : 0;
    totals.finale += outcome.finale ? 1 : 0;
  }
  return {
    races: count,
    mode: settings.mode,
    chaosLevel,
    entrantCount: settings.entrantCount,
    seed: settings.seed,
    winnerLeadsAtQuarterShare: totals.winnerLeads / count,
    twoOrMoreLeadChangesShare: totals.twoOrMore / count,
    meanLeadChanges: totals.leadChanges / count,
    outOfOrderCount: totals.outOfOrder,
    tornadoShare: totals.tornado / count,
    hunterShare: totals.hunter / count,
    suitorShare: totals.suitor / count,
    goldenAcornShare: totals.goldenAcorn / count,
    meanBusiestOverlap: totals.busiest / count,
    maxBusiestOverlap: totals.maxBusiest,
    everyEntrantCoveredShare: totals.covered / count,
    finaleBurstShare: totals.finale / count
  };
}
