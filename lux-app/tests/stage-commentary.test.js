/**
 * Unit tests for the owl commentator and the race log's display layer (Chaos v2 contract § 11,
 * § 12): commentatorPoseAt (lib/race-log.js, re-exported by components/stage-commentary.js), the
 * race log's literal catalogue and helpers in components/phrases.js, and static checks on the
 * Lit modules (which Node cannot render here): one live region, no Tailwind or DaisyUI classes
 * in the stage's markup, and an owl whose drawing never depends on its pose.
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
import {buildRaceLog, commentatorPoseAt, logEntryText} from '../lib/race-log.js';
import {
  RACE_LOG_CATALOGUE,
  fillPlaceholders,
  logLineParts,
  logListWords,
  translateLogEntry,
  translateLogTitle
} from '../components/phrases.js';
import {CHAOS_LENGTHS_MS, randomRaceInput} from './support.js';

const POSES = ['idle', 'talk', 'gasp', 'cheer'];

/**
 * @description An i18n stub that fills named placeholders the way the AIUX service does.
 * @returns {{getMessage: function(string, Object): string}} The stub.
 */
function fillingI18n() {
  return {getMessage: (message, values) => fillPlaceholders(message, values)};
}

/**
 * @description A component source file.
 * @param {string} path - The path from components/.
 * @returns {string} The source.
 */
function componentSource(path) {
  return readFileSync(new URL(`../components/${path}`, import.meta.url), 'utf8');
}

/**
 * @description Every race log key in the theme with its English text.
 * @returns {Map<string, string>} Key to text.
 */
function themeLogTexts() {
  const {templates, titles, list} = themeConfig.raceLog;
  const texts = new Map([[list.key, list.text]]);
  Object.values(titles).forEach((title) => texts.set(title.key, title.text));
  Object.values(templates).flat().forEach((line) => texts.set(line.key, line.text));
  return texts;
}

/**
 * @description A log line put back together from logLineParts, each names part joined with the
 *   reader's list words, as the stage shows it (without the chips).
 * @param {Object} plan - The plan.
 * @param {Object} entry - A log entry.
 * @returns {string} The line.
 */
function lineFromParts(plan, entry) {
  const words = logListWords(fillingI18n());
  return logLineParts(fillingI18n(), entry).map((part) => {
    if (part.kind === 'text') {
      return part.text;
    }
    const names = part.indexes.map((index) => plan.entrants[index].name);
    if (names.length < 2) {
      return names.join('');
    }
    return `${names.slice(0, -1).join(words.separator)}${words.conjunction}${names.at(-1)}`;
  }).join('');
}

test('the race log catalogue covers every raceLog key and nothing else, word for word', () => {
  const texts = themeLogTexts();
  assert.deepEqual(Object.keys(RACE_LOG_CATALOGUE).sort(), [...texts.keys()].sort());
  const recording = {getMessage: (message, values) => ({message, values})};
  texts.forEach((text, key) => {
    const values = {names: 'Alex', name: 'Sam', other: 'Jo'};
    const result = RACE_LOG_CATALOGUE[key](recording, values);
    assert.equal(result.message, text, key);
    assert.deepEqual(result.values, values, key);
  });
});

test('translateLogEntry and translateLogTitle read every entry of a real race', () => {
  const rng = createRng(77);
  const shape = {minEntrants: 3, maxEntrants: 10, lengths: CHAOS_LENGTHS_MS, mode: 'chaos',
    chaosLevel: 'carnage'};
  for (let race = 0; race < 20; race += 1) {
    const plan = buildRacePlan(randomRaceInput(rng, shape));
    buildRaceLog(plan, {places: 3}).forEach((entry) => {
      assert.equal(translateLogEntry(fillingI18n(), entry), logEntryText(entry), entry.id);
      assert.equal(translateLogTitle(fillingI18n(), entry), entry.title, entry.id);
      assert.equal(lineFromParts(plan, entry), logEntryText(entry), entry.id);
    });
  }
});

test('the helpers fall back to the theme text for an unknown key or a missing service', () => {
  const entry = {
    templateKey: 'not_in_the_catalogue',
    template: '{names} waves.',
    params: {names: 'Jo'},
    subjects: {names: [2], name: null, other: null},
    titleKey: 'not_a_title',
    title: 'Wave'
  };
  assert.equal(translateLogEntry(fillingI18n(), entry), 'Jo waves.');
  assert.equal(translateLogTitle(fillingI18n(), entry), 'Wave');
  assert.deepEqual(logLineParts(null, entry), [
    {kind: 'names', slot: 'names', indexes: [2]},
    {kind: 'text', text: ' waves.'}
  ]);
  assert.equal(translateLogEntry(fillingI18n(), null), '');
  assert.equal(translateLogTitle(fillingI18n(), undefined), '');
  assert.deepEqual(logLineParts(fillingI18n(), null), []);
});

