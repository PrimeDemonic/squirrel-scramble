/**
 * The translated texts of the sound control (Chaos v2 contract § 9 "Control"): the toggle's label,
 * its on and off states, and the shortcut hint.
 *
 * Why a catalogue: the i18n lint rule (getmessage-no-variable-arg) and the build's string
 * extractor only accept a literal i18n.getMessage() argument, so each text is written out here
 * once, like components/labels.js and components/phrases.js.
 *
 * The module has no imports on purpose: the i18n service is passed in, so the Node tests can run
 * it with a stub and the build still sees literal i18n.getMessage() calls.
 */

/**
 * @description Builds the sound control's texts in the current language. Cheap: call it at render
 *   time so a translation loaded after start-up is picked up.
 * @param {{getMessage: function(string, ...*): string}} i18n - The AIUX i18n service, or a stub.
 * @returns {{sound: string, soundOn: string, soundOff: string, shortcut: string}} The texts.
 * @example
 *   buildSoundLabels(i18n).sound;
 *   // 'Sound'
 * @since 1.0.0
 */
export function buildSoundLabels(i18n) {
  return {
    sound: i18n.getMessage('Sound'),
    soundOn: i18n.getMessage('Sound is on'),
    soundOff: i18n.getMessage('Sound is off'),
    shortcut: i18n.getMessage('Press M to turn the sound on or off.')
  };
}
