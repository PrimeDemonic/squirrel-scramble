/**
 * Chaos event builders (SPEC.md § 10, Chaos v2 contract § 4): every event except the tornado
 * (chaos-tornado.js) and the height-dependent late events (chaos-late.js). Each builder draws its
 * sizes first, then tries start ticks until the event fits: on free ticks, inside each squirrel's
 * event window, within the stall limit, and within the level's overlap cap.
 *
 * Field events (leaf blower, disco, VAR, earthquake, flood, acorn hail) list every entrant in
 * entrants (contract § 3). Their climb effect reaches only the squirrels free at that moment; a
 * squirrel already busy with its own event carries on with it, which is what lets events overlap.
 *
 * Start ticks come from one of three places, chosen by the options:
 * - an anchor tick: the event must cover the tick after it, so a cluster's events all share one
 *   moment (the Silly pile-up, the Absolute Carnage finale);
 * - a start range: a uniform draw (the "every squirrel" pass's fallback, the finale's top-up);
 * - otherwise the intensity curve.
 *
 * The relaxed option (the finale's top-up only) lets a field event play when nobody is free to
 * join it or be singled out; it still affects only squirrels with room, so the quiet zone and
 * the stall cap hold, and the overlap cap is checked as always.
 *
 * Pure ES module: no DOM, no Lit and no platform imports.
 */
import {effectKinds, layoutFrom} from './race-builder.js';

// Large enough to stand for "no upper limit" and still be a safe integer for intBetween.
const NO_LIMIT = Number.MAX_SAFE_INTEGER;

/**
 * @description Rounds a number for the informational data on an event.
 * @param {number} value - The number.
 * @param {number} decimals - Decimal places.
 * @returns {number} The rounded number.
 * @since 2.0.0
 */
export function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * @description Converts height units (hundredths of the tree) into climb units for one squirrel,
 *   against its expected total climb (tickCount x paceMean).
 * @param {Object} builder - The race builder.
 * @param {Object} track - The squirrel's track.
 * @param {number} units - Height units.
 * @returns {number} Climb units.
 * @since 1.0.0
 */
export function unitsToClimb(builder, track, units) {
  return (units / 100) * track.tickCount * builder.settings.paceMean;
}

/**
 * @description Picks a start tick for an event of a given length (see the module notes).
 * @param {Object} builder - The race builder.
 * @param {{anchorTick?: number, startRange?: {fromTick: number, toTick: number}}} options -
 *   Where the event may start.
 * @param {number} spanTicks - The event's length in ticks.
 * @returns {number|null} The tick, or null when no tick can satisfy the options.
 * @since 2.0.0
 */
export function chooseStart(builder, options, spanTicks) {
  const range = options.startRange || {fromTick: 1, toTick: NO_LIMIT};
  if (Number.isInteger(options.anchorTick)) {
    // Starting anywhere from here to the anchor's next tick covers that tick.
    const low = Math.max(options.anchorTick + 2 - spanTicks, range.fromTick);
    const high = Math.min(options.anchorTick + 1, range.toTick);
    return low <= high ? builder.rng.intBetween(low, high) : null;
  }
  if (options.startRange) {
    const fits = range.fromTick <= range.toTick;
    return fits ? builder.rng.intBetween(range.fromTick, range.toTick) : null;
  }
  return builder.sampleStartTick();
}

/**
 * @description The event's data, marked when it belongs to the finale burst.
 * @param {Object} data - The event-specific data.
 * @param {{finale?: boolean}} options - Placement options.
 * @returns {Object} A new data object.
 * @since 2.0.0
 */
function dataWithFinale(data, options) {
  return options.finale ? {...data, finale: true} : {...data};
}

/**
 * @description Says whether enough of the field is free to join a field-wide stall.
 * @param {number} joining - Squirrels free to join.
 * @param {number} fieldSize - Squirrels in the race.
 * @param {number} minPercent - The share needed, whole percent.
 * @returns {boolean} True when enough can join.
 * @since 2.0.0
 */
function enoughOfField(joining, fieldSize, minPercent) {
  return joining >= 1 && joining * 100 >= fieldSize * minPercent;
}

