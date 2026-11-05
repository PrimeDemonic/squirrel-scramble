/**
 * <ss-race-stage>: the Squirrel Scramble race and result views (SPEC.md § 8, § 10 to § 13).
 *
 * Give it a stored race (the REST payload {race, entrants}, SPEC.md § 7) and it plays the race
 * that the instance has already drawn: a 3-2-1 count-in, squirrels climbing in their outfits,
 * Classic and Chaos events, commentary, the live leaderboard and the woodland crowd, then the
 * photo-finish freeze-frame (when there is one) and the podium. It never chooses a winner: the
 * finishing order comes from the payload, and lib/choreography.js guarantees the climb ends in
 * exactly that order.
 *
 * Time: the stage reads performance.now() on every animation frame and draws everything as a
 * function of that clock and the race plan, so a screen share at 10 fps still ends on time and a
 * replay looks the same at the same moment. Squirrels move by transform only, written straight
 * onto cached elements each frame; Lit re-renders only when something discrete changes (a pose,
 * the leaderboard order, an overlay). The frame loop, the clock and the resize observer start only
 * in the browser and stop when the element is disconnected.
 *
 * Readability (Chaos v2 contract § 8): visitors get drawn lead-ins and tails around their plan
 * windows (stage-shared.js); field-wide washes sit behind the squirrels; nothing plays behind the
 * leaderboard; SquirrelScramble.debug.perf() measures frame times.
 *
 * Performance (Chaos v2 contract § 10): busy and packed fields drop the detail loops, and a packed
 * field keeps limb and body loops only on its five featured racers (is-featured). The stage's
 * shadow root carries no Tailwind or DaisyUI sheet (finalizeStyles): nothing inside the stage may
 * use their classes; its controls use the ss-btn and ss-alert classes defined here. The film-rate
 * driver (24 Hz loops, stage-film-rate.js) ships off: the measurements in § 10.1 showed it costs
 * more than it saves. SquirrelScramble.debug.filmRate(true) turns it on for A/B work, and
 * .loops() counts the loops it holds.
 *
 * Weather (Chaos v2 contract § 14): the race's sky comes from one seeded pool in both modes. Rain
 * (drizzle, storm) is three HTML layers of static SVG streaks laid out from the seed
 * (stage-weather.js, stage-weather-layer.js), each falling on its own composited CSS loop: far
 * and mid in the sky behind the trees, near in front of the squirrels at 0.3 opacity, with
 * splash ripples on the grass. A lightning strike in a sky without storm clouds comes out of a
 * small thundercloud that rolls in over the struck tree, timed with race time.
 *
 * Sound (Chaos v2 contract § 9): the stage drives components/audio/race-audio.js. Live playback
 * (a new race from its count-in, restart()) unlocks the audio and starts the music; as the clock
 * passes each mark from stage-audio.js the stage plays the cue or the event's effect and sets the
 * music's intensity from the overlapping Chaos events. The owl's hoots (with "Go!" and at the
 * winner's line, withHootMarks in stage-timeline.js) are two more cue marks on the same path.
 * Nothing plays from a debug seek, and a skip stops the music and plays only the finish cue. The
 * race HUD carries <ss-sound-toggle>, and the M key mutes and unmutes (never while typing).
 *
 * Race log and owl (Chaos v2 contract § 11, § 12): the race log is built once a race from the
 * plan (lib/race-log.js) and shown under the leaderboard, newest first, stopping above the
 * walkers' band at the bottom of the board column; the result view recaps it as "What
 * happened". The owl commentator sits in a booth at the left of the commentary banner. How many
 * log entries have appeared and the owl's pose are part of the discrete scene, so the stage
 * re-renders only when either changes; the owl's poses are classes on one drawing, never a new
 * SVG. The log is not a live region: the result announcement stays the stage's only one.
 *
 * Interface (the race page codes against it):
 * - properties: race (the payload), replay (show the replay banner; a void race always shows the
 *   VOID banner), instant (go straight to the result view), reducedMotion (Chaos events as
 *   captions and still frames, no shake; the platform preference and the media query are honoured
 *   too);
 * - methods: restart() (from the count-in, identical choreography), skip() (to the result view);
 * - events, bubbling and composed: ss-stage:result-shown {raceSysId}, and ss-result:action
 *   {action} with action 'replay', 'rematch', 'new' or 'open-record'.
 *
 * Names reach the page through Lit text bindings only. The element fills its host.
 */
import {html, css, nothing, isServer} from 'lit';
import {customElement} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';
import {guard} from 'lit/directives/guard.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';
import {themeConfig} from '../lib/theme-config.js';
import {createRng} from '../lib/rng.js';
import {buildRacePlan, heightAt} from '../lib/choreography.js';
import {buildCommentaryCues} from '../lib/commentary.js';
import {buildRaceLog} from '../lib/race-log.js';
import {getRaceAudio} from './audio/race-audio.js';
import {isSoundShortcut} from './audio/sound-shortcut.js';
import './audio/sound-toggle.js';
import {translateCue, translatePhrase} from './phrases.js';
import {scrubFrame, scrubShare, DEFAULT_SHAPE} from './stage-scrubs.js';
import {audioMarks, overlapCap, intensityAt} from './stage-audio.js';
import {
  prepareTimeline,
  sceneAt,
  racerPlacement,
  raceTimeAt,
  stageTimeOf,
  phaseAt,
  scaleBand,
  withHootMarks
} from './stage-timeline.js';
import {
  buildCast,
  readOutfit,
  renderTrees,
  renderRacers,
  renderTrunkLabels,
  treeViewHeight,
  laneStyles
} from './stage-lanes.js';
import {renderOverlays, chaosStyles} from './stage-chaos-layer.js';
import {renderFieldLayer, fieldLayerStyles} from './stage-field-layer.js';
import {
  renderHead,
  renderHudTools,
  renderCountIn,
  renderBoard,
  renderCrowd,
  hudStyles
} from './stage-hud.js';
import {
  renderResult,
  renderPhotoStamp,
  resultAnnouncement,
  confettiPieces,
  podiumStyles,
  RESULT_ACTIONS
} from './stage-podium.js';
import {commentaryStyles} from './stage-commentary.js';
import {drawSky, spriteStyles} from './stage-sprites.js';
import {rainOf, rainLayout, thundercloudsFor} from './stage-weather.js';
import {
  renderRain,
  renderSplashes,
  renderThunderclouds,
  weatherStyles
} from './stage-weather-layer.js';
import {installDebugHook, registerStage, unregisterStage} from './stage-debug.js';
import {FilmRateDriver, featuredDue, pickFeatured, sameMembers} from './stage-film-rate.js';

// The commentary and the confetti draw from their own generators, offset from the race seed, so
// they never disturb the race's own sequence (SPEC.md § 11.1).
const COMMENTARY_SEED_OFFSET = 1;
const CONFETTI_SEED_OFFSET = 7;

// The rain's depth layers drawn in the sky, behind the trees; the near layer is drawn in the
// field (Chaos v2 contract § 14).
const SKY_RAIN = Object.freeze(['far', 'mid']);
const FIELD_RAIN = Object.freeze(['near']);

// The field size assumed before the browser measures it (and during server rendering).
const DEFAULT_FIELD = Object.freeze({width: 1100, height: 600});

// A jump of more than this between two frames (a hidden tab coming back) is not played through:
// the cues and effects it passed stay silent.
const AUDIO_MAX_CATCH_UP_MS = 750;

// The result view's buttons that unlock the audio inside their click (the browser's autoplay
// rule): the sound of a replay, a rematch or the next race can then start.
const UNLOCKING_ACTIONS = Object.freeze(['replay', 'rematch', 'new']);

/**
 * @description Reads a timed part's build-up or fade share from its data attribute.
 * @param {string|undefined} raw - The attribute's value.
 * @param {number} fallback - The share to use when it is missing or not a number.
 * @returns {number} The share.
 * @example
 *   readShare('0.25', 0.15);
 *   // 0.25
 * @since 2.1.0
 */
