/**
 * Unit tests for lib/race-log.js (Chaos v2 contract § 11): the race log is built from the plan
 * alone, in time order, with one entry per plan event, every VAR verdict and the awarded places;
 * every entry names the squirrels it affected and fills every placeholder; the wording in
 * lib/theme-config.js (raceLog) is gender-neutral and only uses the known placeholders; and the
 * same plan always gives the same log.
 *
 * @since 2.2.0
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {themeConfig} from '../lib/theme-config.js';
import {buildRacePlan} from '../lib/choreography.js';
import {createRng} from '../lib/rng.js';
import {
  buildRaceLog,
  fillTemplate,
  joinNames,
  logCountAt,
  logEntriesUpTo,
  logEntryText,
  raceClock
} from '../lib/race-log.js';
import {CHAOS_LENGTHS_MS, CHAOS_LEVELS, CLASSIC_LENGTHS_MS, randomRaceInput} from './support.js';

// Names from real people, so a pronoun would be a guess.
const NAMES = ['Alex', 'Sam', 'Jo', 'Priya', 'Mo', 'Kai'];

// Any gendered pronoun, as a whole word.
const GENDERED = /\b(he|she|him|her|his|hers|himself|herself)\b/i;

// A placeholder left in a line.
const LEFT_OVER = /\{[a-z]+\}/;

/**
 * @description A hand-built plan: entrants with names, lanes and finish times, in finish order.
 * @param {{count?: number, events?: Object[], finishOrder?: number[],
 *   photoFinish?: boolean}} [shape] - The race.
 * @returns {Object} A plan with the fields the race log reads.
 */
function planOf({count = 4, events = [], finishOrder, photoFinish = false} = {}) {
  const order = finishOrder || Array.from({length: count}, (_value, index) => index);
  const entrants = NAMES.slice(0, count).map((name, index) => ({
    index,
    name,
    lane: index + 1,
    position: order.indexOf(index) + 1,
    finishMs: 30000 + order.indexOf(index) * 400
  }));
  return {entrants, events, finishOrder: order, photoFinish, mode: 'chaos', durationMs: 32000};
}

/**
 * @description A hand-built plan event.
 * @param {string} id - Its id.
 * @param {string} type - Its type.
 * @param {Object} [extra] - Fields to override (entrants, data, outcome, startMs, endMs).
 * @returns {Object} The event.
 */
function eventOf(id, type, extra = {}) {
  return {
    id,
    sequence: Number(id.replace(/\D/g, '')) || 0,
    type,
    category: 'chaos',
    scope: 'entrants',
    outcome: null,
    startMs: 5000,
    endMs: 7000,
    entrants: [],
    data: {},
    ...extra
  };
}

/**
 * @description The entry for one event, by the event's id.
 * @param {Object[]} log - From buildRaceLog.
 * @param {string} id - The entry id.
 * @returns {Object} The entry.
 */
function entryById(log, id) {
  const entry = log.find((item) => item.id === id);
  assert.ok(entry, `no entry ${id}`);
  return entry;
}

/**
 * @description The single event's line in a four-squirrel race.
 * @param {Object} event - The event.
 * @returns {{entry: Object, text: string}} Its entry and line.
 */
function lineFor(event) {
  const entry = entryById(buildRaceLog(planOf({events: [event]})), `log-${event.id}`);
  return {entry, text: logEntryText(entry)};
}

/**
 * @description Every line and title in the theme's raceLog section.
 * @returns {Array<{key: string, text: string, variant?: string, kind: string}>} The lines.
 */
function themeLines() {
  const {templates, titles, list} = themeConfig.raceLog;
  const lines = Object.entries(templates).flatMap(([kind, items]) => (
    items.map((item) => ({...item, kind}))
  ));
  const heads = Object.entries(titles).map(([kind, item]) => ({...item, kind}));
  return lines.concat(heads, [{...list, kind: 'list'}]);
}