/**
 * @description Every entrant index, for a field event's entrants list.
 * @param {Object} builder - The race builder.
 * @returns {number[]} 0 to n - 1.
 * @since 2.0.0
 */
function everyone(builder) {
  return builder.tracks.map((track) => track.index);
}

/**
 * @description Places a single-squirrel Chaos event, trying random targets (or one fixed target)
 *   and start ticks until it fits or the attempts run out.
 * @param {Object} builder - The race builder.
 * @param {{type: string, outcome: (string|null), data: Object,
 *   layoutFor: function(Object): Object, fixedTrack?: Object, extra?: Object}} spec - What to
 *   place.
 * @param {{anchorTick?: number, startRange?: Object, finale?: boolean,
 *   attempts?: number}} [options] - Placement options.
 * @returns {{id: string, sequence: number, startTick: number}|null} The placed event, or null.
 * @example
 *   placeSingle(builder, stallSpec(builder, 'woodpecker', null), {});
 * @since 1.0.0
 */
export function placeSingle(builder, spec, options = {}) {
  const attempts = options.attempts || builder.settings.deck.placementAttempts;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const track = spec.fixedTrack || builder.rng.pick(builder.tracks);
    const layout = spec.layoutFor(track);
    const startTick = chooseStart(builder, options, layout.spanTicks);
    if (startTick !== null && track.canPlace(startTick, layout)) {
      const startMs = builder.tickStartMs(startTick);
      const endMs = builder.tickEndMs(startTick + layout.spanTicks - 1);
      if (builder.overlapAllows(startMs, endMs)) {
        const {id, sequence} = builder.registerEvent({
          type: spec.type,
          category: 'chaos',
          scope: 'entrants',
          outcome: spec.outcome,
          startMs,
          endMs,
          entrants: [track.index],
          data: dataWithFinale(spec.data, options)
        });
        track.commit(startTick, layout, {
          eventId: id, sequence, category: 'chaos', personal: true, extra: spec.extra
        });
        return {id, sequence, startTick};
      }
    }
  }
  return null;
}

/**
 * @description A stall-only visitor: the beaver, a lightning strike or the woodpecker.
 * @param {Object} builder - The race builder.
 * @param {string} type - 'beaver', 'lightning' or 'woodpecker'.
 * @param {Object|null} fixedTrack - A squirrel to target, or null for a random one.
 * @returns {Object} A spec for placeSingle.
 * @since 2.0.0
 */
export function stallSpec(builder, type, fixedTrack) {
  const ticks = builder.settings.deck[type].stallTicks;
  const layout = layoutFrom([{kind: effectKinds.stall, ticks}]);
  return {type, outcome: null, data: {}, layoutFor: () => layout, fixedTrack};
}

/**
 * @description A hunter's visit: a hit (a fall of part of the running total, then a stun) or a
 *   miss (no climb effect, ticks kept clear for the backfire). Draws the hit roll, then (hits
 *   only) the fall and stun sizes.
 * @param {Object} builder - The race builder.
 * @returns {Object} A spec for placeSingle.
 * @since 1.0.0
 */
export function hunterSpec(builder) {
  const {rng} = builder;
  const rules = builder.settings.deck.hunter;
  if (!rng.chance(rules.hitChance)) {
    const missLayout = layoutFrom([{kind: effectKinds.idle, ticks: rules.missTicks}]);
    return {type: 'hunter', outcome: 'miss', data: {}, layoutFor: () => missLayout};
  }
  const fallFraction = rng.floatBetween(rules.minFallFraction, rules.maxFallFraction);
  const stunTicks = rng.intBetween(rules.minStunTicks, rules.maxStunTicks);
  const hitLayout = layoutFrom([
    {kind: effectKinds.fallFraction, ticks: 1, value: fallFraction},
    {kind: effectKinds.stall, ticks: stunTicks}
  ]);
  return {
    type: 'hunter',
    outcome: 'hit',
    data: {fallPercent: roundTo(fallFraction * 100, 1), stunTicks},
    layoutFor: () => hitLayout
  };
}

/**
 * @description A suitor's visit: a kiss (a 3 to 6 tick stall and a lipstick mark) or a slap (a
 *   2 tick stall). Draws the slap roll, then (kisses only) the kiss length.
 * @param {Object} builder - The race builder.
 * @param {Object|null} fixedTrack - A squirrel to target, or null for a random one.
 * @returns {Object} A spec for placeSingle.
 * @since 2.0.0
 */
