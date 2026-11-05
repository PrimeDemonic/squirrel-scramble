/**
 * Build-time state for one race plan (SPEC.md § 10 and § 11, Chaos v2 contract § 1 and § 3),
 * shared by the Classic layer, the Chaos deck and the late (second-pass) events. Nothing here
 * reaches the finished plan directly: the plan is plain data copied out at the end.
 *
 * A race runs on one tick grid (250 ms): tick k of every entrant covers the time from
 * (k - 1) x 250 ms to k x 250 ms, so a race-wide moment is the same tick number for every
 * squirrel. An event occupies a run of consecutive ticks (its span) on each squirrel it touches;
 * each tick in the span may carry an effect that replaces or changes that tick's climb. Spans
 * never overlap on one squirrel, so a squirrel never does two climb-changing things at once.
 * Events themselves may overlap in time on different squirrels, up to the level's cap.
 *
 * Lane changes (tornado, UFO) and outfit changes (hat losses, UFO swaps) are recorded as
 * relative operations while events are placed, in whatever order the deck places them, and
 * resolved in time order afterwards, so a later-placed but earlier-timed event can never leave
 * a lane or an outfit inconsistent.
 *
 * The classes keep their working state on this; functions that receive a builder or a track
 * change it only through these methods.
 *
 * Pure ES module: no DOM, no Lit and no platform imports.
 */

/** How an effect changes one tick's climb (see climb.js). */
export const effectKinds = Object.freeze({
  // Visual only: the tick climbs normally.
  idle: 'idle',
  // No climb this tick; counts towards the level's stall limit.
  stall: 'stall',
  // The base climb times value.
  scale: 'scale',
  // Exactly value climb units (negative for a slip or a drop, positive for a lift).
  set: 'set',
  // Minus value times the running total so far (a hunter's hit, the Golden Acorn).
  fallFraction: 'fallFraction'
});

/**
 * @description A deep copy of plain data (arrays, plain objects, numbers, strings, booleans,
 *   null). Several times faster than a JSON round trip, which matters because every event's data
 *   is copied into the plan more than once.
 * @param {*} value - Plain data.
 * @returns {*} The copy.
 * @example
 *   clonePlain({swaps: [{entrant: 1}]});
 * @since 2.0.0
 */
export function clonePlain(value) {
  if (Array.isArray(value)) {
    return value.map(clonePlain);
  }
  if (value && typeof value === 'object') {
    const copy = {};
    Object.keys(value).forEach((key) => {
      copy[key] = clonePlain(value[key]);
    });
    return copy;
  }
  return value;
}

/**
 * @description Builds an event layout from consecutive segments.
 * @param {Array<{kind: string, ticks: number, value?: number}>} segments - In tick order.
 * @returns {{spanTicks: number, stallTicks: number,
 *   effects: Array<{offset: number, kind: string, value: number}>}} The layout: how many ticks
 *   it occupies, how many of them are stalls, and the effect on each non-idle tick.
 * @example
 *   layoutFrom([{kind: effectKinds.stall, ticks: 3}]);
 *   // {spanTicks: 3, stallTicks: 3, effects: [...three stalls]}
 * @since 1.0.0
 */
export function layoutFrom(segments) {
  const effects = [];
  let offset = 0;
  let stallTicks = 0;
  segments.forEach((segment) => {
    for (let step = 0; step < segment.ticks; step += 1) {
      if (segment.kind !== effectKinds.idle) {
        effects.push({offset: offset + step, kind: segment.kind, value: segment.value ?? 0});
      }
    }
    if (segment.kind === effectKinds.stall) {
      stallTicks += segment.ticks;
    }
    offset += segment.ticks;
  });
  return {spanTicks: offset, stallTicks, effects};
}

