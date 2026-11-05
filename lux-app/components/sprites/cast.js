import {svg, nothing} from 'lit';
import {
  EYE_ART,
  burstPath,
  circlePath,
  classNames,
  heartPath,
  lipsPath,
  paint,
  pathCommand,
  pickId,
  rodentFigure,
  sparklePath,
  spriteSvg,
  starPath
} from './squirrel.js';

/**
 * Squirrel Scramble sprite kit, part 2: the Chaos cast (SPEC.md § 10) and the small props and
 * effects the race overlays use. All art is original and slapstick-PG: hearts, a kiss, a
 * blush and a slap; the hunter's blunderbuss is a bell-mouthed toy with a cork on a string.
 *
 * Every export returns a decorative <svg> (aria-hidden) built by spriteSvg, viewBox
 * 0 0 100 100 unless its JSDoc says otherwise. Pose ids unknown to a sprite fall back to its
 * default pose. Every function is pure: no DOM, no randomness, no clock. animations.js moves
 * the named groups.
 *
 * Colours are literal values in the SVG presentation attributes, never `var()` there: a
 * presentation attribute holding `var()` is not honoured (see squirrel.js). Two palettes stay
 * themeable through CSS. The suitor's root sets --fur, --fur-dark, --belly and --eye
 * (themeable as --ss-suitor-fur, -fur-dark, -belly and -eye), and the slap's root sets --fur
 * for her paw; animations.js maps the ss-fur classes onto them. A badge's root sets
 * --badge-face, --badge-edge and --badge-ink (themeable as --ss-badge-<colourway>, -edge and
 * -ink) for the badge-face, badge-edge and badge-ink classes. Without that sheet the literal
 * colours still draw every part right.
 */

/** The default options object: default pose, no extra classes. */
const NO_OPTIONS = Object.freeze({});

// ---------------------------------------------------------------------------------------------
// The suitor: a lady squirrel with long eyelashes, a bow and lipstick.
// ---------------------------------------------------------------------------------------------

// The suitor's literal coat colours. Her root's custom properties carry the same colours as
// theme tokens, and animations.js paints her fur classes with them.
const SUITOR_PALETTE = Object.freeze({
  fur: '#D99A6C',
  dark: '#A86E47',
  belly: '#FBE3CF',
  eye: '#3E2723'
});

const SUITOR_STYLE = Object.freeze({
  '--fur': paint('suitor-fur', SUITOR_PALETTE.fur),
  '--fur-dark': paint('suitor-fur-dark', SUITOR_PALETTE.dark),
  '--belly': paint('suitor-belly', SUITOR_PALETTE.belly),
  '--eye': paint('suitor-eye', SUITOR_PALETTE.eye)
});

const LASHES_UP = svg`<g class="lashes">
  <path d="M61.8 27.2L60.4 25.6M64 26.5L63.6 24.4M66.3 26.8L67.2 24.9" fill="none"
    stroke="#2B1D16" stroke-width="0.8" stroke-linecap="round"></path>
</g>`;

const LASHES_DOWN = svg`<g class="lashes">
  <path d="M62.2 32.4L61.2 34.1M64.5 33.2L64.4 35.1M66.8 32.4L67.8 34.1" fill="none"
    stroke="#2B1D16" stroke-width="0.8" stroke-linecap="round"></path>
</g>`;

const LASHES_HAUGHTY = svg`<g class="lashes">
  <path d="M62.2 29.4L61 27.9M64.5 28.6L64.3 26.8M66.8 29.4L67.9 27.9" fill="none"
    stroke="#2B1D16" stroke-width="0.8" stroke-linecap="round"></path>
</g>`;

const ANGRY_BROW = svg`<path d="M61 25.6L68 27.8" fill="none" stroke="#2B1D16"
  stroke-width="1.2" stroke-linecap="round"></path>`;

const SUITOR_EYES = {
  open: svg`${EYE_ART.open}${LASHES_UP}`,
  dreamy: svg`${EYE_ART.dreamy}${LASHES_DOWN}`,
  angry: svg`${EYE_ART.open}${LASHES_UP}${ANGRY_BROW}`,
  haughty: svg`${EYE_ART.happy}${LASHES_HAUGHTY}`
};

const SUITOR_MOUTHS = {
  lips: svg`<path d=${lipsPath(75.6, 40.9, 2.2, 1.3)} fill="#D81B60"></path>`,
  pucker: svg`<path d=${lipsPath(78, 40.6, 1.8, 1.5)} fill="#D81B60"></path>`
};

const SUITOR_BLUSH = svg`<circle cx="68.5" cy="37.6" r="2.8" fill="#F06292"
  opacity="0.55"></circle>`;

const SUITOR_BOW = svg`<g class="bow">
  <path d="M55.5 21.5C51 17 47.5 19 48.5 22.5C49.5 26 53.5 24.5 55.5 21.5Z
    M55.5 21.5C58 16.5 62.5 17 62 20.8C61.5 24.5 57.5 24 55.5 21.5Z"
    fill="#EC407A"></path>
  <circle cx="55.5" cy="21.5" r="1.5" fill="#AD1457"></circle>
</g>`;

const BECKON_HEART = svg`<g class="heart-pulse">
  <path d=${heartPath(88, 22, 9)} fill="#E91E63"></path>
</g>`;

const SLAP_SWOOSH = svg`<path class="swoosh" d="M80 30C88 34 92 40 92 48M75 26C86 30 94 38 95 50"
  fill="none" stroke="#90A4AE" stroke-width="1.2" stroke-linecap="round"
  opacity="0.85"></path>`;

// Suitor poses: beckon (flutters her lashes), kiss, slap and wave-off.
const SUITOR_POSES = {
  beckon: {
    frontPaw: [76, 46],
    backPaw: [61.5, 62.5],
    eyes: 'open',
    mouth: 'lips',
    front: BECKON_HEART
  },
  kiss: {frontPaw: [66, 61], backPaw: [62, 59.5], eyes: 'dreamy', mouth: 'pucker', front: nothing},
  slap: {frontPaw: [86, 44], backPaw: [48, 60], eyes: 'angry', mouth: 'lips', front: SLAP_SWOOSH},
  'wave-off': {
    frontPaw: [84, 40],
    backPaw: [61.5, 62.5],
    eyes: 'haughty',
    mouth: 'lips',
    front: nothing
  }
};

/**
 * @description Draws the suitor: a lady squirrel with eyelashes, a pink bow and lipstick, on
 *   the same frame as the racing squirrel. She faces right like everyone else; add the class
 *   'ss-flip' to face her left, towards a racer.
 * @param {Object} [options] - Pose and classes.
 * @param {string} [options.pose] - 'beckon' (default), 'kiss', 'slap' or 'wave-off'.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The suitor <svg>, root 'ss-sprite ss-suitor
 *   ss-pose-<pose>'.
 * @throws {never} Never throws.
 * @example
 *   suitorSprite({pose: 'beckon', className: 'ss-flip'});
 * @since 1.0.0
 */
