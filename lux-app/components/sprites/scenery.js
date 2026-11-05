import {svg} from 'lit';
import {
  burstPath,
  chestnutFragment,
  circlePath,
  classNames,
  paint,
  pathCommand,
  pickId,
  roundCoordinate,
  sparklePath,
  spriteSvg
} from './squirrel.js';

/**
 * Squirrel Scramble sprite kit, part 3: the scenery (SPEC.md § 8 race view, § 12): the lane
 * trees with a chestnut on top, a standalone chestnut, the woodland crowd, the skies, and the
 * weather art (Chaos v2 contract § 14): the static rain sheet, a splash ripple and a small
 * thundercloud. None of the weather art animates itself: the stage moves the HTML around it.
 *
 * Every export returns a decorative <svg> (aria-hidden) built by spriteSvg. Every function is
 * pure: no DOM, no randomness, no clock. Unknown ids fall back to the first id of their list.
 *
 * Colours are literal values in the SVG presentation attributes, never `var()` there: a
 * presentation attribute holding `var()` is not honoured (see squirrel.js). Two palettes stay
 * themeable through CSS. A crowd animal's root sets --fur, --fur-dark and --belly (themeable
 * as --ss-crowd-<kind>, --ss-crowd-<kind>-paw, or -wing for the owl, and
 * --ss-crowd-<kind>-belly) for its ss-fur classes. A sky's root sets --sky-top-colour and
 * --sky-bottom-colour (themeable as --ss-sky-<preset>-top and -bottom) for its sky-top and
 * sky-bottom classes; the sky colours match the theme config's presets. animations.js applies
 * both, and without that sheet the literal colours still draw every part right.
 */

/** The default options object: no extra classes. */
const NO_OPTIONS = Object.freeze({});

/** Tree viewBox width; the height is the caller's. */
const TREE_WIDTH = 60;

/** Where the trunk ends under the canopy. */
const TREE_TOP = 26;

const MIN_TREE_HEIGHT = 120;
const MAX_TREE_HEIGHT = 2000;
const DEFAULT_TREE_HEIGHT = 300;

/**
 * @description Clamps a value to a range, with a fallback for anything non-numeric.
 * @param {*} value - The candidate.
 * @param {number} minimum - Lowest allowed value.
 * @param {number} maximum - Highest allowed value.
 * @param {number} fallback - Used when the value is not a finite number.
 * @returns {number} A number between minimum and maximum.
 * @throws {never} Never throws.
 * @example
 *   clampNumber('abc', 120, 2000, 300); // 300
 * @since 1.0.0
 */
function clampNumber(value, minimum, maximum, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, numeric));
}

/**
 * @description Path data for an ellipse drawn with two arcs, so several fit in one path.
 * @param {number} centreX - Centre x.
 * @param {number} centreY - Centre y.
 * @param {number} radiusX - Horizontal radius.
 * @param {number} radiusY - Vertical radius.
 * @returns {string} Closed path data.
 * @throws {never} Never throws.
 * @example
 *   ellipsePath(42, 18, 5, 14);
 * @since 1.0.0
 */
function ellipsePath(centreX, centreY, radiusX, radiusY) {
  const width = roundCoordinate(radiusX * 2);
  const arc = `${roundCoordinate(radiusX)} ${roundCoordinate(radiusY)} 0 1 0`;
  return `${pathCommand('M', centreX - radiusX, centreY)}a${arc} ${width} 0a${arc} ${-width} 0Z`;
}

/**
 * @description Path data for the trunk: flared roots at the base, tapering to the canopy.
 * @param {number} treeHeight - The viewBox height.
 * @returns {string} Closed path data.
 * @throws {never} Never throws.
 * @example
 *   trunkPath(300);
 * @since 1.0.0
 */
function trunkPath(treeHeight) {
  return [
    pathCommand('M', 12, treeHeight),
    pathCommand('C', 17, treeHeight - 3, 19, treeHeight - 10, 20, treeHeight - 24),
    pathCommand('C', 22, treeHeight * 0.55, 23.5, treeHeight * 0.3, 24, TREE_TOP),
    pathCommand('L', 36, TREE_TOP),
    pathCommand('C', 36.5, treeHeight * 0.3, 38, treeHeight * 0.55, 40, treeHeight - 24),
    pathCommand('C', 41, treeHeight - 10, 43, treeHeight - 3, 48, treeHeight),
    'Z'
  ].join('');
}

