/**
 * The visitors and field-wide events on the race stage at a moment of the race (SPEC.md § 10,
 * Chaos v2 contract § 4, § 6 and § 8), as plain descriptors for the renderers in
 * stage-chaos-layer.js and stage-field-layer.js.
 *
 * Every descriptor names its layer, so overlapping events never fight over the same space:
 * - wash (z 1, drawn after the trees, behind the visitors and the squirrels): the disco's purple
 *   light and its robot-beaver cameo, the flood water and its rubber duck, the earthquake's crack
 *   and mole, and the VAR veil. A field-wide wash never covers a squirrel, so nobody looks faded
 *   (contract § 8);
 * - back (z 2, in front of the trees, behind the squirrels): the tornado, ground walkers (hunter,
 *   cat lady, gardener), the beaver, the woodpecker, lightning;
 * - front (z 4, in front of the squirrels): the suitor on her branch, the UFO (so a beamed
 *   squirrel vanishes inside it), the lightning's sky flash;
 * - fx (z 5, the full field): light accents only, at low opacity: the leaf gust, the disco
 *   beams and mirror ball, the acorn hail;
 * - var (z 7, above everything but the photo-finish stamp): the VAR review.
 * Ground walkers keep the row prepareTimeline gave them, one behind the other; the mirror ball
 * hangs to one side when a UFO is about.
 *
 * Readability (contract § 8): every visitor has a visual window around its event's plan window
 * (stage-shared.js): walkers walk at a readable speed and act at the plan's moment, trunk
 * visitors arrive early and linger, field-wide events build over a lead-in and fade over a tail.
 * All of it is drawn only: heights and trees always come from the plan.
 *
 * Descriptors hold discrete values only (poses, windows, lanes): they go into the scene
 * signature, and the timed parts move by the race clock through stage-scrubs.js. A window may
 * carry inShare and outShare, the shares of it its build-up ends and its fade starts at.
 *
 * Pure ES module: no DOM, no Lit and no clock.
 */
import {heightAt, laneAt} from '../lib/choreography.js';
import {
  STAGE_TIMINGS,
  READABILITY,
  seededUnit,
  spanShare,
  walkSpan,
  walkDirection,
  catThrows,
  hunterPath,
  trunkVisit,
  trunkSide,
  fieldWindow,
  fadeShares,
  visitWindow
} from './stage-shared.js';

/**
 * @description The tree a squirrel is on at a moment, and its height then.
 * @param {Object} plan - From buildRacePlan.
 * @param {number} entrantIndex - The squirrel.
 * @param {number} atMs - Race time.
 * @returns {{lane: number, height: number}} The lane (1 to n) and height (0 to 100).
 * @since 1.0.0
 */
function targetAt(plan, entrantIndex, atMs) {
  return {
    lane: laneAt(plan, entrantIndex, atMs).lane,
    height: Math.round(heightAt(plan, entrantIndex, atMs) * 10) / 10
  };
}

/**
 * @description A race-time window for a timed part, with the shares its build-up ends and its
 *   fade starts at when it has them.
 * @param {number} startMs - Start.
 * @param {number} endMs - End.
 * @param {{inShare: number, outShare: number}} [shares] - Build-up and fade shares.
 * @returns {{startMs: number, durationMs: number, inShare?: number, outShare?: number}} The
 *   window.
 * @since 1.0.0
 */
function windowOf(startMs, endMs, shares = null) {
  const range = {
    startMs: Math.round(startMs),
    durationMs: Math.max(1, Math.round(endMs - startMs))
  };
  return shares ? {...range, inShare: shares.inShare, outShare: shares.outShare} : range;
}

/**
 * @description The window of a visual window object that already carries its shares.
 * @param {{startMs: number, endMs: number, inShare: number, outShare: number}} visual - From
 *   fieldWindow, trunkVisit or fadeShares.
 * @returns {{startMs: number, durationMs: number, inShare: number, outShare: number}} The window.
 * @since 2.1.0
 */
function envelopeOf(visual) {
  return windowOf(visual.startMs, visual.endMs, visual);
}