export function suitorSprite({pose = 'beckon', className = ''} = NO_OPTIONS) {
  const poseId = pickId(SUITOR_POSES, pose, 'beckon');
  const poseSpec = SUITOR_POSES[poseId];
  const content = rodentFigure({
    palette: SUITOR_PALETTE,
    front: poseSpec.front,
    frontPaw: poseSpec.frontPaw,
    backPaw: poseSpec.backPaw,
    eyes: SUITOR_EYES[poseSpec.eyes],
    cheek: SUITOR_BLUSH,
    mouth: SUITOR_MOUTHS[poseSpec.mouth],
    headExtras: SUITOR_BOW
  });
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-suitor', `ss-pose-${poseId}`, className),
    style: SUITOR_STYLE,
    content
  });
}

// ---------------------------------------------------------------------------------------------
// The hunter: tweed cap, enormous moustache, and a toy-like bell-mouthed blunderbuss.
// ---------------------------------------------------------------------------------------------

const HUNTER_LEGS = svg`
  <g class="leg-back">
    <path d="M40 68H49L48.5 80C46 82 42 82 40.5 80Z" fill="#6D5235">
    </path>
    <path d="M41 80H48L47.6 88H41.6Z" fill="#2E5E3A"></path>
    <path d="M40.5 87.5H48C50.5 87.5 53.5 89.5 53.5 92.5H40.5Z"
      fill="#3E2A1E"></path>
  </g>
  <g class="leg-front">
    <path d="M47 68H56L55.5 80C53 82 49 82 47.5 80Z" fill="#8D6E4A"></path>
    <path d="M48 80H55L54.6 88H48.6Z" fill="#3F7D4E"></path>
    <path d="M47.5 87.5H55C57.5 87.5 60.5 89.5 60.5 92.5H47.5Z"
      fill="#4E342E"></path>
  </g>`;

const HUNTER_BODY = svg`<g class="hunter-body">
  <ellipse cx="50" cy="58" rx="17" ry="15" fill="#8D6E4A"></ellipse>
  <path d="M38 52H62M35.5 60H64.5M38.5 67H61.5M44 44.5L42 72M52 43.2V72.8M60 46.5L61.5 69"
    fill="none" stroke="#5D4630" stroke-width="0.6" opacity="0.45"></path>
  <path d=${circlePath(59.5, 54, 1) + circlePath(60.5, 61, 1)}
    fill="#3E2A1E"></path>
</g>`;

const GUN_STOCK = svg`<path d="M30 50C30 46 36 45 44 47.5L52 48.5V53.5L44 54C36 56.5 30 55 30 50Z"
  fill="#B5651D"></path>`;

const GUN_BARREL = svg`<path d="M51 48L77 47.2V51.6L51 52.6Z" fill="#C9A227">
</path>`;

const GUN_BELL = svg`
  <path d="M76 48.6L86 42.5C88 42 89 43.5 88.5 45V54.5C89 56 88 57.5 86 57L76 50.8Z"
    fill="#E0B83A" stroke="#A07E1C"
    stroke-width="0.8"></path>
  <ellipse cx="88" cy="49.7" rx="1.6" ry="6.2" fill="#5D4A12"></ellipse>`;

// After a backfire the bell has peeled open like a banana.
const GUN_BELL_PEELED = svg`
  <path d="M76 48.6L83 41.5C85 39.5 88.5 40 87.5 43L82 49.7L87.5 56.4C88.5 59.4 85 59.9 83 57.9
    L76 50.8Z" fill="#E0B83A" stroke="#A07E1C"
    stroke-width="0.8"></path>`;

// The cork on a string is what makes the blunderbuss a toy.
const CORK_DANGLING = svg`
  <path d="M86.5 56.5C86 61 87 64.5 89 65.5" fill="none" stroke="#5D4037"
    stroke-width="0.6"></path>
  <path d="M87.2 64.8L91 64.3L91.4 68L87.6 68.6Z" fill="#D7A86E"></path>`;

const CORK_POPPED = svg`
  <path d="M88.5 47.5C91.5 45 94 42.5 96 41" fill="none" stroke="#5D4037"
    stroke-width="0.6"></path>
  <path d="M95 39.2L98.6 38.6L99.4 42.2L95.8 42.8Z" fill="#D7A86E"></path>`;

/**
 * @description Assembles the blunderbuss, levelled (pointing right), inside a gun group.
 * @param {import('lit').SVGTemplateResult} bell - The bell mouth (whole or peeled).
 * @param {import('lit').SVGTemplateResult} cork - The cork (dangling or popped).
 * @returns {import('lit').SVGTemplateResult} The gun group.
 * @throws {never} Never throws.
 * @example
 *   blunderbuss(GUN_BELL, CORK_DANGLING);
 * @since 1.0.0
 */
function blunderbuss(bell, cork) {
  return svg`<g class="gun">${GUN_STOCK}${GUN_BARREL}${bell}${cork}</g>`;
}

const GUN_LEVEL = blunderbuss(GUN_BELL, CORK_DANGLING);
const GUN_FIRING = blunderbuss(GUN_BELL, CORK_POPPED);
const GUN_PEELED = blunderbuss(GUN_BELL_PEELED, CORK_DANGLING);
// Walking, the gun rests on his shoulder with the barrel up behind his head.
const GUN_SHOULDERED = svg`<g transform="rotate(-120 46 50)">${GUN_LEVEL}</g>`;
// Grumbling, it droops towards the ground.
const GUN_LOWERED = svg`<g transform="rotate(35 46 50)">${GUN_LEVEL}</g>`;

const HUNTER_CAP_ART = svg`
  <path d="M43.5 28C43 17 63 14.5 67.5 23L74.5 25.2C73 27.6 62 28.2 43.5 28Z"
    fill="#9C7B54"></path>
  <path d="M48 20L49.5 27.5M54 18L55 27.6M60 18.5L60.5 27.6M45 23.5H66" fill="none"
    stroke="#6D5235" stroke-width="0.6" opacity="0.55"></path>
  <circle cx="55" cy="17.4" r="1.2" fill="#6D5235"></circle>`;

const CAP_ON = svg`<g class="cap">${HUNTER_CAP_ART}</g>`;
const CAP_FLYING = svg`<g transform="translate(-10 -18) rotate(-28 56 24)">
  <g class="cap cap-flying">${HUNTER_CAP_ART}</g>
</g>`;

const HUNTER_EYES = {
  open: svg`<circle cx="60.5" cy="33" r="1.3" fill="#2B1D16"></circle>`,
  squint: svg`<path d="M58.4 33.4L62.8 32.6" stroke="#2B1D16" stroke-width="1.2"
    stroke-linecap="round"></path>`,
  startled: svg`
    <circle cx="60.5" cy="33" r="2.4" fill="#FFFFFF"></circle>
    <circle cx="61" cy="33.2" r="1" fill="#2B1D16"></circle>`
};

