/**
 * The timed parts of the race stage's visitors and decorations (SPEC.md § 10, Chaos v2 contract
 * § 6): the funnel's sweep, the hunter stomping in and out, the suitor and beaver appearing, the
 * bolt's flicker, the sky and camera flashes, hearts rising, a kiss mark popping, a slap, a smoke
 * puff, the eagle's dive; and for Chaos v2 the ground walkers crossing, the leaf gust and what
 * flies in it, the UFO's visit, the flood rising, the rubber duck, the mirror ball dropping in,
 * the earthquake's shake, crack and mole, the cow spat back at the hunter, thrown cats, the
 * Golden Acorn homing in and looping, and the VAR lines.
 *
 * Each part carries data-scrub (which clock), data-scrub-start, data-scrub-duration and
 * data-scrub-kind, and may carry data-scrub-in and data-scrub-out: the shares of its window that
 * its build-up ends and its fade starts at (Chaos v2 contract § 8: field-wide events build over a
 * lead-in and fade over a tail, trunk visitors come and go). Every frame the stage works out how
 * far through its window the part is (0 to 1) and writes the transform and opacity this module
 * returns straight onto the element, the same way it moves the squirrels. Nothing depends on CSS
 * animations being paused and re-timed, so the composited picture always matches the clock, and
 * the look is a pure function of race time. Only transform and opacity are ever written, so the
 * browser can composite every timed part without repainting it.
 *
 * Reduced motion: no movement and no flash; each part shows its still frame (an empty string
 * leaves the stylesheet's still-frame value in place). Fades stay, as fades.
 *
 * Pure ES module: no DOM, no Lit and no clock.
 */
import {FUNNEL, WALK} from './stage-shared.js';

/** The build-up and fade shares a part without its own uses. */
export const DEFAULT_SHAPE = Object.freeze({inShare: 0.15, outShare: 0.85});

/**
 * @description Clamps a share to 0 to 1.
 * @param {number} share - The share.
 * @returns {number} The clamped share.
 * @since 1.0.0
 */
function unit(share) {
  return Math.min(1, Math.max(0, Number.isFinite(share) ? share : 0));
}

/**
 * @description Linear interpolation.
 * @param {number} from - Start value.
 * @param {number} to - End value.
 * @param {number} share - From 0 to 1.
 * @returns {number} The value between.
 * @since 1.0.0
 */
function lerp(from, to, share) {
  return from + (to - from) * share;
}

/**
 * @description Reads a piecewise-linear track at a share: points are [share, value] pairs in
 *   order, the first at 0 and the last at 1.
 * @param {Array<Array<number>>} points - The track.
 * @param {number} share - From 0 to 1.
 * @returns {number} The value.
 * @example
 *   track([[0, 0], [0.5, 1], [1, 0]], 0.25);
 *   // 0.5
 * @since 1.0.0
 */
export function track(points, share) {
  const at = unit(share);
  for (let index = 1; index < points.length; index += 1) {
    const [endShare, endValue] = points[index];
    if (at <= endShare) {
      const [startShare, startValue] = points[index - 1];
      const span = endShare - startShare;
      return span > 0 ? lerp(startValue, endValue, (at - startShare) / span) : endValue;
    }
  }
  return points[points.length - 1][1];
}

/**
 * @description Rounds a number to three decimals for an inline style.
 * @param {number} value - The number.
 * @returns {number} The rounded number.
 * @since 1.0.0
 */
function round3(value) {
  return Math.round(value * 1000) / 1000;
}

/**
 * @description Smooth start and stop (smoothstep) for a share already clamped to 0 to 1.
 * @param {number} share - From 0 to 1.
 * @returns {number} The eased share.
 * @since 1.0.0
 */
function smooth(share) {
  return share * share * (3 - 2 * share);
}

/** The still frame: leave the stylesheet's transform and opacity in place. */
const STILL = Object.freeze({transform: '', opacity: ''});

/**
 * @description How built up a part is: rising smoothly from 0 to 1 over its build-up, 1 while it
 *   holds, falling smoothly back to 0 over its fade.
 * @param {number} share - From 0 to 1.
 * @param {{inShare: number, outShare: number}} shape - Where the build-up ends and the fade
 *   starts.
 * @returns {number} From 0 to 1.
 * @example
 *   envelope(0.05, {inShare: 0.1, outShare: 0.9});
 *   // 0.5
 * @since 2.1.0
 */
