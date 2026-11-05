/**
 * Which sound plays for which race event, phase and cue (Chaos v2 contract § 9, event types from
 * § 4). Pure data and pure functions: the engine (engine.js) plays what this module plans, and
 * tests/audio-map.test.js checks that every § 4 type and every cue has a sound.
 *
 * Phases. The stage calls audio.event(event, 'start') when the race clock passes event.startMs,
 * the plan's action moment (the shot, the strike, the first throw). A start plans the whole
 * event's sound, timing the later moments inside it from the event's own data: the shark's chomp
 * halfway through the flight, each cat landing, the flood burst, the VAR verdict, the trench
 * coat's topple. 'impact' and 'end' are accepted too. Every planned sound carries a part name,
 * and the engine plays each part of an event at most once, so a stage that also calls 'impact'
 * or 'end' never doubles a sound, and one that never calls them misses nothing.
 *
 * Both event shapes are read: the Chaos v2 one ({entrants, data}) and the earlier one
 * ({entrantIndexes, details}), like stage-shared.js normaliseEvent().
 *
 * Cues. The stage's five race cues always play (they count towards the throttle). Since 2.2.0
 * the owl commentator's 'hoot' (contract § 12, at the opening and the winner line) is a
 * throttled cue: it goes through the throttle like an event, with its own gap (CUE_GAP_MS), so
 * it is dropped rather than piled on when three sounds are already playing.
 *
 * Pure ES module: no DOM, no Web Audio and no globals.
 */

/** Every event type with a sound: the § 4 catalogue, Chaos then Classic. */
export const EVENT_TYPES = Object.freeze([
  'tornado', 'hunter', 'suitor', 'eagle', 'beaver', 'lightning',
  'catLady', 'goldenAcorn', 'leafBlower', 'ufo', 'earthquake', 'flood', 'disco', 'acornHail',
  'var', 'trenchCoat', 'woodpecker',
  'nutStop', 'slip', 'burst'
]);

/** The stage's cues (contract § 9 API), and the owl commentator's hoot (§ 12, since 2.2.0). */
export const CUE_NAMES = Object.freeze([
  'go', 'lastStretch', 'finaleBurst', 'photoFinish', 'finish', 'hoot'
]);

/** The phases audio.event() accepts. */
export const EVENT_PHASES = Object.freeze(['start', 'impact', 'end']);

/**
 * Minimum gap between two starts of the same event type, in milliseconds, so a busy Absolute
 * Carnage race stays fun rather than noise. Long, field-wide sounds get the longest gaps.
 */
export const MIN_GAP_MS = Object.freeze({
  tornado: 1500,
  hunter: 350,
  suitor: 400,
  eagle: 600,
  beaver: 500,
  lightning: 700,
  catLady: 800,
  goldenAcorn: 800,
  leafBlower: 1500,
  ufo: 1200,
  earthquake: 1500,
  flood: 1200,
  disco: 1500,
  acornHail: 1200,
  var: 1500,
  trenchCoat: 1000,
  woodpecker: 500,
  nutStop: 250,
  slip: 250,
  burst: 250
});

/**
 * Minimum gap between two plays of a throttled cue, in milliseconds (since 2.2.0). Kept apart
 * from MIN_GAP_MS, which lists exactly the § 4 event types.
 */
export const CUE_GAP_MS = Object.freeze({
  hoot: 1500
});

/** Minimum gap between two 'impact' (or two 'end') sounds of the same type. */
export const FOLLOW_UP_GAP_MS = 120;

/** Minimum gap for a key with no entry above. */
export const DEFAULT_GAP_MS = 250;

/** A planned sound never starts more than this long after its call. */
const MAX_OFFSET_MS = 8000;

/**
 * Moments inside an event, mirrored from the stage's timings (stage-shared.js STAGE_TIMINGS) and
 * the plan (lib/theme-config.js) so a sound lands with the picture.
 */
