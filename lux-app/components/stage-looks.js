/**
 * How each squirrel looks at a moment of the race (SPEC.md § 10, § 11.9, Chaos v2 contract § 4
 * and § 6): its pose, the motion class on its body, the sprite effects it wears, the decorations
 * around it, which outfit it has on (outfit timeline), and whether it is hidden inside a trench
 * coat or wearing one.
 *
 * Events overlap in Chaos v2: a squirrel can have a cat on its back during an earthquake while a
 * disco starts. One event decides the pose and motion (the highest in POSE_RANK; a flight on the
 * lane timeline beats them all), every active event adds its effects (a clinging cat, chubby
 * cheeks), and every event in its own window adds its decorations (a cat flying in, the Golden
 * Acorn homing in, an eagle diving), so nothing that is happening is ever dropped.
 *
 * Pure ES module: no DOM, no Lit and no clock.
 */
import {heightAt, laneAt} from '../lib/choreography.js';
import {
  STAGE_TIMINGS,
  laneEntryAt,
  flightOf,
  outfitStepAt,
  seededUnit,
  walkDirection,
  walkerFraction,
  catThrows,
  indexList
} from './stage-shared.js';

/** Which active event decides a squirrel's pose: the highest wins. */
const POSE_RANK = Object.freeze({
  var: 100,
  trenchCoat: 95,
  ufo: 90,
  tornado: 88,
  hunter: 85,
  goldenAcorn: 84,
  lightning: 80,
  eagle: 78,
  suitor: 75,
  beaver: 72,
  woodpecker: 70,
  leafBlower: 64,
  disco: 62,
  catLady: 60,
  earthquake: 45,
  acornHail: 40,
  flood: 35,
  nutStop: 30,
  slip: 25,
  burst: 20
});

// Transient sprite effects, in the order the sprite receives them.
const TRANSIENT_EFFECTS = Object.freeze(['nutBubble', 'catClinging', 'chubby', 'vibrate']);
// Lasting marks, in the order the sprite receives them.
const LASTING_EFFECTS = Object.freeze(['sparkle', 'lipstick', 'redCheek', 'singed']);
// How long a cat takes to fall off once it is shaken loose.
const CAT_DROP_MS = 500;
// How long an earthquake's slip shakes the squirrel.
const QUAKE_SLIP_MS = 500;

/**
 * @description A decoration that plays over a race-time window. The stage writes its transform
 *   and opacity for each moment of the window (stage-scrubs.js), so its look is a function of
 *   race time too.
 * @param {string} kind - The decoration.
 * @param {number} startMs - Window start, race time.
 * @param {number} durationMs - Window length.
 * @param {Object} [extra] - Other descriptor fields (phase, fromX, fromY, withCat).
 * @returns {Object} The descriptor.
 * @since 1.0.0
 */
function decoration(kind, startMs, durationMs, extra = {}) {
  return {
    kind,
    startMs: Math.round(startMs),
    durationMs: Math.max(1, Math.round(durationMs)),
    ...extra
  };
}

/**
 * @description Builds a squirrel look.
 * @param {string} pose - The sprite pose.
 * @param {string} motion - The motion class on the squirrel's body.
 * @param {Object[]} [decor] - Decorations around the squirrel.
 * @param {string[]} [effects] - Sprite effects for this moment only.
 * @param {Object} [flags] - hidden, coat and homeLane, for the trench coat.
 * @returns {{pose: string, motion: string, effects: string[], decor: Object[]}} The look.
 * @since 1.0.0
 */
function lookOf(pose, motion, decor = [], effects = [], flags = {}) {
  return {pose, motion, effects, decor, ...flags};
}

/**
 * @description Dizzy stars for the rest of an event (the kit's dizzy pose draws its own; these
 *   stand in without the kit).
 * @param {Object} event - The event.
 * @returns {Object} The decoration.
 * @since 1.0.0
 */
function starsFor(event) {
  return decoration('stars', event.startMs, event.endMs - event.startMs);
}

