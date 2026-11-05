/**
 * The race stage's timeline (SPEC.md § 8 race and result views, § 10, § 11.9 to § 11.12, Chaos
 * v2 contract § 3 and § 6): turns the race plan and a clock reading into what the stage shows at
 * that moment.
 *
 * Two clocks:
 * - stage time (t): milliseconds since "Go!", read from performance.now() by the element. It is
 *   negative during the 3-2-1 count-in.
 * - race time (vt): the plan's own time. It equals stage time except around a photo finish, when
 *   the stage holds the frame for a moment (SPEC.md § 8 result view): race time stops at the
 *   runner-up's finish, then carries on, shifted by the hold.
 *
 * Everything here is a pure function of (plan, timeline, time), so a replay shows the same race
 * at the same moment, and a 10 fps screen share still ends on time. Continuous values (where a
 * squirrel is) and discrete values (which pose, which overlays, the leaderboard order) are kept
 * apart: the element writes the first straight onto cached elements every frame and only
 * re-renders when the second changes, which the scene signature tells it.
 *
 * Squirrel looks live in stage-looks.js and the visitors and field-wide events in
 * stage-overlays.js; this module prepares what they share (the timeline) and puts the scene
 * together. Event visuals reach a little before and after their event's ticks (a hunter stomps in
 * before he fires), but they never change the climb: heights and trees always come from the plan.
 *
 * No DOM, no Lit and no clock in here.
 */
import {themeConfig} from '../lib/theme-config.js';
import {heightAt, laneAt, leaderChanges, leaderboardAt} from '../lib/choreography.js';
import {commentatorPoseAt, logCountAt} from '../lib/race-log.js';
import {
  STAGE_TIMINGS,
  FUNNEL,
  clamp,
  ease,
  lerp,
  normaliseEvent,
  laneEntryAt,
  flightOf,
  walkSpan,
  walkDirection,
  hunterPath,
  fieldWindow
} from './stage-shared.js';
import {racerLook} from './stage-looks.js';
import {overlaysAt} from './stage-overlays.js';

export {STAGE_TIMINGS, FUNNEL, flightOf} from './stage-shared.js';
export {racerLook} from './stage-looks.js';
export {overlaysAt} from './stage-overlays.js';

const TWO_PI = 2 * Math.PI;
// Spreads the tornado orbit phases of several squirrels evenly, whatever their number.
const GOLDEN_ANGLE = 2.399963;
// Ground walkers (hunters, the cat lady, the gardener) each get a row for their whole time on
// stage, so two on stage at once walk one behind the other instead of through each other. Up to
// this many rows sit 6% of the field's height apart; more rows share the same band, closer
// together, so the highest row's feet are never more than WALKER_BAND_CQH up the field and every
// walker stays below the leaderboard (stage-chaos-layer.js, stage-hud.js).
const BASE_WALKER_ROWS = 6;
/**
 * How far up the field, in hundredths of its height, the highest walker row's feet may be. The
 * board column keeps the same share clear at its bottom under the race log (stage-hud.js), so a
 * walker leaving the field on the right is seen going. Exported since 2.2.0.
 * @type {number}
 * @since 1.0.0
 */
export const WALKER_BAND_CQH = 30;
// Two crossing walkers may share a row when they walk the same way at the same speed this far
// apart: one follows the other across without ever catching it up.
const SAME_ROW_GAP_MS = 1200;
// What the crowd does during a field-wide event, latest-started first.
const CROWD_MODES = Object.freeze({flood: 'ring', earthquake: 'domino', disco: 'dance'});

/**
 * @description The crowd's reactions over the race, in time order (SPEC.md § 8 race view): a
 *   wave on each lead change, a gasp at each Chaos event, a cheer as each awarded place finishes.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object[]} events - The normalised events.
 * @param {number} places - Places awarded.
 * @param {Object} theme - The theme config.
 * @returns {Array<{atMs: number, kind: string, untilMs: number}>} The reactions.
 * @since 1.0.0
 */
function crowdReactions(plan, events, places, theme) {
  const {reactions, reactionMs} = theme.crowd;
  const winnerFinish = plan.entrants[plan.winnerIndex].finishMs;
  const list = [];
  const add = (atMs, kind) => list.push({atMs, kind, untilMs: atMs + reactionMs[kind]});
  if (plan.entrants.length > 1) {
    leaderChanges(plan)
      .filter((change) => change.previousIndex !== null && change.atMs < winnerFinish)
      .forEach((change) => add(change.atMs, reactions.leadChange));
  }
  events
    .filter((event) => event.category === 'chaos')
    .forEach((event) => add(event.startMs, reactions.chaosEvent));
  plan.finishOrder.slice(0, places).forEach((index) => {
    add(plan.entrants[index].finishMs, reactions.finish);
  });
  return list.sort((left, right) => left.atMs - right.atMs);
}

/**
 * @description Every lane-timeline entry the plan made for one event, across all squirrels.
 * @param {Object} plan - From buildRacePlan.
 * @param {string} eventId - The event.
 * @returns {Array<Object>} The entries, each with its entrantIndex.
 * @since 1.0.0
 */
