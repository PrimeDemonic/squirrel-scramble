/**
 * Race audio (Chaos v2 contract § 9): the one engine the race stage and the sound toggles share.
 * A silly, quirky original theme (kazoo lead, oom-pah bass, pizzicato plucks, light percussion)
 * and one synthesised effect per event, all made with the Web Audio API: no files, no libraries.
 *
 *   const audio = getRaceAudio();
 *   audio.unlock();                                    // inside a user gesture
 *   audio.startRace({mode, chaosLevel, durationMs});   // music on
 *   audio.setIntensity(level);                         // 0..1, as overlaps change
 *   audio.event(event, phase);                         // phase: 'start' | 'impact' | 'end'
 *   audio.cue(name);                                   // 'go' | 'lastStretch' | 'finaleBurst'
 *                                                      //   | 'photoFinish' | 'finish' | 'hoot'
 *   audio.stop();
 *   audio.setMuted(isMuted); audio.isMuted(); audio.onChange(callback); // returns an unsubscribe
 *
 * Notes for callers:
 * - unlock() creates the AudioContext the first time and resumes it after that. Call it inside
 *   the Start, Replay and Rematch clicks. No sound of any kind exists before it.
 * - event(event, 'start') is meant for the moment the race clock passes event.startMs (the plan's
 *   action moment), during live playback only, never from debug.seek. A start plans the whole
 *   event's sound, later moments included (each cat landing, the VAR verdict, the shark's chomp),
 *   from the event's own data. 'impact' and 'end' calls are safe: each part of an event sounds
 *   once, whoever asks first. The disco's 'start' switches the music to the disco groove for the
 *   event's window; its 'end' (optional) switches it back early.
 * - setIntensity(level): at 0.25 a shaker joins, at 0.5 a glockenspiel, at 0.75 a snare backbeat
 *   and the lead an octave up.
 * - cue('finish') fades the music and plays the fanfare and the crowd cheer. "Skip to result":
 *   stop() then cue('finish'), in either order.
 * - cue('hoot') (since 2.2.0, contract § 12) is the owl commentator's hoot, for the opening and
 *   the winner line. Unlike the race cues it goes through the throttle, so it is dropped when
 *   three sounds are already playing or another hoot played within 1.5 s; muted, it is silent.
 * - onChange(callback) calls callback(muted) with a boolean each time setMuted() changes it.
 * - Sound is on by default; the choice is remembered in localStorage.
 * - Nothing here throws; without Web Audio every method is a safe no-op.
 *
 * The keyboard shortcut M: components/audio/sound-shortcut.js isSoundShortcut(event) says
 * whether a keydown is it (M, no modifier, not while typing).
 */
import {createRaceAudio} from './engine.js';

let sharedEngine = null;

/**
 * @description The page's race audio engine, made on first use. Making it touches nothing but
 *   localStorage (to read the sound preference); the AudioContext waits for unlock().
 * @returns {{unlock: function(): void, startRace: function(Object): void,
 *   setIntensity: function(number): void, event: function(Object, string): void,
 *   cue: function(string): void, stop: function(): void, setMuted: function(boolean): void,
 *   isMuted: function(): boolean, onChange: function(Function): function(): void}} The engine.
 * @example
 *   const audio = getRaceAudio();
 *   audio.unlock();
 *   audio.startRace({mode: 'chaos', chaosLevel: 'carnage', durationMs: 60000});
 *   audio.cue('go');
 * @since 1.0.0
 */
export function getRaceAudio() {
  if (!sharedEngine) {
    sharedEngine = createRaceAudio();
  }
  return sharedEngine;
}
