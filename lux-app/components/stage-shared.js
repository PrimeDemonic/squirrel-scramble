/**
 * Shared constants and helpers for the race stage's logic modules (stage-timeline.js,
 * stage-looks.js, stage-overlays.js, stage-scrubs.js, stage-audio.js): stage-only timings, the
 * readability rules and the visual windows built from them (Chaos v2 contract § 8), the tornado
 * funnel's path, event normalising (SPEC.md § 10, Chaos v2 contract § 3), and small maths.
 *
 * Visual windows: a visitor may appear before its event's startMs and stay after its endMs (a
 * lead-in and a tail, drawn only). Its action (a throw, a blow, a shot, a bite) still lands at
 * the plan's time, and heights and trees always come from the plan, so the stored order and the
 * finish times never change.
 *
 * Event shape: the Chaos v2 plan gives every event {id, type, scope, startMs, endMs, entrants,
 * outcome, data}. Plans built before v2 gave {entrantIndexes, details, category}. normaliseEvent
 * reads either, so the stage keeps working while the logic lane moves to the new shape.
 *
 * Pure ES module: no DOM, no Lit and no clock.
 */

/** Classic (non-Chaos) event types (SPEC.md § 11.4). */
export const CLASSIC_TYPES = Object.freeze(['nutStop', 'slip', 'burst']);

/** One choreography tick (SPEC.md § 11.2), for event phases measured in ticks. */
export const TICK_MS = 250;

/**
 * Readability rules (Chaos v2 contract § 8), in milliseconds unless named otherwise.
 * "On screen" means a walker's centre is over the field, or a fading visitor is at least half
 * visible; every visitor gets at least minOnScreenMs of it.
 */
export const READABILITY = Object.freeze({
  // Ground walkers cross at this share of the field width per second (the contract allows 0.18).
  walkSharePerSecond: 0.17,
  // Every visitor stays on screen at least this long (the contract asks for 2.5 s).
  minOnScreenMs: 2600,
  // A crossing walker is at least this far into its walk when its action begins, so it is well
  // on stage for the first throw or blow.
  walkMarginMs: 1100,
  // Trunk visitors (the beaver, the woodpecker) arrive about this early and linger about this
  // long after their event, and take this long to fade in and out.
  trunkArriveMs: 1000,
  trunkLingerMs: 800,
  trunkFadeMs: 300,
  // Field-wide events: the effect builds over the lead-in and fades over the tail.
  fieldLeadMs: 600,
  fieldTailMs: 600
});

/**
 * Stage-only timings, in milliseconds (shares are of an event's span). The race itself is timed
 * by the theme; these only shape how events look around their ticks.
 */
