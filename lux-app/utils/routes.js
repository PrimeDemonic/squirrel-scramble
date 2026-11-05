/**
 * App-relative routes for the Squirrel Scramble experience, all under one version segment.
 *
 * Why the version: the Lux cloud service caches each experience's route list and each page's
 * bundle, and doesn't refresh either after a redeploy (SPEC.md § 23, decision 9). Only a route
 * path, a custom-element tag and a basename it has never seen get a changed page served. So every
 * app route starts with ROUTE_VERSION, and the pages and application.js build their paths here
 * instead of writing them out.
 *
 * A redeploy that changes a page:
 *   1. Bump ROUTE_VERSION (for example 'v7' to 'v8').
 *   2. Move every page folder to match: pages/<old>/<route>/ becomes pages/<new>/<route>/.
 *      File-based routing reads the folder names and can't read this constant, so the two must
 *      agree by hand. The folders stay at the same depth, so their relative imports don't change.
 *      Leave pages/race/ where it is: /race is the redirect for the cached M0 shell's sidebar
 *      "Race" link, so its path never changes, and it reaches the new version through
 *      playRoute() by itself.
 *   3. Rename every page's @customElement tag to the new version
 *      (x-crli-squirrel-<page>-<new>-page), so the build makes new widget records. That includes
 *      the /race redirect: x-crli-squirrel-race-redirect-<old>-page becomes
 *      x-crli-squirrel-race-redirect-<new>-page, although its folder stays put.
 *   4. Change the basename in aiux.json, and set its landing to the new routeFor('play').
 *   5. Re-point every platform record that holds a Lux path at the new URLs:
 *      - the four DIRECT sys_app_module rows in the "Squirrel Scramble" application menu, each
 *        with its query set to /aiux/scramble-vN/vN/<page>:
 *          "Start a race" (/vN/play),
 *          "Race history screen" (/vN/history),
 *          "Hall of Fame" (/vN/hall-of-fame),
 *          "Wardrobe" (/vN/wardrobe);
 *      - the "Replay" UI action on the Race table: the SQUIRREL_REPLAY_BASE line in its script,
 *        and its comments.
 *      The last three links exist because Lux kept serving a cached older app shell whose
 *      side-nav links point at an old route version (Chaos v2 contract § 13; SPEC.md § 23,
 *      decision 9), so the platform menu carries direct links until Lux refreshes the shell.
 *      Since 2026-11-05 the pages also repair that shell themselves: each page's firstUpdated()
 *      calls repairStaleShell() (utils/shell.js), which resets the nav items to this version's
 *      routes and hides the chat bar. The direct menu links stay as a second way in.
 *
 * 2026-11-05: v6 became v7 although no page changed its behaviour after the v6 deploy. Lux kept
 * serving the 11:40 v6 page bundles (the 13:31 v6 build's new files returned 404), so the shell
 * repair above never reached the browser under v6. v7 ships it under a route, tags and a
 * basename Lux has not seen.
 *
 * REST paths (/api/x_crli_squirrel/...) are not app routes and don't belong here.
 */

/** The version segment every app route starts with. Bump it on a redeploy that changes a page. */
export const ROUTE_VERSION = 'v7';

/** The pages routeFor() knows, by their folder name under pages/<ROUTE_VERSION>/. */
const PAGE_NAMES = Object.freeze(['play', 'history', 'hall-of-fame', 'wardrobe']);

/** The start of every replay path: a replay lives at <REPLAY_ROUTE_PREFIX>/<sys_id>. */
export const REPLAY_ROUTE_PREFIX = `/${ROUTE_VERSION}/replay`;

/**
 * @description Builds the app-relative path of a page, under the current route version.
 * @param {string} name - The page's folder name: 'play', 'history', 'hall-of-fame' or
 *   'wardrobe'.
 * @returns {string} The path, for example '/v7/history' while ROUTE_VERSION is 'v7'.
 * @throws {Error} When the name is not one of the app's pages.
 * @example
 *   navigate(routeFor('history'));
 * @since 1.0.0
 */
export function routeFor(name) {
  if (!PAGE_NAMES.includes(name)) {
    throw new Error(`Squirrel Scramble has no page called '${String(name)}'.`);
  }
  return `/${ROUTE_VERSION}/${name}`;
}

/**
 * @description Builds the app-relative path of a stored race's replay page.
 * @param {string} sysId - The race's sys_id. Callers check its shape first.
 * @returns {string} The path, for example '/v7/replay/<sys_id>' while ROUTE_VERSION is 'v7'.
 * @throws {Error} When sysId is not a non-empty string.
 * @example
 *   navigate(replayRoute(race.sysId));
 * @since 1.0.0
 */
export function replayRoute(sysId) {
  if (typeof sysId !== 'string' || sysId === '') {
    throw new Error('A replay route needs the race sys_id.');
  }
  return `${REPLAY_ROUTE_PREFIX}/${encodeURIComponent(sysId)}`;
}

/**
 * @description Builds the app-relative path of the race page. With a rematch sys_id the setup
 *   view opens with that race's line-up, linked as a rematch (the page's loader reads
 *   ?rematch=).
 * @param {{rematch?: string}} [options] - Options; rematch is the sys_id of the race to rematch,
 *   and empty or missing gives the plain race page.
 * @returns {string} '/v7/play' or '/v7/play?rematch=<sys_id>' while ROUTE_VERSION is 'v7'.
 * @throws {never} Never throws.
 * @example
 *   navigate(playRoute({rematch: race.sysId}));
 *   navigate(playRoute());
 * @since 1.0.0
 */
export function playRoute(options) {
  const rematch = options && typeof options.rematch === 'string' ? options.rematch : '';
  const path = routeFor('play');
  return rematch ? `${path}?rematch=${encodeURIComponent(rematch)}` : path;
}
