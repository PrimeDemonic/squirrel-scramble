/**
 * Film-rate loops (Chaos v2 contract § 10.1) and the packed band's featured racers (§ 10.2),
 * checked on components/stage-film-rate.js with fake animations: no DOM, no Lit. Covers the
 * filter (CSS animation, running, on an SVG part, infinite), the slot spread, the due-time
 * maths (advance and resync), phase-keeping redraws, idle loops being dropped and never
 * written, and release handing every loop back without reviving a cancelled one.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  FILM_RATE_HZ,
  FILM_FRAME_MS,
  FILM_RATE_SLOTS,
  FEATURED_COUNT,
  FEATURED_REFRESH_MS,
  FilmRateDriver,
  describeAnimation,
  drivenTimeAt,
  featuredDue,
  firstDueAt,
  isFilmRateCandidate,
  leastLoadedSlot,
  nextDueAt,
  pickFeatured,
  sameMembers,
  summariseLoops
} from '../components/stage-film-rate.js';

/** A stand-in for SVGElement: ownerSVGElement is the sprite's <svg>. */
class FakeSvgElement {
  /**
   * @description Makes an SVG part inside a sprite.
   * @param {Object|null} owner - The sprite's root.
   */
  constructor(owner = null) {
    this.ownerSVGElement = owner;
  }
}

/** A stand-in for SVGSVGElement (an <svg> root). */
class FakeSvgRoot extends FakeSvgElement {}

/** A stand-in for an HTML element. */
class FakeHtmlElement {}

const TYPES = Object.freeze({SVGElement: FakeSvgElement, SVGSVGElement: FakeSvgRoot});

/**
 * A fake CSSAnimation: records pause(), play() and every currentTime write, as the platform's
 * play states would change them.
 */
class FakeAnimation {
  /**
   * @description Makes a fake animation.
   * @param {{target?: Object, iterations?: number, css?: boolean, playState?: string,
   *   currentTime?: number, playbackRate?: number}} [shape] - What it looks like.
   */
  constructor(shape = {}) {
    const target = shape.target === undefined
      ? new FakeSvgElement(new FakeSvgRoot())
      : shape.target;
    const iterations = shape.iterations === undefined ? Infinity : shape.iterations;
    this.playState = shape.playState || 'running';
    this.playbackRate = shape.playbackRate === undefined ? 1 : shape.playbackRate;
    this.effect = {target, getTiming: () => ({iterations})};
    this.writes = [];
    this.calls = [];
    this._time = shape.currentTime === undefined ? 0 : shape.currentTime;
    if (shape.css !== false) {
      this.animationName = 'ss-climb-reach';
    }
  }

  /**
   * @description The animation's current time.
   * @returns {number} Milliseconds.
   */
  get currentTime() {
    return this._time;
  }

  /**
   * @description Seeks the animation, recording the write.
   * @param {number} value - Milliseconds.
   */
  set currentTime(value) {
    this.writes.push(value);
    this._time = value;
  }

  /**
   * @description Pauses it.
   * @returns {void}
   */
  pause() {
    this.calls.push('pause');
    this.playState = 'paused';
  }

  /**
   * @description Plays it.
   * @returns {void}
   */
  play() {
    this.calls.push('play');
    this.playState = 'running';
  }
}

/**
 * @description A fake render root holding a list of animations.
 * @param {FakeAnimation[]} animations - Its animations.
 * @returns {{getAnimations: function(): FakeAnimation[], list: FakeAnimation[]}} The root.
 */
function fakeRoot(animations) {
  const root = {list: animations};
  root.getAnimations = () => root.list.slice();
  return root;
}

/**
 * @description A driver wired to the fake SVG classes, with a clock that never runs by itself.
 * @param {Object} [options] - Extra driver options.
 * @returns {FilmRateDriver} The driver.
 */
function makeDriver(options = {}) {
  return new FilmRateDriver({types: TYPES, now: () => 0, ...options});
}

