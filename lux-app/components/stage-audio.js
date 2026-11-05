/**
 * The race's sound marks (Chaos v2 contract § 9), worked out once per race from the plan: when
 * each event starts, lands its impact and ends, and the race's own cues (go, the last stretch,
 * the finale burst, a photo finish, the finish). The race stage plays them through
 * components/audio/race-audio.js as its clock passes each one during live playback only, never
 * from a debug seek; and it sets the music's intensity from how many Chaos events overlap.
 *
 * Every mark is in stage time (race time shifted by the photo-finish hold, stage-timeline.js),
 * so a mark after the hold sounds when the stage shows it. An event's 'start' mark is at its plan
 * startMs, never at the visual lead-in: the engine plans the whole event's sound from that
 * moment and the event's own data (each cat landing, the shark's chomp, the verdict). The
 * 'impact' and 'end' marks are extras the engine accepts safely (each part of an event sounds
 * once, whoever asks first); a disco's 'end' hands the music back from the disco groove.
 *
 * Pure ES module: no DOM, no Lit, no clock and no sound.
 */
import {themeConfig} from '../lib/theme-config.js';
import {STAGE_TIMINGS, catThrows} from './stage-shared.js';
import {stageTimeOf} from './stage-timeline.js';

/**
 * The impact moments of each event type, in race time, where the event has one besides its
 * start: (event, timeline) => race times.
 */
const IMPACTS = Object.freeze({
  // The shot.
  hunter: (event) => [event.startMs],
  // The strike.
  lightning: (event) => [event.startMs],
  // The smack on the leader.
  goldenAcorn: (event) => [
    Number.isFinite(event.data.impactMs) ? event.data.impactMs : event.startMs
  ],
  // Each cat that lands (an eagle catches an intercepted one).
  catLady: (event, timeline) => catThrows(event, timeline.tickMs)
    .filter((item) => !item.intercepted)
    .map((item) => item.atMs),
  // A sharknado's hat chomp.
  tornado: (event, timeline) => {
    const chomp = timeline.hatChomps[event.id];
    return chomp ? [chomp.atMs] : [];
  },
  // The kiss or the slap.
  suitor: (event) => {
    const rules = STAGE_TIMINGS.suitor;
    const share = event.outcome === 'slap' ? rules.slapShare : rules.leanShare;
    return [Math.round(event.startMs + (event.endMs - event.startMs) * share)];
  },
  // The outfit swap in the beam.
  ufo: (event) => [
    Number.isFinite(event.data.swapAtMs)
      ? event.data.swapAtMs
      : Math.round((event.startMs + event.endMs) / 2)
  ],
  // The squirrels under the water bursting up.
  flood: (event) => (Number.isFinite(event.data.burstAtMs) ? [event.data.burstAtMs] : []),
  // The verdict.
  var: (event) => [
    Math.round(event.startMs + (event.endMs - event.startMs) * STAGE_TIMINGS.var.verdictShare)
  ],
  // The trench coat toppling apart.
  trenchCoat: (event, timeline) => {
    const disguise = timeline.disguises[event.id];
    return disguise ? [disguise.endMs] : [];
  }
});

/**
 * @description Every sound mark of a race, in time order: the cues ('go', 'lastStretch',
 *   'finaleBurst' in Absolute Carnage, 'photoFinish' and 'finish') and each event's 'start',
 *   'impact' (where it has one) and 'end'.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object} timeline - From prepareTimeline.
 * @param {Object} [theme] - The theme config.
 * @returns {Array<{atMs: number, kind: string, name?: string, event?: Object,
 *   phase?: string}>} The marks, stage time in milliseconds; kind is 'cue' (with name) or 'event'
 *   (with the normalised event and the phase).
 * @example
 *   audioMarks(plan, timeline).filter((mark) => mark.kind === 'cue');
 * @since 2.1.0
 */
export function audioMarks(plan, timeline, theme = themeConfig) {
  const marks = [];
  const atStage = (raceMs) => Math.round(stageTimeOf(timeline, raceMs));
  const cue = (name, stageMs) => marks.push({atMs: Math.round(stageMs), kind: 'cue', name});
  const eventMark = (event, phase, raceMs) => marks.push({
    atMs: atStage(raceMs),
    kind: 'event',
    event,
    phase
  });
  cue('go', 0);
  cue('lastStretch', atStage(Math.round(plan.durationMs * theme.timings.finalStretchFraction)));
  const burst = plan.finaleBurst;
  if (burst && burst.count > 0 && Array.isArray(burst.eventIds)) {
    const starts = timeline.events
      .filter((event) => burst.eventIds.includes(event.id))
      .map((event) => event.startMs);
    if (starts.length > 0) {
      cue('finaleBurst', atStage(Math.min(...starts)));
    }
  }
  if (timeline.freeze) {
    // The camera clicks as the frame freezes; the fanfare plays as the race carries on.
    cue('photoFinish', timeline.freeze.startMs);
    cue('finish', timeline.freeze.startMs + timeline.freeze.holdMs);
  } else {
    cue('finish', atStage(plan.entrants[plan.winnerIndex].finishMs));
  }
  timeline.events.forEach((event) => {
    eventMark(event, 'start', event.startMs);
    const impacts = IMPACTS[event.type] ? IMPACTS[event.type](event, timeline) : [];
    impacts
      .filter((impactMs) => Number.isFinite(impactMs))
      .forEach((impactMs) => eventMark(event, 'impact', impactMs));
    eventMark(event, 'end', event.endMs);
  });
  // A stable sort: marks at the same moment keep the order above (cues first).
  return marks.sort((first, second) => first.atMs - second.atMs);
}

/**
 * @description The most Chaos events the race's level allows on screen at once (contract § 1),
 *   which is where the music's intensity tops out; 0 for a Classic race.
 * @param {Object} plan - From buildRacePlan.
 * @param {Object} [theme] - The theme config.
 * @returns {number} The cap.
 * @example
 *   overlapCap({chaosLevel: 'carnage'});
 *   // 5
 * @since 2.1.0
 */
export function overlapCap(plan, theme = themeConfig) {
  const levels = theme.chaosLevels && theme.chaosLevels.levels ? theme.chaosLevels.levels : {};
  const level = plan && typeof plan.chaosLevel === 'string' ? levels[plan.chaosLevel] : null;
  return level && Number.isFinite(level.maxOverlap) && level.maxOverlap > 0
    ? level.maxOverlap
    : 0;
}

/**
 * @description The music's intensity at a race time (contract § 9): how many Chaos events are
 *   under way, as a share of the level's cap, from 0 (none) to 1 (the cap or more).
 * @param {Object} timeline - From prepareTimeline.
 * @param {number} raceMs - Race time.
 * @param {number} cap - From overlapCap.
 * @returns {number} From 0 to 1, in hundredths.
 * @example
 *   intensityAt(timeline, 41000, 5);
 * @since 2.1.0
 */
export function intensityAt(timeline, raceMs, cap) {
  if (!(cap > 0)) {
    return 0;
  }
  const active = timeline.events.filter((event) => (
    event.category === 'chaos' && event.startMs <= raceMs && raceMs < event.endMs
  )).length;
  return Math.round(Math.min(1, active / cap) * 100) / 100;
}
