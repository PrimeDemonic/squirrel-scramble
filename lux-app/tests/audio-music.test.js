/**
 * Unit tests for the race music (components/audio/music.js, Chaos v2 contract § 9): the tempos,
 * the intensity layers, the shape of the theme, and a long run of the lookahead scheduler through
 * every layer, the disco groove, the finale's roll and key lift, silence and stop, against the
 * strict stand-in AudioContext in tests/audio-fakes.js.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  FINALE_LIFT_SEMITONES,
  STEPS_PER_BAR,
  TEMPOS,
  THEME_MELODY,
  createMusic,
  layersFor,
  tempoFor
} from '../components/audio/music.js';
import {createKit} from '../components/audio/synth.js';
import {FakeAudioContext, createManualTimers} from './audio-fakes.js';

const TICK_SECONDS = 0.03;

/**
 * @description A seeded random source.
 * @returns {function(): number} Numbers in [0, 1).
 * @since 1.0.0
 */
function seededRandom() {
  let seed = 4242;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/**
 * @description A music player on a running stand-in context, with hand-fired timers and a list
 *   of every error it reports.
 * @returns {{context: FakeAudioContext, music: Object, errors: Array, run: function(number)}}
 *   The pieces; run(seconds) moves the clock in 30 ms steps and fires the timers.
 * @since 1.0.0
 */
function player() {
  const context = new FakeAudioContext();
  context.resume();
  const timers = createManualTimers();
  const errors = [];
  const music = createMusic(createKit(context, seededRandom()), context.createGain(), {
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    onError: (error) => errors.push(error)
  });
  const run = (seconds) => {
    const rounds = Math.round(seconds / TICK_SECONDS);
    for (let round = 0; round < rounds; round += 1) {
      context.advance(TICK_SECONDS);
      timers.runDue();
    }
  };
  return {context, music, errors, run};
}

test('Classic plays at 120 bpm, Chaos at about 140 by level', () => {
  assert.equal(tempoFor('classic', null), 120);
  assert.equal(tempoFor('classic', 'carnage'), 120, 'the level is ignored in Classic');
  assert.equal(tempoFor('chaos', 'mild'), TEMPOS.mild);
  assert.equal(tempoFor('chaos', 'silly'), 140);
  assert.equal(tempoFor('chaos', 'carnage'), TEMPOS.carnage);
  assert.equal(tempoFor('chaos', null), 140, 'no level plays at Silly');
  assert.equal(tempoFor('chaos', 'turbo'), 140);
  [TEMPOS.mild, TEMPOS.silly, TEMPOS.carnage].forEach((bpm) => {
    assert.ok(bpm >= 130 && bpm <= 150, `${bpm} is about 140`);
  });
});

test('layers join as the intensity rises', () => {
  assert.deepEqual(layersFor(0), {shaker: false, glock: false, backbeat: false});
  assert.deepEqual(layersFor(0.25), {shaker: true, glock: false, backbeat: false});
  assert.deepEqual(layersFor(0.5), {shaker: true, glock: true, backbeat: false});
  assert.deepEqual(layersFor(0.75), {shaker: true, glock: true, backbeat: true});
  assert.deepEqual(layersFor(7), layersFor(1), 'clamped above');
  assert.deepEqual(layersFor('nonsense'), layersFor(0), 'nonsense is no intensity');
});

test('the theme is eight bars of notes inside their bars', () => {
  assert.equal(THEME_MELODY.length, 8);
  THEME_MELODY.forEach((bar, barIndex) => {
    assert.ok(bar.length > 0, `bar ${barIndex + 1} has notes`);
    let lastStep = -1;
    bar.forEach(([sixteenth, midi, length]) => {
      assert.ok(Number.isInteger(sixteenth) && sixteenth > lastStep, `bar ${barIndex + 1} order`);
      assert.ok(length >= 1 && sixteenth + length <= STEPS_PER_BAR, `bar ${barIndex + 1} fits`);
      assert.ok(midi >= 60 && midi <= 84, `bar ${barIndex + 1} stays in the kazoo's range`);
      lastStep = sixteenth;
    });
  });
});

test('nothing sounds before start(), and the scheduler only looks 150 ms ahead', () => {
  const {context, music, run} = player();
  run(1);
  assert.equal(context.sourceCount(), 0);
  music.start({bpm: 120, atTime: context.currentTime + 0.05});
  const horizon = context.currentTime + 0.2;
  assert.ok(context.started.every((source) => source.startTime <= horizon));
  assert.ok(music.isPlaying());
});

test('a long run through every layer, the disco, the finale and stop builds valid graphs', () => {
  const {context, music, errors, run} = player();
  music.start({bpm: TEMPOS.carnage, atTime: 0.05});
  run(4);
  music.setIntensity(1);
  run(4);
  music.discoWindow(context.currentTime, context.currentTime + 2);
  run(3);
  music.finaleLift(context.currentTime);
  run(0.5);
  assert.equal(music.keyOffset(), 0, 'the key holds until the bar line at least 1.2 s away');
  run(3.5);
  assert.equal(music.keyOffset(), FINALE_LIFT_SEMITONES, 'then lifts');
  music.lastStretch();
  music.setIntensity(0);
  run(2);
  music.setSilent(true);
  const silentFrom = context.sourceCount();
  run(1);
  assert.equal(context.sourceCount(), silentFrom, 'silent: no nodes');
  music.setSilent(false);
  run(1);
  assert.ok(context.sourceCount() > silentFrom, 'and back');
  music.stop(0.5);
  assert.equal(music.isPlaying(), false);
  const stoppedAt = context.sourceCount();
  run(1);
  assert.equal(context.sourceCount(), stoppedAt, 'stopped: no nodes');
  assert.deepEqual(errors, []);
});

test('the disco swaps in a kick on every beat', () => {
  const {context, music, run} = player();
  const kicksIn = (seconds) => {
    const before = context.started.length;
    run(seconds);
    // A kick is the only 140 Hz sine that drops in pitch.
    return context.started.slice(before).filter((source) => (
      source.kind === 'oscillator' && source.type === 'sine' && source.frequency.events.some(
        (change) => change.kind === 'exponential' && change.value === 46
      )
    )).length;
  };
  music.start({bpm: 120, atTime: 0.05});
  const themeKicks = kicksIn(4);
  music.discoWindow(context.currentTime, context.currentTime + 4);
  const discoKicks = kicksIn(4);
  assert.ok(discoKicks > themeKicks * 1.5, `${discoKicks} disco kicks against ${themeKicks}`);
});

test('after a stall the scheduler skips the missed steps instead of bursting them', () => {
  const {context, music, run} = player();
  music.start({bpm: 120, atTime: 0.05});
  run(1);
  context.advance(5);
  const before = context.started.length;
  run(TICK_SECONDS);
  const late = context.started.slice(before).filter((source) => (
    source.startTime < context.currentTime - 0.1
  ));
  assert.equal(late.length, 0);
});

test('a restart begins again from bar one with no key lift', () => {
  const {music, run, context} = player();
  music.start({bpm: 140, atTime: 0.05});
  music.finaleLift(context.currentTime);
  run(4);
  assert.equal(music.keyOffset(), FINALE_LIFT_SEMITONES);
  music.start({bpm: 140, atTime: context.currentTime + 0.05});
  assert.equal(music.keyOffset(), 0);
});