/**
 * @description Where a squirrel is at a moment, from its start lane and its lane timeline. During
 *   a flight, lane is the tree it left; between a trench-coat disguise and the topple it is the
 *   host's tree and hidden is true.
 * @param {number} startLane - The lane from the payload.
 * @param {Array<{fromLane: number, toLane: number, flightStartMs: number, flightEndMs: number,
 *   hidden?: boolean}>} timeline - Lane changes in time order.
 * @param {number} timeMs - Milliseconds since the start.
 * @returns {{lane: number, flight: ({fromLane: number, toLane: number, progress: number}|null),
 *   hidden: boolean}} The tree, the flight (progress 0 to 1) or null, and whether hidden.
 * @example
 *   laneFromTimeline(3, [], 1000);
 *   // {lane: 3, flight: null, hidden: false}
 * @since 2.0.0
 */
export function laneFromTimeline(startLane, timeline, timeMs) {
  let lane = startLane;
  let hidden = false;
  for (const entry of timeline) {
    if (timeMs < entry.flightStartMs) {
      break;
    }
    if (timeMs < entry.flightEndMs) {
      const progress = (timeMs - entry.flightStartMs) / (entry.flightEndMs - entry.flightStartMs);
      const flight = {fromLane: entry.fromLane, toLane: entry.toLane, progress};
      return {lane: entry.fromLane, flight, hidden: false};
    }
    lane = entry.toLane;
    hidden = entry.hidden === true;
  }
  return {lane, flight: null, hidden};
}

/**
 * Tick bookkeeping for one entrant while its plan is built.
 */
export class EntrantTrack {
  /**
   * @description Sets up an empty track for one entrant.
   * @param {{lane: number, finishMs: number}} entrant - The payload entrant.
   * @param {number} index - The entrant's index in the input list.
   * @param {{tickMs: number, eventFreeTailPercent: number, maxStallPercent: number,
   *   earliestEventTick: number}} settings - Choreography settings (the stall limit is the
   *   level's).
   * @since 1.0.0
   */
  constructor(entrant, index, settings) {
    this.index = index;
    this.startLane = entrant.lane;
    this.finishMs = entrant.finishMs;
    this.tickCount = Math.ceil(entrant.finishMs / settings.tickMs);
    this.earliestEventTick = settings.earliestEventTick;
    // Integer arithmetic: ticks past this one are the event-free last 10% (contract § 1).
    this.lastEventTick = Math.floor(
      (this.tickCount * (100 - settings.eventFreeTailPercent)) / 100
    );
    this.stallLimit = Math.floor((this.tickCount * settings.maxStallPercent) / 100);
    this._occupied = new Array(this.tickCount + 1).fill(false);
    this._effects = new Array(this.tickCount + 1).fill(null);
    this._boosts = new Array(this.tickCount + 1).fill(1);
    this._stalledTicks = 0;
    this._spans = [];
    this._laneTimeline = [];
    this._baseClimbs = null;
    this._totals = null;
    this._normaliser = null;
  }

  /**
   * @description The last tick a layout may start on and still end before the event-free tail.
   * @param {{spanTicks: number}} layout - The event layout.
   * @returns {number} The tick (may be below earliestEventTick when nothing fits).
   * @since 1.0.0
   */
  latestStart(layout) {
    return this.lastEventTick - layout.spanTicks + 1;
  }

  /**
   * @description Says whether a layout fits at a start tick: inside the event window, on free
   *   ticks only, and within the stall limit.
   * @param {number} startTick - The first tick of the span.
   * @param {{spanTicks: number, stallTicks: number}} layout - The event layout.
   * @returns {boolean} True when the layout can be committed there.
   * @since 1.0.0
   */
  canPlace(startTick, layout) {
    const endTick = startTick + layout.spanTicks - 1;
    if (startTick < this.earliestEventTick || endTick > this.lastEventTick) {
      return false;
    }
    if (this._stalledTicks + layout.stallTicks > this.stallLimit) {
      return false;
    }
    for (let tick = startTick; tick <= endTick; tick += 1) {
      if (this._occupied[tick]) {
        return false;
      }
    }
    return true;
  }

