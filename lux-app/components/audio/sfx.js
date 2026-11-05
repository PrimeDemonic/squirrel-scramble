/**
 * The race sound effects (Chaos v2 contract § 9): one short synthesised effect per event, plus the
 * cues (go, last stretch, finale burst, photo finish, finish) and, since 2.2.0, the owl
 * commentator's hoot (§ 12). No audio files: every sound is built from oscillators, filtered
 * noise and envelopes on the AudioContext clock.
 *
 * Every tune here is original. The finish fanfare, the VAR sting, the trench-coat tiptoe and the
 * owl's hoot were written for this app; none quotes a melody, motif or sting from an existing
 * work.
 *
 * Each entry of SFX_LIBRARY is {durationMs, play(voice, time, options)}. durationMs is an upper
 * bound on how long the effect sounds; the engine uses it to count concurrent effects (at most
 * three) and tests/audio-engine.test.js checks it against the nodes each effect schedules.
 * play() builds the whole effect inside the voice it is given (synth.js), so the voice can fade
 * it out on "Skip to result" and disconnects it when it ends.
 *
 * Pure ES module: no DOM and no globals.
 */
import {SILENT, midiToHz, pluck, swell} from './synth.js';

/**
 * @description One enveloped oscillator note, optionally gliding to a second frequency.
 * @param {Object} voice - The voice (synth.js).
 * @param {{type?: string, from: number, to?: number, at: number, seconds: number, peak: number,
 *   attack?: number, glide?: number, target?: AudioNode}} spec - The note.
 * @returns {OscillatorNode} The oscillator, for extra modulation.
 * @since 1.0.0
 */
function tone(voice, spec) {
  const {type = 'sine', from, to, at, seconds, peak, attack = 0.005, glide, target} = spec;
  const amp = voice.gain(SILENT, target);
  pluck(amp.gain, at, peak, attack, Math.max(seconds - attack, 0.01));
  const oscillator = voice.osc(type, from, at, at + seconds + 0.03, amp);
  if (to && to !== from) {
    oscillator.frequency.exponentialRampToValueAtTime(to, at + (glide || seconds));
  }
  return oscillator;
}

/**
 * @description One enveloped burst of filtered noise.
 * @param {Object} voice - The voice (synth.js).
 * @param {{at: number, seconds: number, peak: number, filter?: string, frequency?: number,
 *   quality?: number, attack?: number, target?: AudioNode}} spec - The burst.
 * @returns {BiquadFilterNode} The filter, for sweeps.
 * @since 1.0.0
 */
function noiseBurst(voice, spec) {
  const {
    at, seconds, peak, filter = 'bandpass', frequency = 2000, quality = 1, attack = 0.002, target
  } = spec;
  const amp = voice.gain(SILENT, target);
  pluck(amp.gain, at, peak, attack, seconds);
  const shape = voice.filter(filter, frequency, quality, amp);
  voice.noise(at, at + attack + seconds + 0.03, shape);
  return shape;
}

/**
 * @description A bell: a sine with two quieter, faster-fading partials (one inharmonic).
 * @param {Object} voice - The voice.
 * @param {number} at - Start time.
 * @param {number} frequency - The bell's pitch in hertz.
 * @param {number} peak - Its level.
 * @param {number} seconds - How long it rings.
 * @returns {void}
 * @since 1.0.0
 */
function bell(voice, at, frequency, peak, seconds) {
  tone(voice, {from: frequency, at, seconds, peak, attack: 0.002});
  tone(voice, {from: frequency * 2, at, seconds: seconds * 0.45, peak: peak * 0.25, attack: 0.002});
  tone(voice, {
    from: frequency * 2.76, at, seconds: seconds * 0.25, peak: peak * 0.15, attack: 0.002
  });
}

/**
 * @description A brassy note: a sawtooth through a lowpass that opens on the attack, with a small
 *   upward scoop in pitch.
 * @param {Object} voice - The voice.
 * @param {number} at - Start time.
 * @param {number} frequency - Pitch in hertz.
 * @param {number} seconds - Note length.
 * @param {number} peak - Level.
 * @returns {OscillatorNode} The oscillator.
 * @since 1.0.0
 */
