/**
 * The race stage's commentary extras (Chaos v2 contract § 11 and § 12): the owl commentator's
 * booth at the left end of the commentary banner, the "Race log" panel under the leaderboard, and
 * the full log as "What happened" on the result view.
 *
 * The booth is decorative (aria-hidden). Its pose comes from the discrete scene through
 * commentatorPoseAt (lib/race-log.js, re-exported here), and a pose change only changes the
 * sprite root's class: the SVG itself is never re-rendered.
 *
 * The log is plain HTML with no animated SVG (§ 10): each entry shows the race clock as text, a
 * short bold title, then the line with every named squirrel as its bib chip and name. The newest
 * entry sits on top and is highlighted for highlightMs (opacity only, on a pseudo-element); with
 * reduced motion it stays highlighted until the next entry and nothing slides in. The rows only
 * re-render when the number of entries shown changes. role="log" with aria-live="off": the
 * commentary banner stays the one announcement channel.
 *
 * Nothing here uses Tailwind or DaisyUI classes: the stage drops that sheet (contract § 10).
 * Colours come from the stage's own tokens and the inherited theme tokens, with literal
 * fallbacks, through custom properties.
 */
import {html, css, nothing} from 'lit';
import {guard} from 'lit/directives/guard.js';
import {repeat} from 'lit/directives/repeat.js';
import {classMap} from 'lit/directives/class-map.js';
import {themeConfig} from '../lib/theme-config.js';
import {commentatorPoseAt, logCountAt, raceClock} from '../lib/race-log.js';
import {logLineParts, logListWords, translateLogTitle} from './phrases.js';
import {renderBib} from './stage-lanes.js';
import {owlCommentatorSprite, OWL_COMMENTATOR_POSE_IDS} from './sprites/booth.js';

export {commentatorPoseAt};

/**
 * @description Says whether the owl is on air in a pose (the ON AIR light is lit).
 * @param {string} pose - 'idle', 'talk', 'gasp' or 'cheer'.
 * @returns {boolean} True for every pose but idle.
 * @since 2.2.0
 */
function onAir(pose) {
  return pose !== 'idle';
}

/**
 * @description The owl commentator's booth (contract § 12), for the left end of the commentary
 *   banner. Decorative: the banner carries the words. Only the sprite root's pose class and the
 *   booth's data-pose change between poses.
 * @param {{pose?: string, i18n: {getMessage: Function}}} state - The pose from
 *   commentatorPoseAt ('idle' when missing or unknown), and the AIUX i18n service.
 * @returns {import('lit').TemplateResult} The template.
 * @example
 *   renderOwlBooth({pose: scene.owlPose, i18n});
 * @since 2.2.0
 */
export function renderOwlBooth({pose = 'idle', i18n} = {}) {
  const poseId = OWL_COMMENTATOR_POSE_IDS.includes(pose) ? pose : 'idle';
  const label = i18n && typeof i18n.getMessage === 'function' ? i18n.getMessage('ON AIR') : '';
  return html`<div
    class="owl-booth"
    aria-hidden="true"
    data-testid="owl-booth"
    data-pose=${poseId}
    data-on-air=${onAir(poseId) ? 'true' : 'false'}
  >${owlCommentatorSprite({pose: poseId, onAirLabel: label})}</div>`;
}

/**
 * @description The squirrels in one name slot of a log line, each as its bib chip and name,
 *   joined the reader's way ("Alex, Sam and Jo"). Falls back to the entry's own text for the
 *   slot when the cast does not have them.
 * @param {number[]} indexes - The entrant indexes, in order.
 * @param {string} fallback - The slot's filled-in text.
 * @param {Object[]} cast - From buildCast.
 * @param {{separator: string, conjunction: string}} words - From logListWords.
 * @returns {*} A Lit-renderable value.
 * @since 2.2.0
 */
function renderNames(indexes, fallback, cast, words) {
  const members = indexes.map((index) => (Array.isArray(cast) ? cast[index] : null))
    .filter((member) => member && typeof member === 'object');
  if (members.length !== indexes.length) {
    return fallback;
  }
  const last = members.length - 1;
  return members.map((member, position) => {
    let joiner = '';
    if (position > 0) {
      joiner = position === last ? words.conjunction : words.separator;
    }
    return html`${joiner}<span class="race-log-who"
      >${renderBib(member, 'chip')}<span class="race-log-who-name">${member.name}</span></span
    >`;
  });
}

