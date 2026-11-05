/**
 * The audio engine's one window onto the browser (Chaos v2 contract § 9): the AudioContext
 * constructor, localStorage, the document (for visibilitychange), timers and randomness.
 *
 * Everything is looked up lazily through globalThis, inside functions, so importing this module
 * during server rendering or under Node touches nothing. The Node tests hand createRaceAudio()
 * their own environment with the same shape: that is the seam that lets them stub AudioContext.
 */

/**
 * @typedef {Object} AudioEnvironment
 * @property {function(): (BaseAudioContext|null)} createContext - Makes an AudioContext, or null
 *   when the browser has none. May throw; the engine catches.
 * @property {function(): (Storage|null)} getStorage - localStorage, or null.
 * @property {function(): (Document|null)} getDocument - The document, or null.
 * @property {function(Function, number): *} setTimer - Like setTimeout.
 * @property {function(*): void} clearTimer - Like clearTimeout.
 * @property {function(): number} random - A number in [0, 1), for small variations in sounds.
 */

/**
 * @description The real browser environment. Nothing is touched until a method is called.
 * @returns {AudioEnvironment} The environment.
 * @example
 *   const engine = createRaceAudio(browserAudioEnvironment());
 * @since 1.0.0
 */
export function browserAudioEnvironment() {
  return {
    createContext() {
      const Constructor = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (typeof Constructor !== 'function') {
        return null;
      }
      try {
        return new Constructor({latencyHint: 'interactive'});
      } catch {
        return new Constructor();
      }
    },
    getStorage() {
      try {
        return globalThis.localStorage || null;
      } catch {
        return null;
      }
    },
    getDocument() {
      return globalThis.document || null;
    },
    setTimer(callback, delayMs) {
      return globalThis.setTimeout(callback, delayMs);
    },
    clearTimer(handle) {
      globalThis.clearTimeout(handle);
    },
    random() {
      return Math.random();
    }
  };
}
