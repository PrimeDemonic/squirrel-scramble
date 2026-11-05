import {html, css, nothing, isServer} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement, decorators} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';
import {navigate} from '@servicenow/aiux/aiux-client';
import {icon} from '@servicenow/aiux/aiux-directive-icon';
import {getRace} from '../../../../lib/api.js';
import {setDocumentTitle} from '../../../../utils/document-title.js';
import {repairStaleShell} from '../../../../utils/shell.js';
import {playRoute, routeFor} from '../../../../utils/routes.js';
import '../../../../components/ss-race-stage.js';

const {global, roles} = decorators;

const SYS_ID_PATTERN = /^[0-9a-f]{32}$/;
// The classic form of a stored race, opened in a new tab by "Open record".
const RACE_FORM_PATH = '/x_crli_squirrel_race.do';
// Shortcuts never fire while the marshal types in one of these.
const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
// Space activates these natively, so the Space shortcut leaves them alone.
const ACTIVATING_TAGS = new Set(['BUTTON', 'A', 'SUMMARY']);

/**
 * @description Says whether a key event came from a text field, a select or editable content.
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
 * @description Says whether Space would activate the focused element itself.
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
 * The replay page of Squirrel Scramble, at replayRoute(<sys_id>) in utils/routes.js (SPEC.md
 * § 8): opens straight into a replay of a stored race. The loader reads the race through
 * GET /races/{sys_id}; the stage replays it from the stored seed and outfits, so it looks exactly
 * like the original and can never change who won. Rematch and New race go to the race page
 * (Rematch uses playRoute({rematch}), so the setup view opens with this line-up). The race's own
 * rematchOf is never read or followed: it can be null when the original has gone.
 *
 * Keys as on the race page: Space skips, R replays, N goes to a new race, F toggles presenter
 * mode, Esc leaves full screen; none fire while typing. Reduced motion opens on the result.
 */
