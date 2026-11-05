import {html, svg, nothing} from 'lit';
import {styleMap} from 'lit/directives/style-map.js';

/**
 * Squirrel Scramble sprite kit, part 1: the shared drawing helpers and the racing squirrel
 * (SPEC.md § 9 outfits, § 12 art direction; Chaos v2 § 5 poses and effects). All art is
 * original.
 *
 * Every sprite is inline SVG. The parts are Lit `svg` fragments; the <svg> root itself is
 * written in an `html` template, because Lit renders an <svg> element from `html` and only
 * its children from `svg`. Every function here is pure: no DOM access, no randomness and no
 * clock, so a sprite renders the same on the server and in the browser.
 *
 * Colours are literal values in the SVG presentation attributes, never `var()` there: a
 * presentation attribute holding `var()` is not honoured, and the part falls back to black.
 * Theming happens in CSS instead. The squirrel root sets --fur, --fur-dark, --belly and --eye
 * (themeable as --ss-fur-<id>, --ss-fur-<id>-dark, --ss-fur-<id>-belly, --ss-eye-albino), and
 * animations.js maps the fur classes (ss-fur, ss-fur-dark, ss-fur-belly, ss-fur-stroke,
 * ss-fur-dark-stroke, ss-fur-edge, ss-fur-belly-stroke, ss-pupil) onto them. Without that
 * sheet the literal colours still draw the right fur.
 *
 * Movable parts sit in named <g> groups (tail, body, belly, head, ear, eye, cheek, arm-front,
 * arm-back, leg, plus the cape, hat and accessory slots) so animations.js can move them with
 * transforms. Every sprite is decorative (aria-hidden): the caller conveys names as text.
 */

/** The viewBox shared by every square sprite: 100 by 100 units. */
export const SQUARE_VIEW_BOX = '0 0 100 100';

/** The fur used when a fur id is missing or unknown (matches the theme config default). */
export const DEFAULT_FUR = 'red';

/** The squirrel's tail outline, shared with the trench coat in field.js. */
export const SQUIRREL_TAIL_PATH =
  'M42 84C28 88 14 78 15 62C16 48 24 40 22 28C21 18 30 9 40 11C47 12 49 20 44 24C41 18 34 17 32 24C30 32 34 42 33 54C32 66 38 74 46 76Z';

/** The squirrel's head and snout, facing right, shared with the trench coat in field.js. */
export const SQUIRREL_HEAD_PATH =
  'M48 34C48 25 56 21 63 23C69 24 73 28 76 32C79 35 79 40 74 42C69 45 60 46 54 44C50 42 48 38 48 34Z';

/** The squirrel's ear. */
export const SQUIRREL_EAR_PATH = 'M52 26C50 18 52 12 56 9C58 14 60 19 59 25Z';

/** The squirrel's inner ear. */
export const SQUIRREL_INNER_EAR_PATH =
  'M53.6 24C53.2 19 54.4 15.5 56 13.5C57 17 57.6 21 57.2 24Z';

/**
 * @description Rounds a coordinate to two decimals so generated path data stays compact.
 * @param {number} value - A finite number.
 * @returns {number} The value rounded to the nearest 0.01.
 * @throws {never} Never throws.
 * @example
 *   roundCoordinate(12.3456); // 12.35
 * @since 1.0.0
 */
export function roundCoordinate(value) {
  return Math.round(value * 100) / 100;
}

/**
 * @description Formats one SVG path command with its numbers rounded.
 * @param {string} letter - The path command letter, e.g. 'M', 'C' or 'Q'.
 * @param {...number} values - The command's coordinates, in order.
 * @returns {string} The command, e.g. 'M12.5 30'.
 * @throws {never} Never throws.
 * @example
 *   pathCommand('L', 10, 20.004); // 'L10 20'
 * @since 1.0.0
 */
export function pathCommand(letter, ...values) {
  return `${letter}${values.map(roundCoordinate).join(' ')}`;
}

/**
 * @description Builds a themeable CSS value: a custom property with a fallback. For CSS and
 *   inline custom properties only; never put the result in an SVG presentation attribute.
 * @param {string} token - Token name without the --ss- prefix, e.g. 'fur-red'.
 * @param {string} fallback - The colour used when no theme sets the token.
 * @returns {string} A CSS value such as 'var(--ss-fur-red, #C8642F)'.
 * @throws {never} Never throws.
 * @example
 *   paint('fur-red', '#C8642F');
 * @since 1.0.0
 */
export function paint(token, fallback) {
  return `var(--ss-${token}, ${fallback})`;
}

/**
 * @description Joins class names, skipping empty and non-string entries.
 * @param {...*} names - Candidate class names.
 * @returns {string} A space-separated class list.
 * @throws {never} Never throws.
 * @example
 *   classNames('ss-sprite', '', 'ss-flip'); // 'ss-sprite ss-flip'
 * @since 1.0.0
 */
export function classNames(...names) {
  return names.filter(name => typeof name === 'string' && name.trim() !== '').join(' ');
}

/**
 * @description Returns the id when the catalogue has art for it, otherwise the fallback.
 *   Inherited keys such as 'constructor' are never treated as ids.
 * @param {Object} catalogue - An art map keyed by id.
 * @param {*} id - The requested id.
 * @param {string} fallback - The id to use when the request is unknown.
 * @returns {string} A known id.
 * @throws {never} Never throws.
 * @example
 *   pickId({none: 1, crown: 2}, 'sombrero', 'none'); // 'none'
 * @since 1.0.0
 */
export function pickId(catalogue, id, fallback) {
  const known = typeof id === 'string' && Object.prototype.hasOwnProperty.call(catalogue, id);
  return known ? id : fallback;
}

/**
 * @description Joins a list of points into closed polygon path data.
 * @param {Array<Array<number>>} points - [x, y] pairs in drawing order.
 * @returns {string} Path data starting with M and ending with Z.
 * @throws {never} Never throws.
 * @example
 *   polygonPath([[0, 0], [10, 0], [5, 8]]); // 'M0 0L10 0L5 8Z'
 * @since 1.0.0
 */
function polygonPath(points) {
  const commands = points.map(([pointX, pointY], index) =>
    pathCommand(index === 0 ? 'M' : 'L', pointX, pointY)
  );
  return `${commands.join('')}Z`;
}

/**
 * @description Path data for a star or comic burst: points alternate between two radii.
 * @param {number} centreX - Centre x.
 * @param {number} centreY - Centre y.
 * @param {number} outerRadius - Radius of the points.
 * @param {number} innerRadius - Radius of the notches between points.
 * @param {number} pointCount - Number of points.
 * @returns {string} Closed path data.
 * @throws {never} Never throws.
 * @example
 *   burstPath(50, 50, 20, 12, 12); // a twelve-point "BLAM!" burst
 * @since 1.0.0
 */
export function burstPath(centreX, centreY, outerRadius, innerRadius, pointCount) {
  const points = [];
  const vertexCount = pointCount * 2;
  for (let index = 0; index < vertexCount; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = (Math.PI * index) / pointCount - Math.PI / 2;
    points.push([centreX + radius * Math.cos(angle), centreY + radius * Math.sin(angle)]);
  }
  return polygonPath(points);
}

/**
 * @description Path data for a five-point cartoon star.
 * @param {number} centreX - Centre x.
 * @param {number} centreY - Centre y.
 * @param {number} radius - Radius of the points.
 * @returns {string} Closed path data.
 * @throws {never} Never throws.
 * @example
 *   starPath(60, 14, 3);
 * @since 1.0.0
 */
export function starPath(centreX, centreY, radius) {
  return burstPath(centreX, centreY, radius, radius * 0.45, 5);
}

