/**
 * The sound on/off preference (Chaos v2 contract § 9 "Control"), kept in localStorage. Default:
 * on. Every access is inside try/catch: storage can be missing (server rendering), blocked
 * (privacy settings, sandboxed frames throw on access) or full, and none of that may break the
 * page. A failed read means "sound on"; a failed write just means the choice is not remembered.
 *
 * Pure ES module: the storage object is passed in.
 */

/** The localStorage key, prefixed with the app scope so it cannot clash. */
export const SOUND_PREFERENCE_KEY = 'x_crli_squirrel.sound';

/** The stored values. */
const SOUND_ON = 'on';
const SOUND_OFF = 'off';

/**
 * @description Reads whether the marshal turned the sound off. Anything other than a stored "off"
 *   (nothing stored, another value, no storage, a throwing storage) reads as sound on.
 * @param {Storage|null} storage - localStorage, or null.
 * @returns {boolean} True when muted.
 * @example
 *   readMutedPreference(globalThis.localStorage);
 *   // false
 * @since 1.0.0
 */
export function readMutedPreference(storage) {
  try {
    if (!storage || typeof storage.getItem !== 'function') {
      return false;
    }
    return storage.getItem(SOUND_PREFERENCE_KEY) === SOUND_OFF;
  } catch {
    return false;
  }
}

/**
 * @description Remembers the sound choice.
 * @param {Storage|null} storage - localStorage, or null.
 * @param {boolean} muted - True for sound off.
 * @returns {boolean} True when it was stored.
 * @example
 *   writeMutedPreference(globalThis.localStorage, true);
 * @since 1.0.0
 */
export function writeMutedPreference(storage, muted) {
  try {
    if (!storage || typeof storage.setItem !== 'function') {
      return false;
    }
    storage.setItem(SOUND_PREFERENCE_KEY, muted ? SOUND_OFF : SOUND_ON);
    return true;
  } catch {
    return false;
  }
}
