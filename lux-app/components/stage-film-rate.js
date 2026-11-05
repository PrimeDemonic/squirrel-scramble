/**
 * Film-rate loops for the race stage (Chaos v2 contract § 10.1).
 *
 * Chrome cannot composite an animation on an SVG child, so every looping CSS animation on a
 * squirrel's arm, leg, tail, cape or eye is restyled on the main thread at every display refresh:
 * about 11 per squirrel, twice the work on a 144 Hz monitor that a 60 Hz one needs. The driver
 * here takes those loops off the platform's clock. It pauses each one and advances its
 * currentTime itself at film rate (24 Hz), keeping its phase, and spreads the updates over
 * stagger slots so each display frame redraws only a share of them. Every part of one sprite
 * shares a slot, so a squirrel's pose still changes as a whole.
 *
 * It leaves alone one-shot animations, animations on HTML elements (the compositor runs those)
 * and every continuous write the stage makes itself (racer positions, leaderboard bars, the
 * scrubbed visitor parts), which stay at full refresh. When the stage's frame loop stops, the
 * driver hands every loop back to the platform (release); a replay collects them again.
 *
 * The class owns no timer and no listener: the stage calls requestCollect() after a render or an
 * animationstart, tick() from its own frame loop, and release() when the loop stops. The maths
 * (slots, due times, the filter) are pure functions that take plain objects, so tests run them
 * under Node without a DOM. Nothing here runs during server rendering.
 */

// 24 Hz: film rate. Fast enough that a limb loop still reads as motion, slow enough to cut the
// style work of the squirrels' loops by about 70% at 144 Hz (measured, contract § 10).
export const FILM_RATE_HZ = 24;

// The time between two redraws of one driven loop: 1000 / 24, about 41.7 ms.
export const FILM_FRAME_MS = 1000 / FILM_RATE_HZ;

// Stagger slots per film frame: each slot redraws a quarter of a film frame after the one
// before, so at 60 Hz or 144 Hz no single display frame redraws every loop at once.
export const FILM_RATE_SLOTS = 4;

// Packed band (contract § 10.2): how many racers, the current top by height, keep their limb
// and body loops.
export const FEATURED_COUNT = 5;

// Packed band: the featured racers change at most this often, in milliseconds.
export const FEATURED_REFRESH_MS = 1000;

/**
 * @description The clock the driver reads when its caller gives none: performance.now() in the
 *   browser, Date.now() where there is no performance object.
 * @returns {number} Milliseconds.
 * @since 2.2.0
 */
function defaultNow() {
  const clock = globalThis.performance;
  return clock && typeof clock.now === 'function' ? clock.now() : Date.now();
}

/**
 * @description Says whether an animation, described as plain data, is one the driver takes over:
 *   a CSS animation (not a transition or a script animation), running, on an SVG element other
 *   than an <svg> root, with an infinite iteration count.
 * @param {{cssAnimation: boolean, playState: string, svgPart: boolean,
 *   iterations: (number|null)}} info - From describeAnimation.
 * @returns {boolean} True when the driver should pause and drive it.
 * @example
 *   isFilmRateCandidate({cssAnimation: true, playState: 'running', svgPart: true,
 *     iterations: Infinity});
 *   // true
 * @since 2.2.0
 */
export function isFilmRateCandidate(info) {
  return Boolean(info)
    && info.cssAnimation === true
    && info.playState === 'running'
    && info.svgPart === true
    && info.iterations === Infinity;
}

/**
 * @description Describes an Animation as plain data for isFilmRateCandidate and summariseLoops:
 *   whether it is a CSS animation (it has an animationName), its play state, whether its target
 *   is an SVG part (an SVGElement but not an SVGSVGElement), its iteration count and the sprite
 *   it belongs to (the target's nearest <svg>, which picks its stagger slot).
 * @param {Object} animation - An Animation (or a test fake with the same shape).
 * @param {{SVGElement?: Function, SVGSVGElement?: Function}} [types] - Where to find the SVG
 *   element classes (globalThis in the browser; fakes in tests).
 * @returns {{cssAnimation: boolean, playState: string, svgPart: boolean,
 *   iterations: (number|null), group: (Object|null)}} The description.
 * @example
 *   describeAnimation(shadowRoot.getAnimations()[0]);
 * @since 2.2.0
 */