test('the constants are film rate, four slots and a top five refreshed each second', () => {
  assert.equal(FILM_RATE_HZ, 24);
  assert.ok(Math.abs(FILM_FRAME_MS - 1000 / 24) < 1e-9);
  assert.equal(FILM_RATE_SLOTS, 4);
  assert.equal(FEATURED_COUNT, 5);
  assert.equal(FEATURED_REFRESH_MS, 1000);
});

test('only running infinite CSS animations on SVG parts are candidates', () => {
  const good = {cssAnimation: true, playState: 'running', svgPart: true, iterations: Infinity};
  assert.equal(isFilmRateCandidate(good), true);
  assert.equal(isFilmRateCandidate({...good, iterations: 1}), false, 'a one-shot');
  assert.equal(isFilmRateCandidate({...good, svgPart: false}), false, 'HTML or an <svg> root');
  assert.equal(isFilmRateCandidate({...good, cssAnimation: false}), false, 'a transition');
  assert.equal(isFilmRateCandidate({...good, playState: 'paused'}), false);
  assert.equal(isFilmRateCandidate({...good, playState: 'idle'}), false);
  assert.equal(isFilmRateCandidate(null), false);
});

test('describeAnimation tells an SVG part from an <svg> root and an HTML element', () => {
  const sprite = new FakeSvgRoot();
  const part = describeAnimation(new FakeAnimation({target: new FakeSvgElement(sprite)}), TYPES);
  assert.equal(part.svgPart, true);
  assert.equal(part.cssAnimation, true);
  assert.equal(part.iterations, Infinity);
  assert.equal(part.group, sprite, 'a part belongs to its sprite');
  const root = describeAnimation(new FakeAnimation({target: sprite}), TYPES);
  assert.equal(root.svgPart, false);
  const html = describeAnimation(new FakeAnimation({target: new FakeHtmlElement()}), TYPES);
  assert.equal(html.svgPart, false);
  const transition = describeAnimation(new FakeAnimation({css: false}), TYPES);
  assert.equal(transition.cssAnimation, false);
  const bare = describeAnimation({playState: 'running'}, TYPES);
  assert.equal(bare.svgPart, false);
  assert.equal(bare.iterations, null);
  assert.equal(describeAnimation(null, TYPES).playState, 'idle');
});

test('the least loaded slot wins, the lowest on a tie', () => {
  assert.equal(leastLoadedSlot([0, 0, 0, 0]), 0);
  assert.equal(leastLoadedSlot([2, 1, 1, 3]), 1);
  assert.equal(leastLoadedSlot([1, 1, 1, 0]), 3);
});

test('collected sprites spread evenly over the slots, and a sprite keeps one slot', () => {
  const driver = makeDriver();
  const animations = [];
  for (let sprite = 0; sprite < 10; sprite += 1) {
    const owner = new FakeSvgRoot();
    // Three parts per sprite: arm, leg and tail.
    for (let part = 0; part < 3; part += 1) {
      animations.push(new FakeAnimation({target: new FakeSvgElement(owner)}));
    }
  }
  assert.equal(driver.collectFrom(animations, 0), 30);
  const loads = driver._loads;
  assert.equal(loads.reduce((sum, load) => sum + load, 0), 30);
  assert.ok(Math.max(...loads) - Math.min(...loads) <= 3, `uneven slots: ${loads}`);
  for (let sprite = 0; sprite < 10; sprite += 1) {
    const slots = new Set(animations.slice(sprite * 3, sprite * 3 + 3)
      .map((animation) => driver._tracked.get(animation).slot));
    assert.equal(slots.size, 1, `sprite ${sprite} is split over slots`);
  }
});

test('first due times sit on each slot grid, within one film frame', () => {
  const frameMs = 40;
  // Slot grids, 10 ms apart: slot 0 at 0, 40, 80, 120; slot 1 at 10, 50, 90, 130; and so on.
  assert.equal(firstDueAt(100, 0, 0, 4, frameMs), 120);
  assert.equal(firstDueAt(100, 1, 0, 4, frameMs), 130);
  assert.equal(firstDueAt(100, 2, 0, 4, frameMs), 100, 'due at once when on the grid');
  assert.equal(firstDueAt(100, 3, 0, 4, frameMs), 110);
  for (let slot = 0; slot < 4; slot += 1) {
    const value = firstDueAt(1234.5, slot, 7);
    assert.ok(value >= 1234.5 && value < 1234.5 + FILM_FRAME_MS);
  }
});

