/**
 * The race stage's heads-up display (SPEC.md § 8 race view): the race number and title (with the
 * chaos level beside the number in a Chaos race, Chaos v2 contract § 1), one line of commentary
 * across the top, the replay or VOID banner, the 3-2-1 count-in, the live top-five leaderboard on
 * the right and the woodland crowd along the ground (bobbing in rubber rings in a flood, falling
 * like dominoes in an earthquake, dancing at the disco).
 *
 * The leaderboard's height bars are filled by the stage every frame (data-board-fill), straight
 * onto the element; the rows themselves only re-render when the order changes. Names are text
 * bindings only.
 *
 * Nothing important plays hidden (Chaos v2 contract § 8): the leaderboard takes at most the top
 * 55% of its column, and the race HUD's tools (the sound toggle, contract § 9, and "Skip to
 * result") sit top right over the head.
 *
 * Since 2.2.0 (contract § 11, § 12) the head can seat the owl commentator's booth at the left end
 * of the commentary banner, which then becomes the owl's speech bubble, and the board column can
 * carry the "Race log" under the leaderboard (components/stage-commentary.js), stopping above the
 * walkers' band at the bottom of the column. Both are optional, so existing callers render as
 * before. The HUD uses its own button classes (ss-btn), never
 * DaisyUI's: the stage drops the Tailwind sheet (contract § 10).
 */
import {html, css, nothing} from 'lit';
import {keyed} from 'lit/directives/keyed.js';
import {repeat} from 'lit/directives/repeat.js';
import {classMap} from 'lit/directives/class-map.js';
import {renderBib} from './stage-lanes.js';
import {drawCrowdAnimal, drawRubberRing} from './stage-sprites.js';
import {renderOwlBooth, renderRaceLog} from './stage-commentary.js';

// Spectators along the ground: the theme's five animals, twice over.
const CROWD_SIZE = 10;

/**
 * @description The banner under the commentary: VOID for a voided race (SPEC.md § 8 result view),
 *   otherwise "Replay of …" when the stage is replaying a stored race, otherwise nothing.
 * @param {Object} race - The payload's race object.
 * @param {boolean} replay - The stage is replaying a stored race.
 * @param {{getMessage: Function}} i18n - The AIUX i18n service.
 * @returns {import('lit').TemplateResult|typeof nothing} The template.
 * @since 1.0.0
 */
function renderBanner(race, replay, i18n) {
  if (race.state === 'void') {
    return html`<p class="stage-banner is-void" data-testid="void-banner">
      ${i18n.getMessage('VOID: this race was voided and does not count.')}
    </p>`;
  }
  if (!replay) {
    return nothing;
  }
  const text = i18n.getMessage('Replay of {number}, run by {runBy} on {runOn}', {
    number: race.number || '',
    runBy: race.runBy || '',
    runOn: race.runOn || ''
  });
  return html`<p class="stage-banner is-replay" data-testid="replay-banner">${text}</p>`;
}

/**
 * @description The chaos level's label (Chaos v2 contract § 1): Mild, Silly or Absolute Carnage.
 *   An unknown or missing level reads as Silly, the default.
 * @param {string} level - 'mild', 'silly' or 'carnage'.
 * @param {{getMessage: Function}} i18n - The AIUX i18n service.
 * @returns {string} The label.
 * @since 1.0.0
 */
function chaosLevelLabel(level, i18n) {
  if (level === 'mild') {
    return i18n.getMessage('Mild');
  }
  if (level === 'carnage') {
    return i18n.getMessage('Absolute Carnage');
  }
  return i18n.getMessage('Silly');
}

/**
 * @description The chaos level chip beside the race number, in a Chaos race only.
 * @param {string} chaosLevel - The race's level (the plan's, else the payload's).
 * @param {string} mode - The plan's mode.
 * @param {{getMessage: Function}} i18n - The AIUX i18n service.
 * @returns {import('lit').TemplateResult|typeof nothing} The template.
 * @since 1.0.0
 */
function renderChaosLevel(chaosLevel, mode, i18n) {
  if (mode !== 'chaos') {
    return nothing;
  }
  const level = ['mild', 'silly', 'carnage'].includes(chaosLevel) ? chaosLevel : 'silly';
  const text = i18n.getMessage('Chaos: {level}', {level: chaosLevelLabel(level, i18n)});
  return html`<span class="race-chaos" data-testid="chaos-level" data-level=${level}
    >${text}</span
  >`;
}