/**
 * @description Path data for the shaded right side of the trunk.
 * @param {number} treeHeight - The viewBox height.
 * @returns {string} Closed path data.
 * @throws {never} Never throws.
 * @example
 *   trunkShadePath(300);
 * @since 1.0.0
 */
function trunkShadePath(treeHeight) {
  return [
    pathCommand('M', 32.5, TREE_TOP),
    pathCommand('C', 33.5, treeHeight * 0.3, 35, treeHeight * 0.55, 37, treeHeight - 24),
    pathCommand('L', 40, treeHeight - 24),
    pathCommand('C', 38, treeHeight * 0.55, 36.5, treeHeight * 0.3, 36, TREE_TOP),
    'Z'
  ].join('');
}

/**
 * @description Path data for bark marks: short curved strokes, alternating sides, every 34
 *   units down the trunk.
 * @param {number} treeHeight - The viewBox height.
 * @returns {string} Open path data (may be empty on a very short tree).
 * @throws {never} Never throws.
 * @example
 *   barkPath(300);
 * @since 1.0.0
 */
function barkPath(treeHeight) {
  const marks = [];
  for (let markY = 60; markY < treeHeight - 30; markY += 34) {
    const markX = marks.length % 2 === 0 ? 27 : 33;
    marks.push(`${pathCommand('M', markX, markY)}q1.6 5 0 10`);
  }
  return marks.join('');
}

/**
 * @description The tree's three branches, alternating right and left, each ending in a leaf
 *   clump with a lighter highlight.
 * @param {number} treeHeight - The viewBox height.
 * @returns {{branches: string, leaves: string, highlights: string}} Path data for each layer.
 * @throws {never} Never throws.
 * @example
 *   branchArt(300).branches;
 * @since 1.0.0
 */
function branchArt(treeHeight) {
  const branches = [];
  const leaves = [];
  const highlights = [];
  [0.32, 0.52, 0.72].forEach((fraction, index) => {
    const level = TREE_TOP + 24 + (treeHeight - TREE_TOP - 60) * fraction;
    const direction = index % 2 === 0 ? 1 : -1;
    const startX = direction > 0 ? 35 : 25;
    const tipX = startX + direction * 18;
    const tipY = level - 16;
    branches.push(
      [
        pathCommand('M', startX, level),
        pathCommand(
          'C',
          startX + direction * 7,
          level - 4,
          startX + direction * 13,
          level - 10,
          tipX,
          tipY
        )
      ].join('')
    );
    leaves.push(circlePath(tipX + direction * 0.5, tipY - 1, 6));
    highlights.push(circlePath(tipX - direction * 1.5, tipY - 3, 2.6));
  });
  return {branches: branches.join(''), leaves: leaves.join(''), highlights: highlights.join('')};
}

const CANOPY_LEAVES = circlePath(17, 34, 11) + circlePath(43, 34, 11) + circlePath(30, 26, 13);
const CANOPY_HIGHLIGHTS =
  circlePath(13.5, 30, 4.5) + circlePath(39.5, 30, 4.5) + circlePath(26, 20.5, 5.5);

/**
 * @description Draws a lane tree: trunk with bark marks, three branches, leaf clumps and a
 *   chestnut on top (group class 'chestnut', which 'ss-anim-chestnut-bounce' bounces). The
 *   viewBox is 0 0 60 <height>, anchored at the bottom: pass about 60 x laneHeight / laneWidth
 *   so the tree fills its lane without stretching.
 * @param {Object} [options] - Size, motion and classes.
 * @param {number} [options.height] - viewBox height, 120 to 2000 (default 300).
 * @param {boolean} [options.swaying] - Adds the gentle sway class 'ss-tree-swaying'.
 * @param {string} [options.className] - Extra root classes, e.g. 'ss-anim-tree-bend'.
 * @returns {import('lit').TemplateResult} The tree <svg>, root 'ss-sprite ss-tree'.
 * @throws {never} Never throws.
 * @example
 *   treeSprite({height: 600, swaying: true});
 * @since 1.0.0
 */
