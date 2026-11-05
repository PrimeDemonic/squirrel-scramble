/**
 * Thin client for the Squirrel Race REST API at /api/x_crli_squirrel/race (SPEC.md § 7).
 *
 * Every call goes through aiuxFetch, which adds the session's XSRF and auth headers, with a
 * relative URL so the AIUX request handling can do its job. The server is the real gate: it
 * checks the marshal role and answers 403, which arrives here as a RaceApiError with code
 * 'forbidden' so the page can say "Marshals only".
 *
 * Responses are read tolerantly: a body wrapped in {result: ...} (what a scripted REST
 * resource's setBody() produces) or a bare body both work, and the shared error shape
 * {error: {code, message, details}} or the platform's own {error: {message, detail}} both turn
 * into a RaceApiError with status, code and details.
 *
 * This module is the only one in lib/ that imports from the platform, so it is not unit tested
 * under Node; the M3 and M5 checks cover it through the browser.
 */
import {aiuxFetch} from '@servicenow/aiux/aiux-components-core';
import {toPayload} from './outfits.js';

const BASE_PATH = '/api/x_crli_squirrel/race';
const SYS_ID_PATTERN = /^[0-9a-f]{32}$/;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;
const GROUP_QUERY_MIN_LENGTH = 2;
// Codes for statuses that arrive without the shared error shape (a platform 401, for example).
const STATUS_CODES = {401: 'unauthenticated', 403: 'forbidden', 404: 'not_found'};

/**
 * A failed call to the race API, carrying the HTTP status, the error code (SPEC.md § 7: no_names,
 * too_many, name_too_long, duplicate_names, bad_places, bad_mode, bad_length, bad_outfit,
 * not_found, forbidden, draw_failed; plus network_error, unauthenticated and http_error from
 * this client) and the details (for example the offending names).
 */
export class RaceApiError extends Error {
  /**
   * @description Builds the error.
   * @param {string} message - A readable message.
   * @param {{status?: number, code?: string, details?: string[]}} [parts] - Status (0 when the
   *   server was not reached), code and details.
   * @since 1.0.0
   */
  constructor(message, {status = 0, code = 'http_error', details = []} = {}) {
    super(message);
    this.name = 'RaceApiError';
    this.status = status;
    this.code = code;
    this.details = Array.isArray(details) ? details.map(String) : [];
  }
}

/**
 * @description Unwraps a {result: ...} body, or returns the body as it is.
 * @param {*} body - The parsed body.
 * @returns {*} The payload.
 * @since 1.0.0
 */
function unwrapResult(body) {
  const wrapped = body && typeof body === 'object' && !Array.isArray(body)
    && Object.prototype.hasOwnProperty.call(body, 'result');
  return wrapped ? body.result : body;
}

/**
 * @description Reads a response body as JSON, or null when there is none or it is not JSON.
 * @param {Object} response - The aiuxFetch response.
 * @returns {Promise<*>} The parsed body, or null.
 * @since 1.0.0
 */
async function readBody(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * @description Turns a failed response into a RaceApiError. A 403 is always 'forbidden'.
 * @param {number} status - The HTTP status.
 * @param {*} body - The parsed body.
 * @returns {RaceApiError} The error.
 * @since 1.0.0
 */
function toApiError(status, body) {
  const payload = unwrapResult(body);
  const error = (payload && payload.error) || (body && body.error) || {};
  const code = status === 403
    ? 'forbidden'
    : (typeof error.code === 'string' && error.code) || STATUS_CODES[status] || 'http_error';
  let details = [];
  if (Array.isArray(error.details)) {
    details = error.details;
  } else if (typeof error.detail === 'string' && error.detail) {
    details = [error.detail];
  }
  const message = typeof error.message === 'string' && error.message
    ? error.message
    : `The race service answered with status ${status}.`;
  return new RaceApiError(message, {status, code, details});
}

/**
 * @description Calls one resource and returns its payload, or throws a RaceApiError.
 * @param {string} path - The path after the base, starting with '/'.
 * @param {{method?: string, body?: Object}} [request] - Method (default GET) and JSON body.
 * @returns {Promise<*>} The unwrapped payload.
 * @throws {RaceApiError} On a network failure or any non-2xx status.
 * @since 1.0.0
 */
async function requestJson(path, {method = 'GET', body} = {}) {
  const headers = {Accept: 'application/json'};
  const requestOptions = {method, headers};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    requestOptions.body = JSON.stringify(body);
  }
  let response;
  try {
    response = await aiuxFetch(`${BASE_PATH}${path}`, requestOptions);
  } catch (error) {
    const reason = error && error.message ? error.message : String(error);
    throw new RaceApiError('The race service could not be reached.', {
      status: 0,
      code: 'network_error',
      details: [reason]
    });
  }
  const parsed = await readBody(response);
  if (!response.ok) {
    throw toApiError(response.status, parsed);
  }
  return unwrapResult(parsed);
}

/**
 * @description Says whether a value looks like a sys_id, so a bad id never reaches a URL.
 * @param {*} value - The candidate.
 * @returns {boolean} True for 32 lower-case hexadecimal characters.
 * @since 1.0.0
 */
function isSysId(value) {
  return typeof value === 'string' && SYS_ID_PATTERN.test(value);
}