/**
 * @description Path data for a four-point sparkle (a pinched diamond).
 * @param {number} centreX - Centre x.
 * @param {number} centreY - Centre y.
 * @param {number} radius - Distance from the centre to each tip.
 * @returns {string} Closed path data.
 * @throws {never} Never throws.
 * @example
 *   sparklePath(12, 30, 3);
 * @since 1.0.0
 */
export function sparklePath(centreX, centreY, radius) {
  const waist = radius * 0.28;
  return polygonPath([
    [centreX, centreY - radius],
    [centreX + waist, centreY - waist],
    [centreX + radius, centreY],
    [centreX + waist, centreY + waist],
    [centreX, centreY + radius],
    [centreX - waist, centreY + waist],
    [centreX - radius, centreY],
    [centreX - waist, centreY - waist]
  ]);
}

/**
 * @description Path data for a circle drawn with two arcs, so several circles fit in one path.
 * @param {number} centreX - Centre x.
 * @param {number} centreY - Centre y.
 * @param {number} radius - Radius.
 * @returns {string} Closed path data.
 * @throws {never} Never throws.
 * @example
 *   circlePath(50, 50, 10) + circlePath(70, 50, 6); // two puffs in one <path>
 * @since 1.0.0
 */
export function circlePath(centreX, centreY, radius) {
  const size = roundCoordinate(radius);
  const diameter = roundCoordinate(radius * 2);
  return [
    pathCommand('M', centreX - radius, centreY),
    `a${size} ${size} 0 1 0 ${diameter} 0`,
    `a${size} ${size} 0 1 0 ${-diameter} 0Z`
  ].join('');
}

/**
 * @description Path data for a cartoon heart whose tip points down.
 * @param {number} centreX - Centre x.
 * @param {number} centreY - Centre y.
 * @param {number} size - Overall size; the heart is about 1.8 times this wide.
 * @returns {string} Closed path data.
 * @throws {never} Never throws.
 * @example
 *   heartPath(50, 54, 36);
 * @since 1.0.0
 */
export function heartPath(centreX, centreY, size) {
  return [
    pathCommand('M', centreX, centreY + size * 0.45),
    pathCommand(
      'C',
      centreX - size * 0.9,
      centreY + size * 0.05,
      centreX - size * 0.55,
      centreY - size * 0.75,
      centreX,
      centreY - size * 0.28
    ),
    pathCommand(
      'C',
      centreX + size * 0.55,
      centreY - size * 0.75,
      centreX + size * 0.9,
      centreY + size * 0.05,
      centreX,
      centreY + size * 0.45
    ),
    'Z'
  ].join('');
}

/**
 * @description Path data for a pair of lips (a lipstick kiss mark): a bowed upper lip and a
 *   rounded lower lip, as two sub-paths.
 * @param {number} centreX - Centre x.
 * @param {number} centreY - The line between the lips.
 * @param {number} halfWidth - Half the width of the mouth.
 * @param {number} height - Height of the upper lip.
 * @returns {string} Path data with two closed sub-paths.
 * @throws {never} Never throws.
 * @example
 *   lipsPath(50, 50, 30, 18);
 * @since 1.0.0
 */
export function lipsPath(centreX, centreY, halfWidth, height) {
  const left = centreX - halfWidth;
  const right = centreX + halfWidth;
  const top = centreY - height;
  const dip = centreY - height * 0.45;
  const gap = centreY + height * 0.12;
  const bottom = centreY + height * 1.1;
  const upperLip = [
    pathCommand('M', left, centreY),
    pathCommand('C', left + halfWidth * 0.4, top, centreX - halfWidth * 0.15, top, centreX, dip),
    pathCommand('C', centreX + halfWidth * 0.15, top, right - halfWidth * 0.4, top, right, centreY),
    'Z'
  ];
  const lowerLip = [
    pathCommand('M', left, gap),
    pathCommand('C', left + halfWidth * 0.5, bottom, right - halfWidth * 0.5, bottom, right, gap),
    'Z'
  ];
  return [...upperLip, ...lowerLip].join('');
}

/**
 * @description Path data for a flower's petals: teardrops radiating from the centre.
 * @param {number} centreX - Centre x.
 * @param {number} centreY - Centre y.
 * @param {number} petalCount - Number of petals.
 * @param {number} length - Petal length from the centre.
 * @param {number} width - Half the petal's width at its widest.
 * @returns {string} Path data with one closed sub-path per petal.
 * @throws {never} Never throws.
 * @example
 *   petalPath(51.5, 23.5, 5, 3.6, 1.8);
 * @since 1.0.0
 */
export function petalPath(centreX, centreY, petalCount, length, width) {
  const petals = [];
  for (let index = 0; index < petalCount; index += 1) {
    const angle = (2 * Math.PI * index) / petalCount - Math.PI / 2;
    const alongX = Math.cos(angle);
    const alongY = Math.sin(angle);
    const middleX = centreX + alongX * length * 0.55;
    const middleY = centreY + alongY * length * 0.55;
    petals.push(
      [
        pathCommand('M', centreX, centreY),
        pathCommand(
          'Q',
          middleX - alongY * width,
          middleY + alongX * width,
          centreX + alongX * length,
          centreY + alongY * length
        ),
        pathCommand('Q', middleX + alongY * width, middleY - alongX * width, centreX, centreY),
        'Z'
      ].join('')
    );
  }
  return petals.join('');
}

/**
 * @description A glossy chestnut (conker) inside a <g class="chestnut"> group, so a caller
 *   can bounce it. Shared by the tree top, the nut bubble and the chestnut sprite.
 * @param {number} centreX - Centre x of the nut.
 * @param {number} centreY - Centre y of the nut.
 * @param {number} size - Radius-like size; the nut is about twice this wide.
 * @returns {import('lit').SVGTemplateResult} The chestnut group.
 * @throws {never} Never throws.
 * @example
 *   svg`<g>${chestnutFragment(30, 11, 7)}</g>`;
 * @since 1.0.0
 */
export function chestnutFragment(centreX, centreY, size) {
  const top = centreY - size;
  const nutPath = [
    pathCommand('M', centreX, top),
    pathCommand(
      'C',
      centreX + size * 0.95,
      top + size * 0.05,
      centreX + size * 1.05,
      centreY + size * 0.55,
      centreX,
      centreY + size * 0.8
    ),
    pathCommand(
      'C',
      centreX - size * 1.05,
      centreY + size * 0.55,
      centreX - size * 0.95,
      top + size * 0.05,
      centreX,
      top
    ),
    'Z'
  ].join('');
  const basePath = [
    pathCommand('M', centreX - size * 0.62, centreY + size * 0.42),
    pathCommand(
      'C',
      centreX - size * 0.3,
      centreY + size * 0.92,
      centreX + size * 0.3,
      centreY + size * 0.92,
      centreX + size * 0.62,
      centreY + size * 0.42
    ),
    pathCommand(
      'C',
      centreX + size * 0.3,
      centreY + size * 0.62,
      centreX - size * 0.3,
      centreY + size * 0.62,
      centreX - size * 0.62,
      centreY + size * 0.42
    ),
    'Z'
  ].join('');
  const tuftPath = [
    pathCommand('M', centreX, top),
    pathCommand('q', -size * 0.12, -size * 0.25, size * 0.08, -size * 0.42)
  ].join('');
  return svg`<g class="chestnut">
    <path d=${nutPath} fill="#7B3F1D"></path>
    <path d=${basePath} fill="#D9B48A"></path>
    <ellipse cx=${roundCoordinate(centreX - size * 0.38)}
      cy=${roundCoordinate(centreY - size * 0.35)}
      rx=${roundCoordinate(size * 0.16)} ry=${roundCoordinate(size * 0.3)}
      fill="#FFFFFF" opacity="0.45"></ellipse>
    <path d=${tuftPath} fill="none" stroke="#4E2A12"
      stroke-width=${roundCoordinate(Math.max(size * 0.1, 0.5))} stroke-linecap="round"></path>
  </g>`;
}