/**
 * @description A ground walker's row and how the race's rows are laid out (prepareTimeline), for
 *   the walker's descriptor.
 * @param {Object} timeline - From prepareTimeline.
 * @param {string} eventId - The walker's event.
 * @returns {{row: number, rowStep: number, rowShrink: number}} The row (0 is the ground line),
 *   the spacing between rows and the shrink per row (hundredths of the field's height).
 * @since 2.1.0
 */
function walkerRowOf(timeline, eventId) {
  const layout = timeline.walkerLayout || {stepCqh: 6, shrinkCqh: 2.4};
  return {
    row: timeline.walkerRows[eventId] || 0,
    rowStep: layout.stepCqh,
    rowShrink: layout.shrinkCqh
  };
}

/**
 * @description Says whether an event of a type is under way (between its own ticks).
 * @param {Object} context - The overlay context.
 * @param {string} type - The event type.
 * @returns {boolean} True when one is.
 * @since 1.0.0
 */
function underway(context, type) {
  return context.timeline.events.some((event) => (
    event.type === type && event.startMs <= context.raceMs && context.raceMs < event.endMs
  ));
}

/**
 * @description The combo an event takes part in, and its partner.
 * @param {Object} context - The overlay context.
 * @param {Object} event - The event.
 * @returns {{kind: string, partner: (Object|null)}} The combo ('' when none).
 * @since 1.0.0
 */
function comboOf(context, event) {
  const combo = context.timeline.combos[event.id];
  if (!combo) {
    return {kind: '', partner: null};
  }
  return {kind: combo.kind, partner: context.timeline.eventsById[combo.with] || null};
}

/**
 * @description The tornado: the sky darkens, the funnel sweeps across over the flight, then lifts
 *   off where it stands (well clear of the leaderboard, contract § 8) as the sky clears (SPEC.md
 *   § 10). A sharknado has sharks circling inside, one of which bites a hat off and then wears
 *   it; a suitor swept up with her date spins round in it too.
 * @param {Object} event - The tornado event.
 * @param {Object} context - The overlay context.
 * @returns {Object|null} The descriptor, or null when it is over.
 * @since 1.0.0
 */
function tornadoOverlay(event, context) {
  const {raceMs, timeline} = context;
  const rules = STAGE_TIMINGS.tornado;
  const startMs = event.startMs - rules.leadMs;
  const flightEndMs = timeline.flightEnds[event.id] ?? event.endMs;
  const endMs = Math.max(event.endMs + rules.tailMs, flightEndMs + rules.liftMs);
  if (raceMs < startMs || raceMs >= endMs) {
    return null;
  }
  const sweeping = raceMs >= event.startMs && raceMs < flightEndMs;
  const chomp = timeline.hatChomps[event.id] || null;
  let chompPhase = '';
  if (chomp) {
    chompPhase = 'circle';
    if (raceMs >= chomp.atMs) {
      chompPhase = raceMs < chomp.atMs + rules.chompMs ? 'chomp' : 'wearing';
    }
  }
  const sweptSuitor = timeline.events.some((other) => {
    const combo = timeline.combos[other.id];
    return other.type === 'suitor' && combo && combo.kind === 'suitorSwept'
      && combo.with === event.id;
  });
  return {
    key: event.id,
    type: 'tornado',
    layer: 'back',
    sweep: windowOf(event.startMs, flightEndMs),
    lift: windowOf(flightEndMs, endMs),
    dim: windowOf(startMs, endMs),
    twisting: sweeping,
    sharks: event.data.sharks === true,
    chomp: chomp ? {phase: chompPhase, hat: chomp.hat, victim: chomp.entrantIndex} : null,
    passenger: sweptSuitor && sweeping ? 'suitor' : ''
  };
}

