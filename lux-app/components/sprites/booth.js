import {css, nothing, svg} from 'lit';
import {circlePath, classNames, pickId, spriteSvg} from './squirrel.js';

/**
 * Squirrel Scramble sprite kit, the commentary booth (docs/specs/squirrel-scramble-chaos-v2.md
 * § 12): the owl commentator at a desk in a small booth, in the style of the owl referee but in
 * a different outfit, with a headset and boom microphone, a bow tie and a tiny ON AIR light.
 *
 * Every pose draws from the same SVG content. A pose is only the root's ss-pose-<pose> class,
 * and boothAnimations shows the parts for it (wide eyes, raised feathers, happy eyes, raised
 * wings, the lit lamp) and runs its loops. So the stage can change the pose every few hundred
 * milliseconds and Lit only updates one class attribute; the SVG is never re-rendered.
 *
 * Without the stylesheet the owl draws in its idle pose: the parts that belong to other poses
 * carry opacity="0", which the sheet overrides. Colours are literal values in presentation
 * attributes (never `var()` there); the booth wall and the bow tie also read a theme hook. All
 * art is original. Every function is pure: no DOM, no randomness, no clock.
 */

/** The default options object: default pose, no extra classes. */
const NO_OPTIONS = Object.freeze({});

// The owl's poses (contract § 12): 'idle' blinks and tilts its head, 'talk' flaps its beak with
// the light on, 'gasp' goes wide-eyed with its feathers up, 'cheer' raises its wings.
const OWL_COMMENTATOR_POSES = Object.freeze({
  idle: 'idle',
  talk: 'talk',
  gasp: 'gasp',
  cheer: 'cheer'
});

// The ON AIR sign's text when the caller passes none.
const DEFAULT_ON_AIR_LABEL = 'ON AIR';

// Longer than this, the sign's text is squeezed to fit the lamp.
const ON_AIR_FIT_CHARS = 6;

// The sign's text width when squeezed, in viewBox units.
const ON_AIR_FIT_WIDTH = 23;

// The owl's colours, as on the owl referee.
const OWL_BODY = '#8D6E63';
const OWL_FACE = '#D7CCC8';
const OWL_WING = '#6D4C41';
const OWL_IRIS = '#FFA726';
const OWL_PUPIL = '#1A1A1A';

// The two eyes' centres.
const LEFT_EYE_X = 37.5;
const RIGHT_EYE_X = 50.5;
const EYE_Y = 37;

/**
 * @description Path data for a disc over each eye.
 * @param {number} radius - The disc radius.
 * @returns {string} Path data for both discs.
 * @throws {never} Never throws.
 * @example
 *   eyeDiscs(4.4);
 * @since 2.2.0
 */
function eyeDiscs(radius) {
  return circlePath(LEFT_EYE_X, EYE_Y, radius) + circlePath(RIGHT_EYE_X, EYE_Y, radius);
}

// The booth: back wall, acoustic panel and the desk the owl sits behind.
const BOOTH_BACK = svg`
  <rect class="oc-wall" x="2" y="2" width="96" height="96" rx="8" fill="#37474F"></rect>
  <rect x="6" y="6" width="88" height="78" rx="5" fill="#455A64"></rect>
  <path d="M10 22H90M10 38H90M10 54H90M10 70H90" fill="none" stroke="#3E5059"
    stroke-width="1.2"></path>`;

const BOOTH_DESK = svg`
  <rect x="2" y="84" width="96" height="14" rx="2" fill="#5D4037"></rect>
  <rect x="2" y="82" width="96" height="4" rx="1.5" fill="#8D6E63"></rect>
  <rect x="64" y="78" width="16" height="5" rx="1" fill="#ECEFF1"></rect>
  <path d="M66 80H78M66 81.6H75" fill="none" stroke="#90A4AE" stroke-width="0.5"></path>`;

// Wings at rest, and raised for a cheer (hidden until the cheer pose shows them).
const OWL_WINGS_DOWN = svg`<g class="oc-wings-down">
  <path d="M25 66C19 74 20 86 26 92C28 84 28 74 30 68Z" fill=${OWL_WING}></path>
  <path d="M63 66C69 74 68 86 62 92C60 84 60 74 58 68Z" fill=${OWL_WING}></path>
</g>`;

const OWL_WINGS_UP = svg`<g class="oc-wings-up" opacity="0">
  <path d="M27 66C17 58 14 44 18 34C22 42 27 52 31 60Z" fill=${OWL_WING}></path>
  <path d="M61 66C71 58 74 44 70 34C66 42 61 52 57 60Z" fill=${OWL_WING}></path>
</g>`;

