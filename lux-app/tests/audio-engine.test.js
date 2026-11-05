/**
 * Unit tests for the race audio engine (components/audio/engine.js, race-audio.js) against the
 * stand-in browser in tests/audio-fakes.js (Chaos v2 contract § 9): the exact API, no
 * AudioContext before unlock(), safe no-ops without Web Audio, a localStorage that throws, mute
 * by gain ramp, once-per-part event sounds, the three-at-once limit, stop and finish, the page
 * visibility, and every effect and the whole music loop building valid Web Audio graphs.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRaceAudio} from '../components/audio/engine.js';
import {getRaceAudio} from '../components/audio/race-audio.js';
import {CUE_NAMES} from '../components/audio/effect-map.js';
import {createKit, createVoice} from '../components/audio/synth.js';
import {SFX_LIBRARY} from '../components/audio/sfx.js';
import {
  SOUND_PREFERENCE_KEY,
  readMutedPreference,
  writeMutedPreference
} from '../components/audio/preferences.js';
import {
  FakeAudioContext,
  createFakeEnvironment,
  createMemoryStorage,
  createThrowingStorage
} from './audio-fakes.js';

const API = [
  'cue', 'event', 'isMuted', 'onChange', 'setIntensity', 'setMuted', 'startRace', 'stop', 'unlock'
];
const CARNAGE_RACE = {mode: 'chaos', chaosLevel: 'carnage', durationMs: 60000};
const CLASSIC_RACE = {mode: 'classic', chaosLevel: null, durationMs: 20000};
const TICK_SECONDS = 0.03;

/**
 * @description A hunter event (a miss unless told otherwise).
 * @param {string} id - Its id.
 * @param {string} [outcome] - 'miss' or 'hit'.
 * @returns {Object} The event.
 * @since 1.0.0
 */
function hunterEvent(id, outcome = 'miss') {
  return {
    id, type: 'hunter', scope: 'entrants', outcome, startMs: 5000, endMs: 6000, entrants: [0],
    data: {}
  };
}

/**
 * @description A minimal event of a type.
 * @param {string} id - Its id.
 * @param {string} type - Its type.
 * @param {Object} [data] - Its data.
 * @returns {Object} The event.
 * @since 1.0.0
 */
function eventOf(id, type, data = {}) {
  return {id, type, scope: 'entrants', outcome: null, startMs: 0, endMs: 1500, entrants: [0], data};
}

/**
 * @description The engine's master gain: the gain node that feeds the limiter.
 * @param {FakeAudioContext} context - The context.
 * @returns {Object} The node.
 * @since 1.0.0
 */
function masterGainOf(context) {
  const limiter = context.created.find((node) => node.kind === 'compressor');
  return context.created.find((node) => node.kind === 'gain' && node.targets.has(limiter));
}

/**
 * @description Runs the music scheduler for a while: moves the clock in 30 ms steps and fires the
 *   short timers (never the idle or safety ones).
 * @param {Object} env - The fake environment.
 * @param {FakeAudioContext} context - Its context.
 * @param {number} seconds - How long.
 * @returns {void}
 * @since 1.0.0
 */
function runMusic(env, context, seconds) {
  const rounds = Math.round(seconds / TICK_SECONDS);
  for (let round = 0; round < rounds; round += 1) {
    context.advance(TICK_SECONDS);
    env.timers.runDue(100);
  }
}

/**
 * @description A seeded random source.
 * @returns {function(): number} Numbers in [0, 1).
 * @since 1.0.0
 */
