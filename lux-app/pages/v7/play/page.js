import {html, css, nothing, isServer} from 'lit';
import {customElement} from 'lit/decorators.js';
import {keyed} from 'lit/directives/keyed.js';
import {AIUXElement, decorators} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';
import {icon} from '@servicenow/aiux/aiux-directive-icon';
import {drawRace, getRace} from '../../../lib/api.js';
import {setDocumentTitle} from '../../../utils/document-title.js';
import {repairStaleShell} from '../../../utils/shell.js';
import '../../../components/ss-setup.js';
import '../../../components/ss-race-stage.js';

const {global, roles} = decorators;

const SYS_ID_PATTERN = /^[0-9a-f]{32}$/;
// The classic form of a stored race, opened in a new tab by "Open record".
const RACE_FORM_PATH = '/x_crli_squirrel_race.do';
// The draw's 400 code for a rematchOf whose original race has gone; the marshal may then draw
// without the link.
const STALE_REMATCH_CODE = 'bad_rematch';
// Shortcuts never fire while the marshal types in one of these.
const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
// Space activates these natively, so the Space shortcut leaves them alone.
const ACTIVATING_TAGS = new Set(['BUTTON', 'A', 'SUMMARY']);

/**
 * @description Says whether a key event came from a text field, a select or editable content,
 *   looking through shadow roots with the event's composed path.
 * @param {EventTarget[]} path - event.composedPath().
 * @returns {boolean} True when the marshal is typing.
 * @since 1.0.0
 */
function isTypingTarget(path) {
  return path.some((node) => Boolean(node) && (
    TYPING_TAGS.has(node.tagName) || node.isContentEditable === true
  ));
}

/**
 * @description Says whether Space would activate the focused element itself (a button or link).
 * @param {EventTarget[]} path - event.composedPath().
 * @returns {boolean} True for buttons, links, summaries and role="button" elements.
 * @since 1.0.0
 */
function isActivatingTarget(path) {
  const target = path[0];
  if (!target || !target.tagName) {
    return false;
  }
  const role = typeof target.getAttribute === 'function' ? target.getAttribute('role') : null;
  return ACTIVATING_TAGS.has(target.tagName) || role === 'button';
}

/**
 * @description Copies an API failure into plain state the template can show.
 * @param {*} error - A RaceApiError or anything thrown.
 * @returns {{status: number, code: string, message: string, details: string[]}} The error state.
 * @since 1.0.0
 */
function toErrorState(error) {
  const source = error && typeof error === 'object' ? error : {};
  return {
    status: typeof source.status === 'number' ? source.status : 0,
    code: typeof source.code === 'string' ? source.code : 'http_error',
    message: typeof source.message === 'string' && source.message
      ? source.message
      : i18n.getMessage('The race could not be drawn.'),
    details: Array.isArray(source.details) ? source.details.map(String) : []
  };
}

/**
 * @description Rebuilds a draw request from a race payload, for a rematch when the original
 *   request is not to hand. Entrants come back sorted by lane, so that is the order used. A
 *   Chaos race keeps its stored Chaos level (Chaos v2 contract § 2: race.chaosLevel).
 * @param {{race: Object, entrants: Array<Object>}} payload - The race payload.
 * @returns {{title: string, mode: string, names: string[], outfits: Array<Object>,
 *   places: number, raceSeconds: number, rematchOf: null, chaosLevel?: string}} The request.
 * @since 1.0.0
 */
function requestFromPayload(payload) {
  const race = payload.race || {};
  const entrants = (payload.entrants || []).slice()
    .sort((first, second) => (first.lane || 0) - (second.lane || 0));
  const request = {
    title: race.title || '',
    mode: race.mode,
    names: entrants.map((entrant) => entrant.name),
    outfits: entrants.map((entrant) => entrant.outfit || {}),
    places: race.places,
    // The winner always finishes at exactly the race length (SPEC.md § 7, draw step 7).
    raceSeconds: Math.round((race.durationMs || 0) / 1000),
    rematchOf: null
  };
  if (race.mode === 'chaos' && typeof race.chaosLevel === 'string' && race.chaosLevel) {
    request.chaosLevel = race.chaosLevel;
  }
  return request;
}