const OWL_BODY_PARTS = svg`
  <ellipse cx="44" cy="74" rx="19" ry="20" fill=${OWL_BODY}></ellipse>
  <ellipse cx="44" cy="78" rx="11.5" ry="13" fill=${OWL_FACE}></ellipse>
  <path d="M38.5 72q2.75 2 5.5 0q2.75 2 5.5 0M38.5 79q2.75 2 5.5 0q2.75 2 5.5 0" fill="none"
    stroke="#A1887F" stroke-width="0.9" stroke-linecap="round"></path>`;

const OWL_BOW_TIE = svg`<g class="oc-bow-tie">
  <path class="oc-tie" d="M44 57L36 52.6V61.4ZM44 57L52 52.6V61.4Z" fill="#C62828"></path>
  <circle cx="44" cy="57" r="1.9" fill="#8E0000"></circle>
</g>`;

// The eyes for each pose: open (idle and talk), wide (gasp), happy arcs (cheer), and the lids
// the idle blink shows for a moment.
const OWL_EYES = svg`
  <path d=${eyeDiscs(7)} fill=${OWL_FACE}></path>
  <path d=${eyeDiscs(4.4)} fill=${OWL_IRIS}></path>
  <g class="oc-eyes-open">
    <path d=${eyeDiscs(2.2)} fill=${OWL_PUPIL}></path>
    <path d=${circlePath(38.3, 36.2, 0.6) + circlePath(51.3, 36.2, 0.6)} fill="#FFFFFF"></path>
  </g>
  <g class="oc-eyes-wide" opacity="0">
    <path d=${eyeDiscs(6.6)} fill="#FFFDE7"></path>
    <path d=${eyeDiscs(3.4)} fill=${OWL_IRIS}></path>
    <path d=${eyeDiscs(1.3)} fill=${OWL_PUPIL}></path>
  </g>
  <g class="oc-eyes-happy" opacity="0">
    <path d=${eyeDiscs(6.8)} fill=${OWL_FACE}></path>
    <path d="M33.5 38.5q4-5 8 0M46.5 38.5q4-5 8 0" fill="none" stroke="#3E2723"
      stroke-width="1.6" stroke-linecap="round"></path>
  </g>
  <path class="oc-lids" d=${eyeDiscs(7.1)} fill=${OWL_BODY} opacity="0"></path>`;

// The beak: the mouth shows when the lower half drops (talking, gasping).
const OWL_BEAK = svg`
  <path class="oc-beak-mouth" d="M41.6 45.2L44 49L46.4 45.2Z" fill="#4E342E"></path>
  <path class="oc-beak-lower" d="M41.2 45L44 49.2L46.8 45L44 46.4Z" fill="#F57F17"></path>
  <path d="M44 39.6L40.4 44.6L44 46.6L47.6 44.6Z" fill="#FFB300"></path>`;

// The headset: band, ear cups and the boom microphone in front of the beak.
const OWL_HEADSET = svg`
  <path d="M27.5 38C27.5 16 60.5 16 60.5 38" fill="none" stroke="#263238" stroke-width="2.4"
    stroke-linecap="round"></path>
  <rect x="24.5" y="33" width="6" height="10" rx="2.4" fill="#37474F"></rect>
  <rect x="57.5" y="33" width="6" height="10" rx="2.4" fill="#37474F"></rect>
  <path d="M27.5 42C28 50 33 53 37.4 51.4" fill="none" stroke="#424242" stroke-width="1.4"
    stroke-linecap="round"></path>
  <path d=${circlePath(39.4, 50.8, 2.3)} fill="#212121"></path>
  <path d=${circlePath(38.7, 50.1, 0.7)} fill="#757575"></path>`;

const OWL_HEAD = svg`<g class="oc-head">
  <path d="M29 32L30 18L38 27ZM59 32L58 18L50 27Z" fill=${OWL_WING}></path>
  <path class="oc-ruffle" d="M34 26L33 19L37 23L38 16L41 22L44 15L47 22L50 16L51 23L55 19L54 26Z"
    fill=${OWL_WING} opacity="0"></path>
  <circle cx="44" cy="38" r="16" fill=${OWL_BODY}></circle>
  ${OWL_EYES}
  ${OWL_BEAK}
  ${OWL_HEADSET}
</g>`;

const OWL_FIGURE = svg`<g class="ss-motion">
  ${OWL_WINGS_DOWN}
  ${OWL_BODY_PARTS}
  ${OWL_WINGS_UP}
  ${OWL_BOW_TIE}
  ${OWL_HEAD}
</g>`;