export function treeSprite({
  height = DEFAULT_TREE_HEIGHT,
  swaying = false,
  className = ''
} = NO_OPTIONS) {
  const treeHeight = roundCoordinate(
    clampNumber(height, MIN_TREE_HEIGHT, MAX_TREE_HEIGHT, DEFAULT_TREE_HEIGHT)
  );
  const art = branchArt(treeHeight);
  const content = svg`<g class="tree-rig">
    <path class="branches" d=${art.branches} fill="none" stroke="#6D4C41"
      stroke-width="3.2" stroke-linecap="round"></path>
    <path class="trunk" d=${trunkPath(treeHeight)} fill="#8D6E63"></path>
    <path class="trunk-shade" d=${trunkShadePath(treeHeight)}
      fill="#5D4037" opacity="0.35"></path>
    <path class="bark" d=${barkPath(treeHeight)} fill="none"
      stroke="#5D4037" stroke-width="1" stroke-linecap="round" opacity="0.7">
    </path>
    <path class="leaves" d=${art.leaves + CANOPY_LEAVES} fill="#2E7D32">
    </path>
    <path class="leaves-light" d=${art.highlights + CANOPY_HIGHLIGHTS}
      fill="#43A047"></path>
    ${chestnutFragment(30, 11, 7)}
  </g>`;
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-tree', swaying ? 'ss-tree-swaying' : '', className),
    viewBox: `0 0 ${TREE_WIDTH} ${treeHeight}`,
    preserveAspectRatio: 'xMidYMax meet',
    content
  });
}

const CHESTNUT_CONTENT = chestnutFragment(50, 52, 34);

/**
 * @description Draws a big glossy chestnut (the prize at the top of every tree).
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes, e.g. 'ss-anim-chestnut-bounce'.
 * @returns {import('lit').TemplateResult} The chestnut <svg>, root 'ss-sprite
 *   ss-chestnut-sprite'.
 * @throws {never} Never throws.
 * @example
 *   chestnut({className: 'ss-anim-chestnut-bounce'});
 * @since 1.0.0
 */
export function chestnut({className = ''} = NO_OPTIONS) {
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-chestnut-sprite', className),
    content: CHESTNUT_CONTENT
  });
}

// The woodland crowd faces the viewer. Arms run from shoulders at (33, 64) and (67, 64).
const CROWD_POSES = {
  idle: {left: [35, 82], right: [65, 82], eyes: 'dots', mouth: 'smile'},
  wave: {left: [26, 34], right: [74, 34], eyes: 'happy', mouth: 'open'},
  gasp: {left: [37, 51], right: [63, 51], eyes: 'wide', mouth: 'gasp'}
};

const CROWD_EYES = {
  dots: svg`<path d=${circlePath(43.5, 42, 2.2) + circlePath(56.5, 42, 2.2)}
    fill="#2B1D16"></path>`,
  happy: svg`<path d="M40.5 43.5Q43.5 39 46.5 43.5M53.5 43.5Q56.5 39 59.5 43.5" fill="none"
    stroke="#2B1D16" stroke-width="1.6" stroke-linecap="round"></path>`,
  wide: svg`
    <path d=${circlePath(43.5, 41.5, 3.6) + circlePath(56.5, 41.5, 3.6)}
      fill="#FFFFFF" stroke="#2B1D16" stroke-width="0.6">
    </path>
    <path d=${circlePath(43.5, 41.5, 1.3) + circlePath(56.5, 41.5, 1.3)}
      fill="#2B1D16"></path>`
};

const CROWD_MOUTHS = {
  smile: svg`<path d="M46.5 52.5Q50 55.5 53.5 52.5" fill="none" stroke="#2B1D16"
    stroke-width="1.3" stroke-linecap="round"></path>`,
  open: svg`<path d="M45.5 51.5Q50 59 54.5 51.5Z" fill="#6D1B1B"></path>`,
  gasp: svg`<ellipse cx="50" cy="54" rx="2.4" ry="3" fill="#6D1B1B"></ellipse>`
};

