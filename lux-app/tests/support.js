/**
 * Shared helpers for the choreography tests: seeded race inputs and the invariant checks from
 * SPEC.md § 14 (M6 and M7) and the Chaos v2 contract (§ 1, § 3, § 4). Not a test file itself
 * (the name does not match *.test.js).
 *
 * Checks report through assert.fail only when something is wrong, so the 10,000-race loops do
 * not build a message string per keyframe.
 */
import assert from 'node:assert/strict';
import {createRng} from '../lib/rng.js';
import {fakeResult, busiestOverlap} from '../lib/simulate.js';
import {buildRacePlan, heightAt, laneAt, outfitAt} from '../lib/choreography.js';
import {outfitForDrawing, rollOutfit} from '../lib/outfits.js';
import {themeConfig} from '../lib/theme-config.js';

export const TICK_MS = 250;
export const CLASSIC_LENGTHS_MS = [10000, 20000, 40000];
export const CHAOS_LENGTHS_MS = [45000, 60000, 90000];
export const CHAOS_LEVELS = ['mild', 'silly', 'carnage'];
export const MAX_SEED = 2147483646;
const CEILING = 98;
const SCOPES = ['entrants', 'field'];
const COMBOS = ['hunterVsTornado', 'eagleIntoFunnel', 'suitorSwept', 'catVsEagle'];
const KNOWN_IDS = Object.fromEntries(themeConfig.outfits.slotOrder.map((slot) => (
  [slot, new Set(themeConfig.outfits.slots[slot].map((item) => item.id))]
)));

/**
 * @description Names 'Racer 1' to 'Racer n'.
 * @param {number} count - How many.
 * @returns {string[]} The names.
 */
export function makeNames(count) {
  return Array.from({length: count}, (_value, index) => `Racer ${index + 1}`);
}

/**
 * @description A random stored race, as the payload would carry it (outfits included), from a
 *   seeded generator.
 * @param {Object} rng - A seeded generator.
 * @param {{minEntrants: number, maxEntrants: number, lengths: number[], mode: string,
 *   chaosLevel?: string}} shape - The range of races wanted.
 * @returns {Object} The buildRacePlan input.
 */
export function randomRaceInput(rng, shape) {
  const entrantCount = rng.intBetween(shape.minEntrants, shape.maxEntrants);
  const durationMs = rng.pick(shape.lengths);
  const result = fakeResult(rng, makeNames(entrantCount), durationMs, 0.25);
  const entrants = result.entrants.map((entrant) => ({...entrant, outfit: rollOutfit(rng)}));
  const seed = rng.intBetween(0, MAX_SEED);
  const input = {entrants, seed, durationMs, mode: shape.mode};
  return shape.chaosLevel ? {...input, chaosLevel: shape.chaosLevel} : input;
}

/**
 * @description The level settings a plan was built with, or null for Classic.
 * @param {Object} plan - The plan.
 * @returns {Object|null} The level settings.
 */
function levelOf(plan) {
  return plan.chaosLevel ? themeConfig.chaosLevels.levels[plan.chaosLevel] : null;
}

/**
 * @description Every entrant's height at one moment.
 * @param {Object} plan - The plan.
 * @param {number} timeMs - The moment.
 * @returns {number[]} Heights by entrant index.
 */
function heightsAt(plan, timeMs) {
  return plan.entrants.map((_entrant, index) => heightAt(plan, index, timeMs));
}

/**
 * @description Keyframe checks for one entrant: tick grid, 0 at the start, within [0, 98]
 *   before the final tick, exactly 100 at the final tick (which sits at finishMs).
 * @param {Object} entrant - A plan entrant.
 * @param {Object} inputEntrant - The matching input entrant.
 * @returns {void}
 */
function checkKeyframes(entrant, inputEntrant) {
  const label = `entrant ${entrant.index}`;
  if (entrant.lane !== inputEntrant.lane || entrant.position !== inputEntrant.position
    || entrant.finishMs !== inputEntrant.finishMs) {
    assert.fail(`${label} does not match its input`);
  }
  const tickCount = Math.ceil(inputEntrant.finishMs / TICK_MS);
  if (entrant.tickCount !== tickCount || entrant.times.length !== tickCount + 1
    || entrant.heights.length !== tickCount + 1) {
    assert.fail(`${label} has the wrong number of keyframes`);
  }
  if (entrant.times[0] !== 0 || entrant.heights[0] !== 0) {
    assert.fail(`${label} does not start at 0`);
  }
  if (entrant.times[tickCount] !== entrant.finishMs || entrant.heights[tickCount] !== 100) {
    assert.fail(`${label} does not reach 100 exactly at finishMs`);
  }
  for (let tick = 1; tick < tickCount; tick += 1) {
    const height = entrant.heights[tick];
    if (!(height >= 0 && height <= CEILING) || entrant.times[tick] !== tick * TICK_MS) {
      assert.fail(`${label} keyframe ${tick} breaks the grid or the [0, 98] band: ${height}`);
    }
  }
}

