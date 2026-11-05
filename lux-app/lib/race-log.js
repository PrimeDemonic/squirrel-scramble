/**
 * The race log (Chaos v2 contract § 11) and the owl commentator's pose (§ 12).
 *
 * buildRaceLog() turns a race plan into the running record of what happened and to whom: "And
 * they're off!" at 0, one entry per plan event at its start (Classic and Chaos alike; a combo is
 * one entry that names the combo; a Golden Acorn entry sits at its impact), each VAR verdict at
 * the event's end, and each finisher awarded a place at its finish (a photo finish says so). No
 * leader changes: the leaderboard shows those. Every entry names every squirrel it affected,
 * from the event's data, and a line that singles nobody out says so. It uses no generator, so a
 * replay of the same plan gives the same log, entry for entry.
 *
 * Wording lives in lib/theme-config.js (raceLog). An entry carries its template key, the theme
 * text and the filled-in names; the component layer translates it (components/phrases.js) and
 * shows each named squirrel as its bib chip followed by its name.
 *
 * commentatorPoseAt() is the owl's pose at a race time: idle, talking after each new commentary
 * cue, gasping at a big moment, cheering the winner. Pure, so seek and replay agree.
 *
 * Pure ES module: no DOM, no Lit and no platform imports.
 */
import {themeConfig} from './theme-config.js';

// A {placeholder} token in a template.
const PLACEHOLDER = /\{([a-z]+)\}/g;

// The order of entries that share a moment: the opening, events (by plan sequence), verdicts,
// then finishers (by place).
const RANK = Object.freeze({opening: 0, event: 1, verdict: 2, finish: 3});

// The owl's poses, strongest first: a cheer beats a gasp, a gasp beats talking.
const POSE_STRENGTH = Object.freeze({idle: 0, talk: 1, gasp: 2, cheer: 3});

/**
 * @description The race log settings from a theme: the raceLog section, and the places rules.
 * @param {Object} theme - A theme config.
 * @returns {{templates: Object, titles: Object, list: Object, highlightMs: number, owl: Object,
 *   defaultPlaces: number, maxPlaces: number}} The settings.
 * @example
 *   logSettings(themeConfig).highlightMs;
 *   // 1500
 * @since 2.2.0
 */
function logSettings(theme) {
  const source = theme && theme.raceLog ? theme : themeConfig;
  const race = (theme && theme.race) || themeConfig.race;
  return {
    ...source.raceLog,
    defaultPlaces: race.defaultPlaces,
    maxPlaces: race.maxPlaces
  };
}

/**
 * @description An entrant index when it is a whole number inside the field, else null.
 * @param {*} value - A candidate index.
 * @param {number} count - Entrants in the race.
 * @returns {number|null} The index.
 * @example
 *   validIndex(2, 8);
 *   // 2
 * @since 2.2.0
 */
function validIndex(value, count) {
  return Number.isInteger(value) && value >= 0 && value < count ? value : null;
}

/**
 * @description The valid entrant indexes of a list, each once, in their first order.
 * @param {*} list - A list of indexes (or anything).
 * @param {number} count - Entrants in the race.
 * @returns {number[]} The indexes.
 * @example
 *   validIndexes([3, 1, 3, 'x', 99], 8);
 *   // [3, 1]
 * @since 2.2.0
 */
function validIndexes(list, count) {
  if (!Array.isArray(list)) {
    return [];
  }
  const seen = new Set();
  list.forEach((value) => {
    const index = validIndex(value, count);
    if (index !== null) {
      seen.add(index);
    }
  });
  return [...seen];
}

/**
 * @description An event's data, in either plan shape (data, or the v1 details).
 * @param {Object} event - A plan event.
 * @returns {Object} The data (an empty object when there is none).
 * @since 2.2.0
 */
function eventData(event) {
  if (event.data && typeof event.data === 'object') {
    return event.data;
  }
  return event.details && typeof event.details === 'object' ? event.details : {};
}

/**
 * @description An event's entrant list, in either plan shape (entrants, or the v1
 *   entrantIndexes).
 * @param {Object} event - A plan event.
 * @returns {Array} The list (empty when there is none).
 * @since 2.2.0
 */