  /**
   * @description Occupies a span, writes its effects and records which event it belongs to.
   * @param {number} startTick - The first tick of the span.
   * @param {{spanTicks: number, stallTicks: number,
   *   effects: Array<{offset: number, kind: string, value: number}>}} layout - The layout.
   * @param {{eventId: string, sequence: number, category: string, personal: boolean,
   *   extra?: Object}} info - The event and whether it singles this squirrel out.
   * @returns {{startTick: number, endTick: number}} The occupied span.
   * @throws {Error} If the layout does not fit (callers check canPlace first).
   * @since 1.0.0
   */
  commit(startTick, layout, info) {
    if (!this.canPlace(startTick, layout)) {
      throw new Error(`Event does not fit entrant ${this.index} at tick ${startTick}.`);
    }
    const endTick = startTick + layout.spanTicks - 1;
    for (let tick = startTick; tick <= endTick; tick += 1) {
      this._occupied[tick] = true;
    }
    layout.effects.forEach((effect) => {
      this._effects[startTick + effect.offset] = {kind: effect.kind, value: effect.value};
    });
    this._stalledTicks += layout.stallTicks;
    this._spans.push({
      eventId: info.eventId,
      sequence: info.sequence,
      category: info.category,
      personal: info.personal === true,
      startTick,
      endTick,
      stallTicks: layout.stallTicks,
      extra: {...(info.extra || {})}
    });
    return {startTick, endTick};
  }

  /**
   * @description Says whether this squirrel has a Chaos moment of its own (an event that singles
   *   it out, not just a field-wide stall), for the "every squirrel" rule (contract § 1).
   * @returns {boolean} True when it has one.
   * @since 2.0.0
   */
  hasPersonalChaos() {
    return this._spans.some((span) => span.category === 'chaos' && span.personal);
  }

  /**
   * @description Stores the base climbs rolled by the Classic layer.
   * @param {number[]} baseClimbs - Base climb per tick, index 1 to tickCount.
   * @returns {void}
   * @since 2.0.0
   */
  setBaseClimbs(baseClimbs) {
    this._baseClimbs = baseClimbs.slice();
  }

  /**
   * @description The base climbs (a copy).
   * @returns {number[]} Base climb per tick.
   * @since 2.0.0
   */
  baseClimbs() {
    return this._baseClimbs.slice();
  }

  /**
   * @description A copy of the per-tick effects, for a trial placement.
   * @returns {Array<({kind: string, value: number}|null)>} The effects.
   * @since 2.0.0
   */
  effectsCopy() {
    return this._effects.map((effect) => (effect ? {...effect} : null));
  }

  /**
   * @description A copy of the per-tick boosts, for a trial placement.
   * @returns {number[]} The boosts.
   * @since 2.0.0
   */
  boostsCopy() {
    return this._boosts.slice();
  }

  /**
   * @description Replaces the per-tick boosts after an accepted compensation.
   * @param {number[]} boosts - The new boosts.
   * @returns {void}
   * @since 2.0.0
   */
  setBoosts(boosts) {
    this._boosts = boosts.slice();
  }

  /**
   * @description Stores the running totals, and the normaliser when given (pass one fixes it;
   *   late events keep it).
   * @param {number[]} totals - Running totals, tick 0 to tickCount.
   * @param {number} [normaliser] - The normaliser.
   * @returns {void}
   * @since 2.0.0
   */
  setTotals(totals, normaliser) {
    this._totals = totals.slice();
    if (normaliser !== undefined) {
      this._normaliser = normaliser;
    }
  }

  /**
   * @description The running totals (a copy).
   * @returns {number[]} Running totals.
   * @since 2.0.0
   */
  totals() {
    return this._totals.slice();
  }