/**
 * @description Checks one log against its plan: time order, the opening first, no placeholder
 *   left, valid entrant indexes, and every named squirrel's name in its line.
 * @param {Object} plan - The plan.
 * @param {Object[]} log - Its log.
 * @returns {void}
 */
function checkLog(plan, log) {
  const count = plan.entrants.length;
  assert.equal(log[0].id, 'log-opening');
  assert.equal(log[0].atMs, 0);
  log.forEach((entry, order) => {
    const text = logEntryText(entry);
    if (order > 0 && entry.atMs < log[order - 1].atMs) {
      assert.fail(`${entry.id} is out of time order`);
    }
    if (LEFT_OVER.test(text) || text.length === 0 || GENDERED.test(text)) {
      assert.fail(`${entry.id} reads "${text}"`);
    }
    entry.entrantIndexes.forEach((index) => {
      if (!Number.isInteger(index) || index < 0 || index >= count) {
        assert.fail(`${entry.id} names entrant ${index}`);
      }
      if (!text.includes(plan.entrants[index].name)) {
        assert.fail(`${entry.id} names ${plan.entrants[index].name} but does not say so`);
      }
    });
  });
}

test('the raceLog wording: unique keys, known placeholders, a title for every kind', () => {
  const lines = themeLines();
  const keys = lines.map((line) => line.key);
  assert.equal(new Set(keys).size, keys.length, 'every key is unique');
  const {templates, titles} = themeConfig.raceLog;
  Object.entries(templates).forEach(([kind, items]) => {
    assert.ok(titles[kind], `${kind} has a title`);
    assert.ok(items.length > 0, `${kind} has a line`);
    items.forEach((item) => {
      const used = [...item.text.matchAll(/\{([a-z]+)\}/g)].map((match) => match[1]);
      used.forEach((name) => {
        assert.ok(['names', 'name', 'other'].includes(name), `${item.key} uses {${name}}`);
      });
      if (item.variant === 'none') {
        assert.deepEqual(used, [], `${item.key} singles nobody out`);
      }
    });
  });
  assert.ok(templates.other.some((item) => item.variant === 'none'), 'a catch-all line');
  assert.equal(themeConfig.raceLog.list.text, '{first} and {last}');
});

test('no line or title uses a gendered pronoun (the names belong to real people)', () => {
  themeLines().forEach((line) => {
    assert.ok(!GENDERED.test(line.text), `${line.key}: ${line.text}`);
  });
});

test('an empty or broken plan gives an empty log', () => {
  assert.deepEqual(buildRaceLog(null), []);
  assert.deepEqual(buildRaceLog({}), []);
  assert.deepEqual(buildRaceLog({entrants: []}), []);
  assert.deepEqual(buildRaceLog({entrants: [null]}), []);
});

test('the opening: "And they’re off!" at 0, or a solo run', () => {
  const opening = buildRaceLog(planOf())[0];
  assert.equal(opening.id, 'log-opening');
  assert.equal(opening.atMs, 0);
  assert.equal(opening.kind, 'opening');
  assert.equal(logEntryText(opening), 'And they’re off!');
  assert.equal(opening.title, 'Go!');
  assert.deepEqual(opening.entrantIndexes, []);
  const solo = buildRaceLog(planOf({count: 1}));
  assert.equal(logEntryText(solo[0]), 'Alex is off on a solo run!');
  assert.deepEqual(solo[0].entrantIndexes, [0]);
});