/**
 * @description The hunter (SPEC.md § 10, contract § 8): walks in from the nearer edge at a
 *   readable pace, squints and aims, BLAM at the plan's moment, then walks back out (a hit) or
 *   grumbles with a sooty face first (a miss). Aiming at a tornado instead (hunterVsTornado), he
 *   stands near the right edge, fires, gets the cow spat back at him and ends up flat on his
 *   back. At a disco he dances.
 * @param {Object} event - The hunter event.
 * @param {Object} context - The overlay context.
 * @returns {Object|null} The descriptor, or null when he is off stage.
 * @since 1.0.0
 */
function hunterOverlay(event, context) {
  const {plan, timeline, raceMs} = context;
  const rules = STAGE_TIMINGS.hunter;
  const vsTornado = comboOf(context, event).kind === 'hunterVsTornado';
  const target = event.entrants[0];
  if (!vsTornado && !Number.isInteger(target)) {
    return null;
  }
  const lane = vsTornado ? plan.entrants.length : targetAt(plan, target, event.startMs).lane;
  const path = hunterPath({
    count: plan.entrants.length,
    lane,
    vsTornado,
    outcome: event.outcome,
    startMs: event.startMs,
    endMs: event.endMs
  });
  if (raceMs < path.enterAt || raceMs >= path.leaveEnd) {
    return null;
  }
  const fireEnd = event.startMs + rules.blamMs;
  const cowEnd = fireEnd + rules.cowMs;
  let pose = 'walk';
  if (raceMs >= path.arriveAt && raceMs < event.startMs) {
    pose = 'aim';
  } else if (raceMs >= event.startMs && raceMs < fireEnd) {
    pose = path.hit || vsTornado ? 'fire' : 'backfire';
  } else if (!path.hit && raceMs >= fireEnd && raceMs < path.leaveAt) {
    pose = 'grumble';
  }
  return {
    key: event.id,
    type: 'hunter',
    layer: 'back',
    outcome: event.outcome,
    lane,
    side: path.side,
    // Where he stands, and how far off stage he walks from (both in hundredths of the field).
    stand: Math.round(path.stand * 10000) / 100,
    enterFrom: Math.round((path.from - path.stand) * 10000) / 100,
    ...walkerRowOf(timeline, event.id),
    pose,
    enter: windowOf(path.enterAt, path.arriveAt),
    leave: windowOf(path.leaveAt, path.leaveEnd),
    leaving: raceMs >= path.leaveAt && path.side !== 'vs',
    cow: vsTornado && raceMs >= fireEnd && raceMs < cowEnd ? windowOf(fireEnd, cowEnd) : null,
    floored: vsTornado && raceMs >= cowEnd,
    dancing: underway(context, 'disco')
  };
}

/**
 * @description The suitor (SPEC.md § 10): she appears on a branch beside the squirrel and flutters
 *   her lashes, then kisses or slaps it, then waves it off and fades; her visit is long enough to
 *   read (contract § 8). Swept up with her date by a tornado (suitorSwept), she leaves her branch
 *   for the funnel and turns up again beside the date's new tree.
 * @param {Object} event - The suitor event.
 * @param {Object} context - The overlay context.
 * @returns {Object|null} The descriptor, or null when she is off stage.
 * @since 1.0.0
 */
