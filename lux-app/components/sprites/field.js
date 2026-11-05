import {css, html, nothing, svg} from 'lit';
import {
  SQUIRREL_EAR_PATH,
  SQUIRREL_HEAD_PATH,
  SQUIRREL_INNER_EAR_PATH,
  SQUIRREL_TAIL_PATH,
  burstPath,
  circlePath,
  classNames,
  furPalette,
  pathCommand,
  pickId,
  sparklePath,
  spriteSvg
} from './squirrel.js';
import {crowdAnimal} from './scenery.js';

/**
 * Squirrel Scramble sprite kit, sprite lane B for Chaos v2 (docs/specs/squirrel-scramble-
 * chaos-v2.md § 4, § 5): the field-wide props. The earthquake crack and mole, the flood water,
 * crowd rubber rings and the rubber duck, the disco mirror ball and lights, a hail nut, the
 * owl referee and the VAR lines, and the trench coat three squirrels hide in.
 *
 * Every export returns a decorative <svg> (aria-hidden) built by spriteSvg, except
 * rubberRingSprite, which returns a <span> stacking a ring, a crowd animal and water. All art
 * is original and PG. Colours are literal values in presentation attributes (never `var()`
 * there). Every function is pure: no DOM, no randomness, no clock. fieldAnimations holds this
 * file's keyframes, the generic stage helpers (dance-along, robot, quake, domino, hail fall)
 * and a prefers-reduced-motion rule for every animation.
 */

/** The default options object: default pose, no extra classes. */
const NO_OPTIONS = Object.freeze({});

/**
 * @description Clamps a value to a range, with a fallback for anything non-numeric.
 * @param {*} value - The candidate.
 * @param {number} minimum - Lowest allowed value.
 * @param {number} maximum - Highest allowed value.
 * @param {number} fallback - Used when the value is not a finite number.
 * @returns {number} A number between minimum and maximum.
 * @throws {never} Never throws.
 * @example
 *   clampNumber('abc', 0, 100, 25); // 25
 * @since 1.1.0
 */
function clampNumber(value, minimum, maximum, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, numeric));
}

/**
 * @description Path data through a list of points, optionally closed.
 * @param {Array<Array<number>>} points - [x, y] pairs.
 * @param {boolean} closed - Whether to close the shape.
 * @returns {string} Path data.
 * @throws {never} Never throws.
 * @example
 *   linePath([[0, 0], [10, 5]], false); // 'M0 0L10 5'
 * @since 1.1.0
 */
function linePath(points, closed) {
  const commands = points.map(([pointX, pointY], index) =>
    pathCommand(index === 0 ? 'M' : 'L', pointX, pointY)
  );
  return `${commands.join('')}${closed ? 'Z' : ''}`;
}

/**
 * @description Path data for a wavy band of water from fromX to toX, filled down to bottomY.
 *   Each half wave is halfWave units wide, so the pattern repeats every 2 x halfWave and a
 *   translation by that much loops seamlessly.
 * @param {number} fromX - Left edge.
 * @param {number} toX - Right edge.
 * @param {number} baseY - The water's surface.
 * @param {number} amplitude - Height of a crest above or below the surface.
 * @param {number} halfWave - Width of half a wave.
 * @param {number} bottomY - Where the band is filled to; pass null for the surface line only.
 * @returns {string} Path data.
 * @throws {never} Never throws.
 * @example
 *   waterPath(-40, 240, 75, 2, 20, 100);
 * @since 1.1.0
 */
function waterPath(fromX, toX, baseY, amplitude, halfWave, bottomY) {
  const filled = typeof bottomY === 'number';
  const commands = filled
    ? [pathCommand('M', fromX, bottomY), pathCommand('L', fromX, baseY)]
    : [pathCommand('M', fromX, baseY)];
  let crestUp = true;
  for (let startX = fromX; startX < toX; startX += halfWave) {
    const crestY = baseY + (crestUp ? -amplitude : amplitude);
    commands.push(pathCommand('Q', startX + halfWave / 2, crestY, startX + halfWave, baseY));
    crestUp = !crestUp;
  }
  if (filled) {
    commands.push(pathCommand('L', toX, bottomY), 'Z');
  }
  return commands.join('');
}

// ---------------------------------------------------------------------------------------------
// Earthquake: the crack in the ground strip and the mole who pops out of it.
// ---------------------------------------------------------------------------------------------

const CRACK_TOP = [
  [0, 22], [18, 18], [30, 26], [46, 16], [60, 24], [74, 14], [90, 25],
  [104, 15], [118, 23], [134, 13], [150, 24], [164, 17], [180, 25], [200, 20]
];
const CRACK_BOTTOM = [
  [200, 24], [182, 30], [164, 22], [150, 30], [132, 19], [118, 29], [104, 21],
  [90, 31], [74, 20], [60, 30], [46, 22], [30, 32], [18, 24], [0, 26]
];
const CRACK_EDGE = linePath(CRACK_TOP.map(([pointX, pointY]) => [pointX, pointY - 1.2]), false);

const CRACK_CONTENT = svg`
  <g class="crack-body">
    <path d=${linePath([...CRACK_TOP, ...CRACK_BOTTOM], true)} fill="#2B1B14"></path>
    <path d=${CRACK_EDGE} fill="none" stroke="#A1887F" stroke-width="1.2"
      stroke-linejoin="round" opacity="0.8"></path>
  </g>
  <circle class="crack-pebble pebble-1" cx="40" cy="14" r="2.2" fill="#795548"></circle>
  <circle class="crack-pebble pebble-2" cx="96" cy="11" r="1.8" fill="#8D6E63"></circle>
  <circle class="crack-pebble pebble-3" cx="150" cy="12" r="2" fill="#6D4C41"></circle>`;

/**
 * @description Draws the jagged crack the earthquake opens across the ground strip, with
 *   pebbles hopping out. viewBox 0 0 200 40, stretched to fill its box (preserveAspectRatio
 *   none); it opens once (--ss-oneshot-count).
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The crack <svg>, root 'ss-sprite ss-crack'.
 * @throws {never} Never throws.
 * @example
 *   crackSprite();
 * @since 1.1.0
 */
export function crackSprite({className = ''} = NO_OPTIONS) {
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-crack', className),
    viewBox: '0 0 200 40',
    preserveAspectRatio: 'none',
    content: CRACK_CONTENT
  });
}