// Per animal: the literal coat colours (body, belly, and the darker arm colour of its paws or
// wings, whose theme token ends in limbToken), what sits behind (spines), the face and the
// nose. Coat parts carry the ss-fur classes, so crowdStyle's custom properties re-colour them.
const CROWD_ART = {
  hedgehog: {
    body: '#A1887F',
    belly: '#D7CCC8',
    arm: '#8D6E63',
    limbToken: 'paw',
    behind: svg`<path d=${burstPath(50, 50, 34, 26, 18)}
      fill="#5D4037"></path>`,
    face: svg`
      <path class="ss-fur-dark" d=${circlePath(38, 31, 3.2) + circlePath(62, 31, 3.2)}
        fill="#8D6E63"></path>
      <circle class="ss-fur" cx="50" cy="44" r="17" fill="#A1887F"></circle>
      <ellipse class="ss-fur-belly" cx="50" cy="47" rx="12" ry="11" fill="#D7CCC8">
      </ellipse>`,
    nose: svg`<ellipse cx="50" cy="48.5" rx="2.6" ry="2" fill="#3E2723">
    </ellipse>`
  },
  rabbit: {
    body: '#BDBDBD',
    belly: '#FAFAFA',
    arm: '#9E9E9E',
    limbToken: 'paw',
    behind: svg`
      <path class="ss-fur" d=${ellipsePath(42, 18, 5, 14) + ellipsePath(58, 18, 5, 14)}
        fill="#BDBDBD"></path>
      <path d=${ellipsePath(42, 19, 2.4, 10) + ellipsePath(58, 19, 2.4, 10)}
        fill="#F8BBD0"></path>`,
    face: svg`
      <circle class="ss-fur" cx="50" cy="44" r="16" fill="#BDBDBD"></circle>
      <ellipse class="ss-fur-belly" cx="50" cy="50" rx="8" ry="6" fill="#FAFAFA">
      </ellipse>
      <rect x="48.5" y="52.5" width="3" height="3.5" rx="0.6" fill="#FFFFFF"
        stroke="#2B1D16" stroke-width="0.4"></rect>`,
    nose: svg`<ellipse cx="50" cy="48" rx="2.2" ry="1.6"
      fill="#F48FB1"></ellipse>`
  },
  owl: {
    body: '#8D6E63',
    belly: '#D7CCC8',
    arm: '#6D4C41',
    limbToken: 'wing',
    behind: svg`<path class="ss-fur-dark" d="M34 32L35 17L45 28ZM66 32L65 17L55 28Z"
      fill="#6D4C41"></path>`,
    face: svg`
      <circle class="ss-fur" cx="50" cy="44" r="18" fill="#8D6E63"></circle>
      <path class="ss-fur-belly" d=${circlePath(43, 42, 7.5) + circlePath(57, 42, 7.5)}
        fill="#D7CCC8"></path>
      <path d=${circlePath(43.5, 42, 4.4) + circlePath(56.5, 42, 4.4)}
        fill="#FFA726"></path>`,
    nose: svg`<path d="M50 52L47.4 47.5H52.6Z" fill="#FFB300"></path>`
  },
  badger: {
    body: '#9E9E9E',
    belly: '#BDBDBD',
    arm: '#424242',
    limbToken: 'paw',
    behind: svg`<path class="ss-fur-dark" d=${circlePath(36, 31, 3.5) + circlePath(64, 31, 3.5)}
      fill="#424242"></path>`,
    face: svg`
      <circle cx="50" cy="44" r="17" fill="#FAFAFA"></circle>
      <path d="M41 28C39.5 34 39.5 40 41.5 48H46.5C45 40 45 34 46 28ZM59 28C60.5 34 60.5 40
        58.5 48H53.5C55 40 55 34 54 28Z" fill="#37474F"></path>
      <path d=${circlePath(43.5, 42, 3.2) + circlePath(56.5, 42, 3.2)}
        fill="#FFFFFF"></path>`,
    nose: svg`<ellipse cx="50" cy="49" rx="2.8" ry="2.1" fill="#212121">
    </ellipse>`
  },
  fox: {
    body: '#EF6C00',
    belly: '#FAFAFA',
    arm: '#E65100',
    limbToken: 'paw',
    behind: svg`
      <path class="ss-fur" d="M34 34L36 16L46 28ZM66 34L64 16L54 28Z" fill="#EF6C00">
      </path>
      <path d="M35.2 22.5L36 16L39.8 20.5ZM64.8 22.5L64 16L60.2 20.5Z"
        fill="#3E2723"></path>`,
    face: svg`
      <circle class="ss-fur" cx="50" cy="44" r="16" fill="#EF6C00"></circle>
      <path class="ss-fur-belly"
        d="M37.5 46C40 54 46 58.5 50 58.5C54 58.5 60 54 62.5 46C58 50 42 50 37.5 46Z"
        fill="#FAFAFA"></path>`,
    nose: svg`<ellipse cx="50" cy="48.5" rx="2.6" ry="2" fill="#212121">
    </ellipse>`
  }
};

