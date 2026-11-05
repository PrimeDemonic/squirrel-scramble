/**
 * Unit tests for the event and cue sound map (components/audio/effect-map.js, Chaos v2 contract
 * § 9): every § 4 event type (the tornado with its sharks and cow, the hunter's hit and miss, the
 * suitor's kiss and slap, and every other type) and every cue has a sound from the SFX library;
 * the type list matches the theme's decks and real plans; part names make each moment play once;
 * and malformed input plans nothing instead of throwing.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  CUE_GAP_MS,
  CUE_NAMES,
  EVENT_PHASES,
  EVENT_TYPES,
  MIN_GAP_MS,
  eventIdOf,
  minGapFor,
  soundsForCue,
  soundsForEvent
} from '../components/audio/effect-map.js';
import {SFX_LIBRARY} from '../components/audio/sfx.js';
import {themeConfig} from '../lib/theme-config.js';
import {buildRacePlan} from '../lib/choreography.js';
import {createRng} from '../lib/rng.js';
import {CHAOS_LENGTHS_MS, CLASSIC_LENGTHS_MS, randomRaceInput} from './support.js';

/** The § 4 catalogue, as the contract lists it. */
const CONTRACT_TYPES = [
  'tornado', 'hunter', 'suitor', 'eagle', 'beaver', 'lightning',
  'catLady', 'goldenAcorn', 'leafBlower', 'ufo', 'earthquake', 'flood', 'disco', 'acornHail',
  'var', 'trenchCoat', 'woodpecker', 'nutStop', 'slip', 'burst'
];

/** Keys of chaosDeck that are settings, not event types. */
const DECK_SETTINGS = [
  'crowdedFieldAbove', 'crowdedChanceFactor', 'placementAttempts', 'coverageAttempts',
  'finaleSlotAttempts', 'intensity', 'compensation', 'clusterWeights'
];

/**
 * @description A plan event of a type, Chaos v2 shape.
 * @param {string} type - The type.
 * @param {{outcome?: string, data?: Object, startMs?: number, endMs?: number,
 *   id?: string}} [extra] - Overrides.
 * @returns {Object} The event.
 * @since 1.0.0
 */
function planEvent(type, extra = {}) {
  return {
    id: extra.id || `evt-${type}`,
    type,
    scope: 'entrants',
    outcome: extra.outcome === undefined ? null : extra.outcome,
    startMs: extra.startMs === undefined ? 10000 : extra.startMs,
    endMs: extra.endMs === undefined ? 11500 : extra.endMs,
    entrants: [0],
    data: extra.data || {}
  };
}

/**
 * @description The effect ids a start plans for an event.
 * @param {Object} raceEvent - The event.
 * @returns {string[]} The effects.
 * @since 1.0.0
 */
function startEffects(raceEvent) {
  return soundsForEvent(raceEvent, 'start').sounds.map((planned) => planned.effect);
}

test('the type list is exactly the contract’s § 4 catalogue', () => {
  assert.deepEqual([...EVENT_TYPES].sort(), [...CONTRACT_TYPES].sort());
  assert.deepEqual(Object.keys(MIN_GAP_MS).sort(), [...CONTRACT_TYPES].sort());
});

test('every event type in the theme’s decks has a sound', () => {
  Object.keys(themeConfig.classicEvents).forEach((type) => {
    assert.ok(EVENT_TYPES.includes(type), `Classic ${type}`);
  });
  Object.entries(themeConfig.chaosDeck)
    .filter(([key, value]) => value && typeof value === 'object' && !DECK_SETTINGS.includes(key))
    .forEach(([type]) => assert.ok(EVENT_TYPES.includes(type), `Chaos ${type}`));
  Object.keys(themeConfig.chaosDeck.clusterWeights).forEach((type) => {
    assert.ok(EVENT_TYPES.includes(type), `cluster ${type}`);
  });
});

