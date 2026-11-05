/**
 * Race choreography (SPEC.md § 11, Chaos v2 contract § 3): turns a stored result into a race that
 * finishes in exactly that order, and the same inputs always give the same race.
 *
 * How the order is guaranteed: each entrant climbs in "climb units" tick by tick (base pace x a
 * slow form curve, changed by Classic and Chaos events). The running total is floored at 0, then
 * divided by a fixed normaliser so the final tick is exactly 100, and every earlier keyframe is
 * clamped to [0, 98]. So no squirrel shows 100 before its stored finishMs, every squirrel shows
 * 100 from then on, and the stored finish times strictly increase with position. Events never
 * touch an entrant's last 10% of ticks, so the final tick always climbs.
 *
 * The build has two passes. Pass one: the Classic layer, then (Chaos only) the level's deck
 * (chaos.js); lanes and outfits are then resolved in time order and each squirrel's normaliser is
 * fixed at its final total. Pass two (Chaos only, chaos-late.js) adds the events that depend on
 * heights (Golden Acorn, trench coat, flood bursts) without changing any earlier height.
 *
 * Generator order (fixed, § 11.1): for each entrant in input (lane) order, the form frequency,
 * the form phase, one pace draw per tick, then the Classic events in the order nut stop, slip,
 * burst (each a chance roll, its size, then per attempt a start tick). Then, in Chaos mode only,
 * the deck in the order documented in chaos.js, then the late pass in chaos-late.js. Changing
 * this order changes how old replays look, never who won.
 *
 * The plan is plain data, so it can be compared with deepEqual and read by the render queries
 * below, which are pure functions of (plan, time).
 *
 * Pure ES module: no DOM, no Lit and no platform imports.
 */
import {createRng, normaliseSeed} from './rng.js';
import {themeConfig} from './theme-config.js';
import {
  EntrantTrack,
  RaceBuilder,
  clonePlain,
  effectKinds,
  laneFromTimeline,
  layoutFrom
} from './race-builder.js';
import {keyframesFrom, totalsFor} from './climb.js';
import {outfitForDrawing} from './outfits.js';
import {placeChaosEvents} from './chaos.js';
import {placeLateEvents} from './chaos-late.js';

const PLAN_VERSION = 2;
const FULL_HEIGHT = 100;
const TWO_PI = 2 * Math.PI;
const MODES = ['classic', 'chaos'];

/**
 * @description A deep copy of plain event data (an empty object for none).
 * @param {Object} data - Plain data.
 * @returns {Object} The copy.
 * @since 2.0.0
 */
function copyData(data) {
  return clonePlain(data || {});
}

/**
 * @description The Chaos level for a race (contract § 1 and § 3): the stored level in Chaos mode
 *   (missing means the default, Silly), and none in Classic, whatever was passed.
 * @param {{mode: string, chaosLevel?: string}} input - The plan inputs.
 * @param {Object} theme - A theme config.
 * @returns {{id: (string|null), settings: (Object|null)}} The level id and its settings.
 * @throws {RangeError} If a Chaos race names a level the theme does not have.
 * @since 2.0.0
 */
function resolveLevel(input, theme) {
  if (input.mode !== 'chaos') {
    return {id: null, settings: null};
  }
  const {levels, defaultLevel} = theme.chaosLevels;
  const requested = input.chaosLevel;
  if (requested === undefined || requested === null || requested === '') {
    return {id: defaultLevel, settings: levels[defaultLevel]};
  }
  if (typeof requested !== 'string' || !Object.prototype.hasOwnProperty.call(levels, requested)) {
    throw new RangeError(`Unknown chaos level: ${requested}.`);
  }
  return {id: requested, settings: levels[requested]};
}

/**
 * @description Flattens the theme sections the build needs into one settings object; the stall
 *   cap is the level's in Chaos and the choreography's in Classic.
 * @param {Object} theme - A theme config.
 * @param {Object|null} level - The level's settings, or null.
 * @returns {Object} The settings.
 * @since 1.0.0
 */