/**
 * @description The custom properties a crowd animal's root sets for CSS theming of its coat.
 * @param {string} kindId - A known crowd kind.
 * @returns {Object<string, string>} --fur, --fur-dark and --belly values for styleMap.
 * @throws {never} Never throws.
 * @example
 *   crowdStyle('owl')['--fur-dark']; // 'var(--ss-crowd-owl-wing, #6D4C41)'
 * @since 1.1.0
 */
function crowdStyle(kindId) {
  const art = CROWD_ART[kindId];
  return {
    '--fur': paint(`crowd-${kindId}`, art.body),
    '--fur-dark': paint(`crowd-${kindId}-${art.limbToken}`, art.arm),
    '--belly': paint(`crowd-${kindId}-belly`, art.belly)
  };
}

/**
 * @description Draws one member of the woodland crowd, facing the viewer. 'wave' raises both
 *   arms (animations.js waves them), 'gasp' puts paws to cheeks with an open mouth. Unknown
 *   kinds draw as a hedgehog and unknown poses as idle. Set --ss-crowd-delay on an ancestor
 *   to stagger a Mexican wave. Each animal's coat is themeable (see crowdStyle).
 * @param {string} [kind] - 'hedgehog' (default), 'rabbit', 'owl', 'badger' or 'fox'.
 * @param {string} [pose] - 'idle' (default), 'wave' or 'gasp'.
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The animal <svg>, root 'ss-sprite ss-crowd
 *   ss-crowd-<kind> ss-pose-<pose>'.
 * @throws {never} Never throws.
 * @example
 *   crowdAnimal('fox', 'wave');
 * @since 1.0.0
 */
export function crowdAnimal(kind = 'hedgehog', pose = 'idle', {className = ''} = NO_OPTIONS) {
  const kindId = pickId(CROWD_ART, kind, 'hedgehog');
  const poseId = pickId(CROWD_POSES, pose, 'idle');
  const art = CROWD_ART[kindId];
  const poseSpec = CROWD_POSES[poseId];
  const content = svg`<g class="ss-motion">
    ${art.behind}
    <g class="crowd-body">
      <ellipse class="ss-fur" cx="50" cy="74" rx="20" ry="19" fill=${art.body}></ellipse>
      <ellipse class="ss-fur-belly" cx="50" cy="78" rx="12" ry="13" fill=${art.belly}></ellipse>
      <path class="ss-fur-dark" d=${circlePath(42, 93, 5) + circlePath(58, 93, 5)}
        fill=${art.arm}></path>
    </g>
    <g class="crowd-head">
      ${art.face}
      <g class="eyes">${CROWD_EYES[poseSpec.eyes]}</g>
      ${art.nose}
      <g class="mouth">${CROWD_MOUTHS[poseSpec.mouth]}</g>
    </g>
    <g class="arm-left">
      <line class="ss-fur-dark-stroke" x1="33" y1="64" x2=${poseSpec.left[0]}
        y2=${poseSpec.left[1]} stroke=${art.arm} stroke-width="6" stroke-linecap="round"></line>
    </g>
    <g class="arm-right">
      <line class="ss-fur-dark-stroke" x1="67" y1="64" x2=${poseSpec.right[0]}
        y2=${poseSpec.right[1]} stroke=${art.arm} stroke-width="6" stroke-linecap="round">
      </line>
    </g>
  </g>`;
  return spriteSvg({
    rootClass: classNames(
      'ss-sprite',
      'ss-crowd',
      `ss-crowd-${kindId}`,
      `ss-pose-${poseId}`,
      className
    ),
    style: crowdStyle(kindId),
    content
  });
}

// Skies: 160 by 90 (16:9), sliced to cover the stage.
const SKY_VIEW_BOX = '0 0 160 90';

const CLOUD_PATH =
  'M4 16C0 16 0 9 5 9C5 3 13 1 17 5C19 0 29 0 31 6C36 5 40 9 38 13C38 15 36 16 34 16Z';