function suitorOverlay(event, context) {
  const {plan, timeline, raceMs} = context;
  const rules = STAGE_TIMINGS.suitor;
  const date = event.entrants[0];
  const combo = comboOf(context, event);
  const tornado = combo.kind === 'suitorSwept' && combo.partner
    && combo.partner.type === 'tornado' ? combo.partner : null;
  const sweptEnd = tornado ? (timeline.flightEnds[tornado.id] ?? tornado.endMs) : -Infinity;
  // Half of each fade counts as on screen.
  const minVisit = READABILITY.minOnScreenMs + (rules.appearMs + rules.leaveMs) / 2;
  const visit = visitWindow(event, rules.leadMs, rules.tailMs, minVisit);
  const startMs = visit.startMs;
  // Swept away, she turns up again beside her date's new tree once the funnel drops them.
  const endMs = tornado ? sweptEnd + rules.relandMs : visit.endMs;
  if (!Number.isInteger(date) || raceMs < startMs || raceMs >= endMs) {
    return null;
  }
  if (tornado && raceMs >= tornado.startMs && raceMs < sweptEnd) {
    // She is in the funnel (see tornadoOverlay).
    return null;
  }
  const relanded = tornado && raceMs >= sweptEnd;
  const span = event.endMs - event.startMs;
  let pose = 'beckon';
  if (relanded) {
    pose = event.outcome === 'slap' ? 'wave-off' : 'kiss';
  } else if (raceMs >= event.endMs) {
    pose = 'wave-off';
  } else if (event.outcome === 'kiss' && raceMs >= event.startMs) {
    pose = 'kiss';
  } else if (event.outcome === 'slap' && raceMs >= event.startMs + span * rules.slapShare) {
    pose = 'slap';
  }
  const {lane, height} = targetAt(plan, date, relanded ? sweptEnd : event.startMs);
  const leaveAt = endMs - rules.leaveMs;
  const appearFrom = relanded ? sweptEnd : startMs;
  return {
    key: event.id,
    type: 'suitor',
    layer: 'front',
    outcome: event.outcome,
    lane,
    height,
    side: lane === plan.entrants.length ? 'left' : 'right',
    pose,
    hearts: raceMs < event.startMs,
    appear: windowOf(appearFrom, appearFrom + rules.appearMs),
    leave: raceMs >= leaveAt ? windowOf(leaveAt, leaveAt + rules.leaveMs) : null
  };
}

/**
 * @description The beaver (contract § 8): it waddles up to the foot of the squirrel's tree about
 *   a second early, facing the trunk from the middle-of-the-field side, chomps it (wood chips
 *   flying, a bite appearing in the bark, the tree swaying) through the plan window, sits back
 *   satisfied for a moment and waddles off. At a disco it does the robot instead.
 * @param {Object} event - The beaver event.
 * @param {Object} context - The overlay context.
 * @returns {Object|null} The descriptor, or null when it is off stage.
 * @since 1.0.0
 */
function beaverOverlay(event, context) {
  const {plan, raceMs} = context;
  const victim = event.entrants[0];
  if (!Number.isInteger(victim)) {
    return null;
  }
  const visit = trunkVisit(event);
  if (raceMs < visit.startMs || raceMs >= visit.endMs) {
    return null;
  }
  const lane = targetAt(plan, victim, event.startMs).lane;
  const robot = underway(context, 'disco');
  const chompFrom = Math.max(
    visit.startMs + READABILITY.trunkFadeMs,
    event.startMs - STAGE_TIMINGS.beaver.chompLeadMs
  );
  const gnawing = !robot && raceMs >= chompFrom && raceMs < event.endMs;
  return {
    key: event.id,
    type: 'beaver',
    layer: 'back',
    lane,
    side: trunkSide(lane, plan.entrants.length),
    visit: envelopeOf(visit),
    // The bite in the bark grows while the plan's stall lasts.
    bite: windowOf(event.startMs, event.endMs),
    pose: gnawing ? 'gnaw' : 'idle',
    robot
  };
}

/**
 * @description The lightning overlay: a white flash across the sky and a bolt down to the
 *   squirrel. Reduced motion keeps the bolt and drops the flash.
 * @param {Object} event - The lightning event.
 * @param {Object} context - The overlay context.
 * @returns {Object|null} The descriptor, or null when it is over.
 * @since 1.0.0
 */
function lightningOverlay(event, context) {
  const {plan, raceMs, reduced} = context;
  const rules = STAGE_TIMINGS.lightning;
  const startMs = event.startMs - rules.leadMs;
  const victim = event.entrants[0];
  if (!Number.isInteger(victim) || raceMs < startMs || raceMs >= event.startMs + rules.boltMs) {
    return null;
  }
  const {lane, height} = targetAt(plan, victim, event.startMs);
  return {
    key: event.id,
    type: 'lightning',
    layer: 'back',
    lane,
    height,
    bolt: raceMs >= event.startMs ? windowOf(event.startMs, event.startMs + rules.boltMs) : null,
    flash: reduced ? null : windowOf(startMs, event.startMs + rules.flashMs)
  };
}