/**
 * @description Wraps sprite content in a decorative <svg> root: aria-hidden, not focusable,
 *   overflow visible (via the .ss-sprite class) so effects may leave the viewBox.
 * @param {Object} options - Root options.
 * @param {string} options.rootClass - Space-separated classes for the <svg> root.
 * @param {string} [options.viewBox] - The viewBox; defaults to SQUARE_VIEW_BOX.
 * @param {Object<string, string>} [options.style] - Custom properties, applied with styleMap.
 * @param {string} [options.preserveAspectRatio] - Defaults to 'xMidYMid meet'.
 * @param {*} options.content - The svg fragment to draw.
 * @returns {import('lit').TemplateResult} An html template whose root element is the <svg>.
 * @throws {never} Never throws.
 * @example
 *   spriteSvg({rootClass: 'ss-sprite ss-heart', content: svg`<circle r="4"></circle>`});
 * @since 1.0.0
 */
export function spriteSvg({
  rootClass,
  viewBox = SQUARE_VIEW_BOX,
  style = {},
  preserveAspectRatio = 'xMidYMid meet',
  content
}) {
  return html`<svg
    class=${rootClass}
    viewBox=${viewBox}
    preserveAspectRatio=${preserveAspectRatio}
    style=${styleMap(style)}
    aria-hidden="true"
    focusable="false"
  >${content}</svg>`;
}

// Fur palettes (SPEC.md § 9): the literal colours of each coat.
const FUR_PALETTES = {
  red: Object.freeze({fur: '#C8642F', dark: '#8E3F1B', belly: '#F3D9B8', eye: '#1B1B1B'}),
  grey: Object.freeze({fur: '#8E8E93', dark: '#5F5F64', belly: '#E7E3DB', eye: '#1B1B1B'}),
  black: Object.freeze({fur: '#2F2B2A', dark: '#161312', belly: '#6B615C', eye: '#1B1B1B'}),
  cinnamon: Object.freeze({fur: '#B5763F', dark: '#7E4F27', belly: '#F0D7B5', eye: '#1B1B1B'}),
  // Albino squirrels have pink-red eyes.
  albino: Object.freeze({fur: '#F7F4EE', dark: '#D8D0C3', belly: '#FFFFFF', eye: '#C2185B'}),
  golden: Object.freeze({fur: '#E8B231', dark: '#B07F12', belly: '#FFF0B8', eye: '#1B1B1B'}),
  // The resting colours of the animated rainbow coat (animations.js cycles the colour).
  rainbow: Object.freeze({fur: '#9C4DCC', dark: '#6A2C91', belly: '#F5E1FF', eye: '#1B1B1B'})
};

// A singed squirrel (hunter hit, lightning) goes soot-black whatever its fur.
const SOOT_PALETTE = Object.freeze({
  fur: '#2E2A27',
  dark: '#171513',
  belly: '#4A4440',
  eye: '#1B1B1B'
});

/**
 * @description The literal colours of a fur, for sprites that draw squirrel parts.
 * @param {*} furId - A fur id; unknown ids give the default red coat.
 * @returns {{fur: string, dark: string, belly: string, eye: string}} Hex colours (frozen).
 * @throws {never} Never throws.
 * @example
 *   furPalette('grey').fur; // '#8E8E93'
 * @since 1.1.0
 */
export function furPalette(furId) {
  return FUR_PALETTES[pickId(FUR_PALETTES, furId, DEFAULT_FUR)];
}

/**
 * @description The custom properties a squirrel root sets for CSS theming of its fur.
 * @param {string} furId - A known fur id.
 * @param {boolean} singed - Whether the soot palette replaces the fur.
 * @returns {Object<string, string>} --fur, --fur-dark, --belly and --eye values for styleMap.
 * @throws {never} Never throws.
 * @example
 *   furStyle('albino', false)['--eye']; // 'var(--ss-eye-albino, #C2185B)'
 * @since 1.0.0
 */
function furStyle(furId, singed) {
  const palette = singed ? SOOT_PALETTE : FUR_PALETTES[furId];
  const prefix = singed ? 'soot' : `fur-${furId}`;
  const albinoEyes = furId === 'albino' && !singed;
  return {
    '--fur': paint(prefix, palette.fur),
    '--fur-dark': paint(`${prefix}-dark`, palette.dark),
    '--belly': paint(`${prefix}-belly`, palette.belly),
    '--eye': albinoEyes ? paint('eye-albino', palette.eye) : paint('eye', '#1B1B1B')
  };
}

