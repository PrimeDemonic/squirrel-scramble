/**
 * The Squirrel Scramble shell, wired to the platform: sets navLayoutContext from the one nav
 * builder (utils/shell-nav.js), and lets a page repair a stale shell.
 *
 * Why the repair: the Lux rendering service kept serving a cached older application.js (the v5
 * shell), whose nav items point at /v5/ routes that no longer exist and which lacks
 * features.chat: false (Chaos v2 contract § 13; SPEC.md § 23, decision 9). So every v7 page
 * calls repairStaleShell(this) from firstUpdated(): it sets the current nav items and features,
 * and asks the nav layout to hide the chat bar. With a fresh shell it changes nothing that shows.
 *
 * Client only for the repair: pages call it from firstUpdated(), never from render() or the
 * constructor. On the server it does nothing.
 */
import {isServer} from 'lit';
import {navLayoutContext} from '@servicenow/aiux/aiux-components-nav';
import {i18n} from '@servicenow/aiux/aiux-services';
import {
  CHAT_VISIBILITY_EVENT,
  buildShellState,
  createNavItems,
  routePathFromPathname
} from './shell-nav.js';

/**
 * @description Builds the four nav items in the current language, with the active page marked
 *   (a replay marks History).
 * @param {string} activePath - The active app route, for example '/v7/wardrobe'.
 * @returns {Array<Object>} The nav items.
 * @throws {never} Never throws.
 * @example
 *   buildNavItems(routeFor('history'));
 * @since 1.0.0
 */
export function buildNavItems(activePath) {
  return createNavItems(i18n, activePath);
}

/**
 * @description Sets navLayoutContext: the app title, the shell features (chat and onboarding
 *   off) and the nav items, over whatever the context already holds.
 * @param {string} activePath - The active app route, for example '/v7/play'.
 * @returns {boolean} True when the context was set; false when there is no context to set.
 * @throws {Error} Whatever navLayoutContext.set() throws; repairStaleShell() catches it.
 * @example
 *   applyShellNav(routeFor('play'));
 * @since 1.0.0
 */
export function applyShellNav(activePath) {
  const context = navLayoutContext;
  if (!context || typeof context.get !== 'function' || typeof context.set !== 'function') {
    return false;
  }
  context.set(buildShellState(context.get(), i18n, activePath));
  return true;
}

/**
 * @description Reads the current app route from the browser address.
 * @returns {string} The app route, for example '/v7/history'; '' when there is no location.
 * @throws {never} Never throws.
 * @example
 *   currentRoutePath(); // '/v7/history' at /aiux/scramble-v7/v7/history
 * @since 1.0.0
 */
function currentRoutePath() {
  if (typeof window === 'undefined' || !window.location) {
    return '';
  }
  return routePathFromPathname(window.location.pathname);
}

/**
 * @description Repairs a stale cached shell from the page: sets the current nav items and
 *   features for the current route, then dispatches the chat-visibility event from the page so
 *   the nav layout hides the chat bar. Client only (a no-op on the server), and never throws: a
 *   missing context or host is skipped, and each step's failure is swallowed so the page still
 *   works.
 * @param {HTMLElement} hostElement - The page element; the event bubbles out of its shadow root
 *   to the nav layout.
 * @returns {void}
 * @throws {never} Never throws.
 * @example
 *   firstUpdated() {
 *     repairStaleShell(this);
 *   }
 * @since 1.0.0
 */
export function repairStaleShell(hostElement) {
  if (isServer || typeof window === 'undefined') {
    return;
  }
  try {
    applyShellNav(currentRoutePath());
  } catch {
    // The nav repair is cosmetic: the page works without it.
  }
  try {
    if (hostElement && typeof hostElement.dispatchEvent === 'function'
      && typeof CustomEvent === 'function') {
      hostElement.dispatchEvent(new CustomEvent(CHAT_VISIBILITY_EVENT, {
        detail: {hidden: true},
        bubbles: true,
        composed: true
      }));
    }
  } catch {
    // Hiding the chat bar is cosmetic too.
  }
}
