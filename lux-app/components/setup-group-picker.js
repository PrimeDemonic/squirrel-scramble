/**
 * "Load a group" for the setup view (SPEC.md § 8): a type-ahead against GET /groups, then the
 * group's active members from GET /groups/{sys_id}/members.
 *
 * The matches show as a list of native buttons under a search box: Tab or the arrow keys reach
 * them (Down from the box, Up and Down between them, Escape back to the box). It does not touch
 * the names box itself: it emits ss-group:members with the member names and the setup view
 * decides, asking before it overwrites names already typed.
 *
 * Group and member names are rendered through Lit text bindings only.
 */
import {html, css, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {live} from 'lit/directives/live.js';
import {repeat} from 'lit/directives/repeat.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';
import {groupMembers, searchGroups} from '../lib/api.js';

// Wait this long after the last keystroke before asking the server.
const SEARCH_DELAY_MS = 300;
// GET /groups refuses shorter text (SPEC.md § 7).
const MIN_QUERY_LENGTH = 2;

/**
 * @description Says whether a value is a usable group from GET /groups.
 * @param {*} group - One item of the response.
 * @returns {boolean} True when it has a string sysId and name.
 * @since 1.0.0
 */
function isGroup(group) {
  return Boolean(group) && typeof group.sysId === 'string' && typeof group.name === 'string';
}

/**
 * @description Turns an API failure into a sentence for the status line.
 * @param {*} error - A RaceApiError or anything thrown.
 * @returns {string} The message to show.
 * @since 1.0.0
 */
function describeError(error) {
  if (error && error.code === 'forbidden') {
    return i18n.getMessage('Marshals only: loading a group needs the marshal role.');
  }
  if (error && typeof error.message === 'string' && error.message) {
    return error.message;
  }
  return i18n.getMessage('Something went wrong while loading groups.');
}

/**
 * The group type-ahead. Emits ss-group:members with {groupName, names} once a group's members
 * have loaded.
 */
@customElement('ss-setup-group-picker')
export class SetupGroupPicker extends AIUXElement {
  static properties = {
    disabled: {type: Boolean},
    _query: {state: true},
    _groups: {state: true},
    _status: {state: true},
    _message: {state: true}
  };

  static styles = css`
    :host {
      display: block;
    }

    .results {
      display: flex;
      max-height: 16rem;
      flex-direction: column;
      gap: 0.125rem;
      margin: 0;
      padding: 0.25rem;
      overflow-y: auto;
      list-style: none;
      border: 1px solid var(--color-base-300);
      border-radius: var(--radius-field, 0.5rem);
      background-color: var(--color-base-100);
    }

    .results[hidden] {
      display: none;
    }

    .result-button {
      width: 100%;
      height: auto;
      min-height: 2.25rem;
      justify-content: flex-start;
      text-align: start;
      overflow-wrap: anywhere;
    }
  `;

  /**
   * @description Sets the starting state.
   * @since 1.0.0
   */
  constructor() {
    super();
    this.disabled = false;
    this._query = '';
    this._groups = [];
    this._status = 'idle';
    this._message = '';
    this._searchTimer = null;
    this._searchTicket = 0;
  }

  /**
   * @description Cancels a pending search when the picker leaves the page.
   * @returns {void}
   * @since 1.0.0
   */
  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this._searchTimer);
    this._searchTicket += 1;
  }

  /**
   * @description Debounces a search as the marshal types.
   * @param {InputEvent} event - The input event.
   * @returns {void}
   * @since 1.0.0
   */
  _onInput = (event) => {
    const text = event.target.value;
    this._query = text;
    clearTimeout(this._searchTimer);
    this._searchTicket += 1;
    if (text.trim().length < MIN_QUERY_LENGTH) {
      this._groups = [];
      this._status = 'idle';
      return;
    }
    this._status = 'searching';
    this._searchTimer = setTimeout(() => {
      this._search(text);
    }, SEARCH_DELAY_MS);
  };

  /**
   * @description Asks GET /groups and shows the matches, ignoring answers that arrive after a
   *   newer search started.
   * @param {string} text - The search text.
   * @returns {Promise<void>}
   * @since 1.0.0
   */
  async _search(text) {
    this._searchTicket += 1;
    const ticket = this._searchTicket;
    try {
      const found = await searchGroups(text);
      if (ticket !== this._searchTicket) {
        return;
      }
      this._groups = Array.isArray(found) ? found.filter(isGroup) : [];
      this._status = this._groups.length > 0 ? 'results' : 'empty';
    } catch (error) {
      if (ticket !== this._searchTicket) {
        return;
      }
      this._groups = [];
      this._status = 'error';
      this._message = describeError(error);
    }
  }

  /**
   * @description The result buttons, in order.
   * @returns {HTMLButtonElement[]} The buttons.
   * @since 1.0.0
   */
  _resultButtons() {
    return Array.from(this.renderRoot.querySelectorAll('.result-button'));
  }

  /**
   * @description Down from the search box moves to the first match; Escape clears the box.
   * @param {KeyboardEvent} event - The key event.
   * @returns {void}
   * @since 1.0.0
   */
  _onSearchKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      const [firstButton] = this._resultButtons();
      if (firstButton) {
        event.preventDefault();
        firstButton.focus();
      }
    } else if (event.key === 'Escape' && this._query) {
      event.preventDefault();
      clearTimeout(this._searchTimer);
      this._searchTicket += 1;
      this._query = '';
      this._groups = [];
      this._status = 'idle';
    }
  };

  /**
   * @description Up and Down move between the matches; Escape (or Up from the first) goes back
   *   to the search box.
   * @param {KeyboardEvent} event - The key event.
   * @returns {void}
   * @since 1.0.0
   */
  _onResultKeyDown = (event) => {
    const buttons = this._resultButtons();
    const index = buttons.indexOf(event.currentTarget);
    const searchBox = this.renderRoot.querySelector('#group-search');
    if (event.key === 'ArrowDown' && index < buttons.length - 1) {
      event.preventDefault();
      buttons[index + 1].focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (index > 0) {
        buttons[index - 1].focus();
      } else if (searchBox) {
        searchBox.focus();
      }
    } else if (event.key === 'Escape' && searchBox) {
      event.preventDefault();
      searchBox.focus();
    }
  };

  /**
   * @description Picks the clicked group (one handler for every button, read from data-index).
   * @param {MouseEvent} event - The click event.
   * @returns {void}
   * @since 1.0.0
   */
  _onGroupClick = (event) => {
    const index = parseInt(event.currentTarget.dataset.index, 10);
    if (Number.isInteger(index) && this._groups[index]) {
      this._choose(this._groups[index]);
    }
  };

  /**
   * @description Loads the chosen group's active members and hands their names to the setup
   *   view, then puts focus back in the search box.
   * @param {{sysId: string, name: string}} group - The chosen group.
   * @returns {Promise<void>}
   * @since 1.0.0
   */
  async _choose(group) {
    this._groups = [];
    this._query = group.name;
    this._status = 'loading';
    this._message = group.name;
    try {
      const members = await groupMembers(group.sysId);
      const names = (Array.isArray(members) ? members : [])
        .map((member) => (member && typeof member.name === 'string' ? member.name : ''))
        .filter((name) => name.trim().length > 0);
      if (names.length === 0) {
        this._status = 'no-members';
        this._message = group.name;
        return;
      }
      this._status = 'loaded';
      this._message = group.name;
      this.dispatchEvent(new CustomEvent('ss-group:members', {
        detail: {groupName: group.name, names},
        bubbles: true,
        composed: true
      }));
    } catch (error) {
      this._status = 'error';
      this._message = describeError(error);
    } finally {
      await this.updateComplete;
      const searchBox = this.renderRoot.querySelector('#group-search');
      if (searchBox && !searchBox.disabled) {
        searchBox.focus();
      }
    }
  }

  /**
   * @description The status line under the box, announced politely.
   * @returns {string} The text, possibly empty.
   * @since 1.0.0
   */
  _statusText() {
    switch (this._status) {
      case 'searching':
        return i18n.getMessage('Searching groups…');
      case 'results':
        return this._groups.length === 1
          ? i18n.getMessage('1 group found. Press Down to reach it.')
          : i18n.getMessage('{count} groups found. Press Down to reach them.', {
            count: this._groups.length
          });
      case 'empty':
        return i18n.getMessage('No groups match that name.');
      case 'loading':
        return i18n.getMessage('Loading the members of {group}…', {group: this._message});
      case 'loaded':
        return i18n.getMessage('Loaded the members of {group}.', {group: this._message});
      case 'no-members':
        return i18n.getMessage('{group} has no active members.', {group: this._message});
      case 'error':
        return this._message;
      default:
        return '';
    }
  }

  /**
   * @description Renders the search box, the matching groups and the status line. Pure and
   *   server-safe.
   * @returns {import('lit').TemplateResult} The template.
   * @since 1.0.0
   */
  render() {
    const isError = this._status === 'error';
    const busy = this._status === 'loading';
    return html`
      <div class="flex flex-col gap-1">
        <label for="group-search" class="text-sm font-semibold text-text-primary">
          ${i18n.getMessage('Load a group')}
        </label>
        <input
          id="group-search"
          class="aiux-input w-full"
          type="search"
          autocomplete="off"
          aria-describedby="group-hint group-status"
          .value=${live(this._query)}
          ?disabled=${this.disabled || busy}
          @input=${this._onInput}
          @keydown=${this._onSearchKeyDown}
        />
        <ul
          class="results"
          aria-label=${i18n.getMessage('Matching groups')}
          ?hidden=${this._groups.length === 0}
          data-testid="group-results"
        >
          ${repeat(this._groups, (group) => group.sysId, (group, index) => html`
            <li>
              <button
                type="button"
                class="result-button aiux-btn aiux-btn-ghost aiux-btn-sm"
                data-index=${index}
                ?disabled=${this.disabled}
                @click=${this._onGroupClick}
                @keydown=${this._onResultKeyDown}
              >${group.name}</button>
            </li>
          `)}
        </ul>
        <p id="group-hint" class="text-xs text-text-secondary">
          ${i18n.getMessage('Type at least two letters of a group name, then pick the group.')}
        </p>
        <p
          id="group-status"
          class="min-h-4 text-xs ${isError ? 'text-error' : 'text-text-secondary'}"
          role="status"
          aria-live="polite"
        >
          ${busy ? html`<span class="aiux-loading aiux-loading-spinner aiux-loading-xs"
            aria-hidden="true"></span>` : nothing}
          ${this._statusText()}
        </p>
      </div>
    `;
  }
}