  /**
   * @description The fixed normaliser.
   * @returns {number} The normaliser.
   * @since 2.0.0
   */
  normaliser() {
    return this._normaliser;
  }

  /**
   * @description The running total at one tick (no copy).
   * @param {number} tick - The tick.
   * @returns {number} The total.
   * @since 2.0.0
   */
  totalAt(tick) {
    return this._totals[tick];
  }

  /**
   * @description The effect on one tick, if any.
   * @param {number} tick - The tick (1 to tickCount).
   * @returns {{kind: string, value: number}|null} The effect.
   * @since 1.0.0
   */
  effectAt(tick) {
    return this._effects[tick];
  }

  /**
   * @description Adds a lane change, keeping the timeline in time order.
   * @param {{eventId: string, kind: string, tick: number, fromLane: number, toLane: number,
   *   flightStartMs: number, flightEndMs: number, hidden: boolean}} entry - The lane change.
   * @returns {void}
   * @since 1.0.0
   */
  addLaneChange(entry) {
    const position = this._laneTimeline.findIndex((existing) => (
      existing.flightStartMs > entry.flightStartMs
    ));
    const at = position === -1 ? this._laneTimeline.length : position;
    this._laneTimeline.splice(at, 0, {...entry});
  }

  /**
   * @description Where this squirrel is at a moment (see laneFromTimeline).
   * @param {number} timeMs - Milliseconds since the start.
   * @returns {{lane: number, flight: Object|null, hidden: boolean}} The position.
   * @since 2.0.0
   */
  laneAt(timeMs) {
    return laneFromTimeline(this.startLane, this._laneTimeline, timeMs);
  }

  /**
   * @description Copies out the spans, lane timeline and stall count for the plan.
   * @returns {{spans: Array<Object>, laneTimeline: Array<Object>, stalledTicks: number}} Copies.
   * @since 1.0.0
   */
  snapshot() {
    return {
      spans: this._spans.map((span) => ({...span, extra: {...span.extra}})),
      laneTimeline: this._laneTimeline.map((entry) => ({...entry})),
      stalledTicks: this._stalledTicks
    };
  }
}

/**
 * @description Linear interpolation over [share, weight] points.
 * @param {Array<number[]>} points - Points in share order, from 0 to 1.
 * @param {number} share - Where to read, 0 to 1.
 * @returns {number} The weight.
 * @since 2.0.0
 */
function curveAt(points, share) {
  for (let index = 1; index < points.length; index += 1) {
    const [rightShare, rightWeight] = points[index];
    if (share <= rightShare) {
      const [leftShare, leftWeight] = points[index - 1];
      const span = rightShare - leftShare;
      const fraction = span > 0 ? (share - leftShare) / span : 0;
      return leftWeight + (rightWeight - leftWeight) * fraction;
    }
  }
  return points[points.length - 1][1];
}

/**
 * Race-wide build state: the generator, the settings, every entrant's track, the event registry
 * (for the overlap cap and the plan), the intensity curve, and the lane and outfit operations.
 */
export class RaceBuilder {
  /**
   * @description Sets up the build state.
   * @param {{rng: Object, settings: Object, tracks: EntrantTrack[], durationMs: number,
   *   mode: string, level: (Object|null), storedOutfits: Array<Object>}} parts - The generator,
   *   resolved settings, tracks, race length, mode, Chaos level settings (null in Classic) and
   *   each entrant's drawable stored outfit.
   * @since 1.0.0
   */
  constructor({rng, settings, tracks, durationMs, mode, level, storedOutfits}) {
    this.rng = rng;
    this.settings = settings;
    this.tracks = tracks;
    this.durationMs = durationMs;
    this.mode = mode;
    this.level = level;
    this.raceTicks = Math.max(1, Math.floor(durationMs / settings.tickMs));
    this._storedOutfits = storedOutfits.map((outfit) => ({...outfit}));
    this._sequence = 0;
    this._events = [];
    this._notes = new Map();
    this._laneOps = [];
    this._outfitOps = [];
    this._outfitTimelines = null;
    this._pendingFloods = [];
    this._finale = null;
    this._intensity = null;
  }