const MOLE_CONTENT = svg`
  <g class="mole-body">
    <path d="M30 100C30 62 38 42 50 42C62 42 70 62 70 100Z" fill="#5D4E4A"></path>
    <path d="M40 61C43 51 57 51 60 61C57 68 43 68 40 61Z" fill="#7A6862"></path>
    <path d="M42.5 56.4Q44.5 55 46.5 56.4M53.5 56.4Q55.5 55 57.5 56.4" fill="none"
      stroke="#1A1A1A" stroke-width="1" stroke-linecap="round"></path>
    <path d=${circlePath(44.5, 56, 4.2) + circlePath(55.5, 56, 4.2)} fill="#E3F2FD"
      fill-opacity="0.35" stroke="#37474F" stroke-width="1.2"></path>
    <path d="M48.7 56H51.3" stroke="#37474F" stroke-width="1.2"></path>
    <path d="M44 66L34 64M44 68L34 70M56 66L66 64M56 68L66 70" stroke="#3E2723"
      stroke-width="0.6" stroke-linecap="round"></path>
    <g class="mole-nose"><path d=${burstPath(50, 65, 4.6, 2.2, 8)} fill="#F48FB1"></path></g>
  </g>
  <path d="M8 100C12 84 30 77 50 81C70 77 88 84 92 100Z" fill="#6D4C41"></path>
  <path d=${circlePath(24, 86, 3) + circlePath(74, 85, 3.4) + circlePath(50, 83, 2.4)}
    fill="#5D4037"></path>
  <g class="mole-paws">
    <path d="M28 82C28 78 42 78 42 82C42 86 28 86 28 82ZM58 82C58 78 72 78 72 82C72 86 58 86 58 82Z"
      fill="#F8BBD0"></path>
    <path d="M30 80l-2-3M33 79l-1-3.4M36 79v-3.4M70 80l2-3M67 79l1-3.4M64 79v-3.4" fill="none"
      stroke="#EC407A" stroke-width="0.8" stroke-linecap="round"></path>
  </g>
  <g class="mole-dirt">
    <circle class="dirt dirt-1" cx="28" cy="70" r="2" fill="#795548"></circle>
    <circle class="dirt dirt-2" cx="72" cy="68" r="1.6" fill="#795548"></circle>
    <circle class="dirt dirt-3" cx="60" cy="74" r="1.3" fill="#6D4C41"></circle>
  </g>`;

/**
 * @description Draws a short-sighted star-nosed mole in round spectacles popping out of a
 *   mound of earth (the earthquake's silly detail). It pops once, then sniffs.
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The mole <svg>, root 'ss-sprite ss-mole-pop'.
 * @throws {never} Never throws.
 * @example
 *   molePopSprite();
 * @since 1.1.0
 */
export function molePopSprite({className = ''} = NO_OPTIONS) {
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-mole-pop', className),
    content: MOLE_CONTENT
  });
}

// ---------------------------------------------------------------------------------------------
// Flood: the water, the crowd's rubber rings and the rubber duck.
// ---------------------------------------------------------------------------------------------

/**
 * @description Draws the flood water rising from the bottom of its box, with drifting waves
 *   and bubbles. viewBox 0 0 200 100, stretched to fill (preserveAspectRatio none), so a box
 *   that spans the climb height takes the plan's waterHeightUnits directly as the level.
 * @param {Object} [options] - Level and classes.
 * @param {number} [options.level] - Waterline height, 0 to 100 percent of the box (default 25).
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The water <svg>, root 'ss-sprite ss-flood-water'.
 * @throws {never} Never throws.
 * @example
 *   floodWaterSprite({level: 20});
 * @since 1.1.0
 */
export function floodWaterSprite({level = 25, className = ''} = NO_OPTIONS) {
  const waterLevel = clampNumber(level, 0, 100, 25);
  const surfaceY = 100 - waterLevel;
  const bubbleY = Math.min(96, surfaceY + waterLevel * 0.55);
  const content = svg`<g class="flood-rig">
    <g class="wave-back">
      <path d=${waterPath(-40, 240, surfaceY - 2, 2, 20, 100)} fill="#4FC3F7" opacity="0.5">
      </path>
    </g>
    <g class="wave-front">
      <path d=${waterPath(-40, 240, surfaceY, 2.4, 20, 100)} fill="#0288D1" opacity="0.45">
      </path>
      <path d=${waterPath(-40, 240, surfaceY, 2.4, 20, null)} fill="none" stroke="#E1F5FE"
        stroke-width="1.2" stroke-linecap="round" opacity="0.8"></path>
    </g>
    <circle class="bubble bubble-1" cx="30" cy=${bubbleY} r="1.6" fill="none" stroke="#FFFFFF"
      stroke-width="0.7" opacity="0.7"></circle>
    <circle class="bubble bubble-2" cx="82" cy=${bubbleY} r="1.2" fill="none" stroke="#FFFFFF"
      stroke-width="0.7" opacity="0.7"></circle>
    <circle class="bubble bubble-3" cx="128" cy=${bubbleY} r="1.8" fill="none" stroke="#FFFFFF"
      stroke-width="0.7" opacity="0.7"></circle>
    <circle class="bubble bubble-4" cx="172" cy=${bubbleY} r="1.3" fill="none" stroke="#FFFFFF"
      stroke-width="0.7" opacity="0.7"></circle>
  </g>`;
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-flood-water', className),
    viewBox: '0 0 200 100',
    preserveAspectRatio: 'none',
    content
  });
}

const RING_ARC_BACK = 'M20 76A30 9 0 0 1 80 76';
const RING_ARC_FRONT = 'M20 76A30 9 0 0 0 80 76';

const RING_BACK = svg`
  <path d=${RING_ARC_BACK} fill="none" stroke="#E53935" stroke-width="8"></path>
  <path d=${RING_ARC_BACK} fill="none" stroke="#FAFAFA" stroke-width="8" stroke-dasharray="9 9">
  </path>`;

const RING_FRONT = svg`
  <path d=${RING_ARC_FRONT} fill="none" stroke="#E53935" stroke-width="8"></path>
  <path d=${RING_ARC_FRONT} fill="none" stroke="#FAFAFA" stroke-width="8" stroke-dasharray="9 9"
    stroke-dashoffset="4.5"></path>
  <path d="M27 79A24 6 0 0 0 46 84.4" fill="none" stroke="#FFFFFF" stroke-width="1.4"
    stroke-linecap="round" opacity="0.7"></path>`;

const RING_WATER = svg`
  <path d=${waterPath(0, 100, 84, 1.6, 10, 100)} fill="#4FC3F7" opacity="0.55"></path>
  <path d="M6 88q5-2.4 10 0M84 90q5-2.4 10 0" fill="none" stroke="#FFFFFF" stroke-width="1"
    stroke-linecap="round" opacity="0.8"></path>`;

/**
 * @description Draws a woodland crowd animal bobbing in a striped rubber ring on the flood:
 *   the ring's back, the animal (crowdAnimal from scenery.js), the ring's front and a band of
 *   water, stacked in a <span>. The ring and the animal bob together; the water stays put.
 * @param {string} [kind] - 'hedgehog' (default), 'rabbit', 'owl', 'badger' or 'fox'.
 * @param {string} [pose] - The animal's pose: 'idle' (default), 'wave' or 'gasp'.
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra classes for the wrapper.
 * @returns {import('lit').TemplateResult} A <span class="ss-rubber-ring"> holding four
 *   decorative <svg> layers.
 * @throws {never} Never throws.
 * @example
 *   rubberRingSprite('badger', 'gasp');
 * @since 1.1.0
 */
export function rubberRingSprite(kind = 'hedgehog', pose = 'idle', {className = ''} = NO_OPTIONS) {
  return html`<span class=${classNames('ss-rubber-ring', className)}>
    ${spriteSvg({rootClass: 'ss-sprite ss-ring-back', content: RING_BACK})}
    ${crowdAnimal(kind, pose)}
    ${spriteSvg({rootClass: 'ss-sprite ss-ring-front', content: RING_FRONT})}
    ${spriteSvg({rootClass: 'ss-sprite ss-ring-water', content: RING_WATER})}
  </span>`;
}