function resolveSettings(theme, level) {
  const verdicts = (theme.phrases.chaos && theme.phrases.chaos.varVerdict) || [];
  return {
    ...theme.choreography,
    maxStallPercent: level ? level.maxStallPercent : theme.choreography.maxStallPercent,
    tickMs: theme.timings.tickMs,
    leaderHoldMs: theme.timings.leaderHoldMs,
    photoFinishThresholdMs: theme.timings.photoFinishThresholdMs,
    classic: theme.classicEvents,
    deck: theme.chaosDeck,
    skies: theme.skies,
    varVerdicts: verdicts.map((phrase) => phrase.key)
  };
}

/**
 * @description Throws unless the values run 1 to n with no repeats.
 * @param {number[]} values - Lanes or positions.
 * @param {string} label - 'lanes' or 'positions', for the message.
 * @returns {void}
 * @throws {RangeError} If the values are not a permutation of 1 to n.
 * @since 1.0.0
 */
function assertPermutation(values, label) {
  const count = values.length;
  const inRange = values.every((value) => Number.isInteger(value) && value >= 1 && value <= count);
  if (!inRange || new Set(values).size !== count) {
    throw new RangeError(`Entrant ${label} must run 1 to ${count} with no repeats.`);
  }
}

/**
 * @description Throws unless finish times strictly increase with position, the property the
 *   whole order guarantee rests on (the server's draw always gives it).
 * @param {Array<{position: number, finishMs: number}>} entrants - The entrants.
 * @returns {void}
 * @throws {RangeError} If any finish time is missing, not positive or out of order.
 * @since 1.0.0
 */
function assertFinishOrder(entrants) {
  if (!entrants.every((entrant) => Number.isFinite(entrant.finishMs) && entrant.finishMs > 0)) {
    throw new RangeError('Every entrant needs a positive finishMs.');
  }
  const byPosition = entrants.slice().sort((left, right) => left.position - right.position);
  for (let index = 1; index < byPosition.length; index += 1) {
    if (!(byPosition[index].finishMs > byPosition[index - 1].finishMs)) {
      throw new RangeError('Finish times must strictly increase with position.');
    }
  }
}

/**
 * @description Checks the plan inputs.
 * @param {{entrants: Array<Object>, durationMs: number, mode: string}} input - The inputs.
 * @returns {void}
 * @throws {TypeError|RangeError} If an input breaks the payload contract (SPEC.md § 7).
 * @since 1.0.0
 */
function validateInput({entrants, durationMs, mode}) {
  const usable = Array.isArray(entrants)
    && entrants.length > 0
    && entrants.every((entrant) => entrant && typeof entrant === 'object');
  if (!usable) {
    throw new TypeError('buildRacePlan needs at least one entrant object.');
  }
  if (!MODES.includes(mode)) {
    throw new RangeError(`Unknown race mode: ${mode}.`);
  }
  if (!(Number.isFinite(durationMs) && durationMs > 0)) {
    throw new RangeError('durationMs must be a positive number of milliseconds.');
  }
  assertPermutation(entrants.map((entrant) => entrant.lane), 'lanes');
  assertPermutation(entrants.map((entrant) => entrant.position), 'positions');
  assertFinishOrder(entrants);
}

/**
 * @description Tries to place one Classic event on an entrant at random start ticks.
 * @param {RaceBuilder} builder - The race builder.
 * @param {EntrantTrack} track - The entrant's track.
 * @param {string} type - 'nutStop', 'slip' or 'burst'.
 * @param {Object} layout - The event layout.
 * @param {Object} data - Informational data for the renderer.
 * @returns {boolean} True when placed.
 * @since 1.0.0
 */