/**
 * @description One cloud, positioned and scaled by a wrapper so its inner group can drift.
 * @param {string} cloudClass - 'cloud-1', 'cloud-2' or 'cloud-3' (drift timing).
 * @param {number} offsetX - Wrapper x translation.
 * @param {number} offsetY - Wrapper y translation.
 * @param {number} scale - Wrapper scale.
 * @param {string} colour - A literal colour, e.g. '#FFFFFF'.
 * @returns {import('lit').SVGTemplateResult} The cloud.
 * @throws {never} Never throws.
 * @example
 *   cloud('cloud-1', 14, 12, 1, '#FFFFFF');
 * @since 1.0.0
 */
function cloud(cloudClass, offsetX, offsetY, scale, colour) {
  return svg`<g transform="translate(${offsetX} ${offsetY}) scale(${scale})">
    <g class="cloud ${cloudClass}"><path d=${CLOUD_PATH} fill=${colour}></path></g>
  </g>`;
}

/**
 * @description The sky's background: a top colour with three translucent bands of the
 *   horizon colour, a stepped gradient that needs no gradient ids. The rectangles carry the
 *   sky-top and sky-bottom classes, so skyStyle's custom properties can re-colour them.
 * @param {string} topHex - Top colour.
 * @param {string} bottomHex - Horizon colour.
 * @returns {import('lit').SVGTemplateResult} The background rectangles.
 * @throws {never} Never throws.
 * @example
 *   skyBands('#7EC8F2', '#DFF3FF');
 * @since 1.0.0
 */
function skyBands(topHex, bottomHex) {
  return svg`
    <rect class="sky-top" width="160" height="90" fill=${topHex}></rect>
    <rect class="sky-bottom" y="30" width="160" height="60" fill=${bottomHex} opacity="0.3">
    </rect>
    <rect class="sky-bottom" y="50" width="160" height="40" fill=${bottomHex} opacity="0.45">
    </rect>
    <rect class="sky-bottom" y="68" width="160" height="22" fill=${bottomHex} opacity="0.65">
    </rect>`;
}

const NIGHT_STAR_PATHS = [
  sparklePath(12, 10, 1.4) + sparklePath(40, 18, 1.1) + sparklePath(70, 8, 1.3),
  sparklePath(25, 30, 1) + sparklePath(98, 14, 1.4) + sparklePath(150, 30, 1.1),
  sparklePath(56, 26, 1.2) + sparklePath(84, 34, 1) + sparklePath(112, 6, 1.2)
];

const FIREFLY_POINTS = [
  [20, 70],
  [44, 78],
  [70, 66],
  [96, 80],
  [122, 72],
  [146, 82]
];

// Each preset: its colours (as in the theme config) and what sits in the sky. The night moon's
// shadow is the sky's top colour, so it carries the sky-top class too.
const SKY_ART = {
  day: {
    key: 'day',
    top: '#7EC8F2',
    bottom: '#DFF3FF',
    extras: svg`
      <circle class="sun-glow" cx="134" cy="18" r="15" fill="#FFF59D"
        opacity="0.45"></circle>
      <circle cx="134" cy="18" r="9" fill="#FFE082"></circle>
      ${cloud('cloud-1', 14, 12, 1, '#FFFFFF')}
      ${cloud('cloud-2', 72, 24, 0.8, '#FFFFFF')}`
  },
  golden_hour: {
    key: 'golden-hour',
    top: '#F6A04D',
    bottom: '#FDE3A7',
    extras: svg`
      <circle class="sun-glow" cx="120" cy="72" r="24"
        fill="#FFE0B2" opacity="0.45"></circle>
      <circle cx="120" cy="72" r="15" fill="#FFB74D"></circle>
      <g class="cloud cloud-1">
        <path d="M8 30H58M30 38H92M96 24H152" fill="none" stroke="#F8BBD0"
          stroke-width="3" stroke-linecap="round" opacity="0.7"></path>
      </g>`
  },
  night: {
    key: 'night',
    top: '#0B1D3A',
    bottom: '#2A3F6B',
    extras: svg`
      <circle cx="132" cy="18" r="9" fill="#FFF9C4"></circle>
      <circle class="sky-top" cx="136.5" cy="15" r="8" fill="#0B1D3A"></circle>
      ${NIGHT_STAR_PATHS.map(
        (starsPath, index) => svg`<path class="star-twinkle twinkle-${index + 1}" d=${starsPath}
          fill="#FFF9C4"></path>`
      )}
      ${FIREFLY_POINTS.map(
        ([fireflyX, fireflyY], index) => svg`<circle class="firefly firefly-${index + 1}"
          cx=${fireflyX} cy=${fireflyY} r="1.1" fill="#F0F4C3"
          stroke="#DCE775" stroke-opacity="0.5" stroke-width="2">
        </circle>`
      )}`
  },
  // Overcast and grey-blue, with soft pale clouds (Chaos v2 contract § 14). Its light rain is
  // drawn by the stage in HTML layers (rainSheetSprite), never inside the sky.
  drizzle: {
    key: 'drizzle',
    top: '#8FA3B8',
    bottom: '#D5DEE7',
    extras: svg`
      ${cloud('cloud-1', -2, 6, 1.9, '#E3E9EF')}
      ${cloud('cloud-3', 98, 10, 1.7, '#DCE3EA')}
      ${cloud('cloud-2', 50, 1, 2.1, '#EEF2F6')}`
  },
  // Dark storm clouds. Its rain is drawn by the stage in HTML layers (rainSheetSprite): the sky
  // itself no longer animates rain (contract § 14).
  storm: {
    key: 'storm',
    top: '#3A3F47',
    bottom: '#7A828C',
    extras: svg`
      ${cloud('cloud-1', -4, 2, 2.2, '#546E7A')}
      ${cloud('cloud-3', 104, 6, 2, '#546E7A')}
      ${cloud('cloud-2', 52, -2, 2.6, '#455A64')}`
  }
};