const DUCK_CONTENT = svg`
  <g class="duck-rig">
    <path d="M14 58L6 50L18 54Z" fill="#FFD54F"></path>
    <path d="M14 62C14 50 30 46 46 50C60 52 78 54 82 64C86 74 74 84 50 84C26 84 14 76 14 62Z"
      fill="#FFD54F"></path>
    <circle cx="70" cy="38" r="15" fill="#FFD54F"></circle>
    <ellipse cx="63" cy="29" rx="5" ry="2" fill="#FFFFFF" opacity="0.45"></ellipse>
    <path d="M83 40C92 39 97 42 95 45.5C92.5 48.5 86 48 82.5 46Z" fill="#FF8F00"></path>
    <path d="M83.5 43.6C88 44.2 92 44.6 95 44.8" fill="none" stroke="#E65100"
      stroke-width="0.7"></path>
    <circle cx="73" cy="34" r="2.4" fill="#1A1A1A"></circle>
    <circle cx="73.8" cy="33.2" r="0.8" fill="#FFFFFF"></circle>
    <path d="M30 60C36 52 52 54 56 62C50 67 38 68 30 60Z" fill="#FFCA28"></path>
    <circle cx="44" cy="72" r="6" fill="#FFFFFF" stroke="#1E88E5" stroke-width="1"></circle>
    <text x="44" y="72" dy="0.35em" text-anchor="middle" font-family="system-ui, sans-serif"
      font-size="8" font-weight="800" fill="#1E88E5">7</text>
  </g>
  <path d=${waterPath(0, 100, 80, 1.6, 10, 100)} fill="#4FC3F7" opacity="0.55"></path>
  <path d="M6 86q6-3 12 0M80 88q6-3 12 0" fill="none" stroke="#FFFFFF" stroke-width="1"
    stroke-linecap="round" opacity="0.8"></path>`;

/**
 * @description Draws a lone rubber duck bobbing across the flood, wearing a race-number
 *   sticker (a duck-race cameo). The stage floats it across; the sprite only bobs.
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The duck <svg>, root 'ss-sprite ss-rubber-duck'.
 * @throws {never} Never throws.
 * @example
 *   rubberDuckSprite();
 * @since 1.1.0
 */
export function rubberDuckSprite({className = ''} = NO_OPTIONS) {
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-rubber-duck', className),
    content: DUCK_CONTENT
  });
}

// ---------------------------------------------------------------------------------------------
// Disco: the mirror ball and the lights.
// ---------------------------------------------------------------------------------------------

const FACET_COLOURS = ['#ECEFF1', '#CFD8DC', '#90A4AE', '#FFFFFF'];

/**
 * @description The mirror ball's square facets, grouped into four colour sets that glint in
 *   turn. Only squares whose centres sit inside the ball are kept.
 * @returns {Array<string>} Four path-data strings, one per colour set.
 * @throws {never} Never throws.
 * @example
 *   facetPaths().length; // 4
 * @since 1.1.0
 */
function facetPaths() {
  const groups = [[], [], [], []];
  let row = 0;
  for (let top = 32; top < 88; top += 7) {
    let column = 0;
    for (let left = 22; left < 78; left += 7) {
      if (Math.hypot(left + 3 - 50, top + 3 - 60) <= 21.5) {
        groups[(row * 3 + column) % 4].push(`${pathCommand('M', left, top)}h6v6h-6Z`);
      }
      column += 1;
    }
    row += 1;
  }
  return groups.map(group => group.join(''));
}

const MIRROR_BALL_CONTENT = svg`<g class="ball-rig">
  <path d="M50 0V31" fill="none" stroke="#9E9E9E" stroke-width="1.6" stroke-dasharray="2 1.4">
  </path>
  <rect x="46" y="30" width="8" height="6" rx="1" fill="#757575"></rect>
  <circle cx="50" cy="60" r="25" fill="#78909C"></circle>
  ${facetPaths().map(
    (facets, index) => svg`<path class="facet facet-${index + 1}" d=${facets}
      fill=${FACET_COLOURS[index]}></path>`
  )}
  <ellipse class="ball-shine" cx="40" cy="48" rx="7" ry="5" fill="#FFFFFF" opacity="0.65">
  </ellipse>
  <path class="ball-sparkle sparkle-a" d=${sparklePath(24, 40, 4)} fill="#FFFFFF"></path>
  <path class="ball-sparkle sparkle-b" d=${sparklePath(78, 52, 3.4)} fill="#FFFFFF"></path>
  <path class="ball-sparkle sparkle-c" d=${sparklePath(60, 84, 3)} fill="#FFFFFF"></path>
</g>`;

/**
 * @description Draws the disco mirror ball on its chain. It drops in once, then sways while
 *   its facets glint and its sparkles twinkle.
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The ball <svg>, root 'ss-sprite ss-mirror-ball'.
 * @throws {never} Never throws.
 * @example
 *   mirrorBallSprite();
 * @since 1.1.0
 */
export function mirrorBallSprite({className = ''} = NO_OPTIONS) {
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-mirror-ball', className),
    content: MIRROR_BALL_CONTENT
  });
}

const DISCO_LIGHTS_CONTENT = svg`
  <rect class="disco-wash" width="160" height="90" fill="#7B1FA2" opacity="0.28"></rect>
  <g class="disco-beam beam-1">
    <path d="M80 -4L46 94H66Z" fill="#FF4081" opacity="0.32"></path>
  </g>
  <g class="disco-beam beam-2">
    <path d="M80 -4L94 94H114Z" fill="#18FFFF" opacity="0.3"></path>
  </g>
  <g class="disco-beam beam-3">
    <path d="M80 -4L18 94H34Z" fill="#FFFF00" opacity="0.26"></path>
  </g>
  <g class="disco-beam beam-4">
    <path d="M80 -4L126 94H144Z" fill="#76FF03" opacity="0.26"></path>
  </g>
  <ellipse class="disco-spot spot-1" cx="30" cy="84" rx="9" ry="3" fill="#FF4081" opacity="0.45">
  </ellipse>
  <ellipse class="disco-spot spot-2" cx="80" cy="86" rx="10" ry="3" fill="#18FFFF" opacity="0.4">
  </ellipse>
  <ellipse class="disco-spot spot-3" cx="128" cy="84" rx="9" ry="3" fill="#FFFF00" opacity="0.4">
  </ellipse>`;

/**
 * @description Draws the disco lighting for the whole field: a purple wash, four coloured
 *   beams sweeping from the top centre and spots gliding on the floor. viewBox 0 0 160 90,
 *   sliced to cover its box. Beams sweep; nothing flashes.
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The lights <svg>, root 'ss-sprite ss-disco-lights'.
 * @throws {never} Never throws.
 * @example
 *   discoLightsSprite();
 * @since 1.1.0
 */
export function discoLightsSprite({className = ''} = NO_OPTIONS) {
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-disco-lights', className),
    viewBox: '0 0 160 90',
    preserveAspectRatio: 'xMidYMid slice',
    content: DISCO_LIGHTS_CONTENT
  });
}

// ---------------------------------------------------------------------------------------------
// Acorn hail.
// ---------------------------------------------------------------------------------------------

const HAIL_NUT_CONTENT = svg`
  <path class="hail-streaks" d="M40 6L46 30M52 2L56 24M62 8L64 28" fill="none" stroke="#B0BEC5"
    stroke-width="2" stroke-linecap="round" opacity="0.7"></path>
  <g class="hail-nut">
    <path d="M50 38C66 38 72 56 64 72C60 80 54 86 50 88C46 86 40 80 36 72C28 56 34 38 50 38Z"
      fill="#A1662F"></path>
    <path d="M32 46C32 34 68 34 68 46C62 50 38 50 32 46Z" fill="#6D4C41"></path>
    <path d="M38 40L44 46M46 38L52 46M54 38L60 46M62 40L66 44M36 44L42 38M44 46L50 38M52 46L58 38"
      fill="none" stroke="#4E342E" stroke-width="0.7"></path>
    <path d="M50 36q2-6 6-8" fill="none" stroke="#4E342E" stroke-width="2.4" stroke-linecap="round">
    </path>
    <ellipse cx="44" cy="60" rx="3" ry="7" fill="#FFFFFF" opacity="0.35"></ellipse>
  </g>`;

