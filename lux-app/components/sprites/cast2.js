import {css, nothing, svg} from 'lit';
import {
  burstPath,
  circlePath,
  classNames,
  pathCommand,
  pickId,
  sparklePath,
  spriteSvg,
  starPath
} from './squirrel.js';

/**
 * Squirrel Scramble sprite kit, Chaos v2 cast (docs/specs/squirrel-scramble-chaos-v2.md § 4,
 * § 5): the cat lady and her flying cats, the Golden Acorn of Doom, the sharknado shark, the
 * gardener with his leaf blower and the gust he makes, the UFO and the hard-hatted woodpecker.
 * All art is original and slapstick-PG.
 *
 * Every export returns a decorative <svg> (aria-hidden) built by spriteSvg, viewBox
 * 0 0 100 100 unless its JSDoc says otherwise, facing right like the rest of the kit (add
 * 'ss-flip' to face left). Unknown pose ids fall back to the sprite's default pose. Every
 * function is pure: no DOM, no randomness, no clock.
 *
 * Colours: every SVG presentation attribute holds a literal hex, so a sprite draws correctly
 * with no stylesheet. A few key parts also carry a class that cast2Animations recolours from
 * a theme token: each sprite root declares a private custom property as
 * `var(--ss-<token>, #hex)` and the part reads it, so `var()` never sits in an SVG attribute.
 * Movable parts sit in <g> groups whose classes carry a sprite prefix (ss-cl-, ss-fc-, ss-ga-,
 * ss-sk-, ss-gd-, ss-lg-, ss-ufo-, ss-wp-), and an animated group never carries a transform
 * attribute: positioning transforms sit on a plain wrapper group around it.
 */

/** The default options object: default pose, no extra classes. */
const NO_OPTIONS = Object.freeze({});

/** Ink used for outlines and features across the Chaos v2 cast. */
const INK = '#2B1D16';

/**
 * @description Path data for three short claws fanned out from a paw.
 * @param {number} pawX - The paw's x.
 * @param {number} pawY - The paw's y.
 * @param {number} angleDegrees - The direction the claws point (0 = right, 90 = down).
 * @param {number} [length] - Claw length in viewBox units; 3 by default.
 * @returns {string} Open path data with one sub-path per claw.
 * @throws {never} Never throws.
 * @example
 *   clawFanPath(84, 50, 0); // three claws pointing right
 * @since 2.0.0
 */
function clawFanPath(pawX, pawY, angleDegrees, length = 3) {
  return [-38, 0, 38]
    .map((spread) => {
      const radians = ((angleDegrees + spread) * Math.PI) / 180;
      return [
        pathCommand('M', pawX, pawY),
        pathCommand('l', length * Math.cos(radians), length * Math.sin(radians))
      ].join('');
    })
    .join('');
}

// ---------------------------------------------------------------------------------------------
// The cat lady: hair curlers, a cardigan, pearls and a bottomless handbag full of cats.
// ---------------------------------------------------------------------------------------------

const CAT_LADY_SKIN = '#F2C9A0';
const CAT_LADY_SLEEVE = '#7A4A94';

const CAT_LADY_LEGS = svg`
  <g class="ss-cl-leg-back">
    <path d="M43.5 80L43 92" stroke="#D9B38C" stroke-width="4" stroke-linecap="round"></path>
    <ellipse cx="44.5" cy="93.6" rx="5" ry="2.6" fill="#EC6FA0"></ellipse>
  </g>
  <g class="ss-cl-leg-front">
    <path d="M55 80L56 92" stroke="#E8C9A8" stroke-width="4" stroke-linecap="round"></path>
    <ellipse cx="58" cy="93.8" rx="5.4" ry="2.8" fill="#F48FB1"></ellipse>
    <circle cx="62.6" cy="92.6" r="1.7" fill="#FFFFFF"></circle>
  </g>`;

const DRESS_DOTS_PATH = [
  circlePath(40, 74, 1.2),
  circlePath(47, 79, 1.2),
  circlePath(55, 73, 1.2),
  circlePath(61, 80, 1.2),
  circlePath(36, 81, 1.1)
].join('');

const CARDIGAN_BUTTONS_PATH = [
  circlePath(51.8, 47, 1),
  circlePath(51.8, 54, 1),
  circlePath(51.8, 61, 1)
].join('');

const CAT_LADY_BODY = svg`
  <path class="ss-cl-dress" d="M37 60C36 70 33 78 31 84H69C67 78 64 70 63 60Z" fill="#3E9E9E">
  </path>
  <path d=${DRESS_DOTS_PATH} fill="#FFF59D" opacity="0.9"></path>
  <path class="ss-cl-cardigan"
    d="M38 40C33 46 33 58 36 67H64C67 58 67 46 62 40C56 36 44 36 38 40Z" fill="#8E5BA8">
  </path>
  <path d="M50 39.5V67" stroke="#6A3F80" stroke-width="1"></path>
  <path d=${CARDIGAN_BUTTONS_PATH} fill="#F3E5AB"></path>
  <path d="M45 37.6C48 41.4 56 41.4 59 37.6" fill="none" stroke="#FFFFFF" stroke-width="1.6"
    stroke-dasharray="0.1 2" stroke-linecap="round"></path>`;

// Two cats peek over the rim of the handbag: a ginger one and a black one with yellow eyes.
const BAG_CAT_GINGER_PATH = `${circlePath(28, 59, 4.2)}M24.6 57.2L25.2 51.8L28.4 55.2Z` +
  'M31.4 55.2L34.8 51.8L31.6 57.2Z';
const BAG_CAT_BLACK_PATH = `${circlePath(39.5, 58, 4.2)}M36.1 56.2L36.7 50.8L39.9 54.2Z` +
  'M42.9 54.2L46.3 50.8L43.1 56.2Z';

const CAT_LADY_BAG = svg`<g class="ss-cl-bag">
  <path d="M26 61C26 52.5 42 52.5 42 61" fill="none" stroke="#7B2840" stroke-width="1.8">
  </path>
  <g class="ss-cl-bag-cats">
    <path d=${BAG_CAT_GINGER_PATH} fill="#F08C3A"></path>
    <path d=${circlePath(26.6, 58.4, 0.8) + circlePath(29.6, 58.4, 0.8)} fill=${INK}></path>
    <path d=${BAG_CAT_BLACK_PATH} fill="#2F2B2A"></path>
    <path d=${circlePath(38, 57.4, 1) + circlePath(41, 57.4, 1)} fill="#FFEB3B"></path>
  </g>
  <path class="ss-cl-bag-body"
    d="M21 61.5C21 59.5 47 59.5 47 61.5L45.2 79.5C44.6 82 23.4 82 22.8 79.5Z" fill="#A23B5A">
  </path>
  <path d="M22 66.5H46" stroke="#7B2840" stroke-width="1" opacity="0.6"></path>
  <rect x="31.8" y="60" width="4.4" height="3.2" rx="1" fill="#F2C230"></rect>
</g>`;

// The back arm holds the handbag; the hand is drawn over the handle.
const CAT_LADY_BACK_ARM = svg`
  <path d="M41 44L34 55" stroke=${CAT_LADY_SLEEVE} stroke-width="5" stroke-linecap="round">
  </path>
  ${CAT_LADY_BAG}
  <circle cx="34" cy="55.4" r="2.4" fill=${CAT_LADY_SKIN}></circle>`;

const CAT_LADY_EYES = {
  open: svg`<path d=${circlePath(55, 27.4, 1.1) + circlePath(61.8, 27.8, 1)} fill=${INK}></path>`,
  squint: svg`<path d="M53 27.6L57 27M60.2 27.8L63.4 27.2" fill="none" stroke=${INK}
    stroke-width="1.1" stroke-linecap="round"></path>`,
  laughing: svg`<path d="M53 28Q55 25.6 57 28M60.2 28.2Q61.8 26 63.4 28.2" fill="none"
    stroke=${INK} stroke-width="1" stroke-linecap="round"></path>`
};

const CAT_LADY_MOUTHS = {
  smile: svg`<path d="M57 33Q60 35.2 62.6 33" fill="none" stroke="#B03A5B" stroke-width="1"
    stroke-linecap="round"></path>`,
  gritted: svg`
    <path d="M56.5 32.6H62.8V35H56.5Z" fill="#FFFFFF" stroke="#B03A5B" stroke-width="0.6">
    </path>
    <path d="M56.5 33.8H62.8M58.6 32.6V35M60.7 32.6V35" stroke="#B0BEC5" stroke-width="0.4">
    </path>`,
  // Cackling wide open, with one gold tooth.
  cackle: svg`
    <path d="M55.5 32C56.5 38.5 63.5 38 64 31.6Z" fill="#7A1F2B"></path>
    <rect x="58" y="32" width="1.6" height="1.7" rx="0.3" fill="#F2C230"></rect>`
};

/**
 * @description The cat lady's head: grey bun and hair cap, pink curlers, big round glasses,
 *   rouge, nose and the pose's eyes and mouth.
 * @param {string} eyes - A key of CAT_LADY_EYES.
 * @param {string} mouth - A key of CAT_LADY_MOUTHS.
 * @returns {import('lit').SVGTemplateResult} The head group.
 * @throws {never} Never throws.
 * @example
 *   catLadyHead('laughing', 'cackle');
 * @since 2.0.0
 */
function catLadyHead(eyes, mouth) {
  return svg`<g class="ss-cl-head">
    <circle cx="43" cy="24" r="5" fill="#B8B8C2"></circle>
    <circle cx="52" cy="27" r="10" fill=${CAT_LADY_SKIN}></circle>
    <path d="M41.5 28C40 17 48 13.5 54 14C61 14 65 19.5 63 26C58 21.5 47 22 41.5 28Z"
      fill="#C9C9D1"></path>
    <g class="ss-cl-curler-row">
      <rect class="ss-cl-curlers" x="43.5" y="15" width="5.4" height="3.2" rx="1.6"
        fill="#F06292"></rect>
      <rect class="ss-cl-curlers" x="49.6" y="12.6" width="5.4" height="3.2" rx="1.6"
        fill="#F06292"></rect>
      <rect class="ss-cl-curlers" x="55.8" y="14" width="5.4" height="3.2" rx="1.6"
        fill="#F06292"></rect>
    </g>
    <circle cx="57.5" cy="31.6" r="1.8" fill="#F48FB1" opacity="0.6"></circle>
    ${CAT_LADY_EYES[eyes]}
    <path d=${circlePath(54.5, 27, 3.4) + circlePath(61.4, 27.4, 3)} fill="#E3F2FD"
      fill-opacity="0.3" stroke="#6D4C41" stroke-width="0.9"></path>
    <path d="M57.9 27.2H58.4M51.1 26.6L45 25.6" stroke="#6D4C41" stroke-width="0.9"></path>
    <ellipse cx="63.4" cy="30.2" rx="1.8" ry="1.5" fill="#E8A07E"></ellipse>
    ${CAT_LADY_MOUTHS[mouth]}
  </g>`;
}

// A small startled ginger cat, held overhead ready to throw.
const HELD_CAT_HEAD_PATH = `${circlePath(74.6, 12.6, 2.4)}M72.6 11.4L72.8 8.6L74.4 10.4Z` +
  'M75.6 10.2L77.4 8.6L77 11.4Z';

const HELD_CAT = svg`<g class="ss-cl-held-cat">
  <path d="M68 16L64 20M70 17.4L68 22M73 17L75 21.6M74.6 15.6L78 18.6M67.6 14.6L63.6 12"
    stroke="#F08C3A" stroke-width="1.4" stroke-linecap="round"></path>
  <ellipse cx="71" cy="15" rx="4" ry="2.6" fill="#F08C3A"></ellipse>
  <path d=${HELD_CAT_HEAD_PATH} fill="#F08C3A"></path>
  <path d=${circlePath(74.4, 12.4, 0.6) + circlePath(76.2, 12.4, 0.6)} fill=${INK}></path>
</g>`;

// A grey cat dangling by the scruff, deeply unimpressed.
const DANGLING_CAT_HEAD_PATH = `${circlePath(69.5, 38.2, 3)}M67 36.4L67.4 33.2L69 35.4Z` +
  'M70 35.4L71.6 33.2L72 36.4Z';

const DANGLING_CAT = svg`<g class="ss-cl-dangle-cat">
  <path d="M70 49.5Q73.4 51.6 71.2 55" fill="none" stroke="#808089" stroke-width="1.3"
    stroke-linecap="round"></path>
  <ellipse cx="69.5" cy="45" rx="2.8" ry="5" fill="#808089"></ellipse>
  <path d=${DANGLING_CAT_HEAD_PATH} fill="#808089"></path>
  <path d="M67.8 38.2H69M70.2 38.2H71.4" stroke=${INK} stroke-width="0.7"
    stroke-linecap="round"></path>
</g>`;

const CAT_LADY_ARMS = {
  walk: svg`<g class="ss-cl-arm-front">
    <path d="M58 44L62 60" stroke=${CAT_LADY_SLEEVE} stroke-width="5" stroke-linecap="round">
    </path>
    <circle cx="62" cy="60.6" r="2.4" fill=${CAT_LADY_SKIN}></circle>
  </g>`,
  throw: svg`<g class="ss-cl-arm-front">
    <path d="M58 44L67 22" stroke=${CAT_LADY_SLEEVE} stroke-width="5" stroke-linecap="round">
    </path>
    <circle cx="67.4" cy="21" r="2.4" fill=${CAT_LADY_SKIN}></circle>
    ${HELD_CAT}
  </g>
  <path class="ss-cl-swoosh" d="M71 28C77 32 79 38 78 44M66 32C71 36 73 41 72 47" fill="none"
    stroke="#B0BEC5" stroke-width="1.2" stroke-linecap="round"></path>`,
  cackle: svg`<g class="ss-cl-arm-front">
    <path d="M58 44L68 34" stroke=${CAT_LADY_SLEEVE} stroke-width="5" stroke-linecap="round">
    </path>
    ${DANGLING_CAT}
    <circle cx="68.6" cy="33.6" r="2.4" fill=${CAT_LADY_SKIN}></circle>
  </g>
  <g class="ss-cl-cackle-lines">
    <path d="M46 9L44 4M53 7.5L53.6 2.5M60 9.4L63 5.4" fill="none" stroke="#5D4037"
      stroke-width="1.2" stroke-linecap="round"></path>
  </g>`
};

