/**
 * The Chaos deck for one race (SPEC.md § 10, Chaos v2 contract § 1 and § 4): lays the level's
 * events on top of the Classic race. Every event changes only per-tick climbs before normalising
 * (choreography.js), so none can change the stored finishing order.
 *
 * Rules held here, in race-builder.js or in chaos-late.js:
 * - no climb-changing event in the last 10% of a squirrel's ticks; a squirrel stalls for at most
 *   the level's share of its ticks (40%, 45% or 50%);
 * - at most the level's number of Chaos events on screen at once (2, 3 or 5);
 * - event starts follow the intensity curve; Silly and Absolute Carnage add a pile-up on the
 *   plateau, and Absolute Carnage a finale burst between 75% and 88%;
 * - in Silly and Absolute Carnage every squirrel gets at least one Chaos moment of its own;
 * - per-squirrel chances (the suitor) halve above 30 entrants.
 *
 * Generator order (fixed; changing it changes how old Chaos replays look, never who won):
 *   1. Tornadoes (chaos-tornado.js), with their sharks and combos.
 *   2. Absolute Carnage: the finale anchor, then per slot and per attempt a type and its draws;
 *      then, only while fewer than the minimum counted, the top-up events in FINALE_TOP_UP order.
 *   3. Silly and Absolute Carnage: the pile-up anchor, then the same per slot.
 *   4. Hunters: the count, then each hunter's draws.
 *   5. Suitors: per entrant in input order a chance roll; for each success under the cap, the
 *      suitor's draws.
 *   6. The other events in CURVE_ORDER: a chance roll each (two for lightning in a 90 s race), and
 *      on success the event's draws (chaos-events.js).
 *   7. Silly and Absolute Carnage: per squirrel still without a moment of its own, a woodpecker,
 *      lightning or beaver, tried on the curve and then anywhere in its window.
 * The late events (Golden Acorn, trench coat, flood bursts) follow in chaos-late.js.
 *
 * Pure ES module: no DOM, no Lit and no platform imports.
 */
import {placeTornadoes} from './chaos-tornado.js';
import {placeEvent, placeSingle, stallSpec, suitorSpec} from './chaos-events.js';

// Field events come last, so they join in around the squirrels already busy.
const CURVE_ORDER = [
  'eagle',
  'beaver',
  'lightning',
  'woodpecker',
  'catLady',
  'ufo',
  'leafBlower',
  'earthquake',
  'flood',
  'disco',
  'acornHail',
  'var'
];

// The "every squirrel" pass tries these short personal gags, in this order.
const COVERAGE_ORDER = ['woodpecker', 'lightning', 'beaver'];

// Field events that need no free squirrel when relaxed, so the finale always reaches its
// minimum. Five types cover the worst case, a cluster that placed nothing.
const FINALE_TOP_UP = ['flood', 'earthquake', 'acornHail', 'disco', 'var'];

/**
 * @description A whole-percent share of the race as a tick, rounded up or down.
 * @param {Object} builder - The race builder.
 * @param {number} percent - Whole percent of durationMs.
 * @param {boolean} roundUp - True to round up.
 * @returns {number} The tick.
 * @since 2.0.0
 */
function tickAtPercent(builder, percent, roundUp) {
  const exact = (builder.durationMs * percent) / (100 * builder.settings.tickMs);
  return roundUp ? Math.ceil(exact) : Math.floor(exact);
}

/**
 * @description Places a cluster of events that all cover the tick after the anchor, so they are
 *   on screen together (contract § 1).
 * @param {Object} builder - The race builder.
 * @param {{size: number, anchorTick: number, startRange?: Object, finale?: boolean}} cluster -
 *   How many, where, and whether they belong to the finale burst.
 * @returns {string[]} The placed event ids.
 * @since 2.0.0
 */
function placeCluster(builder, cluster) {
  const {deck} = builder.settings;
  const types = Object.keys(deck.clusterWeights);
  const weights = types.map((type) => deck.clusterWeights[type]);
  const options = {
    anchorTick: cluster.anchorTick,
    startRange: cluster.startRange,
    finale: cluster.finale === true
  };
  const placed = [];
  for (let slot = 0; slot < cluster.size; slot += 1) {
    for (let attempt = 0; attempt < deck.finaleSlotAttempts; attempt += 1) {
      const result = placeEvent(builder, types[builder.rng.weightedIndex(weights)], options);
      if (result) {
        placed.push(result.id);
        break;
      }
    }
  }
  return placed;
}

/**
 * @description The Absolute Carnage finale burst: several events sharing one moment between 78%
 *   and 84% of the race, every one starting between 75% and 88%.
 * @param {Object} builder - The race builder.
 * @param {Object} finale - The level's finale settings.
 * @returns {void}
 * @since 2.0.0
 */
function placeFinaleBurst(builder, finale) {
  const low = tickAtPercent(builder, finale.anchorFromPercent, true);
  const high = Math.max(low, tickAtPercent(builder, finale.anchorToPercent, false));
  const anchorTick = builder.rng.intBetween(low, high);
  // A start tick s begins at (s - 1) x tickMs, hence the + 1 on both ends.
  const startRange = {
    fromTick: tickAtPercent(builder, finale.fromPercent, true) + 1,
    toTick: tickAtPercent(builder, finale.toPercent, false) + 1
  };
  const clustered = placeCluster(builder, {
    size: finale.size, anchorTick, startRange, finale: true
  });
  const eventIds = topUpFinale(builder, anchorTick, clustered, finale.minEvents);
  builder.setFinale({anchorMs: anchorTick * builder.settings.tickMs, eventIds});
}