/**
 * @description Draws one acorn hailstone tumbling down with speed streaks. Add
 *   'ss-anim-hail-fall' (with --ss-hail-delay, --ss-hail-fall) to drop it.
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes, e.g. 'ss-anim-hail-fall'.
 * @returns {import('lit').TemplateResult} The nut <svg>, root 'ss-sprite ss-hail-nut'.
 * @throws {never} Never throws.
 * @example
 *   hailNutSprite({className: 'ss-anim-hail-fall'});
 * @since 1.1.0
 */
export function hailNutSprite({className = ''} = NO_OPTIONS) {
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-hail-nut', className),
    content: HAIL_NUT_CONTENT
  });
}

// ---------------------------------------------------------------------------------------------
// VAR: the owl referee and the lines.
// ---------------------------------------------------------------------------------------------

const OWL_WING = '#6D4C41';

const OWL_LANYARD = svg`
  <path d="M43 51Q50 60 57 51" fill="none" stroke="#212121" stroke-width="0.6"></path>
  <rect x="47.5" y="57" width="5" height="2.6" rx="1" fill="#CFD8DC" stroke="#78909C"
    stroke-width="0.4"></rect>`;

const OWL_HIP_WING = svg`<path d="M30 58C24 64 24 76 30 82C32 76 32 66 34 60Z" fill=${OWL_WING}>
</path>`;

// Per pose: the pupils or lids, the wings and any prop.
const OWL_POSES = {
  whistle: {
    eyes: svg`<path d="M39 33q4-3 8 0M53 33q4-3 8 0" fill="none" stroke="#3E2723"
      stroke-width="1.4" stroke-linecap="round"></path>`,
    extras: svg`
      <path d="M30 58C24 50 30 42 44 43C46 45 45 47 43 47C38 47 34 52 34 58Z" fill=${OWL_WING}>
      </path>
      <rect x="47" y="43" width="9" height="4" rx="1.4" fill="#CFD8DC" stroke="#78909C"
        stroke-width="0.6"></rect>
      <circle cx="57" cy="45" r="2.6" fill="#CFD8DC" stroke="#78909C" stroke-width="0.6"></circle>
      <path d="M70 58C76 64 76 76 70 82C68 76 68 66 66 60Z" fill=${OWL_WING}></path>
      <path class="whistle-lines" d="M64 38q4-2 8 0M66 44q5 0 9 2M64 50q4 2 7 5" fill="none"
        stroke="#424242" stroke-width="1.1" stroke-linecap="round"></path>`
  },
  monitor: {
    eyes: svg`<path d=${circlePath(45, 33, 2.2) + circlePath(59, 33, 2.2)} fill="#1A1A1A">
    </path>`,
    extras: svg`
      ${OWL_HIP_WING}
      ${OWL_LANYARD}
      <path d="M84 96V72" stroke="#455A64" stroke-width="1.6"></path>
      <rect x="76" y="60" width="16" height="12" rx="1.5" fill="#263238"></rect>
      <g class="monitor-screen">
        <rect x="78" y="62" width="12" height="8" fill="#4CAF50"></rect>
        <path d="M80 70L87 62" stroke="#FFFFFF" stroke-width="0.7"></path>
        <circle cx="84.5" cy="66" r="1" fill="#C8642F"></circle>
      </g>
      <path d="M70 58C78 56 82 58 80 62C76 62 72 64 70 66Z" fill=${OWL_WING}></path>`
  },
  card: {
    eyes: svg`
      <path d=${circlePath(43, 33, 2.2) + circlePath(57, 33, 2.2)} fill="#1A1A1A"></path>
      <path d="M37 25L47 28M63 25L53 28" fill="none" stroke="#3E2723" stroke-width="1.6"
        stroke-linecap="round"></path>`,
    extras: svg`
      ${OWL_HIP_WING}
      ${OWL_LANYARD}
      <path d="M70 56C76 46 78 34 76 24C72 30 70 40 66 52Z" fill=${OWL_WING}></path>
      <g class="ref-card">
        <rect x="70" y="8" width="13" height="18" rx="1.6" fill="#FFEB3B" stroke="#F9A825"
          stroke-width="0.8"></rect>
        <path d="M73.6 15.6C73.8 13.2 79.2 13.2 79.4 15.6Z" fill="#6D4C41"></path>
        <path d="M74 15.6C74 20 79 20 79 15.6Z" fill="#A1662F"></path>
      </g>`
  }
};

/**
 * @description Draws the owl referee in a striped shirt for the VAR parody: 'whistle' (blowing
 *   hard), 'monitor' (peering at a tiny pitch-side monitor, the silly detail) or 'card'
 *   (holding up a yellow card with an acorn on it). Unknown poses draw as 'whistle'.
 * @param {Object} [options] - Pose and classes.
 * @param {string} [options.pose] - 'whistle' (default), 'monitor' or 'card'.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The referee <svg>, root 'ss-sprite ss-owl-referee
 *   ss-pose-<pose>'.
 * @throws {never} Never throws.
 * @example
 *   owlRefereeSprite({pose: 'monitor'});
 * @since 1.1.0
 */
export function owlRefereeSprite({pose = 'whistle', className = ''} = NO_OPTIONS) {
  const poseId = pickId(OWL_POSES, pose, 'whistle');
  const poseSpec = OWL_POSES[poseId];
  const content = svg`<g class="ss-motion">
    <path d="M40 92l-3 4M42 92v5M44 92l3 4M56 92l-3 4M58 92v5M60 92l3 4" fill="none"
      stroke="#FFA000" stroke-width="1.6" stroke-linecap="round"></path>
    <ellipse cx="50" cy="68" rx="22" ry="24" fill="#8D6E63"></ellipse>
    <path d="M30 56C34 48 66 48 70 56L72 82C64 92 36 92 28 82Z" fill="#FAFAFA"></path>
    <path d="M35 54H39V87H35ZM43 52H47V89H43ZM51 52H55V89H51ZM59 54H63V87H59Z" fill="#212121">
    </path>
    <path d="M44 50L50 57L56 50Z" fill="#212121"></path>
    <g class="owl-head">
      <path d="M34 26L35 12L44 22ZM66 26L65 12L56 22Z" fill=${OWL_WING}></path>
      <circle cx="50" cy="34" r="18" fill="#8D6E63"></circle>
      <path d=${circlePath(43, 33, 8) + circlePath(57, 33, 8)} fill="#D7CCC8"></path>
      <path d=${circlePath(43, 33, 4.8) + circlePath(57, 33, 4.8)} fill="#FFA726"></path>
      ${poseSpec.eyes}
      <path d="M50 37L47 41.5L50 44L53 41.5Z" fill="#FFB300"></path>
    </g>
    ${poseSpec.extras}
  </g>`;
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-owl-referee', `ss-pose-${poseId}`, className),
    content
  });
}

const VAR_GRID = [
  'M20 0V90M40 0V90M60 0V90M80 0V90M100 0V90M120 0V90M140 0V90',
  'M0 18H160M0 36H160M0 54H160M0 72H160'
].join('');