test('single-squirrel events name their squirrel', () => {
  const cases = [
    [eventOf('evt-1', 'nutStop', {entrants: [1]}), 'Sam stopped to bury a nut.', 'nutStop'],
    [eventOf('evt-2', 'slip', {entrants: [2]}), 'Jo slipped down the trunk.', 'slip'],
    [eventOf('evt-3', 'burst', {entrants: [3]}), 'Priya found a burst of speed.', 'burst'],
    [
      eventOf('evt-4', 'hunter', {entrants: [2], outcome: 'hit'}),
      'A hunter blasted Jo off the branch.',
      'hunterHit'
    ],
    [
      eventOf('evt-5', 'hunter', {entrants: [0], outcome: 'miss'}),
      'A hunter took aim at Alex and missed.',
      'hunterMiss'
    ],
    [
      eventOf('evt-6', 'suitor', {entrants: [1], outcome: 'kiss'}),
      'Sam stopped for a smooch with a mysterious stranger.',
      'suitorKiss'
    ],
    [
      eventOf('evt-7', 'suitor', {entrants: [3], outcome: 'slap'}),
      'A mysterious stranger slapped Priya.',
      'suitorSlap'
    ],
    [
      eventOf('evt-8', 'eagle', {entrants: [0]}),
      'An eagle gave Alex a lift up the trunk.',
      'eagle'
    ],
    [
      eventOf('evt-9', 'beaver', {entrants: [1]}),
      'A beaver gnawed at the tree under Sam.',
      'beaver'
    ],
    [eventOf('evt-10', 'lightning', {entrants: [2]}), 'Lightning struck Jo.', 'lightning'],
    [
      eventOf('evt-11', 'woodpecker', {entrants: [3]}),
      'A woodpecker drilled the tree under Priya.',
      'woodpecker'
    ]
  ];
  cases.forEach(([event, expected, kind]) => {
    const {entry, text} = lineFor(event);
    assert.equal(text, expected, event.type);
    assert.equal(entry.kind, kind, event.type);
    assert.equal(entry.atMs, event.startMs, event.type);
    assert.equal(entry.eventId, event.id, event.type);
  });
});

test('a tornado names who it whisked away; a sharknado names the chomped hat too', () => {
  const plain = lineFor(eventOf('evt-1', 'tornado', {entrants: [0, 2], data: {sharks: false}}));
  assert.equal(plain.text, 'A tornado whisked Alex and Jo onto new trees.');
  assert.equal(plain.entry.title, 'Tornado');
  const swaps = [{entrant: 1, fromLane: 2, toLane: 4}, {entrant: 3, fromLane: 4, toLane: 2}];
  const fromSwaps = lineFor(eventOf('evt-2', 'tornado', {data: {swaps}}));
  assert.equal(fromSwaps.text, 'A tornado whisked Sam and Priya onto new trees.');
  const chomp = lineFor(eventOf('evt-3', 'tornado', {
    entrants: [0, 2, 3],
    data: {sharks: true, hatChomp: 2}
  }));
  assert.equal(chomp.entry.kind, 'sharknado');
  assert.equal(
    chomp.text,
    'A sharknado whisked Alex, Jo and Priya onto new trees, and a shark stole Jo’s hat.'
  );
  assert.deepEqual(chomp.entry.subjects, {names: [0, 2, 3], name: 2, other: null});
  const sharks = lineFor(eventOf('evt-4', 'tornado', {
    entrants: [1, 3],
    data: {sharks: true, hatChomp: null}
  }));
  assert.equal(sharks.text, 'A sharknado whisked Sam and Priya onto new trees.');
  const empty = lineFor(eventOf('evt-5', 'tornado', {data: {sharks: true}}));
  assert.equal(empty.text, 'A sharknado tore through the wood. Sharks and all.');
});

test('field events name only the squirrels singled out, or say nobody was', () => {
  const field = [0, 1, 2, 3];
  const cases = [
    [eventOf('evt-1', 'leafBlower', {entrants: field, data: {hatLoss: [2]}}),
      'A leaf blower left Jo bare-headed.'],
    [eventOf('evt-2', 'leafBlower', {entrants: field, data: {hatLoss: []}}),
      'A leaf blower left everyone hanging on like washing.'],
    [eventOf('evt-3', 'earthquake', {entrants: field, data: {slips: [0, 1]}}),
      'An earthquake shook Alex and Sam down the trunk.'],
    [eventOf('evt-4', 'flood', {entrants: field, data: {bursters: []}}),
      'A flood rose, but nobody was low enough to float.'],
    [eventOf('evt-5', 'flood', {entrants: field, data: {bursters: [3, 1]}}),
      'A flood lifted Priya and Sam up the trunk.'],
    [eventOf('evt-6', 'acornHail', {entrants: field, data: {chubby: [3]}}),
      'Acorn hail! Priya stuffed far too many nuts in.'],
    [eventOf('evt-7', 'disco', {entrants: field}), 'Disco! Everyone stopped to dance.'],
    [eventOf('evt-8', 'ufo', {entrants: [0, 3]}),
      'A UFO swapped Alex and Priya, trees and outfits included.']
  ];
  cases.forEach(([event, expected]) => {
    assert.equal(lineFor(event).text, expected, event.id);
  });
});