/**
 * @description Guarantees the finale burst (contract § 1: Absolute Carnage has one in every race):
 *   while the cluster has fewer than the minimum, adds relaxed field events starting on the tick
 *   after the anchor. That moment comes after any tornado has landed and before the pile-up and
 *   the curve events are placed, so only finale events are on screen then: adding the fourth
 *   makes at most four, inside the cap of five. Relaxed events touch only squirrels with room,
 *   so the quiet zone and the stall cap hold.
 * @param {Object} builder - The race builder.
 * @param {number} anchorTick - The finale's anchor tick.
 * @param {string[]} placed - Ids the cluster placed.
 * @param {number} minEvents - Events needed to count as a finale.
 * @returns {string[]} Every finale event id.
 * @since 2.0.0
 */
function topUpFinale(builder, anchorTick, placed, minEvents) {
  const eventIds = placed.slice();
  const options = {
    startRange: {fromTick: anchorTick + 1, toTick: anchorTick + 1},
    finale: true,
    relaxed: true
  };
  FINALE_TOP_UP.forEach((type) => {
    if (eventIds.length < minEvents) {
      const result = placeEvent(builder, type, options);
      if (result) {
        eventIds.push(result.id);
      }
    }
  });
  return eventIds;
}

/**
 * @description The Silly and Absolute Carnage pile-up on the intensity plateau.
 * @param {Object} builder - The race builder.
 * @param {Object} peak - The level's peak-cluster settings.
 * @returns {void}
 * @since 2.0.0
 */
function placePeakCluster(builder, peak) {
  const low = tickAtPercent(builder, peak.anchorFromPercent, true);
  const high = Math.max(low, tickAtPercent(builder, peak.anchorToPercent, false));
  placeCluster(builder, {size: peak.size, anchorTick: builder.rng.intBetween(low, high)});
}

/**
 * @description Sends in the level's hunters.
 * @param {Object} builder - The race builder.
 * @returns {void}
 * @since 1.0.0
 */
function placeHunters(builder) {
  const hunterCount = builder.rng.weightedIndex(builder.level.deck.hunterCountWeights);
  for (let hunter = 0; hunter < hunterCount; hunter += 1) {
    placeEvent(builder, 'hunter');
  }
}

/**
 * @description Gives each squirrel the level's chance of a suitor, up to a third of the field.
 *   Every squirrel rolls once, in input order; the cap only stops further placements. The chance
 *   halves above 30 entrants.
 * @param {Object} builder - The race builder.
 * @returns {void}
 * @since 1.0.0
 */
function placeSuitors(builder) {
  const {rng, tracks} = builder;
  const {deck} = builder.settings;
  const crowded = tracks.length > deck.crowdedFieldAbove ? deck.crowdedChanceFactor : 1;
  const chance = builder.level.deck.suitorChance * crowded;
  const cap = Math.floor(tracks.length / deck.suitor.fieldDivisor);
  let placed = 0;
  tracks.forEach((track) => {
    const smitten = rng.chance(chance);
    if (smitten && placed < cap && placeSingle(builder, suitorSpec(builder, track))) {
      placed += 1;
    }
  });
}

/**
 * @description Rolls every other event at the level's chance and places the ones that come up.
 * @param {Object} builder - The race builder.
 * @returns {void}
 * @since 2.0.0
 */
function placeCurveEvents(builder) {
  const {chances} = builder.level.deck;
  const {lightning} = builder.settings.deck;
  CURVE_ORDER.forEach((type) => {
    const chance = chances[type] || 0;
    const strikeTwice = type === 'lightning' && builder.durationMs >= lightning.secondStrikeFromMs;
    const rolls = strikeTwice ? 2 : 1;
    for (let roll = 0; roll < rolls; roll += 1) {
      if (chance > 0 && builder.rng.chance(chance)) {
        placeEvent(builder, type);
      }
    }
  });
}

/**
 * @description Gives every squirrel without a Chaos moment of its own a short personal gag: on
 *   the intensity curve first, then anywhere in its event window.
 * @param {Object} builder - The race builder.
 * @returns {void}
 * @since 2.0.0
 */
function placeCoverage(builder) {
  const attempts = builder.settings.deck.coverageAttempts;
  builder.tracks.forEach((track) => {
    let covered = track.hasPersonalChaos();
    COVERAGE_ORDER.forEach((type) => {
      if (covered) {
        return;
      }
      const spec = stallSpec(builder, type, track);
      const layout = spec.layoutFor(track);
      const startRange = {fromTick: track.earliestEventTick, toTick: track.latestStart(layout)};
      covered = Boolean(placeSingle(builder, spec, {attempts})
        || placeSingle(builder, spec, {attempts, startRange}));
    });
  });
}

/**
 * @description Lays the level's whole Chaos deck onto a race whose Classic layer is placed, in
 *   the generator order documented at the top of this module.
 * @param {Object} builder - The race builder (see race-builder.js), with its level set.
 * @returns {void}
 * @example
 *   if (mode === 'chaos') placeChaosEvents(builder);
 * @since 1.0.0
 */
export function placeChaosEvents(builder) {
  const {level} = builder;
  placeTornadoes(builder);
  if (level.finale) {
    placeFinaleBurst(builder, level.finale);
  }
  if (level.peakCluster) {
    placePeakCluster(builder, level.peakCluster);
  }
  placeHunters(builder);
  placeSuitors(builder);
  placeCurveEvents(builder);
  if (level.everySquirrel) {
    placeCoverage(builder);
  }
}
