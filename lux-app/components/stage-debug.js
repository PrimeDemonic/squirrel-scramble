/**
 * The browser console hooks for testing (SPEC.md § 14):
 * - SquirrelScramble.debug.simulate(1000) fakes stored results under the server's timing rules,
 *   runs the choreography on each, for both race modes with 8 squirrels, and logs and returns how
 *   the races felt (how often the eventual winner leads at the quarter mark, how many lead
 *   changes, whether any race broke the stored order, and how often Chaos events appear). M8.
 * - SquirrelScramble.debug.events() lists the events of the race on screen (id, type, scope,
 *   outcome, start and end in race milliseconds, the squirrels, the combo and the event's data),
 *   and SquirrelScramble.debug.seek(raceMs) jumps
 *   that race's clock to a moment, so a tester can watch a tornado, a hunter or a suitor without
 *   waiting for it. Seeking only moves the clock: the race and its result never change.
 * - SquirrelScramble.debug.parts() lists the timed parts of the visitors on screen (kind, share of
 *   their window, the transform and opacity last written, and their boxes), for diagnosis.
 * - SquirrelScramble.debug.perf(ms = 3000) records the gaps between animation frames for ms from
 *   now and resolves to {frames, meanMs, p95Ms, maxMs, longFrames} (long means over 50 ms;
 *   Chaos v2 contract § 8). seek(t), then perf(), measures any moment of a race.
 * - SquirrelScramble.debug.filmRate(on) switches the race stage's film-rate driver on (true) or
 *   off (false), or toggles it with no argument, and returns the new state; loops() logs and
 *   returns {driven, native}: the looping animations the driver holds and those running on the
 *   platform's own clock (Chaos v2 contract § 10.3). filmRate(false), then perf(), gives the A/B.
 *
 * The simulation is lib/simulate.js; this file only puts the hooks on the window, once, in the
 * browser. Nothing here runs during server rendering.
 */
import {simulate} from '../lib/simulate.js';

const MODES = ['classic', 'chaos'];
const ENTRANTS = 8;
const DEFAULT_RACES = 1000;
// perf(): how long to record by default, and the frame gap that counts as a long frame.
const DEFAULT_PERF_MS = 3000;
const LONG_FRAME_MS = 50;

/**
 * @description Rounds a number to one decimal place.
 * @param {number} value - The number.
 * @returns {number} The rounded number.
 * @since 2.1.0
 */
function round1(value) {
  return Math.round(value * 10) / 10;
}

/**
 * @description Summarises the gaps between animation frames: how many, the mean, the 95th
 *   percentile, the longest, and how many were long (over 50 ms).
 * @param {number[]} gaps - Frame gaps in milliseconds.
 * @returns {{frames: number, meanMs: number, p95Ms: number, maxMs: number,
 *   longFrames: number}} The summary (all zero for no gaps), times to one decimal place.
 * @example
 *   frameStats([16.7, 16.6, 70]);
 *   // {frames: 3, meanMs: 34.4, p95Ms: 70, maxMs: 70, longFrames: 1}
 * @since 2.1.0
 */
export function frameStats(gaps) {
  const usable = Array.isArray(gaps) ? gaps.filter((gap) => Number.isFinite(gap)) : [];
  if (usable.length === 0) {
    return {frames: 0, meanMs: 0, p95Ms: 0, maxMs: 0, longFrames: 0};
  }
  const sorted = usable.slice().sort((first, second) => first - second);
  const total = sorted.reduce((sum, gap) => sum + gap, 0);
  const p95Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return {
    frames: sorted.length,
    meanMs: round1(total / sorted.length),
    p95Ms: round1(sorted[p95Index]),
    maxMs: round1(sorted[sorted.length - 1]),
    longFrames: sorted.filter((gap) => gap > LONG_FRAME_MS).length
  };
}