test('a redrawn loop is due one film frame later, and resyncs on its grid when behind', () => {
  assert.equal(nextDueAt(100, 90, 40), 100, 'not due yet: unchanged');
  assert.equal(nextDueAt(100, 100, 40), 140);
  assert.equal(nextDueAt(100, 139, 40), 140);
  // Fell 2.5 film frames behind: the next slot moment after now, never a replay of the missed.
  assert.equal(nextDueAt(100, 200, 40), 220);
  assert.equal(nextDueAt(100, 220, 40), 260);
});

test('a driven loop shows its base time plus the time since, at its rate', () => {
  assert.equal(drivenTimeAt({baseTime: 300, baseClock: 1000, rate: 1}, 1050), 350);
  assert.equal(drivenTimeAt({baseTime: 300, baseClock: 1000, rate: 2}, 1050), 400);
});

test('tick redraws a loop at its due times only, keeping its phase', () => {
  const driver = makeDriver({slots: 1, frameMs: 40});
  const animation = new FakeAnimation({currentTime: 500});
  const root = fakeRoot([animation]);
  driver.requestCollect(root);
  assert.equal(driver.tick(1000), 1, 'collected and due at once on the grid');
  assert.deepEqual(animation.calls, ['pause']);
  assert.deepEqual(animation.writes, [500]);
  assert.equal(driver.tick(1020), 0, 'not due');
  assert.equal(driver.tick(1040), 1);
  assert.deepEqual(animation.writes, [500, 540], 'base plus the time since: the same phase');
  // A long frame: the loop jumps to the true time and its next due time resyncs.
  assert.equal(driver.tick(1175), 1);
  assert.equal(animation.writes[2], 675);
  assert.equal(driver._tracked.get(animation).dueMs, 1200);
  assert.equal(driver.tick(1199), 0);
});

test('one-shots, HTML animations and paused animations are never taken', () => {
  const driver = makeDriver();
  const oneShot = new FakeAnimation({iterations: 1});
  const onHtml = new FakeAnimation({target: new FakeHtmlElement()});
  const onRoot = new FakeAnimation({target: new FakeSvgRoot()});
  const transition = new FakeAnimation({css: false});
  const paused = new FakeAnimation({playState: 'paused'});
  const taken = driver.collectFrom([oneShot, onHtml, onRoot, transition, paused], 0);
  assert.equal(taken, 0);
  [oneShot, onHtml, onRoot, transition, paused].forEach((animation) => {
    assert.deepEqual(animation.calls, []);
  });
});

test('a loop already held keeps its state when collected again', () => {
  const driver = makeDriver({slots: 1, frameMs: 40});
  const animation = new FakeAnimation({currentTime: 200});
  const root = fakeRoot([animation]);
  driver.collect(root, 0);
  const before = {...driver._tracked.get(animation)};
  driver.collect(root, 500);
  assert.deepEqual(driver._tracked.get(animation), before);
  assert.deepEqual(animation.calls, ['pause']);
});

test('a loop that went idle is forgotten and never written again', () => {
  const driver = makeDriver({slots: 1, frameMs: 40});
  const kept = new FakeAnimation();
  const dropped = new FakeAnimation();
  driver.collect(fakeRoot([kept, dropped]), 0);
  assert.equal(driver.stats(fakeRoot([])).driven, 2);
  dropped.playState = 'idle';
  driver.tick(40);
  assert.equal(dropped.writes.length, 0);
  assert.equal(driver._tracked.has(dropped), false);
  assert.equal(driver._loads[0], 1);
  // A loop someone else played runs on its own clock again: let go, not paused again.
  kept.play();
  driver.tick(80);
  assert.equal(driver._tracked.size, 0);
});