const HUNTER_BROWS = {
  normal: 'M57.5 30C59.5 28.4 62.5 28.6 64 30',
  aim: 'M57.5 30.8C59.5 30 62.5 30 64 31.2',
  angry: 'M57.5 28.6L64 31.2',
  singed: 'M57.2 29.6L58.6 28L59.8 29.4L61.2 27.8L62.4 29.3L63.8 28'
};

const MUZZLE_FLASH_PATH = burstPath(92, 50, 7.5, 3.4, 8);
const GUN_SMOKE_PATH =
  circlePath(80, 37, 3.6) + circlePath(85, 34, 4.4) + circlePath(89.5, 37.5, 3);
const BLAM_BURST_PATH = burstPath(80, 13, 13, 9, 12);
const BACKFIRE_SMOKE_PATH =
  circlePath(80, 40, 5) + circlePath(86, 35.5, 4) + circlePath(73.5, 35, 3.6);

const BACKFIRE_SMOKE = svg`<path class="backfire-smoke" d=${BACKFIRE_SMOKE_PATH}
  fill="#757575" opacity="0.85"></path>`;

const GRUMBLE_CLOUD = svg`<g class="grumble-cloud">
  <path d="M47 12C47 7 52 6 54 9C55 5 61 5 62 9C65 7 69 9 67.5 13C67 15 64 16 62 14.5
    C60 16.5 55 16.5 53.5 14.5C51 16 47 15 47 12Z" fill="#616161"></path>
  <path d="M50.5 11.5L52.5 9.5L54.5 11.5L56.5 9.5L58.5 11.5L60.5 9.5L62.5 11.5L64.5 9.5"
    fill="none" stroke="#FAFAFA" stroke-width="0.8"
    stroke-linejoin="round"></path>
</g>`;

// Hunter poses: walk, aim, fire (flash, smoke, BLAM!), backfire (soot face, cap off), grumble.
const HUNTER_POSES = {
  walk: {gun: GUN_SHOULDERED, hand: [50, 57], eye: 'open', brow: 'normal', soot: false},
  aim: {gun: GUN_LEVEL, hand: [61, 51.6], eye: 'squint', brow: 'aim', soot: false},
  fire: {gun: GUN_FIRING, hand: [61, 51.6], eye: 'squint', brow: 'aim', soot: false},
  backfire: {gun: GUN_PEELED, hand: [61, 51.6], eye: 'startled', brow: 'singed', soot: true},
  grumble: {gun: GUN_LOWERED, hand: [57.5, 58], eye: 'open', brow: 'angry', soot: false}
};

/**
 * @description The hunter's head: face, ear, eye, brow, nose, moustache and cap (which flies
 *   off in a backfire). A soot-blackened face after a backfire.
 * @param {string} poseId - A known hunter pose id.
 * @returns {import('lit').SVGTemplateResult} The head group.
 * @throws {never} Never throws.
 * @example
 *   hunterHead('aim');
 * @since 1.0.0
 */
function hunterHead(poseId) {
  const poseSpec = HUNTER_POSES[poseId];
  const soot = poseSpec.soot;
  const skin = soot ? '#2B2522' : '#F1C27D';
  const ear = soot ? '#1E1A18' : '#E0A878';
  const nose = soot ? '#5D4037' : '#E57373';
  const moustache = soot ? '#4A3B33' : '#C1693C';
  return svg`<g class="head">
    <circle cx="55" cy="36" r="11" fill=${skin}></circle>
    <circle cx="47.5" cy="37" r="2.8" fill=${ear}></circle>
    <g class="eye">${HUNTER_EYES[poseSpec.eye]}</g>
    <path class="brow" d=${HUNTER_BROWS[poseSpec.brow]} fill="none"
      stroke="#9E9E9E" stroke-width="1.8" stroke-linecap="round"
      stroke-linejoin="round"></path>
    <ellipse cx="66.5" cy="38.5" rx="4.6" ry="4" fill=${nose}></ellipse>
    <path class="moustache" fill=${moustache}
      d="M66 42C60 40 54 42.5 50.5 47.5C55.5 45.2 60.5 44.6 64.5 44.8C68 45 72.5 44.5 77.5 47.8
        C75 42.8 70.5 41 66 42Z"></path>
    ${poseId === 'backfire' ? CAP_FLYING : CAP_ON}
  </g>`;
}

/**
 * @description The hunter's near arm: a tweed sleeve from the shoulder to a hand on the gun.
 * @param {Array<number>} hand - [x, y] of the hand.
 * @returns {import('lit').SVGTemplateResult} The arm group.
 * @throws {never} Never throws.
 * @example
 *   hunterArm([61, 51.6]);
 * @since 1.0.0
 */
function hunterArm(hand) {
  return svg`<g class="arm-front">
    <line x1="53" y1="49" x2=${hand[0]} y2=${hand[1]}
      stroke="#6D5235" stroke-width="5.5" stroke-linecap="round">
    </line>
    <circle cx=${hand[0]} cy=${hand[1]} r="2.7" fill="#F1C27D"></circle>
  </g>`;
}

/**
 * @description The firing effects: muzzle flash, smoke puff and the comic "BLAM!" burst.
 * @param {string} label - The burst text (translated by the caller).
 * @returns {import('lit').SVGTemplateResult} The effect shapes.
 * @throws {never} Never throws.
 * @example
 *   fireExtras('BLAM!');
 * @since 1.0.0
 */
function fireExtras(label) {
  return svg`
    <path class="muzzle-flash" d=${MUZZLE_FLASH_PATH} fill="#FFD54F"
      stroke="#FF8F00" stroke-width="0.8" stroke-linejoin="round"></path>
    <path class="gun-smoke" d=${GUN_SMOKE_PATH} fill="#CFD8DC"
      opacity="0.9"></path>
    <g class="blam">
      <path d=${BLAM_BURST_PATH} fill="#FFEB3B"
        stroke="#E53935" stroke-width="1.1" stroke-linejoin="round"></path>
      <text x="80" y="15.6" text-anchor="middle" font-family="system-ui, sans-serif" font-size="7"
        font-weight="900" fill="#C62828">${label}</text>
    </g>`;
}

/**
 * @description The pose-specific overlay: firing effects, backfire smoke or a grumble cloud.
 * @param {string} poseId - A known hunter pose id.
 * @param {string} label - The "BLAM!" text for the fire pose.
 * @returns {*} The overlay, or nothing.
 * @throws {never} Never throws.
 * @example
 *   hunterExtras('grumble', 'BLAM!');
 * @since 1.0.0
 */
