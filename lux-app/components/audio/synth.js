/**
 * Shared Web Audio helpers for the race audio (Chaos v2 contract § 9): note frequencies,
 * envelopes, one shared noise buffer per AudioContext, and the "voice", a small bundle of nodes
 * that plays one note or one sound effect and disconnects itself when its last source ends.
 *
 * Every node a voice makes is short-lived: sources are started and stopped at fixed times on the
 * AudioContext clock, and the voice disconnects all of its nodes from the source's ended event,
 * so nothing keeps running (or keeps memory) after the sound is over.
 *
 * Pure ES module: no DOM and no globals. The AudioContext is passed in, so the Node tests can run
 * every helper against a stand-in context.
 */

/** The quietest level an exponential ramp may aim at (Web Audio rejects 0). */
export const SILENT = 0.0001;

/** Length of the shared white-noise buffer. Sources loop it from a random offset. */
export const NOISE_SECONDS = 2;

/**
 * @description The frequency of a MIDI note number (A4 = 69 = 440 Hz).
 * @param {number} midi - The note number; fractions are allowed.
 * @returns {number} The frequency in hertz.
 * @example
 *   midiToHz(69);
 *   // 440
 * @since 1.0.0
 */
export function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * @description Clamps anything to a number between 0 and 1 (NaN and non-numbers become 0).
 * @param {*} value - The value.
 * @returns {number} 0 to 1.
 * @example
 *   clamp01('0.4');
 *   // 0.4
 * @since 1.0.0
 */
export function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.min(1, Math.max(0, number));
}

/**
 * @description A plucked envelope on a gain parameter: silent, a fast rise to the peak, then an
 *   exponential decay back to silence.
 * @param {AudioParam} param - The gain parameter.
 * @param {number} time - When the note starts, in AudioContext seconds.
 * @param {number} peak - The peak level (above 0).
 * @param {number} attackSeconds - Rise time.
 * @param {number} decaySeconds - Fall time after the peak.
 * @returns {void}
 * @example
 *   pluck(amp.gain, context.currentTime, 0.3, 0.004, 0.2);
 * @since 1.0.0
 */
export function pluck(param, time, peak, attackSeconds, decaySeconds) {
  param.setValueAtTime(SILENT, time);
  param.linearRampToValueAtTime(peak, time + attackSeconds);
  param.exponentialRampToValueAtTime(SILENT, time + attackSeconds + Math.max(decaySeconds, 0.01));
}

/**
 * @description A swell envelope on a gain parameter: rise, hold, then an exponential release.
 * @param {AudioParam} param - The gain parameter.
 * @param {number} time - When it starts, in AudioContext seconds.
 * @param {number} peak - The held level (above 0).
 * @param {number} attackSeconds - Rise time.
 * @param {number} holdSeconds - How long the peak holds.
 * @param {number} releaseSeconds - Fall time.
 * @returns {void}
 * @example
 *   swell(amp.gain, context.currentTime, 0.5, 0.2, 0.6, 0.4);
 * @since 1.0.0
 */
export function swell(param, time, peak, attackSeconds, holdSeconds, releaseSeconds) {
  param.setValueAtTime(SILENT, time);
  param.linearRampToValueAtTime(peak, time + attackSeconds);
  param.setValueAtTime(peak, time + attackSeconds + holdSeconds);
  param.exponentialRampToValueAtTime(
    SILENT,
    time + attackSeconds + holdSeconds + Math.max(releaseSeconds, 0.01)
  );
}

/**
 * @description Fills a mono buffer with white noise.
 * @param {BaseAudioContext} context - The AudioContext.
 * @param {number} seconds - Buffer length.
 * @param {function(): number} random - A number in [0, 1).
 * @returns {AudioBuffer} The buffer.
 * @example
 *   const noise = createNoiseBuffer(context, 2, Math.random);
 * @since 1.0.0
 */
export function createNoiseBuffer(context, seconds, random) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    channel[index] = random() * 2 - 1;
  }
  return buffer;
}