test('release plays every held loop, skips idle ones and forgets them all', () => {
  const driver = makeDriver();
  const first = new FakeAnimation();
  const second = new FakeAnimation();
  const cancelled = new FakeAnimation();
  driver.collect(fakeRoot([first, second, cancelled]), 0);
  cancelled.playState = 'idle';
  assert.equal(driver.release(), 2);
  assert.deepEqual(first.calls, ['pause', 'play']);
  assert.deepEqual(second.calls, ['pause', 'play']);
  assert.deepEqual(cancelled.calls, ['pause'], 'a cancelled animation is never revived');
  assert.equal(first.playState, 'running');
  assert.equal(driver._tracked.size, 0);
  assert.deepEqual(driver._loads, [0, 0, 0, 0]);
  const writes = first.writes.length;
  driver.tick(1000);
  assert.equal(first.writes.length, writes, 'nothing is driven after release');
  assert.equal(driver.release(), 0, 'safe to call again');
});

test('switched off, the driver hands loops back and takes none; on again, it collects', () => {
  const driver = makeDriver();
  const animation = new FakeAnimation();
  const root = fakeRoot([animation]);
  driver.collect(root, 0);
  assert.equal(driver.setEnabled(false), false);
  assert.equal(driver.enabled, false);
  assert.equal(animation.playState, 'running');
  assert.equal(driver.collect(root, 10), 0);
  assert.equal(driver.tick(20), 0);
  assert.equal(animation.playState, 'running');
  assert.equal(driver.setEnabled(true), true);
  driver.tick(30);
  assert.equal(animation.playState, 'paused', 'collected again at the next tick');
  driver.enabled = false;
  assert.equal(animation.playState, 'running', 'the setter releases too');
});

test('requestCollect defers the collect to the next tick, once', () => {
  const driver = makeDriver();
  const first = new FakeAnimation();
  const root = fakeRoot([first]);
  driver.requestCollect(root);
  assert.deepEqual(first.calls, [], 'nothing happens before the tick');
  driver.tick(0);
  assert.deepEqual(first.calls, ['pause']);
  const late = new FakeAnimation();
  root.list.push(late);
  driver.tick(10);
  assert.deepEqual(late.calls, [], 'no collect without a request');
  driver.requestCollect();
  driver.tick(20);
  assert.deepEqual(late.calls, ['pause'], 'the last root is reused');
});

test('stats counts driven loops and the loops still on the platform clock', () => {
  const driver = makeDriver();
  const driven = new FakeAnimation();
  const htmlLoop = new FakeAnimation({target: new FakeHtmlElement()});
  const oneShot = new FakeAnimation({iterations: 1});
  const root = fakeRoot([driven, htmlLoop, oneShot]);
  driver.collect(root, 0);
  assert.deepEqual(driver.stats(), {driven: 1, native: 1});
  driver.setEnabled(false);
  assert.deepEqual(driver.stats(), {driven: 0, native: 2});
  assert.deepEqual(summariseLoops(null, -3), {driven: 0, native: 0});
});

test('the featured racers are the board top five, refreshed at most once a second', () => {
  const board = [7, 2, 9, 0, 4, 5, 1].map((entrantIndex) => ({entrantIndex}));
  assert.deepEqual(pickFeatured(board), [7, 2, 9, 0, 4]);
  assert.deepEqual(pickFeatured(board.slice(0, 3)), [7, 2, 9]);
  assert.deepEqual(pickFeatured(null), []);
  assert.equal(featuredDue(null, 0), true);
  assert.equal(featuredDue(1000, 1999), false);
  assert.equal(featuredDue(1000, 2000), true);
  assert.equal(featuredDue(5000, 3000), true, 'a jump back counts');
  assert.equal(sameMembers([1, 2, 3], [3, 1, 2]), true);
  assert.equal(sameMembers([1, 2, 3], [1, 2, 4]), false);
  assert.equal(sameMembers([1, 2], [1, 2, 3]), false);
});
