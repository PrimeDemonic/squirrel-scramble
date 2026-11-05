/**
 * Climb arithmetic shared by both passes of the race build (SPEC.md § 11, Chaos v2 contract § 3).
 *
 * A squirrel climbs in "climb units", one tick at a time. A tick with no event climbs its base
 * climb times its boost (1 unless a late event has asked for compensation); a tick with an event
 * climbs whatever the event's effect says. The running total is floored at 0. Heights are the
 * running total over a fixed normaliser, rounded, and clamped to [0, 98] before the final tick;
 * the final tick is exactly 100.
 *
 * Pure ES module: no DOM, no Lit and no platform imports.
 */
import {effectKinds} from './race-builder.js';

const FULL_HEIGHT = 100;

// How each effect kind turns a tick's base climb into its actual climb.
const climbRules = {
  [effectKinds.stall]: () => 0,
  [effectKinds.scale]: (value, baseClimb) => baseClimb * value,
  [effectKinds.set]: (value) => value,
  [effectKinds.fallFraction]: (value, baseClimb, runningTotal) => -value * runningTotal
};

/**
 * @description One tick's climb.
 * @param {{kind: string, value: number}|null} effect - The tick's effect, if any.
 * @param {number} baseClimb - The tick's base climb.
 * @param {number} boost - The tick's compensation boost (used only when there is no effect).
 * @param {number} runningTotal - The running total before this tick.
 * @returns {number} The climb (may be negative).
 * @example
 *   climbForTick(null, 1.2, 1, 30);
 *   // 1.2
 * @since 2.0.0
 */
export function climbForTick(effect, baseClimb, boost, runningTotal) {
  if (!effect) {
    return baseClimb * boost;
  }
  return climbRules[effect.kind](effect.value, baseClimb, runningTotal);
}

/**
 * @description Running totals for one squirrel, tick 0 (always 0) to tickCount.
 * @param {number[]} baseClimbs - Base climb per tick (index 1 to tickCount).
 * @param {Array<({kind: string, value: number}|null)>} effects - Effect per tick.
 * @param {number[]} boosts - Boost per tick.
 * @returns {number[]} The running totals, floored at 0.
 * @example
 *   const totals = totalsFor(baseClimbs, effects, boosts);
 * @since 2.0.0
 */
export function totalsFor(baseClimbs, effects, boosts) {
  const totals = [0];
  let running = 0;
  for (let tick = 1; tick < baseClimbs.length; tick += 1) {
    const climb = climbForTick(effects[tick], baseClimbs[tick], boosts[tick], running);
    running = Math.max(0, running + climb);
    totals.push(running);
  }
  return totals;
}

/**
 * @description A keyframe height before the final tick: the total over the normaliser, rounded,
 *   then clamped to [0, 98] so nobody touches the chestnut early (SPEC.md § 11.7, § 11.8). Both
 *   passes and the finished plan use this one function, so a height measured while building is
 *   exactly the height the plan shows.
 * @param {number} total - The running total at the tick.
 * @param {number} normaliser - The squirrel's normaliser (its pass-one final total, above 0).
 * @param {{heightDecimals: number, preFinishCeiling: number}} settings - Choreography settings.
 * @returns {number} The height.
 * @example
 *   preFinishHeight(40, 80, settings);
 *   // 50
 * @since 2.0.0
 */
export function preFinishHeight(total, normaliser, settings) {
  const factor = 10 ** settings.heightDecimals;
  const rounded = Math.round(((FULL_HEIGHT * total) / normaliser) * factor) / factor;
  return Math.min(settings.preFinishCeiling, Math.max(0, rounded));
}

/**
 * @description A squirrel's keyframes: times on the tick grid (the last exactly at finishMs) and
 *   heights from 0 to 100.
 * @param {number[]} totals - Running totals, tick 0 to tickCount.
 * @param {number} normaliser - The normaliser (above 0).
 * @param {number} finishMs - The stored finish time.
 * @param {Object} settings - Choreography settings (tickMs, heightDecimals, preFinishCeiling).
 * @returns {{times: number[], heights: number[]}} tickCount + 1 of each.
 * @example
 *   const {times, heights} = keyframesFrom(totals, totals[totals.length - 1], 20000, settings);
 * @since 2.0.0
 */
export function keyframesFrom(totals, normaliser, finishMs, settings) {
  const tickCount = totals.length - 1;
  // The final tick never carries an event, so the normaliser is always above 0. The guard only
  // stops a future edit from dividing by zero.
  const safeNormaliser = normaliser > 0 ? normaliser : Number.MAX_VALUE;
  const times = [];
  const heights = [];
  for (let tick = 0; tick <= tickCount; tick += 1) {
    times.push(Math.min(tick * settings.tickMs, finishMs));
    heights.push(
      tick === tickCount ? FULL_HEIGHT : preFinishHeight(totals[tick], safeNormaliser, settings)
    );
  }
  return {times, heights};
}