/**
 * @description Finish checks through the render query: under 100 a moment before finishMs,
 *   exactly 100 at and after it, and finish times strictly increasing with position.
 * @param {Object} plan - The plan.
 * @returns {void}
 */
function checkFinishMoments(plan) {
  plan.entrants.forEach((entrant, index) => {
    const before = heightAt(plan, index, entrant.finishMs - 1);
    const atFinish = heightAt(plan, index, entrant.finishMs);
    const after = heightAt(plan, index, entrant.finishMs + 5000);
    if (!(before < 100) || atFinish !== 100 || after !== 100) {
      assert.fail(`entrant ${index} reaches the top at the wrong moment`);
    }
  });
  const byPosition = plan.finishOrder.map((index) => plan.entrants[index]);
  byPosition.forEach((entrant, place) => {
    if (entrant.position !== place + 1) {
      assert.fail('finishOrder is not sorted by position');
    }
    if (place > 0 && !(entrant.finishMs > byPosition[place - 1].finishMs)) {
      assert.fail('finish times do not strictly increase with position');
    }
  });
}

/**
 * @description Event rules for one entrant: inside its event window (never in the last 10% of
 *   its ticks), no overlapping spans, and stalls within the level's share of its ticks.
 *   Integer arithmetic.
 * @param {Object} entrant - A plan entrant.
 * @param {Object} plan - The plan.
 * @returns {void}
 */
function checkEventRules(entrant, plan) {
  const label = `entrant ${entrant.index}`;
  const level = levelOf(plan);
  const stallPercent = level ? level.maxStallPercent : themeConfig.choreography.maxStallPercent;
  const events = entrant.classicEvents.concat(entrant.chaosEvents)
    .sort((left, right) => left.startTick - right.startTick);
  let stalls = 0;
  events.forEach((event, order) => {
    if (event.startTick < 1 || event.endTick < event.startTick
      || event.endTick * 100 > entrant.tickCount * 90) {
      assert.fail(`${label} ${event.id} sits in the event-free last 10% (or before tick 1)`);
    }
    if (order > 0 && event.startTick <= events[order - 1].endTick) {
      assert.fail(`${label} ${event.id} overlaps ${events[order - 1].id}`);
    }
    stalls += event.stallTicks;
  });
  if (stalls !== entrant.stalledTicks || stalls * 100 > entrant.tickCount * stallPercent) {
    assert.fail(`${label} stalls ${stalls} of ${entrant.tickCount} ticks`);
  }
}

/**
 * @description Outfit timeline rules: starts at 0 with the stored outfit, in time order, only
 *   known catalogue ids, and outfitAt agrees with it.
 * @param {Object} plan - The plan.
 * @param {Object} entrant - A plan entrant.
 * @param {Object} inputEntrant - The matching input entrant.
 * @returns {void}
 */
function checkOutfitTimeline(plan, entrant, inputEntrant) {
  const label = `entrant ${entrant.index}`;
  const timeline = entrant.outfitTimeline;
  const stored = outfitForDrawing(inputEntrant.outfit);
  if (timeline[0].atMs !== 0 || JSON.stringify(timeline[0].outfit) !== JSON.stringify(stored)) {
    assert.fail(`${label} outfit timeline does not start with its stored outfit`);
  }
  timeline.forEach((entry, order) => {
    if (order > 0 && entry.atMs < timeline[order - 1].atMs) {
      assert.fail(`${label} outfit timeline is out of order`);
    }
    Object.keys(KNOWN_IDS).forEach((slot) => {
      if (!KNOWN_IDS[slot].has(entry.outfit[slot])) {
        assert.fail(`${label} outfit names an unknown ${slot}: ${entry.outfit[slot]}`);
      }
    });
  });
  const last = timeline[timeline.length - 1];
  const drawn = outfitAt(plan, entrant.index, last.atMs + 1);
  if (JSON.stringify(drawn) !== JSON.stringify(last.outfit)) {
    assert.fail(`${label} outfitAt disagrees with its timeline`);
  }
  if (plan.mode === 'classic' && timeline.length !== 1) {
    assert.fail('a Classic race changed an outfit');
  }
}