function brass(voice, at, frequency, seconds, peak) {
  const amp = voice.gain(SILENT);
  swell(amp.gain, at, peak, 0.03, Math.max(seconds - 0.08, 0.01), 0.08);
  const bright = voice.filter('lowpass', 700, 1.5, amp);
  bright.frequency.setValueAtTime(700, at);
  bright.frequency.exponentialRampToValueAtTime(2600, at + 0.05);
  bright.frequency.exponentialRampToValueAtTime(1400, at + Math.max(seconds, 0.06));
  const reed = voice.osc('sawtooth', frequency, at, at + seconds + 0.1, bright);
  reed.detune.setValueAtTime(-18, at);
  reed.detune.linearRampToValueAtTime(0, at + 0.04);
  return reed;
}

/**
 * @description A low drum boom: a sine that drops in pitch.
 * @param {Object} voice - The voice.
 * @param {number} at - Start time.
 * @param {number} peak - Level.
 * @returns {void}
 * @since 1.0.0
 */
function boom(voice, at, peak) {
  tone(voice, {from: 110, to: 52, at, seconds: 0.4, peak, attack: 0.004, glide: 0.2});
}

/**
 * @description Tornado: a rising wind whoosh (noise through a sweeping band) with a faint howl.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playWindWhoosh(voice, time) {
  const amp = voice.gain(SILENT);
  swell(amp.gain, time, 0.6, 0.9, 0.3, 0.6);
  const band = voice.filter('bandpass', 280, 2.2, amp);
  band.frequency.setValueAtTime(280, time);
  band.frequency.exponentialRampToValueAtTime(1500, time + 1.1);
  band.frequency.exponentialRampToValueAtTime(700, time + 1.8);
  voice.noise(time, time + 1.85, band);
  tone(voice, {
    from: 320, to: 820, at: time + 0.1, seconds: 1.5, peak: 0.05, attack: 0.5, glide: 1.1
  });
}

/**
 * @description Sharks: a cartoon "chomp chomp" (a falling square snap with a noise bite).
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playSharkChomp(voice, time) {
  [0, 0.15].forEach((offset, order) => {
    const at = time + offset;
    tone(voice, {type: 'square', from: 260 - order * 30, to: 70, at, seconds: 0.09, peak: 0.26});
    noiseBurst(voice, {at, seconds: 0.05, peak: 0.35, filter: 'lowpass', frequency: 1400});
  });
}

/**
 * @description The cow: a low warble (a buzzy tone through a moving vowel filter, wobbling).
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playCowWarble(voice, time) {
  const amp = voice.gain(SILENT);
  swell(amp.gain, time, 0.5, 0.12, 0.45, 0.35);
  const vowel = voice.filter('bandpass', 380, 3, amp);
  vowel.frequency.setValueAtTime(380, time);
  vowel.frequency.linearRampToValueAtTime(820, time + 0.35);
  vowel.frequency.linearRampToValueAtTime(460, time + 0.9);
  const throat = voice.osc('sawtooth', 128, time, time + 0.95, vowel);
  throat.frequency.exponentialRampToValueAtTime(96, time + 0.9);
  voice.lfo(6.5, 45, time, time + 0.95, throat.detune);
}

/**
 * @description The hunter's pop-gun: a tiny crack and a falling "pop".
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playPopGun(voice, time) {
  noiseBurst(voice, {at: time, seconds: 0.03, peak: 0.6, filter: 'highpass', frequency: 1800});
  tone(voice, {from: 1100, to: 180, at: time, seconds: 0.07, peak: 0.45, attack: 0.002});
}

/**
 * @description A miss: a cartoon spring "boing" (a rising tone with a dying wobble).
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playBoing(voice, time) {
  const spring = tone(voice, {
    type: 'triangle', from: 170, to: 420, at: time, seconds: 0.68, peak: 0.34, attack: 0.004,
    glide: 0.08
  });
  const wobble = voice.lfo(13, 320, time, time + 0.72, spring.detune);
  wobble.gain.setValueAtTime(320, time);
  wobble.gain.exponentialRampToValueAtTime(6, time + 0.65);
}

/**
 * @description A kiss: a little lip pop, then a "mwah" (a vowel filter opening and closing).
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playSmooch(voice, time) {
  noiseBurst(voice, {at: time, seconds: 0.025, peak: 0.35, frequency: 2400, quality: 3});
  const start = time + 0.03;
  const amp = voice.gain(SILENT);
  swell(amp.gain, start, 0.42, 0.06, 0.12, 0.2);
  const vowel = voice.filter('bandpass', 500, 4, amp);
  vowel.frequency.setValueAtTime(500, start);
  vowel.frequency.exponentialRampToValueAtTime(1300, start + 0.15);
  vowel.frequency.exponentialRampToValueAtTime(900, start + 0.39);
  const lips = voice.osc('sawtooth', 280, start, start + 0.42, vowel);
  lips.frequency.linearRampToValueAtTime(330, start + 0.17);
  lips.frequency.linearRampToValueAtTime(300, start + 0.39);
}

/**
 * @description A slap: a sharp crack with a body thump.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playSlapCrack(voice, time) {
  noiseBurst(voice, {at: time, seconds: 0.07, peak: 0.7, filter: 'highpass', frequency: 1600});
  noiseBurst(voice, {at: time, seconds: 0.12, peak: 0.25, frequency: 3200, quality: 2});
  tone(voice, {from: 210, to: 90, at: time, seconds: 0.08, peak: 0.35, attack: 0.002});
}

/**
 * @description The eagle: a screech that sweeps down, with a fast flutter and a breathy edge.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playEagleScreech(voice, time) {
  const amp = voice.gain(SILENT);
  swell(amp.gain, time, 0.22, 0.04, 0.35, 0.28);
  const band = voice.filter('bandpass', 2600, 1.4, amp);
  const cry = voice.osc('sawtooth', 2100, time, time + 0.72, band);
  cry.frequency.exponentialRampToValueAtTime(2500, time + 0.08);
  cry.frequency.exponentialRampToValueAtTime(950, time + 0.68);
  voice.lfo(28, 70, time, time + 0.72, cry.detune);
  noiseBurst(voice, {
    at: time, seconds: 0.5, peak: 0.08, frequency: 3500, quality: 1.5, attack: 0.03
  });
}

/**
 * @description The beaver: rapid gnawing ticks with a woody click on every other one.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playGnaw(voice, time) {
  for (let tick = 0; tick < 9; tick += 1) {
    const at = time + tick * 0.065;
    noiseBurst(voice, {
      at, seconds: 0.018, peak: 0.4, frequency: 2600 + (tick % 3) * 400, quality: 4, attack: 0.001
    });
    if (tick % 2 === 0) {
      tone(voice, {
        type: 'square', from: 620, to: 520, at, seconds: 0.02, peak: 0.08, attack: 0.001
      });
    }
  }
}

/**
 * @description Lightning: a crack and a zap, then a low wobbling rumble.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playThunderCrack(voice, time) {
  noiseBurst(voice, {at: time, seconds: 0.16, peak: 0.75, filter: 'highpass', frequency: 900});
  tone(voice, {type: 'sawtooth', from: 1500, to: 120, at: time, seconds: 0.12, peak: 0.18});
  const rumbleAt = time + 0.08;
  const amp = voice.gain(SILENT);
  swell(amp.gain, rumbleAt, 0.6, 0.15, 0.4, 1.2);
  const wobble = voice.gain(0.7, amp);
  voice.lfo(6, 0.3, rumbleAt, rumbleAt + 1.8, wobble.gain);
  const low = voice.filter('lowpass', 170, 0.8, wobble);
  voice.noise(rumbleAt, rumbleAt + 1.8, low);
}

/**
 * @description The cat lady's cackle: five quick falling blips.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playCackle(voice, time) {
  const soft = voice.filter('lowpass', 2200, 0.7);
  [760, 700, 800, 690, 780].forEach((pitch, order) => {
    tone(voice, {
      type: 'square', from: pitch, to: pitch * 0.82, at: time + order * 0.12, seconds: 0.07,
      peak: 0.14, target: soft
    });
  });
}

/**
 * @description A cat: a "mee-ow" sweep (a buzzy tone through a vowel filter, up then down).
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playMeowSweep(voice, time) {
  const amp = voice.gain(SILENT);
  swell(amp.gain, time, 0.38, 0.05, 0.15, 0.2);
  const vowel = voice.filter('bandpass', 900, 3.5, amp);
  vowel.frequency.setValueAtTime(900, time);
  vowel.frequency.exponentialRampToValueAtTime(1700, time + 0.14);
  vowel.frequency.exponentialRampToValueAtTime(750, time + 0.4);
  const cry = voice.osc('sawtooth', 520, time, time + 0.42, vowel);
  cry.frequency.exponentialRampToValueAtTime(820, time + 0.12);
  cry.frequency.exponentialRampToValueAtTime(430, time + 0.4);
}

/**
 * @description The Golden Acorn of Doom homing in: a quick rising whistle.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playAcornWhistle(voice, time) {
  const whistle = tone(voice, {
    from: 700, to: 2600, at: time, seconds: 0.28, peak: 0.2, attack: 0.02
  });
  voice.lfo(18, 25, time, time + 0.31, whistle.detune);
}

/**
 * @description The acorn's impact: a hollow wooden "bonk" with a thump under it.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playBonk(voice, time) {
  tone(voice, {
    type: 'triangle', from: 520, to: 300, at: time, seconds: 0.16, peak: 0.4, attack: 0.002
  });
  tone(voice, {from: 150, to: 80, at: time, seconds: 0.12, peak: 0.4, attack: 0.002});
  noiseBurst(voice, {at: time, seconds: 0.02, peak: 0.3, filter: 'lowpass', frequency: 2000});
}

/**
 * @description The leaf blower: a two-stroke motor hum (a low buzz that putters) plus air.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playMotorHum(voice, time) {
  const end = time + 2.2;
  const amp = voice.gain(SILENT);
  swell(amp.gain, time, 0.3, 0.25, 1.4, 0.5);
  const low = voice.filter('lowpass', 900, 1, amp);
  const putter = voice.gain(0.6, low);
  voice.lfo(22, 0.4, time, end, putter.gain);
  const engine = voice.osc('sawtooth', 72, time, end, putter);
  engine.frequency.linearRampToValueAtTime(84, time + 0.6);
  engine.frequency.linearRampToValueAtTime(78, time + 2);
  const rattle = voice.gain(0.3, putter);
  voice.osc('square', 145, time, end, rattle);
  const air = voice.gain(0.12, amp);
  const airBand = voice.filter('bandpass', 1300, 0.7, air);
  voice.noise(time, end, airBand);
}

/**
 * @description The UFO: a theremin warble (a sine gliding up and down with a deep vibrato, and a
 *   quiet fifth above it).
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playTheremin(voice, time) {
  const end = time + 1.8;
  const amp = voice.gain(SILENT);
  swell(amp.gain, time, 0.22, 0.25, 1, 0.5);
  const glidePoints = [[0.6, 1080], [1.1, 760], [1.4, 980], [1.75, 700]];
  [[1, 1], [1.5, 0.18]].forEach(([ratio, level]) => {
    const layer = voice.gain(level, amp);
    const wave = voice.osc('sine', 620 * ratio, time, end, layer);
    glidePoints.forEach(([offset, frequency]) => {
      wave.frequency.linearRampToValueAtTime(frequency * ratio, time + offset);
    });
    voice.lfo(6.2, 55, time, end, wave.detune);
  });
}

/**
 * @description The earthquake: a low wobbling rumble with a sub-bass under it and a crack.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playRumble(voice, time) {
  const end = time + 2.2;
  const amp = voice.gain(SILENT);
  swell(amp.gain, time, 0.65, 0.25, 1, 0.9);
  const wobble = voice.gain(0.65, amp);
  voice.lfo(9, 0.35, time, end, wobble.gain);
  const low = voice.filter('lowpass', 130, 0.9, wobble);
  voice.noise(time, end, low);
  const sub = voice.gain(0.5, wobble);
  voice.osc('sine', 38, time, end, sub);
  noiseBurst(voice, {at: time + 0.05, seconds: 0.1, peak: 0.25, frequency: 600});
}

/**
 * @description The flood: bubbles (short sines sweeping up) at random moments.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playBubbles(voice, time) {
  const {random} = voice.kit;
  for (let bubble = 0; bubble < 12; bubble += 1) {
    const base = 220 + random() * 260;
    tone(voice, {
      from: base, to: base * (2.2 + random()), at: time + random() * 1.3,
      seconds: 0.05 + random() * 0.04, peak: 0.16, attack: 0.004
    });
  }
}

/**
 * @description Flood bursts: a big bubble rising, then a little volley of bubbles.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playBubbleBurst(voice, time) {
  tone(voice, {from: 180, to: 900, at: time, seconds: 0.35, peak: 0.2, attack: 0.01});
  for (let bubble = 0; bubble < 5; bubble += 1) {
    const base = 300 + bubble * 60;
    tone(voice, {
      from: base, to: base * 2.5, at: time + 0.1 + bubble * 0.07, seconds: 0.06, peak: 0.14
    });
  }
}

/**
 * @description Acorn hail: a pitter-patter of tiny ticks with the odd woody "tok".
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playPitterPatter(voice, time) {
  const {random} = voice.kit;
  for (let nut = 0; nut < 20; nut += 1) {
    const at = time + random() * 1.55;
    noiseBurst(voice, {
      at, seconds: 0.012, peak: 0.22 + random() * 0.15, frequency: 2200 + random() * 2800,
      quality: 3, attack: 0.001
    });
    if (nut % 4 === 0) {
      tone(voice, {
        type: 'triangle', from: 950, to: 780, at, seconds: 0.02, peak: 0.1, attack: 0.001
      });
    }
  }
}

/**
 * @description The disco: a mirror-ball sparkle (bells rising fast). The groove is the music's.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playDiscoSparkle(voice, time) {
  [91, 95, 98, 100, 103, 107].forEach((midi, order) => {
    tone(voice, {
      from: midiToHz(midi), at: time + order * 0.05, seconds: 0.25, peak: 0.07, attack: 0.002
    });
  });
}

/**
 * @description VAR: a referee's two-blast whistle (a trilled high sine with breath).
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playRefWhistle(voice, time) {
  const amp = voice.gain(SILENT);
  amp.gain.setValueAtTime(SILENT, time);
  amp.gain.linearRampToValueAtTime(0.28, time + 0.01);
  amp.gain.setValueAtTime(0.28, time + 0.13);
  amp.gain.linearRampToValueAtTime(SILENT, time + 0.16);
  amp.gain.linearRampToValueAtTime(0.28, time + 0.21);
  amp.gain.setValueAtTime(0.28, time + 0.34);
  amp.gain.exponentialRampToValueAtTime(SILENT, time + 0.39);
  const pea = voice.osc('sine', 2350, time, time + 0.4, amp);
  voice.lfo(32, 90, time, time + 0.4, pea.detune);
  noiseBurst(voice, {
    at: time, seconds: 0.33, peak: 0.05, frequency: 2400, quality: 2, attack: 0.01
  });
}

/**
 * @description VAR: an original suspense sting (two tremolo strings a tritone apart that both
 *   creep up a semitone, over a low drum).
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playSuspenseSting(voice, time) {
  const end = time + 0.8;
  const amp = voice.gain(SILENT);
  swell(amp.gain, time, 0.26, 0.12, 0.45, 0.2);
  const tremolo = voice.gain(0.6, amp);
  voice.lfo(11, 0.4, time, end, tremolo.gain);
  const dark = voice.filter('lowpass', 900, 0.8, tremolo);
  [[48, 49], [54, 55]].forEach(([first, second]) => {
    const string = voice.osc('sawtooth', midiToHz(first), time, end, dark);
    string.frequency.setValueAtTime(midiToHz(second), time + 0.4);
  });
  boom(voice, time, 0.35);
}

/**
 * @description VAR: the verdict, a two-bell "ding-ding" rising.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playVerdictDing(voice, time) {
  bell(voice, time, midiToHz(88), 0.28, 0.9);
  bell(voice, time + 0.12, midiToHz(91), 0.22, 0.9);
}

/**
 * @description The trench coat: sneaky tiptoe plucks (an original staccato figure), each with a
 *   soft tap.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playTiptoe(voice, time) {
  [[0, 52], [0.2, 59], [0.4, 55], [0.5, 57], [0.75, 52], [1, 64]].forEach(([offset, midi]) => {
    const at = time + offset;
    tone(voice, {
      type: 'triangle', from: midiToHz(midi), at, seconds: 0.14, peak: 0.22, attack: 0.003
    });
    noiseBurst(voice, {at, seconds: 0.01, peak: 0.08, frequency: 3000, quality: 2, attack: 0.001});
  });
}

/**
 * @description The trench coat topples apart: a soft "wooo" falling into a thud.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playToppleThud(voice, time) {
  tone(voice, {from: 500, to: 250, at: time, seconds: 0.22, peak: 0.08, attack: 0.02});
  tone(voice, {from: 120, to: 45, at: time + 0.12, seconds: 0.25, peak: 0.5, attack: 0.003});
  noiseBurst(voice, {
    at: time + 0.12, seconds: 0.08, peak: 0.25, filter: 'lowpass', frequency: 400
  });
}

/**
 * @description The woodpecker: rapid knocks on the trunk.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playKnocks(voice, time) {
  for (let knock = 0; knock < 12; knock += 1) {
    const at = time + knock * 0.05;
    tone(voice, {
      type: 'triangle', from: knock % 2 === 0 ? 1150 : 1050, at, seconds: 0.018, peak: 0.3,
      attack: 0.001
    });
    noiseBurst(voice, {at, seconds: 0.012, peak: 0.25, frequency: 2000, quality: 2, attack: 0.001});
  }
}

/**
 * @description A slip: a slide whistle going down.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playSlideDown(voice, time) {
  tone(voice, {from: 1500, to: 340, at: time, seconds: 0.45, peak: 0.28, attack: 0.01});
  tone(voice, {
    type: 'triangle', from: 750, to: 170, at: time, seconds: 0.45, peak: 0.08, attack: 0.01
  });
}

/**
 * @description A burst: a slide whistle going up.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playSlideUp(voice, time) {
  tone(voice, {from: 340, to: 1500, at: time, seconds: 0.4, peak: 0.26, attack: 0.01});
  tone(voice, {
    type: 'triangle', from: 170, to: 750, at: time, seconds: 0.4, peak: 0.08, attack: 0.01
  });
}

/**
 * @description A nut stop: a crunchy munch (a few bursts of crackle over a low thump).
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playCrunch(voice, time) {
  [[0, 1800], [0.06, 2600], [0.11, 2100], [0.19, 3000]].forEach(([offset, frequency]) => {
    noiseBurst(voice, {at: time + offset, seconds: 0.035, peak: 0.4, frequency, quality: 1.2});
  });
  tone(voice, {from: 160, to: 90, at: time, seconds: 0.06, peak: 0.3, attack: 0.002});
}

/**
 * @description Cue "go": a starter's pop, a rising "zip" and a splash.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playGoPop(voice, time) {
  playPopGun(voice, time);
  tone(voice, {
    from: 450, to: 1700, at: time + 0.04, seconds: 0.22, peak: 0.2, attack: 0.01, glide: 0.18
  });
  noiseBurst(voice, {
    at: time + 0.05, seconds: 0.6, peak: 0.18, filter: 'highpass', frequency: 5000, attack: 0.005
  });
}

/**
 * @description Cue "last stretch": three rising bells.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playLastStretchBells(voice, time) {
  [84, 88, 91].forEach((midi, order) => {
    bell(voice, time + order * 0.13, midiToHz(midi), 0.2, 0.45);
  });
}

/**
 * @description Cue "finale burst": a cymbal swelling up to the key change.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playCymbalSwell(voice, time) {
  const amp = voice.gain(SILENT);
  amp.gain.setValueAtTime(SILENT, time);
  amp.gain.exponentialRampToValueAtTime(0.35, time + 1.2);
  amp.gain.exponentialRampToValueAtTime(SILENT, time + 1.3);
  const shimmer = voice.filter('highpass', 5000, 0.7, amp);
  voice.noise(time, time + 1.32, shimmer);
}

/**
 * @description Cue "photo finish": a camera shutter (two clicks) and the flash whine.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playCameraClick(voice, time) {
  [0, 0.07].forEach((offset) => {
    noiseBurst(voice, {
      at: time + offset, seconds: 0.008, peak: 0.5, filter: 'highpass', frequency: 3500,
      attack: 0.001
    });
  });
  tone(voice, {
    type: 'square', from: 210, to: 150, at: time, seconds: 0.02, peak: 0.12, attack: 0.001
  });
  tone(voice, {from: 2800, to: 5200, at: time + 0.08, seconds: 0.3, peak: 0.05, attack: 0.02});
}

/**
 * The finish fanfare, written for this app: [seconds from the start, MIDI note, length]. The
 * lead runs E C E G F A G and lands on a held top C over a C major chord.
 */