// Cat lady poses: walk, throw (a cat overhead) and cackle (another cat from the handbag).
const CAT_LADY_POSES = {
  walk: {eyes: 'open', mouth: 'smile', headTilt: 0},
  throw: {eyes: 'squint', mouth: 'gritted', headTilt: 4},
  cackle: {eyes: 'laughing', mouth: 'cackle', headTilt: -9}
};

/**
 * @description Draws the crazy cat lady: hair curlers, a purple cardigan over a spotted dress,
 *   pearls, fluffy slippers and a big handbag with cats peeking out of it. She walks along the
 *   ground, hurls cats overhand and cackles as she pulls yet another one from the bag.
 * @param {Object} [options] - Pose and classes.
 * @param {string} [options.pose] - 'walk' (default), 'throw' or 'cackle'.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The cat lady <svg>, root 'ss-sprite ss-cat-lady
 *   ss-pose-<pose>'.
 * @throws {never} Never throws.
 * @example
 *   catLadySprite({pose: 'throw'});
 * @since 2.0.0
 */
export function catLadySprite({pose = 'walk', className = ''} = NO_OPTIONS) {
  const poseId = pickId(CAT_LADY_POSES, pose, 'walk');
  const poseSpec = CAT_LADY_POSES[poseId];
  const content = svg`<g class="ss-event"><g class="ss-motion">
    ${CAT_LADY_LEGS}
    ${CAT_LADY_BODY}
    ${CAT_LADY_BACK_ARM}
    <g transform="rotate(${poseSpec.headTilt} 52 36)">
      ${catLadyHead(poseSpec.eyes, poseSpec.mouth)}
    </g>
    ${CAT_LADY_ARMS[poseId]}
  </g></g>`;
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-cat-lady', `ss-pose-${poseId}`, className),
    content
  });
}

// ---------------------------------------------------------------------------------------------
// The flying cat: a ginger tabby, fur on end, outraged at being thrown.
// ---------------------------------------------------------------------------------------------

const CAT_FUR = '#F08C3A';

const CAT_EARS = svg`
  <path class="ss-fc-fur" d="M63.4 36L63.6 25L70.6 31.4ZM73.8 31L80 22.6L81.8 34.2Z"
    fill=${CAT_FUR}></path>
  <path d="M64.6 33.6L64.8 27.6L68.6 31.2ZM75.6 31.2L79.4 25.8L80.4 32.6Z" fill="#F8BBD0">
  </path>`;

const CAT_EYES = {
  outraged: svg`
    <ellipse cx="71.5" cy="40" rx="2.6" ry="3" fill="#FFFFFF"></ellipse>
    <ellipse cx="78.5" cy="40" rx="2.4" ry="2.8" fill="#FFFFFF"></ellipse>
    <path d=${circlePath(72, 40.6, 1.1) + circlePath(79, 40.6, 1)} fill=${INK}></path>
    <path d="M68.4 35.6L74.4 38.2M76.6 38.2L82 35.2" fill="none" stroke=${INK}
      stroke-width="1.4" stroke-linecap="round"></path>`,
  crossed: svg`<path d="M69.6 38.4L73.4 42.2M73.4 38.4L69.6 42.2M76.8 38.4L80.4 42M80.4 38.4
    L76.8 42" fill="none" stroke=${INK} stroke-width="1.2" stroke-linecap="round"></path>`
};

const CAT_MOUTHS = {
  hiss: svg`
    <path d="M74.6 49.4Q78.6 55.6 82.8 49Z" fill="#8E2430"></path>
    <path d="M76.4 50.2L77.2 52.4L78 50.4Z" fill="#FFFFFF"></path>`,
  wobble: svg`<path d="M74.6 50.6q1.4-1.4 2.8 0t2.8 0t2.8 0" fill="none" stroke=${INK}
    stroke-width="0.9" stroke-linecap="round"></path>`
};

/**
 * @description Builds one flying-cat pose: the legs and claws, the tail, the expression and
 *   how far the whole cat is turned.
 * @param {Object} spec - The pose's pieces.
 * @param {string} spec.legs - Path data for the four legs (stroked).
 * @param {string} spec.claws - Path data for the claws, or '' for retracted claws.
 * @param {string} spec.tail - Path data for the tail (stroked).
 * @param {string} spec.eyes - A key of CAT_EYES.
 * @param {string} spec.mouth - A key of CAT_MOUTHS.
 * @param {number} spec.turn - Degrees the whole cat turns about its middle.
 * @param {boolean} spec.bristled - Whether the fur along its back stands on end.
 * @returns {import('lit').SVGTemplateResult} The cat, ready for spriteSvg.
 * @throws {never} Never throws.
 * @example
 *   catFigure({legs: 'M62 56L84 50', claws: '', tail: 'M29 48C22 42 20 32 24 22',
 *     eyes: 'outraged', mouth: 'hiss', turn: 0, bristled: true});
 * @since 2.0.0
 */
function catFigure({legs, claws, tail, eyes, mouth, turn, bristled}) {
  const clawArt = claws === ''
    ? nothing
    : svg`<g class="ss-fc-claws">
        <path d=${claws} fill="none" stroke=${INK} stroke-width="1.9" stroke-linecap="round">
        </path>
        <path d=${claws} fill="none" stroke="#FFFFFF" stroke-width="0.9" stroke-linecap="round">
        </path>
      </g>`;
  const bristles = bristled
    ? svg`<path class="ss-fc-fur" d="M32 43L35 38L38 42L41 36.5L44 41L47 36L50 40.5L53 36L56 41
        L59 37.5L62 43Z" fill=${CAT_FUR}></path>`
    : nothing;
  return svg`<g transform="rotate(${turn} 50 54)"><g class="ss-fc-figure">
    <g class="ss-fc-tail">
      <path class="ss-fc-fur-stroke" d=${tail} fill="none" stroke=${CAT_FUR} stroke-width="6.5"
        stroke-linecap="round"></path>
    </g>
    <g class="ss-fc-legs">
      <path class="ss-fc-fur-stroke" d=${legs} fill="none" stroke=${CAT_FUR} stroke-width="4.5"
        stroke-linecap="round"></path>
      ${clawArt}
    </g>
    ${bristles}
    <ellipse class="ss-fc-fur" cx="48" cy="52" rx="20" ry="12" fill=${CAT_FUR}></ellipse>
    <path d="M40 42Q42 48 40 54M48 41Q50 47 48 53M56 42Q58 48 56 54" fill="none"
      stroke="#C25E1A" stroke-width="1.6" stroke-linecap="round"></path>
    <g class="ss-fc-head">
      ${CAT_EARS}
      <circle class="ss-fc-fur" cx="72" cy="42" r="11" fill=${CAT_FUR}></circle>
      <ellipse cx="78.4" cy="47" rx="5.2" ry="3.6" fill="#FFE0C2"></ellipse>
      ${CAT_EYES[eyes]}
      ${CAT_MOUTHS[mouth]}
      <path d="M80 44.4H82.6L81.3 46.2Z" fill="#E57399"></path>
      <path d="M76 47L66 45.4M76 48.6L66 50.4M82 47L91 44.4M82 48.6L91 50.6" fill="none"
        stroke="#5D4037" stroke-width="0.5"></path>
    </g>
  </g></g>`;
}

const CAT_SPEED_LINES = svg`<path class="ss-fc-speed" d="M10 30L24 34M6 38L20 40M12 22L24 28"
  fill="none" stroke="#B0BEC5" stroke-width="1.4" stroke-linecap="round" opacity="0.85"></path>`;

// Flying-cat poses: fly (limbs splayed, claws out), cling (hooked claws dug in, tail lashing)
// and drop (shaken off: upside down, claws in, seeing crosses).
const FLYING_CAT_POSES = {
  fly: {
    figure: catFigure({
      legs: 'M62 56L84 50M58 60L80 64M36 58L16 50M32 60L14 66',
      claws: clawFanPath(85.6, 49.6, -10) + clawFanPath(81.6, 64.4, 15) +
        clawFanPath(14.4, 49.4, 190) + clawFanPath(12.4, 66.6, 165),
      tail: 'M29 48C22 42 20 32 24 22',
      eyes: 'outraged',
      mouth: 'hiss',
      turn: 0,
      bristled: true
    }),
    extras: CAT_SPEED_LINES
  },
  cling: {
    figure: catFigure({
      legs: 'M62 58L70 72M57 61L60 75M37 59L40 73M32 57L30 71',
      claws: clawFanPath(70.4, 73.4, 80, 3.4) + clawFanPath(60.2, 76.6, 90, 3.4) +
        clawFanPath(40.2, 74.6, 90, 3.4) + clawFanPath(29.8, 72.6, 100, 3.4),
      tail: 'M29 50C20 52 14 46 12 38',
      eyes: 'outraged',
      mouth: 'hiss',
      turn: -18,
      bristled: true
    }),
    extras: nothing
  },
  drop: {
    figure: catFigure({
      legs: 'M62 56L66 66M58 60L60 70M36 58L32 68M32 60L28 70',
      claws: '',
      tail: 'M29 50C22 54 20 60 22 66',
      eyes: 'crossed',
      mouth: 'wobble',
      turn: 160,
      bristled: false
    }),
    extras: nothing
  }
};

/**
 * @description Draws a cartoon ginger cat hurled by the cat lady: outraged face, fur on end,
 *   claws out while flying and hooked in while clinging to a squirrel; shaken off, it drops
 *   upside down and dazed.
 * @param {Object} [options] - Pose and classes.
 * @param {string} [options.pose] - 'fly' (default), 'cling' or 'drop'.
 * @param {string} [options.className] - Extra root classes, e.g. 'ss-anim-cat-throw'.
 * @returns {import('lit').TemplateResult} The cat <svg>, root 'ss-sprite ss-flying-cat
 *   ss-pose-<pose>'.
 * @throws {never} Never throws.
 * @example
 *   flyingCatSprite({pose: 'cling'});
 * @since 2.0.0
 */
export function flyingCatSprite({pose = 'fly', className = ''} = NO_OPTIONS) {
  const poseId = pickId(FLYING_CAT_POSES, pose, 'fly');
  const poseSpec = FLYING_CAT_POSES[poseId];
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-flying-cat', `ss-pose-${poseId}`, className),
    content: svg`<g class="ss-event"><g class="ss-motion">
      ${poseSpec.extras}
      ${poseSpec.figure}
    </g></g>`
  });
}

// ---------------------------------------------------------------------------------------------
// The Golden Acorn of Doom: a winged, scowling gold acorn that punishes runaway leaders.
// ---------------------------------------------------------------------------------------------

const ACORN_WINGS = svg`
  <g class="ss-ga-wing-left">
    <path d="M36 47C24 34 12 38 15 47C18 54 29 53 36 51Z" fill="#FFF8E1" fill-opacity="0.9"
      stroke="#E0B83A" stroke-width="0.8"></path>
    <path d="M34 49C27 44 20 43 17 46" fill="none" stroke="#E0B83A" stroke-width="0.6"></path>
  </g>
  <g class="ss-ga-wing-right">
    <path d="M68 47C80 34 92 38 89 47C86 54 75 53 68 51Z" fill="#FFF8E1" fill-opacity="0.9"
      stroke="#E0B83A" stroke-width="0.8"></path>
    <path d="M70 49C77 44 84 43 87 46" fill="none" stroke="#E0B83A" stroke-width="0.6"></path>
  </g>`;

const ACORN_FACES = {
  // A single furious unibrow, eyes crossed on the target, teeth gritted.
  angry: svg`
    <ellipse cx="45.5" cy="57" rx="4" ry="4.4" fill="#FFFFFF" stroke=${INK} stroke-width="0.6">
    </ellipse>
    <ellipse cx="58.5" cy="57" rx="4" ry="4.4" fill="#FFFFFF" stroke=${INK} stroke-width="0.6">
    </ellipse>
    <path d=${circlePath(47, 58, 1.8) + circlePath(57, 58, 1.8)} fill=${INK}></path>
    <path d="M39.5 50.5L52 55L64.5 50.5" fill="none" stroke=${INK} stroke-width="2.4"
      stroke-linecap="round" stroke-linejoin="round"></path>
    <rect x="45" y="65" width="14" height="5" rx="1.6" fill="#FFFFFF" stroke=${INK}
      stroke-width="0.8"></rect>
    <path d="M48.5 65V70M52 65V70M55.5 65V70M45 67.5H59" stroke=${INK} stroke-width="0.5">
    </path>`,
  // Job done: eyes shut, one smug eyebrow up, a toothy grin.
  smug: svg`
    <path d="M41.5 57Q45.5 53 49.5 57M54.5 57Q58.5 53 62.5 57M40 48Q45.5 45 50 48.5
      M54 50.5Q58.5 49 64 50.5" fill="none" stroke=${INK} stroke-width="1.5"
      stroke-linecap="round"></path>
    <path d="M44 64Q52 73 60 64Z" fill="#6D1B1B"></path>
    <path d="M45.5 64.6H58.5L57.6 66.4H46.4Z" fill="#FFFFFF"></path>`,
  // The moment of the smack: crossed-out eyes and a gasp.
  stunned: svg`
    <path d="M42.5 54L48.5 60M48.5 54L42.5 60M55.5 54L61.5 60M61.5 54L55.5 60" fill="none"
      stroke=${INK} stroke-width="1.6" stroke-linecap="round"></path>
    <ellipse cx="52" cy="67" rx="3" ry="3.6" fill="#6D1B1B"></ellipse>`
};

/**
 * @description The acorn itself: the gold nut with its shine and face, the hatched cap and
 *   the curly stalk.
 * @param {string} face - A key of ACORN_FACES.
 * @returns {import('lit').SVGTemplateResult} The nut group.
 * @throws {never} Never throws.
 * @example
 *   acornNut('angry');
 * @since 2.0.0
 */