  /**
   * @description The next event sequence number (ids and tie-breaks use it).
   * @returns {number} 1, 2, 3 and so on.
   * @since 1.0.0
   */
  nextSequence() {
    this._sequence += 1;
    return this._sequence;
  }

  /**
   * @description The time a tick starts.
   * @param {number} tick - The tick.
   * @returns {number} Milliseconds from the start of the race.
   * @since 1.0.0
   */
  tickStartMs(tick) {
    return (tick - 1) * this.settings.tickMs;
  }

  /**
   * @description The time a tick ends.
   * @param {number} tick - The tick.
   * @returns {number} Milliseconds from the start of the race.
   * @since 1.0.0
   */
  tickEndMs(tick) {
    return tick * this.settings.tickMs;
  }

  /**
   * @description A squirrel's stored outfit (drawable ids), as it was before any event.
   * @param {number} index - The entrant.
   * @returns {{hat: string, cape: string, accessory: string, fur: string}} A copy.
   * @since 2.0.0
   */
  storedOutfit(index) {
    return {...this._storedOutfits[index]};
  }

  /**
   * @description Registers an event and gives it its id ('evt-N', contract § 3).
   * @param {{type: string, category: string, scope: string, outcome: (string|null),
   *   startMs: number, endMs: number, entrants: number[], data: Object}} event - The event.
   * @returns {{id: string, sequence: number}} Its id and sequence.
   * @since 2.0.0
   */
  registerEvent(event) {
    const sequence = this.nextSequence();
    const id = `evt-${sequence}`;
    this._events.push({
      id,
      sequence,
      type: event.type,
      category: event.category,
      scope: event.scope,
      outcome: event.outcome ?? null,
      startMs: event.startMs,
      endMs: event.endMs,
      entrants: event.entrants.slice(),
      data: clonePlain(event.data || {})
    });
    return {id, sequence};
  }

  /**
   * @description Adds resolved values to an event's data (lane swaps, lost hats, flood bursts).
   * @param {string} eventId - The event.
   * @param {Object} patch - Fields to set.
   * @returns {void}
   * @since 2.0.0
   */
  patchEventData(eventId, patch) {
    const current = this._notes.get(eventId) || {};
    this._notes.set(eventId, {...current, ...clonePlain(patch)});
  }

  /**
   * @description Says whether one more Chaos event over [startMs, endMs) keeps the number of
   *   Chaos events on screen at once within the level's cap (contract § 1). The count is highest
   *   at some event's start (or at startMs), so those are the only moments checked.
   * @param {number} startMs - The new event's start.
   * @param {number} endMs - The new event's end.
   * @param {number} [alsoActive] - Events about to be added over the same window.
   * @returns {boolean} True when the cap holds.
   * @since 2.0.0
   */
  overlapAllows(startMs, endMs, alsoActive = 0) {
    const cap = this.level ? this.level.maxOverlap : Infinity;
    const chaos = this._events.filter((event) => (
      event.category === 'chaos' && event.startMs < endMs && event.endMs > startMs
    ));
    const moments = [startMs].concat(chaos
      .map((event) => event.startMs)
      .filter((moment) => moment > startMs && moment < endMs));
    const busiest = moments.reduce((most, moment) => {
      const active = chaos.filter((event) => event.startMs <= moment && moment < event.endMs);
      return Math.max(most, active.length);
    }, 0);
    return busiest + 1 + alsoActive <= cap;
  }