function eventEntrants(event) {
  if (Array.isArray(event.entrants)) {
    return event.entrants;
  }
  return Array.isArray(event.entrantIndexes) ? event.entrantIndexes : [];
}

/**
 * @description The squirrels a list of throws actually landed a cat on (an intercepted throw
 *   went to the eagle instead).
 * @param {*} throws - The cat lady's data.throws.
 * @returns {Array} The entrant indexes, unchecked.
 * @since 2.2.0
 */
function landedCats(throws) {
  if (!Array.isArray(throws)) {
    return [];
  }
  return throws
    .filter((item) => item && typeof item === 'object' && item.intercepted !== true)
    .map((item) => item.entrant);
}

/**
 * @description Who a tornado (or a sharknado) whisked away: its entrants, else its swaps.
 * @param {Object} data - The event's data.
 * @param {Array} entrants - The event's entrant list.
 * @param {number} count - Entrants in the race.
 * @returns {{kind: string, variant: string, named: number[], name: (number|null)}} The parts.
 * @since 2.2.0
 */
function describeTornado(data, entrants, count) {
  const swapped = Array.isArray(data.swaps) ? data.swaps.map((swap) => swap && swap.entrant) : [];
  const named = validIndexes(entrants.length > 0 ? entrants : swapped, count);
  if (data.sharks !== true) {
    return {kind: 'tornado', variant: named.length > 0 ? 'some' : 'none', named, name: null};
  }
  const chomped = validIndex(data.hatChomp, count);
  if (chomped !== null && !named.includes(chomped)) {
    named.push(chomped);
  }
  let variant = named.length > 0 ? 'some' : 'none';
  if (chomped !== null) {
    variant = 'chomp';
  }
  return {kind: 'sharknado', variant, named, name: chomped};
}

/**
 * @description A field event that singles some squirrels out in one data list (the leaf
 *   blower's lost hats, the earthquake's slips, the flood's bursters, the hail's chubby cheeks).
 * @param {string} kind - The log kind.
 * @param {string} listName - The data field that lists them.
 * @returns {function(Object, Object, Array, number): Object} The describer.
 * @since 2.2.0
 */
function singledOut(kind, listName) {
  return (_event, data, _entrants, count) => {
    const named = validIndexes(data[listName], count);
    return {kind, variant: named.length > 0 ? 'some' : 'none', named, name: null};
  };
}

/**
 * @description An event that affects exactly its entrant list.
 * @param {string} kind - The log kind.
 * @returns {function(Object, Object, Array, number): Object} The describer.
 * @since 2.2.0
 */
function listed(kind) {
  return (_event, _data, entrants, count) => {
    const named = validIndexes(entrants, count);
    return {kind, variant: named.length > 0 ? 'some' : 'none', named, name: null};
  };
}

/**
 * @description A field event that singles nobody out ("Everyone froze for VAR").
 * @param {string} kind - The log kind.
 * @returns {function(): Object} The describer.
 * @since 2.2.0
 */
function everyone(kind) {
  return () => ({kind, variant: 'none', named: [], name: null});
}

// What each event type says and about whom (the contract § 4 catalogue and § 11's names list).
const DESCRIBERS = Object.freeze({
  tornado: (_event, data, entrants, count) => describeTornado(data, entrants, count),
  hunter: (event, data, entrants, count) => (
    listed(event.outcome === 'hit' ? 'hunterHit' : 'hunterMiss')(event, data, entrants, count)
  ),
  suitor: (event, data, entrants, count) => (
    listed(event.outcome === 'slap' ? 'suitorSlap' : 'suitorKiss')(event, data, entrants, count)
  ),
  eagle: listed('eagle'),
  beaver: listed('beaver'),
  lightning: listed('lightning'),
  woodpecker: listed('woodpecker'),
  goldenAcorn: listed('goldenAcorn'),
  ufo: listed('ufo'),
  nutStop: listed('nutStop'),
  slip: listed('slip'),
  burst: listed('burst'),
  catLady: (_event, data, _entrants, count) => {
    const named = validIndexes(landedCats(data.throws), count);
    return {kind: 'catLady', variant: named.length > 0 ? 'some' : 'none', named, name: null};
  },
  leafBlower: singledOut('leafBlower', 'hatLoss'),
  earthquake: singledOut('earthquake', 'slips'),
  flood: singledOut('flood', 'bursters'),
  acornHail: singledOut('acornHail', 'chubby'),
  disco: everyone('disco'),
  var: everyone('var'),
  trenchCoat: (_event, data, entrants, count) => {
    const named = validIndexes(entrants, count);
    const host = validIndex(data.host, count);
    if (host !== null && !named.includes(host)) {
      named.push(host);
    }
    let variant = named.length > 0 ? 'some' : 'none';
    if (host !== null) {
      variant = 'host';
    }
    return {kind: 'trenchCoat', variant, named, name: host};
  }
});

