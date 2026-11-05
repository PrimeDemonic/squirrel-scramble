import {css} from 'lit';
import {cast2Animations} from './cast2.js';
import {fieldAnimations} from './field.js';
import {boothAnimations} from './booth.js';

/**
 * Squirrel Scramble sprite kit, part 4: keyframes and animation classes (SPEC.md § 12, § 13;
 * Chaos v2 § 5).
 *
 * Every Lit stylesheet the kit has is exported from this module, including the Chaos v2
 * sheets re-exported from cast2.js (cast2Animations), field.js (fieldAnimations) and, since
 * 2.2.0, booth.js (boothAnimations, the owl commentator, contract § 12), because
 * the race stage adopts every CSSResult this module exports. Elsewhere, include
 * `spriteStyles` (an array Lit flattens) in the static styles of any component that renders
 * sprites. Pose loops start from the classes the sprite functions put on their roots
 * (ss-pose-*, ss-fur-*, ss-dance-*); one-shot events start when the race adds a class from
 * ANIMATION_CLASSES to a sprite root or any ancestor, and run once unless
 * --ss-oneshot-count says otherwise (the wardrobe sets it to infinite).
 *
 * Motion is transforms and opacity, with one exception: the rainbow coat cycles its fill
 * colour (see the note at that rule). Opacity and colour changes use linear timing. Durations
 * are custom properties with defaults, `var(--ss-<name>-duration, <ms>)`, borrowing the
 * Horizon motion tokens (--duration-*, --ease-*) where an animation is a UI transition rather
 * than character motion. Every animation has a prefers-reduced-motion rule that stops it or
 * leaves a still frame, and the lightning and photo flashes are suppressed entirely there.
 */

/** Classes that start a one-shot event animation; add one to a sprite root or an ancestor. */
export const ANIMATION_CLASSES = Object.freeze({
  tumble: 'ss-anim-tumble',
  slip: 'ss-anim-slip',
  kissLean: 'ss-anim-kiss-lean',
  slapShake: 'ss-anim-slap-shake',
  heartFloat: 'ss-anim-heart-float',
  pop: 'ss-anim-pop',
  debrisOrbit: 'ss-anim-debris-orbit',
  eagleDive: 'ss-anim-eagle-dive',
  tornadoCross: 'ss-anim-tornado-cross',
  treeBend: 'ss-anim-tree-bend',
  treeWobble: 'ss-anim-tree-wobble',
  chestnutBounce: 'ss-anim-chestnut-bounce',
  confettiFall: 'ss-anim-confetti-fall',
  photoFlash: 'ss-photo-flash',
  photoStamp: 'ss-photo-stamp',
  lightningFlash: 'ss-lightning-flash',
  flip: 'ss-flip',
  danceAlong: 'ss-anim-dance-along',
  robot: 'ss-anim-robot',
  quake: 'ss-anim-quake',
  domino: 'ss-anim-domino',
  hailFall: 'ss-anim-hail-fall'
});

export {cast2Animations, fieldAnimations, boothAnimations};

/** Layout, pivots and the keyframes shared by several sprites. */
export const spriteBaseStyles = css`
  .ss-sprite {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  /* A sky is sliced to cover its box, so it must clip. */
  .ss-sprite.ss-sky {
    overflow: hidden;
  }

  /* Faces a sprite left. The scale property composes with any transform animation. */
  .ss-flip {
    scale: -1 1;
  }

  /*
   * Fur colours. A rodent root (squirrel or suitor) sets --fur, --fur-dark, --belly and
   * --eye; a crowd animal's root sets --fur, --fur-dark (its paws or wings) and --belly; the
   * slap's root sets --fur (the suitor's paw). These classes paint the parts with them. The
   * parts also carry literal colours, so they draw without this sheet. Never put var() in an
   * SVG presentation attribute.
   */
  :is(.ss-squirrel, .ss-suitor, .ss-crowd, .ss-slap-hand) .ss-fur {
    fill: var(--fur, sienna);
  }

  :is(.ss-squirrel, .ss-suitor, .ss-crowd, .ss-slap-hand) .ss-fur-dark {
    fill: var(--fur-dark, saddlebrown);
  }

  :is(.ss-squirrel, .ss-suitor, .ss-crowd, .ss-slap-hand) .ss-fur-belly {
    fill: var(--belly, wheat);
  }

  :is(.ss-squirrel, .ss-suitor, .ss-crowd, .ss-slap-hand) .ss-fur-stroke {
    stroke: var(--fur, sienna);
  }

  :is(.ss-squirrel, .ss-suitor, .ss-crowd, .ss-slap-hand)
    :is(.ss-fur-dark-stroke, .ss-fur-edge) {
    stroke: var(--fur-dark, saddlebrown);
  }

  :is(.ss-squirrel, .ss-suitor, .ss-crowd, .ss-slap-hand) .ss-fur-belly-stroke {
    stroke: var(--belly, wheat);
  }

  :is(.ss-squirrel, .ss-suitor) .ss-pupil {
    fill: var(--eye, black);
  }

  /*
   * Pivots. An SVG part's transform origin defaults to 0 0, not its centre, so every part
   * that turns names its joint in viewBox units, or turns about its own box (fill-box) when
   * it spins or swells in place.
   */
  .ss-sprite .ss-event {
    transform-origin: 50px 60px;
  }

  :is(.ss-squirrel, .ss-suitor) .ss-motion {
    transform-origin: 52px 90px;
  }

  :is(.ss-squirrel, .ss-suitor) .tail {
    transform-origin: 42px 80px;
  }

  :is(.ss-squirrel, .ss-suitor) .cape {
    transform-origin: 52px 47px;
  }

  :is(.ss-squirrel, .ss-suitor) .arm-front {
    transform-origin: 60.5px 53px;
  }

  :is(.ss-squirrel, .ss-suitor) .arm-back {
    transform-origin: 55.5px 51px;
  }

  :is(.ss-squirrel, .ss-suitor) .leg {
    transform-origin: 46px 76px;
  }

  :is(.ss-squirrel, .ss-suitor) .head {
    transform-origin: 57px 45px;
  }

  :is(.ss-squirrel, .ss-suitor) .ear {
    transform-origin: 55px 25px;
  }

  :is(.ss-squirrel, .ss-suitor) .eye {
    transform-origin: 64.5px 30.5px;
  }

  .ss-squirrel .scarf-tail {
    transform-origin: 53px 48px;
  }

  .ss-squirrel .cat-cling {
    transform-origin: 43px 56px;
  }

  .ss-squirrel .cheek-pouch {
    transform-box: fill-box;
    transform-origin: center;
  }

  .ss-hunter .ss-motion {
    transform-origin: 50px 93px;
  }

  .ss-hunter .leg-back {
    transform-origin: 44.5px 69px;
  }

  .ss-hunter .leg-front {
    transform-origin: 51.5px 69px;
  }

  .ss-eagle .ss-motion {
    transform-origin: 50px 52px;
  }

  .ss-eagle .wing-far {
    transform-origin: 46px 46px;
  }

  .ss-eagle .wing-near {
    transform-origin: 50px 48px;
  }

  .ss-beaver .head {
    transform-origin: 60px 52px;
  }

  .ss-beaver .tail {
    transform-origin: 38px 80px;
  }

  .ss-crowd .ss-motion {
    transform-origin: 50px 96px;
  }

  .ss-crowd .arm-left {
    transform-origin: 33px 64px;
  }

  .ss-crowd .arm-right {
    transform-origin: 67px 64px;
  }

  .ss-sprite
    :is(
      .propeller-blades,
      .dizzy-star,
      .sparkle-star,
      .heart-pulse,
      .heart-body,
      .kiss-body,
      .puff,
      .soot-body,
      .soot-spark,
      .confetti-shape,
      .chips,
      .muzzle-flash,
      .blam,
      .gun-smoke,
      .backfire-smoke,
      .cap-flying,
      .slap-paw,
      .impact,
      .smoke-wisp,
      .nut-bubble,
      .grumble-cloud,
      .dust
    ),
  :is(.ss-hunter, .ss-beaver) .eye {
    transform-box: fill-box;
    transform-origin: center;
  }

  .ss-sprite :is(.tree-rig, .chestnut, .funnel) {
    transform-box: fill-box;
    transform-origin: 50% 100%;
  }

  .ss-suitor .lashes {
    transform-box: fill-box;
    transform-origin: 50% 100%;
  }

  .ss-hunter .moustache {
    transform-box: fill-box;
    transform-origin: 50% 30%;
  }

  .ss-hunter .gun {
    transform-box: fill-box;
    transform-origin: 20% 50%;
  }

  @keyframes ss-appear {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes ss-fade-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }

  @keyframes ss-fade-in-out {
    0% { opacity: 0; }
    30% { opacity: 0.85; }
    100% { opacity: 0; }
  }

  @keyframes ss-fade-late {
    0%, 70% { opacity: 1; }
    100% { opacity: 0; }
  }

  @keyframes ss-flicker {
    0%, 100% { opacity: 0.8; }
    50% { opacity: 0.3; }
  }

  @keyframes ss-glow-pulse {
    0%, 100% { opacity: 0.25; }
    50% { opacity: 0.75; }
  }

  @keyframes ss-twinkle-opacity {
    0%, 100% { opacity: 0.2; }
    50% { opacity: 1; }
  }

  @keyframes ss-puff-opacity {
    0% { opacity: 0; }
    20% { opacity: 0.9; }
    100% { opacity: 0; }
  }

  @keyframes ss-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.15); }
  }

  @keyframes ss-bob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-1.5px); }
  }

  @keyframes ss-hop {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }

  @keyframes ss-sway {
    0%, 100% { transform: rotate(-6deg); }
    50% { transform: rotate(6deg); }
  }

  @keyframes ss-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes ss-flip-x {
    0%, 100% { transform: scaleX(1); }
    50% { transform: scaleX(-1); }
  }

  @keyframes ss-blink {
    0%, 92%, 100% { transform: scaleY(1); }
    95% { transform: scaleY(0.1); }
  }

  @keyframes ss-jitter {
    0%, 100% { transform: translate(0, 0); }
    25% { transform: translate(-1px, 0.5px); }
    50% { transform: translate(1px, -0.5px); }
    75% { transform: translate(-0.5px, -0.5px); }
  }

  @keyframes ss-breathe {
    0%, 100% { transform: scale(1, 1); }
    50% { transform: scale(1.01, 1.025); }
  }

  @keyframes ss-twinkle-scale {
    0%, 100% { transform: scale(0.4) rotate(0deg); }
    50% { transform: scale(1.1) rotate(45deg); }
  }

  @keyframes ss-rise {
    from { transform: translateY(0) scale(0.6); }
    to { transform: translateY(-10px) scale(1.5); }
  }

  @keyframes ss-puff-scale {
    from { transform: scale(0.4); }
    to { transform: scale(1.4); }
  }

  @keyframes ss-pop-in {
    from { transform: scale(0.2); }
    to { transform: scale(1); }
  }

  @keyframes ss-wave-arm {
    0%, 100% { transform: rotate(-8deg); }
    50% { transform: rotate(10deg); }
  }

  @keyframes ss-slap-shake {
    0%, 100% { transform: rotate(0deg) translateX(0); }
    15% { transform: rotate(-14deg) translateX(-4px); }
    35% { transform: rotate(8deg) translateX(2px); }
    55% { transform: rotate(-5deg) translateX(-1px); }
    75% { transform: rotate(3deg) translateX(0); }
  }

  /* Eight points round an ellipse; the lower (nearer) points draw larger. */
  @keyframes ss-orbit {
    0%,
    100% {
      transform: translate(calc(var(--ss-orbit-rx, 13px) * -1), 0) scale(0.85);
    }
    12.5% {
      transform: translate(
          calc(var(--ss-orbit-rx, 13px) * -0.71),
          calc(var(--ss-orbit-ry, 4px) * 0.71)
        )
        scale(1);
    }
    25% {
      transform: translate(0, var(--ss-orbit-ry, 4px)) scale(1.1);
    }
    37.5% {
      transform: translate(
          calc(var(--ss-orbit-rx, 13px) * 0.71),
          calc(var(--ss-orbit-ry, 4px) * 0.71)
        )
        scale(1);
    }
    50% {
      transform: translate(var(--ss-orbit-rx, 13px), 0) scale(0.85);
    }
    62.5% {
      transform: translate(
          calc(var(--ss-orbit-rx, 13px) * 0.71),
          calc(var(--ss-orbit-ry, 4px) * -0.71)
        )
        scale(0.7);
    }
    75% {
      transform: translate(0, calc(var(--ss-orbit-ry, 4px) * -1)) scale(0.6);
    }
    87.5% {
      transform: translate(
          calc(var(--ss-orbit-rx, 13px) * -0.71),
          calc(var(--ss-orbit-ry, 4px) * -0.71)
        )
        scale(0.7);
    }
  }
`;

