/**
 * Test doubles for the race audio's browser seam (components/audio/audio-env.js): a stand-in
 * AudioContext that records every node, an in-memory and a throwing localStorage, a document
 * whose visibility the test flips, and timers the test fires by hand. Not a test file itself (the
 * name does not match *.test.js).
 *
 * The stand-in is strict where browsers are strict, so the tests catch what would throw on the
 * instance: an exponential ramp to 0 or below, a non-finite value or time, a negative time, a
 * source started twice or stopped before it started, and an unknown oscillator or filter type.
 */

const OSCILLATOR_TYPES = ['sine', 'square', 'sawtooth', 'triangle'];
const FILTER_TYPES = [
  'lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf', 'peaking', 'notch', 'allpass'
];

/**
 * @description Throws like a browser when a time is unusable.
 * @param {*} time - The time.
 * @param {string} label - What it was for.
 * @returns {void}
 * @since 1.0.0
 */
function checkTime(time, label) {
  if (typeof time !== 'number' || !Number.isFinite(time) || time < 0) {
    throw new RangeError(`${label}: unusable time ${time}`);
  }
}

/**
 * @description Throws like a browser when a value is not a finite number.
 * @param {*} value - The value.
 * @param {string} label - What it was for.
 * @returns {void}
 * @since 1.0.0
 */