/**
 * @description Event shape rules (contract § 3): unique evt-N ids, a known scope, valid entrant
 *   indexes (every entrant for a field event), the v1 aliases matching, events in time order.
 * @param {Object} plan - The plan.
 * @returns {void}
 */
function checkEventShapes(plan) {
  const count = plan.entrants.length;
  const ids = new Set();
  plan.events.forEach((event, order) => {
    if (!/^evt-\d+$/.test(event.id) || ids.has(event.id)) {
      assert.fail(`bad or repeated event id ${event.id}`);
    }
    ids.add(event.id);
    const validEntrants = event.entrants.every((index) => (
      Number.isInteger(index) && index >= 0 && index < count
    ));
    if (!SCOPES.includes(event.scope) || !validEntrants || !(event.endMs > event.startMs)) {
      assert.fail(`event ${event.id} has a bad scope, entrant list or window`);
    }
    if (event.scope === 'field' && event.entrants.length !== count) {
      assert.fail(`field event ${event.id} does not list every entrant`);
    }
    if (JSON.stringify(event.entrantIndexes) !== JSON.stringify(event.entrants)
      || JSON.stringify(event.details) !== JSON.stringify(event.data)) {
      assert.fail(`event ${event.id} v1 aliases do not match`);
    }
    if (order > 0 && event.startMs < plan.events[order - 1].startMs) {
      assert.fail('events are not in time order');
    }
  });
  if (plan.mode === 'classic' && (plan.raceEvents.length > 0
    || plan.events.some((event) => event.category === 'chaos'))) {
    assert.fail('a Classic race has Chaos events');
  }
}

/**
 * @description The level's overlap cap holds at the busiest moment (contract § 1).
 * @param {Object} plan - The plan.
 * @returns {void}
 */
function checkOverlapCap(plan) {
  const level = levelOf(plan);
  if (level && busiestOverlap(plan) > level.maxOverlap) {
    assert.fail(`${busiestOverlap(plan)} Chaos events on screen at once in ${plan.chaosLevel}`);
  }
}

/**
 * @description Tornado and UFO rules: tornadoes need three or more entrants, start between 25%
 *   and 70% of the race and lift 2 to 4 squirrels; every swap sends each squirrel to a different
 *   tree and keeps the same set of trees; a shark's chomped hat belongs to a lifted squirrel.
 * @param {Object} plan - The plan.
 * @returns {void}
 */
function checkSwaps(plan) {
  const swappers = plan.events.filter((event) => event.type === 'tornado' || event.type === 'ufo');
  swappers.forEach((event) => {
    const swaps = event.data.swaps || [];
    if (event.type === 'tornado') {
      // Compared as whole numbers: startMs x 100 against durationMs x 25 and x 70.
      const scaledStart = event.startMs * 100;
      const inWindow = scaledStart >= plan.durationMs * 25 && scaledStart <= plan.durationMs * 70;
      const hatOk = event.data.hatChomp === null || event.entrants.includes(event.data.hatChomp);
      if (plan.entrants.length < 3 || !inWindow || swaps.length < 2 || swaps.length > 4 || !hatOk) {
        assert.fail(`tornado ${event.id} breaks the tornado rules`);
      }
    } else if (swaps.length !== 2) {
      assert.fail(`UFO ${event.id} does not swap exactly two squirrels`);
    }
    const from = swaps.map((swap) => swap.fromLane).sort((left, right) => left - right);
    const to = swaps.map((swap) => swap.toLane).sort((left, right) => left - right);
    if (swaps.some((swap) => swap.fromLane === swap.toLane) || from.join() !== to.join()) {
      assert.fail(`${event.id} put a squirrel back on its tree or changed the set of trees`);
    }
  });
}

/**
 * @description Lane rules: at every moment a lane changes (and just around it) every tree holds
 *   at most one racer, except the host's tree during a trench coat, which holds the three
 *   members; a hidden squirrel is always inside an active coat on its host's tree.
 * @param {Object} plan - The plan.
 * @returns {void}
 */
