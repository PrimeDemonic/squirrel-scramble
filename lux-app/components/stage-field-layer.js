/**
 * The field-wide Chaos v2 events on the race stage (Chaos v2 contract § 4, § 6 and § 8), each on
 * a deliberate full-field layer:
 * - wash (z 1, drawn right after the trees, behind every visitor and squirrel): the disco's
 *   purple light and its robot-beaver cameo, the flood water and its rubber duck, the
 *   earthquake's crack and mole, and the VAR veil. A field-wide wash never covers a squirrel, so
 *   nobody looks faded;
 * - fx (z 5, in front of the squirrels): light accents only, at low opacity: the disco beams
 *   and mirror ball, the leaf gust (leaves, then a pigeon, then the gardener's toupee) and the
 *   acorn hail;
 * - var (z 7, above everything but the photo-finish stamp): the VAR review, drawn while everyone
 *   is stalled in the plan, with the clock still running.
 * The earthquake's screen shake is on the field itself (the element's field shaker), and the
 * squirrels' own reactions (flapping, bouncing, dancing, chubby cheeks) are in stage-looks.js.
 *
 * Timing works as in stage-chaos-layer.js: each timed part carries data-scrub, data-scrub-kind,
 * data-scrub-start, data-scrub-duration, data-scrub-in and data-scrub-out, and the stage writes
 * its transform and opacity from the race clock every frame (stage-scrubs.js). Every event builds
 * over a lead-in and fades over a tail, and holds its full effect for the whole plan window.
 *
 * Smooth motion (contract § 8): only transform and opacity move; the few large movers (the
 * water, the washes, the disco beams) have will-change; the kit's water, crack and VAR lines are
 * stretched to their boxes, so their own loops are switched off here and the stage moves the
 * whole box instead. The only endless loops left (beams sweeping, leaves streaming, hail
 * falling, the robot) are transform animations on small HTML boxes.
 *
 * Class names all start with "field-", so they never style the sprite kit's inner groups (the
 * few rules here that switch off a kit loop name the kit's class on purpose).
 * Reduced motion: still frames (the water at its line, the ball hung, the nuts scattered), fades
 * stay as fades, and the commentary says what happened. Everything here is decorative and
 * hidden from assistive technology.
 */
import {html, css, nothing} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {repeat} from 'lit/directives/repeat.js';
import {DEFAULT_SHAPE} from './stage-scrubs.js';
import {
  drawLeafGust,
  drawPigeon,
  drawCrack,
  drawMole,
  drawFloodWater,
  drawRubberDuck,
  drawMirrorBall,
  drawBeaver,
  drawHailNut,
  drawOwlReferee,
  drawVarLines,
  hasSprite
} from './stage-sprites.js';

/**
 * @description Wraps content in an element the stage times through a race-time window.
 * @param {string} className - The element's classes.
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
 * @description The disco's floor, behind the squirrels: the purple wash, and a beaver doing the
 *   robot when no beaver is at a tree (otherwise that one does it, see stage-chaos-layer.js).
 *   Both build up before the dancing starts and fade after it.
 * @param {Object} overlay - From overlaysAt (type discoWash).
 * @returns {import('lit').TemplateResult} The template.
 * @since 2.1.0
 */
function renderDiscoWash(overlay) {
  const cameo = overlay.cameo
    ? html`<span class="field-disco-beaver">
      <span class="field-disco-robot">${drawBeaver('idle')}</span>
    </span>`
    : nothing;
  return html`<div class="field-overlay field-disco-floor">
    ${timed('field-disco-wash', overlay.range, 'envelope', cameo)}
  </div>`;
}

