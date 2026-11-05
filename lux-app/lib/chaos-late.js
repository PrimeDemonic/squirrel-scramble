/**
 * The late (second-pass) Chaos events (Chaos v2 contract § 4): the ones that depend on heights,
 * so they can only be decided once the first pass has built every squirrel's climb.
 * - goldenAcorn: at fixed checkpoints, a leader ahead of second place by the level's threshold
 *   (15 height units, 10 in Absolute Carnage) is smacked: a fall of 20% to 30% of its height and
 *   2 dizzy ticks. At most one every 10 s; never in the quiet zone.
 * - trenchCoat: three squirrels on adjacent trees within 15 height units of each other disguise
 *   themselves as one tall squirrel on the middle tree, then topple back to their own trees.
 * - flood bursts: squirrels below the waterline when the water rises get a 3-tick burst.
 *
 * How it stays exact and deterministic. Pass one fixes each squirrel's normaliser (its final
 * running total). Candidates are visited in time order, and a late event at tick c changes only
 * ticks after c: its own span, plus a compensation that reshapes the squirrel's later free ticks
 * (between the event and the quiet zone) so its final total is unchanged. With the normaliser
 * and every earlier total unchanged, every height up to c is exactly what the decision saw, so
 * the finished plan shows the same lead (or the same trio) at that moment, and a later late event
 * can never undo an earlier decision. An event whose compensation would need too strong a boost
 * is dropped. This replaces the contract's "insert and renormalise" with a renormalisation that
 * leaves the past alone; the squirrel still finishes exactly on its stored time.
 *
 * Generator order: candidates in time order (floods before checkpoints on the same tick); per
 * checkpoint the acorn's fall size (only when its threshold and room are met), then the trench
 * coat's chance roll (only when a trio qualifies), trio pick and disguise length.
 *
 * Pure ES module: no DOM, no Lit and no platform imports.
 */
import {effectKinds, layoutFrom} from './race-builder.js';
import {preFinishHeight, totalsFor} from './climb.js';
import {roundTo} from './chaos-events.js';

// Relative error allowed between a compensated final total and the fixed normaliser.
const TOLERANCE = 1e-9;
// Newton steps for the compensation; one is exact unless a running total hits the 0 floor.
const COMPENSATION_STEPS = 3;

/**
 * @description A squirrel's height at a tick, exactly as the finished plan will show it.
 * @param {Object} builder - The race builder.
 * @param {Object} track - The squirrel's track.
 * @param {number} tick - The tick.
 * @returns {number} The height, 0 to 100.
 * @since 2.0.0
 */
function heightAtTick(builder, track, tick) {
  if (tick >= track.tickCount) {
    return 100;
  }
  return preFinishHeight(track.totalAt(tick), track.normaliser(), builder.settings);
}

/**
 * @description Tries a late event's layout on a copy of the squirrel's ticks and works out the
 *   compensation that keeps its final total equal to its normaliser.
 * @param {Object} builder - The race builder.
 * @param {Object} track - The squirrel's track.
 * @param {number} startTick - Where the layout starts.
 * @param {Object} layout - The late event's layout.
 * @returns {{boosts: number[], totals: number[]}|null} The accepted boosts and totals, or null
 *   when the compensation is impossible or out of bounds.
 * @since 2.0.0
 */
function compensate(builder, track, startTick, layout) {
  const rules = builder.settings.deck.compensation;
  const effects = track.effectsCopy();
  layout.effects.forEach((effect) => {
    effects[startTick + effect.offset] = {kind: effect.kind, value: effect.value};
  });
  const free = [];
  for (let tick = startTick + layout.spanTicks; tick <= track.lastEventTick; tick += 1) {
    if (!effects[tick]) {
      free.push(tick);
    }
  }
  if (free.length < rules.minFreeTicks) {
    return null;
  }
  const base = track.baseClimbs();
  const target = track.normaliser();
  const last = track.tickCount;
  const boosts = track.boostsCopy();
  let totals = totalsFor(base, effects, boosts);
  for (let step = 0; step < COMPENSATION_STEPS; step += 1) {
    const residual = target - totals[last];
    if (Math.abs(residual) <= TOLERANCE * target) {
      break;
    }
    // The final total is linear in a common factor on the free ticks' boosts, so doubling them
    // measures the slope and one step lands on the target.
    const doubled = boosts.slice();
    free.forEach((tick) => {
      doubled[tick] = boosts[tick] * 2;
    });
    const slope = totalsFor(base, effects, doubled)[last] - totals[last];
    const factor = slope > 0 ? 1 + residual / slope : 0;
    if (!(factor > 0)) {
      return null;
    }
    free.forEach((tick) => {
      boosts[tick] *= factor;
    });
    totals = totalsFor(base, effects, boosts);
  }
  const settled = Math.abs(target - totals[last]) <= TOLERANCE * target;
  const bounded = free.every((tick) => (
    boosts[tick] >= rules.minBoost && boosts[tick] <= rules.maxBoost
  ));
  return settled && bounded ? {boosts, totals} : null;
}

