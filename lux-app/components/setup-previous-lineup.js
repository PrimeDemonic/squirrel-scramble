/**
 * "Load a previous line-up" for the setup view (SPEC.md § 8): the 10 most recent races from
 * GET /races, then the chosen race's names and outfits from GET /races/{sys_id}.
 *
 * The list is fetched only when the marshal opens it, never during server rendering. The chosen
 * race becomes the new race's rematchOf: this component emits ss-previous:lineup with the names
 * (in lane order), their stored outfits, the race's own sys_id and number, and its stored Chaos
 * level (null for Classic). It never reads or follows the loaded race's own rematchOf, which can
 * be null when its original has gone.
 *
 * GET /races returns a plain array of summaries (sysId, number, title, mode, state, winner,
 * runnerUp, entrantCount, runOn, rematchOf). They are still read defensively, so a missing field
 * leaves that part of the row blank instead of breaking the list.
 */
import {html, css, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {repeat} from 'lit/directives/repeat.js';
import {AIUXElement} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';
import {getRace, recentRaces} from '../lib/api.js';
import {buildLabels, labelFor} from './labels.js';

const RECENT_LIMIT = 10;
const SYS_ID_PATTERN = /^[0-9a-f]{32}$/;
// "2026-10-22 14:03:11", the platform's stored (UTC) date-time form.
const GLIDE_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * @description Returns the first argument that is a non-empty string.
 * @param {...*} candidates - Values to try in order.
 * @returns {string} The first non-empty string, or ''.
 * @since 1.0.0
 */
function firstString(...candidates) {
  const found = candidates.find((value) => typeof value === 'string' && value.trim() !== '');
  return found ? found.trim() : '';
}

/**
 * @description Reads an entrant count that may arrive as a number, a numeric string or a list.
 * @param {...*} candidates - Values to try in order.
 * @returns {number|null} The count, or null when none is usable.
 * @since 1.0.0
 */
function firstCount(...candidates) {
  for (let index = 0; index < candidates.length; index += 1) {
    const value = candidates[index];
    if (Array.isArray(value)) {
      return value.length;
    }
    const parsed = typeof value === 'number' ? value : parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
}

/**
 * @description Normalises one GET /races summary.
 * @param {*} item - One summary as the server sent it.
 * @returns {{sysId: string, number: string, title: string, mode: string, runOn: string,
 *   entrantCount: (number|null)}|null} The summary, or null when it has no usable sys_id.
 * @since 1.0.0
 */
function toSummary(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const sysId = firstString(item.sysId, item.sys_id);
  if (!SYS_ID_PATTERN.test(sysId)) {
    return null;
  }
  return {
    sysId,
    number: firstString(item.number),
    title: firstString(item.title),
    mode: firstString(item.mode),
    runOn: firstString(item.runOn, item.run_on, item.sys_created_on),
    entrantCount: firstCount(item.entrantCount, item.entrant_count, item.entrants)
  };
}

/**
 * @description Formats a stored UTC date-time for the marshal's locale and time zone. A value in
 *   any other shape is shown as it came.
 * @param {string} value - The stored value.
 * @param {string|undefined} locale - A BCP 47 locale, or undefined for the runtime default.
 * @returns {string} The display text.
 * @since 1.0.0
 */
function formatRunOn(value, locale) {
  const match = GLIDE_DATE_TIME.exec(value);
  if (!match) {
    return value;
  }
  const [, year, month, day, hour, minute, second] = match;
  const instant = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1,
    parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10), parseInt(second || '0', 10)));
  try {
    return new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeStyle: 'short'})
      .format(instant);
  } catch {
    return value;
  }
}

/**
 * @description Turns an API failure into a sentence.
 * @param {*} error - A RaceApiError or anything thrown.
 * @returns {string} The message to show.
 * @since 1.0.0
 */
function describeError(error) {
  if (error && error.code === 'forbidden') {
    return i18n.getMessage('Marshals only: loading a line-up needs the marshal role.');
  }
  if (error && error.code === 'not_found') {
    return i18n.getMessage('That race could not be found.');
  }
  if (error && typeof error.message === 'string' && error.message) {
    return error.message;
  }
  return i18n.getMessage('Something went wrong while loading races.');
}

/**
 * The recent-races picker. Emits ss-previous:lineup with {names, outfits, sysId, number, title,
 * chaosLevel}.
 */
@customElement('ss-setup-previous-lineup')
export class SetupPreviousLineup extends AIUXElement {
  static properties = {
    disabled: {type: Boolean},
    locale: {type: String},
    _expanded: {state: true},
    _status: {state: true},
    _races: {state: true},
    _message: {state: true}
  };

