/**
 * The race log and the owl on the race stage (Chaos v2 contract § 11, § 12, phase 2): the
 * discrete scene's logCount and owlPose (components/stage-timeline.js sceneAt), the owl's hoots
 * as sound marks (hootMarks, withHootMarks), and static checks on the Lit modules Node cannot
 * render here: the stage wires the log, the owl and the recap in, keeps one live region, keeps
 * the bottom of the board column clear for the walkers, and ships the film-rate driver off.
 *
 * @since 2.2.0
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {themeConfig} from '../lib/theme-config.js';
import {buildRacePlan} from '../lib/choreography.js';
import {buildCommentaryCues} from '../lib/commentary.js';
import {createRng} from '../lib/rng.js';
import {buildRaceLog, commentatorPoseAt, logCountAt} from '../lib/race-log.js';
import {
  WALKER_BAND_CQH,
  hootMarks,
  prepareTimeline,
  sceneAt,
  stageTimeOf,
  withHootMarks
} from '../components/stage-timeline.js';
import {audioMarks} from '../components/stage-audio.js';
import {CHAOS_LENGTHS_MS, CLASSIC_LENGTHS_MS, randomRaceInput} from './support.js';

const PLACES = 3;
const STEP_MS = 250;
const LINE_TRIGGERS = ['winner', 'photoFinish'];

/**
 * @description A component source file.
 * @param {string} path - The path from components/.
 * @returns {string} The source.
 */
function componentSource(path) {
  return readFileSync(new URL(`../components/${path}`, import.meta.url), 'utf8');
}

/**
 * @description Everything the stage builds once a race, the way ss-race-stage.js builds it.
 * @param {Object} input - A buildRacePlan input.
 * @returns {{plan: Object, timeline: Object, cues: Object[], log: Object[]}} The race.
 */
function stageRace(input) {
  const plan = buildRacePlan(input);
  const timeline = prepareTimeline(plan, PLACES);
  const cues = buildCommentaryCues(plan, themeConfig.phrases, createRng(plan.seed + 1));
  const log = buildRaceLog(plan, {places: PLACES});
  return {plan, timeline, cues, log};
}

/**
 * @description Random races until one passes the test, at most a few hundred.
 * @param {number} seed - The generator's seed.
 * @param {Object} shape - The randomRaceInput shape.
 * @param {function(Object): boolean} wanted - Says whether a race will do.
 * @returns {Object|null} The race from stageRace, or null when none did.
 */
function findRace(seed, shape, wanted) {
  const rng = createRng(seed);
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const race = stageRace(randomRaceInput(rng, shape));
    if (wanted(race)) {
      return race;
    }
  }
  return null;
}

/**
 * @description A stage time by which the owl is quiet for good and every log entry is in: past
 *   the settled moment, the last cue and the last entry, by the owl's longest pose.
 * @param {Object} timeline - From prepareTimeline.
 * @param {Object[]} cues - From buildCommentaryCues.
 * @param {Object[]} log - From buildRaceLog.
 * @returns {number} Stage time.
 */
function quietAfterMs(timeline, cues, log) {
  const lastCue = cues.length > 0 ? cues[cues.length - 1].atMs : 0;
  const lastEntry = log.length > 0 ? log[log.length - 1].atMs : 0;
  const lastMoment = stageTimeOf(timeline, Math.max(lastCue, lastEntry));
  return Math.max(timeline.settledAtMs, lastMoment) + themeConfig.raceLog.owl.cheerMs + STEP_MS;
}

/**
 * @description The commentary cue on the winner's line.
 * @param {Object[]} cues - From buildCommentaryCues.
 * @returns {Object|undefined} The 'winner' or 'photoFinish' cue.
 */
function lineCue(cues) {
  return cues.find((cue) => LINE_TRIGGERS.includes(cue.trigger));
}

test('the scene carries the log count and the owl pose, read at race time', () => {
  const rng = createRng(9150);
  const shape = {minEntrants: 2, maxEntrants: 12, lengths: CHAOS_LENGTHS_MS, mode: 'chaos',
    chaosLevel: 'carnage'};
  for (let race = 0; race < 6; race += 1) {
    const {plan, timeline, cues, log} = stageRace(randomRaceInput(rng, shape));
    const endMs = quietAfterMs(timeline, cues, log);
    for (let stageMs = -timeline.countInMs; stageMs <= endMs; stageMs += STEP_MS) {
      const scene = sceneAt(plan, timeline, cues, stageMs, {log});
      assert.equal(scene.logCount, logCountAt(log, scene.raceMs), `count at ${stageMs}`);
      assert.equal(scene.owlPose, commentatorPoseAt(cues, log, scene.raceMs), `pose ${stageMs}`);
      if (scene.phase === 'countdown') {
        assert.equal(scene.logCount, 0);
        assert.equal(scene.owlPose, 'idle');
      }
    }
    const last = sceneAt(plan, timeline, cues, endMs, {log});
    assert.equal(last.logCount, log.length, 'every entry is in by the end');
  }
});