/**
 * @description The top of the stage: race number and title (with the chaos level in a Chaos
 *   race), the commentary line and the banner. With an owl (contract § 12, since 2.2.0) the
 *   commentator's booth sits at the left end of the commentary line, which becomes its speech
 *   bubble; the line's text and markup are otherwise unchanged.
 * @param {{race: Object, replay: boolean, cueText: string, cueIndex: number, phase: string,
 *   mode?: string, chaosLevel?: string, i18n: {getMessage: Function},
 *   owl?: ({pose: string}|null)}} state - What to show. owl is optional: its pose comes from
 *   commentatorPoseAt (components/stage-commentary.js); leave it out for no booth.
 * @returns {import('lit').TemplateResult} The template.
 * @example
 *   renderHead({race, replay: false, cueText: 'And they’re off!', cueIndex: 0, phase: 'race',
 *     mode: 'chaos', chaosLevel: 'carnage', i18n, owl: {pose: 'talk'}});
 * @since 1.0.0
 */
export function renderHead({
  race,
  replay,
  cueText,
  cueIndex,
  phase,
  mode,
  chaosLevel,
  i18n,
  owl = null
}) {
  const line = phase === 'countdown' ? i18n.getMessage('On your marks…') : cueText;
  const withOwl = Boolean(owl && typeof owl === 'object');
  const commentary = html`<p
    class=${classMap({commentary: true, 'has-owl': withOwl})}
    data-testid="commentary"
  >
    ${keyed(`${phase}-${cueIndex}`, html`<span class="cue">${line}</span>`)}
  </p>`;
  const middle = withOwl
    ? html`<div class="commentary-stand">
      ${renderOwlBooth({pose: owl.pose, i18n})}${commentary}
    </div>`
    : commentary;
  return html`<div class="stage-head">
    <p class="race-tag">
      <span class="race-line">
        <span class="race-number" data-testid="race-number">${race.number || ''}</span>
        ${renderChaosLevel(chaosLevel, mode, i18n)}
      </span>
      <span class="race-title">${race.title || ''}</span>
    </p>
    ${middle}
    ${renderBanner(race, replay, i18n)}
  </div>`;
}

/**
 * @description The race HUD's tools, top right over the head: the sound toggle (Chaos v2
 *   contract § 9; <ss-sound-toggle compact>, icon only with its label for screen readers, is
 *   defined by components/audio/sound-toggle.js, which the stage imports) and, until the result
 *   is in, "Skip to result". They sit above the result view's veil, so the sound can be muted
 *   during the fanfare.
 * @param {{showSkip: boolean, onSkip: function(Event): void,
 *   i18n: {getMessage: Function}}} state - Whether to offer the skip, its click handler, and the
 *   AIUX i18n service.
 * @returns {import('lit').TemplateResult} The template.
 * @example
 *   renderHudTools({showSkip: true, onSkip: this._onSkipClick, i18n});
 * @since 2.1.0
 */
export function renderHudTools({showSkip, onSkip, i18n}) {
  const skip = showSkip
    ? html`<button
      type="button"
      class="ss-btn ss-btn-sm ss-btn-neutral skip-button"
      data-testid="skip"
      @click=${onSkip}
    >${i18n.getMessage('Skip to result')}</button>`
    : nothing;
  return html`<div class="hud-tools" data-testid="hud-tools">
    <ss-sound-toggle compact></ss-sound-toggle>
    ${skip}
  </div>`;
}

/**
 * @description The 3-2-1 count-in, then "Go!".
 * @param {number} countIn - 3, 2, 1, or 0 for "Go!".
 * @param {{getMessage: Function}} i18n - The AIUX i18n service.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
export function renderCountIn(countIn, i18n) {
  const shown = countIn === 0 ? i18n.getMessage('Go!') : countIn;
  const classes = {'count-in-number': true, 'is-go': countIn === 0};
  return html`<div class="count-in" aria-hidden="true" data-testid="count-in">
    ${keyed(countIn, html`<span class=${classMap(classes)}>${shown}</span>`)}
  </div>`;
}

/**
 * @description The "Race log" under the leaderboard, when the caller asked for one, and below it
 *   an empty, unseen spacer that keeps the bottom of the board column clear for the ground
 *   walkers (WALKER_BAND_CQH in stage-timeline.js), so a walker leaving the field is seen going.
 * @param {*} log - extras.log from renderBoard.
 * @param {Object[]} cast - From buildCast.
 * @param {{getMessage: Function}} i18n - The AIUX i18n service.
 * @returns {import('lit').TemplateResult|typeof nothing} The template.
 * @since 2.2.0
 */
