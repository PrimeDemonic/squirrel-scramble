import {html, css, nothing} from 'lit';
import {customElement} from 'lit/decorators.js';
import {repeat} from 'lit/directives/repeat.js';
import {AIUXElement, decorators} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';
import {navigate} from '@servicenow/aiux/aiux-client';
import {toBcp47} from '@servicenow/aiux/aiux-locales/locale-mapping';
import {hallOfFame} from '../../../lib/api.js';
import {themeConfig} from '../../../lib/theme-config.js';
import {setDocumentTitle} from '../../../utils/document-title.js';
import {repairStaleShell} from '../../../utils/shell.js';
import {routeFor} from '../../../utils/routes.js';

const {global, roles} = decorators;

// GET /hall-of-fame caps the list at 25 (SPEC.md § 7).
const HALL_LIMIT = 25;
// "2026-10-22 14:03:11" or "2026-10-22", the platform's stored (UTC) forms.
const GLIDE_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * @description Reads a whole, non-negative number from the API, or 0.
 * @param {*} value - The value as sent.
 * @returns {number} The number.
 * @since 1.0.0
 */
function wholeNumber(value) {
  const parsed = typeof value === 'number' ? value : parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

/**
 * @description Normalises the GET /hall-of-fame list, dropping rows without a name.
 * @param {*} rows - The response.
 * @returns {Array<{name: string, wins: number, podiums: number, lastWin: string}>} The rows.
 * @since 1.0.0
 */
function toEntries(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row && typeof row.name === 'string' && row.name.trim() !== '')
    .map((row) => ({
      name: row.name,
      wins: wholeNumber(row.wins),
      podiums: wholeNumber(row.podiums),
      lastWin: typeof row.lastWin === 'string' ? row.lastWin : ''
    }));
}

/**
 * @description Competition ranks ("1, 2, 2, 4"): a row level on wins and podiums with the row
 *   above shares its rank. The server sorts the list; this only numbers it.
 * @param {Array<{wins: number, podiums: number}>} entries - The sorted rows.
 * @returns {number[]} One rank per row.
 * @since 1.0.0
 */
function competitionRanks(entries) {
  const ranks = [];
  entries.forEach((entry, index) => {
    const previous = entries[index - 1];
    const tied = previous && previous.wins === entry.wins && previous.podiums === entry.podiums;
    ranks.push(tied ? ranks[index - 1] : index + 1);
  });
  return ranks;
}

/**
 * @description Turns an API failure into loader state.
 * @param {*} error - A RaceApiError or anything thrown.
 * @returns {{status: string, entries: Array, message: string}} The state.
 * @since 1.0.0
 */
function failureState(error) {
  const code = error && typeof error.code === 'string' ? error.code : '';
  const message = error && typeof error.message === 'string' ? error.message : '';
  return {status: code === 'forbidden' ? 'forbidden' : 'error', entries: [], message};
}

/**
 * @description The marshal's display locale (see ss-setup.js): the browser's variant of the
 *   instance language when they agree, otherwise the instance language in BCP 47. Browser only.
 * @returns {string|undefined} A BCP 47 tag, or undefined for the runtime default.
 * @since 1.0.0
 */