function placeClassic(builder, track, type, layout, data) {
  const latestStart = track.latestStart(layout);
  if (latestStart < track.earliestEventTick) {
    return false;
  }
  for (let attempt = 0; attempt < builder.settings.placementAttempts; attempt += 1) {
    const startTick = builder.rng.intBetween(track.earliestEventTick, latestStart);
    if (track.canPlace(startTick, layout)) {
      const {id, sequence} = builder.registerEvent({
        type,
        category: 'classic',
        scope: 'entrants',
        outcome: null,
        startMs: builder.tickStartMs(startTick),
        endMs: builder.tickEndMs(startTick + layout.spanTicks - 1),
        entrants: [track.index],
        data
      });
      track.commit(startTick, layout, {eventId: id, sequence, category: 'classic', personal: true});
      return true;
    }
  }
  return false;
}

/**
 * @description Rolls an entrant's Classic events (§ 11.4): a nut stop, a slip and a burst, each
 *   by its own chance and in that order.
 * @param {RaceBuilder} builder - The race builder.
 * @param {EntrantTrack} track - The entrant's track.
 * @returns {void}
 * @since 1.0.0
 */
function placeClassicEvents(builder, track) {
  const {rng, settings} = builder;
  const rules = settings.classic;
  if (rng.chance(rules.nutStop.chance)) {
    const ticks = rng.intBetween(rules.nutStop.minTicks, rules.nutStop.maxTicks);
    placeClassic(builder, track, 'nutStop', layoutFrom([{kind: effectKinds.stall, ticks}]), {});
  }
  if (rng.chance(rules.slip.chance)) {
    const strength = rng.floatBetween(rules.slip.minMeanClimbs, rules.slip.maxMeanClimbs);
    const layout = layoutFrom([
      {kind: effectKinds.set, ticks: 1, value: -strength * settings.paceMean},
      {kind: effectKinds.idle, ticks: rules.slip.recoveryTicks}
    ]);
    placeClassic(builder, track, 'slip', layout, {strength: Math.round(strength * 100) / 100});
  }
  if (rng.chance(rules.burst.chance)) {
    const layout = layoutFrom([
      {kind: effectKinds.scale, ticks: rules.burst.ticks, value: rules.burst.paceMultiplier}
    ]);
    placeClassic(builder, track, 'burst', layout, {multiplier: rules.burst.paceMultiplier});
  }
}

/**
 * @description Rolls an entrant's base climbs (§ 11.3) and then its Classic events.
 * @param {RaceBuilder} builder - The race builder.
 * @param {EntrantTrack} track - The entrant's track.
 * @returns {number[]} Base climb per tick, index 1 to tickCount (index 0 is unused).
 * @since 1.0.0
 */
function rollClassicLayer(builder, track) {
  const {rng, settings} = builder;
  const frequency = rng.floatBetween(settings.formFrequencyMin, settings.formFrequencyMax);
  const phase = rng.floatBetween(0, TWO_PI);
  const baseClimbs = [0];
  for (let tick = 1; tick <= track.tickCount; tick += 1) {
    const angle = (TWO_PI * frequency * tick) / track.tickCount + phase;
    const form = 1 + settings.formAmplitude * Math.sin(angle);
    baseClimbs.push(rng.floatBetween(settings.paceMin, settings.paceMax) * form);
  }
  placeClassicEvents(builder, track);
  return baseClimbs;
}

/**
 * @description One event as the plan carries it (contract § 3), with the v1 field names kept as
 *   copies for the stage: entrantIndexes (= entrants) and details (= data).
 * @param {Object} event - A resolved event.
 * @returns {Object} The plan event.
 * @since 2.0.0
 */
function planEvent(event) {
  return {
    id: event.id,
    sequence: event.sequence,
    type: event.type,
    category: event.category,
    scope: event.scope,
    outcome: event.outcome,
    startMs: event.startMs,
    endMs: event.endMs,
    entrants: event.entrants.slice(),
    entrantIndexes: event.entrants.slice(),
    data: copyData(event.data),
    details: copyData(event.data)
  };
}