/** The racing squirrel: pose loops, outfits, fur, effects and one-shot events. */
export const squirrelAnimations = css`
  /* Climb: a wobble, paws reaching in turn and a pushing leg. */
  .ss-squirrel.ss-pose-climb .ss-motion {
    animation: ss-climb-wobble var(--ss-climb-wobble-duration, 600ms) ease-in-out infinite;
  }

  .ss-squirrel.ss-pose-climb .arm-front {
    animation: ss-climb-reach var(--ss-climb-wobble-duration, 600ms) ease-in-out infinite;
  }

  .ss-squirrel.ss-pose-climb .arm-back {
    animation: ss-climb-reach var(--ss-climb-wobble-duration, 600ms) ease-in-out infinite;
    animation-delay: calc(var(--ss-climb-wobble-duration, 600ms) / -2);
  }

  .ss-squirrel.ss-pose-climb .leg {
    animation: ss-leg-push var(--ss-climb-wobble-duration, 600ms) ease-in-out infinite;
  }

  /* Tail flick while climbing, idling, cheering, celebrating or beckoning. */
  :is(.ss-squirrel, .ss-suitor):is(
      .ss-pose-climb,
      .ss-pose-idle,
      .ss-pose-cheer,
      .ss-pose-victory,
      .ss-pose-beckon,
      .ss-pose-dance
    )
    .tail {
    animation: ss-tail-flick var(--ss-tail-flick-duration, 1400ms) ease-in-out infinite;
  }

  /* Idle: breathing, and the odd blink. */
  .ss-squirrel.ss-pose-idle .ss-motion {
    animation: ss-breathe var(--ss-idle-breathe-duration, 2600ms) ease-in-out infinite;
  }

  :is(.ss-squirrel, .ss-suitor):is(.ss-pose-idle, .ss-pose-climb, .ss-pose-beckon) .eye {
    animation: ss-blink var(--ss-blink-duration, 4200ms) linear infinite;
  }

  /* Cheer: bouncing with waving arms (the jig waves them too). */
  .ss-squirrel.ss-pose-cheer .ss-motion {
    animation: ss-hop var(--ss-cheer-bounce-duration, 500ms) ease-in-out infinite;
  }

  .ss-squirrel:is(.ss-pose-cheer, .ss-dance-jig) :is(.arm-front, .arm-back) {
    animation: ss-wave-arm var(--ss-cheer-bounce-duration, 500ms) ease-in-out infinite;
  }

  /* Dizzy: a woozy sway while stars orbit the head (and the stars sprite). */
  .ss-squirrel.ss-pose-dizzy .ss-motion {
    animation: ss-sway var(--ss-sway-duration, 1700ms) ease-in-out infinite;
  }

  .ss-sprite .dizzy-star {
    animation: ss-orbit var(--ss-dizzy-orbit-duration, 1200ms) linear infinite;
  }

  .ss-sprite .dizzy-star.dizzy-star-2 {
    animation-delay: calc(var(--ss-dizzy-orbit-duration, 1200ms) / -3);
  }

  .ss-sprite .dizzy-star.dizzy-star-3 {
    animation-delay: calc(var(--ss-dizzy-orbit-duration, 1200ms) / -1.5);
  }

  /* Stunned: a jitter. */
  .ss-squirrel.ss-pose-stunned .ss-motion {
    animation: ss-jitter var(--ss-jitter-duration, 140ms) linear infinite;
  }

  /* Kiss: leaning in with a dreamy sway (the suitor too). */
  :is(.ss-squirrel, .ss-suitor).ss-pose-kiss .ss-motion {
    animation: ss-kiss-sway var(--ss-kiss-sway-duration, 1600ms) ease-in-out infinite;
  }

  /* Sulk: drooping tail, bowed head and heavy sighs. */
  .ss-squirrel.ss-pose-sulk .ss-motion {
    animation: ss-sigh var(--ss-sigh-duration, 2800ms) ease-in-out infinite;
  }

  .ss-squirrel.ss-pose-sulk .tail {
    transform: rotate(-14deg);
  }

  .ss-squirrel.ss-pose-sulk .head {
    transform: rotate(9deg);
  }

  /* Victory dances, picked by hat. */
  .ss-squirrel.ss-dance-jig .ss-motion {
    animation: ss-jig var(--ss-dance-duration, 800ms) ease-in-out infinite;
  }

  .ss-squirrel.ss-dance-royal-wave .ss-motion {
    animation: ss-royal-sway var(--ss-dance-duration, 800ms) ease-in-out infinite;
  }

  .ss-squirrel.ss-dance-royal-wave .arm-front {
    animation: ss-royal-wave calc(var(--ss-dance-duration, 800ms) * 1.5) ease-in-out infinite;
  }

  .ss-squirrel.ss-dance-war-dance .ss-motion {
    animation: ss-war-stomp var(--ss-dance-duration, 800ms) ease-in-out infinite;
  }

  .ss-squirrel.ss-dance-war-dance :is(.arm-front, .arm-back) {
    animation: ss-pump calc(var(--ss-dance-duration, 800ms) / 2) ease-in-out infinite;
  }

  .ss-squirrel.ss-dance-conga .ss-motion {
    animation: ss-conga var(--ss-dance-duration, 800ms) ease-in-out infinite;
  }

  /* Fly: spinning inside the tornado while the wind whirls the other way. */
  .ss-squirrel.ss-pose-fly .ss-motion {
    transform-origin: 50px 58px;
    animation: ss-spin var(--ss-spin-duration, 700ms) linear infinite;
  }

  .ss-squirrel .wind-swirl {
    transform-origin: 50px 52px;
    animation: ss-spin var(--ss-spin-duration, 700ms) linear infinite reverse;
  }

  /* Outfits: capes and scarf tails flutter, propellers spin, haloes float and glow. */
  .ss-squirrel .cape:not(.cape-none),
  .ss-squirrel .scarf-tail {
    animation: ss-cape-flutter var(--ss-cape-flutter-duration, 700ms) ease-in-out infinite;
  }

  .ss-squirrel .propeller-blades {
    animation: ss-flip-x var(--ss-propeller-spin-duration, 260ms) linear infinite;
  }

  .ss-squirrel .hat-halo {
    animation: ss-float var(--ss-halo-float-duration, 2400ms) ease-in-out infinite;
  }

  .ss-squirrel .halo-glow {
    animation: ss-glow-pulse var(--ss-glow-pulse-duration, 1600ms) linear infinite;
  }

  /*
   * Rainbow fur cycles its fill colour, linear as colour changes must be. It is the one
   * animation that is not a transform or opacity: a hue cycle cannot be built from them
   * without duplicating the geometry. It runs only on the legendary rainbow coat.
   */
  .ss-squirrel.ss-fur-rainbow:not(.ss-singed) .ss-fur {
    animation: ss-rainbow-fill var(--ss-rainbow-cycle-duration, 3000ms) linear infinite;
  }

  .ss-squirrel.ss-fur-rainbow:not(.ss-singed) .ss-fur-dark {
    animation: ss-rainbow-fill var(--ss-rainbow-cycle-duration, 3000ms) linear infinite;
    animation-delay: calc(var(--ss-rainbow-cycle-duration, 3000ms) / -6);
  }

  .ss-squirrel.ss-fur-rainbow:not(.ss-singed) .ss-fur-stroke {
    animation: ss-rainbow-stroke var(--ss-rainbow-cycle-duration, 3000ms) linear infinite;
  }

  .ss-squirrel.ss-fur-rainbow:not(.ss-singed) .ss-fur-dark-stroke {
    animation: ss-rainbow-stroke var(--ss-rainbow-cycle-duration, 3000ms) linear infinite;
    animation-delay: calc(var(--ss-rainbow-cycle-duration, 3000ms) / -6);
  }

  /* Golden fur's sheen twinkles. */
  .ss-squirrel .sheen {
    animation: ss-twinkle-opacity var(--ss-sheen-duration, 2200ms) linear infinite;
  }

  .ss-squirrel .sheen.sheen-body {
    animation-delay: calc(var(--ss-sheen-duration, 2200ms) / -2);
  }

  /* The legendary aura. */
  .ss-sprite .sparkle-glow {
    animation: ss-glow-pulse var(--ss-sparkle-duration, 1500ms) linear infinite;
  }

  .ss-sprite .sparkle-star {
    animation:
      ss-twinkle-scale var(--ss-sparkle-duration, 1500ms) ease-in-out infinite,
      ss-twinkle-opacity var(--ss-sparkle-duration, 1500ms) linear infinite;
  }

  .ss-sprite .sparkle-star.sparkle-star-2 {
    animation-delay: calc(var(--ss-sparkle-duration, 1500ms) / -4);
  }

  .ss-sprite .sparkle-star.sparkle-star-3 {
    animation-delay: calc(var(--ss-sparkle-duration, 1500ms) / -2);
  }

  .ss-sprite .sparkle-star.sparkle-star-4 {
    animation-delay: calc(var(--ss-sparkle-duration, 1500ms) * -0.75);
  }

  /* Singed: smoke curls off the tail. */
  .ss-squirrel .smoke-wisp {
    animation:
      ss-rise var(--ss-smoke-duration, 1600ms) ease-out infinite,
      ss-fade-in-out var(--ss-smoke-duration, 1600ms) linear infinite;
  }

  .ss-squirrel .smoke-wisp.wisp-2 {
    animation-delay: calc(var(--ss-smoke-duration, 1600ms) / -2);
  }

  /* Nut stop: the chestnut bubble pops in, then bobs. */
  .ss-squirrel .nut-bubble {
    animation:
      ss-pop-in var(--ss-pop-duration, var(--duration-lg, 300ms))
        var(--ease-light-bounce, cubic-bezier(0.3, 1.41, 0.4, 0.99)) both,
      ss-bob var(--ss-bob-duration, 1600ms) ease-in-out
        var(--ss-pop-duration, var(--duration-lg, 300ms)) infinite;
  }

  /* Chaos v2 poses: a disco point, and clinging to the trunk like a flag in a gale. */
  .ss-squirrel.ss-pose-dance .ss-motion {
    animation: ss-disco-hips var(--ss-disco-duration, 600ms) ease-in-out infinite;
  }

  .ss-squirrel.ss-pose-dance .arm-front {
    animation: ss-disco-point var(--ss-disco-duration, 600ms) ease-in-out infinite alternate;
  }

  /*
   * Flag: the body turns from its paws to stream sideways, downwind of the trunk; the tail
   * turns to stream behind it and the cape flaps hard. Without this sheet the squirrel stands
   * upright, squinting and gritting its teeth.
   */
  .ss-squirrel.ss-pose-flag .ss-motion {
    transform-origin: 56px 30px;
    animation: ss-flag-flap var(--ss-flag-flap-duration, 260ms) ease-in-out infinite alternate;
  }

  .ss-squirrel.ss-pose-flag .tail {
    animation: ss-flag-tail var(--ss-flag-flap-duration, 260ms) ease-in-out infinite alternate;
  }

  .ss-squirrel.ss-pose-flag .cape:not(.cape-none),
  .ss-squirrel.ss-pose-flag .scarf-tail {
    animation: ss-flag-cape var(--ss-flag-cape-duration, 180ms) ease-in-out infinite alternate;
  }

  .ss-squirrel.ss-pose-flag .cheek {
    transform-box: fill-box;
    transform-origin: center;
    animation: ss-cheek-flap var(--ss-flag-cape-duration, 180ms) ease-in-out infinite alternate;
  }

  /* Chaos v2 effects: stuffed cheeks wobble, the cat hangs on, the woodpecker rattles. */
  .ss-squirrel.ss-chubby .cheek-pouch {
    animation: ss-chubby-wobble var(--ss-chubby-duration, 420ms) ease-in-out infinite alternate;
  }

  .ss-squirrel.ss-cat-clinging .cat-cling {
    animation: ss-cat-wobble var(--ss-cat-wobble-duration, 700ms) ease-in-out infinite alternate;
  }

  .ss-squirrel.ss-vibrate .vibrate-rig {
    animation: ss-vibrate var(--ss-vibrate-duration, 70ms) linear infinite;
  }

  .ss-squirrel.ss-vibrate .hat {
    animation: ss-judder var(--ss-judder-duration, 90ms) linear infinite;
  }

  .ss-squirrel.ss-vibrate .vibrate-lines {
    animation: ss-flicker var(--ss-vibrate-lines-duration, 200ms) linear infinite;
  }

  /* One-shot events (ANIMATION_CLASSES), on the sprite root or any ancestor. */
  .ss-anim-tumble .ss-event {
    animation: ss-hit-tumble var(--ss-hit-tumble-duration, 900ms)
      var(--ease-medium-accel, cubic-bezier(0.3, 0, 0.29, 1)) var(--ss-oneshot-count, 1) both;
  }

  .ss-anim-slip .ss-event {
    animation: ss-slip-shake var(--ss-slip-shake-duration, 400ms) ease-in-out
      var(--ss-oneshot-count, 1) both;
  }

  .ss-anim-kiss-lean .ss-event {
    animation: ss-kiss-lean var(--ss-kiss-lean-duration, 1200ms)
      var(--ease-low-accel, cubic-bezier(0.52, 0.01, 0.3, 0.99)) var(--ss-oneshot-count, 1) both;
  }

  .ss-anim-slap-shake .ss-event {
    animation: ss-slap-shake var(--ss-slap-shake-duration, 600ms) ease-out
      var(--ss-oneshot-count, 1) both;
  }

  @keyframes ss-climb-wobble {
    0%, 100% { transform: rotate(-3deg) translateY(0); }
    50% { transform: rotate(3deg) translateY(-1.5px); }
  }

  @keyframes ss-climb-reach {
    0%, 100% { transform: rotate(-10deg); }
    50% { transform: rotate(12deg); }
  }

  @keyframes ss-leg-push {
    0%, 100% { transform: rotate(-6deg); }
    50% { transform: rotate(5deg); }
  }

  @keyframes ss-tail-flick {
    0%, 100% { transform: rotate(0deg); }
    30% { transform: rotate(-10deg); }
    45% { transform: rotate(6deg); }
    60% { transform: rotate(-3deg); }
  }

  @keyframes ss-kiss-sway {
    0%, 100% { transform: rotate(8deg); }
    50% { transform: rotate(11deg); }
  }

  @keyframes ss-sigh {
    0%, 100% { transform: scale(1, 1); }
    50% { transform: scale(1.01, 0.97); }
  }

  @keyframes ss-jig {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    25% { transform: translateY(-6px) rotate(-6deg); }
    50% { transform: translateY(0) rotate(0deg); }
    75% { transform: translateY(-6px) rotate(6deg); }
  }

  @keyframes ss-royal-sway {
    0%, 100% { transform: rotate(-2deg); }
    50% { transform: rotate(2deg); }
  }

  @keyframes ss-royal-wave {
    0%, 100% { transform: rotate(-6deg); }
    50% { transform: rotate(14deg); }
  }

  @keyframes ss-war-stomp {
    0%, 100% { transform: translateY(0) rotate(-6deg); }
    25% { transform: translateY(-4px) rotate(0deg); }
    50% { transform: translateY(0) rotate(6deg); }
    75% { transform: translateY(-4px) rotate(0deg); }
  }

  @keyframes ss-pump {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(-22deg); }
  }

  @keyframes ss-conga {
    0%, 100% { transform: translateX(-4px) rotate(-5deg); }
    50% { transform: translateX(4px) rotate(5deg); }
  }

  @keyframes ss-cape-flutter {
    0%, 100% { transform: rotate(0deg) scaleX(1); }
    50% { transform: rotate(5deg) scaleX(1.06); }
  }

  @keyframes ss-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-2px); }
  }

  @keyframes ss-rainbow-fill {
    0%, 100% { fill: var(--ss-rainbow-1, crimson); }
    17% { fill: var(--ss-rainbow-2, darkorange); }
    33% { fill: var(--ss-rainbow-3, gold); }
    50% { fill: var(--ss-rainbow-4, mediumseagreen); }
    67% { fill: var(--ss-rainbow-5, dodgerblue); }
    83% { fill: var(--ss-rainbow-6, mediumorchid); }
  }

  @keyframes ss-rainbow-stroke {
    0%, 100% { stroke: var(--ss-rainbow-1, crimson); }
    17% { stroke: var(--ss-rainbow-2, darkorange); }
    33% { stroke: var(--ss-rainbow-3, gold); }
    50% { stroke: var(--ss-rainbow-4, mediumseagreen); }
    67% { stroke: var(--ss-rainbow-5, dodgerblue); }
    83% { stroke: var(--ss-rainbow-6, mediumorchid); }
  }

  @keyframes ss-hit-tumble {
    0% { transform: translate(0, 0) rotate(0deg); }
    20% { transform: translate(-4px, -6px) rotate(-90deg); }
    60% { transform: translate(-2px, 10px) rotate(-270deg); }
    100% { transform: translate(0, 0) rotate(-360deg); }
  }

  @keyframes ss-slip-shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-3px); }
    40% { transform: translateX(3px); }
    60% { transform: translateX(-2px); }
    80% { transform: translateX(2px); }
  }

  @keyframes ss-kiss-lean {
    0%, 100% { transform: rotate(0deg) translateX(0); }
    35%, 70% { transform: rotate(12deg) translateX(3px); }
  }

  @keyframes ss-disco-hips {
    0%, 100% { transform: translateX(-2px) rotate(-5deg); }
    50% { transform: translateX(2px) rotate(5deg); }
  }

  @keyframes ss-disco-point {
    from { transform: rotate(-14deg); }
    to { transform: rotate(16deg); }
  }

  @keyframes ss-flag-flap {
    from { transform: translate(-10px, 22px) rotate(-81deg) scale(0.86); }
    to { transform: translate(-10px, 22px) rotate(-87deg) scale(0.86) skewY(2deg); }
  }

  @keyframes ss-flag-tail {
    from { transform: rotate(168deg); }
    to { transform: rotate(186deg); }
  }

  @keyframes ss-flag-cape {
    from { transform: skewX(-6deg) scaleY(1.04); }
    to { transform: skewX(6deg) scaleY(1.12); }
  }

  @keyframes ss-cheek-flap {
    from { transform: scale(1, 1); }
    to { transform: scale(1.12, 0.9); }
  }

  @keyframes ss-chubby-wobble {
    from { transform: scale(1, 1); }
    to { transform: scale(1.06, 0.95); }
  }

  @keyframes ss-cat-wobble {
    from { transform: rotate(-7deg); }
    to { transform: rotate(7deg); }
  }

  @keyframes ss-vibrate {
    0%, 100% { transform: translate(0, 0); }
    25% { transform: translate(-1.5px, 0.5px); }
    50% { transform: translate(1.5px, -0.5px); }
    75% { transform: translate(-1px, -0.5px); }
  }

  @keyframes ss-judder {
    0%, 100% { transform: translate(0, 0) rotate(0deg); }
    50% { transform: translate(0.8px, -1px) rotate(3deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .ss-squirrel.ss-pose-climb .ss-motion,
    .ss-squirrel.ss-pose-climb .arm-front,
    .ss-squirrel.ss-pose-climb .arm-back,
    .ss-squirrel.ss-pose-climb .leg,
    :is(.ss-squirrel, .ss-suitor):is(
        .ss-pose-climb,
        .ss-pose-idle,
        .ss-pose-cheer,
        .ss-pose-victory,
        .ss-pose-beckon,
        .ss-pose-dance
      )
      .tail,
    .ss-squirrel.ss-pose-idle .ss-motion,
    :is(.ss-squirrel, .ss-suitor):is(.ss-pose-idle, .ss-pose-climb, .ss-pose-beckon) .eye,
    .ss-squirrel.ss-pose-cheer .ss-motion,
    .ss-squirrel:is(.ss-pose-cheer, .ss-dance-jig) :is(.arm-front, .arm-back),
    .ss-squirrel.ss-pose-dizzy .ss-motion,
    .ss-squirrel.ss-pose-stunned .ss-motion,
    .ss-squirrel.ss-pose-sulk .ss-motion,
    .ss-squirrel.ss-dance-jig .ss-motion,
    .ss-squirrel.ss-dance-royal-wave .ss-motion,
    .ss-squirrel.ss-dance-royal-wave .arm-front,
    .ss-squirrel.ss-dance-war-dance .ss-motion,
    .ss-squirrel.ss-dance-war-dance :is(.arm-front, .arm-back),
    .ss-squirrel.ss-dance-conga .ss-motion,
    .ss-squirrel .wind-swirl,
    .ss-squirrel .cape:not(.cape-none),
    .ss-squirrel .scarf-tail,
    .ss-squirrel .propeller-blades,
    .ss-squirrel .hat-halo,
    .ss-squirrel.ss-fur-rainbow:not(.ss-singed) .ss-fur,
    .ss-squirrel.ss-fur-rainbow:not(.ss-singed) .ss-fur-dark,
    .ss-squirrel.ss-fur-rainbow:not(.ss-singed) .ss-fur-stroke,
    .ss-squirrel.ss-fur-rainbow:not(.ss-singed) .ss-fur-dark-stroke,
    .ss-squirrel .nut-bubble,
    .ss-anim-tumble .ss-event,
    .ss-anim-slip .ss-event,
    .ss-anim-slap-shake .ss-event,
    .ss-squirrel.ss-pose-dance .ss-motion,
    .ss-squirrel.ss-pose-dance .arm-front,
    .ss-squirrel.ss-pose-flag .cape:not(.cape-none),
    .ss-squirrel.ss-pose-flag .scarf-tail,
    .ss-squirrel.ss-pose-flag .cheek,
    .ss-squirrel.ss-chubby .cheek-pouch,
    .ss-squirrel.ss-cat-clinging .cat-cling,
    .ss-squirrel.ss-vibrate .vibrate-rig,
    .ss-squirrel.ss-vibrate .hat {
      animation: none;
    }

    /* A flag still streams sideways, tail out behind; vibration lines stay as a still cue. */
    .ss-squirrel.ss-pose-flag .ss-motion {
      animation: none;
      transform: translate(-10px, 22px) rotate(-84deg) scale(0.86);
    }

    .ss-squirrel.ss-pose-flag .tail {
      animation: none;
      transform: rotate(178deg);
    }

    .ss-squirrel.ss-vibrate .vibrate-lines {
      animation: none;
      opacity: 0.7;
    }

    /* Still frames: the lean of a kiss, a tilt in mid-spin, stars spread round the head. */
    :is(.ss-squirrel, .ss-suitor).ss-pose-kiss .ss-motion,
    .ss-anim-kiss-lean .ss-event {
      animation: none;
      transform: rotate(9deg);
    }

    .ss-squirrel.ss-pose-fly .ss-motion {
      animation: none;
      transform: rotate(-24deg);
    }

    .ss-sprite .dizzy-star {
      animation: none;
    }

    .ss-sprite .dizzy-star.dizzy-star-1 {
      transform: translate(calc(var(--ss-orbit-rx, 13px) * -1), 0);
    }

    .ss-sprite .dizzy-star.dizzy-star-2 {
      transform: translate(var(--ss-orbit-rx, 13px), 0);
    }

    .ss-sprite .dizzy-star.dizzy-star-3 {
      transform: translate(0, calc(var(--ss-orbit-ry, 4px) * -1));
    }

    .ss-squirrel .halo-glow {
      animation: none;
      opacity: 0.5;
    }

    .ss-squirrel .sheen {
      animation: none;
      opacity: 0.55;
    }

    .ss-sprite .sparkle-glow {
      animation: none;
      opacity: 0.35;
    }

    .ss-sprite .sparkle-star {
      animation: none;
      opacity: 0.9;
    }

    .ss-squirrel .smoke-wisp {
      animation: none;
      opacity: 0.6;
    }
  }
`;