function checkValue(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label}: non-finite value ${value}`);
  }
}

/** A stand-in AudioParam that records its automation. */
export class FakeParam {
  /**
   * @description Makes a parameter.
   * @param {string} name - Its name, for messages.
   * @param {number} value - Its default value.
   * @since 1.0.0
   */
  constructor(name, value) {
    this.name = name;
    this._value = value;
    this.events = [];
  }

  /**
   * @description The current value.
   * @returns {number} The value.
   * @since 1.0.0
   */
  get value() {
    return this._value;
  }

  /**
   * @description Sets the value now.
   * @param {number} next - The value.
   * @since 1.0.0
   */
  set value(next) {
    checkValue(next, `${this.name}.value`);
    this._value = next;
  }

  /**
   * @description Records setValueAtTime.
   * @param {number} value - The value.
   * @param {number} time - When.
   * @returns {FakeParam} This parameter.
   * @since 1.0.0
   */
  setValueAtTime(value, time) {
    checkValue(value, this.name);
    checkTime(time, this.name);
    this.events.push({kind: 'set', value, time});
    return this;
  }

  /**
   * @description Records linearRampToValueAtTime.
   * @param {number} value - The target.
   * @param {number} time - When it arrives.
   * @returns {FakeParam} This parameter.
   * @since 1.0.0
   */
  linearRampToValueAtTime(value, time) {
    checkValue(value, this.name);
    checkTime(time, this.name);
    this.events.push({kind: 'linear', value, time});
    return this;
  }

  /**
   * @description Records exponentialRampToValueAtTime; rejects targets at or below 0.
   * @param {number} value - The target.
   * @param {number} time - When it arrives.
   * @returns {FakeParam} This parameter.
   * @since 1.0.0
   */
  exponentialRampToValueAtTime(value, time) {
    checkValue(value, this.name);
    checkTime(time, this.name);
    if (value <= 0) {
      throw new RangeError(`${this.name}: exponential ramp to ${value}`);
    }
    this.events.push({kind: 'exponential', value, time});
    return this;
  }

  /**
   * @description Records setTargetAtTime.
   * @param {number} value - The target.
   * @param {number} time - When it starts.
   * @param {number} timeConstant - How fast.
   * @returns {FakeParam} This parameter.
   * @since 1.0.0
   */
  setTargetAtTime(value, time, timeConstant) {
    checkValue(value, this.name);
    checkTime(time, this.name);
    checkValue(timeConstant, `${this.name} time constant`);
    if (timeConstant < 0) {
      throw new RangeError(`${this.name}: negative time constant`);
    }
    this.events.push({kind: 'target', value, time, timeConstant});
    return this;
  }

  /**
   * @description Records cancelScheduledValues.
   * @param {number} time - From when.
   * @returns {FakeParam} This parameter.
   * @since 1.0.0
   */
  cancelScheduledValues(time) {
    checkTime(time, this.name);
    this.events.push({kind: 'cancel', time});
    return this;
  }

  /**
   * @description The last automation event recorded.
   * @returns {Object|undefined} The event.
   * @since 1.0.0
   */
  lastEvent() {
    return this.events[this.events.length - 1];
  }
}

/** A stand-in AudioNode: records what it is connected to. */
class FakeNode {
  /**
   * @description Makes a node and registers it with its context.
   * @param {FakeAudioContext} context - The context.
   * @param {string} kind - 'gain', 'filter', 'oscillator' and so on.
   * @since 1.0.0
   */
  constructor(context, kind) {
    this.context = context;
    this.kind = kind;
    this.targets = new Set();
    context.created.push(this);
  }

  /**
   * @description Connects to a node or a parameter.
   * @param {Object} target - The node or parameter.
   * @returns {Object} The target.
   * @since 1.0.0
   */
  connect(target) {
    if (!target) {
      throw new TypeError(`${this.kind}: connect() needs a target`);
    }
    this.targets.add(target);
    return target;
  }

  /**
   * @description Disconnects from one target, or from everything.
   * @param {Object} [target] - The target.
   * @returns {void}
   * @since 1.0.0
   */
  disconnect(target) {
    if (target === undefined) {
      this.targets.clear();
    } else {
      this.targets.delete(target);
    }
  }
}

/** A stand-in GainNode. */
class FakeGain extends FakeNode {
  /**
   * @description Makes a gain node.
   * @param {FakeAudioContext} context - The context.
   * @since 1.0.0
   */
  constructor(context) {
    super(context, 'gain');
    this.gain = new FakeParam('gain', 1);
  }
}

/** A stand-in BiquadFilterNode. */
class FakeFilter extends FakeNode {
  /**
   * @description Makes a filter.
   * @param {FakeAudioContext} context - The context.
   * @since 1.0.0
   */
  constructor(context) {
    super(context, 'filter');
    this._type = 'lowpass';
    this.frequency = new FakeParam('frequency', 350);
    this.Q = new FakeParam('Q', 1);
    this.gain = new FakeParam('filterGain', 0);
  }

  /**
   * @description The filter type.
   * @returns {string} The type.
   * @since 1.0.0
   */
  get type() {
    return this._type;
  }

  /**
   * @description Sets the filter type; rejects unknown ones.
   * @param {string} next - The type.
   * @since 1.0.0
   */
  set type(next) {
    if (!FILTER_TYPES.includes(next)) {
      throw new TypeError(`unknown filter type ${next}`);
    }
    this._type = next;
  }
}

/** A stand-in DynamicsCompressorNode. */
class FakeCompressor extends FakeNode {
  /**
   * @description Makes a compressor.
   * @param {FakeAudioContext} context - The context.
   * @since 1.0.0
   */
  constructor(context) {
    super(context, 'compressor');
    this.threshold = new FakeParam('threshold', -24);
    this.knee = new FakeParam('knee', 30);
    this.ratio = new FakeParam('ratio', 12);
    this.attack = new FakeParam('attack', 0.003);
    this.release = new FakeParam('release', 0.25);
  }
}

/** A stand-in scheduled source: start once, stop after start, ended when the clock passes. */
class FakeSource extends FakeNode {
  /**
   * @description Makes a source.
   * @param {FakeAudioContext} context - The context.
   * @param {string} kind - 'oscillator' or 'bufferSource'.
   * @since 1.0.0
   */
  constructor(context, kind) {
    super(context, kind);
    this.startTime = null;
    this.stopTime = null;
    this.ended = false;
    this.onended = null;
  }

  /**
   * @description Starts the source; a second start throws.
   * @param {number} [time] - When.
   * @param {number} [offset] - Buffer offset.
   * @returns {void}
   * @since 1.0.0
   */
  start(time = 0, offset = 0) {
    if (this.startTime !== null) {
      throw new Error(`InvalidStateError: ${this.kind} started twice`);
    }
    checkTime(time, `${this.kind}.start`);
    checkTime(offset, `${this.kind}.start offset`);
    this.startTime = time;
    this.context.started.push(this);
  }

  /**
   * @description Stops the source; before start() it throws.
   * @param {number} [time] - When.
   * @returns {void}
   * @since 1.0.0
   */
  stop(time = 0) {
    if (this.startTime === null) {
      throw new Error(`InvalidStateError: ${this.kind} stopped before it started`);
    }
    checkTime(time, `${this.kind}.stop`);
    this.stopTime = time;
  }
}

/** A stand-in OscillatorNode. */
class FakeOscillator extends FakeSource {
  /**
   * @description Makes an oscillator.
   * @param {FakeAudioContext} context - The context.
   * @since 1.0.0
   */
  constructor(context) {
    super(context, 'oscillator');
    this._type = 'sine';
    this.frequency = new FakeParam('frequency', 440);
    this.detune = new FakeParam('detune', 0);
  }

  /**
   * @description The waveform.
   * @returns {string} The type.
   * @since 1.0.0
   */
  get type() {
    return this._type;
  }

  /**
   * @description Sets the waveform; rejects unknown ones.
   * @param {string} next - The type.
   * @since 1.0.0
   */
  set type(next) {
    if (!OSCILLATOR_TYPES.includes(next)) {
      throw new TypeError(`unknown oscillator type ${next}`);
    }
    this._type = next;
  }
}

/** A stand-in AudioBufferSourceNode. */
class FakeBufferSource extends FakeSource {
  /**
   * @description Makes a buffer source.
   * @param {FakeAudioContext} context - The context.
   * @since 1.0.0
   */
  constructor(context) {
    super(context, 'bufferSource');
    this.buffer = null;
    this.loop = false;
    this.playbackRate = new FakeParam('playbackRate', 1);
  }

  /**
   * @description Starts; a source without a buffer is a mistake here.
   * @param {number} [time] - When.
   * @param {number} [offset] - Buffer offset.
   * @returns {void}
   * @since 1.0.0
   */
  start(time = 0, offset = 0) {
    if (!this.buffer) {
      throw new Error('bufferSource started without a buffer');
    }
    super.start(time, offset);
  }
}

/** A stand-in AudioContext with a clock the test moves. */
export class FakeAudioContext {
  /**
   * @description Makes a context, suspended like one created outside a gesture.
   * @since 1.0.0
   */
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 8000;
    this.state = 'suspended';
    this.created = [];
    this.started = [];
    this.calls = {resume: 0, suspend: 0, close: 0};
    this.destination = new FakeNode(this, 'destination');
  }

  /**
   * @description A gain node.
   * @returns {FakeGain} The node.
   * @since 1.0.0
   */
  createGain() {
    return new FakeGain(this);
  }

  /**
   * @description A filter.
   * @returns {FakeFilter} The node.
   * @since 1.0.0
   */
  createBiquadFilter() {
    return new FakeFilter(this);
  }

  /**
   * @description A compressor.
   * @returns {FakeCompressor} The node.
   * @since 1.0.0
   */
  createDynamicsCompressor() {
    return new FakeCompressor(this);
  }

  /**
   * @description An oscillator.
   * @returns {FakeOscillator} The node.
   * @since 1.0.0
   */
  createOscillator() {
    return new FakeOscillator(this);
  }

  /**
   * @description A buffer source.
   * @returns {FakeBufferSource} The node.
   * @since 1.0.0
   */
  createBufferSource() {
    return new FakeBufferSource(this);
  }

  /**
   * @description A buffer.
   * @param {number} channels - Channel count.
   * @param {number} length - Frames.
   * @param {number} sampleRate - Rate.
   * @returns {Object} The buffer.
   * @since 1.0.0
   */
  createBuffer(channels, length, sampleRate) {
    if (!(channels >= 1 && length >= 1 && sampleRate > 0)) {
      throw new RangeError('bad buffer shape');
    }
    const data = Array.from({length: channels}, () => new Float32Array(length));
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: (channel) => data[channel]
    };
  }

  /**
   * @description Resumes.
   * @returns {Promise<void>} Resolved.
   * @since 1.0.0
   */
  resume() {
    this.calls.resume += 1;
    if (this.state !== 'closed') {
      this.state = 'running';
    }
    return Promise.resolve();
  }

  /**
   * @description Suspends.
   * @returns {Promise<void>} Resolved.
   * @since 1.0.0
   */
  suspend() {
    this.calls.suspend += 1;
    if (this.state !== 'closed') {
      this.state = 'suspended';
    }
    return Promise.resolve();
  }

  /**
   * @description Closes.
   * @returns {Promise<void>} Resolved.
   * @since 1.0.0
   */
  close() {
    this.calls.close += 1;
    this.state = 'closed';
    return Promise.resolve();
  }

  /**
   * @description Moves the clock on and fires ended on every source whose stop time has passed.
   * @param {number} seconds - How far.
   * @returns {void}
   * @since 1.0.0
   */
  advance(seconds) {
    this.currentTime += seconds;
    this.started.forEach((source) => {
      if (!source.ended && source.stopTime !== null && source.stopTime <= this.currentTime) {
        source.ended = true;
        if (typeof source.onended === 'function') {
          source.onended();
        }
      }
    });
  }

  /**
   * @description How many nodes of a kind were ever created.
   * @param {string} kind - 'oscillator', 'bufferSource', 'gain' and so on.
   * @returns {number} The count.
   * @since 1.0.0
   */
  count(kind) {
    return this.created.filter((node) => node.kind === kind).length;
  }

  /**
   * @description How many sources were ever started.
   * @returns {number} The count.
   * @since 1.0.0
   */
  sourceCount() {
    return this.started.length;
  }
}

/**
 * @description An in-memory localStorage.
 * @returns {{getItem: Function, setItem: Function, removeItem: Function}} The storage.
 * @since 1.0.0
 */
export function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => {
      values.set(key, String(value));
    },
    removeItem: (key) => {
      values.delete(key);
    }
  };
}

/**
 * @description A localStorage that throws on every call, like a blocked one.
 * @returns {{getItem: Function, setItem: Function}} The storage.
 * @since 1.0.0
 */
export function createThrowingStorage() {
  return {
    getItem() {
      throw new Error('SecurityError: storage is blocked');
    },
    setItem() {
      throw new Error('QuotaExceededError: storage is full');
    }
  };
}

/**
 * @description A document whose visibility the test can flip.
 * @returns {{hidden: boolean, visibilityState: string, addEventListener: Function,
 *   setHidden: function(boolean): void}} The document.
 * @since 1.0.0
 */
export function createFakeDocument() {
  const listeners = new Set();
  const fakeDocument = {
    hidden: false,
    visibilityState: 'visible',
    addEventListener(type, listener) {
      if (type === 'visibilitychange') {
        listeners.add(listener);
      }
    },
    removeEventListener(type, listener) {
      listeners.delete(listener);
    },
    setHidden(hidden) {
      fakeDocument.hidden = hidden;
      fakeDocument.visibilityState = hidden ? 'hidden' : 'visible';
      listeners.forEach((listener) => listener());
    }
  };
  return fakeDocument;
}

/**
 * @description Timers the test fires by hand.
 * @returns {{setTimer: Function, clearTimer: Function, runDue: function(): number,
 *   pending: function(): Array<{delayMs: number}>}} The timers.
 * @since 1.0.0
 */
export function createManualTimers() {
  const waiting = new Map();
  let nextHandle = 1;
  return {
    setTimer(callback, delayMs) {
      const handle = nextHandle;
      nextHandle += 1;
      waiting.set(handle, {callback, delayMs});
      return handle;
    },
    clearTimer(handle) {
      waiting.delete(handle);
    },
    runDue(maxDelayMs = Infinity) {
      const due = Array.from(waiting.entries()).filter(([, timer]) => timer.delayMs <= maxDelayMs);
      due.forEach(([handle]) => waiting.delete(handle));
      due.forEach(([, timer]) => timer.callback());
      return due.length;
    },
    pending() {
      return Array.from(waiting.values()).map((timer) => ({delayMs: timer.delayMs}));
    }
  };
}

/**
 * @description A whole stand-in browser for createRaceAudio().
 * @param {{storage?: Object|null, noAudio?: boolean, contextThrows?: boolean,
 *   storageGetterThrows?: boolean}} [options] - What to break.
 * @returns {Object} The environment, plus contexts, timers, document and storage for the test.
 * @since 1.0.0
 */
export function createFakeEnvironment(options = {}) {
  const timers = createManualTimers();
  const fakeDocument = createFakeDocument();
  const contexts = [];
  const storage = options.storage === undefined ? createMemoryStorage() : options.storage;
  let seed = 7;
  return {
    contexts,
    timers,
    document: fakeDocument,
    storage,
    createContext() {
      if (options.contextThrows) {
        throw new Error('NotAllowedError: no audio here');
      }
      if (options.noAudio) {
        return null;
      }
      const context = new FakeAudioContext();
      contexts.push(context);
      return context;
    },
    getStorage() {
      if (options.storageGetterThrows) {
        throw new Error('SecurityError: localStorage is not available');
      }
      return storage;
    },
    getDocument() {
      return fakeDocument;
    },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    random() {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    }
  };
}
