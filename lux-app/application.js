import {navLayoutContext} from '@servicenow/aiux/aiux-components-nav';
import {AppTheme} from './theme.js';
import {applyShellNav} from './utils/shell.js';

/**
 * The Squirrel Scramble experience shell (SPEC.md § 8): the nav items, the app title and the
 * shell features. setup() runs on every server render and before client navigations. The nav
 * list and features live in utils/shell-nav.js, shared with the pages' stale-shell repair
 * (utils/shell.js repairStaleShell()), so there is one source of truth.
 */
export default {
  appTheme: AppTheme,
  applicationLayout: 'aiux-nav-layout',

  /**
   * @description Fills the nav shell through applyShellNav() (utils/shell.js): Race, History,
   *   Hall of Fame and Wardrobe, with the current page highlighted (a replay highlights History).
   *   Two shell features are off (Chaos v2 contract § 13): chat, so the shell's "Ask or search
   *   for anything" bar never shows (the nav layout reads features.chat in _initChat(), after
   *   this runs), and onboarding, so the "Get to know Lux" popup never covers the race stage.
   * @param {Object} ctx - The route context; ctx.app.routes carries the active route.
   * @returns {void}
   * @since 1.0.0
   */
  setup(ctx) {
    const routes = ctx && ctx.app && Array.isArray(ctx.app.routes) ? ctx.app.routes : [];
    const activeRoute = routes.find((route) => route.active);
    const activePath = activeRoute ? activeRoute.route : '';
    applyShellNav(activePath);
  },

  /**
   * @description Clears the nav items when the user leaves this experience.
   * @returns {void}
   * @since 1.0.0
   */
  teardown() {
    navLayoutContext.set({
      items: [],
      defaultLogoFull: null,
      defaultLogoIcon: null
    });
  }
};