  static styles = css`
    :host {
      display: block;
    }

    .race-button {
      display: flex;
      width: 100%;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.125rem;
      height: auto;
      min-height: 2.75rem;
      padding-block: 0.5rem;
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
    this.locale = undefined;
    this._expanded = false;
    this._status = 'idle';
    this._races = [];
    this._message = '';
    this._ticket = 0;
  }

  /**
   * @description Ignores answers that arrive after the picker has left the page.
   * @returns {void}
   * @since 1.0.0
   */
  disconnectedCallback() {
    super.disconnectedCallback();
    this._ticket += 1;
  }

  /**
   * @description Opens the list (and loads the recent races) or closes it.
   * @returns {void}
   * @since 1.0.0
   */
  _onToggle = () => {
    this._expanded = !this._expanded;
    if (this._expanded) {
      this._loadRecent();
    }
  };

  /**
   * @description Loads the most recent races from GET /races.
   * @returns {Promise<void>}
   * @since 1.0.0
   */
  async _loadRecent() {
    this._ticket += 1;
    const ticket = this._ticket;
    this._status = 'loading';
    try {
      const found = await recentRaces(RECENT_LIMIT);
      if (ticket !== this._ticket) {
        return;
      }
      this._races = (Array.isArray(found) ? found : []).map(toSummary).filter(Boolean);
      this._status = 'ready';
    } catch (error) {
      if (ticket !== this._ticket) {
        return;
      }
      this._races = [];
      this._status = 'error';
      this._message = describeError(error);
    }
  }

  /**
   * @description Loads the clicked race (one handler for every row, read from data-sys-id) and
   *   hands its line-up to the setup view.
   * @param {MouseEvent} event - The click event.
   * @returns {Promise<void>}
   * @since 1.0.0
   */
  _onRaceClick = async (event) => {
    const sysId = event.currentTarget.dataset.sysId;
    if (!SYS_ID_PATTERN.test(sysId || '')) {
      return;
    }
    this._ticket += 1;
    const ticket = this._ticket;
    this._status = 'loading-race';
    try {
      const payload = await getRace(sysId);
      if (ticket !== this._ticket) {
        return;
      }
      const race = payload && payload.race ? payload.race : {};
      const entrants = (payload && Array.isArray(payload.entrants) ? payload.entrants : [])
        .slice()
        .sort((first, second) => (first.lane || 0) - (second.lane || 0));
      const names = entrants.map((entrant) => (
        typeof entrant.name === 'string' ? entrant.name : ''
      ));
      const outfits = entrants.map((entrant) => (
        entrant.outfit && typeof entrant.outfit === 'object' ? {...entrant.outfit} : {}
      ));
      this._expanded = false;
      this._status = 'loaded';
      this._message = firstString(race.number, sysId);
      this.dispatchEvent(new CustomEvent('ss-previous:lineup', {
        detail: {
          names,
          outfits,
          sysId: firstString(race.sysId, sysId),
          number: firstString(race.number),
          title: firstString(race.title),
          // The stored Chaos level (null for Classic), so the line-up keeps it.
          chaosLevel: firstString(race.chaosLevel) || null
        },
        bubbles: true,
        composed: true
      }));
    } catch (error) {
      if (ticket !== this._ticket) {
        return;
      }
      this._status = 'error';
      this._message = describeError(error);
    }
  };

  /**
   * @description The status line, announced politely.
   * @returns {string} The text, possibly empty.
   * @since 1.0.0
   */
  _statusText() {
    switch (this._status) {
      case 'loading':
        return i18n.getMessage('Loading recent races…');
      case 'loading-race':
        return i18n.getMessage('Loading that line-up…');
      case 'ready':
        return this._races.length === 0 ? i18n.getMessage('No races yet.') : '';
      case 'loaded':
        return i18n.getMessage('Loaded the line-up from {number}.', {number: this._message});
      case 'error':
        return this._message;
      default:
        return '';
    }
  }

  /**
   * @description One race in the list.
   * @param {Object} summary - A normalised summary.
   * @param {Object} labels - The label catalogue.
   * @returns {import('lit').TemplateResult} The row.
   * @since 1.0.0
   */
  _renderRace(summary, labels) {
    let count = '';
    if (summary.entrantCount === 1) {
      count = i18n.getMessage('1 squirrel');
    } else if (summary.entrantCount !== null) {
      count = i18n.getMessage('{count} squirrels', {count: summary.entrantCount});
    }
    const details = [
      summary.mode ? labelFor(labels.modes, summary.mode, summary.mode) : '',
      count,
      summary.runOn ? formatRunOn(summary.runOn, this.locale) : ''
    ].filter(Boolean).join(' · ');
    return html`
      <li>
        <button
          type="button"
          class="aiux-btn aiux-btn-ghost race-button"
          data-sys-id=${summary.sysId}
          ?disabled=${this.disabled || this._status === 'loading-race'}
          @click=${this._onRaceClick}
        >
          <span class="font-semibold">
            ${summary.number || summary.sysId}${summary.title ? ` · ${summary.title}` : nothing}
          </span>
          ${details ? html`<span class="text-xs text-text-secondary">${details}</span>` : nothing}
        </button>
      </li>
    `;
  }

  /**
   * @description Renders the toggle, the list and the status line. Pure and server-safe.
   * @returns {import('lit').TemplateResult} The template.
   * @since 1.0.0
   */
  render() {
    const labels = buildLabels(i18n);
    const showList = this._expanded && this._status === 'ready' && this._races.length > 0;
    const isError = this._status === 'error';
    const busy = this._status === 'loading' || this._status === 'loading-race';
    return html`
      <div class="flex flex-col gap-1">
        <span class="text-sm font-semibold text-text-primary" id="previous-heading">
          ${i18n.getMessage('Load a previous line-up')}
        </span>
        <div>
          <button
            type="button"
            class="aiux-btn aiux-btn-outline aiux-btn-sm"
            aria-expanded=${this._expanded ? 'true' : 'false'}
            aria-controls="recent-races"
            aria-describedby="previous-heading"
            ?disabled=${this.disabled}
            @click=${this._onToggle}
          >
            ${this._expanded
              ? i18n.getMessage('Hide recent races')
              : i18n.getMessage('Show recent races')}
          </button>
        </div>
        <ul
          id="recent-races"
          class="mt-1 flex flex-col gap-1"
          aria-labelledby="previous-heading"
          ?hidden=${!showList}
        >
          ${repeat(this._races, (summary) => summary.sysId,
            (summary) => this._renderRace(summary, labels))}
        </ul>
        <p
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