/**
 * @description Commits a late event's span on a squirrel together with its compensation.
 * @param {Object} track - The squirrel's track.
 * @param {number} startTick - Where the layout starts.
 * @param {Object} layout - The layout.
 * @param {{boosts: number[], totals: number[]}} trial - From compensate.
 * @param {{eventId: string, sequence: number, extra?: Object}} info - The event.
 * @returns {void}
 * @since 2.0.0
 */
function applyTrial(track, startTick, layout, trial, info) {
  track.commit(startTick, layout, {...info, category: 'chaos', personal: true});
  track.setBoosts(trial.boosts);
  track.setTotals(trial.totals);
}

/**
 * @description The moments the late pass visits, in time order: each pending flood at the tick
 *   before its burst, then the Golden Acorn and trench-coat checkpoints.
 * @param {Object} builder - The race builder.
 * @returns {Array<{kind: string, tick: number, flood?: Object}>} The candidates.
 * @since 2.0.0
 */
function lateCandidates(builder) {
  const {level, settings} = builder;
  const rules = settings.deck.goldenAcorn;
  const candidates = builder.pendingFloods().map((flood) => ({
    kind: 'flood', tick: flood.burstStartTick - 1, order: 0, sequence: flood.sequence, flood
  }));
  if (level.deck.goldenAcorn || level.deck.trenchCoatMax > 0) {
    const step = Math.max(1, Math.round(rules.checkpointMs / settings.tickMs));
    const from = Math.ceil((builder.durationMs * rules.fromPercent) / (100 * settings.tickMs));
    const to = Math.floor((builder.durationMs * rules.toPercent) / (100 * settings.tickMs));
    for (let tick = from; tick <= to; tick += step) {
      candidates.push({kind: 'checkpoint', tick, order: 1, sequence: 0});
    }
  }
  return candidates.sort((left, right) => (
    left.tick - right.tick || left.order - right.order || left.sequence - right.sequence
  ));
}

/**
 * @description The Golden Acorn's layout: the fall, then the dizzy ticks.
 * @param {Object} rules - The deck's goldenAcorn settings.
 * @param {number} fallFraction - The share of the running total lost.
 * @returns {Object} The layout.
 * @since 2.0.0
 */
function acornLayout(rules, fallFraction) {
  return layoutFrom([
    {kind: effectKinds.fallFraction, ticks: 1, value: fallFraction},
    {kind: effectKinds.stall, ticks: rules.dizzyTicks}
  ]);
}

/**
 * @description Checks the Golden Acorn at one checkpoint and smacks the leader when it is clear
 *   of second place by the level's threshold (ties go to the lower input index, as leaderAt).
 * @param {Object} builder - The race builder.
 * @param {number} tick - The checkpoint tick (the impact is the tick after).
 * @returns {boolean} True when the acorn struck.
 * @since 2.0.0
 */
