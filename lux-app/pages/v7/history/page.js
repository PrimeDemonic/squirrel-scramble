import {html, css} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement, decorators} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';
import {navigate} from '@servicenow/aiux/aiux-client';
import '@servicenow/aiux/aiux-components-list';
import {ListDataManager} from '@servicenow/aiux/aiux-components-list';
import {setDocumentTitle} from '../../../utils/document-title.js';
import {repairStaleShell} from '../../../utils/shell.js';
import {replayRoute, routeFor} from '../../../utils/routes.js';

const {global, roles} = decorators;

const RACE_TABLE = 'x_crli_squirrel_race';
// Newest first, as the classic Race list is ordered (SPEC.md § 5 layouts).
const HISTORY_QUERY = 'ORDERBYDESCsys_created_on';
const SYS_ID_PATTERN = /^[0-9a-f]{32}$/;
// List UI actions that mean "make a new race"; the page sends them to the race page instead.
const NEW_RECORD_ACTIONS = new Set(['new_record', 'sysverb_new']);

/**
 * The history page of Squirrel Scramble, at routeFor('history') in utils/routes.js (SPEC.md
 * § 8): recent races in aiux-list-connected on the Race table, with the classic list's columns,
 * filters and search. Selecting a race opens its replay at replayRoute(<sys_id>); a middle-click
 * or Ctrl-click opens the replay in a new tab.
 *
 * The list reads the table as the signed-in user, so the Race read ACL (marshal) decides what
 * shows. The host is display: contents, which the list needs to inherit the nav layout's height.
 */
// Scoped to this app's experience; @roles writes sys_aix_page.roles (SPEC.md § 6).
@global(false)
@roles(['x_crli_squirrel.marshal'])
@customElement('x-crli-squirrel-history-v7-page')
export default class HistoryPage extends AIUXElement {
  static styles = css`
    :host {
      display: contents;
    }
  `;

  /**
   * @description Prefetches the first page of races so the list renders on the server. A failed
   *   prefetch leaves data null and the list fetches for itself in the browser.
   * @param {Object} ctx - The route context.
   * @returns {Promise<{data: (Object|null), basePath: string}>} The list data and the app's base
   *   path (for new-tab replay links).
   * @since 1.0.0
   */
  static async loader(ctx) {
    const data = await ListDataManager.fetch({
      table: RACE_TABLE,
      query: HISTORY_QUERY,
      view: ''
    }).catch(() => null);
    const basePath = ctx && typeof ctx.basePath === 'string' ? ctx.basePath : '';
    return {data, basePath};
  }

  /**
   * @description Repairs a stale cached shell (utils/shell.js) and sets the tab title.
   * @returns {void}
   * @since 1.0.0
   */
  firstUpdated() {
    repairStaleShell(this);
    setDocumentTitle(i18n.getMessage('Race history'));
  }

  /**
   * @description Opens the replay of the race whose row was selected. Links to other records in
   *   the row (Run by, and Rematch of, which may point at a race that has gone) are left alone:
   *   only the row's own race is ever opened.
   * @param {CustomEvent} event - aiux-list-connected:reference-link-clicked.
   * @returns {void}
   * @since 1.0.0
   */
  _onRowLink = (event) => {
    const detail = event.detail || {};
    const sysId = detail.listSysId;
    const isRaceRow = detail.listTable === RACE_TABLE;
    const isOwnLink = !detail.referenceTable
      || (detail.referenceTable === RACE_TABLE
        && (!detail.referenceSysId || detail.referenceSysId === sysId));
    if (!isRaceRow || !isOwnLink || !SYS_ID_PATTERN.test(sysId || '')) {
      return;
    }
    if (detail.isPrimaryClick === false) {
      const {basePath = ''} = this.loaderData || {};
      window.open(`${basePath}${replayRoute(sysId)}`, '_blank', 'noopener');
      return;
    }
    navigate(replayRoute(sysId));
  };

  /**
   * @description Sends a list "New" action to the race setup instead of a blank record form.
   * @param {CustomEvent} event - aiux-list-connected:ui-action-clicked.
   * @returns {void}
   * @since 1.0.0
   */
  _onUiAction = (event) => {
    const uiAction = event.detail ? event.detail.uiAction : null;
    if (uiAction && NEW_RECORD_ACTIONS.has(uiAction.name)) {
      navigate(routeFor('play'));
    }
  };

  /**
   * @description Renders the heading and the race list. Pure and server-safe.
   * @returns {import('lit').TemplateResult} The page template.
   * @since 1.0.0
   */
  render() {
    const {data} = this.loaderData || {};
    return html`
      <div class="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 lg:p-8">
        <div class="flex flex-col gap-2">
          <h1 class="text-3xl font-bold tracking-tight text-text-primary">
            ${i18n.getMessage('Race history')}
          </h1>
          <p class="max-w-3xl text-base text-text-secondary">
            ${i18n.getMessage('Every race is kept. Select a race number to watch its replay: it looks exactly like the original and can never change who won.')}
          </p>
        </div>
        <section class="aiux-card border border-base-300 bg-base-100 shadow-sm">
          <div class="aiux-card-body p-6">
            <aiux-list-connected
              table=${RACE_TABLE}
              .query=${HISTORY_QUERY}
              .data=${data}
              .listOptions=${{
                heading: i18n.getMessage('Recent races'),
                selectionEnabled: false,
                selectAllEnabled: false,
                showRefreshButton: true,
                showZingSearch: true,
                showConditionBuilderButton: true,
                showEditColumnsButton: false,
                showCopyURLButton: false,
                showCount: true
              }}
              @aiux-list-connected:reference-link-clicked=${this._onRowLink}
              @aiux-list-connected:ui-action-clicked=${this._onUiAction}
            ></aiux-list-connected>
          </div>
        </section>
      </div>
    `;
  }
}