/**
 * @description The booth's SVG content for one sign text: the booth, the ON AIR sign (dim, with
 *   its lit face on top for the talking poses), the owl and the desk. The pose never changes it:
 *   the same template with the same text, so Lit leaves the drawn SVG alone on every render.
 * @param {string} label - The sign's text.
 * @returns {import('lit').SVGTemplateResult} The content.
 * @throws {never} Never throws.
 * @example
 *   boothContent('ON AIR');
 * @since 2.2.0
 */
function boothContent(label) {
  const fit = label.length > ON_AIR_FIT_CHARS ? ON_AIR_FIT_WIDTH : nothing;
  const squeeze = label.length > ON_AIR_FIT_CHARS ? 'spacingAndGlyphs' : nothing;
  return svg`
    ${BOOTH_BACK}
    <g class="oc-on-air">
      <rect x="66" y="7" width="27" height="10" rx="2.5" fill="#4E1D1D" stroke="#212121"
        stroke-width="0.8"></rect>
      <text x="79.5" y="14.1" text-anchor="middle" font-family="system-ui, sans-serif"
        font-size="5.2" font-weight="900" fill="#8D6E63" textLength=${fit}
        lengthAdjust=${squeeze}>${label}</text>
      <g class="oc-lamp-lit" opacity="0">
        <rect x="66" y="7" width="27" height="10" rx="2.5" fill="#E53935" stroke="#B71C1C"
          stroke-width="0.8"></rect>
        <text x="79.5" y="14.1" text-anchor="middle" font-family="system-ui, sans-serif"
          font-size="5.2" font-weight="900" fill="#FFFFFF" textLength=${fit}
          lengthAdjust=${squeeze}>${label}</text>
      </g>
    </g>
    ${OWL_FIGURE}
    ${BOOTH_DESK}`;
}

/**
 * @description Draws the owl commentator in its booth (Chaos v2 contract § 12): a headset with a
 *   boom microphone, a bow tie, a desk and a tiny ON AIR light. 'idle' blinks and tilts its
 *   head, 'talk' flaps its beak with the light on, 'gasp' goes wide-eyed with its feathers up,
 *   'cheer' raises its wings. Unknown poses draw as 'idle'. Only the root's pose class differs
 *   between poses, so a pose change never re-renders the SVG.
 * @param {Object} [options] - Pose, sign text and classes.
 * @param {string} [options.pose] - 'idle' (default), 'talk', 'gasp' or 'cheer'.
 * @param {string} [options.onAirLabel] - The sign's text; pass a translated string. Defaults to
 *   'ON AIR'.
 * @param {string} [options.className] - Extra root classes.
 * @returns {import('lit').TemplateResult} The booth <svg>, root 'ss-sprite ss-owl-commentator
 *   ss-pose-<pose>'.
 * @throws {never} Never throws.
 * @example
 *   owlCommentatorSprite({pose: 'talk', onAirLabel: i18n.getMessage('ON AIR')});
 * @since 2.2.0
 */
export function owlCommentatorSprite({
  pose = 'idle',
  onAirLabel = DEFAULT_ON_AIR_LABEL,
  className = ''
} = NO_OPTIONS) {
  const poseId = pickId(OWL_COMMENTATOR_POSES, pose, 'idle');
  const hasLabel = typeof onAirLabel === 'string' && onAirLabel.trim() !== '';
  const label = hasLabel ? onAirLabel : DEFAULT_ON_AIR_LABEL;
  return spriteSvg({
    rootClass: classNames('ss-sprite', 'ss-owl-commentator', `ss-pose-${poseId}`, className),
    content: boothContent(label)
  });
}

/**
 * Every owl commentator pose ('idle' is the default).
 * @since 2.2.0
 */
export const OWL_COMMENTATOR_POSE_IDS = Object.freeze(Object.keys(OWL_COMMENTATOR_POSES));

/**
 * Every sprite function this file exports, by name, for catalogues and the wardrobe.
 * @since 2.2.0
 */
export const BOOTH_SPRITE_NAMES = Object.freeze(['owlCommentatorSprite']);

/**
 * The booth's keyframes and pose classes. A pose shows its parts with opacity and runs its loops
 * on transforms and opacity only; the loops are infinite on SVG parts, so the stage's film-rate
 * driver advances them (contract § 10). Every keyframe name starts `ss-oc-`. With reduced motion
 * the owl stays still in its idle drawing, and only the ON AIR light shows that it is talking.
 * @since 2.2.0
 */