function tryGoldenAcorn(builder, tick) {
  const {tracks, level, settings} = builder;
  const rules = settings.deck.goldenAcorn;
  const ranked = tracks
    .map((track) => ({track, height: heightAtTick(builder, track, tick)}))
    .sort((left, right) => right.height - left.height || left.track.index - right.track.index);
  const lead = ranked[0].height - ranked[1].height;
  const leader = ranked[0].track;
  const startTick = tick + 1;
  const probe = acornLayout(rules, rules.minFallFraction);
  const startMs = builder.tickStartMs(startTick);
  const endMs = builder.tickEndMs(startTick + probe.spanTicks - 1);
  if (lead < level.goldenAcornLeadUnits || !leader.canPlace(startTick, probe)
    || !builder.overlapAllows(startMs, endMs)) {
    return false;
  }
  const fallFraction = builder.rng.floatBetween(rules.minFallFraction, rules.maxFallFraction);
  const layout = acornLayout(rules, fallFraction);
  const trial = compensate(builder, leader, startTick, layout);
  if (!trial) {
    return false;
  }
  const leaderLane = leader.laneAt(startMs).lane;
  // The acorn homes in from the far side of the field.
  const fromLane = leaderLane - 1 < tracks.length - leaderLane ? tracks.length : 1;
  const {id, sequence} = builder.registerEvent({
    type: 'goldenAcorn',
    category: 'chaos',
    scope: 'entrants',
    outcome: 'hit',
    startMs,
    endMs,
    entrants: [leader.index],
    data: {
      fromLane,
      impactMs: startMs,
      checkpointMs: tick * settings.tickMs,
      leadUnits: roundTo(lead, 4),
      thresholdUnits: level.goldenAcornLeadUnits,
      fallPercent: roundTo(fallFraction * 100, 1)
    }
  });
  applyTrial(leader, startTick, layout, trial, {eventId: id, sequence});
  return true;
}

/**
 * @description The trios that could put on the trench coat at a checkpoint: three squirrels on
 *   adjacent trees, none flying or hidden, within the height gap, and all free.
 * @param {Object} builder - The race builder.
 * @param {number} tick - The checkpoint tick.
 * @param {Object} probe - The shortest coat layout.
 * @returns {Array<Object[]>} Trios as [left, host, right] tracks.
 * @since 2.0.0
 */
function coatTrios(builder, tick, probe) {
  const rules = builder.settings.deck.trenchCoat;
  const startTick = tick + 1;
  const startMs = builder.tickStartMs(startTick);
  const byLane = new Map();
  builder.tracks.forEach((track) => {
    const where = track.laneAt(startMs);
    if (!where.flight && !where.hidden) {
      byLane.set(where.lane, track);
    }
  });
  const trios = [];
  for (let lane = 2; lane < builder.tracks.length; lane += 1) {
    const trio = [byLane.get(lane - 1), byLane.get(lane), byLane.get(lane + 1)];
    if (trio.every(Boolean)) {
      const heights = trio.map((track) => heightAtTick(builder, track, tick));
      const gap = Math.max(...heights) - Math.min(...heights);
      const free = trio.every((track) => track.canPlace(startTick, probe));
      if (gap <= rules.maxHeightGapUnits && free) {
        trios.push(trio);
      }
    }
  }
  return trios;
}

/**
 * @description The trench coat's layout: the disguise, then the dazed topple.
 * @param {Object} rules - The deck's trenchCoat settings.
 * @param {number} disguiseTicks - How long the disguise holds.
 * @returns {Object} The layout.
 * @since 2.0.0
 */
function coatLayout(rules, disguiseTicks) {
  return layoutFrom([
    {kind: effectKinds.stall, ticks: disguiseTicks},
    {kind: effectKinds.stall, ticks: rules.dazedTicks}
  ]);
}

/**
 * @description Records the outer two squirrels' trip onto the host's tree (hidden inside the coat)
 *   and their topple back. The only time a tree holds more than one racer (contract § 4).
 * @param {Object} builder - The race builder.
 * @param {{id: string, outer: Object[], ownLanes: number[], hostLane: number, startTick: number,
 *   disguiseTicks: number}} coat - The coat.
 * @returns {void}
 * @since 2.0.0
 */
function disguiseLanes(builder, coat) {
  const rules = builder.settings.deck.trenchCoat;
  const startMs = builder.tickStartMs(coat.startTick);
  const toppleTick = coat.startTick + coat.disguiseTicks;
  coat.outer.forEach((track, slot) => {
    track.addLaneChange({
      eventId: coat.id,
      kind: 'disguise',
      tick: coat.startTick,
      fromLane: coat.ownLanes[slot],
      toLane: coat.hostLane,
      flightStartMs: startMs,
      flightEndMs: startMs,
      hidden: true
    });
    track.addLaneChange({
      eventId: coat.id,
      kind: 'topple',
      tick: toppleTick,
      fromLane: coat.hostLane,
      toLane: coat.ownLanes[slot],
      flightStartMs: builder.tickStartMs(toppleTick),
      flightEndMs: builder.tickEndMs(toppleTick + rules.dazedTicks - 1),
      hidden: false
    });
  });
}

/**
 * @description Checks the trench coat at one checkpoint and, at the level's chance, dresses a
 *   qualifying trio.
 * @param {Object} builder - The race builder.
 * @param {number} tick - The checkpoint tick (the disguise starts the tick after).
 * @returns {boolean} True when a coat went on.
 * @since 2.0.0
 */