function acornNut(face) {
  return svg`<g class="ss-ga-nut-group">
    <path class="ss-ga-nut"
      d="M52 34C66 36 72 50 70 62C68 74 60 82 52 86C44 82 36 74 34 62C32 50 38 36 52 34Z"
      fill="#F2C230" stroke="#B8860B" stroke-width="1.2"></path>
    <ellipse cx="42.5" cy="54" rx="2.8" ry="7" fill="#FFFFFF" opacity="0.55"></ellipse>
    ${ACORN_FACES[face]}
    <path class="ss-ga-cap" d="M31 41C31 27 73 27 73 41C73 45 31 45 31 41Z" fill="#A0672C">
    </path>
    <path d="M36 33L44 43M44 30L54 43M54 29.5L63 43M63 31L70 40M68 31L58 43M58 29.5L48 43
      M48 29.5L39 42" fill="none" stroke="#7A4A1C" stroke-width="0.8" opacity="0.7"></path>
    <path d="M52 29.5C51 25 54 21.5 58 22.5" fill="none" stroke="#7A4A1C" stroke-width="2.2"
      stroke-linecap="round"></path>
  </g>`;
}

const ACORN_TRAIL = svg`<g class="ss-ga-trail">
  <path d="M30 66C22 68 12 66 2 70" fill="none" stroke="#FFD54F" stroke-width="2"
    stroke-dasharray="3 3" stroke-linecap="round"></path>
  <path class="ss-ga-sparkle ss-ga-sparkle-1" d=${sparklePath(22, 61, 4)} fill="#FFF176"
    stroke="#FFC107" stroke-width="0.4"></path>
  <path class="ss-ga-sparkle ss-ga-sparkle-2" d=${sparklePath(10, 73, 3)} fill="#FFF176"
    stroke="#FFC107" stroke-width="0.4"></path>
  <path class="ss-ga-sparkle ss-ga-sparkle-3" d=${sparklePath(4, 58, 2.2)} fill="#FFF176"
    stroke="#FFC107" stroke-width="0.4"></path>
</g>`;

// The loop's trail: three quarters of a circle about (52, 30), the point the acorn loops round.
const ACORN_LOOP_TRAIL = svg`<g class="ss-ga-trail">
  <path d="M16 30A36 36 0 1 1 52 66" fill="none" stroke="#FFD54F" stroke-width="2"
    stroke-dasharray="3 3" stroke-linecap="round"></path>
  <path class="ss-ga-sparkle ss-ga-sparkle-1" d=${sparklePath(16, 30, 3.4)} fill="#FFF176"
    stroke="#FFC107" stroke-width="0.4"></path>
  <path class="ss-ga-sparkle ss-ga-sparkle-2" d=${sparklePath(27, 4.6, 2.6)} fill="#FFF176"
    stroke="#FFC107" stroke-width="0.4"></path>
  <path class="ss-ga-sparkle ss-ga-sparkle-3" d=${sparklePath(88, 30, 2.4)} fill="#FFF176"
    stroke="#FFC107" stroke-width="0.4"></path>
</g>`;

const ACORN_STARS_PATH = starPath(18, 22, 4) + starPath(86, 20, 3.4) + starPath(88, 78, 3);

const ACORN_IMPACT_BURST = svg`
  <path class="ss-ga-burst" d=${burstPath(52, 60, 48, 32, 12)} fill="#FFF176" stroke="#FF8F00"
    stroke-width="1" stroke-linejoin="round"></path>
  <path class="ss-ga-stars" d=${ACORN_STARS_PATH} fill="#FFEB3B" stroke="#F9A825"
    stroke-width="0.5"></path>`;

// Golden Acorn poses: fly (leaning into the dive, sparkle trail), loop (the victory loop)
// and impact (squashed flat against the leader inside a burst).
const GOLDEN_ACORN_POSES = {
  fly: {behind: ACORN_TRAIL, face: 'angry', frame: 'rotate(12 52 60)'},
  loop: {behind: ACORN_LOOP_TRAIL, face: 'smug', frame: 'rotate(0 52 60)'},
  impact: {
    behind: ACORN_IMPACT_BURST,
    face: 'stunned',
    frame: 'translate(52 86) scale(1.16 0.84) translate(-52 -86)'
  }
};

/**
 * @description Draws the Golden Acorn of Doom: a gold acorn with a hatched cap, little
 *   buzzing wings, one furious eyebrow and a sparkle trail. It homes in on a runaway leader,
 *   squashes on impact, then does a smug victory loop.
 * @param {Object} [options] - Pose and classes.
 * @param {string} [options.pose] - 'fly' (default), 'loop' or 'impact'.
 * @param {string} [options.className] - Extra root classes, e.g. 'ss-anim-acorn-loop'.
 * @returns {import('lit').TemplateResult} The acorn <svg>, root 'ss-sprite ss-golden-acorn
 *   ss-pose-<pose>'.
 * @throws {never} Never throws.
 * @example
 *   goldenAcornSprite({pose: 'impact'});
 * @since 2.0.0
 */
export function goldenAcornSprite({pose = 'fly', className = ''} = NO_OPTIONS) {
  const poseId = pickId(GOLDEN_ACORN_POSES, pose, 'fly');
  const poseSpec = GOLDEN_ACORN_POSES[poseId];
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-golden-acorn', `ss-pose-${poseId}`, className),
    content: svg`<g class="ss-event"><g class="ss-motion">
      ${poseSpec.behind}
      <g transform=${poseSpec.frame}><g class="ss-ga-body">
        ${ACORN_WINGS}
        ${acornNut(poseSpec.face)}
      </g></g>
    </g></g>`
  });
}

// ---------------------------------------------------------------------------------------------
// The sharknado shark: goofy, googly-eyed, all grin, and sometimes wearing a stolen hat.
// ---------------------------------------------------------------------------------------------

const SHARK_SKIN = '#7B9DB8';
const SHARK_SHADE = '#5C7F9C';

// Simple versions of the squirrel hats (squirrel.js keeps its hat art private), drawn about
// a local origin at the middle of the brim, pointing up. Ids match HAT_IDS in squirrel.js.
const SHARK_HAT_ART = {
  none: nothing,
  top_hat: svg`
    <rect x="-5" y="-14" width="10" height="13" fill="#222222"></rect>
    <rect x="-5" y="-4.4" width="10" height="2.4" fill="#B71C1C"></rect>
    <ellipse cx="0" cy="-1" rx="9" ry="2" fill="#1A1A1A"></ellipse>`,
  crown: svg`
    <path d="M-9 0L-8 -10L-4 -5L0 -12L4 -5L8 -10L9 0Z" fill="#F2C230" stroke="#B8860B"
      stroke-width="0.7" stroke-linejoin="round"></path>
    <circle cx="0" cy="-3.6" r="1.4" fill="#D32F2F"></circle>`,
  propeller: svg`
    <path d="M-9 0C-9 -9 9 -9 9 0Z" fill="#E53935"></path>
    <path d="M0 -6.6V-11" stroke="#616161" stroke-width="1.1"></path>
    <g class="ss-sk-propeller">
      <ellipse cx="0" cy="-11.4" rx="8" ry="1.6" fill="#43A047"></ellipse>
    </g>`,
  viking: svg`
    <path d="M-8 -3C-14 -4 -16 -10 -14 -15C-12 -10 -9 -8 -6 -7ZM8 -3C14 -4 16 -10 14 -15
      C12 -10 9 -8 6 -7Z" fill="#F3E9D2" stroke="#CDBF9F" stroke-width="0.5"></path>
    <path d="M-9 0C-9 -10 9 -10 9 0Z" fill="#9AA4AE"></path>`,
  wizard: svg`
    <path d="M-10 0C-6 -8 -2 -16 6 -22C4 -14 6 -7 10 0Z" fill="#3949AB"></path>
    <path d=${starPath(1, -8, 2)} fill="#FFEB3B"></path>
    <ellipse cx="0" cy="0" rx="11" ry="2" fill="#283593"></ellipse>`,
  cowboy: svg`
    <path d="M-7 -1C-8 -9 -5 -11 -2 -10C-1 -8.5 1 -8.5 2 -10C5 -11 8 -9 7 -1Z"
      fill="#8B5A2B"></path>
    <path d="M-14 -2C-11 4 11 4 14 -2C10 0 -10 0 -14 -2Z" fill="#7A4E24"></path>`,
  party: svg`
    <path d="M-8 0L1 -20L8 -1Z" fill="#EC407A"></path>
    <path d="M-4.6 -7H5L5.9 -4.6H-5.8Z" fill="#FFEB3B"></path>
    <circle cx="1" cy="-20" r="2.4" fill="#4FC3F7"></circle>`,
  chef: svg`
    <path d="M-7 -6C-12 -8 -11 -16 -5 -15C-5 -20 5 -20 5 -15C11 -16 12 -8 7 -6Z"
      fill="#FAFAFA" stroke="#CFCFCF" stroke-width="0.7"></path>
    <rect x="-7" y="-6.4" width="14" height="6.4" fill="#FFFFFF" stroke="#CFCFCF"
      stroke-width="0.7"></rect>`,
  beanie: svg`
    <path d="M-9 0C-9 -11 9 -11 9 0Z" fill="#26A69A"></path>
    <rect x="-9.5" y="-3" width="19" height="4" rx="1" fill="#00897B"></rect>
    <circle cx="0" cy="-10" r="2.8" fill="#FFB74D"></circle>`,
  pirate: svg`
    <path d="M-13 -1C-9 -6 -5 -4 0 -11C5 -4 9 -6 13 -1C7 2 -7 2 -13 -1Z" fill="#212121"></path>
    <path d="M-2.5 -6.5L2.5 -1.5M2.5 -6.5L-2.5 -1.5" stroke="#FAFAFA" stroke-width="1"
      stroke-linecap="round"></path>`,
  traffic_cone: svg`
    <rect x="-9" y="-2" width="18" height="3" fill="#E65100"></rect>
    <path d="M-6 -1L-1.5 -20H1.5L6 -1Z" fill="#FF7A1A"></path>
    <path d="M-4 -9H4L4.8 -6H-4.8Z" fill="#FAFAFA"></path>`,
  halo: svg`<g class="ss-sk-halo">
    <ellipse cx="0" cy="-7" rx="9" ry="2.5" fill="none" stroke="#FFD54F" stroke-width="2">
    </ellipse>
  </g>`
};

// Any hat id the shark has no art for (a hat added to the squirrel later) becomes a bowler,
// so a stolen hat never silently disappears.
const SHARK_UNKNOWN_HAT = svg`
  <path d="M-8 -1C-8 -11 8 -11 8 -1Z" fill="#5D4037"></path>
  <ellipse cx="0" cy="-1" rx="11" ry="2" fill="#4E342E"></ellipse>`;

/**
 * @description Picks the shark's hat: no hat for a missing, empty or 'none' id, the hat's
 *   art for a known squirrel hat id, and a bowler for any other id.
 * @param {*} hat - The requested squirrel hat id.
 * @returns {{hatId: string, art: *}} The id used in class names ('other' for the bowler)
 *   and the hat's art.
 * @throws {never} Never throws.
 * @example
 *   sharkHat('crown').hatId; // 'crown'
 * @since 2.0.0
 */
function sharkHat(hat) {
  if (typeof hat !== 'string' || hat === '' || hat === 'none') {
    return {hatId: 'none', art: nothing};
  }
  const hatId = pickId(SHARK_HAT_ART, hat, 'other');
  return {hatId, art: hatId === 'other' ? SHARK_UNKNOWN_HAT : SHARK_HAT_ART[hatId]};
}

const SHARK_BODY = svg`
  <g class="ss-sk-tail">
    <path class="ss-sk-skin" d="M25 53L7 38C10 47 10 57 7 67Z" fill=${SHARK_SKIN}></path>
  </g>
  <path class="ss-sk-skin" d="M47 36C51 28 55 20 61 15C61 22 63 29 67 35Z" fill=${SHARK_SKIN}>
  </path>
  <path class="ss-sk-skin"
    d="M22 54C26 40 52 30 76 34C88 36 96 46 95 54C94 62 84 68 70 68C50 70 30 64 22 54Z"
    fill=${SHARK_SKIN}></path>
  <path class="ss-sk-belly" d="M30 58C44 66 70 68 92 58C88 64 80 68 70 68C52 69 38 65 30 58Z"
    fill="#EEF3F6"></path>
  <path d="M60 46q-2 4 0 8M64.5 45q-2 4 0 8M69 44.5q-2 4 0 8" fill="none" stroke=${SHARK_SHADE}
    stroke-width="1.2" stroke-linecap="round"></path>
  <g class="ss-sk-fin">
    <path class="ss-sk-skin" d="M52 61L43 75L62 65Z" fill=${SHARK_SKIN}></path>
  </g>
  <circle cx="81" cy="42" r="5.2" fill="#FFFFFF" stroke="#37474F" stroke-width="0.6"></circle>
  <circle class="ss-sk-pupil" cx="82.6" cy="43.2" r="2.3" fill=${INK}></circle>
  <path d="M76.5 35.5Q81 33 85.5 35.5" fill="none" stroke=${INK} stroke-width="1.2"
    stroke-linecap="round"></path>`;

const SHARK_MOUTHS = {
  // A big cheesy grin of square, friendly teeth.
  grin: svg`
    <path d="M70 52C76 62 88 62 95 51.5Z" fill="#8E2430"></path>
    <path d="M71 52.4H93.6L92.4 55.6H72.2Z" fill="#FFFFFF"></path>
    <path d="M75 52.4V55.8M79 52.4V56M83 52.4V56M87 52.4V56M90.6 52.4V55.8" stroke="#B0BEC5"
      stroke-width="0.5"></path>
    <path d="M68.5 50.5q-1.5 2 0 4" fill="none" stroke=${SHARK_SHADE} stroke-width="0.9"
      stroke-linecap="round"></path>`,
  // Jaws flung wide for the hat chomp: blunt cartoon teeth and a pink tongue.
  chomp: svg`<g class="ss-sk-jaws">
    <path d="M67 51C74 40 90 37 99 40L99 66C90 70 74 64 67 51Z" fill="#6D1B26"></path>
    <path d="M74 58C80 54 90 56 95 60C88 64 80 63 74 58Z" fill="#E57373"></path>
    <path d="M70.5 46.6Q80 39.6 97 39.4L96 44.6L93.4 40.6L91 45.4L88.2 41L85.8 46L83 41.6
      L80.4 46.8L77.6 42.8L75.2 47.8L72.6 44.8Z" fill="#FFFFFF"></path>
    <path d="M71 56.6Q82 66 97 66.4L96 61.4L93.4 65L91 60.2L88.4 64.2L85.8 59L83 63L80.4 58
      L77.6 61L75 56L72.6 58.8Z" fill="#FFFFFF"></path>
  </g>
  <path class="ss-sk-snap" d="M101 34L105 30M103 46H108M101 72L105 76" fill="none"
    stroke="#90A4AE" stroke-width="1.4" stroke-linecap="round"></path>`
};