test('every type plans at least one sound on start, all from the SFX library', () => {
  EVENT_TYPES.forEach((type) => {
    const plan = soundsForEvent(planEvent(type), 'start');
    assert.ok(plan.sounds.length > 0, `${type} has a sound`);
    assert.equal(plan.id, `evt-${type}`);
    assert.equal(plan.throttleKey, type);
    plan.sounds.forEach((planned) => {
      assert.ok(SFX_LIBRARY[planned.effect], `${type}: ${planned.effect} is in the library`);
      assert.ok(planned.atMs >= 0 && planned.atMs <= 8000, `${type}: ${planned.atMs} ms`);
      assert.equal(typeof planned.part, 'string');
    });
    const parts = plan.sounds.map((planned) => planned.part);
    assert.equal(new Set(parts).size, parts.length, `${type} parts are unique`);
  });
});

test('every impact and end sound is in the library and keyed by phase', () => {
  EVENT_TYPES.forEach((type) => {
    ['impact', 'end'].forEach((phase) => {
      const plan = soundsForEvent(planEvent(type, {outcome: 'kiss', data: {sharks: true}}), phase);
      assert.equal(plan.throttleKey, `${type}:${phase}`);
      plan.sounds.forEach((planned) => {
        assert.ok(SFX_LIBRARY[planned.effect], `${type} ${phase}: ${planned.effect}`);
      });
    });
  });
});

test('the tornado: wind and the cow; with sharks, a chomp halfway through the flight', () => {
  const plain = planEvent('tornado', {data: {sharks: false, flightEndMs: 12500}});
  assert.deepEqual(startEffects(plain).sort(), ['cowWarble', 'windWhoosh']);
  const sharknado = planEvent('tornado', {data: {sharks: true, hatChomp: 2, flightEndMs: 12500}});
  const sounds = soundsForEvent(sharknado, 'start').sounds;
  const chomp = sounds.find((planned) => planned.effect === 'sharkChomp');
  assert.ok(chomp, 'sharks chomp');
  assert.equal(chomp.atMs, 1250);
  assert.deepEqual(soundsForEvent(plain, 'impact').sounds, []);
  assert.equal(soundsForEvent(sharknado, 'impact').sounds[0].part, chomp.part);
});

test('the hunter: a pop, a boing on a miss, and the cow back at him against a tornado', () => {
  assert.deepEqual(startEffects(planEvent('hunter', {outcome: 'hit'})), ['popGun']);
  assert.deepEqual(startEffects(planEvent('hunter', {outcome: 'miss'})), ['popGun', 'boing']);
  const versus = planEvent('hunter', {
    outcome: 'miss', data: {combo: {kind: 'hunterVsTornado', with: 'evt-1'}}
  });
  assert.deepEqual(startEffects(versus), ['popGun', 'cowWarble', 'boing']);
});

test('the suitor: a smooch on a kiss, a crack on a slap', () => {
  assert.deepEqual(startEffects(planEvent('suitor', {outcome: 'kiss'})), ['smooch']);
  assert.deepEqual(startEffects(planEvent('suitor', {outcome: 'slap'})), ['slapCrack']);
  const swept = planEvent('suitor', {
    outcome: 'kiss', data: {combo: {kind: 'suitorSwept', with: 'evt-3'}}
  });
  assert.deepEqual(startEffects(swept), ['smooch']);
  const impact = soundsForEvent(planEvent('suitor', {outcome: 'slap'}), 'impact').sounds;
  assert.deepEqual(impact.map((planned) => [planned.effect, planned.atMs]), [['slapCrack', 0]]);
});

test('each § 9 table row gets its effect', () => {
  const expected = {
    eagle: 'eagleScreech',
    beaver: 'gnaw',
    lightning: 'thunderCrack',
    catLady: 'cackle',
    goldenAcorn: 'acornWhistle',
    leafBlower: 'motorHum',
    ufo: 'theremin',
    earthquake: 'rumble',
    flood: 'bubbles',
    acornHail: 'pitterPatter',
    var: 'refWhistle',
    trenchCoat: 'tiptoe',
    woodpecker: 'knocks',
    slip: 'slideDown',
    burst: 'slideUp',
    nutStop: 'crunch',
    disco: 'discoSparkle'
  };
  Object.entries(expected).forEach(([type, effect]) => {
    assert.ok(startEffects(planEvent(type)).includes(effect), `${type} plays ${effect}`);
  });
  assert.ok(startEffects(planEvent('goldenAcorn')).includes('bonk'), 'the acorn bonks');
  assert.deepEqual(startEffects(planEvent('var')), ['refWhistle', 'suspenseSting', 'verdictDing']);
});