function checkLanes(plan) {
  const count = plan.entrants.length;
  const moments = new Set([0, plan.durationMs]);
  plan.entrants.forEach((entrant) => entrant.laneTimeline.forEach((entry) => {
    const middle = (entry.flightStartMs + entry.flightEndMs) / 2;
    [entry.flightStartMs - 1, entry.flightStartMs, middle, entry.flightEndMs - 1,
      entry.flightEndMs, entry.flightEndMs + 1].forEach((moment) => moments.add(moment));
  }));
  const coats = plan.events.filter((event) => event.type === 'trenchCoat');
  moments.forEach((timeMs) => {
    const active = coats.filter((coat) => coat.startMs <= timeMs && timeMs < coat.endMs);
    const occupants = new Map();
    plan.entrants.forEach((_entrant, index) => {
      const spot = laneAt(plan, index, timeMs);
      if (!Number.isInteger(spot.lane) || spot.lane < 1 || spot.lane > count) {
        assert.fail(`entrant ${index} is on no tree at ${timeMs} ms`);
      }
      occupants.set(spot.lane, (occupants.get(spot.lane) || []).concat([index]));
      const coat = active.find((item) => item.entrants.includes(index));
      if (spot.hidden && (!coat || spot.lane !== coat.data.hostLane)) {
        assert.fail(`entrant ${index} is hidden outside a trench coat at ${timeMs} ms`);
      }
    });
    occupants.forEach((racers, lane) => {
      const sharedCoat = active.find((coat) => (
        coat.data.hostLane === lane && racers.every((index) => coat.entrants.includes(index))
      ));
      if (racers.length > 1 && !sharedCoat) {
        assert.fail(`tree ${lane} holds ${racers.length} racers at ${timeMs} ms`);
      }
    });
  });
}

/**
 * @description One trench coat: the host in the middle, the outer two disguised from the trees
 *   either side of it and toppled back, all within 15 height units when it started.
 * @param {Object} plan - The plan.
 * @param {Object} coat - The trenchCoat event.
 * @returns {void}
 */
function checkTrenchCoat(plan, coat) {
  const heights = heightsAt(plan, coat.startMs);
  const [left, host, right] = coat.entrants;
  const trio = [left, host, right].map((index) => heights[index]);
  const gap = Math.max(...trio) - Math.min(...trio);
  const fromLanes = [left, right].map((index) => {
    const entry = plan.entrants[index].laneTimeline.find((item) => (
      item.eventId === coat.id && item.kind === 'disguise'
    ));
    return entry ? entry.fromLane : null;
  }).sort((first, second) => first - second);
  const hostLane = coat.data.hostLane;
  if (coat.data.host !== host || gap > themeConfig.chaosDeck.trenchCoat.maxHeightGapUnits
    || fromLanes[0] !== hostLane - 1 || fromLanes[1] !== hostLane + 1
    || laneAt(plan, host, coat.startMs).lane !== hostLane) {
    assert.fail(`trench coat ${coat.id} breaks the trench-coat rules`);
  }
}

/**
 * @description Height-dependent events (contract § 4), rechecked on the finished plan at the
 *   moment each was decided: the Golden Acorn's leader was clear of second place by the level's
 *   threshold (and acorns are 10 s apart); a trench coat's trio was on adjacent trees within 15
 *   units; every flood burster was below the waterline.
 * @param {Object} plan - The plan.
 * @returns {void}
 */
function checkLateEvents(plan) {
  const level = levelOf(plan);
  let lastAcornMs = -Infinity;
  plan.events.forEach((event) => {
    if (event.type === 'goldenAcorn') {
      const ranked = heightsAt(plan, event.data.checkpointMs)
        .map((height, index) => ({height, index}))
        .sort((left, right) => right.height - left.height || left.index - right.index);
      const lead = ranked[0].height - ranked[1].height;
      const spaced = event.data.checkpointMs - lastAcornMs >= 10000;
      if (ranked[0].index !== event.entrants[0] || lead < level.goldenAcornLeadUnits || !spaced) {
        assert.fail(`Golden Acorn ${event.id} fired without a clear runaway leader`);
      }
      lastAcornMs = event.data.checkpointMs;
    }
    if (event.type === 'trenchCoat') {
      checkTrenchCoat(plan, event);
    }
    if (event.type === 'flood') {
      const heights = heightsAt(plan, event.data.burstAtMs);
      if (event.data.bursters.some((index) => !(heights[index] < event.data.waterHeightUnits))) {
        assert.fail(`flood ${event.id} burst a squirrel above the waterline`);
      }
    }
  });
}

/**
 * @description Combo rules: every combo names an existing partner of the right type, and the
 *   squirrels line up (the eagle's and the suitor's squirrel is in the tornado; the caught cat's
 *   throw is marked intercepted; the hunter's shot at a tornado touches no squirrel).
 * @param {Object} plan - The plan.
 * @returns {void}
 */