test('logLineParts follows the translation’s word order and keeps every name slot', () => {
  const plan = {entrants: ['Alex', 'Sam', 'Jo', 'Priya'].map((name) => ({name, finishMs: 1}))};
  const entry = {
    templateKey: 'log_trench_coat_host',
    template: '{names} squeezed into one trench coat, with {name} on top.',
    params: {names: 'Sam, Jo and Priya', name: 'Jo'},
    subjects: {names: [1, 2, 3], name: 2, other: null}
  };
  assert.deepEqual(logLineParts(fillingI18n(), entry), [
    {kind: 'names', slot: 'names', indexes: [1, 2, 3]},
    {kind: 'text', text: ' squeezed into one trench coat, with '},
    {kind: 'names', slot: 'name', indexes: [2]},
    {kind: 'text', text: ' on top.'}
  ]);
  assert.equal(lineFromParts(plan, entry), 'Sam, Jo and Priya squeezed into one trench coat, '
    + 'with Jo on top.');
  const reordered = {getMessage: (_message, values) => `${values.name} oben: ${values.names}`};
  assert.deepEqual(logLineParts(reordered, entry), [
    {kind: 'names', slot: 'name', indexes: [2]},
    {kind: 'text', text: ' oben: '},
    {kind: 'names', slot: 'names', indexes: [1, 2, 3]}
  ]);
  const unnamed = {...entry, subjects: {names: [], name: null, other: null}};
  assert.deepEqual(logLineParts(fillingI18n(), unnamed).map((part) => part.kind),
    ['text', 'text', 'text', 'text']);
});

test('logListWords reads the translated list words, or keeps the English ones', () => {
  assert.deepEqual(logListWords(fillingI18n()), {separator: ', ', conjunction: ' and '});
  const german = {getMessage: (_message, values) => `${values.first} und ${values.last}`};
  assert.deepEqual(logListWords(german), {separator: ', ', conjunction: ' und '});
  const backwards = {getMessage: (_message, values) => `${values.last} y ${values.first}`};
  assert.deepEqual(logListWords(backwards), {separator: ', ', conjunction: ' and '});
  assert.deepEqual(logListWords(null), {separator: ', ', conjunction: ' and '});
});

test('the owl idles before the start and talks for a moment after each cue', () => {
  const cues = [{atMs: 0, trigger: 'opening'}, {atMs: 9000, trigger: 'lead'}];
  const {talkMs} = themeConfig.raceLog.owl;
  assert.equal(commentatorPoseAt(cues, [], -1), 'idle');
  assert.equal(commentatorPoseAt(cues, [], Number.NaN), 'idle');
  assert.equal(commentatorPoseAt(cues, [], 0), 'talk');
  assert.equal(commentatorPoseAt(cues, [], talkMs - 1), 'talk');
  assert.equal(commentatorPoseAt(cues, [], talkMs), 'idle');
  assert.equal(commentatorPoseAt(cues, [], 9000), 'talk');
  assert.equal(commentatorPoseAt(cues, [], 9000 + talkMs), 'idle');
  assert.equal(commentatorPoseAt([], [], 5000), 'idle');
  assert.equal(commentatorPoseAt(null, null, 5000), 'idle');
});

test('the owl gasps at a big moment, from a cue or from the log', () => {
  const {gaspMs} = themeConfig.raceLog.owl;
  const cues = [{atMs: 5000, trigger: 'tornado'}];
  assert.equal(commentatorPoseAt(cues, [], 5000), 'gasp');
  assert.equal(commentatorPoseAt(cues, [], 5000 + gaspMs - 1), 'gasp');
  assert.equal(commentatorPoseAt(cues, [], 5000 + gaspMs), 'idle');
  const log = [{atMs: 0, kind: 'opening'}, {atMs: 12000, kind: 'earthquake'}];
  assert.equal(commentatorPoseAt([], log, 12500), 'gasp', 'the commentary had no room for it');
  assert.equal(commentatorPoseAt([], log, 12000 + gaspMs), 'idle');
  assert.equal(commentatorPoseAt([], [{atMs: 3000, kind: 'slip'}], 3100), 'idle');
});

test('the owl cheers the winner’s line; in a photo finish it gasps first, then cheers', () => {
  const {gaspMs, cheerMs} = themeConfig.raceLog.owl;
  const winner = [{atMs: 20000, trigger: 'winner'}];
  assert.equal(commentatorPoseAt(winner, [], 20000), 'cheer');
  assert.equal(commentatorPoseAt(winner, [], 20000 + cheerMs - 1), 'cheer');
  assert.equal(commentatorPoseAt(winner, [], 20000 + cheerMs), 'idle');
  const photo = [{atMs: 20000, trigger: 'photoFinish'}];
  const photoLog = [{atMs: 20000, kind: 'photoFinish'}];
  assert.equal(commentatorPoseAt(photo, photoLog, 20000), 'gasp');
  assert.equal(commentatorPoseAt(photo, photoLog, 20000 + gaspMs), 'cheer');
  const busy = [{atMs: 21000, kind: 'varVerdict'}];
  assert.equal(commentatorPoseAt(winner, busy, 21000), 'cheer', 'a cheer beats a gasp');
});