function renderBoardLog(log, cast, i18n) {
  if (!log || typeof log !== 'object' || !Array.isArray(log.entries)) {
    return nothing;
  }
  const raceLog = renderRaceLog({
    entries: log.entries,
    count: log.count,
    raceMs: log.raceMs,
    highlightMs: log.highlightMs,
    cast,
    i18n
  });
  return html`${raceLog}<div class="race-log-clearance" aria-hidden="true"></div>`;
}

/**
 * @description The live top-five leaderboard: finished squirrels first by position, then the rest
 *   by height (SPEC.md § 11.10). Each row carries the bib chip, so colour is not the only cue.
 *   With extras.log (contract § 11, since 2.2.0) the "Race log" follows it, filling the board
 *   column down to the walkers' clearance at its bottom.
 * @param {Array<{entrantIndex: number, finished: boolean, position: (number|null)}>} board -
 *   From sceneAt.
 * @param {Object[]} cast - From buildCast.
 * @param {{getMessage: Function}} i18n - The AIUX i18n service.
 * @param {{log?: {entries: Object[], count?: number, raceMs?: number,
 *   highlightMs?: number}}} [extras] - Optional. log: the whole race log (buildRaceLog), how
 *   many entries have appeared (the discrete scene's count; worked out from raceMs when
 *   missing), the race time and the highlight length (the theme's by default).
 * @returns {import('lit').TemplateResult} The template.
 * @example
 *   renderBoard(scene.board, cast, i18n, {log: {entries: log, count: scene.logCount,
 *     raceMs: scene.raceMs}});
 * @since 1.0.0
 */
export function renderBoard(board, cast, i18n, extras = {}) {
  const log = extras && typeof extras === 'object' ? extras.log : null;
  return html`<section class="board" aria-labelledby="board-title" data-testid="leaderboard">
    <h2 id="board-title" class="board-title">${i18n.getMessage('Leaders')}</h2>
    <ol class="board-rows">
      ${repeat(board, (row) => row.entrantIndex, (row, rank) => {
        const member = cast[row.entrantIndex];
        if (!member) {
          return nothing;
        }
        return html`<li
          class=${classMap({'board-row': true, 'is-home': row.finished})}
          data-entrant=${row.entrantIndex}
        >
          <span class="board-rank" aria-hidden="true">${rank + 1}</span>
          ${renderBib(member, 'chip')}
          <span class="board-name" title=${member.name}>${member.name}</span>
          ${row.finished
            ? html`<span class="board-home">${i18n.getMessage('Home')}</span>`
            : nothing}
          <span class="board-bar" aria-hidden="true"
            ><span class="board-fill" data-board-fill=${row.entrantIndex}></span
          ></span>
        </li>`;
      })}
    </ol>
  </section>${renderBoardLog(log, cast, i18n)}`;
}

/**
 * @description One spectator, in a rubber ring during a flood (the kit's ring, or the animal over
 *   a plain ring without it).
 * @param {string} kind - The crowd animal.
 * @param {string} pose - Its pose.
 * @param {boolean} ringed - In a rubber ring.
 * @returns {*} A Lit-renderable value.
 * @since 1.0.0
 */
function spectator(kind, pose, ringed) {
  const animal = drawCrowdAnimal(kind, pose);
  if (!ringed) {
    return animal;
  }
  return drawRubberRing(kind, pose, html`<span class="crowd-ring-stand"
    >${animal}<span class="crowd-ring"></span></span
  >`);
}

/**
 * @description The woodland crowd: hedgehog, rabbit, owl, badger and fox, waving on a lead change,
 *   gasping at a Chaos event and cheering the finishers; bobbing in rubber rings in a flood,
 *   toppling like dominoes in an earthquake and dancing at the disco. A new reaction or mode
 *   restarts the animation.
 * @param {{kind: string, atMs: number, mode?: string}|null} crowd - From sceneAt.
 * @param {Object} theme - The theme config.
 * @returns {import('lit').TemplateResult} The template.
 * @since 1.0.0
 */
export function renderCrowd(crowd, theme) {
  const animals = theme.crowd.animals;
  const pose = crowd ? crowd.kind : 'idle';
  const mode = crowd && crowd.mode ? crowd.mode : 'calm';
  const members = Array.from(
    {length: CROWD_SIZE},
    (_value, slot) => animals[slot % animals.length]
  );
  const key = crowd ? `${crowd.kind}-${crowd.atMs}-${mode}` : 'calm';
  return html`<div
    class="crowd crowd-${pose} crowd-mode-${mode}"
    aria-hidden="true"
    data-testid="crowd"
    data-mode=${mode}
  >
    ${keyed(key, html`${members.map((animal, slot) => (
      // --ss-crowd-delay staggers the sprite kit's arm wave into a Mexican wave.
      html`<span class="crowd-member" style="--slot: ${slot}; --ss-crowd-delay: ${slot * 60}ms"
        >${spectator(animal.id, pose, mode === 'ring')}</span
      >`
    ))}`)}
  </div>`;
}