function hunterExtras(poseId, label) {
  if (poseId === 'fire') {
    return fireExtras(label);
  }
  if (poseId === 'backfire') {
    return BACKFIRE_SMOKE;
  }
  return poseId === 'grumble' ? GRUMBLE_CLOUD : nothing;
}

/**
 * @description Draws the original tweed-capped hunter with his oversized toy blunderbuss.
 * @param {Object} [options] - Pose, burst text and classes.
 * @param {string} [options.pose] - 'walk' (default), 'aim', 'fire', 'backfire' or 'grumble'.
 * @param {string} [options.burstLabel] - Text in the fire pose's burst; pass a translated
 *   string. Defaults to 'BLAM!'.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The hunter <svg>, root 'ss-sprite ss-hunter
 *   ss-pose-<pose>'.
 * @throws {never} Never throws.
 * @example
 *   hunterSprite({pose: 'fire', burstLabel: i18n.getMessage('BLAM!')});
 * @since 1.0.0
 */
export function hunterSprite({
  pose = 'walk',
  burstLabel = 'BLAM!',
  className = ''
} = NO_OPTIONS) {
  const poseId = pickId(HUNTER_POSES, pose, 'walk');
  const hasLabel = typeof burstLabel === 'string' && burstLabel.trim() !== '';
  const label = hasLabel ? burstLabel : 'BLAM!';
  const content = svg`<g class="ss-event"><g class="ss-motion">
    ${HUNTER_LEGS}
    ${HUNTER_BODY}
    ${HUNTER_POSES[poseId].gun}
    ${hunterHead(poseId)}
    ${hunterArm(HUNTER_POSES[poseId].hand)}
    ${hunterExtras(poseId, label)}
  </g></g>`;
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-hunter', `ss-pose-${poseId}`, className),
    content
  });
}

// ---------------------------------------------------------------------------------------------
// The tornado and its debris.
// ---------------------------------------------------------------------------------------------

const TORNADO_BANDS = [
  {centreX: 50, centreY: 18, radiusX: 44, radiusY: 9},
  {centreX: 53, centreY: 35, radiusX: 37, radiusY: 8},
  {centreX: 47, centreY: 51, radiusX: 30, radiusY: 7},
  {centreX: 52, centreY: 66, radiusX: 24, radiusY: 6.4},
  {centreX: 48, centreY: 80, radiusX: 18, radiusY: 5.8},
  {centreX: 51, centreY: 94, radiusX: 13, radiusY: 5.2},
  {centreX: 49, centreY: 107, radiusX: 9, radiusY: 4.6},
  {centreX: 50, centreY: 119, radiusX: 6, radiusY: 4},
  {centreX: 50, centreY: 130, radiusX: 3.6, radiusY: 3.6}
];

const TORNADO_BAND_ART = TORNADO_BANDS.map((band, index) => {
  const swirl = [
    pathCommand('M', band.centreX - band.radiusX * 0.8, band.centreY + band.radiusY * 0.1),
    pathCommand(
      'Q',
      band.centreX,
      band.centreY + band.radiusY * 1.2,
      band.centreX + band.radiusX * 0.8,
      band.centreY + band.radiusY * 0.1
    )
  ].join('');
  const tone = index % 2 === 0 ? '#B8B8B8' : '#A3A3A3';
  return svg`<g class="swirl-band band-${index + 1}">
    <ellipse cx=${band.centreX} cy=${band.centreY} rx=${band.radiusX} ry=${band.radiusY}
      fill=${tone}></ellipse>
    <path d=${swirl} fill="none" stroke="#6E6E6E" stroke-width="1.4"
      stroke-linecap="round" opacity="0.75"></path>
  </g>`;
});

const TORNADO_DUST_PATH = [
  circlePath(40, 141, 6),
  circlePath(50, 143, 7),
  circlePath(60, 141, 5.5),
  circlePath(33, 144, 4),
  circlePath(67, 144, 4)
].join('');

const TORNADO_CONTENT = svg`<g class="ss-event"><g class="ss-motion">
  <g class="funnel">
    <path d="M6 18C20 70 44 110 48 134H52C56 110 80 70 94 18Z"
      fill="#8E8E8E"></path>
    ${TORNADO_BAND_ART}
  </g>
  <path class="dust" d=${TORNADO_DUST_PATH} fill="#A1887F"
    opacity="0.75"></path>
</g></g>`;

/**
 * @description Draws the grey tornado funnel with swirl bands that twist (animations.js).
 *   Its viewBox is 0 0 100 150 (taller than wide); the debris are separate sprites so they
 *   can orbit it.
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes, e.g. 'ss-anim-tornado-cross'.
 * @returns {import('lit').TemplateResult} The tornado <svg>, root 'ss-sprite ss-tornado'.
 * @throws {never} Never throws.
 * @example
 *   tornadoSprite({className: 'ss-anim-tornado-cross'});
 * @since 1.0.0
 */
export function tornadoSprite({className = ''} = NO_OPTIONS) {
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-tornado', className),
    viewBox: '0 0 100 150',
    content: TORNADO_CONTENT
  });
}

const LEAF_CONTENT = svg`<g class="ss-motion">
  <path d="M50 12C66 20 80 38 74 60C70 74 58 84 50 88C42 84 30 74 26 60C20 38 34 20 50 12Z"
    fill="#E67E22"></path>
  <path d="M50 18V92M50 40L64 30M50 54L68 44M50 68L64 60M50 40L36 30M50 54L32 44M50 68L36 60"
    fill="none" stroke="#A04000" stroke-width="1.6" stroke-linecap="round">
  </path>
</g>`;

/**
 * @description Draws an autumn leaf, tornado debris.
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes, e.g. 'ss-anim-debris-orbit'.
 * @returns {import('lit').TemplateResult} The leaf <svg>, root 'ss-sprite ss-debris
 *   ss-debris-leaf'.
 * @throws {never} Never throws.
 * @example
 *   leafSprite({className: 'ss-anim-debris-orbit'});
 * @since 1.0.0
 */
export function leafSprite({className = ''} = NO_OPTIONS) {
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-debris', 'ss-debris-leaf', className),
    content: LEAF_CONTENT
  });
}

const GNOME_CONTENT = svg`<g class="ss-motion">
  <path d="M37 70L24 58M63 70L76 58" stroke="#1E88E5" stroke-width="5"
    stroke-linecap="round"></path>
  <path d="M36 80C36 66 64 66 64 80L62 88H38Z" fill="#1E88E5"></path>
  <path d="M36.6 78H63.4L63.6 81H36.4Z" fill="#3E2723"></path>
  <path d=${circlePath(42, 90, 4) + circlePath(58, 90, 4)} fill="#5D4037">
  </path>
  <circle cx="50" cy="50" r="10" fill="#F5C9A6"></circle>
  <path d="M38 52C38 70 46 80 50 82C54 80 62 70 62 52C58 58 42 58 38 52Z"
    fill="#FAFAFA"></path>
  <circle cx="50" cy="53" r="3.6" fill="#E8A07E"></circle>
  <path d=${circlePath(45, 47, 1.6) + circlePath(55, 47, 1.6) + circlePath(50, 59.5, 1.5)}
    fill="#2B1D16"></path>
  <path d="M50 6L34 46H66Z" fill="#D32F2F"></path>
</g>`;

