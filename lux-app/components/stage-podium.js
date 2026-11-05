/**
 * The race stage's result view (SPEC.md § 8 result view): the photo-finish freeze-frame stamp,
 * then the podium overlay for the awarded places (medals, large names, each squirrel doing a
 * victory dance picked by its hat), the collapsible full finishing order, the Replay, Rematch,
 * New race and Open record buttons, the race number, CSS-only confetti, and the text the stage
 * announces in its aria-live region.
 *
 * Confetti is seeded from the race, so a replay throws the same confetti. Names are text bindings
 * only. Gaps are shown to two decimals ("0.08 s"), the same on the server render and in the
 * browser.
 *
 * Since 2.2.0 the full race log can sit under the podium as "What happened" (Chaos v2 contract
 * § 11), and the buttons use the stage's own ss-btn classes, never DaisyUI's: the stage drops
 * the Tailwind sheet (contract § 10).
 */
import {html, css, nothing} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {themeConfig} from '../lib/theme-config.js';
import {createRng} from '../lib/rng.js';
import {STAGE_TIMINGS} from './stage-timeline.js';
import {renderBib} from './stage-lanes.js';
import {drawSquirrel, drawConfetti, hasSprite} from './stage-sprites.js';
import {renderWhatHappened} from './stage-commentary.js';

// The four result-view buttons and the action each one reports (ss-result:action).
export const RESULT_ACTIONS = Object.freeze(['replay', 'rematch', 'new', 'open-record']);

// Confetti colours drawn when the sprite kit has no confetti piece.
const CONFETTI_COLOURS = 6;

/**
 * @description A gap in seconds, to two decimals.
 * @param {number} gapMs - The gap in milliseconds.
 * @returns {string} For example '0.08'.
 * @example
 *   seconds(80);
 *   // '0.08'
 * @since 1.0.0
 */
export function seconds(gapMs) {
  return (Math.max(0, gapMs) / 1000).toFixed(2);
}

/**
 * @description The confetti for a race: where each piece starts, when it falls, how it spins.
 *   Seeded, so a replay throws the same confetti; every piece lands within the confetti time.
 * @param {number} seed - A seed derived from the race seed.
 * @param {number} count - Pieces (about 60).
 * @param {number} totalMs - How long confetti stays (4000).
 * @returns {Array<{key: number, x: number, delayMs: number, durationMs: number, spin: number,
 *   drift: number, colour: number, size: number}>} The pieces.
 * @example
 *   confettiPieces(plan.seed + 7, 60, 4000);
 * @since 1.0.0
 */
export function confettiPieces(seed, count, totalMs) {
  const rng = createRng(seed);
  const longest = Math.max(600, Math.floor(totalMs * 0.8));
  return Array.from({length: Math.max(0, count)}, (_value, key) => {
    const durationMs = rng.intBetween(Math.floor(longest * 0.55), longest);
    const delayMs = rng.intBetween(0, Math.max(0, totalMs - durationMs - 100));
    const turn = rng.intBetween(360, 1080);
    return {
      key,
      x: rng.intBetween(0, 100),
      delayMs,
      durationMs,
      spin: rng.chance(0.5) ? turn : -turn,
      drift: rng.intBetween(-12, 12),
      colour: rng.intBetween(0, CONFETTI_COLOURS - 1),
      size: rng.intBetween(6, 12)
    };
  });
}

/**
 * @description The awarded entrants, best first.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object} timeline - From prepareTimeline.
 * @param {Object[]} cast - From buildCast.
 * @returns {Object[]} Cast members for places 1 to timeline.places.
 * @since 1.0.0
 */
function awardedCast(plan, timeline, cast) {
  return plan.finishOrder.slice(0, timeline.places).map((index) => cast[index]);
}