/**
 * @description One entry's line: the translated words with each named squirrel as its chip.
 * @param {Object} entry - From buildRaceLog.
 * @param {Object[]} cast - From buildCast.
 * @param {{getMessage: Function}} i18n - The AIUX i18n service.
 * @param {{separator: string, conjunction: string}} words - From logListWords.
 * @returns {Array<*>} Lit-renderable parts.
 * @since 2.2.0
 */
function renderLine(entry, cast, i18n, words) {
  const params = entry.params && typeof entry.params === 'object' ? entry.params : {};
  return logLineParts(i18n, entry).map((part) => {
    if (part.kind !== 'names') {
      return part.text;
    }
    const fallback = typeof params[part.slot] === 'string' ? params[part.slot] : '';
    return renderNames(part.indexes, fallback, cast, words);
  });
}

/**
 * @description One log row: the race clock, the short title and the line. The newest row of the
 *   live log carries is-newest and its age as a negative animation delay, so a seek lands its
 *   highlight part-way through (or already over).
 * @param {Object} entry - From buildRaceLog.
 * @param {{cast: Object[], i18n: {getMessage: Function}, words: Object, newest: boolean,
 *   delayMs: number}} context - What the row needs.
 * @returns {import('lit').TemplateResult} The template.
 * @since 2.2.0
 */
function renderRow(entry, {cast, i18n, words, newest, delayMs}) {
  const classes = {'race-log-entry': true, 'is-newest': newest};
  return html`<li
    class=${classMap(classes)}
    data-entry=${entry.id}
    data-kind=${entry.kind}
    style="--race-log-delay: ${delayMs}ms"
  >
    <span class="race-log-time">${raceClock(entry.atMs)}</span>
    <span class="race-log-body"
      ><strong class="race-log-title">${translateLogTitle(i18n, entry)}</strong>
      <span class="race-log-line">${renderLine(entry, cast, i18n, words)}</span></span
    >
  </li>`;
}

/**
 * @description The rows, newest first.
 * @param {Object[]} shown - The entries to show, oldest first.
 * @param {{cast: Object[], i18n: {getMessage: Function}, raceMs: number,
 *   highlight: boolean}} context - The cast, the i18n service, the race time (for the newest
 *   row's age) and whether the newest row is highlighted.
 * @returns {import('lit').TemplateResult} The template.
 * @since 2.2.0
 */
function renderRows(shown, {cast, i18n, raceMs, highlight}) {
  const words = logListWords(i18n);
  const newestId = highlight && shown.length > 0 ? shown[shown.length - 1].id : null;
  const newestAge = newestId !== null && Number.isFinite(raceMs)
    ? Math.max(0, Math.round(raceMs - shown[shown.length - 1].atMs))
    : 0;
  const rows = shown.slice().reverse();
  return html`<ol class="race-log-list">
    ${repeat(rows, (entry) => entry.id, (entry) => {
      const newest = entry.id === newestId;
      return renderRow(entry, {cast, i18n, words, newest, delayMs: newest ? -newestAge : 0});
    })}
  </ol>`;
}

/**
 * @description The "Race log" panel for the board column, under the leaderboard (contract § 11):
 *   the entries that have appeared, newest first. The rows only re-render when the number shown
 *   changes (a seek, a skip or a replay recomputes it).
 * @param {{entries: Object[], count?: number, raceMs?: number, cast: Object[],
 *   i18n: {getMessage: Function}, highlightMs?: number}} state - The whole race log (from
 *   buildRaceLog), how many have appeared (the discrete scene's count; worked out from raceMs
 *   when missing), the race time, the cast, the AIUX i18n service and how long the newest entry
 *   stays highlighted (the theme's raceLog.highlightMs by default).
 * @returns {import('lit').TemplateResult} The template.
 * @example
 *   renderRaceLog({entries: log, count: scene.logCount, raceMs: scene.raceMs, cast, i18n});
 * @since 2.2.0
 */