test('the cat lady names only the squirrels a cat landed on', () => {
  const throws = [
    {atMs: 5200, entrant: 1, clingTicks: 4, intercepted: false},
    {atMs: 5600, entrant: 3, clingTicks: 4, intercepted: true}
  ];
  const landed = lineFor(eventOf('evt-1', 'catLady', {entrants: [1, 3], data: {throws}}));
  assert.equal(landed.text, 'The cat lady landed cats on Sam.');
  assert.deepEqual(landed.entry.entrantIndexes, [1]);
  const missed = lineFor(eventOf('evt-2', 'catLady', {
    entrants: [3],
    data: {throws: [throws[1]]}
  }));
  assert.equal(missed.text, 'The cat lady hurled cats and hit nobody.');
});

test('VAR: everyone freezes at the start, the verdict lands at the end', () => {
  const event = eventOf('evt-1', 'var', {
    scope: 'field',
    entrants: [0, 1, 2, 3],
    startMs: 10000,
    endMs: 13000,
    data: {verdict: 'chaos_var_verdict_2'}
  });
  const log = buildRaceLog(planOf({events: [event]}));
  const freeze = entryById(log, 'log-evt-1');
  assert.equal(logEntryText(freeze), 'Everyone froze for VAR.');
  assert.deepEqual(freeze.entrantIndexes, []);
  const verdict = entryById(log, 'log-evt-1-verdict');
  assert.equal(verdict.kind, 'varVerdict');
  assert.equal(verdict.atMs, 13000);
  assert.equal(logEntryText(verdict), 'The acorn was over the line. Play on anyway.');
  assert.equal(verdict.title, 'VAR verdict');
  const unknown = buildRaceLog(planOf({events: [{...event, data: {verdict: null}}]}));
  const unknownVerdict = entryById(unknown, 'log-evt-1-verdict');
  assert.equal(logEntryText(unknownVerdict), 'The check is over. Play on!');
});

test('the Golden Acorn sits at its impact and names the runaway leader', () => {
  const event = eventOf('evt-1', 'goldenAcorn', {
    entrants: [1],
    startMs: 15000,
    endMs: 17000,
    data: {impactMs: 15500}
  });
  const {entry, text} = lineFor(event);
  assert.equal(entry.atMs, 15500);
  assert.equal(text, 'The Golden Acorn of Doom smacked runaway leader Sam.');
});

test('the trench coat names all three and who is on top', () => {
  const event = eventOf('evt-1', 'trenchCoat', {entrants: [1, 2, 3], data: {host: 2, hostLane: 3}});
  const {entry, text} = lineFor(event);
  assert.equal(text, 'Sam, Jo and Priya squeezed into one trench coat, with Jo on top.');
  assert.deepEqual(entry.entrantIndexes, [1, 2, 3]);
});

test('a combo is one entry that names the combo', () => {
  const cases = [
    [eventOf('evt-1', 'hunter', {data: {combo: {kind: 'hunterVsTornado', with: 'evt-9'}}}),
      'hunterVsTornado', 'A hunter shot at the tornado and got the cow back.'],
    [eventOf('evt-2', 'eagle', {entrants: [0], data: {combo: {kind: 'eagleIntoFunnel'}}}),
      'eagleIntoFunnel', 'An eagle dropped Alex straight into the tornado.'],
    [eventOf('evt-3', 'suitor', {entrants: [2], data: {combo: {kind: 'suitorSwept'}}}),
      'suitorSwept', 'Jo and a mysterious stranger were swept up mid-smooch.'],
    [eventOf('evt-4', 'eagle', {
      entrants: [1],
      data: {caught: 'cat', combo: {kind: 'catVsEagle'}}
    }), 'catVsEagle', 'An eagle caught the cat meant for Sam and flew off confused.']
  ];
  cases.forEach(([event, kind, expected]) => {
    const log = buildRaceLog(planOf({events: [event]}));
    const entries = log.filter((entry) => entry.eventId === event.id);
    assert.equal(entries.length, 1, `${kind} is one entry`);
    assert.equal(entries[0].kind, kind);
    assert.equal(logEntryText(entries[0]), expected);
  });
});