/**
 * @description Draws a startled garden gnome, tornado debris.
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The gnome <svg>, root 'ss-sprite ss-debris
 *   ss-debris-gnome'.
 * @throws {never} Never throws.
 * @example
 *   gnomeSprite();
 * @since 1.0.0
 */
export function gnomeSprite({className = ''} = NO_OPTIONS) {
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-debris', 'ss-debris-gnome', className),
    content: GNOME_CONTENT
  });
}

const COW_CONTENT = svg`<g class="ss-motion">
  <path d="M30 58L22 76M40 60L38 80M60 60L62 80M70 58L80 76" stroke="#F5F5F5"
    stroke-width="5.5" stroke-linecap="round"></path>
  <path d="M22.9 74.2L22 76M38.1 78L38 80M61.9 78L62 80M79.1 74.2L80 76"
    stroke="#424242" stroke-width="5.5" stroke-linecap="round"></path>
  <path d="M22 42C16 44 14 50 16 56" fill="none" stroke="#BDBDBD"
    stroke-width="1.5" stroke-linecap="round"></path>
  <circle cx="16" cy="57" r="2" fill="#212121"></circle>
  <path d="M22 44C22 34 32 30 50 30C68 30 78 34 78 46C78 58 70 62 50 62C30 62 22 56 22 44Z"
    fill="#FAFAFA" stroke="#BDBDBD" stroke-width="0.8">
  </path>
  <path d="M30 36C34 32 42 34 40 40C38 46 30 44 30 36ZM56 44C60 40 68 42 66 50C64 56 56 52 56 44Z
    M46 32C50 30 54 32 52 35C50 37 46 36 46 32Z" fill="#212121"></path>
  <path d="M80 22L77 15L82.5 20ZM86 20L88 13L90 20Z" fill="#FFF3E0"
    stroke="#BCAAA4" stroke-width="0.5"></path>
  <path d="M76 30C76 22 84 18 90 22C96 26 96 36 92 40C88 44 80 42 78 38Z"
    fill="#FAFAFA" stroke="#BDBDBD" stroke-width="0.8">
  </path>
  <ellipse cx="77.5" cy="26" rx="4" ry="2" fill="#FAFAFA"
    stroke="#BDBDBD" stroke-width="0.6"></ellipse>
  <ellipse cx="91" cy="37" rx="6" ry="4.6" fill="#F8BBD0"></ellipse>
  <path d=${circlePath(89.5, 37, 0.8) + circlePath(93, 37, 0.8)}
    fill="#AD1457"></path>
  <circle cx="86" cy="27" r="3" fill="#FFFFFF"
    stroke="#BDBDBD" stroke-width="0.5"></circle>
  <circle cx="86.6" cy="27" r="1.1" fill="#2B1D16"></circle>
</g>`;

/**
 * @description Draws a startled cow with splayed legs, tornado debris ("Is that a cow?").
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The cow <svg>, root 'ss-sprite ss-debris
 *   ss-debris-cow'.
 * @throws {never} Never throws.
 * @example
 *   cowSprite({className: 'ss-anim-debris-orbit'});
 * @since 1.0.0
 */
export function cowSprite({className = ''} = NO_OPTIONS) {
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-debris', 'ss-debris-cow', className),
    content: COW_CONTENT
  });
}

// ---------------------------------------------------------------------------------------------
// Eagle, beaver and lightning.
// ---------------------------------------------------------------------------------------------

const WING_FAR_UP =
  'M46 46C40 30 30 18 14 14C20 20 22 24 22 28C26 28 28 30 29 34C33 34 35 37 36 40C40 41 42 44 44 47Z';
const WING_NEAR_UP =
  'M50 48C46 32 38 20 22 12C28 20 29 24 29 28C33 29 35 31 36 35C40 36 42 39 43 42C46 44 48 46 50 50Z';
const WING_FAR_TUCKED = 'M52 46C44 40 32 37 20 39C28 42 36 45 46 50Z';
const WING_NEAR_TUCKED = 'M54 48C46 43 32 41 18 44C26 47 34 50 44 55Z';

const EAGLE_LEGS_TUCKED = svg`<path d="M46 60L40 64M52 61L46 65"
  stroke="#FFC107" stroke-width="2" stroke-linecap="round"></path>`;

const EAGLE_LEGS_GRAB = svg`
  <path d="M50 60L48.5 72M57 60L57.5 72" stroke="#FFC107"
    stroke-width="2.2" stroke-linecap="round"></path>
  <path d="M45.5 72.5L48.5 75L51.5 72.5M54.5 72.5L57.5 75L60.5 72.5" fill="none"
    stroke="#FFB300" stroke-width="1.5" stroke-linecap="round"
    stroke-linejoin="round"></path>`;

const SPEED_LINES = svg`<path class="speed-lines" d="M8 18L24 28M4 30L20 38M14 8L28 18"
  fill="none" stroke="#B0BEC5" stroke-width="1.4" stroke-linecap="round"
  opacity="0.8"></path>`;

/**
 * @description The eagle's body with its far wing, tail, legs, head and near wing.
 * @param {string} wingFarPath - Path data for the far wing.
 * @param {string} wingNearPath - Path data for the near wing.
 * @param {import('lit').SVGTemplateResult} legs - Tucked or grabbing legs.
 * @returns {import('lit').SVGTemplateResult} The eagle's shapes.
 * @throws {never} Never throws.
 * @example
 *   eagleFigure(WING_FAR_UP, WING_NEAR_UP, EAGLE_LEGS_TUCKED);
 * @since 1.0.0
 */
function eagleFigure(wingFarPath, wingNearPath, legs) {
  return svg`
    <g class="wing-far">
      <path d=${wingFarPath} fill="#4E342E"></path>
    </g>
    <path d="M31 55L14 51L16.5 57L13 63L31 60Z" fill="#FAFAFA"
      stroke="#E0E0E0" stroke-width="0.5"></path>
    ${legs}
    <path d="M30 54C34 46 46 44 58 46C66 47 70 52 68 57C66 62 54 64 42 62C36 61 31 59 30 54Z"
      fill="#5D4037"></path>
    <g class="eagle-head">
      <circle cx="71" cy="45" r="7.5" fill="#FAFAFA"></circle>
      <path d="M77.5 42.5C82.5 42.5 85.5 46 84.5 49.5C83.5 48 81.5 47.5 78.5 48Z"
        fill="#FFC107"></path>
      <circle cx="73.4" cy="43.2" r="1.1" fill="#2B1D16"></circle>
      <path d="M70.6 41.2L75.6 42" stroke="#2B1D16" stroke-width="1.1"
        stroke-linecap="round"></path>
    </g>
    <g class="wing-near">
      <path d=${wingNearPath} fill="#6D4C41"></path>
    </g>`;
}