export function envelope(share, shape) {
  const inShare = unit(shape.inShare);
  const outShare = Math.max(inShare, unit(shape.outShare));
  if (share < inShare) {
    return smooth(share / inShare);
  }
  if (share > outShare) {
    return smooth((1 - share) / Math.max(0.000001, 1 - outShare));
  }
  return 1;
}

/**
 * @description A crossing from one side of the field to the other, with a little bob: ground
 *   walkers (a step every so often) and things blown along in the leaf gust.
 * @param {number} share - From 0 to 1.
 * @param {boolean} rightToLeft - Crosses from right to left.
 * @param {number} bobs - Bobs over the crossing.
 * @param {number} from - Start, as a fraction of the field width.
 * @param {number} to - End, as a fraction of the field width.
 * @returns {{transform: string, opacity: string}} The frame.
 * @since 1.0.0
 */
function crossing(share, rightToLeft, bobs, from, to) {
  const fraction = lerp(from, to, share);
  const centre = round3((rightToLeft ? 1 - fraction : fraction) * 100);
  const bob = round3(-Math.abs(Math.sin(share * Math.PI * bobs)) * 6);
  return {
    transform: `translate(calc(${centre}cqw - var(--walker-w) / 2), ${bob}%)`,
    opacity: ''
  };
}

/**
 * @description Something blown across the field in the leaf gust (a pigeon, a toupee): a crossing
 *   with a few bobs that fades in as it enters and out before it reaches the far edge.
 * @param {number} share - From 0 to 1.
 * @param {boolean} rightToLeft - Blown from right to left.
 * @returns {{transform: string, opacity: string}} The frame.
 * @since 2.1.0
 */
function blownAcross(share, rightToLeft) {
  const frame = crossing(share, rightToLeft, 3, -0.1, 1.1);
  const fade = track([[0, 0], [0.1, 1], [0.8, 1], [0.95, 0], [1, 0]], share);
  return {transform: frame.transform, opacity: String(round3(fade))};
}

/**
 * @description Something that homes in on a squirrel from an offset (--from-x lanes across,
 *   --from-y climbs down, set on the element): a thrown cat in an arc, the Golden Acorn
 *   straight in with a wobble.
 * @param {number} share - From 0 to 1.
 * @param {number} arc - How high the arc rises, in percent of the field height.
 * @param {number} spin - Degrees turned over the flight.
 * @returns {{transform: string, opacity: string}} The frame.
 * @since 1.0.0
 */
function homing(share, arc, spin) {
  const rest = round3(1 - smooth(share));
  const lift = round3(Math.sin(Math.PI * share) * arc);
  return {
    transform: `translate(calc(var(--lane-w) * var(--from-x) * ${rest}), `
      + `calc(var(--climb-span) * var(--from-y) * ${rest} - ${lift}cqh)) `
      + `rotate(${round3(spin * share)}deg)`,
    opacity: ''
  };
}

