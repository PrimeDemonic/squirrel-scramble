/**
 * The Chaos visitors on the race stage (SPEC.md § 10, Chaos v2 contract § 4): the tornado sweeping
 * across with its debris (sharks too, in a sharknado, one wearing a stolen hat), the hunter
 * stomping in with his blunderbuss (or taking on a tornado and getting the cow back), the suitor
 * on her branch, the beaver at the foot of a tree, the lightning bolt, the cat lady and the
 * gardener walking the ground, the UFO and the woodpecker. Slapstick and PG: no blood, no
 * realistic weapons. The field-wide events (gust, earthquake, flood, disco, hail, VAR) are in
 * stage-field-layer.js.
 *
 * Timing: every timed part carries data-scrub (the clock), data-scrub-start, data-scrub-duration
 * and data-scrub-kind, plus data-scrub-in and data-scrub-out (where its build-up ends and its fade
 * starts). The stage writes its transform and opacity every frame from the race clock
 * (stage-scrubs.js), the same way it moves the squirrels, so the part shows exactly the frame for
 * that moment, at any frame rate, in a replay too. Poses (aim, fire, slap) change through a
 * re-render when the scene says so. Only endless decorative loops (debris orbit, a pulsing heart,
 * wood chips) are CSS animations, and they animate transform and opacity only.
 *
 * Readability (Chaos v2 contract § 8): walkers walk at a readable pace on rows in the bottom of
 * the field, below the leaderboard; the funnel lifts off before the leaderboard's edge; the
 * beaver and the woodpecker sit on the middle-of-the-field side of their trunk, facing it, big
 * enough to see, and come and go gently.
 *
 * Class names all start with "chaos-": the sprite kit's SVGs carry plain class names inside them
 * (funnel, bolt and others), and a plain name here would style the kit's inner groups too.
 *
 * Reduced motion: no movement and no screen flash; each part shows a still frame (the funnel stands
 * mid-field, the hunter stands by the tree). The commentary line still says what happened.
 *
 * Everything here is decorative and hidden from assistive technology.
 */
import {html, css, nothing} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {repeat} from 'lit/directives/repeat.js';
import {DEFAULT_SHAPE} from './stage-scrubs.js';
import {
  drawTornado,
  drawDebris,
  drawHunter,
  drawSuitor,
  drawBeaver,
  drawBolt,
  drawHeart,
  drawSoot,
  drawShark,
  drawCatLady,
  drawGardener,
  drawUfo,
  drawWoodpecker
} from './stage-sprites.js';

// Sharks circling in a sharknado; the first is the one that chomps a hat.
const SHARK_SLOTS = Object.freeze([0, 1, 2]);
// The front walker row's stacking level inside the back layer; each row back is one lower, and
// the beaver and the woodpecker (9) stand in front of them all.
const FRONT_ROW_Z = 8;

/**
 * @description A ground walker's row, as custom properties for its style: the row, how far apart
 *   the rows sit and how much smaller each row back is (from prepareTimeline's layout), and its
 *   stacking level.
 * @param {{row?: number, rowStep?: number, rowShrink?: number}} overlay - A walker descriptor.
 * @returns {string} The declarations.
 * @since 2.1.0
 */
function rowStyle(overlay) {
  const row = overlay.row || 0;
  const step = Number.isFinite(overlay.rowStep) ? overlay.rowStep : 6;
  const shrink = Number.isFinite(overlay.rowShrink) ? overlay.rowShrink : 2.4;
  const level = Math.max(1, FRONT_ROW_Z - row);
  return `--row: ${row}; --row-step: ${step}cqh; --row-shrink: ${shrink}cqh; --row-z: ${level}`;
}