// Hats (SPEC.md § 9), drawn on top of the head. 'halo' floats and glows; 'propeller' spins.
const HAT_ART = {
  none: nothing,
  top_hat: svg`
    <path d="M53.5 23L54.5 5H65.5L66.5 23Z" fill="#222222"></path>
    <path d="M53.7 18.5H66.3L66.5 22.2H53.5Z" fill="#B71C1C"></path>
    <ellipse cx="60" cy="23" rx="11.5" ry="2.4" fill="#1A1A1A"></ellipse>`,
  crown: svg`
    <path d="M50.5 24.5L51.5 12.5L56 18L60 9.5L64 18L68.5 12.5L69.5 24.5Z" fill="#F2C230"
      stroke="#B8860B" stroke-width="0.8" stroke-linejoin="round"></path>
    <path d="M50.7 21.4H69.3L69.5 24.5H50.5Z" fill="#D9A21B"></path>
    <circle cx="60" cy="18.6" r="1.7" fill="#D32F2F"></circle>
    <circle cx="54.6" cy="22.9" r="1.1" fill="#1E88E5"></circle>
    <circle cx="65.4" cy="22.9" r="1.1" fill="#1E88E5"></circle>`,
  propeller: svg`
    <path d="M49.5 25C49.5 15 70.5 15 70.5 25Z" fill="#E53935"></path>
    <path d="M57.2 17.8H62.8L64.5 25H55.5Z" fill="#FDD835"></path>
    <path d="M68 24.5C72 24 75 24.5 76 25.6C73 26.4 70 26.2 67.5 25.6Z" fill="#1E88E5"></path>
    <path d="M60 17.6V12" stroke="#616161" stroke-width="1.2" stroke-linecap="round"></path>
    <g class="propeller-blades">
      <path d="M60 11.5C57 9.7 51.5 9.9 50.5 11.5C51.5 13.1 57 13.3 60 11.5Z
        M60 11.5C63 9.7 68.5 9.9 69.5 11.5C68.5 13.1 63 13.3 60 11.5Z" fill="#43A047"></path>
    </g>
    <circle cx="60" cy="11.5" r="1.3" fill="#FDD835"></circle>`,
  viking: svg`
    <path d="M51.5 20C46 19.5 42.5 14.5 43.5 7.5C46.5 12 49.5 14 53.5 15.5Z
      M68.5 20C74 19.5 77.5 14.5 76.5 7.5C73.5 12 70.5 14 66.5 15.5Z" fill="#F3E9D2"
      stroke="#CDBF9F" stroke-width="0.6"></path>
    <path d="M50 25C50 13.5 70 13.5 70 25Z" fill="#9AA4AE"></path>
    <path d="M49.5 22.6H70.5V25.6H49.5Z" fill="#8D6E3F"></path>`,
  wizard: svg`
    <path d="M49.5 24.5C53 17 56 9 67 1.5C64.5 9.5 66.5 17 70.5 24.5Z" fill="#3949AB"></path>
    <path d=${starPath(59.5, 15.5, 2.6) + starPath(64.2, 8.5, 1.8)} fill="#FFEB3B"></path>
    <ellipse cx="60" cy="24.5" rx="12.5" ry="2.6" fill="#283593"></ellipse>`,
  cowboy: svg`
    <path d="M52 23.5C51 15.5 54 12.5 57 13.5C58.8 15.2 61.2 15.2 63 13.5C66 12.5 69 15.5 68 23.5Z"
      fill="#8B5A2B"></path>
    <path d="M52.2 20.5H67.8L67.9 23.4H52.1Z" fill="#4E342E"></path>
    <path d="M44 20.5C47 28.5 73 28.5 76 20.5C72 24 66 24.5 60 24.5C54 24.5 48 24 44 20.5Z"
      fill="#7A4E24"></path>`,
  party: svg`
    <path d="M51.5 24.5L62.5 3.5L69.5 23.5Z" fill="#EC407A"></path>
    <path d="M55.4 17H67.2L68.3 20H53.9ZM59.6 9H64.4L65.1 11H58.6Z" fill="#FFEB3B"></path>
    <circle cx="62.5" cy="3.5" r="2.6" fill="#4FC3F7"></circle>`,
  chef: svg`
    <path d="M52.5 18C47 15.5 48.5 7 55 8C55.5 2.5 64.5 2.5 65 8C71.5 7 73 15.5 67.5 18Z"
      fill="#FAFAFA" stroke="#CFCFCF" stroke-width="0.8"></path>
    <path d="M53 17H67L67.4 24.5H52.6Z" fill="#FFFFFF" stroke="#CFCFCF" stroke-width="0.8">
    </path>
    <path d="M57 18.5V23.5M60 18.5V23.5M63 18.5V23.5" stroke="#DDDDDD" stroke-width="0.7">
    </path>`,
  beanie: svg`
    <path d="M49.5 25C49 13 71 13 70.5 25Z" fill="#26A69A"></path>
    <path d="M48.8 21.2Q60 19.2 71.2 21.2L71.6 26Q60 24 48.4 26Z" fill="#00897B"></path>
    <path d="M52 21.5V25.3M55 20.8V24.8M58 20.5V24.5M61 20.5V24.5M64 20.7V24.7M67 21.1V25.1"
      stroke="#00695C" stroke-width="0.8"></path>
    <circle cx="60" cy="13.8" r="3.2" fill="#FFB74D"></circle>`,
  pirate: svg`
    <path d="M45.5 22.5C50 16.5 54 19 60 12.5C66 19 70 16.5 74.5 22.5C68 25.8 52 25.8 45.5 22.5Z"
      fill="#212121"></path>
    <path d="M46.5 23C52 25.3 68 25.3 73.5 23" fill="none" stroke="#FFC107" stroke-width="1">
    </path>
    <path d="M56.8 18.2L63.2 22.8M63.2 18.2L56.8 22.8" stroke="#FAFAFA" stroke-width="1.1"
      stroke-linecap="round"></path>
    <circle cx="60" cy="19.4" r="2.1" fill="#FAFAFA"></circle>`,
  traffic_cone: svg`
    <path d="M49.5 25.5H70.5L69.5 22.5H50.5Z" fill="#E65100"></path>
    <path d="M53.5 23L58.6 3H61.4L66.5 23Z" fill="#FF7A1A"></path>
    <path d="M55.8 14H64.2L65.1 17.5H54.9ZM57.6 7H62.4L63.1 9.5H56.9Z" fill="#FAFAFA"></path>`,
  halo: svg`
    <ellipse class="halo-glow" cx="60" cy="11" rx="10.5" ry="3" fill="none" stroke="#FFF59D"
      stroke-width="5" opacity="0.45"></ellipse>
    <ellipse cx="60" cy="11" rx="10" ry="2.8" fill="none" stroke="#FFD54F" stroke-width="2.2">
    </ellipse>`
};

/**
 * @description One cape: the billowing main shape (behind the body) and a fold line.
 * @param {string} mainHex - Main colour.
 * @param {string} foldHex - Fold-line colour.
 * @returns {import('lit').SVGTemplateResult} The cape's base shapes.
 * @throws {never} Never throws.
 * @example
 *   capeBase('#C62828', '#8E1C1C');
 * @since 1.0.0
 */
function capeBase(mainHex, foldHex) {
  return svg`
    <path d="M45 46C36 50 24 62 18 84C28 89 42 89 52 84C48 70 52 57 57 48Z" fill=${mainHex}>
    </path>
    <path d="M42 51C34 59 28 70 26 86" fill="none" stroke=${foldHex} stroke-width="1.6"
      stroke-linecap="round"></path>`;
}

// Capes (SPEC.md § 9): drawn behind the body, in front of the tail, fluttering while climbing.
const CAPE_ART = {
  none: nothing,
  red: capeBase('#C62828', '#8E1C1C'),
  blue: capeBase('#1E5AA8', '#143E75'),
  green: capeBase('#2E7D32', '#1B5E20'),
  purple: capeBase('#6A1B9A', '#4A148C'),
  royal: svg`${capeBase('#8E1446', '#5E0D2E')}
    <path d="M18 84C28 89 42 89 52 84L51.5 80.5C42 85 28 85 19.2 80Z" fill="#FAFAFA"></path>
    <path d=${circlePath(24, 84.4, 0.7) + circlePath(31, 85.6, 0.7) + circlePath(38, 85.8, 0.7) +
      circlePath(45, 85, 0.7)} fill="#1A1A1A"></path>`,
  superhero: svg`${capeBase('#D32F2F', '#9A1F1F')}
    <circle cx="28.5" cy="76" r="4.6" fill="#FFD54F" stroke="#F9A825" stroke-width="0.6"></circle>
    <path d="M26.4 74.6C26.5 72.6 30.5 72.6 30.6 74.6Z" fill="#6D4C41"></path>
    <path d="M26.8 74.6C26.8 78.6 30.2 78.6 30.2 74.6Z" fill="#A1662F"></path>`,
  tartan: svg`${capeBase('#1F5E3A', '#154229')}
    <path d="M24 70L48 68M20.5 79L50 77M31 60L28.2 86M40 55L38.6 86.6" fill="none"
      stroke="#1A237E" stroke-width="2.4" opacity="0.85"></path>
    <path d="M23 73.5L48 71.5M19.5 82L50 80.5M34 58L32 86.6" fill="none" stroke="#C62828"
      stroke-width="0.9"></path>`
};

const FLOWER_PETALS = petalPath(51.5, 23.5, 5, 3.6, 1.8);

