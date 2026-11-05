/**
 * The race audio engine behind getRaceAudio() (Chaos v2 contract § 9). race-audio.js holds the
 * page's one instance; this module makes instances, so the Node tests can build one around a
 * stand-in browser (audio-env.js describes the seam).
 *
 * Signal path: music bus and SFX bus (music quieter) into a master gain, into a
 * DynamicsCompressor used as a limiter, into the speakers. Muting ramps the master gain to 0 in a
 * few milliseconds; nothing is stopped or rebuilt, and the music keeps its place without making
 * any nodes until the sound comes back.
 *
 * Autoplay: no AudioContext exists until unlock(), which the stage calls inside the Start, Replay
 * or Rematch click (and the sound toggle calls when it turns sound on). After that the engine may
 * resume its own context when a race starts or the page becomes visible during a race. It
 * suspends the context while the page is hidden, and about 8 s after a race ends.
 *
 * Never throws: every method is wrapped, and without Web Audio every method is a safe no-op
 * (isMuted() and onChange() still work, so the toggle stays usable).
 */
import {browserAudioEnvironment} from './audio-env.js';
import {clamp01, createKit, createVoice} from './synth.js';
import {SFX_LIBRARY} from './sfx.js';
import {createMusic, tempoFor} from './music.js';
import {eventIdOf, minGapFor, soundsForCue, soundsForEvent} from './effect-map.js';
import {MAX_CONCURRENT_EFFECTS, createEffectThrottle} from './throttle.js';
import {readMutedPreference, writeMutedPreference} from './preferences.js';

/** Bus levels: SFX louder than the music. */
const LEVELS = Object.freeze({master: 0.9, music: 0.3, sfx: 0.8});

/** The limiter's settings (a fast, high-ratio compressor just under full scale). */
const LIMITER = Object.freeze({threshold: -10, knee: 6, ratio: 16, attack: 0.003, release: 0.25});

const MUTE_TIME_CONSTANT_S = 0.015;
const UNMUTE_TIME_CONSTANT_S = 0.03;
const MUSIC_START_DELAY_S = 0.06;
const STOP_FADE_S = 0.25;
const FINISH_FADE_S = 0.5;
const SAFETY_FADE_S = 1;
const EVENT_CUT_S = 0.08;
const IDLE_SUSPEND_MS = 8000;
const SAFETY_TAIL_MS = 30000;
const DEFAULT_DURATION_MS = 60000;
const MAX_DURATION_MS = 600000;

/**
 * @description Does nothing; the fallback unsubscribe.
 * @returns {void}
 * @since 1.0.0
 */
function noop() {
  // Nothing to undo.
}

/**
 * @description Swallows a promise's rejection (resume() and suspend() can reject when the
 *   browser refuses).
 * @param {*} maybePromise - A promise, or anything.
 * @param {function(): void} [settled] - Called once it settles either way.
 * @returns {void}
 * @since 1.0.0
 */
function settle(maybePromise, settled) {
  const done = typeof settled === 'function' ? settled : noop;
  if (maybePromise && typeof maybePromise.then === 'function') {
    maybePromise.then(done, done);
  } else {
    done();
  }
}

/**
 * @description Makes a race audio engine. The object has exactly the contract's nine methods.
 * @param {import('./audio-env.js').AudioEnvironment} [environment] - The browser seam; the real
 *   browser when missing.
 * @returns {{unlock: function(): void, startRace: function(Object): void,
 *   setIntensity: function(number): void, event: function(Object, string): void,
 *   cue: function(string): void, stop: function(): void, setMuted: function(boolean): void,
 *   isMuted: function(): boolean, onChange: function(Function): function(): void}} The engine.
 * @example
 *   const audio = createRaceAudio();
 *   audio.unlock();
 *   audio.startRace({mode: 'chaos', chaosLevel: 'silly', durationMs: 60000});
 * @since 1.0.0
 */
