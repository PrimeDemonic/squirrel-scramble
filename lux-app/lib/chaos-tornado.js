/**
 * The tornado (SPEC.md § 10, Chaos v2 contract § 4), its sharknado variant and the three combos
 * that hang off it: eagleIntoFunnel (an eagle drops its squirrel into the funnel), suitorSwept (a
 * suitor and her date are swept up together) and hunterVsTornado (a hunter fires at the funnel
 * and gets the cow back; no squirrel effect).
 *
 * A tornado starts between 25% and 70% of the race, lifts 2 to 4 free squirrels and deranges
 * their trees: nobody lands on its own tree and no tree ends up with two racers. The trees are
 * recorded as a permutation of the lifted squirrels and resolved in time order once every event
 * is placed (race-builder.js), so a UFO earlier in the race cannot leave a tornado's lanes stale.
 *
 * Generator order per tornado: per attempt an arrival tick; once enough squirrels are free, the
 * lifted count, a shuffle of the free squirrels, a Sattolo derangement, the shark roll and (sharks
 * only, when anyone wears a hat) the hat to chomp, one drop size per lifted squirrel, then the
 * three combo rolls in the order eagle, suitor, hunter, each followed by its own draws.
 *
 * Pure ES module: no DOM, no Lit and no platform imports.
 */
import {effectKinds, layoutFrom} from './race-builder.js';
import {eagleLayout, roundTo, unitsToClimb} from './chaos-events.js';

/**
 * @description The tornado layout for one lifted squirrel: flight stalls, a landing drop, then
 *   dizzy stalls.
 * @param {Object} builder - The race builder.
 * @param {number} dropClimb - The landing climb (negative), in climb units.
 * @returns {Object} The layout.
 * @since 1.0.0
 */
function tornadoLayout(builder, dropClimb) {
  const rules = builder.settings.deck.tornado;
  return layoutFrom([
    {kind: effectKinds.stall, ticks: Math.ceil(rules.flightMs / builder.settings.tickMs)},
    {kind: effectKinds.set, ticks: 1, value: dropClimb},
    {kind: effectKinds.stall, ticks: rules.dizzyTicks}
  ]);
}

/**
 * @description Sattolo's algorithm over slot numbers: one single cycle, so no slot keeps its own
 *   value. Member m lands on the tree member result[m] left, which is never its own.
 * @param {Object} rng - The race generator.
 * @param {number} count - Lifted squirrels (at least two).
 * @returns {number[]} A derangement of 0 to count - 1.
 * @since 1.0.0
 */
function derangement(rng, count) {
  const result = Array.from({length: count}, (_value, slot) => slot);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapWith = rng.intBetween(0, index - 1);
    const held = result[index];
    result[index] = result[swapWith];
    result[swapWith] = held;
  }
  return result;
}

/**
 * @description The eagleIntoFunnel combo: one lifted squirrel is carried up by an eagle in the
 *   ticks just before the funnel arrives and dropped straight into it.
 * @param {Object} builder - The race builder.
 * @param {{id: string, startTick: number, startMs: number, lifted: Object[]}} tornado - The
 *   placed tornado.
 * @returns {number|null} The carried squirrel, or null when nobody had room.
 * @since 2.0.0
 */
function eagleIntoFunnel(builder, tornado) {
  const rules = builder.settings.deck.eagle;
  const liftUnits = builder.rng.floatBetween(rules.minLiftUnits, rules.maxLiftUnits);
  const startTick = tornado.startTick - rules.carryTicks;
  const candidates = tornado.lifted.filter((track) => (
    track.canPlace(startTick, eagleLayout(builder, liftUnits, track))
  ));
  const startMs = builder.tickStartMs(startTick);
  if (candidates.length === 0 || !builder.overlapAllows(startMs, tornado.startMs)) {
    return null;
  }
  const track = builder.rng.pick(candidates);
  const {id, sequence} = builder.registerEvent({
    type: 'eagle',
    category: 'chaos',
    scope: 'entrants',
    outcome: null,
    startMs,
    endMs: tornado.startMs,
    entrants: [track.index],
    data: {liftUnits: roundTo(liftUnits, 2), combo: {kind: 'eagleIntoFunnel', with: tornado.id}}
  });
  track.commit(startTick, eagleLayout(builder, liftUnits, track), {
    eventId: id, sequence, category: 'chaos', personal: true
  });
  return track.index;
}