/**
 * @description One squirrel's own record of an event: its span on that squirrel, whether the
 *   event singles it out, and the event's data plus anything specific to this squirrel (its
 *   lanes in a swap, its drop or slip size, its cling length).
 * @param {Object} span - The track span.
 * @param {Object} event - The resolved event.
 * @param {number} entrantIndex - The squirrel.
 * @param {number} tickMs - The tick length.
 * @returns {Object} The record.
 * @since 2.0.0
 */
function entrantRecord(span, event, entrantIndex, tickMs) {
  const swap = (event.data.swaps || []).find((item) => item.entrant === entrantIndex);
  const lanes = swap ? {fromLane: swap.fromLane, toLane: swap.toLane} : {};
  const data = {...copyData(event.data), ...span.extra, ...lanes};
  return {
    id: event.id,
    sequence: event.sequence,
    type: event.type,
    category: event.category,
    scope: event.scope,
    outcome: event.outcome,
    personal: span.personal,
    startTick: span.startTick,
    endTick: span.endTick,
    startMs: (span.startTick - 1) * tickMs,
    endMs: span.endTick * tickMs,
    stallTicks: span.stallTicks,
    data,
    details: copyData(data)
  };
}

/**
 * @description Copies one entrant into the plan.
 * @param {EntrantTrack} track - The entrant's track.
 * @param {Object} inputEntrant - The payload entrant.
 * @param {RaceBuilder} builder - The race builder (for outfits and settings).
 * @param {Map<string, Object>} eventsById - Resolved events by id.
 * @returns {Object} The plan entrant.
 * @since 1.0.0
 */
function planEntrant(track, inputEntrant, builder, eventsById) {
  const {settings} = builder;
  const snapshot = track.snapshot();
  const keyframes = keyframesFrom(track.totals(), track.normaliser(), track.finishMs, settings);
  const records = snapshot.spans
    .map((span) => entrantRecord(span, eventsById.get(span.eventId), track.index, settings.tickMs))
    .sort((left, right) => left.startTick - right.startTick);
  return {
    index: track.index,
    lane: track.startLane,
    position: inputEntrant.position,
    finishMs: track.finishMs,
    name: typeof inputEntrant.name === 'string' ? inputEntrant.name : '',
    tickCount: track.tickCount,
    times: keyframes.times,
    heights: keyframes.heights,
    classicEvents: records.filter((record) => record.category === 'classic'),
    chaosEvents: records.filter((record) => record.category === 'chaos'),
    laneTimeline: snapshot.laneTimeline,
    outfitTimeline: builder.outfitTimeline(track.index),
    stalledTicks: snapshot.stalledTicks
  };
}

/**
 * @description The sky for a race (Chaos v2 contract § 14): one seeded pool for Classic and
 *   Chaos alike, picked from the seed without touching the generator, so the sky never changes
 *   the race (its events, order and times).
 * @param {number} seed - The normalised seed.
 * @param {string} _mode - 'classic' or 'chaos'. No longer used: both modes share the pool.
 * @param {Object} skies - The theme's skies section.
 * @returns {string} A sky preset id.
 * @since 1.0.0
 */
function skyFor(seed, _mode, skies) {
  return skies.seededChoices[seed % skies.seededChoices.length];
}

/**
 * @description Says whether an event belongs in raceEvents: a Chaos event that is field-wide or
 *   touches more than one squirrel.
 * @param {Object} event - A plan event.
 * @returns {boolean} True for a race-level event.
 * @since 2.0.0
 */
function isRaceEvent(event) {
  return event.category === 'chaos' && (event.scope === 'field' || event.entrants.length > 1);
}

/**
 * @description Copies the finished build out into the plan.
 * @param {RaceBuilder} builder - The race builder, both passes done.
 * @param {Object} input - The plan inputs.
 * @param {{seed: number, levelId: (string|null)}} resolved - The normalised seed and level.
 * @returns {Object} The plan.
 * @since 2.0.0
 */