/**
 * @description The result in words, for the aria-live region: the race number, each awarded place
 *   and, when it was one, the photo finish.
 * @param {{plan: Object, timeline: Object, cast: Object[], race: Object,
 *   i18n: {getMessage: Function}}} state - The race.
 * @returns {string} The announcement.
 * @example
 *   resultAnnouncement({plan, timeline, cast, race: payload.race, i18n});
 * @since 1.0.0
 */
export function resultAnnouncement({plan, timeline, cast, race, i18n}) {
  const awarded = awardedCast(plan, timeline, cast);
  const parts = [i18n.getMessage('Result of {number}.', {number: race.number || ''})];
  if (awarded[0]) {
    parts.push(i18n.getMessage('Winner: {name}.', {name: awarded[0].name}));
  }
  if (awarded[1]) {
    parts.push(i18n.getMessage('Runner-up: {name}.', {name: awarded[1].name}));
  }
  if (awarded[2]) {
    parts.push(i18n.getMessage('Third place: {name}.', {name: awarded[2].name}));
  }
  if (timeline.freeze) {
    parts.push(i18n.getMessage('A photo finish, by {gap} seconds.', {
      gap: seconds(timeline.freeze.gapMs)
    }));
  }
  return parts.join(' ');
}

/**
 * @description The photo-finish freeze-frame: a camera flash (not with reduced motion) and the
 *   PHOTO FINISH stamp with the gap. The stage turns sepia underneath.
 * @param {{startMs: number, gapMs: number, flash: boolean}} photo - From sceneAt.
 * @param {{getMessage: Function}} i18n - The AIUX i18n service.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
export function renderPhotoStamp(photo, i18n) {
  // Timed on the stage clock (race time stands still during the hold); stage-scrubs.js.
  const flash = photo.flash
    ? html`<div
      class="photo-flash"
      data-scrub="stage"
      data-scrub-kind="photo-flash"
      data-scrub-start=${photo.startMs}
      data-scrub-duration=${STAGE_TIMINGS.photoFlashMs}
    ></div>`
    : nothing;
  const gap = i18n.getMessage('{gap} s', {gap: seconds(photo.gapMs)});
  return html`<div class="photo" aria-hidden="true" data-testid="photo-finish">
    ${flash}
    <div class="photo-stamp">
      <span class="photo-stamp-title">${i18n.getMessage('PHOTO FINISH')}</span>
      <span class="photo-stamp-gap">${gap}</span>
    </div>
  </div>`;
}

/**
 * @description The CSS-only confetti, about 60 pieces, removed by the stage after four seconds.
 * @param {Object[]} pieces - From confettiPieces.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
function renderConfetti(pieces) {
  const plain = !hasSprite('confettiPiece');
  return html`<div class="confetti" aria-hidden="true">
    ${pieces.map((piece) => html`<span
      class=${classMap({'confetti-piece': true, [`confetti-colour-${piece.colour}`]: plain})}
      style="--x: ${piece.x}; --delay: ${piece.delayMs}; --dur: ${piece.durationMs};
        --spin: ${piece.spin}; --drift: ${piece.drift}; --size: ${piece.size}"
      >${drawConfetti(piece.colour)}</span
    >`)}
  </div>`;
}

/**
 * @description One podium place: medal, the squirrel in its full outfit doing its victory dance,
 *   the name in large type, the place in words and the podium block. The dance comes from the
 *   sprite kit, which picks it by hat in the victory pose (SPEC.md § 8: crown, a royal wave;
 *   viking, a war dance; party hat, a conga; anyone else, a jig).
 * @param {Object} member - The cast member.
 * @param {number} place - 1, 2 or 3.
 * @param {string[]} placeNames - 'Winner', 'Runner-up', 'Third place', translated.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
function renderPlace(member, place, placeNames) {
  const effects = member.legendary ? ['sparkle'] : [];
  return html`<li class="podium-place podium-place-${place}" data-entrant=${member.index}>
    <span class="podium-medal" aria-hidden="true">${themeConfig.emoji.medals[place - 1]}</span>
    <span class="podium-squirrel" aria-hidden="true"
      >${drawSquirrel({...member.fullOutfit, pose: 'victory', effects})}</span
    >
    <span class="podium-name">${member.name}</span>
    <span class="podium-title">${placeNames[place - 1]}</span>
    <span class="podium-block" aria-hidden="true">${renderBib(member, 'chip')}</span>
  </li>`;
}

/**
 * @description The full finishing order: position, squirrel and gap to the winner.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object[]} cast - From buildCast.
 * @param {{getMessage: Function}} i18n - The AIUX i18n service.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
function renderFinishOrder(plan, cast, i18n) {
  const winnerMs = plan.entrants[plan.finishOrder[0]].finishMs;
  return html`<details class="finish-order" data-testid="finish-order">
    <summary class="finish-summary">${i18n.getMessage('Full finishing order')}</summary>
    <div class="finish-scroll">
      <table class="finish-grid">
        <thead>
          <tr>
            <th scope="col">${i18n.getMessage('Position')}</th>
            <th scope="col">${i18n.getMessage('Squirrel')}</th>
            <th scope="col">${i18n.getMessage('Gap to the winner')}</th>
          </tr>
        </thead>
        <tbody>
          ${plan.finishOrder.map((index, place) => {
            const member = cast[index];
            const behindMs = plan.entrants[index].finishMs - winnerMs;
            const gap = place === 0
              ? i18n.getMessage('Winner')
              : i18n.getMessage('+{gap} s', {gap: seconds(behindMs)});
            return html`<tr data-entrant=${index}>
              <td>${place + 1}</td>
              <td>
                <span class="finish-who"
                  >${renderBib(member, 'chip')}<span>${member.name}</span></span
                >
              </td>
              <td>${gap}</td>
            </tr>`;
          })}
        </tbody>
      </table>
    </div>
  </details>`;
}

/**
 * @description "What happened" under the podium, when the caller passed the race log.
 * @param {*} whatHappened - The renderResult option.
 * @param {Object[]} cast - From buildCast.
 * @param {{getMessage: Function}} i18n - The AIUX i18n service.
 * @returns {import('lit').TemplateResult|typeof nothing} The template.
 * @since 2.2.0
 */