export function suitorSpec(builder, fixedTrack) {
  const {rng} = builder;
  const rules = builder.settings.deck.suitor;
  const slapped = rng.chance(rules.slapChance);
  const ticks = slapped ? rules.slapTicks : rng.intBetween(rules.minKissTicks, rules.maxKissTicks);
  const layout = layoutFrom([{kind: effectKinds.stall, ticks}]);
  return {
    type: 'suitor',
    outcome: slapped ? 'slap' : 'kiss',
    data: {lipstick: !slapped},
    layoutFor: () => layout,
    fixedTrack
  };
}

/**
 * @description The eagle's lift of 10 to 20 height units, carried over a few ticks and sized for
 *   whichever squirrel it picks.
 * @param {Object} builder - The race builder.
 * @param {number} liftUnits - The lift, in height units.
 * @param {Object} track - The squirrel.
 * @returns {Object} The layout.
 * @since 2.0.0
 */
export function eagleLayout(builder, liftUnits, track) {
  const rules = builder.settings.deck.eagle;
  return layoutFrom([{
    kind: effectKinds.set,
    ticks: rules.carryTicks,
    value: unitsToClimb(builder, track, liftUnits) / rules.carryTicks
  }]);
}

/**
 * @description The eagle's visit. Draws the lift size.
 * @param {Object} builder - The race builder.
 * @returns {Object} A spec for placeSingle.
 * @since 2.0.0
 */
function eagleSpec(builder) {
  const rules = builder.settings.deck.eagle;
  const liftUnits = builder.rng.floatBetween(rules.minLiftUnits, rules.maxLiftUnits);
  return {
    type: 'eagle',
    outcome: null,
    data: {liftUnits: roundTo(liftUnits, 2)},
    layoutFor: (track) => eagleLayout(builder, liftUnits, track)
  };
}

/**
 * @description Plans the cat lady's throws from one start tick: each throw goes to a different
 *   free squirrel, two ticks after the last.
 * @param {Object} builder - The race builder.
 * @param {number} firstTick - The first throw's tick.
 * @param {number[]} clings - Cling length of each throw.
 * @returns {Array<{tick: number, track: Object, clingTicks: number, layout: Object}>} The throws.
 * @since 2.0.0
 */
function planThrows(builder, firstTick, clings) {
  const rules = builder.settings.deck.catLady;
  const throws = [];
  const used = new Set();
  for (let throwIndex = 0; throwIndex < clings.length; throwIndex += 1) {
    const tick = firstTick + throwIndex * rules.throwGapTicks;
    const layout = layoutFrom([
      {kind: effectKinds.scale, ticks: clings[throwIndex], value: rules.clingPace}
    ]);
    const candidates = builder.tracks.filter((track) => (
      !used.has(track.index) && track.canPlace(tick, layout)
    ));
    if (candidates.length === 0) {
      break;
    }
    const target = builder.rng.pick(candidates);
    used.add(target.index);
    throws.push({tick, track: target, clingTicks: clings[throwIndex], layout});
  }
  return throws;
}

/**
 * @description The eagle that catches the cat lady's last cat instead of its squirrel (the
 *   catVsEagle combo): no climb effect, and that throw is marked intercepted.
 * @param {Object} builder - The race builder.
 * @param {string} catLadyId - The cat lady's event id.
 * @param {{tick: number, track: Object}} caught - The intercepted throw.
 * @returns {boolean} True when the eagle fitted under the overlap cap.
 * @since 2.0.0
 */
function catchCat(builder, catLadyId, caught) {
  const startMs = builder.tickStartMs(caught.tick);
  const endMs = builder.tickEndMs(caught.tick + builder.settings.deck.eagle.carryTicks - 1);
  if (!builder.overlapAllows(startMs, endMs)) {
    return false;
  }
  builder.registerEvent({
    type: 'eagle',
    category: 'chaos',
    scope: 'entrants',
    outcome: null,
    startMs,
    endMs,
    entrants: [caught.track.index],
    data: {caught: 'cat', combo: {kind: 'catVsEagle', with: catLadyId}}
  });
  return true;
}