function seededRandom() {
  let seed = 12345;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/**
 * @description An unlocked engine on a fresh stand-in browser, with a race started.
 * @param {Object} [race] - The race.
 * @returns {{env: Object, audio: Object, context: FakeAudioContext}} The pieces.
 * @since 1.0.0
 */
function racingEngine(race = CARNAGE_RACE) {
  const env = createFakeEnvironment();
  const audio = createRaceAudio(env);
  audio.unlock();
  audio.startRace(race);
  return {env, audio, context: env.contexts[0]};
}

test('getRaceAudio() returns one engine with exactly the contract’s nine methods', () => {
  const audio = getRaceAudio();
  assert.equal(getRaceAudio(), audio);
  assert.deepEqual(Object.keys(audio).sort(), API);
  API.forEach((name) => assert.equal(typeof audio[name], 'function', name));
  assert.ok(Object.isFrozen(audio));
  // Node has no AudioContext: the real singleton must still be harmless.
  assert.doesNotThrow(() => {
    audio.unlock();
    audio.setIntensity(0.5);
    audio.event(hunterEvent('evt-1'), 'start');
    audio.cue('go');
    audio.stop();
  });
  assert.equal(typeof audio.isMuted(), 'boolean');
  assert.equal(typeof audio.onChange(() => {}), 'function');
});

test('no AudioContext exists before unlock()', () => {
  const env = createFakeEnvironment();
  const audio = createRaceAudio(env);
  audio.startRace(CARNAGE_RACE);
  audio.setIntensity(0.8);
  audio.event(hunterEvent('evt-1'), 'start');
  CUE_NAMES.forEach((name) => audio.cue(name));
  audio.setMuted(true);
  audio.setMuted(false);
  audio.stop();
  assert.equal(env.contexts.length, 0);
  audio.unlock();
  assert.equal(env.contexts.length, 1);
  assert.equal(env.contexts[0].state, 'running');
  audio.unlock();
  assert.equal(env.contexts.length, 1, 'a second unlock reuses the context');
});

test('without Web Audio every method is a safe no-op', () => {
  [{noAudio: true}, {contextThrows: true}].forEach((options) => {
    const env = createFakeEnvironment(options);
    const audio = createRaceAudio(env);
    const seen = [];
    const unsubscribe = audio.onChange((muted) => seen.push(muted));
    assert.doesNotThrow(() => {
      audio.unlock();
      audio.startRace(CARNAGE_RACE);
      audio.setIntensity(2);
      audio.event(hunterEvent('evt-1'), 'start');
      audio.event(null, 'start');
      audio.event(hunterEvent('evt-2'), 'sideways');
      CUE_NAMES.forEach((name) => audio.cue(name));
      audio.cue('nonsense');
      audio.setMuted(true);
      audio.stop();
      unsubscribe();
    }, JSON.stringify(options));
    assert.equal(audio.isMuted(), true);
    assert.deepEqual(seen, [true]);
  });
});

test('malformed calls never throw once audio is unlocked', () => {
  const {audio} = racingEngine();
  assert.doesNotThrow(() => {
    audio.startRace(null);
    audio.startRace({mode: 42, durationMs: -5});
    audio.setIntensity(Number.NaN);
    audio.setIntensity('loud');
    audio.event(undefined);
    audio.event('tornado', 'start');
    audio.event({type: 'tornado'}, 'start');
    audio.event({id: 'x', type: '__proto__'}, 'start');
    audio.event({id: 'y', type: 'catLady', data: {throws: [null, {atMs: 'soon'}]}}, 'start');
    audio.cue();
    audio.cue(null);
    audio.setMuted('yes');
  });
  assert.equal(audio.isMuted(), true);
  const unsubscribe = audio.onChange('not a function');
  assert.equal(typeof unsubscribe, 'function');
  assert.doesNotThrow(unsubscribe);
});

test('a throwing localStorage is tolerated: sound defaults to on and muting still works', () => {
  [{storage: createThrowingStorage()}, {storageGetterThrows: true}].forEach((options) => {
    const audio = createRaceAudio(createFakeEnvironment(options));
    assert.equal(audio.isMuted(), false);
    const seen = [];
    audio.onChange((muted) => seen.push(muted));
    assert.doesNotThrow(() => audio.setMuted(true));
    assert.equal(audio.isMuted(), true);
    assert.deepEqual(seen, [true]);
  });
});

test('the preference helpers survive missing, throwing and hostile storage', () => {
  assert.equal(readMutedPreference(null), false);
  assert.equal(readMutedPreference(undefined), false);
  assert.equal(readMutedPreference(createThrowingStorage()), false);
  assert.equal(writeMutedPreference(null, true), false);
  assert.equal(writeMutedPreference(createThrowingStorage(), true), false);
  const hostile = {
    get getItem() {
      throw new Error('blocked');
    },
    get setItem() {
      throw new Error('blocked');
    }
  };
  assert.equal(readMutedPreference(hostile), false);
  assert.equal(writeMutedPreference(hostile, true), false);
});

test('the preference is stored under the app key and read back by a new engine', () => {
  const storage = createMemoryStorage();
  assert.equal(readMutedPreference(storage), false, 'nothing stored means sound on');
  createRaceAudio(createFakeEnvironment({storage})).setMuted(true);
  assert.equal(storage.getItem(SOUND_PREFERENCE_KEY), 'off');
  assert.equal(createRaceAudio(createFakeEnvironment({storage})).isMuted(), true);
  assert.equal(writeMutedPreference(storage, false), true);
  assert.equal(storage.getItem(SOUND_PREFERENCE_KEY), 'on');
  storage.setItem(SOUND_PREFERENCE_KEY, 'banana');
  assert.equal(readMutedPreference(storage), false, 'an unknown value means sound on');
});

test('setMuted() notifies once per change; the unsubscribe and a broken listener', () => {
  const audio = createRaceAudio(createFakeEnvironment());
  const seen = [];
  const unsubscribe = audio.onChange((muted) => seen.push(muted));
  audio.setMuted(true);
  audio.setMuted(true);
  audio.setMuted(false);
  assert.deepEqual(seen, [true, false]);
  unsubscribe();
  audio.setMuted(true);
  assert.deepEqual(seen, [true, false]);
  audio.onChange(() => {
    throw new Error('a listener bug');
  });
  const later = [];
  audio.onChange((muted) => later.push(muted));
  assert.doesNotThrow(() => audio.setMuted(false));
  assert.deepEqual(later, [false]);
});

test('muting ramps the master gain to 0 at once and never stops the graph', () => {
  const env = createFakeEnvironment();
  const audio = createRaceAudio(env);
  audio.unlock();
  const context = env.contexts[0];
  const master = masterGainOf(context);
  assert.ok(master, 'a master gain feeds the limiter');
  assert.equal(master.gain.value, 0.9);
  audio.setMuted(true);
  const muteRamp = master.gain.lastEvent();
  assert.equal(muteRamp.kind, 'target');
  assert.equal(muteRamp.value, 0);
  assert.ok(muteRamp.timeConstant <= 0.02, 'silent within a few milliseconds');
  assert.equal(context.calls.suspend, 0);
  assert.equal(context.calls.close, 0);
  assert.equal(context.state, 'running');
  audio.setMuted(false);
  assert.equal(master.gain.lastEvent().value, 0.9);
});

test('the buses: music and SFX into the master, into a limiter, into the speakers', () => {
  const {context} = racingEngine();
  const limiter = context.created.find((node) => node.kind === 'compressor');
  assert.ok(limiter.targets.has(context.destination));
  const master = masterGainOf(context);
  const buses = context.created.filter((node) => node.kind === 'gain' && node.targets.has(master));
  const levels = buses.map((bus) => bus.gain.value).sort();
  assert.deepEqual(levels, [0.3, 0.8], 'the music bus is quieter than the SFX bus');
});

test('a muted engine starts silent', () => {
  const storage = createMemoryStorage();
  storage.setItem(SOUND_PREFERENCE_KEY, 'off');
  const env = createFakeEnvironment({storage});
  const audio = createRaceAudio(env);
  assert.equal(audio.isMuted(), true);
  audio.unlock();
  assert.equal(masterGainOf(env.contexts[0]).gain.value, 0);
});

test('an event sounds after unlock, each part once, and nothing is made while muted', () => {
  const {audio, context} = racingEngine();
  const before = context.sourceCount();
  audio.event(hunterEvent('evt-1'), 'start');
  const afterStart = context.sourceCount();
  assert.ok(afterStart > before, 'the pop and the boing play');
  audio.event(hunterEvent('evt-1'), 'impact');
  audio.event(hunterEvent('evt-1'), 'start');
  assert.equal(context.sourceCount(), afterStart, 'never twice for the same event');
  audio.setMuted(true);
  context.advance(1);
  audio.event(hunterEvent('evt-2', 'hit'), 'start');
  audio.cue('photoFinish');
  assert.equal(context.sourceCount(), afterStart, 'muted: no new nodes');
});

test('at most three effects sound at once, and each type keeps its minimum gap', () => {
  const {audio, context} = racingEngine();
  const crowd = [
    eventOf('a', 'earthquake', {slips: []}),
    eventOf('b', 'leafBlower', {hatLoss: []}),
    eventOf('c', 'woodpecker'),
    eventOf('d', 'beaver')
  ];
  const added = crowd.map((raceEvent) => {
    const before = context.sourceCount();
    audio.event(raceEvent, 'start');
    return context.sourceCount() - before;
  });
  assert.ok(added.slice(0, 3).every((count) => count > 0), 'the first three play');
  assert.equal(added[3], 0, 'a fourth at the same moment is dropped');
  context.advance(5);
  let before = context.sourceCount();
  audio.event(eventOf('s1', 'slip'), 'start');
  assert.ok(context.sourceCount() > before, 'a slip plays');
  context.advance(0.1);
  before = context.sourceCount();
  audio.event(eventOf('s2', 'slip'), 'start');
  assert.equal(context.sourceCount(), before, 'another slip 100 ms later is dropped');
  context.advance(0.2);
  before = context.sourceCount();
  audio.event(eventOf('s3', 'slip'), 'start');
  assert.ok(context.sourceCount() > before, 'after the 250 ms gap it plays');
});

test('the owl’s hoot goes through the throttle and respects mute (contract § 12)', () => {
  const {audio, context} = racingEngine();
  let before = context.sourceCount();
  audio.cue('hoot');
  const afterHoot = context.sourceCount();
  assert.ok(afterHoot > before, 'the hoot plays');
  audio.cue('hoot');
  assert.equal(context.sourceCount(), afterHoot, 'a second hoot at once is dropped (its gap)');
  context.advance(2);
  before = context.sourceCount();
  audio.cue('hoot');
  assert.ok(context.sourceCount() > before, 'after the gap it plays again');
  context.advance(2);
  audio.setMuted(true);
  before = context.sourceCount();
  audio.cue('hoot');
  assert.equal(context.sourceCount(), before, 'muted: no hoot');
  audio.setMuted(false);
  ['a', 'b', 'c'].forEach((id, order) => {
    const type = ['earthquake', 'leafBlower', 'woodpecker'][order];
    audio.event(eventOf(id, type, {slips: [], hatLoss: []}), 'start');
  });
  before = context.sourceCount();
  audio.cue('hoot');
  assert.equal(context.sourceCount(), before, 'three sounds already playing: the hoot is dropped');
  audio.cue('go');
  assert.ok(context.sourceCount() > before, 'a race cue still plays over them');
});

test('stop() cuts the music and pending event sounds; the finish cue still plays', () => {
  const {env, audio, context} = racingEngine();
  audio.event(eventOf('v', 'var', {verdict: 'var_verdict_1'}), 'start');
  audio.stop();
  const now = context.currentTime;
  const pending = context.started.filter((source) => source.startTime > now + 0.5);
  assert.ok(pending.length > 0, 'the VAR verdict was waiting');
  assert.ok(pending.every((source) => source.stopTime <= now + 0.1), 'and is cut');
  audio.cue('finish');
  const afterFinish = context.sourceCount();
  assert.ok(afterFinish > pending.length, 'the fanfare and cheer play');
  runMusic(env, context, 1);
  assert.equal(context.sourceCount(), afterFinish, 'the music has stopped');
});

test('cue("finish") then stop() keeps the fanfare playing', () => {
  const {audio, context} = racingEngine();
  const before = context.started.length;
  audio.cue('finish');
  const fanfare = context.started.slice(before);
  const longest = Math.max(...fanfare.map((source) => source.stopTime));
  audio.stop();
  assert.equal(Math.max(...fanfare.map((source) => source.stopTime)), longest);
  assert.ok(longest > context.currentTime + 2);
});

test('the music keeps time without making nodes while muted', () => {
  const {env, audio, context} = racingEngine(CLASSIC_RACE);
  runMusic(env, context, 2);
  const playing = context.sourceCount();
  assert.ok(playing > 20, 'two seconds of the theme make notes');
  audio.setMuted(true);
  runMusic(env, context, 2);
  assert.equal(context.sourceCount(), playing, 'muted: no new nodes');
  const scheduler = env.timers.pending().filter((timer) => timer.delayMs <= 100);
  assert.equal(scheduler.length, 1, 'the scheduler keeps waking');
  audio.setMuted(false);
  runMusic(env, context, 1);
  assert.ok(context.sourceCount() > playing, 'the theme comes back');
});

test('a hidden page suspends the context; showing it again resumes a race', () => {
  const {env, audio, context} = racingEngine();
  env.document.setHidden(true);
  assert.equal(context.state, 'suspended');
  const before = context.sourceCount();
  audio.event(hunterEvent('evt-9'), 'start');
  assert.equal(context.sourceCount(), before, 'nothing queues up while hidden');
  env.document.setHidden(false);
  assert.equal(context.state, 'running');
  audio.stop();
  env.document.setHidden(true);
  env.document.setHidden(false);
  assert.equal(context.state, 'suspended', 'no race: it sleeps until the next unlock');
  audio.unlock();
  assert.equal(context.state, 'running');
});

test('the context sleeps a while after a race ends', () => {
  const {env, audio, context} = racingEngine();
  audio.cue('finish');
  assert.equal(context.state, 'running');
  env.timers.runDue();
  assert.equal(context.state, 'suspended');
});

test('every effect builds a valid graph, ends within its durationMs and cleans up', () => {
  Object.entries(SFX_LIBRARY).forEach(([effectId, definition]) => {
    const context = new FakeAudioContext();
    const kit = createKit(context, seededRandom());
    const destination = context.createGain();
    const voice = createVoice(kit, destination, {kind: 'event'});
    assert.doesNotThrow(() => definition.play(voice, 1, {keyOffset: 2}), effectId);
    const sources = context.started;
    assert.ok(sources.length > 0, `${effectId} schedules sound`);
    assert.ok(sources.every((source) => source.startTime >= 1), `${effectId} starts on time`);
    const latest = Math.max(...sources.map((source) => source.stopTime));
    assert.ok(latest - 1 <= definition.durationMs / 1000 + 0.001,
      `${effectId} sounds for ${latest - 1} s, beyond its durationMs`);
    context.advance(10);
    const leftovers = context.created.filter((node) => (
      node.targets.size > 0 && node !== destination
    ));
    assert.equal(leftovers.length, 0, `${effectId} disconnects every node when it ends`);
  });
});