/**
 * @description The combo kind an event takes part in, if any.
 * @param {Object} context - The look context.
 * @param {Object} event - The event.
 * @returns {string} The kind, or ''.
 * @since 1.0.0
 */
function comboKind(context, event) {
  const combo = context.timeline.combos[event.id];
  return combo ? combo.kind : '';
}

/**
 * @description The combo partner of an event, if any.
 * @param {Object} context - The look context.
 * @param {Object} event - The event.
 * @returns {Object|null} The partner event.
 * @since 1.0.0
 */
function comboPartner(context, event) {
  const combo = context.timeline.combos[event.id];
  return combo ? context.timeline.eventsById[combo.with] || null : null;
}

/**
 * @description Says whether the cat thrown at this squirrel is caught by an eagle on the way
 *   (the catVsEagle combo), so it never lands: the plan marks the throw intercepted, and an older
 *   plan says so only through the combo's eagle.
 * @param {Object} context - The look context.
 * @param {Object} catLady - The cat lady event.
 * @param {{intercepted: boolean}} thrown - The throw at this squirrel.
 * @returns {boolean} True when an eagle catches it.
 * @since 1.0.0
 */
function catIntercepted(context, catLady, thrown) {
  if (thrown.intercepted) {
    return true;
  }
  if (comboKind(context, catLady) !== 'catVsEagle' || Array.isArray(catLady.data.throws)) {
    return false;
  }
  const eagle = comboPartner(context, catLady);
  return Boolean(eagle && eagle.entrants.includes(context.entrantIndex));
}

/**
 * @description This squirrel's throw from a cat lady event, unless an eagle catches the cat.
 * @param {Object} context - The look context.
 * @param {Object} event - The cat lady event.
 * @returns {{atMs: number, entrant: number, clingTicks: number}|null} The throw.
 * @since 1.0.0
 */
function ownThrow(context, event) {
  const thrown = catThrows(event, context.tickMs)
    .find((item) => item.entrant === context.entrantIndex) || null;
  return thrown && !catIntercepted(context, event, thrown) ? thrown : null;
}

/**
 * @description This squirrel's lane-timeline entries for one event, in time order.
 * @param {Object} context - The look context.
 * @param {string} eventId - The event.
 * @returns {Object[]} The entries.
 * @since 1.0.0
 */
function ownEntries(context, eventId) {
  const entries = context.plan.entrants[context.entrantIndex].laneTimeline || [];
  return entries
    .filter((entry) => entry.eventId === eventId)
    .sort((left, right) => left.flightStartMs - right.flightStartMs);
}

/**
 * @description The hunter's look on his target: a tumble and smoke on a hit, a smug climb on a
 *   miss, nothing at all when he is aiming at a tornado (hunterVsTornado).
 * @param {Object} event - The hunter event.
 * @param {number} raceMs - Race time.
 * @param {Object} context - The look context.
 * @returns {Object|null} The look.
 * @since 1.0.0
 */
function hunterLook(event, raceMs, context) {
  if (comboKind(context, event) === 'hunterVsTornado') {
    return null;
  }
  if (event.outcome !== 'hit') {
    return lookOf('climb', 'climb');
  }
  const smoke = decoration('smoke', event.startMs, STAGE_TIMINGS.hit.smokeMs);
  if (raceMs < event.startMs + STAGE_TIMINGS.hit.stunnedMs) {
    return lookOf('stunned', 'tumble', [smoke]);
  }
  return lookOf('dizzy', 'still', [smoke, starsFor(event)]);
}

/**
 * @description The suitor's date: leaning in, then a kiss and hearts or a slap and a sulk.
 * @param {Object} event - The suitor event.
 * @param {number} raceMs - Race time.
 * @returns {Object} The look.
 * @since 1.0.0
 */