/**
 * @description The suitorSwept combo: a lifted squirrel is mid-kiss when the funnel arrives, and
 *   she and her date are swept up together (she lands beside him on his new tree).
 * @param {Object} builder - The race builder.
 * @param {{id: string, startTick: number, startMs: number, lifted: Object[]}} tornado - The
 *   placed tornado.
 * @param {number|null} carried - A squirrel already taken by the eagle combo.
 * @returns {void}
 * @since 2.0.0
 */
function suitorSwept(builder, tornado, carried) {
  const rules = builder.settings.deck.suitor;
  const kissTicks = builder.rng.intBetween(rules.minKissTicks, rules.maxKissTicks);
  const startTick = tornado.startTick - kissTicks;
  const layout = layoutFrom([{kind: effectKinds.stall, ticks: kissTicks}]);
  const candidates = tornado.lifted.filter((track) => (
    track.index !== carried && track.canPlace(startTick, layout)
  ));
  const startMs = builder.tickStartMs(startTick);
  if (candidates.length === 0 || !builder.overlapAllows(startMs, tornado.startMs)) {
    return;
  }
  const track = builder.rng.pick(candidates);
  const {id, sequence} = builder.registerEvent({
    type: 'suitor',
    category: 'chaos',
    scope: 'entrants',
    outcome: 'kiss',
    startMs,
    endMs: tornado.startMs,
    entrants: [track.index],
    data: {lipstick: true, combo: {kind: 'suitorSwept', with: tornado.id}}
  });
  track.commit(startTick, layout, {eventId: id, sequence, category: 'chaos', personal: true});
}

/**
 * @description The hunterVsTornado combo: a hunter fires at the funnel during its flight and it
 *   spits the cow back at him. No squirrel is touched, so entrants is empty.
 * @param {Object} builder - The race builder.
 * @param {{id: string, startTick: number, flightTicks: number}} tornado - The placed tornado.
 * @returns {void}
 * @since 2.0.0
 */
function hunterVsTornado(builder, tornado) {
  const {missTicks} = builder.settings.deck.hunter;
  const latest = tornado.startTick + tornado.flightTicks - missTicks;
  if (latest < tornado.startTick) {
    return;
  }
  const shotTick = builder.rng.intBetween(tornado.startTick, latest);
  const startMs = builder.tickStartMs(shotTick);
  const endMs = builder.tickEndMs(shotTick + missTicks - 1);
  if (!builder.overlapAllows(startMs, endMs)) {
    return;
  }
  builder.registerEvent({
    type: 'hunter',
    category: 'chaos',
    scope: 'entrants',
    outcome: 'miss',
    startMs,
    endMs,
    entrants: [],
    data: {combo: {kind: 'hunterVsTornado', with: tornado.id}}
  });
}

/**
 * @description Rolls the three tornado combos at the level's chances, always in the same order.
 * @param {Object} builder - The race builder.
 * @param {Object} tornado - The placed tornado.
 * @returns {void}
 * @since 2.0.0
 */
function tornadoCombos(builder, tornado) {
  const {combos} = builder.level.deck;
  const wantsEagle = builder.rng.chance(combos.eagleIntoFunnel);
  const carried = wantsEagle ? eagleIntoFunnel(builder, tornado) : null;
  if (builder.rng.chance(combos.suitorSwept)) {
    suitorSwept(builder, tornado, carried);
  }
  if (builder.rng.chance(combos.hunterVsTornado)) {
    hunterVsTornado(builder, tornado);
  }
}

/**
 * @description Lifts squirrels into a placed tornado: who flies, where they land (a derangement,
 *   resolved later), the shark's hat, the drops, then the combos.
 * @param {Object} builder - The race builder.
 * @param {Object[]} free - Tracks with room for the tornado at startTick.
 * @param {number} startTick - The first flight tick.
 * @returns {{startMs: number, endMs: number}} When it starts and when the last squirrel stops
 *   being dizzy.
 * @since 1.0.0
 */