// Eagle poses: dive (wings tucked, nose down), carry (talons out) and fly.
const EAGLE_POSES = {
  dive: svg`<g class="ss-event"><g class="ss-motion">
    ${SPEED_LINES}
    <g transform="rotate(35 50 52)">
      ${eagleFigure(WING_FAR_TUCKED, WING_NEAR_TUCKED, EAGLE_LEGS_TUCKED)}
    </g>
  </g></g>`,
  carry: svg`<g class="ss-event"><g class="ss-motion">
    ${eagleFigure(WING_FAR_UP, WING_NEAR_UP, EAGLE_LEGS_GRAB)}
  </g></g>`,
  fly: svg`<g class="ss-event"><g class="ss-motion">
    ${eagleFigure(WING_FAR_UP, WING_NEAR_UP, EAGLE_LEGS_TUCKED)}
  </g></g>`
};

/**
 * @description Draws the eagle that swoops in and gives a squirrel a lift.
 * @param {Object} [options] - Pose and classes.
 * @param {string} [options.pose] - 'dive', 'carry' or 'fly' (default).
 * @param {string} [options.className] - Extra root classes, e.g. 'ss-anim-eagle-dive'.
 * @returns {import('lit').TemplateResult} The eagle <svg>, root 'ss-sprite ss-eagle
 *   ss-pose-<pose>'.
 * @throws {never} Never throws.
 * @example
 *   eagleSprite({pose: 'carry'});
 * @since 1.0.0
 */
export function eagleSprite({pose = 'fly', className = ''} = NO_OPTIONS) {
  const poseId = pickId(EAGLE_POSES, pose, 'fly');
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-eagle', `ss-pose-${poseId}`, className),
    content: EAGLE_POSES[poseId]
  });
}

const WOOD_CHIPS = svg`<path class="chips" d="M84 56L88 54L89 57L85 59ZM86 62L90 61.5L89.5 64.5
  L85.5 64.5Z" fill="#D7A86E"></path>`;

/**
 * @description The beaver's shapes, gnawing (paw on the trunk, chips flying) or idle.
 * @param {boolean} gnawing - True for the gnaw pose.
 * @returns {import('lit').SVGTemplateResult} The beaver figure.
 * @throws {never} Never throws.
 * @example
 *   beaverFigure(true);
 * @since 1.0.0
 */
function beaverFigure(gnawing) {
  const paw = gnawing ? [78, 60] : [64, 66];
  return svg`<g class="ss-event"><g class="ss-motion">
    <g class="tail">
      <path d="M8 84C8 76 30 74 40 80C40 86 22 90 8 84Z" fill="#5D4037">
      </path>
      <path d="M14 80L18 86M20 78L24 87M26 77L30 86M32 78L35 85M12 83L36 79" fill="none"
        stroke="#3E2723" stroke-width="0.6" opacity="0.6"></path>
    </g>
    <path d="M30 82C26 66 32 52 46 48C58 46 66 54 66 66C66 78 58 86 46 86C38 86 32 86 30 82Z"
      fill="#8D6E63"></path>
    <path d="M48 58C58 58 62 70 58 80C52 84 46 80 46 72C46 66 46 60 48 58Z"
      fill="#BCAAA4"></path>
    <ellipse cx="44" cy="87" rx="8" ry="3" fill="#5D4037"></ellipse>
    <g class="head">
      <circle cx="58" cy="33.5" r="3" fill="#6D4C41"></circle>
      <circle cx="66" cy="44" r="12" fill="#8D6E63"></circle>
      <ellipse cx="75" cy="48" rx="6" ry="4.6" fill="#A1887F"></ellipse>
      <path d="M74.5 51.5H77.5L77.3 56H74.7ZM77.7 51.5L80.5 51.3L80.3 55.6L77.9 55.8Z"
        fill="#FF9800" stroke="#E65100"
        stroke-width="0.4"></path>
      <ellipse cx="80" cy="45" rx="2.4" ry="1.8" fill="#3E2723"></ellipse>
      <g class="eye"><circle cx="69" cy="40" r="1.5" fill="#2B1D16"></circle></g>
    </g>
    <line x1="60" y1="58" x2=${paw[0]} y2=${paw[1]} stroke="#6D4C41"
      stroke-width="4.5" stroke-linecap="round"></line>
    ${gnawing ? WOOD_CHIPS : nothing}
  </g></g>`;
}

// Beaver poses: gnaw (at the base of a tree to its right) and idle.
const BEAVER_POSES = {
  gnaw: beaverFigure(true),
  idle: beaverFigure(false)
};

/**
 * @description Draws the beaver that has a go at a racer's tree.
 * @param {Object} [options] - Pose and classes.
 * @param {string} [options.pose] - 'gnaw' or 'idle' (default).
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The beaver <svg>, root 'ss-sprite ss-beaver
 *   ss-pose-<pose>'.
 * @throws {never} Never throws.
 * @example
 *   beaverSprite({pose: 'gnaw'});
 * @since 1.0.0
 */
export function beaverSprite({pose = 'idle', className = ''} = NO_OPTIONS) {
  const poseId = pickId(BEAVER_POSES, pose, 'idle');
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-beaver', `ss-pose-${poseId}`, className),
    content: BEAVER_POSES[poseId]
  });
}

const BOLT_PATH = 'M58 2L28 52H46L36 98L74 40H54L66 2Z';

const LIGHTNING_CONTENT = svg`<g class="bolt">
  <path d=${BOLT_PATH} fill="none" stroke="#FFF59D" stroke-width="6"
    stroke-linejoin="round" opacity="0.5"></path>
  <path d=${BOLT_PATH} fill="#FFEB3B"
    stroke="#F9A825" stroke-width="1.2" stroke-linejoin="round"></path>
  <path d="M60 8L37 48H50L42 86" fill="none" stroke="#FFFFFF"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"></path>
</g>`;

/**
 * @description Draws a cartoon lightning bolt that flickers (animations.js).
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The bolt <svg>, root 'ss-sprite ss-lightning'.
 * @throws {never} Never throws.
 * @example
 *   lightningBolt();
 * @since 1.0.0
 */
export function lightningBolt({className = ''} = NO_OPTIONS) {
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-lightning', className),
    content: LIGHTNING_CONTENT
  });
}

// ---------------------------------------------------------------------------------------------
// Props and effects.
// ---------------------------------------------------------------------------------------------