const FANFARE_LEAD = Object.freeze([
  [0, 76, 0.11], [0.13, 72, 0.11], [0.26, 76, 0.11], [0.39, 79, 0.11],
  [0.52, 77, 0.11], [0.65, 81, 0.3], [0.98, 79, 0.11], [1.11, 84, 0.95]
]);

/** The fanfare's lower voice, a third or sixth under the lead, ending on the chord. */
const FANFARE_HARMONY = Object.freeze([
  [0, 72, 0.11], [0.13, 67, 0.11], [0.26, 72, 0.11], [0.39, 76, 0.11],
  [0.52, 74, 0.11], [0.65, 77, 0.3], [0.98, 76, 0.11], [1.11, 79, 0.95], [1.11, 76, 0.95]
]);

/**
 * @description Cue "finish": the fanfare (brass lead and harmony, drum booms, a wobble on the last
 *   note), in the music's current key.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @param {{keyOffset?: number}} options - Semitones to lift it by (the finale's key change).
 * @returns {void}
 * @since 1.0.0
 */
function playFanfare(voice, time, options) {
  const lift = options && Number.isFinite(options.keyOffset) ? options.keyOffset : 0;
  FANFARE_LEAD.forEach(([offset, midi, seconds], order) => {
    const reed = brass(voice, time + offset, midiToHz(midi + lift), seconds, 0.16);
    if (order === FANFARE_LEAD.length - 1) {
      voice.lfo(5.5, 14, time + offset, time + offset + seconds + 0.1, reed.detune);
    }
  });
  FANFARE_HARMONY.forEach(([offset, midi, seconds]) => {
    brass(voice, time + offset, midiToHz(midi + lift), seconds, 0.09);
  });
  [0, 0.65, 1.11].forEach((offset) => boom(voice, time + offset, 0.4));
}