/**
 * @description The crazy cat lady (contract § 4): she walks along the ground hurling cats at 2 to
 *   4 squirrels; each hit squirrel climbs at 40% pace for 2 to 4 ticks. With the catVsEagle combo
 *   an eagle catches the last cat instead. Draws: throw count, each cling length, her side, the
 *   combo roll (not inside a cluster), then per attempt a start tick and one target per throw.
 * @param {Object} builder - The race builder.
 * @param {Object} options - Placement options.
 * @returns {{id: string}|null} The placed event, or null.
 * @since 2.0.0
 */
function placeCatLady(builder, options) {
  const {rng, tracks} = builder;
  const rules = builder.settings.deck.catLady;
  const throwCount = Math.min(rng.intBetween(rules.minThrows, rules.maxThrows), tracks.length);
  const clings = Array.from({length: throwCount}, () => (
    rng.intBetween(rules.minClingTicks, rules.maxClingTicks)
  ));
  const side = rng.chance(0.5) ? 'left' : 'right';
  // No combo inside a cluster: the eagle would take an overlap slot without being a cluster event.
  const clustered = Number.isInteger(options.anchorTick);
  const wantsEagle = !clustered && rng.chance(builder.level.deck.combos.catVsEagle);
  const spanTicks = Math.max(...clings.map((cling, index) => index * rules.throwGapTicks + cling));
  for (let attempt = 0; attempt < builder.settings.deck.placementAttempts; attempt += 1) {
    const firstTick = chooseStart(builder, options, spanTicks);
    const throws = firstTick === null ? [] : planThrows(builder, firstTick, clings);
    if (throws.length >= Math.min(2, tracks.length)) {
      const startMs = builder.tickStartMs(firstTick);
      const endMs = Math.max(...throws.map((item) => (
        builder.tickEndMs(item.tick + item.clingTicks - 1)
      )));
      if (builder.overlapAllows(startMs, endMs)) {
        return commitCatLady(builder, {throws, side, wantsEagle, startMs, endMs, options});
      }
    }
  }
  return null;
}

/**
 * @description Registers the cat lady and her throws, and the eagle when the combo fits.
 * @param {Object} builder - The race builder.
 * @param {{throws: Array<Object>, side: string, wantsEagle: boolean, startMs: number,
 *   endMs: number, options: Object}} plan - The planned visit.
 * @returns {{id: string}} The cat lady's event.
 * @since 2.0.0
 */
function commitCatLady(builder, plan) {
  const interceptIndex = plan.wantsEagle && plan.throws.length >= 2 ? plan.throws.length - 1 : -1;
  const throwData = plan.throws.map((item, index) => ({
    atMs: builder.tickStartMs(item.tick),
    entrant: item.track.index,
    clingTicks: item.clingTicks,
    intercepted: index === interceptIndex
  }));
  const {id, sequence} = builder.registerEvent({
    type: 'catLady',
    category: 'chaos',
    scope: 'entrants',
    outcome: null,
    startMs: plan.startMs,
    endMs: plan.endMs,
    entrants: plan.throws.map((item) => item.track.index),
    data: dataWithFinale({side: plan.side, throws: throwData}, plan.options)
  });
  const landCat = (item) => item.track.commit(item.tick, item.layout, {
    eventId: id, sequence, category: 'chaos', personal: true, extra: {clingTicks: item.clingTicks}
  });
  plan.throws.forEach((item, index) => {
    if (index !== interceptIndex) {
      landCat(item);
    }
  });
  if (interceptIndex >= 0 && !catchCat(builder, id, plan.throws[interceptIndex])) {
    // No room for the eagle under the overlap cap: the last cat lands after all.
    builder.patchEventData(id, {throws: throwData.map((item) => ({...item, intercepted: false}))});
    landCat(plan.throws[interceptIndex]);
  }
  return {id, sequence};
}

/**
 * @description The UFO (contract § 4): beams two squirrels up, swaps their outfits and drops each
 *   on the other's tree, dazed 2 ticks.
 * @param {Object} builder - The race builder.
 * @param {Object} options - Placement options.
 * @returns {{id: string}|null} The placed event, or null.
 * @since 2.0.0
 */