function assemblePlan(builder, input, resolved) {
  const events = builder.eventsSnapshot();
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const entrants = builder.tracks.map((track) => (
    planEntrant(track, input.entrants[track.index], builder, eventsById)
  ));
  const planEvents = events.map(planEvent);
  const finishOrder = entrants
    .slice()
    .sort((left, right) => left.position - right.position)
    .map((entrant) => entrant.index);
  const photoGap = entrants.length > 1
    ? entrants[finishOrder[1]].finishMs - entrants[finishOrder[0]].finishMs
    : Infinity;
  const finale = builder.finale();
  return {
    version: PLAN_VERSION,
    mode: input.mode,
    chaosLevel: resolved.levelId,
    seed: resolved.seed,
    durationMs: input.durationMs,
    tickMs: builder.settings.tickMs,
    sky: skyFor(resolved.seed, input.mode, builder.settings.skies),
    photoFinish: photoGap <= builder.settings.photoFinishThresholdMs,
    winnerIndex: finishOrder[0],
    finishOrder,
    entrants,
    raceEvents: planEvents.filter(isRaceEvent).map(planEvent),
    events: planEvents,
    finaleBurst: finale ? {...finale, count: finale.eventIds.length} : null
  };
}

/**
 * @description Builds the race plan: a pure function of its inputs, chaosLevel included (same
 *   inputs, deep-equal plan). Entrants come from the race payload, sorted by lane, and keep their
 *   input order.
 * @param {{entrants: Array<{lane: number, position: number, finishMs: number, name?: string,
 *   outfit?: Object}>, seed: number, durationMs: number, mode: string,
 *   chaosLevel?: string}} input - The stored race. chaosLevel ('mild', 'silly' or 'carnage')
 *   defaults to 'silly' in Chaos and is ignored in Classic.
 * @param {Object} [theme] - A theme config; defaults to the squirrel theme.
 * @returns {Object} The plan: version, mode, chaosLevel, seed, durationMs, tickMs, sky,
 *   photoFinish, winnerIndex, finishOrder, entrants (keyframes, Classic and Chaos event records,
 *   lane timeline, outfit timeline, stalled ticks), events (every event in time order, contract
 *   § 3 shape), raceEvents (the field-wide and multi-squirrel ones) and finaleBurst.
 * @throws {TypeError|RangeError} If the input breaks the payload contract.
 * @example
 *   const plan = buildRacePlan({entrants: payload.entrants, seed: payload.race.seed,
 *     durationMs: payload.race.durationMs, mode: payload.race.mode,
 *     chaosLevel: payload.race.chaosLevel});
 * @since 1.0.0
 */
export function buildRacePlan(input, theme = themeConfig) {
  validateInput(input);
  const level = resolveLevel(input, theme);
  const settings = resolveSettings(theme, level.settings);
  const seed = normaliseSeed(input.seed);
  const tracks = input.entrants.map((entrant, index) => new EntrantTrack(entrant, index, settings));
  const builder = new RaceBuilder({
    rng: createRng(seed),
    settings,
    tracks,
    durationMs: input.durationMs,
    mode: input.mode,
    level: level.settings,
    storedOutfits: input.entrants.map((entrant) => outfitForDrawing(entrant.outfit, theme.outfits))
  });
  tracks.forEach((track) => track.setBaseClimbs(rollClassicLayer(builder, track)));
  if (input.mode === 'chaos') {
    placeChaosEvents(builder);
  }
  builder.resolveLanes();
  builder.resolveOutfits();
  tracks.forEach((track) => {
    const totals = totalsFor(track.baseClimbs(), track.effectsCopy(), track.boostsCopy());
    track.setTotals(totals, totals[track.tickCount]);
  });
  if (input.mode === 'chaos') {
    placeLateEvents(builder);
  }
  return assemblePlan(builder, input, {seed, levelId: level.id});
}