export function createRaceAudio(environment) {
  const env = environment || browserAudioEnvironment();
  const listeners = new Set();
  const liveVoices = new Set();
  const playedParts = new Map();
  const impactCounts = new Map();
  const throttle = createEffectThrottle({maxConcurrent: MAX_CONCURRENT_EFFECTS, gapFor: minGapFor});
  let context = null;
  let graph = null;
  let kit = null;
  let music = null;
  let unlocked = false;
  let resumePending = false;
  let raceActive = false;
  let raceSettings = null;
  let intensity = 0;
  let watchedDocument = null;
  let idleTimer = null;
  let safetyTimer = null;
  let warned = false;
  // Read once at creation; setMuted() keeps it and the stored copy in step.
  let muted = readMutedPreference(safeStorage());

  /**
   * @description Logs the first error once, so a broken sound is visible to a developer without
   *   flooding the console or breaking the race.
   * @param {*} error - What went wrong.
   * @returns {void}
   * @since 1.0.0
   */
  function reportOnce(error) {
    if (warned) {
      return;
    }
    warned = true;
    try {
      if (globalThis.console && typeof globalThis.console.warn === 'function') {
        globalThis.console.warn('Squirrel Scramble audio skipped a sound after an error.', error);
      }
    } catch {
      // A console that cannot be written to is no reason to fail.
    }
  }

  /**
   * @description Runs a task and swallows anything it throws.
   * @param {function(): *} task - The work.
   * @param {*} [fallback] - Returned when it throws.
   * @returns {*} The task's result, or the fallback.
   * @since 1.0.0
   */
  function guard(task, fallback) {
    try {
      return task();
    } catch (error) {
      reportOnce(error);
      return fallback;
    }
  }

  /**
   * @description localStorage through the seam, or null when it cannot be reached.
   * @returns {Storage|null} The storage.
   * @since 1.0.0
   */
  function safeStorage() {
    try {
      return env.getStorage();
    } catch {
      return null;
    }
  }

  /**
   * @description Sets a timer through the seam.
   * @param {Function} callback - What to run.
   * @param {number} delayMs - When.
   * @returns {*} The handle, or null.
   * @since 1.0.0
   */
  function startTimer(callback, delayMs) {
    try {
      return env.setTimer(callback, delayMs);
    } catch {
      return null;
    }
  }

  /**
   * @description Clears a timer through the seam.
   * @param {*} handle - From startTimer().
   * @returns {void}
   * @since 1.0.0
   */
  function cancelTimer(handle) {
    if (handle === null || handle === undefined) {
      return;
    }
    try {
      env.clearTimer(handle);
    } catch {
      // A timer that cannot be cleared will find nothing to do when it fires.
    }
  }

  /**
   * @description Whether the page is hidden right now.
   * @returns {boolean} True when hidden.
   * @since 1.0.0
   */
  function isHidden() {
    return Boolean(watchedDocument)
      && (watchedDocument.hidden === true || watchedDocument.visibilityState === 'hidden');
  }

  /**
   * @description Suspends the context while it runs.
   * @returns {void}
   * @since 1.0.0
   */
  function suspendContext() {
    if (context && context.state === 'running') {
      settle(context.suspend());
    }
  }

  /**
   * @description Resumes a suspended context, unless the page is hidden.
   * @returns {void}
   * @since 1.0.0
   */
  function resumeContext() {
    if (!context || context.state !== 'suspended' || isHidden()) {
      return;
    }
    resumePending = true;
    settle(context.resume(), () => {
      resumePending = false;
    });
  }

  /**
   * @description Follows the page's visibility: suspend while hidden, resume when shown again
   *   during a race.
   * @returns {void}
   * @since 1.0.0
   */
  function onVisibilityChange() {
    guard(() => {
      if (!context || context.state === 'closed') {
        return;
      }
      if (isHidden()) {
        suspendContext();
      } else if (raceActive) {
        resumeContext();
      }
    });
  }

  /**
   * @description Starts listening for visibilitychange, once.
   * @returns {void}
   * @since 1.0.0
   */
  function watchVisibility() {
    if (watchedDocument) {
      return;
    }
    let pageDocument = null;
    try {
      pageDocument = env.getDocument();
    } catch {
      pageDocument = null;
    }
    if (pageDocument && typeof pageDocument.addEventListener === 'function') {
      pageDocument.addEventListener('visibilitychange', onVisibilityChange);
      watchedDocument = pageDocument;
    }
  }

  /**
   * @description Creates the AudioContext and the bus graph: music and SFX into the master gain,
   *   into the limiter, into the speakers. Only ever called from unlock().
   * @returns {boolean} True when there is a context.
   * @since 1.0.0
   */
  function buildGraph() {
    let created = null;
    try {
      created = env.createContext();
    } catch {
      created = null;
    }
    if (!created) {
      return false;
    }
    context = created;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = LIMITER.threshold;
    limiter.knee.value = LIMITER.knee;
    limiter.ratio.value = LIMITER.ratio;
    limiter.attack.value = LIMITER.attack;
    limiter.release.value = LIMITER.release;
    limiter.connect(context.destination);
    const master = context.createGain();
    master.gain.value = muted ? 0 : LEVELS.master;
    master.connect(limiter);
    const musicBus = context.createGain();
    musicBus.gain.value = LEVELS.music;
    musicBus.connect(master);
    const sfxBus = context.createGain();
    sfxBus.gain.value = LEVELS.sfx;
    sfxBus.connect(master);
    graph = {limiter, master, musicBus, sfxBus};
    kit = createKit(context, typeof env.random === 'function' ? env.random : Math.random);
    music = createMusic(kit, musicBus, {
      setTimer: startTimer,
      clearTimer: cancelTimer,
      onError: reportOnce
    });
    music.setSilent(muted);
    watchVisibility();
    return true;
  }

  /**
   * @description Forgets a context the browser has closed, so unlock() can make a new one.
   * @returns {void}
   * @since 1.0.0
   */
  function forgetClosedContext() {
    if (music) {
      music.dispose();
    }
    liveVoices.clear();
    context = null;
    graph = null;
    kit = null;
    music = null;
  }

  /**
   * @description Whether a sound asked for now would be heard now (not queued behind a suspended
   *   or hidden context, which would play it late).
   * @returns {boolean} True when it can play.
   * @since 1.0.0
   */
  function canPlayNow() {
    if (!context || context.state === 'closed' || isHidden()) {
      return false;
    }
    return context.state === 'running' || resumePending;
  }

  /**
   * @description Suspends the context after a quiet spell with no race (saves CPU on the result
   *   screen); a new race, or unlock(), wakes it.
   * @returns {void}
   * @since 1.0.0
   */
  function scheduleIdleSuspend() {
    cancelTimer(idleTimer);
    idleTimer = startTimer(() => {
      idleTimer = null;
      guard(() => {
        if (!raceActive) {
          suspendContext();
        }
      });
    }, IDLE_SUSPEND_MS);
  }

  /**
   * @description Ends the music on its own well after the race should have finished, in case the
   *   stage never says so.
   * @param {number} durationMs - The race length.
   * @returns {void}
   * @since 1.0.0
   */
  function armSafetyTimer(durationMs) {
    cancelTimer(safetyTimer);
    safetyTimer = startTimer(() => {
      safetyTimer = null;
      guard(() => {
        if (raceActive) {
          raceActive = false;
          if (music) {
            music.stop(SAFETY_FADE_S);
          }
          scheduleIdleSuspend();
        }
      });
    }, durationMs + SAFETY_TAIL_MS);
  }

  /**
   * @description Starts the theme for the current race, at its tempo and intensity, and arms the
   *   safety stop.
   * @returns {void}
   * @since 1.0.0
   */
  function startMusic() {
    if (!music || !raceSettings || !context) {
      return;
    }
    music.start({
      bpm: tempoFor(raceSettings.mode, raceSettings.chaosLevel),
      atTime: context.currentTime + MUSIC_START_DELAY_S
    });
    music.setIntensity(intensity);
    armSafetyTimer(raceSettings.durationMs);
  }

  /**
   * @description Plays one effect from the library in its own voice on the SFX bus.
   * @param {string} effectId - The SFX_LIBRARY id.
   * @param {number} time - Start time, AudioContext seconds.
   * @param {string} kind - 'event' or 'cue' ("Skip to result" cuts event voices only).
   * @param {Object} [options] - Passed to the effect (the fanfare's keyOffset).
   * @returns {void}
   * @since 1.0.0
   */
  function playEffect(effectId, time, kind, options) {
    const definition = SFX_LIBRARY[effectId];
    if (!definition || !kit || !graph) {
      return;
    }
    const voice = createVoice(kit, graph.sfxBus, {
      kind,
      onCleanup: (finished) => liveVoices.delete(finished)
    });
    liveVoices.add(voice);
    try {
      definition.play(voice, Math.max(time, context.currentTime), options || {});
    } catch (error) {
      voice.cleanup();
      reportOnce(error);
      return;
    }
    voice.seal();
  }

  /**
   * @description How long a list of planned sounds keeps sounding, from the call.
   * @param {Array<{effect: string, atMs: number}>} sounds - The sounds.
   * @returns {number} Milliseconds.
   * @since 1.0.0
   */
  function spanOf(sounds) {
    return sounds.reduce((longest, planned) => {
      const definition = SFX_LIBRARY[planned.effect];
      const length = definition ? definition.durationMs : 0;
      return Math.max(longest, planned.atMs + length);
    }, 0);
  }

  /**
   * @description The parts of an event that have already sounded.
   * @param {string} eventId - The event's id.
   * @returns {Set<string>} Its parts (live: add to it).
   * @since 1.0.0
   */
  function partsOf(eventId) {
    if (!playedParts.has(eventId)) {
      playedParts.set(eventId, new Set());
    }
    return playedParts.get(eventId);
  }

  /**
   * @description Counts an event's impacts: the nth 'impact' call is the nth cat.
   * @param {Object} raceEvent - The event.
   * @param {string} phase - The phase called.
   * @returns {number} How many impacts came before this one.
   * @since 1.0.0
   */
  function nextImpactIndex(raceEvent, phase) {
    if (phase !== 'impact') {
      return 0;
    }
    const eventId = eventIdOf(raceEvent);
    const before = impactCounts.get(eventId) || 0;
    impactCounts.set(eventId, before + 1);
    return before;
  }

  /**
   * @description Applies an event's music changes (the disco groove window).
   * @param {Array<{action: string, fromMs?: number, untilMs?: number}>} actions - From the plan.
   * @returns {void}
   * @since 1.0.0
   */
  function applyEventMusic(actions) {
    if (!music || actions.length === 0) {
      return;
    }
    const now = context.currentTime;
    actions.forEach((change) => {
      if (change.action === 'disco') {
        music.discoWindow(now + change.fromMs / 1000, now + change.untilMs / 1000);
      } else if (change.action === 'discoEnd') {
        music.endDisco(now);
      }
    });
  }

  /**
   * @description Applies a cue's music change: the last-stretch layers, the finale's roll and key
   *   lift, or the finish fade.
   * @param {Array<{action: string}>} actions - From the cue.
   * @returns {void}
   * @since 1.0.0
   */
  function applyCueMusic(actions) {
    if (!music) {
      return;
    }
    actions.forEach((change) => {
      if (change.action === 'lastStretch') {
        music.lastStretch();
      } else if (change.action === 'finale') {
        music.finaleLift(context.currentTime);
      } else if (change.action === 'fadeOut') {
        music.stop(FINISH_FADE_S);
      }
    });
  }

  /**
   * @description Fades out every event sound still playing or waiting ("Skip to result").
   * @returns {void}
   * @since 1.0.0
   */
  function cutEventVoices() {
    if (!context) {
      return;
    }
    const now = context.currentTime;
    Array.from(liveVoices).forEach((voice) => {
      if (voice.kind === 'event') {
        voice.fadeOut(now, EVENT_CUT_S);
      }
    });
  }

  /**
   * @description Ramps the master gain to the mute state and tells the music to go silent or
   *   play again. No node is stopped.
   * @returns {void}
   * @since 1.0.0
   */
  function applyMute() {
    if (!context || !graph) {
      return;
    }
    const now = context.currentTime;
    graph.master.gain.cancelScheduledValues(now);
    graph.master.gain.setTargetAtTime(
      muted ? 0 : LEVELS.master,
      now,
      muted ? MUTE_TIME_CONSTANT_S : UNMUTE_TIME_CONSTANT_S
    );
    if (music) {
      music.setSilent(muted);
    }
  }

  /**
   * @description Tells every onChange listener the new mute state.
   * @returns {void}
   * @since 1.0.0
   */
  function notify() {
    Array.from(listeners).forEach((listener) => {
      try {
        listener(muted);
      } catch (error) {
        reportOnce(error);
      }
    });
  }

  /**
   * @description Creates (first time) or resumes the AudioContext. Call it inside a user gesture
   *   (the Start, Replay or Rematch click, the sound toggle, the M key).
   * @returns {void}
   * @since 1.0.0
   */
  function unlock() {
    guard(() => {
      if (context && context.state === 'closed') {
        forgetClosedContext();
      }
      if (!context && !buildGraph()) {
        return;
      }
      unlocked = true;
      resumeContext();
      if (raceActive && music && !music.isPlaying()) {
        startMusic();
      }
      if (!raceActive) {
        scheduleIdleSuspend();
      }
    });
  }

  /**
   * @description A race starts: resets the per-race state and turns the music on (at 120 bpm in
   *   Classic, about 140 in Chaos). Before unlock() it only remembers the race; the music starts
   *   when unlock() comes.
   * @param {{mode: string, chaosLevel: (string|null), durationMs: number}} options - The race.
   * @returns {void}
   * @since 1.0.0
   */
  function startRace(options) {
    guard(() => {
      const settings = options && typeof options === 'object' ? options : {};
      const durationMs = Number(settings.durationMs);
      raceSettings = {
        mode: settings.mode === 'chaos' ? 'chaos' : 'classic',
        chaosLevel: typeof settings.chaosLevel === 'string' ? settings.chaosLevel : null,
        durationMs: Number.isFinite(durationMs) && durationMs > 0
          ? Math.min(durationMs, MAX_DURATION_MS)
          : DEFAULT_DURATION_MS
      };
      raceActive = true;
      intensity = 0;
      playedParts.clear();
      impactCounts.clear();
      throttle.reset();
      cancelTimer(idleTimer);
      idleTimer = null;
      cancelTimer(safetyTimer);
      safetyTimer = null;
      if (!context) {
        return;
      }
      if (unlocked) {
        resumeContext();
      }
      startMusic();
    });
  }

  /**
   * @description Sets the music's intensity (0 to 1) as overlapping events rise and fall.
   * @param {number} level - 0 to 1; anything else is clamped.
   * @returns {void}
   * @since 1.0.0
   */
  function setIntensity(level) {
    guard(() => {
      intensity = clamp01(level);
      if (music) {
        music.setIntensity(intensity);
      }
    });
  }

  /**
   * @description Plays an event's sound for a phase. Each part of an event sounds at most once;
   *   at most three effects sound at once, with a minimum gap per type.
   * @param {Object} raceEvent - A plan event (contract § 3).
   * @param {string} phase - 'start', 'impact' or 'end'.
   * @returns {void}
   * @since 1.0.0
   */
  function event(raceEvent, phase) {
    guard(() => {
      if (!context) {
        return;
      }
      const plan = soundsForEvent(raceEvent, phase, nextImpactIndex(raceEvent, phase));
      applyEventMusic(plan.music);
      if (muted || plan.sounds.length === 0 || !canPlayNow()) {
        return;
      }
      const played = partsOf(plan.id);
      const fresh = plan.sounds.filter((planned) => !played.has(planned.part));
      if (fresh.length === 0) {
        return;
      }
      const now = context.currentTime;
      if (!throttle.tryAcquire(plan.throttleKey, now * 1000, spanOf(fresh))) {
        return;
      }
      fresh.forEach((planned) => {
        played.add(planned.part);
        playEffect(planned.effect, now + planned.atMs / 1000, 'event');
      });
    });
  }

  /**
   * @description Plays a cue: 'go', 'lastStretch', 'finaleBurst' (also rolls into a key lift),
   *   'photoFinish' or 'finish' (fades the music out under a fanfare and a cheer). Those cues are
   *   never dropped by the throttle, but count towards it. The owl's 'hoot' (contract § 12, since
   *   2.2.0) goes through the throttle like an event: it is dropped when three sounds are already
   *   playing or within its gap of the last hoot. Muted, nothing plays.
   * @param {string} name - The cue.
   * @returns {void}
   * @since 1.0.0
   */
  function cue(name) {
    guard(() => {
      const plan = soundsForCue(name);
      if (!plan) {
        return;
      }
      if (name === 'finish') {
        raceActive = false;
        cancelTimer(safetyTimer);
        safetyTimer = null;
      }
      if (!context) {
        return;
      }
      applyCueMusic(plan.music);
      if (name === 'finish') {
        scheduleIdleSuspend();
      }
      if (muted || !canPlayNow()) {
        return;
      }
      const now = context.currentTime;
      const span = spanOf(plan.sounds);
      if (plan.throttled === true && !throttle.tryAcquire(name, now * 1000, span)) {
        return;
      }
      const keyOffset = music ? music.keyOffset() : 0;
      plan.sounds.forEach((planned) => {
        playEffect(planned.effect, now + planned.atMs / 1000, 'cue', {keyOffset});
      });
      if (plan.throttled !== true) {
        throttle.hold(now * 1000, span);
      }
    });
  }

  /**
   * @description Stops the race audio: fades the music and every event sound out quickly. A
   *   finish cue already playing carries on, so "Skip to result" can call stop() and cue('finish')
   *   in either order.
   * @returns {void}
   * @since 1.0.0
   */
  function stop() {
    guard(() => {
      raceActive = false;
      cancelTimer(safetyTimer);
      safetyTimer = null;
      if (!context) {
        return;
      }
      if (music) {
        music.stop(STOP_FADE_S);
      }
      cutEventVoices();
      scheduleIdleSuspend();
    });
  }

  /**
   * @description Turns the sound off or on: silences at once (a gain ramp), remembers the choice
   *   in localStorage and tells the onChange listeners when it changed.
   * @param {boolean} isMutedValue - True for sound off.
   * @returns {void}
   * @since 1.0.0
   */
  function setMuted(isMutedValue) {
    guard(() => {
      const next = Boolean(isMutedValue);
      writeMutedPreference(safeStorage(), next);
      if (next === muted) {
        return;
      }
      muted = next;
      guard(applyMute);
      notify();
    });
  }

  /**
   * @description Whether the sound is off.
   * @returns {boolean} True when muted.
   * @since 1.0.0
   */
  function isMuted() {
    return muted;
  }

  /**
   * @description Calls back with the new mute state (a boolean) whenever it changes.
   * @param {function(boolean): void} callback - The listener.
   * @returns {function(): void} Removes the listener.
   * @since 1.0.0
   */
  function onChange(callback) {
    return guard(() => {
      if (typeof callback !== 'function') {
        return noop;
      }
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    }, noop);
  }

  return Object.freeze({
    unlock,
    startRace,
    setIntensity,
    event,
    cue,
    stop,
    setMuted,
    isMuted,
    onChange
  });
}