// Accessories (SPEC.md § 9): face and neck pieces, drawn inside the head group.
const ACCESSORY_ART = {
  none: nothing,
  sunglasses: svg`
    <path d="M60 29.2L50 30.2" stroke="#111111" stroke-width="1.2" stroke-linecap="round"></path>
    <path d="M59.4 27.4H70.2L69.4 32.8C68 35 62 35 60.4 32.8Z" fill="#111111"></path>
    <path d="M62 29L64.2 28.4" stroke="#FFFFFF" stroke-width="0.8" stroke-linecap="round"
      opacity="0.8"></path>`,
  monocle: svg`
    <circle cx="64.5" cy="30.5" r="4.7" fill="#E3F2FD" fill-opacity="0.3" stroke="#D4AF37"
      stroke-width="1"></circle>
    <path d="M64.5 35.2C63 40 60 44 56.5 47" fill="none" stroke="#D4AF37" stroke-width="0.6"
      stroke-dasharray="1 0.7"></path>`,
  bow_tie: svg`
    <path d="M62 47.5L56.5 44.2V50.8ZM62 47.5L67.5 44.2V50.8Z" fill="#C62828"></path>
    <circle cx="62" cy="47.5" r="1.7" fill="#8E1C1C"></circle>`,
  scarf: svg`
    <path class="scarf-tail"
      d="M52 47.5C46 50.5 40 49 35.5 52.5L37.5 56.5C42.5 53.5 47.5 54.5 53 51Z" fill="#E53935">
    </path>
    <path d="M51 44.5C56 49.5 64 49.5 69 44.5L70 48.5C64 53.5 56 53.5 50 48.5Z" fill="#E53935">
    </path>
    <path d="M54 47.3L53.2 51.6M58 48.6L57.6 52.6M62 48.6L62.2 52.6M66 47.3L66.8 51.4"
      stroke="#FFFFFF" stroke-width="1.1"></path>`,
  moustache: svg`
    <path d="M77.8 38.8C75.5 37.6 72.5 38.4 70.8 40.6C70 41.8 68.4 41.6 67.8 40.6
      C68.4 43.2 71.8 43.2 73.4 41.4C74.8 40.4 76.4 40.3 77.8 39.8Z" fill="#3E2723"></path>`,
  eyepatch: svg`
    <path d="M61.5 27.6C57 25.6 52 25.4 48.4 28.4" fill="none" stroke="#111111"
      stroke-width="1.2"></path>
    <ellipse cx="64.6" cy="30.8" rx="4.3" ry="4.7" fill="#111111"></ellipse>`,
  gold_chain: svg`
    <path d="M53.5 45.5C55.5 53.5 64.5 54.5 66.5 46" fill="none" stroke="#D4AF37"
      stroke-width="1.6" stroke-dasharray="1.6 0.8"></path>
    <circle cx="60.4" cy="52.8" r="2.6" fill="#FFC107" stroke="#B8860B" stroke-width="0.6">
    </circle>`,
  headphones: svg`
    <path d="M51.5 31C49 17 63.5 13.5 64 22.5" fill="none" stroke="#263238" stroke-width="2.4"
      stroke-linecap="round"></path>
    <ellipse cx="52.4" cy="32.4" rx="3.4" ry="4.3" fill="#263238"></ellipse>
    <ellipse cx="51.6" cy="32.4" rx="1.6" ry="2.6" fill="#EF5350"></ellipse>`,
  flower: svg`
    <path d=${FLOWER_PETALS} fill="#FFFFFF" stroke="#E0E0E0" stroke-width="0.4"></path>
    <circle cx="51.5" cy="23.5" r="1.6" fill="#FFC107"></circle>`
};

/**
 * Eye styles, drawn inside the eye group around (64.5, 30.5). Exported so the suitor shares
 * them. Pupils carry the ss-pupil class (CSS gives them --eye); the sulky lid carries ss-fur.
 */
export const EYE_ART = {
  open: svg`
    <ellipse cx="64.5" cy="30.5" rx="3.4" ry="4" fill="#FFFFFF"></ellipse>
    <circle class="ss-pupil" cx="65.7" cy="31" r="2.1" fill="#1B1B1B"></circle>
    <circle cx="66.4" cy="30.1" r="0.7" fill="#FFFFFF"></circle>`,
  wide: svg`
    <ellipse cx="64.5" cy="30.3" rx="3.9" ry="4.6" fill="#FFFFFF"></ellipse>
    <circle class="ss-pupil" cx="65" cy="30.6" r="1.4" fill="#1B1B1B"></circle>`,
  down: svg`
    <ellipse cx="64.5" cy="30.5" rx="3.4" ry="4" fill="#FFFFFF"></ellipse>
    <circle class="ss-pupil" cx="65.3" cy="32.6" r="1.9" fill="#1B1B1B"></circle>
    <path class="ss-fur" d="M60.9 30.4C61.4 26 67.6 26 68.1 30.4Z" fill="#C8642F"></path>`,
  happy: svg`
    <path d="M61.3 32C62.6 27.6 66.4 27.6 67.7 32" fill="none" stroke="#2B1D16"
      stroke-width="1.3" stroke-linecap="round"></path>`,
  dreamy: svg`
    <path d="M61.3 30C62.6 34 66.4 34 67.7 30" fill="none" stroke="#2B1D16" stroke-width="1.3"
      stroke-linecap="round"></path>`,
  spiral: svg`
    <ellipse cx="64.5" cy="30.5" rx="3.6" ry="4.1" fill="#FFFFFF"></ellipse>
    <path
      d="M64.9 30.5a0.4 0.4 0 1 1-0.8 0a1.1 1.1 0 1 1 2 0a1.8 1.8 0 1 1-3.4 0a2.5 2.5 0 1 1 4.8 0"
      fill="none" stroke="#2B1D16" stroke-width="0.7"></path>`,
  cross: svg`
    <path d="M62 28L67 33M67 28L62 33" fill="none" stroke="#2B1D16" stroke-width="1.4"
      stroke-linecap="round"></path>`,
  squint: svg`
    <path d="M61.6 28.4L66.8 30.8L61.6 33.2" fill="none" stroke="#2B1D16" stroke-width="1.3"
      stroke-linecap="round" stroke-linejoin="round"></path>`
};

// The buck tooth under the snout.
const TOOTH = svg`<rect x="73" y="41" width="2.4" height="2.6" rx="0.6" fill="#FFFFFF"
  stroke="#2B1D16" stroke-width="0.3"></rect>`;

// Mouths, under the snout.
const MOUTH_ART = {
  smile: svg`
    <path d="M71.6 40.3Q74.2 42.5 76.8 40.5" fill="none" stroke="#2B1D16" stroke-width="0.9"
      stroke-linecap="round"></path>${TOOTH}`,
  grin: svg`<path d="M71.2 40.2Q74.4 46.4 77.4 40.4Z" fill="#6D1B1B"></path>${TOOTH}`,
  wobble: svg`
    <path d="M70.6 41.4q1.1-1.2 2.2 0t2.2 0t2.2 0" fill="none" stroke="#2B1D16"
      stroke-width="0.9" stroke-linecap="round"></path>`,
  gasp: svg`<ellipse cx="74.6" cy="41.8" rx="1.5" ry="1.9" fill="#6D1B1B"></ellipse>`,
  pucker: svg`<ellipse cx="78.1" cy="40.6" rx="1.5" ry="1.2" fill="#C2185B"></ellipse>`,
  frown: svg`
    <path d="M71.6 42.2Q74.2 40.2 76.8 42.3" fill="none" stroke="#2B1D16" stroke-width="0.9"
      stroke-linecap="round"></path>`,
  grimace: svg`
    <rect x="71" y="39.6" width="6.4" height="2.8" rx="0.8" fill="#FFFFFF" stroke="#2B1D16"
      stroke-width="0.6"></rect>
    <path d="M73.1 39.6V42.4M75.2 39.6V42.4" stroke="#2B1D16" stroke-width="0.4"></path>`,
  shut: svg`
    <path d="M73 41.6Q74.6 42.4 76.2 41.6" fill="none" stroke="#2B1D16" stroke-width="0.9"
      stroke-linecap="round"></path>`
};