/**
 * @description The crazy cat lady walking along the ground at a readable pace (contract § 8),
 *   hurling cats out of her bottomless handbag at the plan's moments and cackling after each
 *   throw. The cats themselves fly with their squirrels (stage-looks.js).
 * @param {Object} event - The cat lady event.
 * @param {Object} context - The overlay context.
 * @returns {Object|null} The descriptor, or null when she is off stage.
 * @since 1.0.0
 */
function catLadyOverlay(event, context) {
  const {timeline, raceMs} = context;
  const span = walkSpan(event);
  if (raceMs < span.startMs || raceMs >= span.endMs) {
    return null;
  }
  const rules = STAGE_TIMINGS.catLady;
  const throws = catThrows(event, timeline.tickMs);
  const rowed = walkerRowOf(timeline, event.id);
  // The throw pose holds a moment past the release, then she cackles.
  const releaseMs = 120;
  let pose = 'walk';
  if (throws.some((item) => (
    raceMs >= item.atMs - rules.throwPoseMs && raceMs < item.atMs + releaseMs
  ))) {
    pose = 'throw';
  } else if (throws.some((item) => (
    raceMs >= item.atMs + releaseMs && raceMs < item.atMs + releaseMs + rules.cackleMs
  ))) {
    pose = 'cackle';
  }
  return {
    key: event.id,
    type: 'catLady',
    layer: 'back',
    ...rowed,
    direction: walkDirection(event, rowed.row),
    walk: windowOf(span.startMs, span.endMs),
    pose
  };
}

/**
 * @description The UFO: glides in over its two squirrels, beams them up while they fly on the
 *   lane timeline (their outfits swap on the outfit timeline), drops them on each other's trees
 *   and zooms off up into the sky. Drawn in front of the squirrels, so a beamed squirrel is
 *   inside it.
 * @param {Object} event - The UFO event.
 * @param {Object} context - The overlay context.
 * @returns {Object|null} The descriptor, or null when it is off stage.
 * @since 1.0.0
 */
function ufoOverlay(event, context) {
  const {plan, raceMs} = context;
  const rules = STAGE_TIMINGS.ufo;
  const startMs = event.startMs - rules.leadMs;
  const endMs = event.endMs + rules.tailMs;
  const pair = event.entrants.filter((index) => Number.isInteger(index)).slice(0, 2);
  if (pair.length === 0 || raceMs < startMs || raceMs >= endMs) {
    return null;
  }
  const spots = pair.map((index) => targetAt(plan, index, event.startMs));
  const middle = spots.reduce((sum, spot) => sum + spot.lane - 1, 0) / spots.length;
  const entries = [];
  pair.forEach((index) => {
    (plan.entrants[index].laneTimeline || []).forEach((entry) => {
      if (entry.eventId === event.id) {
        entries.push(entry);
      }
    });
  });
  const span = event.endMs - event.startMs;
  const beamFrom = entries.length > 0
    ? Math.min(...entries.map((entry) => entry.flightStartMs))
    : event.startMs + span * 0.15;
  const beamTo = entries.length > 0
    ? Math.max(...entries.map((entry) => entry.flightEndMs))
    : event.endMs - span * 0.15;
  return {
    key: event.id,
    type: 'ufo',
    layer: 'front',
    middle: Math.round(middle * 100) / 100,
    height: Math.min(...spots.map((spot) => spot.height)),
    hover: windowOf(startMs, endMs),
    beam: raceMs >= beamFrom - 200 && raceMs < beamTo + 200
  };
}

/**
 * @description The woodpecker in its tiny hard hat (contract § 8): it flies in about a second
 *   early to the trunk just under its squirrel (above it near the ground), facing the trunk from
 *   the middle-of-the-field side, jackhammers it through the plan window, then perches a moment
 *   and flies off.
 * @param {Object} event - The woodpecker event.
 * @param {Object} context - The overlay context.
 * @returns {Object|null} The descriptor, or null when it is off stage.
 * @since 1.0.0
 */