function resolveLocale() {
  try {
    const documentLanguage = document.documentElement.lang || '';
    const browserLanguages = Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];
    const primary = documentLanguage.split('-')[0].toLowerCase();
    const sameLanguage = browserLanguages.find((tag) => (
      typeof tag === 'string' && tag.split('-')[0].toLowerCase() === primary
    ));
    const candidate = sameLanguage || (documentLanguage ? toBcp47(documentLanguage) : '')
      || browserLanguages[0];
    return Intl.DateTimeFormat.supportedLocalesOf([candidate]).length > 0 ? candidate : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The Hall of Fame page of Squirrel Scramble, at routeFor('hall-of-fame') in utils/routes.js
 * (SPEC.md § 8, § 15): the top winners and podium finishers across drawn races, from
 * GET /hall-of-fame (up to 25). Rank, name, wins, podiums and the date of the last win, with
 * medals for the top three and an empty state before the first race. Names render as text only.
 */
// Scoped to this app's experience; @roles writes sys_aix_page.roles (SPEC.md § 6).
@global(false)
@roles(['x_crli_squirrel.marshal'])
@customElement('x-crli-squirrel-hall-of-fame-v7-page')
export default class HallOfFamePage extends AIUXElement {
  static properties = {
    _locale: {state: true},
    _hydrated: {state: true},
    _reloaded: {state: true},
    _loading: {state: true}
  };

  static styles = css`
    :host {
      display: block;
    }

    .trophy-banner {
      border: 1px solid color-mix(in srgb, var(--color-warning) 45%, var(--color-base-300));
      border-radius: var(--radius-box, 1rem);
      background-image: linear-gradient(
        135deg,
        color-mix(in srgb, var(--color-warning) 28%, var(--color-base-100)) 0%,
        var(--color-base-100) 70%
      );
    }

    .trophy {
      font-size: 3.5rem;
      line-height: 1;
    }

    .name-cell {
      overflow-wrap: anywhere;
    }

    .numeric {
      font-variant-numeric: tabular-nums;
      text-align: end;
    }

    @media (forced-colors: active) {
      .trophy-banner {
        border-color: CanvasText;
      }
    }
  `;

  /**
   * @description Reads the Hall of Fame through GET /hall-of-fame (aiuxFetch, which carries the
   *   session on the server and in the browser). A failure becomes plain state.
   * @returns {Promise<{status: string, entries: Array, message: string}>} The loader data.
   * @since 1.0.0
   */
  static async loader() {
    try {
      const rows = await hallOfFame(HALL_LIMIT);
      return {status: 'ok', entries: toEntries(rows), message: ''};
    } catch (error) {
      return failureState(error);
    }
  }

  /**
   * @description Sets the starting state. No browser API here: this also runs on the server.
   * @since 1.0.0
   */
  constructor() {
    super();
    this._locale = undefined;
    this._hydrated = false;
    this._reloaded = null;
    this._loading = false;
  }

  /**
   * @description After hydration: picks up the locale (so dates and numbers format for the
   *   marshal), repairs a stale cached shell (utils/shell.js) and sets the tab title.
   * @returns {void}
   * @since 1.0.0
   */
  firstUpdated() {
    repairStaleShell(this);
    this._locale = resolveLocale();
    this._hydrated = true;
    setDocumentTitle(i18n.getMessage('Hall of Fame'));
  }

  /**
   * @description The data to show: a reload's result when there is one, otherwise the loader's.
   * @returns {{status: string, entries: Array, message: string}} The state.
   * @since 1.0.0
   */
  _state() {
    return this._reloaded || this.loaderData || {status: 'error', entries: [], message: ''};
  }

  /**
   * @description Tries GET /hall-of-fame again after a failure.
   * @returns {Promise<void>}
   * @since 1.0.0
   */
  _onRetry = async () => {
    this._loading = true;
    try {
      const rows = await hallOfFame(HALL_LIMIT);
      this._reloaded = {status: 'ok', entries: toEntries(rows), message: ''};
    } catch (error) {
      this._reloaded = failureState(error);
    } finally {
      this._loading = false;
    }
  };

  /**
   * @description The empty state's "Start a race" button.
   * @returns {void}
   * @since 1.0.0
   */
  _onStartRace = () => {
    navigate(routeFor('play'));
  };

  /**
   * @description Formats a whole number for the marshal. Before hydration it uses plain digits,
   *   so the server's and the browser's first render match.
   * @param {number} value - The number.
   * @returns {string} The formatted number.
   * @since 1.0.0
   */
  _formatNumber(value) {
    if (!this._hydrated) {
      return String(value);
    }
    try {
      return new Intl.NumberFormat(this._locale).format(value);
    } catch {
      return String(value);
    }
  }

  /**
   * @description Formats the last-win date. Before hydration it shows the stored date part, so
   *   the server's and the browser's first render match; after, the marshal's own format.
   * @param {string} value - The stored UTC date or date-time.
   * @returns {string} The display text.
   * @since 1.0.0
   */
  _formatDate(value) {
    const match = GLIDE_DATE_TIME.exec(value || '');
    if (!match) {
      return value || '';
    }
    if (!this._hydrated) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
    const [, year, month, day, hour, minute, second] = match;
    const instant = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1,
      parseInt(day, 10), parseInt(hour || '0', 10), parseInt(minute || '0', 10),
      parseInt(second || '0', 10)));
    try {
      return new Intl.DateTimeFormat(this._locale, {dateStyle: 'medium'}).format(instant);
    } catch {
      return value;
    }
  }

  /**
   * @description The trophy banner at the top of the page.
   * @returns {import('lit').TemplateResult} The banner.
   * @since 1.0.0
   */
  _renderBanner() {
    return html`
      <header class="trophy-banner flex flex-wrap items-center gap-4 p-6">
        <span class="trophy" aria-hidden="true">🏆</span>
        <div class="flex min-w-0 flex-col gap-1">
          <h1 class="text-3xl font-bold tracking-tight text-text-primary">
            ${i18n.getMessage('Hall of Fame')}
          </h1>
          <p class="text-base text-text-secondary">
            ${i18n.getMessage('The most decorated climbers in the forest. Every squirrel has equal odds; these ones keep getting lucky.')}
          </p>
        </div>
      </header>
    `;
  }

  /**
   * @description The leaderboard table.
   * @param {Array<{name: string, wins: number, podiums: number, lastWin: string}>} entries - The
   *   rows.
   * @returns {import('lit').TemplateResult} The table.
   * @since 1.0.0
   */
  _renderTable(entries) {
    const ranks = competitionRanks(entries);
    const medals = themeConfig.emoji.medals;
    return html`
      <section class="aiux-card border border-base-300 bg-base-100 shadow-sm">
        <div class="aiux-card-body overflow-x-auto p-4 lg:p-6">
          <table class="aiux-table" data-testid="hall-of-fame-table">
            <caption class="sr-only">
              ${i18n.getMessage('Top winners, with their wins, podium finishes and last win')}
            </caption>
            <thead>
              <tr>
                <th scope="col">${i18n.getMessage('Rank')}</th>
                <th scope="col">${i18n.getMessage('Squirrel')}</th>
                <th scope="col" class="numeric">${i18n.getMessage('Wins')}</th>
                <th scope="col" class="numeric">${i18n.getMessage('Podiums')}</th>
                <th scope="col">${i18n.getMessage('Last win')}</th>
              </tr>
            </thead>
            <tbody>
              ${repeat(entries, (entry, index) => `${index}:${entry.name}`, (entry, index) => {
                const rank = ranks[index];
                const medal = rank <= medals.length
                  ? html`<span aria-hidden="true">${medals[rank - 1]}</span>`
                  : nothing;
                const lastWin = entry.lastWin
                  ? this._formatDate(entry.lastWin)
                  : i18n.getMessage('Not yet');
                return html`
                  <tr data-testid="hall-of-fame-row">
                    <td class="whitespace-nowrap font-bold">
                      ${medal}
                      ${this._formatNumber(rank)}
                    </td>
                    <th scope="row" class="name-cell font-semibold">${entry.name}</th>
                    <td class="numeric">${this._formatNumber(entry.wins)}</td>
                    <td class="numeric">${this._formatNumber(entry.podiums)}</td>
                    <td class="whitespace-nowrap">${lastWin}</td>
                  </tr>
                `;
              })}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  /**
   * @description The empty state before the first race.
   * @returns {import('lit').TemplateResult} The empty state.
   * @since 1.0.0
   */
  _renderEmpty() {
    return html`
      <section
        class="aiux-card border border-base-300 bg-base-100 shadow-sm"
        aria-labelledby="empty-heading"
        data-testid="hall-of-fame-empty"
      >
        <div class="aiux-card-body items-start gap-3 p-6">
          <h2 id="empty-heading" class="text-xl font-semibold text-text-primary">
            ${i18n.getMessage('No races yet')}
          </h2>
          <p class="text-base text-text-secondary">
            ${i18n.getMessage('The Hall of Fame fills up as races are run. Run the first one!')}
          </p>
          <button
            type="button"
            class="aiux-btn aiux-btn-primary aiux-btn-sm"
            @click=${this._onStartRace}
          >${i18n.getMessage('Start a race')}</button>
        </div>
      </section>
    `;
  }

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
          <h2 id="forbidden-heading" class="text-xl font-semibold text-text-primary">
            ${i18n.getMessage('Marshals only')}
          </h2>
          <p class="text-base text-text-secondary">
            ${i18n.getMessage('Squirrel Scramble races are run by marshals. Ask your administrator for the Squirrel Scramble marshal role, then reload this page.')}
          </p>
        </div>
      </section>
    `;
  }

  /**
   * @description The error state, with the server's message as text and a retry button.
   * @param {string} message - The server's message.
   * @returns {import('lit').TemplateResult} The alert.
   * @since 1.0.0
   */
  _renderError(message) {
    return html`
      <div
        class="aiux-alert aiux-alert-error aiux-alert-soft flex flex-col items-start gap-2"
        role="alert"
        data-testid="hall-of-fame-error"
      >
        <p class="font-semibold">${i18n.getMessage('The Hall of Fame could not be loaded.')}</p>
        ${message ? html`<p class="name-cell">${message}</p>` : nothing}
        <button
          type="button"
          class="aiux-btn aiux-btn-sm"
          ?disabled=${this._loading}
          @click=${this._onRetry}
        >
          ${this._loading
            ? html`<span class="aiux-loading aiux-loading-spinner aiux-loading-xs"
              aria-hidden="true"></span>`
            : nothing}
          ${i18n.getMessage('Try again')}
        </button>
      </div>
    `;
  }

  /**
   * @description Renders the banner and the table, empty state, error or "Marshals only".
   *   Pure and server-safe.
   * @returns {import('lit').TemplateResult} The page template.
   * @since 1.0.0
   */
  render() {
    const {status, entries = [], message = ''} = this._state();
    let content;
    if (status === 'forbidden') {
      content = this._renderForbidden();
    } else if (status !== 'ok') {
      content = this._renderError(message);
    } else if (entries.length === 0) {
      content = this._renderEmpty();
    } else {
      content = this._renderTable(entries);
    }
    return html`
      <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 lg:p-8">
        ${this._renderBanner()}
        ${content}
      </div>
    `;
  }
}