const TIMING = Object.freeze({
  tickMs: 250,
  // The hunter's BLAM lasts this long; with hunterVsTornado the cow flies back over the next 700.
  hunterBlamMs: 350,
  hunterCowMs: 700,
  missBoingMs: 160,
  // Shares of the suitor's stall: the kiss after the lean-in, the slap landing.
  kissShare: 0.3,
  slapShare: 0.4,
  // Shares of the tornado's flight: the cow tumbling past, the shark's chomp (halfway, as in
  // chaos-tornado.js).
  cowShare: 0.3,
  chompShare: 0.5,
  // The flight when the event does not say (theme-config chaosDeck.tornado.flightMs).
  flightMs: 2500,
  acornWhistleMs: 280,
  eagleCatchMs: 320,
  // Shares of the VAR stall: the sting after the whistle, the verdict.
  stingShare: 0.2,
  verdictShare: 0.7,
  // The trench coat topples this share of the way through when disguiseTicks is missing.
  toppleShare: 0.75
});

const EMPTY_PLAN = Object.freeze({
  id: '',
  type: '',
  throttleKey: '',
  sounds: Object.freeze([]),
  music: Object.freeze([])
});

/**
 * @description Says whether a value is a plain object (not null, not an array).
 * @param {*} value - Anything.
 * @returns {boolean} True for objects.
 * @since 1.0.0
 */
function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @description A finite number, or a fallback.
 * @param {*} value - Anything.
 * @param {number} fallback - Used when value is not a finite number.
 * @returns {number} The number.
 * @since 1.0.0
 */
function finiteOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/**
 * @description The id the engine keys an event's sounds by: the plan id, or type and start time
 *   for an event without one (the same fallback as stage-shared.js normaliseEvent()).
 * @param {Object} raceEvent - A plan event.
 * @returns {string} The id ('' for something that is not an event).
 * @example
 *   eventIdOf({id: 'evt-4', type: 'ufo', startMs: 9000});
 *   // 'evt-4'
 * @since 1.0.0
 */
export function eventIdOf(raceEvent) {
  if (!isObject(raceEvent) || typeof raceEvent.type !== 'string') {
    return '';
  }
  if (raceEvent.id !== undefined && raceEvent.id !== null) {
    return String(raceEvent.id);
  }
  return `${raceEvent.type}-${finiteOr(raceEvent.startMs, 0)}`;
}

/**
 * @description Reads either event shape into what the sound builders need.
 * @param {*} raceEvent - A plan event, or anything.
 * @returns {{id: string, type: string, outcome: (string|null), startMs: number, spanMs: number,
 *   data: Object, comboKind: string}|null} The event, or null when it is not one.
 * @since 1.0.0
 */
function readEvent(raceEvent) {
  if (!isObject(raceEvent) || typeof raceEvent.type !== 'string') {
    return null;
  }
  const data = {
    ...(isObject(raceEvent.details) ? raceEvent.details : {}),
    ...(isObject(raceEvent.data) ? raceEvent.data : {})
  };
  let combo = null;
  if (isObject(raceEvent.combo)) {
    combo = raceEvent.combo;
  } else if (isObject(data.combo)) {
    combo = data.combo;
  }
  const startMs = finiteOr(raceEvent.startMs, 0);
  const endMs = Math.max(startMs, finiteOr(raceEvent.endMs, startMs));
  return {
    id: eventIdOf(raceEvent),
    type: raceEvent.type,
    outcome: typeof raceEvent.outcome === 'string' ? raceEvent.outcome : null,
    startMs,
    spanMs: endMs - startMs,
    data,
    comboKind: combo && typeof combo.kind === 'string' ? combo.kind : ''
  };
}

/**
 * @description One planned sound.
 * @param {string} effect - An SFX_LIBRARY id (sfx.js).
 * @param {number} atMs - Delay after the call, in milliseconds (clamped to 0..8000).
 * @param {string} part - The part name the engine plays once per event.
 * @returns {{effect: string, atMs: number, part: string}} The sound.
 * @since 1.0.0
 */
function sound(effect, atMs, part) {
  const delay = Math.round(finiteOr(atMs, 0));
  return {effect, atMs: Math.min(MAX_OFFSET_MS, Math.max(0, delay)), part};
}

/**
 * @description How long a tornado's flight lasts (its flightEndMs, else the theme's 2.5 s).
 * @param {Object} shape - From readEvent().
 * @returns {number} Milliseconds.
 * @since 1.0.0
 */
function flightOf(shape) {
  const flightEndMs = finiteOr(shape.data.flightEndMs, NaN);
  return flightEndMs > shape.startMs ? flightEndMs - shape.startMs : TIMING.flightMs;
}