function liftSquirrels(builder, free, startTick) {
  const {rng, settings, level} = builder;
  const rules = settings.deck.tornado;
  const liftCount = Math.min(rng.intBetween(rules.minLifted, rules.maxLifted), free.length);
  const lifted = rng.shuffle(free).slice(0, liftCount);
  const permutation = derangement(rng, lifted.length);
  const sharks = rng.chance(level.deck.sharkChance);
  const hatted = sharks
    ? lifted.filter((track) => builder.storedOutfit(track.index).hat !== 'none')
    : [];
  const chompTarget = hatted.length > 0 ? rng.pick(hatted).index : null;
  const drops = lifted.map(() => rng.floatBetween(rules.minDropUnits, rules.maxDropUnits));
  const flightTicks = Math.ceil(rules.flightMs / settings.tickMs);
  const startMs = builder.tickStartMs(startTick);
  const flightEndMs = startMs + flightTicks * settings.tickMs;
  const endMs = builder.tickEndMs(startTick + tornadoLayout(builder, 0).spanTicks - 1);
  const members = lifted.map((track) => track.index);
  const {id, sequence} = builder.registerEvent({
    type: 'tornado',
    category: 'chaos',
    scope: 'entrants',
    outcome: null,
    startMs,
    endMs,
    entrants: members,
    data: {sharks, hatChomp: chompTarget, stolenHat: null, flightEndMs, swaps: []}
  });
  lifted.forEach((track, slot) => {
    const layout = tornadoLayout(builder, -unitsToClimb(builder, track, drops[slot]));
    const extra = {dropUnits: roundTo(drops[slot], 2)};
    track.commit(startTick, layout, {
      eventId: id, sequence, category: 'chaos', personal: true, extra
    });
  });
  builder.addLaneOp({
    eventId: id,
    sequence,
    startMs,
    flightEndMs,
    landingTick: startTick + flightTicks,
    members,
    permutation
  });
  if (chompTarget !== null) {
    builder.addOutfitOp({
      eventId: id,
      sequence,
      atMs: startMs + Math.round((flightTicks * settings.tickMs) / 2),
      kind: 'hatOff',
      entrants: [chompTarget],
      note: 'hatChomp'
    });
  }
  tornadoCombos(builder, {id, startTick, startMs, flightTicks, lifted});
  return {startMs, endMs};
}

/**
 * @description Tries to place one tornado arriving between two ticks; gives up after the deck's
 *   number of attempts.
 * @param {Object} builder - The race builder.
 * @param {number} earliestTick - The earliest arrival tick.
 * @param {number} latestTick - The latest arrival tick.
 * @returns {{startMs: number, endMs: number}|null} The placed tornado, or null.
 * @since 1.0.0
 */
function tryTornado(builder, earliestTick, latestTick) {
  if (earliestTick > latestTick) {
    return null;
  }
  const rules = builder.settings.deck.tornado;
  const probe = tornadoLayout(builder, 0);
  for (let attempt = 0; attempt < builder.settings.deck.placementAttempts; attempt += 1) {
    const startTick = builder.rng.intBetween(earliestTick, latestTick) + 1;
    const free = builder.tracks.filter((track) => track.canPlace(startTick, probe));
    const startMs = builder.tickStartMs(startTick);
    const endMs = builder.tickEndMs(startTick + probe.spanTicks - 1);
    if (free.length >= rules.minLifted && builder.overlapAllows(startMs, endMs)) {
      return liftSquirrels(builder, free, startTick);
    }
  }
  return null;
}

/**
 * @description Places one tornado, and at the level's chance a second one after the first has
 *   landed, both arriving between 25% and 70% of the race (three or more entrants only).
 * @param {Object} builder - The race builder.
 * @returns {void}
 * @example
 *   placeTornadoes(builder);
 * @since 1.0.0
 */
export function placeTornadoes(builder) {
  const rules = builder.settings.deck.tornado;
  if (builder.tracks.length < rules.minEntrants) {
    return;
  }
  const {tickMs} = builder.settings;
  const tornadoCount = builder.rng.chance(builder.level.deck.tornadoSecondChance) ? 2 : 1;
  // Integer arithmetic keeps the arrival inside 25% to 70% of durationMs exactly.
  const latestTick = Math.floor((builder.durationMs * rules.latestPercent) / (100 * tickMs));
  let earliestTick = Math.ceil((builder.durationMs * rules.earliestPercent) / (100 * tickMs));
  for (let round = 0; round < tornadoCount; round += 1) {
    const placed = tryTornado(builder, earliestTick, latestTick);
    if (!placed) {
      return;
    }
    earliestTick = Math.ceil((placed.endMs + rules.spacingMs) / tickMs);
  }
}