const HEART_CONTENT = svg`<g class="heart-body">
  <path d=${heartPath(50, 54, 36)} fill="#E91E63"
    stroke="#AD1457" stroke-width="1.5"></path>
  <path d="M30 40C30 32 36 28 42 30" fill="none" stroke="#FFFFFF"
    stroke-width="3.5" stroke-linecap="round" opacity="0.6"></path>
</g>`;

/**
 * @description Draws a pulsing cartoon heart (add 'ss-anim-heart-float' to float it up).
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The heart <svg>, root 'ss-sprite ss-heart'.
 * @throws {never} Never throws.
 * @example
 *   heartSprite({className: 'ss-anim-heart-float'});
 * @since 1.0.0
 */
export function heartSprite({className = ''} = NO_OPTIONS) {
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-heart', className),
    content: HEART_CONTENT
  });
}

const KISS_CONTENT = svg`<g class="kiss-body">
  <path d=${lipsPath(50, 50, 32, 18)} fill="#D81B60"></path>
  <path d="M24 51C36 54 64 54 76 51" fill="none" stroke="#880E4F"
    stroke-width="1.6" stroke-linecap="round" opacity="0.6"></path>
</g>`;

/**
 * @description Draws a lipstick kiss mark (the pop when the suitor's kiss lands).
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes, e.g. 'ss-anim-pop'.
 * @returns {import('lit').TemplateResult} The kiss <svg>, root 'ss-sprite ss-kiss-mark'.
 * @throws {never} Never throws.
 * @example
 *   kissMark({className: 'ss-anim-pop'});
 * @since 1.0.0
 */
export function kissMark({className = ''} = NO_OPTIONS) {
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-kiss-mark', className),
    content: KISS_CONTENT
  });
}

const SLAP_PAD_PATH = [
  circlePath(52, 61, 6),
  circlePath(38.6, 26.4, 2.4),
  circlePath(50.2, 22.6, 2.4),
  circlePath(61.8, 24.6, 2.4),
  circlePath(72.8, 34.2, 2.4)
].join('');

// The slapping paw wears the suitor's fur: the slap's root sets --fur, as hers does.
const SLAP_STYLE = Object.freeze({'--fur': paint('suitor-fur', SUITOR_PALETTE.fur)});

const SLAP_CONTENT = svg`
  <path class="impact" d=${burstPath(48, 50, 42, 28, 10)} fill="#FFF176"
    opacity="0.85"></path>
  <g class="slap-paw">
    <path class="ss-fur-stroke" d="M44 46L38 24M52 44L50 20M60 46L62 22M66 50L74 32M38 60L24 52"
      fill="none" stroke="#D99A6C" stroke-width="9" stroke-linecap="round"></path>
    <circle class="ss-fur" cx="52" cy="58" r="16" fill="#D99A6C"></circle>
    <path d=${SLAP_PAD_PATH} fill="#F8BBD0"></path>
  </g>
  <path d="M80 22C86 26 90 32 90 40M84 14C92 20 96 28 96 38" fill="none"
    stroke="#90A4AE" stroke-width="2" stroke-linecap="round"></path>`;

/**
 * @description Draws the slap: an open paw over a yellow impact burst, with swoosh lines. The
 *   paw is the suitor's fur colour (themeable as --ss-suitor-fur).
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The slap <svg>, root 'ss-sprite ss-slap-hand'.
 * @throws {never} Never throws.
 * @example
 *   slapHand();
 * @since 1.0.0
 */
export function slapHand({className = ''} = NO_OPTIONS) {
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-slap-hand', className),
    style: SLAP_STYLE,
    content: SLAP_CONTENT
  });
}

const BIG_STAR_PATH = starPath(50, 50, 9);

const STARS_CONTENT = svg`<g class="dizzy-stars">
  <path class="dizzy-star dizzy-star-1" d=${BIG_STAR_PATH} fill="#FFEB3B"
    stroke="#F9A825" stroke-width="1"></path>
  <path class="dizzy-star dizzy-star-2" d=${BIG_STAR_PATH} fill="#FFEB3B"
    stroke="#F9A825" stroke-width="1"></path>
  <path class="dizzy-star dizzy-star-3" d=${BIG_STAR_PATH} fill="#FFEB3B"
    stroke="#F9A825" stroke-width="1"></path>
</g>`;

/**
 * @description Draws three cartoon stars that orbit a point (seeing stars after a hit).
 *   Without animations.js they sit on top of each other at the centre.
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The stars <svg>, root 'ss-sprite ss-stars'.
 * @throws {never} Never throws.
 * @example
 *   stars();
 * @since 1.0.0
 */
export function stars({className = ''} = NO_OPTIONS) {
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-stars', className),
    content: STARS_CONTENT
  });
}

const SMOKE_CONTENT = svg`<g class="ss-smoke">
  <circle class="puff puff-1" cx="42" cy="58" r="16" fill="#CFD8DC"></circle>
  <circle class="puff puff-2" cx="60" cy="52" r="18" fill="#B0BEC5"></circle>
  <circle class="puff puff-3" cx="52" cy="38" r="13" fill="#ECEFF1"></circle>
  <circle class="puff puff-4" cx="34" cy="42" r="10" fill="#CFD8DC"></circle>
</g>`;

/**
 * @description Draws a grey smoke puff whose circles swell and fade (muzzle smoke).
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The puff <svg>, root 'ss-sprite ss-smoke-puff'.
 * @throws {never} Never throws.
 * @example
 *   smokePuff();
 * @since 1.0.0
 */
export function smokePuff({className = ''} = NO_OPTIONS) {
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-smoke-puff', className),
    content: SMOKE_CONTENT
  });
}

const SOOT_CONTENT = svg`
  <g class="soot-body">
    <path d="M20 62C12 62 10 50 20 48C18 36 34 30 42 38C46 26 66 26 68 38C78 34 90 42 84 54
      C92 58 88 70 78 68C74 76 60 76 56 70C50 76 34 76 30 68C26 70 20 68 20 62Z"
      fill="#37302C"></path>
    <path d=${circlePath(36, 54, 4) + circlePath(58, 48, 5) + circlePath(70, 60, 3.5)}
      fill="#1E1A18" opacity="0.8"></path>
  </g>
  <path class="soot-spark spark-1" d=${sparklePath(22, 30, 4)} fill="#FF9800">
  </path>
  <path class="soot-spark spark-2" d=${sparklePath(84, 26, 3.4)} fill="#FF9800">
  </path>
  <path class="soot-spark spark-3" d=${sparklePath(76, 84, 3.6)} fill="#FF9800">
  </path>`;

/**
 * @description Draws a sooty black cloud with orange sparks (a backfire or a near miss).
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The cloud <svg>, root 'ss-sprite ss-soot-cloud'.
 * @throws {never} Never throws.
 * @example
 *   sootCloud();
 * @since 1.0.0
 */
