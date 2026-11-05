/**
 * The race music (Chaos v2 contract § 9): an original, bouncy, looping theme in C major, all
 * synthesised. A kazoo-ish square lead plays the tune over an oom-pah bass (a tuba on beats one
 * and three), pizzicato chord plucks on beats two and four ("pah"), a soft kick and a woodblock.
 *
 * - Classic plays it at 120 bpm; Chaos at about 140 (136 Mild, 140 Silly, 144 Absolute Carnage).
 * - setIntensity(0..1) adds layers as overlapping events rise: a shaker and off-beat plucks from
 *   0.25, a glockenspiel arpeggio from 0.5, a snare backbeat and the lead doubled an octave up
 *   from 0.75.
 * - The Absolute Carnage finale burst rolls the snare into the next bar line (at least 1.2 s
 *   away), crashes there, lifts the key a whole tone and keeps every layer on.
 * - The disco swaps the rhythm section for a four-on-the-floor groove (kick on every beat, open
 *   hi-hats on the off-beats, claps, an octave-jumping bass and string stabs) for its window; the
 *   tune carries on over it.
 *
 * The tune was written for this app. It quotes no melody or motif from an existing work.
 *
 * Scheduling: a lookahead scheduler. A timer wakes every 30 ms and schedules every sixteenth
 * whose time falls within the next 150 ms, on the AudioContext clock, so the timer's own jitter
 * never reaches the beat. While silent (muted) it keeps counting sixteenths but makes no nodes.
 * After a stall (a throttled background tab) it skips the missed steps instead of bursting them.
 *
 * Pure ES module: no DOM and no globals. The timers come in through createMusic's options.
 */
import {SILENT, clamp01, createVoice, midiToHz, pluck} from './synth.js';

/** Sixteenth-note steps in one bar of 4/4. */
export const STEPS_PER_BAR = 16;

/** Semitones the finale burst lifts the key by. */
export const FINALE_LIFT_SEMITONES = 2;

/** Tempo in beats per minute: Classic, then each Chaos level. */
export const TEMPOS = Object.freeze({classic: 120, mild: 136, silly: 140, carnage: 144});

/** The intensity at which each extra layer joins in. */
export const LAYER_THRESHOLDS = Object.freeze({shaker: 0.25, glock: 0.5, backbeat: 0.75});

const STEPS_PER_BEAT = 4;
const BAR_COUNT = 8;
const LOOP_STEPS = STEPS_PER_BAR * BAR_COUNT;
const LOOKAHEAD_SECONDS = 0.15;
const WAKE_MS = 30;
const LATE_SLACK_SECONDS = 0.05;
const FADE_IN_SECONDS = 0.25;
const DEFAULT_FADE_SECONDS = 0.25;
const ROLL_LEAD_SECONDS = 1.2;
const LAST_STRETCH_FLOOR = 0.5;
const MIN_BPM = 60;
const MAX_BPM = 200;

/**
 * The chord of each bar: the tuba's "oom" notes (root on beat one, the other on beat three) and
 * the three plucked chord tones. C, F, G7, C, Am, Dm, G7, C.
 */
const CHORDS = Object.freeze([
  {root: 48, fifth: 43, tones: [60, 64, 67]},
  {root: 53, fifth: 48, tones: [60, 65, 69]},
  {root: 43, fifth: 50, tones: [59, 62, 65]},
  {root: 48, fifth: 43, tones: [60, 64, 67]},
  {root: 45, fifth: 52, tones: [60, 64, 69]},
  {root: 50, fifth: 45, tones: [62, 65, 69]},
  {root: 43, fifth: 50, tones: [59, 62, 65]},
  {root: 48, fifth: 43, tones: [60, 64, 67]}
]);

/**
 * The tune, one list per bar of [sixteenth, MIDI note, length in sixteenths]. Original: a bouncy
 * call, the call again a step higher, a wobble and a tumble, a chromatic run-up, then an answer
 * with a cartoon slip down a semitone and a "boop boop" home.
 */