test('an unknown event type still gets a line, and both plan shapes read the same', () => {
  const odd = lineFor(eventOf('evt-1', 'meteor', {entrants: [0]}));
  assert.equal(odd.entry.kind, 'other');
  assert.equal(odd.text, 'Something odd happened to Alex.');
  assert.equal(odd.entry.title, 'Chaos');
  const v2 = eventOf('evt-2', 'earthquake', {entrants: [0, 1, 2, 3], data: {slips: [3]}});
  const v1 = {...v2, entrants: undefined, data: undefined, entrantIndexes: v2.entrants,
    details: v2.data};
  assert.equal(lineFor(v1).text, lineFor(v2).text);
});

test('finishers: the winner and runner-up by default, third when awarded', () => {
  const plan = planOf({finishOrder: [2, 0, 3, 1]});
  const log = buildRaceLog(plan);
  const places = log.filter((entry) => entry.id.startsWith('log-place-'));
  assert.deepEqual(places.map((entry) => entry.id), ['log-place-1', 'log-place-2']);
  assert.equal(logEntryText(places[0]), 'Jo grabs the chestnut and wins!');
  assert.equal(places[0].kind, 'winner');
  assert.equal(places[0].atMs, plan.entrants[2].finishMs);
  assert.equal(logEntryText(places[1]), 'Alex finishes second.');
  const three = buildRaceLog(plan, {places: 3});
  assert.equal(logEntryText(entryById(three, 'log-place-3')), 'Priya finishes third.');
  const tooMany = buildRaceLog(plan, {places: 9});
  assert.equal(tooMany.filter((entry) => entry.id.startsWith('log-place-')).length, 3);
  const tooFew = buildRaceLog(plan, {places: 0});
  assert.equal(tooFew.filter((entry) => entry.id.startsWith('log-place-')).length, 1);
  const solo = buildRaceLog(planOf({count: 1}));
  assert.deepEqual(solo.map((entry) => entry.kind), ['opening', 'winner']);
});

test('a photo finish says so: on the runner-up, or the winner when one place counts', () => {
  const plan = planOf({photoFinish: true});
  const runnerUp = entryById(buildRaceLog(plan), 'log-place-2');
  assert.equal(runnerUp.kind, 'photoFinish');
  assert.equal(logEntryText(runnerUp), 'Photo finish! Sam is second, a whisker behind Alex.');
  assert.deepEqual(runnerUp.subjects, {names: [1], name: null, other: 0});
  const winner = entryById(buildRaceLog(plan, {places: 1}), 'log-place-1');
  assert.equal(logEntryText(winner), 'Photo finish! Alex wins by a whisker from Sam.');
  assert.deepEqual(winner.entrantIndexes, [0, 1]);
});

test('entries keep time order; at the same moment: opening, events, verdicts, finishers', () => {
  const events = [
    eventOf('evt-2', 'slip', {entrants: [1], startMs: 30000}),
    eventOf('evt-1', 'nutStop', {entrants: [0], startMs: 0, sequence: 1}),
    eventOf('evt-3', 'var', {entrants: [], startMs: 20000, endMs: 30000, sequence: 3,
      data: {verdict: 'chaos_var_verdict_1'}})
  ];
  const ids = buildRaceLog(planOf({events})).map((entry) => entry.id);
  assert.deepEqual(ids, [
    'log-opening',
    'log-evt-1',
    'log-evt-3',
    'log-evt-2',
    'log-evt-3-verdict',
    'log-place-1',
    'log-place-2'
  ]);
});