test('without a log the scene shows none, and the owl follows the cues alone', () => {
  const race = findRace(615, {minEntrants: 4, maxEntrants: 8, lengths: CLASSIC_LENGTHS_MS,
    mode: 'classic'}, () => true);
  const {plan, timeline, cues} = race;
  const scene = sceneAt(plan, timeline, cues, 0);
  assert.equal(scene.logCount, 0);
  assert.equal(scene.owlPose, commentatorPoseAt(cues, [], 0));
  assert.equal(scene.owlPose, 'talk', 'the opening line');
});

test('the log count and the owl pose each change the scene signature on their own', () => {
  const {plan, timeline} = findRace(2207, {minEntrants: 3, maxEntrants: 6,
    lengths: CLASSIC_LENGTHS_MS, mode: 'classic'}, () => true);
  const atMs = 1000;
  const sceneWith = (log) => sceneAt(plan, timeline, [], atMs + 200, {log});
  const quiet = sceneWith([{atMs, kind: 'slip'}]);
  const gasp = sceneWith([{atMs, kind: 'earthquake'}]);
  assert.equal(quiet.logCount, 1);
  assert.equal(gasp.logCount, 1);
  assert.equal(quiet.owlPose, 'idle');
  assert.equal(gasp.owlPose, 'gasp');
  assert.notEqual(quiet.signature, gasp.signature, 'the pose alone changes it');
  const later = sceneWith([{atMs, kind: 'slip'}, {atMs: atMs + 100, kind: 'slip'}]);
  assert.equal(later.logCount, 2);
  assert.equal(later.owlPose, 'idle');
  assert.notEqual(quiet.signature, later.signature, 'the count alone changes it');
  assert.equal(sceneWith([{atMs, kind: 'slip'}]).signature, quiet.signature, 'stable otherwise');
});

test('the stage settles only once the owl is idle again, and always does', () => {
  const rng = createRng(31337);
  const shape = {minEntrants: 1, maxEntrants: 10, lengths: CHAOS_LENGTHS_MS, mode: 'chaos',
    chaosLevel: 'silly'};
  for (let race = 0; race < 8; race += 1) {
    const {plan, timeline, cues, log} = stageRace(randomRaceInput(rng, shape));
    const endMs = quietAfterMs(timeline, cues, log);
    for (let stageMs = timeline.resultAtMs; stageMs <= endMs; stageMs += STEP_MS) {
      const scene = sceneAt(plan, timeline, cues, stageMs, {log});
      const expected = stageMs >= timeline.settledAtMs && scene.owlPose === 'idle';
      assert.equal(scene.settled, expected, `settled at ${stageMs}`);
    }
    assert.ok(sceneAt(plan, timeline, cues, endMs, {log}).settled, 'settles in the end');
  }
});

test('the owl hoots with "Go!" and on the winner’s line, in stage time', () => {
  const plain = findRace(808, {minEntrants: 2, maxEntrants: 10, lengths: CLASSIC_LENGTHS_MS,
    mode: 'classic'}, (race) => !race.timeline.freeze);
  assert.ok(plain, 'a race without a photo finish');
  const plainLine = lineCue(plain.cues);
  assert.equal(plainLine.trigger, 'winner');
  assert.deepEqual(hootMarks(plain.cues, plain.timeline), [
    {atMs: 0, kind: 'cue', name: 'hoot'},
    {atMs: Math.round(stageTimeOf(plain.timeline, plainLine.atMs)), kind: 'cue', name: 'hoot'}
  ]);
  const photo = findRace(909, {minEntrants: 2, maxEntrants: 10, lengths: CLASSIC_LENGTHS_MS,
    mode: 'classic'}, (race) => Boolean(race.timeline.freeze));
  assert.ok(photo, 'a race with a photo finish');
  const hoots = hootMarks(photo.cues, photo.timeline);
  assert.equal(hoots.length, 2);
  const click = audioMarks(photo.plan, photo.timeline)
    .find((mark) => mark.kind === 'cue' && mark.name === 'photoFinish');
  assert.equal(hoots[1].atMs, click.atMs, 'the hoot lands as the frame freezes');
  assert.equal(hoots[1].atMs, photo.timeline.freeze.startMs);
});