/**
 * @description What one plan event says in the log: its kind (the combo's own kind for a combo
 *   event), the template variant, and the squirrels it names.
 * @param {Object} event - A plan event.
 * @param {number} count - Entrants in the race.
 * @returns {{kind: string, variant: string, named: number[], name: (number|null),
 *   other: (number|null)}} The description.
 * @since 2.2.0
 */
function describeEvent(event, count) {
  const data = eventData(event);
  const entrants = eventEntrants(event);
  const combo = data.combo && typeof data.combo.kind === 'string' ? data.combo.kind : null;
  if (combo) {
    const named = validIndexes(entrants, count);
    const variant = named.length > 0 ? 'some' : 'none';
    return {kind: combo, variant, named, name: null, other: null};
  }
  const describe = Object.prototype.hasOwnProperty.call(DESCRIBERS, event.type)
    ? DESCRIBERS[event.type]
    : listed('other');
  return {other: null, ...describe(event, data, entrants, count)};
}

/**
 * @description Fills {placeholder} tokens from named values in one pass, so a value that itself
 *   looks like a placeholder is never expanded again. Unknown tokens stay as they are.
 * @param {string} template - The text with placeholders.
 * @param {Object<string, string>} [params] - The values.
 * @returns {string} The filled text.
 * @example
 *   fillTemplate('{names} slipped down the trunk.', {names: 'Alex'});
 *   // 'Alex slipped down the trunk.'
 * @since 2.2.0
 */
export function fillTemplate(template, params = {}) {
  const text = typeof template === 'string' ? template : '';
  const values = params && typeof params === 'object' ? params : {};
  return text.replace(PLACEHOLDER, (match, key) => (
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match
  ));
}

/**
 * @description Says whether every placeholder in a template has a value.
 * @param {string} text - The template.
 * @param {Object} params - The values.
 * @returns {boolean} True when it can be filled.
 * @since 2.2.0
 */
function canFill(text, params) {
  return [...text.matchAll(PLACEHOLDER)].every((match) => typeof params[match[1]] === 'string');
}

/**
 * @description The placeholders a template uses.
 * @param {string} text - The template.
 * @returns {Set<string>} The placeholder names.
 * @since 2.2.0
 */
function placeholdersIn(text) {
  return new Set([...text.matchAll(PLACEHOLDER)].map((match) => match[1]));
}

/**
 * @description Joins names the theme's way: "Alex", "Alex and Sam", "Alex, Sam and Jo".
 * @param {string[]} names - The names, in order.
 * @param {{text: string, separator: string}} list - The theme's list words.
 * @returns {string} The joined names ('' for none).
 * @example
 *   joinNames(['Alex', 'Sam', 'Jo'], themeConfig.raceLog.list);
 *   // 'Alex, Sam and Jo'
 * @since 2.2.0
 */
export function joinNames(names, list = themeConfig.raceLog.list) {
  const words = list && typeof list.text === 'string' ? list : themeConfig.raceLog.list;
  if (!Array.isArray(names) || names.length === 0) {
    return '';
  }
  if (names.length === 1) {
    return names[0];
  }
  const first = names.slice(0, -1).join(words.separator);
  return fillTemplate(words.text, {first, last: names[names.length - 1]});
}

/**
 * @description The placeholder values for an entry, from the plan's entrant names.
 * @param {Object} plan - From buildRacePlan.
 * @param {{named: number[], name: (number|null), other: (number|null)}} subjects - Who.
 * @param {Object} list - The theme's list words.
 * @returns {{names?: string, name?: string, other?: string}} The values.
 * @since 2.2.0
 */