export function renderRaceLog({
  entries,
  count,
  raceMs,
  cast,
  i18n,
  highlightMs = themeConfig.raceLog.highlightMs
} = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const shownCount = Number.isInteger(count)
    ? Math.max(0, Math.min(count, list.length))
    : logCountAt(list, raceMs);
  const highlight = Number.isFinite(highlightMs) && highlightMs > 0 ? highlightMs : 0;
  // The scroll container takes focus (tabindex 0, contract § 11): a scrollable log must be
  // reachable by keyboard, so the non-interactive tabindex check is skipped on purpose.
  return html`<div
    class="race-log"
    data-testid="race-log"
    data-count=${shownCount}
    style="--race-log-highlight: ${highlight}ms"
  >
    <h2 id="race-log-heading" class="race-log-heading">${i18n.getMessage('Race log')}</h2>
    <div
      class="race-log-scroll"
      role="log"
      aria-live="off"
      aria-labelledby="race-log-heading"
      tabindex="0"
      data-a11y-skip
    >
      ${guard([list, shownCount, cast, i18n], () => renderRows(list.slice(0, shownCount), {
        cast,
        i18n,
        raceMs,
        highlight: highlight > 0
      }))}
    </div>
  </div>`;
}

/**
 * @description The full race log on the result view, as "What happened" (contract § 11), under
 *   the podium. No highlight. Newest first like the live log, or oldest first on request.
 * @param {{entries: Object[], cast: Object[], i18n: {getMessage: Function},
 *   order?: string}} state - The whole race log, the cast, the AIUX i18n service, and 'newest'
 *   (default) or 'oldest' first.
 * @returns {import('lit').TemplateResult|typeof nothing} The template, or nothing for an empty
 *   log.
 * @example
 *   renderWhatHappened({entries: log, cast, i18n});
 * @since 2.2.0
 */
export function renderWhatHappened({entries, cast, i18n, order = 'newest'} = {}) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) {
    return nothing;
  }
  const words = logListWords(i18n);
  const rows = order === 'oldest' ? list : list.slice().reverse();
  // The scroll container takes focus (tabindex 0): a scrollable list must be reachable by
  // keyboard, so the non-interactive tabindex check is skipped on purpose.
  return html`<section class="what-happened" data-testid="what-happened">
    <h3 id="what-happened-heading" class="race-log-heading">
      ${i18n.getMessage('What happened')}
    </h3>
    <div
      class="race-log-scroll"
      role="region"
      aria-labelledby="what-happened-heading"
      tabindex="0"
      data-a11y-skip
    >
      <ol class="race-log-list">
        ${repeat(rows, (entry) => entry.id, (entry) => renderRow(entry, {
          cast,
          i18n,
          words,
          newest: false,
          delayMs: 0
        }))}
      </ol>
    </div>
  </section>`;
}

/**
 * The booth's, the race log's and What happened's styles. Own classes only (no Tailwind or
 * DaisyUI). Colours are custom properties resolved from the stage's tokens, then the inherited
 * theme tokens, then a literal.
 * @since 2.2.0
 */