export const THEME_MELODY = Object.freeze([
  [[0, 79, 2], [2, 76, 1], [3, 77, 1], [4, 79, 2], [6, 72, 2], [10, 72, 1], [11, 74, 1],
    [12, 76, 2]],
  [[0, 81, 2], [2, 77, 1], [3, 79, 1], [4, 81, 2], [6, 74, 2], [10, 74, 1], [11, 76, 1],
    [12, 77, 2]],
  [[0, 79, 1], [1, 78, 1], [2, 79, 2], [4, 74, 2], [6, 71, 2], [8, 67, 2], [10, 69, 1],
    [11, 71, 1], [12, 74, 2], [14, 77, 2]],
  [[0, 76, 2], [4, 72, 1], [6, 67, 1], [8, 72, 4], [14, 74, 1], [15, 75, 1]],
  [[0, 76, 2], [2, 81, 2], [4, 80, 1], [5, 81, 1], [6, 76, 2], [8, 72, 2], [10, 69, 2],
    [12, 71, 1], [13, 72, 1], [14, 76, 2]],
  [[0, 77, 2], [2, 74, 2], [4, 69, 2], [6, 72, 1], [7, 74, 1], [8, 77, 2], [10, 76, 1],
    [11, 75, 1], [12, 74, 2]],
  [[0, 71, 1], [1, 72, 1], [2, 74, 2], [4, 79, 2], [6, 77, 1], [7, 76, 1], [8, 74, 2],
    [10, 67, 2], [12, 69, 1], [13, 71, 1], [14, 74, 2]],
  [[0, 72, 2], [2, 67, 1], [3, 72, 1], [4, 76, 2], [6, 74, 1], [7, 72, 1], [8, 72, 2],
    [12, 67, 1], [14, 72, 1]]
]);

/** The glockenspiel's chord-tone order across a bar's eight eighth notes. */
const GLOCK_ORDER = Object.freeze([0, 1, 2, 1, 0, 1, 2, 1]);

/** The tune by loop step, for a constant-time lookup while scheduling. */
const LEAD_BY_STEP = new Map();
THEME_MELODY.forEach((bar, barIndex) => {
  bar.forEach(([sixteenth, midi, length]) => {
    LEAD_BY_STEP.set(barIndex * STEPS_PER_BAR + sixteenth, {midi, length});
  });
});

/**
 * @description The tempo for a race: 120 bpm in Classic; in Chaos 136, 140 or 144 by level (an
 *   unknown level plays at Silly's 140).
 * @param {string} mode - 'classic' or 'chaos'.
 * @param {string|null} chaosLevel - 'mild', 'silly' or 'carnage'.
 * @returns {number} Beats per minute.
 * @example
 *   tempoFor('chaos', 'carnage');
 *   // 144
 * @since 1.0.0
 */
export function tempoFor(mode, chaosLevel) {
  if (mode !== 'chaos') {
    return TEMPOS.classic;
  }
  if (chaosLevel === 'mild' || chaosLevel === 'carnage') {
    return TEMPOS[chaosLevel];
  }
  return TEMPOS.silly;
}

/**
 * @description Which extra layers play at an intensity.
 * @param {number} level - 0 to 1 (clamped).
 * @returns {{shaker: boolean, glock: boolean, backbeat: boolean}} The layers.
 * @example
 *   layersFor(0.6);
 *   // {shaker: true, glock: true, backbeat: false}
 * @since 1.0.0
 */
export function layersFor(level) {
  const value = clamp01(level);
  return {
    shaker: value >= LAYER_THRESHOLDS.shaker,
    glock: value >= LAYER_THRESHOLDS.glock,
    backbeat: value >= LAYER_THRESHOLDS.backbeat
  };
}

/**
 * @description A biquad filter connected to a target.
 * @param {BaseAudioContext} context - The AudioContext.
 * @param {string} type - The filter type.
 * @param {number} frequency - Hertz.
 * @param {number} quality - Q.
 * @param {AudioNode} target - What it feeds.
 * @returns {BiquadFilterNode} The filter.
 * @since 1.0.0
 */
function filterNode(context, type, frequency, quality, target) {
  const node = context.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = quality;
  node.connect(target);
  return node;
}