function laneEntriesFor(plan, eventId) {
  const found = [];
  plan.entrants.forEach((entrant, entrantIndex) => {
    (entrant.laneTimeline || []).forEach((entry) => {
      if (entry.eventId === eventId) {
        found.push({...entry, entrantIndex});
      }
    });
  });
  return found;
}

/**
 * @description When a tornado's flight ends: the plan's own figure, else the latest lane change
 *   it caused, else six tenths of its span.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object} event - A normalised tornado event.
 * @returns {number} Race time.
 * @since 1.0.0
 */
function flightEndOf(plan, event) {
  if (Number.isFinite(event.data.flightEndMs)) {
    return event.data.flightEndMs;
  }
  const ends = laneEntriesFor(plan, event.id).map((entry) => entry.flightEndMs);
  if (ends.length > 0) {
    return Math.max(...ends);
  }
  return event.startMs + (event.endMs - event.startMs) * 0.6;
}

/**
 * @description Links both sides of every combo (Chaos v2 contract § 4): an event that names a
 *   partner in data.combo, and the partner, which may not name it back.
 * @param {Object[]} events - The normalised events.
 * @returns {Object<string, {kind: string, with: string}>} Combo by event id.
 * @since 1.0.0
 */
function linkCombos(events) {
  const combos = {};
  events.forEach((event) => {
    if (event.combo && event.combo.kind) {
      combos[event.id] = {kind: event.combo.kind, with: event.combo.with};
    }
  });
  Object.entries({...combos}).forEach(([eventId, combo]) => {
    if (combo.with && !combos[combo.with]) {
      combos[combo.with] = {kind: combo.kind, with: eventId};
    }
  });
  return combos;
}

/**
 * @description The window a ground walker is on stage for (its readable walk, Chaos v2 contract
 *   § 8), so walkers on stage together can be given different rows.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object} event - A normalised event.
 * @param {Object<string, Object>} combos - From linkCombos.
 * @returns {{startMs: number, endMs: number, crossing: boolean}|null} The window, and whether it
 *   is a steady crossing (the cat lady, the gardener) rather than a hunter's visit; null when the
 *   event has no walker.
 * @since 1.0.0
 */
export function walkerWindow(plan, event, combos) {
  if (event.type === 'hunter') {
    const combo = combos[event.id];
    const vsTornado = Boolean(combo && combo.kind === 'hunterVsTornado');
    const target = event.entrants[0];
    if (!vsTornado && !Number.isInteger(target)) {
      return null;
    }
    const count = plan.entrants.length;
    const path = hunterPath({
      count,
      lane: vsTornado ? count : laneAt(plan, target, event.startMs).lane,
      vsTornado,
      outcome: event.outcome,
      startMs: event.startMs,
      endMs: event.endMs
    });
    return {startMs: path.enterAt, endMs: path.leaveEnd, crossing: false};
  }
  if (event.type === 'catLady' || event.type === 'leafBlower') {
    return {...walkSpan(event), crossing: true};
  }
  return null;
}

/**
 * @description Says whether a walker can join a row beside the walkers already on it: never
 *   while another is on stage, unless both are steady crossings the same way at the same speed,
 *   far enough apart that one follows the other across.
 * @param {{event: Object, window: Object}} walker - The walker to place.
 * @param {Array<{event: Object, window: Object}>} occupants - The row's walkers so far.
 * @param {number} row - The row (a crossing without its own direction takes the row's).
 * @returns {boolean} True when it fits.
 * @since 2.1.0
 */
function rowFits(walker, occupants, row) {
  return occupants.every((other) => {
    const overlaps = other.window.startMs < walker.window.endMs
      && walker.window.startMs < other.window.endMs;
    if (!overlaps) {
      return true;
    }
    const sameLength = other.window.endMs - other.window.startMs
      === walker.window.endMs - walker.window.startMs;
    const sameWay = walkDirection(other.event, row) === walkDirection(walker.event, row);
    const apart = Math.abs(other.window.startMs - walker.window.startMs) >= SAME_ROW_GAP_MS;
    return walker.window.crossing && other.window.crossing && sameLength && sameWay && apart;
  });
}

/**
 * @description Gives every ground walker a row for its whole time on stage (the first row it
 *   fits, in start order, or a new row behind the others), so a walker never jumps rows and two
 *   walkers never walk through each other.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object[]} events - The normalised events.
 * @param {Object<string, Object>} combos - From linkCombos.
 * @returns {{rows: Object<string, number>, count: number}} Row by event id (0 is the ground
 *   line), and how many rows the race uses (at least 1).
 * @since 1.0.0
 */