/**
 * @description Wraps content in an element the stage times through a race-time window (see
 *   stage-scrubs.js), or in a plain element when there is no window.
 * @param {string} className - The element's class.
 * @param {{startMs: number, durationMs: number, inShare?: number, outShare?: number}|null} range -
 *   The window, with where its build-up ends and its fade starts when it has them.
 * @param {string} kind - The timed motion, a stage-scrubs.js kind.
 * @param {*} inner - The content.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
function timed(className, range, kind, inner) {
  if (!range) {
    return html`<div class=${className}>${inner}</div>`;
  }
  const inShare = Number.isFinite(range.inShare) ? range.inShare : DEFAULT_SHAPE.inShare;
  const outShare = Number.isFinite(range.outShare) ? range.outShare : DEFAULT_SHAPE.outShare;
  return html`<div
    class=${className}
    data-scrub="race"
    data-scrub-kind=${kind}
    data-scrub-start=${range.startMs}
    data-scrub-duration=${range.durationMs}
    data-scrub-in=${inShare}
    data-scrub-out=${outShare}
  >${inner}</div>`;
}

/**
 * @description The sharks circling in a sharknado. One chomps a squirrel's hat off mid-flight and
 *   wears it for the rest of the storm.
 * @param {Object} overlay - The tornado overlay.
 * @param {Object[]} cast - From buildCast, for the stolen hat when the plan does not name it.
 * @returns {Array<import('lit').TemplateResult>} The sharks.
 * @since 1.0.0
 */
function renderSharks(overlay, cast) {
  const {chomp} = overlay;
  const victim = chomp && cast[chomp.victim] ? cast[chomp.victim] : null;
  const stolenHat = chomp && (chomp.hat || (victim ? victim.fullOutfit.hat : 'none'));
  return SHARK_SLOTS.map((slot) => {
    const chomper = slot === 0 && chomp;
    const pose = chomper && chomp.phase === 'chomp' ? 'chomp' : 'circle';
    const hat = chomper && chomp.phase === 'wearing' ? stolenHat : 'none';
    return html`<span class="chaos-debris chaos-shark chaos-shark-${slot}"
      >${drawShark(pose, hat)}</span
    >`;
  });
}