function placeUfo(builder, options) {
  const rules = builder.settings.deck.ufo;
  const {tickMs} = builder.settings;
  if (builder.tracks.length < 2) {
    return null;
  }
  const layout = layoutFrom([
    {kind: effectKinds.stall, ticks: rules.beamTicks},
    {kind: effectKinds.stall, ticks: rules.dazedTicks}
  ]);
  for (let attempt = 0; attempt < builder.settings.deck.placementAttempts; attempt += 1) {
    const startTick = chooseStart(builder, options, layout.spanTicks);
    if (startTick !== null) {
      const free = builder.tracks.filter((track) => track.canPlace(startTick, layout));
      const startMs = builder.tickStartMs(startTick);
      const endMs = builder.tickEndMs(startTick + layout.spanTicks - 1);
      if (free.length >= 2 && builder.overlapAllows(startMs, endMs)) {
        const pair = builder.rng.shuffle(free).slice(0, 2);
        return commitUfo(builder, {pair, startTick, startMs, endMs, layout, options, tickMs});
      }
    }
  }
  return null;
}

/**
 * @description Registers the UFO, stalls both squirrels, and records the tree swap (resolved in
 *   time order later) and the outfit swap halfway through the beam.
 * @param {Object} builder - The race builder.
 * @param {{pair: Object[], startTick: number, startMs: number, endMs: number, layout: Object,
 *   options: Object, tickMs: number}} plan - The planned abduction.
 * @returns {{id: string, sequence: number}} The event.
 * @since 2.0.0
 */
function commitUfo(builder, plan) {
  const rules = builder.settings.deck.ufo;
  const members = plan.pair.map((track) => track.index);
  const beamEndMs = plan.startMs + rules.beamTicks * plan.tickMs;
  const swapAtMs = plan.startMs + Math.round((rules.beamTicks * plan.tickMs) / 2);
  const {id, sequence} = builder.registerEvent({
    type: 'ufo',
    category: 'chaos',
    scope: 'entrants',
    outcome: null,
    startMs: plan.startMs,
    endMs: plan.endMs,
    entrants: members,
    data: dataWithFinale({swapOutfits: true, beamEndMs, swapAtMs, swaps: []}, plan.options)
  });
  plan.pair.forEach((track) => track.commit(plan.startTick, plan.layout, {
    eventId: id, sequence, category: 'chaos', personal: true
  }));
  builder.addLaneOp({
    eventId: id,
    sequence,
    startMs: plan.startMs,
    flightEndMs: beamEndMs,
    landingTick: plan.startTick + rules.beamTicks,
    members,
    permutation: [1, 0]
  });
  builder.addOutfitOp({
    eventId: id, sequence, atMs: swapAtMs, kind: 'swap', entrants: members, note: 'none'
  });
  return {id, sequence};
}

/**
 * @description Tries start ticks for a field-wide stall (leaf blower, disco, VAR) until enough of
 *   the field is free and the overlap cap allows it.
 * @param {Object} builder - The race builder.
 * @param {Object} layout - The stall each joining squirrel gets.
 * @param {number} minPercent - The share of the field that must be free, whole percent.
 * @param {Object} options - Placement options.
 * @returns {{startTick: number, startMs: number, endMs: number, joining: Object[]}|null} Where
 *   it fits and who joins, or null.
 * @since 2.0.0
 */
function findFieldSlot(builder, layout, minPercent, options) {
  for (let attempt = 0; attempt < builder.settings.deck.placementAttempts; attempt += 1) {
    const startTick = chooseStart(builder, options, layout.spanTicks);
    if (startTick !== null) {
      const joining = builder.tracks.filter((track) => track.canPlace(startTick, layout));
      const startMs = builder.tickStartMs(startTick);
      const endMs = builder.tickEndMs(startTick + layout.spanTicks - 1);
      // Relaxed (the finale's top-up): it plays even when nobody is free to join in.
      const enough = options.relaxed === true
        || enoughOfField(joining.length, builder.tracks.length, minPercent);
      if (enough && builder.overlapAllows(startMs, endMs)) {
        return {startTick, startMs, endMs, joining};
      }
    }
  }
  return null;
}