function assignWalkerRows(plan, events, combos) {
  const occupants = [];
  const rows = {};
  events
    .map((event) => ({event, window: walkerWindow(plan, event, combos)}))
    .filter((item) => item.window)
    .sort((left, right) => left.window.startMs - right.window.startMs)
    .forEach((walker) => {
      let row = occupants.findIndex((list, index) => rowFits(walker, list, index));
      if (row < 0) {
        row = occupants.length;
        occupants.push([]);
      }
      rows[walker.event.id] = row;
      occupants[row].push(walker);
    });
  return {rows, count: Math.max(1, occupants.length)};
}

/**
 * @description How far apart the walker rows sit, and how much smaller each row back is, for a
 *   race that uses a number of rows: six rows or fewer at 6% of the field's height apart, more
 *   rows squeezed into the same band.
 * @param {number} count - Rows in use.
 * @returns {{stepCqh: number, shrinkCqh: number}} The spacing and the shrink per row, in
 *   hundredths of the field's height.
 * @example
 *   walkerRowLayout(3);
 *   // {stepCqh: 6, shrinkCqh: 2.4}
 * @since 2.1.0
 */
export function walkerRowLayout(count) {
  const gaps = Math.max(BASE_WALKER_ROWS, count) - 1;
  const step = WALKER_BAND_CQH / gaps;
  return {
    stepCqh: Math.round(step * 100) / 100,
    shrinkCqh: Math.round(step * 40) / 100
  };
}

/**
 * @description Where the disco's mirror ball hangs: off to the left when a UFO is on stage at the
 *   same time, so the two never share the sky.
 * @param {Object[]} events - The normalised events.
 * @returns {Object<string, string>} 'centre' or 'left', by disco event id.
 * @since 1.0.0
 */
function discoBallSides(events) {
  const ufoRules = STAGE_TIMINGS.ufo;
  const discoRules = STAGE_TIMINGS.disco;
  const ufos = events.filter((event) => event.type === 'ufo');
  const sides = {};
  events.filter((event) => event.type === 'disco').forEach((disco) => {
    const {startMs: from, endMs: to} = fieldWindow(disco, discoRules.leadMs, discoRules.tailMs);
    const clash = ufos.some((ufo) => (
      ufo.startMs - ufoRules.leadMs < to && from < ufo.endMs + ufoRules.tailMs
    ));
    sides[disco.id] = clash ? 'left' : 'centre';
  });
  return sides;
}

/**
 * @description The trench-coat disguises (Chaos v2 contract § 4): the host on the middle tree,
 *   when the coat is on (between the last squirrel climbing in and the first toppling out), and
 *   each hidden squirrel's own tree, so its trunk label stays put.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object[]} events - The normalised events.
 * @returns {Object<string, {host: number, startMs: number, endMs: number,
 *   homeLanes: Object<number, number>}>} Disguise by event id.
 * @since 1.0.0
 */
function prepareDisguises(plan, events) {
  const disguises = {};
  events.filter((event) => event.type === 'trenchCoat').forEach((event) => {
    const middle = event.entrants[Math.floor(event.entrants.length / 2)];
    const host = Number.isInteger(event.data.host) ? event.data.host : middle;
    const entries = laneEntriesFor(plan, event.id);
    const homeLanes = {};
    let startMs = event.startMs;
    let endMs = event.endMs - (plan.tickMs || STAGE_TIMINGS.trenchCoat.dazedMs);
    event.entrants.filter((index) => index !== host).forEach((index) => {
      const own = entries
        .filter((entry) => entry.entrantIndex === index)
        .sort((left, right) => left.flightStartMs - right.flightStartMs);
      homeLanes[index] = own.length > 0
        ? own[0].fromLane
        : laneAt(plan, index, event.startMs).lane;
      if (own[0]) {
        startMs = Math.max(startMs, own[0].flightEndMs);
      }
      if (own[1]) {
        endMs = Math.min(endMs, own[1].flightStartMs);
      }
    });
    disguises[event.id] = {host, startMs, endMs: Math.max(startMs, endMs), homeLanes};
  });
  return disguises;
}

/**
 * @description The sharknado hat chomps (Chaos v2 contract § 4): who loses a hat, when (the
 *   victim's outfit-timeline change inside the flight, else mid-flight) and which hat it was.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object[]} events - The normalised events.
 * @param {Object<string, number>} flightEnds - Tornado flight ends by event id.
 * @returns {Object<string, {entrantIndex: number, atMs: number, hat: (string|null)}>} Chomp by
 *   tornado event id.
 * @since 1.0.0
 */
function prepareHatChomps(plan, events, flightEnds) {
  const chomps = {};
  events
    .filter((event) => event.type === 'tornado' && Number.isInteger(event.data.hatChomp))
    .forEach((event) => {
      const victim = plan.entrants[event.data.hatChomp];
      if (!victim) {
        return;
      }
      const flightEnd = flightEnds[event.id];
      const outfits = Array.isArray(victim.outfitTimeline) ? victim.outfitTimeline : [];
      const changeIndex = outfits.findIndex((entry) => (
        entry && entry.atMs > event.startMs && entry.atMs <= flightEnd
      ));
      const atMs = changeIndex > 0
        ? outfits[changeIndex].atMs
        : Math.round((event.startMs + flightEnd) / 2);
      const before = changeIndex > 0 ? outfits[changeIndex - 1] : outfits[0];
      let hat = before && before.outfit && typeof before.outfit.hat === 'string'
        ? before.outfit.hat
        : null;
      if (typeof event.data.stolenHat === 'string') {
        hat = event.data.stolenHat;
      }
      chomps[event.id] = {entrantIndex: event.data.hatChomp, atMs, hat};
    });
  return chomps;
}