/**
 * @description The disco's light accents, in front of the squirrels at low opacity: three beams
 *   sweeping from the mirror ball, and the ball itself, dropped in on its string before the
 *   dancing starts.
 * @param {Object} overlay - From overlaysAt (type disco).
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
function renderDisco(overlay) {
  const classes = {
    'field-overlay': true,
    'field-disco': true,
    [`field-ball-${overlay.side}`]: true
  };
  return html`<div class=${classMap(classes)}>
    ${timed('field-disco-beams', overlay.range, 'envelope', html`
      <span class="field-disco-beam field-disco-beam-1"></span>
      <span class="field-disco-beam field-disco-beam-2"></span>
      <span class="field-disco-beam field-disco-beam-3"></span>
    `)}
    ${timed('field-disco-ball', overlay.range, 'envelope',
      timed('field-disco-drop', overlay.ball, 'drop-in', html`
        <span class="field-disco-string"></span>
        <span class="field-disco-ball-art">${drawMirrorBall()}</span>
      `))}
  </div>`;
}

/**
 * @description The leaf gust blowing across the whole field: streaming leaves, then a startled
 *   pigeon, then the gardener's toupee, all building up with the blower and fading after it.
 * @param {Object} overlay - From overlaysAt.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
function renderGust(overlay) {
  const rightToLeft = overlay.direction === 'rtl';
  const fly = rightToLeft ? 'fly-across-rtl' : 'fly-across';
  const classes = {'field-overlay': true, 'field-gust': true, 'is-rtl': rightToLeft};
  const toupee = overlay.toupee
    ? timed('field-gust-item field-toupee', overlay.toupee, fly, html`
      <span class="field-toupee-art"></span>
    `)
    : nothing;
  return html`<div class=${classMap(classes)}>
    ${timed('field-gust-band', overlay.range, 'envelope', html`
      <span class="field-gust-leaves field-gust-leaves-1">${drawLeafGust()}</span>
      <span class="field-gust-leaves field-gust-leaves-2">${drawLeafGust()}</span>
      <span class="field-gust-leaves field-gust-leaves-3">${drawLeafGust()}</span>
    `)}
    ${timed('field-gust-item field-pigeon', overlay.pigeon, fly, drawPigeon())}
    ${toupee}
  </div>`;
}

/**
 * @description The earthquake's ground, behind the squirrels: a crack opening along the foot of
 *   the trees as the shaking builds, and a mole popping out of it and sinking back.
 * @param {Object} overlay - From overlaysAt.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
function renderEarthquake(overlay) {
  return html`<div class="field-overlay field-quake">
    ${timed('field-quake-ground', overlay.ground, 'envelope', html`
      ${timed('field-crack', overlay.crack, 'grow-x', html`
        <span class="field-crack-line"></span>
        <span class="field-crack-art">${drawCrack()}</span>
      `)}
      <span class="field-mole" style="--across: ${overlay.mole.across}">
        ${timed('field-mole-pop', overlay.mole, 'mole-visit', drawMole())}
      </span>
    `)}
  </div>`;
}

/**
 * @description The flood, behind the squirrels: water rising from below the field to the
 *   waterline, holding, and draining away, with the lone rubber duck floating across on it.
 * @param {Object} overlay - From overlaysAt.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
function renderFlood(overlay) {
  // The kit's water fills a box spanning the climb up to the plan's level; without it the stage
  // paints a plain body of water from the waterline down.
  const body = hasSprite('floodWaterSprite')
    ? html`<span class="field-water-climb">${drawFloodWater(overlay.units)}</span>`
    : html`<span class="field-water-body"></span>`;
  return html`<div class="field-overlay field-flood" style="--units: ${overlay.units}">
    ${timed('field-water', overlay.range, 'flood-rise', html`
      ${body}
      <span class="field-water-base"></span>
      ${timed('field-duck', overlay.duck, 'duck-float', drawRubberDuck())}
    `)}
  </div>`;
}

/**
 * @description The acorn hail: nuts pelting down all over the field.
 * @param {Object} overlay - From overlaysAt.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
function renderHail(overlay) {
  return html`<div class="field-overlay field-hail">
    ${timed('field-hail-band', overlay.range, 'envelope', overlay.nuts.map((nut) => html`<span
      class="field-hail-nut"
      style="--across: ${nut.across}; --down: ${nut.down};
        --delay: ${nut.delay}ms; --size: ${nut.size}"
      >${drawHailNut()}</span
    >`))}
  </div>`;
}

/**
 * @description The VAR veil, behind the squirrels: the frozen field dims around them while the
 *   review runs, so they stand out instead of fading.
 * @param {Object} overlay - From overlaysAt (type varVeil).
 * @returns {import('lit').TemplateResult} The template.
 * @since 2.1.0
 */