test('withHootMarks keeps every mark, in order, with each hoot after its moment’s marks', () => {
  const {plan, timeline, cues} = findRace(4040, {minEntrants: 4, maxEntrants: 10,
    lengths: CHAOS_LENGTHS_MS, mode: 'chaos', chaosLevel: 'carnage'}, () => true);
  const marks = audioMarks(plan, timeline);
  const before = JSON.stringify(marks);
  const merged = withHootMarks(marks, cues, timeline);
  assert.equal(JSON.stringify(marks), before, 'the marks given are left alone');
  assert.equal(merged.length, marks.length + 2);
  merged.forEach((mark, index) => {
    assert.ok(index === 0 || mark.atMs >= merged[index - 1].atMs, 'in time order');
  });
  const names = merged.filter((mark) => mark.kind === 'cue').map((mark) => mark.name);
  assert.equal(names.filter((name) => name === 'hoot').length, 2);
  assert.ok(names.indexOf('go') < names.indexOf('hoot'), 'the go cue sounds first');
  assert.deepEqual(withHootMarks(null, [], timeline), [{atMs: 0, kind: 'cue', name: 'hoot'}]);
});

test('a theme without owl triggers falls back to the winner’s line', () => {
  const {timeline, cues} = findRace(1212, {minEntrants: 3, maxEntrants: 6,
    lengths: CLASSIC_LENGTHS_MS, mode: 'classic'}, () => true);
  assert.deepEqual(hootMarks(cues, timeline, {}), hootMarks(cues, timeline));
  assert.equal(hootMarks([{atMs: 0, trigger: 'opening'}], timeline).length, 1);
});

test('the stage wires the log, the owl and the recap in, through the sound marks', () => {
  const source = componentSource('ss-race-stage.js');
  [
    'buildRaceLog(plan, {places: raceInfo.places})',
    'this._raceLog = [];',
    'log: this._raceLog',
    'owl: {pose: scene.owlPose}',
    'log: {entries: this._raceLog, count: scene.logCount, raceMs: scene.raceMs}',
    'whatHappened: {entries: this._recapEntries(scene.logCount)}',
    'withHootMarks(audioMarks(plan, timeline), cues, timeline)'
  ].forEach((snippet) => assert.ok(source.includes(snippet), snippet));
  const styles = source.slice(source.indexOf('static styles = ['));
  assert.ok(/podiumStyles,\s*commentaryStyles\s*\]/.test(styles), 'commentaryStyles adopted');
  assert.ok(!source.includes('audio.cue(\'hoot\')'), 'hoots only from the marks');
});

test('one live region on the stage: the result announcement', () => {
  const live = /aria-live="(polite|assertive)"/g;
  assert.equal([...componentSource('ss-race-stage.js').matchAll(live)].length, 1);
  ['stage-commentary.js', 'stage-hud.js', 'stage-podium.js'].forEach((file) => {
    assert.equal([...componentSource(file).matchAll(live)].length, 0, file);
  });
});

test('the board column keeps its bottom clear for the walkers, under an opaque log', () => {
  const hud = componentSource('stage-hud.js');
  assert.ok(hud.includes('<div class="race-log-clearance" aria-hidden="true"></div>'));
  assert.ok(hud.includes(`flex: 0 0 var(--walker-clearance, ${WALKER_BAND_CQH}%);`),
    'the clearance matches the walkers’ band');
  const commentary = componentSource('stage-commentary.js');
  const start = commentary.indexOf('  .race-log {');
  const rule = commentary.slice(start, commentary.indexOf('}', start));
  assert.ok(start >= 0);
  assert.ok(rule.includes('--race-log-paper: var(--ss-race-log-paper, #ffffff);'));
  assert.ok(!/opacity|transparent|rgba/.test(rule), 'the log is not see-through');
  assert.ok(componentSource('ss-race-stage.js').includes('--ss-race-log-paper: #ffffff;'));
});

test('the film-rate driver ships off; debug.filmRate(true) turns it on', () => {
  const source = componentSource('ss-race-stage.js');
  assert.ok(source.includes('new FilmRateDriver({enabled: false})'));
  assert.ok(!source.includes('new FilmRateDriver()'));
});

test('the sky no longer animates rain: the stage draws it in HTML layers', () => {
  const sheet = componentSource('sprites/animations.js');
  assert.ok(!sheet.includes('.ss-sky .rain'));
  assert.ok(!/@keyframes ss-rain\b/.test(sheet));
});