test('the cat lady meows once per cat, and the nth impact is the nth cat', () => {
  const catLady = planEvent('catLady', {
    data: {throws: [{atMs: 10000}, {atMs: 10500}, {atMs: 11000}]}
  });
  const sounds = soundsForEvent(catLady, 'start').sounds;
  const meows = sounds.filter((planned) => planned.effect === 'meowSweep');
  assert.deepEqual(meows.map((planned) => planned.atMs), [0, 500, 1000]);
  assert.deepEqual(meows.map((planned) => planned.part), ['meow-0', 'meow-1', 'meow-2']);
  assert.equal(soundsForEvent(catLady, 'impact', 2).sounds[0].part, 'meow-2');
  const caught = planEvent('eagle', {data: {caught: 'cat', combo: {kind: 'catVsEagle'}}});
  assert.deepEqual(startEffects(caught), ['eagleScreech', 'meowSweep']);
});

test('the flood bursts only when someone is below the waterline', () => {
  assert.deepEqual(startEffects(planEvent('flood', {data: {bursters: []}})), ['bubbles']);
  const flood = planEvent('flood', {data: {bursters: [1, 3], burstAtMs: 10500}});
  const burst = soundsForEvent(flood, 'start').sounds.find((planned) => planned.part === 'burst');
  assert.equal(burst.effect, 'bubbleBurst');
  assert.equal(burst.atMs, 500);
});

test('the trench coat topples when the disguise ends', () => {
  const coat = planEvent('trenchCoat', {data: {disguiseTicks: 4}});
  const topple = soundsForEvent(coat, 'start').sounds.find((planned) => planned.part === 'topple');
  assert.equal(topple.atMs, 1000);
  assert.equal(soundsForEvent(coat, 'end').sounds[0].part, 'topple');
});

test('the disco switches the music for its window and back on end', () => {
  const disco = planEvent('disco', {startMs: 20000, endMs: 22000});
  assert.deepEqual(soundsForEvent(disco, 'start').music, [
    {action: 'disco', fromMs: 0, untilMs: 2000}
  ]);
  assert.deepEqual(soundsForEvent(disco, 'end').music, [{action: 'discoEnd'}]);
  assert.deepEqual(soundsForEvent(planEvent('ufo'), 'start').music, []);
});

test('every cue has sounds from the library', () => {
  assert.deepEqual(
    [...CUE_NAMES],
    ['go', 'lastStretch', 'finaleBurst', 'photoFinish', 'finish', 'hoot']
  );
  CUE_NAMES.forEach((name) => {
    const cueSounds = soundsForCue(name);
    assert.ok(cueSounds && cueSounds.sounds.length > 0, `${name} has a sound`);
    cueSounds.sounds.forEach((planned) => {
      assert.ok(SFX_LIBRARY[planned.effect], `${name}: ${planned.effect}`);
    });
  });
  const finish = soundsForCue('finish');
  assert.deepEqual(finish.sounds.map((planned) => planned.effect), ['fanfare', 'crowdCheer']);
  assert.deepEqual(finish.music, [{action: 'fadeOut'}]);
  assert.equal(soundsForCue('photoFinish').sounds[0].effect, 'cameraClick');
  assert.deepEqual(soundsForCue('finaleBurst').music, [{action: 'finale'}]);
  assert.equal(soundsForCue('applause'), null);
  assert.equal(soundsForCue(undefined), null);
  assert.equal(soundsForCue('toString'), null);
});

test('the owl’s hoot is the one throttled cue, with its own gap (contract § 12)', () => {
  const hoot = soundsForCue('hoot');
  assert.deepEqual(hoot.sounds.map((planned) => planned.effect), ['hoot']);
  assert.deepEqual(hoot.music, []);
  assert.equal(hoot.throttled, true);
  ['go', 'lastStretch', 'finaleBurst', 'photoFinish', 'finish'].forEach((name) => {
    assert.notEqual(soundsForCue(name).throttled, true, `${name} always plays`);
  });
  assert.deepEqual(Object.keys(CUE_GAP_MS), ['hoot']);
  assert.equal(minGapFor('hoot'), CUE_GAP_MS.hoot);
  assert.ok(CUE_GAP_MS.hoot >= SFX_LIBRARY.hoot.durationMs, 'two hoots never overlap');
  assert.ok(!Object.prototype.hasOwnProperty.call(MIN_GAP_MS, 'hoot'), 'not an event type');
});