// Poses (SPEC.md § 10, § 11; Chaos v2 § 5): paw positions for each arm, plus the eye and
// mouth styles. The arms run from fixed shoulders at (60.5, 53) and (55.5, 51). 'dance' is a
// disco point; 'flag' grips the trunk while animations.js turns the body to stream sideways.
const SQUIRREL_POSES = {
  climb: {frontPaw: [76, 48], backPaw: [70, 58], eyes: 'open', mouth: 'smile'},
  idle: {frontPaw: [65, 64], backPaw: [61.5, 62.5], eyes: 'open', mouth: 'smile'},
  cheer: {frontPaw: [82, 39], backPaw: [43, 28], eyes: 'open', mouth: 'grin'},
  dizzy: {frontPaw: [63.5, 67], backPaw: [59, 65], eyes: 'spiral', mouth: 'wobble'},
  stunned: {frontPaw: [73, 63], backPaw: [47, 63], eyes: 'cross', mouth: 'gasp'},
  kiss: {frontPaw: [66, 61], backPaw: [62, 59.5], eyes: 'dreamy', mouth: 'pucker'},
  sulk: {frontPaw: [51, 58], backPaw: [64, 58], eyes: 'down', mouth: 'frown'},
  victory: {frontPaw: [81, 33], backPaw: [45, 22], eyes: 'happy', mouth: 'grin'},
  fly: {frontPaw: [78, 61], backPaw: [41, 40], eyes: 'wide', mouth: 'gasp'},
  dance: {frontPaw: [85, 36], backPaw: [46, 66], eyes: 'happy', mouth: 'grin'},
  flag: {frontPaw: [56, 30], backPaw: [52, 32], eyes: 'squint', mouth: 'grimace'}
};

// The victory dance is picked by the hat (SPEC.md § 8 result view); anything else jigs.
const DANCE_BY_HAT = {crown: 'royal-wave', viking: 'war-dance', party: 'conga'};

// The paler streak along the tail, replaced by stripes on a rainbow coat.
const TAIL_HIGHLIGHT = svg`<path class="ss-fur-belly-stroke"
  d="M40 80C26 80 21 67 23 55C25 43 29 35 28 27C28 21 33 16 39 16"
  fill="none" stroke="#F3D9B8" stroke-width="2" stroke-linecap="round" opacity="0.45"></path>`;

// Static rainbow stripes: the rainbow coat still reads as rainbow with motion reduced.
const RAINBOW_STRIPES = svg`<g class="rainbow-stripes" fill="none" stroke-width="2.2"
  stroke-linecap="round" opacity="0.9">
  <path d="M38 82C24 82 18 70 19 58C20 46 25 38 25 29" stroke="#E53935"></path>
  <path d="M40 78C27 78 22 67 23 56C24 45 28 37 28 28" stroke="#FDD835"></path>
  <path d="M42 74C31 74 26 65 27 55C28 45 31 37 30.5 32" stroke="#1E88E5"></path>
</g>`;

// Golden fur's sheen: white streaks whose opacity twinkles.
const TAIL_SHEEN = svg`<path class="sheen sheen-tail" d="M20 66C19 54 23 46 25 38" fill="none"
  stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" opacity="0.55"></path>`;
const BODY_SHEEN = svg`<path class="sheen sheen-body" d="M40 58C38.5 64 38.5 71 40.5 77"
  fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" opacity="0.55"></path>`;

// Smoke curling off a singed tail tip.
const SMOKE_WISPS = svg`
  <circle class="smoke-wisp wisp-1" cx="46" cy="16" r="2.4" fill="#9E9E9E" opacity="0.7">
  </circle>
  <circle class="smoke-wisp wisp-2" cx="48.5" cy="10.5" r="1.7" fill="#9E9E9E" opacity="0.55">
  </circle>`;

// The legendary aura: a soft glow behind the squirrel and four twinkling sparkles.
const SPARKLE_AURA = svg`<g class="sparkle">
  <circle class="sparkle-glow" cx="50" cy="56" r="44" fill="#FFF59D" opacity="0.22"></circle>
  <path class="sparkle-star sparkle-star-1" d=${sparklePath(12, 30, 3.2)} fill="#FFF176"
    stroke="#FFC107" stroke-width="0.4"></path>
  <path class="sparkle-star sparkle-star-2" d=${sparklePath(88, 24, 2.8)} fill="#FFF176"
    stroke="#FFC107" stroke-width="0.4"></path>
  <path class="sparkle-star sparkle-star-3" d=${sparklePath(86, 78, 3.2)} fill="#FFF176"
    stroke="#FFC107" stroke-width="0.4"></path>
  <path class="sparkle-star sparkle-star-4" d=${sparklePath(16, 82, 2.6)} fill="#FFF176"
    stroke="#FFC107" stroke-width="0.4"></path>
</g>`;

// Dizzy stars, all centred above the head; animations.js spreads them into an orbit.
const DIZZY_STAR_PATH = starPath(60, 14, 3);
const DIZZY_STARS = svg`<g class="dizzy-stars">
  <path class="dizzy-star dizzy-star-1" d=${DIZZY_STAR_PATH} fill="#FFEB3B" stroke="#F9A825"
    stroke-width="0.5"></path>
  <path class="dizzy-star dizzy-star-2" d=${DIZZY_STAR_PATH} fill="#FFEB3B" stroke="#F9A825"
    stroke-width="0.5"></path>
  <path class="dizzy-star dizzy-star-3" d=${DIZZY_STAR_PATH} fill="#FFEB3B" stroke="#F9A825"
    stroke-width="0.5"></path>
</g>`;

// The chestnut speech bubble shown during a nut stop (SPEC.md § 11.4).
const NUT_BUBBLE = svg`<g class="nut-bubble">
  <path d="M72 21C64 20 65 6 74 5.5C79 1.5 90 1.5 94 6C100 8 100 19 93 20.5C89 22.5 84 22.5
    80 21.5L76.5 28L77 21.5Z" fill="#FFFFFF" stroke="#2B1D16" stroke-width="0.8"
    stroke-linejoin="round"></path>
  ${chestnutFragment(84, 12.5, 5.5)}
</g>`;

// Wind lines that whirl round a squirrel caught in the tornado.
const WIND_SWIRL = svg`<g class="wind-swirl">
  <path d="M16 40C20 18 48 8 68 16M84 70C78 90 50 96 30 86" fill="none" stroke="#B0BEC5"
    stroke-width="2" stroke-linecap="round" opacity="0.85"></path>
</g>`;

// A grey tabby cat clinging to the squirrel's back (Chaos v2 catLady), claws in, eyes wide.
const CAT_CLINGING = svg`<g class="cat-cling">
  <path d="M30 70C22 72 18 62 22 56" fill="none" stroke="#8A8A8A" stroke-width="3"
    stroke-linecap="round"></path>
  <ellipse cx="36" cy="60" rx="7" ry="10" fill="#9E9E9E"></ellipse>
  <path d="M31 56q5-1 10 0M30.5 61q5.5-1 11 0M31 66q5-1 10 0" fill="none" stroke="#616161"
    stroke-width="1"></path>
  <path d="M32 44L32.5 37.5L36 42ZM42 44L41.5 37.5L38 42Z" fill="#9E9E9E"></path>
  <circle cx="37" cy="47" r="6" fill="#9E9E9E"></circle>
  <path d=${circlePath(34.8, 46.4, 1.9) + circlePath(39.4, 46.4, 1.9)} fill="#FFFFFF"></path>
  <path d=${circlePath(35, 46.6, 0.8) + circlePath(39.6, 46.6, 0.8)} fill="#1B1B1B"></path>
  <path d="M37.2 49v1M34 49L30 48.4M34 50L30 50.8M40.4 49L44 48.4M40.4 50L44 50.8" fill="none"
    stroke="#424242" stroke-width="0.4" stroke-linecap="round"></path>
  <path d=${circlePath(43, 54, 2) + circlePath(43, 64, 2) + circlePath(31, 70.5, 2)}
    fill="#BDBDBD"></path>
</g>`;

// Motion lines either side of a vibrating squirrel (Chaos v2 woodpecker).
const VIBRATE_LINES = svg`<g class="vibrate-lines">
  <path d="M8 40V60M14 34V66M86 40V60M92 34V66" fill="none" stroke="#616161"
    stroke-width="1.4" stroke-linecap="round" opacity="0.7"></path>
</g>`;

