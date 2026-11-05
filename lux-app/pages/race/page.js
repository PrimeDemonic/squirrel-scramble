import {html, css} from 'lit';
import {customElement} from 'lit/decorators.js';
import {AIUXElement, decorators} from '@servicenow/aiux/aiux-components-core';
import {i18n} from '@servicenow/aiux/aiux-services';
import {navigate} from '@servicenow/aiux/aiux-client';
import {setDocumentTitle} from '../../utils/document-title.js';
import {repairStaleShell} from '../../utils/shell.js';
import {playRoute} from '../../utils/routes.js';

const {global, roles} = decorators;

const SYS_ID_PATTERN = /^[0-9a-f]{32}$/;

/**
 * The /race page of Squirrel Scramble: a redirect to the race page at playRoute() in
 * utils/routes.js. Why it exists: the Lux service has cached the M0 app shell, whose sidebar
 * "Race" item links to /race and can't be changed, so /race needs a working destination.
 *
 * On the client it navigates straight away (replacing the history entry, so Back doesn't bounce
 * here again), keeping a valid ?rematch=<sys_id>. While the scripts load it shows "Taking you to
 * the race…" with a plain link to the same place. Its path stays /race on every route-version
 * bump; only its tag is versioned with the other pages (utils/routes.js, the bump procedure).
 */
// Scoped to this app's experience; @roles writes sys_aix_page.roles (SPEC.md § 6).
@global(false)
@roles(['x_crli_squirrel.marshal'])
@customElement('x-crli-squirrel-race-redirect-v7-page')
export default class RaceRedirectPage extends AIUXElement {
  static styles = css`
    :host {
      display: block;
    }
  `;

  /**
   * @description Works out where to send the marshal: the race page, with ?rematch= kept when it
   *   holds a sys_id. Runs on the server and the client; it fetches nothing.
   * @param {Object} ctx - The route context.
   * @returns {Promise<{target: string, basePath: string}>} The app-relative target and the app's
   *   base path (for the fallback link's href).
   * @since 1.0.0
   */
  static async loader(ctx) {
    const query = ctx && ctx.query ? ctx.query : {};
    const rematch = typeof query.rematch === 'string' && SYS_ID_PATTERN.test(query.rematch)
      ? query.rematch
      : '';
    const basePath = ctx && typeof ctx.basePath === 'string' ? ctx.basePath : '';
    return {target: playRoute({rematch}), basePath};
  }

  /**
   * @description Navigates to the race page as soon as the page is live in the browser. If the
   *   router refuses, a full page load gets there instead. It renders a message first, so it
   *   repairs a stale cached shell (utils/shell.js) before leaving, as the v7 pages do.
   * @returns {void}
   * @since 1.0.0
   */
  firstUpdated() {
    repairStaleShell(this);
    setDocumentTitle(i18n.getMessage('Taking you to the race'));
    const {target = playRoute(), basePath = ''} = this.loaderData || {};
    try {
      navigate(target, {replace: true});
    } catch {
      window.location.assign(`${basePath}${target}`);
    }
  }

  /**
   * @description Renders the "Taking you to the race…" message and a link to the race page, for
   *   when the scripts are slow. Pure and server-safe.
   * @returns {import('lit').TemplateResult} The page template.
   * @since 1.0.0
   */
  render() {
    const {target = playRoute(), basePath = ''} = this.loaderData || {};
    return html`
      <div
        class="mx-auto flex max-w-3xl flex-col gap-3 p-4 lg:p-8"
        role="status"
        aria-live="polite"
        data-testid="race-redirect"
      >
        <p class="text-lg font-semibold text-text-primary">
          ${i18n.getMessage('Taking you to the race…')}
        </p>
        <p class="text-sm text-text-secondary">
          <a
            class="aiux-link aiux-link-primary"
            href="${basePath}${target}"
            data-testid="race-redirect-link"
          >${i18n.getMessage('Open the race page')}</a>
        </p>
      </div>
    `;
  }
}