/**
 * @description Cue "finish": the crowd cheer (a swelling roar, scattered claps and a few whoops).
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 1.0.0
 */
function playCrowdCheer(voice, time) {
  const {random} = voice.kit;
  const end = time + 3;
  const amp = voice.gain(SILENT);
  swell(amp.gain, time, 0.35, 0.4, 1.2, 1.3);
  const roar = voice.filter('bandpass', 1500, 0.6, amp);
  voice.noise(time, end, roar);
  const body = voice.gain(0.5, amp);
  const chest = voice.filter('lowpass', 600, 0.7, body);
  voice.noise(time, end, chest);
  for (let clap = 0; clap < 26; clap += 1) {
    noiseBurst(voice, {
      at: time + 0.15 + random() * 2.2, seconds: 0.02, peak: 0.12 + random() * 0.1,
      frequency: 1100 + random() * 900, quality: 1.5, attack: 0.001
    });
  }
  for (let whoop = 0; whoop < 5; whoop += 1) {
    const base = 700 + random() * 400;
    tone(voice, {
      from: base, to: base * 1.8, at: time + 0.2 + random() * 1.6, seconds: 0.3, peak: 0.05,
      attack: 0.05
    });
  }
}

/**
 * @description Cue "hoot": the owl commentator's "hoo, hoooo" (contract § 12), two soft falling
 *   tones with a breath before them and a wobble on the long one. Written for this app.
 * @param {Object} voice - The voice.
 * @param {number} time - Start time.
 * @returns {void}
 * @since 2.2.0
 */
