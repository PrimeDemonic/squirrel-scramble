/**
 * The translated label catalogue for data-driven text: outfit items, outfit slots, rarities,
 * skies, race modes, race lengths and Chaos levels (SPEC.md § 8, § 9, § 12; Chaos v2 contract
 * § 1, docs/specs/squirrel-scramble-chaos-v2.md).
 *
 * The ids come from lib/theme-config.js, but the i18n lint rule (getmessage-no-variable-arg) and
 * the build's string extractor only accept a literal i18n.getMessage() argument, so every label
 * is written out here once, keyed by its catalogue id. tests/labels.test.js checks that this
 * catalogue covers the theme's, so a new hat without a label fails the unit tests.
 *
 * The module has no imports on purpose: the i18n service is passed in, so the Node tests can run
 * it with a stub and the build still sees literal i18n.getMessage() calls.
 */

/** The Chaos levels, mildest first (Chaos v2 contract § 1). The server accepts exactly these. */
export const CHAOS_LEVEL_IDS = Object.freeze(['mild', 'silly', 'carnage']);

/** The level a Chaos race gets when none is chosen (Chaos v2 contract § 1 and § 2). */
export const DEFAULT_CHAOS_LEVEL = 'silly';

/**
 * @description Returns a known Chaos level id, or the default for anything else (a stored race
 *   from before Chaos v2 has none).
 * @param {*} level - A level id, or anything.
 * @returns {string} 'mild', 'silly' or 'carnage'.
 * @example
 *   normaliseChaosLevel(null);
 *   // 'silly'
 * @since 1.0.0
 */
export function normaliseChaosLevel(level) {
  return CHAOS_LEVEL_IDS.includes(level) ? level : DEFAULT_CHAOS_LEVEL;
}

/**
 * @description Builds the label catalogue in the current language. Call it at render time (it is
 *   cheap) so a translation loaded after start-up is picked up.
 * @param {{getMessage: function(string, ...*): string}} i18n - The AIUX i18n service, or a stub
 *   with the same getMessage signature.
 * @returns {{outfits: Object<string, Object<string, string>>, slots: Object<string, string>,
 *   rarities: Object<string, string>, skies: Object<string, string>,
 *   modes: Object<string, string>, lengths: Object<string, Object<string, string>>,
 *   chaosLevels: Object<string, string>, chaosLevelBlurbs: Object<string, string>}} The labels.
 * @example
 *   const labels = buildLabels(i18n);
 *   labels.outfits.hat.crown;
 *   // 'Crown'
 * @since 1.0.0
 */