function tryTrenchCoat(builder, tick) {
  const {rng, level, settings} = builder;
  const rules = settings.deck.trenchCoat;
  if (builder.tracks.length < 3) {
    return false;
  }
  const trios = coatTrios(builder, tick, coatLayout(rules, rules.minDisguiseTicks));
  if (trios.length === 0 || !rng.chance(level.deck.trenchCoatChance)) {
    return false;
  }
  const trio = rng.pick(trios);
  const disguiseTicks = rng.intBetween(rules.minDisguiseTicks, rules.maxDisguiseTicks);
  const layout = coatLayout(rules, disguiseTicks);
  const startTick = tick + 1;
  const startMs = builder.tickStartMs(startTick);
  const endMs = builder.tickEndMs(startTick + layout.spanTicks - 1);
  const fits = trio.every((track) => track.canPlace(startTick, layout));
  const trials = fits ? trio.map((track) => compensate(builder, track, startTick, layout)) : [];
  if (!fits || trials.some((trial) => trial === null) || !builder.overlapAllows(startMs, endMs)) {
    return false;
  }
  const [left, host, right] = trio;
  const ownLanes = [left, right].map((track) => track.laneAt(startMs).lane);
  const hostLane = host.laneAt(startMs).lane;
  const {id, sequence} = builder.registerEvent({
    type: 'trenchCoat',
    category: 'chaos',
    scope: 'entrants',
    outcome: null,
    startMs,
    endMs,
    entrants: trio.map((track) => track.index),
    data: {host: host.index, hidden: [left.index, right.index], hostLane, disguiseTicks}
  });
  trio.forEach((track, slot) => {
    applyTrial(track, startTick, layout, trials[slot], {eventId: id, sequence});
  });
  disguiseLanes(builder, {id, outer: [left, right], ownLanes, hostLane, startTick, disguiseTicks});
  return true;
}

/**
 * @description The flood's bursts: every squirrel below the waterline at the tick before the burst
 *   (and free for it) gets a 3-tick burst upwards.
 * @param {Object} builder - The race builder.
 * @param {{tick: number, flood: {eventId: string, sequence: number, burstStartTick: number,
 *   waterUnits: number}}} candidate - The flood candidate.
 * @returns {void}
 * @since 2.0.0
 */
function applyFlood(builder, candidate) {
  const rules = builder.settings.deck.flood;
  const {flood} = candidate;
  const layout = layoutFrom([
    {kind: effectKinds.scale, ticks: rules.burstTicks, value: rules.burstMultiplier}
  ]);
  const below = builder.tracks.filter((track) => (
    heightAtTick(builder, track, candidate.tick) < flood.waterUnits
    && track.canPlace(flood.burstStartTick, layout)
  ));
  const bursters = [];
  below.forEach((track) => {
    const trial = compensate(builder, track, flood.burstStartTick, layout);
    if (trial) {
      applyTrial(track, flood.burstStartTick, layout, trial, {
        eventId: flood.eventId, sequence: flood.sequence
      });
      bursters.push(track.index);
    }
  });
  builder.patchEventData(flood.eventId, {bursters});
}

/**
 * @description Runs the late pass. Call it after every squirrel's totals and normaliser are set
 *   from pass one, and after lanes are resolved.
 * @param {Object} builder - The race builder, with its level set.
 * @returns {void}
 * @example
 *   placeLateEvents(builder);
 * @since 2.0.0
 */
export function placeLateEvents(builder) {
  const {level, settings} = builder;
  const minGapTicks = Math.round(settings.deck.goldenAcorn.minGapMs / settings.tickMs);
  let lastAcornTick = null;
  let trenchCoats = 0;
  lateCandidates(builder).forEach((candidate) => {
    if (candidate.kind === 'flood') {
      applyFlood(builder, candidate);
      return;
    }
    const acornDue = level.deck.goldenAcorn && builder.tracks.length >= 2
      && (lastAcornTick === null || candidate.tick - lastAcornTick >= minGapTicks);
    if (acornDue && tryGoldenAcorn(builder, candidate.tick)) {
      lastAcornTick = candidate.tick;
    }
    if (trenchCoats < level.deck.trenchCoatMax && tryTrenchCoat(builder, candidate.tick)) {
      trenchCoats += 1;
    }
  });
}