/**
 * @description The tornado: darkening sky, then the funnel sweeping across with a leaf, a garden
 *   gnome and a startled cow spinning in it (and sharks in a sharknado, and a swept-up suitor),
 *   then lifting off where it stands, short of the leaderboard. The funnel follows FUNNEL's path
 *   (stage-scrubs.js), the same path the lifted squirrels follow, so they stay inside it.
 * @param {Object} overlay - From overlaysAt.
 * @param {Object[]} cast - From buildCast.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
function renderTornado(overlay, cast) {
  const passenger = overlay.passenger === 'suitor'
    ? html`<span class="chaos-debris chaos-debris-suitor">${drawSuitor('kiss')}</span>`
    : nothing;
  return html`<div class="chaos-overlay chaos-tornado">
    ${timed('chaos-dim', overlay.dim, 'storm-dim', nothing)}
    ${timed('chaos-funnel', overlay.sweep, 'funnel-sweep',
      timed('chaos-funnel-lift', overlay.lift, 'funnel-lift', html`
        <span class="chaos-funnel-art">${drawTornado()}</span>
        <span class="chaos-debris chaos-debris-leaf">${drawDebris('leaf')}</span>
        <span class="chaos-debris chaos-debris-gnome">${drawDebris('gnome')}</span>
        <span class="chaos-debris chaos-debris-cow">${drawDebris('cow')}</span>
        ${overlay.sharks ? renderSharks(overlay, cast) : nothing}
        ${passenger}
      `))}
  </div>`;
}

/**
 * @description The hunter: walks in from the nearer edge at a readable pace to stand beside his
 *   squirrel's tree, squints, BLAM, then walks back out (a hit) or grumbles with a sooty face
 *   first (a miss). Against a tornado (hunterVsTornado) he fires from near the right edge, the
 *   cow comes flying back and he ends up flat on his back. At a disco he dances. The sprite draws
 *   the BLAM burst and the backfire smoke itself; the stage adds a soot cloud on a backfire.
 * @param {Object} overlay - From overlaysAt (stand and enterFrom in hundredths of the field).
 * @param {{getMessage: Function}} i18n - The AIUX i18n service.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
function renderHunter(overlay, i18n) {
  const classes = {
    'chaos-overlay': true,
    'chaos-hunter': true,
    [`chaos-side-${overlay.side}`]: true,
    [`chaos-row-${overlay.row || 0}`]: true,
    'is-floored': overlay.floored === true,
    'is-dancing': overlay.dancing === true,
    'is-leaving': overlay.leaving === true
  };
  const sooty = overlay.pose === 'backfire' || overlay.pose === 'grumble';
  const soot = sooty ? html`<span class="chaos-hunter-soot">${drawSoot()}</span>` : nothing;
  const cow = overlay.cow
    ? timed('chaos-hunter-cow', overlay.cow, 'cow-spit', drawDebris('cow'))
    : nothing;
  const sprite = drawHunter(overlay.pose, i18n.getMessage('BLAM!'));
  const figure = html`
    <span class="chaos-hunter-figure"><span class="chaos-groove">${sprite}</span></span>
    ${soot}
    ${cow}
  `;
  // A floored hunter fades away where he lies; the others walk off the way they came.
  const leaveKind = overlay.side === 'vs' ? 'fade-out' : 'hunter-leave';
  return html`<div
    class=${classMap(classes)}
    style="--stand: ${overlay.stand}; --enter-cqw: ${overlay.enterFrom}; ${rowStyle(overlay)}"
  >
    ${timed('chaos-hunter-enter', overlay.enter, 'hunter-enter',
      timed('chaos-hunter-leave', overlay.leave, leaveKind, figure))}
  </div>`;
}

/**
 * @description A ground walker crossing the field on its row: the cat lady or the gardener.
 * @param {Object} overlay - From overlaysAt (row, direction, walk, pose).
 * @param {string} name - 'cat-lady' or 'gardener'.
 * @param {*} figure - The walker's sprite.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
function renderWalker(overlay, name, figure) {
  const rightToLeft = overlay.direction === 'rtl';
  const classes = {
    'chaos-overlay': true,
    'chaos-walker': true,
    [`chaos-${name}`]: true,
    [`chaos-row-${overlay.row || 0}`]: true,
    'is-rtl': rightToLeft
  };
  const kind = rightToLeft ? 'walk-across-rtl' : 'walk-across';
  return html`<div class=${classMap(classes)} style=${rowStyle(overlay)}>
    ${timed('chaos-walker-path', overlay.walk, kind, html`
      <span class="chaos-walker-figure">${figure}</span>
    `)}
  </div>`;
}

/**
 * @description The UFO hovering over its two squirrels, its beam reaching down to them while they
 *   ride it.
 * @param {Object} overlay - From overlaysAt.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
function renderUfo(overlay) {
  const beam = overlay.beam ? html`<span class="chaos-ufo-beam"></span>` : nothing;
  return html`<div
    class="chaos-overlay chaos-ufo"
    style="--mid: ${overlay.middle}; --h: ${overlay.height}"
  >
    ${timed('chaos-ufo-hover', overlay.hover, 'ufo-hover', html`
      ${beam}
      <span class="chaos-ufo-saucer">${drawUfo(overlay.beam)}</span>
    `)}
  </div>`;
}

/**
 * @description The woodpecker on the trunk just under (or over) its squirrel, facing the bark
 *   from the middle-of-the-field side, flying in and out with its visit.
 * @param {Object} overlay - From overlaysAt.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
function renderWoodpecker(overlay) {
  const classes = {
    'chaos-overlay': true,
    'chaos-woodpecker': true,
    [`chaos-trunk-side-${overlay.side}`]: true,
    [`is-perch-${overlay.perch}`]: true
  };
  return html`<div
    class=${classMap(classes)}
    style="--lane: ${overlay.lane - 1}; --h: ${overlay.height}"
  >
    ${timed('chaos-trunk-visit', overlay.visit, 'trunk-visit', html`
      <div class="chaos-trunk-facing">
        <span class="chaos-woodpecker-figure">${drawWoodpecker(overlay.pose)}</span>
      </div>
    `)}
  </div>`;
}

/**
 * @description The suitor on a branch beside the squirrel, with a pulsing heart while she
 *   beckons.
 * @param {Object} overlay - From overlaysAt.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
function renderSuitor(overlay) {
  const classes = {
    'chaos-overlay': true,
    'chaos-suitor': true,
    [`chaos-side-${overlay.side}`]: true
  };
  const heart = overlay.hearts
    ? html`<span class="chaos-suitor-heart">${drawHeart()}</span>`
    : nothing;
  const figure = html`
    <span class="chaos-suitor-branch"></span>
    <span class="chaos-suitor-figure">${drawSuitor(overlay.pose)}</span>
    ${heart}
  `;
  return html`<div
    class=${classMap(classes)}
    style="--lane: ${overlay.lane - 1}; --h: ${overlay.height}"
  >
    ${timed('chaos-suitor-appear', overlay.appear, 'appear',
      timed('chaos-suitor-leave', overlay.leave, 'fade-out', figure))}
  </div>`;
}

/**
 * @description The beaver at the foot of the squirrel's tree, facing the trunk from the
 *   middle-of-the-field side with its teeth on the bark: it chomps (the kit's chomping head, wood
 *   chips spraying, a pale bite growing in the bark) and comes and goes with its visit. At a
 *   disco it does the robot instead.
 * @param {Object} overlay - From overlaysAt.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
function renderBeaver(overlay) {
  const gnawing = overlay.pose === 'gnaw';
  const classes = {
    'chaos-overlay': true,
    'chaos-beaver': true,
    [`chaos-trunk-side-${overlay.side}`]: true,
    'is-robot': overlay.robot === true,
    'is-gnawing': gnawing
  };
  const chips = gnawing
    ? html`<span class="chaos-beaver-chips"></span
      ><span class="chaos-beaver-chips chaos-beaver-chips-late"></span>`
    : nothing;
  return html`<div class=${classMap(classes)} style="--lane: ${overlay.lane - 1}">
    ${timed('chaos-trunk-visit', overlay.visit, 'trunk-visit', html`
      <div class="chaos-trunk-facing">
        ${timed('chaos-beaver-bite', overlay.bite, 'grow', nothing)}
        <span class="chaos-beaver-figure">${drawBeaver(overlay.pose)}</span>
        ${chips}
      </div>
    `)}
  </div>`;
}

/**
 * @description The lightning strike: a bolt from the sky to the squirrel.
 * @param {Object} overlay - From overlaysAt.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
function renderLightning(overlay) {
  return html`<div
    class="chaos-overlay chaos-lightning"
    style="--lane: ${overlay.lane - 1}; --h: ${overlay.height}"
  >
    ${overlay.bolt ? timed('chaos-bolt', overlay.bolt, 'bolt', drawBolt()) : nothing}
  </div>`;
}

/**
 * @description The white flash across the stage that comes with a lightning strike (never drawn
 *   with reduced motion).
 * @param {Object} overlay - A lightning overlay.
 * @returns {import('lit').TemplateResult|typeof nothing} The template.
 * @since 1.0.0
 */