export function buildLabels(i18n) {
  return {
    outfits: {
      hat: {
        none: i18n.getMessage('No hat'),
        top_hat: i18n.getMessage('Top hat'),
        propeller: i18n.getMessage('Propeller cap'),
        viking: i18n.getMessage('Viking helmet'),
        cowboy: i18n.getMessage('Cowboy hat'),
        party: i18n.getMessage('Party hat'),
        chef: i18n.getMessage('Chef’s hat'),
        beanie: i18n.getMessage('Beanie'),
        pirate: i18n.getMessage('Pirate hat'),
        wizard: i18n.getMessage('Wizard hat'),
        traffic_cone: i18n.getMessage('Traffic cone'),
        halo: i18n.getMessage('Halo'),
        crown: i18n.getMessage('Crown')
      },
      cape: {
        none: i18n.getMessage('No cape'),
        red: i18n.getMessage('Red cape'),
        blue: i18n.getMessage('Blue cape'),
        green: i18n.getMessage('Green cape'),
        purple: i18n.getMessage('Purple cape'),
        tartan: i18n.getMessage('Tartan cape'),
        superhero: i18n.getMessage('Superhero cape'),
        royal: i18n.getMessage('Royal ermine cape')
      },
      accessory: {
        none: i18n.getMessage('No accessory'),
        sunglasses: i18n.getMessage('Sunglasses'),
        bow_tie: i18n.getMessage('Bow tie'),
        scarf: i18n.getMessage('Scarf'),
        moustache: i18n.getMessage('Moustache'),
        headphones: i18n.getMessage('Headphones'),
        flower: i18n.getMessage('Flower'),
        monocle: i18n.getMessage('Monocle'),
        eyepatch: i18n.getMessage('Eyepatch'),
        gold_chain: i18n.getMessage('Gold chain')
      },
      fur: {
        red: i18n.getMessage('Red fur'),
        grey: i18n.getMessage('Grey fur'),
        black: i18n.getMessage('Black fur'),
        cinnamon: i18n.getMessage('Cinnamon fur'),
        albino: i18n.getMessage('Albino fur'),
        golden: i18n.getMessage('Golden fur'),
        rainbow: i18n.getMessage('Rainbow fur')
      }
    },
    slots: {
      hat: i18n.getMessage('Hat'),
      cape: i18n.getMessage('Cape'),
      accessory: i18n.getMessage('Accessory'),
      fur: i18n.getMessage('Fur')
    },
    rarities: {
      common: i18n.getMessage('Common'),
      rare: i18n.getMessage('Rare'),
      legendary: i18n.getMessage('Legendary')
    },
    skies: {
      day: i18n.getMessage('Day'),
      golden_hour: i18n.getMessage('Golden hour'),
      night: i18n.getMessage('Night'),
      drizzle: i18n.getMessage('Drizzle'),
      storm: i18n.getMessage('Storm')
    },
    modes: {
      classic: i18n.getMessage('Classic'),
      chaos: i18n.getMessage('Chaos')
    },
    lengths: {
      classic: {
        10: i18n.getMessage('Quick'),
        20: i18n.getMessage('Standard'),
        40: i18n.getMessage('Epic')
      },
      chaos: {
        45: i18n.getMessage('Short'),
        60: i18n.getMessage('Proper'),
        90: i18n.getMessage('Marathon')
      }
    },
    chaosLevels: {
      mild: i18n.getMessage('Mild'),
      silly: i18n.getMessage('Silly'),
      carnage: i18n.getMessage('Absolute Carnage')
    },
    chaosLevelBlurbs: {
      mild: i18n.getMessage('A few surprises'),
      silly: i18n.getMessage('Things get out of hand'),
      carnage: i18n.getMessage('Everything, all at once')
    }
  };
}

/**
 * @description Reads one label from a catalogue group, falling back when the id is unknown (for
 *   example an outfit stored by an older theme), so the page never shows "undefined".
 * @param {Object<string, string>|undefined} group - One group of the catalogue.
 * @param {string|number} id - The id to look up.
 * @param {string} fallback - What to show when the id has no label.
 * @returns {string} The label or the fallback.
 * @example
 *   labelFor(labels.skies, 'storm', 'storm');
 *   // 'Storm'
 * @since 1.0.0
 */
export function labelFor(group, id, fallback) {
  const known = group && Object.prototype.hasOwnProperty.call(group, String(id));
  return known ? group[String(id)] : fallback;
}

/**
 * @description The label of one outfit item, or its id when the catalogue does not know it.
 * @param {Object} labels - The catalogue from buildLabels().
 * @param {string} slot - The outfit slot (hat, cape, accessory or fur).
 * @param {string} id - The item id.
 * @returns {string} The label.
 * @example
 *   outfitItemLabel(labels, 'hat', 'viking');
 *   // 'Viking helmet'
 * @since 1.0.0
 */
export function outfitItemLabel(labels, slot, id) {
  const slotLabels = labels && labels.outfits ? labels.outfits[slot] : undefined;
  return labelFor(slotLabels, id, typeof id === 'string' ? id : '');
}

/**
 * @description The name of one race length (Quick, Proper and so on).
 * @param {Object} labels - The catalogue from buildLabels().
 * @param {string} mode - 'classic' or 'chaos'.
 * @param {number} seconds - The race length in seconds.
 * @returns {string} The label, or the seconds as text when the length is unknown.
 * @example
 *   lengthLabel(labels, 'chaos', 90);
 *   // 'Absolute Carnage'
 * @since 1.0.0
 */
export function lengthLabel(labels, mode, seconds) {
  const modeLabels = labels && labels.lengths ? labels.lengths[mode] : undefined;
  return labelFor(modeLabels, seconds, String(seconds));
}