/** The Chaos cast and the props: suitor, hunter, tornado, debris, eagle, beaver, effects. */
export const castAnimations = css`
  /* Suitor: fluttering lashes and a come-hither paw; a slap swing; a dismissive wave. */
  .ss-suitor.ss-pose-beckon .lashes {
    animation: ss-lash-flutter var(--ss-lash-flutter-duration, 380ms) ease-in-out infinite;
  }

  .ss-suitor.ss-pose-beckon .arm-front {
    animation: ss-beckon var(--ss-beckon-duration, 900ms) ease-in-out infinite;
  }

  .ss-suitor .heart-pulse {
    animation: ss-pulse var(--ss-heart-pulse-duration, 800ms) ease-in-out infinite;
  }

  .ss-suitor.ss-pose-slap .arm-front {
    animation: ss-slap-swing var(--ss-slap-swing-duration, 900ms)
      var(--ease-high-accel, cubic-bezier(0.3, 0, 0.08, 1)) infinite;
  }

  .ss-suitor.ss-pose-slap .swoosh {
    animation: ss-swoosh var(--ss-slap-swing-duration, 900ms) linear infinite;
  }

  .ss-suitor.ss-pose-wave-off .arm-front {
    animation: ss-wave-arm var(--ss-wave-off-duration, 500ms) ease-in-out infinite;
  }

  .ss-suitor.ss-pose-wave-off .head {
    transform: rotate(-10deg);
  }

  /* Hunter: stomping walk, twitching aim, recoil and BLAM!, flying cap, grumbling stomp. */
  .ss-hunter.ss-pose-walk .ss-motion {
    animation: ss-bob calc(var(--ss-walk-duration, 520ms) / 2) ease-in-out infinite;
  }

  .ss-hunter.ss-pose-walk .leg-front {
    animation: ss-stride var(--ss-walk-duration, 520ms) ease-in-out infinite alternate;
  }

  .ss-hunter.ss-pose-walk .leg-back {
    animation: ss-stride var(--ss-walk-duration, 520ms) ease-in-out infinite alternate-reverse;
  }

  .ss-hunter.ss-pose-aim .moustache {
    animation: ss-twitch var(--ss-twitch-duration, 1400ms) ease-in-out infinite;
  }

  .ss-hunter.ss-pose-aim .gun {
    animation: ss-jitter var(--ss-aim-tremble-duration, 220ms) linear infinite;
  }

  .ss-hunter.ss-pose-fire .gun {
    animation: ss-recoil var(--ss-recoil-duration, 900ms) ease-out infinite;
  }

  .ss-hunter .muzzle-flash {
    animation:
      ss-flash-scale var(--ss-recoil-duration, 900ms) ease-out infinite,
      ss-flash-opacity var(--ss-recoil-duration, 900ms) linear infinite;
  }

  .ss-hunter .blam {
    animation: ss-blam var(--ss-recoil-duration, 900ms)
      var(--ease-heavy-bounce, cubic-bezier(0.25, 2.25, 0.45, 1)) infinite;
  }

  .ss-hunter :is(.gun-smoke, .backfire-smoke) {
    animation:
      ss-puff-scale var(--ss-smoke-duration, 1600ms) ease-out infinite,
      ss-puff-opacity var(--ss-smoke-duration, 1600ms) linear infinite;
  }

  .ss-hunter.ss-pose-backfire .cap-flying {
    animation:
      ss-hat-fly var(--ss-hat-fly-duration, 1100ms)
        var(--ease-exit, cubic-bezier(0.71, 0.01, 1, 1)) infinite,
      ss-fade-late var(--ss-hat-fly-duration, 1100ms) linear infinite;
  }

  .ss-hunter.ss-pose-backfire .eye {
    animation: ss-blink var(--ss-dazed-blink-duration, 1200ms) linear infinite;
  }

  .ss-hunter.ss-pose-grumble .ss-motion {
    animation: ss-stomp var(--ss-stomp-duration, 450ms) ease-in-out infinite;
  }

  .ss-hunter .grumble-cloud {
    animation: ss-jitter var(--ss-jitter-duration, 140ms) linear infinite;
  }

  /* Tornado: the funnel sways while its bands twist; the race moves it with tornado-cross. */
  .ss-tornado .funnel {
    animation: ss-tornado-sway var(--ss-tornado-sway-duration, 1800ms) ease-in-out infinite;
  }

  .ss-tornado .swirl-band {
    animation: ss-swirl var(--ss-tornado-spin-duration, 700ms) ease-in-out infinite alternate;
  }

  .ss-tornado .swirl-band.band-2 {
    animation-delay: calc(var(--ss-tornado-stagger, 80ms) * -1);
  }

  .ss-tornado .swirl-band.band-3 {
    animation-delay: calc(var(--ss-tornado-stagger, 80ms) * -2);
  }

  .ss-tornado .swirl-band.band-4 {
    animation-delay: calc(var(--ss-tornado-stagger, 80ms) * -3);
  }

  .ss-tornado .swirl-band.band-5 {
    animation-delay: calc(var(--ss-tornado-stagger, 80ms) * -4);
  }

  .ss-tornado .swirl-band.band-6 {
    animation-delay: calc(var(--ss-tornado-stagger, 80ms) * -5);
  }

  .ss-tornado .swirl-band.band-7 {
    animation-delay: calc(var(--ss-tornado-stagger, 80ms) * -6);
  }

  .ss-tornado .swirl-band.band-8 {
    animation-delay: calc(var(--ss-tornado-stagger, 80ms) * -7);
  }

  .ss-tornado .swirl-band.band-9 {
    animation-delay: calc(var(--ss-tornado-stagger, 80ms) * -8);
  }

  .ss-tornado .dust {
    animation: ss-dust var(--ss-tornado-spin-duration, 700ms) ease-in-out infinite alternate;
  }

  .ss-anim-tornado-cross {
    animation: ss-tornado-cross var(--ss-tornado-cross-duration, 2500ms) linear
      var(--ss-oneshot-count, 1) both;
  }

  /* Debris orbit: set --ss-debris-rx, --ss-debris-ry and --ss-debris-delay per piece. */
  .ss-anim-debris-orbit {
    animation: ss-debris-orbit var(--ss-debris-orbit-duration, 1300ms) linear infinite;
    animation-delay: var(--ss-debris-delay, 0ms);
  }

  /* Eagle: flapping wings, a faster flap while carrying, speed lines on the dive. */
  .ss-eagle:is(.ss-pose-fly, .ss-pose-carry) :is(.wing-near, .wing-far) {
    animation: ss-flap var(--ss-wing-flap-duration, 420ms) ease-in-out infinite alternate;
  }

  .ss-eagle.ss-pose-carry :is(.wing-near, .wing-far) {
    animation-duration: calc(var(--ss-wing-flap-duration, 420ms) * 0.7);
  }

  .ss-eagle.ss-pose-carry .ss-motion {
    animation: ss-bob var(--ss-bob-duration, 1600ms) ease-in-out infinite;
  }

  .ss-eagle.ss-pose-dive .speed-lines {
    animation: ss-flicker var(--ss-speed-lines-duration, 400ms) linear infinite;
  }

  .ss-anim-eagle-dive {
    animation: ss-eagle-dive var(--ss-eagle-dive-duration, 900ms)
      var(--ease-high-accel, cubic-bezier(0.3, 0, 0.08, 1)) var(--ss-oneshot-count, 1) both;
  }

  /* Beaver: chomping head and flying chips; an idle blink and tail tap. */
  .ss-beaver.ss-pose-gnaw .head {
    animation: ss-chomp var(--ss-beaver-gnaw-duration, 220ms) ease-in-out infinite alternate;
  }

  .ss-beaver .chips {
    animation:
      ss-chips-fly var(--ss-chips-duration, 700ms) ease-out infinite,
      ss-fade-out var(--ss-chips-duration, 700ms) linear infinite;
  }

  .ss-beaver.ss-pose-idle .eye {
    animation: ss-blink var(--ss-blink-duration, 4200ms) linear infinite;
  }

  .ss-beaver.ss-pose-idle .tail {
    animation: ss-tail-tap var(--ss-tail-tap-duration, 1800ms) ease-in-out infinite;
  }

  /* Lightning: the bolt flickers; .ss-lightning-flash is a full-stage overlay. */
  .ss-lightning .bolt {
    animation: ss-bolt-flicker var(--ss-bolt-flicker-duration, 1400ms) linear infinite;
  }

  .ss-lightning-flash {
    background-color: var(--ss-lightning-colour, white);
    pointer-events: none;
    animation: ss-sky-flash var(--ss-lightning-flash-duration, 1200ms) linear
      var(--ss-oneshot-count, 1) both;
  }

  /* Effects. */
  .ss-heart .heart-body {
    animation: ss-pulse var(--ss-heart-pulse-duration, 800ms) ease-in-out infinite;
  }

  .ss-anim-heart-float {
    animation:
      ss-heart-rise var(--ss-heart-float-duration, 1400ms)
        var(--ease-enter, cubic-bezier(0.21, 0.64, 0.52, 1)) var(--ss-oneshot-count, 1) both,
      ss-heart-fade var(--ss-heart-float-duration, 1400ms) linear var(--ss-oneshot-count, 1)
        both;
  }

  .ss-anim-pop {
    animation:
      ss-pop-in var(--ss-pop-duration, var(--duration-lg, 300ms))
        var(--ease-light-bounce, cubic-bezier(0.3, 1.41, 0.4, 0.99)) var(--ss-oneshot-count, 1)
        both,
      ss-appear var(--duration-sm, 200ms) linear both;
  }

  .ss-slap-hand .slap-paw {
    animation: ss-slap-shake var(--ss-slap-shake-duration, 600ms) ease-out infinite;
  }

  .ss-slap-hand .impact {
    animation: ss-pulse var(--ss-heart-pulse-duration, 800ms) ease-in-out infinite;
  }

  .ss-stars {
    --ss-orbit-rx: 30px;
    --ss-orbit-ry: 10px;
  }

  .ss-smoke-puff .puff {
    animation:
      ss-puff-scale var(--ss-smoke-duration, 1600ms) ease-out infinite,
      ss-puff-opacity var(--ss-smoke-duration, 1600ms) linear infinite;
  }

  .ss-smoke-puff .puff.puff-2 {
    animation-delay: calc(var(--ss-smoke-duration, 1600ms) / -4);
  }

  .ss-smoke-puff .puff.puff-3 {
    animation-delay: calc(var(--ss-smoke-duration, 1600ms) / -2);
  }

  .ss-smoke-puff .puff.puff-4 {
    animation-delay: calc(var(--ss-smoke-duration, 1600ms) * -0.75);
  }

  .ss-soot-cloud .soot-body {
    animation: ss-pulse var(--ss-soot-duration, 1800ms) ease-in-out infinite;
  }

  .ss-soot-cloud .soot-spark {
    animation:
      ss-twinkle-scale var(--ss-sparkle-duration, 1500ms) ease-in-out infinite,
      ss-twinkle-opacity var(--ss-sparkle-duration, 1500ms) linear infinite;
  }

  .ss-soot-cloud .soot-spark.spark-2 {
    animation-delay: calc(var(--ss-sparkle-duration, 1500ms) / -3);
  }

  .ss-soot-cloud .soot-spark.spark-3 {
    animation-delay: calc(var(--ss-sparkle-duration, 1500ms) / -1.5);
  }

  .ss-confetti .confetti-shape {
    animation: ss-flip-x var(--ss-confetti-flutter-duration, 600ms) linear infinite;
  }

  /* Confetti fall: set --ss-confetti-drift, --ss-confetti-spin and --ss-confetti-delay. */
  .ss-anim-confetti-fall {
    animation: ss-confetti-fall var(--ss-confetti-duration, 4000ms) linear
      var(--ss-oneshot-count, 1) both;
    animation-delay: var(--ss-confetti-delay, 0ms);
  }

  /*
   * Badge colourways. A badge root sets --badge-face, --badge-edge and --badge-ink from its
   * colourway; the parts also carry the literal colours, so they draw without this sheet.
   */
  .ss-badge .badge-face {
    fill: var(--badge-face, gold);
  }

  .ss-badge .badge-edge {
    stroke: var(--badge-edge, darkgoldenrod);
  }

  .ss-badge .badge-ink {
    fill: var(--badge-ink, black);
  }

  @keyframes ss-lash-flutter {
    0%, 100% { transform: scaleY(1); }
    50% { transform: scaleY(0.45); }
  }

  @keyframes ss-beckon {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(-18deg); }
  }

  @keyframes ss-slap-swing {
    0% { transform: rotate(-70deg); }
    30%, 100% { transform: rotate(0deg); }
  }

  @keyframes ss-swoosh {
    0%, 15% { opacity: 0; }
    30% { opacity: 0.9; }
    60%, 100% { opacity: 0; }
  }

  @keyframes ss-stride {
    from { transform: rotate(-16deg); }
    to { transform: rotate(16deg); }
  }

  @keyframes ss-twitch {
    0%, 80%, 100% { transform: rotate(0deg); }
    85% { transform: rotate(-6deg); }
    90% { transform: rotate(5deg); }
  }

  @keyframes ss-recoil {
    0% { transform: translateX(0) rotate(0deg); }
    10% { transform: translateX(-4px) rotate(-8deg); }
    40%, 100% { transform: translateX(0) rotate(0deg); }
  }

  @keyframes ss-flash-scale {
    0% { transform: scale(0.3); }
    12% { transform: scale(1.15); }
    35%, 100% { transform: scale(0.9); }
  }

  @keyframes ss-flash-opacity {
    0% { opacity: 0; }
    8% { opacity: 1; }
    35%, 100% { opacity: 0; }
  }

  @keyframes ss-blam {
    0%, 5% { transform: scale(0.2) rotate(-10deg); }
    25%, 100% { transform: scale(1) rotate(-4deg); }
  }

  @keyframes ss-hat-fly {
    from { transform: translate(8px, 16px) rotate(20deg); }
    to { transform: translate(-6px, -14px) rotate(-60deg); }
  }

  @keyframes ss-stomp {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    30% { transform: translateY(-2px) rotate(-2deg); }
    60% { transform: translateY(0) rotate(2deg); }
  }

  @keyframes ss-tornado-sway {
    0%, 100% { transform: rotate(-4deg) skewX(3deg); }
    50% { transform: rotate(4deg) skewX(-3deg); }
  }

  @keyframes ss-swirl {
    from { transform: translateX(-5px); }
    to { transform: translateX(5px); }
  }

  @keyframes ss-dust {
    from { transform: scaleX(0.9); }
    to { transform: scaleX(1.12); }
  }

  @keyframes ss-tornado-cross {
    from { transform: translateX(var(--ss-tornado-start, -30vw)); }
    to { transform: translateX(var(--ss-tornado-end, 130vw)); }
  }

  @keyframes ss-debris-orbit {
    0%,
    100% {
      transform: translate(calc(var(--ss-debris-rx, 40px) * -1), 0) rotate(0deg) scale(0.85);
    }
    12.5% {
      transform: translate(
          calc(var(--ss-debris-rx, 40px) * -0.71),
          calc(var(--ss-debris-ry, 12px) * 0.71)
        )
        rotate(45deg)
        scale(1);
    }
    25% {
      transform: translate(0, var(--ss-debris-ry, 12px)) rotate(90deg) scale(1.1);
    }
    37.5% {
      transform: translate(
          calc(var(--ss-debris-rx, 40px) * 0.71),
          calc(var(--ss-debris-ry, 12px) * 0.71)
        )
        rotate(135deg)
        scale(1);
    }
    50% {
      transform: translate(var(--ss-debris-rx, 40px), 0) rotate(180deg) scale(0.85);
    }
    62.5% {
      transform: translate(
          calc(var(--ss-debris-rx, 40px) * 0.71),
          calc(var(--ss-debris-ry, 12px) * -0.71)
        )
        rotate(225deg)
        scale(0.7);
    }
    75% {
      transform: translate(0, calc(var(--ss-debris-ry, 12px) * -1)) rotate(270deg) scale(0.6);
    }
    87.5% {
      transform: translate(
          calc(var(--ss-debris-rx, 40px) * -0.71),
          calc(var(--ss-debris-ry, 12px) * -0.71)
        )
        rotate(315deg)
        scale(0.7);
    }
  }

  @keyframes ss-flap {
    from { transform: rotate(-12deg); }
    to { transform: rotate(38deg); }
  }

  @keyframes ss-eagle-dive {
    0% { transform: translate(-40px, -60px); }
    60% { transform: translate(0, 0); }
    100% { transform: translate(8px, -10px); }
  }

  @keyframes ss-chomp {
    from { transform: rotate(-3deg); }
    to { transform: rotate(5deg); }
  }

  @keyframes ss-chips-fly {
    from { transform: translate(0, 0) rotate(0deg); }
    to { transform: translate(8px, -10px) rotate(160deg); }
  }

  @keyframes ss-tail-tap {
    0%, 70%, 100% { transform: rotate(0deg); }
    80% { transform: rotate(-10deg); }
    90% { transform: rotate(0deg); }
  }

  @keyframes ss-bolt-flicker {
    0%, 100% { opacity: 1; }
    40% { opacity: 0.4; }
    50% { opacity: 1; }
    70% { opacity: 0.6; }
  }

  /* Two peaks a little over a second apart: under three flashes a second, even looping. */
  @keyframes ss-sky-flash {
    0% { opacity: 0; }
    10% { opacity: 0.85; }
    30% { opacity: 0.1; }
    45% { opacity: 0.5; }
    100% { opacity: 0; }
  }

  @keyframes ss-heart-rise {
    from { transform: translateY(0) scale(0.6); }
    to { transform: translateY(var(--ss-heart-rise, -40px)) scale(1.1); }
  }

  @keyframes ss-heart-fade {
    0% { opacity: 0; }
    20%, 70% { opacity: 1; }
    100% { opacity: 0; }
  }

  @keyframes ss-confetti-fall {
    from {
      transform: translate(0, var(--ss-confetti-start, -10vh)) rotate(0deg);
    }
    to {
      transform: translate(var(--ss-confetti-drift, 30px), var(--ss-confetti-fall, 110vh))
        rotate(var(--ss-confetti-spin, 540deg));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ss-suitor.ss-pose-beckon .lashes,
    .ss-suitor.ss-pose-beckon .arm-front,
    .ss-suitor .heart-pulse,
    .ss-suitor.ss-pose-slap .arm-front,
    .ss-suitor.ss-pose-wave-off .arm-front,
    .ss-hunter.ss-pose-walk .ss-motion,
    .ss-hunter.ss-pose-walk .leg-front,
    .ss-hunter.ss-pose-walk .leg-back,
    .ss-hunter.ss-pose-aim .moustache,
    .ss-hunter.ss-pose-aim .gun,
    .ss-hunter.ss-pose-fire .gun,
    .ss-hunter.ss-pose-backfire .eye,
    .ss-hunter.ss-pose-grumble .ss-motion,
    .ss-hunter .grumble-cloud,
    .ss-tornado .funnel,
    .ss-tornado .swirl-band,
    .ss-tornado .dust,
    .ss-anim-tornado-cross,
    .ss-anim-debris-orbit,
    .ss-eagle:is(.ss-pose-fly, .ss-pose-carry) :is(.wing-near, .wing-far),
    .ss-eagle.ss-pose-carry .ss-motion,
    .ss-anim-eagle-dive,
    .ss-beaver.ss-pose-gnaw .head,
    .ss-beaver.ss-pose-idle .eye,
    .ss-beaver.ss-pose-idle .tail,
    .ss-heart .heart-body,
    .ss-anim-pop,
    .ss-slap-hand .slap-paw,
    .ss-slap-hand .impact,
    .ss-smoke-puff .puff,
    .ss-soot-cloud .soot-body,
    .ss-confetti .confetti-shape,
    .ss-anim-confetti-fall {
      animation: none;
    }

    /* Still frames: the flash, burst, smoke and flying cap of each moment stay visible. */
    .ss-suitor.ss-pose-slap .swoosh,
    .ss-eagle.ss-pose-dive .speed-lines,
    .ss-soot-cloud .soot-spark {
      animation: none;
      opacity: 0.8;
    }

    .ss-hunter .muzzle-flash,
    .ss-hunter .blam,
    .ss-lightning .bolt,
    .ss-beaver .chips {
      animation: none;
      opacity: 1;
      transform: none;
    }

    .ss-hunter :is(.gun-smoke, .backfire-smoke) {
      animation: none;
      opacity: 0.8;
    }

    .ss-hunter.ss-pose-backfire .cap-flying {
      animation: none;
      transform: translate(-4px, -8px) rotate(-30deg);
    }

    .ss-anim-heart-float {
      animation: none;
      opacity: 1;
    }

    /* No flashing at all with motion reduced. */
    .ss-lightning-flash {
      animation: none;
      opacity: 0;
    }
  }
`;