/** The HUD's styles. */
export const hudStyles = css`
  .stage-head {
    grid-area: head;
    position: relative;
    z-index: 3;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 3fr) minmax(0, 1fr);
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
  }

  .race-tag {
    display: flex;
    flex-direction: column;
    min-width: 0;
    margin: 0;
    color: var(--ss-hud-ink);
    text-shadow: 0 1px 2px var(--ss-hud-shadow);
  }

  .race-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }

  .race-number {
    font-family: ui-monospace, monospace;
    font-size: clamp(0.85rem, 1.4vw, 1.1rem);
    font-weight: 700;
  }

  /* The chaos level, quietly beside the race number. */
  .race-chaos {
    padding: 0 0.4rem;
    border-radius: 999px;
    color: var(--ss-hud-ink);
    background-color: var(--ss-hud-paper);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-shadow: none;
    white-space: nowrap;
  }

  .race-chaos[data-level='carnage'] {
    background-color: var(--ss-carnage);
  }

  .race-title {
    overflow: hidden;
    font-size: 0.8rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .commentary {
    display: flex;
    justify-content: center;
    min-height: 2.6rem;
    margin: 0;
  }

  .cue {
    display: inline-block;
    max-width: 100%;
    padding: 0.35rem 1rem;
    border-radius: 999px;
    color: var(--ss-hud-ink);
    background-color: var(--ss-hud-paper);
    font-size: clamp(1rem, 2.2vw, 1.75rem);
    font-weight: 800;
    line-height: 1.2;
    text-align: center;
    overflow-wrap: anywhere;
    animation: stage-cue-in var(--duration-sm, 200ms) linear both;
  }

  /* The owl's booth and its speech bubble (contract § 12): the booth at the left end of the
     commentary column, the banner beside it with a tail pointing at the owl. */
  .commentary-stand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.7rem;
    min-width: 0;
  }

  .commentary.has-owl {
    flex: 0 1 auto;
    justify-content: flex-start;
    min-width: 0;
  }

  .commentary.has-owl .cue {
    position: relative;
    border-radius: 14px;
    text-align: start;
  }

  .commentary.has-owl .cue::before {
    content: '';
    position: absolute;
    top: 50%;
    left: -9px;
    width: 0;
    height: 0;
    border-top: 7px solid transparent;
    border-right: 10px solid var(--ss-hud-paper);
    border-bottom: 7px solid transparent;
    transform: translateY(-50%);
  }

  .stage-banner {
    grid-column: 1 / -1;
    justify-self: center;
    margin: 0;
    padding: 0.2rem 0.9rem;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 700;
  }

  .stage-banner.is-replay {
    color: var(--ss-hud-ink);
    background-color: var(--ss-hud-paper);
  }

  .stage-banner.is-void {
    color: var(--ss-void-ink);
    background-color: var(--ss-void-paper);
    letter-spacing: 0.04em;
  }

  .count-in {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .count-in-number {
    color: var(--ss-hud-ink);
    font-size: clamp(5rem, 22vh, 14rem);
    font-weight: 900;
    line-height: 1;
    text-shadow: 0 6px 18px var(--ss-hud-shadow);
    animation: stage-count-pop 900ms var(--ease-enter, ease-out) both;
  }

  .count-in-number.is-go {
    color: var(--ss-go-ink);
  }

  .board-area {
    grid-area: board;
    position: relative;
    z-index: 3;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 0.5rem;
    min-height: 0;
    padding: 0 0.6rem 0.6rem 0;
  }

  /* At most 55% of the field's height: walkers, hunters and blown items keep to the bottom 45%,
     so whatever leaves the field on the right passes under the leaderboard, never behind it.
     The race log (stage-commentary.js), when shown, fills the column between the board and the
     walkers' clearance below it. */
  .board {
    max-height: 55%;
    overflow: hidden;
    padding: 0.5rem;
    border-radius: 10px;
    color: var(--ss-board-ink);
    background-color: var(--ss-board-paper);
  }

  /* Under the race log, the bottom of the board column stays clear for the ground walkers' rows
     (30%: WALKER_BAND_CQH in stage-timeline.js, the share of the field's height their rows may
     climb), so a walker leaving the field on the right is seen going, never hidden behind the
     log. A flex basis, because a percentage margin or padding follows the column's width. */
  .race-log-clearance {
    flex: 0 0 var(--walker-clearance, 30%);
    pointer-events: none;
  }

  /* Top right over the head, above the result view's veil. */
  .hud-tools {
    grid-area: head;
    justify-self: end;
    align-self: start;
    position: relative;
    z-index: 31;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.75rem;
  }

  .board-title {
    margin: 0 0 0.35rem;
    font-size: 0.8rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .board-rows {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .board-row {
    display: grid;
    grid-template-columns: 1.1rem auto minmax(0, 1fr) auto;
    grid-template-areas: 'rank bib name home' 'bar bar bar bar';
    align-items: center;
    column-gap: 0.35rem;
    row-gap: 2px;
    font-size: 0.85rem;
  }

  .board-rank {
    grid-area: rank;
    font-weight: 800;
    text-align: right;
  }

  .board-row .bib {
    grid-area: bib;
  }

  .board-name {
    grid-area: name;
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .board-home {
    grid-area: home;
    font-size: 0.7rem;
    font-weight: 700;
  }

  .board-bar {
    grid-area: bar;
    height: 4px;
    overflow: hidden;
    border-radius: 2px;
    background-color: var(--ss-board-track);
  }

  .board-fill {
    display: block;
    height: 100%;
    background-color: var(--ss-board-fill);
    transform: scaleX(0);
    transform-origin: 0 50%;
  }

  .board-row.is-home .board-fill {
    background-color: var(--ss-go-ink);
  }

  .crowd {
    display: flex;
    align-items: flex-end;
    justify-content: space-around;
    height: 100%;
    padding: 0 0.5rem;
  }

  .crowd-member {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    width: calc(var(--crowd-h) * 0.95);
    height: calc(var(--crowd-h) * 0.9);
    font-size: calc(var(--crowd-h) * 0.6);
    transform-origin: 50% 100%;
  }

  .crowd-member svg {
    width: 100%;
    height: 100%;
  }

  .crowd-wave .crowd-member {
    animation: stage-crowd-wave 300ms ease-in-out both;
    animation-delay: calc(var(--slot) * var(--stagger-tight, 50ms));
    animation-iteration-count: 2;
    animation-direction: alternate;
  }

  .crowd-gasp .crowd-member {
    animation: stage-crowd-gasp 350ms ease-out both;
  }

  .crowd-cheer .crowd-member {
    animation: stage-crowd-wave 260ms ease-in-out infinite alternate;
    animation-delay: calc(var(--slot) * 40ms);
  }

  /* Field-wide modes win over the reactions above (same specificity, later in the sheet). */
  .crowd-mode-ring .crowd-member {
    animation: stage-crowd-bob 900ms ease-in-out infinite alternate;
    animation-delay: calc(var(--slot) * -90ms);
  }

  /* Still frame (reduced motion): all fallen over. */
  .crowd-mode-domino .crowd-member {
    transform: rotate(78deg);
    animation: stage-domino 360ms ease-in both;
    animation-delay: calc(var(--slot) * 90ms);
  }

  .crowd-mode-dance .crowd-member {
    animation: stage-crowd-wave 240ms ease-in-out infinite alternate;
    animation-delay: calc(var(--slot) * 30ms);
  }

  .crowd-ring-stand {
    position: relative;
    display: flex;
    width: 100%;
    height: 100%;
    align-items: flex-end;
    justify-content: center;
  }

  .crowd-ring {
    position: absolute;
    left: 5%;
    right: 5%;
    bottom: 8%;
    height: 32%;
    border: calc(var(--crowd-h) * 0.08) solid var(--ss-ring);
    border-radius: 50%;
  }

  @keyframes stage-cue-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes stage-count-pop {
    from {
      transform: scale(1.6);
      opacity: 0;
    }
    30% {
      transform: scale(1);
      opacity: 1;
    }
    to {
      transform: scale(0.9);
      opacity: 0.85;
    }
  }

  @keyframes stage-crowd-wave {
    from {
      transform: translateY(0);
    }
    to {
      transform: translateY(-40%) rotate(-4deg);
    }
  }

  @keyframes stage-crowd-gasp {
    from {
      transform: scale(1);
    }
    40% {
      transform: scale(1.12, 0.9) translateY(-8%);
    }
    to {
      transform: scale(1);
    }
  }

  @keyframes stage-crowd-bob {
    from {
      transform: translateY(0) rotate(-3deg);
    }
    to {
      transform: translateY(-12%) rotate(3deg);
    }
  }

  @keyframes stage-domino {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(78deg);
    }
  }
`;