/**
 * @description Prepares the timeline for one race: places, the photo-finish hold, when the result
 *   view takes over, when the stage settles, the events (normalised, by id and by squirrel),
 *   combos, and the stage-only layout the looks and overlays share (walker rows, the mirror ball's
 *   side, trench-coat disguises, sharknado hat chomps).
 * @param {Object} plan - From buildRacePlan.
 * @param {number} places - Places to award (clamped to 1 to 3 and the field size).
 * @param {Object} [theme] - The theme config.
 * @returns {Object} The timeline (plain data).
 * @example
 *   const timeline = prepareTimeline(plan, payload.race.places);
 * @since 1.0.0
 */
export function prepareTimeline(plan, places, theme = themeConfig) {
  const count = plan.entrants.length;
  const wanted = Number.isInteger(places) ? places : theme.race.defaultPlaces;
  const awarded = clamp(wanted, 1, Math.min(theme.race.maxPlaces, count));
  const finishAt = (position) => plan.entrants[plan.finishOrder[position - 1]].finishMs;
  const freeze = plan.photoFinish && count > 1
    ? {startMs: finishAt(2), holdMs: STAGE_TIMINGS.freezeHoldMs, gapMs: finishAt(2) - finishAt(1)}
    : null;
  const events = plan.events
    .map((event) => normaliseEvent(event))
    .sort((left, right) => left.startMs - right.startMs);
  const eventsById = {};
  const eventsByEntrant = plan.entrants.map(() => []);
  events.forEach((event) => {
    eventsById[event.id] = event;
    event.entrants
      .filter((index) => Number.isInteger(index) && index >= 0 && index < count)
      .forEach((index) => eventsByEntrant[index].push(event));
  });
  const flightEnds = {};
  events
    .filter((event) => event.type === 'tornado')
    .forEach((event) => {
      flightEnds[event.id] = flightEndOf(plan, event);
    });
  const combos = linkCombos(events);
  const walkers = assignWalkerRows(plan, events, combos);
  const timeline = {
    count,
    places: awarded,
    freeze,
    tickMs: plan.tickMs || 250,
    countInMs: theme.timings.countdownFrom * theme.timings.countdownStepMs,
    countStepMs: theme.timings.countdownStepMs,
    lastAwardedMs: finishAt(awarded),
    allFinishedMs: finishAt(count),
    winnerLane: laneAt(plan, plan.winnerIndex, finishAt(1)).lane,
    events,
    eventsById,
    eventsByEntrant,
    flightEnds,
    combos,
    walkerRows: walkers.rows,
    walkerLayout: walkerRowLayout(walkers.count),
    discoBallSide: discoBallSides(events),
    disguises: prepareDisguises(plan, events),
    hatChomps: prepareHatChomps(plan, events, flightEnds),
    reactions: crowdReactions(plan, events, awarded, theme)
  };
  const handOff = stageTimeOf(timeline, timeline.lastAwardedMs) + theme.timings.handOffMs;
  timeline.resultAtMs = Math.max(handOff, freeze ? freeze.startMs + freeze.holdMs : 0);
  const lastFinish = stageTimeOf(timeline, timeline.allFinishedMs);
  timeline.settledAtMs = Math.max(timeline.resultAtMs, lastFinish);
  return timeline;
}

/**
 * @description Race time at a stage time: the same, except that it stops for the photo-finish
 *   hold and then carries on shifted by it.
 * @param {Object} timeline - From prepareTimeline.
 * @param {number} stageMs - Stage time.
 * @returns {number} Race time.
 * @example
 *   const vt = raceTimeAt(timeline, t);
 * @since 1.0.0
 */
export function raceTimeAt(timeline, stageMs) {
  const {freeze} = timeline;
  if (!freeze || stageMs < freeze.startMs) {
    return stageMs;
  }
  if (stageMs < freeze.startMs + freeze.holdMs) {
    return freeze.startMs;
  }
  return stageMs - freeze.holdMs;
}

/**
 * @description Stage time of a race time (the inverse of raceTimeAt, taking the end of the hold).
 * @param {Object} timeline - From prepareTimeline.
 * @param {number} raceMs - Race time.
 * @returns {number} Stage time.
 * @since 1.0.0
 */
export function stageTimeOf(timeline, raceMs) {
  const {freeze} = timeline;
  return freeze && raceMs > freeze.startMs ? raceMs + freeze.holdMs : raceMs;
}