function paramsFor(plan, subjects, list) {
  const nameOf = (index) => {
    const entrant = plan.entrants[index];
    return entrant && typeof entrant.name === 'string' ? entrant.name : '';
  };
  const params = {};
  if (subjects.named.length > 0) {
    params.names = joinNames(subjects.named.map(nameOf), list);
  }
  if (subjects.name !== null) {
    params.name = nameOf(subjects.name);
  }
  if (subjects.other !== null) {
    params.other = nameOf(subjects.other);
  }
  return params;
}

/**
 * @description Picks the line for an entry: the wanted variant, then 'some', then 'plain' (names
 *   only), then 'none', each only when every placeholder can be filled; then the theme's
 *   catch-all line. Never returns a line with an unfilled placeholder.
 * @param {Object} settings - The race log settings.
 * @param {string} kind - The log kind.
 * @param {string} variant - The wanted variant.
 * @param {Object} params - The placeholder values.
 * @returns {{key: string, text: string}} The line.
 * @since 2.2.0
 */
function pickTemplate(settings, kind, variant, params) {
  const lists = [settings.templates[kind], settings.templates.other]
    .filter((list) => Array.isArray(list));
  const order = [variant, 'some', 'plain', 'none'];
  for (const list of lists) {
    for (const wanted of order) {
      const found = list.find((template) => (
        template.variant === wanted && canFill(template.text, params)
      ));
      if (found) {
        return {key: found.key, text: found.text};
      }
    }
  }
  const quiet = lists.flat().find((template) => canFill(template.text, {}));
  return quiet ? {key: quiet.key, text: quiet.text} : {key: '', text: ''};
}

/**
 * @description Builds one log entry, with the keys it sorts by.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object} settings - The race log settings.
 * @param {{id: string, atMs: number, kind: string, variant: string, named: number[],
 *   name: (number|null), other: (number|null), rank: number, order: number,
 *   eventId: (string|null)}} spec - What happened, when and to whom.
 * @returns {{entry: Object, rank: number, order: number}} The entry and its sort keys.
 * @since 2.2.0
 */
function makeEntry(plan, settings, spec) {
  const params = paramsFor(plan, spec, settings.list);
  const template = pickTemplate(settings, spec.kind, spec.variant, params);
  const used = placeholdersIn(template.text);
  const subjects = {
    names: used.has('names') ? spec.named.slice() : [],
    name: used.has('name') ? spec.name : null,
    other: used.has('other') ? spec.other : null
  };
  const usedParams = {};
  Object.keys(params).forEach((key) => {
    if (used.has(key)) {
      usedParams[key] = params[key];
    }
  });
  const entrantIndexes = validIndexes(
    subjects.names.concat([subjects.name, subjects.other]),
    plan.entrants.length
  );
  const title = settings.titles[spec.kind] || settings.titles.other;
  const entry = {
    id: spec.id,
    atMs: spec.atMs,
    kind: spec.kind,
    templateKey: template.key,
    template: template.text,
    params: usedParams,
    entrantIndexes,
    subjects,
    titleKey: title.key,
    title: title.text,
    eventId: spec.eventId
  };
  return {entry, rank: spec.rank, order: spec.order};
}

/**
 * @description The entries for the plan's events: one per event at its start (a Golden Acorn at
 *   its impact), plus each VAR verdict at its event's end.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object} settings - The race log settings.
 * @returns {Array<{entry: Object, rank: number, order: number}>} The entries, unsorted.
 * @since 2.2.0
 */