function renderLogRecap(whatHappened, cast, i18n) {
  if (!whatHappened || typeof whatHappened !== 'object' || !Array.isArray(whatHappened.entries)) {
    return nothing;
  }
  return renderWhatHappened({
    entries: whatHappened.entries,
    order: whatHappened.order,
    cast,
    i18n
  });
}

/**
 * @description The result view: podium overlay, "What happened" (the full race log, when given),
 *   finishing order, buttons and confetti. The heading takes focus when it appears (the stage
 *   moves it there).
 * @param {{plan: Object, timeline: Object, cast: Object[], race: Object, confetti: boolean,
 *   pieces: Object[], onAction: function(Event): void, i18n: {getMessage: Function},
 *   whatHappened?: ({entries: Object[], order?: string}|null)}} state - What to show, and the
 *   click handler for the four buttons (each carries data-action). whatHappened is optional
 *   (contract § 11, since 2.2.0): the whole race log from buildRaceLog, newest first unless
 *   order is 'oldest'; leave it out for no recap.
 * @returns {import('lit').TemplateResult} The template.
 * @example
 *   renderResult({plan, timeline, cast, race, confetti: true, pieces, onAction, i18n,
 *     whatHappened: {entries: log}});
 * @since 1.0.0
 */
export function renderResult({
  plan,
  timeline,
  cast,
  race,
  confetti,
  pieces,
  onAction,
  i18n,
  whatHappened = null
}) {
  const awarded = awardedCast(plan, timeline, cast);
  const winner = awarded[0];
  const placeNames = [
    i18n.getMessage('Winner'),
    i18n.getMessage('Runner-up'),
    i18n.getMessage('Third place')
  ];
  const labels = {
    replay: i18n.getMessage('Replay'),
    rematch: i18n.getMessage('Rematch'),
    new: i18n.getMessage('New race'),
    'open-record': i18n.getMessage('Open record')
  };
  const photoNote = timeline.freeze
    ? html`<p class="result-photo">
      ${i18n.getMessage('Photo finish: {gap} s', {gap: seconds(timeline.freeze.gapMs)})}
    </p>`
    : nothing;
  return html`<section class="result" aria-labelledby="podium-heading" data-testid="result-view">
    <div class="result-panel">
      <p class="result-race" data-testid="result-race-number">${race.number || ''}</p>
      <h2 id="podium-heading" class="result-heading" tabindex="-1">
        ${i18n.getMessage('{name} wins!', {name: winner ? winner.name : ''})}
      </h2>
      ${photoNote}
      <ol class="podium" data-testid="podium">
        ${awarded.map((member, slot) => renderPlace(member, slot + 1, placeNames))}
      </ol>
      ${renderLogRecap(whatHappened, cast, i18n)}
      ${renderFinishOrder(plan, cast, i18n)}
      <div class="result-actions">
        ${RESULT_ACTIONS.map((action) => html`<button
          type="button"
          class=${classMap({
            'ss-btn': true,
            'ss-btn-primary': action === 'replay',
            'ss-btn-outline': action !== 'replay'
          })}
          data-action=${action}
          data-testid="result-${action}"
          @click=${onAction}
        >${labels[action]}</button>`)}
      </div>
    </div>
    ${confetti ? renderConfetti(pieces) : nothing}
  </section>`;
}