/**
 * @description Which view the stage is in at a stage time.
 * @param {Object} timeline - From prepareTimeline.
 * @param {number} stageMs - Stage time.
 * @returns {string} 'countdown', 'race' or 'result'.
 * @since 1.0.0
 */
export function phaseAt(timeline, stageMs) {
  if (stageMs < 0) {
    return 'countdown';
  }
  return stageMs >= timeline.resultAtMs ? 'result' : 'race';
}

/**
 * @description The count-in number at a stage time: 3, 2, 1, then 0 for "Go!", then null.
 * @param {Object} timeline - From prepareTimeline.
 * @param {number} stageMs - Stage time.
 * @returns {number|null} The number to show.
 * @since 1.0.0
 */
export function countInAt(timeline, stageMs) {
  if (stageMs < -timeline.countInMs) {
    return null;
  }
  if (stageMs < 0) {
    return Math.ceil(-stageMs / timeline.countStepMs);
  }
  return stageMs < STAGE_TIMINGS.goShowMs ? 0 : null;
}

/**
 * @description The commentary line on screen at a race time: the latest cue that has started.
 * @param {Array<{atMs: number}>} cues - Cues in time order.
 * @param {number} raceMs - Race time.
 * @returns {number} The cue's index, or -1 before the first.
 * @since 1.0.0
 */
export function cueIndexAt(cues, raceMs) {
  for (let index = cues.length - 1; index >= 0; index -= 1) {
    if (cues[index].atMs <= raceMs) {
      return index;
    }
  }
  return -1;
}

/**
 * @description Where a lifted squirrel is during a tornado flight, in lane units across and climb
 *   shares down: drawn into the funnel, spun round inside it, then flung onto its new tree. The
 *   funnel's place comes from the tornado's own sweep, so a squirrel that joins late (dropped in
 *   by an eagle) still lands inside it.
 * @param {{progress: number, funnelAt: function(number): number, flight: Object,
 *   entrantIndex: number, laneCount: number, restY: number}} state - The squirrel's share of its
 *   own flight, the funnel's sweep share at a share of that flight, the flight, and where it
 *   rests before and after.
 * @returns {{x: number, y: number}} The position.
 * @since 1.0.0
 */
function tornadoPath({progress, funnelAt, flight, entrantIndex, laneCount, restY}) {
  const funnelX = (share) => {
    const fraction = lerp(FUNNEL.fromFraction, FUNNEL.toFraction, funnelAt(share));
    return fraction * laneCount - 0.5;
  };
  const orbit = (share) => {
    const angle = TWO_PI * FUNNEL.orbitTurns * funnelAt(share) + entrantIndex * GOLDEN_ANGLE;
    return {
      x: Math.cos(angle) * FUNNEL.orbitX * laneCount,
      y: Math.sin(angle) * FUNNEL.orbitY
    };
  };
  const fromX = flight.fromLane - 1;
  const toX = flight.toLane - 1;
  let x;
  let y;
  if (progress < FUNNEL.gatherEnd) {
    const share = ease(progress / FUNNEL.gatherEnd);
    const spin = orbit(progress);
    x = lerp(fromX, funnelX(progress) + spin.x, share);
    y = lerp(restY, FUNNEL.vortexY + spin.y, share) - Math.sin(Math.PI * share) * 0.08;
  } else if (progress < FUNNEL.flingStart) {
    const spin = orbit(progress);
    x = funnelX(progress) + spin.x;
    y = FUNNEL.vortexY + spin.y;
  } else {
    const share = ease((progress - FUNNEL.flingStart) / (1 - FUNNEL.flingStart));
    const spin = orbit(FUNNEL.flingStart);
    x = lerp(funnelX(FUNNEL.flingStart) + spin.x, toX, share);
    y = lerp(FUNNEL.vortexY + spin.y, restY, share) - Math.sin(Math.PI * share) * 0.12;
  }
  return {x: clamp(x, -0.4, laneCount - 0.6), y: clamp(y, 0, 1)};
}

/**
 * @description Where a beamed squirrel is during a UFO swap: drawn up the beam to the saucer over
 *   the two trees, wobbling inside it while the outfits change, then lowered onto the other tree.
 * @param {number} progress - Share of the flight, 0 to 1.
 * @param {Object} flight - The lane-timeline entry.
 * @param {number} restY - Climb share before and after.
 * @returns {{x: number, y: number}} The position.
 * @since 1.0.0
 */
function ufoPath(progress, flight, restY) {
  const fromX = flight.fromLane - 1;
  const toX = flight.toLane - 1;
  const midX = (fromX + toX) / 2;
  const top = 0.02;
  if (progress < 0.35) {
    const share = ease(progress / 0.35);
    return {x: lerp(fromX, midX, share), y: lerp(restY, top, share)};
  }
  if (progress < 0.65) {
    const wobble = Math.sin(((progress - 0.35) / 0.3) * TWO_PI) * 0.08;
    return {x: midX + wobble, y: top};
  }
  const share = ease((progress - 0.65) / 0.35);
  return {x: lerp(midX, toX, share), y: lerp(top, restY, share)};
}