/**
 * @description The tornado: the wind, the cow tumbling in the funnel, and with sharks a chomp
 *   halfway through the flight (when the hat comes off).
 * @param {Object} shape - From readEvent().
 * @returns {Array<Object>} The sounds.
 * @since 1.0.0
 */
function tornadoStart(shape) {
  const flight = flightOf(shape);
  const sounds = [
    sound('windWhoosh', 0, 'wind'),
    sound('cowWarble', flight * TIMING.cowShare, 'cow')
  ];
  if (shape.data.sharks === true) {
    sounds.push(sound('sharkChomp', flight * TIMING.chompShare, 'chomp'));
  }
  return sounds;
}

/**
 * @description The hunter: the pop, then a boing on a miss. Against a tornado
 *   (hunterVsTornado) the cow comes back with its warble and he lands flat with the boing.
 * @param {Object} shape - From readEvent().
 * @returns {Array<Object>} The sounds.
 * @since 1.0.0
 */
function hunterStart(shape) {
  const sounds = [sound('popGun', 0, 'pop')];
  if (shape.comboKind === 'hunterVsTornado') {
    sounds.push(sound('cowWarble', TIMING.hunterBlamMs, 'cow'));
    sounds.push(sound('boing', TIMING.hunterBlamMs + TIMING.hunterCowMs, 'boing'));
  } else if (shape.outcome === 'miss') {
    sounds.push(sound('boing', TIMING.missBoingMs, 'boing'));
  }
  return sounds;
}

/**
 * @description The suitor: a "mwah" after the lean-in on a kiss, a crack when the slap lands.
 * @param {Object} shape - From readEvent().
 * @param {boolean} delayed - True from 'start' (wait for the moment in the stall); false from
 *   'impact' (the moment is now).
 * @returns {Array<Object>} The sounds.
 * @since 1.0.0
 */
function suitorSounds(shape, delayed) {
  if (shape.outcome === 'slap') {
    return [sound('slapCrack', delayed ? shape.spanMs * TIMING.slapShare : 0, 'slap')];
  }
  return [sound('smooch', delayed ? shape.spanMs * TIMING.kissShare : 0, 'kiss')];
}

/**
 * @description The eagle's screech; catching a thrown cat (catVsEagle) adds a puzzled meow.
 * @param {Object} shape - From readEvent().
 * @returns {Array<Object>} The sounds.
 * @since 1.0.0
 */
function eagleStart(shape) {
  const sounds = [sound('eagleScreech', 0, 'screech')];
  if (shape.comboKind === 'catVsEagle' || shape.data.caught === 'cat') {
    sounds.push(sound('meowSweep', TIMING.eagleCatchMs, 'caught'));
  }
  return sounds;
}

/**
 * @description The cat lady: her cackle, then a meow as each cat lands (data.throws[].atMs).
 * @param {Object} shape - From readEvent().
 * @returns {Array<Object>} The sounds.
 * @since 1.0.0
 */
function catLadyStart(shape) {
  const throws = Array.isArray(shape.data.throws) ? shape.data.throws : [];
  const meows = throws.map((thrown, order) => {
    const landsAtMs = finiteOr(isObject(thrown) ? thrown.atMs : NaN, shape.startMs);
    return sound('meowSweep', landsAtMs - shape.startMs, `meow-${order}`);
  });
  return [sound('cackle', 0, 'cackle')].concat(meows);
}

/**
 * @description The Golden Acorn: the whistle, then the bonk on impact (its impactMs is the start
 *   in today's plans, so the bonk follows the whistle).
 * @param {Object} shape - From readEvent().
 * @returns {Array<Object>} The sounds.
 * @since 1.0.0
 */
function goldenAcornStart(shape) {
  const impactMs = finiteOr(shape.data.impactMs, shape.startMs);
  return [
    sound('acornWhistle', 0, 'whistle'),
    sound('bonk', TIMING.acornWhistleMs + Math.max(0, impactMs - shape.startMs), 'bonk')
  ];
}

/**
 * @description The flood: bubbles, and a burst when squirrels below the waterline shoot up.
 * @param {Object} shape - From readEvent().
 * @returns {Array<Object>} The sounds.
 * @since 1.0.0
 */
function floodStart(shape) {
  const sounds = [sound('bubbles', 0, 'bubbles')];
  const bursters = Array.isArray(shape.data.bursters) ? shape.data.bursters : [];
  if (bursters.length > 0) {
    const burstAtMs = finiteOr(shape.data.burstAtMs, shape.startMs + TIMING.tickMs * 2);
    sounds.push(sound('bubbleBurst', burstAtMs - shape.startMs, 'burst'));
  }
  return sounds;
}