const CHEEK_KISS_PATH = lipsPath(67.4, 36.4, 2.3, 1.4);

/**
 * @description The cheek group's content: a soft blush, or a red slap flush with finger
 *   marks; a lipstick kiss mark when one has been planted; and puffed, nut-stuffed cheeks
 *   when chubby.
 * @param {{redCheek: boolean, lipstick: boolean, chubby: boolean}} flags - The effect flags.
 * @param {{fur: string, dark: string}} palette - The coat's literal colours.
 * @returns {import('lit').SVGTemplateResult} The cheek art.
 * @throws {never} Never throws.
 * @example
 *   cheekArt({redCheek: true, lipstick: false, chubby: false}, furPalette('red'));
 * @since 1.0.0
 */
function cheekArt(flags, palette) {
  const pouch = flags.chubby
    ? svg`<g class="cheek-pouch">
        <ellipse class="ss-fur" cx="66.5" cy="40" rx="7.2" ry="6.2" fill=${palette.fur}>
        </ellipse>
        <path class="ss-fur-edge" d="M60.4 43.6C62.6 47.6 70.6 47.8 73.6 43.8" fill="none"
          stroke=${palette.dark} stroke-width="0.9" stroke-linecap="round"></path>
        <ellipse cx="64" cy="37.6" rx="2.2" ry="1.4" fill="#FFFFFF" opacity="0.35"></ellipse>
      </g>`
    : nothing;
  const flush = flags.redCheek
    ? svg`<ellipse cx="68.4" cy="37.8" rx="4" ry="3.2" fill="#E53935" opacity="0.7"></ellipse>
        <path d="M66 35.4L65.4 39.6M67.6 35L67.2 40M69.2 35.2L69 40M70.8 35.8L70.8 39.6"
          stroke="#B71C1C" stroke-width="0.7" stroke-linecap="round" opacity="0.8"></path>`
    : svg`<circle cx="68.5" cy="37.6" r="2.6" fill="#F48FB1" opacity="0.45"></circle>`;
  const kiss = flags.lipstick
    ? svg`<path class="lipstick-mark" d=${CHEEK_KISS_PATH} fill="#D81B60"></path>`
    : nothing;
  return svg`${pouch}${flush}${kiss}`;
}

/**
 * @description Draws the shared rodent figure used by the racing squirrel and the suitor:
 *   an event group (one-shot animations) around a motion group (pose loops) holding the
 *   tail, cape slot, arms, body, belly, leg and head (ear, eye, cheek, nose, mouth,
 *   accessory and hat slots). Every slot defaults to empty. Fur parts take the palette's
 *   literal colours and carry the fur classes, so CSS can re-theme them.
 * @param {Object} [parts] - The pieces to place.
 * @param {{fur: string, dark: string, belly: string}} [parts.palette] - Literal coat colours;
 *   the red coat by default (the suitor's root sets --fur and CSS repaints her).
 * @param {*} [parts.beforeMotion] - Art behind the figure, e.g. the legendary aura.
 * @param {*} [parts.afterMotion] - Art over the figure that ignores pose motion.
 * @param {*} [parts.front] - Art over the figure that follows pose motion.
 * @param {*} [parts.tailExtras] - Art inside the tail group (defaults to its highlight).
 * @param {*} [parts.bodyExtras] - Art inside the body group.
 * @param {string} [parts.capeId] - Cape id, for the class cape-<id>.
 * @param {*} [parts.capeArt] - The cape slot's art.
 * @param {Array<number>} [parts.backPaw] - [x, y] of the far paw.
 * @param {Array<number>} [parts.frontPaw] - [x, y] of the near paw.
 * @param {*} [parts.eyes] - The eye group's art.
 * @param {*} [parts.cheek] - The cheek group's art.
 * @param {*} [parts.mouth] - The mouth group's art.
 * @param {*} [parts.headExtras] - Extra head art drawn under the accessory and hat.
 * @param {string} [parts.accessoryId] - Accessory id, for the class accessory-<id>.
 * @param {*} [parts.accessoryArt] - The accessory slot's art.
 * @param {string} [parts.hatId] - Hat id, for the class hat-<id>.
 * @param {*} [parts.hatArt] - The hat slot's art.
 * @returns {import('lit').SVGTemplateResult} The figure, ready for spriteSvg.
 * @throws {never} Never throws.
 * @example
 *   rodentFigure({eyes: EYE_ART.open, frontPaw: [65, 64], backPaw: [61.5, 62.5]});
 * @since 1.0.0
 */
export function rodentFigure({
  palette = FUR_PALETTES.red,
  beforeMotion = nothing,
  afterMotion = nothing,
  front = nothing,
  tailExtras = TAIL_HIGHLIGHT,
  bodyExtras = nothing,
  capeId = 'none',
  capeArt = nothing,
  backPaw = [61.5, 62.5],
  frontPaw = [65, 64],
  eyes = nothing,
  cheek = nothing,
  mouth = nothing,
  headExtras = nothing,
  accessoryId = 'none',
  accessoryArt = nothing,
  hatId = 'none',
  hatArt = nothing
} = {}) {
  return svg`<g class="ss-event">
    ${beforeMotion}
    <g class="ss-motion">
      <g class="tail">
        <path class="ss-fur" d=${SQUIRREL_TAIL_PATH} fill=${palette.fur}></path>
        ${tailExtras}
      </g>
      <g class="cape cape-${capeId}">${capeArt}</g>
      <g class="arm-back">
        <line class="ss-fur-dark-stroke" x1="55.5" y1="51" x2=${backPaw[0]} y2=${backPaw[1]}
          stroke=${palette.dark} stroke-width="5" stroke-linecap="round"></line>
      </g>
      <g class="body">
        <path class="ss-fur" fill=${palette.fur}
          d="M44 46C36 50 34 66 38 78C41 87 56 89 61 82C66 74 66 56 60 48C56 44 49 43 44 46Z">
        </path>
        ${bodyExtras}
      </g>
      <g class="belly">
        <path class="ss-fur-belly" d="M58 52C65 56 66 74 60 83C56 80 53 66 58 52Z"
          fill=${palette.belly}></path>
      </g>
      <g class="leg">
        <path class="ss-fur ss-fur-edge"
          d="M37 72C33 80 38 88 46 88C53 88 56 82 53 76C50 71 42 68 37 72Z" fill=${palette.fur}
          stroke=${palette.dark} stroke-width="1.2"></path>
        <ellipse class="ss-fur-dark" cx="54" cy="89.5" rx="7.5" ry="2.6" fill=${palette.dark}>
        </ellipse>
      </g>
      <g class="head">
        <g class="ear">
          <path class="ss-fur" d=${SQUIRREL_EAR_PATH} fill=${palette.fur}></path>
          <path class="ss-fur-belly" d=${SQUIRREL_INNER_EAR_PATH} fill=${palette.belly}></path>
        </g>
        <path class="ss-fur" d=${SQUIRREL_HEAD_PATH} fill=${palette.fur}></path>
        <g class="eye">${eyes}</g>
        <g class="cheek">${cheek}</g>
        <ellipse class="nose" cx="77.4" cy="34.8" rx="1.9" ry="1.6" fill="#3A2A25"></ellipse>
        <g class="mouth">${mouth}</g>
        ${headExtras}
        <g class="accessory accessory-${accessoryId}">${accessoryArt}</g>
        <g class="hat hat-${hatId}">${hatArt}</g>
      </g>
      <g class="arm-front">
        <line class="ss-fur-stroke" x1="60.5" y1="53" x2=${frontPaw[0]} y2=${frontPaw[1]}
          stroke=${palette.fur} stroke-width="5" stroke-linecap="round"></line>
      </g>
      ${front}
    </g>
    ${afterMotion}
  </g>`;
}