function renderVarVeil(overlay) {
  return html`<div class="field-overlay field-var-under">
    ${timed('field-var-veil', overlay.range, 'envelope', nothing)}
  </div>`;
}

/**
 * @description The VAR review: the lines drawn across the frozen race, the owl referee
 *   (whistle, its tiny monitor, the card) and the banner: "checking", then the verdict.
 * @param {Object} overlay - From overlaysAt.
 * @param {{getMessage: Function}} i18n - The AIUX i18n service.
 * @param {Object<string, string>} verdicts - Translated verdicts by phrase key.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
function renderVar(overlay, i18n, verdicts) {
  const known = Object.prototype.hasOwnProperty.call(verdicts, overlay.verdict);
  const verdict = known ? verdicts[overlay.verdict] : i18n.getMessage('Decision: play on!');
  const banner = overlay.stage === 'checking'
    ? i18n.getMessage('CHECKING POSSIBLE NUT INFRINGEMENT…')
    : verdict;
  const classes = {'field-overlay': true, 'field-var': true, [`is-${overlay.stage}`]: true};
  return html`<div class=${classMap(classes)}>
    ${timed('field-var-review', overlay.range, 'envelope', html`
      ${timed('field-var-lines', overlay.lines, 'lines-sweep', html`
        <span class="field-var-line field-var-line-1"></span>
        <span class="field-var-line field-var-line-2"></span>
        <span class="field-var-lines-art">${drawVarLines()}</span>
      `)}
      <div class="field-var-owl">${drawOwlReferee(overlay.pose)}</div>
      <p class="field-var-banner">
        <span class="field-var-badge">${i18n.getMessage('VAR')}</span>
        <span class="field-var-text">${banner}</span>
      </p>
    `)}
  </div>`;
}

/**
 * @description One field-wide layer: 'wash' (behind the squirrels: disco floor, flood,
 *   earthquake ground, VAR veil), 'fx' (light accents in front: disco beams and ball, gust,
 *   hail) or 'var' (the VAR review). Always rendered, empty when nothing is on, so the layers keep
 *   their place.
 * @param {Object[]} overlays - From sceneAt.
 * @param {string} layer - 'wash', 'fx' or 'var'.
 * @param {{i18n: {getMessage: Function}, verdicts?: Object<string, string>}} context - The AIUX
 *   i18n service and the translated VAR verdicts by phrase key.
 * @returns {import('lit').TemplateResult} The template.
 * @example
 *   renderFieldLayer(scene.overlays, 'fx', {i18n, verdicts});
 * @since 1.0.0
 */
export function renderFieldLayer(overlays, layer, context) {
  const {i18n} = context;
  const verdicts = context.verdicts || {};
  const renderers = {
    discoWash: (overlay) => renderDiscoWash(overlay),
    flood: (overlay) => renderFlood(overlay),
    earthquake: (overlay) => renderEarthquake(overlay),
    varVeil: (overlay) => renderVarVeil(overlay),
    disco: (overlay) => renderDisco(overlay),
    gust: (overlay) => renderGust(overlay),
    acornHail: (overlay) => renderHail(overlay),
    var: (overlay) => renderVar(overlay, i18n, verdicts)
  };
  const drawn = overlays.filter((overlay) => (
    overlay.layer === layer && Object.prototype.hasOwnProperty.call(renderers, overlay.type)
  ));
  return html`<div class="field-layer field-layer-${layer}" aria-hidden="true">
    ${repeat(drawn, (overlay) => overlay.key, (overlay) => renderers[overlay.type](overlay))}
  </div>`;
}

