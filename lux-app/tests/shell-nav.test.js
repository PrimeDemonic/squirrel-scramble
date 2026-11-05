/**
 * Unit tests for utils/shell-nav.js, the one nav builder application.js and the pages' stale-shell
 * repair share (Chaos v2 contract § 13): the four items, the active marking (a replay marks
 * History), the shell features and the app route read from a browser path.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {REPLAY_ROUTE_PREFIX, ROUTE_VERSION, replayRoute, routeFor} from '../utils/routes.js';
import {
  CHAT_VISIBILITY_EVENT,
  SHELL_FEATURES,
  buildShellState,
  createNavItems,
  isItemActive,
  routePathFromPathname
} from '../utils/shell-nav.js';

const SAMPLE_SYS_ID = '0123456789abcdef0123456789abcdef';

/** An i18n stub that returns each message as written. */
const echoI18n = {getMessage: (message) => message};

/**
 * @description The icons of the items marked active.
 * @param {string} activePath - The active app route.
 * @returns {string[]} The active items' icons.
 * @since 1.0.0
 */
function activeIcons(activePath) {
  return createNavItems(echoI18n, activePath)
    .filter((item) => item.active === true)
    .map((item) => item.icon);
}

test('four nav items, in order, on the current route version', () => {
  const items = createNavItems(echoI18n, '');
  assert.deepEqual(
    items.map((item) => item.title),
    ['Race', 'History', 'Hall of Fame', 'Wardrobe']
  );
  assert.deepEqual(items.map((item) => item.icon), ['flag-event', 'history', 'star', 'palette']);
  assert.deepEqual(
    items.map((item) => item.action.path),
    [routeFor('play'), routeFor('history'), routeFor('hall-of-fame'), routeFor('wardrobe')]
  );
  items.forEach((item) => {
    assert.equal(item.action.type, 'navigate');
    assert.ok(item.action.path.startsWith(`/${ROUTE_VERSION}/`), item.action.path);
    assert.equal(item.active, undefined, item.title);
  });
});

test('each page marks only its own item', () => {
  assert.deepEqual(activeIcons(routeFor('play')), ['flag-event']);
  assert.deepEqual(activeIcons(routeFor('history')), ['history']);
  assert.deepEqual(activeIcons(routeFor('hall-of-fame')), ['star']);
  assert.deepEqual(activeIcons(routeFor('wardrobe')), ['palette']);
});

test('a replay marks History, by sys_id or by route pattern', () => {
  assert.deepEqual(activeIcons(replayRoute(SAMPLE_SYS_ID)), ['history']);
  assert.deepEqual(activeIcons(`${REPLAY_ROUTE_PREFIX}/:id`), ['history']);
});

test('the redirect, the root, an old version and nonsense mark nothing', () => {
  ['/race', '/', '', '/v5/wardrobe', '/v5/replay/abc', null, undefined, 42].forEach((path) => {
    assert.deepEqual(activeIcons(path), [], String(path));
  });
  assert.equal(isItemActive(null, routeFor('play')), false);
  assert.equal(isItemActive({}, routeFor('play')), false);
});

test('the titles are literal catalogue entries passed through i18n', () => {
  const seen = [];
  const items = createNavItems({
    getMessage: (message) => {
      seen.push(message);
      return `[${message}]`;
    }
  }, routeFor('play'));
  assert.deepEqual(seen, ['Race', 'History', 'Hall of Fame', 'Wardrobe']);
  assert.equal(items[0].title, '[Race]');
});

test('the shell state keeps the current value and turns chat and onboarding off', () => {
  const current = {somethingElse: 'kept', items: [{title: 'stale'}], features: {chat: true}};
  const state = buildShellState(current, echoI18n, routeFor('wardrobe'));
  assert.equal(state.somethingElse, 'kept');
  assert.equal(state.appTitle, 'Squirrel Scramble');
  assert.equal(state.features.chat, false);
  assert.equal(state.features.onboarding, false);
  assert.deepEqual(state.features, {...SHELL_FEATURES});
  assert.deepEqual(state.items, createNavItems(echoI18n, routeFor('wardrobe')));
  assert.equal(state.defaultLogoFull, 'servicenow');
  assert.equal(state.defaultLogoIcon, 'servicenow');
  assert.deepEqual(current.items, [{title: 'stale'}], 'the current value is not changed');
  assert.equal(buildShellState(null, echoI18n, '').items.length, 4);
});

test('the app route is read from the Lux URL', () => {
  const cases = [
    ['/aiux/scramble-v7/v7/play', '/v7/play'],
    ['/aiux/scramble-v7/v7/hall-of-fame', '/v7/hall-of-fame'],
    ['/aiux/scramble-v7/v7/wardrobe/', '/v7/wardrobe'],
    [`/aiux/scramble-v7/v7/replay/${SAMPLE_SYS_ID}`, `/v7/replay/${SAMPLE_SYS_ID}`],
    ['/aiux/scramble-v7/race', '/race'],
    ['/aiux/scramble-v7', '/'],
    ['/aiux/scramble-v7/', '/'],
    ['/v7/history', '/v7/history'],
    ['/aiuxother/v7/play', '/aiuxother/v7/play'],
    ['', ''],
    [null, ''],
    [undefined, '']
  ];
  cases.forEach(([pathname, expected]) => {
    assert.equal(routePathFromPathname(pathname), expected, String(pathname));
  });
});

test('a path read from the Lux URL marks the right item', () => {
  const marked = (pathname) => activeIcons(routePathFromPathname(pathname));
  assert.deepEqual(marked('/aiux/scramble-v7/v7/wardrobe'), ['palette']);
  assert.deepEqual(marked(`/aiux/scramble-v7/v7/replay/${SAMPLE_SYS_ID}`), ['history']);
  assert.deepEqual(marked('/aiux/scramble-v7/race'), []);
});

test('the chat event is the one the nav layout listens for', () => {
  assert.equal(CHAT_VISIBILITY_EVENT, 'aiux-chat-visibility-change');
});

test('application.js and every page share the one nav builder', () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const application = read('../application.js');
  assert.match(application, /applyShellNav\(/);
  assert.doesNotMatch(application, /icon: '/, 'application.js writes no nav items of its own');
  const pages = ['../pages/v7/play/page.js', '../pages/v7/history/page.js',
    '../pages/v7/hall-of-fame/page.js', '../pages/v7/wardrobe/page.js',
    '../pages/v7/replay/[id]/page.js', '../pages/race/page.js'];
  pages.forEach((page) => {
    const source = read(page);
    const firstUpdated = /\n {2}firstUpdated\(\) \{\r?\n {4}repairStaleShell\(this\);/.test(source);
    assert.ok(firstUpdated, `${page} calls repairStaleShell(this) first in firstUpdated()`);
    assert.equal(source.match(/repairStaleShell\(/g).length, 1, `${page} calls it once`);
  });
});