export function describeAnimation(animation, types = globalThis) {
  const effect = animation && animation.effect ? animation.effect : null;
  const target = effect && effect.target ? effect.target : null;
  const svgType = types ? types.SVGElement : null;
  const rootType = types ? types.SVGSVGElement : null;
  const isSvg = Boolean(target) && typeof svgType === 'function' && target instanceof svgType;
  const isRoot = Boolean(target) && typeof rootType === 'function' && target instanceof rootType;
  let iterations = null;
  if (effect && typeof effect.getTiming === 'function') {
    const timing = effect.getTiming();
    iterations = timing ? timing.iterations : null;
  }
  return {
    cssAnimation: Boolean(animation) && typeof animation.animationName === 'string',
    playState: animation && typeof animation.playState === 'string' ? animation.playState : 'idle',
    svgPart: isSvg && !isRoot,
    iterations,
    group: isSvg && target.ownerSVGElement ? target.ownerSVGElement : target
  };
}

/**
 * @description Counts the loops in a set of described animations: how many the driver holds and
 *   how many still run on the platform's clock (running, with an infinite iteration count,
 *   whatever their target).
 * @param {Array<{playState: string, iterations: (number|null)}>} infos - From describeAnimation.
 * @param {number} driven - How many loops the driver holds.
 * @returns {{driven: number, native: number}} The counts.
 * @example
 *   summariseLoops(animations.map((animation) => describeAnimation(animation)), 93);
 *   // {driven: 93, native: 4}
 * @since 2.2.0
 */
export function summariseLoops(infos, driven) {
  const list = Array.isArray(infos) ? infos : [];
  const native = list.filter((info) => (
    info && info.playState === 'running' && info.iterations === Infinity
  )).length;
  return {driven: Number.isInteger(driven) && driven > 0 ? driven : 0, native};
}

/**
 * @description The stagger slot with the fewest loops in it (the lowest-numbered one on a tie),
 *   so new sprites spread evenly over the slots.
 * @param {number[]} loads - Loops per slot.
 * @returns {number} The slot.
 * @example
 *   leastLoadedSlot([3, 1, 1, 2]);
 *   // 1
 * @since 2.2.0
 */
export function leastLoadedSlot(loads) {
  let best = 0;
  for (let slot = 1; slot < loads.length; slot += 1) {
    if (loads[slot] < loads[best]) {
      best = slot;
    }
  }
  return best;
}

/**
 * @description When a newly collected loop is first redrawn: the next moment on its slot's grid
 *   (the epoch, plus the slot's share of a film frame, plus whole film frames), from now on. All
 *   loops in one slot share the grid, so they redraw in the same display frame.
 * @param {number} nowMs - The clock now.
 * @param {number} slot - The loop's stagger slot.
 * @param {number} [epochMs] - The grid's origin (the driver's first collect).
 * @param {number} [slots] - Stagger slots per film frame.
 * @param {number} [frameMs] - Milliseconds per film frame.
 * @returns {number} The first due time, at or after now and less than a film frame away.
 * @example
 *   firstDueAt(100, 0, 0, 4, 40);
 *   // 120
 * @since 2.2.0
 */
export function firstDueAt(
  nowMs,
  slot,
  epochMs = 0,
  slots = FILM_RATE_SLOTS,
  frameMs = FILM_FRAME_MS
) {
  const phaseMs = epochMs + (slot % slots) * (frameMs / slots);
  const offsetMs = (((phaseMs - nowMs) % frameMs) + frameMs) % frameMs;
  return nowMs + offsetMs;
}

/**
 * @description A loop's next due time once it has been redrawn: one film frame on. When the
 *   clock has fallen more than a film frame behind (a long frame, a hidden tab), it resyncs to
 *   the first moment on the same grid after now, so the stagger is kept and no frames are
 *   replayed. A loop that is not due yet keeps its time.
 * @param {number} dueMs - The loop's due time.
 * @param {number} nowMs - The clock now.
 * @param {number} [frameMs] - Milliseconds per film frame.
 * @returns {number} The next due time (after now once the loop was due).
 * @example
 *   nextDueAt(100, 105, 40);
 *   // 140
 *   nextDueAt(100, 230, 40);
 *   // 260
 * @since 2.2.0
 */