/**
 * @description Records the gaps between animation frames for a while from now, with the
 *   timestamps requestAnimationFrame hands each frame. Resolves at once, with zeros, where there
 *   are no animation frames (server rendering).
 * @param {number} [ms] - How long to record (default 3000).
 * @param {Object} [scope] - The global object (globalThis in the browser).
 * @returns {Promise<{frames: number, meanMs: number, p95Ms: number, maxMs: number,
 *   longFrames: number}>} The summary from frameStats.
 * @example
 *   measureFrames(2000).then((stats) => stats.p95Ms);
 * @since 2.1.0
 */
export function measureFrames(ms = DEFAULT_PERF_MS, scope = globalThis) {
  return new Promise((resolve) => {
    const nextFrame = scope && typeof scope.requestAnimationFrame === 'function'
      ? scope.requestAnimationFrame.bind(scope)
      : null;
    if (!nextFrame) {
      resolve(frameStats([]));
      return;
    }
    const duration = Number.isFinite(ms) && ms > 0 ? ms : DEFAULT_PERF_MS;
    const gaps = [];
    let firstAt = null;
    let lastAt = null;
    const step = (now) => {
      if (firstAt === null) {
        firstAt = now;
      } else {
        gaps.push(now - lastAt);
      }
      lastAt = now;
      if (now - firstAt < duration) {
        nextFrame(step);
      } else {
        resolve(frameStats(gaps));
      }
    };
    nextFrame(step);
  });
}

// The race stages on the page, newest last, so the console drives the one on screen.
const stages = new Set();

/**
 * @description Simulates races in both modes with 8 squirrels each, the Chaos races at a chaos
 *   level (Chaos v2 contract § 1).
 * @param {number} [count] - Races per mode (default 1000).
 * @param {string} [chaosLevel] - 'mild', 'silly' or 'carnage' (default: the plan's, Silly).
 * @returns {{classic: Object, chaos: Object}} The statistics from lib/simulate.js, per mode.
 * @throws {RangeError} If count is not a whole number of at least 1.
 * @example
 *   const stats = runSimulation(200, 'carnage');
 *   stats.classic.winnerLeadsAtQuarterShare;
 * @since 1.0.0
 */
export function runSimulation(count = DEFAULT_RACES, chaosLevel = null) {
  const results = {};
  MODES.forEach((mode) => {
    const options = {mode, entrantCount: ENTRANTS};
    if (mode === 'chaos' && typeof chaosLevel === 'string') {
      options.chaosLevel = chaosLevel;
    }
    results[mode] = simulate(count, options);
  });
  return results;
}

/**
 * @description Records a connected race stage, for events() and seek().
 * @param {Object} stage - The stage element.
 * @returns {void}
 * @example
 *   registerStage(this);
 * @since 1.0.0
 */
export function registerStage(stage) {
  stages.delete(stage);
  stages.add(stage);
}

/**
 * @description Forgets a race stage that has left the page.
 * @param {Object} stage - The stage element.
 * @returns {void}
 * @example
 *   unregisterStage(this);
 * @since 1.0.0
 */
export function unregisterStage(stage) {
  stages.delete(stage);
}

/**
 * @description The newest race stage on the page.
 * @returns {Object|null} The stage, or null.
 * @since 1.0.0
 */
function currentStage() {
  const list = Array.from(stages);
  return list.length > 0 ? list[list.length - 1] : null;
}

/**
 * @description Builds the console hooks.
 * @returns {Object<string, Function>} simulate, events, parts, seek, perf, filmRate and loops.
 * @since 1.0.0
 */