/** The result view's styles. */
export const podiumStyles = css`
  .field.is-frozen {
    filter: sepia(0.85) contrast(1.05);
  }

  .field.is-frozen *,
  .field.is-frozen *::before,
  .field.is-frozen *::after {
    animation-play-state: paused;
  }

  /* The freeze-frame holds the race, not the stamp that announces it. */
  .field.is-frozen .photo,
  .field.is-frozen .photo * {
    animation-play-state: running;
  }

  .photo {
    position: absolute;
    inset: 0;
    z-index: 8;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .photo-flash {
    position: absolute;
    inset: 0;
    background-color: var(--ss-flash);
    opacity: 0;
  }

  .photo-stamp {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.5rem 1.5rem;
    border: 4px solid var(--ss-stamp-ink);
    border-radius: 8px;
    color: var(--ss-stamp-ink);
    background-color: var(--ss-stamp-paper);
    transform: rotate(-8deg);
    animation: stage-stamp 400ms var(--ease-heavy-bounce, ease-out) both;
  }

  .photo-stamp-title {
    font-size: clamp(1.4rem, 5vh, 3rem);
    font-weight: 900;
    letter-spacing: 0.08em;
  }

  .photo-stamp-gap {
    font-family: ui-monospace, monospace;
    font-size: clamp(1rem, 3vh, 1.8rem);
    font-weight: 700;
  }

  .result {
    position: absolute;
    inset: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem;
    background-color: var(--ss-veil);
  }

  .result-panel {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    width: min(46rem, 100%);
    max-height: 100%;
    overflow: auto;
    padding: 1rem 1.25rem;
    border-radius: 16px;
    color: var(--ss-panel-ink);
    background-color: var(--ss-panel);
    box-shadow: 0 12px 40px var(--ss-hud-shadow);
  }

  .result-race {
    margin: 0;
    font-family: ui-monospace, monospace;
    font-size: 0.9rem;
    font-weight: 700;
  }

  .result-heading {
    margin: 0;
    font-size: clamp(1.4rem, 4vh, 2.4rem);
    font-weight: 900;
    line-height: 1.15;
    text-align: center;
    overflow-wrap: anywhere;
  }

  .result-heading:focus {
    outline: none;
  }

  .result-heading:focus-visible {
    outline: 3px solid var(--ss-focus);
    outline-offset: 4px;
  }

  .result-photo {
    margin: 0;
    font-weight: 700;
  }

  .podium {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 0.75rem;
    width: 100%;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .podium-place {
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    align-items: center;
    min-width: 0;
    max-width: 14rem;
    text-align: center;
  }

  .podium-place-1 {
    order: 2;
  }

  .podium-place-2 {
    order: 1;
  }

  .podium-place-3 {
    order: 3;
  }

  .podium-medal {
    font-size: clamp(1.6rem, 4.5vh, 2.6rem);
    line-height: 1;
  }

  .podium-squirrel {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    width: clamp(56px, 13vh, 110px);
    height: clamp(56px, 13vh, 110px);
    font-size: clamp(2.5rem, 9vh, 5rem);
    transform-origin: 50% 100%;
  }

  .podium-squirrel svg {
    width: 100%;
    height: 100%;
  }

  .podium-name {
    max-width: 100%;
    font-size: clamp(1.05rem, 3vh, 1.6rem);
    font-weight: 800;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  .podium-place-1 .podium-name {
    font-size: clamp(1.25rem, 3.8vh, 2rem);
  }

  .podium-title {
    font-size: 0.8rem;
    font-weight: 600;
  }

  .podium-block {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    width: 100%;
    margin-top: 0.3rem;
    padding-top: 0.35rem;
    border-radius: 8px 8px 0 0;
    background-color: var(--ss-podium);
  }

  .podium-place-1 .podium-block {
    height: clamp(40px, 9vh, 80px);
  }

  .podium-place-2 .podium-block {
    height: clamp(30px, 6.5vh, 58px);
  }

  .podium-place-3 .podium-block {
    height: clamp(22px, 5vh, 44px);
  }

  .finish-order {
    width: 100%;
  }

  .finish-summary {
    cursor: pointer;
    font-weight: 700;
  }

  .finish-scroll {
    max-height: 30vh;
    margin-top: 0.4rem;
    overflow: auto;
  }

  .finish-grid {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  .finish-grid th,
  .finish-grid td {
    padding: 0.2rem 0.4rem;
    border-bottom: 1px solid var(--ss-rule);
    text-align: left;
  }

  .finish-who {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    overflow-wrap: anywhere;
  }

  .result-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }

  .confetti {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .confetti-piece {
    position: absolute;
    top: -4%;
    left: calc(var(--x) * 1%);
    width: calc(var(--size) * 1px);
    height: calc(var(--size) * 1.6px);
    animation: stage-confetti-fall calc(var(--dur) * 1ms) linear calc(var(--delay) * 1ms) both;
  }

  .confetti-piece svg {
    width: 100%;
    height: 100%;
  }

  .confetti-colour-0 {
    background-color: var(--ss-confetti-0);
  }

  .confetti-colour-1 {
    background-color: var(--ss-confetti-1);
  }

  .confetti-colour-2 {
    background-color: var(--ss-confetti-2);
  }

  .confetti-colour-3 {
    background-color: var(--ss-confetti-3);
  }

  .confetti-colour-4 {
    background-color: var(--ss-confetti-4);
  }

  .confetti-colour-5 {
    background-color: var(--ss-confetti-5);
  }

  @keyframes stage-stamp {
    from {
      transform: rotate(-8deg) scale(2.4);
      opacity: 0;
    }
    to {
      transform: rotate(-8deg) scale(1);
      opacity: 1;
    }
  }

  @keyframes stage-confetti-fall {
    from {
      transform: translate(0, 0) rotate(0deg);
      opacity: 1;
    }
    85% {
      opacity: 1;
    }
    to {
      transform: translate(calc(var(--drift) * 1vw), 110cqh) rotate(calc(var(--spin) * 1deg));
      opacity: 0;
    }
  }
`;