function suitorLook(event, raceMs) {
  const rules = STAGE_TIMINGS.suitor;
  const span = event.endMs - event.startMs;
  const share = (raceMs - event.startMs) / Math.max(1, span);
  if (event.outcome === 'slap') {
    if (share < rules.slapShare) {
      return lookOf('kiss', 'lean');
    }
    const slapAt = event.startMs + span * rules.slapShare;
    return lookOf('sulk', 'still', [decoration('slap', slapAt, STAGE_TIMINGS.slap.popMs)]);
  }
  if (share < rules.leanShare) {
    return lookOf('kiss', 'lean');
  }
  const kissAt = event.startMs + span * rules.leanShare;
  const hearts = decoration('hearts', kissAt, event.endMs - kissAt);
  if (share < rules.kissEndShare) {
    const kissMark = decoration('kiss', kissAt, STAGE_TIMINGS.kiss.popMs);
    return lookOf('kiss', 'lean', [hearts, kissMark]);
  }
  return lookOf('climb', 'shake', [hearts]);
}

/**
 * @description A cat clinging to the squirrel's back while it climbs at a crawl, until it shakes
 *   the cat off.
 * @param {Object} event - The cat lady event.
 * @param {number} raceMs - Race time.
 * @param {Object} context - The look context.
 * @returns {Object|null} The look, or null outside this squirrel's cling.
 * @since 1.0.0
 */
function catLadyLook(event, raceMs, context) {
  const thrown = ownThrow(context, event);
  if (!thrown) {
    return null;
  }
  const clingEnd = thrown.atMs + thrown.clingTicks * context.tickMs;
  if (raceMs >= thrown.atMs && raceMs < clingEnd) {
    return lookOf('climb', 'cling-cat', [], ['catClinging']);
  }
  return null;
}

/**
 * @description The Golden Acorn of Doom's victim: smacked off balance, then dizzy.
 * @param {Object} event - The golden acorn event.
 * @param {number} raceMs - Race time.
 * @returns {Object|null} The look, or null before the impact.
 * @since 1.0.0
 */
function goldenAcornLook(event, raceMs) {
  const impact = Number.isFinite(event.data.impactMs) ? event.data.impactMs : event.startMs;
  if (raceMs < impact) {
    return null;
  }
  if (raceMs < impact + STAGE_TIMINGS.goldenAcorn.stunnedMs) {
    return lookOf('stunned', 'tumble');
  }
  return lookOf('dizzy', 'still', [starsFor(event)]);
}

/**
 * @description A UFO's passenger outside its flight: frozen in the beam before, dazed after.
 * @param {Object} event - The UFO event.
 * @param {number} raceMs - Race time.
 * @param {Object} context - The look context.
 * @returns {Object} The look.
 * @since 1.0.0
 */
function ufoLook(event, raceMs, context) {
  const entries = ownEntries(context, event.id);
  const landed = entries.length > 0 && raceMs >= entries[entries.length - 1].flightEndMs;
  return landed ? lookOf('dizzy', 'still', [starsFor(event)]) : lookOf('stunned', 'beamed');
}

/**
 * @description The earthquake: everyone bounces, and the listed squirrels slip.
 * @param {Object} event - The earthquake event.
 * @param {number} raceMs - Race time.
 * @param {Object} context - The look context.
 * @returns {Object} The look.
 * @since 1.0.0
 */
function earthquakeLook(event, raceMs, context) {
  const slipping = indexList(event.data.slips).includes(context.entrantIndex);
  if (slipping && raceMs < event.startMs + QUAKE_SLIP_MS) {
    return lookOf('dizzy', 'shake');
  }
  return lookOf('climb', 'quake');
}

/**
 * @description The flood: once the water is up, a squirrel still below the waterline (the plan's
 *   bursters) shoots up the trunk for a few ticks.
 * @param {Object} event - The flood event.
 * @param {number} raceMs - Race time.
 * @param {Object} context - The look context.
 * @returns {Object|null} The look, or null for a squirrel above the water.
 * @since 1.0.0
 */