/**
 * @description A list limit within 1 to 25, defaulting to 10.
 * @param {*} limit - The requested limit.
 * @returns {number} The limit to send.
 * @since 1.0.0
 */
function clampLimit(limit) {
  const parsed = parseInt(limit, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(MAX_LIMIT, Math.max(1, parsed));
}

/**
 * @description The error for an id that cannot be a sys_id, matching the server's 404.
 * @returns {RaceApiError} A not_found error.
 * @since 1.0.0
 */
function notFound() {
  return new RaceApiError('Nothing has that id.', {status: 404, code: 'not_found'});
}

/**
 * @description Draws and stores a race (POST /draw). The server validates everything; outfits
 *   are trimmed to the server's rule first so a cosmetic slip never blocks a draw.
 * @param {{title?: string, mode: string, names: string[], outfits?: Array<Object>,
 *   places: number, raceSeconds: number, rematchOf?: string, chaosLevel?: string}} request -
 *   The draw request; chaosLevel is 'mild', 'silly' or 'carnage' (Chaos v2 contract § 2).
 * @returns {Promise<{race: Object, entrants: Array<Object>}>} The race payload.
 * @throws {RaceApiError} With the server's code on a 400, 'forbidden' on a 403.
 * @example
 *   const payload = await drawRace({mode: 'classic', names, outfits, places: 2,
 *     raceSeconds: 20});
 * @since 1.0.0
 */
export function drawRace(request) {
  const source = request && typeof request === 'object' ? request : {};
  const body = {
    title: source.title,
    mode: source.mode,
    names: Array.isArray(source.names) ? source.names.slice() : [],
    places: source.places,
    raceSeconds: source.raceSeconds,
    rematchOf: source.rematchOf || null
  };
  if (Array.isArray(source.outfits)) {
    body.outfits = source.outfits.map((outfit) => toPayload(outfit));
  }
  // Chaos v2 contract § 2: the server stores the level for Chaos races and ignores it in Classic.
  if (typeof source.chaosLevel === 'string' && source.chaosLevel) {
    body.chaosLevel = source.chaosLevel;
  }
  return requestJson('/draw', {method: 'POST', body});
}

/**
 * @description Reads a stored race for replay (GET /races/{sys_id}).
 * @param {string} sysId - The race's sys_id.
 * @returns {Promise<{race: Object, entrants: Array<Object>}>} The race payload.
 * @throws {RaceApiError} 'not_found' for an unknown or malformed id, 'forbidden' on a 403.
 * @example
 *   const payload = await getRace(params.id);
 * @since 1.0.0
 */
export async function getRace(sysId) {
  if (!isSysId(sysId)) {
    throw notFound();
  }
  return requestJson(`/races/${sysId}`);
}

/**
 * @description The most recent races, newest first, for loading a previous line-up
 *   (GET /races).
 * @param {number} [limit] - 1 to 25, default 10.
 * @returns {Promise<Array<Object>>} Race summaries.
 * @throws {RaceApiError} 'forbidden' on a 403.
 * @example
 *   const races = await recentRaces(10);
 * @since 1.0.0
 */
export function recentRaces(limit = DEFAULT_LIMIT) {
  const query = new URLSearchParams({limit: String(clampLimit(limit))});
  return requestJson(`/races?${query.toString()}`);
}

/**
 * @description Groups whose name contains the text, for the type-ahead (GET /groups). Text
 *   shorter than two characters returns no groups without calling the server, which would
 *   refuse it.
 * @param {string} text - What the marshal typed.
 * @returns {Promise<Array<{sysId: string, name: string}>>} Up to 20 groups.
 * @throws {RaceApiError} 'forbidden' on a 403.
 * @example
 *   const groups = await searchGroups('service desk');
 * @since 1.0.0
 */
export async function searchGroups(text) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (trimmed.length < GROUP_QUERY_MIN_LENGTH) {
    return [];
  }
  const query = new URLSearchParams({q: trimmed});
  return requestJson(`/groups?${query.toString()}`);
}

/**
 * @description The active members of a group, sorted by name (GET /groups/{sys_id}/members).
 * @param {string} groupSysId - The group's sys_id.
 * @returns {Promise<Array<{name: string, userSysId: string}>>} The members.
 * @throws {RaceApiError} 'not_found' for an unknown or malformed id, 'forbidden' on a 403.
 * @example
 *   const members = await groupMembers(group.sysId);
 * @since 1.0.0
 */
export async function groupMembers(groupSysId) {
  if (!isSysId(groupSysId)) {
    throw notFound();
  }
  return requestJson(`/groups/${groupSysId}/members`);
}

/**
 * @description The top winners across drawn races (GET /hall-of-fame).
 * @param {number} [limit] - 1 to 25, default 10.
 * @returns {Promise<Array<{name: string, wins: number, podiums: number, lastWin: string}>>}
 *   The Hall of Fame.
 * @throws {RaceApiError} 'forbidden' on a 403.
 * @example
 *   const legends = await hallOfFame();
 * @since 1.0.0
 */
export function hallOfFame(limit = DEFAULT_LIMIT) {
  const query = new URLSearchParams({limit: String(clampLimit(limit))});
  return requestJson(`/hall-of-fame?${query.toString()}`);
}