function woodpeckerOverlay(event, context) {
  const {plan, raceMs} = context;
  const victim = event.entrants[0];
  if (!Number.isInteger(victim)) {
    return null;
  }
  const visit = trunkVisit(event);
  if (raceMs < visit.startMs || raceMs >= visit.endMs) {
    return null;
  }
  const {lane, height} = targetAt(plan, victim, event.startMs);
  const peckFrom = Math.max(
    visit.startMs + READABILITY.trunkFadeMs,
    event.startMs - STAGE_TIMINGS.woodpecker.peckLeadMs
  );
  const pecking = raceMs >= peckFrom && raceMs < event.endMs;
  return {
    key: event.id,
    type: 'woodpecker',
    layer: 'back',
    lane,
    height,
    side: trunkSide(lane, plan.entrants.length),
    // Below its squirrel on the trunk, unless the squirrel is too near the ground for that.
    perch: height >= 25 ? 'below' : 'above',
    pose: pecking ? 'peck' : 'idle',
    visit: envelopeOf(visit)
  };
}

/**
 * @description The leaf blower: a gardener strolls across the ground at a readable pace,
 *   blowing a gust over the whole field (leaves, then a pigeon, then his own toupee). The gust
 *   builds over a lead-in and fades over a tail (contract § 8). Two descriptors: the gardener on
 *   the back layer and the gust on the fx layer.
 * @param {Object} event - The leaf blower event.
 * @param {Object} context - The overlay context.
 * @returns {Object[]} The descriptors (none when he is off stage).
 * @since 1.0.0
 */
function leafBlowerOverlays(event, context) {
  const {timeline, raceMs} = context;
  const rules = STAGE_TIMINGS.leafBlower;
  const span = walkSpan(event);
  const gust = fieldWindow(event);
  const itemsEnd = event.endMs + rules.itemTailMs;
  const shownUntil = Math.max(span.endMs, itemsEnd);
  if (raceMs < span.startMs || raceMs >= shownUntil) {
    return [];
  }
  const rowed = walkerRowOf(timeline, event.id);
  const direction = walkDirection(event, rowed.row);
  const found = [];
  if (raceMs < span.endMs) {
    const blowing = raceMs >= gust.startMs && raceMs < event.endMs;
    const toupeeOff = raceMs >= event.startMs && spanShare(event, raceMs) >= rules.toupeeShare;
    let pose = blowing ? 'blow' : 'walk';
    if (toupeeOff) {
      pose = 'toupee-off';
    }
    found.push({
      key: event.id,
      type: 'gardener',
      layer: 'back',
      ...rowed,
      direction,
      walk: windowOf(span.startMs, span.endMs),
      pose
    });
  }
  if (raceMs >= gust.startMs && raceMs < Math.max(gust.endMs, itemsEnd)) {
    const length = event.endMs - event.startMs;
    const toupeeFrom = event.startMs + length * rules.toupeeShare;
    found.push({
      key: `${event.id}-gust`,
      type: 'gust',
      layer: 'fx',
      direction,
      range: envelopeOf(gust),
      pigeon: windowOf(event.startMs - READABILITY.fieldLeadMs / 2, itemsEnd),
      toupee: raceMs >= toupeeFrom ? windowOf(toupeeFrom, itemsEnd) : null
    });
  }
  return found;
}

/**
 * @description The earthquake's ground, behind the squirrels: the ground strip cracks open as the
 *   shaking builds, and a mole pops out of the crack just before the worst of it and sinks back
 *   after. The shake itself is on the field (sceneAt's quake, with its own lead-in and tail), and
 *   the trees wobble while shaking says so.
 * @param {Object} event - The earthquake event.
 * @param {Object} context - The overlay context.
 * @returns {Object|null} The descriptor, or null outside its window.
 * @since 1.0.0
 */