/**
 * @description The custom properties a sky's root sets for CSS theming of its time-of-day
 *   colours.
 * @param {{key: string, top: string, bottom: string}} art - A preset from SKY_ART.
 * @returns {Object<string, string>} --sky-top-colour and --sky-bottom-colour for styleMap.
 * @throws {never} Never throws.
 * @example
 *   skyStyle(SKY_ART.night)['--sky-top-colour']; // 'var(--ss-sky-night-top, #0B1D3A)'
 * @since 1.1.0
 */
function skyStyle(art) {
  return {
    '--sky-top-colour': paint(`sky-${art.key}-top`, art.top),
    '--sky-bottom-colour': paint(`sky-${art.key}-bottom`, art.bottom)
  };
}

/**
 * @description Draws a sky backdrop: day (sun and clouds), golden hour (a low sun and wisps),
 *   night (moon, stars and fireflies), drizzle (overcast, soft pale clouds) or storm (dark
 *   clouds). The rain is not part of the sky (rainSheetSprite). viewBox 0 0 160 90, sliced to
 *   cover whatever box it is given. Unknown presets draw as day.
 * @param {string} [preset] - 'day' (default), 'golden_hour', 'night', 'drizzle' or 'storm'.
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The sky <svg>, root 'ss-sprite ss-sky
 *   ss-sky-<preset>'.
 * @throws {never} Never throws.
 * @example
 *   skyBackdrop('storm');
 * @since 1.0.0
 */
export function skyBackdrop(preset = 'day', {className = ''} = NO_OPTIONS) {
  const presetId = pickId(SKY_ART, preset, 'day');
  const art = SKY_ART[presetId];
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-sky', `ss-sky-${presetId}`, className),
    viewBox: SKY_VIEW_BOX,
    preserveAspectRatio: 'xMidYMid slice',
    style: skyStyle(art),
    content: svg`${skyBands(art.top, art.bottom)}${art.extras}`
  });
}

// A rain sheet: one rain tile wide and two tall (components/stage-weather.js lays the streaks
// out), stretched over its HTML layer. Its strokes keep their screen thickness however far it
// stretches.
const RAIN_SHEET_VIEW_BOX = '0 0 280 200';
const DEFAULT_RAIN_COLOUR = '#CFE3F2';
const HEX_COLOUR = /^#[0-9A-Fa-f]{6}$/;

