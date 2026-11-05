/**
 * Seeded pseudo-random numbers for Squirrel Scramble (SPEC.md § 9 and § 11.1).
 *
 * Every race animation and every cosmetic roll draws from mulberry32, a small 32-bit generator
 * that gives the same sequence for the same seed in every browser and in Node. That is what makes
 * a replay look exactly like the original race. The one source of fresh entropy in the app is
 * randomSeed(), which asks the platform's cryptographic generator for a new seed; nothing else
 * in lib/ may use unseeded randomness.
 *
 * Pure ES module: no DOM, no Lit and no platform imports, so it runs under plain Node.
 */

// The additive constant from the mulberry32 reference implementation.
const MULBERRY_INCREMENT = 0x6d2b79f5;

// 2^32: divides an unsigned 32-bit integer down to a float in [0, 1).
const UINT32_RANGE = 4294967296;

/**
 * @description Turns any seed-like value into an unsigned 32-bit integer, so a seed from the
 *   server (0 to 2,147,483,646), a test or the browser all start the generator the same way.
 * @param {*} seed - The seed. Non-numbers and NaN become 0; fractions are truncated.
 * @returns {number} An integer from 0 to 2^32 - 1.
 * @example
 *   normaliseSeed('42');
 *   // 42
 * @since 1.0.0
 */
export function normaliseSeed(seed) {
  const numeric = Number(seed);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  // Bitwise on purpose: >>> 0 is the exact unsigned 32-bit wrap the generator works in.
  return Math.trunc(numeric) >>> 0;
}

/**
 * @description Throws unless both bounds are integers with min no greater than max.
 * @param {number} min - Lower bound.
 * @param {number} max - Upper bound.
 * @returns {void}
 * @throws {RangeError} If the bounds are not integers or are the wrong way round.
 * @since 1.0.0
 */
function assertIntegerRange(min, max) {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new RangeError(`intBetween needs integers with min <= max, got ${min} and ${max}.`);
  }
}

/**
 * @description Creates a mulberry32 generator. The same seed always gives the same sequence,
 *   which is what lets a stored race replay identically. Each call to a method advances the
 *   generator, so callers must consume it in a fixed order.
 * @param {number} seed - Any number; it is reduced to an unsigned 32-bit integer.
 * @returns {{nextUint32: function(): number, nextFloat: function(): number,
 *   intBetween: function(number, number): number, floatBetween: function(number, number): number,
 *   chance: function(number): boolean, pick: function(Array): *, shuffle: function(Array): Array,
 *   weightedIndex: function(number[]): number}} The generator's methods.
 * @example
 *   const rng = createRng(123456789);
 *   const lane = rng.intBetween(1, 8);
 * @since 1.0.0
 */
export function createRng(seed) {
  let state = normaliseSeed(seed);

  /**
   * @description Advances the generator one step (the mulberry32 mix).
   * @returns {number} An unsigned 32-bit integer.
   */
  function nextUint32() {
    // Bitwise on purpose: mulberry32 is defined in 32-bit integer arithmetic.
    state = (state + MULBERRY_INCREMENT) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return (mixed ^ (mixed >>> 14)) >>> 0;
  }

  /**
   * @description Returns a float in [0, 1).
   * @returns {number} The float.
   */
  function nextFloat() {
    return nextUint32() / UINT32_RANGE;
  }

  /**
   * @description Returns an integer from min to max, both included.
   * @param {number} min - Lower bound (integer).
   * @param {number} max - Upper bound (integer, at least min).
   * @returns {number} The integer.
   * @throws {RangeError} If the bounds are not integers or max is below min.
   */
  function intBetween(min, max) {
    assertIntegerRange(min, max);
    return min + Math.floor(nextFloat() * (max - min + 1));
  }

  /**
   * @description Returns a float from min (included) to max (excluded).
   * @param {number} min - Lower bound.
   * @param {number} max - Upper bound.
   * @returns {number} The float.
   */
  function floatBetween(min, max) {
    return min + nextFloat() * (max - min);
  }

  /**
   * @description Returns true with the given probability. chance(0) is never true and
   *   chance(1) is always true.
   * @param {number} probability - From 0 to 1.
   * @returns {boolean} Whether the roll succeeded.
   */
  function chance(probability) {
    return nextFloat() < probability;
  }

  /**
   * @description Returns one element of a non-empty array, uniformly.
   * @param {Array} items - The array to pick from.
   * @returns {*} The chosen element.
   * @throws {RangeError} If the array is empty or not an array.
   */
  function pick(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new RangeError('pick needs a non-empty array.');
    }
    return items[intBetween(0, items.length - 1)];
  }

  /**
   * @description Returns a shuffled copy of an array (Fisher-Yates). The input is untouched.
   * @param {Array} items - The array to shuffle.
   * @returns {Array} A new, shuffled array.
   */
  function shuffle(items) {
    const copy = Array.from(items);
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapWith = intBetween(0, index);
      const held = copy[index];
      copy[index] = copy[swapWith];
      copy[swapWith] = held;
    }
    return copy;
  }

  /**
   * @description Returns an index chosen in proportion to its weight.
   * @param {number[]} weights - Non-negative weights; at least one must be positive.
   * @returns {number} The chosen index.
   * @throws {RangeError} If no weight is positive or a weight is negative.
   */
  function weightedIndex(weights) {
    const valid = Array.isArray(weights) && weights.every((weight) => weight >= 0);
    const total = valid ? weights.reduce((sum, weight) => sum + weight, 0) : 0;
    if (!(total > 0)) {
      throw new RangeError('weightedIndex needs non-negative weights with a positive total.');
    }
    let remaining = nextFloat() * total;
    let lastPositive = 0;
    for (let index = 0; index < weights.length; index += 1) {
      if (weights[index] > 0) {
        lastPositive = index;
      }
      remaining -= weights[index];
      if (remaining < 0) {
        return index;
      }
    }
    // Only reached through float rounding at the very top of the range.
    return lastPositive;
  }

  return Object.freeze({
    nextUint32,
    nextFloat,
    intBetween,
    floatBetween,
    chance,
    pick,
    shuffle,
    weightedIndex
  });
}

/**
 * @description Makes a fresh 31-bit seed from the platform's cryptographic generator, for
 *   cosmetic rolls such as outfits (SPEC.md § 9). Race animations never use it: they are seeded
 *   from the stored race. Call it in the browser (or Node), never inside a Lit render().
 * @returns {number} An integer from 0 to 2,147,483,647.
 * @throws {Error} If the runtime offers no crypto.getRandomValues.
 * @example
 *   const outfitRng = createRng(randomSeed());
 * @since 1.0.0
 */
export function randomSeed() {
  const cryptoSource = globalThis.crypto;
  if (!cryptoSource || typeof cryptoSource.getRandomValues !== 'function') {
    throw new Error('randomSeed needs crypto.getRandomValues, which this runtime does not offer.');
  }
  const buffer = new Uint32Array(1);
  cryptoSource.getRandomValues(buffer);
  // Drop one bit so the seed fits the same 31-bit range as the server's seeds.
  return buffer[0] >>> 1;
}