/**
 * @description Registers a field event and commits its stall on every joining squirrel.
 * @param {Object} builder - The race builder.
 * @param {{type: string, slot: Object, layout: Object, data: Object, options: Object,
 *   personal?: number[]}} field - The event; personal lists squirrels it singles out.
 * @returns {{id: string, sequence: number}} The event.
 * @since 2.0.0
 */
function commitFieldStall(builder, field) {
  const singled = field.personal || [];
  const {id, sequence} = builder.registerEvent({
    type: field.type,
    category: 'chaos',
    scope: 'field',
    outcome: null,
    startMs: field.slot.startMs,
    endMs: field.slot.endMs,
    entrants: everyone(builder),
    data: dataWithFinale(field.data, field.options)
  });
  field.slot.joining.forEach((track) => track.commit(field.slot.startTick, field.layout, {
    eventId: id, sequence, category: 'chaos', personal: singled.includes(track.index)
  }));
  return {id, sequence};
}

/**
 * @description The leaf blower (contract § 4): every free squirrel clings sideways for 2 to 3
 *   stalled ticks; 1 or 2 of them lose their hats. Draws: cling length, hat-loss count, direction,
 *   then per attempt a start tick, then who loses a hat.
 * @param {Object} builder - The race builder.
 * @param {Object} options - Placement options.
 * @returns {{id: string}|null} The placed event, or null.
 * @since 2.0.0
 */
function placeLeafBlower(builder, options) {
  const {rng} = builder;
  const rules = builder.settings.deck.leafBlower;
  const clingTicks = rng.intBetween(rules.minClingTicks, rules.maxClingTicks);
  const hatLossCount = rng.intBetween(rules.minHatLoss, rules.maxHatLoss);
  const direction = rng.chance(0.5) ? 'ltr' : 'rtl';
  const layout = layoutFrom([{kind: effectKinds.stall, ticks: clingTicks}]);
  const slot = findFieldSlot(builder, layout, rules.minFieldPercent, options);
  if (!slot) {
    return null;
  }
  const hatted = slot.joining.filter((track) => builder.storedOutfit(track.index).hat !== 'none');
  const losers = rng.shuffle(hatted).slice(0, hatLossCount).map((track) => track.index);
  const event = commitFieldStall(builder, {
    type: 'leafBlower',
    slot,
    layout,
    data: {direction, clingTicks, hatLoss: losers, lostHats: []},
    options,
    personal: losers
  });
  if (losers.length > 0) {
    builder.addOutfitOp({
      eventId: event.id,
      sequence: event.sequence,
      atMs: slot.startMs + builder.settings.tickMs,
      kind: 'hatOff',
      entrants: losers,
      note: 'hatLoss'
    });
  }
  return event;
}

/**
 * @description The disco (contract § 4): every free squirrel stalls 2 s to dance.
 * @param {Object} builder - The race builder.
 * @param {Object} options - Placement options.
 * @returns {{id: string}|null} The placed event, or null.
 * @since 2.0.0
 */
function placeDisco(builder, options) {
  const rules = builder.settings.deck.disco;
  const layout = layoutFrom([{kind: effectKinds.stall, ticks: rules.durationTicks}]);
  const slot = findFieldSlot(builder, layout, rules.minFieldPercent, options);
  if (!slot) {
    return null;
  }
  return commitFieldStall(builder, {
    type: 'disco', slot, layout, data: {durationTicks: rules.durationTicks}, options
  });
}

/**
 * @description VAR (contract § 4): everyone freezes for 1.5 s while the owl checks for a nut
 *   infringement. Draws the verdict (a phrase key) first.
 * @param {Object} builder - The race builder.
 * @param {Object} options - Placement options.
 * @returns {{id: string}|null} The placed event, or null.
 * @since 2.0.0
 */
function placeVar(builder, options) {
  const rules = builder.settings.deck.var;
  const verdicts = builder.settings.varVerdicts;
  const verdict = verdicts.length > 0 ? builder.rng.pick(verdicts) : null;
  const layout = layoutFrom([{kind: effectKinds.stall, ticks: rules.stallTicks}]);
  const slot = findFieldSlot(builder, layout, rules.minFieldPercent, options);
  if (!slot) {
    return null;
  }
  return commitFieldStall(builder, {type: 'var', slot, layout, data: {verdict}, options});
}