/**
 * @description The shared tools for one AudioContext: the context, the noise buffer (made once)
 *   and the random source used for small variations between plays.
 * @param {BaseAudioContext} context - The AudioContext.
 * @param {function(): number} [random] - A number in [0, 1); Math.random when missing.
 * @returns {{context: BaseAudioContext, random: function(): number, noiseBuffer: AudioBuffer}}
 *   The kit.
 * @example
 *   const kit = createKit(context, Math.random);
 * @since 1.0.0
 */
export function createKit(context, random) {
  const pick = typeof random === 'function' ? random : Math.random;
  return {context, random: pick, noiseBuffer: createNoiseBuffer(context, NOISE_SECONDS, pick)};
}

/**
 * @description Makes a voice: an output gain into the destination plus helpers that create nodes
 *   owned by the voice. Sources are started and stopped as they are made; when the last one ends
 *   the voice disconnects every node it made and calls onCleanup.
 * @param {{context: BaseAudioContext, random: function(): number, noiseBuffer: AudioBuffer}} kit -
 *   From createKit().
 * @param {AudioNode} destination - Where the voice plays into.
 * @param {{kind?: string, onCleanup?: function(Object): void}} [options] - A label ('event',
 *   'cue' or 'music') and a callback for when the voice has cleaned up.
 * @returns {Object} The voice: {kit, kind, output, gain(), filter(), osc(), noise(), lfo(),
 *   fadeOut(), seal(), cleanup(), sourceCount()}.
 * @example
 *   const voice = createVoice(kit, sfxBus, {kind: 'event'});
 *   const amp = voice.gain(SILENT);
 *   pluck(amp.gain, time, 0.3, 0.004, 0.2);
 *   voice.osc('triangle', 440, time, time + 0.25, amp);
 * @since 1.0.0
 */