// Shark poses: circle (cruising round the funnel, grinning) and chomp (nose up, jaws wide).
const SHARK_POSES = {
  circle: {mouth: 'grin', frame: 'rotate(0 55 52)'},
  chomp: {mouth: 'chomp', frame: 'rotate(-10 55 52)'}
};

/**
 * @description Draws a goofy cartoon shark for the sharknado: googly eye, raised eyebrow and
 *   a huge grin. When it has bitten a squirrel's hat off it wears that hat. The hat art here
 *   is a simple version of each squirrel hat; an id it does not know becomes a bowler hat.
 * @param {Object} [options] - Pose, hat and classes.
 * @param {string} [options.pose] - 'circle' (default) or 'chomp'.
 * @param {string} [options.hat] - A squirrel hat id (HAT_IDS in squirrel.js); 'none' or
 *   missing means no hat.
 * @param {string} [options.className] - Extra root classes, e.g. 'ss-anim-shark-circle'.
 * @returns {import('lit').TemplateResult} The shark <svg>, root 'ss-sprite ss-shark
 *   ss-pose-<pose>' plus 'ss-sk-hatted' when it wears a hat.
 * @throws {never} Never throws.
 * @example
 *   sharkSprite({pose: 'circle', hat: 'top_hat'});
 * @since 2.0.0
 */
export function sharkSprite({pose = 'circle', hat = 'none', className = ''} = NO_OPTIONS) {
  const poseId = pickId(SHARK_POSES, pose, 'circle');
  const poseSpec = SHARK_POSES[poseId];
  const {hatId, art} = sharkHat(hat);
  const hatGroup = hatId === 'none'
    ? nothing
    : svg`<g transform="translate(69 34.6) rotate(4)">
        <g class="ss-sk-hat ss-sk-hat-${hatId}">${art}</g>
      </g>`;
  return spriteSvg({
    rootClass: classNames(
      'ss-sprite',
      'ss-shark',
      `ss-pose-${poseId}`,
      hatId === 'none' ? '' : 'ss-sk-hatted',
      className
    ),
    content: svg`<g class="ss-event"><g class="ss-motion">
      <g transform=${poseSpec.frame}>
        ${SHARK_BODY}
        ${SHARK_MOUTHS[poseSpec.mouth]}
        ${hatGroup}
      </g>
    </g></g>`
  });
}

// ---------------------------------------------------------------------------------------------
// The gardener: overalls, wellies, safety goggles, a leaf blower and a not-very-secure toupee.
// ---------------------------------------------------------------------------------------------

const GARDENER_SKIN = '#F0C090';
const GARDENER_SHIRT = '#D84343';

const GARDENER_LEGS = svg`
  <g class="ss-gd-leg-back">
    <path d="M43 70H50.5L50 85H43.6Z" fill="#4A7531"></path>
    <path d="M43.4 84H50.4V89C53.4 89.6 55.4 91.4 55.4 93.6H43.4Z" fill="#D9A520"></path>
  </g>
  <g class="ss-gd-leg-front">
    <path class="ss-gd-overalls" d="M50.5 70H58L57.6 85H51Z" fill="#5B8C3E"></path>
    <path d="M51 84H58V89C61 89.6 63 91.4 63 93.6H51Z" fill="#F2C230"></path>
  </g>`;

const GARDENER_TORSO = svg`
  <path d="M39 44C38 40 62 40 61 44L62 52H38Z" fill=${GARDENER_SHIRT}></path>
  <path d="M44 41V52M50 40.5V52M56 41V52M38.5 47H61.5" stroke="#9E2A2A" stroke-width="0.8"
    opacity="0.6"></path>
  <path class="ss-gd-overalls" d="M41 47H59V53C61.5 58 62 66 60 72H40C38 66 38.5 58 41 53Z"
    fill="#5B8C3E"></path>
  <path d="M46 49H54V54H46Z" fill="#4A7531"></path>
  <path d="M42 47L41 42M58 47L59 42" stroke="#4A7531" stroke-width="2" stroke-linecap="round">
  </path>
  <path d=${circlePath(42, 47.4, 1) + circlePath(58, 47.4, 1)} fill="#F2C230"></path>`;

const TOUPEE_ART = svg`
  <path d="M42 24C42 16 50 13 56 14C62 15 64.6 20 62.6 24C58 21 52 20.6 46 23.4Z"
    fill="#6D4C2F"></path>
  <path d="M47 18.4Q52 15.6 58 17.2M45 21Q51 18 60 19.6" fill="none" stroke="#4E3420"
    stroke-width="0.7"></path>`;

// Toupee on: it sits on the head (and flaps in the blast). Toupee off: it sails away and the
// bald head shines.
const TOUPEE_STATES = {
  on: svg`<g class="ss-gd-toupee">${TOUPEE_ART}</g>`,
  off: svg`
    <ellipse cx="49" cy="22.6" rx="3.4" ry="1.8" fill="#FFFFFF" opacity="0.7"></ellipse>
    <path class="ss-gd-glint" d=${sparklePath(55, 19, 2.4)} fill="#FFFFFF"></path>
    <g transform="translate(-20 -16) rotate(-34 52 19)">
      <g class="ss-gd-toupee ss-gd-toupee-flying">${TOUPEE_ART}</g>
    </g>`
};

const GARDENER_EYES = {
  open: svg`<circle cx="59.6" cy="27.8" r="1.2" fill=${INK}></circle>`,
  squint: svg`<path d="M57.6 27.8H61.4" stroke=${INK} stroke-width="1.2" stroke-linecap="round">
  </path>`,
  wide: svg`
    <circle cx="59.2" cy="27.7" r="1.9" fill="#FFFFFF" stroke=${INK} stroke-width="0.5"></circle>
    <circle cx="59.4" cy="27.7" r="0.8" fill=${INK}></circle>`
};

const GARDENER_MOUTHS = {
  whistle: svg`<circle cx="59.6" cy="36.6" r="1.1" fill="#8B3A3A"></circle>`,
  grit: svg`<path d="M56.4 35.6H62.4V37.6H56.4Z" fill="#FFFFFF" stroke="#8B3A3A"
    stroke-width="0.6"></path>`,
  gasp: svg`<ellipse cx="59.6" cy="36.8" rx="1.6" ry="2" fill="#8B3A3A"></ellipse>`
};

/**
 * @description The gardener's head: face, ear, grey side tufts, safety goggles, big nose,
 *   the pose's eyes and mouth, and the toupee (on, or flying off).
 * @param {Object} poseSpec - A GARDENER_POSES entry.
 * @returns {import('lit').SVGTemplateResult} The head group.
 * @throws {never} Never throws.
 * @example
 *   gardenerHead(GARDENER_POSES.blow);
 * @since 2.0.0
 */
function gardenerHead(poseSpec) {
  return svg`<g class="ss-gd-head">
    <circle cx="52" cy="30" r="10" fill=${GARDENER_SKIN}></circle>
    <circle cx="45" cy="31.5" r="2.6" fill="#E0A878"></circle>
    <path d="M42.6 28C41.4 31 42 34.6 44 36.6M44.4 27.2C43.6 29.4 43.8 31.6 44.6 33" fill="none"
      stroke="#BDBDBD" stroke-width="1.4" stroke-linecap="round"></path>
    <path d="M54 27.6L44.4 26.4" stroke="#37474F" stroke-width="1.4"></path>
    <rect x="54" y="25" width="10.4" height="5.4" rx="2.6" fill="#B3E5FC" stroke="#37474F"
      stroke-width="1"></rect>
    ${GARDENER_EYES[poseSpec.eyes]}
    <ellipse cx="63.6" cy="32.6" rx="2.6" ry="2.2" fill="#E8957A"></ellipse>
    ${GARDENER_MOUTHS[poseSpec.mouth]}
    ${TOUPEE_STATES[poseSpec.toupee]}
  </g>`;
}

const LEAF_BLOWER = svg`<g class="ss-gd-blower">
  <path d="M71 56.4L95 50.4L96.2 55.4L72 62Z" fill="#616161"></path>
  <path d="M94.6 49.6L98 48.8L99.4 55.8L96 56.6Z" fill="#424242"></path>
  <path d="M58.6 54C58.6 49.6 66.6 49.6 66.6 54" fill="none" stroke="#37474F" stroke-width="2">
  </path>
  <path class="ss-gd-blower-body" d="M55 54H69C71 54 72 55.6 72 57.6V64H55Z" fill="#FF8F00">
  </path>
  <path d="M58 57V62M61 57V62M64 57V62" stroke="#E65100" stroke-width="1"></path>
  <path class="ss-gd-rumble" d="M57 51.4L55.6 49M70 51.4L71.4 49" fill="none" stroke="#90A4AE"
    stroke-width="0.9" stroke-linecap="round"></path>
</g>`;

const BLOWER_GUST = svg`<g class="ss-gd-gust">
  <path d="M101 46H111M102 52H115M101 58H109" fill="none" stroke="#B0BEC5" stroke-width="1.6"
    stroke-linecap="round"></path>
</g>`;

// Gardener poses: walk (blower pointing down, whistling), blow (braced, blasting) and
// toupee-off (still blasting, toupee gone with the wind).
const GARDENER_POSES = {
  walk: {
    blowerFrame: 'rotate(18 60 56)',
    frontHand: [64.3, 51.1],
    backHand: [56.6, 58.6],
    eyes: 'open',
    mouth: 'whistle',
    toupee: 'on',
    gust: false
  },
  blow: {
    blowerFrame: 'rotate(-4 60 56)',
    frontHand: [62.2, 50],
    backHand: [57.6, 59.6],
    eyes: 'squint',
    mouth: 'grit',
    toupee: 'on',
    gust: true
  },
  'toupee-off': {
    blowerFrame: 'rotate(-4 60 56)',
    frontHand: [62.2, 50],
    backHand: [57.6, 59.6],
    eyes: 'wide',
    mouth: 'gasp',
    toupee: 'off',
    gust: true
  }
};

/**
 * @description One gardener arm: a plaid sleeve from the shoulder to a hand.
 * @param {string} groupClass - The arm group's class.
 * @param {Array<number>} shoulder - [x, y] of the shoulder.
 * @param {Array<number>} hand - [x, y] of the hand.
 * @returns {import('lit').SVGTemplateResult} The arm group.
 * @throws {never} Never throws.
 * @example
 *   gardenerArm('ss-gd-arm-front', [58, 45], [62.2, 50]);
 * @since 2.0.0
 */
function gardenerArm(groupClass, shoulder, hand) {
  return svg`<g class=${groupClass}>
    <line x1=${shoulder[0]} y1=${shoulder[1]} x2=${hand[0]} y2=${hand[1]}
      stroke=${GARDENER_SHIRT} stroke-width="4.6" stroke-linecap="round"></line>
    <circle cx=${hand[0]} cy=${hand[1]} r="2.3" fill=${GARDENER_SKIN}></circle>
  </g>`;
}

/**
 * @description Draws the gardener who strolls across the field with a leaf blower: green
 *   overalls, yellow wellies, safety goggles and a toupee that ends up leaving without him.
 *   He walks and blows left to right; flip him with 'ss-flip' for a right-to-left pass.
 * @param {Object} [options] - Pose and classes.
 * @param {string} [options.pose] - 'walk' (default), 'blow' or 'toupee-off'.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The gardener <svg>, root 'ss-sprite ss-gardener
 *   ss-pose-<pose>'.
 * @throws {never} Never throws.
 * @example
 *   gardenerSprite({pose: 'toupee-off'});
 * @since 2.0.0
 */
export function gardenerSprite({pose = 'walk', className = ''} = NO_OPTIONS) {
  const poseId = pickId(GARDENER_POSES, pose, 'walk');
  const poseSpec = GARDENER_POSES[poseId];
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-gardener', `ss-pose-${poseId}`, className),
    content: svg`<g class="ss-event"><g class="ss-motion">
      ${GARDENER_LEGS}
      ${GARDENER_TORSO}
      ${gardenerArm('ss-gd-arm-back', [42, 45], poseSpec.backHand)}
      <g transform=${poseSpec.blowerFrame}>${LEAF_BLOWER}</g>
      ${poseSpec.gust ? BLOWER_GUST : nothing}
      ${gardenerHead(poseSpec)}
      ${gardenerArm('ss-gd-arm-front', [58, 45], poseSpec.frontHand)}
    </g></g>`
  });
}

// ---------------------------------------------------------------------------------------------
// The leaf gust: swirling wind, autumn leaves and one very surprised pigeon.
// ---------------------------------------------------------------------------------------------

const GUST_LEAF_PATH = 'M0 -6C4 -4 5 1 0 6C-5 1 -4 -4 0 -6Z';

const GUST_LEAVES = [
  {centreX: 24, centreY: 40, angle: 20, colour: '#E67E22'},
  {centreX: 56, centreY: 32, angle: -30, colour: '#C0392B'},
  {centreX: 82, centreY: 64, angle: 60, colour: '#F1C40F'},
  {centreX: 38, centreY: 66, angle: -70, colour: '#8D6E3F'},
  {centreX: 136, centreY: 38, angle: 15, colour: '#D35400'}
];

const GUST_LEAF_ART = GUST_LEAVES.map((leaf, index) => svg`
  <g transform="translate(${leaf.centreX} ${leaf.centreY}) rotate(${leaf.angle})">
    <g class="ss-lg-leaf ss-lg-leaf-${index + 1}">
      <path d=${GUST_LEAF_PATH} fill=${leaf.colour}></path>
      <path d="M0 -5V6" stroke="#6D3B12" stroke-width="0.6"></path>
    </g>
  </g>`);

const GUST_LINES = svg`
  <g class="ss-lg-gust ss-lg-gust-1">
    <path class="ss-lg-wind" d="M2 26C34 18 66 20 92 28C106 32 108 44 96 44C88 44 88 36 94 34"
      fill="none" stroke="#CFD8DC" stroke-width="2.4" stroke-linecap="round"></path>
  </g>
  <g class="ss-lg-gust ss-lg-gust-2">
    <path class="ss-lg-wind"
      d="M10 52C44 46 80 50 118 56C134 58 140 70 128 72C120 73 118 64 124 62" fill="none"
      stroke="#CFD8DC" stroke-width="2.4" stroke-linecap="round"></path>
  </g>
  <g class="ss-lg-gust ss-lg-gust-3">
    <path class="ss-lg-wind" d="M4 78C30 72 62 74 90 80" fill="none" stroke="#CFD8DC"
      stroke-width="2.4" stroke-linecap="round"></path>
  </g>`;