/**
 * @description An entrant's height at a moment: linear between keyframes, 0 before the start
 *   and exactly 100 at and after its finishMs. Pure: the same (plan, time) always gives the
 *   same height, at any frame rate.
 * @param {Object} plan - From buildRacePlan.
 * @param {number} entrantIndex - The entrant's index.
 * @param {number} timeMs - Milliseconds since the start, from the component's clock.
 * @returns {number} The height, 0 to 100.
 * @example
 *   const y = (1 - heightAt(plan, index, elapsed) / 100) * climbHeight;
 * @since 1.0.0
 */
export function heightAt(plan, entrantIndex, timeMs) {
  const entrant = plan.entrants[entrantIndex];
  if (timeMs >= entrant.finishMs) {
    return FULL_HEIGHT;
  }
  if (!(timeMs > 0)) {
    return 0;
  }
  // Keyframe k sits at k x tickMs until the last, so the one before timeMs is a division away.
  const index = Math.floor(timeMs / plan.tickMs);
  const startTime = entrant.times[index];
  const endTime = entrant.times[index + 1];
  const fraction = (timeMs - startTime) / (endTime - startTime);
  const startHeight = entrant.heights[index];
  return startHeight + (entrant.heights[index + 1] - startHeight) * fraction;
}

/**
 * @description An entrant's tree at a moment. During a tornado or UFO flight (or a trench-coat
 *   topple), lane is the tree it left and flight says where it is going and how far through it
 *   is; inside a trench coat, lane is the host's tree and hidden is true.
 * @param {Object} plan - From buildRacePlan.
 * @param {number} entrantIndex - The entrant's index.
 * @param {number} timeMs - Milliseconds since the start.
 * @returns {{lane: number, flight: ({fromLane: number, toLane: number, progress: number}|null),
 *   hidden: boolean}} The tree, the flight (progress 0 to 1) or null, and whether hidden.
 * @example
 *   const {lane, flight, hidden} = laneAt(plan, index, elapsed);
 * @since 1.0.0
 */
export function laneAt(plan, entrantIndex, timeMs) {
  const entrant = plan.entrants[entrantIndex];
  return laneFromTimeline(entrant.lane, entrant.laneTimeline, timeMs);
}

/**
 * @description The outfit to draw for an entrant at a moment (contract § 3): the latest outfit
 *   timeline entry at or before the time; before the start, the stored outfit.
 * @param {Object} plan - From buildRacePlan.
 * @param {number} entrantIndex - The entrant's index.
 * @param {number} timeMs - Milliseconds since the start.
 * @returns {{hat: string, cape: string, accessory: string, fur: string}} A copy of the outfit.
 * @example
 *   const outfit = outfitAt(plan, index, elapsed);
 * @since 2.0.0
 */
export function outfitAt(plan, entrantIndex, timeMs) {
  const timeline = plan.entrants[entrantIndex].outfitTimeline;
  let current = timeline[0];
  for (const entry of timeline) {
    if (entry.atMs > timeMs) {
      break;
    }
    current = entry;
  }
  return {...current.outfit};
}

/**
 * @description The entrant in front at a moment: the winner from its finish on, otherwise the
 *   highest squirrel (ties go to the lower input index).
 * @param {Object} plan - From buildRacePlan.
 * @param {number} timeMs - Milliseconds since the start.
 * @returns {number} The leader's entrant index.
 * @example
 *   const leader = leaderAt(plan, plan.durationMs / 4);
 * @since 1.0.0
 */
export function leaderAt(plan, timeMs) {
  if (timeMs >= plan.entrants[plan.winnerIndex].finishMs) {
    return plan.winnerIndex;
  }
  let leader = 0;
  let best = -1;
  for (let index = 0; index < plan.entrants.length; index += 1) {
    const height = heightAt(plan, index, timeMs);
    if (height > best) {
      best = height;
      leader = index;
    }
  }
  return leader;
}