// Scoped to this app's experience; @roles writes sys_aix_page.roles (SPEC.md § 6).
@global(false)
@roles(['x_crli_squirrel.marshal'])
@customElement('x-crli-squirrel-replay-v7-page')
export default class ReplayPage extends AIUXElement {
  static properties = {
    _ready: {state: true},
    _instant: {state: true},
    _reducedMotion: {state: true},
    _fullscreen: {state: true},
    _announcement: {state: true}
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

    .break-anywhere {
      overflow-wrap: anywhere;
    }
  `;

  /**
   * @description Reads the stored race for ctx.params.id with GET /races/{sys_id} (aiuxFetch,
   *   which carries the session on the server and in the browser). Every failure becomes plain
   *   state: 'forbidden' for a 403, 'not_found' for anything else.
   * @param {Object} ctx - The route context; ctx.params.id is the race's sys_id.
   * @returns {Promise<{status: string, raceId: string, payload?: Object, message?: string}>}
   *   The loader data.
   * @since 1.0.0
   */
  static async loader(ctx) {
    const raceId = ctx && ctx.params && typeof ctx.params.id === 'string' ? ctx.params.id : '';
    try {
      const payload = await getRace(raceId);
      if (!payload || !payload.race || !Array.isArray(payload.entrants)) {
        return {status: 'not_found', raceId, message: ''};
      }
      return {status: 'ok', raceId, payload};
    } catch (error) {
      const code = error && typeof error.code === 'string' ? error.code : '';
      const message = error && typeof error.message === 'string' ? error.message : '';
      return {status: code === 'forbidden' ? 'forbidden' : 'not_found', raceId, message};
    }
  }

  /**
   * @description Sets the starting state. No browser API here: this also runs on the server.
   * @since 1.0.0
   */
  constructor() {
    super();
    this._ready = false;
    this._instant = false;
    this._reducedMotion = false;
    this._fullscreen = false;
    this._announcement = '';
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
   * @description After hydration: repairs a stale cached shell (utils/shell.js; History stays
   *   highlighted), reads the reduced-motion preference, then mounts the stage (so it starts
   *   with the right instant setting) and sets the tab title.
   * @returns {void}
   * @since 1.0.0
   */
  firstUpdated() {
    repairStaleShell(this);
    this._reducedMotion = Boolean(this._motionQuery && this._motionQuery.matches);
    this._instant = this._reducedMotion;
    this._ready = true;
    const {status, payload} = this.loaderData || {};
    if (status === 'ok') {
      const race = payload.race;
      const title = race.title || race.number || '';
      setDocumentTitle(i18n.getMessage('Replay: {title}', {title}));
    } else if (status === 'forbidden') {
      setDocumentTitle(i18n.getMessage('Marshals only'));
    } else {
      setDocumentTitle(i18n.getMessage('Race not found'));
    }
  }

  /**
   * @description The stored race, when the loader found one.
   * @returns {Object|null} The race part of the payload.
   * @since 1.0.0
   */
  _race() {
    const {status, payload} = this.loaderData || {};
    return status === 'ok' ? payload.race : null;
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
   * @description Replays the race from the start.
   * @returns {void}
   * @since 1.0.0
   */
  _replay() {
    const stage = this._stage();
    if (stage && typeof stage.restart === 'function') {
      stage.restart();
      this._announcement = i18n.getMessage('Replaying the race.');
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
   * @description Goes to the setup view with this race's line-up, linked as a rematch.
   * @returns {void}
   * @since 1.0.0
   */
  _rematch() {
    const race = this._race();
    if (race && SYS_ID_PATTERN.test(race.sysId || '')) {
      navigate(playRoute({rematch: race.sysId}));
    } else {
      navigate(routeFor('play'));
    }
  }

  /**
   * @description Goes to the setup view for a new race.
   * @returns {void}
   * @since 1.0.0
   */
  _newRace() {
    navigate(routeFor('play'));
  }

  /**
   * @description Opens the stored race's classic form in a new tab.
   * @returns {void}
   * @since 1.0.0
   */
  _openRecord() {
    const race = this._race();
    if (race && SYS_ID_PATTERN.test(race.sysId || '')) {
      window.open(`${RACE_FORM_PATH}?sys_id=${race.sysId}`, '_blank', 'noopener');
    }
  }

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
   * @description "Run the race anyway": plays the full replay after a reduced-motion result.
   * @returns {Promise<void>}
   * @since 1.0.0
   */
  _onRunAnyway = async () => {
    this._instant = false;
    await this.updateComplete;
    this._replay();
  };

  /**
   * @description The race history link on the not-found panel.
   * @returns {void}
   * @since 1.0.0
   */
  _onHistoryClick = () => {
    navigate(routeFor('history'));
  };

  /**
   * @description The "Start a race" and "New race" buttons.
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
        this._announcement = unavailable;
      }
    } catch {
      this._announcement = unavailable;
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
    if (isTypingTarget(path) || !this._race()) {
      return;
    }
    if (event.key === ' ' || event.key === 'Spacebar') {
      if (!isActivatingTarget(path)) {
        event.preventDefault();
        this._skip();
      }
      return;
    }
    const letter = event.key.length === 1 ? event.key.toLowerCase() : '';
    if (letter === 'f') {
      event.preventDefault();
      this._togglePresenter();
    } else if (letter === 'r') {
      event.preventDefault();
      this._replay();
    } else if (letter === 'n') {
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
   * @description The panel for a race that does not exist (or could not be read).
   * @param {string} message - The server's message, when there was one.
   * @returns {import('lit').TemplateResult} The panel.
   * @since 1.0.0
   */
  _renderNotFound(message) {
    return html`
      <section
        class="aiux-card border border-base-300 bg-base-100 shadow-sm"
        aria-labelledby="not-found-heading"
        data-testid="race-not-found"
      >
        <div class="aiux-card-body gap-3 p-6">
          <h1 id="not-found-heading" class="text-2xl font-bold text-text-primary">
            ${i18n.getMessage('That race could not be found')}
          </h1>
          <p class="text-base text-text-secondary">
            ${i18n.getMessage('The link may be wrong, or the race may have been removed. Pick a race from the history instead.')}
          </p>
          ${message
            ? html`<p class="text-sm text-text-secondary break-anywhere">${message}</p>`
            : nothing}
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="aiux-btn aiux-btn-primary aiux-btn-sm"
              @click=${this._onHistoryClick}
            >${i18n.getMessage('Race history')}</button>
            <button
              type="button"
              class="aiux-btn aiux-btn-ghost aiux-btn-sm"
              @click=${this._onNewRaceClick}
            >${i18n.getMessage('Start a race')}</button>
          </div>
        </div>
      </section>
    `;
  }

  /**
   * @description The toolbar: the race heading, "Run the race anyway", presenter mode and the
   *   shortcut list.
   * @param {Object} race - The stored race.
   * @returns {import('lit').TemplateResult} The toolbar.
   * @since 1.0.0
   */
  _renderToolbar(race) {
    const shortcuts = [
      {key: i18n.getMessage('Space'), action: i18n.getMessage('Skip to the result')},
      {key: 'R', action: i18n.getMessage('Replay')},
      {key: 'N', action: i18n.getMessage('New race')},
      {key: 'F', action: i18n.getMessage('Presenter mode')},
      {key: i18n.getMessage('Esc'), action: i18n.getMessage('Leave full screen')}
    ];
    return html`
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="me-auto text-lg font-semibold text-text-primary break-anywhere">
          ${i18n.getMessage('Replay of {number}: {title}', {
            number: race.number || '',
            title: race.title || ''
          })}
        </h1>
        ${this._instant
          ? html`<button
              type="button"
              class="aiux-btn aiux-btn-outline aiux-btn-sm"
              data-testid="run-anyway"
              @click=${this._onRunAnyway}
            >${i18n.getMessage('Run the race anyway')}</button>`
          : nothing}
        <button
          type="button"
          class="aiux-btn aiux-btn-ghost aiux-btn-sm"
          @click=${this._onNewRaceClick}
        >${i18n.getMessage('New race')}</button>
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
   * @description Renders the replay, or the not-found or "Marshals only" panel. Pure and
   *   server-safe: the stage mounts only after hydration, once the motion preference is known.
   * @returns {import('lit').TemplateResult} The page template.
   * @since 1.0.0
   */
  render() {
    const {status, payload, message} = this.loaderData || {};
    let content;
    if (status === 'ok') {
      content = html`
        ${this._renderToolbar(payload.race)}
        <div class="stage-shell" data-testid="stage-shell">
          ${this._ready
            ? html`<ss-race-stage
                .race=${payload}
                .replay=${true}
                .instant=${this._instant}
                .reducedMotion=${this._reducedMotion}
                @ss-result:action=${this._onResultAction}
              ></ss-race-stage>`
            : html`<div class="aiux-skeleton h-full w-full rounded-xl" aria-hidden="true"></div>`}
        </div>
      `;
    } else if (status === 'forbidden') {
      content = this._renderForbidden();
    } else {
      content = this._renderNotFound(message || '');
    }
    return html`
      <div class="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 lg:p-6">
        <div id="arena" class="arena" data-testid="arena" data-status=${status || 'not_found'}>
          ${content}
        </div>
        <p class="sr-only" role="status" aria-live="polite">${this._announcement}</p>
      </div>
    `;
  }
}