// The pigeon, drawn about its middle so it can tumble on the spot.
const TUMBLING_PIGEON = svg`<g transform="translate(108 52) rotate(-30)">
  <g class="ss-lg-pigeon">
    <path d="M-8 1L-17 -3L-16 5Z" fill="#6B7480"></path>
    <ellipse class="ss-lg-pigeon-body" cx="0" cy="1" rx="9" ry="6.5" fill="#9EA7B3"></ellipse>
    <path d="M-6 -2C-2 -6 5 -5 7 0C3 3 -3 3 -6 -2Z" fill="#808A96"></path>
    <path d="M-2 -2.5L-0.5 1.5M1.6 -3L3 1" stroke="#37474F" stroke-width="1"></path>
    <path d="M4.6 -2.6C6 -6 9.4 -7 10.6 -4.6C9 -2 7 -0.6 4.6 -2.6Z" fill="#5E9C8E"></path>
    <circle cx="9" cy="-7" r="4.2" fill="#7E8794"></circle>
    <path d="M12.8 -7.2L16 -6.4L12.8 -5.4Z" fill="#3E3E3E"></path>
    <circle cx="10" cy="-8" r="1.4" fill="#FF7043"></circle>
    <circle cx="10.2" cy="-8" r="0.6" fill=${INK}></circle>
    <path d="M-1 7L-2 11M3 7L4 11" stroke="#E57373" stroke-width="1.2" stroke-linecap="round">
    </path>
  </g>
</g>`;

const LOOSE_FEATHER_PATH = 'M0 -3C2 -1 2 2 0 4C-1 1 -1 -1 0 -3Z';

const LOOSE_FEATHERS = svg`
  <g transform="translate(124 30)">
    <g class="ss-lg-feather ss-lg-feather-1">
      <path d=${LOOSE_FEATHER_PATH} fill="#B0BAC5"></path>
    </g>
  </g>
  <g transform="translate(96 76) rotate(40)">
    <g class="ss-lg-feather ss-lg-feather-2">
      <path d=${LOOSE_FEATHER_PATH} fill="#B0BAC5"></path>
    </g>
  </g>`;

const LEAF_GUST_CONTENT = svg`<g class="ss-event"><g class="ss-motion">
  ${GUST_LINES}
  ${GUST_LEAF_ART}
  ${LOOSE_FEATHERS}
  ${TUMBLING_PIGEON}
</g></g>`;

/**
 * @description Draws the leaf blower's gust: three swirling wind lines, five autumn leaves,
 *   two loose feathers and a pigeon tumbling through. Its viewBox is 0 0 160 100 (wider than
 *   tall); the gust blows left to right. Add 'ss-anim-gust-cross' to sweep it across.
 * @param {Object} [options] - Classes; the sprite needs no options.
 * @param {string} [options.className] - Extra root classes, e.g. 'ss-anim-gust-cross'.
 * @returns {import('lit').TemplateResult} The gust <svg>, root 'ss-sprite ss-leaf-gust'.
 * @throws {never} Never throws.
 * @example
 *   leafGustSprite();
 * @since 2.0.0
 */
export function leafGustSprite({className = ''} = NO_OPTIONS) {
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-leaf-gust', className),
    viewBox: '0 0 160 100',
    content: LEAF_GUST_CONTENT
  });
}

// ---------------------------------------------------------------------------------------------
// The UFO: a classic saucer, a tiny alien waving from the dome and an optional tractor beam.
// ---------------------------------------------------------------------------------------------

const UFO_LIGHTS = [
  {centreX: 22, centreY: 31.6, colour: '#FFEB3B'},
  {centreX: 36, centreY: 32.8, colour: '#FF5252'},
  {centreX: 50, centreY: 33.2, colour: '#69F0AE'},
  {centreX: 64, centreY: 32.8, colour: '#FF5252'},
  {centreX: 78, centreY: 31.6, colour: '#FFEB3B'}
];

const UFO_LIGHT_ART = UFO_LIGHTS.map((light, index) => svg`<circle
  class="ss-ufo-light ss-ufo-light-${index + 1}" cx=${light.centreX} cy=${light.centreY} r="1.6"
  fill=${light.colour}></circle>`);

const UFO_ALIEN = svg`<g class="ss-ufo-alien-group">
  <path d="M45.5 27C45.5 23.6 54.5 23.6 54.5 27Z" fill="#8BC34A"></path>
  <path d="M47.6 15.6L46 11.6M52.4 15.6L54 11.6" stroke="#9CCC65" stroke-width="1"></path>
  <path d=${circlePath(46, 11.4, 1) + circlePath(54, 11.4, 1)} fill="#FFEB3B"></path>
  <circle class="ss-ufo-alien" cx="50" cy="20" r="5" fill="#9CCC65"></circle>
  <path d="M46.7 19.4a1.3 1.8 0 1 0 2.6 0a1.3 1.8 0 1 0-2.6 0ZM50.9 19.4a1.3 1.8 0 1 0 2.6 0
    a1.3 1.8 0 1 0-2.6 0Z" fill=${INK}></path>
  <path d="M48.4 22.4Q50.2 23.8 52 22.4" fill="none" stroke=${INK} stroke-width="0.6"
    stroke-linecap="round"></path>
  <g class="ss-ufo-wave">
    <path d="M54 24.6L58.6 18.6" stroke="#9CCC65" stroke-width="1.4" stroke-linecap="round">
    </path>
    <circle cx="58.8" cy="18.2" r="1.2" fill="#9CCC65"></circle>
  </g>
</g>`;

/**
 * @description The saucer: the alien behind the glass dome, the hull, rim lights and the
 *   hatch underneath, which glows while the beam is on.
 * @param {boolean} beaming - Whether the tractor beam is on.
 * @returns {import('lit').SVGTemplateResult} The saucer group.
 * @throws {never} Never throws.
 * @example
 *   ufoSaucer(true);
 * @since 2.0.0
 */
function ufoSaucer(beaming) {
  return svg`<g class="ss-ufo-saucer">
    ${UFO_ALIEN}
    <path d="M36 27C36 10 64 10 64 27Z" fill="#E1F5FE" fill-opacity="0.35" stroke="#81D4FA"
      stroke-width="0.8"></path>
    <path d="M40 22C41 16 45 13 49 12.4" fill="none" stroke="#FFFFFF" stroke-width="1"
      stroke-linecap="round" opacity="0.7"></path>
    <ellipse class="ss-ufo-hull" cx="50" cy="30" rx="34" ry="9" fill="#B0BEC5"></ellipse>
    <ellipse cx="44" cy="27" rx="18" ry="2.4" fill="#FFFFFF" opacity="0.4"></ellipse>
    <ellipse cx="50" cy="32.4" rx="34" ry="4" fill="#78909C"></ellipse>
    ${UFO_LIGHT_ART}
    <ellipse class="ss-ufo-hatch" cx="50" cy="38.2" rx="10" ry="3"
      fill=${beaming ? '#FFF59D' : '#546E7A'}></ellipse>
  </g>`;
}

const UFO_BEAM = svg`<g class="ss-ufo-beam">
  <path class="ss-ufo-beam-light" d="M40 38L12 150H88L60 38Z" fill="#FFF59D" opacity="0.35">
  </path>
  <path d="M44 38L28 150H72L56 38Z" fill="#FFFDE7" opacity="0.3"></path>
  <ellipse class="ss-ufo-ring ss-ufo-ring-1" cx="50" cy="70" rx="18" ry="3" fill="none"
    stroke="#FFF59D" stroke-width="1.2" opacity="0.7"></ellipse>
  <ellipse class="ss-ufo-ring ss-ufo-ring-2" cx="50" cy="100" rx="26" ry="4" fill="none"
    stroke="#FFF59D" stroke-width="1.2" opacity="0.7"></ellipse>
  <ellipse class="ss-ufo-ring ss-ufo-ring-3" cx="50" cy="130" rx="33" ry="5" fill="none"
    stroke="#FFF59D" stroke-width="1.2" opacity="0.7"></ellipse>
</g>`;

/**
 * @description Draws a classic flying saucer with a tiny green alien waving from the dome.
 *   With the beam on, a translucent tractor beam with shimmering rings shines down. Its
 *   viewBox is 0 0 100 150 whatever the beam: the saucer is centred at (50, 30) and the beam
 *   fills the space below, so toggling it never moves the saucer.
 * @param {Object} [options] - Beam and classes.
 * @param {boolean} [options.beam] - Whether the tractor beam is on; false by default.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The UFO <svg>, root 'ss-sprite ss-ufo' plus
 *   'ss-ufo-beaming' while the beam is on.
 * @throws {never} Never throws.
 * @example
 *   ufoSprite({beam: true});
 * @since 2.0.0
 */
export function ufoSprite({beam = false, className = ''} = NO_OPTIONS) {
  const beaming = beam === true;
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-ufo', beaming ? 'ss-ufo-beaming' : '', className),
    viewBox: '0 0 100 150',
    content: svg`<g class="ss-event"><g class="ss-motion">
      ${beaming ? UFO_BEAM : nothing}
      ${ufoSaucer(beaming)}
    </g></g>`
  });
}

// ---------------------------------------------------------------------------------------------
// The woodpecker: black and white, a red cap patch, a long chisel beak and a tiny hard hat.
// ---------------------------------------------------------------------------------------------

const WOODPECKER_BLACK = '#2B2B2B';

const WOODPECKER_BODY = svg`
  <path d="M46 82L41 98L50 90Z" fill=${WOODPECKER_BLACK}></path>
  <path class="ss-wp-feathers"
    d="M50 36C60 38 64 52 62 66C60 78 54 84 48 86C42 80 40 66 42 52C43 42 45 37 50 36Z"
    fill=${WOODPECKER_BLACK}></path>
  <path d="M54 42C60 46 62 58 58 70C55 66 53 54 54 42Z" fill="#F5F5F5"></path>
  <path d="M48 83C50 87.6 54 89.6 56 88C54 86 52 84 50 81.6Z" fill="#D32F2F"></path>
  <path d="M44 48C40 60 42 74 46 80C48 70 48 58 47 48Z" fill="#1A1A1A"></path>
  <path d="M42.6 56H46.6M42.2 62H46.8M42.8 68H46.6" stroke="#F5F5F5" stroke-width="1.2"></path>
  <path d="M59 72L65 74M59 76L65 77" stroke="#757575" stroke-width="1.4" stroke-linecap="round">
  </path>`;

const WOODPECKER_HEAD = svg`<g class="ss-wp-head">
  <circle class="ss-wp-feathers" cx="56" cy="30" r="8" fill=${WOODPECKER_BLACK}></circle>
  <ellipse cx="59.4" cy="32" rx="4.4" ry="3.4" fill="#F5F5F5"></ellipse>
  <path d="M48.6 31C47.6 28 48.6 26 51 25.6L50.6 31Z" fill="#D32F2F"></path>
  <g class="ss-wp-eye">
    <circle cx="59.6" cy="29.6" r="1.6" fill=${INK}></circle>
    <circle cx="60.1" cy="29.1" r="0.5" fill="#FFFFFF"></circle>
  </g>
  <path d="M63 30L76 31.6L63 33.6Z" fill="#5D5D5D"></path>
  <path class="ss-wp-hat" d="M47 26C47 17 63 17 64 26Z" fill="#FDD835"></path>
  <path d="M45 26H67L66 28H46Z" fill="#F9A825"></path>
  <path d="M55.5 18.2V26" stroke="#F9A825" stroke-width="1.2"></path>
</g>`;

const PECK_IMPACT = svg`
  <path class="ss-wp-impact" d="M79 31L83 28M80 37H85M79 43L83 46" fill="none" stroke="#8D6E63"
    stroke-width="1.2" stroke-linecap="round"></path>
  <path class="ss-wp-chips" d="M82 34L85 32.6L85.6 35L82.8 36ZM81.6 40.4L84.4 40.8L83.6 43.2
    L81 42.4Z" fill="#C8A06A"></path>`;

// Woodpecker poses: peck (head driven into the trunk to its right) and idle (head up).
const WOODPECKER_POSES = {
  peck: {headFrame: 'rotate(14 54 38)', extras: PECK_IMPACT},
  idle: {headFrame: 'rotate(-6 54 38)', extras: nothing}
};

/**
 * @description Draws a black-and-white woodpecker clinging upright to a trunk on its right,
 *   wearing a tiny yellow hard hat. Pecking, it jackhammers the trunk with chips flying.
 * @param {Object} [options] - Pose and classes.
 * @param {string} [options.pose] - 'peck' or 'idle' (default).
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The woodpecker <svg>, root 'ss-sprite
 *   ss-woodpecker ss-pose-<pose>'.
 * @throws {never} Never throws.
 * @example
 *   woodpeckerSprite({pose: 'peck'});
 * @since 2.0.0
 */
export function woodpeckerSprite({pose = 'idle', className = ''} = NO_OPTIONS) {
  const poseId = pickId(WOODPECKER_POSES, pose, 'idle');
  const poseSpec = WOODPECKER_POSES[poseId];
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-woodpecker', `ss-pose-${poseId}`, className),
    content: svg`<g class="ss-event"><g class="ss-motion">
      ${WOODPECKER_BODY}
      <g transform=${poseSpec.headFrame}>${WOODPECKER_HEAD}</g>
      ${poseSpec.extras}
    </g></g>`
  });
}

// ---------------------------------------------------------------------------------------------
// Id lists and one-shot classes, for the catalogue, the wardrobe page and the stage.
// ---------------------------------------------------------------------------------------------

/** Every cat lady pose ('walk' is the default). */
export const CAT_LADY_POSE_IDS = Object.freeze(Object.keys(CAT_LADY_POSES));

/** Every flying cat pose ('fly' is the default). */
export const FLYING_CAT_POSE_IDS = Object.freeze(Object.keys(FLYING_CAT_POSES));

/** Every Golden Acorn pose ('fly' is the default). */
export const GOLDEN_ACORN_POSE_IDS = Object.freeze(Object.keys(GOLDEN_ACORN_POSES));