export function sootCloud({className = ''} = NO_OPTIONS) {
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-soot-cloud', className),
    content: SOOT_CONTENT
  });
}

const CONFETTI_COLOURS = [
  '#E53935',
  '#FDD835',
  '#43A047',
  '#1E88E5',
  '#8E24AA',
  '#FB8C00',
  '#00ACC1',
  '#EC407A'
];

const CONFETTI_SHAPES = ['strip', 'disc', 'ribbon'];

/**
 * @description One confetti shape in one colour.
 * @param {string} shape - 'strip', 'disc' or 'ribbon'.
 * @param {string} colour - A literal colour, e.g. '#E53935'.
 * @returns {import('lit').SVGTemplateResult} The shape.
 * @throws {never} Never throws.
 * @example
 *   confettiShape('disc', '#E53935');
 * @since 1.0.0
 */
function confettiShape(shape, colour) {
  if (shape === 'disc') {
    return svg`<circle cx="50" cy="50" r="22" fill=${colour}></circle>`;
  }
  if (shape === 'ribbon') {
    return svg`<path d="M28 30Q50 14 50 50T72 70" fill="none" stroke=${colour}
      stroke-width="12" stroke-linecap="round"></path>`;
  }
  return svg`<rect x="38" y="24" width="24" height="52" rx="4" fill=${colour}></rect>`;
}

/**
 * @description Draws one piece of confetti. The colour cycles through eight literal colours
 *   and the shape through strip, disc and ribbon, so indexes 0 to 7 give every colour and
 *   every shape. Non-numeric indexes draw as 0.
 * @param {number} [colourIndex] - Any integer; 0 by default.
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes, e.g. 'ss-anim-confetti-fall'.
 * @returns {import('lit').TemplateResult} The piece <svg>, root 'ss-sprite ss-confetti
 *   ss-confetti-<shape>'.
 * @throws {never} Never throws.
 * @example
 *   confettiPiece(5, {className: 'ss-anim-confetti-fall'});
 * @since 1.0.0
 */
export function confettiPiece(colourIndex = 0, {className = ''} = NO_OPTIONS) {
  const numeric = Number(colourIndex);
  const index = Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
  const colourSlot = ((index % CONFETTI_COLOURS.length) + CONFETTI_COLOURS.length) %
    CONFETTI_COLOURS.length;
  const shape = CONFETTI_SHAPES[((index % 3) + 3) % 3];
  const colour = CONFETTI_COLOURS[colourSlot];
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-confetti', `ss-confetti-${shape}`, className),
    content: svg`<g class="confetti-shape">${confettiShape(shape, colour)}</g>`
  });
}

const BADGE_STYLES = {
  1: {token: 'gold', face: '#FFC107', edge: '#B8860B', ink: '#3E2723'},
  2: {token: 'silver', face: '#CFD8DC', edge: '#78909C', ink: '#263238'},
  3: {token: 'bronze', face: '#D08A4B', edge: '#8D5524', ink: '#3E2723'}
};

const BADGE_OTHER = {token: 'other', face: '#42A5F5', edge: '#1565C0', ink: '#FFFFFF'};

const ROSETTE_PATH = burstPath(50, 42, 34, 28, 16);

/**
 * @description The custom properties a badge root sets for CSS theming of its colourway.
 * @param {{token: string, face: string, edge: string, ink: string}} colourway - A badge style.
 * @returns {Object<string, string>} --badge-face, --badge-edge and --badge-ink for styleMap.
 * @throws {never} Never throws.
 * @example
 *   badgeStyle(BADGE_OTHER)['--badge-face']; // 'var(--ss-badge-other, #42A5F5)'
 * @since 1.1.0
 */
function badgeStyle(colourway) {
  return {
    '--badge-face': paint(`badge-${colourway.token}`, colourway.face),
    '--badge-edge': paint(`badge-${colourway.token}-edge`, colourway.edge),
    '--badge-ink': paint(`badge-${colourway.token}-ink`, colourway.ink)
  };
}

/**
 * @description Draws a rosette with the finishing position on it: gold for 1st, silver for
 *   2nd, bronze for 3rd and blue after that. Shown on finished squirrels (SPEC.md § 11.9).
 *   A missing or invalid position shows '?'. Each colourway is themeable as
 *   --ss-badge-<colourway>, -edge and -ink.
 * @param {number|string} position - The finishing position, 1 upwards.
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The badge <svg>, root 'ss-sprite ss-badge
 *   ss-badge-<gold|silver|bronze|other>'.
 * @throws {never} Never throws.
 * @example
 *   positionBadge(1);
 * @since 1.0.0
 */
export function positionBadge(position, {className = ''} = NO_OPTIONS) {
  const place = Number.parseInt(position, 10);
  const valid = Number.isInteger(place) && place > 0;
  const style = valid && BADGE_STYLES[place] ? BADGE_STYLES[place] : BADGE_OTHER;
  const label = valid ? String(place) : '?';
  const content = svg`
    <path d="M36 62L26 96L38 90L44 98L50 66Z" fill="#C62828"></path>
    <path d="M64 62L74 96L62 90L56 98L50 66Z" fill="#1565C0">
    </path>
    <path class="badge-face badge-edge" d=${ROSETTE_PATH} fill=${style.face}
      stroke=${style.edge} stroke-width="2" stroke-linejoin="round"></path>
    <circle class="badge-face badge-edge" cx="50" cy="42" r="21" fill=${style.face}
      stroke=${style.edge} stroke-width="2.5"></circle>
    <text class="badge-ink" x="50" y="42" dy="0.35em" text-anchor="middle"
      font-family="system-ui, sans-serif" font-size=${label.length > 1 ? 26 : 32}
      font-weight="800" fill=${style.ink}>${label}</text>`;
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-badge', `ss-badge-${style.token}`, className),
    style: badgeStyle(style),
    content
  });
}

/** Every suitor pose ('beckon' is the default). */
export const SUITOR_POSE_IDS = Object.freeze(Object.keys(SUITOR_POSES));

/** Every hunter pose ('walk' is the default). */
export const HUNTER_POSE_IDS = Object.freeze(Object.keys(HUNTER_POSES));

/** Every eagle pose ('fly' is the default). */
export const EAGLE_POSE_IDS = Object.freeze(Object.keys(EAGLE_POSES));

/** Every beaver pose ('idle' is the default). */
export const BEAVER_POSE_IDS = Object.freeze(Object.keys(BEAVER_POSES));

/** The tornado's debris sprites by id, so a stage can pick and orbit them. */
export const TORNADO_DEBRIS = Object.freeze({
  leaf: leafSprite,
  gnome: gnomeSprite,
  cow: cowSprite
});

/** Every debris id. */
export const TORNADO_DEBRIS_IDS = Object.freeze(Object.keys(TORNADO_DEBRIS));