/**
 * The race page of Squirrel Scramble, at routeFor('play') in utils/routes.js (SPEC.md § 8): the
 * setup view and the race view swap in place with no reload. Start sends the setup's request to
 * POST /draw; only once the server has drawn and stored the race does <ss-race-stage> animate it,
 * so the browser never picks a winner. A refresh never re-draws: the stored race is replayed from
 * History.
 *
 * Keys: Space starts (setup) or skips (race), R replays, N starts a new race, F toggles
 * presenter mode (full screen on the arena), Esc leaves full screen. None of them fire while
 * the marshal types in a field.
 *
 * Reduced motion: with prefers-reduced-motion the race opens on its result, and "Run the race
 * anyway" plays it. Security lives on the server: a 403 from the API shows "Marshals only"; the
 * @roles gate below is a convenience only.
 */
// Scoped to this app's experience; @roles writes sys_aix_page.roles (SPEC.md § 6).
@global(false)
@roles(['x_crli_squirrel.marshal'])
@customElement('x-crli-squirrel-race-day-v7-page')
export default class RacePage extends AIUXElement {
  static properties = {
    _view: {state: true},
    _busy: {state: true},
    _race: {state: true},
    _instant: {state: true},
    _reducedMotion: {state: true},
    _error: {state: true},
    _announcement: {state: true},
    _fullscreen: {state: true}
  };

  static styles = css`
    :host {
      display: block;
    }

    .arena {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .arena:fullscreen {
      width: 100vw;
      height: 100vh;
      padding: 0.75rem;
      overflow: auto;
      background-color: var(--color-base-100);
    }

    .stage-shell {
      position: relative;
      height: calc(100dvh - 12rem);
      min-height: 26rem;
      overflow: hidden;
      border-radius: var(--radius-box, 1rem);
    }

    .arena:fullscreen .stage-shell {
      flex: 1 1 auto;
      height: auto;
    }

    ss-race-stage {
      display: block;
      width: 100%;
      height: 100%;
    }

    .race-heading:focus {
      outline: none;
    }

    .race-heading:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    .break-anywhere {
      overflow-wrap: anywhere;
    }
  `;

  /**
   * @description Reads ?rematch=<sys_id> (built by playRoute({rematch}) in utils/routes.js for
   *   Rematch on the replay page) so the setup view can open with that race's line-up. Runs on
   *   the server and the client; it fetches nothing.
   * @param {Object} ctx - The route context.
   * @returns {Promise<{rematchSysId: string}>} The validated sys_id, or ''.
   * @since 1.0.0
   */
  static async loader(ctx) {
    const query = ctx && ctx.query ? ctx.query : {};
    const rematch = typeof query.rematch === 'string' ? query.rematch : '';
    return {rematchSysId: SYS_ID_PATTERN.test(rematch) ? rematch : ''};
  }

  /**
   * @description Sets the starting state. No browser API here: this also runs on the server.
   * @since 1.0.0
   */
  constructor() {
    super();
    this._view = 'setup';
    this._busy = false;
    this._race = null;
    this._instant = false;
    this._reducedMotion = false;
    this._error = null;
    this._announcement = '';
    this._fullscreen = false;
    this._lastRequest = null;
    this._motionQuery = null;
  }

  /**
   * @description Wires the keyboard shortcuts, full-screen tracking and the reduced-motion
   *   query. Browser only.
   * @returns {void}
   * @since 1.0.0
   */
  connectedCallback() {
    super.connectedCallback();
    if (!isServer) {
      window.addEventListener('keydown', this._onKeyDown);
      document.addEventListener('fullscreenchange', this._onFullscreenChange);
      if (typeof window.matchMedia === 'function') {
        this._motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        this._motionQuery.addEventListener('change', this._onMotionChange);
        if (this.hasUpdated) {
          this._reducedMotion = this._motionQuery.matches;
        }
      }
    }
  }