function floodLook(event, raceMs, context) {
  const rules = STAGE_TIMINGS.flood;
  let bursting = indexList(event.data.bursters).includes(context.entrantIndex);
  if (!Array.isArray(event.data.bursters)) {
    // An older plan names nobody: everyone below the waterline at the start bursts.
    const level = Number.isFinite(event.data.waterHeightUnits) ? event.data.waterHeightUnits : 20;
    bursting = heightAt(context.plan, context.entrantIndex, event.startMs) < level;
  }
  const burstFrom = event.startMs + rules.burstDelayTicks * context.tickMs;
  const burstTo = burstFrom + rules.burstTicks * context.tickMs;
  return bursting && raceMs >= burstFrom && raceMs < burstTo ? lookOf('climb', 'burst') : null;
}

/**
 * @description The hailstorm: a listed squirrel stuffs its cheeks and climbs on, slowly.
 * @param {Object} event - The acorn hail event.
 * @param {number} raceMs - Race time.
 * @param {Object} context - The look context.
 * @returns {Object|null} The look, or null for a squirrel not listed.
 * @since 1.0.0
 */
function acornHailLook(event, raceMs, context) {
  if (!indexList(event.data.chubby).includes(context.entrantIndex)) {
    return null;
  }
  const slowEnd = event.startMs + (event.data.slowTicks || 4) * context.tickMs;
  return raceMs < slowEnd ? lookOf('climb', 'climb', [], ['chubby']) : null;
}

/**
 * @description The trench coat: the host wears it on the middle tree, the other two vanish inside
 *   it, then all three are dazed after toppling apart.
 * @param {Object} event - The trench coat event.
 * @param {number} raceMs - Race time.
 * @param {Object} context - The look context.
 * @returns {Object} The look.
 * @since 1.0.0
 */
function trenchCoatLook(event, raceMs, context) {
  const disguise = context.timeline.disguises[event.id];
  if (!disguise) {
    return lookOf('idle', 'still');
  }
  if (raceMs >= disguise.startMs && raceMs < disguise.endMs) {
    if (disguise.host === context.entrantIndex) {
      // The host's head is out of the collar; the other two peek out lower down.
      const others = event.entrants.filter((index) => index !== disguise.host);
      return lookOf('idle', 'still', [], [], {coat: true, coatHeads: [disguise.host, ...others]});
    }
    const homeLane = disguise.homeLanes[context.entrantIndex];
    return lookOf('idle', 'still', [], [], {hidden: true, homeLane});
  }
  return raceMs >= disguise.endMs
    ? lookOf('dizzy', 'still', [starsFor(event)])
    : lookOf('idle', 'still');
}

// One look per event type: (event, raceMs, context) => look, or null for "nothing this moment".
const LOOKS = Object.freeze({
  nutStop: () => lookOf('idle', 'still', [], ['nutBubble']),
  slip: (event, raceMs) => (
    raceMs < event.startMs + STAGE_TIMINGS.slip.shakeMs
      ? lookOf('dizzy', 'shake')
      : lookOf('climb', 'climb')
  ),
  burst: () => lookOf('climb', 'burst'),
  // A tornado's flight is drawn from the lane timeline; after it, the squirrel is dizzy.
  tornado: (event) => lookOf('dizzy', 'still', [starsFor(event)]),
  hunter: hunterLook,
  suitor: suitorLook,
  eagle: (event, raceMs, context) => (
    comboKind(context, event) === 'catVsEagle' ? null : lookOf('fly', 'still')
  ),
  beaver: () => lookOf('idle', 'cling'),
  lightning: (event) => lookOf('stunned', 'still', [
    decoration('zap', event.startMs, event.endMs - event.startMs)
  ]),
  catLady: catLadyLook,
  goldenAcorn: goldenAcornLook,
  leafBlower: () => lookOf('flag', 'flag'),
  ufo: ufoLook,
  earthquake: earthquakeLook,
  flood: floodLook,
  disco: () => lookOf('dance', 'still'),
  acornHail: acornHailLook,
  var: () => lookOf('idle', 'still'),
  trenchCoat: trenchCoatLook,
  woodpecker: () => lookOf('idle', 'vibrate', [], ['vibrate'])
});