/** The scenery: trees, the chestnut, the crowd, the skies and the photo finish. */
export const sceneryAnimations = css`
  /* Trees: a gentle sway; a tornado bends them, a beaver wobbles one. */
  .ss-tree-swaying .tree-rig {
    animation: ss-tree-sway var(--ss-tree-sway-duration, 3200ms) ease-in-out infinite;
  }

  .ss-anim-tree-bend .tree-rig {
    animation: ss-tree-bend var(--ss-tree-bend-duration, 2500ms)
      var(--ease-medium-accel, cubic-bezier(0.3, 0, 0.29, 1)) var(--ss-oneshot-count, 1) both;
  }

  .ss-anim-tree-wobble .tree-rig {
    animation: ss-tree-wobble var(--ss-tree-wobble-duration, 300ms) ease-in-out
      var(--ss-tree-wobble-count, 6) both;
  }

  /* The winner's chestnut bounces until the result view closes. */
  .ss-anim-chestnut-bounce .chestnut {
    animation: ss-chestnut-bounce var(--ss-chestnut-bounce-duration, 900ms) ease-in-out infinite;
  }

  /* Crowd: a gentle bob, a wave (stagger it with --ss-crowd-delay) and a gasp. */
  .ss-crowd.ss-pose-idle .ss-motion {
    animation: ss-bob var(--ss-crowd-bob-duration, 2200ms) ease-in-out infinite;
    animation-delay: var(--ss-crowd-delay, 0ms);
  }

  .ss-crowd.ss-pose-wave .ss-motion {
    animation: ss-hop var(--ss-crowd-wave-duration, 600ms) ease-in-out infinite;
    animation-delay: var(--ss-crowd-delay, 0ms);
  }

  .ss-crowd.ss-pose-wave .arm-left {
    animation: ss-wave-left var(--ss-crowd-wave-duration, 600ms) ease-in-out infinite;
    animation-delay: var(--ss-crowd-delay, 0ms);
  }

  .ss-crowd.ss-pose-wave .arm-right {
    animation: ss-wave-right var(--ss-crowd-wave-duration, 600ms) ease-in-out infinite;
    animation-delay: var(--ss-crowd-delay, 0ms);
  }

  .ss-crowd.ss-pose-gasp .ss-motion {
    animation: ss-gasp var(--ss-crowd-gasp-duration, 900ms)
      var(--ease-light-bounce, cubic-bezier(0.3, 1.41, 0.4, 0.99)) infinite;
  }

  /*
   * Skies: drifting clouds, a glowing sun, twinkling stars and fireflies. Rain is not part of the
   * sky: the stage draws it in HTML layers (stage-weather-layer.js, contract § 14).
   */
  .ss-sky .cloud {
    animation: ss-drift var(--ss-cloud-drift-duration, 24s) ease-in-out infinite alternate;
  }

  .ss-sky .cloud.cloud-2 {
    animation-duration: calc(var(--ss-cloud-drift-duration, 24s) * 1.4);
    animation-direction: alternate-reverse;
  }

  .ss-sky .cloud.cloud-3 {
    animation-duration: calc(var(--ss-cloud-drift-duration, 24s) * 0.8);
  }

  .ss-sky .sun-glow {
    animation: ss-glow-pulse var(--ss-sun-glow-duration, 3000ms) linear infinite;
  }

  .ss-sky .star-twinkle {
    animation: ss-twinkle-opacity var(--ss-twinkle-duration, 2000ms) linear infinite;
  }

  .ss-sky .star-twinkle.twinkle-2 {
    animation-delay: calc(var(--ss-twinkle-duration, 2000ms) / -3);
  }

  .ss-sky .star-twinkle.twinkle-3 {
    animation-delay: calc(var(--ss-twinkle-duration, 2000ms) / -1.5);
  }

  .ss-sky .firefly {
    animation:
      ss-firefly-drift var(--ss-firefly-duration, 2600ms) ease-in-out infinite alternate,
      ss-twinkle-opacity var(--ss-firefly-duration, 2600ms) linear infinite;
  }

  .ss-sky .firefly.firefly-2 {
    animation-delay: calc(var(--ss-firefly-duration, 2600ms) * -0.2);
  }

  .ss-sky .firefly.firefly-3 {
    animation-delay: calc(var(--ss-firefly-duration, 2600ms) * -0.4);
  }

  .ss-sky .firefly.firefly-4 {
    animation-delay: calc(var(--ss-firefly-duration, 2600ms) * -0.6);
  }

  .ss-sky .firefly.firefly-5 {
    animation-delay: calc(var(--ss-firefly-duration, 2600ms) * -0.8);
  }

  .ss-sky .firefly.firefly-6 {
    animation-delay: calc(var(--ss-firefly-duration, 2600ms) * -0.5);
  }

  /*
   * Sky colours. A sky root sets --sky-top-colour and --sky-bottom-colour from its preset;
   * the background bands (and the night moon's shadow) also carry the literal colours.
   */
  .ss-sky .sky-top {
    fill: var(--sky-top-colour, skyblue);
  }

  .ss-sky .sky-bottom {
    fill: var(--sky-bottom-colour, aliceblue);
  }

  /* Photo finish: a camera flash overlay and a stamp that slams down. */
  .ss-photo-flash {
    background-color: var(--ss-flash-colour, white);
    pointer-events: none;
    animation: ss-photo-flash var(--ss-photo-flash-duration, var(--duration-3xl, 500ms)) linear
      var(--ss-oneshot-count, 1) both;
  }

  .ss-photo-stamp {
    animation:
      ss-stamp var(--ss-photo-stamp-duration, var(--duration-xl, 350ms))
        var(--ease-heavy-bounce, cubic-bezier(0.25, 2.25, 0.45, 1)) var(--ss-oneshot-count, 1)
        both,
      ss-appear var(--duration-sm, 200ms) linear both;
  }

  @keyframes ss-tree-sway {
    0%, 100% { transform: rotate(-0.8deg); }
    50% { transform: rotate(0.8deg); }
  }

  @keyframes ss-tree-bend {
    0% { transform: rotate(0deg) skewX(0deg); }
    35% { transform: rotate(7deg) skewX(-3deg); }
    65% { transform: rotate(-3deg) skewX(1deg); }
    100% { transform: rotate(0deg) skewX(0deg); }
  }

  @keyframes ss-tree-wobble {
    0%, 100% { transform: rotate(-1.5deg); }
    50% { transform: rotate(1.5deg); }
  }

  @keyframes ss-chestnut-bounce {
    0%, 100% { transform: translateY(0) scale(1, 1); }
    30% { transform: translateY(-30%) scale(0.95, 1.05); }
    50% { transform: translateY(0) scale(1.08, 0.9); }
    65% { transform: translateY(-12%) scale(1, 1); }
    80% { transform: translateY(0) scale(1.03, 0.97); }
  }

  @keyframes ss-wave-left {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(-14deg); }
  }

  @keyframes ss-wave-right {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(14deg); }
  }

  @keyframes ss-gasp {
    0% { transform: translateY(0) scale(1); }
    15% { transform: translateY(-4px) scale(1.04); }
    30%, 100% { transform: translateY(-1px) scale(1.01); }
  }

  @keyframes ss-drift {
    from { transform: translateX(-6px); }
    to { transform: translateX(6px); }
  }

  @keyframes ss-firefly-drift {
    from { transform: translate(-2px, 1px); }
    to { transform: translate(2px, -2px); }
  }

  @keyframes ss-photo-flash {
    0% { opacity: 0; }
    10% { opacity: 1; }
    100% { opacity: 0; }
  }

  @keyframes ss-stamp {
    from { transform: scale(2.2) rotate(-14deg); }
    to { transform: scale(1) rotate(-8deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .ss-tree-swaying .tree-rig,
    .ss-anim-tree-bend .tree-rig,
    .ss-anim-tree-wobble .tree-rig,
    .ss-anim-chestnut-bounce .chestnut,
    .ss-crowd.ss-pose-idle .ss-motion,
    .ss-crowd.ss-pose-wave .ss-motion,
    .ss-crowd.ss-pose-wave .arm-left,
    .ss-crowd.ss-pose-wave .arm-right,
    .ss-crowd.ss-pose-gasp .ss-motion,
    .ss-sky .cloud,
    .ss-sky .sun-glow {
      animation: none;
    }

    .ss-sky .star-twinkle,
    .ss-sky .firefly {
      animation: none;
      opacity: 0.85;
    }

    /* No camera flash; the stamp lands as a still frame. */
    .ss-photo-flash {
      animation: none;
      opacity: 0;
    }

    .ss-photo-stamp {
      animation: none;
      opacity: 1;
      transform: rotate(-8deg);
    }
  }
`;

/** Everything above, for a component's static styles: `static styles = [spriteStyles, …]`. */
export const spriteStyles = [
  spriteBaseStyles,
  squirrelAnimations,
  castAnimations,
  sceneryAnimations,
  cast2Animations,
  fieldAnimations,
  boothAnimations
];