/**
 * @description The music's long-lived buses: one output (faded in and out), the kazoo's nasal
 *   filters, the tuba's lowpass, the drum filters and the disco's bass and stab filters. Notes
 *   are short-lived voices that play into these.
 * @param {BaseAudioContext} context - The AudioContext.
 * @param {AudioNode} destination - The music bus.
 * @returns {Object<string, AudioNode>} The buses.
 * @since 1.0.0
 */
function buildBuses(context, destination) {
  const out = context.createGain();
  out.gain.value = 0;
  out.connect(destination);
  const leadTone = filterNode(context, 'lowpass', 3200, 0.7, out);
  const nasal = filterNode(context, 'peaking', 1150, 1.4, leadTone);
  nasal.gain.value = 6;
  const drums = context.createGain();
  drums.connect(out);
  const bright = context.createGain();
  bright.connect(out);
  return {
    out,
    lead: nasal,
    bass: filterNode(context, 'lowpass', 700, 0.7, out),
    bright,
    drums,
    shaker: filterNode(context, 'highpass', 6500, 0.7, drums),
    hat: filterNode(context, 'highpass', 7500, 0.7, drums),
    snare: filterNode(context, 'bandpass', 1900, 0.8, drums),
    clap: filterNode(context, 'bandpass', 1400, 1.2, drums),
    crash: filterNode(context, 'highpass', 4500, 0.5, drums),
    discoBass: filterNode(context, 'lowpass', 950, 0.9, out),
    stab: filterNode(context, 'lowpass', 2400, 0.8, out)
  };
}

/**
 * @description Makes the music player for one AudioContext. Nothing sounds until start().
 * @param {{context: BaseAudioContext, random: function(): number, noiseBuffer: AudioBuffer}} kit -
 *   From synth.js createKit().
 * @param {AudioNode} destination - The music bus.
 * @param {{setTimer: function(Function, number): *, clearTimer: function(*): void,
 *   onError?: function(*): void}} options - The scheduler's timers, and where errors go.
 * @returns {{start: Function, stop: Function, setIntensity: Function, setSilent: Function,
 *   discoWindow: Function, endDisco: Function, finaleLift: Function, lastStretch: Function,
 *   keyOffset: Function, isPlaying: Function, dispose: Function}} The player.
 * @example
 *   const music = createMusic(kit, musicBus, {setTimer, clearTimer});
 *   music.start({bpm: tempoFor('chaos', 'silly'), atTime: context.currentTime + 0.05});
 * @since 1.0.0
 */