/**
 * @description Tries start ticks for a field event that singles some squirrels out (earthquake,
 *   acorn hail): the visual window must fit the overlap cap and at least one squirrel must be
 *   free for the personal effect.
 * @param {Object} builder - The race builder.
 * @param {number} windowTicks - The event's visual length.
 * @param {Object} probe - The personal effect's layout.
 * @param {Object} options - Placement options.
 * @returns {{startTick: number, startMs: number, endMs: number, candidates: Object[]}|null} The
 *   slot, or null.
 * @since 2.0.0
 */
function findSinglingSlot(builder, windowTicks, probe, options) {
  for (let attempt = 0; attempt < builder.settings.deck.placementAttempts; attempt += 1) {
    const startTick = chooseStart(builder, options, windowTicks);
    if (startTick !== null) {
      const startMs = builder.tickStartMs(startTick);
      const endMs = builder.tickEndMs(startTick + windowTicks - 1);
      const candidates = builder.tracks.filter((track) => track.canPlace(startTick, probe));
      // Relaxed (the finale's top-up): it plays even when it can single nobody out.
      const someone = candidates.length > 0 || options.relaxed === true;
      if (someone && builder.overlapAllows(startMs, endMs)) {
        return {startTick, startMs, endMs, candidates};
      }
    }
  }
  return null;
}

/**
 * @description The earthquake (contract § 4): the whole wood shakes; 2 to 4 free squirrels slip
 *   down 5 to 15 height units. Draws: slip count, then per attempt a start tick, then who slips
 *   and how far.
 * @param {Object} builder - The race builder.
 * @param {Object} options - Placement options.
 * @returns {{id: string}|null} The placed event, or null.
 * @since 2.0.0
 */
function placeEarthquake(builder, options) {
  const {rng} = builder;
  const rules = builder.settings.deck.earthquake;
  const slipCount = rng.intBetween(rules.minSlips, rules.maxSlips);
  const slipLayout = (climb) => layoutFrom([
    {kind: effectKinds.set, ticks: 1, value: climb},
    {kind: effectKinds.idle, ticks: 1}
  ]);
  const slot = findSinglingSlot(builder, rules.shakeTicks, slipLayout(0), options);
  if (!slot) {
    return null;
  }
  const slipping = rng.shuffle(slot.candidates).slice(0, slipCount);
  const units = slipping.map(() => rng.floatBetween(rules.minSlipUnits, rules.maxSlipUnits));
  const {id, sequence} = builder.registerEvent({
    type: 'earthquake',
    category: 'chaos',
    scope: 'field',
    outcome: null,
    startMs: slot.startMs,
    endMs: slot.endMs,
    entrants: everyone(builder),
    data: dataWithFinale({
      slips: slipping.map((track) => track.index),
      slipUnits: units.map((value) => roundTo(value, 2)),
      shakeTicks: rules.shakeTicks
    }, options)
  });
  slipping.forEach((track, order) => {
    const extra = {slipUnits: roundTo(units[order], 2)};
    track.commit(slot.startTick, slipLayout(-unitsToClimb(builder, track, units[order])), {
      eventId: id, sequence, category: 'chaos', personal: true, extra
    });
  });
  return {id, sequence};
}

/**
 * @description Acorn hail (contract § 4): nuts pelt down; 2 to 4 free squirrels stuff their
 *   cheeks and climb at 60% for 3 to 5 ticks. Draws: chubby count, slow length, then per attempt
 *   a start tick, then who gets chubby.
 * @param {Object} builder - The race builder.
 * @param {Object} options - Placement options.
 * @returns {{id: string}|null} The placed event, or null.
 * @since 2.0.0
 */