/** Every shark pose ('circle' is the default). */
export const SHARK_POSE_IDS = Object.freeze(Object.keys(SHARK_POSES));

/** Every hat id the shark draws as itself ('none' first); any other id draws a bowler. */
export const SHARK_HAT_IDS = Object.freeze(Object.keys(SHARK_HAT_ART));

/** Every gardener pose ('walk' is the default). */
export const GARDENER_POSE_IDS = Object.freeze(Object.keys(GARDENER_POSES));

/** Every woodpecker pose ('idle' is the default). */
export const WOODPECKER_POSE_IDS = Object.freeze(Object.keys(WOODPECKER_POSES));

/**
 * One-shot and travel classes for the Chaos v2 cast; add one to a sprite root or a wrapper.
 * The travel classes read custom properties for their distances (see cast2Animations).
 */
export const CAST2_ANIMATION_CLASSES = Object.freeze({
  catThrow: 'ss-anim-cat-throw',
  catCling: 'ss-anim-cat-cling',
  acornLoop: 'ss-anim-acorn-loop',
  sharkCircle: 'ss-anim-shark-circle',
  gustCross: 'ss-anim-gust-cross',
  jackhammer: 'ss-anim-jackhammer'
});

/**
 * Keyframes and classes for the Chaos v2 cast. Adopt it next to spriteStyles (animations.js).
 *
 * Pose loops start from the classes the sprite functions put on their roots (ss-pose-*,
 * ss-ufo-beaming). The classes in CAST2_ANIMATION_CLASSES start travel and one-shot moves; a
 * one-shot runs once unless --ss-oneshot-count says otherwise. Durations and distances are
 * custom properties with defaults, `var(--ss-<name>, <value>)`. Every keyframe name starts
 * `ss-c2-` so it can't clash with animations.js or a stage sheet in the same shadow root.
 * Motion is transforms and opacity only, and every animation has a prefers-reduced-motion
 * rule that stops it or leaves a still frame.
 *
 * Theme hooks: each sprite root resolves its theme tokens (with the default hex) into private
 * custom properties, and the classed parts read those, overriding their literal hex fill.
 */