/**
 * @description A hop from one tree to another: a low one in and out of a trench coat, a higher
 *   arc otherwise.
 * @param {number} progress - Share of the flight, 0 to 1.
 * @param {Object} flight - The lane-timeline entry.
 * @param {number} restY - Climb share before and after.
 * @param {number} lift - How high the arc goes, as a share of the climb.
 * @returns {{x: number, y: number}} The position.
 * @since 1.0.0
 */
function hopPath(progress, flight, restY, lift) {
  const x = lerp(flight.fromLane - 1, flight.toLane - 1, ease(progress));
  return {x, y: clamp(restY - Math.sin(Math.PI * progress) * lift, 0, 1)};
}

/**
 * @description Where one squirrel is at a race time, for the per-frame transform: x in lane units
 *   from the first tree, y as a share of the climb from the top (0 is the chestnut).
 * @param {Object} plan - From buildRacePlan.
 * @param {Object} timeline - From prepareTimeline.
 * @param {number} entrantIndex - The squirrel.
 * @param {number} raceMs - Race time.
 * @param {boolean} reduced - Reduced motion: a flight moves the squirrel halfway through, with
 *   no arc.
 * @returns {{x: number, y: number, flying: boolean}} The position.
 * @example
 *   const {x, y} = racerPlacement(plan, timeline, 0, vt, false);
 * @since 1.0.0
 */
export function racerPlacement(plan, timeline, entrantIndex, raceMs, reduced) {
  const height = heightAt(plan, entrantIndex, raceMs);
  const restY = 1 - height / 100;
  const entry = laneEntryAt(plan, entrantIndex, raceMs);
  if (!entry) {
    return {x: laneAt(plan, entrantIndex, raceMs).lane - 1, y: restY, flying: false};
  }
  const span = Math.max(1, entry.flightEndMs - entry.flightStartMs);
  const progress = clamp((raceMs - entry.flightStartMs) / span, 0, 1);
  if (reduced) {
    const landed = progress >= 0.5;
    return {x: (landed ? entry.toLane : entry.fromLane) - 1, y: restY, flying: true};
  }
  const flight = flightOf(timeline, entry);
  let path;
  if (flight.kind === 'tornado') {
    const sweepStart = flight.tornado.startMs;
    const sweepEnd = timeline.flightEnds[flight.tornado.id] ?? entry.flightEndMs;
    const funnelAt = (share) => clamp(
      (entry.flightStartMs + share * span - sweepStart) / Math.max(1, sweepEnd - sweepStart),
      0,
      1
    );
    path = tornadoPath({
      progress,
      funnelAt,
      flight: entry,
      entrantIndex,
      laneCount: plan.entrants.length,
      restY
    });
  } else if (flight.kind === 'ufo') {
    path = ufoPath(progress, entry, restY);
  } else {
    path = hopPath(progress, entry, restY, flight.kind === 'hop' ? 0.05 : 0.1);
  }
  return {x: path.x, y: path.y, flying: true};
}

/**
 * @description The crowd's reaction at a race time, if any (the latest that is still playing),
 *   and what the whole crowd is doing during a field-wide event: bobbing in rubber rings in a
 *   flood, falling like dominoes in an earthquake, dancing at the disco.
 * @param {Object} timeline - From prepareTimeline.
 * @param {number} raceMs - Race time.
 * @returns {{kind: string, atMs: number, mode: string}|null} The reaction and mode.
 * @since 1.0.0
 */
export function crowdAt(timeline, raceMs) {
  let reaction = null;
  for (let index = timeline.reactions.length - 1; index >= 0; index -= 1) {
    const candidate = timeline.reactions[index];
    if (candidate.atMs <= raceMs && raceMs < candidate.untilMs) {
      reaction = candidate;
      break;
    }
  }
  const field = timeline.events
    .filter((event) => (
      Object.prototype.hasOwnProperty.call(CROWD_MODES, event.type)
      && event.startMs <= raceMs
      && raceMs < event.endMs
    ))
    .pop();
  if (!reaction && !field) {
    return null;
  }
  return {
    kind: reaction ? reaction.kind : 'idle',
    atMs: reaction ? reaction.atMs : field.startMs,
    mode: field ? CROWD_MODES[field.type] : 'calm'
  };
}

/**
 * @description The scale band for a field size (SPEC.md § 8 scale): roomy up to 12 squirrels
 *   (flat labels, full outfits), busy from 13 (rotated labels, hat and fur only), packed from 31
 *   (narrow lanes and small sprites; the leaderboard carries readability).
 * @param {number} count - Entrants.
 * @param {Object} [theme] - The theme config.
 * @returns {string} 'roomy', 'busy' or 'packed'.
 * @since 1.0.0
 */
export function scaleBand(count, theme = themeConfig) {
  const {scale} = theme.race;
  if (count >= scale.compactLanesFrom) {
    return 'packed';
  }
  return count >= scale.simplifiedOutfitsFrom ? 'busy' : 'roomy';
}