function playHoot(voice, time) {
  noiseBurst(voice, {
    at: time, seconds: 0.14, peak: 0.04, frequency: 900, quality: 1.2, attack: 0.02
  });
  tone(voice, {from: 430, to: 395, at: time, seconds: 0.22, peak: 0.22, attack: 0.04});
  tone(voice, {
    type: 'triangle', from: 430, to: 395, at: time, seconds: 0.22, peak: 0.06, attack: 0.04
  });
  const hold = tone(voice, {
    from: 480, to: 380, at: time + 0.3, seconds: 0.38, peak: 0.28, attack: 0.05, glide: 0.34
  });
  tone(voice, {
    type: 'triangle', from: 480, to: 380, at: time + 0.3, seconds: 0.38, peak: 0.07,
    attack: 0.05, glide: 0.34
  });
  voice.lfo(6, 14, time + 0.36, time + 0.71, hold.detune);
}

/**
 * Every effect by id: {durationMs, play}. durationMs bounds how long the effect sounds, measured
 * from its start time; the engine counts it towards the three-at-once limit.
 * @type {Readonly<Object<string, {durationMs: number, play: function(Object, number, Object)}>>}
 */
export const SFX_LIBRARY = Object.freeze({
  windWhoosh: Object.freeze({durationMs: 1900, play: playWindWhoosh}),
  sharkChomp: Object.freeze({durationMs: 350, play: playSharkChomp}),
  cowWarble: Object.freeze({durationMs: 1000, play: playCowWarble}),
  popGun: Object.freeze({durationMs: 150, play: playPopGun}),
  boing: Object.freeze({durationMs: 750, play: playBoing}),
  smooch: Object.freeze({durationMs: 480, play: playSmooch}),
  slapCrack: Object.freeze({durationMs: 230, play: playSlapCrack}),
  eagleScreech: Object.freeze({durationMs: 760, play: playEagleScreech}),
  gnaw: Object.freeze({durationMs: 650, play: playGnaw}),
  thunderCrack: Object.freeze({durationMs: 1950, play: playThunderCrack}),
  cackle: Object.freeze({durationMs: 680, play: playCackle}),
  meowSweep: Object.freeze({durationMs: 460, play: playMeowSweep}),
  acornWhistle: Object.freeze({durationMs: 340, play: playAcornWhistle}),
  bonk: Object.freeze({durationMs: 330, play: playBonk}),
  motorHum: Object.freeze({durationMs: 2250, play: playMotorHum}),
  theremin: Object.freeze({durationMs: 1850, play: playTheremin}),
  rumble: Object.freeze({durationMs: 2250, play: playRumble}),
  bubbles: Object.freeze({durationMs: 1500, play: playBubbles}),
  bubbleBurst: Object.freeze({durationMs: 650, play: playBubbleBurst}),
  pitterPatter: Object.freeze({durationMs: 1700, play: playPitterPatter}),
  discoSparkle: Object.freeze({durationMs: 600, play: playDiscoSparkle}),
  refWhistle: Object.freeze({durationMs: 450, play: playRefWhistle}),
  suspenseSting: Object.freeze({durationMs: 850, play: playSuspenseSting}),
  verdictDing: Object.freeze({durationMs: 1100, play: playVerdictDing}),
  tiptoe: Object.freeze({durationMs: 1300, play: playTiptoe}),
  toppleThud: Object.freeze({durationMs: 420, play: playToppleThud}),
  knocks: Object.freeze({durationMs: 680, play: playKnocks}),
  slideDown: Object.freeze({durationMs: 520, play: playSlideDown}),
  slideUp: Object.freeze({durationMs: 470, play: playSlideUp}),
  crunch: Object.freeze({durationMs: 330, play: playCrunch}),
  goPop: Object.freeze({durationMs: 800, play: playGoPop}),
  lastStretchBells: Object.freeze({durationMs: 800, play: playLastStretchBells}),
  cymbalSwell: Object.freeze({durationMs: 1350, play: playCymbalSwell}),
  cameraClick: Object.freeze({durationMs: 450, play: playCameraClick}),
  fanfare: Object.freeze({durationMs: 2300, play: playFanfare}),
  crowdCheer: Object.freeze({durationMs: 3100, play: playCrowdCheer}),
  hoot: Object.freeze({durationMs: 780, play: playHoot})
});