/**
 * @description Draws one static rain sheet (Chaos v2 contract § 14): a few paths of streaks, one
 *   per thickness and opacity, laid out by the stage from the race seed. Nothing inside it moves:
 *   the stage moves the HTML layer that holds it, so the compositor runs the fall. Strokes use
 *   vector-effect non-scaling-stroke, so the sheet may stretch to its layer (preserveAspectRatio
 *   none) and a streak stays 1 to 2.5 px thick on screen.
 * @param {Object} [options] - What to draw.
 * @param {Array<{d: string, width: number, opacity: number}>} [options.groups] - Path groups
 *   from streakGroups, in viewBox units.
 * @param {string} [options.colour] - The streaks' colour, a literal #RRGGBB.
 * @param {string} [options.viewBox] - The sheet's viewBox (default '0 0 280 200').
 * @returns {import('lit').TemplateResult} The sheet <svg>, root 'ss-rain-sheet'.
 * @throws {never} Never throws.
 * @example
 *   rainSheetSprite({groups: streakGroups(layer.streaks), colour: '#CFE3F2'});
 * @since 2.2.0
 */
export function rainSheetSprite({
  groups = [],
  colour = DEFAULT_RAIN_COLOUR,
  viewBox = RAIN_SHEET_VIEW_BOX
} = NO_OPTIONS) {
  const stroke = typeof colour === 'string' && HEX_COLOUR.test(colour)
    ? colour
    : DEFAULT_RAIN_COLOUR;
  const paths = (Array.isArray(groups) ? groups : [])
    .filter((group) => group && typeof group.d === 'string' && group.d !== '')
    .map((group) => svg`<path d=${group.d} fill="none" stroke=${stroke}
      stroke-width=${clampNumber(group.width, 0.5, 4, 1)}
      stroke-opacity=${clampNumber(group.opacity, 0, 1, 0.4)}
      stroke-linecap="round" vector-effect="non-scaling-stroke"></path>`);
  return spriteSvg({
    rootClass: 'ss-rain-sheet',
    viewBox,
    preserveAspectRatio: 'none',
    content: svg`${paths}`
  });
}

/**
 * @description Draws a small splash ripple for the grass strip (Chaos v2 contract § 14): two
 *   rings and two flying drops. Static: the stage scales and fades the HTML element around it.
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The ripple <svg>, root 'ss-sprite ss-splash'.
 * @throws {never} Never throws.
 * @example
 *   splashRippleSprite();
 * @since 2.2.0
 */
export function splashRippleSprite({className = ''} = NO_OPTIONS) {
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-splash', className),
    viewBox: '0 0 20 9',
    content: svg`
      <ellipse cx="10" cy="6.2" rx="8.4" ry="2.4" fill="none" stroke="#E3F2FD"
        stroke-width="1.1" opacity="0.9"></ellipse>
      <ellipse cx="10" cy="6.2" rx="4.2" ry="1.2" fill="none" stroke="#E3F2FD"
        stroke-width="0.8" opacity="0.6"></ellipse>
      <circle cx="6.5" cy="2.2" r="0.9" fill="#E3F2FD"></circle>
      <circle cx="13.2" cy="1.4" r="0.7" fill="#E3F2FD"></circle>`
  });
}

/**
 * @description Draws a small cartoon thundercloud (Chaos v2 contract § 14): the dark puff a
 *   lightning strike comes out of when the sky has no storm clouds of its own. Static: the stage
 *   rolls it in and out over the struck tree.
 * @param {Object} [options] - Classes.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The cloud <svg>, root 'ss-sprite ss-thundercloud'.
 * @throws {never} Never throws.
 * @example
 *   thundercloudSprite();
 * @since 2.2.0
 */
export function thundercloudSprite({className = ''} = NO_OPTIONS) {
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-thundercloud', className),
    viewBox: '0 0 44 24',
    content: svg`<g transform="translate(2 2)">
      <path d=${CLOUD_PATH} fill="#3F4B55" transform="translate(0 3)"></path>
      <path d=${CLOUD_PATH} fill="#5B6B78"></path>
      <path d="M8 9C8 6 12 4 15 6M22 5C24 3 28 3 29 6" fill="none" stroke="#8193A0"
        stroke-width="1.4" stroke-linecap="round"></path>
    </g>`
  });
}

/** Every crowd animal ('hedgehog' first). */
export const CROWD_KIND_IDS = Object.freeze(Object.keys(CROWD_ART));

/** Every crowd pose ('idle' first). */
export const CROWD_POSE_IDS = Object.freeze(Object.keys(CROWD_POSES));

/** Every sky preset ('day' first). */
export const SKY_PRESET_IDS = Object.freeze(Object.keys(SKY_ART));
