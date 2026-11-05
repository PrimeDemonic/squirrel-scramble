/**
 * The Squirrel Scramble shell, as plain data: the four nav items, the shell features, the whole
 * navLayoutContext value, and the app route read from a browser path. The one place the nav list
 * is written: application.js setup() and the pages' repair (utils/shell.js) both build from here.
 *
 * The module has no platform imports on purpose: the i18n service is passed in, so the Node tests
 * can run it with a stub, and the build still sees literal i18n.getMessage() calls (the i18n lint
 * rule getmessage-no-variable-arg and the string extractor accept only a literal argument, as in
 * components/audio/sound-labels.js). Paths come from utils/routes.js, which has no imports either.
 */
import {REPLAY_ROUTE_PREFIX, routeFor} from './routes.js';

/**
 * Routes that belong to a nav item without being its own path: a replay is opened from the
 * History page, so History stays highlighted while it plays.
 */
const ACTIVE_PREFIXES = Object.freeze({
  [routeFor('history')]: Object.freeze([REPLAY_ROUTE_PREFIX])
});

/**
 * The shell features (Chaos v2 contract § 13). Two are off for the race: chat, so the shell's
 * "Ask or search for anything" bar never shows, and onboarding, so the "Get to know Lux" popup
 * never covers the stage.
 */
export const SHELL_FEATURES = Object.freeze({
  menus: false,
  logo: true,
  userSession: false,
  notifications: false,
  themeToggle: false,
  densityPicker: false,
  unifiedExperience: false,
  profile: true,
  helpPanel: true,
  chat: false,
  onboarding: false
});

/**
 * The event the nav layout's ChatController listens for on its host
 * (handleChatVisibilityChange): detail.hidden true hides the chat bar for the page.
 */
export const CHAT_VISIBILITY_EVENT = 'aiux-chat-visibility-change';

/** The Lux URL prefix: /aiux/<basename>, the basename being aiux.json's. */
const AIUX_PREFIX = /^\/aiux\/[^/]+(?=\/|$)/;

/**
 * @description Says whether a nav item should show as the current page.
 * @param {{action?: {path?: string}}} item - The nav item.
 * @param {string} activePath - The active app route: routeFor('play'), say, or a replay's
 *   REPLAY_ROUTE_PREFIX followed by '/<sys_id>' (or the route pattern's '/:id').
 * @returns {boolean} True when the item's path or one of its extra prefixes matches.
 * @throws {never} Never throws.
 * @example
 *   isItemActive({action: {path: '/v7/history'}}, '/v7/replay/abc'); // true
 * @since 1.0.0
 */
export function isItemActive(item, activePath) {
  const itemPath = item && item.action ? item.action.path : '';
  if (!itemPath || typeof activePath !== 'string' || !activePath) {
    return false;
  }
  if (activePath === itemPath) {
    return true;
  }
  const prefixes = ACTIVE_PREFIXES[itemPath] || [];
  return prefixes.some((prefix) => activePath.startsWith(prefix));
}

/**
 * @description Builds the four nav items (Race, History, Hall of Fame, Wardrobe) under the
 *   current route version, with the current page's item marked active. Icon names are native
 *   Horizon icons from the installed @servicenow/aiux icon list.
 * @param {{getMessage: function(string, ...*): string}} i18n - The AIUX i18n service, or a stub.
 * @param {string} activePath - The active app route, for example '/v7/wardrobe'; empty marks
 *   nothing.
 * @returns {Array<Object>} New item objects; only the active one carries active: true.
 * @throws {never} Never throws for a service whose getMessage doesn't.
 * @example
 *   createNavItems(i18n, '/v7/replay/abc').find((item) => item.active).icon; // 'history'
 * @since 1.0.0
 */
export function createNavItems(i18n, activePath) {
  const items = [
    {
      icon: 'flag-event',
      title: i18n.getMessage('Race'),
      action: {type: 'navigate', path: routeFor('play')}
    },
    {
      icon: 'history',
      title: i18n.getMessage('History'),
      action: {type: 'navigate', path: routeFor('history')}
    },
    {
      icon: 'star',
      title: i18n.getMessage('Hall of Fame'),
      action: {type: 'navigate', path: routeFor('hall-of-fame')}
    },
    {
      icon: 'palette',
      title: i18n.getMessage('Wardrobe'),
      action: {type: 'navigate', path: routeFor('wardrobe')}
    }
  ];
  return items.map((item) => (isItemActive(item, activePath) ? {...item, active: true} : item));
}

/**
 * @description Builds the whole navLayoutContext value: the current value kept, with the app
 *   title, the shell features, the nav items and the logos set over it.
 * @param {Object|null|undefined} current - navLayoutContext.get(), or nothing.
 * @param {{getMessage: function(string, ...*): string}} i18n - The AIUX i18n service, or a stub.
 * @param {string} activePath - The active app route; see createNavItems().
 * @returns {Object} The new value to set.
 * @throws {never} Never throws for a service whose getMessage doesn't.
 * @example
 *   navLayoutContext.set(buildShellState(navLayoutContext.get(), i18n, '/v7/play'));
 * @since 1.0.0
 */
export function buildShellState(current, i18n, activePath) {
  const base = current && typeof current === 'object' ? current : {};
  return {
    ...base,
    appTitle: i18n.getMessage('Squirrel Scramble'),
    features: {...SHELL_FEATURES},
    items: createNavItems(i18n, activePath),
    defaultLogoFull: 'servicenow',
    defaultLogoIcon: 'servicenow'
  };
}

/**
 * @description Reads the app route from a browser path: drops the /aiux/<basename> prefix and
 *   any trailing slash. A path without the prefix (a local dev server) is taken as it is.
 * @param {string} pathname - location.pathname, for example
 *   '/aiux/scramble-v7/v7/hall-of-fame'.
 * @returns {string} The app route, for example '/v7/hall-of-fame'; '/' for the app root; '' when
 *   the input is not a non-empty string.
 * @throws {never} Never throws.
 * @example
 *   routePathFromPathname('/aiux/scramble-v7/v7/replay/abc/'); // '/v7/replay/abc'
 * @since 1.0.0
 */
export function routePathFromPathname(pathname) {
  if (typeof pathname !== 'string' || pathname === '') {
    return '';
  }
  const appPath = pathname.replace(AIUX_PREFIX, '').replace(/\/+$/, '');
  if (appPath === '') {
    return '/';
  }
  return appPath.startsWith('/') ? appPath : `/${appPath}`;
}