function earthquakeOverlay(event, context) {
  const {raceMs} = context;
  const rules = STAGE_TIMINGS.earthquake;
  const shake = fieldWindow(event);
  const moleFrom = event.startMs - rules.moleLeadMs;
  const endMs = event.endMs + rules.moleTailMs;
  if (raceMs < shake.startMs || raceMs >= endMs) {
    return null;
  }
  // Where along the ground the mole pops up, as a percentage of the field width.
  const moleAcross = Math.round((0.15 + seededUnit(event.id, 2) * 0.7) * 100);
  return {
    key: event.id,
    type: 'earthquake',
    layer: 'wash',
    shaking: raceMs >= event.startMs && raceMs < event.endMs,
    ground: windowOf(shake.startMs, endMs, fadeShares(shake.startMs, endMs, 0, rules.moleSinkMs)),
    crack: windowOf(shake.startMs, shake.startMs + rules.crackMs),
    mole: {
      across: moleAcross,
      ...windowOf(moleFrom, endMs, fadeShares(moleFrom, endMs, rules.molePopMs, rules.moleSinkMs))
    }
  };
}

/**
 * @description The flood, behind the squirrels: water rises from the bottom of the field to the
 *   waterline over the lead-in, holds through the plan window, then drains over the tail, with a
 *   lone rubber duck floating across while it is up.
 * @param {Object} event - The flood event.
 * @param {Object} context - The overlay context.
 * @returns {Object|null} The descriptor, or null outside its window.
 * @since 1.0.0
 */
function floodOverlay(event, context) {
  const {raceMs} = context;
  const water = fieldWindow(event);
  if (raceMs < water.startMs || raceMs >= water.endMs) {
    return null;
  }
  const units = Number.isFinite(event.data.waterHeightUnits) ? event.data.waterHeightUnits : 20;
  return {
    key: event.id,
    type: 'flood',
    layer: 'wash',
    units: Math.round(units * 10) / 10,
    range: envelopeOf(water),
    duck: windowOf(event.startMs, water.endMs)
  };
}

/**
 * @description The disco (contract § 4 and § 8): the mirror ball drops in and the lights come up
 *   over the lead-in, so the dancing starts under full lights; the purple wash is behind the
 *   squirrels and only the beams and the ball are in front, at low opacity. A beaver does the
 *   robot (its own cameo when no beaver is on stage). Two descriptors: the wash (and cameo) on
 *   the wash layer, the beams and ball on the fx layer.
 * @param {Object} event - The disco event.
 * @param {Object} context - The overlay context.
 * @returns {Object[]} The descriptors (none when it is over).
 * @since 1.0.0
 */
function discoOverlays(event, context) {
  const {timeline, raceMs} = context;
  const rules = STAGE_TIMINGS.disco;
  const lights = fieldWindow(event, rules.leadMs, rules.tailMs);
  if (raceMs < lights.startMs || raceMs >= lights.endMs) {
    return [];
  }
  const range = windowOf(
    lights.startMs,
    lights.endMs,
    fadeShares(lights.startMs, lights.endMs, rules.lightsUpMs, rules.tailMs)
  );
  const beaverOnStage = timeline.events.some((other) => {
    if (other.type !== 'beaver') {
      return false;
    }
    const visit = trunkVisit(other);
    return raceMs >= visit.startMs && raceMs < visit.endMs;
  });
  return [
    {
      key: `${event.id}-wash`,
      type: 'discoWash',
      layer: 'wash',
      range,
      cameo: !beaverOnStage
    },
    {
      key: event.id,
      type: 'disco',
      layer: 'fx',
      range,
      // The ball is in place before the lights are fully up.
      ball: windowOf(lights.startMs, lights.startMs + rules.dropMs),
      side: timeline.discoBallSide[event.id] || 'centre'
    }
  ];
}

/**
 * @description The acorn hail: nuts pelting down over the whole field, each at its own place,
 *   size and moment (seeded from the event, so a replay rains the same), building over a lead-in
 *   and easing off over a tail. The nuts keep clear of the leaderboard's side.
 * @param {Object} event - The acorn hail event.
 * @param {Object} context - The overlay context.
 * @returns {Object|null} The descriptor, or null when it is over.
 * @since 1.0.0
 */