function buildHooks() {
  return {
    /**
     * @description Records the gaps between animation frames for ms from now, logs the summary
     *   as a table and resolves to it.
     * @param {number} [ms] - How long to record (default 3000).
     * @returns {Promise<{frames: number, meanMs: number, p95Ms: number, maxMs: number,
     *   longFrames: number}>} The summary.
     */
    perf: (ms = DEFAULT_PERF_MS) => measureFrames(Number(ms)).then((stats) => {
      console.table([stats]);
      return stats;
    }),
    /**
     * @description Runs the simulation, logs a table per mode and returns the statistics.
     * @param {number} [count] - Races per mode (default 1000).
     * @param {string} [chaosLevel] - The Chaos races' level: 'mild', 'silly' or 'carnage'.
     * @returns {{classic: Object, chaos: Object}} The statistics.
     */
    simulate: (count = DEFAULT_RACES, chaosLevel = null) => {
      const stats = runSimulation(count, chaosLevel);
      console.info(`Squirrel Scramble: ${count} simulated races per mode, ${ENTRANTS} squirrels`);
      console.table(stats);
      return stats;
    },
    /**
     * @description Lists the events of the race on screen, and logs them as a table.
     * @returns {Object[]} The events, in time order.
     */
    events: () => {
      const stage = currentStage();
      const list = stage ? stage.debugEvents() : [];
      console.table(list);
      return list;
    },
    /**
     * @description Lists the timed parts of the Chaos visitors and decorations on screen, with
     *   the transform and opacity last written and their boxes, and logs them as a table.
     * @returns {Object[]} The parts.
     */
    parts: () => {
      const stage = currentStage();
      const list = stage ? stage.debugParts() : [];
      console.table(list);
      return list;
    },
    /**
     * @description Jumps the race on screen to a race time.
     * @param {number} raceMs - Milliseconds since "Go!" (negative for the count-in).
     * @returns {boolean} True when a stage was there to seek.
     */
    seek: (raceMs) => {
      const stage = currentStage();
      if (!stage) {
        return false;
      }
      stage.debugSeek(Number(raceMs));
      return true;
    },
    /**
     * @description Switches the film-rate driver of the race on screen on or off, for A/B
     *   measurement (Chaos v2 contract § 10.3).
     * @param {boolean} [on] - True for on, false for off; leave it out to toggle.
     * @returns {boolean|null} The driver's new state, or null when no stage is on the page.
     */
    filmRate: (on) => {
      const stage = currentStage();
      if (!stage || typeof stage.debugFilmRate !== 'function') {
        return null;
      }
      return stage.debugFilmRate(on);
    },
    /**
     * @description Counts the looping animations of the race on screen: driven by the film-rate
     *   driver, and running on the platform's own clock. Logs them as a table.
     * @returns {{driven: number, native: number}} The counts (zeros with no stage).
     */
    loops: () => {
      const stage = currentStage();
      const stats = stage && typeof stage.debugLoops === 'function'
        ? stage.debugLoops()
        : {driven: 0, native: 0};
      console.table([stats]);
      return stats;
    }
  };
}

/**
 * @description Installs SquirrelScramble.debug.simulate, .events, .parts, .seek, .perf, .filmRate
 *   and .loops on the window, keeping anything else already on SquirrelScramble. Idempotent: a
 *   hook that is already there is left alone, so a second stage or a re-mount changes nothing.
 * @param {Object} [scope] - The global object (globalThis in the browser).
 * @returns {boolean} True when it installed at least one hook, false when they were all there or
 *   there is no browser window.
 * @example
 *   installDebugHook();
 *   // then, in the console: SquirrelScramble.debug.simulate(1000)
 * @since 1.0.0
 */
export function installDebugHook(scope = globalThis) {
  if (!scope || !scope.window) {
    return false;
  }
  const current = scope.SquirrelScramble;
  const existing = current && typeof current === 'object' ? current : {};
  const debug = existing.debug && typeof existing.debug === 'object' ? existing.debug : {};
  const missing = Object.entries(buildHooks())
    .filter(([name]) => typeof debug[name] !== 'function');
  if (missing.length === 0) {
    return false;
  }
  scope.SquirrelScramble = {...existing, debug: {...debug, ...Object.fromEntries(missing)}};
  return true;
}