export const commentaryStyles = css`
  /* The owl's booth (contract § 12): 64 to 88 px in the roomy band, at least 44 px. */
  .owl-booth {
    --owl-booth-size: clamp(64px, 9vh, 88px);
    flex: none;
    width: var(--owl-booth-size);
    height: var(--owl-booth-size);
    overflow: hidden;
    border-radius: 8px;
    box-shadow: 0 2px 8px var(--ss-hud-shadow);
  }

  .stage:is(.band-busy, .band-packed) .owl-booth {
    --owl-booth-size: clamp(44px, 7vh, 64px);
  }

  /* A big screen (a presenter's display) gets a bigger owl. */
  @media (min-width: 1800px) and (min-height: 1000px) {
    .stage.band-roomy .owl-booth {
      --owl-booth-size: clamp(88px, 10vh, 128px);
    }
  }

  .owl-booth svg {
    width: 100%;
    height: 100%;
  }

  /* The stage's own reduced-motion switch: the owl holds its idle drawing (the sprite sheet
     does the same for the media query); only the ON AIR light shows it is talking. */
  .reduce .owl-booth .ss-owl-commentator
    :is(.oc-eyes-wide, .oc-ruffle, .oc-eyes-happy, .oc-wings-up, .oc-lids),
  :host([reduced-motion]) .owl-booth .ss-owl-commentator
    :is(.oc-eyes-wide, .oc-ruffle, .oc-eyes-happy, .oc-wings-up, .oc-lids) {
    opacity: 0;
  }

  .reduce .owl-booth .ss-owl-commentator .oc-wings-down,
  :host([reduced-motion]) .owl-booth .ss-owl-commentator .oc-wings-down {
    opacity: 1;
  }

  .reduce .owl-booth .ss-owl-commentator .oc-beak-lower,
  :host([reduced-motion]) .owl-booth .ss-owl-commentator .oc-beak-lower {
    transform: none;
  }

  /* The race log, filling the board column under the leaderboard (contract § 11). */
  .race-log,
  .what-happened {
    --race-log-rule: var(--ss-rule, rgba(0, 0, 0, 0.12));
    --race-log-flash: var(--color-primary, #1f4e9e);
    --race-log-focus: var(--ss-focus, var(--color-primary, #1f4e9e));
    min-width: 0;
  }

  /* Opaque paper on purpose (never the board's see-through white): the log stops above the
     walkers' band, so nothing needs to show through it. */
  .race-log {
    --race-log-ink: var(--ss-board-ink, var(--color-base-content, #1a1a1a));
    --race-log-paper: var(--ss-race-log-paper, #ffffff);
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    min-height: 0;
    padding: 0.5rem;
    border-radius: 10px;
    color: var(--race-log-ink);
    background-color: var(--race-log-paper);
  }

  .race-log-heading {
    flex: none;
    margin: 0 0 0.35rem;
    font-size: 0.8rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .race-log-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    border-radius: 6px;
  }

  .race-log-scroll:focus {
    outline: none;
  }

  .race-log-scroll:focus-visible {
    outline: 2px solid var(--race-log-focus);
    outline-offset: 2px;
  }

  .race-log-list {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .race-log-entry {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: baseline;
    column-gap: 0.4rem;
    padding: 0.25rem 0.3rem;
    border-bottom: 1px solid var(--race-log-rule);
    font-size: 0.78rem;
    line-height: 1.4;
  }

  .race-log-entry:last-child {
    border-bottom: none;
  }

  /* The newest entry's highlight: a tinted layer that fades out over highlightMs. */
  .race-log-entry.is-newest::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 6px;
    background-color: var(--race-log-flash);
    opacity: 0.2;
    pointer-events: none;
    animation: race-log-fade var(--race-log-highlight, 1500ms) linear
      var(--race-log-delay, 0ms) both;
  }

  .race-log-entry.is-newest {
    animation: race-log-in var(--duration-md, 240ms) var(--ease-enter, ease-out)
      var(--race-log-delay, 0ms) both;
  }

  .race-log-time,
  .race-log-body {
    position: relative;
  }

  .race-log-time {
    font-family: ui-monospace, monospace;
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .race-log-body {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .race-log-title {
    margin-right: 0.3rem;
    font-weight: 800;
  }

  .race-log-who-name {
    font-weight: 700;
  }

  .race-log-who .bib {
    height: 1.05rem;
    min-width: 1.05rem;
    margin-right: 0.2rem;
    font-size: 0.62rem;
    vertical-align: -0.2em;
  }

  .stage.band-packed .race-log-entry {
    font-size: 0.72rem;
  }

  /* What happened, on the result view under the podium. */
  .what-happened {
    align-self: stretch;
    display: flex;
    flex-direction: column;
    text-align: start;
  }

  .what-happened .race-log-scroll {
    max-height: min(14rem, 30vh);
    padding-right: 0.25rem;
  }

  @keyframes race-log-fade {
    from {
      opacity: 0.2;
    }
    to {
      opacity: 0;
    }
  }

  @keyframes race-log-in {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* No slide-in with reduced motion; the newest entry stays highlighted until the next one. */
  @media (prefers-reduced-motion: reduce) {
    .race-log-entry.is-newest,
    .race-log-entry.is-newest::before {
      animation: none;
    }
  }
`;
