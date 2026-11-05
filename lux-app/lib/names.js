/**
 * Name parsing for the setup view (SPEC.md § 8) with the same cleaning as the server's draw
 * (SPEC.md § 7, step 2): trim, collapse internal whitespace, strip control characters, drop
 * blanks. A cleaned name is already a fixed point of that cleaning, so what the marshal sees is
 * exactly what the server stores, and duplicates are judged the same way on both sides.
 *
 * Names stay plain strings here. They reach the page through Lit text bindings only, so a name
 * such as <img src=x onerror=alert(1)> is shown as text (SPEC.md § 13).
 *
 * Pure ES module: no DOM, no Lit and no platform imports.
 */
import {themeConfig} from './theme-config.js';

// Newlines, commas and semicolons all separate names.
const SEPARATORS = /[\r\n,;]+/;
// Any run of whitespace (tabs, non-breaking spaces and the like) becomes one space.
const WHITESPACE_RUN = /\s+/g;
// Stripping a control character can leave two spaces side by side.
const SPACE_RUN = / {2,}/g;
const ELLIPSIS = '…';

/**
 * @description Says whether a code point is a C0 or C1 control character. Done with numbers,
 *   not a regular expression, because control characters in a pattern trip no-control-regex.
 * @param {number} codePoint - The code point.
 * @returns {boolean} True for U+0000 to U+001F and U+007F to U+009F.
 * @since 1.0.0
 */
function isControlCode(codePoint) {
  return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
}

/**
 * @description Cleans one name the way the server does: whitespace runs become one space,
 *   control characters go, and the ends are trimmed.
 * @param {*} raw - The raw text; anything but a string cleans to ''.
 * @returns {string} The cleaned name, possibly ''.
 * @example
 *   cleanName('  Jo \t Bloggs ');
 *   // 'Jo Bloggs'
 * @since 1.0.0
 */
export function cleanName(raw) {
  const text = typeof raw === 'string' ? raw : '';
  const spaced = text.replace(WHITESPACE_RUN, ' ');
  const printable = Array.from(spaced)
    .filter((character) => !isControlCode(character.codePointAt(0)))
    .join('');
  return printable.replace(SPACE_RUN, ' ').trim();
}

/**
 * @description Lists each name that appears more than once, case-insensitively, using the
 *   spelling of its first appearance, once per duplicate group.
 * @param {string[]} names - Cleaned names.
 * @returns {string[]} The duplicated names.
 * @since 1.0.0
 */
function findDuplicates(names) {
  const firstSpelling = new Map();
  const reported = new Set();
  const duplicates = [];
  names.forEach((name) => {
    const key = name.toLowerCase();
    if (!firstSpelling.has(key)) {
      firstSpelling.set(key, name);
    } else if (!reported.has(key)) {
      reported.add(key);
      duplicates.push(firstSpelling.get(key));
    }
  });
  return duplicates;
}

/**
 * @description Parses the names box: splits on newlines, commas and semicolons, cleans each name
 *   and drops blanks. Reports what the server would reject, so Start can stay disabled until
 *   the marshal fixes it.
 * @param {string} text - The names box contents.
 * @param {number} [maxEntrants] - The cap; defaults to the theme's (the server property wins).
 * @returns {{names: string[], problems: {duplicates: string[], tooLong: string[],
 *   overCap: boolean, noNames: boolean}, valid: boolean}} The cleaned names and their problems.
 * @example
 *   parseNames('Alex, Sam\nJo; Priya').names;
 *   // ['Alex', 'Sam', 'Jo', 'Priya']
 * @since 1.0.0
 */
export function parseNames(text, maxEntrants = themeConfig.race.maxEntrants) {
  const source = typeof text === 'string' ? text : '';
  const cap = Number.isInteger(maxEntrants) && maxEntrants > 0
    ? maxEntrants
    : themeConfig.race.maxEntrants;
  const names = source
    .split(SEPARATORS)
    .map((part) => cleanName(part))
    .filter((name) => name.length > 0);
  const longest = themeConfig.race.maxNameLength;
  const tooLong = Array.from(new Set(names.filter((name) => name.length > longest)));
  const duplicates = findDuplicates(names);
  const overCap = names.length > cap;
  const noNames = names.length === 0;
  return {
    names,
    problems: {duplicates, tooLong, overCap, noNames},
    valid: !noNames && duplicates.length === 0 && tooLong.length === 0 && !overCap
  };
}

/**
 * @description Shortens a name for a bib or trunk label. The result is at most maxChars
 *   characters including the ellipsis, and never splits an emoji or other surrogate pair.
 * @param {string} name - The name.
 * @param {number} [maxChars] - The limit; defaults to the theme's (14).
 * @returns {string} The name, or its start plus an ellipsis.
 * @example
 *   truncateLabel('Bartholomew Fitzwilliam');
 *   // 'Bartholomew F…'
 * @since 1.0.0
 */
export function truncateLabel(name, maxChars = themeConfig.race.labelMaxChars) {
  const characters = Array.from(typeof name === 'string' ? name : '');
  if (characters.length <= maxChars) {
    return characters.join('');
  }
  const kept = characters.slice(0, Math.max(0, maxChars - 1)).join('').trimEnd();
  return `${kept}${ELLIPSIS}`;
}