function acornHailOverlay(event, context) {
  const {raceMs} = context;
  const rules = STAGE_TIMINGS.acornHail;
  const hail = fieldWindow(event);
  if (raceMs < hail.startMs || raceMs >= hail.endMs) {
    return null;
  }
  const nuts = Array.from({length: rules.nuts}, (_value, slot) => ({
    across: Math.round((0.03 + 0.88 * ((slot + seededUnit(event.id, slot)) / rules.nuts)) * 100),
    down: Math.round(seededUnit(event.id, slot + 40) * 80),
    delay: Math.round(seededUnit(event.id, slot + 80) * 900),
    size: Math.round((0.7 + seededUnit(event.id, slot + 120) * 0.6) * 100) / 100
  }));
  return {key: event.id, type: 'acornHail', layer: 'fx', nuts, range: envelopeOf(hail)};
}

/**
 * @description The VAR review: everyone frozen (the plan stalls them all), the owl referee blows
 *   the whistle, checks the monitor, shows the card; the lines are drawn, "checking", then the
 *   verdict, then play resumes. It builds over a lead-in and fades over a tail (contract § 8).
 *   Two descriptors: the veil behind the squirrels on the wash layer, and the review itself on
 *   the var layer.
 * @param {Object} event - The VAR event.
 * @param {Object} context - The overlay context.
 * @returns {Object[]} The descriptors (none outside the review).
 * @since 1.0.0
 */
function varOverlays(event, context) {
  const {raceMs} = context;
  const review = fieldWindow(event);
  if (raceMs < review.startMs || raceMs >= review.endMs) {
    return [];
  }
  const rules = STAGE_TIMINGS.var;
  const share = spanShare(event, raceMs);
  const span = event.endMs - event.startMs;
  let pose = 'card';
  if (share < rules.whistleShare) {
    pose = 'whistle';
  } else if (share < rules.monitorShare) {
    pose = 'monitor';
  }
  const linesFrom = event.startMs + span * rules.whistleShare * 0.5;
  return [
    {key: `${event.id}-veil`, type: 'varVeil', layer: 'wash', range: envelopeOf(review)},
    {
      key: event.id,
      type: 'var',
      layer: 'var',
      range: envelopeOf(review),
      lines: windowOf(linesFrom, linesFrom + span * rules.linesShare),
      pose,
      stage: share < rules.verdictShare ? 'checking' : 'verdict',
      verdict: typeof event.data.verdict === 'string' ? event.data.verdict : ''
    }
  ];
}

// One builder per event type: (event, context) => descriptor, descriptors or null.
const BUILDERS = Object.freeze({
  tornado: tornadoOverlay,
  hunter: hunterOverlay,
  suitor: suitorOverlay,
  beaver: beaverOverlay,
  lightning: lightningOverlay,
  catLady: catLadyOverlay,
  ufo: ufoOverlay,
  woodpecker: woodpeckerOverlay,
  leafBlower: leafBlowerOverlays,
  earthquake: earthquakeOverlay,
  flood: floodOverlay,
  disco: discoOverlays,
  acornHail: acornHailOverlay,
  var: varOverlays
});

/**
 * @description Every visitor and field-wide event on stage at a race time, in event order. Each
 *   descriptor has a key (unique), a type and a layer.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object} timeline - From prepareTimeline.
 * @param {number} raceMs - Race time.
 * @param {boolean} reduced - Reduced motion.
 * @returns {Object[]} Overlay descriptors.
 * @example
 *   overlaysAt(plan, timeline, vt, false).filter((overlay) => overlay.layer === 'fx');
 * @since 1.0.0
 */
export function overlaysAt(plan, timeline, raceMs, reduced) {
  const context = {plan, timeline, raceMs, reduced: reduced === true};
  return timeline.events.flatMap((event) => {
    const build = BUILDERS[event.type];
    if (!build) {
      return [];
    }
    const built = build(event, context);
    if (Array.isArray(built)) {
      return built;
    }
    return built ? [built] : [];
  });
}