function renderSkyFlash(overlay) {
  return overlay.flash ? timed('chaos-sky-flash', overlay.flash, 'sky-flash', nothing) : nothing;
}

/**
 * @description One layer of Chaos visitors: the back layer (behind the squirrels) or the front
 *   layer (in front of them). Each overlay says its layer (stage-overlays.js); the field-wide
 *   layers are drawn by stage-field-layer.js.
 * @param {Object[]} overlays - From sceneAt.
 * @param {string} layer - 'back' or 'front'.
 * @param {{i18n: {getMessage: Function}, cast?: Object[]}|{getMessage: Function}} context - The
 *   AIUX i18n service and the cast (or the i18n service alone).
 * @returns {import('lit').TemplateResult} The template.
 * @example
 *   renderOverlays(scene.overlays, 'back', {i18n, cast});
 * @since 1.0.0
 */
export function renderOverlays(overlays, layer, context) {
  const plainService = context && typeof context.getMessage === 'function';
  const i18n = plainService ? context : context.i18n;
  const cast = plainService ? [] : context.cast || [];
  const renderers = {
    tornado: (overlay) => renderTornado(overlay, cast),
    hunter: (overlay) => renderHunter(overlay, i18n),
    suitor: (overlay) => renderSuitor(overlay),
    beaver: (overlay) => renderBeaver(overlay),
    lightning: (overlay) => renderLightning(overlay),
    catLady: (overlay) => renderWalker(overlay, 'cat-lady', drawCatLady(overlay.pose)),
    gardener: (overlay) => renderWalker(overlay, 'gardener', drawGardener(overlay.pose)),
    ufo: (overlay) => renderUfo(overlay),
    woodpecker: (overlay) => renderWoodpecker(overlay)
  };
  const drawn = overlays.filter((overlay) => (
    overlay.layer === layer && Object.prototype.hasOwnProperty.call(renderers, overlay.type)
  ));
  const flashes = layer === 'front'
    ? overlays.filter((overlay) => overlay.type === 'lightning' && overlay.flash)
    : [];
  return html`<div class="chaos-overlays chaos-overlays-${layer}" aria-hidden="true">
    ${repeat(drawn, (overlay) => overlay.key, (overlay) => renderers[overlay.type](overlay))}
    ${repeat(flashes, (overlay) => `${overlay.key}-flash`, (overlay) => renderSkyFlash(overlay))}
  </div>`;
}