function eventEntries(plan, settings) {
  const count = plan.entrants.length;
  const entries = [];
  (Array.isArray(plan.events) ? plan.events : []).forEach((event, position) => {
    if (!event || typeof event.type !== 'string' || !Number.isFinite(event.startMs)) {
      return;
    }
    const data = eventData(event);
    const order = Number.isInteger(event.sequence) ? event.sequence : position;
    const id = event.id !== undefined && event.id !== null ? String(event.id) : `at-${position}`;
    const impact = event.type === 'goldenAcorn' && Number.isFinite(data.impactMs);
    entries.push(makeEntry(plan, settings, {
      ...describeEvent(event, count),
      id: `log-${id}`,
      atMs: impact ? data.impactMs : event.startMs,
      rank: RANK.event,
      order,
      eventId: id
    }));
    if (event.type === 'var' && !data.combo) {
      entries.push(makeEntry(plan, settings, {
        kind: 'varVerdict',
        variant: typeof data.verdict === 'string' ? data.verdict : 'none',
        named: [],
        name: null,
        other: null,
        id: `log-${id}-verdict`,
        atMs: Number.isFinite(event.endMs) ? event.endMs : event.startMs,
        rank: RANK.verdict,
        order,
        eventId: id
      }));
    }
  });
  return entries;
}

/**
 * @description How many places a race awards: the race's setting (or the theme default),
 *   clamped to 1, the theme's maximum and the field size, as the stage does.
 * @param {*} places - The race payload's places.
 * @param {number} count - Entrants in the race.
 * @param {Object} settings - The race log settings.
 * @returns {number} The places awarded.
 * @since 2.2.0
 */
function awardedPlaces(places, count, settings) {
  const wanted = Number.isInteger(places) ? places : settings.defaultPlaces;
  return Math.max(1, Math.min(wanted, settings.maxPlaces, count));
}

/**
 * @description The finishers who are awarded places, each at its finish: the winner; the
 *   runner-up (a photo finish says so); third. When only the winner is awarded and it was a
 *   photo finish, the winner's own line says so.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object} settings - The race log settings.
 * @param {number} awarded - Places awarded.
 * @returns {Array<{entry: Object, rank: number, order: number}>} The entries.
 * @since 2.2.0
 */
function finishEntries(plan, settings, awarded) {
  const count = plan.entrants.length;
  const order = Array.isArray(plan.finishOrder) ? plan.finishOrder : [];
  const race = {
    photo: plan.photoFinish === true && count > 1,
    awarded,
    winner: validIndex(order[0], count),
    runnerUp: validIndex(order[1], count)
  };
  const entries = [];
  for (let place = 1; place <= awarded; place += 1) {
    const index = validIndex(order[place - 1], count);
    // A finisher without a finish time has no moment in the log.
    if (index !== null && Number.isFinite(plan.entrants[index].finishMs)) {
      entries.push(makeEntry(plan, settings, {
        ...placeSpec(place, race),
        named: [index],
        name: null,
        id: `log-place-${place}`,
        atMs: plan.entrants[index].finishMs,
        rank: RANK.finish,
        order: place,
        eventId: null
      }));
    }
  }
  return entries;
}

/**
 * @description The kind, variant and second squirrel of one finisher's line.
 * @param {number} place - 1, 2 or 3.
 * @param {{photo: boolean, awarded: number, winner: (number|null),
 *   runnerUp: (number|null)}} race - Whether it was a photo finish, the places awarded, the
 *   winner and the runner-up.
 * @returns {{kind: string, variant: string, other: (number|null)}} The parts.
 * @since 2.2.0
 */
function placeSpec(place, race) {
  if (place === 1) {
    const photoWin = race.photo && race.awarded === 1 && race.runnerUp !== null;
    return photoWin
      ? {kind: 'winner', variant: 'photo', other: race.runnerUp}
      : {kind: 'winner', variant: 'some', other: null};
  }
  if (place === 2 && race.photo) {
    return {kind: 'photoFinish', variant: 'some', other: race.winner};
  }
  return {kind: 'place', variant: place === 2 ? 'second' : 'third', other: null};
}

/**
 * @description Builds the race log: entries in time order, deterministic from the plan alone (no
 *   generator), so a replay of the same race shows the same log.
 * @param {Object} plan - From buildRacePlan.
 * @param {{theme?: Object, places?: number}} [options] - A theme config (the squirrel theme by
 *   default) and the places the race awards (the payload's race.places; the theme default when
 *   missing).
 * @returns {Array<{id: string, atMs: number, kind: string, templateKey: string, template: string,
 *   params: {names?: string, name?: string, other?: string}, entrantIndexes: number[],
 *   subjects: {names: number[], name: (number|null), other: (number|null)}, titleKey: string,
 *   title: string, eventId: (string|null)}>} The entries in time order.
 * @example
 *   const log = buildRaceLog(plan, {places: payload.race.places});
 *   log[0].template;
 *   // 'And they’re off!'
 * @since 2.2.0
 */