const VAR_LINES_CONTENT = svg`
  <path class="var-grid" d=${VAR_GRID} fill="none" stroke="#FFFFFF" stroke-width="0.4"
    stroke-dasharray="2 3" opacity="0.35"></path>
  <g class="var-line var-line-a">
    <path d="M18 90L58 0" stroke="#E53935" stroke-width="1.6"></path>
  </g>
  <g class="var-line var-line-b">
    <path d="M34 90L74 0" stroke="#2979FF" stroke-width="1.6"></path>
  </g>
  <g class="var-target target-1">
    <circle cx="46" cy="27" r="5" fill="none" stroke="#FFEB3B" stroke-width="1"></circle>
    <path d="M46 20V34M39 27H53" stroke="#FFEB3B" stroke-width="0.6"></path>
  </g>
  <g class="var-target target-2">
    <circle cx="112" cy="58" r="5" fill="none" stroke="#FFEB3B" stroke-width="1"></circle>
    <path d="M112 51V65M105 58H119" stroke="#FFEB3B" stroke-width="0.6"></path>
  </g>
  <rect class="var-scan" width="5" height="90" fill="#FFFFFF" opacity="0.2"></rect>`;

/**
 * @description Draws the VAR overlay: a dashed grid, a red and a blue offside-style line that
 *   draw themselves in, two pulsing targets and a scanning bar. No text: the stage writes
 *   "CHECKING POSSIBLE NUT INFRINGEMENT…" in HTML. viewBox 0 0 160 90, stretched to fill.
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The overlay <svg>, root 'ss-sprite ss-var-lines'.
 * @throws {never} Never throws.
 * @example
 *   varLinesSprite();
 * @since 1.1.0
 */
export function varLinesSprite({className = ''} = NO_OPTIONS) {
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-var-lines', className),
    viewBox: '0 0 160 90',
    preserveAspectRatio: 'none',
    content: VAR_LINES_CONTENT
  });
}

// ---------------------------------------------------------------------------------------------
// The trench coat: three squirrels pretending to be one very tall one.
// ---------------------------------------------------------------------------------------------

/**
 * @description The coats (palettes) of the squirrels stacked in the trench coat, top first.
 * @param {number|Array<string>} heads - A count (2 to 4) or a list of fur ids, top first.
 * @param {string} fur - The fur for every squirrel when heads is a count.
 * @returns {Array<{fur: string, dark: string, belly: string}>} Two to four palettes.
 * @throws {never} Never throws.
 * @example
 *   stackPalettes(['red', 'grey', 'black'], 'red').length; // 3
 * @since 1.1.0
 */
function stackPalettes(heads, fur) {
  if (Array.isArray(heads) && heads.length > 0) {
    const furs = heads.slice(0, 4);
    const padded = furs.length > 1 ? furs : [...furs, furs[0]];
    return padded.map(furId => furPalette(furId));
  }
  const count = Math.min(4, Math.max(2, Number.parseInt(heads, 10) || 3));
  return Array.from({length: count}, () => furPalette(fur));
}

/**
 * @description Too many squirrel feet poking out under the coat's hem, two per squirrel
 *   (at most six), each pair in its owner's dark fur.
 * @param {Array<{dark: string}>} palettes - The stacked squirrels, top first.
 * @returns {Array<import('lit').SVGTemplateResult>} The feet.
 * @throws {never} Never throws.
 * @example
 *   coatFeet([furPalette('red'), furPalette('grey')]);
 * @since 1.1.0
 */
function coatFeet(palettes) {
  const footCount = Math.min(6, palettes.length * 2);
  const spacing = footCount > 1 ? 48 / (footCount - 1) : 0;
  return Array.from({length: footCount}, (_unused, index) => {
    const owner = palettes[Math.min(palettes.length - 1, Math.floor(index / 2))];
    return svg`<ellipse cx=${26 + index * spacing} cy="192" rx="5.6" ry="2.6"
      fill=${owner.dark}></ellipse>`;
  });
}

/**
 * @description A pair of eyes peeking out of a gap in the coat.
 * @param {number} peekNumber - 1 or 2, for the class peek-<n>.
 * @param {number} centreY - Height of the gap.
 * @returns {import('lit').SVGTemplateResult} The peeking eyes.
 * @throws {never} Never throws.
 * @example
 *   coatPeek(1, 108);
 * @since 1.1.0
 */
function coatPeek(peekNumber, centreY) {
  return svg`<g class="coat-peek peek-${peekNumber}">
    <ellipse cx="50" cy=${centreY} rx="8" ry="3.4" fill="#3E2723"></ellipse>
    <path d=${circlePath(47, centreY, 1.6) + circlePath(53, centreY, 1.6)} fill="#FFFFFF"></path>
    <path d=${circlePath(47.6, centreY, 0.7) + circlePath(53.6, centreY, 0.7)} fill="#1B1B1B">
    </path>
  </g>`;
}

/**
 * @description Draws the trench-coat disguise: a tall khaki coat with the top squirrel's head
 *   out of the collar under a fedora and a very fake moustache on an elastic, the middle
 *   squirrel's paws working the sleeves, eyes peeking between the buttons, a tail out of the
 *   back and far too many feet under the hem. viewBox 0 0 100 200 (twice a squirrel's height),
 *   anchored at the bottom. It teeters.
 * @param {Object} [options] - The stack and classes.
 * @param {number|Array<string>} [options.heads] - How many squirrels hide inside (2 to 4,
 *   default 3), or their fur ids top first, e.g. ['red', 'grey', 'black'].
 * @param {string} [options.fur] - Fur for every squirrel when heads is a count (default red).
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The coat <svg>, root 'ss-sprite ss-trench-coat'.
 * @throws {never} Never throws.
 * @example
 *   trenchCoatSprite({heads: ['cinnamon', 'grey', 'albino']});
 * @since 1.1.0
 */