// Each kind: (share, reduced, shape) => {transform, opacity}, shape being the part's build-up and
// fade shares. An empty string leaves the stylesheet's value (the still frame) in place.
const KINDS = {
  'storm-dim': (share, reduced) => ({
    transform: '',
    opacity: reduced ? '' : String(round3(track([[0, 0], [0.2, 0.35], [0.8, 0.35], [1, 0]], share)))
  }),
  'funnel-sweep': (share, reduced) => {
    if (reduced) {
      return {transform: '', opacity: ''};
    }
    const centre = round3(lerp(FUNNEL.fromFraction, FUNNEL.toFraction, share) * 100);
    return {transform: `translateX(calc(${centre}cqw - var(--funnel-w) / 2))`, opacity: ''};
  },
  // After its sweep the funnel lifts off where it stands: up, smaller, fading.
  'funnel-lift': (share, reduced) => {
    const gone = smooth(share);
    return {
      transform: reduced
        ? ''
        : `translateY(${round3(-30 * gone)}%) scale(${round3(1 - 0.6 * gone)})`,
      opacity: String(round3(1 - gone))
    };
  },
  'hunter-enter': (share, reduced) => ({
    transform: reduced ? '' : `translateX(calc(var(--enter-from) * ${round3(1 - share)}))`,
    opacity: ''
  }),
  'hunter-leave': (share, reduced) => ({
    transform: reduced ? '' : `translateX(calc(var(--enter-from) * ${round3(share)}))`,
    opacity: ''
  }),
  appear: (share, reduced) => ({
    transform: reduced ? '' : `scale(${round3(lerp(0.6, 1, share))})`,
    opacity: String(round3(share))
  }),
  'fade-out': (share) => ({transform: '', opacity: String(round3(1 - share))}),
  bolt: (share, reduced) => ({
    transform: '',
    opacity: reduced
      ? ''
      : String(round3(track([[0, 0], [0.1, 1], [0.4, 1], [0.55, 0.3], [0.7, 1], [1, 0]], share)))
  }),
  'sky-flash': (share, reduced) => ({
    transform: '',
    opacity: reduced ? '0' : String(round3(track([[0, 0], [0.4, 0.7], [1, 0]], share)))
  }),
  'photo-flash': (share, reduced) => ({
    transform: '',
    opacity: reduced ? '0' : String(round3(lerp(0.95, 0, share)))
  }),
  'hearts-rise': (share, reduced) => {
    if (reduced) {
      return {transform: '', opacity: ''};
    }
    const lift = round3(lerp(20, -140, share));
    const size = round3(lerp(0.6, 1.1, share));
    return {
      transform: `translateY(${lift}%) scale(${size})`,
      opacity: String(round3(track([[0, 0], [0.2, 1], [1, 0]], share)))
    };
  },
  pop: (share, reduced) => ({
    transform: reduced ? '' : `scale(${round3(track([[0, 0], [0.6, 1.4], [1, 1]], share))})`,
    opacity: ''
  }),
  slap: (share, reduced) => {
    if (reduced) {
      return {transform: '', opacity: ''};
    }
    const across = round3(track([[0, -80], [0.5, 0], [1, -10]], share));
    const turn = round3(track([[0, -30], [0.5, 10], [1, 0]], share));
    return {transform: `translateX(${across}%) rotate(${turn}deg)`, opacity: ''};
  },
  'smoke-rise': (share, reduced) => {
    if (reduced) {
      return {transform: '', opacity: ''};
    }
    const lift = round3(lerp(0, -120, share));
    const size = round3(lerp(0.5, 1.6, share));
    return {
      transform: `translateY(${lift}%) scale(${size})`,
      opacity: String(round3(lerp(0.9, 0, share)))
    };
  },
  // The eagle dives in from above, on the side away from the leaderboard for a squirrel in the
  // right half of the field (--away-x is -1 there, set by the racer).
  'eagle-dive': (share, reduced) => {
    if (reduced) {
      return {transform: '', opacity: ''};
    }
    const rest = round3(1 - smooth(share));
    return {
      transform: `translate(calc(var(--away-x, 1) * ${round3(60 * rest)}%), `
        + `calc(-60cqh * ${rest}))`,
      opacity: ''
    };
  },
  // It flies off up and away from the leaderboard, shrinking into the distance, then fades.
  'eagle-away': (share, reduced) => {
    const fade = String(round3(track([[0, 1], [0.6, 1], [1, 0]], share)));
    if (reduced) {
      return {transform: '', opacity: fade};
    }
    const gone = round3(share);
    return {
      transform: `translate(calc(var(--away-x, 1) * 25cqw * ${gone}), calc(-55cqh * ${gone})) `
        + `scale(${round3(1 - 0.5 * share)})`,
      opacity: fade
    };
  },
  // Chaos v2. Ground walkers: the cat lady and the gardener, stepping across the field.
  'walk-across': (share, reduced) => (
    reduced ? STILL : crossing(share, false, 18, WALK.fromFraction, WALK.toFraction)
  ),
  'walk-across-rtl': (share, reduced) => (
    reduced ? STILL : crossing(share, true, 18, WALK.fromFraction, WALK.toFraction)
  ),
  // A pigeon or a toupee blown across in the gust, fading in and out at the ends so it never
  // slides into the leaderboard's side of the stage.
  'fly-across': (share, reduced) => (reduced ? STILL : blownAcross(share, false)),
  'fly-across-rtl': (share, reduced) => (reduced ? STILL : blownAcross(share, true)),
  // Fades in, holds, fades out.
  'fade-in-out': (share) => ({
    transform: '',
    opacity: String(round3(track([[0, 0], [0.15, 1], [0.85, 1], [1, 0]], share)))
  }),
  // Builds up over the part's lead-in, holds, fades over its tail: the field-wide washes, the
  // gust, the disco lights and ball, the hail, the VAR review.
  envelope: (share, _reduced, shape) => ({
    transform: '',
    opacity: String(round3(envelope(share, shape)))
  }),
  // A trunk visitor (the beaver, the woodpecker) slides in from its outer side as it fades in,
  // and back out as it fades away (--from-side is -1 from the left, 1 from the right).
  'trunk-visit': (share, reduced, shape) => {
    const shown = envelope(share, shape);
    const offset = round3((1 - shown) * 45);
    return {
      transform: reduced ? '' : `translateX(calc(var(--from-side, -1) * ${offset}%))`,
      opacity: String(round3(shown))
    };
  },
  // The UFO glides in from the top left, hovers with a bob, and zooms off up into the sky,
  // shrinking and fading (never across towards the leaderboard).
  'ufo-hover': (share, reduced) => {
    const fade = String(round3(track([[0, 1], [0.88, 1], [1, 0]], share)));
    if (reduced) {
      return {transform: '', opacity: fade};
    }
    const across = round3(track([[0, -60], [0.2, 0], [1, 0]], share));
    const bob = round3(Math.sin(share * Math.PI * 10) * 1.5);
    const down = round3(track([[0, -30], [0.2, 0], [0.85, 0], [1, -35]], share) + bob);
    const size = round3(track([[0, 1], [0.85, 1], [1, 0.45]], share));
    return {transform: `translate(${across}cqw, ${down}cqh) scale(${size})`, opacity: fade};
  },
  // The flood water rises from below the field over its lead-in, holds at the waterline, and
  // drains over its tail. A translation, never a stretch, so the water is never redrawn.
  'flood-rise': (share, reduced, shape) => {
    const up = envelope(share, shape);
    return reduced
      ? {transform: '', opacity: String(round3(up))}
      : {transform: `translateY(${round3((1 - up) * 100)}%)`, opacity: ''};
  },
  // The bite growing in the beaver's trunk; the still frame is the full bite.
  grow: (share, reduced) => ({
    transform: reduced ? '' : `scale(${round3(smooth(share))})`,
    opacity: ''
  }),
  // The mole popping out of the crack (with a little overshoot) and sinking back.
  'mole-visit': (share, reduced, shape) => {
    const up = envelope(share, shape);
    if (reduced) {
      return {transform: '', opacity: String(round3(up))};
    }
    const overshoot = share < shape.inShare ? Math.sin(Math.PI * up) * 12 : 0;
    return {transform: `translateY(${round3((1 - up) * 100 - overshoot)}%)`, opacity: ''};
  },
  // The rubber duck bobbing across on the water.
  'duck-float': (share, reduced) => {
    if (reduced) {
      return STILL;
    }
    const across = round3(lerp(-8, 100, share));
    const bob = round3(Math.sin(share * Math.PI * 8) * 8);
    const tilt = round3(Math.sin(share * Math.PI * 8 + 1) * 6);
    return {transform: `translate(${across}cqw, ${bob}%) rotate(${tilt}deg)`, opacity: ''};
  },
  // The mirror ball dropping in on its string, with a little bounce.
  'drop-in': (share, reduced) => ({
    transform: reduced
      ? ''
      : `translateY(${round3(track([[0, -130], [0.7, 8], [0.85, -4], [1, 0]], share))}%)`,
    opacity: ''
  }),
  // The earthquake: the whole field jitters, building up over the lead-in and dying away over
  // the tail.
  quake: (share, reduced, shape) => {
    if (reduced) {
      return STILL;
    }
    const strength = envelope(share, shape);
    const across = round3(Math.sin(share * Math.PI * 2 * 28) * 6 * strength);
    const down = round3(Math.cos(share * Math.PI * 2 * 37) * 4 * strength);
    const turn = round3(Math.sin(share * Math.PI * 2 * 19) * 0.6 * strength);
    return {transform: `translate(${across}px, ${down}px) rotate(${turn}deg)`, opacity: ''};
  },
  // The crack in the ground opening out from its middle.
  'grow-x': (share, reduced) => ({
    transform: reduced ? '' : `scaleX(${round3(smooth(share))})`,
    opacity: ''
  }),
  // The mole popping out of the crack.
  'mole-pop': (share, reduced) => ({
    transform: reduced
      ? ''
      : `translateY(${round3(track([[0, 100], [0.4, -12], [0.55, 0], [1, 0]], share))}%)`,
    opacity: ''
  }),
  // The cow the tornado spits back at the hunter, tumbling in an arc from the funnel.
  'cow-spit': (share, reduced) => {
    if (reduced) {
      return STILL;
    }
    const rest = round3(1 - share);
    const lift = round3(Math.sin(Math.PI * share) * 18);
    return {
      transform: `translate(calc(-45cqw * ${rest}), calc(-20cqh * ${rest} - ${lift}cqh)) `
        + `rotate(${round3(share * 720)}deg)`,
      opacity: ''
    };
  },
  // A cat thrown from the cat lady's handbag, in an arc to its squirrel.
  'cat-fly': (share, reduced) => (reduced ? STILL : homing(share, 14, 540)),
  // The Golden Acorn of Doom homing straight in on the leader.
  'acorn-home': (share, reduced) => (reduced ? STILL : homing(share, 0, 30)),
  // The Golden Acorn's little victory loop.
  'acorn-loop': (share, reduced) => {
    if (reduced) {
      return STILL;
    }
    const angle = share * Math.PI * 2;
    const across = round3(Math.sin(angle) * 80);
    const down = round3(-(1 - Math.cos(angle)) * 80 - share * 60);
    return {
      transform: `translate(${across}%, ${down}%)`,
      opacity: String(round3(track([[0, 1], [0.8, 1], [1, 0]], share)))
    };
  },
  // A shaken-off cat dropping away.
  'drop-off': (share, reduced) => {
    const fall = `translateY(${round3(share * 60)}cqh) rotate(${round3(share * 200)}deg)`;
    return {transform: reduced ? '' : fall, opacity: String(round3(1 - share))};
  },
  // The VAR lines being drawn across the field.
  'lines-sweep': (share, reduced) => ({
    transform: reduced ? '' : `scaleX(${round3(smooth(share))})`,
    opacity: ''
  })
};