export function buildRaceLog(plan, {theme, places} = {}) {
  const usable = plan && Array.isArray(plan.entrants) && plan.entrants.length > 0
    && plan.entrants.every((entrant) => entrant && typeof entrant === 'object');
  if (!usable) {
    return [];
  }
  const settings = logSettings(theme || themeConfig);
  const count = plan.entrants.length;
  const opening = makeEntry(plan, settings, {
    kind: 'opening',
    variant: count === 1 ? 'some' : 'none',
    named: count === 1 ? [0] : [],
    name: null,
    other: null,
    id: 'log-opening',
    atMs: 0,
    rank: RANK.opening,
    order: 0,
    eventId: null
  });
  const sortable = [opening]
    .concat(eventEntries(plan, settings))
    .concat(finishEntries(plan, settings, awardedPlaces(places, count, settings)));
  return sortable
    .sort((left, right) => (
      left.entry.atMs - right.entry.atMs || left.rank - right.rank || left.order - right.order
    ))
    .map((item) => item.entry);
}

/**
 * @description How many entries have appeared by a race time (entries whose atMs is at or
 *   before it). A binary search: the stage calls it every frame.
 * @param {Array<{atMs: number}>} entries - From buildRaceLog, in time order.
 * @param {number} raceMs - Race time.
 * @returns {number} The count (0 before "Go!").
 * @example
 *   logCountAt(log, 0);
 *   // 1 ("And they're off!")
 * @since 2.2.0
 */