test('both event shapes plan the same sounds', () => {
  const current = planEvent('catLady', {data: {throws: [{atMs: 10000}, {atMs: 10500}]}});
  const earlier = {
    id: current.id,
    type: current.type,
    outcome: current.outcome,
    startMs: current.startMs,
    endMs: current.endMs,
    entrantIndexes: current.entrants,
    details: current.data
  };
  assert.deepEqual(soundsForEvent(earlier, 'start'), soundsForEvent(current, 'start'));
  const normalised = {...planEvent('hunter', {outcome: 'miss'}), combo: {kind: 'hunterVsTornado'}};
  assert.deepEqual(startEffects(normalised), ['popGun', 'cowWarble', 'boing']);
});

test('malformed input plans nothing and never throws', () => {
  const nothingPlanned = [
    soundsForEvent(null, 'start'),
    soundsForEvent(undefined, 'start'),
    soundsForEvent('tornado', 'start'),
    soundsForEvent([], 'start'),
    soundsForEvent({}, 'start'),
    soundsForEvent({type: 'zeppelin'}, 'start'),
    soundsForEvent({type: '__proto__'}, 'start'),
    soundsForEvent({type: 'constructor'}, 'start'),
    soundsForEvent(planEvent('tornado'), 'sideways'),
    soundsForEvent(planEvent('tornado'))
  ];
  nothingPlanned.forEach((plan) => {
    assert.deepEqual(plan.sounds, []);
    assert.deepEqual(plan.music, []);
  });
  const odd = soundsForEvent({type: 'tornado', startMs: 'soon', data: {flightEndMs: -4}}, 'start');
  odd.sounds.forEach((planned) => assert.ok(Number.isFinite(planned.atMs) && planned.atMs >= 0));
  const far = soundsForEvent(planEvent('catLady', {data: {throws: [{atMs: 9e9}]}}), 'start');
  far.sounds.forEach((planned) => assert.ok(planned.atMs <= 8000));
});

test('event ids: the plan id, else type and start', () => {
  assert.equal(eventIdOf(planEvent('ufo', {id: 'evt-7'})), 'evt-7');
  assert.equal(eventIdOf({type: 'ufo', startMs: 4500}), 'ufo-4500');
  assert.equal(eventIdOf({type: 'ufo', id: 0}), '0');
  assert.equal(eventIdOf(null), '');
});

test('minimum gaps: per type, shorter for follow-ups, a default for the rest', () => {
  assert.equal(minGapFor('tornado'), 1500);
  assert.equal(minGapFor('slip'), 250);
  assert.equal(minGapFor('catLady:impact'), 120);
  assert.equal(minGapFor('mystery'), 250);
  assert.equal(minGapFor(''), 250);
  assert.equal(minGapFor(undefined), 250);
  assert.ok(EVENT_PHASES.includes('start'));
});

test('real plans: every event of every level and Classic has a start sound', () => {
  const rng = createRng(20261022);
  const shapes = [
    {mode: 'classic', lengths: CLASSIC_LENGTHS_MS},
    {mode: 'chaos', chaosLevel: 'mild', lengths: CHAOS_LENGTHS_MS},
    {mode: 'chaos', chaosLevel: 'silly', lengths: CHAOS_LENGTHS_MS},
    {mode: 'chaos', chaosLevel: 'carnage', lengths: CHAOS_LENGTHS_MS}
  ];
  const seenTypes = new Set();
  shapes.forEach((shape) => {
    for (let race = 0; race < 12; race += 1) {
      const input = randomRaceInput(rng, {minEntrants: 4, maxEntrants: 10, ...shape});
      buildRacePlan(input).events.forEach((raceEvent) => {
        seenTypes.add(raceEvent.type);
        const plan = soundsForEvent(raceEvent, 'start');
        assert.ok(plan.sounds.length > 0, `${raceEvent.type} (${raceEvent.id}) has a sound`);
        plan.sounds.forEach((planned) => assert.ok(SFX_LIBRARY[planned.effect]));
      });
    }
  });
  assert.ok(seenTypes.size >= 10, `the sample covered ${seenTypes.size} types`);
});