/**
 * @description The field-wide state at a race time that the element puts on the field itself:
 *   the earthquake's shake (building over a lead-in, fading over a tail, Chaos v2 contract § 8),
 *   the disco light and the VAR freeze (both over the plan window, when everyone is stalled).
 * @param {Object} timeline - From prepareTimeline.
 * @param {number} raceMs - Race time.
 * @param {boolean} reduced - Reduced motion: no shake.
 * @returns {{quake: ({startMs: number, durationMs: number, inShare: number,
 *   outShare: number}|null), disco: boolean, varFreeze: boolean}} The state.
 * @since 1.0.0
 */
function fieldStateAt(timeline, raceMs, reduced) {
  const active = (type) => timeline.events.find((event) => (
    event.type === type && event.startMs <= raceMs && raceMs < event.endMs
  )) || null;
  const quakeEvent = reduced
    ? null
    : timeline.events.find((event) => {
      if (event.type !== 'earthquake') {
        return false;
      }
      const shake = fieldWindow(event);
      return shake.startMs <= raceMs && raceMs < shake.endMs;
    });
  let quake = null;
  if (quakeEvent) {
    const shake = fieldWindow(quakeEvent);
    quake = {
      startMs: shake.startMs,
      durationMs: shake.endMs - shake.startMs,
      inShare: shake.inShare,
      outShare: shake.outShare
    };
  }
  return {
    quake,
    disco: Boolean(active('disco')),
    varFreeze: Boolean(active('var'))
  };
}

/**
 * @description Everything discrete the stage shows at a stage time, plus a signature that changes
 *   only when something on it does. Continuous positions are left to racerPlacement. Since 2.2.0
 *   the scene also carries how many race log entries have appeared (logCount) and the owl
 *   commentator's pose (owlPose, Chaos v2 contract § 11 and § 12), both in the signature, and it
 *   settles only once the owl is back to idle (its cheer loops would otherwise run on).
 * @param {Object} plan - From buildRacePlan.
 * @param {Object} timeline - From prepareTimeline.
 * @param {Array<{atMs: number, trigger?: string}>} cues - Commentary cues.
 * @param {number} stageMs - Stage time.
 * @param {{reduced?: boolean, legendary?: boolean[], resultShownMs?: (number|null),
 *   confettiMs?: number, log?: Array<{atMs: number, kind: string}>}} [options] - Reduced motion,
 *   who wears a legendary item, when the result view appeared (stage time), how long confetti
 *   stays, and the race log (buildRaceLog; since 2.2.0, none when missing).
 * @returns {Object} The scene: phase, raceMs, countIn, cueIndex, logCount, owlPose, racers,
 *   occupancy, board, overlays, swayLanes, wobbleLanes, twisting, quake, disco, varFreeze, crowd,
 *   photo, confetti, settled and signature.
 * @example
 *   const scene = sceneAt(plan, timeline, cues, t, {reduced: false, log});
 * @since 1.0.0
 */