function placeAcornHail(builder, options) {
  const {rng} = builder;
  const rules = builder.settings.deck.acornHail;
  const chubbyCount = rng.intBetween(rules.minChubby, rules.maxChubby);
  const slowTicks = rng.intBetween(rules.minSlowTicks, rules.maxSlowTicks);
  const layout = layoutFrom([{kind: effectKinds.scale, ticks: slowTicks, value: rules.slowPace}]);
  const slot = findSinglingSlot(builder, rules.hailTicks, layout, options);
  if (!slot) {
    return null;
  }
  const chubby = rng.shuffle(slot.candidates).slice(0, chubbyCount);
  const {id, sequence} = builder.registerEvent({
    type: 'acornHail',
    category: 'chaos',
    scope: 'field',
    outcome: null,
    startMs: slot.startMs,
    endMs: slot.endMs,
    entrants: everyone(builder),
    data: dataWithFinale({chubby: chubby.map((track) => track.index), slowTicks}, options)
  });
  chubby.forEach((track) => track.commit(slot.startTick, layout, {
    eventId: id, sequence, category: 'chaos', personal: true
  }));
  return {id, sequence};
}

/**
 * @description The flood (contract § 4): the water rises over the field. Which squirrels are below
 *   the waterline, and so get a burst upwards, depends on heights, so the late pass decides it
 *   (chaos-late.js); here the flood only claims its moment. Draws the water level, then per
 *   attempt a start tick.
 * @param {Object} builder - The race builder.
 * @param {Object} options - Placement options.
 * @returns {{id: string}|null} The placed event, or null.
 * @since 2.0.0
 */
function placeFlood(builder, options) {
  const rules = builder.settings.deck.flood;
  const waterUnits = builder.rng.intBetween(rules.minWaterUnits, rules.maxWaterUnits);
  for (let attempt = 0; attempt < builder.settings.deck.placementAttempts; attempt += 1) {
    const startTick = chooseStart(builder, options, rules.durationTicks);
    if (startTick !== null) {
      const startMs = builder.tickStartMs(startTick);
      const endMs = builder.tickEndMs(startTick + rules.durationTicks - 1);
      if (builder.overlapAllows(startMs, endMs)) {
        const {id, sequence} = builder.registerEvent({
          type: 'flood',
          category: 'chaos',
          scope: 'field',
          outcome: null,
          startMs,
          endMs,
          entrants: everyone(builder),
          // burstAtMs: the moment the waterline is checked; bursts start then.
          data: dataWithFinale({
            waterHeightUnits: waterUnits,
            bursters: [],
            burstAtMs: builder.tickStartMs(startTick + rules.burstDelayTicks)
          }, options)
        });
        builder.addPendingFlood({
          eventId: id,
          sequence,
          burstStartTick: startTick + rules.burstDelayTicks,
          waterUnits
        });
        return {id, sequence};
      }
    }
  }
  return null;
}

// One placer per event type the deck, clusters and finale can ask for by name.
const placers = {
  hunter: (builder, options) => placeSingle(builder, hunterSpec(builder), options),
  suitor: (builder, options) => placeSingle(builder, suitorSpec(builder, null), options),
  eagle: (builder, options) => placeSingle(builder, eagleSpec(builder), options),
  beaver: (builder, options) => placeSingle(builder, stallSpec(builder, 'beaver', null), options),
  lightning: (builder, options) => (
    placeSingle(builder, stallSpec(builder, 'lightning', null), options)
  ),
  woodpecker: (builder, options) => (
    placeSingle(builder, stallSpec(builder, 'woodpecker', null), options)
  ),
  catLady: placeCatLady,
  ufo: placeUfo,
  leafBlower: placeLeafBlower,
  earthquake: placeEarthquake,
  flood: placeFlood,
  disco: placeDisco,
  acornHail: placeAcornHail,
  var: placeVar
};

/**
 * @description Places one event of a named type (see the module notes for the options).
 * @param {Object} builder - The race builder.
 * @param {string} type - An event type from the contract's catalogue (not the tornado or the late
 *   events).
 * @param {{anchorTick?: number, startRange?: Object, finale?: boolean}} [options] - Placement.
 * @returns {{id: string}|null} The placed event, or null.
 * @throws {RangeError} If the type has no placer.
 * @example
 *   placeEvent(builder, 'disco');
 * @since 2.0.0
 */
export function placeEvent(builder, type, options = {}) {
  if (!Object.prototype.hasOwnProperty.call(placers, type)) {
    throw new RangeError(`No placer for event type ${type}.`);
  }
  return placers[type](builder, options);
}