test('a theme can retune the owl', () => {
  const theme = {raceLog: {owl: {talkMs: 500}}};
  const cues = [{atMs: 0, trigger: 'opening'}];
  assert.equal(commentatorPoseAt(cues, [], 600), 'talk');
  assert.equal(commentatorPoseAt(cues, [], 600, theme), 'idle');
});

test('the pose depends only on the race time, so a seek and a replay agree', () => {
  const rng = createRng(4242);
  const shape = {minEntrants: 4, maxEntrants: 12, lengths: CHAOS_LENGTHS_MS, mode: 'chaos',
    chaosLevel: 'carnage'};
  for (let race = 0; race < 10; race += 1) {
    const plan = buildRacePlan(randomRaceInput(rng, shape));
    const cues = buildCommentaryCues(plan, themeConfig.phrases, createRng(plan.seed + 1));
    const log = buildRaceLog(plan);
    const times = [];
    for (let raceMs = 0; raceMs <= plan.durationMs + 4000; raceMs += 250) {
      times.push(raceMs);
    }
    const forward = times.map((raceMs) => commentatorPoseAt(cues, log, raceMs));
    const backward = times.slice().reverse().map((raceMs) => commentatorPoseAt(cues, log, raceMs));
    assert.deepEqual(backward.reverse(), forward);
    forward.forEach((pose) => assert.ok(POSES.includes(pose), pose));
    cues.forEach((cue) => {
      assert.notEqual(commentatorPoseAt(cues, log, cue.atMs), 'idle', `${cue.trigger} speaks`);
    });
  }
});

test('the stage’s markup uses its own classes, never Tailwind’s or DaisyUI’s', () => {
  const daisy = /\baiux-(btn|alert|badge|input|loading|table|kbd|radio|textarea|card)\b/;
  ['stage-commentary.js', 'stage-hud.js', 'stage-podium.js', 'sprites/booth.js'].forEach((file) => {
    assert.ok(!daisy.test(componentSource(file)), `${file} uses a DaisyUI class`);
  });
  const skip = 'ss-btn ss-btn-sm ss-btn-neutral skip-button';
  assert.ok(componentSource('stage-hud.js').includes(skip));
  const podium = componentSource('stage-podium.js');
  ['\'ss-btn\': true', '\'ss-btn-primary\'', '\'ss-btn-outline\''].forEach((name) => {
    assert.ok(podium.includes(name), name);
  });
});

test('the race log is a log that never announces: the banner stays the one live channel', () => {
  const source = componentSource('stage-commentary.js');
  assert.ok(source.includes('role="log"'));
  assert.ok(source.includes('aria-live="off"'));
  assert.ok(!/aria-live="(polite|assertive)"/.test(source), 'no second live region');
  assert.ok(source.includes('aria-hidden="true"'), 'the booth is decorative');
});

test('the owl’s drawing never depends on its pose: a pose change is a class change', () => {
  const source = componentSource('sprites/booth.js');
  const start = source.indexOf('export function owlCommentatorSprite(');
  const body = source.slice(start, source.indexOf('\n}\n', start));
  assert.ok(start >= 0, 'owlCommentatorSprite is exported');
  assert.ok(!body.includes('svg`'), 'the sprite builds no SVG of its own');
  assert.ok(/content: boothContent\(label\)/.test(body), 'the content depends on the sign only');
  assert.ok(/function boothContent\(label\)/.test(source));
  ['idle', 'talk', 'gasp', 'cheer'].forEach((pose) => {
    assert.ok(source.includes(`${pose}: '${pose}'`), pose);
  });
});

test('the booth sheet: ss-oc- keyframes, transforms and opacity, and a reduced-motion rule', () => {
  const source = componentSource('sprites/booth.js');
  const keyframes = [...source.matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => match[1]);
  assert.ok(keyframes.length > 0);
  keyframes.forEach((name) => assert.ok(name.startsWith('ss-oc-'), name));
  assert.ok(source.includes('@media (prefers-reduced-motion: reduce)'));
  assert.ok(!/\b[\w-]+="var\(/.test(source), 'never var() in an SVG attribute');
  const frames = source.slice(source.indexOf('@keyframes'));
  const animated = [...frames.matchAll(/\{\s*([a-z-]+):/g)].map((match) => match[1]);
  animated.forEach((property) => {
    assert.ok(['transform', 'opacity', 'animation'].includes(property), property);
  });
});