/**
 * @description VAR: the referee's whistle, the suspense sting, then the verdict ding.
 * @param {Object} shape - From readEvent().
 * @returns {Array<Object>} The sounds.
 * @since 1.0.0
 */
function varStart(shape) {
  return [
    sound('refWhistle', 0, 'whistle'),
    sound('suspenseSting', shape.spanMs * TIMING.stingShare, 'sting'),
    sound('verdictDing', shape.spanMs * TIMING.verdictShare, 'verdict')
  ];
}

/**
 * @description The trench coat: tiptoe plucks, then the topple when the disguise ends.
 * @param {Object} shape - From readEvent().
 * @returns {Array<Object>} The sounds.
 * @since 1.0.0
 */
function trenchCoatStart(shape) {
  const ticks = finiteOr(shape.data.disguiseTicks, NaN);
  const toppleMs = ticks > 0 ? ticks * TIMING.tickMs : shape.spanMs * TIMING.toppleShare;
  return [sound('tiptoe', 0, 'tiptoe'), sound('toppleThud', toppleMs, 'topple')];
}

/**
 * @description A builder that always plans the same single sound.
 * @param {string} effect - The SFX_LIBRARY id.
 * @param {string} part - Its part name.
 * @returns {function(): Array<Object>} The builder.
 * @since 1.0.0
 */
function only(effect, part) {
  return () => [sound(effect, 0, part)];
}

/**
 * Per type: a builder per phase ({start, impact, end}), each (shape, impactIndex) => sounds, and
 * optional music builders ({start, end}) => music actions.
 */
const EVENT_SOUNDS = Object.freeze({
  tornado: {
    start: tornadoStart,
    impact: (shape) => (shape.data.sharks === true ? [sound('sharkChomp', 0, 'chomp')] : [])
  },
  hunter: {start: hunterStart, impact: only('popGun', 'pop')},
  suitor: {
    start: (shape) => suitorSounds(shape, true),
    impact: (shape) => suitorSounds(shape, false)
  },
  eagle: {start: eagleStart},
  beaver: {start: only('gnaw', 'gnaw'), impact: only('gnaw', 'gnaw')},
  lightning: {start: only('thunderCrack', 'strike'), impact: only('thunderCrack', 'strike')},
  catLady: {
    start: catLadyStart,
    impact: (shape, impactIndex) => [sound('meowSweep', 0, `meow-${impactIndex}`)]
  },
  goldenAcorn: {start: goldenAcornStart, impact: only('bonk', 'bonk')},
  leafBlower: {start: only('motorHum', 'motor')},
  ufo: {start: only('theremin', 'theremin'), impact: only('theremin', 'theremin')},
  earthquake: {start: only('rumble', 'rumble')},
  flood: {start: floodStart, impact: only('bubbleBurst', 'burst')},
  disco: {
    start: only('discoSparkle', 'sparkle'),
    music: {
      start: (shape) => [{action: 'disco', fromMs: 0, untilMs: Math.max(shape.spanMs, 500)}],
      end: () => [{action: 'discoEnd'}]
    }
  },
  acornHail: {start: only('pitterPatter', 'patter')},
  var: {
    start: varStart,
    impact: only('verdictDing', 'verdict'),
    end: only('verdictDing', 'verdict')
  },
  trenchCoat: {start: trenchCoatStart, end: only('toppleThud', 'topple')},
  woodpecker: {start: only('knocks', 'knocks')},
  nutStop: {start: only('crunch', 'crunch')},
  slip: {start: only('slideDown', 'slide')},
  burst: {start: only('slideUp', 'slide')}
});

/**
 * Per cue: its sounds and what it does to the music. The race cues are never dropped by the
 * throttle or deduplicated; a cue marked throttled (the hoot) is dropped like an event when
 * three sounds are already playing or its gap has not passed.
 */