export const boothAnimations = css`
  /* Theme hooks. */
  .ss-owl-commentator {
    --ss-oc-wall-colour: var(--ss-booth-wall, #37474F);
    --ss-oc-tie-colour: var(--ss-booth-tie, #C62828);
  }

  .ss-owl-commentator .oc-wall {
    fill: var(--ss-oc-wall-colour);
  }

  .ss-owl-commentator .oc-tie {
    fill: var(--ss-oc-tie-colour);
  }

  /* Pivots. */
  .ss-owl-commentator .ss-motion {
    transform-origin: 44px 94px;
  }

  .ss-owl-commentator .oc-head {
    transform-origin: 44px 52px;
  }

  /* Each pose's parts. */
  .ss-owl-commentator.ss-pose-gasp .oc-eyes-wide,
  .ss-owl-commentator.ss-pose-gasp .oc-ruffle,
  .ss-owl-commentator.ss-pose-cheer .oc-eyes-happy,
  .ss-owl-commentator.ss-pose-cheer .oc-wings-up,
  .ss-owl-commentator:is(.ss-pose-talk, .ss-pose-gasp, .ss-pose-cheer) .oc-lamp-lit {
    opacity: 1;
  }

  .ss-owl-commentator.ss-pose-cheer .oc-wings-down {
    opacity: 0;
  }

  .ss-owl-commentator.ss-pose-gasp .oc-beak-lower {
    transform: translateY(3px);
  }

  /* Idle: the odd blink and a head tilt. */
  .ss-owl-commentator.ss-pose-idle .oc-head {
    animation: ss-oc-tilt var(--ss-oc-tilt-duration, 4200ms) ease-in-out infinite;
  }

  .ss-owl-commentator.ss-pose-idle .oc-lids {
    animation: ss-oc-blink var(--ss-oc-blink-duration, 3800ms) linear infinite;
  }

  /* Talk: the beak chatters and the head nods along. */
  .ss-owl-commentator.ss-pose-talk .oc-beak-lower {
    animation: ss-oc-chatter var(--ss-oc-chatter-duration, 180ms) ease-in-out infinite alternate;
  }

  .ss-owl-commentator.ss-pose-talk .oc-head {
    animation: ss-oc-nod var(--ss-oc-nod-duration, 720ms) ease-in-out infinite;
  }

  /* Gasp: one jolt. */
  .ss-owl-commentator.ss-pose-gasp .ss-motion {
    animation: ss-oc-jolt var(--ss-oc-jolt-duration, 360ms)
      var(--ease-heavy-bounce, cubic-bezier(0.25, 2.25, 0.45, 1)) 1 both;
  }

  /* Cheer: bouncing, wings pumping. */
  .ss-owl-commentator.ss-pose-cheer .ss-motion {
    animation: ss-oc-bounce var(--ss-oc-bounce-duration, 520ms) ease-in-out infinite;
  }

  .ss-owl-commentator.ss-pose-cheer .oc-wings-up {
    animation: ss-oc-pump var(--ss-oc-bounce-duration, 520ms) ease-in-out infinite alternate;
  }

  @keyframes ss-oc-tilt {
    0%, 60%, 100% { transform: rotate(0deg); }
    70%, 88% { transform: rotate(-8deg); }
  }

  @keyframes ss-oc-blink {
    0%, 92%, 100% { opacity: 0; }
    94%, 96% { opacity: 1; }
  }

  @keyframes ss-oc-chatter {
    from { transform: translateY(0); }
    to { transform: translateY(2.6px); }
  }

  @keyframes ss-oc-nod {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(3deg); }
  }

  @keyframes ss-oc-jolt {
    0% { transform: translateY(0) scale(1, 1); }
    40% { transform: translateY(-4px) scale(1.04, 0.97); }
    100% { transform: translateY(0) scale(1, 1); }
  }

  @keyframes ss-oc-bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }

  @keyframes ss-oc-pump {
    from { transform: translateY(0); }
    to { transform: translateY(-2.5px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .ss-sprite.ss-owl-commentator.ss-owl-commentator
      :is(.ss-motion, .oc-head, .oc-lids, .oc-beak-lower, .oc-wings-up) {
      animation: none;
    }

    /* The owl stays still in its idle drawing; only the ON AIR light shows it is talking. */
    .ss-sprite.ss-owl-commentator.ss-owl-commentator
      :is(.oc-eyes-wide, .oc-ruffle, .oc-eyes-happy, .oc-wings-up, .oc-lids) {
      opacity: 0;
    }

    .ss-sprite.ss-owl-commentator.ss-owl-commentator .oc-wings-down {
      opacity: 1;
    }

    .ss-sprite.ss-owl-commentator.ss-owl-commentator .oc-beak-lower {
      transform: none;
    }
  }
`;