function readShare(raw, fallback) {
  if (raw === undefined || raw === null || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

/**
 * The resets of Tailwind's preflight that the stage's templates rely on. The stage drops the
 * Tailwind sheet from its shadow root (finalizeStyles, Chaos v2 contract § 10), and with it these
 * resets; this is the same subset, first in the cascade and with the same low specificity, so
 * every component rule still wins exactly as before.
 */
const stagePreflightStyles = css`
  :host {
    line-height: 1.5;
    -webkit-tap-highlight-color: transparent;
  }

  *,
  *::before,
  *::after {
    margin: 0;
    padding: 0;
    border: 0 solid;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-size: inherit;
    font-weight: inherit;
  }

  ol,
  ul,
  menu {
    list-style: none;
  }

  img,
  svg,
  video,
  canvas {
    display: block;
    vertical-align: middle;
  }

  img,
  video {
    max-width: 100%;
    height: auto;
  }

  button,
  input,
  select,
  textarea {
    font: inherit;
    font-feature-settings: inherit;
    font-variation-settings: inherit;
    letter-spacing: inherit;
    color: inherit;
    border-radius: 0;
    background-color: transparent;
    opacity: 1;
  }

  table {
    text-indent: 0;
    border-color: inherit;
    border-collapse: collapse;
  }

  a {
    color: inherit;
    text-decoration: inherit;
  }

  b,
  strong {
    font-weight: bolder;
  }

  [hidden]:where(:not([hidden='until-found'])) {
    display: none !important;
  }
`;

/**
 * The stage's own controls (Chaos v2 contract § 10): buttons and an alert that look like the
 * DaisyUI ones, without the Tailwind sheet. They read the Horizon and DaisyUI theme tokens, which
 * still inherit into the shadow root, with literal fallbacks. Classes: ss-btn with ss-btn-sm,
 * ss-btn-neutral, ss-btn-primary or ss-btn-outline; ss-alert with ss-alert-error (the soft error
 * look). Every button is at least 24 px square, shows a two-tone focus ring for the keyboard,
 * darkens on hover and greys out when disabled.
 */
const stageControlStyles = css`
  :host {
    --ss-control-base: var(--color-base-200, #eeeeee);
    --ss-control-base-ink: var(--color-base-content, #1a1a1a);
    --ss-control-paper: var(--color-base-100, #ffffff);
    --ss-control-neutral: var(--color-neutral, #1f2328);
    --ss-control-neutral-ink: var(--color-neutral-content, #ffffff);
    --ss-control-primary: var(--color-primary, #1f4e9e);
    --ss-control-primary-ink: var(--color-primary-content, #ffffff);
    --ss-control-error: var(--color-error, #b3261e);
    --ss-control-ring: var(--color-primary, #1f4e9e);
  }

  .ss-btn {
    --ss-btn-bg: var(--ss-control-base);
    --ss-btn-fg: var(--ss-control-base-ink);
    --ss-btn-edge: transparent;
    --ss-btn-h: calc(var(--size-field, 0.25rem) * 10);
    --ss-btn-pad: 1rem;
    --ss-btn-font: 0.875rem;
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    min-width: 24px;
    min-height: 24px;
    height: var(--ss-btn-h);
    padding-inline: var(--ss-btn-pad);
    border: var(--border, 1px) solid var(--ss-btn-edge);
    border-radius: var(--radius-field, 0.25rem);
    color: var(--ss-btn-fg);
    background-color: var(--ss-btn-bg);
    font-size: var(--ss-btn-font);
    font-weight: 600;
    line-height: 1;
    text-align: center;
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
    touch-action: manipulation;
    transition-property: color, background-color, border-color, box-shadow;
    transition-duration: 0.2s;
    transition-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }

  .ss-btn-sm {
    --ss-btn-h: calc(var(--size-field, 0.25rem) * 8);
    --ss-btn-pad: 0.75rem;
    --ss-btn-font: 0.75rem;
  }

  .ss-btn-neutral {
    --ss-btn-bg: var(--ss-control-neutral);
    --ss-btn-fg: var(--ss-control-neutral-ink);
  }

  .ss-btn-primary {
    --ss-btn-bg: var(--ss-control-primary);
    --ss-btn-fg: var(--ss-control-primary-ink);
  }

  .ss-btn-outline {
    --ss-btn-bg: transparent;
    --ss-btn-fg: currentColor;
    --ss-btn-edge: currentColor;
  }

  @media (hover: hover) {
    .ss-btn:hover {
      background-color: color-mix(in oklab, var(--ss-btn-bg), black 8%);
    }

    .ss-btn-outline:hover {
      background-color: color-mix(in oklab, currentColor 10%, transparent);
    }
  }

  .ss-btn:active {
    translate: 0 0.5px;
  }

  .ss-btn:focus-visible {
    outline: 2px solid var(--ss-control-ring);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px var(--ss-control-paper);
  }

  .ss-btn:disabled,
  .ss-btn[aria-disabled='true'] {
    pointer-events: none;
    cursor: not-allowed;
    border-color: transparent;
    color: color-mix(in oklab, var(--ss-control-base-ink) 35%, transparent);
    background-color: color-mix(in oklab, var(--ss-control-base-ink) 10%, transparent);
    box-shadow: none;
  }

  .ss-alert {
    --ss-alert-tone: var(--ss-control-base-ink);
    display: grid;
    grid-auto-flow: column;
    align-items: center;
    justify-content: start;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border: var(--border, 1px) solid color-mix(in oklab, var(--ss-alert-tone) 10%, transparent);
    border-radius: var(--radius-box, 0.5rem);
    color: var(--ss-alert-tone);
    background-color: color-mix(in oklab, var(--ss-alert-tone) 8%, var(--ss-control-paper));
    font-size: 0.875rem;
    line-height: 1.25rem;
    text-align: start;
  }

  .ss-alert-error {
    --ss-alert-tone: var(--ss-control-error);
  }
`;

/** The stage's own styles: palette, layout, scrubbing and reduced motion. */
const stageStyles = css`
  :host {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 420px;
    --ss-bark: #6b4423;
    --ss-bark-dark: #3e2612;
    --ss-bark-light: #c9a27a;
    --ss-speed-line: #ffffff;
    --ss-label-ink: #1a1a1a;
    --ss-label-paper: rgba(255, 255, 255, 0.9);
    --ss-hud-ink: #ffffff;
    --ss-hud-paper: rgba(20, 24, 28, 0.74);
    --ss-hud-shadow: rgba(0, 0, 0, 0.55);
    --ss-void-ink: #ffffff;
    --ss-void-paper: #b3261e;
    --ss-go-ink: #2e7d32;
    --ss-board-ink: #1a1a1a;
    --ss-board-paper: rgba(255, 255, 255, 0.92);
    --ss-race-log-paper: #ffffff;
    --ss-board-track: rgba(0, 0, 0, 0.12);
    --ss-board-fill: #1f4e9e;
    --ss-grass: #4e8f3a;
    --ss-grass-top: #6db04f;
    --ss-storm-dim: #1b1f24;
    --ss-flash: #ffffff;
    --ss-muzzle: #ffb300;
    --ss-blam-ink: #ffd600;
    --ss-blam-edge: #3e2612;
    --ss-bolt-glow: #fff59d;
    --ss-stamp-ink: #b3261e;
    --ss-stamp-paper: rgba(255, 248, 225, 0.94);
    --ss-veil: rgba(10, 20, 10, 0.35);
    --ss-panel: var(--color-base-100, #ffffff);
    --ss-panel-ink: var(--color-text-primary, #1a1a1a);
    --ss-podium: #e8d9b5;
    --ss-rule: rgba(0, 0, 0, 0.12);
    --ss-focus: #1f4e9e;
    --ss-confetti-0: #e53935;
    --ss-confetti-1: #fdd835;
    --ss-confetti-2: #43a047;
    --ss-confetti-3: #1e88e5;
    --ss-confetti-4: #8e24aa;
    --ss-confetti-5: #fb8c00;
    --ss-carnage: rgba(179, 38, 30, 0.85);
    --ss-beam: rgba(190, 255, 170, 0.95);
    --ss-toupee: #5d4037;
    --ss-crack: #2b1a0e;
    --ss-water-top: rgba(120, 190, 235, 0.85);
    --ss-water: rgba(30, 100, 170, 0.9);
    --ss-ring: #ff7043;
    --ss-disco-wash: rgba(110, 40, 170, 0.32);
    --ss-disco-spot: rgba(255, 120, 230, 0.55);
    --ss-disco-beam-1: rgba(255, 64, 129, 0.34);
    --ss-disco-beam-2: rgba(24, 255, 255, 0.3);
    --ss-disco-beam-3: rgba(255, 235, 59, 0.28);
    --ss-var-veil: rgba(10, 14, 22, 0.45);
    --ss-var-line: #00e5ff;
    --ss-var-badge-ink: #0a0e16;
  }

  /* Holds every field layer, so the earthquake shakes them all together. While it shakes it is
     the largest mover of all, so it gets its own compositor layer then (and only then). */
  .field-shaker {
    position: absolute;
    inset: 0;
  }

  .field.is-quaking .field-shaker {
    will-change: transform;
  }

  .stage {
    --board-w: clamp(170px, 17vw, 260px);
    --labels-h: 30px;
    --crowd-h: clamp(34px, 6.5vh, 56px);
    --label-font: 0.75rem;
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--board-w);
    grid-template-rows: auto minmax(0, 1fr) var(--labels-h) var(--crowd-h);
    grid-template-areas:
      'head head'
      'field board'
      'labels .'
      'crowd crowd';
    width: 100%;
    height: 100%;
    overflow: hidden;
    isolation: isolate;
  }

  .band-roomy {
    --sprite-cap: 84px;
    --bib-h: 18px;
  }

  .band-busy {
    --sprite-cap: 44px;
    --bib-h: 13px;
    --label-font: 0.68rem;
  }

  .band-packed {
    --board-w: clamp(150px, 13.5vw, 240px);
    --sprite-cap: 22px;
    --bib-h: 10px;
    --label-font: 0.62rem;
  }

  .is-rotated-labels {
    --labels-h: 74px;
  }

  .band-packed.is-rotated-labels {
    --labels-h: 62px;
  }

  .sky {
    position: absolute;
    inset: 0;
    z-index: 0;
    background: linear-gradient(var(--sky-top), var(--sky-bottom));
  }

  .sky svg {
    width: 100%;
    height: 100%;
  }

  /* The grass strip; it holds the rain's splash ripples (stage-weather-layer.js). */
  .ground {
    grid-row: 3 / 5;
    grid-column: 1 / -1;
    position: relative;
    z-index: 0;
    overflow: hidden;
    background: linear-gradient(var(--ss-grass-top), var(--ss-grass));
  }

  .field {
    grid-area: field;
    position: relative;
    z-index: 1;
    min-width: 0;
    min-height: 0;
    container-type: size;
    container-name: field;
    --lane-w: calc(100cqw / var(--lanes));
    /* Matches TREE_BOX_MAX_PX in stage-lanes.js. */
    --tree-max: 160px;
    --tree-w: min(var(--lane-w), var(--tree-max));
    --sprite: min(calc(var(--lane-w) * 0.8), var(--sprite-cap), 15cqh);
    /* The kit's tree carries its chestnut in the top fifth of its width: at height 100 the
       squirrel's head is on the chestnut. */
    --climb-top: calc(var(--tree-w) * 0.1);
    --climb-span: calc(100cqh - var(--climb-top) - var(--sprite) - var(--bib-h) - 4px);
  }

  .labels-area {
    grid-area: labels;
    position: relative;
    z-index: 2;
    min-width: 0;
  }

  .crowd-area {
    grid-area: crowd;
    position: relative;
    z-index: 2;
    min-width: 0;
  }

  /* The leaderboard stays on top of everything in the race; only the count-in and the result
     view sit above it. */
  .stage .board-area {
    z-index: 12;
    align-self: stretch;
    min-width: 0;
  }

  .stage-message {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 1rem;
  }

  .visually-hidden,
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .sprite-glyph,
  .sprite-number {
    line-height: 1;
  }

  .sprite-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    color: var(--ss-label-ink);
    background-color: var(--ss-label-paper);
    font-size: 0.7rem;
    font-weight: 800;
  }

  /* Crowd detail by band (Chaos v2 contract § 10.2). From 13 squirrels (busy, and packed with
     it) the racers drop their detail loops: the blink, the tail flick (a flag pose keeps its
     streaming tail: its shape comes from the loop), the cape and scarf flutter, and the rainbow
     coat's colour cycle, which then shows its static stripes as with reduced motion. Limbs and
     body still move. Scoped to .racer, so the podium's squirrels keep everything. */
  .stage:is(.band-busy, .band-packed) .racer .ss-squirrel .eye,
  .stage:is(.band-busy, .band-packed) .racer .ss-squirrel:not(.ss-pose-flag) .tail,
  .stage:is(.band-busy, .band-packed) .racer .ss-squirrel :is(.cape, .scarf-tail),
  .stage:is(.band-busy, .band-packed)
    .racer
    .ss-squirrel.ss-fur-rainbow
    :is(.ss-fur, .ss-fur-dark, .ss-fur-stroke, .ss-fur-dark-stroke) {
    animation: none;
  }

  /* Packed (from 31): only the featured racers, the current top five by height (is-featured,
     set by the element at most once a second, never by re-rendering the sprite), keep their limb
     and body loops. The rest hold a still climbing pose and still move up their trees. Flag, fly
     and kiss poses keep theirs: those shapes come from the loop itself. */
  .stage.band-packed
    .racer:not(.is-featured)
    .ss-squirrel:not(.ss-pose-flag, .ss-pose-fly, .ss-pose-kiss)
    :is(.ss-motion, .arm-front, .arm-back, .leg) {
    animation: none;
  }

  /* Reduced motion: every animation and transition stops; each part shows its still frame. */
  .reduce *,
  .reduce *::before,
  .reduce *::after,
  :host([reduced-motion]) .stage *,
  :host([reduced-motion]) .stage *::before,
  :host([reduced-motion]) .stage *::after {
    animation: none !important;
    transition: none !important;
  }

  @media (prefers-reduced-motion: reduce) {
    .stage *,
    .stage *::before,
    .stage *::after {
      animation: none !important;
      transition: none !important;
    }
  }
`;

@customElement('ss-race-stage')
export default class RaceStage extends AIUXElement {
  // The stage has no server script; never fetch on connect.
  static fetchDataOnConnect = false;

  static properties = {
    race: {type: Object, attribute: false},
    replay: {type: Boolean},
    instant: {type: Boolean},
    reducedMotion: {type: Boolean},
    _scene: {type: Object, state: true},
    _error: {type: String, state: true},
    _announcement: {type: String, state: true}
  };

  // The preflight subset and the controls come first, where the Tailwind and DaisyUI sheets used
  // to sit, so every later rule wins over them exactly as it did over those.
  static styles = [
    stagePreflightStyles,
    stageControlStyles,
    ...spriteStyles,
    stageStyles,
    laneStyles,
    chaosStyles,
    fieldLayerStyles,
    weatherStyles,
    hudStyles,
    podiumStyles,
    commentaryStyles
  ];

  /**
   * @description The stage's style sheets without Lux's Tailwind and DaisyUI sheets. AIUXElement
   *   puts its shared Tailwind sheet (about 522 KB) and the app's delta sheet (about 15 KB) in
   *   front of every component's styles, as raw CSSStyleSheet objects. In the stage's shadow root
   *   every restyled element (dozens of animated squirrel parts, every frame) was matched against
   *   all of their rules: measured on the same race and moment (Chaos v2 contract § 10), style
   *   work fell from 4.0 to 0.4 ms a frame at 1x, and from 31 to 2.8 ms at 4x CPU slowdown,
   *   without them. So every raw CSSStyleSheet is dropped here; Lit's css results (the stage's
   *   own sheets and AIUX's small globalStyles) are CSSResult objects and stay.
   *   Consequence: nothing rendered inside the stage's shadow root may use a Tailwind or DaisyUI
   *   class. The stage's controls use ss-btn and ss-alert (stageControlStyles), and the resets
   *   its templates relied on are in stagePreflightStyles. Custom elements inside the stage
   *   (<ss-sound-toggle>) keep Tailwind in their own shadow roots.
   * @param {Array|Object} styles - The class's static styles.
   * @returns {Array<Object>} The styles Lit adopts into each stage's shadow root.
   * @example
   *   RaceStage.finalizeStyles(RaceStage.styles);
   * @since 2.2.0
   */
  static finalizeStyles(styles) {
    const finalized = super.finalizeStyles(styles);
    // No CSSStyleSheet during server rendering, and no Tailwind sheet in the list there either.
    if (typeof CSSStyleSheet === 'undefined') {
      return finalized;
    }
    return finalized.filter((style) => !(style instanceof CSSStyleSheet));
  }

  /**
   * @description Sets every property to its default. No browser work: the element may be built
   *   during server rendering; the film-rate driver is made in the browser only, switched off,
   *   and holds nothing unless debug.filmRate(true) turns it on while the frame loop runs.
   * @since 1.0.0
   */
  constructor() {
    super();
    this.race = null;
    this.replay = false;
    this.instant = false;
    this.reducedMotion = false;
    this._scene = null;
    this._error = '';
    this._announcement = '';
    this._resetRace();
    this._clockOrigin = null;
    this._frameId = 0;
    this._pendingSkip = false;
    this._focusPending = false;
    this._fieldWidth = 0;
    this._fieldHeight = 0;
    this._resizeObserver = null;
    this._motionQuery = null;
    this._racerEls = [];
    this._racerTransforms = [];
    this._fillEls = [];
    this._scrubEls = [];
    this._audioFailed = false;
    // Film-rate loops, browser only and off by default: the measurements in Chaos v2 contract
    // § 10.1 showed it costs more than it saves (SquirrelScramble.debug.filmRate(true) for A/B).
    this._filmRate = isServer ? null : new FilmRateDriver({enabled: false});
    this._onAnimationStart = this._onAnimationStart.bind(this);
    this._onFrame = this._onFrame.bind(this);
    this._onResize = this._onResize.bind(this);
    this._onSkipClick = this._onSkipClick.bind(this);
    this._onActionClick = this._onActionClick.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  /**
   * @description Replays the race from the 3-2-1 count-in. The choreography is identical: it is
   *   rebuilt from the same stored race and seed. The sound starts again with it, the same way as
   *   a live race (the page calls this inside the Replay click or the R key, so the audio may
   *   start).
   * @returns {void}
   * @example
   *   stage.restart();
   * @since 1.0.0
   */
  restart() {
    if (isServer || !this._plan) {
      return;
    }
    this._resultShown = false;
    this._resultShownAt = null;
    this._focusPending = false;
    this._announcement = '';
    this._startLiveAudio();
    this._startAt(-this._timeline.countInMs);
    this._applyDiscrete(this._currentStageMs());
  }

  /**
   * @description Jumps to the result view. Squirrels that have not finished keep climbing behind
   *   it (with reduced motion the stage goes straight to the final, still frame). Called before a
   *   race is loaded, it applies as soon as the race arrives. The music stops and only the finish
   *   cue plays (once).
   * @returns {void}
   * @example
   *   stage.skip();
   * @since 1.0.0
   */
  skip() {
    if (isServer) {
      return;
    }
    if (!this._plan) {
      this._pendingSkip = true;
      return;
    }
    if (!this._finishCued) {
      this._audioLive = false;
      this._finishCued = true;
      this._withAudio((audio) => {
        audio.stop();
        audio.cue('finish');
      });
    }
    const now = this._clockOrigin === null ? -Infinity : this._currentStageMs();
    this._startAt(this._skipTarget(now));
    this._applyDiscrete(this._currentStageMs());
  }

  /**
   * @description Debug only, for SquirrelScramble.debug.events() (not part of the page contract):
   *   the race's events, so a tester can pick a moment to seek to. Read from either plan shape
   *   (Chaos v2 or earlier), with the combo either side of it names.
   * @returns {Array<{id: string, type: string, scope: string, outcome: (string|null),
   *   startMs: number, endMs: number, squirrels: string[],
   *   combo: ({kind: string, with: string}|null), data: Object}>} The events in time order, times
   *   in race milliseconds.
   * @example
   *   stage.debugEvents().filter((event) => event.combo);
   * @since 1.0.0
   */
  debugEvents() {
    if (!this._plan || !this._timeline) {
      return [];
    }
    const entrants = this._plan.entrants;
    return this._timeline.events.map((event) => {
      const combo = this._timeline.combos[event.id];
      return {
        id: event.id,
        type: event.type,
        scope: event.scope,
        outcome: event.outcome,
        startMs: event.startMs,
        endMs: event.endMs,
        squirrels: event.entrants
          .filter((index) => entrants[index])
          .map((index) => entrants[index].name),
        combo: combo ? {kind: combo.kind, with: combo.with} : null,
        data: JSON.parse(JSON.stringify(event.data))
      };
    });
  }

  /**
   * @description Debug only, for SquirrelScramble.debug.parts() (not part of the page contract):
   *   every timed part of the Chaos visitors and decorations on screen now, with the values the
   *   frame loop last wrote and where it sits, for diagnosing a part that does not show.
   * @returns {Array<{kind: string, clock: string, share: number, transform: (string|null),
   *   opacity: (string|null), box: {x: number, y: number, width: number, height: number}}>} The
   *   parts.
   * @example
   *   stage.debugParts().filter((part) => part.kind === 'funnel-sweep');
   * @since 1.0.0
   */
  debugParts() {
    if (isServer || !this._plan || this._clockOrigin === null) {
      return [];
    }
    const stageMs = this._currentStageMs();
    const raceMs = raceTimeAt(this._timeline, stageMs);
    return this._scrubEls.map((part) => {
      const now = part.clock === 'stage' ? stageMs : raceMs;
      const rect = part.element.getBoundingClientRect();
      return {
        kind: part.kind,
        clock: part.clock,
        share: Math.round(scrubShare(now, part.startMs, part.durationMs) * 1000) / 1000,
        transform: part.transform,
        opacity: part.opacity,
        box: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      };
    });
  }

  /**
   * @description Debug only, for SquirrelScramble.debug.seek() (not part of the page contract):
   *   jumps the clock to a race time and plays on from there. The choreography is untouched, so
   *   the race still finishes in its stored order. Seeking back before the result view hides it.
   *   A seek ends live playback's sound (Chaos v2 contract § 9): the music stops and no cue or
   *   effect plays until the race is restarted.
   * @param {number} raceMs - Milliseconds since "Go!" (negative for the count-in).
   * @returns {void}
   * @example
   *   stage.debugSeek(12000);
   * @since 1.0.0
   */
  debugSeek(raceMs) {
    if (isServer || !this._plan || !Number.isFinite(raceMs)) {
      return;
    }
    this._audioLive = false;
    this._withAudio((audio) => audio.stop());
    const stageMs = stageTimeOf(this._timeline, raceMs);
    if (stageMs < this._timeline.resultAtMs) {
      this._resultShown = false;
      this._resultShownAt = null;
      this._focusPending = false;
      this._announcement = '';
    }
    this._startAt(stageMs);
    this._applyDiscrete(this._currentStageMs());
  }

  /**
   * @description Debug only, for SquirrelScramble.debug.filmRate() (not part of the page
   *   contract): switches the film-rate driver on or off, for A/B measurement (Chaos v2 contract
   *   § 10.3). The driver ships off (the measurements in § 10.1 showed it costs more than it
   *   saves), so debug.filmRate(true) is the way to try it. Off hands every loop back to the
   *   platform at once; on takes them over at the next frame while the race runs.
   * @param {boolean} [on] - True for on, false for off; leave it out to toggle.
   * @returns {boolean} The driver's new state (false where there is no driver).
   * @example
   *   stage.debugFilmRate(false);
   * @since 2.2.0
   */
  debugFilmRate(on) {
    const driver = this._filmRate;
    if (!driver) {
      return false;
    }
    const wanted = on === undefined ? !driver.enabled : Boolean(on);
    driver.setEnabled(wanted);
    if (wanted) {
      driver.requestCollect(this.renderRoot);
    }
    return driver.enabled;
  }

  /**
   * @description Debug only, for SquirrelScramble.debug.loops() (not part of the page contract):
   *   how many looping animations the film-rate driver holds, and how many run on the platform's
   *   own clock in the stage (Chaos v2 contract § 10.3).
   * @returns {{driven: number, native: number}} The counts.
   * @example
   *   stage.debugLoops();
   *   // {driven: 88, native: 6}
   * @since 2.2.0
   */
  debugLoops() {
    if (!this._filmRate) {
      return {driven: 0, native: 0};
    }
    return this._filmRate.stats(this.renderRoot);
  }

  /**
   * @description Starts the reduced-motion media query watch, the M (mute) shortcut and the
   *   animationstart watch for the film-rate driver, and resumes the frame loop after a
   *   reconnect. Browser only.
   * @returns {void}
   * @since 1.0.0
   */
  connectedCallback() {
    super.connectedCallback();
    if (isServer) {
      return;
    }
    if (typeof matchMedia === 'function') {
      this._motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    }
    window.addEventListener('keydown', this._onKeyDown);
    if (this.renderRoot) {
      this.renderRoot.addEventListener('animationstart', this._onAnimationStart);
    }
    registerStage(this);
    if (this.hasUpdated) {
      this._observeSize();
    }
    if (this._clockOrigin !== null) {
      this._ensureLoop();
    }
  }

  /**
   * @description Stops the frame loop (handing the film-rate loops back), the resize observer,
   *   the M shortcut, the animationstart watch and the sound, so nothing keeps running once the
   *   stage leaves the page.
   * @returns {void}
   * @since 1.0.0
   */
  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopLoop();
    unregisterStage(this);
    if (!isServer) {
      window.removeEventListener('keydown', this._onKeyDown);
      if (this.renderRoot) {
        this.renderRoot.removeEventListener('animationstart', this._onAnimationStart);
      }
    }
    this._audioLive = false;
    this._withAudio((audio) => audio.stop());
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
  }

  /**
   * @description Builds the plan, timeline, cast and commentary when the race changes. Pure, so it
   *   runs the same during server rendering.
   * @param {Map<string, *>} changed - Changed properties.
   * @returns {void}
   * @since 1.0.0
   */
  willUpdate(changed) {
    super.willUpdate(changed);
    if (changed.has('race')) {
      this._prepareRace();
      return;
    }
    if (changed.has('reducedMotion') && this._plan) {
      const options = this._sceneOptions(this._isReduced());
      const stageMs = this._currentStageMs();
      this._scene = sceneAt(this._plan, this._timeline, this._cues, stageMs, options);
    }
  }

  /**
   * @description Installs the console debug hook, removes any Tailwind link the server put in the
   *   shadow root, and starts watching the stage's size. Browser only (Lit never calls it during
   *   server rendering).
   * @param {Map<string, *>} changed - Changed properties.
   * @returns {void}
   * @since 1.0.0
   */
  firstUpdated(changed) {
    super.firstUpdated(changed);
    installDebugHook();
    this._dropServerStyleLinks();
    this._observeSize();
  }

  /**
   * @description Removes the stylesheet links the Lux server injects into a server-rendered
   *   shadow root (its Tailwind and app delta sheets), for the reason given at finalizeStyles.
   *   Both pages mount the stage in the browser today, so there is normally nothing to remove;
   *   this keeps the stage free of Tailwind if a page ever renders it on the server.
   * @returns {void}
   * @since 2.2.0
   */
  _dropServerStyleLinks() {
    const root = this.renderRoot;
    if (!root || root === this || !root.children) {
      return;
    }
    Array.from(root.children)
      .filter((child) => child.localName === 'link' && child.rel === 'stylesheet')
      .forEach((link) => link.remove());
  }

  /**
   * @description After each render: starts a new race, honours instant, re-caches the moving
   *   elements and puts them where the clock says, re-marks the featured racers, asks the
   *   film-rate driver to collect any new loops at the next frame, and moves focus to the podium
   *   heading when the result has just appeared.
   * @param {Map<string, *>} changed - Changed properties.
   * @returns {void}
   * @since 1.0.0
   */
  updated(changed) {
    super.updated(changed);
    if (changed.has('race')) {
      this._beginRace();
      // The field may only now exist: measure it for the trees and the label rotation.
      this._onResize();
    } else if (changed.has('instant') && this.instant) {
      this.skip();
    }
    this._cacheElements();
    this._applyFeatured();
    if (this._filmRate) {
      this._filmRate.requestCollect(this.renderRoot);
    }
    if (this._plan && this._clockOrigin !== null) {
      this._applyContinuous(this._currentStageMs());
    }
    if (this._focusPending) {
      const heading = this.renderRoot.querySelector('#podium-heading');
      if (heading) {
        this._focusPending = false;
        heading.focus();
      }
    }
  }

  /**
   * @description Renders the stage, the waiting message or the error state.
   * @returns {import('lit').TemplateResult} The template.
   * @since 1.0.0
   */
  render() {
    if (this._error) {
      return this._renderProblem();
    }
    if (!this._plan || !this._scene) {
      return this._renderWaiting();
    }
    return this._renderStage(this._scene);
  }

  /**
   * @description The stage for one scene: sky (with its far and mid rain), the grass (with its
   *   splashes), commentary with the owl's booth, the HUD tools (sound toggle, skip), trees, the
   *   field-wide washes behind the squirrels, Chaos visitors and thunderclouds, squirrels, the
   *   light accents in front, the near rain, leaderboard and race log, trunk labels, crowd,
   *   count-in, result view (with "What happened") and the live region.
   * @param {Object} scene - From sceneAt.
   * @returns {import('lit').TemplateResult} The template.
   * @since 1.0.0
   */
  _renderStage(scene) {
    const plan = this._plan;
    const race = this.race.race;
    const count = plan.entrants.length;
    const rotated = count > themeConfig.race.scale.flatLabelsUpTo || this._lanesNarrow(count);
    const preset = themeConfig.skies.presets[plan.sky] || themeConfig.skies.presets.day;
    const result = scene.phase === 'result';
    const classes = {
      stage: true,
      [`band-${this._band}`]: true,
      reduce: this.reducedMotion,
      'is-chaos': plan.mode === 'chaos',
      'is-rotated-labels': rotated,
      // The photo-finish freeze-frame holds the rain in the sky and on the grass too.
      'is-freeze-frame': Boolean(scene.photo)
    };
    const cueText = scene.cueIndex >= 0 ? this._cueTexts[scene.cueIndex] : '';
    const fieldClasses = {
      field: true,
      'is-frozen': Boolean(scene.photo),
      'is-var': scene.varFreeze,
      'is-disco': scene.disco,
      'is-quaking': Boolean(scene.quake)
    };
    const quake = scene.quake || {startMs: 0, durationMs: 1, ...DEFAULT_SHAPE};
    const layerContext = {i18n, cast: this._cast};
    return html`<div
      class=${classMap(classes)}
      style="--lanes: ${count}; --sky-top: ${preset.top}; --sky-bottom: ${preset.bottom}"
      data-phase=${scene.phase}
      data-mode=${plan.mode}
      data-testid="race-stage"
    >
      <div class="sky" aria-hidden="true">
        ${guard([plan.sky], () => drawSky(plan.sky))}
        ${guard([this._weather], () => renderRain(this._weather, SKY_RAIN, this._rainColour))}
      </div>
      <div class="ground" aria-hidden="true">
        ${guard([this._weather], () => renderSplashes(this._weather))}
      </div>
      ${renderHead({
        race,
        replay: this.replay,
        cueText,
        cueIndex: scene.cueIndex,
        phase: scene.phase,
        mode: plan.mode,
        chaosLevel: plan.chaosLevel || race.chaosLevel,
        i18n,
        owl: {pose: scene.owlPose}
      })}
      ${renderHudTools({showSkip: !result, onSkip: this._onSkipClick, i18n})}
      <div class=${classMap(fieldClasses)} data-testid="field">
        <div
          class="field-shaker"
          data-scrub="race"
          data-scrub-kind=${scene.quake ? 'quake' : 'none'}
          data-scrub-start=${quake.startMs}
          data-scrub-duration=${quake.durationMs}
          data-scrub-in=${quake.inShare}
          data-scrub-out=${quake.outShare}
        >
          ${renderTrees({
            count,
            swayLanes: scene.swayLanes,
            wobbleLanes: scene.wobbleLanes,
            twisting: scene.twisting,
            winnerLane: this._timeline.winnerLane,
            celebrate: result,
            treeHeight: this._treeHeight(count)
          })}
          ${renderFieldLayer(scene.overlays, 'wash', layerContext)}
          ${renderOverlays(scene.overlays, 'back', layerContext)}
          ${guard([this._thunderclouds], () => renderThunderclouds(this._thunderclouds))}
          ${renderRacers(this._cast, scene.racers, this._band)}
          ${renderOverlays(scene.overlays, 'front', layerContext)}
          ${renderFieldLayer(scene.overlays, 'fx', layerContext)}
          ${renderFieldLayer(scene.overlays, 'var', {i18n, verdicts: this._verdicts})}
          ${scene.photo ? renderPhotoStamp(scene.photo, i18n) : nothing}
        </div>
        ${this._renderNearRain()}
      </div>
      <div class="board-area">
        ${renderBoard(scene.board, this._cast, i18n, {
          log: {entries: this._raceLog, count: scene.logCount, raceMs: scene.raceMs}
        })}
      </div>
      <div class="labels-area">
        ${renderTrunkLabels(this._cast, scene.occupancy, rotated, i18n)}
      </div>
      <div class="crowd-area">${renderCrowd(scene.crowd, themeConfig)}</div>
      ${scene.countIn === null ? nothing : renderCountIn(scene.countIn, i18n)}
      ${result
        ? renderResult({
          plan,
          timeline: this._timeline,
          cast: this._cast,
          race,
          confetti: scene.confetti,
          pieces: this._confetti,
          onAction: this._onActionClick,
          i18n,
          whatHappened: {entries: this._recapEntries(scene.logCount)}
        })
        : nothing}
      <div class="sr-only" aria-live="polite" aria-atomic="true" data-testid="result-announcement"
        >${this._announcement}</div
      >
    </div>`;
  }

  /**
   * @description The near rain layer, in front of the squirrels (Chaos v2 contract § 14). Drawn
   *   once a race: the guard holds it while the layout is unchanged.
   * @returns {import('lit').TemplateResult|typeof nothing} The layer, or nothing when dry.
   * @since 2.2.0
   */
  _renderNearRain() {
    if (!this._weather) {
      return nothing;
    }
    const weather = this._weather;
    const colour = this._rainColour;
    return html`<div class="rain-near" aria-hidden="true">
      ${guard([weather], () => renderRain(weather, FIELD_RAIN, colour))}
    </div>`;
  }

  /**
   * @description The race log entries for the result view's "What happened" recap (Chaos v2
   *   contract § 11): those that have appeared by now. That is normally the whole log, as the
   *   result view comes after the last awarded finish; it never gives away a later entry.
   * @param {number} count - The scene's log count.
   * @returns {Object[]} The entries, oldest first (the whole log itself when all have appeared).
   * @since 2.2.0
   */
  _recapEntries(count) {
    const log = this._raceLog;
    if (!Number.isInteger(count) || count >= log.length) {
      return log;
    }
    return log.slice(0, Math.max(0, count));
  }

  /**
   * @description The error state, when the payload breaks the race contract.
   * @returns {import('lit').TemplateResult} The template.
   * @since 1.0.0
   */
  _renderProblem() {
    return html`<div class="stage-message">
      <div
        class="ss-alert ss-alert-error"
        role="alert"
        data-testid="stage-error"
        data-reason=${this._error}
      >
        <span>
          ${i18n.getMessage('This race cannot be shown. Its result is safe in the history.')}
        </span>
      </div>
    </div>`;
  }

  /**
   * @description The waiting state, before a race is given.
   * @returns {import('lit').TemplateResult} The template.
   * @since 1.0.0
   */
  _renderWaiting() {
    return html`<div class="stage-message">
      <p data-testid="stage-waiting">${i18n.getMessage('Waiting for a race.')}</p>
    </div>`;
  }

  /**
   * @description Clears everything derived from the previous race.
   * @returns {void}
   * @since 1.0.0
   */
  _resetRace() {
    this._plan = null;
    this._timeline = null;
    this._cues = [];
    this._cueTexts = [];
    // The race log (Chaos v2 contract § 11), built once a race from the plan; it also drives the
    // owl commentator's gasps (§ 12).
    this._raceLog = [];
    this._cast = [];
    this._legendary = [];
    this._verdicts = {};
    this._confetti = [];
    this._band = 'roomy';
    this._resultShown = false;
    this._resultShownAt = null;
    this._lastStageMs = 0;
    // Packed band (Chaos v2 contract § 10.2): the featured racers' entrant indexes, and the stage
    // time they were last chosen at (null for never).
    this._featured = [];
    this._featuredAt = null;
    // Weather (Chaos v2 contract § 14): the rain layout (null when dry), its streaks' colour and
    // the thunderclouds over lightning strikes in a sky without storm clouds.
    this._weather = null;
    this._rainColour = '';
    this._thunderclouds = [];
    // Sound (Chaos v2 contract § 9): the race's marks, the level's overlap cap, whether live
    // playback is sounding, the stage time it has played up to, the next mark, the intensity last
    // sent, and whether the finish cue has played or should play when the result appears.
    this._audioMarks = [];
    this._audioCap = 0;
    this._audioLive = false;
    this._audioCursor = 0;
    this._audioMarkIndex = 0;
    this._audioIntensity = 0;
    this._finishCued = false;
    this._finishCuePending = false;
  }

  /**
   * @description Builds everything the stage needs from the payload. A payload that breaks the
   *   contract (buildRacePlan throws a TypeError or RangeError) leaves the stage in its error
   *   state; no payload leaves it waiting.
   * @returns {void}
   * @since 1.0.0
   */
  _prepareRace() {
    this._resetRace();
    this._error = '';
    this._announcement = '';
    this._scene = null;
    const payload = this.race;
    if (payload === null || payload === undefined) {
      return;
    }
    try {
      if (typeof payload !== 'object' || !payload.race || !Array.isArray(payload.entrants)) {
        throw new TypeError('The race payload needs a race object and an entrants array.');
      }
      const raceInfo = payload.race;
      const input = {
        // The plan reads each outfit as an object (hat chomps, lost hats, UFO swaps), so a stored
        // JSON string is read here first; the payload itself is never changed.
        entrants: payload.entrants.map((entrant) => (
          entrant && typeof entrant === 'object'
            ? {...entrant, outfit: readOutfit(entrant.outfit)}
            : entrant
        )),
        seed: raceInfo.seed,
        durationMs: raceInfo.durationMs,
        mode: raceInfo.mode
      };
      // The stored chaos level (Chaos v2 contract § 2, § 3), so a replay is identical.
      if (raceInfo.mode === 'chaos' && typeof raceInfo.chaosLevel === 'string') {
        input.chaosLevel = raceInfo.chaosLevel;
      }
      const plan = buildRacePlan(input);
      const timeline = prepareTimeline(plan, raceInfo.places);
      const band = scaleBand(plan.entrants.length);
      const cast = buildCast(plan, payload.entrants, band);
      const legendaryIndexes = cast
        .filter((member) => member.legendary)
        .map((member) => member.index);
      const cues = buildCommentaryCues(
        plan,
        themeConfig.phrases,
        createRng(plan.seed + COMMENTARY_SEED_OFFSET),
        {legendaryIndexes, theme: themeConfig}
      );
      this._plan = plan;
      this._timeline = timeline;
      this._band = band;
      this._cast = cast;
      this._legendary = cast.map((member) => member.legendary);
      this._cues = cues;
      this._cueTexts = cues.map((cue) => translateCue(i18n, cue));
      this._raceLog = buildRaceLog(plan, {places: raceInfo.places});
      this._verdicts = this._translateVerdicts(timeline);
      this._confetti = confettiPieces(
        plan.seed + CONFETTI_SEED_OFFSET,
        themeConfig.timings.confettiPieces,
        themeConfig.timings.confettiMs
      );
      // The owl hoots with "Go!" and at the winner's line (§ 12): two more cue marks, so they
      // sound in live playback only, like every other mark.
      this._audioMarks = withHootMarks(audioMarks(plan, timeline), cues, timeline);
      this._audioCap = overlapCap(plan);
      // Drawn from the seed and the sky alone, so a replay rains the same.
      const rain = rainOf(plan.sky);
      this._weather = rainLayout(plan.seed, rain);
      this._rainColour = rain ? rain.colour : '';
      this._thunderclouds = thundercloudsFor(plan, timeline, plan.sky);
      const firstMs = this.instant ? this._skipTarget(-Infinity) : -timeline.countInMs;
      this._lastStageMs = firstMs;
      this._scene = sceneAt(plan, timeline, cues, firstMs, this._sceneOptions(this._isReduced()));
    } catch (error) {
      this._resetRace();
      this._error = error instanceof Error ? error.message : String(error);
      console.warn('Squirrel Scramble: race payload rejected.', this._error);
    }
  }

  /**
   * @description Translates the verdict of every VAR review in the race (a phrase key in the
   *   theme's phrase bank, Chaos v2 contract § 4), once per race.
   * @param {Object} timeline - From prepareTimeline.
   * @returns {Object<string, string>} Translated verdicts by phrase key (keys the bank does not
   *   know are left out, and the VAR banner falls back to its own line).
   * @since 1.0.0
   */
  _translateVerdicts(timeline) {
    const verdicts = {};
    timeline.events
      .filter((event) => event.type === 'var' && typeof event.data.verdict === 'string')
      .forEach((event) => {
        const text = translatePhrase(i18n, themeConfig.phrases, event.data.verdict);
        if (text) {
          verdicts[event.data.verdict] = text;
        }
      });
    return verdicts;
  }

  /**
   * @description Starts the clock for a newly given race, at the count-in or, with instant (or a
   *   skip asked for before the race arrived), at the result view. A race from its count-in is
   *   live playback, so its sound starts too; this is the stage's earliest moment with a new race
   *   (the Start click itself is on the setup screen, before the server draws the race). A jump
   *   to the result plays only the finish cue, when the result appears.
   * @returns {void}
   * @since 1.0.0
   */
  _beginRace() {
    this._stopLoop();
    this._clockOrigin = null;
    if (isServer || !this._plan) {
      return;
    }
    const jump = this.instant || this._pendingSkip;
    this._pendingSkip = false;
    if (jump) {
      this._audioLive = false;
      this._finishCuePending = true;
      this._withAudio((audio) => audio.stop());
    } else {
      this._startLiveAudio();
    }
    this._startAt(jump ? this._skipTarget(-Infinity) : -this._timeline.countInMs);
  }

  /**
   * @description Sets the clock so that "now" is the given stage time, and runs the frame loop.
   *   The featured racers are chosen afresh at the next frame (a jump in time).
   * @param {number} stageMs - Stage time to be at now (negative during the count-in).
   * @returns {void}
   * @since 1.0.0
   */
  _startAt(stageMs) {
    if (isServer) {
      return;
    }
    this._clockOrigin = performance.now() - stageMs;
    this._featuredAt = null;
    this._ensureLoop();
  }

  /**
   * @description Where a skip lands: the result view, or the final still frame with reduced
   *   motion. Never earlier than where the stage already is.
   * @param {number} fromStageMs - The current stage time.
   * @returns {number} The stage time to jump to.
   * @since 1.0.0
   */
  _skipTarget(fromStageMs) {
    const timeline = this._timeline;
    const target = this._isReduced() ? timeline.settledAtMs : timeline.resultAtMs;
    return Math.max(target, fromStageMs);
  }

  /**
   * @description The stage time now, from performance.now(); the last drawn time when the clock is
   *   not running (or during server rendering).
   * @returns {number} Stage time.
   * @since 1.0.0
   */
  _currentStageMs() {
    if (isServer || this._clockOrigin === null) {
      return this._lastStageMs;
    }
    return performance.now() - this._clockOrigin;
  }

  /**
   * @description Asks for the next animation frame, once. Starting (or restarting, for a replay)
   *   the loop asks the film-rate driver to collect the loops again at that frame.
   * @returns {void}
   * @since 1.0.0
   */
  _ensureLoop() {
    if (!isServer && !this._frameId) {
      if (this._filmRate) {
        this._filmRate.requestCollect(this.renderRoot);
      }
      this._frameId = requestAnimationFrame(this._onFrame);
    }
  }

  /**
   * @description Cancels the pending animation frame and hands the film-rate loops back to the
   *   platform, so no loop stays paused once the loop stops.
   * @returns {void}
   * @since 1.0.0
   */
  _stopLoop() {
    if (this._frameId) {
      cancelAnimationFrame(this._frameId);
      this._frameId = 0;
    }
    this._releaseLoops();
  }

  /**
   * @description One animation frame: advance the film-rate loops, read the clock, move
   *   everything, update the scene, play the sound marks the clock has just passed (live playback
   *   only), and ask for another frame until the stage has settled (everyone home, confetti
   *   gone). Once settled, the loops go back to the platform (the result view has few sprites).
   * @param {number} [frameTime] - The requestAnimationFrame timestamp: the time the platform's
   *   own animations are at in this frame.
   * @returns {void}
   * @since 1.0.0
   */
  _onFrame(frameTime) {
    this._frameId = 0;
    if (!this.isConnected || this._clockOrigin === null || !this._plan) {
      this._releaseLoops();
      return;
    }
    // First, while the style is still clean from the last frame: a collect here forces no
    // extra style recalculation.
    this._driveLoops(frameTime);
    const stageMs = this._currentStageMs();
    this._applyContinuous(stageMs);
    const settled = this._applyDiscrete(stageMs);
    this._playAudioUpTo(stageMs);
    if (settled) {
      this._releaseLoops();
    } else {
      this._frameId = requestAnimationFrame(this._onFrame);
    }
  }

  /**
   * @description Advances the film-rate loops for one frame (Chaos v2 contract § 10.1). With
   *   reduced motion the loops are already off, and the driver lets go of anything it held.
   * @param {number} [frameTime] - The requestAnimationFrame timestamp.
   * @returns {void}
   * @since 2.2.0
   */
  _driveLoops(frameTime) {
    const driver = this._filmRate;
    if (!driver) {
      return;
    }
    if (this._isReduced()) {
      driver.release();
      return;
    }
    driver.tick(Number.isFinite(frameTime) ? frameTime : performance.now());
  }

  /**
   * @description Hands every film-rate loop back to the platform (safe to call at any time).
   * @returns {void}
   * @since 2.2.0
   */
  _releaseLoops() {
    if (this._filmRate) {
      this._filmRate.release();
    }
  }

  /**
   * @description An animation started somewhere in the stage (a new pose, a featured racer, a
   *   visitor): the film-rate driver collects at the next frame.
   * @returns {void}
   * @since 2.2.0
   */
  _onAnimationStart() {
    if (this._filmRate) {
      this._filmRate.requestCollect(this.renderRoot);
    }
  }

  /**
   * @description Runs one call on the race audio (components/audio/race-audio.js), in the browser
   *   only. Sound must never stop the race, so a failure is reported once and then ignored.
   * @param {function(Object): void} action - What to do with the audio singleton.
   * @returns {void}
   * @since 2.1.0
   */
  _withAudio(action) {
    if (isServer) {
      return;
    }
    try {
      const audio = getRaceAudio();
      if (audio) {
        action(audio);
      }
    } catch (error) {
      if (!this._audioFailed) {
        this._audioFailed = true;
        console.warn('Squirrel Scramble: the race audio failed; the race carries on.', error);
      }
    }
  }

  /**
   * @description Starts live playback's sound from the count-in (Chaos v2 contract § 9): unlocks
   *   the audio (inside the gesture, when a Replay click or the R key got here), starts this
   *   race's music at zero intensity, and arms every mark from the start.
   * @returns {void}
   * @since 2.1.0
   */
  _startLiveAudio() {
    if (isServer || !this._plan) {
      return;
    }
    const plan = this._plan;
    this._audioLive = true;
    this._audioCursor = -this._timeline.countInMs;
    this._audioMarkIndex = 0;
    this._audioIntensity = 0;
    this._finishCued = false;
    this._finishCuePending = false;
    this._withAudio((audio) => {
      audio.unlock();
      audio.startRace({
        mode: plan.mode,
        chaosLevel: plan.mode === 'chaos' ? plan.chaosLevel || null : null,
        durationMs: plan.durationMs
      });
      audio.setIntensity(0);
    });
  }

  /**
   * @description Plays every sound mark the clock has passed since the last frame, and updates
   *   the music's intensity from the Chaos events now overlapping (0 with none, 1 at the level's
   *   cap). Live playback only: after a seek, a skip, an instant result or once the stage has
   *   settled, nothing plays. A jump of more than AUDIO_MAX_CATCH_UP_MS (a hidden tab coming
   *   back) passes its marks silently.
   * @param {number} stageMs - Stage time now.
   * @returns {void}
   * @since 2.1.0
   */
  _playAudioUpTo(stageMs) {
    if (!this._audioLive) {
      return;
    }
    const previous = this._audioCursor;
    if (!(stageMs > previous)) {
      return;
    }
    this._audioCursor = stageMs;
    const jumped = stageMs - previous > AUDIO_MAX_CATCH_UP_MS;
    const marks = this._audioMarks;
    const due = [];
    while (this._audioMarkIndex < marks.length && marks[this._audioMarkIndex].atMs <= stageMs) {
      const mark = marks[this._audioMarkIndex];
      this._audioMarkIndex += 1;
      if (!jumped && mark.atMs > previous) {
        due.push(mark);
      }
    }
    if (due.some((mark) => mark.kind === 'cue' && mark.name === 'finish')) {
      this._finishCued = true;
    }
    const raceMs = raceTimeAt(this._timeline, stageMs);
    const intensity = intensityAt(this._timeline, raceMs, this._audioCap);
    const intensityChanged = intensity !== this._audioIntensity;
    this._audioIntensity = intensity;
    if (stageMs >= this._timeline.settledAtMs) {
      this._audioLive = false;
    }
    if (due.length === 0 && !intensityChanged) {
      return;
    }
    this._withAudio((audio) => {
      if (intensityChanged) {
        audio.setIntensity(intensity);
      }
      due.forEach((mark) => {
        if (mark.kind === 'cue') {
          audio.cue(mark.name);
        } else {
          audio.event(mark.event, mark.phase);
        }
      });
    });
  }

  /**
   * @description Writes the continuous part of a moment straight onto cached elements: every
   *   squirrel's transform, the leaderboard bars, and the transform and opacity of every timed
   *   part of the Chaos visitors and decorations (stage-scrubs.js).
   * @param {number} stageMs - Stage time.
   * @returns {void}
   * @since 1.0.0
   */
  _applyContinuous(stageMs) {
    const reduced = this._isReduced();
    const raceMs = raceTimeAt(this._timeline, stageMs);
    this._racerEls.forEach((element, index) => {
      const spot = racerPlacement(this._plan, this._timeline, index, raceMs, reduced);
      const across = (spot.x * 100).toFixed(2);
      const down = (spot.y * 100).toFixed(2);
      const transform = `translate3d(${across}%, ${down}%, 0)`;
      if (this._racerTransforms[index] !== transform) {
        element.style.transform = transform;
        this._racerTransforms[index] = transform;
      }
    });
    this._fillEls.forEach(({element, index}) => {
      const share = (heightAt(this._plan, index, raceMs) / 100).toFixed(3);
      element.style.transform = `scaleX(${share})`;
    });
    this._scrubEls.forEach((part) => {
      const now = part.clock === 'stage' ? stageMs : raceMs;
      const share = scrubShare(now, part.startMs, part.durationMs);
      const frame = scrubFrame(part.kind, share, reduced, part.shape);
      // Inline values, like the squirrels' transforms: never a paused CSS animation re-timed
      // every frame, so the composited picture always matches the clock.
      if (part.transform !== frame.transform) {
        part.element.style.transform = frame.transform;
        part.transform = frame.transform;
      }
      if (part.opacity !== frame.opacity) {
        part.element.style.opacity = frame.opacity;
        part.opacity = frame.opacity;
      }
    });
  }

  /**
   * @description Works out the discrete part of a moment and re-renders only when it changed.
   *   The first moment in the result view shows the result: announcement, event and focus. In a
   *   packed field it also picks the featured racers, at most once a second.
   * @param {number} stageMs - Stage time.
   * @returns {boolean} True when the stage has settled and the frame loop can stop.
   * @since 1.0.0
   */
  _applyDiscrete(stageMs) {
    this._lastStageMs = stageMs;
    if (phaseAt(this._timeline, stageMs) === 'result' && !this._resultShown) {
      this._showResult(stageMs);
    }
    const options = this._sceneOptions(this._isReduced());
    const scene = sceneAt(this._plan, this._timeline, this._cues, stageMs, options);
    if (!this._scene || scene.signature !== this._scene.signature) {
      this._scene = scene;
    }
    this._updateFeatured(scene, stageMs);
    return scene.settled;
  }

  /**
   * @description Packed band (Chaos v2 contract § 10.2): picks the featured racers, the current
   *   top five by height from the scene's leaderboard, at most once a second of stage time, and
   *   marks them when the set changed. Other bands have none.
   * @param {Object} scene - From sceneAt.
   * @param {number} stageMs - Stage time.
   * @returns {void}
   * @since 2.2.0
   */
  _updateFeatured(scene, stageMs) {
    if (this._band !== 'packed' || !featuredDue(this._featuredAt, stageMs)) {
      return;
    }
    this._featuredAt = stageMs;
    const next = pickFeatured(scene.board);
    if (sameMembers(next, this._featured)) {
      return;
    }
    this._featured = next;
    this._applyFeatured();
  }

  /**
   * @description Puts the is-featured class on the featured racers' elements and takes it off
   *   the rest, straight onto the cached elements: never a re-render of a sprite (contract § 8).
   *   Lit's classMap on the racer leaves a class it did not set alone, so the mark survives
   *   re-renders; a newly made racer element gets it here after the render. Packed band only.
   * @returns {void}
   * @since 2.2.0
   */
  _applyFeatured() {
    if (this._band !== 'packed') {
      return;
    }
    const featured = new Set(this._featured);
    this._racerEls.forEach((element, index) => {
      if (element) {
        element.classList.toggle('is-featured', featured.has(index));
      }
    });
  }

  /**
   * @description The result view has just appeared: fills the live region, asks for focus on the
   *   podium heading and tells the page.
   * @param {number} stageMs - Stage time it appeared at (confetti times from here).
   * @returns {void}
   * @since 1.0.0
   */
  _showResult(stageMs) {
    this._resultShown = true;
    this._resultShownAt = stageMs;
    this._focusPending = true;
    // A race opened straight on its result plays only the finish cue, as the result appears.
    if (this._finishCuePending && !this._finishCued) {
      this._finishCuePending = false;
      this._finishCued = true;
      this._withAudio((audio) => audio.cue('finish'));
    }
    this._announcement = resultAnnouncement({
      plan: this._plan,
      timeline: this._timeline,
      cast: this._cast,
      race: this.race.race,
      i18n
    });
    this.dispatchEvent(new CustomEvent('ss-stage:result-shown', {
      bubbles: true,
      composed: true,
      detail: {raceSysId: this.race.race.sysId || null}
    }));
  }

  /**
   * @description The options sceneAt needs from the element (since 2.2.0 with the race log, for
   *   the scene's log count and the owl's pose).
   * @param {boolean} reduced - Reduced motion is in effect.
   * @returns {Object} The options.
   * @since 1.0.0
   */
  _sceneOptions(reduced) {
    return {
      reduced,
      legendary: this._legendary,
      resultShownMs: this._resultShownAt,
      confettiMs: themeConfig.timings.confettiMs,
      log: this._raceLog
    };
  }

  /**
   * @description Says whether reduced motion is in effect: the reducedMotion property, the
   *   platform's accessibility preference (the reduced-motion attribute AIUXElement mirrors) or the
   *   browser's prefers-reduced-motion.
   * @returns {boolean} True when motion should be reduced.
   * @since 1.0.0
   */
  _isReduced() {
    if (this.reducedMotion) {
      return true;
    }
    if (isServer) {
      return false;
    }
    const prefersReduced = Boolean(this._motionQuery && this._motionQuery.matches);
    return this.hasAttribute('reduced-motion') || prefersReduced;
  }

  /**
   * @description The viewBox height for the kit's trees, from the measured field (a default size
   *   until the browser has measured it), so each tree runs from the ground to the top of the
   *   field with its chestnut where a finished squirrel sits.
   * @param {number} count - Lanes.
   * @returns {number} The viewBox height (see treeViewHeight).
   * @since 1.0.0
   */
  _treeHeight(count) {
    const width = this._fieldWidth || DEFAULT_FIELD.width;
    const height = this._fieldHeight || DEFAULT_FIELD.height;
    return treeViewHeight(width, height, count);
  }

  /**
   * @description Says whether lanes are narrower than the label-rotation threshold (90 px), from
   *   the last measured field width. Unknown until measured.
   * @param {number} count - Lanes.
   * @returns {boolean} True when the labels should rotate.
   * @since 1.0.0
   */
  _lanesNarrow(count) {
    return this._fieldWidth > 0 && this._fieldWidth / count < themeConfig.race.rotateLabelsBelowPx;
  }

  /**
   * @description Starts the resize observer on the host. Browser only.
   * @returns {void}
   * @since 1.0.0
   */
  _observeSize() {
    if (isServer || this._resizeObserver || typeof ResizeObserver !== 'function') {
      return;
    }
    this._resizeObserver = new ResizeObserver(this._onResize);
    this._resizeObserver.observe(this);
  }

  /**
   * @description Measures the field after a resize, and re-renders when the labels need to switch
   *   between flat and rotated or the trees need a new height.
   * @returns {void}
   * @since 1.0.0
   */
  _onResize() {
    const field = this.renderRoot ? this.renderRoot.querySelector('.field') : null;
    const box = field ? field.getBoundingClientRect() : {width: 0, height: 0};
    const unchanged = Math.abs(box.width - this._fieldWidth) < 1
      && Math.abs(box.height - this._fieldHeight) < 1;
    if (unchanged || box.width <= 0 || box.height <= 0) {
      return;
    }
    const count = this._plan ? this._plan.entrants.length : 1;
    const narrowBefore = this._lanesNarrow(count);
    const treeBefore = this._treeHeight(count);
    this._fieldWidth = box.width;
    this._fieldHeight = box.height;
    if (this._lanesNarrow(count) !== narrowBefore || this._treeHeight(count) !== treeBefore) {
      this.requestUpdate();
    }
  }

  /**
   * @description Re-reads the elements the frame loop writes to, after a render may have replaced
   *   them.
   * @returns {void}
   * @since 1.0.0
   */
  _cacheElements() {
    const root = this.renderRoot;
    if (!root || typeof root.querySelectorAll !== 'function') {
      return;
    }
    const racers = [];
    root.querySelectorAll('[data-racer]').forEach((element) => {
      racers[Number.parseInt(element.dataset.racer, 10)] = element;
    });
    this._racerEls = racers;
    this._racerTransforms = [];
    this._fillEls = Array.from(root.querySelectorAll('[data-board-fill]'), (element) => ({
      element,
      index: Number.parseInt(element.dataset.boardFill, 10)
    }));
    this._scrubEls = Array.from(root.querySelectorAll('[data-scrub]'), (element) => ({
      element,
      clock: element.dataset.scrub,
      kind: element.dataset.scrubKind || '',
      startMs: Number(element.dataset.scrubStart),
      durationMs: Math.max(1, Number(element.dataset.scrubDuration)),
      // Where its build-up ends and its fade starts (stage-scrubs.js).
      shape: {
        inShare: readShare(element.dataset.scrubIn, DEFAULT_SHAPE.inShare),
        outShare: readShare(element.dataset.scrubOut, DEFAULT_SHAPE.outShare)
      },
      // The values last written, so an unchanged frame writes nothing.
      transform: null,
      opacity: null
    }));
  }

  /**
   * @description Handles "Skip to result". Inside the click, so the audio may start for the
   *   finish cue.
   * @returns {void}
   * @since 1.0.0
   */
  _onSkipClick() {
    this._withAudio((audio) => audio.unlock());
    this.skip();
  }

  /**
   * @description Handles the result view's four buttons: tells the page which one was pressed.
   *   Replay, Rematch and New race unlock the audio first, inside the click (the browser's
   *   autoplay rule): the replay's sound then starts in restart(), a rematch's when its race
   *   arrives.
   * @param {Event} event - The click.
   * @returns {void}
   * @since 1.0.0
   */
  _onActionClick(event) {
    const target = event.currentTarget;
    const action = target && target.dataset ? target.dataset.action : '';
    if (!RESULT_ACTIONS.includes(action)) {
      return;
    }
    if (UNLOCKING_ACTIONS.includes(action)) {
      this._withAudio((audio) => audio.unlock());
    }
    this.dispatchEvent(new CustomEvent('ss-result:action', {
      bubbles: true,
      composed: true,
      detail: {action}
    }));
  }

  /**
   * @description The M shortcut (Chaos v2 contract § 9): mutes or unmutes the sound. The audio
   *   lane's isSoundShortcut decides what counts (M, no modifier, not held down, not already
   *   handled, not while typing), the same way as on the setup screen, whose own listener stands
   *   down while the race is on. This one marks the key press handled. Unmuting inside the key
   *   press also unlocks the audio.
   * @param {KeyboardEvent} event - The key press.
   * @returns {void}
   * @since 2.1.0
   */
  _onKeyDown(event) {
    if (!isSoundShortcut(event)) {
      return;
    }
    event.preventDefault();
    this._withAudio((audio) => {
      const muting = !audio.isMuted();
      if (!muting) {
        audio.unlock();
      }
      audio.setMuted(muting);
    });
  }
}