const CUE_SOUNDS = Object.freeze({
  go: Object.freeze({sounds: Object.freeze([sound('goPop', 0, 'go')]), music: Object.freeze([])}),
  lastStretch: Object.freeze({
    sounds: Object.freeze([sound('lastStretchBells', 0, 'bells')]),
    music: Object.freeze([{action: 'lastStretch'}])
  }),
  finaleBurst: Object.freeze({
    sounds: Object.freeze([sound('cymbalSwell', 0, 'swell')]),
    music: Object.freeze([{action: 'finale'}])
  }),
  photoFinish: Object.freeze({
    sounds: Object.freeze([sound('cameraClick', 0, 'click')]),
    music: Object.freeze([])
  }),
  finish: Object.freeze({
    sounds: Object.freeze([sound('fanfare', 0, 'fanfare'), sound('crowdCheer', 300, 'cheer')]),
    music: Object.freeze([{action: 'fadeOut'}])
  }),
  hoot: Object.freeze({
    sounds: Object.freeze([sound('hoot', 0, 'hoot')]),
    music: Object.freeze([]),
    throttled: true
  })
});

/**
 * @description The minimum gap for a throttle key: a type's start gap, the shorter follow-up gap
 *   for 'type:impact' and 'type:end', a throttled cue's gap (the hoot, since 2.2.0), or the
 *   default.
 * @param {string} key - The throttle key from soundsForEvent(), or a throttled cue's name.
 * @returns {number} Milliseconds.
 * @example
 *   minGapFor('tornado');
 *   // 1500
 * @since 1.0.0
 */
export function minGapFor(key) {
  if (typeof key !== 'string' || key.length === 0) {
    return DEFAULT_GAP_MS;
  }
  if (key.includes(':')) {
    return FOLLOW_UP_GAP_MS;
  }
  if (Object.prototype.hasOwnProperty.call(CUE_GAP_MS, key)) {
    return CUE_GAP_MS[key];
  }
  return Object.prototype.hasOwnProperty.call(MIN_GAP_MS, key) ? MIN_GAP_MS[key] : DEFAULT_GAP_MS;
}

/**
 * @description Plans the sounds (and music changes) for one event at one phase. Never throws: a
 *   malformed event, an unknown type or an unknown phase plans nothing.
 * @param {Object} raceEvent - A plan event (either shape).
 * @param {string} phase - 'start', 'impact' or 'end'.
 * @param {number} [impactIndex] - For 'impact': how many impacts this event has had before (the
 *   cat lady's nth cat).
 * @returns {{id: string, type: string, throttleKey: string,
 *   sounds: Array<{effect: string, atMs: number, part: string}>,
 *   music: Array<{action: string, fromMs?: number, untilMs?: number}>}} The plan.
 * @example
 *   soundsForEvent({id: 'evt-2', type: 'hunter', outcome: 'miss', startMs: 4000, endMs: 5000},
 *     'start');
 *   // sounds: popGun at 0 ms, boing at 160 ms
 * @since 1.0.0
 */
export function soundsForEvent(raceEvent, phase, impactIndex) {
  const shape = readEvent(raceEvent);
  if (!shape || !EVENT_PHASES.includes(phase)) {
    return EMPTY_PLAN;
  }
  const entry = EVENT_SOUNDS[shape.type];
  if (!entry || !Object.prototype.hasOwnProperty.call(EVENT_SOUNDS, shape.type)) {
    return EMPTY_PLAN;
  }
  const index = Number.isInteger(impactIndex) && impactIndex >= 0 ? impactIndex : 0;
  const build = entry[phase];
  const musicBuild = entry.music ? entry.music[phase] : null;
  return {
    id: shape.id,
    type: shape.type,
    throttleKey: phase === 'start' ? shape.type : `${shape.type}:${phase}`,
    sounds: typeof build === 'function' ? build(shape, index) : [],
    music: typeof musicBuild === 'function' ? musicBuild(shape) : []
  };
}

/**
 * @description The sounds and music change for a cue, or null for an unknown name.
 * @param {string} name - 'go', 'lastStretch', 'finaleBurst', 'photoFinish', 'finish' or 'hoot'.
 * @returns {{sounds: Array<{effect: string, atMs: number, part: string}>,
 *   music: Array<{action: string}>, throttled?: boolean}|null} The cue; throttled is true for a
 *   cue the throttle may drop (the hoot).
 * @example
 *   soundsForCue('finish').sounds.map((item) => item.effect);
 *   // ['fanfare', 'crowdCheer']
 * @since 1.0.0
 */
export function soundsForCue(name) {
  if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(CUE_SOUNDS, name)) {
    return null;
  }
  return CUE_SOUNDS[name];
}