/**
 * @description An event's rank for deciding the pose (a hunter's miss barely counts).
 * @param {Object} event - The event.
 * @returns {number} The rank.
 * @since 1.0.0
 */
function rankOf(event) {
  if (event.type === 'hunter' && event.outcome !== 'hit') {
    return 10;
  }
  return POSE_RANK[event.type] ?? 15;
}

/**
 * @description How a squirrel looks while it flies on the lane timeline: spinning in a tornado,
 *   floating in a UFO's beam, toppling out of a trench coat, or just flying.
 * @param {Object} timeline - From prepareTimeline.
 * @param {Object} entry - The lane-timeline entry.
 * @returns {Object} The look.
 * @since 1.0.0
 */
function flightLook(timeline, entry) {
  const {kind} = flightOf(timeline, entry);
  if (kind === 'tornado') {
    return lookOf('fly', 'spin');
  }
  if (kind === 'ufo') {
    return lookOf('fly', 'beamed');
  }
  return kind === 'hop' ? lookOf('stunned', 'tumble') : lookOf('fly', 'still');
}

/**
 * @description The marks a squirrel carries for the rest of the race once an event has left
 *   them: lipstick after a kiss, a red cheek after a slap, soot after a hit or lightning, and the
 *   legendary sparkle from the start.
 * @param {Object[]} events - The squirrel's events.
 * @param {number} raceMs - Race time.
 * @param {boolean} legendary - Wears a legendary item.
 * @returns {Set<string>} The marks.
 * @since 1.0.0
 */
function lastingEffects(events, raceMs, legendary) {
  const rules = STAGE_TIMINGS.suitor;
  const effects = new Set();
  if (legendary) {
    effects.add('sparkle');
  }
  events.forEach((event) => {
    const span = event.endMs - event.startMs;
    if (event.type === 'suitor' && event.outcome === 'kiss'
      && raceMs >= event.startMs + span * rules.leanShare) {
      effects.add('lipstick');
    }
    if (event.type === 'suitor' && event.outcome === 'slap'
      && raceMs >= event.startMs + span * rules.slapShare) {
      effects.add('redCheek');
    }
    const shot = event.type === 'hunter' && event.outcome === 'hit';
    if ((shot || event.type === 'lightning') && raceMs >= event.startMs) {
      effects.add('singed');
    }
  });
  return effects;
}

/**
 * @description The eagle around its squirrel: diving in, carrying (unless it caught a cat
 *   instead, catVsEagle, or drops the squirrel into a tornado, eagleIntoFunnel), then flying off.
 *   The fly-off stretches so the whole visit lasts at least STAGE_TIMINGS.eagle.minVisitMs
 *   (Chaos v2 contract § 8).
 * @param {Object} event - The eagle event.
 * @param {number} raceMs - Race time.
 * @param {Object} context - The look context.
 * @returns {Object|null} The decoration.
 * @since 1.0.0
 */
function eagleDecoration(event, raceMs, context) {
  const rules = STAGE_TIMINGS.eagle;
  const kind = comboKind(context, event);
  const withCat = kind === 'catVsEagle';
  // With a cat in its talons it never carries the squirrel: it turns away at once.
  let releaseMs = withCat ? event.startMs : event.endMs;
  if (kind === 'eagleIntoFunnel') {
    const entries = context.plan.entrants[context.entrantIndex].laneTimeline || [];
    // The funnel arrives as the carry ends, so the drop starts at or just before the end.
    const drop = entries.find((entry) => (
      entry.flightStartMs >= event.startMs - rules.leadMs
      && entry.flightStartMs <= event.endMs
      && flightOf(context.timeline, entry).kind === 'tornado'
    ));
    releaseMs = drop ? drop.flightStartMs : event.endMs;
  }
  const diveFrom = event.startMs - rules.leadMs;
  const awayMs = Math.max(
    rules.tailMs,
    rules.minVisitMs - rules.leadMs - Math.max(0, releaseMs - event.startMs)
  );
  if (raceMs < diveFrom || raceMs >= releaseMs + awayMs) {
    return null;
  }
  if (raceMs < event.startMs) {
    return decoration('eagle', diveFrom, rules.leadMs, {phase: 'dive', withCat});
  }
  if (raceMs < releaseMs) {
    return decoration('eagle', event.startMs, releaseMs - event.startMs, {phase: 'carry'});
  }
  return decoration('eagle', releaseMs, awayMs, {phase: 'away', withCat});
}