  /**
   * @description Removes every listener added in connectedCallback().
   * @returns {void}
   * @since 1.0.0
   */
  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('fullscreenchange', this._onFullscreenChange);
    if (this._motionQuery) {
      this._motionQuery.removeEventListener('change', this._onMotionChange);
      this._motionQuery = null;
    }
  }

  /**
   * @description After hydration: repairs a stale cached shell (utils/shell.js), applies the
   *   reduced-motion preference, sets the tab title and loads a ?rematch= line-up when one was
   *   asked for.
   * @returns {void}
   * @since 1.0.0
   */
  firstUpdated() {
    repairStaleShell(this);
    this._reducedMotion = Boolean(this._motionQuery && this._motionQuery.matches);
    setDocumentTitle(i18n.getMessage('Set up a race'));
    const {rematchSysId} = this.loaderData || {};
    if (rematchSysId) {
      this._prefillRematch(rematchSysId);
    }
  }

  /**
   * @description The setup element.
   * @returns {HTMLElement|null} <ss-setup>, or null.
   * @since 1.0.0
   */
  _setup() {
    return this.renderRoot ? this.renderRoot.querySelector('ss-setup') : null;
  }

  /**
   * @description The race stage element.
   * @returns {HTMLElement|null} <ss-race-stage>, or null.
   * @since 1.0.0
   */
  _stage() {
    return this.renderRoot ? this.renderRoot.querySelector('ss-race-stage') : null;
  }

  /**
   * @description Says something in the page's polite live region.
   * @param {string} message - The announcement.
   * @returns {void}
   * @since 1.0.0
   */
  _announce(message) {
    this._announcement = message;
  }

  /**
   * @description Loads a stored race's line-up (names, outfits, mode, places, length and Chaos
   *   level) into the setup view, linked as a rematch of that race. It fetches the race named
   *   in the URL, never that race's own rematchOf.
   * @param {string} sysId - The race to rematch.
   * @returns {Promise<void>}
   * @since 1.0.0
   */
  async _prefillRematch(sysId) {
    try {
      const payload = await getRace(sysId);
      const race = payload && payload.race ? payload.race : {};
      const entrants = (payload && Array.isArray(payload.entrants) ? payload.entrants : [])
        .slice()
        .sort((first, second) => (first.lane || 0) - (second.lane || 0));
      const setup = this._setup();
      if (!setup) {
        return;
      }
      setup.loadLineup({
        names: entrants.map((entrant) => entrant.name),
        outfits: entrants.map((entrant) => entrant.outfit || {}),
        rematch: {sysId: race.sysId || sysId, number: race.number || ''},
        sourceLabel: race.number || '',
        settings: {
          mode: race.mode,
          places: race.places,
          raceSeconds: Math.round((race.durationMs || 0) / 1000),
          chaosLevel: race.chaosLevel
        }
      });
    } catch (error) {
      const state = toErrorState(error);
      if (state.code === 'forbidden') {
        this._showForbidden();
        return;
      }
      this._error = {
        ...state,
        title: i18n.getMessage('The race to rematch could not be loaded.'),
        retry: null
      };
    }
  }

  /**
   * @description Swaps everything for the "Marshals only" panel.
   * @returns {void}
   * @since 1.0.0
   */
  _showForbidden() {
    this._view = 'forbidden';
    this._error = null;
    this._race = null;
    setDocumentTitle(i18n.getMessage('Marshals only'));
  }

  /**
   * @description Draws a race on the server, then shows it on the stage. On failure the error
   *   stays inline; a 403 shows "Marshals only".
   * @param {Object} request - The POST /draw request.
   * @param {boolean} instant - True to open on the result.
   * @returns {Promise<void>}
   * @since 1.0.0
   */
  async _draw(request, instant) {
    if (this._busy) {
      return;
    }
    this._busy = true;
    this._error = null;
    this._announce(i18n.getMessage('Drawing the race…'));
    try {
      const payload = await drawRace(request);
      if (!payload || !payload.race || !Array.isArray(payload.entrants)) {
        throw new Error(i18n.getMessage('The race service sent an answer the page cannot read.'));
      }
      this._lastRequest = {...request, rematchOf: request.rematchOf || null};
      this._race = payload;
      this._instant = Boolean(instant) || this._reducedMotion;
      this._view = 'race';
      const number = payload.race.number || '';
      this._announce(this._instant
        ? i18n.getMessage('{number} is drawn. Here is the result.', {number})
        : i18n.getMessage('{number} is drawn. They are off!', {number}));
      await this.updateComplete;
      const heading = this.renderRoot.querySelector('#race-heading');
      if (heading) {
        heading.focus();
      }
      setDocumentTitle(i18n.getMessage('Racing: {title}', {title: payload.race.title || number}));
    } catch (error) {
      this._handleDrawError(error, request, instant);
    } finally {
      this._busy = false;
    }
  }

  /**
   * @description Shows a failed draw. A request whose rematch link the server refused
   *   (bad_rematch: the original race has gone) gets "Start without the rematch link".
   * @param {*} error - What the draw threw.
   * @param {Object} request - The request that failed.
   * @param {boolean} instant - Whether it was an Instant result.
   * @returns {void}
   * @since 1.0.0
   */
  _handleDrawError(error, request, instant) {
    const state = toErrorState(error);
    if (state.code === 'forbidden') {
      this._showForbidden();
      return;
    }
    const staleRematch = Boolean(request && request.rematchOf)
      && state.code === STALE_REMATCH_CODE;
    this._error = {
      ...state,
      title: staleRematch
        ? i18n.getMessage('The race this rematches no longer exists.')
        : i18n.getMessage('The race could not be drawn.'),
      retry: staleRematch ? {request: {...request, rematchOf: null}, instant} : null
    };
    this._announce(this._error.title);
  }

  /**
   * @description The setup view asked to start.
   * @param {CustomEvent} event - ss-setup:start with {request, instant}.
   * @returns {void}
   * @since 1.0.0
   */
  _onSetupStart = (event) => {
    const detail = event.detail || {};
    if (detail.request) {
      this._draw(detail.request, Boolean(detail.instant));
    }
  };

  /**
   * @description Draws again without the rematch link, after the server said the original race
   *   has gone.
   * @returns {void}
   * @since 1.0.0
   */
  _onDrawWithoutLink = () => {
    const retry = this._error && this._error.retry;
    if (!retry) {
      return;
    }
    const setup = this._setup();
    if (setup && typeof setup.clearRematch === 'function') {
      setup.clearRematch();
    }
    this._draw(retry.request, retry.instant);
  };

  /**
   * @description Hides the error.
   * @returns {void}
   * @since 1.0.0
   */
  _onDismissError = () => {
    this._error = null;
  };

  /**
   * @description Handles the result buttons on the stage.
   * @param {CustomEvent} event - ss-result:action with {action}.
   * @returns {void}
   * @since 1.0.0
   */
  _onResultAction = (event) => {
    const action = event.detail ? event.detail.action : '';
    if (action === 'replay') {
      this._replay();
    } else if (action === 'rematch') {
      this._rematch();
    } else if (action === 'new') {
      this._newRace();
    } else if (action === 'open-record') {
      this._openRecord();
    }
  };

  /**
   * @description The stage has shown the result.
   * @returns {void}
   * @since 1.0.0
   */
  _onResultShown = () => {
    const race = this._race ? this._race.race : {};
    setDocumentTitle(i18n.getMessage('Result: {title}', {title: race.title || race.number || ''}));
  };

  /**
   * @description Replays the race on the stage from the start.
   * @returns {void}
   * @since 1.0.0
   */
  _replay() {
    const stage = this._stage();
    if (stage && typeof stage.restart === 'function') {
      stage.restart();
      this._announce(i18n.getMessage('Replaying the race.'));
    }
  }

  /**
   * @description Skips the animation to the result.
   * @returns {void}
   * @since 1.0.0
   */
  _skip() {
    const stage = this._stage();
    if (stage && typeof stage.skip === 'function') {
      stage.skip();
    }
  }

  /**
   * @description Draws a new race with the same names, outfits and settings, linked to this one.
   * @returns {void}
   * @since 1.0.0
   */
  _rematch() {
    const race = this._race ? this._race.race : null;
    if (!race || !SYS_ID_PATTERN.test(race.sysId || '')) {
      return;
    }
    const base = this._lastRequest || requestFromPayload(this._race);
    this._draw({...base, rematchOf: race.sysId}, false);
  }

  /**
   * @description Goes back to the setup view, which still holds the names, outfits and
   *   settings.
   * @returns {Promise<void>}
   * @since 1.0.0
   */
  async _newRace() {
    this._view = 'setup';
    this._race = null;
    this._instant = false;
    this._error = null;
    this._announce(i18n.getMessage('Back to setup. Your names are still there.'));
    await this.updateComplete;
    setDocumentTitle(i18n.getMessage('Set up a race'));
    const setup = this._setup();
    if (setup && typeof setup.focusNames === 'function') {
      setup.focusNames();
    }
  }

  /**
   * @description Opens the stored race's classic form in a new tab.
   * @returns {void}
   * @since 1.0.0
   */
  _openRecord() {
    const sysId = this._race && this._race.race ? this._race.race.sysId : '';
    if (SYS_ID_PATTERN.test(sysId || '')) {
      window.open(`${RACE_FORM_PATH}?sys_id=${sysId}`, '_blank', 'noopener');
    }
  }

  /**
   * @description "Run the race anyway": plays the full race after an Instant or reduced-motion
   *   result.
   * @returns {Promise<void>}
   * @since 1.0.0
   */
  _onRunAnyway = async () => {
    this._instant = false;
    await this.updateComplete;
    this._replay();
  };

  /**
   * @description The "New race" toolbar button.
   * @returns {void}
   * @since 1.0.0
   */
  _onNewRaceClick = () => {
    this._newRace();
  };

  /**
   * @description Enters or leaves presenter mode (full screen on the arena).
   * @returns {Promise<void>}
   * @since 1.0.0
   */
  _togglePresenter = async () => {
    const unavailable = i18n.getMessage('Full screen is not available here.');
    try {
      if (this._isFullscreen()) {
        await document.exitFullscreen();
        return;
      }
      const arena = this.renderRoot.querySelector('#arena');
      if (arena && typeof arena.requestFullscreen === 'function') {
        await arena.requestFullscreen();
      } else {
        this._announce(unavailable);
      }
    } catch {
      this._announce(unavailable);
    }
  };

  /**
   * @description Says whether the arena is in full screen.
   * @returns {boolean} True in presenter mode.
   * @since 1.0.0
   */
  _isFullscreen() {
    if (isServer) {
      return false;
    }
    const root = this.renderRoot;
    return Boolean(root && root.fullscreenElement) || document.fullscreenElement === this;
  }

  /**
   * @description Tracks entering and leaving full screen, including Esc.
   * @returns {void}
   * @since 1.0.0
   */
  _onFullscreenChange = () => {
    this._fullscreen = this._isFullscreen();
  };

  /**
   * @description Follows a change to the reduced-motion preference.
   * @param {MediaQueryListEvent} event - The change event.
   * @returns {void}
   * @since 1.0.0
   */
  _onMotionChange = (event) => {
    this._reducedMotion = event.matches;
  };

  /**
   * @description The keyboard shortcuts. Ignored while typing, with a modifier key held, or on a
   *   key held down.
   * @param {KeyboardEvent} event - The key event.
   * @returns {void}
   * @since 1.0.0
   */
  _onKeyDown = (event) => {
    if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    if (isTypingTarget(path) || this._view === 'forbidden') {
      return;
    }
    if (event.key === ' ' || event.key === 'Spacebar') {
      if (isActivatingTarget(path)) {
        return;
      }
      if (this._view === 'setup') {
        const setup = this._setup();
        if (setup && typeof setup.requestStart === 'function' && setup.requestStart(false)) {
          event.preventDefault();
        }
      } else if (this._view === 'race') {
        event.preventDefault();
        this._skip();
      }
      return;
    }
    const letter = event.key.length === 1 ? event.key.toLowerCase() : '';
    if (letter === 'f') {
      event.preventDefault();
      this._togglePresenter();
    } else if (letter === 'r' && this._view === 'race') {
      event.preventDefault();
      this._replay();
    } else if (letter === 'n' && this._view === 'race') {
      event.preventDefault();
      this._newRace();
    }
  };

  /**
   * @description The "Marshals only" panel.
   * @returns {import('lit').TemplateResult} The panel.
   * @since 1.0.0
   */
  _renderForbidden() {
    return html`
      <section
        class="aiux-card border border-base-300 bg-base-100 shadow-sm"
        aria-labelledby="forbidden-heading"
        data-testid="marshals-only"
      >
        <div class="aiux-card-body gap-3 p-6">
          <h1 id="forbidden-heading" class="text-2xl font-bold text-text-primary">
            ${i18n.getMessage('Marshals only')}
          </h1>
          <p class="text-base text-text-secondary">
            ${i18n.getMessage('Squirrel Scramble races are run by marshals. Ask your administrator for the Squirrel Scramble marshal role, then reload this page.')}
          </p>
        </div>
      </section>
    `;
  }

  /**
   * @description The inline error, with the server's message and details as text.
   * @returns {import('lit').TemplateResult|typeof nothing} The alert.
   * @since 1.0.0
   */
  _renderError() {
    if (!this._error) {
      return nothing;
    }
    const {title, message, details, retry} = this._error;
    return html`
      <div
        class="aiux-alert aiux-alert-error aiux-alert-soft flex flex-col items-start gap-2"
        role="alert"
        data-testid="draw-error"
      >
        <p class="font-semibold break-anywhere">${title}</p>
        ${message && message !== title
          ? html`<p class="break-anywhere">${message}</p>`
          : nothing}
        ${details.length > 0
          ? html`<ul class="list-disc ps-5">
              ${details.map((detail) => html`<li class="break-anywhere">${detail}</li>`)}
            </ul>`
          : nothing}
        <div class="flex flex-wrap gap-2">
          ${retry
            ? html`<button
                type="button"
                class="aiux-btn aiux-btn-primary aiux-btn-sm"
                data-testid="draw-without-link"
                ?disabled=${this._busy}
                @click=${this._onDrawWithoutLink}
              >${i18n.getMessage('Start without the rematch link')}</button>`
            : nothing}
          <button
            type="button"
            class="aiux-btn aiux-btn-ghost aiux-btn-sm"
            @click=${this._onDismissError}
          >${i18n.getMessage('Dismiss')}</button>
        </div>
      </div>
    `;
  }

  /**
   * @description The keyboard shortcuts for the current view, one whole message per key.
   * @param {boolean} racing - Whether the race view is showing.
   * @returns {import('lit').TemplateResult} The list.
   * @since 1.0.0
   */
  _renderShortcuts(racing) {
    const shortcuts = racing
      ? [
        {key: i18n.getMessage('Space'), action: i18n.getMessage('Skip to the result')},
        {key: 'R', action: i18n.getMessage('Replay')},
        {key: 'N', action: i18n.getMessage('New race')}
      ]
      : [{key: i18n.getMessage('Space'), action: i18n.getMessage('Start the race')}];
    shortcuts.push(
      {key: 'F', action: i18n.getMessage('Presenter mode')},
      {key: i18n.getMessage('Esc'), action: i18n.getMessage('Leave full screen')}
    );
    return html`
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
        <span id="shortcuts-heading">${i18n.getMessage('Shortcuts when you are not typing:')}</span>
        <ul class="flex flex-wrap gap-x-4 gap-y-1" aria-labelledby="shortcuts-heading">
          ${shortcuts.map((shortcut) => html`
            <li>
              <kbd class="aiux-kbd aiux-kbd-xs">${shortcut.key}</kbd>
              ${shortcut.action}
            </li>
          `)}
        </ul>
      </div>
    `;
  }

  /**
   * @description The toolbar over the arena: the race heading, "Run the race anyway", "New race",
   *   presenter mode and the shortcut list.
   * @returns {import('lit').TemplateResult} The toolbar.
   * @since 1.0.0
   */
  _renderToolbar() {
    const racing = this._view === 'race' && Boolean(this._race);
    const race = racing ? this._race.race : null;
    return html`
      <div class="flex flex-wrap items-center gap-2">
        ${racing
          ? html`<h1
              id="race-heading"
              class="race-heading me-auto text-lg font-semibold text-text-primary break-anywhere"
              tabindex="-1"
              data-testid="race-heading"
            >${i18n.getMessage('{number}: {title}', {
              number: race.number || '',
              title: race.title || ''
            })}</h1>`
          : html`<span class="me-auto"></span>`}
        ${racing && this._instant
          ? html`<button
              type="button"
              class="aiux-btn aiux-btn-outline aiux-btn-sm"
              data-testid="run-anyway"
              @click=${this._onRunAnyway}
            >${this._reducedMotion
              ? i18n.getMessage('Run the race anyway')
              : i18n.getMessage('Watch the race')}</button>`
          : nothing}
        ${racing
          ? html`<button
              type="button"
              class="aiux-btn aiux-btn-ghost aiux-btn-sm"
              @click=${this._onNewRaceClick}
            >${i18n.getMessage('New race')}</button>`
          : nothing}
        <button
          type="button"
          class="aiux-btn aiux-btn-outline aiux-btn-sm"
          aria-pressed=${this._fullscreen ? 'true' : 'false'}
          data-testid="presenter-mode"
          @click=${this._togglePresenter}
        >
          ${icon({name: 'expand', size: 'sm'})}
          ${i18n.getMessage('Presenter mode')}
        </button>
      </div>
      ${this._renderShortcuts(racing)}
    `;
  }

  /**
   * @description The race stage. Keyed by the race, so a rematch mounts a fresh stage.
   * @returns {import('lit').TemplateResult} The stage.
   * @since 1.0.0
   */
  _renderStage() {
    return html`
      <div class="stage-shell" data-testid="stage-shell">
        ${keyed(this._race.race.sysId, html`
          <ss-race-stage
            .race=${this._race}
            .replay=${false}
            .instant=${this._instant}
            .reducedMotion=${this._reducedMotion}
            @ss-result:action=${this._onResultAction}
            @ss-stage:result-shown=${this._onResultShown}
          ></ss-race-stage>
        `)}
      </div>
    `;
  }

  /**
   * @description Renders the arena (setup or race), the error and the live region. Pure and
   *   server-safe: the stage only appears after a draw, which happens in the browser.
   * @returns {import('lit').TemplateResult} The page template.
   * @since 1.0.0
   */
  render() {
    const forbidden = this._view === 'forbidden';
    const racing = this._view === 'race' && Boolean(this._race);
    // Marks the build that refreshed the Lux shell cache (Chaos v2 contract § 13).
    return html`
      <div
        class="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 lg:p-6"
        data-shell-build="2026-11-05b"
      >
        <div id="arena" class="arena" data-testid="arena" data-view=${this._view}>
          ${forbidden ? this._renderForbidden() : this._renderToolbar()}
          ${this._renderError()}
          <div ?hidden=${this._view !== 'setup'}>
            <ss-setup
              .busy=${this._busy}
              .reducedMotion=${this._reducedMotion}
              @ss-setup:start=${this._onSetupStart}
            ></ss-setup>
          </div>
          ${racing ? this._renderStage() : nothing}
        </div>
        <p class="sr-only" role="status" aria-live="polite">${this._announcement}</p>
      </div>
    `;
  }
}