export function nextDueAt(dueMs, nowMs, frameMs = FILM_FRAME_MS) {
  if (nowMs < dueMs) {
    return dueMs;
  }
  const steps = Math.floor((nowMs - dueMs) / frameMs) + 1;
  return dueMs + steps * frameMs;
}

/**
 * @description The currentTime a driven loop shows now: where it was when collected, plus the
 *   time since, at its playback rate. Its phase is exactly what the platform would have shown.
 * @param {{baseTime: number, baseClock: number, rate: number}} entry - The loop's state.
 * @param {number} nowMs - The clock now.
 * @returns {number} The animation's current time, in milliseconds.
 * @example
 *   drivenTimeAt({baseTime: 300, baseClock: 1000, rate: 1}, 1050);
 *   // 350
 * @since 2.2.0
 */
export function drivenTimeAt(entry, nowMs) {
  return entry.baseTime + (nowMs - entry.baseClock) * entry.rate;
}

/**
 * @description The packed band's featured racers (contract § 10.2): the first rows of the
 *   leaderboard (finished racers first, then the rest by height), as entrant indexes.
 * @param {Array<{entrantIndex: number}>} rows - Leaderboard rows, best first (scene.board).
 * @param {number} [count] - How many to feature.
 * @returns {number[]} Entrant indexes.
 * @example
 *   pickFeatured(scene.board);
 *   // [4, 0, 7, 2, 5]
 * @since 2.2.0
 */
export function pickFeatured(rows, count = FEATURED_COUNT) {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .slice(0, count)
    .map((row) => (row ? row.entrantIndex : null))
    .filter((index) => Number.isInteger(index));
}

/**
 * @description Says whether the featured racers may change now: never chosen yet, or at least
 *   the refresh interval since they last were (either way, so a jump back counts too).
 * @param {number|null} lastAtMs - When they were last chosen (null for never).
 * @param {number} nowMs - The clock now.
 * @param {number} [refreshMs] - The shortest interval between two changes.
 * @returns {boolean} True when they may be chosen again.
 * @example
 *   featuredDue(null, 0);
 *   // true
 * @since 2.2.0
 */
export function featuredDue(lastAtMs, nowMs, refreshMs = FEATURED_REFRESH_MS) {
  if (!Number.isFinite(lastAtMs)) {
    return true;
  }
  return Math.abs(nowMs - lastAtMs) >= refreshMs;
}

/**
 * @description Says whether two lists of entrant indexes hold the same racers, in any order.
 * @param {number[]} first - One list.
 * @param {number[]} second - The other.
 * @returns {boolean} True when they match.
 * @example
 *   sameMembers([1, 2], [2, 1]);
 *   // true
 * @since 2.2.0
 */
export function sameMembers(first, second) {
  if (first.length !== second.length) {
    return false;
  }
  const members = new Set(first);
  return second.every((index) => members.has(index));
}

/**
 * The film-rate driver: one per race stage. See the module comment for what it does and why.
 */
export class FilmRateDriver {
  /**
   * @description Sets the driver up, enabled and holding nothing. No browser work: the clock
   *   and the SVG classes are only read when the stage calls in.
   * @param {{enabled?: boolean, now?: function(): number, types?: Object, slots?: number,
   *   frameMs?: number}} [options] - Start disabled, the clock (performance.now() by default),
   *   where the SVG element classes live (globalThis by default), and the stagger slots and
   *   film frame (the module's constants by default).
   * @since 2.2.0
   */
  constructor(options = {}) {
    const slots = Number.isInteger(options.slots) && options.slots > 0
      ? options.slots
      : FILM_RATE_SLOTS;
    this._enabled = options.enabled !== false;
    this._now = typeof options.now === 'function' ? options.now : defaultNow;
    this._types = options.types || globalThis;
    this._slots = slots;
    this._frameMs = Number.isFinite(options.frameMs) && options.frameMs > 0
      ? options.frameMs
      : FILM_FRAME_MS;
    // Driven loops: Animation -> {baseTime, baseClock, rate, slot, dueMs}.
    this._tracked = new Map();
    // Loops per stagger slot, and the slot each sprite was given.
    this._loads = new Array(slots).fill(0);
    this._groupSlots = new WeakMap();
    this._root = null;
    this._pending = false;
    this._epochMs = null;
  }