export function sceneAt(plan, timeline, cues, stageMs, options = {}) {
  const reduced = options.reduced === true;
  const legendary = options.legendary || [];
  const raceMs = raceTimeAt(timeline, stageMs);
  const phase = phaseAt(timeline, stageMs);
  const racers = plan.entrants.map((_entrant, index) => (
    racerLook(plan, timeline, index, raceMs, {legendary: legendary[index] === true})
  ));
  const occupancy = new Array(plan.entrants.length).fill(-1);
  // Hidden squirrels (inside a trench coat) keep their own trees, so the labels stay put.
  racers
    .map((racer, index) => ({racer, index}))
    .sort((left, right) => Number(left.racer.hidden) - Number(right.racer.hidden))
    .forEach(({racer, index}) => {
      if (occupancy[racer.tree - 1] === -1 || racer.hidden) {
        occupancy[racer.tree - 1] = index;
      }
    });
  const board = leaderboardAt(plan, raceMs).slice(0, 5).map((row) => ({
    entrantIndex: row.entrantIndex,
    finished: row.finished,
    position: row.position
  }));
  const overlays = overlaysAt(plan, timeline, raceMs, reduced);
  // A tree sways while its beaver chomps, and wobbles while its woodpecker drills or the ground
  // shakes; the visitors' arrivals and departures leave the trees alone.
  const swayLanes = overlays
    .filter((overlay) => overlay.type === 'beaver' && overlay.pose === 'gnaw')
    .map((overlay) => overlay.lane);
  const quaking = overlays.some((overlay) => overlay.type === 'earthquake' && overlay.shaking);
  const wobbleLanes = quaking
    ? Array.from({length: plan.entrants.length}, (_value, slot) => slot + 1)
    : overlays
      .filter((overlay) => overlay.type === 'woodpecker' && overlay.pose === 'peck')
      .map((overlay) => overlay.lane);
  const twisting = overlays.some((overlay) => overlay.type === 'tornado' && overlay.twisting);
  const field = fieldStateAt(timeline, raceMs, reduced);
  const {freeze} = timeline;
  const photo = freeze && stageMs >= freeze.startMs && stageMs < freeze.startMs + freeze.holdMs
    ? {startMs: freeze.startMs, gapMs: freeze.gapMs, flash: !reduced}
    : null;
  const shownAt = options.resultShownMs;
  const confettiMs = options.confettiMs ?? themeConfig.timings.confettiMs;
  const confetti = !reduced && phase === 'result' && Number.isFinite(shownAt)
    && stageMs < shownAt + confettiMs;
  const crowd = phase === 'countdown' ? null : crowdAt(timeline, raceMs);
  // The race log and the owl (contract § 11, § 12) follow race time, so both hold through the
  // photo-finish freeze-frame with everything else. Before "Go!" the log is empty, the owl idle.
  const log = Array.isArray(options.log) ? options.log : [];
  const owlPose = commentatorPoseAt(cues, log, raceMs);
  const scene = {
    phase,
    raceMs,
    countIn: countInAt(timeline, stageMs),
    cueIndex: cueIndexAt(cues, raceMs),
    logCount: logCountAt(log, raceMs),
    owlPose,
    racers,
    occupancy,
    board,
    overlays,
    swayLanes,
    wobbleLanes,
    twisting,
    quake: field.quake,
    disco: field.disco,
    varFreeze: field.varFreeze,
    crowd,
    photo,
    confetti,
    settled: phase === 'result' && stageMs >= timeline.settledAtMs && !confetti
      && owlPose === 'idle'
  };
  scene.signature = JSON.stringify([
    phase,
    scene.countIn,
    scene.cueIndex,
    scene.logCount,
    owlPose,
    racers.map((racer) => [
      racer.pose,
      racer.motion,
      racer.effects.join(','),
      racer.decor.map((item) => `${item.kind}:${item.phase || ''}:${item.startMs}`).join(','),
      racer.finished ? racer.position : 0,
      racer.tree,
      racer.outfitStep,
      racer.hidden ? 1 : 0,
      racer.coat ? 1 : 0
    ].join('|')),
    board,
    overlays,
    swayLanes,
    wobbleLanes,
    twisting,
    field,
    crowd,
    photo,
    confetti,
    scene.settled
  ]);
  return scene;
}

/**
 * @description The owl commentator's hoots as sound marks (Chaos v2 contract § 9, § 12): one with
 *   the 'go' cue and one as the commentary calls the winner's line (the 'winner' cue, or the
 *   'photoFinish' cue, which lands as the frame freezes), in stage time. The same shape as an
 *   audioMarks cue mark, so the stage plays them on the same path: live playback only, never
 *   from a seek or a skip.
 * @param {Array<{atMs: number, trigger?: string}>} cues - From buildCommentaryCues.
 * @param {Object} timeline - From prepareTimeline.
 * @param {Object} [theme] - The theme config (its raceLog.owl.cheerTriggers name the winner's
 *   line).
 * @returns {Array<{atMs: number, kind: string, name: string}>} One or two 'hoot' cue marks, in
 *   time order.
 * @example
 *   hootMarks(cues, timeline);
 *   // [{atMs: 0, kind: 'cue', name: 'hoot'}, {atMs: 30000, kind: 'cue', name: 'hoot'}]
 * @since 2.2.0
 */
export function hootMarks(cues, timeline, theme = themeConfig) {
  const marks = [{atMs: 0, kind: 'cue', name: 'hoot'}];
  const owl = theme && theme.raceLog && theme.raceLog.owl ? theme.raceLog.owl : {};
  const lineTriggers = Array.isArray(owl.cheerTriggers)
    ? owl.cheerTriggers
    : themeConfig.raceLog.owl.cheerTriggers;
  const line = (Array.isArray(cues) ? cues : []).find((cue) => (
    cue && lineTriggers.includes(cue.trigger) && Number.isFinite(cue.atMs) && cue.atMs > 0
  ));
  if (line) {
    marks.push({atMs: Math.round(stageTimeOf(timeline, line.atMs)), kind: 'cue', name: 'hoot'});
  }
  return marks;
}

/**
 * @description A race's sound marks with the owl's hoots merged in, still in time order. A hoot
 *   at the same moment as another mark sounds after it (after the 'go' cue at the start).
 * @param {Array<{atMs: number}>} marks - From audioMarks (stage-audio.js).
 * @param {Array<{atMs: number, trigger?: string}>} cues - From buildCommentaryCues.
 * @param {Object} timeline - From prepareTimeline.
 * @param {Object} [theme] - The theme config.
 * @returns {Array<Object>} A new array: every mark and the hoots, sorted by atMs (stable).
 * @example
 *   const marks = withHootMarks(audioMarks(plan, timeline), cues, timeline);
 * @since 2.2.0
 */
export function withHootMarks(marks, cues, timeline, theme = themeConfig) {
  const base = Array.isArray(marks) ? marks : [];
  return base
    .concat(hootMarks(cues, timeline, theme))
    .sort((first, second) => first.atMs - second.atMs);
}