test('a theme without its own raceLog falls back to the squirrel theme', () => {
  const plan = planOf({events: [eventOf('evt-1', 'slip', {entrants: [0]})]});
  assert.deepEqual(buildRaceLog(plan, {theme: {}}), buildRaceLog(plan));
});

test('real races: one entry per event, every verdict, the places, and the same log twice', () => {
  const rng = createRng(20261105);
  const shapes = CHAOS_LEVELS.map((chaosLevel) => ({
    minEntrants: 1, maxEntrants: 14, lengths: CHAOS_LENGTHS_MS, mode: 'chaos', chaosLevel
  })).concat([{minEntrants: 1, maxEntrants: 14, lengths: CLASSIC_LENGTHS_MS, mode: 'classic'}]);
  shapes.forEach((shape) => {
    for (let race = 0; race < 40; race += 1) {
      const plan = buildRacePlan(randomRaceInput(rng, shape));
      const log = buildRaceLog(plan, {places: 3});
      checkLog(plan, log);
      const ids = new Set(log.map((entry) => entry.id));
      plan.events.forEach((event) => {
        assert.ok(ids.has(`log-${event.id}`), `${event.type} ${event.id} has an entry`);
        if (event.type === 'var' && !event.data.combo) {
          const verdict = log.find((entry) => entry.id === `log-${event.id}-verdict`);
          assert.ok(verdict, `${event.id} has a verdict`);
          assert.equal(verdict.atMs, event.endMs);
        }
      });
      const places = log.filter((entry) => entry.id.startsWith('log-place-'));
      assert.equal(places.length, Math.min(3, plan.entrants.length));
      assert.deepEqual(buildRaceLog(plan, {places: 3}), log, 'the same plan, the same log');
    }
  });
});

test('logCountAt and logEntriesUpTo: entries appear when race time reaches them', () => {
  const log = buildRaceLog(planOf({events: [eventOf('evt-1', 'slip', {entrants: [0]})]}));
  assert.equal(logCountAt(log, -1), 0);
  assert.equal(logCountAt(log, 0), 1);
  assert.equal(logCountAt(log, 4999), 1);
  assert.equal(logCountAt(log, 5000), 2);
  assert.equal(logCountAt(log, 1e9), log.length);
  assert.equal(logCountAt(log, Number.NaN), 0);
  assert.equal(logCountAt(null, 5000), 0);
  const shown = logEntriesUpTo(log, 5000).map((entry) => entry.id);
  assert.deepEqual(shown, ['log-opening', 'log-evt-1']);
  assert.deepEqual(logEntriesUpTo(undefined, 5000), []);
});

test('raceClock shows minutes and seconds from Go', () => {
  assert.equal(raceClock(0), '0:00');
  assert.equal(raceClock(999), '0:00');
  assert.equal(raceClock(65400), '1:05');
  assert.equal(raceClock(600000), '10:00');
  assert.equal(raceClock(-500), '0:00');
  assert.equal(raceClock(Number.NaN), '0:00');
});

test('fillTemplate fills once; joinNames joins the theme’s way', () => {
  assert.equal(fillTemplate('{names} slipped.', {names: 'Alex'}), 'Alex slipped.');
  assert.equal(fillTemplate('{names} and {other}', {names: '{other}', other: 'Sam'}),
    '{other} and Sam');
  assert.equal(fillTemplate('{unknown} stays', {}), '{unknown} stays');
  assert.equal(fillTemplate(null), '');
  assert.equal(joinNames([]), '');
  assert.equal(joinNames(['Alex']), 'Alex');
  assert.equal(joinNames(['Alex', 'Sam']), 'Alex and Sam');
  assert.equal(joinNames(['Alex', 'Sam', 'Jo']), 'Alex, Sam and Jo');
  assert.equal(joinNames(['Alex', 'Sam'], {text: '{first} & {last}', separator: '; '}),
    'Alex & Sam');
});