/**
 * @description Normalises the effect flags; anything missing or falsy is off.
 * @param {*} effects - The caller's effects object (may be null or undefined).
 * @returns {{singed: boolean, lipstick: boolean, redCheek: boolean, sparkle: boolean,
 *   nutBubble: boolean, chubby: boolean, catClinging: boolean, vibrate: boolean}} The flags.
 * @throws {never} Never throws.
 * @example
 *   normaliseEffects({lipstick: 1}).lipstick; // true
 * @since 1.0.0
 */
function normaliseEffects(effects) {
  const source = effects !== null && typeof effects === 'object' ? effects : {};
  return {
    singed: Boolean(source.singed),
    lipstick: Boolean(source.lipstick),
    redCheek: Boolean(source.redCheek),
    sparkle: Boolean(source.sparkle),
    nutBubble: Boolean(source.nutBubble),
    chubby: Boolean(source.chubby),
    catClinging: Boolean(source.catClinging),
    vibrate: Boolean(source.vibrate)
  };
}

/**
 * @description The tail group's extras for a fur and its effects: the highlight or rainbow
 *   stripes, golden sheen, and smoke wisps when singed.
 * @param {string} furId - A known fur id.
 * @param {{singed: boolean}} flags - The effect flags.
 * @returns {Array<*>} Templates for the tail group.
 * @throws {never} Never throws.
 * @example
 *   tailExtrasFor('golden', {singed: false});
 * @since 1.0.0
 */
function tailExtrasFor(furId, flags) {
  const showCoat = !flags.singed;
  return [
    showCoat && furId === 'rainbow' ? RAINBOW_STRIPES : TAIL_HIGHLIGHT,
    showCoat && furId === 'golden' ? TAIL_SHEEN : nothing,
    flags.singed ? SMOKE_WISPS : nothing
  ];
}

/**
 * @description Draws the racing squirrel in an outfit, pose and effects. Unknown hat, cape
 *   and accessory ids draw as 'none', an unknown fur as 'red' and an unknown pose as 'climb'.
 *   A 'victory' pose dances by hat: crown royal-wave, viking war-dance, party conga, else jig.
 *   'flag' streams the squirrel sideways from its paws, tail and cape blown out, in
 *   animations.js. The caller decides the legendary sparkle (effects.sparkle).
 * @param {Object} [options] - Outfit, pose and effects.
 * @param {string} [options.fur] - red, grey, black, cinnamon, albino, golden or rainbow.
 * @param {string} [options.hat] - A hat id from HAT_IDS.
 * @param {string} [options.cape] - A cape id from CAPE_IDS.
 * @param {string} [options.accessory] - An accessory id from ACCESSORY_IDS.
 * @param {string} [options.pose] - A pose id from SQUIRREL_POSE_IDS.
 * @param {{singed: boolean, lipstick: boolean, redCheek: boolean, sparkle: boolean,
 *   nutBubble: boolean, chubby: boolean, catClinging: boolean, vibrate: boolean}}
 *   [options.effects] - Effect flags.
 * @param {string} [options.className] - Extra classes for the root, e.g. 'ss-anim-tumble'.
 * @returns {import('lit').TemplateResult} The squirrel as a decorative <svg> (viewBox 0 0 100
 *   100), root classes 'ss-sprite ss-squirrel ss-pose-<pose> ss-fur-<fur>' plus one class per
 *   effect that animates (ss-singed, ss-legendary, ss-chubby, ss-cat-clinging, ss-vibrate).
 * @throws {never} Never throws.
 * @example
 *   const racer = squirrelSprite({fur: 'grey', hat: 'crown', pose: 'flag'});
 *   html`<div class="racer">${racer}</div>`;
 * @since 1.0.0
 */
export function squirrelSprite({
  fur = DEFAULT_FUR,
  hat = 'none',
  cape = 'none',
  accessory = 'none',
  pose = 'climb',
  effects = {},
  className = ''
} = {}) {
  const furId = pickId(FUR_PALETTES, fur, DEFAULT_FUR);
  const hatId = pickId(HAT_ART, hat, 'none');
  const capeId = pickId(CAPE_ART, cape, 'none');
  const accessoryId = pickId(ACCESSORY_ART, accessory, 'none');
  const poseId = pickId(SQUIRREL_POSES, pose, 'climb');
  const flags = normaliseEffects(effects);
  const poseSpec = SQUIRREL_POSES[poseId];
  const showCoat = !flags.singed;
  const palette = flags.singed ? SOOT_PALETTE : FUR_PALETTES[furId];
  const rootClass = classNames(
    'ss-sprite',
    'ss-squirrel',
    `ss-pose-${poseId}`,
    `ss-fur-${furId}`,
    poseId === 'victory' ? `ss-dance-${DANCE_BY_HAT[hatId] ?? 'jig'}` : '',
    flags.singed ? 'ss-singed' : '',
    flags.sparkle ? 'ss-legendary' : '',
    flags.chubby ? 'ss-chubby' : '',
    flags.catClinging ? 'ss-cat-clinging' : '',
    flags.vibrate ? 'ss-vibrate' : '',
    className
  );
  const figure = rodentFigure({
    palette,
    beforeMotion: flags.sparkle ? SPARKLE_AURA : nothing,
    afterMotion: poseId === 'fly' ? WIND_SWIRL : nothing,
    front: [
      flags.catClinging ? CAT_CLINGING : nothing,
      poseId === 'dizzy' ? DIZZY_STARS : nothing,
      flags.nutBubble ? NUT_BUBBLE : nothing
    ],
    tailExtras: tailExtrasFor(furId, flags),
    bodyExtras: showCoat && furId === 'golden' ? BODY_SHEEN : nothing,
    capeId,
    capeArt: CAPE_ART[capeId],
    backPaw: poseSpec.backPaw,
    frontPaw: poseSpec.frontPaw,
    eyes: EYE_ART[poseSpec.eyes],
    cheek: cheekArt(flags, palette),
    mouth: MOUTH_ART[flags.chubby ? 'shut' : poseSpec.mouth],
    accessoryId,
    accessoryArt: ACCESSORY_ART[accessoryId],
    hatId,
    hatArt: HAT_ART[hatId]
  });
  // A vibrating squirrel shakes inside its own rig, so pose loops and events keep running.
  const content = flags.vibrate
    ? svg`<g class="vibrate-rig">${figure}</g>${VIBRATE_LINES}`
    : figure;
  return spriteSvg({rootClass, style: furStyle(furId, flags.singed), content});
}

/** Every fur id with art, in SPEC.md § 9 order. */
export const FUR_IDS = Object.freeze(Object.keys(FUR_PALETTES));

/** Every hat id with art, in SPEC.md § 9 order ('none' first). */
export const HAT_IDS = Object.freeze(Object.keys(HAT_ART));

/** Every cape id with art, in SPEC.md § 9 order ('none' first). */
export const CAPE_IDS = Object.freeze(Object.keys(CAPE_ART));

/** Every accessory id with art, in SPEC.md § 9 order ('none' first). */
export const ACCESSORY_IDS = Object.freeze(Object.keys(ACCESSORY_ART));

/** Every squirrel pose ('climb' is the default; 'dance' and 'flag' are Chaos v2). */
export const SQUIRREL_POSE_IDS = Object.freeze(Object.keys(SQUIRREL_POSES));

/** Every squirrel effect flag accepted in the effects option. */
export const SQUIRREL_EFFECT_IDS = Object.freeze([
  'singed',
  'lipstick',
  'redCheek',
  'sparkle',
  'nutBubble',
  'chubby',
  'catClinging',
  'vibrate'
]);