/** The field-wide layers' styles. Base values are each part's still frame (reduced motion). */
export const fieldLayerStyles = css`
  .field-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  /* Field layers (see stage-lanes.js): trees 1, these washes 1 as well (drawn right after the
     trees, so over them), back overlays 2, squirrels 3, front overlays 4, these light accents 5,
     the VAR review 7, the photo-finish stamp 8. Every wash is behind every squirrel. */
  .field-layer-wash {
    z-index: 1;
  }

  .field-layer-fx {
    z-index: 5;
  }

  .field-layer-var {
    z-index: 7;
  }

  .field-overlay {
    position: absolute;
    inset: 0;
  }

  .field-overlay svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  /* Never animate inside a stretched SVG (contract § 8): the kit's water, crack and VAR lines
     fill their boxes with preserveAspectRatio none, so their own loops are switched off and the
     stage moves the whole box. The leaf-gust copies and the hail nuts hold still inside too: the
     stage already moves each of them on the compositor. */
  .field-water-climb *,
  .field-crack-art *,
  .field-var-lines-art *,
  .field-gust-leaves *,
  .field-hail-nut * {
    animation: none !important;
  }

  /* The VAR freeze: everything on the field holds still while the review runs. */
  .field.is-var .trees *,
  .field.is-var .racers *,
  .field.is-var .chaos-overlays *,
  .field.is-var .field-layer-wash *,
  .field.is-var .field-layer-fx * {
    animation-play-state: paused !important;
  }

  /* The disco: the purple floor wash behind the squirrels; the beams and the ball in front, at
     low opacity. --ball-x is where the ball hangs (to the left when a UFO is about). */
  .field-disco-floor,
  .field-disco {
    --ball-x: 50cqw;
  }

  .field-ball-left {
    --ball-x: 22cqw;
  }

  .field-disco-wash {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse at 50% 0%,
      var(--ss-disco-spot),
      var(--ss-disco-wash) 60%
    );
    opacity: 0;
    will-change: opacity;
  }

  .field-disco-beams {
    position: absolute;
    inset: 0;
    overflow: hidden;
    opacity: 0;
    will-change: opacity;
  }

  .field-disco-beam {
    position: absolute;
    top: 4cqh;
    left: calc(var(--ball-x) - 15cqw);
    width: 30cqw;
    height: 110cqh;
    clip-path: polygon(47% 0, 53% 0, 100% 100%, 0 100%);
    transform-origin: 50% 0;
    will-change: transform;
    animation: stage-disco-beam 2200ms ease-in-out infinite alternate;
  }

  .field-disco-beam-1 {
    background: linear-gradient(var(--ss-disco-beam-1), transparent 85%);
  }

  .field-disco-beam-2 {
    background: linear-gradient(var(--ss-disco-beam-2), transparent 85%);
    animation-direction: alternate-reverse;
    animation-duration: 1900ms;
  }

  .field-disco-beam-3 {
    background: linear-gradient(var(--ss-disco-beam-3), transparent 85%);
    animation-delay: -1100ms;
    animation-duration: 2600ms;
  }

  .field-disco-ball {
    position: absolute;
    top: 0;
    left: calc(var(--ball-x) - min(6cqh, 4cqw));
    width: min(12cqh, 8cqw);
    height: min(24cqh, 16cqw);
    opacity: 0;
  }

  .field-disco-drop {
    position: absolute;
    inset: 0;
  }

  .field-disco-string {
    position: absolute;
    left: calc(50% - 1px);
    top: 0;
    width: 2px;
    height: 50%;
    background: var(--ss-label-ink);
    opacity: 0.6;
  }

  .field-disco-ball-art {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: min(9cqh, 6cqw);
    opacity: 0.7;
  }

  /* The stage drops the ball itself; the kit's own drop would play it twice. */
  .field-disco-ball-art .ss-mirror-ball .ball-rig {
    animation: none;
  }

  .field-disco-beaver {
    position: absolute;
    bottom: 0;
    left: 46%;
    width: min(14cqh, 9cqw);
    height: min(12cqh, 8cqw);
  }

  .field-disco-robot {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: flex-end;
    justify-content: center;
    font-size: min(9cqh, 6cqw);
    transform-origin: 50% 100%;
    animation: stage-robot-cameo 480ms steps(2, end) infinite;
  }

  /* The leaf gust. The leaves stream across inside the field and fade before its edge. */
  .field-gust-band {
    position: absolute;
    left: 0;
    right: 0;
    top: 8%;
    height: 70%;
    opacity: 0;
  }

  .field-gust-leaves {
    position: absolute;
    left: 0;
    width: 22cqw;
    height: 18cqh;
    font-size: min(8cqh, 5cqw);
    animation: stage-leaves-blow 900ms linear infinite;
  }

  .field-gust.is-rtl .field-gust-leaves {
    animation-direction: reverse;
  }

  .field-gust-leaves-1 {
    top: 5%;
  }

  .field-gust-leaves-2 {
    top: 38%;
    animation-delay: -300ms;
  }

  .field-gust-leaves-3 {
    top: 70%;
    animation-delay: -600ms;
  }

  /* The pigeon and the toupee fly low, under the leaderboard's side. */
  .field-gust-item {
    --walker-w: min(12cqh, 8cqw);
    position: absolute;
    left: 0;
    width: var(--walker-w);
    height: var(--walker-w);
    font-size: calc(var(--walker-w) * 0.8);
    transform: translate(-100%, 0);
  }

  .field-pigeon {
    top: 58%;
  }

  .field-toupee {
    top: 70%;
  }

  .field-toupee-art {
    position: absolute;
    left: 10%;
    right: 10%;
    top: 35%;
    bottom: 30%;
    border-radius: 50% 50% 30% 30%;
    background: var(--ss-toupee);
    animation: stage-toupee-flap 180ms ease-in-out infinite alternate;
  }

  /* The earthquake's ground. */
  .field-quake-ground {
    position: absolute;
    inset: 0;
  }

  .field-crack {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 5cqh;
    transform-origin: 50% 50%;
  }

  .field-crack-line {
    position: absolute;
    left: 4%;
    right: 4%;
    top: 40%;
    height: 3px;
    background: var(--ss-crack);
    clip-path: polygon(
      0 50%, 10% 0, 20% 100%, 32% 10%, 45% 90%, 58% 0, 70% 100%, 82% 20%, 92% 90%, 100% 50%,
      92% 100%, 82% 60%, 70% 100%, 58% 40%, 45% 100%, 32% 50%, 20% 100%, 10% 40%
    );
  }

  .field-crack-art {
    position: absolute;
    inset: 0;
  }

  .field-mole {
    position: absolute;
    bottom: 0;
    left: calc(var(--across) * 1cqw - min(5cqh, 4cqw));
    width: min(10cqh, 8cqw);
    height: min(10cqh, 8cqw);
    overflow: hidden;
  }

  .field-mole-pop {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    font-size: min(8cqh, 6cqw);
  }

  /* The flood rises from below the field, so the field clips it. The water's box starts half a
     squirrel down the climb, so the waterline sits where a squirrel at that height has its
     middle. The water is a large mover: its own compositor layer. */
  .field-flood {
    overflow: hidden;
  }

  .field-water {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(var(--climb-top) + var(--sprite) * 0.5);
    bottom: 0;
    opacity: 0.85;
    will-change: transform;
  }

  .field-water-climb {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: var(--climb-span);
  }

  .field-water-body {
    position: absolute;
    left: 0;
    right: 0;
    top: calc((1 - var(--units) / 100) * var(--climb-span));
    height: calc(var(--units) / 100 * var(--climb-span));
    background: linear-gradient(var(--ss-water-top), var(--ss-water));
  }

  /* Below the climb box (the squirrels' feet and bibs) it is all water. */
  .field-water-base {
    position: absolute;
    left: 0;
    right: 0;
    top: var(--climb-span);
    bottom: 0;
    background-color: var(--ss-water);
  }

  /* The duck rides on the water (it rises and drains with it). */
  .field-duck {
    position: absolute;
    left: 0;
    bottom: calc(
      100cqh - var(--climb-top) - (1 - var(--units) / 100) * var(--climb-span) - var(--sprite) * 0.5
        - min(4cqh, 3cqw)
    );
    width: min(9cqh, 6cqw);
    height: min(9cqh, 6cqw);
    font-size: min(7cqh, 5cqw);
    /* Still frame: bobbing mid-field. */
    transform: translate(45cqw, 0);
  }

  /* The acorn hail. */
  .field-hail-band {
    position: absolute;
    inset: 0;
    opacity: 0;
  }

  /* Still frame: scattered where they are; the fall is a loop from above the field to below. */
  .field-hail-nut {
    position: absolute;
    left: calc(var(--across) * 1cqw);
    top: calc(var(--down) * 1cqh);
    width: calc(min(6cqh, 4cqw) * var(--size));
    height: calc(min(6cqh, 4cqw) * var(--size));
    font-size: calc(min(5cqh, 3.5cqw) * var(--size));
    animation: stage-hail-fall 850ms linear infinite;
    animation-delay: calc(var(--delay) * -1);
  }

  /* The VAR review: the veil behind the squirrels, the rest in front. */
  .field-var-veil {
    position: absolute;
    inset: 0;
    background-color: var(--ss-var-veil);
    opacity: 0;
    will-change: opacity;
  }

  .field-var-review {
    position: absolute;
    inset: 0;
  }

  .field-var-lines {
    position: absolute;
    inset: 0;
    transform-origin: 0 50%;
  }

  .field-var-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--ss-var-line);
    box-shadow: 0 0 6px var(--ss-var-line);
    transform: skewX(-12deg);
  }

  .field-var-line-1 {
    left: 33%;
  }

  .field-var-line-2 {
    left: 61%;
  }

  .field-var-lines-art {
    position: absolute;
    inset: 0;
  }

  .field-var-owl {
    position: absolute;
    right: 3%;
    bottom: 4%;
    width: clamp(56px, 26cqh, 170px);
    height: clamp(56px, 26cqh, 170px);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    font-size: clamp(40px, 18cqh, 120px);
  }

  .field-var-banner {
    position: absolute;
    left: 50%;
    top: 12%;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    max-width: 80%;
    margin: 0;
    padding: 0.4rem 1rem;
    border-radius: 6px;
    color: var(--ss-hud-ink);
    background-color: var(--ss-hud-paper);
    font-size: clamp(0.85rem, 2.2cqw, 1.4rem);
    font-weight: 900;
    letter-spacing: 0.04em;
    text-align: center;
    transform: translateX(-50%);
  }

  .field-var.is-checking .field-var-text {
    animation: stage-var-blink 700ms steps(2, end) infinite;
  }

  .field-var-badge {
    padding: 0.1rem 0.45rem;
    border-radius: 4px;
    color: var(--ss-var-badge-ink);
    background-color: var(--ss-var-line);
  }

  @keyframes stage-leaves-blow {
    from {
      transform: translateX(-25cqw) rotate(0deg);
      opacity: 0;
    }
    12% {
      opacity: 1;
    }
    80% {
      opacity: 1;
    }
    to {
      transform: translateX(78cqw) rotate(30deg);
      opacity: 0;
    }
  }

  @keyframes stage-toupee-flap {
    from {
      transform: rotate(-20deg) scaleY(0.8);
    }
    to {
      transform: rotate(20deg) scaleY(1.1);
    }
  }

  @keyframes stage-disco-beam {
    from {
      transform: rotate(-24deg);
    }
    to {
      transform: rotate(24deg);
    }
  }

  @keyframes stage-robot-cameo {
    from {
      transform: rotate(-12deg) translateY(0);
    }
    to {
      transform: rotate(12deg) translateY(-8%);
    }
  }

  @keyframes stage-hail-fall {
    from {
      transform: translateY(calc(-20cqh - var(--down) * 1cqh)) rotate(0deg);
    }
    to {
      transform: translateY(calc(100cqh - var(--down) * 1cqh)) rotate(360deg);
    }
  }

  @keyframes stage-var-blink {
    to {
      opacity: 0.35;
    }
  }
`;