/**
 * @description Orders two leaderboard rows: finished first by position, then by height, then by
 *   input index.
 * @param {Object} left - A row.
 * @param {Object} right - A row.
 * @returns {number} Negative when left comes first.
 * @since 1.0.0
 */
function compareRows(left, right) {
  if (left.finished !== right.finished) {
    return left.finished ? -1 : 1;
  }
  if (left.finished) {
    return left.position - right.position;
  }
  return right.height - left.height || left.entrantIndex - right.entrantIndex;
}

/**
 * @description The leaderboard at a moment (§ 11.10): finished entrants first by position, then
 *   the rest by current height. The race view shows the top five.
 * @param {Object} plan - From buildRacePlan.
 * @param {number} timeMs - Milliseconds since the start.
 * @returns {Array<{entrantIndex: number, name: string, lane: number, height: number,
 *   finished: boolean, position: (number|null)}>} Every entrant, best first.
 * @example
 *   const topFive = leaderboardAt(plan, elapsed).slice(0, 5);
 * @since 1.0.0
 */
export function leaderboardAt(plan, timeMs) {
  const rows = plan.entrants.map((entrant, index) => {
    const finished = timeMs >= entrant.finishMs;
    return {
      entrantIndex: index,
      name: entrant.name,
      lane: laneAt(plan, index, timeMs).lane,
      height: heightAt(plan, index, timeMs),
      finished,
      position: finished ? entrant.position : null
    };
  });
  return rows.sort(compareRows);
}

/**
 * @description Every change of leader that held for the hold time (§ 11.11), sampled on the
 *   tick grid. The first entry is the first leader to establish itself (previousIndex null).
 * @param {Object} plan - From buildRacePlan.
 * @param {{sampleMs?: number, holdMs?: number, untilMs?: number}} [options] - Sampling step
 *   (default tickMs), hold time (default the theme's 500 ms) and last sample (default
 *   durationMs + hold, so a win on the line counts).
 * @returns {Array<{atMs: number, entrantIndex: number, previousIndex: (number|null)}>} Changes,
 *   at the moment each new leader had held for the hold time.
 * @example
 *   const changes = leaderChanges(plan).filter((change) => change.previousIndex !== null);
 * @since 1.0.0
 */
export function leaderChanges(plan, options = {}) {
  const sampleMs = options.sampleMs || plan.tickMs;
  const holdMs = options.holdMs ?? themeConfig.timings.leaderHoldMs;
  const untilMs = options.untilMs ?? plan.durationMs + holdMs;
  const changes = [];
  let confirmed = null;
  let candidate = null;
  let candidateSince = 0;
  for (let timeMs = sampleMs; timeMs <= untilMs; timeMs += sampleMs) {
    const leader = leaderAt(plan, timeMs);
    if (leader !== candidate) {
      candidate = leader;
      candidateSince = timeMs;
    }
    if (candidate !== confirmed && timeMs - candidateSince >= holdMs) {
      changes.push({atMs: timeMs, entrantIndex: candidate, previousIndex: confirmed});
      confirmed = candidate;
    }
  }
  return changes;
}

/**
 * @description The events on screen at a moment, for the renderer: each with its type, scope,
 *   squirrels, outcome, data and how far through it is.
 * @param {Object} plan - From buildRacePlan.
 * @param {number} timeMs - Milliseconds since the start.
 * @returns {Array<Object>} Copies of the active events (plan event shape plus progress 0 to 1).
 * @example
 *   activeEventsAt(plan, elapsed).forEach((event) => animate(event));
 * @since 1.0.0
 */
export function activeEventsAt(plan, timeMs) {
  return plan.events
    .filter((event) => event.startMs <= timeMs && timeMs < event.endMs)
    .map((event) => ({
      ...planEvent(event),
      progress: (timeMs - event.startMs) / (event.endMs - event.startMs)
    }));
}