export const STAGE_TIMINGS = Object.freeze({
  // "Go!" stays up this long after the count-in.
  goShowMs: 800,
  // A photo finish holds the frame this long (SPEC.md § 8 result view).
  freezeHoldMs: 1600,
  photoFlashMs: 450,
  // The hunter walks in (READABILITY speed), aims, fires; a floored hunter fades over leaveMs.
  hunter: {aimMs: 500, blamMs: 350, leaveMs: 800, cowMs: 700},
  suitor: {
    leadMs: 900,
    tailMs: 700,
    appearMs: 300,
    leaveMs: 400,
    // Shares of the stall: leaning in, the kiss ending, the slap landing.
    leanShare: 0.3,
    kissEndShare: 0.85,
    slapShare: 0.4,
    // Swept up with her date (suitorSwept), she stays beside his new tree this long.
    relandMs: 1500
  },
  // The eagle dives in over leadMs and flies off over at least tailMs; the whole visit lasts at
  // least minVisitMs.
  eagle: {leadMs: 1100, tailMs: 900, minVisitMs: 3000},
  // The beaver starts chomping this long before its bite lands (it arrives earlier still).
  beaver: {chompLeadMs: 600},
  lightning: {leadMs: 300, boltMs: 450, flashMs: 450},
  // After its flight the funnel lifts off where it stands, over at least liftMs.
  tornado: {leadMs: 600, tailMs: 400, chompMs: 300, liftMs: 700},
  hit: {stunnedMs: 500, smokeMs: 700},
  kiss: {popMs: 500},
  slap: {popMs: 400},
  slip: {shakeMs: 300},
  catLady: {catFlightMs: 450, throwPoseMs: 300, cackleMs: 500},
  goldenAcorn: {homeMs: 1500, loopMs: 1100, stunnedMs: 500},
  // The pigeon and the toupee keep flying this long after the stall, so they get across.
  leafBlower: {toupeeShare: 0.8, itemTailMs: 1200},
  ufo: {leadMs: 700, tailMs: 600},
  // The crack opens at the start of the lead-in; the mole pops up just before the shaking and
  // sinks back down after the tail.
  earthquake: {crackMs: 350, moleLeadMs: 300, molePopMs: 600, moleTailMs: 900, moleSinkMs: 400},
  // The water rises over the lead-in; then squirrels still under it burst for three ticks.
  flood: {burstDelayTicks: 2, burstTicks: 3},
  // The mirror ball has dropped and the lights are up before the dancing starts.
  disco: {leadMs: 900, tailMs: 600, dropMs: 600, lightsUpMs: 700},
  acornHail: {nuts: 14},
  var: {whistleShare: 0.2, monitorShare: 0.75, linesShare: 0.15, verdictShare: 0.7},
  trenchCoat: {dazedMs: TICK_MS},
  // The woodpecker starts drilling this long before the stall.
  woodpecker: {peckLeadMs: 300}
});

/**
 * The tornado funnel's path across the field, as fractions of the field width: its centre
 * starts off the left edge and stops where the funnel's right side is still over the field
 * (the funnel is at most 0.45 of the field wide), so it never passes behind the leaderboard;
 * then it lifts off where it stands. The funnel's sweep (stage-scrubs.js) is built from the same
 * numbers, so the squirrels it carries stay inside it.
 */
export const FUNNEL = Object.freeze({
  fromFraction: -0.15,
  toFraction: 0.75,
  // The squirrels' vortex height, as a share of the climb (0 is the top).
  vortexY: 0.42,
  // Gathering ends and flinging starts at these shares of the flight.
  gatherEnd: 0.35,
  flingStart: 0.65,
  // Orbit radius: a share of the field width across, a share of the climb up and down.
  orbitX: 0.035,
  orbitY: 0.05,
  orbitTurns: 2.5
});

/**
 * @description Clamps a number to a range.
 * @param {number} value - The number.
 * @param {number} low - The lowest result.
 * @param {number} high - The highest result.
 * @returns {number} The clamped number.
 * @example
 *   clamp(5, 0, 3);
 *   // 3
 * @since 1.0.0
 */
export function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

/**
 * @description Smooth start and stop for a share from 0 to 1 (smoothstep).
 * @param {number} share - From 0 to 1.
 * @returns {number} The eased share.
 * @example
 *   ease(0.5);
 *   // 0.5
 * @since 1.0.0
 */
export function ease(share) {
  const bounded = clamp(share, 0, 1);
  return bounded * bounded * (3 - 2 * bounded);
}

/**
 * @description Linear interpolation.
 * @param {number} from - The start value.
 * @param {number} to - The end value.
 * @param {number} share - From 0 to 1.
 * @returns {number} The value between.
 * @example
 *   lerp(0, 10, 0.25);
 *   // 2.5
 * @since 1.0.0
 */
export function lerp(from, to, share) {
  return from + (to - from) * share;
}

/**
 * @description The share of an event's span that has passed at a moment.
 * @param {{startMs: number, endMs: number}} event - The event.
 * @param {number} raceMs - Race time.
 * @returns {number} From 0 to 1.
 * @example
 *   spanShare({startMs: 0, endMs: 1000}, 250);
 *   // 0.25
 * @since 1.0.0
 */
export function spanShare(event, raceMs) {
  return clamp((raceMs - event.startMs) / Math.max(1, event.endMs - event.startMs), 0, 1);
}