  /**
   * @description Whether the driver is on. Setting it is the same as setEnabled().
   * @returns {boolean} True when it drives loops.
   * @since 2.2.0
   */
  get enabled() {
    return this._enabled;
  }

  /**
   * @description Switches the driver on or off (see setEnabled).
   * @param {boolean} on - True to drive loops.
   * @since 2.2.0
   */
  set enabled(on) {
    this.setEnabled(on);
  }

  /**
   * @description Switches the driver on or off, for A/B measurement (debug.filmRate). Off hands
   *   every loop back to the platform at once; on collects again at the next tick.
   * @param {boolean} on - True to drive loops.
   * @returns {boolean} The new state.
   * @example
   *   driver.setEnabled(false);
   * @since 2.2.0
   */
  setEnabled(on) {
    const wanted = Boolean(on);
    if (!wanted) {
      this.release();
    }
    this._enabled = wanted;
    this._pending = wanted && this._root !== null;
    return this._enabled;
  }

  /**
   * @description Asks for a collect at the next tick: after a render, an animationstart, or the
   *   frame loop starting again. Deferred to the start of the next frame, where the style is
   *   already up to date, so a render never forces an extra style recalculation.
   * @param {Object} [root] - The stage's render root (its ShadowRoot); the last one by default.
   * @returns {void}
   * @example
   *   driver.requestCollect(this.renderRoot);
   * @since 2.2.0
   */
  requestCollect(root) {
    if (root && typeof root.getAnimations === 'function') {
      this._root = root;
    }
    this._pending = this._root !== null;
  }

  /**
   * @description Collects the loops under a root: every running CSS animation on an SVG part
   *   with an infinite iteration count is paused, keeps its current time as its base, and gets
   *   the stagger slot of its sprite. Loops already held keep their state; ones that have gone
   *   idle are forgotten. Does nothing while the driver is off.
   * @param {Object} root - The stage's render root (its ShadowRoot), with getAnimations().
   * @param {number} [nowMs] - The clock now (the frame's time when called from tick).
   * @returns {number} How many loops it newly took over.
   * @example
   *   driver.collect(stage.renderRoot);
   * @since 2.2.0
   */
  collect(root, nowMs = this._now()) {
    if (root && typeof root.getAnimations === 'function') {
      this._root = root;
    }
    this._pending = false;
    if (!this._enabled || !this._root) {
      return 0;
    }
    let animations = [];
    try {
      animations = this._root.getAnimations();
    } catch (error) {
      console.warn('Squirrel Scramble: could not read the stage animations.', error);
      return 0;
    }
    this._forgetIdle();
    return this.collectFrom(animations, nowMs);
  }

  /**
   * @description Takes over the loops in a list of animations (see collect). Exposed for tests
   *   and for a caller that already has the list.
   * @param {Object[]} animations - Animations (or fakes with the same shape).
   * @param {number} [nowMs] - The clock now.
   * @returns {number} How many loops it newly took over.
   * @example
   *   driver.collectFrom(element.getAnimations(), performance.now());
   * @since 2.2.0
   */
  collectFrom(animations, nowMs = this._now()) {
    if (!this._enabled || !Array.isArray(animations)) {
      return 0;
    }
    if (this._epochMs === null) {
      this._epochMs = nowMs;
    }
    let taken = 0;
    animations.forEach((animation) => {
      if (!animation || this._tracked.has(animation)) {
        return;
      }
      const info = describeAnimation(animation, this._types);
      const baseTime = Number(animation.currentTime);
      if (!isFilmRateCandidate(info) || !Number.isFinite(baseTime)) {
        return;
      }
      try {
        animation.pause();
      } catch {
        // The platform refused the pause: leave the loop on its own clock.
        return;
      }
      const rate = Number(animation.playbackRate);
      const slot = this._slotFor(info.group);
      this._tracked.set(animation, {
        baseTime,
        baseClock: nowMs,
        rate: Number.isFinite(rate) ? rate : 1,
        slot,
        dueMs: firstDueAt(nowMs, slot, this._epochMs, this._slots, this._frameMs)
      });
      this._loads[slot] += 1;
      taken += 1;
    });
    return taken;
  }