export function createVoice(kit, destination, options) {
  const settings = options || {};
  const {context} = kit;
  const nodes = [];
  const sources = [];
  let liveSources = 0;
  let cleaned = false;
  const output = context.createGain();
  output.connect(destination);
  nodes.push(output);

  /**
   * @description Disconnects every node of the voice, once.
   * @returns {void}
   * @since 1.0.0
   */
  function cleanup() {
    if (cleaned) {
      return;
    }
    cleaned = true;
    nodes.forEach((node) => {
      try {
        node.disconnect();
      } catch {
        // Already disconnected: nothing left to release.
      }
    });
    if (typeof settings.onCleanup === 'function') {
      settings.onCleanup(voice);
    }
  }

  /**
   * @description Remembers a node so cleanup() can disconnect it.
   * @param {AudioNode} node - The node.
   * @returns {AudioNode} The same node.
   * @since 1.0.0
   */
  function own(node) {
    nodes.push(node);
    return node;
  }

  /**
   * @description Starts and stops a source, and counts it until its ended event.
   * @param {AudioScheduledSourceNode} source - The source.
   * @param {number} startAt - Start time.
   * @param {number} stopAt - Stop time.
   * @param {number} [offset] - Buffer offset (buffer sources only).
   * @returns {AudioScheduledSourceNode} The same source.
   * @since 1.0.0
   */
  function play(source, startAt, stopAt, offset) {
    own(source);
    sources.push(source);
    liveSources += 1;
    source.onended = () => {
      liveSources -= 1;
      if (liveSources <= 0) {
        cleanup();
      }
    };
    if (offset === undefined) {
      source.start(startAt);
    } else {
      source.start(startAt, offset);
    }
    source.stop(Math.max(stopAt, startAt));
    return source;
  }

  const voice = {
    kit,
    kind: typeof settings.kind === 'string' ? settings.kind : 'event',
    output,

    /**
     * @description A gain node owned by the voice.
     * @param {number} value - Its starting gain.
     * @param {AudioNode|AudioParam} [target] - What it feeds; the voice output by default.
     * @returns {GainNode} The node.
     * @since 1.0.0
     */
    gain(value, target) {
      const node = context.createGain();
      node.gain.value = value;
      node.connect(target || output);
      return own(node);
    },

    /**
     * @description A biquad filter owned by the voice.
     * @param {string} type - 'lowpass', 'highpass', 'bandpass', 'peaking' and so on.
     * @param {number} frequency - Its frequency in hertz.
     * @param {number} quality - Its Q.
     * @param {AudioNode} [target] - What it feeds; the voice output by default.
     * @returns {BiquadFilterNode} The node.
     * @since 1.0.0
     */
    filter(type, frequency, quality, target) {
      const node = context.createBiquadFilter();
      node.type = type;
      node.frequency.value = frequency;
      node.Q.value = quality;
      node.connect(target || output);
      return own(node);
    },

    /**
     * @description An oscillator owned by the voice, started and stopped at once.
     * @param {string} type - 'sine', 'square', 'sawtooth' or 'triangle'.
     * @param {number} frequency - Starting frequency in hertz.
     * @param {number} startAt - Start time.
     * @param {number} stopAt - Stop time.
     * @param {AudioNode|AudioParam} [target] - What it feeds; the voice output by default.
     * @returns {OscillatorNode} The node.
     * @since 1.0.0
     */
    osc(type, frequency, startAt, stopAt, target) {
      const node = context.createOscillator();
      node.type = type;
      node.frequency.setValueAtTime(frequency, startAt);
      node.connect(target || output);
      return play(node, startAt, stopAt);
    },

    /**
     * @description A looping white-noise source owned by the voice, from a random offset.
     * @param {number} startAt - Start time.
     * @param {number} stopAt - Stop time.
     * @param {AudioNode} [target] - What it feeds; the voice output by default.
     * @returns {AudioBufferSourceNode} The node.
     * @since 1.0.0
     */
    noise(startAt, stopAt, target) {
      const node = context.createBufferSource();
      node.buffer = kit.noiseBuffer;
      node.loop = true;
      node.connect(target || output);
      return play(node, startAt, stopAt, kit.random() * NOISE_SECONDS * 0.9);
    },

    /**
     * @description A sine LFO into a parameter: an oscillator at the rate through a gain of the
     *   depth. Returns the depth gain so its depth can be shaped over time.
     * @param {number} rate - LFO rate in hertz.
     * @param {number} depth - Peak deviation, in the parameter's own unit.
     * @param {number} startAt - Start time.
     * @param {number} stopAt - Stop time.
     * @param {AudioParam} param - The parameter it moves.
     * @returns {GainNode} The depth gain.
     * @since 1.0.0
     */
    lfo(rate, depth, startAt, stopAt, param) {
      const amount = voice.gain(depth, param);
      voice.osc('sine', rate, startAt, stopAt, amount);
      return amount;
    },

    /**
     * @description Fades the voice out from a moment and stops its sources after the fade.
     *   Sources scheduled to start later never sound.
     * @param {number} atTime - When the fade starts.
     * @param {number} seconds - Fade length.
     * @returns {void}
     * @since 1.0.0
     */
    fadeOut(atTime, seconds) {
      if (cleaned) {
        return;
      }
      output.gain.cancelScheduledValues(atTime);
      output.gain.setTargetAtTime(0, atTime, Math.max(seconds / 4, 0.005));
      const stopAt = atTime + seconds;
      sources.forEach((source) => {
        try {
          source.stop(stopAt);
        } catch {
          // A source that has already finished needs no stop.
        }
      });
    },

    /**
     * @description Cleans up at once when nothing was scheduled (an effect that bailed out).
     * @returns {void}
     * @since 1.0.0
     */
    seal() {
      if (liveSources <= 0) {
        cleanup();
      }
    },

    cleanup,

    /**
     * @description How many sources the voice has made.
     * @returns {number} The count.
     * @since 1.0.0
     */
    sourceCount() {
      return sources.length;
    }
  };
  return voice;
}