/** The Chaos overlays' styles. Base values are each part's still frame (reduced motion). */
export const chaosStyles = css`
  .chaos-overlays {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  /* Field layers (see stage-lanes.js): trees 1 (then the field-wide washes at the same level,
     stage-field-layer.js), these back overlays 2 (in front of the trees and washes, behind the
     squirrels, so lifted squirrels spin inside the funnel), squirrels 3, these front overlays 4
     (the suitor beside her squirrel, the sky flash). */
  .chaos-overlays-back {
    z-index: 2;
  }

  .chaos-overlays-front {
    z-index: 4;
  }

  .chaos-overlay {
    position: absolute;
  }

  .chaos-overlay svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .chaos-tornado {
    inset: 0;
    /* The funnel sprite is 100 by 150: as tall as the field, two thirds as wide. */
    --funnel-w: min(66cqh, 45cqw);
  }

  .chaos-dim {
    position: absolute;
    inset: -100vmax;
    background-color: var(--ss-storm-dim);
    opacity: 0.3;
  }

  /* The funnel is one of the few large movers: its own compositor layer. */
  .chaos-funnel {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: var(--funnel-w);
    transform: translateX(calc(50cqw - var(--funnel-w) / 2));
    opacity: 0.9;
    will-change: transform;
  }

  .chaos-funnel-lift {
    position: absolute;
    inset: 0;
    transform-origin: 50% 100%;
  }

  .chaos-funnel-art {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    font-size: min(30cqh, 12cqw);
  }

  .chaos-debris {
    position: absolute;
    left: 40%;
    width: 18%;
    height: 12%;
    font-size: min(5cqh, 3cqw);
    animation: stage-debris-orbit 900ms linear infinite;
  }

  .chaos-debris-leaf {
    top: 20%;
  }

  .chaos-debris-gnome {
    top: 45%;
    animation-duration: 1200ms;
    animation-direction: reverse;
  }

  .chaos-debris-cow {
    top: 62%;
    width: 26%;
    height: 16%;
    animation-duration: 1500ms;
  }

  .chaos-shark {
    width: 26%;
    height: 14%;
    animation-duration: 1100ms;
  }

  .chaos-shark-0 {
    top: 30%;
  }

  .chaos-shark-1 {
    top: 52%;
    animation-duration: 1300ms;
    animation-direction: reverse;
  }

  .chaos-shark-2 {
    top: 74%;
    animation-duration: 1700ms;
  }

  .chaos-debris-suitor {
    top: 38%;
    width: 22%;
    height: 16%;
    animation-duration: 1000ms;
  }

  /* Ground walkers on rows (--row, --row-step, --row-shrink and --row-z from rowStyle): row 0 on
     the ground line in front, each later row a little higher up, smaller and behind, so two
     walkers on stage at once never walk through each other. Every row's feet are at most 30% of
     the field up, so walkers stay in the bottom 45% of the field, below the leaderboard (at most
     55% of the field's height, stage-hud.js): a walker leaving on the right passes under it,
     never behind it. The beaver and the woodpecker stand in front of every row. */
  .chaos-walker,
  .chaos-hunter {
    bottom: calc(var(--row, 0) * var(--row-step, 6cqh));
    z-index: var(--row-z, 8);
  }

  /* He stands at --stand hundredths of the field and walks in from --enter-cqw away. */
  .chaos-hunter {
    --hunter-h: clamp(40px, calc(24cqh - var(--row, 0) * var(--row-shrink, 2.4cqh)), 160px);
    --hunter-w: calc(var(--hunter-h) * 0.75);
    --enter-from: calc(var(--enter-cqw, 0) * 1cqw);
    left: 0;
    width: var(--hunter-w);
    height: var(--hunter-h);
    transform: translateX(calc(var(--stand, 50) * 1cqw - var(--hunter-w) / 2));
  }

  .chaos-hunter-enter,
  .chaos-hunter-leave {
    position: absolute;
    inset: 0;
  }

  .chaos-hunter-figure {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    font-size: calc(var(--hunter-h) * 0.6);
  }

  /* He faces his squirrel's tree (against a tornado, the funnel coming from the left), and turns
     round to walk back out. */
  .chaos-side-right .chaos-hunter-figure,
  .chaos-side-vs .chaos-hunter-figure,
  .chaos-side-left.is-leaving .chaos-hunter-figure {
    transform: scaleX(-1);
  }

  .chaos-side-right.is-leaving .chaos-hunter-figure {
    transform: none;
  }

  .chaos-groove {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: flex-end;
    justify-content: center;
    transform-origin: 50% 100%;
  }

  .chaos-hunter.is-floored .chaos-groove {
    transform: rotate(-80deg) translate(-20%, 10%);
  }

  .chaos-hunter.is-dancing .chaos-groove {
    animation: stage-groove 320ms ease-in-out infinite alternate;
  }

  .chaos-hunter-cow {
    position: absolute;
    left: 10%;
    top: -30%;
    width: 60%;
    height: 45%;
    font-size: calc(var(--hunter-h) * 0.3);
  }

  .chaos-walker {
    --walker-h: clamp(36px, calc(24cqh - var(--row, 0) * var(--row-shrink, 2.4cqh)), 150px);
    --walker-w: calc(var(--walker-h) * 0.8);
    left: 0;
    width: var(--walker-w);
    height: var(--walker-h);
  }

  /* Still frame (reduced motion): standing a third of the way along her walk. A crossing walker
     is a large mover: its own compositor layer. */
  .chaos-walker-path {
    position: absolute;
    inset: 0;
    transform: translate(calc(30cqw - var(--walker-w) / 2), 0);
    will-change: transform;
  }

  .chaos-walker.is-rtl .chaos-walker-path {
    transform: translate(calc(70cqw - var(--walker-w) / 2), 0);
  }

  .chaos-walker-figure {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    font-size: calc(var(--walker-h) * 0.6);
  }

  .chaos-walker.is-rtl .chaos-walker-figure {
    transform: scaleX(-1);
  }

  .chaos-ufo {
    --ufo-w: clamp(56px, calc(var(--lane-w) * 1.6), 220px);
    top: max(0px, calc(var(--climb-top) - var(--ufo-w) * 0.35));
    left: calc(var(--lane-w) * (var(--mid) + 0.5) - var(--ufo-w) / 2);
    width: var(--ufo-w);
    height: calc(var(--ufo-w) * 0.6);
  }

  .chaos-ufo-hover,
  .chaos-ufo-saucer {
    position: absolute;
    inset: 0;
  }

  .chaos-ufo-saucer {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: calc(var(--ufo-w) * 0.5);
  }

  /* The beam reaches down to the lower of its two squirrels. */
  .chaos-ufo-beam {
    position: absolute;
    top: 70%;
    left: 20%;
    width: 60%;
    height: calc((1 - var(--h) / 100) * var(--climb-span) + var(--sprite) * 1.2);
    clip-path: polygon(35% 0, 65% 0, 100% 100%, 0 100%);
    background: linear-gradient(var(--ss-beam), transparent);
    opacity: 0.55;
  }

  /* Trunk visitors: a visit wrapper that slides and fades them in and out (from --from-side), and
     a facing wrapper that mirrors them on the right of their trunk. */
  .chaos-trunk-visit,
  .chaos-trunk-facing {
    position: absolute;
    inset: 0;
  }

  .chaos-trunk-side-left {
    --from-side: -1;
  }

  .chaos-trunk-side-right {
    --from-side: 1;
  }

  .chaos-trunk-side-right .chaos-trunk-facing {
    transform: scaleX(-1);
  }

  /* The woodpecker clings to the bark just under its squirrel's bib (over its head near the
     ground). The sprite's beak is 80% across its box: that point touches the trunk. */
  .chaos-woodpecker {
    --peck-w: max(var(--sprite), 30px);
    --perch-y: calc(var(--climb-top) + (1 - var(--h) / 100) * var(--climb-span));
    z-index: 9;
    width: var(--peck-w);
    height: var(--peck-w);
  }

  .chaos-woodpecker.is-perch-below {
    top: calc(var(--perch-y) + var(--sprite) + var(--bib-h));
  }

  .chaos-woodpecker.is-perch-above {
    top: calc(var(--perch-y) - var(--peck-w) * 0.95);
  }

  .chaos-woodpecker.chaos-trunk-side-left {
    left: calc(
      var(--lane-w) * (var(--lane) + 0.5) - var(--tree-w) * 0.12 - var(--peck-w) * 0.8
    );
  }

  .chaos-woodpecker.chaos-trunk-side-right {
    left: calc(
      var(--lane-w) * (var(--lane) + 0.5) + var(--tree-w) * 0.12 - var(--peck-w) * 0.2
    );
  }

  .chaos-woodpecker-figure {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: calc(var(--peck-w) * 0.8);
  }

  .chaos-hunter-soot {
    position: absolute;
    left: 15%;
    top: -12%;
    width: 70%;
    height: 45%;
    font-size: calc(var(--hunter-h) * 0.25);
    animation: stage-soot 900ms ease-out both;
  }

  .chaos-suitor {
    --suitor-w: max(calc(var(--sprite) * 1.05), 26px);
    top: calc(var(--climb-top) + (1 - var(--h) / 100) * var(--climb-span));
    width: var(--suitor-w);
    height: var(--suitor-w);
  }

  .chaos-suitor.chaos-side-right {
    left: calc(var(--lane-w) * (var(--lane) + 0.5) + var(--sprite) * 0.35);
  }

  .chaos-suitor.chaos-side-left {
    left: calc(var(--lane-w) * (var(--lane) + 0.5) - var(--sprite) * 0.35 - var(--suitor-w));
  }

  .chaos-suitor-appear,
  .chaos-suitor-leave {
    position: absolute;
    inset: 0;
  }

  .chaos-suitor-branch {
    position: absolute;
    left: -20%;
    right: -20%;
    bottom: -4%;
    height: max(3px, 8%);
    border-radius: 3px;
    background-color: var(--ss-bark);
  }

  .chaos-suitor-figure {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    font-size: calc(var(--suitor-w) * 0.8);
  }

  .chaos-side-right .chaos-suitor-figure {
    transform: scaleX(-1);
  }

  .chaos-suitor-heart {
    position: absolute;
    left: 30%;
    top: -45%;
    width: 40%;
    height: 40%;
    font-size: calc(var(--suitor-w) * 0.3);
    animation: stage-heart-pulse 500ms ease-in-out infinite alternate;
  }

  /* The beaver: half as big again as a squirrel, standing on the ground line at the foot of the
     tree, on the middle-of-the-field side, its teeth (78% across its box, just over half-way
     down) on the bark. */
  .chaos-beaver {
    --beaver-w: max(calc(var(--sprite) * 1.5), 44px);
    z-index: 9;
    bottom: calc(var(--beaver-w) * -0.08);
    width: var(--beaver-w);
    height: var(--beaver-w);
  }

  .chaos-beaver.chaos-trunk-side-left {
    left: calc(
      var(--lane-w) * (var(--lane) + 0.5) - var(--tree-w) * 0.16 - var(--beaver-w) * 0.8
    );
  }

  .chaos-beaver.chaos-trunk-side-right {
    left: calc(
      var(--lane-w) * (var(--lane) + 0.5) + var(--tree-w) * 0.16 - var(--beaver-w) * 0.2
    );
  }

  .chaos-beaver-figure {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    font-size: calc(var(--beaver-w) * 0.7);
    transform-origin: 50% 100%;
  }

  .chaos-beaver.is-robot .chaos-beaver-figure {
    animation: stage-robot 480ms steps(2, end) infinite;
  }

  /* Gnawing: the whole beaver nods into the trunk (the kit's head chomps on top of that). */
  .chaos-beaver.is-gnawing .chaos-beaver-figure {
    animation: stage-gnaw 200ms ease-in-out infinite alternate;
  }

  /* The pale bite growing in the bark beside its teeth (the still frame is the full bite). */
  .chaos-beaver-bite {
    position: absolute;
    left: 79%;
    top: 46%;
    width: 11%;
    height: 17%;
    background-color: var(--ss-bark-light);
    clip-path: polygon(0 0, 100% 50%, 0 100%);
    transform-origin: 0 50%;
  }

  /* Wood chips spraying back from its teeth. */
  .chaos-beaver-chips {
    position: absolute;
    left: 64%;
    top: 38%;
    width: 30%;
    height: 30%;
    background: radial-gradient(var(--ss-bark-light) 2px, transparent 3px) 0 0 / 7px 7px;
    animation: stage-chips 320ms linear infinite;
  }

  .chaos-beaver-chips-late {
    top: 50%;
    animation-duration: 380ms;
    animation-delay: -170ms;
  }

  .chaos-lightning {
    --bolt-w: max(calc(var(--lane-w) * 0.6), 18px);
    top: -6cqh;
    left: calc(var(--lane-w) * (var(--lane) + 0.5) - var(--bolt-w) / 2);
    width: var(--bolt-w);
    height: calc(
      6cqh + var(--climb-top) + (1 - var(--h) / 100) * var(--climb-span) + var(--sprite) * 0.4
    );
  }

  .chaos-bolt {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    font-size: calc(var(--bolt-w) * 0.9);
    filter: drop-shadow(0 0 6px var(--ss-bolt-glow));
  }

  .chaos-sky-flash {
    position: absolute;
    inset: -100vmax;
    background-color: var(--ss-flash);
    opacity: 0;
  }

  @keyframes stage-debris-orbit {
    from {
      transform: rotate(0deg) translateX(140%) rotate(0deg);
    }
    to {
      transform: rotate(360deg) translateX(140%) rotate(-720deg);
    }
  }

  @keyframes stage-soot {
    from {
      transform: scale(0.4);
      opacity: 1;
    }
    to {
      transform: translateY(-60%) scale(1.5);
      opacity: 0;
    }
  }

  @keyframes stage-heart-pulse {
    from {
      transform: scale(0.85);
    }
    to {
      transform: scale(1.15);
    }
  }

  @keyframes stage-chips {
    from {
      transform: translate(0, 0);
      opacity: 1;
    }
    to {
      transform: translate(-60%, -60%);
      opacity: 0;
    }
  }

  @keyframes stage-groove {
    from {
      transform: rotate(-8deg) translateY(0);
    }
    to {
      transform: rotate(8deg) translateY(-6%);
    }
  }

  @keyframes stage-robot {
    from {
      transform: rotate(-10deg);
    }
    to {
      transform: rotate(10deg);
    }
  }

  @keyframes stage-gnaw {
    from {
      transform: rotate(-2deg);
    }
    to {
      transform: rotate(6deg) translateX(3%);
    }
  }
`;