export function trenchCoatSprite({heads = 3, fur = 'red', className = ''} = NO_OPTIONS) {
  const palettes = stackPalettes(heads, fur);
  const top = palettes[0];
  const arms = palettes[1];
  const tail = palettes[palettes.length - 1];
  const content = svg`<g class="coat-rig">
    <g transform="translate(-6 108) scale(0.9)">
      <path class="coat-tail" d=${SQUIRREL_TAIL_PATH} fill=${tail.fur}></path>
    </g>
    <g class="coat-feet">${coatFeet(palettes)}</g>
    <path d="M28 70C26 62 34 56 50 56C66 56 74 62 72 70L80 186C66 192 34 192 20 186Z"
      fill="#C8A165" stroke="#8D6E3F" stroke-width="0.8"></path>
    <path d="M38 58L50 94L62 58L56 57L50 80L44 57Z" fill="#B08A50"></path>
    <path d="M23.6 118H76.4L76.9 125H23.1Z" fill="#8D6E3F"></path>
    <rect x="46" y="117" width="8" height="9" rx="1" fill="none" stroke="#5D4037"
      stroke-width="1.4"></rect>
    <path d=${circlePath(44, 100, 1.8) + circlePath(56, 100, 1.8) + circlePath(44, 140, 1.8) +
      circlePath(56, 140, 1.8)} fill="#5D4037"></path>
    ${coatPeek(1, 108)}
    ${palettes.length > 2 ? coatPeek(2, 156) : nothing}
    <path d="M30 64C24 80 22 108 22 130L30 132C31 110 33 86 38 70Z" fill="#BF9758"></path>
    <path d="M70 64C76 80 78 108 78 130L70 132C69 110 67 86 62 70Z" fill="#BF9758"></path>
    <path d=${circlePath(26, 134, 3.6) + circlePath(74, 134, 3.6)} fill=${arms.fur}></path>
    <path d="M34 60C38 52 44 50 50 54C56 50 62 52 66 60L60 62C56 58 44 58 40 62Z"
      fill="#B08A50"></path>
    <g transform="translate(-14 16)">
      <path d=${SQUIRREL_EAR_PATH} fill=${top.fur}></path>
      <path d=${SQUIRREL_INNER_EAR_PATH} fill=${top.belly}></path>
      <path d=${SQUIRREL_HEAD_PATH} fill=${top.fur}></path>
      <ellipse cx="64.5" cy="30.5" rx="3.4" ry="4" fill="#FFFFFF"></ellipse>
      <circle cx="63.3" cy="31" r="2.1" fill="#1B1B1B"></circle>
      <path d="M61 25.6L68 24.6" fill="none" stroke="#2B1D16" stroke-width="1"
        stroke-linecap="round"></path>
      <ellipse cx="77.4" cy="34.8" rx="1.9" ry="1.6" fill="#3A2A25"></ellipse>
      <path d="M66 41C60 40 54 37 51 33" fill="none" stroke="#D7CCC8" stroke-width="0.5"></path>
      <path class="fake-moustache" d="M78 38.6C74.5 37 70 37.8 67.5 40.6C66.6 41.6 64.6 41.4 64 40
        C64.2 43.6 68.6 44.2 71.4 42C73.6 40.6 76 40.4 78 40.6Z" fill="#1A1A1A"></path>
      <path d="M50 22.5C50 12 54 8.5 61 8.5C68 8.5 72 12 72 22.5Z" fill="#5D4037"></path>
      <path d="M57 10C59 12.5 63 12.5 65 10" fill="none" stroke="#4E342E" stroke-width="0.8">
      </path>
      <path d="M50.2 19.5H71.8V22.5H50.2Z" fill="#212121"></path>
      <path d="M44 23.5C48 20.5 74 20.5 78 23.5C74 25.5 48 25.5 44 23.5Z" fill="#4E342E"></path>
    </g>
  </g>`;
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-trench-coat', className),
    viewBox: '0 0 100 200',
    preserveAspectRatio: 'xMidYMax meet',
    content
  });
}

/** Every owl referee pose ('whistle' is the default). */
export const OWL_REFEREE_POSE_IDS = Object.freeze(Object.keys(OWL_POSES));

/** Every sprite function this file exports, by name, for catalogues and the wardrobe. */
export const FIELD_SPRITE_NAMES = Object.freeze([
  'crackSprite',
  'molePopSprite',
  'floodWaterSprite',
  'rubberRingSprite',
  'rubberDuckSprite',
  'mirrorBallSprite',
  'discoLightsSprite',
  'hailNutSprite',
  'owlRefereeSprite',
  'varLinesSprite',
  'trenchCoatSprite'
]);

/**
 * The field sprites' keyframes and classes, plus the generic stage helpers for Chaos v2:
 * ss-anim-dance-along (anyone joins the disco), ss-anim-robot (the beaver), ss-anim-quake
 * (an element shakes), ss-anim-domino (a crowd animal falls over; stagger with
 * --ss-crowd-delay) and ss-anim-hail-fall. One-shots honour --ss-oneshot-count. Every
 * animation has a reduced-motion rule: shakes and sweeps stop, events leave a still frame.
 */
