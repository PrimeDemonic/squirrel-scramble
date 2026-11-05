/**
 * Sound-effect throttling (Chaos v2 contract § 9 "Mixing"): at most three effects at once, and a
 * minimum gap between two effects of the same type, so Absolute Carnage stays fun rather than
 * noise. An effect asked for while three are sounding, or too soon after its own last one, is
 * dropped (never queued: a late sound would land on the wrong picture).
 *
 * Pure ES module: times are passed in (milliseconds on the AudioContext clock), so the Node tests
 * drive it directly.
 */

/** The most effects that may sound at once. */
export const MAX_CONCURRENT_EFFECTS = 3;

/**
 * @description Makes a throttle.
 * @param {{maxConcurrent?: number, gapFor?: function(string): number}} [options] - The limit
 *   (3 by default) and the minimum gap for a key in milliseconds (none by default).
 * @returns {{tryAcquire: function(string, number, number): boolean,
 *   hold: function(number, number): void, activeCount: function(number): number,
 *   reset: function(): void}} The throttle.
 * @example
 *   const throttle = createEffectThrottle({gapFor: () => 250});
 *   throttle.tryAcquire('slip', 1000, 500);
 *   // true
 * @since 1.0.0
 */
export function createEffectThrottle(options) {
  const settings = options || {};
  const maxConcurrent = Number.isInteger(settings.maxConcurrent) && settings.maxConcurrent > 0
    ? settings.maxConcurrent
    : MAX_CONCURRENT_EFFECTS;
  const gapFor = typeof settings.gapFor === 'function' ? settings.gapFor : () => 0;
  let endTimes = [];
  const lastStartByKey = new Map();

  /**
   * @description Forgets effects that have finished by a moment.
   * @param {number} nowMs - The moment.
   * @returns {void}
   * @since 1.0.0
   */
  function prune(nowMs) {
    endTimes = endTimes.filter((endMs) => endMs > nowMs);
  }

  /**
   * @description A duration as a non-negative number of milliseconds.
   * @param {*} durationMs - The duration.
   * @returns {number} Milliseconds, 0 when unusable.
   * @since 1.0.0
   */
  function lengthOf(durationMs) {
    const number = Number(durationMs);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  return Object.freeze({
    /**
     * @description Claims a slot for an effect when one is free and the key's gap has passed.
     * @param {string} key - The effect's key (its event type, or 'type:impact').
     * @param {number} nowMs - Now.
     * @param {number} durationMs - How long it will sound.
     * @returns {boolean} True when it may play (the slot is then taken).
     * @since 1.0.0
     */
    tryAcquire(key, nowMs, durationMs) {
      prune(nowMs);
      const lastMs = lastStartByKey.get(key);
      if (lastMs !== undefined && nowMs >= lastMs && nowMs - lastMs < gapFor(key)) {
        return false;
      }
      if (endTimes.length >= maxConcurrent) {
        return false;
      }
      endTimes.push(nowMs + lengthOf(durationMs));
      lastStartByKey.set(key, nowMs);
      return true;
    },

    /**
     * @description Counts a sound that must play anyway (a cue) towards the limit.
     * @param {number} nowMs - Now.
     * @param {number} durationMs - How long it will sound.
     * @returns {void}
     * @since 1.0.0
     */
    hold(nowMs, durationMs) {
      prune(nowMs);
      endTimes.push(nowMs + lengthOf(durationMs));
    },

    /**
     * @description How many effects are sounding at a moment.
     * @param {number} nowMs - The moment.
     * @returns {number} The count.
     * @since 1.0.0
     */
    activeCount(nowMs) {
      prune(nowMs);
      return endTimes.length;
    },

    /**
     * @description Forgets everything (a new race).
     * @returns {void}
     * @since 1.0.0
     */
    reset() {
      endTimes = [];
      lastStartByKey.clear();
    }
  });
}