  /**
   * @description Builds the cumulative intensity weights over the race's start ticks (contract
   *   § 1): calm early, building, peaking around 55% to 75%, fading before the quiet zone.
   * @returns {{fromTick: number, cumulative: number[], total: number}} The table.
   * @since 2.0.0
   */
  _intensityTable() {
    if (this._intensity) {
      return this._intensity;
    }
    const {points} = this.settings.deck.intensity;
    const fromTick = this.settings.earliestEventTick;
    const toTick = Math.floor((this.raceTicks * (100 - this.settings.eventFreeTailPercent)) / 100);
    const cumulative = [];
    let total = 0;
    for (let tick = fromTick; tick <= toTick; tick += 1) {
      total += Math.max(0, curveAt(points, (tick - 1) / this.raceTicks));
      cumulative.push(total);
    }
    this._intensity = {fromTick, cumulative, total};
    return this._intensity;
  }

  /**
   * @description Draws a start tick from the intensity curve: one generator draw, then a binary
   *   search over the cumulative weights.
   * @returns {number} The start tick.
   * @since 2.0.0
   */
  sampleStartTick() {
    const {fromTick, cumulative, total} = this._intensityTable();
    const target = this.rng.nextFloat() * total;
    if (cumulative.length === 0 || !(total > 0)) {
      return fromTick;
    }
    let low = 0;
    let high = cumulative.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (cumulative[middle] > target) {
        high = middle;
      } else {
        low = middle + 1;
      }
    }
    return fromTick + low;
  }

  /**
   * @description Records a lane operation: the members' trees are permuted when it lands.
   * @param {{eventId: string, sequence: number, startMs: number, flightEndMs: number,
   *   landingTick: number, members: number[], permutation: number[]}} operation - Member m lands
   *   on the tree member permutation[m] was on when the flight started.
   * @returns {void}
   * @since 2.0.0
   */
  addLaneOp(operation) {
    this._laneOps.push({
      ...operation,
      members: operation.members.slice(),
      permutation: operation.permutation.slice()
    });
  }

  /**
   * @description Records an outfit operation: a lost hat or a swap between two squirrels.
   * @param {{eventId: string, sequence: number, atMs: number, kind: string,
   *   entrants: number[], note: string}} operation - kind 'hatOff' or 'swap'; note says which
   *   data field to fill ('hatChomp', 'hatLoss' or 'none').
   * @returns {void}
   * @since 2.0.0
   */
  addOutfitOp(operation) {
    this._outfitOps.push({...operation, entrants: operation.entrants.slice()});
  }

  /**
   * @description Resolves every lane operation in time order into each squirrel's lane timeline,
   *   and notes each event's swaps with absolute lanes.
   * @returns {void}
   * @since 2.0.0
   */
  resolveLanes() {
    const current = this.tracks.map((track) => track.startLane);
    const ordered = this._laneOps.slice().sort((left, right) => (
      left.startMs - right.startMs || left.sequence - right.sequence
    ));
    ordered.forEach((operation) => {
      const from = operation.members.map((index) => current[index]);
      const to = operation.permutation.map((slot) => from[slot]);
      const swaps = operation.members.map((index, slot) => {
        current[index] = to[slot];
        this.tracks[index].addLaneChange({
          eventId: operation.eventId,
          kind: 'flight',
          tick: operation.landingTick,
          fromLane: from[slot],
          toLane: to[slot],
          flightStartMs: operation.startMs,
          flightEndMs: operation.flightEndMs,
          hidden: false
        });
        return {entrant: index, entrantIndex: index, fromLane: from[slot], toLane: to[slot]};
      });
      this.patchEventData(operation.eventId, {swaps});
    });
  }

  /**
   * @description Resolves every outfit operation in time order into each squirrel's outfit
   *   timeline. A hat can only be lost once: a squirrel already bare-headed loses nothing, and
   *   its event's data says so.
   * @returns {void}
   * @since 2.0.0
   */
  resolveOutfits() {
    const current = this._storedOutfits.map((outfit) => ({...outfit}));
    const timelines = current.map((outfit) => [{atMs: 0, outfit: {...outfit}}]);
    const lostByEvent = new Map();
    const ordered = this._outfitOps.slice().sort((left, right) => (
      left.atMs - right.atMs || left.sequence - right.sequence
    ));
    ordered.forEach((operation) => {
      if (operation.kind === 'swap') {
        const [first, second] = operation.entrants;
        const held = current[first];
        current[first] = current[second];
        current[second] = held;
        [first, second].forEach((index) => {
          timelines[index].push({atMs: operation.atMs, outfit: {...current[index]}});
        });
        return;
      }
      const lost = lostByEvent.get(operation.eventId) || [];
      operation.entrants.forEach((index) => {
        if (current[index].hat !== 'none') {
          lost.push({entrant: index, hat: current[index].hat});
          current[index] = {...current[index], hat: 'none'};
          timelines[index].push({atMs: operation.atMs, outfit: {...current[index]}});
        }
      });
      lostByEvent.set(operation.eventId, lost);
      this._noteLostHats(operation, lost);
    });
    this._outfitTimelines = timelines;
  }

  /**
   * @description Notes who actually lost a hat to an event.
   * @param {{eventId: string, note: string}} operation - The hat-loss operation.
   * @param {Array<{entrant: number, hat: string}>} lost - Hats lost to it so far.
   * @returns {void}
   * @since 2.0.0
   */
  _noteLostHats(operation, lost) {
    if (operation.note === 'hatChomp') {
      const chomped = lost[0] || null;
      this.patchEventData(operation.eventId, {
        hatChomp: chomped ? chomped.entrant : null,
        stolenHat: chomped ? chomped.hat : null
      });
    } else if (operation.note === 'hatLoss') {
      this.patchEventData(operation.eventId, {
        hatLoss: lost.map((item) => item.entrant),
        lostHats: lost.map((item) => ({...item}))
      });
    }
  }

  /**
   * @description One squirrel's outfit timeline (after resolveOutfits).
   * @param {number} index - The entrant.
   * @returns {Array<{atMs: number, outfit: Object}>} Copies, in time order.
   * @since 2.0.0
   */
  outfitTimeline(index) {
    return this._outfitTimelines[index].map((entry) => ({
      atMs: entry.atMs,
      outfit: {...entry.outfit}
    }));
  }

  /**
   * @description Records a flood whose bursts are decided in the late pass.
   * @param {{eventId: string, sequence: number, burstStartTick: number,
   *   waterUnits: number}} flood - The flood.
   * @returns {void}
   * @since 2.0.0
   */
  addPendingFlood(flood) {
    this._pendingFloods.push({...flood});
  }

  /**
   * @description The floods waiting for the late pass.
   * @returns {Array<Object>} Copies.
   * @since 2.0.0
   */
  pendingFloods() {
    return this._pendingFloods.map((flood) => ({...flood}));
  }

  /**
   * @description Records the finale burst (Absolute Carnage).
   * @param {{anchorMs: number, eventIds: string[]}} finale - The burst.
   * @returns {void}
   * @since 2.0.0
   */
  setFinale(finale) {
    this._finale = {anchorMs: finale.anchorMs, eventIds: finale.eventIds.slice()};
  }

  /**
   * @description The finale burst, or null.
   * @returns {{anchorMs: number, eventIds: string[]}|null} A copy.
   * @since 2.0.0
   */
  finale() {
    return this._finale ? {...this._finale, eventIds: this._finale.eventIds.slice()} : null;
  }

  /**
   * @description Every registered event with its resolved data, in time order (copies).
   * @returns {Array<Object>} The events.
   * @since 2.0.0
   */
  eventsSnapshot() {
    return this._events
      .map((event) => ({
        ...event,
        entrants: event.entrants.slice(),
        data: clonePlain({...event.data, ...(this._notes.get(event.id) || {})})
      }))
      .sort((left, right) => left.startMs - right.startMs || left.sequence - right.sequence);
  }
}