export function logCountAt(entries, raceMs) {
  if (!Array.isArray(entries) || !Number.isFinite(raceMs)) {
    return 0;
  }
  let low = 0;
  let high = entries.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (entries[middle].atMs <= raceMs) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

/**
 * @description The entries that have appeared by a race time, oldest first.
 * @param {Array<{atMs: number}>} entries - From buildRaceLog, in time order.
 * @param {number} raceMs - Race time.
 * @returns {Object[]} The entries (a new array).
 * @example
 *   logEntriesUpTo(log, 12000).length;
 * @since 2.2.0
 */
export function logEntriesUpTo(entries, raceMs) {
  return Array.isArray(entries) ? entries.slice(0, logCountAt(entries, raceMs)) : [];
}

/**
 * @description An entry's line in the theme's own words with the names filled in (the untranslated
 *   fallback; the stage shows the translated line with bib chips).
 * @param {{template: string, params: Object}} entry - From buildRaceLog.
 * @returns {string} The line.
 * @example
 *   logEntryText(log[0]);
 *   // 'And they’re off!'
 * @since 2.2.0
 */
export function logEntryText(entry) {
  return entry && typeof entry === 'object' ? fillTemplate(entry.template, entry.params) : '';
}

/**
 * @description The race clock as the log shows it: minutes and two-digit seconds from "Go!".
 * @param {number} raceMs - Race time in milliseconds.
 * @returns {string} For example '1:05'; '0:00' for anything before the start or unusable.
 * @example
 *   raceClock(65400);
 *   // '1:05'
 * @since 2.2.0
 */
export function raceClock(raceMs) {
  const seconds = Number.isFinite(raceMs) && raceMs > 0 ? Math.floor(raceMs / 1000) : 0;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * @description The owl commentator's settings, with safe defaults for a theme without them.
 * @param {Object} theme - A theme config.
 * @returns {{talkMs: number, gaspMs: number, cheerMs: number, gaspTriggers: string[],
 *   cheerTriggers: string[]}} The settings.
 * @since 2.2.0
 */
function owlSettings(theme) {
  const source = theme && theme.raceLog && theme.raceLog.owl ? theme.raceLog.owl : {};
  const fallback = themeConfig.raceLog.owl;
  const number = (value, standIn) => (Number.isFinite(value) && value >= 0 ? value : standIn);
  const list = (value, standIn) => (Array.isArray(value) ? value : standIn);
  return {
    talkMs: number(source.talkMs, fallback.talkMs),
    gaspMs: number(source.gaspMs, fallback.gaspMs),
    cheerMs: number(source.cheerMs, fallback.cheerMs),
    gaspTriggers: list(source.gaspTriggers, fallback.gaspTriggers),
    cheerTriggers: list(source.cheerTriggers, fallback.cheerTriggers)
  };
}

/**
 * @description The pose the latest commentary cue asks for at a race time: gasp on a big moment
 *   (for gaspMs), cheer on a winner's line (for cheerMs), talk after any other cue (for talkMs).
 *   A cue that is both (the photo finish, which is the winner's line in a photo finish) gasps
 *   first, then cheers.
 * @param {Array<{atMs: number, trigger?: string}>} cues - Commentary cues in time order.
 * @param {number} raceMs - Race time.
 * @param {Object} owl - The owl settings.
 * @returns {string} 'idle', 'talk', 'gasp' or 'cheer'.
 * @since 2.2.0
 */
function cuePose(cues, raceMs, owl) {
  const latest = logCountAt(cues, raceMs) - 1;
  const cue = latest >= 0 ? cues[latest] : null;
  if (!cue || !Number.isFinite(cue.atMs)) {
    return 'idle';
  }
  const since = raceMs - cue.atMs;
  const trigger = typeof cue.trigger === 'string' ? cue.trigger : '';
  if (owl.gaspTriggers.includes(trigger) && since < owl.gaspMs) {
    return 'gasp';
  }
  if (owl.cheerTriggers.includes(trigger) && since < owl.cheerMs) {
    return 'cheer';
  }
  return since < owl.talkMs ? 'talk' : 'idle';
}

/**
 * @description Says whether a big moment in the log is still fresh at a race time, so the owl
 *   gasps even when the commentary had no room for that line.
 * @param {Array<{atMs: number, kind: string}>} entries - The race log in time order.
 * @param {number} raceMs - Race time.
 * @param {Object} owl - The owl settings.
 * @returns {boolean} True while a gasp-worthy entry is under gaspMs old.
 * @since 2.2.0
 */
function logGasp(entries, raceMs, owl) {
  for (let index = logCountAt(entries, raceMs) - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (raceMs - entry.atMs >= owl.gaspMs) {
      return false;
    }
    if (owl.gaspTriggers.includes(entry.kind)) {
      return true;
    }
  }
  return false;
}

/**
 * @description The owl commentator's pose at a race time (Chaos v2 contract § 12): 'talk' for
 *   about 1.2 s after each new cue, 'gasp' on the big moments (tornado and sharknado, a Golden
 *   Acorn impact, earthquake, UFO, the finale burst, a VAR verdict, a photo finish), 'cheer' for
 *   the winner's line (in a photo finish, after the gasp), 'idle' otherwise. The big moments come
 *   from the cues and from the log, so the owl gasps even when the commentary had no room for
 *   that line. Between the two, a cheer beats a gasp and a gasp beats talking. Pure, so a seek or
 *   a replay shows the same pose at the same moment.
 * @param {Array<{atMs: number, trigger?: string}>} cues - From buildCommentaryCues, in time
 *   order.
 * @param {Array<{atMs: number, kind: string}>} logEntries - From buildRaceLog, in time order.
 * @param {number} raceMs - Race time.
 * @param {Object} [theme] - A theme config (its raceLog.owl timings and triggers).
 * @returns {string} 'idle', 'talk', 'gasp' or 'cheer'.
 * @example
 *   const pose = commentatorPoseAt(cues, log, scene.raceMs);
 * @since 2.2.0
 */
export function commentatorPoseAt(cues, logEntries, raceMs, theme = themeConfig) {
  if (!Number.isFinite(raceMs) || raceMs < 0) {
    return 'idle';
  }
  const owl = owlSettings(theme);
  const fromCue = cuePose(Array.isArray(cues) ? cues : [], raceMs, owl);
  const gasping = logGasp(Array.isArray(logEntries) ? logEntries : [], raceMs, owl);
  const fromLog = gasping ? 'gasp' : 'idle';
  return POSE_STRENGTH[fromLog] > POSE_STRENGTH[fromCue] ? fromLog : fromCue;
}