  /**
   * @description One frame of the stage's loop: collects first when asked to, then redraws every
   *   held loop whose due time has come (its currentTime set from its base and the time since),
   *   and moves its due time on by a film frame, resyncing when it fell behind. A loop that is no
   *   longer paused (gone idle, or played by someone else) is forgotten and never written again.
   * @param {number} [nowMs] - The frame's time (the requestAnimationFrame timestamp).
   * @returns {number} How many loops it redrew.
   * @example
   *   driver.tick(frameTime);
   * @since 2.2.0
   */
  tick(nowMs = this._now()) {
    if (!this._enabled) {
      return 0;
    }
    if (this._pending && this._root) {
      this.collect(this._root, nowMs);
    }
    let redrawn = 0;
    this._tracked.forEach((entry, animation) => {
      if (animation.playState !== 'paused') {
        this._forget(animation);
        return;
      }
      if (nowMs < entry.dueMs) {
        return;
      }
      try {
        animation.currentTime = drivenTimeAt(entry, nowMs);
      } catch {
        // A loop the platform will not seek is handed back rather than left frozen.
        this._forget(animation);
        return;
      }
      // Same key, so the Map's iteration is unaffected.
      const dueMs = nextDueAt(entry.dueMs, nowMs, this._frameMs);
      this._tracked.set(animation, {...entry, dueMs});
      redrawn += 1;
    });
    return redrawn;
  }

  /**
   * @description Hands every held loop back to the platform (play() from where it was drawn
   *   last) and forgets them all. Loops that have gone idle are not played, so a cancelled
   *   animation never comes back. Used when the frame loop stops or settles, on disconnect and
   *   by debug.filmRate(false). Safe to call at any time.
   * @returns {number} How many loops it played.
   * @example
   *   driver.release();
   * @since 2.2.0
   */
  release() {
    let played = 0;
    this._tracked.forEach((_entry, animation) => {
      if (animation.playState === 'idle') {
        return;
      }
      try {
        animation.play();
        played += 1;
      } catch {
        // Nothing to hand back: the animation is gone.
      }
    });
    this._tracked.clear();
    this._loads.fill(0);
    this._pending = false;
    return played;
  }

  /**
   * @description How many loops the driver holds and how many run on the platform's clock under
   *   the root (debug.loops). Reads the root's animations, so it is for diagnosis only.
   * @param {Object} [root] - The render root; the last one the driver saw by default.
   * @returns {{driven: number, native: number}} The counts.
   * @example
   *   driver.stats();
   *   // {driven: 88, native: 6}
   * @since 2.2.0
   */
  stats(root = this._root) {
    let animations = [];
    if (root && typeof root.getAnimations === 'function') {
      try {
        animations = root.getAnimations();
      } catch {
        animations = [];
      }
    }
    const infos = animations.map((animation) => describeAnimation(animation, this._types));
    return summariseLoops(infos, this._tracked.size);
  }

  /**
   * @description The stagger slot for a sprite: the one it already has, else the least loaded.
   * @param {Object|null} group - The sprite (the target's nearest <svg>), or null.
   * @returns {number} The slot.
   * @since 2.2.0
   */
  _slotFor(group) {
    const keyed = group !== null && typeof group === 'object';
    if (keyed && this._groupSlots.has(group)) {
      return this._groupSlots.get(group);
    }
    const slot = leastLoadedSlot(this._loads);
    if (keyed) {
      this._groupSlots.set(group, slot);
    }
    return slot;
  }

  /**
   * @description Forgets one held loop without touching it.
   * @param {Object} animation - The animation.
   * @returns {void}
   * @since 2.2.0
   */
  _forget(animation) {
    const entry = this._tracked.get(animation);
    if (!entry) {
      return;
    }
    this._loads[entry.slot] = Math.max(0, this._loads[entry.slot] - 1);
    this._tracked.delete(animation);
  }

  /**
   * @description Forgets every held loop that has gone idle (its element left the page, or its
   *   class no longer names it).
   * @returns {void}
   * @since 2.2.0
   */
  _forgetIdle() {
    const idle = [];
    this._tracked.forEach((_entry, animation) => {
      if (animation.playState === 'idle') {
        idle.push(animation);
      }
    });
    idle.forEach((animation) => this._forget(animation));
  }
}