/**
 * @description A deterministic number from 0 (included) to 1 (excluded) for a text and a salt,
 *   for decorative placement only (where the mole pops up, where hail falls). FNV-1a hash, so the
 *   same event always looks the same in a replay.
 * @param {string} text - Usually an event id.
 * @param {number} [salt] - Distinguishes several numbers drawn for one text.
 * @returns {number} The number.
 * @example
 *   seededUnit('evt-12', 3);
 * @since 1.0.0
 */
export function seededUnit(text, salt = 0) {
  let hash = 0x811c9dc5;
  const source = `${text}#${salt}`;
  for (let index = 0; index < source.length; index += 1) {
    // Bitwise on purpose: FNV-1a works in unsigned 32-bit arithmetic.
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash / 4294967296;
}

/**
 * @description Reads one plan event in either shape (Chaos v2, or the earlier one) into the
 *   shape the stage works with. Always returns new objects; the plan is never changed.
 * @param {Object} event - A plan event.
 * @returns {{id: string, type: string, scope: string, category: string, outcome: (string|null),
 *   startMs: number, endMs: number, entrants: number[], data: Object,
 *   combo: ({kind: string, with: string}|null)}} The event.
 * @example
 *   normaliseEvent({id: 'evt-1', type: 'ufo', scope: 'entrants', startMs: 0, endMs: 900,
 *     entrants: [1, 4], outcome: null, data: {swapOutfits: true}});
 * @since 1.0.0
 */
export function normaliseEvent(event) {
  const data = {...(event.details || {}), ...(event.data || {})};
  let entrants = [];
  if (Array.isArray(event.entrants)) {
    entrants = event.entrants.slice();
  } else if (Array.isArray(event.entrantIndexes)) {
    entrants = event.entrantIndexes.slice();
  }
  const combo = data.combo && typeof data.combo === 'object'
    ? {kind: String(data.combo.kind || ''), with: String(data.combo.with || '')}
    : null;
  return {
    id: String(event.id ?? `${event.type}-${event.startMs}`),
    type: String(event.type),
    scope: event.scope === 'field' ? 'field' : 'entrants',
    category: event.category || (CLASSIC_TYPES.includes(event.type) ? 'classic' : 'chaos'),
    outcome: event.outcome ?? null,
    startMs: Number(event.startMs),
    endMs: Number(event.endMs),
    entrants,
    data,
    combo
  };
}

/**
 * @description The lane-timeline entry a squirrel is flying on at a moment (a tornado, a UFO, a
 *   trench coat), or null when it is on a tree.
 * @param {Object} plan - From buildRacePlan.
 * @param {number} entrantIndex - The squirrel.
 * @param {number} raceMs - Race time.
 * @returns {Object|null} The entry ({eventId, fromLane, toLane, flightStartMs, flightEndMs}).
 * @example
 *   laneEntryAt(plan, 2, 24300);
 * @since 1.0.0
 */
export function laneEntryAt(plan, entrantIndex, raceMs) {
  const entries = plan.entrants[entrantIndex].laneTimeline || [];
  for (const entry of entries) {
    if (raceMs < entry.flightStartMs) {
      return null;
    }
    if (raceMs < entry.flightEndMs) {
      return entry;
    }
  }
  return null;
}

/**
 * @description Which way a squirrel travels on a lane-timeline entry: inside a tornado (its own,
 *   or one an eagle drops it into, or one that sweeps up a suitor's date), beamed by a UFO,
 *   hopping in and out of a trench coat, or a plain arc.
 * @param {{eventsById: Object, combos: Object}} timeline - From prepareTimeline.
 * @param {{eventId: string}} entry - The lane-timeline entry.
 * @returns {{kind: string, tornado: (Object|null)}} The path kind ('tornado', 'ufo', 'hop' or
 *   'arc'), and the tornado it rides.
 * @example
 *   flightOf(timeline, entry).kind;
 * @since 1.0.0
 */
export function flightOf(timeline, entry) {
  const event = timeline.eventsById[entry.eventId];
  if (!event) {
    return {kind: 'arc', tornado: null};
  }
  if (event.type === 'tornado') {
    return {kind: 'tornado', tornado: event};
  }
  const combo = timeline.combos[event.id];
  const partner = combo ? timeline.eventsById[combo.with] : null;
  const intoFunnel = combo && (combo.kind === 'eagleIntoFunnel' || combo.kind === 'suitorSwept');
  if (intoFunnel && partner && partner.type === 'tornado') {
    return {kind: 'tornado', tornado: partner};
  }
  if (event.type === 'ufo') {
    return {kind: 'ufo', tornado: null};
  }
  return {kind: event.type === 'trenchCoat' ? 'hop' : 'arc', tornado: null};
}

/**
 * Ground walkers (the cat lady, the gardener) cross the whole field: their centre starts just
 * off one edge and ends just off the other, as fractions of the field width. A hunter walks in
 * from the nearer of the same two points and back out to it.
 */
export const WALK = Object.freeze({fromFraction: -0.12, toFraction: 1.12});

/**
 * Where a hunter stands, as a fraction of the field width: beside his squirrel's tree, on the
 * side he walks in from, and always clear of both edges (so never behind the leaderboard).
 */
const HUNTER_STAND = Object.freeze({min: 0.08, max: 0.9, besideLanes: 0.35, besideMin: 0.05});

/**
 * @description How long a walker takes to walk a distance at the readable walking speed.
 * @param {number} distance - The distance, as a fraction of the field width (either sign).
 * @returns {number} Milliseconds, rounded.
 * @example
 *   walkMsFor(1.24);
 *   // 7294
 * @since 2.1.0
 */
export function walkMsFor(distance) {
  return Math.round((Math.abs(distance) / READABILITY.walkSharePerSecond) * 1000);
}

/**
 * @description How long a walker's centre is off the field at one end of its walk (from its
 *   start point just off the edge to the edge itself).
 * @returns {number} Milliseconds.
 * @example
 *   walkerOffStageMs();
 *   // 706
 * @since 2.1.0
 */
export function walkerOffStageMs() {
  return walkMsFor(-WALK.fromFraction);
}

/**
 * @description The window a ground walker crosses the field in (Chaos v2 contract § 8): never
 *   faster than the readable walking speed, centred on its event's span so its throws or its
 *   blow land at the plan's times while it is well on stage. A longer span slows it down.
 * @param {{startMs: number, endMs: number}} event - A cat lady or leaf blower.
 * @returns {{startMs: number, endMs: number}} Race times.
 * @example
 *   walkSpan({startMs: 20000, endMs: 22000});
 *   // {startMs: 17353, endMs: 24647}
 * @since 1.0.0
 */
export function walkSpan(event) {
  const crossMs = Math.max(
    walkMsFor(WALK.toFraction - WALK.fromFraction),
    event.endMs - event.startMs + 2 * READABILITY.walkMarginMs
  );
  const startMs = Math.round((event.startMs + event.endMs - crossMs) / 2);
  return {startMs, endMs: startMs + crossMs};
}

/**
 * @description The hunter's visit (SPEC.md § 10, Chaos v2 contract § 8): he walks in from the
 *   nearer edge at the readable walking speed, stands beside his squirrel's tree and aims, fires
 *   at the plan's moment, then walks back out (a hit at once, a miss after grumbling). Against
 *   a tornado (hunterVsTornado) he stands near the right edge and, floored by the cow, fades
 *   where he lies. A short visit starts earlier, so he is on screen at least
 *   READABILITY.minOnScreenMs.
 * @param {{count: number, lane: number, vsTornado: boolean, outcome: (string|null),
 *   startMs: number, endMs: number}} shot - Lanes, his squirrel's lane (1 to n), the combo, the
 *   outcome and the event's span.
 * @returns {{side: string, stand: number, from: number, walkMs: number, enterAt: number,
 *   arriveAt: number, aimAt: number, leaveAt: number, leaveEnd: number, hit: boolean}} Where he
 *   stands and walks from (fractions of the field width) and when each part happens (race ms).
 * @example
 *   hunterPath({count: 8, lane: 3, vsTornado: false, outcome: 'hit', startMs: 30000,
 *     endMs: 30750});
 * @since 2.1.0
 */
export function hunterPath({count, lane, vsTornado, outcome, startMs, endMs}) {
  const rules = STAGE_TIMINGS.hunter;
  const hit = outcome === 'hit' && !vsTornado;
  let side = 'vs';
  let stand = HUNTER_STAND.max;
  if (!vsTornado) {
    const lanes = Math.max(1, count);
    const tree = (lane - 0.5) / lanes;
    const beside = Math.max(HUNTER_STAND.besideLanes / lanes, HUNTER_STAND.besideMin);
    side = lane - 1 < lanes / 2 ? 'left' : 'right';
    const wanted = side === 'left' ? tree - beside : tree + beside;
    stand = clamp(wanted, HUNTER_STAND.min, HUNTER_STAND.max);
  }
  const from = side === 'left' ? WALK.fromFraction : WALK.toFraction;
  const walkMs = walkMsFor(stand - from);
  const aimAt = startMs - rules.aimMs;
  const leaveAt = hit ? startMs + rules.blamMs + 300 : endMs + 200;
  // A floored hunter fades where he lies; the others walk back the way they came.
  const leaveMs = side === 'vs' ? rules.leaveMs : walkMs;
  const offStage = walkerOffStageMs() + (side === 'vs' ? rules.leaveMs / 2 : walkerOffStageMs());
  const shortBy = READABILITY.minOnScreenMs + offStage - (leaveAt + leaveMs - (aimAt - walkMs));
  const enterAt = aimAt - walkMs - Math.max(0, Math.ceil(shortBy));
  return {
    side,
    stand,
    from,
    walkMs,
    enterAt,
    arriveAt: enterAt + walkMs,
    aimAt,
    leaveAt,
    leaveEnd: leaveAt + leaveMs,
    hit
  };
}

/**
 * @description A trunk visitor's visit (the beaver, the woodpecker; Chaos v2 contract § 8): it
 *   arrives about a second early, does its business at the plan's times, and lingers about
 *   0.8 s; a short event stretches both ends so it is at least half visible for
 *   READABILITY.minOnScreenMs.
 * @param {{startMs: number, endMs: number}} event - The beaver or woodpecker event.
 * @returns {{startMs: number, endMs: number, inShare: number, outShare: number}} The window
 *   (race ms) and the shares of it its fade-in ends and its fade-out starts at.
 * @example
 *   trunkVisit({startMs: 30000, endMs: 30500});
 *   // {startMs: 28700, endMs: 31600, inShare: 0.103, outShare: 0.897}
 * @since 2.1.0
 */
export function trunkVisit(event) {
  const rules = READABILITY;
  const span = event.endMs - event.startMs;
  const wanted = rules.minOnScreenMs + rules.trunkFadeMs;
  const shortBy = Math.max(0, wanted - (rules.trunkArriveMs + span + rules.trunkLingerMs));
  const startMs = event.startMs - rules.trunkArriveMs - Math.ceil(shortBy / 2);
  const endMs = event.endMs + rules.trunkLingerMs + Math.floor(shortBy / 2);
  return {startMs, endMs, ...fadeShares(startMs, endMs, rules.trunkFadeMs, rules.trunkFadeMs)};
}

/**
 * @description Which side of its trunk a trunk visitor sits on: towards the middle of the field,
 *   so it is never cut off at an edge (on the right of the trunks in the left half, facing
 *   left; on the left of the trunks in the right half, facing right).
 * @param {number} lane - The tree (1 to n).
 * @param {number} count - Lanes.
 * @returns {string} 'left' or 'right'.
 * @example
 *   trunkSide(1, 8);
 *   // 'right'
 * @since 2.1.0
 */
export function trunkSide(lane, count) {
  return lane - 1 < Math.max(1, count) / 2 ? 'right' : 'left';
}

/**
 * @description The shares of a window that a fade-in ends and a fade-out starts at.
 * @param {number} startMs - Window start.
 * @param {number} endMs - Window end.
 * @param {number} inMs - Fade-in length.
 * @param {number} outMs - Fade-out length.
 * @returns {{inShare: number, outShare: number}} Shares from 0 to 1, rounded to 3 decimals.
 * @example
 *   fadeShares(0, 2000, 500, 500);
 *   // {inShare: 0.25, outShare: 0.75}
 * @since 2.1.0
 */
export function fadeShares(startMs, endMs, inMs, outMs) {
  const length = Math.max(1, endMs - startMs);
  const inShare = clamp(inMs / length, 0, 1);
  const outShare = clamp(1 - outMs / length, inShare, 1);
  return {
    inShare: Math.round(inShare * 1000) / 1000,
    outShare: Math.round(outShare * 1000) / 1000
  };
}

/**
 * @description A field-wide event's visual window (Chaos v2 contract § 8): a lead-in where the
 *   effect builds, the full effect over the whole plan window, and a tail where it fades.
 * @param {{startMs: number, endMs: number}} event - The event.
 * @param {number} [leadMs] - The lead-in (default READABILITY.fieldLeadMs).
 * @param {number} [tailMs] - The tail (default READABILITY.fieldTailMs).
 * @returns {{startMs: number, endMs: number, inShare: number, outShare: number}} The window
 *   (race ms) and the shares its build-up ends and its fade starts at.
 * @example
 *   fieldWindow({startMs: 30000, endMs: 32000});
 *   // {startMs: 29400, endMs: 32600, inShare: 0.188, outShare: 0.813}
 * @since 2.1.0
 */
export function fieldWindow(
  event,
  leadMs = READABILITY.fieldLeadMs,
  tailMs = READABILITY.fieldTailMs
) {
  const startMs = event.startMs - leadMs;
  const endMs = event.endMs + tailMs;
  return {startMs, endMs, ...fadeShares(startMs, endMs, leadMs, tailMs)};
}

/**
 * @description A visitor's window from its event's span with a lead-in and a tail, both
 *   stretched evenly when the whole is shorter than a minimum.
 * @param {{startMs: number, endMs: number}} event - The event.
 * @param {number} leadMs - The usual lead-in.
 * @param {number} tailMs - The usual tail.
 * @param {number} minMs - The shortest window allowed.
 * @returns {{startMs: number, endMs: number}} Race times.
 * @example
 *   visitWindow({startMs: 10000, endMs: 10500}, 900, 700, 3000);
 *   // {startMs: 8650, endMs: 11650}
 * @since 2.1.0
 */
export function visitWindow(event, leadMs, tailMs, minMs) {
  const span = event.endMs - event.startMs;
  const shortBy = Math.max(0, minMs - (leadMs + span + tailMs));
  return {
    startMs: event.startMs - leadMs - Math.ceil(shortBy / 2),
    endMs: event.endMs + tailMs + Math.floor(shortBy / 2)
  };
}

/**
 * @description Which way a ground walker crosses: the event's own direction, else alternating by
 *   row so two walkers on stage at once pass each other.
 * @param {{data: Object}} event - A normalised event.
 * @param {number} row - Its walker row.
 * @returns {string} 'ltr' or 'rtl'.
 * @since 1.0.0
 */
export function walkDirection(event, row) {
  if (event.data.direction === 'ltr' || event.data.direction === 'rtl') {
    return event.data.direction;
  }
  // The cat lady says which side she comes in from.
  if (event.data.side === 'left' || event.data.side === 'right') {
    return event.data.side === 'left' ? 'ltr' : 'rtl';
  }
  return row % 2 === 0 ? 'ltr' : 'rtl';
}

/**
 * @description Where a ground walker's centre is at a moment, as a fraction of the field width.
 * @param {Object} event - A normalised cat lady or leaf blower event.
 * @param {number} raceMs - Race time.
 * @param {string} direction - 'ltr' or 'rtl'.
 * @returns {number} The fraction (below 0 or above 1 when off stage).
 * @since 1.0.0
 */
export function walkerFraction(event, raceMs, direction) {
  const span = walkSpan(event);
  const share = clamp((raceMs - span.startMs) / Math.max(1, span.endMs - span.startMs), 0, 1);
  const fraction = lerp(WALK.fromFraction, WALK.toFraction, share);
  return direction === 'rtl' ? 1 - fraction : fraction;
}

/**
 * @description The cat lady's throws (Chaos v2 contract § 4, data.throws; a throw an eagle
 *   catches is marked intercepted, catVsEagle). When the plan gives none, one throw per listed
 *   squirrel is spread over the first part of her walk, so the event still reads.
 * @param {Object} event - A normalised cat lady event.
 * @param {number} tickMs - One tick.
 * @returns {Array<{atMs: number, entrant: number, clingTicks: number,
 *   intercepted: boolean}>} The throws.
 * @since 1.0.0
 */
export function catThrows(event, tickMs) {
  const given = Array.isArray(event.data.throws) ? event.data.throws : [];
  const usable = given.filter((item) => (
    item && Number.isInteger(item.entrant) && Number.isFinite(item.atMs)
  ));
  if (usable.length > 0) {
    return usable.map((item) => ({
      atMs: item.atMs,
      entrant: item.entrant,
      clingTicks: Number.isFinite(item.clingTicks) ? item.clingTicks : 3,
      intercepted: item.intercepted === true
    }));
  }
  const span = event.endMs - event.startMs;
  return event.entrants.map((entrant, slot) => ({
    atMs: Math.round(event.startMs + ((slot + 1) / (event.entrants.length + 1)) * span * 0.6),
    entrant,
    clingTicks: Math.max(1, Math.round((span * 0.3) / Math.max(1, tickMs))),
    intercepted: false
  }));
}

/**
 * @description Reads an event's list of entrant indexes (slips, hatLoss, chubby), ignoring
 *   anything that is not a whole number.
 * @param {*} value - The data field.
 * @returns {number[]} The indexes.
 * @since 1.0.0
 */
export function indexList(value) {
  return Array.isArray(value) ? value.filter((item) => Number.isInteger(item)) : [];
}

/**
 * @description Which outfit a squirrel wears at a moment (Chaos v2 contract § 3): the index of
 *   the latest outfit-timeline entry at or before then, or -1 when the plan has no outfit
 *   timeline (the stored outfit is worn throughout).
 * @param {Object} plan - From buildRacePlan.
 * @param {number} entrantIndex - The squirrel.
 * @param {number} raceMs - Race time.
 * @returns {number} The entry index, or -1.
 * @example
 *   const step = outfitStepAt(plan, 0, 30000);
 * @since 1.0.0
 */
export function outfitStepAt(plan, entrantIndex, raceMs) {
  const entries = plan.entrants[entrantIndex].outfitTimeline;
  if (!Array.isArray(entries) || entries.length === 0) {
    return -1;
  }
  let step = -1;
  entries.forEach((entry, index) => {
    if (entry && Number(entry.atMs) <= raceMs) {
      step = index;
    }
  });
  return step;
}

/**
 * @description The outfit object at an outfit-timeline step, or null for "the stored outfit".
 * @param {Object} plan - From buildRacePlan.
 * @param {number} entrantIndex - The squirrel.
 * @param {number} step - From outfitStepAt.
 * @returns {Object|null} The outfit.
 * @since 1.0.0
 */
export function outfitAtStep(plan, entrantIndex, step) {
  const entries = plan.entrants[entrantIndex].outfitTimeline;
  if (step < 0 || !Array.isArray(entries) || !entries[step]) {
    return null;
  }
  const outfit = entries[step].outfit;
  return outfit && typeof outfit === 'object' ? outfit : null;
}