export function createMusic(kit, destination, options) {
  const settings = options || {};
  const {context} = kit;
  const setTimer = typeof settings.setTimer === 'function' ? settings.setTimer : null;
  const clearTimer = typeof settings.clearTimer === 'function' ? settings.clearTimer : null;
  const onError = typeof settings.onError === 'function' ? settings.onError : null;
  const buses = buildBuses(context, destination);
  let playing = false;
  let silent = false;
  let stepSeconds = 60 / TEMPOS.classic / STEPS_PER_BEAT;
  let step = 0;
  let nextTime = 0;
  let intensity = 0;
  let floor = 0;
  let keyShift = 0;
  let liftAt = Infinity;
  let rollFrom = Infinity;
  let crashed = true;
  let discoFrom = Infinity;
  let discoUntil = -Infinity;
  let timer = null;

  /**
   * @description Passes an error to the engine, if it asked for them.
   * @param {*} error - What went wrong.
   * @returns {void}
   * @since 1.0.0
   */
  function report(error) {
    if (onError) {
      onError(error);
    }
  }

  /**
   * @description A short-lived voice on one of the buses.
   * @param {AudioNode} bus - The bus.
   * @returns {Object} The voice.
   * @since 1.0.0
   */
  function voiceOn(bus) {
    return createVoice(kit, bus, {kind: 'music'});
  }

  /**
   * @description The frequency of a note in the current key.
   * @param {number} midi - The note, before the finale's lift.
   * @returns {number} Hertz.
   * @since 1.0.0
   */
  function pitch(midi) {
    return midiToHz(midi + keyShift);
  }

  /**
   * @description The kazoo lead: a square reed and a buzzy sawtooth edge that scoop up into the
   *   note, through the nasal bus filters, with a vibrato that grows on longer notes.
   * @param {number} time - Start time.
   * @param {number} midi - The note.
   * @param {number} seconds - Length.
   * @param {number} level - Peak level.
   * @returns {void}
   * @since 1.0.0
   */
  function kazoo(time, midi, seconds, level) {
    const voice = voiceOn(buses.lead);
    const frequency = pitch(midi);
    const end = time + seconds;
    const amp = voice.gain(SILENT);
    amp.gain.setValueAtTime(SILENT, time);
    amp.gain.linearRampToValueAtTime(level, time + 0.012);
    amp.gain.linearRampToValueAtTime(level * 0.8, end);
    amp.gain.exponentialRampToValueAtTime(SILENT, end + 0.05);
    const reed = voice.osc('square', frequency * 0.94, time, end + 0.06, amp);
    reed.frequency.exponentialRampToValueAtTime(frequency, time + 0.035);
    const buzz = voice.gain(0.45, amp);
    const edge = voice.osc('sawtooth', frequency * 0.94, time, end + 0.06, buzz);
    edge.frequency.exponentialRampToValueAtTime(frequency, time + 0.035);
    edge.detune.setValueAtTime(8, time);
    if (seconds > 0.18) {
      const wobble = voice.lfo(5.8, 0, time, end + 0.06, reed.detune);
      wobble.gain.setValueAtTime(0, time);
      wobble.gain.linearRampToValueAtTime(16, time + 0.15);
      wobble.connect(edge.detune);
    }
  }

  /**
   * @description The tuba "oom": a triangle with a square edge and a little pitch blat.
   * @param {number} time - Start time.
   * @param {number} midi - The note.
   * @param {number} seconds - Length.
   * @param {number} level - Peak level.
   * @returns {void}
   * @since 1.0.0
   */
  function tuba(time, midi, seconds, level) {
    const voice = voiceOn(buses.bass);
    const frequency = pitch(midi);
    const end = time + seconds;
    const amp = voice.gain(SILENT);
    amp.gain.setValueAtTime(SILENT, time);
    amp.gain.linearRampToValueAtTime(level, time + 0.025);
    amp.gain.exponentialRampToValueAtTime(level * 0.55, end);
    amp.gain.exponentialRampToValueAtTime(SILENT, end + 0.06);
    const body = voice.osc('triangle', frequency, time, end + 0.08, amp);
    body.detune.setValueAtTime(-35, time);
    body.detune.linearRampToValueAtTime(0, time + 0.05);
    const blat = voice.gain(0.22, amp);
    voice.osc('square', frequency, time, end + 0.08, blat);
  }

  /**
   * @description A pizzicato pluck: a triangle with a brief octave ping.
   * @param {number} time - Start time.
   * @param {number} midi - The note.
   * @param {number} level - Peak level.
   * @returns {void}
   * @since 1.0.0
   */
  function pizz(time, midi, level) {
    const voice = voiceOn(buses.bright);
    const frequency = pitch(midi);
    const amp = voice.gain(SILENT);
    pluck(amp.gain, time, level, 0.003, 0.2);
    voice.osc('triangle', frequency, time, time + 0.26, amp);
    const ping = voice.gain(SILENT);
    pluck(ping.gain, time, level * 0.35, 0.002, 0.06);
    voice.osc('sine', frequency * 2, time, time + 0.1, ping);
  }

  /**
   * @description A strummed "pah": the chord's three tones plucked a few milliseconds apart.
   * @param {number} time - Start time.
   * @param {number[]} tones - MIDI notes.
   * @param {number} level - Peak level per note.
   * @returns {void}
   * @since 1.0.0
   */
  function strum(time, tones, level) {
    tones.forEach((midi, order) => pizz(time + order * 0.009, midi, level));
  }

  /**
   * @description A glockenspiel note: a sine with an inharmonic shimmer.
   * @param {number} time - Start time.
   * @param {number} midi - The note.
   * @param {number} level - Peak level.
   * @returns {void}
   * @since 1.0.0
   */
  function glock(time, midi, level) {
    const voice = voiceOn(buses.bright);
    const frequency = pitch(midi);
    const amp = voice.gain(SILENT);
    pluck(amp.gain, time, level, 0.002, 0.35);
    voice.osc('sine', frequency, time, time + 0.4, amp);
    const shimmer = voice.gain(SILENT);
    pluck(shimmer.gain, time, level * 0.3, 0.002, 0.12);
    voice.osc('sine', frequency * 2.76, time, time + 0.15, shimmer);
  }

  /**
   * @description A kick: a sine dropping fast in pitch.
   * @param {number} time - Start time.
   * @param {number} level - Peak level.
   * @returns {void}
   * @since 1.0.0
   */
  function kick(time, level) {
    const voice = voiceOn(buses.drums);
    const amp = voice.gain(SILENT);
    pluck(amp.gain, time, level, 0.003, 0.22);
    const body = voice.osc('sine', 140, time, time + 0.26, amp);
    body.frequency.exponentialRampToValueAtTime(46, time + 0.11);
  }

  /**
   * @description A woodblock "tok".
   * @param {number} time - Start time.
   * @param {number} level - Peak level.
   * @returns {void}
   * @since 1.0.0
   */
  function woodblock(time, level) {
    const voice = voiceOn(buses.drums);
    const amp = voice.gain(SILENT);
    pluck(amp.gain, time, level, 0.001, 0.05);
    const knock = voice.osc('sine', 1250, time, time + 0.07, amp);
    knock.frequency.exponentialRampToValueAtTime(1050, time + 0.04);
  }

  /**
   * @description One hit of noise through a drum bus filter (shaker, hi-hat, snare, clap, crash).
   * @param {AudioNode} bus - The filtered bus.
   * @param {number} time - Start time.
   * @param {number} level - Peak level.
   * @param {number} decaySeconds - How long it rings.
   * @returns {void}
   * @since 1.0.0
   */
  function noiseHit(bus, time, level, decaySeconds) {
    const voice = voiceOn(bus);
    const amp = voice.gain(SILENT);
    pluck(amp.gain, time, level, 0.002, decaySeconds);
    voice.noise(time, time + decaySeconds + 0.03, amp);
  }

  /**
   * @description A snare: a noise crack with a short tonal body.
   * @param {number} time - Start time.
   * @param {number} level - Peak level.
   * @returns {void}
   * @since 1.0.0
   */
  function snare(time, level) {
    noiseHit(buses.snare, time, level, 0.12);
    const voice = voiceOn(buses.drums);
    const amp = voice.gain(SILENT);
    pluck(amp.gain, time, level * 0.6, 0.002, 0.07);
    voice.osc('triangle', 190, time, time + 0.1, amp);
  }

  /**
   * @description A clap: three quick bursts and a short tail.
   * @param {number} time - Start time.
   * @param {number} level - Peak level.
   * @returns {void}
   * @since 1.0.0
   */
  function clap(time, level) {
    noiseHit(buses.clap, time, level * 0.7, 0.012);
    noiseHit(buses.clap, time + 0.011, level * 0.7, 0.012);
    noiseHit(buses.clap, time + 0.022, level, 0.1);
  }

  /**
   * @description The disco bass: a punchy square note.
   * @param {number} time - Start time.
   * @param {number} midi - The note.
   * @param {number} seconds - Length.
   * @param {number} level - Peak level.
   * @returns {void}
   * @since 1.0.0
   */
  function discoBass(time, midi, seconds, level) {
    const voice = voiceOn(buses.discoBass);
    const amp = voice.gain(SILENT);
    amp.gain.setValueAtTime(SILENT, time);
    amp.gain.linearRampToValueAtTime(level, time + 0.005);
    amp.gain.exponentialRampToValueAtTime(level * 0.4, time + seconds);
    amp.gain.exponentialRampToValueAtTime(SILENT, time + seconds + 0.03);
    voice.osc('square', pitch(midi), time, time + seconds + 0.05, amp);
  }

  /**
   * @description A disco string stab: the chord an octave up on sawtooths, short.
   * @param {number} time - Start time.
   * @param {number[]} tones - MIDI notes.
   * @param {number} level - Peak level.
   * @returns {void}
   * @since 1.0.0
   */
  function stab(time, tones, level) {
    const voice = voiceOn(buses.stab);
    const amp = voice.gain(SILENT);
    pluck(amp.gain, time, level, 0.004, 0.13);
    tones.forEach((midi) => {
      voice.osc('sawtooth', pitch(midi + 12), time, time + 0.18, amp);
    });
  }

  /**
   * @description The tune's note on this step, if any (quieter under the disco; doubled an
   *   octave up at full intensity).
   * @param {number} loopStep - Step within the eight-bar loop.
   * @param {number} time - Start time.
   * @param {boolean} disco - The disco groove is on.
   * @param {boolean} doubled - Double the lead an octave up.
   * @returns {void}
   * @since 1.0.0
   */
  function leadStep(loopStep, time, disco, doubled) {
    const note = LEAD_BY_STEP.get(loopStep);
    if (!note) {
      return;
    }
    const seconds = Math.max(0.07, note.length * stepSeconds * 0.88);
    const level = disco ? 0.16 : 0.2;
    kazoo(time, note.midi, seconds, level);
    if (doubled) {
      kazoo(time, note.midi + 12, seconds, level * 0.3);
    }
  }

  /**
   * @description The theme's rhythm section on one step, with the layers the intensity allows.
   * @param {{root: number, fifth: number, tones: number[]}} chord - The bar's chord.
   * @param {number} sixteenth - Step within the bar.
   * @param {number} time - Start time.
   * @param {{shaker: boolean, glock: boolean, backbeat: boolean}} layers - From layersFor().
   * @returns {void}
   * @since 1.0.0
   */
  function themeStep(chord, sixteenth, time, layers) {
    if (sixteenth === 0) {
      tuba(time, chord.root, stepSeconds * 3, 0.42);
      kick(time, 0.45);
    }
    if (sixteenth === 8) {
      tuba(time, chord.fifth, stepSeconds * 3, 0.38);
      kick(time, 0.38);
    }
    if (sixteenth === 4 || sixteenth === 12) {
      strum(time, chord.tones, 0.11);
    }
    if (sixteenth % 4 === 2) {
      woodblock(time, 0.1);
    }
    if (layers.shaker && sixteenth % 2 === 1) {
      noiseHit(buses.shaker, time, 0.045, 0.035);
    }
    if (layers.shaker && (sixteenth === 6 || sixteenth === 14)) {
      pizz(time, chord.tones[2] + 12, 0.07);
    }
    if (layers.glock && sixteenth % 2 === 0) {
      glock(time, chord.tones[GLOCK_ORDER[sixteenth / 2]] + 24, 0.05);
    }
    if (layers.backbeat && (sixteenth === 4 || sixteenth === 12)) {
      snare(time, 0.16);
    }
  }

  /**
   * @description The disco groove on one step.
   * @param {{root: number, tones: number[]}} chord - The bar's chord.
   * @param {number} sixteenth - Step within the bar.
   * @param {number} time - Start time.
   * @returns {void}
   * @since 1.0.0
   */
  function discoStep(chord, sixteenth, time) {
    if (sixteenth % 4 === 0) {
      kick(time, 0.6);
    }
    if (sixteenth % 4 === 2) {
      noiseHit(buses.hat, time, 0.09, 0.11);
    }
    if (sixteenth === 4 || sixteenth === 12) {
      clap(time, 0.2);
    }
    if (sixteenth % 2 === 0) {
      const octave = (sixteenth / 2) % 2 === 1 ? 12 : 0;
      discoBass(time, chord.root + octave, stepSeconds * 1.6, 0.22);
    }
    if (sixteenth === 6 || sixteenth === 14) {
      stab(time, chord.tones, 0.06);
    }
  }

  /**
   * @description The finale's drum roll (two snare hits per step, growing) up to the lift, and the
   *   crash on it.
   * @param {number} time - The step's time.
   * @returns {void}
   * @since 1.0.0
   */
  function rollStep(time) {
    if (time >= rollFrom && time < liftAt) {
      const progress = (time - rollFrom) / Math.max(liftAt - rollFrom, 0.001);
      const level = 0.05 + progress * 0.22;
      noiseHit(buses.snare, time, level, 0.05);
      noiseHit(buses.snare, time + stepSeconds / 2, level * 0.9, 0.05);
    }
    if (!crashed && time >= liftAt) {
      crashed = true;
      noiseHit(buses.crash, time, 0.25, 1.3);
      kick(time, 0.6);
    }
  }

  /**
   * @description State that moves with time whether or not anything sounds: the key lift, and a
   *   crash that fell while silent (dropped rather than played late).
   * @param {number} time - The step's time.
   * @returns {void}
   * @since 1.0.0
   */
  function keepTime(time) {
    if (time >= liftAt) {
      keyShift = FINALE_LIFT_SEMITONES;
      if (silent) {
        crashed = true;
      }
    }
  }

  /**
   * @description Schedules everything that plays on one step.
   * @param {number} stepIndex - Step within the loop.
   * @param {number} time - Its time.
   * @returns {void}
   * @since 1.0.0
   */
  function playStep(stepIndex, time) {
    try {
      const bar = Math.floor(stepIndex / STEPS_PER_BAR) % BAR_COUNT;
      const sixteenth = stepIndex % STEPS_PER_BAR;
      const chord = CHORDS[bar];
      const layers = layersFor(Math.max(intensity, floor, time >= liftAt ? 1 : 0));
      const disco = time >= discoFrom && time < discoUntil;
      leadStep(stepIndex, time, disco, layers.backbeat);
      if (disco) {
        discoStep(chord, sixteenth, time);
      } else {
        themeStep(chord, sixteenth, time, layers);
      }
      rollStep(time);
    } catch (error) {
      report(error);
    }
  }

  /**
   * @description Arms the next wake-up.
   * @returns {void}
   * @since 1.0.0
   */
  function arm() {
    if (playing && setTimer && timer === null) {
      timer = setTimer(tick, WAKE_MS);
    }
  }

  /**
   * @description Cancels the pending wake-up.
   * @returns {void}
   * @since 1.0.0
   */
  function disarm() {
    if (timer !== null && clearTimer) {
      clearTimer(timer);
    }
    timer = null;
  }

  /**
   * @description The scheduler: schedules every step due within the lookahead, then re-arms.
   * @returns {void}
   * @since 1.0.0
   */
  function tick() {
    timer = null;
    if (!playing) {
      return;
    }
    try {
      const now = context.currentTime;
      if (nextTime < now - LATE_SLACK_SECONDS) {
        const missed = Math.ceil((now - nextTime) / stepSeconds);
        step = (step + missed) % LOOP_STEPS;
        nextTime += missed * stepSeconds;
      }
      while (nextTime < now + LOOKAHEAD_SECONDS) {
        const stepIndex = step;
        const stepTime = nextTime;
        step = (step + 1) % LOOP_STEPS;
        nextTime += stepSeconds;
        keepTime(stepTime);
        if (!silent) {
          playStep(stepIndex, stepTime);
        }
      }
    } catch (error) {
      report(error);
    }
    arm();
  }

  return Object.freeze({
    /**
     * @description Starts (or restarts) the theme from bar one with a short fade-in.
     * @param {{bpm: number, atTime?: number}} startOptions - Tempo and start time.
     * @returns {void}
     * @since 1.0.0
     */
    start(startOptions) {
      const startSettings = startOptions || {};
      disarm();
      const tempo = Number(startSettings.bpm);
      const bpm = Number.isFinite(tempo)
        ? Math.min(MAX_BPM, Math.max(MIN_BPM, tempo))
        : TEMPOS.classic;
      stepSeconds = 60 / bpm / STEPS_PER_BEAT;
      const now = context.currentTime;
      const atTime = Number(startSettings.atTime);
      step = 0;
      nextTime = Number.isFinite(atTime) ? Math.max(atTime, now) : now;
      keyShift = 0;
      floor = 0;
      liftAt = Infinity;
      rollFrom = Infinity;
      crashed = true;
      discoFrom = Infinity;
      discoUntil = -Infinity;
      buses.out.gain.cancelScheduledValues(now);
      buses.out.gain.setValueAtTime(0, now);
      buses.out.gain.linearRampToValueAtTime(1, nextTime + FADE_IN_SECONDS);
      playing = true;
      tick();
    },

    /**
     * @description Stops the theme with a fade (notes already in the lookahead fade with it).
     * @param {number} [fadeSeconds] - Fade length; 0.25 s by default.
     * @returns {void}
     * @since 1.0.0
     */
    stop(fadeSeconds) {
      if (!playing) {
        return;
      }
      playing = false;
      disarm();
      const now = context.currentTime;
      const requested = Number(fadeSeconds);
      const fade = Number.isFinite(requested) ? Math.max(0.02, requested) : DEFAULT_FADE_SECONDS;
      buses.out.gain.cancelScheduledValues(now);
      buses.out.gain.setTargetAtTime(0, now, fade / 4);
    },

    /**
     * @description Sets the intensity that decides the extra layers.
     * @param {number} level - 0 to 1.
     * @returns {void}
     * @since 1.0.0
     */
    setIntensity(level) {
      intensity = clamp01(level);
    },

    /**
     * @description Silent: keep counting steps but make no nodes (muted).
     * @param {boolean} flag - True to go silent.
     * @returns {void}
     * @since 1.0.0
     */
    setSilent(flag) {
      silent = Boolean(flag);
    },

    /**
     * @description Plays the disco groove between two moments (a second disco during the first
     *   extends it).
     * @param {number} fromTime - Start, AudioContext seconds.
     * @param {number} untilTime - End, AudioContext seconds.
     * @returns {void}
     * @since 1.0.0
     */
    discoWindow(fromTime, untilTime) {
      if (!(untilTime > fromTime)) {
        return;
      }
      if (context.currentTime < discoUntil && fromTime <= discoUntil) {
        discoUntil = Math.max(discoUntil, untilTime);
      } else {
        discoFrom = fromTime;
        discoUntil = untilTime;
      }
    },

    /**
     * @description Ends the disco groove at a moment (no later than planned).
     * @param {number} atTime - AudioContext seconds.
     * @returns {void}
     * @since 1.0.0
     */
    endDisco(atTime) {
      discoUntil = Math.min(discoUntil, atTime);
    },

    /**
     * @description The finale burst: a snare roll from now into the first bar line at least
     *   1.2 s away, a crash there, and the key a whole tone up from then on. Once per race.
     * @param {number} atTime - Now, AudioContext seconds.
     * @returns {void}
     * @since 1.0.0
     */
    finaleLift(atTime) {
      if (!playing || liftAt !== Infinity) {
        return;
      }
      const from = Math.max(Number(atTime) || 0, context.currentTime);
      const stepsToBar = (STEPS_PER_BAR - (step % STEPS_PER_BAR)) % STEPS_PER_BAR;
      let barTime = nextTime + stepsToBar * stepSeconds;
      while (barTime < from + ROLL_LEAD_SECONDS) {
        barTime += STEPS_PER_BAR * stepSeconds;
      }
      rollFrom = from;
      liftAt = barTime;
      crashed = false;
    },

    /**
     * @description The last stretch: at least the shaker and glockenspiel layers from now on.
     * @returns {void}
     * @since 1.0.0
     */
    lastStretch() {
      floor = Math.max(floor, LAST_STRETCH_FLOOR);
    },

    /**
     * @description How far the key is lifted (0, or 2 after the finale).
     * @returns {number} Semitones.
     * @since 1.0.0
     */
    keyOffset() {
      return keyShift;
    },

    /**
     * @description Whether the theme is playing.
     * @returns {boolean} True while playing.
     * @since 1.0.0
     */
    isPlaying() {
      return playing;
    },

    /**
     * @description Stops the scheduler for good (the AudioContext is going away).
     * @returns {void}
     * @since 1.0.0
     */
    dispose() {
      playing = false;
      disarm();
    }
  });
}