function checkCombos(plan) {
  const byId = new Map(plan.events.map((event) => [event.id, event]));
  plan.events.filter((event) => event.data.combo).forEach((event) => {
    const {kind} = event.data.combo;
    const partner = byId.get(event.data.combo.with);
    const partnerType = kind === 'catVsEagle' ? 'catLady' : 'tornado';
    if (!COMBOS.includes(kind) || !partner || partner.type !== partnerType) {
      assert.fail(`combo on ${event.id} names no valid partner`);
    }
    const squirrel = event.entrants[0];
    const intoTornado = () => (
      partner.entrants.includes(squirrel) && event.endMs === partner.startMs
    );
    const checks = {
      hunterVsTornado: () => event.entrants.length === 0,
      eagleIntoFunnel: intoTornado,
      suitorSwept: intoTornado,
      catVsEagle: () => partner.data.throws.some((item) => (
        item.intercepted && item.entrant === squirrel
      ))
    };
    if (!checks[kind]()) {
      assert.fail(`combo ${kind} on ${event.id} does not line up with ${partner.id}`);
    }
  });
}

/**
 * @description The Absolute Carnage finale burst (contract § 1: one in every race): present, at
 *   least the level's minimum of events, each existing, marked, and starting between 75% and 88%
 *   of the race. No other level has one.
 * @param {Object} plan - The plan.
 * @returns {void}
 */
function checkFinale(plan) {
  if (plan.chaosLevel !== 'carnage') {
    if (plan.finaleBurst !== null) {
      assert.fail('a finale burst outside Absolute Carnage');
    }
    return;
  }
  const {minEvents} = themeConfig.chaosLevels.levels.carnage.finale;
  if (plan.finaleBurst === null || plan.finaleBurst.count < minEvents
    || plan.finaleBurst.count !== plan.finaleBurst.eventIds.length) {
    assert.fail(`an Absolute Carnage race (seed ${plan.seed}) has no full finale burst`);
  }
  const byId = new Map(plan.events.map((event) => [event.id, event]));
  plan.finaleBurst.eventIds.forEach((id) => {
    const event = byId.get(id);
    const scaled = event ? event.startMs * 100 : -1;
    const inWindow = scaled >= plan.durationMs * 75 && scaled <= plan.durationMs * 88;
    if (!event || event.data.finale !== true || !inWindow) {
      assert.fail(`finale event ${id} is missing, unmarked or outside 75% to 88%`);
    }
  });
}

/**
 * @description Every M6, M7 and Chaos v2 invariant for one plan.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object} input - Its input.
 * @returns {void}
 */
export function checkPlanInvariants(plan, input) {
  const expectedLevel = input.mode === 'chaos' ? input.chaosLevel || 'silly' : null;
  if (plan.entrants.length !== input.entrants.length || plan.mode !== input.mode
    || plan.chaosLevel !== expectedLevel) {
    assert.fail('plan does not match its input');
  }
  plan.entrants.forEach((entrant, index) => {
    checkKeyframes(entrant, input.entrants[index]);
    checkEventRules(entrant, plan);
    checkOutfitTimeline(plan, entrant, input.entrants[index]);
  });
  checkFinishMoments(plan);
  checkEventShapes(plan);
  checkOverlapCap(plan);
  checkSwaps(plan);
  checkLanes(plan);
  checkLateEvents(plan);
  checkCombos(plan);
  checkFinale(plan);
}

/**
 * @description Builds many seeded races, checks every invariant on each, and rebuilds every nth
 *   one to prove the same inputs give a deep-equal plan.
 * @param {{seed: number, races: number, mode: string, chaosLevel?: string, minEntrants: number,
 *   maxEntrants: number, lengths: number[], determinismEvery: number}} sweep - What to run.
 * @returns {void}
 */
export function invariantSweep(sweep) {
  const rng = createRng(sweep.seed);
  const shape = {
    minEntrants: sweep.minEntrants,
    maxEntrants: sweep.maxEntrants,
    lengths: sweep.lengths,
    mode: sweep.mode,
    chaosLevel: sweep.chaosLevel
  };
  for (let race = 0; race < sweep.races; race += 1) {
    const input = randomRaceInput(rng, shape);
    const plan = buildRacePlan(input);
    checkPlanInvariants(plan, input);
    if (race % sweep.determinismEvery === 0) {
      assert.deepStrictEqual(buildRacePlan(input), plan);
    }
  }
}