export const fieldAnimations = css`
  .ss-sprite.ss-flood-water,
  .ss-sprite.ss-disco-lights,
  .ss-sprite.ss-var-lines {
    overflow: hidden;
  }

  .ss-rubber-ring {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
  }

  .ss-rubber-ring > .ss-sprite {
    position: absolute;
    inset: 0;
  }

  /* Pivots: SVG parts turn about 0 0 unless told otherwise. */
  .ss-sprite
    :is(
      .crack-body,
      .crack-pebble,
      .mole-nose,
      .dirt,
      .bubble,
      .facet,
      .ball-sparkle,
      .hail-nut,
      .var-target,
      .coat-peek,
      .fake-moustache,
      .monitor-screen,
      .ref-card,
      .whistle-lines
    ) {
    transform-box: fill-box;
    transform-origin: center;
  }

  .ss-sprite :is(.mole-body, .mole-paws, .duck-rig, .owl-head, .coat-rig, .flood-rig, .var-line) {
    transform-box: fill-box;
    transform-origin: 50% 100%;
  }

  .ss-mirror-ball .ball-rig {
    transform-origin: 50px 0;
  }

  .ss-disco-lights .disco-beam {
    transform-origin: 80px -4px;
  }

  .ss-owl-referee .ss-motion {
    transform-origin: 50px 96px;
  }

  /* Earthquake. */
  .ss-crack .crack-body {
    animation: ss-crack-open var(--ss-crack-duration, 500ms)
      var(--ease-enter, cubic-bezier(0.21, 0.64, 0.52, 1)) var(--ss-oneshot-count, 1) both;
  }

  .ss-crack .crack-pebble {
    animation: ss-pebble-hop var(--ss-pebble-duration, 700ms) ease-out infinite;
  }

  .ss-crack .crack-pebble.pebble-2 {
    animation-delay: calc(var(--ss-pebble-duration, 700ms) / -3);
  }

  .ss-crack .crack-pebble.pebble-3 {
    animation-delay: calc(var(--ss-pebble-duration, 700ms) / -1.5);
  }

  .ss-mole-pop :is(.mole-body, .mole-paws) {
    animation: ss-mole-pop var(--ss-mole-pop-duration, 600ms)
      var(--ease-light-bounce, cubic-bezier(0.3, 1.41, 0.4, 0.99)) var(--ss-oneshot-count, 1)
      both;
  }

  .ss-mole-pop .mole-nose {
    animation: ss-sniff var(--ss-sniff-duration, 500ms) ease-in-out infinite;
  }

  .ss-mole-pop .dirt {
    animation:
      ss-dirt-fly var(--ss-dirt-duration, 900ms) ease-out infinite,
      ss-field-fade-out var(--ss-dirt-duration, 900ms) linear infinite;
  }

  .ss-mole-pop .dirt.dirt-2 {
    animation-delay: calc(var(--ss-dirt-duration, 900ms) / -3);
  }

  .ss-mole-pop .dirt.dirt-3 {
    animation-delay: calc(var(--ss-dirt-duration, 900ms) / -1.5);
  }

  /* Flood. */
  .ss-flood-water .flood-rig {
    animation: ss-flood-rise var(--ss-flood-rise-duration, 2000ms)
      var(--ease-low-accel, cubic-bezier(0.52, 0.01, 0.3, 0.99)) var(--ss-oneshot-count, 1) both;
  }

  .ss-flood-water .wave-back {
    animation: ss-waves-left var(--ss-wave-back-duration, 3000ms) linear infinite;
  }

  .ss-flood-water .wave-front {
    animation: ss-waves-right var(--ss-wave-front-duration, 2200ms) linear infinite;
  }

  .ss-flood-water .bubble {
    animation:
      ss-bubble-rise var(--ss-bubble-duration, 1800ms) ease-out infinite,
      ss-field-fade-out var(--ss-bubble-duration, 1800ms) linear infinite;
  }

  .ss-flood-water .bubble.bubble-2 {
    animation-delay: calc(var(--ss-bubble-duration, 1800ms) * -0.25);
  }

  .ss-flood-water .bubble.bubble-3 {
    animation-delay: calc(var(--ss-bubble-duration, 1800ms) * -0.5);
  }

  .ss-flood-water .bubble.bubble-4 {
    animation-delay: calc(var(--ss-bubble-duration, 1800ms) * -0.75);
  }

  .ss-rubber-ring > .ss-sprite:not(.ss-ring-water) {
    animation: ss-ring-bob var(--ss-ring-bob-duration, 1800ms) ease-in-out infinite;
    animation-delay: var(--ss-crowd-delay, 0ms);
  }

  .ss-rubber-duck .duck-rig {
    animation: ss-duck-bob var(--ss-duck-bob-duration, 1400ms) ease-in-out infinite;
  }

  /* Disco. */
  .ss-mirror-ball .ball-rig {
    animation:
      ss-ball-drop var(--ss-ball-drop-duration, 900ms)
        var(--ease-light-bounce, cubic-bezier(0.3, 1.41, 0.4, 0.99)) var(--ss-oneshot-count, 1)
        both,
      ss-ball-sway var(--ss-ball-sway-duration, 3000ms) ease-in-out
        var(--ss-ball-drop-duration, 900ms) infinite;
  }

  .ss-mirror-ball .facet {
    animation: ss-facet-glint var(--ss-glint-duration, 1200ms) linear infinite;
  }

  .ss-mirror-ball .facet.facet-2 {
    animation-delay: calc(var(--ss-glint-duration, 1200ms) * -0.25);
  }

  .ss-mirror-ball .facet.facet-3 {
    animation-delay: calc(var(--ss-glint-duration, 1200ms) * -0.5);
  }

  .ss-mirror-ball .facet.facet-4 {
    animation-delay: calc(var(--ss-glint-duration, 1200ms) * -0.75);
  }

  .ss-mirror-ball .ball-sparkle {
    animation:
      ss-glint-scale var(--ss-glint-duration, 1200ms) ease-in-out infinite,
      ss-glint-opacity var(--ss-glint-duration, 1200ms) linear infinite;
  }

  .ss-mirror-ball .ball-sparkle.sparkle-b {
    animation-delay: calc(var(--ss-glint-duration, 1200ms) / -3);
  }

  .ss-mirror-ball .ball-sparkle.sparkle-c {
    animation-delay: calc(var(--ss-glint-duration, 1200ms) / -1.5);
  }

  .ss-disco-lights .disco-wash {
    animation: ss-wash-pulse var(--ss-wash-duration, 2400ms) linear infinite;
  }

  .ss-disco-lights .disco-beam {
    animation: ss-beam-sweep var(--ss-beam-duration, 2400ms) ease-in-out infinite alternate;
  }

  .ss-disco-lights .disco-beam.beam-2 {
    animation-direction: alternate-reverse;
  }

  .ss-disco-lights .disco-beam.beam-3 {
    animation-delay: calc(var(--ss-beam-duration, 2400ms) / -2);
  }

  .ss-disco-lights .disco-beam.beam-4 {
    animation-direction: alternate-reverse;
    animation-delay: calc(var(--ss-beam-duration, 2400ms) / -2);
  }

  .ss-disco-lights .disco-spot {
    animation: ss-spot-glide var(--ss-spot-duration, 1800ms) ease-in-out infinite alternate;
  }

  .ss-disco-lights .disco-spot.spot-2 {
    animation-direction: alternate-reverse;
  }

  /* Acorn hail. */
  .ss-hail-nut .hail-nut {
    animation: ss-hail-wobble var(--ss-hail-wobble-duration, 400ms) ease-in-out infinite
      alternate;
  }

  .ss-hail-nut .hail-streaks {
    animation: ss-field-flicker var(--ss-streak-duration, 400ms) linear infinite;
  }

  .ss-anim-hail-fall {
    animation: ss-hail-fall var(--ss-hail-duration, 1200ms) linear var(--ss-oneshot-count, 1)
      both;
    animation-delay: var(--ss-hail-delay, 0ms);
  }

  /* Owl referee. */
  .ss-owl-referee.ss-pose-whistle .ss-motion {
    animation: ss-ref-hop var(--ss-whistle-duration, 500ms) ease-in-out infinite;
  }

  .ss-owl-referee.ss-pose-whistle .owl-head {
    animation: ss-whistle-puff var(--ss-whistle-duration, 500ms) ease-in-out infinite;
  }

  .ss-owl-referee .whistle-lines {
    animation: ss-field-flicker var(--ss-whistle-duration, 500ms) linear infinite;
  }

  .ss-owl-referee.ss-pose-monitor .owl-head {
    animation: ss-peer var(--ss-peer-duration, 1600ms) ease-in-out infinite;
  }

  .ss-owl-referee .monitor-screen {
    animation: ss-screen-flicker var(--ss-screen-duration, 900ms) linear infinite;
  }

  .ss-owl-referee .ref-card {
    animation: ss-card-thrust var(--ss-card-duration, 900ms)
      var(--ease-heavy-bounce, cubic-bezier(0.25, 2.25, 0.45, 1)) infinite;
  }

  /* VAR lines. */
  .ss-var-lines .var-line {
    animation: ss-var-draw var(--ss-var-draw-duration, 700ms)
      var(--ease-enter, cubic-bezier(0.21, 0.64, 0.52, 1)) var(--ss-oneshot-count, 1) both;
  }

  .ss-var-lines .var-line.var-line-b {
    animation-delay: calc(var(--ss-var-draw-duration, 700ms) / 2);
  }

  .ss-var-lines .var-target {
    animation: ss-target-pulse var(--ss-target-duration, 900ms) ease-in-out infinite;
  }

  .ss-var-lines .var-scan {
    animation: ss-var-scan var(--ss-scan-duration, 1600ms) linear infinite;
  }

  /* Trench coat. */
  .ss-trench-coat .coat-rig {
    animation: ss-teeter var(--ss-teeter-duration, 1600ms) ease-in-out infinite;
  }

  .ss-trench-coat .coat-feet {
    animation: ss-shuffle var(--ss-shuffle-duration, 300ms) ease-in-out infinite alternate;
  }

  .ss-trench-coat .coat-peek {
    animation: ss-peek-blink var(--ss-peek-duration, 2600ms) linear infinite;
  }

  .ss-trench-coat .coat-peek.peek-2 {
    animation-delay: calc(var(--ss-peek-duration, 2600ms) / -2);
  }

  .ss-trench-coat .fake-moustache {
    animation: ss-moustache-slip var(--ss-moustache-duration, 1800ms) ease-in-out infinite;
  }

  /*
   * Stage helpers. The doubled .ss-motion beats any sprite's own pose loop, whatever order
   * the stylesheets are adopted in.
   */
  .ss-anim-dance-along.ss-sprite .ss-motion.ss-motion,
  .ss-anim-dance-along .ss-sprite .ss-motion.ss-motion {
    animation: ss-dance-along var(--ss-dance-along-duration, 600ms) ease-in-out infinite;
  }

  .ss-anim-robot.ss-sprite .ss-motion.ss-motion,
  .ss-anim-robot .ss-sprite .ss-motion.ss-motion {
    animation: ss-robot var(--ss-robot-duration, 1200ms) steps(1, end) infinite;
  }

  .ss-anim-quake {
    animation: ss-quake var(--ss-quake-duration, 90ms) linear infinite;
  }

  .ss-anim-domino.ss-crowd .ss-motion.ss-motion,
  .ss-anim-domino .ss-crowd .ss-motion.ss-motion {
    transform-origin: 70px 96px;
    animation: ss-domino var(--ss-domino-duration, 700ms)
      var(--ease-exit, cubic-bezier(0.71, 0.01, 1, 1)) var(--ss-oneshot-count, 1) both;
    animation-delay: var(--ss-crowd-delay, 0ms);
  }

  @keyframes ss-field-fade-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }

  @keyframes ss-field-flicker {
    0%, 100% { opacity: 0.8; }
    50% { opacity: 0.3; }
  }

  @keyframes ss-crack-open {
    from { transform: scale(0.05, 0.4); }
    to { transform: scale(1, 1); }
  }

  @keyframes ss-pebble-hop {
    0%, 100% { transform: translateY(0); }
    40% { transform: translateY(-8px); }
  }

  @keyframes ss-mole-pop {
    from { transform: translateY(28px); }
    to { transform: translateY(0); }
  }

  @keyframes ss-sniff {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.18); }
  }

  @keyframes ss-dirt-fly {
    from { transform: translate(0, 0); }
    to { transform: translate(0, -14px); }
  }

  @keyframes ss-flood-rise {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  @keyframes ss-waves-left {
    from { transform: translateX(0); }
    to { transform: translateX(-40px); }
  }

  @keyframes ss-waves-right {
    from { transform: translateX(-40px); }
    to { transform: translateX(0); }
  }

  @keyframes ss-bubble-rise {
    from { transform: translateY(0); }
    to { transform: translateY(-14px); }
  }

  @keyframes ss-ring-bob {
    0%, 100% { transform: translateY(0) rotate(-3deg); }
    50% { transform: translateY(-3px) rotate(3deg); }
  }

  @keyframes ss-duck-bob {
    0%, 100% { transform: translateY(0) rotate(-5deg); }
    50% { transform: translateY(-2px) rotate(5deg); }
  }

  @keyframes ss-ball-drop {
    from { transform: translateY(-70px); }
    to { transform: translateY(0); }
  }

  @keyframes ss-ball-sway {
    0%, 100% { transform: rotate(-3deg); }
    50% { transform: rotate(3deg); }
  }

  @keyframes ss-facet-glint {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
  }

  @keyframes ss-glint-scale {
    0%, 100% { transform: scale(0.4) rotate(0deg); }
    50% { transform: scale(1.1) rotate(45deg); }
  }

  @keyframes ss-glint-opacity {
    0%, 100% { opacity: 0.2; }
    50% { opacity: 1; }
  }

  @keyframes ss-wash-pulse {
    0%, 100% { opacity: 0.22; }
    50% { opacity: 0.34; }
  }

  @keyframes ss-beam-sweep {
    from { transform: rotate(-22deg); }
    to { transform: rotate(22deg); }
  }

  @keyframes ss-spot-glide {
    from { transform: translateX(-20px); }
    to { transform: translateX(20px); }
  }

  @keyframes ss-hail-wobble {
    from { transform: rotate(-25deg); }
    to { transform: rotate(25deg); }
  }

  @keyframes ss-hail-fall {
    from { transform: translateY(var(--ss-hail-start, -12vh)); }
    to { transform: translateY(var(--ss-hail-fall, 100vh)); }
  }

  @keyframes ss-ref-hop {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-2px); }
  }

  @keyframes ss-whistle-puff {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }

  @keyframes ss-peer {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(10deg); }
  }

  @keyframes ss-screen-flicker {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.75; }
  }

  @keyframes ss-card-thrust {
    0% { transform: translateY(4px) rotate(-6deg); }
    30%, 100% { transform: translateY(0) rotate(0deg); }
  }

  @keyframes ss-var-draw {
    from { transform: scaleY(0); }
    to { transform: scaleY(1); }
  }

  @keyframes ss-target-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.25); }
  }

  @keyframes ss-var-scan {
    from { transform: translateX(0); }
    to { transform: translateX(155px); }
  }

  @keyframes ss-teeter {
    0%, 100% { transform: rotate(-3deg); }
    50% { transform: rotate(3deg); }
  }

  @keyframes ss-shuffle {
    from { transform: translateX(-1.5px); }
    to { transform: translateX(1.5px); }
  }

  @keyframes ss-peek-blink {
    0%, 90%, 100% { transform: scaleY(1); }
    95% { transform: scaleY(0.1); }
  }

  @keyframes ss-moustache-slip {
    0%, 100% { transform: rotate(0deg); }
    40% { transform: rotate(-8deg) translateY(0.6px); }
    60% { transform: rotate(4deg); }
  }

  @keyframes ss-dance-along {
    0%, 100% { transform: translateX(-2px) rotate(-6deg); }
    50% { transform: translateX(2px) translateY(-2px) rotate(6deg); }
  }

  @keyframes ss-robot {
    0% { transform: rotate(0deg); }
    25% { transform: rotate(-8deg); }
    50% { transform: translateY(-2px) rotate(0deg); }
    75% { transform: rotate(8deg); }
    100% { transform: rotate(0deg); }
  }

  @keyframes ss-quake {
    0%, 100% { transform: translate(0, 0); }
    25% { transform: translate(-3px, 1px); }
    50% { transform: translate(2px, -2px); }
    75% { transform: translate(-1px, 2px); }
  }

  @keyframes ss-domino {
    0% { transform: rotate(0deg); }
    60% { transform: rotate(88deg); }
    75% { transform: rotate(80deg); }
    100% { transform: rotate(86deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .ss-crack .crack-body,
    .ss-crack .crack-pebble,
    .ss-mole-pop :is(.mole-body, .mole-paws),
    .ss-mole-pop .mole-nose,
    .ss-flood-water .flood-rig,
    .ss-flood-water .wave-back,
    .ss-flood-water .wave-front,
    .ss-rubber-ring > .ss-sprite:not(.ss-ring-water),
    .ss-rubber-duck .duck-rig,
    .ss-mirror-ball .ball-rig,
    .ss-mirror-ball .facet,
    .ss-disco-lights .disco-wash,
    .ss-disco-lights .disco-beam,
    .ss-disco-lights .disco-spot,
    .ss-hail-nut .hail-nut,
    .ss-anim-hail-fall,
    .ss-owl-referee.ss-pose-whistle .ss-motion,
    .ss-owl-referee.ss-pose-whistle .owl-head,
    .ss-owl-referee.ss-pose-monitor .owl-head,
    .ss-owl-referee .monitor-screen,
    .ss-owl-referee .ref-card,
    .ss-var-lines .var-line,
    .ss-var-lines .var-target,
    .ss-trench-coat .coat-rig,
    .ss-trench-coat .coat-feet,
    .ss-trench-coat .coat-peek,
    .ss-trench-coat .fake-moustache,
    .ss-anim-dance-along.ss-sprite .ss-motion.ss-motion,
    .ss-anim-dance-along .ss-sprite .ss-motion.ss-motion,
    .ss-anim-robot.ss-sprite .ss-motion.ss-motion,
    .ss-anim-robot .ss-sprite .ss-motion.ss-motion,
    .ss-anim-quake {
      animation: none;
    }

    /* Still frames: dirt, bubbles, sparkles and sound lines stay visible; no scan bar. */
    .ss-mole-pop .dirt,
    .ss-flood-water .bubble,
    .ss-mirror-ball .ball-sparkle,
    .ss-hail-nut .hail-streaks,
    .ss-owl-referee .whistle-lines {
      animation: none;
      opacity: 0.8;
    }

    .ss-var-lines .var-scan {
      animation: none;
      opacity: 0;
    }

    /* The crowd still ends up on its side: the fall is the news, not the motion. */
    .ss-anim-domino.ss-crowd .ss-motion.ss-motion,
    .ss-anim-domino .ss-crowd .ss-motion.ss-motion {
      animation: none;
      transform: rotate(86deg);
    }
  }
`;