/**
 * @description Where the cat lady is, relative to the squirrel she throws at, when she throws:
 *   the flying cat starts there (lanes across, climb shares down).
 * @param {Object} event - The cat lady event.
 * @param {{atMs: number}} thrown - The throw.
 * @param {Object} context - The look context.
 * @returns {{fromX: number, fromY: number}} The offset.
 * @since 1.0.0
 */
function throwOrigin(event, thrown, context) {
  const row = context.timeline.walkerRows[event.id] || 0;
  const fraction = walkerFraction(event, thrown.atMs, walkDirection(event, row));
  const lane = laneAt(context.plan, context.entrantIndex, thrown.atMs).lane;
  const height = heightAt(context.plan, context.entrantIndex, thrown.atMs);
  return {
    fromX: Math.round((fraction * context.timeline.count - 0.5 - (lane - 1)) * 100) / 100,
    fromY: Math.round((height / 100 + 0.1) * 100) / 100
  };
}

/**
 * @description The decorations a squirrel's events add in their own windows, which reach outside
 *   the events' spans: the eagle, a thrown cat flying in and dropping off, the Golden Acorn
 *   homing in and looping in triumph, and the nut that's too big.
 * @param {Object[]} events - The squirrel's events.
 * @param {number} raceMs - Race time.
 * @param {Object} context - The look context.
 * @returns {Object[]} The decorations.
 * @since 1.0.0
 */
function windowDecorations(events, raceMs, context) {
  const found = [];
  events.forEach((event) => {
    if (event.type === 'eagle') {
      const eagle = eagleDecoration(event, raceMs, context);
      if (eagle) {
        found.push(eagle);
      }
    }
    if (event.type === 'catLady') {
      const thrown = ownThrow(context, event);
      const flightMs = STAGE_TIMINGS.catLady.catFlightMs;
      if (thrown && raceMs >= thrown.atMs - flightMs && raceMs < thrown.atMs) {
        const origin = throwOrigin(event, thrown, context);
        found.push(decoration('cat', thrown.atMs - flightMs, flightMs, {phase: 'fly', ...origin}));
      }
      const clingEnd = thrown ? thrown.atMs + thrown.clingTicks * context.tickMs : 0;
      if (thrown && raceMs >= clingEnd && raceMs < clingEnd + CAT_DROP_MS) {
        found.push(decoration('cat', clingEnd, CAT_DROP_MS, {phase: 'drop'}));
      }
    }
    if (event.type === 'goldenAcorn') {
      const rules = STAGE_TIMINGS.goldenAcorn;
      const impact = Number.isFinite(event.data.impactMs) ? event.data.impactMs : event.startMs;
      if (raceMs >= impact - rules.homeMs && raceMs < impact) {
        const lane = laneAt(context.plan, context.entrantIndex, impact).lane;
        const fromLane = Number.isInteger(event.data.fromLane) ? event.data.fromLane : lane;
        const height = heightAt(context.plan, context.entrantIndex, impact);
        found.push(decoration('acorn', impact - rules.homeMs, rules.homeMs, {
          phase: 'home',
          fromX: fromLane - lane,
          fromY: -Math.round(((100 - height) / 100 + 0.25) * 100) / 100
        }));
      } else if (raceMs >= impact && raceMs < impact + rules.loopMs) {
        found.push(decoration('acorn', impact, rules.loopMs, {phase: 'loop'}));
      }
    }
    if (event.type === 'acornHail') {
      const chubby = indexList(event.data.chubby);
      const chosen = Number.isInteger(event.data.bigNut)
        ? event.data.bigNut
        : chubby[Math.floor(seededUnit(event.id, 1) * chubby.length)];
      const slowEnd = event.startMs + (event.data.slowTicks || 4) * context.tickMs;
      if (chosen === context.entrantIndex && raceMs >= event.startMs && raceMs < slowEnd) {
        found.push(decoration('big-nut', event.startMs, slowEnd - event.startMs));
      }
    }
  });
  return found;
}