/**
 * @description The inline transform and opacity for one timed part at one moment.
 * @param {string} kind - The part's data-scrub-kind (see the list above).
 * @param {number} share - How far through its window it is, 0 to 1.
 * @param {boolean} [reduced] - Reduced motion: still frames, no movement, no flash.
 * @param {{inShare?: number, outShare?: number}} [shape] - The part's build-up and fade shares
 *   (data-scrub-in and data-scrub-out); DEFAULT_SHAPE fills any that are missing.
 * @returns {{transform: string, opacity: string}} Values to write; '' means "leave the
 *   stylesheet's value". An unknown kind returns two empty strings.
 * @example
 *   scrubFrame('appear', 0.5, false);
 *   // {transform: 'scale(0.8)', opacity: '0.5'}
 * @since 1.0.0
 */
export function scrubFrame(kind, share, reduced = false, shape = DEFAULT_SHAPE) {
  const frame = Object.prototype.hasOwnProperty.call(KINDS, kind) ? KINDS[kind] : null;
  if (!frame) {
    return {transform: '', opacity: ''};
  }
  const given = shape && typeof shape === 'object' ? shape : DEFAULT_SHAPE;
  const inShare = Number.isFinite(given.inShare) ? given.inShare : DEFAULT_SHAPE.inShare;
  const outShare = Number.isFinite(given.outShare) ? given.outShare : DEFAULT_SHAPE.outShare;
  return frame(unit(share), reduced === true, {inShare: unit(inShare), outShare: unit(outShare)});
}

/**
 * @description How far through its window a timed part is.
 * @param {number} nowMs - The clock reading (race or stage time, as the part says).
 * @param {number} startMs - Window start.
 * @param {number} durationMs - Window length (at least 1).
 * @returns {number} From 0 to 1.
 * @example
 *   scrubShare(1500, 1000, 1000);
 *   // 0.5
 * @since 1.0.0
 */
export function scrubShare(nowMs, startMs, durationMs) {
  return unit((nowMs - startMs) / Math.max(1, durationMs));
}