export const cast2Animations = css`
  /* Theme hooks. */
  .ss-cat-lady {
    --ss-cl-cardigan-colour: var(--ss-cat-lady-cardigan, #8E5BA8);
    --ss-cl-dress-colour: var(--ss-cat-lady-dress, #3E9E9E);
    --ss-cl-bag-colour: var(--ss-cat-lady-bag, #A23B5A);
    --ss-cl-curler-colour: var(--ss-cat-lady-curlers, #F06292);
  }

  .ss-cat-lady .ss-cl-cardigan {
    fill: var(--ss-cl-cardigan-colour);
  }

  .ss-cat-lady .ss-cl-dress {
    fill: var(--ss-cl-dress-colour);
  }

  .ss-cat-lady .ss-cl-bag-body {
    fill: var(--ss-cl-bag-colour);
  }

  .ss-cat-lady .ss-cl-curlers {
    fill: var(--ss-cl-curler-colour);
  }

  .ss-flying-cat {
    --ss-fc-fur-colour: var(--ss-flying-cat-fur, #F08C3A);
  }

  .ss-flying-cat .ss-fc-fur {
    fill: var(--ss-fc-fur-colour);
  }

  .ss-flying-cat .ss-fc-fur-stroke {
    stroke: var(--ss-fc-fur-colour);
  }

  .ss-golden-acorn {
    --ss-ga-gold-colour: var(--ss-golden-acorn, #F2C230);
    --ss-ga-cap-colour: var(--ss-golden-acorn-cap, #A0672C);
  }

  .ss-golden-acorn .ss-ga-nut {
    fill: var(--ss-ga-gold-colour);
  }

  .ss-golden-acorn .ss-ga-cap {
    fill: var(--ss-ga-cap-colour);
  }

  .ss-shark {
    --ss-sk-skin-colour: var(--ss-shark, #7B9DB8);
    --ss-sk-belly-colour: var(--ss-shark-belly, #EEF3F6);
  }

  .ss-shark .ss-sk-skin {
    fill: var(--ss-sk-skin-colour);
  }

  .ss-shark .ss-sk-belly {
    fill: var(--ss-sk-belly-colour);
  }

  .ss-gardener {
    --ss-gd-overalls-colour: var(--ss-gardener-overalls, #5B8C3E);
    --ss-gd-blower-colour: var(--ss-gardener-blower, #FF8F00);
  }

  .ss-gardener .ss-gd-overalls {
    fill: var(--ss-gd-overalls-colour);
  }

  .ss-gardener .ss-gd-blower-body {
    fill: var(--ss-gd-blower-colour);
  }

  .ss-leaf-gust {
    --ss-lg-wind-colour: var(--ss-leaf-gust-wind, #CFD8DC);
    --ss-lg-pigeon-colour: var(--ss-pigeon, #9EA7B3);
  }

  .ss-leaf-gust .ss-lg-wind {
    stroke: var(--ss-lg-wind-colour);
  }

  .ss-leaf-gust .ss-lg-pigeon-body {
    fill: var(--ss-lg-pigeon-colour);
  }

  .ss-ufo {
    --ss-ufo-hull-colour: var(--ss-ufo-hull, #B0BEC5);
    --ss-ufo-beam-colour: var(--ss-ufo-beam, #FFF59D);
    --ss-ufo-alien-colour: var(--ss-alien, #9CCC65);
  }

  .ss-ufo .ss-ufo-hull {
    fill: var(--ss-ufo-hull-colour);
  }

  .ss-ufo .ss-ufo-beam-light {
    fill: var(--ss-ufo-beam-colour);
  }

  .ss-ufo .ss-ufo-alien {
    fill: var(--ss-ufo-alien-colour);
  }

  .ss-woodpecker {
    --ss-wp-feather-colour: var(--ss-woodpecker, #2B2B2B);
    --ss-wp-hat-colour: var(--ss-woodpecker-hat, #FDD835);
  }

  .ss-woodpecker .ss-wp-feathers {
    fill: var(--ss-wp-feather-colour);
  }

  .ss-woodpecker .ss-wp-hat {
    fill: var(--ss-wp-hat-colour);
  }

  /*
   * Pivots, in viewBox units (an SVG part turns about 0 0 unless told otherwise), or about the
   * part's own box (fill-box) where it spins or swells in place.
   */
  .ss-cat-lady .ss-motion {
    transform-origin: 50px 94px;
  }

  .ss-cat-lady .ss-cl-leg-back {
    transform-origin: 43.5px 80px;
  }

  .ss-cat-lady .ss-cl-leg-front {
    transform-origin: 55px 80px;
  }

  .ss-cat-lady .ss-cl-bag {
    transform-origin: 34px 55px;
  }

  .ss-cat-lady .ss-cl-arm-front {
    transform-origin: 58px 44px;
  }

  .ss-cat-lady .ss-cl-head {
    transform-origin: 52px 36px;
  }

  .ss-cat-lady .ss-cl-dangle-cat {
    transform-origin: 68.6px 33.6px;
  }

  .ss-flying-cat :is(.ss-motion, .ss-fc-figure) {
    transform-origin: 50px 54px;
  }

  .ss-flying-cat .ss-fc-tail {
    transform-origin: 29px 49px;
  }

  .ss-golden-acorn .ss-motion {
    transform-origin: 52px 60px;
  }

  .ss-golden-acorn.ss-pose-loop .ss-ga-body {
    transform-origin: 52px 30px;
  }

  .ss-golden-acorn.ss-pose-impact .ss-ga-body {
    transform-origin: 52px 86px;
  }

  .ss-golden-acorn .ss-ga-wing-left {
    transform-origin: 36px 49px;
  }

  .ss-golden-acorn .ss-ga-wing-right {
    transform-origin: 68px 49px;
  }

  .ss-shark .ss-motion {
    transform-origin: 55px 52px;
  }

  .ss-shark .ss-sk-tail {
    transform-origin: 25px 53px;
  }

  .ss-shark .ss-sk-fin {
    transform-origin: 56px 62px;
  }

  .ss-shark .ss-sk-jaws {
    transform-box: fill-box;
    transform-origin: 0% 50%;
  }

  .ss-gardener .ss-motion {
    transform-origin: 50px 94px;
  }

  .ss-gardener .ss-gd-leg-back {
    transform-origin: 46.7px 70px;
  }

  .ss-gardener .ss-gd-leg-front {
    transform-origin: 54.2px 70px;
  }

  .ss-gardener .ss-gd-toupee:not(.ss-gd-toupee-flying) {
    transform-origin: 62px 24px;
  }

  .ss-ufo .ss-ufo-saucer {
    transform-origin: 50px 30px;
  }

  .ss-ufo .ss-ufo-wave {
    transform-origin: 54px 24.6px;
  }

  .ss-woodpecker .ss-motion {
    transform-origin: 52px 70px;
  }

  .ss-woodpecker .ss-wp-head {
    transform-origin: 54px 38px;
  }

  .ss-sprite
    :is(
      .ss-ga-sparkle,
      .ss-ga-burst,
      .ss-ga-stars,
      .ss-sk-propeller,
      .ss-gd-toupee-flying,
      .ss-gd-glint,
      .ss-lg-leaf,
      .ss-lg-pigeon,
      .ss-lg-feather,
      .ss-wp-chips,
      .ss-wp-eye
    ) {
    transform-box: fill-box;
    transform-origin: center;
  }

  /* Cat lady: a bustling walk with a swinging handbag; an overarm throw; a cackle. */
  .ss-cat-lady.ss-pose-walk .ss-motion {
    animation: ss-c2-bob calc(var(--ss-cat-lady-walk-duration, 560ms) / 2) ease-in-out infinite;
  }

  .ss-cat-lady.ss-pose-walk .ss-cl-leg-front {
    animation: ss-c2-stride var(--ss-cat-lady-walk-duration, 560ms) ease-in-out infinite
      alternate;
  }

  .ss-cat-lady.ss-pose-walk .ss-cl-leg-back {
    animation: ss-c2-stride var(--ss-cat-lady-walk-duration, 560ms) ease-in-out infinite
      alternate-reverse;
  }

  .ss-cat-lady.ss-pose-walk .ss-cl-arm-front {
    animation: ss-c2-arm-swing var(--ss-cat-lady-walk-duration, 560ms) ease-in-out infinite
      alternate-reverse;
  }

  .ss-cat-lady .ss-cl-bag {
    animation: ss-c2-bag-swing var(--ss-cat-lady-walk-duration, 560ms) ease-in-out infinite
      alternate;
  }

  .ss-cat-lady .ss-cl-bag-cats {
    animation: ss-c2-peek var(--ss-cat-peek-duration, 2200ms) ease-in-out infinite;
  }

  .ss-cat-lady.ss-pose-throw .ss-cl-arm-front {
    animation: ss-c2-throw-swing var(--ss-cat-throw-swing-duration, 1000ms)
      var(--ease-high-accel, cubic-bezier(0.3, 0, 0.08, 1)) infinite;
  }

  .ss-cat-lady.ss-pose-throw .ss-cl-held-cat {
    animation: ss-c2-held-cat var(--ss-cat-throw-swing-duration, 1000ms) linear infinite;
  }

  .ss-cat-lady.ss-pose-throw .ss-cl-swoosh {
    animation: ss-c2-swoosh var(--ss-cat-throw-swing-duration, 1000ms) linear infinite;
  }

  .ss-cat-lady.ss-pose-cackle .ss-motion {
    animation: ss-c2-bob calc(var(--ss-cackle-duration, 360ms) / 2) ease-in-out infinite;
  }

  .ss-cat-lady.ss-pose-cackle .ss-cl-head {
    animation: ss-c2-cackle-shake var(--ss-cackle-duration, 360ms) ease-in-out infinite;
  }

  .ss-cat-lady.ss-pose-cackle .ss-cl-cackle-lines {
    animation: ss-c2-flicker var(--ss-cackle-duration, 360ms) linear infinite alternate;
  }

  .ss-cat-lady.ss-pose-cackle .ss-cl-dangle-cat {
    animation: ss-c2-dangle var(--ss-dangle-duration, 1100ms) ease-in-out infinite alternate;
  }

  /* Flying cat: flailing claws in flight, a wobbling grip when clinging, a dazed tumble. */
  .ss-flying-cat.ss-pose-fly .ss-motion {
    animation: ss-c2-wobble var(--ss-cat-fly-duration, 500ms) ease-in-out infinite alternate;
  }

  .ss-flying-cat.ss-pose-fly .ss-fc-legs {
    animation: ss-c2-flail var(--ss-cat-flail-duration, 160ms) linear infinite;
  }

  .ss-flying-cat .ss-fc-tail {
    animation: ss-c2-tail-lash var(--ss-cat-tail-duration, 420ms) ease-in-out infinite
      alternate;
  }

  .ss-flying-cat .ss-fc-speed {
    animation: ss-c2-flicker var(--ss-cat-fly-duration, 500ms) linear infinite alternate;
  }

  .ss-flying-cat.ss-pose-cling .ss-fc-figure,
  .ss-anim-cat-cling {
    animation: ss-c2-cling-wobble var(--ss-cat-cling-duration, 700ms) ease-in-out infinite;
  }

  .ss-flying-cat.ss-pose-drop .ss-motion {
    animation: ss-c2-spin var(--ss-cat-drop-spin-duration, 1400ms) linear infinite;
  }

  /*
   * Cat throw arc: from where the cat leaves her hand to its target, set as
   * --ss-cat-throw-dx and --ss-cat-throw-dy, peaking --ss-cat-throw-height above the line.
   */
  .ss-anim-cat-throw {
    animation: ss-c2-cat-throw-arc var(--ss-cat-throw-duration, 900ms) linear
      var(--ss-oneshot-count, 1) both;
  }

  @media (prefers-reduced-motion: reduce) {
    .ss-cat-lady.ss-pose-walk .ss-motion,
    .ss-cat-lady.ss-pose-walk .ss-cl-leg-front,
    .ss-cat-lady.ss-pose-walk .ss-cl-leg-back,
    .ss-cat-lady.ss-pose-walk .ss-cl-arm-front,
    .ss-cat-lady .ss-cl-bag,
    .ss-cat-lady .ss-cl-bag-cats,
    .ss-cat-lady.ss-pose-throw .ss-cl-arm-front,
    .ss-cat-lady.ss-pose-cackle .ss-motion,
    .ss-cat-lady.ss-pose-cackle .ss-cl-head,
    .ss-cat-lady.ss-pose-cackle .ss-cl-dangle-cat,
    .ss-flying-cat.ss-pose-fly .ss-motion,
    .ss-flying-cat.ss-pose-fly .ss-fc-legs,
    .ss-flying-cat .ss-fc-tail,
    .ss-flying-cat.ss-pose-cling .ss-fc-figure,
    .ss-anim-cat-cling,
    .ss-anim-cat-throw {
      animation: none;
    }

    /* Still frames: the cat still in her hand, the laugh lines and speed lines showing. */
    .ss-cat-lady.ss-pose-throw .ss-cl-held-cat,
    .ss-cat-lady.ss-pose-cackle .ss-cl-cackle-lines {
      animation: none;
      opacity: 1;
    }

    .ss-cat-lady.ss-pose-throw .ss-cl-swoosh,
    .ss-flying-cat .ss-fc-speed {
      animation: none;
      opacity: 0.8;
    }

    .ss-flying-cat.ss-pose-drop .ss-motion {
      animation: none;
      transform: rotate(20deg);
    }
  }

  /* Golden Acorn: a wobbling, buzzing flight; a loop-the-loop; a squashed, jiggling impact. */
  .ss-golden-acorn.ss-pose-fly .ss-ga-body {
    animation: ss-c2-acorn-wobble var(--ss-acorn-wobble-duration, 700ms) ease-in-out infinite;
  }

  .ss-golden-acorn .ss-ga-wing-left {
    animation: ss-c2-buzz-left var(--ss-acorn-buzz-duration, 90ms) linear infinite alternate;
  }

  .ss-golden-acorn .ss-ga-wing-right {
    animation: ss-c2-buzz-right var(--ss-acorn-buzz-duration, 90ms) linear infinite alternate;
  }

  .ss-golden-acorn .ss-ga-sparkle {
    animation:
      ss-c2-twinkle-scale var(--ss-acorn-sparkle-duration, 900ms) ease-in-out infinite,
      ss-c2-twinkle-opacity var(--ss-acorn-sparkle-duration, 900ms) linear infinite;
  }

  .ss-golden-acorn .ss-ga-sparkle-2 {
    animation-delay: calc(var(--ss-acorn-sparkle-duration, 900ms) / -3);
  }

  .ss-golden-acorn .ss-ga-sparkle-3 {
    animation-delay: calc(var(--ss-acorn-sparkle-duration, 900ms) / -1.5);
  }

  .ss-golden-acorn.ss-pose-loop .ss-ga-body {
    animation: ss-c2-acorn-loop var(--ss-acorn-loop-duration, 1200ms) ease-in-out infinite;
  }

  .ss-golden-acorn.ss-pose-impact .ss-ga-body {
    animation: ss-c2-squash-jiggle var(--ss-acorn-jiggle-duration, 240ms) ease-in-out infinite
      alternate;
  }

  .ss-golden-acorn .ss-ga-burst {
    animation: ss-c2-pulse var(--ss-acorn-burst-duration, 500ms) ease-in-out infinite;
  }

  .ss-golden-acorn .ss-ga-stars {
    animation: ss-c2-twinkle-opacity var(--ss-acorn-sparkle-duration, 900ms) linear infinite;
  }

  /* Victory loop on a wrapper: one loop-the-loop of radius --ss-acorn-loop-radius. */
  .ss-anim-acorn-loop {
    animation: ss-c2-acorn-loop-path var(--ss-acorn-loop-duration, 1200ms) ease-in-out
      var(--ss-oneshot-count, 1) both;
  }

  /* Shark: swimming round the funnel with a googly eye; the hat chomp snaps its jaws. */
  .ss-shark.ss-pose-circle .ss-motion {
    animation: ss-c2-swim var(--ss-shark-swim-duration, 1200ms) ease-in-out infinite;
  }

  .ss-shark .ss-sk-tail {
    animation: ss-c2-tail-swish var(--ss-shark-tail-duration, 450ms) ease-in-out infinite
      alternate;
  }

  .ss-shark .ss-sk-fin {
    animation: ss-c2-fin-paddle var(--ss-shark-tail-duration, 450ms) ease-in-out infinite
      alternate-reverse;
  }

  .ss-shark .ss-sk-pupil {
    animation: ss-c2-googly var(--ss-shark-googly-duration, 600ms) ease-in-out infinite;
  }

  .ss-shark.ss-pose-chomp .ss-sk-jaws {
    animation: ss-c2-chomp-snap var(--ss-shark-chomp-duration, 700ms)
      var(--ease-high-accel, cubic-bezier(0.3, 0, 0.08, 1)) infinite;
  }

  .ss-shark.ss-pose-chomp .ss-sk-snap {
    animation: ss-c2-snap-lines var(--ss-shark-chomp-duration, 700ms) linear infinite;
  }

  .ss-shark .ss-sk-propeller {
    animation: ss-c2-propeller var(--ss-shark-propeller-duration, 260ms) linear infinite;
  }

  .ss-shark .ss-sk-halo {
    animation: ss-c2-float var(--ss-shark-halo-duration, 2000ms) ease-in-out infinite;
  }

  /*
   * Shark circling on a wrapper: round an ellipse of --ss-shark-orbit-rx by
   * --ss-shark-orbit-ry, facing the way it swims and smaller at the back. Stagger several
   * sharks with --ss-shark-orbit-delay.
   */
  .ss-anim-shark-circle {
    animation: ss-c2-shark-orbit var(--ss-shark-orbit-duration, 2000ms) linear infinite;
    animation-delay: var(--ss-shark-orbit-delay, 0ms);
  }

  /* Gardener: a whistling stroll; braced and shaking behind the blower; toupee in flight. */
  .ss-gardener .ss-gd-blower {
    transform-origin: 60px 56px;
  }

  .ss-gardener.ss-pose-walk .ss-motion {
    animation: ss-c2-bob calc(var(--ss-gardener-walk-duration, 600ms) / 2) ease-in-out infinite;
  }

  .ss-gardener.ss-pose-walk .ss-gd-leg-front {
    animation: ss-c2-stride var(--ss-gardener-walk-duration, 600ms) ease-in-out infinite
      alternate;
  }

  .ss-gardener.ss-pose-walk .ss-gd-leg-back {
    animation: ss-c2-stride var(--ss-gardener-walk-duration, 600ms) ease-in-out infinite
      alternate-reverse;
  }

  .ss-gardener:is(.ss-pose-blow, .ss-pose-toupee-off) .ss-motion {
    animation: ss-c2-judder var(--ss-blower-judder-duration, 120ms) linear infinite;
  }

  .ss-gardener:is(.ss-pose-blow, .ss-pose-toupee-off) .ss-gd-blower {
    animation: ss-c2-shake var(--ss-blower-shake-duration, 70ms) linear infinite;
  }

  .ss-gardener:is(.ss-pose-blow, .ss-pose-toupee-off) .ss-gd-rumble {
    animation: ss-c2-flicker var(--ss-blower-rumble-duration, 240ms) linear infinite alternate;
  }

  .ss-gardener .ss-gd-gust {
    animation: ss-c2-gust-stream var(--ss-blower-gust-duration, 500ms) linear infinite;
  }

  .ss-gardener.ss-pose-blow .ss-gd-toupee {
    animation: ss-c2-toupee-flap var(--ss-toupee-flap-duration, 160ms) ease-in-out infinite
      alternate;
  }

  .ss-gardener .ss-gd-toupee-flying {
    animation: ss-c2-toupee-flutter var(--ss-toupee-flutter-duration, 900ms) ease-in-out
      infinite;
  }

  .ss-gardener .ss-gd-glint {
    animation:
      ss-c2-twinkle-scale var(--ss-glint-duration, 1200ms) ease-in-out infinite,
      ss-c2-twinkle-opacity var(--ss-glint-duration, 1200ms) linear infinite;
  }

  /* Leaf gust: wind lines stream, leaves swirl, feathers drift and the pigeon tumbles. */
  .ss-leaf-gust .ss-lg-gust {
    animation: ss-c2-gust-stream var(--ss-gust-swirl-duration, 900ms) linear infinite;
  }

  .ss-leaf-gust .ss-lg-gust-2 {
    animation-delay: calc(var(--ss-gust-swirl-duration, 900ms) / -3);
  }

  .ss-leaf-gust .ss-lg-gust-3 {
    animation-delay: calc(var(--ss-gust-swirl-duration, 900ms) / -1.5);
  }

  .ss-leaf-gust .ss-lg-leaf {
    animation: ss-c2-leaf-swirl var(--ss-gust-swirl-duration, 900ms) linear infinite;
  }

  .ss-leaf-gust .ss-lg-leaf-2 {
    animation-delay: calc(var(--ss-gust-swirl-duration, 900ms) * -0.2);
  }

  .ss-leaf-gust .ss-lg-leaf-3 {
    animation-delay: calc(var(--ss-gust-swirl-duration, 900ms) * -0.4);
  }

  .ss-leaf-gust .ss-lg-leaf-4 {
    animation-delay: calc(var(--ss-gust-swirl-duration, 900ms) * -0.6);
  }

  .ss-leaf-gust .ss-lg-leaf-5 {
    animation-delay: calc(var(--ss-gust-swirl-duration, 900ms) * -0.8);
  }

  .ss-leaf-gust .ss-lg-pigeon {
    animation: ss-c2-spin var(--ss-pigeon-tumble-duration, 800ms) linear infinite;
  }

  .ss-leaf-gust .ss-lg-feather {
    animation: ss-c2-feather-drift var(--ss-feather-drift-duration, 1200ms) ease-in-out
      infinite alternate;
  }

  .ss-leaf-gust .ss-lg-feather-2 {
    animation-delay: calc(var(--ss-feather-drift-duration, 1200ms) / -2);
  }

  /* Gust crossing on a wrapper: left to right, from --ss-gust-start to --ss-gust-end. */
  .ss-anim-gust-cross {
    animation: ss-c2-gust-cross var(--ss-gust-cross-duration, 2400ms) linear
      var(--ss-oneshot-count, 1) both;
  }

  /* UFO: hovering, lights chasing round the rim, the alien waving; the beam shimmers. */
  .ss-ufo .ss-ufo-saucer {
    animation: ss-c2-hover var(--ss-ufo-hover-duration, 1600ms) ease-in-out infinite;
  }

  .ss-ufo .ss-ufo-light {
    animation: ss-c2-light-blink var(--ss-ufo-light-duration, 900ms) linear infinite;
  }

  .ss-ufo .ss-ufo-light-2 {
    animation-delay: calc(var(--ss-ufo-light-duration, 900ms) * -0.2);
  }

  .ss-ufo .ss-ufo-light-3 {
    animation-delay: calc(var(--ss-ufo-light-duration, 900ms) * -0.4);
  }

  .ss-ufo .ss-ufo-light-4 {
    animation-delay: calc(var(--ss-ufo-light-duration, 900ms) * -0.6);
  }

  .ss-ufo .ss-ufo-light-5 {
    animation-delay: calc(var(--ss-ufo-light-duration, 900ms) * -0.8);
  }

  .ss-ufo .ss-ufo-wave {
    animation: ss-c2-wave var(--ss-alien-wave-duration, 500ms) ease-in-out infinite alternate;
  }

  .ss-ufo .ss-ufo-beam {
    animation: ss-c2-beam-shimmer var(--ss-ufo-beam-duration, 700ms) linear infinite alternate;
  }

  .ss-ufo .ss-ufo-ring {
    animation: ss-c2-ring-rise var(--ss-ufo-ring-duration, 1500ms) linear infinite;
  }

  .ss-ufo .ss-ufo-ring-2 {
    animation-delay: calc(var(--ss-ufo-ring-duration, 1500ms) / -3);
  }

  .ss-ufo .ss-ufo-ring-3 {
    animation-delay: calc(var(--ss-ufo-ring-duration, 1500ms) / -1.5);
  }

  /* Woodpecker: the jackhammer peck with flying chips; an idle head tilt and blink. */
  .ss-woodpecker.ss-pose-peck .ss-wp-head {
    animation: ss-c2-jackhammer var(--ss-jackhammer-duration, 80ms) linear infinite alternate;
  }

  .ss-woodpecker.ss-pose-peck .ss-motion {
    animation: ss-c2-judder var(--ss-jackhammer-duration, 80ms) linear infinite;
  }

  .ss-woodpecker .ss-wp-chips {
    animation:
      ss-c2-chips-fly var(--ss-wp-chips-duration, 500ms) ease-out infinite,
      ss-c2-fade-out var(--ss-wp-chips-duration, 500ms) linear infinite;
  }

  .ss-woodpecker .ss-wp-impact {
    animation: ss-c2-flicker var(--ss-wp-impact-duration, 240ms) linear infinite alternate;
  }

  .ss-woodpecker.ss-pose-idle .ss-wp-head {
    animation: ss-c2-head-tilt var(--ss-wp-tilt-duration, 2400ms) ease-in-out infinite
      alternate;
  }

  .ss-woodpecker.ss-pose-idle .ss-wp-eye {
    animation: ss-c2-blink var(--ss-wp-blink-duration, 3600ms) linear infinite;
  }

  /* Jackhammer on a wrapper (the pecked tree): judders while the class is on. */
  .ss-anim-jackhammer {
    animation: ss-c2-judder var(--ss-jackhammer-duration, 80ms) linear
      var(--ss-jackhammer-count, infinite);
  }

  @media (prefers-reduced-motion: reduce) {
    .ss-golden-acorn.ss-pose-fly .ss-ga-body,
    .ss-golden-acorn .ss-ga-wing-left,
    .ss-golden-acorn .ss-ga-wing-right,
    .ss-golden-acorn.ss-pose-loop .ss-ga-body,
    .ss-golden-acorn.ss-pose-impact .ss-ga-body,
    .ss-golden-acorn .ss-ga-burst,
    .ss-anim-acorn-loop,
    .ss-shark.ss-pose-circle .ss-motion,
    .ss-shark .ss-sk-tail,
    .ss-shark .ss-sk-fin,
    .ss-shark .ss-sk-pupil,
    .ss-shark.ss-pose-chomp .ss-sk-jaws,
    .ss-shark .ss-sk-propeller,
    .ss-shark .ss-sk-halo,
    .ss-anim-shark-circle,
    .ss-gardener.ss-pose-walk .ss-motion,
    .ss-gardener.ss-pose-walk .ss-gd-leg-front,
    .ss-gardener.ss-pose-walk .ss-gd-leg-back,
    .ss-gardener:is(.ss-pose-blow, .ss-pose-toupee-off) .ss-motion,
    .ss-gardener:is(.ss-pose-blow, .ss-pose-toupee-off) .ss-gd-blower,
    .ss-gardener.ss-pose-blow .ss-gd-toupee,
    .ss-gardener .ss-gd-toupee-flying,
    .ss-leaf-gust .ss-lg-leaf,
    .ss-leaf-gust .ss-lg-pigeon,
    .ss-leaf-gust .ss-lg-feather,
    .ss-anim-gust-cross,
    .ss-ufo .ss-ufo-saucer,
    .ss-ufo .ss-ufo-wave,
    .ss-woodpecker.ss-pose-peck .ss-wp-head,
    .ss-woodpecker.ss-pose-peck .ss-motion,
    .ss-woodpecker.ss-pose-idle .ss-wp-head,
    .ss-woodpecker.ss-pose-idle .ss-wp-eye,
    .ss-anim-jackhammer {
      animation: none;
    }

    /* Still frames: sparkles, stars, snap and impact lines, gusts, lights and chips stay. */
    .ss-golden-acorn .ss-ga-sparkle,
    .ss-golden-acorn .ss-ga-stars,
    .ss-shark.ss-pose-chomp .ss-sk-snap,
    .ss-gardener:is(.ss-pose-blow, .ss-pose-toupee-off) .ss-gd-rumble,
    .ss-gardener .ss-gd-gust,
    .ss-gardener .ss-gd-glint,
    .ss-leaf-gust .ss-lg-gust,
    .ss-ufo .ss-ufo-light,
    .ss-ufo .ss-ufo-beam,
    .ss-woodpecker .ss-wp-chips,
    .ss-woodpecker .ss-wp-impact {
      animation: none;
      opacity: 0.9;
      transform: none;
    }

    .ss-ufo .ss-ufo-ring {
      animation: none;
      opacity: 0.6;
    }
  }

  @keyframes ss-c2-bob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-1.5px); }
  }

  @keyframes ss-c2-stride {
    from { transform: rotate(-14deg); }
    to { transform: rotate(14deg); }
  }

  @keyframes ss-c2-arm-swing {
    from { transform: rotate(-12deg); }
    to { transform: rotate(12deg); }
  }

  @keyframes ss-c2-bag-swing {
    from { transform: rotate(-6deg); }
    to { transform: rotate(5deg); }
  }

  @keyframes ss-c2-peek {
    0%, 30%, 100% { transform: translateY(0); }
    45%, 60% { transform: translateY(-2.5px); }
  }

  /* Wind back, hurl forward (the cat leaves her hand at 60%), recover. */
  @keyframes ss-c2-throw-swing {
    0%, 100% { transform: rotate(-20deg); }
    40% { transform: rotate(-30deg); }
    60% { transform: rotate(75deg); }
    75% { transform: rotate(60deg); }
  }

  @keyframes ss-c2-held-cat {
    0%, 55% { opacity: 1; }
    60%, 90% { opacity: 0; }
    100% { opacity: 1; }
  }

  @keyframes ss-c2-swoosh {
    0%, 50% { opacity: 0; }
    62% { opacity: 0.9; }
    80%, 100% { opacity: 0; }
  }

  @keyframes ss-c2-cackle-shake {
    0%, 100% { transform: rotate(-4deg) translateY(0); }
    50% { transform: rotate(4deg) translateY(-1px); }
  }

  @keyframes ss-c2-flicker {
    from { opacity: 0.25; }
    to { opacity: 1; }
  }

  @keyframes ss-c2-dangle {
    from { transform: rotate(-12deg); }
    to { transform: rotate(10deg); }
  }

  @keyframes ss-c2-wobble {
    from { transform: rotate(-6deg); }
    to { transform: rotate(6deg); }
  }

  @keyframes ss-c2-flail {
    0%, 100% { transform: translate(0, 0); }
    25% { transform: translate(-1px, 1px); }
    50% { transform: translate(1px, -1px); }
    75% { transform: translate(-1px, -1px); }
  }

  @keyframes ss-c2-tail-lash {
    from { transform: rotate(-14deg); }
    to { transform: rotate(12deg); }
  }

  @keyframes ss-c2-cling-wobble {
    0%, 100% { transform: rotate(-5deg) translateX(0); }
    25% { transform: rotate(4deg) translateX(1px); }
    50% { transform: rotate(-3deg) translateX(-1px); }
    75% { transform: rotate(5deg) translateX(0.5px); }
  }

  @keyframes ss-c2-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* A parabola: the height offset is 4 * h * t * (1 - t), so 0.75h at a quarter, h midway. */
  @keyframes ss-c2-cat-throw-arc {
    0% {
      transform: translate(0, 0) rotate(0deg);
    }
    25% {
      transform: translate(
          calc(var(--ss-cat-throw-dx, 160px) * 0.25),
          calc(var(--ss-cat-throw-dy, 0px) * 0.25 - var(--ss-cat-throw-height, 60px) * 0.75)
        )
        rotate(180deg);
    }
    50% {
      transform: translate(
          calc(var(--ss-cat-throw-dx, 160px) * 0.5),
          calc(var(--ss-cat-throw-dy, 0px) * 0.5 - var(--ss-cat-throw-height, 60px))
        )
        rotate(360deg);
    }
    75% {
      transform: translate(
          calc(var(--ss-cat-throw-dx, 160px) * 0.75),
          calc(var(--ss-cat-throw-dy, 0px) * 0.75 - var(--ss-cat-throw-height, 60px) * 0.75)
        )
        rotate(540deg);
    }
    100% {
      transform: translate(var(--ss-cat-throw-dx, 160px), var(--ss-cat-throw-dy, 0px))
        rotate(720deg);
    }
  }

  @keyframes ss-c2-acorn-wobble {
    0%, 100% { transform: translateY(0) rotate(-4deg); }
    50% { transform: translateY(-3px) rotate(4deg); }
  }

  @keyframes ss-c2-buzz-left {
    from { transform: rotate(0deg) scaleY(1); }
    to { transform: rotate(16deg) scaleY(0.7); }
  }

  @keyframes ss-c2-buzz-right {
    from { transform: rotate(0deg) scaleY(1); }
    to { transform: rotate(-16deg) scaleY(0.7); }
  }

  @keyframes ss-c2-twinkle-scale {
    0%, 100% { transform: scale(0.5) rotate(0deg); }
    50% { transform: scale(1.15) rotate(45deg); }
  }

  @keyframes ss-c2-twinkle-opacity {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }

  /* Anticlockwise round (52, 30): up the right side, upside down over the top, home. */
  @keyframes ss-c2-acorn-loop {
    from { transform: rotate(0deg); }
    to { transform: rotate(-360deg); }
  }

  @keyframes ss-c2-squash-jiggle {
    from { transform: scale(1.04, 0.95); }
    to { transform: scale(0.97, 1.04); }
  }

  @keyframes ss-c2-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }

  /* Eight points round a circle of radius r above the start, nose turning with the loop. */
  @keyframes ss-c2-acorn-loop-path {
    0% {
      transform: translate(0, 0) rotate(0deg);
    }
    12.5% {
      transform: translate(
          calc(var(--ss-acorn-loop-radius, 30px) * 0.71),
          calc(var(--ss-acorn-loop-radius, 30px) * -0.29)
        )
        rotate(-45deg);
    }
    25% {
      transform: translate(
          var(--ss-acorn-loop-radius, 30px),
          calc(var(--ss-acorn-loop-radius, 30px) * -1)
        )
        rotate(-90deg);
    }
    37.5% {
      transform: translate(
          calc(var(--ss-acorn-loop-radius, 30px) * 0.71),
          calc(var(--ss-acorn-loop-radius, 30px) * -1.71)
        )
        rotate(-135deg);
    }
    50% {
      transform: translate(0, calc(var(--ss-acorn-loop-radius, 30px) * -2)) rotate(-180deg);
    }
    62.5% {
      transform: translate(
          calc(var(--ss-acorn-loop-radius, 30px) * -0.71),
          calc(var(--ss-acorn-loop-radius, 30px) * -1.71)
        )
        rotate(-225deg);
    }
    75% {
      transform: translate(
          calc(var(--ss-acorn-loop-radius, 30px) * -1),
          calc(var(--ss-acorn-loop-radius, 30px) * -1)
        )
        rotate(-270deg);
    }
    87.5% {
      transform: translate(
          calc(var(--ss-acorn-loop-radius, 30px) * -0.71),
          calc(var(--ss-acorn-loop-radius, 30px) * -0.29)
        )
        rotate(-315deg);
    }
    100% {
      transform: translate(0, 0) rotate(-360deg);
    }
  }

  @keyframes ss-c2-swim {
    0%, 100% { transform: translateY(0) rotate(-2deg); }
    50% { transform: translateY(-2px) rotate(2deg); }
  }

  @keyframes ss-c2-tail-swish {
    from { transform: rotate(-14deg); }
    to { transform: rotate(14deg); }
  }

  @keyframes ss-c2-fin-paddle {
    from { transform: rotate(-10deg); }
    to { transform: rotate(8deg); }
  }

  @keyframes ss-c2-googly {
    0%, 100% { transform: translate(0, 0); }
    30% { transform: translate(-1px, 0.6px); }
    60% { transform: translate(0.8px, -0.8px); }
  }

  @keyframes ss-c2-chomp-snap {
    0%, 35%, 100% { transform: scaleY(1); }
    50% { transform: scaleY(0.12); }
    60% { transform: scaleY(1.05); }
  }

  @keyframes ss-c2-snap-lines {
    0%, 45% { opacity: 0; }
    52% { opacity: 1; }
    75%, 100% { opacity: 0; }
  }

  @keyframes ss-c2-propeller {
    0%, 100% { transform: scaleX(1); }
    50% { transform: scaleX(-1); }
  }

  @keyframes ss-c2-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-1.5px); }
  }

  /* Front half left to right at full size, a turn, the back half right to left and smaller. */
  @keyframes ss-c2-shark-orbit {
    0% {
      transform: translate(calc(var(--ss-shark-orbit-rx, 40px) * -1), 0) scale(1, 1);
    }
    25% {
      transform: translate(0, var(--ss-shark-orbit-ry, 10px)) scale(1.1, 1.1);
    }
    49.9% {
      transform: translate(var(--ss-shark-orbit-rx, 40px), 0) scale(1, 1);
    }
    50% {
      transform: translate(var(--ss-shark-orbit-rx, 40px), 0) scale(-1, 1);
    }
    75% {
      transform: translate(0, calc(var(--ss-shark-orbit-ry, 10px) * -1)) scale(-0.8, 0.8);
    }
    99.9% {
      transform: translate(calc(var(--ss-shark-orbit-rx, 40px) * -1), 0) scale(-1, 1);
    }
    100% {
      transform: translate(calc(var(--ss-shark-orbit-rx, 40px) * -1), 0) scale(1, 1);
    }
  }

  @keyframes ss-c2-judder {
    0%, 100% { transform: translate(0, 0); }
    25% { transform: translate(-0.6px, 0.3px); }
    50% { transform: translate(0.6px, -0.3px); }
    75% { transform: translate(-0.3px, -0.3px); }
  }

  @keyframes ss-c2-shake {
    0%, 100% { transform: translate(0, 0) rotate(0deg); }
    33% { transform: translate(-0.8px, 0.6px) rotate(-1deg); }
    66% { transform: translate(0.8px, -0.4px) rotate(1deg); }
  }

  @keyframes ss-c2-gust-stream {
    0% { transform: translateX(-6px); opacity: 0; }
    30% { opacity: 0.9; }
    100% { transform: translateX(8px); opacity: 0; }
  }

  /* The toupee's back edge lifts in the blast, pivoting on its front edge. */
  @keyframes ss-c2-toupee-flap {
    from { transform: rotate(0deg); }
    to { transform: rotate(14deg); }
  }

  @keyframes ss-c2-toupee-flutter {
    0%, 100% { transform: translateY(0) rotate(-12deg); }
    50% { transform: translateY(-2px) rotate(12deg); }
  }

  @keyframes ss-c2-leaf-swirl {
    0% { transform: translate(0, 0) rotate(0deg); }
    50% { transform: translate(4px, -5px) rotate(180deg); }
    100% { transform: translate(0, 0) rotate(360deg); }
  }

  @keyframes ss-c2-feather-drift {
    from { transform: translate(0, 0) rotate(0deg); }
    to { transform: translate(6px, 4px) rotate(35deg); }
  }

  @keyframes ss-c2-gust-cross {
    from { transform: translateX(var(--ss-gust-start, -40vw)); }
    to { transform: translateX(var(--ss-gust-end, 120vw)); }
  }

  @keyframes ss-c2-hover {
    0%, 100% { transform: translateY(0) rotate(-2deg); }
    50% { transform: translateY(-3px) rotate(2deg); }
  }

  @keyframes ss-c2-light-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.25; }
  }

  @keyframes ss-c2-wave {
    from { transform: rotate(-20deg); }
    to { transform: rotate(15deg); }
  }

  /* A gentle shimmer, never a flash: opacity stays between 0.7 and 1. */
  @keyframes ss-c2-beam-shimmer {
    from { opacity: 0.7; }
    to { opacity: 1; }
  }

  @keyframes ss-c2-ring-rise {
    0% { transform: translateY(0); opacity: 0; }
    30% { opacity: 0.8; }
    100% { transform: translateY(-30px); opacity: 0; }
  }

  /* The head hammers back and forth against the trunk; at 0deg the beak touches it. */
  @keyframes ss-c2-jackhammer {
    from { transform: rotate(-10deg); }
    to { transform: rotate(0deg); }
  }

  @keyframes ss-c2-chips-fly {
    from { transform: translate(0, 0) rotate(0deg); }
    to { transform: translate(6px, -6px) rotate(120deg); }
  }

  @keyframes ss-c2-fade-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }

  @keyframes ss-c2-head-tilt {
    from { transform: rotate(0deg); }
    to { transform: rotate(6deg); }
  }

  @keyframes ss-c2-blink {
    0%, 92%, 100% { transform: scaleY(1); }
    95% { transform: scaleY(0.1); }
  }
`;