/**
 * @description How one squirrel looks at a race time: pose, motion, sprite effects, decorations,
 *   the outfit-timeline step it wears, whether it is hidden in or wearing a trench coat, and
 *   whether it has finished (SPEC.md § 10, § 11.9; Chaos v2 contract § 3 and § 4).
 * @param {Object} plan - From buildRacePlan.
 * @param {Object} timeline - From prepareTimeline.
 * @param {number} entrantIndex - The squirrel.
 * @param {number} raceMs - Race time.
 * @param {{legendary?: boolean}} [options] - Wears a legendary item.
 * @returns {{pose: string, motion: string, effects: string[], decor: Object[],
 *   finished: boolean, position: number, tree: number, outfitStep: number, hidden: boolean,
 *   coat: boolean, coatHeads: number[]}} The look (tree is the squirrel's own tree while it
 *   hides in a coat; coatHeads lists who is in the coat the host wears, top first).
 * @example
 *   const look = racerLook(plan, timeline, 0, vt, {legendary: true});
 * @since 1.0.0
 */
export function racerLook(plan, timeline, entrantIndex, raceMs, options = {}) {
  const entrant = plan.entrants[entrantIndex];
  const events = timeline.eventsByEntrant[entrantIndex];
  const context = {plan, timeline, entrantIndex, tickMs: timeline.tickMs};
  const effects = lastingEffects(events, raceMs, options.legendary === true);
  const base = {
    finished: false,
    position: entrant.position,
    tree: laneAt(plan, entrantIndex, raceMs).lane,
    outfitStep: outfitStepAt(plan, entrantIndex, raceMs),
    hidden: false,
    coat: false,
    coatHeads: []
  };
  const lasting = LASTING_EFFECTS.filter((effect) => effects.has(effect));
  if (raceMs >= entrant.finishMs) {
    return {...base, pose: 'cheer', motion: 'still', effects: lasting, decor: [], finished: true};
  }
  if (raceMs <= 0) {
    return {...base, pose: 'idle', motion: 'still', effects: lasting, decor: []};
  }
  const looks = events
    .filter((event) => event.startMs <= raceMs && raceMs < event.endMs)
    .map((event) => {
      const describe = LOOKS[event.type];
      return {event, look: describe ? describe(event, raceMs, context) : null};
    })
    .filter((item) => item.look)
    .sort((left, right) => rankOf(right.event) - rankOf(left.event));
  const entry = laneEntryAt(plan, entrantIndex, raceMs);
  let primary = lookOf('climb', 'climb');
  if (entry) {
    primary = flightLook(timeline, entry);
  } else if (looks.length > 0) {
    primary = looks[0].look;
  }
  looks.forEach(({look}) => look.effects.forEach((effect) => effects.add(effect)));
  const decor = [];
  const seen = new Set();
  primary.decor.concat(windowDecorations(events, raceMs, context)).forEach((item) => {
    const key = `${item.kind}:${item.phase || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      decor.push(item);
    }
  });
  const hiding = looks.find(({look}) => look.hidden);
  const hosting = looks.find(({look}) => look.coat);
  return {
    ...base,
    pose: primary.pose,
    motion: primary.motion,
    effects: lasting.concat(TRANSIENT_EFFECTS.filter((effect) => effects.has(effect))),
    decor,
    tree: hiding && Number.isInteger(hiding.look.homeLane) ? hiding.look.homeLane : base.tree,
    hidden: Boolean(hiding),
    coat: Boolean(hosting),
    coatHeads: hosting ? hosting.look.coatHeads : []
  };
}
